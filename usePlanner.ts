// ─────────────────────────────────────────────────────────────
// usePlanner — the Planner's data (tables planner_stages,
// planner_tasks, planner_entries, planner_snapshots, planner_items,
// planner_notes, planner_sprints) plus Outreach: contacts (new per
// week, status) and the pitch log. Rows that count themselves
// (contacts, pitches, ideas, posts, pieces, first set, kit
// handover) read from here.
// Ticks and numbers save right away; the app-wide toast shows
// Saving… / Saved ✓, and a failed save reloads what is stored.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, selectAll } from "./useSupabase";
import { registerReloader } from "./saveStatus";
import { today, monthStart, ymd } from "./formatters";
import {
  addDays, entryKey, snapKey, mondayOf, periodOf, rowState, taskAccounts, NO_DAYS, planOf,
} from "./planner";
import { daysBetween } from "./planner";
import type { Stage, Task, Entry, TaskStatus, Snapshot, Account, Item, ItemStatus, Note, NoteKind, Auto, Sprint, SprintStats } from "./planner";
import { FOLLOW_UP_DAYS } from "./outreach";
import type { Pitch } from "./outreach";

// an Outreach contact, as far as the Planner needs it
export interface NewContact { id: string; company: string; category: string; tier: string; status: string; lastContact: string | null; week: string; }

const rowToSprint = (r: any): Sprint => ({
  id: r.id, account: r.account, num: Number(r.num) || 1,
  startOn: String(r.start_on).slice(0, 10), endOn: String(r.end_on).slice(0, 10),
  focusCategory: r.focus_category ?? "", focusTier: r.focus_tier || "now",
  pitchGoal: r.pitch_goal ?? null, followUpGoal: r.follow_up_goal ?? null,
  review: r.review ?? "", status: r.status === "done" ? "done" : "active",
  days: r.days && typeof r.days === "object" ? r.days : {},
  results: r.results && typeof r.results === "object" ? r.results : {},
});
const sprintToRow = (p: Partial<Sprint>) => {
  const row: any = {};
  if (p.account       !== undefined) row.account        = p.account;
  if (p.num           !== undefined) row.num            = p.num;
  if (p.startOn       !== undefined) row.start_on       = p.startOn;
  if (p.endOn         !== undefined) row.end_on         = p.endOn;
  if (p.focusCategory !== undefined) row.focus_category = p.focusCategory;
  if (p.focusTier     !== undefined) row.focus_tier     = p.focusTier;
  if (p.pitchGoal     !== undefined) row.pitch_goal     = p.pitchGoal;
  if (p.followUpGoal  !== undefined) row.follow_up_goal = p.followUpGoal;
  if (p.review        !== undefined) row.review         = p.review;
  if (p.status        !== undefined) row.status         = p.status;
  if (p.days          !== undefined) row.days           = p.days;
  if (p.results       !== undefined) row.results        = p.results;
  return row;
};

const rowToStage = (r: any): Stage => ({
  id:          r.id,
  account:     r.account,
  num:         Number(r.num) || 1,
  shortName:   r.short_name ?? "",
  name:        r.name ?? "",
  goal:        r.goal ?? "",
  doneWhen:    r.done_when ?? "",
  status:      r.status ?? "upcoming",
  sprintWeeks: r.sprint_weeks ?? null,
  startedOn:   r.started_on ?? null,
  moved:       Array.isArray(r.moved) ? r.moved : [],
  doneOn:      r.done_on ?? null,
});

const rowToTask = (r: any): Task => ({
  id:       r.id,
  account:  r.account,
  stageNum: Number(r.stage_num) || 1,
  phase:    r.phase,
  owner:    r.owner,
  rhythm:   r.rhythm,
  area:     r.area ?? "other",
  title:    r.title ?? "",
  how:      r.how ?? "",
  doneWhen: r.done_when ?? "",
  measure:  r.measure || null,
  source:   r.source ?? "manual",
  target:   r.target ?? null,
  link:     r.link ?? "",
  status:   r.status ?? "open",
  doneOn:   r.done_on ?? null,
  sort:     Number(r.sort) || 0,
  active:   r.active !== false,
});

const rowToSnap = (r: any): Snapshot => ({
  id:         r.id,
  account:    r.account,
  weekStart:  String(r.week_start).slice(0, 10),
  followers:  r.followers ?? null,
  views:      r.views ?? null,
  engagement: r.engagement == null ? null : Number(r.engagement),
});

const rowToItem = (r: any): Item => ({
  id:          r.id,
  account:     r.account,
  list:        r.list,
  title:       r.title ?? "",
  format:      r.format ?? "",
  status:      r.status ?? "idea",
  plannedOn:   r.planned_on ? String(r.planned_on).slice(0, 10) : null,
  postedOn:    r.posted_on ? String(r.posted_on).slice(0, 10) : null,
  direction:   r.direction ?? "",
  plan:        planOf(r.plan),
  portfolio:   !!r.portfolio,
  link:        r.link ?? "",
  views:       r.views ?? null,
  sort:        Number(r.sort) || 0,
  createdAt:   r.created_at ?? "",
  createdWeek: mondayOf(ymd(r.created_at ? new Date(r.created_at) : new Date())),
});
const itemToRow = (p: Partial<Item>) => {
  const row: any = {};
  if (p.account   !== undefined) row.account    = p.account;
  if (p.list      !== undefined) row.list       = p.list;
  if (p.title     !== undefined) row.title      = p.title.trim();
  if (p.format    !== undefined) row.format     = p.format;
  if (p.status    !== undefined) row.status     = p.status;
  if (p.plannedOn !== undefined) row.planned_on = p.plannedOn || null;
  if (p.postedOn  !== undefined) row.posted_on  = p.postedOn || null;
  if (p.direction !== undefined) row.direction  = p.direction;
  if (p.plan      !== undefined) row.plan       = p.plan;
  if (p.portfolio !== undefined) row.portfolio  = p.portfolio;
  if (p.link      !== undefined) row.link       = p.link.trim();
  if (p.views     !== undefined) row.views      = p.views;
  return row;
};
const rowToNote = (r: any): Note => ({
  id: r.id, account: r.account, kind: r.kind, periodStart: r.period_start ? String(r.period_start).slice(0, 10) : null,
  title: r.title ?? "", body: r.body ?? "", link: r.link ?? "",
});

const rowToEntry = (r: any): Entry => ({
  id:          r.id,
  taskId:      r.task_id,
  periodStart: String(r.period_start).slice(0, 10),
  target:      r.target ?? null,
  actual:      r.actual ?? null,
  days:        Array.isArray(r.days) && r.days.length === 7 ? r.days.map(Boolean) : NO_DAYS,
  done:        !!r.done,
  data:        r.data || {},
  note:        r.note ?? "",
});

// Only the fields that are set go to the database
const taskToRow = (p: Partial<Task>) => {
  const row: any = {};
  if (p.account  !== undefined) row.account   = p.account;
  if (p.stageNum !== undefined) row.stage_num = p.stageNum;
  if (p.phase    !== undefined) row.phase     = p.phase;
  if (p.owner    !== undefined) row.owner     = p.owner;
  if (p.rhythm   !== undefined) row.rhythm    = p.rhythm;
  if (p.area     !== undefined) row.area      = p.area;
  if (p.title    !== undefined) row.title     = p.title.trim();
  if (p.how      !== undefined) row.how       = p.how;
  if (p.doneWhen !== undefined) row.done_when = p.doneWhen;
  if (p.measure  !== undefined) row.measure   = p.measure ? p.measure.trim() : null;
  if (p.target   !== undefined) row.target    = p.target;
  if (p.link     !== undefined) row.link      = p.link.trim();
  if (p.status   !== undefined) row.status    = p.status;
  if (p.doneOn   !== undefined) row.done_on   = p.doneOn;
  if (p.sort     !== undefined) row.sort      = p.sort;
  if (p.active   !== undefined) row.active    = p.active;
  return row;
};

const MISSING = "The Planner tables don't exist yet — run the Phase 1 SQL in Supabase once.";
const isMissing = (m: string) => /planner_/.test(m || "") && /exist|schema cache|relation/i.test(m || "");
const fail = (error: any) => { if (error) throw new Error(error.message || "Couldn't save."); };

export type EntryPatch = Partial<Pick<Entry, "target" | "actual" | "days" | "done" | "note" | "data">>;

// The periods whose entries are on screen (from … to). Day ticks and saved extras (data) are
// built from what's on screen, so they are only saved for a period that is really loaded —
// a week that's still loading shows empty and must not overwrite what's stored.
export type Loaded = { from: string; to: string } | null;
export const periodLoaded = (l: Loaded, period: string): boolean => !!l && period >= l.from && period <= l.to;
export const rebuildsFromScreen = (patch: EntryPatch): boolean => "days" in patch || "data" in patch;

export function usePlanner(userId: string | null, monday: string) {
  const [stages,    setStages]    = useState<Stage[]>([]);
  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [entries,   setEntries]   = useState<Record<string, Entry>>({});
  const [snaps,     setSnaps]     = useState<Record<string, Snapshot>>({});
  const [contacts,  setContacts]  = useState<NewContact[]>([]);
  const [items,     setItems]     = useState<Item[]>([]);
  const [notes,     setNotes]     = useState<Note[]>([]);
  const [pitches,   setPitches]   = useState<Pitch[]>([]);
  const [sprints,   setSprints]   = useState<Sprint[]>([]);
  const [stage2Error, setStage2Error] = useState<string | null>(null);
  // every target ever set (they carry over to the following weeks / months)
  const [targetLog, setTargetLog] = useState<Record<string, { p: string; v: number }[]>>({});
  const [loginEmail, setLoginEmail] = useState("");
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const tasksRef   = useRef(tasks);   tasksRef.current   = tasks;
  const stagesRef  = useRef(stages);  stagesRef.current  = stages;
  const entriesRef = useRef(entries); entriesRef.current = entries;
  // only the newest week load counts (switching weeks quickly: an older answer can arrive last)
  const entriesReq = useRef(0);
  const loadedRef  = useRef<Loaded>(null);                       // the periods whose entries are on screen
  const [loadedWeek, setLoadedWeek]     = useState<string | null>(null);
  const [targetsReady, setTargetsReady] = useState(false);       // the goal history is loaded

  // entries of this week, the 5 weeks before (the dashboard's 6-week bars, the history) and this month
  const back = addDays(monday, -35);
  const ms   = monthStart(monday);
  const from = back < ms ? back : ms;

  const loadBase = useCallback(async () => {
    if (!userId) { setStages([]); setTasks([]); setLoading(false); return; }
    const [s, t]: any[] = await Promise.all([
      supabase.from("planner_stages").select("*").eq("user_id", userId).order("account").order("num"),
      supabase.from("planner_tasks").select("*").eq("user_id", userId).order("sort").order("created_at"),
    ]);
    const err = s?.error || t?.error;
    if (err) setLoadError(isMissing(err.message) ? MISSING : err.message);
    else {
      setLoadError(null);
      setStages((s?.data || []).map(rowToStage));
      setTasks((t?.data || []).map(rowToTask));
    }
    setLoading(false);
  }, [userId]);

  const loadEntries = useCallback(async () => {
    if (!userId) { entriesReq.current++; loadedRef.current = null; setLoadedWeek(null); setEntries({}); setSnaps({}); return; }
    const my = ++entriesReq.current;
    const [res, sn]: any[] = await Promise.all([
      supabase.from("planner_entries").select("*").eq("user_id", userId).gte("period_start", from).lte("period_start", monday),
      // snapshots: 6 weeks back + 1 (the Overview's trend and "vs last week")
      supabase.from("planner_snapshots").select("*").eq("user_id", userId).gte("week_start", addDays(monday, -42) < addDays(from, -7) ? addDays(monday, -42) : addDays(from, -7)).lte("week_start", monday),
    ]);
    if (my !== entriesReq.current) return;      // a newer load (another week) is on its way: this answer is old
    const err = res?.error || sn?.error;
    if (err) { setLoadError(isMissing(err.message) ? MISSING : err.message); return; }
    const m: Record<string, Entry> = {};
    (res?.data || []).forEach((r: any) => { const e = rowToEntry(r); m[entryKey(e.taskId, e.periodStart)] = e; });
    setEntries(m);
    const k: Record<string, Snapshot> = {};
    (sn?.data || []).forEach((r: any) => { const x = rowToSnap(r); k[snapKey(x.account, x.weekStart)] = x; });
    setSnaps(k);
    loadedRef.current = { from, to: monday };
    setLoadedWeek(monday);
  }, [userId, from, monday]);

  // targets carry over: load all of them once (small)
  const loadTargets = useCallback(async () => {
    if (!userId) { setTargetLog({}); setTargetsReady(false); return; }
    // every goal ever set (page by page — this list grows every week)
    const res: any = await selectAll("planner_entries", "task_id, period_start, target",
      q => q.eq("user_id", userId).not("target", "is", null).order("period_start").order("id"));
    if (res?.error) return;
    const m: Record<string, { p: string; v: number }[]> = {};
    (res?.data || []).forEach((r: any) => { if (r.target == null) return; (m[r.task_id] ||= []).push({ p: String(r.period_start).slice(0, 10), v: Number(r.target) }); });
    Object.values(m).forEach(l => l.sort((x, y) => x.p.localeCompare(y.p)));
    setTargetLog(m);
    setTargetsReady(true);
  }, [userId]);
  useEffect(() => { loadTargets(); }, [loadTargets]);
  useEffect(() => {
    let cancelled = false;
    try { supabase.auth?.getSession?.().then((r: any) => { if (!cancelled) setLoginEmail(r?.data?.session?.user?.email || ""); }); } catch { /* no session info */ }
    return () => { cancelled = true; };
  }, [userId]);

  // Creator lists and notes, Outreach contacts and (Stage 2) the pitch log and sprints
  const loadOutside = useCallback(async () => {
    if (!userId) { setContacts([]); setItems([]); setNotes([]); setPitches([]); setSprints([]); return; }
    const [oc, it, nt, pl, sp]: any[] = await Promise.all([
      // lists that grow: every row, page by page (more than 1,000 is fine)
      selectAll("outreach_contacts", "id, company, category, tier, status, last_contact, created_at", q => q.eq("user_id", userId).order("id")),
      selectAll("planner_items", "*", q => q.eq("user_id", userId).order("created_at").order("id")),
      selectAll("planner_notes", "*", q => q.eq("user_id", userId).order("id")),
      selectAll("outreach_pitches", "id, contact_id, account, kind, sent_on", q => q.eq("user_id", userId).order("id")),
      supabase.from("planner_sprints").select("*").eq("user_id", userId).order("start_on"),
    ]);
    if (oc?.error) setOutreachError(oc.error.message);
    else {
      setOutreachError(null);
      setContacts((oc?.data || []).map((r: any) => ({
        id: r.id, company: r.company || "", category: r.category || "others", tier: r.tier || "now", status: r.status || "new",
        lastContact: r.last_contact ? String(r.last_contact).slice(0, 10) : null, week: mondayOf(ymd(new Date(r.created_at))),
      })));
    }
    // Stage 2 tables (Phase 6 SQL); without them the rest of the Planner still works
    const e2 = pl?.error || sp?.error;
    setStage2Error(e2 ? (/outreach_pitches|planner_sprints/.test(e2.message || "") ? "The sprint and pitch log tables don't exist yet — run the Phase 6 SQL in Supabase once." : e2.message) : null);
    if (!pl?.error) setPitches((pl?.data || []).map((r: any) => ({ id: r.id, contactId: r.contact_id, account: r.account, kind: r.kind === "follow_up" ? "follow_up" : "pitch", sentOn: String(r.sent_on).slice(0, 10) })));
    if (!sp?.error) setSprints((sp?.data || []).map(rowToSprint));
    const err = it?.error || nt?.error;
    if (err) setLoadError(isMissing(err.message) ? MISSING : err.message);
    else {
      setItems((it?.data || []).map(rowToItem));
      setNotes((nt?.data || []).map(rowToNote));
    }
  }, [userId, from]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { loadOutside(); }, [loadOutside]);
  useEffect(() => registerReloader(() => { loadBase(); loadEntries(); loadOutside(); loadTargets(); }), [loadBase, loadEntries, loadOutside, loadTargets]);

  // ── tasks ───────────────────────────────────────────────────
  const setTaskStatus = useCallback(async (t: Task, status: TaskStatus) => {
    const doneOn = status === "done" ? today() : null;
    setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, status, doneOn } : x)));
    const { error } = await supabase.from("planner_tasks").update({ status, done_on: doneOn }).eq("id", t.id).eq("user_id", userId);
    fail(error);
  }, [userId]);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    const { error } = await supabase.from("planner_tasks").update(taskToRow(patch)).eq("id", id).eq("user_id", userId);
    fail(error);
    setTasks(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
  }, [userId]);

  const createTask = useCallback(async (fields: Partial<Task>): Promise<Task> => {
    const sort = tasksRef.current.reduce((m, t) => Math.max(m, t.sort), 0) + 1;
    const { data, error } = await supabase.from("planner_tasks").insert({ ...taskToRow(fields), sort }).select().single();
    fail(error);
    const t = rowToTask(data);
    setTasks(prev => [...prev, t]);
    return t;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from("planner_tasks").delete().eq("id", id).eq("user_id", userId);
    fail(error);
    setTasks(prev => prev.filter(x => x.id !== id));
    setEntries(prev => {
      const m = { ...prev };
      Object.keys(m).forEach(k => { if (k.startsWith(id + "|")) delete m[k]; });
      return m;
    });
  }, [userId]);

  // ── week entries (ticks, days, numbers) ─────────────────────
  const saveEntry = useCallback(async (taskId: string, period: string, patch: EntryPatch) => {
    // day ticks and saved extras are built from what's on screen: not while that period is still loading
    if (rebuildsFromScreen(patch) && !periodLoaded(loadedRef.current, period)) return;
    const key  = entryKey(taskId, period);
    const prev = entriesRef.current[key];
    const next: Entry = {
      id: prev?.id || "", taskId, periodStart: period,
      target: prev?.target ?? null, actual: prev?.actual ?? null, days: prev?.days || NO_DAYS,
      done: prev?.done ?? false, data: prev?.data || {}, note: prev?.note ?? "",
      ...patch,
    };
    setEntries(m => ({ ...m, [key]: next }));
    const row: any = { task_id: taskId, period_start: period };
    if ("target" in patch) row.target = patch.target;
    if ("actual" in patch) row.actual = patch.actual;
    if ("days"   in patch) row.days   = patch.days;
    if ("done"   in patch) row.done   = patch.done;
    if ("note"   in patch) row.note   = patch.note;
    if ("data"   in patch) row.data   = patch.data;
    if ("target" in patch) setTargetLog(m => {
      const l = (m[taskId] || []).filter(x => x.p !== period);
      if (patch.target != null) l.push({ p: period, v: patch.target });
      l.sort((x, y) => x.p.localeCompare(y.p));
      return { ...m, [taskId]: l };
    });
    const { data, error } = await supabase.from("planner_entries").upsert(row, { onConflict: "task_id,period_start" }).select().single();
    fail(error);
    if (data) setEntries(m => ({ ...m, [key]: rowToEntry(data) }));
  }, []);

  // Plan week: this week's targets in one go
  const planTargets = useCallback(async (list: { taskId: string; period: string; target: number | null }[]) => {
    if (!list.length) return;
    const rows = list.map(x => ({ task_id: x.taskId, period_start: x.period, target: x.target }));
    const { data, error } = await supabase.from("planner_entries").upsert(rows, { onConflict: "task_id,period_start" }).select();
    fail(error);
    // the goal history knows these goals too (they carry over, and a planned week counts as set)
    setTargetLog(m => {
      const n = { ...m };
      list.forEach(x => {
        const l = (n[x.taskId] || []).filter(y => y.p !== x.period);
        if (x.target != null) l.push({ p: x.period, v: x.target });
        l.sort((a, b) => a.p.localeCompare(b.p));
        n[x.taskId] = l;
      });
      return n;
    });
    setEntries(m => {
      const n = { ...m };
      (data || []).forEach((r: any) => { const e = rowToEntry(r); n[entryKey(e.taskId, e.periodStart)] = e; });
      return n;
    });
  }, []);

  // ── stages ──────────────────────────────────────────────────
  const updateStage = useCallback(async (id: string, patch: Partial<Stage>) => {
    const row: any = {};
    if (patch.name        !== undefined) row.name         = patch.name.trim();
    if (patch.goal        !== undefined) row.goal         = patch.goal;
    if (patch.doneWhen    !== undefined) row.done_when    = patch.doneWhen;
    if (patch.sprintWeeks !== undefined) row.sprint_weeks = patch.sprintWeeks;
    const { error } = await supabase.from("planner_stages").update(row).eq("id", id).eq("user_id", userId);
    fail(error);
    setStages(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, [userId]);

  const startNextStage = useCallback(async (stage: Stage, moved: string[] = []) => {
    const next = stagesRef.current.find(s => s.account === stage.account && s.num === stage.num + 1);
    const t = today();
    const a = await supabase.from("planner_stages").update({ status: "done", done_on: t, ...(moved.length ? { moved } : {}) }).eq("id", stage.id).eq("user_id", userId);
    fail(a.error);
    if (next) {
      const b = await supabase.from("planner_stages").update({ status: "active", started_on: t }).eq("id", next.id).eq("user_id", userId);
      fail(b.error);
    }
    setStages(prev => prev.map(s =>
      s.id === stage.id ? { ...s, status: "done", doneOn: t, moved } :
      next && s.id === next.id ? { ...s, status: "active", startedOn: t } : s));
  }, [userId]);

  // Reopen a finished stage: it's active again, every later stage back to upcoming,
  // and the tasks that moved on when it was finished come back to it
  const reopenStage = useCallback(async (stage: Stage) => {
    const later = stagesRef.current.filter(s => s.account === stage.account && s.num > stage.num && s.status !== "upcoming");
    for (const s of later) { const r = await supabase.from("planner_stages").update({ status: "upcoming", done_on: null }).eq("id", s.id).eq("user_id", userId); fail(r.error); }
    const a = await supabase.from("planner_stages").update({ status: "active", done_on: null, moved: [] }).eq("id", stage.id).eq("user_id", userId);
    fail(a.error);
    const back = new Set(stage.moved || []);
    later.forEach(s => (s.moved || []).forEach(id => back.add(id)));
    for (const id of back) { const r = await supabase.from("planner_tasks").update({ stage_num: stage.num }).eq("id", id).eq("user_id", userId); fail(r.error); }
    setTasks(prev => prev.map(x => (back.has(x.id) ? { ...x, stageNum: stage.num } : x)));
    setStages(prev => prev.map(s =>
      s.id === stage.id ? { ...s, status: "active", doneOn: null, moved: [] } :
      later.some(l => l.id === s.id) ? { ...s, status: "upcoming", doneOn: null, moved: [] } : s));
  }, [userId]);

  // ── account snapshot (followers, views, engagement) ────────
  const snapsRef = useRef(snaps); snapsRef.current = snaps;
  const saveSnapshot = useCallback(async (acc: Account, week: string, patch: Partial<Pick<Snapshot, "followers" | "views" | "engagement">>) => {
    const key = snapKey(acc, week);
    const prev = snapsRef.current[key];
    setSnaps(m => ({ ...m, [key]: { id: prev?.id || "", account: acc, weekStart: week, followers: prev?.followers ?? null, views: prev?.views ?? null, engagement: prev?.engagement ?? null, ...patch } }));
    const row: any = { account: acc, week_start: week };
    if ("followers"  in patch) row.followers  = patch.followers;
    if ("views"      in patch) row.views      = patch.views;
    if ("engagement" in patch) row.engagement = patch.engagement;
    const { data, error } = await supabase.from("planner_snapshots").upsert({ user_id: userId, ...row }, { onConflict: "user_id,account,week_start" }).select().single();
    fail(error);
    if (data) setSnaps(m => ({ ...m, [key]: rowToSnap(data) }));
  }, [userId]);

  // ── Creator lists ───────────────────────────────────────────
  const itemsRef = useRef(items); itemsRef.current = items;
  const createItem = useCallback(async (fields: Partial<Item>): Promise<Item> => {
    const { data, error } = await supabase.from("planner_items").insert(itemToRow(fields)).select().single();
    fail(error);
    const it = rowToItem(data);
    setItems(prev => [...prev, it]);
    return it;
  }, []);
  const updateItem = useCallback(async (id: string, patch: Partial<Item>) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("planner_items").update(itemToRow(patch)).eq("id", id).eq("user_id", userId);
    fail(error);
  }, [userId]);
  // Posted / In kit get today's date (once); back to idea, planned or shot clears it
  // Filmed keeps the day it was filmed; back to idea / planned clears it
  const setItemStatus = useCallback(async (it: Item, status: ItemStatus) => {
    const posted = status === "posted" || status === "in_kit";
    const postedOn = posted ? (it.postedOn || today()) : null;
    const filmed = status === "shot" || posted;
    const filmedOn = filmed ? (it.plan.filmedOn || today()) : null;
    await updateItem(it.id, { status, postedOn, ...(filmedOn !== (it.plan.filmedOn ?? null) ? { plan: { ...it.plan, filmedOn } } : {}) });
  }, [updateItem]);
  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase.from("planner_items").delete().eq("id", id).eq("user_id", userId);
    fail(error);
    setItems(prev => prev.filter(x => x.id !== id));
  }, [userId]);
  // Undo: put a deleted idea / editorial back exactly as it was (same id, place and plan)
  const restoreItem = useCallback(async (it: Item) => {
    const row = { id: it.id, sort: it.sort, ...(it.createdAt ? { created_at: it.createdAt } : {}), ...itemToRow(it) };
    const { data, error } = await supabase.from("planner_items").insert(row).select().single();
    fail(error);
    setItems(prev => [...prev.filter(x => x.id !== it.id), rowToItem(data)]);
  }, []);

  // ── notes: concept, offer, weekly learning (one per account / week) ─
  const notesRef = useRef(notes); notesRef.current = notes;
  const noteOf = useCallback((acc: Account, kind: NoteKind, period: string | null = null) =>
    notes.find(n => n.account === acc && n.kind === kind && (n.periodStart || null) === (period || null)), [notes]);
  const saveNote = useCallback(async (acc: Account, kind: NoteKind, period: string | null, patch: Partial<Pick<Note, "title" | "body" | "link">>) => {
    const prev = notesRef.current.find(n => n.account === acc && n.kind === kind && (n.periodStart || null) === (period || null));
    if (prev) {
      setNotes(m => m.map(n => (n.id === prev.id ? { ...n, ...patch } : n)));
      const { error } = await supabase.from("planner_notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", prev.id).eq("user_id", userId);
      fail(error);
    } else {
      const { data, error } = await supabase.from("planner_notes").insert({ account: acc, kind, period_start: period, ...patch }).select().single();
      fail(error);
      if (data) setNotes(m => [...m, rowToNote(data)]);
    }
  }, [userId]);

  const waiting = items.filter(i => i.portfolio && i.status === "posted");

  // ── Stage 2: sprints ─────────────────────────────────────────
  const createSprint = useCallback(async (fields: Partial<Sprint>): Promise<Sprint> => {
    const num = Math.max(0, ...sprints.filter(x => x.account === fields.account).map(x => x.num)) + 1;
    const { data, error } = await supabase.from("planner_sprints").insert(sprintToRow({ ...fields, num, status: "active" })).select().single();
    fail(error);
    const sp = rowToSprint(data);
    setSprints(prev => [...prev, sp]);
    return sp;
  }, [sprints]);
  const updateSprint = useCallback(async (id: string, patch: Partial<Sprint>) => {
    setSprints(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("planner_sprints").update(sprintToRow(patch)).eq("id", id).eq("user_id", userId);
    fail(error);
  }, [userId]);
  const deleteSprint = useCallback(async (id: string) => {
    const { error } = await supabase.from("planner_sprints").delete().eq("id", id).eq("user_id", userId);
    fail(error);
    setSprints(prev => prev.filter(x => x.id !== id));
  }, [userId]);
  const activeSprint = useCallback((acc: Account) => sprints.find(x => x.account === acc && x.status === "active"), [sprints]);

  // what a sprint brought: pitches and follow-ups sent in its days, and where those contacts stand now
  // a sprint's numbers: pitches and follow-ups typed per day; replies, gifted, deals typed in the review
  const sprintStats = useCallback((sp: Sprint): SprintStats => {
    const ds = Object.entries(sp.days || {}).filter(([d]) => d >= sp.startOn && d <= sp.endOn).map(([, v]) => v || {});
    const pitchesN = ds.reduce((m, v) => m + (Number(v.p) || 0), 0);
    const followN  = ds.reduce((m, v) => m + (Number(v.f) || 0), 0);
    const r = sp.results || {};
    const replied = Number(r.replied) || 0;
    return {
      pitches: pitchesN, followUps: followN, contacted: pitchesN,
      replied, gifted: Number(r.gifted) || 0, deals: Number(r.deals) || 0,
      rate: pitchesN && r.replied != null ? (replied / pitchesN) * 100 : null,
    };
  }, []);

  // pitched contacts of this account without a reply for 7+ days
  const followUpsDue = useCallback((acc: Account, on: string = today()) => {
    const last = new Map<string, string>();
    pitches.filter(p => p.account === acc).forEach(p => { const m = last.get(p.contactId); if (!m || p.sentOn > m) last.set(p.contactId, p.sentOn); });
    const status = new Map(contacts.map(c => [c.id, c.status]));
    return [...last.entries()].filter(([id, d]) => status.get(id) === "pitched" && daysBetween(d, on) >= FOLLOW_UP_DAYS).length;
  }, [pitches, contacts]);

  // pitch log entries of some accounts in one week (newest first)
  const pitchesInWeek = useCallback((accs: Account[], week: string) =>
    pitches.filter(p => accs.includes(p.account) && p.sentOn >= week && p.sentOn <= addDays(week, 6))
      .sort((a, b) => b.sentOn.localeCompare(a.sentOn)), [pitches]);
  const contactName = useCallback((id: string) => contacts.find(c => c.id === id)?.company || "Contact", [contacts]);

  // a logged pitch, deleted from the Manager pitch log: like Outreach, the contact's last
  // contact date follows, and "Pitched" goes back to "not contacted" if it was the only one.
  // Returns what the contact was before, so Undo can put it back.
  const pitchesRef = useRef(pitches); pitchesRef.current = pitches;
  const contactsRef = useRef(contacts); contactsRef.current = contacts;
  const deletePitch = useCallback(async (p: Pitch) => {
    const c = contactsRef.current.find(x => x.id === p.contactId);
    const before = { status: c?.status || "new", lastContact: c?.lastContact ?? null };
    const { error } = await supabase.from("outreach_pitches").delete().eq("id", p.id).eq("user_id", userId);
    fail(error);
    const rest = pitchesRef.current.filter(x => x.contactId === p.contactId && x.id !== p.id);
    const last = rest.reduce<string | null>((m, x) => (!m || x.sentOn > m ? x.sentOn : m), null);
    const backToNew = !rest.length && c?.status === "pitched";
    const patch: any = { last_contact: last };
    if (backToNew) patch.status = null;
    const { error: e2 } = await supabase.from("outreach_contacts").update(patch).eq("id", p.contactId).eq("user_id", userId);
    fail(e2);
    setPitches(prev => prev.filter(x => x.id !== p.id));
    setContacts(prev => prev.map(x => (x.id === p.contactId ? { ...x, lastContact: last, status: backToNew ? "new" : x.status } : x)));
    return before;
  }, [userId]);
  const restorePitch = useCallback(async (p: Pitch, before: { status: string; lastContact: string | null }) => {
    const { error } = await supabase.from("outreach_pitches").insert({ id: p.id, contact_id: p.contactId, account: p.account, kind: p.kind, sent_on: p.sentOn });
    fail(error);
    const { error: e2 } = await supabase.from("outreach_contacts").update({ status: before.status === "new" ? null : before.status, last_contact: before.lastContact }).eq("id", p.contactId).eq("user_id", userId);
    fail(e2);
    setPitches(prev => [...prev.filter(x => x.id !== p.id), p]);
    setContacts(prev => prev.map(x => (x.id === p.contactId ? { ...x, status: before.status, lastContact: before.lastContact } : x)));
  }, [userId]);

  // ── what a row shows: its entry plus what is filled in elsewhere ─
  const newContacts = useCallback((week: string) => contacts.filter(c => c.week === week), [contacts]);
  const autoOf = useCallback((t: Task, period: string): Auto | undefined => {
    const accs = taskAccounts(t);
    const mine = items.filter(i => accs.includes(i.account));
    const inWeek = (d: string | null) => !!d && d >= period && d <= addDays(period, 6);
    switch (t.source) {
      case "outreach": return { actual: contacts.filter(c => c.week === period).length };
      // followers: the number typed for this account and week (kept in the snapshot row)
      case "followers": return { actual: t.account === "both" ? null : snaps[snapKey(t.account, period)]?.followers ?? null };
      case "snapshot": {
        const sn = t.account === "both" ? null : snaps[snapKey(t.account, period)];
        return { done: !!sn && (sn.followers != null || sn.views != null || sn.engagement != null) };
      }
      case "ideas":  return { actual: mine.filter(i => i.list === "idea" && i.createdWeek === period).length };
      case "posts":  return { actual: mine.filter(i => (i.status === "posted" || i.status === "in_kit") && inWeek(i.postedOn)).length };
      case "pieces": return { actual: mine.filter(i => i.portfolio && (i.status === "posted" || i.status === "in_kit") && inWeek(i.postedOn)).length };
      case "filmed": return { actual: mine.filter(i => !!i.plan.filmedOn && inWeek(i.plan.filmedOn)).length };
      case "portfolio_total": {
        const n = mine.filter(i => i.portfolio && (i.status === "posted" || i.status === "in_kit")).length;
        return { actual: n, target: t.target, done: t.target != null && n >= t.target };
      }
      case "kit_waiting": {
        const n = mine.filter(i => i.portfolio && i.status === "posted").length;
        return { actual: n, done: n === 0 };
      }
    }
    return undefined;
  }, [contacts, snaps, items, pitches]);
  // this period's target, or the last one set before it (targets carry over)
  const targetOf = useCallback((taskId: string, period: string): number | null => {
    const own = entries[entryKey(taskId, period)]?.target;
    if (own != null) return own;
    const l = targetLog[taskId];
    if (!l) return null;
    for (let i = l.length - 1; i >= 0; i--) if (l[i].p <= period) return l[i].v;
    return null;
  }, [entries, targetLog]);
  // a goal saved for exactly this period (carried-over goals don't count)
  const hasTarget = useCallback((taskId: string, period: string): boolean =>
    entries[entryKey(taskId, period)]?.target != null || (targetLog[taskId] || []).some(x => x.p === period), [entries, targetLog]);
  const stateOf = useCallback((t: Task, monday_: string) => {
    const period = periodOf(t, monday_);
    const e = entries[entryKey(t.id, period)];
    const tgt = targetOf(t.id, period);
    const eff = e ? { ...e, target: tgt } : tgt != null ? { id: "", taskId: t.id, periodStart: period, target: tgt, actual: null, days: NO_DAYS, done: false, data: {}, note: "" } as Entry : undefined;
    return rowState(t, eff, autoOf(t, period));
  }, [entries, autoOf, targetOf]);
  // done for stage gates (one-time tasks; the first set counts itself)
  const doneOf = useCallback((t: Task) => stateOf(t, monday).done, [stateOf, monday]);

  const reload = useCallback(() => { loadBase(); loadEntries(); loadOutside(); }, [loadBase, loadEntries, loadOutside]);

  return {
    stages, tasks, entries, snaps, items, notes, waiting, loading, loadError, outreachError, reload,
    weekReady: loadedWeek === monday, targetsReady, hasTarget,
    setTaskStatus, updateTask, createTask, deleteTask,
    saveEntry, planTargets, updateStage, startNextStage,
    saveSnapshot, newContacts, autoOf, stateOf, doneOf, targetOf, loginEmail, reopenStage,
    createItem, updateItem, setItemStatus, deleteItem, noteOf, saveNote,
    pitches, sprints, stage2Error, createSprint, updateSprint, deleteSprint, activeSprint, sprintStats, followUpsDue, pitchesInWeek, contactName,
    restoreItem, deletePitch, restorePitch,
  };
}

export type PlannerHook = ReturnType<typeof usePlanner>;
