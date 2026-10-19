// ─────────────────────────────────────────────────────────────
// Invoices — every issued invoice (project, retainer month,
// renewal, Storno). Chips All · Unpaid · Overdue · Paid, grouped by
// month: the invoice date, or the PAID date in the Paid view (when
// the money came in — same as the dashboard). Overdue first in a
// month. Tap → preview. Export a year or month as PDF or CSV.
// filterTab / focusMonth ("2026-10") come from a dashboard card.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL } from "./constants";
import { fmt, fmtD, today } from "./formatters";
import { Ico, IC } from "./PlannerWindows";
import PDFModal from "./PDFModal";
import { downloadInvoiceReport } from "./InvoiceReport";
import { invoiceRows, invoicesCsv, invoiceTypeLabel, invoicePeriods, isOpenInvoice, isPaidInvoice, isOverdue, paidDateOf, MONTH_DE } from "./docs";
import type { InvoiceRow, InvoicePeriod } from "./docs";

const MO_LONG = MONTH_DE;

function downloadCsv(rows: InvoiceRow[], filename: string) {
  const blob = new Blob(["\uFEFF" + invoicesCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

interface InvoicesProps {
  clients:    any[];
  settings:   any;
  isMobile:   boolean;
  filterTab?: "unpaid" | "paid" | "overdue";
  focusMonth?: string | null;
}
type ToneSet = { fill: string; wash: string; mid: string; ink: string };

export default function Invoices({ clients, settings, isMobile, filterTab, focusMonth }: InvoicesProps) {
  const [preview,    setPreview]    = useState<InvoiceRow | null>(null);
  const [dropOpen,   setDropOpen]   = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  type F = "all" | "unpaid" | "overdue" | "paid";
  const [st, setSt] = useState<F>(filterTab || "all");
  useEffect(() => { if (filterTab) setSt(filterTab); }, [filterTab]);
  const todayStr = today();
  const allRows = invoiceRows(clients);
  const count   = (f: F) => f === "unpaid" ? allRows.filter(r => isOpenInvoice(r.doc)).length
                : f === "overdue" ? allRows.filter(r => isOverdue(r.doc, todayStr)).length
                : f === "paid" ? allRows.filter(r => isPaidInvoice(r.doc)).length : allRows.length;
  const rows    = st === "unpaid"  ? allRows.filter(r => isOpenInvoice(r.doc))
                : st === "overdue" ? allRows.filter(r => isOverdue(r.doc, todayStr))
                : st === "paid"    ? allRows.filter(r => isPaidInvoice(r.doc))
                : allRows;

  // ── Downloads: one row per year / month, each as PDF or CSV ──
  // Always ALL finalized invoices of that period (the filter above is only for viewing)
  const periods: InvoicePeriod[] = invoicePeriods(allRows);
  const brand = (settings?.company || settings?.name || "LH Studio").trim();
  const fileFor = (p: InvoicePeriod) => `${brand} – Invoices ${p.key}`;
  const [dlErr, setDlErr] = useState<string | null>(null);

  const downloadPdf = async (p: InvoicePeriod) => {
    if (bulkStatus) return;
    setDropOpen(false); setDlErr(null);
    setBulkStatus("Preparing PDF…");
    try {
      await downloadInvoiceReport({ rows: p.rows, title: `Invoices · ${p.label}`, filename: fileFor(p), settings, byMonth: p.kind === "year" });
    } catch (e: any) {
      setDlErr(e?.message || "The PDF couldn't be created.");
    } finally {
      setBulkStatus(null);
    }
  };
  const downloadCsvFor = (p: InvoicePeriod) => { setDropOpen(false); setDlErr(null); downloadCsv(p.rows, fileFor(p)); };

  // ── month groups (newest first; overdue → unpaid → the rest inside a month) ──
  const dateOf = (r: InvoiceRow) => (st === "paid" ? paidDateOf(r.doc) || r.dateStr : r.dateStr);
  const rank = (r: InvoiceRow) => (isOverdue(r.doc, todayStr) ? 0 : isOpenInvoice(r.doc) ? 1 : 2);
  const groups: { key: string; year: number; month: number; rows: InvoiceRow[]; total: number }[] = [];
  [...rows].sort((a, b) => dateOf(b).localeCompare(dateOf(a))).forEach(r => {
    const ds = dateOf(r), key = ds.slice(0, 7);
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, year: parseInt(ds.slice(0, 4)) || 0, month: (parseInt(ds.slice(5, 7)) || 1) - 1, rows: [], total: 0 }; groups.push(g); }
    g.rows.push(r); g.total += Number(r.doc.gross) || 0;
  });
  groups.forEach(g => g.rows.sort((a, b) => rank(a) - rank(b) || dateOf(b).localeCompare(dateOf(a))));

  // a month bar tapped on the dashboard → scroll to that month
  useEffect(() => {
    if (!focusMonth) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`inv-${focusMonth}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (isMobile ? 110 : 80), behavior: "smooth" });
    }, 150);
    return () => clearTimeout(t);
  }, [focusMonth, st]);

  const toneOfF = (f: F): ToneSet => (f === "unpaid" ? PAL.waiting : f === "overdue" ? PAL.late : f === "paid" ? PAL.done : PAL.neutral);
  const rowTone = (d: any): ToneSet => (d.subtype === "storno" || d.status === "cancelled" ? PAL.neutral : isPaidInvoice(d) ? PAL.done : isOverdue(d, todayStr) ? PAL.late : PAL.waiting);
  const rowIcon = (d: any) => (isPaidInvoice(d) ? IC.checkCircle : isOverdue(d, todayStr) ? IC.alert : d.subtype === "storno" ? IC.file : IC.hourglass);
  const daysLate = (due: string) => Math.max(1, Math.round((Date.parse(todayStr) - Date.parse(due)) / 864e5));
  const tagText = (d: any) => d.subtype === "storno" ? "Storno" : d.status === "cancelled" ? "Cancelled" : isPaidInvoice(d) ? "Paid"
    : isOverdue(d, todayStr) ? `Overdue · ${daysLate(d.dueDate)} ${daysLate(d.dueDate) === 1 ? "day" : "days"}` : "Unpaid";
  const metaText = (r: InvoiceRow) => {
    const d = r.doc;
    const when = isPaidInvoice(d) && d.paidAt ? `paid ${fmtD(d.paidAt).slice(0, 6)}` : isOpenInvoice(d) && d.dueDate ? `due ${fmtD(d.dueDate).slice(0, 6)}` : fmtD(d.docDate);
    const type = invoiceTypeLabel(d);
    return [d.docNo, type !== "Project" ? type : null, when].filter(Boolean).join(" · ");
  };
  const shown = rows.reduce((s, r) => s + (Number(st === "paid" ? r.doc.net : r.doc.gross) || 0), 0);
  const chip = (f: F, label: string) => {
    const on = st === f, t = toneOfF(f);
    return (
      <button key={f} onClick={() => setSt(f)} aria-pressed={on}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px", borderRadius: 15, border: `1px solid ${on ? (f === "all" ? "#d9d3cc" : t.fill) : C.rule}`, background: on ? (f === "all" ? PAL.neutral.fill : t.wash) : C.white,
          color: on ? (f === "all" ? C.black : t.ink) : "#4a4540", fontFamily: SANS, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
        {f !== "all" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.mid }} />}{label}
        <span style={{ fontSize: 11, color: on ? (f === "all" ? "#6b655e" : t.ink) : C.muted }}>{count(f)}</span>
      </button>
    );
  };

  if (preview) {
    return <PDFModal doc={preview.doc} settings={settings} client={preview.client} editable={false} onClose={() => setPreview(null)} />;
  }

  const btnStyle: any = { height: 30, padding: "0 10px", border: `1px solid ${C.rule}`, borderRadius: 15, background: C.white, cursor: "pointer", fontFamily: SANS, fontSize: 11, color: C.black, display: "flex", alignItems: "center", whiteSpace: "nowrap" as const };
  const ft = toneOfF(st);

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      {/* ── HEADER: title, what's shown, export ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Invoices</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a847d", marginTop: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: ft.mid, flexShrink: 0 }} />
            {rows.length} {st === "all" ? "" : st === "paid" ? "paid " : st === "overdue" ? "overdue " : "unpaid "}invoice{rows.length === 1 ? "" : "s"} · <span style={{ color: C.black, fontWeight: 500 }}>{fmt(shown)}</span>
          </div>
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {dropOpen && <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setDropOpen(false)} />}
          <button
            onClick={() => { if (periods.length && !bulkStatus) setDropOpen(o => !o); }}
            disabled={!periods.length || !!bulkStatus}
            title={periods.length ? "Export a year or month as PDF or CSV" : "No invoices yet"}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 15, background: C.white, border: "1px solid #e6e1db", fontFamily: SANS, fontSize: 12, color: C.black, position: "relative", zIndex: 200, opacity: periods.length ? 1 : 0.45, cursor: periods.length && !bulkStatus ? "pointer" : "default" }}>
            <Ico d={IC.download} size={14} />{bulkStatus || "Export"}
          </button>
          {dropOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: C.white, border: `1px solid ${C.rule}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(26,26,26,0.10)", minWidth: 250, zIndex: 200, maxHeight: 320, overflowY: "auto", padding: "4px 0" }}>
              {periods.map((p, i) => (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: p.kind === "year" ? "8px 12px" : "5px 12px 5px 22px", borderTop: i > 0 && p.kind === "year" ? "1px solid #f4f1ed" : "none" }}>
                  <span style={{ flex: 1, fontSize: 12, color: p.kind === "year" ? C.black : C.muted, fontWeight: p.kind === "year" ? 500 : 400 }}>{p.label}</span>
                  <button onClick={() => downloadPdf(p)} style={btnStyle}>PDF</button>
                  <button onClick={() => downloadCsvFor(p)} style={btnStyle}>CSV</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" as const, paddingBottom: 2 }}>
        {chip("all", "All")}{chip("unpaid", "Unpaid")}{chip("overdue", "Overdue")}{chip("paid", "Paid")}
      </div>

      {dlErr && <p style={{ fontSize: 12, color: C.red, margin: "8px 0 0" }}>{dlErr}</p>}
      {rows.length === 0 && (
        <p style={{ fontSize: 13, color: C.muted, margin: "16px 4px" }}>{allRows.length ? "No invoices in this view." : "No invoices yet. They appear here once they're finalized."}</p>
      )}

      {/* ── MONTHS ── */}
      {groups.map(g => (
        <div key={g.key} id={`inv-${g.key}`}>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 4px 6px", fontSize: 11, color: "#6b655e" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#8a847d" }}>{MO_LONG[g.month]} {g.year}</span>
            <span>{fmt(g.total)}</span>
          </div>
          <div style={{ background: C.white, border: "1px solid #efebe6", borderRadius: 12, overflow: "hidden" }}>
            {g.rows.map((r, i) => {
              const d = r.doc, t = rowTone(d);
              return (
                <div key={r.key} role="button" tabIndex={0} onClick={() => setPreview(r)} onKeyDown={(e) => { if (e.key === "Enter") setPreview(r); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "7px 10px 7px 12px", borderTop: i ? "1px solid #f4f1ed" : "none", cursor: "pointer" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: t.wash, color: t.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={rowIcon(d)} size={15} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{r.cName}<span style={{ color: C.muted }}> · {r.pr.name}</span></div>
                    <div style={{ fontSize: 12, color: "#8a847d", marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{metaText(r)}</div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap" as const }}>{fmt(d.gross)}</div>
                    <span style={{ display: "inline-block", fontSize: 10, letterSpacing: "0.03em", padding: "2px 8px", borderRadius: 9, marginTop: 3, background: t.fill, color: t.ink, whiteSpace: "nowrap" as const }}>{tagText(d)}</span>
                  </div>
                  <Ico d={IC.right} size={15} color="#cfc9c2" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
