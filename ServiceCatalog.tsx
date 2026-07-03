// ─────────────────────────────────────────────────────────────
// ServiceCatalog — single source of truth for pricing
// Base tabs (Brand Collaboration / UGC / Editorial) + custom cards
// Edit mode: inline item name, note, price, modifier, delete —
// every change auto-saved to Supabase.
// "Rate Card PDF" opens the A4 preview (EN/DE, Save PDF) for the
// current tab. "+ Add Card" builds a custom card from catalog items.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE } from "./constants";
import { uid } from "./formatters";
import { I, B, Lbl, Pill } from "./atoms";
import { SETTINGS_DEFAULT } from "./rateCards";
import { exportPDF } from "./PDFExport";

// ── Rate card A4 content ──────────────────────────────────────
function RCContent({ card, lang, cleanSecT, rcSecGuards }: any) {
  const l = lang === "de";
  return (
    <div style={{ padding: "90px 62px 130px", fontSize: 9.5, lineHeight: 1.5, fontFamily: SANS, color: C.black, background: C.bg }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 4px" }}>{l ? "Preisliste" : "Rate Card"}</h1>
        <p style={{ fontSize: 7.5, color: C.muted, margin: 0 }}>{card.sub}</p>
      </div>
      {(card.sections || []).map((sec: any, si: number) => (
        <div key={si} data-rcsec={si} style={{ marginBottom: 14, paddingTop: rcSecGuards?.[si] || 0 }}>
          <p style={{ fontSize: 6.5, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: C.muted, margin: "0 0 3px", paddingBottom: "3px", borderBottom: `1px solid ${C.rule}` }}>
            {cleanSecT(sec.t)}
          </p>
          {sec.items.map((it: any) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.rule}` }}>
              <div>
                <span style={{ fontSize: 8.5 }}>{it.n}</span>
                {it.note && <span style={{ fontSize: 7, color: C.light, display: "block" }}>{it.note}</span>}
              </div>
              <span style={{ fontFamily: SERIF, fontSize: 8.5, whiteSpace: "nowrap" as const, marginLeft: 12 }}>
                {it.p != null ? `€ ${it.p.toLocaleString("de-DE")}` : it.m || ""}
              </span>
            </div>
          ))}
        </div>
      ))}
      {card.fine && <p style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.7, marginTop: 14 }}>{card.fine}</p>}
    </div>
  );
}

// ── Rate card PDF preview modal ───────────────────────────────
// Desktop / iPad (≥768px): edit panel + live A4 preview side by side.
// Mobile (<768px): one full-width pane with a Preview | Edit toggle.
// Opens in Preview so the card can be checked before saving.
function RateCardPreview({ card, settings, onSave, onClose }: any) {
  const init  = () => JSON.parse(JSON.stringify(card));
  const [hs,        setHs]        = useState({ hist: [init()], idx: 0 });
  const [pdfLang,   setPdfLang]   = useState("en");
  const [downloading, setDownloading] = useState(false);
  const [docHeight, setDocHeight] = useState(841);
  const [winW,      setWinW]      = useState(() => window.innerWidth);
  const [view,      setView]      = useState<"preview" | "edit">("preview");
  const [rcSecGuards, setRcSecGuards] = useState<number[]>([]);
  const [savedClean,  setSavedClean]  = useState(false);
  const [flash,       setFlash]       = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);

  const staged   = hs.hist[hs.idx];
  const canUndo  = hs.idx > 0;
  const canRedo  = hs.idx < hs.hist.length - 1;
  const PAGE_H   = 841;
  const CHROME_H = 220;
  const numPages = docHeight > PAGE_H + CHROME_H ? Math.ceil(docHeight / PAGE_H) : 1;
  const isM      = winW < 768;
  const pageScale = isM ? Math.min(1, (winW - 32) / 595) : 1;
  const sett = { ...SETTINGS_DEFAULT, ...(settings || {}) };

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    setRcSecGuards([]);
    const el = measureRef.current;
    if (!el) return;
    const calc = () => {
      const h = el.offsetHeight;
      if (h > 100) setDocHeight(h);
      const secEls = Array.from(el.querySelectorAll("[data-rcsec]")) as HTMLElement[];
      if (secEls.length > 0) {
        const newGuards = Array(secEls.length).fill(0);
        const guardedPages = new Set<number>();
        secEls.forEach(secEl => {
          const idx    = parseInt(secEl.getAttribute("data-rcsec") || "0", 10);
          const bottom = secEl.offsetTop + secEl.offsetHeight;
          const pageNum = Math.floor(secEl.offsetTop / PAGE_H);
          const bottomInPage = bottom - pageNum * PAGE_H;
          if (bottomInPage > PAGE_H - 80 && !guardedPages.has(pageNum)) {
            newGuards[idx] = Math.max(0, PAGE_H + 52 - secEl.offsetTop);
            guardedPages.add(pageNum);
          }
        });
        setRcSecGuards(prev => {
          if (newGuards.length !== prev.length) return newGuards;
          const next = newGuards.map((v, i) => Math.max(v, prev[i]));
          return next.some((v, i) => v !== prev[i]) ? next : prev;
        });
      }
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [staged, pdfLang]);

  const setStaged = (fn: any) => {
    setSavedClean(false);
    setHs(prev => {
      const curr = prev.hist[prev.idx];
      const newD = typeof fn === "function" ? fn(curr) : fn;
      const next = [...prev.hist.slice(0, prev.idx + 1), JSON.parse(JSON.stringify(newD))];
      return { hist: next, idx: next.length - 1 };
    });
  };

  const undo = () => { const ni = Math.max(0, hs.idx - 1); if (ni !== hs.idx) setHs(p => ({ ...p, idx: ni })); };
  const redo = () => { const ni = Math.min(hs.hist.length - 1, hs.idx + 1); if (ni !== hs.idx) setHs(p => ({ ...p, idx: ni })); };

  const cleanSecT = (t: string) => t.replace(/\s*[—–-]\s*\d+%[^"<]*/g, "").replace(/^Volume Discount\s*[&]\s*/i, "").trim();

  const download = () => exportPDF({
    preview: { ...staged, ctype: staged.label || "Rate Card" },
    type:    "ratecard",
    onStart: () => setDownloading(true),
    onDone:  () => setDownloading(false),
  });

  const doSave = () => { onSave(staged); setSavedClean(true); setFlash(true); setTimeout(() => setFlash(false), 2500); };

  const tryClose = () => {
    if (savedClean) { onClose(); return; }
    const isDirty = JSON.stringify(staged) !== JSON.stringify(card);
    isDirty ? setConfirmClose(true) : onClose();
  };

  // ── shared building blocks ──────────────────────────────────
  const undoRedoBtn = (dir: "undo" | "redo") => {
    const can = dir === "undo" ? canUndo : canRedo;
    return (
      <button
        onClick={dir === "undo" ? undo : redo}
        disabled={!can}
        style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${can ? C.rule : "transparent"}`, borderRadius: 2, cursor: can ? "pointer" : "default", color: can ? C.black : C.light, fontSize: 15, flexShrink: 0 }}
      >{dir === "undo" ? "←" : "→"}</button>
    );
  };

  const closeBtn = (
    <button
      onClick={tryClose}
      style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, flexShrink: 0 }}
    >✕</button>
  );

  const segBtn = (v: "preview" | "edit", label: string) => (
    <button
      onClick={() => setView(v)}
      style={{ flex: 1, minHeight: 38, border: `1px solid ${view === v ? C.black : C.rule}`, background: view === v ? C.black : "transparent", color: view === v ? C.white : C.muted, borderRadius: 2, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.10em", textTransform: "uppercase" as const }}
    >{label}</button>
  );

  const editForm = (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", WebkitOverflowScrolling: "touch" as any }}>
      <Lbl>Card Label</Lbl>
      <I value={staged.label || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, label: e.target.value }))} s={{ marginBottom: 8 }} />
      <Lbl>Subtitle</Lbl>
      <I value={staged.sub || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, sub: e.target.value }))} s={{ marginBottom: 10 }} />
      {(staged.sections || []).map((sec: any, si: number) => (
        <div key={si} style={{ marginBottom: 10, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "8px 10px", background: C.white }}>
          <I value={sec.t} onChange={(e: any) => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, t: e.target.value }) }))} s={{ marginBottom: 6, fontWeight: "500" }} />
          {sec.items.map((it: any) => (
            <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
              <I value={it.n} onChange={(e: any) => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, items: s.items.map((x: any) => x.id !== it.id ? x : { ...x, n: e.target.value }) }) }))} s={{ flex: 2 }} />
              <I type="number" value={it.p ?? ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, items: s.items.map((x: any) => x.id !== it.id ? x : { ...x, p: e.target.value === "" ? null : parseFloat(e.target.value) || 0 }) }) }))} s={{ width: 72 }} placeholder="€" />
              <button onClick={() => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, items: s.items.filter((x: any) => x.id !== it.id) }) }))} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, padding: "0 2px" }}>✕</button>
            </div>
          ))}
        </div>
      ))}
      <Lbl>Fine Print</Lbl>
      <textarea value={staged.fine || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, fine: e.target.value }))}
        style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: 16, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 64 }} />
    </div>
  );

  const saveBar = (
    <div style={{ padding: isM ? "10px 16px" : "12px 18px", borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>
      {flash && <p style={{ fontSize: TYPE.micro.size, color: C.green, margin: "0 0 7px", letterSpacing: "0.06em" }}>Saved ✓</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isM && undoRedoBtn("undo")}
        {isM && undoRedoBtn("redo")}
        <B onClick={doSave} s={{ flex: 1, textAlign: "center" as const }}>Save</B>
      </div>
    </div>
  );

  const previewPages = (
    <div style={{ flex: 1, background: "#888", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isM ? "20px 12px" : "32px 28px", gap: isM ? 16 : 28, WebkitOverflowScrolling: "touch" as any }}>
      {Array.from({ length: numPages }, (_, i) => (
        <div key={i} style={{ width: 595 * pageScale, height: PAGE_H * pageScale, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.32)" }}>
          <div data-pdf-page="true" style={{ width: 595, height: PAGE_H, overflow: "hidden", background: C.bg, position: "relative", transform: pageScale < 1 ? `scale(${pageScale})` : "none", transformOrigin: "top left" }}>
            <div style={{ position: "absolute", top: -i * PAGE_H, left: 0, width: 595 }}>
              <RCContent card={staged} lang={pdfLang} cleanSecT={cleanSecT} rcSecGuards={rcSecGuards} />
            </div>
            <div style={{ position: "absolute", bottom: 59, left: 0, right: 0, height: 28, background: C.bg, zIndex: 2, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: C.bg, zIndex: 3, borderBottom: `1px solid ${C.rule}` }}>
              <div style={{ padding: "13px 62px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 6, letterSpacing: "0.2em", color: C.light, textTransform: "uppercase" as const }}>{sett.company || sett.name || "Lynn Hoa"}</span>
                <span style={{ fontSize: 6, letterSpacing: "0.2em", color: C.light, textTransform: "uppercase" as const }}>{staged.label || "Rate Card"}</span>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, zIndex: 3, borderTop: `1px solid ${C.rule}` }}>
              <div style={{ padding: "26px 62px 22px", fontSize: 7, color: C.muted, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{[sett.email, sett.website].filter(Boolean).join(" · ") || "your@email.com · yourwebsite.com"}</span>
                {numPages > 1 && <span style={{ letterSpacing: "0.04em", color: C.light }}>{i + 1}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return createPortal(
    <>
      {confirmClose && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,249,247,0.88)" }}>
          <div style={{ background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "24px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", textAlign: "center" as const, minWidth: 220 }}>
            <p style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, fontWeight: "normal", color: C.black, margin: "0 0 6px" }}>Save before closing?</p>
            <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "0 0 18px" }}>Changes will be lost if you don't save.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <B onClick={() => { doSave(); setConfirmClose(false); onClose(); }}>Yes, save</B>
              <B v="sec" onClick={() => { setConfirmClose(false); onClose(); }}>No, discard</B>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Measure element (hidden) */}
      <div ref={measureRef} style={{ position: "fixed", top: 0, left: -9999, width: 595, visibility: "hidden", pointerEvents: "none", zIndex: -1 }}>
        <RCContent card={staged} lang={pdfLang} cleanSecT={cleanSecT} rcSecGuards={rcSecGuards} />
      </div>

      <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 9999, display: "flex", flexDirection: "column", fontFamily: SANS }}>
        {/* ── Toolbar ── */}
        <div style={{ borderBottom: `1px solid ${C.rule}`, flexShrink: 0 }}>
          <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
            {isM ? (
              <>
                {closeBtn}
                <div style={{ width: 1, height: 20, background: C.rule, margin: "0 2px" }} />
                <Pill on={pdfLang === "en"} onClick={() => setPdfLang("en")}>EN</Pill>
                <Pill on={pdfLang === "de"} onClick={() => setPdfLang("de")}>DE</Pill>
                <div style={{ flex: 1 }} />
                <B onClick={download} s={{ opacity: downloading ? 0.5 : 1 }}>{downloading ? "Saving…" : "Save PDF"}</B>
              </>
            ) : (
              <>
                {undoRedoBtn("undo")}
                {undoRedoBtn("redo")}
                <div style={{ width: 1, height: 20, background: C.rule, margin: "0 4px" }} />
                <Pill on={pdfLang === "en"} onClick={() => setPdfLang("en")}>EN</Pill>
                <Pill on={pdfLang === "de"} onClick={() => setPdfLang("de")}>DE</Pill>
                <div style={{ flex: 1 }} />
                <B onClick={download} s={{ opacity: downloading ? 0.5 : 1 }}>{downloading ? "Saving…" : "Save PDF"}</B>
                {closeBtn}
              </>
            )}
          </div>
          {isM && (
            <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
              {segBtn("preview", "Preview")}
              {segBtn("edit", "Edit")}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {(!isM || view === "edit") && (
            <div style={{ width: isM ? "100%" : 320, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isM ? "none" : `1px solid ${C.rule}` }}>
              {editForm}
              {saveBar}
            </div>
          )}
          {(!isM || view === "preview") && previewPages}
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Add Rate Card modal ───────────────────────────────────────
function AddRateCardModal({ rc, onSave, onClose }: any) {
  const CAT_KEYS  = ["influencer","ugc","editorial"];
  const CAT_LABEL: Record<string,string> = { influencer:"Brand Collaboration", ugc:"UGC", editorial:"Editorial" };
  const [baseCat,     setBaseCat]     = useState<string | null>(null);
  const [customName,  setCustomName]  = useState("");
  const [sections,    setSections]    = useState<any[]>([]);
  const [fine,        setFine]        = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const allItems = CAT_KEYS.flatMap(k => (rc[k]?.sections || []).flatMap((sec: any) => sec.items.map((it: any) => ({ ...it, _cat: k }))));
  const catItems = (cat: string) => cat === "other" ? allItems : allItems.filter((it: any) => it._cat === cat);

  const initBuilder = (cat: string) => {
    setBaseCat(cat);
    const headings: Record<string,string[]> = {
      influencer: ["01 — Brand Collaboration","02 — Packages","03 — Usage Rights","04 — Add-ons"],
      ugc:        ["01 — UGC Creation","02 — Packages","03 — Usage Rights","04 — Add-ons"],
      editorial:  ["01 — Editorial","02 — Packages","03 — Usage Rights","04 — Add-ons"],
      other:      ["01 — Services","02 — Packages","03 — Usage Rights","04 — Add-ons"],
    };
    setSections((headings[cat] || headings.other).map(h => ({ id: uid(), t: h, items: [] })));
    setFine(rc[cat]?.fine || rc.influencer?.fine || "");
  };

  const label    = baseCat === "other" ? (customName || "Custom") : CAT_LABEL[baseCat || ""] || "";
  const catKey   = baseCat === "other" ? (customName.toLowerCase().replace(/\s+/g,"_") || "custom") : (baseCat || "custom");
  const builtCard = { label, sub: rc[baseCat || ""]?.sub || label, sections, fine, usage: rc[baseCat || ""]?.usage || rc.influencer?.usage || [], excl: rc[baseCat || ""]?.excl || rc.influencer?.excl || [] };

  if (showPreview) return <RateCardPreview card={builtCard} settings={null} onSave={(saved: any) => { onSave(catKey, saved); }} onClose={() => setShowPreview(false)} />;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.bg, width: "100%", maxWidth: 600, borderRadius: 2, padding: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, fontWeight: "normal", margin: 0 }}>Add Rate Card</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted }}>✕</button>
        </div>

        {!baseCat ? (
          <>
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 14px" }}>Choose a base category or start custom:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {CAT_KEYS.map(k => (
                <button key={k} onClick={() => initBuilder(k)}
                  style={{ padding: "14px 12px", border: `1px solid ${C.rule}`, borderRadius: 2, background: C.white, cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
                  <p style={{ fontSize: TYPE.subtext.size, color: C.black, margin: "0 0 3px", fontWeight: "500" }}>{CAT_LABEL[k]}</p>
                  <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: 0 }}>{rc[k]?.sections?.length || 0} sections · {(rc[k]?.sections || []).reduce((s: number, sec: any) => s + sec.items.length, 0)} items</p>
                </button>
              ))}
              <button onClick={() => initBuilder("other")}
                style={{ padding: "14px 12px", border: `1px solid ${C.rule}`, borderRadius: 2, background: C.white, cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
                <p style={{ fontSize: TYPE.subtext.size, color: C.black, margin: "0 0 3px", fontWeight: "500" }}>Custom / Other</p>
                <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: 0 }}>Pick from all categories</p>
              </button>
            </div>
          </>
        ) : (
          <>
            {baseCat === "other" && (
              <div style={{ marginBottom: 12 }}>
                <Lbl>Card Name</Lbl>
                <I value={customName} onChange={(e: any) => setCustomName(e.target.value)} placeholder="e.g. Hotels, Campaign Bundle…" />
              </div>
            )}
            {sections.map((sec, si) => {
              const available = catItems(baseCat).filter((it: any) => !sec.items.find((s: any) => s.id === it.id));
              return (
                <div key={sec.id} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "11px 12px", marginBottom: 10, background: C.white }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 8 }}>
                    <I value={sec.t} onChange={(e: any) => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, t: e.target.value }))} s={{ flex: 1, fontWeight: "500" }} />
                    <button onClick={() => setSections(prev => prev.filter((_, i) => i !== si))} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 13, padding: 0 }}>✕</button>
                  </div>
                  {sec.items.map((it: any) => (
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                      <div>
                        <span style={{ fontSize: TYPE.label.size }}>{it.n}</span>
                        {it.note && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{it.note}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                        <span style={{ fontSize: TYPE.label.size, fontFamily: SERIF, color: C.muted }}>{it.p != null ? `€ ${it.p}` : it.m || ""}</span>
                        <button onClick={() => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: s.items.filter((x: any) => x.id !== it.id) }))} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, padding: 0 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {available.length > 0 && (
                    <select onChange={(e: any) => { const it = available.find((x: any) => x.id === e.target.value); if (it) setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, items: [...s.items, { id: uid(), n: it.n, note: it.note || "", p: it.p, m: it.m }] })); e.target.value = ""; }}
                      style={{ marginTop: 7, width: "100%", padding: "6px 8px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.muted, borderRadius: 2, outline: "none" }}>
                      <option value="">+ Add item from Service Catalog…</option>
                      {available.map((it: any) => <option key={it.id} value={it.id}>{it.n}{it.p != null ? ` — € ${it.p}` : ""}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
            <button onClick={() => setSections(prev => [...prev, { id: uid(), t: `0${prev.length + 1} — New Section`, items: [] }])}
              style={{ fontSize: TYPE.micro.size, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 12px", fontFamily: SANS, textDecoration: "underline", textDecorationColor: C.rule }}>
              + Add section
            </button>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.rule}` }}>
              <B v="sec" onClick={() => setBaseCat(null)}>← Back</B>
              <div style={{ display: "flex", gap: 8 }}>
                <B v="sec" onClick={onClose}>Cancel</B>
                <B onClick={() => setShowPreview(true)} s={{ opacity: sections.some(s => s.items.length > 0) ? 1 : 0.4 }}>Preview & Save</B>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ServiceCatalog component ─────────────────────────────
interface ServiceCatalogProps {
  rc:         any;
  upsertCard: (key: string, card: any) => Promise<string | null>;
  deleteCard: (key: string) => Promise<string | null>;
  settings:   any;
  isMobile?:  boolean;
}

const BASE_CATS = ["influencer", "ugc", "editorial"];
const CAT_LABEL: Record<string, string> = { influencer: "Brand Collaboration", ugc: "UGC", editorial: "Editorial" };

export default function ServiceCatalog({ rc, upsertCard, deleteCard, settings, isMobile = false }: ServiceCatalogProps) {
  const [tab,         setTab]         = useState("influencer");
  const [edit,        setEdit]        = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Base tabs + custom cards (any rc key with a label)
  const tabs = BASE_CATS.filter(k => rc[k]).concat(
    Object.keys(rc).filter(k => !BASE_CATS.includes(k) && k !== "hotels" && rc[k]?.label)
  );
  const card = rc[tab] || rc.influencer;

  const setCard = (fn: (c: any) => any) => {
    const updated = fn(card);
    upsertCard(tab, updated);
  };

  const upItem = (si: number, id: string, f: string, v: string) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) =>
        i !== si ? sc : {
          ...sc,
          items: sc.items.map((it: any) =>
            it.id !== id ? it : { ...it, [f]: f === "p" ? (v === "" ? null : parseFloat(v) || 0) : v }
          ),
        }
      ),
    }));

  const remItem = (si: number, id: string) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) =>
        i !== si ? sc : { ...sc, items: sc.items.filter((it: any) => it.id !== id) }
      ),
    }));

  const addItem = (si: number) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) =>
        i !== si ? sc : { ...sc, items: [...sc.items, { id: uid(), n: "New item", note: "", p: 0 }] }
      ),
    }));

  const upSecTitle = (si: number, v: string) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) => i !== si ? sc : { ...sc, t: v }),
    }));

  const addSection = () =>
    setCard(prev => ({
      ...prev,
      sections: [...(prev.sections || []), { id: uid(), t: "New Section", items: [] }],
    }));

  const remSection = (si: number) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.filter((_: any, i: number) => i !== si),
    }));

  const upFine = (v: string) => setCard(prev => ({ ...prev, fine: v }));

  const removeCustomCard = (k: string) => {
    if (window.confirm(`Delete "${rc[k]?.label || k}"?`)) {
      deleteCard(k);
      if (tab === k) setTab("influencer");
    }
  };

  const saveBuilt = (key: string, saved: any) => {
    upsertCard(key, saved);
    setTab(key);
    setShowBuilder(false);
  };

  // ── Header action styles ────────────────────────────────────
  // Quiet text links for secondary actions; one compact solid
  // button for the primary action. Links keep a 44px touch
  // target via invisible vertical padding.
  const LinkBtn = ({ onClick, children }: any) => (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "17px 0", lineHeight: 1, flexShrink: 0 }}
    >{children}</button>
  );
  const CompactB = ({ onClick, children }: any) => (
    <button
      onClick={onClick}
      style={{ background: C.black, color: C.white, border: "none", borderRadius: 2, minHeight: 36, padding: "0 16px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.10em", textTransform: "uppercase" as const, flexShrink: 0 }}
    >{children}</button>
  );

  return (
    <div>
      {showBuilder && <AddRateCardModal rc={rc} onSave={saveBuilt} onClose={() => setShowBuilder(false)} />}
      {showPreview && (
        <RateCardPreview
          card={card}
          settings={settings}
          onSave={(saved: any) => upsertCard(tab, saved)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── HEADER ── */}
      <div>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px" }}>Service Catalog</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 6px" }}>Fashion · Beauty · Lifestyle</p>
      </div>

      {/* ── ACTION ROW — quiet links left, compact primary right ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: `1px solid ${C.rule}`, marginBottom: 14 }}>
        {edit ? (
          <>
            <LinkBtn onClick={addSection}>+ Section</LinkBtn>
            <div style={{ flex: 1 }} />
            <CompactB onClick={() => setEdit(false)}>Done</CompactB>
          </>
        ) : (
          <>
            <LinkBtn onClick={() => setShowPreview(true)}>Rate Card PDF</LinkBtn>
            <LinkBtn onClick={() => setShowBuilder(true)}>+ Add Card</LinkBtn>
            <div style={{ flex: 1 }} />
            <CompactB onClick={() => setEdit(true)}>Edit</CompactB>
          </>
        )}
      </div>

      {/* ── CATEGORY TABS ── */}
      {/* Mobile: single row, swipe horizontally — never wraps.         */}
      <div style={{
        display:    "flex",
        gap:        6,
        marginBottom: 18,
        alignItems: "center",
        ...(isMobile
          ? { overflowX: "auto" as const, flexWrap: "nowrap" as const, WebkitOverflowScrolling: "touch" as any, scrollbarWidth: "none" as any, paddingBottom: 2 }
          : { flexWrap: "wrap" as const }),
      }}>
        {tabs.map(k => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            <Pill on={tab === k} onClick={() => setTab(k)}>{rc[k]?.label || CAT_LABEL[k] || k}</Pill>
            {!BASE_CATS.includes(k) && (
              <button
                onClick={() => removeCustomCard(k)}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 11, padding: "0 2px", lineHeight: 1 }}
                title="Delete"
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* ── SECTIONS ── */}
      {(card.sections || []).map((sec: any, si: number) => (
        <div key={si} style={{ marginBottom: 14 }}>
          {/* Section title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
            {edit ? (
              <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
                <I value={sec.t} onChange={(e: any) => upSecTitle(si, e.target.value)} s={{ flex: 1 }} />
                <button onClick={() => remSection(si)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 13, padding: 0 }}>✕</button>
              </div>
            ) : (
              <span style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase" as const, border: `1px solid ${C.rule}`, padding: "3px 9px", borderRadius: 2 }}>{sec.t}</span>
            )}
            {edit && <B v="sec" onClick={() => addItem(si)} s={{ fontSize: TYPE.micro.size, marginLeft: 6 }}>+ Add</B>}
          </div>

          {/* Items */}
          {sec.items.map((it: any) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.rule}` }}>
              {edit ? (
                <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", flexWrap: isMobile ? "wrap" as const : "nowrap" as const }}>
                  <I value={it.n}    onChange={(e: any) => upItem(si, it.id, "n",    e.target.value)} s={{ flex: isMobile ? "1 1 100%" : 1 }} />
                  <I value={it.note || ""} onChange={(e: any) => upItem(si, it.id, "note", e.target.value)} s={{ flex: 1 }} placeholder="note" />
                  <I type="number" value={it.p ?? ""} onChange={(e: any) => upItem(si, it.id, "p", e.target.value)} s={{ width: 64 }} placeholder="€" />
                  {it.m !== undefined && <I value={it.m || ""} onChange={(e: any) => upItem(si, it.id, "m", e.target.value)} s={{ width: 52 }} />}
                  <button onClick={() => remItem(si, it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, padding: "0 2px" }}>✕</button>
                </div>
              ) : (
                <>
                  <div>
                    <p style={{ fontSize: TYPE.body.size, color: C.black, margin: "0 0 3px" }}>{it.n}</p>
                    {it.note && <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0 }}>{it.note}</p>}
                  </div>
                  <span style={{ fontFamily: SERIF, fontSize: TYPE.label.size, color: C.black, whiteSpace: "nowrap" as const, marginLeft: 12 }}>
                    {it.m && <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginRight: 5 }}>{it.m}</span>}
                    {it.p != null ? `€ ${it.p.toLocaleString("de-DE")}` : ""}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* ── FINE PRINT ── */}
      {edit ? (
        <div style={{ marginTop: 10 }}>
          <Lbl>Fine Print</Lbl>
          <textarea
            value={card.fine || ""}
            onChange={(e: any) => upFine(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: 16, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 64 }}
          />
        </div>
      ) : (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, lineHeight: 1.75, marginTop: 10 }}>{card.fine}</p>
      )}
    </div>
  );
}
