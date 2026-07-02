// ─────────────────────────────────────────────────────────────
// RateCard — client-facing rate card builder + PDF preview
// Tab per category, + Add Rate Card, Preview & Download
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
function RateCardPreview({ card, settings, onSave, onClose }: any) {
  const init  = () => JSON.parse(JSON.stringify(card));
  const [hs,        setHs]        = useState({ hist: [init()], idx: 0 });
  const [pdfLang,   setPdfLang]   = useState("en");
  const [downloading, setDownloading] = useState(false);
  const [docHeight, setDocHeight] = useState(841);
  const [winW,      setWinW]      = useState(() => window.innerWidth);
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
  const pageScale = winW < 768 ? Math.min(1, (winW - 32) / 595) : 1;
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
        {/* Toolbar */}
        <div style={{ height: 46, borderBottom: `1px solid ${C.rule}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 6, flexShrink: 0 }}>
          <button onClick={undo} disabled={!canUndo} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${canUndo ? C.rule : "transparent"}`, borderRadius: 2, cursor: canUndo ? "pointer" : "default", color: canUndo ? C.black : C.light, fontSize: 15 }}>←</button>
          <button onClick={redo} disabled={!canRedo} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${canRedo ? C.rule : "transparent"}`, borderRadius: 2, cursor: canRedo ? "pointer" : "default", color: canRedo ? C.black : C.light, fontSize: 15 }}>→</button>
          <div style={{ width: 1, height: 20, background: C.rule, margin: "0 4px" }} />
          <Pill on={pdfLang === "en"} onClick={() => setPdfLang("en")}>EN</Pill>
          <Pill on={pdfLang === "de"} onClick={() => setPdfLang("de")}>DE</Pill>
          <div style={{ flex: 1 }} />
          <B onClick={download} s={{ opacity: downloading ? 0.5 : 1 }}>{downloading ? "Saving…" : "Save PDF"}</B>
          <button
            onClick={() => { if (savedClean) { onClose(); return; } const isDirty = JSON.stringify(staged) !== JSON.stringify(card); isDirty ? setConfirmClose(true) : onClose(); }}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, marginLeft: 4 }}
          >✕</button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Edit panel */}
          <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${C.rule}` }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              <Lbl>Card Label</Lbl>
              <I value={staged.label || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, label: e.target.value }))} s={{ marginBottom: 8 }} />
              <Lbl>Subtitle</Lbl>
              <I value={staged.sub || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, sub: e.target.value }))} s={{ marginBottom: 10 }} />
              {(staged.sections || []).map((sec: any, si: number) => (
                <div key={si} style={{ marginBottom: 10, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "8px 10px", background: C.white }}>
                  <I value={sec.t} onChange={(e: any) => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, t: e.target.value }) }))} s={{ marginBottom: 6, fontSize: TYPE.micro.size, fontWeight: "500" }} />
                  {sec.items.map((it: any) => (
                    <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
                      <I value={it.n} onChange={(e: any) => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, items: s.items.map((x: any) => x.id !== it.id ? x : { ...x, n: e.target.value }) }) }))} s={{ flex: 2, fontSize: TYPE.micro.size }} />
                      <I type="number" value={it.p ?? ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, items: s.items.map((x: any) => x.id !== it.id ? x : { ...x, p: e.target.value === "" ? null : parseFloat(e.target.value) || 0 }) }) }))} s={{ width: 52, fontSize: TYPE.micro.size }} placeholder="€" />
                      <button onClick={() => setStaged((p: any) => ({ ...p, sections: p.sections.map((s: any, i: number) => i !== si ? s : { ...s, items: s.items.filter((x: any) => x.id !== it.id) }) }))} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, padding: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
              <Lbl>Fine Print</Lbl>
              <textarea value={staged.fine || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, fine: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 64 }} />
            </div>
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>
              {flash && <p style={{ fontSize: TYPE.micro.size, color: C.green, margin: "0 0 7px", letterSpacing: "0.06em" }}>Saved ✓</p>}
              <B onClick={doSave} s={{ width: "100%", textAlign: "center" as const }}>Save</B>
            </div>
          </div>

          {/* PDF preview */}
          <div style={{ flex: 1, background: "#888", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 28px", gap: 28 }}>
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
                    <I value={sec.t} onChange={(e: any) => setSections(prev => prev.map((s, i) => i !== si ? s : { ...s, t: e.target.value }))} s={{ flex: 1, fontSize: TYPE.micro.size, fontWeight: "500" }} />
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

// ── Main RateCard component ───────────────────────────────────
interface RateCardProps {
  rc:         any;
  upsertCard: (key: string, card: any) => Promise<string | null>;
  settings:   any;
}

const BASE_CATS = ["influencer","ugc","editorial"];
const CAT_LABEL: Record<string,string> = { influencer: "Brand Collaboration", ugc: "UGC", editorial: "Editorial" };

export default function RateCard({ rc, upsertCard, settings }: RateCardProps) {
  const [tab,          setTab]         = useState("influencer");
  const [showBuilder,  setShowBuilder] = useState(false);
  const [showPreview,  setShowPreview] = useState(false);

  const tabs = BASE_CATS.filter(k => rc[k]).concat(
    Object.keys(rc).filter(k => !BASE_CATS.includes(k) && k !== "hotels" && rc[k]?.label)
  );
  const card = rc[tab] || rc.influencer;

  const saveBuilt = (key: string, saved: any) => {
    upsertCard(key, saved);
    setTab(key);
    setShowBuilder(false);
  };

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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px" }}>Rate Card</h2>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: 0 }}>Fashion · Beauty · Lifestyle</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <B v="sec" onClick={() => setShowPreview(true)}>Preview</B>
          <B onClick={() => setShowBuilder(true)}>+ Add Rate Card</B>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" as const, alignItems: "center" }}>
        {tabs.map(k => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Pill on={tab === k} onClick={() => setTab(k)}>{rc[k]?.label || CAT_LABEL[k] || k}</Pill>
            {!BASE_CATS.includes(k) && (
              <button
                onClick={() => { if (window.confirm(`Delete "${rc[k]?.label || k}"?`)) { /* deleteCard handled via upsert with null */ setTab("influencer"); } }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 11, padding: "0 2px", lineHeight: 1 }}
                title="Delete"
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Sections read-only */}
      {(card.sections || []).map((sec: any, si: number) => (
        <div key={si} style={{ marginBottom: 14 }}>
          <div style={{ padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
            <span style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase" as const, border: `1px solid ${C.rule}`, padding: "3px 9px", borderRadius: 2 }}>{sec.t}</span>
          </div>
          {sec.items.map((it: any) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.rule}` }}>
              <div>
                <p style={{ fontSize: TYPE.body.size, color: C.black, margin: "0 0 3px" }}>{it.n}</p>
                {it.note && <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0 }}>{it.note}</p>}
              </div>
              <span style={{ fontFamily: SERIF, fontSize: TYPE.label.size, color: C.black, whiteSpace: "nowrap" as const, marginLeft: 12 }}>
                {it.m && <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginRight: 5 }}>{it.m}</span>}
                {it.p != null ? `€ ${it.p.toLocaleString("de-DE")}` : ""}
              </span>
            </div>
          ))}
        </div>
      ))}

      {card.fine && <p style={{ fontSize: TYPE.label.size, color: C.muted, lineHeight: 1.75, marginTop: 10 }}>{card.fine}</p>}
    </div>
  );
}
