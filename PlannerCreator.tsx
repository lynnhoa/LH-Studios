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
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, PAL, TRACK } from "./constants";
import { B, Tick, BAR_BTN, SectionHead, SummaryLine, Strong, TonedTag, Chip, ChipRow, SwitchPill, ValuePill, TextInline } from "./atoms";
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
  // ── like the mockup: master parts only ───────────────────────
  const [editGoals, setEditGoals] = useState(false);
  const fsT = visible.find(t => t.source === "portfolio_total" && t.account === acc);
  const fs = fsT ? planner.stateOf(fsT, now) : null;
  const ms = monthStart(now), me = monthEnd(now);
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
  const tile = (key: string, name: string, d: number, t: number | null, onGoal: (v: number | null) => void) => {
    const tn = tone(d, t);
    return (
      <div key={key} style={{ background: tn.wash, borderRadius: RADIUS.tile, padding: SPACING.tilePad, minWidth: 0 }}>
        <div style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: tn.ink, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, marginTop: 7, whiteSpace: "nowrap" as const }}>{d}{t != null && !editGoals && <span style={{ fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.muted }}> / {t}</span>}</div>
        {editGoals
          ? <div style={{ marginTop: 3 }}><ValuePill width={56} text={t == null ? "" : String(t)} label={`Goal for ${name}`} onCommit={(x) => { const v = x.trim() === "" ? null : parseIntDe(x); if (v !== t) onGoal(v); }} /></div>
          : <div style={{ fontSize: TYPE.label.size, color: tn.ink, marginTop: 1 }}>{subOf(d, t)}</div>}
      </div>
    );
  };
  const goalTiles = [
    ...weekGoals.map(t => { const s0 = planner.stateOf(t, now); return tile(t.id, shortName(t), s0.actual ?? 0, s0.target, v => quiet(planner.saveEntry(t.id, now, { target: v }))); }),
    ...(monthTask ? [tile("month", monthName(now), doneMonth, monthTarget, v => quiet(planner.saveEntry(monthTask.id, ms, monthTask.account === "both" ? monthGoalPatch(monthTask, monthEntry, acc, v) : { target: v })))] : []),
    ...(fsT && fs ? [tile("firstset", "First set", fs.actual ?? 0, fsT.target ?? null, v => quiet(planner.updateTask(fsT.id, { target: v })))] : []),
  ];
  const head = (label: string, right?: any, dot?: string) => <SectionHead dot={dot} label={label} right={right} />;
  const linkBtn = (label: string, fn: () => void) => (
    <button onClick={fn} style={{ background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: PAL.neutral.ink }}>{label}</button>
  );
  const card = (children: any) => <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, overflow: "hidden" }}>{children}</div>;
  const rowS = (k: number): any => ({ minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: 2, padding: `0 4px 0 ${SPACING.rowSide}px`, borderTop: k ? `1px solid ${C.hair}` : "none", boxSizing: "border-box" as const });
  const more = (it: Item) => <button onClick={() => setOpen(it.id)} aria-label={`Details for ${it.title}`} title="Details" style={{ background: "none", border: "none", width: 30, height: 44, cursor: "pointer", color: C.muted, fontSize: TYPE.body.size, flexShrink: 0 }}>⋯</button>;
  // tap the date (or Plan ›) = the iPhone's date picker, directly
  const datePick = (it: Item, children: any) => (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", minHeight: SPACING.tap, padding: "0 6px", flexShrink: 0 }}>
      {children}
      <input type="date" aria-label={`Date for ${it.title}`} value={it.plannedOn || ""} onChange={(e) => { if (e.target.value) quiet(planner.updateItem(it.id, { plannedOn: e.target.value })); }}
        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", fontSize: 16, border: "none", padding: 0 }} />
    </span>
  );
  const titleEdit = (it: Item, muted = false) => (
    <TextInline value={it.title} muted={muted} ariaLabel={it.title}
      onSave={v => { if (!v.trim()) remove(it); else quiet(planner.updateItem(it.id, { title: v.trim() })); }} />
  );
  const kindOf = (it: Item) => (it.list === "editorial" ? "Editorial" : "Content");

  const shootRow = (it: Item, k: number) => {
    const d = it.plannedOn;
    const when = !d ? "date" : d === td ? "Today" : d < td ? `Overdue · ${shortDate(d)}` : shortDate(d);
    const col = !d ? C.light : d <= td ? (d < td ? PAL.late.ink : PAL.waiting.ink) : C.muted;
    return (
      <div key={it.id} style={{ ...rowS(k), paddingLeft: 0 }}>
        <span style={{ width: SPACING.tap, height: SPACING.tap, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Tick on={false} color={PAL.done.mid} size={20} onClick={() => filmed(it)} /></span>
        {titleEdit(it)}
        {datePick(it, <span style={{ fontSize: SPACING.listMeta, color: col, whiteSpace: "nowrap" as const }}>{when}</span>)}
        {more(it)}
        <XBtn label={`Delete ${it.title}`} onClick={() => remove(it)} />
      </div>
    );
  };
  const ideaRow = (it: Item, k: number) => (
    <div key={it.id} style={rowS(k)}>
      {titleEdit(it)}
      <span style={{ fontSize: SPACING.listMeta, color: C.muted, marginLeft: 6, whiteSpace: "nowrap" as const }}>{kindOf(it)}</span>
      {datePick(it, <span style={{ fontSize: TYPE.subtext.size, color: PAL.progress.ink, whiteSpace: "nowrap" as const }}>Plan ›</span>)}
      {more(it)}
      <XBtn label={`Delete ${it.title}`} onClick={() => remove(it)} />
    </div>
  );
  const addRow = adding > 0 && (
    <div key={`add-${adding}`} style={rowS(1)}>
      <TextInline value="" placeholder={show === "editorial" ? "New editorial" : "New idea"} ariaLabel={show === "editorial" ? "New editorial" : "New idea"} autoFocus
        onSave={v => { if (v.trim()) { addItem(v.trim()); setAdding(n => n + 1); } else setAdding(0); }} />
    </div>
  );
  const historyRow = (it: Item, k: number) => {
    const isPosted = it.status !== "shot";
    const meta = `${it.plan.filmedOn ? `filmed ${shortDate(it.plan.filmedOn)}` : "filmed"}${isPosted && it.postedOn ? ` · posted ${it.postedOn.slice(8, 10)}.${it.postedOn.slice(5, 7)}.` : ""}`;
    return (
      <div key={it.id} className="lh-prow" style={{ ...rowS(k), paddingLeft: 0 }}>
        <span style={{ width: SPACING.tap, height: SPACING.tap, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Tick on={true} color={PAL.done.mid} size={20} onClick={() => unfilm(it)} /></span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" as const, overflow: "hidden" }}>
          <span style={{ fontSize: SPACING.listText, color: C.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
          <span style={{ fontSize: SPACING.listMeta, color: C.light }}>{meta}</span>
        </span>
        <button onClick={() => posted(it)} aria-pressed={isPosted} title={isPosted ? "Tap to undo" : "Tap once it's live"} style={{ background: "none", border: "none", padding: "10px 2px", cursor: "pointer", flexShrink: 0 }}>
          <TonedTag tone={isPosted ? PAL.done : PAL.neutral}>{isPosted ? "Posted ✓" : "Posted?"}</TonedTag>
        </button>
        {more(it)}
        <XBtn label={`Delete ${it.title}`} onClick={() => remove(it)} />
      </div>
    );
  };

  return (
    <div>
      <TabTitle title="Creator" acc={acc} onAccount={onAccount} isMobile={isMobile} right={<GuideBtn on={guide.open} onClick={guide.toggle} />} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: SPACING.titleToSummary }}>
        <SummaryLine dot={toShoot.length ? PAL.waiting.mid : PAL.neutral.mid}>{toShoot.length} to shoot · <Strong>{ideas.length} {ideas.length === 1 ? "idea" : "ideas"}</Strong></SummaryLine>
        <SwitchPill s={{ padding: "0 12px" }}>Week {isoWeek(now)}</SwitchPill>
      </div>
      {guide.open && <GuideCard onClose={guide.close} steps={[
        "Add ideas. Tap Plan › to give one a date, and it moves to To shoot.",
        "On shooting day tick the box: filmed. ⋯ opens the storyline and clips.",
        "In History, tap Posted once it's live. That counts for posts and pieces.",
      ]} />}
      {loading ? (
        <p style={{ fontSize: SPACING.listText, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: SPACING.listText, color: C.red, marginTop: 16 }}>{loadError}</p>
      ) : (
        <>
          {head("This week's goals", <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span>{reached} of {weekGoals.length} reached</span>{linkBtn(editGoals ? "Done" : "Edit goals", () => setEditGoals(e => !e))}</span>)}
          {goalTiles.length ? <div id="card-goals-creator" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: SPACING.gridGap }}>{goalTiles}</div>
            : <p id="card-goals-creator" style={{ fontSize: SPACING.listText, color: C.muted, margin: 0, padding: "2px 2px" }}>No goals for this account yet.</p>}
          <ChipRow s={{ marginTop: SPACING.cardGap }}>
            {([["all", "All"], ["idea", "Content"], ["editorial", "Editorials"]] as [Show, string][]).map(([k, l]) => <Chip key={k} on={show === k} tone={PAL.neutral} dot={false} label={l} onClick={() => setShow(k)} />)}
          </ChipRow>

          {head(isLynn ? "Social concept" : "Concept", conceptTask ? conceptWord : undefined)}
          {card(concept
            ? <div style={{ padding: "6px 12px 10px" }}>
                <InlineText multiline value={note?.body || ""} ariaLabel="Concept" autoFocus={!note?.body}
                  placeholder={isLynn ? "The base concept and which TikTok." : "The concept overview."}
                  onSave={v => quiet(planner.saveNote(acc, "concept", null, { body: v }))} />
                <button onClick={() => setConcept(false)} style={{ background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: PAL.neutral.ink }}>Close</button>
              </div>
            : <button onClick={() => setConcept(true)} aria-expanded={false} style={{ width: "100%", minHeight: SPACING.row1, display: "flex", alignItems: "center", padding: `0 ${SPACING.rowSide}px`, background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.listText, color: note?.body ? C.black : C.light, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{note?.body || "Tap to write it"}</span>
              </button>)}

          {head(`To shoot · ${toShoot.length}`, "tick = filmed", PAL.waiting.mid)}
          {toShoot.length ? card(toShoot.map(shootRow)) : <p style={{ fontSize: SPACING.listText, color: C.muted, margin: 0, padding: "2px 2px" }}>Nothing planned. Give an idea a date with Plan ›.</p>}

          {head(`${show === "editorial" ? "Editorial ideas" : "Ideas"} · ${ideas.length}`, linkBtn("+ Add", () => setAdding(n => n + 1)))}
          {ideas.length || adding ? card(<>{addRow}{ideas.map((it, k) => ideaRow(it, k + (adding ? 1 : 0)))}</>) : <p style={{ fontSize: SPACING.listText, color: C.muted, margin: 0, padding: "2px 2px" }}>No ideas yet. Tap + Add.</p>}

          {done.length > 0 && (
            <>
              <button onClick={() => setHistory(o => !o)} aria-expanded={history} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS }}>
                <SectionHead dot={PAL.done.mid} label={`History · ${done.length} · ${postedN} posted`} right={history ? "▴" : "▾"} />
              </button>
              {history && card(done.map(historyRow))}
            </>
          )}
        </>
      )}

      {open && <ItemWindow key={open} planner={planner} itemId={open} isMobile={isMobile} onClose={() => setOpen(null)} />}
    </div>
  );
}
