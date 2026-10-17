// ─────────────────────────────────────────────────────────────
// undo — one small "Deleted · Undo" bar for the whole Planner.
// Any ✕ calls showUndo(text, undoFn); the bar shows for 5 seconds.
// No pop-ups: deleting is one tap, a mistake is one tap back.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { C, SANS, TYPE, Z } from "./constants";

type U = { id: number; text: string; undo: () => void | Promise<void> };
let current: U | null = null;
let timer: any = null;
const subs = new Set<(u: U | null) => void>();
const emit = () => subs.forEach(f => f(current));

export function showUndo(text: string, undo: () => void | Promise<void>) {
  current = { id: Date.now(), text, undo };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => { current = null; emit(); }, 5000);
}

export function UndoBar() {
  const [u, setU] = useState<U | null>(current);
  useEffect(() => { subs.add(setU); return () => { subs.delete(setU); }; }, []);
  if (!u) return null;
  const run = async () => {
    current = null; emit(); clearTimeout(timer);
    try { await u.undo(); } catch { /* the save toast reports it */ }
  };
  return createPortal(
    <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: Z.toast + 1,
      background: C.black, color: C.white, fontFamily: SANS, fontSize: 12, borderRadius: 2, display: "flex", alignItems: "center", gap: 16,
      padding: "0 6px 0 14px", minHeight: 40, maxWidth: "calc(100vw - 32px)", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>
      <span style={{ whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{u.text}</span>
      <button onClick={run} style={{ background: "none", border: "none", color: C.white, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, textDecoration: "underline", padding: "12px 8px" }}>Undo</button>
    </div>,
    document.body);
}

// the small light-grey ✕ at the end of a row
export const XBtn = ({ label, onClick, size = 28 }: { label: string; onClick: () => void; size?: number }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title="Delete"
    style={{ width: size, height: size, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 13, lineHeight: 1, padding: 0, fontFamily: SANS }}>✕</button>
);
