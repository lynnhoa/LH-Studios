// ─────────────────────────────────────────────────────────────
// ATOMS — reusable UI primitives
// Every colour, size, corner, shadow and letter spacing comes from constants.
// Desktop + iPad + PWA iOS safe.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, STATUS_COLOR, STATUS_NAME, catInfo, Z, SIZE, PAL, STATUS_TONE, TRACK, RADIUS, SHADOW, ICON, expiryTone, DENSITY, SPACING, BREAKPOINT, WIDE } from "./constants";
import { fmtD, dLeft, today, parseDE, fmtNumDE } from "./formatters";
import { saveStatus } from "./saveStatus";

// ─── SCREEN SIZE ─────────────────────────────────────────────
// phone below 700 px · iPad 700–1199 · computer from 1200 (same numbers in every app)
export function useScreen() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { w, isMobile: w < BREAKPOINT, isWide: w >= WIDE };
}

// ─── ESC CLOSES THE TOP WINDOW (iPad keyboard / computer) ────
// Only the window on top closes. In a text field, Esc first leaves the field.
const escStack: { current: (() => void) | undefined }[] = [];
let escBound = false;
export function useEscape(active: boolean, onClose: () => void) {
  const ref = useRef<(() => void) | undefined>(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    if (!escBound && typeof window !== "undefined") {
      escBound = true;
      window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !escStack.length) return;
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) { t.blur(); return; }
        escStack[escStack.length - 1].current?.();
      });
    }
    escStack.push(ref);
    return () => { const i = escStack.lastIndexOf(ref); if (i >= 0) escStack.splice(i, 1); };
  }, [active]);
}

// ─── TWO COLUMNS ON iPad / COMPUTER ──────────────────────────
// Like the Manager dashboard: left a little wider, 16 px apart. Phone: left, then right, as one column.
// When one side has nothing to show, the other gets the full width (index.html: .lh-cols).
export const Cols = ({ left, right, s }: { left: any; right: any; s?: any }) => {
  const { isMobile } = useScreen();
  if (isMobile) return <>{left}{right}</>;
  return (
    <div className="lh-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: SPACING.colGap, alignItems: "start", ...s }}>
      <div style={{ minWidth: 0 }}>{left}</div>
      <div style={{ minWidth: 0 }}>{right}</div>
    </div>
  );
};

// Groups (a heading + its list) side by side: 2 columns on iPad, 2 or 3 on a computer.
// Each group goes into the shortest column, by its number of rows, so a group never jumps
// when it folds or opens. Phone: one column, the order unchanged.
export const ColGroups = ({ groups, wideCols = 2 }: { groups: { key: string; size: number; node: any }[]; wideCols?: 2 | 3 }) => {
  const { isMobile, isWide } = useScreen();
  const n = isMobile ? 1 : isWide ? wideCols : 2;
  if (n === 1 || groups.length < 2) return <>{groups.map(g => <div key={g.key}>{g.node}</div>)}</>;
  const cols: { h: number; list: typeof groups }[] = Array.from({ length: n }, () => ({ h: 0, list: [] as typeof groups }));
  groups.forEach(g => {
    const c = cols.reduce((a, b) => (b.h < a.h ? b : a));
    c.list.push(g); c.h += Math.max(1, g.size) + 1;
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, gap: SPACING.colGap, alignItems: "start" }}>
      {cols.map((c, i) => <div key={i} style={{ minWidth: 0 }}>{c.list.map(g => <div key={g.key}>{g.node}</div>)}</div>)}
    </div>
  );
};

// ─── INPUT ───────────────────────────────────────────────────
export const I = ({ s, ...p }: any) => (
  <input
    style={{
      width:       "100%",
      height:      SIZE.field,
      padding:     "0 10px",
      border:      `1px solid ${C.field}`,
      background:  C.white,
      fontFamily:  SANS,
      fontSize: TYPE.field.size,  // iOS auto-zooms inputs < 16px — never go below
      color:       C.black,
      borderRadius: RADIUS.field,
      outline:     "none",
      boxSizing:   "border-box" as const,
      WebkitAppearance: "none" as const,
      ...s,
    }}
    {...p}
  />
);

// ─── TEXT SELECT — minimal borderless sort/filter control ─────
// Standard for list toolbars: uppercase micro text, muted, top-right.
// Native <select> underneath so mobile pickers keep working.
export const TSel = ({ s, className, ...p }: any) => (
  <select
    className={["tsel", className].filter(Boolean).join(" ")}
    style={{
      border:        "none",
      background:    "transparent",
      fontFamily:    SANS,
      fontSize:      TYPE.micro.size,
      color:         C.muted,
      letterSpacing: TRACK.caps,
      textTransform: "uppercase" as const,
      padding:       "4px 2px",
      cursor:        "pointer",
      outline:       "none",
      WebkitAppearance: "none" as const,
      MozAppearance: "none" as const,
      appearance:    "none" as const,
      textAlignLast: "right" as const,
      ...s,
    }}
    {...p}
  />
);

// Caret + select wrapper so the ▾ affordance is consistent
export const TSelWrap = ({ children }: any) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
    {children}
    <span style={{ fontSize: ICON.caret, color: C.light, pointerEvents: "none" as const }}>▾</span>
  </span>
);

// ─── SELECT ──────────────────────────────────────────────────
const SELECT_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238a847d' stroke-width='1.3'/%3E%3C/svg%3E")`;

export const S = ({ s, ...p }: any) => (
  <select
    style={{
      width:        "100%",
      height:       SIZE.field,
      padding:      "0 28px 0 10px",
      border:       `1px solid ${C.field}`,
      backgroundColor: C.white,
      backgroundImage: SELECT_ARROW,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 10px center",
      fontFamily:   SANS,
      fontSize: TYPE.field.size,  // iOS auto-zooms selects < 16px — never go below
      color:        C.black,
      borderRadius: RADIUS.field,
      outline:      "none",
      boxSizing:    "border-box" as const,
      cursor:       "pointer",
      WebkitAppearance: "none" as const,
      ...s,
    }}
    {...p}
  />
);

// ─── BUTTON ──────────────────────────────────────────────────
// v="pri"   black bg, white text       — primary action
// v="sec"   transparent bg, rule border — secondary action
// v="ghost"  no border, muted text        — inline / low-emphasis
// v="danger" red border, red text         — destructive action
export const B = ({ v = "pri", s, ...p }: any) => {
  // Pill buttons (Gelato look): pri = the one dark main action, sec = light pill,
  // ghost = text only, danger = light pill with red text. Text never below 12 px.
  const styles: Record<string, any> = {
    pri:    { background: C.black, color: C.white, border: `1px solid ${C.black}` },
    sec:    { background: C.white, color: C.black, border: `1px solid ${C.edge}` },
    ghost:  { background: "none",  color: C.muted, border: "none" },
    danger: { background: C.white, color: C.red,   border: `1px solid ${PAL.late.fill}` },
  };
  const fs = Math.max(TYPE.subtext.size, Number(s?.fontSize) || TYPE.row.size);
  return (
    <button
      style={{
        padding:       "0 15px",
        borderRadius: RADIUS.button,
        cursor:        "pointer",
        fontFamily:    SANS,
        letterSpacing: TRACK.none,
        textTransform: "none" as const,
        whiteSpace:    "nowrap" as const,
        lineHeight:    1,
        minHeight:     SIZE.button,
        display:       "inline-flex",
        alignItems:    "center",
        justifyContent:"center",
        ...styles[v] ?? styles.pri,
        ...s,
        fontSize:      fs,
      }}
      {...p}
    />
  );
};

// ─── PILL TOGGLE ─────────────────────────────────────────────
// Used for category tabs, filter pills
export const Pill = ({ on, onClick, children, size }: any) => (
  // same look as the filter Chip (neutral, no dot): sentence case, 12 px
  <button
    onClick={onClick}
    aria-pressed={!!on}
    style={{
      padding:       size === "sm" ? "0 9px" : "0 11px",
      border:        `1px solid ${on ? C.pillOn : C.rule}`,
      background:    on ? PAL.neutral.fill : C.white,
      color:         on ? C.black : C.ink2,
      borderRadius:  RADIUS.pill,
      cursor:        "pointer",
      fontFamily:    SANS,
      fontSize:      TYPE.subtext.size,
      letterSpacing: TRACK.none,
      whiteSpace:    "nowrap" as const,
      minHeight:     size === "sm" ? SIZE.chip : SIZE.pill,
      display:       "inline-flex",
      alignItems:    "center",
      flexShrink:    0,
    }}
  >
    {children}
  </button>
);

// ─── NUMBER FIELD (German typing: 212,50 · 1.200,75) ─────────
// Keeps what you type while the field is active; shows German format
// when you leave it. onChange gets a number (or null when empty).
// mini = drawn at row size (13 px) inside panels — see MiniInput.
export function NumField({ value, onChange, minDec = 2, placeholder, s, ariaLabel, mini }: {
  value: number | null | undefined; onChange: (n: number | null) => void; minDec?: number;
  placeholder?: string; s?: any; ariaLabel?: string; mini?: boolean;
}) {
  const [text, setText] = useState(() => fmtNumDE(value, minDec));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmtNumDE(value, minDec)); }, [value, focused, minDec]);
  const Field = mini ? MiniInput : I;
  return (
    <Field type="text" inputMode="decimal" value={text} placeholder={placeholder} s={s} aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(fmtNumDE(parseDE(text), minDec)); }}
      onChange={(e: any) => { setText(e.target.value); onChange(parseDE(e.target.value)); }} />
  );
}

// ─── LANGUAGE SWITCH (EN | DE as one joined control) ─────────
export const LangSwitch = ({ lang, onChange }: { lang: string; onChange: (l: "en" | "de") => void }) => (
  <span style={{ display: "inline-flex", flexShrink: 0, height: SIZE.barBtn, border: `1px solid ${C.rule}`, borderRadius: RADIUS.pill, background: C.white, padding: 2, boxSizing: "border-box" as const }}>
    {(["en", "de"] as const).map((l) => {
      const on = lang === l;
      return (
        <button key={l} onClick={() => onChange(l)} aria-pressed={on}
          style={{ height: "100%", padding: "0 10px", border: "none", background: on ? PAL.neutral.fill : "transparent", color: on ? C.black : C.muted, borderRadius: RADIUS.pill, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: TRACK.caps }}>
          {l.toUpperCase()}
        </button>
      );
    })}
  </span>
);

// Style for compact buttons in window top bars
export const BAR_BTN: any = { minHeight: SIZE.barBtn, height: SIZE.barBtn, padding: "0 10px", fontSize: TYPE.micro.size };

// ─── FIELD LABEL ─────────────────────────────────────────────
export const Lbl = ({ children }: any) => (
  <p
    style={{
      fontSize:      TYPE.micro.size,
      fontFamily:    SANS,
      color:         C.muted,
      letterSpacing: TRACK.caps,
      textTransform: "uppercase" as const,
      margin:        `${SIZE.labelTop}px 0 ${SIZE.labelGap}px`,
    }}
  >
    {children}
  </p>
);

// ─── TAG / BADGE ─────────────────────────────────────────────
export const Tag = ({ children, onRemove }: any) => (
  <span
    style={{
      display:     "inline-flex",
      alignItems:  "center",
      gap:         4,
      border:      `1px solid ${C.rule}`,
      borderRadius: RADIUS.tag,
      padding:     "3px 10px",
      fontSize:    TYPE.micro.size,
      fontFamily:  SANS,
      color:       C.muted,
    }}
  >
    {children}
    {onRemove && (
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border:     "none",
          cursor:     "pointer",
          color:      C.muted,
          fontSize:   TYPE.micro.size,
          padding:    0,
          lineHeight: 1,
          minHeight:  "auto",
        }}
      >
        ✕
      </button>
    )}
  </span>
);

// ─── INFO ROW ────────────────────────────────────────────────
// Label + value on one line with border bottom
export const IR = ({ label, value }: any) => (
  <div
    style={{
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "baseline",
      padding:        "8px 0",
      borderBottom:   `1px solid ${C.rule}`,
      gap:            12,
    }}
  >
    <span style={{ fontSize: TYPE.subtext.size, fontFamily: SANS, color: C.muted, flexShrink: 0 }}>
      {label}
    </span>
    <span
      style={{
        fontSize:   TYPE.subtext.size,
        fontFamily: SANS,
        color:      C.black,
        fontWeight: "500",
        textAlign:  "right" as const,
        maxWidth:   "60%",
      }}
    >
      {value || "—"}
    </span>
  </div>
);

// ─── USAGE BADGE ─────────────────────────────────────────────
// Shows usage rights expiry with color coding
export function UBadge({
  end,
  label = "Usage",
}: {
  end:    string | null | undefined;
  label?: string;
}) {
  if (!end) return null;
  const d   = dLeft(end);
  const exp = d !== null && d < 0;
  const t   = PAL[expiryTone(d)];
  return (
    <span data-tag=""
      style={{
        fontSize:      TYPE.micro.size,
        fontFamily:    SANS,
        letterSpacing: TRACK.tag,
        color:         t.ink,
        background:    t.fill,
        padding:       "2px 8px",
        borderRadius:  RADIUS.tag,
        whiteSpace:    "nowrap" as const,
        display:       "inline-block",
      }}
    >
      {exp
        ? `${label} expired`
        : `${label} ends ${fmtD(end)} · ${d}d left`}
    </span>
  );
}

// ─── SECTION DIVIDER ─────────────────────────────────────────
export const Divider = ({ top = 24, bottom = 24 }: { top?: number; bottom?: number }) => (
  <div
    style={{
      borderTop:    `1px solid ${C.rule}`,
      marginTop:    top,
      marginBottom: bottom,
    }}
  />
);

// ─── EMPTY STATE ─────────────────────────────────────────────
export const Empty = ({ message }: { message: string }) => (
  <div
    style={{
      border:       `1px solid ${C.rule}`,
      borderRadius: RADIUS.tile,
      padding:      "40px 20px",
      textAlign:    "center" as const,
    }}
  >
    <p style={{ fontSize: TYPE.subtext.size, fontFamily: SANS, color: C.muted, margin: 0 }}>
      {message}
    </p>
  </div>
);

// ─── LOADING ─────────────────────────────────────────────────
export const Loading = () => (
  <div
    style={{
      minHeight:      "100dvh",
      background:     C.bg,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
    }}
  >
    <p
      style={{
        fontSize:      TYPE.micro.size,
        fontFamily:    SANS,
        color:         C.muted,
        letterSpacing: TRACK.caps,
        textTransform: "uppercase" as const,
      }}
    >
      Loading…
    </p>
  </div>
);

// ─── STATUS COLOR (one map for the whole app: constants.ts) ──
export const scol = (s: string): string => STATUS_COLOR[String(s || "").toLowerCase()] ?? C.light;

// ─── STATUS BADGE ────────────────────────────────────────────
export const StatusBadge = ({ status }: { status: string }) => {
  const key = String(status || "").toLowerCase();
  const t = PAL[STATUS_TONE[key] || "neutral"];
  return (
    <span data-tag=""
      style={{
        fontSize:      TYPE.micro.size,
        fontFamily:    SANS,
        color:         t.ink,
        background:    t.fill,
        padding:       "2px 8px",
        borderRadius: RADIUS.tag,
        letterSpacing: TRACK.caps,
        textTransform: "uppercase" as const,
        whiteSpace:    "nowrap" as const,
        display:       "inline-block",
      }}
    >
      {STATUS_NAME[key] || status}
    </span>
  );
};

// ─── CATEGORY PILL (one label + colour per category) ─────────
export const CatPill = ({ cat, onClick, title, label }: { cat: string; onClick?: () => void; title?: string; label?: string }) => {
  const c = catInfo(cat);
  return (
    <span onClick={onClick} title={title}
      style={{ fontSize: TYPE.micro.size, fontFamily: SANS, padding: "2px 8px", borderRadius: RADIUS.field, border: `1px solid ${c.border}`, background: c.bg, color: c.color, whiteSpace: "nowrap" as const, flexShrink: 0, cursor: onClick ? "pointer" : "default", display: "inline-block" }}>
      {label || c.label}
    </span>
  );
};

// ─── TICK BOX (one check box for the whole app) ──────────────
export const Tick = ({ on, onClick, color = C.black, disabled, size = 20, label }: {
  on: boolean; onClick?: () => void; color?: string; disabled?: boolean; size?: number; label?: string;
}) => (
  <span
    role="checkbox" aria-checked={on}
    onClick={(e) => { e.stopPropagation(); if (!disabled && onClick) onClick(); }}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, userSelect: "none" as const }}
  >
    <span style={{ width: size, height: size, borderRadius: RADIUS.check, border: `1.5px solid ${on ? color : C.light}`, background: on ? color : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" as const }}>
      {on && <span style={{ fontSize: Math.round(size * 0.55), color: C.white, lineHeight: 1, fontWeight: 500 }}>✓</span>}
    </span>
    {label && <span style={{ fontSize: TYPE.label.size, fontFamily: SANS, color: C.black }}>{label}</span>}
  </span>
);

// ─── SEGMENTED (one toggle group, built from Pills) ──────────
export function Segmented<T extends string>({ options, value, onChange }: {
  options: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
      {options.map(([v, label]) => <Pill key={v} on={value === v} onClick={() => onChange(v)}>{label}</Pill>)}
    </div>
  );
}

// ─── CONFIRM DIALOG (one dialog for confirms + date questions) ─
export const ConfirmDialog = ({ title, text, dateLabel, okLabel, cancelLabel = "Cancel", danger, error, onOk, onCancel }: {
  title: string; text?: string; dateLabel?: string; okLabel: string; cancelLabel?: string;
  danger?: boolean; error?: string | null; onOk: (date: string) => void; onCancel: () => void;
}) => {
  const [date, setDate] = useState(today());
  useEscape(true, onCancel);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: Z.dialog, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,249,247,0.88)", padding: 16 }}>
      <div style={{ background: C.bg, border: `1px solid ${C.rule}`, borderRadius: RADIUS.card, padding: "20px 22px 18px", boxShadow: SHADOW.pop, width: "100%", maxWidth: 340 }}>
        <p style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, margin: "0 0 8px" }}>{title}</p>
        {text && <p style={{ fontSize: TYPE.label.size, fontFamily: SANS, color: C.muted, margin: "0 0 12px", lineHeight: 1.5 }}>{text}</p>}
        {error && <p style={{ fontSize: TYPE.label.size, fontFamily: SANS, color: C.red, margin: "0 0 12px", lineHeight: 1.5 }}>{error}</p>}
        {dateLabel && <>
          <Lbl>{dateLabel}</Lbl>
          <I type="date" value={date} onChange={(e: any) => setDate(e.target.value)} s={{ marginBottom: 14 }} />
        </>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" as const }}>
          <B v="sec" onClick={onCancel}>{cancelLabel}</B>
          <B v={danger ? "danger" : "pri"} onClick={() => onOk(date || today())}>{okLabel}</B>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── SAVE TOAST (Saving… / Saved ✓ / Couldn't save) ─────────
// --toast-lift: set by the document window so the toast sits above its bottom bar
export const SaveToast = () => {
  const [st, setSt] = useState(saveStatus.get());
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => saveStatus.subscribe(() => setSt(saveStatus.get())), []);
  useEffect(() => {
    if (!st.savedAt || st.pending > 0) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 1500);
    return () => clearTimeout(t);
  }, [st.savedAt, st.pending]);
  const base: any = { position: "fixed", left: "50%", bottom: "calc(20px + var(--toast-lift, 0px))", transform: "translateX(-50%)", zIndex: Z.toast, borderRadius: RADIUS.tile, padding: "8px 14px", fontFamily: SANS, fontSize: TYPE.label.size, letterSpacing: TRACK.tag, boxShadow: SHADOW.pop, display: "flex", alignItems: "center", gap: 12, maxWidth: "calc(100vw - 32px)" };
  if (st.error) return (
    <div style={{ ...base, background: TINT_RED, border: `1px solid ${PAL.late.fill}`, color: C.red }}>
      <span>Couldn't save — {st.error}. Your last change was undone.</span>
      <button onClick={() => saveStatus.clearError()} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, textDecoration: "underline" }}>OK</button>
    </div>
  );
  if (st.pending > 0) return <div style={{ ...base, background: C.bg, border: `1px solid ${C.rule}`, color: C.muted }}>Saving…</div>;
  if (showSaved) return <div style={{ ...base, background: C.bg, border: `1px solid ${C.rule}`, color: C.green }}>Saved ✓</div>;
  return null;
};
const TINT_RED = PAL.late.wash;

// ─── LOAD ERROR BANNER (data could not be loaded) ────────────
export const LoadErrorBanner = ({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", marginBottom: 14, background: TINT_RED, border: `1px solid ${PAL.late.fill}`, borderRadius: RADIUS.tile }}>
    <span style={{ fontSize: TYPE.label.size, fontFamily: SANS, color: C.red }}>{what} couldn't be loaded ({message}). Tap Retry.</span>
    <B v="danger" onClick={onRetry} s={{ minHeight: 36, padding: "0 14px" }}>Retry</B>
  </div>
);

// ─── CARD ────────────────────────────────────────────────────
// Generic bordered card container
export const Card = ({
  children,
  label,
  onClick,
}: {
  children:  React.ReactNode;
  label?:    string;
  onClick?:  () => void;
}) => (
  <div
    onClick={onClick}
    style={{
      border:       `1px solid ${C.rule}`,
      borderRadius: RADIUS.tile,
      padding:      "14px 16px",
      background:   C.bg,
      cursor:       onClick ? "pointer" : "default",
    }}
  >
    {label && (
      <p
        style={{
          fontSize:      TYPE.micro.size,
          fontFamily:    SANS,
          color:         C.muted,
          letterSpacing: TRACK.caps,
          textTransform: "uppercase" as const,
          margin:        "0 0 10px",
        }}
      >
        {label}
      </p>
    )}
    {children}
  </div>
);

// ─── PAGE HEADER ─────────────────────────────────────────────
export const PageHeader = ({
  title,
  subtitle,
}: {
  title:     string;
  subtitle?: string;
}) => (
  <div style={{ marginBottom: 24 }}>
    <h2
      style={{
        fontFamily: SERIF,
        fontSize:   TYPE.pageTitle.size,
        fontWeight: "normal",
        margin:     "0 0 4px",
        color:      C.black,
      }}
    >
      {title}
    </h2>
    {subtitle && (
      <p
        style={{
          fontSize:      TYPE.micro.size,
          fontFamily:    SANS,
          color:         C.muted,
          letterSpacing: TRACK.caps,
          textTransform: "uppercase" as const,
          margin:        0,
        }}
      >
        {subtitle}
      </p>
    )}
  </div>
);

// ─── SECTION HEADING ─────────────────────────────────────────
export const SectionHead = ({ dot, label, right, s }: { dot?: string; label: string; right?: any; s?: any }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: `${DENSITY.sectionTop}px 2px ${DENSITY.sectionBottom}px`, fontFamily: SANS, ...s }}>
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: PAL.neutral.ink }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot || PAL.neutral.mid, flexShrink: 0 }} />{label}
    </span>
    {right !== undefined && right !== null && <span style={{ fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const }}>{right}</span>}
  </div>
);


// ═════════════════════════════════════════════════════════════
// MASTER PARTS (Gelato look) — one place for every list screen:
// summary line · filter chip · pill button · search field ·
// section header · list card · row · tag · icon circle · time bar
// Icons are passed in (atoms can't import PlannerWindows).
// ═════════════════════════════════════════════════════════════
export type ToneSet = { fill: string; wash: string; mid: string; ink: string };

export const Dot = ({ c, s }: { c: string; s?: any }) => (
  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0, ...s }} />
);

// "● 8 open · 5.716,00 €" under a title
export const SummaryLine = ({ dot, children }: { dot: string; children: any }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: TYPE.subtext.size, color: C.muted, marginTop: 4, fontFamily: SANS, flexWrap: "wrap" as const }}>
    <Dot c={dot} />{children}
  </div>
);
export const Strong = ({ children, color }: { children: any; color?: string }) => <span style={{ color: color || C.black, fontWeight: 500 }}>{children}</span>;

// filter chip: dot · label · count; on = tinted with its tone (neutral for "All")
// badge: a small round number after the count (e.g. new replies), only when > 0
export const Chip = ({ on, tone, label, count, onClick, dot = true, badge = 0 }: { on: boolean; tone: ToneSet; label: string; count?: number | string; onClick: () => void; dot?: boolean; badge?: number }) => (
  <button onClick={onClick} aria-pressed={on} aria-label={badge > 0 ? `${label}${count !== undefined ? ` ${count}` : ""}, ${badge} new` : undefined}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px", borderRadius: RADIUS.pill, border: `1px solid ${on ? (dot ? tone.fill : C.pillOn) : C.rule}`,
      background: on ? (dot ? tone.wash : PAL.neutral.fill) : C.white, color: on ? (dot ? tone.ink : C.black) : C.ink2,
      fontFamily: SANS, fontSize: TYPE.subtext.size, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
    {dot && <Dot c={tone.mid} />}{label}
    {count !== undefined && <span style={{ fontSize: TYPE.label.size, color: on ? (dot ? tone.ink : PAL.neutral.ink) : C.muted }}>{count}</span>}
    {badge > 0 && <span style={{ minWidth: 16, height: 16, padding: "0 4px", boxSizing: "border-box" as const, borderRadius: 8, background: PAL.progress.mid, color: C.white, fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
  </button>
);
export const ChipRow = ({ children, s }: { children: any; s?: any }) => (
  <div style={{ display: "flex", gap: 6, overflowX: "auto" as const, paddingBottom: 2, ...s }}>{children}</div>
);

// pill button: dark = the main action
export const PillBtn = ({ children, onClick, dark, dim, s, title }: { children: any; onClick?: () => void; dark?: boolean; dim?: boolean; s?: any; title?: string }) => (
  <button onClick={onClick} title={title}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: RADIUS.pill, border: `1px solid ${dark ? C.black : C.edge}`,
      background: dark ? C.black : C.white, color: dark ? C.white : C.black, fontFamily: SANS, fontSize: TYPE.subtext.size, cursor: "pointer",
      opacity: dim ? 0.5 : 1, whiteSpace: "nowrap" as const, flexShrink: 0, ...s }}>{children}</button>
);

export const SearchField = ({ value, onChange, placeholder, s }: { value: string; onChange: (v: string) => void; placeholder: string; s?: any }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 8, height: DENSITY.field, padding: "0 12px", background: C.white, border: `1px solid ${C.field}`, borderRadius: RADIUS.tile, boxSizing: "border-box" as const, ...s }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 17a7 7 0 1 0 0-14a7 7 0 0 0 0 14zM21 21l-6-6" /></svg>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: SANS, color: C.black, padding: 0, height: 34 }} />
  </label>
);

// group header: ● LABEL · n ……… total


export const ListCard = ({ children, s }: { children: any; s?: any }) => (
  <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, overflow: "hidden", ...s }}>{children}</div>
);

// one row of a list that is built row by row (Projects): together the rows look like one ListCard
export const listSeg = (first: boolean, last: boolean): any => {
  const r = (on: boolean) => (on ? RADIUS.card : 0);
  return {
    background: C.white, borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`,
    borderTop: first ? `1px solid ${C.line}` : "none", borderBottom: last ? `1px solid ${C.line}` : "none",
    borderRadius: `${r(first)}px ${r(first)}px ${r(last)}px ${r(last)}px`,
    boxShadow: SHADOW.card, clipPath: `inset(${first ? -30 : 0}px -30px ${last ? -30 : 0}px -30px)`,
  };
};

export const TonedTag = ({ tone, children, s }: { tone: ToneSet; children: any; s?: any }) => (
  <span data-tag="" style={{ display: "inline-block", fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, padding: "2px 8px", borderRadius: RADIUS.tag, background: tone.fill, color: tone.ink, whiteSpace: "nowrap" as const, ...s }}>{children}</span>
);

export const IconCircle = ({ tone, children, size = 30, s }: { tone: ToneSet; children: any; size?: number; s?: any }) => (
  <span style={{ width: size, height: size, borderRadius: "50%", background: tone.wash, color: tone.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...s }}>{children}</span>
);

// one list row: [icon] title / details …… right  ›
export const Row = ({ icon, title, meta, right, onClick, first, chevron = true, highlight, s }: {
  icon?: any; title: any; meta?: any; right?: any; onClick?: () => void; first?: boolean; chevron?: boolean; highlight?: boolean; s?: any;
}) => (
  <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e: any) => { if (e.key === "Enter") onClick(); } : undefined}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "9px 10px 9px 12px", borderTop: first ? "none" : `1px solid ${C.hair}`,
      cursor: onClick ? "pointer" : "default", background: highlight ? PAL.progress.wash : undefined, fontFamily: SANS, ...s }}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: SPACING.listText, color: C.black, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      {meta && <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>}
    </div>
    {right !== undefined && right !== null && <div style={{ textAlign: "right" as const, flexShrink: 0 }}>{right}</div>}
    {onClick && chevron && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>}
  </div>
);

export const TimeBar = ({ pct, color, s }: { pct: number; color: string; s?: any }) => (
  <div style={{ height: 3, background: PAL.neutral.fill, borderRadius: RADIUS.bar, ...s }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 3, background: color, borderRadius: RADIUS.bar }} />
  </div>
);


// switch (on/off) — 44 px tap area around a 30×18 track
export const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
    <span style={{ width: 30, height: 18, borderRadius: RADIUS.tag, background: on ? C.black : C.rule, position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: C.white, transition: "left .15s" }} />
    </span>
  </button>
);

// − n + (whole numbers, min 1). h = height: 40 alone, 32 inside a row or panel (compact).
export const Stepper = ({ value, onChange, min = 1, label, h }: { value: number; onChange: (v: number) => void; min?: number; label: string; h?: number }) => {
  const H = h || SIZE.field, compact = H < SIZE.field, W = compact ? 36 : 44;
  return (
    <div role="group" aria-label={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: H, border: `1px solid ${C.field}`, borderRadius: RADIUS.field, background: C.white, fontFamily: SANS, boxSizing: "border-box" as const }}>
      <button aria-label={`${label} minus`} onClick={() => onChange(Math.max(min, value - 1))} style={{ width: W, height: "100%", background: "none", border: "none", fontSize: compact ? 16 : ICON.step, color: C.muted, cursor: "pointer", padding: 0 }}>−</button>
      <span style={{ fontSize: compact ? TYPE.row.size : TYPE.body.size }}>{value}</span>
      <button aria-label={`${label} plus`} onClick={() => onChange(value + 1)} style={{ width: W, height: "100%", background: "none", border: "none", fontSize: compact ? 16 : ICON.step, color: C.muted, cursor: "pointer", padding: 0 }}>+</button>
    </div>
  );
};

// one quiet line of details with an edit pencil (date · validity · language …)
export const DetailLine = ({ children, onEdit, s }: { children: any; onEdit?: () => void; s?: any }) => (
  <div onClick={onEdit} role={onEdit ? "button" : undefined} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 44, fontSize: TYPE.subtext.size, color: C.ink2, fontFamily: SANS, cursor: onEdit ? "pointer" : "default", ...s }}>
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{children}</span>
    {onEdit && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>}
  </div>
);

// bar fixed to the bottom of the screen (total + main action); content needs paddingBottom: BOTTOM_BAR_SPACE
export const BOTTOM_BAR_SPACE = 96;
// iPad / computer: the bar's content lines up with the page (maxW = the page's width), not the screen edges
export const BottomBar = ({ children, maxW }: { children: any; maxW?: number }) => {
  const { isMobile, isWide } = useScreen();
  const w = maxW ?? (isMobile ? undefined : (isWide ? 1200 : 960) - 40);   // the page's width minus its 20 px sides
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: C.white, borderTop: `1px solid ${C.line}`, boxShadow: SHADOW.bar,
      padding: "11px 14px calc(14px + env(safe-area-inset-bottom, 0px))", fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", maxWidth: w, margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
};


// ═════════════════════════════════════════════════════════════
// DASHBOARD PARTS — the Manager dashboard is the master for every app
//   DashCard (white card) · DashCardHead · DashStrip (bottom strip)
//   DashTile (pastel tile) · WideRow (like Pipeline) · LinkRow (like Licenses)
//   BarList (like "Revenue by offer") · SwitchPill (year / month / account)
//   DashIcon (22 px icon circle) · Chev
// Icons are passed in (atoms can't import PlannerWindows).
// ═════════════════════════════════════════════════════════════
export const pressProps = (fn?: () => void): any => fn ? { role: "button", tabIndex: 0, onClick: fn, onKeyDown: (e: any) => { if (e.key === "Enter") fn(); } } : {};
const CAPS: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" };
export const Chev = ({ color }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color || C.faint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
);
export const DashIcon = ({ tone, bg, children }: { tone: ToneSet; bg?: string; children: any }) => (
  <span style={{ width: DENSITY.iconSm, height: DENSITY.iconSm, borderRadius: "50%", background: bg || tone.wash, color: tone.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{children}</span>
);
export const DashCard = ({ onClick, children, s }: { onClick?: () => void; children: any; s?: any }) => (
  <div {...pressProps(onClick)} style={{ marginTop: 10, background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, overflow: "hidden", cursor: onClick ? "pointer" : "default", ...s }}>{children}</div>
);
export const DashCardHead = ({ icon, label, arrow }: { icon: any; label: any; arrow?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>{icon}<span style={{ ...CAPS, color: C.muted }}>{label}</span></span>
    {arrow && <Chev />}
  </div>
);
export const DashStrip = ({ tone, left, right, pct }: { tone: ToneSet; left: any; right?: any; pct: number }) => (
  <div style={{ padding: "7px 13px 8px", borderTop: `1px solid ${C.hair}`, background: PAL.neutral.wash }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: TYPE.label.size, color: tone === PAL.neutral ? PAL.neutral.ink : tone.ink }}><span>{left}</span>{right !== undefined && <span>{right}</span>}</div>
    <div style={{ height: DENSITY.thin, background: C.line, borderRadius: RADIUS.bar, marginTop: 5 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: DENSITY.thin, background: tone.mid, borderRadius: RADIUS.bar }} />
    </div>
  </div>
);
export const DashTile = ({ tone, icon, label, value, sub, onClick }: { tone: ToneSet; icon: any; label: any; value: any; sub?: any; onClick?: () => void }) => (
  <div {...pressProps(onClick)} style={{ background: tone.wash, borderRadius: RADIUS.tile, padding: "10px 11px 9px", cursor: onClick ? "pointer" : "default", minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><DashIcon tone={tone} bg={C.white}>{icon}</DashIcon><span style={{ ...CAPS, color: tone.ink, whiteSpace: "nowrap" as const }}>{label}</span></span>
      {onClick && <Chev color={tone.mid} />}
    </div>
    <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, marginTop: 7, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    {sub !== undefined && <div style={{ fontSize: TYPE.label.size, color: tone.ink, marginTop: 1 }}>{sub}</div>}
  </div>
);
// full width, inside the tile grid (or alone): like Pipeline
export const WideRow = ({ tone = PAL.neutral, icon, label, right, onClick }: { tone?: ToneSet; icon: any; label: any; right?: any; onClick?: () => void }) => (
  <div {...pressProps(onClick)} style={{ gridColumn: "1 / -1", background: tone.wash, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, padding: "9px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: onClick ? "pointer" : "default", minHeight: DENSITY.tap, boxSizing: "border-box" as const }}>
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><DashIcon tone={tone} bg={C.white}>{icon}</DashIcon><span style={{ ...CAPS, color: tone.ink }}>{label}</span></span>
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{right}{onClick && <Chev color={tone.mid} />}</span>
  </div>
);
// white row with a tag: like Licenses
export const LinkRow = ({ icon, label, tag, tone, tagFilled = true, onClick, s }: { icon: any; label: any; tag?: any; tone: ToneSet; tagFilled?: boolean; onClick?: () => void; s?: any }) => (
  <div {...pressProps(onClick)} style={{ minHeight: DENSITY.tap, boxSizing: "border-box" as const, marginTop: 8, padding: "0 12px", background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: onClick ? "pointer" : "default", ...s }}>
    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: TYPE.row.size }}>{icon}{label}</span>
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {tag !== undefined && tag !== null && <span data-tag="" style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, padding: "2px 8px", borderRadius: RADIUS.tag, background: tagFilled ? tone.fill : "transparent", color: tone.ink, whiteSpace: "nowrap" as const }}>{tag}</span>}
      {onClick && <Chev />}
    </span>
  </div>
);
// list with thin bars: like "Revenue by offer"
export const BarList = ({ rows, empty }: { rows: { key: string; label: any; value: any; pct: number; pctText?: string; color?: string }[]; empty?: string }) => (
  <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, padding: "2px 12px" }}>
    {rows.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0, padding: "10px 0" }}>{empty || "Nothing yet."}</p>}
    {rows.map((r, k) => (
      <div key={r.key} style={{ padding: "8px 0", borderTop: k ? `1px solid ${C.hair}` : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: TYPE.row.size }}>
          <span>{r.label}</span>
          <span style={{ whiteSpace: "nowrap" as const }}>{r.value}{r.pctText !== undefined && <span style={{ fontSize: TYPE.label.size, color: C.muted, marginLeft: 4 }}>{r.pctText}</span>}</span>
        </div>
        <div style={{ height: DENSITY.thin, background: C.hair, borderRadius: RADIUS.bar, marginTop: 6 }}>
          <div style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, height: DENSITY.thin, background: r.color || PAL.neutral.mid, borderRadius: RADIUS.bar }} />
        </div>
      </div>
    ))}
  </div>
);
// 28 px pill for year / month / account switches
export const SwitchPill = ({ children, s }: { children: any; s?: any }) => (
  <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${C.rule}`, borderRadius: RADIUS.card, background: C.white, height: 28, fontSize: TYPE.subtext.size, ...s }}>{children}</span>
);

// item window: one level above the screen — 48 px header (✕ · title · action),
// content, optional bottom bar (Cancel / Save). Read view first.
// How much of the screen the on-screen keyboard covers (iPhone / iPad), so a bottom sheet can sit on top
// of it — its buttons stay visible while typing. 0 on a computer or with the keyboard closed.
export function useKeyboardInset(): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv: any = (window as any).visualViewport;
    if (!vv) return;
    const calc = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    calc();
    vv.addEventListener("resize", calc); vv.addEventListener("scroll", calc);
    return () => { vv.removeEventListener("resize", calc); vv.removeEventListener("scroll", calc); };
  }, []);
  return kb > 60 ? kb : 0;                         // small differences (browser bars) aren't a keyboard
}

export const Sheet = ({ title, onClose, right, children, footer }: { title: string; onClose: () => void; right?: any; children: any; footer?: any }) => {
  const kb = useKeyboardInset();
  useEscape(true, onClose);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: Z.modal, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: SANS, paddingBottom: kb }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,26,26,0.28)" }} />
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ position: "relative", background: C.white, borderRadius: `${RADIUS.button}px ${RADIUS.button}px 0 0`, boxShadow: SHADOW.pop, maxHeight: kb ? `calc(100vh - ${kb + 12}px)` : "88vh", display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, margin: "0 auto", color: C.black }}>
        <div style={{ height: DENSITY.sheetHeader, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 0 4px", flexShrink: 0 }}>
          <button onClick={onClose} aria-label="Close" style={{ width: DENSITY.tap, height: DENSITY.tap, background: "none", border: "none", fontSize: ICON.close, color: C.muted, cursor: "pointer" }}>✕</button>
          <span style={{ ...CAPS, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, padding: "0 6px" }}>{title}</span>
          <span style={{ minWidth: DENSITY.tap, display: "flex", justifyContent: "flex-end" }}>{right}</span>
        </div>
        <div style={{ overflowY: "auto", padding: "2px 16px 16px", WebkitOverflowScrolling: "touch" as any }}>{children}</div>
        {footer && <div style={{ padding: kb ? "10px 16px 10px" : "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${C.line}`, display: "flex", gap: 8, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
};


// ── ValuePill: a number shown as a small value (14 px in a 28 px pill); tap = edit in place.
//    The field types at 16 px (no iPhone zoom) and is drawn at 14 px (scale .875).
//    Enter or tapping away saves, Escape keeps the old value.
// white: a white field with a thin border — for fields sitting on a coloured tile (Creator goals)
export function ValuePill({ text, label, onCommit, width = 72, white }: { text: string; label: string; onCommit: (t: string) => void; width?: number; white?: boolean }) {
  const [focus, setFocus] = useState(false);
  const k = 0.875;
  return (
    <span style={{ position: "relative", display: "inline-block", width, height: 28, flexShrink: 0 }}>
      <input key={text} defaultValue={text} aria-label={label} inputMode="numeric" placeholder="–"
        onFocus={(e) => { setFocus(true); e.target.select(); }}
        onBlur={(e) => { setFocus(false); if (e.target.value !== text) onCommit(e.target.value); }}
        onKeyDown={(e) => { const el = e.target as HTMLInputElement; if (e.key === "Enter") el.blur(); if (e.key === "Escape") { el.value = text; el.blur(); } }}
        style={{ position: "absolute", top: 0, right: 0, width: width / k, height: 28 / k, transform: `scale(${k})`, transformOrigin: "top right",
          fontSize: 16, fontFamily: SANS, textAlign: "right" as const, padding: "0 11px", boxSizing: "border-box" as const, borderRadius: 8 / k,
          border: `1px solid ${focus || white ? C.edge : "transparent"}`, background: focus || white ? C.white : PAL.neutral.wash, color: C.black, outline: "none", margin: 0 }} />
    </span>
  );
}
// ── WeekPill: ‹ Week 43 › in the 28 px switcher pill (same as the dashboard's year)
export const WeekPill = ({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) => {
  const arrow = (aria: string, ch: string, fn: () => void) => (
    <button aria-label={aria} onClick={fn} style={{ background: "none", border: "none", padding: "0 9px", height: 28, cursor: "pointer", color: C.muted, fontFamily: SANS, fontSize: TYPE.subtext.size }}>{ch}</button>
  );
  return <SwitchPill>{arrow("Previous week", "‹", onPrev)}<span style={{ minWidth: 52, textAlign: "center" as const, whiteSpace: "nowrap" as const }}>{label}</span>{arrow("Next week", "›", onNext)}</SwitchPill>;
};


// ── TextInline: a line of text you edit in place (one tap, no window).
//    Drawn at 13 px; the field types at 16 px (no iPhone zoom), scaled down.
// size: the drawn text size (13 px lists by default; the Planner's lists use 14 px)
export function TextInline({ value, onSave, placeholder, ariaLabel, muted, strike, autoFocus, onEnter, size }: {
  value: string; onSave: (v: string) => void; placeholder?: string; ariaLabel?: string; muted?: boolean; strike?: boolean; autoFocus?: boolean; onEnter?: () => void; size?: number;
}) {
  const [t, setT] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(value); }, [value, focus]);
  const k = (size || SPACING.listText) / 16, H = 30;
  return (
    <span style={{ position: "relative", display: "block", flex: 1, minWidth: 0, height: H }}>
      <input value={t} placeholder={placeholder} aria-label={ariaLabel} autoFocus={autoFocus}
        onChange={(e) => setT(e.target.value)} onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); if (t !== value) onSave(t); }}
        onKeyDown={(e) => { const el = e.target as HTMLInputElement; if (e.key === "Enter") { el.blur(); onEnter?.(); } if (e.key === "Escape") { setT(value); setTimeout(() => el.blur()); } }}
        style={{ position: "absolute", left: -7, top: 0, width: `calc((100% + 14px) / ${k})`, height: H / k, transform: `scale(${k})`, transformOrigin: "left top",
          fontSize: 16, fontFamily: SANS, color: muted ? C.light : C.black, textDecoration: strike ? "line-through" : "none", textOverflow: "ellipsis",
          background: focus ? C.white : "transparent", border: `1px solid ${focus ? C.edge : "transparent"}`, borderRadius: 8 / k,
          padding: `0 ${6 / k}px`, boxSizing: "border-box" as const, outline: "none", margin: 0 }} />
    </span>
  );
}


// ── Mini fields: drawn at row size (13 px) in rows and panels, but typed at 16 px so the
//    iPhone doesn't zoom — the 16 px field is scaled down (same method as ValuePill).
//    bare = no frame (a value inside a list row) · h = drawn height (32 by default)
const MK = TYPE.row.size / TYPE.field.size;
const miniBox = (h: number, s?: any): any => ({ position: "relative", display: "block", width: "100%", minWidth: 0, height: h, ...s });
const miniCtl = (h: number, bare?: boolean): any => ({
  position: "absolute", left: 0, top: 0, width: `${100 / MK}%`, height: h / MK, transform: `scale(${MK})`, transformOrigin: "left top",
  fontSize: TYPE.field.size, fontFamily: SANS, color: C.black, margin: 0, outline: "none", boxSizing: "border-box" as const,
  border: bare ? "none" : `${1 / MK}px solid ${C.field}`, borderRadius: bare ? 0 : RADIUS.field / MK,
});
export const MiniInput = ({ bare, h = SPACING.rowField, s, ...p }: any) => (
  <span style={miniBox(h, s)}>
    <input {...p} style={{ ...miniCtl(h, bare), padding: bare ? 0 : `0 ${10 / MK}px`, background: bare ? "transparent" : C.white,
      ...(p.type === "date" ? {} : { WebkitAppearance: "none" as const }) }} />
  </span>
);
export const MiniSelect = ({ bare, muted, h = SPACING.rowField, s, children, ...p }: any) => (
  <span style={miniBox(h, s)}>
    <select {...p} style={{ ...miniCtl(h, bare), color: muted ? C.light : C.black, cursor: "pointer",
      padding: bare ? `0 ${22 / MK}px 0 0` : `0 ${26 / MK}px 0 ${10 / MK}px`,
      backgroundColor: bare ? "transparent" : C.white, backgroundImage: SELECT_ARROW, backgroundRepeat: "no-repeat",
      backgroundPosition: `right ${(bare ? 2 : 10) / MK}px center`, backgroundSize: `${10 / MK}px ${6 / MK}px`,
      WebkitAppearance: "none" as const, appearance: "none" as const }}>{children}</select>
  </span>
);
