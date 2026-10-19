// ─────────────────────────────────────────────────────────────
// ClientDetail — one client: totals (open · owed · paid this year),
// its projects (tap → opens in Projects, where the work happens),
// its licenses, contact and notes. Edit in place; Delete at the
// bottom (blocked while issued invoices exist — they must be kept).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, PAL, STATUS_TONE, STATUS_NAME } from "./constants";
import { fmt, fmtD, today } from "./formatters";
import { I, S, Lbl, Tag, ConfirmDialog, PillBtn, SectionHead, ListCard, Row, TonedTag, IconCircle } from "./atoms";
import type { ToneSet } from "./atoms";
import { projectLicenses, ACTION_LABEL } from "./licenses";
import type { License } from "./licenses";
import { clientTotals, statusSince, daysSince, STATUS_ORDER, STALE_QUOTE_DAYS } from "./money";
import { editLock } from "./saveStatus";
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
  highlightedQNo:   string | null;
  onClearHighlight: () => void;
  onOpenProject?:   (projectId: string) => void;
}

export default function ClientDetail({
  cl, isMobile, clientsHook, onGoToCalc, setSel, highlightedQNo, onClearHighlight, onOpenProject,
}: ClientDetailProps) {

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
  const projMeta = (pr: any) => {
    const tone = PAL[STATUS_TONE[pr.paid ? "paid" : pr.status] || "neutral"];
    const word = <span style={{ color: tone.ink }}>{STATUS_NAME[pr.paid ? "paid" : pr.status] || pr.status}</span>;
    if (pr.paid) return <>{word}{pr.deliveryDate ? ` · delivered ${fmtD(pr.deliveryDate)}` : ""}</>;
    if (pr.status === "contracted" || pr.status === "production")
      return <>{word} · {pr.deliveryDate ? `delivery ${fmtD(pr.deliveryDate)}` : <span style={{ color: PAL.waiting.ink }}>No delivery date</span>}</>;
    if (pr.status === "quoted" || pr.status === "revised") {
      const d = daysSince(statusSince(pr), todayStr);
      return <>{word}{d != null ? ` · ${d} ${d === 1 ? "day" : "days"} ago` : ""}{d != null && d > STALE_QUOTE_DAYS && <span style={{ color: PAL.waiting.ink }}> · 30+ days</span>}</>;
    }
    return word;
  };

  const lics: License[] = (cl.projects || []).flatMap((pr: any) => projectLicenses(pr, cl));
  const licTone = (l: License): ToneSet => l.action || l.state === "done" || l.state === "info" ? PAL.neutral : l.state === "expired" ? PAL.late : l.state === "expiring" ? PAL.waiting : PAL.done;
  const licTag = (l: License) => l.action ? `${ACTION_LABEL[l.action.action] || l.action.action}` : !l.alerts ? "info only"
    : l.daysLeft < 0 ? `${Math.abs(l.daysLeft)} days expired` : `${l.daysLeft} ${l.daysLeft === 1 ? "day" : "days"}`;

  const card: any = { background: C.white, border: "1px solid #efebe6", borderRadius: 12, padding: "4px 12px" };
  const infoRow = (lbl: string, val: any, first = false) => (
    <div key={lbl} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: first ? "none" : "1px solid #f4f1ed" }}>
      <span style={{ fontSize: 12, color: "#8a847d" }}>{lbl}</span>
      <span style={{ fontSize: 12, color: C.black, textAlign: "right" as const, maxWidth: "62%", overflowWrap: "anywhere" as const }}>{val || "—"}</span>
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

      <button onClick={() => { setSel(null); setEditMode(false); }}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 12, color: "#8a847d" }}>‹ Clients</button>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editMode
            ? <I value={ed.name} onChange={(e: any) => setEd((p: any) => ({ ...p, name: e.target.value }))} s={{ fontFamily: SERIF }} />
            : <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{cl.name}</h2>}
          <div style={{ fontSize: 12, color: "#8a847d", marginTop: 4 }}>{[cl.agency || "Direct", `${t.projects} project${t.projects === 1 ? "" : "s"}`, cl.contact].filter(Boolean).join(" · ")}</div>
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
        {([["Open", t.signed, PAL.progress], ["Owed", t.owed, PAL.waiting], [`Paid ${year}`, t.paidYear, PAL.done]] as [string, number, ToneSet][]).map(([lbl, v, tn]) => (
          <div key={lbl} style={{ background: tn.wash, borderRadius: 12, padding: "9px 10px", minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: tn.ink }}>{lbl}</div>
            <div style={{ fontFamily: SERIF, fontSize: 16, marginTop: 4, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{fmt(v)}</div>
            {lbl === "Owed" && t.overdue > 0 && <div style={{ fontSize: 10, color: PAL.late.ink, marginTop: 2 }}>{t.overdue} overdue</div>}
          </div>
        ))}
      </div>

      {/* ── PROJECTS ── */}
      <SectionHead label={`Projects · ${prs.length}`} right={prs.length && onOpenProject ? "tap to open in Projects" : undefined} />
      {prs.length > 0 ? (
        <ListCard>
          {prs.map((pr: any, i: number) => (
            <Row key={pr.id} first={i === 0} highlight={!!highlightedQNo && pr.qd?.qNo === highlightedQNo}
              onClick={onOpenProject ? () => { onClearHighlight(); onOpenProject(pr.id); } : undefined}
              title={pr.name || "Untitled"} meta={projMeta(pr)}
              right={<div style={{ fontSize: 14, color: pr.status === "lost" ? C.muted : C.black }}>{fmt(pr.amount)}</div>} />
          ))}
        </ListCard>
      ) : <p style={{ fontSize: 13, color: C.muted, margin: "4px 4px 0" }}>No projects yet.</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
        {showAddP ? <>
          <I value={newPN} onChange={(e: any) => setNewPN(e.target.value)} placeholder="Project name" onKeyDown={(e: any) => e.key === "Enter" && addProject()} />
          <PillBtn dark onClick={addProject}>Add</PillBtn>
          <PillBtn onClick={() => { setShowAddP(false); setNewPN(""); }}>Cancel</PillBtn>
        </> : (
          <button onClick={() => setShowAddP(true)} style={{ fontSize: 12, color: "#8a847d", background: "none", border: "none", cursor: "pointer", fontFamily: SANS, padding: "4px 4px" }}>+ Add a lead without a quote</button>
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
                right={<><div style={{ fontSize: 13 }}>{fmtD(l.end)}</div><TonedTag tone={tn} s={{ marginTop: 3 }}>{licTag(l)}</TonedTag></>} />
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
          {infoRow("Country", cl.country)}
          {infoRow("VAT ID", cl.vatId)}
        </>}
      </div>

      {/* ── NOTES ── */}
      <SectionHead label="Notes" />
      <div style={{ ...card, padding: "10px 12px" }}>
        {editMode
          ? <textarea value={ed.notes || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, notes: e.target.value }))}
              style={{ width: "100%", minHeight: 70, padding: "8px 10px", border: `1px solid ${C.rule}`, borderRadius: 8, background: C.bg, fontFamily: SANS, color: C.black, boxSizing: "border-box" as const, resize: "vertical" as const }} />
          : <p style={{ fontSize: 13, color: cl.notes ? C.black : C.light, margin: 0, lineHeight: 1.6 }}>{cl.notes || "No notes yet"}</p>}
      </div>

      <div style={{ textAlign: "center" as const, margin: "18px 0 6px" }}>
        <button onClick={() => deleteClient()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.red }}>Delete client</button>
      </div>
    </div>
  );
}
