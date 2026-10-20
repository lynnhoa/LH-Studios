// ─────────────────────────────────────────────────────────────
// CreatorProjects — projects in production (Manager Projects rows);
// "By client" replaces the old Clients tab. Tap a project → its items.
// ─────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, SPACING } from "./constants";
import { fmtD } from "./formatters";
import { SummaryLine, Strong, Chip, ChipRow, SectionHead, TonedTag } from "./atoms";
import { projectItems, isInProduction, shownStatus } from "./wsHelpers";
import { statusTone, catTone } from "./CreatorShared";

export default function CreatorProjects({ clients, isMobile }: { clients: any[]; isMobile: boolean }) {
  const [by, setBy] = useState<"project" | "client">("project");
  const [exp, setExp] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const rows = useMemo(() => (clients || []).flatMap((c: any) => (c.projects || [])
    .filter((pr: any) => pr.status === "production" || pr.status === "invoiced" || pr.paid)
    .map((pr: any) => { const its = projectItems(pr, c); const doneN = its.filter((i: any) => i.done).length; return { c, pr, its, doneN, total: its.length, complete: its.length > 0 && doneN === its.length }; }))
    .filter((r: any) => r.total > 0), [clients]);
  const prod = rows.filter((r: any) => isInProduction(r.pr));
  const after = rows.filter((r: any) => !isInProduction(r.pr) && !r.complete);
  const done = rows.filter((r: any) => !isInProduction(r.pr) && r.complete);
  const itemsN = prod.reduce((s: number, r: any) => s + r.total, 0);

  const row = (r: any, i: number) => {
    const key = `${r.c.id}-${r.pr.id}`, open = exp === key, pct = r.total ? (r.doneN / r.total) * 100 : 0;
    return (
      <div key={key} style={{ borderTop: i ? `1px solid ${C.hair}` : "none" }}>
        <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setExp(open ? null : key)} onKeyDown={(e: any) => { if (e.key === "Enter") setExp(open ? null : key); }}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", minHeight: 54, boxSizing: "border-box" as const, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: SPACING.listText, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{r.pr.name}</div>
            <div style={{ fontSize: TYPE.subtext.size, color: C.muted, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
              <button onClick={(e) => { e.stopPropagation(); setBy("client"); }} style={{ background: "none", border: "none", padding: "9px 2px", margin: "-9px -2px", font: "inherit", color: "inherit", cursor: "pointer", textDecoration: "underline", textDecorationColor: C.edge, textUnderlineOffset: 2 }}>{r.c.name}</button>
              {" · "}{r.pr.deliveryDate ? `delivery ${fmtD(r.pr.deliveryDate)}` : <span style={{ color: PAL.waiting.ink }}>No delivery date</span>}
            </div>
            <div style={{ height: 3, background: C.line, borderRadius: RADIUS.bar, marginTop: 6 }}>
              <div style={{ width: `${pct}%`, height: 3, background: r.complete ? PAL.done.mid : PAL.progress.mid, borderRadius: RADIUS.bar }} />
            </div>
          </div>
          <span style={{ fontFamily: SERIF, fontSize: TYPE.figure.size, color: r.complete ? PAL.done.ink : C.black, whiteSpace: "nowrap" as const }}>{r.doneN}/{r.total}</span>
          <span style={{ color: C.faint, fontSize: TYPE.label.size }}>{open ? "▴" : "▾"}</span>
        </div>
        {open && (
          <div style={{ background: C.bg, borderRadius: RADIUS.field, margin: "0 0 10px", padding: "2px 8px 4px" }}>
            {r.its.map((it: any, k: number) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44, borderTop: k ? `1px solid ${C.hair}` : "none", padding: "0 2px 0 6px", fontSize: TYPE.row.size }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: catTone(it.category).mid, flexShrink: 0 }} />{it.name}
                </span>
                <TonedTag tone={statusTone(it.status, it.done)}>{it.done ? "Done" : shownStatus(it.status)}</TonedTag>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const card = (list: any[]) => (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, overflow: "hidden", padding: "0 12px" }}>{list.map(row)}</div>
  );
  const clientsWith = [...new Set([...prod, ...after].map((r: any) => r.c.id))].map(id => (clients || []).find((c: any) => c.id === id)).filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Projects</h2>
      <SummaryLine dot={PAL.progress.mid}>{prod.length} in production · <Strong>{itemsN} items</Strong></SummaryLine>
      <ChipRow s={{ marginTop: 12 }}>
        <Chip on={by === "project"} tone={PAL.neutral} dot={false} label="By project" onClick={() => setBy("project")} />
        <Chip on={by === "client"} tone={PAL.neutral} dot={false} label="By client" onClick={() => setBy("client")} />
      </ChipRow>
      {rows.length === 0 && <p style={{ fontSize: TYPE.row.size, color: C.muted, margin: "16px 4px" }}>No projects in production yet.</p>}
      {by === "project" ? <>
        {prod.length > 0 && <><SectionHead dot={PAL.progress.mid} label={`In production · ${prod.length}`} right={`${itemsN} items`} />{card(prod)}</>}
        {after.length > 0 && <><SectionHead dot={PAL.waiting.mid} label={`Invoiced, items still open · ${after.length}`} />{card(after)}</>}
      </> : clientsWith.map((c: any) => {
        const list = [...prod, ...after].filter((r: any) => r.c.id === c.id);
        return <div key={c.id}><SectionHead label={`${c.name} · ${list.length}`} />{card(list)}</div>;
      })}
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone(o => !o)} aria-expanded={showDone} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SANS }}>
            <SectionHead dot={PAL.done.mid} label={`Done · ${done.length}`} right={showDone ? "▴" : "▾"} />
          </button>
          {showDone && card(done)}
        </>
      )}
    </div>
  );
}
