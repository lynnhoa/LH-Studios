// ─────────────────────────────────────────────────────────────
// ClientDetail — one client: totals (open · owed · paid this year),
// its projects (tap → opens in Projects, where the work happens),
// its licenses, contact and notes. Edit in place; Delete at the
// bottom (blocked while issued invoices exist — they must be kept).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { ProjectRow, DeliveryAsk } from "./ProjectsTab";
import { C, SANS, SERIF, PAL, STATUS_TONE, STATUS_NAME, WORDS, TYPE, TRACK, RADIUS } from "./constants";
import { fmt, fmtD, today } from "./formatters";
import { I, S, Lbl, Tag, ConfirmDialog, PillBtn, SectionHead, ListCard, Row, TonedTag, IconCircle, listSeg } from "./atoms";
import type { ToneSet } from "./atoms";
import { projectLicenses, ACTION_LABEL } from "./licenses";
import type { License } from "./licenses";
import { clientTotals, STATUS_ORDER, followUp, validUntil, currentContractOf, daysSince } from "./money";
import { editLock } from "./saveStatus";
import { countryKnown } from "./docs";
import { Ico, IC } from "./PlannerWindows";

interface ClientDetailProps {
  cl:               any;
  clients:          any[];
  isMobile:         boolean;
  settings:         any;
  rc:               any;
  clientsHook:      any;
  onGoToCalc:       (name: string, leadId?: string) => void;
  onRevise:         (pr: any, cl: any) => void;
  onAmend:          (pr: any, cl: any) => void;
  setSel:           (id: string | null) => void;
  highlightedQNo:   string | null;     // a project (id or quote no.) to open on arrival
  onClearHighlight: () => void;
  backLabel?:       string;            // "Projects" when you came from there
  onBack?:          () => void;
}

export default function ClientDetail({
  cl, clients, isMobile, settings, rc, clientsHook, onGoToCalc, onRevise, onAmend, setSel, highlightedQNo, onClearHighlight, backLabel, onBack,
}: ClientDetailProps) {
  // projects open in place, one at a time — the same card as in Projects (no jump to the Projects tab)
  const [openPid,  setOpenPid]  = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [askDeliv,   setAskDeliv]   = useState<null | { cid: string; pid: string; name: string }>(null);
  // another client → nothing open; arriving with a project (from Projects) → that one open,
  // also when this client page was already showing
  const lastCl = useRef(cl.id);
  useEffect(() => { if (lastCl.current !== cl.id) { lastCl.current = cl.id; setOpenPid(null); } }, [cl.id]);
  useEffect(() => {
    if (!highlightedQNo) return;
    const hit = (cl.projects || []).find((p: any) => p.id === highlightedQNo || p.qd?.qNo === highlightedQNo);
    if (hit) setOpenPid(hit.id);
    onClearHighlight();
  }, [highlightedQNo, cl.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!openPid) return;
    const el = document.querySelector(`[data-prid="${openPid}"]`);
    if (el) setTimeout(() => (el as any).scrollIntoView?.({ behavior: "smooth", block: "center" }), 80);
  }, [openPid, scrollTick]);

  const [editMode,  setEditMode]  = useState(false);
  const [ed,        setEd]        = useState<any>({ ...cl });
  const [tagI,      setTagI]      = useState("");
  const [showAddP,  setShowAddP]  = useState(false);
  const [newPN,     setNewPN]     = useState("");
  const [askDelete, setAskDelete] = useState<null | { blocked: boolean; text: string }>(null);
  useEffect(() => (editMode ? editLock.acquire() : undefined), [editMode]);   // no reload while editing

  const todayStr = today();
  const year = parseInt(todayStr.slice(0, 4));
  const t = clientTotals(cl, year, todayStr);       // money.ts — same rule as Dashboard and Projects

  const saveClient = async () => {
    await clientsHook.updateClient(cl.id, ed);
    setEditMode(false);
  };

  const deleteClient = () => {
    const issued = (cl.projects || []).flatMap((pr: any) => pr.documents || []).filter((d: any) => d.kind === "invoice" && d.status !== "draft").length;
    if (issued > 0) {
      setAskDelete({ blocked: true, text: `"${cl.name}" has ${issued} issued invoice${issued > 1 ? "s" : ""}. Invoices must be kept, so this client can't be deleted.` });
      return;
    }
    const nProj = (cl.projects || []).length;
    setAskDelete({ blocked: false, text: `${nProj > 0 ? `This also deletes ${nProj} project${nProj > 1 ? "s" : ""} with their quotes, contracts and drafts. ` : ""}This cannot be undone.` });
  };
  const confirmDelete = async () => {
    setAskDelete(null);
    await clientsHook.deleteClient(cl.id);
    setSel(null);
  };

  const addProject = async () => {
    if (!newPN.trim()) return;
    await clientsHook.addProject(cl.id, {
      clientId:               cl.id,
      name:                   newPN,
      status:                 "lead",
      amount:                 0,
      paid:                   false,
      date:                   today(),
      deliveryDate:           "",
      usageEndOverride:       null,
      notes:                  "",
      qd:                     null,
      amendments:             [],
      renewals:               [],
      monthlyInvoices:        [],
      workspaceStatus:        {},
      workspaceStatusHistory: {},
    });
    setNewPN("");
    setShowAddP(false);
  };

  // projects: open work first (most urgent), then paid, then lost
  const rank = (pr: any) => (pr.paid ? 50 : pr.status === "lost" ? 60 : Math.max(0, STATUS_ORDER.indexOf(pr.status)));
  const prs = [...(cl.projects || [])].sort((a: any, b: any) => rank(a) - rank(b) || String(b.date || "").localeCompare(String(a.date || "")));

  const lics: License[] = (cl.projects || []).flatMap((pr: any) => projectLicenses(pr, cl));
  const licTone = (l: License): ToneSet => l.action || l.state === "done" || l.state === "info" ? PAL.neutral : l.state === "expired" ? PAL.late : l.state === "expiring" ? PAL.waiting : PAL.done;
  const licTag = (l: License) => l.action ? `${ACTION_LABEL[l.action.action] || l.action.action}` : !l.alerts ? "info only"
    : l.daysLeft < 0 ? `${Math.abs(l.daysLeft)} days expired` : `${l.daysLeft} ${l.daysLeft === 1 ? "day" : "days"}`;

  const card: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, padding: "4px 12px" };
  const infoRow = (lbl: string, val: any, first = false) => (
    <div key={lbl} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: first ? "none" : `1px solid ${C.hair}` }}>
      <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{lbl}</span>
      <span style={{ fontSize: TYPE.subtext.size, color: C.black, textAlign: "right" as const, maxWidth: "62%", overflowWrap: "anywhere" as const }}>{val || "—"}</span>
    </div>
  );

  return (
    <div style={{
      flex:      isMobile ? undefined : "0 0 56%",
      minWidth:  0,
      overflowY: isMobile ? undefined : "auto",
      maxHeight: isMobile ? undefined : "calc(100vh - 80px)",
      paddingLeft: isMobile ? 0 : 4,
      fontFamily: SANS, color: C.black,
    }}>
      {askDelete && (askDelete.blocked
        ? <ConfirmDialog title="Can't delete this client" text={askDelete.text} okLabel="OK" onOk={() => setAskDelete(null)} onCancel={() => setAskDelete(null)} />
        : <ConfirmDialog title={`Delete "${cl.name}"?`} text={askDelete.text} okLabel="Delete" danger onOk={confirmDelete} onCancel={() => setAskDelete(null)} />
      )}

      <button onClick={onBack || (() => { setSel(null); setEditMode(false); })}
        style={{ background: "none", border: "none", padding: "0 8px 0 0", minHeight: 44, display: "inline-flex", alignItems: "center", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.muted }}>‹ {backLabel || "Clients"}</button>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editMode
            ? <I value={ed.name} onChange={(e: any) => setEd((p: any) => ({ ...p, name: e.target.value }))} s={{ fontFamily: SERIF }} />
            : <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{cl.name}</h2>}
          <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 4 }}>{[cl.agency || "Direct", `${t.projects} project${t.projects === 1 ? "" : "s"}`, cl.contact].filter(Boolean).join(" · ")}</div>
          {!editMode && (cl.tags || []).length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 6 }}>{cl.tags.map((x: string) => <Tag key={x}>{x}</Tag>)}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {editMode
            ? <><PillBtn dark onClick={saveClient}>Save</PillBtn><PillBtn onClick={() => setEditMode(false)}>Cancel</PillBtn></>
            : <><PillBtn onClick={() => { setEd({ ...cl }); setEditMode(true); }}>Edit</PillBtn><PillBtn dark onClick={() => onGoToCalc(cl.name)}>+ Quote</PillBtn></>}
        </div>
      </div>

      {/* ── TOTALS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6, marginTop: 12 }}>
        {([[WORDS.toInvoice, t.signed, PAL.progress], [WORDS.unpaid, t.owed, PAL.waiting], [`${WORDS.paid} ${year}`, t.paidYear, PAL.done]] as [string, number, ToneSet][]).map(([lbl, v, tn]) => (
          <div key={lbl} style={{ background: tn.wash, borderRadius: RADIUS.tile, padding: "9px 10px", minWidth: 0 }}>
            <div style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: tn.ink }}>{lbl}</div>
            <div style={{ fontFamily: SERIF, fontSize: TYPE.field.size, marginTop: 4, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{fmt(v)}</div>
            {lbl === WORDS.unpaid && t.overdue > 0 && <div style={{ fontSize: TYPE.micro.size, color: PAL.late.ink, marginTop: 2 }}>{t.overdue} overdue</div>}
          </div>
        ))}
      </div>

      {/* ── PROJECTS ── */}
      <SectionHead label={`Projects · ${prs.length}`} />
      {prs.length > 0 ? (
        <div>
          {prs.map((pr: any, i: number) => {
            const first = i === 0, last = i === prs.length - 1;
            return (
              <div key={pr.id} style={{ ...listSeg(first, last), overflow: "hidden", padding: "0 12px" }}>
                <div style={{ marginBottom: last ? -1 : 0 }}>
                  <ProjectRow
                    pr={{ ...pr, _cid: cl.id, _cname: cl.name }}
                    clients={clients}
                    isMobile={isMobile}
                    isExpanded={openPid === pr.id}
                    onToggle={() => setOpenPid(openPid === pr.id ? null : pr.id)}
                    clientsHook={clientsHook}
                    onRevise={onRevise}
                    onAmend={onAmend}
                    onGoToCalc={onGoToCalc}
                    rc={rc}
                    settings={settings}
                    onModalClosed={() => setScrollTick(t => t + 1)}
                    onAskDelivery={setAskDeliv}
                    showStatus
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : <p style={{ fontSize: TYPE.row.size, color: C.muted, margin: "4px 4px 0" }}>No projects yet.</p>}
      {askDeliv && <DeliveryAsk ask={askDeliv} clientsHook={clientsHook} onDone={() => setAskDeliv(null)} />}
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
        {showAddP ? <>
          <I value={newPN} onChange={(e: any) => setNewPN(e.target.value)} placeholder="Project name" onKeyDown={(e: any) => e.key === "Enter" && addProject()} />
          <PillBtn dark onClick={addProject}>Add</PillBtn>
          <PillBtn onClick={() => { setShowAddP(false); setNewPN(""); }}>Cancel</PillBtn>
        </> : (
          <button onClick={() => setShowAddP(true)} style={{ fontSize: TYPE.subtext.size, color: C.muted, background: "none", border: "none", cursor: "pointer", fontFamily: SANS, padding: "0 4px", minHeight: 44 }}>+ Add a lead without a quote</button>
        )}
      </div>

      {/* ── LICENSES ── */}
      {lics.length > 0 && <>
        <SectionHead label={`Licenses · ${lics.length}`} />
        <ListCard>
          {lics.map((l, i) => {
            const tn = licTone(l);
            return (
              <Row key={`${l.projectId}-${l.key}`} first={i === 0}
                icon={<IconCircle tone={tn}><Ico d={l.kind === "excl" ? IC.lock : l.kind === "organic" ? IC.leaf : IC.speaker} size={15} /></IconCircle>}
                title={l.projectName} meta={`${l.label}${l.extended ? " · renewed" : ""}`}
                right={<><div style={{ fontSize: TYPE.row.size }}>{fmtD(l.end)}</div><TonedTag tone={tn} s={{ marginTop: 3 }}>{licTag(l)}</TonedTag></>} />
            );
          })}
        </ListCard>
      </>}

      {/* ── CONTACT ── */}
      <SectionHead label="Contact" />
      <div style={{ ...card, padding: editMode ? "10px 12px 12px" : "4px 12px" }}>
        {editMode ? <>
            <Lbl>Contact</Lbl>
            <I value={ed.contact || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, contact: e.target.value }))} />
            <Lbl>Email</Lbl>
            <I value={ed.email || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, email: e.target.value }))} type="email" />
            <Lbl>Agency / Direct</Lbl>
            <S value={ed.agency || "Direct"} onChange={(e: any) => setEd((p: any) => ({ ...p, agency: e.target.value }))}>
              <option>Direct</option><option>Agency</option>
            </S>
            <Lbl>Street & Number</Lbl>
            <I value={ed.street || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, street: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
              <div><Lbl>PLZ</Lbl><I value={ed.plz || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, plz: e.target.value }))} /></div>
              <div><Lbl>City</Lbl><I value={ed.city || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, city: e.target.value }))} /></div>
            </div>
            <Lbl>Country</Lbl>
            <I value={ed.country || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, country: e.target.value }))} />
            <Lbl>VAT ID (optional)</Lbl>
            <I value={ed.vatId || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, vatId: e.target.value }))} placeholder="DE123456789" />
            <Lbl>Tags</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 5 }}>
              {(ed.tags || []).map((t: string) => <Tag key={t} onRemove={() => setEd((p: any) => ({ ...p, tags: p.tags.filter((x: string) => x !== t) }))}>{t}</Tag>)}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <I value={tagI} onChange={(e: any) => setTagI(e.target.value)} placeholder="Add tag"
                onKeyDown={(e: any) => { if (e.key === "Enter" && tagI.trim()) { setEd((p: any) => ({ ...p, tags: [...(p.tags || []), tagI.trim()] })); setTagI(""); } }} />
              <PillBtn onClick={() => { if (tagI.trim()) { setEd((p: any) => ({ ...p, tags: [...(p.tags || []), tagI.trim()] })); setTagI(""); } }}>+</PillBtn>
            </div>
        </> : <>
          {infoRow("Contact", cl.contact, true)}
          {infoRow("Email", cl.email)}
          {infoRow("Type", cl.agency)}
          {infoRow("Address", [cl.street, [cl.plz, cl.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))}
          {infoRow("Country", cl.country && !countryKnown(cl.country)
            ? <>{cl.country}<span style={{ color: PAL.waiting.ink }}> · not recognised for VAT</span></>
            : cl.country)}
          {infoRow("VAT ID", cl.vatId)}
        </>}
      </div>

      {/* ── NOTES ── */}
      <SectionHead label="Notes" />
      <div style={{ ...card, padding: "10px 12px" }}>
        {editMode
          ? <textarea value={ed.notes || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, notes: e.target.value }))}
              style={{ width: "100%", minHeight: 70, padding: "8px 10px", border: `1px solid ${C.rule}`, borderRadius: RADIUS.tag, background: C.bg, fontFamily: SANS, color: C.black, boxSizing: "border-box" as const, resize: "vertical" as const }} />
          : <p style={{ fontSize: TYPE.row.size, color: cl.notes ? C.black : C.light, margin: 0, lineHeight: 1.6 }}>{cl.notes || "No notes yet"}</p>}
      </div>

      <div style={{ textAlign: "center" as const, margin: "18px 0 6px" }}>
        <button onClick={() => deleteClient()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.red, minHeight: 44, padding: "0 12px" }}>Delete client</button>
      </div>
    </div>
  );
}
