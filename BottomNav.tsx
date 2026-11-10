// ─────────────────────────────────────────────────────────────
// BottomNav — the floating bottom bar (like Lynn's Office), shared by
// Planner › Concept (five tabs) and Outreach › Email kit (two pages).
// A white pill, one item per tab: its icon on its own pastel circle; the
// open one filled with its colour, its label in its ink. Five items fill the
// bar (up to 440 px); two or three sit narrow in the middle (98 px each).
// The page fades out under the bar; the "saved" toast moves up above it.
// ─────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { C, SANS } from "./constants";

export type NavTone = { fill?: string; wash: string; mid?: string; ink: string };
export type NavItem = { key: string; label: string; title: string; icon: string; tone: NavTone };

export const NAV_SPACE = 96;   // room under the page so the last card isn't behind the bar

export const NavIcon = ({ d, size = 18, color, fill = "none" }: { d: string; size?: number; color: string; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, color }}
    fill={fill} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export function BottomNav({ items, value, onPick, label }: { items: NavItem[]; value: string; onPick: (k: string) => void; label: string }) {
  useEffect(() => {   // the "saved" toast sits above the bar (and above "Deleted · Undo", which sits on the bar)
    const root = document.documentElement.style;
    root.setProperty("--toast-lift", "calc(110px + env(safe-area-inset-bottom, 0px))");
    return () => { root.removeProperty("--toast-lift"); };
  }, []);
  const narrow = items.length <= 3;   // two or three: centred, not stretched
  return (
    <>
    {/* the page fades out under the bar, so no text shows around it */}
    <div aria-hidden="true" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 39, pointerEvents: "none",
      height: "calc(92px + env(safe-area-inset-bottom, 0px))", background: `linear-gradient(180deg, rgba(250,249,247,0) 0%, ${C.bg} 55%)` }} />
    <nav aria-label={label} style={{ position: "fixed", left: 14, right: 14, bottom: "calc(14px + env(safe-area-inset-bottom, 0px))", zIndex: 40,
      maxWidth: narrow ? items.length * 98 : 440, margin: "0 auto", display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      padding: 5, borderRadius: 999, background: C.white, boxShadow: "0 4px 18px rgba(0,0,0,0.10)" }}>
      {items.map(t => {
        const on = t.key === value, tone = t.tone;
        return (
          <button key={t.key} type="button" aria-label={t.title} aria-current={on ? "page" : undefined} onClick={() => { if (!on) onPick(t.key); }}
            style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 2, height: 56, margin: "0 2px", border: 0,
              borderRadius: 999, background: on ? tone.wash : "transparent", color: on ? tone.ink : C.muted, fontFamily: SANS, fontSize: 11,
              fontWeight: on ? 600 : 400, cursor: on ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: on ? C.white : tone.wash, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <NavIcon d={t.icon} size={17} color={tone.ink} />
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
    </>
  );
}
