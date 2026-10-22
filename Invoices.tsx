// ─────────────────────────────────────────────────────────────
// Invoices — every issued invoice (project, retainer month,
// renewal, Storno). Chips All · Unpaid · Overdue · Paid, grouped by
// month: the invoice date, or the PAID date in the Paid view (when
// the money came in — same as the dashboard). Overdue first in a
// month. Tap → preview. Export a year or month as PDF or CSV.
// filterTab / focusMonth ("2026-10") come from a dashboard card.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL, TRACK, RADIUS, SHADOW } from "./constants";
import { fmt, fmtD, today, MONTHS } from "./formatters";
import { Ico, IC } from "./PlannerWindows";
import { Chip, useScreen } from "./atoms";
import PDFModal from "./PDFModal";
import { downloadInvoiceReport } from "./InvoiceReport";
import { saveFile } from "./PDFExport";
import { invoiceActions } from "./docFlow";
import { invoiceRows, invoicesCsv, invoiceTypeLabel, invoicePeriods, isOpenInvoice, isPaidInvoice, isOverdue, paidDateOf, MONTH_DE } from "./docs";
import type { InvoiceRow, InvoicePeriod } from "./docs";

const MO_LONG = MONTHS;               // the screen in English; the bookkeeping PDF / CSV stay German

function downloadCsv(rows: InvoiceRow[], filename: string) {
  const blob = new Blob(["\uFEFF" + invoicesCsv(rows)], { type: "text/csv;charset=utf-8;" });
  saveFile(blob, `${filename}.csv`);           // phone: share sheet · computer: download
}

interface InvoicesProps {
  clients:    any[];
  settings:   any;
  isMobile:   boolean;
  filterTab?: "unpaid" | "paid" | "overdue";
  focusMonth?: string | null;
  clientsHook?: any;                              // the invoice window's actions (Mark paid, Cancel …)
  onOpenProject?: (projectId: string) => void;   // "Open project" → Projects with it open
}
type ToneSet = { fill: string; wash: string; mid: string; ink: string };

export default function Invoices({ clients, settings, isMobile, filterTab, focusMonth, clientsHook, onOpenProject }: InvoicesProps) {
  // the open invoice by id: the window always shows the live invoice (after Mark paid: Paid;
  // after Cancel: the new Storno)
  const [openKey,    setOpenKey]    = useState<string | null>(null);
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
    g.rows.push(r); g.total += Number(st === "paid" ? r.doc.net : r.doc.gross) || 0;   // the same measure as the header
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
  // computer: one table, like Contacts — client · no. · type · date · due / paid · amount · status
  const { isWide } = useScreen();
  const COLS = "30px minmax(0,2.2fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,1fr) 130px 15px";
  const whenText = (d: any) => isPaidInvoice(d) && d.paidAt ? `paid ${fmtD(d.paidAt)}` : isOpenInvoice(d) && d.dueDate ? `due ${fmtD(d.dueDate)}` : "—";
  const cell: any = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
  const metaText = (r: InvoiceRow) => {
    const d = r.doc;
    const when = isPaidInvoice(d) && d.paidAt ? `paid ${fmtD(d.paidAt).slice(0, 6)}` : isOpenInvoice(d) && d.dueDate ? `due ${fmtD(d.dueDate).slice(0, 6)}` : fmtD(d.docDate);
    const type = invoiceTypeLabel(d);
    return [d.docNo, type !== "Project" ? type : null, when].filter(Boolean).join(" · ");
  };
  const shown = rows.reduce((s, r) => s + (Number(st === "paid" ? r.doc.net : r.doc.gross) || 0), 0);
  const chip = (f: F, label: string) => (
    <Chip key={f} on={st === f} tone={toneOfF(f)} dot={f !== "all"} label={label} count={count(f)} onClick={() => setSt(f)} />
  );

  const openRow = openKey ? allRows.find(r => r.key === openKey) : null;
  if (openRow) {
    const d = openRow.doc;
    const actions = clientsHook ? invoiceActions(clientsHook, openRow.cid, openRow.pr.id, d, settings, {
      storno: (id) => setOpenKey(id),
      openProject: onOpenProject ? () => { setOpenKey(null); onOpenProject(openRow.pr.id); } : undefined,
    }) : [];
    return <PDFModal key={d.id} doc={d} settings={settings} client={openRow.client} editable={false} actions={actions} onClose={() => setOpenKey(null)} />;
  }

  const btnStyle: any = { height: 30, padding: "0 10px", border: `1px solid ${C.rule}`, borderRadius: RADIUS.pill, background: C.white, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: C.black, display: "flex", alignItems: "center", whiteSpace: "nowrap" as const };
  const ft = toneOfF(st);

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      {/* ── HEADER: title, what's shown, export ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Invoices</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: TYPE.subtext.size, color: C.muted, marginTop: 4 }}>
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
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: RADIUS.pill, background: C.white, border: `1px solid ${C.edge}`, fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.black, position: "relative", zIndex: 200, opacity: periods.length ? 1 : 0.45, cursor: periods.length && !bulkStatus ? "pointer" : "default" }}>
            <Ico d={IC.download} size={14} />{bulkStatus || "Export"}
          </button>
          {dropOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: C.white, border: `1px solid ${C.rule}`, borderRadius: RADIUS.tile, boxShadow: SHADOW.pop, minWidth: 250, zIndex: 200, maxHeight: 320, overflowY: "auto", padding: "4px 0" }}>
              {periods.map((p, i) => (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: p.kind === "year" ? "8px 12px" : "5px 12px 5px 22px", borderTop: i > 0 && p.kind === "year" ? `1px solid ${C.hair}` : "none" }}>
                  <span style={{ flex: 1, fontSize: TYPE.subtext.size, color: p.kind === "year" ? C.black : C.muted, fontWeight: p.kind === "year" ? 500 : 400 }}>{p.uiLabel || p.label}</span>
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

      {dlErr && <p style={{ fontSize: TYPE.subtext.size, color: C.red, margin: "8px 0 0" }}>{dlErr}</p>}
      {rows.length === 0 && (
        <p style={{ fontSize: TYPE.row.size, color: C.muted, margin: "16px 4px" }}>{allRows.length ? "No invoices in this view." : "No invoices yet. They appear here once they're finalized."}</p>
      )}

      {/* computer: the column names once, above the months */}
      {isWide && rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: COLS, columnGap: 10, padding: "14px 10px 0 12px", fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>
          <span /><span>Client · project</span><span>No.</span><span>Type</span><span>Date</span><span>Due / paid</span><span style={{ textAlign: "right" as const }}>Amount</span><span style={{ textAlign: "right" as const }}>Status</span><span />
        </div>
      )}

      {/* ── MONTHS ── */}
      {groups.map(g => (
        <div key={g.key} id={`inv-${g.key}`}>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 4px 6px", fontSize: TYPE.label.size, color: PAL.neutral.ink }}>
            <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>{MO_LONG[g.month]} {g.year}</span>
            <span>{fmt(g.total)}</span>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, overflow: "hidden" }}>
            {g.rows.map((r, i) => {
              const d = r.doc, t = rowTone(d);
              if (isWide) return (
                <div key={r.key} role="button" tabIndex={0} onClick={() => setOpenKey(r.key)} onKeyDown={(e) => { if (e.key === "Enter") setOpenKey(r.key); }}
                  style={{ display: "grid", gridTemplateColumns: COLS, columnGap: 10, alignItems: "center", minHeight: 48, padding: "6px 10px 6px 12px", borderTop: i ? `1px solid ${C.hair}` : "none", cursor: "pointer", fontSize: TYPE.subtext.size }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: t.wash, color: t.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico d={rowIcon(d)} size={15} /></span>
                  <span style={{ ...cell, fontSize: TYPE.body.size }}>{r.cName}<span style={{ color: C.muted }}> · {r.pr.name}</span></span>
                  <span style={cell}>{d.docNo || "—"}</span>
                  <span style={{ ...cell, color: C.muted }}>{invoiceTypeLabel(d)}</span>
                  <span style={{ ...cell, color: C.muted }}>{fmtD(d.docDate)}</span>
                  <span style={{ ...cell, color: C.muted }}>{whenText(d)}</span>
                  <span style={{ ...cell, textAlign: "right" as const, fontSize: TYPE.body.size }}>{fmt(d.gross)}</span>
                  <span style={{ textAlign: "right" as const, minWidth: 0 }}><span style={{ display: "inline-block", fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, padding: "2px 8px", borderRadius: RADIUS.tag, background: t.fill, color: t.ink, whiteSpace: "nowrap" as const }}>{tagText(d)}</span></span>
                  <Ico d={IC.right} size={15} color={C.faint} />
                </div>
              );
              return (
                <div key={r.key} role="button" tabIndex={0} onClick={() => setOpenKey(r.key)} onKeyDown={(e) => { if (e.key === "Enter") setOpenKey(r.key); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "7px 10px 7px 12px", borderTop: i ? `1px solid ${C.hair}` : "none", cursor: "pointer" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: t.wash, color: t.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={rowIcon(d)} size={15} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: TYPE.body.size, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{r.cName}<span style={{ color: C.muted }}> · {r.pr.name}</span></div>
                    <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{metaText(r)}</div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div style={{ fontSize: TYPE.body.size, whiteSpace: "nowrap" as const }}>{fmt(d.gross)}</div>
                    <span style={{ display: "inline-block", fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, padding: "2px 8px", borderRadius: RADIUS.tag, marginTop: 3, background: t.fill, color: t.ink, whiteSpace: "nowrap" as const }}>{tagText(d)}</span>
                  </div>
                  <Ico d={IC.right} size={15} color={C.faint} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
