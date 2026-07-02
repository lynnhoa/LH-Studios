// ─────────────────────────────────────────────────────────────
// wsHelpers — shared workspace / creator utilities
// Used by CreatorWorkspace, CreatorProjects, CreatorClients,
// CreatorDashboard
// ─────────────────────────────────────────────────────────────

import { C } from "./constants";
import { today } from "./formatters";

export const WS_STATUSES = ["Not started", "Created", "Reviewed", "Delivered", "Posted"] as const;

// ── Category helpers ──────────────────────────────────────────
export function getWsCategory(lineName: string): string {
  const n = (lineName || "").toLowerCase();
  if (n.includes("hero") || n.includes("editorial") || n.includes("photo story") || n.includes("mini set") || n.includes("hero image")) return "Editorial";
  if (n.includes("ugc") || n.includes("campaign video")) return "UGC";
  return "Influencer";
}

export function ccCatLabel(cat: string): string {
  if (cat === "UGC")      return "UGC";
  if (cat === "Editorial") return "Editorial";
  return "Collab";
}

export function ccCatStyle(cat: string) {
  if (cat === "UGC")      return { bg: "#fdf5ee", border: "#e8d8c8", color: C.amber };
  if (cat === "Editorial") return { bg: "#f0f5f0", border: "#b8d4b8", color: C.green };
  return { bg: "#f0f0f5", border: "#c8c8e0", color: "#6a6aaa" };
}

export function wsCatPill(cat: string) {
  if (cat === "UGC")      return { bg: "#fdf5ee", border: "#e8d8c8", color: C.amber };
  if (cat === "Editorial") return { bg: "#f0f5f0", border: "#b8d4b8", color: C.green };
  return { bg: "#f0f0f5", border: "#c8c8e0", color: "#6a6aaa" };
}

// ── Line group extraction (for projects view) ─────────────────
const SKIP = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];

export function getLineGroups(c: any, pr: any): any[] {
  const groups: any[] = [];
  (pr.qd?.lines || []).forEach((ln: any, li: number) => {
    if (!ln.name) return;
    if (SKIP.some(s => ln.name.toLowerCase().includes(s))) return;
    const qty     = parseInt(ln.qty) || 1;
    const cat     = getWsCategory(ln.name);
    const lineKey = `${li}_${cat}`;
    let grp = groups.find(g => g.lineKey === lineKey);
    if (!grp) { grp = { lineKey, lineName: ln.name, category: cat, items: [] }; groups.push(grp); }
    for (let q = 0; q < qty; q++) {
      const id = `${pr.id}_ln${li}_q${q}`;
      grp.items.push({
        id,
        name:   (pr.workspaceNames || {})[id] || ln.name + (qty > 1 ? ` ${q + 1}` : ""),
        status: (pr.workspaceStatus || {})[id] || "Not started",
      });
    }
  });
  return groups;
}

// ── Workspace items (flat list for workspace tab) ─────────────
export function getWsItems(clients: any[]): any[] {
  const items: any[] = [];
  clients.forEach(c => {
    c.projects.filter((pr: any) => pr.status === "production").forEach((pr: any) => {
      (pr.qd?.lines || []).forEach((ln: any, li: number) => {
        if (!ln.name) return;
        if (SKIP.some(s => ln.name.toLowerCase().includes(s))) return;
        const qty = parseInt(ln.qty) || 1;
        for (let q = 0; q < qty; q++) {
          const id = `${pr.id}_ln${li}_q${q}`;
          items.push({
            id,
            name:         (pr.workspaceNames || {})[id] || ln.name + (qty > 1 ? ` ${q + 1}` : ""),
            defaultName:  ln.name + (qty > 1 ? ` ${q + 1}` : ""),
            lineNote:     ln.note || "",
            clientId:     c.id,
            clientName:   c.name,
            projectId:    pr.id,
            projectName:  pr.name,
            deadline:     pr.deliveryDate || null,
            category:     getWsCategory(ln.name),
            status:       (pr.workspaceStatus || {})[id] || "Not started",
            plannerDate:  (pr.workspacePlanner || {})[id] || null,
            notes:        (pr.workspaceNotes || {})[id] || "",
          });
        }
      });
    });
  });
  return items;
}

// ── Date helpers ──────────────────────────────────────────────
export function isThisWeek(d: string | null): boolean {
  if (!d) return false;
  const now = new Date(); now.setHours(0,0,0,0);
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const dt  = new Date(d); dt.setHours(0,0,0,0);
  return dt >= mon && dt <= sun;
}

export function isOverdue(d: string | null): boolean {
  if (!d) return false;
  const now = new Date(); now.setHours(0,0,0,0);
  return new Date(d) < now;
}

export function fmtDeadline(d: string | null): string {
  if (!d) return "No deadline";
  const dt   = new Date(d);
  const day  = dt.getDate();
  const mo   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()];
  return `${day} ${mo}`;
}

export function plannerDayLabel(d: string | null): string | null {
  if (!d) return null;
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(d).getDay()];
}

// ── Get all delivered items across all clients ────────────────
export function getAllDelivered(clients: any[], allItems: any[]) {
  const out: any[] = [];
  clients.forEach(c => c.projects.forEach((pr: any) => {
    const hist = pr.workspaceStatusHistory || {};
    Object.entries(hist).forEach(([id, entries]: any) => {
      const lastDelivered = [...(entries || [])].reverse().find((e: any) => e.status === "Delivered");
      if (lastDelivered) {
        const item = allItems.find(it => it.id === id);
        if (item) out.push({ ...item, deliveredDate: lastDelivered.date });
      }
    });
  }));
  return out.sort((a, b) => new Date(b.deliveredDate).getTime() - new Date(a.deliveredDate).getTime());
}


// ── Category progress per project — port of old App.tsx getCatProgress ──
export function getCatProgress(pr: any, clients: any[]): Record<string, { total: number; created: number; posted: number; allCreated: boolean }> {
  const cl = clients.find((c: any) => c.projects.some((p: any) => p.id === pr.id));
  if (!cl) return {};
  const skip = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
  const cats: Record<string, { total: number; created: number; posted: number; allCreated: boolean }> = {};
  (pr.qd?.lines || []).forEach((ln: any, li: number) => {
    if (!ln.name) return;
    if (skip.some((s: string) => ln.name.toLowerCase().includes(s))) return;
    const qty = parseInt(ln.qty) || 1;
    for (let q = 0; q < qty; q++) {
      const id = `${pr.id}_ln${li}_q${q}`;
      const cat = getWsCategory(ln.name);
      const st = (pr.workspaceStatus || {})[id] || "Not started";
      if (!cats[cat]) cats[cat] = { total: 0, created: 0, posted: 0, allCreated: false };
      cats[cat].total++;
      if (["Created","Reviewed","Delivered","Posted"].includes(st)) cats[cat].created++;
      if (st === "Posted") cats[cat].posted++;
    }
  });
  Object.keys(cats).forEach(k => { cats[k].allCreated = cats[k].total > 0 && cats[k].created === cats[k].total; });
  return cats;
}
