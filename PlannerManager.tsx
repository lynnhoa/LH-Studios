// ─────────────────────────────────────────────────────────────
// PlannerManager — Planner › Manager (the manager's workspace), one
// account. One card: this week's goals, one line each.
//   Engaging   · a box per day (tap to tick / untick)
//   Following  · his number, typed anytime during the week
//   New emails · counted from Outreach
//   Pitches    · his number, typed anytime during the week
//   Leads      · his number, typed anytime during the week
// The goal (dotted) is set at the check-in and carries over.
// Each line ends with ✓ once reached, "3 to go" while the week
// runs, or ✕ once the week is over. Stage 2 adds the sprint on top.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, BAR_BTN } from "./atoms";
import {
  DAY_SHORT, OWNER_LOOK, isVisible, periodOf, stageNumOf, todayIndex, weekRange, fmtPct2, addDays, isoWeek, thisMonday,
  MANAGER_GOAL, managerOrder, rowKind, parseIntDe,
} from "./planner";
import type { Task, Account } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { OUTREACH_TIERS } from "./outreach";
import { fmtD, today } from "./formatters";
import { Ico, IC, Bar, Toolbar, Subtitle, CatChip, SprintWindow, sprintRange, sprintDay, GoalNum, ResultMark, useGuide, GuideBtn, GuideCard } from "./PlannerWindows";
import { showUndo, XBtn } from "./undo";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.manager;
const NAME = (t: Task) => (t.area === "community" ? "Engaging" : t.source === "following" ? "Following" : t.source === "outreach" ? "New emails" : t.source === "pitches" ? "Pitches" : t.source === "leads" ? "Leads" : t.title);
const ICON = (t: Task) => (t.area === "community" ? IC.heart : t.source === "following" ? IC.userPlus : t.source === "outreach" ? IC.mail : t.source === "leads" ? IC.spark : IC.send);

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

export default function PlannerManager({ planner, view, monday, setMonday, isMobile, openOutreach }: PlannerManagerProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [openSprint, setOpenSprint] = useState<{ id?: string; acc?: Account } | null>(null);
  const guide = useGuide("manager");
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const goals  = tasks.filter(t => isVisible(t, stages, view.acc) && MANAGER_GOAL(t) && (t.account === acc || t.account === "both"))
    .sort((a, b) => managerOrder(a) - managerOrder(b));
  const ti     = todayIndex(monday);
  const over   = monday < thisMonday();                    // the week is closed
  const stage2 = stageNumOf(stages, acc) >= 2;
  const sprintW = stages.find(s => s.num === 2 && s.account === acc)?.sprintWeeks ?? 2;
  const reached = goals.filter(t => planner.stateOf(t, monday).done).length;

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 10, overflow: "hidden" };
  const band = (title: string, right?: any) => (
    <div style={{ minHeight: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span>{title}</span>{right}
    </div>
  );
  const hint = (t: string) => <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0", lineHeight: 1.4 }}>{t}</p>;
  const body: any = { padding: "10px 12px 12px" };
  const field = (value: number | null, label: string, onSave: (v: number | null) => void) => (
    <input key={`${label}-${value}`} inputMode="numeric" defaultValue={value ?? ""} placeholder="–" aria-label={label} onFocus={(e) => e.target.select()}
      onBlur={(e) => { const v = e.target.value.trim() === "" ? null : parseIntDe(e.target.value); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{ width: 58, height: 28, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "0 8px", textAlign: "right" as const, fontFamily: SANS, fontSize: 13, background: "#faf9f7", boxSizing: "border-box" as const }} />
  );

  // one goal, one line: name · the number or the days · the mark
  const goalRow = (t: Task) => {
    const s = planner.stateOf(t, monday);
    const period = periodOf(t, monday);
    const kind = rowKind(t);
    const days = kind === "days";
    const left = s.target != null ? Math.max(0, s.target - (s.actual ?? 0)) : null;
    const state: "reached" | "togo" | "missed" | "none" =
      s.done ? "reached" : days ? (over ? "missed" : "togo") : s.target == null ? "none" : over ? "missed" : "togo";
    const text = state === "togo" ? `${days ? 7 - s.daysDone : left} to go` : state === "missed" ? (days ? `${s.daysDone} / 7` : `−${left}`) : state === "none" ? "No number" : undefined;
    const typed = t.source === "following" || t.source === "pitches" || t.source === "leads" || (kind === "number" && t.source !== "outreach");
    return (
      <div key={t.id} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: "1px solid #f0ece7", fontSize: 13 }}>
        <span style={{ width: 92, flexShrink: 0, display: "flex", alignItems: "center", gap: 6, color: s.done ? C.muted : C.black }}><Ico d={ICON(t)} size={13} color={look.color} />{NAME(t)}</span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: days ? 4 : 6 }}>
          {days ? DAY_SHORT.map((d, i) => {
            const on = s.days[i];
            return (
              <button key={d} onClick={() => { const ds = [...s.days]; ds[i] = !ds[i]; quiet(planner.saveEntry(t.id, period, { days: ds })); }}
                aria-pressed={on} aria-label={`${d}${on ? ", done" : ""}`} title={d}
                style={{ width: 20, height: 20, padding: 0, flexShrink: 0, borderRadius: 3, cursor: "pointer", boxSizing: "border-box" as const,
                  border: i === ti ? `2px solid ${C.black}` : `1.5px solid ${on ? C.green : C.light}`, background: on ? C.green : C.white, color: C.white, fontSize: 10, lineHeight: 1 }}>{on ? "✓" : ""}</button>
            );
          }) : (
            <>
              {typed ? field(s.actual, `${NAME(t)} this week`, v => quiet(planner.saveEntry(t.id, period, { actual: v }))) : <span>{s.actual ?? 0}</span>}
              <span>/ <GoalNum value={s.target} label={`Goal for ${NAME(t)}`} onSave={v => quiet(planner.saveEntry(t.id, period, { target: v }))} /></span>
              {!typed && <span style={{ fontSize: 11, color: C.light, whiteSpace: "nowrap" as const }}>from Outreach</span>}
            </>
          )}
        </span>
        <ResultMark state={state} text={text} />
      </div>
    );
  };

  const goalsCard = (
    <div id="card-goals" style={{ ...card, boxShadow: "0 6px 18px rgba(26,26,26,0.06)" }}>
      {band("This week's goals", <span style={{ color: goals.length && reached === goals.length ? C.green : C.black }}>{reached} of {goals.length} reached</span>)}
      {goals.length === 0 && <div style={body}><p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No goals for this account yet.</p></div>}
      {goals.map(goalRow)}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid #f0ece7", background: "#fcfbf9" }}>
        <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{over ? "Week closed · still editable if something was forgotten" : "Update anytime this week · by Sunday at the latest"}</span>
        {openOutreach && <B v="sec" onClick={openOutreach} s={{ ...BAR_BTN, height: 24, minHeight: 24, color: C.black, gap: 4, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>Outreach<Ico d={IC.link} size={11} /></B>}
      </div>
    </div>
  );

  // ── Stage 2: the sprint and the pitch log ───────────────────
  const sprintCard = (() => {
    const sp = planner.activeSprint(acc);
    const past = planner.sprints.filter(x => x.account === acc && x.status === "done").sort((a, b) => b.startOn.localeCompare(a.startOn)).slice(0, 3);
    const st = sp ? planner.sprintStats(sp) : null;
    const due = planner.followUpsDue(acc);
    const d = sp ? sprintDay(sp, today()) : null;
    const row: any = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", borderTop: "1px solid #f0ece7", cursor: "pointer" };
    return (
      <div id="card-sprints" style={card}>
        {band(`Sales sprints · ${sprintW} weeks`, sp && d ? <span style={{ color: C.black }}>Day {d.day} of {d.total}</span> : null)}
        {sp && st ? (
          <div className="lh-prow" role="button" tabIndex={0} onClick={() => setOpenSprint({ id: sp.id })} style={{ ...body, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Sprint {sp.num}</span><span style={{ fontSize: 12, color: C.muted }}>{sprintRange(sp)}</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
              Focus {sp.focusCategory ? <CatChip k={sp.focusCategory} /> : "any category"} · {OUTREACH_TIERS.find(t => t.key === sp.focusTier)?.label}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><span>Pitches</span><span style={{ color: sp.pitchGoal != null && st.pitches >= sp.pitchGoal ? C.green : C.black }}>{st.pitches} / {sp.pitchGoal ?? "–"}</span></div>
            <Bar value={st.pitches} max={sp.pitchGoal ?? 0} done={sp.pitchGoal != null && st.pitches >= sp.pitchGoal} color={look.color} track={look.border} h={4} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><span>Follow-ups</span><span>{st.followUps} / {sp.followUpGoal ?? "–"}{due > 0 && <span style={{ color: C.amber }}> · {due} due</span>}</span></div>
          </div>
        ) : (
          <div style={{ ...body, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>No sprint running{due > 0 ? ` · ${due} follow-ups due` : ""}</span>
            <B v="sec" onClick={() => setOpenSprint({ acc })} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black }}>Start sprint</B>
          </div>
        )}
        {past.map(p => {
          const ps = planner.sprintStats(p);
          return (
            <div key={p.id} className="lh-prow" onClick={() => setOpenSprint({ id: p.id })} style={row}>
              <span style={{ fontSize: 13, minWidth: 0 }}>Sprint {p.num} <span style={{ color: C.muted }}>· {ps.pitches} pitches · {ps.followUps} follow-ups</span></span>
              <span style={{ ...microLabel, flexShrink: 0 }}>Done</span>
            </div>
          );
        })}
      </div>
    );
  })();
  const weekPitches = planner.pitchesInWeek([acc], monday);
  const pitchN = weekPitches.filter(p => p.kind === "pitch").length;
  const pitchCard = (
    <div style={card}>
      {band(`Pitch log · week ${isoWeek(monday)}`, <span style={{ color: C.black }}>{pitchN} {pitchN === 1 ? "pitch" : "pitches"} · {weekPitches.length - pitchN} follow-ups</span>)}
      <div style={body}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4 }}>
          {DAY_SHORT.map((dn, k) => {
            const n = weekPitches.filter(p => p.sentOn === addDays(monday, k)).length;
            return (
              <div key={dn} style={{ border: `1px solid ${k === ti ? C.black : C.rule}`, borderRadius: 2, padding: "5px 0", textAlign: "center" as const }}>
                <div style={{ ...microLabel, fontSize: 9 }}>{dn}</div>
                <div style={{ fontSize: 14, marginTop: 2, color: n ? C.black : C.light }}>{n}</div>
              </div>
            );
          })}
        </div>
        {weekPitches.slice(0, 6).map(p => (
          <div key={p.id} style={{ minHeight: 36, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, borderTop: "1px solid #f0ece7", marginTop: 6 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{planner.contactName(p.contactId)} <span style={{ color: C.muted }}>· {p.kind === "follow_up" ? "Follow-up" : "Pitch"}</span></span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{fmtD(p.sentOn).slice(0, 6)}</span>
              <XBtn label={`Delete ${p.kind === "follow_up" ? "follow-up" : "pitch"} to ${planner.contactName(p.contactId)}`} onClick={async () => {
                try {
                  const before = await planner.deletePitch(p);
                  showUndo(`${p.kind === "follow_up" ? "Follow-up" : "Pitch"} deleted`, () => planner.restorePitch(p, before));
                } catch { /* the save toast reports it */ }
              }} />
            </span>
          </div>
        ))}
        {weekPitches.length > 6 && <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>+{weekPitches.length - 6} more in Outreach</p>}
        {weekPitches.length === 0 && hint("Nothing logged this week. Log pitches in Outreach.")}
      </div>
    </div>
  );


  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Manager</h2>
        <GuideBtn on={guide.open} onClick={guide.toggle} />
      </div>
      <Subtitle acc={acc} text="Manager's workspace" />
      {guide.open && <GuideCard onClose={guide.close} steps={[
        "Tick Engaging every day you engage.",
        "Type Following, the pitches sent and the new leads anytime during the week, by Sunday at the latest.",
        "New emails count by themselves from Outreach. The goals (dotted) are set at the check-in.",
      ]} />}
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}><Toolbar monday={monday} setMonday={setMonday} isMobile={true} /></div>
      <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>{weekRange(monday)}{over ? " · closed" : ""}</p>

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {stage2 && (planner.stage2Error ? <p style={{ fontSize: 12, color: C.red, margin: "12px 0 0", lineHeight: 1.5 }}>{planner.stage2Error}</p> : sprintCard)}
          {goalsCard}
          {stage2 && !planner.stage2Error && pitchCard}
          {!stage2 && <div style={{ marginTop: 12, fontSize: 12, color: C.light, display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.lock} size={12} />Sprint · from Stage 2, on top</div>}
        </>
      )}

      {openSprint && (
        <SprintWindow key={openSprint.id || `new-${openSprint.acc}`} planner={planner} sprintId={openSprint.id} isMobile={isMobile} onClose={() => setOpenSprint(null)}
          draft={openSprint.acc ? { account: openSprint.acc, startOn: thisMonday(), endOn: addDays(thisMonday(), sprintW * 7 - 1), focusCategory: "", focusTier: "now", pitchGoal: null, followUpGoal: null, review: "" } : undefined} />
      )}
    </div>
  );
}
