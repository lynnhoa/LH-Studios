// ─────────────────────────────────────────────────────────────
// PlannerOverview — Planner › Dashboard: the scoreboard for the
// account you're on. Read only; the work happens in the other tabs.
//   Stage · This week (who reached what, what isn't reached yet,
//   the last 4 weeks) · Audience (6-week trend) · Portfolio ·
//   Pipeline (from Stage 2) · Money (from Stage 3)
// ─────────────────────────────────────────────────────────────

import { C, SERIF, TYPE } from "./constants";
import {
  OWNER_LOOK, TONE, accLook, rowKind, stageOf, stageNumOf, gateOf, isVisible, addDays, snapKey, entryKey, monthName,
  weekRange, isoWeek, fmtInt, fmtPct2, monthGoalOf, goalStatus, shortName, thisMonday, STAGE_SHORT,
} from "./planner";
import type { Account, Owner, Task, Look } from "./planner";
import { monthStart, monthEnd, today } from "./formatters";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Bar, Toolbar, Subtitle, sprintDay } from "./PlannerWindows";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const NEUTRAL: Look = { label: "", color: C.muted, bg: C.white, border: C.rule };

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
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const aLook   = accLook(acc);

  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const band = (l: Look, title: string, right?: any) => (
    <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: l.bg, color: l.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        {l !== NEUTRAL && <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.color, flexShrink: 0 }} />}{title}
      </span>
      {right}
    </div>
  );
  const body: any = { padding: "10px 12px 12px" };
  const sub: any = { fontSize: 12, color: C.muted, marginTop: 4 };

  // ── stage ───────────────────────────────────────────────────
  const st = stageOf(stages, acc);
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    const list = stages.filter(s => s.account === acc);
    return (
      <div style={card}>
        {band(aLook, `Stage ${st.num} · ${st.name}`, <span style={{ color: g.ready && g.total ? C.green : C.black, flexShrink: 0 }}>{g.total ? `${g.done} / ${g.total}${g.ready ? " ✓" : ""}` : "–"}</span>)}
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
        </div>
      </div>
    );
  })();

  // ── this week: who reached what ─────────────────────────────
  const weekly = visible.filter(t => t.phase === "maintain" && (t.rhythm === "weekly" || t.rhythm === "daily"));
  const reachedIn = (w: string) => weekly.filter(t => planner.stateOf(t, w).done).length;
  const met = reachedIn(monday);
  const owners = (["manager", "creator", "both"] as Owner[]).map(o => {
    const list = weekly.filter(t => t.owner === o);
    const open = list.filter(t => !planner.stateOf(t, monday).done);
    return { o, list, open };
  }).filter(x => x.list.length > 0);
  const label = (t: Task) => {
    const s = planner.stateOf(t, monday);
    const g = goalStatus(t, s, monday);
    const k = rowKind(t);
    const n = k === "number" ? (s.target != null ? ` ${s.actual ?? 0}/${s.target}` : ` ${s.actual ?? 0}`) : k === "days" ? ` ${s.daysDone}/7` : "";
    return `${shortName(t)}${n}${g?.tone === "none" ? " · no number" : ""}`;
  };
  const weeks = [-21, -14, -7, 0].map(o => addDays(monday, o));
  const isPast = (w: string) => w < thisMonday();
  const weekCard = (
    <div style={card}>
      {band(NEUTRAL, "This week", <span style={{ color: met === weekly.length && weekly.length ? C.green : C.black }}>{met} of {weekly.length} reached</span>)}
      {owners.map(x => {
        const l = OWNER_LOOK[x.o];
        const done = x.list.length - x.open.length;
        const over = isPast(monday);
        return (
          <div key={x.o} style={{ padding: "10px 12px", borderTop: "1px solid #f0ece7", display: "flex", gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.color, marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{l.label}</span><span style={{ fontSize: 13, color: done === x.list.length ? C.green : C.black }}>{done} of {x.list.length}{done === x.list.length ? " ✓" : ""}</span></div>
              {x.open.length > 0 && <div style={{ fontSize: 12, marginTop: 3, color: over ? TONE.miss : TONE.attn, lineHeight: 1.4 }}>{over ? "Not reached: " : ""}{x.open.map(label).join(" · ")}</div>}
            </div>
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6, padding: "10px 12px 12px", borderTop: "1px solid #f0ece7", textAlign: "center" as const }}>
        {weeks.map((w, k) => {
          const r = reachedIn(w), all = weekly.length > 0 && r === weekly.length, cur = k === 3;
          return (
            <div key={w} style={{ border: `1px solid ${cur ? C.black : all ? "#b8d4b8" : C.rule}`, background: all ? "#f0f5f0" : C.white, borderRadius: 2, padding: "5px 0" }}>
              <div style={{ ...microLabel, color: cur ? C.black : all ? C.green : C.muted }}>W{isoWeek(w)}</div>
              <div style={{ fontSize: 12, marginTop: 2, color: all ? C.green : !cur && isPast(w) ? TONE.miss : C.black }}>{r}/{weekly.length}{all ? " ✓" : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── audience (6-week trend from the snapshots) ──────────────
  const audience = (() => {
    const snap = (w: string) => planner.snaps[snapKey(acc, w)];
    const newF = (w: string): number | null => { const a = snap(w)?.followers, b = snap(addDays(w, -7))?.followers; return a != null && b != null ? a - b : null; };
    const value = (w: string): number | null => (acc === "lynnhoa" ? snap(w)?.views ?? null : newF(w));
    const ws = [-35, -28, -21, -14, -7, 0].map(o => addDays(monday, o));
    const cur = value(monday), prev = value(addDays(monday, -7));
    let delta: { text: string; color: string } | null = null;
    if (cur != null && prev != null) {
      if (acc === "lynnhoa") { if (prev > 0) { const pct = ((cur - prev) / prev) * 100; delta = { text: `${pct >= 0 ? "+" : "−"}${fmtPct2(Math.abs(pct))} vs last week`, color: pct > 0 ? C.green : pct < 0 ? C.red : C.muted }; } }
      else { const d = cur - prev; delta = { text: `${d >= 0 ? "+" : "−"}${fmtInt(Math.abs(d))} vs last week`, color: d > 0 ? C.green : d < 0 ? C.red : C.muted }; }
    }
    const vals = ws.map(value);
    const max = Math.max(1, ...vals.map(v => Math.max(0, v ?? 0)));
    const now = snap(monday);
    const big = cur == null ? "–" : acc === "lynnhoa" ? fmtInt(cur) : `${cur >= 0 ? "+" : "−"}${fmtInt(Math.abs(cur))}`;
    return (
      <div style={card}>
        {band(NEUTRAL, acc === "lynnhoa" ? "Audience · revival" : "Audience · growth", <span>{acc === "lynnhoa" ? "Views this week" : "New followers"}</span>)}
        <div style={{ ...body, paddingTop: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" as const }}>
            <span style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1 }}>{big}</span>
            <span style={{ fontSize: 12, color: delta?.color || C.muted }}>{delta?.text || (cur == null ? "Not entered yet" : "No week before to compare")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28, marginTop: 10 }} aria-label={`Last 6 weeks: ${vals.map(v => (v == null ? "–" : fmtInt(v))).join(", ")}`}>
            {vals.map((v, k) => <i key={k} title={`W${isoWeek(ws[k])}: ${v == null ? "–" : fmtInt(v)}`} style={{ flex: 1, height: v == null || v <= 0 ? 2 : `${Math.max(8, Math.round((v / max) * 100))}%`, background: k === 5 ? C.black : "#d6d1cb" }} />)}
          </div>
          <div style={{ ...sub, marginTop: 6 }}>{now?.followers != null || now?.engagement != null ? `${fmtInt(now?.followers)} followers · ${fmtPct2(now?.engagement)}` : "No snapshot this week"}</div>
        </div>
      </div>
    );
  })();

  // ── portfolio ───────────────────────────────────────────────
  const ms = monthStart(monday), me = monthEnd(monday);
  const fsT = tasks.find(t => t.source === "portfolio_total" && t.account === acc && t.active);
  const fs = fsT ? planner.stateOf(fsT, monday) : null;
  const mt = visible.find(t => t.rhythm === "monthly" && t.area === "portfolio" && t.account === acc) || visible.find(t => t.rhythm === "monthly" && t.area === "portfolio");
  const goal = mt ? (mt.account === "both" ? monthGoalOf(mt, planner.entries[entryKey(mt.id, ms)], acc) : planner.targetOf(mt.id, ms)) : null;
  const doneMonth = items.filter(x => x.account === acc && x.portfolio && (x.status === "posted" || x.status === "in_kit") && !!x.postedOn && x.postedOn >= ms && x.postedOn <= me).length;
  const portfolio = (
    <div style={card}>
      {band(NEUTRAL, "Portfolio", <span>{fs && !fs.done ? "Build phase" : "Month goal"}</span>)}
      <div style={{ ...body, paddingTop: 2 }}>
        {fs && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>First set</span><span style={{ color: fs.done ? C.green : C.black }}>{fs.actual ?? 0} / {fs.target ?? "–"}{fs.done ? " ✓" : ""}</span></div>
            <Bar value={fs.actual ?? 0} max={fs.target ?? 0} done={fs.done} h={4} />
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: fs ? 10 : 0 }}><span>{monthName(monday)} goal</span><span style={{ color: goal != null && doneMonth >= goal ? C.green : C.black }}>{doneMonth} / {goal ?? "–"}</span></div>
        <Bar value={doneMonth} max={goal ?? 0} done={goal != null && doneMonth >= goal} h={4} />
      </div>
    </div>
  );

  // ── pipeline (Stage 2) ──────────────────────────────────────
  const stage2 = stageNumOf(stages, acc) >= 2;
  const stage3 = stageNumOf(stages, acc) >= 3;
  const pipeline = stage2 && !planner.stage2Error && (() => {
    const sp = planner.activeSprint(acc);
    const weekN = planner.pitchesInWeek([acc], monday).filter(p => p.kind === "pitch").length;
    if (!sp) return <div style={card}>{band(NEUTRAL, "Pipeline")}<div style={body}><span style={{ fontSize: 13, color: C.muted }}>No sprint running · {weekN} {weekN === 1 ? "pitch" : "pitches"} this week</span></div></div>;
    const s = planner.sprintStats(sp);
    const d = sprintDay(sp, today());
    const cell = (lab: string, value: any, color: string = C.black) => (
      <div style={{ minWidth: 0 }}><div style={{ ...microLabel, fontSize: 9 }}>{lab}</div><div style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.2, marginTop: 2, color }}>{value}</div></div>
    );
    return (
      <div style={card}>
        {band(NEUTRAL, `Pipeline · Sprint ${sp.num}`, <span>Day {d.day} of {d.total}</span>)}
        <div style={body}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
            {cell("Pitched", `${s.pitches}${sp.pitchGoal != null ? ` / ${sp.pitchGoal}` : ""}`)}
            {cell("Replied", s.replied)}
            {cell("Gifted", s.gifted, s.gifted ? C.green : C.black)}
            {cell("Deals", s.deals, s.deals ? C.green : C.black)}
          </div>
          <Bar value={s.pitches} max={sp.pitchGoal ?? 0} done={sp.pitchGoal != null && s.pitches >= sp.pitchGoal} h={4} s={{ marginTop: 8 }} />
          <div style={{ ...sub, marginTop: 6 }}>{s.rate != null ? `Reply rate ${fmtPct2(s.rate)} · ` : ""}{weekN} {weekN === 1 ? "pitch" : "pitches"} this week</div>
        </div>
      </div>
    );
  })();
  const locked = (t: string) => <div style={{ marginTop: 12, fontSize: 13, color: C.light, display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.lock} size={13} />{t}</div>;

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
          {weekCard}
          {audience}
          {portfolio}
          {stage2 ? (planner.stage2Error ? <p style={{ fontSize: 12, color: C.red, margin: "12px 0 0" }}>{planner.stage2Error}</p> : pipeline) : locked("Pipeline · pitched, replied, gifted, deals · from Stage 2")}
          {stage3 ? <p style={{ fontSize: 13, color: C.muted, margin: "12px 0 0" }}>Money from your invoices comes with the Stage 3 build.</p> : locked("Money · revenue from your invoices · from Stage 3")}
        </>
      )}
    </div>
  );
}
