// ─────────────────────────────────────────────────────────────
// signedPdf — the client's signed copy of a contract or an
// amendment. Always stored as ONE PDF in the private file store:
//   one PDF picked        → kept as it is
//   photos picked         → one A4 page per photo, in the order
//                           picked (JPG, PNG, iPhone HEIC)
//   anything else / mixed → refused with a message
// Files sit at  <your id>/<project>/<document>/<time>.pdf  and
// open through a link that is valid for 10 minutes.
// ─────────────────────────────────────────────────────────────
import jsPDF from "jspdf";
import { supabase } from "./useSupabase";
import { fmtD } from "./formatters";
import { isMobileDevice } from "./PDFExport";

export const SIGNED_BUCKET = "signed-documents";
export const SIGNED_MAX = 20 * 1024 * 1024;           // 20 MB, the same limit as the file store
const MAX_SIDE = 2000;                                 // photos are shrunk to this (long side, px)

const isPdf   = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isPhoto = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif)$/i.test(f.name);

// pages of a PDF (best effort: compressed object streams can hide them → null)
async function pdfPages(f: Blob): Promise<number | null> {
  try {
    const text = await f.text();
    const n = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
    return n > 0 ? n : null;
  } catch { return null; }
}

// a photo as a JPEG, at most MAX_SIDE px (the browser turns iPhone HEIC and the camera angle the right way)
async function photoJpeg(f: File): Promise<{ data: string; w: number; h: number }> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error(`"${f.name}" couldn't be read — please choose a PDF, a JPG or a PNG.`));
      i.src = url;
    });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * k)), h = Math.max(1, Math.round((img.naturalHeight || 1) * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("The photo couldn't be turned into a PDF on this device.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: c.toDataURL("image/jpeg", 0.82), w, h };
  } finally { URL.revokeObjectURL(url); }
}

// The picked file(s) → one PDF (or a message why not)
export async function toSignedPdf(files: File[] | FileList | null | undefined): Promise<{ blob: Blob; pages: number | null }> {
  const list = Array.from(files || []);
  if (!list.length) throw new Error("Please choose a PDF or a photo.");
  if (list.some(isPdf)) {
    if (list.length > 1) throw new Error("Please choose one PDF — or photos, not both.");
    const f = list[0];
    if (f.size > SIGNED_MAX) throw new Error("The file is too big (max. 20 MB).");
    return { blob: f.type === "application/pdf" ? f : new Blob([f], { type: "application/pdf" }), pages: await pdfPages(f) };
  }
  if (!list.every(isPhoto)) throw new Error("Please choose a PDF or a photo.");
  let pdf: any = null;
  for (const f of list) {
    const { data, w, h } = await photoJpeg(f);
    const orient = w > h ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ unit: "pt", format: "a4", orientation: orient, compress: true });
    else pdf.addPage("a4", orient);
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 24;
    const k = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
    pdf.addImage(data, "JPEG", (pw - w * k) / 2, (ph - h * k) / 2, w * k, h * k);
  }
  const blob: Blob = pdf.output("blob");
  if (blob.size > SIGNED_MAX) throw new Error("The PDF is too big (max. 20 MB) — please choose fewer photos.");
  return { blob, pages: list.length };
}

// "Contract – Brand – 21.10.2026.pdf" · "Amendment AMD 02 – Brand – 21.10.2026.pdf"
export function signedName(doc: any, clientName: string): string {
  const what = doc?.kind === "amendment" ? `Amendment ${doc?.docNo ? `AMD ${String(doc.docNo).split("-").pop()}` : ""}`.trim() : "Contract";
  const safe = (t: string) => String(t || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return `${safe(what)} – ${safe(clientName) || "Client"} – ${fmtD(doc?.signedAt || doc?.signedFile?.at || "")}.pdf`.replace(" – .pdf", ".pdf");
}

// Open the stored copy. The window is opened in the same tap (the iPhone allows nothing later),
// then the 10-minute link is put into it. On the phone it comes with its file name (share / save).
export function openSignedCopy(doc: any, clientName: string): Promise<void> {
  const path = doc?.signedFile?.path;
  if (!path) return Promise.reject(new Error("There's no signed copy yet."));
  const win = window.open("", "_blank");
  const opts = isMobileDevice() ? { download: signedName(doc, clientName) } : undefined;
  return supabase.storage.from(SIGNED_BUCKET).createSignedUrl(path, 600, opts).then((r: any) => {
    if (r?.error || !r?.data?.signedUrl) throw new Error(r?.error?.message || "The signed copy couldn't be opened.");
    if (win) win.location.href = r.data.signedUrl; else window.location.href = r.data.signedUrl;
  }).catch((e: any) => { try { win?.close(); } catch { /* ignore */ } throw e; });
}
