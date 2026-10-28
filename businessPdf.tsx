// ─────────────────────────────────────────────────────────────
// businessPdf — the report of a trip or an event as ONE PDF, in German
// (for the tax files), in the look of the app's documents: white A4
// pages, header strip, Playfair title, small table type, page numbers
// (the same PDF settings as Casa Castel and the Invoices overview).
//   Reisebericht           Reisedaten · Programm / Ablauf · Ergebnis ·
//                          Reisekosten (Belege · Verpflegungsmehraufwand · Fahrtkosten · Gesamt) · Fotos
//   Veranstaltungsbericht  Daten · Programm / Ablauf · Ergebnis · Kosten · Fotos
// Built off-screen: every block is measured first, then the blocks are
// put onto pages (a heading never stays alone at the bottom of a page).
// ─────────────────────────────────────────────────────────────

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SANS, SERIF, PDF } from "./constants";
import { fmt, fmtD, today } from "./formatters";
import { openPdfWindow, pagesToPdf, deliverPdf } from "./PDFExport";
import { mealDays, kmAmount, costsOf, isAbroad, accountName, dateRange, KM_RATE } from "./business";
import type { BizCase, BizCost, BizCategory } from "./business";
import { photoBlob } from "./useBusiness";

export interface Geo { W: number; H: number; PX: number }
export const PORTRAIT: Geo = { W: 595, H: 842, PX: 40 }, LANDSCAPE: Geo = { W: 842, H: 595, PX: 40 };
const HEAD = 36, FOOT = 40;
const bodyOf = (g: Geo) => g.H - HEAD - FOOT - 18 - 16;   // what fits between the strips
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const KIND: Record<string, string> = { arrival: "Anreisetag", full: "voller Tag", departure: "Abreisetag", day: "eintägig, über 8 Std.", short: "eintägig, bis 8 Std." };
const dayDe = (d: string) => `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${fmtD(d)}`;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const safe = (t: string) => String(t || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

export type Block = { node: any; keep?: boolean };   // keep: stays on the page of the block after it (headings)

export const lbl: any = { fontSize: 7, letterSpacing: 0, textTransform: "uppercase", color: PDF.label };
const cell = (w: number, right?: boolean, s: any = {}): any => ({ width: w, boxSizing: "border-box", flexShrink: 0, textAlign: right ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: right ? 0 : 6, ...s });
export const H2 = ({ children }: { children: any }) => <div style={{ fontSize: 9, fontWeight: 600, margin: "14px 0 5px", paddingBottom: 3, borderBottom: `1px solid ${PDF.ink}` }}>{children}</div>;
const Para = ({ t }: { t: string }) => {
  const bullet = /^\s*[-•*]\s+/.test(t);
  return <div style={{ fontSize: 8.5, lineHeight: 1.5, color: PDF.ink, padding: bullet ? "0 0 1px 10px" : "0 0 3px", textIndent: bullet ? -8 : 0, whiteSpace: "pre-wrap" as const }}>{bullet ? `• ${t.replace(/^\s*[-•*]\s+/, "")}` : t}</div>;
};
const Fact = ({ k, v }: { k: string; v: any }) => (
  <div style={{ display: "flex", gap: 10, padding: "3px 0", borderBottom: `0.5px solid ${PDF.rule}`, fontSize: 8.5 }}>
    <span style={{ ...lbl, width: 110, flexShrink: 0, paddingTop: 1 }}>{k}</span>
    <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45, whiteSpace: "pre-wrap" as const }}>{v || "—"}</span>
  </div>
);
const COLS = [{ l: "Nr.", w: 44 }, { l: "Datum", w: 62 }, { l: "Beschreibung", w: 196 }, { l: "Anbieter", w: 140 }, { l: "Betrag", w: 73, r: true }];   // 515
const TRow = ({ v, bold, muted }: { v: string[]; bold?: boolean; muted?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", minHeight: 17, borderBottom: `0.5px solid ${PDF.rule}`, fontSize: 7.5, fontWeight: bold ? 600 : 400, color: muted ? PDF.label : PDF.ink }}>
    {COLS.map((c, i) => <div key={i} style={cell(c.w, c.r)}>{v[i] ?? ""}</div>)}
  </div>
);

function blocksOf(x: BizCase, no: string, costs: BizCost[], nums: Map<string, string>, cats: BizCategory[], photos: { url: string; w: number; h: number }[]): Block[] {
  const trip = x.kind === "trip";
  const out: Block[] = [];
  const add = (node: any, keep = false) => out.push({ node, keep });
  const when = (d: string, t: string) => (d ? `${dayDe(d)}${t ? `, ${t} Uhr` : ""}` : "");
  // title
  add(
    <div style={{ marginBottom: 6 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 4px" }}>{trip ? "Reisebericht" : "Veranstaltungsbericht"} · {no}</h1>
      <p style={{ fontSize: 7.5, color: PDF.label, margin: 0 }}>{[x.title, dateRange(x.startDate, x.endDate)].filter(Boolean).join(" · ")} · erstellt am {fmtD(today())}</p>
    </div>
  );
  // the facts
  add(<H2>{trip ? "Reisedaten" : "Daten"}</H2>, true);
  add(
    <div>
      {!trip && <Fact k="Veranstaltung" v={x.title} />}
      <Fact k={trip ? "Reiseziel" : "Ort"} v={[x.place, x.country].filter(Boolean).join(", ")} />
      <Fact k={trip ? "Beginn" : "Von"} v={when(x.startDate, x.startTime)} />
      <Fact k={trip ? "Ende" : "Bis"} v={when(x.endDate || x.startDate, x.endTime)} />
      <Fact k="Anlass / Zweck" v={x.purpose} />
      {!trip && <Fact k="Gäste / Marken" v={x.guests} />}
      <Fact k="Kunde / Projekt" v={x.client} />
      <Fact k="Konto" v={accountName(x.account)} />
    </div>
  );
  // the report texts
  const texts = (title: string, t: string) => {
    const paras = String(t || "").split(/\r?\n/).map(s => s.trimEnd()).filter(s => s.trim());
    if (!paras.length) return;
    add(<H2>{title}</H2>, true);
    paras.forEach(p => add(<Para t={p} />));
  };
  texts("Programm / Ablauf", x.report?.program);
  texts("Ergebnis", x.report?.result);
  // the costs
  const list = costsOf(x, costs);
  const isMeal = (id: string | null) => cats.find(c => c.id === id)?.kind === "bewirtung";
  add(<H2>{trip ? "Reisekosten" : "Kosten"}</H2>, true);
  add(<TRow v={COLS.map(c => c.l)} muted />, true);
  if (!list.length) add(<TRow v={["", "", "Keine Belege", "", ""]} muted />);
  list.forEach(c => add(<TRow v={[nums.get(c.id) || "", fmtD(c.date), [c.what, c.returnOf ? `(Rückgabe ${nums.get(c.returnOf) || ""})` : "", isMeal(c.categoryId) ? "· Bewirtung" : ""].filter(Boolean).join(" "), c.vendor, fmt(c.amount)]} />));
  const sumReceipts = list.reduce((s, c) => s + c.amount, 0);
  let meals = 0, km = 0;
  if (trip) {
    const days = mealDays(x);
    if (days.length) {
      add(<div style={{ ...lbl, margin: "10px 0 3px" }}>Verpflegungsmehraufwand{isAbroad(x) ? ` · Ausland (${x.country})` : " · Inland"}</div>, true);
      days.forEach(d => {
        const m = [d.meals.b ? "Frühstück" : "", d.meals.l ? "Mittagessen" : "", d.meals.d ? "Abendessen" : ""].filter(Boolean).join(", ");
        add(<TRow v={["", dayDe(d.date).slice(3), KIND[d.kind], `Pauschale ${fmt(d.base)}${d.cut ? ` − ${fmt(d.cut)} (${m})` : ""}`, fmt(d.amount)]} />);
      });
      meals = days.reduce((s, d) => s + d.amount, 0);
    }
    km = kmAmount(x);
    if (x.km > 0) add(<TRow v={["", "", "Fahrtkosten eigener Pkw", `${x.km.toLocaleString("de-DE")} km × ${fmt(KM_RATE)}`, fmt(km)]} />);
  }
  const total = sumReceipts + meals + km;
  add(
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
      <div style={{ width: 240, borderTop: `1px solid ${PDF.ink}`, paddingTop: 5, fontSize: 8 }}>
        {[["Belege", fmt(sumReceipts)], ...(trip && meals ? [["Verpflegungsmehraufwand", fmt(meals)]] : []), ...(trip && km ? [["Fahrtkosten eigener Pkw", fmt(km)]] : []), ["Gesamt", fmt(total)]].map(([k, v], i, a) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: i === a.length - 1 ? 600 : 400, borderTop: i === a.length - 1 ? `0.5px solid ${PDF.rule}` : "none" }}>
            <span>{k}</span><span style={{ fontFamily: SERIF }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
  // photos, two in a row
  if (photos.length) {
    add(<H2>Fotos</H2>, true);
    for (let i = 0; i < photos.length; i += 2) {
      add(
        <div style={{ display: "flex", gap: 15, paddingBottom: 12 }}>
          {photos.slice(i, i + 2).map((ph, k) => (
            <div key={k} style={{ width: 250, height: 188, background: "#f4f1ed", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={ph.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" as const }} />
            </div>
          ))}
        </div>
      );
    }
  }
  return out;
}

// blocks → pages: greedy, a "keep" block moves with the one after it
function paginate(blocks: Block[], hs: number[], body: number): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  for (let i = 0; i < blocks.length; i++) {
    let need = hs[i];
    let j = i;
    while (blocks[j]?.keep && j + 1 < blocks.length) { j++; need += hs[j]; }
    if (used > 0 && used + need > body) { pages.push([]); used = 0; }
    for (let k = i; k <= j; k++) { pages[pages.length - 1].push(k); used += hs[k]; }
    i = j;
  }
  return pages;
}

const Measure = ({ blocks, g }: { blocks: Block[]; g: Geo }) => (
  <div style={{ width: g.W - 2 * g.PX, fontFamily: SANS, color: PDF.ink }}>
    {blocks.map((b, i) => <div key={i} data-blk={i} style={{ display: "flow-root" }}>{b.node}</div>)}
  </div>
);
const Pages = ({ blocks, pages, head, foot, g }: { blocks: Block[]; pages: number[][]; head: string[]; foot: string; g: Geo }) => (
  <>
    {pages.map((idx, pi) => (
      <div key={pi} data-report-page="true" style={{ width: g.W, height: g.H, position: "relative", overflow: "hidden", background: PDF.page, fontFamily: SANS, color: PDF.ink }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEAD, borderBottom: `1px solid ${PDF.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${g.PX}px` }}>
          <span style={{ fontSize: 7, color: PDF.faint, textTransform: "uppercase" as const }}>{head[0]}</span>
          <span style={{ fontSize: 7, color: PDF.faint, textTransform: "uppercase" as const }}>{head[1]}</span>
        </div>
        <div style={{ position: "absolute", top: HEAD, left: g.PX, right: g.PX, bottom: FOOT, paddingTop: 18 }}>
          {idx.map(i => <div key={i} style={{ display: "flow-root" }}>{blocks[i].node}</div>)}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: FOOT, borderTop: `1px solid ${PDF.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${g.PX}px`, fontSize: 7, color: PDF.label }}>
          <span>{foot}</span>
          <span style={{ color: PDF.faint }}>Seite {pi + 1} / {pages.length}</span>
        </div>
      </div>
    ))}
  </>
);

async function imagesReady(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map(im => (im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = () => r(null); }))));
}

// blocks → measured → pages → one jsPDF (built off-screen)
export async function renderBlocks(blocks: Block[], head: string[], foot: string, g: Geo): Promise<any> {
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:fixed;left:-20000px;top:0;width:${g.W}px;pointer-events:none;`;
  document.body.appendChild(wrap);
  const root = createRoot(wrap);
  try {
    flushSync(() => root.render(<Measure blocks={blocks} g={g} />));
    try { await (document as any).fonts?.ready; } catch { /* fonts are optional */ }
    await imagesReady(wrap);
    await wait(40);
    const hs = blocks.map((_, i) => (wrap.querySelector(`[data-blk="${i}"]`) as HTMLElement | null)?.offsetHeight || 0);
    const pages = paginate(blocks, hs, bodyOf(g));
    flushSync(() => root.render(<Pages blocks={blocks} pages={pages} head={head} foot={foot} g={g} />));
    await imagesReady(wrap);
    await wait(60);
    const els = Array.from(wrap.querySelectorAll("[data-report-page]")) as HTMLElement[];
    if (!els.length) throw new Error("The PDF could not be prepared.");
    return await pagesToPdf(els, g.W > g.H ? "landscape" : "portrait");
  } finally {
    root.unmount();
    wrap.remove();
  }
}
export const footOf = (s: any) => [s?.email, s?.website].filter(Boolean).join(" · ");
export const whoOf  = (s: any) => s?.company || s?.name || "Lynn Hoa";
export const reportName = (x: BizCase, no: string) => `${x.kind === "trip" ? "Reisebericht" : "Veranstaltungsbericht"} ${no} ${safe(x.title)}`.trim();

// the report as a jsPDF (also put in front of the trip's receipts in the Invoices print)
export async function caseReportPdf(p: { x: BizCase; no: string; costs: BizCost[]; nums: Map<string, string>; cats: BizCategory[]; settings: any }): Promise<any> {
  const urls: string[] = [];
  try {
    const photos: { url: string; w: number; h: number }[] = [];
    for (const ph of ((p.x.report?.photos || []) as any[])) {
      const b = await photoBlob(ph.path);
      if (!b) continue;
      const url = URL.createObjectURL(b); urls.push(url);
      photos.push({ url, w: ph.w || 4, h: ph.h || 3 });
    }
    const blocks = blocksOf(p.x, p.no, p.costs, p.nums, p.cats, photos);
    return await renderBlocks(blocks, [whoOf(p.settings), p.x.kind === "trip" ? "Reisebericht" : "Veranstaltungsbericht"], footOf(p.settings), PORTRAIT);
  } finally { urls.forEach(u => URL.revokeObjectURL(u)); }
}

// Build the report and save it as ONE PDF. Call it right in the tap (iPhone).
export async function downloadCaseReport(p: {
  x: BizCase; no: string; costs: BizCost[]; nums: Map<string, string>; cats: BizCategory[]; settings: any;
}): Promise<void> {
  const mw = openPdfWindow();                 // must happen in the tap, before any waiting (iPhone)
  try {
    const pdf = await caseReportPdf(p);
    deliverPdf(pdf, reportName(p.x, p.no), mw);
  } catch (e) {
    mw?.close();
    throw e;
  }
}
