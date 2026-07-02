// ─────────────────────────────────────────────────────────────
// useAuth — Supabase auth hook
// Handles: signIn, signOut, session persistence, role from profiles
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "./useSupabase";
import type { Role } from "./types";

interface AuthState {
  userId:  string | null;
  role:    Role | null;
  loading: boolean;
  error:   string | null;
}

interface UseAuthReturn extends AuthState {
  signIn:  (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    userId:  null,
    role:    null,
    loading: true,
    error:   null,
  });

  const fetchRole = async (userId: string): Promise<Role> => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!data?.role) {
        await supabase
          .from("profiles")
          .upsert({ id: userId, role: "manager" }, { onConflict: "id" });
        return "manager";
      }
      return data.role as Role;
    } catch {
      return "manager";
    }
  };

  useEffect(() => {
    let cancelled = false;

    // getSession first — source of truth on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        if (!cancelled)
          setState({ userId: session.user.id, role, loading: false, error: null });
      } else {
        setState({ userId: null, role: null, loading: false, error: null });
      }
    });

    // onAuthStateChange only handles SIGNED_OUT and real new sign-ins
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        if (event === "SIGNED_OUT") {
          setState({ userId: null, role: null, loading: false, error: null });
        } else if (event === "SIGNED_IN" && session?.user) {
          const role = await fetchRole(session.user.id);
          if (!cancelled)
            setState({ userId: session.user.id, role, loading: false, error: null });
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<string | null> => {
    setState(s => ({ ...s, loading: true, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState(s => ({ ...s, loading: false, error: error.message }));
      return error.message;
    }
    return null;
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return { ...state, signIn, signOut };
}
