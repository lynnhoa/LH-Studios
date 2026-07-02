// ─────────────────────────────────────────────────────────────
// ProjectsTab — all projects across all clients
// Expandable rows, filter/sort, docs, full action workflow
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, today, uid, addM } from "./formatters";
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
    if (isExpanded) getPDFModal().then(setPDFModal);
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

          {/* Delivery date */}
          {["quoted","revised","contracted","production","invoiced","paid"].includes(pr.status) && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: isMobile ? 12 : 8 }}>
              <span style={{ fontSize: TYPE.micro.size, color: C.muted, whiteSpace: "nowrap" as const, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Delivery</span>
              <I
                type="date"
                value={pr.deliveryDate || ""}
                onChange={(e: any) => { const nv = e.target.value; if (!nv) return; if (!pr.deliveryDate || nv > pr.deliveryDate) upP({ deliveryDate: nv }); }}
                s={{ width: isMobile ? 160 : 138, fontSize: TYPE.micro.size, padding: isMobile ? "9px 10px" : "5px 8px" }}
              />
            </div>
          )}

          {/* Production — deliverable progress + manager checkboxes */}
          {pr.status === "production" && <>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase" as const, marginBottom: 5 }}>Production</div>
            <ProductionSection pr={pr} clients={clients} cl={cl} upP={upP} isMobile={isMobile} />
          </>}

          {/* License tracker */}
          <ProjectLicenseTracker pr={pr} />

          {/* Notes */}
          {pr.notes && (
            <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "0 0 7px", lineHeight: 1.6 }}>{pr.notes}</p>
          )}

          {/* Documents */}
          <div style={{ display: "flex", gap: isMobile ? 8 : 5, flexWrap: "wrap" as const, marginBottom: isMobile ? 10 : 7 }}>
            {!pr.qd && (
              <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }} onClick={() => onGoToCalc(pr._cname)}>+ Create Quote</B>
            )}
            {pr.qd && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }} onClick={() => openPDF("quote")}>
                {pr.qd.rev > 0 ? `Quote R${pr.qd.rev}` : "Quote"}
              </B>
            )}
            {["contracted","production","invoiced","paid"].includes(pr.status) && pr.qd && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }} onClick={() => openPDF("contract")}>
                {pr.qd.contractRev > 0 ? `Contract R${pr.qd.contractRev}` : "Contract"}
              </B>
            )}
            {!isMobile && (pr.amendments || []).map((a: any, ai: number) => (
              <B key={ai} v="sec"
                s={{ fontSize: TYPE.micro.size, color: a.signed ? C.black : C.amber, borderColor: a.signed ? C.rule : C.amber }}
                onClick={() => setPdf({ data: { brand: pr.qd?.brand, contact: pr.qd?.contact, date: today(), ctype: pr.qd?.ctype || "Content Creator", qNo: pr.qd?.qNo, aNo: a.aNo, lines: a.lines || [], amendTotal: a.amendTotal, origTotal: pr.amount - a.amendTotal }, type: "amendment", readOnly: true })}
              >
                Amend {ai + 1}{!a.signed ? " · unsigned" : ""}
              </B>
            ))}
            {["invoiced","paid"].includes(pr.status) && pr.qd && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, padding: isMobile ? "9px 14px" : "5px 10px" }} onClick={() => openPDF("invoice")}>Invoice</B>
            )}
            {(pr.renewals || []).map((r: any, ri: number) => (
              r.doc && (
                <B key={ri} v="sec"
                  s={{ fontSize: TYPE.micro.size, color: r.paid ? C.black : C.green, borderColor: r.paid ? C.rule : C.green, padding: isMobile ? "9px 14px" : "5px 10px" }}
                  onClick={() => setPdf({ data: r.doc, type: "renewal", readOnly: true })}
                >
                  Renewal {ri + 1}
                </B>
              )
            ))}
            {pr.qd?.retainer && (pr.monthlyInvoices || []).map((inv: any, ii: number) => (
              inv.doc && (
                <B key={ii} v="sec"
                  s={{ fontSize: TYPE.micro.size, color: inv.paid ? C.black : C.green, borderColor: inv.paid ? C.rule : C.green, padding: isMobile ? "9px 14px" : "5px 10px" }}
                  onClick={() => setPdf({ data: inv.doc, type: "invoice", isMonthlyInv: true, monthlyIdx: ii })}
                >
                  Invoice M{String(ii + 1).padStart(2, "0")}
                </B>
              )
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: isMobile ? 8 : 5, flexWrap: "wrap" as const, alignItems: "center", paddingTop: isMobile ? 10 : 7, borderTop: `1px solid ${C.rule}` }}>

            {["quoted","revised"].includes(pr.status) && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => onRevise(pr, cl)}>Revise Quote</B>
              <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px" }}
                onClick={() => { setStatus("contracted"); openPDF("contract", { ...pr, status: "contracted" }); }}>
                → Contract
              </B>
            </>}

            {pr.status === "contracted" && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }}
                onClick={() => {
                  const q = pr.qd; const nextRev = (q?.contractRev || 0) + 1;
                  const iNo = `INV-${(q?.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
                  setPdf({ data: { brand: q?.brand, contact: q?.contact, date: today(), validUntil: q?.validUntil, qNo: q?.qNo, rev: q?.rev || 0, contractRev: nextRev, clauses: q?.clauses || [], iNo, delivery: pr.deliveryDate, ctype: q?.ctype || "Content Creator", lines: q?.lines || [], amendments: pr.amendments || [], total: pr.amount, footer: "Looking forward to working together." }, type: "contract", isRevision: true, nextContractRev: nextRev });
                }}>
                Revise Contract
              </B>
              <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px" }} onClick={() => setStatus("production")}>Mark Signed</B>
            </>}

            {pr.status === "production" && (pr.qd?.retainer ? (() => {
              // ── Retainer monthly-invoice cycle (verbatim old-app logic) ──
              const mis      = pr.monthlyInvoices || [];
              const retMo    = pr.qd?.retMo || 1;
              const nextN    = mis.length + 1;
              const allDone  = mis.length >= retMo;
              const lastPaid = mis.length > 0 && mis[mis.length - 1].paid;
              const canNext  = mis.length === 0 || lastPaid;
              return (<>
                {mis.map((inv: any, ii: number) => (
                  <span key={inv.id || ii} style={{ display: "contents" }}>
                    {!inv.paid && (
                      <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green, padding: isMobile ? "10px 14px" : "7px 14px" }}
                        onClick={() => {
                          const newMis = mis.map((inv2: any, i2: number) => i2 === ii ? { ...inv2, paid: true } : inv2);
                          const allPaid = newMis.length >= retMo && newMis.every((v: any) => v.paid);
                          upP({ monthlyInvoices: newMis, paid: allPaid, status: allPaid ? "paid" : pr.status });
                        }}>
                        Mark M{ii + 1} Paid
                      </B>
                    )}
                    <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "10px 14px" : "7px 14px" }}
                      onClick={() => upP({ monthlyInvoices: mis.filter((_: any, i2: number) => i2 !== ii), paid: false, status: "production" })}>
                      Undo M{ii + 1}
                    </B>
                  </span>
                ))}
                {!allDone && canNext && (
                  <B s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px" }}
                    onClick={() => {
                      const q = pr.qd;
                      const baseINo = `INV-${(q?.qNo || "").replace("QUO", "").trim() || "001"}`;
                      const iNo = `${baseINo}-M${String(nextN).padStart(2, "0")}`;
                      const skip = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
                      const monthlyLines = (q?.lines || []).map((l: any) => ({
                        ...l,
                        amt: skip.some((sk: string) => (l.name || "").toLowerCase().includes(sk))
                          ? parseFloat(l.amt) || 0
                          : Math.round((parseFloat(l.amt) || 0) * 0.8),
                        up: parseFloat(l.up) || 0,
                      }));
                      const monthlyAmt = Math.round(monthlyLines.reduce((s2: number, l: any) => s2 + (parseFloat(l.amt) || 0), 0));
                      const data = { brand: q?.brand, contact: q?.contact, date: today(), qNo: q?.qNo, iNo, delivery: today(), ctype: q?.ctype || "Content Creator", lines: monthlyLines, total: monthlyAmt, retainer: true, retMo: q?.retMo, footer: "Thank you for the pleasure of working together." };
                      setPdf({ data, type: "invoice", isMonthlyInv: true });
                    }}>
                    Create Invoice {nextN}/{retMo}
                  </B>
                )}
              </>);
            })() : (
              <B
                s={{ fontSize: TYPE.micro.size, padding: isMobile ? "10px 18px" : "7px 14px", opacity: pr.deliveryDate ? 1 : 0.35, cursor: pr.deliveryDate ? "pointer" : "not-allowed" as const }}
                title={pr.deliveryDate ? "" : "Set a delivery date first"}
                onClick={() => { if (!pr.deliveryDate) return; setStatus("invoiced"); openPDF("invoice"); }}
              >
                Create Invoice
              </B>
            ))}

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

            {(pr.renewals || []).map((r: any, ri: number) => (
              <span key={r.id || ri} style={{ display: "contents" }}>
                {!r.paid && (
                  <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green, padding: isMobile ? "10px 14px" : "7px 14px" }}
                    onClick={() => clientsHook.updateRenewal(cl.id, pr.id, r.id, { paid: true })}>
                    Mark Renewal {ri + 1} Paid
                  </B>
                )}
                {!r.paid && (
                  <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber, padding: isMobile ? "10px 14px" : "7px 14px" }}
                    onClick={() => clientsHook.deleteRenewal(cl.id, pr.id, r.id)}>
                    Undo Renewal {ri + 1}
                  </B>
                )}
              </span>
            ))}

            {!pr.paid && pr.status !== "quoted" && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted, padding: isMobile ? "10px 14px" : "7px 14px" }}
                onClick={() => { const p = prv(pr.status); if (p) setStatus(p); }}>
                Undo
              </B>
            )}

            {["production","invoiced","paid"].includes(pr.status) && pr.qd && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted, padding: isMobile ? "10px 14px" : "7px 14px" }}
                onClick={() => onAmend(pr, cl)}>
                + Amend
              </B>
            )}
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
