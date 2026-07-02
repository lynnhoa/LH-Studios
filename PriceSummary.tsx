// ─────────────────────────────────────────────────────────────
// PriceSummary — total, retainer toggle, reset, preview
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt } from "./formatters";
import { I, B } from "./atoms";

interface PriceSummaryProps {
  subtotal:       number;
  grand:          number;
  retOn:          boolean;
  retMo:          number;
  onRetToggle:    () => void;
  onRetMoChange:  (n: number) => void;
  onReset:        () => void;
  onPreview:      () => void;
  isRev:          boolean;
}

export default function PriceSummary({
  subtotal, grand, retOn, retMo,
  onRetToggle, onRetMoChange,
  onReset, onPreview, isRev,
}: PriceSummaryProps) {
  return (
    <>
      {/* ── RETAINER TOGGLE ── */}
      <div style={{
        display:     "flex",
        alignItems:  "center",
        gap:         8,
        marginBottom: 11,
        padding:     "9px 12px",
        border:      `1px solid ${C.rule}`,
        borderRadius: 2,
      }}>
        <input
          type="checkbox"
          id="ret"
          checked={retOn}
          onChange={onRetToggle}
          style={{ cursor: "pointer", accentColor: C.black }}
        />
        <label htmlFor="ret" style={{ fontSize: TYPE.label.size, cursor: "pointer", fontFamily: SANS, color: C.black }}>
          Retainer{retOn ? " (−20%)" : ""}
        </label>
        {retOn && <>
          <I
            type="number"
            min={1}
            value={retMo}
            onChange={(e: any) => onRetMoChange(parseInt(e.target.value) || 6)}
            s={{ width: 50 }}
          />
          <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>months</span>
        </>}
      </div>

      {/* ── TOTAL BOX ── */}
      <div style={{
        border:       `1px solid ${C.rule}`,
        borderRadius: 2,
        padding:      "12px 16px",
        marginBottom: 14,
      }}>
        {retOn && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.rule}` }}>
            <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>Subtotal</span>
            <span style={{ fontSize: TYPE.label.size, color: C.muted }}>{fmt(subtotal)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: TYPE.label.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>Total (EUR)</span>
          <span style={{ fontFamily: SERIF, fontSize: TYPE.amount.size, color: C.black }}>{fmt(grand)}</span>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <B
          v="sec"
          onClick={() => { if (window.confirm("Reset all items and start over?")) onReset(); }}
        >
          Reset
        </B>
        <B
          s={{ flex: "1 1 auto", textAlign: "center" as const }}
          onClick={onPreview}
        >
          {isRev ? "Preview Revised Quote" : "Preview & Generate Quote"}
        </B>
      </div>
    </>
  );
}
