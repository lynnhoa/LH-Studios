// ─────────────────────────────────────────────────────────────
// PDFExport — html2canvas + jsPDF export logic
// Called by PDFModal download button.
// Captures all [data-pdf-page] elements in sequence.
// ─────────────────────────────────────────────────────────────

function isMobileDevice(): boolean {
  return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

interface ExportOptions {
  preview:  any;
  type:     string;
  onStart:  () => void;
  onDone:   () => void;
}

export async function exportPDF({ preview, type, onStart, onDone }: ExportOptions): Promise<void> {
  const mobile = isMobileDevice();
  const mw     = mobile ? window.open("", "_blank") : null;

  const pages = Array.from(
    document.querySelectorAll("[data-pdf-page]")
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
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const pdf  = new (jsPDF as any)({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage();
      const canvas = await (html2canvas as any)(pages[i], {
        scale:           2,
        useCORS:         true,
        backgroundColor: "#faf9f7",
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);
    }

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

    const fname = `${dateStr} ${docNo}`;

    if (mw) {
      mw.location.href = pdf.output("bloburl") as string;
    } else {
      pdf.save(`${fname}.pdf`);
    }
  } finally {
    pages.forEach((p, i) => { p.style.transform = savedTransforms[i]; });
    onDone();
  }
}
