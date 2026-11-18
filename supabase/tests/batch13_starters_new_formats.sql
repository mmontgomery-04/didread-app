-- DidRead batch 13: prove the starter read, Bad Summary and Word Sprint rules in the database
-- (docs/SPEC.md sections 5 and 7).
--
-- Run in the Supabase dashboard after the batch 13 migrations (20261007120000, 20261007130000 and
-- 20261007140000):
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates test exercises, tries good and bad saves, then deletes them. Every row should say
-- PASS. Safe to run as often as you like.

create or replace function pg_temp.check_batch13()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  st constant text := 'zzz-f-941';
  bs constant text := 'zzz-f-942';
  ws constant text := 'zzz-f-943';
  bad constant text := 'zzz-f-944';
  -- 80 words, one paragraph: a starter. 130 words: a normal Foundation passage.
  t_short_passage constant text := rtrim(repeat('word ', 79)) || ' end.';
  t_long_passage constant text := 'The candid baker was frugal. ' || rtrim(repeat('word ', 124)) || ' end.';
  t_options constant jsonb := '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]';
  t_mc_feedback constant jsonb := '{"correct":"Yes","incorrect_by_option":{"b":"No","c":"No","d":"No"}}';
  t_fb constant jsonb := '{"correct":"Yes","incorrect":"No"}';
  t_summaries constant jsonb := '[{"id":"a","text":"One summary of the passage here."},{"id":"b","text":"Another summary of the passage here."},{"id":"c","text":"A third summary of the passage here."}]';
  t_rounds constant jsonb := '[
    {"definition":"Honest and open","options":["candid","sly","vague","coy"],"answer":"candid","example":"She was candid about her mistake."},
    {"definition":"Careful with money","options":["frugal","lavish","rash","bold"],"answer":"frugal","example":"A frugal cook wastes nothing."},
    {"definition":"A person who bakes","options":["baker","miner","tailor","sailor"],"answer":"baker","example":"The baker opened at six."},
    {"definition":"The last part","options":["end","start","middle","edge"],"answer":"end","example":"We stayed until the end."},
    {"definition":"A unit of language","options":["word","note","sign","mark"],"answer":"word","example":"Pick one word for it."}]';
  n integer := 0;
  v integer;
  worked boolean;
  results text[] := '{}';
begin
  delete from public.exercises where id in (st, bs, ws, bad);   -- leftovers from a stopped run

  -- 1. The app can read the new columns, but not error_type.
  n := n + 1;
  results := results || format('%s|The app can read starter, summaries, wrong_summary_id and rounds, not error_type|%s', n,
    has_column_privilege('authenticated', 'public.exercises', 'starter', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'summaries', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'wrong_summary_id', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'rounds', 'SELECT')
    and not has_column_privilege('authenticated', 'public.exercises', 'error_type', 'SELECT'));

  -- 2. An 80-word one-paragraph starter is accepted (below Foundation's 120).
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                options, correct_option_id, mc_feedback, starter)
  values (st, 'Starter test', 'comprehension', 'foundation', 'Test', 941, t_short_passage, 'Q?', 'multiple_choice',
          t_options, 'a', t_mc_feedback, true);
  n := n + 1;
  results := results || format('%s|An 80-word starter is accepted|%s', n,
    exists (select 1 from public.exercises where id = st and word_count = 80 and starter));

  -- 3. The same 80 words without the starter flag are refused (Foundation is 120-220).
  n := n + 1;
  worked := true;
  begin
    update public.exercises set starter = false where id = st;
  exception when others then worked := false;
  end;
  results := results || format('%s|80 words without the starter flag are refused|%s', n, not worked);

  -- 4. A starter with two paragraphs is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set passage = rtrim(repeat('word ', 40)) || E'\n\n' || rtrim(repeat('word ', 39)) || ' end.' where id = st;
  exception when others then worked := false;
  end;
  results := results || format('%s|A starter with a blank line is refused|%s', n, not worked);

  -- 5. A starter outside Foundation is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set band = 'developing' where id = st;
  exception when others then worked := false;
  end;
  results := results || format('%s|A starter outside foundation is refused|%s', n, not worked);

  -- 6. A correct Bad Summary is accepted.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                summaries, wrong_summary_id, error_type, feedback)
  values (bs, 'Bad summary test', 'comprehension', 'foundation', 'Test', 942, t_long_passage, 'Q?', 'bad_summary',
          t_summaries, 'b', 'flipped_cause', t_fb);
  n := n + 1;
  results := results || format('%s|A correct Bad Summary is accepted|%s', n, exists (select 1 from public.exercises where id = bs));

  -- 7. A wrong_summary_id that isn't a summary is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set wrong_summary_id = 'z' where id = bs;
  exception when others then worked := false;
  end;
  results := results || format('%s|A wrong_summary_id that isn''t a summary is refused|%s', n, not worked);

  -- 8. An unknown error_type is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set error_type = 'wrong_vibes' where id = bs;
  exception when others then worked := false;
  end;
  results := results || format('%s|An unknown error_type is refused|%s', n, not worked);

  -- 8b. The fifth error type, contradicted_detail, is accepted.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set error_type = 'contradicted_detail' where id = bs;
  exception when others then worked := false;
  end;
  results := results || format('%s|The error_type contradicted_detail is accepted|%s', n, worked);

  -- 9. A correct Word Sprint is accepted.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type, rounds, feedback)
  values (ws, 'Sprint test', 'comprehension', 'foundation', 'Test', 943, '', 'Q?', 'word_sprint', t_rounds, t_fb);
  n := n + 1;
  results := results || format('%s|A correct Word Sprint is accepted|%s', n, exists (select 1 from public.exercises where id = ws));

  -- 9b. Word Sprint with a passage is refused, and so is a round without an example.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set passage = t_long_passage where id = ws;
  exception when others then worked := false;
  end;
  results := results || format('%s|Word Sprint with a passage is refused|%s', n, not worked);
  n := n + 1;
  worked := true;
  begin
    update public.exercises set rounds = t_rounds #- '{0,example}' where id = ws;
  exception when others then worked := false;
  end;
  results := results || format('%s|A Word Sprint round without an example is refused|%s', n, not worked);

  -- 9c. Word Sprint without feedback {correct, incorrect} is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set feedback = null where id = ws;
  exception when others then worked := false;
  end;
  results := results || format('%s|Word Sprint without feedback is refused|%s', n, not worked);

  -- 10. A round whose answer isn't one of its options is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set rounds = jsonb_set(t_rounds, '{0,answer}', '"honest"') where id = ws;
  exception when others then worked := false;
  end;
  results := results || format('%s|A round whose answer isn''t an option is refused|%s', n, not worked);

  -- 11. Word Sprint in another skill is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set skill = 'inference' where id = ws;
  exception when others then worked := false;
  end;
  results := results || format('%s|Word Sprint outside comprehension is refused|%s', n, not worked);

  -- 12. Multiple choice with rounds filled in is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set rounds = t_rounds where id = st;
  exception when others then worked := false;
  end;
  results := results || format('%s|Multiple choice with rounds filled in is refused|%s', n, not worked);

  -- 13. Once approved, an edit to rounds counts as a content edit (version 1 -> 2).
  update public.exercises set status = 'approved' where id = ws;
  update public.exercises set rounds = jsonb_set(t_rounds, '{0,definition}', '"Open and honest"') where id = ws;
  select version into v from public.exercises where id = ws;
  n := n + 1;
  results := results || format('%s|Editing rounds after approval raises the version to 2|%s', n, v = 2);

  -- 14. Attempts accept Bad Summary (picked summary) and Word Sprint (5 picks, total 0-5).
  n := n + 1;
  results := results || format('%s|Attempts accept Bad Summary and Word Sprint answers|%s', n,
    (select pg_get_constraintdef(oid) like '%bad_summary%' and pg_get_constraintdef(oid) like '%round_answers%'
       from pg_constraint where conrelid = 'public.attempts'::regclass and conname = 'attempts_answer_matches_type')
    and (select pg_get_constraintdef(oid) like '%word_sprint%'
       from pg_constraint where conrelid = 'public.attempts'::regclass and conname = 'attempts_total_range'));

  -- 15. The app may save both new types itself (it scores them, like multiple choice).
  n := n + 1;
  results := results || format('%s|The app may save Bad Summary and Word Sprint attempts|%s', n,
    exists (select 1 from pg_policies
            where schemaname = 'public' and tablename = 'attempts' and cmd = 'INSERT'
              and with_check like '%bad_summary%' and with_check like '%word_sprint%'));

  delete from public.exercises where id in (st, bs, ws, bad);

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_batch13() order by step;
