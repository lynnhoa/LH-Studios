-- LH Studio · Planner · @lynnhoa concept → How I … episodes, changed in the app (07.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once: it only adds an episode that
-- isn't there yet, so a title or hook you changed in the app is never overwritten.
-- One row per login · account · series chapter (the chapter's name as in the app). No history:
-- a change in the app replaces the row.

-- 1) The table
create table if not exists public.planner_concept_series (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account    text not null default 'lynnhoa' check (account in ('lynnhoa', 'createbylynn')),
  chapter    text not null,
  title      text not null default '',
  hook       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account, chapter)
);

-- 2) Each login reads and changes only its own episodes
alter table public.planner_concept_series enable row level security;
drop policy if exists "own episodes" on public.planner_concept_series;
create policy "own episodes" on public.planner_concept_series
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.planner_concept_series to authenticated;

-- 3) The starting episodes, for every login with @lynnhoa arcs (only where none is saved yet)
insert into public.planner_concept_series (user_id, account, chapter, title, hook)
select u.user_id, 'lynnhoa', e.chapter, e.title, e.hook
  from (select distinct user_id from public.planner_concept_arcs where account = 'lynnhoa') u
  cross join (values
    ('Maintenance',        'How I stay ready for anything',       'I''m high maintenance so I can be low maintenance'),
    ('Home Projects',      'How I set up my bathroom',            'My bathroom made my mornings complicated'),
    ('Wardrobe & Style',   'How I edit my wardrobe',              'I had no space for new clothes'),
    ('Beauty Projects',    'How I build my matching makeup sets', 'My drawer was messy and random, I had no favourites, and I stopped enjoying makeup'),
    ('Kits & Preparation', 'How I build my travel kit',           'I used to pack at 4 AM')
  ) as e(chapter, title, hook)
on conflict (user_id, account, chapter) do nothing;

-- 4) Supabase sees the new table right away
notify pgrst, 'reload schema';

-- Check: 5 rows — chapter · title · hook
select chapter, title, hook from public.planner_concept_series where account = 'lynnhoa' order by chapter;
