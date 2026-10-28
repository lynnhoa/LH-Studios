// ─────────────────────────────────────────────────────────────
// BusinessSetup — Business › Setup (profile menu › This app › Setup),
// like Outreach's Setup: the categories the whole app reads.
//   row     name · tax group (EÜR) · what counts · what it asks for · receipts
//   window  Name · Tax group · Counts % · Business % · Kind — ⋯ Delete category
//   + Add   the same window, empty · Sort ↑ ↓ (saved right away; this order is
//           the receipt window's list)
// Delete: its receipts move to the category you pick.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL, SPACING } from "./constants";
import {
  SummaryLine, SectionHead, ListCard, Row, MoveBtn, Sheet, SheetHead, SheetRow, SheetMeta, SheetErr, SheetButton, MoreMenu,
  MiniInput, MenuSelect, NumField, ConfirmDialog, useDraft, SHEET_CARD,
} from "./atoms";
import { showNote } from "./undo";
import type { BizCategory, CatKind } from "./business";
import type { BusinessHook } from "./useBusiness";
import { BizIco, BIZ_IC } from "./BusinessParts";

const linkBtn: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, textDecoration: "underline", textUnderlineOffset: 2, WebkitTapHighlightColor: "transparent",
};
const KINDS: [CatKind, string][] = [
  ["normal", "Normal"], ["bewirtung", "Business meal · occasion and guests"], ["geschenk", "Gift · recipient, 50 € a year"], ["technik", "Equipment · the 800 € note"],
];
const asks = (k: CatKind) => (k === "bewirtung" ? "asks occasion and guests" : k === "geschenk" ? "asks the recipient" : k === "technik" ? "800 € note" : "");
const n0 = (n: number) => n.toLocaleString("de-DE");
const receiptsText = (n: number) => (n ? `${n0(n)} ${n === 1 ? "receipt" : "receipts"}` : "no receipts yet");

export default function BusinessSetup({ biz, isMobile }: { biz: BusinessHook; isMobile: boolean }) {
  const cats = [...biz.cats].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const [win, setWin] = useState<string | null | undefined>(undefined);   // undefined = closed · null = new
  const [sorting, setSorting] = useState(false);
  const used = (id: string) => biz.costs.filter(c => c.categoryId === id).length;
  const move = (i: number, dir: -1 | 1) => { biz.moveCat(i, dir).catch((e: any) => showNote(e?.message || "Couldn't save the order.")); };
  const meta = (c: BizCategory) => [c.group || "no tax group", c.countsPct !== 100 ? `counts ${n0(c.countsPct)} %` : "", c.sharePct !== 100 ? `business ${n0(c.sharePct)} %` : "", asks(c.kind), receiptsText(used(c.id))].filter(Boolean).join(" · ");

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Setup</h2>
      <SummaryLine dot={PAL.neutral.mid}>{cats.length} {cats.length === 1 ? "category" : "categories"}</SummaryLine>
      <SectionHead label="Categories" right={biz.missing ? undefined : sorting
        ? <button onClick={() => setSorting(false)} style={linkBtn}>Done</button>
        : <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
            {cats.length > 1 && <button onClick={() => setSorting(true)} style={linkBtn}>Sort</button>}
            <button onClick={() => { setSorting(false); setWin(null); }} style={{ ...linkBtn, textDecoration: "none" }}>+ Add</button>
          </span>} />
      {biz.missing ? (
        <ListCard s={{ padding: "14px", fontSize: TYPE.row.size, color: PAL.waiting.ink, background: PAL.waiting.wash, border: `1px solid ${PAL.waiting.fill}` }}>{biz.loadError}</ListCard>
      ) : (
        <ListCard>
          {cats.map((c, i) => (
            <Row key={c.id} first={i === 0} title={c.name} meta={meta(c)}
              onClick={sorting ? undefined : () => setWin(c.id)}
              right={sorting ? (
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <MoveBtn dir="up" label={`Move ${c.name} up`} off={i === 0} onClick={() => move(i, -1)} />
                  <MoveBtn dir="down" label={`Move ${c.name} down`} off={i === cats.length - 1} onClick={() => move(i, 1)} />
                </span>) : undefined} />
          ))}
        </ListCard>
      )}
      <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "6px 2px 0", lineHeight: 1.5 }}>
        {sorting ? "This order is the list in the receipt window." : "The tax group (German) is what the bookkeeping files sum by. Counts: how much of it counts (business meals 70 %). Business: the usual business share."}
      </p>
      {win !== undefined && <CategoryWindow biz={biz} id={win} used={win ? used(win) : 0} onCreated={(id) => setWin(id)} onClose={() => setWin(undefined)} />}
    </div>
  );
}

function CategoryWindow({ biz, id, used, onCreated, onClose }: { biz: BusinessHook; id: string | null; used: number; onCreated: (id: string) => void; onClose: () => void }) {
  const isNew = id === null;
  const cur = isNew ? null : biz.cats.find(c => c.id === id) || null;
  const stored = { name: cur?.name || "", group: cur?.group || "", countsPct: cur ? cur.countsPct : 100 as number | null, sharePct: cur ? cur.sharePct : 100 as number | null, kind: (cur?.kind || "normal") as CatKind };
  const dr = useDraft(stored, { frozen: isNew });
  const f = dr.d;
  const set = (p: Partial<typeof stored>) => dr.setD(x => ({ ...x, ...p }));
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDel, setAskDel] = useState(false);
  useEffect(() => { if (!isNew && !cur) onClose(); }, [isNew, !!cur]);   // eslint-disable-line react-hooks/exhaustive-deps
  const others = biz.cats.filter(c => c.id !== id).sort((a, b) => a.sort - b.sort);

  const save = async () => {
    if (busy) return;
    setErr(null);
    const name = f.name.trim();
    if (!name) { setErr("Add a name."); return; }
    if (biz.cats.some(c => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase())) { setErr("A category with this name exists already."); return; }
    const patch = { name, group: f.group, countsPct: f.countsPct ?? 100, sharePct: f.sharePct ?? 100, kind: f.kind };
    setBusy(true);
    try {
      dr.saving();
      if (isNew) { const made = await biz.addCat(patch); onCreated(made.id); showNote("Added ✓"); return; }
      await biz.updateCat(cur!.id, patch);
      showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async (to?: string) => {
    setAskDel(false);
    if (!cur) return;
    try { await biz.removeCat(cur.id, used ? to || null : null); onClose(); showNote(`${cur.name} deleted`); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const enter = (e: any) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } };

  return (
    <>
      {askDel && cur && (
        <ConfirmDialog title={`Delete ${cur.name}?`}
          text={used ? `${receiptsText(used)} ${used === 1 ? "uses" : "use"} it and move to the category you pick.` : "It's removed from the list."}
          choice={used ? { label: "Move receipts to", options: others.map(o => ({ value: o.id, label: o.name })) } : undefined}
          okLabel="Delete" danger onOk={(_d, to) => del(to)} onCancel={() => setAskDel(false)} />
      )}
      <Sheet title={isNew ? "New category" : cur?.name || "Category"} onClose={onClose} dirty={dr.changed}
        right={isNew ? null : <MoreMenu items={[{ label: "Delete category", danger: true, onClick: () => { if (biz.cats.length <= 1) setErr("Keep at least one category."); else setAskDel(true); } }]} />}
        footer={isNew ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Add category"}</SheetButton>
          : dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
          : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}
        <SheetHead first icon={<BizIco d={BIZ_IC.receipt} size={11} />} label="Category" tone={PAL.neutral} />
        <div style={SHEET_CARD}>
          <SheetRow first label="Name"><MiniInput bare value={f.name} placeholder="Props and styling" aria-label="Name" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ name: e.target.value })} /></SheetRow>
          <SheetRow label="Tax group"><MiniInput bare value={f.group} placeholder="Content-Produktion" aria-label="Tax group" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ group: e.target.value })} /></SheetRow>
          <SheetRow label="Counts" right={<span style={{ color: C.muted, fontSize: TYPE.subtext.size, paddingRight: 6 }}>%</span>}>
            <NumField mini bare value={f.countsPct} minDec={0} ariaLabel="Counts %" onChange={(n) => set({ countsPct: n })} />
          </SheetRow>
          <SheetRow label="Business" right={<span style={{ color: C.muted, fontSize: TYPE.subtext.size, paddingRight: 6 }}>%</span>}>
            <NumField mini bare value={f.sharePct} minDec={0} ariaLabel="Business share %" onChange={(n) => set({ sharePct: n })} />
          </SheetRow>
          <SheetRow label="Kind">
            <MenuSelect bare value={f.kind} aria-label="Kind" onChange={(e: any) => set({ kind: e.target.value as CatKind })}>
              {KINDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </MenuSelect>
          </SheetRow>
          {!isNew && <SheetRow label="Used by"><span style={{ fontSize: TYPE.row.size, color: C.ink2 }}>{receiptsText(used)}</span></SheetRow>}
        </div>
        <SheetMeta>Counts: how much of a receipt counts (business meals 70 %). Business: the usual business share — a receipt can change it. The tax group is German, for the bookkeeping files.</SheetMeta>
      </Sheet>
    </>
  );
}
