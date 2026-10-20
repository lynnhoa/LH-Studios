// ─────────────────────────────────────────────────────────────
// docFlow — how a document goes out, the same in every tab
//   Send to client (draft quote / contract / amendment): the phone's share sheet
//     opens with the PDF as the client gets it (no DRAFT mark); once it's shared,
//     the draft is marked sent. Closing the share sheet changes nothing.
//   Send to client (draft invoice): asked once — the invoice gets the next number
//     and is locked — then the share sheet. Only with a complete profile (checklist).
//   Share PDF (sent / signed / paid): the PDF as it is, nothing changes.
//   Share draft: a PDF of the draft, marked DRAFT, nothing changes.
// ─────────────────────────────────────────────────────────────

import { profileGaps, senderSnapshot, clientSnapshot, issueDates, countryKnown, reverseChargeGap, taxRule, docMoney } from "./docs";
import { today, fmtD } from "./formatters";
import type { DocView } from "./docs";

// Extra line for the Finalize question when the address is missing (info only)
export function addressNote(settings: any): string {
  const gaps = profileGaps(senderSnapshot(settings || {}));
  return gaps.includes("address")
    ? " Your address isn't filled in yet, so it won't be on this invoice (a complete German invoice needs it)."
    : "";
}

// Extra line when the invoice date moves to today (a draft from an earlier day)
export function dateNote(d: { docDate?: string | null; dueDate?: string | null } | null | undefined): string {
  if (!d) return "";
  const next = issueDates(d.docDate, d.dueDate ?? null);
  return next.docDate !== d.docDate ? ` Its date becomes today (${fmtD(next.docDate)}), due ${fmtD(next.dueDate)}.` : "";
}

// Extra line when the client's country isn't recognised for VAT (worked out as for Germany)
export function countryNote(client: any): string {
  const c = String(client?.country || "").trim();
  return c && !countryKnown(c)
    ? ` The client's country "${c}" isn't recognised, so VAT is worked out as for Germany — check the country on the client page first.`
    : "";
}

export const finalizeQuestion = (settings: any, d?: { docDate?: string | null; dueDate?: string | null } | null, client?: any) =>
  "This gives the invoice the next invoice number and locks it." + dateNote(d) + countryNote(client) + addressNote(settings);

const SEND_NAME: Record<string, string> = { quote: "quote", contract: "contract", amendment: "amendment" };
// (no longer asked: the share sheet is the confirmation — kept for older callers)
export const sendQuestion = (d: DocView): string | null =>
  d?.status === "draft" && SEND_NAME[d.kind] ? `This marks the ${SEND_NAME[d.kind]} as sent and locks it. Then you can share it.` : null;

// A saved draft quote / contract / amendment as the client gets it once it's sent:
// the same content, marked sent, with sender and client frozen in — exactly what
// markDocSent stores afterwards. Invoices need their number first (null);
// a document that isn't saved yet has no number either (null).
export function sentVersion(d: DocView, settings: any, client: any): DocView | null {
  if (!d) return null;
  if (d.status !== "draft") return d;
  if (d.kind === "invoice" || !d.id || !d.docNo) return null;
  // the same content, tax rule and totals markDocSent stores (so the shared PDF = the stored document)
  const data = { ...(d.data || {}), sender: senderSnapshot(settings || {}), client: clientSnapshot(client), tax: taxRule(settings, client) };
  const m = docMoney(d.kind, data, settings, client);
  return {
    ...d, status: "sent", sentAt: today(), data,
    net: m.net, vat: m.vat, gross: m.gross, vatRate: m.vatRate,
  } as DocView;
}

// what an invoice still needs before it gets its number (empty = ready)
export function invoiceGaps(settings: any): string[] {
  return profileGaps(senderSnapshot(settings || {}));
}

export function pdfFlow(h: any, clientId: string, projectId: string, settings: any) {
  const clientOf = () => (h?.clients || []).find((c: any) => c.id === clientId);
  return {
    // asked once before "Send to client" — only an invoice (it gets its number)
    confirmFor: (d: DocView): string | null =>
      d.kind === "invoice" && d.status === "draft" && d.subtype !== "storno" ? finalizeQuestion(settings, d, clientOf()) : null,
    // stops "Send to client" on a draft invoice while the profile misses something
    // (reverse charge: your USt-IdNr has to be on the invoice)
    blockFor: (d: DocView): string | null => {
      if (d.kind !== "invoice" || d.status !== "draft" || d.subtype === "storno") return null;
      const out: string[] = [];
      const gaps = invoiceGaps(settings);
      if (gaps.length) out.push(`Missing in your profile: ${gaps.join(", ")}. Add it under Profile, then send the invoice.`);
      const rc = reverseChargeGap(settings, clientOf());
      if (rc) out.push(rc);
      return out.length ? out.join(" ") : null;
    },
    // brings the document to its "sent" state (after sharing; an invoice before the PDF)
    prepare: async (d: DocView): Promise<DocView> => {
      if (d.status !== "draft" || !d.id) return d;
      if (d.kind === "invoice") return h.finalizeInvoice(clientId, projectId, d.id, settings);
      return h.markDocSent(clientId, projectId, d.id, settings);
    },
  };
}
