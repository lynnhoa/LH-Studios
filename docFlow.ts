// ─────────────────────────────────────────────────────────────
// docFlow — what "Save PDF" does to a document, the same in every tab
//   draft quote / contract / amendment → marked sent, then the PDF
//   draft invoice → (after one confirm) finalized with its number, then the PDF
//   anything already sent / signed / paid → the PDF as it is
// So a PDF never says DRAFT, and what the client gets is what's stored.
// "Draft PDF" makes a PDF of a draft (marked DRAFT) and changes nothing.
// "Send…" asks once, brings the draft to "sent" (an invoice gets its number) and
// then offers Share. An invoice is only numbered when the profile has name,
// address, tax number and IBAN (the checklist).
// ─────────────────────────────────────────────────────────────

import { profileGaps, senderSnapshot } from "./docs";
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
// asked once before "Send…" on a draft quote / contract / amendment
export const sendQuestion = (d: DocView): string | null =>
  d?.status === "draft" && SEND_NAME[d.kind] ? `This marks the ${SEND_NAME[d.kind]} as sent and locks it. Then you can share it.` : null;

// what an invoice still needs before it gets its number (empty = ready)
export function invoiceGaps(settings: any): string[] {
  return profileGaps(senderSnapshot(settings || {}));
}

export function pdfFlow(h: any, clientId: string, projectId: string, settings: any) {
  return {
    // asked once before "Send…"
    confirmFor: (d: DocView): string | null =>
      d.kind === "invoice" && d.status === "draft" && d.subtype !== "storno" ? finalizeQuestion(settings) : sendQuestion(d),
    // stops "Send…" on a draft invoice while the profile misses something
    blockFor: (d: DocView): string | null => {
      if (d.kind !== "invoice" || d.status !== "draft" || d.subtype === "storno") return null;
      const gaps = invoiceGaps(settings);
      return gaps.length ? `Missing in your profile: ${gaps.join(", ")}. Add it under Profile, then send the invoice.` : null;
    },
    // brings the document to its "sent" state before the PDF
    prepare: async (d: DocView): Promise<DocView> => {
      if (d.status !== "draft" || !d.id) return d;
      if (d.kind === "invoice") return h.finalizeInvoice(clientId, projectId, d.id, settings);
      return h.markDocSent(clientId, projectId, d.id, settings);
    },
  };
}
