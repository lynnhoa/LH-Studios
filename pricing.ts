// ─────────────────────────────────────────────────────────────
// PRICING — rates, rules, add-ons, usage/exclusivity tables
// No UI. No side effects. Import anywhere.
// ─────────────────────────────────────────────────────────────

import type { UsageOption, ExclOption } from "./types";

// ─── USAGE RIGHTS — per category ─────────────────────────────
export const USAGE_INFLUENCER: UsageOption[] = [
  { l: "— Select usage rights —",        pct: 0,   mo: 0,  sentinel: true },
  { l: "Organic — 3 months (included)",   pct: 0,   mo: 3  },
  { l: "Organic — 12 months (included)",  pct: 0,   mo: 12 },
  { l: "Paid ads — 1 month (+30%)",       pct: 30,  mo: 1  },
  { l: "Paid ads — 3 months (+60%)",      pct: 60,  mo: 3  },
  { l: "Paid ads — 6 months (+100%)",     pct: 100, mo: 6  },
  { l: "Paid ads — 12 months (+150%)",    pct: 150, mo: 12 },
];

export const USAGE_UGC: UsageOption[] = [
  { l: "— Select usage rights —",        pct: 0,   mo: 0,  sentinel: true },
  { l: "Organic — 3 months (included)",   pct: 0,   mo: 3  },
  { l: "Organic — 12 months (included)",  pct: 0,   mo: 12 },
  { l: "Paid ads — 1 month (+20%)",       pct: 20,  mo: 1  },
  { l: "Paid ads — 3 months (+50%)",      pct: 50,  mo: 3  },
  { l: "Paid ads — 6 months (+80%)",      pct: 80,  mo: 6  },
  { l: "Paid ads — 12 months (+120%)",    pct: 120, mo: 12 },
];

export const USAGE_EDITORIAL: UsageOption[] = [
  { l: "— Select usage rights —",        pct: 0,   mo: 0,  sentinel: true },
  { l: "Organic — 3 months (included)",   pct: 0,   mo: 3  },
  { l: "Organic — 12 months (included)",  pct: 0,   mo: 12 },
  { l: "Paid ads — 1 month (+30%)",       pct: 30,  mo: 1  },
  { l: "Paid ads — 3 months (+60%)",      pct: 60,  mo: 3  },
  { l: "Paid ads — 6 months (+100%)",     pct: 100, mo: 6  },
  { l: "Paid ads — 12 months (+150%)",    pct: 150, mo: 12 },
];

export const USAGE_BY_CAT: Record<string, UsageOption[]> = {
  influencer: USAGE_INFLUENCER,
  ugc:        USAGE_UGC,
  editorial:  USAGE_EDITORIAL,
  hotels:     USAGE_INFLUENCER,
};

// ─── EXCLUSIVITY — per category ───────────────────────────────
export const EXCL_INFLUENCER: ExclOption[] = [
  { l: "— Select exclusivity —",             pct: 0,   mo: 0, sentinel: true },
  { l: "Category — 1 month (+30%)",          pct: 30,  mo: 1  },
  { l: "Category — 3 months (+60%)",         pct: 60,  mo: 3  },
  { l: "Full — 1 month (+75%)",              pct: 75,  mo: 1  },
  { l: "Full — 3 months (+125%)",            pct: 125, mo: 3  },
];

export const EXCL_UGC: ExclOption[] = [
  { l: "— Select exclusivity —",             pct: 0,   mo: 0, sentinel: true },
  { l: "Category — 1 month (+25%)",          pct: 25,  mo: 1  },
  { l: "Category — 3 months (+50%)",         pct: 50,  mo: 3  },
  { l: "Full — 1 month (+50%)",              pct: 50,  mo: 1  },
  { l: "Full — 3 months (+100%)",            pct: 100, mo: 3  },
];

export const EXCL_EDITORIAL: ExclOption[] = [
  { l: "— Select exclusivity —",             pct: 0,   mo: 0, sentinel: true },
  { l: "Category — 1 month (+30%)",          pct: 30,  mo: 1  },
  { l: "Category — 3 months (+60%)",         pct: 60,  mo: 3  },
  { l: "Full — 1 month (+75%)",              pct: 75,  mo: 1  },
  { l: "Full — 3 months (+125%)",            pct: 125, mo: 3  },
];

export const EXCL_BY_CAT: Record<string, ExclOption[]> = {
  influencer: EXCL_INFLUENCER,
  ugc:        EXCL_UGC,
  editorial:  EXCL_EDITORIAL,
  hotels:     EXCL_INFLUENCER,
};

// ─── ADD-ONS — shared pool, all categories ────────────────────
export const AO_SHARED = [
  { id: "ao1",  n: "Additional Story frame",               note: "per frame",                         flat: 50  },
  { id: "ao2",  n: "Link in bio",                          note: "per week",                          flat: 100 },
  { id: "ao3",  n: "Whitelisting / boosting",              note: "Ads through Lynn's account",        pct:  30  },
  { id: "ao4",  n: "Rush delivery",                        note: "Under 5 business days",             pct:  25  },
  { id: "ao5",  n: "Pinned post",                          note: "Post kept pinned",                  flat: 100 },
  { id: "ao6a", n: "Brand Collaboration — Additional revision", note: "per round · 1 included",      flat: 50  },
  { id: "ao6b", n: "UGC — Additional revision",            note: "per round · 1 included",           flat: 80  },
  { id: "ao6c", n: "Editorial — Additional revision",      note: "per round · 1 included",           flat: 150 },
  { id: "ao7",  n: "Aspect ratio adaptation",              note: "per format",                        flat: 65  },
  { id: "ao8",  n: "Raw footage",                          note: "Unedited files",                    pct:  30  },
  { id: "ao9",  n: "Kill fee",                             note: "If cancelled after production",     pct:  50  },
  { id: "ao10", n: "Hook / CTA variation",                 note: "Additional version of same video",  flat: 80  },
  { id: "ao11", n: "Additional image",                     note: "Same concept and set",              flat: 200 },
  { id: "ao12", n: "Additional video cut",                 note: "",                                  flat: 300 },
  { id: "ao13", n: "Additional location",                  note: "Additional venue or setting",       flat: 150 },
];

// ─── DISCOUNT RULES ───────────────────────────────────────────
export const DISCOUNT_RULES = {
  volUgcInfluencer3:  15, // 3+ pieces same deliverable → 15% off
  volUgcInfluencer10: 20, // 10+ pieces → 20% off
  editorialPackage:   10, // any package → 10% off
  retainer:           20, // monthly retainer → 20% off per month
};

// ─── RENEWAL OPTIONS ─────────────────────────────────────────
export const RENEWAL_OPTS: Record<string, any[]> = {
  usage: [
    { l: "Organic — 3 months",       mo: 3,  pct: 0   },
    { l: "Organic — 12 months",      mo: 12, pct: 0   },
    { l: "Paid ads — 1 month",       mo: 1,  pct: 30  },
    { l: "Paid ads — 3 months",      mo: 3,  pct: 60  },
    { l: "Paid ads — 6 months",      mo: 6,  pct: 100 },
    { l: "Paid ads — 12 months",     mo: 12, pct: 150 },
  ],
  excl: [
    { l: "Category exclusivity — 1 month",  mo: 1,  pct: 30  },
    { l: "Category exclusivity — 3 months", mo: 3,  pct: 60  },
    { l: "Full exclusivity — 1 month",      mo: 1,  pct: 75  },
    { l: "Full exclusivity — 3 months",     mo: 3,  pct: 125 },
  ],
};

// ─── PRICE COMPUTATION ────────────────────────────────────────
interface ComputeInput {
  baseAmt:     number;
  usagePct:    number;
  exclPct:     number;
  addons:      { flat?: number; pct?: number }[];
  qty:         number;
}

export const computePrice = ({
  baseAmt,
  usagePct,
  exclPct,
  addons,
  qty,
}: ComputeInput): number => {
  const base   = baseAmt * qty;
  const usage  = Math.round(base * (usagePct / 100));
  const excl   = Math.round(base * (exclPct  / 100));
  const aoAmt  = addons.reduce((sum, ao) => {
    if (ao.flat) return sum + ao.flat;
    if (ao.pct)  return sum + Math.round(base * (ao.pct / 100));
    return sum;
  }, 0);
  return base + usage + excl + aoAmt;
};
