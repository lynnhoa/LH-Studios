// ─────────────────────────────────────────────────────────────
// AppNav — the same avatar menu and nav tabs in Manager and
// Creator (only the menu items differ by role).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE, Z, TRACK, SHADOW, RADIUS, SPACING, PAL } from "./constants";
import { initials } from "./formatters";
import type { Role } from "./types";
import AppLogo from "./AppLogo";

export interface MenuItem { key: string; label: string; active?: boolean; onClick: () => void; }

// Every app is listed in every app's menu, in this order
export const APPS: { key: Role; label: string }[] = [
  { key: "planner",  label: "Planner"  },
  { key: "outreach", label: "Outreach" },
  { key: "manager",  label: "Manager"  },
  { key: "creator",  label: "Creator"  },
];
export const appItems = (current: Role, switchTo: (r: Role) => void): MenuItem[] =>
  APPS.map(a => ({ key: a.key, label: a.label, active: a.key === current, onClick: () => { if (a.key !== current) switchTo(a.key); } }));

// The profile menu — the same in every app, built from the app's own parts:
// a white rounded card (soft shadow), your name in Playfair with the app you're in,
// the four apps as tiles with their colour circles, then "This app" and Account as
// 13 px rows. The app / entry you're on sits on a soft pill (✓ on rows).
const MENU_W = SPACING.menuWidth;
const ROW_H  = SPACING.menuRow;

// each app's colour and icon (the same tones as the rest of the app)
const APP_LOOK: Record<string, { tone: { wash: string; mid: string; ink: string }; d: string }> = {
  planner:  { tone: PAL.createbylynn, d: "M5 6h14v13H5zM5 10h14M9 4v4M15 4v4" },
  outreach: { tone: PAL.progress,     d: "M4 6h16v12H4zM4 7l8 6 8-6" },
  manager:  { tone: PAL.done,         d: "M4 8h16v11H4zM9 8V5h6v3M4 13h16" },
  creator:  { tone: PAL.lynnhoa,      d: "M4 8h3l2-2h6l2 2h3v11H4zM12 16.5a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" },
};
const AppIcon = ({ k }: { k: string }) => {
  const a = APP_LOOK[k] || { tone: PAL.neutral, d: "" };
  return (
    <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: a.tone.wash, color: a.tone.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={a.d} /></svg>
    </span>
  );
};
const rowStyle = (active: boolean, color: string): any => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "calc(100% - 12px)", height: ROW_H, margin: "0 6px", padding: "0 8px",
  background: active ? PAL.neutral.fill : "none", border: "none", borderRadius: RADIUS.field, cursor: "pointer",
  fontWeight: active ? 500 : 400, textAlign: "left" as const, fontFamily: SANS, fontSize: SPACING.menuText, color: active ? C.black : color,
  letterSpacing: TRACK.none, boxSizing: "border-box" as const,
});
const tileStyle = (active: boolean): any => ({
  display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 8px", borderRadius: RADIUS.tile, cursor: "pointer",
  border: `1px solid ${active ? C.pillOn : C.line}`, background: active ? PAL.neutral.wash : C.white,
  fontFamily: SANS, fontSize: TYPE.subtext.size, fontWeight: active ? 500 : 400, color: active ? C.black : C.ink2,
  textAlign: "left" as const, minWidth: 0, boxSizing: "border-box" as const,
});
const check = <span aria-hidden="true" style={{ fontSize: TYPE.subtext.size, color: C.black }}>✓</span>;

// "Version 21.10.2026 · 02:15" — when the app on screen was built (Vercel builds at each upload)
const appVersion = () => {
  const iso = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(+d)) return "Version —";
  const t = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", ...o });
  return `Version ${t({ day: "2-digit", month: "2-digit", year: "numeric" })} · ${t({ hour: "2-digit", minute: "2-digit" })}`;
};

export function AvatarMenu({ settings, roleLabel, items, apps, onSignOut, dropLeft = false }: {
  settings: any; roleLabel: string; items: MenuItem[];
  apps: MenuItem[]; onSignOut: () => void; dropLeft?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ini = initials(settings?.name || settings?.company || "LH");
  const run = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {open && <div style={{ position: "fixed", inset: 0, zIndex: Z.menu - 1 }} onClick={() => setOpen(false)} />}

      <button
        onClick={() => setOpen(o => !o)}
        title="Account"
        style={{ width: 36, height: 36, borderRadius: "50%", background: C.black, color: C.white, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: Z.menu, flexShrink: 0 }}
      >
        {ini}
      </button>

      {open && (() => {
        const isAccount = (it: MenuItem) => /password|profile/i.test(it.label);
        const pages = items.filter(it => !isAccount(it)), account = items.filter(isAccount);
        const current = apps.find(a => a.active);
        const label = (t: string) => (
          <div style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.light, padding: "10px 14px 4px" }}>{t}</div>
        );
        const sep = <div style={{ height: 1, background: C.hair, margin: "6px 0 0" }} />;
        return (
          <div role="menu" style={{ position: "absolute", ...(dropLeft ? { left: 0 } : { right: 0 }), top: "calc(100% + 8px)", width: MENU_W, background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, overflow: "hidden", boxShadow: SHADOW.pop, zIndex: Z.menu, paddingBottom: 6, fontFamily: SANS }}>
            {/* who you are · the app you're in */}
            <div style={{ padding: "12px 14px 11px", borderBottom: `1px solid ${C.hair}` }}>
              <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.1, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{settings?.name || settings?.company || "Lynn Hoa"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: TYPE.label.size, color: C.muted, marginTop: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (APP_LOOK[current?.key || ""]?.tone || PAL.neutral).mid, flexShrink: 0 }} />{roleLabel}
              </div>
            </div>

            {/* the four apps as tiles */}
            {label("Apps")}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6, padding: "2px 10px 4px" }}>
              {apps.map(a => (
                <button key={a.key} role="menuitem" onClick={() => run(a.onClick)} aria-current={a.active ? "page" : undefined} style={tileStyle(!!a.active)}>
                  <AppIcon k={a.key} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a.label}</span>
                </button>
              ))}
            </div>

            {/* this app: accounts (Planner, Outreach) or pages (Manager) */}
            {pages.length > 0 && <>
              {sep}{label("This app")}
              {pages.map(it => (
                <button key={it.key} role="menuitem" onClick={() => run(it.onClick)} aria-current={it.active ? "page" : undefined} style={rowStyle(!!it.active, C.ink2)}>
                  <span>{it.label}</span>{it.active && check}
                </button>
              ))}
            </>}

            {sep}{label("Account")}
            {account.map(it => <button key={it.key} role="menuitem" onClick={() => run(it.onClick)} style={rowStyle(false, C.ink2)}><span>{it.label}</span></button>)}
            <button role="menuitem" onClick={() => run(onSignOut)} style={rowStyle(false, C.red)}><span>Sign out</span></button>
            {/* which version is live: the time of the last build (German time) */}
            <div style={{ padding: "6px 14px 10px", fontSize: TYPE.micro.size, color: C.light, letterSpacing: "0.02em" }}>{appVersion()}</div>
          </div>
        );
      })()}
    </div>
  );
}

export const NavTab = ({ label, active, onClick, height, px }: {
  label: string; active: boolean; onClick: () => void; height: number; px: number;
}) => (
  <button
    onClick={onClick}
    style={{ padding: `0 ${px}px`, height, background: "none", border: "none", borderBottom: active ? `2px solid ${C.black}` : "2px solid transparent", color: active ? C.black : C.muted, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, flexShrink: 0 }}
  >
    {label}
  </button>
);

// the top bar's height (border included): what sticky parts below it start from
export const APP_HEADER_H = { phone: 96, wide: 57 };

// ── The one top bar of every app (the Manager bar) ────────────
// phone: the logo, then the tabs with the avatar on the right ·
// iPad / computer: logo and tabs on the left, the avatar on the right (its menu opens to the left)
export function AppHeader({ isMobile, onLogo, tabs, avatar }: {
  isMobile: boolean; onLogo?: () => void; tabs: (height: number, px: number) => any; avatar: any;
}) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg, borderBottom: `1px solid ${C.rule}` }}>
      {isMobile ? (
        <>
          <div style={{ textAlign: "center", padding: "8px 20px 6px" }}><AppLogo size="nav" onClick={onLogo} /></div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 44px 0 6px", borderTop: `1px solid ${C.rule}`, position: "relative" as const }}>
            <div style={{ display: "flex", minWidth: 0, overflowX: "auto" as const }}>{tabs(40, 8)}</div>
            <div style={{ position: "absolute", right: 8 }}>{avatar}</div>
          </div>
        </>
      ) : (
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28, minWidth: 0 }}>
            <AppLogo size="nav" onClick={onLogo} />
            <div style={{ display: "flex", minWidth: 0, overflowX: "auto" as const }}>{tabs(56, 10)}</div>
          </div>
          {avatar}
        </div>
      )}
    </div>
  );
}
