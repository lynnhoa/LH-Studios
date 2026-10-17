// ─────────────────────────────────────────────────────────────
// PlannerTodo — Planner › To-do, one account at a time. No windows:
//   • a box ticks (tap again to untick); the daily box ticks today
//   • rows with a number fill themselves — tap one to jump to its
//     card in Manager or Creator; "Update kits" opens in place
//   • Edit: rename, switch who, set targets (they carry over to the
//     next weeks), delete, add a weekly task
//   • Stage N · to build is a note list: edit in place, Enter adds
//     the next row, an empty row deletes itself
// Colours: manager blue-grey · creator mauve · both warm grey ·
// account colour for the stage · status green / amber / red / grey.
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, Tick, ConfirmDialog, BAR_BTN } from "./atoms";
import {
  OWNER_LOOK, TONE, accLook, rowKind, periodOf, isoWeek, weekRange, monthName, todayIndex, stageOf, gateOf, isVisible, byOrder,
  STAGE_SHORT, goalStatus, parseIntDe, monthGoalOf, monthGoalPatch,
} from "./planner";
import type { Task, AccountFilter, Owner, Phase, Account, Look } from "./planner";
import type { PlannerHook } from "./usePlanner";
import { Ico, IC, Toolbar, Subtitle, InlineText } from "./PlannerWindows";
import { showUndo, XBtn } from "./undo";

export interface PlannerView { tab: string; acc: AccountFilter; owner: "all" | Owner; phase: "all" | Phase; }
export const DEFAULT_VIEW: PlannerView = { tab: "todo", acc: "lynnhoa", owner: "all", phase: "all" };

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const ROW_RULE = "#f0ece7";
const NEXT_OWNER: Record<Owner, Owner> = { manager: "creator", creator: "both", both: "manager" };
const URL_RE = /(https?:\/\/[^\s]+)/i;

// where a number row's work happens: tab + card
export function jumpOf(t: Task): { tab: string; anchor: string } | null {
  switch (t.source) {
    case "snapshot":        return { tab: "manager", anchor: "card-snapshot" };
    case "following":       return { tab: "manager", anchor: "card-following" };
    case "outreach":        return { tab: "manager", anchor: "card-emails" };
    case "pitches":         return { tab: "manager", anchor: "card-sprints" };
    case "ideas":           return { tab: "creator", anchor: "card-ideas" };
    case "posts":           return { tab: "creator", anchor: "card-editorial" };
    case "pieces":          return { tab: "creator", anchor: "card-editorial" };
    case "portfolio_total": return { tab: "creator", anchor: "card-editorial" };
  }
  if (t.area === "community" && t.rhythm === "daily") return { tab: "manager", anchor: "card-community" };
  if (t.rhythm === "monthly" && t.area === "portfolio") return { tab: "creator", anchor: "card-editorial" };
  return null;
}

interface PlannerTodoProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  openOutreach?: () => void;
  openTab?:  (tab: string, anchor?: string) => void;
}

export default function PlannerTodo({ planner, view, setView, monday, setMonday, isMobile, openTab }: PlannerTodoProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [editing, setEditing]     = useState(false);
  const [showDone, setShowDone]   = useState(false);
  const [openRow, setOpenRow]     = useState<string | null>(null);     // a row opened in place (kit handover)
  const [askStart, setAskStart]   = useState(false);
  const [newRow, setNewRow]       = useState(0);                       // focus the "add a row" field
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
    .filter(o => view.owner === "all" || o === view.owner || o === "both")
    .map(o => ({ owner: o, list: weekly.filter(t => t.owner === o) }))
    .filter(g => g.list.length > 0 || editing);
  const build     = inScope.filter(t => t.phase !== "maintain" && mine(t)).sort(byOrder);
  const buildOpen = build.filter(t => !stateOf(t).done);
  const buildDone = build.filter(t => stateOf(t).done);
  const noNumber  = weekly.filter(t => rowKind(t) === "number" && stateOf(t).target == null).length;
  const st = stageOf(stages, acc);
  const aLook = accLook(acc);

  // ── small pieces ────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const tag = (t: string, color: string = C.muted) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>{t}</span>;
  const band = (look: Look, title: string, right: any) => (
    <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: look.color, flexShrink: 0 }} />{title}
      </span>
      {right}
    </div>
  );
  const progress = (look: Look, done: number, total: number) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {done} of {total}
      <span style={{ width: 46, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.08)", overflow: "hidden", display: "inline-block" }}>
        <i style={{ display: "block", height: 3, width: `${total ? Math.round((done / total) * 100) : 0}%`, background: look.color }} />
      </span>
    </span>
  );
  const whoTag = (t: Task, clickable: boolean) => {
    const l = OWNER_LOOK[t.owner];
    return clickable
      ? <button onClick={(e) => { e.stopPropagation(); quiet(planner.updateTask(t.id, { owner: NEXT_OWNER[t.owner] })); }} title="Tap to switch who" aria-label={`Who: ${l.label} (tap to switch)`}
          style={{ background: "none", border: "none", padding: "6px 2px", cursor: "pointer", fontFamily: SANS }}>{tag(l.label, l.color)}</button>
      : tag(l.label, l.color);
  };
  // ✕ switches the task off (its ticks and numbers stay stored) — Undo switches it back on
  const removeTask = (t: Task) => {
    quiet(planner.updateTask(t.id, { active: false }));
    showUndo(`“${t.title.length > 28 ? t.title.slice(0, 27) + "…" : t.title}” deleted`, () => planner.updateTask(t.id, { active: true }));
  };
  const delBtn = (t: Task) => <XBtn label={`Delete ${t.title}`} onClick={() => removeTask(t)} />;

  // ── one weekly row ──────────────────────────────────────────
  const weeklyRow = (t: Task) => {
    const kind   = rowKind(t);
    const s      = stateOf(t);
    const period = periodOf(t, monday);
    const done   = s.done;
    const status = goalStatus(t, s, monday);
    const jump   = jumpOf(t);
    const isKit  = t.source === "kit_waiting";
    const opened = openRow === t.id;
    const toggleCheck = () => quiet(planner.saveEntry(t.id, period, { done: !done }));
    const toggleToday = () => { const days = [...s.days]; days[ti] = !days[ti]; quiet(planner.saveEntry(t.id, period, { days })); };
    const onRow = () => {
      if (editing) return;
      if (isKit) { setOpenRow(opened ? null : t.id); return; }
      if (jump && openTab) openTab(jump.tab, jump.anchor);
    };

    if (editing) {
      return (
        <div key={t.id} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 6px 0 12px", borderTop: `1px solid ${ROW_RULE}` }}>
          <div style={{ flex: 1, minWidth: 0 }}><InlineText value={t.title} ariaLabel={`Name of ${t.title}`} onSave={v => { if (v.trim()) quiet(planner.updateTask(t.id, { title: v.trim() })); }} s={{ border: `1px solid ${C.rule}`, background: C.white }} /></div>
          {whoTag(t, true)}
          {t.rhythm === "monthly" && t.area === "portfolio" && (() => {
            const goal = t.account === "both" ? monthGoalOf(t, planner.entries[`${t.id}|${period}`], acc) : s.target;
            return (
              <input inputMode="numeric" aria-label={`Goal for ${t.title}`} placeholder="–" defaultValue={goal ?? ""} title={`Pieces for ${monthName(period)}`}
                onBlur={(e) => { const v = e.target.value.trim() === "" ? null : parseIntDe(e.target.value); if (v !== goal) quiet(planner.saveEntry(t.id, period, t.account === "both" ? monthGoalPatch(t, planner.entries[`${t.id}|${period}`], acc, v) : { target: v })); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{ width: 52, height: 32, border: `1px solid ${C.rule}`, borderRadius: 2, textAlign: "right" as const, padding: "0 8px", fontFamily: SANS, fontSize: 14, boxSizing: "border-box" as const }} />
            );
          })()}
          {kind === "number" && (
            <input inputMode="numeric" aria-label={`Target for ${t.title}`} placeholder="–" defaultValue={s.target ?? ""}
              onBlur={(e) => { const v = e.target.value.trim() === "" ? null : parseIntDe(e.target.value); if (v !== s.target) quiet(planner.saveEntry(t.id, period, { target: v })); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              style={{ width: 52, height: 32, border: `1px solid ${C.rule}`, borderRadius: 2, textAlign: "right" as const, padding: "0 8px", fontFamily: SANS, fontSize: 14, boxSizing: "border-box" as const }} />
          )}
          {delBtn(t)}
        </div>
      );
    }

    let right: any;
    if (kind === "number" || t.source === "portfolio_total") {
      right = <span style={{ fontSize: 13, color: done ? C.green : C.black, whiteSpace: "nowrap" as const }}>{s.actual ?? 0} / {s.target ?? "–"}</span>;
    } else if (kind === "days") {
      right = <>
        <span style={{ fontSize: 13, color: C.muted }}>{s.daysDone}/7</span>
        {ti >= 0 && <>{tag("Today", s.days[ti] ? C.green : C.amber)}<Tick on={s.days[ti]} color={C.green} size={20} onClick={toggleToday} /></>}
      </>;
    } else if (kind === "auto") {
      right = null;
    } else {
      right = <>{t.rhythm === "monthly" && tag(monthName(period))}<Tick on={done} color={C.green} size={20} onClick={toggleCheck} /></>;
    }
    const showStatus = status && (kind === "number" || kind === "auto" || t.source === "portfolio_total");
    return (
      <div key={t.id}>
        <div className="lh-prow" onClick={onRow}
          style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: `1px solid ${ROW_RULE}`, cursor: jump || isKit ? "pointer" : "default" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: done ? C.light : C.black }}>{t.title}</span>
          {showStatus && status && tag(status.text, TONE[status.tone])}
          <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{right}</span>
          {(jump || isKit) && <Ico d={isKit ? (opened ? IC.up : IC.down) : IC.right} size={13} color={C.light} />}
        </div>
        {isKit && opened && kitInline(t)}
        {t.area === "checkin" && checkinNote(t, period)}
      </div>
    );
  };

  // kit handover, opened in place
  function kitInline(t: Task) {
    const accs = t.account === "both" ? ["lynnhoa", "createbylynn"] : [t.account];
    const waiting = planner.waiting.filter(i => accs.includes(i.account));
    return (
      <div style={{ padding: "0 12px 10px 24px", background: "#fcfbf9" }}>
        {waiting.length === 0 ? <p style={{ fontSize: 13, color: C.green, margin: 0, padding: "8px 0" }}>Nothing waiting ✓</p> : waiting.map(i => (
          <div key={i.id} style={{ minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: `1px solid ${ROW_RULE}` }}>
            <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{i.title}</span>
            <B v="sec" onClick={() => quiet(planner.setItemStatus(i, "in_kit"))} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black, flexShrink: 0 }}>In kit</B>
          </div>
        ))}
        <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>Add the piece to the media kit or pitch deck, then tap In kit.</p>
      </div>
    );
  }

  // one check-in note per week, right under the check-in
  function checkinNote(t: Task, period: string) {
    const e = planner.entries[`${t.id}|${period}`];
    return (
      <div style={{ padding: "0 12px 8px 12px" }}>
        <InlineText value={e?.note || ""} placeholder="Check-in note" ariaLabel="Check-in note"
          onSave={v => quiet(planner.saveEntry(t.id, period, { note: v }))} s={{ fontSize: 13, color: C.muted }} />
      </div>
    );
  }

  // ── the note list (one-off tasks of this stage) ─────────────
  const noteRow = (t: Task) => {
    const s = stateOf(t);
    const done = s.done;
    const auto = rowKind(t) === "auto";            // first portfolio set counts itself
    const url = (t.title.match(URL_RE) || [])[1];
    return (
      <div key={t.id} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 12px", borderTop: `1px solid ${ROW_RULE}` }}>
        {auto ? <span style={{ width: 20, flexShrink: 0 }} />
              : <Tick on={done} color={C.green} size={20} onClick={() => quiet(planner.setTaskStatus(t, done ? "open" : "done"))} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {auto
            ? <span style={{ fontSize: 14, color: done ? C.light : C.black }}>{t.title}</span>
            : <InlineText value={t.title} muted={done} ariaLabel={t.title}
                onSave={v => { if (!v.trim()) removeTask(t); else quiet(planner.updateTask(t.id, { title: v.trim() })); }}
                onEnter={() => setNewRow(n => n + 1)} />}
        </div>
        {url && <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Open link" style={{ color: C.muted, display: "inline-flex", padding: 4 }}><Ico d={IC.link} size={14} /></a>}
        {auto && <span style={{ fontSize: 13, color: done ? C.green : C.black }}>{s.actual ?? 0} / {s.target ?? "–"}</span>}
        {whoTag(t, !auto)}
        {!auto ? delBtn(t) : <span style={{ width: 28, flexShrink: 0 }} />}
      </div>
    );
  };
  const addNote = async (title: string) => {
    if (!title.trim() || !st) return;
    const owner: Owner = view.owner === "all" ? "both" : view.owner;
    await quiet(planner.createTask({ title: title.trim(), account: acc, owner, phase: "setup", rhythm: "once", stageNum: st.num, measure: null, how: "", doneWhen: "", link: "" }));
  };
  const addWeekly = async (owner: Owner, title: string) => {
    if (!title.trim() || !st) return;
    await quiet(planner.createTask({ title: title.trim(), account: acc, owner, phase: "maintain", rhythm: "weekly", stageNum: st.num, measure: null, how: "", doneWhen: "", link: "" }));
  };

  // ── stage card (account colour; Start Stage N right here) ────
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    const list = stages.filter(s => s.account === acc);
    const next = list.find(s => s.num === st.num + 1);
    const ready = g.ready && g.total > 0 && !!next && st.status !== "done";
    return (
      <div style={card}>
        {band(aLook, `Stage ${st.num} · ${st.name}`, <span style={{ color: C.black, flexShrink: 0 }}>{g.done} / {g.total}</span>)}
        <div style={{ padding: "8px 12px 10px" }}>
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
          {st.goal && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0", lineHeight: 1.4 }}>{st.goal}</p>}
          {ready && <B onClick={() => setAskStart(true)} s={{ width: "100%", marginTop: 10 }}>Start Stage {next!.num} · {next!.name}</B>}
        </div>
      </div>
    );
  })();
  const nextStage = st ? stages.find(s => s.account === acc && s.num === st.num + 1) : undefined;

  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>
      {askStart && st && nextStage && <ConfirmDialog title={`Start Stage ${nextStage.num} · ${nextStage.name}?`} text={`Stage ${st.num} is marked done. Its weekly tasks keep running.`} okLabel={`Start Stage ${nextStage.num}`}
        onOk={() => { setAskStart(false); quiet(planner.startNextStage(st)); }} onCancel={() => setAskStart(false)} />}

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end", gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>To-do</h2>
          <Subtitle acc={acc} text={weekRange(monday)} />
        </div>
        <B v={editing ? undefined : "sec"} onClick={() => setEditing(e => !e)} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: editing ? C.white : C.black, background: editing ? C.black : C.white, gap: 5, display: "inline-flex", alignItems: "center" }}>
          {editing ? "Done" : "Edit"}
        </B>
      </div>
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}>
        <Toolbar monday={monday} setMonday={setMonday} isMobile={true} />
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
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {editing && <p style={{ fontSize: 12, color: C.muted, margin: "12px 0 0", lineHeight: 1.5 }}>Rename, tap who to switch, set the numbers (they carry over to the next weeks), or ✕ to delete. Tap Done when finished.</p>}
          {!editing && noNumber > 0 && (
            <button onClick={() => setEditing(true)}
              style={{ marginTop: 12, width: "100%", minHeight: 34, borderRadius: 3, background: "#fdf6ee", border: "1px solid #f0e2d0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 12px", fontFamily: SANS, fontSize: 12, color: "#a8804f", cursor: "pointer", textAlign: "left" as const }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />{noNumber} {noNumber === 1 ? "task has" : "tasks have"} no number yet</span>
              <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>Set numbers ›</span>
            </button>
          )}
          {!editing && stageCard}

          {groups.map(g => {
            const look = OWNER_LOOK[g.owner];
            const done = g.list.filter(t => stateOf(t).done).length;
            return (
              <div key={g.owner} style={card}>
                {band(look, `${look.label} · this week`, progress(look, done, g.list.length))}
                {g.list.map(weeklyRow)}
                {editing && (
                  <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: `1px solid ${ROW_RULE}` }}>
                    <Ico d={IC.plus} size={14} color={C.muted} />
                    <div style={{ flex: 1 }}><AddField placeholder={`Add a weekly task for ${look.label.toLowerCase()}`} onAdd={v => addWeekly(g.owner, v)} /></div>
                  </div>
                )}
              </div>
            );
          })}

          {st && (build.length > 0 || editing || view.owner === "all") && (
            <div style={card}>
              {band(aLook, `Stage ${st.num} · to build`, progress(aLook, buildDone.length, build.length))}
              {buildOpen.map(noteRow)}
              <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: `1px solid ${ROW_RULE}` }}>
                <Ico d={IC.plus} size={14} color={C.muted} />
                <div style={{ flex: 1 }}><AddField key={newRow} autoFocus={newRow > 0} placeholder="Add a row" onAdd={addNote} keepFocus /></div>
              </div>
              {buildDone.length > 0 && (
                <>
                  <button onClick={() => setShowDone(o => !o)} aria-expanded={showDone}
                    style={{ width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: `1px solid ${ROW_RULE}`, background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: C.green }}>✓</span>Done · {buildDone.length}</span>
                    <Ico d={showDone ? IC.up : IC.down} size={14} />
                  </button>
                  {showDone && buildDone.map(noteRow)}
                </>
              )}
            </div>
          )}
          {!editing && <p style={{ fontSize: 12, color: C.light, margin: "10px 0 0" }}>Week {isoWeek(monday)} · tap a number to go to its card</p>}
        </>
      )}
    </div>
  );
}

// "Add a row" field: Enter adds and stays ready for the next one
function AddField({ placeholder, onAdd, autoFocus, keepFocus }: { placeholder: string; onAdd: (v: string) => void | Promise<void>; autoFocus?: boolean; keepFocus?: boolean }) {
  const [t, setT] = useState("");
  const add = async () => { const v = t.trim(); if (!v) return; setT(""); await onAdd(v); };
  return (
    <input value={t} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus}
      onChange={(e) => setT(e.target.value)} onBlur={() => { if (!keepFocus) add(); else if (t.trim()) add(); }}
      onKeyDown={(e) => { if (e.key === "Enter") add(); }}
      style={{ width: "100%", height: 32, border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 14, color: C.black, padding: 0 }} />
  );
}
