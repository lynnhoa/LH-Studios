-- LH Studio · Service Catalog › UGC: Creative Direction (12.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once.
--   1) A new section "Creative Direction" on the UGC card, before Packages, with two flat fees:
--        Look board      · Creative direction                                   €800
--        Campaign idea   · Concept + creative direction · look board included   €1,600
--      They are add-ons: a flat fee, never × usage rights / exclusivity, and they can be added
--      on top of any UGC item in the Calculator.
--   2) Built into the packages: Feed Takeover gets the Look board, Launch Campaign the Campaign idea.
--      The package keeps its own price for the content (2,810 / 5,100); the rate card and the
--      Calculator tile show it with the built-in fee (3,610 / 6,700).
-- Works on the UGC card you already have (rate_cards, category_key 'ugc'); packages are found by name.

-- 1) the Creative Direction section, before the first Packages section (only if it isn't there yet)
update public.rate_cards r
   set sections = (
     select jsonb_agg(x.elem order by x.pos)
       from (
         select s.elem, s.ord::numeric as pos
           from jsonb_array_elements(r.sections::jsonb) with ordinality s(elem, ord)
         union all
         select jsonb_build_object(
                  't', 'Creative Direction',
                  'kind', 'addons',
                  'items', jsonb_build_array(
                    jsonb_build_object('id', 'ucd1', 'n', 'Look board', 'note', 'Creative direction',
                      'p', 800, 'pct', null, 'perMonth', false, 'info', false, 'work', false),
                    jsonb_build_object('id', 'ucd2', 'n', 'Campaign idea', 'note', 'Concept + creative direction · look board included',
                      'p', 1600, 'pct', null, 'perMonth', false, 'info', false, 'work', false))),
                coalesce((select min(p.ord) from jsonb_array_elements(r.sections::jsonb) with ordinality p(e, ord)
                           where p.e->>'kind' = 'packages' or (p.e->>'kind' is null and p.e->>'t' ilike '%package%')), 100000) - 0.5
       ) x
   )
 where r.category_key = 'ugc'
   and jsonb_typeof(r.sections::jsonb) = 'array'
   and not exists (select 1 from jsonb_array_elements(r.sections::jsonb) e where e->>'t' = 'Creative Direction');

-- 2) built into the packages (by name; their own price stays the content part)
update public.rate_cards r
   set sections = (
     select jsonb_agg(
              case when s.elem->>'kind' = 'packages' or (s.elem->>'kind' is null and s.elem->>'t' ilike '%package%') then
                jsonb_set(s.elem, '{items}', coalesce((
                  select jsonb_agg(
                           case lower(trim(it->>'n'))
                             when 'feed takeover'   then it || jsonb_build_object('withAddons', jsonb_build_array('ucd1'))
                             when 'launch campaign' then it || jsonb_build_object('withAddons', jsonb_build_array('ucd2'))
                             else it end
                           order by io)
                    from jsonb_array_elements(coalesce(s.elem->'items', '[]'::jsonb)) with ordinality i(it, io)), '[]'::jsonb))
              else s.elem end
              order by s.ord)
       from jsonb_array_elements(r.sections::jsonb) with ordinality s(elem, ord)
   )
 where r.category_key = 'ugc'
   and jsonb_typeof(r.sections::jsonb) = 'array';

-- Check: the UGC packages, their own price and the price the rate card shows
select it->>'n' as package, (it->>'p')::numeric as content_price, it->'withAddons' as built_in,
       (it->>'p')::numeric + case it->'withAddons'->>0 when 'ucd1' then 800 when 'ucd2' then 1600 else 0 end as shown_price
  from public.rate_cards r,
       jsonb_array_elements(r.sections::jsonb) s(elem),
       jsonb_array_elements(coalesce(s.elem->'items', '[]'::jsonb)) it
 where r.category_key = 'ugc' and (s.elem->>'kind' = 'packages' or s.elem->>'t' ilike '%package%');
