// ─────────────────────────────────────────────────────────────
// RenewalModal — usage rights / exclusivity renewal builder
// Verbatim port of old App.tsx lines 2078–2322.
// Output renewal record (old-app authoritative shape):
//   { id, optLabel, startDate, endDate, fee, rNo, signed:false, paid:false, doc }
// Caller (saveRenewal) forces signed:true on save.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF } from "./constants";
import { fmt, fmtD, addM, addD, today, uid } from "./formatters";
import { I, S, B, Lbl, Pill } from "./atoms";
import { RENEWAL_OPTS } from "./rateCards";
import PDFModal from "./PDFModal";

const CAT_FROM_ID = (id: string) => {
  if (!id) return "";
  const p = id.charAt(0);
  return p === "i" ? "Influencer" : p === "u" ? "UGC" : p === "e" ? "Editorial" : p === "h" ? "Hotels" : "";
};

export default function RenewalModal({ p, onSave, onClose, rc, settings }: any) {
  const q = p.qd;
  // all billable lines from quote + signed amendments
  const origLines  = (q?.lines || []).map((l: any) => ({ ...l, _src: "quote" }));
  const amendLines = (p.amendments || []).filter((a: any) => a.signed).flatMap((a: any) =>
    (a.lines || []).map((l: any) => ({ ...l, _src: `Amend ${a.aNo}` }))
  );
  const allLines = [...origLines, ...amendLines].filter((l: any) => l.amt > 0);
  const catLabel = CAT_FROM_ID;

  // 01 deliverables — qty stepper (0 = not selected, max = qty in quote)
  const [selQty, setSelQty] = useState<Record<string, number>>({});
  const setQty = (key: string, max: number, val: number) =>
    setSelQty(p => ({ ...p, [key]: Math.max(0, Math.min(max, val)) }));
  const base = allLines.reduce((s: number, l: any, i: number) => {
    const key = l.id || `line_${i}`;
    const qty = selQty[key] || 0;
    return s + (parseFloat(l.up || 0) * qty);
  }, 0);

  // 02 usage rights
  const [uMode, setUMode]             = useState<"predefined" | "custom" | "none">("none");
  const [uIdx, setUIdx]               = useState(0);
  const [uCustomDays, setUCustomDays] = useState("");
  const [uCustomUnit, setUCustomUnit] = useState<"days" | "months">("days");
  const [uCustomFee, setUCustomFee]   = useState("");
  const uOpt = RENEWAL_OPTS.usage[uIdx];
  const uFee = uMode === "predefined" ? Math.round(base * (uOpt.pct / 100)) : uMode === "custom" ? parseFloat(uCustomFee) || 0 : 0;

  // 03 exclusivity
  const [eMode, setEMode]             = useState<"predefined" | "custom" | "none">("none");
  const [eIdx, setEIdx]               = useState(0);
  const [eCustomDays, setECustomDays] = useState("");
  const [eCustomUnit, setECustomUnit] = useState<"days" | "months">("days");
  const [eCustomFee, setECustomFee]   = useState("");
  const eOpt = RENEWAL_OPTS.excl[eIdx];
  const eFee = eMode === "predefined" ? Math.round(base * (eOpt.pct / 100)) : eMode === "custom" ? parseFloat(eCustomFee) || 0 : 0;

  // 04 dates
  const [startD, setStartD] = useState(today());
  const calcEnd = (mode: string, opt: any, customDays: string, customUnit: string) => {
    if (mode === "predefined") return addM(startD, opt.mo);
    if (mode === "custom") {
      const n = parseInt(customDays) || 0;
      return customUnit === "days" ? addD(startD, n) : addM(startD, n);
    }
    return null;
  };
  const uEnd = calcEnd(uMode, uOpt, uCustomDays, uCustomUnit);
  const eEnd = calcEnd(eMode, eOpt, eCustomDays, eCustomUnit);
  const endD = uEnd && eEnd ? (uEnd > eEnd ? uEnd : eEnd) : uEnd || eEnd;

  const totalFee = uFee + eFee;
  const rNo = `RNW-${(q?.qNo || "").replace("QUO", "").trim() || "001"}-${String((p.renewals || []).length + 1).padStart(2, "0")}`;
  const canPreview = base > 0 && (uMode !== "none" || eMode !== "none") && totalFee > 0;

  const [showPreview, setShowPreview] = useState(false);

  const buildDoc = () => {
    const lines: any[] = [];
    const selLines = allLines.filter((_l: any, i: number) => { const key = _l.id || `line_${i}`; return (selQty[key] || 0) > 0; });
    const itemsSummary = selLines.map((_l: any, i: number) => {
      const key = _l.id || `line_${i}`;
      const qty = selQty[key] || 0;
      const cat = _l.cat === "influencer" ? "Influencer" : _l.cat === "ugc" ? "UGC" : _l.cat === "editorial" ? "Editorial" : "";
      return `${qty}× ${_l.name}${cat ? ` [${cat}]` : ""}`;
    }).join(", ");
    if (uMode !== "none" && uFee > 0) {
      const label = uMode === "predefined" ? uOpt.l : `Custom (${uCustomDays} ${uCustomUnit})`;
      const pctNote = uMode === "predefined" && uOpt.pct > 0 ? ` · ${fmt(base)} × ${uOpt.pct}% = ${fmt(uFee)}` : "";
      lines.push({ name: `Usage Rights — ${label}`, note: `${itemsSummary}${pctNote} · ${fmtD(startD)}${uEnd ? ` → ${fmtD(uEnd)}` : ""}`, qty: 1, up: uFee, amt: uFee });
    }
    if (eMode !== "none" && eFee > 0) {
      const label = eMode === "predefined" ? eOpt.l : `Custom (${eCustomDays} ${eCustomUnit})`;
      const pctNote = eMode === "predefined" && eOpt.pct > 0 ? ` · ${fmt(base)} × ${eOpt.pct}% = ${fmt(eFee)}` : "";
      lines.push({ name: `Exclusivity — ${label}`, note: `${itemsSummary}${pctNote} · ${fmtD(startD)}${eEnd ? ` → ${fmtD(eEnd)}` : ""}`, qty: 1, up: eFee, amt: eFee });
    }
    return {
      brand: q?.brand, contact: q?.contact, date: today(),
      rNo, qNo: q?.qNo, ctype: q?.ctype || "Content Creator",
      lines, total: totalFee,
      startDate: startD, endDate: endD,
      footer: "Thank you for the pleasure of working together.",
      type: "renewal",
    };
  };

  const SectionHead = ({ n, title }: any) => (
    <p style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 10px", paddingBottom: 6, borderBottom: `1px solid ${C.rule}` }}>{n} — {title}</p>
  );
  const ModeToggle = ({ val, set }: { val: string; set: (v: any) => void }) => (
    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
      <Pill on={val === "none"} onClick={() => set("none")}>None</Pill>
      <Pill on={val === "predefined"} onClick={() => set("predefined")}>Predefined</Pill>
      <Pill on={val === "custom"} onClick={() => set("custom")}>Custom</Pill>
    </div>
  );

  if (showPreview) {
    const doc = buildDoc();
    const renewal = { id: uid(), optLabel: [uMode !== "none" ? uOpt?.l : "", eMode !== "none" ? eOpt?.l : ""].filter(Boolean).join(" + ") || "Custom", startDate: startD, endDate: endD, fee: totalFee, rNo, signed: false, paid: false, doc };
    return (
      <PDFModal
        data={doc}
        type="renewal"
        settings={settings}
        isNew={true}
        onClose={onClose}
        onSave={() => onSave(renewal)}
        onSaveClose={onClose}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.bg, width: "100%", maxWidth: 520, borderRadius: 2, padding: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: "normal", margin: 0 }}>Add Renewal</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.muted }}>✕</button>
        </div>
        <p style={{ fontSize: 10.5, color: C.muted, margin: "0 0 16px" }}>Project: <strong style={{ color: C.black }}>{p.name}</strong></p>

        {/* 01 — Deliverables */}
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 12, background: C.white }}>
          <SectionHead n="01" title="Which Deliverables" />
          <p style={{ fontSize: 9.5, color: C.muted, margin: "0 0 8px" }}>Select items the renewal fee applies to. Their prices are the base for % calculation.</p>
          {allLines.map((l: any, i: number) => {
            const key = l.id || `line_${i}`;
            const max = l.qty || 1;
            const qty = selQty[key] || 0;
            const catFromId = catLabel(l.id || "");
            const catFromField = l.cat === "influencer" ? "Influencer" : l.cat === "ugc" ? "UGC" : l.cat === "editorial" ? "Editorial" : l.cat === "hotels" ? "Hotels" : "";
            const cat = catFromId || catFromField;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.rule}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 10.5, color: C.black }}>{l.name}</span>
                    {cat && <span style={{ fontSize: 8, color: C.muted, border: `1px solid ${C.rule}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.06em", textTransform: "uppercase" as const, flexShrink: 0 }}>{cat}</span>}
                    {l._src !== "quote" && <span style={{ fontSize: 8, color: C.amber, border: `1px solid ${C.amber}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.06em", flexShrink: 0 }}>{l._src}</span>}
                  </div>
                  <span style={{ fontSize: 9, color: C.light }}>€{l.up} each · max {max}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <button onClick={() => setQty(key, max, qty - 1)} style={{ width: 22, height: 22, border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: qty > 0 ? C.black : C.light, lineHeight: 1 }}>−</button>
                  <span style={{ fontSize: 11, fontFamily: SERIF, minWidth: 16, textAlign: "center", color: qty > 0 ? C.black : C.light }}>{qty}</span>
                  <button onClick={() => setQty(key, max, qty + 1)} style={{ width: 22, height: 22, border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: qty < max ? C.black : C.light, lineHeight: 1 }}>+</button>
                </div>
                <span style={{ fontFamily: SERIF, fontSize: 10, color: qty > 0 ? C.black : C.muted, flexShrink: 0, minWidth: 52, textAlign: "right" }}>{qty > 0 ? fmt(parseFloat(l.up || 0) * qty) : "—"}</span>
              </div>
            );
          })}
          {base > 0 && <p style={{ fontSize: 10, color: C.muted, margin: "8px 0 0", textAlign: "right" }}>Base: <strong style={{ color: C.black, fontFamily: SERIF }}>{fmt(base)}</strong></p>}
        </div>

        {/* 02 — Usage Rights */}
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 12, background: C.white }}>
          <SectionHead n="02" title="Usage Rights" />
          <ModeToggle val={uMode} set={setUMode} />
          {uMode === "predefined" && <>
            <S value={uIdx} onChange={(e: any) => setUIdx(parseInt(e.target.value))} s={{ marginBottom: 6 }}>
              {RENEWAL_OPTS.usage.map((o, i) => <option key={i} value={i}>{o.l}{o.pct > 0 ? ` (+${o.pct}%)` : ""}</option>)}
            </S>
            {base > 0 && <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Fee: <strong style={{ color: C.black, fontFamily: SERIF }}>{fmt(uFee)}</strong> ({uOpt.pct}% of {fmt(base)})</p>}
          </>}
          {uMode === "custom" && <>
            <Lbl>Reference rate <span style={{ fontWeight: "normal", color: C.light }}>(for pro-rata calculation)</span></Lbl>
            <S value={uIdx} onChange={(e: any) => setUIdx(parseInt(e.target.value))} s={{ marginBottom: 8, opacity: 0.6 }}>
              {RENEWAL_OPTS.usage.map((o, i) => <option key={i} value={i}>{o.l}{o.pct > 0 ? ` (+${o.pct}%)` : ""}</option>)}
            </S>
            <div style={{ display: "flex", gap: 7, marginBottom: 6 }}>
              <I type="number" placeholder="Duration" value={uCustomDays} onChange={(e: any) => {
                const d = parseInt(e.target.value) || 0;
                setUCustomDays(e.target.value);
                if (d > 0 && uOpt.pct > 0 && uOpt.mo > 0 && base > 0) {
                  const refDays = uOpt.mo * 30;
                  const proRataPct = (d / refDays) * uOpt.pct;
                  setUCustomFee(String(Math.round(base * proRataPct / 100)));
                }
              }} s={{ flex: 1 }} />
              <S value={uCustomUnit} onChange={(e: any) => setUCustomUnit(e.target.value)} s={{ flex: 1 }}>
                <option value="days">Days</option>
                <option value="months">Months</option>
              </S>
            </div>
            {uCustomDays && uOpt.pct > 0 && base > 0 && <p style={{ fontSize: 9.5, color: C.muted, margin: "0 0 6px" }}>Pro-rata: {parseInt(uCustomDays) || 0}d / {uOpt.mo * 30}d × {uOpt.pct}% = {Math.round(((parseInt(uCustomDays) || 0) / (uOpt.mo * 30)) * uOpt.pct)}% of {fmt(base)}</p>}
            <I type="number" placeholder="Fee (€)" value={uCustomFee} onChange={(e: any) => setUCustomFee(e.target.value)} />
          </>}
        </div>

        {/* 03 — Exclusivity */}
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 12, background: C.white }}>
          <SectionHead n="03" title="Exclusivity" />
          <ModeToggle val={eMode} set={setEMode} />
          {eMode === "predefined" && <>
            <S value={eIdx} onChange={(e: any) => setEIdx(parseInt(e.target.value))} s={{ marginBottom: 6 }}>
              {RENEWAL_OPTS.excl.map((o, i) => <option key={i} value={i}>{o.l}{o.pct > 0 ? ` (+${o.pct}%)` : ""}</option>)}
            </S>
            {base > 0 && <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Fee: <strong style={{ color: C.black, fontFamily: SERIF }}>{fmt(eFee)}</strong> ({eOpt.pct}% of {fmt(base)})</p>}
          </>}
          {eMode === "custom" && <>
            <Lbl>Reference rate <span style={{ fontWeight: "normal", color: C.light }}>(for pro-rata calculation)</span></Lbl>
            <S value={eIdx} onChange={(e: any) => setEIdx(parseInt(e.target.value))} s={{ marginBottom: 8, opacity: 0.6 }}>
              {RENEWAL_OPTS.excl.map((o, i) => <option key={i} value={i}>{o.l}{o.pct > 0 ? ` (+${o.pct}%)` : ""}</option>)}
            </S>
            <div style={{ display: "flex", gap: 7, marginBottom: 6 }}>
              <I type="number" placeholder="Duration" value={eCustomDays} onChange={(e: any) => {
                const d = parseInt(e.target.value) || 0;
                setECustomDays(e.target.value);
                if (d > 0 && eOpt.pct > 0 && eOpt.mo > 0 && base > 0) {
                  const refDays = eOpt.mo * 30;
                  const proRataPct = (d / refDays) * eOpt.pct;
                  setECustomFee(String(Math.round(base * proRataPct / 100)));
                }
              }} s={{ flex: 1 }} />
              <S value={eCustomUnit} onChange={(e: any) => setECustomUnit(e.target.value)} s={{ flex: 1 }}>
                <option value="days">Days</option>
                <option value="months">Months</option>
              </S>
            </div>
            {eCustomDays && eOpt.pct > 0 && base > 0 && <p style={{ fontSize: 9.5, color: C.muted, margin: "0 0 6px" }}>Pro-rata: {parseInt(eCustomDays) || 0}d / {eOpt.mo * 30}d × {eOpt.pct}% = {Math.round(((parseInt(eCustomDays) || 0) / (eOpt.mo * 30)) * eOpt.pct)}% of {fmt(base)}</p>}
            <I type="number" placeholder="Fee (€)" value={eCustomFee} onChange={(e: any) => setECustomFee(e.target.value)} />
          </>}
        </div>

        {/* 04 — Dates */}
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 12, background: C.white }}>
          <SectionHead n="04" title="Dates" />
          <Lbl>Start Date</Lbl>
          <I type="date" value={startD} onChange={(e: any) => setStartD(e.target.value)} s={{ marginBottom: 6 }} />
          {endD && <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>End date: <strong style={{ color: C.black }}>{fmtD(endD)}</strong></p>}
        </div>

        {/* Total */}
        <div style={{ padding: "9px 12px", border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Renewal Total</span>
          <span style={{ fontFamily: SERIF, fontSize: 18 }}>{fmt(totalFee)}</span>
        </div>

        <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
          <B v="sec" onClick={onClose}>Cancel</B>
          <B s={{ opacity: canPreview ? 1 : 0.4 }} onClick={() => { if (!canPreview) return; setShowPreview(true); }}>Preview & Save</B>
        </div>
      </div>
    </div>
  );
}
