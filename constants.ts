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

// ─── TINTS (backgrounds for status boxes) ────────────────────
export const TINT = {
  amber: "#fdf6ee",
  red:   "#fdf0f0",
  green: "#f0f5f0",
  rose:  "#b8a090",   // revised
  sage:  "#8fa89a",   // production
} as const;

// ─── PROJECT STATUS — one colour + one name everywhere ───────
export const STATUS_COLOR: Record<string, string> = {
  lead:       C.light,
  quoted:     C.light,
  revised:    TINT.rose,
  contracted: C.muted,
  production: TINT.sage,
  invoiced:   C.amber,
  paid:       C.green,
};
export const STATUS_NAME: Record<string, string> = {
  lead: "Lead", quoted: "Quoted", revised: "Revised", contracted: "Contracted",
  production: "Production", invoiced: "Invoiced", paid: "Paid",
};

// ─── CATEGORIES — one label + one colour everywhere ──────────
// key = quote line `cat`; the workspace uses "Influencer" / "UGC" / "Editorial"
export const CATEGORY: Record<string, { label: string; long: string; color: string; bg: string; border: string }> = {
  influencer: { label: "Brand Collab", long: "Brand Collaboration", color: "#6a6aaa", bg: "#f0f0f5", border: "#c8c8e0" },
  ugc:        { label: "UGC",          long: "UGC",                 color: C.amber,    bg: "#fdf5ee", border: "#e8d8c8" },
  editorial:  { label: "Editorial",    long: "Editorial",           color: C.green,    bg: "#f0f5f0", border: "#b8d4b8" },
  hotels:     { label: "Hotels",       long: "Hotels & Hospitality",color: C.blue,     bg: "#eef3f8", border: "#c8d6e6" },
};
const CAT_ALIAS: Record<string, string> = {
  influencer: "influencer", "brand collab": "influencer", collab: "influencer", "brand collaboration": "influencer",
  ugc: "ugc", editorial: "editorial", hotels: "hotels",
};
export const catKeyOf = (c?: string | null): string => CAT_ALIAS[String(c || "").trim().toLowerCase()] || String(c || "");
export const catInfo = (c?: string | null) =>
  CATEGORY[catKeyOf(c)] || { label: String(c || "Other"), long: String(c || "Other"), color: C.muted, bg: C.bg, border: C.rule };

// ─── EXPIRY RULE (licenses, usage rights) ────────────────────
// expired → red · within 14 days → amber · later → green
export const EXPIRY_WARN_DAYS = 14;
export const expiryColor = (daysLeft: number | null) =>
  daysLeft === null ? C.muted : daysLeft < 0 ? C.red : daysLeft <= EXPIRY_WARN_DAYS ? C.amber : C.green;
export const expiryTint = (daysLeft: number | null) =>
  daysLeft === null ? C.bg : daysLeft < 0 ? TINT.red : daysLeft <= EXPIRY_WARN_DAYS ? TINT.amber : TINT.green;

// ─── PDF PRINT COLOURS (same as Casa Castel) ─────────────────
// White pages and darker text so documents print cleanly.
export const PDF = {
  page:  "#ffffff",   // page background
  ink:   "#1a1a1a",   // body text
  label: "#4a4540",   // labels, secondary text
  faint: "#6b655e",   // header, footer, small notes
  rule:  "#c9c2b8",   // lines
} as const;

// ─── SIZES (compact density, one place for the whole app) ────
// Field text stays 16 px — iPhone zooms in on anything smaller.
export const SIZE = {
  field:    36,   // inputs + selects
  button:   36,   // standard buttons
  barBtn:   30,   // buttons in window top bars
  pill:     30,   // category / filter pills
  chip:     28,   // small toggles (platforms)
  labelTop: 10,   // space above a field label
  labelGap: 4,    // space between label and field
} as const;

// ─── LAYOUT ──────────────────────────────────────────────────
export const BREAKPOINT = 768;
export const Z = { nav: 100, menu: 200, modal: 500, dialog: 600, toast: 700 } as const;
