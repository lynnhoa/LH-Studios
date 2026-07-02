// ─────────────────────────────────────────────────────────────
// useSettings — profiles table CRUD
// Fetches and updates the creator's business profile (settings)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./useSupabase";
import { SETTINGS_DEFAULT } from "./rateCards";
import type { Settings } from "./types";

interface UseSettingsReturn {
  settings:    Settings;
  loading:     boolean;
  error:       string | null;
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
    vatRate:          row.vat_rate         ?? 19,
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
  const [settings, setSettings] = useState<Settings>({ ...SETTINGS_DEFAULT });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // ── Fetch on mount / userId change ───────────────────────
  useEffect(() => {
    if (!userId) {
      setSettings({ ...SETTINGS_DEFAULT });
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else if (data) {
          setSettings(rowToSettings(data));
        }
        setLoading(false);
      });
  }, [userId]);

  // ── Update settings ───────────────────────────────────────
  const updateSettings = useCallback(
    async (updates: Partial<Settings>): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      // Optimistic local update
      setSettings(s => ({ ...s, ...updates }));

      const { error } = await supabase
        .from("profiles")
        .update({ ...settingsToRow(updates), updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) {
        // Revert on failure
        setError(error.message);
        return error.message;
      }

      return null;
    },
    [userId]
  );

  return { settings, loading, error, updateSettings };
}
