// ─────────────────────────────────────────────────────────────
// docFlow — what "Save PDF" does to a document, the same in every tab
//   draft quote / contract / amendment → marked sent, then the PDF
//   draft invoice → (after one confirm) finalized with its number, then the PDF
//   anything already sent / signed / paid → the PDF as it is
// So a PDF never says DRAFT, and what the client gets is what's stored.
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

export function pdfFlow(h: any, clientId: string, projectId: string, settings: any) {
  return {
    // asked once before the PDF is made (only draft invoices)
    confirmFor: (d: DocView): string | null =>
      d.kind === "invoice" && d.status === "draft" && d.subtype !== "storno" ? finalizeQuestion(settings) : null,
    // brings the document to its "sent" state before the PDF
    prepare: async (d: DocView): Promise<DocView> => {
      if (d.status !== "draft" || !d.id) return d;
      if (d.kind === "invoice") return h.finalizeInvoice(clientId, projectId, d.id, settings);
      return h.markDocSent(clientId, projectId, d.id, settings);
    },
  };
}
