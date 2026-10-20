// ─────────────────────────────────────────────────────────────
// wsHelpers — shared workspace / creator utilities
// Used by CreatorWorkspace, CreatorProjects, CreatorClients,
// CreatorDashboard
// ─────────────────────────────────────────────────────────────

import { catInfo } from "./constants";
import { addM, addD, today } from "./formatters";

// ── One status rule for Creator and Manager ───────────────────
// Not started → Created → Delivered → Posted. An item is DONE when it
// reached its category's last step: Brand Collab is posted by the
// creator (Posted); UGC + Editorial are handed over (Delivered — a
// later Posted still counts as done). Old "Reviewed" = Created.
export const WS_STATUSES = ["Not started", "Created", "Delivered", "Posted"] as const;
const RANK: Record<string, number> = { "Not started": 0, "Created": 1, "Reviewed": 1, "Finished": 2, "Delivered": 2, "Posted": 3 };
export const statusRank  = (st: string) => RANK[st] ?? 0;
export const shownStatus = (st: string) => (st === "Reviewed" ? "Created" : st === "Finished" ? "Delivered" : st || "Not started");
export const finalStatus = (cat: string) => (cat === "Influencer" || cat === "Hotels" ? "Posted" : "Delivered");
export const isDoneStatus = (st: string, cat: string) => statusRank(st) >= statusRank(finalStatus(cat));
export const doneWord     = (cat: string) => (cat === "Influencer" || cat === "Hotels" ? "posted" : "delivered");

// ── Category helpers ──────────────────────────────────────────
// Accepts the full line object (preferred) or a bare name string (legacy).
// Authoritative source: `cat` chosen in the Calculator and stored on the
// line — Brand Collab → Influencer, UGC → UGC, Editorial → Editorial.
// Name-keyword heuristic remains only as fallback for old lines without `cat`.
export function getWsCategory(ln: any): string {
  const c = (typeof ln === "object" && ln ? ln.cat || "" : "").toLowerCase();
  if (c === "ugc")       return "UGC";
  if (c === "editorial") return "Editorial";
  if (c === "hotels")     return "Hotels";
  if (c === "influencer") return "Influencer";
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
// one entry per included deliverable; deliverables of SIGNED
// amendments are added once; a retainer repeats its lines for every
// month that has started. Item ids: `${key}_q${n}` (month 1 keeps
// the old ids, so existing ticks stay).
const SKIP = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];

export interface WorkLine { key: string; li: number; name: string; note: string; qty: number; cat: string; line: any; month?: number; deadline?: string | null; }

const pad2 = (n: number) => String(n).padStart(2, "0");

export function retainerMonths(pr: any): { m: number; start: string; end: string }[] {
  const retMo = Number(pr?.qd?.retMo) || 0;
  if (!pr?.qd?.retainer || !retMo) return [];
  const from = (pr.statusHistory || []).find((h: any) => h.status === "production")?.at || pr.date || today();
  const out: { m: number; start: string; end: string }[] = [];
  for (let m = 1; m <= retMo; m++) {
    const start = addM(from, m - 1);
    if (m > 1 && start > today()) break;
    out.push({ m, start, end: addD(addM(from, m), -1) });
  }
  return out;
}

export function wsLines(pr: any): WorkLine[] {
  const out: WorkLine[] = [];
  const add = (ln: any, li: number, prefix: string, source: string, month?: number, deadline?: string | null) => {
    if (!ln?.name) return;
    if (SKIP.some(s => ln.name.toLowerCase().includes(s))) return;
    const qty  = parseInt(ln.qty) || 1;
    const incl = Array.isArray(ln.includes) ? ln.includes.filter((x: any) => x && x.n) : [];
    const mTag = month ? `M${pad2(month)}` : "";
    // content add-ons (extra Story frames, images, video cuts, hooks, formats) are work too —
    // one item per piece, own keys (lines from before have no add-on keys, so nothing changes there)
    const addAddons = () => (Array.isArray(ln.addonDetail) ? ln.addonDetail : []).forEach((a: any) => {
      if (!a?.work || !a?.key || !a?.n) return;
      out.push({ key: `${prefix}_ln${li}_ad${a.key}`, li, name: a.n, note: [mTag, source, `Add-on · ${ln.name}`].filter(Boolean).join(" · "),
        qty: Math.max(1, Math.round(Number(a.count) || 1)), cat: ln.cat, line: { ...ln, name: a.n }, month, deadline });
    });
    if (ln.kind === "package" && incl.length) {
      incl.forEach((inc: any, k: number) => {
        out.push({ key: `${prefix}_ln${li}_p${k}`, li, name: inc.n, note: [mTag, source, ln.name].filter(Boolean).join(" · "), qty: (parseInt(inc.qty) || 1) * qty, cat: ln.cat, line: { ...ln, name: inc.n }, month, deadline });
      });
      addAddons();
      return;
    }
    out.push({ key: `${prefix}_ln${li}`, li, name: ln.name, note: [mTag, source, ln.note || ""].filter(Boolean).join(" · "), qty, cat: ln.cat, line: ln, month, deadline });
    addAddons();
  };
  const months = retainerMonths(pr);
  if (months.length) {
    months.forEach(({ m, end }) => (pr?.qd?.lines || []).forEach((ln: any, li: number) => add(ln, li, m === 1 ? `${pr.id}` : `${pr.id}_m${m}`, "", m, end)));
  } else {
    (pr?.qd?.lines || []).forEach((ln: any, li: number) => add(ln, li, `${pr.id}`, ""));
  }
  (pr?.amendments || []).filter((a: any) => a.signed && a.doc?.kind !== "extension").forEach((a: any) => {
    (a.lines || []).forEach((ln: any, li: number) => add(ln, li, `${pr.id}_a${a.id}`, a.aNo || "Amendment"));
  });
  return out;
}

export const wsItemIds = (w: WorkLine): string[] => Array.from({ length: w.qty }, (_, q) => `${w.key}_q${q}`);

// Date the item reached its final step (only while it is still done)
export function doneDateOf(pr: any, id: string, cat: string): string | null {
  const st = (pr?.workspaceStatus || {})[id] || "Not started";
  if (!isDoneStatus(st, cat)) return null;
  const hist = ((pr?.workspaceStatusHistory || {})[id] || []) as any[];
  const hit = [...hist].reverse().find(h => isDoneStatus(h.status, cat));
  return hit?.date || null;
}

// ── Every work item of one project (any project status) ───────
// removed items (status "Removed") are left out unless asked for (Projects › Production lists them to restore)
export function projectItems(pr: any, c?: any, withRemoved = false): any[] {
  const items: any[] = [];
  wsLines(pr).forEach(w => {
    wsItemIds(w).forEach((id, q) => {
      const defaultName = w.name + (w.qty > 1 ? ` ${q + 1}` : "") + (w.month ? ` · M${pad2(w.month)}` : "");
      const category = (pr.workspaceCats || {})[id] || getWsCategory(w.line);
      const status = (pr.workspaceStatus || {})[id] || "Not started";
      if (status === "Removed" && !withRemoved) return;
      items.push({
        id, lineKey: w.key, lineName: w.name, month: w.month || null,
        name:        (pr.workspaceNames || {})[id] || defaultName,
        defaultName,
        lineNote:    w.note || "",
        clientId:    c?.id || pr.clientId,
        clientName:  c?.name || "",
        projectId:   pr.id,
        projectName: pr.name,
        deadline:    (pr.workspacePlanner || {})[id] || w.deadline || pr.deliveryDate || null,
        ownDate:     (pr.workspacePlanner || {})[id] || null,
        history:     (pr.workspaceStatusHistory || {})[id] || [],
        category,
        status,
        done:        isDoneStatus(status, category),
        doneDate:    doneDateOf(pr, id, category),
        notes:       (pr.workspaceNotes || {})[id] || "",
      });
    });
  });
  return items.filter(it => !(pr.workspaceDeleted || []).includes(it.id));
}

// ── Line groups (Creator projects / clients views) ────────────
export function getLineGroups(c: any, pr: any): any[] {
  const groups: any[] = [];
  projectItems(pr, c).forEach(it => {
    const lineKey = `${it.lineKey}_${it.category}`;
    let grp = groups.find(g => g.lineKey === lineKey);
    if (!grp) { grp = { lineKey, lineName: it.lineName + (it.month ? ` · M${pad2(it.month)}` : ""), category: it.category, items: [] }; groups.push(grp); }
    grp.items.push(it);
  });
  return groups;
}

// ── Workspace items (projects in production) ──────────────────
// One rule for open work: in production, or invoiced (not paid) with items still open.
// The Creator's Workspace and the Manager's Production section (Projects) both use it.
export const workOpen = (pr: any): boolean =>
  pr?.status === "production" || (pr?.status === "invoiced" && !pr?.paid && projectItems(pr).some((it: any) => !it.done));

export function getWsItems(clients: any[]): any[] {
  return (clients || []).flatMap((c: any) => (c.projects || [])
    .filter(workOpen)
    // after invoicing, open items stay until they're done
    .flatMap((pr: any) => projectItems(pr, c).filter((it: any) => pr.status === "production" || !it.done)));
}

// ── Done items across all projects (dashboard output) ─────────
export function allDoneItems(clients: any[]): any[] {
  return (clients || []).flatMap((c: any) => (c.projects || [])
    .filter((pr: any) => ["production", "invoiced", "paid"].includes(pr.status) || pr.paid)
    .flatMap((pr: any) => projectItems(pr, c)))
    .filter(it => it.done && it.doneDate)
    .sort((a, b) => String(b.doneDate).localeCompare(String(a.doneDate)));
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

// ── Category progress per project (Manager production box) ────
export interface CatProgress { total: number; created: number; done: number; allCreated: boolean; allDone: boolean; doneDate: string | null; }
export function getCatProgress(pr: any, _clients?: any[]): Record<string, CatProgress> {
  const cats: Record<string, CatProgress> = {};
  projectItems(pr).forEach(it => {
    const c = cats[it.category] || (cats[it.category] = { total: 0, created: 0, done: 0, allCreated: false, allDone: false, doneDate: null });
    c.total++;
    if (statusRank(it.status) >= 1) c.created++;
    if (it.done) { c.done++; if (it.doneDate && (!c.doneDate || it.doneDate > c.doneDate)) c.doneDate = it.doneDate; }
  });
  Object.values(cats).forEach(c => { c.allCreated = c.total > 0 && c.created === c.total; c.allDone = c.total > 0 && c.done === c.total; if (!c.allDone) c.doneDate = null; });
  return cats;
}

// ── card of a workspace category (colors come from the rate cards) ─
export const WS_CATS = ["Influencer", "UGC", "Editorial", "Hotels"] as const;
export const WS_CAT_LABEL: Record<string, string> = { Influencer: "Brand Collab", UGC: "UGC", Editorial: "Editorial", Hotels: "Hotels" };
export const cardKeyOfCat = (cat: string) => (cat === "UGC" ? "ugc" : cat === "Editorial" ? "editorial" : cat === "Hotels" ? "hotels" : "influencer");
// one rule everywhere: "in production" = signed work
export const isInProduction = (pr: any) => pr.status === "production";
