// ─────────────────────────────────────────────────────────────
// CreatorWorkspace — delivery log, per-deliverable status circles
// Group by: Urgency / Client / Category / Status
// ─────────────────────────────────────────────────────────────

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, catInfo } from "./constants";
import { Segmented, Tick, CatPill } from "./atoms";
import { fmtD, today } from "./formatters";
import {
  WS_STATUSES, getWsItems, statusRank, shownStatus, finalStatus, doneWord,
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
  const [snackbar,     setSnackbar]     = useState<{ msg: string; undo: () => void } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allItems = getWsItems(clients);
  const filtered = search
    ? allItems.filter(it => it.name.toLowerCase().includes(search.toLowerCase()) || it.clientName.toLowerCase().includes(search.toLowerCase()))
    : allItems;

  const activeItems = filtered;

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

  // Every change saves ONE item (server-side merge), never the whole project map
  const fail = (e: any) => showSnack(`Couldn't save: ${e?.message || "error"}`, () => setSnackbar(null));

  const setItemStatus = (item: any, next: string) => {
    clientsHook.setWsStatus(item.clientId, item.projectId, [{ id: item.id, status: next }]).catch(fail);
    showSnack(`${item.name} → ${next}`, () => {
      clientsHook.revertWsStatus(item.clientId, item.projectId, [item.id]).catch(fail);   // undo also removes the history entry
      setSnackbar(null);
    });
  };

  // Tap the category pill to cycle Brand Collab → UGC → Editorial.
  // Stored per workspace item only — the quote and its PDFs stay as they are.
  const CAT_CYCLE = ["Influencer", "UGC", "Editorial"];
  const setItemCat = (item: any) => {
    const next = CAT_CYCLE[(CAT_CYCLE.indexOf(item.category) + 1) % CAT_CYCLE.length];
    clientsHook.patchWs(item.clientId, item.projectId, "workspaceCats", { [item.id]: next }).catch(fail);
  };

  const saveName = (item: any, val: string) => {
    const trimmed = val.trim();
    clientsHook.patchWs(item.clientId, item.projectId, "workspaceNames", { [item.id]: trimmed && trimmed !== item.defaultName ? trimmed : null }).catch(fail);
    setEditingId(null);
  };

  const saveNote = (item: any, val: string) => {
    clientsHook.patchWs(item.clientId, item.projectId, "workspaceNotes", { [item.id]: val.trim() || null }).catch(fail);
    setNoteId(null);
  };

  // ── Grouping ──────────────────────────────────────────────
  type GroupDef = { key: string; label: string; items: any[] };
  let groups: GroupDef[] = [];

  if (group === "Urgency") {
    const od   = activeItems.filter(it => !it.done && isOverdue(it.deadline));
    const wk   = activeItems.filter(it => !it.done && !isOverdue(it.deadline) && isThisWeek(it.deadline));
    const lat  = activeItems.filter(it => !it.done && !isOverdue(it.deadline) && !isThisWeek(it.deadline));
    const done = activeItems.filter(it => it.done);
    groups = [
      { key:"overdue", label:"OVERDUE",       items: od   },
      { key:"week",    label:"DUE THIS WEEK", items: wk   },
      { key:"later",   label:"LATER",         items: lat  },
      { key:"done",    label:"DONE",          items: done },
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
      groups.push({ key: cat, label: catInfo(cat).label.toUpperCase(), items: activeItems.filter(it => it.category === cat) });
    });
  } else {
    WS_STATUSES.forEach(st => {
      groups.push({ key: st, label: st.toUpperCase(), items: activeItems.filter(it => shownStatus(it.status) === st) });
    });
  }

  const deadlineColor = (item: any) => isOverdue(item.deadline) ? C.red : isThisWeek(item.deadline) ? C.amber : C.muted;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 14px" }}>Workspace</h2>
        <div style={{ marginBottom: 12 }}>
          <Segmented
            options={[["Urgency","Urgency"],["Client","Client"],["Category","Category"],["Status","Status"]]}
            value={group}
            onChange={(g) => setGroup(g as any)}
          />
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
              const isEditing = editingId === item.id;
              const isNoting  = noteId === item.id;
              const dlColor   = deadlineColor(item);
              const dayTag    = plannerDayLabel(item.plannerDate);
              const isDone    = item.done;
              const isCreated = statusRank(item.status) >= 1;
              // Second tick = the category's last step: Brand Collab → posted;
              // UGC / Editorial → delivered (a later "Posted" still counts as done).
              const doneLabel = doneWord(item.category);
              const doneSt    = finalStatus(item.category);
              const cbDone    = item.done;

              // Manager ticks for this item's category (reviewed / delivered)
              const mgrStatus = (() => {
                const cl  = clients.find(c => c.id === item.clientId);
                const pr  = cl?.projects.find((p: any) => p.id === item.projectId);
                const msc = (pr?.managerStatus || {})[String(item.category).toLowerCase()] || {};
                if (msc.delivered) return { label: "delivered", date: msc.deliveredDate, color: C.green };
                if (msc.reviewed)  return { label: "reviewed",  date: msc.reviewedDate,  color: C.amber };
                return null;
              })();

              const cbSz = isMobile ? 26 : 22;

              return (
                <div key={item.id} style={{ borderBottom: `1px solid ${C.rule}`, opacity: isDone ? 0.6 : 1 }}>
                  {isMobile ? (
                    <div style={{ padding: "11px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: TYPE.micro.size, fontWeight: "500", color: C.black, letterSpacing: "0.07em", textTransform: "uppercase" as const, flexShrink: 0 }}>{item.clientName}</span>
                          <CatPill cat={item.category} onClick={() => setItemCat(item)} title="Tap to change category" />
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
                            <Tick on={isCreated} size={cbSz} onClick={() => setItemStatus(item, isCreated ? "Not started" : "Created")} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: TYPE.label.size, color: C.light }}>{doneLabel}</span>
                            <Tick on={cbDone} size={cbSz} color={C.green} disabled={!isCreated} onClick={() => setItemStatus(item, cbDone ? "Created" : doneSt)} />
                          </div>
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
                          <CatPill cat={item.category} onClick={() => setItemCat(item)} title="Tap to change category" />
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
                            <Tick on={isCreated} size={cbSz} onClick={() => setItemStatus(item, isCreated ? "Not started" : "Created")} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: TYPE.micro.size, color: C.light }}>{doneLabel}</span>
                            <Tick on={cbDone} size={cbSz} color={C.green} disabled={!isCreated} onClick={() => setItemStatus(item, cbDone ? "Created" : doneSt)} />
                          </div>
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
    </div>
  );
}
