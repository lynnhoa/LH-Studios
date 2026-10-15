// ─────────────────────────────────────────────────────────────
// PriceSummary — total, retainer toggle, reset, preview
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt } from "./formatters";
import { I, B, Tick, ConfirmDialog } from "./atoms";

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
  const [askReset, setAskReset] = useState(false);
  return (
    <>
      {askReset && (
        <ConfirmDialog title="Start over?" text="All items in this quote are removed." okLabel="Reset" danger
          onOk={() => { setAskReset(false); onReset(); }} onCancel={() => setAskReset(false)} />
      )}
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
        <Tick on={retOn} onClick={onRetToggle} size={18} label={`Retainer${retOn ? " (−20 %)" : ""}`} />
        {retOn && <>
          <I
            type="number"
            min={1}
            value={retMo}
            onChange={(e: any) => onRetMoChange(parseInt(e.target.value) || 6)}
            s={{ width: 50 }}
          />
          <span style={{ fontSize: TYPE.micro.size, color: C.muted }}>months · total shown per month</span>
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
          onClick={() => setAskReset(true)}
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
