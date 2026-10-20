// ─────────────────────────────────────────────────────────────
// CreatorProfile — Business profile: the business info on every PDF.
// Read view: the details in cards (label · value), Edit at the top.
// Edit: the same rows become fields; the bottom bar has Cancel · Save.
//   Save   writes all changes at once and reads them back (what the page then
//          shows is what's stored) → back to the read view with "Saved ✓".
//          If the database refuses, the reason stays in the bar with your typing.
//   Cancel back to the read view, nothing changed.
// Unsaved edits survive a tab switch (kept in memory); closing the app asks first.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL, SPACING, DENSITY } from "./constants";
import { SummaryLine, Strong, SectionHead, ListCard, MiniInput, Switch, Chip, PillBtn, BottomBar, BOTTOM_BAR_SPACE } from "./atoms";
import { SETTINGS_DEFAULT } from "./rateCards";
import { editLock } from "./saveStatus";
import type { Settings } from "./types";

interface CreatorProfileProps {
  settings:        any;
  updateSettings:  (u: any) => Promise<string | null>;   // null = saved, else the reason
  isMobile:        boolean;
}

const KEYS = Object.keys(SETTINGS_DEFAULT) as (keyof Settings)[];
const DEFAULT_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";
// edits not saved yet: kept while you visit another tab
let kept: Settings | null = null;

const diff = (saved: Settings, draft: Settings): Partial<Settings> => {
  const out: any = {};
  KEYS.forEach(k => { if (String(draft[k] ?? "") !== String(saved[k] ?? "")) out[k] = draft[k]; });
  return out;
};

const LABEL: any = { width: 84, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted };
const ROW: any   = { display: "flex", alignItems: "center", gap: 10, minHeight: DENSITY.row1, padding: "0 12px", boxSizing: "border-box" };
const HAIR       = `1px solid ${C.hair}`;
const VALUE: any = { flex: 1, minWidth: 0, fontSize: TYPE.row.size, color: C.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export default function CreatorProfile({ settings, updateSettings, isMobile }: CreatorProfileProps) {
  const saved: Settings = { ...SETTINGS_DEFAULT, ...settings };
  const [draft, setDraft] = useState<Settings | null>(() => kept);       // null = the read view
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState(false);
  const editing = draft !== null;

  useEffect(() => { kept = draft; }, [draft]);
  // no background reloads while you edit
  useEffect(() => (editing ? editLock.acquire() : undefined), [editing]);
  // closing / reloading the app with unsaved edits asks first
  useEffect(() => {
    if (!editing) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [editing]);
  // the app's "Saving… / Saved" toast sits above the bottom bar while it shows
  useEffect(() => {
    if (!editing) return;
    const root = document.documentElement.style;
    root.setProperty("--toast-lift", "calc(64px + env(safe-area-inset-bottom, 0px))");
    return () => { root.removeProperty("--toast-lift"); };
  }, [editing]);
  useEffect(() => { if (!savedNow) return; const t = setTimeout(() => setSavedNow(false), 5000); return () => clearTimeout(t); }, [savedNow]);

  const s = draft || saved;
  const changes = draft ? diff(saved, draft) : {};
  const nChanged = Object.keys(changes).length;
  const set = (k: keyof Settings, v: any) => setDraft(d => (d ? { ...d, [k]: v } : d));
  const startEdit = () => { setErr(null); setSavedNow(false); setDraft({ ...saved }); };
  const cancel = () => { setErr(null); setDraft(null); };
  const save = async () => {
    if (!draft || busy) return;
    if (nChanged === 0) { setDraft(null); return; }
    setBusy(true); setErr(null);
    const e = await updateSettings(changes);
    setBusy(false);
    if (e) { setErr(e); return; }                 // stay in Edit, typing kept
    setDraft(null); setSavedNow(true);
  };

  const ku = s.kleinunternehmer === true || (s.kleinunternehmer as any) === "true";
  const missing = [!(s.name || s.company) && "name", (!s.street || !s.city) && "address", !s.iban && "IBAN"].filter(Boolean) as string[];

  // one row: label · value (read) or the field (edit)
  const field = (k: keyof Settings, placeholder: string, opts: { type?: string; inputMode?: string } = {}) =>
    editing
      ? <MiniInput value={String(s[k] ?? "")} onChange={(e: any) => set(k, e.target.value)} placeholder={placeholder} aria-label={String(k)} type={opts.type} inputMode={opts.inputMode as any} s={{ flex: 1 }} />
      : <span style={{ ...VALUE, color: s[k] ? C.black : C.light }}>{String(s[k] || "—")}</span>;
  const row = (label: string, body: any, first = false) => (
    <div style={{ ...ROW, borderTop: first ? "none" : HAIR }}><span style={LABEL}>{label}</span>{body}</div>
  );
  const head = (label: string) => <SectionHead dot={PAL.neutral.mid} label={label} />;

  const summary = editing
    ? <SummaryLine dot={nChanged ? PAL.waiting.mid : PAL.neutral.mid}>{nChanged ? <Strong color={PAL.waiting.ink}>Unsaved changes</Strong> : "Editing"} · nothing is saved until you tap Save</SummaryLine>
    : savedNow
      ? <SummaryLine dot={PAL.done.mid}><Strong color={PAL.done.ink}>Saved ✓</Strong> · on every new PDF</SummaryLine>
      : <SummaryLine dot={missing.length ? PAL.waiting.mid : PAL.done.mid}>On every new PDF{missing.length ? <> · <Strong color={PAL.waiting.ink}>Missing: {missing.join(", ")}</Strong></> : ""}</SummaryLine>;

  return (
    <div style={{ paddingBottom: editing ? BOTTOM_BAR_SPACE + (err ? 28 : 0) : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Business profile</h2>
        {!editing && <PillBtn onClick={startEdit}>Edit</PillBtn>}
      </div>
      {summary}

      {head("Identity")}
      <ListCard>
        {row("Name", field("name", "Lynn Hoa"), true)}
        {row("Business", field("company", "Lynn Hoa Studio"))}
        {row("Phone", field("phone", "+49 … (optional)", { type: "tel", inputMode: "tel" }))}
      </ListCard>

      {head("Address")}
      <ListCard>
        {row("Street", field("street", "Musterstraße 12"), true)}
        {row("PLZ · City", editing
          ? <><MiniInput value={s.plz} onChange={(e: any) => set("plz", e.target.value)} placeholder="55116" aria-label="plz" inputMode="numeric" s={{ width: 64, flex: "0 0 64px" }} />
              <MiniInput value={s.city} onChange={(e: any) => set("city", e.target.value)} placeholder="Mainz" aria-label="city" s={{ flex: 1 }} /></>
          : <span style={{ ...VALUE, color: s.plz || s.city ? C.black : C.light }}>{[s.plz, s.city].filter(Boolean).join(" ") || "—"}</span>)}
        {row("Country", field("country", "Deutschland"))}
      </ListCard>

      {head("Online")}
      <ListCard>
        {row("Email", field("email", "hello@lynnhoa.com", { type: "email", inputMode: "email" }), true)}
        {row("Website", field("website", "lynnhoa.com", { inputMode: "url" }))}
      </ListCard>

      {head("Banking")}
      <ListCard>
        {row("Bank", field("bankName", "Commerzbank"), true)}
        {row("IBAN", field("iban", "DE89 …"))}
        {row("BIC", field("bic", "COBADEFFXXX"))}
        {row("PayPal", field("paypalEmail", "optional", { type: "email", inputMode: "email" }))}
      </ListCard>

      {head("Tax")}
      <ListCard>
        {row("§ 19 UStG", <>
          <span style={VALUE}>{ku ? "Kleinunternehmer" : "Not used"}</span>
          {editing && <span style={{ marginRight: -8 }}><Switch on={ku} label="Kleinunternehmer (§ 19 UStG)"
            onChange={(v) => setDraft(d => (d ? { ...d, kleinunternehmer: v, taxNote: v ? (d.taxNote || DEFAULT_NOTE) : "" } : d))} /></span>}
        </>, true)}
        {row("Tax number", field("steuernummer", "12/345/67890"))}
        {row("VAT ID", field("ustIdNr", "DE123456789"))}
        {ku
          ? row("§ 19 note", field("taxNote", DEFAULT_NOTE))
          : row("VAT", editing
              ? <span style={{ display: "flex", gap: 5 }}>{[19, 7].map(r => <Chip key={r} on={Number(s.vatRate || 19) === r} tone={PAL.neutral} dot={false} label={r === 19 ? "19 %" : "7 % reduced"} onClick={() => set("vatRate", r)} />)}</span>
              : <span style={VALUE}>{Number(s.vatRate || 19) === 7 ? "7 % (reduced)" : "19 %"}</span>)}
      </ListCard>
      <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "6px 4px 0", lineHeight: 1.5 }}>
        {ku ? "No VAT on invoices. The § 19 note is printed on German PDFs; English PDFs use the English version."
            : `${s.vatRate || 19} % VAT is added for clients in Germany. EU business clients with a VAT ID get a reverse-charge note, clients outside the EU a "not taxable in Germany" note.`}
      </p>

      {editing && (
        <BottomBar>
          <div style={{ flex: 1, minWidth: 0 }}>
            {err && <div role="alert" style={{ fontSize: TYPE.subtext.size, color: C.red, lineHeight: 1.4, margin: "0 2px 9px" }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <PillBtn onClick={cancel} s={{ height: 38, padding: "0 16px", fontSize: TYPE.row.size, justifyContent: "center", flex: isMobile ? 1 : "0 0 auto", minWidth: isMobile ? 0 : 150 }}>Cancel</PillBtn>
              <PillBtn dark dim={busy} onClick={save} s={{ height: 38, padding: "0 16px", fontSize: TYPE.row.size, justifyContent: "center", flex: isMobile ? 1 : "0 0 auto", minWidth: isMobile ? 0 : 150 }}>{busy ? "Saving…" : "Save"}</PillBtn>
            </div>
          </div>
        </BottomBar>
      )}
    </div>
  );
}
