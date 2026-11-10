-- LH Studio · Outreach › Email kit: sales documents (10.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once — it never touches your links.
--   1) a German link per kit (url_de)
--   2) if the kit keys are limited to the 4 media kits, allow the 4 sales documents too
--   3) the 4 sales documents, in the order of the sales process (empty links):
--        1 · Pitching    Partnerships · Fashion · Partnerships · Beauty · Content for Brands · Beauty
--        2 · Lead to won Feed Proposal (the template: a copy per brand)
-- The links go in by hand in the app: Email kit › Edit links (EN link · DE link). Use Canva's
-- Share › Public view link (brands open it without an account); the Feed Proposal: Share › Copy link.
-- (The first version of this file put in Canva API links for ALL 8 items, the 4 media kits too.
--  Those are temporary and only open for you: replace each of them in Edit links.)

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

-- 3) the documents (empty links; an existing row stays exactly as it is)
insert into public.email_kits (user_id, key, url, canva_file, focus, updated_at)
select u.user_id, v.key, '', v.canva_file, v.focus, now()
  from (select distinct user_id from public.email_kits) u
 cross join (values
   ('pitch_fashion', 'Lynn Hoa · Partnerships · Fashion',       'Pitch deck · normal collabs'),
   ('pitch_beauty',  'Lynn Hoa · Partnerships · Beauty',        'Pitch deck · normal collabs'),
   ('pitch_content', 'Lynn Hoa · Content for Brands · Beauty', 'Pitch deck · content production for brands'),
   ('proposal',      'Feed Proposal · [Brand] · Template',      'Template · a copy per brand in Canva')
 ) as v(key, canva_file, focus)
on conflict (user_id, key) do nothing;

-- Check: 8 rows per account, the documents first
select key, url, url_de, canva_file from public.email_kits
 order by user_id, array_position(array['pitch_fashion','pitch_beauty','pitch_content','proposal','influencer','editorial','hotels','ugc'], key);
