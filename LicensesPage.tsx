// ─────────────────────────────────────────────────────────────
// Licenses — where license to-dos are handled (the dashboard only
// shows counts). Each project's paid usage, organic usage and
// exclusivity, with Renew / Ignore / Taken down. Actions are saved.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE, expiryColor } from "./constants";
import { fmtD } from "./formatters";
import { B, Segmented } from "./atoms";
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
}

export default function Licenses({ clients, clientsHook, settings, rc, isMobile, onAfterRenew }: LicensesProps) {
  const [filter, setFilter] = useState<Filter>("action");
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

  const daysText = (l: License) => l.daysLeft < 0 ? `${Math.abs(l.daysLeft)} d expired` : `${l.daysLeft} d left`;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 4px", color: C.black }}>Licenses</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>Usage rights + exclusivity</p>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Segmented<Filter>
          options={[["action", `Needs action · ${all.filter(needsAction).length}`], ["active", "Active"], ["done", "Done"], ["all", "All"]]}
          value={filter} onChange={setFilter} />
      </div>
      {err && <p style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 10px" }}>{err}</p>}
      {rows.length === 0 && (
        <p style={{ fontSize: TYPE.label.size, color: C.muted }}>
          {filter === "action" ? "Nothing expiring in the next 14 days." : "No licenses here."}
        </p>
      )}
      {rows.map(l => {
        const col = l.state === "done" || l.state === "info" ? C.muted : expiryColor(l.daysLeft);
        return (
          <div key={`${l.projectId}-${l.key}`} style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.rule}`, flexDirection: isMobile ? "column" as const : "row" as const }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 2px" }}>{l.clientName} · {l.projectName}</p>
              <p style={{ fontSize: TYPE.body.size, color: C.black, margin: 0, fontFamily: SANS }}>
                {l.label}{l.extended ? <span style={{ fontSize: TYPE.micro.size, color: C.light }}> · renewed</span> : null}
              </p>
            </div>
            <div style={{ textAlign: isMobile ? "left" as const : "right" as const, minWidth: 130 }}>
              <p style={{ fontSize: TYPE.label.size, color: col, margin: 0, fontWeight: 500 }}>{fmtD(l.end)}</p>
              <p style={{ fontSize: TYPE.micro.size, color: col, margin: 0 }}>
                {l.action ? `${ACTION_LABEL[l.action.action] || l.action.action} · ${fmtD(l.action.at)}` : l.alerts ? daysText(l) : "info only"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {l.alerts && !l.action && <B s={{ minHeight: 34, padding: "0 12px", fontSize: TYPE.micro.size }} onClick={() => setRenewFor(l)}>Renew</B>}
              {l.alerts && !l.action && <B v="sec" s={{ minHeight: 34, padding: "0 12px", fontSize: TYPE.micro.size, opacity: busy ? 0.5 : 1 }} onClick={() => act(l, "taken_down")}>Taken down</B>}
              {l.alerts && !l.action && <B v="sec" s={{ minHeight: 34, padding: "0 12px", fontSize: TYPE.micro.size, opacity: busy ? 0.5 : 1 }} onClick={() => act(l, "ignored")}>Ignore</B>}
              {l.action && <B v="sec" s={{ minHeight: 34, padding: "0 12px", fontSize: TYPE.micro.size }} onClick={() => act(l, null)}>Undo</B>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
