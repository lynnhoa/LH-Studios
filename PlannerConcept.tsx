// ─────────────────────────────────────────────────────────────
// PlannerConcept — Planner › Content concept, opened from the
// profile menu ("@lynnhoa concept" / "@createbylynn concept").
//   Personal Eras | Base | Home | Travel | Work: a switch under the title, and on the same line,
//   right, the "Arcs" pill — it opens the arcs. The page opens on what you had last
//   (remembered on this device). The line under the title says what it is.
//   Personal Eras and the Main Areas (Home · Travel · Work, each showing only its own chapters;
//   a chapter will hold its selected arcs, each arc its matching formats)
//   follow the master structure (planner.ts, LYNNHOA-CONTENT-STRUCTURE.md): placeholder cards
//   — number · name · what belongs there — marked "empty" until they're filled.
//   Home's chapters are filled (06.11.2026): number · name · arrow, what it is in grey; open: its
//   arcs in posting order — the arc's number (blue) · name · what it does here · its formats here.
//   Open chapters are remembered on this device; "expand all / collapse all" on the heading.
//   (The old Phases tab is gone; its phases stay in the data, for Creator › Now.)
//   Every card works the same: number · name · (open: its small links) · arrow. Open: what it
//   is in grey, then its lists — each under one heading (small grey caps with its count and a
//   small arrow: tap it to fold or unfold the list; what you fold stays folded on this device),
//   one row per item: a light dot, the name in black, what it is in grey, in full. Nothing is
//   shown twice: what a small link opens ("texts · links") isn't listed in the card too.
//   Base (warm grey): quick personality posts between chapters — the 6 blocks of planner.ts
//   (BASE_BLOCKS), shown like the chapters: open, its arcs with their notes and formats, then the
//   block's lines from the data (found by name). "edit" opens one window to add, change,
//   delete the lines (Undo, saved right away).
//   Phases (butter): Home, Occasion … one card each. Open: its purpose and its eras under
//   their group headings ("Moments · 3"; a phase without groups: "Eras · 3"). Each era shows
//   its arcs as small numbers (blue; optional ones grey) — tap the era: its arcs window.
//   Guide (pink pill next to "Arcs", 07.11.2026): the look-up page — what you stand for and how
//   it all works, read only (planner.ts, GUIDE_*). Four cards like the chapters: Who I am ·
//   How I … (signature series, filmed as The Edit: title on top, the hook right below) · The
//   Outing (content package: Before → Look → Moment, Story optional, and where it runs) · How it
//   all works (the levels as a small tree — tabs → chapter → arcs → formats · series · package —
//   then the 4-step workflow). Closed: one grey line; open cards remembered on this device.
//   Arcs (pastel blue): one card per arc. Open: its purpose and its formats with the TikTok /
//   Instagram ticks. "texts · links" open one window each — the texts and links live there
//   (add, change, delete with Undo, saved right away).
//   The arcs window (an era, or a Base block): what it is, then "Arcs · 4" with expand all,
//   the arcs as cards in posting order (optional ones last, in grey). Each IS the arc of the
//   Arcs tab — its formats, texts and links (each list folds) are edited right there, so a
//   change shows everywhere.
//   Under the list, while a card is open: what its marks mean. Open cards are remembered on
//   this device; the first time, all are closed.
// @createbylynn (no phases — 28.10.2026): the same top as @lynnhoa — "What each post is about",
//   one tab (Pillars) in the same switch, then "Pillars · 5" with expand all / collapse all, which
//   opens or closes everything: every pillar and every arc. The 5 pillars are the numbered cards:
//   number · name · arrow (open pillars remembered on this device, per account; the first time
//   all are closed). Open: the pillar's grey line (if it has one), then its arcs — each: name
//   (black) · what it does (grey) · "texts · links" (the same windows as an arc's) · small arrow;
//   tap it to fold its formats (open the first time, what you fold stays folded).
// Arcs, pillars, purpose, formats, ticks, phases and eras come from the SQL (fixed).
// Phone: one column · iPad / computer: two columns (first half left).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, createContext, useContext, Fragment } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, TRACK, SHADOW, PAL } from "./constants";
import { SectionHead, Sheet, SheetButton, OpenArrow } from "./atoms";
import { PERSONAL_ERAS, MAIN_AREAS, BASE_BLOCKS, BASE_NOTE, ACCOUNTS, PLATFORM_TONE, platformTone, ARC_TONE, PHASE_TONE, isSeries, seriesWord, seriesNum, isBasePhase, blockLineCount, splitBlockLine, BASE_TONE, conceptPhaseLabel, CONCEPT_PILLARS, arcsOfPillar, isPillarArc, pillarLabel,
  GUIDE_TONE, SERIES_TONE, PACKAGE_TONE, FORMAT_TONE, GUIDE_WHO, GUIDE_SERIES, GUIDE_PACKAGE, GUIDE_WORKFLOW } from "./planner";
import type { StructItem, ChapterArc, Account, ConceptArc, ConceptFormat, ConceptPhase, ConceptEra, ConceptEraArc } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { IC, Subtitle, TabTitle, WinHead, winCard, LineList, LinkList } from "./PlannerWindows";

// remembered on this device: the tab, and the open arcs, phases and Base blocks per account
// (none the first time)
const VIEW_KEY    = "lh_planner_concept_view";        // Personal Eras | Base | Home | Travel | Work | Guide | Arcs
const OPEN_KEY    = "lh_planner_concept_open";
const OPEN_BS_KEY = "lh_planner_concept_open_blocks"; // Base: by the block's key (no longer by its place)
const OLD_BS_KEY  = "lh_planner_concept_open_base";   // the old one, by place — cleared
const OPEN_PL_KEY = "lh_planner_concept_open_pillars"; // @createbylynn: the open pillars, by their key
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
function ArcCard({ arc, open, onToggle, onOpen }: { arc: ConceptArc; open: boolean; onToggle: () => void; onOpen: (kind: "texts" | "links") => void }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${arc.num}. ${arc.name}`} style={headBtn}>
          <NumCircle n={arc.num} tone={ARC_TONE} />
          <span style={nameText}>{arc.name}</span>
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

// one pillar (@createbylynn): number · name · arrow — open: its grey line, then its arcs
function PillarCard({ n, label, note, arcs, open, onToggle, onOpen }: { n: number; label: string; note: string; arcs: ConceptArc[]; open: boolean; onToggle: () => void; onOpen: (a: ConceptArc, kind: "texts" | "links") => void }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${label}`} style={headBtn}>
          <NumCircle n={n} tone={ARC_TONE} />
          <span style={nameText}>{label}</span>
        </button>
        <Caret open={open} onClick={onToggle} />
      </div>
      {open && (
        <div style={cardBody}>
          {note && <div style={descText}>{note}</div>}
          {/* the arcs' small arrows line up with the card's arrow (10 px from the edge) */}
          <div style={{ margin: `${note ? 6 : -4}px 4px 0 ${INDENT}px` }}>
            {arcs.map((a, k) => <PillarArc key={a.id} arc={a} first={k === 0} onOpen={kind => onOpen(a, kind)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// one arc inside a pillar: name (black) · what it does (grey) · texts · links · small arrow —
// tap the row to fold or unfold its formats (open the first time; what you fold stays folded)
function PillarArc({ arc, first, onOpen }: { arc: ConceptArc; first: boolean; onOpen: (kind: "texts" | "links") => void }) {
  const f = useContext(FoldCtx), id = `pa:${arc.id}`, open = f.isOpen(id);
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${C.hair}`, padding: first ? "2px 0 7px" : "7px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => f.toggle(id)} aria-expanded={open} aria-label={`${arc.name}, ${open ? "fold" : "open"}`}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, minHeight: 26, padding: "4px 0", margin: "-4px 0", boxSizing: "content-box" as const,
            background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const, color: C.black, WebkitTapHighlightColor: "transparent" }}>
          <span style={{ fontSize: SPACING.listText, fontWeight: 600, lineHeight: 1.35, flexShrink: 0, maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{arc.name}</span>
          {arc.purpose && <span style={{ fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.35, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{arc.purpose}</span>}
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button onClick={() => onOpen("texts")} aria-label={`Texts of ${arc.name}`} style={mini}>{count("texts", arc.texts.length)}</button>
          <button onClick={() => onOpen("links")} aria-label={`Links of ${arc.name}`} style={mini}>{count("links", arc.links.length)}</button>
          <span aria-hidden="true" onClick={() => f.toggle(id)} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}><OpenArrow open={open} /></span>
        </span>
      </div>
      {open && arc.formats.length > 0 && (
        <div style={{ marginTop: 3 }}>
          {arc.formats.map((x, k) => (
            <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: GAP - 1, padding: "2px 0" }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: C.faint, flexShrink: 0, marginTop: 7 }} />
              <span style={{ fontSize: SPACING.listText, color: C.ink2, lineHeight: 1.4, overflowWrap: "anywhere" as const }}>{x.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Personal Eras | Base | Home | Travel | Work — like the account switch, the chosen one in warm
// grey (the arcs: a pill on the same line, right; while they show, no tab is on)
const VIEWS: { key: ConceptView; label: string }[] = [
  { key: "eras", label: "Personal Eras" }, { key: "base", label: "Base" },
  ...MAIN_AREAS.map(a => ({ key: a.key as ConceptView, label: a.label })),
];
// @createbylynn: one tab, in the same switch (so both pages have the same top)
const CBL_VIEWS: { key: "pillars"; label: string }[] = [{ key: "pillars", label: "Pillars" }];
function ViewSwitch<K extends string>({ options, value, onPick, label }: { options: { key: K; label: string }[]; value: K; onPick: (v: K) => void; label: string }) {
  return (
  <span role="group" aria-label={label} style={{ display: "inline-flex", alignItems: "center", gap: 2, height: 28, padding: 2, boxSizing: "border-box" as const, border: `1px solid ${C.rule}`, borderRadius: 14, background: C.white }}>
    {options.map(v => {
      const on = v.key === value;
      return (
        <button key={v.key} type="button" aria-pressed={on} onClick={() => { if (!on) onPick(v.key); }}
          style={{ height: 22, padding: "0 9px", borderRadius: 11, boxSizing: "border-box" as const, border: `1px solid ${on ? C.pillOn : "transparent"}`,
            background: on ? PAL.neutral.fill : "transparent", color: on ? C.black : C.muted, fontFamily: SANS, fontSize: 12, letterSpacing: "0.01em",
            lineHeight: 1, whiteSpace: "nowrap" as const, cursor: on ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }}>
          {v.label}
        </button>
      );
    })}
  </span>
  );
}

// one of a Base block's arcs: its number and name (optional: grey) — tap: the block's arcs window, this one open
const ArcPill = ({ ea, arc, onClick }: { ea: ConceptEraArc; arc?: ConceptArc; onClick: () => void }) => {
  const t = ea.optional ? PAL.neutral : ARC_TONE, name = arc ? arc.name : `Arc ${ea.num}`;
  return (
    <button onClick={onClick} aria-label={`${ea.num}. ${name}${ea.optional ? ", optional" : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 24, background: t.wash, color: t.ink, border: "none", borderRadius: RADIUS.tag,
        padding: "3px 8px 3px 3px", fontFamily: SANS, fontSize: SPACING.listMeta, lineHeight: 1.2, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      <NumCircle n={ea.num} tone={{ ...t, wash: C.white }} size={16} />
      {name}
    </button>
  );
};

// one Base block: number · name · (open: edit) · arrow — open: what it is, its lines in sections, its arcs
function BlockCard({ block, n, arcs, open, onToggle, onLines, onArc }: { block: ConceptEra; n: number; arcs: ConceptArc[]; open: boolean; onToggle: () => void; onLines: () => void; onArc: (num: number) => void }) {
  const total = blockLineCount(block);
  const secs  = block.sections.filter(x => x.lines.length);
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${block.name}`} style={headBtn}>
          <NumCircle n={n} tone={BASE_TONE} />
          <span style={nameText}>{block.name}</span>
        </button>
        {open && <button onClick={onLines} aria-label={`Edit the lines of ${block.name}`} style={{ ...mini, flexShrink: 0 }}>edit</button>}
        <Caret open={open} onClick={onToggle} />
      </div>
      {open && (
        <div style={cardBody}>
          {block.desc && <div style={descText}>{tidy(block.desc)}</div>}
          <div style={listBox}>
            {secs.map((x, k) => (
              <div key={`${k}-${x.name}`} style={{ marginTop: k ? 6 : 0 }}>
                <FoldSection id={`bs:${block.key}:${x.name || "-"}`} label={x.name || "Lines"} n={x.lines.length}>
                  {x.lines.map((t, i) => { const [label, rest] = splitBlockLine(t); return <ItemRow key={i} name={label} text={tidy(rest)} />; })}
                </FoldSection>
              </div>
            ))}
            {!total && (
              <button onClick={onLines} style={{ display: "block", width: "100%", textAlign: "left" as const, background: "none", border: "none", borderTop: `1px solid ${C.hair}`,
                padding: "10px 0", fontFamily: SANS, fontSize: SPACING.listText, color: C.light, cursor: "pointer" }}>+ Add a line</button>
            )}
            {block.arcs.length > 0 && (
              <div style={{ marginTop: secs.length || !total ? 6 : 0 }}>
                <FoldSection id={`bs:${block.key}:arcs`} label="Arcs" n={block.arcs.length}>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                    {block.arcs.map((ea, k) => <ArcPill key={`${ea.num}-${k}`} ea={ea} arc={arcs.find(x => x.num === ea.num)} onClick={() => onArc(ea.num)} />)}
                  </div>
                </FoldSection>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// a list heading inside an arc card of the arcs window (above the texts and the links): a line above it
const winListHead: any = { padding: "4px 10px 0", margin: 0, minHeight: 26, boxSizing: "border-box" as const, borderTop: `1px solid ${C.hair}` };

// The arcs window — one era, or one Base block: what it is, then "Arcs · 4" with expand all and
// the arcs as cards in posting order — all closed when it opens (or the arc you tapped open).
// An open arc shows the arc itself — purpose, formats, texts and links — and its texts and links
// are edited right here (saved on the arc, so they change everywhere).
function EraSheet({ planner, phase, era, focus }: { planner: PlannerHook; phase: ConceptPhase; era: ConceptEra; focus?: number }) {
  const [open, setOpen] = useState<number[]>(focus ? [focus] : []);
  const anyOpen = open.length > 0;
  const toggle  = (n: number) => setOpen(o => (o.includes(n) ? o.filter(x => x !== n) : [...o, n]));
  return (
    <>
      {era.desc && <div style={{ fontSize: TYPE.subtext.size, color: C.muted, lineHeight: 1.4, margin: "2px 2px 0" }}>{tidy(era.desc)}</div>}
      <WinHead first={!era.desc} icon={IC.bulb} tone={ARC_TONE} label={count("Arcs", era.arcs.length)}
        right={era.arcs.length ? <button onClick={() => setOpen(anyOpen ? [] : era.arcs.map(a => a.num))} style={mini}>{anyOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!era.arcs.length && <div style={{ ...winCard, padding: "12px 12px", fontSize: TYPE.subtext.size, color: C.muted }}>No arcs here yet.</div>}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: SPACING.cardGap }}>
        {era.arcs.map(ea => {
          const arc  = planner.arcs.find(a => a.account === phase.account && a.num === ea.num);
          const name = arc ? arc.name : `Arc ${ea.num}`;
          const isOpen = open.includes(ea.num);
          return (
            <div key={`${ea.num}`} style={winCard}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <button onClick={() => toggle(ea.num)} aria-expanded={isOpen} aria-label={`${ea.num}. ${name}${ea.optional ? ", optional" : ""}`} style={headBtn}>
                  <NumCircle n={ea.num} tone={ea.optional ? PAL.neutral : ARC_TONE} />
                  <span style={{ ...nameText, color: ea.optional ? C.muted : C.black }}>{name}</span>
                  {ea.optional && <span style={{ fontSize: TYPE.micro.size, color: C.light, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{ea.note ? `optional · ${ea.note}` : "optional"}</span>}
                </button>
                <Caret open={isOpen} onClick={() => toggle(ea.num)} />
              </div>
              {isOpen && (arc ? (
                <>
                  <div style={cardBody}>
                    {arc.purpose && <div style={descText}>{tidy(arc.purpose)}</div>}
                    <div style={listBox}><Formats formats={arc.formats} fold={`arc:${arc.id}:formats`} /></div>
                  </div>
                  <FoldSection id={`arc:${arc.id}:texts`} label="Texts" n={arc.texts.length} head={winListHead}>
                    <LineList key={`et-${era.key}-${arc.id}`} initial={arc.texts} marker="bullets" placeholder="Write a text" addLabel="Add a text"
                      onSave={lines => { quiet(planner.updateArc(arc.id, { texts: lines })); }} />
                  </FoldSection>
                  <FoldSection id={`arc:${arc.id}:links`} label="Links" n={arc.links.length} head={winListHead}>
                    <LinkList key={`el-${era.key}-${arc.id}`} initial={arc.links} pillTone={platformTone}
                      onSave={links => { quiet(planner.updateArc(arc.id, { links })); }} />
                  </FoldSection>
                </>
              ) : (
                <div style={{ padding: `0 ${SPACING.rowSide}px 12px ${SPACING.rowSide + INDENT}px`, fontSize: TYPE.subtext.size, color: C.muted }}>This arc isn't in the concept.</div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

interface PlannerConceptProps {
  planner:   PlannerHook;
  view:      PlannerView;
  isMobile:  boolean;
  onAccount?: (a: Account) => void;
}

type Win = { kind: "texts" | "links"; id: string } | { kind: "era"; id: string; era: string; focus?: number } | { kind: "block"; id: string; era: string };

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
const ChapterCard = ({ n, item, arcs, open, onToggle, tone = PHASE_TONE, onEdit, extra }: { n: number; item: StructItem; arcs: ConceptArc[]; open: boolean; onToggle: () => void; tone?: Tone; onEdit?: () => void; extra?: any }) => (
  <div style={cardBox}>
    <div style={{ display: "flex", alignItems: "center" }}>
      <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${item.name}`} style={headBtn}>
        <NumCircle n={n} tone={tone} />
        <span style={nameText}>{item.name}</span>
      </button>
      {open && onEdit && <button onClick={onEdit} aria-label={`Edit the lines of ${item.name}`} style={{ ...mini, flexShrink: 0 }}>edit</button>}
      <Caret open={open} onClick={onToggle} />
    </div>
    <div style={{ ...descText, paddingBottom: open ? 0 : 10, marginLeft: SPACING.rowSide + INDENT }}>{tidy(item.desc)}</div>
    {open && (
      <div style={{ margin: `6px ${SPACING.rowSide}px 0 ${SPACING.rowSide + INDENT}px`, paddingBottom: 8 }}>
        <div style={{ ...caps, color: C.light, padding: "2px 0 6px" }}>{count("Arcs", item.arcs?.length || 0)}</div>
        {(item.arcs || []).map((x, k) => <ChapterArcRow key={k} x={x} arc={arcs.find(a => a.name.trim().toLowerCase() === x.arc.trim().toLowerCase())} />)}
        {extra}
      </div>
    )}
  </div>
);
const ChapterArcRow = ({ x, arc }: { x: ChapterArc; arc?: ConceptArc }) => (
  <div style={{ borderTop: `1px solid ${C.hair}`, padding: "8px 0" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {arc && <NumCircle n={arc.num} tone={ARC_TONE} size={18} />}
      <span style={{ fontSize: SPACING.listText, fontWeight: 600, color: C.black, lineHeight: 1.35 }}>{x.arc}</span>
    </div>
    {x.note && <div style={{ fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>{tidy(x.note)}</div>}
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
// pastel, the same as on the tabs: tabs warm grey · chapter butter · arcs blue · formats mint ·
// How I … peach · The Outing sage · the Guide itself pink.
const GUIDE_CARDS: { key: string; name: string; label?: string; sum: string; tone: Tone }[] = [
  { key: "who",     name: "Who I am",         sum: GUIDE_WHO.title,                               tone: GUIDE_TONE },
  { key: "series",  name: GUIDE_SERIES.name,  label: GUIDE_SERIES.label,  sum: "Why you started, what you chose, the result", tone: SERIES_TONE },
  { key: "package", name: GUIDE_PACKAGE.name, label: GUIDE_PACKAGE.label, sum: "Before, Look and Moment for every day out",   tone: PACKAGE_TONE },
  { key: "how",     name: "How it all works", sum: "Where to find what, and what to do",           tone: PAL.neutral },
];
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
const GuideCard = ({ n, card, open, onToggle, children }: { n: number; card: typeof GUIDE_CARDS[number]; open: boolean; onToggle: () => void; children: any }) => (
  <div style={cardBox}>
    <div style={{ display: "flex", alignItems: "center" }}>
      <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${card.name}`} style={headBtn}>
        <NumCircle n={n} tone={card.tone} />
        <span style={nameText}>{card.name}</span>
        {card.label && <span style={{ fontSize: SPACING.listMeta, color: C.muted, flexShrink: 0 }}>{card.label}</span>}
      </button>
      <Caret open={open} onClick={onToggle} />
    </div>
    {open
      ? <div style={{ margin: `-6px ${SPACING.rowSide}px 0 ${SPACING.rowSide + INDENT}px`, paddingBottom: 12 }}>{children}</div>
      : <div style={{ ...descText, paddingBottom: 10, marginLeft: SPACING.rowSide + INDENT }}>{tidy(card.sum)}</div>}
  </div>
);

// what each Guide card holds, open
function GuideBody({ k, arcsCount }: { k: string; arcsCount: number }) {
  if (k === "who") return (
    <>
      <div style={{ fontFamily: SERIF, fontSize: 15, color: C.black, lineHeight: 1.35 }}>{GUIDE_WHO.title}</div>
      <div style={{ fontSize: SPACING.listText, color: C.ink2, lineHeight: 1.4, margin: "3px 0 5px" }}>{GUIDE_WHO.line}</div>
      <GMetaLine label="Personality" text={GUIDE_WHO.personality} tone={GUIDE_TONE} />
      <GMetaLine label="Rule" text={GUIDE_WHO.rule} tone={GUIDE_TONE} />
    </>
  );
  if (k === "series") return (
    <>
      <GFlow steps={GUIDE_SERIES.steps} tone={SERIES_TONE} />
      <div style={{ ...gMeta, margin: "6px 0 4px" }}>{GUIDE_SERIES.film}</div>
      {GUIDE_SERIES.examples.map(x => (
        <div key={x.chapter} style={{ display: "grid", gridTemplateColumns: "86px minmax(0,1fr)", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.hair}` }}>
          <span style={{ ...caps, letterSpacing: "0.06em", color: SERIES_TONE.ink, lineHeight: 1.35, paddingTop: 1 }}>{x.chapter}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: SPACING.listText, color: C.black, lineHeight: 1.3 }}>{x.title}</div>
            <div style={{ fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.35, marginTop: 1 }}>“{x.hook}”</div>
          </div>
        </div>
      ))}
    </>
  );
  if (k === "package") return (
    <>
      <GFlow steps={GUIDE_PACKAGE.steps} tone={PACKAGE_TONE} extra={GUIDE_PACKAGE.optional} />
      <div style={{ ...gMeta, marginTop: 6 }}>{GUIDE_PACKAGE.line}</div>
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
        <GNode name="Personal Eras" note="what you develop" tone={PAL.neutral} />
        <GNode name="Base" note="quick posts in between" tone={PAL.neutral} />
        <div>
          <GNode name="Home · Travel · Work" note="where it happens" tone={PAL.neutral} />
          <GBranch>{[
            <div key="ch">
              <GNode name="Chapter" note="your situation" tone={PHASE_TONE} />
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

// a reference pill next to the tabs (Guide · Arcs): its colour, filled while it shows
const ViewPill = ({ on, label, tone, n, onClick }: { on: boolean; label: string; tone: Tone; n?: number; onClick: () => void }) => (
  <button type="button" aria-pressed={on} aria-label={n ? `${label} · ${n}` : label} onClick={() => { if (!on) onClick(); }}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px 0 10px", boxSizing: "border-box" as const,
      borderRadius: 14, border: `1px solid ${on ? tone.ink : tone.mid}`,
      background: on ? tone.fill : tone.wash, color: tone.ink,
      boxShadow: on ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
      fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", lineHeight: 1, whiteSpace: "nowrap" as const,
      cursor: on ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }}>
    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tone.mid, border: `1.5px solid ${tone.ink}`, boxSizing: "border-box" as const }} />
    {label}
    {!!n && (
      <span style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, boxSizing: "border-box" as const, background: C.white,
        color: tone.ink, fontSize: 10, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
    )}
  </button>
);

export default function PlannerConcept({ planner, view, isMobile, onAccount }: PlannerConceptProps) {
  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const arcs   = planner.arcs.filter(a => a.account === acc).sort((a, b) => a.num - b.num);
  const basePh = planner.phases.find(p => p.account === acc && isBasePhase(p));
  const blocks = basePh?.eras || [];
  const accLabel = ACCOUNTS.find(a => a.key === acc)?.label || `@${acc}`;

  // Base | Phases | Arcs — opens on the tab you had last (remembered on this device)
  const [show, setShow] = useState<ConceptView>(loadView);
  const pickView = (v: ConceptView) => { setShow(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };
  // @createbylynn: its 5 pillars with their arcs (numbered 1–5 in the fixed order)
  const seriesMode = acc === "createbylynn";
  const series = arcs.filter(isSeries);              // before the pillars SQL: the old series
  const pillarArcs = arcs.filter(isPillarArc);
  const pillars = CONCEPT_PILLARS.map((p, i) => ({ ...p, n: i + 1, list: arcsOfPillar(pillarArcs, p.key) })).filter(p => p.list.length);

  // open cards, per account (Base by the block's key, arcs and phases by their number)
  const [openArcs, setOpenArcs] = useState<OpenMap>(() => loadMap(OPEN_KEY));
  const [openBs,   setOpenBs]   = useState<OpenKeys>(() => { try { localStorage.removeItem(OLD_BS_KEY); } catch { /* ignore */ } return loadMap(OPEN_BS_KEY); });
  const bsKeys  = (openBs[acc] || []).filter(k => typeof k === "string");
  const setBsOpen = (keys: string[]) => { const m = { ...openBs, [acc]: keys }; setOpenBs(m); saveMap(OPEN_BS_KEY, m); };
  const toggleBs  = (k: string) => setBsOpen(bsKeys.includes(k) ? bsKeys.filter(x => x !== k) : [...bsKeys, k]);
  const anyBsOpen = blocks.some(b => bsKeys.includes(b.key));
  const arcNums = openArcs[acc] || [];
  const setArcsOpen = (nums: number[]) => { const m = { ...openArcs, [acc]: nums }; setOpenArcs(m); saveMap(OPEN_KEY, m); };
  const toggleArc   = (n: number) => setArcsOpen(arcNums.includes(n) ? arcNums.filter(x => x !== n) : [...arcNums, n]);
  const anyArcOpen  = arcs.some(a => arcNums.includes(a.num));
  // @createbylynn: the open pillars, by their key (per account)
  const [openPls, setOpenPls] = useState<OpenKeys>(() => loadMap(OPEN_PL_KEY));
  const plKeys    = (openPls[acc] || []).filter(k => typeof k === "string");
  const setPlsOpen = (keys: string[]) => { const m = { ...openPls, [acc]: keys }; setOpenPls(m); saveMap(OPEN_PL_KEY, m); };
  const togglePl  = (k: string) => setPlsOpen(plKeys.includes(k) ? plKeys.filter(x => x !== k) : [...plKeys, k]);
  const anyPlOpen = pillars.some(p => plKeys.includes(p.key));
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
  // expand all / collapse all: every pillar and every arc (an arc's fold id is "pa:" + its id)
  const togglePillarsAll = () => {
    const arcIds = pillarArcs.map(a => `pa:${a.id}`);
    const nextFold = anyPlOpen ? Array.from(new Set([...foldList, ...arcIds])) : foldList.filter(x => !arcIds.includes(x));
    const m = { ...folded, [acc]: nextFold }; setFolded(m); saveMap(FOLD_KEY, m);
    setPlsOpen(anyPlOpen ? [] : pillars.map(p => p.key));
  };

  // the window: one arc's texts or links, one era's or block's arcs, or one block's lines
  const [win, setWin] = useState<Win | null>(null);
  const winArc   = win && (win.kind === "texts" || win.kind === "links") ? planner.arcs.find(a => a.id === win.id) : undefined;
  const winPhase = win && (win.kind === "era" || win.kind === "block") ? planner.phases.find(p => p.id === win.id) : undefined;
  const winEra   = win && (win.kind === "era" || win.kind === "block") ? winPhase?.eras.find(e => e.key === win.era) : undefined;
  const winOk    = !!win && (win.kind === "era" || win.kind === "block" ? !!winEra : !!winArc);
  useEffect(() => { if (win && !winOk && !planner.loading) setWin(null); }, [win, winOk, planner.loading]);
  const close = () => setWin(null);
  const done  = <SheetButton onClick={close}>Done</SheetButton>;
  // a series of the Look arc has labels, every other one (and every arc) texts
  const winLabels = !!winArc && isSeries(winArc) && seriesWord(winArc) === "labels";
  // a window's title: "1. Home · Coming home" · "Base · 1. Signatures" (the numbers the page shows)
  const eraTitle = (ph: ConceptPhase, e: ConceptEra) =>
    isBasePhase(ph) ? `Base · ${ph.eras.indexOf(e) + 1}. ${e.name}` : `${conceptPhaseLabel(ph)} · ${e.name}`;

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
  const arcMarks = legend([{ mark: swatch(ARC_TONE, true), label: "arc" }, { mark: swatch(PAL.neutral, true), label: "optional arc" }]);
  const empty = (title: string, text: string) => (
    <div style={{ ...cardBox, padding: "14px 12px" }}>
      <div style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black }}>{title}</div>
      <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
  const note = (text: string, color: string = C.muted) => <p style={{ fontSize: SPACING.plannerText, color, marginTop: 16 }}>{text}</p>;

  const arcsView = planner.conceptError ? note(planner.conceptError, C.red) : (
    <>
      <SectionHead dot={ARC_TONE.mid} label={`Arcs · ${arcs.length}`}
        right={arcs.length ? <button onClick={() => setArcsOpen(anyArcOpen ? [] : arcs.map(a => a.num))} style={mini}>{anyArcOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!arcs.length
        ? empty(`No arcs for ${accLabel} yet`, "They're added here once its concept is mapped, in the same layout: numbered arcs, formats, platforms, texts and links.")
        : columns(arcs, a => <ArcCard key={a.id} arc={a} open={arcNums.includes(a.num)} onToggle={() => toggleArc(a.num)} onOpen={kind => setWin({ kind, id: a.id })} />)}
      {anyArcOpen && legend([
        { mark: <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink2 }} />, label: "main format" },
        { mark: swatch(PLATFORM_TONE.TikTok), label: "TikTok" },
        { mark: swatch(PLATFORM_TONE.Instagram), label: "Instagram" },
      ])}
    </>
  );

  // Base: the 6 blocks (planner.ts) with their arcs; each block's lines come from the data (the
  // Base phase, found by the block's name) — shown under the arcs, "edit" opens them
  const norm = (t: string) => t.trim().toLowerCase().replace(/[’']/g, "'");
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
      <SectionHead dot={BASE_TONE.mid} label={`Base · ${BASE_BLOCKS.length}`}
        right={<button onClick={() => setChsOpen(anyBaseOpen ? chKeys.filter(k => !k.startsWith("base:")) : Array.from(new Set([...chKeys, ...BASE_BLOCKS.map(baseKey)])))} style={mini}>{anyBaseOpen ? "collapse all" : "expand all"}</button>} />
      {columns(BASE_BLOCKS, c => {
        const b = blockOf(c);
        return <ChapterCard key={c.name} n={BASE_BLOCKS.indexOf(c) + 1} item={c} arcs={arcs} tone={BASE_TONE}
          open={chKeys.includes(baseKey(c))} onToggle={() => toggleCh(baseKey(c))}
          onEdit={b && basePh ? () => setWin({ kind: "block", id: basePh.id, era: b.key }) : undefined} extra={baseLines(c)} />;
      })}
    </>
  );

  // Personal Eras and the Main Areas' chapters (planner.ts): a card with arcs opens to show them,
  // one without stays a placeholder ("empty"). Open ones are remembered by "<tab>:<name>".
  const chapterList = (tab: string, dot: string, label: string, list: StructItem[], tone: Tone) => {
    const key = (c: StructItem) => `${tab}:${c.name}`;
    const filled = list.filter(c => c.arcs?.length);
    const anyOpen = filled.some(c => chKeys.includes(key(c)));
    return (
      <>
        <SectionHead dot={dot} label={`${label} · ${list.length}`}
          right={filled.length ? <button onClick={() => setChsOpen(anyOpen ? chKeys.filter(k => !filled.map(key).includes(k)) : Array.from(new Set([...chKeys, ...filled.map(key)])))} style={mini}>{anyOpen ? "collapse all" : "expand all"}</button> : undefined} />
        {columns(list, c => {
          const n = list.indexOf(c) + 1;
          return c.arcs?.length
            ? <ChapterCard key={c.name} n={n} item={c} arcs={arcs} tone={tone} open={chKeys.includes(key(c))} onToggle={() => toggleCh(key(c))} />
            : <PlaceholderCard key={c.name} n={n} item={c} tone={tone} />;
        })}
      </>
    );
  };
  const erasView = chapterList("eras", PAL.lynnhoa.mid, "Personal Eras", PERSONAL_ERAS, PAL.lynnhoa);
  const area     = MAIN_AREAS.find(a => a.key === show);
  const areaView = area ? chapterList(area.key, PHASE_TONE.mid, `${area.title} · Chapters`, area.chapters, PHASE_TONE) : null;

  // @createbylynn: the 5 pillars, numbered cards (phone one column · iPad / computer two)
  // the Guide: 4 cards, read only (planner.ts)
  const guideView = (
    <>
      <SectionHead dot={GUIDE_TONE.mid} label={`Guide · ${GUIDE_CARDS.length}`}
        right={<button onClick={() => setGdOpen(anyGdOpen ? [] : GUIDE_CARDS.map(c => c.key))} style={mini}>{anyGdOpen ? "collapse all" : "expand all"}</button>} />
      {columns(GUIDE_CARDS, c => (
        <GuideCard key={c.key} n={GUIDE_CARDS.indexOf(c) + 1} card={c} open={gdKeys.includes(c.key)} onToggle={() => toggleGd(c.key)}>
          <GuideBody k={c.key} arcsCount={arcs.length} />
        </GuideCard>
      ))}
    </>
  );

  const pillarView = planner.conceptError ? note(planner.conceptError, C.red) : (
    <>
      <SectionHead dot={ARC_TONE.mid} label={`Pillars · ${pillars.length}`}
        right={pillars.length ? <button onClick={togglePillarsAll} style={mini}>{anyPlOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!pillars.length
        ? empty(`No pillars for ${accLabel} yet`, series.length
            ? "Run the @createbylynn pillars SQL in Supabase once: it turns your series into the 5 pillars with their arcs (your texts, links and ideas come along)."
            : "Run the @createbylynn concept SQL and then the pillars SQL in Supabase once.")
        : columns(pillars, p => (
            <PillarCard key={p.key} n={p.n} label={p.label} note={p.note} arcs={p.list} open={plKeys.includes(p.key)}
              onToggle={() => togglePl(p.key)} onOpen={(a, kind) => setWin({ kind, id: a.id })} />
          ))}
    </>
  );

  return (
    <FoldCtx.Provider value={fold}>
    <div>
      <TabTitle title="Content concept" acc={acc} onAccount={onAccount} isMobile={isMobile} />
      <Subtitle text={seriesMode ? "What each post is about" : SUBTITLE[show]} />
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: "8px 12px" }}>
        {seriesMode
          ? <ViewSwitch options={CBL_VIEWS} value="pillars" onPick={() => { /* one tab */ }} label="Show" />
          : <ViewSwitch options={VIEWS} value={show} onPick={pickView} label="Show" />}
        {!seriesMode && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ViewPill on={show === "guide"} label="Guide" tone={GUIDE_TONE} onClick={() => pickView("guide")} />
            <ViewPill on={show === "arcs"} label="Arcs" tone={ARC_TONE} n={arcs.length} onClick={() => pickView("arcs")} />
          </span>
        )}
      </div>

      {planner.loading ? note("Loading…") : seriesMode ? pillarView : show === "guide" ? guideView : show === "base" ? baseView : show === "eras" ? erasView : areaView || arcsView}

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

      {/* an era's or a Base block's arcs, in posting order — the same arcs, texts and links as the Arcs tab */}
      {win && win.kind === "era" && winPhase && winEra && (
        <Sheet title={eraTitle(winPhase, winEra)} onClose={close} footer={done}>
          <EraSheet key={`${winPhase.id}-${winEra.key}-${win.focus ?? ""}`} planner={planner} phase={winPhase} era={winEra} focus={win.focus} />
        </Sheet>
      )}

      {/* a Base block's lines: one list per section, saved right away (Undo on ✕) */}
      {win && win.kind === "block" && winPhase && winEra && (
        <Sheet title={eraTitle(winPhase, winEra)} onClose={close} footer={done}>
          {(winEra.sections.length ? winEra.sections : [{ name: "", lines: [] as string[] }]).map((x, k) => (
            <div key={`${k}-${x.name}`}>
              <WinHead first={k === 0} icon={IC.list} tone={BASE_TONE} label={count(x.name || "Lines", x.lines.length)} />
              <div style={winCard}>
                <LineList key={`bl-${winEra.key}-${k}`} initial={x.lines} marker="bullets" placeholder="A line · how it shows" addLabel="Add a line"
                  onSave={lines => { quiet(planner.updateBlockLines(winPhase.id, winEra.key, k, lines)); }} />
              </div>
            </div>
          ))}
        </Sheet>
      )}
    </div>
    </FoldCtx.Provider>
  );
}
