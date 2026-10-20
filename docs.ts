// ─────────────────────────────────────────────────────────────
// docs — shared helpers for documents (quotes, contracts,
// amendments, invoices): numbers, totals, VAT, snapshots, labels.
// No UI. Used by the data layer, the PDF renderer and the lists.
// ─────────────────────────────────────────────────────────────

import { r2, today, addD, fmtD } from "./formatters";
import type { DocRecord, DocKind, DocStatus } from "./types";
import type { Tone } from "./constants";
import { normCountry, GERMANY_NAMES, EU_NAMES, NON_EU_NAMES } from "./countries";

// ─── NUMBERS ─────────────────────────────────────────────────
const pad = (n: number, w: number) => String(n).padStart(w, "0");

export const projectNoFrom = (year: string | number, n: number) => `${year}-${pad(n, 3)}`;
export const quoteNo       = (pno: string) => `QUO-${pno}`;
export const contractNo    = (pno: string) => `CON-${pno}`;
export const amendNo       = (pno: string, n: number) => `AMD-${pno}-${pad(n, 2)}`;
export const invoiceNo     = (year: string | number, n: number) => `INV-${year}-${pad(n, 3)}`;

// Project number from an old quote number ("QUO-2026-019" → "2026-019")
export const pnoFromQNo = (qNo?: string | null): string | null => {
  const m = /^QUO-?(\d{4}-\d+)$/i.exec(String(qNo || "").trim());
  return m ? m[1] : null;
};

export const yearOf = (iso?: string | null) => (iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : today().slice(0, 4));

// ─── LINES + TOTALS ──────────────────────────────────────────
export const lineAmt = (ln: any): number => {
  const v = typeof ln?.amt === "number" ? ln.amt : parseFloat(String(ln?.amt ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
export const lineQty = (ln: any): number => Math.max(1, parseInt(String(ln?.qty ?? 1)) || 1);
export const linesSum = (lines: any[] = []): number => r2(lines.reduce((s, l) => s + lineAmt(l), 0));

// Net total of a document (before VAT)
export function docNet(kind: DocKind | string, data: any): number {
  const d = data || {};
  const sum = linesSum(d.lines || []);
  if (kind === "amendment") return sum;
  if ((kind === "quote" || kind === "contract") && d.retainer && d.retMo) {
    return r2(Math.round(sum * (1 - retDiscOf(d) / 100)) * Number(d.retMo));
  }
  return sum;
}

// Monthly fee of a retainer quote/contract
export const retainerMonthly = (data: any): number => Math.round(linesSum(data?.lines || []) * (1 - retDiscOf(data) / 100));
// the retainer discount stored with the quote (Service Catalog setting); older quotes: 20 %
export function retDiscOf(d: any): number {
  const v = Number(d?.retDisc);
  return d?.retDisc !== undefined && d?.retDisc !== null && d?.retDisc !== "" && Number.isFinite(v) ? v : 20;
}

// The lines of one monthly retainer invoice.
// Quotes made by the Calculator (calcV 2): every line with the retainer discount in cents and the
// rounding rest on the largest line — the invoice is exactly the monthly fee of the quote.
// Older quotes keep the rule their running retainer started with (skip list, whole euros per line).
const RET_SKIP = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
export function retainerInvoiceLines(qd: any): any[] {
  const lines: any[] = qd?.lines || [];
  const pct = retDiscOf(qd);
  if (Number(qd?.calcV) >= 2) {
    const out = lines.map((l: any) => ({ ...l, amt: r2(lineAmt(l) * (1 - pct / 100)) }));
    const rest = r2(retainerMonthly(qd) - linesSum(out));
    if (out.length && Math.abs(rest) > 0.004) {
      let k = 0;
      out.forEach((l: any, i: number) => { if (lineAmt(l) > lineAmt(out[k])) k = i; });
      out[k] = { ...out[k], amt: r2(lineAmt(out[k]) + rest) };
    }
    return out;
  }
  return lines.map((l: any) => {
    const amt = parseFloat(l.amt) || 0;
    return { ...l, amt: RET_SKIP.some(s => (l.name || "").toLowerCase().includes(s)) ? amt : Math.round(amt * (1 - pct / 100)) };
  });
}

// ─── VAT ─────────────────────────────────────────────────────
// mode: "ku"       → Kleinunternehmer, no VAT (§ 19 note)
//       "domestic" → VAT is charged
//       "reverse"  → EU business client with VAT ID: reverse charge, no VAT
//       "export"   → client outside the EU: not taxable in Germany, no VAT
export type VatMode = "ku" | "domestic" | "reverse" | "export";

// ── V1: the country lists as they were until Oct 2026 — FROZEN, never edit ──
// Documents sent before then don't store their tax rule, so they are always drawn
// with these lists (docTax) and look exactly as they did when they were sent.
const normV1 = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

const GERMANY_V1 = ["de", "d", "deu", "germany", "deutschland", "bundesrepublikdeutschland"];
const EU_V1 = [
  "at","austria","osterreich","be","belgium","belgien","bg","bulgaria","bulgarien","cy","cyprus","zypern",
  "cz","czechia","czechrepublic","tschechien","dk","denmark","danemark","ee","estonia","estland",
  "es","spain","spanien","fi","finland","finnland","fr","france","frankreich","gr","el","greece","griechenland",
  "hr","croatia","kroatien","hu","hungary","ungarn","ie","ireland","irland","it","italy","italien",
  "lt","lithuania","litauen","lu","luxembourg","luxemburg","lv","latvia","lettland","mt","malta",
  "nl","netherlands","thenetherlands","niederlande","holland","pl","poland","polen","pt","portugal",
  "ro","romania","rumanien","se","sweden","schweden","si","slovenia","slowenien","sk","slovakia","slowakei",
];
const NON_EU_V1 = [
  "us","usa","unitedstates","unitedstatesofamerica","vereinigtestaaten","uk","gb","unitedkingdom",
  "greatbritain","england","grossbritannien","vereinigteskonigreich","ch","switzerland","schweiz",
  "no","norway","norwegen","ca","canada","kanada","au","australia","australien","ae","uae",
  "unitedarabemirates","vereinigtearabischeemirate","dubai","sg","singapore","singapur","jp","japan",
  "cn","china","kr","southkorea","korea","sudkorea","hk","hongkong","tr","turkey","turkei","turkiye",
  "li","liechtenstein","is","iceland","island","in","india","indien","br","brazil","brasilien",
  "mx","mexico","mexiko","za","southafrica","sudafrika","nz","newzealand","neuseeland","il","israel",
];

export function countryZoneV1(country?: string | null): "de" | "eu" | "non-eu" {
  const c = normV1(country || "");
  if (!c || GERMANY_V1.includes(c)) return "de";
  if (EU_V1.includes(c)) return "eu";
  if (NON_EU_V1.includes(c)) return "non-eu";
  return "de";
}

// ── Today's lists (countries.ts): every country in English and German, the EU countries
// also in their own language (Italia, España, Polska …). Not recognised (a typo, another
// script) → like Germany, as before — countryKnown says so, so the invoice question and
// the client page can warn.
export function countryZone(country?: string | null): "de" | "eu" | "non-eu" {
  const raw = String(country || "").trim();
  const c = normCountry(raw);
  if (!raw || GERMANY_NAMES.has(c)) return "de";
  if (EU_NAMES.has(c)) return "eu";
  if (NON_EU_NAMES.has(c)) return "non-eu";
  return "de";
}
export function countryKnown(country?: string | null): boolean {
  const raw = String(country || "").trim();
  if (!raw) return true;                                   // no country = Germany (the default)
  const c = normCountry(raw);
  return GERMANY_NAMES.has(c) || EU_NAMES.has(c) || NON_EU_NAMES.has(c);
}

// One VAT rule — today and V1 only differ in the country lists
function vatFrom(zone: "de" | "eu" | "non-eu", settings: any, client: any): { mode: VatMode; rate: number } {
  const ku = settings?.kleinunternehmer === true || settings?.kleinunternehmer === "true";
  const hasVatId = !!String(client?.vatId || "").trim();
  if (zone === "eu" && hasVatId) return { mode: "reverse", rate: 0 };
  if (ku) return { mode: "ku", rate: 0 };
  if (zone === "non-eu") return { mode: "export", rate: 0 };
  return { mode: "domestic", rate: Number(settings?.vatRate) || 19 };
}
export function vatInfo(settings: any, client: any): { mode: VatMode; rate: number } {
  return vatFrom(countryZone(client?.country), settings, client);
}
export function vatInfoV1(settings: any, client: any): { mode: VatMode; rate: number } {
  return vatFrom(countryZoneV1(client?.country), settings, client);
}

// The tax rule a document keeps once it's sent (stored as data.tax)
export function taxRule(settings: any, client: any): { mode: VatMode; rate: number } {
  const v = vatInfo(settings, client);
  return { mode: v.mode, rate: v.mode === "domestic" ? v.rate : 0 };
}
const VAT_MODES: VatMode[] = ["ku", "domestic", "reverse", "export"];

// The tax rule a document is drawn with: a draft follows today's rules; a sent document
// keeps the rule it was sent with (data.tax, stored since Oct 2026) — older sent ones the
// rules of their time (V1). So sharing a sent document again never changes it.
export function docTax(doc: { status?: string; data?: any } | null | undefined, sender: any, client: any): { mode: VatMode; rate: number } {
  if (doc?.status && doc.status !== "draft") {
    const t = doc?.data?.tax;
    if (t && VAT_MODES.includes(t.mode)) {
      if (t.mode !== "domestic") return { mode: t.mode, rate: 0 };
      return { mode: "domestic", rate: Number(t.rate) || Number(sender?.vatRate) || 19 };
    }
    return vatInfoV1(sender, client);
  }
  return vatInfo(sender, client);
}

// Reverse charge (EU business client with a VAT ID): your USt-IdNr has to be on the invoice (§ 14a UStG)
export function reverseChargeGap(settings: any, client: any): string | null {
  return vatInfo(settings, client).mode === "reverse" && !String(settings?.ustIdNr || "").trim()
    ? "This client is in the EU and has a VAT ID, so the invoice is reverse charge — your USt-IdNr has to be on it. Add it under Business profile, then send the invoice."
    : null;
}

export function docMoney(kind: DocKind | string, data: any, settings: any, client: any) {
  const net = docNet(kind, data);
  const { mode, rate } = vatInfo(settings, client);
  const vat = mode === "domestic" ? r2(net * rate / 100) : 0;
  return { net, vat, gross: r2(net + vat), vatRate: mode === "domestic" ? rate : 0, mode };
}

export const KU_NOTE_DE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";
export const KU_NOTE_EN = "No VAT is charged under the German small business regulation (§ 19 UStG).";

// Tax sentence printed on invoices and in the contract (§ 5). "" when VAT is shown as a line.
export function taxNote(mode: VatMode, lang: string, settings: any): string {
  const de = lang === "de";
  if (mode === "ku") {
    if (de) return (settings?.taxNote || "").trim() || KU_NOTE_DE;
    return KU_NOTE_EN;
  }
  if (mode === "reverse") return de
    ? "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)."
    : "Reverse charge: VAT is payable by the recipient of the service.";
  if (mode === "export") return de
    ? "Nicht im Inland steuerbare Leistung."
    : "Not taxable in Germany (place of supply outside Germany).";
  return "";
}

// ─── SNAPSHOTS (frozen into a document when it is sent) ───────
export function senderSnapshot(s: any) {
  const k = ["name","company","street","plz","city","country","email","website","phone","bankName","iban","bic",
             "paypalEmail","kleinunternehmer","steuernummer","ustIdNr","vatRate","taxNote"];
  const out: any = {};
  k.forEach(key => { out[key] = s?.[key] ?? ""; });
  return out;
}

export function clientSnapshot(c: any) {
  return {
    name: c?.name || "", contact: c?.contact || "", email: c?.email || "",
    street: c?.street || "", plz: c?.plz || "", city: c?.city || "",
    country: c?.country || "", vatId: c?.vatId || "",
  };
}

// What is missing in the profile before an invoice can be finalized
export function profileGaps(s: any): string[] {
  const gaps: string[] = [];
  if (!(s?.name || s?.company)) gaps.push("name");
  if (!s?.street || !s?.city)   gaps.push("address");
  if (!s?.iban)                 gaps.push("IBAN");
  if (!s?.steuernummer && !s?.ustIdNr) gaps.push("tax number");   // every invoice needs one (also under § 19)
  return gaps;
}

// ─── STATUS / LABELS ─────────────────────────────────────────
export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft", sent: "Sent", signed: "Signed", paid: "Paid", cancelled: "Cancelled", superseded: "Replaced",
};

// One colour per document status — the document window's status, the document chips
// in Projects and the tags on project lines all read this, so they can't drift apart:
// draft grey · sent yellow · signed blue · paid green · cancelled pink · replaced grey
export const DOC_TONE: Record<DocStatus, Tone> = {
  draft: "neutral", sent: "waiting", signed: "progress", paid: "done", cancelled: "late", superseded: "neutral",
};

export const isLocked = (d: { status: DocStatus }) => d.status !== "draft";

export function docLabel(d: DocRecord, pr?: any): string {
  const rev = d.revision > 0 ? ` R${d.revision}` : "";
  if (d.kind === "quote")     return `Quote${rev}`;
  if (d.kind === "contract")  return `Contract${rev}`;
  if (d.kind === "amendment") return `Amend ${d.docNo ? d.docNo.slice(-2) : ""}`.trim();
  const no = d.docNo || "draft";
  if (d.subtype === "monthly") return `M${pad(d.monthNo || 0, 2)} · ${no}`;
  if (d.subtype === "renewal") return `Renewal · ${no}`;
  if (d.subtype === "storno")  return `Storno · ${no}`;
  return d.docNo || "Invoice draft";
}

export function docTitle(d: { kind: string; subtype?: string; revision?: number }, lang: string): string {
  const de = lang === "de";
  const rev = (d.revision || 0) > 0 ? ` — R${d.revision}` : "";
  if (d.kind === "quote")     return (de ? "Angebot" : "Quote") + rev;
  if (d.kind === "contract")  return (de ? "Vertrag" : "Contract") + rev;
  if (d.kind === "amendment") return de ? "Nachtrag" : "Amendment";
  if (d.subtype === "storno")  return de ? "Stornorechnung" : "Cancellation Invoice";
  if (d.subtype === "renewal") return de ? "Rechnung — Lizenzverlängerung" : "Invoice — License Renewal";
  return de ? "Rechnung" : "Invoice";
}

// ─── PROJECT LOOKUPS ─────────────────────────────────────────
const byRevDesc = (a: DocRecord, b: DocRecord) => b.revision - a.revision;

export const docsOf = (pr: any): DocRecord[] => (pr?.documents || []) as DocRecord[];

export const currentQuote = (pr: any): DocRecord | null =>
  docsOf(pr).filter(d => d.kind === "quote" && d.status !== "superseded").sort(byRevDesc)[0] || null;

export const currentContract = (pr: any): DocRecord | null =>
  docsOf(pr).filter(d => d.kind === "contract" && d.status !== "superseded").sort(byRevDesc)[0] || null;

// The live (not cancelled) invoice of a one-off project
export const projectInvoice = (pr: any): DocRecord | null =>
  docsOf(pr).filter(d => d.kind === "invoice" && d.subtype === "project" && d.status !== "cancelled")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;

// The tag on a project line in Projects: the state of the document the project is at.
// (Paid / Lost and Follow up / Overdue come first — ProjectsTab shows those as before.)
//   an open invoice (sent, unpaid) → Unpaid · only an invoice draft → Invoice draft
//   contracted / production → Contract draft · Contract sent · Signed
//   lead / quoted / revised → Quote draft · Quote sent   (R1 draft after a sent quote → Quote draft)
//   no document → no tag
export function stageTag(pr: any): { label: string; tone: Tone } | null {
  if (!pr || pr.paid || pr.status === "lost") return null;
  const invs = docsOf(pr).filter(d => d.kind === "invoice" && d.subtype !== "storno" && d.status !== "cancelled");
  if (invs.some(d => d.status === "sent"))  return { label: "Unpaid", tone: DOC_TONE.sent };
  if (invs.some(d => d.status === "draft")) return { label: "Invoice draft", tone: DOC_TONE.draft };
  if (pr.status === "contracted" || pr.status === "production") {
    const c = currentContract(pr);
    if (!c) return null;
    if (c.status === "draft") return { label: "Contract draft", tone: DOC_TONE.draft };
    if (c.status === "sent")  return { label: "Contract sent", tone: DOC_TONE.sent };
    return { label: "Signed", tone: DOC_TONE.signed };
  }
  if (pr.status === "lead" || pr.status === "quoted" || pr.status === "revised") {
    const q = currentQuote(pr);
    if (!q) return null;
    return q.status === "draft" ? { label: "Quote draft", tone: DOC_TONE.draft } : { label: "Quote sent", tone: DOC_TONE.sent };
  }
  return null;
}

export const monthlyInvoices = (pr: any): DocRecord[] =>
  docsOf(pr).filter(d => d.kind === "invoice" && d.subtype === "monthly" && d.status !== "cancelled")
    .sort((a, b) => (a.monthNo || 0) - (b.monthNo || 0));

export const renewalInvoice = (pr: any, renewalId: string): DocRecord | null =>
  docsOf(pr).filter(d => d.kind === "invoice" && d.renewalId === renewalId && d.status !== "cancelled")[0] || null;

export const amendmentDoc = (pr: any, amendmentId: string): DocRecord | null =>
  docsOf(pr).find(d => d.kind === "amendment" && d.amendmentId === amendmentId) || null;

export const issuedInvoices = (pr: any): DocRecord[] =>
  docsOf(pr).filter(d => d.kind === "invoice" && d.status !== "draft");

// Next month number for a retainer (fills gaps left by cancelled months)
export function nextRetainerMonth(pr: any): number | null {
  const retMo = Number(pr?.qd?.retMo) || 0;
  const used = new Set(monthlyInvoices(pr).map(d => d.monthNo || 0));
  for (let m = 1; m <= retMo; m++) if (!used.has(m)) return m;
  return null;
}

// Sort documents for display: quotes, contracts, amendments, then invoices by date
export function sortDocs(docs: DocRecord[]): DocRecord[] {
  const order: Record<string, number> = { quote: 0, contract: 1, amendment: 2, invoice: 3 };
  return [...docs].sort((a, b) =>
    (order[a.kind] - order[b.kind]) ||
    (a.revision - b.revision) ||
    (a.monthNo || 0) - (b.monthNo || 0) ||
    (a.createdAt || "").localeCompare(b.createdAt || ""));
}

// Default due date for invoices: 14 days after the invoice date
export const dueFrom = (docDate: string) => addD(docDate, 14) || docDate;

// The dates an invoice gets with its number: a draft date in the past becomes today (an
// invoice is dated the day it's issued); a date of today or later stays. The due date keeps
// the draft's payment term (14 days when none or a negative one is stored).
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const dayNo = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
export function issueDates(docDate: string | null | undefined, dueDate: string | null | undefined, todayStr: string = today()): { docDate: string; dueDate: string } {
  const cur  = ISO_DAY.test(String(docDate || "")) ? String(docDate).slice(0, 10) : todayStr;
  const date = cur < todayStr ? todayStr : cur;
  let term = 14;
  if (ISO_DAY.test(String(dueDate || "")) && ISO_DAY.test(String(docDate || ""))) {
    const t = Math.round(dayNo(String(dueDate).slice(0, 10)) - dayNo(String(docDate).slice(0, 10)));
    if (Number.isFinite(t) && t >= 0) term = t;
  }
  return { docDate: date, dueDate: term === 0 ? date : (addD(date, term) || date) };
}

// A document as the renderer expects it (works for saved rows and new drafts)
export interface DocView {
  id?:          string;
  kind:         DocKind;
  subtype?:     string;
  docNo:        string;
  revision:     number;
  status:       DocStatus;
  docDate:      string;
  dueDate?:     string | null;
  periodStart?: string | null;
  periodEnd?:   string | null;
  monthNo?:     number | null;
  lang?:        "en" | "de";
  data:         any;
}

// File name for a downloaded document: "2026_10_16 INV-2026-001"
export const docFileName = (d: { docDate?: string; docNo?: string; kind: string }) =>
  `${(d.docDate || today()).replace(/-/g, "_")} ${d.docNo || `${d.kind}-draft`}`;

// ─── INVOICE LISTS (Dashboard + Invoices page) ───────────────
export interface InvoiceRow {
  key:     string;
  cid:     string;
  cName:   string;
  client:  any;
  pr:      any;
  doc:     DocRecord;
  dateStr: string;
  year:    number;
  month:   number;
}

// All issued invoices (drafts excluded), newest first
export function invoiceRows(clients: any[]): InvoiceRow[] {
  const rows: InvoiceRow[] = [];
  (clients || []).forEach((c: any) => (c.projects || []).forEach((pr: any) =>
    docsOf(pr).filter(d => d.kind === "invoice" && d.status !== "draft").forEach(d => {
      const dateStr = d.docDate || "";
      rows.push({
        key: d.id, cid: c.id, cName: c.name, client: c, pr, doc: d, dateStr,
        year:  dateStr ? parseInt(dateStr.slice(0, 4)) : 0,
        month: dateStr ? parseInt(dateStr.slice(5, 7)) - 1 : 0,
      });
    })));
  return rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr) || b.doc.docNo.localeCompare(a.doc.docNo));
}

export function invoiceTypeLabel(d: DocRecord): string {
  if (d.subtype === "monthly") return `Retainer M${pad(d.monthNo || 0, 2)}`;
  if (d.subtype === "renewal") return "License renewal";
  if (d.subtype === "storno")  return "Storno";
  if (d.subtype === "amendment") return "Amendment";
  return "Project";
}

// ─── MONEY FROM INVOICES (one source for dashboard + clients) ─
// Revenue = paid invoices by paid date (net). A paid invoice that was
// later cancelled no longer counts. Outstanding = issued, not paid (gross).
export const isOpenInvoice = (d: DocRecord) => d.kind === "invoice" && d.status === "sent" && d.subtype !== "storno";
export const isPaidInvoice = (d: DocRecord) => d.kind === "invoice" && d.status === "paid" && d.subtype !== "storno";
export const isOverdue     = (d: DocRecord, todayStr: string) => isOpenInvoice(d) && !!d.dueDate && d.dueDate < todayStr;
export const paidDateOf    = (d: DocRecord) => d.paidAt || d.docDate || "";

export function clientMoney(c: any, todayStr: string) {
  const docs = (c?.projects || []).flatMap((pr: any) => docsOf(pr));
  const paid = docs.filter(isPaidInvoice);
  const open = docs.filter(isOpenInvoice);
  const issued = docs.filter((d: DocRecord) => d.kind === "invoice" && (d.status === "sent" || d.status === "paid") && d.subtype !== "storno")
    .sort((a: DocRecord, b: DocRecord) => (b.docDate || "").localeCompare(a.docDate || ""));
  const won = (c?.projects || []).filter((pr: any) => ["contracted", "production", "invoiced", "paid"].includes(pr.status) || pr.paid);
  return {
    revenue:     paid.reduce((s: number, d: DocRecord) => s + (Number(d.net) || 0), 0),
    paidCount:   paid.length,
    last:        issued[0] ? { amount: Number(issued[0].gross) || 0, date: issued[0].docDate } : null,
    avgDeal:     won.length ? Math.round(won.reduce((s: number, pr: any) => s + (Number(pr.amount) || 0), 0) / won.length) : 0,
    outstanding: open.reduce((s: number, d: DocRecord) => s + (Number(d.gross) || 0), 0),
    overdue:     open.filter((d: DocRecord) => isOverdue(d, todayStr)).length,
  };
}

// ─── INVOICE DOWNLOADS (year / month: PDF + CSV) ─────────────
export const MONTH_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Oldest first — the order a bookkeeper reads
export const sortForReport = (rows: InvoiceRow[]) =>
  [...rows].sort((a, b) => a.dateStr.localeCompare(b.dateStr) || String(a.doc.docNo).localeCompare(String(b.doc.docNo)));

export interface InvoicePeriod { key: string; label: string; kind: "year" | "month"; rows: InvoiceRow[]; }

// Every year and month that has invoices, newest first (year row, then its months)
export function invoicePeriods(rows: InvoiceRow[]): InvoicePeriod[] {
  const out: InvoicePeriod[] = [];
  const years = Array.from(new Set(rows.map(r => r.year))).filter(Boolean).sort((a, b) => b - a);
  years.forEach(y => {
    const yRows = rows.filter(r => r.year === y);
    out.push({ key: String(y), label: String(y), kind: "year", rows: yRows });
    Array.from(new Set(yRows.map(r => r.month))).sort((a, b) => b - a).forEach(m => {
      out.push({ key: `${y}-${pad(m + 1, 2)}`, label: `${MONTH_DE[m]} ${y}`, kind: "month", rows: yRows.filter(r => r.month === m) });
    });
  });
  return out;
}

// Status as of today: Open / Overdue / Paid / Cancelled (a Storno itself has none)
export function reportStatus(d: DocRecord, todayStr: string = today()): string {
  if (d.subtype === "storno") return "—";
  if (d.status === "cancelled") return "Cancelled";
  if (d.status === "paid") return "Paid";
  if (d.status === "sent") return d.dueDate && d.dueDate < todayStr ? "Overdue" : "Open";
  return STATUS_LABEL[d.status] || d.status;
}

// Totals: a cancelled invoice and its Storno cancel each other out
export function invoiceTotals(rows: InvoiceRow[]) {
  let net = 0, vat = 0, gross = 0, paid = 0, open = 0;
  rows.forEach(r => {
    const d = r.doc;
    net += Number(d.net) || 0; vat += Number(d.vat) || 0; gross += Number(d.gross) || 0;
    if (isPaidInvoice(d)) paid += Number(d.gross) || 0;
    if (isOpenInvoice(d)) open += Number(d.gross) || 0;
  });
  return { count: rows.length, net: r2(net), vat: r2(vat), gross: r2(gross), paid: r2(paid), open: r2(open) };
}

// CSV for German Excel / Numbers: semicolons, decimal comma, dates 15.10.2026
export function invoicesCsv(rows: InvoiceRow[], todayStr: string = today()): string {
  const num = (n: number) => (Number(n) || 0).toFixed(2).replace(".", ",");
  const head = ["Invoice No.", "Date", "Client", "Project", "Type", "Net €", "VAT €", "Gross €", "Status", "Paid on", "Cancels"];
  const lines = [head, ...sortForReport(rows).map(r => [
    r.doc.docNo, r.doc.docDate ? fmtD(r.doc.docDate) : "", r.cName, r.pr.name, invoiceTypeLabel(r.doc),
    num(r.doc.net), num(r.doc.vat), num(r.doc.gross), reportStatus(r.doc, todayStr),
    r.doc.paidAt ? fmtD(r.doc.paidAt) : "", r.doc.data?.cancelsNo || "",
  ])];
  return lines.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
