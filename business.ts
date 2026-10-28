// ─────────────────────────────────────────────────────────────
// business — the Business app's data and rules (no screen code)
// The costs of the business lynnhoa, collected for the tax return
// (EÜR). Tables: biz_categories · biz_cases (trips, events) · biz_costs.
//
// Numbers are worked out, never typed — like Maintenance in Casa Castel:
//   one-off costs   K1, K2 …            per year, in date order
//   trips           T1 · T1.1, T1.2 …   per year by start date, receipts by date
//   events          E1 · E1.1 …         the same
//   (same date: the one added first comes first)
// A return is its own line on its own date and points to its receipt (↩ K28);
// its amount is stored negative.
//
// Kleinunternehmer (§ 19, from the profile): an amount is what you paid.
// Otherwise a receipt has a VAT rate: net and VAT (Vorsteuer) are worked out.
// Counts = net (§ 19: what you paid) × business share × the category's "counts" %
// (Bewirtung 70 %).
// ─────────────────────────────────────────────────────────────

import { r2 } from "./formatters";

export type CatKind = "normal" | "bewirtung" | "geschenk" | "technik";
export type CaseKind = "trip" | "event";
export type BizAccount = "lynnhoa" | "createbylynn" | "general";

export interface BizCategory {
  id: string; name: string; group: string;
  countsPct: number;          // how much of it counts (Bewirtung 70)
  sharePct: number;           // the usual business share (a phone used privately too)
  kind: CatKind;              // bewirtung: Anlass + guests · geschenk: recipient · technik: the 800 € mark
  sort: number;
}
export interface BizCost {
  id: string; caseId: string | null; date: string; what: string; vendor: string;
  amount: number;             // € (a return: negative)
  categoryId: string | null;
  vatRate: number | null;     // only without § 19
  receiptNo: string;          // the number on the invoice / order
  sharePct: number | null;    // null = the category's
  returnOf: string | null;
  anlass: string; guests: string; recipient: string;
  filePath: string | null; fileName: string | null; filePages: number | null;
  createdAt: string;
}
export interface BizCase {
  id: string; kind: CaseKind; title: string; place: string; country: string;
  startDate: string; startTime: string; endDate: string; endTime: string;
  purpose: string; account: BizAccount; client: string; guests: string;
  meals: Record<string, { b?: boolean; l?: boolean; d?: boolean }>;
  km: number; abroadFull: number | null; abroadPart: number | null;
  report: any; createdAt: string;
}

export const BIZ_BUCKET = "business-receipts";
export const GIFT_LIMIT = 50;      // € a year per person (net; with § 19 what you paid)
export const GWG_LIMIT  = 800;     // € net: above → spread over several years (Abschreibung)
export const VAT_RATES  = [19, 7, 0];

const numOr = (v: any, d: number) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? d : Number(v));
const numOrNull = (v: any) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? null : Number(v));
const txt = (v: any) => (v === null || v === undefined ? "" : String(v));

export const catFromRow = (r: any): BizCategory => ({
  id: r.id, name: txt(r.name), group: txt(r.euer_group),
  countsPct: numOr(r.counts_pct, 100), sharePct: numOr(r.share_pct, 100),
  kind: (["bewirtung", "geschenk", "technik"].includes(r.kind) ? r.kind : "normal") as CatKind,
  sort: Number(r.sort) || 0,
});

export const costFromRow = (r: any): BizCost => ({
  id: r.id, caseId: r.case_id ?? null, date: txt(r.date).slice(0, 10), what: txt(r.what), vendor: txt(r.vendor),
  amount: Number(r.amount) || 0, categoryId: r.category_id ?? null, vatRate: numOrNull(r.vat_rate),
  receiptNo: txt(r.receipt_no), sharePct: numOrNull(r.share_pct), returnOf: r.return_of ?? null,
  anlass: txt(r.anlass), guests: txt(r.guests), recipient: txt(r.recipient),
  filePath: r.file_path ?? null, fileName: r.file_name ?? null, filePages: numOrNull(r.file_pages),
  createdAt: txt(r.created_at),
});

export const caseFromRow = (r: any): BizCase => ({
  id: r.id, kind: r.kind === "event" ? "event" : "trip", title: txt(r.title), place: txt(r.place), country: txt(r.country) || "Germany",
  startDate: txt(r.start_date).slice(0, 10), startTime: txt(r.start_time), endDate: txt(r.end_date).slice(0, 10), endTime: txt(r.end_time),
  purpose: txt(r.purpose), account: (["lynnhoa", "createbylynn"].includes(r.account) ? r.account : "general") as BizAccount,
  client: txt(r.client), guests: txt(r.guests), meals: r.meals && typeof r.meals === "object" ? r.meals : {},
  km: Number(r.km) || 0, abroadFull: numOrNull(r.abroad_full), abroadPart: numOrNull(r.abroad_part),
  report: r.report && typeof r.report === "object" ? r.report : {}, createdAt: txt(r.created_at),
});

// only the fields that are given (an update sends just what changed)
export function costToRow(c: Partial<BizCost>): any {
  const row: any = {};
  if (c.caseId     !== undefined) row.case_id     = c.caseId;
  if (c.date       !== undefined) row.date        = c.date;
  if (c.what       !== undefined) row.what        = c.what.trim();
  if (c.vendor     !== undefined) row.vendor      = c.vendor.trim();
  if (c.amount     !== undefined) row.amount      = r2(c.amount);
  if (c.categoryId !== undefined) row.category_id = c.categoryId;
  if (c.vatRate    !== undefined) row.vat_rate    = c.vatRate;
  if (c.receiptNo  !== undefined) row.receipt_no  = c.receiptNo.trim();
  if (c.sharePct   !== undefined) row.share_pct   = c.sharePct;
  if (c.returnOf   !== undefined) row.return_of   = c.returnOf;
  if (c.anlass     !== undefined) row.anlass      = c.anlass.trim();
  if (c.guests     !== undefined) row.guests      = c.guests.trim();
  if (c.recipient  !== undefined) row.recipient   = c.recipient.trim();
  return row;
}

// ── Numbers ──────────────────────────────────────────────────
export const yearOf  = (d: string) => Number(String(d || "").slice(0, 4)) || 0;
export const monthOf = (d: string) => String(d || "").slice(0, 7);          // "2026-10"
const cmpCost = (a: BizCost, b: BizCost) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
const caseDay = (x: BizCase) => x.startDate || x.createdAt.slice(0, 10);
const cmpCase = (a: BizCase, b: BizCase) => caseDay(a).localeCompare(caseDay(b)) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
export const sortCosts = (list: BizCost[]) => [...list].sort(cmpCost);
export const sortCases = (list: BizCase[]) => [...list].sort(cmpCase);

// id → "K31" · "T3" · "T3.2" · "E2.1"
export function numbersOf(costs: BizCost[], cases: BizCase[]): Map<string, string> {
  const m = new Map<string, string>();
  const byYear = new Map<number, BizCost[]>();
  costs.filter(c => !c.caseId).forEach(c => { const y = yearOf(c.date); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y)!.push(c); });
  byYear.forEach(list => sortCosts(list).forEach((c, i) => m.set(c.id, `K${i + 1}`)));
  (["trip", "event"] as CaseKind[]).forEach(kind => {
    const letter = kind === "trip" ? "T" : "E";
    const groups = new Map<number, BizCase[]>();
    cases.filter(x => x.kind === kind).forEach(x => { const y = yearOf(caseDay(x)); if (!groups.has(y)) groups.set(y, []); groups.get(y)!.push(x); });
    groups.forEach(list => sortCases(list).forEach((x, i) => {
      const no = `${letter}${i + 1}`;
      m.set(x.id, no);
      sortCosts(costs.filter(c => c.caseId === x.id)).forEach((c, k) => m.set(c.id, `${no}.${k + 1}`));
    }));
  });
  return m;
}

// ── Amounts ──────────────────────────────────────────────────
export const isReturn = (c: BizCost) => !!c.returnOf;
export const netOf = (c: BizCost, ku: boolean) => (ku || !c.vatRate ? c.amount : r2(c.amount / (1 + c.vatRate / 100)));
export const vatOf = (c: BizCost, ku: boolean) => (ku || !c.vatRate ? 0 : r2(c.amount - netOf(c, ku)));
export const shareOf = (c: BizCost, cat?: BizCategory | null) => (c.sharePct ?? cat?.sharePct ?? 100);
export const countedOf = (c: BizCost, cat: BizCategory | null | undefined, ku: boolean) =>
  r2(netOf(c, ku) * shareOf(c, cat) / 100 * (cat?.countsPct ?? 100) / 100);

// a gift: what this person got from you in that year (to compare with GIFT_LIMIT)
const who = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
export function giftsTo(recipient: string, year: number, costs: BizCost[], cats: BizCategory[], ku: boolean, without?: string | null): number {
  if (!who(recipient)) return 0;
  const gift = new Set(cats.filter(c => c.kind === "geschenk").map(c => c.id));
  return r2(costs.filter(c => c.id !== without && c.categoryId && gift.has(c.categoryId) && yearOf(c.date) === year && who(c.recipient) === who(recipient))
    .reduce((s, c) => s + netOf(c, ku), 0));
}

export const accountName = (a: BizAccount) => (a === "lynnhoa" ? "@lynnhoa" : a === "createbylynn" ? "@createbylynn" : "General");
