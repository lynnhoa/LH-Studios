// ─────────────────────────────────────────────────────────────
// OutreachApp — Outreach (tab: Email list). Same frame as the
// other apps: logo header, nav tab, account menu with all apps.
// The menu also holds the account you're working on (as in the
// Planner); the email list itself stays one shared list.
// Phone, iPad and desktop layouts.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, BREAKPOINT, WIDE } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, NavTab, appItems } from "./AppNav";
import EmailList from "./EmailList";
import { useOutreach } from "./useOutreach";
import { ACCOUNTS, loadWorkAccount, saveWorkAccount } from "./planner";
import type { Account } from "./planner";
import type { Role } from "./types";

interface OutreachAppProps {
  userId:   string | null;
  settings: any;
  signOut:  () => Promise<void>;
  switchTo: (r: Role) => void;
  banners?: ReactNode;
}

export default function OutreachApp({ userId, settings, signOut, switchTo, banners }: OutreachAppProps) {
  const outreach = useOutreach(userId);
  // the account you're working on (same choice as in the Planner): the default when you log a pitch
  const [work, setWork] = useState<Account>(loadWorkAccount);
  const pickAccount = (a: Account) => { saveWorkAccount(a); setWork(a); };
  const [winW, setWinW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isMobile = winW < BREAKPOINT;
  const isWide   = winW >= WIDE;
  const headerH  = isMobile ? 87 : 57;

  const avatar = (
    <AvatarMenu settings={settings} roleLabel="Outreach"
      items={ACCOUNTS.map(a => ({ key: a.key, label: a.label, active: work === a.key, onClick: () => pickAccount(a.key) }))}
      apps={appItems("outreach", switchTo)} onSignOut={() => { signOut(); }} />
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: SANS, color: C.black }}>
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg, borderBottom: `1px solid ${C.rule}` }}>
        {isMobile ? (
          <>
            <div style={{ textAlign: "center", padding: "8px 20px 6px" }}><AppLogo size="nav" /></div>
            <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 6px", borderTop: `1px solid ${C.rule}` }}>
              <NavTab label="Email list" active={true} onClick={() => {}} height={40} px={8} />
              {avatar}
            </div>
          </>
        ) : (
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <AppLogo size="nav" />
              <NavTab label="Email list" active={true} onClick={() => {}} height={56} px={10} />
            </div>
            {avatar}
          </div>
        )}
      </div>
      <div style={{ maxWidth: isWide ? 1200 : 960, margin: "0 auto", padding: isMobile ? "14px 14px 28px" : "24px 20px 40px" }}>
        {banners}
        <EmailList outreach={outreach} settings={settings} isMobile={isMobile} isWide={isWide} stickyTop={headerH} />
      </div>
    </div>
  );
}
