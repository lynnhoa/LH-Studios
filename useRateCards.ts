// ─────────────────────────────────────────────────────────────
// useRateCards — rate_cards table CRUD
// Fetches all rate cards for the user, upserts on change.
// Seeds RC0 defaults on first login if table is empty.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./useSupabase";
import { RC0 } from "./rateCards";
import type { RateCards, RateCard, CategoryKey } from "./types";

interface UseRateCardsReturn {
  rc:         RateCards;
  loading:    boolean;
  error:      string | null;
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

  // ── Fetch on mount / userId change ───────────────────────
  useEffect(() => {
    if (!userId) {
      setRc({ ...RC0 });
      setLoading(false);
      return;
    }

    setLoading(true);

    supabase
      .from("rate_cards")
      .select("*")
      .eq("user_id", userId)
      .then(async ({ data, error }) => {
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

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

        // Build RateCards map from DB rows
        const built: Partial<RateCards> = {};
        for (const row of data) {
          const { key, card } = rowToCard(row);
          built[key] = card;
        }
        setRc(built as RateCards);
        setLoading(false);
      });
  }, [userId]);

  // ── Upsert a single card ──────────────────────────────────
  const upsertCard = useCallback(
    async (key: CategoryKey, card: RateCard): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      // Optimistic local update
      setRc(prev => ({ ...prev, [key]: card }));

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

      if (error) {
        setError(error.message);
        return error.message;
      }

      return null;
    },
    [userId]
  );

  // ── Delete a custom card ──────────────────────────────────
  const deleteCard = useCallback(
    async (key: CategoryKey): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      // Prevent deleting base categories
      const BASE = ["influencer", "ugc", "editorial", "hotels"];
      if (BASE.includes(key)) return "Cannot delete a base category";

      // Optimistic local update
      setRc(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

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

  return { rc, loading, error, upsertCard, deleteCard };
}
