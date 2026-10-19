// ─────────────────────────────────────────────────────────────
// useClients — clients + all child tables CRUD
// clients → projects → amendments + renewals + deliverables
// All data fetched once, kept in local state, synced to Supabase.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./useSupabase";
import { uid, today, monthStart, monthEnd, r2 } from "./formatters";
import { registerReloader } from "./saveStatus";
import {
  quoteNo, contractNo, amendNo, invoiceNo, projectNoFrom, pnoFromQNo, yearOf,
  docMoney, docNet, linesSum, senderSnapshot, clientSnapshot, profileGaps, dueFrom,
  currentQuote, currentContract, projectInvoice, monthlyInvoices, nextRetainerMonth,
} from "./docs";
import type {
  Client, Project, Amendment, Renewal, MonthlyInvoice,
  Deliverable, QuoteDoc, ProjectStatus, DocRecord,
} from "./types";

interface UseClientsReturn {
  clients:      Client[];
  loading:      boolean;
  error:        string | null;
  loadError:    string | null;      // data could not be loaded (shown with Retry)
  reload:       () => Promise<void>;
  markAmendmentSigned:    (clientId: string, projectId: string, docId: string, date: string, settings: any) => Promise<DocRecord>;
  createAmendmentInvoice: (clientId: string, projectId: string, amendId: string, settings: any) => Promise<DocRecord>;
  removeProject:          (clientId: string, projectId: string) => Promise<void>;
  setLicenseAction:       (clientId: string, projectId: string, key: string, action: string | null) => Promise<void>;
  patchWs:                (clientId: string, projectId: string, field: string, patch: Record<string, any>) => Promise<void>;
  setWsStatus:            (clientId: string, projectId: string, changes: { id: string; status: string }[], by?: string) => Promise<void>;
  revertWsStatus:         (clientId: string, projectId: string, ids: string[]) => Promise<void>;

  // Client ops
  addClient:    (c: Omit<Client, "id" | "projects" | "createdAt">) => Promise<string | null>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<string | null>;
  deleteClient: (id: string) => Promise<string | null>;

  // Project ops
  addProject:    (clientId: string, p: Omit<Project, "id" | "createdAt">) => Promise<string | null>;
  updateProject: (clientId: string, projectId: string, updates: Partial<Project>) => Promise<string | null>;
  deleteProject: (clientId: string, projectId: string) => Promise<string | null>;
  setProjectStatus: (clientId: string, projectId: string, status: ProjectStatus) => Promise<string | null>;

  // Amendment ops
  addAmendment:    (clientId: string, projectId: string, a: Omit<Amendment, "id" | "createdAt">) => Promise<string | null>;
  updateAmendment: (clientId: string, projectId: string, amendId: string, updates: Partial<Amendment>) => Promise<string | null>;
  deleteAmendment: (clientId: string, projectId: string, amendId: string) => Promise<string | null>;

  // Renewal ops
  addRenewal:    (clientId: string, projectId: string, r: Omit<Renewal, "id" | "createdAt">) => Promise<string | null>;
  updateRenewal: (clientId: string, projectId: string, renewalId: string, updates: Partial<Renewal>) => Promise<string | null>;
  deleteRenewal: (clientId: string, projectId: string, renewalId: string) => Promise<string | null>;

  // Deliverable ops
  updateDeliverable: (projectId: string, deliverableId: string, updates: Partial<Deliverable>) => Promise<string | null>;
  upsertDeliverables: (projectId: string, deliverables: Omit<Deliverable, "createdAt">[]) => Promise<string | null>;

  // Calculator save (new quote / revision / amendment) → creates the document
  saveQuote: (args: SaveQuoteArgs) => Promise<SaveResult>;

  // Documents (frozen rows in `documents`) — all throw an Error on failure
  updateDocument:     (clientId: string, projectId: string, docId: string, patch: Partial<DocRecord>, settings: any) => Promise<DocRecord>;
  deleteDraftDocument:(clientId: string, projectId: string, docId: string) => Promise<void>;
  markDocSent:        (clientId: string, projectId: string, docId: string, settings: any) => Promise<DocRecord>;
  createContract:     (clientId: string, projectId: string, settings: any) => Promise<DocRecord>;
  reviseContract:     (clientId: string, projectId: string, settings: any) => Promise<DocRecord>;
  markContractSigned: (clientId: string, projectId: string, docId: string, date: string, settings: any) => Promise<DocRecord>;
  undoContract:       (clientId: string, projectId: string) => Promise<void>;
  createProjectInvoice:(clientId: string, projectId: string, settings: any) => Promise<DocRecord>;
  createMonthlyInvoice:(clientId: string, projectId: string, settings: any) => Promise<DocRecord>;
  finalizeInvoice:    (clientId: string, projectId: string, docId: string, settings: any) => Promise<DocRecord>;
  markInvoicePaid:    (clientId: string, projectId: string, docId: string, date: string) => Promise<DocRecord>;
  markInvoiceUnpaid:  (clientId: string, projectId: string, docId: string) => Promise<DocRecord>;
  cancelInvoice:      (clientId: string, projectId: string, docId: string, settings: any) => Promise<DocRecord | null>;
  addRenewalWithInvoice: (clientId: string, projectId: string, r: Omit<Renewal, "id" | "createdAt">, doc: any, settings: any) => Promise<DocRecord>;
  addAmendmentWithDoc:   (clientId: string, projectId: string, a: Omit<Amendment, "id" | "createdAt">, doc: any, settings: any) => Promise<DocRecord>;
  removeAmendment:    (clientId: string, projectId: string, amendId: string) => Promise<void>;
  removeRenewal:      (clientId: string, projectId: string, renewalId: string) => Promise<void>;
}

export interface SaveQuoteArgs {
  doc:          any;          // quote / amendment content from the Calculator preview (incl. docDate, data)
  brand:        string;
  contact:      string;
  mode:         "new" | "revise" | "amend";
  projectName?: string;
  projectId?:   string;
  clientId?:    string;
  settings:     any;
}
export interface SaveResult { error: string | null; projectId?: string; clientId?: string; document?: DocRecord; }

// ─────────────────────────────────────────────────────────────
// DB ROW MAPPERS
// ─────────────────────────────────────────────────────────────

function rowToClient(row: any, projects: Project[]): Client {
  return {
    id:        row.id,
    name:      row.name       ?? "",
    contact:   row.contact    ?? "",
    email:     row.email      ?? "",
    agency:    row.agency     ?? "Direct",
    street:    row.street     ?? "",
    plz:       row.plz        ?? "",
    city:      row.city       ?? "",
    country:   row.country    ?? "Germany",
    vatId:     row.vat_id     ?? "",
    tags:      row.tags       ?? [],
    notes:     row.notes      ?? "",
    projects,
    createdAt: row.created_at,
  };
}

// camelCase client fields → DB columns
function clientToRow(c: Partial<Client>): Record<string, any> {
  const row: Record<string, any> = {};
  const map: Record<string, string> = {
    name: "name", contact: "contact", email: "email", agency: "agency", street: "street",
    plz: "plz", city: "city", country: "country", vatId: "vat_id", tags: "tags", notes: "notes",
  };
  Object.entries(map).forEach(([k, col]) => { if ((c as any)[k] !== undefined) row[col] = (c as any)[k]; });
  return row;
}

function rowToDoc(row: any): DocRecord {
  return {
    id:          row.id,
    projectId:   row.project_id,
    kind:        row.kind,
    subtype:     row.subtype ?? "",
    docNo:       row.doc_no ?? "",
    revision:    Number(row.revision) || 0,
    status:      row.status ?? "draft",
    docDate:     row.doc_date ?? today(),
    dueDate:     row.due_date ?? null,
    periodStart: row.period_start ?? null,
    periodEnd:   row.period_end ?? null,
    sentAt:      row.sent_at ?? null,
    signedAt:    row.signed_at ?? null,
    paidAt:      row.paid_at ?? null,
    net:         Number(row.net) || 0,
    vatRate:     Number(row.vat_rate) || 0,
    vat:         Number(row.vat) || 0,
    gross:       Number(row.gross) || 0,
    lang:        row.lang === "de" ? "de" : "en",
    data:        row.data ?? {},
    amendmentId: row.amendment_id ?? null,
    renewalId:   row.renewal_id ?? null,
    monthNo:     row.month_no ?? null,
    cancelsId:   row.cancels_id ?? null,
    createdAt:   row.created_at,
  };
}

function docToRow(d: Partial<DocRecord>): Record<string, any> {
  const row: Record<string, any> = {};
  const map: Record<string, string> = {
    kind: "kind", subtype: "subtype", docNo: "doc_no", revision: "revision", status: "status",
    docDate: "doc_date", dueDate: "due_date", periodStart: "period_start", periodEnd: "period_end",
    sentAt: "sent_at", signedAt: "signed_at", paidAt: "paid_at", net: "net", vatRate: "vat_rate",
    vat: "vat", gross: "gross", lang: "lang", data: "data", amendmentId: "amendment_id",
    renewalId: "renewal_id", monthNo: "month_no", cancelsId: "cancels_id",
  };
  Object.entries(map).forEach(([k, col]) => {
    const v = (d as any)[k];
    if (v === undefined) return;
    row[col] = (v === "" && /date|_at$|period/.test(col)) ? null : v;
  });
  return row;
}

function rowToProject(
  row: any,
  amendments: Amendment[],
  renewals: Renewal[],
  deliverables: Deliverable[],
  documents: DocRecord[] = [],
): Project {
  // Workspace state lives in JSONB columns on projects (old-app parity).
  // Fallback: derive from legacy deliverables rows if the columns are empty.
  let ws: Record<string, any>     = row.workspace_status         ?? {};
  let wsh: Record<string, any[]>  = row.workspace_status_history ?? {};
  if (Object.keys(ws).length === 0 && deliverables.length > 0) {
    ws = {}; wsh = {};
    for (const d of deliverables) {
      const key = `${row.id}_ln${d.lineRef}_q${d.quantityIndex}`;
      ws[key]  = d.status;
      wsh[key] = [{ status: d.status, date: d.statusDate ?? today() }];
    }
  }
  return {
    id:                     row.id,
    clientId:               row.client_id,
    projectNo:              row.project_no ?? pnoFromQNo(row.quote_doc?.qNo),
    name:                   row.name           ?? "",
    status:                 row.status         ?? "lead",
    amount:                 row.amount         ?? 0,
    paid:                   row.paid           ?? false,
    date:                   row.date           ?? today(),
    deliveryDate:           row.delivery_date  ?? "",
    usageEndOverride:       row.usage_end_override ?? null,
    notes:                  row.notes          ?? "",
    qd:                     row.quote_doc      ?? null,
    amendments,
    renewals,
    monthlyInvoices:        row.monthly_invoices ?? [],
    workspaceStatus:        ws,
    workspaceStatusHistory: wsh,
    workspaceNames:         row.workspace_names   ?? {},
    workspaceNotes:         row.workspace_notes   ?? {},
    workspaceDeleted:       row.workspace_deleted ?? [],
    workspacePlanner:       row.workspace_planner ?? {},
    workspaceCats:          row.workspace_cats    ?? {},
    managerStatus:          row.manager_status    ?? {},
    documents,
    statusHistory:          Array.isArray(row.status_history) ? row.status_history : [],
    licenseState:           row.license_state && typeof row.license_state === "object" ? row.license_state : {},
    createdAt:              row.created_at,
  };
}

function rowToAmendment(row: any): Amendment {
  return {
    id:          row.id,
    aNo:         row.a_no         ?? "",
    lines:       row.lines        ?? [],
    amendTotal:  row.amend_total  ?? 0,
    origTotal:   row.orig_total   ?? 0,
    signed:      row.signed       ?? false,
    signedAt:    row.signed_at    ?? null,
    invoiceDocId: row.invoice_doc_id ?? null,
    doc:         row.doc          ?? {},
    createdAt:   row.created_at,
  };
}

function rowToRenewal(row: any): Renewal {
  return {
    id:        row.id,
    rNo:       row.r_no       ?? "",
    optLabel:  row.opt_label  ?? "",
    startDate: row.start_date ?? "",
    // fallback to legacy usage_end for rows created before Phase 0 migration
    endDate:   row.end_date   ?? row.usage_end ?? null,
    usageEnd:  row.usage_end  ?? null,
    exclEnd:   row.excl_end   ?? null,
    fee:       row.fee        ?? row.total_fee ?? 0,
    signed:    row.signed     ?? true,
    paid:      row.paid       ?? false,
    doc:       row.doc        ?? {},
    createdAt: row.created_at,
  };
}

function rowToDeliverable(row: any): Deliverable {
  return {
    id:             row.id,
    projectId:      row.project_id,
    lineRef:        row.line_ref       ?? "",
    name:           row.name           ?? "",
    category:       row.category       ?? "influencer",
    quantity:       row.quantity       ?? 1,
    quantityIndex:  row.quantity_index ?? 0,
    status:         row.status         ?? "Not started",
    statusDate:     row.status_date    ?? null,
    deliveredDate:  row.delivered_date ?? null,
    createdAt:      row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useClients(userId: string | null): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Ref always points to latest clients — used inside saveQuote
  // so the brand-matching lookup never uses a stale closure.
  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  // Update the list AND the ref immediately, so an action that follows right
  // after (save → mark sent → PDF) already sees the new document.
  const setClientsNow = (next: Client[] | ((prev: Client[]) => Client[])) => {
    const value = typeof next === "function" ? (next as (p: Client[]) => Client[])(clientsRef.current) : next;
    clientsRef.current = value;
    setClients(value);
  };

  // ── Full fetch ────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!userId) { setClientsNow([]); setLoading(false); return; }

    setLoading(true);

    const results = await Promise.all([
      supabase.from("clients")     .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("projects")    .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("amendments")  .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("renewals")    .select("*").eq("user_id", userId).order("created_at"),
      Promise.resolve({ data: [], error: null }),   // old deliverables table: no longer used
      supabase.from("documents")   .select("*").eq("user_id", userId).order("created_at"),
    ]);

    const cRows = results[0]?.data;
    const pRows = results[1]?.data;
    const aRows = results[2]?.data;
    const rRows = results[3]?.data;
    const dRows = results[4]?.data;
    const docRows = results[5]?.data;

    const err = results[0]?.error || results[1]?.error || results[2]?.error || results[3]?.error || results[4]?.error || results[5]?.error;
    if (err) { setError(err.message); setLoadError(err.message); setLoading(false); return; }
    setLoadError(null);

    // Assemble tree: clients → projects → amendments / renewals / deliverables
    const amendments:   Record<string, Amendment[]>   = {};
    const renewals:     Record<string, Renewal[]>     = {};
    const deliverables: Record<string, Deliverable[]> = {};
    const documents:    Record<string, DocRecord[]>   = {};

    for (const row of aRows ?? []) {
      const a = rowToAmendment(row);
      if (!amendments[row.project_id]) amendments[row.project_id] = [];
      amendments[row.project_id].push(a);
    }
    for (const row of rRows ?? []) {
      const r = rowToRenewal(row);
      if (!renewals[row.project_id]) renewals[row.project_id] = [];
      renewals[row.project_id].push(r);
    }
    for (const row of dRows ?? []) {
      const d = rowToDeliverable(row);
      if (!deliverables[row.project_id]) deliverables[row.project_id] = [];
      deliverables[row.project_id].push(d);
    }
    for (const row of docRows ?? []) {
      if (!documents[row.project_id]) documents[row.project_id] = [];
      documents[row.project_id].push(rowToDoc(row));
    }

    const projectsByClient: Record<string, Project[]> = {};
    for (const row of pRows ?? []) {
      const p = rowToProject(
        row,
        amendments[row.id]   ?? [],
        renewals[row.id]     ?? [],
        deliverables[row.id] ?? [],
        documents[row.id]    ?? [],
      );
      if (!projectsByClient[row.client_id]) projectsByClient[row.client_id] = [];
      projectsByClient[row.client_id].push(p);
    }

    const built: Client[] = (cRows ?? []).map(row =>
      rowToClient(row, projectsByClient[row.id] ?? [])
    );

    setClientsNow(built);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // After a failed save (or when the app comes back) reload what is really stored
  useEffect(() => registerReloader(() => { fetchAll(); }), [fetchAll]);

  // ─── LOCAL STATE HELPERS ─────────────────────────────────
  const updateClientLocal = (id: string, fn: (c: Client) => Client) =>
    setClientsNow(prev => prev.map(c => c.id === id ? fn(c) : c));

  const updateProjectLocal = (
    clientId: string,
    projectId: string,
    fn: (p: Project) => Project
  ) =>
    updateClientLocal(clientId, c => ({
      ...c,
      projects: c.projects.map(p => p.id === projectId ? fn(p) : p),
    }));

  // ─── CLIENT OPS ──────────────────────────────────────────
  const addClient = useCallback(
    async (c: Omit<Client, "id" | "projects" | "createdAt">): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      const id = uid();
      const row = { id, user_id: userId, ...clientToRow(c) };

      // Old-app addCl appends new clients to the end of the list
      setClientsNow(prev => [...prev, { street: "", plz: "", city: "", vatId: "", ...c, id, projects: [] } as Client]);

      const { error } = await supabase.from("clients").insert(row);
      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const updateClient = useCallback(
    async (id: string, updates: Partial<Client>): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      const { projects: _, createdAt: __, id: ___, ...rest } = updates as any;
      updateClientLocal(id, c => ({ ...c, ...rest }));

      const { error } = await supabase
        .from("clients")
        .update({ ...clientToRow(rest), updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      setClientsNow(prev => prev.filter(c => c.id !== id));

      const { error } = await supabase
        .from("clients").delete().eq("id", id).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  // ─── PROJECT OPS ─────────────────────────────────────────
  const addProject = useCallback(
    async (
      clientId: string,
      p: Omit<Project, "id" | "createdAt">
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      const id = uid();
      const newProject: Project = { documents: [], ...p, projectNo: p.projectNo ?? null, id, createdAt: new Date().toISOString() } as Project;

      updateClientLocal(clientId, c => ({
        ...c,
        projects: [newProject, ...c.projects],
      }));

      const { error } = await supabase.from("projects").insert({
        id,
        user_id:      userId,
        client_id:    clientId,
        project_no:   p.projectNo || null,
        name:         p.name,
        status:       p.status,
        amount:       p.amount,
        paid:         p.paid,
        date:         p.date,
        delivery_date: p.deliveryDate || null,
        usage_end_override: p.usageEndOverride || null,
        notes:        p.notes,
        quote_doc:    p.qd,
        created_at:   new Date().toISOString(),
      });

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const updateProject = useCallback(
    async (
      clientId: string,
      projectId: string,
      updates: Partial<Project>
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      // every status change is recorded with its date (used for "since" counters)
      const before = clientsRef.current.find(c => c.id === clientId)?.projects.find(p => p.id === projectId);
      if (before && updates.status !== undefined && updates.status !== before.status && updates.statusHistory === undefined) {
        updates = { ...updates, statusHistory: [...(before.statusHistory || []), { status: updates.status, at: today() }] };
      }
      updateProjectLocal(clientId, projectId, p => ({ ...p, ...updates }));

      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.statusHistory   !== undefined) dbUpdates.status_history    = updates.statusHistory;
      if (updates.licenseState    !== undefined) dbUpdates.license_state     = updates.licenseState;
      if (updates.projectNo       !== undefined) dbUpdates.project_no        = updates.projectNo;
      if (updates.name            !== undefined) dbUpdates.name              = updates.name;
      if (updates.status          !== undefined) dbUpdates.status            = updates.status;
      if (updates.amount          !== undefined) dbUpdates.amount            = updates.amount;
      if (updates.paid            !== undefined) dbUpdates.paid              = updates.paid;
      if (updates.date            !== undefined) dbUpdates.date              = updates.date;
      if (updates.deliveryDate    !== undefined) dbUpdates.delivery_date     = updates.deliveryDate || null;
      if (updates.usageEndOverride!== undefined) dbUpdates.usage_end_override= updates.usageEndOverride || null;
      if (updates.notes           !== undefined) dbUpdates.notes             = updates.notes;
      if (updates.qd              !== undefined) dbUpdates.quote_doc         = updates.qd;
      if (updates.monthlyInvoices !== undefined) dbUpdates.monthly_invoices  = updates.monthlyInvoices;
      if (updates.workspaceStatus        !== undefined) dbUpdates.workspace_status         = updates.workspaceStatus;
      if (updates.workspaceStatusHistory !== undefined) dbUpdates.workspace_status_history = updates.workspaceStatusHistory;
      if (updates.workspaceNames         !== undefined) dbUpdates.workspace_names          = updates.workspaceNames;
      if (updates.workspaceNotes         !== undefined) dbUpdates.workspace_notes          = updates.workspaceNotes;
      if (updates.workspaceDeleted       !== undefined) dbUpdates.workspace_deleted        = updates.workspaceDeleted;
      if (updates.workspacePlanner       !== undefined) dbUpdates.workspace_planner        = updates.workspacePlanner;
      if (updates.managerStatus          !== undefined) dbUpdates.manager_status           = updates.managerStatus;

      const { error } = await supabase
        .from("projects")
        .update(dbUpdates)
        .eq("id", projectId).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const deleteProject = useCallback(
    async (clientId: string, projectId: string): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      updateClientLocal(clientId, c => ({
        ...c,
        projects: c.projects.filter(p => p.id !== projectId),
      }));

      const { error } = await supabase
        .from("projects").delete().eq("id", projectId).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const setProjectStatus = useCallback(
    async (clientId: string, projectId: string, status: ProjectStatus): Promise<string | null> =>
      updateProject(clientId, projectId, { status, paid: status === "paid" }),
    [updateProject]
  );

  // ─── AMENDMENT OPS ───────────────────────────────────────
  const addAmendment = useCallback(
    async (
      clientId: string,
      projectId: string,
      a: Omit<Amendment, "id" | "createdAt">
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      const id = uid();
      const newA: Amendment = { ...a, id };

      // Compute the new project total so we can persist it to projects.amount
      const projNow = clientsRef.current.find(c => c.id === clientId)?.projects.find(p => p.id === projectId);
      const newAmount = (projNow?.amount ?? 0) + a.amendTotal;

      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        amendments: [...p.amendments, newA],
        amount: p.amount + a.amendTotal,
      }));

      const { error } = await supabase.from("amendments").insert({
        id, user_id: userId, project_id: projectId,
        a_no: a.aNo, lines: a.lines, amend_total: a.amendTotal,
        orig_total: a.origTotal, signed: a.signed, doc: a.doc,
      });
      if (error) { setError(error.message); return error.message; }

      // Persist the bumped project total (old app kept amount in sync)
      const { error: amtErr } = await supabase.from("projects")
        .update({ amount: newAmount, updated_at: new Date().toISOString() })
        .eq("id", projectId).eq("user_id", userId);
      if (amtErr) { setError(amtErr.message); return amtErr.message; }
      return null;
    },
    [userId]
  );

  const updateAmendment = useCallback(
    async (
      clientId: string,
      projectId: string,
      amendId: string,
      updates: Partial<Amendment>
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        amendments: p.amendments.map(a => a.id === amendId ? { ...a, ...updates } : a),
      }));

      const dbUpdates: Record<string, any> = {};
      if (updates.signed !== undefined) dbUpdates.signed = updates.signed;
      if (updates.doc    !== undefined) dbUpdates.doc    = updates.doc;

      const { error } = await supabase
        .from("amendments").update(dbUpdates).eq("id", amendId).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  // Undo an amendment — remove the record and roll its amendTotal back off the project total.
  const deleteAmendment = useCallback(
    async (clientId: string, projectId: string, amendId: string): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      const projNow = clientsRef.current.find(c => c.id === clientId)?.projects.find(p => p.id === projectId);
      const amend   = projNow?.amendments.find(a => a.id === amendId);
      const amendTotal = amend?.signed ? (amend?.amendTotal ?? 0) : 0;   // unsigned ones were never added
      const newAmount  = (projNow?.amount ?? 0) - amendTotal;

      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        amendments: p.amendments.filter(a => a.id !== amendId),
        amount: p.amount - amendTotal,
      }));

      const { error: delErr } = await supabase
        .from("amendments").delete().eq("id", amendId).eq("user_id", userId);
      if (delErr) { setError(delErr.message); return delErr.message; }

      const { error: amtErr } = await supabase.from("projects")
        .update({ amount: newAmount, updated_at: new Date().toISOString() })
        .eq("id", projectId).eq("user_id", userId);
      if (amtErr) { setError(amtErr.message); return amtErr.message; }
      return null;
    },
    [userId]
  );

  // ─── RENEWAL OPS ─────────────────────────────────────────
  const addRenewal = useCallback(
    async (
      clientId: string,
      projectId: string,
      r: Omit<Renewal, "id" | "createdAt">
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      const id = uid();
      const newR: Renewal = { ...r, id };

      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        renewals: [...p.renewals, newR],
      }));

      const { error } = await supabase.from("renewals").insert({
        id, user_id: userId, project_id: projectId,
        r_no:       r.rNo,
        opt_label:  r.optLabel,
        start_date: r.startDate || null,
        end_date:   r.endDate   || null,
        fee:        r.fee,
        signed:     r.signed,
        paid:       r.paid,
        doc:        r.doc,
      });

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const updateRenewal = useCallback(
    async (
      clientId: string,
      projectId: string,
      renewalId: string,
      updates: Partial<Renewal>
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        renewals: p.renewals.map(r => r.id === renewalId ? { ...r, ...updates } : r),
      }));

      const dbUpdates: Record<string, any> = {};
      if (updates.paid     !== undefined) dbUpdates.paid     = updates.paid;
      if (updates.signed   !== undefined) dbUpdates.signed   = updates.signed;
      if (updates.endDate  !== undefined) dbUpdates.end_date = updates.endDate;
      if (updates.doc      !== undefined) dbUpdates.doc      = updates.doc;

      const { error } = await supabase
        .from("renewals").update(dbUpdates).eq("id", renewalId).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  // Old-app "Undo Renewal" on an unpaid renewal removes the record entirely.
  const deleteRenewal = useCallback(
    async (clientId: string, projectId: string, renewalId: string): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        renewals: p.renewals.filter(r => r.id !== renewalId),
      }));

      const { error } = await supabase
        .from("renewals").delete().eq("id", renewalId).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  // ─── DELIVERABLE OPS ─────────────────────────────────────
  const updateDeliverable = useCallback(
    async (
      projectId: string,
      deliverableId: string,
      updates: Partial<Deliverable>
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      const dbUpdates: Record<string, any> = {};
      if (updates.status        !== undefined) dbUpdates.status         = updates.status;
      if (updates.statusDate    !== undefined) dbUpdates.status_date    = updates.statusDate;
      if (updates.deliveredDate !== undefined) dbUpdates.delivered_date = updates.deliveredDate;

      const { error } = await supabase
        .from("deliverables").update(dbUpdates)
        .eq("id", deliverableId).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const upsertDeliverables = useCallback(
    async (
      projectId: string,
      deliverables: Omit<Deliverable, "createdAt">[]
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      const rows = deliverables.map(d => ({
        id:             d.id,
        user_id:        userId,
        project_id:     projectId,
        line_ref:       d.lineRef,
        name:           d.name,
        category:       d.category,
        quantity:       d.quantity,
        quantity_index: d.quantityIndex,
        status:         d.status,
        status_date:    d.statusDate,
        delivered_date: d.deliveredDate,
      }));

      const { error } = await supabase
        .from("deliverables")
        .upsert(rows, { onConflict: "id" });

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  // ─────────────────────────────────────────────────────────
  // DOCUMENTS — every quote, contract, amendment and invoice is
  // its own frozen row. Helpers below throw an Error on failure so
  // the document modal can show it.
  // ─────────────────────────────────────────────────────────
  const findProject = (clientId: string, projectId: string) => {
    const client  = clientsRef.current.find(c => c.id === clientId);
    const project = client?.projects.find(p => p.id === projectId);
    if (!client || !project) throw new Error("Project not found");
    return { client, project };
  };
  const findDoc = (project: Project, docId: string) => {
    const d = (project.documents || []).find(x => x.id === docId);
    if (!d) throw new Error("Document not found");
    return d;
  };

  const nextNumber = async (key: string): Promise<number> => {
    const { data, error } = await supabase.rpc("next_counter", { p_key: key });
    if (error) throw new Error(error.message);
    const n = Number(data);
    if (!n) throw new Error("Could not get the next number");
    return n;
  };

  const writeProject = async (clientId: string, projectId: string, updates: Partial<Project>) => {
    const e = await updateProject(clientId, projectId, updates);
    if (e) throw new Error(e);
  };

  const insertDoc = async (clientId: string, projectId: string, d: Partial<DocRecord>): Promise<DocRecord> => {
    if (!userId) throw new Error("Not authenticated");
    const { data, error } = await supabase.from("documents")
      .insert({ ...docToRow(d), user_id: userId, project_id: projectId })
      .select().single();
    if (error) throw new Error(error.message);
    const doc = rowToDoc(data);
    updateProjectLocal(clientId, projectId, p => ({ ...p, documents: [...(p.documents || []), doc] }));
    return doc;
  };

  const patchDoc = async (clientId: string, projectId: string, docId: string, patch: Partial<DocRecord>): Promise<DocRecord> => {
    if (!userId) throw new Error("Not authenticated");
    const { data, error } = await supabase.from("documents")
      .update({ ...docToRow(patch), updated_at: new Date().toISOString() })
      .eq("id", docId).eq("user_id", userId)
      .select().single();
    if (error) throw new Error(error.message);
    const doc = rowToDoc(data);
    updateProjectLocal(clientId, projectId, p => ({ ...p, documents: (p.documents || []).map(x => x.id === docId ? doc : x) }));
    return doc;
  };

  const dropDoc = async (clientId: string, projectId: string, docId: string) => {
    if (!userId) throw new Error("Not authenticated");
    const { error } = await supabase.from("documents").delete().eq("id", docId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    updateProjectLocal(clientId, projectId, p => ({ ...p, documents: (p.documents || []).filter(x => x.id !== docId) }));
  };

  const money = (kind: string, data: any, settings: any, client: any) => {
    const m = docMoney(kind, data, settings, client);
    return { net: m.net, vat: m.vat, gross: m.gross, vatRate: m.vatRate };
  };

  // Project working copy amount from quote/contract content
  // Project value = the whole contract (retainer: monthly fee × months)
  const amountOf = (data: any): number => docNet("quote", data);

  // Make sure a project has a project number (old projects: from their quote number)
  const ensureProjectNo = async (clientId: string, project: Project): Promise<string> => {
    if (project.projectNo) return project.projectNo;
    const fromQ = pnoFromQNo(project.qd?.qNo);
    const year  = yearOf(today());
    const pno   = fromQ || projectNoFrom(year, await nextNumber(`project:${year}`));
    const qd    = project.qd ? ({ ...project.qd, qNo: quoteNo(pno) } as any) : project.qd;
    await writeProject(clientId, project.id, { projectNo: pno, ...(qd ? { qd } : {}) });
    return pno;
  };

  // Amendment / renewal rows with a known id (so documents can link to them)
  const insertAmendmentRow = async (clientId: string, project: Project, id: string, a: Omit<Amendment, "id" | "createdAt">) => {
    // an amendment only changes the project value once it is signed (markAmendmentSigned)
    const newA: Amendment = { ...a, id };
    const { error } = await supabase.from("amendments").insert({
      id, user_id: userId, project_id: project.id,
      a_no: a.aNo, lines: a.lines, amend_total: a.amendTotal,
      orig_total: a.origTotal, signed: !!a.signed, doc: a.doc || {},
    });
    if (error) throw new Error(error.message);
    updateProjectLocal(clientId, project.id, p => ({ ...p, amendments: [...p.amendments, newA] }));
  };

  const insertRenewalRow = async (clientId: string, projectId: string, id: string, r: Omit<Renewal, "id" | "createdAt">) => {
    const { error } = await supabase.from("renewals").insert({
      id, user_id: userId, project_id: projectId,
      r_no: r.rNo || "", opt_label: r.optLabel, start_date: r.startDate || null, end_date: r.endDate || null,
      usage_end: r.usageEnd || null, excl_end: r.exclEnd || null,
      fee: r.fee, signed: r.signed, paid: r.paid, doc: {},
    });
    if (error) throw new Error(error.message);
    updateProjectLocal(clientId, projectId, p => ({ ...p, renewals: [...p.renewals, { ...r, id, doc: {} }] }));
  };

  // ── SAVE QUOTE (Calculator: new quote / revision / amendment) ──
  const saveQuote = useCallback(
    async (args: SaveQuoteArgs): Promise<SaveResult> => {
      if (!userId) return { error: "Not authenticated" };
      const { doc, brand, contact, mode, projectName, settings } = args;
      const data: any = { ...(doc?.data || {}) };
      delete data.id; delete data.status;

      try {
        let client  = args.clientId ? clientsRef.current.find(c => c.id === args.clientId) : undefined;
        // a new quote only stays with the preselected client if the brand name still matches
        if (mode === "new" && client && client.name.trim().toLowerCase() !== (brand || "").trim().toLowerCase()) client = undefined;
        let project = client && args.projectId ? client.projects.find(p => p.id === args.projectId) : undefined;
        if (!project && args.projectId) {
          for (const c of clientsRef.current) {
            const p = c.projects.find(x => x.id === args.projectId);
            if (p) { client = c; project = p; break; }
          }
        }

        // ── Amendment ───────────────────────────────────────
        if (mode === "amend") {
          if (!client || !project) return { error: "Project not found" };
          const pno = await ensureProjectNo(client.id, project);
          const n   = await nextNumber(`amend:${project.id}`);
          const aNo = amendNo(pno, n);
          const amendTotal = linesSum(data.lines || []);
          const amendId = uid();
          await insertAmendmentRow(client.id, project, amendId, {
            aNo, lines: data.lines || [], amendTotal, origTotal: project.amount, signed: false, doc: {},
          });
          const content = {
            ...data, brand: data.brand || brand, contact: data.contact || contact,
            origTotal: project.amount, amendTotal, contractNo: contractNo(pno), quoteNo: quoteNo(pno),
          };
          const d = await insertDoc(client.id, project.id, {
            kind: "amendment", docNo: aNo, revision: 0, status: "draft",
            docDate: doc.docDate || today(), lang: doc.lang || "en", data: content, amendmentId: amendId,
            ...money("amendment", content, settings, client),
          });
          return { error: null, projectId: project.id, clientId: client.id, document: d };
        }

        // ── Revision ────────────────────────────────────────
        if (mode === "revise") {
          if (!client || !project) return { error: "Project not found" };
          const pno = await ensureProjectNo(client.id, project);
          const qNo = quoteNo(pno);
          const cur = currentQuote(project);
          let d: DocRecord;
          let rev: number;
          if (cur && cur.status === "draft") {
            // never sent → just update it
            rev = cur.revision;
            const content = { ...data, qNo, rev };
            d = await patchDoc(client.id, project.id, cur.id, {
              data: content, docDate: doc.docDate || cur.docDate, lang: doc.lang || cur.lang,
              ...money("quote", content, settings, client),
            });
          } else {
            rev = (cur ? cur.revision : Number(project.qd?.rev) || 0) + 1;
            if (cur) await patchDoc(client.id, project.id, cur.id, { status: "superseded" });
            const content = { ...data, qNo, rev };
            d = await insertDoc(client.id, project.id, {
              kind: "quote", docNo: qNo, revision: rev, status: "draft",
              docDate: doc.docDate || today(), lang: doc.lang || "en", data: content,
              ...money("quote", content, settings, client),
            });
          }
          await writeProject(client.id, project.id, {
            qd: { ...(project.qd || {}), ...d.data } as any,
            amount: amountOf(d.data),
            ...(rev > 0 ? { status: "revised" as ProjectStatus } : {}),
          });
          return { error: null, projectId: project.id, clientId: client.id, document: d };
        }

        // ── New quote for an existing lead: fill that project ─
        if (project && project.status === "lead" && !project.qd && client) {
          const docDate = doc.docDate || today();
          const year    = yearOf(docDate);
          const pno     = projectNoFrom(year, await nextNumber(`project:${year}`));
          const qNo     = quoteNo(pno);
          const content = { ...data, qNo, rev: 0 };
          const name    = projectName?.trim() || project.name || brand || "";
          await writeProject(client.id, project.id, {
            projectNo: pno, name, status: "quoted" as ProjectStatus, amount: amountOf(content), date: docDate, qd: content as any,
          });
          const d = await insertDoc(client.id, project.id, {
            kind: "quote", docNo: qNo, revision: 0, status: "draft",
            docDate, lang: doc.lang || "en", data: content,
            ...money("quote", content, settings, client),
          });
          return { error: null, projectId: project.id, clientId: client.id, document: d };
        }

        // ── New quote ───────────────────────────────────────
        // a new quote needs a project name and a client (no placeholders)
        if (!projectName?.trim()) return { error: "Add a project name first." };
        if (!client && !(brand || "").trim()) return { error: "Add the client's name first." };
        if (!client) {
          const b = (brand || "").trim().toLowerCase();
          client = clientsRef.current.find(c => c.name.trim().toLowerCase() === b);
        }
        if (!client) {
          const clientId = uid();
          const newClient: Client = {
            id: clientId, name: (brand || "").trim(), contact: contact || "", email: "", agency: "Direct",
            street: "", plz: "", city: "", country: "Germany", vatId: "", tags: [], notes: "", projects: [],
          };
          const { error: ce } = await supabase.from("clients").insert({ id: clientId, user_id: userId, ...clientToRow(newClient) });
          if (ce) throw new Error(ce.message);
          setClientsNow(prev => [newClient, ...prev]);
          client = newClient;
        }

        const docDate = doc.docDate || today();
        const year    = yearOf(docDate);
        const pno     = projectNoFrom(year, await nextNumber(`project:${year}`));
        const qNo     = quoteNo(pno);
        const content = { ...data, qNo, rev: 0 };
        const projectId = uid();
        const now  = new Date().toISOString();
        const name = projectName.trim();
        const amount = amountOf(content);

        const newProject: Project = {
          id: projectId, clientId: client.id, projectNo: pno, name, status: "quoted",
          amount, paid: false, date: docDate, deliveryDate: "", usageEndOverride: null, notes: "",
          qd: content, amendments: [], renewals: [], monthlyInvoices: [],
          workspaceStatus: {}, workspaceStatusHistory: {}, workspaceNames: {}, workspaceNotes: {},
          workspaceDeleted: [], workspacePlanner: {}, workspaceCats: {}, managerStatus: {}, documents: [],
          statusHistory: [{ status: "quoted", at: docDate }], licenseState: {}, createdAt: now,
        };
        const { error: pe } = await supabase.from("projects").insert({
          id: projectId, user_id: userId, client_id: client.id, project_no: pno, name,
          status: "quoted", amount, paid: false, date: docDate, delivery_date: null,
          usage_end_override: null, notes: "", quote_doc: content, created_at: now,
          status_history: [{ status: "quoted", at: docDate }],
        });
        if (pe) throw new Error(pe.message);
        const cid = client.id;
        updateClientLocal(cid, c => ({ ...c, projects: [newProject, ...c.projects] }));

        const d = await insertDoc(cid, projectId, {
          kind: "quote", docNo: qNo, revision: 0, status: "draft",
          docDate, lang: doc.lang || "en", data: content,
          ...money("quote", content, settings, client),
        });
        return { error: null, projectId, clientId: cid, document: d };
      } catch (e: any) {
        const msg = e?.message || "Save failed";
        setError(msg);
        return { error: msg };
      }
    },
    [userId]
  );

  // ── Draft save (document modal) ───────────────────────────
  const updateDocument = async (clientId: string, projectId: string, docId: string, patch: Partial<DocRecord>, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    if (cur.status !== "draft") throw new Error("This document is locked.");
    const next = { ...cur, ...patch, data: patch.data ?? cur.data };
    const d = await patchDoc(clientId, projectId, docId, {
      docDate: next.docDate, dueDate: next.dueDate, periodStart: next.periodStart, periodEnd: next.periodEnd,
      lang: next.lang, data: next.data, ...money(next.kind, next.data, settings, client),
    });
    // keep the project's working copy in sync with its current quote / contract
    if ((cur.kind === "quote" && currentQuote(project)?.id === cur.id) ||
        (cur.kind === "contract" && currentContract(project)?.id === cur.id)) {
      const { sender: _s, client: _c, ...content } = next.data || {};
      await writeProject(clientId, projectId, {
        qd: { ...(project.qd || {}), ...content, total: amountOf(content) } as any,
        amount: amountOf(content) + (project.amendments || []).filter(a => a.signed).reduce((s, a) => s + (a.amendTotal || 0), 0),
      });
    }
    // amendment drafts: keep the amendment row and the project amount in sync
    if (cur.kind === "amendment" && cur.amendmentId) {
      const oldTotal = linesSum(cur.data?.lines || []);
      const newTotal = linesSum(next.data?.lines || []);
      const { error } = await supabase.from("amendments")
        .update({ lines: next.data?.lines || [], amend_total: newTotal, updated_at: new Date().toISOString() })
        .eq("id", cur.amendmentId).eq("user_id", userId);
      if (error) throw new Error(error.message);
      updateProjectLocal(clientId, projectId, p => ({
        ...p,
        amendments: p.amendments.map(a => a.id === cur.amendmentId ? { ...a, lines: next.data?.lines || [], amendTotal: newTotal } : a),
      }));
      // only a signed amendment is part of the project value (drafts aren't signed)
      const signed = (project.amendments || []).find(a => a.id === cur.amendmentId)?.signed;
      if (signed && newTotal !== oldTotal) await writeProject(clientId, projectId, { amount: r2(project.amount + newTotal - oldTotal) });
    }
    return d;
  };

  const markDocSent = async (clientId: string, projectId: string, docId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    if (cur.status !== "draft") return cur;
    const content = { ...cur.data, sender: senderSnapshot(settings), client: clientSnapshot(client) };
    return patchDoc(clientId, projectId, docId, {
      status: "sent", sentAt: today(), data: content, ...money(cur.kind, content, settings, client),
    });
  };

  // ── Contract ──────────────────────────────────────────────
  const createContract = async (clientId: string, projectId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const existing = currentContract(project);
    if (existing) return existing;
    const pno = await ensureProjectNo(clientId, project);
    const q = currentQuote(project);
    if (q && q.status === "draft") await markDocSent(clientId, projectId, q.id, settings);   // accepted = sent
    const revs = (project.documents || []).filter(d => d.kind === "contract").map(d => d.revision);
    const rev  = revs.length ? Math.max(...revs) + 1 : 0;
    const { sender: _s, client: _c, ...qd } = project.qd || ({} as any);
    const content = { ...qd, qNo: quoteNo(pno), quoteNo: quoteNo(pno), contractNo: contractNo(pno), footer: "" };
    const d = await insertDoc(clientId, projectId, {
      kind: "contract", docNo: contractNo(pno), revision: rev, status: "draft",
      docDate: today(), lang: q?.lang || "en", data: content, ...money("contract", content, settings, client),
    });
    if (project.status !== "contracted") await writeProject(clientId, projectId, { status: "contracted", paid: false });
    return d;
  };

  const reviseContract = async (clientId: string, projectId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const cur = currentContract(project);
    if (!cur) return createContract(clientId, projectId, settings);
    if (cur.status === "draft") return cur;
    if (cur.status === "signed") throw new Error("A signed contract can't be revised — use Amend instead.");
    await patchDoc(clientId, projectId, cur.id, { status: "superseded" });
    const rev = cur.revision + 1;
    const { sender: _s, client: _c, ...content } = cur.data || {};
    const d = await insertDoc(clientId, projectId, {
      kind: "contract", docNo: cur.docNo, revision: rev, status: "draft",
      docDate: today(), lang: cur.lang, data: content, ...money("contract", content, settings, client),
    });
    await writeProject(clientId, projectId, { qd: { ...(project.qd || {}), contractRev: rev } as any });
    return d;
  };

  const markContractSigned = async (clientId: string, projectId: string, docId: string, date: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    const content = cur.data?.sender ? cur.data : { ...cur.data, sender: senderSnapshot(settings), client: clientSnapshot(client) };
    const d = await patchDoc(clientId, projectId, docId, {
      status: "signed", signedAt: date || today(), sentAt: cur.sentAt || date || today(),
      data: content, ...money(cur.kind, content, settings, client),
    });
    if (cur.kind === "contract" && project.status === "contracted") {
      await writeProject(clientId, projectId, { status: "production" });
    }
    return d;
  };

  // "← Back one step" for the contract stages
  const undoContract = async (clientId: string, projectId: string) => {
    const { project } = findProject(clientId, projectId);
    const con = currentContract(project);
    if (project.status === "production") {
      if (con && con.status === "signed") await patchDoc(clientId, projectId, con.id, { status: "sent", signedAt: null });
      await writeProject(clientId, projectId, { status: "contracted" });
      return;
    }
    if (project.status === "contracted") {
      if (con) {
        if (con.status === "draft") await dropDoc(clientId, projectId, con.id);
        else await patchDoc(clientId, projectId, con.id, { status: "superseded" });
      }
      const q = currentQuote(project);
      const back: ProjectStatus = (q?.revision || Number(project.qd?.rev) || 0) > 0 ? "revised" : "quoted";
      await writeProject(clientId, projectId, { status: back });
      return;
    }
    if (project.status === "revised") await writeProject(clientId, projectId, { status: "quoted" });
  };

  // ── Invoices ──────────────────────────────────────────────
  const baseInvoiceContent = (client: Client, project: Project, pno: string) => {
    const q = project.qd || ({} as any);
    return {
      brand: q.brand || client.name, contact: q.contact || client.contact,
      ctype: q.ctype || "Content Creator", quoteNo: quoteNo(pno), contractNo: contractNo(pno), footer: "",
    };
  };

  const createProjectInvoice = async (clientId: string, projectId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const existing = projectInvoice(project);
    if (existing) return existing;
    const pno = await ensureProjectNo(clientId, project);
    const toBill = unbilledAmendments(project);                      // only SIGNED amendments
    const content = { ...baseInvoiceContent(client, project, pno), lines: [...(project.qd?.lines || []), ...toBill.flatMap(a => a.lines || [])] };
    const dd = today();
    const d = await insertDoc(clientId, projectId, {
      kind: "invoice", subtype: "project", docNo: "", status: "draft",
      docDate: dd, dueDate: dueFrom(dd), periodStart: project.deliveryDate || dd, periodEnd: null,
      lang: currentContract(project)?.lang || "en", data: content, ...money("invoice", content, settings, client),
    });
    await linkAmendments(clientId, projectId, toBill.map(a => a.id), d.id);
    return d;
  };

  const createMonthlyInvoice = async (clientId: string, projectId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const draft = monthlyInvoices(project).find(d => d.status === "draft");
    if (draft) return draft;
    const m = nextRetainerMonth(project);
    if (!m) throw new Error("All months of this retainer are invoiced.");
    const pno = await ensureProjectNo(clientId, project);
    const skip = ["usage","excl","rush","revision","whitelisting","aspect","raw footage","kill","pinned","link in bio"];
    const lines = (project.qd?.lines || []).map((l: any) => {
      const amt = parseFloat(l.amt) || 0;
      return { ...l, amt: skip.some(s => (l.name || "").toLowerCase().includes(s)) ? amt : Math.round(amt * 0.8) };
    });
    const toBill = unbilledAmendments(project);                      // signed amendments go on the next month once
    const content = { ...baseInvoiceContent(client, project, pno), lines: [...lines, ...toBill.flatMap(a => a.lines || [])], retainer: true, retMo: project.qd?.retMo, monthNo: m };
    const dd = today();
    const d = await insertDoc(clientId, projectId, {
      kind: "invoice", subtype: "monthly", monthNo: m, docNo: "", status: "draft",
      docDate: dd, dueDate: dueFrom(dd), periodStart: monthStart(dd), periodEnd: monthEnd(dd),
      lang: currentContract(project)?.lang || "en", data: content, ...money("invoice", content, settings, client),
    });
    await linkAmendments(clientId, projectId, toBill.map(a => a.id), d.id);
    return d;
  };

  const finalizeInvoice = async (clientId: string, projectId: string, docId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    if (cur.status !== "draft") return cur;
    // nothing in the profile is required — missing details are simply left off the invoice
    const year = yearOf(cur.docDate);
    const no   = invoiceNo(year, await nextNumber(`invoice:${year}`));
    const content = { ...cur.data, sender: senderSnapshot(settings), client: clientSnapshot(client) };
    const d = await patchDoc(clientId, projectId, docId, {
      docNo: no, status: "sent", sentAt: today(), data: content, ...money("invoice", content, settings, client),
    });
    if (cur.subtype === "project") await writeProject(clientId, projectId, { status: "invoiced", paid: false });
    if (cur.subtype === "renewal" && cur.renewalId) {
      await supabase.from("renewals").update({ r_no: no, updated_at: new Date().toISOString() })
        .eq("id", cur.renewalId).eq("user_id", userId);
      updateProjectLocal(clientId, projectId, p => ({ ...p, renewals: p.renewals.map(r => r.id === cur.renewalId ? { ...r, rNo: no } : r) }));
    }
    return d;
  };

  const markInvoicePaid = async (clientId: string, projectId: string, docId: string, date: string) => {
    const { project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    if (cur.status === "draft") throw new Error("Finalize the invoice first.");
    const d = await patchDoc(clientId, projectId, docId, { status: "paid", paidAt: date || today() });
    if (cur.subtype === "project") await writeProject(clientId, projectId, { status: "paid", paid: true });
    if (cur.subtype === "monthly") {
      const docs = (project.documents || []).map(x => x.id === d.id ? d : x);
      const retMo = Number(project.qd?.retMo) || 0;
      const paidMonths = new Set(docs.filter(x => x.kind === "invoice" && x.subtype === "monthly" && x.status === "paid").map(x => x.monthNo));
      if (retMo > 0 && Array.from({ length: retMo }, (_, i) => i + 1).every(mo => paidMonths.has(mo))) {
        await writeProject(clientId, projectId, { status: "paid", paid: true });
      }
    }
    if (cur.subtype === "renewal" && cur.renewalId) {
      const e = await updateRenewal(clientId, projectId, cur.renewalId, { paid: true });
      if (e) throw new Error(e);
    }
    return d;
  };

  const markInvoiceUnpaid = async (clientId: string, projectId: string, docId: string) => {
    const { project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    const d = await patchDoc(clientId, projectId, docId, { status: "sent", paidAt: null });
    if (cur.subtype === "project") await writeProject(clientId, projectId, { status: "invoiced", paid: false });
    if (cur.subtype === "monthly" && project.paid) await writeProject(clientId, projectId, { status: "production", paid: false });
    if (cur.subtype === "renewal" && cur.renewalId) {
      const e = await updateRenewal(clientId, projectId, cur.renewalId, { paid: false });
      if (e) throw new Error(e);
    }
    return d;
  };

  // Draft → deleted (no number used). Sent / paid → Storno invoice + original marked cancelled.
  const cancelInvoice = async (clientId: string, projectId: string, docId: string, settings: any) => {
    const { project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    const billed = (project.amendments || []).filter(a => a.invoiceDocId === docId).map(a => a.id);
    if (cur.status === "draft") {
      await dropDoc(clientId, projectId, docId);
      await linkAmendments(clientId, projectId, billed, null);
      if (cur.subtype === "renewal" && cur.renewalId) {
        const e = await deleteRenewal(clientId, projectId, cur.renewalId);
        if (e) throw new Error(e);
      }
      return null;
    }
    if (cur.status === "cancelled" || cur.subtype === "storno") return cur;
    const dd   = today();
    const year = yearOf(dd);
    const no   = invoiceNo(year, await nextNumber(`invoice:${year}`));
    const lines = (cur.data?.lines || []).map((l: any) => ({ ...l, amt: -(parseFloat(l.amt) || 0) }));
    const content = { ...cur.data, lines, cancelsNo: cur.docNo, cancelsDate: cur.docDate };
    const storno = await insertDoc(clientId, projectId, {
      kind: "invoice", subtype: "storno", docNo: no, status: "sent", docDate: dd, sentAt: dd,
      lang: cur.lang, data: content, cancelsId: cur.id,
      net: -cur.net, vat: -cur.vat, gross: -cur.gross, vatRate: cur.vatRate,
    });
    await patchDoc(clientId, projectId, docId, { status: "cancelled" });
    await linkAmendments(clientId, projectId, billed, null);
    if (cur.subtype === "project") await writeProject(clientId, projectId, { status: "production", paid: false });
    if (cur.subtype === "monthly" && project.paid) await writeProject(clientId, projectId, { status: "production", paid: false });
    if (cur.subtype === "renewal" && cur.renewalId) {
      const e = await updateRenewal(clientId, projectId, cur.renewalId, { paid: false });
      if (e) throw new Error(e);
    }
    return storno;
  };

  const deleteDraftDocument = async (clientId: string, projectId: string, docId: string) => {
    const { project } = findProject(clientId, projectId);
    const cur = findDoc(project, docId);
    if (cur.status !== "draft") throw new Error("Only drafts can be deleted.");
    await dropDoc(clientId, projectId, docId);
  };

  // ── Renewal + amendment from the rights builder ───────────
  const addRenewalWithInvoice = async (clientId: string, projectId: string, r: Omit<Renewal, "id" | "createdAt">, doc: any, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const pno = await ensureProjectNo(clientId, project);
    const content = { ...(doc?.data || {}), quoteNo: quoteNo(pno), contractNo: contractNo(pno) };
    const rid = uid();
    await insertRenewalRow(clientId, projectId, rid, { ...r, rNo: "", fee: linesSum(content.lines || []), signed: true, paid: false });
    const dd = doc?.docDate || today();
    return insertDoc(clientId, projectId, {
      kind: "invoice", subtype: "renewal", renewalId: rid, docNo: "", status: "draft",
      docDate: dd, dueDate: dueFrom(dd), periodStart: r.startDate || null, periodEnd: r.endDate || null,
      lang: doc?.lang || "en", data: content, ...money("invoice", content, settings, client),
    });
  };

  const addAmendmentWithDoc = async (clientId: string, projectId: string, a: Omit<Amendment, "id" | "createdAt">, doc: any, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const pno = await ensureProjectNo(clientId, project);
    const n   = await nextNumber(`amend:${project.id}`);
    const aNo = amendNo(pno, n);
    const lines = doc?.data?.lines || a.lines || [];
    const amendTotal = linesSum(lines);
    const amendId = uid();
    await insertAmendmentRow(clientId, project, amendId, { ...a, aNo, lines, amendTotal, origTotal: project.amount, signed: false, doc: (a as any).doc || {} });
    const content = { ...(doc?.data || {}), lines, origTotal: project.amount, amendTotal, contractNo: contractNo(pno), quoteNo: quoteNo(pno) };
    return insertDoc(clientId, projectId, {
      kind: "amendment", docNo: aNo, revision: 0, status: "draft",
      docDate: doc?.docDate || today(), lang: doc?.lang || "en", data: content, amendmentId: amendId,
      ...money("amendment", content, settings, client),
    });
  };

  const removeAmendment = async (clientId: string, projectId: string, amendId: string) => {
    const { project } = findProject(clientId, projectId);
    const d = (project.documents || []).find(x => x.kind === "amendment" && x.amendmentId === amendId);
    if (d && d.status !== "draft") throw new Error("This amendment was already sent and can't be removed.");
    if (d) await dropDoc(clientId, projectId, d.id);
    const e = await deleteAmendment(clientId, projectId, amendId);
    if (e) throw new Error(e);
  };

  const removeRenewal = async (clientId: string, projectId: string, renewalId: string) => {
    const { project } = findProject(clientId, projectId);
    const inv = (project.documents || []).find(x => x.kind === "invoice" && x.renewalId === renewalId && x.status !== "cancelled" && x.subtype !== "storno");
    if (inv && inv.status !== "draft") throw new Error("Cancel this renewal's invoice first.");
    if (inv) await dropDoc(clientId, projectId, inv.id);
    const e = await deleteRenewal(clientId, projectId, renewalId);
    if (e) throw new Error(e);
  };

  // ── Amendments: signed → counts and gets billed ───────────
  const unbilledAmendments = (project: Project) =>
    (project.amendments || []).filter(a => a.signed && !a.invoiceDocId && (Number(a.amendTotal) || 0) !== 0);

  const linkAmendments = async (clientId: string, projectId: string, ids: string[], docId: string | null) => {
    for (const id of ids) {
      const { error } = await supabase.from("amendments").update({ invoice_doc_id: docId }).eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    if (ids.length) updateProjectLocal(clientId, projectId, p => ({
      ...p, amendments: p.amendments.map(a => ids.includes(a.id) ? { ...a, invoiceDocId: docId } : a),
    }));
  };

  const markAmendmentSigned = async (clientId: string, projectId: string, docId: string, date: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    let cur = findDoc(project, docId);
    if (cur.kind !== "amendment") throw new Error("This document is not an amendment.");
    if (cur.status === "signed") return cur;
    if (cur.status === "draft") cur = await markDocSent(clientId, projectId, docId, settings);
    const at = date || today();
    const d = await patchDoc(clientId, projectId, docId, { status: "signed", signedAt: at });
    const a = (project.amendments || []).find(x => x.id === cur.amendmentId);
    if (a && !a.signed) {
      const { error } = await supabase.from("amendments").update({ signed: true, signed_at: at }).eq("id", a.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      updateProjectLocal(clientId, projectId, p => ({ ...p, amendments: p.amendments.map(x => x.id === a.id ? { ...x, signed: true, signedAt: at } : x) }));
      await writeProject(clientId, projectId, { amount: r2((Number(project.amount) || 0) + (Number(a.amendTotal) || 0)) });
      // a project invoice that is still a draft takes the new lines right away
      const inv = projectInvoice(project);
      if (!project.qd?.retainer && inv && inv.status === "draft" && !a.invoiceDocId) {
        const content = { ...inv.data, lines: [...(inv.data?.lines || []), ...(a.lines || [])] };
        await patchDoc(clientId, projectId, inv.id, { data: content, ...money("invoice", content, settings, client) });
        await linkAmendments(clientId, projectId, [a.id], inv.id);
      }
    }
    return d;
  };

  // Signed amendment with no next invoice to ride on → its own invoice
  const createAmendmentInvoice = async (clientId: string, projectId: string, amendId: string, settings: any) => {
    const { client, project } = findProject(clientId, projectId);
    const a = (project.amendments || []).find(x => x.id === amendId);
    if (!a) throw new Error("Amendment not found.");
    if (!a.signed) throw new Error("Mark the amendment signed first.");
    if (a.invoiceDocId) {
      const ex = (project.documents || []).find(x => x.id === a.invoiceDocId);
      if (ex) return ex;
    }
    const pno = await ensureProjectNo(clientId, project);
    const content = { ...baseInvoiceContent(client, project, pno), lines: a.lines || [], amendmentNo: a.aNo };
    const dd = today();
    const d = await insertDoc(clientId, projectId, {
      kind: "invoice", subtype: "amendment", amendmentId: a.id, docNo: "", status: "draft",
      docDate: dd, dueDate: dueFrom(dd), periodStart: a.signedAt || dd, periodEnd: null,
      lang: currentContract(project)?.lang || "en", data: content, ...money("invoice", content, settings, client),
    });
    await linkAmendments(clientId, projectId, [a.id], d.id);
    return d;
  };

  // ── Delete a project (never one with issued invoices) ──────
  const removeProject = async (clientId: string, projectId: string) => {
    const { project } = findProject(clientId, projectId);
    const issued = (project.documents || []).filter(d => d.kind === "invoice" && d.status !== "draft").length;
    if (issued) throw new Error("This project has issued invoices. Invoices must be kept, so it can't be deleted.");
    for (const t of ["documents", "amendments", "renewals", "deliverables"]) {
      const { error } = await supabase.from(t).delete().eq("project_id", projectId).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    const e = await deleteProject(clientId, projectId);
    if (e) throw new Error(e);
  };

  // ── License actions (ignored / taken down) are saved ──────
  const setLicenseAction = async (clientId: string, projectId: string, key: string, action: string | null) => {
    const { project } = findProject(clientId, projectId);
    const next = { ...(project.licenseState || {}) };
    if (action) next[key] = { action, at: today() }; else delete next[key];
    await writeProject(clientId, projectId, { licenseState: next });
  };

  // ── Workspace: save single items (never the whole map) ─────
  // ws_merge (SQL) merges the patch into the stored map on the server,
  // so two devices ticking different items can't overwrite each other.
  const WS_FIELD: Record<string, string> = {
    workspaceStatus: "workspace_status", workspaceStatusHistory: "workspace_status_history",
    workspaceNames: "workspace_names", workspaceNotes: "workspace_notes", workspaceCats: "workspace_cats",
  };
  const patchWs = async (clientId: string, projectId: string, field: string, patch: Record<string, any>) => {
    if (!WS_FIELD[field]) throw new Error(`Unknown workspace field ${field}`);
    updateProjectLocal(clientId, projectId, p => {
      const cur: Record<string, any> = { ...((p as any)[field] || {}) };
      Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined) delete cur[k]; else cur[k] = v; });
      return { ...p, [field]: cur } as any;
    });
    const { error } = await supabase.rpc("ws_merge", { p_project_id: projectId, p_field: WS_FIELD[field], p_patch: patch });
    if (error) { setError(error.message); throw new Error(error.message); }
  };

  // set statuses (with history); `by` marks manager ticks so they can be undone
  const setWsStatus = async (clientId: string, projectId: string, changes: { id: string; status: string }[], by?: string) => {
    const { project } = findProject(clientId, projectId);
    if (!changes.length) return;
    const st: Record<string, any> = {}, hist: Record<string, any> = {};
    changes.forEach(({ id, status }) => {
      st[id] = status;
      hist[id] = [...(((project.workspaceStatusHistory || {}) as any)[id] || []), { status, date: today(), ...(by ? { by } : {}) }];
    });
    await patchWs(clientId, projectId, "workspaceStatus", st);
    await patchWs(clientId, projectId, "workspaceStatusHistory", hist);
  };

  // undo the last step of items: status + history go back (an undone tick no longer counts)
  const revertWsStatus = async (clientId: string, projectId: string, ids: string[]) => {
    const { project } = findProject(clientId, projectId);
    if (!ids.length) return;
    const st: Record<string, any> = {}, hist: Record<string, any> = {};
    ids.forEach(id => {
      const h = [...((((project.workspaceStatusHistory || {}) as any)[id]) || [])];
      h.pop();
      hist[id] = h.length ? h : null;                              // nothing left → back to untouched
      st[id]   = h.length ? h[h.length - 1].status : null;
    });
    await patchWs(clientId, projectId, "workspaceStatus", st);
    await patchWs(clientId, projectId, "workspaceStatusHistory", hist);
  };

  return {
    clients, loading, error, loadError, reload: fetchAll,
    patchWs, setWsStatus, revertWsStatus,
    markAmendmentSigned, createAmendmentInvoice, removeProject, setLicenseAction,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject, setProjectStatus,
    addAmendment, updateAmendment, deleteAmendment,
    addRenewal, updateRenewal, deleteRenewal,
    updateDeliverable, upsertDeliverables,
    saveQuote,
    updateDocument, deleteDraftDocument, markDocSent,
    createContract, reviseContract, markContractSigned, undoContract,
    createProjectInvoice, createMonthlyInvoice, finalizeInvoice,
    markInvoicePaid, markInvoiceUnpaid, cancelInvoice,
    addRenewalWithInvoice, addAmendmentWithDoc, removeAmendment, removeRenewal,
  };
}
