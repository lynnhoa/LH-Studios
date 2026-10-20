// ─────────────────────────────────────────────────────────────
// Calculator — the compact quote builder (one screen, the same layout in every state)
//   ① client & project, and one details line (contact · language · valid until)
//   ② catalogue: category chips + deliverable tiles (tap = add one)
//   ③ the quote: rights for all items, lines that open in place, retainer
//   bottom bar: the total, what's still missing, and the one main button (Preview …)
// New quote, revision and amendment differ only in values. Every price comes from
// the rate cards through pricing.ts → priceLine (same rules as before); the quote's
// rights apply to every line unless a line has its own (pctOn maps them per card).
// The quote being built survives tab switches (quoteDraft) until saved or Exit.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import PDFModal from "./PDFModal";
import { editLock } from "./saveStatus";
import { C, SANS, SERIF, PAL, catInfo, TYPE, TRACK, RADIUS } from "./constants";
import { fmt, fmtD, today, uid, addD, pctSpace } from "./formatters";
import { I, S, NumField, ConfirmDialog, PillBtn, Chip, ChipRow, Switch, Stepper, DetailLine, BottomBar, BOTTOM_BAR_SPACE } from "./atoms";
import {
  normalizeCards, pricingCats, cardChoices, cardAddons, priceLine, optLabel, optName, addonPriceText,
  BASE_CARD_KEYS, pctOn, volPct,
} from "./pricing";
import { quoteDraft } from "./quoteDraft";
import { sendQuestion } from "./docFlow";

interface CalcProps {
  isMobile:    boolean;
  settings:    any;
  rc:          any;
  prefill:     any;
  clearPrefill:() => void;
  clientsHook: any;
  onAfterSave: (projectId: string) => void;
}

const catTitle = (rc: any, key: string) =>
  BASE_CARD_KEYS.includes(key) ? catInfo(key).label : (rc?.[key]?.label || key);
const NEW_CLIENT = "__new";
const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Other"];
const DE_COUNTRY = /^(germany|deutschland|austria|österreich|oesterreich|switzerland|schweiz)$/i;
// the retainer discount of a rate card (Service Catalog), 20 % when not set
export const retainerPctOf = (card: any): number => {
  const v = Number(card?.retainerPct);
  return card?.retainerPct !== undefined && card?.retainerPct !== null && card?.retainerPct !== "" && Number.isFinite(v) && v >= 0 && v < 100 ? v : 20;
};
// language: the client's last document, otherwise their country (no client yet: English)
function clientLang(c: any): "en" | "de" {
  const docs = (c?.projects || []).flatMap((pr: any) => pr.documents || []).filter((d: any) => d.lang === "en" || d.lang === "de")
    .sort((a: any, b: any) => String(b.docDate || "").localeCompare(String(a.docDate || "")));
  if (docs[0]) return docs[0].lang;
  return c && DE_COUNTRY.test(String(c.country || "").trim()) ? "de" : "en";
}

type Own  = { usage: number; excl: number; platforms: string[] };
type Line = { id: string; cat: string; key?: string; qty: number; neg: number | null; vol: boolean; addons: { key: string; months: number }[]; own: Own | null; fixed?: any };
type Rights = { usage: any | null; excl: any | null; platforms: string[] };
const NO_RIGHTS: Rights = { usage: null, excl: null, platforms: [] };

const LBL: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase", color: C.muted, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, minHeight: 14 };
const MI: any  = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase", color: C.muted };
const CARD: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, padding: 12, marginTop: 10 };
const SMALL: any = { fontSize: TYPE.subtext.size, color: C.muted };
const linkBtn = (color: string): any => ({ background: "none", border: "none", padding: "0 2px", minHeight: 32, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color });

export default function Calculator({
  isMobile, settings, rc: rawRc, prefill, clearPrefill, clientsHook, onAfterSave,
}: CalcProps) {
  const rc      = useMemo(() => normalizeCards(rawRc), [rawRc]);
  const isRev   = prefill?.isRev   || false;
  const isAmend = prefill?.isAmend || false;
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

  // the quote that was being built before a tab switch (a new "+ Quote" for another client starts fresh)
  const draftKey = locked ? `${isRev ? "rev" : "amend"}:${prefill?.pid || ""}` : "new";
  const saved0 = useRef((() => {
    const st = quoteDraft.get(draftKey);
    if (!st) return null;
    if (!locked && (prefill?.cid || prefill?.brand) && st.clientSel !== initialClient) return null;
    return st;
  })()).current;

  const [clientSel, setClientSel] = useState<string>(saved0?.clientSel ?? initialClient);
  const [newName,   setNewName]   = useState<string>(saved0?.newName ?? (initialClient === NEW_CLIENT ? (prefill?.brand || "") : ""));
  const [contact,   setContact]   = useState<string>(saved0?.contact ?? (prefill?.contact || clientList.find((c: any) => c.id === initialClient)?.contact || ""));
  const [target,    setTarget]    = useState<string>(saved0?.target ?? (!locked && prefill?.pid ? prefill.pid : "new"));
  const [projName,  setProjName]  = useState<string>(saved0?.projName ?? (prefill?.projectName && isRev ? prefill.projectName : ""));
  const [qDate,     setQDate]     = useState<string>(saved0?.qDate ?? today());
  const [vDays,     setVDays]     = useState<number>(saved0?.vDays ?? (Number(prefill?.validDays) || 14));
  const [showDetails, setShowDetails] = useState(false);
  const [showOrig,  setShowOrig]  = useState(false);
  const [formErr,   setFormErr]   = useState<string | null>(null);
  const [info,      setInfo]      = useState<string | null>(null);
  const [askExit,   setAskExit]   = useState(false);

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
    setClientSel(v); setFormErr(null); setInfo(null);
    const c = clientList.find((x: any) => x.id === v);
    setContact(c ? (c.contact || "") : "");
    setTarget("new");
    if (!langSet.current) setLang(clientLang(c));
  };
  const openCount = (c: any) => (c.projects || []).filter((p: any) => !p.paid && ["lead", "quoted", "revised", "contracted", "production", "invoiced"].includes(p.status)).length;

  // ── Catalogue ─────────────────────────────────────────────
  const cats = pricingCats(rc);
  const [bCat, setBCat] = useState<string>(() => saved0?.bCat ?? ((prefill?.ctab && cats.includes(prefill.ctab) ? prefill.ctab : cats[0]) || "influencer"));
  const card    = rc[bCat] || rc[cats[0]] || { sections: [], usage: [], excl: [] };
  const choices = cardChoices(card);
  const tiles   = [...choices.filter(c => c.kind === "deliverable"), ...choices.filter(c => c.kind === "package")];

  // ── The quote ─────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>(() => saved0?.lines ?? (
    isRev && prefill?.origLines?.length
      ? prefill.origLines.map((ln: any) => {
          const cat = ln.cat || prefill.ctab || "influencer";
          return { id: uid(), cat, qty: Number(ln.qty) || 1, neg: null, vol: false, addons: [], own: null, fixed: { ...ln, cat } };
        })
      : []));
  const [rights,     setRights]     = useState<Rights>(() => saved0?.rights ?? NO_RIGHTS);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [openLine,   setOpenLine]   = useState<string | null>(null);
  const [retOn,      setRetOn]      = useState<boolean>(saved0?.retOn ?? (isRev ? !!prefill?.retainer : false));
  const [retMo,      setRetMo]      = useState<number>(saved0?.retMo ?? (isRev && prefill?.retMo ? Number(prefill.retMo) : 6));
  const [showDisc,   setShowDisc]   = useState<boolean>(saved0?.showDisc ?? false);
  const [pdf,        setPdf]        = useState<any>(null);

  useEffect(() => {
    quoteDraft.set(draftKey, { clientSel, newName, contact, target, projName, qDate, vDays, lang, langSet: langSet.current, bCat, lines, rights, retOn, retMo, showDisc });
  }, [draftKey, clientSel, newName, contact, target, projName, qDate, vDays, lang, bCat, lines, rights, retOn, retMo, showDisc]);

  // rights are chosen from the card of the quote's first editable line (or the open category)
  const rightsCat = lines.find(l => !l.fixed)?.cat || bCat;
  const rCard     = rc[rightsCat] || card;
  const idxIn = (list: any[], opt: any) => {
    if (!opt) return 0;
    const n = optName(opt.l).toLowerCase();
    const i = (list || []).findIndex((o: any) => !o.sentinel && optName(o.l).toLowerCase() === n);
    return i >= 0 ? i : 0;
  };

  // ── One line → the stored line (same fields as before; listAmt only when your rate is lower)
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
    const uPct = uOn ? (ln.own ? Number(uOpt.pct) || 0 : pctOn(rc, ln.cat, "usage", uOpt)) : 0;
    const ePct = eOn ? (ln.own ? Number(eOpt.pct) || 0 : pctOn(rc, ln.cat, "excl", eOpt)) : 0;
    const adds = ln.addons.map(a => ({ addon: addonList.find((x: any) => x.key === a.key), months: a.months })).filter(x => !!x.addon);
    const listUnit = Number(choice.item.p ?? 0) || 0;
    const args = { qty: Math.max(1, ln.qty), cat: ln.cat, vol: ln.vol, usagePct: uPct, exclPct: ePct, addons: adds };
    const calc = priceLine({ ...args, unit: ln.neg !== null ? Math.max(0, ln.neg) : listUnit });
    const list = ln.neg !== null ? priceLine({ ...args, unit: listUnit }) : null;
    return {
      id:          ln.id,
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
      usageLabel:  uOn ? optLabel({ ...uOpt, pct: uPct }) : undefined,
      usagePct:    uPct,
      usageMo:     uOn ? Number(uOpt.mo) || 0 : 0,
      exclLabel:   eOn ? optLabel({ ...eOpt, pct: ePct }) : undefined,
      exclPct:     ePct,
      exclMo:      eOn ? Number(eOpt.mo) || 0 : 0,
      addons:      calc.addons.map(a => a.months ? `${a.n} (${a.months} ${a.months === 1 ? "month" : "months"})` : a.n),
      addonDetail: calc.addons,
      platforms:   plats,
      amt:         calc.amt,
      ...(list && list.amt > calc.amt + 0.004 ? { listAmt: list.amt } : {}),
    };
  };
  const items = lines.map(itemOf).filter(Boolean) as any[];
  const subtotal = items.reduce((s, it) => s + (Number(it.amt) || 0), 0);
  const retPct   = retainerPctOf(rc[rightsCat] || card);
  const monthly  = retOn ? Math.round(subtotal * (1 - retPct / 100)) : subtotal;
  const totalAll = retOn ? monthly * retMo : subtotal;
  const validUntil = addD(qDate, vDays || 14) || qDate;
  const origLines: any[] = prefill?.origLines || [];
  const origTotal = Number(prefill?.origTotal) || origLines.reduce((s: number, l: any) => s + (Number(l.amt) || 0), 0);
  const discounted = items.filter(it => Number(it.listAmt) > Number(it.amt));

  const upd = (id: string, patch: Partial<Line>) => setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => { setLines(prev => prev.filter(l => l.id !== id)); setOpenLine(null); };
  const addTile = (ch: any) => {
    setFormErr(null);
    setLines(prev => {
      const i = prev.findIndex(l => !l.fixed && l.cat === bCat && l.key === ch.key && !l.own && l.neg === null && !l.addons.length && !l.vol);
      if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...prev, { id: uid(), cat: bCat, key: ch.key, qty: 1, neg: null, vol: false, addons: [], own: null }];
    });
  };
  const countOf = (key: string) => lines.filter(l => !l.fixed && l.cat === bCat && l.key === key).reduce((s, l) => s + l.qty, 0);

  // ── Start from the client's last quote (current catalogue prices) ──
  const lastQuote = useMemo(() => {
    if (locked || !selClient) return null;
    const qs = (selClient.projects || []).flatMap((pr: any) => (pr.documents || []).filter((d: any) => d.kind === "quote" && Array.isArray(d.data?.lines) && d.data.lines.length));
    qs.sort((a: any, b: any) => String(b.docDate || "").localeCompare(String(a.docDate || "")));
    return qs[0] || null;
  }, [selClient, locked]);
  const useLastQuote = () => {
    const q: any = lastQuote; if (!q) return;
    const got: Line[] = []; let miss = 0; let r: Rights | null = null;
    q.data.lines.forEach((ln: any) => {
      const cat = ln.cat && rc[ln.cat] ? ln.cat : bCat;
      const ch = cardChoices(rc[cat]).find(c => String(c.item.n || "").trim().toLowerCase() === String(ln.name || "").trim().toLowerCase());
      if (!ch) { miss++; return; }
      got.push({ id: uid(), cat, key: ch.key, qty: Number(ln.qty) || 1, neg: null, vol: false, addons: [], own: null });
      if (!r) {
        const cl = rc[cat];
        const u = ln.usageLabel ? (cl.usage || []).find((o: any) => !o.sentinel && optName(o.l).toLowerCase() === optName(ln.usageLabel).toLowerCase()) : null;
        const e = ln.exclLabel ? (cl.excl || []).find((o: any) => !o.sentinel && optName(o.l).toLowerCase() === optName(ln.exclLabel).toLowerCase()) : null;
        r = { usage: u || null, excl: e || null, platforms: Array.isArray(ln.platforms) ? ln.platforms : [] };
      }
    });
    if (got.length) { setLines(prev => [...prev, ...got]); if (r) setRights(r); }
    setInfo(`Copied ${got.length} of ${q.data.lines.length} items from ${q.docNo || "the last quote"} at today's prices${miss ? ` · ${miss} not in your catalogue` : ""}.`);
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
    // merge only lines that are identical in every pricing-relevant way
    const merged = new Map<string, any>();
    items.forEach(raw => {
      const { id: _id, ...it } = raw;
      const key = [
        it.cat, it.kind || "", it.name, it.up, it.usageLabel || "", it.exclLabel || "",
        [...(it.addons || [])].sort().join("|"), [...(it.platforms || [])].sort().join("|"),
      ].join("__");
      const ex = merged.get(key);
      if (ex) {
        ex.qty = (ex.qty || 1) + (it.qty || 1);
        ex.amt = (ex.amt || 0) + (it.amt || 0);
        if (typeof ex.listAmt === "number" || typeof it.listAmt === "number") ex.listAmt = (Number(ex.listAmt) || ex.amt - (it.amt || 0)) + (Number(it.listAmt) || it.amt || 0);
        if (typeof ex.base === "number" || typeof it.base === "number") ex.base = (Number(ex.base) || 0) + (Number(it.base) || 0);
        if (Array.isArray(ex.addonDetail) && Array.isArray(it.addonDetail)) {
          ex.addonDetail = ex.addonDetail.map((a: any) => {
            const b = it.addonDetail.find((x: any) => x.n === a.n);
            return b ? { ...a, amt: (Number(a.amt) || 0) + (Number(b.amt) || 0) } : a;
          });
        }
      } else merged.set(key, { ...it });
    });
    const lns = Array.from(merged.values());
    const disc = showDisc && discounted.length > 0 ? { showDiscount: true } : {};

    if (isAmend) {
      setPdf({
        kind: "amendment", docNo: "", revision: 0, status: "draft", docDate: qDate, lang,
        data: {
          brand: brandName, contact, ctype, ctab, lines: lns, footer: "",
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
        rev: isRev ? revN : 0, mo, ctab, lines: lns,
        total: monthly, ctype, footer: "",
        retainer: retOn, retMo: retOn ? retMo : undefined, retDisc: retOn ? retPct : undefined, ...disc,
      },
    });
  };

  const reset = () => {
    setLines([]); setRetOn(false); setFormErr(null); setInfo(null); setRights(NO_RIGHTS); setShowDisc(false); setOpenLine(null);
    setClientSel(clientList.length ? "" : NEW_CLIENT); setNewName(""); setContact(""); setProjName(""); setTarget("new");
    setQDate(today()); setVDays(14); langSet.current = false; setLang("en");
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
          quoteDraft.clear(draftKey);
          setLines([]); setRetOn(false); setRights(NO_RIGHTS); setShowDisc(false);
          if (clearPrefill) clearPrefill();
          return res.document;
        }}
        onPdf={pdfPrep}
        pdfConfirm={sendQuestion}
      />
    );
  }

  // ── Small pieces ──────────────────────────────────────────
  const lockSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  const lockedField = (v: string) => (
    <div style={{ height: 40, border: `1px solid ${PAL.neutral.fill}`, background: PAL.neutral.wash, borderRadius: RADIUS.field, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "0 10px", fontSize: TYPE.body.size, color: C.ink2 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{v || "—"}</span>{lockSvg}
    </div>
  );
  const chev = (up: boolean) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>;
  const rightsText = (u: any, e: any, plats: string[]) => [
    u && !u.sentinel ? optName(u.l) : "No usage rights",
    plats.length ? plats.join(", ") : null,
  ].filter(Boolean).join(" · ") + ` · ${e && !e.sentinel ? optName(e.l) : "no exclusivity"}`;
  const optSelect = (list: any[], idx: number, onPick: (i: number) => void, label: string, none: string) => (
    <S value={idx} aria-label={label} onChange={(e: any) => onPick(parseInt(e.target.value) || 0)}>
      {(list || []).map((o: any, i: number) => <option key={i} value={i}>{o.sentinel ? none : optLabel(o)}</option>)}
    </S>
  );
  const platformChips = (sel: string[], onSet: (p: string[]) => void) => (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 5 }}>
      {PLATFORMS.map(p => {
        const on = sel.includes(p);
        return <Chip key={p} on={on} tone={PAL.neutral} dot={false} label={p} onClick={() => onSet(on ? sel.filter(x => x !== p) : [...sel, p])} />;
      })}
    </div>
  );
  const title = isAmend ? `Amendment ${amendN}` : isRev ? `Revision ${revN}` : "New quote";
  const diff = totalAll - origTotal;

  return (
    <div style={{ fontFamily: SANS, color: C.black, maxWidth: isMobile ? undefined : 640, paddingBottom: `calc(${BOTTOM_BAR_SPACE}px + env(safe-area-inset-bottom, 0px))` }}>
      {askExit && (
        <ConfirmDialog title="Discard this quote?" text={`${lines.length ? `The ${lines.length} ${lines.length === 1 ? "item" : "items"} and the details are lost.` : "The details are lost."} Switching tabs keeps them.`}
          okLabel="Discard" danger onOk={doExit} onCancel={() => setAskExit(false)} />
      )}

      {/* ── TITLE ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.amount.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>{title}</h2>
        <PillBtn onClick={() => (hasWork ? setAskExit(true) : doExit())}>Exit</PillBtn>
      </div>

      {/* ── ① CLIENT & PROJECT ── */}
      <div style={CARD}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={LBL}>
              <span>{clientSel === NEW_CLIENT && !locked ? "New client" : "Client"}</span>
              {lastQuote && <button onClick={useLastQuote} style={{ ...linkBtn(PAL.progress.ink), minHeight: 30, margin: "-8px 0", fontSize: TYPE.label.size, padding: 0, letterSpacing: TRACK.none, textTransform: "none" as const }}>Last quote ›</button>}
            </div>
            {locked ? lockedField(brandName)
              : clientSel === NEW_CLIENT ? (
                <div style={{ position: "relative" }}>
                  <I value={newName} onChange={(e: any) => setNewName(e.target.value)} placeholder="Brand name" aria-label="New client name" s={{ paddingRight: 34 }} />
                  {clientList.length > 0 && (
                    <button onClick={() => { setClientSel(""); setNewName(""); }} aria-label="Back to the client list"
                      style={{ position: "absolute", right: 0, top: 0, width: 36, height: 40, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: TYPE.body.size }}>✕</button>
                  )}
                </div>
              ) : (
                <S value={clientSel} aria-label="Client" onChange={(e: any) => pickClient(e.target.value)}>
                  <option value="">Choose a client</option>
                  {clientList.map((c: any) => { const n = openCount(c); return <option key={c.id} value={c.id}>{c.name}{n ? ` · ${n} open` : ""}</option>; })}
                  <option value={NEW_CLIENT}>+ New client</option>
                </S>
              )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={LBL}><span>{locked ? "Project" : "Project name *"}</span>{leadSel && <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: RADIUS.tag, background: PAL.neutral.fill, color: PAL.neutral.ink, letterSpacing: TRACK.none, textTransform: "none" as const }}>lead</span>}</div>
            {locked ? lockedField(prefill?.projectName || "")
              : <I value={projName} onChange={(e: any) => setProjName(e.target.value)} placeholder="e.g. Spring launch" aria-label="Project name" />}
          </div>
        </div>
        {dupe && !locked && (
          <div style={{ fontSize: TYPE.subtext.size, color: PAL.waiting.ink, background: PAL.waiting.wash, borderRadius: RADIUS.tag, padding: "4px 9px", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>{dupe.name} already exists</span>
            <button onClick={() => { pickClient(dupe.id); setNewName(""); }} style={linkBtn(PAL.waiting.ink)}>use it ›</button>
          </div>
        )}
        {!locked && leads.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const, marginTop: 8 }}>
            <span style={SMALL}>Leads:</span>
            {leads.map((l: any) => (
              <Chip key={l.id} on={target === l.id} tone={PAL.neutral} dot={false} label={l.name}
                onClick={() => { if (target === l.id) { setTarget("new"); } else { setTarget(l.id); setProjName(l.name); } }} />
            ))}
          </div>
        )}
        <DetailLine onEdit={() => setShowDetails(o => !o)} s={{ marginTop: 6 }}>
          {[contact || "Add contact", lang.toUpperCase(), isAmend ? fmtD(qDate) : `valid until ${fmtD(validUntil)}`].join(" · ")}
        </DetailLine>
        {showDetails && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: 4 }}>
            <div style={{ gridColumn: "1 / -1" }}><div style={LBL}>Contact</div><I value={contact} onChange={(e: any) => setContact(e.target.value)} placeholder="Anna Müller" aria-label="Contact" /></div>
            <div><div style={LBL}>{isAmend ? "Date" : "Quote date"}</div><I type="date" value={qDate} onChange={(e: any) => setQDate(e.target.value || today())} aria-label="Quote date" /></div>
            {!isAmend && <div><div style={LBL}>Valid for (days)</div><I type="number" inputMode="numeric" value={vDays} onChange={(e: any) => setVDays(Math.max(1, parseInt(e.target.value) || 14))} aria-label="Valid for days" /></div>}
            <div style={{ gridColumn: "1 / -1" }}><div style={LBL}>Language</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["de", "en"] as const).map(l => <Chip key={l} on={lang === l} tone={PAL.neutral} dot={false} label={l === "de" ? "Deutsch" : "English"} onClick={() => { langSet.current = true; setLang(l); }} />)}
              </div>
            </div>
          </div>
        )}
        {locked && origLines.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setShowOrig(o => !o)} style={linkBtn(PAL.progress.ink)}>{isAmend ? "Contract" : "Original"} {fmt(origTotal)} {showOrig ? "▴" : "›"}</button>
          </div>
        )}
        {showOrig && (
          <div style={{ background: C.bg, borderRadius: RADIUS.field, padding: "4px 10px", marginTop: 4 }}>
            {origLines.map((ln: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: i ? `1px solid ${PAL.neutral.fill}` : "none", fontSize: TYPE.subtext.size }}>
                <span style={{ color: C.ink2 }}>{(Number(ln.qty) || 1) > 1 ? `${ln.qty}× ` : ""}{ln.name}</span><span>{fmt(Number(ln.amt) || 0)}</span>
              </div>
            ))}
          </div>
        )}
        {info && <div style={{ ...SMALL, color: PAL.progress.ink, marginTop: 6 }}>{info}</div>}
      </div>

      {/* ── ② CATALOGUE ── */}
      <div style={CARD}>
        <ChipRow>
          {cats.map(k => <Chip key={k} on={bCat === k} tone={PAL.neutral} dot={false} label={catTitle(rc, k)} onClick={() => setBCat(k)} />)}
        </ChipRow>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6, marginTop: 10 }}>
          {tiles.map(ch => {
            const n = countOf(ch.key);
            const price = ch.item.p !== null && ch.item.p !== undefined ? fmt(Number(ch.item.p) || 0) : ch.item.m ? pctSpace(ch.item.m) : "";
            return (
              <button key={ch.key} onClick={() => addTile(ch)} aria-label={`Add ${ch.item.n}`}
                style={{ background: C.bg, border: `1px solid ${PAL.neutral.fill}`, borderRadius: RADIUS.field, minHeight: 52, padding: "6px 8px 6px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" as const, fontFamily: SANS, color: C.black, minWidth: 0 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: TYPE.row.size, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{ch.kind === "package" ? "Package · " : ""}{ch.item.n}</span>
                  <span style={{ display: "block", fontSize: TYPE.subtext.size, color: C.muted, marginTop: 2 }}>{price}</span>
                </span>
                <span style={{ minWidth: 24, height: 24, borderRadius: RADIUS.tile, display: "flex", alignItems: "center", justifyContent: "center", fontSize: TYPE.subtext.size, flexShrink: 0,
                  ...(n ? { background: C.black, color: C.white } : { border: `1px solid ${C.edge}`, color: C.black }) }}>{n || "+"}</span>
              </button>
            );
          })}
        </div>
        {!tiles.length && <div style={{ ...SMALL, padding: "10px 2px" }}>No deliverables in this rate card yet — add them in the Service Catalog.</div>}
      </div>

      {/* ── ③ THE QUOTE ── */}
      <div style={{ ...CARD, padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 44 }}>
          <span style={MI}>{isAmend ? "Amendment" : "Quote"} · {items.length} {items.length === 1 ? "item" : "items"}</span>
          {!isAmend && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: TYPE.subtext.size, color: retOn ? C.black : C.muted }}>
              Retainer −{String(retPct).replace(".", ",")} %
              {retOn && (
                <select value={retMo} aria-label="Retainer months" onChange={(e: any) => setRetMo(parseInt(e.target.value) || 6)}
                  style={{ height: 32, border: `1px solid ${C.field}`, borderRadius: RADIUS.pill, background: C.white, fontFamily: SANS, fontSize: TYPE.field.size, padding: "0 8px", color: C.black }}>
                  {[2, 3, 4, 5, 6, 9, 12, 18, 24].map(m => <option key={m} value={m}>{m} mo</option>)}
                </select>
              )}
              <Switch on={retOn} onChange={setRetOn} label="Monthly retainer" />
            </span>
          )}
        </div>

        {lines.some(l => !l.fixed) && (
          <div style={{ background: C.bg, borderRadius: RADIUS.field, padding: "8px 10px", marginTop: 2 }}>
            {!rightsOpen ? (
              <div role="button" tabIndex={0} onClick={() => setRightsOpen(true)} onKeyDown={(e: any) => { if (e.key === "Enter") setRightsOpen(true); }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer", minHeight: 44 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={MI}>Rights · all items</div>
                  <div style={{ fontSize: TYPE.row.size, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{rightsText(rights.usage, rights.excl, rights.platforms)}</div>
                </div>
                <span style={SMALL}>Change</span>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 32 }}>
                  <span style={MI}>Rights · all items</span>
                  <PillBtn dark onClick={() => setRightsOpen(false)} s={{ height: 28, padding: "0 12px", fontSize: TYPE.subtext.size }}>Done</PillBtn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: 6 }}>
                  <div><div style={LBL}>Usage rights</div>{optSelect(rCard.usage, idxIn(rCard.usage, rights.usage), i => setRights(r => ({ ...r, usage: rCard.usage[i]?.sentinel ? null : rCard.usage[i] || null })), "Usage rights", "None")}</div>
                  <div><div style={LBL}>Exclusivity</div>{optSelect(rCard.excl, idxIn(rCard.excl, rights.excl), i => setRights(r => ({ ...r, excl: rCard.excl[i]?.sentinel ? null : rCard.excl[i] || null })), "Exclusivity", "None")}</div>
                </div>
                <div style={{ ...LBL, marginTop: 8, marginBottom: 0 }}>Platforms</div>
                {platformChips(rights.platforms, p => setRights(r => ({ ...r, platforms: p })))}
              </div>
            )}
          </div>
        )}

        {items.length === 0 && <div style={{ ...SMALL, textAlign: "center" as const, padding: "14px 0 10px" }}>Tap + on a deliverable to add it</div>}

        {items.map((it, i) => {
          const ln = lines.find(l => l.id === it.id)!;
          const open = openLine === it.id;
          const cardL = rc[ln.cat];
          const ch = !ln.fixed && cardL ? cardChoices(cardL).find(c => c.key === ln.key) : null;
          const adds = !ln.fixed && cardL ? cardAddons(cardL) : [];
          const meta = [
            `${it.qty} ×`,
            ln.fixed ? "from the original quote" : null,
            ln.neg !== null ? "your rate" : null,
            ln.own ? `own rights: ${optName(((cardL?.usage || [])[ln.own.usage] || {}).l) && !((cardL?.usage || [])[ln.own.usage] || {}).sentinel ? optName((cardL.usage || [])[ln.own.usage].l) : "none"}` : null,
            (it.addons || []).length ? `+${it.addons.length} add-on${it.addons.length === 1 ? "" : "s"}` : null,
          ].filter(Boolean).join(" · ");
          return (
            <div key={it.id} style={{ borderTop: i || lines.some(l => !l.fixed) ? `1px solid ${C.hair}` : "none" }}>
              <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpenLine(open ? null : it.id)} onKeyDown={(e: any) => { if (e.key === "Enter") setOpenLine(open ? null : it.id); }}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 50, padding: "8px 0", cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: TYPE.body.size, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                  <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
                </div>
                <div style={{ fontSize: TYPE.body.size, flexShrink: 0 }}>{fmt(Number(it.amt) || 0)}</div>
                {chev(open)}
              </div>
              {open && (
                <div style={{ background: C.bg, borderRadius: RADIUS.field, padding: "8px 10px 6px", marginBottom: 8 }}>
                  {ln.fixed ? (
                    <div style={{ ...SMALL, padding: "4px 0" }}>Kept as in the original quote. Remove it, or add the item again from the catalogue.</div>
                  ) : <>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
                      <div><div style={LBL}>Qty</div><Stepper value={ln.qty} onChange={v => upd(ln.id, { qty: v })} label={`${it.name} quantity`} /></div>
                      <div><div style={LBL}>Your rate</div><NumField value={ln.neg} onChange={v => upd(ln.id, { neg: v })} placeholder={fmt(Number(ch?.item.p ?? 0) || 0)} ariaLabel={`${it.name} your rate`} /></div>
                    </div>
                    {ln.neg !== null && <div style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 4, textAlign: "right" as const }}>Rate card {fmt((Number(it.listAmt) || Number(it.amt)) / Math.max(1, it.qty))} per item</div>}
                    {adds.length > 0 && <>
                      <div style={{ ...LBL, marginTop: 8, marginBottom: 0 }}>Add-ons</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginTop: 5 }}>
                        {adds.map((a: any) => {
                          const on = ln.addons.some(x => x.key === a.key);
                          return <Chip key={a.key} on={on} tone={PAL.neutral} dot={false} label={`${a.n} ${addonPriceText(a)}`.trim()}
                            onClick={() => {
                              if (on) upd(ln.id, { addons: ln.addons.filter(x => x.key !== a.key) });
                              else {
                                const u = ln.own ? (cardL.usage || [])[ln.own.usage] : rights.usage;
                                upd(ln.id, { addons: [...ln.addons, { key: a.key, months: a.perMonth ? Math.max(1, Number(u?.mo) || 1) : 1 }] });
                              }
                            }} />;
                        })}
                      </div>
                      {ln.addons.filter(x => adds.find((a: any) => a.key === x.key)?.perMonth).map(x => {
                        const a = adds.find((y: any) => y.key === x.key);
                        return (
                          <div key={x.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <span style={{ ...SMALL, color: C.ink2 }}>{a?.n} · months</span>
                            <Stepper value={x.months} onChange={v => upd(ln.id, { addons: ln.addons.map(y => (y.key === x.key ? { ...y, months: v } : y)) })} label={`${a?.n} months`} />
                          </div>
                        );
                      })}
                    </>}
                    {volPct(ln.cat, ln.qty, true) > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                        <Switch on={ln.vol} onChange={v => upd(ln.id, { vol: v })} label="Volume discount" />
                        <span style={{ fontSize: TYPE.subtext.size, color: C.ink2 }}>Volume discount −{String(volPct(ln.cat, ln.qty, true)).replace(".", ",")} %</span>
                      </div>
                    )}
                    {ln.own && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
                          <div><div style={LBL}>Own usage</div>{optSelect(cardL.usage, ln.own.usage, i2 => upd(ln.id, { own: { ...ln.own!, usage: i2 } }), "Own usage rights", "None")}</div>
                          <div><div style={LBL}>Own exclusivity</div>{optSelect(cardL.excl, ln.own.excl, i2 => upd(ln.id, { own: { ...ln.own!, excl: i2 } }), "Own exclusivity", "None")}</div>
                        </div>
                        {platformChips(ln.own.platforms, p => upd(ln.id, { own: { ...ln.own!, platforms: p } }))}
                      </div>
                    )}
                  </>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {!ln.fixed
                      ? (ln.own
                          ? <button onClick={() => upd(ln.id, { own: null })} style={linkBtn(PAL.progress.ink)}>Use the quote's rights</button>
                          : <button onClick={() => upd(ln.id, { own: { usage: idxIn(cardL.usage, rights.usage), excl: idxIn(cardL.excl, rights.excl), platforms: rights.platforms } })} style={linkBtn(PAL.progress.ink)}>Different rights for this item ›</button>)
                      : <span />}
                    <button onClick={() => removeLine(ln.id)} style={linkBtn(C.red)}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {discounted.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, borderTop: `1px solid ${C.hair}`, minHeight: 50 }}>
            <Switch on={showDisc} onChange={setShowDisc} label="Show discounts on the PDF" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: TYPE.row.size }}>Show discounts on the PDF</div>
              <div style={{ ...SMALL, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{discounted[0].name} {fmt(Number(discounted[0].listAmt))} → {fmt(Number(discounted[0].amt))}</div>
            </div>
          </div>
        )}
      </div>
      {formErr && formErr !== missing && <div style={{ fontSize: TYPE.subtext.size, color: PAL.late.ink, margin: "8px 4px 0" }}>{formErr}</div>}

      {/* ── BOTTOM BAR: total · what's missing · the one main button ── */}
      <BottomBar>
        <div style={{ minWidth: 0 }}>
          {missing ? <>
            <div style={MI}>Before the preview</div>
            <div style={{ fontSize: TYPE.row.size, color: PAL.waiting.ink, marginTop: 4 }}>{missing}</div>
          </> : isAmend ? <>
            <div style={MI}>Adds {fmt(subtotal)} · new total</div>
            <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, marginTop: 2 }}>{fmt(origTotal + subtotal)}</div>
          </> : <>
            <div style={MI}>
              {retOn ? `${fmt(monthly)} / month × ${retMo}` : `${items.length} ${items.length === 1 ? "item" : "items"} · `}
              {!retOn && (isRev ? <span style={{ color: PAL.progress.ink }}>{diff >= 0 ? "+" : "−"}{fmt(Math.abs(diff))} vs original</span> : "total")}
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
