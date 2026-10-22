// ─────────────────────────────────────────────────────────────
// PlannerWindows — the Planner's windows (one level, like the
// Outreach contact window) and the small pieces they share.
//   Idea window    an idea or an editorial: ticks, concept (phase · era · arc · format), storyline, clips, links
//   Sprint window  focus, goals, results and the review (Stage 2)
// The text list, link list and window heads are shared with the
// concept page (PlannerConcept: an arc's texts and links, an era's arcs).
// Extra actions (Delete …) sit in the ⋯ menu; one main button.
// Every window is a bottom sheet like the Manager and Creator sheets: only as
// tall as its content, the page dimmed behind. Compact inside: 10 px between
// sections, 32 px rows and fields with 13 px text (typed at 16 px underneath,
// so the iPhone doesn't zoom).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, Z, PAL, RADIUS, TRACK, SHADOW, DENSITY, ICON } from "./constants";
import { fmtD, today, monthStart, monthEnd, ymd } from "./formatters";
import { B, I, S, Lbl, Tick, ConfirmDialog, BAR_BTN, Switch, TextInline, MiniInput, MiniSelect, useKeyboardInset, useEscape } from "./atoms";
import type { ToneSet } from "./atoms";
import {
  ACCOUNTS, PHASES, OWNERS, RHYTHMS, STATUSES, STAGE_SHORT, DAY_SHORT, accLook, phaseLabel, ownerLabel, rhythmLabel, rowKind, entryKey, periodOf, snapKey, addDays, isoWeek, weekRange, weekLabel, thisMonday, monthName, todayIndex, gateOf, stageNumOf, taskAccounts, isVisible, byOrder, fmtInt, fmtPct2, parseDec, parseIntDe, ITEM_STATUSES, FORMATS, CLASSIC, formatLook, itemStatusLabel, daysBetween, OWNER_LOOK, monthGoalOf, monthGoalPatch, loadWorkAccount, storyLines,
  isPostedStatus, isFilmedStatus, linkInfo, isUrlLike, itemStageOf, ITEM_STAGE_LABEL, TYPES, typeOf, typePatch, CONTENT, PLATFORM_TONE,
} from "./planner";
import type { Task, Stage, TaskAccount, AccountFilter, Phase, Rhythm, Item, ItemList, ItemStatus, ItemPlan, Account, NoteKind, Sprint, SprintResults, Owner, ItemStage } from "./planner";
import { OUTREACH_CATEGORIES, OUTREACH_TIERS, catOf } from "./outreach";
import type { PlannerHook } from "./usePlanner";
import { showUndo, XBtn } from "./undo";

// ── small line icons (same drawing style as Outreach) ─────────
export const Ico = ({ d, size = 14, color = "currentColor" }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
export const IC = {
  filter: "M4 5h16l-6 7.5V19l-4 1v-7.5z",
  plus:   "M12 5v14M5 12h14",
  left:   "M15 6l-6 6 6 6",
  right:  "M9 6l6 6-6 6",
  more:   "M5 12h.01M12 12h.01M19 12h.01",
  link:   "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  list:   "M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01",
  open:   "M10.5 6.5H8a2.5 2.5 0 0 0-2.5 2.5v7A2.5 2.5 0 0 0 8 18.5h7a2.5 2.5 0 0 0 2.5-2.5v-2.5M13.5 5.5h5v5M18.5 5.5l-7 7",
  tag:    "M4 4h7l9 9-7 7-9-9zM8.5 8.5h.01",
  lock:   "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  arrow:  "M5 12h14M13 6l6 6-6 6",
  down:   "M6 9l6 6 6-6",
  copy:   "M9 9h10v10H9zM5 15V5h10",
  heart:  "M19.5 12.6L12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6z",
  userPlus: "M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M6 21v-2a4 4 0 0 1 4-4h4M16 19h6M19 16v6",
  mail:   "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6",
  send:   "M10 14L21 3M21 3l-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1z",
  camera: "M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M9 13a3 3 0 1 0 6 0a3 3 0 0 0-6 0",
  bulb:   "M3 12h1m8-9v1m8 8h1M5.6 5.6l.7.7m12.1-.7l-.7.7M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0-1 3a2 2 0 0 1-4 0a3.5 3.5 0 0 0-1-3M9.7 17h4.6",
  spark:  "M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zm0-12a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zM9 18a6 6 0 0 1 6-6a6 6 0 0 1-6-6a6 6 0 0 1-6 6a6 6 0 0 1 6 6z",
  history: "M12 8v4l2 2M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5",
  up:     "M18 15l-6-6-6 6",
  euro:   "M17.2 7a6 7 0 1 0 0 10M13 10H5M5 14h8",
  hourglass: "M6.5 7h11M6.5 17h11M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM6 4v2a6 6 0 1 0 12 0V4a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
  sign:   "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  file:   "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 13h6M9 17h6",
  shield: "M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3",
  checkCircle: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9 12l2 2 4-4",
  alert:  "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8v4M12 16h.01",
  leaf:   "M5 21c.5-4.5 2.5-8 7-10M9 18c6.2 0 10.5-3.3 11-12V4h-4C9.1 4 5 7.5 5 13c0 1.4.5 3 1.5 4.5",
  speaker: "M18 8a3 3 0 0 1 0 6M10 8v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5M12 8l4.5-3.8a.9.9 0 0 1 1.5.7v12.2a.9.9 0 0 1-1.5.7L12 14H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h8",
  download: "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5 5-5M12 4v12",
  camera2: "M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M9 13a3 3 0 1 0 6 0a3 3 0 0 0-6 0",
};

// ── pieces ────────────────────────────────────────────────────
export const AccChip = ({ acc, s }: { acc: TaskAccount; s?: any }) => {
  const l = accLook(acc);
  return <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${l.border}`, background: l.bg, color: l.color, whiteSpace: "nowrap" as const, flexShrink: 0, ...s }}>{l.label}</span>;
};

export const Bar = ({ value, max, done, s, color, track, h = 3 }: { value: number; max: number; done?: boolean; s?: any; color?: string; track?: string; h?: number }) => {
  const w = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div style={{ height: h, background: track || C.rule, marginTop: 6, ...s }}>
      <div style={{ height: h, width: `${w}%`, background: done ? C.green : (color || C.black) }} />
    </div>
  );
};

// Text you edit right where it is (no window): looks like text, saves when you leave it.
// Enter (single line) runs onEnter, e.g. "add the next row".
export function InlineText({ value, onSave, placeholder, multiline, ariaLabel, s, onEnter, autoFocus, muted }: {
  value: string; onSave: (v: string) => void; placeholder?: string; multiline?: boolean; ariaLabel?: string; s?: any;
  onEnter?: () => void; autoFocus?: boolean; muted?: boolean;
}) {
  const [t, setT] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(value); }, [value, focus]);
  const commit = () => { setFocus(false); if (t !== value) onSave(t); };
  const base: any = {
    width: "100%", boxSizing: "border-box" as const, fontFamily: SANS, fontSize: 14, color: muted ? C.light : C.black,
    background: focus ? C.white : "transparent", border: `1px solid ${focus ? C.rule : "transparent"}`, borderRadius: 2,
    outline: "none", padding: multiline ? "6px 8px" : "0 6px", margin: multiline ? "0 -8px" : "0 -6px", ...s,
  };
  if (multiline) {
    const rows = Math.max(2, Math.min(10, (t || "").split("\n").length + Math.floor((t || "").length / 44)));
    return <textarea value={t} rows={rows} placeholder={placeholder} aria-label={ariaLabel} autoFocus={autoFocus}
      onFocus={() => setFocus(true)} onChange={(e) => setT(e.target.value)} onBlur={commit}
      style={{ ...base, resize: "none" as const, lineHeight: 1.5, width: "calc(100% + 16px)" }} />;
  }
  return <input value={t} placeholder={placeholder} aria-label={ariaLabel} autoFocus={autoFocus}
    onFocus={() => setFocus(true)} onChange={(e) => setT(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); onEnter?.(); } }}
    style={{ ...base, height: 32, width: "calc(100% + 12px)" }} />;
}

// ── "How this tab works": shows on the first visit; Got it hides it, "?" brings it back ──
export function useGuide(key: string) {
  const k = `lh_guide_${key}`;
  const [open, setOpen] = useState<boolean>(() => { try { return localStorage.getItem(k) !== "seen"; } catch { return true; } });
  const close = () => { setOpen(false); try { localStorage.setItem(k, "seen"); } catch { /* ignore */ } };
  return { open, close, toggle: () => (open ? close() : setOpen(true)) };
}
export const GuideBtn = ({ onClick, on }: { onClick: () => void; on: boolean }) => (
  <button onClick={onClick} aria-label="How this tab works" aria-expanded={on}
    style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${on ? C.black : C.rule}`, background: on ? C.black : C.white, color: on ? C.white : C.muted, fontFamily: SANS, fontSize: 12, cursor: "pointer", padding: 0, flexShrink: 0 }}>?</button>
);
export const GuideCard = ({ steps, onClose }: { steps: string[]; onClose: () => void }) => (
  <div style={{ background: "#fdfcfa", border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, padding: 12 }}>
    <div style={{ fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted }}>How this tab works</div>
    <div style={{ display: "grid", gridTemplateColumns: "18px 1fr", rowGap: 6, marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
      {steps.map((x, k) => [<span key={`n${k}`} style={{ color: C.muted }}>{k + 1}.</span>, <span key={`t${k}`}>{x}</span>])}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
      <B onClick={onClose} s={{ ...BAR_BTN, height: 28, minHeight: 28 }}>Got it</B>
    </div>
  </div>
);

// A goal number you tap to change (dotted underline); saves on leave / Enter
export function GoalNum({ value, onSave, label }: { value: number | null; onSave: (v: number | null) => void; label: string }) {
  const [edit, setEdit] = useState(false);
  if (edit) return (
    <input autoFocus inputMode="numeric" defaultValue={value ?? ""} aria-label={label} placeholder="–" onFocus={(e) => e.target.select()}
      onBlur={(e) => { setEdit(false); const v = e.target.value.trim() === "" ? null : parseIntDe(e.target.value); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(false); }}
      style={{ width: 52, height: 26, border: `1px solid ${C.black}`, borderRadius: 2, padding: "0 6px", textAlign: "right" as const, fontFamily: SANS, fontSize: 13, boxSizing: "border-box" as const }} />
  );
  return (
    <button onClick={(e) => { e.stopPropagation(); setEdit(true); }} aria-label={label} title="Tap to set the goal"
      style={{ background: "none", border: "none", borderBottom: `1px dotted ${C.muted}`, padding: "2px 0", fontFamily: SANS, fontSize: 13, color: C.black, cursor: "pointer", lineHeight: 1.2 }}>{value ?? "–"}</button>
  );
}

// The mark at the end of a goal row: ✓ reached · "3 to go" while the week runs · "6 / 7" ✕ once it's over
export function ResultMark({ state, text }: { state: "reached" | "togo" | "missed" | "none"; text?: string }) {
  const circle = (bg: string, fg: string, border: string, ch: string, label: string) => (
    <span role="img" aria-label={label} style={{ width: 24, height: 24, borderRadius: "50%", background: bg, color: fg, border: `1px solid ${border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, boxSizing: "border-box" as const }}>{ch}</span>
  );
  const word = (t: string, c: string) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: c, whiteSpace: "nowrap" as const }}>{t}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, minWidth: 70, flexShrink: 0 }}>
      {state === "reached" && circle(C.green, C.white, C.green, "✓", "Reached")}
      {state === "togo" && text && word(text, C.amber)}
      {state === "none" && word(text || "No number", C.light)}
      {state === "missed" && <>{text && <span style={{ fontSize: 11, color: C.red }}>{text}</span>}{circle("#f6e9e9", C.red, "#e8c9c9", "✕", "Not reached")}</>}
    </span>
  );
}

// Who does it, as a small coloured pill (Manager blue-grey · Creator mauve · Both warm grey)
export const OwnerPill = ({ owner }: { owner: Owner }) => {
  const l = OWNER_LOOK[owner];
  return <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${l.border}`, background: l.bg, color: l.color, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{l.label}</span>;
};

// A white card on the cream page (title row optional)
export const Card = ({ title, right, children, pad = true, s }: { title?: string; right?: any; children: any; pad?: boolean; s?: any }) => (
  <div style={{ background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden", ...s }}>
    {title && (
      <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted }}>
        <span>{title}</span>{right != null && <span>{right}</span>}
      </div>
    )}
    <div style={{ padding: pad ? (title ? "0 12px 12px" : "12px") : 0 }}>{children}</div>
  </div>
);

// display-only tick (rows whose box ticks itself)
export const Box = ({ on, size = 18 }: { on: boolean; size?: number }) => (
  <span aria-label={on ? "Done" : "Not done yet"} style={{ width: size, height: size, borderRadius: 3, border: `1.5px solid ${on ? C.green : C.light}`, background: on ? C.green : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" as const }}>
    {on && <span style={{ fontSize: Math.round(size * 0.55), color: C.white, lineHeight: 1, fontWeight: 500 }}>✓</span>}
  </span>
);

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };

// 5 steps: done stages full, the current one filled by its gate progress
export const StageTrack = ({ stages, current, progress }: { stages: Stage[]; current?: Stage; progress: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 3, marginTop: 8 }}>
    {[1, 2, 3, 4, 5].map(n => {
      const st = stages.find(s => s.num === n);
      const isCur = current?.num === n;
      const fill = st?.status === "done" ? 100 : isCur ? Math.round(progress * 100) : 0;
      return (
        <div key={n} style={{ minWidth: 0 }}>
          <div style={{ height: 4, background: C.rule }}><div style={{ height: 4, width: `${fill}%`, background: C.black }} /></div>
          <div style={{ fontSize: TYPE.micro.size, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4, color: isCur || st?.status === "done" ? C.black : C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {st?.shortName || STAGE_SHORT[n - 1]}
          </div>
        </div>
      );
    })}
  </div>
);

// ── the slim toolbar every Planner tab shares: ‹ Week › (+ extra) ─
// The account is chosen in the profile menu, so it isn't here.
export function Toolbar({ monday, setMonday, isMobile, children }: {
  monday: string; setMonday: (m: string) => void; isMobile: boolean; children?: any;
}) {
  const ctl: any = { height: 28, border: `1px solid ${C.rule}`, borderRadius: 2, background: "transparent", display: "inline-flex", alignItems: "center", boxSizing: "border-box" as const, color: C.black, fontFamily: SANS };
  const arrowBtn: any = { width: 28, height: 26, border: "none", background: "none", cursor: "pointer", color: C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 };
  const isThisWeek = monday === thisMonday();
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
      <div style={{ ...ctl, flex: isMobile ? 1 : "0 0 auto", justifyContent: "space-between", minWidth: 0 }}>
        <button onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week" style={arrowBtn}><Ico d={IC.left} size={13} /></button>
        <button onClick={() => setMonday(thisMonday())} title={isThisWeek ? "This week" : "Back to this week"}
          style={{ height: 26, border: "none", background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.black, padding: "0 2px", whiteSpace: "nowrap" as const }}>
          {weekLabel(monday)}
        </button>
        <button onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week" style={arrowBtn}><Ico d={IC.right} size={13} /></button>
      </div>
      {children}
    </div>
  );
}

// Under each tab title: the account you're working on · the week (or more)
export const Subtitle = ({ text }: { text: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" as const }}>
    <span style={{ ...microLabel, letterSpacing: "0.06em" }}>{text}</span>
  </div>
);

// ── the account switch: @lynnhoa · @createbylynn, next to every tab title ─
// One tap switches the whole Planner (remembered on this device; the profile
// menu's "@… concept" sets it too). A number still being typed is saved first, to the account it
// was typed for — the field is left (blur) before the account changes.
export const AccSwitch = ({ acc, onPick }: { acc: Account; onPick?: (a: Account) => void }) => (
  <span role="group" aria-label="Account" style={{ display: "inline-flex", alignItems: "center", gap: 2, height: 28, padding: 2, boxSizing: "border-box" as const, border: `1px solid ${C.rule}`, borderRadius: 14, background: C.white, flexShrink: 0 }}>
    {ACCOUNTS.map(a => {
      const on = a.key === acc;
      return (
        <button key={a.key} type="button" aria-pressed={on}
          onClick={() => {
            if (on || !onPick) return;
            const el = document.activeElement as HTMLElement | null;
            if (el && el !== document.body && typeof el.blur === "function") el.blur();
            onPick(a.key);
          }}
          style={{ height: 22, padding: "0 9px", borderRadius: 11, boxSizing: "border-box" as const, border: `1px solid ${on ? a.border : "transparent"}`, background: on ? a.bg : "transparent",
            color: on ? a.color : C.muted, fontFamily: SANS, fontSize: 12, letterSpacing: "0.01em", lineHeight: 1, whiteSpace: "nowrap" as const, cursor: on ? "default" : "pointer" }}>
          {a.label}
        </button>
      );
    })}
  </span>
);

// The title row of every Planner tab: title + account switch, extras (e.g. "?") on the right
export const TabTitle = ({ title, acc, onAccount, isMobile, right }: { title: string; acc: Account; onAccount?: (a: Account) => void; isMobile: boolean; right?: any }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 12, flexWrap: "wrap" as const, rowGap: 6, minWidth: 0 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{title}</h2>
      <AccSwitch acc={acc} onPick={onAccount} />
    </div>
    {right}
  </div>
);

// An Outreach category as a small coloured chip
export const CatChip = ({ k }: { k: string }) => {
  const l = catOf(k);
  return <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${l.border}`, background: l.bg, color: l.color, whiteSpace: "nowrap" as const }}>{l.label}</span>;
};

// Small coloured counts (Outreach categories / tiers)
export const CountChip = ({ label, n, look }: { label: string; n: number; look?: { color: string; bg: string; border: string } }) => (
  <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${look?.border || C.rule}`, background: look?.bg || "transparent", color: look?.color || C.muted, whiteSpace: "nowrap" as const }}>{label} {n}</span>
);

// ── one-level window: a bottom sheet, like the Manager and Creator sheets ─
// Only as tall as its content (up to 88 % of the screen), the page dimmed behind;
// tap outside or ✕ to close. The title in small caps, extras (right) on the right.
// With the iPhone keyboard open, the sheet sits on top of it.
export function Window({ title, isMobile, onClose, children, footer, right, head }: { title: string; isMobile: boolean; onClose: () => void; children: any; footer?: any; right?: any; head?: any }) {
  const kb = useKeyboardInset();
  useEscape(true, onClose);
  const extra = right ?? head;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: Z.modal, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: SANS, color: C.black, paddingBottom: kb }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(26,26,26,0.28)" }} />
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ position: "relative", background: C.white, borderRadius: `${RADIUS.button}px ${RADIUS.button}px 0 0`, boxShadow: SHADOW.pop,
          maxHeight: kb ? `calc(100vh - ${kb + 12}px)` : "88vh", display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ height: DENSITY.sheetHeader, display: "flex", alignItems: "center", gap: 4, padding: "0 6px 0 4px", flexShrink: 0 }}>
          <button onClick={onClose} aria-label="Close" style={{ width: DENSITY.tap, height: DENSITY.tap, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: ICON.close, flexShrink: 0 }}>✕</button>
          <span style={{ flex: 1, minWidth: 0, textAlign: "center" as const, fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, padding: "0 6px" }}>{title}</span>
          <span style={{ minWidth: DENSITY.tap, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, flexShrink: 0 }}>{extra}</span>
        </div>
        <div style={{ overflowY: "auto", padding: footer ? "2px 16px 14px" : "2px 16px calc(14px + env(safe-area-inset-bottom, 0px))", WebkitOverflowScrolling: "touch" as any }}>{children}</div>
        {footer && <div style={{ padding: kb ? "10px 16px" : "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${C.line}`, flexShrink: 0, background: C.white }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ── An idea's steps: Idea → To shoot (Shot) → To post (Filmed) → Posted ─────────
// One status per idea: the Creator list it sits in and the ticks in its window both read it.
// A later step includes the earlier ones; going back clears the later days. The days are set
// by the tap (they are what the week's goals count); the shoot date is the only typed one.
export const STAGE_TONE: Record<ItemStage, ToneSet> = { idea: PAL.neutral, planned: PAL.progress, shot: PAL.waiting, posted: PAL.done };
export const ACC_TONE: Record<Account, ToneSet> = { lynnhoa: PAL.lynnhoa, createbylynn: PAL.createbylynn };
const stagePatch = (it: Item, st: ItemStage): Partial<Item> => {
  const posted = st === "posted", filmed = st === "shot" || posted;
  return {
    status: posted ? (it.status === "in_kit" ? "in_kit" : "posted") : st,
    postedOn: posted ? (it.postedOn || today()) : null,
    plannedOn: st === "idea" ? null : it.plannedOn,
    plan: { ...it.plan, filmedOn: filmed ? (it.plan.filmedOn || today()) : null },
  };
};
// Move an idea to a list. With undo: "Moved to …" · Undo puts status and every day back exactly.
export function moveTo(planner: PlannerHook, it: Item, st: ItemStage, undo = false) {
  const before: Partial<Item> = { status: it.status, postedOn: it.postedOn, plannedOn: it.plannedOn, plan: it.plan };
  const p = planner.updateItem(it.id, stagePatch(it, st));
  if (undo) showUndo(`Moved to ${ITEM_STAGE_LABEL[st]}`, () => planner.updateItem(it.id, before));
  return p;
}
// one tick box (44 px to tap) — the Creator list's ticks
export const TickBox = ({ on, tone, onClick, ariaLabel, size = 20 }: { on: boolean; tone: ToneSet; onClick: () => void; ariaLabel: string; size?: number }) => (
  <button role="checkbox" aria-checked={on} aria-label={ariaLabel} onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
    <span style={{ width: size, height: size, borderRadius: RADIUS.check, border: `1.5px solid ${on ? tone.mid : C.light}`, background: on ? tone.mid : C.white, display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" as const }}>
      {on && <span style={{ fontSize: Math.round(size * 0.55), color: C.white, lineHeight: 1, fontWeight: 500 }}>✓</span>}
    </span>
  </button>
);
const WD3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// "Mon 20.10."
export const dayShort = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  return isNaN(+dt) ? "" : `${WD3[dt.getDay()]} ${String(d).slice(8, 10)}.${String(d).slice(5, 7)}.`;
};
// a section of the idea window: a small coloured circle with its icon + the label (+ something on the right)
export const WinHead = ({ icon, label, tone, right, first }: { icon: string; label: string; tone: ToneSet; right?: any; first?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: `${first ? 2 : 10}px 2px 5px` }}>
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: tone.wash, color: tone.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={icon} size={11} /></span>
      {label}
    </span>
    {right}
  </div>
);
export const winCard: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, boxShadow: SHADOW.card, overflow: "hidden" };
// a platform as a small mark: soft swatch + name (where a format is posted)
export const PlatformMark = ({ platform }: { platform: "TikTok" | "Instagram" }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, boxSizing: "border-box" as const, background: PLATFORM_TONE[platform].wash, border: `1.5px solid ${PLATFORM_TONE[platform].mid}`, flexShrink: 0 }} />{platform}
  </span>
);
// the title: shown at 22 px (typed at 16 px underneath, so the iPhone doesn't zoom)
function TitleField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [t, setT] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(value); }, [value, focus]);
  const k = TYPE.tile.size / 16, H = 30;
  return (
    <span style={{ position: "relative", display: "block", height: H, margin: "0 0 8px" }}>
      <input value={t} aria-label="Title" onFocus={() => setFocus(true)} onChange={(e) => setT(e.target.value)}
        onBlur={() => { setFocus(false); if (t.trim() && t !== value) onSave(t.trim()); else setT(value); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={{ position: "absolute", left: -6, top: 0, width: `calc((100% + 12px) / ${k})`, height: H / k, transform: `scale(${k})`, transformOrigin: "left top",
          fontFamily: SERIF, fontSize: 16, color: C.black, background: focus ? C.white : "transparent", border: `1px solid ${focus ? C.edge : "transparent"}`,
          borderRadius: 8 / k, padding: `0 ${6 / k}px`, outline: "none", boxSizing: "border-box" as const, margin: 0, WebkitAppearance: "none" as const }} />
    </span>
  );
}

// ⋯ menu: extra actions in a small dropdown (opens upwards from the footer)
export function MoreMenu({ items, bare }: { items: { label: string; danger?: boolean; onClick: () => void }[]; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />}
      <button onClick={() => setOpen(o => !o)} aria-label="More" title="More" aria-expanded={open}
        style={bare
          ? { width: 40, height: 40, border: "none", background: "none", color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2, padding: 0 }
          : { width: 36, height: 36, border: `1px solid ${C.rule}`, borderRadius: 2, background: "transparent", color: C.black, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2 }}>
        <Ico d={IC.more} size={18} />
      </button>
      {open && (
        <div role="menu" style={bare
          ? { position: "absolute", right: 0, top: "calc(100% + 2px)", minWidth: 170, background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, boxShadow: SHADOW.pop, padding: "5px 0", zIndex: 3 }
          : { position: "absolute", left: 0, bottom: "calc(100% + 6px)", minWidth: 170, background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: "4px 0", zIndex: 3 }}>
          {items.map(it => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              style={{ display: "flex", alignItems: "center", width: "100%", height: bare ? 32 : 34, padding: "0 13px", border: "none", background: "none", color: it.danger ? C.red : C.black, fontFamily: SANS, fontSize: 13, cursor: "pointer", textAlign: "left" as const }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const textBlock = (label: string, text: string) => !text ? null : (
  <>
    <Lbl>{label}</Lbl>
    <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" as const }}>{text}</p>
  </>
);

const quietP = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

export const FormatChip = ({ f }: { f: string }) => {
  const l = formatLook(f);
  return <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${l.border}`, background: l.bg, color: l.color, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{l.label}</span>;
};

// ═════════════════════════════════════════════════════════════
// ITEM WINDOW — an idea or an editorial (portfolio piece)
// Top bar ✕ · Content | Editorial. Title, the Filmed / Posted ticks (the same as in the
// Creator list), format, shoot date (optional), storyline, clips, links. Saves by itself.
// ═════════════════════════════════════════════════════════════
export function ItemWindow({ planner, itemId, isMobile, onClose }: {
  planner: PlannerHook; itemId?: string; draft?: Partial<Item>; isMobile: boolean; onClose: () => void;
}) {
  const it = planner.items.find(x => x.id === itemId);
  // an item deleted elsewhere closes its window
  useEffect(() => { if (itemId && !it && !planner.loading) onClose(); }, [itemId, it, planner.loading]);
  if (!it) return null;

  const stage  = itemStageOf(it);
  const shot   = stage !== "idea";
  const filmed = isFilmedStatus(it.status);
  const posted = isPostedStatus(it.status);
  const accT   = ACC_TONE[it.account] || PAL.neutral;
  const type   = typeOf(it);
  const types  = TYPES[it.account] || [CONTENT];
  const save   = (patch: Partial<Item>) => quietP(planner.updateItem(it.id, patch));
  const savePlan = (p: Partial<ItemPlan>) => save({ plan: { ...it.plan, ...p } });
  const go = (st: ItemStage) => quietP(moveTo(planner, it, st));
  const del = async () => {
    const copy = it;
    onClose();
    try { await planner.deleteItem(copy.id); showUndo(`${copy.list === "editorial" ? "Editorial" : "Idea"} deleted`, () => planner.restoreItem(copy)); }
    catch { /* the save toast reports it */ }
  };
  const st = STAGE_TONE[stage];
  const badge = (
    <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: st.ink, background: st.fill, height: 22, padding: "0 8px", display: "inline-flex", alignItems: "center", borderRadius: RADIUS.tag, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
      {ITEM_STAGE_LABEL[stage]}
    </span>
  );
  const accPill = (
    <span style={{ marginLeft: "auto", height: 22, padding: "0 9px", borderRadius: 11, background: accT.wash, border: `1px solid ${accT.fill}`, color: accT.ink, fontSize: TYPE.label.size, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
      @{it.account}
    </span>
  );

  // one step: tap to tick / untick · tinted in its colour once ticked · its day underneath
  const step = (label: string, on: boolean, tone: ToneSet, sub: string, run: () => void, date?: boolean) => (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 7px", borderRadius: RADIUS.field, background: on ? tone.wash : C.bg, minWidth: 0 }}>
      <button role="checkbox" aria-checked={on} aria-label={label} onClick={run}
        style={{ position: "absolute", inset: 0, background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: RADIUS.field }} />
      <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: RADIUS.check, border: `1.5px solid ${on ? tone.mid : C.light}`, background: on ? tone.mid : C.white, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" as const, pointerEvents: "none" as const }}>
        {on && <span style={{ fontSize: 10, color: C.white, lineHeight: 1, fontWeight: 500 }}>✓</span>}
      </span>
      <span style={{ minWidth: 0, lineHeight: 1.25, pointerEvents: "none" as const }}>
        <span style={{ display: "block", fontSize: TYPE.subtext.size, fontWeight: 500, color: on ? tone.ink : C.black }}>{label}</span>
        <span style={{ display: "block", fontSize: TYPE.micro.size, color: on ? tone.ink : C.light, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
      </span>
      {/* the shoot date: tap the day under "Shot" = the iPhone's date picker */}
      {date && on && (
        <input type="date" aria-label="Shoot date" value={it.plannedOn || ""} onChange={(e) => save({ plannedOn: e.target.value || null })}
          style={{ position: "absolute", left: 26, right: 0, bottom: 1, height: 16, opacity: 0, cursor: "pointer", fontSize: 16, border: "none", padding: 0 }} />
      )}
    </div>
  );
  const typeChip = (t: string) => {
    const on = t === type;
    return (
      <button key={t} onClick={() => { if (!on) save(typePatch(it.account, t)); }} aria-pressed={on}
        style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 11px", borderRadius: RADIUS.pill, border: `1px solid ${on ? accT.fill : C.rule}`,
          background: on ? accT.wash : C.white, color: on ? accT.ink : C.ink2, fontFamily: SANS, fontSize: TYPE.subtext.size, cursor: "pointer", whiteSpace: "nowrap" as const }}>
        {t}
      </button>
    );
  };
  const styleBtn = (k: "bullets" | "numbers", label: string) => (
    <button key={k} onClick={() => savePlan({ style: k })} aria-pressed={it.plan.style === k} title={k === "bullets" ? "Bullets" : "Numbers"}
      style={{ height: "100%", padding: "0 8px", border: "none", borderRadius: 10, background: it.plan.style === k ? PAL.neutral.fill : "transparent", color: it.plan.style === k ? C.black : C.muted, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>{label}</button>
  );
  const mini: any = { fontSize: TYPE.label.size, color: C.muted };

  return (
    <>
      <Window title={it.list === "editorial" ? "Editorial" : "Idea"} isMobile={isMobile} onClose={onClose}
        right={<>{accPill}<MoreMenu bare items={[{ label: `Delete ${it.list === "editorial" ? "editorial" : "idea"}`, danger: true, onClick: del }]} /></>}
        footer={<div style={{ display: "flex", width: "100%" }}><B onClick={onClose} s={{ flex: 1, height: 38, minHeight: 38 }}>Done</B></div>}>
        <TitleField value={it.title} onSave={v => save({ title: v })} />

        {/* Shot · Filmed · Posted — the same status as the Creator list */}
        <div style={{ ...winCard, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 5, padding: 5 }}>
          {step("Shot", shot, PAL.progress, shot ? (it.plannedOn ? dayShort(it.plannedOn) : "add date") : "to shoot", () => go(shot ? "idea" : "planned"), true)}
          {step("Filmed", filmed, PAL.waiting, filmed ? (dayShort(it.plan.filmedOn) || "filmed") : "on the day", () => go(filmed ? "planned" : "shot"))}
          {step("Posted", posted, PAL.done, posted ? (dayShort(it.postedOn) || "posted") : "when live", () => go(posted ? "shot" : "posted"))}
        </div>
        {posted && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 8, marginTop: 4 }}>
            <div><Lbl>Post link</Lbl>
              <MiniInput key={`pl-${it.link}`} defaultValue={it.link} placeholder="https://" aria-label="Post link" inputMode="url"
                onBlur={(e: any) => { const v = String(e.target.value || "").trim(); if (v !== it.link) save({ link: v }); }} />
            </div>
            <div><Lbl>Views</Lbl>
              <MiniInput key={`vw-${it.views}`} defaultValue={it.views == null ? "" : it.views.toLocaleString("de-DE")} placeholder="–" aria-label="Views" inputMode="numeric"
                onBlur={(e: any) => { const raw = String(e.target.value || "").trim(); const v = raw === "" ? null : parseIntDe(raw); if (v !== it.views) save({ views: v }); }} />
            </div>
          </div>
        )}

        {/* the content concept: Phase · Era, then Arc · Format (the era's arcs first) */}
        <WinHead icon={IC.bulb} label="Concept" tone={accT} />
        {(() => {
          const arcs = planner.arcs.filter(a => a.account === it.account).sort((a, b) => a.num - b.num);
          const arc  = arcs.find(a => a.id === it.plan.arc);
          const fmt  = arc?.formats.find(f => f.name === it.plan.arcFormat);
          const phases = planner.phases.filter(p => p.account === it.account).sort((a, b) => a.num - b.num);
          const phase  = phases.find(p => p.num === it.plan.phase);
          const era    = phase?.eras.find(e => e.key === it.plan.era);
          // with an era: its arcs first (in posting order, optional ones marked), then the others
          const eraArcs = era ? era.arcs.flatMap(ea => { const a = arcs.find(x => x.num === ea.num); return a ? [{ ea, a }] : []; }) : [];
          const others  = era ? arcs.filter(a => !era.arcs.some(ea => ea.num === a.num)) : arcs;
          // a new phase keeps the era if it has one with the same key; "Pick a phase" clears both
          const pickPhase = (v: string) => {
            const n = Number(v) || 0;
            if (!n) { savePlan({ phase: null, era: null }); return; }
            const next = phases.find(p => p.num === n);
            const keep = !!next && !!it.plan.era && next.eras.some(e => e.key === it.plan.era);
            savePlan({ phase: n, era: keep ? it.plan.era : null });
          };
          // a new arc keeps the format if it has one of the same name
          const pickArc = (id: string) => {
            if (!id) { savePlan({ arc: null, arcFormat: null }); return; }
            const next = arcs.find(a => a.id === id);
            const keep = !!next && !!it.plan.arcFormat && next.formats.some(f => f.name === it.plan.arcFormat);
            savePlan({ arc: id, arcFormat: keep ? it.plan.arcFormat : null });
          };
          return (
            <>
              {(phases.length > 0 || !!it.plan.phase) && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6, marginBottom: 6 }}>
                  <MiniSelect value={it.plan.phase ? String(it.plan.phase) : ""} muted={!it.plan.phase} aria-label="Phase"
                    onChange={(e: any) => pickPhase(String(e.target.value || ""))}>
                    <option value="">Pick a phase</option>
                    {!!it.plan.phase && !phase && <option value={String(it.plan.phase)}>Not in the concept any more</option>}
                    {phases.map(p => <option key={p.id} value={String(p.num)}>{`${p.num}. ${p.name}`}</option>)}
                  </MiniSelect>
                  <MiniSelect value={it.plan.era || ""} muted={!it.plan.era} disabled={!phase} aria-label="Era"
                    onChange={(e: any) => savePlan({ era: String(e.target.value || "") || null })}>
                    <option value="">{phase ? "Pick an era" : "Era"}</option>
                    {phase && it.plan.era && !era && <option value={it.plan.era}>Not in this phase any more</option>}
                    {(phase?.eras || []).map(e => <option key={e.key} value={e.key}>{e.name}</option>)}
                  </MiniSelect>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6 }}>
                <MiniSelect value={it.plan.arc || ""} muted={!it.plan.arc} disabled={!arcs.length && !it.plan.arc} aria-label="Arc"
                  onChange={(e: any) => pickArc(String(e.target.value || ""))}>
                  <option value="">{arcs.length ? "Pick an arc" : `No arcs for @${it.account} yet`}</option>
                  {it.plan.arc && !arc && <option value={it.plan.arc}>Not in the concept any more</option>}
                  {era && eraArcs.length > 0 && (
                    <optgroup label={era.name}>
                      {eraArcs.map(({ ea, a }) => <option key={a.id} value={a.id}>{`${a.num}. ${a.name}${ea.optional ? " (optional)" : ""}`}</option>)}
                    </optgroup>
                  )}
                  {era && eraArcs.length > 0
                    ? (others.length > 0 && <optgroup label="Other arcs">{others.map(a => <option key={a.id} value={a.id}>{`${a.num}. ${a.name}`}</option>)}</optgroup>)
                    : arcs.map(a => <option key={a.id} value={a.id}>{`${a.num}. ${a.name}`}</option>)}
                </MiniSelect>
                <MiniSelect value={it.plan.arcFormat || ""} muted={!it.plan.arcFormat} disabled={!arc} aria-label="Format"
                  onChange={(e: any) => savePlan({ arcFormat: String(e.target.value || "") || null })}>
                  <option value="">{arc ? "Pick a format" : "Format"}</option>
                  {arc && it.plan.arcFormat && !fmt && <option value={it.plan.arcFormat}>{`${it.plan.arcFormat} (not in this arc any more)`}</option>}
                  {(arc?.formats || []).map(f => <option key={f.name} value={f.name}>{`${f.name}${f.main ? " (main)" : ""}`}</option>)}
                </MiniSelect>
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: "4px 10px", fontSize: TYPE.label.size, color: C.muted, margin: "5px 2px 0", minHeight: 14 }}>
                <span>{fmt ? "Posts on" : "Posts on —"}</span>
                {fmt?.tt && <PlatformMark platform="TikTok" />}
                {fmt?.ig && <PlatformMark platform="Instagram" />}
              </div>
            </>
          );
        })()}

        <WinHead icon={IC.sign} label={`Storyline${storyLines(it.direction).length ? ` · ${storyLines(it.direction).length}` : ""}`} tone={accT} />
        <div style={winCard}>
          <LineList key={`s-${it.id}`} initial={storyLines(it.direction)} marker="bullets"
            placeholder="First beat of the story" addLabel="Add a point" onSave={lines => save({ direction: lines.join("\n") })} />
        </div>

        <WinHead icon={IC.camera} label={`Clips${(it.plan.clips || []).length ? ` · ${it.plan.clips.length}` : ""}`} tone={accT} />
        <div style={winCard}>
          <LineList key={`c-${it.id}`} initial={(it.plan.clips || []).map(c => c.t)} marker="numbers"
            placeholder="Close-up, product in hand" addLabel="Add a clip"
            onSave={lines => savePlan({ clips: lines.map(t => ({ t, done: false })) })} />
        </div>

        <WinHead icon={IC.link} label={`Links${(it.plan.refs || []).length ? ` · ${it.plan.refs.length}` : ""}`} tone={accT} />
        <div style={winCard}>
          <LinkList key={`r-${it.id}`} initial={it.plan.refs || []} onSave={refs => savePlan({ refs })} />
        </div>

      </Window>
    </>
  );
}

// A list you write like notes: Enter adds the next line, Backspace on an
// empty line removes it. Bullets or numbers (or a tick box per line).
// Saves (without empty lines) when you leave a line. Shown at the app's 13 px
// row size, typed at 16 px underneath (so the iPhone doesn't zoom); one line per row.
const LK = TYPE.row.size / 16;
export function LineList({ initial, checks: initialChecks, marker, placeholder, addLabel, onSave }: {
  initial: string[]; checks?: boolean[]; marker: "bullets" | "numbers" | "check"; placeholder: string; addLabel: string;
  onSave: (lines: string[], checks?: boolean[]) => void;
}) {
  // an empty list shows only "+ Add …"; the first line appears when you tap it
  const [lines, setLines]   = useState<string[]>(initial);
  const [checks, setChecks] = useState<boolean[]>(initialChecks || initial.map(() => false));
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  useEffect(() => { if (focusAt != null) { refs.current[focusAt]?.focus(); setFocusAt(null); } }, [focusAt, lines.length]);
  // long points wrap: each line grows with its text (the box around it follows at row size)
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const h = Math.max(32 / LK, el.scrollHeight);
    el.style.height = `${h}px`;
    if (el.parentElement) el.parentElement.style.height = `${h * LK}px`;
  };
  useEffect(() => { refs.current.forEach(fit); }, [lines]);
  const noun = addLabel.replace(/^Add an? /, "");
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const commit = (ls = lines, cs = checks) => {
    const keep = ls.map((t, k) => ({ t: t.trim(), c: !!cs[k] })).filter(x => x.t);
    onSave(keep.map(x => x.t), marker === "check" ? keep.map(x => x.c) : undefined);
  };
  const insertAfter = (k: number) => {
    const ls = [...lines]; ls.splice(k + 1, 0, "");
    const cs = [...checks]; cs.splice(k + 1, 0, false);
    setLines(ls); setChecks(cs); setFocusAt(k + 1);
  };
  const remove = (k: number, focus = true) => {
    const ls = lines.filter((_, i) => i !== k), cs = checks.filter((_, i) => i !== k);
    setLines(ls); setChecks(cs); if (focus && ls.length) setFocusAt(Math.max(0, k - 1)); commit(ls, cs);
  };
  // ✕ on a line: gone, Undo puts it back where it was
  const removeX = (k: number) => {
    const t = lines[k], before = lines, beforeC = checks;
    if (!t.trim()) { remove(k, false); return; }
    remove(k, false);
    showUndo(`${Noun} deleted`, () => {
      const ls = [...before], cs = [...beforeC];
      setLines(ls); setChecks(cs); commit(ls, cs);
    });
  };
  const tick = (k: number) => { const cs = [...checks]; cs[k] = !cs[k]; setChecks(cs); commit(lines, cs); };
  return (
    <div>
      {lines.map((t, k) => {
        const done = marker === "check" && !!checks[k];
        return (
          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "0 4px 0 10px", borderTop: k ? `1px solid ${ROW_LINE}` : "none" }}>
            {marker === "check"
              ? <span style={{ paddingTop: 7 }}><Tick on={done} color={C.green} size={18} onClick={() => tick(k)} /></span>
              : <span style={{ width: 12, flexShrink: 0, textAlign: "right" as const, fontSize: TYPE.subtext.size, color: C.muted, paddingTop: 8 }}>{marker === "numbers" ? `${k + 1}.` : "•"}</span>}
            <div style={{ position: "relative", flex: 1, minWidth: 0, height: 32 }}>
              <textarea ref={el => { refs.current[k] = el; fit(el); }} rows={1} value={t} placeholder={k === 0 ? placeholder : ""} aria-label={`${Noun} ${k + 1}`}
                onChange={(e) => { fit(e.target); setLines(ls => ls.map((x, i) => (i === k ? e.target.value.replace(/\n/g, " ") : x))); }}
                onBlur={() => { if (lines.length === 1 && !lines[0].trim()) { setLines([]); setChecks([]); } commit(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); insertAfter(k); }
                  if (e.key === "Backspace" && t === "" && lines.length > 1) { e.preventDefault(); remove(k); }
                }}
                style={{ position: "absolute", left: 0, top: 0, width: `${100 / LK}%`, transform: `scale(${LK})`, transformOrigin: "left top",
                  border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 16, lineHeight: 1.4, color: done ? C.light : C.black,
                  textDecoration: done ? "line-through" : "none", padding: `${7 / LK}px 0`, resize: "none" as const, overflow: "hidden", boxSizing: "border-box" as const, display: "block", margin: 0 }} />
            </div>
            {(t.trim() || lines.length > 1) && <span style={{ paddingTop: 4 }}><XBtn label={`Delete ${noun} ${k + 1}`} size={24} onClick={() => removeX(k)} /></span>}
          </div>
        );
      })}
      <button onClick={() => insertAfter(lines.length - 1)}
        style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", background: "none", border: "none", borderTop: lines.length ? `1px solid ${ROW_LINE}` : "none", padding: "9px 10px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.muted, textAlign: "left" as const }}>
        <Ico d={IC.plus} size={11} />{addLabel}
      </button>
    </div>
  );
}
const ROW_LINE = "#f0ece7";

// Links: the platform (read from the link) · what it shows · open · delete.
// As many as needed; paste one (or several) into the field at the bottom.
// pillTone (concept page): the platform pill in that platform's colour; grey otherwise.
export function LinkList({ initial, onSave, pillTone }: { initial: { url: string; note: string }[]; onSave: (refs: { url: string; note: string }[]) => void; pillTone?: (platform: string) => ToneSet | null }) {
  const [rows, setRows] = useState(initial.length ? initial : []);
  const [paste, setPaste] = useState("");
  const [fresh, setFresh] = useState<number | null>(null);     // the row just pasted: ready for "what it shows"
  const clean = (rs: { url: string; note: string }[]) => rs.map(r => ({ url: r.url.trim(), note: r.note.trim() })).filter(r => r.url || r.note);
  const commit = (rs: { url: string; note: string }[]) => onSave(clean(rs));
  // links pasted together become one row each; text that isn't a link is kept as a note
  const add = (raw: string) => {
    const text = String(raw || "").trim();
    if (!text) return;
    const links = text.split(/\s+/).filter(isUrlLike);
    const added = links.length ? links.map(url => ({ url, note: "" })) : [{ url: "", note: text }];
    const rs = [...rows, ...added];
    setRows(rs); commit(rs); setPaste("");
    setFresh(links.length ? rows.length : null);
  };
  const pill: any = { display: "inline-block", fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, padding: "2px 8px", borderRadius: RADIUS.tag, background: PAL.neutral.fill, color: PAL.neutral.ink, whiteSpace: "nowrap", flexShrink: 0 };
  return (
    <div>
      {rows.map((r, k) => {
        const li = linkInfo(r.url);
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 42, padding: "3px 4px 3px 10px", borderTop: k ? `1px solid ${ROW_LINE}` : "none" }}>
            {(() => {
              const pl = r.url.trim() ? li.platform : "Note", tn = pillTone ? pillTone(pl) : null;
              return <span style={tn ? { ...pill, background: tn.fill, color: tn.ink } : pill}>{pl}</span>;
            })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextInline value={r.note} placeholder="What it shows" ariaLabel={`What link ${k + 1} shows`} autoFocus={fresh === k}
                onSave={v => { const rs = rows.map((x, i) => (i === k ? { ...x, note: v } : x)); setRows(rs); commit(rs); if (fresh === k) setFresh(null); }} />
              {li.short && <div style={{ fontSize: TYPE.label.size, color: C.muted, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", marginTop: -2 }}>{li.short}</div>}
            </div>
            {li.href
              ? <a href={li.href} target="_blank" rel="noreferrer" aria-label={`Open link ${k + 1}`} title="Open"
                  style={{ width: 24, height: 24, borderRadius: "50%", background: PAL.neutral.fill, color: PAL.neutral.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={IC.open} size={12} /></a>
              : <span style={{ width: 24, flexShrink: 0 }} />}
            <XBtn label={`Delete link ${k + 1}`} size={24} onClick={() => {
              const before = rows, rs = rows.filter((_, i) => i !== k);
              setRows(rs); commit(rs);
              if (r.url.trim() || r.note.trim()) showUndo("Link deleted", () => { setRows(before); commit(before); });
            }} />
          </div>
        );
      })}
      <div style={{ padding: rows.length ? "5px 10px 8px" : "8px 10px", borderTop: rows.length ? `1px solid ${ROW_LINE}` : "none" }}>
        <MiniInput h={32} value={paste} placeholder="Paste a TikTok or Instagram link" inputMode="url" aria-label="Paste a link"
          onChange={(e: any) => setPaste(e.target.value)}
          onPaste={(e: any) => { const t = e.clipboardData?.getData("text"); if (t && t.trim()) { e.preventDefault(); add(t); } }}
          onBlur={() => add(paste)}
          onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); add(paste); } }} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SPRINT WINDOW (Stage 2) — focus, goals, results and the review
// Read view → Edit → Save returns to the read view. End sprint
// moves it to the past sprints; the review can follow any time.
// ═════════════════════════════════════════════════════════════
const shortDM = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
export const sprintRange = (sp: { startOn: string; endOn: string }) => `${shortDM(sp.startOn)}–${fmtD(sp.endOn)}`;
export const sprintDay = (sp: { startOn: string; endOn: string }, on: string) => {
  const total = daysBetween(sp.startOn, sp.endOn) + 1;
  const day = Math.min(total, Math.max(0, daysBetween(sp.startOn, on) + 1));
  return { day, total };
};

export function SprintWindow({ planner, sprintId, draft, isMobile, onClose, review }: {
  planner: PlannerHook; sprintId?: string; draft?: Partial<Sprint>; isMobile: boolean; onClose: () => void; review?: boolean;
}) {
  const [id, setId] = useState<string | undefined>(sprintId);
  const sp = planner.sprints.find(x => x.id === id);
  const weeksOf = (x?: Partial<Sprint>) => (x?.startOn && x?.endOn ? Math.max(1, Math.round((daysBetween(x.startOn, x.endOn) + 1) / 7)) : 2);
  // "new" = start a sprint · "review" = End & review · "edit" = change it · "read"
  const [mode, setMode] = useState<"new" | "review" | "edit" | "read">(!sprintId ? "new" : review ? "review" : "read");
  const [f, setF]       = useState<Partial<Sprint>>(sp || draft || {});
  const [res, setRes]   = useState<SprintResults>(sp?.results || {});
  const [weeks, setWeeks] = useState<number>(weeksOf(sp || draft));
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk]   = useState<null | "delete">(null);
  useEffect(() => { if (mode === "read" && sp) { setF(sp); setRes(sp.results || {}); setWeeks(weeksOf(sp)); } }, [sp, mode]);
  useEffect(() => { if (id && !sp && !planner.loading) onClose(); }, [id, sp, planner.loading]);

  const save = async () => {
    setErr(null);
    if (mode === "new" || mode === "edit") {
      if (!f.startOn) { setErr("Pick the start day."); return; }
      if (!weeks || weeks < 1) { setErr("A sprint is at least 1 week."); return; }
    }
    setBusy(true);
    try {
      if (mode === "review" && sp) {
        await planner.updateSprint(sp.id, { results: res, status: "done" });
        setMode("read");
      } else {
        const fields: Partial<Sprint> = {
          startOn: f.startOn, endOn: addDays(f.startOn!, weeks * 7 - 1), focusCategory: f.focusCategory || "", focusTier: f.focusTier || "",
          pitchGoal: f.pitchGoal ?? null, followUpGoal: f.followUpGoal ?? null, ...(sp ? { results: res } : {}),
        };
        if (sp) await planner.updateSprint(sp.id, fields);
        else { const n = await planner.createSprint({ ...fields, account: f.account as Account, days: {}, results: {} }); setId(n.id); }
        setMode("read");
      }
    } catch (e: any) { setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async () => { setAsk(null); if (!sp) return; try { await planner.deleteSprint(sp.id); onClose(); } catch (e: any) { setErr(e?.message || "Couldn't delete."); } };

  const st = sp ? planner.sprintStats(sp) : null;
  const d = sp ? sprintDay(sp, today()) : null;
  const num = (v: any) => (v === "" || v == null ? null : parseIntDe(String(v)));
  const statRow = (label: string, value: any) => (
    <div style={{ minHeight: 36, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${C.rule}`, fontSize: 14 }}>
      <span style={microLabel}>{label}</span><span style={{ textAlign: "right" as const }}>{value}</span>
    </div>
  );
  const resultFields = (
    <>
      <Lbl>Results · from your contacts</Lbl>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
        <div><Lbl>Replied</Lbl><MiniInput inputMode="numeric" aria-label="Replied" placeholder="–" value={res.replied == null ? "" : String(res.replied)} onChange={(e: any) => setRes({ ...res, replied: num(e.target.value) })} /></div>
        <div><Lbl>Gifted</Lbl><MiniInput inputMode="numeric" aria-label="Gifted" placeholder="–" value={res.gifted == null ? "" : String(res.gifted)} onChange={(e: any) => setRes({ ...res, gifted: num(e.target.value) })} /></div>
        <div><Lbl>Deals</Lbl><MiniInput inputMode="numeric" aria-label="Deals" placeholder="–" value={res.deals == null ? "" : String(res.deals)} onChange={(e: any) => setRes({ ...res, deals: num(e.target.value) })} /></div>
      </div>
      <Lbl>Worked</Lbl>
      <MiniInput aria-label="Worked" value={res.worked || ""} placeholder="What worked" onChange={(e: any) => setRes({ ...res, worked: e.target.value })} />
      <Lbl>Change</Lbl>
      <MiniInput aria-label="Change" value={res.change || ""} placeholder="What to do differently next sprint" onChange={(e: any) => setRes({ ...res, change: e.target.value })} />
    </>
  );
  const title = mode === "new" ? "New sprint" : mode === "review" && sp ? `Sprint ${sp.num} · review` : sp ? `Sprint ${sp.num}` : "Sprint";

  return (
    <>
      {ask === "delete" && sp && <ConfirmDialog title={`Delete Sprint ${sp.num}?`} text="The sprint, its day numbers and its review are removed." okLabel="Delete" danger onOk={del} onCancel={() => setAsk(null)} />}
      <Window title={title} isMobile={isMobile}
        onClose={() => { if ((mode === "edit") && sp) { setMode("read"); setErr(null); } else onClose(); }}
        footer={mode === "read" ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <MoreMenu items={[{ label: "Delete sprint", danger: true, onClick: () => setAsk("delete") }]} />
            <div style={{ display: "flex", gap: 8 }}>
              {sp?.status === "active" && <B v="sec" onClick={() => { setRes(sp.results || {}); setMode("review"); }}>End &amp; review</B>}
              <B onClick={() => setMode("edit")}>Edit</B>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <B v="sec" onClick={() => { if (sp && mode !== "review") { setMode("read"); setErr(null); } else onClose(); }}>Cancel</B>
            <B onClick={save} s={{ opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : mode === "new" ? "Start sprint" : mode === "review" ? "Close sprint" : "Save"}</B>
          </div>
        )}>
        {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
        {mode === "read" && sp && st && d ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
              <AccChip acc={sp.account} />
              <span style={microLabel}>{sp.status === "active" ? `Running · day ${d.day} of ${d.total}` : "Done"}</span>
            </div>
            <p style={{ fontSize: 14, margin: "8px 0 0" }}>{sprintRange(sp)} · {weeksOf(sp)} {weeksOf(sp) === 1 ? "week" : "weeks"}</p>
            <Lbl>Focus</Lbl>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
              {sp.focusCategory ? <CatChip k={sp.focusCategory} /> : <span style={{ fontSize: 14 }}>Any category</span>}
              <span style={{ fontSize: 14 }}>· {OUTREACH_TIERS.find(t => t.key === sp.focusTier)?.label || "Any tier"}</span>
            </div>
            <Lbl>Numbers</Lbl>
            <div style={{ borderTop: `1px solid ${C.rule}` }}>
              {statRow("Pitches", `${st.pitches} / ${sp.pitchGoal ?? "–"}`)}
              {statRow("Follow-ups", `${st.followUps} / ${sp.followUpGoal ?? "–"}`)}
              {sp.status === "done" && <>
                {statRow("Replied", sp.results.replied ?? "–")}
                {statRow("Gifted", sp.results.gifted ?? "–")}
                {statRow("Deals", sp.results.deals ?? "–")}
                {statRow("Reply rate", st.rate == null ? "–" : fmtPct2(st.rate))}
              </>}
            </div>
            {sp.status === "done" && <>{textBlock("Worked", sp.results.worked || "")}{textBlock("Change", sp.results.change || "")}</>}
            {sp.status === "active" && <p style={{ fontSize: 12, color: C.muted, margin: "10px 0 0" }}>At the end: End &amp; review, then type the results and what to change.</p>}
          </div>
        ) : mode === "review" && sp && st ? (
          <div>
            <p style={{ fontSize: 14, margin: 0 }}>{sprintRange(sp)} · {st.pitches} pitches · {st.followUps} follow-ups</p>
            {resultFields}
          </div>
        ) : (
          <div>
            {mode === "new" && (
              <>
                <Lbl>Account</Lbl>
                <MiniSelect value={f.account || "lynnhoa"} onChange={(e: any) => setF({ ...f, account: e.target.value })}>
                  {ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </MiniSelect>
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
              <div><Lbl>Start</Lbl><MiniInput type="date" value={f.startOn || ""} onChange={(e: any) => setF({ ...f, startOn: e.target.value })} /></div>
              <div><Lbl>Weeks</Lbl><MiniInput inputMode="numeric" aria-label="Weeks" value={String(weeks || "")} onChange={(e: any) => setWeeks(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div>
              <div><Lbl>Focus category</Lbl>
                <MiniSelect value={f.focusCategory || ""} aria-label="Focus category" onChange={(e: any) => setF({ ...f, focusCategory: e.target.value })}>
                  <option value="">Any category</option>
                  {OUTREACH_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </MiniSelect>
              </div>
              <div><Lbl>Focus tier</Lbl>
                <MiniSelect value={OUTREACH_TIERS.some(t => t.key === f.focusTier) ? f.focusTier : ""} aria-label="Focus tier" onChange={(e: any) => setF({ ...f, focusTier: e.target.value })}>
                  <option value="">Any tier</option>
                  {OUTREACH_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </MiniSelect>
              </div>
              <div><Lbl>Pitch goal</Lbl><MiniInput inputMode="numeric" aria-label="Pitch goal" value={f.pitchGoal == null ? "" : String(f.pitchGoal)} placeholder="–" onChange={(e: any) => setF({ ...f, pitchGoal: num(e.target.value) })} /></div>
              <div><Lbl>Follow-up goal</Lbl><MiniInput inputMode="numeric" aria-label="Follow-up goal" value={f.followUpGoal == null ? "" : String(f.followUpGoal)} placeholder="–" onChange={(e: any) => setF({ ...f, followUpGoal: num(e.target.value) })} /></div>
            </div>
            {f.startOn && weeks > 0 && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Ends {fmtD(addDays(f.startOn, weeks * 7 - 1))}{f.pitchGoal ? ` · daily target ${Math.ceil(f.pitchGoal / (weeks * 5))} pitches over ${weeks * 5} work days` : ""}</p>}
            {mode === "edit" && sp?.status === "done" && resultFields}
          </div>
        )}
      </Window>
    </>
  );
}
