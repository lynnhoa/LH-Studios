// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT — singleton
// Import { supabase } anywhere you need DB or Auth access.
// Never instantiate a second client.
// Every write (insert / update / upsert / delete / rpc) reports to
// saveStatus, so the app can show Saving… / Saved / Failed.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { saveStatus } from "./saveStatus";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Graceful fallback — renders an error screen instead of crashing React
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "[LH Studio] Missing environment variables:\n" +
    "  VITE_SUPABASE_URL\n" +
    "  VITE_SUPABASE_ANON_KEY\n\n" +
    "In Vercel: go to Project → Settings → Environment Variables and add both."
  );
}

const raw = createClient(
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

const WRITE_METHODS = new Set(["insert", "update", "upsert", "delete"]);

// Wrap a query builder so that awaiting a write reports its outcome
function track(builder: any, isWrite: boolean): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "then" && typeof value === "function") {
        return (onFulfilled?: any, onRejected?: any) => {
          if (!isWrite) return value.call(target, onFulfilled, onRejected);
          saveStatus.start();
          return value.call(
            target,
            (res: any) => {
              if (res?.error) saveStatus.fail(res.error.message);
              else saveStatus.ok();
              return onFulfilled ? onFulfilled(res) : res;
            },
            (err: any) => {
              saveStatus.fail(err?.message || "Network error");
              if (onRejected) return onRejected(err);
              throw err;
            }
          );
        };
      }
      if (typeof value === "function") {
        return (...args: any[]) => {
          const out = value.apply(target, args);
          const write = isWrite || WRITE_METHODS.has(String(prop));
          return out && typeof out === "object" && typeof out.then === "function" ? track(out, write) : out;
        };
      }
      return value;
    },
  });
}

export const supabase: any = {
  from: (table: string) => track(raw.from(table), false),
  rpc:  (fn: string, args?: any) => track((raw as any).rpc(fn, args), true),
  auth: raw.auth,
};

// Export a flag so App.tsx can show a setup screen
export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON);
