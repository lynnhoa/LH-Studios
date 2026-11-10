-- LH Studio · Outreach › Email kit: sales documents + Canva links (10.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once.
--   1) a German link per kit (url_de) — the pitch decks have an EN and a DE version
--   2) if the kit keys are limited to the 4 media kits, allow the 4 sales documents too
--   3) the 4 sales documents, in the order of the sales process, with their Canva links:
--        1 · Pitching    Partnerships · Fashion (EN + DE) · Partnerships · Beauty (EN + DE)
--                        Content for Brands · Beauty (EN)
--        2 · Lead to won Feed Proposal (the template's edit link: a copy per brand)
--   4) the 4 media kits get their Canva view links (Collab · Editorial · Hotels · UGC)
-- For everyone who already has an Email kit. Links are set again on a rerun (the ones below);
-- Canva file names and focus of the media kits stay as you typed them.
-- In Canva each design must be shared "Anyone with the link can view" (Share → Access).

-- 1) the German link
alter table public.email_kits add column if not exists url_de text;

-- 2) kit keys: if a check limits them (key, or a template's kit_key) to the media kits, add the documents
do $$
declare c record; d text;
  add_keys text := '''ugc''::text, ''pitch_fashion''::text, ''pitch_beauty''::text, ''pitch_content''::text, ''proposal''::text';
begin
  for c in select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def from pg_constraint
            where conrelid in ('public.email_kits'::regclass, 'public.email_templates'::regclass) and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%''ugc''%' and pg_get_constraintdef(oid) ilike '%''hotels''%'
              and pg_get_constraintdef(oid) not ilike '%pitch_fashion%' loop
    d := replace(c.def, '''ugc''::text', add_keys);
    if d = c.def then d := replace(c.def, '''ugc''', '''ugc'', ''pitch_fashion'', ''pitch_beauty'', ''pitch_content'', ''proposal'''); end if;
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I %s', c.tbl, c.conname, d);
  end loop;
end $$;

-- 3) + 4) the documents and the links
insert into public.email_kits (user_id, key, url, url_de, canva_file, focus, updated_at)
select u.user_id, v.key, v.url, v.url_de, v.canva_file, v.focus, now()
  from (select distinct user_id from public.email_kits) u
 cross join (values
   ('pitch_fashion', 'https://www.canva.com/d/8HVhStn-KkTYnYN', 'https://www.canva.com/d/-SwZfkWY5y6kBZD', 'Lynn Hoa · Partnerships · Fashion',       'Pitch deck · normal collabs'),
   ('pitch_beauty',  'https://www.canva.com/d/tvvBKcLZzivcuCB', 'https://www.canva.com/d/sExFvQrf4cC1w8M', 'Lynn Hoa · Partnerships · Beauty',        'Pitch deck · normal collabs'),
   ('pitch_content', 'https://www.canva.com/d/58xXgzbFCpuNHdH', null,                                       'Lynn Hoa · Content for Brands · Beauty', 'Pitch deck · content production for brands'),
   ('proposal',      'https://www.canva.com/d/a-HlFkPoKMLXT8B', null,                                       'Feed Proposal · [Brand] · Template',      'Template · a copy per brand in Canva'),
   ('influencer',    'https://www.canva.com/d/A3VfUxZUKTl_cOd', null, 'LH-COLLAB', 'Fashion, Beauty & Lifestyle'),
   ('editorial',     'https://www.canva.com/d/bzeAuHqHgYP3QeN', null, 'LH-EDIT',   'Fashion, Beauty & Lifestyle'),
   ('hotels',        'https://www.canva.com/d/GSodIz6u_8jJKGZ', null, 'LH-HOSP',   'Hospitality'),
   ('ugc',           'https://www.canva.com/d/C0zeJFk4onxgQu0', null, 'UGC',       'Fashion & Beauty')
 ) as v(key, url, url_de, canva_file, focus)
on conflict (user_id, key) do update
   set url        = excluded.url,
       url_de     = coalesce(excluded.url_de, public.email_kits.url_de),
       updated_at = now();

-- Check: 8 rows per account, the documents first
select key, url, url_de, canva_file from public.email_kits
 order by user_id, array_position(array['pitch_fashion','pitch_beauty','pitch_content','proposal','influencer','editorial','hotels','ugc'], key);
