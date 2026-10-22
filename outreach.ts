// ─────────────────────────────────────────────────────────────
// outreach — ONE place for the email list's columns, categories,
// tiers, statuses and the Claude prompt. The "Excel columns" window,
// the Prompt button, the Excel template and the Excel/PDF downloads
// all read from here, so they always match.
// Categories and tiers are 1:1 from Lynn's own Excel (sheet "Lists").
// Tracking: one status per contact; the category decides the
// pipeline (UGC → @createbylynn, every other category → @lynnhoa).
// ─────────────────────────────────────────────────────────────

// ── Categories (Excel "Lists" › Categories, same order) ──────
// the keys stay short and stable in the database; the labels are the Excel names
export type OutreachCategory = "fashion" | "beauty" | "makeup" | "agency" | "ugc" | "hotel" | "restaurants" | "lifestyle";
const CAT_LOOK = { color: "#6B655E", bg: "#F1EEEA", border: "#e2ddd6" };
export const OUTREACH_CATEGORIES: { key: OutreachCategory; label: string; color: string; bg: string; border: string }[] = [
  { key: "fashion",     label: "Fashion",    ...CAT_LOOK },
  { key: "beauty",      label: "Beauty",     ...CAT_LOOK },
  { key: "makeup",      label: "Makeup",     ...CAT_LOOK },
  { key: "agency",      label: "Agency",     ...CAT_LOOK },
  { key: "ugc",         label: "UGC",        ...CAT_LOOK },
  { key: "hotel",       label: "Hotel",      ...CAT_LOOK },
  { key: "restaurants", label: "Restaurant", ...CAT_LOOK },
  { key: "lifestyle",   label: "Lifestyle",  ...CAT_LOOK },
];
export const isCategory = (k: string | null | undefined) => OUTREACH_CATEGORIES.some(c => c.key === k);
// an old value that isn't on the list any more (Events, Others): shown as "—" until a category is picked
export const catOf = (k: string) => OUTREACH_CATEGORIES.find(c => c.key === k) || { key: (k || "") as OutreachCategory, label: "—", ...CAT_LOOK };

// ── Tiers (Excel "Lists" › Tiers, same order); empty = no tier ─
// Stages: Premium → Stage 4, Luxury → Stage 5, every other tier and no tier → Stages 2–3
export type OutreachTier = "" | "emerging" | "value" | "fast_fashion" | "contemporary" | "premium" | "luxury";
export const OUTREACH_TIERS: { key: Exclude<OutreachTier, "">; label: string }[] = [
  { key: "emerging",     label: "Emerging / Newcomer" },
  { key: "value",        label: "Value / Budget" },
  { key: "fast_fashion", label: "Fast Fashion" },
  { key: "contemporary", label: "Contemporary / Mid-Market" },
  { key: "premium",      label: "Premium" },
  { key: "luxury",       label: "Luxury" },
];
export const isTier = (k: string | null | undefined) => OUTREACH_TIERS.some(t => t.key === k);
// always an object: label "" for no tier (callers show "—" where a cell needs it)
export const tierOf = (k: string | null | undefined) => OUTREACH_TIERS.find(t => t.key === k) || { key: "" as OutreachTier, label: "" };
export const NO_TIER = "No tier";

// ── Status (one per contact) ─────────────────────────────────
// "new" = not contacted yet (empty in the database). Follow up is not a status:
// it shows by itself on Pitched contacts when a follow-up is due (see CADENCE below).
export type OutreachStatus = "new" | "pitched" | "replied" | "gifted" | "invited" | "lead" | "client" | "declined" | "no_reply";
export const OUTREACH_STATUSES: { key: OutreachStatus; label: string }[] = [
  { key: "new",      label: "New" },
  { key: "pitched",  label: "Pitched" },
  { key: "replied",  label: "Replied" },
  { key: "gifted",   label: "Gifted" },
  { key: "invited",  label: "Invited" },
  { key: "lead",     label: "Lead" },
  { key: "client",   label: "Client" },
  { key: "declined", label: "Declined" },
  { key: "no_reply", label: "No reply" },
];
export const statusOf = (k: string) => OUTREACH_STATUSES.find(s => s.key === k) || OUTREACH_STATUSES[0];

// ── Pipelines: the category decides ──────────────────────────
// UGC → @createbylynn (always paid: no Gifted / Invited) · every other category → @lynnhoa
export type Pipeline = "lynnhoa" | "ugc";
export const pipelineOf = (category: string): Pipeline => (category === "ugc" ? "ugc" : "lynnhoa");
export const PIPELINES: { key: Pipeline; label: string }[] = [
  { key: "lynnhoa", label: "@lynnhoa" },
  { key: "ugc",     label: "@createbylynn · UGC" },
];
const LYNNHOA_ONLY = new Set<string>(["gifted", "invited"]);
// the statuses the dropdown offers for this category
export const statusesFor = (category: string) =>
  OUTREACH_STATUSES.filter(s => pipelineOf(category) === "lynnhoa" || !LYNNHOA_ONLY.has(s.key));
// a category change to UGC: Gifted / Invited don't exist there → Replied
export const fitStatus = (status: OutreachStatus, category: string): OutreachStatus =>
  pipelineOf(category) === "ugc" && LYNNHOA_ONLY.has(status) ? "replied" : status;
// what one pitch does (Write in Outlook / + Pitch on one contact):
// New and every ended status start a new cycle → Pitched; Pitched, Replied and Lead stay
export const statusAfterPitch = (s: OutreachStatus): OutreachStatus =>
  s === "pitched" || s === "replied" || s === "lead" ? s : "pitched";
// what a detected reply does: New / Pitched → Replied; later statuses stay
export const statusAfterReply = (s: OutreachStatus): OutreachStatus =>
  s === "new" || s === "pitched" ? "replied" : s;

// ── Follow-up timing — ONE place (the daily No reply on the server uses the same numbers) ──
// pitch → Follow-up 1 after 7 days (same weekday, one week later) → Follow-up 2 after 10 more →
// No reply 14 days after that (set by the server once a day) → Re-pitch 90 days after No reply / Declined.
// A reply stops it all. The server only uses the 14 (outreach_close_no_reply), so 7 / 10 / 90 can change here alone.
export const CADENCE = { fu1: 7, fu2: 10, close: 14, repitch: 90 } as const;
export const FOLLOW_UP_DAYS = CADENCE.fu1;   // older callers: days until the first follow-up
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayYmd = (now = new Date()) => ymdLocal(now);
export const addDaysYmd = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); return ymdLocal(new Date(y, m - 1, d + n)); };
const isoToYmd = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : ymdLocal(d); };
export const mondayYmd = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); const t = new Date(y, m - 1, d); return addDaysYmd(ymd, -((t.getDay() + 6) % 7)); };
// ISO calendar week of a date (W1 = the week with the year's first Thursday)
export const isoWeekNo = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d)); const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
};
const daysSince = (ymd: string, now = new Date()) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const a = new Date(y, m - 1, d), b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b.getTime() - a.getTime()) / 864e5);
};

export type FollowStep = "fu1" | "fu2" | "close" | null;
export interface FollowInfo { followStep: FollowStep; followDueOn: string | null; followSent: number; repitchOn: string | null; }
// Where a contact stands in the follow-up cycle — worked out from its pitch log (follow-ups since the
// last pitch) and, for re-pitch, from the timeline (the day it became No reply / Declined)
export function followInfo(c: { status: string; lastContact: string | null },
  pitches: { kind: string; sentOn: string }[] = [], events: { kind: string; status: string | null; at: string }[] = []): FollowInfo {
  let followStep: FollowStep = null, followDueOn: string | null = null, followSent = 0, repitchOn: string | null = null;
  const st = c.status || "new";
  if (st === "pitched") {
    const lastPitch = pitches.filter(p => p.kind === "pitch").reduce<string | null>((m, p) => (!m || p.sentOn > m ? p.sentOn : m), null);
    const fus = pitches.filter(p => p.kind === "follow_up" && (!lastPitch || p.sentOn >= lastPitch));
    followSent = fus.length;
    const lastSent = [lastPitch || "", ...fus.map(p => p.sentOn)].filter(Boolean).sort().pop() || c.lastContact;
    if (lastSent) {
      followStep = followSent === 0 ? "fu1" : followSent === 1 ? "fu2" : "close";
      followDueOn = addDaysYmd(lastSent, followSent === 0 ? CADENCE.fu1 : followSent === 1 ? CADENCE.fu2 : CADENCE.close);
    }
  }
  if (st === "no_reply" || st === "declined") {
    const ended = events.filter(e => e.kind === "status" && e.status === st).map(e => isoToYmd(e.at)).filter(Boolean).sort().pop() || c.lastContact;
    repitchOn = ended ? addDaysYmd(ended, CADENCE.repitch) : null;
  }
  return { followStep, followDueOn, followSent, repitchOn };
}
// a follow-up is due (Follow-up 1 or 2); without the pitch log it falls back to the first step
export const followUpDue = (c: { status: string; lastContact: string | null; followStep?: FollowStep; followDueOn?: string | null }, now = new Date()) => {
  if ((c.status || "new") !== "pitched") return false;
  if (c.followDueOn === undefined) return !!c.lastContact && daysSince(c.lastContact, now) >= CADENCE.fu1;
  return (c.followStep === "fu1" || c.followStep === "fu2") && !!c.followDueOn && c.followDueOn <= todayYmd(now);
};
// No reply / Declined, 90 days ago or more: ready to pitch again
export const repitchReady = (c: { status: string; repitchOn?: string | null }, now = new Date()) =>
  (c.status === "no_reply" || c.status === "declined") && !!c.repitchOn && c.repitchOn <= todayYmd(now);
// the kind of email that comes next: pitched → the next follow-up (none after the 2nd); everything else → a pitch
export type NextKind = "pitch" | "follow_up" | "follow_up_2";
export const nextKind = (c: { status: string; followSent?: number }): NextKind | null =>
  (c.status || "new") === "pitched" ? ((c.followSent || 0) >= 2 ? null : (c.followSent || 0) === 1 ? "follow_up_2" : "follow_up") : "pitch";

// One pitch or follow-up sent to a contact, for one account
export type PitchAccount = "lynnhoa" | "createbylynn";
export interface Pitch {
  id:        string;
  contactId: string;
  account:   PitchAccount;
  kind:      "pitch" | "follow_up";
  sentOn:    string;   // yyyy-mm-dd
  channel?:  Channel;  // how it was sent: email (default) or Instagram DM
  createdAt?: string;  // when it was logged (orders entries of the same day)
  templateId?: string | null;   // the Email kit template it was written with (Write in Outlook)
}
// One timeline entry that isn't an email sent: a status change, or (from reply detection) a reply
export interface OutreachEvent {
  id:        string;
  contactId: string;
  kind:      "status" | "reply";
  status:    OutreachStatus | null;   // status entries: the new status (null = New)
  at:        string;                  // ISO timestamp
  note?:     string;                  // e.g. "after 2 follow-ups", "imported from your Excel"
  messageId?: string | null;          // replies: the email they came from (so a reply is never counted twice)
}
export const PITCH_ACCOUNTS: { key: PitchAccount; label: string }[] = [
  { key: "lynnhoa", label: "@lynnhoa" },
  { key: "createbylynn", label: "@createbylynn" },
];
// the account a pitch counts for comes from the category
export const accountOf = (category: string): PitchAccount => (pipelineOf(category) === "ugc" ? "createbylynn" : "lynnhoa");

// ── Channel: email (default) or Instagram DM — set per contact in its window ──
export type Channel = "email" | "dm";
export const CHANNELS: { key: Channel; label: string }[] = [{ key: "email", label: "Email" }, { key: "dm", label: "Instagram DM" }];
// "@chanel" · "chanel" · "instagram.com/chanel/" · "https://www.instagram.com/chanel?hl=de" → "chanel" ("" if it isn't one)
const NOT_HANDLES = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts", "direct"]);
export function igHandleOf(text: string): string {
  const t = String(text || "").trim();
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) return NOT_HANDLES.has(m[1].toLowerCase()) ? "" : m[1].toLowerCase();
  const a = t.match(/^@?([A-Za-z0-9._]{1,30})$/);
  return a && (t.startsWith("@") || !/\./.test(a[1]) || a[1].includes("_")) ? a[1].toLowerCase() : "";
}
// the Instagram field as typed: "@chanel.paris", "chanel.paris" or a link → "chanel.paris"
export function cleanHandle(text: string): string {
  const t = String(text || "").trim();
  if (/instagram\.com/i.test(t)) return igHandleOf(t);
  const m = t.replace(/^@/, "").match(/^[A-Za-z0-9._]{1,30}$/);
  return m ? m[0].toLowerCase() : "";
}
// the handle a DM goes to: the Instagram field, else what's in Website / Instagram
export const handleOf = (c: { instagram?: string; web?: string }) => cleanHandle(c.instagram || "") || igHandleOf(c.web || "");

export interface OutreachContact {
  id:          string;
  company:     string;
  contactName: string;
  email:       string;
  category:    OutreachCategory;
  tier:        OutreachTier;    // "" = no tier
  status:      OutreachStatus;
  lastContact: string | null;   // date of the last pitch or follow-up
  replyAt:     string | null;   // when the last reply came in (reply detection)
  replyNew:    boolean;         // a reply you haven't opened yet (the dot)
  clientId:    string | null;   // the client in Manager (Lead → Client)
  // worked out by useOutreach from the pitch log and the timeline (see followInfo)
  followStep?:  FollowStep;     // fu1 · fu2 · close (waiting for No reply) · null
  followDueOn?: string | null;  // when that step is due (yyyy-mm-dd)
  followSent?:  number;         // follow-ups sent since the last pitch
  repitchOn?:   string | null;  // No reply / Declined: from when it can be pitched again
  web:         string;          // website or Instagram
  instagram:   string;          // Instagram handle without @ (for DMs) — "" = none
  channel:     Channel;         // how this contact is pitched: email (default) or Instagram DM
  city:        string;
  country:     string;
  notes:       string;
  source:      string;          // file the contact came from
  createdAt:   string;          // ISO timestamp
}

// The columns of the list (Excel columns window, template, downloads)
export interface OutreachColumn { key: keyof OutreachContact; label: string; required: boolean; example: string; note?: string; }
export const OUTREACH_COLUMNS: OutreachColumn[] = [
  { key: "company",     label: "Company",             required: true,  example: "Chanel",             note: "Brand, hotel, restaurant or agency" },
  { key: "email",       label: "Email",               required: true,  example: "pr@chanel.com",      note: "Rows without an email are skipped" },
  { key: "contactName", label: "Contact name",        required: false, example: "Poma" },
  { key: "category",    label: "Category",            required: false, example: "Fashion",            note: `${OUTREACH_CATEGORIES.map(c => c.label).join(" · ")} — empty: Claude picks the closest` },
  { key: "tier",        label: "Tier",                required: false, example: "Luxury",             note: `${OUTREACH_TIERS.map(t => t.label).join(" · ")} — empty: no tier` },
  { key: "web",         label: "Website / Instagram", required: false, example: "@chanel" },
  { key: "instagram",   label: "Instagram",           required: false, example: "@chanel",            note: "For DMs — empty: taken from Website / Instagram" },
  { key: "channel",     label: "Channel",             required: false, example: "Email",              note: "Email · Instagram DM — empty: Email" },
  { key: "city",        label: "City",                required: false, example: "Paris" },
  { key: "country",     label: "Country",             required: false, example: "France" },
  { key: "notes",       label: "Notes",               required: false, example: "Met at Fashion Week" },
];

// Tab-separated header row: paste into cell A1 in Excel
export const headerRow = () => OUTREACH_COLUMNS.map(c => c.label).join("\t");

// ── The prompt for Claude (SQL for the Supabase SQL editor) ──
export function buildPrompt(loginEmail: string): string {
  const email = loginEmail || "YOUR-LOGIN-EMAIL";
  const cats  = OUTREACH_CATEGORIES.map(c => `${c.key} = ${c.label}`).join(", ");
  const tiers = OUTREACH_TIERS.map(t => `${t.key} = ${t.label}`).join(", ");
  return `I'm attaching an Excel/CSV list of contacts for my outreach email list. Please turn it into ONE SQL statement for my Supabase database.

1. Read every row. Find these fields (the column names in my file may differ slightly):
   company, contact name, email, category, tier, website or Instagram, Instagram handle, channel, city, country, notes.
   City and country are separate: never put a country into city (e.g. city "Mallorca", country "Spain").
2. Clean the data:
   - trim spaces; write every email in lowercase
   - skip rows without a valid email address
   - if the same email appears more than once in the file, keep it once
3. Category: write the key of exactly one of these (key = the name in my Excel): ${cats}.
   Use the file's category column if it has one. If a row has no category, pick the closest of these 8.
4. Tier: write the key of one of these (key = the name in my Excel): ${tiers}.
   Use the file's tier column. If a row has no tier, write NULL (without quotes) — never guess a tier.
5. Instagram: the handle without @ in lowercase (from an Instagram column, or from an instagram.com link or @handle in the website column), else ''.
   Channel: 'dm' when the file's channel column says Instagram DM (or DM only), otherwise 'email'.
6. Output ONLY this SQL (no explanation before it). Escape apostrophes by doubling them (O'Brien → O''Brien). Use '' for other empty fields. Put the file name in "source". If there are more than 500 contacts, make several statements of max. 500 rows.

insert into public.outreach_contacts (user_id, company, contact_name, email, category, tier, web, instagram, channel, city, country, notes, source)
select u.id, v.company, v.contact_name, v.email, v.category, v.tier, v.web, v.instagram, v.channel, v.city, v.country, v.notes, v.source
from (values
  ('Chanel', 'Poma', 'pr@chanel.com', 'fashion', 'luxury', '@chanel', 'chanel', 'email', 'Paris', 'France', '', 'my-list.xlsx')
) as v(company, contact_name, email, category, tier, web, instagram, channel, city, country, notes, source)
cross join (select id from auth.users where email = '${email}') u
on conflict (user_id, email) do nothing;

7. After the SQL, add a 3-line summary: rows read, rows skipped (no email / duplicate in file), and the count per category.

I'll run the SQL in Supabase → SQL editor. Emails that are already on my list are skipped automatically.`;
}

// ── Chips: quick views over the list ─────────────────────────
// Active = Pitched (incl. follow up due) and Replied, plus every contact with a new reply.
// Declined / No reply have no chip: they're in All, and Filter → Status finds them.
export type ChipKey = "all" | "active" | "gifted" | "invited" | "lead";
export const CHIPS: { key: ChipKey; label: string; statuses: OutreachStatus[] | null }[] = [
  { key: "all",     label: "All",     statuses: null },
  { key: "active",  label: "Active",  statuses: ["pitched", "replied"] },
  { key: "gifted",  label: "Gifted",  statuses: ["gifted"] },
  { key: "invited", label: "Invited", statuses: ["invited"] },
  { key: "lead",    label: "Lead",    statuses: ["lead", "client"] },
];
export const isChip = (k: string | null | undefined): k is ChipKey => CHIPS.some(c => c.key === k);
export const inChip = (c: { status: string; replyNew?: boolean }, chip: ChipKey) => {
  const def = CHIPS.find(x => x.key === chip);
  if (!def || !def.statuses) return true;
  if (chip === "active" && c.replyNew) return true;
  return def.statuses.includes((c.status || "new") as OutreachStatus);
};

// Search / filter / sort helpers
export type SortKey = "urgent" | "az" | "za" | "new" | "old" | "cat";
export const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: "urgent", label: "Most urgent",  short: "Urgent" },
  { key: "az",     label: "Name A–Z",     short: "A–Z" },
  { key: "za",     label: "Name Z–A",     short: "Z–A" },
  { key: "new",    label: "Newest added", short: "Newest" },
  { key: "old",    label: "Oldest added", short: "Oldest" },
  { key: "cat",    label: "Category",     short: "Category" },
];
export type AddedKey = "any" | "30d" | "year";
export const ADDED: { key: AddedKey; label: string }[] = [
  { key: "any",  label: "Any time" },
  { key: "30d",  label: "Last 30 days" },
  { key: "year", label: "This year" },
];
// tier: "all" · a tier key · "none" (no tier) — acc: "all" · "lynnhoa" · "ugc"
export interface OutreachView { q: string; chip: ChipKey; cat: string; tier: string; status: string; acc: string; channel?: string; city: string; country: string; added: AddedKey; sort: SortKey; }
export const DEFAULT_VIEW: OutreachView = { q: "", chip: "all", cat: "all", tier: "all", status: "all", acc: "all", channel: "all", city: "all", country: "all", added: "any", sort: "az" };
// "Reset" / "Show all": every filter off (search, chip and sort stay)
export const NO_FILTERS: Partial<OutreachView> = { cat: "all", tier: "all", status: "all", acc: "all", channel: "all", city: "all", country: "all", added: "any" };
// "Mallorca, Spain" · "Spain" · ""
export const placeOf = (c: { city?: string; country?: string }) => [c.city, c.country].map(x => (x || "").trim()).filter(Boolean).join(", ");
// Status filter: the statuses plus "Follow-up due"
export const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  ...OUTREACH_STATUSES.map(s => ({ key: s.key, label: s.label })),
  { key: "followup", label: "Follow-up due" },
  { key: "repitch",  label: "Ready to re-pitch" },
];

// Most urgent first: new reply · follow-up due · replied · pitched (newest first) · the rest A–Z
const urgency = (c: OutreachContact, now: Date) =>
  c.replyNew ? 0 : followUpDue(c, now) ? 1 : c.status === "replied" ? 2 : c.status === "pitched" ? 3 : 4;

// everything except search and the chip (the chip counts use this)
const passesFilters = (c: OutreachContact, v: OutreachView, now: Date) => {
  const since30 = new Date(now.getTime() - 30 * 864e5).toISOString();
  const yearStart = `${now.getFullYear()}-01-01`;
  return (v.cat === "all" || c.category === v.cat) &&
    (!v.tier || v.tier === "all" || (v.tier === "none" ? !c.tier : c.tier === v.tier)) &&
    (!v.status || v.status === "all" || (v.status === "followup" ? followUpDue(c, now) : v.status === "repitch" ? repitchReady(c, now) : (c.status || "new") === v.status)) &&
    (!v.acc || v.acc === "all" || pipelineOf(c.category) === v.acc) &&
    (!v.channel || v.channel === "all" || (c.channel || "email") === v.channel) &&
    (v.city === "all" || (c.city || "") === v.city) &&
    (!v.country || v.country === "all" || (c.country || "") === v.country) &&
    (v.added === "any" || (v.added === "30d" ? c.createdAt >= since30 : c.createdAt >= yearStart));
};

// how many contacts each chip holds with the current filters (search and chip left out)
export function chipCounts(list: OutreachContact[], v: OutreachView, now = new Date()): Record<ChipKey, number> {
  const m: Record<ChipKey, number> = { all: 0, active: 0, gifted: 0, invited: 0, lead: 0 };
  list.forEach(c => { if (!passesFilters(c, v, now)) return; CHIPS.forEach(ch => { if (inChip(c, ch.key)) m[ch.key]++; }); });
  return m;
}

export function applyView(list: OutreachContact[], v: OutreachView, now = new Date()): OutreachContact[] {
  const q = v.q.trim().toLowerCase();
  const out = list.filter(c =>
    // a search always looks through every contact, whatever chip is picked
    (q ? [c.company, c.contactName, c.email].some(x => (x || "").toLowerCase().includes(q)) : inChip(c, v.chip || "all")) &&
    passesFilters(c, v, now)
  );
  const byName = (a: OutreachContact, b: OutreachContact) => (a.company || a.email).localeCompare(b.company || b.email, "de", { sensitivity: "base" });
  const catIdx = (c: OutreachContact) => OUTREACH_CATEGORIES.findIndex(x => x.key === c.category);
  const urgent = (a: OutreachContact, b: OutreachContact) => {
    const ua = urgency(a, now), ub = urgency(b, now);
    if (ua !== ub) return ua - ub;
    if (ua === 0) return (b.replyAt || "").localeCompare(a.replyAt || "") || byName(a, b);          // newest reply first
    if (ua === 1) return (a.lastContact || "").localeCompare(b.lastContact || "") || byName(a, b);  // longest waiting first
    if (ua === 2) return (b.replyAt || b.lastContact || "").localeCompare(a.replyAt || a.lastContact || "") || byName(a, b);
    if (ua === 3) return (b.lastContact || "").localeCompare(a.lastContact || "") || byName(a, b);  // newest pitch first
    return byName(a, b);
  };
  out.sort((a, b) =>
    v.sort === "urgent" ? urgent(a, b)
    : v.sort === "za"  ? byName(b, a)
    : v.sort === "new" ? b.createdAt.localeCompare(a.createdAt)
    : v.sort === "old" ? a.createdAt.localeCompare(b.createdAt)
    : v.sort === "cat" ? (catIdx(a) - catIdx(b)) || byName(a, b)
    : byName(a, b));
  return out;
}

// ── Dashboard numbers (read-only overview) ─────────────────────
// view: all · @lynnhoa (every category but UGC) · UGC. Emails sent count by the pitch's account.
export type DashView = "all" | "lynnhoa" | "ugc";
const ANSWERED = new Set(["replied", "gifted", "invited", "lead", "client", "declined"]);   // they wrote back (a "no" is an answer too)
export function dashboardStats(contacts: OutreachContact[], pitches: Pitch[], events: OutreachEvent[], view: DashView, now = new Date()) {
  const inView = (cat: string) => view === "all" || pipelineOf(cat) === view;
  const accOk = (acc: string) => view === "all" || (view === "ugc" ? acc === "createbylynn" : acc === "lynnhoa");
  const cs = contacts.filter(c => inView(c.category));
  const replyIds = new Set(events.filter(e => e.kind === "reply").map(e => e.contactId));
  const answered = (c: OutreachContact) => ANSWERED.has(c.status) || replyIds.has(c.id);
  const contacted = (c: OutreachContact) => (c.status || "new") !== "new";
  const pitched = cs.filter(contacted), replies = cs.filter(c => contacted(c) && answered(c));
  // the last 8 calendar weeks, this week last
  const thisMon = mondayYmd(todayYmd(now));
  const mondays = Array.from({ length: 8 }, (_, i) => addDaysYmd(thisMon, -7 * (7 - i)));
  const end = addDaysYmd(thisMon, 6);
  const sent = pitches.filter(p => accOk(p.account) && p.sentOn >= mondays[0] && p.sentOn <= end);
  const weeks = mondays.map(m => ({ monday: m, week: isoWeekNo(m), n: sent.filter(p => p.sentOn >= m && p.sentOn <= addDaysYmd(m, 6)).length }));
  const won = { gifted: 0, invited: 0, lead: 0, client: 0 };
  cs.forEach(c => { if (c.status === "gifted" || c.status === "invited" || c.status === "lead" || c.status === "client") won[c.status]++; });
  const fu1 = cs.filter(c => followUpDue(c, now) && c.followStep === "fu1").length;
  const fu2 = cs.filter(c => followUpDue(c, now) && c.followStep === "fu2").length;
  return {
    weeks, sentTotal: sent.length, sentPitches: sent.filter(p => p.kind === "pitch").length, sentFollowUps: sent.filter(p => p.kind === "follow_up").length,
    sentEmails: sent.filter(p => (p.channel || "email") === "email").length, sentDms: sent.filter(p => p.channel === "dm").length,
    thisWeek: weeks[7].n,
    contacts: cs.length, pitched: pitched.length, replies: replies.length,
    responseRate: pitched.length ? (replies.length / pitched.length) * 100 : 0,
    awaiting: cs.filter(c => c.status === "pitched").length,
    followUpsDue: fu1 + fu2, fu1Due: fu1, fu2Due: fu2,
    newReplies: cs.filter(c => c.replyNew).length,
    won: { total: won.gifted + won.invited + won.lead + won.client, ...won },
    repitch: cs.filter(c => repitchReady(c, now)).length,
    byCategory: OUTREACH_CATEGORIES.filter(k => inView(k.key)).map(k => {
      const list = cs.filter(c => c.category === k.key);
      return { key: k.key, label: k.label, contacts: list.length, pitched: list.filter(contacted).length, replies: list.filter(c => contacted(c) && answered(c)).length };
    }).filter(r => r.contacts > 0).sort((a, b) => b.contacts - a.contacts || a.label.localeCompare(b.label)),
  };
}

export const activeFilters = (v: OutreachView) => (v.cat !== "all" ? 1 : 0) + (v.tier && v.tier !== "all" ? 1 : 0) + (v.status && v.status !== "all" ? 1 : 0) + (v.acc && v.acc !== "all" ? 1 : 0) + (v.channel && v.channel !== "all" ? 1 : 0) + (v.city !== "all" ? 1 : 0) + (v.country && v.country !== "all" ? 1 : 0) + (v.added !== "any" ? 1 : 0);

// "a@x.com, b@y.com" — ready for BCC in Gmail, Outlook, Apple Mail
export const emailsText = (list: OutreachContact[]) => list.map(c => c.email).filter(Boolean).join(", ");

// Copy text — works in the iPhone home-screen app too
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
}
