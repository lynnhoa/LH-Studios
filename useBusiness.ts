// ─────────────────────────────────────────────────────────────
// useBusiness — the Business app's data (tables biz_categories ·
// biz_cases · biz_costs, files in the private folder business-receipts).
// A receipt's file is always ONE PDF (photos become pages, like the
// signed copies): <your id>/<cost id>/<time>.pdf, opened through a
// link that is valid for 10 minutes. A trip's / event's report photos:
// <your id>/cases/<case id>/<time>.jpg (shrunk to 1600 px, JPEG).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase, selectAll } from "./useSupabase";
import { registerReloader } from "./saveStatus";
import { toSignedPdf } from "./signedPdf";
import { isMobileDevice } from "./PDFExport";
import { fmtD } from "./formatters";
import { catFromRow, costFromRow, caseFromRow, costToRow, caseToRow, catToRow, BIZ_BUCKET } from "./business";
import type { BizCategory, BizCost, BizCase } from "./business";

const fail = (error: any) => { if (error) throw new Error(error.message || "Couldn't save."); };
const MISSING = "The Business tables don't exist yet — run the Business SQL in Supabase once.";
const safe = (t: string) => String(t || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

// report photos: fetched once per session (the report window and the PDF use them)
const photoCache = new Map<string, Blob>();
export async function photoBlob(path: string): Promise<Blob | null> {
  if (photoCache.has(path)) return photoCache.get(path)!;
  const r: any = await supabase.storage.from(BIZ_BUCKET).download(path);
  if (r?.error || !r?.data) return null;
  photoCache.set(path, r.data);
  return r.data;
}
// a photo as a JPEG of at most 1600 px (the browser turns iPhone HEIC and the camera angle the right way)
async function toJpeg(f: File): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error(`"${f.name}" couldn't be read — please choose a JPG, PNG or iPhone photo.`));
      i.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * k)), h = Math.max(1, Math.round((img.naturalHeight || 1) * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("The photo couldn't be prepared on this device.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) throw new Error("The photo couldn't be prepared on this device.");
    return { blob, w, h };
  } finally { URL.revokeObjectURL(url); }
}

export function useBusiness(userId: string | null) {
  const [cats,  setCats]  = useState<BizCategory[]>([]);
  const [cases, setCases] = useState<BizCase[]>([]);
  const [costs, setCosts] = useState<BizCost[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing,   setMissing]   = useState(false);
  const [closed,    setClosed]    = useState<number[]>([]);     // closed years (their numbers are kept)

  const load = useCallback(async () => {
    if (!userId) { setCats([]); setCases([]); setCosts([]); setLoading(false); return; }
    const [a, b, c]: any[] = await Promise.all([
      selectAll("biz_categories", "*", q => q.eq("user_id", userId).order("sort").order("name").order("id")),
      selectAll("biz_cases",      "*", q => q.eq("user_id", userId).order("start_date").order("created_at").order("id")),
      selectAll("biz_costs",      "*", q => q.eq("user_id", userId).order("date").order("created_at").order("id")),
    ]);
    const err = a?.error || b?.error || c?.error;
    if (err) {
      const miss = /biz_/.test(err.message || "") && /exist|schema cache|relation/i.test(err.message || "");
      setMissing(miss);
      setLoadError(miss ? MISSING : err.message || "Couldn't load.");
    } else {
      setMissing(false); setLoadError(null);
      setCats((a?.data || []).map(catFromRow));
      setCases((b?.data || []).map(caseFromRow));
      setCosts((c?.data || []).map(costFromRow));
    }
    // closed years — a missing table (build-4 SQL not run yet) just means none
    const y: any = await supabase.from("biz_years").select("year").eq("user_id", userId);
    setClosed(y?.error ? [] : (y?.data || []).map((r: any) => Number(r.year)).filter(Boolean));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => registerReloader(() => { load(); }), [load]);

  // ── Costs ──────────────────────────────────────────────────
  const addCost = useCallback(async (draft: Partial<BizCost>): Promise<BizCost> => {
    const { data, error } = await supabase.from("biz_costs").insert({ user_id: userId, ...costToRow(draft) }).select().single();
    fail(error);
    const cost = costFromRow(data);
    setCosts(prev => [...prev, cost]);
    return cost;
  }, [userId]);

  const updateCost = useCallback(async (id: string, patch: Partial<BizCost>): Promise<BizCost> => {
    const row = { ...costToRow(patch), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("biz_costs").update(row).eq("id", id).eq("user_id", userId).select().single();
    fail(error);
    const cost = costFromRow(data);
    setCosts(prev => prev.map(c => (c.id === id ? cost : c)));
    return cost;
  }, [userId]);

  // the row and its file; a return that pointed to it stays, without the link
  const removeCost = useCallback(async (cost: BizCost) => {
    const { error } = await supabase.from("biz_costs").delete().eq("id", cost.id).eq("user_id", userId);
    fail(error);
    if (cost.filePath) await supabase.storage.from(BIZ_BUCKET).remove([cost.filePath]);
    setCosts(prev => prev.filter(c => c.id !== cost.id).map(c => (c.returnOf === cost.id ? { ...c, returnOf: null } : c)));
  }, [userId]);

  // ── The receipt's file (one PDF) ───────────────────────────
  const attachFile = useCallback(async (cost: BizCost, files: FileList | File[]): Promise<BizCost> => {
    const list = Array.from(files || []);
    const { blob, pages } = await toSignedPdf(list);
    const pdfPicked = list.length === 1 && (list[0].type === "application/pdf" || /\.pdf$/i.test(list[0].name));
    const name = pdfPicked ? list[0].name : `Receipt ${safe(cost.vendor || cost.what)} ${fmtD(cost.date)}.pdf`.replace(/\s+/g, " ");
    const path = `${userId}/${cost.id}/${Date.now()}.pdf`;
    const up = await supabase.storage.from(BIZ_BUCKET).upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(/bucket/i.test(up.error.message || "") ? "The receipt folder doesn't exist yet — run the Business SQL in Supabase once." : up.error.message);
    const { data, error } = await supabase.from("biz_costs")
      .update({ file_path: path, file_name: name, file_pages: pages, updated_at: new Date().toISOString() })
      .eq("id", cost.id).eq("user_id", userId).select().single();
    if (error) { await supabase.storage.from(BIZ_BUCKET).remove([path]); fail(error); }
    if (cost.filePath) await supabase.storage.from(BIZ_BUCKET).remove([cost.filePath]);
    const next = costFromRow(data);
    setCosts(prev => prev.map(c => (c.id === cost.id ? next : c)));
    return next;
  }, [userId]);

  const removeFile = useCallback(async (cost: BizCost) => {
    if (!cost.filePath) return;
    const { data, error } = await supabase.from("biz_costs")
      .update({ file_path: null, file_name: null, file_pages: null, updated_at: new Date().toISOString() })
      .eq("id", cost.id).eq("user_id", userId).select().single();
    fail(error);
    await supabase.storage.from(BIZ_BUCKET).remove([cost.filePath]);
    const next = costFromRow(data);
    setCosts(prev => prev.map(c => (c.id === cost.id ? next : c)));
  }, [userId]);

  // the window opens in the same tap (the iPhone allows nothing later), then the 10-minute link goes into it
  const openFile = useCallback((cost: BizCost): Promise<void> => {
    if (!cost.filePath) return Promise.reject(new Error("There's no file yet."));
    const win = window.open("", "_blank");
    const opts = isMobileDevice() ? { download: cost.fileName || "Receipt.pdf" } : undefined;
    return supabase.storage.from(BIZ_BUCKET).createSignedUrl(cost.filePath, 600, opts).then((r: any) => {
      if (r?.error || !r?.data?.signedUrl) throw new Error(r?.error?.message || "The file couldn't be opened.");
      if (win) win.location.href = r.data.signedUrl; else window.location.href = r.data.signedUrl;
    }).catch((e: any) => { try { win?.close(); } catch { /* ignore */ } throw e; });
  }, []);

  // ── Trips · events ─────────────────────────────────────────
  const addCase = useCallback(async (draft: Partial<BizCase>): Promise<BizCase> => {
    const { data, error } = await supabase.from("biz_cases").insert({ user_id: userId, ...caseToRow(draft) }).select().single();
    fail(error);
    const x = caseFromRow(data);
    setCases(prev => [...prev, x]);
    return x;
  }, [userId]);

  const updateCase = useCallback(async (id: string, patch: Partial<BizCase>): Promise<BizCase> => {
    const row = { ...caseToRow(patch), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("biz_cases").update(row).eq("id", id).eq("user_id", userId).select().single();
    fail(error);
    const x = caseFromRow(data);
    setCases(prev => prev.map(c => (c.id === id ? x : c)));
    return x;
  }, [userId]);

  // the trip / event, its receipts (the database removes them with it) and every file of both
  const removeCase = useCallback(async (x: BizCase) => {
    const files = [
      ...costs.filter(c => c.caseId === x.id && c.filePath).map(c => c.filePath as string),
      ...((x.report?.photos || []) as any[]).map(p => p.path).filter(Boolean),
    ];
    const { error } = await supabase.from("biz_cases").delete().eq("id", x.id).eq("user_id", userId);
    fail(error);
    if (files.length) await supabase.storage.from(BIZ_BUCKET).remove(files);
    const gone = new Set(costs.filter(c => c.caseId === x.id).map(c => c.id));
    setCases(prev => prev.filter(c => c.id !== x.id));
    setCosts(prev => prev.filter(c => !gone.has(c.id)).map(c => (c.returnOf && gone.has(c.returnOf) ? { ...c, returnOf: null } : c)));
  }, [userId, costs]);

  // report photos: shrunk on the phone, saved right away, listed in the report
  const addPhotos = useCallback(async (x: BizCase, files: FileList | File[]): Promise<BizCase> => {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif)$/i.test(f.name));
    if (!list.length) throw new Error("Please choose photos.");
    const added: any[] = [];
    for (let i = 0; i < list.length; i++) {
      const jpg = await toJpeg(list[i]);
      const path = `${userId}/cases/${x.id}/${Date.now()}-${i}.jpg`;
      const up = await supabase.storage.from(BIZ_BUCKET).upload(path, jpg.blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) {
        if (added.length) await supabase.storage.from(BIZ_BUCKET).remove(added.map(a => a.path));
        throw new Error(/bucket/i.test(up.error.message || "") ? "The receipt folder doesn't exist yet — run the Business SQL in Supabase once." : up.error.message);
      }
      photoCache.set(path, jpg.blob);
      added.push({ path, w: jpg.w, h: jpg.h });
    }
    const report = { ...(x.report || {}), photos: [...((x.report?.photos || []) as any[]), ...added] };
    try { return await updateCase(x.id, { report }); }
    catch (e) { await supabase.storage.from(BIZ_BUCKET).remove(added.map(a => a.path)); throw e; }
  }, [userId, updateCase]);

  const removePhoto = useCallback(async (x: BizCase, path: string): Promise<BizCase> => {
    const report = { ...(x.report || {}), photos: ((x.report?.photos || []) as any[]).filter(p => p.path !== path) };
    const next = await updateCase(x.id, { report });
    await supabase.storage.from(BIZ_BUCKET).remove([path]);
    photoCache.delete(path);
    return next;
  }, [updateCase]);

  // ── Close year: its numbers are written onto its rows (one database call) ──
  const NEED4 = "Run the Business SQL for Close year (build 4) in Supabase once.";
  const setNumbers = useCallback(async (list: { costs: { id: string; no: string | null }[]; cases: { id: string; no: string | null }[] }) => {
    const r: any = await supabase.rpc("biz_set_numbers", { p_costs: list.costs, p_cases: list.cases });
    if (r?.error) throw new Error(/biz_set_numbers|function|schema cache/i.test(r.error.message || "") ? NEED4 : r.error.message);
    const c = new Map(list.costs.map(x => [x.id, x.no])), k = new Map(list.cases.map(x => [x.id, x.no]));
    setCosts(prev => prev.map(x => (c.has(x.id) ? { ...x, noFrozen: c.get(x.id) || null } : x)));
    setCases(prev => prev.map(x => (k.has(x.id) ? { ...x, noFrozen: k.get(x.id) || null } : x)));
  }, []);
  const closeYear = useCallback(async (year: number, list: { costs: { id: string; no: string | null }[]; cases: { id: string; no: string | null }[] }) => {
    await setNumbers(list);
    const { error } = await supabase.from("biz_years").insert({ user_id: userId, year });
    if (error && !/duplicate/i.test(error.message || "")) {
      await setNumbers({ costs: list.costs.map(x => ({ id: x.id, no: null })), cases: list.cases.map(x => ({ id: x.id, no: null })) });
      throw new Error(/biz_years/.test(error.message || "") ? NEED4 : error.message);
    }
    setClosed(prev => [...new Set([...prev, year])]);
  }, [userId, setNumbers]);
  const reopenYear = useCallback(async (year: number, ids: { costs: string[]; cases: string[] }) => {
    const { error } = await supabase.from("biz_years").delete().eq("user_id", userId).eq("year", year);
    fail(error);
    await setNumbers({ costs: ids.costs.map(id => ({ id, no: null })), cases: ids.cases.map(id => ({ id, no: null })) });
    setClosed(prev => prev.filter(y => y !== year));
  }, [userId, setNumbers]);

  // ── Categories (Setup) ─────────────────────────────────────
  const addCat = useCallback(async (draft: Partial<BizCategory>): Promise<BizCategory> => {
    const sort = Math.max(0, ...cats.map(c => c.sort)) + 1;
    const { data, error } = await supabase.from("biz_categories").insert({ user_id: userId, sort, ...catToRow(draft) }).select().single();
    fail(error);
    const cat = catFromRow(data);
    setCats(prev => [...prev, cat]);
    return cat;
  }, [userId, cats]);
  const updateCat = useCallback(async (id: string, patch: Partial<BizCategory>) => {
    const { data, error } = await supabase.from("biz_categories").update(catToRow(patch)).eq("id", id).eq("user_id", userId).select().single();
    fail(error);
    const cat = catFromRow(data);
    setCats(prev => prev.map(c => (c.id === id ? cat : c)));
  }, [userId]);
  // its receipts move to the category you pick first
  const removeCat = useCallback(async (id: string, moveTo: string | null) => {
    if (moveTo) {
      const { error } = await supabase.from("biz_costs").update({ category_id: moveTo, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("category_id", id);
      fail(error);
    }
    const { error } = await supabase.from("biz_categories").delete().eq("id", id).eq("user_id", userId);
    fail(error);
    setCosts(prev => prev.map(c => (c.categoryId === id ? { ...c, categoryId: moveTo } : c)));
    setCats(prev => prev.filter(c => c.id !== id));
  }, [userId]);
  // ↑ ↓: the two swap places (saved at once)
  const moveCat = useCallback(async (i: number, dir: -1 | 1) => {
    const list = [...cats].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    const sa = a.sort === b.sort ? i + 1 : a.sort, sb = a.sort === b.sort ? i + 1 + dir : b.sort;
    setCats(prev => prev.map(c => (c.id === a.id ? { ...c, sort: sb } : c.id === b.id ? { ...c, sort: sa } : c)));
    const r1 = await supabase.from("biz_categories").update({ sort: sb }).eq("id", a.id).eq("user_id", userId);
    const r2 = await supabase.from("biz_categories").update({ sort: sa }).eq("id", b.id).eq("user_id", userId);
    if (r1.error || r2.error) { load(); fail(r1.error || r2.error); }
  }, [cats, userId, load]);

  return { cats, cases, costs, loading, loadError, missing, closed, reload: load, addCost, updateCost, removeCost, attachFile, removeFile, openFile,
    addCase, updateCase, removeCase, addPhotos, removePhoto, closeYear, reopenYear, addCat, updateCat, removeCat, moveCat };
}

export type BusinessHook = ReturnType<typeof useBusiness>;
