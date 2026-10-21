// ─────────────────────────────────────────────────────────────
// PlannerConcept — Planner › Content concept, opened from the
// profile menu ("@lynnhoa concept" / "@createbylynn concept").
//   One card per arc, numbered top to bottom. Tap an arc to open or
//   close it; "collapse all / expand all" sits next to Arcs. Remembered
//   on this device; the first time, all are closed (every arc on one
//   screen).
//   An open arc: its purpose, its formats with the TikTok / Instagram
//   ticks, and "texts · links" small in the top right.
//   texts / links open one window each — the idea window's text list
//   and link list: add, change, delete with Undo, saved right away.
// Arcs, purpose, formats and ticks come from the SQL (fixed here).
// Phone: one column · iPad / computer: two columns (first half left).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, SPACING, RADIUS, TRACK, SHADOW, ICON } from "./constants";
import { B, SectionHead } from "./atoms";
import { ACCOUNTS, PLATFORM_TONE, platformTone } from "./planner";
import type { Account, ConceptArc, ConceptFormat } from "./planner";
import type { PlannerHook } from "./usePlanner";
import type { PlannerView } from "./PlannerTodo";
import { IC, Subtitle, TabTitle, Window, WinHead, winCard, LineList, LinkList, ACC_TONE } from "./PlannerWindows";

// the open arcs per account, remembered on this device (none the first time)
const OPEN_KEY = "lh_planner_concept_open";
type OpenMap = Partial<Record<Account, number[]>>;
const loadOpen = (): OpenMap => {
  try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) || "null"); if (v && typeof v === "object") return v; } catch { /* ignore */ }
  return {};
};

const quiet = (p: Promise<any>) => p.catch(() => { /* the save toast reports it */ });

const NUM    = 24;              // the arc's number circle
const GAP    = 9;
const INDENT = NUM + GAP;       // purpose and formats line up with the arc's name
const COL    = 30;              // the TikTok and Instagram columns

const caps: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const };
// "texts · 6" · "links · 2" · "collapse all": small, underlined (like "history")
const mini: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.micro.size, lineHeight: 1, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2,
  whiteSpace: "nowrap" as const, WebkitTapHighlightColor: "transparent",
};
const count = (word: string, n: number) => (n ? `${word} · ${n}` : word);

// a platform tick: soft fill, coloured outline and check · empty: light outline
const PlatformTick = ({ on, platform }: { on: boolean; platform: "TikTok" | "Instagram" }) => {
  const t = PLATFORM_TONE[platform];
  return (
    <span role="img" aria-label={`${platform}: ${on ? "yes" : "no"}`}
      style={{ width: 20, height: 20, borderRadius: RADIUS.check, boxSizing: "border-box" as const, border: `1.5px solid ${on ? t.mid : C.edge}`,
        background: on ? t.wash : C.white, color: t.ink, display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: TYPE.label.size, fontWeight: 500, lineHeight: 1 }}>
      {on ? "✓" : ""}
    </span>
  );
};

const FormatRow = ({ f }: { f: ConceptFormat }) => (
  <div style={{ display: "flex", alignItems: "center", minHeight: 34, borderTop: `1px solid ${C.hair}` }}>
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: f.main ? C.ink2 : C.faint, flexShrink: 0, marginRight: GAP }} />
    <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.listText, lineHeight: 1.3, padding: "7px 0", color: f.main ? C.black : C.ink2, fontWeight: f.main ? 500 : 400 }}>
      {f.name}
    </span>
    <span style={{ width: COL, display: "flex", justifyContent: "center", flexShrink: 0 }}><PlatformTick on={f.tt} platform="TikTok" /></span>
    <span style={{ width: COL, display: "flex", justifyContent: "center", flexShrink: 0 }}><PlatformTick on={f.ig} platform="Instagram" /></span>
  </div>
);

// one arc: number · name · (open: texts · links) · ▾ — open: purpose and formats
function ArcCard({ arc, open, onToggle, onOpen }: { arc: ConceptArc; open: boolean; onToggle: () => void; onOpen: (kind: "texts" | "links") => void }) {
  const tone = ACC_TONE[arc.account];
  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={onToggle} aria-expanded={open} aria-label={`${arc.num}. ${arc.name}`}
          style={{ flex: 1, minWidth: 0, minHeight: SPACING.row1, display: "flex", alignItems: "center", gap: GAP, padding: `0 8px 0 ${SPACING.rowSide}px`,
            background: "none", border: "none", cursor: "pointer", fontFamily: SANS, textAlign: "left" as const, color: C.black, WebkitTapHighlightColor: "transparent" }}>
          <span aria-hidden="true" style={{ width: NUM, height: NUM, borderRadius: "50%", background: tone.wash, color: tone.ink, fontSize: TYPE.subtext.size, fontWeight: 500,
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{arc.num}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.plannerText, fontWeight: 500, lineHeight: 1.3, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{arc.name}</span>
        </button>
        {open && (
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={() => onOpen("texts")} aria-label={`Texts of ${arc.name}`} style={mini}>{count("texts", arc.texts.length)}</button>
            <button onClick={() => onOpen("links")} aria-label={`Links of ${arc.name}`} style={mini}>{count("links", arc.links.length)}</button>
          </span>
        )}
        <span aria-hidden="true" onClick={onToggle}
          style={{ width: COL, minHeight: SPACING.row1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ICON.caret, color: C.faint, flexShrink: 0, cursor: "pointer" }}>
          {open ? "▴" : "▾"}
        </span>
      </div>
      {open && (
        <div style={{ padding: `0 6px 6px ${SPACING.rowSide}px` }}>
          {arc.purpose && <div style={{ margin: `-8px 22px 0 ${INDENT}px`, fontSize: SPACING.listMeta, color: C.muted, lineHeight: 1.4 }}>{arc.purpose}</div>}
          <div style={{ margin: `8px 0 0 ${INDENT}px` }}>
            <div style={{ display: "flex", alignItems: "center", height: 22 }}>
              <span style={{ ...caps, flex: 1, color: C.light }}>Formats</span>
              <span style={{ ...caps, width: COL, textAlign: "center" as const, color: PLATFORM_TONE.TikTok.ink }} title="TikTok">TT</span>
              <span style={{ ...caps, width: COL, textAlign: "center" as const, color: PLATFORM_TONE.Instagram.ink }} title="Instagram">IG</span>
            </div>
            {arc.formats.map((f, k) => <FormatRow key={k} f={f} />)}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlannerConceptProps {
  planner:   PlannerHook;
  view:      PlannerView;
  isMobile:  boolean;
  onAccount?: (a: Account) => void;
}

export default function PlannerConcept({ planner, view, isMobile, onAccount }: PlannerConceptProps) {
  const acc  = (view.acc === "all" ? "lynnhoa" : view.acc) as Account;
  const tone = ACC_TONE[acc];
  const arcs = planner.arcs.filter(a => a.account === acc).sort((a, b) => a.num - b.num);

  const [openMap, setOpenMap] = useState<OpenMap>(loadOpen);
  const openNums = openMap[acc] || [];
  const saveOpen = (m: OpenMap) => { setOpenMap(m); try { localStorage.setItem(OPEN_KEY, JSON.stringify(m)); } catch { /* ignore */ } };
  const toggle   = (n: number) => saveOpen({ ...openMap, [acc]: openNums.includes(n) ? openNums.filter(x => x !== n) : [...openNums, n] });
  const anyOpen  = arcs.some(a => openNums.includes(a.num));
  const toggleAll = () => saveOpen({ ...openMap, [acc]: anyOpen ? [] : arcs.map(a => a.num) });

  // the window: one arc's texts or links
  const [win, setWin] = useState<{ id: string; kind: "texts" | "links" } | null>(null);
  const winArc = win ? planner.arcs.find(a => a.id === win.id) : undefined;
  useEffect(() => { if (win && !winArc && !planner.loading) setWin(null); }, [win, winArc, planner.loading]);
  const close = () => setWin(null);

  const card = (a: ConceptArc) => (
    <ArcCard key={a.id} arc={a} open={openNums.includes(a.num)} onToggle={() => toggle(a.num)} onOpen={kind => setWin({ id: a.id, kind })} />
  );
  const column = (list: ConceptArc[]) => <div style={{ display: "flex", flexDirection: "column" as const, gap: SPACING.cardGap, minWidth: 0 }}>{list.map(card)}</div>;
  const half = Math.ceil(arcs.length / 2);
  const swatch = (t: { wash: string; mid: string }) => (
    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, boxSizing: "border-box" as const, background: t.wash, border: `1.5px solid ${t.mid}`, flexShrink: 0 }} />
  );
  const accLabel = ACCOUNTS.find(a => a.key === acc)?.label || `@${acc}`;

  return (
    <div>
      <TabTitle title="Content concept" acc={acc} onAccount={onAccount} isMobile={isMobile} />
      <Subtitle text="Arcs · formats · texts · links" />

      {planner.loading ? (
        <p style={{ fontSize: SPACING.plannerText, color: C.muted, marginTop: 16 }}>Loading…</p>
      ) : planner.conceptError ? (
        <p style={{ fontSize: SPACING.plannerText, color: C.red, marginTop: 16 }}>{planner.conceptError}</p>
      ) : (
        <>
          <SectionHead dot={tone.mid} label={`Arcs · ${arcs.length}`}
            right={arcs.length ? <button onClick={toggleAll} style={mini}>{anyOpen ? "collapse all" : "expand all"}</button> : undefined} />
          {!arcs.length ? (
            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.card, padding: "14px 12px" }}>
              <div style={{ fontFamily: SERIF, fontSize: TYPE.sectionHeading.size, color: C.black }}>No arcs for {accLabel} yet</div>
              <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>They're added here once its concept is mapped, in the same layout: numbered arcs, formats, platforms, texts and links.</div>
            </div>
          ) : isMobile ? column(arcs) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: SPACING.cardGap, alignItems: "start" }}>
              {column(arcs.slice(0, half))}
              {column(arcs.slice(half))}
            </div>
          )}
          {arcs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: "6px 14px", fontSize: SPACING.listMeta, color: C.muted, margin: `${SPACING.cardGap}px 2px 0` }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink2 }} />main format</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{swatch(PLATFORM_TONE.TikTok)}TikTok</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{swatch(PLATFORM_TONE.Instagram)}Instagram</span>
            </div>
          )}
        </>
      )}

      {win && winArc && (
        <Window title={`${winArc.num}. ${winArc.name}`} isMobile={isMobile} onClose={close}>
          <WinHead first icon={win.kind === "texts" ? IC.list : IC.link} tone={ACC_TONE[winArc.account]}
            label={win.kind === "texts" ? count("Texts", winArc.texts.length) : count("Links", winArc.links.length)} />
          <div style={winCard}>
            {win.kind === "texts"
              ? <LineList key={`t-${winArc.id}`} initial={winArc.texts} marker="bullets" placeholder="Write a text" addLabel="Add a text"
                  onSave={lines => { quiet(planner.updateArc(winArc.id, { texts: lines })); }} />
              : <LinkList key={`l-${winArc.id}`} initial={winArc.links} pillTone={platformTone}
                  onSave={links => { quiet(planner.updateArc(winArc.id, { links })); }} />}
          </div>
        </Window>
      )}
    </div>
  );
}
