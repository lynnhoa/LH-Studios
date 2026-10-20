// ─────────────────────────────────────────────────────────────
// money — ONE rule for money and activity, used by Dashboard,
// Projects and Clients (so their numbers can never drift apart).
//   signed open   contracted / production, minus what's already
//                 invoiced on the project (retainer months …)
//   owed          issued invoices not paid yet (gross)
//   paid          paid invoices (net) — by paid date
//   last activity newest status change, document or payment
//   dormant       no open work and nothing for 90 days
// ─────────────────────────────────────────────────────────────

import { docsOf, isPaidInvoice, isOpenInvoice, isOverdue, paidDateOf } from "./docs";
import { addD, r2 } from "./formatters";
import { WORDS } from "./constants";

export const DORMANT_DAYS = 90;
export const STALE_QUOTE_DAYS = 30;
// most urgent first (what a client card shows)
export const STATUS_ORDER = ["invoiced", "production", "contracted", "revised", "quoted", "lead"];

export const invoicesOf = (pr: any): any[] => docsOf(pr).filter((d: any) => d.kind === "invoice");
export const billedNet  = (pr: any): number =>
  invoicesOf(pr).filter((d: any) => isPaidInvoice(d) || isOpenInvoice(d)).reduce((m: number, d: any) => m + (Number(d.net) || 0), 0);
export const isLost     = (pr: any) => pr.status === "lost";
export const isSigned   = (pr: any) => !pr.paid && (pr.status === "contracted" || pr.status === "production");
export const isQuote    = (pr: any) => !pr.paid && (pr.status === "quoted" || pr.status === "revised");
export const hasOpenWork = (pr: any) => !pr.paid && STATUS_ORDER.includes(pr.status);
export const signedOpen = (pr: any): number => (isSigned(pr) ? Math.max(0, (Number(pr.amount) || 0) - billedNet(pr)) : 0);

// ── TO INVOICE — agreed work that isn't invoiced yet (Dashboard, Projects, Clients) ──
//   contracted / production  the open contract value (signed amendments are part of it)
//   invoiced / paid          signed amendments whose invoice isn't sent yet
// An amendment counts as invoiced once its invoice is sent or paid — a draft doesn't count.
export const amendBilled = (pr: any, a: any): boolean => {
  if (!a?.invoiceDocId) return false;
  const d = docsOf(pr).find((x: any) => x.id === a.invoiceDocId);
  return !!d && (d.status === "sent" || d.status === "paid");
};
export const openAmendments = (pr: any): any[] =>
  (pr?.amendments || []).filter((a: any) => a.signed && (Number(a.amendTotal) || 0) !== 0 && !amendBilled(pr, a));
export function toInvoice(pr: any): number {
  if (!pr || pr.status === "lost") return 0;
  if (isSigned(pr)) return signedOpen(pr);
  if (pr.paid || pr.status === "invoiced" || pr.status === "paid")
    return Math.max(0, r2(openAmendments(pr).reduce((s: number, a: any) => s + (Number(a.amendTotal) || 0), 0)));
  return 0;
}

// "← Back one step" from Production: not while the project has invoices or amendments
// (the contract has to stay signed for them)
export function backStepBlock(pr: any): string | null {
  if (!pr || pr.status !== "production") return null;
  const invoices = docsOf(pr).some((d: any) => d.kind === "invoice" && d.subtype !== "storno" && d.status !== "cancelled");
  const amends = (pr.amendments || []).length > 0;
  return invoices || amends ? "Not possible while the project has invoices or amendments — the contract stays signed." : null;
}

export const daysSince = (iso: string | null | undefined, todayStr: string): number | null => {
  if (!iso) return null;
  const a = Date.parse(String(iso).slice(0, 10)), b = Date.parse(todayStr);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 864e5) : null;
};

// the day a project entered its current status (or its date)
export const statusSince = (pr: any): string | null => {
  const h = (pr.statusHistory || []).filter((x: any) => x.status === pr.status).pop();
  return h?.at || pr.date || null;
};

export function lastActivity(c: any): string {
  let last = String(c?.createdAt || "").slice(0, 10);
  const see = (d: any) => { const s = String(d || "").slice(0, 10); if (s > last) last = s; };
  (c?.projects || []).forEach((pr: any) => {
    see(pr.date);
    (pr.statusHistory || []).forEach((h: any) => see(h.at));
    docsOf(pr).forEach((d: any) => { see(d.docDate); see(d.sentAt); see(d.signedAt); see(d.paidAt); });
  });
  return last;
}

export function clientTotals(c: any, year: number, todayStr: string) {
  const prs: any[] = (c?.projects || []).filter((pr: any) => !isLost(pr));
  const invs = prs.flatMap(invoicesOf);
  const open = invs.filter(isOpenInvoice);
  const paid = invs.filter(isPaidInvoice);
  const urgent = prs.filter(hasOpenWork).sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))[0] || null;
  const last = lastActivity(c);
  const idle = daysSince(last, todayStr);
  return {
    projects:  prs.length,
    signed:    prs.reduce((s, pr) => s + toInvoice(pr), 0),
    owed:      open.reduce((s: number, d: any) => s + (Number(d.gross) || 0), 0),
    overdue:   open.filter((d: any) => isOverdue(d, todayStr)).length,
    paidYear:  paid.filter((d: any) => paidDateOf(d).startsWith(String(year))).reduce((s: number, d: any) => s + (Number(d.net) || 0), 0),
    paidAll:   paid.reduce((s: number, d: any) => s + (Number(d.net) || 0), 0),
    quotes:    prs.filter(isQuote).reduce((s, pr) => s + (Number(pr.amount) || 0), 0),
    inProgress: prs.some(pr => isSigned(pr) || (pr.status === "invoiced" && !pr.paid) || toInvoice(pr) > 0),
    onlyQuotes: !prs.some(pr => isSigned(pr) || (pr.status === "invoiced" && !pr.paid)) && prs.some(isQuote),
    urgent,
    lastActivity: last,
    dormant:   !prs.some(hasOpenWork) && idle != null && idle > DORMANT_DAYS,
  };
}

// ── FOLLOW-UP — one rule for the three documents (shown in tabs, never on the Dashboard)
//   quote     after its "valid until" date (no date stored → quote date + 14 days)
//   contract  sent and not signed for more than 7 days
//   invoice   past its due date (= overdue)
export const QUOTE_VALID_DAYS = 14;
export const CONTRACT_FOLLOW_DAYS = 7;
const liveDocs = (pr: any, kind: string) => docsOf(pr)
  .filter((d: any) => d.kind === kind && d.status !== "superseded" && d.status !== "cancelled")
  .sort((a: any, b: any) => (Number(b.revision) || 0) - (Number(a.revision) || 0) || String(b.docDate || "").localeCompare(String(a.docDate || "")));
export const currentContractOf = (pr: any) => liveDocs(pr, "contract")[0] || null;
export function validUntil(pr: any): string | null {
  const q = liveDocs(pr, "quote")[0];
  const v = q?.data?.validUntil || pr?.qd?.validUntil;
  if (v) return String(v).slice(0, 10);
  const base = q?.docDate || pr?.qd?.date || pr?.date;
  return base ? addD(String(base).slice(0, 10), QUOTE_VALID_DAYS) : null;
}
export type FollowUp = { tone: "waiting" | "late"; label: string; text: string };
export function followUp(pr: any, todayStr: string): FollowUp | null {
  if (!pr || pr.paid || pr.status === "lost") return null;
  if (pr.status === "quoted" || pr.status === "revised") {
    const d = daysSince(validUntil(pr), todayStr);
    return d != null && d > 0 ? { tone: "waiting", label: WORDS.followUp, text: `expired ${d} ${d === 1 ? "day" : "days"} ago` } : null;
  }
  if (pr.status === "contracted") {
    const c = currentContractOf(pr);
    if (!c || c.status !== "sent") return null;
    const d = daysSince(c.sentAt || c.docDate, todayStr);
    return d != null && d > CONTRACT_FOLLOW_DAYS ? { tone: "waiting", label: WORDS.followUp, text: `contract sent ${d} days ago` } : null;
  }
  const over = invoicesOf(pr).filter(isOpenInvoice).find((d: any) => isOverdue(d, todayStr));
  if (over) {
    const d = daysSince(over.dueDate, todayStr) || 0;
    return { tone: "late", label: WORDS.overdue, text: `due ${d} ${d === 1 ? "day" : "days"} ago` };
  }
  return null;
}
