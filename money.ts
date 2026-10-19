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
    signed:    prs.reduce((s, pr) => s + signedOpen(pr), 0),
    owed:      open.reduce((s: number, d: any) => s + (Number(d.gross) || 0), 0),
    overdue:   open.filter((d: any) => isOverdue(d, todayStr)).length,
    paidYear:  paid.filter((d: any) => paidDateOf(d).startsWith(String(year))).reduce((s: number, d: any) => s + (Number(d.net) || 0), 0),
    paidAll:   paid.reduce((s: number, d: any) => s + (Number(d.net) || 0), 0),
    quotes:    prs.filter(isQuote).reduce((s, pr) => s + (Number(pr.amount) || 0), 0),
    inProgress: prs.some(pr => isSigned(pr) || (pr.status === "invoiced" && !pr.paid)),
    onlyQuotes: !prs.some(pr => isSigned(pr) || (pr.status === "invoiced" && !pr.paid)) && prs.some(isQuote),
    urgent,
    lastActivity: last,
    dormant:   !prs.some(hasOpenWork) && idle != null && idle > DORMANT_DAYS,
  };
}
