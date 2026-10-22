// ─────────────────────────────────────────────────────────────
// EmailList — Outreach › Contacts (the email list) (the same parts as the other apps' list screens)
// Title · + Add · Import (light) · Log pitch (dark)
// Summary line: ● n contacts · to follow up · Copy emails
// Chips: All · Active · Gifted · Invited · Lead (the app remembers the last one)
// Toolbar (40 px): Search · Filter (category, tier, status, account, place, added) · Sort · Download
// Active filters as tags (✕) · the contacts in one white card
// Phone: two lines per contact, status pill on the right · iPad/desktop: one-line table, Status 2nd
// Windows (one level): Filter (sheet on phone), contact, Import (the three steps)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, Z, PAL, RADIUS, SHADOW } from "./constants";
import { fmtD } from "./formatters";
import { B, I, S, Lbl, ConfirmDialog, BAR_BTN, SummaryLine, Strong, PillBtn, ListCard, Sheet, useEscape, Chip, ChipRow, MiniInput, MiniSelect } from "./atoms";
import { MoreMenu } from "./PlannerWindows";
import {
  OUTREACH_CATEGORIES, OUTREACH_TIERS, OUTREACH_COLUMNS, STATUS_FILTERS, SORTS, ADDED, DEFAULT_VIEW, CHIPS, PIPELINES, NO_TIER,
  catOf, tierOf, statusOf, statusesFor, isCategory, isTier, isChip, chipCounts, followUpDue, repitchReady, nextKind, applyView, activeFilters, emailsText, copyText, headerRow, buildPrompt, NO_FILTERS, placeOf,
  pipelineOf, statusAfterPitch,
} from "./outreach";
import { kitInfo } from "./useEmailKit";
import type { EmailTemplate } from "./useEmailKit";
import { fillFor, composeUrl, openMail, templatesFor, pickTemplate, kitUrlOf, accountOfTemplate, logKind, HOSPITALITY } from "./outlook";
import type { Pitch, ChipKey, OutreachEvent } from "./outreach";
import type { OutreachContact, OutreachView, SortKey } from "./outreach";
import { downloadExcel, downloadTemplate, downloadListPdf } from "./outreachExport";
import { showUndo, showNote } from "./undo";

// ── small line icons (no icon library needed) ─────────────────
const BAR_H = 56;   // the sticky search bar: 8 + 40 + 8
const TRASH = "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3";
const ARROW_UP = "M12 19V5M5 12l7-7 7 7";
const MAIL = "M4 6h16v12H4zM4 7l8 6 8-6";
const Ico = ({ d, size = 14, color = "currentColor" }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
const IC = {
  copy:     "M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  search:   "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  filter:   "M4 5h16l-6 7.5V19l-4 1v-7.5z",
  sort:     "M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  table:    "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
};

const VIEW_KEY = "lh_outreach_view";
const CHIP_KEY = "lh_outreach_chip";   // the last chip, kept when the app is closed
// the Dashboard opens Contacts already filtered (search and other filters cleared)
export function presetContactsView(patch: Partial<OutreachView>) {
  const v: OutreachView = { ...DEFAULT_VIEW, ...patch };
  if (v.chip === "active" && !patch.sort) v.sort = "urgent";
  try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(v)); localStorage.setItem(CHIP_KEY, v.chip); } catch { /* ignore */ }
}
const loadView = (): OutreachView => {
  let v: OutreachView = DEFAULT_VIEW, fresh = true;
  try { const saved = sessionStorage.getItem(VIEW_KEY); if (saved) { v = { ...DEFAULT_VIEW, ...JSON.parse(saved) }; fresh = false; } } catch { v = DEFAULT_VIEW; }
  let chip: ChipKey = v.chip;
  try { const c = localStorage.getItem(CHIP_KEY); if (isChip(c)) chip = c; } catch { /* ignore */ }
  if (!isChip(chip)) chip = "all";
  // a fresh start on Active opens most urgent first
  const sort: SortKey = fresh && chip === "active" ? "urgent" : (SORTS.some(x => x.key === v.sort) ? v.sort : "az");
  // values that aren't on the lists any more (old tiers, Events / Others) → All
  const tier = v.tier === "all" || v.tier === "none" || isTier(v.tier) ? v.tier : "all";
  const cat  = v.cat === "all" || isCategory(v.cat) ? v.cat : "all";
  const status = STATUS_FILTERS.some(x => x.key === v.status) ? v.status : "all";
  return { ...v, chip, sort, tier, cat, status };
};

const CatPill = ({ k }: { k: string }) => {
  const c = catOf(k);
  return <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.03em", padding: "2px 8px", borderRadius: RADIUS.tag, border: `1px solid ${c.border}`, background: c.bg, color: c.color, whiteSpace: "nowrap" as const }}>{c.label}</span>;
};

interface EmailListProps {
  outreach:  any;          // useOutreach()
  kit?:      any;          // useEmailKit() — the templates and media kit links for Write
  settings:  any;
  isMobile:  boolean;
  isWide:    boolean;      // ≥ 1200 px
  stickyTop: number;       // height of the app header (table header sticks below it)
}

// Where a contact stands, as a pill: New · Pitched 12.10. · Follow up · Replied · Gifted · Invited · Lead · Client · Declined · No reply
const shortD = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const statusLook = (c: OutreachContact) => {
  if (followUpDue(c)) return { bg: PAL.waiting.wash, border: PAL.waiting.mid, color: PAL.waiting.ink, text: `Follow up ${c.followStep === "fu2" ? 2 : 1}` };
  if (repitchReady(c)) return { bg: PAL.neutral.wash, border: C.pillOn, color: PAL.neutral.ink, text: "Re-pitch" };
  switch (c.status) {
    case "pitched":  return { bg: PAL.neutral.fill, border: C.edge, color: PAL.neutral.ink,
                       text: (c.followSent || 0) > 0 ? `FU ${Math.min(2, c.followSent || 0)} · ${c.lastContact ? shortD(c.lastContact) : ""}`.trim() : `Pitched${c.lastContact ? " " + shortD(c.lastContact) : ""}` };
    case "replied":  return { bg: PAL.progress.wash, border: PAL.progress.mid, color: PAL.progress.ink, text: "Replied" };
    case "gifted": case "invited": case "lead": case "client":
                     return { bg: PAL.done.wash, border: PAL.done.mid, color: PAL.done.ink, text: statusOf(c.status).label };
    case "declined": case "no_reply":
                     return { bg: PAL.neutral.wash, border: C.rule, color: C.muted, text: statusOf(c.status).label };
    default:         return { bg: C.white, border: C.rule, color: C.muted, text: "New" };
  }
};
// no template for this contact yet: what to add in Email kit
const noTemplateText = (category: string) => HOSPITALITY.includes(category)
  ? "No hotel & restaurant template yet — add one in Email kit with the category Hotel or Restaurant"
  : `No ${pipelineOf(category) === "ugc" ? "UGC" : "@lynnhoa"} template yet — add one in Email kit`;
// New · Pitched / Follow up (until the 2nd follow-up is out) · Re-pitch: the pill writes the email (✉) —
// one tap, no window; the other pills open the contact
const canWrite = (c: OutreachContact) => !c.status || c.status === "new" || (c.status === "pitched" && (c.followSent || 0) < 2) || repitchReady(c);
const StatusPill = ({ c, onWrite }: { c: OutreachContact; onWrite?: (c: OutreachContact) => void }) => {
  const l = statusLook(c);
  const pill: any = { fontSize: TYPE.micro.size, letterSpacing: "0.03em", padding: "2px 8px", borderRadius: RADIUS.tag, border: `1px solid ${l.border}`, background: l.bg, color: l.color, whiteSpace: "nowrap" as const, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1.4 };
  if (!onWrite || !canWrite(c)) return <span style={pill}>{l.text}</span>;
  // a larger tap area around the small pill (the row itself still opens the contact)
  return (
    <button onClick={(e) => { e.stopPropagation(); onWrite(c); }} aria-label={`Write to ${c.company || c.email}`} title="Write the email"
      style={{ background: "none", border: "none", padding: "8px 0 8px 10px", margin: "-8px 0 -8px -10px", cursor: "pointer", flexShrink: 0, fontFamily: SANS, display: "inline-flex" }}>
      <span style={pill}><Ico d={MAIL} size={11} />{l.text}</span>
    </button>
  );
};
// a reply you haven't opened yet
const ReplyDot = () => <span aria-label="New reply" style={{ width: 7, height: 7, borderRadius: "50%", background: PAL.progress.mid, flexShrink: 0, display: "inline-block" }} />;

export default function EmailList({ outreach, kit, settings, isMobile, isWide, stickyTop }: EmailListProps) {
  const { contacts, loading, loadError, loginEmail } = outreach;
  const [view, setView]       = useState<OutreachView>(loadView);
  const [open, setOpen]       = useState<null | "filter" | "sort" | "download">(null);
  useEscape(!!open, () => setOpen(null));
  const [showCols, setShowCols] = useState(false);
  const [openId, setOpenId]   = useState<string | null>(null);
  const [adding, setAdding]   = useState(false);                 // "+ Add": the contact window, empty
  const newC = useMemo(() => (adding ? newContact() : null), [adding]);
  const setToast = (t: string | null) => { if (t) showNote(t); };   // the app-wide message (same look as the save message)
  const [busy, setBusy]       = useState(false);
  const [showLog, setShowLog] = useState(false);
  // the "↑" button shows after about two screens
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const fn = () => setShowTop(window.scrollY > 1200);
    fn(); window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => { try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* ignore */ } }, [view]);
  useEffect(() => { try { localStorage.setItem(CHIP_KEY, view.chip); } catch { /* ignore */ } }, [view.chip]);

  // Write: the Undo bar right away, and once more when you come back from your mail app
  // (the first one is often gone by then) — up to 10 minutes later
  const pendingUndo = useRef<{ msg: string; undo: () => Promise<void>; at: number } | null>(null);
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible") return;
      const p = pendingUndo.current;
      if (!p) return;
      pendingUndo.current = null;
      if (Date.now() - p.at < 10 * 60e3) setTimeout(() => showUndo(p.msg, p.undo), 400);
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, []);
  // ✉ on a status pill: the email in your mail app with the preselected template, logged, no window
  const quickWrite = (c: OutreachContact) => {
    const list = templatesFor(kit?.templates || [], c.category);
    const tpl = list.find(t => t.id === pickTemplate(list, c.category, nextKind(c) || "follow_up_2", outreach.pitches || []));
    if (!tpl) { showNote(noTemplateText(c.category)); return; }
    if (!tpl.body.trim()) { showNote("This template has no text yet — add it in Email kit"); return; }
    const url = kitUrlOf(kit?.kits, tpl.kit);
    if (tpl.kit && !url) { showNote(`Add the ${kitInfo(tpl.kit)!.short} link in Email kit first`); return; }
    const mail = fillFor(tpl, c, url || null);
    const before = [{ id: c.id, status: c.status, lastContact: c.lastContact }];
    // the save starts first, then your mail app opens in the same tap
    const kind = logKind(tpl);
    const saving: Promise<Pitch[]> = outreach.logPitches([c.id], kind, undefined, { restart: kind === "pitch", templateId: tpl.id, account: accountOfTemplate(tpl) });
    openMail(composeUrl(c.email, mail.subject, mail.body));
    saving.then(added => written(`${kind === "follow_up" ? "Follow-up" : "Pitch"} logged · ${tpl.name || "template"}`, () => outreach.undoLog(added, before)))
      .catch((e: any) => showNote(e?.message || "Couldn't log it — open the contact and use + Pitch"));
  };
  const written = (msg: string, undo: () => Promise<void>) => {
    let done = false;
    const once = async () => {
      if (done) return;
      done = true; pendingUndo.current = null;
      try { await undo(); showNote("Undone ✓"); } catch (e: any) { showNote(e?.message || "Couldn't undo."); }
    };
    pendingUndo.current = { msg, undo: once, at: Date.now() };
    showUndo(msg, once);
  };

  const shown  = useMemo(() => applyView(contacts, view), [contacts, view]);
  const uniq = (xs: string[]) => Array.from(new Set(xs.map(x => (x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));
  const countries = useMemo(() => uniq(contacts.map((c: OutreachContact) => c.country)), [contacts]);
  // with a country picked, only that country's cities
  const cities = useMemo(() => uniq(contacts.filter((c: OutreachContact) => !view.country || view.country === "all" || c.country === view.country).map((c: OutreachContact) => c.city)), [contacts, view.country]);
  const counts = useMemo(() => { const m: Record<string, number> = {}; contacts.forEach((c: OutreachContact) => { m[c.category] = (m[c.category] || 0) + 1; }); return m; }, [contacts]);
  const nFilters = activeFilters(view);
  const filtered = nFilters > 0 || !!view.q.trim();
  const narrowed = filtered || view.chip !== "all";   // a chip shows part of the list too
  const nDue = useMemo(() => contacts.filter((c: OutreachContact) => followUpDue(c)).length, [contacts]);   // pitched, no answer, due again
  const brand = (settings?.company || settings?.name || "LH Studio").trim();
  const set = (patch: Partial<OutreachView>) => setView(v => ({ ...v, ...patch }));
  // Active opens most urgent first; leaving it goes back to A–Z (unless another sort was picked)
  const setChip = (chip: ChipKey) => setView(v => ({ ...v, chip, sort: chip === "active" ? "urgent" : v.sort === "urgent" ? "az" : v.sort }));
  const chipN = useMemo(() => chipCounts(contacts, view), [contacts, view]);
  const nNew  = useMemo(() => contacts.filter((c: OutreachContact) => c.replyNew).length, [contacts]);   // new replies (badge on Active)

  const copy = async (text: string, msg: string) => { const ok = await copyText(text); setToast(ok ? msg : "Couldn't copy"); };
  const fileName = (which: "filtered" | "full") =>
    `${brand} – Email list${which === "filtered" ? ` – ${view.cat !== "all" ? catOf(view.cat).label : "Filtered"}` : ""} – ${fmtD(new Date().toISOString().slice(0, 10))}`;
  const pdfTitle = (which: "filtered" | "full", n: number) =>
    `Email list${which === "filtered" && view.cat !== "all" ? ` · ${catOf(view.cat).label}` : ""} · ${n} ${n === 1 ? "contact" : "contacts"}`;
  const doDownload = async (which: "filtered" | "full", kind: "excel" | "pdf") => {
    setOpen(null);
    const list = which === "filtered" ? shown : applyView(contacts, { ...DEFAULT_VIEW, sort: view.sort });
    if (kind === "excel") { downloadExcel(list, fileName(which)); return; }
    setBusy(true);
    try { await downloadListPdf(list, pdfTitle(which, list.length), fileName(which), settings); }
    catch (e: any) { setToast(e?.message || "The PDF couldn't be created."); }
    finally { setBusy(false); }
  };

  const iconBtn = (key: "filter" | "sort" | "download", icon: string, label: string, active = false, badge = 0) => (
    <button key={key} onClick={() => setOpen(o => (o === key ? null : key))} aria-label={label} title={label}
      style={{ height: 40, minWidth: 40, padding: isMobile ? 0 : "0 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${active ? C.pillOn : C.field}`, background: active ? PAL.neutral.fill : C.white, color: C.black, borderRadius: RADIUS.tile, cursor: "pointer", position: "relative", flexShrink: 0, fontFamily: SANS, fontSize: TYPE.subtext.size, whiteSpace: "nowrap" as const, boxSizing: "border-box" as const }}>
      <Ico d={icon} size={15} />
      {!isMobile && <span>{label}</span>}
      {badge > 0 && <span style={{ position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: PAL.waiting.mid, color: PAL.waiting.ink, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 0 }}>{badge}</span>}
    </button>
  );

  // ── popovers / sheet ────────────────────────────────────────
  const menuBox: any = { position: "absolute", top: "calc(100% + 6px)", right: 0, background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.pop, zIndex: Z.menu, padding: "4px 0", overflow: "hidden" };
  const opt = (on: boolean): any => ({ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height: 34, padding: "0 12px", border: "none", background: on ? "rgba(0,0,0,0.035)" : "none", color: on ? C.black : C.muted, fontFamily: SANS, fontSize: 13, cursor: "pointer", textAlign: "left" as const });

  const filterBody = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: SERIF, fontSize: 17 }}>Filter</span>
        <button onClick={() => set(NO_FILTERS)} style={{ background: "none", border: "none", color: C.muted, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>Reset</button>
      </div>
      <Lbl>Category</Lbl>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, maxHeight: isMobile ? 260 : 300, overflowY: "auto" }}>
        <button onClick={() => set({ cat: "all" })} style={opt(view.cat === "all")}><span>All</span><span>{contacts.length}{view.cat === "all" ? " ✓" : ""}</span></button>
        {OUTREACH_CATEGORIES.map(c => (
          <button key={c.key} onClick={() => set({ cat: c.key })} style={opt(view.cat === c.key)}><span>{c.label}</span><span>{counts[c.key] || 0}{view.cat === c.key ? " ✓" : ""}</span></button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        <div><Lbl>Tier</Lbl>
          <S value={view.tier || "all"} onChange={(e: any) => set({ tier: e.target.value })}>
            <option value="all">All</option>
            {OUTREACH_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            <option value="none">{NO_TIER}</option>
          </S>
        </div>
        <div><Lbl>Status</Lbl>
          <S value={view.status || "all"} onChange={(e: any) => set({ status: e.target.value })}>
            {STATUS_FILTERS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </S>
        </div>
        <div><Lbl>Account</Lbl>
          <S value={view.acc || "all"} onChange={(e: any) => set({ acc: e.target.value })}>
            <option value="all">All</option>
            {PIPELINES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </S>
        </div>
        <div><Lbl>Country</Lbl>
          <S value={view.country || "all"} onChange={(e: any) => set({ country: e.target.value, city: "all" })}>
            <option value="all">All</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </S>
        </div>
        <div><Lbl>City</Lbl>
          <S value={view.city} onChange={(e: any) => set({ city: e.target.value })}>
            <option value="all">All</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </S>
        </div>
        <div><Lbl>Added</Lbl>
          <S value={view.added} onChange={(e: any) => set({ added: e.target.value })}>
            {ADDED.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </S>
        </div>
      </div>
      <B onClick={() => setOpen(null)} s={{ width: "100%", marginTop: 14 }}>Show {shown.length} {shown.length === 1 ? "contact" : "contacts"}</B>
    </>
  );

  const toolbar = (
    <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
      <div style={{ flex: isMobile ? 1 : "0 1 340px", minWidth: 0, height: 40, border: `1px solid ${C.field}`, borderRadius: RADIUS.tile, background: C.white, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", boxSizing: "border-box" as const, color: C.light }}>
        <Ico d={IC.search} size={15} />
        <input value={view.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search contacts" aria-label="Search"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 16, color: C.black, height: 34, padding: 0 }} />
      </div>
      <div style={{ position: "relative" }}>
        {iconBtn("filter", IC.filter, nFilters ? `Filter · ${nFilters}` : "Filter", nFilters > 0, isMobile ? nFilters : 0)}
        {open === "filter" && !isMobile && <div style={{ ...menuBox, width: 300, padding: 14 }}>{filterBody}</div>}
      </div>
      <div style={{ position: "relative" }}>
        {iconBtn("sort", IC.sort, SORTS.find(s => s.key === view.sort)?.short || "Sort")}
        {open === "sort" && (
          <div style={{ ...menuBox, width: 180 }}>
            {SORTS.map(s => <button key={s.key} onClick={() => { set({ sort: s.key as SortKey }); setOpen(null); }} style={opt(view.sort === s.key)}><span>{s.label}</span><span>{view.sort === s.key ? "✓" : ""}</span></button>)}
          </div>
        )}
      </div>
      <div style={{ position: "relative" }}>
        {iconBtn("download", IC.download, busy ? "Preparing…" : "Download")}
        {open === "download" && (
          <div style={{ ...menuBox, width: 250 }}>
            {(narrowed ? (["filtered", "full"] as const) : (["full"] as const)).map((w, i) => (
              <div key={w} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderTop: i ? `1px solid ${C.rule}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.black }}>{w === "filtered" ? "Filtered list" : "Full list"}</div>
                  <div style={{ fontSize: TYPE.label.size, color: C.muted }}>{w === "filtered" ? `${view.cat !== "all" ? catOf(view.cat).label + " · " : ""}${shown.length}` : `All · ${contacts.length}`}</div>
                </div>
                <B v="sec" onClick={() => doDownload(w, "excel")} s={{ ...BAR_BTN, height: 26, minHeight: 26 }}>Excel</B>
                <B v="sec" onClick={() => doDownload(w, "pdf")} s={{ ...BAR_BTN, height: 26, minHeight: 26 }}>PDF</B>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const tagStyle = (c?: any): any => ({ height: 30, padding: "0 11px", border: `1px solid ${c ? c.border : C.pillOn}`, background: c ? c.bg : PAL.neutral.fill, color: c ? c.color : C.black, borderRadius: RADIUS.pill, fontSize: TYPE.subtext.size, display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontFamily: SANS, whiteSpace: "nowrap" as const });
  // the active filters as chips (each with ✕) — only while a filter is on; the sort lives in the ↑↓ button
  const hasTags = view.cat !== "all" || (!!view.tier && view.tier !== "all") || (!!view.status && view.status !== "all") || (!!view.acc && view.acc !== "all") || view.city !== "all" || (!!view.country && view.country !== "all") || view.added !== "any";
  const tags = hasTags && (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 10 }}>
      {view.cat !== "all" && <button onClick={() => set({ cat: "all" })} style={tagStyle(catOf(view.cat))}>{catOf(view.cat).label} ✕</button>}
      {view.tier && view.tier !== "all" && <button onClick={() => set({ tier: "all" })} style={tagStyle()}>{view.tier === "none" ? NO_TIER : tierOf(view.tier).label} ✕</button>}
      {view.status && view.status !== "all" && <button onClick={() => set({ status: "all" })} style={tagStyle()}>{STATUS_FILTERS.find(x => x.key === view.status)?.label} ✕</button>}
      {view.acc && view.acc !== "all" && <button onClick={() => set({ acc: "all" })} style={tagStyle()}>{PIPELINES.find(x => x.key === view.acc)?.label} ✕</button>}
      {view.country && view.country !== "all" && <button onClick={() => set({ country: "all" })} style={tagStyle()}>{view.country} ✕</button>}
      {view.city !== "all" && <button onClick={() => set({ city: "all" })} style={tagStyle()}>{view.city} ✕</button>}
      {view.added !== "any" && <button onClick={() => set({ added: "any" })} style={tagStyle()}>{ADDED.find(a => a.key === view.added)?.label} ✕</button>}
    </div>
  );

  // ── list ────────────────────────────────────────────────────
  const emailCell = (c: OutreachContact, small = false) => (
    <button onClick={(e) => { e.stopPropagation(); copy(c.email, "Email copied ✓"); }} title="Copy email" className="lh-copy-email"
      style={{ background: "none", border: "none", padding: 0, cursor: "copy", display: "inline-flex", alignItems: "center", gap: 5, color: small ? C.muted : C.black, fontFamily: SANS, fontSize: small ? TYPE.label.size : 13, minWidth: 0, maxWidth: "100%" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.email}</span>
      <span className="lh-copy-ico" style={{ color: C.light, display: "inline-flex", opacity: isMobile ? 1 : 0 }}><Ico d={IC.copy} size={12} /></span>
    </button>
  );

  const phoneList = (
    <ListCard s={{ marginTop: 10 }}>
      {shown.map((c: OutreachContact, i: number) => (
        <div key={c.id} onClick={() => setOpenId(c.id)} style={{ minHeight: 54, padding: "9px 10px 9px 12px", borderTop: i ? `1px solid ${C.hair}` : "none", cursor: "pointer", boxSizing: "border-box" as const }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: TYPE.row.size, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: c.replyNew ? 500 : "normal" }}>
              {c.replyNew && <ReplyDot />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }}>{c.company || c.email}{placeOf(c) && <span style={{ fontSize: TYPE.label.size, color: C.muted, fontWeight: "normal" }}> · {placeOf(c)}</span>}</span>
            </span>
            <StatusPill c={c} onWrite={quickWrite} />
          </div>
          <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {c.replyNew ? (
              <span style={{ color: PAL.progress.ink, whiteSpace: "nowrap" as const }}>New reply{c.replyAt ? ` · ${shortD(String(c.replyAt).slice(0, 10))}` : ""}</span>
            ) : (
              <>
                {c.contactName && <span style={{ flexShrink: 0 }}>{c.contactName} ·</span>}
                {emailCell(c, true)}
              </>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{catOf(c.category).label}</span>
          </div>
        </div>
      ))}
    </ListCard>
  );

  const cols: { key: string; label: string; fr: string; sort?: SortKey[]; min?: number }[] = [
    { key: "company", label: "Company", fr: "1.3fr", sort: ["az", "za"] },
    { key: "status", label: "Status", fr: "1.1fr", sort: ["urgent"], min: 106 },   // the whole pill, also on the iPad
    { key: "contactName", label: "Contact", fr: "1fr" },
    { key: "email", label: "Email", fr: "1.8fr" },
    { key: "category", label: "Category", fr: "0.9fr", sort: ["cat"], min: 92 },
    { key: "tier", label: "Tier", fr: "0.8fr" },
    { key: "city", label: "City", fr: "0.9fr" },
    { key: "country", label: "Country", fr: "0.9fr" },
    { key: "web", label: "Website / IG", fr: "1.2fr" },
    ...(isWide ? [{ key: "added", label: "Added", fr: "0.8fr", sort: ["new", "old"] as SortKey[] }] : []),
  ];
  const headClick = (c: typeof cols[number]) => {
    if (!c.sort) return;
    const [a, b] = c.sort;
    set({ sort: view.sort === a && b ? b : a });
  };
  const arrow = (c: typeof cols[number]) => !c.sort ? "" : view.sort === c.sort[0] ? (c.key === "added" ? " ▾" : " ▴") : view.sort === c.sort[1] ? (c.key === "added" ? " ▴" : " ▾") : "";
  const td: any = { padding: "0 10px", height: 40, display: "flex", alignItems: "center", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", borderTop: `1px solid ${C.hair}`, minWidth: 0 };
  const cut = (t: any) => <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }}>{t}</span>;
  const table = (
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: cols.map(c => `minmax(${c.min || 0}px,${c.fr})`).join(" "), background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, padding: "0 4px 4px" }}>
      {cols.map(c => (
        <div key={c.key} onClick={() => headClick(c)} style={{ position: "sticky", top: stickyTop + BAR_H, background: C.white, zIndex: 2, padding: "0 10px", height: 34, display: "flex", alignItems: "center", fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted, cursor: c.sort ? "pointer" : "default", userSelect: "none" as const, borderRadius: 0 }}>{c.label}{arrow(c)}</div>
      ))}
      {shown.map((c: OutreachContact) => (
        <div key={c.id} className="lh-row" onClick={() => setOpenId(c.id)} style={{ display: "contents", cursor: "pointer" }}>
          <div style={{ ...td, gap: 6, fontWeight: c.replyNew ? 500 : "normal" }}>{c.replyNew && <ReplyDot />}{cut(c.company)}</div>
          <div style={td}><StatusPill c={c} onWrite={quickWrite} /></div>
          <div style={{ ...td, color: c.contactName ? C.black : C.light }}>{cut(c.contactName || "—")}</div>
          <div style={td}>{emailCell(c)}</div>
          <div style={td}><CatPill k={c.category} /></div>
          <div style={{ ...td, color: c.tier ? C.black : C.light }}>{cut(tierOf(c.tier).label || "—")}</div>
          <div style={td}>{cut(c.city)}</div>
          <div style={td}>{cut(c.country)}</div>
          <div style={{ ...td, color: C.muted }}>{cut(c.web)}</div>
          {isWide && <div style={{ ...td, color: C.muted }}>{c.createdAt ? fmtD(c.createdAt.slice(0, 10)) : ""}</div>}
        </div>
      ))}
    </div>
  );

  const current = contacts.find((c: OutreachContact) => c.id === openId) || null;

  return (
    <div>
      {/* hover: row tint + show the copy icon (desktop / iPad) */}
      <style>{`.lh-row:hover > div { background: rgba(0,0,0,0.025); } .lh-row:hover .lh-copy-ico, .lh-copy-email:focus .lh-copy-ico { opacity: 1 !important; } .lh-chips > div { scrollbar-width: none; } .lh-chips > div::-webkit-scrollbar { display: none; } .lh-cfrow:focus-within { background: ${C.bg}; }`}</style>

      {/* ── HEADER: title · Import · Log pitch ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" as const }}>Contacts</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <PillBtn onClick={() => setAdding(true)} title="Add one contact">+ Add</PillBtn>
          <PillBtn onClick={() => setShowCols(true)}>Import</PillBtn>
          {shown.length > 0 && !outreach.pitchError && <PillBtn dark onClick={() => setShowLog(true)} title="Log a pitch for the contacts in view">Log pitch</PillBtn>}
        </div>
      </div>
      <SummaryLine dot={nDue ? PAL.waiting.mid : PAL.neutral.mid}>
        <span style={{ whiteSpace: "nowrap" as const }}>{narrowed ? `${shown.length} of ${contacts.length}` : contacts.length} {contacts.length === 1 ? "contact" : "contacts"}</span>
        {nDue > 0 && <> · <Strong color={PAL.waiting.ink}>{nDue} to follow up</Strong></>}
        {shown.length > 0 && <> · <button onClick={() => copy(emailsText(shown), `${shown.length} ${shown.length === 1 ? "email" : "emails"} copied ✓`)} aria-label="Copy the emails in view" title="Copy the emails in view"
          style={{ background: "none", border: "none", padding: "4px 0", margin: "-4px 0", cursor: "pointer", color: C.black, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: SANS, fontSize: TYPE.subtext.size }}>Copy emails <Ico d={IC.copy} size={12} color={C.muted} /></button></>}
      </SummaryLine>
      {/* the reply check couldn't read the mailbox (e.g. a changed password) */}
      {outreach.mail?.lastError && (
        <p role="status" style={{ fontSize: TYPE.label.size, color: PAL.waiting.ink, margin: "6px 0 0", lineHeight: 1.5 }}>
          Reply check paused — {/auth|login|password|credential/i.test(outreach.mail.lastError) ? "the mailbox login failed" : outreach.mail.lastError}.{" "}
          <span style={{ color: C.muted }}>Check the mailbox password in Supabase → Edge Functions → Secrets.</span>
        </p>
      )}

      {/* chips: quick views; a search always looks through every contact */}
      {contacts.length > 0 && (
        <div className="lh-chips">
        <ChipRow s={{ marginTop: 4, paddingTop: 6, gap: 5 }}>
          {CHIPS.map(ch => (
            <Chip key={ch.key} on={view.chip === ch.key} tone={PAL.neutral} dot={false} label={ch.label} count={chipN[ch.key]}
              badge={ch.key === "active" ? nNew : 0} onClick={() => setChip(ch.key)} />
          ))}
        </ChipRow>
        </div>
      )}

      {/* search · filter · sort · download stay under the top bar while you scroll */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 99, background: C.bg, margin: "4px 0 0", padding: "8px 0" }}>
        {toolbar}
        {/* click outside closes a menu (inside the bar, so its menus stay on top) */}
        {open && !(open === "filter" && isMobile) && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: Z.menu - 1 }} />}
      </div>
      {tags}

      {/* ── CONTENT ── */}
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : contacts.length === 0 ? (
        <ListCard s={{ marginTop: 12, padding: "14px 14px 16px" }}>
          <p style={{ fontFamily: SERIF, fontSize: 15, color: C.black, margin: "0 0 6px" }}>No contacts yet</p>
          <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0, lineHeight: 1.6 }}>Tap <strong style={{ fontWeight: 500, color: C.black }}>+ Add</strong> for one contact, or <strong style={{ fontWeight: 500, color: C.black }}>Import</strong> for a list: build your Excel with the columns, copy the prompt for Claude, run Claude's SQL in Supabase.</p>
        </ListCard>
      ) : shown.length === 0 && !filtered && view.chip !== "all" ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Nothing in {CHIPS.find(x => x.key === view.chip)?.label} yet. <button onClick={() => setChip("all")} style={{ background: "none", border: "none", padding: 0, color: C.black, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>Show all</button></p>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>No contacts match. <button onClick={() => set({ q: "", ...NO_FILTERS })} style={{ background: "none", border: "none", padding: 0, color: C.black, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>Clear search and filters</button></p>
      ) : isMobile ? phoneList : table}

      {/* ↑ back to the top, once you've scrolled a bit */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to the top" title="Back to the top"
          style={{ position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 40, width: 40, height: 40, borderRadius: "50%",
            border: `1px solid ${C.edge}`, background: C.white, color: C.black, boxShadow: SHADOW.pop, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <Ico d={ARROW_UP} size={16} />
        </button>
      )}

      {/* ── FILTER SHEET (phone) ── */}
      {open === "filter" && isMobile && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: Z.modal }}>
          <div onClick={() => setOpen(null)} style={{ position: "absolute", inset: 0, background: "rgba(26,26,26,0.25)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: C.bg, borderTop: `1px solid ${C.rule}`, padding: "12px 14px calc(16px + env(safe-area-inset-bottom))", fontFamily: SANS }}>{filterBody}</div>
        </div>, document.body)}

      {/* ── CONTACT WINDOW ── */}
      {current && <ContactWindow c={current} outreach={outreach} kit={kit} onWritten={written} isMobile={isMobile} onClose={() => setOpenId(null)} onCopy={(t) => copy(t, "Email copied ✓")} />}
      {adding && !current && newC && <ContactWindow c={newC} isNew outreach={outreach} kit={kit} isMobile={isMobile} onClose={() => setAdding(false)} onCopy={(t) => copy(t, "Email copied ✓")}
        onOpen={(id) => { setAdding(false); setOpenId(id); }} />}

      {/* ── LOG A PITCH FOR THE CONTACTS IN VIEW ── */}
      {showLog && <LogWindow ids={shown.map((c: OutreachContact) => c.id)} followUp={view.status === "followup"} outreach={outreach} isMobile={isMobile}
        onClose={() => setShowLog(false)} onDone={(n) => { setShowLog(false); setToast(`${n} ${n === 1 ? "pitch" : "pitches"} logged ✓`); }} />}

      {/* ── IMPORT WINDOW: the three steps ── */}
      {showCols && (
        <Window title="Import contacts" isMobile={isMobile} onClose={() => setShowCols(false)}>
          <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "0 0 10px", lineHeight: 1.6 }}>
            1 · Build your Excel with these columns (first row).<br />
            2 · Copy the prompt, paste it into Claude and attach the Excel.<br />
            3 · Run Claude's SQL in Supabase → SQL editor, then come back here.
          </p>
          <ListCard>
            {OUTREACH_COLUMNS.map((col, i) => (
              <div key={col.key} style={{ display: "grid", gridTemplateColumns: "118px minmax(0,1fr)", gap: 8, padding: "9px 12px", borderTop: i ? `1px solid ${C.hair}` : "none" }}>
                <div>
                  <div style={{ fontSize: 13 }}>{col.label}</div>
                  <div style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", color: col.required ? PAL.waiting.ink : C.light, marginTop: 2 }}>{col.required ? "REQUIRED" : "OPTIONAL"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>{col.example}</div>
                  {col.note && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{col.note}</div>}
                </div>
              </div>
            ))}
          </ListCard>
          <p style={{ fontSize: 11, color: C.muted, margin: "6px 4px 12px" }}>Date added and source file are filled in automatically.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            <PillBtn onClick={() => copy(headerRow(), "Header row copied ✓ — paste into cell A1")} s={{ flex: 1, height: 36, justifyContent: "center" }}>Copy header row</PillBtn>
            <PillBtn onClick={() => downloadTemplate(`${brand} – Email list template`)} s={{ flex: 1, height: 36, justifyContent: "center" }}>Excel template</PillBtn>
          </div>
          <PillBtn dark onClick={() => copy(buildPrompt(loginEmail), "Prompt copied ✓ — paste it into Claude")} s={{ width: "100%", height: 38, justifyContent: "center", marginTop: 8, fontSize: TYPE.row.size }}>Copy prompt for Claude</PillBtn>
        </Window>
      )}

    </div>
  );
}

// ── One-level window: full screen on the phone, centred elsewhere ─
function Window({ title, isMobile, onClose, children, footer }: { title: string; isMobile: boolean; onClose: () => void; children: any; footer?: any }) {
  useEscape(true, onClose);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: Z.modal, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "center", background: isMobile ? C.bg : "rgba(250,249,247,0.85)", fontFamily: SANS }}>
      <div style={{ width: "100%", maxWidth: isMobile ? "none" : 480, maxHeight: isMobile ? "none" : "88vh", background: C.bg, border: isMobile ? "none" : `1px solid ${C.rule}`, borderRadius: isMobile ? 0 : 2, boxShadow: isMobile ? "none" : "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 8px 0 2px", borderBottom: `1px solid ${C.rule}`, flexShrink: 0 }}>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20 }}>✕</button>
          <span style={{ fontFamily: SERIF, fontSize: 15, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{title}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 16px" }}>{children}</div>
        {footer && <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ── Contact: one level — the fields are the view (no Edit step) ──
// Status (saves at once) · Last contact · Log · fields · timeline · Delete;
// footer Done → Cancel | Save as soon as you type; after Save the window stays open.
// a new contact: the window opens empty, ready to type (Save → it opens as itself);
// category and tier start with the last ones used for a new contact
const DEFAULTS_KEY = "lh_new_contact_defaults";
const newContact = (): OutreachContact => {
  let d: any = {};
  try { d = JSON.parse(localStorage.getItem(DEFAULTS_KEY) || "{}") || {}; } catch { d = {}; }
  return { id: "", company: "", contactName: "", email: "", category: (isCategory(d.category) ? d.category : "fashion") as any, tier: (isTier(d.tier) ? d.tier : "") as any, status: "new" as any,
    lastContact: null, replyAt: null, replyNew: false, clientId: null, web: "", city: "", country: "", notes: "", source: "", createdAt: "" };
};
// pr@chanel.com → { company: "Chanel", web: "chanel.com" } · nothing for gmail, gmx, web.de, icloud …
const FREE_MAIL = /^(gmail|googlemail|gmx|web|icloud|me|mac|outlook|hotmail|live|msn|yahoo|ymail|t-online|aol|proton|protonmail|mail|freenet|posteo|arcor)\./i;
export const fromEmail = (email: string): { company: string; web: string } | null => {
  const m = String(email || "").trim().toLowerCase().match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  if (!m) return null;
  const parts = m[1].split(".");
  const three = parts.length >= 3 && ["co", "com", "org", "net", "gov", "ac"].includes(parts[parts.length - 2]);
  const base = parts.slice(three ? -3 : -2).join(".");            // chanel.com · brand.co.uk
  if (FREE_MAIL.test(base)) return null;
  const company = base.split(".")[0].split(/[-_]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return company ? { company, web: base } : null;
};
const TWO: any = { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 };

// the fields you type in; everything else (status, dates, the dot) comes from the stored contact
const EDIT_KEYS = ["email", "company", "contactName", "category", "tier", "city", "country", "web", "notes"] as const;
const sameFields = (a: OutreachContact, b: OutreachContact) => EDIT_KEYS.every(k => String((a as any)[k] ?? "") === String((b as any)[k] ?? ""));
const pickFields = (x: OutreachContact) => { const o: any = {}; EDIT_KEYS.forEach(k => { o[k] = (x as any)[k]; }); return o as Partial<OutreachContact>; };
// yyyy-mm-dd of a timestamp, in local time
const ymdLocal = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ── the compact window's parts (like the Planner windows: cards, 13 px, 32 px fields, 36 px rows) ──
const CAPS: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const WCARD: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, boxShadow: SHADOW.card, overflow: "hidden" };
const USER  = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0";
const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2";
const SecHead = ({ icon, label, tone }: { icon: string; label: string; tone: { wash: string; ink: string } }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "9px 2px 4px" }}>
    <span style={{ width: 18, height: 18, borderRadius: "50%", background: tone.wash, color: tone.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={icon} size={11} /></span>
    <span style={CAPS}>{label}</span>
  </div>
);
const linkBtn: any = { background: "none", border: "none", padding: "4px 2px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: C.black, textDecoration: "underline" };

// ── Contact: one level, compact — header ✕ · company · ⋯ (Delete contact) ──────
// Card: Status · Last contact · (Lead → Client) · Template + Write
// Contact card: 34 px rows, label left, value right — tap a value to type (City · Country share a row)
// Timeline card · added · footer: one button — Done, Save as soon as you type (stays open after Save)
function ContactWindow({ c, outreach, kit, onWritten, isMobile, onClose, onCopy, isNew, onOpen }: { c: OutreachContact; outreach: any; kit?: any; onWritten?: (msg: string, undo: () => Promise<void>) => void; isMobile: boolean; onClose: () => void; onCopy: (t: string) => void; isNew?: boolean; onOpen?: (id: string) => void }) {
  const [f, setF] = useState(c);
  const [dupId, setDupId] = useState<string | null>(null);     // the contact that already has this email
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const changed = !sameFields(f, c);
  // the stored contact changed (status, a save, a reload): keep what's being typed, take over the rest
  const prevC = useRef(c);
  useEffect(() => {
    setF(x => (sameFields(x, prevC.current) ? { ...c } : { ...x, status: c.status, lastContact: c.lastContact, replyAt: c.replyAt, replyNew: c.replyNew, clientId: c.clientId }));
    prevC.current = c;
  }, [c]);
  // opening a contact clears its new-reply dot
  useEffect(() => { if (!isNew && c.replyNew && outreach.markSeen) outreach.markSeen(c.id).catch(() => {}); }, [c.id, c.replyNew]);

  const log = async (kind: "pitch" | "follow_up") => {
    setErr(null);
    try { await outreach.logPitches([c.id], kind, undefined, { restart: true }); showNote(kind === "pitch" ? "Pitch logged ✓" : "Follow-up logged ✓"); }
    catch (e: any) { setErr(e?.message || "Couldn't log it."); }
  };

  // Enter goes to the next field, the last one saves; the email fills Company and Website by itself
  // (only when they're still empty, not for gmail & co)
  const fillFromEmail = () => {
    const fill = fromEmail(f.email);
    if (fill) setF(x => ({ ...x, company: x.company || fill.company, web: x.web || fill.web }));
  };
  const onEnter = (e: any) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.currentTarget.dataset.k === "email") fillFromEmail();
    const form = e.currentTarget.closest("[data-cform]");
    const list = (form ? Array.from(form.querySelectorAll("input[data-k]")) : []) as HTMLInputElement[];
    const i = list.indexOf(e.currentTarget);
    if (i >= 0 && i < list.length - 1) list[i + 1].focus(); else { (e.currentTarget as HTMLInputElement).blur(); if (isNew || changed) save(); }
  };

  // Save: the window stays open (a new contact opens as itself)
  const save = async () => {
    if (busy) return;
    setErr(null); setDupId(null);
    const clean = { ...f, email: f.email.trim().toLowerCase() };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) { setErr("Please enter a valid email."); return; }
    if (!isCategory(clean.category)) { setErr("Pick a category."); return; }
    setBusy(true);
    try {
      if (isNew) {
        const n = await outreach.addContact(clean);
        try { localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ category: clean.category, tier: clean.tier })); } catch { /* ignore */ }
        onOpen?.(n.id);
        return;
      }
      setF(clean);
      await outreach.updateContact(c.id, pickFields(clean));
      showNote("Saved ✓");
    }
    catch (e: any) { setErr(e?.message || "Couldn't save."); if (e?.existingId) setDupId(e.existingId); }
    finally { setBusy(false); }
  };
  // ✕, tap outside, Escape: with unsaved typing, ask first
  const close = () => { if (changed) setAskDiscard(true); else onClose(); };
  const del = async () => {
    setAskDelete(false);
    try { await outreach.deleteContact(c.id); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };

  // timeline: emails sent (pitch log) + status changes and replies, newest first
  const timeline = useMemo(() => {
    if (isNew) return [];
    const ps = (outreach.pitches || []).filter((p: Pitch) => p.contactId === c.id).map((p: Pitch) => ({
      key: "p" + p.id, day: p.sentOn, ts: p.createdAt || "", pitch: p as Pitch | null, event: null as OutreachEvent | null,
      text: <>{p.kind === "follow_up" ? "Follow-up" : "Pitch"} · <span style={{ color: C.muted }}>{p.account === "createbylynn" ? "@createbylynn" : "@lynnhoa"}</span></>,
    }));
    const es = (outreach.events || []).filter((e: OutreachEvent) => e.contactId === c.id).map((e: OutreachEvent) => ({
      key: "e" + e.id, day: ymdLocal(e.at), ts: e.at, pitch: null as Pitch | null, event: e as OutreachEvent | null,
      text: e.kind === "reply" ? <span style={{ color: PAL.progress.ink }}>Reply received</span> : <>Status · <span style={{ color: C.muted }}>{statusOf(e.status || "new").label}{e.note ? ` · ${e.note}` : ""}</span></>,
    }));
    return [...ps, ...es].sort((a, b) => b.day.localeCompare(a.day) || b.ts.localeCompare(a.ts));
  }, [isNew, c.id, outreach.pitches, outreach.events]);
  // a status or reply line: one tap deletes (the newest status line also undoes that status), Undo brings it back
  const deleteLine = (e: OutreachEvent) => {
    outreach.deleteEvent(e).then(({ statusBefore, statusAfter }: { statusBefore: string | null; statusAfter: string | null }) => {
      showUndo(statusBefore ? `Status line deleted · back to ${statusOf(statusAfter || "new").label}` : `${e.kind === "reply" ? "Reply" : "Status"} line deleted`,
        () => outreach.restoreEvent(e, statusBefore));
    }).catch((x: any) => setErr(x?.message || "Couldn't delete."));
  };
  const deleteEntry = (p: Pitch) => {
    // one tap deletes, the Undo bar brings it back exactly as it was
    const c0 = (outreach.contacts || []).find((x: any) => x.id === p.contactId);
    const before = { lastContact: c0?.lastContact ?? null, status: c0?.status ?? null };
    outreach.deletePitch(p).then(() => showUndo(`${p.kind === "follow_up" ? "Follow-up" : "Pitch"} deleted`, () => outreach.restorePitch(p, before)))
      .catch((x: any) => setErr(x?.message || "Couldn't delete."));
  };

  const due = !isNew && followUpDue(c);
  const accLabel = c.category === "ugc" ? "@createbylynn" : "@lynnhoa";

  // ── Lead → Client in Manager (also for a Client that isn't linked yet)
  const [clientBusy, setClientBusy] = useState(false);
  const canMakeClient = !isNew && (c.status === "lead" || (c.status === "client" && !c.clientId));
  const toClient = async () => {
    if (clientBusy) return;
    if (changed) { setErr("Save your changes first — the client gets the saved details."); return; }
    setErr(null); setClientBusy(true);
    try {
      const r = await outreach.makeClient(c.id);
      showNote(r.created ? "Client created in Manager ✓" : `Linked to ${r.name} in Manager ✓`);
    }
    catch (e: any) { setErr(e?.message || "Couldn't create the client."); }
    finally { setClientBusy(false); }
  };

  // ── Write: the templates for this contact's account (your Email kit order); preselected:
  //    a template made for this contact's category (else one for any category), of the kind needed
  //    (follow-up when one is due, else pitch) — the one used last, else the first A–Z
  //    (saved with each pitch, so it's the same on phone, iPad and Mac)
  const pipe = pipelineOf(c.category);
  const tpls: EmailTemplate[] = useMemo(() => templatesFor(kit?.templates || [], c.category), [kit?.templates, c.category]);   // your Email kit order
  const wantKind = nextKind(c) || "follow_up_2";
  const preselect = useMemo(() => pickTemplate(tpls, c.category, wantKind, outreach.pitches || []), [tpls, wantKind, c.category, outreach.pitches]);
  const [tplId, setTplId] = useState(preselect);
  useEffect(() => { setTplId(preselect); }, [preselect]);
  const tpl = tpls.find(t => t.id === tplId) || null;
  const kitUrl = (k: string | null) => kitUrlOf(kit?.kits, k);
  const willPitch = tpl?.kind === "pitch" && statusAfterPitch(c.status) !== c.status;

  const write = () => {
    setErr(null);
    if (!tpl) return;
    if (!tpl.body.trim()) { setErr("This template has no text yet — add it in Email kit."); return; }
    if (tpl.kit && !kitUrl(tpl.kit)) { setErr(`Add the ${kitInfo(tpl.kit)!.short} link in Email kit first.`); return; }
    const typed = f.email.trim().toLowerCase();
    const to = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed) ? typed : c.email;
    const mail = fillFor(tpl, { contactName: f.contactName, company: f.company }, tpl.kit ? kitUrl(tpl.kit) : null);
    const before = [{ id: c.id, status: c.status, lastContact: c.lastContact }];
    const kind = logKind(tpl);
    // the save starts first, then your mail app opens in the same tap (the iPhone only opens apps from a tap)
    const saving: Promise<Pitch[]> = outreach.logPitches([c.id], kind, undefined, { restart: kind === "pitch", templateId: tpl.id, account: accountOfTemplate(tpl) });
    openMail(composeUrl(to, mail.subject, mail.body));
    saving.then(added => onWritten?.(`${kind === "follow_up" ? "Follow-up" : "Pitch"} logged · ${tpl.name || "template"}`, () => outreach.undoLog(added, before)))
      .catch((e: any) => setErr(`${e?.message || "Couldn't log it."} Log it with + Pitch below.`));
  };

  // one row of the Contact card: label on the left, the value (a field) on the right
  const rowS = (first?: boolean): any => ({ display: "flex", alignItems: "center", gap: 8, minHeight: 34, padding: "0 6px 0 12px", borderTop: first ? "none" : `1px solid ${C.hair}` });
  const lbl = (t: string) => <span style={{ ...CAPS, width: 76, flexShrink: 0, paddingTop: 2 }}>{t}</span>;
  const text = (label: string, key: keyof OutreachContact, ph: string, extra: any = {}, first = false) => (
    <div className="lh-cfrow" style={rowS(first)}>
      {lbl(label)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <MiniInput bare data-k={key} enterKeyHint="next" value={(f as any)[key] || ""} placeholder={ph} aria-label={label}
          onChange={(e: any) => setF({ ...f, [key]: e.target.value })} onKeyDown={onEnter} {...extra} />
      </div>
    </div>
  );
  const foot: any = { flex: 1, height: 38, justifyContent: "center", fontSize: TYPE.row.size };

  return (
    <>
      {askDelete && <ConfirmDialog title={`Delete ${c.company || c.email}?`} text="The contact is removed from your email list." okLabel="Delete" danger onOk={del} onCancel={() => setAskDelete(false)} />}
      {askDiscard && <ConfirmDialog title="Discard your changes?" text="What you typed isn't saved yet." okLabel="Discard" cancelLabel="Keep editing" onOk={() => { setAskDiscard(false); onClose(); }} onCancel={() => setAskDiscard(false)} />}
      <Sheet title={isNew ? "New contact" : c.company || c.email} onClose={close}
        right={isNew ? null : <MoreMenu bare items={[{ label: "Delete contact", danger: true, onClick: () => setAskDelete(true) }]} />}
        footer={isNew ? <PillBtn dark onClick={save} s={{ ...foot, opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Add contact"}</PillBtn>
          : changed ? <PillBtn dark onClick={save} s={{ ...foot, opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</PillBtn>
          : <PillBtn onClick={onClose} s={foot}>Done</PillBtn>}>
        {err && <p role="alert" style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 2px 8px" }}>{err}</p>}
        {dupId && onOpen && <B v="sec" onClick={() => onOpen(dupId)} s={{ marginBottom: 10 }}>Open that contact</B>}

        {/* ── status · last contact · (lead → client) · template + write ── */}
        {!isNew && !outreach.pitchError && (
          <div style={{ ...WCARD, padding: "8px 10px 10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
              <div><div style={{ ...CAPS, margin: "0 2px 4px" }}>Status</div>
                <MiniSelect value={c.status || "new"} aria-label="Status" onChange={(e: any) => outreach.setStatus(c.id, e.target.value).catch((x: any) => setErr(x?.message || "Couldn't save."))}>
                  {statusesFor(c.category).map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </MiniSelect>
              </div>
              <div><div style={{ ...CAPS, margin: "0 2px 4px" }}>Last contact</div>
                <div style={{ height: 32, display: "flex", alignItems: "center", padding: "0 2px", fontSize: TYPE.row.size, color: due ? PAL.waiting.ink : c.lastContact ? C.black : C.light, whiteSpace: "nowrap" as const, overflow: "hidden" }}>
                  {c.lastContact ? `${fmtD(c.lastContact)}${due ? ` · FU ${c.followStep === "fu2" ? 2 : 1} due` : ""}` : "—"}
                </div>
              </div>
            </div>
            {canMakeClient && (
              <PillBtn onClick={toClient} s={{ width: "100%", height: 32, marginTop: 8, justifyContent: "center", fontSize: TYPE.row.size, background: PAL.done.wash, border: `1px solid ${PAL.done.mid}`, color: PAL.done.ink, opacity: clientBusy ? 0.6 : 1 }}>
                {clientBusy ? "Creating…" : "Create client in Manager"}
              </PillBtn>
            )}
            {c.status === "client" && c.clientId && (
              <p style={{ fontSize: TYPE.label.size, color: PAL.done.ink, margin: "8px 2px 0", lineHeight: 1.4 }}>✓ Client in Manager — quote, contract and invoice happen there.</p>
            )}
            <div style={{ ...CAPS, margin: "10px 2px 4px" }}>Template · {tpl ? (accountOfTemplate(tpl) === "createbylynn" ? "@createbylynn" : "@lynnhoa") : accLabel}</div>
            {tpls.length > 0 ? (
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MiniSelect value={tplId} aria-label="Template" onChange={(e: any) => setTplId(e.target.value)}>
                    {tpls.map(t => <option key={t.id} value={t.id}>{t.name || "Untitled"}{t.kind === "follow_up" ? " · follow-up 1" : t.kind === "follow_up_2" ? " · follow-up 2" : ""}</option>)}
                  </MiniSelect>
                </div>
                <PillBtn dark onClick={write} title={tpl?.kind === "follow_up" ? "Write the follow-up in your mail app" : "Write the email in your mail app"}
                  s={{ height: 32, padding: "0 14px", flexShrink: 0, fontSize: TYPE.subtext.size }}>
                  <Ico d={MAIL} size={14} /><span aria-label={tpl?.kind === "follow_up" ? "Write follow-up" : "Write email"}>Write</span>
                </PillBtn>
              </div>
            ) : (
              <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 2px", lineHeight: 1.4 }}>{noTemplateText(c.category)}.</p>
            )}
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "6px 2px 0", lineHeight: 1.4 }}>
              {tpls.length > 0 && <>{tpl?.kind === "follow_up_2" ? "Logs follow-up 2" : tpl?.kind === "follow_up" ? "Logs follow-up 1" : willPitch ? "Logs the pitch and sets Pitched" : "Logs the pitch"} · </>}
              sent another way? <button onClick={() => log("pitch")} style={linkBtn}>+ Pitch</button> · <button onClick={() => log("follow_up")} style={linkBtn}>+ Follow-up</button>
            </p>
          </div>
        )}

        {/* ── the contact: tap a value to type ── */}
        {!isNew && <SecHead icon={USER} label="Contact" tone={PAL.neutral} />}
        <div data-cform="" style={{ ...WCARD, marginTop: isNew ? 2 : 0 }}>
          <div className="lh-cfrow" style={rowS(true)}>
            {lbl("Email")}
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniInput bare data-k="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="next"
                autoFocus={!!isNew} placeholder="name@brand.com" value={f.email} aria-label="Email"
                onChange={(e: any) => setF({ ...f, email: e.target.value })} onBlur={fillFromEmail} onKeyDown={onEnter} />
            </div>
            {!isNew && (
              <button onClick={() => onCopy(c.email)} aria-label="Copy email" title="Copy email"
                style={{ width: 30, height: 30, background: "none", border: "none", cursor: "copy", color: C.light, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
                <Ico d={IC.copy} size={14} />
              </button>
            )}
          </div>
          {text("Company", "company", "Brand name")}
          {text("Contact", "contactName", "Add a name", { "aria-label": "Contact name" })}
          <div className="lh-cfrow" style={rowS()}>
            {lbl("Category")}
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniSelect bare value={isCategory(f.category) ? f.category : ""} muted={!isCategory(f.category)} aria-label="Category" onChange={(e: any) => setF({ ...f, category: e.target.value })}>
                {!isCategory(f.category) && <option value="" disabled>Pick a category</option>}
                {OUTREACH_CATEGORIES.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </MiniSelect>
            </div>
          </div>
          <div className="lh-cfrow" style={rowS()}>
            {lbl("Tier")}
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniSelect bare value={isTier(f.tier) ? f.tier : ""} muted={!isTier(f.tier)} aria-label="Tier" onChange={(e: any) => setF({ ...f, tier: e.target.value })}>
                <option value="">—</option>
                {OUTREACH_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </MiniSelect>
            </div>
          </div>
          <div style={{ ...rowS(), padding: 0, gap: 0 }}>
            <div className="lh-cfrow" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, minHeight: 34, padding: "0 6px 0 12px" }}>
              <span style={{ ...CAPS, width: 46, flexShrink: 0, paddingTop: 2 }}>City</span>
              <div style={{ flex: 1, minWidth: 0 }}><MiniInput bare data-k="city" enterKeyHint="next" value={f.city || ""} placeholder="—" aria-label="City" onChange={(e: any) => setF({ ...f, city: e.target.value })} onKeyDown={onEnter} /></div>
            </div>
            <div className="lh-cfrow" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, minHeight: 34, padding: "0 6px 0 10px", borderLeft: `1px solid ${C.hair}` }}>
              <span style={{ ...CAPS, width: 58, flexShrink: 0, paddingTop: 2 }}>Country</span>
              <div style={{ flex: 1, minWidth: 0 }}><MiniInput bare data-k="country" enterKeyHint="next" value={f.country || ""} placeholder="—" aria-label="Country" onChange={(e: any) => setF({ ...f, country: e.target.value })} onKeyDown={onEnter} /></div>
            </div>
          </div>
          {text("Web / IG", "web", "—", { inputMode: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, "aria-label": "Website or Instagram" })}
          {text("Notes", "notes", "Add a note", { enterKeyHint: "done" })}
        </div>
        {isNew && <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "6px 2px 0" }}>Only the email is needed.</p>}

        {/* ── timeline: pitches, follow-ups, status changes, replies ── */}
        {!isNew && !outreach.pitchError && (
          <>
            <SecHead icon={CLOCK} label={`Timeline · ${timeline.length}`} tone={PAL.progress} />
            <div style={WCARD}>
              {timeline.length === 0 ? <div style={{ ...rowS(true), fontSize: TYPE.subtext.size, color: C.light }}>Nothing sent yet.</div> : timeline.map((t, i) => (
                <div key={t.key} style={{ ...rowS(i === 0), fontSize: TYPE.row.size }}>
                  <span style={{ width: 80, flexShrink: 0 }}>{t.day ? fmtD(t.day) : ""}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{t.text}</span>
                  {/* ✕ on every line: always visible, the text is cut with "…" before it */}
                  <button onClick={() => (t.pitch ? deleteEntry(t.pitch) : t.event ? deleteLine(t.event) : undefined)} aria-label="Delete this entry" title="Delete this entry"
                    style={{ width: 30, height: 30, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
        {!isNew && (c.createdAt || c.source) && (
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "8px 2px 0", lineHeight: 1.5, overflowWrap: "anywhere" as const }}>
            {[c.createdAt ? `Added ${fmtD(c.createdAt.slice(0, 10))}` : "", c.source].filter(Boolean).join(" · ")}
          </p>
        )}
      </Sheet>
    </>
  );
}

// ── Log a pitch (or follow-up) for every contact in view ─────────
function LogWindow({ ids, followUp, outreach, isMobile, onClose, onDone }: { ids: string[]; followUp: boolean; outreach: any; isMobile: boolean; onClose: () => void; onDone: (n: number) => void }) {
  const [kind, setKind] = useState<"pitch" | "follow_up">(followUp ? "follow_up" : "pitch");
  const [date, setDate] = useState(ymdToday);
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = ids.length;
  const go = async () => {
    setErr(null);
    if (!date) { setErr("Pick the day it was sent."); return; }
    setBusy(true);
    try { await outreach.logPitches(ids, kind, date); onDone(n); }
    catch (e: any) { setErr(e?.message || "Couldn't log it."); }
    finally { setBusy(false); }
  };
  return (
    <Window title="Log pitch" isMobile={isMobile} onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <B v="sec" onClick={onClose}>Cancel</B>
          <B onClick={go} s={{ opacity: busy ? 0.5 : 1 }}>{busy ? "Logging…" : `Log ${n}`}</B>
        </div>
      }>
      {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>For the {n} {n === 1 ? "contact" : "contacts"} in view — one entry each in the pitch log. UGC contacts count for @createbylynn, all others for @lynnhoa.</p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        <div><Lbl>Type</Lbl>
          <S value={kind} onChange={(e: any) => setKind(e.target.value)}>
            <option value="pitch">Pitch</option>
            <option value="follow_up">Follow-up</option>
          </S>
        </div>
        <div><Lbl>Sent on</Lbl><I type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></div>
      </div>
      <p style={{ fontSize: 12, color: C.muted, margin: "10px 0 0", lineHeight: 1.5 }}>New → Pitched. Every other status stays as it is.</p>
    </Window>
  );
}
// today as yyyy-mm-dd in local time
function ymdToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
