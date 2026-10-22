// ─────────────────────────────────────────────────────────────
// useEmailKit — Outreach › Email kit
//   email_kits       the 4 media kits (Canva view links), one row per kit
//   email_templates  email texts to copy (purpose, subject, text, kit)
// The 4 kits are added by the app itself the first time (empty links).
// Nothing is sent from here: everything is only copied.
// Each kit can also hold ONE PDF (private file store, bucket media-kits,
// <your id>/<kit>/<time>.pdf) — to attach, never as a public link.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./useSupabase";
import { registerReloader } from "./saveStatus";
import { isMobileDevice } from "./PDFExport";

export const KIT_BUCKET = "media-kits";
export const KIT_PDF_MAX = 20 * 1024 * 1024;   // 20 MB, the same limit as the signed contracts

// key = the rate-card key, so each kit has the same colour as in the Service Catalog
export type KitKey = "influencer" | "editorial" | "hotels" | "ugc";

export const KITS: { key: KitKey; short: string; label: string; account: string; focus: string; file: string }[] = [
  { key: "influencer", short: "Collab",    label: "Brand collab",          account: "@lynnhoa", focus: "Fashion, Beauty & Lifestyle", file: "LH-COLLAB" },
  { key: "editorial",  short: "Editorial", label: "Editorial",             account: "@lynnhoa", focus: "Fashion, Beauty & Lifestyle", file: "LH-EDIT"   },
  { key: "hotels",     short: "Hotels",    label: "Hotels & Restaurants",  account: "@lynnhoa", focus: "Hospitality",                 file: "LH-HOSP"   },
  { key: "ugc",        short: "UGC",       label: "UGC",                   account: "General",  focus: "Fashion & Beauty",            file: "UGC"       },
];
export const kitInfo = (k?: string | null) => KITS.find(x => x.key === k);

// where the link goes inside a template text
export const KIT_TOKEN = "{kit}";

export interface KitPdf { path: string; name: string; size: number; updatedAt: string; }
export interface MediaKit { key: KitKey; url: string; file: string; focus: string; updatedAt: string; pdf: KitPdf | null; }
// pipeline: whose contacts it's for (UGC → @createbylynn, else @lynnhoa) · kind: a first pitch or a follow-up
export type TemplatePipeline = "lynnhoa" | "ugc";
export type TemplateKind = "pitch" | "follow_up" | "follow_up_2";   // follow_up = Follow-up 1
export interface EmailTemplate {
  id: string; name: string; purpose: string; subject: string; body: string; kit: KitKey | null; createdAt: string;
  pipeline: TemplatePipeline; kind: TemplateKind;
  categories: string[];   // the contact categories it's for (empty = any) — picks the right template per contact
  sortOrder: number | null; // your own order in the Email kit (empty = after the sorted ones, A–Z)
}
export const TEMPLATE_PIPELINES: { key: TemplatePipeline; label: string }[] = [{ key: "lynnhoa", label: "@lynnhoa" }, { key: "ugc", label: "UGC" }];
export const TEMPLATE_KINDS: { key: TemplateKind; label: string }[] = [{ key: "pitch", label: "Pitch" }, { key: "follow_up", label: "Follow-up 1" }, { key: "follow_up_2", label: "Follow-up 2" }];
export const kindLabel = (k: string) => TEMPLATE_KINDS.find(x => x.key === k)?.label || "Pitch";

const rowToKit = (r: any): MediaKit => {
  const d = kitInfo(r.key)!;
  return { key: r.key, url: r.url ?? "", file: r.canva_file ?? d.file, focus: r.focus ?? d.focus, updatedAt: r.updated_at ?? "",
    pdf: r.pdf_path ? { path: r.pdf_path, name: r.pdf_name || "Media kit.pdf", size: Number(r.pdf_size) || 0, updatedAt: r.pdf_updated_at ?? "" } : null };
};
const rowToTpl = (r: any): EmailTemplate => ({
  id: r.id, name: r.name ?? "", purpose: r.purpose ?? "", subject: r.subject ?? "", body: r.body ?? "",
  kit: kitInfo(r.kit_key) ? r.kit_key : null, createdAt: r.created_at ?? "",
  pipeline: r.pipeline === "ugc" ? "ugc" : "lynnhoa", kind: r.kind === "follow_up" || r.kind === "follow_up_2" ? r.kind : "pitch",
  categories: Array.isArray(r.categories) ? r.categories : [],
  sortOrder: r.sort_order == null ? null : Number(r.sort_order),
});
// your Email kit order: sorted templates first, then the rest A–Z
const tplSort = (a: EmailTemplate, b: EmailTemplate) =>
  (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || (a.name || "").localeCompare(b.name || "", "de");
const fail = (error: any) => { if (error) throw new Error(error.message || "Couldn't save."); };

// "2,4 MB" · "380 KB" (German format)
export const fmtSize = (b: number) => b >= 1024 * 1024
  ? `${(b / 1024 / 1024).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`
  : `${Math.max(1, Math.round(b / 1024)).toLocaleString("de-DE")} KB`;

// the PDFs, fetched once while a window is open, so Share works in the same tap (iPhone)
const pdfCache = new Map<string, File>();

// the text to copy: the kit's link goes where {kit} is; no {kit} → the link goes at the end
export function fillText(body: string, url: string | null): string {
  const has = body.includes(KIT_TOKEN);
  if (!url) return has ? body.split(KIT_TOKEN).join("").replace(/[ \t]+\n/g, "\n").trim() : body.trim();
  return has ? body.split(KIT_TOKEN).join(url).trim() : `${body.trim()}\n\n${url}`;
}

export function useEmailKit(userId: string | null) {
  const [kits,      setKits]      = useState<MediaKit[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setKits([]); setTemplates([]); setLoading(false); return; }
    const [k, t]: any[] = await Promise.all([
      supabase.from("email_kits").select("*").eq("user_id", userId),
      supabase.from("email_templates").select("*").eq("user_id", userId).order("purpose").order("name"),
    ]);
    const err = k?.error || t?.error;
    if (err) {
      const missing = /email_(kits|templates)/.test(err.message || "") && /exist|schema cache|relation/i.test(err.message || "");
      setLoadError(missing ? "The Email kit tables don't exist yet — run the Email kit SQL in Supabase once." : err.message);
      setLoading(false);
      return;
    }
    setLoadError(null);
    let rows: any[] = k.data || [];
    // first time: add the 4 kits (empty links)
    const missingKits = KITS.filter(d => !rows.some(r => r.key === d.key));
    if (missingKits.length) {
      const add = missingKits.map(d => ({ user_id: userId, key: d.key, canva_file: d.file, focus: d.focus, url: "" }));
      const ins: any = await supabase.from("email_kits").upsert(add, { onConflict: "user_id,key", ignoreDuplicates: true }).select();
      if (!ins?.error) rows = [...rows, ...(ins.data || [])];
    }
    setKits(KITS.map(d => rows.find(r => r.key === d.key)).filter(Boolean).map(rowToKit));
    setTemplates((t.data || []).map(rowToTpl).sort(tplSort));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => registerReloader(() => { load(); }), [load]);

  // the "Edit links" window saves all 4 kits at once
  const saveKits = useCallback(async (next: MediaKit[]) => {
    const now = new Date().toISOString();
    const changed = next.filter(n => {
      const o = kits.find(x => x.key === n.key);
      return !o || o.url !== n.url.trim() || o.file !== n.file.trim() || o.focus !== n.focus.trim();
    });
    for (const n of changed) {
      const { error } = await supabase.from("email_kits")
        .update({ url: n.url.trim(), canva_file: n.file.trim(), focus: n.focus.trim(), updated_at: now })
        .eq("user_id", userId).eq("key", n.key);
      fail(error);
    }
    if (changed.length) setKits(prev => prev.map(p => { const c = changed.find(x => x.key === p.key); return c ? { ...p, url: c.url.trim(), file: c.file.trim(), focus: c.focus.trim(), updatedAt: now } : p; }));
  }, [kits, userId]);

  // ── PDFs ─────────────────────────────────────────────────────
  // upload (or replace): saved right away; the old file is removed afterwards
  const uploadPdf = useCallback(async (key: KitKey, f: File) => {
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) throw new Error("Please choose a PDF.");
    if (f.size > KIT_PDF_MAX) throw new Error("The PDF is bigger than 20 MB.");
    const old = kits.find(k => k.key === key)?.pdf;
    const path = `${userId}/${key}/${Date.now()}.pdf`;
    const up = await supabase.storage.from(KIT_BUCKET).upload(path, f, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(/bucket/i.test(up.error.message || "") ? "The PDF folder doesn't exist yet — run the media kit PDF SQL in Supabase once." : up.error.message);
    const now = new Date().toISOString();
    const pdf: KitPdf = { path, name: f.name, size: f.size, updatedAt: now };
    const { error } = await supabase.from("email_kits")
      .update({ pdf_path: path, pdf_name: f.name, pdf_size: f.size, pdf_updated_at: now }).eq("user_id", userId).eq("key", key);
    if (error) { await supabase.storage.from(KIT_BUCKET).remove([path]); fail(error); }
    if (old?.path) { pdfCache.delete(old.path); await supabase.storage.from(KIT_BUCKET).remove([old.path]); }
    pdfCache.set(path, new File([f], f.name, { type: "application/pdf" }));
    setKits(prev => prev.map(k => (k.key === key ? { ...k, pdf } : k)));
  }, [kits, userId]);

  const deletePdf = useCallback(async (key: KitKey) => {
    const old = kits.find(k => k.key === key)?.pdf;
    if (!old) return;
    const { error } = await supabase.from("email_kits")
      .update({ pdf_path: null, pdf_name: null, pdf_size: null, pdf_updated_at: null }).eq("user_id", userId).eq("key", key);
    fail(error);
    pdfCache.delete(old.path);
    await supabase.storage.from(KIT_BUCKET).remove([old.path]);
    setKits(prev => prev.map(k => (k.key === key ? { ...k, pdf: null } : k)));
  }, [kits, userId]);

  // fetch the PDFs in the background (call when a window opens)
  const preloadPdfs = useCallback((keys?: KitKey[]) => {
    kits.filter(k => k.pdf && (!keys || keys.includes(k.key)) && !pdfCache.has(k.pdf.path)).forEach(k => {
      const p = k.pdf!;
      supabase.storage.from(KIT_BUCKET).download(p.path).then((r: any) => {
        if (r?.data) pdfCache.set(p.path, new File([r.data], p.name, { type: "application/pdf" }));
      }).catch(() => { /* Share falls back to opening the file */ });
    });
  }, [kits]);

  // Share: phone → the share sheet with the PDF (attach in Mail, WhatsApp …);
  // computer, or not loaded yet → the file opens / downloads (10-minute link)
  const sharePdf = useCallback(async (key: KitKey): Promise<"shared" | "opened" | "cancelled"> => {
    const pdf = kits.find(k => k.key === key)?.pdf;
    if (!pdf) throw new Error("There's no PDF for this kit yet.");
    const file = pdfCache.get(pdf.path);
    const nav: any = navigator;
    if (file && isMobileDevice() && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file] }); return "shared"; }
      catch (e: any) { if (e?.name === "AbortError") return "cancelled"; /* else: open it instead */ }
    }
    const win = window.open("", "_blank");               // in the same tap (the iPhone allows nothing later)
    const r: any = await supabase.storage.from(KIT_BUCKET).createSignedUrl(pdf.path, 600, { download: pdf.name });
    if (r?.error || !r?.data?.signedUrl) { try { win?.close(); } catch { /* ignore */ } throw new Error(r?.error?.message || "The PDF couldn't be opened."); }
    if (win) win.location.href = r.data.signedUrl; else window.location.href = r.data.signedUrl;
    return "opened";
  }, [kits]);

  const tplRow = (f: Partial<EmailTemplate>) => {
    const row: any = { updated_at: new Date().toISOString() };
    if (f.name    !== undefined) row.name    = f.name.trim();
    if (f.purpose !== undefined) row.purpose = f.purpose.trim();
    if (f.subject !== undefined) row.subject = f.subject;
    if (f.body    !== undefined) row.body    = f.body;
    if (f.kit     !== undefined) row.kit_key = f.kit;
    if (f.pipeline !== undefined) row.pipeline = f.pipeline;
    if (f.kind     !== undefined) row.kind     = f.kind;
    if (f.categories !== undefined) row.categories = f.categories;
    return row;
  };
  // a new template goes to the end of your order
  const addTemplate = useCallback(async (f: EmailTemplate): Promise<EmailTemplate> => {
    const next = templates.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0) + 1;
    const { data, error } = await supabase.from("email_templates").insert({ user_id: userId, ...tplRow(f), sort_order: next }).select().single();
    fail(error);
    const n = rowToTpl(data);
    setTemplates(prev => [...prev, n].sort(tplSort));
    return n;
  }, [userId, templates]);
  // your own order (Email kit → Sort): every template gets its place 1, 2, 3 …
  const saveOrder = useCallback(async (ids: string[]) => {
    const place = new Map(ids.map((id, i) => [id, i + 1]));
    setTemplates(prev => prev.map(t => (place.has(t.id) ? { ...t, sortOrder: place.get(t.id)! } : t)).sort(tplSort));
    for (const [id, n] of place) {
      if (templates.find(t => t.id === id)?.sortOrder === n) continue;          // only what moved
      const { error } = await supabase.from("email_templates").update({ sort_order: n }).eq("id", id).eq("user_id", userId);
      fail(error);
    }
  }, [userId, templates]);
  const updateTemplate = useCallback(async (id: string, f: Partial<EmailTemplate>) => {
    const { data, error } = await supabase.from("email_templates").update(tplRow(f)).eq("id", id).eq("user_id", userId).select().single();
    fail(error);
    setTemplates(prev => prev.map(t => (t.id === id ? rowToTpl(data) : t)));
  }, [userId]);
  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from("email_templates").delete().eq("id", id).eq("user_id", userId);
    fail(error);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, [userId]);

  return { kits, templates, loading, loadError, saveKits, addTemplate, updateTemplate, deleteTemplate, saveOrder, uploadPdf, deletePdf, preloadPdfs, sharePdf };
}

export type EmailKitHook = ReturnType<typeof useEmailKit>;
