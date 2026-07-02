// ─────────────────────────────────────────────────────────────
// Calculator — quote builder
// New quote, revision, amendment — all in one component
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, today, uid } from "./formatters";
import { isSingle } from "./formatters";
import { I, S, B, Lbl, Tag, Pill } from "./atoms";
import LineItemRow from "./LineItemRow";
import PriceSummary from "./PriceSummary";

// ── Add-ons per category ──────────────────────────────────────
const AO: Record<string, any[]> = {
  influencer: [
    { id: "ao_i1", n: "Additional Story frame",   flat: 50  },
    { id: "ao_i2", n: "Link in bio",              flat: 100 },
    { id: "ao_i3", n: "Whitelisting / boosting",  pct:  30  },
    { id: "ao_i4", n: "Rush delivery",            pct:  25  },
    { id: "ao_i5", n: "Pinned post",              flat: 100 },
    { id: "ao_i6", n: "Additional revision",      flat: 50  },
    { id: "ao_i7", n: "Aspect ratio adaptation",  flat: 65  },
    { id: "ao_i8", n: "Raw footage",              pct:  30  },
    { id: "ao_i9", n: "Kill fee",                 pct:  50  },
  ],
  ugc: [
    { id: "ao_u1", n: "Hook / CTA variation",     flat: 80  },
    { id: "ao_u2", n: "Whitelisting / boosting",  pct:  30  },
    { id: "ao_u3", n: "Rush delivery",            pct:  25  },
    { id: "ao_u4", n: "Additional revision",      flat: 80  },
    { id: "ao_u5", n: "Aspect ratio adaptation",  flat: 65  },
    { id: "ao_u6", n: "Raw footage",              pct:  30  },
    { id: "ao_u7", n: "Kill fee",                 pct:  50  },
    { id: "ao_u8", n: "Pinned post",              flat: 100 },
  ],
  editorial: [
    { id: "ao_e1", n: "Additional image",         flat: 200 },
    { id: "ao_e2", n: "Additional video cut",     flat: 300 },
    { id: "ao_e3", n: "Whitelisting / boosting",  flat: 300 },
    { id: "ao_e4", n: "Rush delivery",            pct:  30  },
    { id: "ao_e5", n: "Additional revision",      flat: 150 },
    { id: "ao_e6", n: "Aspect ratio adaptation",  flat: 65  },
    { id: "ao_e7", n: "Raw footage",              pct:  30  },
    { id: "ao_e8", n: "Kill fee",                 pct:  50  },
  ],
};
AO.complete = [...AO.influencer, ...AO.ugc, ...AO.editorial]
  .filter((a, i, ar) => ar.findIndex((b: any) => b.id === a.id) === i);
AO.hotels = AO.complete;

const CAT_LABEL: Record<string, string> = {
  influencer: "Brand Collaboration",
  ugc:        "UGC Creator",
  editorial:  "Editorial",
};

interface CalcProps {
  isMobile:    boolean;
  settings:    any;
  rc:          any;
  prefill:     any;
  clearPrefill:() => void;
  saveQuote:   (doc: any, brand: string, contact: string, isRev: boolean, revN: number, projName?: string, isAmend?: boolean, amendN?: number, origQNo?: string) => Promise<string | null>;
  onAfterSave: (brand: string, qNo?: string) => void;
}

export default function Calculator({
  isMobile, settings, rc, prefill, clearPrefill, saveQuote, onAfterSave,
}: CalcProps) {
  const isRev   = prefill?.isRev   || false;
  const isAmend = prefill?.isAmend || false;
  const revN    = prefill?.revN    || 1;
  const amendN  = prefill?.amendN  || 1;

  const [brand,    setBrand]    = useState(prefill?.brand   || "");
  const [contact,  setContact]  = useState(prefill?.contact || "");
  const [projName, setProjName] = useState("");
  const [qDate,    setQDate]    = useState(today());
  const [vDays,    setVDays]    = useState(14);

  // ── Item builder state ────────────────────────────────────
  const [bCat,       setBCat]       = useState("influencer");
  const [bDel,       setBDel]       = useState(-1);
  const [bQty,       setBQty]       = useState<number | string>(1);
  const [bUsage,     setBUsage]     = useState(0);
  const [bExcl,      setBExcl]      = useState(0);
  const [bNeg,       setBNeg]       = useState("");
  const [bVol,       setBVol]       = useState(false);
  const [bAddons,    setBAddons]    = useState<string[]>([]);
  const [bAoSel,     setBaAoSel]    = useState("");
  const [bPlatforms, setBPlatforms] = useState<string[]>([]);

  // ── Line items ────────────────────────────────────────────
  const [items, setItems] = useState<any[]>(() => {
    if (prefill?.isRev && prefill?.origLines?.length) {
      return prefill.origLines.map((ln: any) => ({
        id: uid(), cat: ln.cat || prefill.ctab || "influencer",
        name: ln.name || "", note: ln.note || "",
        qty: ln.qty || 1, up: ln.up || 0, amt: ln.amt || 0,
        usageLabel: undefined, exclLabel: undefined, addons: [],
      }));
    }
    return [];
  });

  const [retOn, setRetOn] = useState(false);
  const [retMo, setRetMo] = useState(6);
  const [pdf,   setPdf]   = useState<any>(null);

  const card        = rc[bCat] || rc.influencer;
  const deliverables = card.sections
    .filter((s: any) => isSingle(s.t))
    .flatMap((s: any) => s.items);
  const addonList = AO[bCat] || [];

  // ── Price computation ─────────────────────────────────────
  const computePrice = () => {
    const item    = bDel >= 0 ? deliverables[bDel] : null;
    const bQtyN   = parseInt(String(bQty)) || 1;
    const base    = bNeg !== "" ? parseFloat(bNeg) || 0 : (item?.p || 0);
    const lb      = base * (bQtyN || 1);
    let vp = 0;
    if (bVol) {
      if (bCat === "editorial") vp = 10;
      else if (bQtyN >= 10)    vp = 20;
      else if (bQtyN >= 3)     vp = 15;
    }
    const av       = lb * (1 - vp / 100);
    const usagePct = card.usage[bUsage]?.sentinel ? 0 : (card.usage[bUsage]?.pct || 0);
    const exclPct  = card.excl[bExcl]?.sentinel   ? 0 : (card.excl[bExcl]?.pct  || 0);
    const am       = av * (1 + (usagePct + exclPct) / 100);
    let at = 0;
    bAddons.forEach(aid => {
      const a = addonList.find((x: any) => x.id === aid);
      if (!a) return;
      if (a.flat) at += a.flat;
      else if (a.pct) at += am * a.pct / 100;
    });
    return Math.round(am + at);
  };

  const canAdd = bDel >= 0;

  const addItem = () => {
    if (!canAdd) return;
    const item     = deliverables[bDel];
    const price    = computePrice();
    const usageSel = card.usage[bUsage];
    const exclSel  = card.excl[bExcl];
    setItems(prev => [...prev, {
      id:         uid(),
      cat:        bCat,
      name:       item?.n || "",
      note:       item?.note || "",
      qty:        parseInt(String(bQty)) || 1,
      up:         item?.p || parseFloat(bNeg) || 0,
      amt:        price,
      usageLabel: usageSel?.sentinel ? undefined : usageSel?.l,
      exclLabel:  exclSel?.sentinel  ? undefined : exclSel?.l,
      addons:     bAddons.map(aid => addonList.find((x: any) => x.id === aid)?.n).filter(Boolean),
      platforms:  bPlatforms,
    }]);
    setBDel(-1); setBQty(1); setBUsage(0); setBExcl(0); setBNeg("");
    setBAddons([]); setBVol(false); setBPlatforms([]);
  };

  const subtotal = items.reduce((s, it) => s + it.amt, 0);
  const grand    = Math.round(subtotal * (1 - (retOn ? 20 : 0) / 100));
  const vu       = new Date(qDate);
  vu.setDate(vu.getDate() + (parseInt(String(vDays)) || 14));
  const validUntil = vu.toISOString().split("T")[0];
  const qNo = isAmend
    ? `AMD-${(prefill?.qNo || "").replace(/QUO-?/i,"").trim() || new Date().getFullYear()}-${String(amendN).padStart(2,"0")}`
    : isRev
      ? (prefill?.qNo || `QUO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`)
      : `QUO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

  // ── Open preview ──────────────────────────────────────────
  const openPreview = () => {
    const cats  = [...new Set(items.map(it => it.cat))];
    const ctype = cats.length > 1       ? "Content Creator"
      : cats[0] === "ugc"               ? "UGC Creator"
      : cats[0] === "editorial"         ? "Editorial Content Creator"
      : "Content Creator (Influencer)";
    const ctab = cats.length === 1 ? cats[0] : (cats.length > 1 ? "complete" : "influencer");

    const usageItem = items.find(it => it.usageLabel);
    let mo: number | null = null;
    if (usageItem?.usageLabel) {
      const cardKey = usageItem.cat || ctab;
      const cardRef = (rc && rc[cardKey]) || Object.values(rc || {})[0] || { usage: [] };
      const found   = (cardRef.usage || []).find((u: any) => u.l === usageItem.usageLabel);
      if (found && found.mo) mo = found.mo;
      else { const m = usageItem.usageLabel.match(/(\d+)\s*month/i); if (m) mo = parseInt(m[1]); }
    }

    // Merge same name+cat items
    const mergedMap = new Map<string, any>();
    items.forEach(it => {
      const key = `${it.cat}__${it.name}`;
      if (mergedMap.has(key)) {
        const ex = mergedMap.get(key);
        ex.qty = (ex.qty || 1) + (it.qty || 1);
        ex.amt = (ex.amt || 0) + (it.amt || 0);
      } else {
        mergedMap.set(key, { ...it });
      }
    });

    setPdf({
      brand, contact, date: qDate, validUntil, qNo,
      rev: isRev ? revN : 0, mo, ctab,
      lines: Array.from(mergedMap.values()),
      total: grand, ctype,
      footer: "Looking forward to working together.",
      retainer: retOn, retMo: retOn ? retMo : undefined,
    });
  };

  const reset = () => {
    setItems([]); setBrand(""); setContact(""); setProjName(""); setRetOn(false);
    if (clearPrefill) clearPrefill();
  };

  // ── Lazy PDFModal ─────────────────────────────────────────
  const [PDFModal, setPDFModal] = useState<any>(null);
  if (pdf && !PDFModal) {
    import("./PDFModal").then(m => setPDFModal(() => m.default));
  }

  if (pdf && PDFModal) {
    return (
      <PDFModal
        data={pdf}
        type={isRev ? "revised" : isAmend ? "amendment" : "quote"}
        onClose={() => setPdf(null)}
        settings={settings}
        isNew={true}
        onSave={async (doc: any) => {
          await saveQuote(
            { ...doc, id: uid(), status: isAmend ? "production" : "quoted" },
            doc.brand, doc.contact, isRev, revN, projName, isAmend, amendN,
            prefill?.qNo,
          );
          if (onAfterSave) onAfterSave(doc.brand || brand, isAmend ? null : doc.qNo);
        }}
      />
    );
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 6px", color: C.black }}>Calculator</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>
          {isAmend ? `Amendment ${amendN} — ${prefill?.qNo || ""}` : isRev ? `Revising ${prefill?.qNo} — R${revN}` : "Build a Quote"}
        </p>
      </div>

      {/* ── ORIGINAL LINES (amendment) ── */}
      {isAmend && prefill?.origLines?.length > 0 && (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "12px 14px", marginBottom: 16, background: C.white }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 9px" }}>Original Quote — read only</p>
          {prefill.origLines.map((ln: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
              <span style={{ fontSize: TYPE.micro.size, color: C.black, display: "flex", alignItems: "center", gap: 6 }}>
                {ln.qty > 1 ? `${ln.qty}× ` : ""}{ln.name}
                {ln.cat && <span style={{ fontSize: 8, color: C.white, background: ln.cat === "ugc" ? C.amber : ln.cat === "editorial" ? "#8fa89a" : C.muted, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.05em" }}>{({ influencer: "Influencer", ugc: "UGC", editorial: "Editorial" } as Record<string,string>)[ln.cat] || ln.cat}</span>}
              </span>
              <span style={{ fontSize: TYPE.micro.size, fontFamily: SERIF, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{fmt(ln.amt)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 7, marginTop: 2 }}>
            <span style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Original Total</span>
            <span style={{ fontSize: TYPE.subtext.size, fontFamily: SERIF, color: C.black }}>{fmt(prefill.origLines.reduce((s: number, l: any) => s + (l.amt || 0), 0))}</span>
          </div>
        </div>
      )}

      {/* ── BRAND / CONTACT / DATE ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Brand / Company</Lbl><I value={brand} onChange={(e: any) => setBrand(e.target.value)} placeholder="Sephora" /></div>
        <div><Lbl>Contact Name</Lbl><I value={contact} onChange={(e: any) => setContact(e.target.value)} placeholder="Anna Müller" /></div>
      </div>
      <div style={{ marginBottom: 9 }}>
        <Lbl>Project Name <span style={{ fontWeight: "normal", color: C.light }}>(optional)</span></Lbl>
        <I value={projName} onChange={(e: any) => setProjName(e.target.value)} placeholder="e.g. Spring Campaign 2026" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 20 }}>
        <div>
          <Lbl>Quote Date</Lbl>
          <I type="date" value={qDate} onChange={(e: any) => setQDate(e.target.value)} s={{ WebkitAppearance: "none" as const }} />
        </div>
        <div>
          <Lbl>Valid for (days)</Lbl>
          <I type="number" value={vDays} onChange={(e: any) => setVDays(e.target.value)} />
        </div>
      </div>

      {/* ── ITEM BUILDER ── */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "16px 18px", marginBottom: 16, background: C.white }}>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 13px" }}>Add Item</p>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 13, flexWrap: "wrap" as const }}>
          {(["influencer","ugc","editorial"] as const).map(k => (
            <Pill key={k} on={bCat === k} onClick={() => { setBCat(k); setBDel(-1); setBAddons([]); }}>
              {CAT_LABEL[k]}
            </Pill>
          ))}
        </div>

        {/* Deliverable + Qty */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 9 }}>
          <div>
            <Lbl>Deliverable</Lbl>
            <S value={bDel} onChange={(e: any) => setBDel(parseInt(e.target.value))}>
              <option value={-1}>— Select deliverable —</option>
              {deliverables.map((it: any, i: number) => (
                <option key={i} value={i}>{it.n}{it.p ? ` — € ${it.p}` : ""}</option>
              ))}
            </S>
          </div>
          <div>
            <Lbl>Qty</Lbl>
            <I type="number" min={1} value={bQty}
              onChange={(e: any) => setBQty(e.target.value === "" ? "" : (parseInt(e.target.value) || 1))}
              onBlur={(e: any) => setBQty(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Usage + Exclusivity */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 9 }}>
          <div>
            <Lbl>Usage Rights</Lbl>
            <S value={bUsage} onChange={(e: any) => setBUsage(parseInt(e.target.value))}>
              {card.usage.map((u: any, i: number) => <option key={i} value={i}>{u.l}</option>)}
            </S>
            {/* Platform toggles */}
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" as const, marginTop: 5 }}>
              {(["Instagram","TikTok","YouTube","Other"] as const).map(p => {
                const on = bPlatforms.includes(p);
                return (
                  <button key={p} type="button"
                    onClick={() => setBPlatforms(pr => on ? pr.filter(x => x !== p) : [...pr, p])}
                    style={{ padding: "3px 8px", border: `1px solid ${on ? C.black : C.rule}`, background: on ? C.black : C.bg, color: on ? C.white : C.muted, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.05em", borderRadius: 2 }}
                  >{p}</button>
                );
              })}
            </div>
          </div>
          <div>
            <Lbl>Exclusivity</Lbl>
            <S value={bExcl} onChange={(e: any) => setBExcl(parseInt(e.target.value))}>
              {card.excl.map((e: any, i: number) => <option key={i} value={i}>{e.l}</option>)}
            </S>
          </div>
        </div>

        {/* Add-ons */}
        <div style={{ marginBottom: 9 }}>
          <Lbl>Add-ons</Lbl>
          <S value={bAoSel} onChange={(e: any) => { const v = e.target.value; if (v && !bAddons.includes(v)) setBAddons(p => [...p, v]); setBaAoSel(""); }} s={{ marginBottom: 5 }}>
            <option value="">— Select add-on —</option>
            {addonList.filter((a: any) => !bAddons.includes(a.id)).map((a: any) => (
              <option key={a.id} value={a.id}>{a.n}{a.flat ? ` +€${a.flat}` : a.pct ? ` +${a.pct}%` : ""}</option>
            ))}
          </S>
          {bAddons.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
              {bAddons.map(aid => {
                const a = addonList.find((x: any) => x.id === aid);
                if (!a) return null;
                return <Tag key={aid} onRemove={() => setBAddons(p => p.filter(x => x !== aid))}>{a.n}</Tag>;
              })}
            </div>
          )}
        </div>

        {/* Negotiated rate + volume discount */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <Lbl>Negotiated Rate <span style={{ fontWeight: "normal", color: C.light }}>(overrides card)</span></Lbl>
            <I type="number" placeholder="€" value={bNeg} onChange={(e: any) => setBNeg(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: TYPE.micro.size, cursor: "pointer", paddingBottom: 8, whiteSpace: "nowrap" as const }}>
            <input type="checkbox" checked={bVol} onChange={(e: any) => setBVol(e.target.checked)} />
            Vol. disc.
          </label>
        </div>

        {/* Line total + Add button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.rule}` }}>
          <span style={{ fontSize: TYPE.label.size, color: C.muted }}>
            Line total: <strong style={{ color: canAdd ? C.black : C.light, fontFamily: SERIF, fontSize: TYPE.sectionHeading.size }}>{canAdd ? fmt(computePrice()) : "—"}</strong>
          </span>
          <B onClick={addItem} s={{ paddingLeft: 20, paddingRight: 20, opacity: canAdd ? 1 : 0.4, cursor: canAdd ? "pointer" : "default" as const }}>
            + Add to Quote
          </B>
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
