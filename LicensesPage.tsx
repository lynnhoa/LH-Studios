// ─────────────────────────────────────────────────────────────
// Licenses — where license to-dos are handled (the dashboard only
// shows counts). Each project's paid usage, organic usage and
// exclusivity, with Renew / Ignore / Taken down. Actions are saved.
// Colours: expiring = waiting, expired = late, active = done,
// organic / handled = neutral. initialFilter comes from the dashboard.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, PAL } from "./constants";
import { fmtD } from "./formatters";
import { Ico, IC } from "./PlannerWindows";
import RenewalModal from "./RenewalModal";
import { allLicenses, needsAction, ACTION_LABEL } from "./licenses";
import type { License } from "./licenses";

type Filter = "action" | "active" | "done" | "all";

interface LicensesProps {
  clients:       any[];
  clientsHook:   any;
  settings:      any;
  rc:            any;
  isMobile:      boolean;
  onAfterRenew?: (projectId: string) => void;
  initialFilter?: Filter | null;
}
type ToneSet = { fill: string; wash: string; mid: string; ink: string };

export default function Licenses({ clients, clientsHook, settings, rc, isMobile, onAfterRenew, initialFilter }: LicensesProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter || "action");
  useEffect(() => { if (initialFilter) setFilter(initialFilter); }, [initialFilter]);
  const [renewFor, setRenewFor] = useState<License | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const all = allLicenses(clients);
  const rows = filter === "action" ? all.filter(needsAction)
    : filter === "active" ? all.filter(l => l.state === "active" || l.state === "info")
    : filter === "done" ? all.filter(l => l.state === "done")
    : all;

  const act = async (l: License, action: string | null) => {
    setErr(null); setBusy(l.key + (action || "undo"));
    try { await clientsHook.setLicenseAction(l.clientId, l.projectId, l.key, action); }
    catch (e: any) { setErr(e?.message || "Couldn't save."); }
    finally { setBusy(null); }
  };

  if (renewFor) {
    const client = (clients || []).find((c: any) => c.id === renewFor.clientId);
    const pr = client?.projects.find((p: any) => p.id === renewFor.projectId);
    if (pr) return (
      <RenewalModal
        p={pr} rc={rc} settings={settings} client={client}
        onClose={() => setRenewFor(null)}
        onSave={async (r: any, doc: any) => {
          await clientsHook.addRenewalWithInvoice(client.id, pr.id, r, doc, settings);
          setRenewFor(null);
          if (onAfterRenew) onAfterRenew(pr.id);
        }}
      />
    );
  }

  const expired  = all.filter(l => l.state === "expired").length;
  const expiring = all.filter(l => l.state === "expiring").length;
  const count = (f: Filter) => f === "action" ? expired + expiring : f === "active" ? all.filter(l => l.state === "active" || l.state === "info").length : f === "done" ? all.filter(l => l.state === "done").length : all.length;
  const toneOf = (l: License): ToneSet => l.action || l.state === "done" || l.state === "info" ? PAL.neutral : l.state === "expired" ? PAL.late : l.state === "expiring" ? PAL.waiting : PAL.done;
  const iconOf = (l: License) => (l.kind === "excl" ? IC.lock : l.kind === "organic" ? IC.leaf : IC.speaker);
  const tagOf = (l: License) => l.action ? `${ACTION_LABEL[l.action.action] || l.action.action} · ${fmtD(l.action.at).slice(0, 6)}`
    : !l.alerts ? "info only" : l.daysLeft < 0 ? `${Math.abs(l.daysLeft)} days expired` : `${l.daysLeft} ${l.daysLeft === 1 ? "day" : "days"}`;
  const sumTone: ToneSet = expired ? PAL.late : expiring ? PAL.waiting : PAL.done;
  const chip = (f: Filter, label: string, dot?: string) => {
    const on = filter === f;
    const t: ToneSet = f === "action" ? PAL.waiting : f === "active" ? PAL.done : PAL.neutral;
    return (
      <button key={f} onClick={() => setFilter(f)} aria-pressed={on}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px", borderRadius: 15, border: `1px solid ${on ? (dot ? t.fill : "#d9d3cc") : C.rule}`, background: on ? (dot ? t.wash : PAL.neutral.fill) : C.white,
          color: on ? (dot ? t.ink : C.black) : "#4a4540", fontFamily: SANS, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
        {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}{label}
        <span style={{ fontSize: 11, color: on ? (dot ? t.ink : "#6b655e") : C.muted }}>{count(f)}</span>
      </button>
    );
  };
  const pillBtn = (label: string, onClick: () => void, dark = false, dim = false) => (
    <button onClick={onClick} style={{ height: 30, padding: "0 12px", borderRadius: 15, border: `1px solid ${dark ? C.black : "#e2ddd6"}`, background: dark ? C.black : C.white, color: dark ? C.white : C.black, fontFamily: SANS, fontSize: 12, cursor: "pointer", opacity: dim ? 0.5 : 1, whiteSpace: "nowrap" as const }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Licenses</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a847d", marginTop: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: sumTone.mid, flexShrink: 0 }} />
        {all.length} license{all.length === 1 ? "" : "s"} · <span style={{ color: expired || expiring ? sumTone.ink : C.black, fontWeight: 500 }}>
          {expired && expiring ? `${expired} expired · ${expiring} expiring` : expired ? `${expired} expired` : expiring ? `${expiring} expiring` : "nothing expiring"}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" as const, paddingBottom: 2 }}>
        {chip("action", "Needs action", PAL.waiting.mid)}{chip("active", "Active", PAL.done.mid)}{chip("done", "Done")}{chip("all", "All")}
      </div>
      {err && <p style={{ fontSize: 12, color: C.red, margin: "8px 0 0" }}>{err}</p>}
      {rows.length === 0 && (
        <p style={{ fontSize: 13, color: C.muted, margin: "16px 4px" }}>{filter === "action" ? "Nothing expiring in the next 14 days." : "No licenses here."}</p>
      )}
      {rows.length > 0 && (
        <div style={{ marginTop: 12, background: C.white, border: "1px solid #efebe6", borderRadius: 12, overflow: "hidden" }}>
          {rows.map((l, i) => {
            const t = toneOf(l);
            const acts = (l.alerts && !l.action) || !!l.action;
            return (
              <div key={`${l.projectId}-${l.key}`} style={{ padding: "8px 10px 8px 12px", borderTop: i ? "1px solid #f4f1ed" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 38 }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: t.wash, color: t.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={iconOf(l)} size={15} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{l.projectName}</div>
                    <div style={{ fontSize: 12, color: "#8a847d", marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{l.label} · {l.clientName}{l.extended ? " · renewed" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 13 }}>{fmtD(l.end)}</div>
                    <span style={{ display: "inline-block", fontSize: 10, letterSpacing: "0.03em", padding: "2px 8px", borderRadius: 9, marginTop: 3, background: t.fill, color: t.ink, whiteSpace: "nowrap" as const }}>{tagOf(l)}</span>
                  </div>
                </div>
                {acts && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, padding: "6px 0 2px 40px" }}>
                    {l.alerts && !l.action && pillBtn("Renew", () => setRenewFor(l), true)}
                    {l.alerts && !l.action && pillBtn("Taken down", () => act(l, "taken_down"), false, !!busy)}
                    {l.alerts && !l.action && pillBtn("Ignore", () => act(l, "ignored"), false, !!busy)}
                    {l.action && pillBtn("Undo", () => act(l, null))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
