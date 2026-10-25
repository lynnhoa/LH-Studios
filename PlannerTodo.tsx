// ─────────────────────────────────────────────────────────────
// PlannerTodo — Planner › To-do: the stage you're in and its one-off
// tasks, written like iPhone Notes.
//   Stage card (name, goal, progress, the 5 stages)
//   The list: tick · edit in place · Enter adds the next row ·
//     tap the tag to switch who · ✕ deletes (Undo)
//   "Stage N done → start Stage N+1": open tasks move along, the
//     next stage starts with its prefilled list
//   Finished stages fold below
// Weekly work lives in Manager and Creator; results on Dashboard.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, PAL, TRACK } from "./constants";
import { B, Tick, ConfirmDialog, SectionHead, SummaryLine, Strong, TonedTag, Sheet, PillBtn, I, S, DashCard, TextInline, Cols, OpenArrow } from "./atoms";
import { fmtD } from "./formatters";
import { OWNER_LOOK, accLook, rowKind, stageOf, gateOf, byOrder, STAGE_SHORT, thisMonday } from "./planner";
import type { Task, AccountFilter, Owner, Phase, Account, Look, Stage } from "./planner";
import type { PlannerHook } from "./usePlanner";
import { Ico, IC, Subtitle, TabTitle, InlineText } from "./PlannerWindows";
import { showUndo, XBtn } from "./undo";

export interface PlannerView { tab: string; acc: AccountFilter; owner: "all" | Owner; phase: "all" | Phase; }
export const DEFAULT_VIEW: PlannerView = { tab: "todo", acc: "lynnhoa", owner: "all", phase: "all" };

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const ROW_RULE = "#f0ece7";
const NEXT_OWNER: Record<Owner, Owner> = { manager: "creator", creator: "both", both: "manager" };
const URL_RE = /(https?:\/\/[^\s]+)/i;

interface PlannerTodoProps {
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

export default function PlannerTodo({ planner, view, isMobile, onAccount }: PlannerTodoProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [showDone, setShowDone] = useState(false);
  const [openStage, setOpenStage] = useState<string | null>(null);   // a finished stage, folded open
  const [askNext, setAskNext] = useState(false);
  const [newRow, setNewRow] = useState(0);
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc   = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const aLook = accLook(acc);
  const mine  = stages.filter(s => s.account === acc).sort((a, b) => a.num - b.num);
  const st    = stageOf(stages, acc);
  const next  = st ? mine.find(s => s.num === st.num + 1) : undefined;
  const oneOffs = (num: number) => tasks.filter(t => t.active && t.phase !== "maintain" && t.stageNum === num && (t.account === acc || t.account === "both")).sort(byOrder);
  const list = st ? oneOffs(st.num) : [];
  const done = (t: Task) => planner.doneOf(t);
  const openOnes = list.filter(t => !done(t));
  const doneOnes = list.filter(done);
  const finished = mine.filter(s => s.status === "done" && (!st || s.num < st.num));

  // ── actions ─────────────────────────────────────────────────
  const removeTask = (t: Task) => {
    quiet(planner.updateTask(t.id, { active: false }));
    showUndo(`“${t.title.length > 28 ? t.title.slice(0, 27) + "…" : t.title}” deleted`, () => planner.updateTask(t.id, { active: true }));
  };
  const addNote = async (title: string) => {
    if (!title.trim() || !st) return;
    await quiet(planner.createTask({ title: title.trim(), account: acc, owner: "both", phase: "setup", rhythm: "once", stageNum: st.num, measure: null, how: "", doneWhen: "", link: "" }));
  };
  const finishStage = async () => {
    setAskNext(false);
    if (!st) return;
    const stage = st;
    try {
      const moved = next ? openOnes.filter(t => rowKind(t) !== "auto").map(t => t.id) : [];
      if (next) for (const id of moved) await planner.updateTask(id, { stageNum: next.num });
      await planner.startNextStage(stage, moved);
      if (next) showUndo(`Stage ${next.num} started`, () => planner.reopenStage({ ...stage, moved }));
    } catch { /* the save toast reports it */ }
  };
  const [askReopen, setAskReopen] = useState<Stage | null>(null);
  const reopen = async () => {
    const s = askReopen; setAskReopen(null);
    if (!s) return;
    try { await planner.reopenStage(s); setOpenStage(null); } catch { /* the save toast reports it */ }
  };

  // ── pieces ──────────────────────────────────────────────────
  // ── like the mockup: master parts only ───────────────────────
  const ownerLabel = (o: Owner) => OWNER_LOOK[o].label;
  const addTask = async (title: string, owner: Owner) => {
    if (!title.trim() || !st) return;
    await quiet(planner.createTask({ title: title.trim(), account: acc, owner, phase: "setup", rhythm: "once", stageNum: st.num, measure: null, how: "", doneWhen: "" } as any));
  };
  const row = (t: Task, k: number) => {
    const s = planner.stateOf(t, thisMonday());
    const isDone = done(t);
    const auto = rowKind(t) === "auto";            // first portfolio set counts itself
    const url = (t.title.match(URL_RE) || [])[1];
    const l = OWNER_LOOK[t.owner];
    return (
      <div key={t.id} style={{ minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: 2, padding: "0 4px 0 0", borderTop: k ? `1px solid ${C.hair}` : "none", boxSizing: "border-box" as const }}>
        <span style={{ width: SPACING.tap, height: SPACING.tap, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {auto ? null : <Tick on={isDone} color={PAL.done.mid} size={20} onClick={() => quiet(planner.setTaskStatus(t, isDone ? "open" : "done"))} />}
        </span>
        {auto
          ? <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.plannerText, color: isDone ? C.light : C.black, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
          : <TextInline value={t.title} muted={isDone} strike={isDone} ariaLabel={t.title} size={SPACING.plannerText}
              onSave={v => { if (!v.trim()) removeTask(t); else quiet(planner.updateTask(t.id, { title: v.trim() })); }} />}
        {url && <a href={url} target="_blank" rel="noreferrer" aria-label="Open link" style={{ color: C.muted, display: "inline-flex", padding: 8 }}><Ico d={IC.link} size={13} /></a>}
        {auto && <span style={{ fontSize: SPACING.listMeta, color: isDone ? PAL.done.ink : C.muted, marginRight: 6 }}>{s.actual ?? 0} / {s.target ?? "–"}</span>}
        {auto ? <TonedTag tone={PAL.neutral}>{l.label}</TonedTag>
          : <button onClick={() => quiet(planner.updateTask(t.id, { owner: NEXT_OWNER[t.owner] }))} aria-label={`Who: ${l.label} — tap to switch`} title="Tap to switch who"
              style={{ background: "none", border: "none", padding: "10px 2px", cursor: "pointer", flexShrink: 0 }}><TonedTag tone={PAL.neutral}>{l.label}</TonedTag></button>}
        {auto ? <span style={{ width: 30, flexShrink: 0 }} /> : <XBtn label={`Delete ${t.title}`} onClick={() => removeTask(t)} />}
      </div>
    );
  };
  const [adding, setAdding] = useState(0);
  const addRow = adding > 0 && (
    <div key={`add-${adding}`} style={{ minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: 2, padding: "0 12px 0 0", borderTop: `1px solid ${C.hair}` }}>
      <span style={{ width: SPACING.tap, display: "flex", justifyContent: "center", color: C.light, flexShrink: 0 }}>+</span>
      <TextInline value="" placeholder="New task" ariaLabel="New task" autoFocus size={SPACING.plannerText}
        onSave={v => { if (v.trim()) { addTask(v, "both"); setAdding(n => n + 1); } else setAdding(0); }} />
    </div>
  );
  const listCard = (list: Task[], withAdd = false) => (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, overflow: "hidden" }}>{list.map(row)}{withAdd && addRow}</div>
  );

  // stage card: the dashboard's white card with the 5-step bar
  const stageCard = st && (() => {
    const g = gateOf(st, tasks, planner.doneOf);
    return (
      <DashCard>
        <div style={{ padding: SPACING.dashCardPad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>Stage {st.num} · {st.name}</span>
            <span style={{ fontSize: TYPE.label.size, color: g.ready && g.total ? PAL.done.ink : PAL.neutral.ink, flexShrink: 0 }}>{g.done} / {g.total}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 4, marginTop: 10 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const s2 = mine.find(x => x.num === n);
              const fill = s2?.status === "done" ? 100 : n === st.num ? (g.total ? Math.round((g.done / g.total) * 100) : 0) : 0;
              return <div key={n} style={{ height: 4, background: C.line, borderRadius: RADIUS.bar }}><div style={{ height: 4, width: `${Math.max(fill, n === st.num ? 6 : 0)}%`, background: s2?.status === "done" ? PAL.done.mid : PAL.progress.mid, borderRadius: RADIUS.bar }} /></div>;
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 4, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const s2 = mine.find(x => x.num === n);
              return <span key={n} style={{ fontSize: TYPE.micro.size, color: n === st.num ? PAL.progress.ink : s2?.status === "done" ? PAL.done.ink : C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s2?.shortName || STAGE_SHORT[n - 1]}</span>;
            })}
          </div>
          {st.goal && <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "7px 0 0", lineHeight: 1.45 }}>{st.goal}</p>}
        </div>
      </DashCard>
    );
  })();

  const openCount = openOnes.length;
  const finishedCards = finished.map((s: Stage) => {
    const l = oneOffs(s.num);
    const open = openStage === s.id;
    return (
      <div key={s.id}>
        <button onClick={() => setOpenStage(open ? null : s.id)} aria-expanded={open} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS }}>
          <SectionHead dot={PAL.done.mid} label={`Stage ${s.num} · ${s.name}${s.doneOn ? ` · done ${fmtD(s.doneOn)}` : ""}`} right={<OpenArrow open={open} color={PAL.neutral.ink} />} />
        </button>
        {open && (l.length ? listCard(l) : <p style={{ fontSize: SPACING.plannerText, color: C.muted, margin: 0, padding: "4px 2px" }}>No tasks.</p>)}
        {open && s.num === Math.max(...finished.map(x => x.num)) && (
          <PillBtn onClick={() => setAskReopen(s)} s={{ marginTop: 8, height: 30 }}>Reopen Stage {s.num}</PillBtn>
        )}
      </div>
    );
  });

  return (
    <div>
      {askNext && st && next && (
        <ConfirmDialog title={`Stage ${st.num} done → start Stage ${next.num}?`}
          text={`Stage ${next.num} · ${next.name} starts with its prefilled list. The weekly goals keep running.`}
          okLabel={`Start Stage ${next.num}`} onOk={finishStage} onCancel={() => setAskNext(false)} />
      )}
      {askReopen && (
        <ConfirmDialog title={`Reopen Stage ${askReopen.num} · ${askReopen.name}?`}
          text={`Stage ${askReopen.num} is active again and the later stages go back to upcoming.`}
          okLabel={`Reopen Stage ${askReopen.num}`} onOk={reopen} onCancel={() => setAskReopen(null)} />
      )}
      <TabTitle title="To-do" acc={acc} onAccount={onAccount} isMobile={isMobile} />
      <SummaryLine dot={PAL.progress.mid}>{st ? <>Stage {st.num} of 5 · <Strong>{doneOnes.length} of {list.length} done</Strong></> : "Stages"}</SummaryLine>
      {loading ? (
        <p style={{ fontSize: SPACING.plannerText, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: SPACING.plannerText, color: C.red, marginTop: 16 }}>{loadError}</p>
      ) : (() => {
        // the pieces: open to-dos · done ones · the next-stage button
        const todoPart = st && (
            <>
              <SectionHead label={`To do · ${openCount}`} right={<button onClick={() => setAdding(n => n + 1)} style={{ background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, color: PAL.neutral.ink }}>+ Add</button>} />
              {openOnes.length || adding ? listCard(openOnes, true) : <p style={{ fontSize: SPACING.plannerText, color: C.muted, margin: 0, padding: "4px 2px" }}>All done for this stage.</p>}
            </>
        );
        const donePart = st && (
            <>
              {doneOnes.length > 0 && (
                <>
                  <button onClick={() => setShowDone(o => !o)} aria-expanded={showDone} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS }}>
                    <SectionHead dot={PAL.done.mid} label={`Done · ${doneOnes.length}`} right={<OpenArrow open={showDone} color={PAL.neutral.ink} />} />
                  </button>
                  {showDone && listCard(doneOnes)}
                </>
              )}
            </>
        );
        const nextPart = st && (
            <>
              {next && (openCount > 0
                ? <div style={{ marginTop: SPACING.cardGap, height: SPACING.mainBtn, borderRadius: RADIUS.button, border: `1px solid ${C.edge}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: TYPE.row.size, color: C.muted }}>{openCount} to go before Stage {next.num}</div>
                : <PillBtn dark onClick={() => setAskNext(true)} s={{ width: "100%", height: SPACING.mainBtn, marginTop: SPACING.cardGap, justifyContent: "center" }}>Stage {st.num} done → start Stage {next.num}</PillBtn>)}
            </>
        );
        // phone: one column as before · iPad / computer: stage + to do on the left, done + finished stages on the right
        return isMobile ? (
          <>
            {stageCard}
            {todoPart}
            {donePart}
            {nextPart}
            {finishedCards}
          </>
        ) : (
          <Cols left={<>{stageCard}{todoPart}{nextPart}</>} right={<>{donePart}{finishedCards}</>} />
        );
      })()}
    </div>
  );
}
