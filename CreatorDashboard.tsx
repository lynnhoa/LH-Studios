// ─────────────────────────────────────────────────────────────
// CreatorDashboard — read-only overview, to read at a glance.
// No banner, no deadline list, no drill-down: the work happens in
// the Workspace. "Done" uses the shared rule (Brand Collab = posted,
// UGC / Editorial = delivered) and the date the item got there — an
// undone tick never counts.
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, TYPE, catInfo } from "./constants";
import { fmtD, today, addD } from "./formatters";
import { getWsItems, allDoneItems, isOverdue, isThisWeek } from "./wsHelpers";

interface CreatorDashboardProps {
  clients:  any[];
  isMobile: boolean;
  onOpen?:  (tab: "workspace" | "projects") => void;
}

const MO = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function CreatorDashboard({ clients, isMobile, onOpen }: CreatorDashboardProps) {
  const T        = today();
  const todayStr = `${new Date().toLocaleDateString("en-GB", { weekday: "long" })} · ${fmtD(T)}`;

  const open     = getWsItems(clients).filter(it => !it.done);
  const overdue  = open.filter(it => isOverdue(it.deadline)).length;
  const thisWeek = open.filter(it => !isOverdue(it.deadline) && isThisWeek(it.deadline)).length;
  const done     = allDoneItems(clients);
  const monthKey = T.slice(0, 7);
  const doneThisMonth = done.filter(it => String(it.doneDate).startsWith(monthKey));
  const activeProjects = (clients || []).flatMap((c: any) => c.projects || []).filter((p: any) => p.status === "production").length;
  const nextDeadline = [...open].filter(it => it.deadline && !isOverdue(it.deadline)).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

  // done per week (last 6 weeks, Monday–Sunday)
  const now = new Date(); const day = now.getDay();
  const mon0 = addD(T, -(day === 0 ? 6 : day - 1));
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const from = addD(mon0, -7 * (5 - i)), to = addD(from, 6);
    return { label: fmtD(from).slice(0, 6), n: done.filter(it => it.doneDate >= from && it.doneDate <= to).length };
  });
  const weekMax = Math.max(1, ...weeks.map(w => w.n));

  // done per month (last 6 months)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(parseInt(T.slice(0, 4)), parseInt(T.slice(5, 7)) - 1 - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const its = done.filter(it => String(it.doneDate).startsWith(key));
    return { label: MO[d.getMonth()], n: its.length, byCat: ["Influencer", "UGC", "Editorial"].map(c => its.filter(it => it.category === c).length) };
  });
  const monthMax = Math.max(1, ...months.map(m => m.n));

  const tile = (label: string, value: string, sub: string, onClick?: () => void, subColor?: string) => (
    <div onClick={onClick} role={onClick ? "button" : undefined}
      style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "14px 16px", cursor: onClick ? "pointer" : "default", background: C.bg, minWidth: 0 }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 8px" }}>{label}</p>
      <p style={{ fontFamily: SERIF, fontSize: TYPE.amount.size, color: C.black, margin: "0 0 4px", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
      <p style={{ fontSize: TYPE.label.size, color: subColor || C.muted, margin: 0 }}>{sub}</p>
    </div>
  );
  const box = (title: string, children: any) => (
    <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "14px 16px", marginBottom: 14 }}>
      <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 12px" }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px", color: C.black }}>Dashboard</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>{todayStr} · read only</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 22 }}>
        {tile("Open items", String(open.length), `${thisWeek} due this week${overdue ? ` · ${overdue} overdue` : ""}`, onOpen ? () => onOpen("workspace") : undefined, overdue ? C.red : undefined)}
        {tile(`Done ${MO[parseInt(T.slice(5, 7)) - 1]}`, String(doneThisMonth.length), ["Influencer", "UGC", "Editorial"].map(c => { const n = doneThisMonth.filter(it => it.category === c).length; return n ? `${n} ${catInfo(c).label}` : ""; }).filter(Boolean).join(" · ") || "nothing yet")}
        {tile("Active projects", String(activeProjects), activeProjects === 1 ? "in production" : "in production", onOpen ? () => onOpen("projects") : undefined)}
        {tile("Next deadline", nextDeadline ? fmtD(nextDeadline.deadline) : "—", nextDeadline ? `${nextDeadline.clientName} · ${nextDeadline.projectName}` : "no upcoming deadline")}
      </div>

      {box("Done per week", (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, alignItems: "end", height: 120 }}>
          {weeks.map((w, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              {w.n > 0 && <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginBottom: 3 }}>{w.n}</span>}
              <div style={{ width: "100%", maxWidth: 34, height: `${Math.max(w.n ? 3 : 1, Math.round((w.n / weekMax) * 80))}px`, background: w.n ? C.black : C.rule, borderRadius: 1 }} />
              <span style={{ fontSize: TYPE.micro.size, color: C.light, marginTop: 4, whiteSpace: "nowrap" as const }}>{w.label}</span>
            </div>
          ))}
        </div>
      ))}

      {box("Output per month", (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, alignItems: "end", height: 130 }}>
          {months.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              {m.n > 0 && <span style={{ fontSize: TYPE.micro.size, color: C.muted, marginBottom: 3 }}>{m.n}</span>}
              <div style={{ width: "100%", maxWidth: 34, display: "flex", flexDirection: "column-reverse" as const, height: `${Math.max(m.n ? 3 : 1, Math.round((m.n / monthMax) * 90))}px`, background: m.n ? "transparent" : C.rule, borderRadius: 1, overflow: "hidden" }}>
                {m.byCat.map((n, ci) => n ? <div key={ci} style={{ height: `${(n / m.n) * 100}%`, background: catInfo(["Influencer", "UGC", "Editorial"][ci]).color }} /> : null)}
              </div>
              <span style={{ fontSize: TYPE.micro.size, color: C.light, marginTop: 4 }}>{m.label}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const }}>
        {["Influencer", "UGC", "Editorial"].map(c => (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: TYPE.label.size, color: C.muted, fontFamily: SANS }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: catInfo(c).color }} />{catInfo(c).label}
          </span>
        ))}
      </div>
    </div>
  );
}
