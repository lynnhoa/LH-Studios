// ───────────────────────────────────────────────────────────
// BusinessApp — Business (tabs: Dashboard · Trips · Events · Costs): the costs of the
// business lynnhoa, collected for the tax return — modelled on Casa Castel's Maintenance
// (numbers worked out by date, receipts with their file, returns as their own line).
// Same frame as the other apps: logo header, nav tabs, account menu with all apps.
// Build 2: Trips and Events (cards with their receipts, meal allowance, km and the report PDF)
// next to Costs (one-off receipts by month). Build 3: the bookkeeping files (German) —
// Kostenübersicht PDF, the Invoices print, Excel — for the year or a month (the strip) and for
// one trip / event (its card). The Dashboard comes with a later build.
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
import { ComingCard, MenuPill, kuOf } from "./BusinessParts";
import { downloadOverview, downloadInvoices, downloadExcel, monthsWith } from "./businessExport";
import type { Scope } from "./businessExport";
import { showNote } from "./undo";
import { MONTHS } from "./formatters";
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

  // the bookkeeping files: started right in the tap (the iPhone opens a PDF only then), one at a time
  const [busy, setBusy] = useState<string | null>(null);
  type Kind = "pdf" | "invoices" | "excel";
  const make = (kind: Kind, scope: Scope) => {
    const data = { costs: biz.costs, cases: biz.cases, cats: biz.cats, ku, settings };
    return kind === "pdf" ? downloadOverview(scope, data) : kind === "invoices" ? downloadInvoices(scope, data) : downloadExcel(scope, data);
  };
  const run = (key: string, kind: Kind, scope: Scope) => {
    if (busy) return;
    setBusy(key);
    let job: any;
    try { job = make(kind, scope); } catch (e: any) { setBusy(null); showNote(e?.message || "The file couldn't be made."); return; }
    Promise.resolve(job).catch((e: any) => showNote(e?.message || "The file couldn't be made.")).finally(() => setBusy(null));
  };
  const months = useMemo(() => monthsWith(year, biz), [year, biz.costs, biz.cases]);   // eslint-disable-line react-hooks/exhaustive-deps
  const menu = (kind: Kind) => [
    { key: "year", label: `${year} · whole year`, strong: true, onClick: () => run(kind, kind, { kind: "year", year }) },
    ...months.map(ym => ({ key: ym, label: `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`, onClick: () => run(kind, kind, { kind: "month", ym }) })),
  ];
  const stripActions = (
    <>
      <MenuPill label="PDF" busy={busy === "pdf"} items={menu("pdf")} />
      <MenuPill label="Invoices" busy={busy === "invoices"} items={menu("invoices")} />
      <MenuPill label="Excel" busy={busy === "excel"} items={menu("excel")} />
    </>
  );
  const caseExport = (kind: "pdf" | "invoices", id: string) => run(`${kind}:${id}`, kind, { kind: "case", id });

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
          ? <BusinessCosts biz={biz} settings={settings} isMobile={isMobile} year={year} setYear={setYear} years={years} totals={totals} actions={stripActions} />
          : tab === "trips" || tab === "events"
          ? <BusinessCases key={tab} kind={tab === "trips" ? "trip" : "event"} biz={biz} settings={settings} clients={clients} isMobile={isMobile}
              year={year} setYear={setYear} years={years} totals={totals} actions={stripActions} busy={busy} onCaseExport={caseExport} />
          : coming("Dashboard", "The read-only overview: the year's costs by month and category, and the profit preview.")}
      </div>
      <UndoBar />
    </div>
  );
}
