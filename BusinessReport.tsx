// ─────────────────────────────────────────────────────────────
// BusinessReport — the report of a trip or an event (like Maintenance's
// Bericht pop-up): one level, opened from the card's report button.
//   Report   Programme (what happened, one line each) · Result
//   Photos   from the library or the camera — saved right away, ✕ removes one
// Footer: Save while something is typed · Create PDF (German, for the tax files —
// it uses what is typed, saved or not). The PDF: businessPdf.tsx.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { C, TYPE, PAL, SANS, RADIUS } from "./constants";
import { Sheet, SheetHead, SheetRow, SheetMeta, SheetErr, SheetButton, MiniArea, ConfirmDialog, useDraft, SHEET_CARD } from "./atoms";
import { showNote } from "./undo";
import type { BizCategory } from "./business";
import type { BusinessHook } from "./useBusiness";
import { photoBlob } from "./useBusiness";
import { downloadCaseReport } from "./businessPdf";
import { BizIco, BIZ_IC } from "./BusinessParts";

const link: any = {
  background: "none", border: "none", padding: "8px 0", margin: "-8px 0", cursor: "pointer", fontFamily: SANS,
  fontSize: TYPE.label.size, color: PAL.neutral.ink, whiteSpace: "nowrap" as const, WebkitTapHighlightColor: "transparent",
};

export default function ReportWindow({ biz, caseId, nums, cats, settings, onClose }: {
  biz: BusinessHook; caseId: string; nums: Map<string, string>; cats: BizCategory[]; settings: any; onClose: () => void;
}) {
  const x = biz.cases.find(c => c.id === caseId) || null;
  const trip = x?.kind === "trip";
  const no = x ? nums.get(x.id) || "" : "";
  const stored = { program: String(x?.report?.program || ""), result: String(x?.report?.result || "") };
  const dr = useDraft(stored);
  const f = dr.d;
  const [err, setErr]     = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [making, setMaking] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [ask, setAsk]     = useState<string | null>(null);     // the photo to remove
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const made = useRef<string[]>([]);                        // every preview link, let go when the window closes
  const photos: any[] = (x?.report?.photos || []) as any[];
  useEffect(() => { if (!x) onClose(); }, [!!x]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the small pictures (fetched once, kept for this window)
  const key = photos.map(p => p.path).join("|");
  useEffect(() => {
    let off = false;
    (async () => {
      for (const ph of photos) {
        if (thumbs[ph.path]) continue;
        const b = await photoBlob(ph.path);
        if (off || !b) continue;
        const u = URL.createObjectURL(b); made.current.push(u);
        setThumbs(t => ({ ...t, [ph.path]: u }));
      }
    })();
    return () => { off = true; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { made.current.forEach(u => URL.revokeObjectURL(u)); made.current = []; }, []);

  if (!x) return null;
  const save = async () => {
    if (busy) return;
    setErr(null); setBusy(true);
    try {
      dr.saving();
      await biz.updateCase(x.id, { report: { ...(x.report || {}), program: f.program.trim(), result: f.result.trim() } });
      showNote("Saved ✓");
    } catch (e: any) { dr.failed(); setErr(e?.message || "Couldn't save."); }
    finally { setBusy(false); }
  };
  // straight in the tap (the iPhone opens the PDF only then); what is typed goes in, saved or not
  const pdf = () => {
    if (making) return;
    setErr(null); setMaking(true);
    const draft = { ...x, report: { ...(x.report || {}), program: f.program, result: f.result } };
    const run = downloadCaseReport({ x: draft, no, costs: biz.costs, nums, cats, settings });
    if (dr.changed) save();
    run.catch((e: any) => setErr(e?.message || "The PDF couldn't be made.")).finally(() => setMaking(false));
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    if (fileRef.current) fileRef.current.value = "";
    setErr(null); setPhotoBusy(true);
    try { await biz.addPhotos(x, list); showNote(list.length === 1 ? "Photo added ✓" : `${list.length} photos added ✓`); }
    catch (e: any) { setErr(e?.message || "The photos couldn't be added."); }
    finally { setPhotoBusy(false); }
  };
  const dropPhoto = async () => {
    const path = ask; setAsk(null);
    if (!path) return;
    try { await biz.removePhoto(x, path); showNote("Photo removed"); }
    catch (e: any) { setErr(e?.message || "Couldn't remove the photo."); }
  };

  const footer = (
    <>
      {dr.changed && <SheetButton dim={busy} onClick={save}>{busy ? "Saving…" : "Save"}</SheetButton>}
      <SheetButton dark dim={making} onClick={pdf}>{making ? "Making the PDF…" : "Create PDF"}</SheetButton>
    </>
  );

  return (
    <>
      {ask && <ConfirmDialog title="Remove the photo?" text="It's taken out of the report and deleted." okLabel="Remove" danger onOk={dropPhoto} onCancel={() => setAsk(null)} />}
      <input ref={fileRef} type="file" accept="image/*" multiple aria-hidden="true" tabIndex={-1} style={{ display: "none" }} onChange={(e: any) => addPhotos(e.target.files)} />
      <Sheet title={`${trip ? "Trip report" : "Event report"} · ${no}`} onClose={onClose} dirty={dr.changed} footer={footer}>
        {err && <SheetErr>{err}</SheetErr>}
        <SheetHead first icon={<BizIco d={BIZ_IC.report} size={11} />} label="Report" tone={PAL.neutral} />
        <div style={SHEET_CARD}>
          <SheetRow first top label="Programme">
            <MiniArea value={f.program} onChange={(v) => dr.setD(d => ({ ...d, program: v }))} ariaLabel="Programme" minRows={4} pad={[9, 0]}
              placeholder={trip ? "Tue: shows Maison Clair, Atelier Nord\nWed: meeting Agentur Nord\nThu: content shoot" : "Welcome, dinner, brand presentation"} />
          </SheetRow>
          <SheetRow top label="Result">
            <MiniArea value={f.result} onChange={(v) => dr.setD(d => ({ ...d, result: v }))} ariaLabel="Result" minRows={3} pad={[9, 0]}
              placeholder="12 reels · 1 paid collab in talks" />
          </SheetRow>
        </div>
        <SheetMeta>One line each — a line starting with “-” becomes a bullet.</SheetMeta>

        <SheetHead icon={<BizIco d={BIZ_IC.photo} size={11} />} label="Photos" tone={PAL.neutral}
          right={<button onClick={() => fileRef.current?.click()} style={link} disabled={photoBusy}>{photoBusy ? "Adding…" : "+ Add photos"}</button>} />
        <div style={{ ...SHEET_CARD, padding: photos.length ? 8 : 0 }}>
          {photos.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {photos.map(ph => (
                <div key={ph.path} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: RADIUS.field, overflow: "hidden", background: PAL.neutral.wash }}>
                  {thumbs[ph.path] && <img src={thumbs[ph.path]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" as const, display: "block" }} />}
                  <button onClick={() => setAsk(ph.path)} aria-label="Remove photo"
                    style={{ position: "absolute", top: 4, right: 4, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(26,26,26,0.55)", color: C.white, fontSize: 13, cursor: "pointer", padding: 0, lineHeight: "26px" }}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <SheetRow first label="Photos"><span style={{ fontSize: TYPE.row.size, color: C.muted }}>No photos yet</span></SheetRow>
          )}
        </div>
        <SheetMeta>The PDF is in German, for your tax files: the {trip ? "trip" : "event"}'s details, this report, the receipts{trip ? ", the meal allowance" : ""} and the photos.</SheetMeta>
      </Sheet>
    </>
  );
}
