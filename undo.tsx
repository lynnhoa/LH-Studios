// ─────────────────────────────────────────────────────────────
// undo — one small "Deleted · Undo" bar for every app, in the look of
// the save message. Any ✕ calls showUndo(text, undoFn); the bar shows for
// 5 seconds. showNote(text) shows a short message ("Copied ✓") the same way.
// No pop-ups: deleting is one tap, a mistake is one tap back.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { C, SANS, TYPE, Z, RADIUS, TRACK, SHADOW } from "./constants";

type U = { id: number; text: string; undo: null | (() => void | Promise<void>) };
let current: U | null = null;
let timer: any = null;
const subs = new Set<(u: U | null) => void>();
const emit = () => subs.forEach(f => f(current));

const show = (u: U, ms: number) => { current = u; emit(); clearTimeout(timer); timer = setTimeout(() => { current = null; emit(); }, ms); };
export function showUndo(text: string, undo: () => void | Promise<void>) { show({ id: Date.now(), text, undo }, 5000); }
// a short message without a button (e.g. "Prompt copied ✓")
export function showNote(text: string) { show({ id: Date.now(), text, undo: null }, 1800); }

export function UndoBar() {
  const [u, setU] = useState<U | null>(current);
  useEffect(() => { subs.add(setU); return () => { subs.delete(setU); }; }, []);
  if (!u) return null;
  const run = async () => {
    current = null; emit(); clearTimeout(timer);
    try { await u.undo?.(); } catch { /* the save toast reports it */ }
  };
  // the save message's look (cream, thin line, rounded), just above it
  return createPortal(
    <div role="status" style={{ position: "fixed", left: "50%", transform: "translate(-50%, -100%)", top: "calc(var(--vv-top) + var(--vv-h) - 84px - var(--kb-safe))", zIndex: Z.toast + 1,
      background: C.bg, border: `1px solid ${C.rule}`, color: C.black, borderRadius: RADIUS.tile, padding: u.undo ? "4px 6px 4px 14px" : "8px 14px", fontFamily: SANS,
      fontSize: TYPE.label.size, letterSpacing: TRACK.tag, boxShadow: SHADOW.pop, display: "flex", alignItems: "center", gap: 12, minHeight: 36, boxSizing: "border-box" as const, maxWidth: "calc(100vw - 32px)" }}>
      <span style={{ whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{u.text}</span>
      {u.undo && <button onClick={run} style={{ background: "none", border: "none", color: C.black, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.label.size, fontWeight: 500, textDecoration: "underline", minHeight: 32, padding: "0 8px" }}>Undo</button>}
    </div>,
    document.body);
}

// the small light-grey ✕ at the end of a row
export const XBtn = ({ label, onClick, size = 28 }: { label: string; onClick: () => void; size?: number }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title="Delete"
    style={{ width: size, height: size, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 13, lineHeight: 1, padding: 0, fontFamily: SANS }}>✕</button>
);
