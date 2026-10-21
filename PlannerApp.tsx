// ─────────────────────────────────────────────────────────────
// PlannerApp — Planner (tabs: Overview, To-do, Manager, Creator).
// Same frame as Outreach: logo header, nav tabs, account menu
// with all apps. Phone, iPad and desktop layouts.
// All four tabs are live: Dashboard (read-only scoreboard), To-do,
// Manager and Creator. One account at a time: @lynnhoa or
// @createbylynn, chosen with the switch next to each tab title and
// remembered on this device.
// Profile menu › This app: "@lynnhoa concept" / "@createbylynn concept"
// open the Content concept page (under the tabs, no tab underlined;
// tap any tab to leave it).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, SERIF, TYPE, BREAKPOINT, WIDE } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, NavTab, appItems, AppHeader } from "./AppNav";
import { usePlanner } from "./usePlanner";
import { thisMonday, ACCOUNTS, loadWorkAccount, saveWorkAccount } from "./planner";
import type { Account } from "./planner";
import PlannerTodo, { DEFAULT_VIEW } from "./PlannerTodo";
import PlannerManager from "./PlannerManager";
import PlannerCreator from "./PlannerCreator";
import PlannerOverview from "./PlannerOverview";
import PlannerConcept from "./PlannerConcept";
import { UndoBar } from "./undo";
import type { PlannerView } from "./PlannerTodo";
import type { Role } from "./types";

const TABS: { key: string; label: string; soon?: { phase: number; text: string } }[] = [
  { key: "overview", label: "Dashboard" },
  { key: "todo",     label: "To-do" },
  { key: "manager",  label: "Manager" },
  { key: "creator",  label: "Creator" },
];

// the tab (and switch) you used last, remembered on this device
const VIEW_KEY = "lh_planner_view";
const loadView = (): PlannerView => {
  try { return { ...DEFAULT_VIEW, ...JSON.parse(localStorage.getItem(VIEW_KEY) || sessionStorage.getItem(VIEW_KEY) || "{}") }; }
  catch { return DEFAULT_VIEW; }
};

interface PlannerAppProps {
  userId:   string | null;
  settings: any;
  signOut:  () => Promise<void>;
  switchTo: (r: Role) => void;
  banners?: ReactNode;
}

export default function PlannerApp({ userId, settings, signOut, switchTo, banners }: PlannerAppProps) {
  // the account comes from the title switch / profile menu (remembered on this device), never "all"
  const [view, setView]     = useState<PlannerView>(() => ({ ...loadView(), acc: loadWorkAccount() }));
  const setAccount = (a: Account) => { saveWorkAccount(a); setView(v => ({ ...v, acc: a })); };
  const [monday, setMonday] = useState<string>(thisMonday);
  const planner = usePlanner(userId, monday);

  const [winW, setWinW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* ignore */ } }, [view]);

  const isMobile = winW < BREAKPOINT;
  const isWide   = winW >= WIDE;
  const isConcept = view.tab === "concept";                      // the Content concept page (profile menu)
  const tab      = TABS.find(t => t.key === view.tab) || TABS[1];
  // switch tab; with an anchor, scroll to that card (e.g. To-do → Manager › Following)
  const goTab    = (key: string, anchor?: string) => {
    setView({ ...view, tab: key });
    window.scrollTo(0, 0);
    if (anchor) setTimeout(() => {
      const el = document.getElementById(anchor);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (winW < BREAKPOINT ? 100 : 72), behavior: "smooth" });
    }, 80);
  };
  // the profile menu's "@… concept": that account's Content concept page
  const openConcept = (a: Account) => { saveWorkAccount(a); setView(v => ({ ...v, acc: a, tab: "concept" })); window.scrollTo(0, 0); };
  const openOutreach = () => switchTo("outreach");
  // the Manager app opens straight on Service Catalog (rate cards inside)
  const openCatalog = () => { try { sessionStorage.setItem("lh_manager_open", "catalog"); } catch { /* ignore */ } switchTo("manager"); };

  // phone: avatar on the right, the menu opens to the left · iPad / computer: avatar on the left, the menu opens to the right
  const avatar = (dropLeft: boolean) => (
    <AvatarMenu settings={settings} roleLabel="Planner" dropLeft={dropLeft}
      items={ACCOUNTS.map(a => ({ key: `concept-${a.key}`, label: `${a.label} concept`, active: isConcept && view.acc === a.key, onClick: () => openConcept(a.key) }))}
      apps={appItems("planner", switchTo)} onSignOut={() => { signOut(); }} />
  );
  const tabs = (height: number, px: number) => TABS.map(t => (
    <NavTab key={t.key} label={t.label} active={!isConcept && tab.key === t.key} onClick={() => goTab(t.key)} height={height} px={px} />
  ));

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: SANS, color: C.black }}>
      <AppHeader isMobile={isMobile} avatar={avatar(false)} tabs={tabs} />
      <div style={{ maxWidth: isWide ? 1200 : 960, margin: "0 auto", padding: isMobile ? "14px 14px 28px" : "24px 20px 40px" }}>
        {banners}
        {isConcept ? (
          <PlannerConcept planner={planner} view={view} onAccount={setAccount} isMobile={isMobile} />
        ) : tab.key === "overview" ? (
          <PlannerOverview planner={planner} view={view} setView={setView} onAccount={setAccount} monday={monday} setMonday={setMonday} isMobile={isMobile} />
        ) : tab.key === "todo" ? (
          <PlannerTodo planner={planner} view={view} setView={setView} onAccount={setAccount} monday={monday} setMonday={setMonday} isMobile={isMobile} openOutreach={openOutreach} openTab={goTab} />
        ) : tab.key === "manager" ? (
          <PlannerManager planner={planner} view={view} setView={setView} onAccount={setAccount} monday={monday} setMonday={setMonday} isMobile={isMobile} openOutreach={openOutreach} openTab={goTab} />
        ) : tab.key === "creator" ? (
          <PlannerCreator planner={planner} view={view} setView={setView} onAccount={setAccount} monday={monday} setMonday={setMonday} isMobile={isMobile} openCatalog={openCatalog} openTab={goTab} openOutreach={openOutreach} />
        ) : (
          <div>
            <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{tab.label}</h2>
            <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "4px 0 0" }}>Coming in phase {tab.soon?.phase}</p>
            <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "14px 0 0", lineHeight: 1.5, maxWidth: 520 }}>{tab.soon?.text}</p>
          </div>
        )}
      </div>
      <UndoBar />
    </div>
  );
}
