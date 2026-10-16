// ─────────────────────────────────────────────────────────────
// PDFExport — html2canvas + jsPDF export logic
// Called by the document modal and the rate card preview.
// Captures the [data-pdf-page] elements inside `root` (or the page).
// ─────────────────────────────────────────────────────────────

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
// Loaded together with the app (not on demand): an app that stays open
// during an update could otherwise look for files that no longer exist.

function isMobileDevice(): boolean {
  return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// ── Shared, iPhone-safe PDF saving ───────────────────────────
// On phones a new tab must be opened DIRECTLY in the tap (before any
// waiting), otherwise the PDF is blocked. Call openPdfWindow() first,
// build the PDF, then deliverPdf() shows or downloads it.
export function openPdfWindow(): Window | null {
  return isMobileDevice() ? window.open("", "_blank") : null;
}

export async function pagesToPdf(pages: HTMLElement[], orientation: "portrait" | "landscape" = "portrait"): Promise<any> {
  const pdf  = new (jsPDF as any)({ orientation, unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = await (html2canvas as any)(pages[i], { scale: 2, useCORS: true, backgroundColor: "#faf9f7" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);
  }
  return pdf;
}

export function deliverPdf(pdf: any, filename: string, mw: Window | null) {
  if (mw) mw.location.href = pdf.output("bloburl") as string;
  else pdf.save(`${filename}.pdf`);
}

interface ExportOptions {
  preview:   any;
  type:      string;
  onStart:   () => void;
  onDone:    () => void;
  root?:     HTMLElement | null;   // only capture pages inside this element
  filename?: string;               // without .pdf
}

export async function exportPDF({ preview, type, onStart, onDone, root, filename }: ExportOptions): Promise<void> {
  const mw = openPdfWindow();

  const pages = Array.from(
    (root || document).querySelectorAll("[data-pdf-page]")
  ) as HTMLElement[];

  if (!pages.length) {
    mw?.close();
    return;
  }

  // Temporarily remove CSS transforms so html2canvas captures full resolution
  const savedTransforms = pages.map(p => p.style.transform);
  pages.forEach(p => { p.style.transform = "none"; });

  onStart();

  try {
    const pdf = await pagesToPdf(pages, "portrait");

    // ── Derive filename ───────────────────────────────────
    const dateStr   = (preview.date || new Date().toISOString().slice(0, 10)).replace(/-/g, "_");
    const derivedCNo = `CON-${(preview.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
    const derivedINo = preview.iNo || `INV-${(preview.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;

    const docNo =
      type === "contract"  ? derivedCNo  :
      type === "invoice"   ? derivedINo  :
      type === "renewal"   ? (preview.rNo || derivedINo) :
      type === "amendment" ? (preview.aNo || "AMD") :
      (preview.qNo || type);

    const fname = filename || `${dateStr} ${docNo}`;

    deliverPdf(pdf, fname, mw);
  } catch (err) {
    mw?.close();
    throw err;
  } finally {
    pages.forEach((p, i) => { p.style.transform = savedTransforms[i]; });
    onDone();
  }
}
