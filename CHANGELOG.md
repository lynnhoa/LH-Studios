# CHANGELOG — Old-app parity implementation (Phases 0–4 + PWA)

Goal: make the Supabase app functionally identical to the old reference
`App.tsx`, keeping split files + desktop / iPad / iOS PWA support.

## How to deploy this zip
1. Supabase SQL editor → run `migrations/phase0_schema_alignment.sql`
2. Supabase SQL editor → run `migrations/phase3_workspace_state.sql`
   (both additive — safe to re-run, safe on live data)
3. Push to GitHub → Vercel deploys (env vars VITE_SUPABASE_URL /
   VITE_SUPABASE_ANON_KEY must exist at BUILD time)

## Phase 0 — data model
- `migrations/phase0_schema_alignment.sql`: renewals table realigned to
  old record shape (opt_label, start_date, end_date, fee, signed, paid);
  `projects.monthly_invoices` JSONB; `deliverables.status_history` JSONB.
  Legacy renewal column DROPs are commented out — run only after
  confirming the table holds no data worth keeping.
- `types.ts`: Renewal rewritten to old shape; new MonthlyInvoice;
  Project.monthlyInvoices.
- `useClients.ts`: rowToRenewal / addRenewal realigned (with legacy-column
  fallbacks); updateRenewal persists paid/signed; new deleteRenewal;
  monthlyInvoices mapped + persisted via updateProject.

## Phase 1 — surgical data-integrity fixes
- `PDFModal.tsx`: Save button + close-confirm only when an onSave handler
  exists (read-only docs close cleanly).
- `ProjectsTab.tsx` / `ProjectCard.tsx`: old-app onSave routing —
  amendment/renewal docs are read-only (no save handler → no more
  overwriting project.qd); contract revision bumps contractRev and never
  touches amount; delivery date is forward-only again.
- `ManagerApp.tsx`: after Calculator save → Projects tab with the new
  project auto-expanded + scrolled (old behavior); onAmend threaded to
  ProjectsTab so "+ Amend" works.
- Bonus fix: "Undo Renewal" (unpaid) now deletes the DB record instead of
  a local-only update that vanished on reload.

## Phase 2 — RenewalModal + retainer monthly invoices
- New `RenewalModal.tsx` (verbatim port): deliverable qty steppers over
  quote + signed-amendment lines, usage/exclusivity None/Predefined/Custom
  with pro-rata custom fees, date derivation, RNW numbering, PDF preview.
- `rateCards.ts`: RENEWAL_OPTS; `formatters.ts`: addD.
- "Add Renewal" wired in ProjectsTab + ProjectCard (saves signed:true).
- ProjectsTab retainer cycle (verbatim old logic): "Create Invoice
  N/retMo" gated on last month paid; 20% line discount with the exact
  skip-list; INV-…-M01 numbering; save appends / edits monthlyInvoices by
  index; Mark M Paid (all paid ⇒ project paid); Undo M; green
  "Invoice M01…" doc buttons.

## Phase 3 — ProductionSection + workspace persistence
- `migrations/phase3_workspace_state.sql`: workspace_status +
  workspace_status_history JSONB on projects (plus IF NOT EXISTS safety
  adds for the other workspace columns).
- Architecture decision (deviation from plan §0.3): workspace state
  persists as JSONB on projects — old-app single-blob parity — instead of
  the deliverables table (which had zero writers). This also fixed a
  latent bug: CreatorWorkspace status changes were never persisted at all.
- `useClients.ts`: updateProject maps all 7 workspace fields +
  managerStatus; rowToProject prefers JSONB columns, falls back to legacy
  deliverables-derived state.
- `wsHelpers.ts`: getCatProgress ported.
- New `ProductionSection.tsx` (verbatim port): per-category deliverable
  grid, progress circles, "ready" badge, manager checkboxes (reviewed /
  delivered with full cascade / auto "all posted"). Rendered in
  ProjectsTab when status === "production".

## Phase 4 — parity polish
- Status colors back to old values everywhere: revised #b8a090 (rosewood),
  production #8fa89a (sage).
- Calculator amendment mode: category badges restored on read-only lines.
- ProjectsTab: re-scroll to the expanded row after closing PDF/Renewal
  modals (old scrollTrigger mechanic).
- "+ New Client" appends to end of list (old addCl behavior).

## PWA fix
- Icons copied from old repo into `public/` (apple-touch-icon, favicons,
  icon-192/512); site.webmanifest + robots.txt moved into `public/` so
  Vite ships them; index.html links manifest + icons. Verified in dist/.

## Known open items
1. Multi-device: data fetched once per load, last-write-wins — consider
   refetch-on-focus (~20 lines).
2. Supabase write errors are stored but never displayed — consider an
   error banner.
3. Unaudited surfaces: Dashboard, Invoices/Excel export, Creator side,
   RateCard builder, PDF engine output.
4. Intentional deviation kept: Clients-tab project cards have the full
   action workflow (old app had docs-only there). Strip on request.
5. After confirming renewals table has no legacy data: run the commented
   DROP block in phase0 migration; deliverables table is now writerless.
