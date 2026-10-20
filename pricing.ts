// ─────────────────────────────────────────────────────────────
// PRICING — the rate card is the only price source.
// No UI. No side effects. Used by the Calculator, the Service
// Catalog, the rate-card PDF and the renewal builder.
// ─────────────────────────────────────────────────────────────

import { r2, addD, today, fmt, fmtPct } from "./formatters";
import { RENEWAL_OPTS } from "./rateCards";
import { projectLicenses } from "./licenses";

// ─── SECTION TYPES ───────────────────────────────────────────
export type SectionKind = "deliverables" | "packages" | "usage" | "exclusivity" | "addons" | "info";

export const KIND_LABEL: Record<SectionKind, string> = {
  deliverables: "Deliverables",
  packages:     "Packages",
  usage:        "Usage rights",
  exclusivity:  "Exclusivity",
  addons:       "Add-ons",
  info:         "Info (not priced)",
};

// Cards made before section types existed: infer the type from the title once
export function sectionKind(sec: any): SectionKind {
  if (sec?.kind && KIND_LABEL[sec.kind as SectionKind]) return sec.kind;
  const t = String(sec?.t || "").toLowerCase();
  if (t.includes("package"))                              return "packages";
  if (t.includes("usage"))                                return "usage";
  if (t.includes("exclusiv"))                             return "exclusivity";
  if (/add-?ons?\b/.test(t))                              return "addons";
  if (t.includes("ambassador") || t.includes("retainer")) return "info";
  return "deliverables";
}

// ─── PERCENT HELPERS ─────────────────────────────────────────
const PCT_RE = /([+−-]?\s*\d+(?:[.,]\d+)?)\s*%/;
export const parsePct = (s: any): number | null => {
  const m = PCT_RE.exec(String(s ?? ""));
  return m ? Math.abs(parseFloat(m[1].replace(/[\s+−-]/g, "").replace(",", "."))) : null;
};
// German format: whole numbers stay "20 %", others get two decimals ("17,50 %")
export const pctText = (p: number) => fmtPct(r2(Number(p) || 0));

// Usage / exclusivity option: the label is stored without the price part
export const optName  = (l: any) => String(l ?? "").replace(/\s*\((?:\+?\s*\d+(?:[.,]\d+)?\s*%|included)\)\s*$/i, "").trim();
export const optLabel = (o: any) =>
  !o ? "" : o.sentinel ? String(o.l) : Number(o.pct) > 0 ? `${optName(o.l)} (+${pctText(o.pct)})` : `${optName(o.l)} (included)`;

// ─── NORMALIZE (idempotent) ──────────────────────────────────
const WORK_RE = /story\s*frame|additional\s+image|video\s*cut|hook|variation|aspect\s*ratio/i;
function normItem(it: any, kind: SectionKind) {
  const out: any = { ...it };
  out.p = out.p === null || out.p === undefined || out.p === "" ? null : (Number(out.p) || 0);
  if (kind === "addons") {
    if (out.pct === undefined || out.pct === "") {
      const pc = out.p === null ? parsePct(out.m) : null;
      out.pct = pc;
    } else if (out.pct !== null) out.pct = Number(out.pct) || 0;
    if (out.perMonth === undefined) out.perMonth = /\/\s*mo/i.test(String(out.m || ""));
    if (out.info === undefined)     out.info     = /kill\s*fee/i.test(String(out.n || ""));
    // content to produce (extra frames, images, cuts, hooks, formats) — becomes work items later
    if (out.work === undefined)     out.work     = WORK_RE.test(String(out.n || ""));
  }
  if (kind === "packages" && !Array.isArray(out.includes)) out.includes = [];
  return out;
}

function normOpts(arr: any[], sentinelLabel: string) {
  const list = (arr || []).map((o: any) =>
    o?.sentinel ? { ...o } : { ...o, l: optName(o?.l), pct: Number(o?.pct) || 0, mo: Number(o?.mo) || 0 }
  );
  if (!list.some((o: any) => o.sentinel)) list.unshift({ l: sentinelLabel, pct: 0, mo: 0, sentinel: true });
  return list;
}

export function normalizeCard(card: any) {
  if (!card) return card;
  return {
    ...card,
    sections: (card.sections || []).map((s: any) => {
      const kind = sectionKind(s);
      return { ...s, kind, items: (s.items || []).map((it: any) => normItem(it, kind)) };
    }),
    usage: normOpts(card.usage, "— Select usage rights —"),
    excl:  normOpts(card.excl,  "— Select exclusivity —"),
  };
}

export function normalizeCards(rc: any) {
  const out: any = {};
  Object.entries(rc || {}).forEach(([k, v]) => { out[k] = normalizeCard(v); });
  return out;
}

// ─── CARD LOOKUPS ────────────────────────────────────────────
export const BASE_CARD_KEYS = ["influencer", "ugc", "editorial", "hotels"];

export interface CardChoice { key: string; kind: "deliverable" | "package"; item: any; section: string; }

// Everything that can be quoted from a card
export function cardChoices(card: any): CardChoice[] {
  const out: CardChoice[] = [];
  (card?.sections || []).forEach((s: any, si: number) => {
    const kind = sectionKind(s);
    if (kind !== "deliverables" && kind !== "packages") return;
    (s.items || []).forEach((it: any, ii: number) => {
      if (!it?.n) return;
      out.push({ key: it.id || `${si}_${ii}`, kind: kind === "packages" ? "package" : "deliverable", item: it, section: s.t || "" });
    });
  });
  return out;
}

export function cardAddons(card: any): any[] {
  return (card?.sections || [])
    .filter((s: any) => sectionKind(s) === "addons")
    .flatMap((s: any, si: number) => (s.items || []).map((it: any, ii: number) => ({ ...it, key: it.id || `a${si}_${ii}` })))
    .filter((it: any) => it.n && !it.info);
}

// Card keys that can be quoted, base cards first, then custom cards
export function pricingCats(rc: any): string[] {
  const keys = Object.keys(rc || {}).filter(k => cardChoices(rc[k]).length > 0);
  return [...BASE_CARD_KEYS.filter(k => keys.includes(k)), ...keys.filter(k => !BASE_CARD_KEYS.includes(k)).sort()];
}

// Add-on price text for menus and the rate card
export const addonPriceText = (a: any) =>
  a.p !== null && a.p !== undefined ? `${fmt(Number(a.p) || 0)}${a.perMonth ? " / month" : ""}`
  : a.pct !== null && a.pct !== undefined ? `+${pctText(a.pct)}${a.perMonth ? " / month" : ""}`
  : (a.m || "");

// ─── VOLUME DISCOUNT ─────────────────────────────────────────
// Tiers per rate card: "from N pieces of the same item −X %". Until a card has its own
// (Service Catalog), the standard rules apply: 3+ −15 %, 10+ −20 %; Editorial 3+ −10 %.
export interface VolTier { from: number; pct: number }
const VOL_STANDARD:  VolTier[] = [{ from: 3, pct: 15 }, { from: 10, pct: 20 }];
const VOL_EDITORIAL: VolTier[] = [{ from: 3, pct: 10 }];

export function volTiersOf(card: any, cat: string): VolTier[] {
  const own = (Array.isArray(card?.volumeTiers) ? card.volumeTiers : [])
    .map((t: any) => ({ from: Math.round(Number(t?.from)), pct: Number(t?.pct) }))
    .filter((t: VolTier) => Number.isFinite(t.from) && t.from >= 1 && t.pct > 0 && t.pct < 100)
    .sort((x: VolTier, y: VolTier) => x.from - y.from);
  if (own.length) return own;
  return cat === "editorial" ? VOL_EDITORIAL : VOL_STANDARD;
}

// The discount for a quantity: the highest tier reached (0 when off or below the first tier)
export function volPctOf(tiers: VolTier[], qty: number, on: boolean): number {
  if (!on) return 0;
  let p = 0;
  (tiers || []).forEach(t => { if (qty >= t.from) p = t.pct; });
  return p;
}

export function volPct(cat: string, qty: number, on: boolean, tiers?: VolTier[]): number {
  return volPctOf(tiers && tiers.length ? tiers : volTiersOf(null, cat), qty, on);
}

// ─── ADD-ON COUNTS ───────────────────────────────────────────
// A fixed-price add-on can be taken more than once. Its unit comes from the note
// ("per frame", "per week" …); without one the line simply says "2× …".
const UNIT_WORDS: Record<string, [string, string]> = {
  frame: ["frame", "frames"], format: ["format", "formats"], round: ["round", "rounds"], week: ["week", "weeks"],
  day: ["day", "days"], image: ["image", "images"], photo: ["photo", "photos"], post: ["post", "posts"],
  cut: ["cut", "cuts"], video: ["video", "videos"], variation: ["variation", "variations"], location: ["location", "locations"],
};
export function countUnit(addon: any): [string, string] | null {
  const m = /\bper\s+([a-z]+)/i.exec(`${addon?.note || ""} ${addon?.m || ""}`);
  if (!m) return null;
  const w = m[1].toLowerCase();
  return UNIT_WORDS[w] || UNIT_WORDS[w.replace(/s$/, "")] || null;
}

// The words of a priced add-on on a quote line: "Rush delivery", "2× Hook / CTA variation",
// "Link in bio (2 weeks)", "Whitelisting / boosting (3 months)"
export function addonLabel(a: { n: string; count?: number; months?: number; unit?: [string, string] | null }): string {
  const c = Math.max(1, Math.round(Number(a?.count) || 1));
  const parts: string[] = [];
  if (a?.unit) parts.push(`${c} ${c === 1 ? a.unit[0] : a.unit[1]}`);
  if (a?.months) parts.push(`${a.months} ${a.months === 1 ? "month" : "months"}`);
  const head = !a?.unit && c > 1 ? `${c}× ${a.n}` : a.n;
  return parts.length ? `${head} (${parts.join(", ")})` : head;
}

// ─── LINE PRICING ────────────────────────────────────────────
export interface AddonPick { addon: any; months?: number; count?: number; }

// one priced add-on — stored on the line as addonDetail (what renewals, re-pricing,
// the PDF breakdown and production read later)
export interface AddonCalc {
  key?: string; n: string; amt: number;
  months?: number; count?: number; unit?: [string, string];
  p: number | null; pct: number | null; perMonth: boolean; work: boolean;
}

export interface LineCalc {
  unit: number; qty: number; gross: number; volPct: number; base: number;
  usagePct: number; exclPct: number; uplifted: number;
  addons: AddonCalc[];
  amt: number;
}

export function priceLine(a: { unit: number; qty: number; cat: string; vol: boolean; tiers?: VolTier[]; usagePct: number; exclPct: number; addons: AddonPick[] }): LineCalc {
  const unit     = Math.max(0, Number(a.unit) || 0);
  const qty      = Math.max(1, Math.round(Number(a.qty) || 1));
  const gross    = unit * qty;
  const vp       = volPct(a.cat, qty, a.vol, a.tiers);
  const base     = r2(gross * (1 - vp / 100));                                  // the item price
  const usagePct = Number(a.usagePct) || 0;
  const exclPct  = Number(a.exclPct)  || 0;
  const uplifted = r2(base * (1 + (usagePct + exclPct) / 100));               // + usage + exclusivity
  const addons: AddonCalc[] = (a.addons || []).map(({ addon, months, count }) => {
    const fixed = addon.p !== null && addon.p !== undefined;
    const m     = addon.perMonth ? Math.max(1, Math.round(Number(months) || 1)) : 1;
    const c     = fixed ? Math.max(1, Math.round(Number(count) || 1)) : 1;
    // fixed price × count × months · a percentage is taken of the item price only, never of usage / exclusivity
    const amt   = fixed ? r2((Number(addon.p) || 0) * c * m) : r2(base * (Number(addon.pct) || 0) / 100 * m);
    const unitW = fixed ? (addon.unit !== undefined ? addon.unit : countUnit(addon)) : null;
    return {
      ...(addon.key ? { key: addon.key } : {}),
      n: addon.n, amt,
      ...(addon.perMonth ? { months: m } : {}),
      ...(fixed ? { count: c } : {}),
      ...(unitW ? { unit: unitW } : {}),
      p: fixed ? Number(addon.p) || 0 : null,
      pct: fixed ? null : Number(addon.pct) || 0,
      perMonth: !!addon.perMonth,
      work: !!addon.work,
    };
  });
  const amt = r2(uplifted + addons.reduce((s, x) => s + x.amt, 0));   // keep the cents (212,50 € stays 212,50 €)
  return { unit, qty, gross, volPct: vp, base, usagePct, exclPct, uplifted, addons, amt };
}

// ─── RE-PRICE A STORED LINE FOR ANOTHER QUANTITY ─────────────
// Lines made by the Calculator (pv 2) carry their price inputs. While the stored amount
// still matches those inputs, the line is priced again with the same rules (volume tiers,
// add-ons, rate-card price). Everything else — older lines, discounted retainer-invoice
// lines, amounts typed by hand — is scaled per piece, as before.
const amtOf = (ln: any): number => {
  const v = typeof ln?.amt === "number" ? ln.amt : parseFloat(String(ln?.amt ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
const qtyOf = (ln: any): number => Math.max(1, parseInt(String(ln?.qty ?? 1)) || 1);

function storedArgs(ln: any) {
  return {
    cat: ln.cat, vol: !!ln.vol, tiers: Array.isArray(ln.volTiers) ? ln.volTiers : undefined,
    usagePct: Number(ln.usagePct) || 0, exclPct: Number(ln.exclPct) || 0,
    addons: (Array.isArray(ln.addonDetail) ? ln.addonDetail : []).map((x: any) => ({
      addon: { key: x.key, n: x.n, p: x.p ?? null, pct: x.pct ?? null, perMonth: !!x.perMonth, work: !!x.work, unit: x.unit ?? null },
      months: x.months, count: x.count,
    })),
  };
}

export function requantify(ln: any, qty: number): any {
  const q    = Math.max(1, Math.round(Number(qty) || 1));
  const oldQ = qtyOf(ln);
  const amt0 = amtOf(ln);
  if (ln?.pv === 2 && typeof ln.up === "number") {
    const args = storedArgs(ln);
    const now  = priceLine({ ...args, qty: oldQ, unit: ln.up });
    if (Math.abs(now.amt - amt0) < 0.005) {
      const calc = priceLine({ ...args, qty: q, unit: ln.up });
      const lp   = Number(ln.listPrice);
      const list = Number.isFinite(lp) && Math.abs(lp - ln.up) > 0.004 ? priceLine({ ...args, qty: q, unit: lp }) : null;
      const out: any = { ...ln, qty: calc.qty, base: calc.base, volPct: calc.volPct, addonDetail: calc.addons, addons: calc.addons.map(addonLabel), amt: calc.amt };
      if (list && list.amt > calc.amt + 0.004) out.listAmt = list.amt; else delete out.listAmt;
      // the agreed volume discount stays with the line: below its first tier it simply gives 0 %,
      // back above it applies again (documents and agreed revision items have no switch)
      return out;
    }
  }
  const f = q / oldQ;
  const out: any = { ...ln, qty: q, amt: r2(amt0 * f) };
  if (typeof ln?.listAmt === "number") out.listAmt = r2(ln.listAmt * f);
  if (typeof ln?.base === "number")    out.base    = r2(ln.base * f);
  return out;
}

// ─── RENEWALS ────────────────────────────────────────────────
// Base price of a quote line (before usage / exclusivity / add-ons)
export function lineBase(ln: any): number {
  if (typeof ln?.base === "number") return ln.base;
  const u = typeof ln?.usagePct === "number" ? ln.usagePct : (parsePct(ln?.usageLabel) ?? 0);
  const e = typeof ln?.exclPct  === "number" ? ln.exclPct  : (parsePct(ln?.exclLabel)  ?? 0);
  const addons = Array.isArray(ln?.addonDetail) ? ln.addonDetail.reduce((s: number, x: any) => s + (Number(x.amt) || 0), 0) : 0;
  return r2(Math.max(0, (Number(ln?.amt) || 0) - addons) / (1 + (u + e) / 100));
}

// Options for a renewal, from the line's own rate card
export function renewalOptions(rc: any, cat: string, kind: "usage" | "excl"): any[] {
  const card = rc?.[cat] || rc?.influencer;
  const list = (card?.[kind] || []).filter((o: any) => !o.sentinel);
  return list.length ? list : (RENEWAL_OPTS as any)[kind];
}

// Percent of the same option on another card (same name, else same months + same type).
// ok = false: that card doesn't offer the option — the chosen option's own % is charged
// and the Calculator marks the item "check rights".
export function pctOnInfo(rc: any, cat: string, kind: "usage" | "excl", opt: any): { pct: number; ok: boolean } {
  const list: any[] = rc?.[cat]?.[kind] || [];
  const name = optName(opt?.l).toLowerCase();
  const byName = list.find(o => !o.sentinel && optName(o.l).toLowerCase() === name);
  if (byName) return { pct: Number(byName.pct) || 0, ok: true };
  const type = (l: string) => /paid/i.test(l) ? "paid" : /organic/i.test(l) ? "organic" : /full/i.test(l) ? "full" : /categ/i.test(l) ? "category" : "";
  const sameType = list.find(o => !o.sentinel && Number(o.mo) === Number(opt?.mo) && type(o.l) === type(opt?.l || ""));
  return sameType ? { pct: Number(sameType.pct) || 0, ok: true } : { pct: Number(opt?.pct) || 0, ok: false };
}
export function pctOn(rc: any, cat: string, kind: "usage" | "excl", opt: any): number {
  return pctOnInfo(rc, cat, kind, opt).pct;
}

// When the current usage license ends — the same end the Licenses tab shows (one source):
// paid usage incl. whitelisting, renewals and rights extensions; without paid usage, the organic end.
export function licenseEnd(pr: any): string | null {
  const ls = projectLicenses(pr);
  return ls.find(l => l.kind === "paid")?.end || ls.find(l => l.kind === "organic")?.end || null;
}

export const renewalStart = (pr: any): string => {
  const end = licenseEnd(pr);
  return end ? addD(end, 1) : today();
};

// the retainer discount of a rate card (Service Catalog setting), 20 % when not set
export const retainerPctOf = (card: any): number => {
  const v = Number(card?.retainerPct);
  return card?.retainerPct !== undefined && card?.retainerPct !== null && card?.retainerPct !== "" && Number.isFinite(v) && v >= 0 && v < 100 ? v : 20;
};
