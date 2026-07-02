import PDFModalComponent from "./PDFModal";
// ─────────────────────────────────────────────────────────────
// ProjectCard — single project row with docs, actions, status
// Used in both ClientDetail and ProjectsTab
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, addM, today, uid } from "./formatters";
import { I, B, StatusBadge } from "./atoms";
import { STATUS } from "./rateCards";
import RenewalModal from "./RenewalModal";

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
  // optional — used in ProjectsTab where client name shown
  showClientName?:  boolean;
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
  highlighted, onClearHighlight, showClientName,
}: ProjectCardProps) {

  const [pdf,      setPdf]      = useState<any>(null);
  const [renewT,   setRenewT]   = useState<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      if (onClearHighlight) onClearHighlight();
    }
  }, [highlighted]);

  const upP = (data: any) => clientsHook.updateProject(cl.id, pr.id, data);
  const setStatus = (st: string) => clientsHook.setProjectStatus(cl.id, pr.id, st as any);

  const nxt = (s: string) => { const i = STATUS.indexOf(s as any); return i < STATUS.length - 1 ? STATUS[i + 1] : null; };
  const prv = (s: string) => { const i = STATUS.indexOf(s as any); return i > 0 ? STATUS[i - 1] : null; };

  const openPDF = (type: string, lang = "en") => {
    const q = pr.qd;
    const iNo = `INV-${(q?.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
    setPdf({
      data: { brand: q?.brand, contact: q?.contact, date: pr.date || today(), validUntil: q?.validUntil, qNo: q?.qNo, rev: q?.rev || 0, contractRev: q?.contractRev || 0, clauses: q?.clauses || [], iNo, delivery: pr.deliveryDate, ctype: q?.ctype || "Content Creator", lines: q?.lines || [], amendments: pr.amendments || [], total: pr.amount, retainer: q?.retainer, retMo: q?.retMo, footer: type === "invoice" ? "Thank you for the pleasure of working together." : "Looking forward to working together." },
      type, lang,
    });
  };

  // import PDFModal lazily to avoid circular dep at build time
  const PDFModal = PDFModalComponent;

  // Renewal builder modal (old-app: saveRenewal forces signed:true)
  if (renewT) {
    return (
      <RenewalModal
        p={renewT}
        rc={rc}
        settings={settings}
        onClose={() => setRenewT(null)}
        onSave={async (r: any) => {
          await clientsHook.addRenewal(cl.id, pr.id, { ...r, signed: true });
          setRenewT(null);
        }}
      />
    );
  }

  if (pdf && PDFModal) {
    // Old-app onSave routing:
    //  · readOnly (amendment / renewal docs) → no save handler at all
    //  · official contract revision → bump contractRev, NEVER touch amount
    //  · own quote/contract/invoice → save qd + recompute amount
    const onSave = pdf.readOnly
      ? undefined
      : pdf.isRevision
        ? (doc: any) => {
            upP({ qd: { ...doc, contractRev: pdf.nextContractRev, clauses: doc.clauses || [] } });
            setPdf(null);
          }
        : (doc: any) => {
            const tot = doc.total || (doc.lines || []).reduce((s: number, l: any) => s + (parseFloat(l.amt) || 0), 0);
            upP({ qd: { ...doc, clauses: doc.clauses || [] }, amount: tot });
            setPdf(null);
          };
    return (
      <PDFModal
        data={pdf.data}
        type={pdf.type}
        onClose={() => setPdf(null)}
        settings={settings}
        onSave={onSave}
      />
    );
  }

  const isActive = !pr.paid;
  const statusLabel = pr.paid ? "Paid" : pr.status;

  return (
    <div
      ref={cardRef}
      style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 10, opacity: pr.paid ? 0.6 : 1 }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 10 : 7 }}>
        <div>
          {showClientName && <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "0 0 2px", letterSpacing: "0.04em" }}>{cl.name}</p>}
          <p style={{ fontSize: isMobile ? TYPE.sectionHeading.size : TYPE.subtext.size, color: C.black, margin: "0 0 2px", fontWeight: "500" }}>{pr.name}</p>
          <p style={{ fontSize: isMobile ? TYPE.subtext.size : TYPE.label.size, color: C.muted, margin: "0 0 5px" }}>{fmtD(pr.date)}</p>
          <StatusBadge status={statusLabel} />
        </div>
        <div style={{ textAlign: "right" as const }}>
          <p style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.amount.size : TYPE.sectionHeading.size, color: C.black, margin: "0 0 2px" }}>{fmt(pr.amount)}</p>
          {(pr.amendments || []).length > 0 && <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: 0 }}>incl. {pr.amendments.length} amend.</p>}
        </div>
      </div>

      {/* ── DELIVERY DATE (when in production+) ── */}
      {["quoted","revised","contracted","production","invoiced","paid"].includes(pr.status) && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <span style={{ fontSize: TYPE.micro.size, color: C.muted, whiteSpace: "nowrap" as const, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Delivery</span>
          <I
            type="date"
            value={pr.deliveryDate || ""}
            onChange={(e: any) => { const nv = e.target.value; if (!nv) return; if (!pr.deliveryDate || nv > pr.deliveryDate) upP({ deliveryDate: nv }); }}
            s={{ fontSize: TYPE.micro.size, padding: "5px 8px", width: "auto" }}
          />
        </div>
      )}

      {/* ── LICENSE TRACKER ── */}
      <ProjectLicenseTracker pr={pr} />

      {/* ── DOCUMENTS ── */}
      {(pr.qd || (pr.amendments || []).length > 0 || (pr.renewals || []).length > 0) && (
        <div style={{ display: "flex", gap: isMobile ? 8 : 5, flexWrap: "wrap" as const, borderTop: `1px solid ${C.rule}`, paddingTop: isMobile ? 10 : 7, marginBottom: isMobile ? 8 : 6 }}>
          {pr.qd && (
            <B v="sec" onClick={() => openPDF("quote")} s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }}>
              {pr.qd.rev > 0 ? `Quote R${pr.qd.rev}` : "Quote"}
            </B>
          )}
          {["contracted","production","invoiced","paid"].includes(pr.status) && pr.qd && (
            <B v="sec" onClick={() => openPDF("contract")} s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }}>
              {pr.qd.contractRev > 0 ? `Contract R${pr.qd.contractRev}` : "Contract"}
            </B>
          )}
          {(pr.amendments || []).map((a: any, ai: number) => (
            <B key={ai} v="sec"
              s={{ fontSize: TYPE.micro.size, color: a.signed ? C.black : C.amber, borderColor: a.signed ? C.rule : C.amber, padding: isMobile ? "9px 14px" : "5px 10px" }}
              onClick={() => setPdf({ data: { brand: pr.qd?.brand, contact: pr.qd?.contact, date: today(), ctype: pr.qd?.ctype || "Content Creator", qNo: pr.qd?.qNo, aNo: a.aNo, lines: a.lines || [], amendTotal: a.amendTotal, origTotal: pr.amount - a.amendTotal }, type: "amendment", readOnly: true })}
            >
              Amend {ai + 1}{!a.signed ? " · unsigned" : ""}
            </B>
          ))}
          {["invoiced","paid"].includes(pr.status) && pr.qd && !pr.qd?.retainer && (
            <B v="sec" onClick={() => openPDF("invoice")} s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }}>Invoice</B>
          )}
          {(pr.renewals || []).map((r: any, ri: number) => (
            r.doc && <B key={ri} v="sec"
              s={{ fontSize: TYPE.micro.size, color: r.paid ? C.black : C.green, borderColor: r.paid ? C.rule : C.green, padding: isMobile ? "9px 14px" : "5px 10px" }}
              onClick={() => setPdf({ data: r.doc, type: "renewal", readOnly: true })}
            >
              Renewal {ri + 1}
            </B>
          ))}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div style={{ display: "flex", gap: isMobile ? 8 : 5, flexWrap: "wrap" as const, alignItems: "center", paddingTop: isMobile ? 10 : 7, borderTop: `1px solid ${C.rule}` }}>

        {["quoted","revised"].includes(pr.status) && <>
          <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => onRevise(pr, cl)}>Revise Quote</B>
          <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px" }}
            onClick={() => { setStatus("contracted"); openPDF("contract"); }}>
            → Contract
          </B>
        </>}

        {pr.status === "contracted" && <>
          <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => {
            const q = pr.qd; const nextRev = (q?.contractRev || 0) + 1;
            const iNo = `INV-${(q?.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
            setPdf({ data: { brand: q?.brand, contact: q?.contact, date: today(), validUntil: q?.validUntil, qNo: q?.qNo, rev: q?.rev || 0, contractRev: nextRev, clauses: q?.clauses || [], iNo, delivery: pr.deliveryDate, ctype: q?.ctype || "Content Creator", lines: q?.lines || [], amendments: pr.amendments || [], total: pr.amount, footer: "Looking forward to working together." }, type: "contract", isRevision: true, nextContractRev: nextRev });
          }}>Revise Contract</B>
          <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px" }} onClick={() => setStatus("production")}>Mark Signed</B>
        </>}

        {pr.status === "production" && (
          <B
            s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px", opacity: pr.deliveryDate ? 1 : 0.35, cursor: pr.deliveryDate ? "pointer" : "not-allowed" as const }}
            onClick={() => { if (!pr.deliveryDate) return; setStatus("invoiced"); openPDF("invoice"); }}
          >
            Create Invoice
          </B>
        )}

        {pr.status === "invoiced" && !pr.paid && (
          <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px" }} onClick={() => setStatus("paid")}>Mark Paid</B>
        )}

        {pr.paid && !pr.qd?.retainer && <>
          <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green, padding: isMobile ? "10px 18px" : "7px 14px" }}
            onClick={() => setRenewT(pr)}>
            Add Renewal
          </B>
          <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "10px 18px" : "7px 14px" }}
            onClick={() => upP({ paid: false, status: "invoiced" })}>
            Undo Paid
          </B>
        </>}

        {!pr.paid && pr.status !== "quoted" && (
          <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted, padding: isMobile ? "10px 14px" : "7px 14px" }}
            onClick={() => { const p = prv(pr.status); if (p) setStatus(p); }}>
            Undo
          </B>
        )}

        {/* Amend */}
        {["production","invoiced","paid"].includes(pr.status) && pr.qd && (
          <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted, padding: isMobile ? "10px 14px" : "7px 14px" }}
            onClick={() => onAmend(pr, cl)}>
            + Amend
          </B>
        )}
      </div>
    </div>
  );
}
