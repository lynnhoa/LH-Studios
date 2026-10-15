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

import { C, TYPE, TINT } from "./constants";
import { fmtD, today } from "./formatters";
import { getWsCategory, getCatProgress, wsLines, wsItemIds } from "./wsHelpers";
import { CatPill, Tick } from "./atoms";

const GREEN_BG     = TINT.green;
const GREEN_BORDER = C.green;

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
      const newWs   = { ...(pr.workspaceStatus || {}) };
      const newHist = { ...(pr.workspaceStatusHistory || {}) };
      wsLines(pr).forEach(w => {
        if (getWsCategory(w.line) !== cat) return;
        wsItemIds(w).forEach(id => {
          newWs[id] = "Delivered";
          newHist[id] = [...((pr.workspaceStatusHistory || {})[id] || []), { status: "Delivered", date: today() }];
        });
      });
      upP({ ...base, workspaceStatus: newWs, workspaceStatusHistory: newHist });
    } else {
      upP(base);
    }
  };

  // work lines (packages already expanded into their contents)
  const allLines = wsLines(pr).map(w => ({ ...w.line, name: w.name, qty: w.qty, _key: w.key }));

  const chkBox = (checked: boolean, color: string, readOnly: boolean, onClick: () => void) => (
    <Tick on={checked} color={color} size={isMobile ? 22 : 18} disabled={readOnly && !checked} onClick={!readOnly && !checked ? onClick : undefined} />
  );

  const col1W = isMobile ? 0 : 72;
  const col3W = isMobile ? 100 : 130;

  return (
    <div style={{ marginBottom: isMobile ? 12 : 8, border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? `1fr ${col3W}px` : `${col1W}px 1fr ${col3W}px`, background: "#f5f3f0", borderBottom: `1px solid ${C.rule}` }}>
        {!isMobile && <div style={{ padding: "4px 8px", fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Cat.</div>}
        <div style={{ padding: isMobile ? "5px 8px" : "4px 8px", fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, borderLeft: isMobile ? "none" : `1px solid ${C.rule}` }}>Deliverable · progress</div>
        <div style={{ padding: isMobile ? "5px 8px" : "4px 8px", fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, borderLeft: `1px solid ${C.rule}` }}>Manager</div>
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
        const catLines = allLines.filter((ln: any) => getWsCategory(ln) === cat);

        // per-line circle data
        const lineCircles = catLines.map((ln: any) => {
          const qty = parseInt(ln.qty) || 1;
          const filled = Array.from({ length: qty }, (_, q) => {
            const id = `${ln._key}_q${q}`;
            const st = (pr.workspaceStatus || {})[id] || "Not started";
            return ["Created","Reviewed","Delivered","Posted"].includes(st);
          });
          const postedAll = Array.from({ length: qty }, (_, q) => {
            const id = `${ln._key}_q${q}`;
            return (pr.workspaceStatus || {})[id] === "Posted";
          });
          const lastPostedDate = postedAll.every(Boolean) && postedAll.length > 0 ? (() => {
            let d = "";
            for (let q = 0; q < qty; q++) { const id = `${ln._key}_q${q}`; const sd = (pr.workspaceStatus || {})[id + "_date"]; if (sd && sd > d) d = sd; }
            return d;
          })() : null;
          return { ln, filled, qty, createdCount: filled.filter(Boolean).length, postedAll: postedAll.every(Boolean) && postedAll.length > 0, lastPostedDate };
        });

        return (
          <div key={cat} style={{ display: "grid", gridTemplateColumns: isMobile ? `1fr ${col3W}px` : `${col1W}px 1fr ${col3W}px`, borderBottom: ci < catKeys.length - 1 ? `1px solid ${C.rule}` : "none" }}>

            {/* col1 — category pill (desktop only; mobile shows pill inline per line) */}
            {!isMobile && <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8px 6px", borderRight: `1px solid ${C.rule}` }}>
              <CatPill cat={cat} />
            </div>}

            {/* col2 — per-line deliverables */}
            <div style={{ borderRight: `1px solid ${C.rule}`, padding: "0", display: "flex", flexDirection: "column" as const }}>
              {lineCircles.map(({ ln, filled, qty, createdCount }: any, lii: number) => (
                <div key={lii} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, padding: isMobile ? "8px 10px" : "6px 10px", borderTop: lii > 0 ? `1px solid ${C.rule}` : "none" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {isMobile && <span style={{ display: "inline-block", marginBottom: 3 }}><CatPill cat={getWsCategory(ln)} /></span>}
                    <p style={{ fontSize: isMobile ? TYPE.subtext.size : TYPE.label.size, color: C.black, margin: 0, fontWeight: "500", whiteSpace: "normal" as const, lineHeight: 1.3 }}>{ln.name}</p>
                    {ln.note && <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "2px 0 0" }}>{ln.note}</p>}
                  </div>
                  {isMobile ? (
                    <span style={{ fontSize: TYPE.label.size, fontWeight: "500", padding: "2px 8px", borderRadius: 20, background: createdCount === qty ? GREEN_BG : C.rule, color: createdCount === qty ? C.green : C.muted, border: `1px solid ${createdCount === qty ? GREEN_BORDER : C.light}`, whiteSpace: "nowrap" as const, flexShrink: 0, marginTop: 1 }}>{createdCount}/{qty}</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                      {filled.map((f: boolean, fi: number) => (
                        <div key={fi} style={{ width: 8, height: 8, borderRadius: "50%", background: f ? C.black : "transparent", border: `1.5px solid ${f ? C.black : C.light}`, flexShrink: 0 }} />
                      ))}
                      <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginLeft: 2, whiteSpace: "nowrap" as const }}>{createdCount}/{qty}</span>
                    </div>
                  )}
                </div>
              ))}
              {/* ready badge when all created */}
              {canAct && (
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "3px 10px 5px" }}>
                  <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 20, background: GREEN_BG, border: `1px solid ${GREEN_BORDER}`, color: C.green }}>ready</span>
                </div>
              )}
            </div>

            {/* col3 — manager checkboxes */}
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column" as const, justifyContent: "flex-start", gap: isMobile ? 7 : 5, opacity: canAct || msc.reviewed ? 1 : 0.3 }}>
              {/* reviewed */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {chkBox(!!msc.reviewed, C.amber, false, () => { if (canAct) setMs(cat, "reviewed"); })}
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: TYPE.label.size, color: msc.reviewed ? C.amber : C.muted, display: "block" }}>reviewed</span>
                  {msc.reviewed && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{fmtD(msc.reviewedDate)}</span>}
                </div>
              </div>
              {/* delivered — UGC + Editorial */}
              {!isInfluencer && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {chkBox(!!msc.delivered, C.green, false, () => { if (canAct) setMs(cat, "delivered"); })}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: TYPE.label.size, color: msc.delivered ? C.green : C.muted, display: "block" }}>delivered</span>
                    {msc.delivered && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{fmtD(msc.deliveredDate)}</span>}
                  </div>
                </div>
              )}
              {/* all posted — Influencer + Editorial, read-only, auto */}
              {(isInfluencer || isEditorial) && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: allPosted ? 1 : 0.4 }}>
                  {chkBox(allPosted, C.green, true, () => {})}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: TYPE.label.size, color: allPosted ? C.green : C.muted, display: "block" }}>
                      {allPosted ? "all posted" : "awaiting post"}
                    </span>
                    {allPosted && prog.posted > 0 && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{fmtD(lineCircles.find((lc: any) => lc.lastPostedDate)?.lastPostedDate || null)}</span>}
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
