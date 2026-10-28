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
// A closed year keeps its numbers (stored on each row); what is added later gets the next free
// number of its series — so the files already sent to the tax advisor stay right.
// A return is its own line on its own date and points to its receipt (↩ K28);
// its amount is stored negative.
//
// Kleinunternehmer (§ 19, from the profile): an amount is what you paid.
// Otherwise a receipt has a VAT rate: net and VAT (Vorsteuer) are worked out.
// Counts = net (§ 19: what you paid) × business share × the category's "counts" %
// (Bewirtung 70 %).
//
// A trip's meal allowance (Verpflegungspauschale) is worked out from its days:
//   Germany 2026  arrival / departure day of a trip with nights 14 € · a full day 28 € ·
//                 a one-day trip of more than 8 hours 14 € (the times decide)
//   abroad        the country's two rates, typed in the trip (from the BMF table)
//   a meal that was included takes off 20 % (breakfast) / 40 % (lunch, dinner) of the
//   full-day rate — never below 0. Own car: 0,30 € per km.
// A trip and its allowance count in the year it starts; a receipt in the year of its date.
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
  noFrozen: string | null;    // the number kept by a closed year
  createdAt: string;
}
export interface BizCase {
  id: string; kind: CaseKind; title: string; place: string; country: string;
  startDate: string; startTime: string; endDate: string; endTime: string;
  purpose: string; account: BizAccount; client: string; guests: string;
  meals: Record<string, { b?: boolean; l?: boolean; d?: boolean }>;
  km: number; abroadFull: number | null; abroadPart: number | null;
  report: any; noFrozen: string | null; createdAt: string;
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
  noFrozen: r.no_frozen || null, createdAt: txt(r.created_at),
});

export const caseFromRow = (r: any): BizCase => ({
  id: r.id, kind: r.kind === "event" ? "event" : "trip", title: txt(r.title), place: txt(r.place), country: txt(r.country) || "Germany",
  startDate: txt(r.start_date).slice(0, 10), startTime: txt(r.start_time), endDate: txt(r.end_date).slice(0, 10), endTime: txt(r.end_time),
  purpose: txt(r.purpose), account: (["lynnhoa", "createbylynn"].includes(r.account) ? r.account : "general") as BizAccount,
  client: txt(r.client), guests: txt(r.guests), meals: r.meals && typeof r.meals === "object" ? r.meals : {},
  km: Number(r.km) || 0, abroadFull: numOrNull(r.abroad_full), abroadPart: numOrNull(r.abroad_part),
  report: r.report && typeof r.report === "object" ? r.report : {}, noFrozen: r.no_frozen || null, createdAt: txt(r.created_at),
});

export function catToRow(c: Partial<BizCategory>): any {
  const row: any = {};
  if (c.name      !== undefined) row.name       = c.name.trim();
  if (c.group     !== undefined) row.euer_group = c.group.trim();
  if (c.countsPct !== undefined) row.counts_pct = Math.min(100, Math.max(0, r2(c.countsPct)));
  if (c.sharePct  !== undefined) row.share_pct  = Math.min(100, Math.max(0, r2(c.sharePct)));
  if (c.kind      !== undefined) row.kind       = c.kind;
  if (c.sort      !== undefined) row.sort       = c.sort;
  return row;
}

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

// id → "K31" · "T3" · "T3.2" · "E2.1" (a closed year: its kept numbers, later ones after them)
const kept = (no: string | null, re: RegExp) => { const m = String(no || "").match(re); return m ? Number(m[1]) : null; };
export function numbersOf(costs: BizCost[], cases: BizCase[]): Map<string, string> {
  const m = new Map<string, string>();
  const byYear = new Map<number, BizCost[]>();
  costs.filter(c => !c.caseId).forEach(c => { const y = yearOf(c.date); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y)!.push(c); });
  byYear.forEach(list => {
    const reK = /^K(\d+)$/;
    let next = Math.max(0, ...list.map(c => kept(c.noFrozen, reK) || 0));
    list.forEach(c => { if (kept(c.noFrozen, reK) !== null) m.set(c.id, c.noFrozen!); });
    sortCosts(list.filter(c => kept(c.noFrozen, reK) === null)).forEach(c => m.set(c.id, `K${++next}`));
  });
  (["trip", "event"] as CaseKind[]).forEach(kind => {
    const letter = kind === "trip" ? "T" : "E";
    const reC = new RegExp(`^${letter}(\\d+)$`);
    const groups = new Map<number, BizCase[]>();
    cases.filter(x => x.kind === kind).forEach(x => { const y = yearOf(caseDay(x)); if (!groups.has(y)) groups.set(y, []); groups.get(y)!.push(x); });
    groups.forEach(list => {
      let next = Math.max(0, ...list.map(x => kept(x.noFrozen, reC) || 0));
      const order = [...list.filter(x => kept(x.noFrozen, reC) !== null), ...sortCases(list.filter(x => kept(x.noFrozen, reC) === null))];
      order.forEach(x => {
        const no = kept(x.noFrozen, reC) !== null ? x.noFrozen! : `${letter}${++next}`;
        m.set(x.id, no);
        const reR = new RegExp(`^${no.replace(".", "\\.")}\\.(\\d+)$`);
        const mine = costs.filter(c => c.caseId === x.id);
        let sub = Math.max(0, ...mine.map(c => kept(c.noFrozen, reR) || 0));
        mine.forEach(c => { if (kept(c.noFrozen, reR) !== null) m.set(c.id, c.noFrozen!); });
        sortCosts(mine.filter(c => kept(c.noFrozen, reR) === null)).forEach(c => m.set(c.id, `${no}.${++sub}`));
      });
    });
  });
  return m;
}
// what closing a year writes down: the numbers of its one-off costs, its trips / events and their receipts
export function numbersOfYear(year: number, costs: BizCost[], cases: BizCase[]) {
  const m = numbersOf(costs, cases);
  const yc = cases.filter(x => yearOf(caseDay(x)) === year);
  const ids = new Set(yc.map(x => x.id));
  return {
    costs: costs.filter(c => (c.caseId ? ids.has(c.caseId) : yearOf(c.date) === year)).map(c => ({ id: c.id, no: m.get(c.id) || null })),
    cases: yc.map(x => ({ id: x.id, no: m.get(x.id) || null })),
  };
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

// ── Trips · events ───────────────────────────────────────────
export const KM_RATE = 0.30;                       // € per km, own car
export const MEAL_DE = { full: 28, part: 14 };     // Germany 2026
export const MEAL_CUT = { b: 0.2, l: 0.4, d: 0.4 };

export function caseToRow(x: Partial<BizCase>): any {
  const row: any = {};
  if (x.kind       !== undefined) row.kind        = x.kind;
  if (x.title      !== undefined) row.title       = x.title.trim();
  if (x.place      !== undefined) row.place       = x.place.trim();
  if (x.country    !== undefined) row.country     = x.country.trim() || "Germany";
  if (x.startDate  !== undefined) row.start_date  = x.startDate || null;
  if (x.startTime  !== undefined) row.start_time  = x.startTime || null;
  if (x.endDate    !== undefined) row.end_date    = x.endDate || null;
  if (x.endTime    !== undefined) row.end_time    = x.endTime || null;
  if (x.purpose    !== undefined) row.purpose     = x.purpose.trim();
  if (x.account    !== undefined) row.account     = x.account;
  if (x.client     !== undefined) row.client      = x.client.trim();
  if (x.guests     !== undefined) row.guests      = x.guests.trim();
  if (x.meals      !== undefined) row.meals       = x.meals;
  if (x.km         !== undefined) row.km          = r2(x.km || 0);
  if (x.abroadFull !== undefined) row.abroad_full = x.abroadFull;
  if (x.abroadPart !== undefined) row.abroad_part = x.abroadPart;
  if (x.report     !== undefined) row.report      = x.report;
  return row;
}

export const caseYear = (x: BizCase) => yearOf(x.startDate || x.createdAt);
export const isAbroad = (x: Pick<BizCase, "country">) => !!x.country && !/^(germany|deutschland|de)$/i.test(x.country.trim());

const dayMs = 864e5;
const isoAt = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
export function eachDay(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return [];
  const end = /^\d{4}-\d{2}-\d{2}$/.test(to) && to >= from ? to : from;
  const out: string[] = [];
  for (let t = utc(from); t <= utc(end) && out.length < 366; t += dayMs) out.push(isoAt(t));
  return out;
}
const mins = (t: string) => { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
// hours of a one-day trip (null while a time is missing)
export function hoursOf(x: Pick<BizCase, "startTime" | "endTime">): number | null {
  const a = mins(x.startTime), b = mins(x.endTime);
  return a === null || b === null || b < a ? null : (b - a) / 60;
}

export type DayKind = "arrival" | "full" | "departure" | "day" | "short";
export interface MealDay { date: string; kind: DayKind; base: number; cut: number; amount: number; meals: { b?: boolean; l?: boolean; d?: boolean }; }
export function mealDays(x: BizCase): MealDay[] {
  if (x.kind !== "trip") return [];
  const days = eachDay(x.startDate, x.endDate);
  const abroad = isAbroad(x);
  const full = abroad ? (x.abroadFull ?? 0) : MEAL_DE.full;
  const part = abroad ? (x.abroadPart ?? 0) : MEAL_DE.part;
  return days.map((date, i) => {
    let kind: DayKind, base: number;
    if (days.length === 1) { const h = hoursOf(x); kind = h !== null && h > 8 ? "day" : "short"; base = kind === "day" ? part : 0; }
    else if (i === 0) { kind = "arrival"; base = part; }
    else if (i === days.length - 1) { kind = "departure"; base = part; }
    else { kind = "full"; base = full; }
    const m = (x.meals && x.meals[date]) || {};
    const cut = Math.min(base, r2((m.b ? MEAL_CUT.b * full : 0) + (m.l ? MEAL_CUT.l * full : 0) + (m.d ? MEAL_CUT.d * full : 0)));
    return { date, kind, base, cut, amount: r2(Math.max(0, base - cut)), meals: m };
  });
}
export const mealTotal = (x: BizCase) => r2(mealDays(x).reduce((s, d) => s + d.amount, 0));
export const kmAmount  = (x: BizCase) => (x.kind === "trip" ? r2((x.km || 0) * KM_RATE) : 0);
export const costsOf   = (x: BizCase, costs: BizCost[]) => sortCosts(costs.filter(c => c.caseId === x.id));
export const caseTotal = (x: BizCase, costs: BizCost[]) => r2(costsOf(x, costs).reduce((s, c) => s + c.amount, 0) + mealTotal(x) + kmAmount(x));

// the year strip: every receipt of the year (any tab) + the allowances of the year's trips
export function yearTotals(year: number, costs: BizCost[], cases: BizCase[], cats: BizCategory[], ku: boolean) {
  const catOf = (id: string | null) => cats.find(c => c.id === id) || null;
  let total = 0, counted = 0;
  costs.filter(c => yearOf(c.date) === year).forEach(c => { total += c.amount; counted += countedOf(c, catOf(c.categoryId), ku); });
  cases.filter(x => x.kind === "trip" && caseYear(x) === year).forEach(x => { const a = mealTotal(x) + kmAmount(x); total += a; counted += a; });
  return { total: r2(total), counted: r2(counted) };
}

// "29.09.–02.10.2026" · "17.10.2026" · "29.12.2026–02.01.2027"
export function dateRange(from: string, to: string): string {
  const f = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  if (!from) return "";
  if (!to || to === from) return `${f(from)}${from.slice(0, 4)}`;
  return from.slice(0, 4) === to.slice(0, 4) ? `${f(from)}–${f(to)}${to.slice(0, 4)}` : `${f(from)}${from.slice(0, 4)}–${f(to)}${to.slice(0, 4)}`;
}

// ── Copy prompt: a photo of a receipt → Claude → SQL to paste in Supabase (like Maintenance) ──
export function receiptPrompt(p: { userId: string; x?: BizCase | null; no?: string; cats: BizCategory[]; ku: boolean }): string {
  const cats = [...p.cats].sort((a, b) => a.sort - b.sort)
    .map(c => `  '${c.id}' = ${c.name}${c.group ? ` (${c.group})` : ""}${c.kind === "bewirtung" ? " — a business meal" : c.kind === "geschenk" ? " — a gift" : ""}`).join("\n");
  const where = p.x
    ? `'${p.x.id}' — ${p.x.kind === "trip" ? "the trip" : "the event"} ${p.no || ""} · ${p.x.title}${p.x.startDate ? ` · ${dateRange(p.x.startDate, p.x.endDate)}` : ""}`
    : "null — a one-off cost (not part of a trip or event)";
  return [
    "Read the receipt photo(s) I attach and write SQL for Supabase (SQL Editor) that adds each receipt to the Business app of LH Studio.",
    "",
    "Table public.biz_costs, one row per receipt. Fill these columns:",
    `- user_id: '${p.userId}'`,
    `- case_id: ${where}`,
    "- date: the receipt date as 'YYYY-MM-DD'",
    "- what: a short description in English (e.g. 'Canva Pro, yearly')",
    "- vendor: the shop or company",
    "- amount: the total paid in € (gross), a dot as decimal separator; a refund is negative",
    p.ku ? "- vat_rate: null (Kleinunternehmer, § 19 UStG)" : "- vat_rate: 19, 7 or 0 as printed on the receipt",
    "- receipt_no: the invoice or order number, '' if there is none",
    "- category_id: the best fit of",
    cats,
    "- anlass and guests: only for a business meal — the occasion and who was there, if you can tell; else ''",
    "- recipient: only for a gift — who got it; else ''",
    "",
    "Write one insert for all receipts, then a select that shows the new rows. No other text.",
    "(The receipt files are added in the app afterwards — those rows show \"No file\" until then.)",
  ].join("\n");
}
