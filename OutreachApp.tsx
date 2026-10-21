// ─────────────────────────────────────────────────────────────
// OutreachApp — Outreach (tabs: Contacts · Email kit). Same frame as the
// other apps: logo header, nav tab, account menu with all apps.
// The menu also holds the account you're working on (as in the
// Planner); the email list itself stays one shared list.
// Phone, iPad and desktop layouts.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, BREAKPOINT, WIDE } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, NavTab, appItems, AppHeader, APP_HEADER_H } from "./AppNav";
import { UndoBar } from "./undo";
import EmailList from "./EmailList";
import EmailKit from "./EmailKit";
import { useOutreach } from "./useOutreach";
import { useEmailKit } from "./useEmailKit";
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
  const emailKit = useEmailKit(userId);
  // the open tab: Contacts (the email list) or Email kit — kept while the app is open
  const TAB_KEY = "lh_outreach_tab";
  const [tab, setTab] = useState<"contacts" | "kit">(() => { try { return sessionStorage.getItem(TAB_KEY) === "kit" ? "kit" : "contacts"; } catch { return "contacts"; } });
  const pickTab = (t: "contacts" | "kit") => { setTab(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } window.scrollTo(0, 0); };
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
  const headerH  = isMobile ? APP_HEADER_H.phone : APP_HEADER_H.wide;   // the shared top bar (the search bar sticks right below it)

  // the avatar sits on the right of the top bar; its menu opens to the left
  const avatar = (dropLeft: boolean) => (
    <AvatarMenu settings={settings} roleLabel="Outreach" dropLeft={dropLeft}
      items={ACCOUNTS.map(a => ({ key: a.key, label: a.label, active: work === a.key, onClick: () => pickAccount(a.key) }))}
      apps={appItems("outreach", switchTo)} onSignOut={() => { signOut(); }} />
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: SANS, color: C.black }}>
      <AppHeader isMobile={isMobile} avatar={avatar(false)} tabs={(h, px) => <>
        <NavTab label="Contacts"  active={tab === "contacts"} onClick={() => pickTab("contacts")} height={h} px={px} />
        <NavTab label="Email kit" active={tab === "kit"}      onClick={() => pickTab("kit")}      height={h} px={px} />
      </>} />
      <div style={{ maxWidth: isWide ? 1200 : 960, margin: "0 auto", padding: isMobile ? "14px 14px 28px" : "24px 20px 40px" }}>
        {banners}
        {tab === "contacts"
          ? <EmailList outreach={outreach} settings={settings} isMobile={isMobile} isWide={isWide} stickyTop={headerH} />
          : <EmailKit kit={emailKit} isMobile={isMobile} />}
      </div>
      <UndoBar />
    </div>
  );
}
