// ─────────────────────────────────────────────────────────────
// ATOMS — reusable UI primitives
// Every value comes from constants. No inline hex. No raw px.
// Desktop + iPad + PWA iOS safe.
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, TYPE } from "./constants";
import { fmtD, dLeft } from "./formatters";

// ─── INPUT ───────────────────────────────────────────────────
export const I = ({ s, ...p }: any) => (
  <input
    style={{
      width:       "100%",
      padding:     "9px 12px",
      border:      `1px solid ${C.rule}`,
      background:  C.bg,
      fontFamily:  SANS,
      fontSize:    TYPE.body.size,
      color:       C.black,
      borderRadius: 2,
      outline:     "none",
      boxSizing:   "border-box" as const,
      // iOS PWA — prevent auto-zoom on focus
      // font-size >= 16 prevents zoom; we handle via viewport meta instead
      WebkitAppearance: "none" as const,
      ...s,
    }}
    {...p}
  />
);

// ─── SELECT ──────────────────────────────────────────────────
export const S = ({ s, ...p }: any) => (
  <select
    style={{
      width:        "100%",
      padding:      "9px 12px",
      border:       `1px solid ${C.rule}`,
      background:   C.bg,
      fontFamily:   SANS,
      fontSize:     TYPE.body.size,
      color:        C.black,
      borderRadius: 2,
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
// v="ghost" no border, muted text       — inline / destructive
export const B = ({ v = "pri", s, ...p }: any) => {
  const styles: Record<string, any> = {
    pri: {
      background:  C.black,
      color:       C.white,
      border:      "none",
    },
    sec: {
      background:  "transparent",
      color:       C.muted,
      border:      `1px solid ${C.rule}`,
    },
    ghost: {
      background:  "none",
      color:       C.muted,
      border:      "none",
    },
  };

  return (
    <button
      style={{
        padding:       "9px 16px",
        borderRadius:  2,
        cursor:        "pointer",
        fontFamily:    SANS,
        fontSize:      TYPE.button.size,
        letterSpacing: "0.10em",
        textTransform: "uppercase" as const,
        whiteSpace:    "nowrap" as const,
        lineHeight:    1,
        // Touch target — minimum 44px for iOS PWA
        minHeight:     44,
        display:       "inline-flex",
        alignItems:    "center",
        justifyContent:"center",
        ...styles[v] ?? styles.pri,
        ...s,
      }}
      {...p}
    />
  );
};

// ─── PILL TOGGLE ─────────────────────────────────────────────
// Used for category tabs, filter pills
export const Pill = ({ on, onClick, children }: any) => (
  <button
    onClick={onClick}
    style={{
      padding:       "7px 14px",
      border:        `1px solid ${on ? C.black : C.rule}`,
      background:    on ? C.black : "transparent",
      color:         on ? C.white : C.muted,
      borderRadius:  2,
      cursor:        "pointer",
      fontFamily:    SANS,
      fontSize:      TYPE.micro.size,
      letterSpacing: "0.10em",
      textTransform: "uppercase" as const,
      whiteSpace:    "nowrap" as const,
      minHeight:     36,
      display:       "inline-flex",
      alignItems:    "center",
    }}
  >
    {children}
  </button>
);

// ─── FIELD LABEL ─────────────────────────────────────────────
export const Lbl = ({ children }: any) => (
  <p
    style={{
      fontSize:      TYPE.label.size,
      fontFamily:    SANS,
      color:         C.muted,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      margin:        "14px 0 6px",
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
      borderRadius: 2,
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
  const urgent = d !== null && d >= 0 && d <= 14;
  const soon   = d !== null && d > 14 && d <= 30;

  const col = exp || urgent ? C.red   : soon ? C.amber : C.green;
  const bg  = exp || urgent ? "#fdf0f0" : soon ? "#fdf6ee" : "#f0f5f0";
  const bd  = exp || urgent ? "#e8c8c8" : soon ? "#ead9c0" : "#b8d4b8";

  return (
    <span
      style={{
        fontSize:     TYPE.micro.size,
        fontFamily:   SANS,
        color:        col,
        border:       `1px solid ${bd}`,
        background:   bg,
        padding:      "3px 10px",
        borderRadius: 2,
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
      borderRadius: 2,
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

// ─── STATUS COLOR ────────────────────────────────────────────
export const scol = (s: string): string =>
  ({
    invoiced:   C.amber,
    contracted: C.muted,
    quoted:     C.light,
    revised:    "#b8a090",   // old-app rosewood
    production: "#8fa89a",   // old-app sage
    paid:       C.green,
    lead:       C.light,
  }[s] ?? C.light);

// ─── STATUS BADGE ────────────────────────────────────────────
export const StatusBadge = ({ status }: { status: string }) => {
  const col = scol(status);
  return (
    <span
      style={{
        fontSize:      TYPE.micro.size,
        fontFamily:    SANS,
        color:         col,
        border:        `1px solid ${col}`,
        padding:       "2px 8px",
        borderRadius:  2,
        letterSpacing: "0.07em",
        textTransform: "uppercase" as const,
        whiteSpace:    "nowrap" as const,
      }}
    >
      {status}
    </span>
  );
};

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
      borderRadius: 2,
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
