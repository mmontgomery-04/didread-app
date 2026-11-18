-- DidRead batch 9: prove the saving rules (attempts for every type, free_writes, two accounts).
--
-- Run in the Supabase dashboard after the batch 9 migration:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates two test accounts (Tester C and Tester D), saves and reads as each, tries to reach the
-- other's rows, then deletes all test data. Every row should say PASS. Safe to run as often as you like.

create or replace function pg_temp.check_batch9()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  user_c constant uuid := 'cccccccc-0000-4000-8000-00000000000c';
  user_d constant uuid := 'dddddddd-0000-4000-8000-00000000000d';
  n integer := 0;
  rows_seen integer;
  worked boolean;
  results text[] := '{}';
begin
  delete from auth.users where id in (user_c, user_d);   -- leftovers from a stopped run

  insert into auth.users (id, email, aud, role)
  values (user_c, 'tester-c@didread.test', 'authenticated', 'authenticated'),
         (user_d, 'tester-d@didread.test', 'authenticated', 'authenticated');

  ---------------------------------------------------------------- Tester C signs in
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. The app can save a tap the sentence attempt and a put it in order attempt.
  n := n + 1;
  worked := true;
  begin
    insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                                 selected_sentence_index, total, result, reading_seconds)
      values ('comp-f-003', 1, 'daily', '2026-10-01', 'tap_sentence', 8, 1, 'pass', 60);
    insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                                 submitted_order, total, result, reading_seconds)
      values ('comp-f-004', 1, 'bonus', '2026-10-01', 'order', '["a","b","c","d","e"]', 1, 'pass', 70);
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester C can save tap the sentence and put it in order attempts|%s', n, worked);

  -- 2. A tap the sentence attempt without its answer is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                                 total, result, reading_seconds)
      values ('comp-f-003', 1, 'daily', '2026-10-01', 'tap_sentence', 1, 'pass', 60);
  exception when others then worked := false;
  end;
  results := results || format('%s|A tap the sentence attempt without selected_sentence_index is refused|%s', n, not worked);

  -- 3. A put it in order attempt with a multiple-choice answer is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                                 submitted_order, selected_option_id, total, result, reading_seconds)
      values ('comp-f-004', 1, 'daily', '2026-10-01', 'order', '["a"]', 'a', 0, 'fail', 60);
  exception when others then worked := false;
  end;
  results := results || format('%s|An order attempt with another type''s answer is refused|%s', n, not worked);

  -- 4. The app still can't save an open-text attempt (only score-response can).
  n := n + 1;
  worked := true;
  begin
    insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                                 response_text, total, result, reading_seconds)
      values ('inf-f-001', 1, 'daily', '2026-10-01', 'open_text', 'A made-up score for my own answer.', 6, 'pass', 60);
  exception when others then worked := false;
  end;
  results := results || format('%s|The app can''t save its own open-text score|%s', n, not worked);

  -- 5. Tester C can save and read a free-write.
  insert into public.free_writes (prompt_id, text, local_date) values ('prompt-001', 'My morning.', '2026-10-01');
  n := n + 1;
  select count(*) into rows_seen from public.free_writes;
  results := results || format('%s|Tester C can save and read their own free-write|%s', n, rows_seen = 1);

  -- 6. An empty free-write is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.free_writes (prompt_id, text, local_date) values ('prompt-002', '', '2026-10-01');
  exception when others then worked := false;
  end;
  results := results || format('%s|An empty free-write is refused|%s', n, not worked);

  -- 7. Free-writes can't be changed or deleted from the app.
  n := n + 1;
  worked := true;
  begin
    update public.free_writes set text = 'Changed.';
  exception when others then worked := false;
  end;
  results := results || format('%s|A free-write can''t be changed|%s', n, not worked);
  n := n + 1;
  worked := true;
  begin
    delete from public.free_writes;
  exception when others then worked := false;
  end;
  results := results || format('%s|A free-write can''t be deleted|%s', n, not worked);

  ---------------------------------------------------------------- Tester D signs in
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_d, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 8. Tester D sees none of Tester C's attempts or free-writes.
  n := n + 1;
  select (select count(*) from public.attempts) + (select count(*) from public.free_writes) into rows_seen;
  results := results || format('%s|Tester D can''t see Tester C''s attempts or free-writes|%s', n, rows_seen = 0);

  -- 9. Tester D can't save a free-write as Tester C.
  n := n + 1;
  worked := true;
  begin
    insert into public.free_writes (user_id, prompt_id, text, local_date)
      values (user_c, 'prompt-003', 'Pretending to be C.', '2026-10-01');
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester D can''t save a free-write as Tester C|%s', n, not worked);

  ---------------------------------------------------------------- Signed out
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  -- 10. Signed-out visitors can't read free-writes at all.
  n := n + 1;
  worked := true;
  begin
    perform count(*) from public.free_writes;
  exception when others then worked := false;
  end;
  results := results || format('%s|Signed-out visitors can''t read free-writes|%s', n, not worked);

  ---------------------------------------------------------------- clean up (as the database owner)
  reset role;
  delete from auth.users where id in (user_c, user_d);   -- their attempts and free-writes go with them

  n := n + 1;
  select (select count(*) from public.attempts where user_id in (user_c, user_d))
       + (select count(*) from public.free_writes where user_id in (user_c, user_d)) into rows_seen;
  results := results || format('%s|Deleting the accounts removed their attempts and free-writes|%s', n, rows_seen = 0);

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_batch9() order by step;
