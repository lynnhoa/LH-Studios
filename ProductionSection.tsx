// ─────────────────────────────────────────────────────────────
// ProductionSection — Manager view of a project's production.
// Uses the SAME items and done rule as the Creator Workspace:
//   Brand Collab is done when posted; UGC + Editorial when delivered.
// Manager ticks per category:
//   reviewed  — a note for the category (can be unticked)
//   delivered — UGC / Editorial: marks the category's items Delivered
//               (never turns Posted back into Delivered); unticking
//               undoes exactly the items this tick changed.
//   all posted / all delivered — automatic, read only, with its date.
// ─────────────────────────────────────────────────────────────

import { C, SANS, TYPE, PAL, TRACK } from "./constants";
import { fmtD, today } from "./formatters";
import { getCatProgress, projectItems, statusRank, doneWord, finalStatus, shownStatus, WS_CAT_LABEL } from "./wsHelpers";
import { ListCard, TonedTag } from "./atoms";
import { catTone, statusTone, Tick2 } from "./CreatorShared";
import { showUndo } from "./undo";

interface ProductionSectionProps {
  pr:           any;
  clients:      any[];
  cl:           { id: string; name: string };
  upP:          (data: any) => void;
  isMobile:     boolean;
  clientsHook?: any;
}

// Projects › Production in the Workspace's look: per card a line with its pastel tag, how many
// are done and the Manager's toggles (Reviewed · Delivered), then one row per item with the
// same two ticks (Created · Done) and status tag as in the Creator's Workspace.
export default function ProductionSection({ pr, cl, upP, clientsHook }: ProductionSectionProps) {
  const removed = projectItems(pr, cl, true).filter((it: any) => it.status === "Removed");
  const cats    = getCatProgress(pr);
  const catKeys = Object.keys(cats).filter(k => cats[k].total > 0);
  if (catKeys.length === 0 && removed.length === 0) return null;     // (removed items stay restorable)
  const ms    = pr.managerStatus || {};
  const items = projectItems(pr, cl);
  const nDone = items.filter((it: any) => it.done).length;

  const setFlag = (cat: string, field: string, on: boolean) => {
    const k = cat.toLowerCase();
    const cur = { ...(ms[k] || {}) };
    if (on) { cur[field] = true; cur[field + "Date"] = today(); } else { delete cur[field]; delete cur[field + "Date"]; }
    upP({ managerStatus: { ...ms, [k]: cur } });
  };
  const markDelivered = async (cat: string) => {
    const todo = items.filter((it: any) => it.category === cat && statusRank(it.status) < statusRank("Delivered"));
    if (clientsHook?.setWsStatus) await clientsHook.setWsStatus(cl.id, pr.id, todo.map((it: any) => ({ id: it.id, status: "Delivered" })), "manager");
    setFlag(cat, "delivered", true);
  };
  const undoDelivered = async (cat: string) => {
    // only the items whose last step was this manager tick go back
    const mine = items.filter((it: any) => it.category === cat && it.status === "Delivered" &&
      (((pr.workspaceStatusHistory || {})[it.id] || []).slice(-1)[0]?.by === "manager"));
    if (clientsHook?.revertWsStatus) await clientsHook.revertWsStatus(cl.id, pr.id, mine.map((it: any) => it.id));
    setFlag(cat, "delivered", false);
  };

  // one tick = one step, as in the Workspace; Undo takes exactly that step back
  const setStatus = async (it: any, status: string, label: string) => {
    if (!clientsHook?.setWsStatus) return;
    try {
      await clientsHook.setWsStatus(cl.id, pr.id, [{ id: it.id, status }], "manager");
      showUndo(label, () => clientsHook.revertWsStatus(cl.id, pr.id, [it.id], status));
    } catch { /* the save message reports it */ }
  };
  const toggleCreated = (it: any) => setStatus(it, statusRank(it.status) >= 1 ? "Not started" : "Created", statusRank(it.status) >= 1 ? "Back to not started" : "Marked created");
  const toggleDone = (it: any) => setStatus(it, it.done ? "Created" : finalStatus(it.category), it.done ? "Back to created" : `Marked ${finalStatus(it.category).toLowerCase()}`);

  const dm = (d?: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : "");
  const CAPS: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted };
  const toggle = (label: string, on: boolean, enabled: boolean, run: () => void, aria: string) => (
    <button onClick={enabled ? run : undefined} aria-pressed={on} aria-label={aria} aria-disabled={!enabled}
      style={{ height: 26, padding: "0 10px", borderRadius: 13, fontFamily: SANS, fontSize: TYPE.label.size, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" as const,
        border: `1px solid ${on ? PAL.done.mid : C.rule}`, background: on ? PAL.done.wash : C.white, color: on ? PAL.done.ink : C.ink2, cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.45 }}>
      {on ? "✓ " : ""}{label}
    </button>
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px" }}>
        <span style={CAPS}>Production</span><span style={CAPS}>{nDone} of {items.length} done</span>
      </div>

      {catKeys.map(cat => {
        const prog  = cats[cat];
        const msc   = ms[cat.toLowerCase()] || {};
        const name  = WS_CAT_LABEL[cat] || cat;
        // Brand Collab and Hotels finish when posted (the Workspace's rule): no "Delivered" toggle
        const postedCat = finalStatus(cat) === "Posted";
        const catIt = items.filter((it: any) => it.category === cat);
        const nd    = catIt.filter((it: any) => it.done).length;
        return (
          <div key={cat}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const, margin: "12px 2px 7px" }}>
              <TonedTag tone={catTone(cat)}>{name}</TonedTag>
              <span style={{ flex: 1, minWidth: 70, fontSize: TYPE.subtext.size, color: C.muted }}>{nd} of {catIt.length} {doneWord(cat)}</span>
              {toggle("Reviewed", !!msc.reviewed, prog.allCreated || !!msc.reviewed, () => setFlag(cat, "reviewed", !msc.reviewed), `Reviewed: ${name}`)}
              {!postedCat && toggle("Delivered", !!msc.delivered, prog.allCreated || !!msc.delivered, () => (msc.delivered ? undoDelivered(cat) : markDelivered(cat)), `Delivered: ${name}`)}
            </div>
            <ListCard>
              {catIt.map((it: any, i: number) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 54, padding: "0 10px 0 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <Tick2 on={statusRank(it.status) >= 1} tone={PAL.progress} label={`Created: ${it.name}`} onClick={() => toggleCreated(it)} />
                  <span style={{ marginLeft: -10 }}><Tick2 on={it.done} tone={PAL.done} label={`Done: ${it.name}`} onClick={() => toggleDone(it)} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: TYPE.row.size, color: C.black, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                    <div style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{it.done ? `${doneWord(cat)} ${dm(it.doneDate)}`.trim() : it.deadline ? `due ${dm(it.deadline)}` : ""}</div>
                  </div>
                  <TonedTag tone={statusTone(it.status, it.done)}>{shownStatus(it.status)}</TonedTag>
                </div>
              ))}
            </ListCard>
          </div>
        );
      })}

      {/* items removed in the Creator's Workspace: listed here, one tap brings each back */}
      {removed.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {removed.map((it: any, i: number) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, padding: "0 2px", fontSize: TYPE.subtext.size, color: C.muted }}>
              {i === 0 ? <span style={CAPS}>Removed · {removed.length}</span> : <span style={{ ...CAPS, visibility: "hidden" as const }}>Removed · {removed.length}</span>}
              <span style={{ flex: 1, minWidth: 0, textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{it.name}</span>
              <button onClick={() => clientsHook?.revertWsStatus?.(cl.id, pr.id, [it.id], "Removed")}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size, color: C.black, textDecoration: "underline", minHeight: 36, padding: "0 4px" }}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
