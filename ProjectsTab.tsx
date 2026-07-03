// ─────────────────────────────────────────────────────────────
// ProjectsTab — all projects across all clients
// Expandable rows, filter/sort, docs, full action workflow
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, fmtE, today, uid, addM } from "./formatters";
import { I, B, StatusBadge } from "./atoms";
import { STATUS } from "./rateCards";
import RenewalModal from "./RenewalModal";
import ProductionSection from "./ProductionSection";

// ── Lazy PDFModal to avoid circular deps ──────────────────────
let _PDFModal: any = null;
const getPDFModal = async () => {
  if (!_PDFModal) _PDFModal = (await import("./PDFModal")).default;
  return _PDFModal;
};

// ── Status color helper ───────────────────────────────────────
const scol = (s: string) => ({
  invoiced: C.amber, contracted: C.muted, quoted: C.light,
  revised: "#b8a090", production: "#8fa89a", paid: C.green, lead: C.light,
}[s] ?? C.light);

// ── License tracker (inline mini) ────────────────────────────
function LicenseLine({ label, end }: { label: string; end: string }) {
  const d   = Math.ceil((new Date(end).getTime() - new Date().getTime()) / 864e5);
  const exp = d < 0; const expiring = !exp && d <= 7;
  const col = exp ? C.red : expiring ? C.amber : C.green;
  const bg  = exp ? "#fdf0f0" : expiring ? "#fdf6ee" : "#f0f5f0";
  const bd  = exp ? C.red : expiring ? C.amber : C.green;
  const txt = exp ? `+${Math.abs(d)}d expired` : expiring ? `${d}d left` : `${d}d`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: bg, border: `1px solid ${bd}`, borderRadius: 2, marginBottom: 3 }}>
      <span style={{ fontSize: TYPE.micro.size, color: col, fontWeight: "500" }}>{label}</span>
      <span style={{ fontSize: TYPE.micro.size, color: col, fontWeight: "600" }}>{fmtD(end)} · {txt}</span>
    </div>
  );
}

function ProjectLicenseTracker({ pr }: { pr: any }) {
  if (!pr?.qd) return null;
  let mo: number | null = pr.qd?.mo && pr.qd.mo > 0 ? pr.qd.mo : null;
  if (!mo) {
    for (const l of pr.qd?.lines || []) {
      const m = l.usageLabel ? String(l.usageLabel).match(/(\d+)\s*month/i) : null;
      if (m) { mo = parseInt(m[1]); break; }
    }
  }
  const originalUE   = pr.usageEndOverride || (pr.deliveryDate && mo && mo > 0 ? addM(pr.deliveryDate, mo) : null);
  const renewalUDates = (pr.renewals || []).filter((r: any) => r?.type !== "excl" && r?.endDate).map((r: any) => r.endDate as string);
  const allUDates    = [originalUE, ...renewalUDates].filter(Boolean) as string[];
  const activeUE     = allUDates.length > 0 ? allUDates.reduce((a,b) => a > b ? a : b) : null;
  const exclDates    = (pr.renewals || []).filter((r: any) => r?.type === "excl" && r?.endDate).map((r: any) => r.endDate as string);
  const activeExcl   = exclDates.length > 0 ? exclDates.reduce((a,b) => a > b ? a : b) : null;
  if (!activeUE && !activeExcl) return null;
  return (
    <div style={{ marginBottom: 8, marginTop: 4 }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 4px" }}>License</p>
      {activeUE   && <LicenseLine label="Usage Rights" end={activeUE}   />}
      {activeExcl && <LicenseLine label="Exclusivity"  end={activeExcl} />}
    </div>
  );
}

// ── Single expandable project row ─────────────────────────────
function ProjectRow({
  pr, clients, isMobile, isExpanded, onToggle, clientsHook, onRevise, onAmend, onGoToCalc, settings, onModalClosed,
}: {
  pr: any; clients: any[]; isMobile: boolean; isExpanded: boolean;
  onToggle: () => void; clientsHook: any;
  onRevise: (pr: any, cl: any) => void;
  onAmend: (pr: any, cl: any) => void;
  onGoToCalc: (name: string) => void;
  settings: any;
  onModalClosed: () => void;
}) {
  const [pdf, setPdf] = useState<any>(null);
  const [renewT, setRenewT] = useState<any>(null);
  const [PDFModal, setPDFModal] = useState<any>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded) getPDFModal().then(m => setPDFModal(() => m));
  }, [isExpanded]);

  const cl  = { id: pr._cid, name: pr._cname };
  const upP = (data: any) => clientsHook.updateProject(cl.id, pr.id, data);
  const setStatus = (st: string) => clientsHook.setProjectStatus(cl.id, pr.id, st as any);

  const nxt = (s: string) => { const i = STATUS.indexOf(s as any); return i < STATUS.length - 1 ? STATUS[i + 1] : null; };
  const prv = (s: string) => { const i = STATUS.indexOf(s as any); return i > 0 ? STATUS[i - 1] : null; };

  const openPDF = (type: string, overridePr?: any) => {
    const src   = overridePr || pr;
    const q     = src.qd;
    const iNo   = `INV-${(q?.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
    setPdf({
      data: {
        brand: q?.brand, contact: q?.contact, date: src.date || today(),
        validUntil: q?.validUntil, qNo: q?.qNo, rev: q?.rev || 0,
        contractRev: q?.contractRev || 0, clauses: q?.clauses || [], iNo,
        delivery: src.deliveryDate, ctype: q?.ctype || "Content Creator",
        lines: q?.lines || [], amendments: src.amendments || [],
        total: src.amount, retainer: q?.retainer, retMo: q?.retMo,
        footer: type === "invoice"
          ? "Thank you for the pleasure of working together."
          : "Looking forward to working together.",
      },
      type,
    });
  };

  // Renewal builder modal (old-app: saveRenewal forces signed:true)
  if (renewT) {
    return (
      <RenewalModal
        p={renewT}
        rc={{}}
        settings={settings}
        onClose={() => { setRenewT(null); onModalClosed(); }}
        onSave={async (r: any) => {
          await clientsHook.addRenewal(cl.id, pr.id, { ...r, signed: true });
          setRenewT(null);
          onModalClosed();
        }}
      />
    );
  }

  if (pdf && PDFModal) {
    // Old-app onSave routing:
    //  · readOnly (amendment / renewal docs) → no save handler at all
    //  · official contract revision → bump contractRev, NEVER touch amount
    //  · monthly retainer invoice → append or edit-in-place by index
    //  · own quote/contract/invoice → save qd + recompute amount
    const onSave = pdf.readOnly
      ? undefined
      : pdf.isRevision
        ? (doc: any) => {
            upP({ qd: { ...doc, contractRev: pdf.nextContractRev, clauses: doc.clauses || [] } });
            setPdf(null);
          }
        : pdf.isMonthlyInv
          ? (doc: any) => {
              const amount = doc.total || (doc.lines || []).reduce((s: number, l: any) => s + (parseFloat(l.amt) || 0), 0);
              const mis = pr.monthlyInvoices || [];
              if (pdf.monthlyIdx !== undefined) {
                // edit existing monthly invoice in place (old-app semantics)
                upP({ monthlyInvoices: mis.map((inv: any, ii: number) =>
                  ii === pdf.monthlyIdx
                    ? { ...inv, doc, iNo: doc.iNo || inv.iNo, delivery: doc.delivery, amount }
                    : inv
                ) });
              } else {
                upP({ monthlyInvoices: [...mis, { id: uid(), iNo: doc.iNo || doc.rNo, delivery: doc.delivery, amount, paid: false, doc }] });
              }
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
        onClose={() => { setPdf(null); onModalClosed(); }}
        settings={settings}
        onSave={onSave}
      />
    );
  }

  const pad = isMobile ? "16px 0" : "12px 0";

  return (
    <div ref={rowRef} data-prid={pr.id} style={{ borderBottom: `1px solid ${C.rule}`, opacity: pr.paid ? 0.55 : 1 }}>

      {/* ── COLLAPSED ROW ── */}
      <div onClick={onToggle} style={{ padding: pad, cursor: "pointer" }}>
        {isMobile ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: TYPE.subtext.size, color: C.muted, fontWeight: "500" }}>{pr._cname}</span>
              <span style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, flexShrink: 0, marginLeft: 12 }}>{fmt(pr.amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr.name}</span>
                <span style={{ fontSize: TYPE.micro.size, color: scol(pr.paid ? "paid" : pr.status), border: `1px solid ${scol(pr.paid ? "paid" : pr.status)}`, padding: "2px 7px", borderRadius: 2, letterSpacing: "0.07em", textTransform: "uppercase" as const, display: "inline-block", marginTop: 3 }}>{pr.paid ? "Paid" : pr.status}</span>
              </div>
              <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0, marginLeft: 12 }}>{pr.deliveryDate ? fmtD(pr.deliveryDate) : "—"}</span>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 100px", alignItems: "center" }}>
            <div style={{ minWidth: 0, paddingRight: 12 }}>
              <div style={{ fontSize: TYPE.micro.size, color: C.muted, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr._cname}</div>
              <div style={{ fontSize: TYPE.subtext.size, color: C.black, fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr.name}</div>
              <span style={{ fontSize: TYPE.micro.size, color: scol(pr.paid ? "paid" : pr.status), border: `1px solid ${scol(pr.paid ? "paid" : pr.status)}`, padding: "2px 7px", borderRadius: 2, letterSpacing: "0.07em", textTransform: "uppercase" as const, display: "inline-block", marginTop: 3 }}>{pr.paid ? "Paid" : pr.status}</span>
            </div>
            <div style={{ fontSize: TYPE.micro.size, color: C.muted, textAlign: "right" as const, paddingRight: 12 }}>{pr.deliveryDate ? fmtD(pr.deliveryDate) : "—"}</div>
            <div style={{ fontFamily: SERIF, fontSize: TYPE.subtext.size, color: C.black, textAlign: "right" as const }}>{fmt(pr.amount)}</div>
          </div>
        )}
      </div>

      {/* ── EXPANDED DETAIL ── */}
      {isExpanded && (
        <div style={{ paddingBottom: isMobile ? 16 : 12, paddingTop: 4 }}>

          {/* 1. DETAILS */}
          {pr.qd && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Details</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {pr.qd.qNo    && <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.body.size }}><span style={{ color: C.muted }}>Quote No.</span><span style={{ color: C.black, fontWeight: 500 }}>{pr.qd.qNo}</span></div>}
                {pr.qd.contact && <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.body.size }}><span style={{ color: C.muted }}>Contact</span><span style={{ color: C.black, fontWeight: 500 }}>{pr.qd.contact}</span></div>}
                {pr.qd.date && <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.body.size }}><span style={{ color: C.muted }}>Date</span><span style={{ color: C.black, fontWeight: 500 }}>{fmtD(pr.qd.date)}</span></div>}
                {pr.qd.validUntil && <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.body.size }}><span style={{ color: C.muted }}>Valid until</span><span style={{ color: C.black, fontWeight: 500 }}>{fmtD(pr.qd.validUntil)}</span></div>}
                {["production","invoiced","paid"].includes(pr.status) ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: TYPE.body.size }}>
                    <span style={{ color: C.muted }}>Delivery</span>
                    <I
                      type="date"
                      value={pr.deliveryDate || ""}
                      onChange={(e: any) => { const nv = e.target.value; if (nv) upP({ deliveryDate: nv }); }}
                      s={{ width: isMobile ? 120 : 140, fontSize: TYPE.micro.size, padding: "5px 8px" }}
                    />
                  </div>
                ) : pr.deliveryDate ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.body.size }}><span style={{ color: C.muted }}>Delivery</span><span style={{ color: C.black, fontWeight: 500 }}>{fmtD(pr.deliveryDate)}</span></div>
                ) : null}
              </div>
            </div>
          )}

          {/* 2. DELIVERABLES */}
          {pr.qd && (pr.qd.lines || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Deliverables</p>
              {(pr.qd.lines || []).map((ln: any, li: number) => (
                <div key={li} style={{ marginBottom: li < (pr.qd.lines || []).length - 1 ? 8 : 0, paddingBottom: li < (pr.qd.lines || []).length - 1 ? 8 : 0, borderBottom: li < (pr.qd.lines || []).length - 1 ? `1px solid ${C.rule}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: 500 }}>{ln.name}{ln.qty && ln.qty > 1 ? ` × ${ln.qty}` : ""}</span>
                    {ln.usageLabel && <span style={{ fontSize: 8, color: C.muted, padding: "1px 5px", background: C.light, borderRadius: 2 }}>Usage: {ln.usageLabel}</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: TYPE.label.size }}>
                    <span style={{ color: C.muted }}>Rate</span>
                    <span style={{ fontFamily: SERIF, fontSize: TYPE.body.size, color: C.black }}>{fmtE(parseFloat(ln.amt) || 0)} €{ln.qty && ln.qty > 1 ? ` × ${ln.qty}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. BUILD QUOTE */}
          {!pr.qd && (
            <div style={{ marginBottom: 12 }}>
              <B s={{ fontSize: TYPE.micro.size, padding: "8px 14px", width: "100%" }} onClick={() => onGoToCalc(pr._cname)}>+ Create Quote</B>
            </div>
          )}

          {/* 4. DOCUMENTS */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Documents</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
              {pr.qd && (
                <B v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px" }} onClick={() => openPDF("quote")}>
                  {pr.qd.rev > 0 ? `Quote R${pr.qd.rev}` : "Quote"}
                </B>
              )}
              {["contracted","production","invoiced","paid"].includes(pr.status) && pr.qd && (
                <B v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px" }} onClick={() => openPDF("contract")}>
                  {pr.qd.contractRev > 0 ? `Contract R${pr.qd.contractRev}` : "Contract"}
                </B>
              )}
              {(pr.amendments || []).map((a: any, ai: number) => (
                <B key={ai} v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px", color: a.signed ? C.black : C.amber, borderColor: a.signed ? C.rule : C.amber }}
                  onClick={() => setPdf({ data: { brand: pr.qd?.brand, contact: pr.qd?.contact, date: today(), ctype: pr.qd?.ctype || "Content Creator", qNo: pr.qd?.qNo, aNo: a.aNo, lines: a.lines || [], amendTotal: a.amendTotal, origTotal: pr.amount - a.amendTotal }, type: "amendment", readOnly: true })}>
                  Amend {ai + 1}{!a.signed ? " · unsigned" : ""}
                </B>
              ))}
              {["invoiced","paid"].includes(pr.status) && pr.qd && (
                <B v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px" }} onClick={() => openPDF("invoice")}>Invoice</B>
              )}
              {(pr.renewals || []).map((r: any, ri: number) => (
                r.doc && (
                  <B key={ri} v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px", color: r.paid ? C.black : C.green, borderColor: r.paid ? C.rule : C.green }}
                    onClick={() => setPdf({ data: r.doc, type: "renewal", readOnly: true })}>
                    Renewal {ri + 1}
                  </B>
                )
              ))}
              {pr.qd?.retainer && (pr.monthlyInvoices || []).map((inv: any, ii: number) => (
                inv.doc && (
                  <B key={ii} v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px", color: inv.paid ? C.black : C.green, borderColor: inv.paid ? C.rule : C.green }}
                    onClick={() => setPdf({ data: inv.doc, type: "invoice", isMonthlyInv: true, monthlyIdx: ii })}>
                    Invoice M{String(ii + 1).padStart(2, "0")}
                  </B>
                )
              ))}
            </div>
          </div>

          {/* 5. PRODUCTION SECTION */}
          {pr.status === "production" && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Production</p>
              <ProductionSection pr={pr} clients={clients} cl={cl} upP={upP} isMobile={isMobile} />
            </div>
          )}

          {/* 6. LICENSE TRACKER */}
          <ProjectLicenseTracker pr={pr} />

          {/* 7. NOTES */}
          {pr.notes && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Notes</p>
              <p style={{ fontSize: TYPE.body.size, color: C.muted, margin: 0, lineHeight: 1.5 }}>{pr.notes}</p>
            </div>
          )}

          {/* 8. ACTION ROW */}
          <div style={{ display: "flex", gap: isMobile ? 6 : 5, flexWrap: "wrap" as const, paddingTop: 10, borderTop: `1px solid ${C.rule}` }}>

            {["quoted","revised"].includes(pr.status) && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => onRevise(pr, cl)}>Revise Quote</B>
              <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "8px 14px" : "7px 14px" }} onClick={() => { setStatus("contracted"); openPDF("contract", { ...pr, status: "contracted" }); }}>→ Contract</B>
            </>}

            {pr.status === "contracted" && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => { const q = pr.qd; const nextRev = (q?.contractRev || 0) + 1; setPdf({ data: { brand: q?.brand, contact: q?.contact, date: today(), validUntil: q?.validUntil, qNo: q?.qNo, rev: q?.rev || 0, contractRev: nextRev, clauses: q?.clauses || [], iNo: `INV-${(q?.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`, delivery: pr.deliveryDate, ctype: q?.ctype || "Content Creator", lines: q?.lines || [], amendments: pr.amendments || [], total: pr.amount, footer: "Looking forward to working together." }, type: "contract", isRevision: true, nextContractRev: nextRev }); }}>Revise Contract</B>
              <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "8px 14px" : "7px 14px" }} onClick={() => setStatus("production")}>Mark Signed</B>
            </>}

            {pr.status === "production" && (pr.qd?.retainer ? (() => {
              const mis = pr.monthlyInvoices || [];
              const retMo = pr.qd?.retMo || 1;
              const nextN = mis.length + 1;
              const allDone = mis.length >= retMo;
              const lastPaid = mis.length > 0 && mis[mis.length - 1].paid;
              const canNext = mis.length === 0 || lastPaid;
              return (<>
                {mis.map((inv: any, ii: number) => (
                  <span key={inv.id || ii} style={{ display: "contents" }}>
                    {!inv.paid && (
                      <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green, padding: isMobile ? "8px 10px" : "7px 10px" }}
                        onClick={() => {
                          const nm = mis.map((i2: any, i: number) => i === ii ? { ...i2, paid: true } : i2);
                          upP({ monthlyInvoices: nm, paid: nm.length >= retMo && nm.every((v: any) => v.paid), status: nm.length >= retMo && nm.every((v: any) => v.paid) ? "paid" : pr.status });
                        }}>Mark M{ii + 1} Paid</B>
                    )}
                    <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "8px 10px" : "7px 10px" }}
                      onClick={() => upP({ monthlyInvoices: mis.filter((_: any, i: number) => i !== ii), paid: false })}>Undo M{ii + 1}</B>
                  </span>
                ))}
                {!allDone && canNext && (
                  <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "8px 14px" : "7px 14px" }}
                    onClick={() => {
                      const q = pr.qd;
                      const skip = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
                      const ml = (q?.lines || []).map((l: any) => ({...l, amt: skip.some(s => (l.name || "").toLowerCase().includes(s)) ? parseFloat(l.amt) || 0 : Math.round((parseFloat(l.amt) || 0) * 0.8), up: parseFloat(l.up) || 0}));
                      const mamt = Math.round(ml.reduce((s: number, l: any) => s + (parseFloat(l.amt) || 0), 0));
                      const bno = `INV-${(q?.qNo || "").replace("QUO","").trim() || "001"}`;
                      setPdf({ data: { brand: q?.brand, contact: q?.contact, date: today(), qNo: q?.qNo, iNo: `${bno}-M${String(nextN).padStart(2,"0")}`, delivery: today(), ctype: q?.ctype || "Content Creator", lines: ml, total: mamt, retainer: true, retMo: q?.retMo, footer: "Thank you for the pleasure of working together." }, type: "invoice", isMonthlyInv: true });
                    }}>Create Invoice {nextN}/{retMo}</B>
                )}
              </>);
            })() : (
              <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "8px 14px" : "7px 14px", opacity: pr.deliveryDate ? 1 : 0.35, cursor: pr.deliveryDate ? "pointer" : "not-allowed" as const }} title={pr.deliveryDate ? "" : "Set delivery date first"} onClick={() => { if (pr.deliveryDate) { setStatus("invoiced"); openPDF("invoice"); } }}>Create Invoice</B>
            ))}

            {pr.status === "invoiced" && !pr.paid && <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "8px 14px" : "7px 14px" }} onClick={() => setStatus("paid")}>Mark Paid</B>}

            {pr.paid && !pr.qd?.retainer && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green, padding: isMobile ? "8px 14px" : "7px 14px" }} onClick={() => setRenewT(pr)}>Add Renewal</B>
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "8px 14px" : "7px 14px" }} onClick={() => upP({ paid: false, status: "invoiced" })}>Undo Paid</B>
            </>}

            {(pr.renewals || []).map((r: any, ri: number) => (
              <span key={r.id || ri} style={{ display: "contents" }}>
                {!r.paid && <>
                  <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green, padding: isMobile ? "8px 10px" : "7px 10px" }} onClick={() => clientsHook.updateRenewal(cl.id, pr.id, r.id, { paid: true })}>Mark R{ri + 1} Paid</B>
                  <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "8px 10px" : "7px 10px" }} onClick={() => clientsHook.deleteRenewal(cl.id, pr.id, r.id)}>Undo R{ri + 1}</B>
                </>}
                {r.paid && (
                  <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "8px 10px" : "7px 10px" }} onClick={() => clientsHook.updateRenewal(cl.id, pr.id, r.id, { paid: false })}>Undo R{ri + 1}</B>
                )}
              </span>
            ))}

            {!pr.paid && pr.status !== "quoted" && <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted, padding: isMobile ? "8px 10px" : "7px 10px" }} onClick={() => { const p = prv(pr.status); if (p) setStatus(p); }}>← Undo</B>}

            {["production","invoiced","paid"].includes(pr.status) && pr.qd && <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted, padding: isMobile ? "8px 10px" : "7px 10px" }} onClick={() => onAmend(pr, cl)}>+ Amend</B>}

            {(pr.amendments || []).map((a: any, ai: number) => (
              <B key={a.id || ai} v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "8px 10px" : "7px 10px" }} onClick={() => clientsHook.deleteAmendment(cl.id, pr.id, a.id)}>Undo Amend {ai + 1}</B>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
interface ProjectsTabProps {
  clients:          any[];
  isMobile:         boolean;
  settings:         any;
  rc:               any;
  clientsHook:      any;
  onRevise:         (pr: any, cl: any) => void;
  onAmend:          (pr: any, cl: any) => void;
  onGoToCalc:       (name: string) => void;
  pendingProjectQNo:string | null;
  onPendingClear:   () => void;
}

export default function ProjectsTab({
  clients, isMobile, settings, rc, clientsHook,
  onRevise, onAmend, onGoToCalc, pendingProjectQNo, onPendingClear,
}: ProjectsTabProps) {

  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [sortOrder,     setSortOrder]     = useState("newest");
  const [scrollTrigger, setScrollTrigger] = useState(0);  // re-scroll to row after modal close (old-app)

  // Auto-expand pending project
  useEffect(() => {
    if (!pendingProjectQNo) return;
    const all = clients.flatMap((c: any) => c.projects.map((pr: any) => ({ ...pr, _cid: c.id })));
    const match = all.find((pr: any) => pr.qd?.qNo === pendingProjectQNo);
    if (match) setExpanded(match.id);
    if (onPendingClear) onPendingClear();
  }, [pendingProjectQNo]);

  // Scroll to expanded (also re-fires after a modal closes, like old app)
  useEffect(() => {
    if (!expanded) return;
    const el = document.querySelector(`[data-prid="${expanded}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [expanded, scrollTrigger]);

  // ── Flatten all projects ──────────────────────────────────
  const all = clients.flatMap((c: any) =>
    c.projects.map((pr: any) => ({ ...pr, _cid: c.id, _cname: c.name }))
  );

  const active = all.filter((pr: any) => !pr.paid).sort((a: any, b: any) => {
    if (sortOrder === "amount")  return b.amount - a.amount;
    if (sortOrder === "oldest")  return a.date > b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const done  = all.filter((pr: any) => pr.paid).sort((a: any, b: any) => b.date > a.date ? 1 : -1);

  const FILTERS = [["all","All"],["production","Production"],["invoiced","Invoiced"],["contracted","Contracted"],["quoted","Quoted"]];
  const filteredActive = statusFilter === "all"
    ? active
    : active.filter((pr: any) => pr.status === statusFilter || (statusFilter === "quoted" && pr.status === "revised"));

  const activeTotal  = active.reduce((s: number, pr: any) => s + pr.amount, 0);
  const doneTotal    = done.reduce((s: number, pr: any) => s + pr.amount, 0);
  const byStatus     = (st: string) => active.filter((pr: any) => pr.status === st).length;
  const invoicedAmt  = active.filter((pr: any) => pr.status === "invoiced").reduce((s: number, pr: any) => s + pr.amount, 0);

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 12px", color: C.black }}>Projects</h2>

      {/* ── STATS BAR ── */}
      <div style={{ display: "flex", gap: isMobile ? 10 : 16, flexWrap: "wrap" as const, marginBottom: 10, alignItems: "center" }}>
        {[
          { label: "Active",     val: active.length,          color: C.black },
          { label: "Pipeline",   val: fmt(activeTotal),       color: C.amber },
          { label: "Production", val: byStatus("production"), color: C.black },
          { label: "Invoiced",   val: `${byStatus("invoiced")}${invoicedAmt > 0 ? ` · ${fmt(invoicedAmt)}` : ""}`, color: C.amber },
          ...(!isMobile ? [{ label: "Quoted", val: byStatus("quoted") + byStatus("revised"), color: C.black }] : []),
        ].map((item, i, arr) => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: TYPE.label.size, color: C.muted }}>
              {item.label} <strong style={{ color: item.color, fontWeight: "500" }}>{item.val}</strong>
            </span>
            {i < arr.length - 1 && <span style={{ color: C.light, fontSize: TYPE.label.size }}>·</span>}
          </span>
        ))}
      </div>

      {/* ── FILTER + SORT ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <select
          value={sortOrder} onChange={(e: any) => setSortOrder(e.target.value)}
          style={{ fontSize: TYPE.micro.size, padding: "5px 8px", border: `1px solid ${C.rule}`, borderRadius: 2, background: C.bg, color: C.black, fontFamily: SANS, cursor: "pointer", outline: "none" }}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="amount">Amount</option>
        </select>
        <select
          value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}
          style={{ fontSize: TYPE.micro.size, padding: "5px 8px", border: `1px solid ${C.rule}`, borderRadius: 2, background: C.bg, color: C.black, fontFamily: SANS, cursor: "pointer", outline: "none" }}
        >
          {FILTERS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </select>
      </div>

      {/* ── ACTIVE SECTION ── */}
      {active.length > 0 && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 5 }}>
          <span style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, fontWeight: "500" }}>Active — {active.length}</span>
          <span style={{ fontSize: TYPE.micro.size, color: C.black }}>{fmt(activeTotal)}</span>
        </div>
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 100px", padding: "4px 0 6px", borderBottom: `1px solid ${C.rule}` }}>
            {["Client · Project", "Delivery", "Amount"].map((h, i) => (
              <span key={i} style={{ fontSize: TYPE.micro.size, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: C.light, textAlign: i >= 1 ? "right" as const : "left" as const }}>{h}</span>
            ))}
          </div>
        )}
        {isMobile && <div style={{ borderBottom: `1px solid ${C.rule}` }} />}
        {filteredActive.map(pr => (
          <ProjectRow
            key={pr.id}
            pr={pr}
            clients={clients}
            isMobile={isMobile}
            isExpanded={expanded === pr.id}
            onToggle={() => setExpanded(expanded === pr.id ? null : pr.id)}
            clientsHook={clientsHook}
            onRevise={onRevise}
            onAmend={onAmend}
            onGoToCalc={onGoToCalc}
            settings={settings}
            onModalClosed={() => setScrollTrigger(t => t + 1)}
          />
        ))}
        {filteredActive.length === 0 && (
          <p style={{ fontSize: TYPE.subtext.size, color: C.light, padding: "20px 0" }}>No projects match this filter.</p>
        )}
      </>}

      {/* ── DONE SECTION ── */}
      {done.length > 0 && (
        <div style={{ marginTop: active.length > 0 ? 24 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 6, borderBottom: `1px solid ${C.rule}` }}>
            <span style={{ fontSize: TYPE.micro.size, color: C.light, letterSpacing: "0.07em", textTransform: "uppercase" as const, fontWeight: "500" }}>Done — {done.length}</span>
            <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>{fmt(doneTotal)} earned</span>
          </div>
          {done.map(pr => (
            <ProjectRow
              key={pr.id}
              pr={pr}
              clients={clients}
              isMobile={isMobile}
              isExpanded={expanded === pr.id}
              onToggle={() => setExpanded(expanded === pr.id ? null : pr.id)}
              clientsHook={clientsHook}
              onRevise={onRevise}
              onAmend={onAmend}
              onGoToCalc={onGoToCalc}
              settings={settings}
              onModalClosed={() => setScrollTrigger(t => t + 1)}
            />
          ))}
        </div>
      )}

      {/* ── EMPTY ── */}
      {active.length === 0 && done.length === 0 && (
        <p style={{ fontSize: TYPE.subtext.size, color: C.light, textAlign: "center" as const, marginTop: 40 }}>No projects yet.</p>
      )}
    </div>
  );
}
