// ─────────────────────────────────────────────────────────────
// PlannerOverview — Planner › Dashboard: the executive read of the
// week, for the account you're on. Read only; each number once.
//   This week   · ring "5 of 8", On track / Behind, best + weakest,
//                 the last 6 weeks
//   Stage       · "Stage 1 of 5", name, progress, what's next
//   Manager     · Following (+ followers), Engaging, New emails,
//                 Pitches (+ leads) — small rings
//   Sales sprint (from Stage 2) · Creator · Content flow
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, TYPE } from "./constants";
import {
  OWNER_LOOK, TONE, accLook, stageOf, stageNumOf, gateOf, isVisible, addDays, entryKey, monthName, isoWeek, weekRange,
  fmtInt, fmtPct2, monthGoalOf, thisMonday, todayIndex, MANAGER_GOAL, CREATOR_GOAL, managerOrder, creatorOrder, rowKind, snapKey, shortName,
} from "./planner";
import type { Account, Task } from "./planner";
import { monthStart, monthEnd, today } from "./formatters";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Subtitle, sprintDay } from "./PlannerWindows";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };

interface PlannerOverviewProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
}

// a small progress ring (green ✓ when reached)
const Ring = ({ ratio, done, size = 30, stroke = 4, label }: { ratio: number; done: boolean; size?: number; stroke?: number; label?: string }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, ratio));
  if (done && !label) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={C.green} />
      <path d={`M${size * 0.33} ${size * 0.52}l${size * 0.11} ${size * 0.11}l${size * 0.22} -${size * 0.24}`} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0ece7" strokeWidth={stroke} />
      {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={done ? C.green : C.amber} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      {label && <text x={size / 2} y={size / 2 + size * 0.09} textAnchor="middle" fontFamily="Playfair Display, serif" fontSize={size * 0.26} fill={C.black}>{label}</text>}
    </svg>
  );
};

export default function PlannerOverview({ planner, view, monday, setMonday, isMobile }: PlannerOverviewProps) {
  const { stages, tasks, items, loading, loadError } = planner;
  const acc     = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const forAcc  = (t: Task) => t.account === acc || t.account === "both";
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const aLook   = accLook(acc);
  const past    = monday < thisMonday();

  // ── goals of the week (Manager counted + Creator) ───────────
  const mGoals = visible.filter(t => MANAGER_GOAL(t) && forAcc(t)).sort((a, b) => managerOrder(a) - managerOrder(b));
  const mCounted = mGoals.filter(t => t.source !== "leads");
  const leadsT = mGoals.find(t => t.source === "leads");
  const cGoals = visible.filter(t => CREATOR_GOAL(t) && forAcc(t)).sort((a, b) => creatorOrder(a) - creatorOrder(b));
  const all = [...mCounted, ...cGoals];
  const ratioOf = (t: Task, w: string) => {
    const s = planner.stateOf(t, w);
    if (s.done) return 1;
    if (rowKind(t) === "days") return s.daysDone / 7;
    return s.target ? Math.min(1, (s.actual ?? 0) / s.target) : 0;
  };
  const reachedIn = (w: string) => all.filter(t => planner.stateOf(t, w).done).length;
  const reached = reachedIn(monday);
  const avg = all.length ? all.reduce((m, t) => m + ratioOf(t, monday), 0) / all.length : 0;
  const elapsed = past ? 1 : Math.max(1, todayIndex(monday) + 1) / 7;
  const status = reached === all.length && all.length ? { t: "All reached", c: C.green, bg: "#f0f5f0", b: "#b8d4b8" }
    : past ? { t: `${all.length - reached} missed`, c: TONE.miss, bg: "#f6e9e9", b: "#e8c9c9" }
    : avg >= elapsed - 0.1 ? { t: "On track", c: C.green, bg: "#f0f5f0", b: "#b8d4b8" }
    : { t: "Behind", c: "#a8804f", bg: "#fdf6ee", b: "#f0e2d0" };
  const best = all.find(t => planner.stateOf(t, monday).done);
  const weakest = [...all].filter(t => !planner.stateOf(t, monday).done && planner.stateOf(t, monday).target != null).sort((a, b) => ratioOf(a, monday) - ratioOf(b, monday))[0];
  const valText = (t: Task, w = monday) => { const s = planner.stateOf(t, w); return rowKind(t) === "days" ? `${s.daysDone} / 7` : `${s.actual ?? 0} / ${s.target ?? "–"}`; };
  const weeks = [-35, -28, -21, -14, -7, 0].map(o => addDays(monday, o));

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 4, marginTop: 12, overflow: "hidden" };
  const section = (color: string, title: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16, ...microLabel, color }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />{title}</div>
  );
  const tile = (key: string, accent: string, label: string, value: any, sub: any, ring?: { ratio: number; done: boolean }) => (
    <div key={key} style={{ background: C.white, border: `1px solid ${C.rule}`, borderRadius: 4, padding: "10px 10px 9px 13px", display: "flex", gap: 10, alignItems: "center", position: "relative", overflow: "hidden", minWidth: 0 }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      {ring && <Ring ratio={ring.ratio} done={ring.done} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...microLabel, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.15, marginTop: 2, whiteSpace: "nowrap" as const }}>{value}</div>
        {sub && <div style={{ fontSize: 11, marginTop: 2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
    </div>
  );
  const small = (t: string) => <small style={{ fontFamily: SANS, fontSize: 11, color: C.muted }}>{t}</small>;
  const goalSub = (t: Task) => {
    const s = planner.stateOf(t, monday);
    if (s.done) return <span style={{ color: C.green }}>Reached</span>;
    if (rowKind(t) === "days") return <span style={{ color: past ? TONE.miss : TONE.attn }}>{past ? "Not reached" : `${7 - s.daysDone} to go`}</span>;
    if (s.target == null) return <span style={{ color: C.light }}>No goal</span>;
    const left = Math.max(0, s.target - (s.actual ?? 0));
    return <span style={{ color: past ? TONE.miss : TONE.attn }}>{past ? `−${left}` : `${left} to go`}</span>;
  };

  // ── hero ────────────────────────────────────────────────────
  const hero = (
    <div style={{ ...card, boxShadow: "0 10px 26px rgba(26,26,26,0.07)", borderColor: "#ece7e1" }}>
      <div style={{ padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
        <Ring ratio={all.length ? reached / all.length : 0} done={reached === all.length && all.length > 0} size={76} stroke={7} label={`${reached}/${all.length}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={microLabel}>{past ? `Week ${isoWeek(monday)}` : "This week"}</span>
            <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "2px 8px", borderRadius: 10, background: status.bg, color: status.c, border: `1px solid ${status.b}` }}>{status.t}</span>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 19, marginTop: 4, lineHeight: 1.2 }}>{reached} of {all.length} goals reached</div>
          <div style={{ fontSize: 12, marginTop: 5, color: "#6b655e", lineHeight: 1.5, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
            {best && <span style={{ color: C.green }}>✓ {shortName(best)}</span>}
            {best && weakest && " · "}
            {weakest && <span style={{ color: past ? TONE.miss : TONE.attn }}>{shortName(weakest)} {valText(weakest)}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: "0 14px", height: 30 }} aria-label={`Goals reached, last 6 weeks: ${weeks.map(w => `${reachedIn(w)} of ${all.length}`).join(", ")}`}>
        {weeks.map((w, k) => {
          const r = reachedIn(w), cur = k === weeks.length - 1, full = all.length > 0 && r === all.length;
          return <div key={w} title={`W${isoWeek(w)}: ${r} of ${all.length}`} style={{ flex: 1, height: `${Math.max(8, all.length ? (r / all.length) * 100 : 0)}%`, background: cur ? C.black : full ? "#cfe2cf" : "#ece8e3", borderRadius: 2 }} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 14px 10px", fontSize: 9, letterSpacing: "0.06em", color: C.light }}>
        {weeks.map((w, k) => <span key={w} style={{ color: k === weeks.length - 1 ? C.black : C.light }}>W{isoWeek(w)}</span>)}
      </div>
    </div>
  );

  // ── stage ───────────────────────────────────────────────────
  const st = stageOf(stages, acc);
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    const next = stages.find(s => s.account === acc && s.num === st.num + 1);
    return (
      <div style={{ ...card, background: aLook.bg, borderColor: aLook.border, display: "flex", gap: 14, alignItems: "center", padding: "12px 14px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1, color: aLook.color }}>{st.num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...microLabel, color: aLook.color }}>Stage {st.num} of 5</div>
          <div style={{ fontSize: 15, marginTop: 2 }}>{st.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
            <div style={{ flex: 1, height: 4, background: aLook.border, borderRadius: 2 }}><div style={{ width: `${g.total ? Math.round((g.done / g.total) * 100) : 0}%`, height: 4, background: aLook.color, borderRadius: 2 }} /></div>
            <span style={{ fontSize: 12 }}>{g.done} / {g.total}</span>
          </div>
          {next && <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Next: {next.name}</div>}
        </div>
      </div>
    );
  })();

  // ── Manager tiles ───────────────────────────────────────────
  const mLook = OWNER_LOOK.manager;
  const sn = planner.snaps[snapKey(acc, monday)], prevSn = planner.snaps[snapKey(acc, addDays(monday, -7))];
  const fDiff = sn?.followers != null && prevSn?.followers != null ? sn.followers - prevSn.followers : null;
  const leadsN = leadsT ? planner.stateOf(leadsT, monday).actual ?? 0 : null;
  // while a sprint covers this week, Pitches reads from the sprint's day numbers
  const spNow = stageNumOf(stages, acc) >= 2 ? planner.activeSprint(acc) : undefined;
  const spCovers = !!spNow && spNow.startOn <= addDays(monday, 6) && spNow.endOn >= monday;
  const spWeekPitches = spNow ? Object.entries(spNow.days || {}).filter(([d]) => d >= monday && d <= addDays(monday, 6)).reduce((m, [, v]) => m + (Number(v?.p) || 0), 0) : 0;
  const spWeeks = spNow ? Math.max(1, Math.round((Math.round((Date.parse(spNow.endOn) - Date.parse(spNow.startOn)) / 864e5) + 1) / 7)) : 1;
  const spShare = spNow?.pitchGoal ? Math.ceil(spNow.pitchGoal / spWeeks) : null;
  const mTiles = mCounted.map(t => {
    const s0 = planner.stateOf(t, monday);
    const s = t.source === "pitches" && spCovers ? { ...s0, actual: spWeekPitches, target: spShare, done: spShare != null && spWeekPitches >= spShare } : s0;
    const days = rowKind(t) === "days";
    const value = days ? <>{s.daysDone} {small("/ 7 days")}</> : <>{fmtInt(s.actual ?? 0)} {small(`/ ${s.target != null ? fmtInt(s.target) : "–"}`)}</>;
    let sub: any = goalSub(t);
    if (t.source === "following" && sn?.followers != null) sub = <span style={{ color: C.muted }}>Followers {fmtInt(sn.followers)}{fDiff != null && <span style={{ color: fDiff >= 0 ? C.green : C.red }}> · {fDiff >= 0 ? "+" : "−"}{fmtInt(Math.abs(fDiff))}</span>}</span>;
    if (t.source === "pitches" && spCovers) sub = <span style={{ color: s.done ? C.green : TONE.attn }}>{s.done ? "Reached" : `${Math.max(0, (s.target ?? 0) - (s.actual ?? 0))} to go`} · sprint</span>;
    if (t.source === "pitches" && leadsN != null) sub = <>{sub}<span style={{ color: C.muted }}> · {leadsN} {leadsN === 1 ? "lead" : "leads"}</span></>;
    const ratio = t.source === "pitches" && spCovers ? (s.target ? Math.min(1, (s.actual ?? 0) / s.target) : 0) : ratioOf(t, monday);
    return tile(t.id, mLook.border, shortName(t), value, sub, { ratio, done: s.done });
  });

  // ── sales sprint (from Stage 2) ─────────────────────────────
  const stage2 = stageNumOf(stages, acc) >= 2;
  const sprintLine = stage2 && (() => {
    const sp = planner.activeSprint(acc);
    if (sp) {
      const s = planner.sprintStats(sp), d = sprintDay(sp, today());
      return (
        <div style={{ ...card, padding: "10px 12px", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", ...microLabel, color: mLook.color }}><span>Sales sprint {sp.num}</span><span style={{ color: C.black }}>Day {d.day} of {d.total}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>Pitches {s.pitches} / {sp.pitchGoal ?? "–"}</span><span>Follow-ups {s.followUps} / {sp.followUpGoal ?? "–"}</span></div>
          <div style={{ height: 3, background: mLook.border, marginTop: 6 }}><div style={{ height: 3, width: `${sp.pitchGoal ? Math.min(100, Math.round((s.pitches / sp.pitchGoal) * 100)) : 0}%`, background: mLook.color }} /></div>
        </div>
      );
    }
    const last = planner.sprints.filter(x => x.account === acc && x.status === "done").sort((a, b) => b.startOn.localeCompare(a.startOn))[0];
    if (!last) return null;
    const s = planner.sprintStats(last);
    return (
      <div style={{ ...card, padding: "10px 12px", marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", ...microLabel }}><span>Last sprint · {last.num}</span><span>{s.rate == null ? "" : `Reply rate ${fmtPct2(s.rate)}`}</span></div>
        <div style={{ fontSize: 13, marginTop: 6 }}>{s.pitches} pitched · {s.replied} replied · <span style={{ color: s.gifted ? C.green : C.black }}>{s.gifted} gifted</span> · <span style={{ color: s.deals ? C.green : C.black }}>{s.deals} {s.deals === 1 ? "deal" : "deals"}</span></div>
      </div>
    );
  })();

  // ── Creator tiles + content flow ────────────────────────────
  const cLook = OWNER_LOOK.creator;
  const cTiles = cGoals.map(t => {
    const s = planner.stateOf(t, monday);
    return tile(t.id, cLook.border, shortName(t), <>{s.actual ?? 0} {small(`/ ${s.target ?? "–"}`)}</>, goalSub(t));
  });
  const mine = items.filter(i => i.account === acc);
  const flow = [
    { l: "Ideas",    n: mine.filter(i => i.status === "idea" && !i.plannedOn).length },
    { l: "To shoot", n: mine.filter(i => i.status === "planned" || (i.status === "idea" && !!i.plannedOn)).length },
    { l: "Filmed",   n: mine.filter(i => i.status === "shot").length },
    { l: "Posted",   n: mine.filter(i => i.status === "posted" || i.status === "in_kit").length },
  ];
  const ms = monthStart(monday), me = monthEnd(monday);
  const fsT = tasks.find(t => t.source === "portfolio_total" && t.account === acc && t.active);
  const fs = fsT ? planner.stateOf(fsT, monday) : null;
  const mt = visible.find(t => t.rhythm === "monthly" && t.area === "portfolio" && t.account === acc) || visible.find(t => t.rhythm === "monthly" && t.area === "portfolio");
  const goal = mt ? (mt.account === "both" ? monthGoalOf(mt, planner.entries[entryKey(mt.id, ms)], acc) : planner.targetOf(mt.id, ms)) : null;
  const doneMonth = mine.filter(x => x.portfolio && (x.status === "posted" || x.status === "in_kit") && !!x.postedOn && x.postedOn >= ms && x.postedOn <= me).length;
  const flowCard = (
    <div style={{ ...card, padding: "12px 12px 10px", marginTop: 8 }}>
      <div style={microLabel}>Content flow</div>
      <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center" }}>
        {flow.map((f, k) => (
          <div key={f.l} style={{ display: "contents" }}>
            <div style={{ flex: 1, textAlign: "center" as const }}>
              <div style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.1, color: k === 3 && f.n ? C.green : C.black }}>{f.n}</div>
              <div style={microLabel}>{f.l}</div>
            </div>
            {k < flow.length - 1 && <span style={{ color: "#d6d1cb", fontSize: 14 }}>›</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b655e", marginTop: 10, paddingTop: 8, borderTop: "1px solid #f0ece7" }}>
        <span style={{ color: goal != null && doneMonth >= goal ? C.green : "#6b655e" }}>Portfolio · {monthName(monday).slice(0, 3)} {doneMonth} / {goal ?? "–"}</span>
        {fs && fsT && <span style={{ color: fs.done ? C.green : "#6b655e" }}>First set {fs.actual ?? 0} / {fsT.target ?? "–"}{fs.done ? " ✓" : ""}</span>}
      </div>
    </div>
  );

  const stage3 = stageNumOf(stages, acc) >= 3;
  const weekBtn = (label: string, d: number, ch: string) => (
    <button onClick={() => setMonday(addDays(monday, d))} aria-label={label}
      style={{ background: "none", border: "none", padding: "0 6px", cursor: "pointer", color: C.muted, fontFamily: SANS, fontSize: 14 }}>{ch}</button>
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Dashboard</h2>
        <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${C.rule}`, borderRadius: 14, background: C.white, height: 28, fontSize: 12 }}>
          {weekBtn("Previous week", -7, "‹")}<span style={{ minWidth: 58, textAlign: "center" as const }}>Week {isoWeek(monday)}</span>{weekBtn("Next week", 7, "›")}
        </span>
      </div>
      <Subtitle acc={acc} text={weekRange(monday)} />
      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {hero}
          {stageCard}
          {mTiles.length > 0 && <>{section(mLook.color, "Manager")}<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: 8 }}>{mTiles}</div></>}
          {sprintLine}
          {section(cLook.color, "Creator")}
          {cTiles.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: 8 }}>{cTiles}</div>}
          {flowCard}
          <div style={{ marginTop: 14, fontSize: 12, color: C.light, textAlign: "center" as const, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
            {!stage3 && <Ico d={IC.lock} size={12} />}
            {!stage2 ? "Sales sprint from Stage 2 · Money from Stage 3" : !stage3 ? "Money from Stage 3" : "Money from your invoices comes with the Stage 3 build"}
          </div>
        </>
      )}
    </div>
  );
}
