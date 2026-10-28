// ─────────────────────────────────────────────────────────────
// BusinessDashboard — read-only overview, to read at a glance (the
// Manager dashboard is the master: the same parts and sizes).
//   Costs <year>   all tabs (receipts + the trips' meal allowance and km),
//                  month bars, what counts (and the Vorsteuer without § 19)
//   This year      Trips · Events · Costs · Profit preview (Manager's paid
//                  revenue, net, minus what counts)
//   By category    the year's costs by category, the biggest first
// Every card opens the tab where the work happens. No to-dos here.
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { C, SANS, SERIF, TYPE, TRACK, PAL } from "./constants";
import { DashCard, DashCardHead, DashStrip, DashTile, DashIcon, BarList, SwitchPill, SectionHead } from "./atoms";
import { fmt, today, MONTHS_SHORT, r2 } from "./formatters";
import { docsOf, isPaidInvoice, paidDateOf } from "./docs";
import { yearOf, caseYear, caseTotal, mealTotal, kmAmount, vatOf } from "./business";
import type { BusinessHook } from "./useBusiness";
import { BizIco, BIZ_IC, kuOf } from "./BusinessParts";

const pct2 = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const };

export default function BusinessDashboard({ biz, settings, clients, isMobile, year, setYear, years, totals, onOpen }: {
  biz: BusinessHook; settings: any; clients: any[]; isMobile: boolean; year: number; setYear: (y: number) => void; years: number[];
  totals: { total: number; counted: number }; onOpen: (tab: "trips" | "events" | "costs") => void;
}) {
  const ku = kuOf(settings);
  const todayStr = today();
  const curMonth = year === Number(todayStr.slice(0, 4)) ? Number(todayStr.slice(5, 7)) - 1 : -1;

  const d = useMemo(() => {
    const costs = biz.costs.filter(c => yearOf(c.date) === year);
    const trips = biz.cases.filter(x => x.kind === "trip" && caseYear(x) === year);
    const events = biz.cases.filter(x => x.kind === "event" && caseYear(x) === year);
    const oneOff = costs.filter(c => !c.caseId);
    const byMonth = Array.from({ length: 12 }, () => 0);
    costs.forEach(c => { byMonth[Number(c.date.slice(5, 7)) - 1] += c.amount; });
    trips.forEach(x => { const m = Number((x.startDate || "").slice(5, 7)) - 1; if (m >= 0) byMonth[m] += mealTotal(x) + kmAmount(x); });
    // by category (receipts) + the trips' allowances
    const cat = new Map<string, { label: string; v: number }>();
    const add = (k: string, label: string, v: number) => { const e = cat.get(k) || { label, v: 0 }; e.v += v; cat.set(k, e); };
    costs.forEach(c => {
      const ct = biz.cats.find(x => x.id === c.categoryId);
      add(ct?.id || "none", ct ? (ct.countsPct !== 100 ? `${ct.name} · ${ct.countsPct.toLocaleString("de-DE")} % counts` : ct.name) : "No category", c.amount);
    });
    const meals = trips.reduce((s, x) => s + mealTotal(x), 0), km = trips.reduce((s, x) => s + kmAmount(x), 0);
    if (meals) add("meals", "Meal allowance", meals);
    if (km) add("km", "Own car", km);
    const rows = [...cat.entries()].map(([k, e]) => ({ k, ...e })).filter(e => Math.abs(e.v) > 0.004).sort((a, b) => b.v - a.v);
    const top = rows.slice(0, 6), rest = rows.slice(6).reduce((s, e) => s + e.v, 0);
    const list = rest ? [...top, { k: "others", label: "Others", v: rest }] : top;
    // Manager's paid revenue of the year (net, by paid date — the same as the Manager dashboard)
    const revenue = (clients || []).flatMap((c: any) => c.projects || [])
      .flatMap((pr: any) => docsOf(pr).filter((x: any) => x.kind === "invoice" && isPaidInvoice(x)))
      .filter((x: any) => paidDateOf(x).startsWith(String(year)))
      .reduce((s: number, x: any) => s + (Number(x.net) || 0), 0);
    return {
      n: costs.length, byMonth, list,
      trips: { n: trips.length, v: trips.reduce((s, x) => s + caseTotal(x, biz.costs), 0) },
      events: { n: events.length, v: events.reduce((s, x) => s + caseTotal(x, biz.costs), 0) },
      oneOff: { n: oneOff.length, v: oneOff.reduce((s, c) => s + c.amount, 0) },
      vat: costs.reduce((s, c) => s + vatOf(c, ku), 0), revenue,
    };
  }, [biz.costs, biz.cases, biz.cats, clients, year, ku]);

  const i = years.indexOf(year);
  const yearBtn = (label: string, to: number | undefined, ch: string) => (
    <button onClick={() => to !== undefined && setYear(to)} disabled={to === undefined} aria-label={label}
      style={{ background: "none", border: "none", padding: "0 8px", height: 28, cursor: to === undefined ? "default" : "pointer", color: to === undefined ? C.faint : C.muted, fontFamily: SANS, fontSize: TYPE.body.size }}>{ch}</button>
  );
  const max = Math.max(1, ...d.byMonth);
  const share = totals.total > 0 ? (totals.counted / totals.total) * 100 : 0;
  const profit = r2(d.revenue - totals.counted);
  const circle = (path: string) => <DashIcon tone={PAL.neutral}><BizIco d={path} size={12} /></DashIcon>;
  type ToneSet = { fill: string; wash: string; mid: string; ink: string };
  const tile = (icon: string, label: string, value: string, sub: string, onClick?: () => void, tone: ToneSet = PAL.neutral) => (
    <DashTile tone={tone} icon={<BizIco d={icon} size={12} />} label={label} value={value} sub={sub} onClick={onClick} />
  );

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Dashboard</h2>
        <SwitchPill>{yearBtn("Previous year", years[i - 1], "‹")}<span style={{ minWidth: 40, textAlign: "center" as const }}>{year}</span>{yearBtn("Next year", i >= 0 ? years[i + 1] : undefined, "›")}</SwitchPill>
      </div>
      <div style={{ ...microLabel, color: C.muted, marginTop: 4 }}>Overview · read only</div>

      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <div>
          <DashCard onClick={() => onOpen("costs")}>
            <div style={{ padding: "11px 13px 9px" }}>
              <DashCardHead icon={circle(BIZ_IC.receipt)} label={`Costs ${year}`} arrow />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
                <div style={{ fontFamily: SERIF, fontSize: TYPE.kpi.size, lineHeight: 1.05, whiteSpace: "nowrap" as const }}>{fmt(totals.total)}</div>
                <div style={{ fontSize: TYPE.label.size, color: C.muted, textAlign: "right" as const, lineHeight: 1.35 }}>
                  {d.n} {d.n === 1 ? "receipt" : "receipts"}
                  {curMonth >= 0 && <><br />{MONTHS_SHORT[curMonth]} {fmt(d.byMonth[curMonth])}</>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4, alignItems: "end", height: 38, marginTop: 10 }}>
                {d.byMonth.map((v, m) => (
                  <span key={m} title={`${MONTHS_SHORT[m]} · ${fmt(v)}`}
                    style={{ height: v > 0 ? Math.max(6, Math.round((v / max) * 38)) : 3, borderRadius: v > 0 ? 5 : 2,
                      background: v > 0 ? (m === curMonth ? PAL.neutral.mid : PAL.neutral.fill) : curMonth >= 0 && m > curMonth ? PAL.neutral.wash : PAL.neutral.fill }} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4, marginTop: 4, fontSize: TYPE.micro.size, color: C.light, textAlign: "center" as const }}>
                {MONTHS_SHORT.map((m, k) => <span key={m} style={{ color: k === curMonth ? C.black : undefined }}>{m.slice(0, 1)}</span>)}
              </div>
            </div>
            <DashStrip tone={PAL.done} left={<>Counts · {fmt(totals.counted)}</>} right={pct2(share)} pct={share} />
            {!ku && <div style={{ padding: "7px 13px 8px", borderTop: `1px solid ${C.hair}`, background: PAL.neutral.wash, fontSize: TYPE.label.size, color: PAL.neutral.ink }}>Vorsteuer · {fmt(d.vat)}</div>}
          </DashCard>
        </div>

        <div>
          <SectionHead label="This year" />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            {tile(BIZ_IC.trip, "Trips", fmt(d.trips.v), `${d.trips.n} ${d.trips.n === 1 ? "trip" : "trips"}`, () => onOpen("trips"))}
            {tile(BIZ_IC.event, "Events", fmt(d.events.v), `${d.events.n} ${d.events.n === 1 ? "event" : "events"}`, () => onOpen("events"))}
            {tile(BIZ_IC.receipt, "Costs", fmt(d.oneOff.v), `${d.oneOff.n} ${d.oneOff.n === 1 ? "cost" : "costs"}`, () => onOpen("costs"))}
            {tile(BIZ_IC.check, "Profit preview", fmt(profit), `Revenue ${fmt(d.revenue)} − counts`, undefined, PAL.done)}
          </div>

          <SectionHead label={`By category · ${year}`} />
          <BarList empty={`No costs in ${year} yet.`}
            rows={d.list.map(e => ({ key: e.k, label: e.label, value: fmt(e.v), pct: totals.total > 0 ? (e.v / totals.total) * 100 : 0, pctText: totals.total > 0 ? pct2((e.v / totals.total) * 100) : "" }))} />
        </div>
      </div>
    </div>
  );
}
