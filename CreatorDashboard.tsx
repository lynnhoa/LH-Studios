// ─────────────────────────────────────────────────────────────
// CreatorDashboard — open items, deadlines, velocity, output log
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, dLeft } from "./formatters";
import { getWsItems, getAllDelivered, isOverdue, isThisWeek, wsCatPill } from "./wsHelpers";

interface CreatorDashboardProps {
  clients:  any[];
  isMobile: boolean;
}

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function CreatorDashboard({ clients, isMobile }: CreatorDashboardProps) {
  const [drill, setDrill] = useState<"output" | null>(null);

  const todayDate = new Date();
  const todayStr  = todayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const nowY      = todayDate.getFullYear();
  const nowM      = todayDate.getMonth();

  const allItems        = getWsItems(clients);
  const open            = allItems.filter(it => it.status !== "Delivered" && it.status !== "Posted");
  const overdue         = open.filter(it => isOverdue(it.deadline));
  const dueThisWeek     = open.filter(it => !isOverdue(it.deadline) && isThisWeek(it.deadline));
  const clientNames     = [...new Set(open.map(it => it.clientName))] as string[];

  const allDelivered    = getAllDelivered(clients, allItems);
  const deliveredThisMonth = allDelivered.filter(it => {
    const d = new Date(it.deliveredDate);
    return d.getFullYear() === nowY && d.getMonth() === nowM;
  });

  // Velocity — delivered per week, last 4 weeks
  const velocity = [0,1,2,3].map(w => {
    const mon = new Date(todayDate);
    const day = mon.getDay();
    mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1) - w * 7);
    mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    let count = 0;
    clients.forEach(c => c.projects.forEach((pr: any) => {
      Object.values(pr.workspaceStatusHistory || {}).forEach((entries: any) => {
        (entries || []).forEach((e: any) => {
          if (e.status === "Delivered") { const d = new Date(e.date); if (d >= mon && d <= sun) count++; }
        });
      });
    }));
    return { label: `Wk ${4 - w}`, count };
  }).reverse();
  const velMax = Math.max(...velocity.map(w => w.count), 1);

  // By category + client
  const cats = ["Influencer","UGC","Editorial"];
  const catCounts  = cats.map(cat => ({ cat, count: open.filter(it => it.category === cat).length }));
  const catMax     = Math.max(...catCounts.map(c => c.count), 1);
  const catLabel   = (cat: string) => cat === "Influencer" ? "Collab" : cat;
  const clientCounts = clientNames
    .map(n => ({ name: n, count: open.filter(it => it.clientName === n).length }))
    .sort((a,b) => b.count - a.count).slice(0, 5);
  const clientMax = Math.max(...clientCounts.map(c => c.count), 1);

  const upcomingDeadlines = [...open].filter(it => it.deadline)
    .sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 5);
  const recentDelivered   = [...deliveredThisMonth].slice(0, 5);

  const dlColor  = (d: string | null) => !d ? C.muted : isOverdue(d) ? C.red : isThisWeek(d) ? C.amber : C.muted;
  const dlBg     = (d: string | null) => !d ? "transparent" : isOverdue(d) ? "#fdf0f0" : isThisWeek(d) ? "#fdf6ee" : "transparent";
  const dlBorder = (d: string | null) => !d ? C.rule : isOverdue(d) ? C.red : isThisWeek(d) ? C.amber : C.rule;

  const Card = ({ label, children }: { label: string; children: any }) => (
    <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "13px 15px", background: C.bg }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>{label}</p>
      {children}
    </div>
  );

  // ── OUTPUT LOG DRILL ─────────────────────────────────────
  if (drill === "output") {
    const groups: { year: number; month: number; items: any[] }[] = [];
    allDelivered.forEach(it => {
      const d = new Date(it.deliveredDate); const y = d.getFullYear(), m = d.getMonth();
      let g = groups.find(x => x.year === y && x.month === m);
      if (!g) { g = { year: y, month: m, items: [] }; groups.push(g); }
      g.items.push(it);
    });
    return (
      <div>
        <button onClick={() => setDrill(null)} style={{ fontSize: TYPE.subtext.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 20, fontFamily: SANS }}>← Dashboard</button>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px" }}>Output log</h2>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>{allDelivered.length} delivered total</p>
        </div>
        {allDelivered.length === 0 && <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "40px 20px", textAlign: "center" as const }}><p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: 0 }}>Nothing delivered yet.</p></div>}
        {groups.map(g => {
          const byCat: Record<string,number> = {};
          g.items.forEach(it => { byCat[it.category] = (byCat[it.category] || 0) + 1; });
          return (
            <div key={`${g.year}-${g.month}`} style={{ marginBottom: 52 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: TYPE.body.size, fontWeight: "500", color: C.black }}>{MO[g.month]} {g.year}</span>
                <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{g.items.length} delivered</span>
                <div style={{ display: "flex", gap: 5, marginLeft: 4, flexWrap: "wrap" as const }}>
                  {Object.entries(byCat).map(([cat, cnt]) => {
                    const cs = wsCatPill(cat);
                    return <span key={cat} style={{ fontSize: TYPE.micro.size, padding: "1px 7px", borderRadius: 10, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.color }}>{catLabel(cat)} {cnt as number}</span>;
                  })}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.rule}`, marginBottom: 4 }} />
              {g.items.map(it => {
                const cs = wsCatPill(it.category);
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, padding: "9px 0", borderBottom: `1px solid ${C.rule}` }}>
                    <span style={{ fontSize: TYPE.label.size, fontWeight: "500", color: C.black, letterSpacing: "0.04em", width: 64, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{it.clientName.toUpperCase()}</span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: TYPE.body.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{it.name}</span>
                      <span style={{ fontSize: TYPE.micro.size, padding: "2px 7px", borderRadius: 10, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.color, flexShrink: 0 }}>{catLabel(it.category)}</span>
                    </div>
                    <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0 }}>{fmtD(it.deliveredDate)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // ── EMPTY STATE ──────────────────────────────────────────
  if (allItems.length === 0) return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 6px" }}>Dashboard</h2>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "0 0 32px" }}>{todayStr}</p>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "40px 20px", textAlign: "center" as const }}>
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "0 0 6px" }}>No active projects yet.</p>
        <p style={{ fontSize: TYPE.label.size, color: C.light, margin: 0 }}>Waiting for your first contract to be signed.</p>
      </div>
    </div>
  );

  // ── MAIN DASHBOARD ───────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px" }}>Dashboard</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>{todayStr}</p>
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fdf0f0", border: `1px solid ${C.red}`, borderRadius: 2, marginBottom: 16 }}>
          <span style={{ fontSize: TYPE.subtext.size, fontWeight: "500", color: C.red, flexShrink: 0 }}>{overdue.length} overdue</span>
          <span style={{ fontSize: TYPE.label.size, color: C.red, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {overdue.slice(0,3).map(it => `${it.name} · ${it.clientName} · was due ${fmtD(it.deadline)}`).join("  ·  ")}
          </span>
        </div>
      )}

      {/* 4 summary stat boxes */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
        {[
          { label: "Overdue",            val: overdue.length,            sub: "past deadline",           col: overdue.length > 0 ? C.red : C.light,   bg: overdue.length > 0 ? "#fdf0f0" : C.bg, bd: overdue.length > 0 ? C.red : C.rule,   drill: null },
          { label: "Due this week",      val: dueThisWeek.length,        sub: "by Sunday",              col: dueThisWeek.length > 0 ? C.amber : C.light, bg: dueThisWeek.length > 0 ? "#fdf6ee" : C.bg, bd: dueThisWeek.length > 0 ? C.amber : C.rule, drill: null },
          { label: "Total open",         val: open.length,               sub: `across ${clientNames.length} client${clientNames.length !== 1 ? "s" : ""}`, col: C.black, bg: C.bg, bd: C.rule, drill: null },
          { label: "Delivered this month", val: deliveredThisMonth.length, sub: `${new Date().toLocaleString("en-GB",{month:"long"})} · tap to view all`, col: deliveredThisMonth.length > 0 ? C.green : C.light, bg: C.bg, bd: C.rule, drill: "output" as const },
        ].map(item => (
          <div key={item.label} onClick={() => item.drill && setDrill(item.drill)} style={{ border: `1px solid ${item.bd}`, borderRadius: 2, padding: "13px 15px", background: item.bg, cursor: item.drill ? "pointer" : "default" }}>
            <p style={{ fontSize: TYPE.micro.size, color: item.col === C.light ? C.muted : item.col, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 6px" }}>{item.label}</p>
            <p style={{ fontFamily: SERIF, fontSize: TYPE.kpi.size, color: item.col, margin: "0 0 3px", lineHeight: 1 }}>{item.val}</p>
            <p style={{ fontSize: TYPE.micro.size, color: item.col }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* 4 visual cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>

        <Card label="By category">
          {catCounts.map((c, i) => (
            <div key={c.cat} style={{ marginBottom: i < catCounts.length - 1 ? 8 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: TYPE.label.size, color: C.black }}>{catLabel(c.cat)}</span>
                <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{c.count}</span>
              </div>
              <div style={{ height: 3, background: C.rule, borderRadius: 2 }}>
                <div style={{ height: 3, width: `${(c.count/catMax)*100}%`, background: c.cat === "Influencer" ? "#185FA5" : c.cat === "UGC" ? C.amber : C.green, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </Card>

        <Card label="By client">
          {clientCounts.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.light }}>No open deliverables.</p>}
          {clientCounts.map((c, i) => (
            <div key={c.name} style={{ marginBottom: i < clientCounts.length - 1 ? 8 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: TYPE.label.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "75%" }}>{c.name}</span>
                <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{c.count}</span>
              </div>
              <div style={{ height: 3, background: C.rule, borderRadius: 2 }}>
                <div style={{ height: 3, width: `${(c.count/clientMax)*100}%`, background: C.black, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </Card>

        <Card label="Upcoming deadlines">
          {upcomingDeadlines.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.light }}>No upcoming deadlines.</p>}
          {upcomingDeadlines.map(it => {
            const d = dLeft(it.deadline);
            return (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 7px", marginBottom: 4, background: dlBg(it.deadline), border: `1px solid ${dlBorder(it.deadline)}`, borderRadius: 2 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: TYPE.body.size, fontWeight: "500", color: dlColor(it.deadline), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, display: "block" }}>{it.name}</span>
                  <span style={{ fontSize: TYPE.label.size, color: dlColor(it.deadline), opacity: 0.8 }}>{it.clientName}</span>
                </div>
                <div style={{ textAlign: "right" as const, flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontSize: TYPE.label.size, fontWeight: "600", color: dlColor(it.deadline) }}>{d !== null ? (d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`) : "—"}</span>
                  <span style={{ fontSize: TYPE.micro.size, color: dlColor(it.deadline), display: "block", opacity: 0.7 }}>{fmtD(it.deadline)}</span>
                </div>
              </div>
            );
          })}
        </Card>

        <Card label="Recently delivered">
          {recentDelivered.length === 0 && <p style={{ fontSize: TYPE.label.size, color: C.light }}>Nothing delivered this month yet.</p>}
          {recentDelivered.map((it, i) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < recentDelivered.length - 1 ? `1px solid ${C.rule}` : "none" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: TYPE.body.size, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, display: "block" }}>{it.name}</span>
                <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{it.clientName}</span>
              </div>
              <span style={{ fontSize: TYPE.label.size, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{fmtD(it.deliveredDate)}</span>
            </div>
          ))}
        </Card>

      </div>

      {/* Production velocity bar chart */}
      <Card label="Production velocity — delivered per week">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 60, marginTop: 4 }}>
          {velocity.map((w, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>{w.count}</span>
              <div style={{ width: "100%", background: C.black, borderRadius: 2, height: `${Math.max(3, Math.round((w.count/velMax)*44))}px` }} />
              <span style={{ fontSize: TYPE.micro.size, color: C.light, letterSpacing: "0.04em" }}>{w.label}</span>
            </div>
          ))}
        </div>
        {velocity.every(w => w.count === 0) && <p style={{ fontSize: TYPE.label.size, color: C.light, marginTop: 8 }}>No deliveries recorded yet.</p>}
      </Card>
    </div>
  );
}
