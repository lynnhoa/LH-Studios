// ─────────────────────────────────────────────────────────────
// useEmailKit — Outreach › Email kit
//   email_kits       the 4 media kits (Canva view links), one row per kit
//   email_templates  email texts to copy (purpose, subject, text, kit)
// The 4 kits are added by the app itself the first time (empty links).
// Nothing is sent from here: everything is only copied.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./useSupabase";
import { registerReloader } from "./saveStatus";

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

export interface MediaKit { key: KitKey; url: string; file: string; focus: string; updatedAt: string; }
export interface EmailTemplate {
  id: string; name: string; purpose: string; subject: string; body: string; kit: KitKey | null; createdAt: string;
}

const rowToKit = (r: any): MediaKit => {
  const d = kitInfo(r.key)!;
  return { key: r.key, url: r.url ?? "", file: r.canva_file ?? d.file, focus: r.focus ?? d.focus, updatedAt: r.updated_at ?? "" };
};
const rowToTpl = (r: any): EmailTemplate => ({
  id: r.id, name: r.name ?? "", purpose: r.purpose ?? "", subject: r.subject ?? "", body: r.body ?? "",
  kit: kitInfo(r.kit_key) ? r.kit_key : null, createdAt: r.created_at ?? "",
});
const fail = (error: any) => { if (error) throw new Error(error.message || "Couldn't save."); };

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
    setTemplates((t.data || []).map(rowToTpl));
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
    if (changed.length) setKits(prev => prev.map(p => { const c = changed.find(x => x.key === p.key); return c ? { ...c, url: c.url.trim(), file: c.file.trim(), focus: c.focus.trim(), updatedAt: now } : p; }));
  }, [kits, userId]);

  const tplRow = (f: Partial<EmailTemplate>) => {
    const row: any = { updated_at: new Date().toISOString() };
    if (f.name    !== undefined) row.name    = f.name.trim();
    if (f.purpose !== undefined) row.purpose = f.purpose.trim();
    if (f.subject !== undefined) row.subject = f.subject;
    if (f.body    !== undefined) row.body    = f.body;
    if (f.kit     !== undefined) row.kit_key = f.kit;
    return row;
  };
  const addTemplate = useCallback(async (f: EmailTemplate): Promise<EmailTemplate> => {
    const { data, error } = await supabase.from("email_templates").insert({ user_id: userId, ...tplRow(f) }).select().single();
    fail(error);
    const n = rowToTpl(data);
    setTemplates(prev => [...prev, n]);
    return n;
  }, [userId]);
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

  return { kits, templates, loading, loadError, saveKits, addTemplate, updateTemplate, deleteTemplate };
}

export type EmailKitHook = ReturnType<typeof useEmailKit>;
