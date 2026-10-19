// ─────────────────────────────────────────────────────────────
// PlannerTodo — Planner › To-do: the stage you're in and its one-off
// tasks, written like iPhone Notes.
//   Stage card (name, goal, progress, the 5 stages)
//   The list: tick · edit in place · Enter adds the next row ·
//     tap the tag to switch who · ✕ deletes (Undo)
//   "Stage N done → start Stage N+1": open tasks move along, the
//     next stage starts with its prefilled list
//   Finished stages fold below
// Weekly work lives in Manager and Creator; results on Dashboard.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, Tick, ConfirmDialog } from "./atoms";
import { fmtD } from "./formatters";
import { OWNER_LOOK, accLook, rowKind, stageOf, gateOf, byOrder, STAGE_SHORT, thisMonday } from "./planner";
import type { Task, AccountFilter, Owner, Phase, Account, Look, Stage } from "./planner";
import type { PlannerHook } from "./usePlanner";
import { Ico, IC, Subtitle, TabTitle, InlineText } from "./PlannerWindows";
import { showUndo, XBtn } from "./undo";

export interface PlannerView { tab: string; acc: AccountFilter; owner: "all" | Owner; phase: "all" | Phase; }
export const DEFAULT_VIEW: PlannerView = { tab: "todo", acc: "lynnhoa", owner: "all", phase: "all" };

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const ROW_RULE = "#f0ece7";
const NEXT_OWNER: Record<Owner, Owner> = { manager: "creator", creator: "both", both: "manager" };
const URL_RE = /(https?:\/\/[^\s]+)/i;

interface PlannerTodoProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  onAccount?: (a: Account) => void;
  openOutreach?: () => void;
  openTab?:  (tab: string, anchor?: string) => void;
}

export default function PlannerTodo({ planner, view, isMobile, onAccount }: PlannerTodoProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [showDone, setShowDone] = useState(false);
  const [openStage, setOpenStage] = useState<string | null>(null);   // a finished stage, folded open
  const [askNext, setAskNext] = useState(false);
  const [newRow, setNewRow] = useState(0);
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc   = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const aLook = accLook(acc);
  const mine  = stages.filter(s => s.account === acc).sort((a, b) => a.num - b.num);
  const st    = stageOf(stages, acc);
  const next  = st ? mine.find(s => s.num === st.num + 1) : undefined;
  const oneOffs = (num: number) => tasks.filter(t => t.active && t.phase !== "maintain" && t.stageNum === num && (t.account === acc || t.account === "both")).sort(byOrder);
  const list = st ? oneOffs(st.num) : [];
  const done = (t: Task) => planner.doneOf(t);
  const openOnes = list.filter(t => !done(t));
  const doneOnes = list.filter(done);
  const finished = mine.filter(s => s.status === "done" && (!st || s.num < st.num));

  // ── actions ─────────────────────────────────────────────────
  const removeTask = (t: Task) => {
    quiet(planner.updateTask(t.id, { active: false }));
    showUndo(`“${t.title.length > 28 ? t.title.slice(0, 27) + "…" : t.title}” deleted`, () => planner.updateTask(t.id, { active: true }));
  };
  const addNote = async (title: string) => {
    if (!title.trim() || !st) return;
    await quiet(planner.createTask({ title: title.trim(), account: acc, owner: "both", phase: "setup", rhythm: "once", stageNum: st.num, measure: null, how: "", doneWhen: "", link: "" }));
  };
  const finishStage = async () => {
    setAskNext(false);
    if (!st) return;
    const stage = st;
    try {
      const moved = next ? openOnes.filter(t => rowKind(t) !== "auto").map(t => t.id) : [];
      if (next) for (const id of moved) await planner.updateTask(id, { stageNum: next.num });
      await planner.startNextStage(stage, moved);
      if (next) showUndo(`Stage ${next.num} started`, () => planner.reopenStage({ ...stage, moved }));
    } catch { /* the save toast reports it */ }
  };
  const [askReopen, setAskReopen] = useState<Stage | null>(null);
  const reopen = async () => {
    const s = askReopen; setAskReopen(null);
    if (!s) return;
    try { await planner.reopenStage(s); setOpenStage(null); } catch { /* the save toast reports it */ }
  };

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const tag = (t: string, color: string = C.muted) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>{t}</span>;
  const band = (look: Look, title: string, right?: any) => (
    <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: look.color, flexShrink: 0 }} />{title}
      </span>
      {right}
    </div>
  );
  const whoTag = (t: Task, clickable: boolean) => {
    const l = OWNER_LOOK[t.owner];
    return clickable
      ? <button onClick={(e) => { e.stopPropagation(); quiet(planner.updateTask(t.id, { owner: NEXT_OWNER[t.owner] })); }} title="Tap to switch who" aria-label={`Who: ${l.label} (tap to switch)`}
          style={{ background: "none", border: "none", padding: "6px 2px", cursor: "pointer", fontFamily: SANS }}>{tag(l.label, l.color)}</button>
      : tag(l.label, l.color);
  };

  // one note row
  const noteRow = (t: Task) => {
    const s = planner.stateOf(t, thisMonday());
    const isDone = done(t);
    const auto = rowKind(t) === "auto";            // first portfolio set counts itself
    const url = (t.title.match(URL_RE) || [])[1];
    return (
      <div key={t.id} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 12px", borderTop: `1px solid ${ROW_RULE}` }}>
        {auto ? <span style={{ width: 20, flexShrink: 0 }} />
              : <Tick on={isDone} color={C.green} size={20} onClick={() => quiet(planner.setTaskStatus(t, isDone ? "open" : "done"))} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {auto
            ? <span style={{ fontSize: 14, color: isDone ? C.light : C.black }}>{t.title}</span>
            : <InlineText value={t.title} muted={isDone} ariaLabel={t.title}
                onSave={v => { if (!v.trim()) removeTask(t); else quiet(planner.updateTask(t.id, { title: v.trim() })); }}
                onEnter={() => setNewRow(n => n + 1)} />}
        </div>
        {url && <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Open link" style={{ color: C.muted, display: "inline-flex", padding: 4 }}><Ico d={IC.link} size={14} /></a>}
        {auto && <span style={{ fontSize: 13, color: isDone ? C.green : C.black }}>{s.actual ?? 0} / {s.target ?? "–"}</span>}
        {whoTag(t, !auto)}
        {!auto ? <XBtn label={`Delete ${t.title}`} onClick={() => removeTask(t)} /> : <span style={{ width: 28, flexShrink: 0 }} />}
      </div>
    );
  };

  // ── stage card ──────────────────────────────────────────────
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    return (
      <div style={card}>
        {band(aLook, `Stage ${st.num} · ${st.name}`, <span style={{ color: g.ready && g.total ? C.green : C.black, flexShrink: 0 }}>{g.done} / {g.total}{g.ready && g.total ? " ✓" : ""}</span>)}
        <div style={{ padding: "8px 12px 10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 3 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const s2 = mine.find(x => x.num === n);
              const fill = s2?.status === "done" ? 100 : n === st.num ? (g.total ? Math.round((g.done / g.total) * 100) : 0) : 0;
              return <div key={n} style={{ height: 4, background: C.rule }}><div style={{ height: 4, width: `${fill}%`, background: aLook.color }} /></div>;
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 3, marginTop: 5 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const s2 = mine.find(x => x.num === n);
              const cur = n === st.num || s2?.status === "done";
              return <span key={n} style={{ fontSize: TYPE.micro.size, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: cur ? aLook.color : C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s2?.shortName || STAGE_SHORT[n - 1]}</span>;
            })}
          </div>
          {st.goal && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0", lineHeight: 1.4 }}>{st.goal}</p>}
        </div>
      </div>
    );
  })();

  // ── the list ────────────────────────────────────────────────
  const listCard = st && (
    <div style={card}>
      {band(aLook, `Stage ${st.num} · to do`, <span style={{ color: C.black }}>{doneOnes.length} of {list.length}</span>)}
      {openOnes.map(noteRow)}
      <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: `1px solid ${ROW_RULE}` }}>
        <Ico d={IC.plus} size={14} color={C.muted} />
        <div style={{ flex: 1 }}><AddField key={newRow} autoFocus={newRow > 0} placeholder="Add a row" onAdd={addNote} /></div>
      </div>
      {doneOnes.length > 0 && (
        <>
          <button onClick={() => setShowDone(o => !o)} aria-expanded={showDone}
            style={{ width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: `1px solid ${ROW_RULE}`, background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: C.green }}>✓</span>Done · {doneOnes.length}</span>
            <Ico d={showDone ? IC.up : IC.down} size={14} />
          </button>
          {showDone && doneOnes.map(noteRow)}
        </>
      )}
      {next && (
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${ROW_RULE}`, background: "#fcfbf9" }}>
          <B onClick={() => setAskNext(true)} s={{ width: "100%" }}>Stage {st.num} done → start Stage {next.num}</B>
        </div>
      )}
    </div>
  );

  // ── finished stages ─────────────────────────────────────────
  const finishedCards = finished.map((s: Stage) => {
    const l = oneOffs(s.num);
    const open = openStage === s.id;
    return (
      <div key={s.id} style={card}>
        <button onClick={() => setOpenStage(open ? null : s.id)} aria-expanded={open}
          style={{ width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", border: "none", background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted, textAlign: "left" as const }}>
          <span><span style={{ color: C.green }}>✓</span> Stage {s.num} · {s.name}{s.doneOn ? ` · done ${fmtD(s.doneOn)}` : ""}</span>
          <Ico d={open ? IC.up : IC.down} size={13} />
        </button>
        {open && (l.length ? l.map(noteRow) : <p style={{ fontSize: 13, color: C.muted, margin: 0, padding: "10px 12px", borderTop: `1px solid ${ROW_RULE}` }}>No tasks.</p>)}
        {open && s.num === Math.max(...finished.map(x => x.num)) && (
          <div style={{ padding: "8px 12px", borderTop: `1px solid ${ROW_RULE}`, background: "#fcfbf9", display: "flex", justifyContent: "flex-end" }}>
            <B v="sec" onClick={() => setAskReopen(s)} s={{ height: 28, minHeight: 28, fontSize: TYPE.micro.size, letterSpacing: "0.1em" }}>Reopen Stage {s.num}</B>
          </div>
        )}
      </div>
    );
  });

  return (
    <div>
      {askNext && st && next && (
        <ConfirmDialog title={`Stage ${st.num} done → start Stage ${next.num}?`}
          text={openOnes.filter(t => rowKind(t) !== "auto").length
            ? `${openOnes.filter(t => rowKind(t) !== "auto").length} open ${openOnes.filter(t => rowKind(t) !== "auto").length === 1 ? "task moves" : "tasks move"} to Stage ${next.num} · ${next.name}. The weekly goals keep running.`
            : `Stage ${next.num} · ${next.name} starts with its prefilled list. The weekly goals keep running.`}
          okLabel={`Start Stage ${next.num}`} onOk={finishStage} onCancel={() => setAskNext(false)} />
      )}
      {askReopen && (
        <ConfirmDialog title={`Reopen Stage ${askReopen.num} · ${askReopen.name}?`}
          text={`Stage ${askReopen.num} is active again and the later stages go back to upcoming. ${askReopen.moved?.length ? `The ${askReopen.moved.length} ${askReopen.moved.length === 1 ? "task" : "tasks"} that moved on come back. ` : ""}Nothing is lost.`}
          okLabel={`Reopen Stage ${askReopen.num}`} onOk={reopen} onCancel={() => setAskReopen(null)} />
      )}
      <TabTitle title="To-do" acc={acc} onAccount={onAccount} isMobile={isMobile} />
      <Subtitle text={st ? `Stage ${st.num} of 5` : "Stages"} />
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {stageCard}
          {listCard}
          {finishedCards}
          <p style={{ fontSize: 12, color: C.light, margin: "10px 0 0", lineHeight: 1.5 }}>Tick · tap text to edit · Enter adds a row · tap the tag to switch who</p>
        </>
      )}
    </div>
  );
}

// "Add a row" field: Enter adds and stays ready for the next one
function AddField({ placeholder, onAdd, autoFocus }: { placeholder: string; onAdd: (v: string) => void | Promise<void>; autoFocus?: boolean }) {
  const [t, setT] = useState("");
  const add = async () => { const v = t.trim(); if (!v) return; setT(""); await onAdd(v); };
  return (
    <input value={t} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus}
      onChange={(e) => setT(e.target.value)} onBlur={() => { if (t.trim()) add(); }}
      onKeyDown={(e) => { if (e.key === "Enter") add(); }}
      style={{ width: "100%", height: 32, border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 14, color: C.black, padding: 0 }} />
  );
}
