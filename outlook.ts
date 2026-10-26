// ─────────────────────────────────────────────────────────────
// outlook — one Email kit template filled in for one contact and
// opened in your mail app with everything filled in (to, subject, text).
// It uses the standard email link (mailto:), so every device opens its
// own default mail app: Apple Mail on iPhone, iPad and Mac (or Outlook
// for Mac, if that's the default there), Thunderbird on Windows.
// Nothing connects to Microsoft, and nothing is sent from here:
// you check the email and press Send in your mail app.
// Placeholders in subject and text:
//   {name}    first name of the contact; no name → "Company team"
//   {company} the company
//   {kit}     the template's media kit link (no {kit} → the link goes at the end)
// ─────────────────────────────────────────────────────────────

import { fillText, KIT_TOKEN } from "./useEmailKit";
import type { EmailTemplate } from "./useEmailKit";
import { pipelineOf, ownTemplatesOf } from "./outreach";
import type { Pitch } from "./outreach";

export const NAME_TOKEN = "{name}";
export const COMPANY_TOKEN = "{company}";

// a title in front of the name keeps the whole name ("Ms. Weber"), otherwise the first name
const TITLE = /^(mr|mrs|ms|miss|mx|dr|prof|herr|frau|mme|mlle|sig|sra|sr|signora)\.?$/i;
export function greetingName(contactName: string, company: string): string {
  const parts = String(contactName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length) return TITLE.test(parts[0]) ? parts.join(" ") : parts[0];
  const co = String(company || "").trim();
  return co ? `${co} team` : "there";
}

const fillNames = (s: string, name: string, company: string) =>
  s.split(NAME_TOKEN).join(name).split(COMPANY_TOKEN).join(company);

// the finished email for one contact (kitUrl: the template's media kit link, or null)
export function fillFor(t: { subject: string; body: string }, c: { contactName: string; company: string }, kitUrl: string | null) {
  const name = greetingName(c.contactName, c.company);
  const company = String(c.company || "").trim();
  return {
    subject: fillNames(t.subject, name, company).split(KIT_TOKEN).join("").replace(/\s{2,}/g, " ").trim(),
    body:    fillText(fillNames(t.body, name, company), kitUrl),
  };
}

// the standard email link — line breaks as CR LF (the email-link standard)
const enc = encodeURIComponent;
const addr = (to: string) => String(to || "").trim().replace(/[^a-zA-Z0-9@._+-]/g, ch => enc(ch));
export function composeUrl(to: string, subject: string, body: string): string {
  return `mailto:${addr(to)}?subject=${enc(subject)}&body=${enc(body.replace(/\r?\n/g, "\r\n"))}`;
}

// open it — in the tap itself (the iPhone only opens other apps from a tap)
export function openMail(url: string) { window.location.href = url; }

// ── which template: the account's templates in your Email kit order ──
// Email kit order (your manual sort), templates without a place after them, A–Z
export const byTemplateOrder = (a: EmailTemplate, b: EmailTemplate) => {
  const x = a.sortOrder ?? Number.MAX_SAFE_INTEGER, y = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  return x - y || (a.name || "").localeCompare(b.name || "", "de");
};
// the templates a contact can be written with:
//   a contact of a category with "only its own templates" (Setup — Hotel and Restaurant) → only the
//   templates made for that category (from either account — "Hotels & restaurants" is made for both)
//   every other contact → its account's templates (UGC → @createbylynn, else @lynnhoa), without the ones
//   made for an "own templates" category
const forOwn = (t: EmailTemplate) => (t.categories || []).some(c => ownTemplatesOf(c));
//   … and only the templates of the contact's channel (Email or Instagram DM)
export const templatesFor = (templates: EmailTemplate[], category: string, channel: "email" | "dm" = "email") =>
  (templates || []).filter(t => (t.channel || "email") === channel)
    .filter(t => ownTemplatesOf(category) ? (t.categories || []).includes(category) : (t.pipeline === pipelineOf(category) && !forOwn(t)))
    .sort(byTemplateOrder);

// ── Instagram DM: the text is copied, then the chat with the brand opens (ig.me = Instagram's own
// chat link: the Instagram app on the phone, instagram.com on a computer). You paste and send —
// Instagram doesn't let apps fill in or send a DM.
export const igChatUrl = (handle: string) => `https://ig.me/m/${encodeURIComponent(handle)}`;
// copy in the tap itself (the iPhone only allows it there); falls back to the old way when needed
export function copyNow(text: string) {
  try { if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).catch(() => fallbackCopy(text)); return; } } catch { /* fall back */ }
  fallbackCopy(text);
}
function fallbackCopy(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length); document.execCommand("copy"); ta.remove();
  } catch { /* nothing more to try */ }
}
// open the chat in a new tab / the Instagram app — the app itself stays where it is
export function openInstagram(url: string) {
  const w = window.open(url, "_blank");
  if (w) { try { w.opener = null; } catch { /* other window */ } }
  else window.location.href = url;          // no new window allowed: open it right here
}
// the account a pitch counts for: the template's account (a UGC template for a hotel counts for @createbylynn)
export const accountOfTemplate = (t: EmailTemplate) => (t.pipeline === "ugc" ? "createbylynn" : "lynnhoa") as "createbylynn" | "lynnhoa";
// preselected: one made for the contact's category (else one for any category), of the kind needed —
// Follow-up 2 → else Follow-up 1 → else Pitch; Follow-up 1 → else Pitch — the one used last, else the first in your order
export function pickTemplate(list: EmailTemplate[], category: string, wantKind: "pitch" | "follow_up" | "follow_up_2", pitches: Pitch[]): string {
  const cats = (t: EmailTemplate) => t.categories || [];
  const lastOf = (l: EmailTemplate[]) => {
    if (!l.length) return "";
    const ids = new Set(l.map(t => t.id));
    const last = (pitches || []).filter(p => p.templateId && ids.has(p.templateId))
      .sort((a, b) => (b.createdAt || b.sentOn).localeCompare(a.createdAt || a.sentOn))[0];
    return last?.templateId || l[0].id;
  };
  const made = list.filter(t => cats(t).includes(category)), any = list.filter(t => !cats(t).length);
  const kinds = wantKind === "follow_up_2" ? ["follow_up_2", "follow_up", "pitch"] : wantKind === "follow_up" ? ["follow_up", "pitch"] : ["pitch"];
  for (const k of kinds) {
    const id = lastOf(made.filter(t => t.kind === k)) || lastOf(any.filter(t => t.kind === k)) || lastOf(list.filter(t => t.kind === k));
    if (id) return id;
  }
  return lastOf(made) || lastOf(any) || list[0]?.id || "";
}
// a template's kind as logged in the pitch log: a pitch, or a follow-up (Follow-up 1 and 2 are both follow-ups)
export const logKind = (t: EmailTemplate): "pitch" | "follow_up" => (t.kind === "pitch" ? "pitch" : "follow_up");
// a media kit's link from the Email kit ("" when it has none yet)
export const kitUrlOf = (kits: { key: string; url?: string }[] | undefined, k: string | null) =>
  (k ? String((kits || []).find(x => x.key === k)?.url || "").trim() : "");
