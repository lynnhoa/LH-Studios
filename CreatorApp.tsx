// ─────────────────────────────────────────────────────────────
// CreatorApp — nav shell for creator role
// Tabs: Dashboard · Clients · Projects · Workspace
// Desktop + iPad + PWA iOS responsive
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, BREAKPOINT } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, NavTab, appItems, AppHeader } from "./AppNav";
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
    nav === NAV_CLIENTS && creatorClientSel && !isMobile ? 1200 : 960;   // same as Manager / Planner / Outreach

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", fontFamily: SANS, color: C.black }}>

      {/* ── NAVBAR — the one top bar of every app ── */}
      <AppHeader isMobile={isMobile} onLogo={goToDash} avatar={avatar(false)}
        tabs={(h, px) => PRIMARY_TABS.map(t => <NavTab key={t.idx} label={t.label} active={nav === t.idx} onClick={() => setNav(t.idx)} height={h} px={px} />)} />

      {/* ── CONTENT ── */}
      <div
        style={{
          maxWidth:  contentMaxW,
          margin:    "0 auto",
          padding:   isMobile ? "14px 14px 28px" : "24px 20px 40px",
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
