// ─────────────────────────────────────────────────────────────
// wsHelpers — shared workspace / creator utilities
// Used by CreatorWorkspace, CreatorProjects, CreatorClients,
// CreatorDashboard
// ─────────────────────────────────────────────────────────────

import { catInfo } from "./constants";

export const WS_STATUSES = ["Not started", "Created", "Reviewed", "Delivered", "Posted"] as const;

// ── Category helpers ──────────────────────────────────────────
// Accepts the full line object (preferred) or a bare name string (legacy).
// Authoritative source: `cat` chosen in the Calculator and stored on the
// line — Brand Collab → Influencer, UGC → UGC, Editorial → Editorial.
// Name-keyword heuristic remains only as fallback for old lines without `cat`.
export function getWsCategory(ln: any): string {
  const c = (typeof ln === "object" && ln ? ln.cat || "" : "").toLowerCase();
  if (c === "ugc")       return "UGC";
  if (c === "editorial") return "Editorial";
  if (c === "influencer" || c === "hotels") return "Influencer";
  const n = ((typeof ln === "string" ? ln : ln?.name) || "").toLowerCase();
  if (n.includes("hero") || n.includes("editorial") || n.includes("photo story") || n.includes("mini set") || n.includes("hero image")) return "Editorial";
  if (n.includes("ugc") || n.includes("campaign video")) return "UGC";
  return "Influencer";
}

// One label + colour per category for the whole app (constants.ts)
export function ccCatLabel(cat: string): string { return catInfo(cat).label; }

export function ccCatStyle(cat: string) {
  const c = catInfo(cat);
  return { bg: c.bg, border: c.border, color: c.color };
}

export const wsCatPill = ccCatStyle;

// ── Work lines: what has to be produced for a project ────────
// One entry per deliverable line; a package with contents becomes
// one entry per included deliverable. Item ids: `${key}_q${n}`.
const SKIP = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];

export interface WorkLine { key: string; li: number; name: string; note: string; qty: number; cat: string; line: any; }

export function wsLines(pr: any): WorkLine[] {
  const out: WorkLine[] = [];
  (pr?.qd?.lines || []).forEach((ln: any, li: number) => {
    if (!ln?.name) return;
    if (SKIP.some(s => ln.name.toLowerCase().includes(s))) return;
    const qty  = parseInt(ln.qty) || 1;
    const incl = Array.isArray(ln.includes) ? ln.includes.filter((x: any) => x && x.n) : [];
    if (ln.kind === "package" && incl.length) {
      incl.forEach((inc: any, k: number) => {
        out.push({ key: `${pr.id}_ln${li}_p${k}`, li, name: inc.n, note: ln.name, qty: (parseInt(inc.qty) || 1) * qty, cat: ln.cat, line: { ...ln, name: inc.n } });
      });
      return;
    }
    out.push({ key: `${pr.id}_ln${li}`, li, name: ln.name, note: ln.note || "", qty, cat: ln.cat, line: ln });
  });
  return out;
}

export const wsItemIds = (w: WorkLine): string[] => Array.from({ length: w.qty }, (_, q) => `${w.key}_q${q}`);

// ── Line groups (projects view) ───────────────────────────────
export function getLineGroups(c: any, pr: any): any[] {
  const groups: any[] = [];
  wsLines(pr).forEach(w => {
    const cat     = getWsCategory(w.line);
    const lineKey = `${w.key}_${cat}`;
    let grp = groups.find(g => g.lineKey === lineKey);
    if (!grp) { grp = { lineKey, lineName: w.name, category: cat, items: [] }; groups.push(grp); }
    wsItemIds(w).forEach((id, q) => {
      grp.items.push({
        id,
        name:   (pr.workspaceNames || {})[id] || w.name + (w.qty > 1 ? ` ${q + 1}` : ""),
        status: (pr.workspaceStatus || {})[id] || "Not started",
      });
    });
  });
  return groups;
}

// ── Workspace items (flat list for workspace tab) ─────────────
export function getWsItems(clients: any[]): any[] {
  const items: any[] = [];
  clients.forEach(c => {
    c.projects.filter((pr: any) => pr.status === "production").forEach((pr: any) => {
      wsLines(pr).forEach(w => {
        wsItemIds(w).forEach((id, q) => {
          const defaultName = w.name + (w.qty > 1 ? ` ${q + 1}` : "");
          items.push({
            id,
            name:         (pr.workspaceNames || {})[id] || defaultName,
            defaultName,
            lineNote:     w.note || "",
            clientId:     c.id,
            clientName:   c.name,
            projectId:    pr.id,
            projectName:  pr.name,
            deadline:     pr.deliveryDate || null,
            category:     getWsCategory(w.line),
            status:       (pr.workspaceStatus || {})[id] || "Not started",
            plannerDate:  (pr.workspacePlanner || {})[id] || null,
            notes:        (pr.workspaceNotes || {})[id] || "",
          });
        });
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

// Short German date for tight lists: "15.03."
export function fmtDeadline(d: string | null): string {
  if (!d) return "No deadline";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}.${m[2]}.` : "—";
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
  const cats: Record<string, { total: number; created: number; posted: number; allCreated: boolean }> = {};
  wsLines(pr).forEach(w => {
    const cat = getWsCategory(w.line);
    wsItemIds(w).forEach(id => {
      const st = (pr.workspaceStatus || {})[id] || "Not started";
      if (!cats[cat]) cats[cat] = { total: 0, created: 0, posted: 0, allCreated: false };
      cats[cat].total++;
      if (["Created","Reviewed","Delivered","Posted"].includes(st)) cats[cat].created++;
      if (st === "Posted") cats[cat].posted++;
    });
  });
  Object.keys(cats).forEach(k => { cats[k].allCreated = cats[k].total > 0 && cats[k].created === cats[k].total; });
  return cats;
}
