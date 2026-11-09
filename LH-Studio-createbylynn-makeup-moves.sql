-- LH Studio · Planner · @createbylynn concept → the Makeup looks series is called Makeup moves (09.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once: it only renames the Looks series that
-- is still called Makeup looks (or Season looks). Items keep pointing at the arc by id, nothing else moves.

update public.planner_concept_arcs
   set name = 'Makeup moves',
       purpose = 'the always: overline, blush, wet lashes, the lip combo',
       updated_at = now()
 where account = 'createbylynn'
   and pillar = 'makeup_looks'
   and lower(trim(name)) in ('makeup looks', 'season looks');

-- Check: the two Looks series — num · name · purpose
select num, name, purpose from public.planner_concept_arcs
 where account = 'createbylynn' and pillar in ('makeup_looks', 'hair_styles') order by num;
