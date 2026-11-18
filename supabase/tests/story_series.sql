-- DidRead: prove the story series rules in the database (docs/SPEC.md section 5, "Story series").
--
-- Run in the Supabase dashboard after 20261016130000_story_series.sql:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates test exercises, tries good and bad saves, then deletes them. Every row should say
-- PASS. Safe to run as often as you like.

create or replace function pg_temp.check_story_series()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  c1 constant text := 'zzz-f-951';
  c2 constant text := 'zzz-f-952';
  other constant text := 'zzz-f-953';
  t_series constant text := 'series-999';
  -- 130 words: a normal Foundation passage. The recap adds nothing to the word count.
  t_passage constant text := 'The night nurse counted the jars. ' || rtrim(repeat('word ', 123)) || ' end.';
  t_options constant jsonb := '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]';
  t_mc_feedback constant jsonb := '{"correct":"Yes","incorrect_by_option":{"b":"No","c":"No","d":"No"}}';
  n integer := 0;
  v integer;
  worked boolean;
  results text[] := '{}';
begin
  delete from public.exercises where id in (c1, c2, other);   -- leftovers from a stopped run

  -- 1. The app can read the four series columns.
  n := n + 1;
  results := results || format('%s|The app can read series_id, series_title, chapter and previously|%s', n,
    has_column_privilege('authenticated', 'public.exercises', 'series_id', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'series_title', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'chapter', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'previously', 'SELECT'));

  -- 2. Chapter 1, with no recap, is accepted.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                options, correct_option_id, mc_feedback, series_id, series_title, chapter)
  values (c1, 'Chapter test', 'comprehension', 'foundation', 'Test', 951, t_passage, 'Q?', 'multiple_choice',
          t_options, 'a', t_mc_feedback, t_series, 'Test Series', 1);
  n := n + 1;
  results := results || format('%s|Chapter 1 with no recap is accepted|%s', n,
    exists (select 1 from public.exercises where id = c1 and chapter = 1));

  -- 3. Chapter 2 with a recap is accepted, and the recap doesn't count toward the word count.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                options, correct_option_id, mc_feedback, series_id, series_title, chapter, previously)
  values (c2, 'Chapter test 2', 'comprehension', 'foundation', 'Test', 952, t_passage, 'Q?', 'multiple_choice',
          t_options, 'a', t_mc_feedback, t_series, 'Test Series', 2, 'Last time, the jars went missing.');
  n := n + 1;
  results := results || format('%s|Chapter 2 with a recap is accepted; the recap isn''t counted|%s', n,
    exists (select 1 from public.exercises where id = c2 and word_count = 130));

  -- 4. Chapter 2 without a recap is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set previously = null where id = c2;
  exception when others then worked := false;
  end;
  results := results || format('%s|A later chapter without a recap is refused|%s', n, not worked);

  -- 5. Chapter 1 with a recap is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set previously = 'Nothing yet.' where id = c1;
  exception when others then worked := false;
  end;
  results := results || format('%s|Chapter 1 with a recap is refused|%s', n, not worked);

  -- 6. A recap with a blank line in it is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set previously = E'One.\n\nTwo.' where id = c2;
  exception when others then worked := false;
  end;
  results := results || format('%s|A recap with a blank line is refused|%s', n, not worked);

  -- 7. Two chapters with the same number in one series are refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set chapter = 1, previously = null where id = c2;
  exception when others then worked := false;
  end;
  results := results || format('%s|Two chapter 1s in one series are refused|%s', n, not worked);

  -- 8. Half the series fields are refused (a chapter with no series title).
  n := n + 1;
  worked := true;
  begin
    update public.exercises set series_title = null where id = c1;
  exception when others then worked := false;
  end;
  results := results || format('%s|A chapter without its series title is refused|%s', n, not worked);

  -- 9. A badly formed series id is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set series_id = 'night-shift' where id = c1;
  exception when others then worked := false;
  end;
  results := results || format('%s|A series id that isn''t series-### is refused|%s', n, not worked);

  -- 10. A starter can't be a chapter.
  n := n + 1;
  worked := true;
  begin
    insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                  options, correct_option_id, mc_feedback, starter, series_id, series_title, chapter)
    values (other, 'Starter chapter', 'comprehension', 'foundation', 'Test', 953,
            rtrim(repeat('word ', 79)) || ' end.', 'Q?', 'multiple_choice',
            t_options, 'a', t_mc_feedback, true, 'series-998', 'Other', 1);
  exception when others then worked := false;
  end;
  results := results || format('%s|A starter read can''t be a chapter|%s', n, not worked);

  -- 11. Normal exercises leave all four empty (every existing one does).
  n := n + 1;
  results := results || format('%s|Exercises outside a series have no series fields|%s', n,
    not exists (select 1 from public.exercises
                where series_id is null
                  and (series_title is not null or chapter is not null or previously is not null)));

  -- 12. After approval, changing a recap bumps the version.
  update public.exercises set status = 'approved' where id = c2;
  select version into v from public.exercises where id = c2;
  update public.exercises set previously = 'Last time, two jars went missing.' where id = c2;
  n := n + 1;
  results := results || format('%s|Changing an approved chapter''s recap bumps its version|%s', n,
    (select version from public.exercises where id = c2) = v + 1);

  delete from public.exercises where id in (c1, c2, other);

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_story_series() order by step;
