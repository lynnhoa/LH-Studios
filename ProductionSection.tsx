// ─────────────────────────────────────────────────────────────
// ProductionSection — Manager view of a project's production.
// Uses the SAME items and done rule as the Creator Workspace:
//   Brand Collab is done when posted; UGC + Editorial when delivered.
// Manager ticks per category:
//   reviewed  — a note for the category (can be unticked)
//   delivered — UGC / Editorial: marks the category's items Delivered
//               (never turns Posted back into Delivered); unticking
//               undoes exactly the items this tick changed.
//   all posted / all delivered — automatic, read only, with its date.
// ─────────────────────────────────────────────────────────────

import { C, TYPE, TINT } from "./constants";
import { fmtD, today } from "./formatters";
import { getCatProgress, projectItems, statusRank, doneWord } from "./wsHelpers";
import { CatPill, Tick } from "./atoms";

interface ProductionSectionProps {
  pr:           any;
  clients:      any[];
  cl:           { id: string; name: string };
  upP:          (data: any) => void;
  isMobile:     boolean;
  clientsHook?: any;
}

export default function ProductionSection({ pr, cl, upP, isMobile, clientsHook }: ProductionSectionProps) {
  const cats    = getCatProgress(pr);
  const catKeys = Object.keys(cats).filter(k => cats[k].total > 0);
  if (catKeys.length === 0) return null;
  const ms    = pr.managerStatus || {};
  const items = projectItems(pr, cl);

  const setFlag = (cat: string, field: string, on: boolean) => {
    const k = cat.toLowerCase();
    const cur = { ...(ms[k] || {}) };
    if (on) { cur[field] = true; cur[field + "Date"] = today(); } else { delete cur[field]; delete cur[field + "Date"]; }
    upP({ managerStatus: { ...ms, [k]: cur } });
  };

  const markDelivered = async (cat: string) => {
    const todo = items.filter(it => it.category === cat && statusRank(it.status) < statusRank("Delivered"));
    if (clientsHook?.setWsStatus) await clientsHook.setWsStatus(cl.id, pr.id, todo.map(it => ({ id: it.id, status: "Delivered" })), "manager");
    setFlag(cat, "delivered", true);
  };
  const undoDelivered = async (cat: string) => {
    // only the items whose last step was this manager tick go back
    const mine = items.filter(it => it.category === cat && it.status === "Delivered" &&
      (((pr.workspaceStatusHistory || {})[it.id] || []).slice(-1)[0]?.by === "manager"));
    if (clientsHook?.revertWsStatus) await clientsHook.revertWsStatus(cl.id, pr.id, mine.map(it => it.id));
    setFlag(cat, "delivered", false);
  };

  const col1W = isMobile ? 0 : 72;
  const col3W = isMobile ? 112 : 140;

  return (
    <div style={{ marginBottom: isMobile ? 12 : 8, border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? `1fr ${col3W}px` : `${col1W}px 1fr ${col3W}px`, background: "#f5f3f0", borderBottom: `1px solid ${C.rule}` }}>
        {!isMobile && <div style={{ padding: "4px 8px", fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Cat.</div>}
        <div style={{ padding: isMobile ? "5px 8px" : "4px 8px", fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, borderLeft: isMobile ? "none" : `1px solid ${C.rule}` }}>Deliverable · progress</div>
        <div style={{ padding: isMobile ? "5px 8px" : "4px 8px", fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, borderLeft: `1px solid ${C.rule}` }}>Manager</div>
      </div>

      {catKeys.map((cat, ci) => {
        const prog  = cats[cat];
        const msc   = ms[cat.toLowerCase()] || {};
        const isBC  = cat === "Influencer";
        const catIt = items.filter(it => it.category === cat);
        const lines: { key: string; name: string; note: string; its: any[] }[] = [];
        catIt.forEach(it => {
          let g = lines.find(x => x.key === it.lineKey);
          if (!g) { g = { key: it.lineKey, name: it.lineName + (it.month ? ` · M${String(it.month).padStart(2, "0")}` : ""), note: it.lineNote, its: [] }; lines.push(g); }
          g.its.push(it);
        });

        return (
          <div key={cat} style={{ display: "grid", gridTemplateColumns: isMobile ? `1fr ${col3W}px` : `${col1W}px 1fr ${col3W}px`, borderBottom: ci < catKeys.length - 1 ? `1px solid ${C.rule}` : "none" }}>
            {!isMobile && <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8px 6px", borderRight: `1px solid ${C.rule}` }}>
              <CatPill cat={cat} />
            </div>}

            <div style={{ borderRight: `1px solid ${C.rule}`, display: "flex", flexDirection: "column" as const }}>
              {lines.map((ln, lii) => {
                const created = ln.its.filter(it => statusRank(it.status) >= 1).length;
                const done = ln.its.filter(it => it.done).length;
                return (
                  <div key={ln.key} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, padding: isMobile ? "8px 10px" : "6px 10px", borderTop: lii > 0 ? `1px solid ${C.rule}` : "none" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {isMobile && <span style={{ display: "inline-block", marginBottom: 3 }}><CatPill cat={cat} /></span>}
                      <p style={{ fontSize: isMobile ? TYPE.subtext.size : TYPE.label.size, color: C.black, margin: 0, fontWeight: 500, lineHeight: 1.3 }}>{ln.name}</p>
                      {ln.note && <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "2px 0 0" }}>{ln.note}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                      {!isMobile && ln.its.map(it => (
                        <div key={it.id} title={`${it.name}: ${it.status}`} style={{ width: 8, height: 8, borderRadius: "50%", background: it.done ? C.green : statusRank(it.status) >= 1 ? C.black : "transparent", border: `1.5px solid ${it.done ? C.green : statusRank(it.status) >= 1 ? C.black : C.light}` }} />
                      ))}
                      <span style={{ fontSize: TYPE.micro.size, color: done === ln.its.length ? C.green : C.muted, marginLeft: 2, whiteSpace: "nowrap" as const }}>
                        {created}/{ln.its.length}{done ? ` · ${done} ${doneWord(cat)}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
              {prog.allCreated && !prog.allDone && (
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "3px 10px 5px" }}>
                  <span style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 20, background: TINT.green, border: `1px solid ${C.green}`, color: C.green }}>ready</span>
                </div>
              )}
            </div>

            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column" as const, gap: isMobile ? 7 : 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: prog.allCreated || msc.reviewed ? 1 : 0.4 }}>
                <Tick on={!!msc.reviewed} color={C.amber} size={isMobile ? 22 : 18} disabled={!prog.allCreated && !msc.reviewed}
                  onClick={() => setFlag(cat, "reviewed", !msc.reviewed)} />
                <div>
                  <span style={{ fontSize: TYPE.label.size, color: msc.reviewed ? C.amber : C.muted, display: "block" }}>reviewed</span>
                  {msc.reviewed && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{fmtD(msc.reviewedDate)}</span>}
                </div>
              </div>
              {!isBC && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: prog.allCreated || msc.delivered ? 1 : 0.4 }}>
                  <Tick on={!!msc.delivered} color={C.green} size={isMobile ? 22 : 18} disabled={!prog.allCreated && !msc.delivered}
                    onClick={() => (msc.delivered ? undoDelivered(cat) : markDelivered(cat))} />
                  <div>
                    <span style={{ fontSize: TYPE.label.size, color: msc.delivered ? C.green : C.muted, display: "block" }}>delivered</span>
                    {msc.delivered && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{fmtD(msc.deliveredDate)}</span>}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: prog.allDone ? 1 : 0.4 }}>
                <Tick on={prog.allDone} color={C.green} size={isMobile ? 22 : 18} disabled />
                <div>
                  <span style={{ fontSize: TYPE.label.size, color: prog.allDone ? C.green : C.muted, display: "block" }}>
                    {prog.allDone ? `all ${doneWord(cat)}` : `${prog.done}/${prog.total} ${doneWord(cat)}`}
                  </span>
                  {prog.allDone && prog.doneDate && <span style={{ fontSize: TYPE.micro.size, color: C.muted, display: "block" }}>{fmtD(prog.doneDate)}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
