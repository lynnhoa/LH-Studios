// ─────────────────────────────────────────────────────────────
// planner — ONE place for the Planner's names, colours, week
// maths and the rules for when a task counts as done. The To-do
// tab and its windows (and later Overview, Manager and Creator)
// all read from here, so they always agree.
// ─────────────────────────────────────────────────────────────

import { ymd, parseYMD, monthStart, today, fmtD } from "./formatters";
import { C, PAL } from "./constants";

export type Account       = "lynnhoa" | "createbylynn";
export type TaskAccount   = Account | "both";
export type AccountFilter = "all" | Account;
export type Phase         = "setup" | "refine" | "maintain";
export type Owner         = "manager" | "creator" | "both";
export type Rhythm        = "once" | "daily" | "weekly" | "monthly";
export type TaskStatus    = "open" | "in_progress" | "done";
export type StageStatus   = "upcoming" | "active" | "done";

export interface Stage {
  id:          string;
  account:     Account;
  num:         number;           // 1–5
  shortName:   string;           // Setup, Sales, Business, Access, Luxury
  name:        string;           // e.g. Growth, branding and prep
  goal:        string;
  doneWhen:    string;           // extra gate notes
  status:      StageStatus;
  sprintWeeks: number | null;    // Stage 2
  startedOn:   string | null;
  doneOn:      string | null;
  moved:       string[];         // open tasks that moved on when this stage was finished (they come back on Reopen)
}

export interface Task {
  id:        string;
  account:   TaskAccount;
  stageNum:  number;
  phase:     Phase;
  owner:     Owner;
  rhythm:    Rhythm;
  area:      string;
  title:     string;
  how:       string;
  doneWhen:  string;
  measure:   string | null;      // unit of a number row (follow-backs …); empty = a tick
  source:    string;             // where the number will come from (phases 3–4)
  target:    number | null;      // fixed goal of a one-time count (first set = 9)
  link:      string;
  status:    TaskStatus;         // one-time tasks
  doneOn:    string | null;
  sort:      number;
  active:    boolean;
}

export interface Entry {
  id:          string;
  taskId:      string;
  periodStart: string;           // Monday of the week (1st of the month for monthly)
  target:      number | null;    // set in Plan week
  actual:      number | null;
  days:        boolean[];        // Mon–Sun
  done:        boolean;
  data:        any;
  note:        string;
}

export interface Snapshot {
  id:         string;
  account:    Account;
  weekStart:  string;
  followers:  number | null;
  views:      number | null;
  engagement: number | null;   // percent, e.g. 3.1
}

// Creator lists: content ideas (classic TikTok/Reels) and the editorial list (portfolio pieces)
export type ItemList   = "idea" | "editorial";
export type ItemStatus = "idea" | "planned" | "shot" | "posted" | "in_kit";
export interface Item {
  id:          string;
  account:     Account;
  list:        ItemList;
  title:       string;
  format:      string;
  status:      ItemStatus;
  plannedOn:   string | null;
  postedOn:    string | null;
  direction:   string;           // the storyline: one line per point
  plan:        ItemPlan;         // clips to shoot, reference links, list style
  portfolio:   boolean;          // counts toward the portfolio
  link:        string;
  views:       number | null;
  sort:        number;
  createdAt:   string;
  createdWeek: string;           // Monday of the week it was added
}
// What an idea / editorial is planned with (stored as one jsonb column "plan")
export interface ItemPlan {
  style: "bullets" | "numbers";              // how the storyline is shown
  clips: { t: string; done: boolean }[];     // clips to shoot (tick when shot)
  refs:  { url: string; note: string }[];    // reference links + what they show
  filmedOn?: string | null;                  // the day it was ticked "Filmed"
  arc?: string | null;                       // content concept: the arc (its id) …
  arcFormat?: string | null;                 // … and its format (by name)
  phase?: number | null;                     // content concept: the phase (its number) …
  era?: string | null;                       // … and its era (its key)
}
export const EMPTY_PLAN: ItemPlan = { style: "bullets", clips: [], refs: [] };
export function planOf(v: any): ItemPlan {
  const o = v && typeof v === "object" ? v : {};
  return {
    style: o.style === "numbers" ? "numbers" : "bullets",
    clips: Array.isArray(o.clips) ? o.clips.filter((c: any) => c && typeof c.t === "string").map((c: any) => ({ t: c.t, done: !!c.done })) : [],
    refs:  Array.isArray(o.refs) ? o.refs.filter((r: any) => r && (r.url || r.note)).map((r: any) => ({ url: String(r.url || ""), note: String(r.note || "") })) : [],
    filmedOn: typeof o.filmedOn === "string" ? o.filmedOn : null,
    arc:       typeof o.arc === "string" && o.arc ? o.arc : null,
    arcFormat: typeof o.arcFormat === "string" && o.arcFormat ? o.arcFormat : null,
    phase:     Number.isInteger(o.phase) && o.phase >= 0 ? o.phase : null,   // 0 = Base
    era:       typeof o.era === "string" && o.era ? o.era : null,
  };
}
// storyline text → points (strips "- ", "• ", "1. " the way people type them)
export const storyLines = (s: string): string[] =>
  String(s || "").split("\n").map(l => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim()).filter(Boolean);

// Stage 2: a sales sprint (one focus, a pitch goal, follow-ups, then a review)
export interface Sprint {
  id:            string;
  account:       Account;
  num:           number;
  startOn:       string;
  endOn:         string;
  focusCategory: string;    // Outreach category key, "" = any
  focusTier:     string;   // an Outreach tier key, "" = any tier
  pitchGoal:     number | null;
  followUpGoal:  number | null;
  review:        string;
  status:        "active" | "done";
  days:          Record<string, { p?: number | null; f?: number | null }>;   // per day: pitches, follow-ups (typed)
  results:       SprintResults;                                             // typed in the review
}
export interface SprintResults { replied?: number | null; gifted?: number | null; deals?: number | null; worked?: string; change?: string; }
// what a sprint brought: the typed day numbers and the typed results
export interface SprintStats { pitches: number; followUps: number; contacted: number; replied: number; gifted: number; deals: number; rate: number | null; }

export type NoteKind = "concept" | "offer" | "learning";
export interface Note {
  id:          string;
  account:     Account;
  kind:        NoteKind;
  periodStart: string | null;    // week of a learning
  title:       string;           // learning: top post
  body:        string;
  link:        string;
}

// ── Accounts (chip colours match Outreach: Fashion / Beauty) ──
export interface Look { label: string; color: string; bg: string; border: string; }
export const ACCOUNTS: (Look & { key: Account })[] = [
  { key: "lynnhoa",      label: "@lynnhoa",      color: PAL.lynnhoa.ink,      bg: PAL.lynnhoa.wash,      border: PAL.lynnhoa.fill },
  { key: "createbylynn", label: "@createbylynn", color: PAL.createbylynn.ink, bg: PAL.createbylynn.wash, border: PAL.createbylynn.fill },
];
export const BOTH_LOOK: Look = { label: "Both", color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" };
export const accLook = (k: TaskAccount): Look => ACCOUNTS.find(a => a.key === k) || BOTH_LOOK;

export const PHASES: { key: Phase; label: string; section: string }[] = [
  { key: "maintain", label: "Maintain", section: "Maintain · this week" },
  { key: "refine",   label: "Refine",   section: "Refine · until settled" },
  { key: "setup",    label: "Setup",    section: "Setup · once" },
];
export const OWNERS: { key: Owner; label: string }[] = [
  { key: "manager", label: "Manager" },
  { key: "creator", label: "Creator" },
  { key: "both",    label: "Both" },
];
// Who does it, by colour: manager blue-grey · creator mauve · both warm grey
// (account colours stay lavender for @lynnhoa and peach for @createbylynn)
export const OWNER_LOOK: Record<Owner, Look> = {
  // who does it isn't a status: no colour of its own (the word says it)
  manager: { label: "Manager", color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
  creator: { label: "Creator", color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
  both:    { label: "Both",    color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" },
};
export const RHYTHMS: { key: Rhythm; label: string }[] = [
  { key: "once",    label: "Once" },
  { key: "daily",   label: "Daily" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];
export const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "open",        label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "done",        label: "Done" },
];
export const STAGE_SHORT = ["Setup", "Sales", "Business", "Access", "Luxury"];

export const ITEM_STATUSES: { key: ItemStatus; label: string }[] = [
  { key: "idea",    label: "Idea" },
  { key: "planned", label: "To shoot" },
  { key: "shot",    label: "To post" },              // filmed, not posted yet
  { key: "posted",  label: "Posted" },
  { key: "in_kit",  label: "In kit" },
];
export const itemStatusLabel = (k: ItemStatus) => ITEM_STATUSES.find(x => x.key === k)?.label || k;
// ── Creator lists: Idea → To shoot → To post (filmed) → Posted ─────────────
// One status per idea; the list it sits in and the ticks in its window both read it.
export type ItemStage = "idea" | "planned" | "shot" | "posted";
export const isPostedStatus = (s: ItemStatus) => s === "posted" || s === "in_kit";
export const isFilmedStatus = (s: ItemStatus) => s === "shot" || isPostedStatus(s);
// an older idea that only got a date (Plan › before) is on the shoot list too
export const itemStageOf = (it: Item): ItemStage =>
  isPostedStatus(it.status) ? "posted" : it.status === "shot" ? "shot" : it.status === "planned" || !!it.plannedOn ? "planned" : "idea";
export const ITEM_STAGE_LABEL: Record<ItemStage, string> = { idea: "Idea", planned: "To shoot", shot: "To post", posted: "Posted" };

// ── Types: one per idea; everything except Content counts for the portfolio ──
export const CONTENT = "Content";
export const BRAND_POST = "Brand post";
export const TYPES: Record<Account, string[]> = {
  lynnhoa:      [CONTENT, "Fashion editorial", BRAND_POST],
  createbylynn: [CONTENT, "Product video", "Problem → solution", "Beauty editorial", BRAND_POST],
};
const OLD_BRAND = ["Branded content", "Brand content"];          // earlier names, shown as Brand post
export const typeOf = (it: Item): string =>
  it.list !== "editorial" ? CONTENT : OLD_BRAND.includes(it.format) ? BRAND_POST : (it.format || TYPES[it.account]?.[1] || BRAND_POST);
export const typePatch = (acc: Account, type: string): Partial<Item> =>
  type === CONTENT ? { list: "idea", format: CLASSIC, portfolio: false } : { list: "editorial", format: type, portfolio: true };

// ── Content concept (profile menu › @… concept): one row per arc ─────────────
// Arcs, purpose, formats and their platform ticks come from the SQL (fixed);
// the texts and links of each arc are written in the app.
// @createbylynn: one row per SERIES instead — its category (Hair · Makeup & skincare ·
// Both) and its arc (Look · Product · Personality · Editorial) say where it sits;
// num is the order over the whole account (unique), the page numbers each arc 1, 2, 3 …
export interface ConceptFormat { name: string; main: boolean; tt: boolean; ig: boolean; }
export interface ConceptLink   { url: string; note: string; }
export type ConceptCategory = "hair" | "makeup" | "both";
export type ConceptArcKey   = "look" | "product" | "personality" | "editorial";
export interface ConceptArc {
  id:       string;
  account:  Account;
  num:      number;            // 1, 2, 3 … top to bottom
  name:     string;
  purpose:  string;
  formats:  ConceptFormat[];   // in order; main = the arc's main format(s)
  texts:    string[];          // example lines (a series of the Look arc: its labels)
  links:    ConceptLink[];     // reference posts: link + what it shows
  category: ConceptCategory | null;   // a series only (@createbylynn, before the pillars)
  arc:      ConceptArcKey | null;     // a series only: the arc it belongs to
  pillar:   ConceptPillarKey | null;  // @createbylynn: the pillar this arc sits in (empty on @lynnhoa)
}
// @createbylynn (27.10.2026): 5 PILLARS (fixed here, numbered 1–5), each holding its ARCS (rows of
// planner_concept_arcs with a pillar, in num order), each arc its FORMATS. An arc's texts and links
// are written in the app, like @lynnhoa's.
export type ConceptPillarKey = "makeup_looks" | "hair_styles" | "products" | "personality" | "editorial";
export const CONCEPT_PILLARS: { key: ConceptPillarKey; label: string; note: string }[] = [
  { key: "makeup_looks", label: "Make up looks", note: "" },
  { key: "hair_styles",  label: "Hair styles",   note: "" },
  { key: "products",     label: "Products",      note: "journey: pick 2–4 arcs · order stays · one product at a time, 2–3 weeks" },
  { key: "personality",  label: "Personality",   note: "a line on a look or product clip · one picture + one voice" },
  { key: "editorial",    label: "Editorial",     note: "" },
];
export const PILLAR_KEYS: string[] = CONCEPT_PILLARS.map(p => p.key);
export const isPillarArc = (a: ConceptArc) => !!a.pillar;
export const pillarLabel = (k: ConceptPillarKey | null) => CONCEPT_PILLARS.find(p => p.key === k)?.label || "";
// the arcs of one pillar, in order
export const arcsOfPillar = (list: ConceptArc[], k: ConceptPillarKey) =>
  list.filter(a => a.pillar === k).sort((a, b) => a.num - b.num);
// an arc's name where it's picked or shown outside the page: a name used in two pillars gets its
// pillar ("Opinion (products)" · "Opinion (personality)")
export const pillarArcName = (list: ConceptArc[], a: ConceptArc) =>
  isPillarArc(a) && list.filter(x => x.account === a.account && isPillarArc(x) && x.name === a.name).length > 1
    ? `${a.name} (${pillarLabel(a.pillar).toLowerCase()})` : a.name;
// @createbylynn's concept: the three categories (the switch) and the four arcs (the sections)
export const CONCEPT_CATEGORIES: { key: ConceptCategory; label: string }[] = [
  { key: "hair", label: "Hair" }, { key: "makeup", label: "Makeup & skincare" }, { key: "both", label: "Both" },
];
export const CONCEPT_ARCS: { key: ConceptArcKey; label: string }[] = [
  { key: "look", label: "Look" }, { key: "product", label: "Product" }, { key: "personality", label: "Personality" }, { key: "editorial", label: "Editorial" },
];
export const isSeries = (a: ConceptArc) => !!a.category && !!a.arc;
// a series of the Look arc has labels (the title on the video), every other one texts
export const seriesWord = (a: ConceptArc): "labels" | "texts" => (a.arc === "look" ? "labels" : "texts");
// "Hair · Look" — where a series sits
export const seriesPlace = (a: ConceptArc) =>
  `${CONCEPT_CATEGORIES.find(c => c.key === a.category)?.label || ""} · ${CONCEPT_ARCS.find(x => x.key === a.arc)?.label || ""}`;
// the series of one category and arc, in order (the page numbers them 1, 2, 3 …)
export const seriesOf = (list: ConceptArc[], cat: ConceptCategory, arc: ConceptArcKey) =>
  list.filter(a => a.category === cat && a.arc === arc).sort((a, b) => a.num - b.num);
// a series' name where it's picked or shown outside the page: names used in two categories get
// theirs ("Techniques (hair)" · "Techniques (makeup)")
export const seriesName = (list: ConceptArc[], a: ConceptArc) =>
  isSeries(a) && list.filter(x => x.account === a.account && isSeries(x) && x.name === a.name).length > 1 ? `${a.name} (${a.category})` : a.name;
// a series' number on the page: its place within its category and arc
export const seriesNum = (list: ConceptArc[], a: ConceptArc) =>
  isSeries(a) ? seriesOf(list.filter(x => x.account === a.account), a.category!, a.arc!).findIndex(x => x.id === a.id) + 1 : a.num;
// Phases (fixed by the SQL): where you are in life (Home, Occasion, Invited …). Each phase has
// its recurring eras; each era names its core arcs by number, in posting order. An era's arcs
// ARE the arcs above (same purpose, formats, texts and links): nothing is copied.
export interface ConceptEraArc { num: number; optional: boolean; note: string; }
// a block's lines (Base), in sections ("Rituals" …; one unnamed section when there are none).
// A line is "label · how it shows": the label black, the rest grey.
export interface ConceptBlockSection { name: string; lines: string[]; }
// grp: the group an era sits in ("Moments", "Eras: on you" …), shown as a heading in the phase
// card (a phase without groups: "Eras")
// sections: a Base block's lines (empty for eras)
export interface ConceptEra    { key: string; name: string; desc: string; arcs: ConceptEraArc[]; grp: string | null; sections: ConceptBlockSection[]; }
export const blockLineCount = (e: ConceptEra) => e.sections.reduce((n, s) => n + s.lines.length, 0);
// "Perfume before leaving · how it shows" → ["Perfume before leaving", "how it shows"]
export const splitBlockLine = (t: string): [string, string] => {
  const i = t.indexOf(" · ");
  return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : [t, ""];
};
// unit: what the phase's list holds — eras (the usual) or, for Base, its blocks (the Base tab; number 0)
export type ConceptUnit = "eras" | "base";
export interface ConceptPhase {
  id:      string;
  account: Account;
  num:     number;            // 1, 2, 3 … top to bottom
  name:    string;
  purpose: string;
  eras:    ConceptEra[];      // in order
  unit:    ConceptUnit;
}
export const isBasePhase = (p: ConceptPhase | undefined | null) => !!p && p.unit === "base";
// how a phase is named in pickers and lists: Base (number 0, never shown) or "1. Home" / "1 · Home"
export const conceptPhaseLabel = (p: ConceptPhase) => (isBasePhase(p) ? "Base" : `${p.num}. ${p.name}`);
export const conceptPhaseShort = (p: ConceptPhase) => (isBasePhase(p) ? "Base" : `${p.num} · ${p.name}`);
// a phase number is set (0 = Base counts)
export const hasPhase = (n: number | null | undefined): n is number => typeof n === "number" && n >= 0;
// the words for a phase's list: "Eras · 3" (a phase without groups) / "Base · 7", "Pick an era" / "Pick a block"
export const phaseListWord = (p: ConceptPhase | undefined | null) => (isBasePhase(p) ? "Base" : "Eras");
export const phaseItemWord = (p: ConceptPhase | undefined | null) => (isBasePhase(p) ? "block" : "era");
// the eras of a phase with their group headings, in order: [{ grp, eras }]
export const eraGroups = (p: ConceptPhase): { grp: string | null; eras: ConceptEra[] }[] => {
  const out: { grp: string | null; eras: ConceptEra[] }[] = [];
  p.eras.forEach(e => { const g = out[out.length - 1]; if (g && g.grp === e.grp) g.eras.push(e); else out.push({ grp: e.grp, eras: [e] }); });
  return out;
};
// Creator › Now: the phase and era you're in, per account (synced between devices)
export interface ConceptNow { phase: number | null; era: string | null; }
// the concept page's colours: arcs pastel blue, phases butter (lavender stays the account's),
// Base warm grey — the palette's colour for categories (green stays TikTok's)
export const ARC_TONE   = PAL.progress;
export const PHASE_TONE = PAL.waiting;
export const BASE_TONE  = PAL.neutral;   // the Base tab (warm grey)
// the two platforms on the concept page (ticks and link pills): TikTok pistachio, Instagram pink
type PlatformTone = { fill: string; wash: string; mid: string; ink: string };
export const PLATFORM_TONE: Record<"TikTok" | "Instagram", PlatformTone> = { TikTok: PAL.done, Instagram: PAL.late };
export const platformTone = (platform: string): PlatformTone | null =>
  platform === "TikTok" || platform === "Instagram" ? PLATFORM_TONE[platform] : null;

// ── Reference links: the platform and a short line (handle or path) ─────────
const LINK_PLATFORMS: [RegExp, string][] = [
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)instagram\.com$|^instagr\.am$/, "Instagram"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)pinterest\.[a-z.]+$|^pin\.it$/, "Pinterest"],
];
export function linkInfo(raw: string): { platform: string; short: string; href: string } {
  const s = String(raw || "").trim();
  if (!s) return { platform: "Link", short: "", href: "" };
  const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  let host = "", seg: string[] = [];
  try {
    const u = new URL(href);
    host = u.hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, "");
    seg = u.pathname.split("/").filter(Boolean);
  } catch { return { platform: "Link", short: s, href: "" }; }          // not a link (a note): nothing to open
  if (!host.includes(".")) return { platform: "Link", short: s, href: "" };
  const platform = (LINK_PLATFORMS.find(([re]) => re.test(host)) || [null, "Link"])[1] as string;
  const at = seg.find(x => x.startsWith("@"));
  let short = host;
  if (at) short = `${at} · ${host}`;
  else if (platform === "Instagram" && seg[0]) short = ["p", "reel", "reels", "tv", "stories", "explore"].includes(seg[0]) ? `${host}/${seg[0]}` : `@${seg[0]} · ${host}`;
  return { platform, short, href };
}
// Looks like a link (pasted into + Add or the links field)
export const isUrlLike = (raw: string) => {
  const s = String(raw || "").trim();
  return !/\s/.test(s) && (/^(https?:\/\/|www\.)\S+\.\S+/i.test(s) || /^([a-z0-9-]+\.)*(tiktok\.com|instagram\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|pin\.it)(\/|$)/i.test(s));
};

// Formats per account (portfolio pieces) + classic content
export const CLASSIC = "TikTok/Reels";
export const FORMATS: Record<Account, string[]> = {
  lynnhoa:      ["Fashion editorial", "Brand post"],
  createbylynn: ["Product video", "Problem → solution", "Beauty editorial", "Brand post"],
};
const FORMAT_LOOK: Record<string, Look> = {};   // formats are categories: neutral, the word says it
export const formatLook = (f: string): Look => FORMAT_LOOK[f] || { label: f || CLASSIC, color: PAL.neutral.ink, bg: PAL.neutral.fill, border: "#e2ddd6" };

// Order in a list: shot → planned (soonest first) → ideas → posted → in the kit (newest first)
const RANK: Record<ItemStatus, number> = { shot: 0, planned: 1, idea: 2, posted: 3, in_kit: 4 };
export const itemOrder = (a: Item, b: Item): number => {
  const r = RANK[a.status] - RANK[b.status];
  if (r) return r;
  if (a.status === "posted" || a.status === "in_kit") return String(b.postedOn || "").localeCompare(String(a.postedOn || "")) || b.createdAt.localeCompare(a.createdAt);
  if (a.plannedOn || b.plannedOn) return !a.plannedOn ? 1 : !b.plannedOn ? -1 : a.plannedOn.localeCompare(b.plannedOn);
  return b.createdAt.localeCompare(a.createdAt);
};

export const phaseLabel  = (p: Phase)  => PHASES.find(x => x.key === p)?.label || p;
export const ownerLabel  = (o: Owner)  => OWNERS.find(x => x.key === o)?.label || o;
export const rhythmLabel = (r: Rhythm) => RHYTHMS.find(x => x.key === r)?.label || r;

// ── Week maths (local dates, weeks start on Monday) ───────────
export const addDays = (d: string, n: number): string => {
  const dt = parseYMD(d) || new Date();
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
};
export const mondayOf = (d: string): string => {
  const dt = parseYMD(d) || new Date();
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return ymd(dt);
};
export const thisMonday = (): string => mondayOf(today());

// ISO week number (the week with the year's first Thursday is week 1)
export const isoWeek = (d: string): number => {
  const dt = parseYMD(d) || new Date();
  const thu = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  return 1 + Math.round(((thu.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
};

const dayMonth = (d: string) => fmtD(d).slice(0, 6);                                  // "12.10."
export const weekLabel = (monday: string) => `Week ${isoWeek(monday)}`;
export const weekRange = (monday: string) => `${dayMonth(monday)}–${fmtD(addDays(monday, 6))}`;   // 12.10.–18.10.2026
export const monthName = (d: string) => (parseYMD(d) || new Date()).toLocaleString("en-GB", { month: "long" });
// a week's month: the current week follows today (1 Nov already counts for November), other weeks their Monday
export const monthOfWeek = (monday: string) => monthStart(monday === mondayOf(today()) ? today() : monday);
export const periodOf  = (t: Task, monday: string) => (t.rhythm === "monthly" ? monthOfWeek(monday) : monday);
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// 0–6 when today lies in this week, otherwise -1
export const todayIndex = (monday: string): number => {
  const a = parseYMD(monday), b = parseYMD(today());
  if (!a || !b) return -1;
  const i = Math.round((b.getTime() - a.getTime()) / 864e5);
  return i >= 0 && i < 7 ? i : -1;
};

// ── Stages ────────────────────────────────────────────────────
// This month's portfolio goal: on the account's own monthly task it's the entry's target;
// on a shared ("both") monthly task it was kept per account in data.goals
export const monthGoalOf = (t: Task | undefined, e: Entry | undefined, acc: Account): number | null =>
  !t || !e ? null : t.account === "both" ? (e.data?.goals?.[acc] ?? null) : (e.target ?? null);
export const monthGoalPatch = (t: Task, e: Entry | undefined, acc: Account, v: number | null) =>
  t.account === "both" ? { data: { ...(e?.data || {}), goals: { ...(e?.data?.goals || {}), [acc]: v } } } : { target: v };

// ── Goal status: one short word, the same everywhere ─────────
// Reached ✓ (green) · "2 to go" (amber, week still running) ·
// Not reached (muted red, week over) · No number (grey, no target)
export type Tone = "ok" | "attn" | "miss" | "none";
export const TONE: Record<Tone, string> = { ok: C.green, attn: C.amber, miss: C.red, none: C.light };
export interface GoalStatus { text: string; tone: Tone; }
export function goalStatus(t: Task, st: RowState, monday: string): GoalStatus | null {
  const kind = rowKind(t);
  const over = periodOf(t, monday) < periodOf(t, thisMonday());     // this week / month is over
  const a = st.actual ?? 0;
  if (t.source === "snapshot")    return st.done ? { text: "Entered ✓", tone: "ok" } : over ? { text: "Not entered", tone: "miss" } : { text: "Enter", tone: "attn" };
  if (t.source === "kit_waiting") return st.done ? { text: "Done ✓", tone: "ok" } : { text: `${a} waiting`, tone: over ? "miss" : "attn" };
  if (kind === "days")            return st.done ? { text: "Reached ✓", tone: "ok" } : over ? { text: "Not reached", tone: "miss" } : { text: `${7 - st.daysDone} to go`, tone: "attn" };
  if (kind === "number" || t.source === "portfolio_total") {
    if (st.done) return { text: "Reached ✓", tone: "ok" };
    if (st.target == null) return { text: "No number", tone: "none" };
    if (over && t.rhythm !== "once") return { text: "Not reached", tone: "miss" };
    return { text: `${Math.max(0, st.target - a)} to go`, tone: "attn" };
  }
  if (st.done) return { text: "Done ✓", tone: "ok" };
  if (over && t.rhythm !== "once") return { text: "Not done", tone: "miss" };
  return null;
}
// ── Which weekly goals live on which card ───────────────────
// Manager card: engaging, following, followers, new emails, pitches, leads.
// Creator strip: ideas, filmed, posts (+ month goal, first set). Pieces isn't shown any more
// (the month goal counts the portfolio pieces).
// Everything else that repeats (check-in, kit handover, your own
// tasks) stays in To-do. The snapshot task is no longer used — the
// followers number is still typed into the weekly snapshot row.
export const MANAGER_GOAL = (t: Task) => t.phase === "maintain" && (
  t.source === "following" || t.source === "followers" || t.source === "outreach" || t.source === "pitches" || t.source === "leads" || (t.area === "community" && t.rhythm === "daily"));
export const CREATOR_GOAL = (t: Task) => t.phase === "maintain" && (t.source === "ideas" || t.source === "filmed" || t.source === "posts");
export const creatorOrder = (t: Task) => (t.source === "ideas" ? 0 : t.source === "filmed" ? 1 : t.source === "posts" ? 2 : 3);
export const ON_A_CARD = (t: Task) => MANAGER_GOAL(t) || CREATOR_GOAL(t) || t.source === "snapshot" || t.source === "portfolio_total"
  || (t.rhythm === "monthly" && t.area === "portfolio");
// order on the Manager card
export const managerOrder = (t: Task) => (t.area === "community" ? 0 : t.source === "following" ? 1 : t.source === "followers" ? 2 : t.source === "outreach" ? 3 : t.source === "pitches" ? 4 : 5);
// Rows whose Done is a total read off the profile (following 374, followers 84.827),
// not a count of this week: without a typed number they show "Not entered", and
// their progress is counted from last week's number
export const TOTAL_SOURCES = new Set(["following", "followers"]);
export const isTotal = (t: Task) => TOTAL_SOURCES.has(t.source);

// Short names for status lines (Dashboard, Manager)
export const shortName = (t: Task): string =>
  t.source === "snapshot" ? "Snapshot" : t.source === "outreach" ? "New emails" : t.source === "ideas" ? "Ideas" : t.source === "posts" ? "Posts"
  : t.source === "pieces" ? "Pieces" : t.source === "filmed" ? "Filmed" : t.source === "kit_waiting" ? "Kits" : t.source === "following" ? "Following" : t.source === "followers" ? "Followers" : t.source === "pitches" ? "Pitches" : t.source === "leads" ? "Leads"
  : t.area === "community" ? "Engaging" : t.area === "checkin" ? "Check-in" : t.title;

// The account you're working on: chosen in the profile menu, remembered on this device
const WORK_KEY = "lh_work_account";
export const loadWorkAccount = (): Account => { try { return localStorage.getItem(WORK_KEY) === "createbylynn" ? "createbylynn" : "lynnhoa"; } catch { return "lynnhoa"; } };
export const saveWorkAccount = (a: Account) => { try { localStorage.setItem(WORK_KEY, a); } catch { /* ignore */ } };

export const accountsOf = (f: AccountFilter): Account[] => (f === "all" ? ["lynnhoa", "createbylynn"] : [f]);
export const taskAccounts = (t: { account: TaskAccount }): Account[] => (t.account === "both" ? ["lynnhoa", "createbylynn"] : [t.account]);

// The stage an account is in now (the active one; else the first not done; else the last)
export const stageOf = (stages: Stage[], acc: Account): Stage | undefined => {
  const mine = stages.filter(s => s.account === acc).sort((a, b) => a.num - b.num);
  return mine.find(s => s.status === "active") || mine.find(s => s.status !== "done") || mine[mine.length - 1];
};
export const stageNumOf = (stages: Stage[], acc: Account): number => stageOf(stages, acc)?.num ?? 1;

// Gate: the setup and refine tasks of this stage for this account (shared tasks count for both)
export function gateOf(stage: Stage, tasks: Task[], doneOf: (t: Task) => boolean = (t) => t.status === "done") {
  const items = tasks
    .filter(t => t.active && t.stageNum === stage.num && t.phase !== "maintain" && (t.account === stage.account || t.account === "both"))
    .sort((a, b) => (a.phase === b.phase ? a.sort - b.sort : a.phase === "setup" ? -1 : 1));
  const done = items.filter(doneOf).length;
  return { items, done, total: items.length, ready: done === items.length };
}

// ── Which tasks show in To-do ─────────────────────────────────
// Maintain tasks run from their stage on (they keep running later);
// setup and refine tasks show while their stage is the current one.
export function isVisible(t: Task, stages: Stage[], f: AccountFilter): boolean {
  if (!t.active) return false;
  const accs = taskAccounts(t).filter(a => accountsOf(f).includes(a));
  return accs.some(a => {
    const cur = stageNumOf(stages, a);
    return t.phase === "maintain" ? t.stageNum <= cur : t.stageNum === cur;
  });
}

// ── When does a row count as done? ────────────────────────────
// check  → tap the box (one-time tasks, check-in, monthly goal …)
// days   → a tick per day; done when all 7 are ticked
// number → done when this week's number reaches the target
// auto   → filled in elsewhere (account snapshot); the box ticks itself
export type RowKind = "check" | "days" | "number" | "auto";
export const AUTO_DONE  = new Set(["snapshot", "kit_waiting", "portfolio_total"]);  // the box ticks itself
export const AUTO_COUNT = new Set(["outreach", "ideas", "posts", "pieces", "filmed"]); // the number is counted, not typed (pitches are typed)
export const rowKind = (t: Task): RowKind =>
  AUTO_DONE.has(t.source) ? "auto" : t.rhythm === "once" ? "check" : t.measure ? "number" : t.rhythm === "daily" ? "days" : "check";

export const NO_DAYS = [false, false, false, false, false, false, false];

export interface RowState { done: boolean; actual: number | null; target: number | null; days: boolean[]; daysDone: number; }
// auto: what other parts of the app fill in (a counted number, or "the data is there")
export interface Auto { actual?: number | null; target?: number | null; done?: boolean; }
export function rowState(t: Task, e: Entry | undefined, auto?: Auto): RowState {
  const days = e?.days?.length === 7 ? e.days : NO_DAYS;
  const daysDone = days.filter(Boolean).length;
  const actual = auto && auto.actual !== undefined ? auto.actual : e?.actual ?? null;
  const target = auto && auto.target !== undefined ? auto.target : e?.target ?? null;
  const kind = rowKind(t);
  const done =
    kind === "auto"   ? !!auto?.done :
    kind === "days"   ? daysDone === 7 :
    kind === "number" ? target != null && actual != null && actual >= target :
    t.rhythm === "once" ? t.status === "done" : !!e?.done;
  return { done, actual, target, days, daysDone };
}

export const entryKey = (taskId: string, period: string) => `${taskId}|${period}`;
// days between two yyyy-mm-dd dates (b − a)
export const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
export const snapKey  = (acc: Account, week: string) => `${acc}|${week}`;

// German formats: 86.214 · 3,10 %
export const fmtInt = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("de-DE"));
export const fmtPct2 = (n: number | null | undefined) => (n == null ? "–" : `${Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`);
// "3,1" or "3.1" → 3.1
export const parseDec = (v: string): number | null => {
  const t = String(v || "").trim().replace(/\s|%/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
export const parseIntDe = (v: string): number | null => {
  const t = String(v || "").replace(/[^\d]/g, "");
  return t ? parseInt(t, 10) : null;
};
export const byOrder = (a: Task, b: Task) => a.sort - b.sort;

// ─── @lynnhoa MASTER CONTENT STRUCTURE (06.11.2026) ──────────
// LYNNHOA = Fashion Personality. The layers (full text: LYNNHOA-CONTENT-STRUCTURE.md):
//   Personal Eras (the image you're developing) · Main Areas → Phases (what's happening) ·
//   Signature Series → Chapters → Content Packages, Standalone Packages (the stories) ·
//   Arcs → Posts · Base Posts (in between) · Context, Format, Setup (production layers).
// The concept page shows Personal Eras and one tab per Main Area — each area holds its
// CHAPTERS, each chapter its selected ARCS, each arc its matching FORMATS. Placeholders until
// they're filled (no SQL yet; Home's chapters are filled here, 06.11.2026).
// a chapter's selected arc: the arc (by its name, as on the Arcs tab), what it does in this chapter
// and the formats used for it here, in order
export interface ChapterArc { arc: string; note: string; formats: string[]; }
export interface StructItem { name: string; desc: string; arcs?: ChapterArc[]; }

// ── Guide (06.11.2026): what you stand for and how it works ──────────────────
// The signature series "How I …" lives in The Edit: hook (why I started) → curation → result.
// Its episode per chapter, by "<tab>:<chapter>":
export interface SeriesEpisode { area: string; title: string; hook: string; }
export const HOW_I: Record<string, SeriesEpisode> = {
  "home:Maintenance":        { area: "Maintenance",   title: "How I stay ready for anything",      hook: "I'm high maintenance so I can be low maintenance" },
  "home:Home Projects":      { area: "Home Projects", title: "How I set up my bathroom",           hook: "My bathroom made my mornings complicated" },
  "home:Wardrobe & Style":   { area: "Wardrobe",      title: "How I edit my wardrobe",             hook: "I had no space for new clothes" },
  "home:Beauty Projects":    { area: "Beauty",        title: "How I build my matching makeup sets", hook: "My drawer was messy and random, I had no favourites, and I stopped enjoying makeup" },
  "home:Kits & Preparation": { area: "Kits",          title: "How I build my travel kit",          hook: "I used to pack at 4 AM" },
};
export const HOW_I_STEPS = ["Hook: why I started", "Curation", "Result"];
// The content package "The Outing" runs across arcs: Before → Look → Moment → Story (optional).
// One outfit, one day out, every post stands alone. The chapters it runs in, by "<tab>:<chapter>":
export const OUTING_IN = ["home:Occasion", "travel:City Break", "travel:Long Trip", "travel:Occasion", "work:Invited", "work:Fashion Week", "base:Shoot Day"];
export const OUTING_RUNS = ["Occasion", "City Break", "Long Trip", "Invited", "Fashion Week", "Shoot Day"];
export const OUTING_ARCS = ["The Before", "The Look", "The Moment"];
export const OUTING_OPTIONAL = ["The Story"];
// Who I am
export const WHO_I_AM = {
  title: "The art of being put together",
  line: "I've thought of everything, so I don't have to think when the moment comes",
  personality: "particular, slightly chaotic, overthinks details, intentional",
  rule: "show the curation, not the chores",
};
export interface MainArea { key: "home" | "travel" | "work"; label: string; title: string; chapters: StructItem[]; }

export const PERSONAL_ERAS: StructItem[] = [
  { name: "Beauty Era", desc: "Refining your beauty identity: hair, nails, lashes, makeup and skincare", arcs: [
    { arc: "The Obsession", note: "The change you can't stop thinking about, then loving it", formats: ["Presence + Text", "Lip Sync Song", "Selfie Reaction + Result"] },
    { arc: "The Edit",      note: "What you're changing and the real reason why", formats: ["Seated Talking", "Half-Body Talking"] },
    { arc: "The Story",     note: "The change as it happens", formats: ["Vlog", "Selfie Reaction + Result"] },
    { arc: "The Look",      note: "The reveal of the new beauty look", formats: ["Transition"] },
    { arc: "The Opinion",   note: "Your verdict on the change and the products", formats: ["Presence + Text", "Question + Reply/Reaction"] },
  ] },
  { name: "Style Era", desc: "Refining your personal style: wardrobe, silhouettes, styling and aesthetic", arcs: [
    { arc: "The Obsession",   note: "The new silhouette or aesthetic you keep wanting", formats: ["Presence + Text", "Lip Sync Song", "Voiceover"] },
    { arc: "The Edit",        note: "What stays, what goes, what comes in, and why", formats: ["Seated Talking", "Half-Body Talking"] },
    { arc: "The Look",        note: "The new style worn and styled", formats: ["Outfit Check", "Walk + Text"] },
    { arc: "The Opinion",     note: "Your style rules and honest takes", formats: ["Presence + Text", "Question + Reply/Reaction"] },
    { arc: "The Personality", note: "“Nothing to wear” in a full closet", formats: ["Lip Sync Talk", "Skits"] },
  ] },
  { name: "Signature Era", desc: "Your recognisable everyday look: signature pieces, uniform and combinations", arcs: [
    { arc: "The Look",      note: "Your everyday look and recurring combinations", formats: ["Outfit Check", "Walk + Text"] },
    { arc: "The Edit",      note: "Why this is your uniform and what makes it yours", formats: ["Seated Talking", "Half-Body Talking"] },
    { arc: "The Moment",    note: "Your signature pieces in daily life", formats: ["Walk + Text", "Presence + Text"] },
    { arc: "The Obsession", note: "The piece you never take off", formats: ["Presence + Text", "Voiceover"] },
  ] },
];

// Base (06.11.2026): quick personality posts that fill the gaps between chapters — its 6 blocks,
// each with its arcs and formats. The lines you write per block stay in the data (planner_concept_phases,
// the Base phase), found by the block's name.
export const BASE_NOTE = "Quick personality posts that fill the gaps between chapters";
export const BASE_BLOCKS: StructItem[] = [
  { name: "Signatures", desc: "Your matcha, your scent, sunglasses on your head and your little rules: what makes you you every day", arcs: [
    { arc: "The Moment", note: "Your matcha ritual, your walks, perfume before leaving", formats: ["Walk + Text", "Presence + Text", "Lip Sync Song"] },
    { arc: "The Personality", note: "The habits people recognise you by", formats: ["Lip Sync Talk", "Skits", "Selfie Reaction", "Presence + Text"] },
    { arc: "The Opinion", note: "Your rules, like how you wear things and what you'd never do", formats: ["Presence + Text", "Question + Reply/Reaction", "Walk + Text"] },
    { arc: "The Obsession", note: "Your signature scent and the pieces you're never without", formats: ["Presence + Text", "Lip Sync Song", "Voiceover"] },
  ] },
  { name: "Today's Outfit", desc: "Dressed nicely for an ordinary day, no occasion needed", arcs: [
    { arc: "The Look", note: "Today's outfit in your usual spot", formats: ["Outfit Check", "Walk + Text", "Transition"] },
    { arc: "The Moment", note: "The outfit out in your day, coffee in hand", formats: ["Walk + Text", "Lip Sync Song", "Selfie Reaction", "Presence + Text"] },
    { arc: "The Personality", note: "Your dry humor about getting dressed with nowhere to go", formats: ["Lip Sync Talk", "Skits", "Presence + Text"] },
  ] },
  { name: "New In", desc: "The one new piece or product that made it in, because you choose carefully", arcs: [
    { arc: "The Obsession", note: "The new thing you can't stop wearing or using", formats: ["Presence + Text", "Lip Sync Song", "Voiceover", "Selfie Reaction + Result"] },
    { arc: "The Look", note: "The new piece worn for the first time", formats: ["Outfit Check", "Walk + Text"] },
    { arc: "The Opinion", note: "Your first impression: worth it or not", formats: ["Presence + Text", "Question + Reply/Reaction", "Walk + Text"] },
    { arc: "The Personality", note: "Your honest reaction to it", formats: ["Lip Sync Talk", "Selfie Reaction", "Presence + Text"] },
  ] },
  { name: "Thoughts", desc: "What's on your mind: your takes on style, beauty and making an ordinary life feel lovely", arcs: [
    { arc: "The Opinion", note: "Your point of view, said plainly", formats: ["Presence + Text", "Question + Reply/Reaction", "Walk + Text", "Lip Sync Talk"] },
    { arc: "The Personality", note: "Thoughts that show your dry humor", formats: ["Lip Sync Talk", "Presence + Text"] },
    { arc: "The Obsession", note: "What you're dreaming about right now", formats: ["Presence + Text", "Lip Sync Song", "Voiceover", "Question + Reply/Reaction"] },
  ] },
  { name: "Trends", desc: "Trending sounds and formats, done your calm, dry way", arcs: [
    { arc: "The Moment", note: "The trend in your own setting and outfit", formats: ["TikTok Trends", "Lip Sync Song", "Selfie Reaction", "Presence + Text"] },
    { arc: "The Personality", note: "The trend played straight, with your humor", formats: ["Lip Sync Talk", "Skits", "Selfie Reaction"] },
  ] },
  { name: "Shoot Day", desc: "Behind the scenes of your own editorial shoots", arcs: [
    { arc: "The Before", note: "Getting ready for the shoot", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Transition"] },
    { arc: "The Look", note: "The shoot looks revealed", formats: ["Outfit Check", "Walk + Text"] },
    { arc: "The Moment", note: "Being on set", formats: ["Walk + Text", "Lip Sync Song", "Selfie Reaction"] },
    { arc: "The Editorial", note: "The final shots", formats: ["Own Shoots"] },
  ] },
];

export const MAIN_AREAS: MainArea[] = [
  { key: "home", label: "Home", title: "Home", chapters: [
    { name: "After Trip", desc: "Coming home with new things: what you bought and how they settle into your life", arcs: [
      { arc: "The Moment", note: "Just being home again, in your space and your outfit", formats: ["Presence + Text", "Lip Sync Song"] },
      { arc: "The Edit", note: "The unboxing and what you bought, with the real reason why", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Look", note: "The new piece worn and styled for the first time", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Opinion", note: "Your verdict on what you bought: worth it or not", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Obsession", note: "How the new piece becomes part of you every day", formats: ["Presence + Text", "Lip Sync Song", "Voiceover", "Selfie Reaction + Result"] },
    ] },
    { name: "Home Projects", desc: "Bedroom, bathroom, furniture, decorating and home improvements", arcs: [
      { arc: "The Edit", note: "What you change at home and why you choose it", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Story", note: "A small vlog showing the little change in real life", formats: ["Vlog", "Voiceover"] },
      { arc: "The Opinion", note: "What worked, what didn't, and what you'd choose again", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Obsession", note: "Loving and living in the result", formats: ["Presence + Text", "Voiceover", "Selfie Reaction + Result"] },
    ] },
    { name: "Maintenance", desc: "Hair, lashes, nails, skincare and other beauty upkeep", arcs: [
      { arc: "The Obsession", note: "The teaser, the thought of needing it done", formats: ["Presence + Text", "Lip Sync Song"] },
      { arc: "The Moment", note: "Being there, at the appointment or in the routine", formats: ["Presence + Text", "Selfie Reaction", "TikTok Trends"] },
      { arc: "The Look", note: "The reveal of the fresh look", formats: ["Transition", "Outfit Check"] },
      { arc: "The Opinion", note: "Your honest take on what's worth it and what isn't", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Story", note: "How it turned out and the result", formats: ["Vlog", "Selfie Reaction + Result"] },
    ] },
    { name: "Beauty Projects", desc: "New hair, new makeup, beauty changes and experiments", arcs: [
      { arc: "The Edit", note: "What you're changing in your beauty and why", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Story", note: "The change as it happens, with the result", formats: ["Vlog", "Selfie Reaction + Result"] },
      { arc: "The Look", note: "The reveal of the new look", formats: ["Transition"] },
      { arc: "The Opinion", note: "Your verdict on the change or the products", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Obsession", note: "Wanting the change, then loving the new look", formats: ["Presence + Text", "Lip Sync Song", "Selfie Reaction + Result"] },
    ] },
    { name: "Wardrobe & Style", desc: "Wardrobe edits, new pieces, seasonal changes and style development", arcs: [
      { arc: "The Edit", note: "What stays, what goes, what comes in, and why", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Look", note: "The new pieces worn and styled", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Opinion", note: "Your style rules and honest takes", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Personality", note: "The relatable side, like “nothing to wear” in a full closet", formats: ["Lip Sync Talk", "Skits"] },
      { arc: "The Obsession", note: "The pieces you reach for again and again", formats: ["Presence + Text", "Voiceover"] },
    ] },
    { name: "Occasion", desc: "Birthdays, dinners, holidays, events and special days from home", arcs: [
      { arc: "The Obsession", note: "The occasion piece or plan you can't stop thinking about", formats: ["Presence + Text", "Lip Sync Song"] },
      { arc: "The Before", note: "Getting ready and the build-up before you go", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Lip Sync Song", "Transition"] },
      { arc: "The Look", note: "The occasion outfit revealed", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Moment", note: "Being there and capturing the scene", formats: ["Walk + Text", "TikTok Trends", "Lip Sync Song", "Selfie Reaction"] },
      { arc: "The Story", note: "The whole day or evening, with a payoff", formats: ["Vlog", "Voiceover"] },
    ] },
    { name: "Kits & Preparation", desc: "Travel kits, work bag, beauty kits and restocking", arcs: [
      { arc: "The Edit", note: "What's in your kit and why each thing earns its place", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Opinion", note: "Your rules and judgments on what belongs in a kit", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Obsession", note: "The one item you never go without", formats: ["Presence + Text", "Voiceover"] },
    ] },
    { name: "Before Next Trip", desc: "The prep process at home: planning, choosing and counting down", arcs: [
      { arc: "The Obsession", note: "Dreaming about the destination before you go", formats: ["Presence + Text", "Lip Sync Song"] },
      { arc: "The Edit", note: "What you're bringing for this trip and why", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Look", note: "Trip outfits tried on and tested", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Before", note: "The prep mood at home: packing, planning, countdown", formats: ["Voiceover", "Presence + Text", "Lip Sync Song", "TikTok Trends"] },
      { arc: "The Personality", note: "The relatable side of prepping, like overplanning", formats: ["Lip Sync Talk", "Skits"] },
    ] },
  ] },
  { key: "travel", label: "Travel", title: "Travel", chapters: [
    { name: "City Break", desc: "Short trips, city experiences, outfits, restaurants and activities", arcs: [
      { arc: "The Before",  note: "Getting ready and the excitement of going", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Transition"] },
      { arc: "The Look",    note: "The trip outfits revealed", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Moment",  note: "Being there and capturing the city", formats: ["Walk + Text", "TikTok Trends", "Lip Sync Song", "Selfie Reaction"] },
      { arc: "The Opinion", note: "Your honest take on restaurants, places and activities", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Story",   note: "The whole trip with a payoff", formats: ["Vlog", "GRWM Talking", "Voiceover"] },
    ] },
    { name: "Long Trip", desc: "Longer holidays, destinations and daily life away", arcs: [
      { arc: "The Before",    note: "Getting ready for the day out", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Lip Sync Song"] },
      { arc: "The Look",      note: "The outfit of the day", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Moment",    note: "Being out and capturing the scene", formats: ["Walk + Text", "TikTok Trends", "Lip Sync Song", "Selfie Reaction", "Presence + Text"] },
      { arc: "The Obsession", note: "What you fall for there (the place, the food, the feeling)", formats: ["Presence + Text", "Lip Sync Song", "Voiceover"] },
      { arc: "The Story",     note: "The day or the stop, with a payoff", formats: ["Vlog", "GRWM Talking", "Voiceover"] },
    ] },
    { name: "Occasion", desc: "Birthdays, dinners and events on a city break or long trip", arcs: [
      { arc: "The Obsession", note: "The occasion piece or plan you can't stop thinking about", formats: ["Presence + Text", "Lip Sync Song"] },
      { arc: "The Before",    note: "Getting ready and the build-up before you go", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Lip Sync Song", "Transition"] },
      { arc: "The Look",      note: "The occasion outfit revealed", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Moment",    note: "Being there and capturing the scene", formats: ["Walk + Text", "TikTok Trends", "Lip Sync Song", "Selfie Reaction"] },
      { arc: "The Story",     note: "The whole evening, with a payoff", formats: ["Vlog", "GRWM Talking", "Voiceover"] },
    ] },
    { name: "Maintenance", desc: "Nails, hair, lashes and spa appointments while away", arcs: [
      { arc: "The Obsession", note: "The teaser, wanting it done there", formats: ["Presence + Text", "Lip Sync Song"] },
      { arc: "The Moment",    note: "Being at the appointment", formats: ["Presence + Text", "Selfie Reaction", "TikTok Trends"] },
      { arc: "The Look",      note: "The reveal of the fresh look", formats: ["Transition", "Outfit Check"] },
      { arc: "The Opinion",   note: "Your honest take on getting it done abroad", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Story",     note: "How it turned out and the result", formats: ["Vlog", "Selfie Reaction + Result"] },
    ] },
  ] },
  { key: "work", label: "Work", title: "Brand Work", chapters: [
    { name: "Invited", desc: "Brand invitations, events and hosted experiences", arcs: [
      { arc: "The Before",  note: "Getting ready for the event and the build-up", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Lip Sync Song", "Transition"] },
      { arc: "The Look",    note: "The event outfit revealed", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Moment",  note: "Being there and capturing the experience", formats: ["Walk + Text", "TikTok Trends", "Lip Sync Song", "Selfie Reaction"] },
      { arc: "The Opinion", note: "Your honest take on the experience", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Story",   note: "The whole event, with a payoff", formats: ["Vlog", "GRWM Talking", "Voiceover"] },
    ] },
    { name: "Brand Collab", desc: "Paid partnerships, gifting, campaigns and collaborations", arcs: [
      { arc: "The Edit",      note: "Why you chose the product and how it fits into your life", formats: ["Seated Talking", "Half-Body Talking"] },
      { arc: "The Look",      note: "The product worn or styled", formats: ["Outfit Check", "Walk + Text", "Transition"] },
      { arc: "The Opinion",   note: "Your honest verdict on the product", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Obsession", note: "The piece you keep reaching for", formats: ["Presence + Text", "Lip Sync Song", "Voiceover", "Selfie Reaction + Result"] },
      { arc: "The Editorial", note: "Campaign content, kept separate", formats: ["Own Shoots"] },
    ] },
    { name: "Fashion Week", desc: "Fashion Week trips, shows, events, street style and industry experiences", arcs: [
      { arc: "The Before",  note: "Getting ready for the shows", formats: ["GRWM Talking", "Voiceover", "Presence + Text", "Transition"] },
      { arc: "The Look",    note: "Your street style outfits revealed", formats: ["Outfit Check", "Walk + Text"] },
      { arc: "The Moment",  note: "Being at the shows and capturing the scene", formats: ["Walk + Text", "TikTok Trends", "Lip Sync Song", "Selfie Reaction"] },
      { arc: "The Opinion", note: "Your take on the shows, looks and trends", formats: ["Presence + Text", "Question + Reply/Reaction"] },
      { arc: "The Story",   note: "The Fashion Week days, with a payoff", formats: ["Vlog", "GRWM Talking", "Voiceover"] },
    ] },
  ] },
];
