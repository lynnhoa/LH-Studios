// ─────────────────────────────────────────────────────────────
// useRateCards — rate_cards table CRUD
// Fetches all rate cards for the user, upserts on change.
// Seeds RC0 defaults on first login if table is empty.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./useSupabase";
import { RC0 } from "./rateCards";
import { registerReloader } from "./saveStatus";
import type { RateCards, RateCard, CategoryKey } from "./types";

interface UseRateCardsReturn {
  rc:         RateCards;
  loading:    boolean;
  error:      string | null;
  loadError:  string | null;
  reload:     () => void;
  upsertCard: (key: CategoryKey, card: RateCard) => Promise<string | null>;
  deleteCard: (key: CategoryKey) => Promise<string | null>;
}

// ── Map DB row → RateCard ────────────────────────────────────
function rowToCard(row: any): { key: CategoryKey; card: RateCard } {
  return {
    key: row.category_key as CategoryKey,
    card: {
      label:    row.label         ?? "",
      sub:      row.sub           ?? "",
      sections: row.sections      ?? [],
      fine:     row.fine          ?? "",
      usage:    row.usage_options ?? [],
      excl:     row.excl_options  ?? [],
    },
  };
}

export function useRateCards(userId: string | null): UseRateCardsReturn {
  const [rc,      setRc]      = useState<RateCards>({ ...RC0 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  // edits are saved 0,7 s after typing stops, one request at a time
  const pending  = useRef<Record<string, RateCard>>({});
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const reload = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => registerReloader(reload), [reload]);

  // ── Fetch on mount / userId change ───────────────────────
  useEffect(() => {
    if (!userId) {
      setRc({ ...RC0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    supabase
      .from("rate_cards")
      .select("*")
      .eq("user_id", userId)
      .then(async (res: any) => {
        if (cancelled) return;
        const data = res?.data;
        const error = res?.error;
        if (error) {
          setError(error.message);
          setLoadError(error.message);
          setLoading(false);
          return;
        }
        setLoadError(null);

        // First login — seed RC0 into Supabase
        if (!data || data.length === 0) {
          const seeds = Object.entries(RC0).map(([key, card]) => ({
            user_id:      userId,
            category_key: key,
            label:        card.label,
            sub:          card.sub,
            sections:     card.sections,
            fine:         card.fine,
            usage_options: card.usage,
            excl_options:  card.excl,
          }));

          const { error: seedError } = await supabase
            .from("rate_cards")
            .insert(seeds);

          if (seedError) setError(seedError.message);
          setRc({ ...RC0 });
          setLoading(false);
          return;
        }

        // Build RateCards map from DB rows (unsaved edits stay on screen)
        const built: Partial<RateCards> = {};
        for (const row of data) {
          const { key, card } = rowToCard(row);
          built[key] = card;
        }
        setRc({ ...(built as RateCards), ...pending.current });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, tick]);

  const flush = useCallback(async (): Promise<string | null> => {
    if (!userId) return "Not authenticated";
    if (inFlight.current) await inFlight.current;
    const cards = pending.current;
    pending.current = {};
    let firstErr: string | null = null;
    const run = (async () => {
      for (const [key, card] of Object.entries(cards)) {
        const { error } = await supabase
          .from("rate_cards")
          .upsert(
            {
              user_id:       userId,
              category_key:  key,
              label:         card.label,
              sub:           card.sub,
              sections:      card.sections,
              fine:          card.fine,
              usage_options: card.usage,
              excl_options:  card.excl,
              updated_at:    new Date().toISOString(),
            },
            { onConflict: "user_id,category_key" }
          );
        if (error && !firstErr) { firstErr = error.message; setError(error.message); }
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    return firstErr;
  }, [userId]);

  useEffect(() => {
    const now = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } flush(); };
    const onHide = () => { if (document.visibilityState === "hidden") now(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); if (timer.current || Object.keys(pending.current).length) now(); };
  }, [flush]);

  // ── Upsert a single card ──────────────────────────────────
  const upsertCard = useCallback(
    async (key: CategoryKey, card: RateCard): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      // Shown at once, saved after typing stops
      setRc(prev => ({ ...prev, [key]: card }));
      pending.current = { ...pending.current, [key]: card };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; flush(); }, 700);
      return null;
    },
    [userId, flush]
  );

  // ── Delete a custom card ──────────────────────────────────
  const deleteCard = useCallback(
    async (key: CategoryKey): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      // Prevent deleting base categories
      const BASE = ["influencer", "ugc", "editorial", "hotels"];
      if (BASE.includes(key)) return "Cannot delete a base category";

      // Optimistic local update (and drop any unsaved edit of this card)
      setRc(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (pending.current[key]) { const p = { ...pending.current }; delete p[key]; pending.current = p; }

      const { error } = await supabase
        .from("rate_cards")
        .delete()
        .eq("user_id", userId)
        .eq("category_key", key);

      if (error) {
        setError(error.message);
        return error.message;
      }

      return null;
    },
    [userId]
  );

  return { rc, loading, error, loadError, reload, upsertCard, deleteCard };
}
