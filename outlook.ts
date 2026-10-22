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
import { pipelineOf } from "./outreach";
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
// the templates a contact can be written with: same account (UGC → @createbylynn, else @lynnhoa)
export const templatesFor = (templates: EmailTemplate[], category: string) =>
  (templates || []).filter(t => t.pipeline === pipelineOf(category)).sort(byTemplateOrder);
// preselected: one made for the contact's category (else one for any category), of the kind needed
// (follow-up when one is due, else pitch) — the one used last, else the first in your order
export function pickTemplate(list: EmailTemplate[], category: string, wantKind: "pitch" | "follow_up", pitches: Pitch[]): string {
  const cats = (t: EmailTemplate) => t.categories || [];
  const lastOf = (l: EmailTemplate[]) => {
    if (!l.length) return "";
    const ids = new Set(l.map(t => t.id));
    const last = (pitches || []).filter(p => p.templateId && ids.has(p.templateId))
      .sort((a, b) => (b.createdAt || b.sentOn).localeCompare(a.createdAt || a.sentOn))[0];
    return last?.templateId || l[0].id;
  };
  const made = list.filter(t => cats(t).includes(category)), any = list.filter(t => !cats(t).length);
  return lastOf(made.filter(t => t.kind === wantKind)) || lastOf(any.filter(t => t.kind === wantKind))
    || lastOf(made) || lastOf(any) || lastOf(list.filter(t => t.kind === wantKind)) || list[0]?.id || "";
}
// a media kit's link from the Email kit ("" when it has none yet)
export const kitUrlOf = (kits: { key: string; url?: string }[] | undefined, k: string | null) =>
  (k ? String((kits || []).find(x => x.key === k)?.url || "").trim() : "");
