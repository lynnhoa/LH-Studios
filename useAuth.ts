// ─────────────────────────────────────────────────────────────
// useAuth — Supabase auth hook
// Handles: signIn, signOut, session persistence, role from profiles
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "./useSupabase";
import type { Role } from "./types";

interface AuthState {
  userId:    string | null;
  role:      Role | null;
  loading:   boolean;
  error:     string | null;
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

  // ── Fetch role from profiles table ───────────────────────
  const fetchRole = async (userId: string): Promise<Role> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) return "manager";
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

  // ── Listen to auth state changes ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    let initialized = false;

    // Check existing session on mount first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      initialized = true;
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        if (!cancelled)
          setState({ userId: session.user.id, role, loading: false, error: null });
      } else {
        if (!cancelled)
          setState({ userId: null, role: null, loading: false, error: null });
      }
    });

    // Subscribe — only handle events AFTER initial session check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        // Skip the initial SIGNED_IN that duplicates getSession
        if (!initialized && event === "SIGNED_IN") return;

        if (session?.user) {
          const role = await fetchRole(session.user.id);
          if (!cancelled)
            setState({ userId: session.user.id, role, loading: false, error: null });
        } else {
          if (!cancelled)
            setState({ userId: null, role: null, loading: false, error: null });
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ── Sign in ───────────────────────────────────────────────
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

  // ── Sign out ──────────────────────────────────────────────
  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return { ...state, signIn, signOut };
}
