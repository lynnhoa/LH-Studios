// ─────────────────────────────────────────────────────────────
// appVersion — is a newer version of the app online?
// Compares the app file this page runs with the one the server
// lists now. Used when you come back to the app: a newer version
// is loaded automatically (only when nothing is being edited).
// ─────────────────────────────────────────────────────────────

const APP_FILE = /\/assets\/index-[^"'/]+\.js/;

export function runningAppFile(): string | null {
  const scripts = Array.from(document.querySelectorAll("script[src]")) as HTMLScriptElement[];
  for (const s of scripts) {
    const m = (s.getAttribute("src") || "").match(APP_FILE);
    if (m) return m[0];
  }
  return null;                       // development / tests: never reload
}

export async function newVersionAvailable(): Promise<boolean> {
  const mine = runningAppFile();
  if (!mine) return false;
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const m = (await res.text()).match(APP_FILE);
    return !!m && m[0] !== mine;
  } catch {
    return false;                    // offline: keep running
  }
}
