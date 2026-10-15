// ─────────────────────────────────────────────────────────────
// ProjectsTab — all projects across all clients
// Expandable rows, filter/sort, documents, full action workflow.
// Documents are frozen rows; tapping a chip opens the document
// modal with its status actions (Mark sent, Finalize, Mark paid …).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, SERIF, TYPE, expiryColor, expiryTint } from "./constants";
import { fmt, fmtD, fmtE, today, addM, dLeft } from "./formatters";
import { I, B, TSel, TSelWrap, StatusBadge, ConfirmDialog } from "./atoms";
import RenewalModal from "./RenewalModal";
import ProductionSection from "./ProductionSection";
import PDFModal from "./PDFModal";
import type { DocAction } from "./PDFModal";
import {
  sortDocs, docLabel, currentContract, projectInvoice, monthlyInvoices, nextRetainerMonth,
  renewalInvoice, amendmentDoc,
} from "./docs";
import type { DocRecord } from "./types";

// Document chip dot colour by status
const dotCol = (st: string) => ({
  draft: C.light, sent: C.amber, signed: C.green, paid: C.green, cancelled: C.red, superseded: C.rule,
}[st] ?? C.light);

// ── License tracker (inline mini) ────────────────────────────
function LicenseLine({ label, end }: { label: string; end: string }) {
  const d   = dLeft(end) ?? 0;
  const col = expiryColor(d);
  const bg  = expiryTint(d);
  const bd  = col;
  const txt = d < 0 ? `${Math.abs(d)}d expired` : `${d}d left`;
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
  pr, clients, isMobile, isExpanded, onToggle, clientsHook, onRevise, onAmend, onGoToCalc, settings, onModalClosed, rc,
}: {
  pr: any; clients: any[]; isMobile: boolean; isExpanded: boolean;
  onToggle: () => void; clientsHook: any;
  onRevise: (pr: any, cl: any) => void;
  onAmend: (pr: any, cl: any) => void;
  onGoToCalc: (name: string, leadId?: string) => void;
  rc?:        any;
  settings: any;
  onModalClosed: () => void;
}) {
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [legacyQuote, setLegacyQuote] = useState(false);
  const [renewT,    setRenewT]    = useState<any>(null);
  const [amendT,    setAmendT]    = useState<any>(null);
  const [busy,      setBusy]      = useState(false);
  const [rowErr,    setRowErr]    = useState<string | null>(null);
  const [dialog,    setDialog]    = useState<any>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // An open document that was deleted (draft removed) → close the modal
  useEffect(() => {
    if (openDocId && !(pr.documents || []).some((d: any) => d.id === openDocId)) setOpenDocId(null);
  }, [openDocId, pr.documents]);

  const h      = clientsHook;
  const cl     = { id: pr._cid, name: pr._cname };
  const client = clients.find((c: any) => c.id === pr._cid);
  const cid    = pr._cid;
  const pid    = pr.id;
  const upP    = (data: any) => h.updateProject(cid, pid, data);

  const docs    = sortDocs((pr.documents || []) as DocRecord[]);
  const con     = currentContract(pr);
  const pInv    = projectInvoice(pr);
  const isRet   = !!pr.qd?.retainer;
  const months  = monthlyInvoices(pr);
  const nextM   = isRet ? nextRetainerMonth(pr) : null;
  const draftM  = months.find(d => d.status === "draft");
  const prevM   = months.length ? months[months.length - 1] : null;

  // Run a row action; errors show under the action row
  const act = async (fn: () => Promise<any>) => {
    if (busy) return;
    setBusy(true); setRowErr(null);
    try { await fn(); }
    catch (e: any) { setRowErr(e?.message || "Something went wrong"); }
    finally { setBusy(false); }
  };
  const openDoc = (d: DocRecord | null | undefined) => { if (d) setOpenDocId(d.id); };

  // ── Status actions for one document (shown in the document modal) ──
  const docActions = (d: DocRecord): DocAction[] => {
    const close = () => { setOpenDocId(null); onModalClosed(); };
    if (d.kind === "quote" && d.status === "draft") return [
      { key: "sent", label: "Mark sent", kind: "sec", run: () => h.markDocSent(cid, pid, d.id, settings) },
    ];
    if (d.kind === "contract") {
      const sign: DocAction = { key: "signed", label: "Mark signed", kind: "pri", date: "Signed on", run: (dt?: string) => h.markContractSigned(cid, pid, d.id, dt || today(), settings) };
      if (d.status === "draft") return [{ key: "sent", label: "Mark sent", kind: "sec", run: () => h.markDocSent(cid, pid, d.id, settings) }, sign];
      if (d.status === "sent")  return [sign];
      return [];
    }
    if (d.kind === "amendment" && d.status === "draft") return [
      { key: "sent", label: "Mark sent", kind: "sec", run: () => h.markDocSent(cid, pid, d.id, settings) },
      { key: "remove", label: "Remove amendment", kind: "danger", confirm: "The amendment is removed and its amount is taken off the project.", run: async () => { if (d.amendmentId) await h.removeAmendment(cid, pid, d.amendmentId); else await h.deleteDraftDocument(cid, pid, d.id); close(); } },
    ];
    if (d.kind === "invoice" && d.subtype !== "storno") {
      if (d.status === "draft") return [
        { key: "delete", label: "Delete draft", kind: "danger", confirm: "The draft is deleted. No invoice number has been used yet.", run: async () => { await h.cancelInvoice(cid, pid, d.id, settings); close(); } },
        { key: "final", label: "Finalize", kind: "pri", confirm: "This assigns the next invoice number and locks the invoice. Download and send it afterwards.", run: () => h.finalizeInvoice(cid, pid, d.id, settings) },
      ];
      if (d.status === "sent") return [
        { key: "cancel", label: "Cancel invoice", kind: "danger", confirm: "Creates a cancellation invoice (Storno) with its own number. The original stays on file.", run: async () => { const st = await h.cancelInvoice(cid, pid, d.id, settings); if (st) setOpenDocId(st.id); } },
        { key: "paid", label: "Mark paid", kind: "pri", date: "Paid on", run: (dt?: string) => h.markInvoicePaid(cid, pid, d.id, dt || today()) },
      ];
      if (d.status === "paid") return [
        { key: "cancel", label: "Cancel invoice", kind: "danger", confirm: "Creates a cancellation invoice (Storno) with its own number. The original stays on file.", run: async () => { const st = await h.cancelInvoice(cid, pid, d.id, settings); if (st) setOpenDocId(st.id); } },
        { key: "unpaid", label: "Mark unpaid", kind: "sec", run: () => h.markInvoiceUnpaid(cid, pid, d.id) },
      ];
    }
    return [];
  };

  const docNote = (d: DocRecord): string | undefined => {
    if (d.status !== "draft") return undefined;
    if (d.kind === "invoice")  return "Draft — the invoice number is assigned when you tap Finalize.";
    if (d.kind === "quote")    return "Draft — editable until you mark it sent. After that, changes become a new revision.";
    if (d.kind === "contract") return "Draft — editable until it's marked sent or signed.";
    return "Draft — editable until you mark it sent.";
  };

  // ── Modals ──
  if (renewT) {
    return (
      <RenewalModal
        p={renewT}
        rc={rc || {}}
        settings={settings}
        client={client}
        onClose={() => { setRenewT(null); onModalClosed(); }}
        onSave={async (r: any, doc: any) => {
          const d = await h.addRenewalWithInvoice(cid, pid, r, doc, settings);
          setRenewT(null);
          setOpenDocId(d.id);
        }}
      />
    );
  }

  if (amendT) {
    return (
      <RenewalModal
        mode="amend"
        p={amendT}
        rc={rc || {}}
        settings={settings}
        client={client}
        onClose={() => { setAmendT(null); onModalClosed(); }}
        onCalc={() => { setAmendT(null); onModalClosed(); onAmend(pr, cl); }}
        onSave={async (a: any, doc: any) => {
          const d = await h.addAmendmentWithDoc(cid, pid, a, doc, settings);
          setAmendT(null);
          setOpenDocId(d.id);
        }}
      />
    );
  }

  const openD = openDocId ? docs.find(d => d.id === openDocId) : null;
  if (openD) {
    return (
      <PDFModal
        key={openD.id}
        doc={openD}
        settings={settings}
        client={client}
        editable={openD.status === "draft"}
        note={docNote(openD)}
        onSave={async (next) => { await h.updateDocument(cid, pid, openD.id, next, settings); }}
        actions={docActions(openD)}
        onClose={() => { setOpenDocId(null); onModalClosed(); }}
      />
    );
  }

  // Old projects without a quote document: show the quote read-only
  if (legacyQuote && pr.qd) {
    return (
      <PDFModal
        doc={{ kind: "quote", docNo: pr.qd.qNo || "", revision: pr.qd.rev || 0, status: "sent", docDate: pr.qd.date || pr.date || today(), lang: "en", data: pr.qd }}
        settings={settings} client={client} editable={false}
        onClose={() => { setLegacyQuote(false); onModalClosed(); }}
      />
    );
  }

  const pad = isMobile ? "16px 0" : "12px 0";
  const hasQuoteDoc = docs.some(d => d.kind === "quote");
  const amendDocsDraft = (a: any) => { const d = amendmentDoc(pr, a.id); return !d || d.status === "draft"; };

  return (
    <div ref={rowRef} data-prid={pr.id} style={{ borderBottom: `1px solid ${C.rule}`, opacity: pr.paid ? 0.55 : 1 }}>

      {dialog && (
        <ConfirmDialog
          title={dialog.title} text={dialog.text} dateLabel={dialog.dateLabel} okLabel={dialog.okLabel} danger={dialog.danger}
          onCancel={() => setDialog(null)}
          onOk={(date: string) => { const dg = dialog; setDialog(null); act(() => dg.run(date)); }}
        />
      )}

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
                <span style={{ display: "inline-block", marginTop: 3 }}><StatusBadge status={pr.paid ? "paid" : pr.status} /></span>
              </div>
              <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0, marginLeft: 12 }}>{pr.deliveryDate ? fmtD(pr.deliveryDate) : "—"}</span>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 110px", alignItems: "center" }}>
            <div style={{ minWidth: 0, paddingRight: 12 }}>
              <div style={{ fontSize: TYPE.micro.size, color: C.muted, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr._cname}</div>
              <div style={{ fontSize: TYPE.subtext.size, color: C.black, fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr.name}</div>
              <span style={{ display: "inline-block", marginTop: 3 }}><StatusBadge status={pr.paid ? "paid" : pr.status} /></span>
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
                      s={{ width: isMobile ? 140 : 150, padding: "5px 8px" }}
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
              {(pr.qd.lines || []).map((ln: any, li: number) => {
                const qty = Math.max(1, parseInt(ln.qty) || 1);
                const amt = parseFloat(ln.amt) || 0;
                return (
                  <div key={li} style={{ marginBottom: li < (pr.qd.lines || []).length - 1 ? 8 : 0, paddingBottom: li < (pr.qd.lines || []).length - 1 ? 8 : 0, borderBottom: li < (pr.qd.lines || []).length - 1 ? `1px solid ${C.rule}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: 500 }}>{qty > 1 ? `${qty}× ` : ""}{ln.name}</span>
                      {ln.usageLabel && <span style={{ fontSize: TYPE.micro.size, color: C.muted, padding: "1px 5px", border: `1px solid ${C.rule}`, borderRadius: 2 }}>{ln.usageLabel}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: TYPE.label.size }}>
                      <span style={{ color: C.muted }}>{qty > 1 ? `${fmtE(amt / qty)} € each` : "Rate"}</span>
                      <span style={{ fontFamily: SERIF, fontSize: TYPE.body.size, color: C.black }}>{fmt(amt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. BUILD QUOTE */}
          {!pr.qd && (
            <div style={{ marginBottom: 12 }}>
              <B s={{ fontSize: TYPE.micro.size, padding: "8px 14px", width: "100%" }} onClick={() => onGoToCalc(pr._cname, pr.id)}>+ Create quote</B>
            </div>
          )}

          {/* 4. DOCUMENTS */}
          {(docs.length > 0 || pr.qd) && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Documents</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                {!hasQuoteDoc && pr.qd && (
                  <B v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px" }} onClick={() => setLegacyQuote(true)}>Quote</B>
                )}
                {docs.map(d => (
                  <B key={d.id} v="sec"
                    s={{ fontSize: TYPE.micro.size, padding: "5px 10px", gap: 6, color: d.status === "superseded" ? C.light : C.black, textDecoration: d.status === "superseded" || d.status === "cancelled" ? "line-through" : "none" }}
                    onClick={() => openDoc(d)}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotCol(d.status), display: "inline-block", flexShrink: 0 }} />
                    {docLabel(d, pr)}
                  </B>
                ))}
              </div>
            </div>
          )}

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
          <div style={{ display: "flex", gap: isMobile ? 6 : 5, flexWrap: "wrap" as const, paddingTop: 10, borderTop: `1px solid ${C.rule}`, opacity: busy ? 0.5 : 1 }}>

            {["quoted","revised"].includes(pr.status) && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => onRevise(pr, cl)}>Revise quote</B>
              <B s={{ fontSize: TYPE.micro.size }} onClick={() => act(async () => openDoc(await h.createContract(cid, pid, settings)))}>Create contract</B>
            </>}

            {pr.status === "contracted" && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => act(async () => openDoc(await h.reviseContract(cid, pid, settings)))}>
                {con?.status === "draft" ? "Edit contract" : "Revise contract"}
              </B>
              {con && (
                <B s={{ fontSize: TYPE.micro.size }} onClick={() => setDialog({ title: "Mark signed", dateLabel: "Signed on", okLabel: "Mark signed", run: (dt: string) => h.markContractSigned(cid, pid, con.id, dt, settings) })}>Mark signed</B>
              )}
            </>}

            {pr.status === "production" && !isRet && (
              pInv && pInv.status === "draft"
                ? <B s={{ fontSize: TYPE.micro.size }} onClick={() => openDoc(pInv)}>Open invoice draft</B>
                : <B s={{ fontSize: TYPE.micro.size, opacity: pr.deliveryDate ? 1 : 0.35, cursor: pr.deliveryDate ? "pointer" : "not-allowed" as const }}
                    title={pr.deliveryDate ? "" : "Set the delivery date first"}
                    onClick={() => { if (pr.deliveryDate) act(async () => openDoc(await h.createProjectInvoice(cid, pid, settings))); else setRowErr("Set the delivery date first."); }}>
                    Create invoice
                  </B>
            )}

            {pr.status === "production" && isRet && (
              draftM
                ? <B s={{ fontSize: TYPE.micro.size }} onClick={() => openDoc(draftM)}>Open M{String(draftM.monthNo || "").padStart(2, "0")} draft</B>
                : nextM
                  ? <B s={{ fontSize: TYPE.micro.size }} onClick={() => act(async () => openDoc(await h.createMonthlyInvoice(cid, pid, settings)))}>Create invoice M{String(nextM).padStart(2, "0")}</B>
                  : null
            )}

            {pr.status === "invoiced" && !pr.paid && pInv && (
              <B s={{ fontSize: TYPE.micro.size }} onClick={() => setDialog({ title: "Mark paid", dateLabel: "Paid on", okLabel: "Mark paid", run: (dt: string) => h.markInvoicePaid(cid, pid, pInv.id, dt) })}>Mark paid</B>
            )}

            {pr.paid && !isRet && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.green, borderColor: C.green }} onClick={() => setRenewT(pr)}>Add renewal</B>
              {pInv && pInv.status === "paid" && (
                <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber }} onClick={() => setDialog({ title: "Undo paid", text: "The invoice goes back to unpaid.", okLabel: "Undo paid", run: () => h.markInvoiceUnpaid(cid, pid, pInv.id) })}>Undo paid</B>
              )}
            </>}

            {(pr.renewals || []).map((r: any, ri: number) => {
              const inv = renewalInvoice(pr, r.id);
              if (inv && inv.status !== "draft") return null;
              return (
                <B key={r.id || ri} v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber }}
                  onClick={() => setDialog({ title: `Undo renewal ${ri + 1}`, text: "The renewal and its draft invoice are removed.", okLabel: "Undo renewal", danger: true, run: () => h.removeRenewal(cid, pid, r.id) })}>
                  Undo R{ri + 1}
                </B>
              );
            })}

            {["revised","contracted","production"].includes(pr.status) && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => setDialog({ title: "Back one step", text: pr.status === "production" ? "The contract goes back to not signed." : pr.status === "contracted" ? "The contract is withdrawn (a draft is deleted, a sent one is kept as replaced)." : "The project goes back to Quoted.", okLabel: "Back one step", run: () => h.undoContract(cid, pid) })}>← Back one step</B>
            )}

            {["production","invoiced","paid"].includes(pr.status) && pr.qd && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => setAmendT(pr)}>+ Amend</B>
            )}

            {(pr.amendments || []).map((a: any, ai: number) => amendDocsDraft(a) && (
              <B key={a.id || ai} v="sec" s={{ fontSize: TYPE.micro.size, color: C.amber }}
                onClick={() => setDialog({ title: `Undo amendment ${ai + 1}`, text: "The amendment is removed and its amount is taken off the project.", okLabel: "Undo amendment", danger: true, run: () => h.removeAmendment(cid, pid, a.id) })}>
                Undo amend {ai + 1}
              </B>
            ))}
          </div>

          {isRet && pr.status === "production" && !draftM && nextM && prevM && prevM.status !== "paid" && (
            <p style={{ fontSize: TYPE.label.size, color: C.amber, margin: "8px 0 0" }}>M{String(prevM.monthNo || "").padStart(2, "0")} is not paid yet.</p>
          )}
          {rowErr && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "8px 0 0" }}>{rowErr}</p>}
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
  onGoToCalc:       (name: string, leadId?: string) => void;
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
    const match = all.find((pr: any) => pr.id === pendingProjectQNo || pr.qd?.qNo === pendingProjectQNo);
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
    if (sortOrder === "oldest")  return String(a.date || "").localeCompare(String(b.date || ""));
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

  const done  = all.filter((pr: any) => pr.paid).sort((a: any, b: any) => String(b.date || "").localeCompare(String(a.date || "")));

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

      {/* ── FILTER + SORT — standard list toolbar: text selects, top right ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <TSelWrap>
          <TSel value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
            {FILTERS.map(([val, lbl]) => <option key={val} value={val}>{`Filter: ${lbl}`}</option>)}
          </TSel>
        </TSelWrap>
        <TSelWrap>
          <TSel value={sortOrder} onChange={(e: any) => setSortOrder(e.target.value)}>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="amount">Sort: Amount</option>
          </TSel>
        </TSelWrap>
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
            rc={rc}
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
              rc={rc}
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
