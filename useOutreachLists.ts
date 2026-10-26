// ─────────────────────────────────────────────────────────────
// useOutreachLists — Outreach › Setup: your contact categories and
// tiers (table outreach_lists) and the follow-up days (table
// outreach_settings). The whole app reads them through outreach.ts
// (one shared list, also kept on the device, so it's there before the
// database answers). Before the Setup SQL has run, the built-in lists
// are used and Setup says so (read only).
//   add      a new category or tier — its key is made from the name and never changes
//   update   name · account · templates, in one server step (a category switched to UGC
//            turns its Gifted / Invited contacts into Replied, like one contact today)
//   move     one place up or down (Sort, like Email kit), saved right away
//   remove   one server step: its contacts move to your pick (a tier: or no tier),
//            templates and Planner sprints drop it, then it goes
//   setDays  one follow-up number (whole days, 1–365), saved right away
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { supabase } from "./useSupabase";
import { registerReloader } from "./saveStatus";
import {
  OUTREACH_CATEGORIES, OUTREACH_TIERS, CADENCE, DEFAULT_CATEGORIES, DEFAULT_TIERS, DEFAULT_CADENCE, CADENCE_MAX,
  setOutreachLists, resetOutreachLists, listsStore,
} from "./outreach";
import type { Cadence, Pipeline } from "./outreach";

export type ListKind = "category" | "tier";
export interface ListFields { label: string; account?: Pipeline; ownTemplates?: boolean; }
export const NAME_MAX = 40;

// every screen that keeps results worked out from the lists (useMemo) listens to this
export const useListsVersion = () => useSyncExternalStore(listsStore.subscribe, listsStore.version, listsStore.version);

// "Fine Jewelry" → fine_jewelry · "Café & Bar" → cafe_bar · unique on its list (bag, bag_2 …)
export function keyFor(label: string, taken: string[]): string {
  const base = String(label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "item";
  let k = base, i = 2;
  while (taken.includes(k)) k = `${base}_${i++}`;
  return k;
}
// one space between words, none at the ends
export const cleanName = (s: string) => String(s || "").trim().replace(/\s+/g, " ");

const WHO_KEY = "lh_outreach_lists_who";   // the login the lists on this device belong to
const isMissing = (e: any, name: string) => {
  const m = String(e?.message || "");
  return m.includes(name) && /exist|schema cache|relation|could not find/i.test(m);
};
const order = (a: any, b: any) => (Number(a.sort) || 0) - (Number(b.sort) || 0)
  || String(a.created_at || "").localeCompare(String(b.created_at || "")) || String(a.key).localeCompare(String(b.key));
const toLists = (rows: any[]) => ({
  categories: rows.filter(r => r.kind === "category").sort(order)
    .map(r => ({ key: r.key, label: r.label, account: r.account === "ugc" ? "ugc" : "lynnhoa", ownTemplates: r.own_templates === true })),
  tiers: rows.filter(r => r.kind === "tier").sort(order).map(r => ({ key: r.key, label: r.label })),
});
const toCadence = (r: any): Cadence | null => (r ? { fu1: r.fu1_days, fu2: r.fu2_days, close: r.close_days, repitch: r.repitch_days } : null);
// the first time for a login: the built-in lists (the Setup SQL does the same for every login)
const seedRows = (userId: string) => [
  ...DEFAULT_CATEGORIES.map((c, i) => ({ user_id: userId, kind: "category", key: c.key, label: c.label, sort: i + 1, account: c.account, own_templates: c.ownTemplates })),
  ...DEFAULT_TIERS.map((t, i) => ({ user_id: userId, kind: "tier", key: t.key, label: t.label, sort: i + 1 })),
];
// what the database says, in plain words
const plain = (e: any, fallback: string) => {
  const m = String(e?.message || "");
  if (/outreach_lists_one_name|outreach_lists_one_key|duplicate key/i.test(m)) return new Error("That name is already on the list.");
  if (isMissing(e, "outreach_list") || isMissing(e, "outreach_settings")) return new Error("Run the Setup SQL in Supabase once first.");
  return new Error(m || fallback);
};

export function useOutreachLists(userId: string | null) {
  const version = useListsVersion();
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [missing, setMissing]           = useState(false);   // no Setup SQL yet: built-in lists, read only
  const [timingMissing, setTimingMissing] = useState(false);  // the follow-up days table isn't there (yet)
  const rows = useRef<any[]>([]);                              // as stored (for the next free place)

  const select = () => supabase.from("outreach_lists").select("*").eq("user_id", userId).order("kind").order("sort").order("created_at");
  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    // a different login on this device: start from the built-in lists, not the last login's
    try { const who = localStorage.getItem(WHO_KEY); if (who && who !== userId) resetOutreachLists(); localStorage.setItem(WHO_KEY, userId); } catch { /* ignore */ }
    let res: any = await select();
    if (res?.error) {
      const gone = isMissing(res.error, "outreach_lists");
      setMissing(gone); setLoadError(gone ? null : res.error.message || "Your lists couldn't be loaded.");
      setLoading(false);
      return;
    }
    if (!(res?.data || []).length) {
      const ins: any = await supabase.from("outreach_lists").upsert(seedRows(userId), { onConflict: "user_id,kind,key", ignoreDuplicates: true });
      if (!ins?.error) res = await select();
    }
    const st: any = await supabase.from("outreach_settings").select("*").eq("user_id", userId).maybeSingle();
    rows.current = res?.data || [];
    const l = toLists(rows.current);
    setOutreachLists({ categories: l.categories, tiers: l.tiers, cadence: st?.error ? null : (toCadence(st?.data) || DEFAULT_CADENCE) });
    setTimingMissing(!!st?.error && isMissing(st.error, "outreach_settings"));
    setMissing(false); setLoadError(null); setLoading(false);
  }, [userId]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => registerReloader(() => { load(); }), [load]);

  const listOf = (kind: ListKind) => (kind === "category" ? OUTREACH_CATEGORIES : OUTREACH_TIERS);
  const check = (kind: ListKind, label: string, exceptKey?: string) => {
    if (!label) throw new Error("Please enter a name.");
    if (label.length > NAME_MAX) throw new Error(`Keep the name to ${NAME_MAX} characters.`);
    if (listOf(kind).some(x => x.key !== exceptKey && x.label.trim().toLowerCase() === label.toLowerCase())) throw new Error(`${label} is already on the list.`);
  };

  // a new category or tier, at the end of its list → its key
  const add = useCallback(async (kind: ListKind, f: ListFields): Promise<string> => {
    const label = cleanName(f.label);
    check(kind, label);
    const key = keyFor(label, listOf(kind).map(x => x.key));
    const sort = Math.max(0, ...rows.current.filter(r => r.kind === kind).map(r => Number(r.sort) || 0)) + 1;
    const row: any = { user_id: userId, kind, key, label, sort };
    if (kind === "category") { row.account = f.account === "ugc" ? "ugc" : "lynnhoa"; row.own_templates = !!f.ownTemplates; }
    const { error } = await supabase.from("outreach_lists").insert(row);
    if (error) throw plain(error, "Couldn't add it.");
    await load();
    return key;
  }, [userId, load]);   // eslint-disable-line react-hooks/exhaustive-deps

  // name · account · templates → how many contacts became Replied (category switched to UGC)
  const update = useCallback(async (kind: ListKind, key: string, f: ListFields): Promise<{ fitted: number }> => {
    const label = cleanName(f.label);
    check(kind, label, key);
    const { data, error } = await supabase.rpc("outreach_list_update", {
      p_kind: kind, p_key: key, p_label: label,
      p_account: kind === "category" ? (f.account === "ugc" ? "ugc" : "lynnhoa") : null,
      p_own: kind === "category" ? !!f.ownTemplates : null,
    });
    if (error) throw plain(error, "Couldn't save.");
    await load();
    return { fitted: Number(data?.fitted) || 0 };
  }, [load]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Sort: one place up (-1) or down (+1) — shown at once, saved in one step
  const move = useCallback(async (kind: ListKind, index: number, dir: -1 | 1) => {
    const before = listOf(kind).map(x => ({ ...x }));
    const j = index + dir;
    if (index < 0 || j < 0 || j >= before.length) return;
    const next = before.map(x => ({ ...x }));
    [next[index], next[j]] = [next[j], next[index]];
    setOutreachLists(kind === "category" ? { categories: next } : { tiers: next });
    const { error } = await supabase.rpc("outreach_list_order", { p_kind: kind, p_keys: next.map(x => x.key) });
    if (error) {
      setOutreachLists(kind === "category" ? { categories: before } : { tiers: before });
      throw plain(error, "Couldn't save the order.");
    }
    const place = new Map(next.map((x, i) => [x.key, i + 1]));
    rows.current = rows.current.map(r => (r.kind === kind && place.has(r.key) ? { ...r, sort: place.get(r.key) } : r));
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // delete; its contacts move to moveTo (a tier: moveTo or no tier) → what changed
  const remove = useCallback(async (kind: ListKind, key: string, moveTo: string | null) => {
    const { data, error } = await supabase.rpc("outreach_list_remove", { p_kind: kind, p_key: key, p_move_to: moveTo || null });
    if (error) throw plain(error, "Couldn't delete.");
    await load();
    return { contacts: Number(data?.contacts) || 0, templates: Number(data?.templates) || 0, sprints: Number(data?.sprints) || 0, fitted: Number(data?.fitted) || 0 };
  }, [load]);

  // one follow-up number: every due date follows at once; back to the old number if it can't be saved
  const setDays = useCallback(async (field: keyof Cadence, n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > CADENCE_MAX) throw new Error(`Whole days from 1 to ${CADENCE_MAX}.`);
    const before = { ...CADENCE };
    setOutreachLists({ cadence: { [field]: n } });
    const { error } = await supabase.from("outreach_settings").upsert({
      user_id: userId, fu1_days: CADENCE.fu1, fu2_days: CADENCE.fu2, close_days: CADENCE.close, repitch_days: CADENCE.repitch,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) { setOutreachLists({ cadence: before }); throw plain(error, "Couldn't save the days."); }
  }, [userId]);

  return {
    version, loading, loadError, missing, timingMissing, reload: load,
    categories: OUTREACH_CATEGORIES, tiers: OUTREACH_TIERS, cadence: CADENCE,
    add, update, move, remove, setDays,
  };
}

export type OutreachListsHook = ReturnType<typeof useOutreachLists>;
