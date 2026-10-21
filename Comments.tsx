// ─────────────────────────────────────────────────────────────
// Comments — Outreach › Comments (third tab). Instagram comments to
// copy, one line each. Copy only: nothing is posted from here.
//   Title · summary line (● n comments · k used today · tap to copy)
//   Chips (All · groups) when there's more than one group
//   One section per group: GROUP · n ……… Edit · + Add
//     rows of 44 px: tap = copied ("Copied ✓") and used today →
//     grey with a "used" tag; it stays in its place.
//     Fresh again the next day by itself.
//   Edit: every row becomes a text field in place, with ✕ on the right.
//     Typing saves when you leave the field or press Enter (empty → the
//     old text comes back). ✕ deletes at once, with Undo. Done → copying.
// Window (one level, the app's sheet): Add comments (paste many, one per
// line · or type one).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, TRACK, SPACING } from "./constants";
import { I, S, Lbl, PillBtn, SummaryLine, Strong, SectionHead, ListCard, Chip, ChipRow, Sheet } from "./atoms";
import { copyText } from "./outreach";
import { showNote, showUndo } from "./undo";
import { DEFAULT_GROUP, parseLines, usedToday } from "./useComments";
import type { Comment, CommentsHook } from "./useComments";

const COPY = "M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1";
const Ico = ({ d, size = 14, color = "currentColor" }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
const linkBtn: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, WebkitTapHighlightColor: "transparent",
};
const NEW_GROUP = "__new__";

const TA = (p: any) => (
  <textarea {...p} style={{ width: "100%", minHeight: 150, padding: "9px 10px", border: `1px solid ${C.field}`, borderRadius: RADIUS.field, background: C.white,
    fontFamily: SANS, fontSize: TYPE.field.size, lineHeight: 1.45, color: C.black, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, WebkitAppearance: "none" as const, ...p.s }} />
);

// group select with "+ New group" → a name field under it
function GroupPick({ groups, value, onChange }: { groups: string[]; value: string; onChange: (g: string) => void }) {
  const known = groups.includes(value);
  const [isNew, setIsNew] = useState(!known && !!value);
  return (
    <>
      <S value={isNew ? NEW_GROUP : value} aria-label="Group" onChange={(e: any) => {
        if (e.target.value === NEW_GROUP) { setIsNew(true); onChange(""); } else { setIsNew(false); onChange(e.target.value); }
      }}>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
        <option value={NEW_GROUP}>+ New group</option>
      </S>
      {isNew && <I value={value} autoFocus placeholder="Outfit" aria-label="New group name" onChange={(e: any) => onChange(e.target.value)} s={{ marginTop: 6 }} />}
    </>
  );
}

interface CommentsProps { hook: CommentsHook; isMobile: boolean; }

export default function Comments({ hook, isMobile }: CommentsProps) {
  const { comments, loading, loadError } = hook;
  const [group, setGroup]     = useState<string>("all");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding]   = useState<string | null>(null);      // the group "+ Add" was tapped in

  const groups = useMemo(() => {
    const seen: string[] = [];
    comments.forEach(c => { if (!seen.includes(c.group)) seen.push(c.group); });   // in the order they were first added
    return seen;
  }, [comments]);
  useEffect(() => { if (group !== "all" && !groups.includes(group)) setGroup("all"); }, [groups, group]);
  const nUsed = comments.filter(usedToday).length;
  const shownGroups = group === "all" ? groups : [group];

  const tap = async (c: Comment) => {
    if (editing) return;
    const ok = await copyText(c.text);
    showNote(ok ? "Copied ✓" : "Couldn't copy");
    if (ok) hook.markUsed(c.id);
  };

  // every comment stays in its place (the order it was added)
  const ordered = (g: string) => comments.filter(c => c.group === g);
  const del = (c: Comment) => {
    hook.remove(c).then(() => showUndo("Comment deleted", () => hook.restore(c))).catch((e: any) => showNote(e?.message || "Couldn't delete."));
  };

  const row = (c: Comment, first: boolean) => {
    const used = usedToday(c);
    if (editing) return (
      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: SPACING.row1, padding: "0 4px 0 8px", boxSizing: "border-box" as const,
        borderTop: first ? "none" : `1px solid ${C.hair}`, fontFamily: SANS }}>
        <InlineField c={c} hook={hook} />
        <button onClick={() => del(c)} aria-label={`Delete ${c.text}`} title="Delete"
          style={{ width: 36, height: 36, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, WebkitTapHighlightColor: "transparent" }}>✕</button>
      </div>
    );
    return (
      <div key={c.id} role="button" tabIndex={0} onClick={() => tap(c)} onKeyDown={(e: any) => { if (e.key === "Enter") tap(c); }}
        style={{ display: "flex", alignItems: "center", gap: 10, minHeight: SPACING.row1, padding: "8px 12px", boxSizing: "border-box" as const,
          borderTop: first ? "none" : `1px solid ${C.hair}`, cursor: editing ? "pointer" : "copy", fontFamily: SANS, WebkitTapHighlightColor: "transparent" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.listText, lineHeight: 1.35, color: used ? C.light : C.black, overflowWrap: "anywhere" as const }}>{c.text}</span>
        {used
            ? <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: PAL.done.ink, background: PAL.done.wash, padding: "2px 7px", borderRadius: RADIUS.tag, flexShrink: 0 }}>used</span>
            : <Ico d={COPY} size={14} color={C.faint} />}
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Comments</h2>
      <SummaryLine dot={nUsed ? PAL.done.mid : PAL.neutral.mid}>
        <span><Strong>{comments.length}</Strong> {comments.length === 1 ? "comment" : "comments"}
          {nUsed > 0 && <> · <Strong color={PAL.done.ink}>{nUsed} used today</Strong></>} · {editing ? "tap to edit" : "tap to copy"}</span>
      </SummaryLine>

      {loadError && <p role="alert" style={{ fontSize: TYPE.subtext.size, color: C.red, margin: "12px 0 0" }}>{loadError}</p>}

      {!loadError && !loading && comments.length === 0 && (
        <>
          <SectionHead label={DEFAULT_GROUP} right={<button onClick={() => setAdding(DEFAULT_GROUP)} style={linkBtn}>+ Add</button>} />
          <ListCard s={{ padding: "18px 14px", textAlign: "center" as const }}>
            <div style={{ fontSize: SPACING.listText }}>Add your first comments</div>
            <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>Paste a whole list (one comment per line) or type one.</div>
            <PillBtn dark onClick={() => setAdding(DEFAULT_GROUP)} s={{ marginTop: 12 }}>+ Add</PillBtn>
          </ListCard>
        </>
      )}

      {!loadError && comments.length > 0 && (
        <>
          {groups.length > 1 && (
            <ChipRow s={{ marginTop: 12 }}>
              <Chip on={group === "all"} tone={PAL.neutral} dot={false} label="All" count={comments.length} onClick={() => setGroup("all")} />
              {groups.map(g => <Chip key={g} on={group === g} tone={PAL.neutral} dot={false} label={g} count={comments.filter(c => c.group === g).length} onClick={() => setGroup(g)} />)}
            </ChipRow>
          )}
          {shownGroups.map(g => {
            const list = ordered(g);
            return (
              <div key={g}>
                <SectionHead label={`${g} · ${list.length}`} right={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setEditing(e => !e)} style={{ ...linkBtn, textDecoration: "underline", textUnderlineOffset: 2, color: editing ? C.black : PAL.neutral.ink }}>{editing ? "Done" : "Edit"}</button>
                    <span style={{ color: C.faint }}>·</span>
                    <button onClick={() => setAdding(g)} style={linkBtn}>+ Add</button>
                  </span>} />
                <ListCard>{list.map((c, i) => row(c, i === 0))}</ListCard>
              </div>
            );
          })}
        </>
      )}

      {adding !== null && <AddWindow hook={hook} groups={groups.length ? groups : [DEFAULT_GROUP]} start={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

// ── Add: paste many (one per line) or type one ───────────────
function AddWindow({ hook, groups, start, onClose }: { hook: CommentsHook; groups: string[]; start: string; onClose: () => void }) {
  const [text, setText]   = useState("");
  const [group, setGroup] = useState(start);
  const [err, setErr]     = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const { fresh, doubles } = useMemo(() => parseLines(text, hook.comments), [text, hook.comments]);
  const n = fresh.length;

  const add = async () => {
    if (!n || busy) return;
    if (!group.trim()) { setErr("Please name the new group."); return; }
    setErr(null); setBusy(true);
    try { const k = await hook.addMany(fresh, group); showNote(`${k} added ✓`); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't save."); setBusy(false); }
  };

  return (
    <Sheet title="Add comments" onClose={onClose}
      footer={<>
        <PillBtn onClick={onClose} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark dim={!n || busy} onClick={add} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>{busy ? "Saving…" : `Add ${n}`}</PillBtn>
      </>}>
      {err && <p role="alert" style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
      <Lbl>Group</Lbl>
      <GroupPick groups={groups} value={group} onChange={setGroup} />
      <Lbl>Comments · one per line</Lbl>
      <TA value={text} autoFocus aria-label="Comments" placeholder={"so elegant ✨\nthe styling is so good\na classic 🤍"} onChange={(e: any) => setText(e.target.value)} />
      <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "5px 2px 0", lineHeight: 1.4 }}>
        {n === 0 && !doubles ? "Bullets, empty lines and doubles are left out." : `${n} new${doubles ? ` · ${doubles} already in the list` : ""}`}
      </p>
    </Sheet>
  );
}

// ── a comment as a field in its row (Edit) ───────────────────
// Shown at the row's 13 px, typed at 16 px underneath (no iPhone zoom).
function InlineField({ c, hook }: { c: Comment; hook: CommentsHook }) {
  const [t, setT]         = useState(c.text);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(c.text); }, [c.text, focus]);
  const k = SPACING.listText / 16, H = 32;
  const commit = () => {
    const v = t.trim().replace(/\s+/g, " ");
    if (!v) { setT(c.text); return; }                    // empty → the old text comes back
    if (v === c.text) return;
    hook.update(c.id, { text: v }).catch((e: any) => { setT(c.text); showNote(e?.message || "Couldn't save."); });
  };
  return (
    <span style={{ position: "relative", display: "block", flex: 1, minWidth: 0, height: H }}>
      <input value={t} aria-label="Comment" enterKeyHint="done"
        onFocus={() => setFocus(true)} onChange={(e) => setT(e.target.value)}
        onBlur={() => { setFocus(false); commit(); }}
        onKeyDown={(e) => { const el = e.target as HTMLInputElement; if (e.key === "Enter") el.blur(); if (e.key === "Escape") { setT(c.text); setTimeout(() => el.blur()); } }}
        style={{ position: "absolute", top: 0, left: 0, width: `${100 / k}%`, height: H / k, transform: `scale(${k})`, transformOrigin: "top left",
          fontSize: 16, fontFamily: SANS, color: C.black, padding: "0 10px", boxSizing: "border-box" as const, margin: 0, outline: "none",
          border: `1px solid ${focus ? C.edge : C.field}`, borderRadius: RADIUS.field / k, background: focus ? C.white : PAL.neutral.wash, WebkitAppearance: "none" as const }} />
    </span>
  );
}
