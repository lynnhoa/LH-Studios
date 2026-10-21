// ─────────────────────────────────────────────────────────────
// RenewalModal — usage rights / exclusivity renewal (or a rights
// extension as an amendment). One window: builder on the left,
// the live document on the right. Percentages come from each
// line's own rate card; the base is the line's base price (before
// earlier usage / exclusivity / add-ons). Saving creates the draft
// invoice (renewal) or the draft amendment; the caller opens it.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { editLock } from "./saveStatus";
import { C, SANS, SERIF, TYPE, Z, TRACK, RADIUS, ICON } from "./constants";
import { fmt, fmtD, addM, addD, today, r2 } from "./formatters";
import { I, S, B, Lbl, Pill, CatPill, LangSwitch, BAR_BTN, NumField, ConfirmDialog, MiniInput, MiniSelect, PillBtn } from "./atoms";
import { currentContractOf } from "./money";
import { retainerMonths } from "./wsHelpers";
import DocPages from "./DocPages";
import { dueFrom } from "./docs";
import type { DocView } from "./docs";
import { normalizeCards, lineBase, renewalOptions, pctOn, optName, pctText, renewalStart } from "./pricing";

type Mode = "none" | "predefined" | "custom";

export default function RenewalModal({ p, onSave, onClose, rc: rawRc, settings, client, mode = "renewal", onCalc }: any) {
  const isAmendMode = mode === "amend";
  const rc = useMemo(() => normalizeCards(rawRc), [rawRc]);
  useEffect(() => editLock.acquire(), []);
  const q = p.qd;

  // all billable lines from the quote + signed amendments
  const allLines = useMemo(() => {
    const orig  = (q?.lines || []).map((l: any) => ({ ...l, _src: "quote" }));
    const amend = (p.amendments || []).filter((a: any) => a.signed).flatMap((a: any) => (a.lines || []).map((l: any) => ({ ...l, _src: a.aNo || "Amendment" })));
    return [...orig, ...amend].filter((l: any) => Number(l.amt) > 0).map((l: any, i: number) => ({
      ...l, _key: l.id || `line_${i}`, _unitBase: r2(lineBase(l) / Math.max(1, parseInt(l.qty) || 1)),
    }));
  }, [q, p.amendments]);

  // ── 01 which deliverables ──
  const [selQty, setSelQty] = useState<Record<string, number>>({});
  const setQty = (key: string, max: number, val: number) => setSelQty(s => ({ ...s, [key]: Math.max(0, Math.min(max, val)) }));
  const selected = allLines.filter((l: any) => (selQty[l._key] || 0) > 0).map((l: any) => ({ l, qty: selQty[l._key], base: r2(l._unitBase * selQty[l._key]) }));
  const base = r2(selected.reduce((s: number, x: any) => s + x.base, 0));
  const mainCat = selected[0]?.l.cat || q?.ctab || allLines[0]?.cat || "influencer";

  // ── 02 usage / 03 exclusivity (options from the line's own card) ──
  const uOpts = renewalOptions(rc, rc[mainCat] ? mainCat : "influencer", "usage");
  const eOpts = renewalOptions(rc, rc[mainCat] ? mainCat : "influencer", "excl");
  const [uMode, setUMode] = useState<Mode>("none");
  const [eMode, setEMode] = useState<Mode>("none");
  const [uIdx, setUIdx] = useState(() => Math.max(0, uOpts.findIndex((o: any) => Number(o.pct) > 0)));
  const [eIdx, setEIdx] = useState(0);
  const [uN, setUN] = useState(""); const [uUnit, setUUnit] = useState<"months" | "days">("months");
  const [eN, setEN] = useState(""); const [eUnit, setEUnit] = useState<"months" | "days">("months");
  const [uFeeIn, setUFeeIn] = useState<string | null>(null);   // manual override (custom)
  const [eFeeIn, setEFeeIn] = useState<string | null>(null);
  const uOpt = uOpts[Math.min(uIdx, uOpts.length - 1)];
  const eOpt = eOpts[Math.min(eIdx, eOpts.length - 1)];

  // fee for a set of lines: each line uses its own card's % for the chosen option
  const feeFor = (kind: "usage" | "excl", opt: any, factor: number) =>
    r2(selected.reduce((s: number, x: any) => s + x.base * pctOn(rc, x.l.cat || mainCat, kind, opt) / 100 * factor, 0));   // cent-exact
  const factorOf = (opt: any, n: string, unit: "months" | "days") => {
    const v = parseInt(n) || 0;
    const refMo = Number(opt?.mo) || 1;
    return unit === "months" ? v / refMo : v / (refMo * 30);
  };
  const uCalc = uMode === "predefined" ? feeFor("usage", uOpt, 1) : uMode === "custom" ? feeFor("usage", uOpt, factorOf(uOpt, uN, uUnit)) : 0;
  const eCalc = eMode === "predefined" ? feeFor("excl", eOpt, 1) : eMode === "custom" ? feeFor("excl", eOpt, factorOf(eOpt, eN, eUnit)) : 0;
  const uFee = uMode === "custom" && uFeeIn !== null ? Math.max(0, parseFloat(uFeeIn) || 0) : uCalc;
  const eFee = eMode === "custom" && eFeeIn !== null ? Math.max(0, parseFloat(eFeeIn) || 0) : eCalc;

  // ── 04 dates: start = day after the current license ends ──
  const [startD, setStartD] = useState(() => renewalStart(p));
  const endOf = (m: Mode, opt: any, n: string, unit: "months" | "days") =>
    m === "predefined" ? addM(startD, Number(opt?.mo) || 0)
    : m === "custom" ? (unit === "months" ? addM(startD, parseInt(n) || 0) : addD(startD, parseInt(n) || 0))
    : null;
  const uEnd = endOf(uMode, uOpt, uN, uUnit);
  const eEnd = endOf(eMode, eOpt, eN, eUnit);
  const endD = uEnd && eEnd ? (uEnd > eEnd ? uEnd : eEnd) : uEnd || eEnd;
  const totalFee = uFee + eFee;
  const canSave = base > 0 && (uMode !== "none" || eMode !== "none") && totalFee > 0;

  // ── the document being built (shown live on the right) ──
  const doc: DocView = useMemo(() => {
    const items = selected.map((x: any) => `${x.qty}× ${x.l.name}`).join(", ");
    const lines: any[] = [];
    const lineFor = (title: string, m: Mode, opt: any, n: string, unit: string, fee: number, end: string | null, kind: "usage" | "excl") => {
      const label = m === "predefined" ? optName(opt?.l) : `${n} ${unit}`;
      const pctNote = m === "predefined"
        ? ` · ${fmt(base)} × ${pctText(pctOn(rc, mainCat, kind, opt))}`
        : ` · pro rata of ${optName(opt?.l)}`;
      lines.push({ name: `${title} — ${label}`, note: `${items}${pctNote} · ${fmtD(startD)}${end ? ` → ${fmtD(end)}` : ""}`, qty: 1, up: fee, amt: fee });
    };
    if (uMode !== "none" && uFee > 0) lineFor("Usage Rights", uMode, uOpt, uN, uUnit, uFee, uEnd, "usage");
    if (eMode !== "none" && eFee > 0) lineFor("Exclusivity", eMode, eOpt, eN, eUnit, eFee, eEnd, "excl");
    const common = { brand: q?.brand, contact: q?.contact, ctype: q?.ctype || "Content Creator", lines, startDate: startD, endDate: endD, footer: "" };
    const d0 = today();
    return isAmendMode
      ? { kind: "amendment", docNo: "", revision: 0, status: "draft", docDate: d0, lang: "en", data: { ...common, amendTotal: totalFee, origTotal: p.amount || 0 } }
      : { kind: "invoice", subtype: "renewal", docNo: "", revision: 0, status: "draft", docDate: d0, dueDate: dueFrom(d0), periodStart: startD, periodEnd: endD || startD, lang: "en", data: common };
  }, [selected.map((x: any) => `${x.l._key}:${x.qty}`).join(","), uMode, eMode, uIdx, eIdx, uN, eN, uUnit, eUnit, uFee, eFee, startD, endD]);

  const [lang, setLang]     = useState<string>(() => (currentContractOf(p)?.lang === "de" ? "de" : "en"));   // the contract's language
  const [askClose, setAskClose] = useState(false);
  const [winW, setWinW]     = useState(() => window.innerWidth);
  const [view, setView]     = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isM = winW < 768;
  const scale = isM ? Math.min(1, (winW - 32) / 595) : 1;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true); setErr(null);
    const optLabelText = [
      uMode !== "none" ? (uMode === "predefined" ? optName(uOpt?.l) : `Usage ${uN} ${uUnit} (${optName(uOpt?.l)})`) : "",
      eMode !== "none" ? (eMode === "predefined" ? optName(eOpt?.l) : `Exclusivity ${eN} ${eUnit} (${optName(eOpt?.l)})`) : "",
    ].filter(Boolean).join(" + ") || "Renewal";
    const usageEnd = uMode !== "none" && uFee > 0 ? uEnd : null;
    const exclEnd  = eMode !== "none" && eFee > 0 ? eEnd : null;
    const record = isAmendMode
      ? { aNo: "", lines: doc.data.lines, amendTotal: totalFee, origTotal: p.amount || 0, signed: false, doc: { kind: "extension", usageEnd, exclEnd } }
      : { optLabel: optLabelText, startDate: startD, endDate: endD, usageEnd, exclEnd, fee: totalFee, rNo: "", signed: true, paid: false, doc: {} };
    try { await onSave(record, { ...doc, lang: lang as any }); }
    catch (e: any) { setErr(e?.message || "Save failed"); setSaving(false); }
  };

  // plain render helpers (not components) so inputs keep focus while typing
  // ── the Calculator's look: section heads, list cards, steppers, one-tap chips ──
  const CAPS: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted };
  const CARD: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, overflow: "hidden" };
  const ROWS: any = { display: "flex", alignItems: "center", gap: 10, padding: "0 12px", borderTop: `1px solid ${C.line}` };
  const section = (title: string, right: any, children: any) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "14px 2px 7px" }}>
        <span style={CAPS}>{title}</span>{right != null && <span style={CAPS}>{right}</span>}
      </div>
      {children}
    </div>
  );
  const chip = (label: string, on: boolean, run: () => void, attrs: any = {}) => (
    <button key={label} onClick={run} aria-pressed={on} {...attrs}
      style={{ height: 30, padding: "0 12px", borderRadius: RADIUS.pill, fontFamily: SANS, fontSize: TYPE.subtext.size, whiteSpace: "nowrap" as const, cursor: "pointer",
        border: `1px solid ${on ? C.black : C.rule}`, background: on ? C.black : C.white, color: on ? C.white : C.black }}>{label}</button>
  );
  const optText = (o: any) => `${optName(o.l)} · ${Number(o.pct) > 0 ? `+${pctText(o.pct)}` : "included"}`;
  // one row of chips: None · the rate card's options · Custom
  const optionChips = (kind: string, mode: Mode, setMode: (m: Mode) => void, opts: any[], idx: number, setIdx: (i: number) => void, setFeeIn: (v: string | null) => void) => (
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
      {chip("None", mode === "none", () => setMode("none"), { "data-opt": kind })}
      {opts.map((o: any, i: number) => chip(optText(o), mode === "predefined" && idx === i, () => { setMode("predefined"); setIdx(i); setFeeIn(null); }, { "data-opt": kind }))}
      {chip("Custom", mode === "custom", () => setMode("custom"), { "data-opt": kind })}
    </div>
  );
  const customBlock = ({ opt, opts, idx, setIdx, n, setN, unit, setUnit, calc, feeIn, setFeeIn }: any) => (
    <div style={{ ...CARD, marginTop: 8 }}>
      <div style={{ ...ROWS, borderTop: "none", minHeight: 44 }}>
        <span style={{ width: 84, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted }}>Like</span>
        <MiniSelect value={idx} onChange={(e: any) => { setIdx(parseInt(e.target.value)); setFeeIn(null); }} aria-label="Reference option" s={{ flex: 1 }}>
          {opts.map((o: any, i: number) => <option key={i} value={i}>{optText(o)}</option>)}
        </MiniSelect>
      </div>
      <div style={{ ...ROWS, minHeight: 44 }}>
        <span style={{ width: 84, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted }}>Duration</span>
        <MiniInput type="number" min={1} inputMode="numeric" placeholder="2" value={n} aria-label="Duration" onChange={(e: any) => { setN(e.target.value); setFeeIn(null); }} s={{ flex: 1 }} />
        <MiniSelect value={unit} onChange={(e: any) => { setUnit(e.target.value); setFeeIn(null); }} aria-label="Unit" s={{ flex: 1 }}>
          <option value="months">Months</option><option value="days">Days</option>
        </MiniSelect>
      </div>
      <div style={{ ...ROWS, minHeight: 44 }}>
        <span style={{ width: 84, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted }}>Fee</span>
        <span style={{ flex: 1 }}><NumField mini value={feeIn !== null ? (parseFloat(feeIn) || 0) : calc} onChange={(v) => setFeeIn(String(v === null ? 0 : Math.max(0, v)))} ariaLabel="Fee" /></span>
      </div>
      {(parseInt(n) || 0) > 0 && base > 0 && (
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0, padding: "0 12px 10px" }}>
          Pro rata: {n} {unit} of {Number(opt?.mo) || 1} {Number(opt?.mo) === 1 ? "month" : "months"} → {fmt(calc)}
        </p>
      )}
    </div>
  );
  const durOf = (m: Mode, opt: any, n: string, unit: string) => {
    if (m === "predefined") { const mo = Number(opt?.mo) || 0; return mo ? `${mo} ${mo === 1 ? "month" : "months"}` : ""; }
    if (m === "custom") { const v = parseInt(n) || 0; return v ? `${v} ${unit === "months" ? (v === 1 ? "month" : "months") : (v === 1 ? "day" : "days")}` : ""; }
    return "";
  };
  const endDur = uEnd && (!eEnd || uEnd >= eEnd) ? durOf(uMode, uOpt, uN, uUnit) : durOf(eMode, eOpt, eN, eUnit);

  const panel = (
    <>
      {isAmendMode && (
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "2px 2px 0", lineHeight: 1.5 }}>
          Extend usage rights or exclusivity on items already delivered — the items are not charged again.{" "}
          {onCalc && <button onClick={onCalc} style={{ background: "none", border: "none", cursor: "pointer", color: C.black, fontSize: TYPE.subtext.size, padding: 0, textDecoration: "underline", fontFamily: SANS }}>Adding new deliverables? Open Calculator</button>}
        </p>
      )}

      {section("Which deliverables", `${selected.length} of ${allLines.length}`, (
        <div style={CARD}>
          {allLines.map((l: any, i: number) => {
            // a retainer delivers its quantity every month: the maximum covers all its months
            const max = Math.max(1, parseInt(l.qty) || 1) * (p?.qd?.retainer ? Math.max(1, retainerMonths(p).length) : 1);
            const qty = selQty[l._key] || 0;
            const stepBtn = (label: string, to: number, ok: boolean) => (
              <button onClick={() => setQty(l._key, max, to)} aria-label={`${label === "+" ? "More" : "Fewer"}: ${l.name}`}
                style={{ width: 30, height: 28, border: "none", background: "none", cursor: ok ? "pointer" : "default", fontSize: TYPE.body.size, color: ok ? C.black : C.faint, fontFamily: SANS, padding: 0 }}>{label}</button>
            );
            return (
              <div key={l._key} style={{ ...ROWS, borderTop: i ? `1px solid ${C.line}` : "none", minHeight: 54 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: TYPE.row.size, color: qty ? C.black : C.muted, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                  <div style={{ fontSize: TYPE.subtext.size, color: qty ? C.muted : C.light }}>{l._src !== "quote" ? `${l._src} · ` : ""}base {fmt(l._unitBase)}{max > 1 ? ` · max ${max}` : ""}</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", height: 30, border: `1px solid ${C.rule}`, borderRadius: RADIUS.pill, background: C.white, flexShrink: 0 }}>
                  {stepBtn("−", qty - 1, qty > 0)}
                  <span style={{ minWidth: 18, textAlign: "center" as const, fontFamily: SERIF, fontSize: TYPE.figure.size, color: qty ? C.black : C.light }}>{qty}</span>
                  {stepBtn("+", qty + 1, qty < max)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {section("Usage rights", uMode !== "none" && uFee > 0 ? fmt(uFee) : "from the rate card", <>
        {optionChips("usage", uMode, setUMode, uOpts, uIdx, setUIdx, setUFeeIn)}
        {uMode === "custom" && customBlock({ opt: uOpt, opts: uOpts, idx: uIdx, setIdx: setUIdx, n: uN, setN: setUN, unit: uUnit, setUnit: setUUnit, calc: uCalc, feeIn: uFeeIn, setFeeIn: setUFeeIn })}
      </>)}

      {section("Exclusivity", eMode !== "none" && eFee > 0 ? fmt(eFee) : null, <>
        {optionChips("excl", eMode, setEMode, eOpts, eIdx, setEIdx, setEFeeIn)}
        {eMode === "custom" && customBlock({ opt: eOpt, opts: eOpts, idx: eIdx, setIdx: setEIdx, n: eN, setN: setEN, unit: eUnit, setUnit: setEUnit, calc: eCalc, feeIn: eFeeIn, setFeeIn: setEFeeIn })}
      </>)}

      {section("Dates", null, (
        <div style={CARD}>
          <div style={{ ...ROWS, borderTop: "none", minHeight: 44 }}>
            <span style={{ flex: 1, fontSize: TYPE.row.size }}>Start</span>
            <MiniInput type="date" value={startD} onChange={(e: any) => setStartD(e.target.value)} aria-label="Start date" s={{ width: 150 }} />
          </div>
          <div style={{ ...ROWS, minHeight: 44 }}>
            <span style={{ flex: 1, fontSize: TYPE.row.size }}>End</span>
            <span style={{ fontSize: TYPE.row.size, color: C.muted }}>{endD ? `${fmtD(endD)}${endDur ? ` · ${endDur}` : ""}` : "—"}</span>
          </div>
        </div>
      ))}
    </>
  );

  // ✕ asks first once something is chosen
  const tryClose = () => { if (totalFee > 0 || Object.values(selQty || {}).some((n: any) => Number(n) > 0)) setAskClose(true); else onClose(); };

  const footer = (
    <>
      {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>{isAmendMode ? "Amendment total" : "Renewal total"}</div>
          <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size }}>{fmt(totalFee)}</div>
        </div>
        <PillBtn dark onClick={save} dim={!canSave || saving} s={{ height: 40, padding: "0 22px", justifyContent: "center" }}>{saving ? "Saving…" : isAmendMode ? "Save amendment" : "Save renewal"}</PillBtn>
      </div>
    </>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: Z.modal, display: "flex", flexDirection: "column", fontFamily: SANS }}>
      <div style={{ borderBottom: `1px solid ${C.rule}`, flexShrink: 0 }}>
        <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 8px 0 2px", gap: 6 }}>
          <button onClick={tryClose} aria-label="Close" style={{ width: 44, height: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: ICON.close }}>✕</button>
          <span style={{ flex: 1, minWidth: 0, textAlign: "center" as const, fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{isAmendMode ? `Rights extension · ${p.name}` : `Renewal · ${p.name}`}</span>
          <LangSwitch lang={lang} onChange={setLang as any} />
        </div>
        {isM && (
          <div style={{ display: "flex", gap: 6, padding: "0 10px 8px" }}>
            <Pill size="sm" on={view === "edit"} onClick={() => setView("edit")}>Edit</Pill>
            <Pill size="sm" on={view === "preview"} onClick={() => setView("preview")}>Preview</Pill>
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {(!isM || view === "edit") && (
          <div style={{ width: isM ? "100%" : 400, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isM ? "none" : `1px solid ${C.rule}` }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 16px", background: C.bg }}>{panel}</div>
            {!isM && <div style={{ padding: "11px 14px 14px", borderTop: `1px solid ${C.line}`, flexShrink: 0, background: C.white }}>{footer}</div>}
          </div>
        )}
        {(!isM || view === "preview") && (
          <div style={{ flex: 1, background: C.muted, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isM ? "20px 12px" : "32px 28px", gap: isM ? 16 : 28 }}>
            <DocPages doc={{ ...doc, lang: lang as any }} settings={settings} client={client} lang={lang} scale={scale} />
          </div>
        )}
      </div>
      {/* phone: the total and Save stay at the bottom in Edit and in Preview */}
      {isM && <div style={{ padding: "11px 14px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.line}`, flexShrink: 0, background: C.white }}>{footer}</div>}
      {askClose && <ConfirmDialog title={isAmendMode ? "Discard this amendment?" : "Discard this renewal?"} text="What you chose here isn't saved." okLabel="Discard" danger
        onOk={() => { setAskClose(false); onClose(); }} onCancel={() => setAskClose(false)} />}
    </div>,
    document.body
  );
}
