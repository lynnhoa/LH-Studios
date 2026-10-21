// ─────────────────────────────────────────────────────────────
// ClientForm — a client's details as rows you edit in place, like
// the Business profile. The same layout for a new client and for
// editing one (only the values change); tags as chips; Cancel and
// Save in the bottom bar. Enter goes to the next field.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL, DENSITY, RADIUS } from "./constants";
import { SummaryLine, Strong, SectionHead, ListCard, MiniInput, MiniSelect, PillBtn, BottomBar, BOTTOM_BAR_SPACE } from "./atoms";
import { editLock } from "./saveStatus";
import { countryKnown } from "./docs";

export const EMPTY_CLIENT_FORM = {
  name: "", contact: "", email: "", agency: "Direct",
  street: "", plz: "", city: "", country: "Germany", vatId: "", tags: [] as string[], notes: "",
};
export type ClientFormValues = typeof EMPTY_CLIENT_FORM;
const KEYS = Object.keys(EMPTY_CLIENT_FORM) as (keyof ClientFormValues)[];
const fromClient = (c: any): ClientFormValues => {
  const v: any = { ...EMPTY_CLIENT_FORM };
  KEYS.forEach(k => { if (c && c[k] != null) v[k] = k === "tags" ? [...(c.tags || [])] : c[k]; });
  return v;
};

const LABEL: any = { width: 84, flexShrink: 0, fontSize: TYPE.subtext.size, color: C.muted };
const ROW: any   = { display: "flex", alignItems: "center", gap: 10, minHeight: DENSITY.row1, padding: "0 12px", boxSizing: "border-box" };

export default function ClientForm({ initial, isNew, isMobile, onSave, onCancel }: {
  initial?: any; isNew: boolean; isMobile: boolean;
  onSave: (v: ClientFormValues) => Promise<string | null>;   // an error to show, or null when saved
  onCancel: () => void;
}) {
  useEffect(() => editLock.acquire(), []);                   // no reload while typing
  const [f, setF]       = useState<ClientFormValues>(() => fromClient(initial));
  const [base]          = useState(() => JSON.stringify(fromClient(initial)));
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tagIn, setTagIn] = useState<string | null>(null);  // "+ Tag" while typing a new one
  const set = (k: keyof ClientFormValues, v: any) => { setErr(null); setF(p => ({ ...p, [k]: v })); };
  const changed = JSON.stringify(f) !== base;

  const addTag = () => {
    const t = String(tagIn || "").trim();
    if (t && !f.tags.some(x => x.toLowerCase() === t.toLowerCase())) set("tags", [...f.tags, t]);
    setTagIn(null);
  };
  const save = async () => {
    if (busy) return;
    const name = f.name.trim();
    if (!name) { setErr("Add a brand name."); return; }
    setBusy(true);
    const e = await onSave({ ...f, name, email: f.email.trim() });
    setBusy(false);
    if (e) setErr(e);
  };
  // Enter goes to the next field; in the last one it saves
  const onEnter = (e: any) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const form = e.currentTarget.closest("[data-clientform]");
    const list = (form ? Array.from(form.querySelectorAll("input[data-f]")) : []) as HTMLInputElement[];
    const i = list.indexOf(e.currentTarget);
    if (i >= 0 && i < list.length - 1) list[i + 1].focus(); else { (e.currentTarget as HTMLInputElement).blur(); save(); }
  };
  const field = (k: keyof ClientFormValues, placeholder: string, opts: { type?: string; inputMode?: string; label?: string; s?: any } = {}) => (
    <MiniInput data-f={k} value={String(f[k] ?? "")} onChange={(e: any) => set(k, e.target.value)} onKeyDown={onEnter} enterKeyHint="next"
      placeholder={placeholder} aria-label={opts.label || placeholder} type={opts.type} inputMode={opts.inputMode as any}
      autoCapitalize={opts.type === "email" ? "none" : undefined} s={{ flex: 1, ...(opts.s || {}) }} />
  );
  const row = (label: string, body: any, first = false) => (
    <div style={{ ...ROW, borderTop: first ? "none" : `1px solid ${C.line}` }}><span style={LABEL}>{label}</span>{body}</div>
  );
  const chip: any = { height: 30, padding: "0 11px", borderRadius: RADIUS.pill, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: TYPE.subtext.size, whiteSpace: "nowrap" };

  return (
    <div data-clientform="" style={{ paddingBottom: BOTTOM_BAR_SPACE + (err ? 28 : 0), fontFamily: SANS, color: C.black }}>
      <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.screen.size : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>
        {isNew ? "New client" : (f.name.trim() || "Client")}
      </h2>
      {isNew
        ? <SummaryLine dot={PAL.waiting.mid}>Only the brand name is needed · saved when you tap Save</SummaryLine>
        : <SummaryLine dot={changed ? PAL.waiting.mid : PAL.neutral.mid}>{changed ? <Strong color={PAL.waiting.ink}>Unsaved changes</Strong> : "Editing"} · nothing is saved until you tap Save</SummaryLine>}

      <SectionHead label="Contact" />
      <ListCard>
        {row("Brand name", field("name", "Sephora", { label: "Brand name" }), true)}
        {row("Contact", field("contact", "First and last name", { label: "Contact" }))}
        {row("Email", field("email", "name@brand.com", { type: "email", inputMode: "email", label: "Email" }))}
        {row("Agency", (
          <MiniSelect value={f.agency || "Direct"} onChange={(e: any) => set("agency", e.target.value)} aria-label="Agency or direct" s={{ flex: 1 }}>
            <option>Direct</option><option>Agency</option>
          </MiniSelect>
        ))}
      </ListCard>

      <SectionHead label="Address" />
      <ListCard>
        {row("Street", field("street", "Street and number", { label: "Street" }), true)}
        {row("PLZ · City", <>{field("plz", "PLZ", { inputMode: "numeric", s: { flex: "0 0 72px" } })}{field("city", "City")}</>)}
        {row("Country", field("country", "Deutschland", { label: "Country" }))}
        {f.country.trim() && !countryKnown(f.country) && (
          <div style={{ padding: "0 12px 8px 106px", fontSize: TYPE.subtext.size, color: PAL.waiting.ink }}>Not recognised for VAT — check the spelling</div>
        )}
        {row("VAT ID", field("vatId", "optional", { label: "VAT ID" }))}
      </ListCard>

      <SectionHead label="Tags" />
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
        {f.tags.map(t => (
          <span key={t} style={{ ...chip, background: PAL.late.wash, border: `1px solid ${PAL.late.mid}`, color: PAL.late.ink, paddingRight: 4 }}>
            {t}
            <button onClick={() => set("tags", f.tags.filter(x => x !== t))} aria-label={`Remove tag ${t}`}
              style={{ width: 24, height: 24, border: "none", background: "none", color: PAL.late.ink, cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
          </span>
        ))}
        {tagIn === null
          ? <button onClick={() => setTagIn("")} style={{ ...chip, border: `1px solid ${C.rule}`, background: C.white, color: C.ink2, cursor: "pointer" }}>+ Tag</button>
          : <MiniInput autoFocus value={tagIn} placeholder="New tag" aria-label="New tag" onChange={(e: any) => setTagIn(e.target.value)} onBlur={addTag}
              onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === "Escape") setTagIn(null); }} s={{ width: 140 }} />}
      </div>

      <SectionHead label="Notes" />
      <ListCard>
        <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Relationship notes" aria-label="Notes" rows={3}
          style={{ width: "100%", border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontFamily: SANS, fontSize: 16, color: C.black, resize: "vertical" as const, boxSizing: "border-box" as const, display: "block" }} />
      </ListCard>

      {err && <p role="alert" style={{ fontSize: TYPE.label.size, color: C.red, margin: "10px 2px 0" }}>{err}</p>}

      <BottomBar>
        <PillBtn onClick={onCancel} s={{ flex: 1, height: 40, justifyContent: "center" }}>Cancel</PillBtn>
        <PillBtn dark onClick={save} dim={busy} s={{ flex: 1.4, height: 40, justifyContent: "center" }}>{busy ? "Saving…" : "Save"}</PillBtn>
      </BottomBar>
    </div>
  );
}
