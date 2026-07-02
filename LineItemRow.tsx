// ─────────────────────────────────────────────────────────────
// LineItemRow — single line item in the quote builder
// ─────────────────────────────────────────────────────────────

import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt } from "./formatters";

const CAT_LABEL: Record<string, string> = {
  influencer: "Brand Collaboration",
  ugc:        "UGC",
  editorial:  "Editorial",
  complete:   "Mixed",
  hotels:     "Hotels",
};

interface LineItemRowProps {
  item:     any;
  onRemove: () => void;
}

export default function LineItemRow({ item, onRemove }: LineItemRowProps) {
  return (
    <div style={{
      display:        "flex",
      alignItems:     "flex-start",
      justifyContent: "space-between",
      padding:        "10px 0",
      borderBottom:   `1px solid ${C.rule}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Category badge + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <span style={{
            fontSize:      TYPE.micro.size,
            color:         C.white,
            background:    C.muted,
            padding:       "2px 8px",
            borderRadius:  2,
            textTransform: "uppercase" as const,
            letterSpacing: "0.07em",
            flexShrink:    0,
          }}>
            {CAT_LABEL[item.cat] || item.cat}
          </span>
          <span style={{ fontSize: TYPE.subtext.size, color: C.black }}>
            {item.qty > 1 ? `${item.qty}× ` : ""}{item.name}
          </span>
        </div>

        {/* Note */}
        {item.note && (
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 1px", paddingLeft: 52 }}>{item.note}</p>
        )}

        {/* Add-ons */}
        {item.addons?.length > 0 && (
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 1px", paddingLeft: 52 }}>
            {item.addons.join(" · ")}
          </p>
        )}

        {/* Usage + Exclusivity */}
        {(item.usageLabel || item.exclLabel) && (
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: "0 0 1px", paddingLeft: 52 }}>
            {[item.usageLabel, item.exclLabel].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Platforms */}
        {item.platforms?.length > 0 && (
          <p style={{ fontSize: TYPE.label.size, color: C.muted, margin: 0, paddingLeft: 52 }}>
            {item.platforms.join(" · ")}
          </p>
        )}
      </div>

      {/* Amount + remove */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 14 }}>
        <span style={{ fontSize: TYPE.subtext.size, fontFamily: SERIF, color: C.black }}>
          {fmt(item.amt)}
        </span>
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border:     "none",
            cursor:     "pointer",
            color:      C.light,
            fontSize:   14,
            padding:    0,
            lineHeight: 1,
          }}
        >✕</button>
      </div>
    </div>
  );
}
