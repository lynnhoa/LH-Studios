// ─────────────────────────────────────────────────────────────
// DocPages — one renderer for every document PDF
// A4 pages with header + footer, page-break guards for table rows,
// clauses and the signature block. Used by the document modal
// (visible) and by bulk download (rendered off-screen).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, createElement } from "react";
import { C } from "./constants";
import A4Document, { senderOf } from "./A4Document";
import type { DocView } from "./docs";

export const PAGE_H = 841;

interface DocPagesProps {
  doc:       DocView;
  settings:  any;
  client?:   any;
  lang:      string;
  scale?:    number;
  shadow?:   boolean;
}

export default function DocPages({ doc, settings, client, lang, scale = 1, shadow = true }: DocPagesProps) {
  const [docHeight,      setDocHeight]      = useState(PAGE_H);
  const [extraSigMargin, setExtraSigMargin] = useState(0);
  const [clauseGuards,   setClauseGuards]   = useState<number[]>([]);
  const [tRowGuards,     setTRowGuards]     = useState<number[]>([]);
  const docRef = useRef<HTMLDivElement>(null);

  const s         = senderOf(doc, settings);
  const isDE      = lang === "de";
  const isInvoice = doc.kind === "invoice";
  const isDraft   = doc.status === "draft";
  const numPages  = Math.max(1, Math.ceil(docHeight / PAGE_H));

  // ── Pagination + page-break guards ─────────────────────────
  useEffect(() => {
    setClauseGuards([]);
    setTRowGuards([]);
    setExtraSigMargin(0);
    const el = docRef.current;
    if (!el) return;

    const calc = () => {
      setDocHeight(el.scrollHeight || PAGE_H);

      // Signature / totals block never splits across pages
      const sigEl = el.querySelector("[data-sig-anchor]") as HTMLElement | null;
      if (sigEl) {
        const sigTop    = sigEl.offsetTop;
        const GUARD     = 200;
        const HEADER_H  = 49;
        const pageNum   = Math.floor(sigTop / PAGE_H);
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
      }

      // Contract clauses
      const clauseEls = Array.from(el.querySelectorAll("[data-clause]")) as HTMLElement[];
      if (clauseEls.length > 0) {
        const next = Array(clauseEls.length).fill(0);
        const guarded = new Set<number>();
        clauseEls.forEach((cEl, idx) => {
          const bottom  = cEl.offsetTop + cEl.offsetHeight;
          const pageNum = Math.floor(cEl.offsetTop / PAGE_H);
          if (bottom - pageNum * PAGE_H > PAGE_H - 100 && !guarded.has(pageNum)) {
            next[idx] = Math.max(0, PAGE_H + 72 - cEl.offsetTop - 10);
            guarded.add(pageNum);
          }
        });
        setClauseGuards(prev => {
          if (prev.length !== next.length) return next;
          const merged = next.map((v, i) => Math.max(v, prev[i]));
          return merged.some((v, i) => v !== prev[i]) ? merged : prev;
        });
      }

      // Table rows
      const rowEls = Array.from(el.querySelectorAll("[data-trow]")) as HTMLElement[];
      if (rowEls.length > 0) {
        const next = Array(rowEls.length).fill(0);
        const guarded = new Set<number>();
        rowEls.forEach(rowEl => {
          const idx     = parseInt(rowEl.getAttribute("data-trow") || "0", 10);
          const bottom  = rowEl.offsetTop + rowEl.offsetHeight;
          const pageNum = Math.floor(rowEl.offsetTop / PAGE_H);
          if (bottom - pageNum * PAGE_H > PAGE_H - 80 && !guarded.has(pageNum)) {
            next[idx] = Math.max(0, PAGE_H + 72 - rowEl.offsetTop);
            guarded.add(pageNum);
          }
        });
        setTRowGuards(prev => {
          if (prev.length !== next.length) return next;
          const merged = next.map((v, i) => Math.max(v, prev[i]));
          return merged.some((v, i) => v !== prev[i]) ? merged : prev;
        });
      }
    };

    calc();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc, lang, settings, client]);

  const headerRight = isDraft
    ? (isDE ? "ENTWURF" : "DRAFT")
    : ((doc.data || {}).ctype || "Content Creator");

  return (
    <>
      {Array.from({ length: numPages }, (_, i) => (
        <div key={i} style={{ width: 595 * scale, height: PAGE_H * scale, overflow: "hidden", flexShrink: 0, boxShadow: shadow ? "0 4px 24px rgba(0,0,0,0.28)" : "none" }}>
          <div
            data-pdf-page="true"
            style={{ width: 595, height: PAGE_H, overflow: "hidden", background: C.bg, position: "relative", transform: scale < 1 ? `scale(${scale})` : "none", transformOrigin: "top left" }}
          >
            {/* A4 content — offset by page index */}
            <div ref={i === 0 ? docRef : undefined} style={{ position: "absolute", top: -i * PAGE_H, left: 0, width: 595 }}>
              <A4Document
                doc={doc} lang={lang} settings={settings} client={client}
                extraSigMargin={extraSigMargin}
                clauseGuards={clauseGuards}
                tRowGuards={tRowGuards}
              />
            </div>

            {/* Footer mask (hides overflow below the last line) */}
            <div style={{ position: "absolute", bottom: isInvoice ? 64 : 59, left: 0, right: 0, height: 28, background: C.bg, zIndex: 2, pointerEvents: "none" }} />

            {/* Header */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: C.bg, zIndex: 3, borderBottom: `1px solid ${C.rule}` }}>
              <div style={{ padding: "13px 62px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 6, letterSpacing: "0.2em", color: C.light, textTransform: "uppercase" as const }}>{s.company || s.name || "Lynn Hoa"}</span>
                <span style={{ fontSize: 6, letterSpacing: "0.2em", color: isDraft ? C.amber : C.light, textTransform: "uppercase" as const }}>{headerRight}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, zIndex: 3, borderTop: `1px solid ${C.rule}` }}>
              {isInvoice ? (
                <div style={{ padding: "12px 62px 18px", display: "flex", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 7, color: C.muted, lineHeight: 1.5, flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
                    <div style={{ fontWeight: 500, color: C.black }}>{s.company || s.name || "Your Company"}</div>
                    {s.email   && <div>{s.email}</div>}
                    {s.website && <div>{s.website}</div>}
                    {s.steuernummer && <div style={{ marginTop: 4 }}>{isDE ? "St.-Nr." : "Tax No."} {s.steuernummer}</div>}
                    {s.ustIdNr && <div>{isDE ? "USt-IdNr." : "VAT ID"} {s.ustIdNr}</div>}
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
                  <span>{[s.email, s.website].filter(Boolean).join(" · ")}</span>
                  {numPages > 1 && <span style={{ letterSpacing: "0.04em", color: C.light }}>{i + 1}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
