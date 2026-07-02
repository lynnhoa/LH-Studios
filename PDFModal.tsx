// ─────────────────────────────────────────────────────────────
// PDFModal — full-screen PDF preview + edit panel
// Edit panel: brand, contact, date, line items, clauses, footer
// Controls: undo/redo, EN/DE toggle, Save PDF, close
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE } from "./constants";
import { I, B, Lbl, Pill } from "./atoms";
import { SETTINGS_DEFAULT } from "./rateCards";
import A4Document from "./A4Document";
import { exportPDF } from "./PDFExport";

const PAGE_H  = 841;
const CHROME_H = 210;

interface PDFModalProps {
  data:         any;
  type:         string;
  onClose:      () => void;
  onSave?:      (doc: any) => void;
  onSaveClose?: (doc: any) => void;
  settings:     any;
  isNew?:       boolean;
}

export default function PDFModal({
  data, type, onClose, onSave, onSaveClose, settings, isNew,
}: PDFModalProps) {
  const init = () => JSON.parse(JSON.stringify(data));

  // ── Undo/redo history ────────────────────────────────────
  const [hs,         setHs]         = useState({ hist: [init()], idx: 0 });
  const [preview,    setPreview]     = useState<any>(init());
  const [lang,       setLang]        = useState("en");
  const [panelW,     setPanelW]      = useState(380);
  const [flash,      setFlash]       = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [savedClean, setSavedClean]  = useState(false);
  const [downloading, setDownloading]= useState(false);
  const [showEdit,   setShowEdit]    = useState(false);
  const [winW,       setWinW]        = useState(() => window.innerWidth);

  // ── Page layout guards ────────────────────────────────────
  const [docHeight,       setDocHeight]       = useState(841);
  const [extraSigMargin,  setExtraSigMargin]  = useState(0);
  const [clauseGuards,    setClauseGuards]    = useState<number[]>(Array(6).fill(0));
  const [tRowGuards,      setTRowGuards]      = useState<number[]>([]);

  const docRef = useRef<HTMLDivElement>(null);
  const staged = hs.hist[hs.idx];
  const s      = { ...SETTINGS_DEFAULT, ...(settings || {}) };
  const isDE   = lang === "de";
  const isMobile = winW < 768;
  const numPages = docHeight > PAGE_H + CHROME_H ? Math.ceil(docHeight / PAGE_H) : 1;
  const pageScale = isMobile ? Math.min(1, (winW - 32) / 595) : 1;

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Pagination + page-break guards ───────────────────────
  useEffect(() => {
    setClauseGuards(Array(6).fill(0));
    setTRowGuards([]);
    const el = docRef.current;
    if (!el) return;

    const calc = () => {
      setDocHeight(el.scrollHeight);

      // Signature guard
      const sigEl = el.querySelector("[data-sig-anchor]") as HTMLElement | null;
      if (sigEl) {
        const sigTop   = sigEl.offsetTop;
        const GUARD    = 200;
        const HEADER_H = 49;
        const pageNum  = Math.floor(sigTop / PAGE_H);
        const posInPage = sigTop - pageNum * PAGE_H;
        if (posInPage > PAGE_H - GUARD) {
          const needed = (PAGE_H - posInPage) + HEADER_H + 6;
          setExtraSigMargin(prev => Math.abs(needed - prev) > 2 ? needed : prev);
        } else if (pageNum > 0 && posInPage > 0 && posInPage < HEADER_H + 4) {
          const push = (HEADER_H + 6) - posInPage;
          setExtraSigMargin(prev => Math.abs(push) > 2 ? prev + push : prev);
        } else if (pageNum === 0 || posInPage > HEADER_H + 80) {
          setExtraSigMargin(prev => prev > 0 ? 0 : prev);
        }
      } else {
        setExtraSigMargin(0);
      }

      // Clause guards (contract only)
      if (type === "contract") {
        const newGuards = Array(6).fill(0);
        const clauseEls = Array.from(el.querySelectorAll("[data-clause]")) as HTMLElement[];
        const guardedPages = new Set<number>();
        clauseEls.forEach((cEl, idx) => {
          const bottom = cEl.offsetTop + cEl.offsetHeight;
          const pageNum = Math.floor(cEl.offsetTop / PAGE_H);
          const bottomInPage = bottom - pageNum * PAGE_H;
          if (bottomInPage > PAGE_H - 100 && !guardedPages.has(pageNum)) {
            newGuards[idx] = Math.max(0, PAGE_H + 72 - cEl.offsetTop - 10);
            guardedPages.add(pageNum);
          }
        });
        setClauseGuards(prev => {
          const next = newGuards.map((v, i) => Math.max(v, prev[i]));
          return next.some((v, i) => v !== prev[i]) ? next : prev;
        });
      }

      // Table row guards
      if (type !== "contract") {
        const rowEls = Array.from(el.querySelectorAll("[data-trow]")) as HTMLElement[];
        if (rowEls.length > 0) {
          const newGuards = Array(rowEls.length).fill(0);
          const guardedPages = new Set<number>();
          rowEls.forEach(rowEl => {
            const idx = parseInt(rowEl.getAttribute("data-trow") || "0", 10);
            const bottom = rowEl.offsetTop + rowEl.offsetHeight;
            const pageNum = Math.floor(rowEl.offsetTop / PAGE_H);
            const bottomInPage = bottom - pageNum * PAGE_H;
            if (bottomInPage > PAGE_H - 80 && !guardedPages.has(pageNum)) {
              newGuards[idx] = Math.max(0, PAGE_H + 72 - rowEl.offsetTop);
              guardedPages.add(pageNum);
            }
          });
          setTRowGuards(prev => {
            if (newGuards.length !== prev.length) return newGuards;
            const next = newGuards.map((v, i) => Math.max(v, prev[i]));
            return next.some((v, i) => v !== prev[i]) ? next : prev;
          });
        }
      }
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview, lang]);

  // ── Staged state setter (adds to history) ─────────────────
  const setStaged = (fn: any) => {
    setSavedClean(false);
    setHs(prev => {
      const curr = prev.hist[prev.idx];
      const newD = typeof fn === "function" ? fn(curr) : fn;
      const next = [...prev.hist.slice(0, prev.idx + 1), JSON.parse(JSON.stringify(newD))];
      setPreview(JSON.parse(JSON.stringify(newD)));
      return { hist: next, idx: next.length - 1 };
    });
  };

  const canUndo = hs.idx > 0;
  const canRedo = hs.idx < hs.hist.length - 1;

  const undo = () => {
    const ni = Math.max(0, hs.idx - 1);
    if (ni === hs.idx) return;
    setHs(p => ({ ...p, idx: ni }));
    setPreview(JSON.parse(JSON.stringify(hs.hist[ni])));
    setSavedClean(false);
  };

  const redo = () => {
    const ni = Math.min(hs.hist.length - 1, hs.idx + 1);
    if (ni === hs.idx) return;
    setHs(p => ({ ...p, idx: ni }));
    setPreview(JSON.parse(JSON.stringify(hs.hist[ni])));
    setSavedClean(false);
  };

  const handleSave = () => {
    const snap = JSON.parse(JSON.stringify(staged));
    setPreview(snap);
    if (onSave) onSave(snap);
    setSavedClean(true);
    setFlash("saved");
    setTimeout(() => setFlash(null), 2500);
  };

  const updStagedLine = (i: number, k: string, v: string) =>
    setStaged((prev: any) => {
      const lines = [...(prev.lines || [])];
      lines[i] = {
        ...lines[i], [k]: v,
        amt: k === "qty" ? (parseFloat(lines[i].up) || 0) * (parseInt(v) || 1)
           : k === "up"  ? (parseFloat(v) || 0) * (parseInt(lines[i].qty) || 1)
           : parseFloat(v) || lines[i].amt,
      };
      return { ...prev, lines };
    });

  // ── Drag resizer ──────────────────────────────────────────
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = panelW;
    const onMove = (ev: MouseEvent) => setPanelW(Math.max(240, Math.min(700, startW + ev.clientX - startX)));
    const onUp   = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Download ──────────────────────────────────────────────
  const download = () => exportPDF({
    preview, type,
    onStart: () => setDownloading(true),
    onDone:  () => setDownloading(false),
  });

  // ── Default contract clauses (computed from staged) ───────
  const _dc    = s.company || s.name || (isDE ? "Der/Die Auftragnehmer/in" : "The creator");
  const _total = `€ ${Number((staged.lines || []).reduce((a: number, ln: any) => a + (parseFloat(ln.amt) || 0), 0)).toLocaleString("de-DE")}`;
  const _dd    = (staged.lines || []).length > 0 ? (staged.lines || []).map((ln: any) => `${ln.qty ? ln.qty + "× " : ""}${ln.name}`).join(", ") : null;

  const defClauses = type === "contract" ? [
    { title: isDE?"§ 1 — Vertragsgegenstand":"§ 1 — Subject Matter", text: isDE?`${_dc} verpflichtet sich, folgende Leistungen gegen ein vereinbartes Honorar von ${_total} zu erbringen: ${_dd||"den vereinbarten Content gemäß Angebot"}. Umfang, Format und Zeitplan werden vor Produktionsbeginn schriftlich von beiden Parteien bestätigt. Das kreative Konzept bedarf der schriftlichen Freigabe beider Parteien vor Beginn der Produktion.`:`${_dc} agrees to produce and deliver the following for a total agreed fee of ${_total}: ${_dd||"the content as per the agreed quote"}. The deliverable scope, format, and timeline shall be confirmed in writing by both parties prior to production. The creative concept is subject to mutual written approval before work begins.` },
    { title: isDE?"§ 2 — Lieferung":"§ 2 — Delivery", text: isDE?"Die Lieferung erfolgt innerhalb des schriftlich vereinbarten Zeitrahmens. Stellt der Auftraggeber erforderliche Materialien, Freigaben, Produkte oder Zugänge nicht innerhalb von 5 Werktagen nach vereinbartem Termin zur Verfügung, verlängert sich die Lieferfrist entsprechend.":"Delivery follows the project timeline confirmed at commencement. If the client delays providing required materials, approvals, products, or access by more than 5 business days beyond any agreed handover date, the delivery deadline extends by the same period." },
    { title: isDE?"§ 3 — Korrekturen":"§ 3 — Revisions", text: isDE?"Eine (1) Korrektur je Leistung ist im Honorar enthalten. Korrekturwünsche sind innerhalb von 5 Werktagen nach Ablieferung schriftlich einzureichen; später eingereichte Anfragen können als neue Aufträge gewertet werden.":"One revision per deliverable is included in the agreed fee. Revision requests must be submitted in writing within 5 business days of each delivery; requests received after this period may be treated as new work." },
    { title: isDE?"§ 4 — Nutzungsrechte":"§ 4 — Usage Rights", text: isDE?`${_dc} räumt dem Auftraggeber ein zeitlich begrenztes, nicht-exklusives, nicht übertragbares Nutzungsrecht an den vereinbarten Inhalten für die festgelegten Plattformen, den vereinbarten Zweck, Zeitraum und Geltungsbereich ein. Urheberrecht und Persönlichkeitsrechte verbleiben ausschließlich bei ${_dc}.`:`${_dc} grants the client a time-limited, non-exclusive, non-transferable licence to use the delivered content for the agreed platforms, purpose, duration, and territory only. All copyright, moral rights, and ownership vest exclusively in ${_dc}.` },
    { title: isDE?"§ 5 — Zahlung":"§ 5 — Payment", text: isDE?`Das Honorar in Höhe von ${_total} ist innerhalb von 14 Tagen nach Rechnungsdatum fällig. Bei Zahlungsverzug ist ${_dc} berechtigt, Verzugszinsen gemäß § 288 BGB ab dem ersten Verzugstag geltend zu machen. ${s.taxNote||"Gemäß § 19 UStG wird keine Umsatzsteuer erhoben."}`:`The total fee of ${_total} is due within 14 days of the invoice date. In the event of late payment, statutory default interest pursuant to § 288 BGB is charged from the first day of delay. ${s.taxNote||"No VAT is charged pursuant to § 19 UStG."}` },
    { title: isDE?"§ 6 — Stornierung":"§ 6 — Cancellation", text: isDE?`Stornierungen bedürfen der Schriftform. Bei Stornierung vor Produktionsbeginn sind 25 % des vereinbarten Honorars fällig. Bei Stornierung nach Produktionsbeginn sind 50 % fällig. Ist die Leistung im Wesentlichen erbracht, ist das vollständige Honorar zu entrichten.`:`Cancellation must be submitted in writing. If the client cancels before production begins, 25% of the agreed fee is due. If the client cancels after production has begun, 50% of the agreed fee is due. If the deliverable is substantially complete, the full fee is payable.` },
  ] : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 500, display: "flex", flexDirection: "column", fontFamily: SANS }}>

      {/* ── TOP BAR ── */}
      <div style={{ height: 46, borderBottom: `1px solid ${C.rule}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 6, flexShrink: 0 }}>
        {/* Undo / Redo */}
        <button onClick={undo} disabled={!canUndo} title="Undo"
          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${canUndo ? C.rule : "transparent"}`, borderRadius: 2, cursor: canUndo ? "pointer" : "default", color: canUndo ? C.black : C.light, fontSize: 15 }}>←</button>
        <button onClick={redo} disabled={!canRedo} title="Redo"
          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${canRedo ? C.rule : "transparent"}`, borderRadius: 2, cursor: canRedo ? "pointer" : "default", color: canRedo ? C.black : C.light, fontSize: 15 }}>→</button>

        <div style={{ width: 1, height: 20, background: C.rule, margin: "0 4px" }} />

        {/* Language */}
        <Pill on={lang === "en"} onClick={() => setLang("en")}>EN</Pill>
        <Pill on={lang === "de"} onClick={() => setLang("de")}>DE</Pill>

        <div style={{ flex: 1 }} />

        {/* Mobile edit toggle */}
        {isMobile && (
          <button onClick={() => setShowEdit(e => !e)}
            style={{ padding: "5px 12px", background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.black, marginRight: 4 }}>
            {showEdit ? "View PDF" : "Edit"}
          </button>
        )}

        {/* Save PDF */}
        <B onClick={download} s={{ opacity: downloading ? 0.5 : 1, cursor: downloading ? "default" : "pointer" as const }}>
          {downloading ? "Saving…" : "Save PDF"}
        </B>

        {/* Close */}
        <button
          onClick={() => {
            if (!onSave) { onClose(); return; }   // read-only doc — nothing to save
            if (isNew) { setConfirmClose(true); return; }
            if (savedClean) { onClose(); return; }
            const isDirty = JSON.stringify(staged) !== JSON.stringify(data);
            isDirty ? setConfirmClose(true) : onClose();
          }}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, marginLeft: 4 }}
        >✕</button>
      </div>

      {/* ── CONFIRM CLOSE DIALOG ── */}
      {confirmClose && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,249,247,0.88)" }}>
          <div style={{ background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "24px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", textAlign: "center" as const, minWidth: 220 }}>
            <p style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, fontWeight: "normal", color: C.black, margin: "0 0 6px" }}>
              {isNew ? "Save this document?" : "Save before closing?"}
            </p>
            <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "0 0 18px" }}>
              {isNew ? "It will be added to the client's project." : "Changes will be lost if you don't save."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <B onClick={() => { handleSave(); setConfirmClose(false); if (onSaveClose) onSaveClose(staged); else onClose(); }}>Yes, save</B>
              <B v="sec" onClick={() => { setConfirmClose(false); onClose(); }}>No, discard</B>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── BODY: EDIT PANEL + PDF PREVIEW ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>

        {/* ── EDIT PANEL ── */}
        {(!isMobile || showEdit) && (
          <div style={{ width: isMobile ? "100%" : panelW, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : `1px solid ${C.rule}`, borderBottom: isMobile ? `1px solid ${C.rule}` : "none", maxHeight: isMobile ? "50%" : undefined }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

              <Lbl>Brand</Lbl>
              <I value={staged.brand || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, brand: e.target.value }))} s={{ marginBottom: 6 }} />

              <Lbl>Contact</Lbl>
              <I value={staged.contact || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, contact: e.target.value }))} s={{ marginBottom: 6 }} />

              <Lbl>Date</Lbl>
              <I type="date" value={staged.date || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, date: e.target.value }))} s={{ marginBottom: 6 }} />

              {["quote","revised"].includes(type) && <>
                <Lbl>Valid Until</Lbl>
                <I type="date" value={staged.validUntil || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, validUntil: e.target.value }))} s={{ marginBottom: 6 }} />
              </>}

              {["invoice","renewal"].includes(type) && <>
                <Lbl>Invoice No.</Lbl>
                <I value={staged.iNo || staged.rNo || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, iNo: e.target.value, rNo: e.target.value }))} s={{ marginBottom: 6 }} />
                <Lbl>Delivery Date</Lbl>
                <I type="date" value={staged.delivery || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, delivery: e.target.value }))} s={{ marginBottom: 6 }} />
              </>}

              {type === "contract" && <>
                <Lbl>Quote Table</Lbl>
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  {(["table","ref","none"] as const).map(v => (
                    <Pill key={v} on={(staged.quoteRef || "none") === v} onClick={() => setStaged((p: any) => ({ ...p, quoteRef: v }))}>
                      {{ table: "Full table", ref: "Quote ref.", none: "No table" }[v]}
                    </Pill>
                  ))}
                </div>
              </>}

              {/* Line items */}
              {(type !== "contract" || (staged.quoteRef || "none") === "table") && <>
                <Lbl>Line Items</Lbl>
                {(staged.lines || []).map((ln: any, i: number) => (
                  <div key={i} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: 10, marginBottom: 7 }}>
                    <I value={ln.name || ""} onChange={(e: any) => updStagedLine(i, "name", e.target.value)} s={{ marginBottom: 5 }} />
                    <I value={ln.note || ""} onChange={(e: any) => updStagedLine(i, "note", e.target.value)} s={{ marginBottom: 5, color: C.muted, fontSize: TYPE.micro.size }} placeholder="note (optional)" />
                    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 76px", gap: 5 }}>
                      <I type="number" value={ln.qty || ""} onChange={(e: any) => updStagedLine(i, "qty", e.target.value)} placeholder="qty" s={{ fontSize: TYPE.micro.size }} />
                      <I type="number" value={ln.up || ""}  onChange={(e: any) => updStagedLine(i, "up",  e.target.value)} placeholder="unit €" s={{ fontSize: TYPE.micro.size }} />
                      <I type="number" value={ln.amt || ""} onChange={(e: any) => updStagedLine(i, "amt", e.target.value)} placeholder="total €" s={{ fontSize: TYPE.micro.size }} />
                    </div>
                  </div>
                ))}
              </>}

              {/* Contract clauses */}
              {type === "contract" && (
                <div style={{ marginTop: 6 }}>
                  <Lbl>Contract Clauses</Lbl>
                  {(staged.clauses && staged.clauses.length > 0 ? staged.clauses : defClauses).map((cl: any, ci: number) => {
                    const clauses = staged.clauses && staged.clauses.length > 0 ? staged.clauses : defClauses;
                    const updClause = (field: string, val: string) =>
                      setStaged((p: any) => { const arr = p.clauses && p.clauses.length > 0 ? [...p.clauses] : [...defClauses]; arr[ci] = { ...arr[ci], [field]: val }; return { ...p, clauses: arr }; });
                    const moveClause = (dir: number) =>
                      setStaged((p: any) => { const arr = p.clauses && p.clauses.length > 0 ? [...p.clauses] : [...defClauses]; const ni = ci + dir; if (ni < 0 || ni >= arr.length) return p; [arr[ci], arr[ni]] = [arr[ni], arr[ci]]; return { ...p, clauses: arr }; });
                    const delClause = () =>
                      setStaged((p: any) => { const arr = p.clauses && p.clauses.length > 0 ? [...p.clauses] : [...defClauses]; arr.splice(ci, 1); return { ...p, clauses: arr }; });

                    return (
                      <div key={ci} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "9px 10px", marginBottom: 7, background: C.white }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em" }}>§{ci + 1}</span>
                          <div style={{ display: "flex", gap: 3 }}>
                            <button onClick={() => moveClause(-1)} disabled={ci === 0} style={{ background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: ci === 0 ? "default" : "pointer", color: ci === 0 ? C.light : C.muted, fontSize: TYPE.label.size, padding: "1px 6px" }}>↑</button>
                            <button onClick={() => moveClause(1)} disabled={ci === clauses.length - 1} style={{ background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: ci === clauses.length - 1 ? "default" : "pointer", color: ci === clauses.length - 1 ? C.light : C.muted, fontSize: TYPE.label.size, padding: "1px 6px" }}>↓</button>
                            <button onClick={delClause} style={{ background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: "pointer", color: C.red, fontSize: TYPE.label.size, padding: "1px 6px" }}>✕</button>
                          </div>
                        </div>
                        <I value={cl.title || ""} onChange={(e: any) => updClause("title", e.target.value)} s={{ marginBottom: 5, fontFamily: SERIF, fontSize: TYPE.micro.size }} placeholder="Clause title" />
                        <textarea value={cl.text || ""} onChange={(e: any) => updClause("text", e.target.value)}
                          style={{ width: "100%", padding: "7px 9px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 72 }}
                          placeholder="Clause text"
                        />
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setStaged((p: any) => { const arr = p.clauses && p.clauses.length > 0 ? [...p.clauses] : [...defClauses]; arr.push({ title: `§${arr.length + 1} — New Clause`, text: "" }); return { ...p, clauses: arr }; })}
                    style={{ fontSize: TYPE.micro.size, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 10px", fontFamily: SANS, letterSpacing: "0.04em", textDecoration: "underline", textDecorationColor: C.rule }}
                  >+ Add clause</button>
                </div>
              )}

              <Lbl>Closing Note</Lbl>
              <textarea
                value={staged.footer || ""}
                onChange={(e: any) => setStaged((p: any) => ({ ...p, footer: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 72 }}
              />
            </div>

            {/* Save button — only when a persist handler exists (read-only docs
                like amendments/renewals opened from project cards have none) */}
            {onSave && (
              <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>
                {flash === "saved" && <p style={{ fontSize: TYPE.micro.size, color: C.green, margin: "0 0 7px", letterSpacing: "0.06em" }}>Saved ✓</p>}
                <B onClick={handleSave} s={{ width: "100%", textAlign: "center" as const }}>Save</B>
              </div>
            )}
          </div>
        )}

        {/* ── DRAG RESIZER ── */}
        {!isMobile && (
          <div
            onMouseDown={startDrag}
            style={{ width: 6, flexShrink: 0, cursor: "col-resize", background: C.rule, opacity: 0.5, transition: "opacity 0.15s" }}
            onMouseEnter={(e: any) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.opacity = "0.5"; }}
          />
        )}

        {/* ── PDF PREVIEW ── */}
        {(!isMobile || !showEdit) && (
          <div style={{ flex: 1, background: "#888", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? "16px 0" : "32px 28px", gap: isMobile ? 16 : 28 }}>
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} style={{ width: 595 * pageScale, height: PAGE_H * pageScale, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.28)" }}>
                <div
                  data-pdf-page="true"
                  style={{ width: 595, height: PAGE_H, overflow: "hidden", background: C.bg, position: "relative", transform: pageScale < 1 ? `scale(${pageScale})` : "none", transformOrigin: "top left" }}
                >
                  {/* A4 content — offset by page index */}
                  <div ref={i === 0 ? docRef : undefined} style={{ position: "absolute", top: -i * PAGE_H, left: 0, width: 595 }}>
                    <A4Document
                      d={preview} type={type} lang={lang} settings={settings}
                      extraSigMargin={extraSigMargin}
                      clauseGuards={clauseGuards}
                      tRowGuards={tRowGuards}
                    />
                  </div>

                  {/* Footer mask (hides overflow below last line) */}
                  <div style={{ position: "absolute", bottom: type === "invoice" ? 64 : 59, left: 0, right: 0, height: 28, background: C.bg, zIndex: 2, pointerEvents: "none" }} />

                  {/* Header overlay */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: C.bg, zIndex: 3, borderBottom: `1px solid ${C.rule}` }}>
                    <div style={{ padding: "13px 62px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 6, letterSpacing: "0.2em", color: C.light, textTransform: "uppercase" as const }}>{s.company || s.name || "Lynn Hoa"}</span>
                      <span style={{ fontSize: 6, letterSpacing: "0.2em", color: C.light, textTransform: "uppercase" as const }}>{preview.ctype || "Content Creator"}</span>
                    </div>
                  </div>

                  {/* Footer overlay */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, zIndex: 3, borderTop: `1px solid ${C.rule}` }}>
                    {type === "invoice" ? (
                      <div style={{ padding: "12px 62px 18px", display: "flex", alignItems: "flex-start", gap: 0 }}>
                        <div style={{ fontSize: 7, color: C.muted, lineHeight: 1.5, flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
                          <div style={{ fontWeight: 500, color: C.black }}>{s.company || s.name || "Your Company"}</div>
                          {s.email   && <div>{s.email}</div>}
                          {s.website && <div>{s.website}</div>}
                          {s.steuernummer && <div style={{ marginTop: 4 }}>{isDE ? "St.-Nr." : "Tax No."} {s.steuernummer}</div>}
                        </div>
                        <div style={{ fontSize: 7, color: C.muted, lineHeight: 1.5, flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
                          <div style={{ fontWeight: 500, color: C.black }}>{isDE ? "Zahlungsdetails" : "Payment Details"}</div>
                          {s.bankName && <div>{s.bankName}</div>}
                          {s.iban     && <div>IBAN {s.iban}</div>}
                          {s.bic      && <div>BIC {s.bic}</div>}
                        </div>
                        <div style={{ fontSize: 7, color: C.muted, lineHeight: 1.5, flex: "1 1 0", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", alignSelf: "stretch" }}>
                          <div>
                            {s.paypalEmail && <><div style={{ fontWeight: 500, color: C.black }}>PayPal</div><div>{s.paypalEmail}</div></>}
                          </div>
                          {numPages > 1 && <div style={{ fontSize: 7, color: C.light, letterSpacing: "0.04em", textAlign: "right" as const }}>{i + 1}</div>}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "26px 62px 22px", fontSize: 7, color: C.muted, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{[s.email, s.website].filter(Boolean).join(" · ") || "your@email.com · yourwebsite.com"}</span>
                        {numPages > 1 && <span style={{ letterSpacing: "0.04em", color: C.light }}>{i + 1}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
