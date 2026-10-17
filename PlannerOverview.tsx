// ─────────────────────────────────────────────────────────────
// PlannerOverview — Planner › Dashboard: the overview of all tabs
// for the account you're on. Read only — nothing to tick or type.
//   Stage · Manager this week · Sales sprint · Creator ·
//   Following · Last 4 weeks · Money (from Stage 3)
// ─────────────────────────────────────────────────────────────

import { C, SERIF, TYPE } from "./constants";
import {
  OWNER_LOOK, TONE, accLook, stageOf, stageNumOf, gateOf, isVisible, addDays, entryKey, monthName, weekRange, isoWeek,
  fmtInt, fmtPct2, monthGoalOf, thisMonday, STAGE_SHORT, MANAGER_GOAL, CREATOR_GOAL, managerOrder, rowKind,
} from "./planner";
import type { Account, Task, Look } from "./planner";
import { monthStart, monthEnd, today, parseYMD } from "./formatters";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Bar, Toolbar, Subtitle, sprintDay, ResultMark } from "./PlannerWindows";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const NEUTRAL: Look = { label: "", color: C.muted, bg: C.white, border: C.rule };
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortDate = (d: string) => { const dt = parseYMD(d); return dt ? `${WD[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.` : ""; };
const NAME = (t: Task) => (t.area === "community" ? "Engaging" : t.source === "following" ? "Following" : t.source === "outreach" ? "New emails" : t.source === "pitches" ? "Pitches" : t.source === "leads" ? "Leads" : t.title);

interface PlannerOverviewProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
}

export default function PlannerOverview({ planner, view, monday, setMonday, isMobile }: PlannerOverviewProps) {
  const { stages, tasks, items, loading, loadError } = planner;
  const acc     = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const forAcc  = (t: Task) => t.account === acc || t.account === "both";
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const aLook   = accLook(acc);
  const over    = monday < thisMonday();

  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 10, overflow: "hidden" };
  const band = (l: Look, title: string, right?: any) => (
    <div style={{ minHeight: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: l.bg, color: l.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        {l !== NEUTRAL && <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.color, flexShrink: 0 }} />}{title}
      </span>
      {right}
    </div>
  );
  const line: any = { minHeight: 36, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: "1px solid #f0ece7", fontSize: 13 };
  const body: any = { padding: "10px 12px 12px" };

  // ── stage ───────────────────────────────────────────────────
  const st = stageOf(stages, acc);
  const mine = stages.filter(s => s.account === acc);
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    const next = mine.find(s => s.num === st.num + 1);
    return (
      <div style={card}>
        {band(aLook, `Stage ${st.num} · ${st.name}`, <span style={{ color: g.ready && g.total ? C.green : C.black, flexShrink: 0 }}>{g.done} of {g.total} done</span>)}
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
          {next && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Next: Stage {next.num} · {next.name}</p>}
        </div>
      </div>
    );
  })();

  // ── Manager this week ───────────────────────────────────────
  const mGoals = visible.filter(t => MANAGER_GOAL(t) && forAcc(t)).sort((a, b) => managerOrder(a) - managerOrder(b));
  const mCounted = mGoals.filter(t => t.source !== "leads");
  const leadsT = mGoals.find(t => t.source === "leads");
  const markOf = (t: Task, w: string) => {
    const s = planner.stateOf(t, w);
    const days = rowKind(t) === "days";
    const past = w < thisMonday();
    const left = s.target != null ? Math.max(0, s.target - (s.actual ?? 0)) : null;
    if (s.done) return <ResultMark state="reached" />;
    if (days) return <ResultMark state={past ? "missed" : "togo"} text={past ? `${s.daysDone} / 7` : `${7 - s.daysDone} to go`} />;
    if (s.target == null) return <ResultMark state="none" text="No goal" />;
    return <ResultMark state={past ? "missed" : "togo"} text={past ? `−${left}` : `${left} to go`} />;
  };
  const mReached = mCounted.filter(t => planner.stateOf(t, monday).done).length;
  const managerCard = mGoals.length > 0 && (
    <div style={card}>
      {band(OWNER_LOOK.manager, "Manager this week", <span style={{ color: mReached === mCounted.length ? C.green : C.black }}>{mReached} of {mCounted.length} reached</span>)}
      {mCounted.map(t => {
        const s = planner.stateOf(t, monday);
        return (
          <div key={t.id} style={line}>
            <span style={{ flex: 1 }}>{NAME(t)}</span>
            <span style={{ color: C.muted, fontSize: 12 }}>{rowKind(t) === "days" ? `${s.daysDone} / 7` : `${s.actual ?? 0} / ${s.target ?? "–"}`}</span>
            {markOf(t, monday)}
          </div>
        );
      })}
      {leadsT && <div style={line}><span style={{ flex: 1 }}>Leads</span><span style={{ fontSize: 13 }}>{planner.stateOf(leadsT, monday).actual ?? 0}</span><span style={{ minWidth: 70 }} /></div>}
    </div>
  );

  // ── sales sprint ────────────────────────────────────────────
  const stage2 = stageNumOf(stages, acc) >= 2;
  const sprintCard = stage2 && (() => {
    const sp = planner.activeSprint(acc);
    if (sp) {
      const s = planner.sprintStats(sp);
      const d = sprintDay(sp, today());
      return (
        <div style={card}>
          {band(OWNER_LOOK.manager, `Sales sprint ${sp.num}`, <span style={{ color: C.black }}>Day {d.day} of {d.total}</span>)}
          <div style={body}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Pitches</span><span>{s.pitches} / {sp.pitchGoal ?? "–"}</span></div>
            <Bar value={s.pitches} max={sp.pitchGoal ?? 0} done={sp.pitchGoal != null && s.pitches >= sp.pitchGoal} h={3} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8 }}><span>Follow-ups</span><span>{s.followUps} / {sp.followUpGoal ?? "–"}</span></div>
            <Bar value={s.followUps} max={sp.followUpGoal ?? 0} done={sp.followUpGoal != null && s.followUps >= sp.followUpGoal} h={3} />
          </div>
        </div>
      );
    }
    const last = planner.sprints.filter(x => x.account === acc && x.status === "done").sort((a, b) => b.startOn.localeCompare(a.startOn))[0];
    if (!last) return null;
    const s = planner.sprintStats(last);
    const cell = (lab: string, v: any, color: string = C.black) => <div style={{ textAlign: "center" as const }}><div style={microLabel}>{lab}</div><div style={{ fontSize: 15, marginTop: 2, color }}>{v}</div></div>;
    return (
      <div style={card}>
        {band(NEUTRAL, `Last sprint · Sprint ${last.num}`, <span>{s.rate == null ? "" : `Reply rate ${fmtPct2(s.rate)}`}</span>)}
        <div style={{ ...body, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 4 }}>
          {cell("Pitched", `${s.pitches}`)}{cell("Replied", s.replied)}{cell("Gifted", s.gifted, s.gifted ? C.green : C.black)}{cell("Deals", s.deals, s.deals ? C.green : C.black)}
        </div>
      </div>
    );
  })();

  // ── Creator ─────────────────────────────────────────────────
  const cGoals = visible.filter(t => CREATOR_GOAL(t) && forAcc(t));
  const cell = (label: string, t?: Task) => {
    if (!t) return null;
    const s = planner.stateOf(t, monday);
    const color = s.done ? C.green : s.target == null ? C.black : over ? TONE.miss : TONE.attn;
    return <div key={label} style={{ textAlign: "center" as const, padding: "8px 0" }}><div style={microLabel}>{label}</div><div style={{ fontSize: 14, marginTop: 3, color }}>{s.actual ?? 0} / {s.target ?? "–"}{s.done ? " ✓" : ""}</div></div>;
  };
  const toShoot = items.filter(i => i.account === acc && (i.status === "planned" || (i.status === "idea" && !!i.plannedOn)))
    .sort((a, b) => (a.plannedOn || "9999").localeCompare(b.plannedOn || "9999")).slice(0, 2);
  const ms = monthStart(monday), me = monthEnd(monday);
  const fsT = tasks.find(t => t.source === "portfolio_total" && t.account === acc && t.active);
  const fs = fsT ? planner.stateOf(fsT, monday) : null;
  const mt = visible.find(t => t.rhythm === "monthly" && t.area === "portfolio" && t.account === acc) || visible.find(t => t.rhythm === "monthly" && t.area === "portfolio");
  const goal = mt ? (mt.account === "both" ? monthGoalOf(mt, planner.entries[entryKey(mt.id, ms)], acc) : planner.targetOf(mt.id, ms)) : null;
  const doneMonth = items.filter(x => x.account === acc && x.portfolio && (x.status === "posted" || x.status === "in_kit") && !!x.postedOn && x.postedOn >= ms && x.postedOn <= me).length;
  const creatorCard = (
    <div style={card}>
      {band(OWNER_LOOK.creator, "Creator", null)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        {cell("Ideas", cGoals.find(t => t.source === "ideas"))}{cell("Posts", cGoals.find(t => t.source === "posts"))}{cell("Pieces", cGoals.find(t => t.source === "pieces"))}
      </div>
      <div style={{ ...line, ...microLabel, minHeight: 30 }}>Next to shoot</div>
      {toShoot.length === 0 && <div style={{ ...line, color: C.muted }}>Nothing planned</div>}
      {toShoot.map(i => (
        <div key={i.id} style={line}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{i.title}</span>
          <span style={{ fontSize: 12, color: i.plannedOn && i.plannedOn <= today() ? TONE.attn : C.muted, whiteSpace: "nowrap" as const }}>{i.plannedOn ? (i.plannedOn === today() ? "Today" : shortDate(i.plannedOn)) : "No date"}</span>
        </div>
      ))}
      <div style={{ ...line, justifyContent: "space-between" }}>
        <span style={microLabel}>Portfolio</span>
        <span style={{ fontSize: 13 }}>
          <span style={{ color: goal != null && doneMonth >= goal ? C.green : C.black }}>{monthName(monday).slice(0, 3)} {doneMonth} / {goal ?? "–"}</span>
          {fs && !fs.done && <span style={{ color: C.muted }}> · first set {fs.actual ?? 0} / {fs.target ?? "–"}</span>}
        </span>
      </div>
    </div>
  );

  // ── Following (6 weeks) ─────────────────────────────────────
  const following = (() => {
    const ft = visible.find(t => t.source === "following" && forAcc(t));
    if (!ft) return null;
    const val = (w: string) => planner.stateOf(ft, w).actual;
    const ws = [-35, -28, -21, -14, -7, 0].map(o => addDays(monday, o));
    const vals = ws.map(val);
    const cur = val(monday), prev = val(addDays(monday, -7));
    const s0 = planner.stateOf(ft, monday);
    const max = Math.max(1, ...vals.map(v => Math.max(0, v ?? 0)), s0.target ?? 0);
    const d = cur != null && prev != null ? cur - prev : null;
    return (
      <div style={card}>
        {band(NEUTRAL, "Following", <span>{s0.target != null ? `Goal ${fmtInt(s0.target)}` : "No goal"}</span>)}
        <div style={{ ...body, paddingTop: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" as const }}>
            <span style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1, color: s0.done ? C.green : C.black }}>{cur == null ? "–" : fmtInt(cur)}{s0.done ? " ✓" : ""}</span>
            <span style={{ fontSize: 12, color: d == null ? C.muted : d > 0 ? C.green : d < 0 ? C.red : C.muted }}>{d == null ? (cur == null ? "Not entered yet" : "") : `${d >= 0 ? "+" : "−"}${fmtInt(Math.abs(d))} vs last week`}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28, marginTop: 10 }} aria-label={`Following, last 6 weeks: ${vals.map(v => (v == null ? "–" : fmtInt(v))).join(", ")}`}>
            {vals.map((v, k) => <i key={k} title={`W${isoWeek(ws[k])}: ${v == null ? "–" : fmtInt(v)}`} style={{ flex: 1, height: v == null || v <= 0 ? 2 : `${Math.max(8, Math.round((v / max) * 100))}%`, background: k === 5 ? C.black : "#d6d1cb" }} />)}
          </div>
        </div>
      </div>
    );
  })();

  // ── last 4 weeks (manager goals + creator goals) ────────────
  const all = [...mCounted, ...cGoals];
  const weeks = [-21, -14, -7, 0].map(o => addDays(monday, o));
  const lastWeeks = all.length > 0 && (
    <div style={card}>
      {band(NEUTRAL, "Last 4 weeks · goals reached", null)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6, padding: "8px 12px 12px", textAlign: "center" as const }}>
        {weeks.map((w, k) => {
          const r = all.filter(t => planner.stateOf(t, w).done).length, full = r === all.length, cur = k === 3;
          return (
            <div key={w} style={{ border: `1px solid ${cur ? C.black : full ? "#b8d4b8" : C.rule}`, background: full ? "#f0f5f0" : C.white, borderRadius: 2, padding: "5px 0" }}>
              <div style={{ ...microLabel, color: cur ? C.black : full ? C.green : C.muted }}>W{isoWeek(w)}</div>
              <div style={{ fontSize: 12, marginTop: 2, color: full ? C.green : !cur && w < thisMonday() ? TONE.miss : C.black }}>{r}/{all.length}{full ? " ✓" : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const stage3 = stageNumOf(stages, acc) >= 3;
  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Dashboard</h2>
      <Subtitle acc={acc} text={weekRange(monday)} />
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}><Toolbar monday={monday} setMonday={setMonday} isMobile={true} /></div>
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {stageCard}
          {managerCard}
          {sprintCard}
          {creatorCard}
          {following}
          {lastWeeks}
          {stage3
            ? <p style={{ fontSize: 13, color: C.muted, margin: "12px 0 0" }}>Money from your invoices comes with the Stage 3 build.</p>
            : <div style={{ marginTop: 12, fontSize: 12, color: C.light, display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.lock} size={12} />Money · from Stage 3</div>}
        </>
      )}
    </div>
  );
}
