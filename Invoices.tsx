// ─────────────────────────────────────────────────────────────
// Invoices — grouped by year/month, bulk PDF download, CSV export
// filterTab prop: "unpaid" | "paid" | undefined (show all)
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, today } from "./formatters";

const MO_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MO_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CTYPE_LABEL: Record<string,string> = {
  influencer: "Collab (Influencer)",
  ugc:        "UGC",
  editorial:  "Editorial",
};

function getTypeOfWork(pr: any): string {
  if (!pr.amount || pr.amount === 0 || ["lead","quoted","revised"].includes(pr.status)) return "Unpaid";
  const ctab = pr.qd?.ctab || "";
  return CTYPE_LABEL[ctab] || "Unpaid";
}

function buildInvoiceRows(clients: any[]) {
  const rows: any[] = [];
  clients.forEach((c: any) => {
    (c.projects || []).forEach((pr: any) => {
      if (!["invoiced","paid"].includes(pr.status) && !pr.paid) return;
      const q = pr.qd;
      if (!q) return;
      const iNo     = `INV-${(q.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
      const dateStr = pr.date || q.date || "";
      rows.push({
        cid: c.id, cName: c.name, pr, iNo, dateStr,
        year:  dateStr ? parseInt(dateStr.slice(0,4))   : 0,
        month: dateStr ? parseInt(dateStr.slice(5,7))-1 : 0,
      });
    });
  });
  rows.sort((a,b) => b.dateStr.localeCompare(a.dateStr));
  return rows;
}

function exportCSV(rows: any[], label: string) {
  const headers = ["Invoice No.","Client","Project","Type of Work","Income","Delivery Date","Payment Status"];
  const lines = [headers, ...rows.map(r => {
    const pr = r.pr;
    const income = pr.amount ? `€ ${Number(pr.amount).toFixed(2).replace(".",",")}` : "€ 0,00";
    return [r.iNo, r.cName, pr.name, getTypeOfWork(pr), income, pr.deliveryDate || "", pr.paid ? "paid" : "invoiced"];
  })];
  const csv  = lines.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `${label.replace(/\s/g,"_")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

interface InvoicesProps {
  clients:   any[];
  settings:  any;
  isMobile:  boolean;
  filterTab?: "unpaid" | "paid";
}

export default function Invoices({ clients, settings, isMobile, filterTab }: InvoicesProps) {
  const [pdfData,    setPdfData]    = useState<any>(null);
  const [dropOpen,   setDropOpen]   = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [PDFModal,   setPDFModal]   = useState<any>(null);

  const allRows = buildInvoiceRows(clients);
  const rows    = filterTab === "unpaid" ? allRows.filter((r: any) => !r.pr.paid)
                : filterTab === "paid"   ? allRows.filter((r: any) => r.pr.paid)
                : allRows;

  const openPreview = (r: any) => {
    const pr = r.pr; const q = pr.qd;
    import("./PDFModal").then(m => setPDFModal(() => m.default));
    setPdfData({
      data: { brand: q?.brand, contact: q?.contact, date: pr.date || today(), qNo: q?.qNo, iNo: r.iNo, delivery: pr.deliveryDate, ctype: q?.ctype || "Content Creator", lines: q?.lines || [], amendments: pr.amendments || [], total: pr.amount, footer: "Thank you for the pleasure of working together." },
      type: "invoice",
    });
  };

  const bulkDownload = async (rows: any[], label: string) => {
    if (!rows.length) return;
    setDropOpen(false);
    setBulkStatus(`Preparing ${rows.length} invoice${rows.length > 1 ? "s" : ""}…`);
    const [{ default: html2canvas }, { default: jsPDF }, { default: A4Document }] = await Promise.all([
      import("html2canvas"), import("jspdf"), import("./A4Document"),
    ]);
    const { createRoot } = await import("react-dom/client");
    const { createElement } = await import("react");
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const pr = r.pr; const q = pr.qd;
      const d = { brand: q?.brand, contact: q?.contact, date: pr.date || today(), qNo: q?.qNo, iNo: r.iNo, delivery: pr.deliveryDate, ctype: q?.ctype || "Content Creator", lines: q?.lines || [], amendments: pr.amendments || [], total: pr.amount, footer: "Thank you for the pleasure of working together." };
      setBulkStatus(`Saving ${i + 1} / ${rows.length} — ${r.iNo}`);
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:595px;z-index:-1;background:#faf9f7;";
      document.body.appendChild(wrap);
      const root = createRoot(wrap);
      await new Promise<void>(res => {
        root.render(createElement(A4Document, { d, type: "invoice", lang: "en", settings, extraSigMargin: 0, clauseGuards: [], tRowGuards: [] }));
        setTimeout(res, 600);
      });
      try {
        const pages = Array.from(wrap.querySelectorAll("[data-pdf-page]")) as HTMLElement[];
        const pdf = new (jsPDF as any)({ orientation: "portrait", unit: "mm", format: "a4" });
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        for (let p = 0; p < pages.length; p++) {
          if (p > 0) pdf.addPage();
          const canvas = await (html2canvas as any)(pages[p], { scale: 2, useCORS: true, backgroundColor: "#faf9f7" });
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pw, ph);
        }
        pdf.save(`${(pr.date || "").replace(/-/g,"_")} ${r.iNo}.pdf`);
      } finally {
        root.unmount();
        document.body.removeChild(wrap);
      }
      if (i < rows.length - 1) await new Promise(res => setTimeout(res, 400));
    }
    setBulkStatus(null);
  };

  // Group by year → month
  const grouped: { year: number; months: { month: number; rows: any[] }[] }[] = [];
  rows.forEach((r: any) => {
    let yg = grouped.find(g => g.year === r.year); if (!yg) { yg = { year: r.year, months: [] }; grouped.push(yg); }
    let mg = yg.months.find(m => m.month === r.month); if (!mg) { mg = { month: r.month, rows: [] }; yg.months.push(mg); }
    mg.rows.push(r);
  });

  const monthOptions = grouped.flatMap(yg => yg.months.map(mg => ({ label: `${MO_LONG[mg.month]} ${yg.year}`, rows: mg.rows })));

  const btnStyle: any = { height: 28, padding: "0 10px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.07em", color: C.muted, display: "flex", alignItems: "center", whiteSpace: "nowrap" as const };

  if (pdfData && PDFModal) {
    return <PDFModal data={pdfData.data} type={pdfData.type} onClose={() => { setPdfData(null); }} settings={settings} />;
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap" as const, gap: 8 }}>
        {!filterTab && <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0 }}>Invoices</h2>}
        {filterTab && <div />}
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {/* Bulk download dropdown */}
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
                  <button key={i} onClick={() => bulkDownload(opt.rows, opt.label)}
                    style={{ display: "block", width: "100%", padding: "8px 13px", background: "none", border: "none", borderBottom: i < monthOptions.length - 1 ? `1px solid ${C.rule}` : "none", cursor: "pointer", textAlign: "left" as const, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.muted, boxSizing: "border-box" as const }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* CSV export */}
          <button onClick={() => exportCSV(rows, filterTab || "all_invoices")} title="Export as CSV" style={btnStyle}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M7 9l-3-3M7 9l3-3M2 11h10" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {rows.length === 0 && (
        <p style={{ fontSize: TYPE.label.size, color: C.muted }}>No invoices yet. Projects move here once invoiced or paid.</p>
      )}

      {/* ── GROUPED LIST ── */}
      {grouped.map(yg => (
        <div key={yg.year}>
          <div style={{ marginBottom: 8, marginTop: 18 }}>
            <p style={{ fontSize: TYPE.subtext.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: 0, fontWeight: "600" }}>{yg.year}</p>
          </div>
          {yg.months.map(mg => (
            <div key={mg.month} style={{ marginBottom: 14 }}>
              <div style={{ padding: "6px 0", borderBottom: `1px solid ${C.rule}`, marginBottom: 0 }}>
                <p style={{ fontSize: TYPE.subtext.size, color: C.light, letterSpacing: "0.09em", textTransform: "uppercase" as const, margin: 0 }}>{MO_LONG[mg.month]} {yg.year}</p>
              </div>
              {mg.rows.map((r: any, i: number) => {
                const pr = r.pr;
                return (
                  <div key={r.iNo + i}
                    onClick={() => openPreview(r)}
                    style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.rule}`, gap: 8, cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: TYPE.label.size, color: C.black, fontWeight: "500" }}>{r.iNo}</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{r.cName}</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.light }}>·</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 100 : 200 }}>{pr.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" as const, alignItems: "center" }}>
                        <span style={{ fontSize: TYPE.micro.size, color: C.light, letterSpacing: "0.07em" }}>{fmtD(pr.date)}</span>
                        <span style={{ fontSize: TYPE.micro.size, color: C.light }}>·</span>
                        <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>{getTypeOfWork(pr)}</span>
                        <span style={{ fontSize: TYPE.micro.size, color: pr.paid ? C.green : C.amber, border: `1px solid ${pr.paid ? C.green : C.amber}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.06em" }}>
                          {pr.paid ? "Paid" : "Invoiced"}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontFamily: SERIF, fontSize: TYPE.subtext.size, color: C.black, flexShrink: 0 }}>{fmt(pr.amount)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); openPreview(r); }}
                      style={{ fontSize: TYPE.micro.size, padding: "4px 9px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", color: C.muted, fontFamily: SANS, letterSpacing: "0.06em", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                      Save PDF
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
