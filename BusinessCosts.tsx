// ─────────────────────────────────────────────────────────────
// BusinessCosts — Business › Costs: the one-off receipts of a year,
// grouped by month (newest month first, in number order inside a month
// — K1, K2 … by date, like Maintenance). Chips All · No file.
// A row: K31 · what — date · vendor (↩ K28 for a return) — amount and
// its category (or "No file" while the PDF is missing). Tap = the
// receipt window; + Add cost opens it empty.
// The strip under the title is the same in every tab (the year's costs of all tabs).
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL, TRACK } from "./constants";
import { SummaryLine, Strong, PillBtn, Chip, ChipRow, ListCard, Row, IconCircle, TonedTag, LoadErrorBanner } from "./atoms";
import { fmt, fmtD, MONTHS } from "./formatters";
import { numbersOf, yearOf, monthOf, sortCosts } from "./business";
import type { BizCost } from "./business";
import type { BusinessHook } from "./useBusiness";
import ReceiptWindow from "./BusinessReceipt";
import { BizIco, BIZ_IC, YearStrip, kuOf } from "./BusinessParts";

type F = "all" | "nofile";

export default function BusinessCosts({ biz, settings, isMobile, year, setYear, years, totals }: {
  biz: BusinessHook; settings: any; isMobile: boolean; year: number; setYear: (y: number) => void; years: number[];
  totals: { total: number; counted: number };      // the strip: every tab of the year
}) {
  const ku = kuOf(settings);
  const [f, setF] = useState<F>("all");
  const [win, setWin] = useState<{ id: string | null; returnOf?: string | null } | null>(null);
  const nums = useMemo(() => numbersOf(biz.costs, biz.cases), [biz.costs, biz.cases]);
  const catOf = (id: string | null) => biz.cats.find(c => c.id === id) || null;

  const oneOff = biz.costs.filter(c => yearOf(c.date) === year && !c.caseId);
  const noFile = oneOff.filter(c => !c.filePath);
  const shown = f === "nofile" ? noFile : oneOff;
  const shownSum = shown.reduce((s, c) => s + c.amount, 0);

  // months, newest first · inside a month the number order (oldest first)
  const groups = useMemo(() => {
    const m = new Map<string, BizCost[]>();
    sortCosts(shown).forEach(c => { const k = monthOf(c.date); if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, rows]) => ({
      key: k, month: Number(k.slice(5, 7)) - 1, year: Number(k.slice(0, 4)), rows, total: rows.reduce((s, c) => s + c.amount, 0),
    }));
  }, [shown]);   // eslint-disable-line react-hooks/exhaustive-deps

  const right = (c: BizCost) => (
    <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
      <div style={{ fontSize: TYPE.body.size, whiteSpace: "nowrap" as const }}>{fmt(c.amount)}</div>
      {c.filePath
        ? <TonedTag tone={PAL.neutral} s={{ marginTop: 3 }}>{catOf(c.categoryId)?.name || "No category"}</TonedTag>
        : <TonedTag tone={PAL.waiting} s={{ marginTop: 3 }}>No file</TonedTag>}
    </div>
  );
  const meta = (c: BizCost) => [fmtD(c.date), c.what && c.vendor ? c.vendor : "", c.returnOf ? `↩ ${nums.get(c.returnOf) || "—"}` : ""].filter(Boolean).join(" · ");

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Costs</h2>
          <SummaryLine dot={f === "nofile" ? PAL.waiting.mid : PAL.neutral.mid}>
            {shown.length} {f === "nofile" ? "without a file" : shown.length === 1 ? "cost" : "costs"} · <Strong>{fmt(shownSum)}</Strong>
          </SummaryLine>
        </div>
        <PillBtn dark onClick={() => setWin({ id: null })}><BizIco d="M12 5v14M5 12h14" size={13} />Add cost</PillBtn>
      </div>

      <YearStrip years={years} year={year} setYear={setYear} total={totals.total} counted={totals.counted} />

      {biz.loadError && !biz.missing && <div style={{ marginTop: 12 }}><LoadErrorBanner what="Costs" message={biz.loadError} onRetry={biz.reload} /></div>}
      {biz.missing && (
        <ListCard s={{ marginTop: 12, padding: "14px", fontSize: TYPE.row.size, color: PAL.waiting.ink, background: PAL.waiting.wash, border: `1px solid ${PAL.waiting.fill}` }}>
          {biz.loadError}
        </ListCard>
      )}

      {!biz.missing && (
        <ChipRow s={{ marginTop: 12 }}>
          <Chip on={f === "all"} tone={PAL.neutral} dot={false} label="All" count={oneOff.length} onClick={() => setF("all")} />
          <Chip on={f === "nofile"} tone={PAL.waiting} label="No file" count={noFile.length} onClick={() => setF("nofile")} />
        </ChipRow>
      )}

      {!biz.loading && !biz.missing && !biz.loadError && shown.length === 0 && (
        <ListCard s={{ marginTop: 14, padding: "18px 14px", textAlign: "center" as const }}>
          <div style={{ fontSize: TYPE.row.size }}>{f === "nofile" ? "Every cost has its file" : `No costs in ${year} yet`}</div>
          <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 3 }}>{f === "nofile" ? "Nothing is missing here." : "Add one with + Add cost — a PDF or a photo of the receipt can go with it."}</div>
        </ListCard>
      )}

      {groups.map(g => (
        <div key={g.key}>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 4px 6px", fontSize: TYPE.label.size, color: PAL.neutral.ink }}>
            <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>{MONTHS[g.month]} {g.year}</span>
            <span>{fmt(g.total)}</span>
          </div>
          <ListCard>
            {g.rows.map((c, i) => (
              <Row key={c.id} first={i === 0} onClick={() => setWin({ id: c.id })}
                icon={<IconCircle tone={PAL.neutral}><BizIco d={c.returnOf ? BIZ_IC.back : BIZ_IC.receipt} /></IconCircle>}
                title={`${nums.get(c.id) || ""} · ${c.what || c.vendor || "Receipt"}`}
                meta={meta(c)} right={right(c)} />
            ))}
          </ListCard>
        </div>
      ))}

      {win && (
        <ReceiptWindow key={`${win.id || "new"}-${win.returnOf || ""}`} biz={biz} costId={win.id} returnOf={win.returnOf || null} ku={ku} nums={nums}
          onCreated={(id) => setWin({ id })} onReturn={(id) => setWin({ id: null, returnOf: id })} onClose={() => setWin(null)} />
      )}
    </div>
  );
}
