// ─────────────────────────────────────────────────────────────
// CreatorWorkspace — delivery log, per-deliverable status circles
// Group by: Urgency / Client / Category / Status
// ─────────────────────────────────────────────────────────────

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmtD, today } from "./formatters";
import {
  WS_STATUSES, getWsItems, wsCatPill,
  isOverdue, isThisWeek, fmtDeadline, plannerDayLabel,
} from "./wsHelpers";

interface CreatorWorkspaceProps {
  clients:    any[];
  isMobile:   boolean;
  clientsHook: any;
}

export default function CreatorWorkspace({ clients, isMobile, clientsHook }: CreatorWorkspaceProps) {
  const [group,        setGroup]        = useState<"Urgency"|"Client"|"Category"|"Status">("Urgency");
  const [search,       setSearch]       = useState("");
  const [collapsed,    setCollapsed]    = useState<Record<string,boolean>>({});
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingVal,   setEditingVal]   = useState("");
  const [noteId,       setNoteId]       = useState<string | null>(null);
  const [noteVal,      setNoteVal]      = useState("");
  const [confirmDel,   setConfirmDel]   = useState<any | null>(null);
  const [snackbar,     setSnackbar]     = useState<{ msg: string; undo: () => void } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allItems = getWsItems(clients);
  const filtered = search
    ? allItems.filter(it => it.name.toLowerCase().includes(search.toLowerCase()) || it.clientName.toLowerCase().includes(search.toLowerCase()))
    : allItems;

  // Filter out deleted items
  const activeItems = filtered.filter(it => {
    const cl = clients.find(c => c.id === it.clientId);
    const pr = cl?.projects.find((p: any) => p.id === it.projectId);
    return !(pr?.workspaceDeleted || []).includes(it.id);
  });

  // ── Mutators ──────────────────────────────────────────────
  const showSnack = (msg: string, undo: () => void) => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnackbar({ msg, undo });
    snackTimer.current = setTimeout(() => setSnackbar(null), 5000);
  };

  // Helper: get current project from clients array
  const getPr = (clientId: string, projectId: string) => {
    const cl = clients.find(c => c.id === clientId);
    return cl?.projects.find((p: any) => p.id === projectId);
  };

  const setItemStatus = (item: any, next: string) => {
    const prev = item.status;
    const pr   = getPr(item.clientId, item.projectId);
    if (!pr) return;
    clientsHook.updateProject(item.clientId, item.projectId, {
      workspaceStatus:        { ...(pr.workspaceStatus || {}), [item.id]: next },
      workspaceStatusHistory: {
        ...(pr.workspaceStatusHistory || {}),
        [item.id]: [...((pr.workspaceStatusHistory || {})[item.id] || []), { status: next, date: today() }],
      },
    });
    showSnack(`${item.name} → ${next}`, () => {
      const prNow = getPr(item.clientId, item.projectId);
      if (!prNow) return;
      clientsHook.updateProject(item.clientId, item.projectId, {
        workspaceStatus: { ...(prNow.workspaceStatus || {}), [item.id]: prev },
      });
      setSnackbar(null);
    });
  };

  const saveName = (item: any, val: string) => {
    const trimmed = val.trim();
    const pr = getPr(item.clientId, item.projectId);
    if (!pr) return;
    clientsHook.updateProject(item.clientId, item.projectId, {
      workspaceNames: { ...(pr.workspaceNames || {}), [item.id]: trimmed || item.defaultName },
    });
    setEditingId(null);
  };

  const saveNote = (item: any, val: string) => {
    const pr = getPr(item.clientId, item.projectId);
    if (!pr) return;
    clientsHook.updateProject(item.clientId, item.projectId, {
      workspaceNotes: { ...(pr.workspaceNotes || {}), [item.id]: val.trim() },
    });
    setNoteId(null);
  };

  const deleteItem = (item: any) => {
    const pr = getPr(item.clientId, item.projectId);
    if (!pr) return;
    clientsHook.updateProject(item.clientId, item.projectId, {
      workspaceDeleted: [...(pr.workspaceDeleted || []), item.id],
    });
    setConfirmDel(null);
  };

  // ── Grouping ──────────────────────────────────────────────
  type GroupDef = { key: string; label: string; items: any[] };
  let groups: GroupDef[] = [];

  if (group === "Urgency") {
    const od   = activeItems.filter(it => !["Delivered","Posted"].includes(it.status) && isOverdue(it.deadline));
    const wk   = activeItems.filter(it => !["Delivered","Posted"].includes(it.status) && !isOverdue(it.deadline) && isThisWeek(it.deadline));
    const lat  = activeItems.filter(it => !["Delivered","Posted"].includes(it.status) && !isOverdue(it.deadline) && !isThisWeek(it.deadline));
    const done = activeItems.filter(it => ["Delivered","Posted"].includes(it.status));
    groups = [
      { key:"overdue", label:"OVERDUE",       items: od   },
      { key:"week",    label:"DUE THIS WEEK", items: wk   },
      { key:"later",   label:"LATER",         items: lat  },
      { key:"done",    label:"DELIVERED",     items: done },
    ];
  } else if (group === "Client") {
    const byClient: Record<string,any[]> = {};
    activeItems.forEach(it => {
      const k = `${it.clientName}|${it.projectId}|${it.projectName}`;
      if (!byClient[k]) byClient[k] = [];
      byClient[k].push(it);
    });
    groups = Object.entries(byClient).map(([k, items]) => {
      const [cn,,pn] = k.split("|");
      return { key: k, label: `${cn.toUpperCase()} — ${pn}`, items };
    });
  } else if (group === "Category") {
    ["Influencer","UGC","Editorial"].forEach(cat => {
      groups.push({ key: cat, label: cat.toUpperCase(), items: activeItems.filter(it => it.category === cat) });
    });
  } else {
    WS_STATUSES.forEach(st => {
      groups.push({ key: st, label: st.toUpperCase(), items: activeItems.filter(it => it.status === st) });
    });
  }

  const deadlineColor = (item: any) => isOverdue(item.deadline) ? C.red : isThisWeek(item.deadline) ? C.amber : C.muted;

  // ── Checkbox style ────────────────────────────────────────
  const cbBox = (checked: boolean, color: string, size: number) => ({
    width: size, height: size, borderRadius: 3,
    border: `1.5px solid ${checked ? color : C.rule}`,
    background: checked ? color : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 14px" }}>Workspace</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
          {(["Urgency","Client","Category","Status"] as const).map(g => (
            <button key={g} onClick={() => setGroup(g)}
              style={{ padding: "5px 14px", border: `1px solid ${group === g ? C.black : C.rule}`, borderRadius: 2, background: group === g ? C.black : "none", color: group === g ? C.white : C.muted, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, letterSpacing: "0.08em" }}>
              {g}
            </button>
          ))}
        </div>
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.black, borderRadius: 2, outline: "none", boxSizing: "border-box" as const }} />
      </div>

      {/* Empty */}
      {allItems.length === 0 && (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "40px 20px", textAlign: "center" as const, marginTop: 20 }}>
          <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "0 0 6px" }}>No active deliverables.</p>
          <p style={{ fontSize: TYPE.label.size, color: C.light, margin: 0 }}>Projects appear here once a contract is signed.</p>
        </div>
      )}

      {/* Groups */}
      {groups.filter(g => g.items.length > 0 || (g.key === "overdue" && group === "Urgency")).map(g => {
        const isOpen = !collapsed[g.key];
        const isODG  = g.key === "overdue";
        return (
          <div key={g.key} style={{ marginBottom: 52 }}>
            <div onClick={() => setCollapsed(p => ({ ...p, [g.key]: !p[g.key] }))}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer", userSelect: "none" as const }}>
              <span style={{ fontSize: TYPE.label.size, letterSpacing: "0.12em", color: isODG && g.items.length > 0 ? C.red : C.black, fontWeight: "600" }}>{g.label}</span>
              <span style={{ fontSize: TYPE.label.size, color: isODG && g.items.length > 0 ? C.red : C.muted }}>{g.items.length}</span>
              <span style={{ fontSize: TYPE.label.size, color: C.light, marginLeft: "auto" }}>{isOpen ? "▾" : "▸"}</span>
            </div>
            <div style={{ borderTop: `1px solid ${C.rule}`, marginBottom: 4 }} />

            {isOpen && g.items.map(item => {
              const catStyle  = wsCatPill(item.category);
              const isEditing = editingId === item.id;
              const isNoting  = noteId === item.id;
              const dlColor   = deadlineColor(item);
              const dayTag    = plannerDayLabel(item.plannerDate);
              const isDone    = ["Delivered","Posted"].includes(item.status);
              const isCreated = ["Created","Reviewed","Delivered","Posted"].includes(item.status);
              const isPosted  = item.status === "Posted";
              const showPost  = item.category === "Influencer";

              // Manager status from history
              const mgrStatus = (() => {
                const cl   = clients.find(c => c.id === item.clientId);
                const pr   = cl?.projects.find((p: any) => p.id === item.projectId);
                const hist = ((pr?.workspaceStatusHistory || {})[item.id] || []);
                const rev  = hist.find((h: any) => h.status === "Reviewed");
                const del  = hist.find((h: any) => h.status === "Delivered");
                if (del) return { label: "delivered", date: del.date, color: C.green };
                if (rev) return { label: "reviewed",  date: rev.date, color: C.amber };
                return null;
              })();

              const cbSz = isMobile ? 26 : 20;

              return (
                <div key={item.id} style={{ borderBottom: `1px solid ${C.rule}`, opacity: isDone ? 0.6 : 1 }}>
                  {isMobile ? (
                    <div style={{ padding: "11px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: TYPE.micro.size, fontWeight: "500", color: C.black, letterSpacing: "0.07em", textTransform: "uppercase" as const, flexShrink: 0 }}>{item.clientName}</span>
                          <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", border: `1px solid ${catStyle.border}`, borderRadius: 10, color: catStyle.color, background: catStyle.bg, flexShrink: 0 }}>{item.category}</span>
                        </div>
                        <span style={{ fontSize: TYPE.label.size, color: dlColor, fontWeight: dlColor === C.red ? "600" : "400", flexShrink: 0, marginLeft: 8 }}>{fmtDeadline(item.deadline)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                          {isEditing ? (
                            <input autoFocus value={editingVal} onChange={e => setEditingVal(e.target.value)}
                              onBlur={() => saveName(item, editingVal)}
                              onKeyDown={e => { if (e.key === "Enter") saveName(item, editingVal); if (e.key === "Escape") setEditingId(null); }}
                              style={{ fontFamily: SANS, fontSize: TYPE.body.size, color: C.black, border: "none", borderBottom: `1px solid ${C.black}`, background: "transparent", outline: "none", padding: "0 0 1px", width: "100%" }} />
                          ) : (
                            <span onClick={() => { if (!isDone) { setEditingId(item.id); setEditingVal(item.name); } }}
                              style={{ fontSize: TYPE.body.size, color: C.black, cursor: isDone ? "default" : "text", textDecoration: isDone ? "line-through" : "none", display: "block", marginBottom: 2 }}>{item.name}</span>
                          )}
                          {item.lineNote && <span style={{ fontSize: TYPE.label.size, color: C.muted, display: "block", marginBottom: 2 }}>{item.lineNote}</span>}
                          {item.notes && !isNoting && <span onClick={() => { setNoteId(item.id); setNoteVal(item.notes); }} style={{ fontSize: TYPE.label.size, color: C.amber, display: "block", marginBottom: 2, cursor: "pointer" }}>{item.notes}</span>}
                          {!item.notes && !isNoting && !isDone && <button onClick={() => { setNoteId(item.id); setNoteVal(""); }} style={{ fontSize: TYPE.label.size, color: C.light, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SANS }}>+ note</button>}
                          {isCreated && mgrStatus && <span style={{ fontSize: TYPE.label.size, color: mgrStatus.color, display: "block", marginTop: 1 }}>{mgrStatus.label} · {fmtD(mgrStatus.date)}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: TYPE.label.size, color: C.light }}>created</span>
                            <div onClick={() => setItemStatus(item, isCreated ? "Not started" : "Created")} style={cbBox(isCreated, C.black, cbSz)}>
                              {isCreated && <span style={{ fontSize: 13, color: C.white, lineHeight: 1, fontWeight: "500" }}>✓</span>}
                            </div>
                          </div>
                          {showPost && (
                            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: TYPE.label.size, color: C.light }}>posted</span>
                              <div onClick={() => { if (!isCreated) return; setItemStatus(item, isPosted ? "Created" : "Posted"); }} style={{ ...cbBox(isPosted, C.green, cbSz), cursor: isCreated ? "pointer" : "default", opacity: isCreated ? 1 : 0.35 }}>
                                {isPosted && <span style={{ fontSize: 13, color: C.white, lineHeight: 1, fontWeight: "500" }}>✓</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0" }}>
                      <span style={{ fontSize: TYPE.label.size, fontWeight: "500", color: C.black, letterSpacing: "0.04em", width: 64, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, marginTop: 2 }}>
                        {item.clientName.toUpperCase()}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {isEditing ? (
                            <input autoFocus value={editingVal} onChange={e => setEditingVal(e.target.value)}
                              onBlur={() => saveName(item, editingVal)}
                              onKeyDown={e => { if (e.key === "Enter") saveName(item, editingVal); if (e.key === "Escape") setEditingId(null); }}
                              style={{ fontFamily: SANS, fontSize: TYPE.body.size, color: C.black, border: "none", borderBottom: `1px solid ${C.black}`, background: "transparent", outline: "none", padding: "0 0 1px", flex: 1, minWidth: 0 }} />
                          ) : (
                            <span onClick={() => { if (!isDone) { setEditingId(item.id); setEditingVal(item.name); } }}
                              style={{ fontSize: TYPE.body.size, color: C.black, cursor: isDone ? "default" : "text", textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {item.name}
                            </span>
                          )}
                          <span style={{ fontSize: TYPE.micro.size, padding: "2px 7px", border: `1px solid ${catStyle.border}`, borderRadius: 10, color: catStyle.color, background: catStyle.bg, flexShrink: 0 }}>{item.category}</span>
                        </div>
                        {item.lineNote && <span style={{ fontSize: TYPE.label.size, color: C.muted, display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{item.lineNote}</span>}
                        {item.notes && !isNoting && <span onClick={() => { setNoteId(item.id); setNoteVal(item.notes); }} style={{ fontSize: TYPE.label.size, color: C.amber, display: "block", marginTop: 1, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{item.notes}</span>}
                        {!item.notes && !isNoting && !isDone && <button onClick={() => { setNoteId(item.id); setNoteVal(""); }} style={{ fontSize: TYPE.micro.size, color: C.light, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SANS, marginTop: 2 }}>+ note</button>}
                        {isCreated && mgrStatus && <span style={{ fontSize: TYPE.micro.size, color: mgrStatus.color, display: "block", marginTop: 2 }}>{mgrStatus.label} · {fmtD(mgrStatus.date)}</span>}
                      </div>
                      {dayTag && <span style={{ fontSize: TYPE.label.size, padding: "1px 5px", border: `1px solid ${C.rule}`, borderRadius: 2, color: C.muted, background: C.white, flexShrink: 0, alignSelf: "flex-start" as const, marginTop: 2 }}>{dayTag}</span>}
                      <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: TYPE.label.size, color: dlColor, fontWeight: dlColor === C.red ? "600" : "400" }}>{fmtDeadline(item.deadline)}</span>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: TYPE.micro.size, color: C.light }}>created</span>
                            <div onClick={() => setItemStatus(item, isCreated ? "Not started" : "Created")} style={cbBox(isCreated, C.black, cbSz)}>
                              {isCreated && <span style={{ fontSize: 11, color: C.white, lineHeight: 1, fontWeight: "500" }}>✓</span>}
                            </div>
                          </div>
                          {showPost && (
                            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: TYPE.micro.size, color: C.light }}>posted</span>
                              <div onClick={() => { if (!isCreated) return; setItemStatus(item, isPosted ? "Created" : "Posted"); }} style={{ ...cbBox(isPosted, C.green, cbSz), cursor: isCreated ? "pointer" : "default", opacity: isCreated ? 1 : 0.35 }}>
                                {isPosted && <span style={{ fontSize: 11, color: C.white, lineHeight: 1, fontWeight: "500" }}>✓</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline note input */}
                  {isNoting && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0 8px", borderBottom: `1px solid ${C.rule}` }}>
                      <input autoFocus placeholder="Add a note…" value={noteVal} onChange={e => setNoteVal(e.target.value)}
                        onBlur={() => saveNote(item, noteVal)}
                        onKeyDown={e => { if (e.key === "Enter") saveNote(item, noteVal); if (e.key === "Escape") setNoteId(null); }}
                        maxLength={120}
                        style={{ flex: 1, fontFamily: SANS, fontSize: TYPE.label.size, color: C.black, border: "none", borderBottom: `1px solid ${C.rule}`, background: "transparent", outline: "none", padding: "0 0 1px" }} />
                      <button onClick={() => saveNote(item, noteVal)} style={{ fontSize: TYPE.micro.size, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Save</button>
                      <button onClick={() => setNoteId(null)} style={{ fontSize: TYPE.micro.size, color: C.light, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Snackbar undo */}
      {snackbar && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 3000, display: "flex", alignItems: "center", gap: 16, background: C.black, color: C.white, borderRadius: 2, padding: "10px 18px", fontSize: TYPE.subtext.size, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", whiteSpace: "nowrap" as const }}>
          <span>{snackbar.msg}</span>
          <button onClick={snackbar.undo} style={{ background: "none", border: "none", cursor: "pointer", color: C.amber, fontFamily: SANS, fontSize: TYPE.subtext.size, fontWeight: "500", padding: 0 }}>Undo</button>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDel && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setConfirmDel(null)}>
          <div style={{ background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "24px 28px", maxWidth: 320, width: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: TYPE.body.size, color: C.black, margin: "0 0 8px", fontFamily: SERIF }}>Delete this deliverable?</p>
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 20px" }}>Use only if this item was dropped from the contract informally. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding: "6px 16px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, color: C.muted }}>Cancel</button>
              <button onClick={() => deleteItem(confirmDel)} style={{ padding: "6px 16px", border: `1px solid ${C.red}`, borderRadius: 2, background: C.red, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, color: C.white }}>Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
