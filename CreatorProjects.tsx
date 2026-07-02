// ─────────────────────────────────────────────────────────────
// CreatorProjects — read-only project list, expandable cards
// Shows production projects with deliverable dot progress
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, dLeft } from "./formatters";
import { getLineGroups, ccCatLabel, ccCatStyle } from "./wsHelpers";

interface CreatorProjectsProps {
  clients:  any[];
  isMobile: boolean;
}

const DOT_CAP = 12;

function scol(s: string): string {
  return ({ invoiced: C.amber, contracted: C.muted, quoted: C.light, revised: C.amber, production: C.blue, paid: C.green, lead: C.light }[s] ?? C.light);
}

const dotColor  = (st: string) => st === "Delivered" ? C.green : st === "Reviewed" ? C.amber : st === "Finished" ? C.black : C.rule;
const stColor   = (st: string) => st === "Delivered" ? C.green : st === "Reviewed" ? C.amber : st === "Finished" ? C.black : C.light;

function renderDots(items: any[]) {
  const capped   = items.slice(0, DOT_CAP);
  const overflow = items.length - DOT_CAP;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
      {capped.map(it => (
        <span key={it.id} style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor(it.status), display: "inline-block", flexShrink: 0 }} />
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: TYPE.micro.size, color: C.muted, border: `1px solid ${C.rule}`, borderRadius: 8, padding: "0 4px", lineHeight: "14px", flexShrink: 0 }}>+{overflow}</span>
      )}
    </div>
  );
}

export default function CreatorProjects({ clients, isMobile }: CreatorProjectsProps) {
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>(() => {
    const init: Record<string,boolean> = {};
    clients.forEach(c => (c.projects || []).forEach((pr: any) => {
      if (pr.status === "invoiced" || pr.status === "paid") init[pr.id] = true;
    }));
    return init;
  });

  const allProjects: any[] = [];
  clients.forEach(c => (c.projects || []).forEach((pr: any) => allProjects.push({ ...pr, clientName: c.name, clientId: c.id })));

  const active = allProjects.filter(pr => pr.status === "production").sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  const done   = allProjects.filter(pr => pr.status === "invoiced" || pr.status === "paid").sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  const allIds = [...active, ...done].map(pr => pr.id);
  const allCollapsed = allIds.length > 0 && allIds.every(id => collapsed[id] === true);

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed(p => { const n = { ...p }; allIds.forEach(id => delete n[id]); return n; });
    } else {
      setCollapsed(p => { const n = { ...p }; allIds.forEach(id => { n[id] = true; }); return n; });
    }
  };

  const renderCard = (pr: any, isDone = false) => {
    const c = clients.find(cl => cl.id === pr.clientId) || {};
    const groups     = getLineGroups(c, pr);
    const allItems   = groups.flatMap(g => g.items);
    const totalDone  = allItems.filter(it => it.status === "Delivered").length;
    const totalAll   = allItems.length;
    const dl         = dLeft(pr.deliveryDate);
    const isOD       = !isDone && pr.deliveryDate && dl !== null && dl < 0;
    const isOpen     = collapsed[pr.id] !== true;
    const statusLabel = pr.paid ? "Paid" : pr.status;
    const statusColor = scol(pr.paid ? "paid" : pr.status);
    const scopeSummary = groups.map(g => `${g.items.length}× ${g.lineName.replace(/,.*$/,"").trim()}`).join(" · ");

    return (
      <div key={pr.id} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 8, overflow: "hidden", opacity: isDone ? 0.75 : 1 }}>

        {/* Header */}
        <div onClick={() => setCollapsed(p => ({ ...p, [pr.id]: !p[pr.id] }))}
          style={{ padding: isMobile ? "11px 12px" : "10px 13px", background: "#f7f6f4", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr.name}</span>
            <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0, whiteSpace: "nowrap" as const }}>{pr.clientName}</span>
            <span style={{ fontSize: TYPE.micro.size, color: statusColor, border: `1px solid ${statusColor}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.07em", textTransform: "uppercase" as const, flexShrink: 0 }}>{statusLabel}</span>
            <span style={{ fontSize: TYPE.label.size, color: C.light, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
          </div>
          {scopeSummary && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: TYPE.label.size, color: C.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{scopeSummary}</span>
              {pr.amount > 0 && <span style={{ fontSize: TYPE.subtext.size, color: C.black, fontWeight: "500", flexShrink: 0 }}>{fmt(pr.amount)}</span>}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {totalAll > 0 && renderDots(allItems)}
            {totalAll > 0 && <span style={{ fontSize: TYPE.label.size, color: totalDone === totalAll ? C.green : C.muted, fontWeight: totalDone === totalAll ? "500" : "400", flexShrink: 0 }}>{totalDone}/{totalAll}</span>}
            <span style={{ flex: 1 }} />
            {pr.deliveryDate && <span style={{ fontSize: TYPE.label.size, color: isOD ? C.red : C.amber, fontWeight: isOD ? "500" : "400", flexShrink: 0 }}>{fmtD(pr.deliveryDate)}</span>}
            {pr.deliveryDate && dl !== null && !isDone && !isOD && <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0 }}>· {dl}d left</span>}
            {isOD && <span style={{ fontSize: TYPE.label.size, color: C.red, fontWeight: "500", flexShrink: 0 }}>· Overdue</span>}
          </div>
        </div>

        {/* Expanded body */}
        {isOpen && groups.map(g => {
          const done_   = g.items.filter((it: any) => it.status === "Delivered").length;
          const total_  = g.items.length;
          const complete = done_ === total_;
          const cs       = ccCatStyle(g.category);
          const subKey   = `${pr.id}_${g.lineKey}`;
          const subOpen  = collapsed[subKey] !== false;
          return (
            <div key={g.lineKey} style={{ borderTop: `1px solid ${C.rule}` }}>
              <div onClick={e => { e.stopPropagation(); setCollapsed(p => ({ ...p, [subKey]: !subOpen })); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "9px 12px" : "9px 13px", cursor: "pointer", background: subOpen ? "#f7f6f4" : C.white }}>
                <span style={{ fontSize: TYPE.micro.size, padding: "2px 7px", borderRadius: 10, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.color, flexShrink: 0 }}>{ccCatLabel(g.category)}</span>
                <span style={{ fontSize: TYPE.subtext.size, color: C.black, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{total_}× {g.lineName}</span>
                {renderDots(g.items)}
                <span style={{ fontSize: TYPE.label.size, color: complete ? C.green : C.muted, fontWeight: complete ? "500" : "400", flexShrink: 0, minWidth: 28, textAlign: "right" as const }}>{done_}/{total_}</span>
                <span style={{ fontSize: TYPE.micro.size, color: C.light, flexShrink: 0 }}>{subOpen ? "▾" : "▸"}</span>
              </div>
              {subOpen && g.items.map((it: any) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "8px 12px 8px 28px" : "7px 13px 7px 32px", borderTop: `1px solid ${C.rule}`, background: C.white }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor(it.status), display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: isMobile ? TYPE.body.size : TYPE.subtext.size, color: C.black, flex: 1 }}>{it.name}</span>
                  <span style={{ fontSize: TYPE.label.size, color: stColor(it.status), flexShrink: 0 }}>{it.status}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0 }}>Projects</h2>
        {allIds.length > 0 && (
          <button onClick={toggleAll} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", padding: 0 }}>
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        )}
      </div>
      {active.length === 0 && done.length === 0 && (
        <p style={{ fontSize: TYPE.label.size, color: C.muted }}>No projects yet. Projects appear here once a contract is in production.</p>
      )}
      {active.length > 0 && <>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 8px" }}>Active — {active.length}</p>
        {active.map(pr => renderCard(pr, false))}
      </>}
      {done.length > 0 && (
        <div style={{ marginTop: active.length > 0 ? 24 : 0 }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 8px" }}>Done — {done.length}</p>
          {done.map(pr => renderCard(pr, true))}
        </div>
      )}
    </div>
  );
}
