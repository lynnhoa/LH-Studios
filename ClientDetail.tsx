// ─────────────────────────────────────────────────────────────
// ClientDetail — right panel: client info, edit, projects list
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, addM, today, uid } from "./formatters";
import { I, S, B, Lbl, Tag } from "./atoms";
import ProjectCard from "./ProjectCard";

interface ClientDetailProps {
  cl:               any;
  clients:          any[];
  isMobile:         boolean;
  settings:         any;
  rc:               any;
  clientsHook:      any;
  onGoToCalc:       (name: string) => void;
  onRevise:         (pr: any, cl: any) => void;
  onAmend:          (pr: any, cl: any) => void;
  setSel:           (id: string | null) => void;
  highlightedQNo:   string | null;
  onClearHighlight: () => void;
}

function financials(c: any) {
  const paid = c.projects.filter((pr: any) => pr.paid);
  const tot  = paid.reduce((s: number, pr: any) => s + pr.amount, 0);
  const last = [...paid].sort((a: any,b: any) => b.date.localeCompare(a.date))[0];
  return {
    total:    tot,
    last:     last?.amount || 0,
    lastDate: last?.date   || null,
    avg:      paid.length  ? Math.round(tot / paid.length) : 0,
    count:    paid.length,
    out:      c.projects.filter((pr: any) => pr.status === "invoiced" && !pr.paid).reduce((s: number,pr: any) => s + pr.amount, 0),
  };
}

export default function ClientDetail({
  cl, clients, isMobile, settings, rc, clientsHook,
  onGoToCalc, onRevise, onAmend, setSel, highlightedQNo, onClearHighlight,
}: ClientDetailProps) {

  const [editMode,      setEditMode]      = useState(false);
  const [ed,            setEd]            = useState<any>({ ...cl });
  const [tagI,          setTagI]          = useState("");
  const [showAddP,      setShowAddP]      = useState(false);
  const [newPN,         setNewPN]         = useState("");
  const [delConfirm,    setDelConfirm]    = useState<string | null>(null);
  const [editPrName,    setEditPrName]    = useState<string | null>(null);
  const [editPrNameVal, setEditPrNameVal] = useState("");

  const f = financials(cl);

  const saveClient = async () => {
    await clientsHook.updateClient(cl.id, ed);
    setEditMode(false);
  };

  const deleteClient = async () => {
    await clientsHook.deleteClient(cl.id);
    setSel(null);
  };

  const addProject = async () => {
    if (!newPN.trim()) return;
    await clientsHook.addProject(cl.id, {
      clientId:               cl.id,
      name:                   newPN,
      status:                 "quoted",
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

  return (
    <div style={{
      flex:      isMobile ? undefined : "0 0 56%",
      minWidth:  0,
      overflowY: isMobile ? undefined : "auto",
      maxHeight: isMobile ? undefined : "calc(100vh - 80px)",
      paddingLeft: isMobile ? 0 : 4,
    }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 18 : 14, gap: 8, flexWrap: "wrap" as const }}>
        <div style={{ minWidth: 0 }}>
          {editMode
            ? <I value={ed.name} onChange={(e: any) => setEd((p: any) => ({ ...p, name: e.target.value }))} s={{ fontSize: isMobile ? 20 : 18, fontFamily: SERIF, marginBottom: 4 }} />
            : <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 6px" }}>{cl.name}</h2>
          }
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
            {cl.tags?.map((t: string) => <Tag key={t}>{t}</Tag>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: isMobile ? 8 : 6, flexShrink: 0, alignItems: "flex-start" }}>
          {editMode
            ? <>
                <B onClick={saveClient}>Save</B>
                <B v="sec" onClick={() => setEditMode(false)}>Cancel</B>
              </>
            : <>
                <B v="sec" onClick={() => { setEd({ ...cl }); setEditMode(true); }}>Edit</B>
                <button
                  onClick={() => deleteClient()}
                  style={{ fontSize: TYPE.micro.size, color: C.red, border: `1px solid ${C.red}`, padding: "5px 10px", borderRadius: 2, cursor: "pointer", background: "none", fontFamily: SANS, letterSpacing: "0.08em", textTransform: "uppercase" as const }}
                >
                  Delete
                </button>
              </>
          }
          <button
            onClick={() => { setSel(null); setEditMode(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: isMobile ? 22 : 18, lineHeight: 1, padding: "2px 0 0 4px" }}
          >✕</button>
        </div>
      </div>

      {/* ── INFO GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>

        {/* Brand info */}
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px" }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>Brand Info</p>
          {editMode ? <>
            <Lbl>Contact</Lbl>
            <I value={ed.contact || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, contact: e.target.value }))} />
            <Lbl>Email</Lbl>
            <I value={ed.email || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, email: e.target.value }))} type="email" />
            <Lbl>Agency / Direct</Lbl>
            <S value={ed.agency || "Direct"} onChange={(e: any) => setEd((p: any) => ({ ...p, agency: e.target.value }))}>
              <option>Direct</option><option>Agency</option>
            </S>
            <Lbl>Country</Lbl>
            <I value={ed.country || ""} onChange={(e: any) => setEd((p: any) => ({ ...p, country: e.target.value }))} />
            <Lbl>Tags</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 5 }}>
              {(ed.tags || []).map((t: string) => <Tag key={t} onRemove={() => setEd((p: any) => ({ ...p, tags: p.tags.filter((x: string) => x !== t) }))}>{t}</Tag>)}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <I value={tagI} onChange={(e: any) => setTagI(e.target.value)} placeholder="Add tag"
                onKeyDown={(e: any) => { if (e.key === "Enter" && tagI.trim()) { setEd((p: any) => ({ ...p, tags: [...(p.tags || []), tagI.trim()] })); setTagI(""); } }} />
              <B v="sec" onClick={() => { if (tagI.trim()) { setEd((p: any) => ({ ...p, tags: [...(p.tags || []), tagI.trim()] })); setTagI(""); } }} s={{ fontSize: TYPE.micro.size }}>+</B>
            </div>
          </> : <>
            {[["Contact", cl.contact], ["Email", cl.email], ["Type", cl.agency], ["Country", cl.country]].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{lbl}</span>
                <span style={{ fontSize: TYPE.subtext.size, color: C.black, fontWeight: "500", maxWidth: "60%", textAlign: "right" as const }}>{val || "—"}</span>
              </div>
            ))}
          </>}
        </div>

        {/* Financial snapshot */}
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px" }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>Financial Snapshot</p>
          {[
            ["Total Revenue", fmt(f.total)],
            ["Paid Projects", `${f.count}`],
            ["Last Invoice",  f.lastDate ? `${fmt(f.last)} · ${fmtD(f.lastDate)}` : "—"],
            ["Avg. Deal",     f.avg ? fmt(f.avg) : "—"],
            ["Outstanding",   fmt(f.out)],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.rule}` }}>
              <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{lbl}</span>
              <span style={{ fontSize: TYPE.subtext.size, color: C.black, fontWeight: "500", textAlign: "right" as const }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NOTES ── */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 14px", marginBottom: 10 }}>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>Relationship Notes</p>
        {editMode
          ? <textarea
              value={ed.notes || ""}
              onChange={(e: any) => setEd((p: any) => ({ ...p, notes: e.target.value }))}
              style={{ width: "100%", minHeight: isMobile ? 80 : 50, padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.body.size, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const }}
            />
          : <p style={{ fontSize: TYPE.body.size, color: cl.notes ? C.black : C.light, margin: 0, lineHeight: 1.65 }}>{cl.notes || "No notes yet…"}</p>
        }
      </div>

      {/* ── PROJECTS ── */}
      {cl.projects.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: 0 }}>Projects</p>
            <B v="sec" onClick={() => onGoToCalc(cl.name)} s={{ fontSize: TYPE.micro.size }}>+ Quote</B>
          </div>
          {cl.projects.map((pr: any) => (
            <ProjectCard
              key={pr.id}
              pr={pr}
              cl={cl}
              clients={clients}
              isMobile={isMobile}
              settings={settings}
              rc={rc}
              clientsHook={clientsHook}
              onRevise={onRevise}
              onAmend={onAmend}
              highlighted={pr.qd?.qNo === highlightedQNo}
              onClearHighlight={onClearHighlight}
            />
          ))}
        </div>
      )}

      {/* ── ADD PROJECT ── */}
      <div style={{ marginTop: 12 }}>
        {showAddP ? (
          <div style={{ display: "flex", gap: 7 }}>
            <I value={newPN} onChange={(e: any) => setNewPN(e.target.value)} placeholder="Project name…"
              onKeyDown={(e: any) => e.key === "Enter" && addProject()} />
            <B onClick={addProject}>Add</B>
            <B v="sec" onClick={() => { setShowAddP(false); setNewPN(""); }}>Cancel</B>
          </div>
        ) : (
          <button
            onClick={() => setShowAddP(true)}
            style={{ fontSize: TYPE.label.size, color: C.muted, background: "none", border: "none", cursor: "pointer", fontFamily: SANS, padding: 0, letterSpacing: "0.04em" }}
          >
            + Add project manually
          </button>
        )}
      </div>
    </div>
  );
}
