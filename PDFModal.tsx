// ─────────────────────────────────────────────────────────────
// PDFModal — the one document modal
// Preview (all pages) + edit panel for drafts. Sent / signed /
// paid documents are read-only. Status actions (Mark sent,
// Finalize, Mark paid …) come from the caller and sit in one bar.
// After Save the modal stays open and returns to the read view.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from "react";
import { C, SANS, SERIF, TYPE, Z } from "./constants";
import { I, B, Lbl, Pill, ConfirmDialog } from "./atoms";
import { editLock } from "./saveStatus";
import { fmt, r2 } from "./formatters";
import { exportPDF } from "./PDFExport";
import DocPages from "./DocPages";
import { clauseContext, clauseTemplates, fillTokens, tokenizeClause, senderOf } from "./A4Document";
import { STATUS_LABEL, docFileName, lineAmt, lineQty, profileGaps } from "./docs";
import type { DocView } from "./docs";

export interface DocAction {
  key:      string;
  label:    string;
  kind?:    "pri" | "sec" | "danger";
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
  onSave?:    (next: DocView) => Promise<void>;
  actions?:   DocAction[];
  onClose:    () => void;
}

const clone = (x: any) => JSON.parse(JSON.stringify(x));

const STATUS_COLOR: Record<string, string> = {
  draft: C.amber, sent: C.blue, signed: C.green, paid: C.green, cancelled: C.red, superseded: C.light,
};

export default function PDFModal({
  doc, settings, client, editable, isNew, justSaved, note, onSave, actions = [], onClose,
}: PDFModalProps) {
  const [hs,           setHs]           = useState({ hist: [clone(doc)], idx: 0 });
  const [lang,         setLang]         = useState<"en" | "de">(doc.lang || "en");
  const [panelW,       setPanelW]       = useState(380);
  const [flash,        setFlash]        = useState<string | null>(justSaved ? "saved" : null);
  const [saving,       setSaving]       = useState(false);
  const [busy,         setBusy]         = useState<string | null>(null);
  const [err,          setErr]          = useState<string | null>(null);
  const [downloading,  setDownloading]  = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dialog,       setDialog]       = useState<{ action: DocAction } | null>(null);
  const [winW,         setWinW]         = useState(() => window.innerWidth);

  const baseRef  = useRef<string>(JSON.stringify({ ...clone(doc), lang: doc.lang || "en" }));
  const pagesRef = useRef<HTMLDivElement>(null);

  const staged   = hs.hist[hs.idx] as DocView;
  const current  = useMemo(() => ({ ...staged, lang } as DocView), [staged, lang]);
  const dirty    = editable && JSON.stringify(current) !== baseRef.current;
  const isMobile = winW < 768;
  const pageScale = isMobile ? Math.min(1, (winW - 32) / 595) : 1;
  const canEdit  = editable && !!onSave;

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // no background reloads while a document is open
  useEffect(() => editLock.acquire(), []);

  // A fresh document from the parent (after Finalize, Mark paid …):
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

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

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

  // ── Save ────────────────────────────────────────────────────
  const save = async (): Promise<boolean> => {
    if (!onSave || saving) return false;
    setSaving(true); setErr(null);
    try {
      await onSave(current);
      baseRef.current = JSON.stringify(current);
      setFlash("saved");
      if (isMobile) setShowEdit(false);      // back to the read view
      return true;
    } catch (e: any) {
      setErr(e?.message || "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Actions (Mark sent, Finalize …) ─────────────────────────
  const runAction = async (a: DocAction, date?: string) => {
    setErr(null);
    if (dirty || isNew) {                   // unsaved edits are saved first
      const ok = await save();
      if (!ok) return;
    }
    setBusy(a.key);
    try { await a.run(date); }
    catch (e: any) { setErr(e?.message || "Something went wrong"); }
    finally { setBusy(null); }
  };
  const clickAction = (a: DocAction) => {
    if (a.date || a.confirm) setDialog({ action: a });
    else runAction(a);
  };

  // ── Close ───────────────────────────────────────────────────
  const tryClose = () => {
    if (canEdit && (isNew || dirty)) { setConfirmClose(true); return; }
    onClose();
  };

  // ── Download ────────────────────────────────────────────────
  const download = async () => {
    setErr(null);
    // never produce a PDF with missing or placeholder sender details
    if (settings && settings.__ready === false && !current.data?.sender) {
      setErr("Your profile hasn't loaded yet — try again in a moment."); return;
    }
    const sender = senderOf(current, settings);
    const isInvoice = current.kind === "invoice" && current.subtype !== "storno";
    const gaps = isInvoice ? profileGaps(sender) : (!(sender.name || sender.company) ? ["name"] : []);
    if (gaps.length) { setErr(`Add your ${gaps.join(", ")} in Creator Profile first.`); return; }
    try {
      await exportPDF({
        preview: current, type: current.kind, root: pagesRef.current,
        filename: docFileName(current),
        onStart: () => setDownloading(true), onDone: () => setDownloading(false),
      });
    } catch (e: any) { setErr(e?.message || "PDF failed"); setDownloading(false); }
  };

  // ── Line editing ────────────────────────────────────────────
  const updLine = (i: number, key: string, raw: string) =>
    setData(d => {
      const lines = [...(d.lines || [])];
      const ln = { ...lines[i] };
      if (key === "qty") {
        const oldQ = lineQty(ln);
        const newQ = Math.max(1, parseInt(raw) || 1);
        ln.amt = r2(lineAmt(ln) / oldQ * newQ);
        ln.qty = newQ;
      } else if (key === "amt") {
        const v = parseFloat(String(raw).replace(",", "."));
        ln.amt = Number.isFinite(v) ? r2(v) : 0;
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
  const statusBadge = (
    <span style={{ fontSize: TYPE.micro.size, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: STATUS_COLOR[current.status] || C.muted, border: `1px solid ${STATUS_COLOR[current.status] || C.rule}`, padding: "3px 8px", borderRadius: 2, whiteSpace: "nowrap" as const }}>
      {isNew ? "New" : STATUS_LABEL[current.status] || current.status}
    </span>
  );

  const taStyle: any = { width: "100%", padding: "8px 10px", border: `1px solid ${C.rule}`, background: C.bg, fontFamily: SANS, fontSize: 16, color: C.black, borderRadius: 2, outline: "none", resize: "vertical", boxSizing: "border-box", minHeight: 72 };

  const showPanel   = canEdit && (!isMobile || showEdit);
  const showPreview = !isMobile || !showEdit || !canEdit;

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: Z.modal, display: "flex", flexDirection: "column", fontFamily: SANS }}>

      {/* ── TOP BAR ── */}
      <div style={{ minHeight: 48, borderBottom: `1px solid ${C.rule}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 6, flexShrink: 0 }}>
        {canEdit && <>
          <button onClick={undo} disabled={!canUndo} title="Undo" style={{ width: 30, height: 30, background: "none", border: `1px solid ${canUndo ? C.rule : "transparent"}`, borderRadius: 2, cursor: canUndo ? "pointer" : "default", color: canUndo ? C.black : C.light, fontSize: 15 }}>←</button>
          <button onClick={redo} disabled={!canRedo} title="Redo" style={{ width: 30, height: 30, background: "none", border: `1px solid ${canRedo ? C.rule : "transparent"}`, borderRadius: 2, cursor: canRedo ? "pointer" : "default", color: canRedo ? C.black : C.light, fontSize: 15 }}>→</button>
          <div style={{ width: 1, height: 20, background: C.rule, margin: "0 2px" }} />
        </>}
        <Pill on={lang === "en"} onClick={() => setLang("en")}>EN</Pill>
        <Pill on={lang === "de"} onClick={() => setLang("de")}>DE</Pill>
        {statusBadge}
        <div style={{ flex: 1 }} />
        {isMobile && canEdit && (
          <B v="sec" onClick={() => setShowEdit(e => !e)} s={{ minHeight: 36, padding: "0 12px" }}>{showEdit ? "View" : "Edit"}</B>
        )}
        <B onClick={download} s={{ minHeight: 36, padding: "0 14px", opacity: downloading ? 0.5 : 1 }}>{downloading ? "Saving…" : "Save PDF"}</B>
        <button onClick={tryClose} title="Close" style={{ width: 34, height: 34, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>✕</button>
      </div>

      {/* ── ACTION BAR (status actions) ── */}
      {(actions.length > 0 || err || flash) && (
        <div style={{ borderBottom: `1px solid ${C.rule}`, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", flexWrap: "wrap" as const, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            {err && <span style={{ fontSize: TYPE.label.size, color: C.red }}>{err}</span>}
            {!err && flash === "saved" && <span style={{ fontSize: TYPE.label.size, color: C.green }}>Saved ✓</span>}
          </div>
          {actions.map(a => (
            <B key={a.key} v={a.kind === "danger" ? "danger" : a.kind === "sec" ? "sec" : "pri"}
              onClick={() => !busy && clickAction(a)}
              s={{ minHeight: 36, padding: "0 14px", opacity: busy && busy !== a.key ? 0.4 : 1 }}>
              {busy === a.key ? "…" : a.label}
            </B>
          ))}
        </div>
      )}

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>

        {showPanel && (
          <div style={{ width: isMobile ? "100%" : panelW, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : `1px solid ${C.rule}`, flex: isMobile ? 1 : undefined, minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 16px" }}>
              {note && <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "12px 0 0", lineHeight: 1.5 }}>{note}</p>}

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
                <div key={ln.id || i} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: 10, marginBottom: 7, background: C.white }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
                    <I value={ln.name || ""} onChange={(e: any) => updLine(i, "name", e.target.value)} />
                    <button onClick={() => removeLine(i)} title="Remove line" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "0 2px" }}>✕</button>
                  </div>
                  <I value={ln.note || ""} onChange={(e: any) => updLine(i, "note", e.target.value)} s={{ marginBottom: 5, color: C.muted }} placeholder="note (optional)" />
                  <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 6, alignItems: "center" }}>
                    <I type="number" min={1} value={lineQty(ln)} onChange={(e: any) => updLine(i, "qty", e.target.value)} />
                    <I type="number" step="0.01" value={lineAmt(ln)} onChange={(e: any) => updLine(i, "amt", e.target.value)} placeholder="Amount €" />
                  </div>
                  <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "5px 0 0" }}>Unit price {fmt(lineAmt(ln) / lineQty(ln))}</p>
                </div>
              ))}
              <button onClick={addLine} style={{ fontSize: TYPE.label.size, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 0 4px", fontFamily: SANS, textDecoration: "underline", textDecorationColor: C.rule }}>+ Add line</button>

              {kind === "contract" && (
                <div style={{ marginTop: 6 }}>
                  <Lbl>Contract clauses ({lang.toUpperCase()})</Lbl>
                  {templates.map((cl, ci) => (
                    <div key={ci} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: "9px 10px", marginBottom: 7, background: C.white }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 3, marginBottom: 5 }}>
                        <button onClick={() => moveClause(ci, -1)} disabled={ci === 0} style={{ background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: ci === 0 ? "default" : "pointer", color: ci === 0 ? C.light : C.muted, fontSize: TYPE.label.size, padding: "1px 6px" }}>↑</button>
                        <button onClick={() => moveClause(ci, 1)} disabled={ci === templates.length - 1} style={{ background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: ci === templates.length - 1 ? "default" : "pointer", color: ci === templates.length - 1 ? C.light : C.muted, fontSize: TYPE.label.size, padding: "1px 6px" }}>↓</button>
                        <button onClick={() => deleteClause(ci)} style={{ background: "none", border: `1px solid ${C.rule}`, borderRadius: 2, cursor: "pointer", color: C.red, fontSize: TYPE.label.size, padding: "1px 6px" }}>✕</button>
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

            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>
              <B onClick={save} s={{ width: "100%", opacity: saving ? 0.5 : 1 }}>{saving ? "Saving…" : "Save"}</B>
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
          <div ref={pagesRef} style={{ flex: 1, background: "#888", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? "16px 0" : "32px 28px", gap: isMobile ? 16 : 28 }}>
            <DocPages doc={current} settings={settings} client={client} lang={lang} scale={pageScale} />
          </div>
        )}
      </div>

      {/* ── CONFIRM CLOSE ── */}
      {confirmClose && (
        <ConfirmDialog
          title={isNew ? "Save this document?" : "Save before closing?"}
          text={isNew ? "It will be added to the client's project." : "Changes will be lost if you don't save."}
          error={err}
          okLabel={saving ? "Saving…" : "Yes, save"}
          cancelLabel="No, discard"
          onOk={async () => { const ok = await save(); if (ok) { setConfirmClose(false); onClose(); } }}
          onCancel={() => { setConfirmClose(false); setErr(null); onClose(); }}
        />
      )}

      {/* ── ACTION DIALOG (date / confirm) ── */}
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
  );
}
