// ─────────────────────────────────────────────────────────────
// PlannerCreator — Planner › Creator (your workspace), one account.
// Same slim cards as To-do, everything typed in place:
//   Concept · Offer (→ Service Catalog)
//   Portfolio · first set (counts itself) and this month's goal
//   Editorial list · tap one to open it (creative direction)
//   Content ideas · one line each; tap the status word to switch
//     Idea → Planned → Posted; quick add; posted ones fold away
//   Weekly learning · top post and one learning
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { B, BAR_BTN } from "./atoms";
import { parseYMD, monthStart, monthEnd } from "./formatters";
import {
  FORMATS, CLASSIC, OWNER_LOOK, TONE, isVisible, itemOrder, monthName, weekRange, entryKey, goalStatus, monthGoalOf, monthGoalPatch,
} from "./planner";
import type { Account, Item, ItemList, ItemStatus, Task } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { Ico, IC, Bar, Toolbar, Subtitle, FormatChip, ItemWindow, InlineText, NumField } from "./PlannerWindows";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.creator;
const AMBER = "#b07a4a";
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortDate = (d: string) => { const dt = parseYMD(d); return dt ? `${WD[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.` : ""; };
const NEXT_IDEA: Record<string, ItemStatus> = { idea: "planned", planned: "posted", shot: "posted", posted: "idea", in_kit: "in_kit" };

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

export default function PlannerCreator({ planner, view, monday, setMonday, isMobile, openCatalog }: PlannerCreatorProps) {
  const { tasks, stages, items, loading, loadError } = planner;
  const [open, setOpen] = useState<{ id?: string; draft?: Partial<Item> } | null>(null);
  const [showPostedEd, setShowPostedEd] = useState(false);
  const [showPostedId, setShowPostedId] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const conceptTask = visible.find(t => t.area === "concept" && t.phase !== "maintain" && t.account === acc);
  const offerTask   = visible.find(t => t.area === "offer" && t.phase !== "maintain" && t.account === acc);
  const firstSet    = visible.find(t => t.source === "portfolio_total" && t.account === acc);
  const ideasTask   = visible.find(t => t.source === "ideas" && t.account === acc);
  const monthTask   = visible.find(t => t.rhythm === "monthly" && t.area === "portfolio" && t.account === acc)
                   || visible.find(t => t.rhythm === "monthly" && t.area === "portfolio");
  const mine = items.filter(i => i.account === acc);
  const isOpen = (i: Item) => i.status === "idea" || i.status === "planned" || i.status === "shot";
  const eds   = mine.filter(i => i.list === "editorial").sort(itemOrder);
  const ideas = mine.filter(i => i.list === "idea").sort(itemOrder);
  const isLynn = acc === "lynnhoa";

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const band = (title: string, right?: any) => (
    <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: look.color }} />{title}</span>
      {right}
    </div>
  );
  const body: any = { padding: "10px 12px 12px" };
  const rowS: any = { minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderTop: "1px solid #f0ece7" };
  const tag = (t: string, color: string = C.muted) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>{t}</span>;
  const taskWord = (t?: Task) => !t ? null : planner.doneOf(t)
    ? tag(t.phase === "refine" ? "Settled ✓" : "Done ✓", C.green)
    : tag(t.phase === "refine" ? "Refining" : t.status === "in_progress" ? "In progress" : "Open", look.color);
  const foldBtn = (n: number, openState: boolean, toggle: () => void, label: string) => (
    <button onClick={toggle} aria-expanded={openState}
      style={{ width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", border: "none", borderTop: "1px solid #f0ece7", background: "#fcfbf9", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: C.green }}>✓</span>{label} · {n}</span>
      <Ico d={openState ? IC.up : IC.down} size={14} />
    </button>
  );

  // ── concept and offer (typed in place) ──────────────────────
  const concept = planner.noteOf(acc, "concept");
  const offer   = planner.noteOf(acc, "offer");
  const noteCard = (id: string, title: string, task: Task | undefined, text: string, placeholder: string, kind: "concept" | "offer", extra?: any) => (
    <div id={id} style={card}>
      {band(title, taskWord(task))}
      <div style={{ ...body, paddingLeft: 12, paddingRight: 12 }}>
        <InlineText multiline value={text} placeholder={placeholder} ariaLabel={title} onSave={v => quiet(planner.saveNote(acc, kind, null, { body: v }))} />
        {extra}
      </div>
    </div>
  );

  // ── portfolio ───────────────────────────────────────────────
  const ms = monthStart(monday), me = monthEnd(monday);
  const monthEntry = monthTask ? planner.entries[entryKey(monthTask.id, ms)] : undefined;
  const goal = monthTask ? (monthTask.account === "both" ? monthGoalOf(monthTask, monthEntry, acc) : planner.targetOf(monthTask.id, ms)) : null;
  const doneMonth = mine.filter(i => i.portfolio && (i.status === "posted" || i.status === "in_kit") && !!i.postedOn && i.postedOn >= ms && i.postedOn <= me).length;
  const fs = firstSet ? planner.stateOf(firstSet, monday) : null;
  const portfolioCard = (
    <div id="card-portfolio" style={card}>
      {band("Portfolio", <span>{fs && !fs.done ? "Build phase" : "Maintain"}</span>)}
      <div style={body}>
        {fs && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>First set</span><span style={{ color: fs.done ? C.green : C.black }}>{fs.actual ?? 0} / {fs.target ?? "–"}{fs.done ? " ✓" : ""}</span></div>
            <Bar value={fs.actual ?? 0} max={fs.target ?? 0} done={fs.done} color={look.color} track={look.border} h={4} />
          </>
        )}
        {monthTask && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, alignItems: "end", marginTop: fs ? 4 : -8 }}>
            <NumField label={`${monthName(monday)} goal`} value={goal} onSave={v => quiet(planner.saveEntry(monthTask.id, ms, monthTask.account === "both" ? monthGoalPatch(monthTask, monthEntry, acc, v) : { target: v }))} />
            <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 14, color: goal != null && doneMonth >= goal ? C.green : C.black }}>{doneMonth} posted{goal != null && doneMonth >= goal ? " ✓" : ""}</div>
          </div>
        )}
      </div>
    </div>
  );

  // ── editorial list ──────────────────────────────────────────
  const edStatus = (it: Item) => {
    if (!it.direction && (it.status === "idea" || it.status === "planned")) return tag("Needs direction", AMBER);
    if (it.status === "in_kit") return tag("In kit ✓", C.green);
    if (it.status === "posted") return tag("Posted", C.green);
    if (it.status === "planned") return tag(it.plannedOn ? shortDate(it.plannedOn) : "Planned", C.black);
    if (it.status === "shot") return tag("Shot", C.black);
    return tag("Idea");
  };
  const edRow = (it: Item) => (
    <div key={it.id} className="lh-prow" onClick={() => setOpen({ id: it.id })} style={{ ...rowS, cursor: "pointer" }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: isOpen(it) ? C.black : C.light }}>{it.title}</span>
      {it.format && isOpen(it) && <FormatChip f={it.format} />}
      {edStatus(it)}
    </div>
  );
  const newEditorial = () => setOpen({ draft: { list: "editorial" as ItemList, account: acc, format: FORMATS[acc][0], portfolio: true, direction: "", link: "", plannedOn: null, views: null } });
  const edOpen = eds.filter(isOpen), edDone = eds.filter(i => !isOpen(i));
  const editorialCard = (
    <div id="card-editorial" style={card}>
      {band("Editorial list", <button onClick={newEditorial} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, ...microLabel, color: C.black, display: "inline-flex", alignItems: "center", gap: 4 }}><Ico d={IC.plus} size={12} />Add</button>)}
      {edOpen.length === 0 && edDone.length === 0 && <div style={body}><p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No editorials yet. Add your first portfolio piece.</p></div>}
      {edOpen.map(edRow)}
      {edDone.length > 0 && foldBtn(edDone.length, showPostedEd, () => setShowPostedEd(o => !o), "Posted")}
      {showPostedEd && edDone.map(edRow)}
    </div>
  );

  // ── content ideas (one line each) ───────────────────────────
  const iSt = ideasTask ? planner.stateOf(ideasTask, monday) : null;
  const iStatus = ideasTask && iSt ? goalStatus(ideasTask, iSt, monday) : null;
  const ideaRow = (it: Item) => (
    <div key={it.id} style={{ ...rowS, paddingRight: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <InlineText value={it.title} muted={!isOpen(it)} ariaLabel={it.title}
          onSave={v => { if (!v.trim()) quiet(planner.deleteItem(it.id)); else quiet(planner.updateItem(it.id, { title: v.trim() })); }} />
      </div>
      <button onClick={() => quiet(planner.setItemStatus(it, NEXT_IDEA[it.status] || "idea"))} title="Tap to switch: idea → planned → posted"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 4px", fontFamily: SANS }}>
        {tag(it.status === "posted" || it.status === "in_kit" ? "Posted" : it.status === "planned" ? "Planned" : it.status === "shot" ? "Shot" : "Idea", it.status === "posted" || it.status === "in_kit" ? C.green : it.status === "idea" ? C.muted : C.black)}
      </button>
    </div>
  );
  const addIdea = async () => {
    const title = newIdea.trim();
    if (!title) return;
    setNewIdea("");
    await quiet(planner.createItem({ list: "idea", account: acc, title, format: CLASSIC, status: "idea", portfolio: false, direction: "", link: "", plannedOn: null, views: null }));
  };
  const idOpen = ideas.filter(isOpen), idDone = ideas.filter(i => !isOpen(i));
  const ideasCard = (
    <div id="card-ideas" style={card}>
      {band("Content ideas", iSt && iStatus ? <span style={{ display: "inline-flex", gap: 6 }}><span style={{ color: C.black }}>{iSt.actual ?? 0} / {iSt.target ?? "–"}</span>{tag(iStatus.text, TONE[iStatus.tone])}</span> : null)}
      {idOpen.map(ideaRow)}
      <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderTop: "1px solid #f0ece7" }}>
        <input value={newIdea} placeholder="New idea" aria-label="New idea" onChange={(e) => setNewIdea(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addIdea(); }}
          style={{ flex: 1, minWidth: 0, height: 36, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "0 10px", fontFamily: SANS, fontSize: 14, outline: "none", boxSizing: "border-box" as const }} />
        <B v="sec" onClick={addIdea} s={{ ...BAR_BTN, height: 36, minHeight: 36, color: C.black, flexShrink: 0 }}>Add</B>
      </div>
      {idDone.length > 0 && foldBtn(idDone.length, showPostedId, () => setShowPostedId(o => !o), "Posted")}
      {showPostedId && idDone.map(ideaRow)}
    </div>
  );

  // ── weekly learning ─────────────────────────────────────────
  const learn = planner.noteOf(acc, "learning", monday);
  const learningCard = (
    <div style={card}>
      {band("Weekly learning", <span>For the check-in</span>)}
      <div style={body}>
        <div style={{ ...microLabel, marginBottom: 4 }}>Top post</div>
        <InlineText value={learn?.title || ""} placeholder="Which post did best?" ariaLabel="Top post" onSave={v => quiet(planner.saveNote(acc, "learning", monday, { title: v }))} s={{ border: `1px solid ${C.rule}`, background: C.white }} />
        <div style={{ ...microLabel, margin: "10px 0 4px" }}>One learning</div>
        <InlineText value={learn?.body || ""} placeholder="What did it teach you?" ariaLabel="One learning" onSave={v => quiet(planner.saveNote(acc, "learning", monday, { body: v }))} s={{ border: `1px solid ${C.rule}`, background: C.white }} />
      </div>
    </div>
  );

  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Creator</h2>
      <Subtitle acc={acc} text={weekRange(monday)} />
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}><Toolbar monday={monday} setMonday={setMonday} isMobile={true} /></div>

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          {noteCard("card-concept", isLynn ? "Social concept · with your manager" : "Concept", conceptTask, concept?.body || "",
            isLynn ? "Tap to write the base concept and which TikTok." : "Tap to write the concept overview.", "concept")}
          {noteCard("card-offer", "Offer", offerTask, offer?.body || "", "Tap to write what this account sells.", "offer",
            openCatalog && <button onClick={openCatalog} style={{ marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 12, color: C.muted, display: "inline-flex", alignItems: "center", gap: 5 }}><Ico d={IC.link} size={12} />Service Catalog</button>)}
          {portfolioCard}
          {editorialCard}
          {ideasCard}
          {learningCard}
        </>
      )}

      {open && <ItemWindow key={open.id || "new"} planner={planner} itemId={open.id} draft={open.draft} isMobile={isMobile} onClose={() => setOpen(null)} />}
    </div>
  );
}
