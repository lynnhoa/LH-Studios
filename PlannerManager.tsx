// ─────────────────────────────────────────────────────────────
// PlannerManager — Planner › Manager (the manager's workspace).
// One card, this week's goals, on ONE number grid (11.11.2026), shared with the Sales card: name ·
// status … count (right-aligned, 72 px; a typed field is the same width with its digits on the same
// edge) · "/ goal" (right-aligned, 72 px, flush with the card's edge; "–" = no goal). Every count and
// goal 15 px. Goals are yours — locked; "Edit goals" turns them into fields in the same spot.
// Engaging and New girls: name, count and goal on the grid, their 7 day boxes in a row under it.
// Every line belongs to the account picked with the switch next to the
// title — goals are set per account.
//   Engaging · a box per day (goal: 7 days)
//   New girls · a number per day (how many new girls you found), the week adds up (goal: 35)
//   Following · Followers (typed totals) · New emails (counted from the
//   email list)
// SALES · THIS WEEK (11.11.2026), under the goals, the same on both account pages:
//   Collabs (pink, @lynnhoa pipeline) and UGC (blue, @createbylynn), each Pitches (own goal) and
//   Leads (no goal) — counted from Outreach, never typed. Then the Check-in note for the week.
//   (Before LH-Studio-manager-sales.sql the old typed Pitches / Leads lines stay in the goals.)
// From Stage 2: the sales sprint on top while it runs — pitches and
// follow-ups typed per day, a 14-day strip, End & review. Between
// sprints a thin Start row (✕ hides it).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, cloneElement } from "react";
import { C, SANS, TYPE, SPACING, RADIUS, PAL } from "./constants";
import { B, BAR_BTN, ValuePill, WeekPill, SectionHead, SummaryLine, Cols } from "./atoms";
import {
  DAY_SHORT, OWNER_LOOK, isoWeek as isoWeekOf, isVisible, periodOf, stageNumOf, todayIndex, weekRange, fmtPct2, addDays, thisMonday, mondayOf,
  MANAGER_GOAL, managerOrder, rowKind, parseIntDe, daysBetween, snapKey, fmtInt, isTotal, entryKey, NEW_GIRLS, SALES_CATS,
} from "./planner";
import type { Task, Account, Sprint, SalesCatDef } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { OUTREACH_TIERS, OUTREACH_CATEGORIES } from "./outreach";
import { today } from "./formatters";
import { Ico, IC, Bar, Toolbar, Subtitle, TabTitle, SprintWindow, sprintRange, sprintDay, ResultMark, useGuide, GuideBtn, GuideCard, InlineText } from "./PlannerWindows";
import { XBtn } from "./undo";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.manager;
const NAME = (t: Task) => (t.source === NEW_GIRLS ? "New girls" : t.area === "community" ? "Engaging" : t.source === "following" ? "Following" : t.source === "followers" ? "Followers" : t.source === "outreach" ? "New emails" : t.source === "pitches" ? "Pitches" : t.source === "leads" ? "Leads" : t.title);
const ICON = (t: Task) => (t.source === NEW_GIRLS ? IC.userPlus : t.area === "community" ? IC.heart : t.source === "following" || t.source === "followers" ? IC.userPlus : t.source === "outreach" ? IC.mail : t.source === "leads" ? IC.spark : IC.send);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLabel = (d: string) => { const [y, m, dd] = d.split("-").map(Number); const dt = new Date(y, m - 1, dd); return `${WD[dt.getDay()]} ${String(dd).padStart(2, "0")}.${String(m).padStart(2, "0")}.`; };
// name · Done · Goal · status. Number fields type at 16 px (iPhone rule in
// index.html), so Done and Goal take 64–72 px: 100.000 fits on a 375-px
// phone too; the status keeps at least 80 px ("Not entered").
const GRID = "88px minmax(64px,72px) minmax(64px,72px) minmax(80px,1fr)";
const GAP  = 5;
const PAD  = 4;   // inner padding of a number field; labels and plain numbers line up with it (+ 1 px border)

// one day of New girls: the number typed for that day (empty = its day letter), today outlined like
// Engaging's boxes — a cell of the 7-day row under the name, typed at 16 px and drawn smaller (no
// iPhone zoom), saved when you leave the box
const DK = 13 / 16;
const DAY_H = 32;   // the day boxes of Engaging and New girls
function DayNum({ value, today, label, letter, onSave }: { value: number | null; today: boolean; label: string; letter: string; onSave: (v: number | null) => void }) {
  const [t, setT] = useState(value == null ? "" : String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(value == null ? "" : String(value)); }, [value, focus]);
  const on = value != null && value > 0;
  return (
    <span style={{ position: "relative" as const, display: "block", height: DAY_H, minWidth: 0, borderRadius: 8, boxSizing: "border-box" as const, overflow: "hidden",
      border: today ? `2px solid ${C.black}` : `1.5px solid ${on ? PAL.done.mid : C.edge}`, background: on && !focus ? PAL.done.wash : C.white }}>
      <input value={t} inputMode="numeric" aria-label={label} placeholder={letter} onFocus={() => setFocus(true)}
        onChange={e => setT(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        onBlur={() => { setFocus(false); const v = t === "" ? null : Number(t); if (v !== value) onSave(v); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={{ position: "absolute" as const, left: 0, top: 0, width: `${100 / DK}%`, height: `${100 / DK}%`, transform: `scale(${DK})`, transformOrigin: "left top",
          border: "none", outline: "none", background: "transparent", padding: 0, margin: 0, textAlign: "center" as const,
          fontFamily: SANS, fontSize: 16, fontWeight: 600, color: PAL.done.ink, WebkitAppearance: "none" as const }} />
    </span>
  );
}

interface PlannerManagerProps {
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

export default function PlannerManager({ planner, view, monday, setMonday, isMobile, onAccount }: PlannerManagerProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [sprintWin, setSprintWin] = useState<{ id?: string; acc?: Account; review?: boolean } | null>(null);
  const [editGoals, setEditGoals] = useState(false);
  const [pastOpen, setPastOpen]   = useState(false);
  const [pick, setPick]           = useState<string | null>(null);   // a sprint day picked in the strip (default today)
  const guide = useGuide("manager");
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc    = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  // another account picked: goals lock again (no editing the other account's goals by accident)
  const [shownAcc, setShownAcc] = useState<Account>(acc);
  if (shownAcc !== acc) { setShownAcc(acc); setEditGoals(false); setPastOpen(false); setPick(null); }
  const forAcc = (t: Task) => t.account === acc || t.account === "both";
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  // Sales lines (Collabs / UGC): once the SQL made them, the old Pitches / Leads lines leave the goals
  const salesT = (src: string) => tasks.find(t => t.active && t.source === src);
  const salesReady = SALES_CATS.every(c => !!salesT(c.pitches));
  const goals  = visible.filter(t => MANAGER_GOAL(t) && forAcc(t) && !(salesReady && (t.source === "pitches" || t.source === "leads")))
    .sort((a, b) => managerOrder(a) - managerOrder(b));
  const counted = goals.filter(t => t.source !== "leads");                    // leads has no goal
  const checkT = visible.find(t => t.area === "checkin" && forAcc(t));
  // before the SQL: the old typed Pitches line, which a running sprint fills (number + goal). The Sales
  // Pitches lines need no syncing: their goal during a sprint is the sprint's share, worked out live.
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
    // only once this week and the goal history are loaded (an empty screen must not decide what's saved)
    if (!planner.weekReady || !planner.targetsReady) return;
    // after the sprint, your own weekly pitch goal comes back (the sprint's share doesn't carry over) —
    // unless the week after the sprint already has a goal of its own
    if (syncWeek.target != null) {
      const after = mondayOf(addDays(sp.endOn, 1));
      const own = planner.targetOf(pitchT.id, mondayOf(sp.startOn));        // read before the sprint week is overwritten
      if (!planner.hasTarget(pitchT.id, after) && own != null && own !== syncWeek.target) quiet(planner.saveEntry(pitchT.id, after, { target: own }));
    }
    const e = planner.entries[`${pitchT.id}|${monday}`];
    if ((e?.actual ?? null) !== syncWeek.actual || (syncWeek.target != null && (e?.target ?? null) !== syncWeek.target))
      quiet(planner.saveEntry(pitchT.id, monday, { actual: syncWeek.actual, ...(syncWeek.target != null ? { target: syncWeek.target } : {}) }));
  }, [syncWeek?.actual, syncWeek?.target, pitchT?.id, monday, planner.weekReady, planner.targetsReady]);

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
  const card: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, marginTop: 10, overflow: "hidden" };
  const band = (title: string, right?: any) => (
    <div style={{ minHeight: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: C.white, color: PAL.neutral.ink, ...microLabel }}>
      <span>{title}</span>{right}
    </div>
  );
  // id = the line it belongs to, so a field never carries a value over to another account or line
  const numField = (id: string, value: number | null, label: string, onSave: (v: number | null) => void, _goal = false) => (
    <ValuePill key={`${id}|${value}`} text={value == null ? "" : fmtInt(value)} label={label}
      onCommit={(t) => { const v = t.trim() === "" ? null : parseIntDe(t); if (v !== value) onSave(v); }} />
  );
  // ── one number grid for every line (goals and Sales): name · status … count · / goal ──
  // count: right-aligned in one column (typed fields the same width, their digits on the same edge);
  // goal: "/ 350" (or "–"), right-aligned, flush with the card's right edge; both one size
  const NUM = 15, COUNT_W = 72, GOAL_W = 72, ROW_X = 14, ROW_H = 48;   // "84.827" and "/ 85.000" both fit
  const rowLine = (top = true): any => ({ display: "flex", alignItems: "center", minHeight: ROW_H, padding: `0 ${ROW_X}px`, borderTop: top ? `1px solid ${C.hair}` : "none" });
  const nameCell = (name: string, status: any, faded = false, lead: any = null) => (
    <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, paddingRight: 8, whiteSpace: "nowrap" as const, overflow: "hidden" }}>
      {lead}
      <span style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" }}>
        <span style={{ fontSize: SPACING.plannerText, color: faded ? C.muted : C.black }}>{name}</span>
        {status}
      </span>
    </span>
  );
  const statusText = (text: string, color: string) => <span style={{ fontSize: SPACING.listMeta, color, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>;
  const numCss: any = { flexShrink: 0, boxSizing: "border-box" as const, textAlign: "right" as const, fontSize: NUM, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const };
  const countCell = (v: number | string | null, label?: string) =>
    <span aria-label={label} style={{ ...numCss, width: COUNT_W, paddingRight: 10, color: v == null ? C.light : C.black }}>{v == null ? "–" : typeof v === "number" ? fmtInt(v) : v}</span>;
  const countField = (id: string, value: number | null, label: string, onSave: (v: number | null) => void) => (
    <ValuePill key={`${id}|${value}`} width={COUNT_W} height={32} size={NUM} padR={10} text={value == null ? "" : fmtInt(value)} label={label}
      onCommit={(t) => { const v = t.trim() === "" ? null : parseIntDe(t); if (v !== value) onSave(v); }} />
  );
  const goalCell = (target: number | null | undefined, none = false) =>
    <span style={{ ...numCss, width: GOAL_W, paddingRight: 8, color: C.muted }}>{none || target == null ? "–" : `/ ${fmtInt(target)}`}</span>;
  const goalField = (id: string, value: number | null, label: string, onSave: (v: number | null) => void) => (
    <ValuePill key={`${id}|${value}`} width={GOAL_W} height={32} size={NUM} padR={8} tint={PAL.progress.wash} text={value == null ? "" : fmtInt(value)} label={label}
      onCommit={(t) => { const v = t.trim() === "" ? null : parseIntDe(t); if (v !== value) onSave(v); }} />
  );
  const plain = (v: any, muted = false) => <span style={{ textAlign: "right" as const, minWidth: 64, paddingRight: 11, boxSizing: "border-box" as const, fontSize: TYPE.body.size, color: muted ? C.light : C.black }}>{v == null ? "–" : typeof v === "number" ? fmtInt(v) : v}</span>;
  const lock = <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" aria-hidden="true"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>;

  // one goal line
  const goalRow = (t: Task) => {
    const s = planner.stateOf(t, monday);
    const period = periodOf(t, monday);
    const days = rowKind(t) === "days";
    const girls = t.source === NEW_GIRLS;   // a number per day, the week adds up
    const leads = t.source === "leads";
    const followers = t.source === "followers";
    const fromSprint = t.source === "pitches" && sprintThisWeek;
    const left = s.target != null ? Math.max(0, s.target - (s.actual ?? 0)) : null;
    // totals (following, followers) with nothing typed yet: "Not entered", never "85.000 to go"
    const notEntered = isTotal(t) && s.target != null && s.actual == null && !s.done;
    const state: "reached" | "togo" | "missed" | "none" =
      s.done ? "reached" : days ? (over ? "missed" : "togo") : s.target == null || notEntered ? "none" : over ? "missed" : "togo";
    const text = state === "togo" ? `${days ? 7 - s.daysDone : fmtInt(left)} to go` : state === "missed" ? (days ? `${s.daysDone} / 7` : `−${fmtInt(left)}`)
      : state === "none" ? (notEntered ? "Not entered" : "No goal set") : undefined;
    const typed = !fromSprint && (t.source === "following" || t.source === "pitches" || leads);
    const tone = state === "reached" ? PAL.done.ink : state === "missed" ? PAL.late.ink : state === "togo" ? PAL.waiting.ink : C.muted;
    const status = s.done ? statusText("✓ reached", PAL.done.ink)
      : fromSprint ? statusText("from sprint", C.muted)
      : text && !(state === "none" && !notEntered) ? statusText(text.charAt(0).toLowerCase() + text.slice(1), tone)
      : t.source === "outreach" ? statusText("from the list", C.muted) : null;
    const editGoal = (label = `Goal for ${NAME(t)}`) => goalField(`${t.id}|goal`, s.target, label, v => quiet(planner.saveEntry(t.id, period, { target: v })));

    // Engaging · New girls: name, count and goal on the grid; the 7 days in a row under it
    if (days || girls) {
      const e = planner.entries[entryKey(t.id, period)];
      const counts: (number | null)[] = girls && Array.isArray(e?.data?.counts) && e.data.counts.length === 7
        ? e.data.counts.map((x: any) => (x == null || x === "" ? null : Number(x) || 0)) : [null, null, null, null, null, null, null];
      const saveGirls = (i: number, v: number | null) => {
        const c = [...counts]; c[i] = v;
        const sum = c.reduce((m: number, x) => m + (x || 0), 0);
        quiet(planner.saveEntry(t.id, period, { data: { ...(e?.data || {}), counts: c }, actual: c.some(x => x != null) ? sum : null }));
      };
      return (
        <div key={t.id} style={{ padding: `10px ${ROW_X}px 12px`, borderTop: `1px solid ${C.hair}` }}>
          <div style={{ display: "flex", alignItems: "center", minHeight: 32 }}>
            {nameCell(NAME(t), status, s.done)}
            {countCell(girls ? s.actual ?? 0 : s.daysDone)}
            {girls && editGoals ? editGoal() : goalCell(girls ? s.target : 7)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginTop: 8 }}>
            {DAY_SHORT.map((d, i) => {
              if (girls) return <DayNum key={`${t.id}|${period}|${i}`} value={counts[i] ?? null} today={i === ti} letter={d.charAt(0)} label={`New girls on ${d}`} onSave={v => saveGirls(i, v)} />;
              const on = s.days[i];
              return (
                <button key={d} onClick={() => { const ds = [...s.days]; ds[i] = !ds[i]; quiet(planner.saveEntry(t.id, period, { days: ds })); }}
                  aria-pressed={on} aria-label={`${d}${on ? ", done" : ""}`} title={d}
                  style={{ height: DAY_H, minWidth: 0, padding: 0, borderRadius: 8, boxSizing: "border-box" as const, cursor: "pointer", fontFamily: SANS,
                    border: i === ti ? `2px solid ${C.black}` : `1.5px solid ${on ? PAL.done.mid : C.edge}`, background: on ? PAL.done.wash : C.white,
                    color: on ? PAL.done.ink : C.light, fontSize: on ? 14 : 12, fontWeight: on ? 700 : 400, lineHeight: 1 }}>{on ? "✓" : d.charAt(0)}</button>
              );
            })}
          </div>
        </div>
      );
    }

    // every other line: name · status … count (typed or counted) · / goal
    return (
      <div key={t.id} style={rowLine()}>
        {nameCell(NAME(t), status, s.done)}
        {followers ? countField(`${t.id}|done`, s.actual, "Followers this week", v => quiet(planner.saveSnapshot(acc, monday, { followers: v })))
          : typed ? countField(`${t.id}|done`, s.actual, `${NAME(t)} this week`, v => quiet(planner.saveEntry(t.id, period, { actual: v })))
          : countCell(s.actual ?? 0)}
        {!leads && !fromSprint && editGoals ? editGoal() : goalCell(s.target, leads)}
      </div>
    );
  };

  // followers: has its own goal line once the SQL added it; until then this line
  // (typed, no goal, +/− vs last week) — the number is the same snapshot either way
  const hasFollowers = goals.some(t => t.source === "followers");
  const sn = planner.snaps[snapKey(acc, monday)];
  const prevSn = planner.snaps[snapKey(acc, addDays(monday, -7))];
  const fDiff = sn?.followers != null && prevSn?.followers != null ? sn.followers - prevSn.followers : null;
  const followersRow = (
    <div key="followers" style={rowLine()}>
      {nameCell("Followers", fDiff != null ? statusText(`${fDiff >= 0 ? "+" : "−"}${fmtInt(Math.abs(fDiff))}`, fDiff >= 0 ? PAL.done.ink : PAL.late.ink) : null)}
      {countField(`followers|${acc}`, sn?.followers ?? null, "Followers this week", v => quiet(planner.saveSnapshot(acc, monday, { followers: v })))}
      {goalCell(null, true)}
    </div>
  );

  const checkNote = checkT && (() => {
    const e = planner.entries[`${checkT.id}|${periodOf(checkT, monday)}`];
    return (
      <>
        <SectionHead label="Check-in" />
        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, minHeight: ROW_H, display: "flex", alignItems: "center", padding: `4px ${ROW_X}px`, boxSizing: "border-box" as const }}>
          <InlineText value={e?.note || ""} placeholder="Note for this week" ariaLabel="Check-in note"
            onSave={v => quiet(planner.saveEntry(checkT.id, periodOf(checkT, monday), { note: v }))} />
        </div>
      </>
    );
  })();

  // ── Sales · this week: Collabs and UGC, each Pitches (goal) + Leads, counted from Outreach ──
  const SALES_ICON: Record<string, string> = {
    collab: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",   // a heart: brand collaborations
    ugc:    "M4 7h11v10H4zM15 10l5-3v10l-5-3",                                       // a camera: content for brands
  };
  const salesTone = (c: SalesCatDef) => (c.key === "ugc" ? PAL.progress : PAL.late);
  const salesRow = (c: SalesCatDef, what: "pitches" | "leads") => {
    const t = salesT(what === "pitches" ? c.pitches : c.leads);
    const isP = what === "pitches";
    const st = t ? planner.stateOf(t, monday) : null;
    const n = st ? st.actual ?? 0 : planner.salesCount(c.key, what, monday);
    const target = isP ? st?.target ?? null : null;
    // while its account's sales sprint covers the week, its goal is the sprint's share (both pages, live)
    const bySprint = isP && !!t && planner.sprintShare(c.account, monday) != null;
    const hit = target != null && n >= target;
    const left = target != null ? Math.max(0, target - n) : 0;
    const status = !isP ? (n === 0 ? (over ? "none" : "none yet") : "") : target == null ? "" : hit ? "✓ reached" : over ? `−${fmtInt(left)}` : `${fmtInt(left)} to go`;
    const tone = hit ? PAL.done.ink : !isP || target == null ? C.muted : over ? PAL.late.ink : PAL.waiting.ink;
    const name = `${isP ? "Pitches" : "Leads"} · ${c.label}`;
    return (
      <div key={`${c.key}|${what}`} style={rowLine()}>
        {nameCell(isP ? "Pitches" : "Leads", status ? statusText(`${status}${bySprint ? " · sprint" : ""}`, tone) : null, hit,
          <span aria-hidden="true" style={{ width: 3, height: 20, borderRadius: 2, background: salesTone(c).mid, flexShrink: 0 }} />)}
        {countCell(n, `${name}: ${n}`)}
        {isP && editGoals && t && !bySprint
          ? goalField(`${t.id}|goal`, target, `Goal for ${name}`, v => quiet(planner.saveEntry(t.id, periodOf(t, monday), { target: v })))
          : goalCell(target, !isP)}
      </div>
    );
  };
  const salesPitchLines = SALES_CATS.map(c => salesT(c.pitches)).filter(Boolean) as Task[];
  const salesReached = salesPitchLines.filter(t => planner.stateOf(t, monday).done).length;
  const salesCard = (
    <>
      <SectionHead dot={PAL.waiting.mid} label="Sales · this week" right={salesPitchLines.length ? <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: salesReached === salesPitchLines.length ? PAL.done.ink : PAL.neutral.ink }}>{salesReached} of {salesPitchLines.length} reached</span>
        <button onClick={() => setEditGoals(e => !e)} aria-pressed={editGoals}
          style={{ background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: editGoals ? PAL.progress.ink : PAL.neutral.ink }}>{editGoals ? "Done" : "Edit goals"}</button>
      </span> : null} />
      <div id="card-sales" style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, overflow: "hidden" }}>
        {SALES_CATS.map((c, i) => {
          const tone = salesTone(c);
          return (
            <div key={c.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: `7px ${ROW_X}px 6px`, background: tone.wash, borderTop: i === 0 ? "none" : `1px solid ${C.hair}` }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.white, color: tone.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ico d={SALES_ICON[c.key]} size={11} />
                </span>
                <span style={{ fontSize: 10, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" as const, color: tone.ink }}>{c.label}</span>
                <span style={{ fontSize: TYPE.micro.size, color: tone.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.sub}</span>
              </div>
              {salesRow(c, "pitches")}
              {salesRow(c, "leads")}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "6px 2px 0", lineHeight: 1.4 }}>
        Counted from Outreach: contacts pitched this week, each once (emails and DMs), and contacts that became a Lead.
        {!salesReady && " Goals: run LH-Studio-manager-sales.sql once in Supabase."}
      </p>
    </>
  );

  const goalRows = [
    ...goals.flatMap(t => (t.source === "following" && !hasFollowers ? [goalRow(t), followersRow] : [goalRow(t)])),
    ...(!hasFollowers && !goals.some(t => t.source === "following") ? [followersRow] : []),
  ].map((el: any, k: number) => (k === 0 && el ? cloneElement(el, { style: { ...el.props.style, borderTop: "none" } }) : el));
  const goalsCard = (
    <>
      <SectionHead label="This week's goals" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: counted.length && reached === counted.length ? PAL.done.ink : PAL.neutral.ink }}>{reached} of {counted.length} reached</span>
        <button onClick={() => setEditGoals(e => !e)} aria-pressed={editGoals}
          style={{ background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: editGoals ? PAL.progress.ink : PAL.neutral.ink }}>{editGoals ? "Done" : "Edit goals"}</button>
      </span>} />
      <div id="card-goals" style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, overflow: "hidden" }}>
        {goals.length === 0 && <p style={{ fontSize: SPACING.plannerText, color: C.muted, margin: 0, padding: "12px" }}>No goals for this account yet.</p>}
        {goalRows}
      </div>
      {salesCard}
      {checkNote}
    </>
  );

  // ── sales sprint (Stage 2 on) ───────────────────────────────
  const hideKey = `lh_sprint_hidden_${acc}`;
  const [, rerender] = useState(0);
  const hidden = (() => { try { return localStorage.getItem(hideKey) === "1"; } catch { return false; } })();   // per account, on this device
  const setHide = (v: boolean) => { try { v ? localStorage.setItem(hideKey, "1") : localStorage.removeItem(hideKey); } catch { /* ignore */ } rerender(n => n + 1); };
  const past = planner.sprints.filter(x => x.account === acc && x.status === "done").sort((a, b) => b.startOn.localeCompare(a.startOn));
  const focusText = (s: Sprint) => `${s.focusCategory ? (OUTREACH_CATEGORIES.find(c => c.key === s.focusCategory)?.label || "Any category") : "Any category"} · ${OUTREACH_TIERS.find(t => t.key === s.focusTier)?.label || "Any tier"}`;

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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 56px 44px 72px", alignItems: "center", columnGap: 8, padding: "0 12px", minHeight: SPACING.row1, borderTop: `1px solid ${C.hair}`, fontSize: SPACING.plannerText }}>
        <span>{label} {isToday ? "today" : <span style={{ color: C.muted }}>· {dayLabel(day)}</span>}</span>
        {numField(`${sp.id}|${day}|${key}`, v[key] ?? null, `${label} ${isToday ? "today" : dayLabel(day)}`, val => saveDay(sp, day, key, val))}
        <span style={{ fontSize: 13 }}>/ {target ?? "–"}</span>
        <span style={{ display: "flex", justifyContent: "flex-end" }}>{mark(v[key], target)}</span>
      </div>
    );
    return (
      <div id="card-sprints" style={{ ...card, boxShadow: "0 6px 18px rgba(26,26,26,0.08)", borderColor: look.border }}>
        {band(`Sales sprint ${sp.num} · day ${d.day} of ${d.total}`, <span style={{ color: C.black }}>{focusText(sp)}</span>)}
        {row("Pitches", "p", dailyP)}
        {row("Follow-ups", "f", dailyF)}
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.hair}`, display: "grid", gridTemplateColumns: `repeat(${Math.min(14, allDays.length)}, minmax(0,1fr))`, gap: 3 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 12px", borderTop: `1px solid ${C.hair}`, background: C.bg }}>
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
            style={{ width: "100%", minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: `1px solid ${C.hair}`, background: C.bg, cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.muted }}>
            <span>Past sprints · {past.length}</span><Ico d={pastOpen ? IC.up : IC.down} size={12} />
          </button>
          {pastOpen && past.map(p => {
            const ps = planner.sprintStats(p);
            return (
              <button key={p.id} onClick={() => setSprintWin({ id: p.id })}
                style={{ width: "100%", minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", border: "none", borderTop: `1px solid ${C.hair}`, background: C.white, cursor: "pointer", fontFamily: SANS, fontSize: SPACING.plannerText, textAlign: "left" as const }}>
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
      <TabTitle title="Manager" acc={acc} onAccount={onAccount} isMobile={isMobile} right={<GuideBtn on={guide.open} onClick={guide.toggle} />} />

      {guide.open && <GuideCard onClose={guide.close} steps={[
        "Tick Engaging every day you engage.",
        salesReady ? "Type Following and Followers anytime during the week, by Sunday at the latest. New emails, and Sales (Pitches and Leads, Collabs and UGC), count by themselves from Outreach."
          : "Type Following, Followers, Pitches and Leads anytime during the week, by Sunday at the latest. New emails count by themselves.",
        stage2 ? "In a sales sprint, type the pitches and follow-ups each day. At the end: End & review." : "Goals are set with Edit goals, usually at the check-in.",
      ]} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: SPACING.titleToSummary }}>
        <SummaryLine dot={counted.length + salesPitchLines.length && reached + salesReached === counted.length + salesPitchLines.length ? PAL.done.mid : PAL.waiting.mid}>{weekRange(monday)}{over ? " · closed, still editable" : ""}</SummaryLine>
        <WeekPill label={`Week ${isoWeekOf(monday)}`} onPrev={() => setMonday(addDays(monday, -7))} onNext={() => setMonday(addDays(monday, 7))} />
      </div>

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {(() => {
            const err = stage2 && planner.stage2Error && <p style={{ fontSize: 12, color: C.red, margin: "12px 0 0", lineHeight: 1.5 }}>{planner.stage2Error}</p>;
            const showSprint = stage2 && !sp && hidden && (
              <button onClick={() => setHide(false)} style={{ marginTop: 12, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.light }}>Show sales sprint</button>
            );
            const locked = !stage2 && <div style={{ marginTop: 12, fontSize: 12, color: C.light, display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.lock} size={12} />Sales sprint · from Stage 2</div>;
            // phone: one column as before · iPad / computer: goals + check-in on the left, the sales sprint on the right
            return isMobile ? <>{err}{sprintCard}{sprintIdle}{goalsCard}{showSprint}{locked}</>
              : <Cols left={goalsCard} right={<>{err}{sprintCard}{sprintIdle}{showSprint}{locked}</>} />;
          })()}
        </>
      )}

      {sprintWin && (
        <SprintWindow key={`${sprintWin.id || "new"}-${sprintWin.review ? "r" : ""}`} planner={planner} sprintId={sprintWin.id} review={sprintWin.review} isMobile={isMobile} onClose={() => setSprintWin(null)}
          draft={sprintWin.acc ? { account: sprintWin.acc, startOn: thisMonday(), endOn: addDays(thisMonday(), sprintW * 7 - 1), focusCategory: "", focusTier: "", pitchGoal: null, followUpGoal: null, review: "" } : undefined} />
      )}
    </div>
  );
}
