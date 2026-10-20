// ─────────────────────────────────────────────────────────────
// CreatorDashboard — read only, built from the Manager dashboard's parts
//   card "Done in <month>" (bars per month · on-time strip) · Workload tiles ·
//   next deadline · items without a deadline · output by card
// ─────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL, TRACK, RADIUS } from "./constants";
import { today } from "./formatters";
import { SectionHead, DashCard, DashCardHead, DashStrip, DashTile, WideRow, LinkRow, BarList, SwitchPill, DashIcon } from "./atoms";
import { getWsItems, allDoneItems, isOverdue, isThisWeek, fmtDeadline, WS_CATS, WS_CAT_LABEL, isInProduction } from "./wsHelpers";
import { G, Glyph } from "./CreatorShared";

const MO = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pct2 = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2).replace(".", ",")} %`;

export default function CreatorDashboard({ clients, isMobile, onOpen }: { clients: any[]; isMobile: boolean; onOpen: (tab: "workspace" | "projects") => void }) {
  const now = today();
  const [ym, setYm] = useState(now.slice(0, 7));
  const year = ym.slice(0, 4), mIdx = parseInt(ym.slice(5, 7)) - 1;
  const work = useMemo(() => getWsItems(clients), [clients]);
  const open = work.filter((it: any) => !it.done);
  const done = useMemo(() => allDoneItems(clients).filter((it: any) => it.doneDate), [clients]);
  const byMonth = Array.from({ length: 12 }, (_, m) => done.filter((it: any) => it.doneDate.startsWith(`${year}-${String(m + 1).padStart(2, "0")}`)).length);
  const maxM = Math.max(1, ...byMonth);
  const inMonth = done.filter((it: any) => it.doneDate.startsWith(ym));
  const catLine = WS_CATS.map(c => [c, inMonth.filter((it: any) => it.category === c).length] as const).filter(([, n]) => n > 0).map(([c, n]) => `${n} ${WS_CAT_LABEL[c]}`).join(" · ");
  const timed = inMonth.filter((it: any) => it.deadline);
  const onTime = timed.filter((it: any) => it.doneDate <= it.deadline).length;
  const overdue = open.filter((it: any) => isOverdue(it.deadline)).length;
  const week = open.filter((it: any) => !isOverdue(it.deadline) && isThisWeek(it.deadline)).length;
  const projects = (clients || []).flatMap((c: any) => c.projects || []).filter(isInProduction).length;
  const next = open.filter((it: any) => it.deadline && it.deadline >= now).sort((a: any, b: any) => a.deadline.localeCompare(b.deadline))[0];
  const noDate = open.filter((it: any) => !it.deadline).length;
  const yearDone = done.filter((it: any) => it.doneDate.startsWith(year));
  const byCat = WS_CATS.map(c => ({ c, n: yearDone.filter((it: any) => it.category === c).length })).filter(x => x.n > 0);
  const shift = (d: number) => { const [y, m] = ym.split("-").map(Number); const t = new Date(y, m - 1 + d, 1); setYm(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`); };
  const canNext = ym < now.slice(0, 7);
  const arrow = (label: string, ok: boolean, txt: string, fn: () => void) => (
    <button aria-label={label} onClick={ok ? fn : undefined} disabled={!ok} style={{ background: "none", border: "none", padding: "0 8px", height: 28, cursor: ok ? "pointer" : "default", color: ok ? C.muted : C.faint, fontSize: TYPE.subtext.size, fontFamily: SANS }}>{txt}</button>
  );

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Dashboard</h2>
        <SwitchPill>{arrow("Previous month", true, "‹", () => shift(-1))}<span style={{ minWidth: 40, textAlign: "center" as const }}>{MO[mIdx]}</span>{arrow("Next month", canNext, "›", () => shift(1))}</SwitchPill>
      </div>
      <div style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted, marginTop: 4 }}>Overview · read only</div>

      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <div>
          <DashCard onClick={() => onOpen("workspace")}>
            <div style={{ padding: "11px 13px 9px" }}>
              <DashCardHead icon={<DashIcon tone={PAL.done}><Glyph d={G.check} /></DashIcon>} label={`Done in ${MONTH[mIdx]}`} arrow />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
                <div style={{ fontFamily: SERIF, fontSize: TYPE.kpi.size, lineHeight: 1.05 }}>{inMonth.length}</div>
                <div style={{ fontSize: TYPE.label.size, color: C.muted, textAlign: "right" as const, lineHeight: 1.35 }}>{catLine || "nothing done yet"}<br />{year}: {yearDone.length} done</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4, alignItems: "end", height: 38, marginTop: 10 }}>
                {byMonth.map((v, m) => (
                  <span key={m} title={`${MO[m]} · ${v}`} style={{ height: v > 0 ? Math.max(6, Math.round((v / maxM) * 38)) : 3, background: v > 0 ? (m === mIdx ? PAL.done.mid : PAL.done.fill) : PAL.neutral.fill, borderRadius: v > 0 ? 5 : RADIUS.bar }} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 4, marginTop: 4, fontSize: TYPE.micro.size, color: C.light, textAlign: "center" as const }}>
                {MO.map((m, k) => <span key={m} style={{ color: k === mIdx ? C.black : undefined }}>{m}</span>)}
              </div>
            </div>
            {timed.length > 0 && <DashStrip tone={PAL.done} left={`Done on time · ${onTime} of ${timed.length}`} right={pct2((onTime / timed.length) * 100)} pct={(onTime / timed.length) * 100} />}
          </DashCard>
        </div>
        <div>
          <SectionHead label="Workload" />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            <DashTile tone={PAL.waiting} icon={<Glyph d={G.list} />} label="Open items" value={String(open.length)}
              sub={<>{week} this week{overdue ? <> · <span style={{ color: PAL.late.ink }}>{overdue} overdue</span></> : ""}</>} onClick={() => onOpen("workspace")} />
            <DashTile tone={PAL.progress} icon={<Glyph d={G.video} />} label="In production" value={String(projects)}
              sub={`projects · ${work.length} items`} onClick={() => onOpen("projects")} />
            <WideRow icon={<Glyph d={G.cal} />} label="Next deadline" onClick={next ? () => onOpen("workspace") : undefined}
              right={<span style={{ fontSize: TYPE.row.size, whiteSpace: "nowrap" as const }}>{next ? `${fmtDeadline(next.deadline)} · ${next.clientName}` : "—"}</span>} />
          </div>
          <LinkRow icon={<DashIcon tone={noDate ? PAL.waiting : PAL.neutral}><Glyph d={G.calOff} /></DashIcon>} label="Without a deadline"
            tag={`${noDate} ${noDate === 1 ? "item" : "items"}`} tone={noDate ? PAL.waiting : PAL.neutral} tagFilled={noDate > 0} onClick={noDate ? () => onOpen("workspace") : undefined} />
          <SectionHead label={`Output by card · ${year}`} />
          <BarList empty={`Nothing done in ${year} yet.`}
            rows={byCat.map(x => ({ key: x.c, label: WS_CAT_LABEL[x.c], value: String(x.n), pctText: pct2((x.n / yearDone.length) * 100), pct: (x.n / yearDone.length) * 100 }))} />
        </div>
      </div>
    </div>
  );
}
