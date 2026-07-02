// ─────────────────────────────────────────────────────────────
// FORMATTERS — pure utility functions
// No UI. No side effects. Import anywhere.
// ─────────────────────────────────────────────────────────────

// ─── CURRENCY ────────────────────────────────────────────────
export const fmt = (n: number | null | undefined): string =>
  `€ ${Number(n || 0).toLocaleString("de-DE")}`;

// ─── DATES ───────────────────────────────────────────────────
export const today = (): string =>
  new Date().toISOString().split("T")[0];

export const fmtD = (
  d: string | null | undefined,
  german?: boolean
): string => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const mo = german
    ? ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day}. ${mo[+m - 1]} ${y}`;
};

// Add months to an ISO date string
export const addD = (d: string, days: number): string | null => {
  if (!d || !days) return null;
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
};

export const addM = (d: string, m: number): string | null => {
  if (!d || !m) return null;
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + m);
  return dt.toISOString().split("T")[0];
};

// Days remaining until a date (negative = expired)
export const dLeft = (d: string | null | undefined): number | null =>
  d
    ? Math.ceil(
        (new Date(d).getTime() - new Date().getTime()) / 864e5
      )
    : null;

// ─── IDS ─────────────────────────────────────────────────────
export const uid = (): string =>
  Math.random().toString(36).slice(2, 9);

// ─── DOCUMENT NUMBERS ────────────────────────────────────────
export const deriveContractNo = (qNo: string): string =>
  `CON-${qNo.replace(/QUO-?/i, "").trim() || "001"}`;

export const deriveInvoiceNo = (
  iNo: string | undefined,
  qNo: string
): string =>
  iNo || `INV-${qNo.replace(/QUO-?/i, "").trim() || "001"}`;

// ─── RATE CARD HELPERS ────────────────────────────────────────
// A section title is "single" if it is not a meta-section
// (packages, usage rights, exclusivity, add-ons, etc.)
export const isSingle = (t: string): boolean =>
  !["package", "usage", "excl", "add", "volume", "brand ambass", "retainer", "hosted"]
    .some(k => t.toLowerCase().includes(k));

// ─── USAGE MONTHS ────────────────────────────────────────────
// Extract usage months from a QuoteDoc
export const getUsageMo = (qd: any): number | null => {
  if (!qd) return null;
  if (qd.mo && qd.mo > 0) return qd.mo;
  const lines = qd.lines || [];
  for (const l of lines) {
    if (l.usageLabel) {
      const m = String(l.usageLabel).match(/([0-9]+)\s*month/i);
      if (m) return parseInt(m[1]);
    }
    if (l.name) {
      const m = String(l.name).match(/([0-9]+)\s*month/i);
      if (m) return parseInt(m[1]);
    }
  }
  return null;
};

// ─── STATUS COLOR ────────────────────────────────────────────
import { C } from "./constants";

export const scol = (s: string): string =>
  ({
    invoiced:   C.amber,
    contracted: C.muted,
    quoted:     C.light,
    revised:    "#b8a090",   // old-app rosewood
    production: "#8fa89a",   // old-app sage
    paid:       C.green,
    lead:       C.light,
  }[s] || C.light);

// ─── CATEGORY LABEL ──────────────────────────────────────────
export const catLabel = (cat: string): string =>
  ({
    influencer: "Brand Collaboration",
    ugc:        "UGC",
    editorial:  "Editorial",
    hotels:     "Hotels",
    Influencer: "Collab",
    UGC:        "UGC",
    Editorial:  "Editorial",
  }[cat] || cat);

// ─── INITIALS ────────────────────────────────────────────────
export const initials = (nameOrCompany: string): string => {
  const n = (nameOrCompany || "LH").trim();
  const parts = n.split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase();
};
