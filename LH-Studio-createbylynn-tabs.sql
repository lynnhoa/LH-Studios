-- LH Studio · Planner · @createbylynn concept → one roof, four tabs (07.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once: an arc is found by its old or
-- its new name, so a second run changes nothing.
--   Base      ← personality:  Relatable · Opinion & thoughts [was Opinion] · Sign · Mantra
--   Looks     ← makeup_looks + hair_styles: Makeup looks [was Season looks] · Hairstyles
--   Products  ← products: Receiving · Try-on · Problem → solution · Verdict [was Opinion] ·
--               In rotation [was In my looks] · Roundups [was Product listing]
--   Editorial ← editorial: one arc, Editorial [was Editorial worlds]; "pov: you hired me" and
--               "What you see vs what I see" go — their ideas move to Editorial.
-- Every arc keeps its texts, links and ideas. Numbers follow the tabs: 1–4 Base · 5–6 Looks ·
-- 7–12 Products · 13 Editorial.

-- 1) A copy of today's @createbylynn arcs (made the first time only, kept, not readable from the app)
create table if not exists public.planner_concept_arcs_cbl_tabs_backup as
  select * from public.planner_concept_arcs where account = 'createbylynn';
alter table public.planner_concept_arcs_cbl_tabs_backup enable row level security;

-- helper for this run only: one arc by its pillar and one of its names (old or new)
create or replace function pg_temp.cbl_find(u uuid, pil text, names text[]) returns uuid language sql stable as $$
  select id from public.planner_concept_arcs
   where user_id = u and account = 'createbylynn' and pillar = pil and lower(trim(name)) = any(names)
   order by num limit 1
$$;

do $$
declare
  u uuid;
  r_rel uuid; r_op uuid; r_sign uuid; r_mantra uuid; r_look uuid; r_hair uuid;
  r_recv uuid; r_try uuid; r_ps uuid; r_verd uuid; r_rot uuid; r_round uuid; r_ed uuid;
  extra uuid[];
  n int;
  rec record;
begin
  for u in select distinct user_id from public.planner_concept_arcs where account = 'createbylynn' and pillar is not null loop
    r_rel    := pg_temp.cbl_find(u, 'personality',  array['relatable']);
    r_op     := pg_temp.cbl_find(u, 'personality',  array['opinion', 'opinion & thoughts']);
    r_sign   := pg_temp.cbl_find(u, 'personality',  array['sign']);
    r_mantra := pg_temp.cbl_find(u, 'personality',  array['mantra']);
    r_look   := pg_temp.cbl_find(u, 'makeup_looks', array['season looks', 'makeup looks']);
    r_hair   := pg_temp.cbl_find(u, 'hair_styles',  array['hairstyles']);
    r_recv   := pg_temp.cbl_find(u, 'products',     array['receiving']);
    r_try    := pg_temp.cbl_find(u, 'products',     array['try-on']);
    r_ps     := pg_temp.cbl_find(u, 'products',     array['problem → solution']);
    r_verd   := pg_temp.cbl_find(u, 'products',     array['opinion', 'verdict']);
    r_rot    := pg_temp.cbl_find(u, 'products',     array['in my looks', 'in rotation']);
    r_round  := pg_temp.cbl_find(u, 'products',     array['product listing', 'roundups']);
    r_ed     := pg_temp.cbl_find(u, 'editorial',    array['editorial worlds', 'editorial']);
    if r_ed is null then   -- no Editorial worlds: the first editorial arc becomes Editorial
      select id into r_ed from public.planner_concept_arcs
       where user_id = u and account = 'createbylynn' and pillar = 'editorial' order by num limit 1;
    end if;

    -- 2) Editorial becomes one arc: the other editorial arcs' ideas move to it, then they go
    if r_ed is not null then
      select coalesce(array_agg(id), '{}') into extra from public.planner_concept_arcs
       where user_id = u and account = 'createbylynn' and pillar = 'editorial' and id <> r_ed;
      update public.planner_items set plan = jsonb_set(plan - 'arcFormat', '{arc}', to_jsonb(r_ed::text))
       where user_id = u and plan->>'arc' = any(select x::text from unnest(extra) x);
      delete from public.planner_concept_arcs where id = any(extra);
      -- its one format is Own Shoots: an idea on it with another format keeps the arc, not the format
      update public.planner_items set plan = plan - 'arcFormat'
       where user_id = u and plan->>'arc' = r_ed::text and coalesce(plan->>'arcFormat', 'Own Shoots') <> 'Own Shoots';
    end if;

    -- 3) free the numbers, then number the arcs by tab
    update public.planner_concept_arcs set num = num + 1000 where user_id = u and account = 'createbylynn' and num < 1000;
    update public.planner_concept_arcs set num = 1,  updated_at = now() where id = r_rel;
    update public.planner_concept_arcs set num = 2,  name = 'Opinion & thoughts', updated_at = now(),
           formats = case when exists (select 1 from jsonb_array_elements(coalesce(formats, '[]'::jsonb)) f where lower(f->>'name') = 'random thoughts')
                          then formats else coalesce(formats, '[]'::jsonb) || '[{"name":"random thoughts"}]'::jsonb end
     where id = r_op;
    update public.planner_concept_arcs set num = 3,  updated_at = now() where id = r_sign;
    update public.planner_concept_arcs set num = 4,  updated_at = now() where id = r_mantra;
    update public.planner_concept_arcs set num = 5,  name = 'Makeup looks', purpose = 'the core', updated_at = now() where id = r_look;
    update public.planner_concept_arcs set num = 6,  purpose = 'your strongest', updated_at = now() where id = r_hair;
    update public.planner_concept_arcs set num = 7,  updated_at = now() where id = r_recv;
    update public.planner_concept_arcs set num = 8,  updated_at = now() where id = r_try;
    update public.planner_concept_arcs set num = 9,  updated_at = now() where id = r_ps;
    update public.planner_concept_arcs set num = 10, name = 'Verdict', updated_at = now() where id = r_verd;
    update public.planner_concept_arcs set num = 11, name = 'In rotation', updated_at = now() where id = r_rot;
    update public.planner_concept_arcs set num = 12, name = 'Roundups', updated_at = now() where id = r_round;
    update public.planner_concept_arcs set num = 13, name = 'Editorial', purpose = 'portfolio',
           formats = '[{"name":"Own Shoots","main":true}]'::jsonb, updated_at = now() where id = r_ed;
    -- any arc not named above keeps its place, after these
    n := 14;
    for rec in select id from public.planner_concept_arcs
                where user_id = u and account = 'createbylynn' and num >= 1000 order by num loop
      update public.planner_concept_arcs set num = n where id = rec.id;
      n := n + 1;
    end loop;
  end loop;
end $$;

-- Check: 13 rows — number · pillar · arc · purpose · formats · texts · links
select num, pillar, name, purpose,
       (select string_agg(f->>'name', ' · ' order by o) from jsonb_array_elements(formats) with ordinality t(f, o)) as formats,
       jsonb_array_length(texts) as texts, jsonb_array_length(links) as links
  from public.planner_concept_arcs where account = 'createbylynn' order by num;
