// ─────────────────────────────────────────────────────────────
// PlannerCreator — Planner › Creator (the creator's workspace):
// the content plan, ordered by what to do next.
//   Week strip · ideas, posts, pieces, month goal and first set
//   All / Content / Portfolio
//   Concept (one line, opens on tap)
//   Now (accounts with phases): the phase and era you're in (synced between devices), then one
//     row per arc of that era in posting order — its idea and where it is (Shoot › while it's
//     an idea), or "+ Add an idea" when the arc is empty (a new idea with phase, era and arc set)
//   The lists, by what needs you first — every one folds (tap its title; remembered):
//     To post  · filmed, waiting to go live — tick = posted
//     To shoot · on the shoot list (a date is optional) — tick = filmed
//     Saved ideas · the ideas not in Now, by phase (No phase last); Use now › moves one into
//                 the Now era (without an era: Shoot ›) · + Add (a pasted link = an idea with
//                 that link). Without phases (@createbylynn): Ideas, as before.
//     Posted   · folded at first; untick = back to To post
//   Every move shows Undo. Tap an idea to open it (the same ticks are there).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, PAL, TRACK, SHADOW } from "./constants";
import { B, Tick, BAR_BTN, SectionHead, SummaryLine, Strong, TonedTag, Chip, ChipRow, SwitchPill, ValuePill, TextInline, Cols, MiniSelect } from "./atoms";
import { parseYMD, monthStart, monthEnd, today } from "./formatters";
import {
  FORMATS, CLASSIC, OWNER_LOOK, TONE, isVisible, monthName, entryKey, monthGoalOf, monthGoalPatch, thisMonday, storyLines, isoWeek,
  CREATOR_GOAL, creatorOrder, shortName, parseIntDe,
  isPostedStatus, linkInfo, isUrlLike, EMPTY_PLAN, itemStageOf, typeOf, TYPES, typePatch, CONTENT, PHASE_TONE,
} from "./planner";
import { monthOfWeek } from "./planner";
import type { Account, Item, ItemList, ItemStage, Task } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Subtitle, TabTitle, ItemWindow, InlineText, GoalNum, useGuide, GuideBtn, GuideCard, ResultMark, TickBox, moveTo } from "./PlannerWindows";
import { showUndo, XBtn } from "./undo";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.creator;
const AMBER = "#b07a4a";
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortDate = (d: string) => { const dt = parseYMD(d); return dt ? `${WD[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.` : ""; };
type Show = "all" | "idea" | "editorial";

interface PlannerCreatorProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  onAccount?: (a: Account) => void;
  openCatalog?: () => void;
  openTab?:  (tab: string, anchor?: string) => void;
  openOutreach?: () => void;
}

export default function PlannerCreator({ planner, view, isMobile, onAccount }: PlannerCreatorProps) {
  const { tasks, stages, items, loading, loadError } = planner;
  const [open, setOpen]       = useState<string | null>(null);
  const [show, setShow]       = useState<Show>("all");
  // folded lists, remembered on this phone (Posted starts folded)
  const FOLD_KEY = "lh_creator_folded";
  const [folded, setFolded] = useState<Record<string, boolean>>(() => {
    try { const v = JSON.parse(localStorage.getItem(FOLD_KEY) || "null"); if (v && typeof v === "object") return v; } catch { /* ignore */ }
    return { posted: true };
  });
  const setFold = (key: string, v: boolean) => setFolded(f => {
    const next = { ...f, [key]: v };
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const [concept, setConcept] = useState(false);
  const guide = useGuide("creator");
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const now = thisMonday();
  const td  = today();
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const find = (src: string) => visible.find(t => t.source === src && (t.account === acc || t.account === "both"));
  const conceptTask = visible.find(t => t.area === "concept" && t.phase !== "maintain" && t.account === acc);
  const monthTask   = visible.find(t => t.rhythm === "monthly" && t.area === "portfolio" && t.account === acc)
                   || visible.find(t => t.rhythm === "monthly" && t.area === "portfolio");
  const isLynn = acc === "lynnhoa";

  // ── which list each item sits in ────────────────────────────
  const mine    = items.filter(i => i.account === acc && (show === "all" || i.list === show));
  const byNew   = (a: Item, b: Item) => b.createdAt.localeCompare(a.createdAt);
  const toPost  = mine.filter(i => itemStageOf(i) === "shot")      // oldest filmed first, so nothing goes stale
    .sort((a, b) => String(a.plan?.filmedOn || "").localeCompare(String(b.plan?.filmedOn || "")) || byNew(a, b));
  const toShoot = mine.filter(i => itemStageOf(i) === "planned")   // dated first (soonest), then the rest, newest first
    .sort((a, b) => (a.plannedOn && b.plannedOn ? a.plannedOn.localeCompare(b.plannedOn) : a.plannedOn ? -1 : b.plannedOn ? 1 : byNew(a, b)));
  const ideas   = mine.filter(i => itemStageOf(i) === "idea").sort(byNew);
  const postedL = mine.filter(i => itemStageOf(i) === "posted")
    .sort((a, b) => String(b.postedOn || "").localeCompare(String(a.postedOn || "")) || byNew(a, b));

  // ── Now: the phase and era you're in (synced), the era's arcs and what's planned for them ──
  const phases    = planner.phases.filter(p => p.account === acc).sort((a, b) => a.num - b.num);
  const hasPhases = phases.length > 0;
  const nowSel    = planner.nowOf(acc);
  const nowPhase  = phases.find(p => p.num === nowSel.phase);
  const nowEra    = nowPhase?.eras.find(e => e.key === nowSel.era);
  const accArcs   = planner.arcs.filter(a => a.account === acc);
  const arcNumOf  = (it: Item): number | null => accArcs.find(a => a.id === it.plan?.arc)?.num ?? null;
  const inNow     = (it: Item) => !!nowPhase && !!nowEra && it.plan?.phase === nowPhase.num && it.plan?.era === nowEra.key;
  const nowItems  = mine.filter(inNow).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const eraNums   = nowEra ? nowEra.arcs.map(a => a.num) : [];
  const coreNums  = nowEra ? nowEra.arcs.filter(a => !a.optional).map(a => a.num) : [];
  const postedCore = coreNums.filter(n => nowItems.some(i => arcNumOf(i) === n && itemStageOf(i) === "posted")).length;
  // Saved: the ideas that aren't in Now, by phase (in order), then the ones without one
  const saved     = hasPhases ? ideas.filter(i => !inNow(i)) : ideas;
  const savedGroups = hasPhases ? [
    ...phases.map(p => ({ key: `p${p.num}`, label: `${p.num} · ${p.name}`, dot: PHASE_TONE.mid, items: saved.filter(i => i.plan?.phase === p.num) })),
    { key: "none", label: "No phase", dot: PAL.neutral.mid, items: saved.filter(i => !phases.some(p => p.num === i.plan?.phase)) },
  ].filter(g => g.items.length) : [];
  // the small line of an idea that has a phase: its era and arc ("The city · 3 · The Moment")
  const conceptMeta = (it: Item): string | undefined => {
    const p = phases.find(x => x.num === it.plan?.phase);
    const e = p?.eras.find(x => x.key === it.plan?.era);
    const a = accArcs.find(x => x.id === it.plan?.arc);
    const fmt = it.plan?.arcFormat;
    const bits = [e?.name, a ? `${a.num} · ${a.name}` : undefined, a && fmt ? fmt : undefined].filter(Boolean) as string[];
    return bits.length ? bits.join(" · ") : undefined;
  };

  // ── actions ─────────────────────────────────────────────────
  // one step at a time; every move shows Undo
  const go = (it: Item, st: ItemStage) => quiet(moveTo(planner, it, st, true));
  // + Add: a title — or a pasted TikTok / Instagram / YouTube link, saved as the idea's first link
  const addItem  = (text: string) => {
    const type = show === "editorial" ? (TYPES[acc][1] || CONTENT) : CONTENT;
    const link = isUrlLike(text) ? text.trim() : "";
    const title = link ? `${linkInfo(link).platform} idea` : text;
    quiet(planner.createItem({ account: acc, title, status: "idea", plannedOn: null, views: null, link: "", direction: "", ...typePatch(acc, type),
      ...(link ? { plan: { ...EMPTY_PLAN, refs: [{ url: link, note: "" }] } } : {}) }));
  };

  // Now: pick the phase (keeps the era if the new phase has it) and the era — saved for every device
  const pickNowPhase = (v: string) => {
    const n = Number(v) || 0;
    if (!n) { quiet(planner.setNow(acc, null, null)); return; }
    const next = phases.find(p => p.num === n);
    const keep = !!next && !!nowSel.era && next.eras.some(e => e.key === nowSel.era);
    quiet(planner.setNow(acc, n, keep ? nowSel.era : null));
  };
  const pickNowEra = (key: string) => quiet(planner.setNow(acc, nowSel.phase, key || null));
  // Use now ›: a saved idea moves into the Now era (its arc stays) · Undo puts it back
  const useNow = (it: Item) => {
    if (!nowPhase || !nowEra) return;
    const before = it.plan;
    quiet(planner.updateItem(it.id, { plan: { ...it.plan, phase: nowPhase.num, era: nowEra.key } }));
    showUndo(`Moved to ${nowEra.name}`, () => planner.updateItem(it.id, { plan: before }));
  };
  // + Add an idea (an empty arc in Now): a new idea with phase, era and arc set (a pasted link works too)
  const [addArc, setAddArc] = useState<number | null>(null);
  const addForArc = (n: number, text: string) => {
    if (!nowPhase || !nowEra) return;
    const arc  = accArcs.find(a => a.num === n);
    const link = isUrlLike(text) ? text.trim() : "";
    const title = link ? `${linkInfo(link).platform} idea` : text;
    quiet(planner.createItem({ account: acc, title, status: "idea", plannedOn: null, views: null, link: "", direction: "", ...typePatch(acc, CONTENT),
      plan: { ...EMPTY_PLAN, phase: nowPhase.num, era: nowEra.key, arc: arc?.id ?? null, ...(link ? { refs: [{ url: link, note: "" }] } : {}) } }));
  };

  // ── pieces ──────────────────────────────────────────────────
  // ── like the mockup: master parts only ───────────────────────
  const [editGoals, setEditGoals] = useState(false);
  const fsT = visible.find(t => t.source === "portfolio_total" && t.account === acc);
  const fs = fsT ? planner.stateOf(fsT, now) : null;
  const ms = monthOfWeek(now), me = monthEnd(ms);              // the month of today (1 Nov = November)
  const monthEntry = monthTask ? planner.entries[entryKey(monthTask.id, ms)] : undefined;
  const goal = monthTask ? (monthTask.account === "both" ? monthGoalOf(monthTask, monthEntry, acc) : planner.targetOf(monthTask.id, ms)) : null;
  const doneMonth = items.filter(i => i.account === acc && i.portfolio && (i.status === "posted" || i.status === "in_kit") && !!i.postedOn && i.postedOn >= ms && i.postedOn <= me).length;
  const weekGoals = visible.filter(t => CREATOR_GOAL(t) && (t.account === acc || t.account === "both")).sort((a, b) => creatorOrder(a) - creatorOrder(b));
  const reached = weekGoals.filter(t => planner.stateOf(t, now).done).length;
  const note = planner.noteOf(acc, "concept");
  const conceptWord = conceptTask ? (planner.doneOf(conceptTask) ? (conceptTask.phase === "refine" ? "Settled ✓" : "Done ✓") : conceptTask.phase === "refine" ? "Refining" : "Open") : "";
  const [adding, setAdding] = useState(0);
  const monthTarget = goal;
  const tone = (d: number, t: number | null) => (t == null ? PAL.neutral : d >= t ? PAL.done : PAL.waiting);
  const subOf = (d: number, t: number | null) => (t == null ? "no goal" : d >= t ? "✓ reached" : `${t - d} to go`);
  // one small tile per goal, up to 4 in a row: the name on top, "done / goal" under it;
  // the colour says it (grey no goal · yellow to go · green reached). Edit goals: a white field under the name.
  const sr: any = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
  const tile = (key: string, name: string, d: number, t: number | null, onGoal: (v: number | null) => void) => {
    const tn = tone(d, t);
    return (
      <div key={key} title={`${name}: ${d}${t != null ? ` of ${t}` : ""} · ${subOf(d, t)}`}
        style={{ position: "relative", background: tn.wash, borderRadius: RADIUS.tile, minHeight: 48, padding: "7px 9px 6px", minWidth: 0,
          display: "flex", flexDirection: "column" as const, justifyContent: "center", alignItems: "flex-start", gap: 2, boxSizing: "border-box" as const }}>
        <span style={{ maxWidth: "100%", fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: tn.ink, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{name}</span>
        {editGoals
          ? <ValuePill white width={44} text={t == null ? "" : String(t)} label={`Goal for ${name}`} onCommit={(x) => { const v = x.trim() === "" ? null : parseIntDe(x); if (v !== t) onGoal(v); }} />
          : <span style={{ fontFamily: SERIF, fontSize: TYPE.figure.size, color: C.black, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              {d}{t != null && <span style={{ fontFamily: SANS, fontSize: TYPE.label.size, color: C.muted }}> / {t}</span>}
              <span style={sr}> · {subOf(d, t)}</span>
            </span>}
      </div>
    );
  };
  const goalTiles = [
    ...weekGoals.map(t => { const s0 = planner.stateOf(t, now); return tile(t.id, shortName(t), s0.actual ?? 0, s0.target, v => quiet(planner.saveEntry(t.id, now, { target: v }))); }),
    // short labels so every name fits next to the number / the field: "Oct", "1st set"
    ...(monthTask ? [tile("month", monthName(ms).slice(0, 3), doneMonth, monthTarget, v => quiet(planner.saveEntry(monthTask.id, ms, monthTask.account === "both" ? monthGoalPatch(monthTask, monthEntry, acc, v) : { target: v })))] : []),
    ...(fsT && fs ? [tile("firstset", "1st set", fs.actual ?? 0, fsT.target ?? null, v => quiet(planner.updateTask(fsT.id, { target: v })))] : []),
  ];
  // "x of y reached" counts every tile shown: the week's goals, the month goal and the first set
  const shownTotal   = weekGoals.length + (monthTask ? 1 : 0) + (fsT && fs ? 1 : 0);
  const shownReached = reached + (monthTask && monthTarget != null && doneMonth >= monthTarget ? 1 : 0) + (fsT && fs && fs.done ? 1 : 0);
  const head = (label: string, right?: any, dot?: string) => <SectionHead dot={dot} label={label} right={right} />;
  const linkBtn = (label: string, fn: () => void) => (
    <button onClick={fn} style={{ background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: PAL.neutral.ink }}>{label}</button>
  );
  const card = (children: any) => <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, overflow: "hidden" }}>{children}</div>;
  const rowS = (k: number): any => ({ minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: 2, padding: `0 4px 0 ${SPACING.rowSide}px`, borderTop: k ? `1px solid ${C.hair}` : "none", boxSizing: "border-box" as const });
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  // the small line under the title: type · the day · clips · links
  const metaOf = (it: Item, day?: string) => {
    const bits = [typeOf(it)];
    if (day) bits.push(day);
    const nc = it.plan?.clips?.length || 0, nl = it.plan?.refs?.length || 0;
    if (nc) bits.push(plural(nc, "clip"));
    if (nl) bits.push(plural(nl, "link"));
    return bits.join(" · ");
  };
  // a list's title: tap to fold / open (the count stays) · + Add for Ideas
  const listHead = (key: string, label: string, n: number, dot: string, hint?: string, add?: () => void) => {
    const f = !!folded[key];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: `${SPACING.sectionTop}px 2px ${SPACING.sectionBottom}px` }}>
        <button onClick={() => setFold(key, !f)} aria-expanded={!f} aria-label={`${label} · ${n} · ${f ? "open" : "fold"}`}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: PAL.neutral.ink, whiteSpace: "nowrap" as const }}>{label} · {n}</span>
          <span style={{ marginLeft: "auto", fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const }}>{!f && hint ? hint : ""}</span>
          <span aria-hidden="true" style={{ fontSize: TYPE.label.size, color: PAL.neutral.ink, width: 12, textAlign: "center" as const }}>{f ? "▾" : "▴"}</span>
        </button>
        {add && <button onClick={() => { if (f) setFold(key, false); add(); }} style={{ background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const }}>+ Add</button>}
      </div>
    );
  };
  // tap the date (or "date") = the iPhone's date picker, directly
  const datePick = (it: Item) => {
    const d = it.plannedOn;
    const when = !d ? "date" : d === td ? "Today" : d < td ? `Overdue · ${shortDate(d)}` : shortDate(d);
    const col = !d ? C.light : d === td ? PAL.waiting.ink : d < td ? PAL.late.ink : C.muted;
    return (
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", minHeight: SPACING.tap, padding: "0 6px", flexShrink: 0 }}>
        <span style={{ fontSize: SPACING.listMeta, color: col, whiteSpace: "nowrap" as const }}>{when}</span>
        <input type="date" aria-label={`Shoot date for ${it.title}`} value={d || ""} onChange={(e) => quiet(planner.updateItem(it.id, { plannedOn: e.target.value || null }))}
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", fontSize: 16, border: "none", padding: 0 }} />
      </span>
    );
  };
  // one row: (tick) · title + small line (tap = open the idea) · (date / Shoot ›)
  const row = (it: Item, k: number, opts: { tick?: { on: boolean; tone: any; label: string; run: () => void }; day?: string; right?: any; meta?: string }) => (
    <div key={it.id} style={{ display: "flex", alignItems: "center", minHeight: SPACING.row2, paddingRight: 6, paddingLeft: opts.tick ? 0 : SPACING.rowSide, borderTop: k ? `1px solid ${C.hair}` : "none", boxSizing: "border-box" as const }}>
      {opts.tick && <TickBox on={opts.tick.on} tone={opts.tick.tone} ariaLabel={opts.tick.label} onClick={opts.tick.run} />}
      <button onClick={() => setOpen(it.id)} aria-label={`Open ${it.title}`}
        style={{ flex: 1, minWidth: 0, alignSelf: "stretch", display: "flex", flexDirection: "column" as const, justifyContent: "center", padding: "6px 6px 6px 0", background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
        <span style={{ display: "block", width: "100%", fontSize: SPACING.plannerText, color: C.black, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
        <span style={{ display: "block", width: "100%", fontSize: SPACING.listMeta, color: C.muted, marginTop: 2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{opts.meta ?? metaOf(it, opts.day)}</span>
      </button>
      {opts.right}
    </div>
  );
  const shootBtn = (it: Item) => (
    <button onClick={() => go(it, "planned")} aria-label={`Shoot ${it.title}`} style={{ background: "none", border: "none", padding: "12px 6px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color: PAL.progress.ink, whiteSpace: "nowrap" as const, flexShrink: 0 }}>Shoot ›</button>
  );
  const useNowBtn = (it: Item) => (
    <button onClick={() => useNow(it)} aria-label={`Use ${it.title} now`} style={{ background: "none", border: "none", padding: "12px 6px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const, flexShrink: 0 }}>Use now ›</button>
  );
  // in Now: Shoot › while it's an idea, then where it is (to shoot · filmed · posted)
  const stageRight = (it: Item) => {
    const st = itemStageOf(it);
    if (st === "idea") return shootBtn(it);
    const [tone, word] = st === "planned" ? [PAL.progress, "to shoot"] : st === "shot" ? [PAL.waiting, "filmed"] : [PAL.done, "posted"];
    return <TonedTag tone={tone} s={{ margin: "0 6px", flexShrink: 0 }}>{word}</TonedTag>;
  };
  const arcLabel = (n: number) => { const a = accArcs.find(x => x.num === n); return a ? `${n} · ${a.name}` : `Arc ${n}`; };
  // Now's rows: per arc of the era (posting order) its ideas, or one "+ Add an idea" row;
  // then ideas of the era whose arc isn't one of its arcs (or has none yet)
  const nowRows = () => {
    if (!nowEra) return null;
    const out: any[] = [];
    nowEra.arcs.forEach(ea => {
      const its = nowItems.filter(i => arcNumOf(i) === ea.num);
      const tail = ea.optional ? " · optional" : "";
      if (its.length) its.forEach(it => out.push(row(it, 1, { right: stageRight(it), meta: `${arcLabel(ea.num)}${it.plan?.arcFormat ? ` · ${it.plan.arcFormat}` : ""}${tail}` })));
      else if (addArc === ea.num) out.push(
        <div key={`add-arc-${ea.num}`} style={{ ...rowS(1), minHeight: SPACING.row2, paddingRight: SPACING.rowSide }}>
          <TextInline size={SPACING.plannerText} value="" placeholder={`New idea for ${accArcs.find(a => a.num === ea.num)?.name || "this arc"}`} ariaLabel={`New idea for arc ${ea.num}`} autoFocus
            onSave={v => { if (v.trim()) addForArc(ea.num, v.trim()); setAddArc(null); }} />
        </div>);
      else out.push(
        <button key={`empty-${ea.num}`} onClick={() => setAddArc(ea.num)} aria-label={`Add an idea for ${arcLabel(ea.num)}`}
          style={{ width: "100%", minHeight: SPACING.row2, display: "flex", flexDirection: "column" as const, justifyContent: "center", alignItems: "flex-start", padding: `6px 6px 6px ${SPACING.rowSide}px`,
            background: "none", border: "none", borderTop: `1px solid ${C.hair}`, cursor: "pointer", fontFamily: SANS, textAlign: "left" as const, boxSizing: "border-box" as const }}>
          <span style={{ fontSize: SPACING.plannerText, color: C.light }}>+ Add an idea</span>
          <span style={{ fontSize: SPACING.listMeta, color: ea.optional ? C.light : C.muted, marginTop: 2 }}>{arcLabel(ea.num)}{tail}</span>
        </button>);
    });
    nowItems.filter(i => { const n = arcNumOf(i); return n == null || !eraNums.includes(n); })
      .forEach(it => { const n = arcNumOf(it); out.push(row(it, 1, { right: stageRight(it), meta: n != null ? `${arcLabel(n)} · not one of this era's arcs` : "No arc yet" })); });
    return out;
  };
  const addRow = adding > 0 && (
    <div key={`add-${adding}`} style={{ ...rowS(0), paddingRight: SPACING.rowSide }}>
      <TextInline size={SPACING.plannerText} value="" placeholder={show === "editorial" ? "New portfolio idea or a pasted link" : "New idea or a pasted link"} ariaLabel={show === "editorial" ? "New portfolio idea" : "New idea"} autoFocus
        onSave={v => { if (v.trim()) { addItem(v.trim()); setAdding(n => n + 1); } else setAdding(0); }} />
    </div>
  );
  const emptyNote = (t: string) => <p style={{ fontSize: SPACING.plannerText, color: C.muted, margin: 0, padding: "2px 2px" }}>{t}</p>;

  return (
    <div>
      <TabTitle title="Creator" acc={acc} onAccount={onAccount} isMobile={isMobile} right={<GuideBtn on={guide.open} onClick={guide.toggle} />} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: SPACING.titleToSummary }}>
        <SummaryLine dot={toPost.length ? PAL.waiting.mid : PAL.neutral.mid}><Strong>{toPost.length} to post</Strong> · {toShoot.length} to shoot · {plural(ideas.length, "idea")}</SummaryLine>
        <SwitchPill s={{ padding: "0 12px" }}>Week {isoWeek(now)}</SwitchPill>
      </div>
      {guide.open && <GuideCard onClose={guide.close} steps={hasPhases ? [
        "Now: pick the phase and era you're in. Each arc of the era gets a row: + Add an idea fills an empty one, Shoot › puts an idea on your shoot list.",
        "Saved ideas keep everything for later (+ Add, a pasted link works too). Use now › moves one into the Now era.",
        "Tick it in To shoot once it's filmed: it waits in To post. Tick it there once it's live: Posted. The days count for your goals.",
        "Tap an idea to write its storyline, clips and links. Tap a list's title to fold it.",
      ] : [
        "Add ideas with + Add (a pasted TikTok or Instagram link becomes an idea). Shoot › puts one on your shoot list.",
        "Tick it in To shoot once it's filmed: it waits in To post. Tick it there once it's live: Posted. The days count for your goals.",
        "Tap an idea to write its storyline, clips and links. Tap a list's title to fold it.",
      ]} />}
      {loading ? (
        <p style={{ fontSize: SPACING.plannerText, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: SPACING.plannerText, color: C.red, marginTop: 16 }}>{loadError}</p>
      ) : (
        <>
          {head("This week's goals", <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span>{shownReached} of {shownTotal} reached</span>{linkBtn(editGoals ? "Done" : "Edit goals", () => setEditGoals(e => !e))}</span>)}
          {goalTiles.length ? <div id="card-goals-creator" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, goalTiles.length)}, minmax(0,1fr))`, gap: SPACING.gridGap }}>{goalTiles}</div>
            : <p id="card-goals-creator" style={{ fontSize: SPACING.plannerText, color: C.muted, margin: 0, padding: "2px 2px" }}>No goals for this account yet.</p>}
          <ChipRow s={{ marginTop: SPACING.cardGap }}>
            {([["all", "All"], ["idea", "Content"], ["editorial", "Portfolio"]] as [Show, string][]).map(([k, l]) => <Chip key={k} on={show === k} tone={PAL.neutral} dot={false} label={l} onClick={() => setShow(k)} />)}
          </ChipRow>

          {/* iPad / computer: concept + to post + to shoot on the left · ideas + posted on the right (phone: same order, one column) */}
          <Cols left={<>
          {head(isLynn ? "Social concept" : "Concept", conceptTask ? conceptWord : undefined)}
          {card(concept
            ? <div style={{ padding: "6px 12px 10px" }}>
                <InlineText multiline value={note?.body || ""} ariaLabel="Concept" autoFocus={!note?.body}
                  placeholder={isLynn ? "The base concept and which TikTok." : "The concept overview."}
                  onSave={v => quiet(planner.saveNote(acc, "concept", null, { body: v }))} />
                <button onClick={() => setConcept(false)} style={{ background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: PAL.neutral.ink }}>Close</button>
              </div>
            : <button onClick={() => setConcept(true)} aria-expanded={false} style={{ width: "100%", minHeight: SPACING.row1, display: "flex", alignItems: "center", padding: `0 ${SPACING.rowSide}px`, background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.plannerText, color: note?.body ? C.black : C.light, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{note?.body || "Tap to write it"}</span>
              </button>)}

          {hasPhases && <>
            {head("Now", nowEra ? `${postedCore} of ${coreNums.length} posted` : undefined, PHASE_TONE.mid)}
            {card(<>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6, padding: `10px ${SPACING.rowSide}px` }}>
                <MiniSelect value={nowPhase ? String(nowPhase.num) : ""} muted={!nowPhase} aria-label="Phase now"
                  onChange={(e: any) => pickNowPhase(String(e.target.value || ""))}>
                  <option value="">Pick a phase</option>
                  {phases.map(p => <option key={p.id} value={String(p.num)}>{`${p.num}. ${p.name}`}</option>)}
                </MiniSelect>
                <MiniSelect value={nowEra ? nowEra.key : ""} muted={!nowEra} disabled={!nowPhase} aria-label="Era now"
                  onChange={(e: any) => pickNowEra(String(e.target.value || ""))}>
                  <option value="">{nowPhase ? "Pick an era" : "Era"}</option>
                  {(nowPhase?.eras || []).map(e => <option key={e.key} value={e.key}>{e.name}</option>)}
                </MiniSelect>
              </div>
              {planner.nowError && <div style={{ padding: `0 ${SPACING.rowSide}px 10px`, fontSize: SPACING.listMeta, color: C.red }}>{planner.nowError}</div>}
              {nowEra ? nowRows()
                : <div style={{ padding: `12px ${SPACING.rowSide}px`, borderTop: `1px solid ${C.hair}`, fontSize: TYPE.subtext.size, color: C.muted, lineHeight: 1.4 }}>
                    {nowPhase ? "Pick the era you're in: its arcs show here." : "Pick the phase and era you're in: its arcs show here."}
                  </div>}
            </>)}
          </>}

          {toPost.length > 0 && <>
            {listHead("post", "To post", toPost.length, PAL.waiting.mid, "tick = posted")}
            {!folded.post && card(toPost.map((it, k) => row(it, k, { day: it.plan?.filmedOn ? `filmed ${shortDate(it.plan.filmedOn)}` : "filmed",
              tick: { on: false, tone: PAL.done, label: `Posted: ${it.title}`, run: () => go(it, "posted") } })))}
          </>}

          {toShoot.length > 0 && <>
            {listHead("shoot", "To shoot", toShoot.length, PAL.progress.mid, "tick = filmed")}
            {!folded.shoot && card(toShoot.map((it, k) => row(it, k, { right: datePick(it),
              tick: { on: false, tone: PAL.waiting, label: `Filmed: ${it.title}`, run: () => go(it, "shot") } })))}
          </>}
          </>} right={<>
          {listHead("ideas", hasPhases ? (show === "editorial" ? "Saved portfolio ideas" : "Saved ideas") : (show === "editorial" ? "Portfolio ideas" : "Ideas"),
            saved.length, PAL.neutral.mid, undefined, () => setAdding(n => n + 1))}
          {!folded.ideas && (saved.length || adding
            ? card(<>{addRow}{hasPhases
                ? savedGroups.map((g, gi) => (
                    <div key={g.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: `9px ${SPACING.rowSide}px 3px`, borderTop: gi || adding ? `1px solid ${C.hair}` : "none",
                        fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.light }}>
                        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: g.dot, flexShrink: 0 }} />{g.label} · {g.items.length}
                      </div>
                      {g.items.map((it, k) => row(it, k, { right: nowEra ? useNowBtn(it) : shootBtn(it), meta: conceptMeta(it) }))}
                    </div>
                  ))
                : saved.map((it, k) => row(it, k + (adding ? 1 : 0), { right: shootBtn(it) }))}</>)
            : emptyNote(hasPhases ? "No saved ideas. Tap + Add." : "No ideas yet. Tap + Add."))}

          {postedL.length > 0 && <>
            {listHead("posted", "Posted", postedL.length, PAL.done.mid)}
            {!folded.posted && card(postedL.map((it, k) => row(it, k, { day: it.postedOn ? `posted ${shortDate(it.postedOn)}` : "posted",
              tick: { on: true, tone: PAL.done, label: `Posted: ${it.title}`, run: () => go(it, "shot") } })))}
          </>}
          </>} />
        </>
      )}

      {open && <ItemWindow key={open} planner={planner} itemId={open} isMobile={isMobile} onClose={() => setOpen(null)} />}
    </div>
  );
}
