// ─────────────────────────────────────────────────────────────
// outlook — one Email kit template filled in for one contact,
// opened in Outlook with everything filled in (to, subject, text).
//   iPhone / iPad → the Outlook app (ms-outlook://compose)
//   Mac / computer → the standard email link (mailto:), which opens
//                    the default mail app — Outlook, once it's the default
// Nothing is sent from here: you check the email and press Send in Outlook.
// Placeholders in subject and text:
//   {name}    first name of the contact; no name → "Company team"
//   {company} the company
//   {kit}     the template's media kit link (no {kit} → the link goes at the end)
// ─────────────────────────────────────────────────────────────

import { fillText, KIT_TOKEN } from "./useEmailKit";

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

// iPhone and iPad (iPadOS says "Macintosh", but has a touch screen)
export const isAppleTouch = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && ((navigator as any).maxTouchPoints || 0) > 1);
};
const enc = encodeURIComponent;
const addr = (to: string) => String(to || "").trim().replace(/[^a-zA-Z0-9@._+-]/g, ch => enc(ch));

export function composeUrl(to: string, subject: string, body: string, appleTouch = isAppleTouch()): string {
  if (appleTouch) return `ms-outlook://compose?to=${addr(to)}&subject=${enc(subject)}&body=${enc(body)}`;
  // mailto: line breaks as CR LF (the email-link standard)
  return `mailto:${addr(to)}?subject=${enc(subject)}&body=${enc(body.replace(/\r?\n/g, "\r\n"))}`;
}

// open it — in the tap itself (the iPhone only opens other apps from a tap)
export function openInOutlook(url: string) { window.location.href = url; }
