// ─────────────────────────────────────────────────────────────
// BusinessParts — the pieces every Business tab shares, built only
// from the app's own parts (ListCard, SwitchPill, the line icons):
//   YearStrip  under each tab's title, the same in all tabs (like
//              Maintenance's strip): ‹ year › · the year's costs of all
//              tabs · what counts. (PDF · Invoices · Excel join it in
//              the export build.)
//   ComingCard a tab that comes with a later build.
// ─────────────────────────────────────────────────────────────

import { C, SANS, TYPE, SPACING } from "./constants";
import { ListCard, SwitchPill } from "./atoms";
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
};

// § 19 on (the profile's switch; on unless switched off — like the Manager dashboard)
export const kuOf = (settings: any) => settings?.kleinunternehmer !== false && settings?.kleinunternehmer !== "false";

export function YearStrip({ years, year, setYear, total, counted }: {
  years: number[]; year: number; setYear: (y: number) => void; total: number; counted: number;
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
    </ListCard>
  );
}

export const ComingCard = ({ title, text }: { title: string; text: string }) => (
  <ListCard s={{ marginTop: 12, padding: "18px 14px", textAlign: "center" as const }}>
    <div style={{ fontSize: SPACING.listText, fontFamily: SANS }}>{title}</div>
    <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 3, fontFamily: SANS, lineHeight: 1.5 }}>{text}</div>
  </ListCard>
);
