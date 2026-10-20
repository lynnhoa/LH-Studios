// ─────────────────────────────────────────────────────────────
// PlannerCreator — Planner › Creator (the creator's workspace):
// the content plan, ordered by what to do next.
//   Week strip · ideas, posts, pieces, month goal and first set
//   All / Content / Editorials
//   Concept (one line, opens on tap)
//   To shoot · dated, nearest first; tick the box = filmed
//   Ideas     · quick add; Plan › gives one a date
//   History   · folded; filmed ones, tap Posted once it's live
// Tap any row to open its plan (storyline, clips, references).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, PAL } from "./constants";
import { B, Tick, BAR_BTN } from "./atoms";
import { parseYMD, monthStart, monthEnd, today } from "./formatters";
import {
  FORMATS, CLASSIC, OWNER_LOOK, TONE, isVisible, monthName, entryKey, monthGoalOf, monthGoalPatch, thisMonday, storyLines, isoWeek,
  CREATOR_GOAL, creatorOrder, shortName, parseIntDe,
} from "./planner";
import type { Account, Item, ItemList, Task } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Subtitle, TabTitle, ItemWindow, InlineText, GoalNum, useGuide, GuideBtn, GuideCard, ResultMark } from "./PlannerWindows";
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
  const [history, setHistory] = useState(false);
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
  const mine = items.filter(i => i.account === acc && (show === "all" || i.list === show));
  const toShoot = mine.filter(i => i.status === "planned" || (i.status === "idea" && !!i.plannedOn))
    .sort((a, b) => (a.plannedOn || "9999").localeCompare(b.plannedOn || "9999"));
  const ideas   = mine.filter(i => i.status === "idea" && !i.plannedOn).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done    = mine.filter(i => i.status === "shot" || i.status === "posted" || i.status === "in_kit")
    .sort((a, b) => String(b.postedOn || b.plan.filmedOn || "").localeCompare(String(a.postedOn || a.plan.filmedOn || "")));
  const postedN = done.filter(i => i.status !== "shot").length;

  // ── actions ─────────────────────────────────────────────────
  const filmed   = (it: Item) => quiet(planner.setItemStatus(it, "shot"));
  const unfilm   = (it: Item) => quiet(planner.setItemStatus(it, "planned"));
  const posted   = (it: Item) => quiet(planner.setItemStatus(it, it.status === "shot" ? "posted" : "shot"));
  const remove   = (it: Item) => { quiet(planner.deleteItem(it.id)); showUndo(`${it.list === "editorial" ? "Editorial" : "Idea"} deleted`, () => planner.restoreItem(it)); };
  const addItem  = (title: string) => {
    const list: ItemList = show === "editorial" ? "editorial" : "idea";
    quiet(planner.createItem({ list, account: acc, title, status: "idea", plannedOn: null, views: null, link: "", direction: "",
      format: list === "editorial" ? FORMATS[acc][0] : CLASSIC, portfolio: list === "editorial" }));
  };

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, marginTop: 10, overflow: "hidden" };
  const band = (icon: string, title: string, right?: any) => (
    <div style={{ minHeight: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: C.white, color: PAL.neutral.ink, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Ico d={icon} size={13} color={look.color} />{title}</span>
      {right != null && <span style={{ color: C.muted }}>{right}</span>}
    </div>
  );
  const edChip = (it: Item) => show === "all" && it.list === "editorial"
    ? <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 10, background: "#f0f0f5", color: "#6a6aaa", border: "1px solid #c8c8e0", marginLeft: 6, verticalAlign: 1 }}>EDITORIAL</span> : null;
  const metaLine = (parts: { t: string; c?: string }[]) => parts.length === 0 ? null : (
    <div style={{ fontSize: 12, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
      {parts.map((m, k) => <span key={k} style={{ color: m.c || C.muted }}>{k ? " · " : ""}{m.t}</span>)}
    </div>
  );
  const planParts = (it: Item) => {
    const p: { t: string; c?: string }[] = [];
    const clips = it.plan.clips.length, shot = it.plan.clips.filter(c => c.done).length, refs = it.plan.refs.length;
    if (clips) p.push({ t: `${shot}/${clips} clips`, c: shot === clips ? C.green : undefined });
    if (refs) p.push({ t: `${refs} ${refs === 1 ? "link" : "links"}` });
    if (it.list === "editorial" && storyLines(it.direction).length === 0) p.push({ t: "needs storyline", c: AMBER });
    return p;
  };
  const rowS: any = { minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: 10, padding: "5px 4px 5px 12px", borderTop: `1px solid ${C.hair}`, cursor: "pointer" };
  const title = (it: Item, muted = false) => (
    <div style={{ fontSize: SPACING.listText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: muted ? C.muted : C.black }}>{it.title}{edChip(it)}</div>
  );

  // ── this week's goals: Done (counted from the plan) | Goal (locked; Edit goals opens them) ──
  const [editGoals, setEditGoals] = useState(false);
  const GRID = "92px 56px 56px minmax(0,1fr)";
  const over = false;   // Creator always shows this week
  const fsT = visible.find(t => t.source === "portfolio_total" && t.account === acc);
  const fs = fsT ? planner.stateOf(fsT, now) : null;
  const ms = monthStart(now), me = monthEnd(now);
  const monthEntry = monthTask ? planner.entries[entryKey(monthTask.id, ms)] : undefined;
  const goal = monthTask ? (monthTask.account === "both" ? monthGoalOf(monthTask, monthEntry, acc) : planner.targetOf(monthTask.id, ms)) : null;
  const doneMonth = items.filter(i => i.account === acc && i.portfolio && (i.status === "posted" || i.status === "in_kit") && !!i.postedOn && i.postedOn >= ms && i.postedOn <= me).length;
  const goalField = (value: number | null, label: string, onSave: (v: number | null) => void) => (
    <input key={`${label}-${value}`} inputMode="numeric" defaultValue={value ?? ""} placeholder="–" aria-label={label} onFocus={(e) => e.target.select()}
      onBlur={(e) => { const v = e.target.value.trim() === "" ? null : parseIntDe(e.target.value); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{ width: "100%", height: SPACING.rowField, border: `1px solid ${C.field}`, borderRadius: RADIUS.field - 2, padding: "0 7px", textAlign: "right" as const, fontFamily: SANS, fontSize: 13, background: C.white, boxSizing: "border-box" as const }} />
  );
  const num = (v: any, muted = false, color?: string) => <span style={{ textAlign: "right" as const, paddingRight: 8, fontSize: 13, color: color || (muted ? C.light : C.black) }}>{v ?? "–"}</span>;
  const goalLine = (key: string, icon: string, name: string, done: number, target: number | null, onGoal: (v: number | null) => void, mark: any) => (
    <div key={key} style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", columnGap: 8, padding: "0 12px", minHeight: SPACING.row1, borderTop: `1px solid ${C.hair}`, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Ico d={icon} size={13} color={look.color} />{name}</span>
      {num(done)}
      {editGoals ? goalField(target, `Goal for ${name}`, onGoal) : num(target, target == null)}
      <span style={{ display: "flex", justifyContent: "flex-end" }}>{mark}</span>
    </div>
  );
  const markFor = (done: number, target: number | null, isOver: boolean) =>
    target == null ? <ResultMark state="none" text="No goal set" />
      : done >= target ? <ResultMark state="reached" />
      : <ResultMark state={isOver ? "missed" : "togo"} text={isOver ? `−${target - done}` : `${target - done} to go`} />;
  const weekGoals = visible.filter(t => CREATOR_GOAL(t) && (t.account === acc || t.account === "both")).sort((a, b) => creatorOrder(a) - creatorOrder(b));
  const ICON_OF = (t: Task) => (t.source === "ideas" ? IC.spark : t.source === "filmed" ? IC.camera : t.source === "posts" ? IC.send : IC.bulb);
  const reached = weekGoals.filter(t => planner.stateOf(t, now).done).length;
  const strip = (
    <div id="card-goals-creator" style={{ ...card, marginTop: 12 }}>
      <div style={{ minHeight: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: C.white, color: PAL.neutral.ink, ...microLabel }}>
        <span>This week's goals</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: weekGoals.length && reached === weekGoals.length ? C.green : C.black }}>{reached} of {weekGoals.length} reached</span>
          <button onClick={() => setEditGoals(e => !e)} aria-pressed={editGoals}
            style={{ height: 22, padding: "0 7px", borderRadius: 2, border: `1px solid ${editGoals ? C.black : C.rule}`, background: editGoals ? C.black : C.white, color: editGoals ? C.white : C.black, fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer" }}>
            {editGoals ? "Done" : "Edit goals"}
          </button>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 8, padding: "0 12px", minHeight: 24, alignItems: "center", background: C.bg, fontSize: TYPE.micro.size, letterSpacing: "0.1em", color: C.muted }}>
        <span /><span style={{ textAlign: "right" as const, paddingRight: 8 }}>DONE</span><span style={{ textAlign: "right" as const, paddingRight: 8, color: editGoals ? look.color : C.muted, display: "inline-flex", justifyContent: "flex-end", alignItems: "center", gap: 3 }}>{!editGoals && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" aria-hidden="true"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>}GOAL</span><span />
      </div>
      {weekGoals.map(t => {
        const s0 = planner.stateOf(t, now);
        return goalLine(t.id, ICON_OF(t), shortName(t), s0.actual ?? 0, s0.target, v => quiet(planner.saveEntry(t.id, now, { target: v })), markFor(s0.actual ?? 0, s0.target, over));
      })}
      {monthTask && goalLine("month", IC.history, monthName(now), doneMonth, goal,
        v => quiet(planner.saveEntry(monthTask.id, ms, monthTask.account === "both" ? monthGoalPatch(monthTask, monthEntry, acc, v) : { target: v })),
        markFor(doneMonth, goal, false))}
      {fsT && fs && goalLine("firstset", IC.camera, "First set", fs.actual ?? 0, fsT.target ?? null,
        v => quiet(planner.updateTask(fsT.id, { target: v })),
        fs.done ? <ResultMark state="reached" /> : fsT.target != null ? <ResultMark state="togo" text={`${(fsT.target ?? 0) - (fs.actual ?? 0)} to go`} /> : <ResultMark state="none" text="No goal set" />)}
      <div style={{ padding: "6px 12px", borderTop: `1px solid ${C.hair}`, background: C.bg, fontSize: 11, color: C.muted }}>Counted from the content plan · {monthName(now)}{fsT && fs ? " and First set are" : " counts"} portfolio pieces</div>
    </div>
  );

  // ── switch ──────────────────────────────────────────────────
  const switcher = (
    <div role="tablist" aria-label="Show" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", marginTop: 10, border: `1px solid ${C.rule}`, borderRadius: 2, background: C.white, overflow: "hidden" }}>
      {([["all", "All"], ["idea", "Content"], ["editorial", "Editorials"]] as [Show, string][]).map(([k, l], i) => (
        <button key={k} role="tab" aria-selected={show === k} onClick={() => setShow(k)}
          style={{ height: 30, border: "none", borderLeft: i ? `1px solid ${C.rule}` : "none", background: show === k ? PAL.neutral.fill : C.white, color: show === k ? C.black : C.muted, fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer" }}>{l}</button>
      ))}
    </div>
  );

  // ── concept (one line, opens on tap) ────────────────────────
  const note = planner.noteOf(acc, "concept");
  const conceptWord = conceptTask ? (planner.doneOf(conceptTask) ? (conceptTask.phase === "refine" ? "Settled ✓" : "Done ✓") : conceptTask.phase === "refine" ? "Refining" : "Open") : "";
  const conceptCard = (
    <div id="card-concept" style={card}>
      <button onClick={() => setConcept(o => !o)} aria-expanded={concept}
        style={{ width: "100%", minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
        <Ico d={IC.bulb} size={14} color={look.color} />
        <span style={{ ...microLabel, color: look.color, flexShrink: 0 }}>{isLynn ? "Social concept" : "Concept"}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: note?.body ? C.black : C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {concept ? conceptWord : (note?.body || "Tap to write it")}
        </span>
        <Ico d={concept ? IC.up : IC.down} size={13} color={C.light} />
      </button>
      {concept && (
        <div style={{ padding: "0 12px 10px" }}>
          <InlineText multiline value={note?.body || ""} ariaLabel="Concept" autoFocus={!note?.body}
            placeholder={isLynn ? "The base concept and which TikTok." : "The concept overview."}
            onSave={v => quiet(planner.saveNote(acc, "concept", null, { body: v }))} />
        </div>
      )}
    </div>
  );

  // ── To shoot ────────────────────────────────────────────────
  const shootRow = (it: Item) => {
    const d = it.plannedOn;
    const when = !d ? null : d === td ? { t: "Today", c: AMBER } : d < td ? { t: `Overdue · ${shortDate(d)}`, c: AMBER } : { t: shortDate(d) };
    return (
      <div key={it.id} className="lh-prow" role="button" tabIndex={0} onClick={() => setOpen(it.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(it.id); }} style={rowS}>
        <span onClick={(e) => e.stopPropagation()}><Tick on={false} color={C.green} size={22} onClick={() => filmed(it)} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>{title(it)}{metaLine([...(when ? [when] : []), ...planParts(it)])}</div>
        <XBtn label={`Delete ${it.title}`} onClick={() => remove(it)} />
      </div>
    );
  };
  const shootCard = (
    <div id="card-shoot" style={{ ...card, boxShadow: "0 6px 18px rgba(26,26,26,0.06)", borderColor: look.border }}>
      {band(IC.camera, `To shoot · ${toShoot.length}`, "Tick = filmed")}
      {toShoot.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0, padding: "10px 12px", borderTop: `1px solid ${C.hair}` }}>Nothing planned. Give an idea a date with Plan ›.</p>}
      {toShoot.map(shootRow)}
    </div>
  );

  // ── Ideas ───────────────────────────────────────────────────
  const ideaRow = (it: Item) => (
    <div key={it.id} className="lh-prow" role="button" tabIndex={0} onClick={() => setOpen(it.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(it.id); }} style={{ ...rowS, minHeight: SPACING.row1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>{title(it)}{metaLine(planParts(it))}</div>
      <span style={{ ...microLabel, color: C.black, flexShrink: 0 }}>Plan ›</span>
      <XBtn label={`Delete ${it.title}`} onClick={() => remove(it)} />
    </div>
  );
  const ideasCard = (
    <div id="card-ideas" style={card}>
      {band(IC.spark, `${show === "editorial" ? "Editorial ideas" : "Ideas"} · ${ideas.length}`, "Plan = give it a date")}
      <QuickAdd placeholder={show === "editorial" ? "New editorial" : "New idea"} onAdd={addItem} />
      {ideas.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0, padding: "0 12px 10px" }}>No ideas yet. Add one above.</p>}
      {ideas.map(ideaRow)}
    </div>
  );

  // ── History (folded) ────────────────────────────────────────
  const historyRow = (it: Item) => {
    const isPosted = it.status !== "shot";
    const parts: { t: string; c?: string }[] = [{ t: it.plan.filmedOn ? `Filmed ${shortDate(it.plan.filmedOn)}` : "Filmed" }];
    if (isPosted && it.postedOn) parts.push({ t: `posted ${it.postedOn.slice(8, 10)}.${it.postedOn.slice(5, 7)}.` });
    return (
      <div key={it.id} className="lh-prow" role="button" tabIndex={0} onClick={() => setOpen(it.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(it.id); }} style={{ ...rowS, minHeight: 44 }}>
        <span onClick={(e) => e.stopPropagation()}><Tick on={true} color={C.green} size={22} onClick={() => unfilm(it)} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>{title(it, true)}{metaLine(parts)}</div>
        <button onClick={(e) => { e.stopPropagation(); posted(it); }} aria-pressed={isPosted} title={isPosted ? "Tap to undo" : "Tap once it's live"}
          style={isPosted
            ? { background: "none", border: "none", padding: "6px 2px", cursor: "pointer", fontFamily: SANS, ...microLabel, color: C.green, flexShrink: 0 }
            : { ...BAR_BTN, height: 26, minHeight: 26, padding: "0 8px", border: `1px solid ${C.rule}`, borderRadius: 2, background: C.white, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.black, flexShrink: 0 }}>
          {isPosted ? "Posted ✓" : "Posted"}
        </button>
        <XBtn label={`Delete ${it.title}`} onClick={() => remove(it)} />
      </div>
    );
  };
  const historyCard = done.length > 0 && (
    <div style={card}>
      <button onClick={() => setHistory(o => !o)} aria-expanded={history}
        style={{ width: "100%", minHeight: SPACING.row1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: C.bg, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Ico d={IC.history} size={14} />History · {done.length} filmed · {postedN} posted</span>
        <Ico d={history ? IC.up : IC.down} size={13} color={C.light} />
      </button>
      {history && done.map(historyRow)}
    </div>
  );

  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>
      <TabTitle title="Creator" acc={acc} onAccount={onAccount} isMobile={isMobile} right={<GuideBtn on={guide.open} onClick={guide.toggle} />} />
      <Subtitle text={`Creator's workspace · week ${isoWeek(now)}`} />
      {guide.open && <GuideCard onClose={guide.close} steps={[
        "Add ideas. Tap Plan to give one a date, and it moves to To shoot.",
        "On shooting day, open it for the storyline and clips, then tick the box: filmed.",
        "In History, tap Posted once it's live. That counts for posts and pieces.",
      ]} />}

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {strip}
          {switcher}
          {conceptCard}
          {shootCard}
          {ideasCard}
          {historyCard}
        </>
      )}

      {open && <ItemWindow key={open} planner={planner} itemId={open} isMobile={isMobile} onClose={() => setOpen(null)} />}
    </div>
  );
}

// quick add at the top of the ideas: Enter adds and stays ready for the next
function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => void }) {
  const [t, setT] = useState("");
  const add = () => { const v = t.trim(); if (!v) return; setT(""); onAdd(v); };
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 12px" }}>
      <input value={t} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        style={{ flex: 1, minWidth: 0, height: 34, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "0 10px", fontFamily: SANS, fontSize: 14, outline: "none", boxSizing: "border-box" as const, background: C.white }} />
      <B v="sec" onClick={add} s={{ ...BAR_BTN, height: 34, minHeight: 34, color: C.black, flexShrink: 0 }}>Add</B>
    </div>
  );
}
