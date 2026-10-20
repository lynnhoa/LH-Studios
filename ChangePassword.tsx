// ─────────────────────────────────────────────────────────────
// ChangePassword — the login password for all four apps (Supabase auth).
// One card: New · Repeat, then Save password. ✓ or the reason underneath.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SERIF, TYPE, PAL, DENSITY, BREAKPOINT } from "./constants";
import { SummaryLine, ListCard, MiniInput, PillBtn } from "./atoms";
import { supabase } from "./useSupabase";

const LABEL: any = { width: 84, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted };
const ROW: any   = { display: "flex", alignItems: "center", gap: 10, minHeight: DENSITY.row1, padding: "0 12px", boxSizing: "border-box" };

export default function ChangePassword({ isMobile: isMobileProp }: { isMobile?: boolean }) {
  const isMobile = isMobileProp ?? (typeof window !== "undefined" && window.innerWidth < BREAKPOINT);
  const [newPw,   setNewPw]   = useState("");
  const [confPw,  setConfPw]  = useState("");
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const change = async () => {
    if (loading) return;
    if (newPw.length < 6) { setMsg({ text: "At least 6 characters, please.", ok: false }); return; }
    if (newPw !== confPw) { setMsg({ text: "The two passwords aren't the same.", ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) setMsg({ text: error.message, ok: false });
      else { setNewPw(""); setConfPw(""); setMsg({ text: "Password changed ✓", ok: true }); }
    } catch (e: any) {
      setMsg({ text: e?.message || "Not changed. Check your connection and try again.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Change password</h2>
      <SummaryLine dot={PAL.neutral.mid}>Your login for all four apps</SummaryLine>

      <ListCard s={{ marginTop: 14, maxWidth: isMobile ? undefined : 420 }}>
        <div style={ROW}>
          <span style={LABEL}>New</span>
          <MiniInput type="password" value={newPw} onChange={(e: any) => { setNewPw(e.target.value); setMsg(null); }} placeholder="at least 6 characters" aria-label="New password" autoComplete="new-password" s={{ flex: 1 }} />
        </div>
        <div style={{ ...ROW, borderTop: `1px solid ${C.hair}` }}>
          <span style={LABEL}>Repeat</span>
          <MiniInput type="password" value={confPw} onChange={(e: any) => { setConfPw(e.target.value); setMsg(null); }} placeholder="the same again" aria-label="Repeat new password" autoComplete="new-password"
            onKeyDown={(e: any) => { if (e.key === "Enter") change(); }} s={{ flex: 1 }} />
        </div>
      </ListCard>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, maxWidth: isMobile ? undefined : 420 }}>
        <span role="status" style={{ fontSize: TYPE.subtext.size, color: msg ? (msg.ok ? PAL.done.ink : C.red) : "transparent", lineHeight: 1.4, minWidth: 0 }}>{msg?.text || "·"}</span>
        <PillBtn dark dim={loading} onClick={change} s={{ height: 36, padding: "0 16px", fontSize: TYPE.row.size, borderRadius: 18, flexShrink: 0 }}>{loading ? "Saving…" : "Save password"}</PillBtn>
      </div>
    </div>
  );
}
