// ─────────────────────────────────────────────────────────────
// Licenses — where license to-dos are handled (the dashboard only
// shows counts). Each project's paid usage, organic usage and
// exclusivity, with Renew / Ignore / Taken down. Actions are saved.
// Grouped by urgency: expired · ends within 14 days · active · info
// only (organic) · handled. A time bar shows how much of the license
// period has passed (delivery date → end). Colours: expiring = waiting,
// expired = late, active = done, organic / handled = neutral.
// initialFilter comes from the dashboard.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, PAL, TYPE } from "./constants";
import { fmtD } from "./formatters";
import { Ico, IC } from "./PlannerWindows";
import { Chip, ChipRow, SummaryLine, SectionHead, ListCard, IconCircle, TonedTag, PillBtn, TimeBar } from "./atoms";
import { today } from "./formatters";
import RenewalModal from "./RenewalModal";
import PDFModal from "./PDFModal";
import { pdfFlow, invoiceActions } from "./docFlow";
import { allLicenses, needsAction, ACTION_LABEL , licenseTone, licenseTag } from "./licenses";
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
  const [openDoc, setOpenDoc] = useState<null | { cid: string; pid: string; id: string }>(null);   // the renewal's invoice

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
          const d = await clientsHook.addRenewalWithInvoice(client.id, pr.id, r, doc, settings);
          setRenewFor(null);
          setOpenDoc({ cid: client.id, pid: pr.id, id: d.id });          // its invoice draft opens right here
        }}
      />
    );
  }

  // the renewal's invoice, opened right after saving — the same window and actions as in Projects
  if (openDoc) {
    const oc = (clients || []).find((c: any) => c.id === openDoc.cid);
    const op = oc?.projects.find((p: any) => p.id === openDoc.pid);
    const d = op && (op.documents || []).find((x: any) => x.id === openDoc.id);
    if (d) {
      const flow = pdfFlow(clientsHook, openDoc.cid, openDoc.pid, settings);
      return (
        <PDFModal key={d.id} doc={d} settings={settings} client={oc} editable={d.status === "draft"}
          note={d.status === "draft" ? "Draft — Send to client gives it its number (you're asked first)." : undefined}
          onSave={async (next) => clientsHook.updateDocument(openDoc.cid, openDoc.pid, d.id, next, settings)}
          onPdf={flow.prepare} pdfConfirm={flow.confirmFor} sendBlock={flow.blockFor}
          actions={invoiceActions(clientsHook, openDoc.cid, openDoc.pid, d, settings, { storno: (id) => setOpenDoc({ ...openDoc, id }), deleted: () => setOpenDoc(null) })}
          onClose={() => setOpenDoc(null)} />
      );
    }
  }

  const expired  = all.filter(l => l.state === "expired").length;
  const expiring = all.filter(l => l.state === "expiring").length;
  const count = (f: Filter) => f === "action" ? expired + expiring : f === "active" ? all.filter(l => l.state === "active" || l.state === "info").length : f === "done" ? all.filter(l => l.state === "done").length : all.length;
  const toneOf = (l: License): ToneSet => licenseTone(l);          // licenses.ts — the same tag in Projects
  const iconOf = (l: License) => (l.kind === "excl" ? IC.lock : l.kind === "organic" ? IC.leaf : IC.speaker);
  const tagOf = (l: License) => licenseTag(l);
  // how much of the license period has passed (delivery date → end)
  const todayMs = Date.parse(today());
  const elapsed = (l: License): number | null => {
    if (l.state === "expired") return 100;
    if (!l.start) return null;
    const a = Date.parse(l.start), b = Date.parse(l.end);
    return b > a ? Math.max(0, Math.min(100, ((todayMs - a) / (b - a)) * 100)) : null;
  };
  const GROUPS: { key: string; label: string; tone: ToneSet; pick: (l: License) => boolean }[] = [
    { key: "expired", label: "Expired",             tone: PAL.late,    pick: l => l.state === "expired" },
    { key: "soon",    label: "Ends within 14 days", tone: PAL.waiting, pick: l => l.state === "expiring" },
    { key: "active",  label: "Active",              tone: PAL.done,    pick: l => l.state === "active" },
    { key: "info",    label: "Info only",           tone: PAL.neutral, pick: l => l.state === "info" },
    { key: "done",    label: "Handled",             tone: PAL.neutral, pick: l => l.state === "done" },
  ];
  const shown = filter === "action" ? ["expired", "soon"] : filter === "active" ? ["active", "info"] : filter === "done" ? ["done"] : GROUPS.map(g => g.key);
  const groups = GROUPS.filter(g => shown.includes(g.key)).map(g => ({ ...g, items: all.filter(g.pick) })).filter(g => g.items.length);
  const sumTone: ToneSet = expired ? PAL.late : expiring ? PAL.waiting : PAL.done;

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Licenses</h2>
      <SummaryLine dot={sumTone.mid}>
        {all.length} license{all.length === 1 ? "" : "s"} ·{" "}
        {expired ? <span style={{ color: PAL.late.ink, fontWeight: 500 }}>{expired} expired</span> : null}
        {expired && expiring ? " · " : null}
        {expiring ? <span style={{ color: PAL.waiting.ink, fontWeight: 500 }}>{expiring} expiring</span> : null}
        {!expired && !expiring ? <span style={{ color: C.black, fontWeight: 500 }}>nothing expiring</span> : null}
      </SummaryLine>
      <ChipRow s={{ marginTop: 12 }}>
        <Chip on={filter === "action"} tone={PAL.waiting} label="Needs action" count={count("action")} onClick={() => setFilter("action")} />
        <Chip on={filter === "active"} tone={PAL.done} label="Active" count={count("active")} onClick={() => setFilter("active")} />
        <Chip on={filter === "done"} tone={PAL.neutral} dot={false} label="Done" count={count("done")} onClick={() => setFilter("done")} />
        <Chip on={filter === "all"} tone={PAL.neutral} dot={false} label="All" count={count("all")} onClick={() => setFilter("all")} />
      </ChipRow>
      {err && <p style={{ fontSize: TYPE.subtext.size, color: C.red, margin: "8px 0 0" }}>{err}</p>}
      {groups.length === 0 && (
        <p style={{ fontSize: TYPE.row.size, color: C.muted, margin: "16px 4px" }}>{filter === "action" ? "Nothing expiring in the next 14 days." : "No licenses here."}</p>
      )}
      {groups.map(g => (
        <div key={g.key}>
          <SectionHead dot={g.tone.mid} label={`${g.label} · ${g.items.length}`} />
          <ListCard>
            {g.items.map((l, i) => {
              const t = toneOf(l);
              const pct = l.state === "done" ? null : elapsed(l);
              const acts = (l.alerts && !l.action) || !!l.action;
              return (
                <div key={`${l.projectId}-${l.key}`} style={{ padding: "8px 10px 9px 12px", borderTop: i ? `1px solid ${C.hair}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 38 }}>
                    <IconCircle tone={t}><Ico d={iconOf(l)} size={15} /></IconCircle>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: TYPE.body.size, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{l.projectName}</div>
                      <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{l.label} · {l.clientName}{l.extended ? " · renewed" : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                      {!l.action && <div style={{ fontSize: TYPE.row.size }}>{fmtD(l.end)}</div>}
                      <TonedTag tone={t} s={{ marginTop: 3 }}>{tagOf(l)}</TonedTag>
                    </div>
                  </div>
                  {pct != null && <TimeBar pct={pct} color={t.mid} s={{ margin: "7px 0 0 40px" }} />}
                  {acts && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, padding: "8px 0 0 40px" }}>
                      {l.alerts && !l.action && <PillBtn dark onClick={() => setRenewFor(l)}>Renew</PillBtn>}
                      {l.alerts && !l.action && <PillBtn dim={!!busy} onClick={() => act(l, "taken_down")}>Taken down</PillBtn>}
                      {l.alerts && !l.action && <PillBtn dim={!!busy} onClick={() => act(l, "ignored")}>Ignore</PillBtn>}
                      {l.action && <PillBtn onClick={() => act(l, null)}>Undo</PillBtn>}
                    </div>
                  )}
                </div>
              );
            })}
          </ListCard>
        </div>
      ))}
    </div>
  );
}
