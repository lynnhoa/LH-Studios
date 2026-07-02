// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT — singleton
// Import { supabase } anywhere you need DB or Auth access.
// Never instantiate a second client.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Graceful fallback — renders an error screen instead of crashing React
if (!SUPABASE_URL || !SUPABASE_ANON) {
  // Only throw in production (Vercel) if truly missing — gives a readable message
  // in the browser console rather than a blank page
  console.error(
    "[LH Studio] Missing environment variables:\n" +
    "  VITE_SUPABASE_URL\n" +
    "  VITE_SUPABASE_ANON_KEY\n\n" +
    "In Vercel: go to Project → Settings → Environment Variables and add both."
  );
}

export const supabase = createClient(
  SUPABASE_URL  ?? "https://placeholder.supabase.co",
  SUPABASE_ANON ?? "placeholder-anon-key",
  {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: false,
    },
  }
);

// Export a flag so App.tsx can show a setup screen
export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON);
