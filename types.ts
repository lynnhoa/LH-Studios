// ─────────────────────────────────────────────────────────────
// TYPES — single source of truth for all data shapes
// ─────────────────────────────────────────────────────────────

// ─── ROLES ───────────────────────────────────────────────────
export type Role = "manager" | "creator";

// ─── STATUS ──────────────────────────────────────────────────
export type ProjectStatus =
  | "lead"
  | "quoted"
  | "revised"
  | "contracted"
  | "production"
  | "invoiced"
  | "paid";

export type DeliverableStatus =
  | "Not started"
  | "In progress"
  | "Delivered"
  | "Posted";

export type DocType =
  | "quote"
  | "revised"
  | "contract"
  | "amendment"
  | "invoice"
  | "renewal";

export type CategoryKey =
  | "influencer"
  | "ugc"
  | "editorial"
  | "hotels"
  | string; // custom categories

// ─── SETTINGS / PROFILE ──────────────────────────────────────
export interface Settings {
  name:             string;
  company:          string;
  street:           string;
  plz:              string;
  city:             string;
  country:          string;
  email:            string;
  website:          string;
  phone:            string;
  bankName:         string;
  iban:             string;
  bic:              string;
  paypalEmail:      string;
  kleinunternehmer: boolean;
  steuernummer:     string;
  ustIdNr:          string;
  vatRate:          number;
  taxNote:          string;
}

// ─── RATE CARD ───────────────────────────────────────────────
export interface RateCardItem {
  id:   string;
  n:    string;  // name
  note: string;
  p:    number | null;  // flat price
  m?:   string;         // modifier label e.g. "+30%"
}

export interface RateCardSection {
  t:     string;        // section title
  items: RateCardItem[];
}

export interface UsageOption {
  l:        string;   // label
  pct:      number;   // percentage modifier
  mo:       number;   // months
  sentinel?: boolean; // placeholder option
}

export interface ExclOption {
  l:        string;
  pct:      number;
  mo:       number;
  sentinel?: boolean;
}

export interface RateCard {
  label:    string;
  sub:      string;
  sections: RateCardSection[];
  fine:     string;
  usage:    UsageOption[];
  excl:     ExclOption[];
}

export type RateCards = Record<CategoryKey, RateCard>;

// ─── QUOTE / DOCUMENT ────────────────────────────────────────
export interface AddOn {
  id:    string;
  n:     string;
  note:  string;
  flat?: number;
  pct?:  number;
  amt:   number;
}

export interface LineItem {
  id:          string;
  name:        string;
  note:        string;
  cat:         CategoryKey;
  qty:         number;
  up:          number;   // unit price
  amt:         number;   // total amount
  platforms:   string[];
  usageLabel:  string | undefined;
  exclLabel:   string | undefined;
  addons:      AddOn[];
}

export interface QuoteDoc {
  qNo:        string;
  iNo?:       string;
  rev:        number;
  ctab:       CategoryKey;
  ctype:      string;   // "Content Creator" | "UGC Creator" etc.
  brand:      string;
  contact:    string;
  date:       string;   // ISO date
  validUntil: string;   // ISO date
  delivery?:  string;   // ISO date
  mo:         number;   // usage months
  lines:      LineItem[];
  amendments: Amendment[];
  total:      number;
  retainer:   boolean;
  retMo?:     number;
  footer:     string;
  clauses:    Clause[];
  contractRev?: number;
}

export interface Clause {
  title: string;
  text:  string;
}

// ─── AMENDMENT ───────────────────────────────────────────────
export interface Amendment {
  id:          string;
  aNo:         string;
  lines:       LineItem[];
  amendTotal:  number;
  origTotal:   number;
  signed:      boolean;
  doc:         Partial<QuoteDoc>;
  createdAt?:  string;
}

// ─── RENEWAL ─────────────────────────────────────────────────
// Old-app authoritative shape (produced by RenewalModal, read by
// license trackers via r.endDate). No `type` field — the old app
// treats every renewal as a usage extension; replicate exactly.
export interface Renewal {
  id:         string;
  rNo:        string;               // "RNW-2026-xxx-01"
  optLabel:   string;               // "6 months + 3 months" | "Custom"
  startDate:  string;               // ISO date
  endDate:    string | null;        // ISO date
  fee:        number;
  signed:     boolean;              // saveRenewal sets true
  paid:       boolean;
  doc:        Partial<QuoteDoc>;
  createdAt?: string;
}

// ─── MONTHLY INVOICE (retainer) ──────────────────────────────
// Ordered array on Project, manipulated by index (old-app semantics).
export interface MonthlyInvoice {
  id:       string;
  iNo:      string;                 // "INV-2026-xxx-M01"
  delivery: string;                 // ISO date
  amount:   number;
  paid:     boolean;
  doc:      Partial<QuoteDoc>;
}

// ─── DELIVERABLE ─────────────────────────────────────────────
export interface Deliverable {
  id:             string;
  projectId:      string;
  lineRef:        string;
  name:           string;
  category:       CategoryKey;
  quantity:       number;
  quantityIndex:  number;
  status:         DeliverableStatus;
  statusDate:     string | null;
  deliveredDate:  string | null;
  createdAt?:     string;
}

// ─── WORKSPACE ───────────────────────────────────────────────
// Per-deliverable status map: key = `${projectId}_ln${lineIndex}_q${qtyIndex}`
export type WorkspaceStatus = Record<string, DeliverableStatus>;
export type WorkspaceStatusHistory = Record<string, { status: string; date: string }[]>;

// ─── PROJECT ─────────────────────────────────────────────────
export interface Project {
  id:                     string;
  clientId:               string;
  name:                   string;
  status:                 ProjectStatus;
  amount:                 number;
  paid:                   boolean;
  date:                   string;   // ISO date
  deliveryDate:           string;
  usageEndOverride:       string | null;
  notes:                  string;
  qd:                     QuoteDoc | null;
  amendments:             Amendment[];
  renewals:               Renewal[];
  monthlyInvoices:        MonthlyInvoice[];
  workspaceStatus:        WorkspaceStatus;
  workspaceStatusHistory: WorkspaceStatusHistory;
  workspaceNames:         Record<string, string>;
  workspaceNotes:         Record<string, string>;
  workspaceDeleted:       string[];
  workspacePlanner:       Record<string, string>;
  managerStatus:          Record<string, any>;
  createdAt?:             string;
}

// ─── CLIENT ──────────────────────────────────────────────────
export interface Client {
  id:        string;
  name:      string;
  contact:   string;
  email:     string;
  agency:    string;
  country:   string;
  tags:      string[];
  notes:     string;
  projects:  Project[];
  createdAt?: string;
}

// ─── CALCULATOR PREFILL ──────────────────────────────────────
export interface CalcPrefill {
  brand:      string;
  contact:    string;
  qNo?:       string;
  pid?:       string;
  cid?:       string;
  isRev?:     boolean;
  revN?:      number;
  isAmend?:   boolean;
  amendN?:    number;
  ctab?:      CategoryKey;
  lines?:     any[];
  origLines?: LineItem[];
}

// ─── DASHBOARD DRILL ─────────────────────────────────────────
export type DashDrill =
  | "revenue"
  | "month"
  | "license"
  | "projects"
  | "invoices"
  | "quotes"
  | "contracts"
  | "output"
  | null;

// ─── PDF MODAL ───────────────────────────────────────────────
export interface PDFModalProps {
  data:     Partial<QuoteDoc>;
  type:     DocType;
  onClose:  () => void;
  onSave?:  (doc: QuoteDoc) => void;
  onSaveClose?: (doc: QuoteDoc) => void;
  settings: Settings;
  isNew?:   boolean;
}
