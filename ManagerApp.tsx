// ─────────────────────────────────────────────────────────────
// ManagerApp — nav shell for manager role
// Tabs:        Dashboard · Clients · Projects · Calculator
// Avatar menu: Creator Profile · Change Password ·
//              Service Catalog · Rate Card · Invoices
// Desktop + iPad + PWA iOS responsive
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { initials } from "./formatters";
import AppLogo from "./AppLogo";

// ── Page imports (placeholders until built) ───────────────────
import Dashboard      from "./Dashboard";
import ClientList     from "./ClientList";
import ProjectsTab    from "./ProjectsTab";
import Calculator     from "./Calculator";
import ServiceCatalog from "./ServiceCatalog";
import RateCard       from "./RateCard";
import Invoices       from "./Invoices";
import CreatorProfile from "./CreatorProfile";
import ChangePassword from "./ChangePassword";

// ── Nav indices ───────────────────────────────────────────────
const NAV_DASHBOARD  = 0;
const NAV_CLIENTS    = 1;
const NAV_CALCULATOR = 2;
const NAV_PROJECTS   = 3;
const NAV_PROFILE    = 4;
const NAV_PASSWORD   = 5;
const NAV_CATALOG    = 6;
const NAV_RATECARD   = 7;
const NAV_INVOICES   = 8;

const BREAKPOINT = 768; // iPad standard

interface ManagerAppProps {
  settings:        any;
  updateSettings:  (u: any) => Promise<string | null>;
  clientsHook:     any;
  rateCardsHook:   any;
  signOut:         () => Promise<void>;
  switchMode:      () => void;
}

export default function ManagerApp({
  settings,
  updateSettings,
  clientsHook,
  rateCardsHook,
  signOut,
  switchMode,
}: ManagerAppProps) {
  const [nav,      setNav]      = useState(NAV_DASHBOARD);
  const [menuOpen, setMenuOpen] = useState(false);
  const [winW,     setWinW]     = useState(() => window.innerWidth);

  // ── Prefill state — passed to Calculator from other pages ──
  const [prefill,         setPrefill]         = useState<any>(null);
  const [pendingClientName, setPendingClientName] = useState<string | null>(null);
  const [pendingProjectQNo, setPendingProjectQNo] = useState<string | null>(null);
  const [clientSel,       setClientSel]       = useState<string | null>(null);
  const [clientSelReset,  setClientSelReset]  = useState(0);
  const [fromDrill,       setFromDrill]       = useState<string | null>(null);
  const [dashDrill,       setDashDrill]       = useState<any>(null);
  const [dashReset,       setDashReset]       = useState(0);

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const isMobile = winW < BREAKPOINT;
  const ini = initials(settings.name || settings.company || "LH");

  // ── Navigation helpers ────────────────────────────────────
  const goTo = (n: number) => {
    if (n === NAV_CLIENTS) setClientSelReset(p => p + 1);
    setNav(n);
    setMenuOpen(false);
  };

  const goToDash = () => {
    setNav(NAV_DASHBOARD);
    setDashReset(p => p + 1);
    setDashDrill(null);
  };

  const goToCalc = (clientName: string) => {
    setPrefill({ brand: clientName, contact: "" });
    setNav(NAV_CALCULATOR);
  };

  // Revision — open Calculator pre-filled with existing quote lines
  const onRevise = (pr: any, cl: any) => {
    const q = pr.qd;
    if (!q) return;
    setPrefill({
      brand:     q.brand   || cl.name || "",
      contact:   q.contact || cl.contact || "",
      qNo:       q.qNo,
      ctab:      q.ctab || "influencer",
      isRev:     true,
      revN:      (q.rev || 0) + 1,
      origLines: q.lines || [],
      pid:       pr.id,
      cid:       cl.id,
    });
    setNav(NAV_CALCULATOR);
  };

  // Amendment — open Calculator in amendment mode
  const onAmend = (pr: any, cl: any) => {
    const q = pr.qd;
    if (!q) return;
    setPrefill({
      brand:     q.brand   || cl?.name || "",
      contact:   q.contact || cl?.contact || "",
      qNo:       q.qNo,
      ctab:      q.ctab || "influencer",
      isAmend:   true,
      amendN:    (pr.amendments || []).length + 1,
      origLines: q.lines || [],
      pid:       pr.id,
      cid:       cl?.id,
    });
    setNav(NAV_CALCULATOR);
  };

  const goToProjects = (qNo?: string) => {
    setPendingProjectQNo(qNo ?? null);
    setNav(NAV_PROJECTS);
  };

  const goToClients = (brand?: string, qNo?: string) => {
    setPendingClientName(brand ?? null);
    setPendingProjectQNo(qNo ?? null);
    setNav(NAV_CLIENTS);
  };

  // ── Avatar menu ───────────────────────────────────────────
  const MENU_ITEMS: [string, number][] = [
    ["Creator Profile",  NAV_PROFILE],
    ["Change Password",  NAV_PASSWORD],
    ["Service Catalog",  NAV_CATALOG],
    ["Rate Card",        NAV_RATECARD],
    ["Invoices",         NAV_INVOICES],
  ];

  const AvatarMenu = ({ dropLeft = false }: { dropLeft?: boolean }) => (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 199 }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Avatar button */}
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

      {/* Dropdown */}
      {menuOpen && (
        <div
          style={{
            position:  "absolute",
            ...(dropLeft ? { left: 0 } : { right: 0 }),
            top:       "calc(100% + 13px)",
            background: C.bg,
            border:    `1px solid ${C.rule}`,
            borderRadius: 2,
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
            minWidth:  188,
            zIndex:    200,
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
              Manager · Private
            </p>
          </div>

          {/* Menu items */}
          {MENU_ITEMS.map(([label, idx]) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              style={{
                display:    "flex",
                alignItems: "center",
                width:      "100%",
                padding:    "11px 16px",
                background: nav === idx ? "rgba(0,0,0,0.03)" : "none",
                border:     "none",
                cursor:     "pointer",
                textAlign:  "left" as const,
                fontFamily: SANS,
                fontSize:   TYPE.label.size,
                color:      nav === idx ? C.black : C.muted,
                letterSpacing: "0.04em",
                boxSizing:  "border-box" as const,
              }}
            >
              {label}
            </button>
          ))}

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
            Switch to Creator
          </button>

          <div style={{ borderTop: `1px solid ${C.rule}` }} />

          {/* Sign out */}
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

  // ── Primary nav tabs (visible in header) ──────────────────
  const PRIMARY_TABS = [
    { label: "Dashboard",  idx: NAV_DASHBOARD  },
    { label: "Clients",    idx: NAV_CLIENTS    },
    { label: "Projects",   idx: NAV_PROJECTS   },
    { label: "Calculator", idx: NAV_CALCULATOR },
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
      onClick={() => goTo(idx)}
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

  // ── Content max-width — wider when client detail open ─────
  const contentMaxW =
    nav === NAV_CLIENTS && clientSel && !isMobile ? 1200 : 860;

  // ── Render ────────────────────────────────────────────────
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
          // ── MOBILE NAV ──────────────────────────────────
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
          // ── DESKTOP / IPAD NAV ───────────────────────────
          <div
            style={{
              display:     "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems:  "center",
              padding:     "0 28px",
              height:      56,
            }}
          >
            {/* Left — avatar */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <AvatarMenu dropLeft={true} />
            </div>

            {/* Center — logo */}
            <AppLogo size="web" onClick={goToDash} />

            {/* Right — primary tabs */}
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
        }}
      >
        {nav === NAV_DASHBOARD && (
          <Dashboard
            clients={clientsHook.clients}
            isMobile={isMobile}
            settings={settings}
            resetKey={dashReset}
            drill={dashDrill}
            setDrill={setDashDrill}
            goTo={goTo}
            setPendingClientName={setPendingClientName}
            setPendingProjectQNo={setPendingProjectQNo}
            setFromDrill={setFromDrill}
          />
        )}

        {nav === NAV_CLIENTS && (
          <ClientList
            clients={clientsHook.clients}
            isMobile={isMobile}
            settings={settings}
            rc={rateCardsHook.rc}
            selReset={clientSelReset}
            onSelChange={setClientSel}
            pendingClientName={pendingClientName}
            pendingProjectQNo={pendingProjectQNo}
            onPendingClear={() => {
              setPendingClientName(null);
              setPendingProjectQNo(null);
            }}
            onGoToCalc={goToCalc}
            onRevise={onRevise}
            onAmend={onAmend}
            goTo={goTo}
            clientsHook={clientsHook}
          />
        )}

        {nav === NAV_PROJECTS && (
          <ProjectsTab
            clients={clientsHook.clients}
            isMobile={isMobile}
            settings={settings}
            rc={rateCardsHook.rc}
            pendingProjectQNo={pendingProjectQNo}
            onPendingClear={() => setPendingProjectQNo(null)}
            onGoToCalc={goToCalc}
            onRevise={onRevise}
            onAmend={onAmend}
            clientsHook={clientsHook}
          />
        )}

        {nav === NAV_CALCULATOR && (
          <Calculator
            isMobile={isMobile}
            settings={settings}
            rc={rateCardsHook.rc}
            prefill={prefill}
            clearPrefill={() => setPrefill(null)}
            onAfterSave={(_brand: string, qNo?: string | null) => {
              // Old-app behavior: after saving a quote, land on the Projects tab
              // with the new project auto-expanded + scrolled (via pendingProjectQNo).
              setTimeout(() => goToProjects(qNo ?? undefined), 100);
            }}
            saveQuote={clientsHook.saveQuote}
          />
        )}

        {nav === NAV_CATALOG && (
          <ServiceCatalog
            rc={rateCardsHook.rc}
            upsertCard={rateCardsHook.upsertCard}
            deleteCard={rateCardsHook.deleteCard}
          />
        )}

        {nav === NAV_RATECARD && (
          <RateCard
            rc={rateCardsHook.rc}
            upsertCard={rateCardsHook.upsertCard}
            settings={settings}
          />
        )}

        {nav === NAV_INVOICES && (
          <Invoices
            clients={clientsHook.clients}
            settings={settings}
            isMobile={isMobile}
          />
        )}

        {nav === NAV_PROFILE && (
          <CreatorProfile
            settings={settings}
            updateSettings={updateSettings}
            isMobile={isMobile}
          />
        )}

        {nav === NAV_PASSWORD && (
          <ChangePassword />
        )}
      </div>

      {/* ── BACK TO ACTIVE PROJECTS PILL (drill context) ── */}
      {nav === NAV_CLIENTS && fromDrill && (
        <button
          onClick={() => { setFromDrill(null); setNav(NAV_DASHBOARD); }}
          style={{
            position:     "fixed",
            bottom:       24,
            right:        24,
            zIndex:       999,
            background:   C.bg,
            border:       `1px solid ${C.rule}`,
            borderRadius: 20,
            padding:      "8px 20px",
            fontFamily:   SANS,
            fontSize:     TYPE.label.size,
            color:        C.muted,
            letterSpacing:"0.06em",
            cursor:       "pointer",
            boxShadow:    "0 2px 12px rgba(0,0,0,0.10)",
            whiteSpace:   "nowrap" as const,
          }}
        >
          ← Active Projects
        </button>
      )}
    </div>
  );
}
