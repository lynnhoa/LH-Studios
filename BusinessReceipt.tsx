// ─────────────────────────────────────────────────────────────
// BusinessReceipt — one receipt (cost) in the shared window: one level,
// no Edit step (like the Outreach contact window). Footer: Add cost /
// Save while something is typed / Done. ⋯ : Add return · Delete cost.
//   Receipt   No. (worked out) · Date · What · Vendor · Amount · Category
//             · VAT (only without § 19) · Receipt no. · Business share
//   Business meal  Occasion · Guests (only for a business-meal category) — 70 % counts
//   Gift      Recipient — the 50 € a year per person
//   File      one PDF (a PDF, or photos that become its pages): View · Replace · Remove
// A return: "Return of K28", the refund typed as a plus amount, stored minus.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import { C, TYPE, PAL, SANS } from "./constants";
import {
  Sheet, SheetHead, SheetRow, SheetMeta, SheetErr, SheetButton, MoreMenu, MiniInput, MenuSelect, MiniArea, NumField,
  ConfirmDialog, useDraft, SHEET_CARD,
} from "./atoms";
import { fmt, today, r2 } from "./formatters";
import { showNote } from "./undo";
import { netOf, vatOf, countedOf, giftsTo, yearOf, GIFT_LIMIT, GWG_LIMIT, VAT_RATES } from "./business";
import type { BizCost } from "./business";
import type { BusinessHook } from "./useBusiness";
import { BizIco, BIZ_IC } from "./BusinessParts";

interface Draft {
  date: string; what: string; vendor: string; amount: number | null; categoryId: string; vatRate: string;
  receiptNo: string; sharePct: number | null; anlass: string; guests: string; recipient: string;
}
const link: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap" as const,
  WebkitTapHighlightColor: "transparent",
};
const muted: any = { color: C.muted, fontSize: TYPE.subtext.size };

export default function ReceiptWindow({ biz, costId, returnOf, caseId, defaultDate, ku, nums, onCreated, onReturn, onClose }: {
  biz: BusinessHook; costId: string | null; returnOf?: string | null; caseId?: string | null; defaultDate?: string; ku: boolean;
  nums: Map<string, string>; onCreated: (id: string) => void; onReturn: (id: string) => void; onClose: () => void;
}) {
  const isNew = costId === null;
  const cur = isNew ? null : biz.costs.find(c => c.id === costId) || null;
  const origId = cur ? cur.returnOf : returnOf || null;
  const orig = origId ? biz.costs.find(c => c.id === origId) || null : null;
  const isRet = cur ? !!cur.returnOf : !!returnOf;
  const cats = biz.cats;

  // a new cost: the category of the one added last (else Sonstiges, else the first)
  const firstCat = useMemo(() => {
    if (orig?.categoryId) return orig.categoryId;
    const last = [...biz.costs].filter(c => !!c.caseId === !!caseId && c.categoryId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
    return last?.categoryId || cats.find(c => /^(other|sonstig)/i.test(c.name))?.id || cats[0]?.id || "";
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const stored: Draft = cur ? {
    date: cur.date, what: cur.what, vendor: cur.vendor, amount: Math.abs(cur.amount), categoryId: cur.categoryId || "",
    vatRate: cur.vatRate === null ? "" : String(cur.vatRate), receiptNo: cur.receiptNo, sharePct: cur.sharePct,
    anlass: cur.anlass, guests: cur.guests, recipient: cur.recipient,
  } : {
    date: orig ? today() : defaultDate || today(), what: orig ? `Return: ${orig.what || orig.vendor}` : "", vendor: orig?.vendor || "", amount: orig ? Math.abs(orig.amount) : null,
    categoryId: firstCat, vatRate: orig ? (orig.vatRate === null ? "" : String(orig.vatRate)) : ku ? "" : "19", receiptNo: "",
    sharePct: orig?.sharePct ?? null, anlass: "", guests: "", recipient: orig?.recipient || "",
  };
  const dr = useDraft(stored, { frozen: isNew });
  const f = dr.d;
  const set = (p: Partial<Draft>) => dr.setD(x => ({ ...x, ...p }));
  const [err, setErr]       = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [pending, setPending] = useState<File[] | null>(null);     // a new cost: the file waits for Add
  const [ask, setAsk]       = useState<"delete" | "file" | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (!isNew && !cur) onClose(); }, [isNew, !!cur]);   // eslint-disable-line react-hooks/exhaustive-deps

  const cat = cats.find(c => c.id === f.categoryId) || null;
  const no = cur ? nums.get(cur.id) || "" : "";
  const share = f.sharePct ?? cat?.sharePct ?? 100;
  const signed = f.amount === null ? 0 : (isRet ? -1 : 1) * Math.abs(f.amount);
  const probe: BizCost = {
    ...(cur || ({} as any)), amount: signed, vatRate: ku || f.vatRate === "" ? null : Number(f.vatRate), sharePct: f.sharePct,
    categoryId: f.categoryId || null, date: f.date, recipient: f.recipient,
  };
  const net = netOf(probe, ku), vat = vatOf(probe, ku), counted = countedOf(probe, cat, ku);
  const giftSum = cat?.kind === "geschenk" && f.recipient.trim()
    ? r2(giftsTo(f.recipient, yearOf(f.date), biz.costs, cats, ku, cur?.id) + net) : 0;

  const save = async () => {
    if (busy) return;
    setErr(null);
    if (!f.date) { setErr("Pick the date."); return; }
    if (!(f.amount !== null && Math.abs(f.amount) > 0)) { setErr(isRet ? "Enter the refund." : "Enter the amount."); return; }
    if (!f.what.trim() && !f.vendor.trim()) { setErr("Add what it was or the vendor."); return; }
    const payload: Partial<BizCost> = {
      date: f.date, what: f.what, vendor: f.vendor, amount: signed, categoryId: f.categoryId || null,
      vatRate: ku || f.vatRate === "" ? null : Number(f.vatRate), receiptNo: f.receiptNo,
      sharePct: f.sharePct === null || r2(f.sharePct) === (cat?.sharePct ?? 100) ? null : Math.min(100, Math.max(0, r2(f.sharePct))),
      anlass: f.anlass, guests: f.guests, recipient: f.recipient,
    };
    setBusy(true);
    try {
      dr.saving();
      if (isNew) {
        const made = await biz.addCost({ ...payload, caseId: caseId || null, returnOf: returnOf || null });
        if (pending?.length) {
          try { await biz.attachFile(made, pending); }
          catch (e: any) { showNote(`Added ✓ · the file couldn't be added: ${e?.message || "try again"}`); onCreated(made.id); return; }
        }
        setPending(null);
        onCreated(made.id);
        showNote("Added ✓");
        return;
      }
      await biz.updateCost(cur!.id, payload);
      showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    if (fileRef.current) fileRef.current.value = "";
    if (isNew) { setPending(list); return; }
    if (!cur) return;
    setErr(null); setFileBusy(true);
    try { await biz.attachFile(cur, list); showNote(cur.filePath ? "File replaced ✓" : "File added ✓"); }
    catch (e: any) { setErr(e?.message || "The file couldn't be added."); }
    finally { setFileBusy(false); }
  };
  const view = () => { if (cur) biz.openFile(cur).catch((e: any) => setErr(e?.message || "The file couldn't be opened.")); };
  const dropFile = async () => {
    setAsk(null);
    if (!cur) return;
    setFileBusy(true);
    try { await biz.removeFile(cur); showNote("File removed"); }
    catch (e: any) { setErr(e?.message || "Couldn't remove the file."); }
    finally { setFileBusy(false); }
  };
  const del = async () => {
    setAsk(null);
    if (!cur) return;
    try { await biz.removeCost(cur); onClose(); showNote(`${no || "Receipt"} deleted`); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };

  const enter = (e: any) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } };
  const kind = isRet ? "return" : (caseId || cur?.caseId) ? "receipt" : "cost";
  const menu = cur ? [
    ...(!isRet && cur.amount > 0 ? [{ label: "Add return", onClick: () => onReturn(cur.id) }] : []),
    { label: `Delete ${kind}`, danger: true, onClick: () => setAsk("delete") },
  ] : [];
  const footer = isNew
    ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : `Add ${kind}`}</SheetButton>
    : dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
    : <SheetButton onClick={onClose}>Done</SheetButton>;
  const hasFile = !!cur?.filePath;

  return (
    <>
      {ask === "delete" && cur && (
        <ConfirmDialog title={`Delete ${no || kind}?`} text="The receipt and its file are removed." okLabel="Delete" danger
          onOk={del} onCancel={() => setAsk(null)} />
      )}
      {ask === "file" && cur && (
        <ConfirmDialog title="Remove the file?" text="The receipt stays, without its PDF." okLabel="Remove" danger
          onOk={dropFile} onCancel={() => setAsk(null)} />
      )}
      <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple aria-hidden="true" tabIndex={-1} style={{ display: "none" }}
        onChange={(e: any) => pickFiles(e.target.files)} />
      <Sheet title={isNew ? `New ${kind}` : `${isRet ? "Return" : "Receipt"} · ${no}`} onClose={onClose}
        dirty={dr.changed || !!pending} right={menu.length ? <MoreMenu items={menu} /> : null} footer={footer}>
        {err && <SheetErr>{err}</SheetErr>}

        <SheetHead first icon={<BizIco d={isRet ? BIZ_IC.back : BIZ_IC.receipt} size={11} />} label={isRet ? "Return" : "Receipt"} tone={PAL.neutral} />
        <div style={SHEET_CARD}>
          <SheetRow first label="No."><span style={{ fontSize: TYPE.row.size }}>{no || <span style={muted}>Automatic</span>}{no && <span style={muted}> · automatic</span>}</span></SheetRow>
          {isRet && <SheetRow label="Return of"><span style={{ fontSize: TYPE.row.size }}>{orig ? `${nums.get(orig.id) || ""} · ${orig.what || orig.vendor}` : "—"}</span></SheetRow>}
          <SheetRow label="Date"><MiniInput bare type="date" value={f.date} aria-label="Date" onChange={(e: any) => set({ date: e.target.value })} /></SheetRow>
          <SheetRow label="What"><MiniInput bare value={f.what} placeholder="Canva Pro, yearly" aria-label="What" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ what: e.target.value })} /></SheetRow>
          <SheetRow label="Vendor"><MiniInput bare value={f.vendor} placeholder="Canva" aria-label="Vendor" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ vendor: e.target.value })} /></SheetRow>
          <SheetRow label={isRet ? "Refund" : "Amount"} right={<span style={{ ...muted, paddingRight: 6 }}>€</span>}>
            <NumField mini bare value={f.amount} placeholder="0,00" ariaLabel={isRet ? "Refund" : "Amount"} onChange={(n) => set({ amount: n === null ? null : Math.abs(n) })} />
          </SheetRow>
          <SheetRow label="Category">
            <MenuSelect bare value={f.categoryId} aria-label="Category" onChange={(e: any) => set({ categoryId: e.target.value })}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </MenuSelect>
          </SheetRow>
          {!ku && (
            <SheetRow label="VAT">
              <MenuSelect bare value={f.vatRate} aria-label="VAT" onChange={(e: any) => set({ vatRate: e.target.value })}>
                {VAT_RATES.map(v => <option key={v} value={String(v)}>{v} %</option>)}
                <option value="">No VAT on the receipt</option>
              </MenuSelect>
            </SheetRow>
          )}
          <SheetRow label="Receipt no."><MiniInput bare value={f.receiptNo} placeholder="Invoice or order no." aria-label="Receipt no." enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ receiptNo: e.target.value })} /></SheetRow>
          <SheetRow label="Business" right={<span style={{ ...muted, paddingRight: 6 }}>%</span>}>
            <NumField mini bare value={share} minDec={0} ariaLabel="Business share" onChange={(n) => set({ sharePct: n })} />
          </SheetRow>
        </div>
        {f.amount !== null && Math.abs(f.amount) > 0 && (
          <SheetMeta>
            {ku ? "" : `Net ${fmt(net)} · VAT ${fmt(vat)} · `}Counts {fmt(counted)}
            {share !== 100 ? ` · ${share.toLocaleString("de-DE")} % business` : ""}{cat && cat.countsPct !== 100 ? ` · ${cat.name} ${cat.countsPct.toLocaleString("de-DE")} %` : ""} · worked out
          </SheetMeta>
        )}
        {cat?.kind === "technik" && net > GWG_LIMIT && (
          <SheetMeta s={{ color: PAL.waiting.ink }}>Over {fmt(GWG_LIMIT)} net: it counts over several years (depreciation) — your tax advisor spreads it.</SheetMeta>
        )}

        {cat?.kind === "bewirtung" && (
          <>
            <SheetHead icon={<BizIco d={BIZ_IC.food} size={11} />} label="Business meal" tone={PAL.neutral} />
            <div style={SHEET_CARD}>
              <SheetRow first label="Occasion"><MiniInput bare value={f.anlass} placeholder="Kick-off autumn campaign" aria-label="Occasion" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ anlass: e.target.value })} /></SheetRow>
              <SheetRow top label="Guests">
                <MiniArea value={f.guests} onChange={(v) => set({ guests: v })} placeholder="Anna Klein (Maison Clair), Lynn Hoa" ariaLabel="Guests" minRows={2} pad={[9, 0]} />
              </SheetRow>
            </div>
            <SheetMeta>70 % of a business meal counts. Occasion and guests go on its meal receipt.</SheetMeta>
          </>
        )}

        {cat?.kind === "geschenk" && (
          <>
            <SheetHead icon={<BizIco d={BIZ_IC.gift} size={11} />} label="Gift" tone={PAL.neutral} />
            <div style={SHEET_CARD}>
              <SheetRow first label="Recipient"><MiniInput bare value={f.recipient} placeholder="Anna Klein" aria-label="Recipient" enterKeyHint="done" onKeyDown={enter} onChange={(e: any) => set({ recipient: e.target.value })} /></SheetRow>
            </div>
            {giftSum > GIFT_LIMIT
              ? <SheetMeta s={{ color: PAL.waiting.ink }}>{f.recipient.trim()} got {fmt(giftSum)} from you in {yearOf(f.date)} — over the {fmt(GIFT_LIMIT)} a year, so none of it counts.</SheetMeta>
              : <SheetMeta>Up to {fmt(GIFT_LIMIT)} a year per person counts{giftSum > 0 ? ` · ${f.recipient.trim()}: ${fmt(giftSum)} in ${yearOf(f.date)}` : ""}.</SheetMeta>}
          </>
        )}

        <SheetHead icon={<BizIco d={hasFile ? BIZ_IC.check : BIZ_IC.file} size={11} />} label="File" tone={hasFile ? PAL.done : PAL.neutral} />
        <div style={SHEET_CARD}>
          {hasFile ? (
            <>
              <SheetRow first label="PDF" right={<span style={{ paddingRight: 6 }}><button onClick={view} style={link}>View</button></span>}>
                <span style={{ display: "block", fontSize: TYPE.row.size, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {cur!.fileName || "Receipt.pdf"}{cur!.filePages ? <span style={muted}> · {cur!.filePages} {cur!.filePages === 1 ? "page" : "pages"}</span> : null}
                </span>
              </SheetRow>
              <SheetRow label="">
                <span style={{ display: "inline-flex", gap: 14 }}>
                  <button onClick={() => fileRef.current?.click()} style={link} disabled={fileBusy}>{fileBusy ? "Saving…" : "Replace"}</button>
                  <button onClick={() => setAsk("file")} style={link} disabled={fileBusy}>Remove</button>
                </span>
              </SheetRow>
            </>
          ) : (
            <SheetRow first label="PDF" right={<span style={{ paddingRight: 6 }}><button onClick={() => fileRef.current?.click()} style={{ ...link, textDecoration: "none" }} disabled={fileBusy}>
              {fileBusy ? "Saving…" : pending ? "Change" : "+ Add file"}</button></span>}>
              <span style={{ fontSize: TYPE.row.size, color: pending ? C.black : C.muted }}>
                {pending ? `${pending.length} ${pending.length === 1 ? "file" : "files"} · added with the ${kind}` : "No file yet"}
              </span>
            </SheetRow>
          )}
        </div>
        <SheetMeta>A PDF, or photos — they become one PDF.</SheetMeta>
      </Sheet>
    </>
  );
}

