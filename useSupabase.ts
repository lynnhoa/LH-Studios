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
  storage: (raw as any).storage,          // the private file store (signed copies)
};

// Export a flag so App.tsx can show a setup screen
export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON);

// ── Every row of a list, page by page ─────────────────────────
// Supabase sends at most 1,000 rows per answer (Project settings → API → Max rows).
// Lists that grow (email contacts, pitch log, documents …) are loaded in pages until
// every row is there. The first answer says how many rows there are (count), so a lower
// limit works too. `apply` adds the filters and the order — always end the order with a
// unique column ("id"), so rows with the same time (one import) can't be skipped or
// doubled between pages. A failed page → the error (the app shows Retry), never half a list.
export async function selectAll(table: string, columns: string, apply: (q: any) => any, pageSize = 1000): Promise<{ data: any[] | null; error: any }> {
  const rows: any[] = [];
  let total: number | null = null;
  for (let guard = 0; guard < 10000; guard++) {
    const from = rows.length;
    const res: any = await apply(supabase.from(table).select(columns, { count: "exact" })).range(from, from + pageSize - 1);
    if (res?.error) return { data: null, error: res.error };
    const got: any[] = Array.isArray(res?.data) ? res.data : [];
    if (total === null && typeof res?.count === "number") total = res.count;
    for (const r of got) rows.push(r);
    if (!got.length) break;
    if (total !== null ? rows.length >= total : got.length < pageSize) break;
  }
  return { data: rows, error: null };
}
