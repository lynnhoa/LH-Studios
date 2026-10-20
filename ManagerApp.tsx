// ─────────────────────────────────────────────────────────────
// ManagerApp — nav shell for manager role
// Tabs:        Dashboard · Clients · Projects · Calculator
// Avatar menu: Creator Profile · Change Password ·
//              Service Catalog (incl. Rate Card PDF) · Invoices
// Desktop + iPad + PWA iOS responsive
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, TYPE, BREAKPOINT, TRACK, RADIUS, SHADOW, Z } from "./constants";
import { currentQuote, contractNo, docNet, retainerMonthly, retDiscOf } from "./docs";
import AppLogo from "./AppLogo";
import { PillBtn } from "./atoms";
import { AvatarMenu, NavTab, appItems, AppHeader } from "./AppNav";
import type { Role } from "./types";

// ── Page imports (placeholders until built) ───────────────────
import Dashboard      from "./Dashboard";
import ClientList     from "./ClientList";
import ProjectsTab    from "./ProjectsTab";
import Calculator     from "./Calculator";
import ServiceCatalog from "./ServiceCatalog";
import Invoices       from "./Invoices";
import Licenses       from "./LicensesPage";
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
const NAV_INVOICES   = 8;
const NAV_LICENSES   = 9;

interface ManagerAppProps {
  settings:        any;
  updateSettings:  (u: any) => Promise<string | null>;
  clientsHook:     any;
  rateCardsHook:   any;
  signOut:         () => Promise<void>;
  switchTo:        (r: Role) => void;
  banners?:        ReactNode;
}

export default function ManagerApp({
  settings,
  updateSettings,
  clientsHook,
  rateCardsHook,
  signOut,
  switchTo,
  banners,
}: ManagerAppProps) {
  // another app can ask to open a page here (Planner → Service Catalog)
  const [nav,      setNav]      = useState(() => {
    try {
      const k = sessionStorage.getItem("lh_manager_open");
      sessionStorage.removeItem("lh_manager_open");
      if (k === "catalog") return NAV_CATALOG;
    } catch { /* ignore */ }
    return NAV_DASHBOARD;
  });
  const [winW,     setWinW]     = useState(() => window.innerWidth);

  // ── Prefill state — passed to Calculator from other pages ──
  const [prefill,         setPrefill]         = useState<any>(null);
  const [pendingClientId,   setPendingClientId]   = useState<string | null>(null);
  const [pendingProjectQNo, setPendingProjectQNo] = useState<string | null>(null);
  const [clientSel,       setClientSel]       = useState<string | null>(null);   // the open client, kept while you're in other tabs
  const [clientBack,      setClientBack]      = useState<{ clientId: string; projectId: string } | null>(null);   // came from Projects
  const [clientSelReset,  setClientSelReset]  = useState(0);
  const [dashDrill,       setDashDrill]       = useState<any>(null);
  const [invoiceFilter,   setInvoiceFilter]   = useState<any>(null);   // from a dashboard tile
  const [invoiceMonth,    setInvoiceMonth]    = useState<string | null>(null);   // a month bar ("2026-10")
  const [licenseFilter,   setLicenseFilter]   = useState<any>(null);
  const [projectFilter,   setProjectFilter]   = useState<string | null>(null);
  const [dashReset,       setDashReset]       = useState(0);

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const isMobile = winW < BREAKPOINT;

  // ── Navigation helpers ────────────────────────────────────
  const goTo = (n: number) => {
    // Clients while you're on it → the list; from another tab → the client you had open
    if (n === NAV_CLIENTS && nav === NAV_CLIENTS) setClientSelReset(p => p + 1);
    if (n !== NAV_CALCULATOR) setPrefill(null);   // leaving the Calculator ends Revise / Amend mode
    setNav(n);
  };

  // Navigation by the user (tabs, menu) also ends a dashboard drill context
  const navTo = (n: number) => { setClientBack(null); setInvoiceFilter(null); setInvoiceMonth(null); setLicenseFilter(null); setProjectFilter(null); goTo(n); };

  const goToDash = () => {
    setPrefill(null);
    setNav(NAV_DASHBOARD);
    setDashReset(p => p + 1);
    setDashDrill(null);
  };

  // New quote for a client (optionally for one of its leads)
  // (by id — two clients can share a name)
  const goToCalc = (clientId: string, leadId?: string) => {
    const c = (clientsHook.clients || []).find((x: any) => x.id === clientId);
    setPrefill({ brand: c?.name || "", contact: c?.contact || "", cid: c?.id, pid: leadId });
    setNav(NAV_CALCULATOR);
  };

  // a retainer quote's fee, for the "Original / Contract" list in the Calculator
  const retainerOf = (q: any) => (q?.retainer && Number(q?.retMo)
    ? { mo: Number(q.retMo), disc: retDiscOf(q), fee: retainerMonthly(q) } : null);

  // Revision — open Calculator pre-filled with existing quote lines
  const onRevise = (pr: any, cl: any) => {
    const q = pr.qd;
    if (!q) return;
    const cur = currentQuote(pr);
    setPrefill({
      brand:     q.brand   || cl.name || "",
      contact:   q.contact || cl.contact || "",
      qNo:       q.qNo,
      ctab:      q.ctab || "influencer",
      isRev:     true,
      // a draft quote is updated in place; a sent one gets the next revision
      revN:      cur && cur.status === "draft" ? cur.revision : (cur ? cur.revision : (q.rev || 0)) + 1,
      origLines: q.lines || [],
      retainer:  !!q.retainer,
      retMo:     q.retMo,
      retDisc:   q.retDisc,                       // a revision keeps the agreed retainer %
      origTotal: docNet("quote", q),              // the real value of the quote (retainer: fee × months)
      origRet:   retainerOf(q),
      validDays: q.validUntil && q.date ? Math.max(1, Math.round((new Date(q.validUntil).getTime() - new Date(q.date).getTime()) / 864e5)) : 14,
      projectName: pr.name,
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
      origTotal: pr.amount,
      origRet:   retainerOf(q),
      origAmends: (pr.amendments || []).filter((a: any) => a.signed)
        .map((a: any) => ({ label: a.aNo || "Amendment", total: Number(a.amendTotal) || 0 })),
      contractNo: pr.projectNo ? contractNo(pr.projectNo) : "",
      pid:       pr.id,
      cid:       cl?.id,
    });
    setNav(NAV_CALCULATOR);
  };

  const goToProjects = (projectIdOrQNo?: string) => {
    setPendingProjectQNo(projectIdOrQNo ?? null);
    setNav(NAV_PROJECTS);
  };

  const goToClients = (clientId?: string, projectId?: string) => {
    setPendingClientId(clientId ?? null);
    setPendingProjectQNo(projectId ?? null);
    setNav(NAV_CLIENTS);
  };

  // ── Avatar menu + tabs (shared with the Creator app) ─────
  const MENU_ITEMS: [string, number][] = [
    ["Business profile", NAV_PROFILE],
    ["Change Password",  NAV_PASSWORD],
    ["Service Catalog",  NAV_CATALOG],
    ["Invoices",         NAV_INVOICES],
    ["Licenses",         NAV_LICENSES],
  ];
  const avatar = (dropLeft: boolean) => (
    <AvatarMenu
      settings={settings}
      roleLabel="Manager"
      dropLeft={dropLeft}
      items={MENU_ITEMS.map(([label, idx]) => ({ key: String(idx), label, active: nav === idx, onClick: () => navTo(idx) }))}
      apps={appItems("manager", switchTo)}
      onSignOut={() => { signOut(); }}
    />
  );

  const PRIMARY_TABS = [
    { label: "Dashboard",  idx: NAV_DASHBOARD  },
    { label: "Clients",    idx: NAV_CLIENTS    },
    { label: "Projects",   idx: NAV_PROJECTS   },
    { label: "Calculator", idx: NAV_CALCULATOR },
  ];

  // ── Content max-width — wider when client detail open ─────
  const contentMaxW =
    nav === NAV_CLIENTS && clientSel && !isMobile ? 1200 : 960;   // same as Planner / Outreach

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100dvh", fontFamily: SANS, color: C.black }}>

      {/* ── NAVBAR — the one top bar of every app ── */}
      <AppHeader isMobile={isMobile} onLogo={goToDash} avatar={avatar(false)}
        tabs={(h, px) => PRIMARY_TABS.map(t => <NavTab key={t.idx} label={t.label} active={nav === t.idx} onClick={() => navTo(t.idx)} height={h} px={px} />)} />

      {/* ── CONTENT ── */}
      <div
        style={{
          maxWidth:  contentMaxW,
          margin:    "0 auto",
          padding:   isMobile ? "14px 14px 28px" : "24px 20px 40px",
        }}
      >
        {banners}
        {nav === NAV_DASHBOARD && (
          <Dashboard
            clients={clientsHook.clients}
            isMobile={isMobile}
            settings={settings}
            onOpenInvoices={(f: any, month?: string) => { setInvoiceFilter(f); setInvoiceMonth(month || null); goTo(NAV_INVOICES); }}
            onOpenProjects={(f: string) => { setProjectFilter(f); goTo(NAV_PROJECTS); }}
            onOpenLicenses={(f?: any) => { setLicenseFilter(f || null); goTo(NAV_LICENSES); }}
          />
        )}

        {nav === NAV_CLIENTS && (
          <ClientList
            clients={clientsHook.clients}
            initialSel={clientSel}
            backTo={clientBack}
            onBackToProjects={(pid: string) => { setClientBack(null); goToProjects(pid); }}
            isMobile={isMobile}
            settings={settings}
            rc={rateCardsHook.rc}
            selReset={clientSelReset}
            onSelChange={setClientSel}
            pendingClientId={pendingClientId}
            pendingProjectQNo={pendingProjectQNo}
            onPendingClear={() => {
              setPendingClientId(null);
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
            onOpenClient={(clientId: string, projectId?: string) => {
              // the client page then shows "‹ Projects", back to this project (still open) — by id, not name
              setClientBack(clientId && projectId ? { clientId, projectId } : null);
              goToClients(clientId, projectId);
            }}
            clients={clientsHook.clients}
            isMobile={isMobile}
            settings={settings}
            rc={rateCardsHook.rc}
            initialFilter={projectFilter}
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
            key={prefill?.isRev ? `rev:${prefill.pid}` : prefill?.isAmend ? `amend:${prefill.pid}` : "new"}
            isMobile={isMobile}
            settings={settings}
            rc={rateCardsHook.rc}
            rcReady={rateCardsHook.loaded && !rateCardsHook.loading}
            rcLoaded={rateCardsHook.loaded}
            prefill={prefill}
            clearPrefill={() => setPrefill(null)}
            onAfterSave={(projectId: string) => {
              // Closing the saved document → Projects tab with the project expanded
              setPrefill(null);
              goToProjects(projectId);
            }}
            onRevise={(projectId: string, clientId: string) => {
              // "Revise" on the quote just sent → the Calculator opens it as the next revision
              const cl = (clientsHook.clients || []).find((c: any) => c.id === clientId);
              const pr = cl ? (cl.projects || []).find((x: any) => x.id === projectId) : null;
              if (pr && cl) onRevise(pr, cl);
            }}
            clientsHook={clientsHook}
          />
        )}

        {nav === NAV_CATALOG && (
          <ServiceCatalog
            ready={rateCardsHook.loaded}
            rc={rateCardsHook.rc}
            upsertCard={rateCardsHook.upsertCard}
            deleteCard={rateCardsHook.deleteCard}
            settings={settings}
            isMobile={isMobile}
            clientNames={(clientsHook.clients || []).map((c: any) => c?.name).filter(Boolean)}
          />
        )}

        {nav === NAV_INVOICES && (
          <Invoices
            clients={clientsHook.clients}
            clientsHook={clientsHook}
            onOpenProject={(pid: string) => { setProjectFilter(null); goToProjects(pid); }}
            settings={settings}
            isMobile={isMobile}
            filterTab={invoiceFilter || undefined}
            focusMonth={invoiceMonth}
          />
        )}

        {nav === NAV_LICENSES && (
          <Licenses
            clients={clientsHook.clients}
            clientsHook={clientsHook}
            settings={settings}
            rc={rateCardsHook.rc}
            isMobile={isMobile}
            onAfterRenew={(pid: string) => goToProjects(pid)}
            initialFilter={licenseFilter}
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

    </div>
  );
}
