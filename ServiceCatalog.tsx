// ─────────────────────────────────────────────────────────────
// ServiceCatalog — the only price source for the whole app.
// Cards: Brand Collab / UGC / Editorial / Hotels + custom cards.
// Every section has a type (deliverables, packages, usage rights,
// exclusivity, add-ons, info). Usage + exclusivity percentages are
// edited here once and used by the Calculator, the rate-card PDF
// and the renewal builder. Edits save automatically.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, Z, catInfo, PDF, PAL, DENSITY, cardTone } from "./constants";
import { uid, fmt, pctSpace } from "./formatters";
import { I, S, B, Lbl, Pill, Tick, ConfirmDialog, LangSwitch, BAR_BTN, NumField, PillBtn, Chip, ChipRow, SummaryLine, Strong, SectionHead, ListCard, Row, Switch, Stepper, Sheet } from "./atoms";
import { SETTINGS_DEFAULT } from "./rateCards";
import { pagesToPdf, isMobileDevice } from "./PDFExport";
import { editLock } from "./saveStatus";
import {
  normalizeCard, sectionKind, KIND_LABEL, optName, pctText, addonPriceText, BASE_CARD_KEYS, retainerPctOf
} from "./pricing";
import type { SectionKind } from "./pricing";

const cardTitle = (rc: any, k: string) => BASE_CARD_KEYS.includes(k) ? catInfo(k).label : (rc?.[k]?.label || k);
const cleanSecT = (t: string) => String(t || "").replace(/\s*[—–-]\s*added to base rate.*$/i, "").replace(/\s*[—–-]\s*\d+%[^"<]*/g, "").replace(/^Volume Discount\s*[&]\s*/i, "").trim();
const money = (p: any) => fmt(Number(p) || 0);          // German: 200,00 €

// Rows a section shows (usage / exclusivity come from the options)
function sectionRows(card: any, sec: any): { key: string; n: string; note?: string; price: string }[] {
  const kind = sectionKind(sec);
  if (kind === "usage" || kind === "exclusivity") {
    const opts = (kind === "usage" ? card.usage : card.excl) || [];
    return opts.filter((o: any) => !o.sentinel).map((o: any, i: number) => ({
      key: `o${i}`, n: optName(o.l), price: Number(o.pct) > 0 ? `+${pctText(o.pct)}` : "included",
    }));
  }
  return (sec.items || []).map((it: any, i: number) => ({
    key: it.id || `i${i}`,
    n: pctSpace(it.n),
    note: pctSpace([it.note, kind === "packages" && it.includes?.length ? `Includes ${it.includes.map((x: any) => `${x.qty || 1}× ${x.n}`).join(", ")}` : ""].filter(Boolean).join(" · ")),
    price: kind === "addons" ? addonPriceText(it) : it.p !== null && it.p !== undefined ? money(it.p) : pctSpace(it.m || ""),
  }));
}

// ── Rate card A4 content ──────────────────────────────────────
function RCContent({ card, lang, rcSecGuards }: any) {
  const l = lang === "de";
  return (
    <div style={{ padding: "90px 62px 130px", fontSize: 9.5, lineHeight: 1.5, fontFamily: SANS, color: PDF.ink, background: PDF.page }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: "normal", margin: "0 0 4px" }}>{l ? "Preisliste" : "Rate Card"}</h1>
        <p style={{ fontSize: 7.5, color: PDF.label, margin: 0 }}>{pctSpace(card.sub)}</p>
      </div>
      {(card.sections || []).map((sec: any, si: number) => {
        const rows = sectionRows(card, sec);
        if (!rows.length) return null;
        return (
          <div key={si} data-rcsec={si} style={{ marginBottom: 14, paddingTop: rcSecGuards?.[si] || 0 }}>
            <p style={{ fontSize: 7, letterSpacing: 0, textTransform: "uppercase" as const, color: PDF.label, margin: "0 0 3px", paddingBottom: "3px", borderBottom: `1px solid ${PDF.rule}` }}>
              {cleanSecT(sec.t)}{sectionKind(sec) === "usage" || sectionKind(sec) === "exclusivity" ? (l ? " — auf den Grundpreis" : " — added to base rate") : ""}
            </p>
            {rows.map(r => (
              <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${PDF.rule}` }}>
                <div>
                  <span style={{ fontSize: 8.5 }}>{r.n}</span>
                  {r.note && <span style={{ fontSize: 7, color: PDF.faint, display: "block" }}>{r.note}</span>}
                </div>
                <span style={{ fontFamily: SERIF, fontSize: 8.5, whiteSpace: "nowrap" as const, marginLeft: 12 }}>{r.price}</span>
              </div>
            ))}
          </div>
        );
      })}
      {card.fine && <p style={{ fontSize: 7.5, color: PDF.label, lineHeight: 1.7, marginTop: 14 }}>{pctSpace(card.fine)}</p>}
    </div>
  );
}

// ── A4 pages with header / footer (preview + PDF capture) ─────
function RCPages({ card, lang, settings, scale = 1 }: any) {
  const PAGE_H = 841;
  const measureRef = useRef<HTMLDivElement>(null);
  const [docHeight, setDocHeight] = useState(PAGE_H);
  const [guards, setGuards] = useState<number[]>([]);
  const sett = { ...SETTINGS_DEFAULT, ...(settings || {}) };

  useEffect(() => {
    setGuards([]);
    const el = measureRef.current;
    if (!el) return;
    const calc = () => {
      const h = el.offsetHeight;
      if (h > 100) setDocHeight(h);
      const secEls = Array.from(el.querySelectorAll("[data-rcsec]")) as HTMLElement[];
      if (!secEls.length) return;
      const next: number[] = [];
      const guarded = new Set<number>();
      secEls.forEach(secEl => {
        const idx = parseInt(secEl.getAttribute("data-rcsec") || "0", 10);
        const page = Math.floor(secEl.offsetTop / PAGE_H);
        const bottomInPage = secEl.offsetTop + secEl.offsetHeight - page * PAGE_H;
        if (bottomInPage > PAGE_H - 80 && !guarded.has(page)) { next[idx] = Math.max(0, PAGE_H + 52 - secEl.offsetTop); guarded.add(page); }
      });
      setGuards(prev => {
        const merged = next.map((v, i) => Math.max(v || 0, prev[i] || 0));
        return merged.length === prev.length && merged.every((v, i) => v === prev[i]) ? prev : merged;
      });
    };
    calc();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card, lang]);

  const numPages = docHeight > PAGE_H + 220 ? Math.ceil(docHeight / PAGE_H) : 1;
  return (
    <>
      <div ref={measureRef} style={{ position: "fixed", top: 0, left: -9999, width: 595, visibility: "hidden", pointerEvents: "none", zIndex: -1 }}>
        <RCContent card={card} lang={lang} rcSecGuards={guards} />
      </div>
      {Array.from({ length: numPages }, (_, i) => (
        <div key={i} style={{ width: 595 * scale, height: PAGE_H * scale, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.32)" }}>
          <div data-pdf-page="true" style={{ width: 595, height: PAGE_H, overflow: "hidden", background: PDF.page, position: "relative", transform: scale < 1 ? `scale(${scale})` : "none", transformOrigin: "top left" }}>
            <div style={{ position: "absolute", top: -i * PAGE_H, left: 0, width: 595 }}>
              <RCContent card={card} lang={lang} rcSecGuards={guards} />
            </div>
            <div style={{ position: "absolute", bottom: 59, left: 0, right: 0, height: 28, background: PDF.page, zIndex: 2, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: PDF.page, zIndex: 3, borderBottom: `1px solid ${PDF.rule}` }}>
              <div style={{ padding: "13px 62px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 7, letterSpacing: 0, color: PDF.faint, textTransform: "uppercase" as const }}>{sett.company || sett.name || "Lynn Hoa"}</span>
                <span style={{ fontSize: 7, letterSpacing: 0, color: PDF.faint, textTransform: "uppercase" as const }}>{card.label || "Rate Card"}</span>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: PDF.page, zIndex: 3, borderTop: `1px solid ${PDF.rule}` }}>
              <div style={{ padding: "26px 62px 22px", fontSize: 7, color: PDF.label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{[sett.email, sett.website].filter(Boolean).join(" · ")}</span>
                {numPages > 1 && <span style={{ letterSpacing: 0, color: PDF.faint }}>{i + 1}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Full-screen shell: panel left, live A4 preview right ──────
// (one level: everything about a card happens in this one window)
function CardShell({ title, card, settings, panel, footer, onClose }: any) {
  useEffect(() => editLock.acquire(), []);      // no reload while this window is open
  const [lang, setLang] = useState("en");
  const [winW, setWinW] = useState(() => window.innerWidth);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isM = winW < 768;
  const scale = isM ? Math.min(1, (winW - 32) / 595) : 1;
  const [ready, setReady] = useState<null | { file: File; url: string; canShare: boolean }>(null);
  // draws the pages (switching to the preview on the phone first), then Share / Open — or saves on a computer
  const download = async () => {
    if (busy) return;
    setReady(null);
    if (isM && view !== "preview") { setView("preview"); await new Promise(r => setTimeout(r, 500)); }
    const root = previewRef.current;
    const pages = root ? (Array.from(root.querySelectorAll("[data-pdf-page]")) as HTMLElement[]) : [];
    if (!pages.length) return;
    setBusy(true);
    const kept = pages.map(p => p.style.transform);
    pages.forEach(p => { p.style.transform = "none"; });
    try {
      const pdf = await pagesToPdf(pages, "portrait");
      const name = `Rate Card – ${card.label || "Card"}`;
      const blob: Blob = pdf.output("blob");
      const file = new File([blob], `${name}.pdf`, { type: "application/pdf" });
      const nav: any = navigator;
      const canShare = !!(nav.canShare && nav.canShare({ files: [file] }));
      if (canShare || isMobileDevice()) setReady({ file, url: URL.createObjectURL(blob), canShare });
      else pdf.save(`${name}.pdf`);
    } finally {
      pages.forEach((p, i) => { p.style.transform = kept[i]; });
      setBusy(false);
    }
  };
  const share = async () => { if (!ready) return; try { await (navigator as any).share({ files: [ready.file], title: card.label || "Rate card" }); } catch { /* closed */ } };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: Z.modal, display: "flex", flexDirection: "column", fontFamily: SANS }}>
      <div style={{ borderBottom: `1px solid ${C.rule}`, flexShrink: 0 }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 8px 0 2px", gap: 6 }}>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20 }}>✕</button>
          <span style={{ fontFamily: SERIF, fontSize: TYPE.body.size, color: C.black, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{title}</span>
          <div style={{ flex: 1 }} />
          <LangSwitch lang={lang} onChange={setLang} />
          <B onClick={download} s={{ ...BAR_BTN, opacity: busy ? 0.5 : 1 }}>{busy ? "Preparing…" : "Share PDF"}</B>
        </div>
        {ready && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: PAL.done.wash, borderTop: `1px solid ${C.rule}` }}>
            <span style={{ flex: 1, fontSize: 13, color: PAL.done.ink }}>PDF ready</span>
            {ready.canShare && <B onClick={share} s={{ minHeight: 36 }}>Share</B>}
            <B v="sec" onClick={() => window.open(ready.url, "_blank")} s={{ minHeight: 36 }}>Open</B>
          </div>
        )}
        {isM && (
          <div style={{ display: "flex", gap: 6, padding: "0 10px 8px" }}>
            <Pill size="sm" on={view === "edit"} onClick={() => setView("edit")}>Edit</Pill>
            <Pill size="sm" on={view === "preview"} onClick={() => setView("preview")}>Preview</Pill>
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {(!isM || view === "edit") && (
          <div style={{ width: isM ? "100%" : 380, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isM ? "none" : `1px solid ${C.rule}` }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 14px", WebkitOverflowScrolling: "touch" as any }}>{panel}</div>
            {footer && <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>{footer}</div>}
          </div>
        )}
        {(!isM || view === "preview") && (
          <div ref={previewRef} style={{ flex: 1, background: "#888", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isM ? "20px 12px" : "32px 28px", gap: isM ? 16 : 28 }}>
            <RCPages card={card} lang={lang} settings={settings} scale={scale} />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Rate Card PDF (label, subtitle, fine print + live preview) ─
function RateCardPreview({ card, settings, onSave, onClose }: any) {
  const [staged, setStaged] = useState(() => JSON.parse(JSON.stringify(card)));
  const [askClose, setAskClose] = useState(false);
  const [flash, setFlash] = useState(false);
  const dirty = JSON.stringify(staged) !== JSON.stringify(card);
  const save = () => { onSave(staged); setFlash(true); setTimeout(() => setFlash(false), 1800); };
  const close = () => (dirty && !flash ? setAskClose(true) : onClose());
  return (
    <>
      {askClose && (
        <ConfirmDialog title="Save before closing?" text="Changes will be lost if you don't save." okLabel="Yes, save" cancelLabel="No, discard"
          onOk={() => { onSave(staged); setAskClose(false); onClose(); }} onCancel={() => { setAskClose(false); onClose(); }} />
      )}
      <CardShell
        title={`Rate Card PDF — ${staged.label || ""}`}
        card={staged}
        settings={settings}
        onClose={close}
        panel={
          <>
            <Lbl>Card Label</Lbl>
            <I value={staged.label || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, label: e.target.value }))} s={{ marginBottom: 10 }} />
            <Lbl>Subtitle</Lbl>
            <I value={staged.sub || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, sub: e.target.value }))} s={{ marginBottom: 10 }} />
            <Lbl>Fine Print</Lbl>
            <textarea value={staged.fine || ""} onChange={(e: any) => setStaged((p: any) => ({ ...p, fine: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.sectionHeading.size, color: C.black, borderRadius: 10, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 96 }} />
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "12px 0 0", lineHeight: 1.6 }}>Items, prices and percentages are edited in the catalog (Edit).</p>
          </>
        }
        footer={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {flash && <span style={{ fontSize: TYPE.label.size, color: C.green }}>Saved ✓</span>}
            <div style={{ flex: 1 }} />
            <B onClick={save} s={{ opacity: dirty ? 1 : 0.5 }}>Save</B>
          </div>
        }
      />
    </>
  );
}

// ── Add Card (one window: builder + live preview) ─────────────
function AddCardModal({ rc, settings, onSave, onClose }: any) {
  const [name,    setName]    = useState("");
  const [base,    setBase]    = useState<string>("");     // "" = empty card
  const [card,    setCard]    = useState<any>(() => normalizeCard({ label: "", sub: "", sections: [], fine: "", usage: rc.influencer?.usage || [], excl: rc.influencer?.excl || [] }));
  const [err,     setErr]     = useState<string | null>(null);
  const [askClose, setAskClose] = useState(false);
  const allKeys = Object.keys(rc || {});

  // every item of a type across all cards, for "+ Add item"
  const library = (kind: SectionKind) => {
    const seen = new Set<string>();
    return allKeys.flatMap(k => (rc[k]?.sections || [])
      .filter((s: any) => sectionKind(s) === kind)
      .flatMap((s: any) => (s.items || []).map((it: any) => ({ ...it, _from: cardTitle(rc, k) }))))
      .filter((it: any) => { const key = `${it.n}|${it.p}|${it.pct}`; if (seen.has(key)) return false; seen.add(key); return true; });
  };

  const startFrom = (k: string) => {
    setBase(k);
    if (!k) { setCard((c: any) => normalizeCard({ ...c, sections: [], fine: "" })); return; }
    const src = JSON.parse(JSON.stringify(rc[k]));
    setCard((c: any) => normalizeCard({
      ...src, label: c.label, sub: c.sub || src.sub,
      sections: (src.sections || []).map((s: any) => ({ ...s, id: uid(), items: (s.items || []).map((it: any) => ({ ...it, id: uid() })) })),
    }));
  };

  const upSec = (si: number, fn: (s: any) => any) => setCard((c: any) => ({ ...c, sections: c.sections.map((s: any, i: number) => i === si ? fn(s) : s) }));
  const display = { ...card, label: name || "New card", sub: card.sub || name };

  const save = () => {
    const label = name.trim();
    if (!label) { setErr("Give the card a name."); return; }
    if (!card.sections.some((s: any) => ["deliverables", "packages"].includes(sectionKind(s)) && (s.items || []).length)) {
      setErr("Add at least one deliverable or package."); return;
    }
    // always a NEW card — base cards are never overwritten
    const slug = label.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "card";
    let key = `custom-${slug}`;
    for (let n = 2; rc[key] || BASE_CARD_KEYS.includes(key); n++) key = `custom-${slug}-${n}`;
    onSave(key, { ...card, label, sub: card.sub || label });
  };

  const panel = (
    <>
      <Lbl>Card name</Lbl>
      <I value={name} onChange={(e: any) => { setName(e.target.value); setErr(null); }} placeholder="e.g. Campaign Bundle" s={{ marginBottom: 12 }} />
      <Lbl>Start from</Lbl>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 14 }}>
        <Pill on={base === ""} onClick={() => startFrom("")}>Empty</Pill>
        {allKeys.map(k => <Pill key={k} on={base === k} onClick={() => startFrom(k)}>{cardTitle(rc, k)}</Pill>)}
      </div>
      {card.sections.map((sec: any, si: number) => {
        const kind = sectionKind(sec);
        const optionKind = kind === "usage" || kind === "exclusivity";
        const lib = optionKind ? [] : library(kind).filter((it: any) => !(sec.items || []).some((x: any) => x.n === it.n && x.p === it.p));
        return (
          <div key={sec.id || si} style={{ border: `1px solid ${C.rule}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10, background: C.white }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <I value={sec.t} onChange={(e: any) => upSec(si, s => ({ ...s, t: e.target.value }))} s={{ flex: 1 }} />
              <button onClick={() => setCard((c: any) => ({ ...c, sections: c.sections.filter((_: any, i: number) => i !== si) }))} title="Remove section" style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: TYPE.body.size, minWidth: 32, minHeight: 32 }}>✕</button>
            </div>
            <p style={{ fontSize: TYPE.micro.size, color: C.light, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px" }}>{KIND_LABEL[kind]}</p>
            {optionKind ? (
              <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: 0 }}>Percentages come from the card's {kind === "usage" ? "usage" : "exclusivity"} options (edit them after saving).</p>
            ) : (sec.items || []).map((it: any) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontSize: TYPE.label.size }}>{it.n}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: TYPE.label.size, color: C.muted, fontFamily: SERIF }}>{kind === "addons" ? addonPriceText(it) : it.p != null ? money(it.p) : it.m || ""}</span>
                  <button onClick={() => upSec(si, s => ({ ...s, items: s.items.filter((x: any) => x.id !== it.id) }))} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: TYPE.label.size, minWidth: 28, minHeight: 28 }}>✕</button>
                </span>
              </div>
            ))}
            {lib.length > 0 && (
              <S value="" onChange={(e: any) => { const it = lib.find((x: any) => `${x._from}|${x.id}` === e.target.value); if (it) { const { _from, ...clean } = it; upSec(si, s => ({ ...s, items: [...(s.items || []), { ...clean, id: uid() }] })); } }} s={{ marginTop: 8 }}>
                <option value="">+ Add item…</option>
                {lib.map((it: any) => <option key={`${it._from}|${it.id}`} value={`${it._from}|${it.id}`}>{it.n}{it.p != null ? ` — ${fmt(Number(it.p) || 0)}` : ""} · {it._from}</option>)}
              </S>
            )}
          </div>
        );
      })}
      <S value="" onChange={(e: any) => { const kind = e.target.value as SectionKind; if (kind) setCard((c: any) => ({ ...c, sections: [...c.sections, { id: uid(), t: KIND_LABEL[kind], kind, items: [] }] })); }}>
        <option value="">+ Add section…</option>
        {(Object.keys(KIND_LABEL) as SectionKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </S>
      {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "10px 0 0" }}>{err}</p>}
    </>
  );

  return (
    <>
      {askClose && (
        <ConfirmDialog title="Discard this card?" text="It hasn't been saved." okLabel="Discard" danger
          onOk={() => { setAskClose(false); onClose(); }} onCancel={() => setAskClose(false)} />
      )}
      <CardShell
        title="Add Rate Card"
        card={display}
        settings={settings}
        onClose={() => (name || card.sections.length ? setAskClose(true) : onClose())}
        panel={panel}
        footer={<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><B v="sec" onClick={() => (name || card.sections.length ? setAskClose(true) : onClose())}>Cancel</B><B onClick={save}>Save card</B></div>}
      />
    </>
  );
}

// ── Main ServiceCatalog component ─────────────────────────────
// ═════════════════════════════════════════════════════════════
// CATALOG — the compact price list (one screen + one item window)
//   chips (card colors) · white header box (icon in the card color)
//   deliverables / packages / lines as rows, rights and add-ons as tiles
//   tap → item window: read view → Edit → Save returns to the read view.
//   Nothing saves while typing; Delete asks; Move up / down.
//   Packages are built from deliverables: value and saving are calculated.
// ═════════════════════════════════════════════════════════════
const SVG = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICON = {
  camera:   "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8a4 4 0 0 0 0 8z",
  video:    "M3 7h12v10H3zM15 10l6-3v10l-6-3z",
  feather:  "M20 4c-7 0-13 5-14 13l-2 3M8 16h6M11 10c4 0 7-2 9-6",
  bed:      "M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 12a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3z",
  tag:      "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  photo:    "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4",
  gift:     "M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0",
  speaker:  "M4 10v4h3l5 4V6l-5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12",
  lock:     "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  sparkles: "M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18.5 14l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z",
  info:     "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  sliders:  "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  share:    "M12 15V3M8 7l4-4 4 4M5 12v8h14v-8",
};
const CARD_ICON: Record<string, string> = { influencer: ICON.camera, ugc: ICON.video, editorial: ICON.feather, hotels: ICON.bed };
const KIND_ICON: Record<string, string> = { deliverables: ICON.photo, packages: ICON.gift, usage: ICON.speaker, exclusivity: ICON.lock, addons: ICON.sparkles, info: ICON.info };
const KIND_NAME: Record<string, string> = { deliverables: "Deliverable", packages: "Package", addons: "Add-on", info: "Line", usage: "Usage right", exclusivity: "Exclusivity" };

// names compared loosely: "short-form videos" = "Short-form video"
const norm = (s: any) => String(s || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9äöüß ]/g, " ")
  .split(/\s+/).filter(Boolean).map(w => (w.length > 3 ? w.replace(/s$/, "") : w)).join(" ");
const delivsOf = (card: any) => (card?.sections || []).filter((s: any) => sectionKind(s) === "deliverables").flatMap((s: any) => s.items || []);
const contentsText = (it: any) => (it.includes || []).map((x: any) => `${x.qty || 1} × ${x.n}`).join(" + ");
function packValue(it: any, delivs: any[]) {
  const inc = Array.isArray(it?.includes) ? it.includes : [];
  if (!inc.length) return null;
  let value = 0, missing = 0;
  inc.forEach((x: any) => {
    const dv = delivs.find((d: any) => norm(d.n) === norm(x.n));
    if (dv && dv.p !== null && dv.p !== undefined) value += (Number(dv.p) || 0) * (Number(x.qty) || 1); else missing++;
  });
  const saves = value - (Number(it.p) || 0);
  return { value, saves, pct: value > 0 ? Math.round((saves / value) * 100) : 0, missing };
}
// the package's contents from its note, e.g. "2 short-form videos + Story set · instead of € 880"
// → [{ Short-form video × 2 }, { Story Set × 1 }] — only when every part matches a deliverable
function contentsFromNote(note: string, delivs: any[]): { includes: any[]; note: string } | null {
  const segs = String(note || "").split("·").map(s => s.trim()).filter(Boolean);
  if (!segs.length) return null;
  const includes: any[] = [];
  for (const part of segs[0].split("+").map(p => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s+(.+)$/);
    const qty = m ? parseInt(m[1]) : 1;
    const dv = delivs.find((d: any) => norm(d.n) === norm(m ? m[2] : part));
    if (!dv) return null;
    includes.push({ n: dv.n, qty });
  }
  return { includes, note: segs.slice(1).filter(s => !/^instead of/i.test(s)).join(" · ") };
}
// the Brand Ambassador line follows the retainer setting
const withRetainer = (text: string, pct: number) => String(text || "").replace(/(\d+(?:[.,]\d+)?)\s?%\s*off\s*\/\s*month/i, `${String(pct).replace(".", ",")} % off/month`);
// section name in the app list (the PDF keeps its numbering, e.g. "01 — ")
const secName = (t: string) => cleanSecT(t).replace(/^\s*\d+\s*[—–-]\s*/, "");
const optValue = (o: any) => (Number(o?.pct) > 0 ? `+${pctText(o.pct)}` : "included");
const LBLS: any = { fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8a847d", margin: "12px 0 5px" };
const SMALLT: any = { fontSize: 12, color: "#8a847d" };
const redLink: any = { background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.red, minHeight: 36, padding: "0 4px" };

// ── Item window (deliverable · package · add-on · line) ─────
function ItemWindow({ kind, item, card, cardName, isNew, onSave, onDelete, onMove, onClose }: any) {
  const clone = (x: any) => JSON.parse(JSON.stringify(x || {}));
  const [mode, setMode] = useState<"read" | "edit">(isNew ? "edit" : "read");
  const [d, setD] = useState<any>(() => clone(item));
  const [askDel, setAskDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (mode === "read") setD(clone(item)); }, [item, mode]);
  const delivs = delivsOf(card);
  const pv = kind === "packages" ? packValue(d, delivs) : null;
  const pct = retainerPctOf(card);
  const cancel = () => { setErr(null); if (isNew) onDelete(true); else { setD(clone(item)); setMode("read"); } };
  const save = () => {
    if (!String(d.n || "").trim()) { setErr("Add a name."); return; }
    onSave({ ...d, n: String(d.n).trim() }); setErr(null); setMode("read");
  };
  const up = (patch: any) => setD((x: any) => ({ ...x, ...patch }));
  const priceText = kind === "addons" ? addonPriceText(d) : kind === "info" ? pctSpace(d.m || "") : d.p !== null && d.p !== undefined ? money(d.p) : "";
  return (
    <Sheet title={`${KIND_NAME[kind] || "Item"} · ${cardName}`} onClose={mode === "edit" ? cancel : onClose}
      right={mode === "read" ? <PillBtn onClick={() => setMode("edit")}>Edit</PillBtn> : null}
      footer={mode === "edit" ? <>
        <PillBtn onClick={cancel} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark onClick={save} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>Save</PillBtn>
      </> : undefined}>
      {askDel && <ConfirmDialog title={`Delete "${item.n}"?`} text="It's removed from this rate card. Quotes already made keep their prices." okLabel="Delete" danger onOk={() => { setAskDel(false); onDelete(false); }} onCancel={() => setAskDel(false)} />}
      {mode === "read" ? <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: SERIF, fontSize: 20 }}>{pctSpace(item.n)}</span>
          <span style={{ fontFamily: SERIF, fontSize: 18, whiteSpace: "nowrap" as const }}>{priceText}</span>
        </div>
        {(item.note || kind === "info") && <div style={{ ...SMALLT, marginTop: 3 }}>{kind === "info" ? withRetainer(item.note, pct) : pctSpace(item.note)}</div>}
        {kind === "addons" && <div style={{ ...SMALLT, marginTop: 6 }}>{[item.perMonth ? "charged per month" : null, item.info ? "info only, not charged" : null].filter(Boolean).join(" · ") || "charged once"}</div>}
        {kind === "packages" && <>
          <div style={{ ...LBLS }}>Contents</div>
          {(item.includes || []).length ? (
            <ListCard>
              {(item.includes || []).map((x: any, i: number) => {
                const dv = delivs.find((dd: any) => norm(dd.n) === norm(x.n));
                return <Row key={i} first={i === 0} s={{ minHeight: 44 }} title={`${x.qty || 1} × ${x.n}`}
                  right={<span style={{ fontSize: 14 }}>{dv && dv.p !== null && dv.p !== undefined ? money((Number(dv.p) || 0) * (Number(x.qty) || 1)) : "—"}</span>} />;
              })}
            </ListCard>
          ) : <div style={{ fontSize: 13, color: PAL.waiting.ink }}>No contents yet — Edit to add them.</div>}
          {pv && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 40, padding: "0 12px", marginTop: 8, borderRadius: 10, fontSize: 13,
            background: pv.saves > 0 ? PAL.done.wash : PAL.neutral.wash, color: pv.saves > 0 ? PAL.done.ink : PAL.neutral.ink }}>
            <span>Value {money(pv.value)}</span><span>{pv.saves > 0 ? `saves ${money(pv.saves)} · ${pv.pct} %` : "no saving"}</span>
          </div>}
        </>}
        {(kind === "deliverables" || kind === "packages") && <div style={{ ...SMALLT, marginTop: 12 }}>Shown as a tile in the Calculator · {cardName}</div>}
      </> : <>
        <div style={{ display: "grid", gridTemplateColumns: kind === "info" || kind === "addons" ? "1fr" : "minmax(0,1.4fr) minmax(0,1fr)", gap: 8 }}>
          <div><div style={{ ...LBLS, marginTop: 0 }}>Name</div><I value={d.n || ""} onChange={(e: any) => up({ n: e.target.value })} aria-label="Name" /></div>
          {(kind === "deliverables" || kind === "packages") && <div><div style={{ ...LBLS, marginTop: 0 }}>Price</div><NumField value={d.p ?? null} onChange={(n) => up({ p: n === null ? null : Math.max(0, n) })} ariaLabel="Price" /></div>}
        </div>
        {kind === "addons" && (
          <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: 8 }}>
            <div><div style={LBLS}>Charged as</div>
              <S value={d.pct !== null && d.pct !== undefined && (d.p === null || d.p === undefined) ? "pct" : "eur"} aria-label="Charged as"
                onChange={(e: any) => up(e.target.value === "pct" ? { pct: d.pct ?? 30, p: null } : { p: d.p ?? 50, pct: null })}>
                <option value="eur">€</option><option value="pct">%</option>
              </S></div>
            <div><div style={LBLS}>{d.p !== null && d.p !== undefined ? "Price" : "Percent"}</div>
              <NumField minDec={d.p !== null && d.p !== undefined ? 2 : 0} value={d.p !== null && d.p !== undefined ? d.p : (d.pct ?? null)} ariaLabel="Add-on price"
                onChange={(n) => { const v = Math.max(0, n || 0); up(d.p !== null && d.p !== undefined ? { p: v } : { pct: v }); }} /></div>
          </div>
        )}
        {kind === "info" && <><div style={LBLS}>Text on the right</div><I value={d.m || ""} onChange={(e: any) => up({ m: e.target.value })} aria-label="Text on the right" /></>}
        <div style={LBLS}>Note</div><I value={d.note || ""} onChange={(e: any) => up({ note: e.target.value })} aria-label="Note" />
        {kind === "addons" && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginTop: 6 }}>
            <span style={{ display: "flex", alignItems: "center" }}><Switch on={!!d.perMonth} onChange={v => up({ perMonth: v })} label="Per month" /><span style={{ fontSize: 13 }}>Per month</span></span>
            <span style={{ display: "flex", alignItems: "center" }}><Switch on={!!d.info} onChange={v => up({ info: v })} label="Info only" /><span style={{ fontSize: 13 }}>Info only (not charged)</span></span>
          </div>
        )}
        {kind === "packages" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", ...LBLS }}>
            <span>Contents</span>{pv && <span style={{ letterSpacing: 0, textTransform: "none" as const, fontSize: 12, color: pv.saves > 0 ? PAL.done.ink : "#8a847d" }}>value {money(pv.value)}{pv.saves > 0 ? ` · saves ${pv.pct} %` : ""}</span>}
          </div>
          {(d.includes || []).map((x: any, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "116px minmax(0,1fr) auto", alignItems: "center", gap: 8, marginTop: i ? 6 : 0 }}>
              <Stepper value={Number(x.qty) || 1} onChange={v => up({ includes: d.includes.map((y: any, j: number) => (j === i ? { ...y, qty: v } : y)) })} label={`${x.n} quantity`} />
              <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{x.n}</span>
              <button onClick={() => up({ includes: d.includes.filter((_: any, j: number) => j !== i) })} style={redLink}>Remove</button>
            </div>
          ))}
          {delivs.length > 0 && (
            <S value="" aria-label="Add content" s={{ marginTop: 6 }} onChange={(e: any) => { const n = e.target.value; if (n) up({ includes: [...(d.includes || []), { n, qty: 1 }] }); }}>
              <option value="">+ Add content</option>
              {delivs.map((dv: any) => <option key={dv.id || dv.n} value={dv.n}>{dv.n}</option>)}
            </S>
          )}
        </>}
        {err && <div style={{ fontSize: 12, color: PAL.late.ink, marginTop: 8 }}>{err}</div>}
        {!isNew && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <span style={{ display: "flex", gap: 6 }}><PillBtn onClick={() => onMove(-1)}>↑ Up</PillBtn><PillBtn onClick={() => onMove(1)}>↓ Down</PillBtn></span>
            <button onClick={() => setAskDel(true)} style={redLink}>Delete…</button>
          </div>
        )}
      </>}
    </Sheet>
  );
}

// ── Option window (usage right · exclusivity) ───────────────
function OptWindow({ kind, opt, cardName, isNew, onSave, onDelete, onMove, onClose }: any) {
  const [mode, setMode] = useState<"read" | "edit">(isNew ? "edit" : "read");
  const [d, setD] = useState<any>(() => ({ l: optName(opt?.l), mo: Number(opt?.mo) || 0, pct: Number(opt?.pct) || 0 }));
  const [askDel, setAskDel] = useState(false);
  useEffect(() => { if (mode === "read") setD({ l: optName(opt?.l), mo: Number(opt?.mo) || 0, pct: Number(opt?.pct) || 0 }); }, [opt, mode]);
  const cancel = () => { if (isNew) onDelete(true); else setMode("read"); };
  const save = () => { if (!String(d.l || "").trim()) return; onSave({ l: String(d.l).trim(), mo: d.mo, pct: d.pct }); setMode("read"); };
  return (
    <Sheet title={`${KIND_NAME[kind]} · ${cardName}`} onClose={mode === "edit" ? cancel : onClose}
      right={mode === "read" ? <PillBtn onClick={() => setMode("edit")}>Edit</PillBtn> : null}
      footer={mode === "edit" ? <>
        <PillBtn onClick={cancel} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark onClick={save} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>Save</PillBtn>
      </> : undefined}>
      {askDel && <ConfirmDialog title={`Delete "${optName(opt?.l)}"?`} text="It's removed from this rate card. Quotes and licenses already made keep theirs." okLabel="Delete" danger onOk={() => { setAskDel(false); onDelete(false); }} onCancel={() => setAskDel(false)} />}
      {mode === "read" ? <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: SERIF, fontSize: 20 }}>{optName(opt?.l)}</span>
          <span style={{ fontFamily: SERIF, fontSize: 18 }}>{optValue(opt)}</span>
        </div>
        <div style={{ ...SMALLT, marginTop: 3 }}>{Number(opt?.mo) ? `${opt.mo} ${Number(opt.mo) === 1 ? "month" : "months"}` : "no time limit"} · used by the Calculator, the PDFs and renewals</div>
      </> : <>
        <div style={{ ...LBLS, marginTop: 0 }}>Name</div><I value={d.l} onChange={(e: any) => setD((x: any) => ({ ...x, l: e.target.value }))} aria-label="Name" />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
          <div><div style={LBLS}>Months</div><Stepper value={d.mo} min={0} onChange={v => setD((x: any) => ({ ...x, mo: v }))} label="Months" /></div>
          <div><div style={LBLS}>Surcharge (%)</div><NumField minDec={0} value={d.pct} onChange={(n) => setD((x: any) => ({ ...x, pct: Math.max(0, n || 0) }))} ariaLabel="Surcharge in percent" /></div>
        </div>
        <div style={{ ...SMALLT, marginTop: 6 }}>0 % = included.</div>
        {!isNew && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <span style={{ display: "flex", gap: 6 }}><PillBtn onClick={() => onMove(-1)}>↑ Up</PillBtn><PillBtn onClick={() => onMove(1)}>↓ Down</PillBtn></span>
            <button onClick={() => setAskDel(true)} style={redLink}>Delete…</button>
          </div>
        )}
      </>}
    </Sheet>
  );
}

// ── Card settings window (name · subtitle · fine print · retainer · sections) ──
function CardWindow({ card, cardKey, cardName, onSave, onDeleteCard, onClose }: any) {
  const pick = (c: any) => ({ label: c.label || "", sub: c.sub || "", fine: c.fine || "", retainerPct: retainerPctOf(c), sections: JSON.parse(JSON.stringify(c.sections || [])) });
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [d, setD] = useState<any>(() => pick(card));
  const [askSec, setAskSec] = useState<number | null>(null);
  const [askCard, setAskCard] = useState(false);
  useEffect(() => { if (mode === "read") setD(pick(card)); }, [card, mode]);
  const moveSec = (i: number, dir: number) => setD((x: any) => {
    const s = [...x.sections]; const j = i + dir; if (j < 0 || j >= s.length) return x;
    [s[i], s[j]] = [s[j], s[i]]; return { ...x, sections: s };
  });
  const custom = !BASE_CARD_KEYS.includes(cardKey);
  return (
    <Sheet title={`Card settings · ${cardName}`} onClose={mode === "edit" ? () => setMode("read") : onClose}
      right={mode === "read" ? <PillBtn onClick={() => setMode("edit")}>Edit</PillBtn> : null}
      footer={mode === "edit" ? <>
        <PillBtn onClick={() => setMode("read")} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark onClick={() => { onSave(d); setMode("read"); }} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>Save</PillBtn>
      </> : undefined}>
      {askSec !== null && <ConfirmDialog title={`Remove "${cleanSecT(d.sections[askSec]?.t)}"?`} text="The section and its items are removed when you save." okLabel="Remove" danger
        onOk={() => { const i = askSec; setAskSec(null); setD((x: any) => ({ ...x, sections: x.sections.filter((_: any, j: number) => j !== i) })); }} onCancel={() => setAskSec(null)} />}
      {askCard && <ConfirmDialog title={`Delete "${cardName}"?`} text="This rate card is removed. Quotes already made keep their prices." okLabel="Delete" danger onOk={() => { setAskCard(false); onDeleteCard(); }} onCancel={() => setAskCard(false)} />}
      {mode === "read" ? <>
        <ListCard>
          <Row first title="Name on the PDF" meta={card.label || cardName} />
          <Row title="Subtitle" meta={card.sub || "—"} />
          <Row title="Retainer discount" meta={`−${String(retainerPctOf(card)).replace(".", ",")} % per month · the Calculator and the Brand Ambassador line use it`} />
          <Row title="Fine print" meta={card.fine ? pctSpace(card.fine) : "—"} />
        </ListCard>
        <div style={LBLS}>Sections · {(card.sections || []).length}</div>
        <div style={{ ...SMALLT, lineHeight: 1.6 }}>{(card.sections || []).map((s: any) => cleanSecT(s.t)).join(" · ")}</div>
      </> : <>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
          <div><div style={{ ...LBLS, marginTop: 0 }}>Name on the PDF</div><I value={d.label} onChange={(e: any) => setD((x: any) => ({ ...x, label: e.target.value }))} aria-label="Name on the PDF" /></div>
          <div><div style={{ ...LBLS, marginTop: 0 }}>Retainer discount (%)</div><NumField minDec={0} value={d.retainerPct} onChange={(n) => setD((x: any) => ({ ...x, retainerPct: n === null ? 20 : Math.max(0, Math.min(90, n)) }))} ariaLabel="Retainer discount in percent" /></div>
        </div>
        <div style={LBLS}>Subtitle</div><I value={d.sub} onChange={(e: any) => setD((x: any) => ({ ...x, sub: e.target.value }))} aria-label="Subtitle" />
        <div style={LBLS}>Fine print</div>
        <textarea value={d.fine} onChange={(e: any) => setD((x: any) => ({ ...x, fine: e.target.value }))} aria-label="Fine print"
          style={{ width: "100%", minHeight: 80, padding: "8px 10px", border: "1px solid #ebe7e2", borderRadius: 10, background: C.white, fontFamily: SANS, fontSize: 16, color: C.black, boxSizing: "border-box" as const, resize: "vertical" as const }} />
        <div style={LBLS}>Sections</div>
        {d.sections.map((s: any, i: number) => (
          <div key={s.id || i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", alignItems: "center", gap: 4, marginTop: i ? 6 : 0 }}>
            <I value={s.t || ""} onChange={(e: any) => setD((x: any) => ({ ...x, sections: x.sections.map((y: any, j: number) => (j === i ? { ...y, t: e.target.value } : y)) }))} aria-label={`Section ${i + 1} name`} />
            <button onClick={() => moveSec(i, -1)} aria-label="Move section up" style={{ width: 36, height: 40, background: "none", border: "none", cursor: "pointer", color: "#8a847d", fontSize: 15 }}>↑</button>
            <button onClick={() => moveSec(i, 1)} aria-label="Move section down" style={{ width: 36, height: 40, background: "none", border: "none", cursor: "pointer", color: "#8a847d", fontSize: 15 }}>↓</button>
            <button onClick={() => setAskSec(i)} aria-label="Remove section" style={{ width: 36, height: 40, background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 15 }}>✕</button>
          </div>
        ))}
        <S value="" aria-label="Add a section" s={{ marginTop: 8 }} onChange={(e: any) => { const k = e.target.value as SectionKind; if (k) setD((x: any) => ({ ...x, sections: [...x.sections, { id: uid(), t: KIND_LABEL[k], kind: k, items: [] }] })); }}>
          <option value="">+ Add a section…</option>
          {(Object.keys(KIND_LABEL) as SectionKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </S>
        {custom && <div style={{ marginTop: 14, textAlign: "right" as const }}><button onClick={() => setAskCard(true)} style={redLink}>Delete this rate card…</button></div>}
      </>}
    </Sheet>
  );
}

interface ServiceCatalogProps {
  rc:         any;
  upsertCard: (key: string, card: any) => Promise<string | null>;
  deleteCard: (key: string) => Promise<string | null>;
  settings:   any;
  isMobile?:  boolean;
}

type Win = { type: "item"; si: number; id: string; isNew?: boolean } | { type: "opt"; kind: "usage" | "exclusivity"; i: number; isNew?: boolean } | { type: "card" };

export default function ServiceCatalog({ rc, upsertCard, deleteCard, settings }: ServiceCatalogProps) {
  const [tab,         setTab]         = useState("influencer");
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [win,         setWin]         = useState<Win | null>(null);
  const [filled,      setFilled]      = useState<string[] | null>(null);
  useEffect(() => (win ? editLock.acquire() : undefined), [win]);   // no reload while a window is open

  const tabs = [...BASE_CARD_KEYS.filter(k => rc[k]), ...Object.keys(rc).filter(k => !BASE_CARD_KEYS.includes(k) && rc[k]?.label).sort()];
  const card = normalizeCard(rc[tab] || rc.influencer);
  const cardName = cardTitle(rc, tab);
  const tone = cardTone(tab);

  // once: packages that only describe their contents in the note get real contents
  const filledOnce = useRef(false);
  useEffect(() => {
    if (filledOnce.current || !Object.keys(rc || {}).length) return;
    filledOnce.current = true;
    const names: string[] = [];
    Object.entries(rc).forEach(([key, raw]: [string, any]) => {
      const c = normalizeCard(raw); if (!c?.sections) return;
      const delivs = delivsOf(c); let changed = false;
      const sections = c.sections.map((s: any) => sectionKind(s) !== "packages" ? s : ({
        ...s, items: (s.items || []).map((it: any) => {
          if ((it.includes || []).length) return it;
          const got = contentsFromNote(it.note, delivs);
          if (!got) return it;
          changed = true; names.push(`${cardTitle(rc, key)} · ${it.n}`);
          return { ...it, includes: got.includes, note: got.note };
        }),
      }));
      if (changed) upsertCard(key, { ...c, sections });
    });
    if (names.length) setFilled(names);
  }, [rc]);

  const setCard = (fn: (c: any) => any) => upsertCard(tab, fn(card));
  const upSec   = (si: number, fn: (s: any) => any) => setCard(c => ({ ...c, sections: c.sections.map((s: any, i: number) => (i === si ? fn(s) : s)) }));
  const optKey  = (kind: string) => (kind === "usage" ? "usage" : "excl");
  const moveIn  = (arr: any[], i: number, dir: number) => { const a = [...arr]; const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const addItem = (si: number, kind: SectionKind) => {
    const id = uid();
    const blank = kind === "addons" ? { id, n: "", note: "", p: 50, pct: null, perMonth: false, info: false }
      : kind === "info" ? { id, n: "", note: "", p: null, m: "" }
      : kind === "packages" ? { id, n: "", note: "", p: 0, includes: [] }
      : { id, n: "", note: "", p: 0 };
    upSec(si, s => ({ ...s, items: [...(s.items || []), blank] }));
    setWin({ type: "item", si, id, isNew: true });
  };
  const addOpt = (kind: "usage" | "exclusivity") => {
    const list = card[optKey(kind)] || [];
    setCard(c => ({ ...c, [optKey(kind)]: [...(c[optKey(kind)] || []), { l: "", pct: 0, mo: 1 }] }));
    setWin({ type: "opt", kind, i: list.length, isNew: true });
  };

  // ── header numbers ──
  const delivs = delivsOf(card);
  const packs = card.sections.filter((s: any) => sectionKind(s) === "packages").flatMap((s: any) => s.items || []);
  const prices = delivs.map((it: any) => Number(it.p)).filter((p: number) => p > 0);
  const bestSave = Math.max(0, ...packs.map((it: any) => packValue(it, delivs)?.pct || 0));
  const retPct = retainerPctOf(card);

  // ── the open window ──
  let windowEl: any = null;
  if (win?.type === "item") {
    const sec = card.sections[win.si]; const kind = sec ? sectionKind(sec) : "deliverables";
    const item = (sec?.items || []).find((x: any) => x.id === win.id);
    if (item) windowEl = (
      <ItemWindow key={win.id} kind={kind} item={item} card={card} cardName={cardName} isNew={!!win.isNew}
        onSave={(next: any) => { upSec(win.si, s => ({ ...s, items: s.items.map((x: any) => (x.id === win.id ? next : x)) })); setWin({ ...win, isNew: false }); }}
        onDelete={() => { upSec(win.si, s => ({ ...s, items: s.items.filter((x: any) => x.id !== win.id) })); setWin(null); }}
        onMove={(dir: number) => upSec(win.si, s => ({ ...s, items: moveIn(s.items, s.items.findIndex((x: any) => x.id === win.id), dir) }))}
        onClose={() => setWin(null)} />
    );
  } else if (win?.type === "opt") {
    const list = card[optKey(win.kind)] || [];
    const opt = list[win.i];
    if (opt) windowEl = (
      <OptWindow key={`${win.kind}-${win.i}`} kind={win.kind} opt={opt} cardName={cardName} isNew={!!win.isNew}
        onSave={(next: any) => { setCard(c => ({ ...c, [optKey(win.kind)]: c[optKey(win.kind)].map((o: any, j: number) => (j === win.i ? { ...o, ...next } : o)) })); setWin({ ...win, isNew: false }); }}
        onDelete={() => { setCard(c => ({ ...c, [optKey(win.kind)]: c[optKey(win.kind)].filter((_: any, j: number) => j !== win.i) })); setWin(null); }}
        onMove={(dir: number) => {
          const real = list.map((o: any, j: number) => ({ o, j })).filter((x: any) => !x.o.sentinel);
          const pos = real.findIndex((x: any) => x.j === win.i); const to = real[pos + dir];
          if (!to) return;
          setCard(c => ({ ...c, [optKey(win.kind)]: moveIn(c[optKey(win.kind)], win.i, to.j - win.i) }));
          setWin({ ...win, i: to.j });
        }}
        onClose={() => setWin(null)} />
    );
  } else if (win?.type === "card") {
    windowEl = (
      <CardWindow card={card} cardKey={tab} cardName={cardName}
        onSave={(d: any) => setCard(c => ({ ...c, label: d.label, sub: d.sub, fine: d.fine, retainerPct: d.retainerPct, sections: d.sections }))}
        onDeleteCard={() => { setWin(null); deleteCard(tab); setTab("influencer"); }}
        onClose={() => setWin(null)} />
    );
  }

  const iconDot = (d: string, size = 22) => (
    <span style={{ width: size, height: size, borderRadius: "50%", background: tone.wash, color: tone.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SVG d={d} size={Math.round(size * 0.55)} /></span>
  );
  const addLink = (onClick: () => void, label: string) => (
    <button onClick={onClick} aria-label={label} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 11, color: "#6b655e", padding: "0 2px", minHeight: 30 }}>+ Add</button>
  );
  const tile = (key: string, name: string, value: string, onClick: () => void) => (
    <button key={key} onClick={onClick} style={{ background: C.white, border: "1px solid #efebe6", borderRadius: 10, minHeight: DENSITY.tile, padding: "6px 10px", textAlign: "left" as const, cursor: "pointer", fontFamily: SANS, color: C.black, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 13, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      <span style={{ display: "block", fontSize: 12, color: "#8a847d", marginTop: 2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </button>
  );
  const amount = (t: string) => <span style={{ fontFamily: SERIF, fontSize: 15, whiteSpace: "nowrap" as const }}>{t}</span>;

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      {windowEl}
      {showBuilder && <AddCardModal rc={rc} settings={settings} onSave={(key: string, built: any) => { upsertCard(key, built); setTab(key); setShowBuilder(false); }} onClose={() => setShowBuilder(false)} />}
      {showPreview && <RateCardPreview card={card} settings={settings} onSave={(saved: any) => upsertCard(tab, saved)} onClose={() => setShowPreview(false)} />}

      {/* ── TITLE ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Service Catalog</h2>
        <PillBtn onClick={() => setShowPreview(true)}><SVG d={ICON.share} size={13} />Rate card PDF</PillBtn>
      </div>
      <SummaryLine dot={PAL.neutral.mid}>{tabs.length} rate cards · <Strong>the Calculator's price list</Strong></SummaryLine>

      {/* ── CARDS (chips in the card colors) ── */}
      <ChipRow s={{ marginTop: 12 }}>
        {tabs.map(k => <Chip key={k} on={tab === k} tone={cardTone(k)} label={cardTitle(rc, k)} onClick={() => { setTab(k); setWin(null); }} />)}
        <Chip on={false} tone={PAL.neutral} dot={false} label="+ Card" onClick={() => setShowBuilder(true)} />
      </ChipRow>

      {filled && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: PAL.done.wash, color: PAL.done.ink, borderRadius: 12, padding: "8px 6px 8px 12px", marginTop: 10, fontSize: 12 }}>
          <span>Contents filled in for {filled.length} {filled.length === 1 ? "package" : "packages"} from their notes — please check them.</span>
          <button onClick={() => setFilled(null)} aria-label="Dismiss" style={{ background: "none", border: "none", width: 36, height: 36, cursor: "pointer", color: PAL.done.ink }}>✕</button>
        </div>
      )}

      {/* ── HEADER BOX (white, icon in the card color) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.white, border: "1px solid #efebe6", borderRadius: 14, padding: "11px 12px", marginTop: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: "50%", background: tone.fill, color: tone.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SVG d={CARD_ICON[tab] || ICON.tag} size={18} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>{cardName}</div>
          <div style={{ ...SMALLT, marginTop: 2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
            {delivs.length} {delivs.length === 1 ? "deliverable" : "deliverables"}{packs.length ? ` · ${packs.length} ${packs.length === 1 ? "package" : "packages"}` : ""}
            {bestSave > 0 && <span style={{ color: PAL.done.ink }}> · up to −{bestSave} %</span>}
          </div>
        </div>
        {prices.length > 0 && <div style={{ textAlign: "right" as const, flexShrink: 0 }}><div style={{ ...SMALLT, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>from</div>{amount(money(Math.min(...prices)))}</div>}
      </div>

      {/* ── SECTIONS ── */}
      {card.sections.map((sec: any, si: number) => {
        const kind = sectionKind(sec);
        const isOpt = kind === "usage" || kind === "exclusivity";
        const opts = isOpt ? (card[optKey(kind)] || []).map((o: any, i: number) => ({ o, i })).filter((x: any) => !x.o.sentinel) : [];
        const items = sec.items || [];
        const count = isOpt ? opts.length : items.length;
        return (
          <div key={sec.id || si}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: `${DENSITY.sectionTop}px 4px ${DENSITY.sectionBottom}px` }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#8a847d" }}>
                {iconDot(KIND_ICON[kind] || ICON.info)}{secName(sec.t)} · {count}
              </span>
              {addLink(() => (isOpt ? addOpt(kind as any) : addItem(si, kind)), `Add to ${secName(sec.t)}`)}
            </div>
            {isOpt ? (
              opts.length ? <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: DENSITY.tileGap }}>
                {opts.map(({ o, i }: any) => tile(`${kind}-${i}`, optName(o.l), optValue(o), () => setWin({ type: "opt", kind: kind as any, i })))}
              </div> : <div style={{ ...SMALLT, padding: "4px 4px 0" }}>Nothing yet — tap + Add.</div>
            ) : kind === "addons" ? (
              items.length ? <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: DENSITY.tileGap }}>
                {items.map((it: any) => tile(it.id, pctSpace(it.n), `${addonPriceText(it)}${it.info ? " · info" : ""}`, () => setWin({ type: "item", si, id: it.id })))}
              </div> : <div style={{ ...SMALLT, padding: "4px 4px 0" }}>Nothing yet — tap + Add.</div>
            ) : items.length ? (
              <ListCard>
                {items.map((it: any, i: number) => {
                  const pv = kind === "packages" ? packValue(it, delivs) : null;
                  const meta = kind === "packages"
                    ? ((it.includes || []).length
                        ? <>{contentsText(it)}{pv && pv.saves > 0 && <span style={{ color: PAL.done.ink }}> · saves {pv.pct} %</span>}</>
                        : <>{pctSpace(it.note) || ""}<span style={{ color: PAL.waiting.ink }}>{it.note ? " · " : ""}add contents</span></>)
                    : kind === "info" ? withRetainer(it.note, retPct) : pctSpace(it.note || "");
                  const right = kind === "info" ? (it.m ? <span style={{ fontSize: 13, color: "#8a847d" }}>{pctSpace(it.m)}</span> : null)
                    : it.p !== null && it.p !== undefined ? amount(money(it.p)) : <span style={{ fontSize: 13, color: "#8a847d" }}>{pctSpace(it.m || "")}</span>;
                  return <Row key={it.id || i} first={i === 0} chevron={false} onClick={() => setWin({ type: "item", si, id: it.id })}
                    title={pctSpace(it.n) || "Untitled"} meta={meta || undefined} right={right} />;
                })}
              </ListCard>
            ) : <div style={{ ...SMALLT, padding: "4px 4px 0" }}>Nothing yet — tap + Add.</div>}
          </div>
        );
      })}

      {/* ── CARD SETTINGS ── */}
      <SectionHead label="Card settings" />
      <ListCard>
        <Row first onClick={() => setWin({ type: "card" })}
          icon={iconDot(ICON.sliders, 30)}
          title={card.label || cardName}
          meta={`Retainer −${String(retPct).replace(".", ",")} % per month${card.sub ? ` · ${card.sub}` : ""}`} />
      </ListCard>
    </div>
  );
}
