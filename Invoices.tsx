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
import { downloadDocs } from "./DocPages";
import { invoiceRows, invoicesCsv, invoiceTypeLabel, docFileName, STATUS_LABEL, isOpenInvoice, isPaidInvoice, isOverdue } from "./docs";
import type { InvoiceRow } from "./docs";

const MO_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function downloadCsv(rows: InvoiceRow[], label: string) {
  const blob = new Blob(["\uFEFF" + invoicesCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `${label.replace(/\s/g, "_")}.csv`; a.click();
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

  const bulkDownload = async (list: InvoiceRow[]) => {
    if (!list.length || bulkStatus) return;
    setDropOpen(false);
    setBulkStatus(`Preparing ${list.length} invoice${list.length > 1 ? "s" : ""}…`);
    try {
      await downloadDocs(list.map(r => ({ doc: r.doc, settings, client: r.client, filename: docFileName(r.doc) })), msg => setBulkStatus(msg));
    } finally {
      setBulkStatus(null);
    }
  };

  // Group by year → month
  const grouped: { year: number; months: { month: number; rows: InvoiceRow[] }[] }[] = [];
  rows.forEach(r => {
    let yg = grouped.find(g => g.year === r.year); if (!yg) { yg = { year: r.year, months: [] }; grouped.push(yg); }
    let mg = yg.months.find(m => m.month === r.month); if (!mg) { mg = { month: r.month, rows: [] }; yg.months.push(mg); }
    mg.rows.push(r);
  });
  const monthOptions = grouped.flatMap(yg => yg.months.map(mg => ({ label: `${MO_LONG[mg.month]} ${yg.year}`, rows: mg.rows })));

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
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {/* Bulk download by month */}
          <div style={{ position: "relative" }}>
            {dropOpen && <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setDropOpen(false)} />}
            <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden" }}>
              <span style={{ ...btnStyle, border: "none", borderRadius: 0, borderRight: `1px solid ${C.rule}`, paddingRight: 9, cursor: "default", color: bulkStatus ? C.light : C.muted }}>
                {bulkStatus || "Download"}
              </span>
              <button onClick={() => !bulkStatus && setDropOpen(o => !o)} style={{ ...btnStyle, border: "none", borderRadius: 0, padding: "0 8px", position: "relative", zIndex: 200, opacity: bulkStatus ? 0.4 : 1 }}>▾</button>
            </div>
            {dropOpen && monthOptions.length > 0 && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 170, zIndex: 200, maxHeight: 260, overflowY: "auto" }}>
                {monthOptions.map((opt, i) => (
                  <button key={i} onClick={() => bulkDownload(opt.rows)}
                    style={{ display: "block", width: "100%", padding: "8px 13px", background: "none", border: "none", borderBottom: i < monthOptions.length - 1 ? `1px solid ${C.rule}` : "none", cursor: "pointer", textAlign: "left" as const, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.muted, boxSizing: "border-box" as const }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* CSV export */}
          <button onClick={() => downloadCsv(rows, st === "all" ? "all_invoices" : `${st}_invoices`)} title="Export as CSV" style={btnStyle}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M7 9l-3-3M7 9l3-3M2 11h10" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <Segmented<F> options={[["all", `All · ${count("all")}`], ["unpaid", `Unpaid · ${count("unpaid")}`], ["overdue", `Overdue · ${count("overdue")}`], ["paid", `Paid · ${count("paid")}`]]} value={st} onChange={setSt} />
      </div>

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
                    <button
                      onClick={e => { e.stopPropagation(); bulkDownload([r]); }}
                      disabled={!!bulkStatus}
                      style={{ fontSize: TYPE.micro.size, padding: "4px 9px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: bulkStatus ? "default" : "pointer", color: C.muted, fontFamily: SANS, letterSpacing: "0.06em", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                      PDF
                    </button>
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
