// ─────────────────────────────────────────────────────────────
// PlannerConcept — Planner › Content concept, opened from the
// profile menu ("@lynnhoa concept" / "@createbylynn concept").
//   Top (07.11.2026): "Content concept" with two round buttons right — Guide (butter book) and
//   Arcs (blue arc, its count) — then the account chip (avatar · @name · ⇄, tap: the other
//   account) and the grey line that says what the open tab is.
//   Bottom bar (like Lynn's Office): Eras · Daily · Home · Travel · Work, a floating white pill —
//   each tab its own pastel (rose · sand · apricot · aqua · plum, planner.ts TAB_TONE), the open
//   one filled; a tab's chapters take its colour. The page opens on what you had last
//   (remembered on this device). The toast sits above the bar.
//   Every card works the same: number · name · (pill) · (open: its small links) · arrow. Open:
//   what it is in grey, then its lists — each under one heading (small grey caps with its count
//   and a small arrow: tap it to fold or unfold the list; what you fold stays folded on this
//   device), one row per item. Open cards are remembered on this device; "expand all" on the heading.
//   Chapters (Personal Eras · Home · Travel · Work, planner.ts): open, the arcs in posting order —
//   the arc's number (blue) · name · what it does here · its formats here. A pill top right:
//   "Series" on Home's How I … chapters (the episode's title and hook in a peach box, inside The
//   Edit — or under the description when the chapter has no The Edit), "The Outing" where it runs.
//   Base: the 6 blocks of planner.ts, shown like the chapters, then the block's lines from the
//   data (found by name). "edit" opens one window to add, change, delete the lines (Undo).
//   Guide: the look-up page — Who I am · How I … · The Outing · How it all works (planner.ts,
//   GUIDE_*). How I … open: "edit" opens the episodes window — a Title and a Hook per chapter,
//   saved when you leave the field (table planner_concept_series; before its SQL the starting
//   ones show, read only).
//   Arcs (pastel blue): one card per arc. Open: its purpose and its formats with the TikTok /
//   Instagram ticks. "texts · links" open one window each — the texts and links live there
//   (add, change, delete with Undo, saved right away).
// @createbylynn (07.11.2026): the same page around one roof, "making beauty look wanted" — the
//   same top (Guide · Arcs) and the same bottom bar with its four tabs (planner.ts CBL_TABS):
//   Base (sand, your voice) · Looks (rose, each arc a Series) · Products (aqua: the Product run —
//   a Package band, its arcs in order with a "Run" pill — then Roundups) · Editorial (plum). A tab
//   shows its arcs as cards numbered 1, 2, 3 … in its colour (open: texts · links, purpose,
//   formats with the ticks). Guide: Who I am · Product run · Where does it go? The open tab is
//   remembered on this device; before the pillars SQL the page says to run it.
// Arcs, pillars, purpose, formats, ticks, phases and eras come from the SQL (fixed).
// Phone: one column · iPad / computer: two columns (first half left).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, createContext, useContext, Fragment } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, TRACK, SHADOW, PAL } from "./constants";
import { SectionHead, Sheet, SheetButton, OpenArrow, SheetRow, SheetErr, TextInline, TonedTag } from "./atoms";
import { PERSONAL_ERAS, MAIN_AREAS, BASE_BLOCKS, BASE_NOTE, ACCOUNTS, PLATFORM_TONE, platformTone, ARC_TONE, PHASE_TONE, isSeries, seriesWord, seriesNum, isBasePhase, splitBlockLine, isPillarArc, pillarLabel,
  GUIDE_TONE, SERIES_TONE, PACKAGE_TONE, FORMAT_TONE, GUIDE_WHO, GUIDE_LEVELS, GUIDE_LEVELS_NOTE, GUIDE_SERIES, GUIDE_PACKAGE, GUIDE_WORKFLOW, TAB_TONE, chapterTag, CBL_TABS, CBL_RUN, CBL_CHANGE, CBL_WHO, CBL_LEVELS, CBL_LEVELS_NOTE, CBL_WHERE, arcsOfTab, inProductRun } from "./planner";
import type { StructItem, ChapterArc, CblTabKey, Account, ConceptArc, ConceptFormat, ConceptPhase, ConceptEra, ConceptEpisode, ChapterTag, ConceptTabKey, GuideLevel } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { IC, WinHead, winCard, LineList, LinkList } from "./PlannerWindows";
import { BottomNav, NavIcon, NAV_SPACE } from "./BottomNav";
import type { NavItem } from "./BottomNav";

// remembered on this device: the tab, and the open arcs, phases and Base blocks per account
// (none the first time)
const VIEW_KEY    = "lh_planner_concept_view";        // Personal Eras | Base | Home | Travel | Work | Guide | Arcs
const OPEN_KEY    = "lh_planner_concept_open";
const VIEW_CBL_KEY = "lh_planner_concept_view_cbl";   // @createbylynn: its open pillar (or Arcs)
const OPEN_CH_KEY = "lh_planner_concept_open_chapters"; // a Main Area's open chapters ("home:After Trip")
const OPEN_GD_KEY = "lh_planner_concept_open_guide";  // the Guide's open cards ("who", "series" …)
const FOLD_KEY    = "lh_planner_concept_folded";      // the lists you folded inside cards (open unless folded)
type OpenMap  = Partial<Record<Account, number[]>>;
type OpenKeys = Partial<Record<Account, string[]>>;
type ConceptView = "eras" | "base" | "home" | "travel" | "work" | "guide" | "arcs";
const loadMap = (key: string): any => {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); if (v && typeof v === "object") return v; } catch { /* ignore */ }
  return {};
};
const saveMap = (key: string, m: object) => { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ } };
const loadView = (): ConceptView => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "phases") return "home";                 // the old Phases tab
    return v === "eras" || v === "base" || v === "home" || v === "travel" || v === "work" || v === "guide" ? v : "arcs";
  } catch { return "arcs"; }
};

const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

const NUM    = 24;              // the number circle of an arc, a phase or a block
const GAP    = 9;
const INDENT = NUM + GAP;       // what it is and its lists line up with the card's name
const COL    = 30;              // the TikTok and Instagram columns

const caps: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const };
// "texts · 6" · "links · 2" · "collapse all": small, underlined (like "history")
const mini: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.micro.size, lineHeight: 1, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2,
  whiteSpace: "nowrap" as const, WebkitTapHighlightColor: "transparent",
};
const count = (word: string, n: number) => (n ? `${word} · ${n}` : word);
type Tone = { fill: string; wash: string; mid: string; ink: string };

// grey text that says what something is: starts with a capital and ends with a full stop
// (a quote stays as typed) — the same on every card, however the SQL or the app saved it
const tidy = (t: string) => {
  const s = String(t || "").trim();
  if (!s) return "";
  const up = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?…"“”'’]$/.test(up) ? up : `${up}.`;
};

// a platform tick: soft fill, coloured outline and check · empty: light outline
const PlatformTick = ({ on, platform }: { on: boolean; platform: "TikTok" | "Instagram" }) => {
  const t = PLATFORM_TONE[platform];
  return (
    <span role="img" aria-label={`${platform}: ${on ? "yes" : "no"}`}
      style={{ width: 20, height: 20, borderRadius: RADIUS.check, boxSizing: "border-box" as const, border: `1.5px solid ${on ? t.mid : C.edge}`,
        background: on ? t.wash : C.white, color: t.ink, display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: TYPE.label.size, fontWeight: 500, lineHeight: 1 }}>
      {on ? "✓" : ""}
    </span>
  );
};

const FormatRow = ({ f }: { f: ConceptFormat }) => (
  <div style={{ display: "flex", alignItems: "center", minHeight: 34, borderTop: `1px solid ${C.hair}` }}>
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: f.main ? C.ink2 : C.faint, flexShrink: 0, marginRight: GAP }} />
    <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.listText, lineHeight: 1.3, padding: "7px 0", color: f.main ? C.black : C.ink2, fontWeight: f.main ? 500 : 400 }}>
      {f.name}
    </span>
    <span style={{ width: COL, display: "flex", justifyContent: "center", flexShrink: 0 }}><PlatformTick on={f.tt} platform="TikTok" /></span>
    <span style={{ width: COL, display: "flex", justifyContent: "center", flexShrink: 0 }}><PlatformTick on={f.ig} platform="Instagram" /></span>
  </div>
);

// the lists folded inside cards (remembered on this device, per account; open unless folded)
const FoldCtx = createContext<{ isOpen: (id: string) => boolean; toggle: (id: string) => void }>({ isOpen: () => true, toggle: () => { /* none */ } });

// a list inside a card under its heading: small grey caps with its count and the small arrow —
// tap the heading to fold or unfold the list. The line under the heading is its first row's.
// right = column labels (TT · IG), shown while it's open · head = the heading's own frame
// (in the arcs window: a line above it)
function FoldSection({ id, label, n, right, head, children }: { id: string; label: string; n?: number; right?: any; head?: any; children: any }) {
  const f = useContext(FoldCtx), open = f.isOpen(id), text = count(label, n || 0);
  return (
    <>
      <button type="button" onClick={() => f.toggle(id)} aria-expanded={open} aria-label={`${text}, ${open ? "fold" : "open"}`}
        style={{ display: "flex", alignItems: "center", width: "100%", minHeight: 22, padding: "4px 0", margin: "-4px 0", boxSizing: "content-box" as const,
          background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const, WebkitTapHighlightColor: "transparent", ...head }}>
        <span style={{ ...caps, flex: 1, minWidth: 0, color: C.light, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{text}</span>
          <OpenArrow open={open} />
        </span>
        {open && right}
      </button>
      {open && children}
    </>
  );
}

// one row inside a card: a light dot, the name in black and what it is in grey, in full ·
// right = something at the end (an era's arcs) · onClick = the row opens a window
const rowLine: any = { display: "flex", alignItems: "flex-start", gap: GAP, borderTop: `1px solid ${C.hair}`, padding: "8px 0" };
const ItemRow = ({ name, text, right, onClick, label }: { name: string; text?: string; right?: any; onClick?: () => void; label?: string }) => {
  const inner = (
    <>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.faint, flexShrink: 0, marginTop: 6 }} />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" as const }}>
        <span style={{ display: "block", fontSize: SPACING.listText, color: C.black, lineHeight: 1.35 }}>{name}</span>
        {text && <span style={{ display: "block", fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4, marginTop: 1 }}>{text}</span>}
      </span>
      {right}
    </>
  );
  if (!onClick) return <div style={rowLine}>{inner}</div>;
  return (
    <button onClick={onClick} aria-label={label}
      style={{ ...rowLine, width: "100%", minHeight: SPACING.row1, background: "none", border: "none", borderTop: rowLine.borderTop, cursor: "pointer",
        fontFamily: SANS, textAlign: "left" as const, color: C.black, WebkitTapHighlightColor: "transparent" }}>
      {inner}
    </button>
  );
};

// "Formats · 5 · TT · IG" and one row per format, folds (the arc card and the arcs window — the
// same arc folds in both)
const Formats = ({ formats, fold }: { formats: ConceptFormat[]; fold: string }) => (
  <FoldSection id={fold} label="Formats" n={formats.length} right={<>
    <span style={{ ...caps, width: COL, textAlign: "center" as const, color: PLATFORM_TONE.TikTok.ink }} title="TikTok">TT</span>
    <span style={{ ...caps, width: COL, textAlign: "center" as const, color: PLATFORM_TONE.Instagram.ink }} title="Instagram">IG</span>
  </>}>
    {formats.map((f, k) => <FormatRow key={k} f={f} />)}
  </FoldSection>
);

const NumCircle = ({ n, tone, size = NUM }: { n: number; tone: Tone; size?: number }) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", background: tone.wash, color: tone.ink,
    fontSize: size < NUM ? TYPE.micro.size : TYPE.subtext.size, fontWeight: 500, letterSpacing: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
);

const cardBox: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, overflow: "hidden" };
const headBtn: any = {
  flex: 1, minWidth: 0, minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: GAP, padding: `0 8px 0 ${SPACING.rowSide}px`,
  background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const, color: C.black, WebkitTapHighlightColor: "transparent",
};
const nameText: any = { flex: 1, minWidth: 0, fontSize: SPACING.plannerText, fontWeight: 500, lineHeight: 1.3, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" };
// an open card: what it is (grey) and its lists, lined up with the card's name
const cardBody: any = { padding: `0 6px 8px ${SPACING.rowSide}px` };
const descText: any = { margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 };
const listBox: any  = { margin: `8px 0 0 ${INDENT}px` };
const Caret = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
  <span aria-hidden="true" onClick={onClick}
    style={{ width: COL, minHeight: SPACING.row1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
    <OpenArrow open={open} />
  </span>
);

// one arc: number · name · (open: texts · links) · arrow — open: purpose and formats
// n · tone: a pillar's arcs are numbered 1, 2, 3 … in the pillar's colour (the Arcs page: their number, blue)
// pill: "Series" (Looks) · "Run" (the Product run's arcs), top right like a chapter's pill
function ArcCard({ arc, open, onToggle, onOpen, n = arc.num, tone = ARC_TONE, pill }: { arc: ConceptArc; open: boolean; onToggle: () => void; onOpen: (kind: "texts" | "links") => void; n?: number; tone?: Tone; pill?: { label: string; tone: Tone } }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${arc.name}`} style={headBtn}>
          <NumCircle n={n} tone={tone} />
          <span style={nameText}>{arc.name}</span>
          {pill && <TonedTag tone={pill.tone} s={{ flexShrink: 0 }}>{pill.label}</TonedTag>}
        </button>
        {open && (
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={() => onOpen("texts")} aria-label={`Texts of ${arc.name}`} style={mini}>{count("texts", arc.texts.length)}</button>
            <button onClick={() => onOpen("links")} aria-label={`Links of ${arc.name}`} style={mini}>{count("links", arc.links.length)}</button>
          </span>
        )}
        <Caret open={open} onClick={onToggle} />
      </div>
      {open && (
        <div style={cardBody}>
          {arc.purpose && <div style={descText}>{tidy(arc.purpose)}</div>}
          <div style={listBox}><Formats formats={arc.formats} fold={`arc:${arc.id}:formats`} /></div>
        </div>
      )}
    </div>
  );
}

// the five tabs of the bottom bar: name · icon (a line icon, in the tab's colour)
const TABS: { key: ConceptTabKey; label: string; title: string; icon: string }[] = [
  { key: "eras",   label: "Eras",   title: "Personal Eras", icon: "M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" },
  { key: "base",   label: "Daily",  title: "Daily",         icon: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4" },
  { key: "home",   label: "Home",   title: "Home",          icon: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" },
  { key: "travel", label: "Travel", title: "Travel",        icon: "M3 11l18-7-7 18-2.5-7.5z" },
  { key: "work",   label: "Work",   title: "Brand Work",    icon: "M4 8h16v11H4zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16" },
];
const TAB_ITEMS: NavItem[] = TABS.map(t => ({ ...t, tone: TAB_TONE[t.key] }));
// @createbylynn: its four tabs in the same bar (planner.ts CBL_TABS)
const CBL_ICON: Record<CblTabKey, string> = {
  base:      "M5 5h14v10H10l-5 4z",                                   // a speech bubble: your voice
  looks:     "M9 21h6M10 21v-9h4v9M10.5 12l.5-6 3-2v8",               // a lipstick
  products:  "M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3zM8 13h8",   // a bottle
  editorial: "M4 8h3l2-2h6l2 2h3v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",   // a camera
};
const CBL_ITEMS: NavItem[] = CBL_TABS.map(t => ({ key: t.key, label: t.label, title: t.label, icon: CBL_ICON[t.key], tone: t.tone }));
const ICON_GUIDE = "M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5v13";   // an open book
const ICON_ARCS  = "M4 18a8 8 0 0 1 16 0M12 18h.01";
const LineIcon = NavIcon;

// Guide · Arcs: two round buttons next to the title, in their colours (filled while they show)
const RoundBtn = ({ on, label, icon, tone, n, onClick }: { on: boolean; label: string; icon: string; tone: Tone; n?: number; onClick: () => void }) => (
  <button type="button" aria-label={n ? `${label} · ${n}` : label} aria-pressed={on} onClick={() => { if (!on) onClick(); }}
    style={{ position: "relative" as const, width: 38, height: 38, flexShrink: 0, borderRadius: "50%", border: `1px solid ${on ? tone.ink : tone.mid}`,
      background: on ? tone.fill : tone.wash, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
      cursor: on ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }}>
    <LineIcon d={icon} size={17} color={tone.ink} />
    {!!n && (
      <span style={{ position: "absolute" as const, top: -3, right: -3, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, boxSizing: "border-box" as const,
        background: C.white, border: `1px solid ${tone.mid}`, color: tone.ink, fontFamily: SANS, fontSize: 10, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
    )}
  </button>
);
// the account: one chip (avatar · @name · ⇄) — tap: the other account
const AccChip = ({ acc, onAccount }: { acc: Account; onAccount?: (a: Account) => void }) => {
  const a = ACCOUNTS.find(x => x.key === acc) || ACCOUNTS[0], other = ACCOUNTS.find(x => x.key !== acc);
  return (
    <button type="button" aria-label={`Account ${a.label}${other ? `, switch to ${other.label}` : ""}`}
      onClick={() => {
        if (!other || !onAccount) return;
        const el = document.activeElement as HTMLElement | null;   // a field being typed in is saved first
        if (el && el !== document.body && typeof el.blur === "function") el.blur();
        onAccount(other.key);
      }}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 8px 0 3px", borderRadius: 13, border: `1px solid ${a.border}`,
        background: a.bg, color: a.color, fontFamily: SANS, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" as const, flexShrink: 0,
        cursor: onAccount ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>
      <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", background: a.color, color: C.white, fontSize: 8, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{acc === "createbylynn" ? "CB" : "LH"}</span>
      {a.label}
      <LineIcon d="M7 8h11l-3-3M17 16H6l3 3" size={12} color={a.color} />
    </button>
  );
};
// "edit": a small underlined link on a card's head row, while it's open (Base lines · How I … episodes)
const EditLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} aria-label={label} style={{ ...mini, flexShrink: 0 }}>edit</button>
);
// one How I … episode: the title, the hook right below it in quotes — the Guide card and the
// chapter's box show the same one
const Episode = ({ ep }: { ep: ConceptEpisode }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: SPACING.listText, color: C.black, lineHeight: 1.3 }}>{ep.title}</div>
    {ep.hook && <div style={{ fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.35, marginTop: 1 }}>“{ep.hook}”</div>}
  </div>
);
const EpisodeBox = ({ ep }: { ep: ConceptEpisode }) => (
  <div style={{ background: SERIES_TONE.wash, borderRadius: RADIUS.field, padding: "7px 10px", margin: "6px 0 2px" }}><Episode ep={ep} /></div>
);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface PlannerConceptProps {
  planner:   PlannerHook;
  view:      PlannerView;
  isMobile:  boolean;
  onAccount?: (a: Account) => void;
}

type Win = { kind: "texts" | "links"; id: string } | { kind: "block"; id: string; era: string } | { kind: "episodes" };

// what each tab is (the line under the title)
const SUBTITLE: Record<ConceptView, string> = {
  eras:   "The image you're developing",
  base:   BASE_NOTE,
  home:   "What's happening at home",
  travel: "What's happening on the road",
  work:   "What's happening with brands",
  guide:  "What I stand for and how it works",
  arcs:   "How each post is told",
};

// a placeholder (a chapter or era without arcs): number · name · "empty" — what belongs there in grey
const PlaceholderCard = ({ n, item, tone }: { n: number; item: StructItem; tone: Tone }) => (
  <div style={cardBox}>
    <div style={{ ...headBtn, cursor: "default", paddingRight: SPACING.rowSide }}>
      <NumCircle n={n} tone={tone} />
      <span style={nameText}>{item.name}</span>
      <span style={{ fontSize: TYPE.micro.size, color: C.muted, border: `1px dashed ${C.rule}`, borderRadius: 9, padding: "2px 7px", lineHeight: 1.2, flexShrink: 0 }}>empty</span>
    </div>
    <div style={{ ...descText, margin: `-8px ${SPACING.rowSide}px 0 ${SPACING.rowSide + NUM + GAP}px`, paddingBottom: 10 }}>{tidy(item.desc)}</div>
  </div>
);

// a chapter with its selected arcs (Home): number · name · arrow, what it is in grey — open: its
// arcs in posting order, each: the arc's number (blue) · its name · what it does here (grey) ·
// the formats used for it here
const ChapterCard = ({ n, item, arcs, open, onToggle, tone = PHASE_TONE, onEdit, extra, tag, episode }: { n: number; item: StructItem; arcs: ConceptArc[]; open: boolean; onToggle: () => void; tone?: Tone; onEdit?: () => void; extra?: any; tag?: ChapterTag; episode?: ConceptEpisode }) => {
  const editRow = (item.arcs || []).some(x => sameName(x.arc, "The Edit"));
  return (
  <div style={cardBox}>
    <div style={{ display: "flex", alignItems: "center" }}>
      <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${item.name}`} style={headBtn}>
        <NumCircle n={n} tone={tone} />
        <span style={nameText}>{item.name}</span>
        {tag === "series" && <TonedTag tone={SERIES_TONE} s={{ flexShrink: 0 }}>Series</TonedTag>}
        {tag === "outing" && <TonedTag tone={PACKAGE_TONE} s={{ flexShrink: 0 }}>{GUIDE_PACKAGE.name}</TonedTag>}
      </button>
      {open && onEdit && <EditLink label={`Edit the lines of ${item.name}`} onClick={onEdit} />}
      <Caret open={open} onClick={onToggle} />
    </div>
    <div style={{ ...descText, paddingBottom: open ? 0 : 10, marginLeft: SPACING.rowSide + INDENT }}>{tidy(item.desc)}</div>
    {open && (
      <div style={{ margin: `6px ${SPACING.rowSide}px 0 ${SPACING.rowSide + INDENT}px`, paddingBottom: 8 }}>
        {episode && !editRow && <EpisodeBox ep={episode} />}
        <div style={{ ...caps, color: C.light, padding: "2px 0 6px" }}>{count("Arcs", item.arcs?.length || 0)}</div>
        {(item.arcs || []).map((x, k) => <ChapterArcRow key={k} x={x} arc={arcs.find(a => sameName(a.name, x.arc))}
          episode={episode && sameName(x.arc, "The Edit") ? episode : undefined} />)}
        {extra}
      </div>
    )}
  </div>
  );
};
const ChapterArcRow = ({ x, arc, episode }: { x: ChapterArc; arc?: ConceptArc; episode?: ConceptEpisode }) => (
  <div style={{ borderTop: `1px solid ${C.hair}`, padding: "8px 0" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {arc && <NumCircle n={arc.num} tone={ARC_TONE} size={18} />}
      <span style={{ fontSize: SPACING.listText, fontWeight: 600, color: C.black, lineHeight: 1.35 }}>{x.arc}</span>
    </div>
    {x.note && <div style={{ fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>{tidy(x.note)}</div>}
    {episode && <EpisodeBox ep={episode} />}
    {x.formats.length > 0 && (
      <div style={{ marginTop: 4 }}>
        {x.formats.map((f, k) => (
          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: GAP - 1, padding: "2px 0" }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: C.faint, flexShrink: 0, marginTop: 7 }} />
            <span style={{ fontSize: SPACING.listText, color: C.ink2, lineHeight: 1.4, overflowWrap: "anywhere" as const }}>{f}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Guide (@lynnhoa, 07.11.2026): what you stand for and how it all works, read only ───
// Four cards like the chapters: number · name · (what it is, small grey) · arrow — closed: one
// grey line; open: labelled blocks, lined up with the card's name. Every level keeps its own
// pastel: each tab its own (rose · sand · apricot · aqua · plum, its chapters in its colour) ·
// arcs blue · formats mint · How I … peach · The Outing sage · the Guide itself butter.
const GUIDE_CARDS: { key: string; name: string; label?: string; sum: string; tone: Tone }[] = [
  { key: "who",     name: "Who I am",         sum: GUIDE_WHO.title,                                              tone: GUIDE_TONE },
  { key: "levels",  name: "My 3 levels",      label: "Curation · Upgrade · Project", sum: "Each home or away, each Intro → Climax → Outro", tone: PAL.lynnhoa },
  { key: "series",  name: GUIDE_SERIES.name,  label: GUIDE_SERIES.label,  sum: "Curation's climax: the hook, the edit, the result",     tone: SERIES_TONE },
  { key: "package", name: GUIDE_PACKAGE.name, label: GUIDE_PACKAGE.label, sum: "The Upgrade: Before, Look and Moment for every day out", tone: PACKAGE_TONE },
  { key: "how",     name: "How it all works", sum: "Where to find what, and what to do",                          tone: PAL.neutral },
];
// the levels' pastels — @lynnhoa: Curation peach (How I …) · Upgrade sage (The Outing) · Project rose (what you
// develop); @createbylynn: Signature rose (Looks) · Change peach · Product run sage (its band on Products)
const LEVEL_TONE: Record<string, Tone> = { curation: SERIES_TONE, upgrade: PACKAGE_TONE, project: TAB_TONE.eras, signature: TAB_TONE.eras, change: SERIES_TONE, run: PACKAGE_TONE };
// a format on a level's beat: like GTag, but it may wrap (three beats share one row)
const GWrapTag = ({ text }: { text: string }) => (
  <span style={{ fontSize: TYPE.label.size, lineHeight: 1.3, padding: "2px 6px", borderRadius: RADIUS.tag, background: FORMAT_TONE.wash, color: FORMAT_TONE.ink }}>{text}</span>
);
const gLabel: any = { ...caps, color: C.light, margin: "12px 0 6px" };
const gMeta: any  = { fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 };
// a pastel tag: the step of a pattern
const GTag = ({ text, tone }: { text: string; tone: Tone }) => (
  <span style={{ fontSize: TYPE.subtext.size, lineHeight: 1.3, padding: "3px 8px", borderRadius: RADIUS.tag, background: tone.wash, color: tone.ink, whiteSpace: "nowrap" as const }}>{text}</span>
);
// Hook → Curation → Result · Before → Look → Moment (→ Story, optional in grey)
const GFlow = ({ steps, tone, extra }: { steps: string[]; tone: Tone; extra?: string }) => {
  const arrow = <span aria-hidden="true" style={{ color: C.faint, fontSize: TYPE.subtext.size }}>→</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 4 }}>
      {steps.map((x, k) => <Fragment key={x}>{k > 0 && arrow}<GTag text={x} tone={tone} /></Fragment>)}
      {extra && <>{arrow}<GTag text={extra} tone={PAL.neutral} /></>}
    </div>
  );
};
// "Personality · particular …": the label in the card's colour, the rest grey
const GMetaLine = ({ label, text, tone }: { label: string; text: string; tone: Tone }) => (
  <div style={{ ...gMeta, marginTop: 3 }}><span style={{ color: tone.ink }}>{label}</span> · {text}</div>
);
// one level of the tree: name left, what it is right, in its pastel
const GNode = ({ name, note, tone, kicker }: { name: string; note: string; tone: Tone; kicker?: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: kicker ? "6px 10px" : "7px 10px", borderRadius: RADIUS.field, background: tone.wash }}>
    <div style={{ minWidth: 0 }}>
      {kicker && <div style={{ fontSize: TYPE.micro.size, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: tone.ink, lineHeight: 1.2 }}>{kicker}</div>}
      <div style={{ fontSize: SPACING.listText, fontWeight: 500, color: tone === PAL.neutral ? C.ink2 : tone.ink, lineHeight: 1.3, whiteSpace: "nowrap" as const }}>{name}</div>
    </div>
    <span style={{ marginLeft: "auto", fontSize: SPACING.listMeta, color: tone === PAL.neutral ? C.muted : tone.ink, textAlign: "right" as const, lineHeight: 1.3 }}>{note}</span>
  </div>
);
// the levels under a node: a light line on the left, a short tick to each child
const GBranch = ({ children }: { children: any[] }) => (
  <div style={{ marginLeft: 12, paddingLeft: 14, paddingTop: 5, borderLeft: `1.5px solid ${C.edge}`, display: "flex", flexDirection: "column" as const, gap: 5 }}>
    {children.map((c, k) => (
      <div key={k} style={{ position: "relative" as const }}>
        <span aria-hidden="true" style={{ position: "absolute" as const, left: -14, top: 16, width: 11, height: 1.5, background: C.edge }} />
        {c}
      </div>
    ))}
  </div>
);

// one Guide card: number · name · (what it is) · arrow — closed: its grey line; open: its blocks
const GuideCard = ({ n, card, open, onToggle, onEdit, children }: { n: number; card: typeof GUIDE_CARDS[number]; open: boolean; onToggle: () => void; onEdit?: () => void; children: any }) => (
  <div style={cardBox}>
    <div style={{ display: "flex", alignItems: "center" }}>
      <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${card.name}`} style={headBtn}>
        <NumCircle n={n} tone={card.tone} />
        <span style={nameText}>{card.name}</span>
        {card.label && <span style={{ fontSize: SPACING.listMeta, color: C.muted, flexShrink: 0 }}>{card.label}</span>}
      </button>
      {open && onEdit && <EditLink label={`Edit the ${card.name} episodes`} onClick={onEdit} />}
      <Caret open={open} onClick={onToggle} />
    </div>
    {open
      ? <div style={{ margin: `-6px ${SPACING.rowSide}px 0 ${SPACING.rowSide + INDENT}px`, paddingBottom: 12 }}>{children}</div>
      : <div style={{ ...descText, paddingBottom: 10, marginLeft: SPACING.rowSide + INDENT }}>{tidy(card.sum)}</div>}
  </div>
);

// my 3 levels (both accounts): each level a band in its pastel, its three beats side by side (what · formats), home / away
const LevelsBody = ({ note, levels }: { note: string; levels: GuideLevel[] }) => (
  <>
    <div style={{ ...gMeta, marginTop: 2 }}>{note}</div>
    {levels.map((lv, i) => {
      const tone = LEVEL_TONE[lv.key] || PAL.neutral;
      return (
        <div key={lv.key} style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: RADIUS.field, background: tone.wash }}>
            <span style={{ fontSize: SPACING.listText, fontWeight: 500, color: tone.ink, lineHeight: 1.3, whiteSpace: "nowrap" as const }}>{i + 1} · {lv.name}</span>
            <span style={{ marginLeft: "auto", fontSize: SPACING.listMeta, color: tone.ink, lineHeight: 1.3, textAlign: "right" as const }}>{lv.note} · {lv.ref}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: 6 }}>
            {lv.beats.map(b => (
              <div key={b.name} style={{ minWidth: 0 }}>
                <div style={{ ...caps, color: C.light }}>{b.name}</div>
                <div style={{ fontSize: TYPE.subtext.size, color: C.ink2, lineHeight: 1.3, margin: "2px 0 4px" }}>{b.what}</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 2 }}>{b.formats.map(f => <GWrapTag key={f} text={f} />)}</div>
              </div>
            ))}
          </div>
          {lv.home === lv.away
            ? <GMetaLine label="Home or away" text={lv.home} tone={tone} />
            : <><GMetaLine label="Home" text={lv.home} tone={tone} /><GMetaLine label="Away" text={lv.away} tone={tone} /></>}
        </div>
      );
    })}
  </>
);

// what each Guide card holds, open
function GuideBody({ k, arcsCount, episodes }: { k: string; arcsCount: number; episodes: ConceptEpisode[] }) {
  if (k === "who") return (
    <>
      <div style={{ fontFamily: SERIF, fontSize: 15, color: C.black, lineHeight: 1.35 }}>{GUIDE_WHO.title}</div>
      <div style={{ fontSize: SPACING.listText, color: C.ink2, lineHeight: 1.4, margin: "3px 0 5px" }}>{GUIDE_WHO.line}</div>
      <GMetaLine label="Name" text={GUIDE_WHO.name} tone={GUIDE_TONE} />
      <GMetaLine label="Means" text={GUIDE_WHO.means} tone={GUIDE_TONE} />
      <GMetaLine label="Personality" text={GUIDE_WHO.personality} tone={GUIDE_TONE} />
      <GMetaLine label="They see" text={GUIDE_WHO.see} tone={GUIDE_TONE} />
      <GMetaLine label="Rule" text={GUIDE_WHO.rule} tone={GUIDE_TONE} />
    </>
  );
  if (k === "levels") return <LevelsBody note={GUIDE_LEVELS_NOTE} levels={GUIDE_LEVELS} />;

  if (k === "series") return (
    <>
      <GFlow steps={GUIDE_SERIES.steps} tone={SERIES_TONE} />
      <div style={{ ...gMeta, margin: "6px 0 4px" }}>{GUIDE_SERIES.film}</div>
      {episodes.map(x => (
        <div key={x.chapter} style={{ display: "grid", gridTemplateColumns: "86px minmax(0,1fr)", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.hair}` }}>
          <span style={{ ...caps, letterSpacing: "0.06em", color: SERIES_TONE.ink, lineHeight: 1.35, paddingTop: 1 }}>{x.chapter}</span>
          <Episode ep={x} />
        </div>
      ))}
    </>
  );
  if (k === "package") return (
    <>
      <GFlow steps={GUIDE_PACKAGE.steps} tone={PACKAGE_TONE} extra={GUIDE_PACKAGE.optional} />
      <div style={{ ...gMeta, marginTop: 6 }}>{GUIDE_PACKAGE.line}</div>
      <GMetaLine label="Level" text={GUIDE_PACKAGE.where} tone={PACKAGE_TONE} />
      <GMetaLine label="Before" text={GUIDE_PACKAGE.note} tone={PACKAGE_TONE} />
      <GMetaLine label="Runs in" text={GUIDE_PACKAGE.runsIn.join(" · ")} tone={PACKAGE_TONE} />
    </>
  );
  // how it all works: look up · what you film (the tree) · your workflow
  return (
    <>
      <div style={{ ...gLabel, marginTop: 2 }}>Look up</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6 }}>
        <GNode name="Guide" note="why" tone={GUIDE_TONE} />
        <GNode name="Arcs" note={arcsCount ? `all ${arcsCount}` : "all"} tone={ARC_TONE} />
      </div>
      <div style={gLabel}>What you film</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
        <GNode name="My 3 levels" note="how every storyline runs" tone={PAL.lynnhoa} />
        <GNode name="Personal Eras" note="what you develop" tone={TAB_TONE.eras} />
        <GNode name="Daily" note="single clips in between" tone={TAB_TONE.base} />
        <div>
          <GNode name="Home · Travel · Work" note="where it happens" tone={PAL.neutral} />
          <GBranch>{[
            <div key="ch">
              <GNode name="Chapter" note="your situation · in its tab's colour" tone={PAL.neutral} />
              <GBranch>{[
                <div key="arcs">
                  <GNode name="Arcs" note="how each post is told" tone={ARC_TONE} />
                  <GBranch>{[
                    <GNode key="f" name="Formats" note="how you film it" tone={FORMAT_TONE} />,
                    <GNode key="s" kicker={GUIDE_SERIES.label} name={GUIDE_SERIES.name} note={GUIDE_SERIES.where} tone={SERIES_TONE} />,
                    <GNode key="p" kicker={GUIDE_PACKAGE.label} name={GUIDE_PACKAGE.name} note={GUIDE_PACKAGE.steps.join(" → ")} tone={PACKAGE_TONE} />,
                  ]}</GBranch>
                </div>,
              ]}</GBranch>
            </div>,
          ]}</GBranch>
        </div>
      </div>
      <div style={gLabel}>Your workflow</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6 }}>
        {GUIDE_WORKFLOW.map((x, i) => (
          <div key={x} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: RADIUS.field, background: PAL.neutral.wash }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", background: C.white, border: `1px solid ${C.edge}`, fontSize: TYPE.micro.size, color: PAL.neutral.ink,
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: TYPE.subtext.size, color: C.ink2, lineHeight: 1.3 }}>{x}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function PlannerConcept({ planner, view, isMobile, onAccount }: PlannerConceptProps) {
  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const arcs   = planner.arcs.filter(a => a.account === acc).sort((a, b) => a.num - b.num);
  const basePh = planner.phases.find(p => p.account === acc && isBasePhase(p));
  const blocks = basePh?.eras || [];
  const accLabel = ACCOUNTS.find(a => a.key === acc)?.label || `@${acc}`;

  // Base | Phases | Arcs — opens on the tab you had last (remembered on this device)
  const [show, setShow] = useState<ConceptView>(loadView);
  const pickView = (v: ConceptView) => { setShow(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };
  // @createbylynn: its 4 tabs (Daily · Looks · Products · Editorial), each showing its pillars' arcs
  const seriesMode = acc === "createbylynn";
  const series = arcs.filter(isSeries);              // before the pillars SQL: the old series
  const pillarArcs = arcs.filter(isPillarArc);
  const cblTabs = CBL_TABS.map(t => ({ ...t, list: arcsOfTab(pillarArcs, t) }));

  // open cards, per account (Base by the block's key, arcs and phases by their number)
  const [openArcs, setOpenArcs] = useState<OpenMap>(() => loadMap(OPEN_KEY));
  const arcNums = openArcs[acc] || [];
  const setArcsOpen = (nums: number[]) => { const m = { ...openArcs, [acc]: nums }; setOpenArcs(m); saveMap(OPEN_KEY, m); };
  const toggleArc   = (n: number) => setArcsOpen(arcNums.includes(n) ? arcNums.filter(x => x !== n) : [...arcNums, n]);
  const anyArcOpen  = arcs.some(a => arcNums.includes(a.num));
  // @createbylynn: the open tab, the Guide or "arcs" — remembered on this device
  const [cblShow, setCblShow] = useState<string>(() => { try { return localStorage.getItem(VIEW_CBL_KEY) || ""; } catch { return ""; } });
  const pickCbl = (k: string) => { setCblShow(k); try { localStorage.setItem(VIEW_CBL_KEY, k); } catch { /* ignore */ } };
  const cblArcs  = cblShow === "arcs";
  const cblGuide = cblShow === "guide";
  const cblTab   = cblTabs.find(t => t.key === cblShow) || cblTabs[0];   // a pillar key saved before the tabs: the first tab
  const cblReady = pillarArcs.length > 0;
  // a Main Area's open chapters, per account ("home:After Trip")
  const [openChs, setOpenChs] = useState<OpenKeys>(() => loadMap(OPEN_CH_KEY));
  const chKeys    = (openChs[acc] || []).filter(k => typeof k === "string");
  const setChsOpen = (keys: string[]) => { const m = { ...openChs, [acc]: keys }; setOpenChs(m); saveMap(OPEN_CH_KEY, m); };
  const toggleCh  = (k: string) => setChsOpen(chKeys.includes(k) ? chKeys.filter(x => x !== k) : [...chKeys, k]);
  // the Guide's open cards, per account (by their key)
  const [openGd, setOpenGd] = useState<OpenKeys>(() => loadMap(OPEN_GD_KEY));
  const gdKeys    = (openGd[acc] || []).filter(k => typeof k === "string");
  const setGdOpen = (keys: string[]) => { const m = { ...openGd, [acc]: keys }; setOpenGd(m); saveMap(OPEN_GD_KEY, m); };
  const toggleGd  = (k: string) => setGdOpen(gdKeys.includes(k) ? gdKeys.filter(x => x !== k) : [...gdKeys, k]);
  const anyGdOpen = GUIDE_CARDS.some(c => gdKeys.includes(c.key));
  // the lists folded inside cards (open unless folded), per account
  const [folded, setFolded] = useState<OpenKeys>(() => loadMap(FOLD_KEY));
  const foldList = (folded[acc] || []).filter(k => typeof k === "string");
  const fold = {
    isOpen: (id: string) => !foldList.includes(id),
    toggle: (id: string) => {
      const m = { ...folded, [acc]: foldList.includes(id) ? foldList.filter(x => x !== id) : [...foldList, id] };
      setFolded(m); saveMap(FOLD_KEY, m);
    },
  };

  // the window: one arc's texts or links, one Base block's lines, or the How I … episodes
  const [win, setWin] = useState<Win | null>(null);
  const winArc   = win && (win.kind === "texts" || win.kind === "links") ? planner.arcs.find(a => a.id === win.id) : undefined;
  const winPhase = win && win.kind === "block" ? planner.phases.find(p => p.id === win.id) : undefined;
  const winEra   = win && win.kind === "block" ? winPhase?.eras.find(e => e.key === win.era) : undefined;
  const winOk    = !!win && (win.kind === "episodes" || (win.kind === "block" ? !!winEra : !!winArc));
  const episodes = planner.episodesFor(acc);
  useEffect(() => { if (win && !winOk && !planner.loading) setWin(null); }, [win, winOk, planner.loading]);
  const close = () => setWin(null);
  const done  = <SheetButton onClick={close}>Done</SheetButton>;
  // a series of the Look arc has labels, every other one (and every arc) texts
  const winLabels = !!winArc && isSeries(winArc) && seriesWord(winArc) === "labels";
  // a Daily block's window title: "Daily · Signatures"
  const blockTitle = (e: ConceptEra) => `Daily · ${e.name}`;

  const columns = <T,>(list: T[], render: (x: T) => any) => {
    const column = (l: T[]) => <div style={{ display: "flex", flexDirection: "column" as const, gap: SPACING.cardGap, minWidth: 0 }}>{l.map(render)}</div>;
    if (isMobile) return column(list);
    const half = Math.ceil(list.length / 2);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: SPACING.cardGap, alignItems: "start" }}>
        {column(list.slice(0, half))}
        {column(list.slice(half))}
      </div>
    );
  };
  const swatch = (t: { wash: string; mid: string }, round = false) => (
    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: round ? "50%" : 3, boxSizing: "border-box" as const, background: t.wash, border: `1.5px solid ${t.mid}`, flexShrink: 0 }} />
  );
  // under the list, while a card is open: what its marks mean
  const legend = (items: { mark: any; label: string }[]) => (
    <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: "6px 14px", fontSize: SPACING.listMeta, color: C.muted, margin: `${SPACING.cardGap}px 2px 0` }}>
      {items.map(x => <span key={x.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{x.mark}{x.label}</span>)}
    </div>
  );
  const empty = (title: string, text: string) => (
    <div style={{ ...cardBox, padding: "14px 12px" }}>
      <div style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black }}>{title}</div>
      <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
  const note = (text: string, color: string = C.muted) => <p style={{ fontSize: SPACING.plannerText, color, marginTop: 16 }}>{text}</p>;
  // under an arc list, while an arc is open: what the format marks mean
  const formatMarks = legend([
    { mark: <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink2 }} />, label: "main format" },
    { mark: swatch(PLATFORM_TONE.TikTok), label: "TikTok" },
    { mark: swatch(PLATFORM_TONE.Instagram), label: "Instagram" },
  ]);

  const arcsView = planner.conceptError ? note(planner.conceptError, C.red) : (
    <>
      <SectionHead dot={ARC_TONE.mid} label={`Arcs · ${arcs.length}`}
        right={arcs.length ? <button onClick={() => setArcsOpen(anyArcOpen ? [] : arcs.map(a => a.num))} style={mini}>{anyArcOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!arcs.length
        ? empty(`No arcs for ${accLabel} yet`, "They're added here once its concept is mapped, in the same layout: numbered arcs, formats, platforms, texts and links.")
        : columns(arcs, a => <ArcCard key={a.id} arc={a} open={arcNums.includes(a.num)} onToggle={() => toggleArc(a.num)} onOpen={kind => setWin({ kind, id: a.id })} />)}
      {anyArcOpen && formatMarks}
    </>
  );

  // Base: the 6 blocks (planner.ts) with their arcs; each block's lines come from the data (the
  // Base phase, found by the block's name) — shown under the arcs, "edit" opens them
  const norm = (t: string) => t.trim().toLowerCase().replace(/[’']/g, "'");   // the data's names may use either apostrophe
  const blockOf = (c: StructItem) => blocks.find(b => norm(b.name) === norm(c.name));
  const baseLines = (c: StructItem) => {
    const b = blockOf(c);
    if (!b) return null;
    const secs = b.sections.filter(x => x.lines.length);
    return secs.map((x, k) => (
      <div key={`${k}-${x.name}`} style={{ marginTop: 8 }}>
        <FoldSection id={`bs:${b.key}:${x.name || "-"}`} label={x.name || "Lines"} n={x.lines.length}>
          {x.lines.map((t, i) => { const [label, rest] = splitBlockLine(t); return <ItemRow key={i} name={label} text={tidy(rest)} />; })}
        </FoldSection>
      </div>
    ));
  };
  const baseKey = (c: StructItem) => `base:${c.name}`;
  const anyBaseOpen = BASE_BLOCKS.some(c => chKeys.includes(baseKey(c)));
  const baseView = (
    <>
      <SectionHead dot={TAB_TONE.base.mid} label={`Daily · ${BASE_BLOCKS.length}`}
        right={<button onClick={() => setChsOpen(anyBaseOpen ? chKeys.filter(k => !k.startsWith("base:")) : Array.from(new Set([...chKeys, ...BASE_BLOCKS.map(baseKey)])))} style={mini}>{anyBaseOpen ? "collapse all" : "expand all"}</button>} />
      {columns(BASE_BLOCKS, c => {
        const b = blockOf(c);
        return <ChapterCard key={c.name} n={BASE_BLOCKS.indexOf(c) + 1} item={c} arcs={arcs} tone={TAB_TONE.base}
          open={chKeys.includes(baseKey(c))} onToggle={() => toggleCh(baseKey(c))} tag={chapterTag("base", c.name)}
          onEdit={b && basePh ? () => setWin({ kind: "block", id: basePh.id, era: b.key }) : undefined} extra={baseLines(c)} />;
      })}
    </>
  );

  // Personal Eras and the Main Areas' chapters (planner.ts): a card with arcs opens to show them,
  // one without stays a placeholder ("empty"). Open ones are remembered by "<tab>:<name>".
  const chapterList = (tab: ConceptTabKey, label: string, list: StructItem[]) => {
    const tone = TAB_TONE[tab];
    const key = (c: StructItem) => `${tab}:${c.name}`;
    const filled = list.filter(c => c.arcs?.length);
    const anyOpen = filled.some(c => chKeys.includes(key(c)));
    return (
      <>
        <SectionHead dot={tone.mid} label={`${label} · ${list.length}`}
          right={filled.length ? <button onClick={() => setChsOpen(anyOpen ? chKeys.filter(k => !filled.map(key).includes(k)) : Array.from(new Set([...chKeys, ...filled.map(key)])))} style={mini}>{anyOpen ? "collapse all" : "expand all"}</button> : undefined} />
        {columns(list, c => {
          const n = list.indexOf(c) + 1, tag = chapterTag(tab, c.name);
          return c.arcs?.length
            ? <ChapterCard key={c.name} n={n} item={c} arcs={arcs} tone={tone} open={chKeys.includes(key(c))} onToggle={() => toggleCh(key(c))}
                tag={tag} episode={tag === "series" ? episodes.find(e => e.chapter === c.name) : undefined} />
            : <PlaceholderCard key={c.name} n={n} item={c} tone={tone} />;
        })}
      </>
    );
  };
  const erasView = chapterList("eras", "Personal Eras", PERSONAL_ERAS);
  const area     = MAIN_AREAS.find(a => a.key === show);
  const areaView = area ? chapterList(area.key, `${area.title} · Chapters`, area.chapters) : null;

  // @createbylynn: the 5 pillars, numbered cards (phone one column · iPad / computer two)
  // the Guide: 4 cards, read only (planner.ts)
  const guideView = (
    <>
      <SectionHead dot={GUIDE_TONE.mid} label={`Guide · ${GUIDE_CARDS.length}`}
        right={<button onClick={() => setGdOpen(anyGdOpen ? [] : GUIDE_CARDS.map(c => c.key))} style={mini}>{anyGdOpen ? "collapse all" : "expand all"}</button>} />
      {columns(GUIDE_CARDS, c => (
        <GuideCard key={c.key} n={GUIDE_CARDS.indexOf(c) + 1} card={c} open={gdKeys.includes(c.key)} onToggle={() => toggleGd(c.key)}
          onEdit={c.key === "series" ? () => setWin({ kind: "episodes" }) : undefined}>
          <GuideBody k={c.key} arcsCount={arcs.length} episodes={episodes} />
        </GuideCard>
      ))}
    </>
  );

  // @createbylynn: the open tab's arcs, numbered 1, 2, 3 … in its colour (like a tab's chapters) —
  // Looks: each a Series · Products: the Product run (its band, then its arcs in order), then Roundups
  const tabOpen = cblTab.list.some(a => arcNums.includes(a.num));
  const runList = cblTab.key === "products" ? cblTab.list.filter(inProductRun) : [];
  const restList = cblTab.list.filter(a => !runList.includes(a));
  const cblOrder = [...runList, ...restList];
  const cblCard = (a: ConceptArc) => (
    <ArcCard key={a.id} arc={a} n={cblOrder.indexOf(a) + 1} tone={cblTab.tone}
      pill={cblTab.key === "looks" ? { label: "Series", tone: SERIES_TONE } : runList.includes(a) ? { label: "Run", tone: PACKAGE_TONE } : undefined}
      open={arcNums.includes(a.num)} onToggle={() => toggleArc(a.num)} onOpen={kind => setWin({ kind, id: a.id })} />
  );
  const pillarView = planner.conceptError ? note(planner.conceptError, C.red) : !cblReady
    ? empty(`No arcs for ${accLabel} yet`, series.length
        ? "Run the @createbylynn pillars SQL in Supabase once: it turns your series into arcs (your texts, links and ideas come along)."
        : "Run the @createbylynn concept SQL and then the pillars SQL in Supabase once.")
    : (
    <>
      <SectionHead dot={cblTab.tone.mid} label={`${cblTab.label} · Arcs · ${cblTab.list.length}`}
        right={cblTab.list.length ? <button onClick={() => setArcsOpen(tabOpen ? arcNums.filter(n => !cblTab.list.some(a => a.num === n)) : Array.from(new Set([...arcNums, ...cblTab.list.map(a => a.num)])))} style={mini}>{tabOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {cblTab.note && <div style={{ fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4, margin: "-4px 2px 8px" }}>{tidy(cblTab.note)}</div>}
      {runList.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: RADIUS.card, background: PACKAGE_TONE.wash, color: PACKAGE_TONE.ink, marginBottom: SPACING.cardGap }}>
          <TonedTag tone={PACKAGE_TONE} s={{ flexShrink: 0 }}>{CBL_RUN.label}</TonedTag>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: SPACING.listText, fontWeight: 600 }}>{CBL_RUN.name}</span>
            <span style={{ display: "block", fontSize: SPACING.listMeta, lineHeight: 1.35 }}>{tidy(CBL_RUN.line)}</span>
          </span>
        </div>
      )}
      {cblTab.key === "looks" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: RADIUS.card, background: SERIES_TONE.wash, color: SERIES_TONE.ink, marginBottom: SPACING.cardGap }}>
          <TonedTag tone={SERIES_TONE} s={{ flexShrink: 0 }}>{CBL_CHANGE.label}</TonedTag>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: SPACING.listText, fontWeight: 600 }}>{CBL_CHANGE.name}</span>
            <span style={{ display: "block", fontSize: SPACING.listMeta, lineHeight: 1.35 }}>{tidy(CBL_CHANGE.line)}</span>
          </span>
        </div>
      )}
      {runList.length > 0 && columns(runList, cblCard)}
      {runList.length > 0 && restList.length > 0 && <div style={{ height: SPACING.cardGap }} />}
      {restList.length > 0 && columns(restList, cblCard)}
      {!cblTab.list.length && empty(`Nothing in ${cblTab.label} yet`, "Run LH-Studio-createbylynn-tabs.sql in Supabase once.")}
      {tabOpen && formatMarks}
    </>
  );
  // @createbylynn's Guide: who I am · my 3 levels · the Product run · where does it go (1 + 2 = the stand-alone read)
  const CBL_GUIDE_CARDS = [
    { key: "cwho",    name: "Who I am",          label: "Identity",          sum: CBL_WHO.title,                         tone: GUIDE_TONE },
    { key: "clevels", name: "My 3 levels",       label: "Signature · Change · Product run", sum: "Each home or away, each Intro → Climax → Outro", tone: PAL.lynnhoa },
    { key: "crun",    name: CBL_RUN.name,        label: CBL_RUN.label,       sum: tidy(CBL_RUN.line),                    tone: PACKAGE_TONE },
    { key: "cwhere",  name: "Where does it go?", sum: "Have an idea? This tells you where it goes",           tone: PAL.neutral },
  ];
  const anyCgOpen = CBL_GUIDE_CARDS.some(c => gdKeys.includes(c.key));
  const runSteps = cblTabs.find(t => t.key === "products")?.list.filter(inProductRun) || [];
  const cblGuideView = (
    <>
      <SectionHead dot={GUIDE_TONE.mid} label={`Guide · ${CBL_GUIDE_CARDS.length}`}
        right={<button onClick={() => setGdOpen(anyCgOpen ? [] : CBL_GUIDE_CARDS.map(c => c.key))} style={mini}>{anyCgOpen ? "collapse all" : "expand all"}</button>} />
      {columns(CBL_GUIDE_CARDS, c => (
        <GuideCard key={c.key} n={CBL_GUIDE_CARDS.indexOf(c) + 1} card={c} open={gdKeys.includes(c.key)} onToggle={() => toggleGd(c.key)}>
          {c.key === "cwho" && (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 15, color: C.black, lineHeight: 1.35 }}>{CBL_WHO.title}</div>
              <div style={{ fontSize: SPACING.listText, color: C.ink2, lineHeight: 1.4, margin: "3px 0 5px" }}>{CBL_WHO.line}</div>
              <GMetaLine label="Name" text={CBL_WHO.name} tone={GUIDE_TONE} />
              <GMetaLine label="Means" text={CBL_WHO.means} tone={GUIDE_TONE} />
              <GMetaLine label="Personality" text={CBL_WHO.personality} tone={GUIDE_TONE} />
              <GMetaLine label="They see" text={CBL_WHO.see} tone={GUIDE_TONE} />
              <GMetaLine label="Brand" text={CBL_WHO.brand} tone={GUIDE_TONE} />
              <GMetaLine label="Rule" text={CBL_WHO.rule} tone={GUIDE_TONE} />
              <GMetaLine label="lynnhoa" text={CBL_WHO.lynnhoa} tone={GUIDE_TONE} />
              <GMetaLine label="Portfolio" text={CBL_WHO.portfolio} tone={GUIDE_TONE} />
            </>
          )}
          {c.key === "clevels" && <LevelsBody note={CBL_LEVELS_NOTE} levels={CBL_LEVELS} />}
          {c.key === "crun" && (
            <>
              <GFlow steps={runSteps.map((a, k) => `${k + 1} ${a.name}`)} tone={PACKAGE_TONE} />
              <div style={{ ...gMeta, marginTop: 6 }}>{tidy(CBL_RUN.line)}</div>
              <GMetaLine label="Level" text="3 · Product run, trust · Intro = Receiving · Climax = Try-on, Problem → solution · Outro = Verdict, In rotation" tone={PACKAGE_TONE} />
            </>
          )}
          {c.key === "cwhere" && CBL_WHERE.map(w => (
            <div key={w.have} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.hair}`, fontSize: SPACING.listMeta, lineHeight: 1.35 }}>
              <span style={{ color: C.ink2 }}>{w.have}</span>
              <span style={{ color: (w.tab && CBL_TABS.find(t => t.key === w.tab)?.tone.ink) || C.muted, fontWeight: w.tab ? 600 : 400, textAlign: "right" as const }}>{w.to}</span>
            </div>
          ))}
        </GuideCard>
      ))}
    </>
  );

  return (
    <FoldCtx.Provider value={fold}>
    <div>
      {/* Content concept · Guide · Arcs, then the account and what the tab is */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Content concept</h2>
        <RoundBtn on={seriesMode ? cblGuide : show === "guide"} label="Guide" icon={ICON_GUIDE} tone={GUIDE_TONE} onClick={() => (seriesMode ? pickCbl("guide") : pickView("guide"))} />
        <RoundBtn on={seriesMode ? cblArcs : show === "arcs"} label="Arcs" icon={ICON_ARCS} tone={ARC_TONE} n={arcs.length} onClick={() => (seriesMode ? pickCbl("arcs") : pickView("arcs"))} />
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: "6px 8px", marginTop: 8 }}>
        <AccChip acc={acc} onAccount={onAccount} />
        <span style={{ ...caps, letterSpacing: "0.06em", color: C.muted }}>{seriesMode ? (cblArcs ? SUBTITLE.arcs : cblGuide ? "Who I am and where things go" : cblTab.sub) : SUBTITLE[show]}</span>
      </div>
      <div style={{ height: 6 }} />

      {planner.loading ? note("Loading…") : seriesMode ? (cblArcs ? arcsView : cblGuide ? cblGuideView : pillarView) : show === "guide" ? guideView : show === "base" ? baseView : show === "eras" ? erasView : areaView || arcsView}
      {(!seriesMode || cblReady) && <div style={{ height: NAV_SPACE }} />}
      {!seriesMode && <BottomNav label="Content concept" items={TAB_ITEMS} value={show} onPick={k => pickView(k as ConceptView)} />}
      {seriesMode && cblReady && <BottomNav label="Content concept" items={CBL_ITEMS} value={cblArcs || cblGuide ? "" : cblTab.key} onPick={pickCbl} />}

      {/* an arc's texts or links (from the Arcs tab) */}
      {win && (win.kind === "texts" || win.kind === "links") && winArc && (
        <Sheet title={isPillarArc(winArc) ? `${pillarLabel(winArc.pillar)} · ${winArc.name}` : `${seriesNum(planner.arcs, winArc)}. ${winArc.name}`} onClose={close} footer={done}>
          <WinHead first icon={win.kind === "texts" ? IC.list : IC.link} tone={ARC_TONE}
            label={win.kind === "texts" ? count(winLabels ? "Labels" : "Texts", winArc.texts.length) : count("Links", winArc.links.length)} />
          <div style={winCard}>
            {win.kind === "texts"
              ? <LineList key={`t-${winArc.id}`} initial={winArc.texts} marker="bullets" placeholder={winLabels ? "Write a label" : "Write a text"} addLabel={winLabels ? "Add a label" : "Add a text"}
                  onSave={lines => { quiet(planner.updateArc(winArc.id, { texts: lines })); }} />
              : <LinkList key={`l-${winArc.id}`} initial={winArc.links} pillTone={platformTone}
                  onSave={links => { quiet(planner.updateArc(winArc.id, { links })); }} />}
          </div>
        </Sheet>
      )}

      {/* a Base block's lines: one list per section, saved right away (Undo on ✕) */}
      {win && win.kind === "block" && winPhase && winEra && (
        <Sheet title={blockTitle(winEra)} onClose={close} footer={done}>
          {(winEra.sections.length ? winEra.sections : [{ name: "", lines: [] as string[] }]).map((x, k) => (
            <div key={`${k}-${x.name}`}>
              <WinHead first={k === 0} icon={IC.list} tone={TAB_TONE.base} label={count(x.name || "Lines", x.lines.length)} />
              <div style={winCard}>
                <LineList key={`bl-${winEra.key}-${k}`} initial={x.lines} marker="bullets" placeholder="A line · how it shows" addLabel="Add a line"
                  onSave={lines => { quiet(planner.updateBlockLines(winPhase.id, winEra.key, k, lines)); }} />
              </div>
            </div>
          ))}
        </Sheet>
      )}

      {/* How I …: one title and hook per series chapter, saved when you leave the field (no history) */}
      {win && win.kind === "episodes" && (
        <Sheet title={`${GUIDE_SERIES.name} · Episodes`} onClose={close} footer={done}>
          {planner.episodesError && <SheetErr>{planner.episodesError}</SheetErr>}
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 2px 4px", lineHeight: 1.5 }}>One per chapter. Saved when you leave the field; a change replaces the old text.</p>
          {episodes.map((ep, k) => (
            <div key={ep.chapter}>
              <WinHead first={k === 0} icon={IC.list} tone={SERIES_TONE} label={ep.chapter} />
              <div style={winCard}>
                <SheetRow first label="Title">
                  {planner.episodesError
                    ? <span style={{ fontSize: SPACING.listText, color: C.black }}>{ep.title}</span>
                    : <TextInline value={ep.title} placeholder="How I …" ariaLabel={`${ep.chapter}: title`}
                        onSave={v => { quiet(planner.updateEpisode(acc, ep.chapter, { title: v.trim() })); }} />}
                </SheetRow>
                <SheetRow label="Hook">
                  {planner.episodesError
                    ? <span style={{ fontSize: SPACING.listText, color: C.ink2 }}>{ep.hook}</span>
                    : <TextInline value={ep.hook} placeholder="Why you started" ariaLabel={`${ep.chapter}: hook`}
                        onSave={v => { quiet(planner.updateEpisode(acc, ep.chapter, { hook: v.trim() })); }} />}
                </SheetRow>
              </div>
            </div>
          ))}
        </Sheet>
      )}
    </div>
    </FoldCtx.Provider>
  );
}
