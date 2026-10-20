// ─────────────────────────────────────────────────────────────
// EmailList — Outreach › Email list (the same parts as the other apps' list screens)
// Title · Import (light) · Log pitch (dark)
// Summary line: ● n contacts · to follow up · Copy emails
// Toolbar (38 px): Search · Filter (category, tier, city, added) · Sort · Download
// Active filters as chips (✕) · the contacts in one white card
// Phone: two lines per contact · iPad/desktop: one-line table in a card
// Windows (one level): Filter (sheet on phone), contact, Import (the three steps)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, Z, PAL, RADIUS, SHADOW } from "./constants";
import { fmtD } from "./formatters";
import { B, I, S, Lbl, ConfirmDialog, BAR_BTN, SummaryLine, Strong, PillBtn, ListCard } from "./atoms";
import {
  OUTREACH_CATEGORIES, OUTREACH_TIERS, OUTREACH_COLUMNS, OUTREACH_STATUSES, STATUS_FILTERS, PITCH_ACCOUNTS, SORTS, ADDED, DEFAULT_VIEW,
  catOf, tierOf, statusOf, followUpDue, applyView, activeFilters, emailsText, copyText, headerRow, buildPrompt,
} from "./outreach";
import type { Pitch, PitchAccount } from "./outreach";
import { loadWorkAccount } from "./planner";
import type { OutreachContact, OutreachView, SortKey } from "./outreach";
import { downloadExcel, downloadTemplate, downloadListPdf } from "./outreachExport";

// ── small line icons (no icon library needed) ─────────────────
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
const loadView = (): OutreachView => { try { return { ...DEFAULT_VIEW, ...JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}") }; } catch { return DEFAULT_VIEW; } };

const CatPill = ({ k }: { k: string }) => {
  const c = catOf(k);
  return <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.03em", padding: "2px 8px", borderRadius: RADIUS.tag, border: `1px solid ${c.border}`, background: c.bg, color: c.color, whiteSpace: "nowrap" as const }}>{c.label}</span>;
};

interface EmailListProps {
  outreach:  any;          // useOutreach()
  settings:  any;
  isMobile:  boolean;
  isWide:    boolean;      // ≥ 1200 px
  stickyTop: number;       // height of the app header (table header sticks below it)
}

// Where a contact stands (Stage 2 tracking): Pitched 12.10. · Follow up · Replied · Gifted · Deal ✓
const shortD = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const StatusText = ({ c }: { c: OutreachContact }) => {
  if (!c.status || c.status === "new") return null;
  const due = followUpDue(c);
  const color = due ? C.amber : c.status === "gifted" || c.status === "deal" ? C.green : c.status === "replied" ? C.black : C.muted;
  const text = due ? "Follow up" : c.status === "pitched" ? `Pitched${c.lastContact ? " " + shortD(c.lastContact) : ""}` : c.status === "deal" ? "Deal ✓" : statusOf(c.status).label;
  return <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{text}</span>;
};
// Logging defaults to the account you're working on (profile menu, same as the Planner)
const lastAccount = (): PitchAccount => loadWorkAccount();

export default function EmailList({ outreach, settings, isMobile, isWide, stickyTop }: EmailListProps) {
  const { contacts, loading, loadError, loginEmail } = outreach;
  const [view, setView]       = useState<OutreachView>(loadView);
  const [open, setOpen]       = useState<null | "filter" | "sort" | "download">(null);
  const [showCols, setShowCols] = useState(false);
  const [openId, setOpenId]   = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => { try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* ignore */ } }, [view]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);

  const shown  = useMemo(() => applyView(contacts, view), [contacts, view]);
  const cities = useMemo(() => Array.from(new Set(contacts.map((c: OutreachContact) => (c.city || "").trim()).filter(Boolean))).sort((a: any, b: any) => a.localeCompare(b, "de")) as string[], [contacts]);
  const counts = useMemo(() => { const m: Record<string, number> = {}; contacts.forEach((c: OutreachContact) => { m[c.category] = (m[c.category] || 0) + 1; }); return m; }, [contacts]);
  const nFilters = activeFilters(view);
  const filtered = nFilters > 0 || !!view.q.trim();
  const nDue = useMemo(() => contacts.filter((c: OutreachContact) => followUpDue(c)).length, [contacts]);   // pitched, no answer, due again
  const brand = (settings?.company || settings?.name || "LH Studio").trim();
  const set = (patch: Partial<OutreachView>) => setView(v => ({ ...v, ...patch }));

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
      style={{ height: 38, minWidth: 38, padding: isMobile ? 0 : "0 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${active ? C.pillOn : C.field}`, background: active ? PAL.neutral.fill : C.white, color: C.black, borderRadius: RADIUS.tile, cursor: "pointer", position: "relative", flexShrink: 0, fontFamily: SANS, fontSize: TYPE.subtext.size, whiteSpace: "nowrap" as const, boxSizing: "border-box" as const }}>
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
        <button onClick={() => set({ cat: "all", tier: "all", status: "all", city: "all", added: "any" })} style={{ background: "none", border: "none", color: C.muted, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>Reset</button>
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
          <S value={view.tier} onChange={(e: any) => set({ tier: e.target.value })}>
            <option value="all">All</option>
            {OUTREACH_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </S>
        </div>
        <div><Lbl>Status</Lbl>
          <S value={view.status || "all"} onChange={(e: any) => set({ status: e.target.value })}>
            {STATUS_FILTERS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
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
      <div style={{ flex: isMobile ? 1 : "0 1 340px", minWidth: 0, height: 38, border: `1px solid ${C.field}`, borderRadius: RADIUS.tile, background: C.white, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", boxSizing: "border-box" as const, color: C.light }}>
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
            {(filtered ? (["filtered", "full"] as const) : (["full"] as const)).map((w, i) => (
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
  const tags = (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 10 }}>
      {view.cat !== "all" && <button onClick={() => set({ cat: "all" })} style={tagStyle(catOf(view.cat))}>{catOf(view.cat).label} ✕</button>}
      {view.tier !== "all" && <button onClick={() => set({ tier: "all" })} style={tagStyle()}>{tierOf(view.tier).label} ✕</button>}
      {view.status && view.status !== "all" && <button onClick={() => set({ status: "all" })} style={tagStyle()}>{STATUS_FILTERS.find(x => x.key === view.status)?.label} ✕</button>}
      {view.city !== "all" && <button onClick={() => set({ city: "all" })} style={tagStyle()}>{view.city} ✕</button>}
      {view.added !== "any" && <button onClick={() => set({ added: "any" })} style={tagStyle()}>{ADDED.find(a => a.key === view.added)?.label} ✕</button>}
      <button onClick={() => setOpen("sort")} style={{ ...tagStyle(), background: C.white, borderColor: C.rule, color: C.ink2 }}>{SORTS.find(s => s.key === view.sort)?.short}</button>
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
            <span style={{ fontSize: TYPE.row.size, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.company || c.email}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {c.tier && c.tier !== "now" && <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted }}>{tierOf(c.tier).label}</span>}
              <CatPill k={c.category} />
            </span>
          </div>
          <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {c.contactName && <span style={{ flexShrink: 0 }}>{c.contactName} ·</span>}
            {emailCell(c, true)}
            <span style={{ flex: 1 }} />
            <StatusText c={c} />
          </div>
        </div>
      ))}
    </ListCard>
  );

  const cols: { key: string; label: string; fr: string; sort?: SortKey[] }[] = [
    { key: "company", label: "Company", fr: "1.3fr", sort: ["az", "za"] },
    { key: "contactName", label: "Contact", fr: "1fr" },
    { key: "email", label: "Email", fr: "1.8fr" },
    { key: "category", label: "Category", fr: "0.9fr", sort: ["cat"] },
    { key: "tier", label: "Tier", fr: "0.6fr" },
    { key: "status", label: "Status", fr: "0.9fr" },
    { key: "city", label: "City", fr: "0.9fr" },
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
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: cols.map(c => `minmax(0,${c.fr})`).join(" "), background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, padding: "0 4px 4px" }}>
      {cols.map(c => (
        <div key={c.key} onClick={() => headClick(c)} style={{ position: "sticky", top: stickyTop, background: C.white, zIndex: 2, padding: "0 10px", height: 34, display: "flex", alignItems: "center", fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted, cursor: c.sort ? "pointer" : "default", userSelect: "none" as const, borderRadius: 0 }}>{c.label}{arrow(c)}</div>
      ))}
      {shown.map((c: OutreachContact) => (
        <div key={c.id} className="lh-row" onClick={() => setOpenId(c.id)} style={{ display: "contents", cursor: "pointer" }}>
          <div style={td}>{cut(c.company)}</div>
          <div style={{ ...td, color: c.contactName ? C.black : C.light }}>{cut(c.contactName || "—")}</div>
          <div style={td}>{emailCell(c)}</div>
          <div style={td}><CatPill k={c.category} /></div>
          <div style={{ ...td, color: c.tier && c.tier !== "now" ? C.black : C.muted }}>{cut(tierOf(c.tier).label)}</div>
          <div style={td}>{c.status && c.status !== "new" ? <StatusText c={c} /> : <span style={{ color: C.light }}>—</span>}</div>
          <div style={td}>{cut(c.city)}</div>
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
      <style>{`.lh-row:hover > div { background: rgba(0,0,0,0.025); } .lh-row:hover .lh-copy-ico, .lh-copy-email:focus .lh-copy-ico { opacity: 1 !important; }`}</style>

      {/* ── HEADER: title · Import · Log pitch ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" as const }}>Email list</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <PillBtn onClick={() => setShowCols(true)}>Import</PillBtn>
          {shown.length > 0 && !outreach.pitchError && <PillBtn dark onClick={() => setShowLog(true)} title="Log a pitch for the contacts in view">Log pitch</PillBtn>}
        </div>
      </div>
      <SummaryLine dot={nDue ? PAL.waiting.mid : PAL.neutral.mid}>
        <span style={{ whiteSpace: "nowrap" as const }}>{filtered ? `${shown.length} of ${contacts.length}` : contacts.length} {contacts.length === 1 ? "contact" : "contacts"}</span>
        {nDue > 0 && <> · <Strong color={PAL.waiting.ink}>{nDue} to follow up</Strong></>}
        {shown.length > 0 && <> · <button onClick={() => copy(emailsText(shown), `${shown.length} ${shown.length === 1 ? "email" : "emails"} copied ✓`)} aria-label="Copy the emails in view" title="Copy the emails in view"
          style={{ background: "none", border: "none", padding: "4px 0", margin: "-4px 0", cursor: "pointer", color: C.black, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: SANS, fontSize: TYPE.subtext.size }}>Copy emails <Ico d={IC.copy} size={12} color={C.muted} /></button></>}
      </SummaryLine>

      <div style={{ marginTop: 12 }}>{toolbar}</div>
      {tags}

      {/* ── CONTENT ── */}
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : contacts.length === 0 ? (
        <ListCard s={{ marginTop: 12, padding: "14px 14px 16px" }}>
          <p style={{ fontFamily: SERIF, fontSize: 15, color: C.black, margin: "0 0 6px" }}>No contacts yet</p>
          <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0, lineHeight: 1.6 }}>Tap <strong style={{ fontWeight: 500, color: C.black }}>Import</strong>: build your Excel with the columns, copy the prompt for Claude, run Claude's SQL in Supabase.</p>
        </ListCard>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>No contacts match. <button onClick={() => set({ q: "", cat: "all", tier: "all", status: "all", city: "all", added: "any" })} style={{ background: "none", border: "none", padding: 0, color: C.black, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>Clear search and filters</button></p>
      ) : isMobile ? phoneList : table}

      {/* click outside closes a menu */}
      {open && !(open === "filter" && isMobile) && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: Z.menu - 1 }} />}

      {/* ── FILTER SHEET (phone) ── */}
      {open === "filter" && isMobile && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: Z.modal }}>
          <div onClick={() => setOpen(null)} style={{ position: "absolute", inset: 0, background: "rgba(26,26,26,0.25)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: C.bg, borderTop: `1px solid ${C.rule}`, padding: "12px 14px calc(16px + env(safe-area-inset-bottom))", fontFamily: SANS }}>{filterBody}</div>
        </div>, document.body)}

      {/* ── CONTACT WINDOW ── */}
      {current && <ContactWindow c={current} outreach={outreach} isMobile={isMobile} onClose={() => setOpenId(null)} onCopy={(t) => copy(t, "Email copied ✓")} />}

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

      {toast && createPortal(
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: Z.toast, background: C.black, color: C.white, fontFamily: SANS, fontSize: 12, padding: "9px 14px", borderRadius: RADIUS.field, maxWidth: "calc(100vw - 32px)", boxShadow: SHADOW.pop }}>{toast}</div>,
        document.body)}
    </div>
  );
}

// ── One-level window: full screen on the phone, centred elsewhere ─
function Window({ title, isMobile, onClose, children, footer }: { title: string; isMobile: boolean; onClose: () => void; children: any; footer?: any }) {
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

// ── Contact: read view, Edit → Save returns to the read view ─────
function ContactWindow({ c, outreach, isMobile, onClose, onCopy }: { c: OutreachContact; outreach: any; isMobile: boolean; onClose: () => void; onCopy: (t: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(c);
  const [err, setErr] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { if (!edit) setF(c); }, [c, edit]);
  // pitch log for this contact (newest first); the account defaults to the last one used for them
  const mine: Pitch[] = (outreach.pitches || []).filter((p: Pitch) => p.contactId === c.id).sort((a: Pitch, b: Pitch) => b.sentOn.localeCompare(a.sentOn));
  const [acc, setAcc] = useState<PitchAccount>(() => mine[0]?.account || lastAccount());
  const log = async (kind: "pitch" | "follow_up") => {
    setErr(null);
    try { await outreach.logPitches([c.id], acc, kind); }
    catch (e: any) { setErr(e?.message || "Couldn't log it."); }
  };

  const save = async () => {
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setErr("Please enter a valid email."); return; }
    try { await outreach.updateContact(c.id, f); setEdit(false); }
    catch (e: any) { setErr(e?.message || "Couldn't save."); }
  };
  const del = async () => {
    setAskDelete(false);
    try { await outreach.deleteContact(c.id); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const row = (label: string, value: any) => (
    <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.rule}`, fontSize: 13 }}>
      <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted, paddingTop: 2 }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" as const }}>{value || <span style={{ color: C.light }}>—</span>}</span>
    </div>
  );
  const field = (label: string, key: keyof OutreachContact, type = "text") => (
    <div><Lbl>{label}</Lbl><I type={type} value={(f as any)[key]} onChange={(e: any) => setF({ ...f, [key]: e.target.value })} /></div>
  );

  return (
    <>
      {askDelete && <ConfirmDialog title={`Delete ${c.company || c.email}?`} text="The contact is removed from your email list." okLabel="Delete" danger onOk={del} onCancel={() => setAskDelete(false)} />}
      <Window title={c.company || c.email} isMobile={isMobile} onClose={onClose}
        footer={edit ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <B v="sec" onClick={() => { setEdit(false); setErr(null); }}>Cancel</B>
            <B onClick={save}>Save</B>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <B v="danger" onClick={() => setAskDelete(true)}>Delete</B>
            <div style={{ display: "flex", gap: 8 }}>
              <B v="sec" onClick={() => onCopy(c.email)}>Copy email</B>
              <B onClick={() => setEdit(true)}>Edit</B>
            </div>
          </div>
        )}>
        {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
        {!edit && !outreach.pitchError && (
          <div style={{ marginBottom: 6 }}>
            <Lbl>Status</Lbl>
            <S value={c.status || "new"} onChange={(e: any) => outreach.setStatus(c.id, e.target.value).catch((x: any) => setErr(x?.message || "Couldn't save."))}>
              {OUTREACH_STATUSES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </S>
            {followUpDue(c) && <p style={{ fontSize: 12, color: C.amber, margin: "6px 0 0" }}>No reply since {fmtD(c.lastContact!)} — time to follow up.</p>}
            <Lbl>Log</Lbl>
            <div style={{ display: "flex", gap: 6 }}>
              <S value={acc} onChange={(e: any) => setAcc(e.target.value)} s={{ flex: 1, minWidth: 0 }} aria-label="Account">
                {PITCH_ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </S>
              <B v="sec" onClick={() => log("pitch")} s={{ ...BAR_BTN, flexShrink: 0, color: C.black }}>+ Pitch</B>
              <B v="sec" onClick={() => log("follow_up")} s={{ ...BAR_BTN, flexShrink: 0, color: C.black }}>+ Follow-up</B>
            </div>
          </div>
        )}
        {!edit ? (
          <>
            {row("Company", c.company)}
            {row("Email", c.email)}
            {row("Contact", c.contactName)}
            {row("Category", <CatPill k={c.category} />)}
            {row("Tier", tierOf(c.tier).label)}
            {row("Website / IG", c.web)}
            {row("City", c.city)}
            {row("Notes", c.notes)}
            {row("Added", c.createdAt ? fmtD(c.createdAt.slice(0, 10)) : "")}
            {row("Source", c.source)}
            {!outreach.pitchError && (
              <>
                <Lbl>Pitch log · {mine.length}</Lbl>
                {mine.length === 0 ? <p style={{ fontSize: 12, color: C.light, margin: 0 }}>Nothing sent yet.</p> : (
                  <div style={{ borderTop: `1px solid ${C.rule}` }}>
                    {mine.map((p: Pitch) => (
                      <div key={p.id} style={{ minHeight: 36, display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.rule}`, fontSize: 13 }}>
                        <span style={{ width: 86, flexShrink: 0 }}>{fmtD(p.sentOn)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{p.kind === "follow_up" ? "Follow-up" : "Pitch"} · <span style={{ color: C.muted }}>{p.account === "lynnhoa" ? "@lynnhoa" : "@createbylynn"}</span></span>
                        <button onClick={() => outreach.deletePitch(p).catch((x: any) => setErr(x?.message || "Couldn't delete."))} aria-label="Delete this entry" title="Delete this entry"
                          style={{ width: 32, height: 32, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {field("Company", "company")}
            {field("Email", "email", "email")}
            {field("Contact name", "contactName")}
            <div><Lbl>Category</Lbl>
              <S value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>
                {OUTREACH_CATEGORIES.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </S>
            </div>
            <div><Lbl>Tier</Lbl>
              <S value={f.tier || "now"} onChange={(e: any) => setF({ ...f, tier: e.target.value })}>
                {OUTREACH_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </S>
            </div>
            {field("Website / Instagram", "web")}
            {field("City", "city")}
            <div><Lbl>Notes</Lbl>
              <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
                style={{ width: "100%", minHeight: 72, padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: 16, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const }} />
            </div>
          </>
        )}
      </Window>
    </>
  );
}

// ── Log a pitch (or follow-up) for every contact in view ─────────
function LogWindow({ ids, followUp, outreach, isMobile, onClose, onDone }: { ids: string[]; followUp: boolean; outreach: any; isMobile: boolean; onClose: () => void; onDone: (n: number) => void }) {
  const [acc, setAcc]   = useState<PitchAccount>(lastAccount);
  const [kind, setKind] = useState<"pitch" | "follow_up">(followUp ? "follow_up" : "pitch");
  const [date, setDate] = useState(ymdToday);
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = ids.length;
  const go = async () => {
    setErr(null);
    if (!date) { setErr("Pick the day it was sent."); return; }
    setBusy(true);
    try { await outreach.logPitches(ids, acc, kind, date); onDone(n); }
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
      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>For the {n} {n === 1 ? "contact" : "contacts"} in view — one entry each in the pitch log.</p>
      <Lbl>Account</Lbl>
      <S value={acc} onChange={(e: any) => setAcc(e.target.value)}>
        {PITCH_ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
      </S>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        <div><Lbl>Type</Lbl>
          <S value={kind} onChange={(e: any) => setKind(e.target.value)}>
            <option value="pitch">Pitch</option>
            <option value="follow_up">Follow-up</option>
          </S>
        </div>
        <div><Lbl>Sent on</Lbl><I type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></div>
      </div>
      <p style={{ fontSize: 12, color: C.muted, margin: "10px 0 0", lineHeight: 1.5 }}>Not contacted yet → Pitched. Replied, gifted and deals stay as they are.</p>
    </Window>
  );
}
// today as yyyy-mm-dd in local time
function ymdToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
