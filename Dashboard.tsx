// ─────────────────────────────────────────────────────────────
// Dashboard — read-only overview, to read at a glance.
//   Revenue     paid invoices by PAID date (net), month bars, and
//               the § 19 line while Kleinunternehmer is on
//   Money flow  Unpaid (issued, not paid · gross, overdue count)
//               Signed (contracted + production, not invoiced yet)
//               Pipeline (open quotes)
//   Licenses    one line: expiring / expired
//   By offer    paid revenue split by the invoice lines' category
// Every card opens the tab where the work happens, already filtered.
// Colours: one meaning each (constants › PAL).
// ─────────────────────────────────────────────────────────────

import { DashCard, DashCardHead, DashStrip, DashTile, DashIcon, WideRow, LinkRow, BarList, SwitchPill, SectionHead } from "./atoms";
import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { C, SANS, SERIF, PAL, RADIUS, SHADOW, CATEGORY, catKeyOf, WORDS, TYPE, TRACK } from "./constants";
import { fmt, today } from "./formatters";
import { docsOf, isOpenInvoice, isPaidInvoice, isOverdue, paidDateOf, lineAmt } from "./docs";
import { allLicenses, needsAction } from "./licenses";
import { signedOpen, isSigned } from "./money";
import { Ico, IC } from "./PlannerWindows";

const MO = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const KU_LIMIT = 25000;   // § 19 UStG: more revenue than this in a year ends Kleinunternehmer for the next year
const pct2 = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const int  = (n: number) => Math.round(n).toLocaleString("de-DE");
const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const };
type ToneSet = { fill: string; wash: string; mid: string; ink: string };

interface DashboardProps {
  clients:         any[];
  isMobile:        boolean;
  settings?:       any;
  onOpenInvoices?: (filter: "paid" | "unpaid" | "overdue", month?: string) => void;
  onOpenProjects?: (filter: string) => void;
  onOpenLicenses?: (filter?: "action" | "active") => void;
  [key: string]: any;
}

export default function Dashboard({ clients, isMobile, settings, onOpenInvoices, onOpenProjects, onOpenLicenses }: DashboardProps) {
  const todayStr = today();
  const thisYear = parseInt(todayStr.slice(0, 4));

  const data = useMemo(() => {
    const projects = (clients || []).flatMap((c: any) => c.projects || []);
    const invoicesOf = (pr: any) => docsOf(pr).filter((d: any) => d.kind === "invoice");
    const paid = projects.flatMap((pr: any) => invoicesOf(pr).filter(isPaidInvoice).map((d: any) => ({ d, pr })));
    const open = projects.flatMap((pr: any) => invoicesOf(pr).filter(isOpenInvoice));
    const years = Array.from(new Set([thisYear, ...paid.map(x => parseInt(paidDateOf(x.d).slice(0, 4))).filter(Boolean)])).sort((a, b) => a - b);
    const quoted = projects.filter((p: any) => !p.paid && (p.status === "quoted" || p.status === "revised"));
    // signed, not invoiced yet: what was already invoiced on a project (retainer months …) is taken off
    const signed = projects.filter(isSigned);
    const signedValue = signed.reduce((s: number, p: any) => s + signedOpen(p), 0);   // money.ts — same rule as Projects and Clients
    const lic = allLicenses(clients).filter(needsAction);
    return { paid, open, years, quoted, signed, signedValue, lic };
  }, [clients, thisYear]);

  const [year, setYear] = useState(thisYear);
  const yi = data.years.indexOf(year);
  const paidInYear = data.paid.filter(x => paidDateOf(x.d).startsWith(String(year)));
  const revenue    = paidInYear.reduce((s, x) => s + (Number(x.d.net) || 0), 0);
  const byMonth    = Array.from({ length: 12 }, (_, m) => paidInYear
    .filter(x => parseInt(paidDateOf(x.d).slice(5, 7)) - 1 === m)
    .reduce((s, x) => s + (Number(x.d.net) || 0), 0));
  const maxMonth   = Math.max(1, ...byMonth);
  const curMonth   = year === thisYear ? parseInt(todayStr.slice(5, 7)) - 1 : -1;
  const outstanding = data.open.reduce((s: number, d: any) => s + (Number(d.gross) || 0), 0);
  const overdue     = data.open.filter((d: any) => isOverdue(d, todayStr)).length;
  const pipeline    = data.quoted.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const expired     = data.lic.filter(l => l.state === "expired").length;
  const expiring    = data.lic.filter(l => l.state === "expiring").length;
  const ku          = settings?.kleinunternehmer !== false && settings?.kleinunternehmer !== "false";
  const kuPct       = (revenue / KU_LIMIT) * 100;
  const kuTone: ToneSet = kuPct >= 100 ? PAL.late : kuPct >= 80 ? PAL.waiting : PAL.neutral;

  // revenue by offer: each paid invoice split by its lines' category (shares of its net)
  const offers = (() => {
    const m: Record<string, number> = {};
    paidInYear.forEach(({ d, pr }) => {
      const net = Number(d.net) || 0;
      const lines = (d.data?.lines || []).filter((l: any) => lineAmt(l) > 0);
      const fallback = catKeyOf(pr?.qd?.ctab || pr?.qd?.lines?.[0]?.cat || "") || "other";
      const sum = lines.reduce((s: number, l: any) => s + lineAmt(l), 0);
      if (!sum) { m[fallback] = (m[fallback] || 0) + net; return; }
      lines.forEach((l: any) => { const k = catKeyOf(l.cat) || fallback; m[k] = (m[k] || 0) + net * lineAmt(l) / sum; });
    });
    return Object.entries(m).filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ k, label: CATEGORY[k]?.label || "Other", v }));
  })();

  // ── pieces ──────────────────────────────────────────────────
  // ── pieces: the master parts (atoms) — this dashboard is the master for every app ──
  const circle = (d: string, t: ToneSet, bg?: string) => <DashIcon tone={t} bg={bg}><Ico d={d} size={12} /></DashIcon>;
  const tile = (t: ToneSet, icon: string, label: string, value: string, sub: ReactNode, onClick?: () => void) => (
    <DashTile tone={t} icon={<Ico d={icon} size={12} />} label={label} value={value} sub={sub} onClick={onClick} />
  );
  const yearBtn = (label: string, to: number | undefined, ch: string) => (
    <button onClick={() => to !== undefined && setYear(to)} disabled={to === undefined} aria-label={label}
      style={{ background: "none", border: "none", padding: "0 8px", height: 28, cursor: to === undefined ? "default" : "pointer", color: to === undefined ? C.faint : C.muted, fontFamily: SANS, fontSize: TYPE.body.size }}>{ch}</button>
  );
  const licTone: ToneSet = expired ? PAL.late : expiring ? PAL.waiting : PAL.done;
  const licText = expired && expiring ? `${expired} expired · ${expiring} expiring` : expired ? `${expired} expired` : expiring ? `${expiring} expiring` : "Nothing expiring";

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Dashboard</h2>
        <SwitchPill>
          {yearBtn("Previous year", data.years[yi - 1], "‹")}<span style={{ minWidth: 40, textAlign: "center" as const }}>{year}</span>{yearBtn("Next year", data.years[yi + 1], "›")}
        </SwitchPill>
      </div>
      <div style={{ ...microLabel, letterSpacing: TRACK.caps, color: C.muted, marginTop: 4 }}>Overview · read only</div>

      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <div>
          {/* ── revenue ── */}
          <DashCard onClick={onOpenInvoices ? () => onOpenInvoices("paid") : undefined}>
            <div style={{ padding: "11px 13px 9px" }}>
              <DashCardHead icon={circle(IC.euro, PAL.done)} label={`Revenue ${year}`} arrow={!!onOpenInvoices} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
                <div style={{ fontFamily: SERIF, fontSize: TYPE.kpi.size, lineHeight: 1.05, whiteSpace: "nowrap" as const }}>{fmt(revenue)}</div>
                <div style={{ fontSize: TYPE.label.size, color: C.muted, textAlign: "right" as const, lineHeight: 1.35 }}>
                  {paidInYear.length} paid invoice{paidInYear.length === 1 ? "" : "s"}
                  {curMonth >= 0 && <><br />{MO[curMonth]} {fmt(byMonth[curMonth])}</>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4, alignItems: "end", height: 38, marginTop: 10 }}>
                {byMonth.map((v, m) => {
                  const go = v > 0 && onOpenInvoices ? (e: any) => { e.stopPropagation(); onOpenInvoices("paid", `${year}-${String(m + 1).padStart(2, "0")}`); } : undefined;
                  return (
                    <button key={m} onClick={go} disabled={!go} aria-label={`${MO[m]}: ${fmt(v)}`} title={`${MO[m]} · ${fmt(v)}`}
                      style={{ height: v > 0 ? Math.max(6, Math.round((v / maxMonth) * 38)) : 3, background: v > 0 ? (m === curMonth ? PAL.done.mid : PAL.done.fill) : m > curMonth && curMonth >= 0 ? PAL.neutral.wash : PAL.neutral.fill,
                        borderRadius: v > 0 ? 5 : 2, border: "none", padding: 0, cursor: go ? "pointer" : "default", width: "100%" }} />
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4, marginTop: 4, fontSize: TYPE.micro.size, color: C.light, textAlign: "center" as const }}>
                {MO.map((m, k) => <span key={m} style={{ color: k === curMonth ? C.black : undefined }}>{m}</span>)}
              </div>
            </div>
            {ku && <DashStrip tone={kuTone} left={<>Kleinunternehmer · {int(revenue)} of {int(KU_LIMIT)} €</>} right={pct2(kuPct)} pct={kuPct} />}
          </DashCard>
        </div>

        <div>
          {/* ── money flow ── */}
          <SectionHead label="Money flow" />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            {tile(PAL.waiting, IC.hourglass, WORDS.unpaid, fmt(outstanding),
              <>{data.open.length} open{overdue ? <> · <span style={{ color: PAL.late.ink }}>{overdue} overdue</span></> : ""}</>,
              onOpenInvoices ? () => onOpenInvoices(overdue ? "overdue" : "unpaid") : undefined)}
            {tile(PAL.progress, IC.sign, WORDS.toInvoice, fmt(data.signedValue),
              `${data.signed.length} project${data.signed.length === 1 ? "" : "s"} · not invoiced`,
              onOpenProjects ? () => onOpenProjects("signed") : undefined)}
            <WideRow icon={<Ico d={IC.file} size={12} />} label="Pipeline" onClick={onOpenProjects ? () => onOpenProjects("quoted") : undefined}
              right={<>
                <span style={{ fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const }}>{data.quoted.length} quote{data.quoted.length === 1 ? "" : "s"}</span>
                <span style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, whiteSpace: "nowrap" as const }}>{fmt(pipeline)}</span>
              </>} />
          </div>

          {/* ── licenses ── */}
          <LinkRow icon={circle(IC.shield, licTone)} label="Licenses" tag={licText} tone={licTone} tagFilled={!!(expired || expiring)}
            onClick={onOpenLicenses ? () => onOpenLicenses(expired + expiring ? "action" : "active") : undefined} />

          {/* ── revenue by offer ── */}
          <SectionHead label={`Revenue by offer · ${year}`} />
          <BarList empty={`No paid invoices in ${year} yet.`}
            rows={offers.map(o => ({ key: o.k, label: o.label, value: fmt(o.v), pctText: pct2(revenue ? (o.v / revenue) * 100 : 0), pct: revenue ? Math.min(100, (o.v / revenue) * 100) : 0 }))} />
        </div>
      </div>
    </div>
  );
}
