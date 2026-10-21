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
  focusTier:     "now" | "premium" | "luxury";
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
export interface ConceptFormat { name: string; main: boolean; tt: boolean; ig: boolean; }
export interface ConceptLink   { url: string; note: string; }
export interface ConceptArc {
  id:      string;
  account: Account;
  num:     number;            // 1, 2, 3 … top to bottom
  name:    string;
  purpose: string;
  formats: ConceptFormat[];   // in order; main = the arc's main format(s)
  texts:   string[];          // example lines
  links:   ConceptLink[];     // reference posts: link + what it shows
}
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
// Creator strip: ideas, posts, pieces (+ first set, month goal).
// Everything else that repeats (check-in, kit handover, your own
// tasks) stays in To-do. The snapshot task is no longer used — the
// followers number is still typed into the weekly snapshot row.
export const MANAGER_GOAL = (t: Task) => t.phase === "maintain" && (
  t.source === "following" || t.source === "followers" || t.source === "outreach" || t.source === "pitches" || t.source === "leads" || (t.area === "community" && t.rhythm === "daily"));
export const CREATOR_GOAL = (t: Task) => t.phase === "maintain" && (t.source === "ideas" || t.source === "filmed" || t.source === "posts" || t.source === "pieces");
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
