-- LH Studio · Planner › Manager → Sales · this week: Collabs and UGC (11.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once.
--   Pitches and Leads become two categories, each with its own line:
--     Collabs (@lynnhoa: brand collaborations)   Pitches · Collabs · Leads · Collabs
--     UGC     (@createbylynn: content for brands) Pitches · UGC     · Leads · UGC
--   The numbers count themselves from Outreach (no typing). Goals: Edit goals, per Pitches line.
-- Your existing lines keep their goals and history: @lynnhoa's Pitches / Leads become the Collabs
-- lines, @createbylynn's the UGC lines (a line for both accounts becomes Collabs). A category with
-- no line yet gets a copy of the other one (no goal; set it in Edit goals).

-- 1) If the table only allows known sources, allow the four new ones too
do $$
declare c record; d text;
begin
  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
            where conrelid = 'public.planner_tasks'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%source%' and pg_get_constraintdef(oid) ilike '%''pitches''%'
              and pg_get_constraintdef(oid) not ilike '%pitches_collab%' loop
    d := replace(c.def, '''pitches''::text', '''pitches''::text, ''pitches_collab''::text, ''pitches_ugc''::text');
    d := replace(d, '''leads''::text', '''leads''::text, ''leads_collab''::text, ''leads_ugc''::text');
    if d = c.def then
      d := replace(c.def, '''pitches''', '''pitches'', ''pitches_collab'', ''pitches_ugc''');
      d := replace(d, '''leads''', '''leads'', ''leads_collab'', ''leads_ugc''');
    end if;
    execute format('alter table public.planner_tasks drop constraint %I', c.conname);
    execute format('alter table public.planner_tasks add constraint %I %s', c.conname, d);
  end loop;
end $$;

-- 2) The existing lines become their category's line (same row: goals and history stay)
update public.planner_tasks
   set source  = case when account = 'createbylynn' then 'pitches_ugc' else 'pitches_collab' end,
       title   = case when account = 'createbylynn' then 'Pitches · UGC' else 'Pitches · Collabs' end,
       account = case when account = 'createbylynn' then 'createbylynn' else 'lynnhoa' end,
       measure = coalesce(nullif(measure, ''), 'pitches')            -- a goal line needs a measure to show "reached"
 where source = 'pitches';
update public.planner_tasks
   set source  = case when account = 'createbylynn' then 'leads_ugc' else 'leads_collab' end,
       title   = case when account = 'createbylynn' then 'Leads · UGC' else 'Leads · Collabs' end,
       account = case when account = 'createbylynn' then 'createbylynn' else 'lynnhoa' end,
       measure = coalesce(nullif(measure, ''), 'leads')
 where source = 'leads';

-- 3) A category without its line gets a copy of the other category's line (no goal yet)
insert into public.planner_tasks (user_id, account, stage_num, phase, owner, rhythm, area, title, how, done_when, measure, source, target, link, status, sort, active)
select distinct on (o.user_id, v.to_source)
       o.user_id, v.to_account, o.stage_num, o.phase, o.owner, o.rhythm, o.area, v.to_title, o.how, o.done_when,
       coalesce(nullif(o.measure, ''), v.measure), v.to_source, null, o.link, 'open', o.sort, true
  from public.planner_tasks o
  join (values
    ('pitches_collab', 'pitches_ugc',    'createbylynn', 'Pitches · UGC',     'pitches'),
    ('pitches_ugc',    'pitches_collab', 'lynnhoa',      'Pitches · Collabs', 'pitches'),
    ('leads_collab',   'leads_ugc',      'createbylynn', 'Leads · UGC',       'leads'),
    ('leads_ugc',      'leads_collab',   'lynnhoa',      'Leads · Collabs',   'leads')
  ) as v(from_source, to_source, to_account, to_title, measure) on o.source = v.from_source
 where not exists (select 1 from public.planner_tasks n where n.user_id = o.user_id and n.source = v.to_source)
 order by o.user_id, v.to_source, o.sort;

-- Check: four lines per user
select account, source, title, measure, active from public.planner_tasks
 where source in ('pitches_collab', 'leads_collab', 'pitches_ugc', 'leads_ugc') order by user_id, source;
