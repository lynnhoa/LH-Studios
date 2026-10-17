// ─────────────────────────────────────────────────────────────
// PlannerManager — Planner › Manager (the manager's workspace).
// One card, this week's goals, two columns: Done (his number) and
// Goal (yours — locked; "Edit goals" opens them, "Done" locks them).
//   Engaging · a box per day (goal: 7 days)
//   Following · New emails (counted from the email list) · Pitches
//   Leads (no goal) · Kits (pieces waiting, In kit right here)
//   Check-in note for the week
// From Stage 2: the sales sprint on top while it runs — pitches and
// follow-ups typed per day, a 14-day strip, End & review. Between
// sprints a thin Start row (✕ hides it).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, BAR_BTN } from "./atoms";
import {
  DAY_SHORT, OWNER_LOOK, isVisible, periodOf, stageNumOf, todayIndex, weekRange, fmtPct2, addDays, thisMonday, mondayOf,
  MANAGER_GOAL, managerOrder, rowKind, parseIntDe, daysBetween,
} from "./planner";
import type { Task, Account, Sprint } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { OUTREACH_TIERS, OUTREACH_CATEGORIES } from "./outreach";
import { today } from "./formatters";
import { Ico, IC, Bar, Toolbar, Subtitle, SprintWindow, sprintRange, sprintDay, ResultMark, useGuide, GuideBtn, GuideCard, InlineText } from "./PlannerWindows";
import { XBtn } from "./undo";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.manager;
const NAME = (t: Task) => (t.area === "community" ? "Engaging" : t.source === "following" ? "Following" : t.source === "outreach" ? "New emails" : t.source === "pitches" ? "Pitches" : t.source === "leads" ? "Leads" : t.title);
const ICON = (t: Task) => (t.area === "community" ? IC.heart : t.source === "following" ? IC.userPlus : t.source === "outreach" ? IC.mail : t.source === "leads" ? IC.spark : IC.send);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLabel = (d: string) => { const [y, m, dd] = d.split("-").map(Number); const dt = new Date(y, m - 1, dd); return `${WD[dt.getDay()]} ${String(dd).padStart(2, "0")}.${String(m).padStart(2, "0")}.`; };
const GRID = "92px 56px 56px minmax(0,1fr)";

interface PlannerManagerProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  openOutreach?: () => void;
  openTab?:  (tab: string, anchor?: string) => void;
}

export default function PlannerManager({ planner, view, monday, setMonday, isMobile }: PlannerManagerProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [sprintWin, setSprintWin] = useState<{ id?: string; acc?: Account; review?: boolean } | null>(null);
  const [editGoals, setEditGoals] = useState(false);
  const [kitsOpen, setKitsOpen]   = useState(false);
  const [pastOpen, setPastOpen]   = useState(false);
  const [pick, setPick]           = useState<string | null>(null);   // a sprint day picked in the strip (default today)
  const guide = useGuide("manager");
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const forAcc = (t: Task) => t.account === acc || t.account === "both";
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const goals  = visible.filter(t => MANAGER_GOAL(t) && forAcc(t)).sort((a, b) => managerOrder(a) - managerOrder(b));
  const counted = goals.filter(t => t.source !== "leads");                    // leads has no goal
  const kitT   = visible.find(t => t.source === "kit_waiting" && forAcc(t));
  const checkT = visible.find(t => t.area === "checkin" && forAcc(t));
  const pitchT = goals.find(t => t.source === "pitches");
  const ti     = todayIndex(monday);
  const over   = monday < thisMonday();
  const stage2 = stageNumOf(stages, acc) >= 2;
  const sprintW = stages.find(s => s.num === 2 && s.account === acc)?.sprintWeeks ?? 2;
  const reached = counted.filter(t => planner.stateOf(t, monday).done).length;

  // ── the running sprint (if any) ─────────────────────────────
  const sp = stage2 ? planner.activeSprint(acc) : undefined;
  const spWeeks = sp ? Math.max(1, Math.round((daysBetween(sp.startOn, sp.endOn) + 1) / 7)) : 0;
  const workDays = spWeeks * 5;
  const dailyP = sp?.pitchGoal ? Math.ceil(sp.pitchGoal / workDays) : null;
  const dailyF = sp?.followUpGoal ? Math.ceil(sp.followUpGoal / workDays) : null;
  const weekShare = sp?.pitchGoal ? Math.ceil(sp.pitchGoal / spWeeks) : null;
  const sumWeek = (s: Sprint, wk: string, days = s.days) => Object.entries(days || {}).filter(([d]) => d >= wk && d <= addDays(wk, 6)).reduce((m, [, v]) => m + (Number(v?.p) || 0), 0);
  const sprintThisWeek = !!sp && sp.startOn <= addDays(monday, 6) && sp.endOn >= monday;

  // while a sprint covers this week, the weekly Pitches row shows the sprint's numbers (kept in sync)
  const syncWeek = sp && pitchT && sprintThisWeek ? { actual: sumWeek(sp, monday), target: weekShare } : null;
  useEffect(() => {
    if (!syncWeek || !pitchT || !sp) return;
    // after the sprint, your own weekly pitch goal comes back (the sprint's share doesn't carry over)
    if (syncWeek.target != null) {
      const after = mondayOf(addDays(sp.endOn, 1));
      const own = planner.targetOf(pitchT.id, mondayOf(sp.startOn));        // read before the sprint week is overwritten
      if (planner.entries[`${pitchT.id}|${after}`]?.target == null && own != null && own !== syncWeek.target) quiet(planner.saveEntry(pitchT.id, after, { target: own }));
    }
    const e = planner.entries[`${pitchT.id}|${monday}`];
    if ((e?.actual ?? null) !== syncWeek.actual || (syncWeek.target != null && (e?.target ?? null) !== syncWeek.target))
      quiet(planner.saveEntry(pitchT.id, monday, { actual: syncWeek.actual, ...(syncWeek.target != null ? { target: syncWeek.target } : {}) }));
  }, [syncWeek?.actual, syncWeek?.target, pitchT?.id, monday]);

  // a day's numbers → the sprint, and the week's pitches follow (no typing twice)
  const saveDay = (s: Sprint, day: string, key: "p" | "f", v: number | null) => {
    const days = { ...s.days, [day]: { ...(s.days[day] || {}), [key]: v } };
    quiet(planner.updateSprint(s.id, { days }));
    if (key === "p" && pitchT) {
      const wk = mondayOf(day);
      quiet(planner.saveEntry(pitchT.id, wk, { actual: sumWeek(s, wk, days), ...(weekShare != null ? { target: weekShare } : {}) }));
    }
  };

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 10, overflow: "hidden" };
  const band = (title: string, right?: any) => (
    <div style={{ minHeight: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span>{title}</span>{right}
    </div>
  );
  const numField = (value: number | null, label: string, onSave: (v: number | null) => void, goal = false) => (
    <input key={`${label}-${value}`} inputMode="numeric" defaultValue={value ?? ""} placeholder="–" aria-label={label} onFocus={(e) => e.target.select()}
      onBlur={(e) => { const v = e.target.value.trim() === "" ? null : parseIntDe(e.target.value); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{ width: "100%", height: 28, border: `1px solid ${goal ? look.color : C.rule}`, borderRadius: 2, padding: "0 7px", textAlign: "right" as const, fontFamily: SANS, fontSize: 13, background: goal ? C.white : "#faf9f7", boxSizing: "border-box" as const }} />
  );
  const plain = (v: any, muted = false) => <span style={{ textAlign: "right" as const, paddingRight: 8, fontSize: 13, color: muted ? C.light : C.black }}>{v ?? "–"}</span>;
  const lock = <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" aria-hidden="true"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>;

  // one goal line
  const goalRow = (t: Task) => {
    const s = planner.stateOf(t, monday);
    const period = periodOf(t, monday);
    const days = rowKind(t) === "days";
    const leads = t.source === "leads";
    const fromSprint = t.source === "pitches" && sprintThisWeek;
    const left = s.target != null ? Math.max(0, s.target - (s.actual ?? 0)) : null;
    const state: "reached" | "togo" | "missed" | "none" =
      s.done ? "reached" : days ? (over ? "missed" : "togo") : s.target == null ? "none" : over ? "missed" : "togo";
    const text = state === "togo" ? `${days ? 7 - s.daysDone : left} to go` : state === "missed" ? (days ? `${s.daysDone} / 7` : `−${left}`) : state === "none" ? "No goal set" : undefined;
    const typed = !fromSprint && (t.source === "following" || t.source === "pitches" || leads);
    return (
      <div key={t.id} style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", columnGap: 8, padding: "0 12px", minHeight: 42, borderTop: "1px solid #f0ece7", fontSize: 13 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: s.done ? C.muted : C.black }}><Ico d={ICON(t)} size={13} color={look.color} />{NAME(t)}</span>
        {days ? (
          <span style={{ gridColumn: "span 2", display: "flex", justifyContent: "space-between", gap: 2 }}>
            {DAY_SHORT.map((d, i) => {
              const on = s.days[i];
              return (
                <button key={d} onClick={() => { const ds = [...s.days]; ds[i] = !ds[i]; quiet(planner.saveEntry(t.id, period, { days: ds })); }}
                  aria-pressed={on} aria-label={`${d}${on ? ", done" : ""}`} title={d}
                  style={{ width: 16, height: 16, padding: 0, flexShrink: 0, borderRadius: 3, cursor: "pointer", boxSizing: "border-box" as const,
                    border: i === ti ? `2px solid ${C.black}` : `1.5px solid ${on ? C.green : C.light}`, background: on ? C.green : C.white, color: C.white, fontSize: 9, lineHeight: 1 }}>{on ? "✓" : ""}</button>
              );
            })}
          </span>
        ) : (
          <>
            {typed ? numField(s.actual, `${NAME(t)} this week`, v => quiet(planner.saveEntry(t.id, period, { actual: v }))) : plain(s.actual ?? 0)}
            {leads ? plain("–", true)
              : fromSprint ? plain(s.target)
              : editGoals ? numField(s.target, `Goal for ${NAME(t)}`, v => quiet(planner.saveEntry(t.id, period, { target: v })), true)
              : plain(s.target, s.target == null)}
          </>
        )}
        {leads ? <span />
          : fromSprint && !s.done ? <span style={{ ...microLabel, textAlign: "right" as const }}>From sprint</span>
          : <span style={{ display: "flex", justifyContent: "flex-end" }}><ResultMark state={state} text={text} /></span>}
      </div>
    );
  };

  // kits: pieces waiting for the media kit / pitch deck
  const kitsRow = kitT && (() => {
    const s = planner.stateOf(kitT, monday);
    const accs = kitT.account === "both" ? ["lynnhoa", "createbylynn"] : [kitT.account];
    const waiting = planner.waiting.filter(i => accs.includes(i.account));
    return (
      <div key="kits">
        <button onClick={() => setKitsOpen(o => !o)} aria-expanded={kitsOpen}
          style={{ width: "100%", display: "grid", gridTemplateColumns: GRID, alignItems: "center", columnGap: 8, padding: "0 12px", minHeight: 42, border: "none", borderTop: "1px solid #f0ece7", background: C.white, cursor: "pointer", fontFamily: SANS, fontSize: 13, textAlign: "left" as const, color: C.black }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.copy} size={13} color={look.color} />Kits</span>
          <span style={{ gridColumn: "span 2", fontSize: 12, color: waiting.length ? C.amber : C.muted }}>{waiting.length ? `${waiting.length} ${waiting.length === 1 ? "piece" : "pieces"} waiting` : "Nothing waiting"} <Ico d={kitsOpen ? IC.up : IC.down} size={11} /></span>
          <span style={{ display: "flex", justifyContent: "flex-end" }}>{s.done ? <ResultMark state="reached" /> : null}</span>
        </button>
        {kitsOpen && (
          <div style={{ padding: "0 12px 8px 30px", background: "#fcfbf9" }}>
            {waiting.length === 0 ? <p style={{ fontSize: 12, color: C.green, margin: 0, padding: "8px 0" }}>Nothing waiting ✓</p> : waiting.map(i => (
              <div key={i.id} style={{ minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: "1px solid #f0ece7" }}>
                <span style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{i.title}</span>
                <B v="sec" onClick={() => quiet(planner.setItemStatus(i, "in_kit"))} s={{ ...BAR_BTN, height: 26, minHeight: 26, color: C.black, flexShrink: 0 }}>In kit</B>
              </div>
            ))}
            <p style={{ fontSize: 11, color: C.muted, margin: "6px 0 0" }}>Add the piece to the media kit or pitch deck, then tap In kit.</p>
          </div>
        )}
      </div>
    );
  })();

  const checkNote = checkT && (() => {
    const e = planner.entries[`${checkT.id}|${periodOf(checkT, monday)}`];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderTop: "1px solid #f0ece7", background: "#fcfbf9" }}>
        <span style={{ ...microLabel, flexShrink: 0 }}>Check-in</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineText value={e?.note || ""} placeholder="Note for this week" ariaLabel="Check-in note"
            onSave={v => quiet(planner.saveEntry(checkT.id, periodOf(checkT, monday), { note: v }))} s={{ fontSize: 13 }} />
        </div>
      </div>
    );
  })();

  const goalsCard = (
    <div id="card-goals" style={{ ...card, boxShadow: sp ? "none" : "0 6px 18px rgba(26,26,26,0.06)" }}>
      {band("This week's goals",
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: counted.length && reached === counted.length ? C.green : C.black }}>{reached} of {counted.length} reached</span>
          <button onClick={() => setEditGoals(e => !e)} aria-pressed={editGoals}
            style={{ height: 22, padding: "0 7px", borderRadius: 2, border: `1px solid ${editGoals ? C.black : C.rule}`, background: editGoals ? C.black : C.white, color: editGoals ? C.white : C.black, fontFamily: SANS, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {editGoals ? "Done" : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.black} strokeWidth="2" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>Edit goals</>}
          </button>
        </span>)}
      <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 8, padding: "0 12px", minHeight: 24, alignItems: "center", background: "#fcfbf9", fontSize: 9, letterSpacing: "0.1em", color: C.muted }}>
        <span /><span style={{ textAlign: "right" as const, paddingRight: 8 }}>DONE</span>
        <span style={{ textAlign: "right" as const, paddingRight: 8, display: "inline-flex", justifyContent: "flex-end", alignItems: "center", gap: 3, color: editGoals ? look.color : C.muted }}>{!editGoals && lock}GOAL</span><span />
      </div>
      {goals.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0, padding: "10px 12px" }}>No goals for this account yet.</p>}
      {goals.map(goalRow)}
      {kitsRow}
      {checkNote}
    </div>
  );

  // ── sales sprint (Stage 2 on) ───────────────────────────────
  const hideKey = `lh_sprint_hidden_${acc}`;
  const [, rerender] = useState(0);
  const hidden = (() => { try { return localStorage.getItem(hideKey) === "1"; } catch { return false; } })();   // per account, on this device
  const setHide = (v: boolean) => { try { v ? localStorage.setItem(hideKey, "1") : localStorage.removeItem(hideKey); } catch { /* ignore */ } rerender(n => n + 1); };
  const past = planner.sprints.filter(x => x.account === acc && x.status === "done").sort((a, b) => b.startOn.localeCompare(a.startOn));
  const focusText = (s: Sprint) => `${s.focusCategory ? (OUTREACH_CATEGORIES.find(c => c.key === s.focusCategory)?.label || s.focusCategory) : "Any"} · ${OUTREACH_TIERS.find(t => t.key === s.focusTier)?.label || "Now"}`;

  const sprintCard = sp && (() => {
    const st = planner.sprintStats(sp);
    const td = today();
    const d = sprintDay(sp, td);
    const allDays = Array.from({ length: daysBetween(sp.startOn, sp.endOn) + 1 }, (_, k) => addDays(sp.startOn, k));
    const day = pick && allDays.includes(pick) ? pick : (allDays.includes(td) ? td : allDays[allDays.length - 1]);
    const v = sp.days[day] || {};
    const isToday = day === td;
    const mark = (val: number | null | undefined, target: number | null) =>
      target == null ? <span /> : (Number(val) || 0) >= target ? <ResultMark state="reached" /> : <ResultMark state="togo" text={`${target - (Number(val) || 0)} to go`} />;
    const row = (label: string, key: "p" | "f", target: number | null) => (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 56px 44px 72px", alignItems: "center", columnGap: 8, padding: "0 12px", minHeight: 42, borderTop: "1px solid #f0ece7", fontSize: 13 }}>
        <span>{label} {isToday ? "today" : <span style={{ color: C.muted }}>· {dayLabel(day)}</span>}</span>
        {numField(v[key] ?? null, `${label} ${isToday ? "today" : dayLabel(day)}`, val => saveDay(sp, day, key, val))}
        <span style={{ fontSize: 13 }}>/ {target ?? "–"}</span>
        <span style={{ display: "flex", justifyContent: "flex-end" }}>{mark(v[key], target)}</span>
      </div>
    );
    return (
      <div id="card-sprints" style={{ ...card, boxShadow: "0 6px 18px rgba(26,26,26,0.08)", borderColor: look.border }}>
        {band(`Sales sprint ${sp.num} · day ${d.day} of ${d.total}`, <span style={{ color: C.black }}>{focusText(sp)}</span>)}
        {row("Pitches", "p", dailyP)}
        {row("Follow-ups", "f", dailyF)}
        <div style={{ padding: "8px 12px", borderTop: "1px solid #f0ece7", display: "grid", gridTemplateColumns: `repeat(${Math.min(14, allDays.length)}, minmax(0,1fr))`, gap: 3 }}>
          {allDays.map(dd => {
            const n = sp.days[dd]?.p;
            const hit = dailyP != null && (Number(n) || 0) >= dailyP;
            const sel = dd === day;
            return (
              <button key={dd} onClick={() => setPick(dd)} aria-label={`${dayLabel(dd)}: ${n ?? "–"} pitches`} title={dayLabel(dd)}
                style={{ height: 22, padding: 0, borderRadius: 2, cursor: "pointer", fontFamily: SANS, fontSize: 11, boxSizing: "border-box" as const,
                  border: sel ? `2px solid ${C.black}` : `1px solid ${hit ? "#b8d4b8" : C.rule}`, background: hit ? "#f0f5f0" : C.white, color: n == null ? C.light : C.black }}>{n ?? "–"}</button>
            );
          })}
        </div>
        <div style={{ padding: "2px 12px 10px", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Pitches {st.pitches} / {sp.pitchGoal ?? "–"}</span><span>Follow-ups {st.followUps} / {sp.followUpGoal ?? "–"}</span></div>
          <Bar value={st.pitches} max={sp.pitchGoal ?? 0} done={sp.pitchGoal != null && st.pitches >= sp.pitchGoal} color={look.color} track={look.border} h={3} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 12px", borderTop: "1px solid #f0ece7", background: "#fcfbf9" }}>
          <span style={{ fontSize: 11, color: C.muted }}>{dailyP ? `Daily target ${dailyP} = ${sp.pitchGoal} pitches over ${workDays} work days` : sprintRange(sp)}</span>
          <B v="sec" onClick={() => setSprintWin({ id: sp.id, review: true })} s={{ ...BAR_BTN, height: 26, minHeight: 26, color: C.black, flexShrink: 0 }}>End &amp; review</B>
        </div>
      </div>
    );
  })();

  const sprintIdle = stage2 && !sp && !hidden && (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px 8px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={microLabel}>Sales sprint</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {past[0] ? `Last: Sprint ${past[0].num} · ${planner.sprintStats(past[0]).deals} ${planner.sprintStats(past[0]).deals === 1 ? "deal" : "deals"}` : "Start one when the pipeline is thin"}
          </div>
        </div>
        <B v="sec" onClick={() => setSprintWin({ acc })} s={{ ...BAR_BTN, height: 26, minHeight: 26, color: C.black, flexShrink: 0 }}>Start</B>
        <XBtn label="Hide the sales sprint" onClick={() => setHide(true)} />
      </div>
      {past.length > 0 && (
        <>
          <button onClick={() => setPastOpen(o => !o)} aria-expanded={pastOpen}
            style={{ width: "100%", minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: "1px solid #f0ece7", background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.muted }}>
            <span>Past sprints · {past.length}</span><Ico d={pastOpen ? IC.up : IC.down} size={12} />
          </button>
          {pastOpen && past.map(p => {
            const ps = planner.sprintStats(p);
            return (
              <button key={p.id} onClick={() => setSprintWin({ id: p.id })}
                style={{ width: "100%", minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", border: "none", borderTop: "1px solid #f0ece7", background: C.white, cursor: "pointer", fontFamily: SANS, fontSize: 13, textAlign: "left" as const }}>
                <span>Sprint {p.num} <span style={{ color: C.muted, fontSize: 12 }}>· {focusText(p)}</span></span>
                <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" as const }}>{ps.pitches} pitches · {ps.rate == null ? "–" : fmtPct2(ps.rate)} · {ps.deals} {ps.deals === 1 ? "deal" : "deals"}</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Manager</h2>
        <GuideBtn on={guide.open} onClick={guide.toggle} />
      </div>
      <Subtitle acc={acc} text="Manager's workspace" />
      {guide.open && <GuideCard onClose={guide.close} steps={[
        "Tick Engaging every day you engage.",
        "Type Following, Pitches and Leads anytime during the week, by Sunday at the latest. New emails count by themselves from the email list.",
        stage2 ? "In a sales sprint, type the pitches and follow-ups each day. At the end: End & review." : "Goals are set with Edit goals, usually at the check-in.",
      ]} />}
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}><Toolbar monday={monday} setMonday={setMonday} isMobile={true} /></div>
      <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>{weekRange(monday)}{over ? " · closed, still editable" : ""}</p>

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {stage2 && planner.stage2Error && <p style={{ fontSize: 12, color: C.red, margin: "12px 0 0", lineHeight: 1.5 }}>{planner.stage2Error}</p>}
          {sprintCard}
          {sprintIdle}
          {goalsCard}
          {stage2 && !sp && hidden && (
            <button onClick={() => setHide(false)} style={{ marginTop: 12, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.light }}>Show sales sprint</button>
          )}
          {!stage2 && <div style={{ marginTop: 12, fontSize: 12, color: C.light, display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.lock} size={12} />Sales sprint · from Stage 2</div>}
        </>
      )}

      {sprintWin && (
        <SprintWindow key={`${sprintWin.id || "new"}-${sprintWin.review ? "r" : ""}`} planner={planner} sprintId={sprintWin.id} review={sprintWin.review} isMobile={isMobile} onClose={() => setSprintWin(null)}
          draft={sprintWin.acc ? { account: sprintWin.acc, startOn: thisMonday(), endOn: addDays(thisMonday(), sprintW * 7 - 1), focusCategory: "", focusTier: "now", pitchGoal: null, followUpGoal: null, review: "" } : undefined} />
      )}
    </div>
  );
}
