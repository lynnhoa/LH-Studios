// ─────────────────────────────────────────────────────────────
// OutreachDashboard — Outreach › Dashboard: a read-only overview,
// to read at a glance (the to-dos stay in Contacts). Built only from
// the Manager dashboard's parts (atoms › DASHBOARD PARTS), same sizes:
//   Emails sent · last 8 weeks   card with week bars + response-rate strip
//   Pipeline                     Awaiting reply · Follow-ups due · Replies · Won
//                                + Ready to re-pitch (wide row)
//   Reply check                  row with a tag (like Licenses)
//   By category · pitched        bar list (like "Revenue by offer")
// Switch: All · @lynnhoa · UGC (one view at a time, like the Planner).
// A tile opens Contacts already filtered. Colours = the status pills' colours.
// Numbers: outreach.ts › dashboardStats (tested on its own).
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { DashCard, DashCardHead, DashStrip, DashTile, WideRow, LinkRow, BarList, SwitchPill, SectionHead, DashIcon } from "./atoms";
import { C, SANS, SERIF, PAL, TYPE, TRACK } from "./constants";
import { dashboardStats, todayYmd } from "./outreach";
import type { DashView, OutreachView } from "./outreach";
import { Ico, IC } from "./PlannerWindows";

const VIEW_KEY = "lh_outreach_dash_view";
const VIEWS: { key: DashView; label: string }[] = [{ key: "all", label: "All" }, { key: "lynnhoa", label: "@lynnhoa" }, { key: "ugc", label: "UGC" }];
const CLOCK   = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2";
const MESSAGE = "M4 5h16v11H9l-5 4z";
const REFRESH = "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7";
const INBOX   = "M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z";
const pct2 = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const int  = (n: number) => Math.round(n).toLocaleString("de-DE");
const caps: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const };

export default function OutreachDashboard({ outreach, isMobile, onOpenContacts }: {
  outreach: any; isMobile: boolean; onOpenContacts?: (patch: Partial<OutreachView>) => void;
}) {
  const [view, setView] = useState<DashView>(() => {
    try { const v = sessionStorage.getItem(VIEW_KEY); return v === "lynnhoa" || v === "ugc" ? v : "all"; } catch { return "all"; }
  });
  const pick = (v: DashView) => { setView(v); try { sessionStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };
  const s = useMemo(() => dashboardStats(outreach.contacts || [], outreach.pitches || [], outreach.events || [], view),
    [outreach.contacts, outreach.pitches, outreach.events, view]);
  // a tile opens Contacts, filtered (and limited to this view's account)
  const open = (patch: Partial<OutreachView>) => (onOpenContacts ? () => onOpenContacts({ ...patch, acc: view }) : undefined);

  const icon = (d: string, size = 12) => <Ico d={d} size={size} />;
  const maxWeek = Math.max(1, ...s.weeks.map(w => w.n));
  const wonSub = view === "ugc"
    ? `Lead ${s.won.lead} · Client ${s.won.client}`
    : [`Gifted ${s.won.gifted}`, `Invited ${s.won.invited}`, `Lead ${s.won.lead}`, ...(s.won.client ? [`Client ${s.won.client}`] : [])].join(" · ");
  // the reply check (Phase 5): when it last looked at the mailbox, or that it's paused
  const mail = outreach.mail;
  const checked = (() => {
    if (!mail?.lastCheckAt) return "";
    const d = new Date(mail.lastCheckAt);
    if (isNaN(d.getTime())) return "";
    const t = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return todayYmd(d) === todayYmd() ? t : `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${t}`;
  })();
  const mailTone = mail?.lastError ? PAL.late : checked ? PAL.done : PAL.neutral;

  const emailsCard = (
    <DashCard>
      <div style={{ padding: "11px 13px 9px" }}>
        <DashCardHead icon={<DashIcon tone={PAL.neutral}>{icon(IC.mail)}</DashIcon>} label="Emails sent · last 8 weeks" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
          <div style={{ fontFamily: SERIF, fontSize: TYPE.kpi.size, lineHeight: 1.05, whiteSpace: "nowrap" as const }}>{int(s.sentTotal)}</div>
          <div style={{ fontSize: TYPE.label.size, color: C.muted, textAlign: "right" as const, lineHeight: 1.35 }}>
            {int(s.sentPitches)} {s.sentPitches === 1 ? "pitch" : "pitches"} · {int(s.sentFollowUps)} {s.sentFollowUps === 1 ? "follow-up" : "follow-ups"}<br />This week {int(s.thisWeek)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))", gap: 6, alignItems: "end", height: 38, marginTop: 10 }}>
          {s.weeks.map((w, k) => (
            <span key={w.monday} title={`W${w.week} · ${w.n}`} aria-label={`Week ${w.week}: ${w.n} emails`}
              style={{ height: w.n > 0 ? Math.max(6, Math.round((w.n / maxWeek) * 38)) : 3, borderRadius: w.n > 0 ? 5 : 2, background: k === 7 ? PAL.neutral.mid : PAL.neutral.fill }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))", gap: 6, marginTop: 4, fontSize: TYPE.micro.size, color: C.light, textAlign: "center" as const }}>
          {s.weeks.map((w, k) => <span key={w.monday} style={{ color: k === 7 ? C.black : undefined }}>W{w.week}</span>)}
        </div>
      </div>
      <DashStrip tone={PAL.progress} pct={s.responseRate}
        left={<>Response rate · {int(s.replies)} {s.replies === 1 ? "reply" : "replies"} of {int(s.pitched)} pitched</>} right={pct2(s.responseRate)} />
    </DashCard>
  );

  const pipeline = (
    <>
      <SectionHead label="Pipeline" />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        <DashTile tone={PAL.neutral} icon={icon(IC.hourglass)} label="Awaiting reply" value={int(s.awaiting)} sub="pitched, no reply yet" onClick={open({ status: "pitched", chip: "all" })} />
        <DashTile tone={PAL.waiting} icon={icon(CLOCK)} label="Follow-ups due" value={int(s.followUpsDue)} sub={<>FU 1 · {int(s.fu1Due)} &nbsp;·&nbsp; FU 2 · {int(s.fu2Due)}</>} onClick={open({ status: "followup", chip: "all" })} />
        <DashTile tone={PAL.progress} icon={icon(MESSAGE)} label="Replies" value={int(s.replies)} sub={`${int(s.newReplies)} new`} onClick={open({ chip: "active" })} />
        <DashTile tone={PAL.done} icon={icon(IC.spark)} label="Won" value={int(s.won.total)} sub={wonSub} />
        <WideRow icon={icon(REFRESH)} label="Ready to re-pitch" onClick={open({ status: "repitch", chip: "all" })}
          right={<>
            <span style={{ fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const }}>No reply · Declined, 90+ days</span>
            <span style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, whiteSpace: "nowrap" as const }}>{int(s.repitch)}</span>
          </>} />
      </div>
      {mail && (
        <LinkRow icon={<DashIcon tone={mailTone}>{icon(INBOX)}</DashIcon>} label="Reply check" tone={mailTone} tagFilled={!!mail.lastError || !!checked}
          tag={mail.lastError ? "Paused" : checked ? `Checked ${checked}` : "Not checked yet"} />
      )}
      <SectionHead label="By category · pitched" />
      <BarList empty="No contacts in this view yet."
        rows={s.byCategory.map(r => ({ key: r.key, label: r.label, value: `${int(r.pitched)} of ${int(r.contacts)}`,
          pctText: `${int(r.replies)} ${r.replies === 1 ? "reply" : "replies"}`, pct: r.contacts ? (r.pitched / r.contacts) * 100 : 0 }))} />
    </>
  );

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Dashboard</h2>
        <SwitchPill s={{ overflow: "hidden" }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => pick(v.key)} aria-pressed={view === v.key}
              style={{ border: "none", height: 26, padding: "0 9px", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.subtext.size,
                background: view === v.key ? PAL.neutral.fill : "transparent", color: view === v.key ? C.black : C.muted }}>{v.label}</button>
          ))}
        </SwitchPill>
      </div>
      <div style={{ ...caps, color: C.muted, marginTop: 4 }}>Overview · read only</div>
      {outreach.loading ? <p style={{ fontSize: TYPE.label.size, color: C.muted, marginTop: 16 }}>Loading…</p> : (
        <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
          <div>{emailsCard}</div>
          <div>{pipeline}</div>
        </div>
      )}
    </div>
  );
}
