// ─────────────────────────────────────────────────────────────
// docs — shared helpers for documents (quotes, contracts,
// amendments, invoices): numbers, totals, VAT, snapshots, labels.
// No UI. Used by the data layer, the PDF renderer and the lists.
// ─────────────────────────────────────────────────────────────

import { r2, today, addD } from "./formatters";
import type { DocRecord, DocKind, DocStatus } from "./types";

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
    return r2(Math.round(sum * 0.8) * Number(d.retMo));
  }
  return sum;
}

// Monthly fee of a retainer quote/contract
export const retainerMonthly = (data: any): number => Math.round(linesSum(data?.lines || []) * 0.8);

// ─── VAT ─────────────────────────────────────────────────────
// mode: "ku"       → Kleinunternehmer, no VAT (§ 19 note)
//       "domestic" → VAT is charged
//       "reverse"  → EU business client with VAT ID: reverse charge, no VAT
//       "export"   → client outside the EU: not taxable in Germany, no VAT
export type VatMode = "ku" | "domestic" | "reverse" | "export";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

const GERMANY = ["de", "d", "deu", "germany", "deutschland", "bundesrepublikdeutschland"];
const EU = [
  "at","austria","osterreich","be","belgium","belgien","bg","bulgaria","bulgarien","cy","cyprus","zypern",
  "cz","czechia","czechrepublic","tschechien","dk","denmark","danemark","ee","estonia","estland",
  "es","spain","spanien","fi","finland","finnland","fr","france","frankreich","gr","el","greece","griechenland",
  "hr","croatia","kroatien","hu","hungary","ungarn","ie","ireland","irland","it","italy","italien",
  "lt","lithuania","litauen","lu","luxembourg","luxemburg","lv","latvia","lettland","mt","malta",
  "nl","netherlands","thenetherlands","niederlande","holland","pl","poland","polen","pt","portugal",
  "ro","romania","rumanien","se","sweden","schweden","si","slovenia","slowenien","sk","slovakia","slowakei",
];
const NON_EU = [
  "us","usa","unitedstates","unitedstatesofamerica","vereinigtestaaten","uk","gb","unitedkingdom",
  "greatbritain","england","grossbritannien","vereinigteskonigreich","ch","switzerland","schweiz",
  "no","norway","norwegen","ca","canada","kanada","au","australia","australien","ae","uae",
  "unitedarabemirates","vereinigtearabischeemirate","dubai","sg","singapore","singapur","jp","japan",
  "cn","china","kr","southkorea","korea","sudkorea","hk","hongkong","tr","turkey","turkei","turkiye",
  "li","liechtenstein","is","iceland","island","in","india","indien","br","brazil","brasilien",
  "mx","mexico","mexiko","za","southafrica","sudafrika","nz","newzealand","neuseeland","il","israel",
];

export function countryZone(country?: string | null): "de" | "eu" | "non-eu" {
  const c = norm(country || "");
  if (!c || GERMANY.includes(c)) return "de";
  if (EU.includes(c)) return "eu";
  if (NON_EU.includes(c)) return "non-eu";
  return "de";   // unknown spelling → treat like Germany (safe: VAT is never skipped by mistake)
}

export function vatInfo(settings: any, client: any): { mode: VatMode; rate: number } {
  const ku = settings?.kleinunternehmer === true || settings?.kleinunternehmer === "true";
  const zone = countryZone(client?.country);
  const hasVatId = !!String(client?.vatId || "").trim();
  if (zone === "eu" && hasVatId) return { mode: "reverse", rate: 0 };
  if (ku) return { mode: "ku", rate: 0 };
  if (zone === "non-eu") return { mode: "export", rate: 0 };
  return { mode: "domestic", rate: Number(settings?.vatRate) || 19 };
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
  return gaps;
}

// ─── STATUS / LABELS ─────────────────────────────────────────
export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft", sent: "Sent", signed: "Signed", paid: "Paid", cancelled: "Cancelled", superseded: "Replaced",
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
  return "Project";
}

// CSV with German number format (semicolon-free, quoted)
export function invoicesCsv(rows: InvoiceRow[]): string {
  const num = (n: number) => (Number(n) || 0).toFixed(2).replace(".", ",");
  const head = ["Invoice No.", "Date", "Client", "Project", "Type", "Net €", "VAT €", "Gross €", "Status", "Paid on", "Cancels"];
  const lines = [head, ...rows.map(r => [
    r.doc.docNo, r.doc.docDate || "", r.cName, r.pr.name, invoiceTypeLabel(r.doc),
    num(r.doc.net), num(r.doc.vat), num(r.doc.gross), STATUS_LABEL[r.doc.status] || r.doc.status,
    r.doc.paidAt || "", r.doc.data?.cancelsNo || "",
  ])];
  return lines.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
