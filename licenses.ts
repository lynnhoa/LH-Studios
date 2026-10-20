// ─────────────────────────────────────────────────────────────
// licenses — one place that knows every license of a project.
//   Paid usage   · from paid-ads lines, renewals, rights extensions
//   Organic usage· from organic lines (shown, never alarms)
//   Exclusivity  · from exclusivity lines, renewals, extensions
// Each kind is tracked on its own, so a short paid-ads license is
// never hidden behind a longer organic one. An action (ignored /
// taken down) belongs to one exact end date: after a renewal the
// new end date is tracked again.
// ─────────────────────────────────────────────────────────────

import { addM, dLeft } from "./formatters";
import { EXPIRY_WARN_DAYS } from "./constants";

export type LicenseKind = "paid" | "organic" | "excl";
export const LICENSE_LABEL: Record<LicenseKind, string> = { paid: "Paid usage", organic: "Organic usage", excl: "Exclusivity" };
export const ACTION_LABEL: Record<string, string> = { ignored: "Ignored", taken_down: "Taken down" };

export interface License {
  key:         string;              // `${kind}:${end}`
  kind:        LicenseKind;
  label:       string;
  end:         string;
  start:       string | null;     // when the rights started (delivery date) — for the time bar
  daysLeft:    number;
  extended:    boolean;             // renewed / extended at least once
  action:      { action: string; at: string } | null;
  state:       "active" | "expiring" | "expired" | "done" | "info";
  alerts:      boolean;             // organic usage never raises alarms
  projectId:   string;
  projectName: string;
  clientId:    string;
  clientName:  string;
}

const monthsOf = (label: any) => { const m = /(\d+)\s*month/i.exec(String(label || "")); return m ? parseInt(m[1]) : 0; };
const isExclText = (t: string) => /exclusiv|categor|full/i.test(t);

export function projectLicenses(pr: any, client?: any): License[] {
  if (!pr) return [];
  const ends: Record<LicenseKind, string[]> = { paid: [], organic: [], excl: [] };
  const extended: Record<LicenseKind, boolean> = { paid: false, organic: false, excl: false };
  const start = pr.deliveryDate || null;

  // 1) the quote + signed amendments (new deliverables)
  const lines = [
    ...(pr.qd?.lines || []),
    ...(pr.amendments || []).filter((a: any) => a.signed && a.doc?.kind !== "extension").flatMap((a: any) => a.lines || []),
  ];
  if (start) {
    lines.forEach((l: any) => {
      const u = String(l.usageLabel || "");
      const umo = Number(l.usageMo) || monthsOf(u);
      if (u && umo) ends[/organic/i.test(u) ? "organic" : "paid"].push(addM(start, umo));
      const e = String(l.exclLabel || "");
      const emo = Number(l.exclMo) || monthsOf(e);
      if (e && emo) ends.excl.push(addM(start, emo));
      // whitelisting / boosting (ads through your account) is paid usage for its months
      (Array.isArray(l.addonDetail) ? l.addonDetail : []).forEach((a: any) => {
        const wmo = Number(a?.months) || 0;
        if (wmo && /whitelist|boost/i.test(String(a?.n || ""))) ends.paid.push(addM(start, wmo));
      });
    });
  }
  // manual end date for the usage rights (project setting)
  if (pr.usageEndOverride) {
    if (ends.paid.length || !ends.organic.length) ends.paid = [pr.usageEndOverride];
    else ends.organic = [pr.usageEndOverride];
  }

  // 2) renewals (not those whose invoice was cancelled)
  (pr.renewals || []).forEach((r: any) => {
    const inv = (pr.documents || []).find((d: any) => d.renewalId === r.id && d.subtype === "renewal");
    if (inv && inv.status === "cancelled") return;
    const lbl = String(r.optLabel || "");
    const uEnd = r.usageEnd || (!r.exclEnd && !isExclText(lbl) ? r.endDate : null);
    const eEnd = r.exclEnd || (!r.usageEnd && isExclText(lbl) ? r.endDate : null);
    if (uEnd) { const k: LicenseKind = /organic/i.test(lbl) ? "organic" : "paid"; ends[k].push(uEnd); extended[k] = true; }
    if (eEnd) { ends.excl.push(eEnd); extended.excl = true; }
  });

  // 3) signed rights extensions (amendment from the rights builder)
  (pr.amendments || []).filter((a: any) => a.signed && a.doc?.kind === "extension").forEach((a: any) => {
    const names = (a.lines || []).map((l: any) => String(l.name || "")).join(" ");
    if (a.doc.usageEnd) { const k: LicenseKind = /organic/i.test(names) ? "organic" : "paid"; ends[k].push(a.doc.usageEnd); extended[k] = true; }
    if (a.doc.exclEnd) { ends.excl.push(a.doc.exclEnd); extended.excl = true; }
  });

  return (Object.keys(ends) as LicenseKind[]).filter(k => ends[k].length).map(kind => {
    const end = ends[kind].reduce((a, b) => (a > b ? a : b));
    const key = `${kind}:${end}`;
    const action = pr.licenseState?.[key] || null;
    const daysLeft = dLeft(end) ?? 0;
    const alerts = kind !== "organic";
    const state: License["state"] = !alerts ? "info"
      : action ? "done"
      : daysLeft < 0 ? "expired"
      : daysLeft <= EXPIRY_WARN_DAYS ? "expiring"
      : "active";
    return {
      key, kind, label: LICENSE_LABEL[kind], end, start: start || null, daysLeft, extended: extended[kind], action, state, alerts,
      projectId: pr.id, projectName: pr.name, clientId: client?.id || pr.clientId, clientName: client?.name || "",
    };
  });
}

export function allLicenses(clients: any[]): License[] {
  return (clients || []).flatMap((c: any) => (c.projects || []).flatMap((pr: any) => projectLicenses(pr, c)))
    .sort((a, b) => a.end.localeCompare(b.end));
}

export const needsAction = (l: License) => l.state === "expiring" || l.state === "expired";
