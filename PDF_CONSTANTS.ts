// ─────────────────────────────────────────────────────────────────
// PDF_CONSTANTS.ts — All PDF styling extracted from old app
// 1:1 copy of Lynn-Hoa-Studio-main PDFEngine styling
// ─────────────────────────────────────────────────────────────────

import { C, SANS, SERIF } from "./constants";

// ═══════════════════════════════════════════════════════════════════
// PAGE LAYOUT
// ═══════════════════════════════════════════════════════════════════

export const PDF = {
  // A4 Page dimensions
  PAGE_WIDTH: 595,    // mm at 72dpi
  PAGE_HEIGHT: 841,   // A4 height
  
  // Main document wrapper
  WRAPPER: {
    padding: "120px 62px 90px",
    fontSize: 9.5,
    lineHeight: 1.5,
    position: "relative" as const,
    minHeight: 841,
    fontFamily: SANS,
    color: C.black,
    background: C.bg,
  },

  // ─── HEADER SECTION ───────────────────────────────────
  HEADER: {
    CONTAINER: {
      margin: "0 0 22px",
    },
    TITLE: {
      fontFamily: SERIF,
      fontSize: 19,
      fontWeight: "normal" as const,
      margin: "0 0 28px",
    },
    CREATOR_LINE: {
      fontSize: 7.5,
      color: C.muted,
      margin: 0,
    },
  },

  // ─── DETAILS SECTION ───────────────────────────────────
  DETAILS: {
    CONTAINER: (type: string) => ({
      display: "flex" as const,
      justifyContent: type === "contract" ? "flex-end" : "space-between",
      marginBottom: 13,
    }),
    
    CLIENT_INFO: {
      LABEL: {
        fontSize: 6.5,
        color: C.muted,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        margin: "0 0 4px",
      },
      NAME: {
        fontSize: 9,
        fontWeight: "500" as const,
        margin: "0 0 1px",
      },
      CONTACT: {
        fontSize: 8,
        color: C.muted,
        margin: 0,
      },
    },

    METADATA: {
      CONTAINER: {
        width: 145,
      },
      LABEL: {
        fontSize: 6.5,
        color: C.muted,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        margin: "0 0 4px",
      },
      ROW: {
        display: "flex" as const,
        justifyContent: "space-between" as const,
        marginBottom: 3,
        fontSize: 8,
      },
      ROW_LABEL: {
        color: C.muted,
      },
      ROW_VALUE: {
        color: C.black,
      },
    },
  },

  // ─── CONTRACT PARTIES SECTION ───────────────────────────────────
  CONTRACT_PARTIES: {
    CONTAINER: {
      display: "flex" as const,
      justifyContent: "space-between" as const,
      marginBottom: 12,
      paddingBottom: 10,
    },
    PARTY: {
      flex: 1,
      FIRST: {
        paddingRight: 16,
      },
      LABEL: {
        fontSize: 6.5,
        color: C.muted,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        margin: "0 0 3px",
      },
      NAME: {
        fontSize: 9,
        fontWeight: "500" as const,
        margin: 0,
      },
      CONTACT: {
        fontSize: 8,
        color: C.muted,
        margin: "0 0 1px",
      },
      ADDRESS: {
        fontSize: 8,
        color: C.muted,
        margin: 0,
      },
    },
  },

  // ─── RENEWAL CONTENT BOX ───────────────────────────────────
  RENEWAL_BOX: {
    CONTAINER: {
      border: `1px solid ${C.rule}`,
      borderRadius: 2,
      padding: "9px 11px",
      marginBottom: 12,
      background: "#f5f3f0",
    },
    LABEL: {
      fontSize: 6.5,
      color: C.muted,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      margin: "0 0 5px",
    },
    ITEM: {
      fontSize: 8.5,
      margin: "0 0 2px",
    },
    META: {
      fontSize: 7.5,
      color: C.muted,
      margin: "5px 0 0",
    },
  },

  // ─── LINE ITEMS TABLE ───────────────────────────────────
  TABLE: {
    GRID_COLUMNS: "1fr 28px 52px 46px",
    
    CATEGORY_BADGE: {
      CONTAINER: {
        paddingTop: 10,
        paddingBottom: 1,
      },
      TEXT: {
        fontSize: 5.5,
        letterSpacing: "0.14em",
        textTransform: "uppercase" as const,
        color: C.light,
      },
    },

    ROW: {
      CONTAINER: {
        padding: "4px 0",
        display: "grid" as const,
        gridTemplateColumns: "1fr 28px 52px 46px",
        alignItems: "baseline" as const,
      },
      BORDER: {
        borderBottom: `1px solid ${C.rule}`,
      },
      PADDING_TOP: (guardValue?: number) => guardValue || 0,
    },

    CELL: {
      PRODUCT_NAME: {
        fontSize: 8.5,
      },
      NOTE: {
        fontSize: 7,
        color: C.light,
        display: "block" as const,
      },
      SUB_DETAILS: {
        fontSize: 7,
        color: C.muted,
        display: "block" as const,
      },
      QTY: {
        fontSize: 8,
        textAlign: "right" as const,
        color: C.muted,
      },
      UNIT_PRICE: {
        fontSize: 8,
        textAlign: "right" as const,
        color: C.muted,
      },
      TOTAL: {
        fontSize: 8,
        textAlign: "right" as const,
        color: C.black,
      },
    },
  },

  // ─── SUMMARY SECTION ───────────────────────────────────
  SUMMARY: {
    CONTAINER: {
      marginTop: 10,
      paddingTop: 8,
      borderTop: `1px solid ${C.rule}`,
    },
    SECTION_LABEL: {
      fontSize: 7.5,
      color: C.muted,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      margin: "0 0 4px",
    },
    SECTION_TEXT: {
      fontSize: 8.5,
      margin: "0 0 6px",
    },
    TOTAL_LABEL: {
      fontSize: 8,
      color: C.muted,
      margin: "0 0 3px",
    },
    TOTAL_VALUE: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: C.black,
      margin: 0,
    },
  },

  // ─── CLAUSES / TERMS ───────────────────────────────────
  CLAUSES: {
    CONTAINER: {
      marginTop: 12,
    },
    CLAUSE: {
      CONTAINER: {
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `1px solid ${C.rule}`,
      },
      TITLE: {
        fontSize: 8.5,
        fontFamily: SERIF,
        fontWeight: "600" as const,
        margin: "0 0 4px",
      },
      TEXT: {
        fontSize: 8,
        lineHeight: 1.6,
        margin: 0,
        color: C.black,
      },
    },
  },

  // ─── SIGNATURE SECTION ───────────────────────────────────
  SIGNATURE: {
    CONTAINER: {
      marginTop: 16,
      paddingTop: 12,
      borderTop: `1px solid ${C.rule}`,
    },
    GRID: {
      display: "grid" as const,
      gridTemplateColumns: "1fr 1fr",
      gap: 24,
      marginTop: 8,
    },
    PARTY: {
      NAME: {
        fontSize: 8,
        fontWeight: "500" as const,
        margin: "0 0 24px",
      },
      SIGNATURE_LINE: {
        borderTop: `1px solid ${C.black}`,
        height: 0,
        marginTop: 4,
      },
      LABEL: {
        fontSize: 7,
        color: C.muted,
        marginTop: 4,
      },
    },
  },

  // ─── FOOTER SECTION ───────────────────────────────────
  FOOTER: {
    HEADER: {
      padding: "13px 62px 13px",
      display: "flex" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      borderBottom: `1px solid ${C.rule}`,
      background: C.bg,
      zIndex: 3,
    },
    HEADER_TEXT: {
      fontSize: 6,
      letterSpacing: "0.2em",
      color: C.light,
      textTransform: "uppercase" as const,
    },

    BOTTOM_INVOICE: {
      padding: "12px 62px 18px",
      display: "flex" as const,
      alignItems: "flex-start" as const,
      gap: 0,
      borderTop: `1px solid ${C.rule}`,
      background: C.bg,
      zIndex: 3,
    },
    BOTTOM_OTHER: {
      padding: "26px 62px 22px",
      fontSize: 7,
      color: C.muted,
      display: "flex" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      borderTop: `1px solid ${C.rule}`,
      background: C.bg,
      zIndex: 3,
    },

    INFO_COLUMN: {
      fontSize: 7,
      color: C.muted,
      lineHeight: 1.5,
      flex: "1 1 0",
      minWidth: 0,
      overflow: "hidden" as const,
    },
    INFO_LABEL: {
      fontWeight: "500" as const,
      color: C.black,
    },
    INFO_TEXT: {
      color: C.muted,
    },

    PAGE_NUMBER: {
      fontSize: 7,
      color: C.light,
      letterSpacing: "0.04em",
      textAlign: "right" as const,
    },
  },

  // ─── HEADER/FOOTER SPACING ───────────────────────────────────
  PAGE: {
    FADE_HEIGHT: 28,
    FADE_INVOICE_HEIGHT: 64,
    FADE_OTHER_HEIGHT: 59,
  },
};

export default PDF;
