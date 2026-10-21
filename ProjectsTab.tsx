// ─────────────────────────────────────────────────────────────
// ProjectsTab — all projects across all clients
// Expandable rows, filter/sort, documents, full action workflow.
// Documents are frozen rows; tapping a chip opens the document
// modal with its status actions (Mark sent, Finalize, Mark paid …).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, SERIF, SANS, TYPE, expiryColor, expiryTint, PAL, STATUS_TONE, STATUS_NAME, WORDS, TRACK, RADIUS, ICON } from "./constants";
import { signedOpen, followUp, validUntil, currentContractOf, daysSince, toInvoice, openAmendments, backStepBlock, paidNet } from "./money";
import { workOpen } from "./wsHelpers";
import { fmt, fmtD, fmtE, today, addM, dLeft } from "./formatters";
import { projectLicenses, ACTION_LABEL, licenseTone, licenseTag } from "./licenses";
import { pdfFlow, finalizeQuestion, invoiceActions } from "./docFlow";
import { toSignedPdf, openSignedCopy } from "./signedPdf";
import { I, B, TSel, TSelWrap, StatusBadge, ConfirmDialog, TonedTag, SummaryLine, Strong, SectionHead, listSeg, ListCard } from "./atoms";
import RenewalModal from "./RenewalModal";
import ProductionSection from "./ProductionSection";
import PDFModal from "./PDFModal";
import type { DocAction } from "./PDFModal";
import { sortDocs, docLabel, currentContract, currentQuote, projectInvoice, monthlyInvoices, nextRetainerMonth, renewalInvoice, amendmentDoc, docsOf, isPaidInvoice, isOpenInvoice, DOC_TONE, STATUS_LABEL, stageTag } from "./docs";
import type { DocRecord } from "./types";

// Document chip dot colour by status
// ── License tracker: one row per license with the Licenses page's tag ──
function ProjectLicenseTracker({ pr }: { pr: any }) {
  const lic = projectLicenses(pr);
  if (!lic.length) return null;
  return (
    <div style={{ marginBottom: 8, marginTop: 4 }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, margin: "0 0 2px" }}>Licenses</p>
      {lic.map((l, k) => (
        <div key={l.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 34, borderTop: k ? `1px solid ${C.hair}` : "none" }}>
          <span style={{ fontSize: TYPE.label.size, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {l.label}{l.extended ? " (renewed)" : ""} <span style={{ color: C.muted }}>· {fmtD(l.end)}</span>
          </span>
          <TonedTag tone={licenseTone(l)}>{licenseTag(l)}</TonedTag>
        </div>
      ))}
    </div>
  );
}

// Days since the project entered its current status
const sinceDays = (pr: any): number | null => {
  const h = (pr.statusHistory || []).filter((x: any) => x.status === pr.status).pop();
  const at = h?.at || null;
  if (!at) return null;
  const d = dLeft(at);
  return d === null ? null : Math.max(0, -d);
};

// ── Single expandable project row ─────────────────────────────
// One project card — Projects and the client page use this same card (one source).
// showStatus: on the client page the grey line starts with the status word, not the client.
// an amendment by its own number ("AMD 02" from AMD-2026-019-02); the list place only before it has one
const amendShort = (a: any, i: number) => (a?.aNo ? `AMD ${String(a.aNo).split("-").pop()}` : `amendment ${i + 1}`);

export function ProjectRow({
  pr, clients, isMobile, isExpanded, onToggle, clientsHook, onRevise, onAmend, onGoToCalc, settings, onModalClosed, rc, onOpenClient, onAskDelivery, showStatus,
}: {
  onOpenClient?: (clientId: string, projectId?: string) => void;
  showStatus?: boolean;
  onAskDelivery?: (p: { cid: string; pid: string; name: string }) => void;
  pr: any; clients: any[]; isMobile: boolean; isExpanded: boolean;
  onToggle: () => void; clientsHook: any;
  onRevise: (pr: any, cl: any) => void;
  onAmend: (pr: any, cl: any) => void;
  onGoToCalc: (clientId: string, leadId?: string) => void;
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
  const signRef = useRef<HTMLInputElement>(null);    // the hidden picker for the signed copy
  const signFor = useRef<any>(null);
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
  // the one next step of this stage: dark, first, full width on the phone
  const NEXT: any = { order: -1, fontSize: TYPE.body.size, minHeight: 42, ...(isMobile ? { flexBasis: "100%" } : { paddingLeft: 20, paddingRight: 20 }) };
  // signed without a delivery date → ask once (can be skipped; invoices and licenses need it).
  // The question lives in the Projects tab: after signing, this row moves to the Production group.
  const askDelivery = () => { if (!pr.deliveryDate && onAskDelivery) onAskDelivery({ cid, pid, name: pr.name }); };
  // undo "lost": back to the quote status it had before
  const prevQuoteStatus = () => {
    const h = [...(pr.statusHistory || [])].reverse().find((x: any) => x.status === "quoted" || x.status === "revised");
    return h ? h.status : "quoted";
  };

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
  const flow = pdfFlow(h, cid, pid, settings);

  // In the document window: the main button (right) is the next step, "side" sits on the
  // left, "more" under the page. Sending itself is the window's own "Send to client".
  const docActions = (d: DocRecord): DocAction[] => {
    const close = () => { setOpenDocId(null); onModalClosed(); };
    if (d.kind === "quote") {
      // the current sent quote can be revised (as long as no contract exists)
      const cur = currentQuote(pr);
      if (d.status === "sent" && cur && cur.id === d.id && ["quoted", "revised"].includes(pr.status)) return [
        { key: "revise", label: "Revise", slot: "side", run: () => { close(); onRevise(pr, cl); } },
      ];
      return [];
    }
    if (d.kind === "contract" || d.kind === "amendment") {
      const isCon = d.kind === "contract";
      const signNow = async (dt?: string) => {
        if (isCon) { await h.markContractSigned(cid, pid, d.id, dt || today(), settings); askDelivery(); }
        else await h.markAmendmentSigned(cid, pid, d.id, dt || today(), settings);
      };
      const sign: DocAction = { key: "signed", label: "Mark signed", slot: "main", date: "Signed on", run: signNow };
      // the client's signed copy (always stored as one PDF): attaching it signs a document that isn't signed yet
      const attach = (label: string, slot: DocAction["slot"], withDate: boolean): DocAction => ({
        key: `attach-${label}`, label, slot, file: true, date: withDate ? "Signed on" : undefined,
        run: async (dt?: string, files?: File[]) => {
          const pdf = await toSignedPdf(files);
          const wasSigned = d.status === "signed";
          await h.attachSignedCopy(cid, pid, d.id, pdf, dt || null, settings);
          if (!wasSigned && isCon) askDelivery();
        },
      });
      if (d.status === "draft") return [
        ...((isCon ? [] : [{ key: "remove", label: "Remove amendment", kind: "danger", slot: "more", confirm: "The amendment draft is removed. The project value doesn't change (it only counts once signed).", run: async () => { if (d.amendmentId) await h.removeAmendment(cid, pid, d.amendmentId); else await h.deleteDraftDocument(cid, pid, d.id); close(); } }]) as DocAction[]),
        { ...sign, slot: "more" },                                  // signed without sending (in person)
        attach("Attach signed copy", "more", true),
      ];
      if (d.status === "sent") return [attach("Attach signed copy", "main", true), { ...sign, slot: "more" }];
      if (d.status === "signed") return d.signedFile
        ? [
            { key: "openCopy", label: "Open signed copy", slot: "side", run: () => openSignedCopy(d, pr._cname || cl?.name || "") },
            attach("Replace signed copy", "more", false),
            { key: "removeCopy", label: "Remove signed copy", kind: "danger", slot: "more", confirm: `The signed copy is deleted. The ${isCon ? "contract" : "amendment"} stays signed.`, run: () => h.removeSignedCopy(cid, pid, d.id) },
          ]
        : [attach("Attach signed copy", "side", false)];
      return [];
    }
    // invoices: the one shared list (docFlow) — the same actions as on the Invoices and Licenses pages
    if (d.kind === "invoice") return invoiceActions(h, cid, pid, d, settings, { storno: (id) => setOpenDocId(id), deleted: close });
    return [];
  };

  const docNote = (d: DocRecord): string | undefined => {
    if ((d.kind === "contract" || d.kind === "amendment") && d.status === "signed") {
      const f = d.signedFile;
      return f ? `Signed ${fmtD(d.signedAt)} · signed copy${f.pages ? ` · ${f.pages} ${f.pages === 1 ? "page" : "pages"}` : ""}` : `Signed ${fmtD(d.signedAt)} · no signed copy yet`;
    }
    if (d.status !== "draft") return undefined;
    if (d.kind === "invoice")  return "Draft — Send to client gives it its number (you're asked first).";
    if (d.kind === "quote")    return "Draft — Send to client marks it as sent once you've shared it. Later changes become a new revision.";
    return "Draft — Send to client marks it as sent once you've shared it.";
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
        onSave={async (next) => h.updateDocument(cid, pid, openD.id, next, settings)}
        onPdf={flow.prepare}
        pdfConfirm={flow.confirmFor}
        sendBlock={flow.blockFor}
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
    <div ref={rowRef} data-prid={pr.id} style={{ borderBottom: `1px solid ${C.hair}`, opacity: pr.paid && !isExpanded ? 0.55 : 1 }}>   {/* paid: only the folded line is faded, never its buttons */}
      <input ref={signRef} type="file" accept="application/pdf,image/*" multiple aria-hidden="true" tabIndex={-1} style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []), doc = signFor.current; signFor.current = null;
          if (!doc || !files.length) return;
          setDialog({ title: "Attach signed copy", dateLabel: "Signed on", okLabel: "Attach signed copy",
            run: async (dt: string) => { const pdf = await toSignedPdf(files); await h.attachSignedCopy(cid, pid, doc.id, pdf, dt, settings); askDelivery(); } });
        }} />

      {dialog && (
        <ConfirmDialog
          title={dialog.title} text={dialog.text} dateLabel={dialog.dateLabel} okLabel={dialog.okLabel} danger={dialog.danger}
          onCancel={() => setDialog(null)}
          onOk={(date: string) => { const dg = dialog; setDialog(null); act(() => dg.run(date)); }}
        />
      )}

      {/* ── COLLAPSED ROW: name · client (opens Clients) · delivery / age ……… amount ── */}
      {(() => {
        const since = sinceDays(pr);
        const quote = !pr.paid && (pr.status === "quoted" || pr.status === "revised");
        const fu = followUp(pr, today());
        const tag = stageTag(pr);
        // a signed amendment on an invoiced / paid project that isn't invoiced yet
        const amendOpen = (pr.paid || pr.status === "invoiced") && openAmendments(pr).length > 0;
        const fuMeta = fu ? <span style={{ color: PAL[fu.tone].ink }}> · {fu.text}</span> : null;
        const ct = pr.status === "contracted" ? currentContractOf(pr) : null;
        const vu = quote ? validUntil(pr) : null;
        const meta = showStatus && pr.paid ? <>{pr.deliveryDate ? ` · delivered ${fmtD(pr.deliveryDate)}` : ""}</>
          : showStatus && (pr.status === "lost" || pr.status === "lead") ? null
          : showStatus && pr.status === "invoiced" ? fuMeta
          : pr.paid ? <> · <span style={{ color: PAL.done.ink }}>paid</span></>
          : pr.status === "lost" ? <> · lost</>
          : pr.status === "production"
            ? <> · {pr.deliveryDate ? `delivery ${fmtD(pr.deliveryDate)}` : <span style={{ color: PAL.waiting.ink }}>No delivery date</span>}{since != null ? ` · ${since} d` : ""}</>
          : pr.status === "contracted"
            ? (fuMeta || <> · {ct?.status === "sent" ? `contract sent ${daysSince(ct.sentAt || ct.docDate, today()) ?? 0} days ago` : ct ? "contract draft" : "contracted"}</>)
          : pr.status === "invoiced" ? (fuMeta || <> · <span style={{ color: PAL.waiting.ink }}>invoiced</span>{since != null ? ` · ${since} d` : ""}</>)
          : quote ? (fuMeta || <> · {vu ? `valid until ${fmtD(vu)}` : pr.status}</>)
          : <> · lead</>;
        return (
          <div onClick={onToggle} style={{ padding: "9px 0", minHeight: 54, boxSizing: "border-box" as const, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: SANS }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: TYPE.body.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr.name || "Untitled"}</span>
                {/^untitled project$/i.test(String(pr.name || "")) && <TonedTag tone={PAL.waiting}>Needs a name</TonedTag>}
              </div>
              <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                {showStatus
                  ? (() => { const st = pr.paid ? "paid" : pr.status; return <span style={{ color: PAL[STATUS_TONE[st] || "neutral"].ink }}>{STATUS_NAME[st] || st}</span>; })()
                  : onOpenClient
                  ? <button onClick={(e) => { e.stopPropagation(); onOpenClient(pr._cid, pr.id); }} aria-label={`Open client ${pr._cname}`}
                      style={{ background: "none", border: "none", padding: "9px 2px", margin: "-9px -2px", font: "inherit", color: "inherit", cursor: "pointer", textDecoration: "underline", textDecorationColor: C.pillOn, textUnderlineOffset: 2 }}>{pr._cname}</button>
                  : pr._cname}
                {meta}
              </div>
            </div>
            <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: pr.status === "lost" ? C.muted : C.black }}>{fmt(pr.amount)}</div>
              {/* one tag: Paid / Lost · Follow up / Overdue · else the state of the current document */}
              {fu ? <TonedTag tone={PAL[fu.tone]} s={{ marginTop: 3 }}>{fu.label}</TonedTag>
                : amendOpen ? <TonedTag tone={PAL.progress} s={{ marginTop: 3 }}>Amend to invoice</TonedTag>
                : (pr.paid || pr.status === "lost") ? <div style={{ marginTop: 3 }}><StatusBadge status={pr.paid ? "paid" : "lost"} /></div>
                : tag ? <TonedTag tone={PAL[tag.tone]} s={{ marginTop: 3 }}>{tag.label}</TonedTag> : null}
            </div>
            <span style={{ color: C.faint, fontSize: ICON.caret, flexShrink: 0 }}>{isExpanded ? "▴" : "▾"}</span>
          </div>
        );
      })()}

      {/* ── EXPANDED DETAIL ── */}
      {isExpanded && (
        <div style={{ paddingBottom: isMobile ? 16 : 12, paddingTop: 4 }}>

          {/* 1. DETAILS */}
          {pr.qd && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Details</p>
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
                      key={`dd-${pr.deliveryDate || ""}`}
                      defaultValue={pr.deliveryDate || ""}
                      // saved when you leave the field (typing a year doesn't save in-between dates); empty = no date
                      onBlur={(e: any) => { const nv = e.target.value || null; if (nv !== (pr.deliveryDate || null)) upP({ deliveryDate: nv }); }}
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
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Deliverables</p>
              {(pr.qd.lines || []).map((ln: any, li: number) => {
                const qty = Math.max(1, parseInt(ln.qty) || 1);
                const amt = parseFloat(ln.amt) || 0;
                return (
                  <div key={li} style={{ marginBottom: li < (pr.qd.lines || []).length - 1 ? 8 : 0, paddingBottom: li < (pr.qd.lines || []).length - 1 ? 8 : 0, borderBottom: li < (pr.qd.lines || []).length - 1 ? `1px solid ${C.rule}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: 500 }}>{qty > 1 ? `${qty}× ` : ""}{ln.name}</span>
                      {ln.usageLabel && <span style={{ fontSize: TYPE.micro.size, color: C.muted, padding: "1px 5px", border: `1px solid ${C.rule}`, borderRadius: RADIUS.field }}>{ln.usageLabel}</span>}
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
              <B s={{ fontSize: TYPE.micro.size, padding: "8px 14px", width: "100%" }} onClick={() => onGoToCalc(pr._cid, pr.id)}>+ Create quote</B>
            </div>
          )}

          {/* 4. DOCUMENTS */}
          {(docs.length > 0 || pr.qd) && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Documents</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                {!hasQuoteDoc && pr.qd && (
                  <B v="sec" s={{ fontSize: TYPE.micro.size, padding: "5px 10px" }} onClick={() => setLegacyQuote(true)}>Quote</B>
                )}
                {docs.map(d => {
                  // the whole chip in its status colour (draft grey · sent yellow · signed blue · paid green)
                  const t = PAL[DOC_TONE[d.status] || "neutral"];
                  return (
                    <B key={d.id} v="sec" title={`${docLabel(d, pr)} · ${STATUS_LABEL[d.status] || d.status}`}
                      s={{ fontSize: TYPE.micro.size, padding: "5px 12px", background: t.fill, border: `1px solid ${t.fill}`, color: d.status === "superseded" ? C.light : t.ink, textDecoration: d.status === "superseded" || d.status === "cancelled" ? "line-through" : "none" }}
                      onClick={() => openDoc(d)}>
                      {docLabel(d, pr)}
                      {(d.kind === "contract" || d.kind === "amendment") && d.status === "signed" && (d.signedFile
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="signed copy" style={{ marginLeft: 5, verticalAlign: "-1px" }}><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>
                        : <span style={{ marginLeft: 5, opacity: 0.75 }}>· no copy</span>)}
                    </B>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. PRODUCTION SECTION — in production, or invoiced with items still open (the Workspace's rule) */}
          {workOpen(pr) && (
            <ProductionSection pr={pr} clients={clients} cl={cl} upP={upP} isMobile={isMobile} clientsHook={clientsHook} />
          )}

          {/* 6. LICENSE TRACKER */}
          <ProjectLicenseTracker pr={pr} />

          {/* 7. NOTES */}
          {pr.notes && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "500" }}>Notes</p>
              <p style={{ fontSize: TYPE.body.size, color: C.muted, margin: 0, lineHeight: 1.5 }}>{pr.notes}</p>
            </div>
          )}

          {/* 8. ACTION ROW */}
          <div style={{ display: "flex", gap: isMobile ? 6 : 5, flexWrap: "wrap" as const, paddingTop: 10, borderTop: `1px solid ${C.hair}`, opacity: busy ? 0.5 : 1 }}>

            {["quoted","revised"].includes(pr.status) && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => onRevise(pr, cl)}>Revise quote</B>
              <B s={NEXT} onClick={() => act(async () => openDoc(await h.createContract(cid, pid, settings)))}>Create contract</B>
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => setDialog({ title: "Mark lost", text: "The quote leaves the pipeline and moves to Lost. You can undo it.", okLabel: "Mark lost", run: () => upP({ status: "lost" }) })}>Mark lost</B>
            </>}
            {pr.status === "lost" && (
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => act(() => upP({ status: prevQuoteStatus() }))}>Undo lost</B>
            )}

            {pr.status === "contracted" && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => act(async () => openDoc(await h.reviseContract(cid, pid, settings)))}>
                {con?.status === "draft" ? "Edit contract" : "Revise contract"}
              </B>
              {con && <>
                {/* the signed PDF is back: attaching it signs the contract (the picker opens in this tap) */}
                <B s={NEXT} onClick={() => { signFor.current = con; if (signRef.current) { signRef.current.value = ""; signRef.current.click(); } }}>Attach signed copy</B>
                <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => setDialog({ title: "Mark signed", dateLabel: "Signed on", okLabel: "Mark signed", run: async (dt: string) => { await h.markContractSigned(cid, pid, con.id, dt, settings); askDelivery(); } })}>Mark signed</B>
              </>}
            </>}

            {pr.status === "production" && !isRet && (
              pInv && pInv.status === "draft"
                ? <B s={NEXT} onClick={() => openDoc(pInv)}>Open invoice draft</B>
                : <B s={{ ...NEXT, opacity: pr.deliveryDate ? 1 : 0.35, cursor: pr.deliveryDate ? "pointer" : "not-allowed" as const }}
                    title={pr.deliveryDate ? "" : "Set the delivery date first"}
                    onClick={() => { if (pr.deliveryDate) act(async () => openDoc(await h.createProjectInvoice(cid, pid, settings))); else setRowErr("Set the delivery date first."); }}>
                    Create invoice
                  </B>
            )}

            {pr.status === "production" && isRet && (
              draftM
                ? <B s={NEXT} onClick={() => openDoc(draftM)}>Open M{String(draftM.monthNo || "").padStart(2, "0")} draft</B>
                : nextM
                  ? <B s={NEXT} onClick={() => act(async () => openDoc(await h.createMonthlyInvoice(cid, pid, settings)))}>Create invoice M{String(nextM).padStart(2, "0")}</B>
                  : null
            )}

            {pr.status === "invoiced" && !pr.paid && pInv && (
              <B s={NEXT} onClick={() => setDialog({ title: "Mark paid", dateLabel: "Paid on", okLabel: "Mark paid", run: (dt: string) => h.markInvoicePaid(cid, pid, pInv.id, dt) })}>Mark paid</B>
            )}

            {pr.paid && <>
              <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={() => setRenewT(pr)}>Add renewal</B>
              {pInv && pInv.status === "paid" && (
                <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => setDialog({ title: "Undo paid", text: "The invoice goes back to unpaid.", okLabel: "Undo paid", run: () => h.markInvoiceUnpaid(cid, pid, pInv.id) })}>Undo paid</B>
              )}
            </>}

            {(pr.renewals || []).map((r: any, ri: number) => {
              const inv = renewalInvoice(pr, r.id);
              if (inv && inv.status !== "draft") return null;
              return (
                <B key={r.id || ri} v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }}
                  onClick={() => setDialog({ title: `Undo renewal ${ri + 1}`, text: "The renewal and its draft invoice are removed.", okLabel: "Undo renewal", danger: true, run: () => h.removeRenewal(cid, pid, r.id) })}>
                  Undo R{ri + 1}
                </B>
              );
            })}

            {["revised","contracted","production"].includes(pr.status) && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => { const block = backStepBlock(pr); if (block) { setRowErr(block); return; } setDialog({ title: "Back one step", text: pr.status === "production" ? `The contract goes back to not signed.${currentContractOf(pr)?.signedFile ? " Its signed copy is deleted too." : ""}` : pr.status === "contracted" ? "The contract is withdrawn (a draft is deleted, a sent one is kept as replaced)." : "The project goes back to Quoted.", okLabel: "Back one step", run: () => h.undoContract(cid, pid) }); }}>← Back one step</B>
            )}

            {["production","invoiced","paid"].includes(pr.status) && pr.qd && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }} onClick={() => setAmendT(pr)}>+ Amend</B>
            )}

            {(pr.amendments || []).map((a: any, ai: number) => amendDocsDraft(a) && (
              <B key={a.id || ai} v="sec" s={{ fontSize: TYPE.micro.size, color: C.muted }}
                onClick={() => setDialog({ title: `Undo ${amendShort(a, ai)}`, text: "The amendment draft is removed. The project value doesn't change (it only counts once signed).", okLabel: "Undo amendment", danger: true, run: () => h.removeAmendment(cid, pid, a.id) })}>
                Undo {amendShort(a, ai)}
              </B>
            ))}

            {/* signed amendment with no next invoice to go on → its own invoice */}
            {(pr.amendments || []).filter((a: any) => a.signed && !a.invoiceDocId && Number(a.amendTotal) !== 0 && (isRet ? !nextM : !!pInv && pInv.status !== "draft")).map((a: any) => (
              <B key={`inv-${a.id}`} s={{ fontSize: TYPE.micro.size }} onClick={() => act(async () => openDoc(await h.createAmendmentInvoice(cid, pid, a.id, settings)))}>
                Create invoice {a.aNo || "amendment"}
              </B>
            ))}

            {!(pr.documents || []).some((d: any) => d.kind === "invoice" && d.status !== "draft") && (
              <B v="sec" s={{ fontSize: TYPE.micro.size, color: C.red, borderColor: C.rule }}
                onClick={() => setDialog({ title: `Delete "${pr.name}"?`, text: "The project and its quotes, contracts, drafts, amendments and renewals are deleted. This can't be undone.", okLabel: "Delete project", danger: true, run: () => h.removeProject(cid, pid) })}>
                Delete project
              </B>
            )}
          </div>

          {(pr.amendments || []).some((a: any) => a.signed && !a.invoiceDocId && Number(a.amendTotal) !== 0) && (isRet ? !!nextM : !pInv || pInv.status === "draft") && (
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "8px 0 0" }}>Signed amendments go on the {isRet ? "next monthly" : "project"} invoice.</p>
          )}

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
// After "Mark signed" without a delivery date: asked once (Projects and the client page)
export function DeliveryAsk({ ask, clientsHook, onDone }: { ask: { cid: string; pid: string; name: string }; clientsHook: any; onDone: () => void }) {
  return (
    <ConfirmDialog title="Delivery date" text={`When will you deliver "${ask.name}"? Invoices and licenses need it. You can also set it later.`}
      dateLabel="Delivery date" okLabel="Set delivery date" cancelLabel="Later"
      onCancel={onDone}
      onOk={(dt: string) => { onDone(); clientsHook.updateProject(ask.cid, ask.pid, { deliveryDate: dt }).catch(() => { /* the save toast reports it */ }); }} />
  );
}

interface ProjectsTabProps {
  clients:          any[];
  isMobile:         boolean;
  settings:         any;
  rc:               any;
  initialFilter?:   string | null;    // from a dashboard tile: "quoted" | "active" | status
  onOpenClient?:    (clientId: string, projectId?: string) => void;   // client name in a row → Clients ("‹ Projects" brings you back)
  clientsHook:      any;
  onRevise:         (pr: any, cl: any) => void;
  onAmend:          (pr: any, cl: any) => void;
  onGoToCalc:       (clientId: string, leadId?: string) => void;
  pendingProjectQNo:string | null;
  onPendingClear:   () => void;
}

export default function ProjectsTab({
  clients, isMobile, settings, rc, clientsHook,
  onRevise, onAmend, onGoToCalc, pendingProjectQNo, onPendingClear, initialFilter, onOpenClient,
}: ProjectsTabProps) {

  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [statusFilter,  setStatusFilter]  = useState(initialFilter || "all");
  useEffect(() => { if (initialFilter) setStatusFilter(initialFilter); }, [initialFilter]);
  const [sortOrder,     setSortOrder]     = useState("newest");
  const [showLost,      setShowLost]      = useState(false);
  const [askDeliv,      setAskDeliv]      = useState<null | { cid: string; pid: string; name: string }>(null);
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

  const lost   = all.filter((pr: any) => !pr.paid && pr.status === "lost");
  const bySort = (a: any, b: any) => {
    if (sortOrder === "amount")  return b.amount - a.amount;
    if (sortOrder === "oldest")  return String(a.date || "").localeCompare(String(b.date || ""));
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  };
  const active = all.filter((pr: any) => !pr.paid && pr.status !== "lost").sort(bySort);

  const done  = all.filter((pr: any) => pr.paid).sort((a: any, b: any) => String(b.date || "").localeCompare(String(a.date || "")));
  // under "To invoice", a paid project with an amendment to invoice sits in the list above — not twice
  const doneShown = statusFilter === "signed" ? done.filter((pr: any) => !(toInvoice(pr) > 0)) : done;

  const FILTERS = [["all","All"],["signed","To invoice"],["active","Active (signed)"],["production","Production"],["invoiced","Invoiced"],["contracted","Contracted"],["quoted","Quoted"],["lead","Leads"]];
  const filteredActive = statusFilter === "all"
    ? active
    : statusFilter === "signed"
    ? all.filter((pr: any) => toInvoice(pr) > 0).sort(bySort)          // money.ts — also invoiced / paid projects with an amendment to invoice
    : statusFilter === "active"
    ? active.filter((pr: any) => ["contracted","production","invoiced"].includes(pr.status))
    : active.filter((pr: any) => pr.status === statusFilter || (statusFilter === "quoted" && pr.status === "revised"));

  const activeTotal  = active.reduce((s: number, pr: any) => s + pr.amount, 0);
  const doneTotal    = doneShown.reduce((s: number, pr: any) => s + paidNet(pr), 0);   // paid invoices (net), not project amounts
  const byStatus     = (st: string) => active.filter((pr: any) => pr.status === st).length;
  const invoicedAmt  = active.filter((pr: any) => pr.status === "invoiced").reduce((s: number, pr: any) => s + pr.amount, 0);

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1, color: C.black }}>Projects</h2>
      {(() => {
        const tone = PAL[statusFilter === "signed" || statusFilter === "active" ? "progress" : STATUS_TONE[statusFilter] || "neutral"];
        // "to invoice": what's already invoiced on a project is taken off (same as the dashboard)
        const open = (pr: any) => (statusFilter !== "signed" ? (Number(pr.amount) || 0) : toInvoice(pr));   // money.ts
        const sum = filteredActive.reduce((s: number, pr: any) => s + open(pr), 0);
        const what = statusFilter === "all" ? "open" : statusFilter === "signed" ? "to invoice" : (FILTERS.find(f => f[0] === statusFilter)?.[1] || "").toLowerCase();
        return (
          <SummaryLine dot={tone.mid}>{filteredActive.length} {what} · <Strong>{fmt(sum)}</Strong></SummaryLine>
        );
      })()}

      {/* ── FILTER (pill) + SORT ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "12px 0 4px" }}>
        {(() => {
          const t = PAL[statusFilter === "signed" || statusFilter === "active" ? "progress" : STATUS_TONE[statusFilter] || "neutral"];
          const on = statusFilter !== "all";
          return (
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", height: 30, borderRadius: RADIUS.pill, border: `1px solid ${on ? t.fill : C.rule}`, background: on ? t.wash : C.white, color: on ? t.ink : C.ink2, paddingLeft: 11, paddingRight: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.mid, marginRight: 7, flexShrink: 0 }} />
              <select className="psel" value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)} aria-label="Filter"
                style={{ appearance: "none" as const, WebkitAppearance: "none" as const, border: "none", background: "transparent", color: "inherit", fontFamily: SANS, height: 28, padding: 0, cursor: "pointer", outline: "none" }}>
                {FILTERS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
              <span style={{ position: "absolute", right: 10, pointerEvents: "none" as const, fontSize: ICON.caret }}>▾</span>
            </span>
          );
        })()}
        <TSelWrap>
          <TSel value={sortOrder} onChange={(e: any) => setSortOrder(e.target.value)}>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="amount">Sort: Amount</option>
          </TSel>
        </TSelWrap>
      </div>

      {/* ── ACTIVE SECTION — grouped by stage ── */}
      {(active.length > 0 || filteredActive.length > 0) && <>
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 100px", padding: "8px 0 2px" }}>
            {["Client · Project", "Delivery", "Amount"].map((h, i) => (
              <span key={i} style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.light, textAlign: i >= 1 ? "right" as const : "left" as const }}>{h}</span>
            ))}
          </div>
        )}
        {(() => {
          // ONE flat list (headers + rows) under the same parent: a row that changes stage
          // (Create contract, Create invoice …) moves without being rebuilt, so the document
          // it just opened (or a question it asks) stays open.
          const out: any[] = [];
          ["production", "contracted", "invoiced", "revised", "quoted", "lead", "paid"].forEach(st => {
            const list = filteredActive.filter((pr: any) => pr.status === st);
            if (!list.length) return;
            const t = PAL[STATUS_TONE[st] || "neutral"];
            out.push(
              <SectionHead key={`h-${st}`} dot={t.mid} label={`${STATUS_NAME[st] || st} · ${list.length}`}
                right={fmt(list.reduce((s: number, pr: any) => s + (statusFilter === "signed" ? toInvoice(pr) : (Number(pr.amount) || 0)), 0))} />
            );
            list.forEach((pr: any, i: number) => {
              const first = i === 0, last = i === list.length - 1;
              out.push(
                <div key={pr.id} style={{ ...listSeg(first, last), overflow: "hidden", padding: "0 12px" }}>
                  <div style={{ marginBottom: last ? -1 : 0 }}>
                    <ProjectRow
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
                      onOpenClient={onOpenClient} onAskDelivery={setAskDeliv}
                    />
                  </div>
                </div>
              );
            });
          });
          return out;
        })()}
        {filteredActive.length === 0 && (
          <p style={{ fontSize: TYPE.subtext.size, color: C.light, padding: "20px 0" }}>No projects match this filter.</p>
        )}
      </>}

      {askDeliv && <DeliveryAsk ask={askDeliv} clientsHook={clientsHook} onDone={() => setAskDeliv(null)} />}

      {/* ── LOST (folded) — closed quotes, out of the pipeline ── */}
      {lost.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowLost(o => !o)} aria-expanded={showLost}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: SANS }}>
            <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>Lost · {lost.length}</span>
            <span style={{ fontSize: ICON.caret, color: C.muted }}>{showLost ? "▴" : "▾"}</span>
          </button>
          {showLost && (
            <ListCard s={{ padding: "0 12px", opacity: 0.85 }}>
              <div style={{ marginBottom: -1 }}>
                {lost.map((pr: any) => (
                  <ProjectRow key={pr.id} pr={pr} clients={clients} isMobile={isMobile} isExpanded={expanded === pr.id}
                    onToggle={() => setExpanded(expanded === pr.id ? null : pr.id)} clientsHook={clientsHook}
                    onRevise={onRevise} onAmend={onAmend} onGoToCalc={onGoToCalc} rc={rc} settings={settings}
                    onModalClosed={() => setScrollTrigger(t => t + 1)} onOpenClient={onOpenClient} onAskDelivery={setAskDeliv} />
                ))}
              </div>
            </ListCard>
          )}
        </div>
      )}

      {/* ── DONE SECTION ── */}
      {doneShown.length > 0 && (
        <div>
          <SectionHead dot={PAL.done.mid} label={`Done · ${doneShown.length}`} right={`${fmt(doneTotal)} earned`} />
          <ListCard s={{ padding: "0 12px" }}><div style={{ marginBottom: -1 }}>
          {doneShown.map(pr => (
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
                    onOpenClient={onOpenClient} onAskDelivery={setAskDeliv}
            />
          ))}
          </div></ListCard>
        </div>
      )}

      {/* ── EMPTY ── */}
      {active.length === 0 && done.length === 0 && (
        <p style={{ fontSize: TYPE.subtext.size, color: C.light, textAlign: "center" as const, marginTop: 40 }}>No projects yet.</p>
      )}
    </div>
  );
}
