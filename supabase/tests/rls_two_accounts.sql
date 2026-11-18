-- DidRead batch 4: prove each user can reach only their own rows (docs/SPEC.md section 9, batch 4).
--
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It creates two test accounts (Tester A and Tester B) and two test exercises, signs in as each
-- account in turn, tries to read and change the other's rows, then deletes all test data.
-- The result is a table: every row should say PASS. Safe to run as often as you like.

create or replace function pg_temp.check_two_accounts()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  user_a constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a';
  user_b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  words constant text := repeat('word ', 150);   -- 150 words: fits Foundation (120-220)
  options_4 constant jsonb := '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]';
  feedback_4 constant jsonb := '{"correct":"Yes","incorrect_by_option":{"b":"No","c":"No","d":"No"}}';
  n integer := 0;
  rows_seen integer;
  rows_changed integer;
  worked boolean;

  -- Records one check. passed = true means the rule held.
  results text[] := '{}';
begin
  -- Leftovers from a run that was stopped halfway (normally none).
  delete from auth.users where id in (user_a, user_b);
  delete from public.exercises where id in ('zzz-f-901', 'zzz-f-902');

  ---------------------------------------------------------------- setup (as the database owner)
  insert into auth.users (id, email, aud, role)
  values (user_a, 'tester-a@didread.test', 'authenticated', 'authenticated'),
         (user_b, 'tester-b@didread.test', 'authenticated', 'authenticated');

  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question,
                                response_type, options, correct_option_id, mc_feedback,
                                editorial_notes, status)
  values ('zzz-f-901', 'Test approved', 'comprehension', 'foundation', 'Test', 901, words, 'Q?',
          'multiple_choice', options_4, 'a',
          feedback_4, 'internal note', 'approved'),
         ('zzz-f-902', 'Test draft', 'comprehension', 'foundation', 'Test', 902, words, 'Q?',
          'multiple_choice', options_4, 'a',
          feedback_4, 'internal note', 'draft');

  n := n + 1;
  select word_count into rows_seen from public.exercises where id = 'zzz-f-901';
  results := results || format('%s|Word count is computed on save (150)|%s', n, rows_seen = 150);

  n := n + 1;
  worked := true;
  begin
    insert into public.exercises (id, title, skill, band, topic, sequence, passage, question,
                                  response_type, options, correct_option_id, mc_feedback)
    values ('zzz-f-903', 'Too short', 'comprehension', 'foundation', 'Test', 903, 'Only five words here, see.',
            'Q?', 'multiple_choice', options_4, 'a',
            feedback_4);
  exception when others then worked := false;
  end;
  results := results || format('%s|A passage outside the band''s word range is refused|%s', n, not worked);

  ---------------------------------------------------------------- Tester A signs in
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.profiles (time_zone) values ('America/Chicago');
  insert into public.skill_state (skill) values ('comprehension');
  insert into public.daily_assignments (local_date, exercise_id, kind)
    values ('2026-10-01', 'zzz-f-901', 'daily');
  insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                               selected_option_id, total, result, reading_seconds)
    values ('zzz-f-901', 1, 'daily', '2026-10-01', 'multiple_choice', 'a', 1, 'pass', 60);

  n := n + 1;
  select (select count(*) from public.profiles) + (select count(*) from public.skill_state)
       + (select count(*) from public.daily_assignments) + (select count(*) from public.attempts)
    into rows_seen;
  results := results || format('%s|Tester A can save and read their own rows (4 tables)|%s', n, rows_seen = 4);

  n := n + 1;
  worked := true;
  begin
    insert into public.attempts (exercise_id, exercise_version, kind, local_date, response_type,
                                 response_text, total, result, reading_seconds)
      values ('zzz-f-901', 1, 'daily', '2026-10-01', 'open_text',
              'I scored my own answer as perfect, trust me.', 6, 'pass', 60);
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester A can''t save an open-text score (only score-response can)|%s', n, not worked);

  n := n + 1;
  worked := true;
  begin
    insert into public.profiles (user_id, time_zone) values (user_b, 'UTC');
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester A can''t create a row for Tester B|%s', n, not worked);

  n := n + 1;
  select count(*) into rows_seen from public.exercises where id in ('zzz-f-901', 'zzz-f-902');
  results := results || format('%s|Tester A sees the approved test exercise but not the draft|%s', n,
                               rows_seen = 1 and exists (select 1 from public.exercises where id = 'zzz-f-901'));

  n := n + 1;
  worked := true;
  begin
    perform editorial_notes from public.exercises limit 1;
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester A can''t read editorial notes|%s', n, not worked);

  n := n + 1;
  worked := true;
  begin
    perform anchors from public.exercises limit 1;
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester A can''t read anchors (model answers)|%s', n, not worked);

  n := n + 1;
  worked := true;
  begin
    delete from public.attempts;
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester A can''t delete attempts|%s', n, not worked);

  n := n + 1;
  worked := true;
  begin
    update public.daily_assignments set exercise_id = 'zzz-f-902';
  exception when others then worked := false;
  end;
  results := results || format('%s|Tester A can''t change today''s assignment|%s', n, not worked);

  ---------------------------------------------------------------- Tester B signs in
  reset role;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  n := n + 1;
  select count(*) into rows_seen from public.profiles;
  results := results || format('%s|Tester B can''t see Tester A''s profile|%s', n, rows_seen = 0);

  n := n + 1;
  select count(*) into rows_seen from public.attempts;
  results := results || format('%s|Tester B can''t see Tester A''s attempts|%s', n, rows_seen = 0);

  n := n + 1;
  select count(*) into rows_seen from public.daily_assignments;
  results := results || format('%s|Tester B can''t see Tester A''s assignments|%s', n, rows_seen = 0);

  n := n + 1;
  select count(*) into rows_seen from public.skill_state;
  results := results || format('%s|Tester B can''t see Tester A''s skill state|%s', n, rows_seen = 0);

  n := n + 1;
  update public.profiles set time_zone = 'UTC' where user_id = user_a;
  get diagnostics rows_seen = row_count;
  update public.skill_state set consecutive_fails = 2 where user_id = user_a;
  get diagnostics rows_changed = row_count;
  results := results || format('%s|Tester B can''t change Tester A''s profile or skill state|%s', n,
                               rows_seen = 0 and rows_changed = 0);

  n := n + 1;
  insert into public.profiles (time_zone) values ('UTC');
  select count(*) into rows_seen from public.profiles;
  results := results || format('%s|Tester B can save their own profile and sees only it|%s', n, rows_seen = 1);

  ---------------------------------------------------------------- signed out (anon)
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;

  n := n + 1;
  worked := true;
  begin
    perform 1 from public.exercises limit 1;
  exception when others then worked := false;
  end;
  results := results || format('%s|Signed-out visitors can''t read exercises|%s', n, not worked);

  n := n + 1;
  worked := true;
  begin
    perform 1 from public.attempts limit 1;
  exception when others then worked := false;
  end;
  results := results || format('%s|Signed-out visitors can''t read attempts|%s', n, not worked);

  ---------------------------------------------------------------- clean up (as the database owner)
  reset role;
  perform set_config('request.jwt.claims', '', true);

  n := n + 1;
  delete from auth.users where id in (user_a, user_b);   -- removes all their rows too
  select (select count(*) from public.profiles where user_id in (user_a, user_b))
       + (select count(*) from public.attempts where user_id in (user_a, user_b))
    into rows_seen;
  results := results || format('%s|Deleting an account removes that user''s rows|%s', n, rows_seen = 0);
  delete from public.exercises where id in ('zzz-f-901', 'zzz-f-902');

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_two_accounts() order by step;
