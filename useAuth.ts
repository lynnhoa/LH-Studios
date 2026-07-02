// ─────────────────────────────────────────────────────────────
// useAuth — Supabase auth hook
// Auth: Supabase email + password
// Role: set by toggle at login time, stored in sessionStorage
//       so page refresh keeps the role until sign out.
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
  signIn:  (email: string, password: string, role: Role) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const ROLE_KEY = "lh_studio_role";

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    userId:  null,
    role:    null,
    loading: true,
    error:   null,
  });

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        const savedRole = (sessionStorage.getItem(ROLE_KEY) as Role) || "manager";
        setState({ userId: session.user.id, role: savedRole, loading: false, error: null });
      } else {
        sessionStorage.removeItem(ROLE_KEY);
        setState({ userId: null, role: null, loading: false, error: null });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === "SIGNED_OUT") {
          sessionStorage.removeItem(ROLE_KEY);
          setState({ userId: null, role: null, loading: false, error: null });
        } else if (event === "SIGNED_IN" && session?.user) {
          const savedRole = (sessionStorage.getItem(ROLE_KEY) as Role) || "manager";
          setState({ userId: session.user.id, role: savedRole, loading: false, error: null });
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
    password: string,
    role: Role
  ): Promise<string | null> => {
    setState(s => ({ ...s, loading: true, error: null }));

    // Save chosen role before auth so onAuthStateChange can read it
    sessionStorage.setItem(ROLE_KEY, role);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      sessionStorage.removeItem(ROLE_KEY);
      setState(s => ({ ...s, loading: false, error: error.message }));
      return error.message;
    }

    return null;
  };

  const signOut = async (): Promise<void> => {
    sessionStorage.removeItem(ROLE_KEY);
    await supabase.auth.signOut();
  };

  return { ...state, signIn, signOut };
}
