// ─────────────────────────────────────────────────────────────
// App.tsx — root component
// Auth gate → role from toggle → ManagerApp or CreatorApp
// switchMode flips between manager/creator without signing out
// ─────────────────────────────────────────────────────────────

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useAuth }      from "./authHook";
import { useSettings }  from "./useSettings";
import { useClients }   from "./useClients";
import { useRateCards } from "./useRateCards";
import AuthScreen       from "./AuthScreen";
import ManagerApp       from "./ManagerApp";
import CreatorApp       from "./CreatorApp";
import { Loading }      from "./atoms";
import { supabaseConfigured } from "./useSupabase";
import { C, SANS, SERIF, TYPE } from "./constants";

// ─────────────────────────────────────────────────────────────
// ErrorBoundary — catches uncaught React errors so the app
// never goes blank. Shows a styled fallback with a reload button.
// ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LH Studio] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: C.bg, fontFamily: SANS, padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" as const }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: "normal", color: C.black, margin: "0 0 12px" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: TYPE.subtext.size, color: C.muted, lineHeight: 1.7, margin: "0 0 20px" }}>
              An unexpected error occurred. Your data is safe — just reload to continue.
            </p>
            {this.state.error && (
              <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "10px 14px", marginBottom: 20, background: C.white, textAlign: "left" as const }}>
                <p style={{ fontSize: TYPE.micro.size, fontFamily: "monospace", color: C.red, margin: 0, wordBreak: "break-word" as const }}>
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding:       "12px 32px",
                background:    C.black,
                color:         C.white,
                border:        "none",
                borderRadius:  2,
                cursor:        "pointer",
                fontFamily:    SANS,
                fontSize:      TYPE.button.size,
                letterSpacing: "0.10em",
                textTransform: "uppercase" as const,
                minHeight:     44,
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function EnvMissingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: C.bg, fontFamily: SANS, padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: "center" as const }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: "normal", color: C.black, margin: "0 0 12px" }}>
          Lynn Hoa Studio
        </h1>
        <div style={{ border: `1px solid ${C.red}`, borderRadius: 2, padding: "20px 24px", background: "#fdf0f0", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: C.red, margin: "0 0 8px", fontWeight: "600" }}>
            Supabase environment variables missing
          </p>
          <p style={{ fontSize: 12, color: C.red, margin: 0, lineHeight: 1.6 }}>
            <code style={{ background: "rgba(0,0,0,0.07)", padding: "1px 5px", borderRadius: 2 }}>VITE_SUPABASE_URL</code>
            {" "}and{" "}
            <code style={{ background: "rgba(0,0,0,0.07)", padding: "1px 5px", borderRadius: 2 }}>VITE_SUPABASE_ANON_KEY</code>
            {" "}are not set.
          </p>
        </div>
        <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          In Vercel: go to <strong>Project → Settings → Environment Variables</strong> and add both keys from your Supabase project dashboard under <strong>Project Settings → API</strong>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <EnvMissingScreen />;
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const { userId, role, loading: authLoading, signIn, signOut, switchMode } = useAuth();
  const { settings, updateSettings } = useSettings(userId);
  const clientsHook   = useClients(userId);
  const rateCardsHook = useRateCards(userId);

  if (authLoading) return <Loading />;

  if (!userId) {
    return <AuthScreen onSignIn={signIn} loading={authLoading} />;
  }

  if (role === "manager") {
    return (
      <ManagerApp
        settings={settings}
        updateSettings={updateSettings}
        clientsHook={clientsHook}
        rateCardsHook={rateCardsHook}
        signOut={signOut}
        switchMode={switchMode}
      />
    );
  }

  return (
    <CreatorApp
      settings={settings}
      clientsHook={clientsHook}
      signOut={signOut}
      switchMode={switchMode}
    />
  );
}
