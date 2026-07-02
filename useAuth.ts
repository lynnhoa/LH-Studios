// ─────────────────────────────────────────────────────────────
// useAuth — Supabase auth hook
// Role is set by the login toggle and stored in sessionStorage.
// switchMode flips role without signing out.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "./useSupabase";
import type { Role } from "./types";

interface AuthState {
  userId:  string | null;
  role:    Role | null;
  loading: boolean;
  error:   string | null;
}

interface UseAuthReturn extends AuthState {
  signIn:     (email: string, password: string, role: Role) => Promise<string | null>;
  signOut:    () => Promise<void>;
  switchMode: () => void;
}

const TAB_ID = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ROLE_KEY = `lh_studio_role_${TAB_ID}`;

function getStoredRole(): Role {
  return (sessionStorage.getItem(ROLE_KEY) as Role) || "manager";
}

// Clean up stale keys from previous tabs on load
try {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith("lh_studio_role_") && key !== ROLE_KEY) {
      sessionStorage.removeItem(key);
    }
  }
} catch (_) {}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    userId:  null,
    role:    null,
    loading: true,
    error:   null,
  });

  // Track whether we are in the middle of a programmatic signIn call
  // so we can ignore the duplicate SIGNED_IN from onAuthStateChange
  const signingIn = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // On mount: check existing session only
    supabase.auth.getSession().then((res) => {
      if (cancelled) return;
      const session = res?.data?.session;
      if (session?.user) {
        setState({
          userId:  session.user.id,
          role:    getStoredRole(),
          loading: false,
          error:   null,
        });
      } else {
        setState({ userId: null, role: null, loading: false, error: null });
      }
    });

    // Listener: only act on SIGNED_OUT
    // We handle SIGNED_IN ourselves inside signIn() to avoid the race
    const authListener = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          sessionStorage.removeItem(ROLE_KEY);
          setState({ userId: null, role: null, loading: false, error: null });
          return;
        }

        // SIGNED_IN fires both on actual login AND on page load if session exists.
        // We only want to handle the actual login case (when signingIn.current is true).
        if (event === "SIGNED_IN" && session?.user && signingIn.current) {
          signingIn.current = false;
          setState({
            userId:  session.user.id,
            role:    getStoredRole(),
            loading: false,
            error:   null,
          });
        }
      }
    );

    return () => {
      cancelled = true;
      authListener?.data?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string,
    role: Role
  ): Promise<string | null> => {
    // Save role BEFORE calling Supabase so the listener can read it
    sessionStorage.setItem(ROLE_KEY, role);
    signingIn.current = true;

    setState(s => ({ ...s, loading: true, error: null }));

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      signingIn.current = false;
      sessionStorage.removeItem(ROLE_KEY);
      setState(s => ({ ...s, loading: false, error: error.message }));
      return error.message;
    }

    return null; // state set by onAuthStateChange SIGNED_IN
  };

  const signOut = async (): Promise<void> => {
    sessionStorage.removeItem(ROLE_KEY);
    await supabase.auth.signOut();
  };

  const switchMode = () => {
    setState(s => {
      const next: Role = s.role === "manager" ? "creator" : "manager";
      sessionStorage.setItem(ROLE_KEY, next);
      return { ...s, role: next };
    });
  };

  return { ...state, signIn, signOut, switchMode };
}
