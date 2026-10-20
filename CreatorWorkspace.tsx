// ─────────────────────────────────────────────────────────────
// CreatorWorkspace — where the work happens (Manager list parts)
//   chips group by urgency · client · card · status; search;
//   each row: card dot + name, client · project · due, two square ticks
//   (created = blue, done = pistachio). Tap a row → item window:
//   read view → Edit (name, note, card, own date) → Save back to the read view.
//   No tap-to-change on tags or names any more.
// ─────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, SHADOW, Z, TRACK } from "./constants";
import { fmtD } from "./formatters";
import { SummaryLine, Strong, Chip, ChipRow, SearchField, SectionHead, ListCard, TonedTag, Sheet, PillBtn, I, S, Row } from "./atoms";
import { getWsItems, isOverdue, isThisWeek, fmtDeadline, finalStatus, statusRank, shownStatus, WS_CATS, WS_CAT_LABEL } from "./wsHelpers";
import { catTone, statusTone, Tick2 } from "./CreatorShared";

type By = "urgency" | "client" | "card" | "status";

function ItemWindow({ item, project, clientsHook, onClose }: any) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [d, setD] = useState({ name: item.name, note: item.notes || "", cat: item.category, own: item.ownDate || "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (mode === "read") setD({ name: item.name, note: item.notes || "", cat: item.category, own: item.ownDate || "" }); }, [item, mode]);
  const save = async () => {
    setErr(null);
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
      setMode("read");
    } catch (e: any) { setErr(e?.message || "Couldn't save."); }
  };
  const steps = (item.history || []).map((x: any) => `${shownStatus(x.status)} ${fmtDeadline(x.date)}`).join(" · ");
  const LBL: any = { fontSize: TYPE.micro.size, textTransform: "uppercase", letterSpacing: TRACK.caps, color: C.muted, margin: "12px 0 5px" };
  return (
    <Sheet title={`Item · ${WS_CAT_LABEL[item.category] || item.category}`} onClose={mode === "edit" ? () => setMode("read") : onClose}
      right={mode === "read" ? <PillBtn onClick={() => setMode("edit")}>Edit</PillBtn> : null}
      footer={mode === "edit" ? <>
        <PillBtn onClick={() => setMode("read")} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark onClick={save} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>Save</PillBtn>
      </> : undefined}>
      {mode === "read" ? <>
        <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size }}>{item.name}</div>
        <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 3 }}>{item.clientName} · {item.projectName}</div>
        <ListCard s={{ marginTop: 12 }}>
          <Row first title="Card" right={<TonedTag tone={catTone(item.category)}>{WS_CAT_LABEL[item.category] || item.category}</TonedTag>} s={{ minHeight: 44 }} />
          <Row title="Deadline" meta={item.ownDate ? "your own date" : item.deadline ? "the delivery date" : "none yet"} right={<span style={{ fontSize: TYPE.row.size }}>{item.deadline ? fmtD(item.deadline) : "—"}</span>} />
          <Row title="Status" meta={steps || "no steps yet"} right={<TonedTag tone={statusTone(item.status, item.done)}>{shownStatus(item.status)}</TonedTag>} />
          {item.notes && <Row title="Note" meta={item.notes} />}
        </ListCard>
      </> : <>
        <div style={{ ...LBL, marginTop: 0 }}>Name</div><I value={d.name} onChange={(e: any) => setD(x => ({ ...x, name: e.target.value }))} aria-label="Name" />
        <div style={LBL}>Note</div><I value={d.note} onChange={(e: any) => setD(x => ({ ...x, note: e.target.value }))} aria-label="Note" />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
          <div><div style={LBL}>Card</div><S value={d.cat} aria-label="Card" onChange={(e: any) => setD(x => ({ ...x, cat: e.target.value }))}>{WS_CATS.map(c => <option key={c} value={c}>{WS_CAT_LABEL[c]}</option>)}</S></div>
          <div><div style={LBL}>Own date</div><I type="date" value={d.own} onChange={(e: any) => setD(x => ({ ...x, own: e.target.value }))} aria-label="Own date" /></div>
        </div>
        <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 6 }}>Empty = the project's delivery date.</div>
        {err && <div style={{ fontSize: TYPE.subtext.size, color: PAL.late.ink, marginTop: 8 }}>{err}</div>}
      </>}
    </Sheet>
  );
}

export default function CreatorWorkspace({ clients, isMobile, clientsHook }: { clients: any[]; isMobile: boolean; clientsHook: any }) {
  const [by, setBy] = useState<By>("urgency");
  const [q, setQ] = useState("");
  const [unfold, setUnfold] = useState<Record<string, boolean>>({});
  const [win, setWin] = useState<null | { pid: string; id: string }>(null);
  const [undo, setUndo] = useState<null | { label: string; cid: string; pid: string; id: string; prev: string }>(null);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 5000); return () => clearTimeout(t); }, [undo]);

  const all = useMemo(() => getWsItems(clients), [clients]);
  const ql = q.trim().toLowerCase();
  const items = all.filter((it: any) => !ql || `${it.name} ${it.clientName} ${it.projectName}`.toLowerCase().includes(ql));
  const open = all.filter((it: any) => !it.done);
  const overdueN = open.filter((it: any) => isOverdue(it.deadline)).length;
  const weekN = open.filter((it: any) => !isOverdue(it.deadline) && isThisWeek(it.deadline)).length;

  const setStatus = async (it: any, status: string, label: string) => {
    setUndo({ label, cid: it.clientId, pid: it.projectId, id: it.id, prev: it.status });
    try { await clientsHook.setWsStatus(it.clientId, it.projectId, [{ id: it.id, status }]); } catch { /* the save message reports it */ }
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
      {groups.filter(g => g.list.length).map((g, gi) => {
        const folded = g.folded && !unfold[g.key];
        return (
          <div key={g.key}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: TYPE.body.size, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
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
        );
      })}
      {undo && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: Z.toast, background: C.black, color: C.white, borderRadius: RADIUS.tile, padding: "8px 8px 8px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: TYPE.row.size, boxShadow: SHADOW.pop }}>
          {undo.label}
          <button onClick={async () => { const u = undo; setUndo(null); try { await clientsHook.setWsStatus(u.cid, u.pid, [{ id: u.id, status: u.prev }]); } catch { /* reported */ } }}
            style={{ background: "none", border: "none", color: C.white, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.row.size, minHeight: 36 }}>Undo</button>
        </div>
      )}
    </div>
  );
}
