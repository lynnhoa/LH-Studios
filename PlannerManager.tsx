// ─────────────────────────────────────────────────────────────
// PlannerManager — Planner › Manager (his workspace), one account.
// Four cards, everything typed right here (no windows):
//   Account snapshot · followers, views, engagement % — or the
//     Prompt: screenshot → Claude → SQL
//   Following · follow-backs (the only number that counts)
//   Community · the 7 days
//   New emails · counted from Outreach (just the number)
// Each card shows its goal status; the week line sums them up.
// Stage 2 adds the sprint and the pitch log.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { C, SANS, SERIF, TYPE, Z } from "./constants";
import { B, BAR_BTN } from "./atoms";
import {
  DAY_SHORT, OWNER_LOOK, TONE, isVisible, snapKey, entryKey, periodOf, stageNumOf, todayIndex, goalStatus,
  weekRange, fmtInt, fmtPct2, addDays, isoWeek, snapshotPrompt, thisMonday,
} from "./planner";
import type { Task, Account, GoalStatus } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { OUTREACH_TIERS, copyText } from "./outreach";
import { fmtD, today } from "./formatters";
import { Ico, IC, Bar, Toolbar, Subtitle, CatChip, NumField, SprintWindow, sprintRange, sprintDay } from "./PlannerWindows";

const microLabel: any = { fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.muted };
const look = OWNER_LOOK.manager;

interface PlannerManagerProps {
  planner:   PlannerHook;
  view:      PlannerView;
  setView:   (v: PlannerView) => void;
  monday:    string;
  setMonday: (m: string) => void;
  isMobile:  boolean;
  openOutreach?: () => void;
  openTab?:  (tab: string, anchor?: string) => void;
}

export default function PlannerManager({ planner, view, monday, setMonday, isMobile, openOutreach }: PlannerManagerProps) {
  const { stages, tasks, loading, loadError } = planner;
  const [openSprint, setOpenSprint] = useState<{ id?: string; acc?: Account } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

  const acc     = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const visible = tasks.filter(t => isVisible(t, stages, view.acc));
  const bySource = (src: string) => visible.find(t => t.source === src && (t.account === acc || t.account === "both"));
  const snapT   = bySource("snapshot");
  const followT = bySource("following");
  const emailT  = bySource("outreach");
  const commT   = visible.find(t => t.area === "community" && t.rhythm === "daily" && (t.account === acc || t.account === "both"));
  const ti      = todayIndex(monday);
  const stage2  = stageNumOf(stages, acc) >= 2;
  const sprintW = stages.find(s => s.num === 2 && s.account === acc)?.sprintWeeks ?? 2;

  // the week line: his weekly goals
  const his = visible.filter(t => t.phase === "maintain" && t.owner === "manager" && t.rhythm !== "monthly");
  const reached = his.filter(t => planner.stateOf(t, monday).done).length;

  // ── pieces ──────────────────────────────────────────────────
  const card: any = { background: C.white, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, overflow: "hidden" };
  const statusTag = (s: GoalStatus | null) => !s ? null : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: TONE[s.tone], whiteSpace: "nowrap" as const }}>
      {s.tone === "attn" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE.attn }} />}{s.text}
    </span>
  );
  const band = (title: string, right: any) => (
    <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", background: look.bg, color: look.color, ...microLabel }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: look.color }} />{title}</span>
      {right}
    </div>
  );
  const hint = (t: string) => <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0", lineHeight: 1.4 }}>{t}</p>;
  const body: any = { padding: "10px 12px 12px" };
  const grid3: any = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, marginTop: -8 };

  // ── account snapshot ────────────────────────────────────────
  const sn   = planner.snaps[snapKey(acc, monday)];
  const prev = planner.snaps[snapKey(acc, addDays(monday, -7))];
  const snapStatus: GoalStatus = snapT ? goalStatus(snapT, planner.stateOf(snapT, monday), monday)!
    : (sn && (sn.followers != null || sn.views != null || sn.engagement != null)) ? { text: "Entered ✓", tone: "ok" } : { text: "Enter", tone: "attn" };
  const diff = sn?.followers != null && prev?.followers != null ? sn.followers - prev.followers : null;
  const saveSnap = (patch: any) => quiet(planner.saveSnapshot(acc, monday, patch));
  const copyPrompt = async () => {
    const ok = await copyText(snapshotPrompt(acc, monday, planner.loginEmail));
    setToast(ok ? "Prompt copied ✓ — paste it into Claude with your screenshot" : "Couldn't copy");
  };
  const snapshotCard = (
    <div id="card-snapshot" style={card}>
      {band("Account snapshot", statusTag(snapStatus))}
      <div style={body}>
        <div style={grid3}>
          <NumField label="Followers" value={sn?.followers ?? null} onSave={v => saveSnap({ followers: v })} />
          <NumField label="Views" value={sn?.views ?? null} onSave={v => saveSnap({ views: v })} />
          <NumField label="Engagement %" decimal value={sn?.engagement ?? null} onSave={v => saveSnap({ engagement: v })} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>Screenshot your insights, then use the prompt in Claude.</span>
          <B v="sec" onClick={copyPrompt} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black, gap: 5, display: "inline-flex", alignItems: "center", flexShrink: 0 }}><Ico d={IC.copy} size={12} />Prompt</B>
        </div>
        {diff != null && <p style={{ fontSize: 12, margin: "6px 0 0", color: diff >= 0 ? C.green : C.red }}>{diff >= 0 ? "+" : "−"}{fmtInt(Math.abs(diff))} followers since last week</p>}
        {prev && <p style={{ fontSize: 12, color: C.muted, margin: "4px 0 0" }}>Last week: {fmtInt(prev.followers)} followers · {fmtInt(prev.views)} views · {fmtPct2(prev.engagement)}</p>}
      </div>
    </div>
  );

  // ── following (follow-backs only) ───────────────────────────
  const followCard = followT && (() => {
    const s = planner.stateOf(followT, monday);
    const period = periodOf(followT, monday);
    return (
      <div id="card-following" style={card}>
        {band("Following", statusTag(goalStatus(followT, s, monday)))}
        <div style={body}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, alignItems: "end", marginTop: -8 }}>
            <NumField label="Follow-backs" value={s.actual} onSave={v => quiet(planner.saveEntry(followT.id, period, { actual: v }))} />
            <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 14, color: s.done ? C.green : C.black }}>{s.actual ?? 0} / {s.target ?? "–"}</div>
          </div>
          <Bar value={s.actual ?? 0} max={s.target ?? 0} done={s.done} color={look.color} track={look.border} h={4} s={{ marginTop: 10 }} />
          {hint("Only accounts that follow back count. Unfollow the rest at the end of the week.")}
        </div>
      </div>
    );
  })();

  // ── community (the 7 days) ──────────────────────────────────
  const commCard = commT && (() => {
    const s = planner.stateOf(commT, monday);
    const period = periodOf(commT, monday);
    const st = goalStatus(commT, s, monday);
    return (
      <div id="card-community" style={card}>
        {band("Community · daily", <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ color: C.black }}>{s.daysDone} / 7</span>{statusTag(st)}</span>)}
        <div style={body}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4 }}>
            {DAY_SHORT.map((d, i) => {
              const on = s.days[i];
              return (
                <button key={d} onClick={() => { const days = [...s.days]; days[i] = !days[i]; quiet(planner.saveEntry(commT.id, period, { days })); }}
                  aria-pressed={on} aria-label={`${d}${on ? ", done" : ""}`}
                  style={{ height: 44, border: `1px solid ${i === ti ? C.black : on ? C.green : C.rule}`, background: on ? C.green : C.white, color: on ? C.white : C.black, borderRadius: 2, cursor: "pointer", fontFamily: SANS, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 0 }}>
                  <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: on ? C.white : i === ti ? C.black : C.muted }}>{d}</span>
                  <span style={{ fontSize: 12, lineHeight: 1 }}>{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          {hint("Engage every day with followers and the accounts you follow.")}
        </div>
      </div>
    );
  })();

  // ── new emails (just the number) ────────────────────────────
  const emailCard = emailT && (() => {
    const s = planner.stateOf(emailT, monday);
    return (
      <div id="card-emails" style={card}>
        {band("New emails", statusTag(goalStatus(emailT, s, monday)))}
        <div style={{ ...body, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1, color: s.done ? C.green : C.black }}>{s.actual ?? 0} / {s.target ?? "–"}</span>
            <span style={microLabel}>new contacts</span>
          </span>
          {openOutreach && <B v="sec" onClick={openOutreach} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black, gap: 5, display: "inline-flex", alignItems: "center" }}><Ico d={IC.link} size={12} />Outreach</B>}
        </div>
        <div style={{ padding: "0 12px 12px", marginTop: -8 }}>{hint("Counted from the contacts added in Outreach this week.")}</div>
      </div>
    );
  })();

  // ── Stage 2: the sprint and the pitch log ───────────────────
  const sprintCard = (() => {
    const sp = planner.activeSprint(acc);
    const past = planner.sprints.filter(x => x.account === acc && x.status === "done").sort((a, b) => b.startOn.localeCompare(a.startOn)).slice(0, 3);
    const st = sp ? planner.sprintStats(sp) : null;
    const due = planner.followUpsDue(acc);
    const d = sp ? sprintDay(sp, today()) : null;
    const row: any = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 12px", borderTop: "1px solid #f0ece7", cursor: "pointer" };
    return (
      <div id="card-sprints" style={card}>
        {band(`Sales sprints · ${sprintW} weeks`, sp && d ? <span style={{ color: C.black }}>Day {d.day} of {d.total}</span> : null)}
        {sp && st ? (
          <div className="lh-prow" role="button" tabIndex={0} onClick={() => setOpenSprint({ id: sp.id })} style={{ ...body, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Sprint {sp.num}</span><span style={{ fontSize: 12, color: C.muted }}>{sprintRange(sp)}</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
              Focus {sp.focusCategory ? <CatChip k={sp.focusCategory} /> : "any category"} · {OUTREACH_TIERS.find(t => t.key === sp.focusTier)?.label}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><span>Pitches</span><span style={{ color: sp.pitchGoal != null && st.pitches >= sp.pitchGoal ? C.green : C.black }}>{st.pitches} / {sp.pitchGoal ?? "–"}</span></div>
            <Bar value={st.pitches} max={sp.pitchGoal ?? 0} done={sp.pitchGoal != null && st.pitches >= sp.pitchGoal} color={look.color} track={look.border} h={4} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><span>Follow-ups</span><span>{st.followUps} / {sp.followUpGoal ?? "–"}{due > 0 && <span style={{ color: C.amber }}> · {due} due</span>}</span></div>
            <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Replied {st.replied} · Gifted {st.gifted} · Deals {st.deals}{st.rate != null ? ` · reply rate ${fmtPct2(st.rate)}` : ""}</p>
          </div>
        ) : (
          <div style={{ ...body, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>No sprint running{due > 0 ? ` · ${due} follow-ups due` : ""}</span>
            <B v="sec" onClick={() => setOpenSprint({ acc })} s={{ ...BAR_BTN, height: 28, minHeight: 28, color: C.black }}>Start sprint</B>
          </div>
        )}
        {past.map(p => {
          const ps = planner.sprintStats(p);
          return (
            <div key={p.id} className="lh-prow" onClick={() => setOpenSprint({ id: p.id })} style={row}>
              <span style={{ fontSize: 13, minWidth: 0 }}>Sprint {p.num} <span style={{ color: C.muted }}>· {ps.pitches} pitches · {ps.replied} replied · {ps.deals} {ps.deals === 1 ? "deal" : "deals"}</span></span>
              <span style={{ ...microLabel, flexShrink: 0 }}>Done</span>
            </div>
          );
        })}
      </div>
    );
  })();
  const weekPitches = planner.pitchesInWeek([acc], monday);
  const pitchN = weekPitches.filter(p => p.kind === "pitch").length;
  const pitchCard = (
    <div style={card}>
      {band(`Pitch log · week ${isoWeek(monday)}`, <span style={{ color: C.black }}>{pitchN} {pitchN === 1 ? "pitch" : "pitches"} · {weekPitches.length - pitchN} follow-ups</span>)}
      <div style={body}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4 }}>
          {DAY_SHORT.map((dn, k) => {
            const n = weekPitches.filter(p => p.sentOn === addDays(monday, k)).length;
            return (
              <div key={dn} style={{ border: `1px solid ${k === ti ? C.black : C.rule}`, borderRadius: 2, padding: "5px 0", textAlign: "center" as const }}>
                <div style={{ ...microLabel, fontSize: 9 }}>{dn}</div>
                <div style={{ fontSize: 14, marginTop: 2, color: n ? C.black : C.light }}>{n}</div>
              </div>
            );
          })}
        </div>
        {weekPitches.slice(0, 6).map(p => (
          <div key={p.id} style={{ minHeight: 36, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, borderTop: "1px solid #f0ece7", marginTop: 6 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{planner.contactName(p.contactId)} <span style={{ color: C.muted }}>· {p.kind === "follow_up" ? "Follow-up" : "Pitch"}</span></span>
            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{fmtD(p.sentOn).slice(0, 6)}</span>
          </div>
        ))}
        {weekPitches.length > 6 && <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>+{weekPitches.length - 6} more in Outreach</p>}
        {weekPitches.length === 0 && hint("Nothing logged this week. Log pitches in Outreach.")}
      </div>
    </div>
  );

  return (
    <div>
      <style>{`.lh-prow:hover { background: rgba(0,0,0,0.018); }`}</style>
      {/* ── HEADER ── */}
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 24, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Manager</h2>
      <Subtitle acc={acc} text={`His workspace · ${weekRange(monday)}`} />
      <div style={{ marginTop: 12, maxWidth: isMobile ? "none" : 420 }}><Toolbar monday={monday} setMonday={setMonday} isMobile={true} /></div>

      {loading ? (
        <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ fontSize: TYPE.label.size, color: C.red, marginTop: 16, lineHeight: 1.5 }}>{loadError}</p>
      ) : (
        <>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={microLabel}>Week {isoWeek(monday)} · {reached} of {his.length} reached</span>
            <span style={{ width: 120, height: 4, background: C.rule, display: "inline-block" }}><i style={{ display: "block", height: 4, width: `${his.length ? Math.round((reached / his.length) * 100) : 0}%`, background: reached === his.length && his.length ? C.green : look.color }} /></span>
          </div>
          {snapshotCard}
          {followCard}
          {commCard}
          {emailCard}
          {stage2 ? (
            planner.stage2Error ? <p style={{ fontSize: 12, color: C.red, margin: "12px 0 0", lineHeight: 1.5 }}>{planner.stage2Error}</p> : <>{sprintCard}{pitchCard}</>
          ) : (
            <div style={{ marginTop: 14, fontSize: 13, color: C.light, display: "flex", alignItems: "center", gap: 6 }}><Ico d={IC.lock} size={13} />Sprints and pitch log · from Stage 2</div>
          )}
        </>
      )}

      {openSprint && (
        <SprintWindow key={openSprint.id || `new-${openSprint.acc}`} planner={planner} sprintId={openSprint.id} isMobile={isMobile} onClose={() => setOpenSprint(null)}
          draft={openSprint.acc ? { account: openSprint.acc, startOn: thisMonday(), endOn: addDays(thisMonday(), sprintW * 7 - 1), focusCategory: "", focusTier: "now", pitchGoal: null, followUpGoal: null, review: "" } : undefined} />
      )}
      {toast && createPortal(
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: Z.toast, background: C.black, color: C.white, fontFamily: SANS, fontSize: 12, padding: "8px 14px", borderRadius: 2, maxWidth: "calc(100vw - 32px)" }}>{toast}</div>,
        document.body)}
    </div>
  );
}
