// ─────────────────────────────────────────────────────────────
// quoteDraft — keeps the quote being built while you switch tabs
// (in memory, per mode: new quote / revision / amendment of a project).
// Cleared when the quote is saved or you Exit. Not kept across a reload.
// ─────────────────────────────────────────────────────────────
let store: Record<string, any> = {};
export const quoteDraft = {
  get:   (k: string) => store[k] || null,
  set:   (k: string, v: any) => { store[k] = v; },
  clear: (k?: string) => { if (k) delete store[k]; else store = {}; },
};
