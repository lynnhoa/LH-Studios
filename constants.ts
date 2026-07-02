// ─────────────────────────────────────────────────────────────
// CONSTANTS — single source of truth
// Import from here everywhere. Never duplicate these values.
// ─────────────────────────────────────────────────────────────

// ─── FONTS ───────────────────────────────────────────────────
export const SERIF = "'Playfair Display', serif";
export const SANS  = "'Helvetica Neue', Arial, sans-serif";

// ─── TYPE SCALE ──────────────────────────────────────────────
export const TYPE = {
  pageTitle:       { size: 24, font: SERIF },
  sectionHeading:  { size: 16, font: SERIF },
  kpi:             { size: 28, font: SERIF },
  amount:          { size: 22, font: SERIF },
  body:            { size: 14, font: SANS  },
  subtext:         { size: 12, font: SANS  },
  label:           { size: 11, font: SANS  },
  button:          { size: 11, font: SANS  },
  micro:           { size: 10, font: SANS  },
} as const;

// ─── COLORS ──────────────────────────────────────────────────
export const C = {
  bg:     "#faf9f7",
  black:  "#1a1a1a",
  muted:  "#888888",
  light:  "#b8b3ad",
  rule:   "#e8e4df",
  white:  "#ffffff",
  amber:  "#c49a6c",
  red:    "#c47b7b",
  green:  "#7aaa7a",
  blue:   "#7a9ec4",
} as const;
