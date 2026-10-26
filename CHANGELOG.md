# Outreach · Setup: categories, tiers, follow-up timing (26.10.2026)
- New page Outreach › Setup: profile menu › This app, after @lynnhoa / @createbylynn. No tab is underlined
  while it's open; tap a tab to leave it (like Manager's menu pages). Phone: one column · iPad / computer:
  Categories left, Tiers and Follow-up timing right.
- Categories: your 8 + Bag, Shoes, Jewelry, Appliances (@lynnhoa, all @lynnhoa templates, at the end). Row:
  name · account (lavender @lynnhoa / peach @createbylynn) · own templates · contacts. Window (one level, like
  the contact window): Name · Account · Templates (all of the account's / only templates for it) · Used by;
  ⋯ Delete category. + Add opens the same window empty, and it stays open as the new one.
- Tiers: the same, with Name · Used by.
- Sort: ↑ ↓ like Email kit (the buttons now live in atoms), saved right away. The first category is the
  default for a new contact.
- Delete asks where its contacts go (a tier: another tier or No tier); templates and Planner sprints that used
  it switch to Any. The last category can't be deleted.
- A category switched to UGC: its Gifted / Invited contacts become Replied (the window says how many first),
  with a timeline line — the same rule as for one contact.
- Follow-up timing: Follow-up 1 · Follow-up 2 · No reply · Re-pitch, whole days (1–365), saved when you leave
  the number. Every due date follows at once (also the Dashboard's "Ready to re-pitch" text), and the server's
  daily No reply uses your number.
- Everything reads the lists from Setup: Contacts (category picker, filters, account filter, sort by category),
  the contact window's templates and statuses, Email kit (category chips, the "own templates" hint), Dashboard,
  Planner sprints, the Excel template and the import prompt. Hotel / Restaurant's "only their templates" rule
  is now the Setup setting (outlook.ts › templatesFor).
- The lists are also kept on the device, so they're there before the database answers. Before the Setup SQL
  has run, the built-in lists are used and Setup says so (read only).
- Data: run the Setup SQL once (safe to rerun): tables outreach_lists and outreach_settings (filled for every
  login), the three Setup steps (outreach_list_update / _order / _remove), a check that a contact's category
  and tier are on your lists (replaces the fixed rules; old values like Others stay until changed), and
  outreach_close_no_reply with your No reply number.
- New: `SetupPage.tsx`, `useOutreachLists.ts`. Changed: `outreach.ts`, `outlook.ts`, `EmailList.tsx`,
  `EmailKit.tsx`, `useEmailKit.ts`, `useOutreach.ts`, `usePlanner.ts`, `OutreachDashboard.tsx`,
  `OutreachApp.tsx`, `PlannerApp.tsx`, `atoms.tsx`.

# Planner · @lynnhoa concept: lists fold, nothing shown twice (25.10.2026)
- Every list inside a card folds: tap its heading (small arrow after it). Formats on the Arcs tab,
  the groups on Phases ("Moments · 3", "Eras: on you · 3" …), the sections and Arcs on Base, and
  Formats · Texts · Links inside each arc of the arcs window (an arc folds the same in both places).
  Lists are open when a card opens; what you fold stays folded on this device. "expand all /
  collapse all" stay for the cards.
- Nothing is shown twice: an open arc shows what it is and its formats — its texts and links live
  behind "texts · links" top right. The same for @createbylynn's series: what it is, and "labels /
  texts · links" open their windows.
- Base: the small link top right is "edit" (opens the lines to add, change, delete); the lines stay
  in the card.
- Changed: `PlannerConcept.tsx`.

# Planner · @lynnhoa concept: one structure for Base · Phases · Arcs (25.10.2026)
- Every card works the same: number · name · (open: its small links) · arrow. Open: what it is in
  grey, then its lists under one heading style (small grey caps with the count: "Rituals · 3",
  "Moments · 3", "Formats · 5") and one row style (light dot, the name black, what it is grey, in
  full). The cards are for reading; the small links and the windows are for changing.
- Phases: the "Eras · 14 | Arcs" row is gone — the counts sit on the group headings, and a phase
  without groups shows "Eras · 3". Each era shows its arcs as small numbers (blue, optional ones
  grey) instead of "4", and its description is no longer cut.
- Arcs: an open arc also shows its texts and links, read only ("texts · links" still open the
  windows to change them). @createbylynn's series show their links too.
- Base is warm grey now (the palette's colour for categories; green stays TikTok's). Its arcs show
  their full names, optional ones grey — tap one: the block's arcs window with that arc open (the
  same window as an era). Open blocks are remembered by block, not by place (all closed once).
- The arcs window (an era or a block): "Arcs · 4" heading with expand all, cards spaced like the
  page. Window titles: "6. The Obsession" · "1. Home · Coming home" · "Base · 1. Signatures".
- Under the list, while a card is open: what its marks mean (Arcs: main format · TikTok ·
  Instagram; Base and Phases: arc · optional arc). The line under the title says what the tab is:
  "Always there, under every phase" · "Where you are, one era at a time" · "How each post is told".
- The page opens on the tab you had last (remembered on this device, like @createbylynn's switch).
- Grey text on the cards starts with a capital and ends with a full stop (quotes stay as typed).
- Idea window and Creator › Now: "Base or phase" — Base first, then the phases under "Phases".
- Arrows: one drawn arrow for every open/closed and sort arrow in LH Studio (concept page, To-do,
  Creator, Comments, Projects, Calculator, Email list, select fields) — the ▴ / ▾ symbols came
  out in two sizes on iPhone.
- Data: run the @lynnhoa concept SQL (Phase 1) once — safe to rerun, ends with a check. Home's era
  groups become "Eras: on you" · "Eras: on your body" · "Eras: in your head"; Appointments &
  results and Shoot day move into Base (blocks 6 and 7 — tagged ideas and Now move along) and
  Home's text drops "maintenance"; arcs 6–8 are The Obsession · The Story · The Editorial; Today's
  look is Today's outfit. Keys and numbers stay, so every link holds.
- Changed: `PlannerConcept.tsx`, `PlannerWindows.tsx`, `PlannerCreator.tsx`, `planner.ts`, `atoms.tsx`,
  `PlannerTodo.tsx`, `CreatorProjects.tsx`, `CreatorWorkspace.tsx`, `Comments.tsx`, `ProjectsTab.tsx`,
  `ProjectCard.tsx`, `Calculator.tsx`, `EmailList.tsx`.

# Planner · @lynnhoa concept: Base tab (24.10.2026)
- Content concept switch: Base | Phases | Arcs (still opens on Arcs).
- Base (sage): what's always there, under every phase — five numbered cards (Signatures, Today's
  look, New in, Thoughts, Trends). Open: what it is, its lines in sections (label black, how it
  shows in grey) and its core arcs as small pills. "lines · 20" opens one window with a list per
  section (add, change, ✕ with Undo, saved right away); an empty block shows "+ Add a line".
  The old block window inside Phases is gone (one level less).
- Phases: Base left the list. "Home eras" is "Home" again and the phases are 1–6:
  Home · Occasion · Invited · City break · Long trip · Brand partner.
- Base has number 0, shown as "Base" (never a number): first in the Phase pickers of the idea
  window and Creator › Now (then Block), and in Saved ideas.
- Data: run the @lynnhoa concept base SQL once (replaces the home phases SQL; fine from any earlier
  state, safe to rerun). It allows 0, splits Home if that hasn't happened, adds the base lines to
  empty blocks, moves Base to 0 and the phases back to 1–6 — tagged ideas and Now move along.
- Changed: `planner.ts`, `usePlanner.ts`, `PlannerConcept.tsx`, `PlannerWindows.tsx`, `PlannerCreator.tsx`.

# Planner · @lynnhoa concept: Home base lines (23.10.2026)
- A Home base block's window starts with its lines, in sections: Signatures has Rituals · Things
  you're never without · How you look · Your rules (20 lines), Thoughts its six topics. Each line is
  "label · how it shows": the label black, how it shows in grey under it. The core arcs follow
  ("Arcs · 3", expand all next to it).
- "edit" next to "Lines · 20" turns the sections into lists (add, change, ✕ with Undo, saved right
  away); "done" goes back to reading. An empty block (Today's look, New in, Trends) opens straight
  on "+ Add a line". Era windows are unchanged.
- Signatures' summary now names "Miu Miu sunglasses on your head".
- Data: the same SQL as the home phases, now with the lines — one SQL for both. It adds the lines
  only to a block that has none (never over what you wrote in the app), an `updated_at` field and
  permission to save your own phases.
- Changed: `planner.ts`, `usePlanner.ts`, `PlannerConcept.tsx`.

# Planner · @lynnhoa concept: Home base + Home eras (23.10.2026)
- Home is two phases now. 1 · Home base: what's always there — Signatures, Today's look, New in,
  Thoughts, Trends (its card says "Base · 5"). 2 · Home eras: 14 eras under five group headings
  (Moments · Maintenance · On you · On your body · In your head). Occasion … Brand partner are 3–7.
- Creator › Now: with Home base and no block picked ("All blocks") the card lists the five blocks —
  their ideas, or "+ Add an idea" for an empty block (the new idea gets the phase and the block).
  Pick a block to see its arcs as before. Use now › moves a saved idea into the base.
- Idea window: for Home base the second field says Block; the era picker shows the group headings.
- Data: run the @lynnhoa home phases SQL once — two new things on `planner_concept_phases` (a phase's
  `unit`, an era's `grp`), the two home phases, and the move: your tagged ideas and the Now card go
  one phase up, the old Home eras map to the new ones (After a trip → Coming home, Maintenance →
  Appointments & results, Dreaming → Prep for the next trip, Normal day → Home base). Safe to rerun:
  the move happens only the first time.
- Changed: `planner.ts`, `usePlanner.ts`, `PlannerConcept.tsx`, `PlannerWindows.tsx`, `PlannerCreator.tsx`.

# Planner · Content concept: Phases | Arcs (23.10.2026)
- The switch under "Content concept" (@lynnhoa) is now Phases | Arcs, with Phases first.
- It always opens on Arcs. Phases shows when you tap it; the last choice is no longer remembered.
- Changed: `PlannerConcept.tsx`.

# Planner · @createbylynn content concept (23.10.2026)
- Profile menu › "@createbylynn concept": Hair | Makeup & skincare | Both under the title (remembered
  on this device), one section per arc (Look · Product · Personality · Editorial), one card per series,
  numbered 1, 2, 3 … in each arc. Open: what the series is and its labels (Look) or texts; a journey's
  texts show their step ("1 · …"), views stay grey ("(1.531)"). "labels · 9" / "texts · 6" and "links"
  open the same windows as an arc's texts and links (Undo, saved right away). "expand all / collapse
  all" works on the chosen category. iPad / computer: two columns per arc.
- @lynnhoa is unchanged (Arcs | Phases).
- Idea window (@createbylynn): one field, Series, grouped by category · arc (no phase, era or format).
  A name used in two categories says which: "Techniques (hair)" · "Techniques (makeup)".
- Creator lists (@createbylynn): an idea with a series shows it first in its small line
  ("Hairstyles · Content").
- Data: run the @createbylynn concept SQL once — two new fields on `planner_concept_arcs` (category,
  arc; empty on the @lynnhoa arcs) and the 22 series with their 129 labels and texts. Safe to rerun:
  it never overwrites what's written in the app.
- Changed: `planner.ts`, `usePlanner.ts`, `PlannerConcept.tsx`, `PlannerWindows.tsx`, `PlannerCreator.tsx`.

# Phase 4 · Clean-up · one way for every sheet (23.10.2026)
- Every sheet stays still with the iPhone keyboard by itself now: the old keyboard code is gone
  (`useKeyboardInset`, the sheet's keyboard padding and height changes) and so is the `still`
  switch on each window. Nothing changes on screen (same positions in every check).
- Changed: `atoms.tsx` and the windows that had `still`: `EmailList.tsx`, `EmailKit.tsx`,
  `Comments.tsx`, `PlannerWindows.tsx`, `PlannerConcept.tsx`, `ServiceCatalog.tsx`, `CreatorWorkspace.tsx`.

# Phase 3 · Manager + Creator · smooth with the keyboard (23.10.2026)
- Catalog item, Usage / exclusivity, Card settings and Workspace item stay still with the iPhone
  keyboard (Sheet `still`): iPhone scrolls the screen itself in one smooth move.
- New item / new option → Add already stays the same window (checked).
- Every sheet in the app is still now. Changed: `ServiceCatalog.tsx`, `CreatorWorkspace.tsx`.

# Phase 2 · Planner · smooth with the keyboard (23.10.2026)
- Idea / Editorial, Arc texts / links, Era, Sprint and New sprint stay still with the iPhone keyboard
  (Sheet `still`): iPhone scrolls the screen itself in one smooth move.
- New sprint → Start sprint already stays the same window (checked).
- Changed: `PlannerWindows.tsx`, `PlannerConcept.tsx`.

# Phase 1 · Email kit + Comments · smooth with the keyboard (23.10.2026)
- Media kits, Template, New template and Add comments stay still with the iPhone keyboard (Sheet
  `still`, as on the Contacts tab): iPhone scrolls the screen itself in one smooth move.
- Add template: the same window becomes the saved template (no close + reopen blink); the kit picked
  in the new template stays.
- Changed: `EmailKit.tsx`, `Comments.tsx`.

# Contacts tab · smooth with the keyboard (23.10.2026)
- Contact, New contact, Log pitch, Import and Filter don't move or resize with the iPhone keyboard
  any more (Sheet `still`): iPhone scrolls the screen itself, in one smooth move. The title stays,
  no strip of the page shows, nothing jumps back when the keyboard closes. While typing, the
  footer waits under the keyboard (tap ✓). The other windows are unchanged for now.
- Add contact: the same window becomes the saved contact (no close + reopen blink).
  "Open that contact" (same email) still opens a fresh window with that contact's own values.
- Changed: `atoms.tsx` (`useKeyboardInset(on)`, Sheet `still`), `EmailList.tsx`.

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
