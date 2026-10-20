// ─────────────────────────────────────────────────────────────
// CreatorApp — nav shell for creator role
// Tabs: Dashboard · Clients · Projects · Workspace
// Desktop + iPad + PWA iOS responsive
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, BREAKPOINT } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, NavTab, appItems } from "./AppNav";
import { UndoBar } from "./undo";
import type { Role } from "./types";

// ── Page imports ──────────────────────────────────────────────
import CreatorDashboard  from "./CreatorDashboard";
import CreatorProjects   from "./CreatorProjects";
import CreatorWorkspace  from "./CreatorWorkspace";

const NAV_DASHBOARD  = 0;
const NAV_CLIENTS    = 1;
const NAV_PROJECTS   = 2;
const NAV_WORKSPACE  = 3;

interface CreatorAppProps {
  settings:    any;
  clientsHook: any;
  signOut:     () => Promise<void>;
  switchTo:        (r: Role) => void;
  banners?:    ReactNode;
}

export default function CreatorApp({
  settings,
  clientsHook,
  signOut,
  switchTo,
  banners,
}: CreatorAppProps) {
  const [nav,      setNav]      = useState(NAV_DASHBOARD);
  const [winW,     setWinW]     = useState(() => window.innerWidth);
  const [creatorClientSel, setCreatorClientSel] = useState<string | null>(null);

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const isMobile = winW < BREAKPOINT;

  const goToDash = () => setNav(NAV_DASHBOARD);

  // ── Primary tabs ─────────────────────────────────────────
  const PRIMARY_TABS = [
    { label: "Dashboard", idx: NAV_DASHBOARD },
  { label: "Workspace", idx: NAV_WORKSPACE },
  { label: "Projects",  idx: NAV_PROJECTS  },
  ];

  const avatar = (dropLeft: boolean) => (
    <AvatarMenu
      settings={settings}
      roleLabel="Creator"
      dropLeft={dropLeft}
      items={[]}
      apps={appItems("creator", switchTo)}
      onSignOut={() => { signOut(); }}
    />
  );

  // ── Content max-width ────────────────────────────────────
  const contentMaxW =
    nav === NAV_CLIENTS && creatorClientSel && !isMobile ? 1200 : 860;

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", fontFamily: SANS, color: C.black }}>

      {/* ── NAVBAR ── */}
      <div
        style={{
          borderBottom: `1px solid ${C.rule}`,
          position:     "sticky",
          top:          0,
          background:   C.bg,
          zIndex:       100,
        }}
      >
        {isMobile ? (
          <>
            <div style={{ textAlign: "center", padding: "8px 20px 6px" }}>
              <AppLogo size="nav" onClick={goToDash} />
            </div>
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                padding:        "0 44px 0 6px",      // room for the avatar on the right
                borderTop:      `1px solid ${C.rule}`,
                position:       "relative",
              }}
            >
              <div style={{ display: "flex" }}>
                {PRIMARY_TABS.map(t => (
                  <NavTab key={t.idx} label={t.label} active={nav === t.idx} onClick={() => setNav(t.idx)} height={40} px={8} />
                ))}
              </div>
              <div style={{ position: "absolute", right: 8 }}>
                {avatar(false)}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems:          "center",
              padding:             "0 28px",
              height:              56,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              {avatar(true)}
            </div>

            <AppLogo size="web" onClick={goToDash} />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {PRIMARY_TABS.map(t => (
                <NavTab key={t.idx} label={t.label} active={nav === t.idx} onClick={() => setNav(t.idx)} height={56} px={14} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div
        style={{
          maxWidth:  contentMaxW,
          margin:    "0 auto",
          padding:   isMobile ? "14px 14px" : "24px 20px",
          transition: "max-width 0.2s ease",
        }}
      >
        {banners}
        {nav === NAV_DASHBOARD && (
          <CreatorDashboard
            clients={clientsHook.clients}
            isMobile={isMobile}
            onOpen={(tab) => setNav(tab === "workspace" ? NAV_WORKSPACE : NAV_PROJECTS)}
          />
        )}



        {nav === NAV_PROJECTS && (
          <CreatorProjects
            clients={clientsHook.clients}
            isMobile={isMobile}
          />
        )}

        {nav === NAV_WORKSPACE && (
          <CreatorWorkspace
            clients={clientsHook.clients}
            isMobile={isMobile}
            clientsHook={clientsHook}
          />
        )}
      </div>
      {/* the app's Undo bar (Workspace ticks), above the save message */}
      <UndoBar />
    </div>
  );
}
