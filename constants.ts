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

// ─── PALETTE (Gelato Days) — one colour = one meaning, all four apps ─
//   waiting  butter     waiting · to go · unpaid · expiring · pitched · delivered
//   progress blue       in progress · signed (contracted, production) · replied · created
//   done     pistachio  done · paid · reached · posted · gifted / deal · active license
//   late     pink       late · overdue · missed · expired · follow-up overdue
//   lynnhoa  lavender   @lynnhoa          createbylynn  peach  @createbylynn
//   neutral  warm grey  not started · maybe (idea, lead, quoted, draft) · categories · who
// fill = the pastel · wash = lighter (tiles, icon circles) · mid = dots, edges, bars
// ink = text on fill / wash (the pastels are too light to read as text)
export const PAL = {
  waiting:      { fill: "#F9E1A8", wash: "#FCF0D3", mid: "#E9C46A", ink: "#7A5A12" },
  progress:     { fill: "#BCD8EC", wash: "#DEECF6", mid: "#84B3D8", ink: "#2D5878" },
  done:         { fill: "#D6E5BD", wash: "#EBF2DE", mid: "#9DBE78", ink: "#415E24" },
  late:         { fill: "#FFCBE1", wash: "#FFE5F0", mid: "#F49AC1", ink: "#9A3463" },
  lynnhoa:      { fill: "#DCCCEC", wash: "#EEE6F6", mid: "#B49ADB", ink: "#5A4291" },
  createbylynn: { fill: "#FFDAB4", wash: "#FFEDDA", mid: "#F5B27A", ink: "#8A4A1C" },
  neutral:      { fill: "#F1EEEA", wash: "#F6F4F1", mid: "#C9C2BA", ink: "#6B655E" },
} as const;
export type Tone = keyof typeof PAL;

// ─── SPACING · CORNERS · DEPTH (compact, not cramped) ────────
// 12 inside cards · 8 between cards · 14 before a section
export const SPACE  = { xs: 4, sm: 8, md: 12, sec: 14, lg: 16 } as const;
export const RADIUS = { tile: 12, card: 14, pill: 15 } as const;
export const SHADOW = { card: "0 6px 18px rgba(26,26,26,0.05)" } as const;

// ─── COLORS ──────────────────────────────────────────────────
// amber / red / green / blue = the readable text shades of the palette
// (waiting · late · done · in progress)
export const C = {
  bg:     "#faf9f7",
  black:  "#1a1a1a",
  muted:  "#888888",
  light:  "#b8b3ad",
  rule:   "#e8e4df",
  white:  "#ffffff",
  amber:  "#B38A2E",
  red:    "#C2537F",
  green:  "#6E9A4E",
  blue:   "#4F86B8",
} as const;

// ─── TINTS (backgrounds for status boxes) ────────────────────
export const TINT = {
  amber: PAL.waiting.wash,
  red:   PAL.late.wash,
  green: PAL.done.wash,
  rose:  PAL.neutral.mid,    // revised (still a quote)
  sage:  PAL.progress.mid,   // production (in progress)
} as const;

// ─── PROJECT STATUS — one colour + one name everywhere ───────
export const STATUS_COLOR: Record<string, string> = {
  lead:       C.light,
  lost:       C.light,
  quoted:     C.light,
  revised:    "#9a9188",
  contracted: C.blue,
  production: C.blue,
  invoiced:   C.amber,
  paid:       C.green,
};
// the palette tone of each project status (pastel badges, cards)
export const STATUS_TONE: Record<string, Tone> = {
  lead: "neutral", lost: "neutral", quoted: "neutral", revised: "neutral",
  contracted: "progress", production: "progress", invoiced: "waiting", paid: "done",
};
export const STATUS_NAME: Record<string, string> = {
  lead: "Lead", quoted: "Quoted", revised: "Revised", contracted: "Contracted", lost: "Lost",
  production: "Production", invoiced: "Invoiced", paid: "Paid",
};

// ─── CATEGORIES — one label + one colour everywhere ──────────
// key = quote line `cat`; the workspace uses "Influencer" / "UGC" / "Editorial"
export const CATEGORY: Record<string, { label: string; long: string; color: string; bg: string; border: string }> = {
  influencer: { label: "Brand Collab", long: "Brand Collaboration", color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
  ugc:        { label: "UGC",          long: "UGC",                 color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
  editorial:  { label: "Editorial",    long: "Editorial",           color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
  hotels:     { label: "Hotels",       long: "Hotels & Hospitality",color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
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
  field:    40,   // inputs + selects (16 px text, rounded)
  button:   36,   // standard buttons
  barBtn:   30,   // buttons in window top bars
  pill:     30,   // category / filter pills
  chip:     28,   // small toggles (platforms)
  labelTop: 10,   // space above a field label
  labelGap: 4,    // space between label and field
} as const;

// ─── LAYOUT ──────────────────────────────────────────────────
export const BREAKPOINT = 768;    // phone below, iPad from here
export const WIDE       = 1200;   // desktop from here
export const Z = { nav: 100, menu: 200, modal: 500, dialog: 600, toast: 700 } as const;

// ─── WORDS — one name per number, the same in every tab ─────
//   To invoice  agreed work not invoiced yet (contracted + production)
//   Unpaid      issued invoices not paid yet (overdue ones included)
//   Pipeline    open quotes          Paid   paid invoices (by paid date)
//   "open" alone only ever means "all open work" (Projects).
export const WORDS = {
  toInvoice: "To invoice", unpaid: "Unpaid", pipeline: "Pipeline", paid: "Paid",
  overdue: "Overdue", followUp: "Follow up",
} as const;
