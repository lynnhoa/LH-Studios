// ─────────────────────────────────────────────────────────────
// AppLogo — three sizes: nav | auth | web
// ─────────────────────────────────────────────────────────────

import { C, SERIF, SANS, TYPE } from "./constants";

type LogoSize = "nav" | "auth" | "web";

interface AppLogoProps {
  size?: LogoSize;
  onClick?: () => void;
}

const LOGO_SIZES: Record<LogoSize, { name: number; studio: number; gap: number; padY: number }> = {
  auth: { name: 26, studio: TYPE.micro.size, gap: 6, padY: 0 },
  web:  { name: 20, studio: TYPE.micro.size, gap: 3, padY: 0 },
  nav:  { name: 30, studio: TYPE.micro.size, gap: 2, padY: 8 },
};

export default function AppLogo({ size = "nav", onClick }: AppLogoProps) {
  const sz = LOGO_SIZES[size];

  return (
    <div
      onClick={onClick}
      style={{
        textAlign:   "center",
        lineHeight:  1,
        display:     "inline-block",
        padding:     `${sz.padY}px 0`,
        cursor:      onClick ? "pointer" : "default",
        userSelect:  "none" as const,
      }}
    >
      <span
        style={{
          fontFamily:    SERIF,
          fontSize:      sz.name,
          letterSpacing: "0.02em",
          color:         C.black,
          display:       "block",
        }}
      >
        Lynn Hoa
      </span>
      <span
        style={{
          fontFamily:    SANS,
          fontSize:      sz.studio,
          letterSpacing: "0.26em",
          textTransform: "uppercase" as const,
          color:         C.muted,
          display:       "block",
          marginTop:     sz.gap,
        }}
      >
        Studio
      </span>
    </div>
  );
}
