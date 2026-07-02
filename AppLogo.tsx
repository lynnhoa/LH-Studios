// ─────────────────────────────────────────────────────────────
// AppLogo — three sizes: nav | auth | web
// ─────────────────────────────────────────────────────────────

import { C, SERIF, SANS, TYPE } from "./constants";

type LogoSize = "nav" | "auth" | "web";

interface AppLogoProps {
  size?: LogoSize;
  onClick?: () => void;
}

const LOGO_SIZES: Record<LogoSize, { name: number; studio: number; gap: number }> = {
  auth: { name: 26, studio: TYPE.micro.size, gap: 6 },
  web:  { name: 20, studio: TYPE.micro.size, gap: 3 },
  nav:  { name: 16, studio: TYPE.micro.size, gap: 2 },
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
