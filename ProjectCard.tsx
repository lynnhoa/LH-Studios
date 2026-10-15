// ─────────────────────────────────────────────────────────────
// ProjectCard — read-only project card in the Clients tab
// Documents open read-only; all actions live in the Projects tab.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, addM, today } from "./formatters";
import { B, StatusBadge } from "./atoms";
import PDFModal from "./PDFModal";
import { sortDocs, docLabel } from "./docs";
import type { DocRecord } from "./types";

interface ProjectCardProps {
  pr:               any;
  cl:               any;
  clients:          any[];
  isMobile:         boolean;
  settings:         any;
  rc:               any;
  clientsHook:      any;
  onRevise:         (pr: any, cl: any) => void;
  onAmend:          (pr: any, cl: any) => void;
  highlighted?:     boolean;
  onClearHighlight?:() => void;
  showClientName?:  boolean;
  readOnly?:        boolean;  // NEW: ClientDetail (read-only) vs ProjectsTab (editable)
}

function scol(s: string): string {
  return ({ invoiced: C.amber, contracted: C.muted, quoted: C.light, revised: "#b8a090", production: "#8fa89a", paid: C.green, lead: C.light }[s] ?? C.light);
}

// ── License tracker mini ──────────────────────────────────
function LicenseLine({ label, end }: { label: string; end: string }) {
  const d = Math.ceil((new Date(end).getTime() - new Date().getTime()) / 864e5);
  const expired  = d < 0;
  const expiring = !expired && d <= 7;
  const col = expired ? C.red : expiring ? C.amber : C.green;
  const bg  = expired ? "#fdf0f0" : expiring ? "#fdf6ee" : "#f0f5f0";
  const bd  = expired ? C.red    : expiring ? C.amber   : C.green;
  const txt = expired ? `+${Math.abs(d)}d expired` : expiring ? `${d}d left` : `${d}d`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: bg, border: `1px solid ${bd}`, borderRadius: 2, marginBottom: 3 }}>
      <span style={{ fontSize: TYPE.micro.size, color: col, fontWeight: "500" }}>{label}</span>
      <span style={{ fontSize: TYPE.micro.size, color: col, fontWeight: "600" }}>{fmtD(end)} · {txt}</span>
    </div>
  );
}

function ProjectLicenseTracker({ pr }: { pr: any }) {
  if (!pr || !pr.qd) return null;
  const lines = pr.qd?.lines || [];
  let mo: number | null = pr.qd?.mo && pr.qd.mo > 0 ? pr.qd.mo : null;
  if (!mo) {
    for (const l of lines) {
      const m = l.usageLabel ? String(l.usageLabel).match(/(\d+)\s*month/i) : null;
      if (m) { mo = parseInt(m[1]); break; }
    }
  }
  const originalUsageEnd = pr.usageEndOverride || (pr.deliveryDate && mo && mo > 0 ? addM(pr.deliveryDate, mo) : null);
  const renewalUDates    = (pr.renewals || []).filter((r: any) => r && r.type !== "excl" && r.endDate).map((r: any) => r.endDate as string);
  const allUsageDates    = [originalUsageEnd, ...renewalUDates].filter(Boolean) as string[];
  const activeUsageEnd   = allUsageDates.length > 0 ? allUsageDates.reduce((a,b) => a > b ? a : b) : null;
  const exclDates        = (pr.renewals || []).filter((r: any) => r && r.type === "excl" && r.endDate).map((r: any) => r.endDate as string);
  const activeExclEnd    = exclDates.length > 0 ? exclDates.reduce((a,b) => a > b ? a : b) : null;
  if (!activeUsageEnd && !activeExclEnd) return null;
  return (
    <div style={{ marginBottom: 8, marginTop: 4 }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 4px" }}>License Tracker</p>
      {activeUsageEnd && <LicenseLine label="Usage Rights" end={activeUsageEnd} />}
      {activeExclEnd  && <LicenseLine label="Exclusivity"  end={activeExclEnd}  />}
    </div>
  );
}

export default function ProjectCard({
  pr, cl, clients, isMobile, settings, rc,
  clientsHook, onRevise, onAmend,
  highlighted, onClearHighlight, showClientName, readOnly,
}: ProjectCardProps) {

  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [legacyQuote, setLegacyQuote] = useState(false);
  const [open,     setOpen]     = useState(false);  // expandable
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      if (onClearHighlight) onClearHighlight();
    }
  }, [highlighted]);

  const client = (clients || []).find((c: any) => c.id === cl.id) || cl;
  const docs   = sortDocs((pr.documents || []) as DocRecord[]);
  const openD  = openDocId ? docs.find(d => d.id === openDocId) : null;

  if (openD) {
    return <PDFModal key={openD.id} doc={openD} settings={settings} client={client} editable={false} onClose={() => setOpenDocId(null)} />;
  }
  if (legacyQuote && pr.qd) {
    return (
      <PDFModal
        doc={{ kind: "quote", docNo: pr.qd.qNo || "", revision: pr.qd.rev || 0, status: "sent", docDate: pr.qd.date || pr.date || today(), lang: "en", data: pr.qd }}
        settings={settings} client={client} editable={false} onClose={() => setLegacyQuote(false)}
      />
    );
  }

  const dotCol = (st: string) => ({ draft: C.light, sent: C.amber, signed: C.green, paid: C.green, cancelled: C.red, superseded: C.rule }[st] ?? C.light);
  const DocChips = () => (
    <div style={{ display: "flex", gap: isMobile ? 8 : 5, flexWrap: "wrap" as const }}>
      {!docs.some(d => d.kind === "quote") && pr.qd && (
        <B v="sec" onClick={() => setLegacyQuote(true)} s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }}>Quote</B>
      )}
      {docs.map(d => (
        <B key={d.id} v="sec" onClick={() => setOpenDocId(d.id)}
          s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px", gap: 6, color: d.status === "superseded" ? C.light : C.black, textDecoration: d.status === "superseded" || d.status === "cancelled" ? "line-through" : "none" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotCol(d.status), display: "inline-block", flexShrink: 0 }} />
          {docLabel(d, pr)}
        </B>
      ))}
    </div>
  );

  const isActive = !pr.paid;
  const statusLabel = pr.paid ? "Paid" : pr.status;

  return (
    <div
      ref={cardRef}
      style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 10, opacity: pr.paid ? 0.55 : 1 }}
    >
      {/* ── HEADER (Clickable if readOnly to expand) ── */}
      <div
        onClick={() => readOnly && setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: isMobile ? 10 : 7,
          cursor: readOnly ? "pointer" : "default",
        }}
      >
        <div>
          {showClientName && <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "0 0 2px", letterSpacing: "0.04em" }}>{cl.name}</p>}
          <p style={{ fontSize: isMobile ? TYPE.sectionHeading.size : TYPE.subtext.size, color: C.black, margin: "0 0 2px", fontWeight: "500" }}>{pr.name}</p>
          <p style={{ fontSize: isMobile ? TYPE.subtext.size : TYPE.label.size, color: C.muted, margin: "0 0 5px" }}>{fmtD(pr.date)}</p>
          <StatusBadge status={statusLabel} />
        </div>
        <div style={{ textAlign: "right" as const, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <p style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.amount.size : TYPE.sectionHeading.size, color: C.black, margin: 0 }}>{fmt(pr.amount)}</p>
          {readOnly && (
            <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>
              {open ? "▲" : "▼"}
            </span>
          )}
        </div>
      </div>

      {/* ── DELIVERY DATE (when in production+) ── */}
      {["quoted","revised","contracted","production","invoiced","paid"].includes(pr.status) && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <span style={{ fontSize: TYPE.micro.size, color: C.muted, whiteSpace: "nowrap" as const, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Delivery</span>
          <span style={{ fontSize: TYPE.micro.size, color: C.black }}>{pr.deliveryDate ? fmtD(pr.deliveryDate) : "—"}</span>
        </div>
      )}

      {/* ── EXPANDABLE SECTION (ReadOnly ClientDetail mode only) ── */}
      {readOnly && open && (
        <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 10, marginTop: 10 }}>

          {/* Dates Section */}
          <div style={{ marginBottom: 10 }}>
            {pr.qd?.date && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.muted }}>Quote date</span>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.black }}>{fmtD(pr.qd.date)}</span>
              </div>
            )}
            {pr.deliveryDate && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.muted }}>Delivery</span>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.black }}>{fmtD(pr.deliveryDate)}</span>
              </div>
            )}
            {pr.qd?.validUntil && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.muted }}>Valid until</span>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.black }}>{fmtD(pr.qd.validUntil)}</span>
              </div>
            )}
            {pr.notes && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.muted }}>Notes</span>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.black, textAlign: "right", maxWidth: "55%" }}>{pr.notes}</span>
              </div>
            )}
          </div>

          {/* Line Items Summary */}
          {pr.qd?.lines && pr.qd.lines.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: C.light, margin: "0 0 6px" }}>Line Items</p>
              {pr.qd.lines.map((l: any, i: number) => (
                <div key={l.id ?? i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.rule}` }}>
                  <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.black }}>{l.name}</span>
                  <span style={{ fontFamily: SERIF, fontSize: 10.5, color: C.muted }}>{fmt(parseFloat(l.amt) || 0)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0" }}>
                <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.muted }}>Total</span>
                <span style={{ fontFamily: SERIF, fontSize: 12, color: C.black, fontWeight: "600" }}>{fmt(pr.amount || 0)}</span>
              </div>
            </div>
          )}

          {/* License Tracker */}
          <ProjectLicenseTracker pr={pr} />

          {/* Documents (read-only) */}
          {(pr.qd || docs.length > 0) && (
            <div>
              <p style={{ fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: C.light, margin: "0 0 6px" }}>Documents</p>
              <DocChips />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
