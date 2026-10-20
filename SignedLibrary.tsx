// ─────────────────────────────────────────────────────────────
// SignedLibrary — every signed copy (contracts and amendments)
// in one place: by year, then month of the signing (newest
// first). Filter by kind, search by client or project; a tap
// opens the PDF (share sheet on the phone, a new tab on a
// computer). Only documents with a copy are listed — a signed
// one without a copy shows "no copy" on its chip in Projects.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { C, SANS, SERIF, TYPE, PAL, TRACK } from "./constants";
import { fmtD, MONTHS } from "./formatters";
import { SummaryLine, Strong, Chip, ChipRow, SearchField, SectionHead, ListCard, Row, TonedTag } from "./atoms";
import { openSignedCopy } from "./signedPdf";

type Kind = "all" | "contract" | "amendment";
const docTitle = (d: any) => (d.kind === "amendment"
  ? `Amendment${d.docNo ? ` AMD ${String(d.docNo).split("-").pop()}` : ""}`
  : `Contract${d.docNo ? ` ${d.docNo}` : ""}`);

export default function SignedLibrary({ clients, isMobile }: { clients: any[]; isMobile: boolean }) {
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ]       = useState("");
  const [err, setErr]   = useState<string | null>(null);

  // every document with a signed copy, newest signing first
  const all = useMemo(() => (clients || []).flatMap((c: any) => (c.projects || []).flatMap((p: any) => (p.documents || [])
    .filter((d: any) => (d.kind === "contract" || d.kind === "amendment") && d.signedFile?.path)
    .map((d: any) => ({ d, c, p, on: String(d.signedAt || d.signedFile.at || "").slice(0, 10) }))))
    .sort((a: any, b: any) => b.on.localeCompare(a.on) || String(a.c.name).localeCompare(String(b.c.name))), [clients]);

  const ql = q.trim().toLowerCase();
  const rows = all.filter((r: any) => (kind === "all" || r.d.kind === kind) && (!ql || `${r.c.name} ${r.p.name}`.toLowerCase().includes(ql)));
  const nOf = (k: Kind) => all.filter((r: any) => k === "all" || r.d.kind === k).length;

  // year → month groups
  const years: { y: string; months: { m: number; rows: any[] }[]; n: number }[] = [];
  rows.forEach((r: any) => {
    const y = r.on.slice(0, 4) || "—", m = Math.max(0, (parseInt(r.on.slice(5, 7)) || 1) - 1);
    let yy = years.find(x => x.y === y); if (!yy) { yy = { y, months: [], n: 0 }; years.push(yy); }
    let mm = yy.months.find(x => x.m === m); if (!mm) { mm = { m, rows: [] }; yy.months.push(mm); }
    mm.rows.push(r); yy.n++;
  });

  const open = (r: any) => { setErr(null); openSignedCopy(r.d, r.c.name).catch((e: any) => setErr(e?.message || "The signed copy couldn't be opened.")); };
  const clip = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>;

  return (
    <div style={{ fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: TYPE.screen.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Signed contracts</h2>
      <SummaryLine dot={PAL.done.mid}><Strong>{all.length} signed {all.length === 1 ? "copy" : "copies"}</Strong> · contracts and amendments</SummaryLine>
      <ChipRow s={{ marginTop: 12 }}>
        {([["all", "All"], ["contract", "Contracts"], ["amendment", "Amendments"]] as [Kind, string][]).map(([k, l]) => (
          <Chip key={k} on={kind === k} tone={PAL.neutral} dot={false} label={l} count={nOf(k)} onClick={() => setKind(k)} />
        ))}
      </ChipRow>
      <SearchField value={q} onChange={setQ} placeholder="Search client or project" s={{ marginTop: 10 }} />
      {err && <p role="alert" style={{ fontSize: TYPE.label.size, color: C.red, margin: "10px 2px 0" }}>{err}</p>}

      {all.length === 0 ? (
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "18px 2px 0", lineHeight: 1.5 }}>
          No signed copies yet. Open a sent contract in Projects and tap Attach signed copy — it's signed at the same time.
        </p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: TYPE.subtext.size, color: C.muted, margin: "18px 2px 0" }}>Nothing matches.</p>
      ) : years.map(yy => (
        <div key={yy.y}>
          <SectionHead label={yy.y} right={`${yy.n} ${yy.n === 1 ? "copy" : "copies"}`} />
          {yy.months.map(mm => (
            <div key={mm.m}>
              <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 4px 6px", fontSize: TYPE.micro.size, letterSpacing: TRACK.caps, textTransform: "uppercase" as const, color: C.muted }}>
                <span>{MONTHS[mm.m]}</span><span>{mm.rows.length}</span>
              </div>
              <ListCard>
                {mm.rows.map((r: any, i: number) => (
                  <Row key={r.d.id} first={i === 0} chevron={false} onClick={() => open(r)}
                    icon={<span style={{ color: PAL.done.ink, display: "inline-flex" }}>{clip}</span>}
                    title={`${r.c.name} · ${r.p.name}`}
                    meta={`${docTitle(r.d)} · signed ${fmtD(r.on)}${r.d.signedFile.pages ? ` · ${r.d.signedFile.pages} ${r.d.signedFile.pages === 1 ? "page" : "pages"}` : ""}`}
                    right={<TonedTag tone={r.d.kind === "amendment" ? PAL.progress : PAL.done}>PDF</TonedTag>} />
                ))}
              </ListCard>
            </div>
          ))}
        </div>
      ))}
      {!isMobile && all.length > 0 && <div style={{ height: 8 }} />}
    </div>
  );
}
