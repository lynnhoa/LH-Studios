// ─────────────────────────────────────────────────────────────
// A4Document — the A4 page render
// Pure display. No state. Receives all data as props.
// Used by PDFModal for preview and by PDFExport for capture.
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF } from "./constants";
import { fmt, fmtD } from "./formatters";
import { SETTINGS_DEFAULT } from "./rateCards";

interface A4Props {
  d:               any;
  type:            string;
  lang:            string;
  settings:        any;
  extraSigMargin?: number;
  clauseGuards?:   number[];
  tRowGuards?:     number[];
}

export default function A4Document({
  d, type, lang, settings,
  extraSigMargin = 0,
  clauseGuards   = [],
  tRowGuards     = [],
}: A4Props) {
  const s  = { ...SETTINGS_DEFAULT, ...settings };
  const l  = lang === "de";

  const baseLines  = d.lines || [];
  const amendLines = type === "invoice" ? (d.amendments || []).flatMap((a: any) => a.lines || []) : [];
  const allLines   = [...baseLines, ...amendLines];
  const linesSum   = allLines.reduce((s: number, ln: any) => s + (parseFloat(ln.amt) || 0), 0);
  const retMonthly = d.retainer && d.retMo ? Math.round(linesSum * 0.8) : 0;
  const total =
    type === "amendment"
      ? (d.amendTotal || 0)
      : d.retainer && d.retMo && ["quote","revised","contract"].includes(type)
        ? Math.round(retMonthly * d.retMo)
        : linesSum;

  const deliverablesList = baseLines.length > 0
    ? baseLines.map((ln: any) => `${ln.qty ? ln.qty + "× " : ""}${ln.name}`).join(", ")
    : null;
  const allPlat       = [...new Set((d.lines || []).flatMap((ln: any) => ln.platforms || []))];
  const platformsList = allPlat.length > 0 ? allPlat.join(", ") : null;
  const cNo           = `CON-${(d.qNo || "").replace("QUO","").trim() || "001"}`;
  const iNo           = d.iNo || `INV-${(d.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;

  const countryDisplay = l
    ? (s.country === "Germany" ? "Deutschland" : s.country)
    : (s.country === "Deutschland" ? "Germany" : s.country);
  const creatorAddrLine = [s.street, [s.plz, s.city].filter(Boolean).join(" "), countryDisplay].filter(Boolean).join(", ");
  const creatorFullLine = [s.company, s.name, s.street, [s.plz, s.city].filter(Boolean).join(" "), countryDisplay].filter(Boolean).join(" · ") || "Company · Your Name · Address";

  const titles: Record<string, string> = {
    quote:     l ? "Angebot"           : "Quote",
    revised:   `${l ? "Angebot" : "Quote"} — R${d.rev || 1}`,
    contract:  l ? "Vertrag"           : "Contract",
    amendment: l ? "Nachtrag"          : "Amendment",
    invoice:   l ? "Rechnung"          : "Invoice",
    renewal:   l ? "Lizenzerneuerung"  : "License Renewal",
  };

  // ── Mini helpers ──────────────────────────────────────────
  const MRow = ({ lb, v }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 8 }}>
      <span style={{ color: C.muted }}>{lb}</span>
      <span>{v}</span>
    </div>
  );

  const catBadge: Record<string, string> = {
    influencer: "Brand Collaboration",
    ugc:        "UGC Creator",
    editorial:  "Editorial",
  };

  const inferCat = (name: string, cat?: string) => {
    if (cat) return cat;
    const n = name.toLowerCase();
    return n.includes("hero") || n.includes("editorial") || n.includes("photo story") || n.includes("mini set") ? "editorial"
         : n.includes("ugc") || n.includes("campaign video") ? "ugc"
         : "influencer";
  };

  const TRow = ({ ln, prevLn, idx }: any) => {
    const ic       = inferCat(ln.name || "", ln.cat);
    const prevIc   = prevLn ? inferCat(prevLn.name || "", prevLn.cat) : null;
    const showCat  = !!(catBadge[ic] && ic !== prevIc);
    const subDetails = [ln.usageLabel, ln.exclLabel, ...(ln.addons || []), ...(ln.platforms || [])].filter(Boolean);
    return (
      <div data-trow={idx} style={{ paddingTop: tRowGuards?.[idx] || 0, borderBottom: `1px solid ${C.rule}` }}>
        {showCat && (
          <div style={{ paddingTop: 10, paddingBottom: 1 }}>
            <span style={{ fontSize: 5.5, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.light }}>{catBadge[ic]}</span>
          </div>
        )}
        <div style={{ padding: "4px 0", display: "grid", gridTemplateColumns: "1fr 28px 52px 46px", alignItems: "baseline" }}>
          <div>
            <span style={{ fontSize: 8.5 }}>{ln.name}</span>
            {ln.note      && <span style={{ fontSize: 7, color: C.light, display: "block" }}>{ln.note}</span>}
            {subDetails.length > 0 && <span style={{ fontSize: 7, color: C.muted, display: "block" }}>{subDetails.join(" · ")}</span>}
          </div>
          <span style={{ fontSize: 8, textAlign: "right" as const, color: C.muted }}>{ln.qty || ""}</span>
          <span style={{ fontSize: 8, textAlign: "right" as const, color: C.muted }}>{ln.up ? `€ ${Number(ln.up).toLocaleString("de-DE")}` : ""}</span>
          <span style={{ fontSize: 8, textAlign: "right" as const }}>€ {Number(ln.amt || 0).toLocaleString("de-DE")}</span>
        </div>
      </div>
    );
  };

  // ── Default contract clauses ──────────────────────────────
  const _dc    = s.company || s.name || (l ? "Der/Die Auftragnehmer/in" : "The creator");
  const _total = fmt(linesSum);
  const _dd    = deliverablesList || (l ? "den vereinbarten Content gemäß Angebot" : "the content as per the agreed quote");

  const defClauses = [
    { title: l ? "§ 1 — Vertragsgegenstand" : "§ 1 — Subject Matter", text: l ? `${_dc} verpflichtet sich, folgende Leistungen gegen ein vereinbartes Honorar von ${_total} zu erbringen: ${_dd}. Umfang, Format und Zeitplan werden vor Produktionsbeginn schriftlich von beiden Parteien bestätigt. Das kreative Konzept bedarf der schriftlichen Freigabe beider Parteien vor Beginn der Produktion.` : `${_dc} agrees to produce and deliver the following for a total agreed fee of ${_total}: ${_dd}. The deliverable scope, format, and timeline shall be confirmed in writing by both parties prior to production. The creative concept is subject to mutual written approval before work begins.` },
    { title: l ? "§ 2 — Lieferung" : "§ 2 — Delivery", text: l ? `${d.delivery ? "Die Inhalte sind bis zum " + fmtD(d.delivery, true) + " zu liefern. " : ""}Die Lieferung erfolgt innerhalb des schriftlich vereinbarten Zeitrahmens. Stellt der Auftraggeber erforderliche Materialien, Freigaben, Produkte oder Zugänge nicht innerhalb von 5 Werktagen nach vereinbartem Termin zur Verfügung, verlängert sich die Lieferfrist entsprechend.` : `${d.delivery ? "Content is to be delivered by " + fmtD(d.delivery) + ". " : ""}Delivery follows the project timeline confirmed at commencement. If the client delays providing required materials, approvals, products, or access by more than 5 business days beyond any agreed handover date, the delivery deadline extends by the same period.` },
    { title: l ? "§ 3 — Korrekturen" : "§ 3 — Revisions", text: l ? "Eine (1) Korrektur je Leistung ist im Honorar enthalten. Korrekturwünsche sind innerhalb von 5 Werktagen nach Ablieferung schriftlich einzureichen; später eingereichte Anfragen können als neue Aufträge gewertet werden. Weitere Korrekturen werden nach dem jeweils gültigen Tagessatz berechnet." : "One revision per deliverable is included in the agreed fee. Revision requests must be submitted in writing within 5 business days of each delivery; requests received after this period may be treated as new work. Additional revisions are charged at the creator's current rate." },
    { title: l ? "§ 4 — Nutzungsrechte" : "§ 4 — Usage Rights", text: l ? `${_dc} räumt dem Auftraggeber ein zeitlich begrenztes, nicht-exklusives, nicht übertragbares Nutzungsrecht an den vereinbarten Inhalten für ${platformsList || "die vereinbarten Plattformen"}, den vereinbarten Zweck, Zeitraum und Geltungsbereich ein. Urheberrecht und Persönlichkeitsrechte verbleiben ausschließlich bei ${_dc}. Es werden weder dauerhafte noch exklusive Rechte gewährt.` : `${_dc} grants the client a time-limited, non-exclusive, non-transferable licence to use the delivered content for ${platformsList || "the agreed platforms"}, purpose, duration, and territory only. All copyright, moral rights, and ownership vest exclusively in ${_dc}. No perpetual, exclusive, or sub-licensable rights are granted.` },
    { title: l ? "§ 5 — Zahlung" : "§ 5 — Payment", text: l ? `Das Honorar in Höhe von ${fmt(total)} ist innerhalb von 14 Tagen nach Rechnungsdatum fällig. Bei Zahlungsverzug ist ${_dc} berechtigt, Verzugszinsen gemäß § 288 BGB ab dem ersten Verzugstag geltend zu machen. ${s.taxNote || "Gemäß § 19 UStG wird keine Umsatzsteuer erhoben."}` : `The total fee of ${fmt(total)} is due within 14 days of the invoice date. In the event of late payment, statutory default interest pursuant to § 288 BGB is charged from the first day of delay. ${s.taxNote || "No VAT is charged pursuant to § 19 UStG."}` },
    { title: l ? "§ 6 — Stornierung" : "§ 6 — Cancellation", text: l ? `Stornierungen bedürfen der Schriftform. Bei Stornierung vor Produktionsbeginn sind 25 % des vereinbarten Honorars fällig. Bei Stornierung nach Produktionsbeginn sind 50 % fällig. Ist die Leistung im Wesentlichen erbracht, ist das vollständige Honorar zu entrichten.` : `Cancellation must be submitted in writing. If the client cancels before production begins, 25% of the agreed fee is due. If the client cancels after production has begun, 50% of the agreed fee is due. If the deliverable is substantially complete, the full fee is payable.` },
  ];

  const clauses = d.clauses && d.clauses.length > 0 ? d.clauses : defClauses;
  const showTable = type !== "contract" || (d.quoteRef || "none") === "table";

  // ── Total block ───────────────────────────────────────────
  const TotalBlock = () => {
    if (type === "amendment") return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ width: 175 }}>
          <MRow lb={l ? "Ursprünglicher Betrag" : "Original Total"} v={fmt(d.origTotal || 0)} />
          <MRow lb={l ? "Nachtragsbetrag" : "Amendment Total"} v={fmt(d.amendTotal || 0)} />
          <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{l ? "Neuer Gesamtbetrag" : "New Total"}</span>
            <span style={{ fontFamily: SERIF, fontSize: 14 }}>€ {Number((d.origTotal || 0) + (d.amendTotal || 0)).toLocaleString("de-DE")}</span>
          </div>
        </div>
      </div>
    );

    if (d.retainer && d.retMo && type === "invoice") return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ width: 175 }}>
          <MRow lb={l ? "Zwischensumme" : "Subtotal"} v={`€ ${Number(Math.round(linesSum / 0.8)).toLocaleString("de-DE")}`} />
          <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 4, marginTop: 3 }}>
            <MRow lb={l ? "Retainer-Rabatt −20%" : "Retainer discount −20%"} v={`−€ ${Number(Math.round(linesSum / 0.8) - linesSum).toLocaleString("de-DE")}`} />
          </div>
          <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{l ? "Gesamt (EUR)" : "Total (EUR)"}</span>
            <span style={{ fontFamily: SERIF, fontSize: 15 }}>€ {Number(total).toLocaleString("de-DE")}</span>
          </div>
        </div>
      </div>
    );

    if (d.retainer && d.retMo && ["quote","revised","contract"].includes(type)) return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ width: 175 }}>
          <MRow lb={l ? "Mtl. Zwischensumme" : "Monthly subtotal"} v={`€ ${Number(linesSum).toLocaleString("de-DE")}`} />
          <MRow lb={l ? "Retainer-Rabatt −20%" : "Retainer discount −20%"} v={`−€ ${Number(linesSum - retMonthly).toLocaleString("de-DE")}`} />
          <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 4, marginTop: 3 }}>
            <MRow lb={l ? "Monatliche Rate" : "Monthly fee"} v={`€ ${Number(retMonthly).toLocaleString("de-DE")}`} />
            <MRow lb={`× ${d.retMo} ${l ? "Monate" : "months"}`} v="" />
          </div>
          <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{l ? "Gesamt (EUR)" : "Total (EUR)"}</span>
            <span style={{ fontFamily: SERIF, fontSize: 15 }}>€ {Number(total).toLocaleString("de-DE")}</span>
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ textAlign: "right" as const, marginBottom: 10 }}>
        <p style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 3px" }}>{l ? "Gesamt (EUR)" : "Total (EUR)"}</p>
        <p style={{ fontFamily: SERIF, fontSize: 15, margin: 0 }}>€ {Number(total).toLocaleString("de-DE")}</p>
      </div>
    );
  };

  // ── Sort lines by category ────────────────────────────────
  const catOrder: Record<string, number> = { influencer: 0, ugc: 1, editorial: 2 };
  const sortLines = (arr: any[]) => [...arr].sort((a, b) => {
    const c1 = inferCat(a.name || "", a.cat);
    const c2 = inferCat(b.name || "", b.cat);
    return (catOrder[c1] ?? 0) - (catOrder[c2] ?? 0);
  });
  const displayLines = sortLines(type === "invoice" ? allLines : baseLines);

  return (
    <div style={{ padding: "120px 62px 90px", fontSize: 9.5, lineHeight: 1.5, position: "relative", minHeight: 841, fontFamily: SANS, color: C.black, background: C.bg }}>

      {/* ── TITLE ── */}
      <div style={{ margin: "0 0 22px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 28px" }}>{titles[type] || type}</h1>
        {type !== "contract" && <p style={{ fontSize: 7.5, color: C.muted, margin: 0 }}>{creatorFullLine}</p>}
      </div>

      {/* ── TO / DETAILS ROW ── */}
      <div style={{ display: "flex", justifyContent: type === "contract" ? "flex-end" : "space-between", marginBottom: 13 }}>
        {type !== "contract" && (
          <div>
            <p style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 4px" }}>{l ? "An" : "To"}</p>
            <p style={{ fontSize: 9, fontWeight: "500", margin: "0 0 1px" }}>{d.brand || "[Brand]"}</p>
            <p style={{ fontSize: 8, color: C.muted, margin: 0 }}>{d.contact || ""}</p>
          </div>
        )}
        <div style={{ width: 145 }}>
          <p style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 4px" }}>Details</p>
          {type === "quote"     && <><MRow lb={l?"Angebotsnr.":"Quote No."}   v={d.qNo}/><MRow lb={l?"Datum":"Date"} v={fmtD(d.date,l)}/><MRow lb={l?"Gültig bis":"Valid Until"} v={fmtD(d.validUntil,l)}/></>}
          {type === "revised"   && <><MRow lb={l?"Angebotsnr.":"Quote No."}   v={d.qNo}/><MRow lb={l?"Datum":"Date"} v={fmtD(d.date,l)}/><MRow lb="Revision" v={`R${d.rev||1}`}/></>}
          {type === "contract"  && <><MRow lb={l?"Vertragsnr.":"Contract No."} v={cNo}/><MRow lb={l?"Datum":"Date"} v={fmtD(d.date,l)}/><MRow lb={l?"Angebotsnr.":"Quote Ref."} v={d.qNo}/></>}
          {type === "amendment" && <><MRow lb={l?"Nachtragsnr.":"Amendment No."} v={d.aNo}/><MRow lb={l?"Datum":"Date"} v={fmtD(d.date,l)}/><MRow lb={l?"Vertragsnr.":"Contract Ref."} v={cNo}/></>}
          {type === "invoice"   && <><MRow lb={l?"Rechnungsnr.":"Invoice No."} v={iNo}/><MRow lb={l?"Datum":"Date"} v={fmtD(d.date,l)}/><MRow lb={l?"Lieferdatum":"Delivery Date"} v={fmtD(d.delivery,l)}/></>}
          {type === "renewal"   && <><MRow lb={l?"Rechnungsnr.":"Invoice No."} v={d.rNo}/><MRow lb={l?"Datum":"Date"} v={fmtD(d.date,l)}/><MRow lb={l?"Orig. Rechnung":"Orig. Invoice"} v={iNo}/></>}
        </div>
      </div>

      {/* ── CONTRACT PARTIES ── */}
      {type === "contract" && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10 }}>
          <div style={{ flex: 1, paddingRight: 16 }}>
            <p style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 3px" }}>{l ? "Zwischen" : "Between"}</p>
            <p style={{ fontSize: 9, fontWeight: "500", margin: 0 }}>{s.company || s.name || "Lynn Hoa"}</p>
            {s.name && s.company && <p style={{ fontSize: 8, color: C.muted, margin: "0 0 1px" }}>{s.name}</p>}
            <p style={{ fontSize: 8, color: C.muted, margin: 0 }}>{creatorAddrLine}</p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 3px" }}>{l ? "Und" : "And"}</p>
            <p style={{ fontSize: 9, fontWeight: "500", margin: 0 }}>{d.brand}</p>
            <p style={{ fontSize: 8, color: C.muted, margin: 0 }}>{d.contact}</p>
          </div>
        </div>
      )}

      {/* ── LINE ITEMS TABLE ── */}
      {showTable && <>
        <div style={{ borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}`, padding: "4px 0", display: "grid", gridTemplateColumns: "1fr 28px 52px 46px", marginBottom: 0 }}>
          {[l?"Leistung":"Description", l?"Anz.":"Qty", l?"Einzelpreis":"Unit Price", l?"Betrag":"Amount"].map((h, i) => (
            <span key={h} style={{ fontSize: 6, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted, textAlign: i > 0 ? "right" as const : "left" as const }}>{h}</span>
          ))}
        </div>
        {displayLines.map((ln: any, i: number) => (
          <TRow key={i} idx={i} ln={ln} prevLn={displayLines[i-1]} />
        ))}
      </>}

      {/* ── CONTRACT QUOTE REF ── */}
      {type === "contract" && (d.quoteRef || "none") === "ref" && (
        <div style={{ padding: "10px 0", marginBottom: 0 }}>
          <p style={{ fontSize: 8.5, color: C.muted, margin: 0, fontStyle: "italic" }}>
            {l ? `Bezugnehmend auf Angebot ${d.qNo || ""}${d.date ? ` vom ${fmtD(d.date, l)}` : ""}.` : `As per the agreed quote ${d.qNo || ""}${d.date ? ` dated ${fmtD(d.date)}` : ""}.`}
          </p>
        </div>
      )}

      {/* ── CONTRACT RETAINER TOTAL ── */}
      {type === "contract" && d.retainer && d.retMo && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ width: 175 }}>
            <MRow lb={l?"Mtl. Zwischensumme":"Monthly subtotal"} v={`€ ${Number(linesSum).toLocaleString("de-DE")}`} />
            <MRow lb={l?"Retainer-Rabatt −20%":"Retainer discount −20%"} v={`−€ ${Number(linesSum - retMonthly).toLocaleString("de-DE")}`} />
            <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 4, marginTop: 3 }}>
              <MRow lb={l?"Monatliche Rate":"Monthly fee"} v={`€ ${Number(retMonthly).toLocaleString("de-DE")}`} />
              <MRow lb={`× ${d.retMo} ${l?"Monate":"months"}`} v="" />
            </div>
            <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{l?"Gesamt (EUR)":"Total (EUR)"}</span>
              <span style={{ fontFamily: SERIF, fontSize: 15 }}>€ {Number(total).toLocaleString("de-DE")}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTRACT CLAUSES ── */}
      {type === "contract" && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.rule}` }}>
          {clauses.map((cl: any, ci: number) => (
            <div data-clause={ci} key={ci} style={{ marginBottom: 0, paddingTop: 10 + (clauseGuards?.[ci] || 0), paddingBottom: 11 }}>
              <p style={{ fontFamily: SERIF, fontSize: 7.5, fontWeight: "normal", color: "#5a5a5a", letterSpacing: "0.01em", margin: "0 0 5px" }}>{cl.title}</p>
              <p style={{ fontSize: 8.5, lineHeight: 1.85, margin: 0, color: "#404040" }}>{cl.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── SIGNATURE ANCHOR ── */}
      {type === "amendment" ? (
        <div data-sig-anchor="true" style={{ marginTop: 22 + extraSigMargin }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <div style={{ width: 175 }}>
              <MRow lb={l?"Ursprünglicher Betrag":"Original Total"} v={fmt(d.origTotal || 0)} />
              <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 4, marginTop: 3 }}>
                <MRow lb={l?"Nachtragsbetrag":"Amendment Total"} v={fmt(d.amendTotal || 0)} />
              </div>
              <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 6.5, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{l?"Neuer Gesamtbetrag":"New Total"}</span>
                <span style={{ fontFamily: SERIF, fontSize: 14 }}>€ {Number((d.origTotal||0)+(d.amendTotal||0)).toLocaleString("de-DE")}</span>
              </div>
            </div>
          </div>
          <div style={{ paddingTop: 14, borderTop: `1px solid ${C.rule}` }}>
            <p style={{ fontSize: 8, color: C.muted, lineHeight: 1.75, margin: "0 0 18px" }}>
              {l ? "Dieser Nachtrag ergänzt den genannten Vertrag. Alle übrigen Bedingungen bleiben unverändert." : "This amendment extends the original contract. All other terms remain unchanged and in full effect."}
            </p>
          </div>
        </div>
      ) : !["contract"].includes(type) && (
        <div data-sig-anchor="true" style={{ marginTop: 22 + extraSigMargin }}>
          <TotalBlock />
          {["quote","revised"].includes(type) && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${C.rule}` }}>
              <p style={{ fontSize: 8, color: C.muted, lineHeight: 1.75, margin: "0 0 6px" }}>
                {l
                  ? `Dieses Angebot ist 14 Tage gültig. Preise basieren auf dem vereinbarten Umfang. Produkt von der Marke gestellt. Nutzungsrechte zeitlich begrenzt. 1 Korrektur je Leistung inklusive.${d.retainer && d.retMo ? ` Retainer-Vereinbarung über ${d.retMo} Monate · monatliche Abrechnung · −20% Retainer-Rabatt inklusive.` : ""}`
                  : `This quote is valid for 14 days. Prices based on agreed scope. Product provided by brand. Usage rights time-limited. One revision included per deliverable.${d.retainer && d.retMo ? ` Retainer agreement — ${d.retMo} months · invoiced monthly · −20% retainer discount applied.` : ""}`
                }
              </p>
              <p style={{ fontSize: 9, fontStyle: "italic", margin: "14px 0 0" }}>{d.footer || "Looking forward to working together."}</p>
            </div>
          )}
          {["invoice","renewal"].includes(type) && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${C.rule}` }}>
              <p style={{ fontSize: 8, color: C.light, lineHeight: 1.75, margin: "0 0 8px" }}>
                {l
                  ? `Zahlbar an ${s.bankName||"[Bank Name]"}${s.iban?`, IBAN: ${s.iban}`:""}${s.bic?`, BIC: ${s.bic}`:""}${s.paypalEmail?` oder per PayPal: ${s.paypalEmail}`:""} . Zahlungsziel: 14 Tage. Verwendungszweck: ${(s.name||s.company||"IHRE FIRMA").toUpperCase()} – ${d.brand||"[Marke]"} – ${type==="renewal"?d.rNo:iNo}. ${s.taxNote||"Gemäß §19 UStG wird keine Umsatzsteuer erhoben."}`
                  : `Please transfer to ${s.bankName||"[Bank Name]"}${s.iban?`, IBAN: ${s.iban}`:""}${s.bic?`, BIC: ${s.bic}`:""}${s.paypalEmail?` or via PayPal: ${s.paypalEmail}`:""} . Payment due within 14 days. Reference: ${(s.name||s.company||"YOUR COMPANY").toUpperCase()} – ${d.brand||"[Brand]"} – ${type==="renewal"?d.rNo:iNo}. ${s.taxNote||"No VAT charged pursuant to §19 UStG."}`
                }
              </p>
              <p style={{ fontSize: 9, fontStyle: "italic", margin: "14px 0 0" }}>{d.footer || (l?"Vielen Dank für die angenehme Zusammenarbeit.":"Thank you for the pleasure of working together.")}</p>
            </div>
          )}
        </div>
      )}

      {/* ── SIGNATURE BLOCK (contract + amendment) ── */}
      {["contract","amendment"].includes(type) && (
        <div data-sig-anchor="true" style={{ display: "flex", justifyContent: "space-between", marginTop: 44 + extraSigMargin }}>
          {[s.company || s.name || "Lynn Hoa", d.brand || "[Brand]"].map((nm: string) => (
            <div key={nm} style={{ width: "44%" }}>
              <p style={{ fontSize: 8.5, fontWeight: "500", margin: "0 0 2px" }}>{nm}</p>
              <div style={{ borderBottom: `1px solid ${C.rule}`, margin: "30px 0 5px" }} />
              <p style={{ fontSize: 7.5, color: C.muted, margin: "0 0 26px" }}>{l?"Unterschrift":"Signature"}</p>
              <div style={{ borderBottom: `1px solid ${C.rule}`, margin: "0 0 5px" }} />
              <p style={{ fontSize: 7.5, color: C.muted, margin: 0 }}>{l?"Datum, Ort":"Date and Place"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
