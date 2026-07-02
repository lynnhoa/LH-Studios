// ─────────────────────────────────────────────────────────────
// RATE CARDS — seed data, status list, default settings
// ─────────────────────────────────────────────────────────────

import type { Settings, RateCards, ProjectStatus } from "./types";

// ─── PROJECT STATUS PIPELINE ─────────────────────────────────
export const STATUS: ProjectStatus[] = [
  "lead",
  "quoted",
  "revised",
  "contracted",
  "production",
  "invoiced",
  "paid",
];

// ─── DEFAULT SETTINGS ────────────────────────────────────────
export const SETTINGS_DEFAULT: Settings = {
  name:             "",
  company:          "",
  street:           "",
  plz:              "",
  city:             "",
  country:          "Deutschland",
  email:            "",
  website:          "",
  phone:            "",
  bankName:         "",
  iban:             "",
  bic:              "",
  paypalEmail:      "",
  kleinunternehmer: true,
  steuernummer:     "",
  ustIdNr:          "",
  vatRate:          19,
  taxNote:          "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
};

// ─── SEED CLIENTS ─────────────────────────────────────────────
export const SEED_CLIENTS = [
  {
    id:       "c1",
    name:     "Sephora",
    contact:  "Anna Müller",
    email:    "anna@sephora.de",
    agency:   "Direct",
    country:  "Germany",
    tags:     ["Beauty", "Fashion"],
    notes:    "Easy approvals. Fast payer. Potential retainer.",
    projects: [],
  },
  {
    id:       "c2",
    name:     "Vogue Germany",
    contact:  "Sarah Klein",
    email:    "sarah@vogue.de",
    agency:   "Direct",
    country:  "Germany",
    tags:     ["Editorial", "Fashion"],
    notes:    "Luxury aesthetic. Needs detailed briefs.",
    projects: [],
  },
];

// ─── RATE CARD SEED DATA ─────────────────────────────────────
export const RC0: RateCards = {
  influencer: {
    label: "Content Creator",
    sub:   "Content Creator · Based in Germany",
    sections: [
      {
        t: "01 — Brand Collaboration",
        items: [
          { id: "i1", n: "Photo",                      note: "Feed post",                            p: 200 },
          { id: "i2", n: "Photo Set",                  note: "Carousel · 3–5 images",               p: 300 },
          { id: "i3", n: "Short-form video",           note: "Reels / TikTok / YouTube Shorts",      p: 350 },
          { id: "i4", n: "Short-form video, voiceover",note: "Reels / TikTok / YouTube Shorts",      p: 450 },
          { id: "i5", n: "Story Set",                  note: "3 frames",                             p: 180 },
        ],
      },
      {
        t: "Packages",
        items: [
          { id: "ip1", n: "Starter",      note: "3 short-form videos · instead of € 1,050",              p: 890  },
          { id: "ip2", n: "Full launch",  note: "2 short-form videos + Story set · instead of € 880",    p: 750  },
          { id: "ip3", n: "Campaign",     note: "4 short-form videos + 2 Story sets · instead of € 1,760", p: 1500 },
        ],
      },
      {
        t: "Brand Ambassador",
        items: [
          { id: "iba", n: "Brand Ambassador", note: "6 months · min. 3 pieces/month · 20% off/month", p: null },
        ],
      },
      {
        t: "Usage Rights — added to base rate",
        items: [
          { id: "iu1", n: "Organic social — 3 months",  note: "included", p: null, m: "+0%"   },
          { id: "iu2", n: "Paid ads — 1 month",         note: "",         p: null, m: "+30%"  },
          { id: "iu3", n: "Paid ads — 3 months",        note: "",         p: null, m: "+60%"  },
          { id: "iu4", n: "Paid ads — 6 months",        note: "",         p: null, m: "+100%" },
          { id: "iu5", n: "Paid ads — 12 months",       note: "",         p: null, m: "+150%" },
        ],
      },
      {
        t: "Exclusivity — added to base rate",
        items: [
          { id: "ie1", n: "Category exclusivity — 1 month",  note: "", p: null, m: "+30%"  },
          { id: "ie2", n: "Category exclusivity — 3 months", note: "", p: null, m: "+60%"  },
          { id: "ie3", n: "Full exclusivity — 1 month",      note: "", p: null, m: "+75%"  },
          { id: "ie4", n: "Full exclusivity — 3 months",     note: "", p: null, m: "+125%" },
        ],
      },
      {
        t: "Add-ons",
        items: [
          { id: "ia1", n: "Additional Story frame",      note: "per frame",                    p: 50   },
          { id: "ia2", n: "Link in bio",                 note: "per week",                     p: 100  },
          { id: "ia3", n: "Whitelisting / boosting",     note: "Ads through Lynn's account",   p: null, m: "+30%/mo" },
          { id: "ia4", n: "Rush delivery",               note: "Under 5 business days",        p: null, m: "+25%"    },
          { id: "ia5", n: "Pinned post",                 note: "Post kept pinned",             p: 100  },
          { id: "ia6", n: "Additional revision",         note: "per round · 1 included",       p: 50   },
          { id: "ia7", n: "Aspect ratio adaptation",     note: "per format",                   p: 65   },
          { id: "ia8", n: "Raw footage",                 note: "Unedited files",               p: null, m: "+30%"    },
          { id: "ia9", n: "Kill fee",                    note: "If cancelled after production",p: null, m: "50%"     },
        ],
      },
    ],
    fine:  "All collaborations paid. 1 revision included per deliverable. Product provided by brand, not part of fee. Travel expenses billed separately if applicable.",
    usage: [
      { l: "— Select usage rights —",       pct: 0,   mo: 0,  sentinel: true },
      { l: "Organic — 3 months (included)", pct: 0,   mo: 3  },
      { l: "Organic — 12 months (included)",pct: 0,   mo: 12 },
      { l: "Paid ads — 1 month (+30%)",     pct: 30,  mo: 1  },
      { l: "Paid ads — 3 months (+60%)",    pct: 60,  mo: 3  },
      { l: "Paid ads — 6 months (+100%)",   pct: 100, mo: 6  },
      { l: "Paid ads — 12 months (+150%)",  pct: 150, mo: 12 },
    ],
    excl: [
      { l: "— Select exclusivity —",        pct: 0,   mo: 0, sentinel: true },
      { l: "Category — 1 month (+30%)",     pct: 30,  mo: 1  },
      { l: "Category — 3 months (+60%)",    pct: 60,  mo: 3  },
      { l: "Full — 1 month (+75%)",         pct: 75,  mo: 1  },
      { l: "Full — 3 months (+125%)",       pct: 125, mo: 3  },
    ],
  },

  ugc: {
    label: "UGC Creator",
    sub:   "UGC Creator · Based in Germany",
    sections: [
      {
        t: "01 — Organic Social Media Content",
        items: [
          { id: "u1", n: "Photo",                      note: "Static post",                         p: 200 },
          { id: "u2", n: "UGC Photo Set",              note: "Carousel · 3–5 images",              p: 300 },
          { id: "u3", n: "Short-form video",           note: "Reels / TikTok / YouTube Shorts",     p: 350 },
          { id: "u4", n: "Short-form video, voiceover",note: "Reels / TikTok / YouTube Shorts",     p: 450 },
        ],
      },
      {
        t: "02 — Ad / Campaign Content",
        items: [
          { id: "u5", n: "Campaign video",            note: "9:16 · structured for conversion",    p: 500 },
          { id: "u6", n: "Campaign video, voiceover", note: "9:16 · structured for conversion",    p: 700 },
        ],
      },
      {
        t: "03 — Editorial",
        items: [
          { id: "u7", n: "Short hero video", note: "Up to 15 sec · 9:16 or 16:9",                 p: 800  },
          { id: "u8", n: "Hero video",        note: "Up to 30 sec · cinematic · 9:16 or 16:9",    p: 1200 },
        ],
      },
      {
        t: "Packages",
        items: [
          { id: "up1", n: "Starter",        note: "3 organic social videos · instead of € 1,050",          p: 890  },
          { id: "up2", n: "Growth",         note: "5 organic social videos · instead of € 1,750",          p: 1490 },
          { id: "up3", n: "Campaign",       note: "3 campaign videos · instead of € 1,500",                p: 1280 },
          { id: "up4", n: "Video + Photo Set", note: "3 organic videos + photo set · instead of € 1,550",  p: 1320 },
        ],
      },
      {
        t: "Retainer",
        items: [
          { id: "uvd1", n: "3+ pieces (same deliverable)",  note: "",                                    p: null, m: "−15%"    },
          { id: "uvd2", n: "Retainer — 6 months",           note: "Min. 3 pieces/month · same deliverables", p: null, m: "−20%/mo" },
        ],
      },
      {
        t: "Usage Rights — added to base rate",
        items: [
          { id: "uu1", n: "Organic social — 3 months", note: "included", p: null, m: "+0%"   },
          { id: "uu2", n: "Paid ads — 1 month",        note: "",         p: null, m: "+20%"  },
          { id: "uu3", n: "Paid ads — 3 months",       note: "",         p: null, m: "+50%"  },
          { id: "uu4", n: "Paid ads — 6 months",       note: "",         p: null, m: "+80%"  },
          { id: "uu5", n: "Paid ads — 12 months",      note: "",         p: null, m: "+120%" },
        ],
      },
      {
        t: "Exclusivity — added to base rate",
        items: [
          { id: "ue1", n: "Category exclusivity — 1 month",  note: "", p: null, m: "+25%"  },
          { id: "ue2", n: "Category exclusivity — 3 months", note: "", p: null, m: "+50%"  },
          { id: "ue3", n: "Full exclusivity — 1 month",      note: "", p: null, m: "+50%"  },
          { id: "ue4", n: "Full exclusivity — 3 months",     note: "", p: null, m: "+100%" },
        ],
      },
      {
        t: "Add-ons",
        items: [
          { id: "ua1", n: "Hook / CTA variation",        note: "Additional version of same video", p: 80   },
          { id: "ua2", n: "Whitelisting / boosting",     note: "Ads through Lynn's account",       p: null, m: "+30%/mo" },
          { id: "ua3", n: "Rush delivery",               note: "Under 5 business days",            p: null, m: "+25%"    },
          { id: "ua4", n: "Additional revision",         note: "per round · 1 included",           p: 80   },
          { id: "ua5", n: "Aspect ratio adaptation",     note: "per format",                       p: 65   },
          { id: "ua6", n: "Raw footage",                 note: "Unedited files",                   p: null, m: "+30%"    },
          { id: "ua7", n: "Kill fee",                    note: "If cancelled after production",    p: null, m: "50%"     },
        ],
      },
    ],
    fine:  "Organic usage included for 3 months. Usage rights always time-limited. 1 revision included per deliverable. Product provided by brand, not part of fee. Music license fee not included.",
    usage: [
      { l: "— Select usage rights —",       pct: 0,   mo: 0,  sentinel: true },
      { l: "Organic — 3 months (included)", pct: 0,   mo: 3  },
      { l: "Organic — 12 months (included)",pct: 0,   mo: 12 },
      { l: "Paid ads — 1 month (+20%)",     pct: 20,  mo: 1  },
      { l: "Paid ads — 3 months (+50%)",    pct: 50,  mo: 3  },
      { l: "Paid ads — 6 months (+80%)",    pct: 80,  mo: 6  },
      { l: "Paid ads — 12 months (+120%)",  pct: 120, mo: 12 },
    ],
    excl: [
      { l: "— Select exclusivity —",        pct: 0,   mo: 0, sentinel: true },
      { l: "Category — 1 month (+25%)",     pct: 25,  mo: 1  },
      { l: "Category — 3 months (+50%)",    pct: 50,  mo: 3  },
      { l: "Full — 1 month (+50%)",         pct: 50,  mo: 1  },
      { l: "Full — 3 months (+100%)",       pct: 100, mo: 3  },
    ],
  },

  editorial: {
    label: "Editorial Content Creator",
    sub:   "Editorial Content Creator · Based in Germany",
    sections: [
      {
        t: "Photography",
        items: [
          { id: "e1", n: "1 hero image",       note: "Retouched · full resolution",              p: 400  },
          { id: "e2", n: "Mini set",           note: "3 images · single concept",               p: 900  },
          { id: "e3", n: "Full photo story",   note: "6–10 images · complete visual narrative", p: 1800 },
        ],
      },
      {
        t: "Editorial Video",
        items: [
          { id: "e4", n: "Short hero video",   note: "Up to 15 sec · cinematic",                p: 800  },
          { id: "e5", n: "Hero video",         note: "Up to 30 sec · cinematic",                p: 1200 },
          { id: "e6", n: "Brand film",         note: "60–90 sec · full production",             p: 2500 },
        ],
      },
      {
        t: "Packages",
        items: [
          { id: "ep1", n: "Photo + Video",     note: "1 hero image + short hero video",         p: 1100 },
          { id: "ep2", n: "Full editorial",    note: "Mini set + hero video",                   p: 1900 },
        ],
      },
      {
        t: "Usage Rights — added to base rate",
        items: [
          { id: "eu1", n: "Organic social — 3 months",  note: "included", p: null, m: "+0%"   },
          { id: "eu2", n: "Paid ads — 1 month",         note: "",         p: null, m: "+30%"  },
          { id: "eu3", n: "Paid ads — 3 months",        note: "",         p: null, m: "+60%"  },
          { id: "eu4", n: "Paid ads — 6 months",        note: "",         p: null, m: "+100%" },
          { id: "eu5", n: "Paid ads — 12 months",       note: "",         p: null, m: "+150%" },
        ],
      },
      {
        t: "Exclusivity — added to base rate",
        items: [
          { id: "ee1", n: "Category exclusivity — 1 month",  note: "", p: null, m: "+30%"  },
          { id: "ee2", n: "Category exclusivity — 3 months", note: "", p: null, m: "+60%"  },
          { id: "ee3", n: "Full exclusivity — 1 month",      note: "", p: null, m: "+75%"  },
          { id: "ee4", n: "Full exclusivity — 3 months",     note: "", p: null, m: "+125%" },
        ],
      },
      {
        t: "Add-ons",
        items: [
          { id: "ea1", n: "Additional image",        note: "Same concept and set",              p: 200  },
          { id: "ea2", n: "Additional video cut",    note: "",                                  p: 300  },
          { id: "ea3", n: "Additional location",     note: "Additional venue or setting",       p: 150  },
          { id: "ea4", n: "Rush delivery",           note: "Under 5 business days",            p: null, m: "+25%"    },
          { id: "ea5", n: "Additional revision",     note: "per round · 1 included",           p: 150  },
          { id: "ea6", n: "Raw footage",             note: "Unedited files",                   p: null, m: "+30%"    },
          { id: "ea7", n: "Kill fee",                note: "If cancelled after production",    p: null, m: "50%"     },
        ],
      },
    ],
    fine:  "Product provided by brand, not part of fee. Usage rights always time-limited. 1 revision included per deliverable. Concept approved before production. Min. 2 weeks from brief to delivery.",
    usage: [
      { l: "— Select usage rights —",       pct: 0,   mo: 0,  sentinel: true },
      { l: "Organic — 3 months (included)", pct: 0,   mo: 3  },
      { l: "Organic — 12 months (included)",pct: 0,   mo: 12 },
      { l: "Paid ads — 1 month (+30%)",     pct: 30,  mo: 1  },
      { l: "Paid ads — 3 months (+60%)",    pct: 60,  mo: 3  },
      { l: "Paid ads — 6 months (+100%)",   pct: 100, mo: 6  },
      { l: "Paid ads — 12 months (+150%)",  pct: 150, mo: 12 },
    ],
    excl: [
      { l: "— Select exclusivity —",        pct: 0,   mo: 0, sentinel: true },
      { l: "Category — 1 month (+30%)",     pct: 30,  mo: 1  },
      { l: "Category — 3 months (+60%)",    pct: 60,  mo: 3  },
      { l: "Full — 1 month (+75%)",         pct: 75,  mo: 1  },
      { l: "Full — 3 months (+125%)",       pct: 125, mo: 3  },
    ],
  },

  hotels: {
    label: "Hotels & Hospitality",
    sub:   "Hotels & Hospitality · Based in Germany",
    sections: [
      {
        t: "Content",
        items: [
          { id: "h1", n: "Photo",              note: "Feed post",                      p: 250  },
          { id: "h2", n: "Photo Set",          note: "Carousel · 3–5 images",         p: 400  },
          { id: "h3", n: "Short-form video",   note: "Reels / TikTok",               p: 450  },
          { id: "h4", n: "Story Set",          note: "3 frames",                      p: 200  },
        ],
      },
      {
        t: "Usage Rights — added to base rate",
        items: [
          { id: "hu1", n: "Organic social — 3 months",  note: "included", p: null, m: "+0%"   },
          { id: "hu2", n: "Paid ads — 1 month",         note: "",         p: null, m: "+30%"  },
          { id: "hu3", n: "Paid ads — 3 months",        note: "",         p: null, m: "+60%"  },
          { id: "hu4", n: "Paid ads — 6 months",        note: "",         p: null, m: "+100%" },
          { id: "hu5", n: "Paid ads — 12 months",       note: "",         p: null, m: "+150%" },
        ],
      },
    ],
    fine:  "Scope of hosted collaboration to be agreed per project. All content production invoiced separately. Organic usage included for 3 months. Usage rights always time-limited.",
    usage: [
      { l: "— Select usage rights —",       pct: 0,   mo: 0,  sentinel: true },
      { l: "Organic — 3 months (included)", pct: 0,   mo: 3  },
      { l: "Organic — 12 months (included)",pct: 0,   mo: 12 },
      { l: "Paid ads — 1 month (+30%)",     pct: 30,  mo: 1  },
      { l: "Paid ads — 3 months (+60%)",    pct: 60,  mo: 3  },
      { l: "Paid ads — 6 months (+100%)",   pct: 100, mo: 6  },
      { l: "Paid ads — 12 months (+150%)",  pct: 150, mo: 12 },
    ],
    excl: [
      { l: "— Select exclusivity —",        pct: 0,   mo: 0, sentinel: true },
      { l: "Category — 1 month (+30%)",     pct: 30,  mo: 1  },
      { l: "Category — 3 months (+60%)",    pct: 60,  mo: 3  },
      { l: "Full — 1 month (+75%)",         pct: 75,  mo: 1  },
      { l: "Full — 3 months (+125%)",       pct: 125, mo: 3  },
    ],
  },
} as unknown as RateCards;


// ─── RENEWAL OPTIONS (RenewalModal) — ported from old App.tsx ─
export const RENEWAL_OPTS: Record<string, any[]> = {
  usage: [
    { l: "Organic — 3 months",   mo: 3,  pct: 0   },
    { l: "Organic — 12 months",  mo: 12, pct: 0   },
    { l: "Paid ads — 1 month",   mo: 1,  pct: 30  },
    { l: "Paid ads — 3 months",  mo: 3,  pct: 60  },
    { l: "Paid ads — 6 months",  mo: 6,  pct: 100 },
    { l: "Paid ads — 12 months", mo: 12, pct: 150 },
  ],
  excl: [
    { l: "Category exclusivity — 1 month",  mo: 1, pct: 30  },
    { l: "Category exclusivity — 3 months", mo: 3, pct: 60  },
    { l: "Full exclusivity — 1 month",      mo: 1, pct: 75  },
    { l: "Full exclusivity — 3 months",     mo: 3, pct: 125 },
  ],
};
