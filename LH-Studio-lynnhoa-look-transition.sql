-- LH Studio · Planner · @lynnhoa concept → The Look gets Transition (06.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once: it adds Transition only
-- when The Look doesn't have it yet (last in its list, not a main format, TikTok + Instagram).

update public.planner_concept_arcs
   set formats = coalesce(formats, '[]'::jsonb)
                 || '[{"name":"Transition","main":false,"tt":true,"ig":true}]'::jsonb,
       updated_at = now()
 where account = 'lynnhoa'
   and lower(trim(name)) = 'the look'
   and not exists (select 1 from jsonb_array_elements(coalesce(formats, '[]'::jsonb)) f
                    where lower(trim(f->>'name')) = 'transition');

-- Check: The Look · its formats (* = main)
select num, name,
       (select string_agg(f->>'name' || case when (f->>'main')::boolean then ' *' else '' end, ' · ' order by o)
          from jsonb_array_elements(formats) with ordinality t(f, o)) as formats
  from public.planner_concept_arcs where account = 'lynnhoa' and lower(trim(name)) = 'the look';
