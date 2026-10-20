// ─────────────────────────────────────────────────────────────
// CreatorShared — small pieces the Creator tabs share (master parts only)
// ─────────────────────────────────────────────────────────────
import { C, PAL, RADIUS, DENSITY, TYPE, cardTone } from "./constants";
import type { ToneSet } from "./atoms";
import { cardKeyOfCat } from "./wsHelpers";

export const G = {
  check:  "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM8 12l3 3 5-6",
  list:   "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  video:  "M3 7h12v10H3zM15 10l6-3v10l-6-3z",
  cal:    "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  calOff: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M3 3l18 18",
};
export const Glyph = ({ d, size = 12 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const catTone = (cat: string) => cardTone(cardKeyOfCat(cat));
// status → color by meaning: done pistachio · delivered butter · created blue · not started grey
export const statusTone = (st: string, done: boolean): ToneSet =>
  done ? PAL.done : st === "Delivered" ? PAL.waiting : st === "Created" || st === "Reviewed" ? PAL.progress : PAL.neutral;
// square tick, 22 px inside a 44 px tap area
export const Tick2 = ({ on, tone, label, onClick }: { on: boolean; tone: ToneSet; label: string; onClick: () => void }) => (
  <button aria-label={label} aria-pressed={on} onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{ width: DENSITY.tap, height: DENSITY.tap, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
    <span style={{ width: DENSITY.tick, height: DENSITY.tick, borderRadius: RADIUS.check, boxSizing: "border-box" as const, border: `1.5px solid ${on ? tone.mid : C.edge}`, background: on ? tone.wash : C.white, color: tone.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: TYPE.subtext.size }}>{on ? "✓" : ""}</span>
  </button>
);
