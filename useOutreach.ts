// ─────────────────────────────────────────────────────────────
// useOutreach — the Outreach email list (table outreach_contacts),
// the pitch log (table outreach_pitches: only emails sent — the
// Planner counts these) and the timeline events (table
// outreach_events: status changes and, later, detected replies).
// Contacts come in through the Claude prompt (SQL in Supabase);
// the app lists, changes and deletes them, sets their status and
// logs pitches and follow-ups. The account of a pitch comes from
// the contact's category (UGC → @createbylynn, else @lynnhoa).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, selectAll } from "./useSupabase";
import { registerReloader } from "./saveStatus";
import { today, uid } from "./formatters";
import { fitStatus, statusAfterPitch, accountOf } from "./outreach";
import type { OutreachContact, OutreachCategory, OutreachTier, OutreachStatus, Pitch, PitchAccount, OutreachEvent } from "./outreach";

const rowToContact = (r: any): OutreachContact => ({
  id:          r.id,
  company:     r.company ?? "",
  contactName: r.contact_name ?? "",
  email:       r.email ?? "",
  category:    (r.category ?? "") as OutreachCategory,
  tier:        (r.tier ?? "") as OutreachTier,           // empty = no tier
  status:      (r.status || "new") as OutreachStatus,
  lastContact: r.last_contact ? String(r.last_contact).slice(0, 10) : null,
  replyAt:     r.reply_at ?? null,
  replyNew:    r.reply_new === true,
  clientId:    r.client_id ?? null,
  web:         r.web ?? "",
  city:        r.city ?? "",
  country:     r.country ?? "",
  notes:       r.notes ?? "",
  source:      r.source ?? "",
  createdAt:   r.created_at ?? "",
});

const rowToPitch = (r: any): Pitch => ({
  id: r.id, contactId: r.contact_id, account: r.account, kind: r.kind === "follow_up" ? "follow_up" : "pitch",
  sentOn: String(r.sent_on).slice(0, 10), createdAt: r.created_at ?? "", templateId: r.template_id ?? null,
});
const rowToEvent = (r: any): OutreachEvent => ({
  id: r.id, contactId: r.contact_id, kind: r.kind === "reply" ? "reply" : "status", status: (r.status ?? null) as OutreachStatus | null, at: r.at ?? r.created_at ?? "",
});
const chunks = <T,>(a: T[], n = 400): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

// The reply check (Phase 5): the mailbox it reads and how the last check went
export interface MailStatus { address: string; lastCheckAt: string | null; lastError: string | null; repliesFound: number; }

export function useOutreach(userId: string | null) {
  const [contacts,   setContacts]   = useState<OutreachContact[]>([]);
  const [pitches,    setPitches]    = useState<Pitch[]>([]);
  const [events,     setEvents]     = useState<OutreachEvent[]>([]);   // the timeline: status changes, replies
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");

  const load = useCallback(async () => {
    if (!userId) { setContacts([]); setLoading(false); return; }
    // every contact, page by page (more than 1,000 is fine); newest first, then id
    const res: any = await selectAll("outreach_contacts", "*", q => q.eq("user_id", userId).order("created_at", { ascending: false }).order("id"));
    if (res?.error) {
      // table not created yet → say so plainly
      const missing = /outreach_contacts/.test(res.error.message || "") && /exist|schema cache|relation/i.test(res.error.message || "");
      setLoadError(missing ? "The email list table doesn't exist yet — run the Outreach SQL in Supabase once." : res.error.message);
    } else {
      setLoadError(null);
      setContacts((res?.data || []).map(rowToContact));
    }
    // the pitch log (Stage 2); if its table isn't there yet, the list still works
    const pr: any = await selectAll("outreach_pitches", "*", q => q.eq("user_id", userId).order("sent_on").order("id"));
    if (pr?.error) setPitchError(/outreach_pitches/.test(pr.error.message || "") ? "The pitch log table doesn't exist yet — run the Phase 6 SQL in Supabase once." : pr.error.message);
    else { setPitchError(null); setPitches((pr?.data || []).map(rowToPitch)); }
    // timeline entries; without the table the rest still works (the timeline shows the pitch log only)
    const ev: any = await selectAll("outreach_events", "*", q => q.eq("user_id", userId).order("at").order("id"));
    setEvents(ev?.error ? [] : (ev?.data || []).map(rowToEvent));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => registerReloader(() => { load(); }), [load]);

  // ── reply check (server function "outreach-mail-check", read-only) ──
  // It also runs every 5 minutes on the server; here it runs when Outreach opens and when
  // you come back to it (at most once a minute), and the list reloads when replies came in.
  const [mail, setMail] = useState<MailStatus | null>(null);
  const loadMail = useCallback(async (): Promise<MailStatus | null> => {
    if (!userId) { setMail(null); return null; }
    try {
      const { data, error } = await supabase.from("outreach_mail").select("*").eq("user_id", userId).maybeSingle();
      if (error || !data) { setMail(null); return null; }               // not set up (yet)
      const m: MailStatus = { address: data.address || "", lastCheckAt: data.last_check_at ?? null, lastError: data.last_error ?? null, repliesFound: Number(data.replies_found) || 0 };
      setMail(m);
      return m;
    } catch { setMail(null); return null; }
  }, [userId]);
  const lastCheck = useRef(0);
  const checkReplies = useCallback(async () => {
    if (!userId || Date.now() - lastCheck.current < 60_000) return;
    lastCheck.current = Date.now();
    if (!(await loadMail())) return;
    try {
      const { data } = await supabase.functions.invoke("outreach-mail-check", { body: {} });
      if (Number(data?.found) > 0) await load();
    } catch { /* the 5-minute check on the server runs anyway */ }
    await loadMail();
  }, [userId, load, loadMail]);
  useEffect(() => { checkReplies(); }, [checkReplies]);
  useEffect(() => {
    const back = () => { if (document.visibilityState === "visible") checkReplies(); };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [checkReplies]);
  useEffect(() => {
    let cancelled = false;
    try {
      supabase.auth?.getSession?.().then((r: any) => { if (!cancelled) setLoginEmail(r?.data?.session?.user?.email || ""); });
    } catch { /* no session info: the prompt shows a placeholder */ }
    return () => { cancelled = true; };
  }, [userId]);

  // a status change goes into the timeline; if that table isn't there yet, the change still counts
  const logEvent = useCallback(async (contactId: string, status: OutreachStatus) => {
    try {
      const { data, error } = await supabase.from("outreach_events")
        .insert({ user_id: userId, contact_id: contactId, kind: "status", status: status === "new" ? null : status }).select().single();
      if (!error && data) setEvents(prev => [...prev, rowToEvent(data)]);
    } catch { /* the timeline is extra */ }
  }, [userId]);

  const updateContact = useCallback(async (id: string, patch: Partial<OutreachContact>) => {
    const row: any = {};
    // a category change to UGC turns Gifted / Invited into Replied (UGC doesn't have them)
    const before = contacts.find(c => c.id === id);
    let fitted: OutreachStatus | null = null;
    if (patch.category !== undefined && before) {
      const f = fitStatus(before.status, patch.category);
      if (f !== before.status) { fitted = f; row.status = f === "new" ? null : f; patch = { ...patch, status: f }; }
    }
    if (patch.company     !== undefined) row.company      = patch.company.trim();
    if (patch.contactName !== undefined) row.contact_name = patch.contactName.trim();
    if (patch.email       !== undefined) row.email        = patch.email.trim().toLowerCase();
    if (patch.category    !== undefined) row.category     = patch.category;
    if (patch.tier        !== undefined) row.tier         = patch.tier || null;
    if (patch.web         !== undefined) row.web          = patch.web.trim();
    if (patch.city        !== undefined) row.city         = patch.city.trim();
    if (patch.country     !== undefined) row.country      = patch.country.trim();
    if (patch.notes       !== undefined) row.notes        = patch.notes;
    const { error } = await supabase.from("outreach_contacts").update(row).eq("id", id).eq("user_id", userId);
    if (error) throw new Error(/unique|duplicate/i.test(error.message) ? "This email is already on your list." : error.message);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch, email: row.email ?? c.email } : c));
    if (fitted) await logEvent(id, fitted);
  }, [userId, contacts, logEvent]);

  // One contact typed in by hand. The email is cleaned like the import (no spaces, lowercase);
  // an email already on the list is refused (here first, the database as a safety net) and
  // the error carries that contact's id, so the window can offer to open it.
  const addContact = useCallback(async (f: Partial<OutreachContact>): Promise<OutreachContact> => {
    const email = String(f.email || "").trim().toLowerCase();
    const dup = contacts.find(c => String(c.email || "").trim().toLowerCase() === email);
    const who = dup ? (dup.company || dup.contactName ? `${dup.company || dup.contactName} (${dup.email})` : dup.email) : "";
    if (dup) throw Object.assign(new Error(`Already on your list: ${who}`), { existingId: dup.id });
    const row = {
      user_id: userId, email,
      company: String(f.company || "").trim(), contact_name: String(f.contactName || "").trim(),
      category: f.category, tier: f.tier || null,
      web: String(f.web || "").trim(), city: String(f.city || "").trim(), country: String(f.country || "").trim(), notes: f.notes || "", source: "Added by hand",
    };
    const { data, error } = await supabase.from("outreach_contacts").insert(row).select().single();
    if (error) throw new Error(/unique|duplicate/i.test(error.message) ? "This email is already on your list." : error.message);
    const c = rowToContact(data);
    setContacts(prev => [c, ...prev]);
    return c;
  }, [userId, contacts]);

  const deleteContact = useCallback(async (id: string) => {
    const { error } = await supabase.from("outreach_contacts").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    setContacts(prev => prev.filter(c => c.id !== id));
    setPitches(prev => prev.filter(p => p.contactId !== id));
    setEvents(prev => prev.filter(e => e.contactId !== id));
  }, [userId]);

  // ── tracking ────────────────────────────────────────────────
  const setStatus = useCallback(async (id: string, status: OutreachStatus) => {
    const { error } = await supabase.from("outreach_contacts").update({ status: status === "new" ? null : status }).eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));
    await logEvent(id, status);
  }, [userId, logEvent]);

  // Lead → Client: the client in Manager. A client with the same email or brand name already there → linked to it;
  // otherwise a new client with company, contact name, email, city and country (the rest is filled in Manager).
  // The contact becomes Client; quote, contract and invoice then happen in Manager only.
  const makeClient = useCallback(async (id: string): Promise<{ created: boolean; name: string }> => {
    const c = contacts.find(x => x.id === id);
    if (!c) throw new Error("This contact isn't on the list any more.");
    const email = String(c.email || "").trim().toLowerCase();
    const { data: list, error: e1 } = await supabase.from("clients").select("id, email, name").eq("user_id", userId);
    if (e1) throw new Error(e1.message);
    // the same email, or the same brand name (Manager keeps one client per brand name)
    const name = c.company.trim() || email;
    const hit: any = (list || []).find((r: any) => String(r.email || "").trim().toLowerCase() === email)
      || (list || []).find((r: any) => String(r.name || "").trim().toLowerCase() === name.toLowerCase());
    let clientId: string = hit?.id, created = false;
    if (!clientId) {
      clientId = uid();
      // like a client added in Manager (agency "Direct"); street, postcode and VAT ID are filled in there
      const row = { id: clientId, user_id: userId, name, contact: c.contactName.trim(), email,
        agency: "Direct", street: "", plz: "", city: c.city.trim(), country: c.country.trim(), vat_id: "", tags: [], notes: "" };
      const { error: e2 } = await supabase.from("clients").insert(row);
      if (e2) throw new Error(e2.message);
      created = true;
    }
    const { error: e3 } = await supabase.from("outreach_contacts").update({ status: "client", client_id: clientId }).eq("id", id).eq("user_id", userId);
    if (e3) throw new Error(e3.message);
    setContacts(prev => prev.map(x => (x.id === id ? { ...x, status: "client", clientId } : x)));
    if (c.status !== "client") await logEvent(id, "client");
    return { created, name: hit?.name || c.company || email };
  }, [userId, contacts, logEvent]);

  // Opening a contact clears its new-reply dot
  const markSeen = useCallback(async (id: string) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, replyNew: false } : c)));
    await supabase.from("outreach_contacts").update({ reply_new: false }).eq("id", id).eq("user_id", userId);
  }, [userId]);

  // Log a pitch or follow-up for one or many contacts; last contact = that day.
  // The account comes from each contact's category. Status:
  //   one contact, a pitch (restart) → New and every ended status → Pitched; Pitched, Replied, Lead stay
  //   the list in view (bulk) or a follow-up → only New → Pitched, every other status stays
  // Returns the new entries (for Undo).
  const logPitches = useCallback(async (ids: string[], kind: "pitch" | "follow_up", sentOn: string = today(), opts: { restart?: boolean; templateId?: string | null; account?: PitchAccount } = {}): Promise<Pitch[]> => {
    if (!ids.length) return [];
    const byId = new Map(contacts.map(c => [c.id, c]));
    const added: Pitch[] = [];
    for (const part of chunks(ids)) {
      const { data, error } = await supabase.from("outreach_pitches")
        .insert(part.map(id => ({ contact_id: id, account: opts.account || accountOf(byId.get(id)?.category || ""), kind, sent_on: sentOn, ...(opts.templateId ? { template_id: opts.templateId } : {}) }))).select();
      if (error) throw new Error(error.message);
      (data || []).forEach((r: any) => added.push(rowToPitch(r)));
    }
    const next = (id: string): OutreachStatus => {
      const s = (byId.get(id)?.status || "new") as OutreachStatus;
      return kind === "pitch" && opts.restart ? statusAfterPitch(s) : s === "new" ? "pitched" : s;
    };
    const toPitched = ids.filter(id => next(id) === "pitched" && (byId.get(id)?.status || "new") !== "pitched");
    const newer     = ids.filter(id => { const lc = byId.get(id)?.lastContact; return !lc || lc < sentOn; });
    for (const part of chunks(toPitched)) {
      const { error } = await supabase.from("outreach_contacts").update({ status: "pitched" }).in("id", part).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    for (const part of chunks(newer)) {
      const { error } = await supabase.from("outreach_contacts").update({ last_contact: sentOn }).in("id", part).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    const tp = new Set(toPitched), nw = new Set(newer);
    setPitches(prev => [...prev, ...added]);
    setContacts(prev => prev.map(c => (tp.has(c.id) || nw.has(c.id) ? { ...c, status: tp.has(c.id) ? "pitched" : c.status, lastContact: nw.has(c.id) ? sentOn : c.lastContact } : c)));
    return added;
  }, [userId, contacts]);

  // Undo of a Write in Outlook: the new entries out, status and last contact exactly as before
  const undoLog = useCallback(async (added: Pitch[], before: { id: string; status: OutreachStatus; lastContact: string | null }[]) => {
    const ids = added.map(p => p.id);
    if (ids.length) {
      const { error } = await supabase.from("outreach_pitches").delete().in("id", ids).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    for (const b of before) {
      const { error } = await supabase.from("outreach_contacts").update({ status: b.status === "new" ? null : b.status, last_contact: b.lastContact }).eq("id", b.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    const gone = new Set(ids), back = new Map(before.map(b => [b.id, b]));
    setPitches(prev => prev.filter(p => !gone.has(p.id)));
    setContacts(prev => prev.map(c => (back.has(c.id) ? { ...c, status: back.get(c.id)!.status, lastContact: back.get(c.id)!.lastContact } : c)));
  }, [userId]);

  // Remove a wrong entry: last contact goes back to the one before; no entries left → not contacted again
  const deletePitch = useCallback(async (p: Pitch) => {
    const { error } = await supabase.from("outreach_pitches").delete().eq("id", p.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const rest = pitches.filter(x => x.contactId === p.contactId && x.id !== p.id);
    const last = rest.reduce<string | null>((m, x) => (!m || x.sentOn > m ? x.sentOn : m), null);
    const c = contacts.find(x => x.id === p.contactId);
    const patch: any = { last_contact: last };
    const backToNew = !rest.length && c?.status === "pitched";
    if (backToNew) patch.status = null;
    const { error: e2 } = await supabase.from("outreach_contacts").update(patch).eq("id", p.contactId).eq("user_id", userId);
    if (e2) throw new Error(e2.message);
    setPitches(prev => prev.filter(x => x.id !== p.id));
    setContacts(prev => prev.map(x => (x.id === p.contactId ? { ...x, lastContact: last, status: backToNew ? "new" : x.status } : x)));
  }, [userId, pitches, contacts]);

  // Undo of a deleted pitch: the same entry back, and the contact's last contact / status as before
  const restorePitch = useCallback(async (p: Pitch, before: { lastContact: string | null; status: any }) => {
    const { data, error } = await supabase.from("outreach_pitches")
      .insert({ id: p.id, contact_id: p.contactId, account: p.account, kind: p.kind, sent_on: p.sentOn }).select().single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await supabase.from("outreach_contacts")
      .update({ last_contact: before.lastContact, status: before.status && before.status !== "new" ? before.status : null }).eq("id", p.contactId).eq("user_id", userId);
    if (e2) throw new Error(e2.message);
    setPitches(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, rowToPitch(data)]));
    setContacts(prev => prev.map(x => (x.id === p.contactId ? { ...x, lastContact: before.lastContact, status: before.status || x.status } : x)));
  }, [userId]);

  return { contacts, pitches, events, mail, checkReplies, pitchError, loading, loadError, loginEmail, reload: load, addContact, updateContact, deleteContact, setStatus, markSeen, makeClient, logPitches, undoLog, deletePitch, restorePitch };
}
