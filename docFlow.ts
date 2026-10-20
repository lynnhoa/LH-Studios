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

import { profileGaps, senderSnapshot, clientSnapshot } from "./docs";
import { today } from "./formatters";
import type { DocView } from "./docs";

// Extra line for the Finalize question when the address is missing (info only)
export function addressNote(settings: any): string {
  const gaps = profileGaps(senderSnapshot(settings || {}));
  return gaps.includes("address")
    ? " Your address isn't filled in yet, so it won't be on this invoice (a complete German invoice needs it)."
    : "";
}

export const finalizeQuestion = (settings: any) =>
  "This gives the invoice the next invoice number and locks it." + addressNote(settings);

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
  return {
    ...d, status: "sent", sentAt: today(),
    data: { ...(d.data || {}), sender: senderSnapshot(settings || {}), client: clientSnapshot(client) },
  } as DocView;
}

// what an invoice still needs before it gets its number (empty = ready)
export function invoiceGaps(settings: any): string[] {
  return profileGaps(senderSnapshot(settings || {}));
}

export function pdfFlow(h: any, clientId: string, projectId: string, settings: any) {
  return {
    // asked once before "Send to client" — only an invoice (it gets its number)
    confirmFor: (d: DocView): string | null =>
      d.kind === "invoice" && d.status === "draft" && d.subtype !== "storno" ? finalizeQuestion(settings) : null,
    // stops "Send to client" on a draft invoice while the profile misses something
    blockFor: (d: DocView): string | null => {
      if (d.kind !== "invoice" || d.status !== "draft" || d.subtype === "storno") return null;
      const gaps = invoiceGaps(settings);
      return gaps.length ? `Missing in your profile: ${gaps.join(", ")}. Add it under Profile, then send the invoice.` : null;
    },
    // brings the document to its "sent" state (after sharing; an invoice before the PDF)
    prepare: async (d: DocView): Promise<DocView> => {
      if (d.status !== "draft" || !d.id) return d;
      if (d.kind === "invoice") return h.finalizeInvoice(clientId, projectId, d.id, settings);
      return h.markDocSent(clientId, projectId, d.id, settings);
    },
  };
}
