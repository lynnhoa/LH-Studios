// ─────────────────────────────────────────────────────────────
// SetupPage — Outreach › Setup (profile menu › This app › Setup).
// The lists the whole app reads: contact categories and tiers, and the
// follow-up days. Built only from the app's own parts (title, summary line,
// section heads, list cards and rows, the one Sheet window, Email kit's ↑ ↓,
// the Planner's number pills) — no new elements.
//   Categories  row: name · account (lavender / peach) · own templates · contacts
//               window: Name · Account · Templates · Used by — ⋯ Delete category
//   Tiers       row: name · contacts — window: Name · Used by — ⋯ Delete tier
//   + Add       the same window, empty (Add category / Add tier) — it then stays open as the new one
//   Sort        ↑ ↓ like Email kit, saved right away; the first category is the default for a new contact
//   Follow-up timing  Follow-up 1 · Follow-up 2 · No reply · Re-pitch — whole days, saved when you leave the number
// Delete: its contacts move to your pick (a tier: or no tier); templates and Planner sprints drop it.
// iPad / computer: Categories left · Tiers and timing right.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL, SPACING } from "./constants";
import {
  SummaryLine, Strong, SectionHead, ListCard, Row, MoveBtn, Cols, ValuePill, LoadErrorBanner,
  Sheet, SheetHead, SheetRow, SheetMeta, SheetErr, SheetButton, MoreMenu, MiniInput, MenuSelect, ConfirmDialog, useDraft, SHEET_CARD,
} from "./atoms";
import { CADENCE_MAX } from "./outreach";
import type { Cadence, Pipeline, OutreachContact } from "./outreach";
import { NAME_MAX, cleanName } from "./useOutreachLists";
import type { OutreachListsHook, ListKind } from "./useOutreachLists";
import { parseIntDe } from "./planner";
import { showNote } from "./undo";

const Ico = ({ d, size = 11 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
const TAG  = "M3 12V4h8l9 9-8 8zM7.5 7.5h.01";
const TIER = "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4";
// the small underlined links of a section head (like Email kit's Sort · + Add)
const linkBtn: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, textDecoration: "underline", textUnderlineOffset: 2, WebkitTapHighlightColor: "transparent",
};
const META: any = { fontSize: SPACING.listMeta, color: C.muted, margin: "6px 2px 0", lineHeight: 1.5 };

// the account in its colour (lavender @lynnhoa · peach @createbylynn, as everywhere)
const accInk  = (a: Pipeline) => (a === "ugc" ? PAL.createbylynn.ink : PAL.lynnhoa.ink);
const accName = (a: Pipeline) => (a === "ugc" ? "@createbylynn" : "@lynnhoa");
const n0 = (n: number) => n.toLocaleString("de-DE");
const contactsText = (n: number) => (n ? `${n0(n)} ${n === 1 ? "contact" : "contacts"}` : "no contacts yet");
const tally = (keys: string[]) => { const m: Record<string, number> = {}; keys.forEach(k => { if (k) m[k] = (m[k] || 0) + 1; }); return m; };
const usedBy = (nC: number, nT: number | null) => {
  const parts = [nC ? contactsText(nC) : "", nT ? `${n0(nT)} ${nT === 1 ? "template" : "templates"}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : nT === null ? "No contacts yet" : "No contacts or templates yet";
};

// the follow-up days, in the order they happen
const TIMING: { key: keyof Cadence; name: string; after: string }[] = [
  { key: "fu1",     name: "Follow-up 1", after: "after the pitch" },
  { key: "fu2",     name: "Follow-up 2", after: "after follow-up 1" },
  { key: "close",   name: "No reply",    after: "after follow-up 2" },
  { key: "repitch", name: "Re-pitch",    after: "after No reply / Declined" },
];

interface SetupPageProps { lists: OutreachListsHook; outreach: any; kit: any; isMobile: boolean; }

export default function SetupPage({ lists, outreach, kit, isMobile }: SetupPageProps) {
  const cats = lists.categories, tiers = lists.tiers;
  const [win, setWin]         = useState<{ kind: ListKind; key: string | null } | null>(null);   // key null = new
  const [sorting, setSorting] = useState<ListKind | null>(null);
  const [nonce, setNonce]     = useState(0);   // a number that couldn't be saved goes back to the stored one
  const contacts: OutreachContact[] = outreach?.contacts || [];
  const nCat  = useMemo(() => tally(contacts.map(c => c.category)), [contacts]);
  const nTier = useMemo(() => tally(contacts.map(c => c.tier)), [contacts]);
  const nTpl  = useMemo(() => tally((kit?.templates || []).flatMap((t: any) => t.categories || [])), [kit?.templates]);
  const readOnly = lists.missing || !!lists.loadError;
  useEffect(() => { if (readOnly) setSorting(null); }, [readOnly]);
  // contacts or templates changed on the server (a delete moved them, a category switched to UGC)
  const refresh = () => { outreach?.reload?.(); kit?.reload?.(); };

  const move = (kind: ListKind, i: number, dir: -1 | 1) => { lists.move(kind, i, dir).catch((e: any) => showNote(e?.message || "Couldn't save the order.")); };
  const saveDays = (k: keyof Cadence, raw: string) => {
    const n = parseIntDe(raw);
    if (n === null || n < 1 || n > CADENCE_MAX) { showNote(`Whole days from 1 to ${CADENCE_MAX}`); setNonce(x => x + 1); return; }
    if (n === lists.cadence[k]) return;
    lists.setDays(k, n).catch((e: any) => { showNote(e?.message || "Couldn't save."); setNonce(x => x + 1); });
  };

  const right = (kind: ListKind, n: number) => (readOnly ? undefined
    : sorting === kind ? <button onClick={() => setSorting(null)} style={linkBtn}>Done</button>
    : <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
        {n > 1 && <button onClick={() => setSorting(kind)} style={linkBtn}>Sort</button>}
        <button onClick={() => { setSorting(null); setWin({ kind, key: null }); }} style={{ ...linkBtn, textDecoration: "none" }}>+ Add</button>
      </span>);
  const arrows = (kind: ListKind, i: number, n: number, label: string) => (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <MoveBtn dir="up" label={`Move ${label} up`} off={i === 0} onClick={() => move(kind, i, -1)} />
      <MoveBtn dir="down" label={`Move ${label} down`} off={i === n - 1} onClick={() => move(kind, i, 1)} />
    </span>
  );

  const categories = (
    <>
      <SectionHead label="Categories" right={right("category", cats.length)} />
      <ListCard>
        {cats.map((c, i) => (
          <Row key={c.key} first={i === 0}
            onClick={sorting === "category" || readOnly ? undefined : () => setWin({ kind: "category", key: c.key })}
            title={c.label}
            meta={<><span style={{ color: accInk(c.account) }}>{accName(c.account)}</span>{c.ownTemplates ? " · own templates" : ""} · {contactsText(nCat[c.key] || 0)}</>}
            right={sorting === "category" ? arrows("category", i, cats.length, c.label) : undefined} />
        ))}
      </ListCard>
      <p style={META}>{sorting === "category"
        ? "This order is used everywhere: the contact window, filters, Email kit, Planner sprints and the Excel template."
        : "First on the list is the default for a new contact."}</p>
    </>
  );
  const tierList = (
    <>
      <SectionHead label="Tiers" right={right("tier", tiers.length)} />
      {tiers.length ? (
        <ListCard>
          {tiers.map((t, i) => (
            <Row key={t.key} first={i === 0}
              onClick={sorting === "tier" || readOnly ? undefined : () => setWin({ kind: "tier", key: t.key })}
              title={t.label} meta={contactsText(nTier[t.key] || 0)}
              right={sorting === "tier" ? arrows("tier", i, tiers.length, t.label) : undefined} />
          ))}
        </ListCard>
      ) : (
        <ListCard s={{ padding: "18px 14px", textAlign: "center" as const }}>
          <div style={{ fontSize: SPACING.listText }}>No tiers</div>
          <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 3 }}>Every contact is on No tier. Add one with + Add.</div>
        </ListCard>
      )}
    </>
  );
  const editableDays = !readOnly && !lists.timingMissing;
  const timing = (
    <>
      <SectionHead label="Follow-up timing" />
      <ListCard>
        {TIMING.map((t, i) => (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: SPACING.row1, padding: `0 ${SPACING.rowSide}px`, borderTop: i ? `1px solid ${C.hair}` : "none", fontFamily: SANS }}>
            <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" as const, overflow: "hidden" }}>
              <span style={{ fontSize: SPACING.listText, color: C.black }}>{t.name}</span>
              <span style={{ fontSize: SPACING.listMeta, color: C.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{t.after}</span>
            </span>
            {editableDays
              ? <ValuePill key={`${t.key}|${lists.cadence[t.key]}|${nonce}`} width={44} text={String(lists.cadence[t.key])} label={`${t.name}: days ${t.after}`} onCommit={(x) => saveDays(t.key, x)} />
              : <span style={{ width: 44, textAlign: "right" as const, paddingRight: 11, boxSizing: "border-box" as const, fontSize: TYPE.body.size }}>{lists.cadence[t.key]}</span>}
            <span style={{ width: 26, flexShrink: 0, fontSize: SPACING.listMeta, color: C.muted }}>days</span>
          </div>
        ))}
      </ListCard>
      <p style={META}>{lists.timingMissing && !readOnly
        ? "These are the built-in days. Run the Setup SQL in Supabase once to change them."
        : "Tap a number to change it. It's saved right away, and every contact's due dates follow."}</p>
    </>
  );

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Setup</h2>
      <SummaryLine dot={PAL.neutral.mid}>
        <span><Strong>{cats.length}</Strong> {cats.length === 1 ? "category" : "categories"} · <Strong>{tiers.length}</Strong> {tiers.length === 1 ? "tier" : "tiers"} · for Outreach and Planner</span>
      </SummaryLine>
      {lists.missing && (
        <p role="status" style={{ fontSize: TYPE.label.size, color: PAL.waiting.ink, margin: "8px 2px 0", lineHeight: 1.5 }}>
          Setup needs its SQL: run it once in Supabase. Until then the app uses the built-in lists below.
        </p>
      )}
      {lists.loadError && <div style={{ marginTop: 12 }}><LoadErrorBanner what="Your lists" message={lists.loadError} onRetry={() => { lists.reload(); }} /></div>}

      <Cols left={categories} right={<>{tierList}{timing}</>} />

      {win?.kind === "category" && (
        <CategoryWindow key="category" lists={lists} cKey={win.key} nCat={nCat} nTpl={nTpl} contacts={contacts}
          onCreated={(key) => setWin({ kind: "category", key })} onClose={() => setWin(null)} onChanged={refresh} />
      )}
      {win?.kind === "tier" && (
        <TierWindow key="tier" lists={lists} tKey={win.key} nTier={nTier}
          onCreated={(key) => setWin({ kind: "tier", key })} onClose={() => setWin(null)} onChanged={refresh} />
      )}
    </div>
  );
}

// ── One category: Name · Account · Templates · Used by — one level, no Edit step (like the contact window) ──
function CategoryWindow({ lists, cKey, nCat, nTpl, contacts, onCreated, onClose, onChanged }: {
  lists: OutreachListsHook; cKey: string | null; nCat: Record<string, number>; nTpl: Record<string, number>; contacts: OutreachContact[];
  onCreated: (key: string) => void; onClose: () => void; onChanged: () => void;
}) {
  const isNew = cKey === null;
  const cur = isNew ? null : lists.categories.find(c => c.key === cKey) || null;
  const stored = { label: cur?.label || "", account: (cur?.account || "lynnhoa") as Pipeline, own: !!cur?.ownTemplates };
  const dr = useDraft(stored, { frozen: isNew });
  const f = dr.d;
  const set = (p: Partial<typeof stored>) => dr.setD(x => ({ ...x, ...p }));
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { if (!isNew && !cur) onClose(); }, [isNew, !!cur]);   // eslint-disable-line react-hooks/exhaustive-deps

  const nC = cKey ? nCat[cKey] || 0 : 0, nT = cKey ? nTpl[cKey] || 0 : 0;
  const name = cleanName(f.label) || "this category";
  // switching to UGC: Gifted / Invited don't exist there → Replied (the same rule as for one contact)
  const nFit = !isNew && f.account === "ugc" && stored.account !== "ugc"
    ? contacts.filter(c => c.category === cKey && (c.status === "gifted" || c.status === "invited")).length : 0;

  const save = async () => {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      dr.saving();
      if (isNew) { const key = await lists.add("category", { label: f.label, account: f.account, ownTemplates: f.own }); onCreated(key); showNote("Added ✓"); return; }
      const r = await lists.update("category", cKey!, { label: f.label, account: f.account, ownTemplates: f.own });
      if (r.fitted) onChanged();
      showNote(r.fitted ? `Saved ✓ · ${contactsText(r.fitted)} now Replied` : "Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async (to?: string) => {
    setAskDelete(false); setErr(null);
    if (!cur) return;
    const toLabel = to ? lists.categories.find(c => c.key === to)?.label || "" : "";
    try {
      const r = await lists.remove("category", cur.key, to || null);
      onChanged(); onClose();
      showNote(r.contacts ? `${cur.label} deleted · ${contactsText(r.contacts)} moved to ${toLabel}` : `${cur.label} deleted`);
    } catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const askDel = () => { if (lists.categories.length <= 1) { setErr("Keep at least one category."); return; } setAskDelete(true); };
  const others = lists.categories.filter(c => c.key !== cKey);
  const enter = (e: any) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); if (isNew || dr.changed) save(); } };

  return (
    <>
      {askDelete && cur && (
        <ConfirmDialog title={`Delete ${cur.label}?`}
          text={nC ? `${contactsText(nC)} ${nC === 1 ? "uses" : "use"} it and move to the category you pick. Templates and Planner sprints that use it switch to Any.`
                   : "It's removed from every list. Templates and Planner sprints that use it switch to Any."}
          choice={nC ? { label: "Move contacts to", options: others.map(o => ({ value: o.key, label: o.label })) } : undefined}
          okLabel="Delete" danger onOk={(_d, to) => del(to)} onCancel={() => setAskDelete(false)} />
      )}
      <Sheet title={isNew ? "New category" : cur?.label || "Category"} onClose={onClose} dirty={dr.changed}
        right={isNew ? null : <MoreMenu items={[{ label: "Delete category", danger: true, onClick: askDel }]} />}
        footer={isNew ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Add category"}</SheetButton>
          : dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
          : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}
        <SheetHead first icon={<Ico d={TAG} />} label="Category" tone={PAL.neutral} />
        <div style={SHEET_CARD}>
          <SheetRow first label="Name">
            <MiniInput bare value={f.label} maxLength={NAME_MAX} autoFocus={isNew} enterKeyHint="done" placeholder="Bag" aria-label="Name"
              onChange={(e: any) => set({ label: e.target.value })} onKeyDown={enter} />
          </SheetRow>
          <SheetRow label="Account">
            <MenuSelect bare value={f.account} aria-label="Account" look={{ color: accInk(f.account) }} onChange={(e: any) => set({ account: e.target.value === "ugc" ? "ugc" : "lynnhoa" })}>
              <option value="lynnhoa">@lynnhoa</option>
              <option value="ugc">@createbylynn · UGC</option>
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Templates">
            <MenuSelect bare value={f.own ? "own" : "all"} aria-label="Templates" onChange={(e: any) => set({ own: e.target.value === "own" })}>
              <option value="all">All {f.account === "ugc" ? "UGC" : "@lynnhoa"} templates</option>
              <option value="own">Only templates for {name}</option>
            </MenuSelect>
          </SheetRow>
          {!isNew && <SheetRow label="Used by"><span style={{ fontSize: TYPE.row.size, color: C.ink2 }}>{usedBy(nC, nT)}</span></SheetRow>}
        </div>
        <SheetMeta>
          Account sets the statuses (UGC has no Gifted / Invited), the templates and which account a pitch counts for.
          {f.own ? ` Only templates for ${name}: like Hotel, its contacts only get the templates tagged ${name} in Email kit.` : ""}
        </SheetMeta>
        {nFit > 0 && <SheetMeta s={{ color: PAL.waiting.ink }}>On Save, {contactsText(nFit)} on Gifted / Invited {nFit === 1 ? "becomes" : "become"} Replied, because UGC has neither.</SheetMeta>}
        {f.own && nT === 0 && <SheetMeta s={{ color: PAL.waiting.ink }}>No template is tagged with {name} yet. Tag one in Email kit, or its contacts get none.</SheetMeta>}
      </Sheet>
    </>
  );
}

// ── One tier: Name · Used by — the same window, fewer rows ──
function TierWindow({ lists, tKey, nTier, onCreated, onClose, onChanged }: {
  lists: OutreachListsHook; tKey: string | null; nTier: Record<string, number>;
  onCreated: (key: string) => void; onClose: () => void; onChanged: () => void;
}) {
  const isNew = tKey === null;
  const cur = isNew ? null : lists.tiers.find(t => t.key === tKey) || null;
  const stored = { label: cur?.label || "" };
  const dr = useDraft(stored, { frozen: isNew });
  const f = dr.d;
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { if (!isNew && !cur) onClose(); }, [isNew, !!cur]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nC = tKey ? nTier[tKey] || 0 : 0;

  const save = async () => {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      dr.saving();
      if (isNew) { const key = await lists.add("tier", { label: f.label }); onCreated(key); showNote("Added ✓"); return; }
      await lists.update("tier", tKey!, { label: f.label });
      showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async (to?: string) => {
    setAskDelete(false); setErr(null);
    if (!cur) return;
    const toLabel = to ? lists.tiers.find(t => t.key === to)?.label || "" : "No tier";
    try {
      const r = await lists.remove("tier", cur.key, to || null);
      onChanged(); onClose();
      showNote(r.contacts ? `${cur.label} deleted · ${contactsText(r.contacts)} on ${toLabel}` : `${cur.label} deleted`);
    } catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const enter = (e: any) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); if (isNew || dr.changed) save(); } };

  return (
    <>
      {askDelete && cur && (
        <ConfirmDialog title={`Delete ${cur.label}?`}
          text={nC ? `${contactsText(nC)} ${nC === 1 ? "has" : "have"} this tier and get the one you pick. Planner sprints that use it switch to Any.`
                   : "It's removed from every list. Planner sprints that use it switch to Any."}
          choice={nC ? { label: "Their tier becomes", options: [{ value: "", label: "No tier" }, ...lists.tiers.filter(t => t.key !== tKey).map(t => ({ value: t.key, label: t.label }))] } : undefined}
          okLabel="Delete" danger onOk={(_d, to) => del(to)} onCancel={() => setAskDelete(false)} />
      )}
      <Sheet title={isNew ? "New tier" : cur?.label || "Tier"} onClose={onClose} dirty={dr.changed}
        right={isNew ? null : <MoreMenu items={[{ label: "Delete tier", danger: true, onClick: () => setAskDelete(true) }]} />}
        footer={isNew ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Add tier"}</SheetButton>
          : dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
          : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}
        <SheetHead first icon={<Ico d={TIER} />} label="Tier" tone={PAL.neutral} />
        <div style={SHEET_CARD}>
          <SheetRow first label="Name">
            <MiniInput bare value={f.label} maxLength={NAME_MAX} autoFocus={isNew} enterKeyHint="done" placeholder="Luxury" aria-label="Name"
              onChange={(e: any) => dr.setD(x => ({ ...x, label: e.target.value }))} onKeyDown={enter} />
          </SheetRow>
          {!isNew && <SheetRow label="Used by"><span style={{ fontSize: TYPE.row.size, color: C.ink2 }}>{usedBy(nC, null)}</span></SheetRow>}
        </div>
        <SheetMeta>Used in the contact window, the filters, Planner sprints and the Excel template.</SheetMeta>
      </Sheet>
    </>
  );
}
