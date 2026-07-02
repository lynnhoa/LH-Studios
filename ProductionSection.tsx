// ─────────────────────────────────────────────────────────────
// ProductionSection — per-category deliverable progress grid
// with manager checkboxes (reviewed / delivered / all posted).
// Verbatim port of old App.tsx lines 1796–1962.
// Rendered in ProjectsTab when project status === "production".
//
// upP(data) → clientsHook.updateProject(cl.id, pr.id, data)
// "delivered" cascades Delivered status into workspaceStatus for
// every matching line/qty (skip-list respected) — same as old.
// ─────────────────────────────────────────────────────────────

import { C } from "./constants";
import { fmtD, today } from "./formatters";
import { getWsCategory, getCatProgress } from "./wsHelpers";

// Old-app tint tokens (new constants.ts has no *Bg/*Border variants)
const GREEN_BG     = "#f0f5f0";
const GREEN_BORDER = C.green;
const AMBER        = C.amber;

interface ProductionSectionProps {
  pr:       any;
  clients:  any[];
  cl:       { id: string; name: string };
  upP:      (data: any) => void;
  isMobile: boolean;
}

export default function ProductionSection({ pr, clients, cl, upP, isMobile }: ProductionSectionProps) {
  const cats = getCatProgress(pr, clients);
  const catKeys = Object.keys(cats).filter(k => cats[k].total > 0);
  if (catKeys.length === 0) return null;
  const ms = pr.managerStatus || {};

  const setMs = (cat: string, field: string) => {
    const k = cat.toLowerCase();
    const base = { managerStatus: { ...ms, [k]: { ...(ms[k] || {}), [field]: true, [field + "Date"]: today() } } };
    if (field === "delivered") {
      const skipD = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
      const newWs   = { ...(pr.workspaceStatus || {}) };
      const newHist = { ...(pr.workspaceStatusHistory || {}) };
      (pr.qd?.lines || []).forEach((ln: any, li: number) => {
        if (!ln.name) return;
        if (skipD.some((s: string) => ln.name.toLowerCase().includes(s))) return;
        if (getWsCategory(ln.name) !== cat) return;
        const qty = parseInt(ln.qty) || 1;
        for (let q = 0; q < qty; q++) {
          const id = `${pr.id}_ln${li}_q${q}`;
          newWs[id] = "Delivered";
          newHist[id] = [...((pr.workspaceStatusHistory || {})[id] || []), { status: "Delivered", date: today() }];
        }
      });
      upP({ ...base, workspaceStatus: newWs, workspaceStatusHistory: newHist });
    } else {
      upP(base);
    }
  };

  const skip = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
  const allLines = (pr.qd?.lines || [])
    .map((ln: any, li: number) => ({ ...ln, _li: li }))
    .filter((ln: any) => ln.name && !skip.some((s: string) => ln.name.toLowerCase().includes(s)));

  const catPill = (cat: string): any => {
    if (cat === "UGC")       return { background: "#fdf5ee", border: `1px solid ${AMBER}`,       color: C.amber };
    if (cat === "Editorial") return { background: GREEN_BG,  border: `1px solid ${GREEN_BORDER}`, color: C.green };
    return { background: "#f0f0f5", border: "1px solid #c8c8e0", color: "#6a6aaa" };
  };

  const chkBox = (checked: boolean, color: string, readOnly: boolean, onClick: () => void) => (
    <div onClick={!readOnly && !checked ? onClick : undefined}
      style={{ width: isMobile ? 14 : 12, height: isMobile ? 14 : 12, borderRadius: 3, border: `1.5px solid ${checked ? color : C.rule}`, background: checked ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: !readOnly && !checked ? "pointer" : "default", opacity: readOnly ? 0.6 : 1 }}>
      {checked && <div style={{ width: isMobile ? 7 : 6, height: isMobile ? 5 : 4, borderLeft: `1.5px solid #fff`, borderBottom: `1.5px solid #fff`, transform: "rotate(-45deg) translateY(-1px)" }} />}
    </div>
  );

  const col1W = isMobile ? 0 : 72;
  const col3W = isMobile ? 100 : 130;

  return (
    <div style={{ marginBottom: isMobile ? 12 : 8, border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? `1fr ${col3W}px` : `${col1W}px 1fr ${col3W}px`, background: "#f5f3f0", borderBottom: `1px solid ${C.rule}` }}>
        {!isMobile && <div style={{ padding: "4px 8px", fontSize: 9, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Cat.</div>}
        <div style={{ padding: isMobile ? "5px 8px" : "4px 8px", fontSize: 9, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, borderLeft: isMobile ? "none" : `1px solid ${C.rule}` }}>Deliverable · progress</div>
        <div style={{ padding: isMobile ? "5px 8px" : "4px 8px", fontSize: 9, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, borderLeft: `1px solid ${C.rule}` }}>Manager</div>
      </div>

      {/* category blocks */}
      {catKeys.map((cat, ci) => {
        const prog = cats[cat];
        const k = cat.toLowerCase();
        const msc = ms[k] || {};
        const isInfluencer = cat === "Influencer";
        const isEditorial  = cat === "Editorial";
        const canAct = prog.allCreated;
        const allPosted = prog.total > 0 && prog.posted === prog.total;
        const catLines = allLines.filter((ln: any) => getWsCategory(ln.name) === cat);

        // per-line circle data
        const lineCircles = catLines.map((ln: any) => {
          const qty = parseInt(ln.qty) || 1;
          const filled = Array.from({ length: qty }, (_, q) => {
            const id = `${pr.id}_ln${ln._li}_q${q}`;
            const st = (pr.workspaceStatus || {})[id] || "Not started";
            return ["Created","Reviewed","Delivered","Posted"].includes(st);
          });
          const postedAll = Array.from({ length: qty }, (_, q) => {
            const id = `${pr.id}_ln${ln._li}_q${q}`;
            return (pr.workspaceStatus || {})[id] === "Posted";
          });
          const lastPostedDate = postedAll.every(Boolean) && postedAll.length > 0 ? (() => {
            let d = "";
            for (let q = 0; q < qty; q++) { const id = `${pr.id}_ln${ln._li}_q${q}`; const sd = (pr.workspaceStatus || {})[id + "_date"]; if (sd && sd > d) d = sd; }
            return d;
          })() : null;
          return { ln, filled, qty, createdCount: filled.filter(Boolean).length, postedAll: postedAll.every(Boolean) && postedAll.length > 0, lastPostedDate };
        });

        return (
          <div key={cat} style={{ display: "grid", gridTemplateColumns: isMobile ? `1fr ${col3W}px` : `${col1W}px 1fr ${col3W}px`, borderBottom: ci < catKeys.length - 1 ? `1px solid ${C.rule}` : "none" }}>

            {/* col1 — category pill (desktop only; mobile shows pill inline per line) */}
            {!isMobile && <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8px 6px", borderRight: `1px solid ${C.rule}` }}>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, ...catPill(cat) }}>{cat}</span>
            </div>}

            {/* col2 — per-line deliverables */}
            <div style={{ borderRight: `1px solid ${C.rule}`, padding: "0", display: "flex", flexDirection: "column" as const }}>
              {lineCircles.map(({ ln, filled, qty, createdCount }: any, lii: number) => (
                <div key={lii} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, padding: isMobile ? "8px 10px" : "6px 10px", borderTop: lii > 0 ? `1px solid ${C.rule}` : "none" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {isMobile && (() => { const cat2 = getWsCategory(ln.name); const pill = catPill(cat2); return <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, ...pill, display: "inline-block", marginBottom: 3 }}>{cat2}</span>; })()}
                    <p style={{ fontSize: isMobile ? 13 : 10, color: C.black, margin: 0, fontWeight: "500", whiteSpace: "normal" as const, lineHeight: 1.3 }}>{ln.name}</p>
                    {ln.note && <p style={{ fontSize: isMobile ? 11 : 9, color: C.muted, margin: "2px 0 0" }}>{ln.note}</p>}
                  </div>
                  {isMobile ? (
                    <span style={{ fontSize: 11, fontWeight: "500", padding: "2px 8px", borderRadius: 20, background: createdCount === qty ? GREEN_BG : C.rule, color: createdCount === qty ? C.green : C.muted, border: `1px solid ${createdCount === qty ? GREEN_BORDER : C.light}`, whiteSpace: "nowrap" as const, flexShrink: 0, marginTop: 1 }}>{createdCount}/{qty}</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                      {filled.map((f: boolean, fi: number) => (
                        <div key={fi} style={{ width: 8, height: 8, borderRadius: "50%", background: f ? C.black : "transparent", border: `1.5px solid ${f ? C.black : C.light}`, flexShrink: 0 }} />
                      ))}
                      <span style={{ fontSize: 9, color: C.muted, marginLeft: 2, whiteSpace: "nowrap" as const }}>{createdCount}/{qty}</span>
                    </div>
                  )}
                </div>
              ))}
              {/* ready badge when all created */}
              {canAct && (
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "3px 10px 5px" }}>
                  <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: GREEN_BG, border: `1px solid ${GREEN_BORDER}`, color: C.green }}>ready</span>
                </div>
              )}
            </div>

            {/* col3 — manager checkboxes */}
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column" as const, justifyContent: "flex-start", gap: isMobile ? 7 : 5, opacity: canAct || msc.reviewed ? 1 : 0.3 }}>
              {/* reviewed */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {chkBox(!!msc.reviewed, C.amber, false, () => { if (canAct) setMs(cat, "reviewed"); })}
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: isMobile ? 11 : 10, color: msc.reviewed ? C.amber : C.muted, display: "block" }}>reviewed</span>
                  {msc.reviewed && <span style={{ fontSize: 9, color: C.muted, display: "block" }}>{fmtD(msc.reviewedDate)}</span>}
                </div>
              </div>
              {/* delivered — UGC + Editorial */}
              {!isInfluencer && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {chkBox(!!msc.delivered, C.green, false, () => { if (canAct) setMs(cat, "delivered"); })}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: isMobile ? 11 : 10, color: msc.delivered ? C.green : C.muted, display: "block" }}>delivered</span>
                    {msc.delivered && <span style={{ fontSize: 9, color: C.muted, display: "block" }}>{fmtD(msc.deliveredDate)}</span>}
                  </div>
                </div>
              )}
              {/* all posted — Influencer + Editorial, read-only, auto */}
              {(isInfluencer || isEditorial) && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: allPosted ? 1 : 0.4 }}>
                  {chkBox(allPosted, C.green, true, () => {})}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: isMobile ? 11 : 10, color: allPosted ? C.green : C.muted, display: "block" }}>
                      {allPosted ? "all posted" : "awaiting post"}
                    </span>
                    {allPosted && prog.posted > 0 && <span style={{ fontSize: 9, color: C.muted, display: "block" }}>{fmtD(lineCircles.find((lc: any) => lc.lastPostedDate)?.lastPostedDate || null)}</span>}
                  </div>
                </div>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}
