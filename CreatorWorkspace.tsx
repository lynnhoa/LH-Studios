// ─────────────────────────────────────────────────────────────
// CreatorWorkspace — where the work happens (Manager list parts)
//   chips group by urgency · client · card · status; search;
//   each row: card dot + name, client · project · due, two square ticks
//   (created = blue, done = pistachio). Tap a row → item window:
//   read view → Edit (name, note, card, own date) → Save back to the read view.
//   No tap-to-change on tags or names any more.
// ─────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, SHADOW, Z, TRACK, SPACING } from "./constants";
import { fmtD } from "./formatters";
import { SummaryLine, Strong, Chip, ChipRow, SearchField, SectionHead, ListCard, TonedTag, Sheet, PillBtn, I, S, Row, ColGroups,
  SheetHead, SheetRow, SheetAction, SheetMeta, SheetErr, SheetButton, MoreMenu, useDraft, MiniInput, MenuSelect, SHEET_CARD, SHEET_CAPS } from "./atoms";
import { Ico, IC } from "./PlannerWindows";
import { getWsItems, isOverdue, isThisWeek, fmtDeadline, finalStatus, statusRank, shownStatus, WS_CATS, WS_CAT_LABEL } from "./wsHelpers";
import { catTone, statusTone, Tick2 } from "./CreatorShared";
import { showUndo, showNote } from "./undo";

type By = "urgency" | "client" | "card" | "status";

// ── Item window — one level, the fields are the view (like the contact window) ──
// Top card: status · deadline · its steps. Card: Name · Card · Own date · Note. ⋯ Remove item (with Undo).
// Footer: Done → Save as soon as you type (the window stays open); ✕ with unsaved typing asks first.
function ItemWindow({ item, project, clientsHook, onClose }: any) {
  // what you type: the shared draft (atoms)
  const { d, setD, changed, saving, failed } = useDraft({ name: item.name as string, note: (item.notes || "") as string, cat: item.category as string, own: (item.ownDate || "") as string });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    setErr(null); setBusy(true); saving();             // the saved values come back and replace the draft
    try {
      const h = clientsHook, cid = item.clientId, pid = item.projectId, id = item.id;
      if (d.name.trim() !== item.name) await h.patchWs(cid, pid, "workspaceNames", { [id]: d.name.trim() && d.name.trim() !== item.defaultName ? d.name.trim() : null });
      if (d.note !== (item.notes || "")) await h.patchWs(cid, pid, "workspaceNotes", { [id]: d.note || null });
      if (d.cat !== item.category) await h.patchWs(cid, pid, "workspaceCats", { [id]: d.cat });
      if ((d.own || "") !== (item.ownDate || "")) {
        const map = { ...(project?.workspacePlanner || {}) };
        if (d.own) map[id] = d.own; else delete map[id];
        await h.updateProject(cid, pid, { workspacePlanner: map });
      }
      showNote("Saved ✓");
    } catch (e: any) { failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  // not needed any more: gone from the Workspace and the counts; Undo here, Restore in Projects › Production
  const remove = async () => {
    try {
      await clientsHook.setWsStatus(item.clientId, item.projectId, [{ id: item.id, status: "Removed" }]);
      showUndo("Item removed", () => clientsHook.revertWsStatus(item.clientId, item.projectId, [item.id], "Removed"));
      onClose();
    } catch (e: any) { setErr(e?.message || "Couldn't remove."); }
  };
  const steps = (item.history || []).map((x: any) => `${shownStatus(x.status)} ${fmtDeadline(x.date)}`).join(" · ");
  const late = !item.done && isOverdue(item.deadline), soon = !item.done && !late && isThisWeek(item.deadline);
  return (
    <>
      <Sheet title={`Item · ${WS_CAT_LABEL[item.category] || item.category}`} onClose={onClose} dirty={changed}
        right={<MoreMenu items={[{ label: "Remove item", danger: true, onClick: remove }]} />}
        footer={changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton> : <SheetButton close>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}
        <SheetAction>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            <div><div style={{ ...SHEET_CAPS, margin: "0 2px 4px" }}>Status</div>
              <div style={{ height: 24, display: "flex", alignItems: "center" }}><TonedTag tone={statusTone(item.status, item.done)}>{shownStatus(item.status)}</TonedTag></div></div>
            <div><div style={{ ...SHEET_CAPS, margin: "0 2px 4px" }}>Deadline</div>
              <div style={{ height: 24, display: "flex", alignItems: "center", padding: "0 2px", fontSize: TYPE.row.size, color: late ? PAL.late.ink : soon ? PAL.waiting.ink : item.deadline ? C.black : C.light }}>
                {item.deadline ? fmtD(item.deadline) : "—"}
              </div></div>
          </div>
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "6px 2px 0", lineHeight: 1.4 }}>
            {steps || "No steps yet"} · {item.ownDate ? "your own date" : item.deadline ? "the delivery date" : "no deadline yet"}
          </p>
        </SheetAction>
        <SheetHead icon={<Ico d={IC.camera} size={11} />} label="Item" tone={catTone(item.category)} />
        <div style={SHEET_CARD}>
          <SheetRow first label="Name"><MiniInput bare value={d.name} aria-label="Name" onChange={(e: any) => setD(x => ({ ...x, name: e.target.value }))} /></SheetRow>
          <SheetRow label="Card">
            <MenuSelect bare value={d.cat} aria-label="Card" onChange={(e: any) => setD(x => ({ ...x, cat: e.target.value }))}>
              {WS_CATS.map(c => <option key={c} value={c}>{WS_CAT_LABEL[c]}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Own date"><MiniInput bare type="date" value={d.own} aria-label="Own date" onChange={(e: any) => setD(x => ({ ...x, own: e.target.value }))} /></SheetRow>
          <SheetRow label="Note"><MiniInput bare value={d.note} placeholder="Add a note" aria-label="Note" onChange={(e: any) => setD(x => ({ ...x, note: e.target.value }))} /></SheetRow>
        </div>
        <SheetMeta>{item.clientName} · {item.projectName} · Own date empty = the project's delivery date</SheetMeta>
      </Sheet>
    </>
  );
}

export default function CreatorWorkspace({ clients, isMobile, clientsHook }: { clients: any[]; isMobile: boolean; clientsHook: any }) {
  const [by, setBy] = useState<By>("urgency");
  const [q, setQ] = useState("");
  const [unfold, setUnfold] = useState<Record<string, boolean>>({});
  const [win, setWin] = useState<null | { pid: string; id: string }>(null);

  const all = useMemo(() => getWsItems(clients), [clients]);
  const ql = q.trim().toLowerCase();
  const items = all.filter((it: any) => !ql || `${it.name} ${it.clientName} ${it.projectName}`.toLowerCase().includes(ql));
  const open = all.filter((it: any) => !it.done);
  const overdueN = open.filter((it: any) => isOverdue(it.deadline)).length;
  const weekN = open.filter((it: any) => !isOverdue(it.deadline) && isThisWeek(it.deadline)).length;

  // one tick = one step. Undo (the app's Undo bar, above the save message) takes exactly that
  // step back — only once the tick is saved, and only while the item still has that status
  const setStatus = async (it: any, status: string, label: string) => {
    try {
      await clientsHook.setWsStatus(it.clientId, it.projectId, [{ id: it.id, status }]);
      showUndo(label, () => clientsHook.revertWsStatus(it.clientId, it.projectId, [it.id], status));
    } catch { /* the save message reports it */ }
  };
  const toggleCreated = (it: any) => setStatus(it, statusRank(it.status) >= 1 ? "Not started" : "Created", statusRank(it.status) >= 1 ? "Back to not started" : "Marked created");
  const toggleDone = (it: any) => setStatus(it, it.done ? "Created" : finalStatus(it.category), it.done ? "Back to created" : `Marked ${finalStatus(it.category).toLowerCase()}`);

  const openItems = items.filter((it: any) => !it.done), doneItems = items.filter((it: any) => it.done);
  const groups: { key: string; label: string; dot: string; list: any[]; folded?: boolean }[] =
    by === "urgency" ? [
      { key: "over", label: "Overdue", dot: PAL.late.mid, list: openItems.filter((it: any) => isOverdue(it.deadline)) },
      { key: "week", label: "Due this week", dot: PAL.waiting.mid, list: openItems.filter((it: any) => !isOverdue(it.deadline) && isThisWeek(it.deadline)) },
      { key: "none", label: "No deadline", dot: PAL.waiting.mid, list: openItems.filter((it: any) => !it.deadline) },
      { key: "later", label: "Later", dot: PAL.neutral.mid, list: openItems.filter((it: any) => it.deadline && !isOverdue(it.deadline) && !isThisWeek(it.deadline)) },
      { key: "done", label: "Done", dot: PAL.done.mid, list: doneItems, folded: true },
    ] : by === "client" ? [
      ...[...new Set(openItems.map((it: any) => it.clientName))].sort().map((n: any) => ({ key: `c-${n}`, label: n || "—", dot: PAL.neutral.mid, list: openItems.filter((it: any) => it.clientName === n) })),
      { key: "done", label: "Done", dot: PAL.done.mid, list: doneItems, folded: true },
    ] : by === "card" ? [
      ...WS_CATS.map(c => ({ key: `k-${c}`, label: WS_CAT_LABEL[c], dot: catTone(c).mid, list: openItems.filter((it: any) => it.category === c) })),
      { key: "done", label: "Done", dot: PAL.done.mid, list: doneItems, folded: true },
    ] : [
      { key: "s0", label: "Not started", dot: PAL.neutral.mid, list: items.filter((it: any) => statusRank(it.status) === 0) },
      { key: "s1", label: "Created", dot: PAL.progress.mid, list: items.filter((it: any) => !it.done && statusRank(it.status) === 1) },
      { key: "s2", label: "Delivered", dot: PAL.waiting.mid, list: items.filter((it: any) => !it.done && statusRank(it.status) === 2) },
      { key: "s3", label: "Done", dot: PAL.done.mid, list: doneItems, folded: true },
    ];

  const winItem = win ? all.find((it: any) => it.projectId === win.pid && it.id === win.id) : null;
  const winProject = winItem ? (clients || []).flatMap((c: any) => c.projects || []).find((p: any) => p.id === winItem.projectId) : null;
  const due = (it: any) => !it.deadline ? null
    : <span style={{ color: isOverdue(it.deadline) && !it.done ? PAL.late.ink : isThisWeek(it.deadline) && !it.done ? PAL.waiting.ink : undefined }}> · due {fmtDeadline(it.deadline)}</span>;

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      {winItem && <ItemWindow item={winItem} project={winProject} clientsHook={clientsHook} onClose={() => setWin(null)} />}
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Workspace</h2>
      <SummaryLine dot={overdueN ? PAL.late.mid : weekN ? PAL.waiting.mid : PAL.done.mid}>
        {open.length} open{overdueN ? <> · <Strong color={PAL.late.ink}>{overdueN} overdue</Strong></> : ""} · {weekN} this week
      </SummaryLine>
      <ChipRow s={{ marginTop: 12 }}>
        {(["urgency", "client", "card", "status"] as By[]).map(k => <Chip key={k} on={by === k} tone={PAL.neutral} dot={false} label={k[0].toUpperCase() + k.slice(1)} onClick={() => setBy(k)} />)}
      </ChipRow>
      <SearchField value={q} onChange={setQ} placeholder="Search items, clients" s={{ marginTop: 10 }} />
      {all.length === 0 && <p style={{ fontSize: TYPE.row.size, color: C.muted, margin: "16px 4px" }}>Nothing in production right now.</p>}
      {/* iPad / computer: the groups in 2 columns (phone: one column) */}
      <ColGroups groups={groups.filter(g => g.list.length).map((g, gi) => {
        const folded = g.folded && !unfold[g.key];
        return { key: g.key, size: g.list.length, node: (
          <div>
            {folded ? (
              <button onClick={() => setUnfold(u => ({ ...u, [g.key]: true }))} aria-expanded={false}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SANS }}>
                <SectionHead dot={g.dot} label={`${g.label} · ${g.list.length}`} right="▾" />
              </button>
            ) : <SectionHead dot={g.dot} label={`${g.label} · ${g.list.length}`} right={gi === 0 ? "created · done" : g.folded ? "" : undefined} />}
            {!folded && (
              <ListCard>
                {g.list.map((it: any, i: number) => (
                  <div key={`${it.projectId}-${it.id}`} role="button" tabIndex={0} onClick={() => setWin({ pid: it.projectId, id: it.id })}
                    onKeyDown={(e: any) => { if (e.key === "Enter") setWin({ pid: it.projectId, id: it.id }); }}
                    style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 54, padding: "9px 0 9px 12px", borderTop: i ? `1px solid ${C.hair}` : "none", cursor: "pointer", boxSizing: "border-box" as const }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: SPACING.listText, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: catTone(it.category).mid, flexShrink: 0 }} />{it.name}
                      </div>
                      <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{it.clientName} · {it.projectName}{due(it)}</div>
                    </div>
                    <Tick2 on={statusRank(it.status) >= 1} tone={PAL.progress} label={`Created: ${it.name}`} onClick={() => toggleCreated(it)} />
                    <Tick2 on={it.done} tone={PAL.done} label={`Done: ${it.name}`} onClick={() => toggleDone(it)} />
                  </div>
                ))}
              </ListCard>
            )}
          </div>
        ) };
      })} />
    </div>
  );
}
