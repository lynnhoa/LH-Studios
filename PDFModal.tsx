import { createPortal } from "react-dom";
// ─────────────────────────────────────────────────────────────
// PDFModal — the one document window
// Top bar: ✕ · EN/DE · status. Bottom bar (where "Preview quote" sits in the
// Calculator): the main button on the right = the next step, at most one more on
// the left. Rare actions sit under the page.
//   not saved   Save draft · Send to client
//   draft       Edit · Send to client          under the page: Share draft …
//   editing     Cancel · Save                  Save returns to the read view
//   sent …      Share PDF · the next step (Mark signed / Mark paid)
//               or the caller's side action (Revise) · Share PDF
// Send to client opens the phone's share sheet in the same tap — the PDF is made
// in the background while the window is open. Once it's shared, the draft is
// marked sent; closing the share sheet changes nothing. An invoice is asked once
// first, because it gets its number before the PDF. On a computer: download.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from "react";
import { C, SANS, SERIF, TYPE, Z, PAL, TRACK, ICON, RADIUS, SHADOW } from "./constants";
import type { Tone } from "./constants";
import { I, B, Lbl, ConfirmDialog, LangSwitch, NumField, PillBtn } from "./atoms";
import { isMobileDevice } from "./PDFExport";
import { editLock } from "./saveStatus";
import { fmt, r2 } from "./formatters";
import DocPages, { buildDocPdf } from "./DocPages";
import { clauseContext, clauseTemplates, fillTokens, tokenizeClause } from "./A4Document";
import { STATUS_LABEL, docFileName, lineAmt, lineQty } from "./docs";
import { requantify, lineBase } from "./pricing";
import { sentVersion } from "./docFlow";
import type { DocView } from "./docs";

export interface DocAction {
  key:      string;
  label:    string;
  kind?:    "pri" | "sec" | "danger";
  // main = right (the next step) · side = left · more = under the page
  // (default: pri → main, sec → side, danger → more)
  slot?:    "main" | "side" | "more";
  confirm?: string;                       // ask before running
  date?:    string;                       // ask for a date (label) before running
  run:      (date?: string) => Promise<void> | void;
}

interface PDFModalProps {
  doc:        DocView;
  settings:   any;
  client?:    any;
  editable:   boolean;
  isNew?:     boolean;
  justSaved?: boolean;
  note?:      string;
  onSave?:    (next: DocView) => Promise<DocView | void>;   // returns the stored document
  onPdf?:     (d: DocView) => Promise<DocView>;            // once sent: mark sent / an invoice gets its number
  pdfConfirm?:(d: DocView) => string | null;               // one question before sending (invoice number)
  sendBlock?: (d: DocView) => string | null;               // stops sending (invoice checklist)
  actions?:   DocAction[];
  onClose:    () => void;
}

const clone = (x: any) => JSON.parse(JSON.stringify(x));
const slotOf = (a: DocAction) => a.slot || (a.kind === "pri" ? "main" : a.kind === "danger" ? "more" : "side");
const SENDABLE = ["quote", "contract", "amendment", "invoice"];

// palette meaning: draft = maybe · sent = waiting · signed = in progress · paid = done · cancelled = late
const DOC_TONE: Record<string, Tone> = {
  draft: "neutral", sent: "waiting", signed: "progress", paid: "done", cancelled: "late", superseded: "neutral",
};

// A PDF made for the share sheet (or the download on a computer)
interface Built { key: string; name: string; file: File; url: string }
type Outcome = "shared" | "closed" | "blocked" | "saved";
const keyOf = (d: DocView) => JSON.stringify(d);

// Opens the phone's share sheet — straight from the tap, nothing slow before it, or the
// phone refuses ("blocked"). Closed sheet → "closed". Computer: the PDF is downloaded.
function deliver(b: Built): Promise<Outcome> {
  const nav: any = navigator;
  let can = false;
  try { can = !!(nav.canShare && nav.share && nav.canShare({ files: [b.file] })); } catch { can = false; }
  if (can) {
    return nav.share({ files: [b.file], title: b.name }).then(
      () => "shared" as Outcome,
      (e: any) => e?.name === "AbortError" ? "closed" as Outcome : e?.name === "NotAllowedError" ? "blocked" as Outcome : Promise.reject(e),
    );
  }
  if (isMobileDevice()) { window.open(b.url, "_blank"); return Promise.resolve("saved" as Outcome); }
  const a = document.createElement("a");
  a.href = b.url; a.download = `${b.name}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  return Promise.resolve("saved" as Outcome);
}

// Quantity of a line in the edit panel: type freely; the line is priced again once you
// leave the field (or press Enter), so in-between numbers never touch the price.
function QtyInput({ value, onCommit }: { value: number; onCommit: (q: number) => void }) {
  const [t, setT] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(String(value)); }, [value, focus]);
  const commit = () => { const n = parseInt(t); if (n >= 1 && n !== value) onCommit(n); else setT(String(value)); };
  return (
    <I type="text" inputMode="numeric" value={t} aria-label="Quantity"
      onFocus={() => setFocus(true)}
      onBlur={() => { setFocus(false); commit(); }}
      onKeyDown={(e: any) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      onChange={(e: any) => setT(String(e.target.value).replace(/[^\d]/g, ""))} />
  );
}

export default function PDFModal({
  doc, settings, client, editable, isNew, note, onSave, onPdf, pdfConfirm, sendBlock, actions = [], onClose,
}: PDFModalProps) {
  const [hs,         setHs]         = useState({ hist: [clone(doc)], idx: 0 });
  const [lang,       setLang]       = useState<"en" | "de">(doc.lang || "en");
  const [panelW,     setPanelW]     = useState(380);
  const [saving,     setSaving]     = useState(false);
  const [busy,       setBusy]       = useState<string | null>(null);
  const [msg,        setMsg]        = useState<{ text: string; err?: boolean } | null>(null);
  const [showEdit,   setShowEdit]   = useState(false);
  const [askDiscard, setAskDiscard] = useState<"cancel" | "close" | null>(null);
  const [dialog,     setDialog]     = useState<{ action: DocAction } | null>(null);
  const [pdfAsk,     setPdfAsk]     = useState<string | null>(null);
  const [blockMsg,   setBlockMsg]   = useState<string | null>(null);
  const [winW,       setWinW]       = useState(() => window.innerWidth);

  const baseRef  = useRef<string>(JSON.stringify({ ...clone(doc), lang: doc.lang || "en" }));
  const pagesRef = useRef<HTMLDivElement>(null);
  // the latest props, for work that continues after a save (the window may get the saved document)
  const propsRef = useRef({ settings, client, onPdf });
  propsRef.current = { settings, client, onPdf };
  // PDFs made in the background: one promise per content, and the finished ones for an instant share
  const cache = useRef(new Map<string, Promise<Built>>());
  const done  = useRef(new Map<string, Built>());
  const alive = useRef(true);

  const staged   = hs.hist[hs.idx] as DocView;
  const current  = useMemo(() => ({ ...staged, lang } as DocView), [staged, lang]);
  const dirty    = editable && JSON.stringify(current) !== baseRef.current;
  const isMobile = winW < 768;
  const pageScale = isMobile ? Math.min(1, (winW - 32) / 595) : 1;
  const canEdit  = editable && !!onSave;
  const editing  = canEdit && showEdit && !isNew;
  const isDraft  = current.status === "draft";
  const canSend  = isDraft && SENDABLE.includes(current.kind) && !!onPdf && (!isNew || !!onSave);
  const settingsReady = !(settings && settings.__ready === false);

  // What "Send to client" / "Share PDF" hands over: a saved draft as it will be once sent
  // (no DRAFT mark, sender and client frozen in), a locked document as it is.
  const target = useMemo<DocView | null>(() => {
    if (isNew || dirty) return null;
    if (!isDraft) return current;
    return canSend ? sentVersion(current, settings, client) : null;
  }, [current, isNew, dirty, isDraft, canSend, settings, client]);
  const targetKey = target ? keyOf(target) : null;

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // no background reloads while a document is open
  useEffect(() => editLock.acquire(), []);

  // the app's "Saving… / Saved ✓" toast sits above the bottom bar while the window is open
  useEffect(() => {
    alive.current = true;
    const root = document.documentElement.style;
    root.setProperty("--toast-lift", "calc(64px + env(safe-area-inset-bottom, 0px))");
    return () => {
      root.removeProperty("--toast-lift");
      alive.current = false;
      done.current.forEach(b => URL.revokeObjectURL(b.url));
      done.current.clear();
      cache.current.clear();
    };
  }, []);

  // A fresh document from the parent (after Save, Send, Mark paid …):
  // take it over unless the user is in the middle of editing.
  useEffect(() => {
    const incoming = JSON.stringify({ ...clone(doc), lang: doc.lang || "en" });
    if (incoming === baseRef.current) return;
    if (!dirty) {
      setHs({ hist: [clone(doc)], idx: 0 });
      setLang(doc.lang || "en");
      baseRef.current = incoming;
    }
  }, [doc]);   // eslint-disable-line react-hooks/exhaustive-deps

  // a hint fades after a while; an error stays until the next tap
  useEffect(() => {
    if (!msg || msg.err) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  const say  = (text: string, err = false) => { if (alive.current) setMsg({ text, err }); };
  const fail = (e: any) => say(e?.message || "Something went wrong", true);

  // ── History ─────────────────────────────────────────────────
  const setStaged = (fn: (p: DocView) => DocView) =>
    setHs(prev => {
      const next = [...prev.hist.slice(0, prev.idx + 1), clone(fn(prev.hist[prev.idx]))];
      return { hist: next, idx: next.length - 1 };
    });
  const setData = (fn: (d: any) => any) => setStaged(p => ({ ...p, data: fn(p.data || {}) }));
  const canUndo = hs.idx > 0;
  const canRedo = hs.idx < hs.hist.length - 1;
  const undo = () => canUndo && setHs(p => ({ ...p, idx: p.idx - 1 }));
  const redo = () => canRedo && setHs(p => ({ ...p, idx: p.idx + 1 }));

  // ── The PDF, made in the background ─────────────────────────
  const buildFor = (d: DocView): Promise<Built> => {
    const key = keyOf(d);
    const hit = cache.current.get(key);
    if (hit) return hit;
    const { settings: st, client: cl } = propsRef.current;
    if (st && st.__ready === false && !d.data?.sender) return Promise.reject(new Error("Your profile is still loading — try again in a moment."));
    const p = buildDocPdf(d, st, cl).then((pdf: any) => {
      const blob: Blob = pdf.output("blob");
      const name = docFileName(d);
      const b: Built = { key, name, file: new File([blob], `${name}.pdf`, { type: "application/pdf" }), url: URL.createObjectURL(blob) };
      done.current.set(key, b);
      return b;
    });
    p.catch(() => { cache.current.delete(key); });
    cache.current.set(key, p);
    // keep only the last few versions
    while (cache.current.size > 4) {
      const old = cache.current.keys().next().value as string;
      cache.current.delete(old);
      const ob = done.current.get(old);
      if (ob) { URL.revokeObjectURL(ob.url); done.current.delete(old); }
    }
    return p;
  };
  // ready as soon as the window shows the document (and again after every change)
  useEffect(() => {
    if (!target || editing || !settingsReady) return;
    const t = setTimeout(() => { buildFor(target).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [targetKey, editing, settingsReady]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ────────────────────────────────────────────────────
  const save = async (): Promise<boolean> => {
    if (!onSave || saving) return false;
    setSaving(true); setMsg(null);
    try {
      await onSave(current);
      baseRef.current = JSON.stringify(current);
      setShowEdit(false);                     // back to the read view
      return true;
    } catch (e: any) {
      say(e?.message || "Save failed", true);
      return false;
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  // EN / DE on a saved draft is kept right away (it's not an edit)
  const changeLang = (l: "en" | "de") => {
    if (l === lang) return;
    setLang(l);
    if (canEdit && !isNew && !editing && onSave) {
      const next = { ...staged, lang: l } as DocView;
      baseRef.current = JSON.stringify(next);
      onSave(next).catch(fail);
    }
  };

  // ── Send to client ──────────────────────────────────────────
  const markSent = async (d: DocView) => {
    const fn = propsRef.current.onPdf;
    if (!fn || d.status !== "draft") return;
    setBusy("send");
    try { await fn(d); }
    catch (e: any) { say(`It was shared, but couldn't be marked as sent (${e?.message || "error"}). Tap Send to client again.`, true); }
    finally { if (alive.current) setBusy(null); }
  };
  const afterSend = async (o: Outcome, d: DocView, numbered: boolean) => {
    if (o === "shared" || o === "saved") { if (!numbered) await markSent(d); return; }
    if (numbered) { say(d.kind === "invoice" ? `${d.docNo} is final. Tap Share PDF to send it.` : "It's marked as sent. Tap Share PDF to send it."); return; }
    if (o === "blocked") say("The PDF is ready. Tap Send to client again.");
  };
  // slow way: save first / an invoice gets its number, then the PDF, then the share sheet
  const sendSlow = async () => {
    setBusy("send"); setMsg(null);
    try {
      let d: DocView = current;
      if (canEdit && (isNew || dirty)) {
        setSaving(true);
        const res = await onSave!(current);
        setSaving(false);
        if (res) d = res as DocView;
        baseRef.current = JSON.stringify(current);
        await new Promise(r => setTimeout(r, 60));   // the window takes the saved document
      }
      d = { ...d, lang } as DocView;
      let numbered = false;
      let send: DocView | null;
      if (d.kind === "invoice" && d.status === "draft") {
        const fn = propsRef.current.onPdf;
        if (!fn) throw new Error("This invoice can't be sent from here.");
        d = { ...(await fn(d)), lang } as DocView;
        numbered = true;
        send = d;
      } else {
        send = sentVersion(d, propsRef.current.settings, propsRef.current.client);
        if (!send) {                             // an older draft without a number: marked sent first, as before
          const fn = propsRef.current.onPdf;
          if (!fn) throw new Error("The PDF couldn't be prepared.");
          d = { ...(await fn(d)), lang } as DocView;
          numbered = true;
          send = d;
        }
      }
      const b = await buildFor(send);
      const o = await deliver(b);
      if (alive.current) setBusy(null);
      await afterSend(o, d, numbered);
    } catch (e: any) {
      if (alive.current) setSaving(false);
      fail(e);
    } finally {
      if (alive.current) setBusy(null);
    }
  };
  const sendToClient = () => {
    if (busy || saving) return;
    setMsg(null);
    const block = sendBlock ? sendBlock(current) : null;
    if (block) { setBlockMsg(block); return; }
    const ask = pdfConfirm ? pdfConfirm(current) : null;
    if (ask) { setPdfAsk(ask); return; }
    const b = targetKey ? done.current.get(targetKey) : undefined;
    if (b) {                                   // ready: the share sheet opens in this tap
      const d = current;
      deliver(b).then(o => afterSend(o, d, false)).catch(fail);
      return;
    }
    sendSlow();
  };

  // ── Share PDF (sent documents) · Share draft ────────────────
  const shareNow = (d: DocView, busyKey: string, again: string) => {
    if (busy || saving) return;
    setMsg(null);
    const b = done.current.get(keyOf(d));
    if (b) { deliver(b).then(o => { if (o === "blocked") say(again); }).catch(fail); return; }
    (async () => {
      setBusy(busyKey);
      try {
        const bb = await buildFor(d);
        if (alive.current) setBusy(null);
        const o = await deliver(bb);
        if (o === "blocked") say(again);
      } catch (e: any) { fail(e); }
      finally { if (alive.current) setBusy(null); }
    })();
  };
  const sharePdf   = () => shareNow(current, "share", "The PDF is ready. Tap Share PDF again.");
  const shareDraft = () => shareNow(current, "draft", "The draft PDF is ready. Tap Share draft again.");

  // ── Caller actions (Mark signed, Mark paid, Revise …) ───────
  const runAction = async (a: DocAction, date?: string) => {
    setMsg(null);
    if (dirty || isNew) {                   // unsaved edits are saved first
      const ok = await save();
      if (!ok) return;
    }
    setBusy(a.key);
    try { await a.run(date); }
    catch (e: any) { fail(e); }
    finally { if (alive.current) setBusy(null); }
  };
  const clickAction = (a: DocAction) => {
    if (busy) return;
    if (a.date || a.confirm) setDialog({ action: a });
    else runAction(a);
  };

  // ── Edit · Cancel · Close ───────────────────────────────────
  const revert = () => {
    const base = JSON.parse(baseRef.current);
    setLang(base.lang || "en");
    setHs({ hist: [base], idx: 0 });
  };
  const cancelEdit = () => { if (dirty) setAskDiscard("cancel"); else setShowEdit(false); };
  const tryClose = () => {
    if (editing && dirty) { setAskDiscard("close"); return; }
    onClose();
  };

  // ── Line editing ────────────────────────────────────────────
  const updLine = (i: number, key: string, raw: string) =>
    setData(d => {
      const lines = [...(d.lines || [])];
      const ln = { ...lines[i] };
      if (key === "qty") {
        // priced like in the Calculator (volume tiers, add-ons, rate-card price); lines that were
        // discounted or typed by hand are scaled per piece, as before (pricing → requantify)
        lines[i] = requantify(ln, Math.max(1, parseInt(raw) || 1));
        return { ...d, lines };
      } else if (key === "amt") {
        const v = parseFloat(String(raw).replace(",", "."));
        ln.amt = Number.isFinite(v) ? r2(v) : 0;
        // keep the stored item price in step (renewals and the breakdown read it)
        if (typeof ln.base === "number") ln.base = lineBase({ ...ln, base: undefined });
      } else {
        ln[key] = raw;
      }
      lines[i] = ln;
      return { ...d, lines };
    });
  const removeLine = (i: number) => setData(d => ({ ...d, lines: (d.lines || []).filter((_: any, j: number) => j !== i) }));
  const addLine = () => setData(d => ({ ...d, lines: [...(d.lines || []), { id: Math.random().toString(36).slice(2, 9), name: "New item", note: "", qty: 1, amt: 0 }] }));

  // ── Clause editing (per language, keeps {fee}/{creator} live) ─
  const ctx = clauseContext(current, lang, settings, client);
  const templates = clauseTemplates(current.data, lang);
  const writeClauses = (next: { title: string; text: string }[]) =>
    setData(d => {
      const c = d.clauses;
      let obj: any = {};
      if (Array.isArray(c) && c.length > 0) {
        const de = /vertrag|lieferung|zahlung|nutzungsrecht|korrektur|stornierung/i.test(String(c[0]?.title || "") + String(c[0]?.text || "").slice(0, 80));
        obj[de ? "de" : "en"] = c;
      } else if (c && typeof c === "object") obj = { ...c };
      obj[lang] = next;
      return { ...d, clauses: obj };
    });
  const editClause = (ci: number, field: "title" | "text", val: string) => {
    const arr = templates.map(x => ({ ...x }));
    arr[ci] = { ...arr[ci], [field]: tokenizeClause(val, ctx) };
    writeClauses(arr);
  };
  const moveClause = (ci: number, dir: number) => {
    const arr = templates.map(x => ({ ...x }));
    const ni = ci + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[ci], arr[ni]] = [arr[ni], arr[ci]];
    writeClauses(arr);
  };
  const deleteClause = (ci: number) => writeClauses(templates.filter((_, j) => j !== ci));
  const addClause = () => writeClauses([...templates, { title: `§ ${templates.length + 1} — ${lang === "de" ? "Neue Klausel" : "New clause"}`, text: "" }]);

  const kind  = current.kind;
  const isInv = kind === "invoice" && current.subtype !== "storno";
  const statusBadge = (() => {
    const t = PAL[isNew ? "neutral" : DOC_TONE[current.status] || "neutral"];
    return (
      <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: t.ink, background: t.fill, height: 22, padding: "0 8px", display: "inline-flex", alignItems: "center", borderRadius: RADIUS.tag, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
        {isNew ? "Not saved" : STATUS_LABEL[current.status] || current.status}
      </span>
    );
  })();

  const taStyle: any = { width: "100%", padding: "8px 10px", border: `1px solid ${C.field}`, background: C.white, fontFamily: SANS, fontSize: TYPE.field.size, color: C.black, borderRadius: RADIUS.field, outline: "none", resize: "vertical", boxSizing: "border-box", minHeight: 72 };

  const showPanel   = editing;
  const showPreview = !isMobile || !editing;

  // ── The two buttons at the bottom + rare actions under the page ──
  type Btn = { key: string; label: string; run: () => void; dim?: boolean };
  const callerMain = actions.find(a => slotOf(a) === "main");
  const callerSide = actions.find(a => slotOf(a) === "side");
  const callerMore = actions.filter(a => slotOf(a) === "more");
  const actBtn = (a: DocAction): Btn => ({ key: a.key, label: busy === a.key ? "…" : a.label, run: () => clickAction(a), dim: !!busy && busy !== a.key });
  const sendBtn: Btn  = { key: "send", label: busy === "send" ? (saving ? "Saving…" : "Preparing…") : "Send to client", run: sendToClient, dim: !!busy && busy !== "send" };
  const shareBtn: Btn = { key: "share", label: busy === "share" ? "Preparing…" : "Share PDF", run: sharePdf, dim: !!busy && busy !== "share" };
  const draftLabel = busy === "draft" ? "Preparing…" : "Share draft";
  let side: Btn | null = null;
  let main: Btn | null = null;
  const more: { key: string; label: string; danger?: boolean; run: () => void }[] = [];
  if (editing) {
    side = { key: "cancel", label: "Cancel", run: cancelEdit };
    main = { key: "save", label: saving ? "Saving…" : "Save", run: () => { if (!saving) save(); }, dim: saving };
  } else if (isNew) {
    if (canEdit) side = { key: "savedraft", label: saving && busy !== "send" ? "Saving…" : "Save draft", run: () => { if (!saving && !busy) save(); }, dim: !!busy };
    if (canSend) main = sendBtn;
  } else if (isDraft) {
    side = canEdit ? { key: "edit", label: "Edit", run: () => { setMsg(null); setShowEdit(true); } } : callerSide ? actBtn(callerSide) : null;
    if (canSend) { main = sendBtn; more.push({ key: "sharedraft", label: draftLabel, run: shareDraft }); }
    else main = { key: "sharedraft", label: draftLabel, run: shareDraft };
  } else if (callerMain) {
    main = actBtn(callerMain); side = shareBtn;
  } else {
    main = shareBtn; side = callerSide ? actBtn(callerSide) : null;
  }
  if (!editing && !isNew) callerMore.forEach(a => more.push({ key: a.key, label: busy === a.key ? "…" : a.label, danger: a.kind === "danger", run: () => clickAction(a) }));
  const barBtn = (b: Btn, dark: boolean) => (
    <PillBtn key={b.key} dark={dark} dim={b.dim} onClick={b.run}
      s={{ height: 38, padding: "0 16px", fontSize: TYPE.row.size, justifyContent: "center", flex: isMobile ? 1 : "0 0 auto", minWidth: isMobile ? 0 : 150 }}>
      {b.label}
    </PillBtn>
  );

  // a portal: the window always covers the whole screen, wherever it is opened from
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: Z.modal, display: "flex", flexDirection: "column", fontFamily: SANS }}>

      {/* ── TOP BAR: close · language · status ── */}
      <div style={{ height: 44, borderBottom: `1px solid ${C.rule}`, display: "flex", alignItems: "center", padding: "0 8px 0 2px", gap: 6, flexShrink: 0 }}>
        <button onClick={tryClose} aria-label="Close" title="Close"
          style={{ width: 44, height: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: ICON.close, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <LangSwitch lang={lang} onChange={changeLang} />
        {statusBadge}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>

        {showPanel && (
          <div style={{ width: isMobile ? "100%" : panelW, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : `1px solid ${C.rule}`, flex: isMobile ? 1 : undefined, minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 8 }}>
                <button onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo" style={{ width: 30, height: 30, background: "none", border: `1px solid ${canUndo ? C.rule : "transparent"}`, borderRadius: "50%", cursor: canUndo ? "pointer" : "default", color: canUndo ? C.black : C.light, fontSize: TYPE.body.size }}>←</button>
                <button onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo" style={{ width: 30, height: 30, background: "none", border: `1px solid ${canRedo ? C.rule : "transparent"}`, borderRadius: "50%", cursor: canRedo ? "pointer" : "default", color: canRedo ? C.black : C.light, fontSize: TYPE.body.size }}>→</button>
                <span style={{ fontSize: TYPE.micro.size, color: C.light, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, marginLeft: 4 }}>Undo · Redo</span>
              </div>
              {note && <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "10px 0 0", lineHeight: 1.5 }}>{note}</p>}

              <Lbl>Brand</Lbl>
              <I value={staged.data?.brand || ""} onChange={(e: any) => setData(d => ({ ...d, brand: e.target.value }))} />
              <Lbl>Contact</Lbl>
              <I value={staged.data?.contact || ""} onChange={(e: any) => setData(d => ({ ...d, contact: e.target.value }))} />
              <Lbl>Date</Lbl>
              <I type="date" value={staged.docDate || ""} onChange={(e: any) => setStaged(p => ({ ...p, docDate: e.target.value }))} />

              {kind === "quote" && <>
                <Lbl>Valid until</Lbl>
                <I type="date" value={staged.data?.validUntil || ""} onChange={(e: any) => setData(d => ({ ...d, validUntil: e.target.value }))} />
              </>}

              {isInv && <>
                <Lbl>Service period</Lbl>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <I type="date" value={staged.periodStart || ""} onChange={(e: any) => setStaged(p => ({ ...p, periodStart: e.target.value || null }))} />
                  <I type="date" value={staged.periodEnd || ""} onChange={(e: any) => setStaged(p => ({ ...p, periodEnd: e.target.value || null }))} />
                </div>
                <Lbl>Due date</Lbl>
                <I type="date" value={staged.dueDate || ""} onChange={(e: any) => setStaged(p => ({ ...p, dueDate: e.target.value || null }))} />
              </>}

              <Lbl>Line items</Lbl>
              {(staged.data?.lines || []).map((ln: any, i: number) => (
                <div key={ln.id || i} style={{ border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, padding: 10, marginBottom: 7, background: C.white }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
                    <I value={ln.name || ""} onChange={(e: any) => updLine(i, "name", e.target.value)} />
                    <button onClick={() => removeLine(i)} title="Remove line" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: TYPE.body.size, padding: "0 2px" }}>✕</button>
                  </div>
                  <I value={ln.note || ""} onChange={(e: any) => updLine(i, "note", e.target.value)} s={{ marginBottom: 5, color: C.muted }} placeholder="note (optional)" />
                  <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 6, alignItems: "center" }}>
                    <QtyInput value={lineQty(ln)} onCommit={(q) => updLine(i, "qty", String(q))} />
                    <NumField value={lineAmt(ln)} onChange={(n) => updLine(i, "amt", n === null ? "" : String(n))} placeholder="Amount €" ariaLabel="Amount" />
                  </div>
                  <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "5px 0 0" }}>Unit price {fmt(lineAmt(ln) / lineQty(ln))}</p>
                </div>
              ))}
              <button onClick={addLine} style={{ fontSize: TYPE.label.size, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 4px", fontFamily: SANS, textDecoration: "underline", textDecorationColor: C.rule }}>+ Add line</button>

              {kind === "contract" && (
                <div style={{ marginTop: 6 }}>
                  <Lbl>Contract clauses ({lang.toUpperCase()})</Lbl>
                  {templates.map((cl, ci) => (
                    <div key={ci} style={{ border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, padding: "9px 10px", marginBottom: 7, background: C.white }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 3, marginBottom: 5 }}>
                        <button onClick={() => moveClause(ci, -1)} disabled={ci === 0} style={{ background: "none", border: `1px solid ${C.edge}`, borderRadius: RADIUS.pill, cursor: ci === 0 ? "default" : "pointer", color: ci === 0 ? C.light : C.muted, fontSize: TYPE.label.size, padding: "1px 6px" }}>↑</button>
                        <button onClick={() => moveClause(ci, 1)} disabled={ci === templates.length - 1} style={{ background: "none", border: `1px solid ${C.edge}`, borderRadius: RADIUS.pill, cursor: ci === templates.length - 1 ? "default" : "pointer", color: ci === templates.length - 1 ? C.light : C.muted, fontSize: TYPE.label.size, padding: "1px 6px" }}>↓</button>
                        <button onClick={() => deleteClause(ci)} style={{ background: "none", border: `1px solid ${C.edge}`, borderRadius: RADIUS.pill, cursor: "pointer", color: C.red, fontSize: TYPE.label.size, padding: "1px 6px" }}>✕</button>
                      </div>
                      <I value={fillTokens(cl.title, ctx)} onChange={(e: any) => editClause(ci, "title", e.target.value)} s={{ marginBottom: 5, fontFamily: SERIF }} />
                      <textarea value={fillTokens(cl.text, ctx)} onChange={(e: any) => editClause(ci, "text", e.target.value)} style={taStyle} />
                    </div>
                  ))}
                  <button onClick={addClause} style={{ fontSize: TYPE.label.size, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 4px", fontFamily: SANS, textDecoration: "underline", textDecorationColor: C.rule }}>+ Add clause</button>
                </div>
              )}

              <Lbl>Closing note</Lbl>
              <textarea value={staged.data?.footer || ""} onChange={(e: any) => setData(d => ({ ...d, footer: e.target.value }))} style={taStyle} />
            </div>

          </div>
        )}

        {/* Drag resizer */}
        {showPanel && !isMobile && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX, startW = panelW;
              const onMove = (ev: MouseEvent) => setPanelW(Math.max(260, Math.min(700, startW + ev.clientX - startX)));
              const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }}
            style={{ width: 6, flexShrink: 0, cursor: "col-resize", background: C.rule, opacity: 0.5 }}
          />
        )}

        {showPreview && (
          <div ref={pagesRef} style={{ flex: 1, background: C.muted, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? "16px 0" : "32px 28px", gap: isMobile ? 16 : 28 }}>
            <DocPages doc={current} settings={settings} client={client} lang={lang} scale={pageScale} />
            {more.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "center", padding: "0 16px 8px" }}>
                {more.map(m => (
                  <B key={m.key} v={m.danger ? "danger" : "sec"} onClick={m.run}
                    s={{ minHeight: 30, height: 30, padding: "0 12px", fontSize: TYPE.subtext.size }}>{m.label}</B>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR: one main button (right) · at most one more (left) ── */}
      <div style={{ flexShrink: 0, background: C.white, borderTop: `1px solid ${C.line}`, boxShadow: SHADOW.bar, padding: "11px 14px calc(14px + env(safe-area-inset-bottom, 0px))", fontFamily: SANS }}>
        {msg && <div role="status" style={{ fontSize: TYPE.subtext.size, color: msg.err ? C.red : C.muted, lineHeight: 1.4, margin: "0 2px 9px" }}>{msg.text}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {side && barBtn(side, false)}
          {main && barBtn(main, true)}
        </div>
      </div>

      {/* ── DIALOGS ── */}
      {askDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          text="Your changes to this document aren't saved."
          okLabel="Discard"
          cancelLabel="Keep editing"
          danger
          onOk={() => { const how = askDiscard; setAskDiscard(null); revert(); setShowEdit(false); if (how === "close") onClose(); }}
          onCancel={() => setAskDiscard(null)}
        />
      )}
      {blockMsg && <ConfirmDialog title="Before this invoice gets its number" text={blockMsg} okLabel="OK" onOk={() => setBlockMsg(null)} onCancel={() => setBlockMsg(null)} />}
      {pdfAsk && (
        <ConfirmDialog
          title={isInv ? "Number and send this invoice?" : "Send this document?"}
          text={pdfAsk}
          okLabel="Send"
          onOk={() => { setPdfAsk(null); sendSlow(); }}
          onCancel={() => setPdfAsk(null)}
        />
      )}
      {dialog && (
        <ConfirmDialog
          title={dialog.action.label}
          text={dialog.action.confirm}
          dateLabel={dialog.action.date}
          okLabel={dialog.action.label}
          danger={dialog.action.kind === "danger"}
          onOk={(date) => { const dg = dialog; setDialog(null); runAction(dg.action, dg.action.date ? date : undefined); }}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  , document.body);
}
