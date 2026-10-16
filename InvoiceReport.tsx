// ─────────────────────────────────────────────────────────────
// InvoiceReport — the invoice overview as ONE PDF (year or month).
// A4 landscape pages in the same look as the documents: header,
// title, table (oldest first), month subtotals in the year file,
// totals at the end, page numbers. Saved through the same
// iPhone-safe path as "Save PDF".
// ─────────────────────────────────────────────────────────────

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { C, SANS, SERIF, PDF } from "./constants";
import { fmt, fmtD, today } from "./formatters";
import { SETTINGS_DEFAULT } from "./rateCards";
import { invoiceTotals, invoiceTypeLabel, reportStatus, sortForReport, MONTH_DE } from "./docs";
import type { InvoiceRow } from "./docs";
import { openPdfWindow, pagesToPdf, deliverPdf } from "./PDFExport";

const W = 842, H = 595;          // A4 landscape
const PX = 40;                    // side margin
const ROW_H = 17;
const FIRST_UNITS = 23;           // lines that fit on page 1 (title takes space)
const NEXT_UNITS  = 27;           // lines on the following pages
const TOTAL_UNITS = 7;            // the totals block

// columns (sum = 762 = W − 2 × PX)
const COLS: { key: string; label: string; w: number; right?: boolean }[] = [
  { key: "no",     label: "Invoice No.", w: 86 },
  { key: "date",   label: "Date",        w: 58 },
  { key: "client", label: "Client",      w: 104 },
  { key: "proj",   label: "Project",     w: 120 },
  { key: "type",   label: "Type",        w: 90 },
  { key: "net",    label: "Net",         w: 64, right: true },
  { key: "vat",    label: "VAT",         w: 52, right: true },
  { key: "gross",  label: "Gross",       w: 66, right: true },
  { key: "status", label: "Status",      w: 62 },
  { key: "paid",   label: "Paid on",     w: 60 },
];

type Totals = ReturnType<typeof invoiceTotals>;
type Line =
  | { t: "month"; label: string }
  | { t: "row";   r: InvoiceRow }
  | { t: "sub";   label: string; tot: Totals }
  | { t: "total" };

// Lines of the report (year: grouped by month with subtotals)
function buildLines(rows: InvoiceRow[], byMonth: boolean): Line[] {
  const sorted = sortForReport(rows);
  if (!byMonth) return [...sorted.map(r => ({ t: "row", r }) as Line), { t: "total" }];
  const out: Line[] = [];
  const keys = Array.from(new Set(sorted.map(r => `${r.year}-${String(r.month).padStart(2, "0")}`)));
  keys.forEach(k => {
    const [y, m] = k.split("-").map(Number);
    const mRows = sorted.filter(r => r.year === y && r.month === m);
    out.push({ t: "month", label: `${MONTH_DE[m]} ${y}` });
    mRows.forEach(r => out.push({ t: "row", r }));
    out.push({ t: "sub", label: `${MONTH_DE[m]} ${y}`, tot: invoiceTotals(mRows) });
  });
  out.push({ t: "total" });
  return out;
}

const units = (l: Line) => (l.t === "total" ? TOTAL_UNITS : l.t === "month" ? 1.4 : l.t === "sub" ? 1.3 : 1);

// Split lines into pages (a month title never stays alone at a page bottom)
export function paginate(lines: Line[]): Line[][] {
  const pages: Line[][] = [[]];
  let used = 0;
  lines.forEach((l, i) => {
    const cap = pages.length === 1 ? FIRST_UNITS : NEXT_UNITS;
    const need = units(l) + (l.t === "month" && lines[i + 1]?.t === "row" ? 1 : 0);
    if (used + need > cap && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(l);
    used += units(l);
  });
  return pages;
}

const cell = (w: number, right?: boolean, extra: any = {}): any => ({
  width: w, flexShrink: 0, paddingRight: right ? 6 : 4, paddingLeft: right ? 0 : 0, textAlign: right ? "right" : "left",
  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", boxSizing: "border-box", ...extra,
});

function Row({ r, todayStr }: { r: InvoiceRow; todayStr: string }) {
  const d = r.doc;
  const st = reportStatus(d, todayStr);
  const stCol = st === "Overdue" ? C.red : st === "Paid" ? C.green : st === "Cancelled" ? PDF.label : PDF.ink;
  const muted = d.status === "cancelled";
  return (
    <div style={{ display: "flex", alignItems: "center", height: ROW_H, borderBottom: `0.5px solid ${PDF.rule}`, fontSize: 7.5, color: muted ? PDF.label : PDF.ink }}>
      <div style={cell(86)}>{d.docNo}</div>
      <div style={cell(58)}>{d.docDate ? fmtD(d.docDate) : ""}</div>
      <div style={cell(104)}>{r.cName}</div>
      <div style={cell(120)}>{r.pr?.name || ""}</div>
      <div style={cell(90)}>{invoiceTypeLabel(d)}</div>
      <div style={cell(64, true)}>{fmt(Number(d.net) || 0)}</div>
      <div style={cell(52, true)}>{fmt(Number(d.vat) || 0)}</div>
      <div style={cell(66, true)}>{fmt(Number(d.gross) || 0)}</div>
      <div style={cell(62, false, { color: d.subtype === "storno" ? PDF.label : stCol })}>
        {d.subtype === "storno" ? `↩ ${d.data?.cancelsNo || ""}` : st}
      </div>
      <div style={cell(60)}>{d.paidAt ? fmtD(d.paidAt) : ""}</div>
    </div>
  );
}

export function ReportPages({ title, rows, byMonth, settings, created }: {
  title: string; rows: InvoiceRow[]; byMonth: boolean; settings: any; created?: string;
}) {
  const s = { ...SETTINGS_DEFAULT, ...(settings || {}) };
  const todayStr = created || today();
  const pages = paginate(buildLines(rows, byMonth));
  const tot = invoiceTotals(rows);
  const who = [s.name, s.company && s.company !== s.name ? s.company : ""].filter(Boolean).join(" · ");

  return (
    <>
      {pages.map((lines, pi) => (
        <div key={pi} data-report-page="true"
          style={{ width: W, height: H, position: "relative", overflow: "hidden", background: PDF.page, fontFamily: SANS, color: PDF.ink }}>
          {/* header strip */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 36, borderBottom: `1px solid ${PDF.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${PX}px` }}>
            <span style={{ fontSize: 7, letterSpacing: 0, color: PDF.faint, textTransform: "uppercase" as const }}>{s.company || s.name || "LH Studio"}</span>
            <span style={{ fontSize: 7, letterSpacing: 0, color: PDF.faint, textTransform: "uppercase" as const }}>Invoice overview</span>
          </div>

          <div style={{ position: "absolute", top: 36, left: PX, right: PX, bottom: 40, paddingTop: pi === 0 ? 18 : 14 }}>
            {pi === 0 && (
              <div style={{ marginBottom: 14 }}>
                <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 4px" }}>{title}</h1>
                <p style={{ fontSize: 7.5, color: PDF.label, margin: 0 }}>
                  {who}{who ? " · " : ""}created {fmtD(todayStr)} · {tot.count} {tot.count === 1 ? "invoice" : "invoices"} · by invoice date
                </p>
              </div>
            )}
            {/* table head */}
            <div style={{ display: "flex", height: 18, alignItems: "flex-end", paddingBottom: 3, borderBottom: `1px solid ${PDF.ink}`, fontSize: 7, letterSpacing: 0, textTransform: "uppercase" as const, color: PDF.label }}>
              {COLS.map(c => <div key={c.key} style={cell(c.w, c.right)}>{c.label}</div>)}
            </div>

            {lines.map((l, li) => {
              if (l.t === "row") return <Row key={li} r={l.r} todayStr={todayStr} />;
              if (l.t === "month") return (
                <div key={li} style={{ height: ROW_H * 1.4, display: "flex", alignItems: "flex-end", paddingBottom: 3, fontSize: 7.5, fontWeight: 600, letterSpacing: 0, textTransform: "uppercase" as const }}>{l.label}</div>
              );
              if (l.t === "sub") return (
                <div key={li} style={{ display: "flex", alignItems: "center", height: ROW_H * 1.3, fontSize: 7.5, fontWeight: 600, borderTop: `0.5px solid ${PDF.label}` }}>
                  <div style={cell(86 + 58 + 104 + 120 + 90)}>Subtotal {l.label} · {l.tot.count} {l.tot.count === 1 ? "invoice" : "invoices"}</div>
                  <div style={cell(64, true)}>{fmt(l.tot.net)}</div>
                  <div style={cell(52, true)}>{fmt(l.tot.vat)}</div>
                  <div style={cell(66, true)}>{fmt(l.tot.gross)}</div>
                  <div style={cell(122, false, { color: PDF.label, fontWeight: 400 })}>open {fmt(l.tot.open)}</div>
                </div>
              );
              return (
                <div key={li} style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                  <div style={{ width: 260, borderTop: `1px solid ${PDF.ink}`, paddingTop: 6, fontSize: 8 }}>
                    {[
                      ["Invoices", String(tot.count)],
                      ["Net", fmt(tot.net)],
                      ["VAT", fmt(tot.vat)],
                      ["Gross", fmt(tot.gross)],
                      ["Paid", fmt(tot.paid)],
                      ["Open", fmt(tot.open)],
                    ].map(([k, v], i) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: i === 3 ? 600 : 400, borderTop: i === 4 ? `0.5px solid ${PDF.rule}` : "none" }}>
                        <span style={{ color: i >= 4 ? PDF.label : PDF.ink }}>{k}</span>
                        <span style={{ fontFamily: SERIF }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* footer strip */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, borderTop: `1px solid ${PDF.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${PX}px`, fontSize: 7, color: PDF.label }}>
            <span>{[s.email, s.website].filter(Boolean).join(" · ")}</span>
            <span style={{ color: PDF.faint }}>{pi + 1} / {pages.length}</span>
          </div>
        </div>
      ))}
    </>
  );
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// Build the overview off-screen and save it as ONE PDF
export async function downloadInvoiceReport(p: {
  rows: InvoiceRow[]; title: string; filename: string; settings: any; byMonth: boolean;
}): Promise<void> {
  const mw = openPdfWindow();                 // must happen in the tap, before any waiting (iPhone)
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;pointer-events:none;`;
  document.body.appendChild(wrap);
  const root = createRoot(wrap);
  try {
    flushSync(() => root.render(<ReportPages title={p.title} rows={p.rows} byMonth={p.byMonth} settings={p.settings} />));
    for (let i = 0; i < 100 && !wrap.querySelector("[data-report-page]"); i++) await wait(20);
    try { await (document as any).fonts?.ready; } catch { /* fonts are optional */ }
    await wait(60);
    const pages = Array.from(wrap.querySelectorAll("[data-report-page]")) as HTMLElement[];
    if (!pages.length) throw new Error("The overview could not be prepared.");
    const pdf = await pagesToPdf(pages, "landscape");
    deliverPdf(pdf, p.filename, mw);
  } catch (e) {
    mw?.close();
    throw e;
  } finally {
    root.unmount();
    wrap.remove();
  }
}
