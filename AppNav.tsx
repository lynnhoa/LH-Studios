// ─────────────────────────────────────────────────────────────
// AppNav — the same avatar menu and nav tabs in Manager and
// Creator (only the menu items differ by role).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, SERIF_LIGHT, TYPE, Z, TRACK, SHADOW, RADIUS, SPACING, PAL } from "./constants";
import { initials } from "./formatters";
import type { Role } from "./types";

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

// The rows: Playfair Light (the logo's family), 14 px in 30 px rows — the same menu in every
// app, in a square box. No bullets and no highlight bar: the app / entry you're on is black
// (regular), the others grey (light).
const MENU_W   = SPACING.menuWidth;
const ROW_H    = SPACING.menuRow;
const itemStyle = (active: boolean, color: string): any => ({
  display: "flex", alignItems: "center", width: "100%", height: ROW_H, padding: "0 14px",
  background: "none", border: "none", cursor: "pointer", fontWeight: active ? 400 : 300,
  textAlign: "left" as const, fontFamily: SERIF_LIGHT, fontSize: SPACING.menuText, color: active ? C.black : color,
  letterSpacing: "0.01em", boxSizing: "border-box" as const,
});

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

      {open && (
        <div role="menu" style={{ position: "absolute", ...(dropLeft ? { left: 0 } : { right: 0 }), top: "calc(100% + 8px)", width: MENU_W, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 0, overflow: "hidden", boxShadow: SHADOW.pop, zIndex: Z.menu, paddingBottom: 4 }}>
          {/* who you are: name · role */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "11px 14px 9px", borderBottom: `1px solid ${C.hair}` }}>
            <span style={{ fontSize: TYPE.figure.size, fontFamily: SERIF, color: C.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{settings?.name || settings?.company || "Lynn Hoa"}</span>
            <span style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, flexShrink: 0 }}>{roleLabel}</span>
          </div>
          {(() => {
            const isAccount = (it: MenuItem) => /password|profile/i.test(it.label);
            const pages = items.filter(it => !isAccount(it)), account = items.filter(isAccount);
            const label = (t: string, first = false) => (
              <div style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted, padding: "8px 14px 2px", borderTop: first ? "none" : `1px solid ${C.hair}`, marginTop: first ? 0 : 3 }}>{t}</div>
            );
            // "This app": a choice (accounts) shows the current one black, the others grey;
            // plain pages (Manager) stay black until one of them is open
            const choice = pages.some(it => it.active);
            return <>
              {pages.length > 0 && <>{label("This app", true)}{pages.map(it => <button key={it.key} role="menuitem" onClick={() => run(it.onClick)} aria-current={it.active ? "page" : undefined} style={itemStyle(!!it.active, choice ? C.muted : C.black)}>{it.label}</button>)}</>}
              {label("Apps", pages.length === 0)}
              {apps.map(a => (
                <button key={a.key} role="menuitem" onClick={() => run(a.onClick)} aria-current={a.active ? "page" : undefined} style={itemStyle(!!a.active, C.muted)}>{a.label}</button>
              ))}
              {label("Account")}
              {account.map(it => <button key={it.key} role="menuitem" onClick={() => run(it.onClick)} style={itemStyle(false, C.muted)}>{it.label}</button>)}
              <button role="menuitem" onClick={() => run(onSignOut)} style={itemStyle(false, C.red)}>Sign out</button>
            </>;
          })()}
        </div>
      )}
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
