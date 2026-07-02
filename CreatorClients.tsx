// ─────────────────────────────────────────────────────────────
// CreatorClients — read-only client list with progress bars
// Active: production clients with per-line progress
// Past: invoiced/paid clients
// Split view desktop, single-view mobile
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SERIF, TYPE } from "./constants";
import { fmt, fmtD, dLeft } from "./formatters";
import { getLineGroups, ccCatLabel, ccCatStyle } from "./wsHelpers";

interface CreatorClientsProps {
  clients:     any[];
  isMobile:    boolean;
  onSelChange?: (id: string | null) => void;
}

function scol(s: string): string {
  return ({ invoiced: C.amber, contracted: C.muted, quoted: C.light, revised: C.amber, production: C.blue, paid: C.green, lead: C.light }[s] ?? C.light);
}

export default function CreatorClients({ clients, isMobile, onSelChange }: CreatorClientsProps) {
  const [sel, setSel] = useState<string | null>(null);

  const activeClients = clients.filter(c => c.projects.some((pr: any) => pr.status === "production"));
  const pastClients   = clients.filter(c =>
    !c.projects.some((pr: any) => pr.status === "production") &&
     c.projects.some((pr: any) => pr.status === "invoiced" || pr.status === "paid")
  );
  const selClient = sel ? clients.find(c => c.id === sel) : null;

  // ── Progress bars per line group ─────────────────────────
  const LineRows = ({ c }: { c: any }) => {
    const pr = c.projects.find((p: any) => p.status === "production");
    if (!pr) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 5, marginTop: 8 }}>
        {getLineGroups(c, pr).map(g => {
          const done    = g.items.filter((it: any) => it.status === "Delivered").length;
          const total   = g.items.length;
          const complete = done === total;
          const cs       = ccCatStyle(g.category);
          const shortName = g.lineName.replace(/,.*$/,"").replace(/short-form/i,"Short video").trim();
          return (
            <div key={g.lineKey} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: TYPE.micro.size, padding: "1px 5px", borderRadius: 10, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.color, flexShrink: 0, minWidth: 42, textAlign: "center" as const }}>{ccCatLabel(g.category)}</span>
              <span style={{ fontSize: TYPE.label.size, color: C.muted, width: 60, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{shortName}</span>
              <div style={{ flex: 1, height: 3, background: C.rule, borderRadius: 2 }}>
                <div style={{ height: 3, width: `${(done/total)*100}%`, background: complete ? C.green : C.black, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: TYPE.label.size, color: complete ? C.green : C.muted, fontWeight: complete ? "500" : "400", minWidth: 24, textAlign: "right" as const }}>{done}/{total}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Detail panel (right side) ─────────────────────────────
  const Detail = ({ c }: { c: any }) => {
    const allPr = (c.projects || []).slice().sort((a: any,b: any) => (b.createdAt||0) - (a.createdAt||0));
    const totalEarned  = allPr.filter((p: any) => p.status === "paid").reduce((s: number,p: any) => s + (p.amount||0), 0);
    const activePrs    = allPr.filter((p: any) => p.status === "production");
    return (
      <div style={{ flex: 1, minWidth: 0, overflowY: isMobile ? undefined : "auto", maxHeight: isMobile ? undefined : "calc(100vh - 80px)", paddingLeft: isMobile ? 0 : 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px" }}>{c.name}</h2>
            <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: 0 }}>
              {[c.contact, c.email, c.agency && c.agency !== "Direct" ? c.agency : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={() => setSel(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 18, lineHeight: 1, padding: "2px 0 0 4px" }}>✕</button>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, border: `1px solid ${C.rule}`, borderRadius: 2, overflow: "hidden" }}>
          {[
            { label: "Projects", value: String(allPr.length) },
            { label: "Earned",   value: totalEarned > 0 ? fmt(totalEarned) : "—" },
            { label: "Active",   value: activePrs.length > 0 ? String(activePrs.length) : "—" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "10px 12px", borderRight: i < 2 ? `1px solid ${C.rule}` : "none", textAlign: "center" as const }}>
              <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 3px" }}>{s.label}</p>
              <p style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black, fontWeight: "normal", margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Project list */}
        {allPr.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.muted }}>No projects yet.</p>}
        {allPr.map((pr: any, i: number) => {
          const groups     = getLineGroups(c, pr);
          const allItems_  = groups.flatMap((g: any) => g.items);
          const totalDone  = allItems_.filter((it: any) => it.status === "Delivered").length;
          const totalAll   = allItems_.length;
          const statusLabel = pr.paid ? "Paid" : pr.status;
          const statusColor = scol(pr.paid ? "paid" : pr.status);
          const dl          = dLeft(pr.deliveryDate);
          const isOD        = pr.status === "production" && pr.deliveryDate && dl !== null && dl < 0;
          return (
            <div key={pr.id} style={{ padding: "10px 0", borderBottom: i < allPr.length - 1 ? `1px solid ${C.rule}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: TYPE.body.size, color: C.black, fontWeight: "500", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pr.name}</span>
                <span style={{ fontSize: TYPE.micro.size, color: statusColor, border: `1px solid ${statusColor}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.07em", textTransform: "uppercase" as const, flexShrink: 0 }}>{statusLabel}</span>
              </div>
              {groups.length > 0 && (
                <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {groups.map(g => `${g.items.length}× ${g.lineName.replace(/,.*$/,"").trim()}`).join(" · ")}
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {pr.deliveryDate && <span style={{ fontSize: TYPE.label.size, color: isOD ? C.red : C.amber, fontWeight: isOD ? "500" : "400", flexShrink: 0 }}>{fmtD(pr.deliveryDate)}{isOD ? " · Overdue" : ""}</span>}
                {!pr.deliveryDate && pr.status === "production" && <span style={{ fontSize: TYPE.label.size, color: C.light }}>No due date</span>}
                <span style={{ flex: 1 }} />
                {pr.amount > 0 && <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0 }}>{fmt(pr.amount)}</span>}
                {totalAll > 0 && <span style={{ fontSize: TYPE.label.size, color: totalDone === totalAll ? C.green : C.muted, flexShrink: 0, fontWeight: totalDone === totalAll ? "500" : "400" }}>{totalDone}/{totalAll}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Client card (list item) ───────────────────────────────
  const ClientCard = ({ c, isActive }: { c: any; isActive: boolean }) => {
    const pr = c.projects.find((p: any) => p.status === "production");
    const dl = dLeft(pr?.deliveryDate);
    return (
      <div onClick={() => setSel(c.id)}
        style={{ border: `1px solid ${sel === c.id ? C.light : C.rule}`, borderRadius: 2, padding: "11px 13px", marginBottom: 8, cursor: "pointer", background: sel === c.id ? "rgba(26,26,26,0.03)" : undefined, opacity: isActive ? 1 : 0.6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
          <span style={{ fontSize: TYPE.body.size, fontWeight: "500", color: C.black }}>{c.name}</span>
          {pr?.deliveryDate && <span style={{ fontSize: TYPE.body.size, fontWeight: "500", color: C.amber }}>{fmtD(pr.deliveryDate)}</span>}
        </div>
        {pr && <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 1px" }}>{pr.name}</p>}
        {dl !== null && <p style={{ fontSize: TYPE.label.size, color: C.light, margin: "0 0 0" }}>{dl}d left</p>}
        {!isActive && <p style={{ fontSize: TYPE.label.size, color: C.light, margin: "2px 0 0" }}>Paid</p>}
        {isActive && <LineRows c={c} />}
      </div>
    );
  };

  if (selClient && isMobile) return <div style={{ padding: "0 4px" }}><Detail c={selClient} /></div>;

  return (
    <div style={{ display: selClient && !isMobile ? "flex" : "block", gap: 28, alignItems: "flex-start" }}>
      <div style={{ flex: selClient && !isMobile ? "0 0 340px" : "1 1 100%", minWidth: 0, overflowY: selClient && !isMobile ? "auto" : undefined, maxHeight: selClient && !isMobile ? "calc(100vh - 80px)" : undefined }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 16px" }}>Clients</h2>
        {activeClients.length === 0 && pastClients.length === 0 && (
          <p style={{ fontSize: TYPE.label.size, color: C.muted }}>No active projects yet. Projects appear here once a contract is signed.</p>
        )}
        {activeClients.length > 0 && <>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 8px" }}>Active</p>
          {activeClients.map(c => <ClientCard key={c.id} c={c} isActive={true} />)}
        </>}
        {pastClients.length > 0 && <>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "16px 0 8px" }}>Past</p>
          {pastClients.map(c => <ClientCard key={c.id} c={c} isActive={false} />)}
        </>}
      </div>
      {selClient && !isMobile && <Detail c={selClient} />}
    </div>
  );
}
