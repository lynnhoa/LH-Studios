-- LH Studio · Outreach › Email kit: German templates (10.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once. Changes no links and no texts.
--   Each email template gets a language: 'en' (all of today's templates) or 'de'.
--   A German template puts in the kit's DE link (no DE link yet → the EN link).
-- The DE link fields themselves (email_kits.url_de) came with LH-Studio-email-kit-docs.sql.

alter table public.email_templates add column if not exists lang text not null default 'en';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.email_templates'::regclass and conname = 'email_templates_lang_check') then
    alter table public.email_templates add constraint email_templates_lang_check check (lang in ('en', 'de'));
  end if;
end $$;

-- Check: your templates by language
select lang, count(*) as templates from public.email_templates group by lang order by lang;
