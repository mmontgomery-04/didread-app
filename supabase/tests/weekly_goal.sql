-- DidRead batch 17: prove the weekly goal rules in the database (docs/SPEC.md sections 7 and 8).
--
-- Run in the Supabase dashboard after 20261016120000_weekly_goal.sql:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It changes nothing that stays: the save checks run on a test change that is always undone.
-- Every row should say PASS. Safe to run as often as you like.

create or replace function pg_temp.check_weekly_goal()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  n integer := 0;
  worked boolean;
  results text[] := '{}';
begin
  -- 1. The column exists, defaults to 3, and every profile has a goal.
  n := n + 1;
  results := results || format('%s|Profiles have weekly_goal, default 3, never empty|%s', n,
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'profiles' and column_name = 'weekly_goal'
              and column_default = '3' and is_nullable = 'NO'));

  -- 2. Existing profiles were given 3 (or have since picked one of the choices).
  n := n + 1;
  results := results || format('%s|Every profile''s goal is 2, 3, 5 or 7|%s', n,
    not exists (select 1 from public.profiles where weekly_goal not in (2, 3, 5, 7)));

  -- 3. The app may read and change its own goal.
  n := n + 1;
  results := results || format('%s|The app may read and set weekly_goal|%s', n,
    has_column_privilege('authenticated', 'public.profiles', 'weekly_goal', 'SELECT')
    and has_column_privilege('authenticated', 'public.profiles', 'weekly_goal', 'UPDATE'));

  -- 4. A goal that isn't one of the choices is refused. Tried on one real profile; if the save
  -- were accepted, failing on purpose right after undoes it.
  n := n + 1;
  worked := true;
  begin
    update public.profiles set weekly_goal = 4 where user_id = (select user_id from public.profiles limit 1);
    raise exception 'accepted';
  exception when others then worked := (sqlerrm = 'accepted');
  end;
  results := results || format('%s|A goal of 4 days is refused|%s', n,
    not worked or not exists (select 1 from public.profiles));

  -- 5. A choice is accepted (and undone the same way).
  n := n + 1;
  worked := false;
  begin
    update public.profiles set weekly_goal = 5 where user_id = (select user_id from public.profiles limit 1);
    raise exception 'accepted';
  exception when others then worked := (sqlerrm = 'accepted');
  end;
  results := results || format('%s|A goal of 5 days is accepted|%s', n,
    worked or not exists (select 1 from public.profiles));

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_weekly_goal() order by step;
