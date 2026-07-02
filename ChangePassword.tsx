// ─────────────────────────────────────────────────────────────
// ChangePassword — update Supabase auth password
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SERIF, TYPE } from "./constants";
import { I, B, Lbl } from "./atoms";
import { supabase } from "./useSupabase";

export default function ChangePassword() {
  const [newPw,   setNewPw]   = useState("");
  const [confPw,  setConfPw]  = useState("");
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const change = async () => {
    if (newPw.length < 6) { setMsg({ text: "Password must be at least 6 characters.", ok: false }); return; }
    if (newPw !== confPw) { setMsg({ text: "Passwords do not match.", ok: false }); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);

    if (error) {
      setMsg({ text: error.message, ok: false });
    } else {
      setNewPw(""); setConfPw("");
      setMsg({ text: "Password updated successfully.", ok: true });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 6px" }}>Change Password</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>Update your studio access password</p>
      </div>
      <div style={{ maxWidth: 380 }}>
        <Lbl>New Password</Lbl>
        <I type="password" value={newPw} onChange={(e: any) => setNewPw(e.target.value)} placeholder="Min. 6 characters" s={{ marginBottom: 9 }} />
        <Lbl>Confirm New Password</Lbl>
        <I type="password" value={confPw} onChange={(e: any) => setConfPw(e.target.value)}
          onKeyDown={(e: any) => e.key === "Enter" && change()}
          placeholder="Repeat" s={{ marginBottom: 12 }} />
        <B v="sec" onClick={change} s={{ opacity: loading ? 0.5 : 1 }}>
          {loading ? "Updating…" : "Change Password"}
        </B>
        {msg && (
          <p style={{ fontSize: TYPE.label.size, color: msg.ok ? C.green : C.red, margin: "10px 0 0" }}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}
