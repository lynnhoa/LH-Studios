-- LH Studio · Planner · @lynnhoa concept → the 9 arcs and their formats (06.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once.
-- Each arc keeps its texts and links (found by its name); The Edit is new (7), so The Story moves
-- to 8 and The Editorial to 9 — the eras' arc numbers follow, and ideas keep their arc (by id).
-- A format that existed before keeps its TikTok / Instagram ticks; a new one gets both.

-- 1) A copy of today's @lynnhoa arcs (made the first time only, kept, not readable from the app)
create table if not exists public.planner_concept_arcs_lh_backup as
  select * from public.planner_concept_arcs where account = 'lynnhoa';
alter table public.planner_concept_arcs_lh_backup enable row level security;

-- helper for this run only: "The Before" → "before"
create or replace function pg_temp.lh_key(n text) returns text language sql immutable as $$
  select lower(trim(regexp_replace(coalesce(n, ''), '^\s*the\s+', '', 'i')))
$$;

-- 2) The arcs, exactly as listed
do $$
declare
  u uuid;
  a record;
  f record;
  rid uuid;
  fm jsonb;
  old_fm jsonb;
  hit jsonb;
  nummap jsonb;
  arcs jsonb := $j$[
    {"num":1,"name":"The Before","purpose":"The build-up and anticipation before you go out.",
     "formats":[["GRWM Talking",true],["Voiceover",false],["Presence + Text",false],["Lip Sync Song",false],["TikTok Trends",false],["Transition",false]]},
    {"num":2,"name":"The Look","purpose":"Your fashion identity and what draws people in.",
     "formats":[["Outfit Check",true],["Walk + Text",false],["Transition",false]]},
    {"num":3,"name":"The Moment","purpose":"Being there and capturing the scene as it happens.",
     "formats":[["Walk + Text",true],["TikTok Trends",true],["Lip Sync Song",false],["Selfie Reaction",false],["Presence + Text",false]]},
    {"num":4,"name":"The Opinion","purpose":"Your point of view and honest judgments on things.",
     "formats":[["Presence + Text",true],["Question + Reply/Reaction",false],["Walk + Text",false],["Lip Sync Talk",false]]},
    {"num":5,"name":"The Personality","purpose":"Your quirks and humor that make you recognizable.",
     "formats":[["Lip Sync Talk",true],["Skits",true],["Selfie Reaction",false],["Presence + Text",false]]},
    {"num":6,"name":"The Obsession","purpose":"Your desires, fantasies and the things you can't stop wanting.",
     "formats":[["Presence + Text",true],["Lip Sync Song",true],["Voiceover",true],["Question + Reply/Reaction",false],["Selfie Reaction + Result",false]]},
    {"num":7,"name":"The Edit","purpose":"What you choose, why you choose it, and the result.",
     "formats":[["Seated Talking",true],["Half-Body Talking",true]]},
    {"num":8,"name":"The Story","purpose":"Real experiences with context, progression and a payoff.",
     "formats":[["Vlog",true],["GRWM Talking",false],["Voiceover",false],["Selfie Reaction + Result",false],["Presence + Text",false]]},
    {"num":9,"name":"The Editorial","purpose":"Creative campaigns and brand collaborations, kept separate.",
     "formats":[["Own Shoots",true]]}
  ]$j$::jsonb;
begin
  for u in select distinct user_id from public.planner_concept_arcs where account = 'lynnhoa' loop
    -- old number → arc id (to move the eras' numbers along)
    create temp table if not exists lh_old (id uuid, num int, name text, formats jsonb) on commit drop;
    delete from lh_old;
    insert into lh_old select id, num, name, coalesce(formats, '[]'::jsonb)
      from public.planner_concept_arcs where user_id = u and account = 'lynnhoa' and num < 1000;
    nummap := '{}'::jsonb;

    -- free the numbers 1 … 9
    update public.planner_concept_arcs set num = num + 1000 where user_id = u and account = 'lynnhoa' and num < 1000;

    for a in select * from jsonb_array_elements(arcs) loop
      select id, formats into rid, old_fm from lh_old
        where pg_temp.lh_key(name) = pg_temp.lh_key(a.value->>'name') order by num limit 1;

      -- formats in order; ticks: this arc's old format of that name, else any arc's, else both
      fm := '[]'::jsonb;
      for f in select x->>0 as nm, (x->>1)::boolean as main
                 from jsonb_array_elements(a.value->'formats') with ordinality t(x, o) order by o loop
        select v into hit from jsonb_array_elements(coalesce(old_fm, '[]'::jsonb)) v
          where lower(trim(v->>'name')) = lower(f.nm) limit 1;
        if hit is null then
          select v into hit from lh_old o, jsonb_array_elements(o.formats) v
            where lower(trim(v->>'name')) = lower(f.nm) order by o.num limit 1;
        end if;
        fm := fm || jsonb_build_array(jsonb_build_object(
          'name', f.nm, 'main', f.main,
          'tt', coalesce((hit->>'tt')::boolean, true),
          'ig', coalesce((hit->>'ig')::boolean, true)));
        hit := null;
      end loop;

      if rid is not null then
        update public.planner_concept_arcs
           set num = (a.value->>'num')::int, name = a.value->>'name', purpose = a.value->>'purpose',
               formats = fm, updated_at = now()
         where id = rid;
        nummap := nummap || jsonb_build_object((select num from lh_old where id = rid)::text, (a.value->>'num')::int);
      else
        insert into public.planner_concept_arcs (user_id, account, num, name, purpose, formats, texts, links)
        values (u, 'lynnhoa', (a.value->>'num')::int, a.value->>'name', a.value->>'purpose', fm, '[]'::jsonb, '[]'::jsonb);
      end if;
      rid := null; old_fm := null;
    end loop;

    -- arcs that aren't in the list any more (the copy keeps them); their ideas lose the arc
    update public.planner_items set plan = plan - 'arc' - 'arcFormat'
     where user_id = u and plan->>'arc' in (
       select id::text from public.planner_concept_arcs where user_id = u and account = 'lynnhoa' and num >= 1000);
    delete from public.planner_concept_arcs where user_id = u and account = 'lynnhoa' and num >= 1000;

    -- the eras' arc numbers follow their arc (7 → 8, 8 → 9; an arc that's gone leaves the era)
    update public.planner_concept_phases p
       set eras = (
         select coalesce(jsonb_agg(
                  jsonb_set(e, '{arcs}', (
                    select coalesce(jsonb_agg(jsonb_set(x, '{num}', nummap->(x->>'num')) order by o), '[]'::jsonb)
                      from jsonb_array_elements(coalesce(e->'arcs', '[]'::jsonb)) with ordinality t(x, o)
                     where nummap ? (x->>'num')))
                  order by eo), '[]'::jsonb)
           from jsonb_array_elements(p.eras) with ordinality s(e, eo)),
           updated_at = now()
     where p.user_id = u and p.account = 'lynnhoa' and jsonb_typeof(p.eras) = 'array';
  end loop;
end $$;

-- Check: 9 rows — number · arc · formats (* = main) · how many texts and links
select num, name,
       (select string_agg(f->>'name' || case when (f->>'main')::boolean then ' *' else '' end, ' · ' order by o)
          from jsonb_array_elements(formats) with ordinality t(f, o)) as formats,
       jsonb_array_length(texts) as texts, jsonb_array_length(links) as links
  from public.planner_concept_arcs where account = 'lynnhoa' order by num;
