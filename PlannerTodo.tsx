// ─────────────────────────────────────────────────────────────
// PlannerTodo — Planner › To-do, one account at a time
// Header: To-do, account · week, [Plan week] [+ Task]
// ‹ Week › and the All / Manager / Creator switch
// White cards on the cream page:
//   Stage (tap → its gate) · Manager / Creator / Both · this week ·
//   Stage N · to build (done ones fold into "Done · n")
// One line per task. A box only where you tick yourself — tap it
// again to untick. Rows that count themselves show their number
// or ✓ instead, so nothing looks tickable that isn't.
// Colours: manager blue-grey · creator mauve · both warm grey ·
// account colour for the stage · green done · amber needs you now.
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, Tick, BAR_BTN } from "./atoms";
import {
  OWNER_LOOK, accLook, rowKind, periodOf, isoWeek, weekRange, monthName, todayIndex, stageOf, gateOf, isVisible, byOrder, STAGE_SHORT,
} from "./planner";
import type { Task, AccountFilter, Owner, Phase, Account, Look } from "./planner";
import type { PlannerHook } from "./usePlanner";
import { Ico, IC, Toolbar, Subtitle, TaskWindow, PlanWeekWindow, StageWindow } from "./PlannerWindows";

export interface PlannerView { tab: string; acc: AccountFilter; owner: "all" | Owner; phase: "all" | Phase; }
export const DEFAULT_VIEW: PlannerView = { tab: "todo", acc: "lynnhoa", owner: "all", phase: "all" };

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const ROW_RULE = "#f0ece7";

interface PlannerTodoProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  openOutreach?: () => void;
  openTab?:  (tab: string) => void;
}

export default function PlannerTodo({ planner, view, setView, monday, setMonday, isMobile, openOutreach, openTab }: PlannerTodoProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [openTask, setOpenTask]   = useState<string | null>(null);   // task id or "new"
  const [planOpen, setPlanOpen]   = useState(false);
  const [stageOpen, setStageOpen] = useState<string | null>(null);
  const [showDone, setShowDone]   = useState(false);
  const set = (patch: Partial<PlannerView>) => setView({ ...view, ...patch });

  const acc = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const ti  = todayIndex(monday);
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });
  const stateOf = (t: Task) => planner.stateOf(t, monday);

  // ── what shows ──────────────────────────────────────────────
  const inScope = useMemo(() => tasks.filter(t => isVisible(t, stages, view.acc)), [tasks, stages, view.acc]);
  const mine    = (t: Task) => view.owner === "all" || t.owner === view.owner || t.owner === "both";
  const weekly  = inScope.filter(t => t.phase === "maintain" && mine(t)).sort(byOrder);
  const groups  = (["manager", "creator", "both"] as Owner[])
    .map(o => ({ owner: o, list: weekly.filter(t => t.owner === o) }))
    .filter(g => g.list.length > 0);
  const build     = inScope.filter(t => t.phase !== "maintain" && mine(t)).sort(byOrder);
  const buildOpen = build.filter(t => !stateOf(t).done);
  const buildDone = build.filter(t => stateOf(t).done);
  const noNumber  = weekly.filter(t => rowKind(t) === "number" && stateOf(t).target == null).length;

  // ── header pieces ───────────────────────────────────────────
  const ownerSwitch = (
    <div role="tablist" aria-label="Who" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", marginTop: 6, border: `1px solid ${C.rule}`, borderRadius: 2, background: C.white, overflow: "hidden" }}>
      {(["all", "manager", "creator"] as const).map((k, i) => {
        const on = view.owner === k;
        const l = k === "all" ? null : OWNER_LOOK[k];
        return (
          <button key={k} role="tab" aria-selected={on} onClick={() => set({ owner: k })}
            style={{ height: 30, border: "none", borderLeft: i ? `1px solid ${C.rule}` : "none", background: on ? (l ? l.color : C.black) : C.white, color: on ? C.white : (l ? l.color : C.muted), fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {l && <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? C.white : l.color }} />}
            {k === "all" ? "All" : l!.label}
          </button>
        );
      })}
    </div>
  );

  const hint = noNumber > 0 && (
    <button onClick={() => setPlanOpen(true)}
      style={{ marginTop: 12, width: "100%", minHeight: 34, borderRadius: 3, background: "#fdf6ee", border: "1px solid #f0e2d0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 12px", fontFamily: SANS, fontSize: 12, color: "#a8804f", cursor: "pointer", textAlign: "left" as const }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />{noNumber} {noNumber === 1 ? "task has" : "tasks have"} no number for week {isoWeek(monday)}</span>
      <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>Plan week ›</span>
    </button>
  );

  // ── cards ───────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const band = (look: Look, title: string, done: number, total: number, onClick?: () => void, right?: any) => (
    <div onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: look.color, flexShrink: 0 }} />{title}
      </span>
      {right ?? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {done} of {total}
          <span style={{ width: 46, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.08)", overflow: "hidden", display: "inline-block" }}>
            <i style={{ display: "block", height: 3, width: `${total ? Math.round((done / total) * 100) : 0}%`, background: look.color }} />
          </span>
        </span>
      )}
    </div>
  );

  // one line per task
  const tag = (t: string, color: string = C.muted) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>{t}</span>;
  const attn = (t: string) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber }} />{tag(t, C.amber)}</span>;
  const okMark = <span style={{ fontSize: 13, color: C.green }}>✓</span>;

  const row = (t: Task, opts: { ownerTag?: boolean } = {}) => {
    const kind   = rowKind(t);
    const st     = stateOf(t);
    const period = periodOf(t, monday);
    const done   = st.done;
    const toggleCheck = () => t.rhythm === "once"
      ? quiet(planner.setTaskStatus(t, done ? "open" : "done"))
      : quiet(planner.saveEntry(t.id, period, { done: !done }));
    const toggleToday = () => { const days = [...st.days]; days[ti] = !days[ti]; quiet(planner.saveEntry(t.id, period, { days })); };
    const number = <span style={{ fontSize: 13, color: done ? C.green : C.black, whiteSpace: "nowrap" as const }}>{st.actual ?? 0} / {st.target ?? "–"}{done ? " ✓" : ""}</span>;

    let right: any;
    if (t.source === "portfolio_total" || kind === "number") right = number;
    else if (t.source === "kit_waiting") right = done ? okMark : attn(`${st.actual} waiting`);
    else if (t.source === "snapshot") right = done ? okMark : attn("Enter");
    else if (kind === "days") right = (
      <>
        <span style={{ fontSize: 13, color: C.muted }}>{st.daysDone}/7</span>
        {ti >= 0 && <>{tag("Today", st.days[ti] ? C.green : C.amber)}<Tick on={st.days[ti]} color={C.green} size={20} onClick={toggleToday} /></>}
      </>
    );
    else right = (
      <>
        {t.rhythm === "once" && t.status === "in_progress" && !done && tag("In progress", C.amber)}
        {t.rhythm === "monthly" && tag(monthName(period))}
        <Tick on={done} color={C.green} size={20} onClick={toggleCheck} />
      </>
    );
    return (
      <div key={t.id} className="lh-prow" onClick={() => setOpenTask(t.id)}
        style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: `1px solid ${ROW_RULE}`, cursor: "pointer" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: done ? C.light : C.black }}>{t.title}</span>
        {opts.ownerTag && tag(OWNER_LOOK[t.owner].label, OWNER_LOOK[t.owner].color)}
        <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{right}</span>
      </div>
    );
  };

  // stage card (account colour)
  const st = stageOf(stages, acc);
  const aLook = accLook(acc);
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    const list = stages.filter(s => s.account === acc);
    const next = list.find(s => s.num === st.num + 1);
    const ready = g.ready && g.total > 0 && !!next && st.status !== "done";
    return (
      <div style={card}>
        {band(aLook, `Stage ${st.num} · ${st.name}`, g.done, g.total, () => setStageOpen(st.id),
          <span style={{ color: ready ? C.green : C.black, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{ready ? `Ready · start Stage ${next!.num} ›` : `${g.done} / ${g.total} ›`}</span>)}
        <div onClick={() => setStageOpen(st.id)} style={{ padding: "8px 12px 10px", cursor: "pointer" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 3 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const s2 = list.find(x => x.num === n);
              const fill = s2?.status === "done" ? 100 : n === st.num ? (g.total ? Math.round((g.done / g.total) * 100) : 0) : 0;
              return <div key={n} style={{ height: 4, background: C.rule }}><div style={{ height: 4, width: `${fill}%`, background: aLook.color }} /></div>;
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 3, marginTop: 5 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const s2 = list.find(x => x.num === n);
              const cur = n === st.num || s2?.status === "done";
              return <span key={n} style={{ fontSize: TYPE.micro.size, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: cur ? aLook.color : C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s2?.shortName || STAGE_SHORT[n - 1]}</span>;
            })}
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end", gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>To-do</h2>
          <Subtitle acc={acc} text={weekRange(monday)} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <B v="sec" onClick={() => setPlanOpen(true)} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black, background: C.white }}>Plan week</B>
          <B v="sec" onClick={() => setOpenTask("new")} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black, gap: 5, display: "inline-flex", alignItems: "center", background: C.white }}><Ico d={IC.plus} size={12} />Task</B>
        </div>
      </div>
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}>
        <Toolbar monday={monday} setMonday={setMonday} isMobile={true} />
        {ownerSwitch}
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : tasks.length === 0 ? (
        <div style={{ ...card, padding: "16px 14px" }}>
          <p style={{ fontFamily: SERIF, fontSize: 15, color: C.muted, margin: "0 0 8px" }}>No tasks yet</p>
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: 0, lineHeight: 1.7 }}>Run the Planner SQL in Supabase → SQL editor, then come back. Or add your first task with + Task.</p>
        </div>
      ) : (
        <>
          {hint}
          {stageCard}

          {groups.map(g => {
            const look = OWNER_LOOK[g.owner];
            const done = g.list.filter(t => stateOf(t).done).length;
            return (
              <div key={g.owner} style={card}>
                {band(look, `${look.label} · this week`, done, g.list.length)}
                {g.list.map(t => row(t))}
              </div>
            );
          })}

          {build.length > 0 && st && (
            <div style={card}>
              {band(aLook, `Stage ${st.num} · to build`, buildDone.length, build.length)}
              {buildOpen.map(t => row(t, { ownerTag: view.owner === "all" }))}
              {buildDone.length > 0 && (
                <>
                  <button onClick={() => setShowDone(o => !o)} aria-expanded={showDone}
                    style={{ width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: `1px solid ${ROW_RULE}`, background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: C.green }}>✓</span>Done · {buildDone.length}</span>
                    <Ico d={showDone ? IC.up : IC.down} size={14} />
                  </button>
                  {showDone && buildDone.map(t => row(t, { ownerTag: view.owner === "all" }))}
                </>
              )}
            </div>
          )}

          {groups.length === 0 && build.length === 0 && (
            <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Nothing for {view.owner === "all" ? "this account" : OWNER_LOOK[view.owner].label.toLowerCase()} this week.</p>
          )}
        </>
      )}

      {/* ── WINDOWS ── */}
      {openTask && (
        <TaskWindow key={openTask} planner={planner} monday={monday} isMobile={isMobile} onClose={() => setOpenTask(null)} openOutreach={openOutreach} openTab={openTab}
          taskId={openTask === "new" ? undefined : openTask}
          draft={openTask === "new" ? newDraft(view, planner) : undefined} />
      )}
      {planOpen && <PlanWeekWindow planner={planner} monday={monday} isMobile={isMobile} onClose={() => setPlanOpen(false)} />}
      {stageOpen && <StageWindow planner={planner} stageId={stageOpen} isMobile={isMobile} onClose={() => setStageOpen(null)} />}
    </div>
  );
}

// + Task starts in the account you're on, in its current stage, for the person you're looking at
function newDraft(view: PlannerView, planner: PlannerHook): Partial<Task> {
  const acc = view.acc === "all" ? "both" : view.acc;
  const st = stageOf(planner.stages, view.acc === "all" ? "lynnhoa" : view.acc);
  return {
    title: "", account: acc, owner: view.owner !== "all" ? view.owner : "creator",
    phase: "maintain", rhythm: "weekly",
    stageNum: st?.num || 1, measure: null, how: "", doneWhen: "", link: "",
  };
}
