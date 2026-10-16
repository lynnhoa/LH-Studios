// ─────────────────────────────────────────────────────────────
// PlaceholderApp — Planner and Outreach until their real pages
// exist. Same frame as the other apps: logo header, account menu
// (all four apps listed), and a simple "Coming soon" page.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, SERIF, TYPE, BREAKPOINT } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, appItems, APPS } from "./AppNav";
import type { Role } from "./types";

interface PlaceholderAppProps {
  app:       Role;                 // "planner" | "outreach"
  settings:  any;
  signOut:   () => Promise<void>;
  switchTo:  (r: Role) => void;
  banners?:  ReactNode;
}

export default function PlaceholderApp({ app, settings, signOut, switchTo, banners }: PlaceholderAppProps) {
  const [winW, setWinW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isMobile = winW < BREAKPOINT;
  const title = APPS.find(a => a.key === app)?.label || "App";

  const avatar = (dropLeft: boolean) => (
    <AvatarMenu
      settings={settings}
      roleLabel={title}
      dropLeft={dropLeft}
      items={[]}
      apps={appItems(app, switchTo)}
      onSignOut={() => { signOut(); }}
    />
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: SANS, color: C.black }}>
      {/* ── HEADER (same frame as Manager / Creator) ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg, borderBottom: `1px solid ${C.rule}` }}>
        {isMobile ? (
          <>
            <div style={{ textAlign: "center", padding: "8px 20px 6px" }}>
              <AppLogo size="nav" />
            </div>
            <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 8px", borderTop: `1px solid ${C.rule}` }}>
              {avatar(false)}
            </div>
          </>
        ) : (
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
            <AppLogo size="nav" />
            {avatar(false)}
          </div>
        )}
      </div>

      {/* ── PLACEHOLDER PAGE ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "14px 14px" : "24px 20px" }}>
        {banners}
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: "normal", margin: "8px 0 3px", lineHeight: 1.1 }}>{title}</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>Coming soon</p>
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "14px 0 0", lineHeight: 1.5 }}>This app is being prepared.</p>
      </div>
    </div>
  );
}
