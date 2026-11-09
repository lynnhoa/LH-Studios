-- LH Studio · Planner › Manager → New girls, right under Engaging (09.11.2026)
-- Run it once in Supabase › SQL editor. Safe to run more than once: it adds the line only where
-- there's none yet. One New girls line per account that has an Engaging line, with the same
-- stage, owner and order; you type a number per day, the week adds up. Default goal 35 a week
-- (the line's target) until you set one in Edit goals.

-- 1) If the table only allows known sources (Engaging's is "days"), allow "new_girls" too
do $$
declare c record; d text;
begin
  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
            where conrelid = 'public.planner_tasks'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%source%' and pg_get_constraintdef(oid) ilike '%''days''%'
              and pg_get_constraintdef(oid) not ilike '%new_girls%' loop
    d := replace(c.def, '''days''::text', '''days''::text, ''new_girls''::text');
    if d = c.def then d := replace(c.def, '''days''', '''days'', ''new_girls'''); end if;
    execute format('alter table public.planner_tasks drop constraint %I', c.conname);
    execute format('alter table public.planner_tasks add constraint %I %s', c.conname, d);
  end loop;
end $$;

-- 2) The New girls line, under each Engaging line
insert into public.planner_tasks (user_id, account, stage_num, phase, owner, rhythm, area, title, how, done_when, measure, source, target, link, status, sort, active)
select distinct on (e.user_id, e.account)
       e.user_id, e.account, e.stage_num, e.phase, e.owner, 'daily', 'community', 'New girls',
       'Find new girls to follow and engage with; type how many each day', 'The week''s goal is reached',
       'girls', 'new_girls', 35, '', 'open', e.sort, true
  from public.planner_tasks e
 where e.area = 'community' and e.rhythm = 'daily' and e.phase = 'maintain'
   and coalesce(e.source, '') <> 'new_girls'
   and not exists (select 1 from public.planner_tasks n
                    where n.user_id = e.user_id and n.account = e.account and n.source = 'new_girls')
 order by e.user_id, e.account, e.sort;

-- Check: one row per account
select account, title, target as goal_per_week from public.planner_tasks where source = 'new_girls' order by account;
