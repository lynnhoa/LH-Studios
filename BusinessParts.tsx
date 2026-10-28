// ─────────────────────────────────────────────────────────────
// BusinessParts — the pieces every Business tab shares, built only
// from the app's own parts (ListCard, SwitchPill, the line icons):
//   YearStrip  under each tab's title, the same in all tabs (like
//              Maintenance's strip): ‹ year › · the year's costs of all
//              tabs (receipts + the trips' meal allowance and km) · what
//              counts · PDF · Invoices · Excel (each: the whole year or a month).
//   ComingCard a tab that comes with a later build.
// ─────────────────────────────────────────────────────────────

import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { C, SANS, TYPE, SPACING, RADIUS, SHADOW, Z } from "./constants";
import { ListCard, SwitchPill, PillBtn } from "./atoms";
import { fmt } from "./formatters";

export const BizIco = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
export const BIZ_IC = {
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  back:    "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1",
  food:    "M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2 6 0 8v10",
  gift:    "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-3-6-3-6 0M12 7c2-3 6-3 6 0",
  file:    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  check:   "M20 6L9 17l-5-5",
  trip:    "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12H4zM9 7v12M15 7v12",
  event:   "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4",
  meal:    "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3",
  car:     "M5 16l1.5-5h11L19 16M4 16h16v3H4zM7.5 13.5h.01M16.5 13.5h.01",
  photo:   "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  report:  "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  down:    "M6 9l6 6 6-6",
  up:      "M6 15l6-6 6 6",
  plus:    "M12 5v14M5 12h14",
};

// § 19 on (the profile's switch; on unless switched off — like the Manager dashboard)
export const kuOf = (settings: any) => settings?.kleinunternehmer !== false && settings?.kleinunternehmer !== "false";

export function YearStrip({ years, year, setYear, total, counted, actions }: {
  years: number[]; year: number; setYear: (y: number) => void; total: number; counted: number; actions?: ReactNode;
}) {
  const i = years.indexOf(year);
  const prev = i > 0 ? years[i - 1] : undefined, next = i >= 0 && i < years.length - 1 ? years[i + 1] : undefined;
  const btn = (label: string, to: number | undefined, ch: string) => (
    <button onClick={() => to !== undefined && setYear(to)} disabled={to === undefined} aria-label={label}
      style={{ background: "none", border: "none", padding: "0 8px", height: 28, cursor: to === undefined ? "default" : "pointer", color: to === undefined ? C.faint : C.muted, fontFamily: SANS, fontSize: TYPE.body.size }}>{ch}</button>
  );
  return (
    <ListCard s={{ marginTop: 12, padding: "9px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
      <SwitchPill>{btn("Previous year", prev, "‹")}<span style={{ minWidth: 40, textAlign: "center" as const }}>{year}</span>{btn("Next year", next, "›")}</SwitchPill>
      <span style={{ flex: 1, minWidth: 120, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.35, fontFamily: SANS }}>
        All tabs <span style={{ color: C.black, fontSize: TYPE.row.size }}>{fmt(total)}</span><br />counts {fmt(counted)}
      </span>
      {actions && <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" as const }}>{actions}</span>}
    </ListCard>
  );
}

export const ComingCard = ({ title, text }: { title: string; text: string }) => (
  <ListCard s={{ marginTop: 12, padding: "18px 14px", textAlign: "center" as const }}>
    <div style={{ fontSize: SPACING.listText, fontFamily: SANS }}>{title}</div>
    <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 3, fontFamily: SANS, lineHeight: 1.5 }}>{text}</div>
  </ListCard>
);

// a pill with a small menu under it (the year or one of its months) — the menu is drawn on top of
// everything, so no card cuts it off; a choice runs right in the tap (the iPhone opens a PDF only then)
export function MenuPill({ label, busy, items }: { label: string; busy?: boolean; items: { key: string; label: string; strong?: boolean; onClick: () => void }[] }) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLSpanElement | null>(null);
  const W = 220, ROW = 34;
  const open = () => {
    const r = btn.current?.getBoundingClientRect(); if (!r) return;
    const h = Math.min(320, items.length * ROW + 8);
    const top = r.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    setBox({ top, left: Math.max(8, Math.min(window.innerWidth - W - 8, r.left)) });
  };
  return (
    <>
      <span ref={btn} style={{ display: "inline-flex" }}>
        <PillBtn dim={busy} onClick={() => { if (busy) return; if (box) setBox(null); else open(); }}>{busy ? "Making…" : label}</PillBtn>
      </span>
      {box && createPortal(
        <>
          <div onClick={() => setBox(null)} style={{ position: "fixed", inset: 0, zIndex: Z.menu - 1 }} />
          <div role="menu" style={{ position: "fixed", top: box.top, left: box.left, width: W, maxHeight: 320, overflowY: "auto" as const, background: C.white, border: `1px solid ${C.rule}`,
            borderRadius: RADIUS.tile, boxShadow: SHADOW.pop, zIndex: Z.menu, padding: "4px 0", fontFamily: SANS }}>
            {items.map(it => (
              <button key={it.key} role="menuitem" onClick={() => { setBox(null); it.onClick(); }}
                style={{ display: "block", width: "100%", textAlign: "left" as const, height: ROW, padding: "0 14px", border: "none", background: "none", cursor: "pointer",
                  fontFamily: SANS, fontSize: SPACING.menuText, color: C.black, fontWeight: it.strong ? 500 : 400, whiteSpace: "nowrap" as const }}>{it.label}</button>
            ))}
          </div>
        </>, document.body)}
    </>
  );
}
