-- DidRead: prove the six-word story rules in the database (docs/SPEC.md sections 5 and 7).
--
-- Run in the Supabase dashboard after the six-word stories migration:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates test exercises, tries good and bad saves, then deletes them. Every row should say
-- PASS. Safe to run as often as you like.

create or replace function pg_temp.check_six_word_stories()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  good constant text := 'zzz-d-931';
  bad constant text := 'zzz-d-932';
  -- 230 words: fits Developing (220-380).
  test_passage constant text := rtrim(repeat('word ', 229)) || ' end.';
  rubric constant jsonb := '[
    {"id":"c1","text":"Heart","required":true,"level_0":"a","level_1":"b","level_2":"c"},
    {"id":"c2","text":"Shows","required":false,"level_0":"a","level_1":"b","level_2":"c"},
    {"id":"c3","text":"Own words","required":false,"level_0":"a","level_1":"b","level_2":"c"}]';
  anchors constant jsonb := '[
    {"label":"strong","text":"One two three four five six.","expected_scores":{"c1":2,"c2":2,"c3":2},"expected_pass":true},
    {"label":"partial","text":"One two three four five six.","expected_scores":{"c1":1,"c2":1,"c3":2},"expected_pass":true},
    {"label":"weak","text":"One two three four five six.","expected_scores":{"c1":0,"c2":0,"c3":2},"expected_pass":false}]';
  n integer := 0;
  worked boolean;
  results text[] := '{}';
begin
  delete from public.exercises where id in (good, bad);   -- leftovers from a stopped run

  -- 1. A correct six-word story (articulation, Developing) is accepted.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type, rubric, anchors)
  values (good, 'Story test', 'articulation', 'developing', 'Test', 931, test_passage, 'Q?', 'six_word_story', rubric, anchors);
  n := n + 1;
  results := results || format('%s|A correct six-word story is accepted|%s', n,
    exists (select 1 from public.exercises where id = good and word_count = 230));

  -- 2. A six-word story at Foundation is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type, rubric, anchors)
    values (bad, 'Bad', 'articulation', 'foundation', 'Test', 932, rtrim(repeat('word ', 129)) || ' end.', 'Q?',
            'six_word_story', rubric, anchors);
  exception when others then worked := false;
  end;
  results := results || format('%s|A six-word story at foundation is refused|%s', n, not worked);

  -- 3. A six-word story in another skill is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set skill = 'inference' where id = good;
  exception when others then worked := false;
  end;
  results := results || format('%s|A six-word story outside articulation is refused|%s', n, not worked);

  -- 4. A six-word story with multiple-choice options is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set options = '[{"id":"a","text":"A"}]' where id = good;
  exception when others then worked := false;
  end;
  results := results || format('%s|A six-word story with options filled in is refused|%s', n, not worked);

  -- 5. A six-word story needs its rubric.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set rubric = null where id = good;
  exception when others then worked := false;
  end;
  results := results || format('%s|A six-word story without a rubric is refused|%s', n, not worked);

  -- 6. Attempts accept six-word answers as text, scored 0-6 like open text.
  n := n + 1;
  results := results || format('%s|Attempts accept six-word answers (text, total 0-6)|%s', n,
    (select pg_get_constraintdef(oid) like '%six_word_story%' from pg_constraint
      where conrelid = 'public.attempts'::regclass and conname = 'attempts_answer_matches_type')
    and (select pg_get_constraintdef(oid) like '%six_word_story%' from pg_constraint
      where conrelid = 'public.attempts'::regclass and conname = 'attempts_total_range'));

  -- 7. The app still can't save written answers itself: only score-response does.
  n := n + 1;
  results := results || format('%s|The app can''t save six-word attempts itself (only score-response)|%s', n,
    not exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'attempts' and cmd = 'INSERT'
                  and coalesce(with_check, '') like '%six_word_story%'));

  delete from public.exercises where id in (good, bad);

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_six_word_stories() order by step;
