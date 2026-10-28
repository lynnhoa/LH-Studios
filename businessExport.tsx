// ─────────────────────────────────────────────────────────────
// businessExport — the bookkeeping files of a year, a month or one
// trip / event, in German (for the tax office), like Maintenance's:
//   Kostenübersicht  ONE PDF, A4 landscape: every position in number order
//                    (the year: by month with subtotals), totals, by EÜR group
//   Belege           ONE PDF (the Invoices print): in number order — a trip's /
//                    event's report first, then its receipts — each receipt page
//                    shrunk a little so its number fits on top (bold), a
//                    Bewirtungsbeleg after a business meal, a page for a missing file
//   Excel            every position as a row (+ a sheet by EÜR group and month)
// Which positions: a year / month = every receipt dated in it (all tabs) and the meal
// allowance and km of the trips that start in it; a trip / event = its own.
// ─────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SERIF, PDF } from "./constants";
import { fmt, fmtD, today, r2 } from "./formatters";
import { openPdfWindow, deliverPdf, saveFile } from "./PDFExport";
import { makeXlsx, saveBytes, XLSX_MIME } from "./xlsxWriter";
import { supabase } from "./useSupabase";
import {
  numbersOf, sortCases, sortCosts, costsOf, mealDays, kmAmount, yearOf, monthOf, netOf, vatOf, countedOf, shareOf, KM_RATE, BIZ_BUCKET,
} from "./business";
import type { BizCost, BizCase, BizCategory } from "./business";
import { renderBlocks, caseReportPdf, LANDSCAPE, H2, lbl, footOf, whoOf } from "./businessPdf";
import type { Block } from "./businessPdf";

export type Scope = { kind: "year"; year: number } | { kind: "month"; ym: string } | { kind: "case"; id: string };
export interface ExportData { costs: BizCost[]; cases: BizCase[]; cats: BizCategory[]; ku: boolean; settings: any }

const MONTH_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const monthDe = (ym: string) => `${MONTH_DE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const safe = (t: string) => String(t || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

export interface Line {
  key: string; no: string; date: string; what: string; vendor: string; group: string; catName: string;
  amount: number; net: number; vat: number; vatRate: number | null; share: number; counts: number; counted: number;
  receiptNo: string; file: "ja" | "fehlt" | "Pauschale"; area: string; caseTitle: string;
  anlass: string; guests: string; recipient: string; cost?: BizCost; x?: BizCase; order: number[];
}

// the number as a sort key: trips (T) · events (E) · one-off costs (K), then the numbers inside
const orderOf = (no: string): number[] => {
  const m = no.match(/^([TEK])(\d+)(?:\.(\d+))?/);
  if (!m) return [9, 0, 0];
  return [m[1] === "T" ? 0 : m[1] === "E" ? 1 : 2, Number(m[2]), m[3] ? Number(m[3]) : 0];
};
const cmpOrder = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function scopeOf(scope: Scope, d: ExportData) {
  const nums = numbersOf(d.costs, d.cases);
  const catOf = (id: string | null) => d.cats.find(c => c.id === id) || null;
  const caseOf = (id: string | null) => d.cases.find(x => x.id === id) || null;
  const inScope = (day: string) => (scope.kind === "year" ? yearOf(day) === scope.year : scope.kind === "month" ? monthOf(day) === scope.ym : true);
  const lineOf = (c: BizCost): Line => {
    const cat = catOf(c.categoryId), x = caseOf(c.caseId), no = nums.get(c.id) || "";
    return {
      key: c.id, no, date: c.date, what: c.what + (c.returnOf ? ` (Rückgabe ${nums.get(c.returnOf) || ""})` : ""), vendor: c.vendor,
      group: cat?.group || "Sonstiges", catName: cat?.name || "", amount: c.amount, net: netOf(c, d.ku), vat: vatOf(c, d.ku), vatRate: d.ku ? null : c.vatRate,
      share: shareOf(c, cat), counts: cat?.countsPct ?? 100, counted: countedOf(c, cat, d.ku), receiptNo: c.receiptNo,
      file: c.filePath ? "ja" : "fehlt", area: x ? (x.kind === "trip" ? "Reise" : "Veranstaltung") : "Einzelkosten", caseTitle: x?.title || "",
      anlass: c.anlass, guests: c.guests, recipient: c.recipient, cost: c, x: x || undefined, order: orderOf(no),
    };
  };
  const flat = (x: BizCase, key: string, no: string, what: string, amount: number, sub: number): Line => ({
    key, no, date: x.startDate, what, vendor: "", group: "Reisekosten", catName: "", amount, net: amount, vat: 0, vatRate: null,
    share: 100, counts: 100, counted: amount, receiptNo: "", file: "Pauschale", area: "Reise", caseTitle: x.title,
    anlass: "", guests: "", recipient: "", x, order: [...orderOf(no).slice(0, 2), sub],
  });
  const caseList = scope.kind === "case" ? d.cases.filter(x => x.id === scope.id) : sortCases(d.cases.filter(x => inScope(x.startDate || x.createdAt.slice(0, 10))));
  const costList = scope.kind === "case" ? costsOf(caseList[0] || ({ id: "-" } as any), d.costs) : sortCosts(d.costs.filter(c => inScope(c.date)));
  const lines: Line[] = costList.map(lineOf);
  caseList.filter(x => x.kind === "trip").forEach(x => {
    const no = nums.get(x.id) || "";
    const days = mealDays(x), meals = r2(days.reduce((s, dd) => s + dd.amount, 0)), km = kmAmount(x);
    if (meals > 0) lines.push(flat(x, `${x.id}-meals`, no, `Verpflegungsmehraufwand · ${days.length} ${days.length === 1 ? "Tag" : "Tage"}`, meals, 900));
    if (km > 0) lines.push(flat(x, `${x.id}-km`, no, `Fahrtkosten eigener Pkw · ${x.km.toLocaleString("de-DE")} km × ${fmt(KM_RATE)}`, km, 901));
  });
  lines.sort((a, b) => cmpOrder(a.order, b.order));
  const one = caseList[0];
  const label = scope.kind === "year" ? String(scope.year) : scope.kind === "month" ? monthDe(scope.ym) : `${nums.get(one?.id || "") || ""} ${one?.title || ""}`.trim();
  return { lines, nums, label, caseList };
}

// ── Kostenübersicht (PDF, A4 landscape) ─────────────────────
type Col = { k: string; l: string; w: number; r?: boolean };
const colsOf = (ku: boolean): Col[] => ku
  ? [{ k: "no", l: "Nr.", w: 40 }, { k: "date", l: "Datum", w: 56 }, { k: "what", l: "Beschreibung", w: 196 }, { k: "vendor", l: "Anbieter", w: 120 },
     { k: "group", l: "Kategorie (EÜR)", w: 120 }, { k: "file", l: "Beleg", w: 50 }, { k: "amount", l: "Betrag", w: 86, r: true }, { k: "counted", l: "Abziehbar", w: 94, r: true }]
  : [{ k: "no", l: "Nr.", w: 40 }, { k: "date", l: "Datum", w: 56 }, { k: "what", l: "Beschreibung", w: 150 }, { k: "vendor", l: "Anbieter", w: 100 },
     { k: "group", l: "Kategorie (EÜR)", w: 104 }, { k: "file", l: "Beleg", w: 46 }, { k: "net", l: "Netto", w: 70, r: true }, { k: "vat", l: "MwSt", w: 56, r: true },
     { k: "amount", l: "Brutto", w: 70, r: true }, { k: "counted", l: "Abziehbar", w: 70, r: true }];
const cellS = (c: Col, s: any = {}): any => ({ width: c.w, boxSizing: "border-box", flexShrink: 0, textAlign: c.r ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: c.r ? 0 : 6, ...s });
const val = (l: Line, k: string): string => {
  if (k === "date") return fmtD(l.date);
  if (k === "amount" || k === "net" || k === "vat" || k === "counted") return fmt((l as any)[k]);
  if (k === "what") return [l.what, l.counts !== 100 ? `· ${l.counts} %` : "", l.share !== 100 ? `· ${l.share} % betrieblich` : ""].filter(Boolean).join(" ");
  return String((l as any)[k] ?? "");
};
const sumOf = (ls: Line[]) => ({ amount: r2(ls.reduce((s, l) => s + l.amount, 0)), net: r2(ls.reduce((s, l) => s + l.net, 0)), vat: r2(ls.reduce((s, l) => s + l.vat, 0)), counted: r2(ls.reduce((s, l) => s + l.counted, 0)) });

function overviewBlocks(title: string, lines: Line[], byMonth: boolean, d: ExportData): Block[] {
  const cols = colsOf(d.ku);
  const out: Block[] = [];
  const add = (node: any, keep = false) => out.push({ node, keep });
  const row = (cells: string[], s: any = {}) => (
    <div style={{ display: "flex", alignItems: "center", minHeight: 17, borderBottom: `0.5px solid ${PDF.rule}`, fontSize: 7.5, ...s }}>
      {cols.map((c, i) => <div key={c.k} style={cellS(c)}>{cells[i] ?? ""}</div>)}
    </div>
  );
  const head = row(cols.map(c => c.l), { ...lbl, fontSize: 7, minHeight: 18, borderBottom: `1px solid ${PDF.ink}` });
  const tot = sumOf(lines);
  add(
    <div style={{ marginBottom: 12 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 4px" }}>Kostenübersicht · {title}</h1>
      <p style={{ fontSize: 7.5, color: PDF.label, margin: 0 }}>
        {whoOf(d.settings)} · erstellt am {fmtD(today())} · {lines.length} {lines.length === 1 ? "Position" : "Positionen"} · {d.ku ? "Beträge wie bezahlt (Kleinunternehmer, § 19 UStG)" : "Netto, MwSt und Brutto getrennt"} · nach Nummer
      </p>
    </div>
  );
  add(head, true);
  // the label spans the text columns, the sums sit under their amounts
  const firstNum = cols.findIndex(c => c.r);
  const subtotal = (label: string, ls: Line[]) => {
    const t: any = sumOf(ls);
    return (
      <div style={{ display: "flex", alignItems: "center", minHeight: 20, borderTop: `0.5px solid ${PDF.label}`, borderBottom: `0.5px solid ${PDF.rule}`, fontSize: 7.5, fontWeight: 600 }}>
        <div style={{ width: cols.slice(0, firstNum).reduce((w, c) => w + c.w, 0), flexShrink: 0 }}>Summe {label} · {ls.length} {ls.length === 1 ? "Position" : "Positionen"}</div>
        {cols.slice(firstNum).map(c => <div key={c.k} style={cellS(c)}>{fmt(t[c.k] ?? 0)}</div>)}
      </div>
    );
  };
  if (!lines.length) add(row(["", "", "Keine Positionen"]));
  if (byMonth) {
    const months = [...new Set(lines.map(l => monthOf(l.date)))].sort();
    months.forEach(ym => {
      const ls = lines.filter(l => monthOf(l.date) === ym);
      add(<div style={{ minHeight: 22, display: "flex", alignItems: "flex-end", paddingBottom: 3, fontSize: 7.5, fontWeight: 600, textTransform: "uppercase" as const }}>{monthDe(ym)}</div>, true);
      ls.forEach(l => add(row(cols.map(c => val(l, c.k)))));
      add(subtotal(monthDe(ym), ls));
    });
  } else lines.forEach(l => add(row(cols.map(c => val(l, c.k)))));
  // totals and the EÜR groups
  const groups = [...new Set(lines.map(l => l.group))].sort((a, b) => a.localeCompare(b, "de"));
  add(
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 16, alignItems: "flex-start" }}>
      <div style={{ width: 330, fontSize: 8 }}>
        <div style={{ ...lbl, paddingBottom: 3, borderBottom: `1px solid ${PDF.ink}` }}>Nach Kategorie (EÜR)</div>
        {groups.map(g => { const t = sumOf(lines.filter(l => l.group === g)); return (
          <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: `0.5px solid ${PDF.rule}` }}>
            <span>{g}</span><span>{fmt(t.amount)} · abziehbar <span style={{ fontFamily: SERIF }}>{fmt(t.counted)}</span></span>
          </div>); })}
      </div>
      <div style={{ width: 260, borderTop: `1px solid ${PDF.ink}`, paddingTop: 5, fontSize: 8 }}>
        {[...(d.ku ? [["Summe", fmt(tot.amount)]] : [["Netto", fmt(tot.net)], ["MwSt (Vorsteuer)", fmt(tot.vat)], ["Brutto", fmt(tot.amount)]]), ["Abziehbar", fmt(tot.counted)]].map(([k, v], i, a) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: i === a.length - 1 ? 600 : 400, borderTop: i === a.length - 1 ? `0.5px solid ${PDF.rule}` : "none" }}>
            <span>{k}</span><span style={{ fontFamily: SERIF }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return out;
}

// right in the tap (iPhone)
export async function downloadOverview(scope: Scope, d: ExportData): Promise<void> {
  const mw = openPdfWindow();
  try {
    const s = scopeOf(scope, d);
    const pdf = await renderBlocks(overviewBlocks(s.label, s.lines, scope.kind === "year", d), [whoOf(d.settings), "Kostenübersicht"], footOf(d.settings), LANDSCAPE);
    deliverPdf(pdf, `Kostenübersicht ${safe(s.label)}`, mw);
  } catch (e) { mw?.close(); throw e; }
}

// ── Excel ────────────────────────────────────────────────────
export function downloadExcel(scope: Scope, d: ExportData): void {
  const s = scopeOf(scope, d);
  const head = ["Nr.", "Datum", "Bereich", "Reise / Veranstaltung", "Beschreibung", "Anbieter", "Kategorie (EÜR)", "Kategorie (App)",
    "Betrag €", "MwSt %", "MwSt €", "Netto €", "Betrieblich %", "Abzug %", "Abziehbar €", "Rechnungs-/Bestellnr.", "Beleg", "Anlass", "Gäste", "Empfänger"];
  const rows: (string | number)[][] = [head, ...s.lines.map(l => [
    l.no, fmtD(l.date), l.area, l.caseTitle, l.what, l.vendor, l.group, l.catName, l.amount, l.vatRate ?? "", l.vat, l.net, l.share, l.counts, l.counted,
    l.receiptNo, l.file, l.anlass, l.guests, l.recipient,
  ])];
  const tot = sumOf(s.lines);
  rows.push(["Summe", "", "", "", "", "", "", "", tot.amount, "", tot.vat, tot.net, "", "", tot.counted, "", "", "", "", ""]);
  // by EÜR group (and month, for a year)
  const groups = [...new Set(s.lines.map(l => l.group))].sort((a, b) => a.localeCompare(b, "de"));
  const byYear = scope.kind === "year";
  const oHead = byYear ? ["Kategorie (EÜR)", ...MONTH_DE, "Summe abziehbar"] : ["Kategorie (EÜR)", "Betrag €", "Abziehbar €"];
  const oRows: (string | number)[][] = [oHead, ...groups.map(g => {
    const ls = s.lines.filter(l => l.group === g);
    if (!byYear) { const t = sumOf(ls); return [g, t.amount, t.counted]; }
    return [g, ...MONTH_DE.map((_, m) => r2(ls.filter(l => Number(l.date.slice(5, 7)) === m + 1).reduce((x, l) => x + l.counted, 0))), sumOf(ls).counted];
  })];
  const bytes = makeXlsx([
    { name: `Kosten ${s.label}`.slice(0, 31), rows, autoFilter: true, widths: [8, 11, 13, 24, 34, 22, 22, 22, 11, 8, 10, 11, 12, 9, 12, 20, 10, 26, 30, 20] },
    { name: "Übersicht", rows: oRows, widths: byYear ? [26, ...MONTH_DE.map(() => 11), 16] : [26, 12, 14] },
  ]);
  saveBytes(bytes, `Kosten ${safe(s.label)}.xlsx`, XLSX_MIME);
}

// ── Belege (the Invoices print) ─────────────────────────────
const WIN = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g;     // what the PDF's standard font can write
const win = (t: any) => String(t ?? "").replace(/↩/g, "Rückgabe").replace(/\s+/g, " ").replace(WIN, "");
const A4 = { w: 595.28, h: 841.89 };
const INK = rgb(0.1, 0.1, 0.1), GREY = rgb(0.29, 0.27, 0.25), RULE = rgb(0.79, 0.76, 0.72);

function wrap(text: string, font: any, size: number, width: number): string[] {
  const out: string[] = [];
  win(text).split(" ").forEach(w => {
    const last = out.length ? out[out.length - 1] : null;
    if (last !== null && font.widthOfTextAtSize(`${last} ${w}`, size) <= width) out[out.length - 1] = `${last} ${w}`;
    else out.push(w);
  });
  return out.length ? out : [""];
}

export async function downloadInvoices(scope: Scope, d: ExportData): Promise<void> {
  const mw = openPdfWindow();                 // in the tap (iPhone)
  try {
    const s = scopeOf(scope, d);
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const me = d.settings?.name || d.settings?.company || "";

    const stampText = (l: Line) => [fmtD(l.date), l.what, l.vendor, fmt(l.amount)].filter(Boolean).join(" · ");
    const infoPage = (title: string, rows: [string, string][], note: string) => {
      const p = doc.addPage([A4.w, A4.h]);
      p.drawText(win(title), { x: 50, y: A4.h - 80, size: 18, font: bold, color: INK });
      let y = A4.h - 112;
      rows.forEach(([k, v]) => {
        p.drawText(win(k), { x: 50, y, size: 8, font, color: GREY });
        wrap(v || "—", font, 10, 360).forEach((ln, i) => p.drawText(ln, { x: 185, y: y - i * 13, size: 10, font, color: INK }));
        y -= Math.max(1, wrap(v || "—", font, 10, 360).length) * 13 + 9;
        p.drawLine({ start: { x: 50, y: y + 5 }, end: { x: A4.w - 50, y: y + 5 }, thickness: 0.4, color: RULE });
      });
      if (note) wrap(note, font, 9, A4.w - 100).forEach((ln, i) => p.drawText(ln, { x: 50, y: y - 14 - i * 12, size: 9, font, color: GREY }));
      return { p, y };
    };
    // one receipt: its pages, each shrunk under a band with its number
    const addReceipt = async (l: Line) => {
      const c = l.cost!;
      let src: PDFDocument | null = null;
      if (c.filePath) {
        try {
          const r: any = await supabase.storage.from(BIZ_BUCKET).download(c.filePath);
          if (r?.data) src = await PDFDocument.load(await r.data.arrayBuffer(), { ignoreEncryption: true });
        } catch { src = null; }
      }
      if (!src || !src.getPageCount()) {
        infoPage(`Beleg ${l.no}`, [["Datum", fmtD(l.date)], ["Beschreibung", l.what], ["Anbieter", l.vendor], ["Betrag", fmt(l.amount)], ["Rechnungsnr.", l.receiptNo]],
          c.filePath ? "Die Datei dieses Belegs konnte nicht gelesen werden." : "Zu dieser Position ist kein Beleg hochgeladen.");
      } else {
        const pages = await doc.embedPdf(src, src.getPageIndices());
        pages.forEach((ep, i) => {
          const p = doc.addPage([A4.w, A4.h]);
          const band = 34, box = { w: A4.w - 40, h: A4.h - band - 20 };
          const k = Math.min(box.w / ep.width, box.h / ep.height);
          const w = ep.width * k, h = ep.height * k;
          p.drawPage(ep, { x: (A4.w - w) / 2, y: 20 + (box.h - h) / 2, width: w, height: h });
          p.drawText(win(l.no), { x: 22, y: A4.h - 24, size: 14, font: bold, color: INK });
          const rest = win(`${stampText(l)}${pages.length > 1 ? ` · Seite ${i + 1}/${pages.length}` : ""}`);
          const x0 = 22 + bold.widthOfTextAtSize(win(l.no), 14) + 10;
          let t = rest; while (t.length > 3 && font.widthOfTextAtSize(t, 9) > A4.w - x0 - 22) t = t.slice(0, -2);
          p.drawText(t === rest ? t : `${t}…`, { x: x0, y: A4.h - 23, size: 9, font, color: GREY });
          p.drawLine({ start: { x: 22, y: A4.h - band + 2 }, end: { x: A4.w - 22, y: A4.h - band + 2 }, thickness: 0.5, color: RULE });
        });
      }
      // a business meal: its Bewirtungsbeleg right after it
      if (d.cats.find(x => x.id === c.categoryId)?.kind === "bewirtung") {
        const { p, y } = infoPage("Bewirtungsbeleg", [
          ["Beleg-Nr.", l.no], ["Tag der Bewirtung", fmtD(l.date)], ["Ort der Bewirtung", [l.vendor, l.x?.place].filter(Boolean).join(", ")],
          ["Bewirtete Personen", c.guests], ["Anlass der Bewirtung", c.anlass], ["Höhe der Aufwendungen", `${fmt(c.amount)} (laut beigefügter Rechnung)`],
          ["Davon abziehbar (70 %)", fmt(l.counted)], ["Bewirtende Person", me],
        ], "Angaben zum Nachweis der Höhe und der betrieblichen Veranlassung von Bewirtungsaufwendungen (§ 4 Abs. 5 Satz 1 Nr. 2 EStG).");
        const sy = Math.max(90, y - 90);
        p.drawLine({ start: { x: 50, y: sy }, end: { x: 250, y: sy }, thickness: 0.6, color: INK });
        p.drawLine({ start: { x: 320, y: sy }, end: { x: A4.w - 50, y: sy }, thickness: 0.6, color: INK });
        p.drawText(win("Ort, Datum"), { x: 50, y: sy - 12, size: 8, font, color: GREY });
        p.drawText(win("Unterschrift"), { x: 320, y: sy - 12, size: 8, font, color: GREY });
      }
    };

    // number order: each trip / event (its report, then its receipts), then the one-off costs
    const groups = s.caseList.filter(x => s.lines.some(l => l.x?.id === x.id));
    const ordered = [...groups.filter(x => x.kind === "trip"), ...groups.filter(x => x.kind === "event")];
    for (const x of ordered) {
      const rep = await caseReportPdf({ x, no: s.nums.get(x.id) || "", costs: d.costs, nums: s.nums, cats: d.cats, settings: d.settings });
      const src = await PDFDocument.load(rep.output("arraybuffer"));
      (await doc.copyPages(src, src.getPageIndices())).forEach(pg => doc.addPage(pg));
      for (const l of s.lines.filter(l => l.x?.id === x.id && l.cost)) await addReceipt(l);
    }
    // receipts of a trip / event that starts outside this year or month, then the one-off costs
    for (const l of s.lines.filter(l => l.cost && !(l.x && ordered.some(o => o.id === l.x!.id)))) await addReceipt(l);
    if (!doc.getPageCount()) infoPage(`Belege ${s.label}`, [], "In diesem Zeitraum gibt es keine Belege.");

    const bytes = await doc.save();
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const name = `Belege ${safe(s.label)}`;
    if (mw) mw.location.href = URL.createObjectURL(blob);
    else saveFile(blob, `${name}.pdf`);
  } catch (e) { mw?.close(); throw e; }
}

// the months of a year that have positions (for the export menus), newest first
export function monthsWith(year: number, d: Pick<ExportData, "costs" | "cases">): string[] {
  const s = new Set<string>();
  d.costs.forEach(c => { if (yearOf(c.date) === year) s.add(monthOf(c.date)); });
  d.cases.forEach(x => { if (x.kind === "trip" && yearOf(x.startDate) === year && (mealDays(x).some(dd => dd.amount > 0) || kmAmount(x) > 0)) s.add(monthOf(x.startDate)); });
  return [...s].sort().reverse();
}
