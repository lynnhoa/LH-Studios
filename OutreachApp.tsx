// ─────────────────────────────────────────────────────────────
// OutreachApp — Outreach (tabs: Dashboard · Contacts · Email kit · Comments). Same frame as the
// other apps: logo header, nav tab, account menu with all apps.
// The email list is one shared list: a pitch counts for the account of the contact's category
// (Setup) or of its template; Dashboard and Contacts have their own account switch / filter.
// Profile menu › This app › Setup (its only entry): the categories, tiers and follow-up days
// (opens under the tabs, no tab underlined — tap any tab to leave it, like Manager's menu pages).
// Phone, iPad and desktop layouts.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { C, SANS, BREAKPOINT, WIDE } from "./constants";
import AppLogo from "./AppLogo";
import { AvatarMenu, NavTab, appItems, AppHeader, APP_HEADER_H } from "./AppNav";
import { UndoBar } from "./undo";
import EmailList, { presetContactsView } from "./EmailList";
import OutreachDashboard from "./OutreachDashboard";
import EmailKit from "./EmailKit";
import Comments from "./Comments";
import SetupPage from "./SetupPage";
import { useOutreachLists } from "./useOutreachLists";
import { useOutreach } from "./useOutreach";
import { useEmailKit } from "./useEmailKit";
import { useComments } from "./useComments";
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
  const comments = useComments(userId);
  const lists    = useOutreachLists(userId);   // Setup: categories, tiers, follow-up days (the whole app reads them)
  // the open tab: Dashboard (first, like Manager) · Contacts (the email list) · Email kit · Comments — kept while the app is open
  // ("setup" = the Setup page from the profile menu)
  type Tab = "dashboard" | "contacts" | "kit" | "comments" | "setup";
  const TAB_KEY = "lh_outreach_tab";
  const [tab, setTab] = useState<Tab>(() => { try { const t = sessionStorage.getItem(TAB_KEY); return t === "contacts" || t === "kit" || t === "comments" || t === "setup" ? t : "dashboard"; } catch { return "dashboard"; } });
  const pickTab = (t: Tab) => { setTab(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } window.scrollTo(0, 0); };
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
      items={[{ key: "setup", label: "Setup", onClick: () => pickTab("setup") }]}
      apps={appItems("outreach", switchTo)} onSignOut={() => { signOut(); }} />
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: SANS, color: C.black }}>
      <AppHeader isMobile={isMobile} avatar={avatar(false)} tabs={(h, px) => <>
        <NavTab label="Dashboard" active={tab === "dashboard"} onClick={() => pickTab("dashboard")} height={h} px={px} />
        <NavTab label="Contacts"  active={tab === "contacts"} onClick={() => pickTab("contacts")} height={h} px={px} />
        <NavTab label="Email kit" active={tab === "kit"}      onClick={() => pickTab("kit")}      height={h} px={px} />
        <NavTab label="Comments"  active={tab === "comments"} onClick={() => pickTab("comments")} height={h} px={px} />
      </>} />
      <div style={{ maxWidth: isWide ? 1200 : 960, margin: "0 auto", padding: isMobile ? "14px 14px 28px" : "24px 20px 40px" }}>
        {banners}
        {tab === "dashboard"
          ? <OutreachDashboard outreach={outreach} isMobile={isMobile} onOpenContacts={(patch) => { presetContactsView(patch); pickTab("contacts"); }} />
          : tab === "contacts"
          ? <EmailList outreach={outreach} kit={emailKit} settings={settings} isMobile={isMobile} isWide={isWide} stickyTop={headerH} />
          : tab === "kit"
            ? <EmailKit kit={emailKit} isMobile={isMobile} />
            : tab === "setup"
              ? <SetupPage lists={lists} outreach={outreach} kit={emailKit} isMobile={isMobile} />
              : <Comments hook={comments} isMobile={isMobile} />}
      </div>
      <UndoBar />
    </div>
  );
}
