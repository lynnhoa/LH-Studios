// ─────────────────────────────────────────────────────────────
// PlannerConcept — Planner › Content concept, opened from the
// profile menu ("@lynnhoa concept" / "@createbylynn concept").
//   Base | Phases | Arcs: a switch under the title. It always opens on Arcs.
//   Base (sage): what's always there, under every phase — one card per block
//   (Signatures, Today's look …), numbered. Open: what it is, its lines in
//   sections (Signatures: Rituals · Things · How you look · Rules) — the label
//   black, how it shows in grey — and its core arcs. "lines · 20" small in the
//   top right opens one window to add, change, delete them (Undo, saved right away).
//   Arcs (pastel blue): one card per arc, numbered top to bottom. Tap an
//   arc to open or close it. Open: its purpose, its formats with the
//   TikTok / Instagram ticks, and "texts · links" small in the top right —
//   one window each (add, change, delete with Undo, saved right away).
//   Phases (butter): Home, Occasion, Invited … one card each. Open: its purpose
//   and its eras, under their group headings ("Moments", "On you" …).
//   Tap an era: one window with the era's
//   core arcs in posting order (optional ones last, in grey), as cards —
//   all closed when it opens; tap one to open it. Each arc there IS the arc
//   of the Arcs view — same purpose, formats, texts and links, edited right
//   there (no jump to Arcs), so a change shows on both.
//   "collapse all / expand all" next to Arcs / Phases. Open cards are
//   remembered on this device; the first time, all are closed.
// @createbylynn (no phases): Hair | Makeup & skincare | Both under the title (remembered on
//   this device). One section per arc (Look · Product · Personality · Editorial), one card
//   per series, numbered 1, 2, 3 … in each arc. Open: what the series is and its labels (Look)
//   or texts — a journey's texts start with their step ("1 · …"), views stay grey ("(1.531)").
//   "labels · 9" / "texts · 6" and "links" open the same window as an arc's texts and links.
// Arcs, series, purpose, formats, ticks, phases and eras come from the SQL (fixed).
// Phone: one column · iPad / computer: two columns (first half left).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, TRACK, SHADOW, ICON, PAL } from "./constants";
import { SectionHead, Sheet, SheetButton } from "./atoms";
import { ACCOUNTS, PLATFORM_TONE, platformTone, ARC_TONE, PHASE_TONE, CONCEPT_CATEGORIES, CONCEPT_ARCS, isSeries, seriesWord, seriesOf, seriesNum, phaseListWord, eraGroups, isBasePhase, blockLineCount, splitBlockLine, BASE_TONE } from "./planner";
import type { Account, ConceptArc, ConceptFormat, ConceptPhase, ConceptEra, ConceptCategory } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { IC, Subtitle, TabTitle, WinHead, winCard, LineList, LinkList } from "./PlannerWindows";

// remembered on this device: the open arcs and phases per account (none the first time)
const OPEN_KEY    = "lh_planner_concept_open";
const OPEN_PH_KEY = "lh_planner_concept_open_phases";
const OPEN_BS_KEY = "lh_planner_concept_open_base";
const CAT_KEY     = "lh_planner_concept_cat";     // @createbylynn: Hair | Makeup & skincare | Both
type OpenMap = Partial<Record<Account, number[]>>;
type ConceptView = "base" | "phases" | "arcs";
const loadMap = (key: string): OpenMap => {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); if (v && typeof v === "object") return v; } catch { /* ignore */ }
  return {};
};
const saveMap = (key: string, m: OpenMap) => { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ } };
const loadCat = (): ConceptCategory => {
  try { const v = localStorage.getItem(CAT_KEY); return v === "makeup" || v === "both" ? v : "hair"; } catch { return "hair"; }
};

const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

const NUM    = 24;              // the number circle of an arc or a phase
const GAP    = 9;
const INDENT = NUM + GAP;       // purpose, formats and eras line up with the card's name
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

// "Formats · TT · IG" and one row per format (the arc card and the era window)
const Formats = ({ formats }: { formats: ConceptFormat[] }) => (
  <>
    <div style={{ display: "flex", alignItems: "center", height: 22 }}>
      <span style={{ ...caps, flex: 1, color: C.light }}>Formats</span>
      <span style={{ ...caps, width: COL, textAlign: "center" as const, color: PLATFORM_TONE.TikTok.ink }} title="TikTok">TT</span>
      <span style={{ ...caps, width: COL, textAlign: "center" as const, color: PLATFORM_TONE.Instagram.ink }} title="Instagram">IG</span>
    </div>
    {formats.map((f, k) => <FormatRow key={k} f={f} />)}
  </>
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
const Caret = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
  <span aria-hidden="true" onClick={onClick}
    style={{ width: COL, minHeight: SPACING.row1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ICON.caret, color: C.faint, flexShrink: 0, cursor: "pointer" }}>
    {open ? "▴" : "▾"}
  </span>
);

// one arc: number · name · (open: texts · links) · ▾ — open: purpose and formats
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
        <div style={{ padding: `0 6px 6px ${SPACING.rowSide}px` }}>
          {arc.purpose && <div style={{ margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 }}>{arc.purpose}</div>}
          <div style={{ margin: `8px 0 0 ${INDENT}px` }}><Formats formats={arc.formats} /></div>
        </div>
      )}
    </div>
  );
}

// one line of a series (read only — written in its window): a dot, or the step of a journey
// ("1 · …" → a small 1), the text, and views in grey at the end ("(1.531)")
const LineRow = ({ t }: { t: string }) => {
  const st = t.match(/^(\d)\s*·\s*(.+)$/);
  const body = st ? st[2] : t;
  const v = body.match(/^(.*?)\s*\((\d[\d.,]*)\)$/);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: GAP, borderTop: `1px solid ${C.hair}`, padding: "8px 0" }}>
      {st
        ? <span aria-label={`Step ${st[1]}`} style={{ width: 16, height: 16, borderRadius: "50%", background: ARC_TONE.wash, color: ARC_TONE.ink, fontSize: TYPE.micro.size, fontWeight: 500,
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{st[1]}</span>
        : <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.faint, flexShrink: 0, marginTop: 5 }} />}
      <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.listText, lineHeight: 1.35, color: C.black, overflowWrap: "anywhere" as const }}>
        {v ? v[1] : body}{v && <span style={{ color: C.muted }}> ({v[2]})</span>}
      </span>
    </div>
  );
};

// one series (@createbylynn): number · name · (open: labels / texts · links) · ▾ — open: what it is and its lines
function SeriesCard({ s, n, open, onToggle, onOpen }: { s: ConceptArc; n: number; open: boolean; onToggle: () => void; onOpen: (kind: "texts" | "links") => void }) {
  const word = seriesWord(s), Word = word === "labels" ? "Labels" : "Texts";
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${s.name}`} style={headBtn}>
          <NumCircle n={n} tone={ARC_TONE} />
          <span style={nameText}>{s.name}</span>
        </button>
        {open && (
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={() => onOpen("texts")} aria-label={`${Word} of ${s.name}`} style={mini}>{count(word, s.texts.length)}</button>
            <button onClick={() => onOpen("links")} aria-label={`Links of ${s.name}`} style={mini}>{count("links", s.links.length)}</button>
          </span>
        )}
        <Caret open={open} onClick={onToggle} />
      </div>
      {open && (
        <div style={{ padding: `0 6px 8px ${SPACING.rowSide}px` }}>
          {s.purpose && <div style={{ margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 }}>{s.purpose}</div>}
          {s.texts.length > 0 && (
            <div style={{ margin: `8px 0 0 ${INDENT}px` }}>
              <div style={{ display: "flex", alignItems: "center", height: 22 }}><span style={{ ...caps, color: C.light }}>{Word}</span></div>
              {s.texts.map((t, k) => <LineRow key={k} t={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// an era's core arcs and its optional ones: "4" or "4 + 1"
const eraCount = (e: ConceptEra) => {
  const core = e.arcs.filter(a => !a.optional).length, opt = e.arcs.length - core;
  return { core, opt, label: opt ? `${core} + ${opt}` : String(core) };
};

// one phase: number · name · ▾ — open: purpose and its eras under their group headings (tap one: its arcs)
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
        <div style={{ padding: `0 6px 6px ${SPACING.rowSide}px` }}>
          {phase.purpose && <div style={{ margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 }}>{phase.purpose}</div>}
          <div style={{ margin: `8px 0 0 ${INDENT}px` }}>
            <div style={{ display: "flex", alignItems: "center", height: 22 }}>
              <span style={{ ...caps, flex: 1, color: C.light }}>{count(phaseListWord(phase), phase.eras.length)}</span>
              <span style={{ ...caps, color: C.light, paddingRight: 22 }}>Arcs</span>
            </div>
            {groups.map((g, gi) => (
            <div key={g.grp ?? `g${gi}`}>
            {g.grp && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 30, paddingTop: gi ? 8 : 0, borderTop: `1px solid ${C.hair}` }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: PHASE_TONE.mid, flexShrink: 0 }} />
                <span style={{ ...caps, color: PAL.neutral.ink }}>{g.grp}</span>
              </div>
            )}
            {g.eras.map(e => {
              const n = eraCount(e);
              return (
                <button key={e.key} onClick={() => onEra(e)}
                  aria-label={`${e.name}: ${n.core} arcs${n.opt ? ` and ${n.opt} optional` : ""}`}
                  style={{ width: "100%", display: "flex", alignItems: "center", minHeight: SPACING.row1, padding: "5px 0", background: "none", border: "none",
                    borderTop: `1px solid ${C.hair}`, cursor: "pointer", fontFamily: SANS, textAlign: "left" as const, color: C.black, WebkitTapHighlightColor: "transparent" }}>
                  <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink2, flexShrink: 0, marginRight: GAP }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: SPACING.listText, fontWeight: 500, lineHeight: 1.3 }}>{e.name}</span>
                    {e.desc && <span style={{ display: "block", fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.35, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc}</span>}
                  </span>
                  <span style={{ fontSize: SPACING.listMeta, color: C.muted, whiteSpace: "nowrap" as const, paddingLeft: 8 }}>{n.label}</span>
                  <span aria-hidden="true" style={{ width: 22, textAlign: "center" as const, color: C.faint, fontSize: 15, flexShrink: 0 }}>›</span>
                </button>
              );
            })}
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

const listHead: any = { ...caps, color: C.light, padding: "8px 10px 2px", borderTop: `1px solid ${C.hair}` };

// One era's window: its arcs as cards in posting order, all closed when it opens (tap one to
// open it; "expand all" next to the era's line). An open arc shows the arc itself — purpose,
// formats, texts and links — and its texts and links are edited right here (saved on the arc).
// a Base line, read only: the label, and how it shows in grey under it
const BlockLineRow = ({ t }: { t: string }) => {
  const [label, rest] = splitBlockLine(t);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: GAP, borderTop: `1px solid ${C.hair}`, padding: "8px 0" }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.faint, flexShrink: 0, marginTop: 6 }} />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" as const }}>
        <span style={{ display: "block", fontSize: SPACING.listText, color: C.black, lineHeight: 1.35 }}>{label}</span>
        {rest && <span style={{ display: "block", fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4, marginTop: 1 }}>{rest}</span>}
      </span>
    </div>
  );
};

// one Base block: number · name · (open: lines) · ▾ — open: what it is, its lines in sections, its core arcs
function BlockCard({ block, n, arcs, open, onToggle, onLines }: { block: ConceptEra; n: number; arcs: ConceptArc[]; open: boolean; onToggle: () => void; onLines: () => void }) {
  const total = blockLineCount(block);
  const sub: any = { ...caps, color: C.light, display: "flex", alignItems: "center", height: 22 };
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${n}. ${block.name}`} style={headBtn}>
          <NumCircle n={n} tone={BASE_TONE} />
          <span style={nameText}>{block.name}</span>
        </button>
        {open && <button onClick={onLines} aria-label={`Lines of ${block.name}`} style={{ ...mini, flexShrink: 0 }}>{count("lines", total)}</button>}
        <Caret open={open} onClick={onToggle} />
      </div>
      {open && (
        <div style={{ padding: `0 6px 8px ${SPACING.rowSide}px` }}>
          {block.desc && <div style={{ margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 }}>{block.desc}</div>}
          <div style={{ margin: `8px 22px 0 ${INDENT}px` }}>
            {block.sections.filter(x => x.lines.length).map((x, k) => (
              <div key={`${k}-${x.name}`} style={{ marginTop: k ? 6 : 0 }}>
                <div style={sub}>{count(x.name || "Lines", x.lines.length)}</div>
                {x.lines.map((t, i) => <BlockLineRow key={i} t={t} />)}
              </div>
            ))}
            {!total && (
              <button onClick={onLines} style={{ display: "block", width: "100%", textAlign: "left" as const, background: "none", border: "none", borderTop: `1px solid ${C.hair}`,
                padding: "10px 0", fontFamily: SANS, fontSize: SPACING.listText, color: C.light, cursor: "pointer" }}>+ Add a line</button>
            )}
            {block.arcs.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={sub}>Core arcs</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                  {block.arcs.map(ea => {
                    const a = arcs.find(x => x.num === ea.num);
                    return (
                      <span key={ea.num} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: ARC_TONE.wash, color: ARC_TONE.ink, borderRadius: RADIUS.tag, padding: "3px 8px 3px 3px", fontSize: SPACING.listMeta }}>
                        <NumCircle n={ea.num} tone={{ ...ARC_TONE, wash: C.white }} size={16} />
                        {a ? a.name.replace(/^The /, "") : `Arc ${ea.num}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EraSheet({ planner, phase, era }: { planner: PlannerHook; phase: ConceptPhase; era: ConceptEra }) {
  const [open, setOpen] = useState<number[]>([]);
  const anyOpen = open.length > 0;
  const toggle  = (n: number) => setOpen(o => (o.includes(n) ? o.filter(x => x !== n) : [...o, n]));
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, margin: "2px 2px 10px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: TYPE.subtext.size, color: C.muted, lineHeight: 1.4 }}>{era.desc}</span>
        <button onClick={() => setOpen(anyOpen ? [] : era.arcs.map(a => a.num))} style={{ ...mini, marginTop: -6 }}>{anyOpen ? "collapse all" : "expand all"}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: SPACING.gridGap }}>
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
                  <div style={{ padding: `0 6px 6px ${SPACING.rowSide}px` }}>
                    {arc.purpose && <div style={{ margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 }}>{arc.purpose}</div>}
                    <div style={{ margin: `8px 0 0 ${INDENT}px` }}><Formats formats={arc.formats} /></div>
                  </div>
                  <div style={listHead}>{count("Texts", arc.texts.length)}</div>
                  <LineList key={`et-${era.key}-${arc.id}`} initial={arc.texts} marker="bullets" placeholder="Write a text" addLabel="Add a text"
                    onSave={lines => { quiet(planner.updateArc(arc.id, { texts: lines })); }} />
                  <div style={listHead}>{count("Links", arc.links.length)}</div>
                  <LinkList key={`el-${era.key}-${arc.id}`} initial={arc.links} pillTone={platformTone}
                    onSave={links => { quiet(planner.updateArc(arc.id, { links })); }} />
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

type Win = { kind: "texts" | "links"; id: string } | { kind: "era" | "block"; id: string; era: string };

export default function PlannerConcept({ planner, view, isMobile, onAccount }: PlannerConceptProps) {
  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const arcs   = planner.arcs.filter(a => a.account === acc).sort((a, b) => a.num - b.num);
  const phases = planner.phases.filter(p => p.account === acc && !isBasePhase(p)).sort((a, b) => a.num - b.num);
  const basePh = planner.phases.find(p => p.account === acc && isBasePhase(p));
  const blocks = basePh?.eras || [];
  const accLabel = ACCOUNTS.find(a => a.key === acc)?.label || `@${acc}`;

  // Phases | Arcs — always opens on Arcs (not remembered)
  const [show, setShow] = useState<ConceptView>("arcs");
  const pickView = (v: ConceptView) => setShow(v);
  // @createbylynn: its series, by category (Hair | Makeup & skincare | Both)
  const seriesMode = acc === "createbylynn";
  const series = arcs.filter(isSeries);
  const [cat, setCat] = useState<ConceptCategory>(loadCat);
  const pickCat = (c: ConceptCategory) => { setCat(c); try { localStorage.setItem(CAT_KEY, c); } catch { /* ignore */ } };

  // open cards, per account
  const [openArcs, setOpenArcs] = useState<OpenMap>(() => loadMap(OPEN_KEY));
  const [openPhs,  setOpenPhs]  = useState<OpenMap>(() => loadMap(OPEN_PH_KEY));
  const [openBs,   setOpenBs]   = useState<OpenMap>(() => loadMap(OPEN_BS_KEY));
  const bsNums  = openBs[acc] || [];
  const setBsOpen = (nums: number[]) => { const m = { ...openBs, [acc]: nums }; setOpenBs(m); saveMap(OPEN_BS_KEY, m); };
  const toggleBs  = (n: number) => setBsOpen(bsNums.includes(n) ? bsNums.filter(x => x !== n) : [...bsNums, n]);
  const anyBsOpen = blocks.some((_, k) => bsNums.includes(k + 1));
  const arcNums = openArcs[acc] || [];
  const phNums  = openPhs[acc] || [];
  const setArcsOpen = (nums: number[]) => { const m = { ...openArcs, [acc]: nums }; setOpenArcs(m); saveMap(OPEN_KEY, m); };
  const setPhsOpen  = (nums: number[]) => { const m = { ...openPhs, [acc]: nums }; setOpenPhs(m); saveMap(OPEN_PH_KEY, m); };
  const toggleArc   = (n: number) => setArcsOpen(arcNums.includes(n) ? arcNums.filter(x => x !== n) : [...arcNums, n]);
  const togglePh    = (n: number) => setPhsOpen(phNums.includes(n) ? phNums.filter(x => x !== n) : [...phNums, n]);
  const anyArcOpen  = arcs.some(a => arcNums.includes(a.num));
  const anyPhOpen   = phases.some(p => phNums.includes(p.num));
  // @createbylynn: the open series are kept with the arcs (a series' number is unique on the account)
  const catSeries   = series.filter(x => x.category === cat);
  const anySerOpen  = catSeries.some(x => arcNums.includes(x.num));
  const toggleCatAll = () => setArcsOpen(anySerOpen
    ? arcNums.filter(n => !catSeries.some(x => x.num === n))
    : [...arcNums, ...catSeries.map(x => x.num).filter(n => !arcNums.includes(n))]);

  // the window: one arc's texts or links, or one era with its arcs
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
  const swatch = (t: { wash: string; mid: string }) => (
    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, boxSizing: "border-box" as const, background: t.wash, border: `1.5px solid ${t.mid}`, flexShrink: 0 }} />
  );
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
      {arcs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: "6px 14px", fontSize: SPACING.listMeta, color: C.muted, margin: `${SPACING.cardGap}px 2px 0` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink2 }} />main format</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{swatch(PLATFORM_TONE.TikTok)}TikTok</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{swatch(PLATFORM_TONE.Instagram)}Instagram</span>
        </div>
      )}
    </>
  );

  const baseView = planner.phasesError ? note(planner.phasesError, C.red) : (
    <>
      <SectionHead dot={BASE_TONE.mid} label={`Base · ${blocks.length}`}
        right={blocks.length ? <button onClick={() => setBsOpen(anyBsOpen ? [] : blocks.map((_, k) => k + 1))} style={mini}>{anyBsOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!basePh || !blocks.length
        ? empty(`No base for ${accLabel} yet`, "Run the @lynnhoa concept base SQL in Supabase once: it adds the base blocks with their lines.")
        : columns(blocks, b => {
            const n = blocks.indexOf(b) + 1;
            return <BlockCard key={b.key} block={b} n={n} arcs={arcs} open={bsNums.includes(n)} onToggle={() => toggleBs(n)} onLines={() => setWin({ kind: "block", id: basePh.id, era: b.key })} />;
          })}
      {blocks.length > 0 && (
        <div style={{ fontSize: SPACING.listMeta, color: C.muted, margin: `${SPACING.cardGap}px 2px 0`, lineHeight: 1.4 }}>
          Always there, under every phase · lines opens them to add or change
        </div>
      )}
    </>
  );

  const phasesView = planner.phasesError ? note(planner.phasesError, C.red) : (
    <>
      <SectionHead dot={PHASE_TONE.mid} label={`Phases · ${phases.length}`}
        right={phases.length ? <button onClick={() => setPhsOpen(anyPhOpen ? [] : phases.map(p => p.num))} style={mini}>{anyPhOpen ? "collapse all" : "expand all"}</button> : undefined} />
      {!phases.length
        ? empty(`No phases for ${accLabel} yet`, "They're added here once its concept is mapped: phases, their eras and each era's arcs.")
        : columns(phases, p => <PhaseCard key={p.id} phase={p} open={phNums.includes(p.num)} onToggle={() => togglePh(p.num)} onEra={e => setWin({ kind: "era", id: p.id, era: e.key })} />)}
      {phases.length > 0 && (
        <div style={{ fontSize: SPACING.listMeta, color: C.muted, margin: `${SPACING.cardGap}px 2px 0`, lineHeight: 1.4 }}>
          Tap an era for its arcs · the number = core arcs + optional
        </div>
      )}
    </>
  );

  // @createbylynn: one section per arc of the chosen category, one card per series
  const seriesView = planner.conceptError ? note(planner.conceptError, C.red) : !series.length ? (
    <div style={{ marginTop: SPACING.sectionTop }}>
      {empty(`No series for ${accLabel} yet`, "Run the @createbylynn concept SQL in Supabase once: it adds the categories, arcs and series with their first labels and texts.")}
    </div>
  ) : (
    <>
      {CONCEPT_ARCS.map(g => ({ ...g, list: seriesOf(series, cat, g.key) })).filter(g => g.list.length).map((g, gi) => (
        <div key={g.key}>
          <SectionHead dot={ARC_TONE.mid} label={`${g.label} · ${g.list.length}`}
            right={gi === 0 ? <button onClick={toggleCatAll} style={mini}>{anySerOpen ? "collapse all" : "expand all"}</button> : undefined} />
          {columns(g.list, x => (
            <SeriesCard key={x.id} s={x} n={g.list.indexOf(x) + 1} open={arcNums.includes(x.num)} onToggle={() => toggleArc(x.num)} onOpen={kind => setWin({ kind, id: x.id })} />
          ))}
        </div>
      ))}
      {!catSeries.length && note("Nothing in this category yet.")}
    </>
  );

  return (
    <div>
      <TabTitle title="Content concept" acc={acc} onAccount={onAccount} isMobile={isMobile} />
      <Subtitle text={seriesMode ? "Categories · arcs · series" : show === "base" ? "Base · lines · core arcs" : show === "phases" ? "Phases · eras · core arcs" : "Arcs · formats · texts · links"} />
      <div style={{ marginTop: 12 }}>
        {seriesMode
          ? <ViewSwitch options={CONCEPT_CATEGORIES} value={cat} onPick={pickCat} label="Category" />
          : <ViewSwitch options={VIEWS} value={show} onPick={pickView} label="Show" />}
      </div>

      {planner.loading ? note("Loading…") : seriesMode ? seriesView : show === "base" ? baseView : show === "phases" ? phasesView : arcsView}

      {/* an arc's texts or links (from the Arcs view) */}
      {win && (win.kind === "texts" || win.kind === "links") && winArc && (
        <Sheet title={`${seriesNum(planner.arcs, winArc)}. ${winArc.name}`} onClose={close} footer={done}>
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

      {/* an era: its arcs in posting order — the same arcs, texts and links as the Arcs view */}
      {win && win.kind === "era" && winPhase && winEra && (
        <Sheet title={`${winPhase.num}. ${winPhase.name} · ${winEra.name}`} onClose={close} footer={done}>
          <EraSheet key={`${winPhase.id}-${winEra.key}`} planner={planner} phase={winPhase} era={winEra} />
        </Sheet>
      )}

      {/* a Base block's lines: one list per section, saved right away (Undo on ✕) */}
      {win && win.kind === "block" && winPhase && winEra && (
        <Sheet title={`Base · ${winEra.name}`} onClose={close} footer={done}>
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
  );
}
