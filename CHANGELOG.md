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

## Planner · Content concept (21.10.2026)
- Profile menu › This app: "@lynnhoa concept" / "@createbylynn concept"
  (replace the account rows; the switch next to each tab title stays).
- `PlannerConcept.tsx` (new): the page under the tabs. One card per arc,
  numbered; tap to open / close, "collapse all / expand all" (remembered
  on this device, all closed the first time). Open: purpose, formats with
  TikTok (pistachio) / Instagram (pink) ticks, "texts · links" small and
  underlined top right. Phone one column, iPad / computer two columns.
- texts / links open one window each: the idea window's text list and
  link list (add, change, delete with Undo, saved right away); the link
  pill is coloured by platform on this page only.
- Data: table `planner_concept_arcs` (SQL `LH-Studio-planner-concept.sql`,
  safe to rerun). Arcs, purpose, formats and ticks are fixed by the SQL;
  texts and links are written in the app. Only a real change is saved.
- Changed: `PlannerApp.tsx`, `PlannerWindows.tsx` (shares the text list,
  link list and window head), `usePlanner.ts`, `planner.ts`.

## Planner · compact windows + Concept in the idea window (21.10.2026)
- All Planner windows: 40 px top bar, 10 px between sections, smaller
  section icons, 32 px rows and fields with 13 px text (typed at 16 px
  underneath, so the iPhone doesn't zoom). Sprint window fields use the
  same small fields.
- Idea window: Type removed (ideas keep the type they have); stage badge
  removed; Delete moved into ⋯ (with Undo); no Done bar (✕ closes,
  everything saves on its own); slimmer Shot / Filmed / Posted; 20 px title.
- New Concept dropdown: the account's arcs as groups, picking a format sets
  its arc (saved in the idea's plan: `arc`, `arcFormat`, no SQL). Under it:
  "Posts on" TikTok / Instagram from the concept's ticks.
- Lists (storyline, clips, concept texts): an empty list shows only
  "+ Add …"; a line left empty disappears again. Storyline is always bullets.
- Concept Texts / Links windows: no Done bar.
- Changed: `PlannerWindows.tsx`, `planner.ts`, `PlannerConcept.tsx`.

## Planner · windows as bottom sheets + Arc / Format split (21.10.2026)
- Every Planner window (Idea, Sprint, concept Texts / Links) is now a bottom
  sheet like the Manager and Creator sheets: only as tall as its content (up
  to 88 %), the page dimmed behind, tap outside or ✕ to close, small-caps
  title, sits above the iPhone keyboard; 560 px wide and centred on iPad /
  computer.
- Idea window: "Idea" as the title, the account and ⋯ on the right.
- Done is back at the bottom of the Idea and concept Texts / Links sheets.
- Concept: Arc and Format as two small dropdowns side by side. Format lists
  only that arc's formats; a new arc keeps the format if it has one of the
  same name; "Pick an arc" clears both.
- Changed: `PlannerWindows.tsx`, `PlannerConcept.tsx`.

## Planner · Concept phases (22.10.2026)
- Content concept: a switch under the title, Arcs | Phases (remembered on
  this device). Colours: arcs pastel blue, phases butter; lavender stays
  the account's.
- Phases: Home, Occasion, Invited, City break, Long trip, Brand partner,
  one card each (all closed the first time, remembered). Open: purpose and
  its recurring eras, each with the number of core arcs (+ optional).
- Tap an era: one sheet with its arcs in posting order, optional ones last
  in grey with their note. Each arc there IS the arc of Arcs: purpose,
  formats with ticks, texts and links, edited right there (no jump to
  Arcs); a change shows in both.
- Idea window › Concept: Phase and Era above Arc and Format. Era lists that
  phase's eras; a new phase keeps the era if it has it; "Pick a phase"
  clears both. With an era, Arc lists the era's arcs first (optional ones
  marked), then the others. Saved in the idea's plan (`phase`, `era`), no
  SQL. Without phases (e.g. @createbylynn) the row is hidden.
- Data: table `planner_concept_phases` (SQL `LH-Studio-planner-phases.sql`,
  safe to rerun). Phases, eras and their arcs are fixed by the SQL. Step 4
  adds the approved era lines to the matching arcs' texts (only lines that
  aren't there yet).
- Changed: `PlannerConcept.tsx`, `PlannerWindows.tsx`, `usePlanner.ts`,
  `planner.ts`.

## Planner · Creator Now + Saved ideas, era sheet folds (22.10.2026)
- Creator (accounts with phases): new Now card under the concept line.
  Phase and Era on top (saved per account, the same on phone and iPad),
  then one row per arc of that era in posting order: its idea with where
  it is (Shoot › while it's an idea · to shoot · filmed · posted), or
  "+ Add an idea" when the arc is empty (a new idea with phase, era and arc
  set; a pasted link works too). Ideas of the era without one of its arcs
  show last. The head counts the era's core arcs posted.
- Ideas → Saved ideas: the ideas not in Now, by phase (No phase last), each
  with its era and arc in the small line. Use now › moves one into the Now
  era (its arc stays; with Undo); without an era it's Shoot › as before.
  @createbylynn (no phases yet): Ideas exactly as before, no Now.
- Concept › Phases › an era: its arcs are cards now, all closed when the
  sheet opens; tap one to open it (purpose, formats, texts, links — still
  edited right there), "expand all / collapse all" next to the era's line.
- Data: table `planner_concept_now` (SQL `LH-Studio-planner-now.sql`, safe
  to rerun). Without it Now still works on screen and says to run it.
- Changed: `PlannerCreator.tsx`, `PlannerConcept.tsx`, `usePlanner.ts`,
  `planner.ts`.

## Planner · goals without Pieces, four in a row (22.10.2026)
- Pieces is no longer a weekly goal on the Creator tab or the Dashboard
  (the month tile, e.g. Oct, still counts the portfolio pieces of the month
  and switches on the 1st).
- Creator: the goals sit in one row of up to 4 (Ideas · Filmed · Posts ·
  month): the name on top, the number under it; Edit goals puts the field
  under the name. "x of y reached" counts every tile shown.
- Dashboard: an odd last Creator tile spans both columns (like Manager).
- No SQL. Changed: `planner.ts`, `PlannerCreator.tsx`, `PlannerOverview.tsx`.

## Modals · the sheet keeps its top with the keyboard (23.10.2026)
- The sheet layer follows the visible screen at once (no glide, so no lag and no gap under the sheet
  when the keyboard closes). Only the sheet glides, inside the dimming.
- A sheet keeps its top where it is when the keyboard opens: its bottom glides to the keyboard, the
  footer rides on it, the content scrolls, the field you tapped stays in view. A sheet that wouldn't
  keep at least 300 px above the keyboard moves up just as much as it needs (short sheets sit on it).
  The sheet now has its own measured top / height (`useViewport`, a measured content height).
- Page bottom bars follow at once too (their height still eases).
- Checked: simulated keyboard + pan (tall, short and template sheets, iPad), the earlier motion and
  window suites, type-check, build. Changed: `index.html`, `atoms.tsx`.

## Modals · in motion: on the keyboard, no jumps, no blinks (23.10.2026)
- The visible screen (atoms.tsx, index.html): one tracker follows the part of the screen you can see
  (iPhone visualViewport) and sets --vv-top / --vv-h / --kb / --kb-safe / --sheet-max on <html>.
  `.lh-screen` places sheets and the document windows with them; bottom bars (BottomBar, DocFoot,
  the sheet footer), the save toast and the Undo bar sit on it too — everything rides on the keyboard
  in one glide (MOTION.keyboard) instead of fighting iOS's own scrolling. A sheet is never taller than
  what's visible (✕ and the title stay), sits exactly on the keyboard, and keeps the field you type
  in in view.
- Motion: a sheet slides up when it opens and down when it closes (✕, outside, Escape, Done — the
  Done button closes through the sheet), the dimming fades, dialogs and menus fade in; Reduce Motion
  on the phone → fades only. Values: MOTION in constants.ts, CSS in index.html.
- The page behind is locked while a window is open (html overflow, scroll position kept and restored).
- No auto-keyboard: New contact, New template, new catalog items and Add comments open calmly.
- Add contact / Add template: the same window turns into the saved item (no reopening blink).
- ⋯ menus and dropdowns open within the visible screen (above the keyboard).
- Checked: 32 simulated keyboard / pan / motion checks + the window flows, type-check, build.
- No SQL. Changed: `index.html`, `constants.ts`, `atoms.tsx`, `undo.tsx`, `EmailList.tsx`,
  `EmailKit.tsx`, `PlannerWindows.tsx`, `PlannerConcept.tsx`, `ServiceCatalog.tsx`,
  `CreatorWorkspace.tsx`, `Comments.tsx`, `PDFModal.tsx`, `RenewalModal.tsx`.

## Modals · clean-up: one draft helper, the sheet guards closing (23.10.2026)
- `useDraft` (atoms.tsx): the one keeper of what you type — Contact, Media kits, Template, Sprint,
  the catalog windows and the Workspace item all use it. Spaces at the ends and empty vs. missing
  don't count as a change (Template: categories in any order). A background update replaces the
  values only while nothing is typed. `saving()` right before a save: the stored value comes back
  and Save turns into Done. `frozen` for something new (a new template keeps its picked kit).
- `Sheet dirty`: ✕, tap outside and Escape ask before throwing typing away — in every window,
  Add comments and new catalog items included; something new and empty just goes.
- Usage / exclusivity: Move up / down keeps the window open and the typing.
- Documents: a new, unsaved document (from the Calculator) shows its pages only, as before; a saved
  draft opens ready to edit.
- MiniArea re-measures when its width changes (rotating the iPad); volume discount fields at the
  standard height; a wrong media-kit link shows its error under that kit; errors scroll into view.
- Checked: 30 click tests on the windows, type-check, build, screenshots on iPhone and iPad.
- No SQL. Changed: `atoms.tsx`, `EmailList.tsx`, `EmailKit.tsx`, `PlannerWindows.tsx`,
  `ServiceCatalog.tsx`, `CreatorWorkspace.tsx`, `Comments.tsx`, `PDFModal.tsx`.

## Modals · Phases 2–5: every window one level (23.10.2026)
- Shared parts (atoms.tsx): `SheetRow` / `SheetPair` (label-left rows), `SheetAction` (top card),
  `SheetMeta`, `SheetErr`, `DiscardDialog`, `MiniArea` (text of several lines, drawn at 13 px,
  grows), `NumField bare`, `ROW_ICON`; `MoreMenu` (⋯) moved here and drawn on top of everything
  (a portal), so no card cuts it off — PlannerWindows re-exports it. Document windows: `DocBar`,
  `DocTabs`, `DocFoot`, `DOC_PAGES`.
- The rule everywhere: the fields are the view (no Edit step), Done → Save as soon as you type
  (the window stays open), something new → Add …, ✕ with unsaved typing asks first, Delete /
  Move up / Move down in ⋯ top right.
- Phase 2 · Email kit: Media kits (View link with ↗ · PDF with Share and ⋯ Replace / Delete or
  Upload PDF · File · Focus; "Link updated …" under each kit) and Template (top card: media kit
  — saved at once — · Share PDF · Copy text; Template card; Text card with Subject and the text).
- Phase 3 · Sprint: one view — top card (running day, pitches / follow-ups against the goals in
  pistachio once reached, End sprint), Plan card, Results card always there. No review mode.
- Phase 4 · Service catalog (item · usage / exclusivity · card settings) and Creator › Workspace
  item: one level; section icons in the card's colour.
- Phase 5 · Document windows (quote / contract / invoice / license, rate card, renewal, new rate
  card): the same 48 px bar (✕ · title · EN/DE · status), Edit | Preview on the phone, the same
  bottom bar with its shadow, the same grey behind the pages. A draft opens ready to edit (fields
  next to the pages on iPad / computer) — Save appears when you type; EN/DE on an unchanged draft
  is still kept right away.
- No SQL. Changed: `atoms.tsx`, `EmailKit.tsx`, `PlannerWindows.tsx`, `ServiceCatalog.tsx`,
  `CreatorWorkspace.tsx`, `PDFModal.tsx`, `RenewalModal.tsx`.

## Modals · one sheet, one stylesheet, colour and depth — Phase 1 (23.10.2026)
- One build for every item window: `Sheet` (atoms.tsx) with its parts `SheetHead`
  (section: coloured icon circle + small caps), `SHEET_CARD`, `SHEET_CAPS` and
  `SheetButton` (the footer button). Values in `SHEET` (constants.ts). The Planner's
  own `Window` and Outreach's full-screen `Window` are removed.
- Depth: the sheet in the app's cream (white cards float, like the Dashboard), footer
  bar white with the bottom-bar shadow, the sheet lifted off the dimmed page
  (`SHADOW.sheet`). Confirm dialogs: the same dimming, a white card.
- Colour where it means something: the contact's Status field in its status colour
  (same as the list pill, `MenuSelect look`), @lynnhoa lavender / @createbylynn peach
  in the Template line and the timeline, a dot per timeline line (pitch butter,
  reply blue, gifted · invited · lead · client pistachio), section icons one shade
  stronger (the tone's fill).
- Log pitch, Import contacts and the phone Filter are bottom sheets now (were full
  screen / a panel without header). Footers: Done light everywhere (Planner too);
  Log pitch and Add comments one dark button (✕ cancels); Import gets Done; Filter:
  Reset top right, "Show n contacts" at the bottom.
- Media kits: the rows sit in white cards.
- No SQL. Changed: `constants.ts`, `atoms.tsx`, `PlannerWindows.tsx`,
  `PlannerConcept.tsx`, `EmailList.tsx`, `EmailKit.tsx`, `Comments.tsx`.

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
