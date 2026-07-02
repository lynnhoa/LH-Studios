// ─────────────────────────────────────────────────────────────
// CreatorApp — nav shell for creator role
// Tabs: Dashboard · Clients · Projects · Workspace
// Desktop + iPad + PWA iOS responsive
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { initials } from "./formatters";
import AppLogo from "./AppLogo";

// ── Page imports ──────────────────────────────────────────────
import CreatorDashboard  from "./CreatorDashboard";
import CreatorClients    from "./CreatorClients";
import CreatorProjects   from "./CreatorProjects";
import CreatorWorkspace  from "./CreatorWorkspace";

const NAV_DASHBOARD  = 0;
const NAV_CLIENTS    = 1;
const NAV_PROJECTS   = 2;
const NAV_WORKSPACE  = 3;

const BREAKPOINT = 768;

interface CreatorAppProps {
  settings:    any;
  clientsHook: any;
  signOut:     () => Promise<void>;
  switchMode:  () => void;
}

export default function CreatorApp({
  settings,
  clientsHook,
  signOut,
  switchMode,
}: CreatorAppProps) {
  const [nav,      setNav]      = useState(NAV_DASHBOARD);
  const [menuOpen, setMenuOpen] = useState(false);
  const [winW,     setWinW]     = useState(() => window.innerWidth);
  const [creatorClientSel, setCreatorClientSel] = useState<string | null>(null);

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const isMobile = winW < BREAKPOINT;
  const ini = initials(settings.name || settings.company || "LH");

  const goToDash = () => setNav(NAV_DASHBOARD);

  // ── Primary tabs ─────────────────────────────────────────
  const PRIMARY_TABS = [
    { label: "Dashboard", idx: NAV_DASHBOARD },
    { label: "Clients",   idx: NAV_CLIENTS   },
    { label: "Projects",  idx: NAV_PROJECTS  },
    { label: "Workspace", idx: NAV_WORKSPACE },
  ];

  const isTabActive = (idx: number) => nav === idx;

  const TabBtn = ({
    label,
    idx,
    height,
    px,
  }: {
    label:  string;
    idx:    number;
    height: number;
    px:     number;
  }) => (
    <button
      onClick={() => setNav(idx)}
      style={{
        padding:       `0 ${px}px`,
        height:        height,
        background:    "none",
        border:        "none",
        borderBottom:  isTabActive(idx)
          ? `2px solid ${C.black}`
          : "2px solid transparent",
        color:         isTabActive(idx) ? C.black : C.muted,
        cursor:        "pointer",
        fontFamily:    SANS,
        fontSize:      TYPE.micro.size,
        letterSpacing: "0.12em",
        textTransform: "uppercase" as const,
        whiteSpace:    "nowrap" as const,
        flexShrink:    0,
      }}
    >
      {label}
    </button>
  );

  // ── Avatar menu ──────────────────────────────────────────
  const AvatarMenu = ({ dropLeft = false }: { dropLeft?: boolean }) => (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 199 }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      <button
        onClick={() => setMenuOpen(m => !m)}
        title="Account"
        style={{
          width:          36,
          height:         36,
          borderRadius:   "50%",
          background:     C.black,
          color:          C.white,
          border:         "none",
          cursor:         "pointer",
          fontFamily:     SANS,
          fontSize:       TYPE.micro.size,
          letterSpacing:  "0.04em",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          position:       "relative",
          zIndex:         200,
          flexShrink:     0,
        }}
      >
        {ini}
      </button>

      {menuOpen && (
        <div
          style={{
            position:   "absolute",
            ...(dropLeft ? { left: 0 } : { right: 0 }),
            top:        "calc(100% + 13px)",
            background: C.bg,
            border:     `1px solid ${C.rule}`,
            borderRadius: 2,
            boxShadow:  "0 4px 20px rgba(0,0,0,0.10)",
            minWidth:   188,
            zIndex:     200,
          }}
        >
          {/* User info */}
          <div
            style={{
              padding:      "12px 16px 10px",
              borderBottom: `1px solid ${C.rule}`,
            }}
          >
            <p style={{ fontSize: TYPE.subtext.size, fontFamily: SERIF, color: C.black, margin: "0 0 2px" }}>
              {settings.name || settings.company || "Lynn Hoa"}
            </p>
            <p style={{ fontSize: TYPE.micro.size, fontFamily: SANS, color: C.light, margin: 0, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>
              Creator · Private
            </p>
          </div>

          <div style={{ borderTop: `1px solid ${C.rule}` }} />

          {/* Switch mode */}
          <button
            onClick={() => { setMenuOpen(false); switchMode(); }}
            style={{
              display:    "flex",
              alignItems: "center",
              width:      "100%",
              padding:    "11px 16px",
              background: "none",
              border:     "none",
              cursor:     "pointer",
              textAlign:  "left" as const,
              fontFamily: SANS,
              fontSize:   TYPE.label.size,
              color:      C.muted,
              letterSpacing: "0.04em",
              boxSizing:  "border-box" as const,
            }}
          >
            Switch to Manager
          </button>

          <div style={{ borderTop: `1px solid ${C.rule}` }} />

          <button
            onClick={() => { setMenuOpen(false); signOut(); }}
            style={{
              display:    "flex",
              alignItems: "center",
              width:      "100%",
              padding:    "11px 16px",
              background: "none",
              border:     "none",
              cursor:     "pointer",
              textAlign:  "left" as const,
              fontFamily: SANS,
              fontSize:   TYPE.label.size,
              color:      C.red,
              letterSpacing: "0.04em",
              boxSizing:  "border-box" as const,
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
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
            <div style={{ textAlign: "center", padding: "10px 20px 7px" }}>
              <AppLogo size="nav" onClick={goToDash} />
            </div>
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                padding:        "0 6px",
                borderTop:      `1px solid ${C.rule}`,
                position:       "relative",
              }}
            >
              <div style={{ display: "flex" }}>
                {PRIMARY_TABS.map(t => (
                  <TabBtn key={t.idx} label={t.label} idx={t.idx} height={40} px={10} />
                ))}
              </div>
              <div style={{ position: "absolute", right: 8 }}>
                <AvatarMenu dropLeft={false} />
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
              <AvatarMenu dropLeft={true} />
            </div>

            <AppLogo size="web" onClick={goToDash} />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {PRIMARY_TABS.map(t => (
                <TabBtn key={t.idx} label={t.label} idx={t.idx} height={56} px={14} />
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
          padding:   isMobile ? "20px 14px" : "28px 20px",
          transition: "max-width 0.2s ease",
        }}
      >
        {nav === NAV_DASHBOARD && (
          <CreatorDashboard
            clients={clientsHook.clients}
            isMobile={isMobile}
          />
        )}

        {nav === NAV_CLIENTS && (
          <CreatorClients
            clients={clientsHook.clients}
            isMobile={isMobile}
            onSelChange={setCreatorClientSel}
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
    </div>
  );
}
