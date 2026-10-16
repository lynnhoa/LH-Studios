// ─────────────────────────────────────────────────────────────
// AppNav — the same avatar menu and nav tabs in Manager and
// Creator (only the menu items differ by role).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE, Z } from "./constants";
import { initials } from "./formatters";

export interface MenuItem { key: string; label: string; active?: boolean; onClick: () => void; }

// Compact, balanced rows: 13 px text in 36 px rows (same for Manager and Creator)
const MENU_W   = 212;
const ROW_H    = 36;
const itemStyle = (active: boolean, color: string): any => ({
  display: "flex", alignItems: "center", width: "100%", height: ROW_H, padding: "0 14px",
  background: active ? "rgba(0,0,0,0.035)" : "none", border: "none", cursor: "pointer",
  textAlign: "left" as const, fontFamily: SANS, fontSize: 13, color,
  letterSpacing: "0.01em", boxSizing: "border-box" as const,
});

export function AvatarMenu({ settings, roleLabel, items, switchLabel, onSwitch, onSignOut, dropLeft = false }: {
  settings: any; roleLabel: string; items: MenuItem[];
  switchLabel: string; onSwitch: () => void; onSignOut: () => void; dropLeft?: boolean;
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
        style={{ width: 36, height: 36, borderRadius: "50%", background: C.black, color: C.white, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: Z.menu, flexShrink: 0 }}
      >
        {ini}
      </button>

      {open && (
        <div role="menu" style={{ position: "absolute", ...(dropLeft ? { left: 0 } : { right: 0 }), top: "calc(100% + 8px)", width: MENU_W, background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, boxShadow: "0 6px 20px rgba(0,0,0,0.10)", zIndex: Z.menu }}>
          {/* who you are */}
          <div style={{ padding: "10px 14px 9px", borderBottom: `1px solid ${C.rule}` }}>
            <p style={{ fontSize: 15, lineHeight: 1.2, fontFamily: SERIF, color: C.black, margin: 0 }}>{settings?.name || settings?.company || "Lynn Hoa"}</p>
            <p style={{ fontSize: TYPE.micro.size, fontFamily: SANS, color: C.light, margin: "2px 0 0", letterSpacing: "0.10em", textTransform: "uppercase" as const }}>{roleLabel} · Private</p>
          </div>
          {/* pages */}
          {items.length > 0 && (
            <div style={{ padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
              {items.map(it => (
                <button key={it.key} role="menuitem" onClick={() => run(it.onClick)} style={itemStyle(!!it.active, it.active ? C.black : C.muted)}>{it.label}</button>
              ))}
            </div>
          )}
          {/* switch + sign out together */}
          <div style={{ padding: "4px 0" }}>
            <button role="menuitem" onClick={() => run(onSwitch)} style={itemStyle(false, C.muted)}>{switchLabel}</button>
            <button role="menuitem" onClick={() => run(onSignOut)} style={itemStyle(false, C.red)}>Sign Out</button>
          </div>
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
    style={{ padding: `0 ${px}px`, height, background: "none", border: "none", borderBottom: active ? `2px solid ${C.black}` : "2px solid transparent", color: active ? C.black : C.muted, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.12em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, flexShrink: 0 }}
  >
    {label}
  </button>
);
