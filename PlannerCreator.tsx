// ─────────────────────────────────────────────────────────────
// PlannerCreator — Planner › Creator (your workspace), one account.
// The two lists lead the page:
//   Concept (written once, typed in place)
//   Content ideas · quick add, one row each
//   Editorial list · quick add, first set and the month goal in
//     its header
// Every row: title, then format · date · clips · links. Tap the
// status word to switch it; tap the row to open its plan
// (storyline, clips to shoot, reference links).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, BAR_BTN } from "./atoms";
import { parseYMD, monthStart, monthEnd } from "./formatters";
import {
  FORMATS, CLASSIC, OWNER_LOOK, TONE, isVisible, itemOrder, monthName, entryKey, goalStatus, monthGoalOf, thisMonday, storyLines,
} from "./planner";
import type { Account, Item, ItemList, ItemStatus, Task } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Subtitle, ItemWindow, InlineText } from "./PlannerWindows";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.creator;
const AMBER = "#b07a4a";
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortDate = (d: string) => { const dt = parseYMD(d); return dt ? `${WD[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.` : ""; };
// tap the status word: idea → planned → shot → posted → idea (In kit is the manager's step)
const NEXT: Record<ItemStatus, ItemStatus> = { idea: "planned", planned: "shot", shot: "posted", posted: "idea", in_kit: "in_kit" };
const WORD: Record<ItemStatus, string> = { idea: "Idea", planned: "Planned", shot: "Shot", posted: "Posted", in_kit: "In kit ✓" };

interface PlannerCreatorProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  openCatalog?: () => void;
  openTab?:  (tab: string, anchor?: string) => void;
  openOutreach?: () => void;
}

export default function PlannerCreator({ planner, view, isMobile }: PlannerCreatorProps) {
  const { tasks, stages, items, loading, loadError } = planner;
  const [open, setOpen] = useState<string | null>(null);
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const now = thisMonday();
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const conceptTask = visible.find(t => t.area === "concept" && t.phase !== "maintain" && t.account === acc);
  const firstSet    = visible.find(t => t.source === "portfolio_total" && t.account === acc);
  const ideasTask   = visible.find(t => t.source === "ideas" && t.account === acc);
  const monthTask   = visible.find(t => t.rhythm === "monthly" && t.area === "portfolio" && t.account === acc)
                   || visible.find(t => t.rhythm === "monthly" && t.area === "portfolio");
  const mine = items.filter(i => i.account === acc);
  const isOpen = (i: Item) => i.status === "idea" || i.status === "planned" || i.status === "shot";
  const isLynn = acc === "lynnhoa";

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const band = (title: string, right?: any) => (
    <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: look.color }} />{title}</span>
      {right}
    </div>
  );
  const tag = (t: string, color: string = C.muted) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>{t}</span>;
  const taskWord = (t?: Task) => !t ? null : planner.doneOf(t)
    ? tag(t.phase === "refine" ? "Settled ✓" : "Done ✓", C.green)
    : tag(t.phase === "refine" ? "Refining" : t.status === "in_progress" ? "In progress" : "Open", look.color);

  // one row: title + status word, then format · date · clips · links
  const row = (it: Item) => {
    const done = !isOpen(it);
    const clips = it.plan.clips.length, shot = it.plan.clips.filter(c => c.done).length, refs = it.plan.refs.length;
    const meta: { t: string; c?: string }[] = [];
    if (it.list === "editorial" || it.format !== CLASSIC) meta.push({ t: it.format });
    if (done && it.postedOn) meta.push({ t: `Posted ${shortDate(it.postedOn)}` });
    else if (it.plannedOn) meta.push({ t: shortDate(it.plannedOn) });
    if (clips) meta.push({ t: `${shot}/${clips} clips`, c: shot === clips ? C.green : undefined });
    if (refs) meta.push({ t: `${refs} ${refs === 1 ? "link" : "links"}` });
    if (it.list === "editorial" && !done && storyLines(it.direction).length === 0) meta.push({ t: "Needs storyline", c: AMBER });
    const color = it.status === "posted" || it.status === "in_kit" ? C.green : it.status === "idea" ? C.muted : C.black;
    return (
      <div key={it.id} className="lh-prow" role="button" tabIndex={0} onClick={() => setOpen(it.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(it.id); }}
        style={{ minHeight: 48, display: "flex", alignItems: "center", gap: 8, padding: "7px 6px 7px 12px", borderTop: "1px solid #f0ece7", cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: done ? C.light : C.black }}>{it.title}</div>
          {meta.length > 0 && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {meta.map((m, k) => <span key={k} style={{ color: m.c || C.muted }}>{k ? " · " : ""}{m.t}</span>)}
            </div>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); if (it.status !== "in_kit") quiet(planner.setItemStatus(it, NEXT[it.status])); }}
          title={it.status === "in_kit" ? "In the kit" : "Tap to switch: idea → planned → shot → posted"} aria-label={`Status: ${WORD[it.status]}`}
          style={{ background: "none", border: "none", cursor: it.status === "in_kit" ? "default" : "pointer", padding: "10px 6px", fontFamily: SANS, flexShrink: 0 }}>
          {tag(WORD[it.status], color)}
        </button>
      </div>
    );
  };
  const quickAdd = (list: ItemList, placeholder: string) => <QuickAdd placeholder={placeholder} onAdd={(title) => quiet(planner.createItem({
    list, account: acc, title, status: "idea", plannedOn: null, views: null, link: "", direction: "",
    format: list === "editorial" ? FORMATS[acc][0] : CLASSIC, portfolio: list === "editorial",
  }))} />;
  const listCard = (id: string, title: string, right: any, list: Item[], addList: ItemList, placeholder: string, empty: string) => {
    const openOnes = list.filter(isOpen), doneOnes = list.filter(i => !isOpen(i));
    const showing = !!showDone[id];
    return (
      <div id={id} style={card}>
        {band(title, right)}
        {quickAdd(addList, placeholder)}
        {openOnes.length === 0 && doneOnes.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0, padding: "10px 12px", borderTop: "1px solid #f0ece7" }}>{empty}</p>}
        {openOnes.map(row)}
        {doneOnes.length > 0 && (
          <button onClick={() => setShowDone(m => ({ ...m, [id]: !m[id] }))} aria-expanded={showing}
            style={{ width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: "1px solid #f0ece7", background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: C.green }}>✓</span>Posted · {doneOnes.length}</span>
            <Ico d={showing ? IC.up : IC.down} size={14} />
          </button>
        )}
        {showing && doneOnes.map(row)}
      </div>
    );
  };

  // ── concept (written once) ──────────────────────────────────
  const concept = planner.noteOf(acc, "concept");
  const conceptCard = (
    <div id="card-concept" style={card}>
      {band(isLynn ? "Social concept · with your manager" : "Concept", taskWord(conceptTask))}
      <div style={{ padding: "8px 12px 10px" }}>
        <InlineText multiline value={concept?.body || ""} ariaLabel="Concept"
          placeholder={isLynn ? "Tap to write the base concept and which TikTok." : "Tap to write the concept overview."}
          onSave={v => quiet(planner.saveNote(acc, "concept", null, { body: v }))} />
      </div>
    </div>
  );

  // ── content ideas ───────────────────────────────────────────
  const iSt = ideasTask ? planner.stateOf(ideasTask, now) : null;
  const iStatus = ideasTask && iSt ? goalStatus(ideasTask, iSt, now) : null;
  const ideas = mine.filter(i => i.list === "idea").sort(itemOrder);
  const ideasRight = iSt && iStatus
    ? <span style={{ display: "inline-flex", gap: 6, whiteSpace: "nowrap" as const }}><span style={{ color: C.black }}>{iSt.actual ?? 0} / {iSt.target ?? "–"}</span>{tag(iStatus.text, TONE[iStatus.tone])}</span>
    : null;

  // ── editorial list (first set + month goal in its header) ───
  const eds = mine.filter(i => i.list === "editorial").sort(itemOrder);
  const fs = firstSet ? planner.stateOf(firstSet, now) : null;
  const ms = monthStart(now), me = monthEnd(now);
  const goal = monthTask ? (monthTask.account === "both" ? monthGoalOf(monthTask, planner.entries[entryKey(monthTask.id, ms)], acc) : planner.targetOf(monthTask.id, ms)) : null;
  const doneMonth = mine.filter(i => i.portfolio && (i.status === "posted" || i.status === "in_kit") && !!i.postedOn && i.postedOn >= ms && i.postedOn <= me).length;
  const edRight = (
    <span style={{ display: "inline-flex", gap: 8, whiteSpace: "nowrap" as const, color: C.black, overflow: "hidden" }}>
      {fs && !fs.done && <span>First set {fs.actual ?? 0} / {fs.target ?? "–"}</span>}
      <span style={{ color: goal != null && doneMonth >= goal ? C.green : C.black }}>{monthName(now).slice(0, 3)} {doneMonth} / {goal ?? "–"}</span>
    </span>
  );

  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Creator</h2>
      <Subtitle acc={acc} text="Your workspace" />

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {conceptCard}
          {listCard("card-ideas", "Content ideas", ideasRight, ideas, "idea", "New idea", "No ideas yet. Type your first one above.")}
          {listCard("card-editorial", "Editorial list", edRight, eds, "editorial", "New editorial", "No editorials yet. Add your first portfolio piece above.")}
        </>
      )}

      {open && <ItemWindow key={open} planner={planner} itemId={open} isMobile={isMobile} onClose={() => setOpen(null)} />}
    </div>
  );
}

// quick add at the top of a list: Enter adds and stays ready for the next
function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => void }) {
  const [t, setT] = useState("");
  const add = () => { const v = t.trim(); if (!v) return; setT(""); onAdd(v); };
  return (
    <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderTop: "1px solid #f0ece7" }}>
      <input value={t} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        style={{ flex: 1, minWidth: 0, height: 36, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "0 10px", fontFamily: SANS, fontSize: 14, outline: "none", boxSizing: "border-box" as const, background: C.white }} />
      <B v="sec" onClick={add} s={{ ...BAR_BTN, height: 36, minHeight: 36, color: C.black, flexShrink: 0 }}>Add</B>
    </div>
  );
}
