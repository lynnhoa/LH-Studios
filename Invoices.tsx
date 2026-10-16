// ─────────────────────────────────────────────────────────────
// Invoices — every issued invoice (project, retainer month,
// renewal, Storno), grouped by year/month. Preview, bulk PDF
// download per month, CSV export.
// filterTab prop: "unpaid" | "paid" | undefined (show all)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, today } from "./formatters";
import { Segmented } from "./atoms";
import PDFModal from "./PDFModal";
import { downloadInvoiceReport } from "./InvoiceReport";
import { invoiceRows, invoicesCsv, invoiceTypeLabel, invoicePeriods, STATUS_LABEL, isOpenInvoice, isPaidInvoice, isOverdue, MONTH_DE } from "./docs";
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
}

export default function Invoices({ clients, settings, isMobile, filterTab }: InvoicesProps) {
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

  // Group by year → month
  const grouped: { year: number; months: { month: number; rows: InvoiceRow[] }[] }[] = [];
  rows.forEach(r => {
    let yg = grouped.find(g => g.year === r.year); if (!yg) { yg = { year: r.year, months: [] }; grouped.push(yg); }
    let mg = yg.months.find(m => m.month === r.month); if (!mg) { mg = { month: r.month, rows: [] }; yg.months.push(mg); }
    mg.rows.push(r);
  });

  const btnStyle: any = { height: 28, padding: "0 10px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.07em", color: C.muted, display: "flex", alignItems: "center", whiteSpace: "nowrap" as const };
  const stCol = (st: string) => st === "paid" ? C.green : st === "cancelled" ? C.red : C.amber;

  if (preview) {
    return <PDFModal doc={preview.doc} settings={settings} client={preview.client} editable={false} onClose={() => setPreview(null)} />;
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap" as const, gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0 }}>Invoices</h2>
        <div style={{ position: "relative" }}>
          {dropOpen && <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setDropOpen(false)} />}
          <button
            onClick={() => { if (periods.length && !bulkStatus) setDropOpen(o => !o); }}
            disabled={!periods.length || !!bulkStatus}
            title={periods.length ? "Download a year or month as PDF or CSV" : "No invoices yet"}
            style={{ ...btnStyle, height: 36, padding: "0 14px", position: "relative", zIndex: 200, opacity: periods.length ? 1 : 0.4, cursor: periods.length && !bulkStatus ? "pointer" : "default", color: C.black }}>
            {bulkStatus || (periods.length ? "Download ▾" : "No invoices yet")}
          </button>
          {dropOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 250, zIndex: 200, maxHeight: 320, overflowY: "auto" }}>
              {periods.map((p, i) => (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: p.kind === "year" ? "9px 12px" : "6px 12px 6px 22px", borderTop: i > 0 && p.kind === "year" ? `1px solid ${C.rule}` : "none" }}>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: TYPE.label.size, color: p.kind === "year" ? C.black : C.muted, fontWeight: p.kind === "year" ? 600 : 400 }}>{p.label}</span>
                  <button onClick={() => downloadPdf(p)} style={{ ...btnStyle, height: 30 }}>PDF</button>
                  <button onClick={() => downloadCsvFor(p)} style={{ ...btnStyle, height: 30 }}>CSV</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <Segmented<F> options={[["all", `All · ${count("all")}`], ["unpaid", `Unpaid · ${count("unpaid")}`], ["overdue", `Overdue · ${count("overdue")}`], ["paid", `Paid · ${count("paid")}`]]} value={st} onChange={setSt} />
      </div>

      {dlErr && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "6px 0" }}>{dlErr}</p>}

      {rows.length === 0 && (
        <p style={{ fontSize: TYPE.label.size, color: C.muted }}>{allRows.length ? "No invoices in this view." : "No invoices yet. Invoices appear here once they are finalized."}</p>
      )}

      {/* ── GROUPED LIST ── */}
      {grouped.map(yg => (
        <div key={yg.year}>
          <div style={{ marginBottom: 8, marginTop: 18 }}>
            <p style={{ fontSize: TYPE.subtext.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: 0, fontWeight: "600" }}>{yg.year}</p>
          </div>
          {yg.months.map(mg => (
            <div key={mg.month} style={{ marginBottom: 14 }}>
              <div style={{ padding: "6px 0", borderBottom: `1px solid ${C.rule}` }}>
                <p style={{ fontSize: TYPE.subtext.size, color: C.light, letterSpacing: "0.09em", textTransform: "uppercase" as const, margin: 0 }}>{MO_LONG[mg.month]} {yg.year}</p>
              </div>
              {mg.rows.map(r => {
                const d = r.doc;
                return (
                  <div key={r.key} onClick={() => setPreview(r)}
                    style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.rule}`, gap: 8, cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: TYPE.label.size, color: C.black, fontWeight: "500" }}>{d.docNo}</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{r.cName}</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.light }}>·</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 100 : 200 }}>{r.pr.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" as const, alignItems: "center" }}>
                        <span style={{ fontSize: TYPE.micro.size, color: C.light, letterSpacing: "0.07em" }}>{fmtD(d.docDate)}</span>
                        <span style={{ fontSize: TYPE.micro.size, color: C.light }}>·</span>
                        <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>{invoiceTypeLabel(d)}</span>
                        <span style={{ fontSize: TYPE.micro.size, color: stCol(d.status), border: `1px solid ${stCol(d.status)}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.06em" }}>
                          {STATUS_LABEL[d.status] || d.status}{d.paidAt ? ` · ${fmtD(d.paidAt)}` : ""}
                        </span>
                        {isOverdue(d, todayStr) && <span style={{ fontSize: TYPE.micro.size, color: C.red }}>overdue since {fmtD(d.dueDate)}</span>}
                      </div>
                    </div>
                    <span style={{ fontFamily: SERIF, fontSize: TYPE.subtext.size, color: C.black, flexShrink: 0 }}>{fmt(d.gross)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
