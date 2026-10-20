// ─────────────────────────────────────────────────────────────
// Calculator — the quote builder (one screen, the same layout in every state)
//   CLIENT     client · project · leads · details (contact, date, validity, language)
//              — list rows that are edited in place
//   ADD ITEMS  category chips + tiles (tap a tile = +1, − on the tile takes one off)
//   QUOTE      rights for all items · lines that open in place · retainer · discounts
//   bottom bar: the total (or what's still missing) and the one main button (Preview …)
// New quote, revision and amendment differ only in values. Every price comes from the
// rate cards through pricing.ts → priceLine; the quote's rights apply to every line
// unless a line has its own. The only next level is the quote window (preview → save → send).
// The quote being built survives tab switches (quoteDraft) until it is saved or you Exit.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import PDFModal from "./PDFModal";
import { editLock } from "./saveStatus";
import { C, SANS, SERIF, PAL, catInfo, TYPE, TRACK, RADIUS, SPACING, DENSITY, cardTone } from "./constants";
import { fmt, fmtD, fmtPct, today, uid, addD, pctSpace, r2 } from "./formatters";
import {
  NumField, ConfirmDialog, PillBtn, Chip, ChipRow, Switch, Stepper, BottomBar, BOTTOM_BAR_SPACE,
  SectionHead, DashCard, TonedTag, MiniInput, MiniSelect,
} from "./atoms";
import {
  normalizeCards, pricingCats, cardChoices, cardAddons, priceLine, optLabel, optName, addonPriceText,
  BASE_CARD_KEYS, pctOnInfo, volTiersOf, volPctOf, requantify, addonLabel, countUnit, retainerPctOf,
} from "./pricing";
import { retDiscOf, vatInfo } from "./docs";
import { quoteDraft } from "./quoteDraft";
import { sendQuestion } from "./docFlow";

interface CalcProps {
  isMobile:    boolean;
  settings:    any;
  rc:          any;
  rcReady?:    boolean;          // rate cards loaded (until then rc holds the built-in cards)
  prefill:     any;
  clearPrefill:() => void;
  clientsHook: any;
  onAfterSave: (projectId: string) => void;
}

const catTitle = (rc: any, key: string) =>
  BASE_CARD_KEYS.includes(key) ? catInfo(key).label : (rc?.[key]?.label || key);
const NEW_CLIENT = "__new";
const PLATFORMS  = ["Instagram", "TikTok", "YouTube", "Other"];
const RET_MONTHS = [2, 3, 4, 5, 6, 9, 12, 18, 24];
const DE_COUNTRY = /^(germany|deutschland|austria|österreich|oesterreich|switzerland|schweiz)$/i;
// language: the client's last document, otherwise their country (no client yet: English)
function clientLang(c: any): "en" | "de" {
  const docs = (c?.projects || []).flatMap((pr: any) => pr.documents || []).filter((d: any) => d.lang === "en" || d.lang === "de")
    .sort((a: any, b: any) => String(b.docDate || "").localeCompare(String(a.docDate || "")));
  if (docs[0]) return docs[0].lang;
  return c && DE_COUNTRY.test(String(c.country || "").trim()) ? "de" : "en";
}

type Own    = { usage: number; excl: number; platforms: string[] };
// an add-on on a line: months (per-month add-ons; auto = follows the paid usage), count (fixed-price add-ons)
type Pick   = { key: string; months: number; count: number; auto: boolean };
type Line   = { id: string; cat: string; key?: string; qty: number; neg: number | null; vol: boolean; addons: Pick[]; own: Own | null; fixed?: any };
type Rights = { usage: any | null; excl: any | null; platforms: string[]; cat?: string | null };   // cat = the card the options were picked from
const NO_RIGHTS: Rights = { usage: null, excl: null, platforms: [], cat: null };

const normPick = (a: any): Pick => ({ key: a.key, months: Math.max(1, Number(a.months) || 1), count: Math.max(1, Number(a.count) || 1), auto: !!a.auto });
const normLines = (ls: any[]): Line[] => (ls || []).map((l: any) => ({ ...l, vol: !!l.vol, addons: (l.addons || []).map(normPick) }));
const draftHasWork = (st: any) => !!(st && ((st.lines || []).length || String(st.projName || "").trim() || String(st.newName || "").trim()));
// whitelisting follows the paid usage period; organic or no usage → 1 month
const paidMonths = (opt: any) => (opt && !opt.sentinel && /paid/i.test(String(opt.l || "")) ? Math.max(1, Number(opt.mo) || 1) : 1);
const shortOpt = (l: any) => optName(l).replace(/\s+—\s+/, " ");

const MI: any    = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase", color: C.muted };
const LBL: any   = { ...MI, marginBottom: 5 };
const SMALL: any = { fontSize: TYPE.subtext.size, color: C.muted };
const ELL: any   = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const HAIR       = `1px solid ${C.hair}`;
const ROW: any   = { display: "flex", alignItems: "center", gap: 10, minHeight: DENSITY.row1 };
const ROWLBL: any = { width: 56, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted };
const PANEL: any = { background: C.bg, borderRadius: RADIUS.field, padding: "10px 10px 4px", marginBottom: 10 };
const GRID2: any = { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 };
const linkBtn = (color: string): any => ({ background: "none", border: "none", padding: "0 2px", minHeight: 32, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color });
// − and + on a tile: the same white circle (− faint while nothing is added).
// The sign is drawn (not a text glyph), so it sits exactly in the middle on every phone.
const circle = (on: boolean): any => ({ width: 24, height: 24, borderRadius: 12, border: `1px solid ${on ? C.edge : C.line}`, background: C.white, boxSizing: "border-box",
  display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
const sign = (plus: boolean, on: boolean) => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ display: "block" }}>
    <path d={plus ? "M5 1v8M1 5h8" : "M1 5h8"} stroke={on ? C.black : C.faint} strokeWidth="1.3" strokeLinecap="round" fill="none" />
  </svg>
);

export default function Calculator({
  isMobile, settings, rc: rawRc, rcReady = true, prefill, clearPrefill, clientsHook, onAfterSave,
}: CalcProps) {
  const rc      = useMemo(() => normalizeCards(rawRc), [rawRc]);
  const isRev   = !!prefill?.isRev;
  const isAmend = !!prefill?.isAmend;
  const locked  = isRev || isAmend;              // client + project are fixed
  const revN    = prefill?.revN    || 1;
  const amendN  = prefill?.amendN  || 1;

  // ── Client + project ──────────────────────────────────────
  const clientList = useMemo(
    () => [...(clientsHook.clients || [])].sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [clientsHook.clients]
  );
  const initialClient = (() => {
    if (prefill?.cid) return prefill.cid;
    const byName = prefill?.brand && clientList.find((c: any) => c.name.trim().toLowerCase() === String(prefill.brand).trim().toLowerCase());
    if (byName) return byName.id;
    return clientList.length ? "" : NEW_CLIENT;
  })();

  // The quote that was being built before a tab switch. "+ Quote" for another client while
  // an unsaved quote exists asks first (Discard / Continue it) — nothing is lost silently.
  const draftKey = locked ? `${isRev ? "rev" : "amend"}:${prefill?.pid || ""}` : "new";
  const boot = useRef<{ saved: any; pending: any } | null>(null);
  if (!boot.current) {
    const st = quoteDraft.get(draftKey);
    const other = !!st && !locked && !!(prefill?.cid || prefill?.brand) && st.clientSel !== initialClient;
    boot.current = { saved: st && !other ? st : null, pending: other && draftHasWork(st) ? st : null };
  }
  const saved0 = boot.current.saved;
  const skipDraft = useRef<boolean>(!!boot.current.pending);   // no draft writes while the question is open, or after saving
  const [askOther, setAskOther] = useState<boolean>(!!boot.current.pending);

  const [clientSel, setClientSel] = useState<string>(saved0?.clientSel ?? initialClient);
  const [newName,   setNewName]   = useState<string>(saved0?.newName ?? (initialClient === NEW_CLIENT ? (prefill?.brand || "") : ""));
  const [contact,   setContact]   = useState<string>(saved0?.contact ?? (prefill?.contact || clientList.find((c: any) => c.id === initialClient)?.contact || ""));
  const [target,    setTarget]    = useState<string>(saved0?.target ?? (!locked && prefill?.pid ? prefill.pid : "new"));
  const [projName,  setProjName]  = useState<string>(saved0?.projName ?? (prefill?.projectName && isRev ? prefill.projectName : ""));
  const [qDate,     setQDate]     = useState<string>(saved0?.qDate ?? today());
  const [vDays,     setVDays]     = useState<number>(saved0?.vDays ?? (Number(prefill?.validDays) || 14));
  const [vDaysText, setVDaysText] = useState<string>(String(saved0?.vDays ?? (Number(prefill?.validDays) || 14)));
  const [showDetails, setShowDetails] = useState(false);
  const [showOrig,  setShowOrig]  = useState(false);
  const [formErr,   setFormErr]   = useState<string | null>(null);
  const [info,      setInfo]      = useState<string | null>(null);
  const [canUndo,   setCanUndo]   = useState(false);
  const [askExit,   setAskExit]   = useState(false);
  const nameBeforeLead = useRef<string>(saved0?.nameBeforeLead ?? "");   // your project name before a lead was picked
  const undoRights     = useRef<Rights | null>(null);

  const selClient = clientList.find((c: any) => c.id === clientSel);
  const dupe = clientSel === NEW_CLIENT && newName.trim()
    ? clientList.find((c: any) => c.name.trim().toLowerCase() === newName.trim().toLowerCase())
    : null;
  const brandName = locked ? (prefill?.brand || selClient?.name || "") : selClient ? selClient.name : newName.trim();
  const leads = selClient ? (selClient.projects || []).filter((p: any) => p.status === "lead" && !p.qd) : [];
  const leadSel = leads.find((p: any) => p.id === target);
  const [lang, setLang] = useState<"en" | "de">(saved0?.lang ?? (prefill?.lang === "de" || prefill?.lang === "en" ? prefill.lang : clientLang(selClient)));
  const langSet = useRef<boolean>(!!saved0?.langSet);

  const pickClient = (v: string) => {
    if (leadSel) setProjName(nameBeforeLead.current);          // a lead's name goes with the lead
    setClientSel(v); setFormErr(null); setInfo(null); setCanUndo(false);
    const c = clientList.find((x: any) => x.id === v);
    setContact(c ? (c.contact || "") : "");
    setTarget("new");
    if (!langSet.current) setLang(clientLang(c));
  };
  const toggleLead = (l: any) => {
    if (target === l.id) { setTarget("new"); setProjName(nameBeforeLead.current); return; }
    if (!leadSel) nameBeforeLead.current = projName;
    setTarget(l.id); setProjName(l.name);
  };
  const openCount = (c: any) => (c.projects || []).filter((p: any) => !p.paid && ["lead", "quoted", "revised", "contracted", "production", "invoiced"].includes(p.status)).length;

  // ── Catalogue ─────────────────────────────────────────────
  const cats = pricingCats(rc);
  const [bCat, setBCat] = useState<string>(() => saved0?.bCat ?? ((prefill?.ctab && cats.includes(prefill.ctab) ? prefill.ctab : cats[0]) || "influencer"));
  const catSel  = cats.includes(bCat) ? bCat : (cats[0] || bCat);   // a deleted or emptied card falls back to the first one
  const card    = rc[catSel] || { sections: [], usage: [], excl: [] };
  const choices = cardChoices(card);
  const tiles   = [...choices.filter(c => c.kind === "deliverable"), ...choices.filter(c => c.kind === "package")];
  const tiersOf = (cat: string) => volTiersOf(rc[cat], cat);
  const inCatalogue = (l: Line) => !!rc[l.cat] && cardChoices(rc[l.cat]).some(c => c.key === l.key);
  // an original line of a revision → its catalogue item (same name and kind), so the tiles count it
  const keyByName = (cat: string, ln: any) => {
    const n = String(ln?.name || "").trim().toLowerCase();
    const ch = cardChoices(rc[cat]).find(c => String(c.item.n || "").trim().toLowerCase() === n && (!ln?.kind || c.kind === ln.kind));
    return ch ? ch.key : undefined;
  };

  // ── The quote ─────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>(() => (saved0?.lines ? normLines(saved0.lines) : (
    isRev && prefill?.origLines?.length
      ? prefill.origLines.map((ln: any) => {
          const cat = ln.cat || prefill.ctab || "influencer";
          return { id: uid(), cat, key: keyByName(cat, ln), qty: Math.max(1, parseInt(ln.qty) || 1), neg: null, vol: false, addons: [], own: null, fixed: { ...ln, cat } };
        })
      : [])));
  const [rights,     setRights]     = useState<Rights>(() => (saved0?.rights ? { ...NO_RIGHTS, ...saved0.rights } : NO_RIGHTS));
  const [rightsOpen, setRightsOpen] = useState(false);
  const [openLine,   setOpenLine]   = useState<string | null>(null);
  const [retOn,      setRetOn]      = useState<boolean>(saved0?.retOn ?? (isRev ? !!prefill?.retainer : false));
  const [retMo,      setRetMo]      = useState<number>(saved0?.retMo ?? (isRev && prefill?.retMo ? Number(prefill.retMo) : 6));
  const [showDisc,   setShowDisc]   = useState<boolean>(saved0?.showDisc ?? false);
  const [pdf,        setPdf]        = useState<any>(null);

  useEffect(() => {
    if (skipDraft.current) return;
    quoteDraft.set(draftKey, { clientSel, newName, contact, target, projName, qDate, vDays, lang, langSet: langSet.current, bCat, lines, rights, retOn, retMo, showDisc, nameBeforeLead: nameBeforeLead.current });
  }, [draftKey, clientSel, newName, contact, target, projName, qDate, vDays, lang, bCat, lines, rights, retOn, retMo, showDisc]);

  // the answer to "Unsaved quote for …"
  const pending = boot.current?.pending;
  const continueOther = () => {
    const st = pending;
    if (st) {
      setClientSel(st.clientSel ?? ""); setNewName(st.newName ?? ""); setContact(st.contact ?? ""); setTarget(st.target ?? "new");
      setProjName(st.projName ?? ""); setQDate(st.qDate ?? today()); setVDays(st.vDays ?? 14); setVDaysText(String(st.vDays ?? 14));
      setLang(st.lang ?? "en"); langSet.current = !!st.langSet; if (st.bCat) setBCat(st.bCat);
      setLines(normLines(st.lines)); setRights(st.rights ? { ...NO_RIGHTS, ...st.rights } : NO_RIGHTS);
      setRetOn(!!st.retOn); setRetMo(st.retMo ?? 6); setShowDisc(!!st.showDisc); nameBeforeLead.current = st.nameBeforeLead ?? "";
    }
    if (boot.current) boot.current.pending = null;
    skipDraft.current = false; setAskOther(false);
    if (clearPrefill) clearPrefill();            // the other client's "+ Quote" is dropped (same screen, same mode)
  };
  const discardOther = () => {
    quoteDraft.clear("new");
    if (boot.current) boot.current.pending = null;
    skipDraft.current = false; setAskOther(false);
  };
  const pendingName = !pending ? "" : pending.clientSel === NEW_CLIENT ? (String(pending.newName || "").trim() || "a new client")
    : (clientList.find((c: any) => c.id === pending.clientSel)?.name || "another client");

  // rights are chosen from the card they were picked from; before that, from the first editable line's card
  const rightsCat = lines.find(l => !l.fixed)?.cat || catSel;
  const rCardKey  = rights.cat && rc[rights.cat] ? rights.cat : rightsCat;
  const rCard     = rc[rCardKey] || card;
  const idxIn = (list: any[], opt: any) => {
    if (!opt) return 0;
    const n = optName(opt.l).toLowerCase();
    const i = (list || []).findIndex((o: any) => !o.sentinel && optName(o.l).toLowerCase() === n);
    return i >= 0 ? i : 0;
  };

  // ── One line → the stored line (pv 2: it carries its price inputs) ──
  const itemOf = (ln: Line): any => {
    if (ln.fixed) return { ...ln.fixed, id: ln.id };
    const cardL = rc[ln.cat];
    const choice = cardL ? cardChoices(cardL).find(c => c.key === ln.key) : null;
    if (!choice) return null;
    const addonList = cardAddons(cardL);
    const uOpt = ln.own ? (cardL.usage || [])[ln.own.usage] : rights.usage;
    const eOpt = ln.own ? (cardL.excl  || [])[ln.own.excl]  : rights.excl;
    const plats = ln.own ? ln.own.platforms : rights.platforms;
    const uOn = !!uOpt && !uOpt.sentinel, eOn = !!eOpt && !eOpt.sentinel;
    const uPct = uOn ? (ln.own ? Number(uOpt.pct) || 0 : pctOnInfo(rc, ln.cat, "usage", uOpt).pct) : 0;
    const ePct = eOn ? (ln.own ? Number(eOpt.pct) || 0 : pctOnInfo(rc, ln.cat, "excl", eOpt).pct) : 0;
    const autoMo = paidMonths(uOn ? uOpt : null);
    const adds = ln.addons.map(a => {
      const addon = addonList.find((x: any) => x.key === a.key);
      return addon ? { addon, months: addon.perMonth && a.auto ? autoMo : a.months, count: a.count } : null;
    }).filter(Boolean) as any[];
    const listUnit = Number(choice.item.p ?? 0) || 0;
    const tiers = tiersOf(ln.cat);
    const args = { qty: Math.max(1, ln.qty), cat: ln.cat, vol: ln.vol, tiers, usagePct: uPct, exclPct: ePct, addons: adds };
    const calc = priceLine({ ...args, unit: ln.neg !== null ? Math.max(0, ln.neg) : listUnit });
    const list = ln.neg !== null ? priceLine({ ...args, unit: listUnit }) : null;
    return {
      id:          ln.id,
      pv:          2,
      cat:         ln.cat,
      ...(BASE_CARD_KEYS.includes(ln.cat) ? {} : { catLabel: catTitle(rc, ln.cat) }),
      kind:        choice.kind,
      name:        choice.item.n || "",
      note:        choice.item.note || "",
      ...(choice.kind === "package" ? { includes: (choice.item.includes || []).filter((x: any) => x?.n).map((x: any) => ({ n: x.n, qty: Number(x.qty) || 1 })) } : {}),
      qty:         calc.qty,
      up:          calc.unit,
      listPrice:   listUnit,
      base:        calc.base,
      volPct:      calc.volPct,
      vol:         !!ln.vol,
      volTiers:    tiers,
      usageLabel:  uOn ? optLabel({ ...uOpt, pct: uPct }) : undefined,
      usagePct:    uPct,
      usageMo:     uOn ? Number(uOpt.mo) || 0 : 0,
      exclLabel:   eOn ? optLabel({ ...eOpt, pct: ePct }) : undefined,
      exclPct:     ePct,
      exclMo:      eOn ? Number(eOpt.mo) || 0 : 0,
      addons:      calc.addons.map(addonLabel),
      addonDetail: calc.addons,
      platforms:   plats,
      amt:         calc.amt,
      ...(list && list.amt > calc.amt + 0.004 ? { listAmt: list.amt } : {}),
    };
  };
  // the item's card doesn't offer the quote's option → still charged, marked "check rights"
  const rightsCheck = (ln: Line): boolean => {
    if (ln.fixed || ln.own) return false;
    const u = rights.usage && !rights.usage.sentinel ? pctOnInfo(rc, ln.cat, "usage", rights.usage) : null;
    const e = rights.excl  && !rights.excl.sentinel  ? pctOnInfo(rc, ln.cat, "excl",  rights.excl)  : null;
    return !!((u && !u.ok) || (e && !e.ok));
  };

  const items = lines.map(itemOf).filter(Boolean) as any[];
  const subtotal = r2(items.reduce((s, it) => s + (Number(it.amt) || 0), 0));
  // a revision keeps the retainer % agreed in the quote (older quotes: 20 %)
  const retPct   = isRev && (prefill?.retainer || (prefill?.retDisc !== undefined && prefill?.retDisc !== null && prefill?.retDisc !== ""))
    ? retDiscOf({ retDisc: prefill?.retDisc }) : retainerPctOf(rc[rightsCat] || card);
  const monthly  = retOn ? Math.round(subtotal * (1 - retPct / 100)) : subtotal;   // the monthly fee stays a whole euro amount
  const totalAll = retOn ? monthly * retMo : subtotal;
  const validUntil = addD(qDate, vDays || 14) || qDate;
  const origLines: any[] = prefill?.origLines || [];
  const origTotal = Number(prefill?.origTotal) || origLines.reduce((s: number, l: any) => s + (Number(l.amt) || 0), 0);
  const origRet: any = prefill?.origRet || null;          // { mo, disc, fee } when the original was a retainer
  const origAmends: any[] = prefill?.origAmends || [];      // signed amendments (amendment mode)
  const discounted = items.filter(it => Number(it.listAmt) > Number(it.amt));

  // ── Changing quantities (tiles, steppers, original lines) ──
  const withQty = (l: Line, q: number): Line => {
    if (l.fixed) { const f = requantify(l.fixed, q); return { ...l, qty: Number(f.qty) || q, fixed: f }; }
    return { ...l, qty: q, vol: volPctOf(tiersOf(l.cat), q, true) > 0 ? l.vol : false };   // below the first tier the discount switches off
  };
  const upd = (id: string, patch: Partial<Line>) => setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const setQty = (id: string, q: number) => setLines(prev => (q <= 0 ? prev.filter(l => l.id !== id) : prev.map(l => (l.id === id ? withQty(l, q) : l))));
  const removeLine = (id: string) => { setLines(prev => prev.filter(l => l.id !== id)); setOpenLine(null); };
  // + adds to the item's last line (its rate, add-ons and volume stay); a line with its own rights gets a new line
  const addTile = (ch: any) => {
    setFormErr(null);
    setLines(prev => {
      const m = prev.filter(l => l.cat === catSel && l.key === ch.key && !l.own);
      const t = m[m.length - 1];
      if (t) return prev.map(l => (l.id === t.id ? withQty(l, l.qty + 1) : l));
      return [...prev, { id: uid(), cat: catSel, key: ch.key, qty: 1, neg: null, vol: false, addons: [], own: null }];
    });
  };
  // − takes one off the item's last line; at 0 the line goes
  const subTile = (ch: any) => setLines(prev => {
    const m = prev.filter(l => l.cat === catSel && l.key === ch.key);
    const t = m[m.length - 1];
    if (!t) return prev;
    return t.qty <= 1 ? prev.filter(l => l.id !== t.id) : prev.map(l => (l.id === t.id ? withQty(l, l.qty - 1) : l));
  });
  const countOf = (key: string) => lines.filter(l => l.cat === catSel && l.key === key).reduce((s, l) => s + l.qty, 0);
  const toggleAddon = (ln: Line, a: any, on: boolean) => upd(ln.id, {
    addons: on ? ln.addons.filter(x => x.key !== a.key) : [...ln.addons, { key: a.key, months: 1, count: 1, auto: !!a.perMonth }],
  });
  const updPick = (ln: Line, key: string, patch: Partial<Pick>) => upd(ln.id, { addons: ln.addons.map(x => (x.key === key ? { ...x, ...patch } : x)) });

  useEffect(() => { if (openLine && !lines.some(l => l.id === openLine)) setOpenLine(null); }, [lines, openLine]);

  // items deleted in the Service Catalog leave the quote (with a note) instead of staying invisible
  useEffect(() => {
    if (!rcReady) return;
    const gone = lines.filter(l => !l.fixed && !inCatalogue(l)).length;
    if (!gone) return;
    setLines(prev => prev.filter(l => l.fixed || inCatalogue(l)));
    setInfo(`${gone} ${gone === 1 ? "item was" : "items were"} removed — no longer in the Service Catalog.`);
    setCanUndo(false);
  }, [rc, rcReady, lines]);

  // ── Start from the client's last quote (current catalogue prices) — only while the quote is empty ──
  const lastQuote = useMemo(() => {
    if (locked || !selClient) return null;
    const qs = (selClient.projects || []).flatMap((pr: any) => (pr.documents || []).filter((d: any) => d.kind === "quote" && Array.isArray(d.data?.lines) && d.data.lines.length));
    qs.sort((a: any, b: any) => String(b.docDate || "").localeCompare(String(a.docDate || "")));
    return qs[0] || null;
  }, [selClient, locked]);
  const showLastQuote = !!lastQuote && lines.length === 0;
  const useLastQuote = () => {
    const q: any = lastQuote; if (!q || lines.length) return;
    const got: Line[] = []; let miss = 0; let r: Rights | null = null;
    q.data.lines.forEach((ln: any) => {
      const cat = ln.cat && rc[ln.cat] ? ln.cat : catSel;
      const ch = cardChoices(rc[cat]).find(c => String(c.item.n || "").trim().toLowerCase() === String(ln.name || "").trim().toLowerCase());
      if (!ch) { miss++; return; }
      got.push({ id: uid(), cat, key: ch.key, qty: Math.max(1, parseInt(ln.qty) || 1), neg: null, vol: false, addons: [], own: null });
      if (!r) {
        const cl = rc[cat];
        const u = ln.usageLabel ? (cl.usage || []).find((o: any) => !o.sentinel && optName(o.l).toLowerCase() === optName(ln.usageLabel).toLowerCase()) : null;
        const e = ln.exclLabel ? (cl.excl || []).find((o: any) => !o.sentinel && optName(o.l).toLowerCase() === optName(ln.exclLabel).toLowerCase()) : null;
        r = { usage: u || null, excl: e || null, platforms: Array.isArray(ln.platforms) ? ln.platforms : [], cat };
      }
    });
    if (got.length) {
      undoRights.current = rights;
      setLines(got); if (r) setRights(r);
      setCanUndo(true);
    }
    setInfo(`Copied ${got.length} of ${q.data.lines.length} items from ${q.docNo || "the last quote"} at today's prices${miss ? ` · ${miss} not in your catalogue` : ""}.`);
  };
  const undoLastQuote = () => {
    setLines([]); setRights(undoRights.current || NO_RIGHTS); undoRights.current = null;
    setCanUndo(false); setInfo(null);
  };

  // ── What's missing before the preview ─────────────────────
  const missing = (() => {
    if (!brandName) return clientSel === NEW_CLIENT ? "Add the client's name" : "Choose a client";
    if (!locked && !String(projName || leadSel?.name || "").trim()) return items.length ? "Add a project name" : "Add a project name and an item";
    if (!items.length) return isAmend ? "Add an item to the amendment" : "Add an item";
    return null;
  })();

  // ── Open preview ──────────────────────────────────────────
  const openPreview = () => {
    if (missing) { setFormErr(missing); return; }
    setFormErr(null);
    const catsUsed = [...new Set(items.map(it => it.cat))];
    const ctype = catsUsed.length > 1          ? "Content Creator"
      : catsUsed[0] === "ugc"                  ? "UGC Creator"
      : catsUsed[0] === "editorial"            ? "Editorial Content Creator"
      : catsUsed[0] === "hotels"               ? "Content Creator (Hospitality)"
      : catsUsed[0] && !BASE_CARD_KEYS.includes(catsUsed[0]) ? (rc[catsUsed[0]]?.label || "Content Creator")
      : "Content Creator (Influencer)";
    const ctab = catsUsed.length === 1 ? catsUsed[0] : (catsUsed.length > 1 ? "complete" : "influencer");
    // usage period for the whole quote = the longest usage period of any line
    let mo: number | null = null;
    items.forEach(it => {
      let m = Number(it.usageMo) || 0;
      if (!m && it.usageLabel) { const x = String(it.usageLabel).match(/(\d+)\s*month/i); if (x) m = parseInt(x[1]); }
      if (m && (!mo || m > mo)) mo = m;
    });
    // merge only lines that are identical in every pricing-relevant way (same price per piece too)
    const merged = new Map<string, any>();
    items.forEach(raw => {
      const { id: _id, ...it } = raw;
      const per = r2((Number(it.amt) || 0) / Math.max(1, Number(it.qty) || 1));
      const key = [
        it.cat, it.kind || "", it.name, it.up, it.usageLabel || "", it.exclLabel || "",
        [...(it.addons || [])].sort().join("|"), [...(it.platforms || [])].sort().join("|"),
        Number(it.volPct) || 0, per,
      ].join("__");
      const ex = merged.get(key);
      if (ex) {
        const exAmt = Number(ex.amt) || 0, itAmt = Number(it.amt) || 0;
        if (typeof ex.listAmt === "number" || typeof it.listAmt === "number") ex.listAmt = r2((Number(ex.listAmt) || exAmt) + (Number(it.listAmt) || itAmt));
        if (typeof ex.base === "number" || typeof it.base === "number") ex.base = r2((Number(ex.base) || 0) + (Number(it.base) || 0));
        ex.qty = (Number(ex.qty) || 1) + (Number(it.qty) || 1);
        ex.amt = r2(exAmt + itAmt);
        if (Array.isArray(ex.addonDetail) && Array.isArray(it.addonDetail)) {
          ex.addonDetail = ex.addonDetail.map((a: any) => {
            const b = it.addonDetail.find((x: any) => x.n === a.n);
            if (!b) return a;
            const both = { ...a, amt: r2((Number(a.amt) || 0) + (Number(b.amt) || 0)) };
            if (typeof a.count === "number" || typeof b.count === "number") both.count = (Number(a.count) || 0) + (Number(b.count) || 0);
            return both;
          });
          ex.addons = ex.addonDetail.map(addonLabel);
        }
      } else merged.set(key, { ...it });
    });
    const lns = Array.from(merged.values());
    const disc = showDisc && discounted.length > 0 ? { showDiscount: true } : {};

    if (isAmend) {
      setPdf({
        kind: "amendment", docNo: "", revision: 0, status: "draft", docDate: qDate, lang,
        data: {
          brand: brandName, contact, ctype, ctab, lines: lns, footer: "", calcV: 2,
          origTotal: Number(prefill?.origTotal) || 0, amendTotal: subtotal,
          contractNo: prefill?.contractNo || "", quoteNo: prefill?.qNo || "", ...disc,
        },
      });
      return;
    }
    const qNo = isRev ? (prefill?.qNo || "") : "";
    setPdf({
      kind: "quote", docNo: qNo, revision: isRev ? revN : 0, status: "draft", docDate: qDate, lang,
      data: {
        brand: brandName, contact, date: qDate, validUntil, qNo,
        rev: isRev ? revN : 0, mo, ctab, lines: lns, calcV: 2,
        total: monthly, ctype, footer: "",
        retainer: retOn, retMo: retOn ? retMo : undefined, retDisc: retOn ? retPct : undefined, ...disc,
      },
    });
  };

  const reset = () => {
    setLines([]); setRetOn(false); setFormErr(null); setInfo(null); setCanUndo(false); undoRights.current = null;
    setRights(NO_RIGHTS); setShowDisc(false); setOpenLine(null);
    setClientSel(clientList.length ? "" : NEW_CLIENT); setNewName(""); setContact(""); setProjName(""); setTarget("new"); nameBeforeLead.current = "";
    setQDate(today()); setVDays(14); setVDaysText("14"); langSet.current = false; setLang("en");
    if (clearPrefill) clearPrefill();
  };
  const hasWork = lines.length > 0 || !!projName.trim() || !!newName.trim();
  const doExit = () => { quoteDraft.clear(draftKey); setAskExit(false); reset(); };

  // ── Preview / saved document ──────────────────────────────
  const [saved, setSaved] = useState<{ clientId: string; projectId: string; docId: string } | null>(null);
  const savedRef = useRef<{ clientId: string; projectId: string; docId: string } | null>(null);
  // Send…: a draft quote / amendment is marked sent first (no "DRAFT" on the PDF)
  const pdfPrep = async (d: any) => {
    const s = savedRef.current;
    if (!s || d.status !== "draft") return d;
    return clientsHook.markDocSent(s.clientId, s.projectId, d.id || s.docId, settings);
  };

  // no background reload while a quote is being built
  const building = lines.length > 0 || !!pdf;
  useEffect(() => (building ? editLock.acquire() : undefined), [building]);

  if (pdf) {
    const sClient  = saved ? (clientsHook.clients || []).find((c: any) => c.id === saved.clientId) : null;
    const sProject = sClient ? sClient.projects.find((p: any) => p.id === saved.projectId) : null;
    const sDoc     = sProject ? (sProject.documents || []).find((d: any) => d.id === saved!.docId) : null;
    if (sDoc) {
      return (
        <PDFModal
          key={sDoc.id}
          doc={sDoc}
          settings={settings}
          client={sClient}
          editable={sDoc.status === "draft"}
          justSaved={true}
          note={sDoc.status === "draft" ? "Saved. You can still change it — Send… marks it as sent." : undefined}
          onSave={async (next: any) => clientsHook.updateDocument(saved!.clientId, saved!.projectId, sDoc.id, next, settings)}
          onPdf={pdfPrep}
          pdfConfirm={sendQuestion}
          onClose={() => { const pid = saved!.projectId; setPdf(null); setSaved(null); savedRef.current = null; if (onAfterSave) onAfterSave(pid); }}
        />
      );
    }
    return (
      <PDFModal
        doc={pdf}
        settings={settings}
        client={selClient || dupe || undefined}
        editable={true}
        isNew={true}
        note={isAmend ? "The amendment number is assigned when you save." : isRev ? undefined : "The quote number is assigned when you save."}
        onClose={() => setPdf(null)}
        onSave={async (doc: any) => {
          if (!isAmend && !isRev && !locked) {
            if (!String(brandName || "").trim()) throw new Error("Add the client's name first.");
            if (!String(projName || leadSel?.name || "").trim()) throw new Error("Add a project name first.");
          }
          const res = await clientsHook.saveQuote({
            doc, brand: brandName, contact: doc.data?.contact || contact,
            mode: isAmend ? "amend" : isRev ? "revise" : "new",
            projectName: projName || leadSel?.name || "",
            projectId: locked ? prefill?.pid : (leadSel ? leadSel.id : undefined),
            clientId:  locked ? prefill?.cid : (selClient?.id || dupe?.id),
            settings,
          });
          if (res.error) throw new Error(res.error);
          if (res.document) {
            savedRef.current = { clientId: res.clientId, projectId: res.projectId, docId: res.document.id };
            setSaved(savedRef.current);
          }
          // the saved quote must not come back as the next new quote; the prefill is
          // cleared by the app when the saved document closes (→ Projects)
          skipDraft.current = true;
          quoteDraft.clear(draftKey);
          setLines([]); setRetOn(false); setRights(NO_RIGHTS); setShowDisc(false);
          return res.document;
        }}
        onPdf={pdfPrep}
        pdfConfirm={sendQuestion}
      />
    );
  }

  // ── Small pieces ──────────────────────────────────────────
  const lockSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  const pencilSvg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>;
  const chev = (up: boolean, color: string = C.faint) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>;
  const press = (fn: () => void): any => ({ role: "button", tabIndex: 0, onClick: fn, onKeyDown: (e: any) => { if (e.key === "Enter") fn(); } });
  const optSelect = (list: any[], idx: number, onPick: (i: number) => void, label: string) => (
    <MiniSelect value={idx} aria-label={label} onChange={(e: any) => onPick(parseInt(e.target.value) || 0)}>
      {(list || []).map((o: any, i: number) => <option key={i} value={i}>{o.sentinel ? "None" : optLabel(o)}</option>)}
    </MiniSelect>
  );
  const platformChips = (sel: string[], onSet: (p: string[]) => void) => (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
      {PLATFORMS.map(p => {
        const on = sel.includes(p);
        return <Chip key={p} on={on} tone={PAL.neutral} dot={false} label={p} onClick={() => onSet(on ? sel.filter(x => x !== p) : [...sel, p])} />;
      })}
    </div>
  );
  const rightsText = [
    rights.usage && !rights.usage.sentinel ? shortOpt(rights.usage.l) : "No usage rights",
    rights.platforms.length ? rights.platforms.join(", ") : null,
    rights.excl && !rights.excl.sentinel ? shortOpt(rights.excl.l) : "no exclusivity",
  ].filter(Boolean).join(" · ");
  const title = isAmend ? `Amendment ${amendN}` : isRev ? `Revision ${revN}` : "New quote";
  const diff = totalAll - origTotal;
  const vatClient = selClient || dupe || (locked ? (clientsHook.clients || []).find((c: any) => c.id === prefill?.cid) : null) || { country: "Germany" };
  const netWord = vatInfo(settings, vatClient).mode === "domestic" ? " net" : "";
  const microLine = isAmend
    ? [prefill?.contractNo, "Draft", fmtD(qDate)].filter(Boolean).join(" · ")
    : [isRev ? prefill?.qNo : null, "Draft", `valid until ${fmtD(validUntil)}`].filter(Boolean).join(" · ");
  const moOptions = Array.from(new Set([...RET_MONTHS, retMo])).sort((a, b) => a - b);
  const editable = lines.some(l => !l.fixed);
  const nPending = (pending?.lines || []).length;

  return (
    <div style={{ fontFamily: SANS, color: C.black, maxWidth: isMobile ? undefined : 640, paddingBottom: `calc(${BOTTOM_BAR_SPACE}px + env(safe-area-inset-bottom, 0px))` }}>
      {askExit && (
        <ConfirmDialog title="Discard this quote?" text={`${lines.length ? `The ${lines.length} ${lines.length === 1 ? "item" : "items"} and the details are lost.` : "The details are lost."} Switching tabs keeps them.`}
          okLabel="Discard" danger onOk={doExit} onCancel={() => setAskExit(false)} />
      )}
      {askOther && (
        <ConfirmDialog title={`Unsaved quote for ${pendingName}`}
          text={`It has ${nPending} ${nPending === 1 ? "item" : "items"} and isn't saved. Continue it, or discard it and start the new quote.`}
          okLabel="Discard" cancelLabel="Continue it" danger onOk={discardOther} onCancel={continueOther} />
      )}

      {/* ── TITLE ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{title}</h2>
        <PillBtn onClick={() => (hasWork ? setAskExit(true) : doExit())}>Exit</PillBtn>
      </div>
      <div style={{ ...MI, marginTop: SPACING.titleToSummary }}>{microLine}</div>

      {/* ── CLIENT ── */}
      <SectionHead label="Client" right={!locked && showLastQuote
        ? <button onClick={useLastQuote} style={{ ...linkBtn(PAL.progress.ink), fontSize: TYPE.label.size, minHeight: 24 }}>Last quote ›</button> : undefined} />
      <DashCard s={{ marginTop: 0 }}>
        <div style={{ padding: "0 13px" }}>
          <div style={ROW}>
            <span style={ROWLBL}>Client</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {locked ? <><span style={{ ...ELL, flex: 1, fontSize: TYPE.row.size }}>{brandName || "—"}</span>{lockSvg}</>
                : clientSel === NEW_CLIENT ? <>
                    <MiniInput bare value={newName} onChange={(e: any) => setNewName(e.target.value)} placeholder="Brand name" aria-label="New client name" s={{ flex: 1 }} />
                    {clientList.length > 0 && (
                      <button onClick={() => { setClientSel(""); setNewName(""); }} aria-label="Back to the client list"
                        style={{ width: 32, height: 32, flexShrink: 0, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: TYPE.body.size, padding: 0 }}>✕</button>
                    )}
                  </>
                : <MiniSelect bare muted={!clientSel} value={clientSel} aria-label="Client" onChange={(e: any) => pickClient(e.target.value)}>
                    <option value="">Choose a client</option>
                    {clientList.map((c: any) => { const n = openCount(c); return <option key={c.id} value={c.id}>{c.name}{n ? ` · ${n} open` : ""}</option>; })}
                    <option value={NEW_CLIENT}>+ New client</option>
                  </MiniSelect>}
            </span>
          </div>
          {dupe && !locked && (
            <div style={{ fontSize: TYPE.subtext.size, color: PAL.waiting.ink, background: PAL.waiting.wash, borderRadius: RADIUS.tag, padding: "2px 9px", margin: "0 0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>{dupe.name} already exists</span>
              <button onClick={() => { pickClient(dupe.id); setNewName(""); }} style={{ ...linkBtn(PAL.waiting.ink), minHeight: 28 }}>use it ›</button>
            </div>
          )}
          <div style={{ ...ROW, borderTop: HAIR }}>
            <span style={ROWLBL}>Project</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {locked ? <><span style={{ ...ELL, flex: 1, fontSize: TYPE.row.size }}>{prefill?.projectName || "—"}</span>{lockSvg}</>
                : <>
                    <MiniInput bare value={projName} onChange={(e: any) => setProjName(e.target.value)} placeholder="Spring launch" aria-label="Project name" s={{ flex: 1 }} />
                    {leadSel && <TonedTag tone={PAL.neutral} s={{ flexShrink: 0 }}>lead</TonedTag>}
                  </>}
            </span>
          </div>
          {!locked && leads.length > 0 && (
            <div style={{ ...ROW, borderTop: HAIR }}>
              <span style={ROWLBL}>Leads</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, flexWrap: "wrap" as const, padding: "7px 0" }}>
                {leads.map((l: any) => <Chip key={l.id} on={target === l.id} tone={PAL.neutral} dot={false} label={l.name} onClick={() => toggleLead(l)} />)}
              </span>
            </div>
          )}
          <div {...press(() => setShowDetails(o => !o))} aria-expanded={showDetails} style={{ ...ROW, borderTop: HAIR, cursor: "pointer" }}>
            <span style={ROWLBL}>Details</span>
            <span style={{ ...ELL, flex: 1, minWidth: 0, fontSize: TYPE.subtext.size, color: C.ink2 }}>
              {[contact || "Add contact", lang.toUpperCase(), isAmend ? fmtD(qDate) : `valid until ${fmtD(validUntil)}`].join(" · ")}
            </span>
            {showDetails ? chev(true, C.muted) : pencilSvg}
          </div>
          {showDetails && (
            <div style={{ ...GRID2, padding: "2px 0 12px" }}>
              <div style={{ gridColumn: "1 / -1" }}><div style={LBL}>Contact</div><MiniInput value={contact} onChange={(e: any) => setContact(e.target.value)} placeholder="Anna Müller" aria-label="Contact" /></div>
              <div><div style={LBL}>{isAmend ? "Date" : "Quote date"}</div><MiniInput type="date" value={qDate} onChange={(e: any) => setQDate(e.target.value || today())} aria-label={isAmend ? "Date" : "Quote date"} /></div>
              {!isAmend && (
                <div><div style={LBL}>Valid for (days)</div>
                  <MiniInput inputMode="numeric" value={vDaysText} aria-label="Valid for days"
                    onChange={(e: any) => { const v = e.target.value; setVDaysText(v); const n = parseInt(v); if (n >= 1) setVDays(n); }}
                    onBlur={() => { const n = parseInt(vDaysText); if (n >= 1) setVDaysText(String(n)); else { setVDaysText("14"); setVDays(14); } }} />
                </div>
              )}
              <div style={isAmend ? undefined : { gridColumn: "1 / -1" }}><div style={LBL}>Language</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["de", "en"] as const).map(l => <Chip key={l} on={lang === l} tone={PAL.neutral} dot={false} label={l === "de" ? "Deutsch" : "English"} onClick={() => { langSet.current = true; setLang(l); }} />)}
                </div>
              </div>
            </div>
          )}
          {info && (
            <div style={{ ...SMALL, color: PAL.progress.ink, padding: "0 0 10px" }}>
              {info}{canUndo && <> <button onClick={undoLastQuote} style={{ ...linkBtn(PAL.progress.ink), minHeight: 24, textDecoration: "underline" }}>Undo</button></>}
            </div>
          )}
        </div>
      </DashCard>

      {/* ── ADD ITEMS ── */}
      <SectionHead dot={cardTone(catSel).mid} label="Add items" />
      <DashCard s={{ marginTop: 0 }}>
        <div style={{ padding: "11px 13px 13px" }}>
          <ChipRow>
            {cats.map(k => <Chip key={k} on={catSel === k} tone={cardTone(k)} label={catTitle(rc, k)} onClick={() => setBCat(k)} />)}
          </ChipRow>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: DENSITY.tileGap, marginTop: 10 }}>
            {tiles.map(ch => {
              const n = countOf(ch.key);
              const price = ch.item.p !== null && ch.item.p !== undefined ? fmt(Number(ch.item.p) || 0) : ch.item.m ? pctSpace(ch.item.m) : "";
              return (
                <div key={ch.key} {...press(() => addTile(ch))} aria-label={`Add ${ch.item.n}`}
                  style={{ minWidth: 0, padding: "7px 8px 6px 10px", borderRadius: RADIUS.tile, border: `1px solid ${n ? C.pillOn : PAL.neutral.wash}`,
                    background: n ? C.white : PAL.neutral.wash, cursor: "pointer", fontFamily: SANS, color: C.black, userSelect: "none" as const, WebkitUserSelect: "none" as const }}>
                  <div style={{ ...ELL, fontSize: TYPE.row.size }}>{ch.kind === "package" ? "Package · " : ""}{ch.item.n}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 4, minHeight: 24 }}>
                    <span style={{ ...ELL, fontSize: TYPE.subtext.size, color: C.muted }}>{price}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button aria-label={`Remove one ${ch.item.n}`} onClick={(e) => { e.stopPropagation(); subTile(ch); }} onKeyDown={(e) => e.stopPropagation()}
                        style={{ width: 30, height: 30, margin: -3, padding: 0, background: "none", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: n ? "pointer" : "default" }}>
                        <span style={circle(n > 0)}>{sign(false, n > 0)}</span>
                      </button>
                      <span style={{ minWidth: 16, textAlign: "center" as const, fontSize: TYPE.row.size, fontWeight: 500 }}>{n || ""}</span>
                      <span aria-hidden="true" style={circle(true)}>{sign(true, true)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {!tiles.length && <div style={{ ...SMALL, padding: "10px 2px 0" }}>No deliverables in this rate card yet — add them in the Service Catalog.</div>}
        </div>
      </DashCard>

      {/* ── THE QUOTE ── */}
      <SectionHead label={`${isAmend ? "Amendment" : "Quote"} · ${items.length} ${items.length === 1 ? "item" : "items"}`}
        right={locked && (origLines.length > 0 || origTotal > 0)
          ? <button onClick={() => setShowOrig(o => !o)} style={{ ...linkBtn(PAL.progress.ink), fontSize: TYPE.label.size, minHeight: 24 }}>{isAmend ? "Contract" : "Original"} {fmt(origTotal)} {showOrig ? "▴" : "›"}</button>
          : undefined} />
      <DashCard s={{ marginTop: 0 }}>
        <div style={{ padding: "0 13px" }}>
          {showOrig && (
            <div style={{ ...PANEL, padding: "4px 10px", margin: "10px 0" }}>
              {origLines.map((ln: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: i ? `1px solid ${PAL.neutral.fill}` : "none", fontSize: TYPE.subtext.size }}>
                  <span style={{ ...ELL, color: C.ink2 }}>{(Number(ln.qty) || 1) > 1 ? `${ln.qty}× ` : ""}{ln.name}</span><span style={{ whiteSpace: "nowrap" as const }}>{fmt(Number(ln.amt) || 0)}</span>
                </div>
              ))}
              {origRet && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${PAL.neutral.fill}`, fontSize: TYPE.subtext.size }}>
                  <span style={{ ...ELL, color: C.ink2 }}>Retainer −{fmtPct(Number(origRet.disc) || 0)} · {fmt(Number(origRet.fee) || 0)} / month × {origRet.mo}</span>
                  <span style={{ whiteSpace: "nowrap" as const }}>{fmt((Number(origRet.fee) || 0) * (Number(origRet.mo) || 0))}</span>
                </div>
              )}
              {origAmends.map((a: any, i: number) => (
                <div key={`a${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${PAL.neutral.fill}`, fontSize: TYPE.subtext.size }}>
                  <span style={{ ...ELL, color: C.ink2 }}>{a.label}</span><span style={{ whiteSpace: "nowrap" as const }}>{fmt(Number(a.total) || 0)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.rule}`, fontSize: TYPE.subtext.size }}>
                <span style={{ color: C.muted }}>{isAmend ? "Contract value" : "Original total"}</span><span style={{ whiteSpace: "nowrap" as const }}>{fmt(origTotal)}</span>
              </div>
            </div>
          )}

          {editable && (!rightsOpen ? (
            <div {...press(() => setRightsOpen(true))} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 50, cursor: "pointer", borderTop: showOrig ? HAIR : "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={MI}>Rights · all items</div>
                <div style={{ ...ELL, fontSize: TYPE.row.size, marginTop: 3 }}>{rightsText}</div>
              </div>
              <span style={SMALL}>Change</span>
            </div>
          ) : (
            <div style={{ padding: "10px 0 12px", borderTop: showOrig ? HAIR : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 28, marginBottom: 8 }}>
                <span style={MI}>Rights · all items</span>
                <PillBtn dark onClick={() => setRightsOpen(false)} s={{ height: 28, padding: "0 12px" }}>Done</PillBtn>
              </div>
              <div style={GRID2}>
                <div><div style={LBL}>Usage rights</div>{optSelect(rCard.usage, idxIn(rCard.usage, rights.usage), i => setRights(r => ({ ...r, cat: rCardKey, usage: rCard.usage[i]?.sentinel ? null : rCard.usage[i] || null })), "Usage rights")}</div>
                <div><div style={LBL}>Exclusivity</div>{optSelect(rCard.excl, idxIn(rCard.excl, rights.excl), i => setRights(r => ({ ...r, cat: rCardKey, excl: rCard.excl[i]?.sentinel ? null : rCard.excl[i] || null })), "Exclusivity")}</div>
              </div>
              <div style={{ ...LBL, marginTop: 8 }}>Platforms</div>
              {platformChips(rights.platforms, p => setRights(r => ({ ...r, platforms: p })))}
            </div>
          ))}

          {items.length === 0 && <div style={{ ...SMALL, textAlign: "center" as const, padding: "16px 0" }}>Add items from the catalogue above</div>}

          {items.map((it, i) => {
            const ln = lines.find(l => l.id === it.id)!;
            const open = openLine === it.id;
            const cardL = rc[ln.cat];
            const ch = !ln.fixed && cardL ? cardChoices(cardL).find(c => c.key === ln.key) : null;
            const listUnit = Number(ch?.item.p ?? 0) || 0;
            const adds = !ln.fixed && cardL ? cardAddons(cardL) : [];
            const per = ln.fixed ? r2((Number(it.amt) || 0) / Math.max(1, Number(it.qty) || 1)) : Number(it.up) || 0;
            const nAdd = (it.addonDetail || []).length;
            const meta = [
              `${it.qty} × ${fmt(per)}`,
              it.usageLabel ? shortOpt(it.usageLabel) : null,
              !ln.fixed && ln.neg !== null ? "your rate" : null,
              ln.own ? "own rights" : null,
              !ln.fixed && Number(it.volPct) ? `−${fmtPct(Number(it.volPct))} volume` : null,
              !ln.fixed && nAdd ? `+${nAdd} add-on${nAdd === 1 ? "" : "s"}` : null,
            ].filter(Boolean).join(" · ");
            const tiers = tiersOf(ln.cat);
            const volNow = volPctOf(tiers, ln.qty, true);
            return (
              <div key={it.id} style={{ borderTop: i || editable || showOrig ? HAIR : "none" }}>
                <div {...press(() => setOpenLine(open ? null : it.id))} aria-expanded={open}
                  style={{ display: "flex", alignItems: "center", gap: 9, minHeight: DENSITY.row2, padding: "7px 0", cursor: "pointer" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: cardTone(ln.cat).mid, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ ...ELL, fontSize: TYPE.row.size }}>{it.kind === "package" ? "Package · " : ""}{it.name}</span>
                      {ln.fixed ? <TonedTag tone={PAL.neutral} s={{ flexShrink: 0 }}>agreed</TonedTag>
                        : rightsCheck(ln) ? <TonedTag tone={PAL.waiting} s={{ flexShrink: 0 }}>check rights</TonedTag> : null}
                    </div>
                    <div style={{ ...ELL, fontSize: TYPE.label.size, color: C.muted, marginTop: 2 }}>{meta}</div>
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: TYPE.figure.size, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{fmt(Number(it.amt) || 0)}</div>
                  {chev(open)}
                </div>
                {open && (
                  <div style={PANEL}>
                    {ln.fixed ? <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={MI}>Qty</span>
                        <div style={{ width: 120 }}><Stepper h={SPACING.rowField} value={ln.qty} onChange={v => setQty(ln.id, v)} label={`${it.name} quantity`} /></div>
                      </div>
                      <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>
                        Price and rights as agreed · {fmt(per)} per item. To change them, remove the item and add it again.
                      </div>
                    </> : <>
                      <div style={GRID2}>
                        <div><div style={LBL}>Qty</div><Stepper h={SPACING.rowField} value={ln.qty} onChange={v => setQty(ln.id, v)} label={`${it.name} quantity`} /></div>
                        <div><div style={LBL}>Your rate</div><NumField mini value={ln.neg} onChange={v => upd(ln.id, { neg: v })} placeholder={fmt(listUnit)} ariaLabel={`${it.name} your rate`} /></div>
                      </div>
                      {ln.neg !== null && <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 4, textAlign: "right" as const }}>Rate card {fmt(listUnit)} per item</div>}
                      {adds.length > 0 && <>
                        <div style={{ ...LBL, marginTop: 10 }}>Add-ons</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                          {adds.map((a: any) => {
                            const on = ln.addons.some(x => x.key === a.key);
                            return <Chip key={a.key} on={on} tone={PAL.neutral} dot={false} label={`${a.n} ${addonPriceText(a)}`.trim()} onClick={() => toggleAddon(ln, a, on)} />;
                          })}
                        </div>
                        {(it.addonDetail || []).map((d: any) => {
                          const a = adds.find((x: any) => x.key === d.key);
                          const pick = ln.addons.find(x => x.key === d.key);
                          if (!a || !pick) return null;
                          const isFixed = a.p !== null && a.p !== undefined;
                          const unit = isFixed ? countUnit(a) : null;
                          const sub = isFixed ? (unit ? unit[1] : "count")
                            : a.perMonth ? (pick.auto ? "months · follows paid usage" : "months")
                            : `${fmtPct(Number(a.pct) || 0)} of the item price`;
                          return (
                            <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderTop: `1px solid ${C.line}`, marginTop: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ ...ELL, fontSize: TYPE.subtext.size }}>{a.n}</div>
                                <div style={{ ...ELL, fontSize: TYPE.label.size, color: C.muted }}>{sub}</div>
                              </div>
                              {isFixed && <div style={{ width: 108, flexShrink: 0 }}><Stepper h={SPACING.rowField} value={pick.count} onChange={v => updPick(ln, a.key, { count: v })} label={`${a.n} count`} /></div>}
                              {!isFixed && a.perMonth && <div style={{ width: 108, flexShrink: 0 }}><Stepper h={SPACING.rowField} value={Number(d.months) || 1} onChange={v => updPick(ln, a.key, { months: v, auto: false })} label={`${a.n} months`} /></div>}
                              <span style={{ fontSize: TYPE.subtext.size, minWidth: 66, textAlign: "right" as const, whiteSpace: "nowrap" as const }}>{fmt(Number(d.amt) || 0)}</span>
                            </div>
                          );
                        })}
                      </>}
                      {volNow > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <Switch on={ln.vol} onChange={v => upd(ln.id, { vol: v })} label="Volume discount" />
                          <span style={{ fontSize: TYPE.subtext.size, color: C.ink2 }}>Volume discount −{fmtPct(volNow)}</span>
                        </div>
                      )}
                      {ln.own && (
                        <div style={{ marginTop: 8 }}>
                          <div style={GRID2}>
                            <div><div style={LBL}>Own usage</div>{optSelect(cardL.usage, ln.own.usage, i2 => upd(ln.id, { own: { ...ln.own!, usage: i2 } }), "Own usage rights")}</div>
                            <div><div style={LBL}>Own exclusivity</div>{optSelect(cardL.excl, ln.own.excl, i2 => upd(ln.id, { own: { ...ln.own!, excl: i2 } }), "Own exclusivity")}</div>
                          </div>
                          <div style={{ marginTop: 6 }}>{platformChips(ln.own.platforms, p => upd(ln.id, { own: { ...ln.own!, platforms: p } }))}</div>
                        </div>
                      )}
                    </>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
                      {!ln.fixed
                        ? (ln.own
                            ? <button onClick={() => upd(ln.id, { own: null })} style={linkBtn(PAL.progress.ink)}>Use the quote's rights</button>
                            : <button onClick={() => upd(ln.id, { own: { usage: idxIn(cardL.usage, rights.usage), excl: idxIn(cardL.excl, rights.excl), platforms: rights.platforms } })} style={linkBtn(PAL.progress.ink)}>Different rights for this item ›</button>)
                        : <span />}
                      <button onClick={() => removeLine(ln.id)} style={linkBtn(PAL.late.ink)}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!isAmend && (items.length > 0 || retOn) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: DENSITY.row1, borderTop: HAIR }}>
              <span style={{ flex: 1, fontSize: TYPE.row.size, color: retOn ? C.black : C.muted }}>Monthly retainer −{fmtPct(retPct)}</span>
              {retOn && (
                <div style={{ width: 112, flexShrink: 0 }}>
                  <MiniSelect h={28} value={retMo} aria-label="Retainer months" onChange={(e: any) => setRetMo(parseInt(e.target.value) || 6)}>
                    {moOptions.map(m => <option key={m} value={m}>{m} months</option>)}
                  </MiniSelect>
                </div>
              )}
              <Switch on={retOn} onChange={setRetOn} label="Monthly retainer" />
            </div>
          )}

          {discounted.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, borderTop: HAIR, minHeight: 50 }}>
              <Switch on={showDisc} onChange={setShowDisc} label="Show discounts on the PDF" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: TYPE.row.size }}>Show discounts on the PDF</div>
                <div style={{ ...SMALL, ...ELL, fontSize: TYPE.label.size }}>{discounted[0].name} {fmt(Number(discounted[0].listAmt))} → {fmt(Number(discounted[0].amt))}</div>
              </div>
            </div>
          )}
        </div>
      </DashCard>
      {formErr && formErr !== missing && <div style={{ fontSize: TYPE.subtext.size, color: PAL.late.ink, margin: "8px 4px 0" }}>{formErr}</div>}

      {/* ── BOTTOM BAR: total · what's missing · the one main button ── */}
      <BottomBar>
        <div style={{ minWidth: 0 }}>
          {missing ? <>
            <div style={MI}>Before the preview</div>
            <div style={{ fontSize: TYPE.row.size, color: PAL.waiting.ink, marginTop: 4 }}>{missing}</div>
          </> : isAmend ? <>
            <div style={{ ...MI, ...ELL }}>Adds {fmt(subtotal)} · new total{netWord}</div>
            <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, marginTop: 2 }}>{fmt(origTotal + subtotal)}</div>
          </> : <>
            <div style={{ ...MI, ...ELL }}>
              {retOn ? `${fmt(monthly)} / month × ${retMo}` : `${items.length} ${items.length === 1 ? "item" : "items"}`}
              {isRev
                ? <span style={{ color: PAL.progress.ink }}> · {diff >= 0 ? "+" : "−"}{fmt(Math.abs(diff))} vs original</span>
                : <>{retOn ? (netWord ? " · net" : "") : ` · total${netWord}`}</>}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, marginTop: 2 }}>{fmt(totalAll)}</div>
          </>}
        </div>
        <PillBtn dark dim={!!missing} onClick={openPreview} s={{ height: 38, padding: "0 16px", fontSize: TYPE.row.size }}>
          {isAmend ? "Preview amendment" : isRev ? "Preview revision" : "Preview quote"}
        </PillBtn>
      </BottomBar>
    </div>
  );
}
