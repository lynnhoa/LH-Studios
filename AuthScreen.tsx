// ─────────────────────────────────────────────────────────────
// AuthScreen — Manager / Creator toggle + email + password
// Selected role is passed to signIn and determines which app loads.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, TYPE } from "./constants";
import AppLogo from "./AppLogo";
import type { Role } from "./types";

interface AuthScreenProps {
  onSignIn: (email: string, password: string, role: Role) => Promise<string | null>;
  loading:  boolean;
}

export default function AuthScreen({ onSignIn, loading }: AuthScreenProps) {
  const [role,     setRole]     = useState<Role>("manager");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [err,      setErr]      = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  const go = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setErr(null);
    const error = await onSignIn(email.trim(), password, role);
    if (error) setErr("Incorrect email or password.");
    setBusy(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") go();
  };

  return (
    <div style={{
      minHeight:      "100dvh",
      background:     C.bg,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontFamily:     SANS,
      padding:        "20px",
      boxSizing:      "border-box" as const,
    }}>
      <div style={{ width: "100%", maxWidth: 320, textAlign: "center" as const }}>

        {/* ── LOGO ── */}
        <div style={{ marginBottom: 8 }}>
          <AppLogo size="auth" />
        </div>

        {/* ── SUBTITLE ── */}
        <p style={{
          fontSize:      TYPE.micro.size,
          fontFamily:    SANS,
          color:         C.muted,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          margin:        "0 0 28px",
        }}>
          Private Access
        </p>

        {/* ── ROLE TOGGLE ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["manager", "creator"] as Role[]).map(v => {
            const sel = role === v;
            return (
              <button
                key={v}
                onClick={() => setRole(v)}
                style={{
                  flex:          1,
                  padding:       "9px 0",
                  border:        `1px solid ${sel ? C.black : C.rule}`,
                  background:    sel ? C.black : C.bg,
                  color:         sel ? C.white : C.muted,
                  cursor:        "pointer",
                  fontFamily:    SANS,
                  fontSize:      TYPE.button.size,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  borderRadius:  2,
                  transition:    "all 0.15s ease",
                }}
              >
                {v}
              </button>
            );
          })}
        </div>

        {/* ── EMAIL ── */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email"
          onChange={e => { setEmail(e.target.value); setErr(null); }}
          onKeyDown={onKey}
          style={{
            width:            "100%",
            padding:          "10px 14px",
            border:           `1px solid ${err ? C.red : C.rule}`,
            background:       C.bg,
            fontFamily:       SANS,
            fontSize:         TYPE.body.size,
            color:            C.black,
            borderRadius:     2,
            outline:          "none",
            boxSizing:        "border-box" as const,
            marginBottom:     10,
            WebkitAppearance: "none" as const,
          }}
        />

        {/* ── PASSWORD ── */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          autoComplete="current-password"
          onChange={e => { setPassword(e.target.value); setErr(null); }}
          onKeyDown={onKey}
          style={{
            width:            "100%",
            padding:          "10px 14px",
            border:           `1px solid ${err ? C.red : C.rule}`,
            background:       C.bg,
            fontFamily:       SANS,
            fontSize:         TYPE.body.size,
            color:            C.black,
            borderRadius:     2,
            outline:          "none",
            boxSizing:        "border-box" as const,
            marginBottom:     8,
            WebkitAppearance: "none" as const,
          }}
        />

        {/* ── ERROR ── */}
        {err && (
          <p style={{
            fontSize:   TYPE.micro.size,
            fontFamily: SANS,
            color:      C.red,
            margin:     "0 0 10px",
            textAlign:  "left" as const,
          }}>
            {err}
          </p>
        )}

        {/* ── ENTER BUTTON ── */}
        <button
          onClick={go}
          disabled={busy || loading || !email || !password}
          style={{
            width:         "100%",
            padding:       "11px 0",
            background:    busy || loading ? C.light : C.black,
            color:         C.white,
            border:        "none",
            borderRadius:  2,
            cursor:        busy || loading ? "default" : "pointer",
            fontFamily:    SANS,
            fontSize:      TYPE.button.size,
            letterSpacing: "0.14em",
            textTransform: "uppercase" as const,
            transition:    "background 0.15s ease",
            minHeight:     44,
          }}
        >
          {busy ? "Signing in…" : "Enter"}
        </button>

      </div>
    </div>
  );
}
