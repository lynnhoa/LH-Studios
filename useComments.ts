// ─────────────────────────────────────────────────────────────
// useComments — Outreach › Comments (table outreach_comments)
// Instagram comments to copy, one line each, in groups.
// Tap = copied and marked "used" for today (used_on = today); the next
// day it's fresh again by itself (no reset needed).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase, selectAll } from "./useSupabase";
import { registerReloader } from "./saveStatus";
import { today } from "./formatters";

export const DEFAULT_GROUP = "Universal";

export interface Comment { id: string; text: string; group: string; usedOn: string | null; createdAt: string; }

const rowToComment = (r: any): Comment => ({
  id: r.id, text: r.text ?? "", group: (r.grp ?? "").trim() || DEFAULT_GROUP,
  usedOn: r.used_on ? String(r.used_on).slice(0, 10) : null, createdAt: r.created_at ?? "",
});
const fail = (error: any) => { if (error) throw new Error(error.message || "Couldn't save."); };
const norm = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

export const usedToday = (c: Comment) => c.usedOn === today();

// pasted text → clean comments: one per line, bullets / numbers at the start removed,
// empty lines and comments already in the list (or twice in the paste) left out
export function parseLines(raw: string, existing: Comment[]): { fresh: string[]; doubles: number } {
  const have = new Set(existing.map(c => norm(c.text)));
  const fresh: string[] = [];
  let doubles = 0;
  raw.split(/\r?\n/).forEach(line => {
    const t = line.replace(/^\s*(?:[•*·–—-]|\d+[.)])\s*/, "").trim().replace(/\s+/g, " ");
    if (!t) return;
    if (have.has(norm(t))) { doubles++; return; }
    have.add(norm(t));
    fresh.push(t);
  });
  return { fresh, doubles };
}

export function useComments(userId: string | null) {
  const [comments,  setComments]  = useState<Comment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setComments([]); setLoading(false); return; }
    const res: any = await selectAll("outreach_comments", "*", q => q.eq("user_id", userId).order("created_at").order("id"));
    if (res?.error) {
      const missing = /outreach_comments/.test(res.error.message || "") && /exist|schema cache|relation/i.test(res.error.message || "");
      setLoadError(missing ? "The comments table doesn't exist yet — run the Comments SQL in Supabase once." : res.error.message);
    } else {
      setLoadError(null);
      setComments((res?.data || []).map(rowToComment));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => registerReloader(() => { load(); }), [load]);

  const addMany = useCallback(async (texts: string[], group: string) => {
    if (!texts.length) return 0;
    const g = group.trim() || DEFAULT_GROUP;
    const base = Date.now();
    // created_at one millisecond apart: the list keeps the order of the paste
    const rows = texts.map((text, i) => ({ user_id: userId, text, grp: g, created_at: new Date(base + i).toISOString() }));
    const { data, error } = await supabase.from("outreach_comments").insert(rows).select();
    fail(error);
    setComments(prev => [...prev, ...(data || []).map(rowToComment)]);
    return (data || []).length;
  }, [userId]);

  const update = useCallback(async (id: string, patch: { text?: string; group?: string }) => {
    const row: any = {};
    if (patch.text  !== undefined) row.text = patch.text.trim().replace(/\s+/g, " ");
    if (patch.group !== undefined) row.grp  = patch.group.trim() || DEFAULT_GROUP;
    const { data, error } = await supabase.from("outreach_comments").update(row).eq("id", id).eq("user_id", userId).select().single();
    fail(error);
    setComments(prev => prev.map(c => (c.id === id ? rowToComment(data) : c)));
  }, [userId]);

  // tap = copied → used today (shown at once; a failed save only loses the grey mark)
  const markUsed = useCallback(async (id: string) => {
    const d = today();
    setComments(prev => prev.map(c => (c.id === id ? { ...c, usedOn: d } : c)));
    await supabase.from("outreach_comments").update({ used_on: d }).eq("id", id).eq("user_id", userId);
  }, [userId]);

  const remove = useCallback(async (c: Comment) => {
    const { error } = await supabase.from("outreach_comments").delete().eq("id", c.id).eq("user_id", userId);
    fail(error);
    setComments(prev => prev.filter(x => x.id !== c.id));
  }, [userId]);

  // Undo: back exactly as it was (same id, group, place in the list)
  const restore = useCallback(async (c: Comment) => {
    const { data, error } = await supabase.from("outreach_comments")
      .insert({ id: c.id, user_id: userId, text: c.text, grp: c.group, used_on: c.usedOn, created_at: c.createdAt || new Date().toISOString() }).select().single();
    fail(error);
    setComments(prev => [...prev, rowToComment(data)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, [userId]);

  return { comments, loading, loadError, addMany, update, markUsed, remove, restore };
}

export type CommentsHook = ReturnType<typeof useComments>;
