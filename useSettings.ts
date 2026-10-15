// ─────────────────────────────────────────────────────────────
// useSettings — profiles table CRUD
// Fetches and updates the creator's business profile (settings).
// Typing is saved 0,7 s after you stop, one save at a time, so a
// fast-typed IBAN can never be stored half-finished.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./useSupabase";
import { SETTINGS_DEFAULT } from "./rateCards";
import { registerReloader } from "./saveStatus";
import type { Settings } from "./types";

interface UseSettingsReturn {
  settings:       Settings;
  loading:        boolean;
  loaded:         boolean;          // profile really came from the database
  error:          string | null;
  loadError:      string | null;
  reload:         () => void;
  updateSettings: (updates: Partial<Settings>) => Promise<string | null>;
}

// ── Map DB row (snake_case) → Settings (camelCase) ───────────
function rowToSettings(row: any): Settings {
  return {
    name:             row.name             ?? "",
    company:          row.company          ?? "",
    street:           row.street           ?? "",
    plz:              row.plz              ?? "",
    city:             row.city             ?? "",
    country:          row.country          ?? "Deutschland",
    email:            row.email            ?? "",
    website:          row.website          ?? "",
    phone:            row.phone            ?? "",
    bankName:         row.bank_name        ?? "",
    iban:             row.iban             ?? "",
    bic:              row.bic              ?? "",
    paypalEmail:      row.paypal_email     ?? "",
    kleinunternehmer: row.kleinunternehmer ?? true,
    steuernummer:     row.steuernummer     ?? "",
    ustIdNr:          row.ust_id_nr        ?? "",
    vatRate:          Number(row.vat_rate ?? 19),
    taxNote:          row.tax_note         ?? SETTINGS_DEFAULT.taxNote,
  };
}

// ── Map Settings (camelCase) → DB row (snake_case) ───────────
function settingsToRow(s: Partial<Settings>): Record<string, any> {
  const row: Record<string, any> = {};
  if (s.name             !== undefined) row.name             = s.name;
  if (s.company          !== undefined) row.company          = s.company;
  if (s.street           !== undefined) row.street           = s.street;
  if (s.plz              !== undefined) row.plz              = s.plz;
  if (s.city             !== undefined) row.city             = s.city;
  if (s.country          !== undefined) row.country          = s.country;
  if (s.email            !== undefined) row.email            = s.email;
  if (s.website          !== undefined) row.website          = s.website;
  if (s.phone            !== undefined) row.phone            = s.phone;
  if (s.bankName         !== undefined) row.bank_name        = s.bankName;
  if (s.iban             !== undefined) row.iban             = s.iban;
  if (s.bic              !== undefined) row.bic              = s.bic;
  if (s.paypalEmail      !== undefined) row.paypal_email     = s.paypalEmail;
  if (s.kleinunternehmer !== undefined) row.kleinunternehmer = s.kleinunternehmer;
  if (s.steuernummer     !== undefined) row.steuernummer     = s.steuernummer;
  if (s.ustIdNr          !== undefined) row.ust_id_nr        = s.ustIdNr;
  if (s.vatRate          !== undefined) row.vat_rate         = s.vatRate;
  if (s.taxNote          !== undefined) row.tax_note         = s.taxNote;
  return row;
}

export function useSettings(userId: string | null): UseSettingsReturn {
  const [settings,  setSettings]  = useState<Settings>({ ...SETTINGS_DEFAULT });
  const [loading,   setLoading]   = useState(true);
  const [loaded,    setLoaded]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick,      setTick]      = useState(0);   // bump to reload

  // pending changes waiting to be saved
  const pending  = useRef<Partial<Settings>>({});
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const reload = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => registerReloader(reload), [reload]);

  // ── Fetch on mount / userId change / reload ──────────────
  useEffect(() => {
    if (!userId) {
      setSettings({ ...SETTINGS_DEFAULT });
      setLoading(false);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(async (res: any) => {
        if (cancelled) return;
        if (res?.error) {
          // could not load — keep what we have, show Retry, never invent empty data
          setLoadError(res.error.message);
          setLoading(false);
          return;
        }
        setLoadError(null);
        if (res?.data) {
          setSettings({ ...rowToSettings(res.data), ...pending.current });
          setLoaded(true);
          setLoading(false);
          return;
        }
        // no profile row yet (first login) — create one
        const { error: insertErr } = await supabase.from("profiles").insert({ id: userId });
        if (insertErr) console.warn("[LH Studio] Profile insert:", insertErr.message);
        if (cancelled) return;
        setSettings({ ...SETTINGS_DEFAULT });
        setLoaded(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, tick]);

  // ── Save the collected changes (one request at a time) ───
  const flush = useCallback(async (): Promise<void> => {
    if (!userId) return;
    if (inFlight.current) await inFlight.current;          // wait for the previous save
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    const run = (async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ ...settingsToRow(patch), updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) setError(error.message);
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, [userId]);

  // ── Update settings (shown at once, saved after typing stops) ─
  const updateSettings = useCallback(
    async (updates: Partial<Settings>): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      setSettings(s => ({ ...s, ...updates }));
      pending.current = { ...pending.current, ...updates };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; flush(); }, 700);
      return null;
    },
    [userId, flush]
  );

  // save anything still waiting when the screen closes or the app goes to the background
  useEffect(() => {
    const now = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } flush(); };
    const onHide = () => { if (document.visibilityState === "hidden") now(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); if (timer.current || Object.keys(pending.current).length) now(); };
  }, [flush]);

  return { settings, loading, loaded, error, loadError, reload, updateSettings };
}
