// ─────────────────────────────────────────────────────────────
// PlannerConcept — Planner › Content concept, opened from the
// profile menu ("@lynnhoa concept" / "@createbylynn concept").
//   Base | Phases | Arcs: a switch under the title — it opens on the tab you had last
//   (remembered on this device). The line under the title says what the tab is.
//   Every card works the same: number · name · (open: its small links) · arrow. Open: what it
//   is in grey, then its lists — each under one heading (small grey caps with its count and a
//   small arrow: tap it to fold or unfold the list; what you fold stays folded on this device),
//   one row per item: a light dot, the name in black, what it is in grey, in full. Nothing is
//   shown twice: what a small link opens ("texts · links") isn't listed in the card too.
//   Base (warm grey): what's always there, under every phase — one card per block. Open: what
//   it is, its lines in sections ("label · how it shows") and its arcs as pills — tap one:
//   the block's arcs window, with that arc open. "edit" opens one window to add, change,
//   delete the lines (Undo, saved right away).
//   Phases (butter): Home, Occasion … one card each. Open: its purpose and its eras under
//   their group headings ("Moments · 3"; a phase without groups: "Eras · 3"). Each era shows
//   its arcs as small numbers (blue; optional ones grey) — tap the era: its arcs window.
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

import { useState, useEffect, createContext, useContext } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, TRACK, SHADOW, PAL } from "./constants";
import { SectionHead, Sheet, SheetButton, OpenArrow } from "./atoms";
import { ACCOUNTS, PLATFORM_TONE, platformTone, ARC_TONE, PHASE_TONE, isSeries, seriesWord, seriesNum, phaseListWord, eraGroups, isBasePhase, blockLineCount, splitBlockLine, BASE_TONE, conceptPhaseLabel, CONCEPT_PILLARS, arcsOfPillar, isPillarArc, pillarLabel } from "./planner";
import type { Account, ConceptArc, ConceptFormat, ConceptPhase, ConceptEra, ConceptEraArc } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { IC, Subtitle, TabTitle, WinHead, winCard, LineList, LinkList } from "./PlannerWindows";

// remembered on this device: the tab, and the open arcs, phases and Base blocks per account
// (none the first time)
const VIEW_KEY    = "lh_planner_concept_view";        // Base | Phases | Arcs
const OPEN_KEY    = "lh_planner_concept_open";
const OPEN_PH_KEY = "lh_planner_concept_open_phases";
const OPEN_BS_KEY = "lh_planner_concept_open_blocks"; // Base: by the block's key (no longer by its place)
const OLD_BS_KEY  = "lh_planner_concept_open_base";   // the old one, by place — cleared
const OPEN_PL_KEY = "lh_planner_concept_open_pillars"; // @createbylynn: the open pillars, by their key
const FOLD_KEY    = "lh_planner_concept_folded";      // the lists you folded inside cards (open unless folded)
type OpenMap  = Partial<Record<Account, number[]>>;
type OpenKeys = Partial<Record<Account, string[]>>;
type ConceptView = "base" | "phases" | "arcs";
const loadMap = (key: string): any => {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); if (v && typeof v === "object") return v; } catch { /* ignore */ }
  return {};
};
const saveMap = (key: string, m: object) => { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ } };
const loadView = (): ConceptView => {
  try { const v = localStorage.getItem(VIEW_KEY); return v === "base" || v === "phases" ? v : "arcs"; } catch { return "arcs"; }
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

// an era's core arcs and its optional ones (read out by the screen reader: "4 arcs and 1 optional")
const eraCount = (e: ConceptEra) => {
  const core = e.arcs.filter(a => !a.optional).length, opt = e.arcs.length - core;
  return { core, opt, label: opt ? `${core} + ${opt}` : String(core) };
};

// an era's arcs as small numbers in posting order (optional ones grey), then › (the row opens its window)
const EraArcs = ({ e }: { e: ConceptEra }) => (
  <span style={{ display: "flex", alignItems: "center", gap: 3, alignSelf: "center", flexShrink: 0, paddingLeft: 6 }}>
    {e.arcs.map((a, k) => <NumCircle key={`${a.num}-${k}`} n={a.num} tone={a.optional ? PAL.neutral : ARC_TONE} size={16} />)}
    <span aria-hidden="true" style={{ width: 22, textAlign: "center" as const, color: C.faint, fontSize: 15 }}>›</span>
  </span>
);

// one phase: number · name · arrow — open: purpose and its eras under their group headings (tap one: its arcs)
function PhaseCard({ phase, open, onToggle, onEra }: { phase: ConceptPhase; open: boolean; onToggle: () => void; onEra: (e: ConceptEra) => void }) {
  const groups = eraGroups(phase);
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${phase.num}. ${phase.name}`} style={headBtn}>
          <NumCircle n={phase.num} tone={PHASE_TONE} />
          <span style={nameText}>{phase.name}</span>
        </button>
        <Caret open={open} onClick={onToggle} />
      </div>
      {open && (
        <div style={cardBody}>
          {phase.purpose && <div style={descText}>{tidy(phase.purpose)}</div>}
          <div style={listBox}>
            {groups.map((g, gi) => (
              <div key={`${gi}-${g.grp ?? ""}`} style={{ marginTop: gi ? 6 : 0 }}>
                <FoldSection id={`ph:${phase.id}:${g.grp || "-"}`} label={g.grp || phaseListWord(phase)} n={g.eras.length}>
                  {g.eras.map(e => {
                    const n = eraCount(e);
                    return (
                      <ItemRow key={e.key} name={e.name} text={tidy(e.desc)} onClick={() => onEra(e)} right={<EraArcs e={e} />}
                        label={`${e.name}: ${n.core} arcs${n.opt ? ` and ${n.opt} optional` : ""}`} />
                    );
                  })}
                </FoldSection>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Base | Phases | Arcs (@createbylynn: Hair | Makeup & skincare | Both) — like the account switch,
// the chosen one in warm grey
const VIEWS: { key: ConceptView; label: string }[] = [{ key: "base", label: "Base" }, { key: "phases", label: "Phases" }, { key: "arcs", label: "Arcs" }];
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
  base:   "Always there, under every phase",
  phases: "Where you are, one era at a time",
  arcs:   "How each post is told",
};

export default function PlannerConcept({ planner, view, isMobile, onAccount }: PlannerConceptProps) {
  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const arcs   = planner.arcs.filter(a => a.account === acc).sort((a, b) => a.num - b.num);
  const phases = planner.phases.filter(p => p.account === acc && !isBasePhase(p)).sort((a, b) => a.num - b.num);
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
  const [openPhs,  setOpenPhs]  = useState<OpenMap>(() => loadMap(OPEN_PH_KEY));
  const [openBs,   setOpenBs]   = useState<OpenKeys>(() => { try { localStorage.removeItem(OLD_BS_KEY); } catch { /* ignore */ } return loadMap(OPEN_BS_KEY); });
  const bsKeys  = (openBs[acc] || []).filter(k => typeof k === "string");
  const setBsOpen = (keys: string[]) => { const m = { ...openBs, [acc]: keys }; setOpenBs(m); saveMap(OPEN_BS_KEY, m); };
  const toggleBs  = (k: string) => setBsOpen(bsKeys.includes(k) ? bsKeys.filter(x => x !== k) : [...bsKeys, k]);
  const anyBsOpen = blocks.some(b => bsKeys.includes(b.key));
  const arcNums = openArcs[acc] || [];
  const phNums  = openPhs[acc] || [];
  const setArcsOpen = (nums: number[]) => { const m = { ...openArcs, [acc]: nums }; setOpenArcs(m); saveMap(OPEN_KEY, m); };
  const setPhsOpen  = (nums: number[]) => { const m = { ...openPhs, [acc]: nums }; setOpenPhs(m); saveMap(OPEN_PH_KEY, m); };
  const toggleArc   = (n: number) => setArcsOpen(arcNums.includes(n) ? arcNums.filter(x => x !== n) : [...arcNums, n]);
  const togglePh    = (n: number) => setPhsOpen(phNums.includes(n) ? phNums.filter(x => x !== n) : [...phNums, n]);
  const anyArcOpen  = arcs.some(a => arcNums.includes(a.num));
  const anyPhOpen   = phases.some(p => phNums.includes(p.num));
  // @createbylynn: the open pillars, by their key (per account)
  const [openPls, setOpenPls] = useState<OpenKeys>(() => loadMap(OPEN_PL_KEY));
  const plKeys    = (openPls[acc] || []).filter(k => typeof k === "string");
  const setPlsOpen = (keys: string[]) => { const m = { ...openPls, [acc]: keys }; setOpenPls(m); saveMap(OPEN_PL_KEY, m); };
  const togglePl  = (k: string) => setPlsOpen(plKeys.includes(k) ? plKeys.filter(x => x !== k) : [...plKeys, k]);
  const anyPlOpen = pillars.some(p => plKeys.includes(p.key));
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

  const baseView = planner.phasesError ? note(planner.phasesError, C.red) : (
    <>
      <SectionHead dot={BASE_TONE.mid} label={`Base · ${blocks.length}`}
        right={blocks.length ? <button onClick={() => setBsOpen(anyBsOpen ? [] : blocks.map(b => b.key))} style={mini}>{anyBsOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!basePh || !blocks.length
        ? empty(`No base for ${accLabel} yet`, "Run the @lynnhoa concept base SQL in Supabase once: it adds the base blocks with their lines.")
        : columns(blocks, b => {
            const n = blocks.indexOf(b) + 1;
            return <BlockCard key={b.key} block={b} n={n} arcs={arcs} open={bsKeys.includes(b.key)} onToggle={() => toggleBs(b.key)}
              onLines={() => setWin({ kind: "block", id: basePh.id, era: b.key })}
              onArc={num => setWin({ kind: "era", id: basePh.id, era: b.key, focus: num })} />;
          })}
      {blocks.some(b => bsKeys.includes(b.key) && b.arcs.length > 0) && arcMarks}
    </>
  );

  const phasesView = planner.phasesError ? note(planner.phasesError, C.red) : (
    <>
      <SectionHead dot={PHASE_TONE.mid} label={`Phases · ${phases.length}`}
        right={phases.length ? <button onClick={() => setPhsOpen(anyPhOpen ? [] : phases.map(p => p.num))} style={mini}>{anyPhOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!phases.length
        ? empty(`No phases for ${accLabel} yet`, "They're added here once its concept is mapped: phases, their eras and each era's arcs.")
        : columns(phases, p => <PhaseCard key={p.id} phase={p} open={phNums.includes(p.num)} onToggle={() => togglePh(p.num)} onEra={e => setWin({ kind: "era", id: p.id, era: e.key })} />)}
      {anyPhOpen && arcMarks}
    </>
  );

  // @createbylynn: the 5 pillars, numbered cards (phone one column · iPad / computer two)
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
      <div style={{ marginTop: 12 }}>
        {seriesMode
          ? <ViewSwitch options={CBL_VIEWS} value="pillars" onPick={() => { /* one tab */ }} label="Show" />
          : <ViewSwitch options={VIEWS} value={show} onPick={pickView} label="Show" />}
      </div>

      {planner.loading ? note("Loading…") : seriesMode ? pillarView : show === "base" ? baseView : show === "phases" ? phasesView : arcsView}

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
