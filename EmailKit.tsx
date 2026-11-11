// ─────────────────────────────────────────────────────────────
// EmailKit — Outreach › Email kit (tab next to Contacts). Copy only:
// nothing is sent from here. Two pages, picked in the bottom bar (centred,
// like Planner › Concept's): Kits · Templates (remembered on this device).
//   Kits
//     SALES DOCUMENTS · IN ORDER ……… Edit links
//       one card in the order of the sales process (Project plan):
//       1 · Pitching — Partnerships · Fashion (EN · DE), Partnerships ·
//       Beauty (EN · DE), Content for Brands · Beauty (EN);
//       2 · Lead to won — Feed Proposal (a Canva template: ↗ open only).
//       EN / DE = copy that link · ↗ = open it in Canva (the Feed Proposal: EN ↗ / DE ↗
//       open that version — it's never copied).
//     MEDIA KITS
//       the 4 kits as rows like the documents, in the rate-card colours
//       (Collab pink · Editorial butter · Hotels pistachio · UGC blue): EN · DE · ↗.
//     DE shows on the decks that have a German version, and on any other item
//     as soon as its German link is pasted in Edit links.
//   Templates ……… Sort · + Add
//     grouped by purpose (chips when there's more than one purpose);
//     each row: name · its kit (a deck or a media kit) · copy icon (copies
//     the text with that kit's link where {kit} is — only there; no {kit} = no
//     link, "· not in the text" in the row — a German template the DE link, else
//     the EN one). Tap a row = the template window (Language: English / German).
// Windows (one level, the app's sheet): Edit links (every document and kit:
// EN link, DE link, PDF, Canva file, focus) and a template.
// PDF per kit: uploaded / replaced / deleted in Edit links (saved right
// away); Share = the phone's share sheet to attach it (computer: the
// file opens). A small dot on a row's icon = this kit has a PDF.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, TRACK, SPACING, CARD_TONE } from "./constants";
import { fmtD } from "./formatters";
import { I, S, MenuSelect, MiniInput, MiniArea, Lbl, PillBtn, SummaryLine, Strong, SectionHead, ListCard, Row, Chip, ChipRow, TonedTag, Sheet, SheetHead, SheetRow, SheetAction, SheetMeta, SheetErr, SheetButton, MoreMenu, MoveBtn, useDraft, sameDraft, SHEET_CARD, SHEET_CAPS, ROW_ICON, ConfirmDialog, ColGroups } from "./atoms";
import type { ToneSet } from "./atoms";
import { copyText, OUTREACH_CATEGORIES, catOf } from "./outreach";
import { showNote } from "./undo";
import { BottomNav, NAV_SPACE } from "./BottomNav";
import type { NavItem } from "./BottomNav";
import { MEDIA_KITS, SALES_DOCS, SALES_STEPS, TEMPLATE_KITS, KIT_TOKEN, kitInfo, kitLink, fillText, usesKit, fmtSize, TEMPLATE_PIPELINES, TEMPLATE_KINDS, TEMPLATE_CHANNELS, TEMPLATE_LANGS, kindLabel } from "./useEmailKit";
import type { EmailKitHook, EmailTemplate, KitKey, MediaKit, KitDef, TemplateLang } from "./useEmailKit";

const Ico = ({ d, size = 14, color = "currentColor" }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
const DECK = "M4 5h16v11H4zM12 16v4M8 20h8";   // a screen on a stand: a pitch deck
const IC: Record<string, string> = {
  copy:       "M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  link:       "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  influencer: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  editorial:  "M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  hotels:     "M5 20V4h10v16M15 9h4v11M8 8h4M8 12h4M8 16h4M3 20h18",
  ugc:        "M4 7h11v10H4zM15 10l5-3v10l-5-3",
  pitch_fashion: DECK, pitch_beauty: DECK, pitch_content: DECK,
  proposal:   "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 13h6M9 17h6",
  share:      "M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7",
  open:       "M10.5 6.5H8a2.5 2.5 0 0 0-2.5 2.5v7A2.5 2.5 0 0 0 8 18.5h7a2.5 2.5 0 0 0 2.5-2.5v-2.5M13.5 5.5h5v5M18.5 5.5l-7 7",
  file:       "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 13h6M9 17h6",
  mail:       "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6",
  folder:     "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
};
// the documents' colours: Fashion pink · Beauty rose · Content for Brands blue · Proposal pistachio;
// the media kits keep their rate-card colours
const ROSE: ToneSet = { fill: "#F6D3DD", wash: "#FBEBEF", mid: "#E7A9BB", ink: "#8C3F57" };
const DOC_TONE: Record<string, ToneSet> = { pitch_fashion: PAL.late, pitch_beauty: ROSE, pitch_content: PAL.progress, proposal: PAL.done };
const toneOf = (k: KitKey): ToneSet => DOC_TONE[k] || PAL[CARD_TONE[k] || "neutral"];
const STEP_TONE: Record<number, ToneSet> = { 1: PAL.waiting, 2: PAL.done };
const NO_PURPOSE = "Other";

// the two pages of the bottom bar
type KitPage = "kits" | "templates";
const PAGE_KEY = "lh_emailkit_page";
const PAGES: NavItem[] = [
  { key: "kits",      label: "Kits",      title: "Kits and sales documents", icon: IC.folder, tone: PAL.createbylynn },
  { key: "templates", label: "Templates", title: "Email templates",          icon: IC.mail,   tone: PAL.progress },
];

const caps: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted };
const linkBtn: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, textDecoration: "underline", textUnderlineOffset: 2, WebkitTapHighlightColor: "transparent",
};
const TA = (p: any) => (
  <textarea {...p} style={{ width: "100%", minHeight: 180, padding: "9px 10px", border: `1px solid ${C.field}`, borderRadius: RADIUS.field, background: C.white,
    fontFamily: SANS, fontSize: TYPE.field.size, lineHeight: 1.45, color: C.black, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, WebkitAppearance: "none" as const }} />
);

// "Hotel, Restaurant" · "Any category" — the categories a template is for
const catsText = (t: EmailTemplate) => (t.categories || []).length ? (t.categories || []).map(k => catOf(k).label).join(", ") : "Any category";
// the round copy button on a row (its own tap: doesn't open the row)
const CopyBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label}
    style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${C.edge}`, background: C.white, color: C.ink2, display: "inline-flex",
      alignItems: "center", justifyContent: "center", cursor: "copy", padding: 0, WebkitTapHighlightColor: "transparent" }}>
    <Ico d={IC.copy} size={14} />
  </button>
);

// a kit as a small chip (template window: the kit choice)
const KitChip = ({ k, on, onClick }: { k: KitKey | null; on: boolean; onClick: () => void }) => {
  const t = k ? toneOf(k) : PAL.neutral;
  return <Chip on={on} tone={t} label={k ? kitInfo(k)!.label : "None"} dot={!!k} onClick={onClick} />;
};

// a sales step: a thin band in its colour (1 · PITCHING  Pitch · Manager · mail or DM)
const StepBand = ({ step, first }: { step: 1 | 2; first: boolean }) => {
  const st = SALES_STEPS.find(x => x.step === step)!, t = STEP_TONE[step];
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "7px 12px 5px", background: t.wash, borderTop: first ? "none" : `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 10, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" as const, color: t.ink }}>{st.label}</span>
      <span style={{ fontSize: TYPE.micro.size, color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{st.who}</span>
    </div>
  );
};
type Lang = "EN" | "DE";
// does this item show a DE button: a German version exists, or its German link is in
const hasDe = (d: KitDef, k: MediaKit | undefined) => !!d.de || !!k?.urlDe?.trim();
// EN / DE: copy that link (dashed while it has none) — on the Feed Proposal: open that version
const LangPill = ({ lang, has, tone, label, open, onClick }: { lang: Lang; has: boolean; tone: ToneSet; label: string; open?: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label={label} title={has ? label : "No link yet"}
    style={{ height: 30, minWidth: 38, padding: "0 8px", borderRadius: RADIUS.pill, border: `1px ${has ? "solid" : "dashed"} ${tone.mid}`, background: has ? tone.wash : C.white,
      color: tone.ink, fontFamily: SANS, fontSize: TYPE.subtext.size, fontWeight: 600, cursor: open ? "pointer" : "copy", WebkitTapHighlightColor: "transparent",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3 }}>{lang}{open && <Ico d={IC.open} size={11} />}</button>
);
// one document or media kit: icon · name · its line · EN / DE (copy) · ↗ (open in Canva).
// The Feed Proposal (open only): ↗ — or EN / DE that open, once it has a German link.
function KitRow({ d, k, first, onCopy, onOpen }: { d: KitDef; k: MediaKit | undefined; first?: boolean; onCopy: (lang: Lang) => void; onOpen: (lang: Lang) => void }) {
  const t = toneOf(d.key);
  const de = hasDe(d, k);
  const meta = [k?.focus || d.focus, d.account === "@lynnhoa" ? "@lynnhoa" : ""].filter(Boolean).join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "8px 10px 8px 12px", borderTop: first ? "none" : `1px solid ${C.hair}` }}>
      <span style={{ position: "relative" as const, width: 32, height: 32, borderRadius: "50%", background: t.wash, color: t.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Ico d={IC[d.key]} size={16} />
        {k?.pdf && <span aria-label="Has a PDF" title="Has a PDF" style={{ position: "absolute" as const, top: 1, right: 1, width: 6, height: 6, borderRadius: "50%", background: t.mid, border: `1.5px solid ${C.white}` }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: SPACING.listText, fontWeight: 500, lineHeight: 1.3 }}>{d.label}</span>
        <span style={{ display: "block", fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.35, marginTop: 1 }}>{meta}</span>
      </span>
      <span style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        {d.open && de
          ? <>
              <LangPill open lang="EN" has={!!k?.url} tone={t} label={`Open the ${d.label} EN in Canva`} onClick={() => onOpen("EN")} />
              <LangPill open lang="DE" has={!!k?.urlDe} tone={t} label={`Open the ${d.label} DE in Canva`} onClick={() => onOpen("DE")} />
            </>
          : <>
              {!d.open && <LangPill lang="EN" has={!!k?.url} tone={t} label={`Copy the ${d.short} EN link`} onClick={() => onCopy("EN")} />}
              {!d.open && de && <LangPill lang="DE" has={!!k?.urlDe} tone={t} label={`Copy the ${d.short} DE link`} onClick={() => onCopy("DE")} />}
              <OpenBtn has={!!k?.url} tone={t} label={`Open ${d.label} in Canva`} onClick={() => onOpen("EN")} />
            </>}
      </span>
    </div>
  );
}
const OpenBtn = ({ has, tone, label, onClick }: { has: boolean; tone: ToneSet; label: string; onClick: () => void }) => (
        <button type="button" onClick={onClick} aria-label={label} title="Open in Canva"
          style={{ width: 30, height: 30, borderRadius: "50%", border: `1px ${has ? "solid" : "dashed"} ${has ? C.edge : tone.mid}`, background: C.white, color: C.ink2,
            display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>
          <Ico d={IC.open} size={14} />
        </button>
);

interface EmailKitProps { kit: EmailKitHook; isMobile: boolean; }

export default function EmailKit({ kit, isMobile }: EmailKitProps) {
  const { kits, templates, loading, loadError } = kit;
  const [page, setPage] = useState<KitPage>(() => { try { return localStorage.getItem(PAGE_KEY) === "templates" ? "templates" : "kits"; } catch { return "kits"; } });
  const pickPage = (p: string) => {
    const v: KitPage = p === "templates" ? "templates" : "kits";
    setPage(v); try { localStorage.setItem(PAGE_KEY, v); } catch { /* ignore */ }
    window.scrollTo?.({ top: 0 });
  };
  const [editLinks, setEditLinks] = useState(false);
  const [openId, setOpenId]       = useState<string | null>(null);
  const [adding, setAdding]       = useState(false);
  const [purpose, setPurpose]     = useState<string>("all");

  const kitOf = (k: KitKey) => kits.find(x => x.key === k);
  // the link of a template's language (German: the DE link, else the EN one)
  const linkOf = (k: KitKey | null, lang: TemplateLang = "en") => kitLink(kits, k, lang);
  const copy = async (text: string, msg: string) => { const ok = await copyText(text); showNote(ok ? msg : "Couldn't copy"); };
  const nameOf = (k: KitKey, lang: Lang) => { const d = kitInfo(k)!; return hasDe(d, kitOf(k)) ? `${d.short} ${lang}` : d.short; };
  const urlIn = (k: KitKey, lang: Lang) => String((lang === "DE" ? kitOf(k)?.urlDe : kitOf(k)?.url) || "").trim();
  const copyKit = (k: KitKey, lang: Lang = "EN") => {
    const url = urlIn(k, lang), name = nameOf(k, lang);
    if (!url) { showNote(`Add the ${name} link first · Edit links`); return; }
    copy(url, `${name} link copied ✓`);
  };
  const openKit = (k: KitKey, lang: Lang = "EN") => {
    const url = urlIn(k, lang);
    if (!/^https?:\/\//i.test(url)) { showNote(`Add the ${nameOf(k, lang)} link first · Edit links`); return; }
    window.open(url, "_blank", "noopener");
  };
  const sharePdf = (k: KitKey) => {
    kit.sharePdf(k).then(r => { if (r === "shared") showNote("PDF shared ✓"); }).catch((e: any) => showNote(e?.message || "The PDF couldn't be opened."));
  };
  const copyTemplate = (t: EmailTemplate, k: KitKey | null) => {
    const needs = usesKit({ kit: k, body: t.body });              // the link only goes where {kit} is
    const url = needs ? linkOf(k, t.lang) : "";
    if (needs && !url) { showNote(`Add the ${kitInfo(k)!.short} EN link first · Edit links`); return; }
    if (!t.body.trim()) { showNote("This template has no text yet"); return; }
    const enInstead = needs && t.lang === "de" && !kitOf(k!)?.urlDe?.trim();   // a German text, no German link yet
    copy(fillText(t.body, needs ? url : null), enInstead ? "Text copied ✓ · with the EN link (no DE link yet)" : "Text copied ✓");
  };

  const purposes = useMemo(() => Array.from(new Set(templates.map(t => t.purpose.trim() || NO_PURPOSE))).sort((a, b) => a.localeCompare(b, "de")), [templates]);
  useEffect(() => { if (purpose !== "all" && !purposes.includes(purpose)) setPurpose("all"); }, [purposes, purpose]);
  const shownPurposes = purpose === "all" ? purposes : [purpose];
  const current = templates.find(t => t.id === openId);
  // Sort: ↑ ↓ move a template one place; the new order is saved right away
  const [sorting, setSorting] = useState(false);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= templates.length) return;
    const ids = templates.map(t => t.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    kit.saveOrder(ids).catch((e: any) => showNote(e?.message || "Couldn't save the order."));
  };
  // "Kit: Brand collab" — and "· not in the text" when the text has no {kit} (then no link goes in)
  const kitName = (t: EmailTemplate) => t.kit && kitInfo(t.kit)
    ? <><span style={{ color: toneOf(t.kit).ink }}>{kitInfo(t.kit)!.label}</span>{!usesKit(t) && <span style={{ color: C.amber }}> · not in the text</span>}</>
    : "none";

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Email kit</h2>
      <SummaryLine dot={PAL.neutral.mid}>
        {page === "kits"
          ? <span><Strong>{SALES_DOCS.length}</Strong> sales documents · <Strong>{MEDIA_KITS.length}</Strong> media kits</span>
          : <span><Strong>{templates.length}</Strong> {templates.length === 1 ? "template" : "templates"} · copy only</span>}
      </SummaryLine>

      {loadError && <p role="alert" style={{ fontSize: TYPE.subtext.size, color: C.red, margin: "12px 0 0" }}>{loadError}</p>}

      {!loadError && page === "kits" && (
        <>
          {/* ── SALES DOCUMENTS: in the order of the sales process ── */}
          <SectionHead dot={PAL.waiting.mid} label="Sales documents · in order" right={<button onClick={() => setEditLinks(true)} style={linkBtn}>Edit links</button>} />
          <ListCard s={{ marginTop: 0 }}>
            {SALES_STEPS.map((st, si) => (
              <div key={st.step}>
                <StepBand step={st.step} first={si === 0} />
                {SALES_DOCS.filter(d => d.step === st.step).map(d => (
                  <KitRow key={d.key} d={d} k={kitOf(d.key)} onCopy={lang => copyKit(d.key, lang)} onOpen={lang => openKit(d.key, lang)} />
                ))}
              </div>
            ))}
          </ListCard>

          {/* ── MEDIA KITS: rows like the documents · EN / DE copy, ↗ opens ── */}
          <SectionHead label="Media kits" />
          <ListCard s={{ marginTop: 0 }}>
            {MEDIA_KITS.map((d, i) => (
              <KitRow key={d.key} first={i === 0} d={d} k={kitOf(d.key)} onCopy={lang => copyKit(d.key, lang)} onOpen={lang => openKit(d.key, lang)} />
            ))}
          </ListCard>
        </>
      )}

      {!loadError && page === "templates" && (
        <>
          {/* ── EMAIL TEMPLATES ── */}
          <SectionHead label="Email templates" right={sorting
            ? <button onClick={() => setSorting(false)} style={linkBtn}>Done</button>
            : <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
                {templates.length > 1 && <button onClick={() => setSorting(true)} style={linkBtn}>Sort</button>}
                <button onClick={() => setAdding(true)} style={{ ...linkBtn, textDecoration: "none" }}>+ Add</button>
              </span>} />
          {loading ? null : sorting ? (
            <>
              {/* your own order: ↑ ↓ move a template, saved right away */}
              <ListCard s={{ marginTop: 0 }}>
                {templates.map((t, i) => (
                  <Row key={t.id} first={i === 0} chevron={false}
                    title={t.name || "Untitled"}
                    meta={<>{t.pipeline === "ugc" ? "UGC" : "@lynnhoa"}{t.lang === "de" ? " · DE" : ""} · {kindLabel(t.kind)} · Kit: {kitName(t)}</>}
                    right={<span style={{ display: "inline-flex", gap: 6 }}>
                      <MoveBtn dir="up" label={`Move ${t.name || "this template"} up`} off={i === 0} onClick={() => move(i, -1)} />
                      <MoveBtn dir="down" label={`Move ${t.name || "this template"} down`} off={i === templates.length - 1} onClick={() => move(i, 1)} />
                    </span>} />
                ))}
              </ListCard>
              <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "6px 2px 0" }}>This order is also used in each contact's template list.</p>
            </>
          ) : templates.length === 0 ? (
            <ListCard s={{ padding: "18px 14px", textAlign: "center" as const }}>
              <div style={{ fontSize: SPACING.listText }}>Add your first template</div>
              <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>Each template gets a purpose and a kit: a pitch deck or a media kit.</div>
            </ListCard>
          ) : (
            <>
              {purposes.length > 1 && (
                <ChipRow s={{ marginBottom: 2 }}>
                  <Chip on={purpose === "all"} tone={PAL.neutral} dot={false} label="All" count={templates.length} onClick={() => setPurpose("all")} />
                  {purposes.map(p => <Chip key={p} on={purpose === p} tone={PAL.neutral} dot={false} label={p} count={templates.filter(t => (t.purpose.trim() || NO_PURPOSE) === p).length} onClick={() => setPurpose(p)} />)}
                </ChipRow>
              )}
              {/* iPad / computer: the purposes side by side (phone: one under the other) */}
              <ColGroups groups={shownPurposes.map(p => {
                const list = templates.filter(t => (t.purpose.trim() || NO_PURPOSE) === p);   // in your own order (Sort)
                return { key: p, size: list.length, node: (
                  <div>
                    {purposes.length > 1 && <SectionHead label={p} />}
                    <ListCard s={purposes.length > 1 ? undefined : { marginTop: 0 }}>
                      {list.map((t, i) => (
                        <Row key={t.id} first={i === 0} chevron={false} onClick={() => setOpenId(t.id)}
                          title={t.name || "Untitled"}
                          meta={<>{t.pipeline === "ugc" ? "UGC" : "@lynnhoa"}{t.lang === "de" ? " · DE" : ""}{t.channel === "dm" ? " · DM" : ""} · {kindLabel(t.kind)} · {catsText(t)} · Kit: {kitName(t)}</>}
                          right={<CopyBtn label={`Copy ${t.name || "the text"}`} onClick={() => copyTemplate(t, t.kit)} />} />
                      ))}
                    </ListCard>
                  </div>
                ) };
              })} />
            </>
          )}
        </>
      )}

      {/* the two pages: Kits · Templates (centred, like the Planner's bar) */}
      <div style={{ height: NAV_SPACE }} />
      <BottomNav label="Email kit" items={PAGES} value={page} onPick={pickPage} />

      {editLinks && <LinksWindow kit={kit} onShare={sharePdf} onClose={() => setEditLinks(false)} />}
      {/* one window: after Add template the same window becomes the saved template (no close + reopen blink) */}
      {(current || adding) && (
        <TemplateWindow key="template" isNew={!current} t={current || { id: "", name: "", purpose: purpose !== "all" && purpose !== NO_PURPOSE ? purpose : "", subject: "", body: "", kit: null, createdAt: "", pipeline: "lynnhoa", kind: "pitch", categories: [], sortOrder: null, channel: "email", lang: "en" }}
          kit={kit} purposes={purposes} linkOf={linkOf} onCopy={copyTemplate} onShare={sharePdf} onCopySubject={(s) => copy(s, "Subject copied ✓")}
          onClose={() => { setOpenId(null); setAdding(false); }} onCreated={(id) => { setAdding(false); setOpenId(id); }} />
      )}
    </div>
  );
}

// ── Edit links: every document and kit in one window — one level, the fields are the view (like Contact) ──
// Sales documents (in order), then Media kits. Each: its section head (colour · name · account) and a card:
// EN link (↗ opens it) · DE link (every item; empty until there's a German version) · PDF (Share, ⋯ Replace / Delete — or Upload PDF; saved right
// away) · File · Focus; "Link updated …" under it. The Feed Proposal is a Canva template: its edit link
// (the manager makes a copy per brand), no PDF.
// Footer: Done → Save as soon as you type (the window stays open); ✕ with unsaved typing asks first.
const typedKits = (list: MediaKit[]) => list.map(k => `${k.key}|${k.url.trim()}|${k.urlDe.trim()}|${k.file.trim()}|${k.focus.trim()}`).join("\n");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "");
// a link field: shows the link without https://www. — the whole link while you type
function LinkInput({ value, onChange, label, placeholder = "Paste the view link" }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  const [foc, setFoc] = useState(false);
  return (
    <MiniInput bare type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label={label} placeholder={placeholder}
      value={foc ? value : shortUrl(value)} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} onChange={(e: any) => onChange(e.target.value)} />
  );
}
function LinksWindow({ kit, onShare, onClose }: { kit: EmailKitHook; onShare: (k: KitKey) => void; onClose: () => void }) {
  const kits = kit.kits;
  // what you type (link · file · focus): the shared draft — PDFs and dates always come from the stored kits
  const dr = useDraft<MediaKit[]>(kits, { same: (a, b) => typedKits(a) === typedKits(b) });
  const f = dr.d;
  const [err, setErr]         = useState<string | null>(null);
  const [badKey, setBadKey]   = useState<KitKey | null>(null);           // the kit whose link (or DE link) isn't a link
  const [badDe, setBadDe]     = useState(false);                         // … and whether it's the DE link
  const [busy, setBusy]       = useState(false);
  const [busyKey, setBusyKey] = useState<KitKey | null>(null);           // a PDF being uploaded / deleted
  const [askDel, setAskDel]   = useState<KitKey | null>(null);
  useEffect(() => { kit.preloadPdfs(); }, [kit.kits]);                    // ready for Share in the same tap
  useEffect(() => { if (badKey) document.getElementById(`kit-err-${badKey}`)?.scrollIntoView?.({ block: "center", behavior: "smooth" }); }, [badKey]);
  const set = (key: KitKey, patch: Partial<MediaKit>) => { dr.setD(p => p.map(k => (k.key === key ? { ...k, ...patch } : k))); if (key === badKey) setBadKey(null); };
  const save = async () => {
    if (busy) return;
    setErr(null);
    const notLink = (u: string) => !!u.trim() && !/^https?:\/\//i.test(u.trim());
    const bad = f.find(k => notLink(k.url) || notLink(k.urlDe));
    if (bad) { setBadDe(!notLink(bad.url)); setBadKey(bad.key); return; }
    setBusy(true); dr.saving();
    try { await kit.saveKits(f); showNote("Saved ✓"); }
    catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const upload = (key: KitKey) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/pdf,.pdf";
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      setErr(null); setBusyKey(key);
      kit.uploadPdf(key, file).then(() => showNote("PDF saved ✓")).catch((e: any) => setErr(e?.message || "The PDF couldn't be saved.")).finally(() => setBusyKey(null));
    };
    inp.click();
  };
  const removePdf = (key: KitKey) => {
    setAskDel(null); setErr(null); setBusyKey(key);
    kit.deletePdf(key).then(() => showNote("PDF deleted")).catch((e: any) => setErr(e?.message || "Couldn't delete.")).finally(() => setBusyKey(null));
  };
  const pill: any = { height: 28, padding: "0 11px" };

  return (
    <>
      {askDel && <ConfirmDialog title={`Delete the ${kitInfo(askDel)!.short} PDF?`} text="The PDF is removed from this media kit. The Canva link stays." okLabel="Delete" danger onOk={() => removePdf(askDel)} onCancel={() => setAskDel(null)} />}
      <Sheet title="Edit links" onClose={onClose} dirty={dr.changed}
        footer={dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton> : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}
        <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "0 2px 6px", lineHeight: 1.4 }}>Use Canva's view-only link (Share → Public view link), never the edit link — only the Feed Proposal keeps its edit link.</p>
        {f.map((k, i) => {
          const d = kitInfo(k.key)!;
          const group = i === 0 || kitInfo(f[i - 1].key)?.kind !== d.kind ? (d.kind === "doc" ? "Sales documents · in order" : "Media kits") : "";
          const urlDe = k.urlDe.trim();
          const st = kits.find(x => x.key === k.key);
          const p = st?.pdf ?? null;
          const url = k.url.trim();
          const meta = [st?.url && st.updatedAt ? `Link updated ${fmtD(st.updatedAt.slice(0, 10))}` : "", p && p.updatedAt ? `PDF ${fmtD(p.updatedAt.slice(0, 10))}` : ""].filter(Boolean).join(" · ");
          return (
            <div key={k.key}>
              {group && <div style={{ ...SHEET_CAPS, margin: i === 0 ? "4px 2px 0" : "22px 2px 0", color: C.ink2, fontWeight: 600 }}>{group}</div>}
              <SheetHead first={i === 0 && !group} icon={<Ico d={IC[k.key]} size={11} />} label={d.label} tone={toneOf(k.key)}
                right={<TonedTag tone={d.account === "@lynnhoa" ? PAL.lynnhoa : PAL.neutral}>{d.account}</TonedTag>} />
              <div style={SHEET_CARD}>
                <SheetRow first label={d.open ? "Edit link" : "EN link"}
                  right={/^https?:\/\//i.test(url) ? <button onClick={() => window.open(url, "_blank", "noopener")} aria-label={`Open the ${d.label} EN link`} title="Open the link" style={ROW_ICON}><Ico d={IC.open} size={14} /></button> : null}>
                  <LinkInput value={k.url} onChange={v => set(k.key, { url: v })} label={`${d.label} ${d.open ? "edit" : "EN"} link`} placeholder={d.open ? "Paste the edit link" : "Paste the view link"} />
                </SheetRow>
                {/* every item has room for its German version; empty = no DE button (the decks with a German version show it dashed) */}
                <SheetRow label={d.open ? "DE edit link" : "DE link"}
                  right={/^https?:\/\//i.test(urlDe) ? <button onClick={() => window.open(urlDe, "_blank", "noopener")} aria-label={`Open the ${d.label} DE link`} title="Open the link" style={ROW_ICON}><Ico d={IC.open} size={14} /></button> : null}>
                  <LinkInput value={k.urlDe} onChange={v => set(k.key, { urlDe: v })} label={`${d.label} DE ${d.open ? "edit " : ""}link`}
                    placeholder={d.de ? (d.open ? "Paste the German edit link" : "Paste the German view link") : "German version · when there is one"} />
                </SheetRow>
                {!d.open && <SheetRow label="PDF"
                  right={busyKey === k.key ? null : p
                    ? <><PillBtn onClick={() => onShare(k.key)} s={pill}><Ico d={IC.share} size={13} />Share</PillBtn>
                        <MoreMenu size={30} items={[{ label: "Replace PDF", onClick: () => upload(k.key) }, { label: "Delete PDF", danger: true, onClick: () => setAskDel(k.key) }]} /></>
                    : <PillBtn dim={busyKey !== null} onClick={() => { if (busyKey === null) upload(k.key); }} s={pill}>Upload PDF</PillBtn>}>
                  <span style={{ display: "block", fontSize: SPACING.listText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {busyKey === k.key ? <span style={{ color: C.muted }}>Saving…</span>
                      : p ? <>{p.name} <span style={{ color: C.muted }}>· {fmtSize(p.size)}</span></> : <span style={{ color: C.light }}>No PDF yet</span>}
                  </span>
                </SheetRow>}
                <SheetRow label="File"><MiniInput bare value={k.file} placeholder="Canva file name" aria-label={`${d.label} Canva file`} onChange={(e: any) => set(k.key, { file: e.target.value })} /></SheetRow>
                <SheetRow label="Focus"><MiniInput bare value={k.focus} placeholder="What it's for" aria-label={`${d.label} focus`} onChange={(e: any) => set(k.key, { focus: e.target.value })} /></SheetRow>
              </div>
              {badKey === k.key && <div id={`kit-err-${k.key}`}><SheetMeta s={{ color: C.red }}>The {badDe ? "DE" : "EN"}{d.open ? " edit" : ""} link isn't a link yet — it must start with https:// ({d.open ? "Canva → Share → Copy link" : "Canva → Share → Public view link"}).</SheetMeta></div>}
              {meta && <SheetMeta>{meta}</SheetMeta>}
            </div>
          );
        })}
      </Sheet>
    </>
  );
}

// ── one template — one level, the fields are the view (like Contact) ──
// Top card: the kit, a deck or a media kit (saved at once) · Share PDF · Copy text. Template card: Name · Purpose · For ·
// Type · Channel · Language (English / German: which link goes in) · (Kit, new only) · Categories. Text card: Subject (copy) · the text. ⋯ Delete.
// Footer: Done → Save as soon as you type (stays open) · a new template: Add template (opens as itself).
// the template's fields you type (the kit is picked in the top card and saved at once — a new template types it too)
const tplTyped = (x: EmailTemplate, withKit: boolean) => ({ name: x.name, purpose: x.purpose, subject: x.subject, body: x.body, pipeline: x.pipeline, kind: x.kind,
  channel: x.channel, lang: x.lang, categories: [...(x.categories || [])].sort(), ...(withKit ? { kit: x.kit } : {}) });
function TemplateWindow({ t, kit, purposes, linkOf, onCopy, onShare, onCopySubject, onClose, onCreated, isNew }: {
  t: EmailTemplate; kit: EmailKitHook; purposes: string[]; linkOf: (k: KitKey | null, lang?: TemplateLang) => string;
  onCopy: (t: EmailTemplate, k: KitKey | null) => void; onShare: (k: KitKey) => void; onCopySubject: (s: string) => void;
  onClose: () => void; onCreated?: (id: string) => void; isNew?: boolean;
}) {
  // what you type: the shared draft (atoms) — a new template ignores updates from outside
  const dr = useDraft<EmailTemplate>(t, { frozen: !!isNew, same: (a, b) => sameDraft(tplTyped(a, !!isNew), tplTyped(b, !!isNew)) });
  const f = dr.d;
  const changed = dr.changed;
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { kit.preloadPdfs(); }, [kit.kits]);                    // ready for Share PDF in the same tap
  const pick = f.kit;
  const pickPdf = pick ? kit.kits.find(k => k.key === pick)?.pdf ?? null : null;
  const setPick = (k: KitKey | null) => {
    dr.setD(x => ({ ...x, kit: k }));
    if (!isNew) kit.updateTemplate(t.id, { kit: k }).catch((e: any) => setErr(e?.message || "Couldn't save."));
  };
  const save = async () => {
    if (busy) return;
    setErr(null);
    if (!f.name.trim()) { setErr("Please enter a name."); return; }
    setBusy(true);
    try {
      if (isNew) { dr.saving(); const n = await kit.addTemplate(f); onCreated?.(n.id); return; }   // the same window becomes the template: take what's stored
      dr.saving();
      await kit.updateTemplate(t.id, f); showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async () => {
    setAskDelete(false);
    try { await kit.deleteTemplate(t.id); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const sel = (key: keyof EmailTemplate) => (e: any) => { const v = e.target.value; dr.setD(x => ({ ...x, [key]: v } as EmailTemplate)); };
  const accT = f.pipeline === "ugc" ? PAL.createbylynn : PAL.lynnhoa;
  // "Hotel and Restaurant": the categories whose contacts only get the templates made for them (Setup)
  const own = OUTREACH_CATEGORIES.filter(c => c.ownTemplates).map(c => c.label);
  const ownNames = own.length > 1 ? `${own.slice(0, -1).join(", ")} and ${own[own.length - 1]}` : own[0] || "";
  return (
    <>
      {askDelete && <ConfirmDialog title={`Delete ${t.name || "this template"}?`} text="The template is removed from your Email kit." okLabel="Delete" danger onOk={del} onCancel={() => setAskDelete(false)} />}
      <Sheet title={isNew ? "New template" : t.purpose || "Template"} onClose={onClose} dirty={changed}
        right={isNew ? null : <MoreMenu items={[{ label: "Delete template", danger: true, onClick: () => setAskDelete(true) }]} />}
        footer={isNew ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Add template"}</SheetButton>
          : changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
          : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}

        {/* ── the media kit · Copy text ── */}
        {!isNew && (
          <SheetAction>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px 6px" }}>
              <span style={SHEET_CAPS}>Kit · deck or media kit</span>
              {pickPdf && <button onClick={() => onShare(pick!)} style={{ ...linkBtn, display: "inline-flex", alignItems: "center", gap: 4 }}><Ico d={IC.share} size={12} />Share PDF</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {TEMPLATE_KITS.map(d => <KitChip key={d.key} k={d.key} on={pick === d.key} onClick={() => setPick(d.key)} />)}
              <KitChip k={null} on={pick === null} onClick={() => setPick(null)} />
            </div>
            {/* the link only goes where {kit} is in the text */}
            {pick && !f.body.includes(KIT_TOKEN) && (
              <p style={{ fontSize: SPACING.listMeta, color: C.amber, margin: "6px 2px 0", lineHeight: 1.4 }}>
                {KIT_TOKEN} isn't in the text, so no link goes in the email.{" "}
                <button onClick={() => dr.setD(x => ({ ...x, body: `${x.body.replace(/\s+$/, "")}\n\n${KIT_TOKEN}` }))} style={{ ...linkBtn, fontSize: SPACING.listMeta }}>Add {KIT_TOKEN} at the end</button>
              </p>
            )}
            {pick && f.body.includes(KIT_TOKEN) && !linkOf(pick, f.lang) && <p style={{ fontSize: SPACING.listMeta, color: C.amber, margin: "6px 2px 0" }}>No {kitInfo(pick)!.short} EN link yet · add it in Edit links.</p>}
            {pick && f.body.includes(KIT_TOKEN) && f.lang === "de" && !!linkOf(pick, "en") && !kit.kits.find(k => k.key === pick)?.urlDe?.trim() && <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "6px 2px 0" }}>No {kitInfo(pick)!.short} DE link yet · the EN link goes in.</p>}
            <PillBtn dark onClick={() => onCopy(f, pick)} s={{ width: "100%", height: 32, marginTop: 8, justifyContent: "center", fontSize: TYPE.subtext.size }}><Ico d={IC.copy} size={14} />Copy text</PillBtn>
          </SheetAction>
        )}

        {/* ── the template ── */}
        {!isNew && <SheetHead icon={<Ico d={IC.file} size={11} />} label="Template" tone={PAL.neutral} />}
        <div style={{ ...SHEET_CARD, marginTop: isNew ? 2 : 0 }}>
          <SheetRow first label="Name"><MiniInput bare value={f.name} autoFocus={!!isNew} placeholder="First pitch · brand" aria-label="Name" onChange={sel("name")} /></SheetRow>
          <SheetRow label="Purpose"><MiniInput bare value={f.purpose} list="lh-email-purposes" placeholder="Pitch" aria-label="Purpose" onChange={sel("purpose")} /></SheetRow>
          <SheetRow label="For">
            <MenuSelect bare value={f.pipeline || "lynnhoa"} aria-label="For" onChange={sel("pipeline")}>
              {TEMPLATE_PIPELINES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Type">
            <MenuSelect bare value={f.kind || "pitch"} aria-label="Type" onChange={sel("kind")}>
              {TEMPLATE_KINDS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Channel">
            <MenuSelect bare value={f.channel || "email"} aria-label="Channel" onChange={sel("channel")}>
              {TEMPLATE_CHANNELS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Language">
            <MenuSelect bare value={f.lang || "en"} aria-label="Language" onChange={sel("lang")}>
              {TEMPLATE_LANGS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          {isNew && (
            <SheetRow label="Media kit">
              <MenuSelect bare value={f.kit || ""} aria-label="Media kit" onChange={(e: any) => { const v = (e.target.value || null) as KitKey | null; dr.setD(x => ({ ...x, kit: v })); }}>
                <option value="">None</option>
                {TEMPLATE_KITS.map(d => <option key={d.key} value={d.key}>{d.kind === "doc" ? `${d.label} (deck)` : d.label}</option>)}
              </MenuSelect>
            </SheetRow>
          )}
          <SheetRow label="Categories" top>
            <div role="group" aria-label="Categories" style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, padding: "6px 0" }}>
              {OUTREACH_CATEGORIES.map(k => {
                const on = (f.categories || []).includes(k.key);
                return <Chip key={k.key} on={on} tone={PAL.neutral} dot={false} label={k.label}
                  onClick={() => dr.setD(x => ({ ...x, categories: (x.categories || []).includes(k.key) ? (x.categories || []).filter(y => y !== k.key) : [...(x.categories || []), k.key] }))} />;
              })}
            </div>
          </SheetRow>
        </div>
        <datalist id="lh-email-purposes">{purposes.filter(p => p !== NO_PURPOSE).map(p => <option key={p} value={p} />)}</datalist>
        <SheetMeta>None picked = any category.{ownNames ? ` ${ownNames} contacts only get the templates made for them (Setup).` : ""}</SheetMeta>

        {/* ── the text ── */}
        <SheetHead icon={<Ico d={IC.mail} size={11} />} label="Text" tone={accT} />
        <div style={SHEET_CARD}>
          {f.channel !== "dm" && (
            <SheetRow first label="Subject"
              right={!isNew && f.subject.trim() ? <button onClick={() => onCopySubject(f.subject.trim())} aria-label="Copy the subject" title="Copy the subject" style={ROW_ICON}><Ico d={IC.copy} size={14} /></button> : null}>
              <MiniInput bare value={f.subject} placeholder="Collaboration idea · {company}" aria-label="Subject" onChange={sel("subject")} />
            </SheetRow>
          )}
          <div style={{ borderTop: f.channel !== "dm" ? `1px solid ${C.hair}` : "none" }}>
            <MiniArea value={f.body} ariaLabel="Text" minRows={6} onChange={(v) => dr.setD(x => ({ ...x, body: v }))}
              placeholder={f.channel === "dm" ? "Hi {name}! … 2–4 short lines …\n\nMy media kit: {kit}" : "Hi {name},\n\n…\n\nMy media kit: {kit}\n\nBest, Lynn"} />
          </div>
        </div>
        <SheetMeta>
          {f.channel === "dm" ? <>A DM is copied and Instagram opens the chat — paste and send. Keep it to 2–4 lines.<br /></> : null}
          Filled in for each contact when you write from Contacts: {"{name}"} first name (no name: “Company team”) · {"{company}"} company · {KIT_TOKEN} the kit's link, exactly where you put it (no {KIT_TOKEN} = no link)
        </SheetMeta>
      </Sheet>
    </>
  );
}
