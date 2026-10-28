// ─────────────────────────────────────────────────────────────
// BusinessCases — Business › Trips and Business › Events (one build for
// both, like Maintenance's tabs). The year's trips (T1, T2 …) or events
// (E1 …) in number order. A card opens in place:
//   its receipts (T3.1, T3.2 … — tap = the receipt window), for a trip the
//   worked-out meal allowance and the own-car km, then the buttons
//   Trip report / Event report · and the links + Add receipt · Trip details.
// + Add trip opens the trip window empty; after Add the new card is open.
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL } from "./constants";
import { SummaryLine, Strong, PillBtn, ListCard, Row, IconCircle, TonedTag, SectionHead, LoadErrorBanner } from "./atoms";
import { fmt, fmtD, today } from "./formatters";
import { numbersOf, caseYear, caseTotal, costsOf, mealDays, kmAmount, dateRange, sortCases, accountName } from "./business";
import type { BizCase, BizCost, CaseKind } from "./business";
import type { BusinessHook } from "./useBusiness";
import ReceiptWindow from "./BusinessReceipt";
import CaseWindow from "./BusinessCaseWindow";
import ReportWindow from "./BusinessReport";
import { BizIco, BIZ_IC, YearStrip, kuOf } from "./BusinessParts";

type Win =
  | { t: "case"; id: string | null }
  | { t: "receipt"; id: string | null; caseId: string; returnOf?: string | null }
  | { t: "report"; id: string };

const link: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const, WebkitTapHighlightColor: "transparent",
};
const accTone = (a: string) => (a === "lynnhoa" ? PAL.lynnhoa : a === "createbylynn" ? PAL.createbylynn : PAL.neutral);

export default function BusinessCases({ kind, biz, settings, clients, isMobile, year, setYear, years, totals }: {
  kind: CaseKind; biz: BusinessHook; settings: any; clients: any[]; isMobile: boolean;
  year: number; setYear: (y: number) => void; years: number[]; totals: { total: number; counted: number };
}) {
  const ku = kuOf(settings);
  const trip = kind === "trip";
  const word = trip ? "trip" : "event";
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [win, setWin] = useState<Win | null>(null);
  const nums = useMemo(() => numbersOf(biz.costs, biz.cases), [biz.costs, biz.cases]);
  const catOf = (id: string | null) => biz.cats.find(c => c.id === id) || null;
  const list = sortCases(biz.cases.filter(x => x.kind === kind && caseYear(x) === year));
  const sum = list.reduce((s, x) => s + caseTotal(x, biz.costs), 0);
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const openCase = (id: string) => setOpen(prev => new Set(prev).add(id));

  const costRight = (c: BizCost) => (
    <div style={{ textAlign: "right" as const }}>
      <div style={{ fontSize: TYPE.row.size, whiteSpace: "nowrap" as const }}>{fmt(c.amount)}</div>
      {c.filePath
        ? <TonedTag tone={PAL.neutral} s={{ marginTop: 3 }}>{catOf(c.categoryId)?.name || "No category"}</TonedTag>
        : <TonedTag tone={PAL.waiting} s={{ marginTop: 3 }}>No file</TonedTag>}
    </div>
  );
  // a receipt's default date: the trip's first day, or today while the trip is on
  const receiptDate = (x: BizCase) => { const t = today(); return t >= x.startDate && t <= (x.endDate || x.startDate) ? t : x.startDate || t; };
  const sub = { minHeight: 44, padding: "6px 10px 6px 22px" };

  const card = (x: BizCase, i: number) => {
    const isOpen = open.has(x.id);
    const no = nums.get(x.id) || "";
    const costs = costsOf(x, biz.costs);
    const days = trip ? mealDays(x) : [];
    const meals = days.reduce((s, d) => s + d.amount, 0);
    const km = kmAmount(x);
    const right = (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ textAlign: "right" as const }}>
          <div style={{ fontSize: TYPE.body.size, whiteSpace: "nowrap" as const }}>{fmt(caseTotal(x, biz.costs))}</div>
          <TonedTag tone={accTone(x.account)} s={{ marginTop: 3 }}>{accountName(x.account)}</TonedTag>
        </div>
        <span style={{ color: C.faint, display: "flex" }}><BizIco d={isOpen ? BIZ_IC.up : BIZ_IC.down} size={15} /></span>
      </div>
    );
    return (
      <div key={x.id}>
        <Row first={i === 0} chevron={false} onClick={() => toggle(x.id)}
          icon={<IconCircle tone={PAL.neutral}><BizIco d={trip ? BIZ_IC.trip : BIZ_IC.event} /></IconCircle>}
          title={x.title || (trip ? "Trip" : "Event")}
          meta={[no, dateRange(x.startDate, x.endDate), x.place].filter(Boolean).join(" · ")} right={right} />
        {isOpen && (
          <>
            {costs.map(c => (
              <Row key={c.id} s={sub} onClick={() => setWin({ t: "receipt", id: c.id, caseId: x.id })}
                icon={<IconCircle tone={PAL.neutral} size={22}><BizIco d={c.returnOf ? BIZ_IC.back : BIZ_IC.receipt} size={12} /></IconCircle>}
                title={`${nums.get(c.id) || ""} · ${c.what || c.vendor || "Receipt"}`}
                meta={[fmtD(c.date), c.what && c.vendor ? c.vendor : "", c.returnOf ? `↩ ${nums.get(c.returnOf) || "—"}` : ""].filter(Boolean).join(" · ")}
                right={costRight(c)} />
            ))}
            {costs.length === 0 && (
              <Row s={sub} chevron={false} icon={<IconCircle tone={PAL.neutral} size={22}><BizIco d={BIZ_IC.receipt} size={12} /></IconCircle>}
                title={<span style={{ color: C.muted }}>No receipts yet</span>} meta="Add them with + Add receipt" />
            )}
            {trip && days.length > 0 && (
              <Row s={sub} onClick={() => setWin({ t: "case", id: x.id })}
                icon={<IconCircle tone={PAL.neutral} size={22}><BizIco d={BIZ_IC.meal} size={12} /></IconCircle>}
                title={`Meal allowance · ${days.length} ${days.length === 1 ? "day" : "days"}`}
                meta={`${days.map(d => fmt(d.amount).replace(" €", "")).join(" + ")} · worked out`}
                right={<div style={{ textAlign: "right" as const }}><div style={{ fontSize: TYPE.row.size, whiteSpace: "nowrap" as const }}>{fmt(meals)}</div><TonedTag tone={PAL.neutral} s={{ marginTop: 3 }}>Pauschale</TonedTag></div>} />
            )}
            {trip && x.km > 0 && (
              <Row s={sub} onClick={() => setWin({ t: "case", id: x.id })}
                icon={<IconCircle tone={PAL.neutral} size={22}><BizIco d={BIZ_IC.car} size={12} /></IconCircle>}
                title={`Own car · ${x.km.toLocaleString("de-DE")} km`} meta="0,30 € per km · worked out"
                right={<div style={{ fontSize: TYPE.row.size, whiteSpace: "nowrap" as const }}>{fmt(km)}</div>} />
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, padding: "10px 12px 4px 52px", borderTop: `1px solid ${C.hair}` }}>
              <PillBtn onClick={() => setWin({ t: "report", id: x.id })}><BizIco d={BIZ_IC.report} size={13} />{trip ? "Trip report" : "Event report"}</PillBtn>
            </div>
            <div style={{ display: "flex", gap: 16, padding: "8px 12px 12px 52px" }}>
              <button style={link} onClick={() => setWin({ t: "receipt", id: null, caseId: x.id })}>+ Add receipt</button>
              <button style={link} onClick={() => setWin({ t: "case", id: x.id })}>{trip ? "Trip details" : "Event details"}</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const winCase = win && win.t === "receipt" ? biz.cases.find(c => c.id === win.caseId) : null;
  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{trip ? "Trips" : "Events"}</h2>
          <SummaryLine dot={PAL.neutral.mid}>{list.length} {list.length === 1 ? word : `${word}s`} · <Strong>{fmt(sum)}</Strong></SummaryLine>
        </div>
        <PillBtn dark onClick={() => setWin({ t: "case", id: null })}><BizIco d={BIZ_IC.plus} size={13} />Add {word}</PillBtn>
      </div>

      <YearStrip years={years} year={year} setYear={setYear} total={totals.total} counted={totals.counted} />

      {biz.loadError && !biz.missing && <div style={{ marginTop: 12 }}><LoadErrorBanner what={trip ? "Trips" : "Events"} message={biz.loadError} onRetry={biz.reload} /></div>}
      {biz.missing && (
        <ListCard s={{ marginTop: 12, padding: "14px", fontSize: TYPE.row.size, color: PAL.waiting.ink, background: PAL.waiting.wash, border: `1px solid ${PAL.waiting.fill}` }}>
          {biz.loadError}
        </ListCard>
      )}

      {!biz.loading && !biz.missing && !biz.loadError && list.length === 0 && (
        <ListCard s={{ marginTop: 14, padding: "18px 14px", textAlign: "center" as const }}>
          <div style={{ fontSize: TYPE.row.size }}>No {word}s in {year} yet</div>
          <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 3 }}>Add one with + Add {word} — its receipts go inside it.</div>
        </ListCard>
      )}

      {list.length > 0 && (
        <>
          <SectionHead label={String(year)} right={`${list.length} ${list.length === 1 ? word : `${word}s`}`} />
          <ListCard>{list.map(card)}</ListCard>
        </>
      )}

      {win?.t === "case" && (
        <CaseWindow key={win.id || "new"} biz={biz} kind={kind} caseId={win.id} nums={nums} clients={clients}
          onCreated={(id) => { openCase(id); setWin({ t: "case", id }); }} onClose={() => setWin(null)} />
      )}
      {win?.t === "receipt" && winCase && (
        <ReceiptWindow key={`${win.id || "new"}-${win.returnOf || ""}`} biz={biz} costId={win.id} caseId={win.caseId} returnOf={win.returnOf || null}
          defaultDate={receiptDate(winCase)} ku={ku} nums={nums}
          onCreated={(id) => setWin({ t: "receipt", id, caseId: win.caseId })}
          onReturn={(id) => setWin({ t: "receipt", id: null, caseId: win.caseId, returnOf: id })} onClose={() => setWin(null)} />
      )}
      {win?.t === "report" && (
        <ReportWindow key={win.id} biz={biz} caseId={win.id} nums={nums} cats={biz.cats} settings={settings} onClose={() => setWin(null)} />
      )}
    </div>
  );
}
