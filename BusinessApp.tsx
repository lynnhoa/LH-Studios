// ───────────────────────────────────────────────────────────
// BusinessApp — Business (tabs: Dashboard · Trips · Events · Costs): the costs of the
// business lynnhoa, collected for the tax return — modelled on Casa Castel's Maintenance
// (numbers worked out by date, receipts with their file, returns as their own line).
// Same frame as the other apps: logo header, nav tabs, account menu with all apps.
// Build 2: Trips and Events (cards with their receipts, meal allowance, km and the report PDF)
// next to Costs (one-off receipts by month). The Dashboard comes with a later build.
// The year (the strip under every tab's title) is kept while the app is open.
// Phone, iPad and desktop layouts.
// ───────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { C, SANS, SERIF, TYPE, BREAKPOINT, WIDE } from "./constants";
import { AvatarMenu, NavTab, appItems, AppHeader } from "./AppNav";
import { UndoBar } from "./undo";
import { useBusiness } from "./useBusiness";
import { yearOf, caseYear, yearTotals } from "./business";
import BusinessCosts from "./BusinessCosts";
import BusinessCases from "./BusinessCases";
import { ComingCard, kuOf } from "./BusinessParts";
import type { Role } from "./types";

interface BusinessAppProps {
  userId:   string | null;
  settings: any;
  clients?: any[];            // Manager's clients (a trip's or event's client / project)
  signOut:  () => Promise<void>;
  switchTo: (r: Role) => void;
  banners?: ReactNode;
}

type Tab = "dashboard" | "trips" | "events" | "costs";
const TAB_KEY = "lh_business_tab", YEAR_KEY = "lh_business_year";

export default function BusinessApp({ userId, settings, clients = [], signOut, switchTo, banners }: BusinessAppProps) {
  const biz = useBusiness(userId);
  const thisYear = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>(() => { try { const t = sessionStorage.getItem(TAB_KEY); return t === "dashboard" || t === "trips" || t === "events" ? t : "costs"; } catch { return "costs"; } });
  const pickTab = (t: Tab) => { setTab(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } window.scrollTo(0, 0); };
  const [year, setYearRaw] = useState<number>(() => { try { return Number(sessionStorage.getItem(YEAR_KEY)) || thisYear; } catch { return thisYear; } });
  const setYear = (y: number) => { setYearRaw(y); try { sessionStorage.setItem(YEAR_KEY, String(y)); } catch { /* ignore */ } };
  const [winW, setWinW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isMobile = winW < BREAKPOINT;
  const isWide   = winW >= WIDE;

  // every year that has costs, and this year
  const years = useMemo(() => {
    const s = new Set<number>([thisYear]);
    biz.costs.forEach(c => { const y = yearOf(c.date); if (y) s.add(y); });
    biz.cases.forEach(x => { const y = caseYear(x); if (y) s.add(y); });
    return [...s].sort((a, b) => a - b);
  }, [biz.costs, biz.cases, thisYear]);
  const ku = kuOf(settings);
  const totals = useMemo(() => yearTotals(year, biz.costs, biz.cases, biz.cats, ku), [year, biz.costs, biz.cases, biz.cats, ku]);

  const avatar = (dropLeft: boolean) => (
    <AvatarMenu settings={settings} roleLabel="Business" dropLeft={dropLeft} items={[]}
      apps={appItems("business", switchTo)} onSignOut={() => { signOut(); }} />
  );
  const title = (t: string) => (
    <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{t}</h2>
  );
  const coming = (t: string, line: string) => (
    <div style={{ fontFamily: SANS, color: C.black }}>
      {title(t)}
      <ComingCard title="Comes with the next build" text={line} />
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: SANS, color: C.black }}>
      <AppHeader isMobile={isMobile} avatar={avatar(false)} tabs={(h, px) => <>
        <NavTab label="Dashboard" active={tab === "dashboard"} onClick={() => pickTab("dashboard")} height={h} px={px} />
        <NavTab label="Trips"     active={tab === "trips"}     onClick={() => pickTab("trips")}     height={h} px={px} />
        <NavTab label="Events"    active={tab === "events"}    onClick={() => pickTab("events")}    height={h} px={px} />
        <NavTab label="Costs"     active={tab === "costs"}     onClick={() => pickTab("costs")}     height={h} px={px} />
      </>} />
      <div style={{ maxWidth: isWide ? 1200 : 960, margin: "0 auto", padding: isMobile ? "14px 14px 28px" : "24px 20px 40px" }}>
        {banners}
        {tab === "costs"
          ? <BusinessCosts biz={biz} settings={settings} isMobile={isMobile} year={year} setYear={setYear} years={years} totals={totals} />
          : tab === "trips" || tab === "events"
          ? <BusinessCases key={tab} kind={tab === "trips" ? "trip" : "event"} biz={biz} settings={settings} clients={clients} isMobile={isMobile}
              year={year} setYear={setYear} years={years} totals={totals} />
          : coming("Dashboard", "The read-only overview: the year's costs by month and category, and the profit preview.")}
      </div>
      <UndoBar />
    </div>
  );
}
