-- DidRead analytics: prove the events rules (two accounts).
--
-- Run in the Supabase dashboard after the analytics migration:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates two test accounts (Tester E and Tester F), saves events as each, tries to reach the
-- other's, then deletes all test data. Every row should say PASS. Safe to run as often as you like.

create or replace function pg_temp.check_events()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  user_e constant uuid := 'eeeeeeee-0000-4000-8000-00000000000e';
  user_f constant uuid := 'ffffffff-0000-4000-8000-00000000000f';
  n integer := 0;
  rows_seen integer;
  worked boolean;
  results text[] := '{}';
begin
  delete from auth.users where id in (user_e, user_f);   -- leftovers from a stopped run

  insert into auth.users (id, email, aud, role)
  values (user_e, 'tester-e@didread.test', 'authenticated', 'authenticated'),
         (user_f, 'tester-f@didread.test', 'authenticated', 'authenticated');

  ---------------------------------------------------------------- Tester E signs in
  perform set_config('request.jwt.claims', json_build_object('sub', user_e, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Tester E can save each of the 5 events.
  n := n + 1;
  worked := true;
  begin
    insert into public.events (name, local_date, occurred_at) values ('app_open', '2026-10-02', now());
    insert into public.events (name, local_date, exercise_id, kind, occurred_at)
      values ('exercise_started', '2026-10-02', 'inf-f-001', 'daily', now()),
             ('exercise_completed', '2026-10-02', 'inf-f-001', 'daily', now()),
             ('feedback_unscored', '2026-10-02', 'inf-f-001', 'daily', now());
    insert into public.events (name, local_date, occurred_at) values ('day_practiced', '2026-10-02', now());
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester E can save all 5 events|%s', n, worked);

  -- 2. An event name that isn't one of the 5 is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.events (name, local_date, occurred_at) values ('button_tapped', '2026-10-02', now());
  exception when others then worked := false;
  end;
  results := results || format('%s|An unknown event name is refused|%s', n, not worked);

  -- 3. An exercise event without its exercise is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.events (name, local_date, occurred_at) values ('exercise_started', '2026-10-02', now());
  exception when others then worked := false;
  end;
  results := results || format('%s|exercise_started without an exercise is refused|%s', n, not worked);

  -- 4. The app can't read, change or delete events, even its own.
  n := n + 1;
  worked := true;
  begin
    perform count(*) from public.events;
  exception when others then worked := false;
  end;
  results := results || format('%s|Events can''t be read from the app|%s', n, not worked);
  n := n + 1;
  worked := true;
  begin
    update public.events set name = 'app_open';
  exception when others then worked := false;
  end;
  results := results || format('%s|Events can''t be changed|%s', n, not worked);
  n := n + 1;
  worked := true;
  begin
    delete from public.events;
  exception when others then worked := false;
  end;
  results := results || format('%s|Events can''t be deleted|%s', n, not worked);

  ---------------------------------------------------------------- Tester F signs in
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_f, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 7. Tester F can't save an event as Tester E.
  n := n + 1;
  worked := true;
  begin
    insert into public.events (user_id, name, local_date, occurred_at) values (user_e, 'app_open', '2026-10-02', now());
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester F can''t save an event as Tester E|%s', n, not worked);

  ---------------------------------------------------------------- Signed out
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  -- 8. Signed-out visitors can't save events.
  n := n + 1;
  worked := true;
  begin
    insert into public.events (name, local_date, occurred_at) values ('app_open', '2026-10-02', now());
  exception when others then worked := false;
  end;
  results := results || format('%s|Signed-out visitors can''t save events|%s', n, not worked);

  ---------------------------------------------------------------- check and clean up (as the database owner)
  reset role;

  -- 9. Tester E's 5 events were saved as Tester E.
  n := n + 1;
  select count(*) into rows_seen from public.events where user_id = user_e;
  results := results || format('%s|Tester E''s 5 events are saved under Tester E|%s', n, rows_seen = 5);

  delete from auth.users where id in (user_e, user_f);   -- their events go with them

  n := n + 1;
  select count(*) into rows_seen from public.events where user_id in (user_e, user_f);
  results := results || format('%s|Deleting the accounts removed their events|%s', n, rows_seen = 0);

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_events() order by step;
