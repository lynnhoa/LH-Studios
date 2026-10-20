// ─────────────────────────────────────────────────────────────
// A4Document — the A4 page content of every document
// Pure display. Receives a document (saved row or draft) and renders
// it with the frozen sender/client snapshot when the document is sent.
// Header + footer are added per page by DocPages.
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, CATEGORY, PDF } from "./constants";
import { fmt, fmtD, fmtPct, r2 } from "./formatters";
import { addonLabel } from "./pricing";
import { SETTINGS_DEFAULT } from "./rateCards";
import {
  docNet, retainerMonthly, linesSum, lineAmt, lineQty, docTax, taxNote, docTitle,
  contractNo as mkContractNo, retDiscOf } from "./docs";
import type { DocView } from "./docs";

interface A4Props {
  doc:             DocView;
  lang:            string;
  settings:        any;
  client?:         any;
  extraSigMargin?: number;
  clauseGuards?:   number[];
  tRowGuards?:     number[];
}

// ─── Who is sending / receiving (frozen snapshot wins) ────────
export function senderOf(doc: DocView, settings: any) {
  return { ...SETTINGS_DEFAULT, ...(settings || {}), ...((doc.data || {}).sender || {}) };
}
export function clientOf(doc: DocView, client: any) {
  const d = doc.data || {};
  return { ...(client || {}), ...(d.client || {}) };
}

// ─── Contract clauses ─────────────────────────────────────────
// Stored edits keep {fee} / {creator} tokens so later price or
// language changes still flow into the text.
const CLAUSES_EN = [
  { title: "§ 1 — Subject Matter", text: "{creator} agrees to produce and deliver the following for a total agreed fee of {fee}: {deliverables}. The deliverable scope, format, and timeline shall be confirmed in writing by both parties prior to production. The creative concept is subject to mutual written approval before work begins." },
  { title: "§ 2 — Delivery", text: "Delivery follows the project timeline confirmed at commencement. If the client delays providing required materials, approvals, products, or access by more than 5 business days beyond any agreed handover date, the delivery deadline extends by the same period. Client-caused delays do not reduce the agreed fee." },
  { title: "§ 3 — Revisions", text: "One revision per deliverable is included in the agreed fee. Revision requests must be submitted in writing within 5 business days of each delivery; requests received after this period may be treated as new work. Additional revisions are charged at the creator's current rate. The creator's editorial voice and creative direction remain at the creator's sole discretion throughout." },
  { title: "§ 4 — Usage Rights", text: "{creator} grants the client a time-limited, non-exclusive, non-transferable licence to use the delivered content for {platforms}, for the usage period and purpose stated in the table above, and within the agreed territory only. All copyright, moral rights, and ownership vest exclusively in {creator}. No perpetual, exclusive, or sub-licensable rights are granted; sub-licensing requires prior written consent. {creator} retains the right to display the content in their portfolio and press materials. Upon expiry of the licence period, all granted rights revert in full to {creator}." },
  { title: "§ 5 — Payment", text: "The total fee of {fee} is due within 14 days of the invoice date. In the event of late payment, statutory default interest pursuant to § 288 BGB is charged from the first day of delay. {tax}" },
  { title: "§ 6 — Cancellation", text: "Cancellation must be submitted in writing. If the client cancels before production begins, 25% of the agreed fee is due. If the client cancels after production has begun, 50% of the agreed fee is due. If the deliverable is substantially complete, the full fee is payable. Production is deemed to have commenced upon any preparatory work, research, concept development, travel, filming, or third-party commitments made by {creator} in connection with this contract." },
];
const CLAUSES_DE = [
  { title: "§ 1 — Vertragsgegenstand", text: "{creator} verpflichtet sich, folgende Leistungen gegen ein vereinbartes Honorar von {fee} zu erbringen: {deliverables}. Umfang, Format und Zeitplan werden vor Produktionsbeginn schriftlich von beiden Parteien bestätigt. Das kreative Konzept bedarf der schriftlichen Freigabe beider Parteien vor Beginn der Produktion." },
  { title: "§ 2 — Lieferung", text: "Die Lieferung erfolgt innerhalb des schriftlich vereinbarten Zeitrahmens. Stellt der Auftraggeber erforderliche Materialien, Freigaben, Produkte oder Zugänge nicht innerhalb von 5 Werktagen nach vereinbartem Termin zur Verfügung, verlängert sich die Lieferfrist entsprechend. Auftraggeber-seitige Verzögerungen berechtigen nicht zur Minderung des Honorars." },
  { title: "§ 3 — Korrekturen", text: "Eine (1) Korrektur je Leistung ist im Honorar enthalten. Korrekturwünsche sind innerhalb von 5 Werktagen nach Ablieferung schriftlich einzureichen; später eingereichte Anfragen können als neue Aufträge gewertet werden. Weitere Korrekturen werden nach dem jeweils gültigen Tagessatz berechnet. Kreativstil und redaktionelle Linie bleiben stets bei {creator}." },
  { title: "§ 4 — Nutzungsrechte", text: "{creator} räumt dem Auftraggeber ein zeitlich begrenztes, nicht-exklusives, nicht übertragbares Nutzungsrecht an den vereinbarten Inhalten für {platforms} ein, für den in der obigen Tabelle genannten Nutzungszeitraum und Zweck sowie den vereinbarten Geltungsbereich. Urheberrecht und Persönlichkeitsrechte verbleiben ausschließlich bei {creator}. Es werden weder dauerhafte noch exklusive Rechte gewährt; Unterlizenzierung ist ohne schriftliche Zustimmung unzulässig. {creator} behält das Recht zur Verwendung der Inhalte im eigenen Portfolio. Mit Ablauf des Nutzungszeitraums fallen alle eingeräumten Rechte vollständig zurück." },
  { title: "§ 5 — Zahlung", text: "Das Honorar in Höhe von {fee} ist innerhalb von 14 Tagen nach Rechnungsdatum fällig. Bei Zahlungsverzug ist {creator} berechtigt, Verzugszinsen gemäß § 288 BGB ab dem ersten Verzugstag geltend zu machen. {tax}" },
  { title: "§ 6 — Stornierung", text: "Stornierungen bedürfen der Schriftform. Bei Stornierung vor Produktionsbeginn sind 25 % des vereinbarten Honorars fällig. Bei Stornierung nach Produktionsbeginn sind 50 % fällig. Ist die Leistung im Wesentlichen erbracht, ist das vollständige Honorar zu entrichten. Als Produktionsbeginn gilt jede Vorarbeit, Recherche, Konzeptentwicklung, Anreise, Produktion oder Beauftragung Dritter durch {creator} im Zusammenhang mit diesem Vertrag." },
];

const looksGerman = (cls: any[]) =>
  /vertrag|lieferung|zahlung|nutzungsrecht|korrektur|stornierung/i.test(String(cls?.[0]?.title || "") + String(cls?.[0]?.text || "").slice(0, 80));

// Clause templates (with tokens) for one language: own edits first, else defaults
// § 4 names the start of the usage period (contracts made from clause set 2 on).
// Older contracts keep the wording they were sent with.
const S4_START: Record<"en" | "de", [string, string]> = {
  en: [" for the usage period and purpose", " for the usage period (starting on the delivery date) and purpose"],
  de: [" genannten Nutzungszeitraum", " genannten Nutzungszeitraum (beginnend mit dem Liefertermin)"],
};
const withStart = (list: { title: string; text: string }[], [a, b]: [string, string]) =>
  list.map(c => (c.title.startsWith("§ 4") ? { ...c, text: c.text.replace(a, b) } : c));
const CLAUSES_EN_2 = withStart(CLAUSES_EN, S4_START.en);
const CLAUSES_DE_2 = withStart(CLAUSES_DE, S4_START.de);

export function clauseTemplates(data: any, lang: string): { title: string; text: string }[] {
  const de = lang === "de";
  const c = data?.clauses;
  if (Array.isArray(c) && c.length > 0) {
    if (looksGerman(c) === de) return c;            // older documents: one list, detect its language
  } else if (c && typeof c === "object") {
    const own = c[de ? "de" : "en"];
    if (Array.isArray(own) && own.length > 0) return own;
  }
  const set2 = Number(data?.clauseSet) >= 2;
  return de ? (set2 ? CLAUSES_DE_2 : CLAUSES_DE) : (set2 ? CLAUSES_EN_2 : CLAUSES_EN);
}

// Values that replace the tokens
export function clauseContext(doc: DocView, lang: string, settings: any, client: any) {
  const de = lang === "de";
  const s = senderOf(doc, settings);
  const cl = clientOf(doc, client);
  const d = doc.data || {};
  const sv: any = doc as any;
  const net = sv.status && sv.status !== "draft" && typeof sv.net === "number" ? Number(sv.net) : docNet(doc.kind, d);   // sent: as sent
  const tax = docTax(doc, s, cl);   // a sent document keeps the tax rule it was sent with
  const lines = d.lines || [];
  const plat = [...new Set(lines.flatMap((ln: any) => ln.platforms || []))] as string[];
  // retainer contracts (clause set 3 on): the fee also says what is invoiced each month
  const perMonth = Number(d.clauseSet) >= 3 && d.retainer && Number(d.retMo) > 0
    ? (de ? ` (${fmt(retainerMonthly(d))} pro Monat × ${d.retMo} Monate, monatliche Abrechnung)`
          : ` (${fmt(retainerMonthly(d))} per month × ${d.retMo} months, invoiced monthly)`)
    : "";
  return {
    creator: s.company || s.name || (de ? "Der/Die Auftragnehmer/in" : "The creator"),
    fee: fmt(net) + perMonth + (tax.mode === "domestic" ? (de ? ` zzgl. ${tax.rate} % USt.` : ` plus ${tax.rate} % VAT`) : ""),
    deliverables: lines.length
      ? lines.map((ln: any) => `${lineQty(ln)}× ${ln.name}`).join(", ")
      : (de ? "den vereinbarten Content gemäß obiger Übersicht" : "the content specified above"),
    platforms: plat.length ? plat.join(", ") : (de ? "die vereinbarten Plattformen" : "the agreed platforms"),
    tax: taxNote(tax.mode, lang, s),
  };
}

export function fillTokens(text: string, ctx: Record<string, string>): string {
  let out = String(text || "");
  Object.entries(ctx).forEach(([k, v]) => { out = out.split(`{${k}}`).join(v); });
  return out.trim();
}

// Edited text back to tokens (only the fee and the creator name are live values)
export function tokenizeClause(text: string, ctx: Record<string, string>): string {
  let out = String(text || "");
  if (ctx.fee)     out = out.split(ctx.fee).join("{fee}");
  if (ctx.creator) out = out.split(ctx.creator).join("{creator}");
  return out;
}

// ─── Component ───────────────────────────────────────────────
export default function A4Document({
  doc, lang, settings, client,
  extraSigMargin = 0, clauseGuards = [], tRowGuards = [],
}: A4Props) {
  const l    = lang === "de";
  const d    = doc.data || {};
  const s    = senderOf(doc, settings);
  const cl   = clientOf(doc, client);
  const kind = doc.kind;
  const sub  = doc.subtype || "";

  const lines     = d.lines || [];
  const sum       = linesSum(lines);
  const isRet     = !!(d.retainer && d.retMo) && (kind === "quote" || kind === "contract");
  const monthly   = isRet ? retainerMonthly(d) : 0;
  const tax       = docTax(doc, s, cl);   // a sent document keeps the tax rule it was sent with
  // A sent document prints the totals it was sent with (stored on the row); a draft is
  // worked out fresh. So a later rounding fix never changes an invoice you already sent.
  const sv: any   = doc as any;
  const stored    = !!sv.status && sv.status !== "draft" && typeof sv.net === "number" && typeof sv.gross === "number";
  const net       = stored ? Number(sv.net) : docNet(kind, d);
  const vatAmt    = tax.mode !== "domestic" ? 0 : stored && typeof sv.vat === "number" ? Number(sv.vat) : r2(net * tax.rate / 100);
  const gross     = stored ? Number(sv.gross) : r2(net + vatAmt);
  const note      = taxNote(tax.mode, lang, s);

  const docNoText = doc.docNo || (l ? "Entwurf" : "Draft");
  const quoteRef  = d.quoteNo || d.qNo || "";
  const conRef    = d.contractNo || (doc.docNo?.startsWith("AMD-") ? mkContractNo(doc.docNo.slice(4, -3)) : "");

  // ── Sender + client lines ──
  const countryOut = (c: string) => {
    const v = (c || "").trim();
    if (!v) return "";
    if (/^(germany|deutschland|de)$/i.test(v)) return l ? "Deutschland" : "Germany";
    return v;
  };
  const creatorAddr = [s.street, [s.plz, s.city].filter(Boolean).join(" "), countryOut(s.country)].filter(Boolean).join(", ");
  const creatorLine = [s.company, s.name, s.street, [s.plz, s.city].filter(Boolean).join(" "), countryOut(s.country)]
    .filter(Boolean).join(" · ") || "Company · Your Name · Address";
  const clientName    = d.brand || cl.name || "[Brand]";
  const clientContact = d.contact || cl.contact || "";
  const clientAddr    = [cl.street, [cl.plz, cl.city].filter(Boolean).join(" "),
                         /^(germany|deutschland|de)$/i.test((cl.country || "").trim()) ? "" : (cl.country || "")]
                        .filter(Boolean);

  // ── Small helpers ──
  const MRow = ({ lb, v }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, fontSize: 8 }}>
      <span style={{ color: PDF.label }}>{lb}</span>
      <span style={{ textAlign: "right" as const }}>{v}</span>
    </div>
  );
  const SumRow = ({ lb, v, strong }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: strong ? 9 : 8 }}>
      <span style={{ color: strong ? PDF.ink : PDF.label }}>{lb}</span>
      <span>{v}</span>
    </div>
  );

  const catBadge: Record<string, string> = Object.fromEntries(Object.entries(CATEGORY).map(([k, v]) => [k, v.long]));
  // New quotes, contracts and amendments (calcV 2): each priced item shows its content fee
  // (qty × price per piece, after volume) and under it usage, exclusivity and every add-on with
  // its own amount — together exactly the item's amount. Everything else keeps one row.
  const breakdownOn = Number(d.calcV) >= 2 && (kind === "quote" || kind === "contract" || kind === "amendment");
  const partsOf = (ln: any): { base: number; parts: { label: string; amt: number }[] } | null => {
    if (!breakdownOn || ln?.pv !== 2 || typeof ln.base !== "number") return null;
    const amt = lineAmt(ln), base = r2(ln.base);
    const parts: { label: string; amt: number }[] = [];
    const u = Number(ln.usagePct) || 0, e = Number(ln.exclPct) || 0;
    if (u && ln.usageLabel) parts.push({ label: `${l ? "Nutzungsrechte" : "Usage rights"} · ${ln.usageLabel}`, amt: r2(base * u / 100) });
    if (e && ln.exclLabel)  parts.push({ label: `${l ? "Exklusivität" : "Exclusivity"} · ${ln.exclLabel}`, amt: r2(base * e / 100) });
    (Array.isArray(ln.addonDetail) ? ln.addonDetail : []).forEach((a: any) => {
      const pct = (a.p === null || a.p === undefined) && Number(a.pct) ? ` (+${fmtPct(Number(a.pct))})` : "";
      parts.push({ label: `${addonLabel(a)}${pct}`, amt: r2(Number(a.amt) || 0) });
    });
    const rest = r2(amt - base - parts.reduce((t, x) => t + x.amt, 0));   // a rounding cent goes on the last row
    if (Math.abs(rest) > 0.004) { if (!parts.length) return null; parts[parts.length - 1].amt = r2(parts[parts.length - 1].amt + rest); }
    return { base, parts };
  };
  const TRow = ({ ln, prevLn, idx }: any) => {
    const showCat = !!(ln.cat && catBadge[ln.cat] && ln.cat !== prevLn?.cat);
    const includes   = ln.kind === "package" && Array.isArray(ln.includes) && ln.includes.length
      ? `${l ? "Enthält" : "Includes"} ${ln.includes.map((x: any) => `${x.qty || 1}× ${x.n}`).join(", ")}` : "";
    const bd   = partsOf(ln);
    const qty  = lineQty(ln);
    const amt  = lineAmt(ln);
    const volTxt = bd && Number(ln.volPct) ? `−${fmtPct(Number(ln.volPct))} ${l ? "Mengenrabatt" : "volume"}` : "";
    const subDetails = bd
      ? [includes, volTxt, Number(ln.usagePct) ? "" : ln.usageLabel, Number(ln.exclPct) ? "" : ln.exclLabel, ...(ln.platforms || [])].filter(Boolean)
      : [includes, ln.usageLabel, ln.exclLabel, ...(ln.addons || []), ...(ln.platforms || [])].filter(Boolean);
    const rowAmt   = bd ? bd.base : amt;
    const unit     = r2(rowAmt / qty);
    const showUnit = Math.abs(r2(unit * qty) - rowAmt) < 0.005;   // no unit price that doesn't multiply out
    // "Show discounts": the rate-card price per piece, struck through
    const listPer  = d?.showDiscount && Number(ln.listAmt) > amt + 0.004
      ? (bd && Number(ln.listPrice) ? r2(Number(ln.listPrice) * (1 - (Number(ln.volPct) || 0) / 100)) : r2(Number(ln.listAmt) / qty)) : 0;
    return (
      <div data-trow={idx} style={{ paddingTop: tRowGuards?.[idx] || 0, borderBottom: `1px solid ${PDF.rule}` }}>
        {showCat && (
          <div style={{ paddingTop: 10, paddingBottom: 1 }}>
            <span style={{ fontSize: 7, letterSpacing: 0, textTransform: "uppercase" as const, color: PDF.faint }}>{catBadge[ln.cat]}</span>
          </div>
        )}
        <div style={{ padding: "4px 0", display: "grid", gridTemplateColumns: "1fr 26px 62px 64px", alignItems: "baseline" }}>
          <div>
            <span style={{ fontSize: 8.5 }}>{ln.name}</span>
            {ln.note && <span style={{ fontSize: 7, color: PDF.faint, display: "block" }}>{ln.note}</span>}
            {subDetails.length > 0 && <span style={{ fontSize: 7, color: PDF.label, display: "block" }}>{subDetails.join(" · ")}</span>}
          </div>
          <span style={{ fontSize: 8, textAlign: "right" as const, color: PDF.label }}>{qty}</span>
          <span style={{ fontSize: 8, textAlign: "right" as const, color: PDF.label }}>
            {showUnit && listPer > unit + 0.004 && <span style={{ display: "block", textDecoration: "line-through", color: PDF.faint }}>{fmt(listPer)}</span>}
            {showUnit ? fmt(unit) : ""}
          </span>
          <span style={{ fontSize: 8, textAlign: "right" as const }}>{fmt(rowAmt)}</span>
        </div>
        {bd && bd.parts.map((x, k) => (
          <div key={k} style={{ padding: "0 0 3px", display: "grid", gridTemplateColumns: "1fr 26px 62px 64px", alignItems: "baseline" }}>
            <span style={{ fontSize: 7.5, color: PDF.label, paddingLeft: 8 }}>{x.label}</span>
            <span /><span />
            <span style={{ fontSize: 8, textAlign: "right" as const }}>{fmt(x.amt)}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── VAT lines under a net amount ──
  // VAT of this document (the base passed in is always its net amount)
  const VatRows = ({ base: _base }: { base: number }) => {
    if (tax.mode !== "domestic") return null;
    const v = vatAmt;
    return <>
      <SumRow lb={l ? `zzgl. ${tax.rate} % USt.` : `VAT ${tax.rate} %`} v={fmt(v)} />
    </>;
  };

  const GrandRow = ({ label, value }: { label: string; value: number }) => (
    <div style={{ borderTop: `1px solid ${PDF.rule}`, paddingTop: 6, marginTop: 3, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 7, color: PDF.label, letterSpacing: 0, textTransform: "uppercase" as const }}>{label}</span>
      <span style={{ fontFamily: SERIF, fontSize: 15 }}>{fmt(value)}</span>
    </div>
  );

  // ── Totals ──
  const totalLabel = tax.mode === "domestic" ? (l ? "Gesamt brutto" : "Total incl. VAT") : (l ? "Gesamt (EUR)" : "Total (EUR)");
  // optional: what your own rates took off the rate card ("Show discounts on the PDF")
  const discTotal = d?.showDiscount ? (lines || []).reduce((t: number, ln: any) => { const la = Number(ln.listAmt) || 0, a = lineAmt(ln); return t + (la > a ? la - a : 0); }, 0) : 0;
  const DiscRow = () => discTotal > 0.004 ? (
    <div style={{ display: "flex", justifyContent: "flex-end" }}><div style={{ width: 200 }}>
      <SumRow lb={l ? "Ihr Rabatt (enthalten)" : "Your discount (included)"} v={`−${fmt(discTotal)}`} />
    </div></div>
  ) : null;

  const TotalBlock = () => {
    if (kind === "amendment") {
      const orig = Number(d.origTotal) || 0;
      if (tax.mode === "domestic") {
        // the bottom line is what the brand pays for this amendment; the new contract value is a note
        return (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <div style={{ width: 200 }}>
              <SumRow lb={l ? "Ursprünglicher Betrag (netto)" : "Original total (net)"} v={fmt(orig)} />
              <SumRow lb={l ? "Nachtrag (netto)" : "Amendment (net)"} v={fmt(sum)} />
              <VatRows base={sum} />
              <GrandRow label={l ? "Nachtrag gesamt (brutto)" : "Amendment incl. VAT"} value={gross} />
              <div style={{ marginTop: 5 }}><SumRow lb={l ? "Neuer Vertragswert (netto)" : "New contract value (net)"} v={fmt(orig + sum)} /></div>
            </div>
          </div>
        );
      }
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ width: 200 }}>
            <SumRow lb={l ? "Ursprünglicher Betrag" : "Original total"} v={fmt(orig)} />
            <SumRow lb={l ? "Nachtragsbetrag" : "Amendment total"} v={fmt(sum)} />
            <VatRows base={sum} />
            <GrandRow label={l ? "Neuer Gesamtbetrag (netto)" : "New total (net)"} value={orig + sum} />
          </div>
        </div>
      );
    }
    if (isRet) {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ width: 200 }}>
            <SumRow lb={l ? "Mtl. Zwischensumme" : "Monthly subtotal"} v={fmt(sum)} />
            <SumRow lb={l ? `Retainer-Rabatt −${fmtPct(retDiscOf(d))}` : `Retainer discount −${fmtPct(retDiscOf(d))}`} v={`−${fmt(sum - monthly)}`} />
            <div style={{ borderTop: `1px solid ${PDF.rule}`, paddingTop: 4, marginTop: 3 }}>
              <SumRow lb={l ? "Monatliche Rate" : "Monthly fee"} v={fmt(monthly)} />
              <SumRow lb={`× ${d.retMo} ${l ? "Monate" : "months"}`} v={fmt(net)} />
            </div>
            {tax.mode === "domestic" && <>
              <SumRow lb={l ? "Netto" : "Net"} v={fmt(net)} />
              <VatRows base={net} />
            </>}
            <GrandRow label={totalLabel} value={gross} />
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ width: 200 }}>
          {tax.mode === "domestic" && <>
            <SumRow lb={l ? "Netto" : "Net"} v={fmt(net)} />
            <VatRows base={net} />
          </>}
          {kind === "invoice" && sub === "monthly" && (
            <p style={{ fontSize: 7, color: PDF.label, margin: "0 0 4px", textAlign: "right" as const }}>
              {d.retDisc !== undefined && d.retDisc !== null && d.retDisc !== ""
                ? (l ? `Retainer-Positionen inkl. ${fmtPct(retDiscOf(d))} Retainer-Rabatt` : `Retainer lines incl. ${fmtPct(retDiscOf(d))} retainer discount`)
                : (l ? "inkl. 20 % Retainer-Rabatt" : "incl. 20 % retainer discount")}
            </p>
          )}
          <GrandRow label={totalLabel} value={gross} />
        </div>
      </div>
    );
  };

  // ── Clauses ──
  const ctx = clauseContext(doc, lang, settings, client);
  const clauses = clauseTemplates(d, lang).map(c => ({ title: fillTokens(c.title, ctx), text: fillTokens(c.text, ctx) }));

  // ── Details block rows per document ──
  const periodText = doc.periodStart
    ? (doc.periodEnd && doc.periodEnd !== doc.periodStart ? `${fmtD(doc.periodStart)} – ${fmtD(doc.periodEnd)}` : fmtD(doc.periodStart))
    : "—";

  const Details = () => (
    <div style={{ width: 170 }}>
      <p style={{ fontSize: 7, color: PDF.label, letterSpacing: 0, textTransform: "uppercase" as const, margin: "0 0 4px" }}>Details</p>
      {kind === "quote" && <>
        <MRow lb={l ? "Angebotsnr." : "Quote No."} v={docNoText} />
        <MRow lb={l ? "Datum" : "Date"} v={fmtD(doc.docDate)} />
        {d.validUntil && <MRow lb={l ? "Gültig bis" : "Valid until"} v={fmtD(d.validUntil)} />}
      </>}
      {kind === "contract" && <>
        <MRow lb={l ? "Vertragsnr." : "Contract No."} v={docNoText + (doc.revision > 0 ? ` R${doc.revision}` : "")} />
        <MRow lb={l ? "Datum" : "Date"} v={fmtD(doc.docDate)} />
        {quoteRef && <MRow lb={l ? "Angebotsnr." : "Quote Ref."} v={quoteRef} />}
      </>}
      {kind === "amendment" && <>
        <MRow lb={l ? "Nachtragsnr." : "Amendment No."} v={docNoText} />
        <MRow lb={l ? "Datum" : "Date"} v={fmtD(doc.docDate)} />
        {conRef && <MRow lb={l ? "Vertragsnr." : "Contract Ref."} v={conRef} />}
      </>}
      {kind === "invoice" && <>
        <MRow lb={l ? "Rechnungsnr." : "Invoice No."} v={docNoText} />
        <MRow lb={l ? "Datum" : "Date"} v={fmtD(doc.docDate)} />
        {sub !== "storno" && <MRow lb={l ? "Leistungszeitraum" : "Service period"} v={periodText} />}
        {sub === "monthly" && d.retMo && <MRow lb={l ? "Monat" : "Month"} v={`${doc.monthNo || d.monthNo || "?"} / ${d.retMo}`} />}
        {sub === "storno" && d.cancelsNo && <MRow lb={l ? "Storno zu" : "Cancels"} v={d.cancelsNo} />}
        {sub !== "storno" && doc.dueDate && <MRow lb={l ? "Fällig am" : "Due date"} v={fmtD(doc.dueDate)} />}
        {quoteRef && sub !== "storno" && <MRow lb={l ? "Angebotsnr." : "Quote Ref."} v={quoteRef} />}
      </>}
    </div>
  );

  const ClientBlock = () => (
    <div>
      <p style={{ fontSize: 7, color: PDF.label, letterSpacing: 0, textTransform: "uppercase" as const, margin: "0 0 4px" }}>{l ? "An" : "To"}</p>
      <p style={{ fontSize: 9, fontWeight: "500", margin: "0 0 1px" }}>{clientName}</p>
      {clientContact && <p style={{ fontSize: 8, color: PDF.label, margin: 0 }}>{clientContact}</p>}
      {clientAddr.map((ln, i) => <p key={i} style={{ fontSize: 8, color: PDF.label, margin: 0 }}>{ln}</p>)}
      {cl.vatId && <p style={{ fontSize: 8, color: PDF.label, margin: "2px 0 0" }}>{l ? "USt-IdNr." : "VAT ID"} {cl.vatId}</p>}
    </div>
  );

  const isInvoice = kind === "invoice";
  const iban = s.iban ? `IBAN ${s.iban}` : (l ? "[IBAN fehlt]" : "[IBAN missing]");

  return (
    <div style={{ padding: "120px 62px 90px", fontSize: 9.5, lineHeight: 1.5, position: "relative", minHeight: 841, boxSizing: "border-box", fontFamily: SANS, color: PDF.ink, background: PDF.page, WebkitTextSizeAdjust: "100%", textSizeAdjust: "100%" } as any}>

      {/* ── TITLE ── */}
      <div style={{ margin: "0 0 22px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 28px" }}>{docTitle(doc, lang)}</h1>
        {kind !== "contract" && <p style={{ fontSize: 7.5, color: PDF.label, margin: 0 }}>{creatorLine}</p>}
      </div>

      {/* ── TO / DETAILS ── */}
      <div style={{ display: "flex", justifyContent: kind === "contract" ? "flex-end" : "space-between", marginBottom: 13, gap: 16 }}>
        {kind !== "contract" && <ClientBlock />}
        <Details />
      </div>

      {/* ── CONTRACT PARTIES ── */}
      {kind === "contract" && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10, gap: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 7, color: PDF.label, letterSpacing: 0, textTransform: "uppercase" as const, margin: "0 0 3px" }}>{l ? "Zwischen" : "Between"}</p>
            <p style={{ fontSize: 9, fontWeight: "500", margin: 0 }}>{s.company || s.name || "Lynn Hoa"}</p>
            {s.name && s.company && <p style={{ fontSize: 8, color: PDF.label, margin: "0 0 1px" }}>{s.name}</p>}
            <p style={{ fontSize: 8, color: PDF.label, margin: 0 }}>{creatorAddr}</p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 7, color: PDF.label, letterSpacing: 0, textTransform: "uppercase" as const, margin: "0 0 3px" }}>{l ? "Und" : "And"}</p>
            <p style={{ fontSize: 9, fontWeight: "500", margin: 0 }}>{clientName}</p>
            {clientContact && <p style={{ fontSize: 8, color: PDF.label, margin: 0 }}>{clientContact}</p>}
            {clientAddr.length > 0 && <p style={{ fontSize: 8, color: PDF.label, margin: 0 }}>{clientAddr.join(", ")}</p>}
          </div>
        </div>
      )}

      {/* ── LINE ITEMS (every document, incl. contracts) ── */}
      <div style={{ borderTop: `1px solid ${PDF.rule}`, borderBottom: `1px solid ${PDF.rule}`, padding: "4px 0", display: "grid", gridTemplateColumns: "1fr 26px 62px 64px" }}>
        {[l ? "Leistung" : "Description", l ? "Anz." : "Qty", l ? "Einzelpreis" : "Unit price", l ? "Betrag" : "Amount"].map((h, i) => (
          <span key={h} style={{ fontSize: 7, letterSpacing: 0, textTransform: "uppercase" as const, color: PDF.label, textAlign: i > 0 ? "right" as const : "left" as const }}>{h}</span>
        ))}
      </div>
      {lines.map((ln: any, i: number) => <TRow key={i} idx={i} ln={ln} prevLn={lines[i - 1]} />)}

      {kind === "contract" && quoteRef && (
        <p style={{ fontSize: 8, color: PDF.label, margin: "8px 0 0", fontStyle: "italic" }}>
          {l ? `Bezugnehmend auf Angebot ${quoteRef}.` : `As per the agreed quote ${quoteRef}.`}
        </p>
      )}

      {/* ── TOTALS (contract shows them above the clauses) ── */}
      {kind === "contract" && <div style={{ marginTop: 12 }}><DiscRow /><TotalBlock /></div>}

      {/* ── CONTRACT CLAUSES ── */}
      {kind === "contract" && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${PDF.rule}` }}>
          {clauses.map((c, ci) => (
            <div data-clause={ci} key={ci} style={{ paddingTop: 10 + (clauseGuards?.[ci] || 0), paddingBottom: 11 }}>
              <p style={{ fontFamily: SERIF, fontSize: 7.5, fontWeight: "normal", color: PDF.label, letterSpacing: 0, margin: "0 0 5px" }}>{c.title}</p>
              <p style={{ fontSize: 8.5, lineHeight: 1.85, margin: 0, color: "#404040" }}>{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── TOTALS + CLOSING (all other documents) ── */}
      {kind !== "contract" && (
        <div data-sig-anchor="true" style={{ marginTop: 22 + extraSigMargin }}>
          <DiscRow /><TotalBlock />

          {kind === "quote" && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${PDF.rule}` }}>
              <p style={{ fontSize: 8, color: PDF.label, lineHeight: 1.75, margin: "0 0 6px" }}>
                {l
                  ? `${d.validUntil ? `Dieses Angebot ist gültig bis ${fmtD(d.validUntil)}. ` : ""}Preise basieren auf dem vereinbarten Umfang. Produkt von der Marke gestellt. Nutzungsrechte zeitlich begrenzt. 1 Korrektur je Leistung inklusive.${isRet ? ` Retainer-Vereinbarung über ${d.retMo} Monate · monatliche Abrechnung · −${fmtPct(retDiscOf(d))} Retainer-Rabatt inklusive.` : ""}${tax.mode === "domestic" ? ` Alle Preise zzgl. ${tax.rate} % USt.` : ""}`
                  : `${d.validUntil ? `This quote is valid until ${fmtD(d.validUntil)}. ` : ""}Prices based on agreed scope. Product provided by brand. Usage rights time-limited. One revision included per deliverable.${isRet ? ` Retainer agreement — ${d.retMo} months · invoiced monthly · −${fmtPct(retDiscOf(d))} retainer discount applied.` : ""}${tax.mode === "domestic" ? ` All prices plus ${tax.rate} % VAT.` : ""}`}
              </p>
              <p style={{ fontSize: 9, fontStyle: "italic", margin: "14px 0 0" }}>{d.footer || (l ? "Wir freuen uns auf die Zusammenarbeit." : "Looking forward to working together.")}</p>
            </div>
          )}

          {kind === "amendment" && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${PDF.rule}` }}>
              <p style={{ fontSize: 8, color: PDF.label, lineHeight: 1.75, margin: "0 0 18px" }}>
                {l ? "Dieser Nachtrag ergänzt den genannten Vertrag. Alle übrigen Bedingungen bleiben unverändert." : "This amendment extends the original contract. All other terms remain unchanged and in full effect."}
              </p>
            </div>
          )}

          {isInvoice && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${PDF.rule}` }}>
              {sub === "storno" ? (
                <p style={{ fontSize: 8, color: PDF.label, lineHeight: 1.75, margin: "0 0 8px" }}>
                  {l ? `Diese Stornorechnung hebt die Rechnung ${d.cancelsNo || ""} vollständig auf.` : `This cancellation invoice fully reverses invoice ${d.cancelsNo || ""}.`}
                  {note ? ` ${note}` : ""}
                </p>
              ) : (
                <p style={{ fontSize: 8, color: PDF.faint, lineHeight: 1.75, margin: "0 0 8px" }}>
                  {l
                    ? `Zahlbar bis ${doc.dueDate ? fmtD(doc.dueDate) : "14 Tage nach Rechnungsdatum"} an ${s.bankName || "[Bank]"}, ${iban}${s.bic ? `, BIC ${s.bic}` : ""}${s.paypalEmail ? ` oder per PayPal: ${s.paypalEmail}` : ""}. Verwendungszweck: ${doc.docNo || "—"}.`
                    : `Please pay by ${doc.dueDate ? fmtD(doc.dueDate) : "14 days after the invoice date"} to ${s.bankName || "[Bank]"}, ${iban}${s.bic ? `, BIC ${s.bic}` : ""}${s.paypalEmail ? ` or via PayPal: ${s.paypalEmail}` : ""}. Reference: ${doc.docNo || "—"}.`}
                  {note ? ` ${note}` : ""}
                </p>
              )}
              <p style={{ fontSize: 9, fontStyle: "italic", margin: "14px 0 0" }}>{d.footer || (l ? "Vielen Dank für die angenehme Zusammenarbeit." : "Thank you for the pleasure of working together.")}</p>
            </div>
          )}
        </div>
      )}

      {/* ── SIGNATURES (contract + amendment) ── */}
      {(kind === "contract" || kind === "amendment") && (
        <div data-sig-anchor="true" style={{ display: "flex", justifyContent: "space-between", marginTop: 44 + extraSigMargin }}>
          {[s.company || s.name || "Lynn Hoa", clientName].map((nm: string, i: number) => (
            <div key={i} style={{ width: "44%" }}>
              <p style={{ fontSize: 8.5, fontWeight: "500", margin: "0 0 2px" }}>{nm}</p>
              <div style={{ borderBottom: `1px solid ${PDF.rule}`, margin: "30px 0 5px" }} />
              <p style={{ fontSize: 7.5, color: PDF.label, margin: "0 0 26px" }}>{l ? "Unterschrift" : "Signature"}</p>
              <div style={{ borderBottom: `1px solid ${PDF.rule}`, margin: "0 0 5px" }} />
              <p style={{ fontSize: 7.5, color: PDF.label, margin: 0 }}>{l ? "Datum, Ort" : "Date and Place"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
