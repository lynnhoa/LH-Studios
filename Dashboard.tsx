// ─────────────────────────────────────────────────────────────
// Dashboard — read-only overview, to read at a glance.
// No to-do lists, no drill-down screens: a tile opens the tab
// where the work happens (Invoices, Projects, Licenses).
// Money comes from the invoices themselves:
//   Revenue     = paid invoices by PAID date (incl. retainer months,
//                 renewals, amendments; cancelled ones don't count)
//   Outstanding = issued, not yet paid (gross), with overdue count
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE, STATUS_COLOR, STATUS_NAME } from "./constants";
import { fmt, today } from "./formatters";
import { Segmented } from "./atoms";
import { docsOf, isOpenInvoice, isPaidInvoice, isOverdue, paidDateOf } from "./docs";
import { allLicenses, needsAction } from "./licenses";

const MO = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

interface DashboardProps {
  clients:         any[];
  isMobile:        boolean;
  settings?:       any;
  onOpenInvoices?: (filter: "paid" | "unpaid" | "overdue") => void;
  onOpenProjects?: (filter: string) => void;
  onOpenLicenses?: () => void;
  [key: string]: any;
}

export default function Dashboard({ clients, isMobile, onOpenInvoices, onOpenProjects, onOpenLicenses }: DashboardProps) {
  const todayStr = today();
  const thisYear = parseInt(todayStr.slice(0, 4));

  const data = useMemo(() => {
    const projects = (clients || []).flatMap((c: any) => c.projects || []);
    const invoices = projects.flatMap((pr: any) => docsOf(pr).filter((d: any) => d.kind === "invoice"));
    const paid = invoices.filter(isPaidInvoice);
    const open = invoices.filter(isOpenInvoice);
    const years = Array.from(new Set([thisYear, ...paid.map((d: any) => parseInt(paidDateOf(d).slice(0, 4))).filter(Boolean)])).sort((a, b) => b - a);
    const quoted = projects.filter((p: any) => p.status === "quoted" || p.status === "revised");
    const stages = ["contracted", "production", "invoiced"].map(st => ({ st, n: projects.filter((p: any) => p.status === st && !p.paid).length }));
    const lic = allLicenses(clients).filter(needsAction);
    return { paid, open, years, quoted, stages, lic };
  }, [clients, thisYear]);

  const [year, setYear] = useState(String(thisYear));
  const paidInYear = data.paid.filter((d: any) => paidDateOf(d).startsWith(year));
  const revenue    = paidInYear.reduce((s: number, d: any) => s + (Number(d.net) || 0), 0);
  const byMonth    = Array.from({ length: 12 }, (_, m) => paidInYear
    .filter((d: any) => parseInt(paidDateOf(d).slice(5, 7)) - 1 === m)
    .reduce((s: number, d: any) => s + (Number(d.net) || 0), 0));
  const maxMonth   = Math.max(1, ...byMonth);
  const outstanding = data.open.reduce((s: number, d: any) => s + (Number(d.gross) || 0), 0);
  const overdue     = data.open.filter((d: any) => isOverdue(d, todayStr)).length;
  const pipeline    = data.quoted.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const activeN     = data.stages.reduce((s, x) => s + x.n, 0);
  const expired     = data.lic.filter(l => l.state === "expired").length;
  const expiring    = data.lic.filter(l => l.state === "expiring").length;

  const tile = (label: string, value: string, sub: string, onClick?: () => void, subColor?: string) => (
    <div onClick={onClick} role={onClick ? "button" : undefined}
      style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "14px 16px", cursor: onClick ? "pointer" : "default", background: C.bg, minWidth: 0 }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 8px" }}>{label}</p>
      <p style={{ fontFamily: SERIF, fontSize: TYPE.amount.size, color: C.black, margin: "0 0 4px", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
      <p style={{ fontSize: TYPE.label.size, color: subColor || C.muted, margin: 0 }}>{sub}</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" as const, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px", color: C.black }}>Dashboard</h2>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>Overview · read only</p>
        </div>
        {data.years.length > 1 && (
          <Segmented options={data.years.map(y => [String(y), String(y)] as [string, string])} value={year} onChange={setYear} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: 22 }}>
        {tile(`Revenue ${year}`, fmt(revenue), `${paidInYear.length} paid invoice${paidInYear.length === 1 ? "" : "s"}`, onOpenInvoices ? () => onOpenInvoices("paid") : undefined)}
        {tile("Outstanding", fmt(outstanding), `${data.open.length} open${overdue ? ` · ${overdue} overdue` : ""}`, onOpenInvoices ? () => onOpenInvoices(overdue ? "overdue" : "unpaid") : undefined, overdue ? C.red : undefined)}
        {tile("Pipeline", fmt(pipeline), `${data.quoted.length} open quote${data.quoted.length === 1 ? "" : "s"}`, onOpenProjects ? () => onOpenProjects("quoted") : undefined)}
        {tile("Active projects", String(activeN), data.stages.filter(x => x.n).map(x => `${x.n} ${STATUS_NAME[x.st]}`).join(" · ") || "none", onOpenProjects ? () => onOpenProjects("active") : undefined)}
        {tile("Licenses", String(expired + expiring), expired + expiring ? `${expiring} expiring · ${expired} expired` : "nothing expiring", onOpenLicenses, expired ? C.red : expiring ? C.amber : undefined)}
      </div>

      {/* Revenue by month (paid date) */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "14px 16px", marginBottom: 22 }}>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 12px" }}>Revenue by month · {year}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: isMobile ? 3 : 8, alignItems: "end", height: 150 }}>
          {byMonth.map((v, m) => (
            <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
              {v > 0 && !isMobile && <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginBottom: 3, whiteSpace: "nowrap" as const }}>{Math.round(v).toLocaleString("de-DE")}</span>}
              <div title={fmt(v)} style={{ width: "100%", maxWidth: 34, height: `${Math.max(v > 0 ? 3 : 1, Math.round((v / maxMonth) * 110))}px`, background: v > 0 ? C.black : C.rule, borderRadius: 1 }} />
              <span style={{ fontSize: TYPE.micro.size, color: C.light, marginTop: 4 }}>{MO[m]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Projects by stage */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "14px 16px" }}>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>Projects by stage</p>
        {(() => {
          const rows = [{ st: "quoted", n: data.quoted.length }, ...data.stages];
          const total = Math.max(1, rows.reduce((s, x) => s + x.n, 0));
          return (
            <>
              <div style={{ display: "flex", height: 10, borderRadius: 2, overflow: "hidden", background: C.rule, marginBottom: 10 }}>
                {rows.filter(x => x.n).map(x => <div key={x.st} style={{ width: `${(x.n / total) * 100}%`, background: STATUS_COLOR[x.st] }} />)}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const }}>
                {rows.map(x => (
                  <span key={x.st} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: TYPE.label.size, color: C.muted, fontFamily: SANS }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[x.st] }} />
                    {STATUS_NAME[x.st]} {x.n}
                  </span>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
