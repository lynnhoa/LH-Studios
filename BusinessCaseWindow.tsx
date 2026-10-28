// ─────────────────────────────────────────────────────────────
// BusinessCaseWindow — one trip or event in the shared window: one level,
// no Edit step. Footer: Add trip / Save while something is typed / Done.
// ⋯ : Delete trip (its receipts and files go with it).
//   Trip   Title · Place · Country · From / To with times · Purpose · Account · Client
//   Event  the same + Guests (who was there)
//   Meal allowance (trips): one line per day — B · L · D = a meal that was included —
//          and what the day counts (worked out, see business.ts). Abroad: the two rates.
//   Own car (trips): km × 0,30 €
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, TYPE, PAL, SANS, RADIUS } from "./constants";
import {
  Sheet, SheetHead, SheetRow, SheetPair, SheetMeta, SheetErr, SheetButton, MoreMenu, MiniInput, MenuSelect, MiniArea, NumField,
  ConfirmDialog, useDraft, SHEET_CARD,
} from "./atoms";
import { fmt, today } from "./formatters";
import { showNote } from "./undo";
import { mealDays, kmAmount, isAbroad, accountName, KM_RATE, MEAL_DE } from "./business";
import type { BizCase, BizAccount, CaseKind } from "./business";
import type { BusinessHook } from "./useBusiness";
import { BizIco, BIZ_IC } from "./BusinessParts";

interface Draft {
  title: string; place: string; country: string; startDate: string; startTime: string; endDate: string; endTime: string;
  purpose: string; account: BizAccount; client: string; guests: string;
  meals: Record<string, { b?: boolean; l?: boolean; d?: boolean }>; km: number | null; abroadFull: number | null; abroadPart: number | null;
}
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLabel = (d: string) => `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;
const KIND_WORD: Record<string, string> = { arrival: "arrival", full: "full day", departure: "departure", day: "over 8 h", short: "8 h or less" };
const accInk = (a: BizAccount) => (a === "lynnhoa" ? PAL.lynnhoa.ink : a === "createbylynn" ? PAL.createbylynn.ink : C.black);
const muted: any = { color: C.muted, fontSize: TYPE.subtext.size };

export default function CaseWindow({ biz, kind, caseId, nums, clients, onCreated, onClose }: {
  biz: BusinessHook; kind: CaseKind; caseId: string | null; nums: Map<string, string>; clients: any[];
  onCreated: (id: string) => void; onClose: () => void;
}) {
  const isNew = caseId === null;
  const cur = isNew ? null : biz.cases.find(c => c.id === caseId) || null;
  const trip = kind === "trip";
  const word = trip ? "trip" : "event";
  const stored: Draft = cur ? {
    title: cur.title, place: cur.place, country: cur.country, startDate: cur.startDate, startTime: cur.startTime, endDate: cur.endDate, endTime: cur.endTime,
    purpose: cur.purpose, account: cur.account, client: cur.client, guests: cur.guests, meals: cur.meals || {}, km: cur.km || null,
    abroadFull: cur.abroadFull, abroadPart: cur.abroadPart,
  } : {
    title: "", place: "", country: "Germany", startDate: today(), startTime: "", endDate: today(), endTime: "",
    purpose: "", account: "general", client: "", guests: "", meals: {}, km: null, abroadFull: null, abroadPart: null,
  };
  const dr = useDraft(stored, { frozen: isNew });
  const f = dr.d;
  const set = (p: Partial<Draft>) => dr.setD(x => ({ ...x, ...p }));
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDel, setAskDel] = useState(false);
  useEffect(() => { if (!isNew && !cur) onClose(); }, [isNew, !!cur]);   // eslint-disable-line react-hooks/exhaustive-deps

  const no = cur ? nums.get(cur.id) || "" : "";
  const probe: BizCase = { ...(cur || ({} as any)), kind, ...f, km: f.km || 0 } as BizCase;
  const days = trip ? mealDays(probe) : [];
  const abroad = isAbroad(f);
  const mealSum = days.reduce((s, d) => s + d.amount, 0);
  const nReceipts = cur ? biz.costs.filter(c => c.caseId === cur.id).length : 0;

  const toggleMeal = (d: string, k: "b" | "l" | "d") => {
    const m = { ...(f.meals[d] || {}) };
    if (m[k]) delete m[k]; else m[k] = true;
    const meals = { ...f.meals };
    if (Object.keys(m).length) meals[d] = m; else delete meals[d];
    set({ meals });
  };

  const save = async () => {
    if (busy) return;
    setErr(null);
    if (!f.title.trim()) { setErr(`Add a title for the ${word}.`); return; }
    if (!f.startDate) { setErr("Pick the start date."); return; }
    if (f.endDate && f.endDate < f.startDate) { setErr("The end is before the start."); return; }
    // meals only for the trip's own days
    const inTrip = new Set(days.map(d => d.date));
    const meals: Draft["meals"] = {};
    Object.keys(f.meals || {}).forEach(d => { if (inTrip.has(d)) meals[d] = f.meals[d]; });
    const payload: Partial<BizCase> = {
      kind, title: f.title, place: f.place, country: f.country, startDate: f.startDate, startTime: f.startTime,
      endDate: f.endDate || f.startDate, endTime: f.endTime, purpose: f.purpose, account: f.account, client: f.client, guests: f.guests,
      meals: trip ? meals : {}, km: trip ? f.km || 0 : 0, abroadFull: abroad ? f.abroadFull : null, abroadPart: abroad ? f.abroadPart : null,
    };
    setBusy(true);
    try {
      dr.saving();
      if (isNew) { const made = await biz.addCase(payload); onCreated(made.id); showNote("Added ✓"); return; }
      await biz.updateCase(cur!.id, payload);
      showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async () => {
    setAskDel(false);
    if (!cur) return;
    try { await biz.removeCase(cur); onClose(); showNote(`${no || word} deleted`); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };

  const enter = (e: any) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } };
  const footer = isNew
    ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : `Add ${word}`}</SheetButton>
    : dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
    : <SheetButton onClick={onClose}>Done</SheetButton>;
  const listed = new Set<string>();
  const clientOpts = (clients || []).flatMap((c: any) => {
    const name = String(c?.name || "").trim();
    if (!name) return [];
    const out = [name, ...((c.projects || []) as any[]).map(p => String(p?.name || "").trim()).filter(Boolean).map(p => `${name} · ${p}`)];
    return out.filter(o => (listed.has(o) ? false : (listed.add(o), true)));
  });
  const mealBtn = (d: string, k: "b" | "l" | "d", label: string) => {
    const on = !!(f.meals[d] && f.meals[d][k]);
    return (
      <button key={k} onClick={() => toggleMeal(d, k)} aria-pressed={on} aria-label={`${label} included on ${dayLabel(d)}`}
        style={{ width: 28, height: 28, borderRadius: RADIUS.pill, border: `1px solid ${on ? C.pillOn : C.rule}`, background: on ? PAL.neutral.fill : C.white,
          color: on ? C.black : C.muted, fontFamily: SANS, fontSize: TYPE.label.size, cursor: "pointer", padding: 0, flexShrink: 0 }}>{label[0]}</button>
    );
  };

  return (
    <>
      {askDel && cur && (
        <ConfirmDialog title={`Delete ${no || word}?`}
          text={nReceipts ? `Its ${nReceipts} ${nReceipts === 1 ? "receipt goes" : "receipts go"} with it, with their files and the report photos.` : "Its report and photos go with it."}
          okLabel="Delete" danger onOk={del} onCancel={() => setAskDel(false)} />
      )}
      <Sheet title={isNew ? `New ${word}` : `${trip ? "Trip" : "Event"} · ${no}`} onClose={onClose} dirty={dr.changed}
        right={cur ? <MoreMenu items={[{ label: `Delete ${word}`, danger: true, onClick: () => setAskDel(true) }]} /> : null} footer={footer}>
        {err && <SheetErr>{err}</SheetErr>}

        <SheetHead first icon={<BizIco d={trip ? BIZ_IC.trip : BIZ_IC.event} size={11} />} label={trip ? "Trip" : "Event"} tone={PAL.neutral} />
        <div style={SHEET_CARD}>
          <SheetRow first label="Title"><MiniInput bare value={f.title} placeholder={trip ? "Berlin — Fashion Week" : "Brand dinner — Frankfurt"} aria-label="Title" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ title: e.target.value })} /></SheetRow>
          <SheetPair left={{ label: "Place", w: 52, node: <MiniInput bare value={f.place} placeholder="Berlin" aria-label="Place" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ place: e.target.value })} /> }}
            right={{ label: "Country", w: 60, node: <MiniInput bare value={f.country} placeholder="Germany" aria-label="Country" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ country: e.target.value })} /> }} />
          <SheetPair left={{ label: "From", w: 52, node: <MiniInput bare type="date" value={f.startDate} aria-label="From" onChange={(e: any) => { const v = e.target.value; set({ startDate: v, endDate: !f.endDate || f.endDate < v || f.endDate === f.startDate ? v : f.endDate }); }} /> }}
            right={{ label: "Time", w: 60, node: <MiniInput bare type="time" value={f.startTime} aria-label="Start time" onChange={(e: any) => set({ startTime: e.target.value })} /> }} />
          <SheetPair left={{ label: "To", w: 52, node: <MiniInput bare type="date" value={f.endDate} aria-label="To" onChange={(e: any) => set({ endDate: e.target.value })} /> }}
            right={{ label: "Time", w: 60, node: <MiniInput bare type="time" value={f.endTime} aria-label="End time" onChange={(e: any) => set({ endTime: e.target.value })} /> }} />
          <SheetRow top label="Purpose"><MiniArea value={f.purpose} onChange={(v) => set({ purpose: v })} placeholder={trip ? "Shows, 2 brand meetings, content" : "Kick-off with the brand team"} ariaLabel="Purpose" minRows={2} pad={[9, 0]} /></SheetRow>
          {!trip && <SheetRow top label="Guests"><MiniArea value={f.guests} onChange={(v) => set({ guests: v })} placeholder="Maison Clair team, Agentur Nord" ariaLabel="Guests" minRows={2} pad={[9, 0]} /></SheetRow>}
          <SheetRow label="Account">
            <MenuSelect bare value={f.account} aria-label="Account" look={{ color: accInk(f.account) }} onChange={(e: any) => set({ account: e.target.value as BizAccount })}>
              {(["lynnhoa", "createbylynn", "general"] as BizAccount[]).map(a => <option key={a} value={a}>{accountName(a)}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Client">
            <MenuSelect bare value={f.client} aria-label="Client" muted={!f.client} onChange={(e: any) => set({ client: e.target.value })}>
              <option value="">None</option>
              {f.client && !clientOpts.includes(f.client) && <option value={f.client}>{f.client}</option>}
              {clientOpts.map(o => <option key={o} value={o}>{o}</option>)}
            </MenuSelect>
          </SheetRow>
        </div>
        {cur && <SheetMeta>{nReceipts} {nReceipts === 1 ? "receipt" : "receipts"} · add them in the {word}'s card with + Add receipt.</SheetMeta>}

        {trip && (
          <>
            <SheetHead icon={<BizIco d={BIZ_IC.meal} size={11} />} label="Meal allowance" tone={PAL.neutral} />
            <div style={SHEET_CARD}>
              {abroad && (
                <>
                  <SheetRow first label="Full day" right={<span style={{ ...muted, paddingRight: 6 }}>€</span>}>
                    <NumField mini bare value={f.abroadFull} placeholder="Rate for 24 h" ariaLabel="Full day rate abroad" onChange={(n) => set({ abroadFull: n })} />
                  </SheetRow>
                  <SheetRow label="Part day" right={<span style={{ ...muted, paddingRight: 6 }}>€</span>}>
                    <NumField mini bare value={f.abroadPart} placeholder="Arrival, departure, over 8 h" ariaLabel="Part day rate abroad" onChange={(n) => set({ abroadPart: n })} />
                  </SheetRow>
                </>
              )}
              {days.map((d, i) => (
                <SheetRow key={d.date} first={!abroad && i === 0} label={dayLabel(d.date)}
                  right={<span style={{ fontSize: TYPE.row.size, paddingRight: 6, whiteSpace: "nowrap" as const }}>{fmt(d.amount)}</span>}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {mealBtn(d.date, "b", "Breakfast")}{mealBtn(d.date, "l", "Lunch")}{mealBtn(d.date, "d", "Dinner")}
                    <span style={{ ...muted, marginLeft: 4, whiteSpace: "nowrap" as const }}>{KIND_WORD[d.kind]}</span>
                  </span>
                </SheetRow>
              ))}
              {days.length === 0 && <SheetRow first={!abroad} label="Days"><span style={muted}>Pick the dates first</span></SheetRow>}
              {days.length > 0 && (
                <SheetRow label="Total" right={<span style={{ fontSize: TYPE.row.size, paddingRight: 6 }}>{fmt(mealSum)}</span>}><span style={muted}>worked out</span></SheetRow>
              )}
            </div>
            <SheetMeta>
              {abroad
                ? "Abroad: type the country's two daily rates from the BMF table. B · L · D = breakfast, lunch or dinner was included — it takes off 20 % or 40 % of the full-day rate."
                : `Germany: ${fmt(MEAL_DE.part)} for arrival and departure days and for one day of more than 8 hours, ${fmt(MEAL_DE.full)} for a full day. B · L · D = a meal was included — breakfast takes off 5,60 €, lunch or dinner 11,20 €.`}
            </SheetMeta>

            <SheetHead icon={<BizIco d={BIZ_IC.car} size={11} />} label="Own car" tone={PAL.neutral} />
            <div style={SHEET_CARD}>
              <SheetRow first label="Km" right={<span style={{ fontSize: TYPE.row.size, paddingRight: 6 }}>{fmt(kmAmount(probe))}</span>}>
                <NumField mini bare value={f.km} minDec={0} placeholder="0" ariaLabel="Km with your own car" onChange={(n) => set({ km: n === null ? null : Math.max(0, n) })} />
              </SheetRow>
            </div>
            <SheetMeta>{fmt(KM_RATE)} per km, there and back.</SheetMeta>
          </>
        )}
      </Sheet>
    </>
  );
}
