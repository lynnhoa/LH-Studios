// ─────────────────────────────────────────────────────────────
// PlannerWindows — the Planner's windows (one level, like the
// Outreach contact window) and the small pieces they share.
//   Task window   read view → Edit → Save returns to the read view
//   Plan week     this week's numbers in one go
//   Stage window  goal, done-when checklist, Start next stage
// Extra actions (Delete …) sit in the ⋯ menu; one main button.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, Z } from "./constants";
import { fmtD, today, monthStart, monthEnd, ymd } from "./formatters";
import { B, I, S, Lbl, Tick, ConfirmDialog, BAR_BTN } from "./atoms";
import {
  ACCOUNTS, PHASES, OWNERS, RHYTHMS, STATUSES, STAGE_SHORT, DAY_SHORT, accLook, phaseLabel, ownerLabel, rhythmLabel, rowKind, entryKey, periodOf, snapKey, addDays, isoWeek, weekRange, weekLabel, thisMonday, monthName, todayIndex, gateOf, stageNumOf, taskAccounts, isVisible, byOrder, fmtInt, fmtPct2, parseDec, parseIntDe, ITEM_STATUSES, FORMATS, CLASSIC, formatLook, itemStatusLabel, daysBetween, OWNER_LOOK, monthGoalOf, monthGoalPatch, loadWorkAccount, storyLines,
} from "./planner";
import type { Task, Stage, TaskAccount, AccountFilter, Phase, Rhythm, Item, ItemList, ItemStatus, ItemPlan, Account, NoteKind, Sprint, SprintResults, Owner } from "./planner";
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
// One tap switches the whole Planner (remembered on this device, same as the
// profile menu). A number still being typed is saved first, to the account it
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

// ── one-level window: full screen on the phone, centred elsewhere ─
export function Window({ title, isMobile, onClose, children, footer }: { title: string; isMobile: boolean; onClose: () => void; children: any; footer?: any }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: Z.modal, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "center", background: isMobile ? C.bg : "rgba(250,249,247,0.85)", fontFamily: SANS, color: C.black }}>
      <div style={{ width: "100%", maxWidth: isMobile ? "none" : 480, maxHeight: isMobile ? "none" : "88vh", background: C.bg, border: isMobile ? "none" : `1px solid ${C.rule}`, borderRadius: isMobile ? 0 : 2, boxShadow: isMobile ? "none" : "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", paddingTop: isMobile ? "env(safe-area-inset-top)" : 0 }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 8px 0 2px", borderBottom: `1px solid ${C.rule}`, flexShrink: 0, background: C.white }}>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20, flexShrink: 0 }}>✕</button>
          <span style={{ fontFamily: SERIF, fontSize: 15, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{title}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 16px" }}>{children}</div>
        {footer && <div style={{ padding: `10px 14px ${isMobile ? "calc(10px + env(safe-area-inset-bottom))" : "10px"}`, borderTop: `1px solid ${C.rule}`, flexShrink: 0, background: C.white }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ⋯ menu: extra actions in a small dropdown (opens upwards from the footer)
export function MoreMenu({ items }: { items: { label: string; danger?: boolean; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />}
      <button onClick={() => setOpen(o => !o)} aria-label="More" title="More"
        style={{ width: 36, height: 36, border: `1px solid ${C.rule}`, borderRadius: 2, background: "transparent", color: C.black, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2 }}>
        <Ico d={IC.more} size={18} />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", left: 0, bottom: "calc(100% + 6px)", minWidth: 170, background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: "4px 0", zIndex: 3 }}>
          {items.map(it => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              style={{ display: "flex", alignItems: "center", width: "100%", height: 34, padding: "0 12px", border: "none", background: "none", color: it.danger ? C.red : C.black, fontFamily: SANS, fontSize: 13, cursor: "pointer", textAlign: "left" as const }}>
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
const area: any = { width: "100%", minHeight: 72, padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: 16, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const };
const int = (v: string): number | null => { const n = parseInt(String(v).replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : null; };

// ═════════════════════════════════════════════════════════════
// TASK WINDOW
// ═════════════════════════════════════════════════════════════
const EMPTY_DRAFT: Partial<Task> = { title: "", account: "both", owner: "creator", phase: "maintain", rhythm: "weekly", stageNum: 1, measure: null, how: "", doneWhen: "", link: "" };

export function TaskWindow({ planner, taskId, draft, monday, isMobile, onClose, openOutreach, openTab }: {
  planner: PlannerHook; taskId?: string; draft?: Partial<Task>; monday: string; isMobile: boolean; onClose: () => void;
  openOutreach?: () => void; openTab?: (tab: string) => void;
}) {
  const [id, setId]       = useState<string | undefined>(taskId);
  const task              = planner.tasks.find(t => t.id === id);
  const [edit, setEdit]   = useState(!taskId);
  const [f, setF]         = useState<Partial<Task>>(task || { ...EMPTY_DRAFT, ...draft });
  const [err, setErr]     = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { if (!edit && task) setF(task); }, [task, edit]);

  // a task that was deleted elsewhere closes its window
  useEffect(() => { if (id && !task && !planner.loading) onClose(); }, [id, task, planner.loading]);

  const set = (patch: Partial<Task>) => setF(prev => {
    const n = { ...prev, ...patch };
    // setup and refine are one-time; maintain repeats
    if (patch.phase && patch.phase !== "maintain") n.rhythm = "once";
    if (patch.phase === "maintain" && n.rhythm === "once") n.rhythm = "weekly";
    if (patch.rhythm && patch.rhythm !== "once" && n.phase !== "maintain") n.phase = "maintain";
    if (patch.rhythm === "once" && n.phase === "maintain") n.phase = "setup";
    return n;
  });

  const save = async () => {
    setErr(null);
    if (!String(f.title || "").trim()) { setErr("Give the task a name."); return; }
    setBusy(true);
    try {
      const fields: Partial<Task> = {
        title: f.title, account: f.account, owner: f.owner, phase: f.phase, rhythm: f.rhythm, stageNum: Number(f.stageNum) || 1,
        measure: f.phase === "maintain" ? (f.measure || null) : (task?.measure ?? null),
        how: f.how || "", doneWhen: f.doneWhen || "", link: f.link || "",
      };
      if (task) await planner.updateTask(task.id, fields);
      else { const t = await planner.createTask(fields); setId(t.id); }
      setEdit(false);
    } catch (e: any) { setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async () => {
    setAskDelete(false);
    if (!task) return;
    try { await planner.deleteTask(task.id); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };

  // the one main action of this task, in the footer (every tick can be undone here too)
  const primary = (() => {
    if (!task || edit) return null;
    const st = planner.stateOf(task, monday);
    const period = periodOf(task, monday);
    const kind = rowKind(task);
    const ti = todayIndex(monday);
    if (["ideas", "posts", "pieces", "portfolio_total"].includes(task.source))
      return openTab ? { label: "Open Creator", run: () => { onClose(); openTab("creator"); } } : null;
    if (task.source === "outreach" || task.source === "pitches")
      return openOutreach ? { label: "Open Outreach", run: openOutreach } : null;
    if (kind === "days")
      return ti >= 0 ? { label: st.days[ti] ? "Untick today" : "Tick today", run: () => { const days = [...st.days]; days[ti] = !days[ti]; quietP(planner.saveEntry(task.id, period, { days })); } } : null;
    if (kind === "check")
      return task.rhythm === "once"
        ? { label: st.done ? "Reopen" : "Mark done", run: () => quietP(planner.setTaskStatus(task, st.done ? "open" : "done")) }
        : { label: st.done ? "Undo" : "Mark done", run: () => quietP(planner.saveEntry(task.id, period, { done: !st.done })) };
    return null;
  })();

  const title = edit ? (task ? "Edit task" : "New task") : (task?.title || "Task");

  return (
    <>
      {askDelete && task && <ConfirmDialog title={`Delete “${task.title}”?`} text="The task and its weekly ticks and numbers are removed." okLabel="Delete" danger onOk={del} onCancel={() => setAskDelete(false)} />}
      <Window title={title} isMobile={isMobile} onClose={() => { if (edit && task) { setEdit(false); setErr(null); } else onClose(); }}
        footer={edit ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <B v="sec" onClick={() => { if (task) { setEdit(false); setErr(null); } else onClose(); }}>Cancel</B>
            <B onClick={save} s={{ opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</B>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <MoreMenu items={[
              { label: "Edit task", onClick: () => { setF(task!); setEdit(true); } },
              { label: "Delete task", danger: true, onClick: () => setAskDelete(true) },
            ]} />
            {primary ? <B onClick={primary.run}>{primary.label}</B> : <B v="sec" onClick={onClose}>Close</B>}
          </div>
        )}>
        {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
        {edit ? <TaskForm f={f} set={set} stages={planner.stages} /> : task ? <TaskRead task={task} planner={planner} monday={monday} /> : null}
      </Window>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// TASK READ VIEW
//   who · rhythm · account
//   status card (owner colour): the number or Done / Not done yet,
//     and what's left — amber when it needs you, green when done
//   the work, right here (one white card per task kind)
//   note for this week / month (for the check-in)
//   How it's done (folds away) · last 4 weeks
// ═════════════════════════════════════════════════════════════
function TaskRead({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const period = periodOf(task, monday);
  const st     = planner.stateOf(task, monday);
  const kind   = rowKind(task);
  const ti     = todayIndex(monday);
  const look   = OWNER_LOOK[task.owner];
  const [howOpen, setHowOpen] = useState(false);
  const periodWord = task.rhythm === "monthly" ? `in ${monthName(period)}` : `in week ${isoWeek(monday)}`;

  // ── status card ─────────────────────────────────────────────
  const a = st.actual ?? 0;
  const left = st.target != null ? Math.max(0, st.target - a) : null;
  let big = "", label = "", sub = "", subColor: string = C.muted;
  let bar: null | { value: number; max: number } = null;
  if (task.source === "portfolio_total") {
    big = `${a} / ${st.target ?? "–"}`; label = "Pieces for the first set"; bar = { value: a, max: st.target ?? 0 };
    if (st.done) { sub = "First set complete ✓"; subColor = C.green; } else { sub = `${left} more ${left === 1 ? "piece" : "pieces"} to go`; subColor = C.amber; }
  } else if (task.source === "kit_waiting") {
    big = String(a); label = a === 1 ? "Piece waiting for the kits" : "Pieces waiting for the kits";
    if (st.done) { sub = "Nothing waiting ✓"; subColor = C.green; } else { sub = "Add them to the kits, then tap In kit"; subColor = C.amber; }
  } else if (task.source === "snapshot") {
    const sn = task.account !== "both" ? planner.snaps[snapKey(task.account, monday)] : undefined;
    big = sn?.followers != null ? fmtInt(sn.followers) : "–"; label = `Followers · week ${isoWeek(monday)}`;
    if (st.done) { sub = "Entered ✓"; subColor = C.green; } else { sub = "Not entered yet — fill in below"; subColor = C.amber; }
  } else if (kind === "days") {
    big = `${st.daysDone} / 7`; label = `Days in week ${isoWeek(monday)}`; bar = { value: st.daysDone, max: 7 };
    if (ti >= 0) { if (st.days[ti]) { sub = "Today ✓"; subColor = C.green; } else { sub = "Today isn't ticked yet"; subColor = C.amber; } }
  } else if (kind === "number") {
    big = `${a} / ${st.target ?? "–"}`; label = `${task.measure} ${periodWord}`; bar = { value: a, max: st.target ?? 0 };
    if (st.done) { sub = "Reached ✓"; subColor = C.green; }
    else if (st.target == null) { sub = "No number yet — set it in Plan week"; subColor = C.amber; }
    else { sub = `${left} more to reach this week's number`; subColor = C.amber; }
  } else if (task.rhythm === "once") {
    big = st.done ? "Done" : task.status === "in_progress" ? "In progress" : "Open";
    label = `${phaseLabel(task.phase)} · stage ${task.stageNum}`;
    if (st.done) { sub = task.doneOn ? `Done on ${fmtD(task.doneOn)} ✓` : "Done ✓"; subColor = C.green; }
    else { sub = "Tap Mark done when it's finished"; }
  } else {
    big = st.done ? "Done" : "Not done yet"; label = task.rhythm === "monthly" ? `For ${monthName(period)}` : `In week ${isoWeek(monday)}`;
    if (st.done) { sub = "Done ✓ — tap Undo if that was a mistake"; subColor = C.green; } else { sub = "Tap Mark done when it's done"; }
  }

  // last 4 weeks (this one included) for weekly and daily tasks
  // (the kit handover has no history: it only knows what is waiting now)
  const history = (task.rhythm === "daily" || task.rhythm === "weekly") && task.source !== "kit_waiting"
    ? [-21, -14, -7, 0].map(off => {
        const p = addDays(monday, off);
        const s2 = planner.stateOf(task, p);
        const value = kind === "number" ? `${s2.actual ?? 0}/${s2.target ?? "–"}` : kind === "days" ? `${s2.daysDone}/7` : s2.done ? "✓" : "–";
        return { p, s: s2, value, current: off === 0 };
      })
    : [];

  return (
    <div>
      {/* who · rhythm · account */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
        <OwnerPill owner={task.owner} />
        <span style={microLabel}>{rhythmLabel(task.rhythm)}{task.phase === "refine" ? " · until settled" : ""}{task.stageNum > 1 ? ` · Stage ${task.stageNum}` : ""}</span>
        {task.account === "both"
          ? <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${C.rule}`, color: C.muted, whiteSpace: "nowrap" as const }}>Both accounts</span>
          : <AccChip acc={task.account} />}
      </div>

      {/* status */}
      <div style={{ marginTop: 12, background: look.bg, border: `1px solid ${look.border}`, borderRadius: 3, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" as const }}>
          <span style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1 }}>{big}</span>
          <span style={{ ...microLabel, color: look.color }}>{label}</span>
        </div>
        {bar && <Bar value={bar.value} max={bar.max} done={st.done} color={look.color} track={look.border} h={4} s={{ marginTop: 10 }} />}
        {sub && (
          <div style={{ fontSize: 12, marginTop: 8, color: subColor, display: "flex", alignItems: "center", gap: 6 }}>
            {subColor === C.amber && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />}
            {sub}
          </div>
        )}
      </div>

      {/* the work, right here */}
      <WorkCard task={task} planner={planner} monday={monday} />

      {/* note for the check-in */}
      {task.rhythm !== "once" && <NoteCard task={task} planner={planner} period={period} label={task.rhythm === "monthly" ? `Note for ${monthName(period)}` : `Note for week ${isoWeek(monday)}`} />}

      {/* how it's done — folds away */}
      {(task.how || task.doneWhen) && (
        <Card pad={false}>
          <button onClick={() => setHowOpen(o => !o)} aria-expanded={howOpen}
            style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 14, color: C.black }}>
            <span>How it's done</span><Ico d={howOpen ? IC.up : IC.down} size={14} color={C.muted} />
          </button>
          {howOpen && <div style={{ padding: "0 12px 12px", marginTop: -8 }}>{textBlock("How", task.how)}{textBlock("Done when", task.doneWhen)}</div>}
        </Card>
      )}

      {history.length > 0 && (
        <>
          <Lbl>Last weeks</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>
            {history.map(h => (
              <div key={h.p} style={{ border: `1px solid ${h.current ? C.black : h.s.done ? "#b8d4b8" : C.rule}`, background: h.s.done ? "#f0f5f0" : C.white, borderRadius: 2, padding: "6px 4px", textAlign: "center" as const }}>
                <div style={{ ...microLabel, color: h.current ? C.black : h.s.done ? C.green : C.muted }}>W{isoWeek(h.p)}</div>
                <div style={{ fontSize: 13, marginTop: 2, color: h.s.done ? C.green : C.black }}>{h.value}{h.s.done && h.value !== "✓" ? " ✓" : ""}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Work cards: what this task is about, to do right here ─────
const grid3: any = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 };
const quietP = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });
const dm = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : "");
const itemLine = (key: string, title: string, right: any, last = false) => (
  <div key={key} style={{ minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: last ? "none" : `1px solid #f0ece7`, fontSize: 14 }}>
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{title}</span>
    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>{right}</span>
  </div>
);
const tagText = (t: string, color: string = C.muted) => <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>{t}</span>;
const emptyLine = (t: string) => <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{t}</p>;

function WorkCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const period = periodOf(task, monday);
  const kind   = rowKind(task);
  switch (task.source) {
    case "ideas":           return <IdeasCard task={task} planner={planner} period={period} />;
    case "posts":           return <PostsCard task={task} planner={planner} monday={monday} portfolioOnly={false} />;
    case "pieces":          return <PostsCard task={task} planner={planner} monday={monday} portfolioOnly={true} />;
    case "portfolio_total": return <FirstSetCard task={task} planner={planner} />;
    case "kit_waiting":     return <KitCard task={task} planner={planner} />;
    case "outreach":        return <OutreachCard task={task} planner={planner} period={period} />;
    case "pitches":         return <PitchesCard task={task} planner={planner} monday={monday} />;
    case "following":       return <FollowingCard task={task} planner={planner} monday={monday} />;
    case "snapshot":        return <SnapshotCard task={task} planner={planner} monday={monday} />;
  }
  if (kind === "days") return <DaysCard task={task} planner={planner} monday={monday} />;
  if (task.rhythm === "monthly" && task.area === "portfolio") return <MonthGoalCard task={task} planner={planner} monday={monday} />;
  if (task.rhythm === "once") return <OnceCard task={task} planner={planner} />;
  if (kind === "number") return <TypedNumberCard task={task} planner={planner} monday={monday} />;
  return null;
}

// A number field that saves when you leave it (or press Enter)
export function NumField({ label, value, onSave, decimal }: { label: string; value: number | null; onSave: (v: number | null) => void; decimal?: boolean }) {
  // German format in the field too: 1.180 · 4,85
  const show = (v: number | null) => (v == null ? "" : decimal
    ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString("de-DE"));
  const [t, setT] = useState(show(value));
  useEffect(() => { setT(show(value)); }, [value]);
  const commit = () => {
    const v = t.trim() === "" ? null : decimal ? parseDec(t) : parseIntDe(t);
    if (v !== value) onSave(v);
  };
  return (
    <div><Lbl>{label}</Lbl>
      <I inputMode={decimal ? "decimal" : "numeric"} value={t} placeholder="–" aria-label={label}
        onChange={(e: any) => setT(e.target.value.replace(/[^\d,.]/g, ""))}
        onBlur={commit} onKeyDown={(e: any) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

// Ideas added this week, and a quick add
function IdeasCard({ task, planner, period }: { task: Task; planner: PlannerHook; period: string }) {
  const accs = taskAccounts(task);
  const list = planner.items.filter(i => i.list === "idea" && accs.includes(i.account) && i.createdWeek === period)
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const [t, setT] = useState("");
  const [busy, setBusy] = useState(false);
  const acc = (task.account === "both" ? loadWorkAccount() : task.account) as Account;
  const add = async () => {
    const title = t.trim();
    if (!title || busy) return;
    setBusy(true);
    try { await planner.createItem({ list: "idea", account: acc, title, format: CLASSIC, status: "idea", portfolio: false, direction: "", link: "", plannedOn: null, views: null }); setT(""); }
    catch { /* the save toast reports it */ }
    finally { setBusy(false); }
  };
  return (
    <Card title="Added this week" right={list.length}>
      {list.length === 0 ? emptyLine("No ideas yet this week.") : list.map((i, k) => itemLine(i.id, i.title, tagText(`${itemStatusLabel(i.status)} · ${dm(ymd(new Date(i.createdAt)))}`), k === list.length - 1))}
      {period === thisMonday() && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <I value={t} onChange={(e: any) => setT(e.target.value)} placeholder="New idea" aria-label="New idea"
            onKeyDown={(e: any) => { if (e.key === "Enter") add(); }} s={{ flex: 1, minWidth: 0 }} />
          <B v="sec" onClick={add} s={{ ...BAR_BTN, height: 36, minHeight: 36, color: C.black, flexShrink: 0, opacity: busy ? 0.5 : 1 }}>Add</B>
        </div>
      )}
    </Card>
  );
}

// Posts (or portfolio pieces) this week: posted ones, and planned ones with one tap to Posted
function PostsCard({ task, planner, monday, portfolioOnly }: { task: Task; planner: PlannerHook; monday: string; portfolioOnly: boolean }) {
  const accs = taskAccounts(task);
  const end = addDays(monday, 6);
  const mine = planner.items.filter(i => accs.includes(i.account) && (!portfolioOnly || i.portfolio));
  const posted  = mine.filter(i => (i.status === "posted" || i.status === "in_kit") && !!i.postedOn && i.postedOn >= monday && i.postedOn <= end);
  const planned = mine.filter(i => i.status !== "posted" && i.status !== "in_kit" && !!i.plannedOn && i.plannedOn >= monday && i.plannedOn <= end);
  const all = [...planned.map(i => ({ i, posted: false })), ...posted.map(i => ({ i, posted: true }))];
  return (
    <Card title={portfolioOnly ? "Portfolio pieces this week" : "Posts this week"} right={`${posted.length} posted`}>
      {all.length === 0 ? emptyLine("Nothing planned or posted this week. Plan it in Creator.") : all.map(({ i, posted: p }, k) => itemLine(i.id, i.title,
        p ? tagText(`Posted ${dm(i.postedOn)}`, C.green)
          : <>{tagText(`Planned ${dm(i.plannedOn)}`)}<B v="sec" onClick={() => quietP(planner.setItemStatus(i, "posted"))} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black }}>Posted</B></>,
        k === all.length - 1))}
    </Card>
  );
}

// The first set: which pieces count so far
function FirstSetCard({ task, planner }: { task: Task; planner: PlannerHook }) {
  const accs = taskAccounts(task);
  const list = planner.items.filter(i => accs.includes(i.account) && i.portfolio && (i.status === "posted" || i.status === "in_kit"))
    .sort((x, y) => String(y.postedOn || "").localeCompare(String(x.postedOn || "")));
  return (
    <Card title="Counted so far" right={list.length}>
      {list.length === 0 ? emptyLine("No portfolio piece posted yet.") : list.map((i, k) => itemLine(i.id, i.title, tagText(i.status === "in_kit" ? "In kit" : "Posted", C.green), k === list.length - 1))}
    </Card>
  );
}

// Kit handover: waiting pieces (one tap: In kit), what's in the kits, and the kit files
function KitCard({ task, planner }: { task: Task; planner: PlannerHook }) {
  const accs = taskAccounts(task);
  const waiting = planner.waiting.filter(i => accs.includes(i.account));
  const inKit = planner.items.filter(i => accs.includes(i.account) && i.status === "in_kit")
    .sort((x, y) => String(y.postedOn || "").localeCompare(String(x.postedOn || "")));
  const files = planner.tasks.filter(t => t.active && t.area === "kit" && t.phase !== "maintain" && (accs.includes(t.account as Account) || t.account === "both") && t.title !== "Email template" && t.title !== "Tracking system");
  return (
    <>
      <Card title="Waiting" right={waiting.length}>
        {waiting.length === 0 ? <p style={{ fontSize: 13, color: C.green, margin: 0 }}>Nothing waiting ✓</p> : waiting.map((i, k) => itemLine(i.id, i.title,
          <B v="sec" onClick={() => quietP(planner.setItemStatus(i, "in_kit"))} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black }}>In kit</B>, k === waiting.length - 1))}
      </Card>
      <Card title="In the kits" right={inKit.length}>
        {inKit.length === 0 ? emptyLine("No pieces in the kits yet.") : inKit.slice(0, 6).map((i, k, arr) => itemLine(i.id, i.title, tagText(dm(i.postedOn)), k === arr.length - 1))}
        {inKit.length > 6 && <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>+{inKit.length - 6} more</p>}
      </Card>
      {files.length > 0 && (
        <Card title="Kit files">
          {files.map((t, k) => itemLine(t.id, t.title, t.link
            ? <a href={t.link} target="_blank" rel="noreferrer" style={{ color: C.black, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}><Ico d={IC.link} size={12} />Open</a>
            : tagText("No file linked"), k === files.length - 1))}
        </Card>
      )}
    </>
  );
}

// New email contacts this week, by category and tier
function OutreachCard({ task, planner, period }: { task: Task; planner: PlannerHook; period: string }) {
  const list   = planner.newContacts(period);
  const byCat  = OUTREACH_CATEGORIES.map(c => ({ c, n: list.filter(x => x.category === c.key).length })).filter(x => x.n);
  const byTier = OUTREACH_TIERS.map(t => ({ t, n: list.filter(x => x.tier === t.key).length })).filter(x => x.n);
  return (
    <Card title="Added in Outreach this week" right={list.length}>
      {list.length === 0 ? emptyLine("No new contacts yet this week.") : (
        <>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>{byCat.map(x => <CountChip key={x.c.key} label={x.c.label} n={x.n} look={x.c} />)}</div>
          {byTier.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, alignItems: "center", marginTop: 8 }}><span style={microLabel}>Tiers</span>{byTier.map(x => <CountChip key={x.t.key} label={x.t.label} n={x.n} />)}</div>}
        </>
      )}
      {planner.outreachError && <p style={{ fontSize: 12, color: C.red, margin: "8px 0 0" }}>Outreach couldn't be read ({planner.outreachError}).</p>}
    </Card>
  );
}

// Pitches by day (from the pitch log in Outreach)
function PitchesCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const list = planner.pitchesInWeek(taskAccounts(task), monday);
  const ti   = todayIndex(monday);
  const per  = DAY_SHORT.map((_, k) => list.filter(p => p.kind === "pitch" && p.sentOn === addDays(monday, k)).length);
  const fu   = list.filter(p => p.kind === "follow_up").length;
  return (
    <Card title="Pitches by day" right={`${fu} ${fu === 1 ? "follow-up" : "follow-ups"}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4 }}>
        {DAY_SHORT.map((d, k) => (
          <div key={d} style={{ border: `1px solid ${k === ti ? C.black : C.rule}`, borderRadius: 2, padding: "5px 0", textAlign: "center" as const }}>
            <div style={{ ...microLabel, fontSize: 9 }}>{d}</div>
            <div style={{ fontSize: 14, marginTop: 2, color: per[k] ? C.black : C.light }}>{per[k]}</div>
          </div>
        ))}
      </div>
      {planner.stage2Error && <p style={{ fontSize: 12, color: C.red, margin: "8px 0 0" }}>{planner.stage2Error}</p>}
    </Card>
  );
}

// Following: three numbers, only follow-backs count
function FollowingCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const period = periodOf(task, monday);
  const entry  = planner.entries[entryKey(task.id, period)];
  const st     = planner.stateOf(task, monday);
  const data   = entry?.data || {};
  const num = (v: any): number | null => (v == null || v === "" ? null : Number(v));
  return (
    <Card title={`Log for week ${isoWeek(monday)}`}>
      <div style={{ ...grid3, marginTop: -8 }}>
        <NumField label="Followed" value={num(data.followed)} onSave={v => quietP(planner.saveEntry(task.id, period, { data: { ...data, followed: v } }))} />
        <NumField label="Followed back" value={st.actual} onSave={v => quietP(planner.saveEntry(task.id, period, { actual: v }))} />
        <NumField label="Unfollowed" value={num(data.unfollowed)} onSave={v => quietP(planner.saveEntry(task.id, period, { data: { ...data, unfollowed: v } }))} />
      </div>
    </Card>
  );
}

// Account snapshot: followers, views, engagement from the insights
function SnapshotCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  if (task.account === "both") return <Card>{emptyLine("Pick one account for a snapshot task (··· → Edit task → Account).")}</Card>;
  const acc  = task.account;
  const sn   = planner.snaps[snapKey(acc, monday)];
  const prev = planner.snaps[snapKey(acc, addDays(monday, -7))];
  const save = (patch: any) => quietP(planner.saveSnapshot(acc, monday, patch));
  const diff = sn?.followers != null && prev?.followers != null ? sn.followers - prev.followers : null;
  return (
    <Card title={`Week ${isoWeek(monday)} · from the insights`}>
      <div style={{ ...grid3, marginTop: -8 }}>
        <NumField label="Followers" value={sn?.followers ?? null} onSave={v => save({ followers: v })} />
        <NumField label="Views" value={sn?.views ?? null} onSave={v => save({ views: v })} />
        <NumField label="Engagement %" decimal value={sn?.engagement ?? null} onSave={v => save({ engagement: v })} />
      </div>
      {diff != null && <p style={{ fontSize: 12, margin: "8px 0 0", color: diff >= 0 ? C.green : C.red }}>{diff >= 0 ? "+" : "−"}{fmtInt(Math.abs(diff))} followers since last week</p>}
      {prev && <p style={{ fontSize: 12, color: C.muted, margin: "4px 0 0" }}>Last week: {fmtInt(prev.followers)} followers · {fmtInt(prev.views)} views · {fmtPct2(prev.engagement)}</p>}
    </Card>
  );
}

// Daily task: the 7 days, tap any to tick or untick
function DaysCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const period = periodOf(task, monday);
  const st = planner.stateOf(task, monday);
  const ti = todayIndex(monday);
  return (
    <Card title={`Week ${isoWeek(monday)}`} right={`${st.daysDone} of 7`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4 }}>
        {DAY_SHORT.map((d, i) => {
          const on = st.days[i];
          return (
            <button key={d} onClick={() => { const days = [...st.days]; days[i] = !days[i]; quietP(planner.saveEntry(task.id, period, { days })); }}
              aria-pressed={on} aria-label={`${d}${on ? ", done" : ""}`}
              style={{ height: 48, border: `1px solid ${i === ti ? C.black : on ? C.green : C.rule}`, background: on ? C.green : C.white, color: on ? C.white : C.black, borderRadius: 2, cursor: "pointer", fontFamily: SANS, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 0 }}>
              <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: on ? C.white : i === ti ? C.black : C.muted }}>{d}</span>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{on ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Monthly portfolio goal: the number, and the pieces posted this month
function MonthGoalCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const acc = (task.account === "both" ? loadWorkAccount() : task.account) as Account;
  const ms = monthStart(monday), me = monthEnd(monday);
  const entry = planner.entries[entryKey(task.id, ms)];
  const goal = monthGoalOf(task, entry, acc);
  const done = planner.items.filter(i => i.account === acc && i.portfolio && (i.status === "posted" || i.status === "in_kit") && !!i.postedOn && i.postedOn >= ms && i.postedOn <= me).length;
  return (
    <Card title={`${monthName(monday)} goal`} right={`${done} posted`}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: -8 }}>
        <NumField label="Portfolio pieces" value={goal} onSave={v => quietP(planner.saveEntry(task.id, ms, monthGoalPatch(task, entry, acc, v)))} />
        <div><Lbl>Posted so far</Lbl><div style={{ height: 36, display: "flex", alignItems: "center", fontSize: 14, color: goal != null && done >= goal ? C.green : C.black }}>{done}{goal != null ? ` of ${goal}` : ""}</div></div>
      </div>
      <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Pick the editorials for it in Creator.</p>
    </Card>
  );
}

// One-time task: status, and the file it produced
function OnceCard({ task, planner }: { task: Task; planner: PlannerHook }) {
  const [link, setLink] = useState(task.link || "");
  useEffect(() => { setLink(task.link || ""); }, [task.link]);
  const saveLink = () => { if ((task.link || "") !== link.trim()) quietP(planner.updateTask(task.id, { link: link.trim() })); };
  return (
    <Card>
      <Lbl>Status</Lbl>
      <S value={task.status} onChange={(e: any) => quietP(planner.setTaskStatus(task, e.target.value))}>
        {STATUSES.map(x => <option key={x.key} value={x.key}>{task.phase === "refine" && x.key === "done" ? "Settled" : x.label}</option>)}
      </S>
      <Lbl>File link</Lbl>
      <div style={{ display: "flex", gap: 6 }}>
        <I value={link} onChange={(e: any) => setLink(e.target.value)} onBlur={saveLink} onKeyDown={(e: any) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="https://" inputMode="url" aria-label="File link" s={{ flex: 1, minWidth: 0 }} />
        {task.link && <a href={task.link} target="_blank" rel="noreferrer" aria-label="Open file" style={{ width: 36, height: 36, border: `1px solid ${C.rule}`, borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.black, flexShrink: 0 }}><Ico d={IC.link} size={14} /></a>}
      </div>
      {task.target != null && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Goal: {task.target} {task.measure || ""}</p>}
    </Card>
  );
}

// A number you type yourself (your own number tasks)
function TypedNumberCard({ task, planner, monday }: { task: Task; planner: PlannerHook; monday: string }) {
  const period = periodOf(task, monday);
  const st = planner.stateOf(task, monday);
  return (
    <Card title={task.rhythm === "monthly" ? monthName(period) : `Week ${isoWeek(monday)}`}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: -8 }}>
        <NumField label="So far" value={st.actual} onSave={v => quietP(planner.saveEntry(task.id, period, { actual: v }))} />
        <div><Lbl>Target</Lbl><div style={{ height: 36, display: "flex", alignItems: "center", fontSize: 13, color: st.target == null ? C.muted : C.black }}>{st.target == null ? "Set in Plan week" : `${st.target} ${task.measure}`}</div></div>
      </div>
    </Card>
  );
}

// Note for this week / month — saved when you leave the field
function NoteCard({ task, planner, period, label }: { task: Task; planner: PlannerHook; period: string; label: string }) {
  const entry = planner.entries[entryKey(task.id, period)];
  const [t, setT] = useState(entry?.note || "");
  useEffect(() => { setT(entry?.note || ""); }, [entry?.note]);
  const save = () => { if ((entry?.note || "") !== t) quietP(planner.saveEntry(task.id, period, { note: t })); };
  return (
    <Card title={label}>
      <textarea value={t} onChange={(e) => setT(e.target.value)} onBlur={save} placeholder="For the check-in" aria-label={label}
        style={{ ...area, minHeight: 56, background: C.white }} />
    </Card>
  );
}

export const FormatChip = ({ f }: { f: string }) => {
  const l = formatLook(f);
  return <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${l.border}`, background: l.bg, color: l.color, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{l.label}</span>;
};

// ═════════════════════════════════════════════════════════════
// ITEM WINDOW — an idea or an editorial (portfolio piece)
// Status by dropdown right in the read view; Edit → Save → read view
// ═════════════════════════════════════════════════════════════
export function ItemWindow({ planner, itemId, isMobile, onClose }: {
  planner: PlannerHook; itemId?: string; draft?: Partial<Item>; isMobile: boolean; onClose: () => void;
}) {
  const it = planner.items.find(x => x.id === itemId);
  // an item deleted elsewhere closes its window
  useEffect(() => { if (itemId && !it && !planner.loading) onClose(); }, [itemId, it, planner.loading]);
  if (!it) return null;

  const isEd   = it.list === "editorial";
  const posted = it.status === "posted" || it.status === "in_kit";
  const save   = (patch: Partial<Item>) => quietP(planner.updateItem(it.id, patch));
  const savePlan = (p: Partial<ItemPlan>) => save({ plan: { ...it.plan, ...p } });
  const formats = Array.from(new Set([...(isEd ? FORMATS[it.account] : [CLASSIC, ...FORMATS[it.account]]), it.format].filter(Boolean)));
  const shot = it.plan.clips.filter(c => c.done).length;
  const move = isEd
    ? { label: "Move to ideas", onClick: () => save({ list: "idea", portfolio: false }) }
    : { label: "Move to editorial list", onClick: () => save({ list: "editorial", portfolio: true, format: FORMATS[it.account].includes(it.format) ? it.format : FORMATS[it.account][0] }) };
  const del = async () => {
    const copy = it;
    onClose();
    try { await planner.deleteItem(copy.id); showUndo(`${copy.list === "editorial" ? "Editorial" : "Idea"} deleted`, () => planner.restoreItem(copy)); }
    catch { /* the save toast reports it */ }
  };
  const styleBtn = (k: "bullets" | "numbers", label: string) => (
    <button onClick={() => savePlan({ style: k })} aria-pressed={it.plan.style === k} title={k === "bullets" ? "Bullets" : "Numbers"}
      style={{ height: 24, minWidth: 30, padding: "0 7px", border: `1px solid ${it.plan.style === k ? C.black : C.rule}`, background: it.plan.style === k ? C.black : C.white, color: it.plan.style === k ? C.white : C.black, borderRadius: 2, cursor: "pointer", fontFamily: SANS, fontSize: 12 }}>{label}</button>
  );

  return (
    <>
      <Window title={isEd ? "Editorial" : "Content idea"} isMobile={isMobile} onClose={onClose}
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <MoreMenu items={[move, { label: "Delete", danger: true, onClick: del }]} />
            <B onClick={onClose}>Close</B>
          </div>
        }>
        {/* title + the basics */}
        <InlineText value={it.title} ariaLabel="Title" onSave={v => { if (v.trim()) save({ title: v.trim() }); }} s={{ fontFamily: SERIF, fontSize: 20, height: 38 }} />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
          <div><Lbl>Status</Lbl>
            <S value={it.status === "in_kit" ? "posted" : it.status} aria-label="Status" onChange={(e: any) => quietP(planner.setItemStatus(it, e.target.value))}>
              {ITEM_STATUSES.filter(x => x.key !== "in_kit").map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </S>
          </div>
          <div><Lbl>Date</Lbl>
            <I type="date" aria-label="Date" value={it.plannedOn || ""} onChange={(e: any) => save({ plannedOn: e.target.value || null, ...(e.target.value && it.status === "idea" ? { status: "planned" as ItemStatus } : {}) })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isEd ? "minmax(0,1fr) auto" : "minmax(0,1fr)", gap: 8, alignItems: "end" }}>
          <div><Lbl>Format</Lbl>
            <S value={it.format} aria-label="Format" onChange={(e: any) => save({ format: e.target.value })}>
              {formats.map(f => <option key={f} value={f}>{f}</option>)}
            </S>
          </div>
          {isEd && <div style={{ height: 36, display: "flex", alignItems: "center" }}><Tick on={it.portfolio} color={C.green} size={18} label="Portfolio" onClick={() => save({ portfolio: !it.portfolio })} /></div>}
        </div>

        {/* storyline: bullets or numbers */}
        <Card title="Storyline" right={<span style={{ display: "inline-flex", gap: 4 }}>{styleBtn("bullets", "•")}{styleBtn("numbers", "1.")}</span>}>
          <LineList key={`s-${it.id}`} initial={storyLines(it.direction)} marker={it.plan.style === "numbers" ? "numbers" : "bullets"}
            placeholder="First beat of the story" addLabel="Add a point" onSave={lines => save({ direction: lines.join("\n") })} />
        </Card>

        {/* clips to shoot */}
        <Card title="Clips to shoot" right={it.plan.clips.length ? `${shot} of ${it.plan.clips.length} shot` : undefined}>
          <LineList key={`c-${it.id}`} initial={it.plan.clips.map(c => c.t)} checks={it.plan.clips.map(c => c.done)} marker="check"
            placeholder="Close-up, product in hand" addLabel="Add a clip"
            onSave={(lines, checks) => savePlan({ clips: lines.map((t, k) => ({ t, done: !!checks?.[k] })) })} />
        </Card>

        {/* reference links */}
        <Card title="References" right={it.plan.refs.length || undefined}>
          <RefTable key={`r-${it.id}`} initial={it.plan.refs} onSave={refs => savePlan({ refs })} />
        </Card>

        {/* once posted */}
        {posted && (
          <Card title="Posted" right={it.postedOn ? fmtD(it.postedOn) : undefined}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 8, marginTop: -8 }}>
              <div><Lbl>Post link</Lbl><InlineText value={it.link} placeholder="https://" ariaLabel="Post link" onSave={v => save({ link: v.trim() })} s={{ border: `1px solid ${C.rule}`, background: C.white, height: 36 }} /></div>
              <NumField label="Views" value={it.views} onSave={v => save({ views: v })} />
            </div>
          </Card>
        )}
      </Window>
    </>
  );
}

// A list you write like notes: Enter adds the next line, Backspace on an
// empty line removes it. Bullets, numbers, or a tick box per line.
// Saves (without empty lines) when you leave a line or tick a box.
function LineList({ initial, checks: initialChecks, marker, placeholder, addLabel, onSave }: {
  initial: string[]; checks?: boolean[]; marker: "bullets" | "numbers" | "check"; placeholder: string; addLabel: string;
  onSave: (lines: string[], checks?: boolean[]) => void;
}) {
  // an empty storyline starts with one line ready to type (clips start with the add button)
  const [lines, setLines]   = useState<string[]>(initial.length || marker === "check" ? initial : [""]);
  const [checks, setChecks] = useState<boolean[]>(initialChecks || initial.map(() => false));
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  useEffect(() => { if (focusAt != null) { refs.current[focusAt]?.focus(); setFocusAt(null); } }, [focusAt, lines.length]);
  // long points wrap: each line grows with its text
  const fit = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = "auto"; el.style.height = `${Math.max(34, el.scrollHeight)}px`; } };
  useEffect(() => { refs.current.forEach(fit); }, [lines]);
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
    setLines(ls.length || marker === "check" ? ls : [""]); setChecks(cs); if (focus) setFocusAt(Math.max(0, k - 1)); commit(ls, cs);
  };
  // ✕ on a line: gone, Undo puts it back where it was
  const removeX = (k: number) => {
    const t = lines[k], before = lines, beforeC = checks;
    if (!t.trim()) { remove(k, false); return; }
    remove(k, false);
    showUndo(`${marker === "check" ? "Clip" : "Point"} deleted`, () => {
      const ls = [...before], cs = [...beforeC];
      setLines(ls); setChecks(cs); commit(ls, cs);
    });
  };
  const tick = (k: number) => { const cs = [...checks]; cs[k] = !cs[k]; setChecks(cs); commit(lines, cs); };
  return (
    <div style={{ marginTop: -4 }}>
      {lines.map((t, k) => {
        return (
          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 8, minHeight: 36 }}>
            {marker === "check"
              ? <span style={{ paddingTop: 8 }}><Tick on={!!checks[k]} color={C.green} size={18} onClick={() => tick(k)} /></span>
              : <span style={{ width: 18, flexShrink: 0, textAlign: "right" as const, fontSize: 14, color: C.muted, paddingTop: 8 }}>{marker === "numbers" ? `${k + 1}.` : "•"}</span>}
            <textarea ref={el => { refs.current[k] = el; fit(el); }} rows={1} value={t} placeholder={k === 0 ? placeholder : ""} aria-label={`${addLabel.replace(/^Add an? /, "")} ${k + 1}`}
              onChange={(e) => { fit(e.target); setLines(ls => ls.map((x, i) => (i === k ? e.target.value.replace(/\n/g, " ") : x))); }}
              onBlur={() => commit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); insertAfter(k); }
                if (e.key === "Backspace" && t === "" && lines.length > 1) { e.preventDefault(); remove(k); }
              }}
              style={{ flex: 1, minWidth: 0, minHeight: 34, border: "none", borderBottom: `1px solid ${ROW_LINE}`, outline: "none", background: "transparent", fontFamily: SANS, fontSize: 14, lineHeight: 1.45, color: marker === "check" && checks[k] ? C.light : C.black, textDecoration: marker === "check" && checks[k] ? "line-through" : "none", padding: "7px 0", resize: "none" as const, overflow: "hidden", boxSizing: "border-box" as const, display: "block" }} />
            {(t.trim() || lines.length > 1) && <span style={{ paddingTop: 3 }}><XBtn label={`Delete ${addLabel.replace(/^Add an? /, "")} ${k + 1}`} onClick={() => removeX(k)} /></span>}
          </div>
        );
      })}
      <button onClick={() => insertAfter(lines.length - 1)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
        <Ico d={IC.plus} size={13} />{addLabel}
      </button>
    </div>
  );
}
const ROW_LINE = "#f0ece7";

// Reference links as a small table: link · what it shows · open · delete
function RefTable({ initial, onSave }: { initial: { url: string; note: string }[]; onSave: (refs: { url: string; note: string }[]) => void }) {
  const [rows, setRows] = useState(initial.length ? initial : []);
  const [focusNew, setFocusNew] = useState(false);
  const lastRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (focusNew) { lastRef.current?.focus(); setFocusNew(false); } }, [focusNew, rows.length]);
  const commit = (rs = rows) => onSave(rs.map(r => ({ url: r.url.trim(), note: r.note.trim() })).filter(r => r.url || r.note));
  const set = (k: number, patch: Partial<{ url: string; note: string }>) => setRows(rs => rs.map((r, i) => (i === k ? { ...r, ...patch } : r)));
  const cell: any = { height: 34, width: "100%", border: `1px solid ${C.rule}`, borderRadius: 2, padding: "0 8px", fontFamily: SANS, fontSize: 13, outline: "none", boxSizing: "border-box" as const, background: C.white, color: C.black };
  const href = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  return (
    <div style={{ marginTop: -4 }}>
      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr) 56px", gap: 6, ...microLabel, marginBottom: 4 }}>
          <span>Link</span><span>What it shows</span><span />
        </div>
      )}
      {rows.map((r, k) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr) 56px", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <input ref={k === rows.length - 1 ? lastRef : undefined} value={r.url} placeholder="https://" inputMode="url" aria-label={`Link ${k + 1}`} onChange={(e) => set(k, { url: e.target.value })} onBlur={() => commit()} style={cell} />
          <input value={r.note} placeholder="Lighting, hook, pacing…" aria-label={`What link ${k + 1} shows`} onChange={(e) => set(k, { note: e.target.value })} onBlur={() => commit()}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={cell} />
          <span style={{ display: "inline-flex", justifyContent: "flex-end", gap: 2 }}>
            {r.url.trim()
              ? <a href={href(r.url.trim())} target="_blank" rel="noreferrer" aria-label={`Open link ${k + 1}`} style={{ width: 26, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.black }}><Ico d={IC.link} size={14} /></a>
              : <span style={{ width: 26 }} />}
            <XBtn label={`Delete link ${k + 1}`} size={26} onClick={() => {
              const before = rows, rs = rows.filter((_, i) => i !== k);
              setRows(rs); commit(rs);
              if (r.url.trim() || r.note.trim()) showUndo("Link deleted", () => { setRows(before); commit(before); });
            }} />
          </span>
        </div>
      ))}
      <button onClick={() => { setRows(rs => [...rs, { url: "", note: "" }]); setFocusNew(true); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: C.muted }}>
        <Ico d={IC.plus} size={13} />Add a link
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// NOTE WINDOW — concept, offer or this week's learning
// Linked To-do task (if any) shows its status as a dropdown.
// ═════════════════════════════════════════════════════════════
export function NoteWindow({ planner, acc, kind, period, task, title, action, isMobile, onClose }: {
  planner: PlannerHook; acc: Account; kind: NoteKind; period: string | null; task?: Task; title: string;
  action?: { label: string; onClick: () => void }; isMobile: boolean; onClose: () => void;
}) {
  const note = planner.noteOf(acc, kind, period);
  const empty = !note || (!note.body && !note.title);
  const [edit, setEdit] = useState(empty);
  const [f, setF]       = useState({ title: note?.title || "", body: note?.body || "" });
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!edit) setF({ title: note?.title || "", body: note?.body || "" }); }, [note, edit]);
  const isLearning = kind === "learning";

  const save = async () => {
    setErr(null); setBusy(true);
    try { await planner.saveNote(acc, kind, period, isLearning ? { title: f.title, body: f.body } : { body: f.body }); setEdit(false); }
    catch (e: any) { setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };

  return (
    <Window title={title} isMobile={isMobile} onClose={() => { if (edit && !empty) { setEdit(false); setErr(null); } else onClose(); }}
      footer={edit ? (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <B v="sec" onClick={() => { if (!empty) { setEdit(false); setErr(null); } else onClose(); }}>Cancel</B>
          <B onClick={save} s={{ opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</B>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          {action ? <B v="sec" onClick={action.onClick} s={{ gap: 5 }}><Ico d={IC.link} size={12} />{action.label}</B> : <span />}
          <B onClick={() => setEdit(true)}>Edit</B>
        </div>
      )}>
      {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
      <AccChip acc={acc} />
      {edit ? (
        <div>
          {isLearning && (
            <>
              <Lbl>Top post</Lbl>
              <I value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} placeholder="e.g. Lip liner that stays put · 8.420 views" />
            </>
          )}
          <Lbl>{isLearning ? "One learning" : kind === "offer" ? "What this account sells" : "Concept"}</Lbl>
          <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ ...area, minHeight: isLearning ? 72 : 140 }} autoFocus />
        </div>
      ) : (
        <div>
          {isLearning && textBlock("Top post", note?.title || "")}
          {textBlock(isLearning ? "Learning" : kind === "offer" ? "What this account sells" : "Concept", note?.body || "")}
        </div>
      )}
      {task && (
        <>
          <Lbl>{task.title} · To-do</Lbl>
          <S value={task.status} onChange={(e: any) => quietP(planner.setTaskStatus(task, e.target.value))}>
            {STATUSES.map(x => <option key={x.key} value={x.key}>{task.phase === "refine" && x.key === "done" ? "Settled" : x.label}</option>)}
          </S>
        </>
      )}
    </Window>
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
          startOn: f.startOn, endOn: addDays(f.startOn!, weeks * 7 - 1), focusCategory: f.focusCategory || "", focusTier: (f.focusTier || "now") as any,
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
        <div><Lbl>Replied</Lbl><I inputMode="numeric" aria-label="Replied" placeholder="–" value={res.replied == null ? "" : String(res.replied)} onChange={(e: any) => setRes({ ...res, replied: num(e.target.value) })} /></div>
        <div><Lbl>Gifted</Lbl><I inputMode="numeric" aria-label="Gifted" placeholder="–" value={res.gifted == null ? "" : String(res.gifted)} onChange={(e: any) => setRes({ ...res, gifted: num(e.target.value) })} /></div>
        <div><Lbl>Deals</Lbl><I inputMode="numeric" aria-label="Deals" placeholder="–" value={res.deals == null ? "" : String(res.deals)} onChange={(e: any) => setRes({ ...res, deals: num(e.target.value) })} /></div>
      </div>
      <Lbl>Worked</Lbl>
      <I aria-label="Worked" value={res.worked || ""} placeholder="What worked" onChange={(e: any) => setRes({ ...res, worked: e.target.value })} />
      <Lbl>Change</Lbl>
      <I aria-label="Change" value={res.change || ""} placeholder="What to do differently next sprint" onChange={(e: any) => setRes({ ...res, change: e.target.value })} />
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
              <span style={{ fontSize: 14 }}>· {OUTREACH_TIERS.find(t => t.key === sp.focusTier)?.label || "Now"}</span>
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
                <S value={f.account || "lynnhoa"} onChange={(e: any) => setF({ ...f, account: e.target.value })}>
                  {ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </S>
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
              <div><Lbl>Start</Lbl><I type="date" value={f.startOn || ""} onChange={(e: any) => setF({ ...f, startOn: e.target.value })} /></div>
              <div><Lbl>Weeks</Lbl><I inputMode="numeric" aria-label="Weeks" value={String(weeks || "")} onChange={(e: any) => setWeeks(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div>
              <div><Lbl>Focus category</Lbl>
                <S value={f.focusCategory || ""} aria-label="Focus category" onChange={(e: any) => setF({ ...f, focusCategory: e.target.value })}>
                  <option value="">Any category</option>
                  {OUTREACH_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </S>
              </div>
              <div><Lbl>Focus tier</Lbl>
                <S value={f.focusTier || "now"} aria-label="Focus tier" onChange={(e: any) => setF({ ...f, focusTier: e.target.value })}>
                  {OUTREACH_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </S>
              </div>
              <div><Lbl>Pitch goal</Lbl><I inputMode="numeric" aria-label="Pitch goal" value={f.pitchGoal == null ? "" : String(f.pitchGoal)} placeholder="–" onChange={(e: any) => setF({ ...f, pitchGoal: num(e.target.value) })} /></div>
              <div><Lbl>Follow-up goal</Lbl><I inputMode="numeric" aria-label="Follow-up goal" value={f.followUpGoal == null ? "" : String(f.followUpGoal)} placeholder="–" onChange={(e: any) => setF({ ...f, followUpGoal: num(e.target.value) })} /></div>
            </div>
            {f.startOn && weeks > 0 && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Ends {fmtD(addDays(f.startOn, weeks * 7 - 1))}{f.pitchGoal ? ` · daily target ${Math.ceil(f.pitchGoal / (weeks * 5))} pitches over ${weeks * 5} work days` : ""}</p>}
            {mode === "edit" && sp?.status === "done" && resultFields}
          </div>
        )}
      </Window>
    </>
  );
}

function TaskForm({ f, set, stages }: { f: Partial<Task>; set: (p: Partial<Task>) => void; stages: Stage[] }) {
  const stageNames = (n: number) => stages.find(s => s.num === n)?.shortName || STAGE_SHORT[n - 1];
  return (
    <div>
      <Lbl>Task</Lbl>
      <I value={f.title || ""} onChange={(e: any) => set({ title: e.target.value })} placeholder="What needs doing" autoFocus={!f.id} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        <div><Lbl>Account</Lbl>
          <S value={f.account} onChange={(e: any) => set({ account: e.target.value as TaskAccount })}>
            <option value="both">Both</option>
            {ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </S>
        </div>
        <div><Lbl>Who</Lbl>
          <S value={f.owner} onChange={(e: any) => set({ owner: e.target.value })}>
            {OWNERS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </S>
        </div>
        <div><Lbl>Phase</Lbl>
          <S value={f.phase} onChange={(e: any) => set({ phase: e.target.value as Phase })}>
            {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </S>
        </div>
        <div><Lbl>Rhythm</Lbl>
          <S value={f.rhythm} onChange={(e: any) => set({ rhythm: e.target.value as Rhythm })}>
            {RHYTHMS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </S>
        </div>
        <div><Lbl>Stage</Lbl>
          <S value={String(f.stageNum || 1)} onChange={(e: any) => set({ stageNum: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} · {stageNames(n)}</option>)}
          </S>
        </div>
        {f.phase === "maintain" && (
          <div><Lbl>Counted in</Lbl>
            <I value={f.measure || ""} onChange={(e: any) => set({ measure: e.target.value })} placeholder="e.g. posts" />
          </div>
        )}
      </div>
      {f.phase === "maintain" && <p style={{ fontSize: 11, color: C.light, margin: "4px 0 0", lineHeight: 1.4 }}>With a unit it's a number row with a weekly target. Empty: a tick.</p>}
      <Lbl>How</Lbl>
      <textarea value={f.how || ""} onChange={(e) => set({ how: e.target.value })} style={area} />
      <Lbl>Done when</Lbl>
      <textarea value={f.doneWhen || ""} onChange={(e) => set({ doneWhen: e.target.value })} style={{ ...area, minHeight: 52 }} />
      <Lbl>Link</Lbl>
      <I value={f.link || ""} onChange={(e: any) => set({ link: e.target.value })} placeholder="https://" inputMode="url" />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PLAN WEEK — this week's numbers (set at the check-in)
// ═════════════════════════════════════════════════════════════
export function PlanWeekWindow({ planner, monday, isMobile, onClose }: { planner: PlannerHook; monday: string; isMobile: boolean; onClose: () => void }) {
  const rows = useMemo(() => planner.tasks
    .filter(t => t.phase === "maintain" && rowKind(t) === "number" && isVisible(t, planner.stages, "all"))
    .sort(byOrder), [planner.tasks, planner.stages]);
  const current = (t: Task) => planner.entries[entryKey(t.id, periodOf(t, monday))]?.target ?? null;
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    rows.forEach(t => { const c = current(t); v[t.id] = c == null ? "" : String(c); });
    return v;
  });
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const copyLast = () => {
    const v = { ...vals }; let n = 0;
    rows.forEach(t => {
      const prevPeriod = t.rhythm === "monthly" ? null : addDays(monday, -7);
      const last = prevPeriod ? planner.entries[entryKey(t.id, prevPeriod)]?.target : null;
      if (last != null) { v[t.id] = String(last); n++; }
    });
    setVals(v);
    setNote(n ? `${n} ${n === 1 ? "number" : "numbers"} copied from last week.` : "Last week has no numbers yet.");
  };

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      const list = rows
        .map(t => ({ taskId: t.id, period: periodOf(t, monday), target: vals[t.id]?.trim() ? int(vals[t.id]) : null, was: current(t) }))
        .filter(x => x.target !== x.was)
        .map(({ taskId, period, target }) => ({ taskId, period, target }));
      await planner.planTargets(list);
      onClose();
    } catch (e: any) { setErr(e?.message || "Couldn't save."); setBusy(false); }
  };

  const groups = OWNERS.map(o => ({ ...o, list: rows.filter(t => t.owner === o.key) })).filter(g => g.list.length);

  return (
    <Window title={`Plan week ${isoWeek(monday)}`} isMobile={isMobile} onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <B v="sec" onClick={onClose}>Cancel</B>
          <B onClick={save} s={{ opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</B>
        </div>
      }>
      {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={microLabel}>Targets · {weekRange(monday)}</span>
        <B v="sec" onClick={copyLast} s={{ ...BAR_BTN, height: 28, minHeight: 28, flexShrink: 0 }}>Copy last week</B>
      </div>
      {note && <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>{note}</p>}
      {rows.length === 0 && <p style={{ fontSize: 13, color: C.muted, marginTop: 16 }}>No tasks with numbers this week.</p>}
      {groups.map(g => (
        <div key={g.key}>
          <div style={{ ...microLabel, marginTop: 14, paddingBottom: 6, borderBottom: `1px solid ${C.rule}` }}>{g.label}</div>
          {g.list.map(t => (
            <div key={t.id} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: `1px solid ${C.rule}` }}>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 14 }}>{t.title}</span>
                <AccChip acc={t.account} />
                <span style={{ fontSize: 11, color: C.muted }}>{t.measure}</span>
              </div>
              <I inputMode="numeric" value={vals[t.id] ?? ""} placeholder="–" aria-label={`Target for ${t.title}`}
                onChange={(e: any) => setVals(v => ({ ...v, [t.id]: e.target.value.replace(/[^\d]/g, "") }))}
                s={{ width: 64, height: 32, textAlign: "right" as const, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ))}
      <p style={{ fontSize: 11, color: C.light, margin: "10px 0 0" }}>Daily and one-time tasks need no numbers.</p>
    </Window>
  );
}

// ═════════════════════════════════════════════════════════════
// STAGE WINDOW — goal, done-when checklist, Start next stage
// ═════════════════════════════════════════════════════════════
// readOnly: opened from Overview — read the gate, change stages in To-do
export function StageWindow({ planner, stageId, isMobile, onClose, readOnly }: { planner: PlannerHook; stageId: string; isMobile: boolean; onClose: () => void; readOnly?: boolean }) {
  const stage = planner.stages.find(s => s.id === stageId);
  const [edit, setEdit]   = useState(false);
  const [f, setF]         = useState<Partial<Stage>>(stage || {});
  const [err, setErr]     = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [askStart, setAskStart] = useState(false);
  useEffect(() => { if (!edit && stage) setF(stage); }, [stage, edit]);
  if (!stage) return null;

  const mine = planner.stages.filter(s => s.account === stage.account);
  const next = mine.find(s => s.num === stage.num + 1);
  const gate = gateOf(stage, planner.tasks, planner.doneOf);
  const isCurrent = stageNumOf(planner.stages, stage.account) === stage.num && stage.status !== "done";
  const canStart = isCurrent && !!next && gate.ready;

  const save = async () => {
    setErr(null);
    if (!String(f.name || "").trim()) { setErr("Give the stage a name."); return; }
    setBusy(true);
    try {
      await planner.updateStage(stage.id, { name: f.name, goal: f.goal || "", doneWhen: f.doneWhen || "", ...(stage.num === 2 ? { sprintWeeks: f.sprintWeeks ? Number(f.sprintWeeks) : null } : {}) });
      setEdit(false);
    } catch (e: any) { setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const start = async () => {
    setAskStart(false);
    try { await planner.startNextStage(stage); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't start the next stage."); }
  };

  return (
    <>
      {askStart && next && <ConfirmDialog title={`Start Stage ${next.num} · ${next.name}?`} text={`Stage ${stage.num} is marked done for ${accLook(stage.account).label}. Its maintain tasks keep running.`} okLabel={`Start Stage ${next.num}`} onOk={start} onCancel={() => setAskStart(false)} />}
      <Window title={`Stage ${stage.num} · ${stage.name}`} isMobile={isMobile} onClose={() => { if (edit) { setEdit(false); setErr(null); } else onClose(); }}
        footer={readOnly ? (
          <p style={{ fontSize: 12, color: C.muted, margin: 0, textAlign: "right" as const }}>{canStart ? `Ready · start Stage ${next!.num} in To-do` : "Tick tasks off in To-do"}</p>
        ) : edit ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <B v="sec" onClick={() => { setEdit(false); setErr(null); }}>Cancel</B>
            <B onClick={save} s={{ opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</B>
          </div>
        ) : canStart ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <MoreMenu items={[{ label: "Edit stage", onClick: () => setEdit(true) }]} />
            <B onClick={() => setAskStart(true)}>Start Stage {next!.num}</B>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <B onClick={() => setEdit(true)}>Edit</B>
          </div>
        )}>
        {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
        <AccChip acc={stage.account} />
        <StageTrack stages={mine} current={isCurrent ? stage : undefined} progress={gate.total ? gate.done / gate.total : 0} />
        {edit ? (
          <div>
            <Lbl>Name</Lbl>
            <I value={f.name || ""} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
            <Lbl>Goal</Lbl>
            <textarea value={f.goal || ""} onChange={(e) => setF({ ...f, goal: e.target.value })} style={area} />
            <Lbl>Done when · extra notes</Lbl>
            <textarea value={f.doneWhen || ""} onChange={(e) => setF({ ...f, doneWhen: e.target.value })} style={{ ...area, minHeight: 52 }} placeholder="e.g. numbers you want to reach first" />
            {stage.num === 2 && (
              <>
                <Lbl>Sprint length (weeks)</Lbl>
                <I inputMode="numeric" value={f.sprintWeeks == null ? "" : String(f.sprintWeeks)} onChange={(e: any) => setF({ ...f, sprintWeeks: int(e.target.value) })} s={{ width: 90 }} />
              </>
            )}
          </div>
        ) : (
          <div>
            {textBlock("Goal", stage.goal)}
            {stage.num === 2 && stage.sprintWeeks != null && textBlock("Sprints", `${stage.sprintWeeks} ${stage.sprintWeeks === 1 ? "week" : "weeks"} each`)}
            {textBlock("Notes", stage.doneWhen)}
            <Lbl>Done when · {gate.done} of {gate.total}</Lbl>
            {gate.total === 0 ? (
              <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>No setup or refine tasks for this stage yet. Add them with + Task (Phase: Setup or Refine, Stage {stage.num}).</p>
            ) : (
              <div style={{ borderTop: `1px solid ${C.rule}` }}>
                {gate.items.map(t => (
                  <div key={t.id} style={{ minHeight: 36, display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.rule}`, fontSize: 14 }}>
                    <Box on={planner.doneOf(t)} />
                    <span style={{ flex: 1, minWidth: 0, color: planner.doneOf(t) ? C.muted : C.black }}>{t.title}</span>
                    {taskAccounts(t).length > 1 && <AccChip acc="both" />}
                    <span style={{ ...microLabel, flexShrink: 0 }}>{t.status === "in_progress" ? "In progress" : phaseLabel(t.phase)}</span>
                  </div>
                ))}
              </div>
            )}
            {stage.status === "done" && stage.doneOn && <p style={{ fontSize: 12, color: C.muted, margin: "10px 0 0" }}>Done on {fmtD(stage.doneOn)}.</p>}
            {canStart && <p style={{ fontSize: 12, color: C.green, margin: "10px 0 0" }}>Everything is ticked. Start Stage {next!.num} · {next!.name} when you're ready.</p>}
            {isCurrent && !gate.ready && next && <p style={{ fontSize: 12, color: C.muted, margin: "10px 0 0" }}>{readOnly ? `When all are ticked, Stage ${next.num} can begin from To-do.` : `When all are ticked, Start Stage ${next.num} appears here.`}</p>}
          </div>
        )}
      </Window>
    </>
  );
}

