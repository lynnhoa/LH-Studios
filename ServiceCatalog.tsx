// ─────────────────────────────────────────────────────────────
// ServiceCatalog — internal pricing editor
// Influencer / UGC / Editorial tabs
// Edit mode: inline item name, note, price, modifier, delete
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { uid } from "./formatters";
import { I, B, Lbl, Pill } from "./atoms";

interface ServiceCatalogProps {
  rc:         any;
  upsertCard: (key: string, card: any) => Promise<string | null>;
  deleteCard: (key: string) => Promise<string | null>;
}

const CAT_TABS: [string, string][] = [
  ["influencer", "Brand Collaboration"],
  ["ugc",        "UGC"],
  ["editorial",  "Editorial"],
];

export default function ServiceCatalog({ rc, upsertCard, deleteCard }: ServiceCatalogProps) {
  const [tab,  setTab]  = useState("influencer");
  const [edit, setEdit] = useState(false);

  const card = rc[tab] || rc.influencer;

  const setCard = (fn: (c: any) => any) => {
    const updated = fn(card);
    upsertCard(tab, updated);
  };

  const upItem = (si: number, id: string, f: string, v: string) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) =>
        i !== si ? sc : {
          ...sc,
          items: sc.items.map((it: any) =>
            it.id !== id ? it : { ...it, [f]: f === "p" ? (v === "" ? null : parseFloat(v) || 0) : v }
          ),
        }
      ),
    }));

  const remItem = (si: number, id: string) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) =>
        i !== si ? sc : { ...sc, items: sc.items.filter((it: any) => it.id !== id) }
      ),
    }));

  const addItem = (si: number) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) =>
        i !== si ? sc : { ...sc, items: [...sc.items, { id: uid(), n: "New item", note: "", p: 0 }] }
      ),
    }));

  const upSecTitle = (si: number, v: string) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.map((sc: any, i: number) => i !== si ? sc : { ...sc, t: v }),
    }));

  const addSection = () =>
    setCard(prev => ({
      ...prev,
      sections: [...(prev.sections || []), { id: uid(), t: "New Section", items: [] }],
    }));

  const remSection = (si: number) =>
    setCard(prev => ({
      ...prev,
      sections: prev.sections.filter((_: any, i: number) => i !== si),
    }));

  const upFine = (v: string) => setCard(prev => ({ ...prev, fine: v }));

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px" }}>Service Catalog</h2>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: 0 }}>Single source of truth · Fashion · Beauty · Lifestyle</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {edit && <B v="sec" s={{ fontSize: TYPE.micro.size }} onClick={addSection}>+ Section</B>}
          <B v="sec" onClick={() => setEdit(e => !e)}>{edit ? "Done" : "Edit"}</B>
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" as const }}>
        {CAT_TABS.map(([k, label]) => (
          <Pill key={k} on={tab === k} onClick={() => setTab(k)}>{label}</Pill>
        ))}
      </div>

      {/* ── SECTIONS ── */}
      {(card.sections || []).map((sec: any, si: number) => (
        <div key={si} style={{ marginBottom: 14 }}>
          {/* Section title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
            {edit ? (
              <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
                <I value={sec.t} onChange={(e: any) => upSecTitle(si, e.target.value)} s={{ flex: 1, fontSize: TYPE.micro.size }} />
                <button onClick={() => remSection(si)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 13, padding: 0 }}>✕</button>
              </div>
            ) : (
              <span style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase" as const, border: `1px solid ${C.rule}`, padding: "3px 9px", borderRadius: 2 }}>{sec.t}</span>
            )}
            {edit && <B v="sec" onClick={() => addItem(si)} s={{ fontSize: TYPE.micro.size, marginLeft: 6 }}>+ Add</B>}
          </div>

          {/* Items */}
          {sec.items.map((it: any) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.rule}` }}>
              {edit ? (
                <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
                  <I value={it.n}    onChange={(e: any) => upItem(si, it.id, "n",    e.target.value)} s={{ flex: 1 }} />
                  <I value={it.note || ""} onChange={(e: any) => upItem(si, it.id, "note", e.target.value)} s={{ flex: 1 }} placeholder="note" />
                  <I type="number" value={it.p ?? ""} onChange={(e: any) => upItem(si, it.id, "p", e.target.value)} s={{ width: 60 }} placeholder="€" />
                  {it.m !== undefined && <I value={it.m || ""} onChange={(e: any) => upItem(si, it.id, "m", e.target.value)} s={{ width: 52 }} />}
                  <button onClick={() => remItem(si, it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, padding: 0 }}>✕</button>
                </div>
              ) : (
                <>
                  <div>
                    <p style={{ fontSize: TYPE.body.size, color: C.black, margin: "0 0 3px" }}>{it.n}</p>
                    {it.note && <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0 }}>{it.note}</p>}
                  </div>
                  <span style={{ fontFamily: SERIF, fontSize: TYPE.label.size, color: C.black, whiteSpace: "nowrap" as const, marginLeft: 12 }}>
                    {it.m && <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginRight: 5 }}>{it.m}</span>}
                    {it.p != null ? `€ ${it.p.toLocaleString("de-DE")}` : ""}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* ── FINE PRINT ── */}
      {edit ? (
        <div style={{ marginTop: 10 }}>
          <Lbl>Fine Print</Lbl>
          <textarea
            value={card.fine || ""}
            onChange={(e: any) => upFine(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: TYPE.micro.size, color: C.black, borderRadius: 2, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, minHeight: 64 }}
          />
        </div>
      ) : (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, lineHeight: 1.75, marginTop: 10 }}>{card.fine}</p>
      )}
    </div>
  );
}
