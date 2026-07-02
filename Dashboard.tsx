// ─────────────────────────────────────────────────────────────
// Dashboard — manager overview + all drill-downs
// Drills: projects · revenue · month · license · invoices ·
//         quotes · contracts
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, today, addM, dLeft } from "./formatters";
import { S } from "./atoms";

const MO       = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MO_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MO_SHORT = MO;

const yearOf  = (pr: any) => new Date(pr.date).getFullYear();
const monthOf = (pr: any) => new Date(pr.date).getMonth();
const ageCol  = (d: number | null) => d === null ? C.muted : d >= 14 ? C.red : d >= 7 ? C.amber : C.muted;

function getUsageEnd(pr: any): string | null {
  if (!pr.deliveryDate || !pr.qd) return null;
  if (pr.usageEndOverride) return pr.usageEndOverride;
  const ul = (pr.qd?.lines || []).find((l: any) => l.usageLabel);
  if (!ul?.usageLabel) return null;
  const m = ul.usageLabel.match(/(\d+)\s*month/i);
  const mo = m ? parseInt(m[1]) : null;
  return mo ? addM(pr.deliveryDate, mo) : null;
}

function buildInvoiceRows(clients: any[]) {
  const rows: any[] = [];
  clients.forEach((c: any) => {
    (c.projects || []).forEach((pr: any) => {
      if (!["invoiced","paid"].includes(pr.status) && !pr.paid) return;
      const q = pr.qd; if (!q) return;
      const iNo     = `INV-${(q.qNo || "").replace(/QUO-?/i,"").trim() || "001"}`;
      const dateStr = pr.date || q.date || "";
      rows.push({ cid: c.id, cName: c.name, pr, iNo, dateStr,
        year:  dateStr ? parseInt(dateStr.slice(0,4))   : 0,
        month: dateStr ? parseInt(dateStr.slice(5,7))-1 : 0 });
    });
  });
  rows.sort((a,b) => b.dateStr.localeCompare(a.dateStr));
  return rows;
}

const HBar = ({ pct, color }: { pct: number; color: string }) => (
  <div style={{ height: 3, background: C.rule, borderRadius: 2, marginTop: 3 }}>
    <div style={{ height: 3, width: `${pct}%`, background: color, borderRadius: 2 }} />
  </div>
);

const DrillBack = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ fontSize: TYPE.subtext.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 20, fontFamily: SANS }}>
    ← Dashboard
  </button>
);

const DrillTitle = ({ title, value }: { title: string; value?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, flexWrap: "wrap" as const, gap: 8 }}>
    <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0, color: C.black }}>{title}</h2>
    {value && <span style={{ fontFamily: SERIF, fontSize: TYPE.amount.size, color: C.black }}>{value}</span>}
  </div>
);

const DCard = ({ children, label, onClick, bg, border }: any) => (
  <div onClick={onClick} style={{ border: `1px solid ${border || C.rule}`, borderRadius: 2, padding: "13px 15px", background: bg || C.bg, cursor: "pointer" }}>
    <p style={{ fontSize: TYPE.micro.size, fontFamily: SANS, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>{label}</p>
    {children}
  </div>
);

interface DashboardProps {
  clients: any[]; isMobile: boolean; settings: any; resetKey: number;
  drill: string | null; setDrill: (d: string | null) => void;
  goTo: (n: number) => void;
  setPendingClientName: (n: string | null) => void;
  setPendingProjectQNo: (q: string | null) => void;
  setFromDrill: (f: string | null) => void;
}

export default function Dashboard({ clients, isMobile, settings, resetKey, drill, setDrill, goTo, setPendingClientName, setPendingProjectQNo, setFromDrill }: DashboardProps) {
  const [pFilter,        setPFilter]        = useState("all");
  const [pSort,          setPSort]          = useState("status");
  const [revYear,        setRevYear]        = useState("all");
  const [revSort,        setRevSort]        = useState("date_new");
  const [invTab,         setInvTab]         = useState<"unpaid"|"paid">("unpaid");
  const [invYear,        setInvYear]        = useState("all");
  const [invSel,         setInvSel]         = useState<Set<string>>(new Set());
  const [invPdfData,     setInvPdfData]     = useState<any>(null);
  const [licTab,         setLicTab]         = useState<"usage"|"excl">("usage");
  const [licenseActions, setLicenseActions] = useState<Record<string,string>>({});

  useEffect(() => { setDrill(null); }, [resetKey]);

  const all            = clients.flatMap(c => c.projects.map((pr: any) => ({ ...pr, cName: c.name, cId: c.id })));
  const paid           = all.filter((pr: any) => pr.paid && pr.date);
  const openQ          = all.filter((pr: any) => pr.status === "quoted" || pr.status === "revised");
  const unpaid         = all.filter((pr: any) => pr.status === "invoiced" && !pr.paid);
  const unsignedC      = all.filter((pr: any) => pr.status === "contracted");
  const activeProjects = all.filter((pr: any) => !pr.paid && pr.status && pr.status !== "lead" && pr.status !== "paid");
  const nowY           = new Date().getFullYear();
  const nowM           = new Date().getMonth();
  const rev            = paid.reduce((s: number,pr: any) => s + pr.amount, 0);
  const out            = unpaid.reduce((s: number,pr: any) => s + pr.amount, 0);
  const thisMonthRev   = paid.filter((pr: any) => yearOf(pr) === nowY && monthOf(pr) === nowM).reduce((s: number,pr: any) => s + pr.amount, 0);
  const thisYearRev    = paid.filter((pr: any) => yearOf(pr) === nowY).reduce((s: number,pr: any) => s + pr.amount, 0);
  const allYears       = Array.from(new Set(paid.map((pr: any) => yearOf(pr)))).sort((a: any,b: any) => b - a) as number[];
  const revMonthly     = Array.from({ length: 12 }, (_,m) => paid.filter((pr: any) => yearOf(pr) === nowY && monthOf(pr) === m).reduce((s: number,pr: any) => s + pr.amount, 0));
  const revMax         = Math.max(...revMonthly, 1);
  const prevMonthRev   = nowM > 0 ? revMonthly[nowM - 1] : 0;
  const revChange      = prevMonthRev > 0 ? Math.round(((thisMonthRev - prevMonthRev) / prevMonthRev) * 100) : null;

  const allLicenses = clients.flatMap(c => c.projects.flatMap((pr: any) => {
    const items: any[] = [];
    const originalUe    = getUsageEnd(pr);
    const renewalUDates = (pr.renewals || []).filter((r: any) => r.type !== "excl" && r.endDate).map((r: any) => r.endDate as string);
    const allUDates     = [originalUe, ...renewalUDates].filter(Boolean) as string[];
    const latestUe      = allUDates.length > 0 ? allUDates.reduce((a,b) => a > b ? a : b) : null;
    if (latestUe) items.push({ cName: c.name, cId: c.id, prName: pr.name, end: latestUe, type: "usage", key: `usage_${c.id}_${pr.id}` });
    const exclDates = (pr.renewals || []).filter((r: any) => r.type === "excl" && r.endDate).map((r: any) => r.endDate as string);
    const latestExcl = exclDates.length > 0 ? exclDates.reduce((a: string,b: string) => a > b ? a : b) : null;
    if (latestExcl) items.push({ cName: c.name, cId: c.id, prName: pr.name, end: latestExcl, type: "excl", key: `excl_${c.id}_${pr.id}` });
    return items;
  })).sort((a: any,b: any) => (dLeft(a.end)??999999) - (dLeft(b.end)??999999));

  const goToProject = (cName: string, qNo?: string, from?: string) => {
    setPendingClientName(cName);
    if (qNo) setPendingProjectQNo(qNo);
    if (from) setFromDrill(from);
    goTo(1);
  };

  const STATUS_ORDER: Record<string,number> = { production:0, contracted:1, invoiced:2, quoted:3, revised:4 };
  const STATUS_COLOR: Record<string,string> = { quoted:C.amber, revised:C.amber, contracted:C.amber, production:C.black, invoiced:C.green };
  const NEXT_ACTION:  Record<string,string> = { quoted:"Awaiting client feedback", revised:"Awaiting client feedback", contracted:"Awaiting signature", production:"In production", invoiced:"Awaiting payment" };

  const filteredProjects = (() => {
    let list = activeProjects;
    if (pFilter !== "all") list = list.filter((pr: any) => pr.status === pFilter);
    if (pSort === "status")     list = [...list].sort((a: any,b: any) => (STATUS_ORDER[a.status]??9) - (STATUS_ORDER[b.status]??9));
    else if (pSort === "amount_hi") list = [...list].sort((a: any,b: any) => b.amount - a.amount);
    else if (pSort === "amount_lo") list = [...list].sort((a: any,b: any) => a.amount - b.amount);
    else if (pSort === "delivery")  list = [...list].sort((a: any,b: any) => (a.deliveryDate||"9999").localeCompare(b.deliveryDate||"9999"));
    return list;
  })();

  // ── DRILL: ACTIVE PROJECTS ────────────────────────────────
  if (drill === "projects") {
    const totalActive = activeProjects.reduce((s: number,pr: any) => s + pr.amount, 0);
    const daysIn = (pr: any) => pr.date ? Math.floor((Date.now() - new Date(pr.date).getTime()) / 86400000) : null;
    const needsAction = filteredProjects.filter((pr: any) => ["invoiced","contracted"].includes(pr.status));
    const inProgress  = filteredProjects.filter((pr: any) => ["production","quoted","revised"].includes(pr.status));
    const Row = ({ pr }: { pr: any }) => {
      const d = daysIn(pr); const col = STATUS_COLOR[pr.status] || C.muted; const next = NEXT_ACTION[pr.status] || ""; const unsignedAmends = (pr.amendments || []).filter((a: any) => !a.signed).length;
      return (
        <div onClick={() => goToProject(pr.cName, pr.qd?.qNo, "projects")} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.rule}`, gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: TYPE.subtext.size, color: ageCol(d), flexShrink: 0, minWidth: 32, fontWeight: "500" }}>{d !== null ? `${d}d` : "—"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500" }}>{pr.cName}</span>
              <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 90 : 200 }}>{pr.name}</span>
              <span style={{ fontSize: TYPE.micro.size, color: col, border: `1px solid ${col}`, padding: "1px 5px", borderRadius: 2, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{pr.status}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center", flexWrap: "wrap" as const }}>
              <span style={{ fontSize: TYPE.label.size, color: C.light }}>{next}</span>
              {pr.deliveryDate && <span style={{ fontSize: TYPE.label.size, color: C.light }}>· Due {fmtD(pr.deliveryDate)}</span>}
              {unsignedAmends > 0 && <span style={{ fontSize: TYPE.label.size, color: C.amber }}>· {unsignedAmends} unsigned amend</span>}
            </div>
          </div>
          <span style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, flexShrink: 0 }}>{fmt(pr.amount)}</span>
          <span style={{ fontSize: TYPE.label.size, color: C.light }}>→</span>
        </div>
      );
    };
    return (
      <div>
        <DrillBack onClick={() => setDrill(null)} />
        <DrillTitle title="Active Projects" value={fmt(totalActive)} />
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "-10px 0 16px" }}>{filteredProjects.length} of {activeProjects.length} project{activeProjects.length !== 1 ? "s" : ""} in progress</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginBottom: 16 }}>
          <S value={pFilter} onChange={(e: any) => setPFilter(e.target.value)} s={{ fontSize: TYPE.label.size, padding: "5px 10px" }}>
            {[["all","All"],["production","Production"],["contracted","Contracted"],["invoiced","Invoiced"],["quoted","Quoted"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </S>
          <S value={pSort} onChange={(e: any) => setPSort(e.target.value)} s={{ fontSize: TYPE.label.size, padding: "5px 10px" }}>
            {[["status","By Stage"],["amount_hi","Amount ↓"],["amount_lo","Amount ↑"],["delivery","Delivery"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </S>
        </div>
        {filteredProjects.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.muted }}>No projects match this filter.</p>}
        {needsAction.length > 0 && <><p style={{ fontSize: TYPE.label.size, color: C.red, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 6px", fontWeight: "600" }}>Needs your action</p>{needsAction.map((pr: any,i: number) => <Row key={i} pr={pr} />)}</>}
        {inProgress.length > 0 && <><p style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: `${needsAction.length > 0 ? "20px" : "0"} 0 6px`, fontWeight: "600" }}>In progress</p>{inProgress.map((pr: any,i: number) => <Row key={i} pr={pr} />)}</>}
      </div>
    );
  }

  // ── DRILL: REVENUE ────────────────────────────────────────
  if (drill === "revenue") {
    const revFiltered = revYear === "all" ? paid : paid.filter((pr: any) => String(yearOf(pr)) === revYear);
    const revSorted = (() => {
      const arr = [...revFiltered];
      if (revSort === "date_new")   arr.sort((a: any,b: any) => b.date.localeCompare(a.date));
      else if (revSort === "date_old")  arr.sort((a: any,b: any) => a.date.localeCompare(b.date));
      else if (revSort === "amount_hi") arr.sort((a: any,b: any) => b.amount - a.amount);
      else if (revSort === "amount_lo") arr.sort((a: any,b: any) => a.amount - b.amount);
      else if (revSort === "client")    arr.sort((a: any,b: any) => (a.cName||"").localeCompare(b.cName||""));
      return arr;
    })();
    const revGroups: { year: number; months: { month: number; rows: any[] }[] }[] = [];
    revSorted.forEach((pr: any) => {
      const y = yearOf(pr), m = monthOf(pr);
      let yg = revGroups.find(g => g.year === y); if (!yg) { yg = { year: y, months: [] }; revGroups.push(yg); }
      let mg = yg.months.find(x => x.month === m); if (!mg) { mg = { month: m, rows: [] }; yg.months.push(mg); }
      mg.rows.push(pr);
    });
    return (
      <div>
        <DrillBack onClick={() => setDrill(null)} />
        <DrillTitle title="Revenue" value={fmt(rev)} />
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "-10px 0 16px" }}>{paid.length} paid project{paid.length !== 1 ? "s" : ""} · all time</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginBottom: 20 }}>
          <S value={revYear} onChange={(e: any) => setRevYear(e.target.value)} s={{ fontSize: TYPE.label.size, padding: "5px 10px" }}>
            <option value="all">All years</option>
            {allYears.map((y: number) => <option key={y} value={String(y)}>{y}</option>)}
          </S>
          <S value={revSort} onChange={(e: any) => setRevSort(e.target.value)} s={{ fontSize: TYPE.label.size, padding: "5px 10px" }}>
            {[["date_new","Newest first"],["date_old","Oldest first"],["amount_hi","Amount ↓"],["amount_lo","Amount ↑"],["client","Client A→Z"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </S>
        </div>
        {revSorted.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.muted }}>No paid projects yet.</p>}
        {revGroups.map(yg => (
          <div key={yg.year} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottom: `2px solid ${yg.year === nowY ? C.black : C.rule}`, marginBottom: 4 }}>
              <span style={{ fontSize: TYPE.body.size, color: yg.year === nowY ? C.black : C.muted, fontWeight: "600" }}>{yg.year}{yg.year === nowY ? " · Current" : ""}</span>
              <span style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black }}>{fmt(yg.months.flatMap(m => m.rows).reduce((s: number,pr: any) => s + pr.amount, 0))}</span>
            </div>
            {yg.months.map(mg => (
              <div key={mg.month} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px" }}>
                  <span style={{ fontSize: TYPE.label.size, color: C.light, letterSpacing: "0.09em", textTransform: "uppercase" as const }}>{MO[mg.month]} {yg.year}</span>
                  <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{fmt(mg.rows.reduce((s: number,pr: any) => s + pr.amount, 0))}</span>
                </div>
                {mg.rows.map((pr: any, i: number) => (
                  <div key={i} onClick={() => goToProject(pr.cName, pr.qd?.qNo, "revenue")} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.rule}`, gap: 10, cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500" }}>{pr.cName}</span>
                        <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 90 : 200 }}>{pr.name}</span>
                      </div>
                      <span style={{ fontSize: TYPE.label.size, color: C.light }}>{fmtD(pr.date)}</span>
                    </div>
                    <span style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, flexShrink: 0 }}>{fmt(pr.amount)}</span>
                    <span style={{ fontSize: TYPE.label.size, color: C.light }}>→</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── DRILL: MONTH ──────────────────────────────────────────
  if (drill === "month") {
    return (
      <div>
        <DrillBack onClick={() => setDrill(null)} />
        <DrillTitle title="Revenue by Month" value={fmt(thisYearRev)} />
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "-10px 0 16px" }}>{nowY} · Jan — {MO[nowM]}</p>
        {[...Array.from({ length: nowM + 1 }, (_,i) => i)].reverse().map(m => {
          const mPaid = paid.filter((pr: any) => yearOf(pr) === nowY && monthOf(pr) === m);
          const mRev  = mPaid.reduce((s: number,pr: any) => s + pr.amount, 0);
          return (
            <div key={m} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 15px", marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: mPaid.length ? 8 : 0 }}>
                <span style={{ fontSize: TYPE.body.size, color: m === nowM ? C.black : C.muted, fontWeight: m === nowM ? "500" : "normal" }}>{MO[m]} {nowY}{m === nowM ? " · This month" : ""}</span>
                <span style={{ fontFamily: SERIF, fontSize: TYPE.amount.size, color: mRev > 0 ? C.black : C.light }}>{mRev > 0 ? fmt(mRev) : "—"}</span>
              </div>
              {mPaid.slice(0,3).map((pr: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: `1px solid ${C.rule}` }}>
                  <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{pr.cName} · {pr.name}</span>
                  <span style={{ fontSize: TYPE.subtext.size }}>{fmt(pr.amount)}</span>
                </div>
              ))}
              {mPaid.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.light, margin: 0 }}>No paid projects</p>}
              {mPaid.length > 3 && <p style={{ fontSize: TYPE.label.size, color: C.light, margin: "4px 0 0" }}>+{mPaid.length - 3} more</p>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── DRILL: LICENSE TRACKER ────────────────────────────────
  if (drill === "license") {
    const ACTIONED     = ["ignored","takendown","renewal"];
    const needsAtt     = (r: any) => !ACTIONED.includes(licenseActions[r.key] || "");
    const setAction    = (key: string, val: string) => setLicenseActions(prev => ({ ...prev, [key]: val }));
    const usageLics    = allLicenses.filter((r: any) => r.type === "usage");
    const exclLics     = allLicenses.filter((r: any) => r.type === "excl");
    const tabLics      = licTab === "usage" ? usageLics : exclLics;
    const urgentRows   = tabLics.filter((r: any) => { const d = dLeft(r.end); return d !== null && d <= 7 && needsAtt(r); });
    const activeRows   = tabLics.filter((r: any) => { const d = dLeft(r.end); return (d === null || d > 7) && needsAtt(r); });
    const actionedRows = tabLics.filter((r: any) => !needsAtt(r));
    const SL: Record<string,string> = { ignored:"Ignored", takendown:"Taken down", renewal:"Renewal pending" };
    const tabPillS = (active: boolean): any => ({ padding:"6px 15px", border:`1px solid ${active?C.black:C.rule}`, background:active?C.black:"none", color:active?C.white:C.muted, cursor:"pointer", fontFamily:SANS, fontSize:TYPE.label.size, letterSpacing:"0.1em", textTransform:"uppercase" as const, outline:"none" });
    const LicRow = ({ r }: { r: any }) => {
      const d = dLeft(r.end); const isExpired = d!==null&&d<0; const isExpiring = d!==null&&d>=0&&d<=7; const act = licenseActions[r.key]||""; const isActioned = ACTIONED.includes(act);
      const daysText = isExpired ? `+${Math.abs(d!)}d expired` : isExpiring ? `${d}d left` : `${d}d`; const dCol = isExpired ? C.red : isExpiring ? C.amber : C.green;
      return (
        <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.rule}`, opacity: isActioned ? 0.5 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: TYPE.subtext.size, color: dCol, fontWeight: "500", flexShrink: 0, minWidth: 88 }}>{daysText}</span>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => goToProject(r.cName)}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500" }}>{r.cName}</span>
                <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 90 : 200 }}>{r.prName}</span>
              </div>
              <span style={{ fontSize: TYPE.label.size, color: C.light }}>{licTab === "excl" ? (isExpired ? "Free to work again" : "Blocked until") : "Expires"} {fmtD(r.end)}</span>
            </div>
            {isActioned && <span style={{ fontSize: TYPE.label.size, color: C.muted, border: `1px solid ${C.rule}`, padding: "2px 8px", borderRadius: 2, flexShrink: 0 }}>{SL[act]}</span>}
            {!isActioned && (isExpired||isExpiring) && licTab === "usage" && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {[{val:"ignored",label:"Ignore"},{val:"takendown",label:"Mark taken down"}].map(o => (
                  <button key={o.val} onClick={() => setAction(r.key, o.val)} style={{ fontSize: TYPE.label.size, padding: "5px 10px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", color: C.muted, fontFamily: SANS, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>{o.label}</button>
                ))}
              </div>
            )}
            {!isActioned && isExpired && licTab === "excl" && (
              <button onClick={() => setAction(r.key, "ignored")} style={{ fontSize: TYPE.label.size, padding: "5px 10px", border: `1px solid ${C.rule}`, borderRadius: 2, background: "none", cursor: "pointer", color: C.muted, fontFamily: SANS, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>Mark noted</button>
            )}
          </div>
        </div>
      );
    };
    return (
      <div>
        <DrillBack onClick={() => setDrill(null)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0 }}>License Tracker</h2>
          <div style={{ display: "flex" }}>
            <button onClick={() => setLicTab("usage")} style={{ ...tabPillS(licTab==="usage"), borderRadius: "2px 0 0 2px" }}>Usage Rights <span style={{ marginLeft: 4, fontSize: TYPE.micro.size, opacity: 0.7 }}>{usageLics.length}</span></button>
            <button onClick={() => setLicTab("excl")}  style={{ ...tabPillS(licTab==="excl"),  borderRadius: "0 2px 2px 0", borderLeft: "none" }}>Exclusivity <span style={{ marginLeft: 4, fontSize: TYPE.micro.size, opacity: 0.7 }}>{exclLics.length}</span></button>
          </div>
        </div>
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>{licTab === "usage" ? "Track when brands' usage rights expire." : "Track exclusivity periods."}</p>
        {tabLics.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.muted }}>No {licTab === "usage" ? "usage rights" : "exclusivity periods"} tracked.</p>}
        {urgentRows.length > 0 && <><p style={{ fontSize: TYPE.label.size, color: C.red, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6, fontWeight: "600" }}>Needs attention</p>{urgentRows.map((r: any) => <LicRow key={r.key} r={r} />)}</>}
        {activeRows.length > 0 && <div style={{ marginTop: urgentRows.length > 0 ? 20 : 0 }}>{urgentRows.length > 0 && <p style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6, fontWeight: "600" }}>Active</p>}{activeRows.map((r: any) => <LicRow key={r.key} r={r} />)}</div>}
        {actionedRows.length > 0 && <div style={{ marginTop: 20 }}><p style={{ fontSize: TYPE.label.size, color: C.light, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6, fontWeight: "600" }}>Handled</p>{actionedRows.map((r: any) => <LicRow key={r.key} r={r} />)}</div>}
      </div>
    );
  }

  // ── DRILL: OPEN QUOTES ────────────────────────────────────
  if (drill === "quotes") {
    const totalQ = openQ.reduce((s: number,pr: any) => s + pr.amount, 0);
    const sorted = [...openQ].sort((a: any,b: any) => { const ae = a.qd?.validUntil ? new Date(a.qd.validUntil).getTime() : Infinity; const be = b.qd?.validUntil ? new Date(b.qd.validUntil).getTime() : Infinity; return ae - be; });
    return (
      <div>
        <DrillBack onClick={() => setDrill(null)} />
        <DrillTitle title="Open Quotes" value={fmt(totalQ)} />
        {sorted.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.muted }}>No open quotes.</p>}
        {sorted.map((pr: any, i: number) => {
          const daysSent = pr.date ? Math.floor((Date.now() - new Date(pr.date).getTime()) / 86400000) : null;
          const expiry   = pr.qd?.validUntil; const daysLeft = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000) : null; const expired = daysLeft !== null && daysLeft < 0;
          const expiryCol = expired ? C.red : daysLeft !== null && daysLeft <= 7 ? C.amber : C.green;
          return (
            <div key={i} onClick={() => goToProject(pr.cName, pr.qd?.qNo)} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.rule}`, gap: 10, cursor: "pointer" }}>
              <span style={{ fontSize: TYPE.subtext.size, color: ageCol(daysSent), flexShrink: 0, minWidth: 32, fontWeight: "500" }}>{daysSent !== null ? `${daysSent}d` : "—"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500" }}>{pr.cName}</span>
                  <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 100 : 220 }}>{pr.name}</span>
                  {pr.status === "revised" && <span style={{ fontSize: TYPE.micro.size, color: C.amber, border: `1px solid ${C.amber}`, padding: "1px 5px", borderRadius: 2 }}>Revised</span>}
                </div>
                {expiry && <span style={{ fontSize: TYPE.label.size, color: expiryCol }}>{expired ? `Expired ${Math.abs(daysLeft!)}d ago` : `Expires in ${daysLeft}d · ${fmtD(expiry)}`}</span>}
              </div>
              <span style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, flexShrink: 0 }}>{fmt(pr.amount)}</span>
              <span style={{ fontSize: TYPE.label.size, color: C.light }}>→</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── DRILL: UNSIGNED CONTRACTS ─────────────────────────────
  if (drill === "contracts") {
    const totalC    = unsignedC.reduce((s: number,pr: any) => s + pr.amount, 0);
    const hasUrgent = unsignedC.some((pr: any) => pr.date && Math.floor((Date.now() - new Date(pr.date).getTime()) / 86400000) >= 14);
    const sorted    = [...unsignedC].sort((a: any,b: any) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
    return (
      <div>
        <DrillBack onClick={() => setDrill(null)} />
        <DrillTitle title="Unsigned Contracts" value={fmt(totalC)} />
        {hasUrgent && <p style={{ fontSize: TYPE.subtext.size, color: C.red, marginBottom: 16 }}>One or more contracts waiting 14+ days — follow up now.</p>}
        {sorted.length === 0 && <p style={{ fontSize: TYPE.subtext.size, color: C.muted }}>No unsigned contracts.</p>}
        {sorted.map((pr: any, i: number) => {
          const days = pr.date ? Math.floor((Date.now() - new Date(pr.date).getTime()) / 86400000) : null; const col = ageCol(days);
          return (
            <div key={i} onClick={() => goToProject(pr.cName, pr.qd?.qNo)} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.rule}`, gap: 10, cursor: "pointer" }}>
              <span style={{ fontSize: TYPE.subtext.size, color: col, flexShrink: 0, minWidth: 32, fontWeight: "500" }}>{days !== null ? `${days}d` : "—"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500" }}>{pr.cName}</span>
                  <span style={{ fontSize: TYPE.subtext.size, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: isMobile ? 100 : 220 }}>{pr.name}</span>
                </div>
                <span style={{ fontSize: TYPE.label.size, color: col }}>{days !== null && days >= 14 ? "Overdue for signature" : days !== null && days >= 7 ? "Waiting a while" : `Sent ${fmtD(pr.date)}`}</span>
              </div>
              <span style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, flexShrink: 0 }}>{fmt(pr.amount)}</span>
              <span style={{ fontSize: TYPE.label.size, color: C.light }}>→</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── DRILL: INVOICES ───────────────────────────────────────
  if (drill === "invoices") {
    const allInvRows  = buildInvoiceRows(clients);
    const tabRows     = invTab === "unpaid" ? allInvRows.filter((r: any) => !r.pr.paid) : allInvRows.filter((r: any) => r.pr.paid);
    const allInvYears = Array.from(new Set(allInvRows.map((r: any) => r.year))).sort((a: any,b: any) => b - a) as number[];
    const periodOpts  = [{ value: "all", label: "All periods" }];
    allInvYears.forEach(y => { periodOpts.push({ value:`y:${y}`, label:String(y) }); const ms = Array.from(new Set(allInvRows.filter((r: any) => r.year===y).map((r: any) => r.month))).sort((a: any,b: any) => b-a) as number[]; ms.forEach(m => periodOpts.push({ value:`m:${y}:${m}`, label:`  ${MO_SHORT[m]} ${y}` })); });
    const filteredInv = tabRows.filter((r: any) => { if (invYear==="all") return true; if (invYear.startsWith("y:")) return String(r.year)===invYear.slice(2); if (invYear.startsWith("m:")) { const[,y,m]=invYear.split(":"); return String(r.year)===y&&String(r.month)===m; } return true; });
    const invGrouped: { year: number; months: { month: number; rows: any[] }[] }[] = [];
    filteredInv.forEach((r: any) => { let yg = invGrouped.find(g=>g.year===r.year); if(!yg){yg={year:r.year,months:[]};invGrouped.push(yg);} let mg=yg.months.find(m=>m.month===r.month); if(!mg){mg={month:r.month,rows:[]};yg.months.push(mg);} mg.rows.push(r); });
    invGrouped.sort((a,b)=>b.year-a.year); invGrouped.forEach(yg=>yg.months.sort((a,b)=>b.month-a.month));
    const toggleSel  = (key: string) => setInvSel(prev => { const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n; });
    const openPreview = (r: any) => { const pr=r.pr; const q=pr.qd; setInvPdfData({data:{brand:q?.brand,contact:q?.contact,date:pr.date||today(),qNo:q?.qNo,iNo:r.iNo,delivery:pr.deliveryDate,ctype:q?.ctype||"Content Creator",lines:q?.lines||[],amendments:pr.amendments||[],total:pr.amount,footer:"Thank you for the pleasure of working together."},type:"invoice"}); };
    const exportCsv  = (rows: any[], label: string) => { const h=["Invoice No.","Client","Project","Income","Date","Status"]; const lines=[h,...rows.map(r=>[r.iNo,r.cName,r.pr.name,`€ ${Number(r.pr.amount).toFixed(2).replace(".",",")}`,r.pr.date||"",r.pr.paid?"paid":"invoiced"])]; const csv=lines.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n"); const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${label.replace(/[:\s]/g,"_")}.csv`; a.click(); URL.revokeObjectURL(url); };
    const tabPillS   = (active: boolean): any => ({padding:"6px 15px",border:`1px solid ${active?C.black:C.rule}`,background:active?C.black:"none",color:active?C.white:C.muted,cursor:"pointer",fontFamily:SANS,fontSize:TYPE.label.size,letterSpacing:"0.1em",textTransform:"uppercase" as const,outline:"none"});
    return (
      <div>
        <DrillBack onClick={() => { setDrill(null); setInvSel(new Set()); }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" as const }}>
          <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0 }}>Invoices</h2>
          <div style={{ display: "flex" }}>
            <button onClick={() => { setInvTab("unpaid"); setInvSel(new Set()); }} style={{...tabPillS(invTab==="unpaid"),borderRadius:"2px 0 0 2px"}}>Unpaid <span style={{marginLeft:4,fontSize:TYPE.micro.size,opacity:0.7}}>{allInvRows.filter((r: any)=>!r.pr.paid).length}</span></button>
            <button onClick={() => { setInvTab("paid");   setInvSel(new Set()); }} style={{...tabPillS(invTab==="paid"),borderRadius:"0 2px 2px 0",borderLeft:"none"}}>Paid <span style={{marginLeft:4,fontSize:TYPE.micro.size,opacity:0.7}}>{allInvRows.filter((r: any)=>r.pr.paid).length}</span></button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <select value={invYear} onChange={(e: any)=>{setInvYear(e.target.value);setInvSel(new Set());}} style={{height:28,padding:"0 8px",border:`1px solid ${C.rule}`,borderRadius:2,background:C.bg,fontFamily:SANS,fontSize:TYPE.label.size,color:C.black,outline:"none"}}>
            {periodOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={()=>exportCsv(filteredInv,invYear==="all"?"all_invoices":invYear)} style={{height:28,padding:"0 10px",border:`1px solid ${C.rule}`,borderRadius:2,background:C.bg,cursor:"pointer",fontFamily:SANS,fontSize:TYPE.label.size,color:C.muted}}>Export CSV</button>
        </div>
        {filteredInv.length === 0 && <p style={{fontSize:TYPE.subtext.size,color:C.muted}}>No invoices match this filter.</p>}
        {invGrouped.map((yg,yi)=>(
          <div key={yg.year}>
            <p style={{fontSize:TYPE.subtext.size,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase" as const,margin:`${yi===0?"0":"20px"} 0 10px`,fontWeight:"600"}}>{yg.year}</p>
            {yg.months.map(mg=>(
              <div key={mg.month} style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:TYPE.subtext.size,color:C.light,letterSpacing:"0.09em",textTransform:"uppercase" as const}}>{MO_LONG[mg.month]} {yg.year} · {mg.rows.length}</span>
                  <button onClick={()=>exportCsv(mg.rows,`${MO_SHORT[mg.month]}_${yg.year}`)} style={{height:22,padding:"0 8px",border:`1px solid ${C.rule}`,borderRadius:2,background:C.bg,cursor:"pointer",fontFamily:SANS,fontSize:TYPE.micro.size,color:C.muted}}>CSV</button>
                </div>
                <div style={{borderTop:`1px solid ${C.rule}`}}/>
                {mg.rows.map((r: any,i: number)=>{
                  const pr=r.pr; const isChecked=invSel.has(r.iNo);
                  return(
                    <div key={r.iNo+i} style={{display:"flex",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.rule}`,gap:10,background:isChecked?"rgba(0,0,0,0.015)":undefined}}>
                      <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>openPreview(r)}>
                        <div style={{display:"flex",alignItems:"baseline",gap:7,flexWrap:"wrap" as const}}>
                          <span style={{fontSize:TYPE.body.size,color:C.black,fontWeight:"500"}}>{r.iNo}</span>
                          <span style={{fontSize:TYPE.subtext.size,color:C.muted}}>{r.cName}</span>
                          <span style={{fontSize:TYPE.subtext.size,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,maxWidth:isMobile?90:200}}>{pr.name}</span>
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:3,alignItems:"center"}}>
                          <span style={{fontSize:TYPE.label.size,color:C.light}}>{fmtD(pr.date)}</span>
                          <span style={{fontSize:TYPE.label.size,color:pr.paid?C.green:C.amber,border:`1px solid ${pr.paid?C.green:C.amber}`,padding:"2px 7px",borderRadius:2}}>{pr.paid?"Paid":"Invoiced"}</span>
                        </div>
                      </div>
                      <span style={{fontFamily:SERIF,fontSize:TYPE.sectionHeading.size,color:C.black,flexShrink:0}}>{fmt(pr.amount)}</span>
                      <input type="checkbox" checked={isChecked} onChange={()=>toggleSel(r.iNo)} style={{flexShrink:0,cursor:"pointer",accentColor:C.black,width:13,height:13}} onClick={(e: any)=>e.stopPropagation()}/>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
        {invSel.size > 0 && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#fdf6ee",border:`1px solid ${C.amber}`,borderRadius:2,marginTop:12}}>
            <span style={{fontSize:TYPE.subtext.size,color:C.amber}}>{invSel.size} selected</span>
            <button onClick={()=>setInvSel(new Set())} style={{fontSize:TYPE.label.size,padding:"5px 12px",border:`1px solid ${C.amber}`,borderRadius:2,background:"none",cursor:"pointer",color:C.amber,fontFamily:SANS}}>Clear</button>
          </div>
        )}
      </div>
    );
  }

  // ── MAIN DASHBOARD ────────────────────────────────────────
  const ACTIONED   = ["ignored","takendown","renewal"];
  const needsAttFn = (r: any) => !ACTIONED.includes(licenseActions[r.key] || "");
  const urgentLics = allLicenses.filter((r: any) => needsAttFn(r) && (dLeft(r.end)??999) <= 7);
  const allClear   = urgentLics.length === 0;
  const hasRed     = urgentLics.some((r: any) => (dLeft(r.end)??0) < 0);
  const stages     = [
    { label:"Production", count: activeProjects.filter((pr: any) => pr.status==="production").length, color: C.blue  },
    { label:"Invoiced",   count: activeProjects.filter((pr: any) => pr.status==="invoiced").length,   color: C.amber },
    { label:"Contracted", count: activeProjects.filter((pr: any) => pr.status==="contracted").length, color: C.amber },
    { label:"Quoted",     count: activeProjects.filter((pr: any) => pr.status==="quoted"||pr.status==="revised").length, color: C.light },
  ].filter(s => s.count > 0);
  const stageTotal = activeProjects.length || 1;

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 14px", color: C.black }}>Dashboard</h2>

      {/* ── ROW 1 — 4 stat boxes ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
        {[
          { label:"Unpaid",      val:unpaid.length,   sub:unpaid.length>0?`${fmt(out)} out`:"All clear",     color:unpaid.length>0?C.amber:C.light,   bg:unpaid.length>0?"#fdf6ee":C.bg,   border:unpaid.length>0?C.amber:C.rule,   drill:"invoices"  },
          { label:"Unsigned",    val:unsignedC.length, sub:unsignedC.length>0?"contracts":"All clear",        color:unsignedC.length>0?C.amber:C.light, bg:unsignedC.length>0?"#fdf6ee":C.bg, border:unsignedC.length>0?C.amber:C.rule, drill:"contracts" },
          { label:"Open quotes", val:openQ.length,    sub:"awaiting reply",                                   color:openQ.length>0?C.black:C.light,    bg:C.bg,                             border:C.rule,                           drill:"quotes"    },
          { label:`Revenue · ${MO[nowM]}`, val:thisMonthRev>0?fmt(thisMonthRev):"—", sub:revChange!==null?`${revChange>=0?"+":""}${revChange}% vs ${MO[nowM-1]}`:String(nowY), color:thisMonthRev>0?C.green:C.light, bg:C.bg, border:C.rule, drill:"month" },
        ].map(item => (
          <div key={item.drill} onClick={() => setDrill(item.drill)} style={{ border: `1px solid ${item.border}`, borderRadius: 2, padding: "13px 15px", background: item.bg, cursor: "pointer" }}>
            <p style={{ fontSize: TYPE.micro.size, color: item.color===C.light?C.muted:item.color, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 6px" }}>{item.label}</p>
            <p style={{ fontFamily: SERIF, fontSize: TYPE.kpi.size, color: item.color, margin: "0 0 3px", lineHeight: 1 }}>{item.val}</p>
            <p style={{ fontSize: TYPE.micro.size, color: item.color }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── ROW 2 — 2×2 card grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>

        <DCard label="Active projects" onClick={() => setDrill("projects")}>
          {activeProjects.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.light }}>No active projects.</p>}
          {stages.map((s,i) => (
            <div key={i} style={{ marginBottom: i < stages.length-1 ? 8 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: TYPE.label.size, color: C.black }}>{s.label}</span>
                <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{s.count}</span>
              </div>
              <HBar pct={Math.round((s.count/stageTotal)*100)} color={s.color} />
            </div>
          ))}
        </DCard>

        <DCard label="Invoices unpaid" onClick={() => setDrill("invoices")} bg={unpaid.length>0?"#fdf6ee":undefined} border={unpaid.length>0?C.amber:undefined}>
          {unpaid.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.light }}>No unpaid invoices.</p>}
          {[...unpaid].sort((a: any,b: any) => (a.date||"").localeCompare(b.date||"")).slice(0,4).map((pr: any,i: number,arr: any[]) => {
            const days = pr.date ? Math.floor((Date.now()-new Date(pr.date).getTime())/86400000) : null;
            const maxD = Math.max(...arr.map((p: any) => p.date ? Math.floor((Date.now()-new Date(p.date).getTime())/86400000) : 0), 1);
            return (
              <div key={i} style={{ marginBottom: i<arr.length-1?8:0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: TYPE.label.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "75%" }}>{pr.cName}</span>
                  <span style={{ fontSize: TYPE.label.size, color: ageCol(days) }}>{days!==null?`${days}d`:"—"}</span>
                </div>
                <HBar pct={days!==null?Math.round((days/maxD)*100):5} color={ageCol(days)} />
              </div>
            );
          })}
          {unpaid.length > 4 && <p style={{ fontSize: TYPE.micro.size, color: C.light, margin: "6px 0 0" }}>+{unpaid.length-4} more</p>}
        </DCard>

        <DCard label="Open quotes" onClick={() => setDrill("quotes")}>
          {openQ.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.light }}>No open quotes.</p>}
          {[...openQ].sort((a: any,b: any) => { const ae=a.qd?.validUntil?new Date(a.qd.validUntil).getTime():Infinity; const be=b.qd?.validUntil?new Date(b.qd.validUntil).getTime():Infinity; return ae-be; }).slice(0,4).map((pr: any,i: number,arr: any[]) => {
            const days = pr.date ? Math.floor((Date.now()-new Date(pr.date).getTime())/86400000) : null;
            const maxD = Math.max(...arr.map((p: any) => p.date?Math.floor((Date.now()-new Date(p.date).getTime())/86400000):0),1);
            return (
              <div key={i} style={{ marginBottom: i<arr.length-1?8:0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: TYPE.label.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "75%" }}>{pr.cName}</span>
                  <span style={{ fontSize: TYPE.label.size, color: ageCol(days) }}>{days!==null?`${days}d`:"—"}</span>
                </div>
                <HBar pct={days!==null?Math.round((days/maxD)*100):5} color={ageCol(days)} />
              </div>
            );
          })}
          {openQ.length > 4 && <p style={{ fontSize: TYPE.micro.size, color: C.light, margin: "6px 0 0" }}>+{openQ.length-4} more</p>}
        </DCard>

        <DCard label="License tracker" onClick={() => setDrill("license")} bg={hasRed?"#fdf0f0":!allClear?"#fdf6ee":undefined} border={hasRed?C.red:!allClear?C.amber:undefined}>
          {allClear && <p style={{ fontSize: TYPE.label.size, color: C.green }}>No action needed.</p>}
          {!allClear && urgentLics.slice(0,4).map((r: any,i: number) => {
            const d=dLeft(r.end); const isExp=d!==null&&d<0; const col=isExp?C.red:C.amber; const txt=isExp?`+${Math.abs(d!)}d expired`:d!==null?`${d}d left`:"—";
            return (
              <div key={i} style={{ marginBottom: i<urgentLics.slice(0,4).length-1?8:0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: TYPE.label.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "70%" }}>{r.cName} <span style={{ color: C.light, fontSize: TYPE.micro.size }}>{r.type==="excl"?"· Excl.":"· Usage"}</span></span>
                  <span style={{ fontSize: TYPE.label.size, color: col }}>{txt}</span>
                </div>
                <HBar pct={isExp?100:d!==null?Math.max(5,Math.round(((90-d)/90)*100)):5} color={col} />
              </div>
            );
          })}
          {urgentLics.length > 4 && <p style={{ fontSize: TYPE.micro.size, color: C.light, margin: "6px 0 0" }}>+{urgentLics.length-4} more</p>}
        </DCard>

      </div>

      {/* ── ROW 3 — revenue bar chart ── */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 15px", background: C.bg, cursor: "pointer" }} onClick={() => setDrill("revenue")}>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 4px" }}>
          Revenue · {nowY} <span style={{ fontFamily: SERIF, fontSize: TYPE.subtext.size, color: C.black, letterSpacing: 0, textTransform: "none" as const, fontWeight: "normal" }}>{fmt(thisYearRev)}</span>
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 52, marginTop: 8 }}>
          {revMonthly.map((v,i) => {
            const h = Math.max(3, Math.round((v/revMax)*44));
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 }}>
                {v > 0 && <span style={{ fontSize: TYPE.micro.size, color: i===nowM?C.green:C.muted }}>{i===nowM?fmt(v).replace("€ ",""):""}</span>}
                <div style={{ width: "100%", background: i===nowM?C.green:v>0?C.black:C.rule, borderRadius: 2, height: `${h}px` }} />
                <span style={{ fontSize: TYPE.micro.size, color: i===nowM?C.green:C.light, letterSpacing: "0.04em" }}>{MO[i][0]}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
