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

import { useState, useEffect, useMemo, useRef } from "react";
import { C, SANS, SERIF, TYPE, PAL, RADIUS, TRACK, SPACING, CARD_TONE } from "./constants";
import { fmtD } from "./formatters";
import { I, S, MenuSelect, MiniInput, MiniArea, Lbl, PillBtn, SummaryLine, Strong, SectionHead, ListCard, Row, Chip, ChipRow, TonedTag, Sheet, SheetHead, SheetRow, SheetAction, SheetMeta, SheetErr, SheetButton, MoreMenu, useDraft, sameDraft, SHEET_CARD, SHEET_CAPS, ROW_ICON, ConfirmDialog, ColGroups } from "./atoms";
import { copyText, OUTREACH_CATEGORIES, catOf } from "./outreach";
import { showNote } from "./undo";
import { KITS, KIT_TOKEN, kitInfo, fillText, fmtSize, TEMPLATE_PIPELINES, TEMPLATE_KINDS, TEMPLATE_CHANNELS, kindLabel } from "./useEmailKit";
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
  open:       "M10.5 6.5H8a2.5 2.5 0 0 0-2.5 2.5v7A2.5 2.5 0 0 0 8 18.5h7a2.5 2.5 0 0 0 2.5-2.5v-2.5M13.5 5.5h5v5M18.5 5.5l-7 7",
  file:       "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 13h6M9 17h6",
  mail:       "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6",
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
// "Hotel, Restaurant" · "Any category" — the categories a template is for
const catsText = (t: EmailTemplate) => (t.categories || []).length ? (t.categories || []).map(k => catOf(k).label).join(", ") : "Any category";
// ↑ / ↓ while sorting (a light round button, faint at the ends)
const MoveBtn = ({ dir, label, off, onClick }: { dir: "up" | "down"; label: string; off: boolean; onClick: () => void }) => (
  <button onClick={off ? undefined : onClick} aria-label={label} title={label} aria-disabled={off}
    style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${off ? C.line : C.edge}`, background: C.white, color: off ? C.faint : C.black,
      cursor: off ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontSize: 14, fontFamily: SANS }}>{dir === "up" ? "↑" : "↓"}</button>
);
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
  // Sort: ↑ ↓ move a template one place; the new order is saved right away
  const [sorting, setSorting] = useState(false);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= templates.length) return;
    const ids = templates.map(t => t.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    kit.saveOrder(ids).catch((e: any) => showNote(e?.message || "Couldn't save the order."));
  };

  return (
    <div>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Email kit</h2>
      <SummaryLine dot={PAL.neutral.mid}>
        <span><Strong>{kits.length || KITS.length}</Strong> media kits · <Strong>{templates.length}</Strong> {templates.length === 1 ? "template" : "templates"}</span>
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
          <SectionHead label="Email templates" right={sorting
            ? <button onClick={() => setSorting(false)} style={linkBtn}>Done</button>
            : <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
                {templates.length > 1 && <button onClick={() => setSorting(true)} style={linkBtn}>Sort</button>}
                <button onClick={() => setAdding(true)} style={{ ...linkBtn, textDecoration: "none" }}>+ Add</button>
              </span>} />
          {loading ? null : sorting ? (
            <>
              {/* your own order: ↑ ↓ move a template, saved right away */}
              <ListCard s={{ marginTop: 0 }}>
                {templates.map((t, i) => (
                  <Row key={t.id} first={i === 0} chevron={false}
                    title={t.name || "Untitled"}
                    meta={<>{t.pipeline === "ugc" ? "UGC" : "@lynnhoa"} · {kindLabel(t.kind)} · Kit: {t.kit ? <span style={{ color: toneOf(t.kit).ink }}>{kitInfo(t.kit)!.label}</span> : "none"}</>}
                    right={<span style={{ display: "inline-flex", gap: 6 }}>
                      <MoveBtn dir="up" label={`Move ${t.name || "this template"} up`} off={i === 0} onClick={() => move(i, -1)} />
                      <MoveBtn dir="down" label={`Move ${t.name || "this template"} down`} off={i === templates.length - 1} onClick={() => move(i, 1)} />
                    </span>} />
                ))}
              </ListCard>
              <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "6px 2px 0" }}>This order is also used in each contact's template list.</p>
            </>
          ) : templates.length === 0 ? (
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
                const list = templates.filter(t => (t.purpose.trim() || NO_PURPOSE) === p);   // in your own order (Sort)
                return { key: p, size: list.length, node: (
                  <div>
                    {purposes.length > 1 && <SectionHead label={p} />}
                    <ListCard s={purposes.length > 1 ? undefined : { marginTop: 0 }}>
                      {list.map((t, i) => (
                        <Row key={t.id} first={i === 0} chevron={false} onClick={() => setOpenId(t.id)}
                          title={t.name || "Untitled"}
                          meta={<>{t.pipeline === "ugc" ? "UGC" : "@lynnhoa"}{t.channel === "dm" ? " · DM" : ""} · {kindLabel(t.kind)} · {catsText(t)} · Kit: {t.kit ? <span style={{ color: toneOf(t.kit).ink }}>{kitInfo(t.kit)!.label}</span> : "none"}</>}
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
      {/* one window: after Add template the same window becomes the saved template (no close + reopen blink) */}
      {(current || adding) && (
        <TemplateWindow key="template" isNew={!current} t={current || { id: "", name: "", purpose: purpose !== "all" && purpose !== NO_PURPOSE ? purpose : "", subject: "", body: "", kit: null, createdAt: "", pipeline: "lynnhoa", kind: "pitch", categories: [], sortOrder: null, channel: "email" }}
          kit={kit} purposes={purposes} urlOf={urlOf} onCopy={copyTemplate} onShare={sharePdf} onCopySubject={(s) => copy(s, "Subject copied ✓")}
          onClose={() => { setOpenId(null); setAdding(false); }} onCreated={(id) => { setAdding(false); setOpenId(id); }} />
      )}
    </div>
  );
}

// ── Media kits: the 4 kits in one window — one level, the fields are the view (like Contact) ──
// Each kit: its section head (colour · name · account) and a card: View link (↗ opens it) · PDF
// (Share, ⋯ Replace / Delete — or Upload PDF; saved right away) · File · Focus; "Link updated …" under it.
// Footer: Done → Save as soon as you type (the window stays open); ✕ with unsaved typing asks first.
const typedKits = (list: MediaKit[]) => list.map(k => `${k.key}|${k.url.trim()}|${k.file.trim()}|${k.focus.trim()}`).join("\n");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "");
// a link field: shows the link without https://www. — the whole link while you type
function LinkInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [foc, setFoc] = useState(false);
  return (
    <MiniInput bare type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label={label} placeholder="Paste the view link"
      value={foc ? value : shortUrl(value)} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} onChange={(e: any) => onChange(e.target.value)} />
  );
}
function LinksWindow({ kit, onShare, onClose }: { kit: EmailKitHook; onShare: (k: KitKey) => void; onClose: () => void }) {
  const kits = kit.kits;
  // what you type (link · file · focus): the shared draft — PDFs and dates always come from the stored kits
  const dr = useDraft<MediaKit[]>(kits, { same: (a, b) => typedKits(a) === typedKits(b) });
  const f = dr.d;
  const [err, setErr]         = useState<string | null>(null);
  const [badKey, setBadKey]   = useState<KitKey | null>(null);           // the kit whose link isn't a link
  const [busy, setBusy]       = useState(false);
  const [busyKey, setBusyKey] = useState<KitKey | null>(null);           // a PDF being uploaded / deleted
  const [askDel, setAskDel]   = useState<KitKey | null>(null);
  useEffect(() => { kit.preloadPdfs(); }, [kit.kits]);                    // ready for Share in the same tap
  useEffect(() => { if (badKey) document.getElementById(`kit-err-${badKey}`)?.scrollIntoView?.({ block: "center", behavior: "smooth" }); }, [badKey]);
  const set = (key: KitKey, patch: Partial<MediaKit>) => { dr.setD(p => p.map(k => (k.key === key ? { ...k, ...patch } : k))); if (key === badKey) setBadKey(null); };
  const save = async () => {
    if (busy) return;
    setErr(null);
    const bad = f.find(k => k.url.trim() && !/^https?:\/\//i.test(k.url.trim()));
    if (bad) { setBadKey(bad.key); return; }
    setBusy(true); dr.saving();
    try { await kit.saveKits(f); showNote("Saved ✓"); }
    catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
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
  const pill: any = { height: 28, padding: "0 11px" };

  return (
    <>
      {askDel && <ConfirmDialog title={`Delete the ${kitInfo(askDel)!.short} PDF?`} text="The PDF is removed from this media kit. The Canva link stays." okLabel="Delete" danger onOk={() => removePdf(askDel)} onCancel={() => setAskDel(null)} />}
      <Sheet title="Media kits" still onClose={onClose} dirty={dr.changed}
        footer={dr.changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton> : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}
        <p style={{ fontSize: SPACING.listMeta, color: C.muted, margin: "0 2px 6px", lineHeight: 1.4 }}>Use Canva's view-only link (Share → Public view link), never the edit link.</p>
        {f.map((k, i) => {
          const d = kitInfo(k.key)!;
          const st = kits.find(x => x.key === k.key);
          const p = st?.pdf ?? null;
          const url = k.url.trim();
          const meta = [st?.url && st.updatedAt ? `Link updated ${fmtD(st.updatedAt.slice(0, 10))}` : "", p && p.updatedAt ? `PDF ${fmtD(p.updatedAt.slice(0, 10))}` : ""].filter(Boolean).join(" · ");
          return (
            <div key={k.key}>
              <SheetHead first={i === 0} icon={<Ico d={IC[k.key]} size={11} />} label={d.label} tone={toneOf(k.key)}
                right={<TonedTag tone={d.account === "@lynnhoa" ? PAL.lynnhoa : PAL.neutral}>{d.account}</TonedTag>} />
              <div style={SHEET_CARD}>
                <SheetRow first label="View link"
                  right={/^https?:\/\//i.test(url) ? <button onClick={() => window.open(url, "_blank", "noopener")} aria-label={`Open the ${d.label} link`} title="Open the link" style={ROW_ICON}><Ico d={IC.open} size={14} /></button> : null}>
                  <LinkInput value={k.url} onChange={v => set(k.key, { url: v })} label={`${d.label} view link`} />
                </SheetRow>
                <SheetRow label="PDF"
                  right={busyKey === k.key ? null : p
                    ? <><PillBtn onClick={() => onShare(k.key)} s={pill}><Ico d={IC.share} size={13} />Share</PillBtn>
                        <MoreMenu size={30} items={[{ label: "Replace PDF", onClick: () => upload(k.key) }, { label: "Delete PDF", danger: true, onClick: () => setAskDel(k.key) }]} /></>
                    : <PillBtn dim={busyKey !== null} onClick={() => { if (busyKey === null) upload(k.key); }} s={pill}>Upload PDF</PillBtn>}>
                  <span style={{ display: "block", fontSize: SPACING.listText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {busyKey === k.key ? <span style={{ color: C.muted }}>Saving…</span>
                      : p ? <>{p.name} <span style={{ color: C.muted }}>· {fmtSize(p.size)}</span></> : <span style={{ color: C.light }}>No PDF yet</span>}
                  </span>
                </SheetRow>
                <SheetRow label="File"><MiniInput bare value={k.file} placeholder="Canva file name" aria-label={`${d.label} Canva file`} onChange={(e: any) => set(k.key, { file: e.target.value })} /></SheetRow>
                <SheetRow label="Focus"><MiniInput bare value={k.focus} placeholder="What it's for" aria-label={`${d.label} focus`} onChange={(e: any) => set(k.key, { focus: e.target.value })} /></SheetRow>
              </div>
              {badKey === k.key && <div id={`kit-err-${k.key}`}><SheetMeta s={{ color: C.red }}>This isn't a view link yet — it must start with https:// (Canva → Share → Public view link).</SheetMeta></div>}
              {meta && <SheetMeta>{meta}</SheetMeta>}
            </div>
          );
        })}
      </Sheet>
    </>
  );
}

// ── one template — one level, the fields are the view (like Contact) ──
// Top card: the media kit (saved at once) · Share PDF · Copy text. Template card: Name · Purpose · For ·
// Type · Channel · (Media kit, new only) · Categories. Text card: Subject (copy) · the text. ⋯ Delete.
// Footer: Done → Save as soon as you type (stays open) · a new template: Add template (opens as itself).
// the template's fields you type (the kit is picked in the top card and saved at once — a new template types it too)
const tplTyped = (x: EmailTemplate, withKit: boolean) => ({ name: x.name, purpose: x.purpose, subject: x.subject, body: x.body, pipeline: x.pipeline, kind: x.kind,
  channel: x.channel, categories: [...(x.categories || [])].sort(), ...(withKit ? { kit: x.kit } : {}) });
function TemplateWindow({ t, kit, purposes, urlOf, onCopy, onShare, onCopySubject, onClose, onCreated, isNew }: {
  t: EmailTemplate; kit: EmailKitHook; purposes: string[]; urlOf: (k: KitKey | null) => string;
  onCopy: (t: EmailTemplate, k: KitKey | null) => void; onShare: (k: KitKey) => void; onCopySubject: (s: string) => void;
  onClose: () => void; onCreated?: (id: string) => void; isNew?: boolean;
}) {
  // what you type: the shared draft (atoms) — a new template ignores updates from outside
  const dr = useDraft<EmailTemplate>(t, { frozen: !!isNew, same: (a, b) => sameDraft(tplTyped(a, !!isNew), tplTyped(b, !!isNew)) });
  const f = dr.d;
  const changed = dr.changed;
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { kit.preloadPdfs(); }, [kit.kits]);                    // ready for Share PDF in the same tap
  const pick = f.kit;
  const pickPdf = pick ? kit.kits.find(k => k.key === pick)?.pdf ?? null : null;
  const setPick = (k: KitKey | null) => {
    dr.setD(x => ({ ...x, kit: k }));
    if (!isNew) kit.updateTemplate(t.id, { kit: k }).catch((e: any) => setErr(e?.message || "Couldn't save."));
  };
  const save = async () => {
    if (busy) return;
    setErr(null);
    if (!f.name.trim()) { setErr("Please enter a name."); return; }
    setBusy(true);
    try {
      if (isNew) { dr.saving(); const n = await kit.addTemplate(f); onCreated?.(n.id); return; }   // the same window becomes the template: take what's stored
      dr.saving();
      await kit.updateTemplate(t.id, f); showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  const del = async () => {
    setAskDelete(false);
    try { await kit.deleteTemplate(t.id); onClose(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete."); }
  };
  const sel = (key: keyof EmailTemplate) => (e: any) => { const v = e.target.value; dr.setD(x => ({ ...x, [key]: v } as EmailTemplate)); };
  const accT = f.pipeline === "ugc" ? PAL.createbylynn : PAL.lynnhoa;
  return (
    <>
      {askDelete && <ConfirmDialog title={`Delete ${t.name || "this template"}?`} text="The template is removed from your Email kit." okLabel="Delete" danger onOk={del} onCancel={() => setAskDelete(false)} />}
      <Sheet title={isNew ? "New template" : t.purpose || "Template"} still onClose={onClose} dirty={changed}
        right={isNew ? null : <MoreMenu items={[{ label: "Delete template", danger: true, onClick: () => setAskDelete(true) }]} />}
        footer={isNew ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Add template"}</SheetButton>
          : changed ? <SheetButton dark dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>
          : <SheetButton onClick={onClose}>Done</SheetButton>}>
        {err && <SheetErr>{err}</SheetErr>}

        {/* ── the media kit · Copy text ── */}
        {!isNew && (
          <SheetAction>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px 6px" }}>
              <span style={SHEET_CAPS}>Media kit</span>
              {pickPdf && <button onClick={() => onShare(pick!)} style={{ ...linkBtn, display: "inline-flex", alignItems: "center", gap: 4 }}><Ico d={IC.share} size={12} />Share PDF</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {KITS.map(d => <KitChip key={d.key} k={d.key} on={pick === d.key} onClick={() => setPick(d.key)} />)}
              <KitChip k={null} on={pick === null} onClick={() => setPick(null)} />
            </div>
            {pick && !urlOf(pick) && <p style={{ fontSize: SPACING.listMeta, color: C.amber, margin: "6px 2px 0" }}>No {kitInfo(pick)!.short} link yet · add it in Edit links.</p>}
            <PillBtn dark onClick={() => onCopy(f, pick)} s={{ width: "100%", height: 32, marginTop: 8, justifyContent: "center", fontSize: TYPE.subtext.size }}><Ico d={IC.copy} size={14} />Copy text</PillBtn>
          </SheetAction>
        )}

        {/* ── the template ── */}
        {!isNew && <SheetHead icon={<Ico d={IC.file} size={11} />} label="Template" tone={PAL.neutral} />}
        <div style={{ ...SHEET_CARD, marginTop: isNew ? 2 : 0 }}>
          <SheetRow first label="Name"><MiniInput bare value={f.name} autoFocus={!!isNew} placeholder="First pitch · brand" aria-label="Name" onChange={sel("name")} /></SheetRow>
          <SheetRow label="Purpose"><MiniInput bare value={f.purpose} list="lh-email-purposes" placeholder="Pitch" aria-label="Purpose" onChange={sel("purpose")} /></SheetRow>
          <SheetRow label="For">
            <MenuSelect bare value={f.pipeline || "lynnhoa"} aria-label="For" onChange={sel("pipeline")}>
              {TEMPLATE_PIPELINES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Type">
            <MenuSelect bare value={f.kind || "pitch"} aria-label="Type" onChange={sel("kind")}>
              {TEMPLATE_KINDS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          <SheetRow label="Channel">
            <MenuSelect bare value={f.channel || "email"} aria-label="Channel" onChange={sel("channel")}>
              {TEMPLATE_CHANNELS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </MenuSelect>
          </SheetRow>
          {isNew && (
            <SheetRow label="Media kit">
              <MenuSelect bare value={f.kit || ""} aria-label="Media kit" onChange={(e: any) => { const v = (e.target.value || null) as KitKey | null; dr.setD(x => ({ ...x, kit: v })); }}>
                <option value="">None</option>
                {KITS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </MenuSelect>
            </SheetRow>
          )}
          <SheetRow label="Categories" top>
            <div role="group" aria-label="Categories" style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, padding: "6px 0" }}>
              {OUTREACH_CATEGORIES.map(k => {
                const on = (f.categories || []).includes(k.key);
                return <Chip key={k.key} on={on} tone={PAL.neutral} dot={false} label={k.label}
                  onClick={() => dr.setD(x => ({ ...x, categories: (x.categories || []).includes(k.key) ? (x.categories || []).filter(y => y !== k.key) : [...(x.categories || []), k.key] }))} />;
              })}
            </div>
          </SheetRow>
        </div>
        <datalist id="lh-email-purposes">{purposes.filter(p => p !== NO_PURPOSE).map(p => <option key={p} value={p} />)}</datalist>
        <SheetMeta>None picked = any category. Hotel and Restaurant templates only show for hotel and restaurant contacts.</SheetMeta>

        {/* ── the text ── */}
        <SheetHead icon={<Ico d={IC.mail} size={11} />} label="Text" tone={accT} />
        <div style={SHEET_CARD}>
          {f.channel !== "dm" && (
            <SheetRow first label="Subject"
              right={!isNew && f.subject.trim() ? <button onClick={() => onCopySubject(f.subject.trim())} aria-label="Copy the subject" title="Copy the subject" style={ROW_ICON}><Ico d={IC.copy} size={14} /></button> : null}>
              <MiniInput bare value={f.subject} placeholder="Collaboration idea · {company}" aria-label="Subject" onChange={sel("subject")} />
            </SheetRow>
          )}
          <div style={{ borderTop: f.channel !== "dm" ? `1px solid ${C.hair}` : "none" }}>
            <MiniArea value={f.body} ariaLabel="Text" minRows={6} onChange={(v) => dr.setD(x => ({ ...x, body: v }))}
              placeholder={f.channel === "dm" ? "Hi {name}! … 2–4 short lines …\n\nMy media kit: {kit}" : "Hi {name},\n\n…\n\nMy media kit: {kit}\n\nBest, Lynn"} />
          </div>
        </div>
        <SheetMeta>
          {f.channel === "dm" ? <>A DM is copied and Instagram opens the chat — paste and send. Keep it to 2–4 lines.<br /></> : null}
          Filled in for each contact when you write from Contacts: {"{name}"} first name (no name: “Company team”) · {"{company}"} company · {KIT_TOKEN} media kit link (without it, the link goes at the end)
        </SheetMeta>
      </Sheet>
    </>
  );
}
