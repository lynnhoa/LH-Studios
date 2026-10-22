// ─────────────────────────────────────────────────────────────
// EmailKit — Outreach › Email kit (tab next to Contacts). Copy only:
// nothing is sent from here.
//   Title · summary line (● 4 media kits · n templates · copy only)
//   MEDIA KITS · tap to copy ……… Edit links
//     4 slim tiles in one row (40 px), in the rate-card colours:
//     Collab pink · Editorial butter · Hotels pistachio · UGC blue.
//     Tap = the Canva view link is copied ("Collab link copied ✓").
//   EMAIL TEMPLATES ……… + Add
//     grouped by purpose (chips when there's more than one purpose);
//     each row: name · its media kit · copy icon (copies the text with
//     that kit's link). Tap a row = the template window.
// Windows (one level, the app's sheet): Edit links (all 4 kits: link,
// Canva file, focus, PDF) and a template (read view: kit choice · Share
// PDF · subject · text · Done | Copy text; Edit → Cancel | Save → back
// to the read view).
// PDF per kit: uploaded / replaced / deleted in Edit links (saved right
// away); Share = the phone's share sheet to attach it (computer: the
// file opens). A small dot on a tile = this kit has a PDF.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, TRACK, SPACING, CARD_TONE } from "./constants";
import { fmtD } from "./formatters";
import { I, S, Lbl, PillBtn, SummaryLine, Strong, SectionHead, ListCard, Row, Chip, ChipRow, Sheet, ConfirmDialog, ColGroups } from "./atoms";
import { copyText } from "./outreach";
import { showNote } from "./undo";
import { KITS, KIT_TOKEN, kitInfo, fillText, fmtSize, TEMPLATE_PIPELINES, TEMPLATE_KINDS } from "./useEmailKit";
import type { EmailKitHook, EmailTemplate, KitKey, MediaKit } from "./useEmailKit";

const Ico = ({ d, size = 14, color = "currentColor" }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
);
const IC: Record<string, string> = {
  copy:       "M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  link:       "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  influencer: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  editorial:  "M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  hotels:     "M5 20V4h10v16M15 9h4v11M8 8h4M8 12h4M8 16h4M3 20h18",
  ugc:        "M4 7h11v10H4zM15 10l5-3v10l-5-3",
  share:      "M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7",
};
const toneOf = (k: KitKey) => PAL[CARD_TONE[k] || "neutral"];
const NO_PURPOSE = "Other";

const caps: any = { fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted };
const linkBtn: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, textDecoration: "underline", textUnderlineOffset: 2, WebkitTapHighlightColor: "transparent",
};
const TA = (p: any) => (
  <textarea {...p} style={{ width: "100%", minHeight: 180, padding: "9px 10px", border: `1px solid ${C.field}`, borderRadius: RADIUS.field, background: C.white,
    fontFamily: SANS, fontSize: TYPE.field.size, lineHeight: 1.45, color: C.black, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, WebkitAppearance: "none" as const }} />
);

// the round copy button on a row (its own tap: doesn't open the row)
const CopyBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label}
    style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${C.edge}`, background: C.white, color: C.ink2, display: "inline-flex",
      alignItems: "center", justifyContent: "center", cursor: "copy", padding: 0, WebkitTapHighlightColor: "transparent" }}>
    <Ico d={IC.copy} size={14} />
  </button>
);

// a kit as a small chip (template window: the kit choice)
const KitChip = ({ k, on, onClick }: { k: KitKey | null; on: boolean; onClick: () => void }) => {
  const t = k ? toneOf(k) : PAL.neutral;
  return <Chip on={on} tone={t} label={k ? kitInfo(k)!.label : "None"} dot={!!k} onClick={onClick} />;
};

// the text with {kit} shown as a small coloured pill
const BodyPreview = ({ body, kit }: { body: string; kit: KitKey | null }) => {
  if (!body.trim()) return <span style={{ color: C.light }}>No text yet.</span>;
  const parts = body.split(KIT_TOKEN);
  const pill = (i: number) => {
    const t = kit ? toneOf(kit) : PAL.neutral;
    return <span key={`p${i}`} style={{ background: t.wash, color: t.ink, padding: "1px 7px", borderRadius: RADIUS.tag, fontSize: TYPE.subtext.size, whiteSpace: "nowrap" as const }}>{kit ? `${kitInfo(kit)!.short} link` : "no kit"}</span>;
  };
  return <>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 && pill(i)}</span>)}{kit && parts.length === 1 && <><br /><br />{pill(99)}</>}</>;
};

interface EmailKitProps { kit: EmailKitHook; isMobile: boolean; }

export default function EmailKit({ kit, isMobile }: EmailKitProps) {
  const { kits, templates, loading, loadError } = kit;
  const [editLinks, setEditLinks] = useState(false);
  const [openId, setOpenId]       = useState<string | null>(null);
  const [adding, setAdding]       = useState(false);
  const [purpose, setPurpose]     = useState<string>("all");

  const urlOf = (k: KitKey | null) => (k ? kits.find(x => x.key === k)?.url || "" : "");
  const copy = async (text: string, msg: string) => { const ok = await copyText(text); showNote(ok ? msg : "Couldn't copy"); };
  const copyKit = (k: KitKey) => {
    const url = urlOf(k);
    if (!url) { showNote(`Add the ${kitInfo(k)!.short} link first · Edit links`); return; }
    copy(url, `${kitInfo(k)!.short} link copied ✓`);
  };
  const sharePdf = (k: KitKey) => {
    kit.sharePdf(k).then(r => { if (r === "shared") showNote("PDF shared ✓"); }).catch((e: any) => showNote(e?.message || "The PDF couldn't be opened."));
  };
  const copyTemplate = (t: EmailTemplate, k: KitKey | null) => {
    if (k && !urlOf(k)) { showNote(`Add the ${kitInfo(k)!.short} link first · Edit links`); return; }
    if (!t.body.trim()) { showNote("This template has no text yet"); return; }
    copy(fillText(t.body, k ? urlOf(k) : null), "Text copied ✓");
  };

  const purposes = useMemo(() => Array.from(new Set(templates.map(t => t.purpose.trim() || NO_PURPOSE))).sort((a, b) => a.localeCompare(b, "de")), [templates]);
  useEffect(() => { if (purpose !== "all" && !purposes.includes(purpose)) setPurpose("all"); }, [purposes, purpose]);
  const shownPurposes = purpose === "all" ? purposes : [purpose];
  const current = templates.find(t => t.id === openId);

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Email kit</h2>
      <SummaryLine dot={PAL.neutral.mid}>
        <span><Strong>{kits.length || KITS.length}</Strong> media kits · <Strong>{templates.length}</Strong> {templates.length === 1 ? "template" : "templates"} · copy only</span>
      </SummaryLine>

      {loadError && <p role="alert" style={{ fontSize: TYPE.subtext.size, color: C.red, margin: "12px 0 0" }}>{loadError}</p>}

      {!loadError && (
        <>
          {/* ── MEDIA KITS: 4 slim tiles, tap = copy ── */}
          <SectionHead label="Media kits · tap to copy" right={<button onClick={() => setEditLinks(true)} style={linkBtn}>Edit links</button>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            {KITS.map(d => {
              const t = toneOf(d.key);
              const has = !!urlOf(d.key);
              const hasPdf = !!kits.find(x => x.key === d.key)?.pdf;
              return (
                <button key={d.key} onClick={() => copyKit(d.key)} aria-label={`Copy the ${d.label} link`} title={has ? `Copy the ${d.label} link` : "No link yet"}
                  style={{ height: 40, minWidth: 0, boxSizing: "border-box" as const, padding: "0 6px", borderRadius: RADIUS.tile, cursor: "copy",
                    border: has ? `1px solid ${C.line}` : `1px dashed ${t.mid}`, background: t.wash, color: t.ink, fontFamily: SANS, fontSize: TYPE.subtext.size,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5, WebkitTapHighlightColor: "transparent", position: "relative" as const }}>
                  {hasPdf && <span aria-label="Has a PDF" title="Has a PDF" style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: t.mid }} />}
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: C.white, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={IC[d.key]} size={11} /></span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{d.short}</span>
                </button>
              );
            })}
          </div>

          {/* ── EMAIL TEMPLATES ── */}
          <SectionHead label="Email templates" right={<button onClick={() => setAdding(true)} style={{ ...linkBtn, textDecoration: "none" }}>+ Add</button>} />
          {loading ? null : templates.length === 0 ? (
            <ListCard s={{ padding: "18px 14px", textAlign: "center" as const }}>
              <div style={{ fontSize: SPACING.listText }}>Add your first template</div>
              <div style={{ fontSize: SPACING.listMeta, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>Each template gets a purpose and a media kit choice.</div>
            </ListCard>
          ) : (
            <>
              {purposes.length > 1 && (
                <ChipRow s={{ marginBottom: 2 }}>
                  <Chip on={purpose === "all"} tone={PAL.neutral} dot={false} label="All" count={templates.length} onClick={() => setPurpose("all")} />
                  {purposes.map(p => <Chip key={p} on={purpose === p} tone={PAL.neutral} dot={false} label={p} count={templates.filter(t => (t.purpose.trim() || NO_PURPOSE) === p).length} onClick={() => setPurpose(p)} />)}
                </ChipRow>
              )}
              {/* iPad / computer: the purposes side by side (phone: one under the other) */}
              <ColGroups groups={shownPurposes.map(p => {
                const list = templates.filter(t => (t.purpose.trim() || NO_PURPOSE) === p).sort((a, b) => a.name.localeCompare(b.name, "de"));
                return { key: p, size: list.length, node: (
                  <div>
                    {purposes.length > 1 && <SectionHead label={p} />}
                    <ListCard s={purposes.length > 1 ? undefined : { marginTop: 0 }}>
                      {list.map((t, i) => (
                        <Row key={t.id} first={i === 0} chevron={false} onClick={() => setOpenId(t.id)}
                          title={t.name || "Untitled"}
                          meta={<>{t.pipeline === "ugc" ? "UGC" : "@lynnhoa"} · {t.kind === "follow_up" ? "Follow-up" : "Pitch"} · Kit: {t.kit ? <span style={{ color: toneOf(t.kit).ink }}>{kitInfo(t.kit)!.label}</span> : "none"}</>}
                          right={<CopyBtn label={`Copy ${t.name || "the text"}`} onClick={() => copyTemplate(t, t.kit)} />} />
                      ))}
                    </ListCard>
                  </div>
                ) };
              })} />
            </>
          )}
        </>
      )}

      {editLinks && <LinksWindow kit={kit} onShare={sharePdf} onClose={() => setEditLinks(false)} />}
      {current && <TemplateWindow t={current} kit={kit} purposes={purposes} urlOf={urlOf} onCopy={copyTemplate} onShare={sharePdf} onCopySubject={(s) => copy(s, "Subject copied ✓")} onClose={() => setOpenId(null)} />}
      {adding && !current && (
        <TemplateWindow isNew t={{ id: "", name: "", purpose: purpose !== "all" && purpose !== NO_PURPOSE ? purpose : "", subject: "", body: "", kit: null, createdAt: "", pipeline: "lynnhoa", kind: "pitch", categories: [] }}
          kit={kit} purposes={purposes} urlOf={urlOf} onCopy={copyTemplate} onShare={sharePdf} onCopySubject={(s) => copy(s, "Subject copied ✓")}
          onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); setOpenId(id); }} />
      )}
    </div>
  );
}

// ── Edit links: the 4 kits in one window ──────────────────────
function LinksWindow({ kit, onShare, onClose }: { kit: EmailKitHook; onShare: (k: KitKey) => void; onClose: () => void }) {
  const kits = kit.kits;
  const save = kit.saveKits;
  const [edit, setEdit] = useState(false);
  const [busyKey, setBusyKey] = useState<KitKey | null>(null);           // a PDF being uploaded / deleted
  const [askDel, setAskDel]   = useState<KitKey | null>(null);
  useEffect(() => { kit.preloadPdfs(); }, [kit.kits]);                    // ready for Share in the same tap
  const upload = (key: KitKey) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/pdf,.pdf";
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      setErr(null); setBusyKey(key);
      kit.uploadPdf(key, file).then(() => showNote("PDF saved ✓")).catch((e: any) => setErr(e?.message || "The PDF couldn't be saved.")).finally(() => setBusyKey(null));
    };
    inp.click();
  };
  const removePdf = (key: KitKey) => {
    setAskDel(null); setErr(null); setBusyKey(key);
    kit.deletePdf(key).then(() => showNote("PDF deleted")).catch((e: any) => setErr(e?.message || "Couldn't delete.")).finally(() => setBusyKey(null));
  };
  const [f, setF]       = useState<MediaKit[]>(kits);
  const [err, setErr]   = useState<string | null>(null);
  useEffect(() => { if (!edit) setF(kits); else setF(prev => prev.map(p => ({ ...p, pdf: kits.find(k => k.key === p.key)?.pdf ?? null }))); }, [kits, edit]);
  const set = (key: KitKey, patch: Partial<MediaKit>) => setF(prev => prev.map(k => (k.key === key ? { ...k, ...patch } : k)));
  const doSave = async () => {
    setErr(null);
    const bad = f.find(k => k.url.trim() && !/^https?:\/\//i.test(k.url.trim()));
    if (bad) { setErr(`The ${kitInfo(bad.key)!.short} link must start with https://`); return; }
    try { await save(f); setEdit(false); }
    catch (e: any) { setErr(e?.message || "Couldn't save."); }
  };
  const row = (label: string, value: any) => (
    <div style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr)", gap: 8, alignItems: "center", minHeight: 36, borderTop: `1px solid ${C.hair}`, fontSize: SPACING.listText }}>
      <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>{label}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{value || <span style={{ color: C.light }}>—</span>}</span>
    </div>
  );

  const pdfOf = (key: KitKey) => kits.find(k => k.key === key)?.pdf ?? null;
  const pdfLine = (key: KitKey) => {
    const p = pdfOf(key);
    if (busyKey === key) return <span style={{ color: C.muted }}>Saving…</span>;
    return p ? <span style={{ color: C.black }}>{p.name} <span style={{ color: C.muted }}>· {fmtSize(p.size)}{p.updatedAt ? ` · ${fmtD(p.updatedAt.slice(0, 10))}` : ""}</span></span> : "";
  };
  const smallBtn: any = { height: 28, flexShrink: 0 };

  return (
    <>
    {askDel && <ConfirmDialog title={`Delete the ${kitInfo(askDel)!.short} PDF?`} text="The PDF is removed from this media kit. The Canva link stays." okLabel="Delete" danger onOk={() => removePdf(askDel)} onCancel={() => setAskDel(null)} />}
    <Sheet title="Media kits" onClose={edit ? () => { setEdit(false); setErr(null); } : onClose}
      right={!edit ? <PillBtn onClick={() => setEdit(true)}>Edit</PillBtn> : null}
      footer={edit ? <>
        <PillBtn onClick={() => { setEdit(false); setErr(null); }} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark onClick={doSave} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>Save</PillBtn>
      </> : <PillBtn onClick={onClose} s={{ flex: 1, height: 40, justifyContent: "center" }}>Done</PillBtn>}>
      {err && <p role="alert" style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
      {!edit && <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "0 2px 6px", lineHeight: 1.4 }}>Use Canva's view-only link (Share → Public view link), never the edit link.</p>}
      {f.map(k => {
        const d = kitInfo(k.key)!;
        const t = toneOf(k.key);
        return (
          <div key={k.key} style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.wash, color: t.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico d={IC[k.key]} size={11} /></span>
              <span style={{ fontSize: SPACING.listText, fontWeight: 500 }}>{d.label}</span>
              <span style={{ fontSize: TYPE.micro.size, letterSpacing: TRACK.tag, padding: "2px 8px", borderRadius: RADIUS.tag, background: d.account === "@lynnhoa" ? PAL.lynnhoa.fill : PAL.neutral.fill, color: d.account === "@lynnhoa" ? PAL.lynnhoa.ink : PAL.neutral.ink }}>{d.account}</span>
            </div>
            {!edit ? (
              <>
                {row("Focus", k.focus)}
                {row("Canva file", k.file)}
                {row("View link", k.url ? <a href={k.url} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: "none" }}>{k.url.replace(/^https?:\/\/(www\.)?/, "")}</a> : "")}
                {row("Updated", k.url && k.updatedAt ? fmtD(k.updatedAt.slice(0, 10)) : "")}
                <div style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr) auto", gap: 8, alignItems: "center", minHeight: 36, borderTop: `1px solid ${C.hair}`, fontSize: SPACING.listText }}>
                  <span style={{ fontSize: TYPE.subtext.size, color: C.muted }}>PDF</span>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pdfLine(k.key) || <span style={{ color: C.light }}>—</span>}</span>
                  {pdfOf(k.key) && busyKey !== k.key && <PillBtn onClick={() => onShare(k.key)} s={smallBtn}><Ico d={IC.share} size={13} />Share</PillBtn>}
                </div>
              </>
            ) : (
              <>
                <Lbl>View link</Lbl>
                <I type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://www.canva.com/design/…/view"
                  value={k.url} aria-label={`${d.label} view link`} onChange={(e: any) => set(k.key, { url: e.target.value })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div><Lbl>Canva file</Lbl><I value={k.file} aria-label={`${d.label} Canva file`} onChange={(e: any) => set(k.key, { file: e.target.value })} /></div>
                  <div><Lbl>Focus</Lbl><I value={k.focus} aria-label={`${d.label} focus`} onChange={(e: any) => set(k.key, { focus: e.target.value })} /></div>
                </div>
                <Lbl>PDF · saved right away</Lbl>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 36 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: SPACING.listText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{pdfLine(k.key) || <span style={{ color: C.light }}>No PDF yet</span>}</span>
                  <PillBtn dim={busyKey !== null} onClick={() => { if (busyKey === null) upload(k.key); }} s={smallBtn}>{pdfOf(k.key) ? "Replace" : "Upload PDF"}</PillBtn>
                  {pdfOf(k.key) && <PillBtn dim={busyKey !== null} onClick={() => { if (busyKey === null) setAskDel(k.key); }} s={{ ...smallBtn, color: C.red }}>Delete</PillBtn>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </Sheet>
    </>
  );
}

// ── one template: read view (kit choice, subject, text) · edit ─
function TemplateWindow({ t, kit, purposes, urlOf, onCopy, onShare, onCopySubject, onClose, onCreated, isNew }: {
  t: EmailTemplate; kit: EmailKitHook; purposes: string[]; urlOf: (k: KitKey | null) => string;
  onCopy: (t: EmailTemplate, k: KitKey | null) => void; onShare: (k: KitKey) => void; onCopySubject: (s: string) => void;
  onClose: () => void; onCreated?: (id: string) => void; isNew?: boolean;
}) {
  const [edit, setEdit] = useState(!!isNew);
  const [f, setF]       = useState<EmailTemplate>(t);
  const [err, setErr]   = useState<string | null>(null);
  const [pick, setPick] = useState<KitKey | null>(t.kit);          // the kit for this copy (starts at the template's kit)
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { if (!edit) setF(t); }, [t, edit]);
  useEffect(() => { setPick(t.kit); }, [t.kit]);
  useEffect(() => { kit.preloadPdfs(); }, [kit.kits]);                    // ready for Share PDF in the same tap
  const pickPdf = pick ? kit.kits.find(k => k.key === pick)?.pdf ?? null : null;

  const save = async () => {
    setErr(null);
    if (!f.name.trim()) { setErr("Please enter a name."); return; }
    try {
      if (isNew) { const n = await kit.addTemplate(f); onCreated?.(n.id); return; }
      await kit.updateTemplate(t.id, f); setEdit(false);
    } catch (e: any) { setErr(e?.message || "Couldn't save."); }
  };
  const del = async () => {
    setAskDelete(false);
    try { await kit.deleteTemplate(t.id); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const box: any = { background: C.white, border: `1px solid ${C.line}`, borderRadius: RADIUS.tile, padding: "10px 12px", fontSize: SPACING.listText, lineHeight: 1.5, color: C.ink2, whiteSpace: "pre-wrap" as const, overflowWrap: "anywhere" as const };
  const head = (label: string, onCopyIt?: () => void) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 2px 5px" }}>
      <span style={caps}>{label}</span>
      {onCopyIt && <button onClick={onCopyIt} aria-label={`Copy the ${label.toLowerCase()}`} style={{ background: "none", border: "none", padding: 6, margin: -6, cursor: "copy", color: C.light, display: "inline-flex" }}><Ico d={IC.copy} size={14} /></button>}
    </div>
  );

  return (
    <>
      {askDelete && <ConfirmDialog title={`Delete ${t.name || "this template"}?`} text="The template is removed from your Email kit." okLabel="Delete" danger onOk={del} onCancel={() => setAskDelete(false)} />}
      <Sheet title={isNew ? "New template" : t.purpose || "Template"}
        onClose={edit && !isNew ? () => { setEdit(false); setErr(null); } : onClose}
        right={!edit ? <PillBtn onClick={() => setEdit(true)}>Edit</PillBtn> : null}
        footer={edit ? <>
          <PillBtn onClick={() => { if (isNew) { onClose(); return; } setEdit(false); setErr(null); }} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
          <PillBtn dark onClick={save} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>Save</PillBtn>
        </> : <>
          <PillBtn onClick={onClose} s={{ flex: 1, height: 40, justifyContent: "center" }}>Done</PillBtn>
          <PillBtn dark onClick={() => onCopy(t, pick)} s={{ flex: 1.4, height: 40, justifyContent: "center" }}><Ico d={IC.copy} size={14} />Copy text</PillBtn>
        </>}>
        {err && <p role="alert" style={{ fontSize: TYPE.label.size, color: C.red, margin: "0 0 8px" }}>{err}</p>}
        {!edit ? (
          <>
            <div style={{ fontFamily: SERIF, fontSize: TYPE.tile.size, lineHeight: 1.2 }}>{t.name || "Untitled"}</div>
            <div style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "4px 2px 0" }}>{TEMPLATE_PIPELINES.find(x => x.key === t.pipeline)?.label} · {t.kind === "follow_up" ? "Follow-up" : "Pitch"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 2px 5px" }}>
              <span style={caps}>Media kit</span>
              {pickPdf && <button onClick={() => onShare(pick!)} style={{ ...linkBtn, display: "inline-flex", alignItems: "center", gap: 4 }}><Ico d={IC.share} size={12} />Share PDF</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {KITS.map(d => <KitChip key={d.key} k={d.key} on={pick === d.key} onClick={() => setPick(d.key)} />)}
              <KitChip k={null} on={pick === null} onClick={() => setPick(null)} />
            </div>
            {pick && !urlOf(pick) && <p style={{ fontSize: SPACING.listMeta, color: C.amber, margin: "6px 2px 0" }}>No {kitInfo(pick)!.short} link yet · add it in Edit links.</p>}
            {head("Subject", t.subject.trim() ? () => onCopySubject(t.subject.trim()) : undefined)}
            <div style={box}>{t.subject.trim() || <span style={{ color: C.light }}>No subject yet.</span>}</div>
            {head("Text")}
            <div style={box}><BodyPreview body={t.body} kit={pick} /></div>
          </>
        ) : (
          <>
            <Lbl>Name</Lbl>
            <I value={f.name} autoFocus={!!isNew} placeholder="First pitch · brand" aria-label="Name" onChange={(e: any) => setF({ ...f, name: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <Lbl>Purpose</Lbl>
                <I value={f.purpose} list="lh-email-purposes" placeholder="Pitch" aria-label="Purpose" onChange={(e: any) => setF({ ...f, purpose: e.target.value })} />
                <datalist id="lh-email-purposes">{purposes.filter(p => p !== NO_PURPOSE).map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <Lbl>Media kit</Lbl>
                <S value={f.kit || ""} aria-label="Media kit" onChange={(e: any) => setF({ ...f, kit: (e.target.value || null) as KitKey | null })}>
                  <option value="">None</option>
                  {KITS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </S>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <Lbl>For</Lbl>
                <S value={f.pipeline || "lynnhoa"} aria-label="For" onChange={(e: any) => setF({ ...f, pipeline: e.target.value })}>
                  {TEMPLATE_PIPELINES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </S>
              </div>
              <div>
                <Lbl>Type</Lbl>
                <S value={f.kind || "pitch"} aria-label="Type" onChange={(e: any) => setF({ ...f, kind: e.target.value })}>
                  {TEMPLATE_KINDS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </S>
              </div>
            </div>
            <Lbl>Subject</Lbl>
            <I value={f.subject} placeholder="Collaboration idea · {company}" aria-label="Subject" onChange={(e: any) => setF({ ...f, subject: e.target.value })} />
            <Lbl>Text</Lbl>
            <TA value={f.body} aria-label="Text" placeholder={"Hi {name},\n\n…\n\nMy media kit: {kit}\n\nBest, Lynn"} onChange={(e: any) => setF({ ...f, body: e.target.value })} />
            <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "5px 2px 0", lineHeight: 1.5 }}>
              Filled in for each contact when you write from Contacts:<br />
              {"{name}"} first name (no name: “Company team”) · {"{company}"} company · {KIT_TOKEN} media kit link (without it, the link goes at the end)
            </p>
            {!isNew && (
              <button onClick={() => setAskDelete(true)} style={{ ...linkBtn, color: C.red, display: "block", margin: "16px auto 0", padding: 8 }}>Delete template</button>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
