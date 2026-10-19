// ─────────────────────────────────────────────────────────────
// ATOMS — reusable UI primitives
// Every value comes from constants. No inline hex. No raw px.
// Desktop + iPad + PWA iOS safe.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, STATUS_COLOR, STATUS_NAME, catInfo, expiryColor, expiryTint, Z, SIZE, PAL, STATUS_TONE } from "./constants";
import { fmtD, dLeft, today, parseDE, fmtNumDE } from "./formatters";
import { saveStatus } from "./saveStatus";

// ─── INPUT ───────────────────────────────────────────────────
export const I = ({ s, ...p }: any) => (
  <input
    style={{
      width:       "100%",
      height:      SIZE.field,
      padding:     "0 10px",
      border:      "1px solid #ebe7e2",
      background:  C.white,
      fontFamily:  SANS,
      fontSize:    16,  // iOS auto-zooms inputs < 16px — never go below
      color:       C.black,
      borderRadius: 10,
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
      letterSpacing: "0.08em",
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
    <span style={{ fontSize: 8, color: C.light, pointerEvents: "none" as const }}>▾</span>
  </span>
);

// ─── SELECT ──────────────────────────────────────────────────
const SELECT_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888888' stroke-width='1.3'/%3E%3C/svg%3E")`;

export const S = ({ s, ...p }: any) => (
  <select
    style={{
      width:        "100%",
      height:       SIZE.field,
      padding:      "0 28px 0 10px",
      border:       "1px solid #ebe7e2",
      backgroundColor: C.white,
      backgroundImage: SELECT_ARROW,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 10px center",
      fontFamily:   SANS,
      fontSize:     16,  // iOS auto-zooms selects < 16px — never go below
      color:        C.black,
      borderRadius: 10,
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
    sec:    { background: C.white, color: C.black, border: "1px solid #e2ddd6" },
    ghost:  { background: "none",  color: C.muted, border: "none" },
    danger: { background: C.white, color: C.red,   border: `1px solid ${PAL.late.fill}` },
  };
  const fs = Math.max(12, Number(s?.fontSize) || 13);
  return (
    <button
      style={{
        padding:       "0 15px",
        borderRadius:  18,
        cursor:        "pointer",
        fontFamily:    SANS,
        letterSpacing: "0.01em",
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
  <button
    onClick={onClick}
    style={{
      padding:       size === "sm" ? "0 9px" : "0 11px",
      border:        `1px solid ${on ? "#d9d3cc" : C.rule}`,
      background:    on ? PAL.neutral.fill : C.white,
      color:         on ? C.black : C.muted,
      borderRadius:  15,
      cursor:        "pointer",
      fontFamily:    SANS,
      fontSize:      TYPE.micro.size,
      letterSpacing: "0.10em",
      textTransform: "uppercase" as const,
      whiteSpace:    "nowrap" as const,
      minHeight:     size === "sm" ? SIZE.chip : SIZE.pill,
      display:       "inline-flex",
      alignItems:    "center",
    }}
  >
    {children}
  </button>
);

// ─── NUMBER FIELD (German typing: 212,50 · 1.200,75) ─────────
// Keeps what you type while the field is active; shows German format
// when you leave it. onChange gets a number (or null when empty).
export function NumField({ value, onChange, minDec = 2, placeholder, s, ariaLabel }: {
  value: number | null | undefined; onChange: (n: number | null) => void; minDec?: number;
  placeholder?: string; s?: any; ariaLabel?: string;
}) {
  const [text, setText] = useState(() => fmtNumDE(value, minDec));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmtNumDE(value, minDec)); }, [value, focused, minDec]);
  return (
    <I type="text" inputMode="decimal" value={text} placeholder={placeholder} s={s} aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(fmtNumDE(parseDE(text), minDec)); }}
      onChange={(e: any) => { setText(e.target.value); onChange(parseDE(e.target.value)); }} />
  );
}

// ─── LANGUAGE SWITCH (EN | DE as one joined control) ─────────
export const LangSwitch = ({ lang, onChange }: { lang: string; onChange: (l: "en" | "de") => void }) => (
  <span style={{ display: "inline-flex", flexShrink: 0 }}>
    {(["en", "de"] as const).map((l, i) => {
      const on = lang === l;
      return (
        <button key={l} onClick={() => onChange(l)}
          style={{ height: SIZE.barBtn, padding: "0 9px", border: `1px solid ${on ? C.black : C.rule}`, borderLeftWidth: i ? 0 : 1, background: on ? C.black : "transparent", color: on ? C.white : C.muted, borderRadius: i ? "0 2px 2px 0" : "2px 0 0 2px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.10em" }}>
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
      letterSpacing: "0.08em",
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
      borderRadius: 9,
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
  const col = expiryColor(d);
  const bg  = expiryTint(d);
  const bd  = col;

  return (
    <span
      style={{
        fontSize:     TYPE.micro.size,
        fontFamily:   SANS,
        color:        col,
        border:       `1px solid ${bd}`,
        background:   bg,
        padding:      "3px 10px",
        borderRadius: 9,
        whiteSpace:   "nowrap" as const,
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
      borderRadius: 12,
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
        letterSpacing: "0.14em",
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
        borderRadius:  9,
        letterSpacing: "0.07em",
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
      style={{ fontSize: TYPE.micro.size, fontFamily: SANS, padding: "2px 8px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, color: c.color, whiteSpace: "nowrap" as const, flexShrink: 0, cursor: onClick ? "pointer" : "default", display: "inline-block" }}>
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
    <span style={{ width: size, height: size, borderRadius: 3, border: `1.5px solid ${on ? color : C.light}`, background: on ? color : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" as const }}>
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
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: Z.dialog, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,249,247,0.88)", padding: 16 }}>
      <div style={{ background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 14, padding: "24px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", width: "100%", maxWidth: 340 }}>
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
  const base: any = { position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: Z.toast, borderRadius: 12, padding: "8px 14px", fontFamily: SANS, fontSize: TYPE.label.size, letterSpacing: "0.04em", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 12, maxWidth: "calc(100vw - 32px)" };
  if (st.error) return (
    <div style={{ ...base, background: TINT_RED, border: `1px solid ${C.red}`, color: C.red }}>
      <span>Couldn't save — {st.error}. Your last change was undone.</span>
      <button onClick={() => saveStatus.clearError()} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, textDecoration: "underline" }}>OK</button>
    </div>
  );
  if (st.pending > 0) return <div style={{ ...base, background: C.bg, border: `1px solid ${C.rule}`, color: C.muted }}>Saving…</div>;
  if (showSaved) return <div style={{ ...base, background: C.bg, border: `1px solid ${C.rule}`, color: C.green }}>Saved ✓</div>;
  return null;
};
const TINT_RED = "#fdf0f0";

// ─── LOAD ERROR BANNER (data could not be loaded) ────────────
export const LoadErrorBanner = ({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", marginBottom: 14, background: TINT_RED, border: `1px solid ${C.red}`, borderRadius: 12 }}>
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
      borderRadius: 12,
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
          letterSpacing: "0.07em",
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
          letterSpacing: "0.07em",
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
export const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3
    style={{
      fontFamily: SERIF,
      fontSize:   TYPE.sectionHeading.size,
      fontWeight: "normal",
      color:      C.black,
      margin:     "0 0 12px",
    }}
  >
    {children}
  </h3>
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
  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a847d", marginTop: 4, fontFamily: SANS, flexWrap: "wrap" as const }}>
    <Dot c={dot} />{children}
  </div>
);
export const Strong = ({ children, color }: { children: any; color?: string }) => <span style={{ color: color || C.black, fontWeight: 500 }}>{children}</span>;

// filter chip: dot · label · count; on = tinted with its tone (neutral for "All")
export const Chip = ({ on, tone, label, count, onClick, dot = true }: { on: boolean; tone: ToneSet; label: string; count?: number | string; onClick: () => void; dot?: boolean }) => (
  <button onClick={onClick} aria-pressed={on}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px", borderRadius: 15, border: `1px solid ${on ? (dot ? tone.fill : "#d9d3cc") : C.rule}`,
      background: on ? (dot ? tone.wash : PAL.neutral.fill) : C.white, color: on ? (dot ? tone.ink : C.black) : "#4a4540",
      fontFamily: SANS, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
    {dot && <Dot c={tone.mid} />}{label}
    {count !== undefined && <span style={{ fontSize: 11, color: on ? (dot ? tone.ink : "#6b655e") : C.muted }}>{count}</span>}
  </button>
);
export const ChipRow = ({ children, s }: { children: any; s?: any }) => (
  <div style={{ display: "flex", gap: 6, overflowX: "auto" as const, paddingBottom: 2, ...s }}>{children}</div>
);

// pill button: dark = the main action
export const PillBtn = ({ children, onClick, dark, dim, s, title }: { children: any; onClick?: () => void; dark?: boolean; dim?: boolean; s?: any; title?: string }) => (
  <button onClick={onClick} title={title}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 15, border: `1px solid ${dark ? C.black : "#e2ddd6"}`,
      background: dark ? C.black : C.white, color: dark ? C.white : C.black, fontFamily: SANS, fontSize: 12, cursor: "pointer",
      opacity: dim ? 0.5 : 1, whiteSpace: "nowrap" as const, flexShrink: 0, ...s }}>{children}</button>
);

export const SearchField = ({ value, onChange, placeholder, s }: { value: string; onChange: (v: string) => void; placeholder: string; s?: any }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", background: C.white, border: "1px solid #ebe7e2", borderRadius: 12, boxSizing: "border-box" as const, ...s }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b0aaa3" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 17a7 7 0 1 0 0-14a7 7 0 0 0 0 14zM21 21l-6-6" /></svg>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: SANS, color: C.black, padding: 0, height: 34 }} />
  </label>
);

// group header: ● LABEL · n ……… total
export const SectionHead = ({ dot, label, right, s }: { dot?: string; label: string; right?: any; s?: any }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "14px 4px 6px", fontFamily: SANS, ...s }}>
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#8a847d" }}>{dot && <Dot c={dot} />}{label}</span>
    {right !== undefined && right !== null && <span style={{ fontSize: 11, color: "#6b655e", whiteSpace: "nowrap" as const }}>{right}</span>}
  </div>
);

export const ListCard = ({ children, s }: { children: any; s?: any }) => (
  <div style={{ background: C.white, border: "1px solid #efebe6", borderRadius: 12, overflow: "hidden", ...s }}>{children}</div>
);

export const TonedTag = ({ tone, children, s }: { tone: ToneSet; children: any; s?: any }) => (
  <span data-tag="" style={{ display: "inline-block", fontSize: 10, letterSpacing: "0.03em", padding: "2px 8px", borderRadius: 9, background: tone.fill, color: tone.ink, whiteSpace: "nowrap" as const, ...s }}>{children}</span>
);

export const IconCircle = ({ tone, children, size = 30, s }: { tone: ToneSet; children: any; size?: number; s?: any }) => (
  <span style={{ width: size, height: size, borderRadius: "50%", background: tone.wash, color: tone.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...s }}>{children}</span>
);

// one list row: [icon] title / details …… right  ›
export const Row = ({ icon, title, meta, right, onClick, first, chevron = true, highlight, s }: {
  icon?: any; title: any; meta?: any; right?: any; onClick?: () => void; first?: boolean; chevron?: boolean; highlight?: boolean; s?: any;
}) => (
  <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e: any) => { if (e.key === "Enter") onClick(); } : undefined}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "9px 10px 9px 12px", borderTop: first ? "none" : "1px solid #f4f1ed",
      cursor: onClick ? "pointer" : "default", background: highlight ? PAL.progress.wash : undefined, fontFamily: SANS, ...s }}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, color: C.black, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      {meta && <div style={{ fontSize: 12, color: "#8a847d", marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>}
    </div>
    {right !== undefined && right !== null && <div style={{ textAlign: "right" as const, flexShrink: 0 }}>{right}</div>}
    {onClick && chevron && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#cfc9c2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>}
  </div>
);

export const TimeBar = ({ pct, color, s }: { pct: number; color: string; s?: any }) => (
  <div style={{ height: 3, background: "#f1eeea", borderRadius: 2, ...s }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 3, background: color, borderRadius: 2 }} />
  </div>
);


// switch (on/off) — 44 px tap area around a 30×18 track
export const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
    <span style={{ width: 30, height: 18, borderRadius: 9, background: on ? C.black : "#e8e4df", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: C.white, transition: "left .15s" }} />
    </span>
  </button>
);

// − n + (whole numbers, min 1)
export const Stepper = ({ value, onChange, min = 1, label }: { value: number; onChange: (v: number) => void; min?: number; label: string }) => (
  <div role="group" aria-label={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: SIZE.field, border: "1px solid #ebe7e2", borderRadius: 10, background: C.white, fontFamily: SANS }}>
    <button aria-label={`${label} minus`} onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 44, height: "100%", background: "none", border: "none", fontSize: 18, color: C.muted, cursor: "pointer" }}>−</button>
    <span style={{ fontSize: 15 }}>{value}</span>
    <button aria-label={`${label} plus`} onClick={() => onChange(value + 1)} style={{ width: 44, height: "100%", background: "none", border: "none", fontSize: 18, color: C.muted, cursor: "pointer" }}>+</button>
  </div>
);

// one quiet line of details with an edit pencil (date · validity · language …)
export const DetailLine = ({ children, onEdit, s }: { children: any; onEdit?: () => void; s?: any }) => (
  <div onClick={onEdit} role={onEdit ? "button" : undefined} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 32, fontSize: 12, color: "#4a4540", fontFamily: SANS, cursor: onEdit ? "pointer" : "default", ...s }}>
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{children}</span>
    {onEdit && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a847d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>}
  </div>
);

// bar fixed to the bottom of the screen (total + main action); content needs paddingBottom: BOTTOM_BAR_SPACE
export const BOTTOM_BAR_SPACE = 96;
export const BottomBar = ({ children }: { children: any }) => (
  <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: C.white, borderTop: "1px solid #efebe6", boxShadow: "0 -6px 18px rgba(26,26,26,0.06)",
    padding: "11px 14px calc(14px + env(safe-area-inset-bottom, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: SANS }}>
    {children}
  </div>
);
