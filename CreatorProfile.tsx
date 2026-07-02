// ─────────────────────────────────────────────────────────────
// CreatorProfile — business info used on all PDFs
// Auto-saves via updateSettings on every field change
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, TYPE } from "./constants";
import { I, B, Lbl } from "./atoms";
import { SETTINGS_DEFAULT } from "./rateCards";

interface CreatorProfileProps {
  settings:        any;
  updateSettings:  (u: any) => Promise<string | null>;
  isMobile:        boolean;
}

export default function CreatorProfile({ settings, updateSettings, isMobile }: CreatorProfileProps) {
  const s   = { ...SETTINGS_DEFAULT, ...settings };
  const upd = (k: string, v: any) => updateSettings({ [k]: v });

  const ku = s.kleinunternehmer === true || s.kleinunternehmer === "true";

  const Sec = ({ title }: { title: string }) => (
    <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "28px 0 11px", paddingBottom: 6, borderBottom: `1px solid ${C.rule}` }}>
      {title}
    </p>
  );

  const Toggle = ({ val, opt, labels, onChange }: { val: any; opt: any[]; labels: string[]; onChange: (v: any) => void }) => (
    <div style={{ display: "flex", gap: 7, marginTop: 5 }}>
      {opt.map((o, i) => (
        <button key={String(o)} onClick={() => onChange(o)}
          style={{ padding: "6px 14px", border: `1px solid ${String(val) === String(o) ? C.black : C.rule}`, background: String(val) === String(o) ? C.black : C.bg, color: String(val) === String(o) ? C.white : C.muted, cursor: "pointer", fontFamily: SANS, fontSize: TYPE.micro.size, letterSpacing: "0.1em", textTransform: "uppercase" as const, borderRadius: 2 }}>
          {labels[i]}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: "0 0 6px" }}>Creator Profile</h2>
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>Business info used on all PDFs</p>
      </div>

      {/* ── IDENTITY ── */}
      <Sec title="Identity" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Full Name</Lbl><I value={s.name} onChange={(e: any) => upd("name", e.target.value)} placeholder="My Linh Hoa" /></div>
        <div><Lbl>Business / Brand Name</Lbl><I value={s.company} onChange={(e: any) => upd("company", e.target.value)} placeholder="Lynn Hoa Studio" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Phone (optional)</Lbl><I value={s.phone} onChange={(e: any) => upd("phone", e.target.value)} placeholder="+49 …" /></div>
      </div>

      {/* ── ADDRESS ── */}
      <Sec title="Address" />
      <div style={{ marginBottom: 9 }}>
        <Lbl>Street & Number</Lbl>
        <I value={s.street} onChange={(e: any) => upd("street", e.target.value)} placeholder="Musterstraße 12" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Postal Code (PLZ)</Lbl><I value={s.plz} onChange={(e: any) => upd("plz", e.target.value)} placeholder="10115" /></div>
        <div><Lbl>City</Lbl><I value={s.city} onChange={(e: any) => upd("city", e.target.value)} placeholder="Berlin" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Country</Lbl><I value={s.country} onChange={(e: any) => upd("country", e.target.value)} placeholder="Deutschland" /></div>
      </div>

      {/* ── ONLINE ── */}
      <Sec title="Online" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Email</Lbl><I value={s.email} onChange={(e: any) => upd("email", e.target.value)} placeholder="hello@lynnhoa.com" /></div>
        <div><Lbl>Website</Lbl><I value={s.website} onChange={(e: any) => upd("website", e.target.value)} placeholder="lynnhoa.com" /></div>
      </div>

      {/* ── BANKING ── */}
      <Sec title="Banking" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Bank</Lbl><I value={s.bankName} onChange={(e: any) => upd("bankName", e.target.value)} placeholder="Commerzbank" /></div>
        <div><Lbl>IBAN</Lbl><I value={s.iban} onChange={(e: any) => upd("iban", e.target.value)} placeholder="DE89 …" /></div>
        <div><Lbl>BIC</Lbl><I value={s.bic} onChange={(e: any) => upd("bic", e.target.value)} placeholder="COBADEFFXXX" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>PayPal (optional)</Lbl><I value={s.paypalEmail} onChange={(e: any) => upd("paypalEmail", e.target.value)} placeholder="pay@lynnhoa.com" /></div>
      </div>

      {/* ── TAX ── */}
      <Sec title="Tax" />
      <div style={{ marginBottom: 14 }}>
        <Lbl>Kleinunternehmerregelung (§ 19 UStG)</Lbl>
        <Toggle
          val={ku ? "true" : "false"}
          opt={["true","false"]}
          labels={["Yes","No"]}
          onChange={v => {
            const isKU = v === "true";
            updateSettings({
              kleinunternehmer: isKU,
              taxNote: isKU ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet." : "",
            });
          }}
        />
        <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "7px 0 0", lineHeight: 1.6 }}>
          {ku ? "No VAT charged on invoices" : "VAT is charged on invoices"}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9, marginBottom: 9 }}>
        <div><Lbl>Tax Number (Steuernummer)</Lbl><I value={s.steuernummer} onChange={(e: any) => upd("steuernummer", e.target.value)} placeholder="12/345/67890" /></div>
        {!ku && <div><Lbl>VAT ID (USt-IdNr.)</Lbl><I value={s.ustIdNr} onChange={(e: any) => upd("ustIdNr", e.target.value)} placeholder="DE123456789" /></div>}
      </div>
      {!ku && (
        <div style={{ marginBottom: 9 }}>
          <Lbl>VAT Rate</Lbl>
          <Toggle
            val={String(s.vatRate || "19")}
            opt={["19","7"]}
            labels={["19 % (standard)","7 % (reduced)"]}
            onChange={v => upd("vatRate", parseInt(v))}
          />
        </div>
      )}
      <div style={{ marginBottom: 9, marginTop: ku ? 0 : 9 }}>
        <Lbl>Invoice Tax Note</Lbl>
        <I
          value={s.taxNote}
          onChange={(e: any) => upd("taxNote", e.target.value)}
          placeholder={ku ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet." : "zzgl. 19 % MwSt"}
        />
        <p style={{ fontSize: TYPE.micro.size, color: C.muted, margin: "5px 0 0" }}>Appears on every PDF</p>
      </div>

      {/* ── AUTOSAVE NOTICE ── */}
      <div style={{ marginTop: 16, padding: "11px 14px", background: "#fdf6ee", border: `1px solid ${C.amber}`, borderRadius: 2 }}>
        <p style={{ fontSize: TYPE.label.size, color: C.amber, margin: 0 }}>Changes save automatically. Business info appears on every new PDF.</p>
      </div>
    </div>
  );
}
