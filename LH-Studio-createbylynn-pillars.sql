-- LH Studio · Planner · @createbylynn concept → 5 pillars · arcs · formats (27.10.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once: as soon as your arcs have
-- their pillar, it changes nothing. Season looks and Hairstyles keep their texts, links and ideas
-- exactly as they are; every other text, link and idea moves with its series.

-- 1) A copy of today's @createbylynn series (made the first time only, kept, not readable from the app)
create table if not exists public.planner_concept_arcs_cbl_backup as
  select * from public.planner_concept_arcs where account = 'createbylynn';
alter table public.planner_concept_arcs_cbl_backup enable row level security;

-- 2) The pillar an arc sits in (stays empty on @lynnhoa's arcs)
alter table public.planner_concept_arcs add column if not exists pillar text;
alter table public.planner_concept_arcs drop constraint if exists planner_concept_arcs_pillar;
alter table public.planner_concept_arcs add constraint planner_concept_arcs_pillar check (
  pillar is null or pillar in ('makeup_looks','hair_styles','products','personality','editorial'));

-- helpers for this run only (gone when the session ends)
-- two lists as one, in order, each line once
create or replace function pg_temp.cbl_join(a jsonb, b jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(v order by o), '[]'::jsonb) from (
    select distinct on (v) v, o from (
      select v, o from jsonb_array_elements(coalesce(a, '[]'::jsonb)) with ordinality t(v, o)
      union all
      select v, o + 100000 from jsonb_array_elements(coalesce(b, '[]'::jsonb)) with ordinality t(v, o)
    ) s order by v, o
  ) d
$$;
-- the Journey's texts of one step, without their "1 · " (a text without a step counts as step 1)
create or replace function pg_temp.cbl_step(texts jsonb, step int) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(to_jsonb(regexp_replace(t, '^\s*\d+\s*·\s*', '')) order by o), '[]'::jsonb)
  from (
    select t, o, coalesce(substring(t from '^\s*(\d+)\s*·')::int, 1) as s
    from jsonb_array_elements_text(coalesce(texts, '[]'::jsonb)) with ordinality x(t, o)
  ) y
  where (case when s between 1 and 5 then s else 1 end) = step
$$;
-- one arc: the series it comes from gets its new place (or a new row when there is none);
-- keep = its texts and links stay exactly as they are · ex = the first text when it would be empty
create or replace function pg_temp.cbl_put(u uuid, src uuid, n int, pil text, nm text, pur text, fm jsonb,
  tx jsonb, lk jsonb, keep boolean, ex jsonb) returns uuid language plpgsql as $$
declare rid uuid; t jsonb := case when jsonb_array_length(coalesce(tx, '[]'::jsonb)) = 0 then ex else tx end;
begin
  if src is not null then
    update public.planner_concept_arcs
       set num = n, pillar = pil, name = nm, purpose = pur, formats = fm, category = null, arc = null,
           texts = case when keep then texts else t end,
           links = case when keep then links else coalesce(lk, '[]'::jsonb) end,
           updated_at = now()
     where id = src returning id into rid;
  else
    insert into public.planner_concept_arcs (user_id, account, num, name, purpose, formats, texts, links, pillar)
    values (u, 'createbylynn', n, nm, pur, fm, case when keep then '[]'::jsonb else t end, coalesce(lk, '[]'::jsonb), pil)
    returning id into rid;
  end if;
  return rid;
end $$;

-- 3) Your series → the 15 arcs of the 5 pillars (each login with @createbylynn series, once)
do $$
declare
  u uuid;
  r_season uuid; r_hair uuid; r_journey uuid; r_opinion uuid; r_spot uuid; r_ps uuid; r_lists uuid;
  r_sign uuid; r_hot uuid; r_grwm uuid; r_me uuid; r_mantra uuid; r_over uuid; r_call uuid; r_edit uuid;
  a_season uuid; a_hair uuid; a_looks uuid; a_rel uuid;
  j jsonb;
  txt jsonb; lnk jsonb;
begin
  for u in select distinct user_id from public.planner_concept_arcs where account = 'createbylynn' loop
    continue when exists (select 1 from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and pillar is not null);

    -- free the numbers 1, 2, 3 … (the old series move to 1001 … until they're placed)
    update public.planner_concept_arcs set num = num + 1000 where user_id = u and account = 'createbylynn' and num < 1000;

    -- the series, by where they sat and their name
    select id into r_season  from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and category = 'makeup' and arc = 'look' and name ilike 'season%' order by num limit 1;
    select id into r_hair    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and category = 'hair'   and arc = 'look' and name ilike 'hairstyle%' order by num limit 1;
    select id into r_journey from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'product' and name ilike 'journey%' order by num limit 1;
    select id into r_opinion from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'product' and name ilike 'opinion%' order by num limit 1;
    select id into r_spot    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'product' and name ilike 'spotlight%' order by num limit 1;
    select id into r_ps      from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'product' and name ilike 'problem%' order by num limit 1;
    select id into r_lists   from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'product' and name ilike 'list%' order by num limit 1;
    select id into r_sign    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ilike '%sign to%' order by num limit 1;
    select id into r_hot     from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ilike 'hot take%' order by num limit 1;
    select id into r_grwm    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ilike 'getting%' order by num limit 1;
    select id into r_me      from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ~* '^[^a-z]*me[^a-z]' order by num limit 1;
    select id into r_mantra  from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ilike 'mantra%' order by num limit 1;
    select id into r_over    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ilike 'overdoer%' order by num limit 1;
    select id into r_call    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'personality' and name ilike 'callback%' order by num limit 1;
    select id into r_edit    from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and arc = 'editorial' order by num limit 1;
    select texts into j from public.planner_concept_arcs where id = r_journey;

    -- 1 Make up looks · 2 Hair styles: texts and links stay exactly as they are
    a_season := pg_temp.cbl_put(u, r_season, 1, 'makeup_looks', 'Season looks', 'growth, the base',
      '[{"name":"named looks per season"}]', null, null, true, '[]');
    a_hair := pg_temp.cbl_put(u, r_hair, 2, 'hair_styles', 'Hairstyles', 'growth, your strongest',
      '[{"name":"one hairstyle per video"}]', null, null, true, '[]');

    -- 3 Products: the journey (its steps split up) + product listing
    perform pg_temp.cbl_put(u, r_journey, 3, 'products', 'Receiving', 'curiosity',
      '[{"name":"unboxing"},{"name":"PR reveal"},{"name":"first reaction"}]',
      pg_temp.cbl_step(j, 1), (select links from public.planner_concept_arcs where id = r_journey), false, '["it''s finally here"]');
    perform pg_temp.cbl_put(u, r_spot, 4, 'products', 'Try-on', 'interest',
      '[{"name":"swatches"},{"name":"try-on list"},{"name":"“the perfect ___”"}]',
      pg_temp.cbl_join((select texts from public.planner_concept_arcs where id = r_spot), pg_temp.cbl_step(j, 2)),
      (select links from public.planner_concept_arcs where id = r_spot), false, '["trying every shade so you don''t have to"]');
    perform pg_temp.cbl_put(u, r_ps, 5, 'products', 'Problem → solution', 'trust',
      '[{"name":"want → so-i voiceover"},{"name":"before / after"}]',
      (select texts from public.planner_concept_arcs where id = r_ps), (select links from public.planner_concept_arcs where id = r_ps),
      false, '["my skin is quite matte but i love the glowy look so…"]');
    perform pg_temp.cbl_put(u, r_opinion, 6, 'products', 'Opinion', 'trust',
      '[{"name":"verdict"},{"name":"worth it?"},{"name":"vs dupe"}]',
      pg_temp.cbl_join(pg_temp.cbl_join((select texts from public.planner_concept_arcs where id = r_opinion), pg_temp.cbl_step(j, 3)), pg_temp.cbl_step(j, 5)),
      (select links from public.planner_concept_arcs where id = r_opinion), false, '["worth it? honestly…"]');
    a_looks := pg_temp.cbl_put(u, null, 7, 'products', 'In my looks', 'it stays',
      '[{"name":"a look or GRWM with it"},{"name":"“still using it”"}]',
      pg_temp.cbl_join(pg_temp.cbl_step(j, 4), (select texts from public.planner_concept_arcs where id = r_call)),
      (select links from public.planner_concept_arcs where id = r_call), false, '["the gloss again, obviously"]');
    perform pg_temp.cbl_put(u, r_lists, 8, 'products', 'Product listing', 'several products',
      '[{"name":"lists"},{"name":"favourites"},{"name":"empties"}]',
      (select texts from public.planner_concept_arcs where id = r_lists), (select links from public.planner_concept_arcs where id = r_lists),
      false, '["5 things that are worth the money"]');

    -- 4 Personality
    txt := pg_temp.cbl_join(pg_temp.cbl_join((select texts from public.planner_concept_arcs where id = r_me),
             (select texts from public.planner_concept_arcs where id = r_over)), (select texts from public.planner_concept_arcs where id = r_grwm));
    lnk := pg_temp.cbl_join(pg_temp.cbl_join((select links from public.planner_concept_arcs where id = r_me),
             (select links from public.planner_concept_arcs where id = r_over)), (select links from public.planner_concept_arcs where id = r_grwm));
    a_rel := pg_temp.cbl_put(u, r_me, 9, 'personality', 'Relatable', 'shares',
      '[{"name":"me…"},{"name":"overdoer"},{"name":"getting-ready POVs"}]', txt, lnk, false,
      '["me everytime i get home because my hair overstimulates me"]');
    perform pg_temp.cbl_put(u, r_hot, 10, 'personality', 'Opinion', 'comments', '[{"name":"hot takes"}]',
      (select texts from public.planner_concept_arcs where id = r_hot), (select links from public.planner_concept_arcs where id = r_hot),
      false, '["i could never understand people who don''t overline"]');
    perform pg_temp.cbl_put(u, r_sign, 11, 'personality', 'Sign', 'a nudge', '[{"name":"your sign to…"}]',
      (select texts from public.planner_concept_arcs where id = r_sign), (select links from public.planner_concept_arcs where id = r_sign),
      false, '["your sign to finally try a darker lip"]');
    perform pg_temp.cbl_put(u, r_mantra, 12, 'personality', 'Mantra', 'mood, identity', '[{"name":"mantras"},{"name":"manifesting…"}]',
      (select texts from public.planner_concept_arcs where id = r_mantra), (select links from public.planner_concept_arcs where id = r_mantra),
      false, '["manifesting clear skin","get money stay pretty"]');

    -- 5 Editorial
    perform pg_temp.cbl_put(u, r_edit, 13, 'editorial', 'Editorial worlds', 'portfolio', '[{"name":"mood worlds"},{"name":"ironic concepts"}]',
      (select texts from public.planner_concept_arcs where id = r_edit), (select links from public.planner_concept_arcs where id = r_edit),
      false, '["red lip × tennis"]');
    perform pg_temp.cbl_put(u, null, 14, 'editorial', 'pov: you hired me', 'booking proof', '[{"name":"brief → BTS → finished campaign"}]',
      null, null, false, '["pov: you hired me to create your launch"]');
    perform pg_temp.cbl_put(u, null, 15, 'editorial', 'What you see vs what I see', 'curiosity', '[{"name":"awkward BTS vs the finished shot"}]',
      null, null, false, '["what you see me doing vs what i see"]');

    -- ideas tagged with a series that goes: to its new arc
    update public.planner_items set plan = jsonb_set(plan, '{arc}', to_jsonb(a_hair::text))
     where user_id = u and plan->>'arc' in (select id::text from public.planner_concept_arcs
       where user_id = u and account = 'createbylynn' and pillar is null and category = 'hair');
    update public.planner_items set plan = jsonb_set(plan, '{arc}', to_jsonb(a_season::text))
     where user_id = u and plan->>'arc' in (select id::text from public.planner_concept_arcs
       where user_id = u and account = 'createbylynn' and pillar is null and category = 'makeup');
    update public.planner_items set plan = jsonb_set(plan, '{arc}', to_jsonb(a_rel::text))
     where user_id = u and plan->>'arc' in (coalesce(r_over::text, '-'), coalesce(r_grwm::text, '-'));
    update public.planner_items set plan = jsonb_set(plan, '{arc}', to_jsonb(a_looks::text))
     where user_id = u and plan->>'arc' = coalesce(r_call::text, '-');

    -- the series that aren't arcs any more (their texts and links moved above; the copy keeps them all)
    delete from public.planner_concept_arcs where user_id = u and account = 'createbylynn' and pillar is null;
  end loop;
end $$;

-- 4) Supabase sees the new column right away
notify pgrst, 'reload schema';

-- Check: 15 rows — pillar · number · arc · how many texts and links
select pillar, num, name, jsonb_array_length(texts) as texts, jsonb_array_length(links) as links
  from public.planner_concept_arcs where account = 'createbylynn' order by num;
