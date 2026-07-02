// ─────────────────────────────────────────────────────────────
// useClients — clients + all child tables CRUD
// clients → projects → amendments + renewals + deliverables
// All data fetched once, kept in local state, synced to Supabase.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./useSupabase";
import { uid, today } from "./formatters";
import { SEED_CLIENTS } from "./rateCards";
import type {
  Client, Project, Amendment, Renewal, MonthlyInvoice,
  Deliverable, QuoteDoc, ProjectStatus,
} from "./types";

interface UseClientsReturn {
  clients:      Client[];
  loading:      boolean;
  error:        string | null;

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

  // Renewal ops
  addRenewal:    (clientId: string, projectId: string, r: Omit<Renewal, "id" | "createdAt">) => Promise<string | null>;
  updateRenewal: (clientId: string, projectId: string, renewalId: string, updates: Partial<Renewal>) => Promise<string | null>;
  deleteRenewal: (clientId: string, projectId: string, renewalId: string) => Promise<string | null>;

  // Deliverable ops
  updateDeliverable: (projectId: string, deliverableId: string, updates: Partial<Deliverable>) => Promise<string | null>;
  upsertDeliverables: (projectId: string, deliverables: Omit<Deliverable, "createdAt">[]) => Promise<string | null>;

  // Convenience — used by Calculator save
  saveQuote: (
    quoteDoc: QuoteDoc,
    brand: string,
    contact: string,
    isRevision: boolean,
    revN: number,
    projectName?: string,
    isAmend?: boolean,
    amendN?: number,
    origQNo?: string,
  ) => Promise<string | null>;
}

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
    country:   row.country    ?? "Germany",
    tags:      row.tags       ?? [],
    notes:     row.notes      ?? "",
    projects,
    createdAt: row.created_at,
  };
}

function rowToProject(
  row: any,
  amendments: Amendment[],
  renewals: Renewal[],
  deliverables: Deliverable[],
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
    managerStatus:          row.manager_status    ?? {},
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

  // ── Full fetch ────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!userId) { setClients([]); setLoading(false); return; }

    setLoading(true);

    const [
      { data: cRows, error: cErr },
      { data: pRows, error: pErr },
      { data: aRows, error: aErr },
      { data: rRows, error: rErr },
      { data: dRows, error: dErr },
    ] = await Promise.all([
      supabase.from("clients")     .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("projects")    .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("amendments")  .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("renewals")    .select("*").eq("user_id", userId).order("created_at"),
      supabase.from("deliverables").select("*").eq("user_id", userId),
    ]);

    const err = cErr || pErr || aErr || rErr || dErr;
    if (err) { setError(err.message); setLoading(false); return; }

    // Seed clients if first login
    if (!cRows || cRows.length === 0) {
      const seeds = SEED_CLIENTS.map(c => ({
        id:      uid(),
        user_id: userId,
        name:    c.name,
        contact: c.contact,
        email:   c.email,
        agency:  c.agency,
        country: c.country,
        tags:    c.tags,
        notes:   c.notes,
      }));
      await supabase.from("clients").insert(seeds);
      setClients(seeds.map(s => ({ ...s, projects: [] })) as unknown as Client[]);
      setLoading(false);
      return;
    }

    // Assemble tree: clients → projects → amendments / renewals / deliverables
    const amendments:   Record<string, Amendment[]>   = {};
    const renewals:     Record<string, Renewal[]>     = {};
    const deliverables: Record<string, Deliverable[]> = {};

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

    const projectsByClient: Record<string, Project[]> = {};
    for (const row of pRows ?? []) {
      const p = rowToProject(
        row,
        amendments[row.id]   ?? [],
        renewals[row.id]     ?? [],
        deliverables[row.id] ?? [],
      );
      if (!projectsByClient[row.client_id]) projectsByClient[row.client_id] = [];
      projectsByClient[row.client_id].push(p);
    }

    const built: Client[] = (cRows ?? []).map(row =>
      rowToClient(row, projectsByClient[row.id] ?? [])
    );

    setClients(built);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── LOCAL STATE HELPERS ─────────────────────────────────
  const updateClientLocal = (id: string, fn: (c: Client) => Client) =>
    setClients(prev => prev.map(c => c.id === id ? fn(c) : c));

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
      const row = { id, user_id: userId, ...c };

      // Old-app addCl appends new clients to the end of the list
      setClients(prev => [...prev, { ...c, id, projects: [] } as Client]);

      const { error } = await supabase.from("clients").insert(row);
      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const updateClient = useCallback(
    async (id: string, updates: Partial<Client>): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      updateClientLocal(id, c => ({ ...c, ...updates }));

      const { projects: _, createdAt: __, ...rest } = updates as any;
      const { error } = await supabase
        .from("clients")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", userId);

      if (error) { setError(error.message); return error.message; }
      return null;
    },
    [userId]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<string | null> => {
      if (!userId) return "Not authenticated";
      setClients(prev => prev.filter(c => c.id !== id));

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
      const newProject: Project = { ...p, id, createdAt: new Date().toISOString() };

      updateClientLocal(clientId, c => ({
        ...c,
        projects: [newProject, ...c.projects],
      }));

      const { error } = await supabase.from("projects").insert({
        id,
        user_id:      userId,
        client_id:    clientId,
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
      updateProjectLocal(clientId, projectId, p => ({ ...p, ...updates }));

      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
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

  // ─── SAVE QUOTE (Calculator) ─────────────────────────────
  // Mirrors the handleSave logic from the original App.tsx
  const saveQuote = useCallback(
    async (
      quoteDoc: QuoteDoc,
      brand: string,
      contact: string,
      isRevision: boolean,
      revN: number,
      projectName?: string,
      isAmend?: boolean,
      amendN?: number,
      origQNo?: string,
    ): Promise<string | null> => {
      if (!userId) return "Not authenticated";

      const existingClient = clients.find(
        c => c.name.toLowerCase() === brand.toLowerCase()
      );

      // ── Amendment ─────────────────────────────────────────
      // origQNo is the original QUO-... number from prefill; quoteDoc.qNo is AMD-...
      if (isAmend && existingClient) {
        const existingProject = existingClient.projects.find(
          p => p.qd?.qNo === (origQNo || quoteDoc.qNo)
        );
        if (!existingProject) return "Project not found";

        const amendTotal = (quoteDoc.lines ?? []).reduce(
          (s, l) => s + (l.amt ?? 0), 0
        );
        return addAmendment(existingClient.id, existingProject.id, {
          aNo:        `Amend ${amendN ?? 1}`,
          lines:      quoteDoc.lines ?? [],
          amendTotal,
          origTotal:  existingProject.amount,
          signed:     false,
          doc:        quoteDoc,
        });
      }

      // ── Revision ──────────────────────────────────────────
      // For revisions quoteDoc.qNo is the original QUO number (unchanged), origQNo also works
      if (isRevision && existingClient) {
        const existingProject = existingClient.projects.find(
          p => p.qd?.qNo === (origQNo || quoteDoc.qNo)
        );
        if (!existingProject) return "Project not found";
        return updateProject(existingClient.id, existingProject.id, {
          qd:     quoteDoc,
          status: "revised",
          amount: quoteDoc.total,
        });
      }

      // ── New or updated quote ───────────────────────────────
      if (existingClient) {
        const existingProject = existingClient.projects.find(
          p => p.qd?.qNo === quoteDoc.qNo
        );
        if (existingProject) {
          return updateProject(existingClient.id, existingProject.id, {
            qd:     quoteDoc,
            amount: quoteDoc.total,
          });
        }
        // New project under existing client
        const name = projectName?.trim() || brand || "Untitled Project";
        return addProject(existingClient.id, {
          clientId:               existingClient.id,
          name,
          status:                 "quoted",
          amount:                 quoteDoc.total,
          paid:                   false,
          date:                   quoteDoc.date,
          deliveryDate:           "",
          usageEndOverride:       null,
          notes:                  "",
          qd:                     quoteDoc,
          amendments:             [],
          renewals:               [],
          monthlyInvoices:        [],
          workspaceStatus:        {},
          workspaceStatusHistory: {},
          workspaceNames:         {},
          workspaceNotes:         {},
          workspaceDeleted:       [],
          workspacePlanner:       {},
          managerStatus:          {},
        });
      }

      // ── New client + new project ───────────────────────────
      // Atomic local state update: add client AND project in one setClients call
      // to avoid the React state race where addProject's updateClientLocal fires
      // before addClient's setClients has flushed, causing the project card to
      // never appear in the UI even though both DB inserts succeed.
      const clientId  = uid();
      const projectId = uid();
      const name      = projectName?.trim() || brand || "Untitled Project";
      const now       = new Date().toISOString();

      const newProject: Project = {
        id:                     projectId,
        clientId,
        name,
        status:                 "quoted",
        amount:                 quoteDoc.total,
        paid:                   false,
        date:                   quoteDoc.date,
        deliveryDate:           "",
        usageEndOverride:       null,
        notes:                  "",
        qd:                     quoteDoc,
        amendments:             [],
        renewals:               [],
        monthlyInvoices:        [],
        workspaceStatus:        {},
        workspaceStatusHistory: {},
        workspaceNames:         {},
        workspaceNotes:         {},
        workspaceDeleted:       [],
        workspacePlanner:       {},
        managerStatus:          {},
        createdAt:              now,
      };

      const newClient: Client = {
        id:       clientId,
        name:     brand || "New Client",
        contact:  contact || "",
        email:    "",
        agency:   "Direct",
        country:  "Germany",
        tags:     [],
        notes:    "",
        projects: [newProject],
      };

      // Single state update — client card + project card appear together
      setClients(prev => [newClient, ...prev]);

      // DB inserts (client first so FK constraint on projects.client_id is satisfied)
      const { error: clientInsertErr } = await supabase.from("clients").insert({
        id:       clientId,
        user_id:  userId,
        name:     newClient.name,
        contact:  newClient.contact,
        email:    newClient.email,
        agency:   newClient.agency,
        country:  newClient.country,
        tags:     newClient.tags,
        notes:    newClient.notes,
      });
      if (clientInsertErr) { setError(clientInsertErr.message); return clientInsertErr.message; }

      const { error: projectInsertErr } = await supabase.from("projects").insert({
        id:                 projectId,
        user_id:            userId,
        client_id:          clientId,
        name,
        status:             newProject.status,
        amount:             newProject.amount,
        paid:               newProject.paid,
        date:               newProject.date,
        delivery_date:      null,
        usage_end_override: null,
        notes:              newProject.notes,
        quote_doc:          newProject.qd,
        created_at:         now,
      });
      if (projectInsertErr) { setError(projectInsertErr.message); return projectInsertErr.message; }

      return null;
    },
    [userId, clients, addClient, addProject, updateProject, addAmendment]
  );

  return {
    clients, loading, error,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject, setProjectStatus,
    addAmendment, updateAmendment,
    addRenewal, updateRenewal, deleteRenewal,
    updateDeliverable, upsertDeliverables,
    saveQuote,
  };
}
