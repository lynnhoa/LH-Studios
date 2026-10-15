// ─────────────────────────────────────────────────────────────
// saveStatus — one place that knows whether something is saving,
// saved or failed. Every database write goes through it (see
// useSupabase.ts). The toast in App.tsx shows the state; when a
// save fails, the registered reloaders bring the screen back to
// what is really stored (the failed change is undone).
// ─────────────────────────────────────────────────────────────

export interface SaveState { pending: number; error: string | null; savedAt: number; }

let state: SaveState = { pending: 0, error: null, savedAt: 0 };
const subs      = new Set<() => void>();
const reloaders = new Set<() => void>();
let locks = 0;

const emit = () => subs.forEach(fn => fn());

export const saveStatus = {
  get: () => state,
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  start() { state = { ...state, pending: state.pending + 1 }; emit(); },
  ok()    { state = { ...state, pending: Math.max(0, state.pending - 1), savedAt: Date.now() }; emit(); },
  fail(msg: string) {
    state = { ...state, pending: Math.max(0, state.pending - 1), error: msg || "Save failed" };
    emit();
    reloaders.forEach(fn => { try { fn(); } catch { /* ignore */ } });   // undo: show what is stored
  },
  clearError() { state = { ...state, error: null }; emit(); },
};

// Hooks register how to reload their data (used after a failed save and on app return)
export function registerReloader(fn: () => void) { reloaders.add(fn); return () => { reloaders.delete(fn); }; }
export function reloadAll() { reloaders.forEach(fn => { try { fn(); } catch { /* ignore */ } }); }

// While a document is open for editing, data is not reloaded in the background
export const editLock = {
  acquire() { locks++; let done = false; return () => { if (!done) { done = true; locks = Math.max(0, locks - 1); } }; },
  active: () => locks > 0,
};
