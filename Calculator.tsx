// ─────────────────────────────────────────────────────────────
// Calculator — quote builder
// New quote, revision, amendment — all in one component.
// Every price comes from the rate cards (Service Catalog).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { C, SANS, SERIF, TYPE, catInfo, TINT } from "./constants";
import { fmt, today, uid, addD } from "./formatters";
import { I, S, B, Lbl, Tag, Pill, Tick, CatPill } from "./atoms";
import LineItemRow from "./LineItemRow";
import PriceSummary from "./PriceSummary";
import {
  normalizeCards, pricingCats, cardChoices, cardAddons, priceLine, optLabel, addonPriceText,
  pctText, BASE_CARD_KEYS,
} from "./pricing";

interface CalcProps {
  isMobile:    boolean;
  settings:    any;
  rc:          any;
  prefill:     any;
  clearPrefill:() => void;
  clientsHook: any;
  onAfterSave: (projectId: string) => void;
}

// Card name for pills and line labels
const catTitle = (rc: any, key: string) =>
  BASE_CARD_KEYS.includes(key) ? catInfo(key).label : (rc?.[key]?.label || key);

const NEW_CLIENT = "__new";

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
  const [clientSel, setClientSel] = useState<string>(initialClient);
  const [newName,   setNewName]   = useState(initialClient === NEW_CLIENT ? (prefill?.brand || "") : "");
  const [contact,   setContact]   = useState(prefill?.contact || "");
  const [target,    setTarget]    = useState<string>(!locked && prefill?.pid ? prefill.pid : "new");
  const [projName,  setProjName]  = useState(prefill?.projectName && isRev ? prefill.projectName : "");
  const [qDate,     setQDate]     = useState(today());
  const [vDays,     setVDays]     = useState<number | string>(prefill?.validDays || 14);
  const [formErr,   setFormErr]   = useState<string | null>(null);

  const selClient = clientList.find((c: any) => c.id === clientSel);
  const dupe = clientSel === NEW_CLIENT && newName.trim()
    ? clientList.find((c: any) => c.name.trim().toLowerCase() === newName.trim().toLowerCase())
    : null;
  const brandName = locked ? (prefill?.brand || selClient?.name || "") : selClient ? selClient.name : newName.trim();
  const leads = selClient ? (selClient.projects || []).filter((p: any) => p.status === "lead" && !p.qd) : [];
  const leadSel = leads.find((p: any) => p.id === target);

  const pickClient = (v: string) => {
    setClientSel(v);
    setFormErr(null);
    const c = clientList.find((x: any) => x.id === v);
    setContact(c ? (c.contact || "") : "");
    setTarget("new");
  };

  // ── Item builder state ────────────────────────────────────
  const cats = pricingCats(rc);
  const [bCat,       setBCat]       = useState(() => (prefill?.ctab && cats.includes(prefill.ctab) ? prefill.ctab : cats[0]) || "influencer");
  const [bSel,       setBSel]       = useState("");
  const [bQty,       setBQty]       = useState<number | string>(1);
  const [bUsage,     setBUsage]     = useState(0);
  const [bExcl,      setBExcl]      = useState(0);
  const [bNeg,       setBNeg]       = useState("");
  const [bVol,       setBVol]       = useState(false);
  const [bAddons,    setBAddons]    = useState<{ key: string; months: number }[]>([]);
  const [bPlatforms, setBPlatforms] = useState<string[]>([]);

  const card      = rc[bCat] || rc[cats[0]] || { sections: [], usage: [], excl: [] };
  const choices   = cardChoices(card);
  const delivs    = choices.filter(c => c.kind === "deliverable");
  const packs     = choices.filter(c => c.kind === "package");
  const choice    = choices.find(c => c.key === bSel);
  const addonList = cardAddons(card);
  const usageOpts = card.usage || [];
  const exclOpts  = card.excl  || [];

  const switchCat = (k: string) => {
    setBCat(k); setBSel(""); setBAddons([]); setBUsage(0); setBExcl(0); setBVol(false); setBNeg("");
  };

  // ── Line items ────────────────────────────────────────────
  const [items, setItems] = useState<any[]>(() =>
    isRev && prefill?.origLines?.length
      ? prefill.origLines.map((ln: any) => ({ ...ln, id: uid(), cat: ln.cat || prefill.ctab || "influencer" }))
      : []
  );
  const [retOn, setRetOn] = useState<boolean>(isRev ? !!prefill?.retainer : false);
  const [retMo, setRetMo] = useState<number>(isRev && prefill?.retMo ? Number(prefill.retMo) : 6);
  const [pdf,   setPdf]   = useState<any>(null);

  // ── Price of the line being built ─────────────────────────
  const usageSel = usageOpts[bUsage];
  const exclSel  = exclOpts[bExcl];
  const calc = choice
    ? priceLine({
        unit:     bNeg !== "" ? Math.max(0, parseFloat(bNeg) || 0) : (choice.item.p ?? 0),
        qty:      Math.max(1, parseInt(String(bQty)) || 1),
        cat:      bCat,
        vol:      bVol,
        usagePct: usageSel && !usageSel.sentinel ? Number(usageSel.pct) || 0 : 0,
        exclPct:  exclSel  && !exclSel.sentinel  ? Number(exclSel.pct)  || 0 : 0,
        addons:   bAddons
          .map(a => ({ addon: addonList.find((x: any) => x.key === a.key), months: a.months }))
          .filter(x => !!x.addon),
      })
    : null;

  const addAddon = (key: string) => {
    if (!key || bAddons.some(a => a.key === key)) return;
    const a = addonList.find((x: any) => x.key === key);
    const months = a?.perMonth ? Math.max(1, Number(usageSel?.mo) || 1) : 1;
    setBAddons(p => [...p, { key, months }]);
  };

  const addItem = () => {
    if (!choice || !calc) return;
    setItems(prev => [...prev, {
      id:          uid(),
      cat:         bCat,
      ...(BASE_CARD_KEYS.includes(bCat) ? {} : { catLabel: catTitle(rc, bCat) }),
      kind:        choice.kind,
      name:        choice.item.n || "",
      note:        choice.item.note || "",
      ...(choice.kind === "package" ? { includes: (choice.item.includes || []).filter((x: any) => x?.n).map((x: any) => ({ n: x.n, qty: Number(x.qty) || 1 })) } : {}),
      qty:         calc.qty,
      up:          calc.unit,
      listPrice:   choice.item.p ?? 0,
      base:        calc.base,
      volPct:      calc.volPct,
      usageLabel:  usageSel && !usageSel.sentinel ? optLabel(usageSel) : undefined,
      usagePct:    usageSel && !usageSel.sentinel ? Number(usageSel.pct) || 0 : 0,
      usageMo:     usageSel && !usageSel.sentinel ? Number(usageSel.mo) || 0 : 0,
      exclLabel:   exclSel && !exclSel.sentinel ? optLabel(exclSel) : undefined,
      exclPct:     exclSel && !exclSel.sentinel ? Number(exclSel.pct) || 0 : 0,
      exclMo:      exclSel && !exclSel.sentinel ? Number(exclSel.mo) || 0 : 0,
      addons:      calc.addons.map(a => a.months ? `${a.n} (${a.months} ${a.months === 1 ? "month" : "months"})` : a.n),
      addonDetail: calc.addons,
      platforms:   bPlatforms,
      amt:         calc.amt,
    }]);
    setBSel(""); setBQty(1); setBUsage(0); setBExcl(0); setBNeg("");
    setBAddons([]); setBVol(false); setBPlatforms([]);
  };

  const subtotal   = items.reduce((s, it) => s + (Number(it.amt) || 0), 0);
  const grand      = retOn ? Math.round(subtotal * 0.8) : subtotal;
  const validUntil = addD(qDate, parseInt(String(vDays)) || 14);
  const qNo        = isRev ? (prefill?.qNo || "") : "";

  // ── Open preview ──────────────────────────────────────────
  const openPreview = () => {
    if (!brandName) { setFormErr("Choose a client first (or ＋ New client with a name)."); return; }
    setFormErr(null);
    const catsUsed = [...new Set(items.map(it => it.cat))];
    const ctype = catsUsed.length > 1          ? "Content Creator"
      : catsUsed[0] === "ugc"                  ? "UGC Creator"
      : catsUsed[0] === "editorial"            ? "Editorial Content Creator"
      : catsUsed[0] === "hotels"               ? "Content Creator (Hospitality)"
      : catsUsed[0] && !BASE_CARD_KEYS.includes(catsUsed[0]) ? (rc[catsUsed[0]]?.label || "Content Creator")
      : "Content Creator (Influencer)";
    const ctab = catsUsed.length === 1 ? catsUsed[0] : (catsUsed.length > 1 ? "complete" : "influencer");

    // Usage period for the whole quote = the longest usage period of any line
    let mo: number | null = null;
    items.forEach(it => {
      let m = Number(it.usageMo) || 0;
      if (!m && it.usageLabel) { const x = String(it.usageLabel).match(/(\d+)\s*month/i); if (x) m = parseInt(x[1]); }
      if (m && (!mo || m > mo)) mo = m;
    });

    // Merge only lines that are identical in every pricing-relevant way
    const merged = new Map<string, any>();
    items.forEach(it => {
      const key = [
        it.cat, it.kind || "", it.name, it.up, it.usageLabel || "", it.exclLabel || "",
        [...(it.addons || [])].sort().join("|"), [...(it.platforms || [])].sort().join("|"),
      ].join("__");
      const ex = merged.get(key);
      if (ex) {
        ex.qty  = (ex.qty || 1) + (it.qty || 1);
        ex.amt  = (ex.amt || 0) + (it.amt || 0);
        if (typeof ex.base === "number" || typeof it.base === "number") ex.base = (Number(ex.base) || 0) + (Number(it.base) || 0);
        if (Array.isArray(ex.addonDetail) && Array.isArray(it.addonDetail)) {
          ex.addonDetail = ex.addonDetail.map((a: any) => {
            const b = it.addonDetail.find((x: any) => x.n === a.n);
            return b ? { ...a, amt: (Number(a.amt) || 0) + (Number(b.amt) || 0) } : a;
          });
        }
      } else merged.set(key, { ...it });
    });
    const lines = Array.from(merged.values());

    if (isAmend) {
      setPdf({
        kind: "amendment", docNo: "", revision: 0, status: "draft", docDate: qDate, lang: "en",
        data: {
          brand: brandName, contact, ctype, ctab, lines, footer: "",
          origTotal: Number(prefill?.origTotal) || 0, amendTotal: subtotal,
          contractNo: prefill?.contractNo || "", quoteNo: prefill?.qNo || "",
        },
      });
      return;
    }
    setPdf({
      kind: "quote", docNo: qNo, revision: isRev ? revN : 0, status: "draft", docDate: qDate, lang: "en",
      data: {
        brand: brandName, contact, date: qDate, validUntil, qNo,
        rev: isRev ? revN : 0, mo, ctab, lines,
        total: grand, ctype, footer: "",
        retainer: retOn, retMo: retOn ? retMo : undefined,
      },
    });
  };

  const reset = () => {
    setItems([]); setRetOn(false); setFormErr(null);
    setClientSel(clientList.length ? "" : NEW_CLIENT); setNewName(""); setContact(""); setProjName(""); setTarget("new");
    if (clearPrefill) clearPrefill();
  };

  // ── Lazy PDFModal ─────────────────────────────────────────
  const [PDFModal, setPDFModal] = useState<any>(null);
  const [saved,    setSaved]    = useState<{ clientId: string; projectId: string; docId: string } | null>(null);
  useEffect(() => {
    if (pdf && !PDFModal) {
      let cancelled = false;
      import("./PDFModal").then(m => {
        if (!cancelled) setPDFModal(() => m.default);
      });
      return () => { cancelled = true; };
    }
  }, [pdf, PDFModal]);

  if (pdf && PDFModal) {
    // After the first save the modal shows the saved document (with its number)
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
          note={sDoc.status === "draft" ? "Saved. You can still change this draft; Mark sent in the project locks it." : undefined}
          onSave={async (next: any) => { await clientsHook.updateDocument(saved!.clientId, saved!.projectId, sDoc.id, next, settings); }}
          onClose={() => { const pid = saved!.projectId; setPdf(null); setSaved(null); if (onAfterSave) onAfterSave(pid); }}
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
          const res = await clientsHook.saveQuote({
            doc, brand: brandName, contact: doc.data?.contact || contact,
            mode: isAmend ? "amend" : isRev ? "revise" : "new",
            projectName: projName || leadSel?.name || "",
            projectId: locked ? prefill?.pid : (leadSel ? leadSel.id : undefined),
            clientId:  locked ? prefill?.cid : (selClient?.id || dupe?.id),
            settings,
          });
          if (res.error) throw new Error(res.error);
          if (res.document) setSaved({ clientId: res.clientId, projectId: res.projectId, docId: res.document.id });
          setItems([]); setRetOn(false);
          if (clearPrefill) clearPrefill();
        }}
      />
    );
  }

  const usageText = (o: any) => optLabel(o);
  const choiceText = (c: any) => `${c.item.n}${c.item.p !== null && c.item.p !== undefined ? ` — € ${c.item.p}` : c.item.m ? ` — ${c.item.m}` : ""}`;

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 6px", color: C.black }}>Calculator</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>
          {isAmend ? "Amendment" : isRev ? "Revision" : "Build a Quote"}
        </p>
      </div>

      {/* ── MODE BANNER (revise / amend) ── */}
      {locked && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", marginBottom: 16, background: TINT.amber, border: `1px solid ${C.amber}`, borderRadius: 2 }}>
          <span style={{ fontSize: TYPE.label.size, color: C.amber }}>
            {isAmend ? `Amendment ${amendN} to ${prefill?.qNo || "the project"}` : `Revising ${prefill?.qNo || ""} · R${revN}`} · {brandName}
          </span>
          <B v="sec" onClick={reset} s={{ minHeight: 34, padding: "0 14px" }}>Exit</B>
        </div>
      )}

      {/* ── ORIGINAL LINES (amendment) ── */}
      {isAmend && prefill?.origLines?.length > 0 && (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "12px 14px", marginBottom: 16, background: C.white }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 9px" }}>Original Quote — read only</p>
          {prefill.origLines.map((ln: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
              <span style={{ fontSize: TYPE.micro.size, color: C.black, display: "flex", alignItems: "center", gap: 6 }}>
                {ln.qty > 1 ? `${ln.qty}× ` : ""}{ln.name}
                {ln.cat && <CatPill cat={ln.cat} label={ln.catLabel} />}
              </span>
              <span style={{ fontSize: TYPE.micro.size, fontFamily: SERIF, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{fmt(ln.amt)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 7, marginTop: 2 }}>
            <span style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Original Total</span>
            <span style={{ fontSize: TYPE.subtext.size, fontFamily: SERIF, color: C.black }}>{fmt(Number(prefill.origTotal) || prefill.origLines.reduce((s: number, l: any) => s + (l.amt || 0), 0))}</span>
          </div>
        </div>
      )}

      {/* ── CLIENT / CONTACT / PROJECT ── */}
      {!locked && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
            <div>
              <Lbl>Client</Lbl>
              <S value={clientSel} onChange={(e: any) => pickClient(e.target.value)}>
                <option value="">— Select client —</option>
                {clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value={NEW_CLIENT}>＋ New client</option>
              </S>
            </div>
            <div><Lbl>Contact Name</Lbl><I value={contact} onChange={(e: any) => setContact(e.target.value)} placeholder="Anna Müller" /></div>
          </div>
          {clientSel === NEW_CLIENT && (
            <div style={{ marginBottom: 9 }}>
              <Lbl>New client — Brand / Company</Lbl>
              <I value={newName} onChange={(e: any) => { setNewName(e.target.value); setFormErr(null); }} placeholder="Brand name" />
              {dupe && (
                <p style={{ fontSize: TYPE.label.size, color: C.amber, margin: "5px 0 0" }}>
                  "{dupe.name}" already exists — the quote will be added to that client.{" "}
                  <button onClick={() => pickClient(dupe.id)} style={{ background: "none", border: "none", padding: 0, color: C.amber, textDecoration: "underline", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size }}>Select it</button>
                </p>
              )}
            </div>
          )}
          {leads.length > 0 && (
            <div style={{ marginBottom: 9 }}>
              <Lbl>Project</Lbl>
              <S value={target} onChange={(e: any) => setTarget(e.target.value)}>
                <option value="new">New project</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>Lead: {l.name}</option>)}
              </S>
            </div>
          )}
          <div style={{ marginBottom: 9 }}>
            <Lbl>Project Name <span style={{ fontWeight: "normal", color: C.light }}>(optional)</span></Lbl>
            <I value={projName} onChange={(e: any) => setProjName(e.target.value)} placeholder={leadSel ? leadSel.name : "e.g. Spring Campaign 2026"} />
          </div>
        </>
      )}
      {locked && (
        <div style={{ marginBottom: 9 }}>
          <Lbl>Contact Name</Lbl>
          <I value={contact} onChange={(e: any) => setContact(e.target.value)} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 20 }}>
        <div>
          <Lbl>{isAmend ? "Amendment Date" : "Quote Date"}</Lbl>
          <I type="date" value={qDate} onChange={(e: any) => setQDate(e.target.value)} s={{ WebkitAppearance: "none" as const }} />
        </div>
        {!isAmend && (
          <div>
            <Lbl>Valid for (days)</Lbl>
            <I type="number" value={vDays} onChange={(e: any) => setVDays(e.target.value)} />
          </div>
        )}
      </div>

      {/* ── ITEM BUILDER ── */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "16px 18px", marginBottom: 16, background: C.white }}>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 13px" }}>Add Item</p>

        {/* Category tabs — one per rate card */}
        <div style={{ display: "flex", gap: 6, marginBottom: 13, flexWrap: "wrap" as const }}>
          {cats.map(k => (
            <Pill key={k} on={bCat === k} onClick={() => switchCat(k)}>{catTitle(rc, k)}</Pill>
          ))}
        </div>

        {/* Deliverable / package + Qty */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 9 }}>
          <div>
            <Lbl>Deliverable or package</Lbl>
            <S value={bSel} onChange={(e: any) => setBSel(e.target.value)}>
              <option value="">— Select —</option>
              {delivs.length > 0 && (
                <optgroup label="Deliverables">
                  {delivs.map(c => <option key={c.key} value={c.key}>{choiceText(c)}</option>)}
                </optgroup>
              )}
              {packs.length > 0 && (
                <optgroup label="Packages">
                  {packs.map(c => <option key={c.key} value={c.key}>{choiceText(c)}</option>)}
                </optgroup>
              )}
            </S>
            {choice?.kind === "package" && (
              <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "5px 0 0" }}>
                {choice.item.includes?.length
                  ? `Includes ${choice.item.includes.map((x: any) => `${x.qty || 1}× ${x.n}`).join(", ")}`
                  : "No contents set — the Workspace shows it as one item. Add contents in the Service Catalog."}
              </p>
            )}
          </div>
          <div>
            <Lbl>Qty</Lbl>
            <I type="number" min={1} value={bQty}
              onChange={(e: any) => setBQty(e.target.value === "" ? "" : (parseInt(e.target.value) || 1))}
              onBlur={(e: any) => setBQty(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Usage + Exclusivity (from this rate card) */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 9 }}>
          <div>
            <Lbl>Usage Rights</Lbl>
            <S value={bUsage} onChange={(e: any) => setBUsage(parseInt(e.target.value))}>
              {usageOpts.map((u: any, i: number) => <option key={i} value={i}>{usageText(u)}</option>)}
            </S>
            {/* Platform toggles */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginTop: 6 }}>
              {(["Instagram","TikTok","YouTube","Other"] as const).map(p => {
                const on = bPlatforms.includes(p);
                return (
                  <Pill key={p} on={on} onClick={() => setBPlatforms(pr => on ? pr.filter(x => x !== p) : [...pr, p])}>{p}</Pill>
                );
              })}
            </div>
          </div>
          <div>
            <Lbl>Exclusivity</Lbl>
            <S value={bExcl} onChange={(e: any) => setBExcl(parseInt(e.target.value))}>
              {exclOpts.map((e: any, i: number) => <option key={i} value={i}>{usageText(e)}</option>)}
            </S>
          </div>
        </div>

        {/* Add-ons (from this rate card) */}
        {addonList.length > 0 && (
          <div style={{ marginBottom: 9 }}>
            <Lbl>Add-ons</Lbl>
            <S value="" onChange={(e: any) => addAddon(e.target.value)} s={{ marginBottom: 5 }}>
              <option value="">— Select add-on —</option>
              {addonList.filter((a: any) => !bAddons.some(x => x.key === a.key)).map((a: any) => (
                <option key={a.key} value={a.key}>{a.n} {addonPriceText(a)}</option>
              ))}
            </S>
            {bAddons.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                {bAddons.map(sel => {
                  const a = addonList.find((x: any) => x.key === sel.key);
                  if (!a) return null;
                  return (
                    <span key={sel.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Tag onRemove={() => setBAddons(p => p.filter(x => x.key !== sel.key))}>{a.n}</Tag>
                      {a.perMonth && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: TYPE.label.size, color: C.muted }}>
                          <I type="number" min={1} value={sel.months} s={{ width: 56, height: 34, padding: "0 8px" }}
                            onChange={(e: any) => { const v = Math.max(1, parseInt(e.target.value) || 1); setBAddons(p => p.map(x => x.key === sel.key ? { ...x, months: v } : x)); }} />
                          months
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Negotiated rate + volume discount */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <Lbl>Negotiated Rate <span style={{ fontWeight: "normal", color: C.light }}>(per unit, overrides card)</span></Lbl>
            <I type="number" placeholder="€" value={bNeg} onChange={(e: any) => setBNeg(e.target.value)} />
          </div>
          <span style={{ paddingBottom: 10, whiteSpace: "nowrap" as const }}>
            <Tick on={bVol} onClick={() => setBVol(v => !v)} size={18} label="Vol. disc." />
          </span>
        </div>

        {/* Line total + Add button */}
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.rule}` }}>
          {calc && (
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 8px", lineHeight: 1.6 }}>
              Base {fmt(calc.base)}{calc.volPct ? ` (vol. −${pctText(calc.volPct)})` : ""}
              {calc.usagePct ? ` · usage +${pctText(calc.usagePct)}` : ""}
              {calc.exclPct ? ` · exclusivity +${pctText(calc.exclPct)}` : ""}
              {calc.addons.map(a => ` · ${a.n} ${fmt(a.amt)}`).join("")}
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: TYPE.label.size, color: C.muted }}>
              Line total: <strong style={{ color: calc ? C.black : C.light, fontFamily: SERIF, fontSize: TYPE.sectionHeading.size }}>{calc ? fmt(calc.amt) : "—"}</strong>
            </span>
            <B onClick={addItem} s={{ paddingLeft: 20, paddingRight: 20, opacity: calc ? 1 : 0.4, cursor: calc ? "pointer" : "default" as const }}>
              + Add to Quote
            </B>
          </div>
        </div>
      </div>

      {/* ── LINE ITEMS LIST ── */}
      {items.length > 0 ? (
        <>
          <div style={{ marginBottom: 12 }}>
            {items.map((it: any) => (
              <LineItemRow
                key={it.id}
                item={it}
                onRemove={() => setItems(p => p.filter((x: any) => x.id !== it.id))}
              />
            ))}
          </div>

          {!isAmend && (
            <PriceSummary
              subtotal={subtotal}
              grand={grand}
              retOn={retOn}
              retMo={retMo}
              onRetToggle={() => setRetOn(v => !v)}
              onRetMoChange={(n: number) => setRetMo(n)}
              onReset={reset}
              onPreview={openPreview}
              isRev={isRev}
            />
          )}
          {isAmend && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 16px", border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 14 }}>
              <span style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Amendment total</span>
              <span style={{ fontFamily: SERIF, fontSize: TYPE.amount.size }}>{fmt(subtotal)}</span>
            </div>
          )}
          {isAmend && <B onClick={openPreview} s={{ width: "100%" }}>Preview Amendment</B>}
          {formErr && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "10px 0 0" }}>{formErr}</p>}
        </>
      ) : (
        <div style={{ textAlign: "center" as const, padding: "36px 0", borderTop: `1px solid ${C.rule}` }}>
          <p style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.muted, margin: "0 0 4px", fontWeight: "normal" }}>No items yet</p>
          <p style={{ fontSize: TYPE.micro.size, color: C.light, margin: 0 }}>Configure an item above and click "+ Add to Quote"</p>
        </div>
      )}
    </div>
  );
}
