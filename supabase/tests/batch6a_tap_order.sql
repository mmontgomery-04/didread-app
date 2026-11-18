-- DidRead batch 6a: prove the tap the sentence and put it in order rules in the exercises table
-- (docs/SPEC.md section 5, "Exercise fields").
--
-- Run in the Supabase dashboard after the batch 6a migration:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates test exercises, tries good and bad saves, then deletes them. Every row should say
-- PASS. Safe to run as often as you like.

create or replace function pg_temp.check_tap_order()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  tap constant text := 'zzz-f-921';
  ord constant text := 'zzz-f-922';
  bad constant text := 'zzz-f-923';
  -- Two paragraphs: 60 + 60 words, then 10 words (130 words: fits Foundation, 120-220).
  s1 constant text := rtrim(repeat('alpha ', 59)) || ' one.';
  s2 constant text := rtrim(repeat('beta ', 59)) || ' two.';
  s3 constant text := rtrim(repeat('gamma ', 9)) || ' three.';
  test_passage constant text := s1 || ' ' || s2 || E'\n\n' || s3;
  test_sentences constant jsonb := jsonb_build_array(jsonb_build_array(s1, s2), jsonb_build_array(s3));
  fb constant jsonb := '{"correct":"Yes","incorrect":"No"}';
  items constant jsonb := '[{"id":"a","text":"First"},{"id":"b","text":"Second"},{"id":"c","text":"Third"}]';
  n integer := 0;
  v integer;
  worked boolean;
  results text[] := '{}';
begin
  delete from public.exercises where id in (tap, ord, bad);   -- leftovers from a stopped run

  -- 1. Signed-in users can read the new columns; anchors and editorial notes stay hidden.
  n := n + 1;
  results := results || format('%s|The app can read the 5 new columns, not anchors or editorial_notes|%s', n,
    has_column_privilege('authenticated', 'public.exercises', 'sentences', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'correct_sentence_index', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'order_items', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'order_instruction', 'SELECT')
    and has_column_privilege('authenticated', 'public.exercises', 'feedback', 'SELECT')
    and not has_column_privilege('authenticated', 'public.exercises', 'anchors', 'SELECT')
    and not has_column_privilege('authenticated', 'public.exercises', 'editorial_notes', 'SELECT'));

  -- 2. A correct tap the sentence exercise is accepted.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                sentences, correct_sentence_index, feedback)
  values (tap, 'Tap test', 'comprehension', 'foundation', 'Test', 921, test_passage, 'Q?', 'tap_sentence',
          test_sentences, 2, fb);
  n := n + 1;
  results := results || format('%s|A correct tap the sentence exercise is accepted|%s', n,
    exists (select 1 from public.exercises where id = tap and word_count = 130));

  -- 3. Sentences that don't rebuild the passage are refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                  sentences, correct_sentence_index, feedback)
    values (bad, 'Bad', 'comprehension', 'foundation', 'Test', 923, test_passage, 'Q?', 'tap_sentence',
            jsonb_build_array(jsonb_build_array(s1, s2, s3)), 0, fb);
  exception when others then worked := false;
  end;
  results := results || format('%s|Sentences that don''t rebuild the passage are refused|%s', n, not worked);

  -- 4. A correct_sentence_index past the last sentence is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set correct_sentence_index = 3 where id = tap;
  exception when others then worked := false;
  end;
  results := results || format('%s|A correct_sentence_index past the last sentence is refused|%s', n, not worked);

  -- 5. Tap the sentence with multiple-choice options is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set options = '[{"id":"a","text":"A"}]' where id = tap;
  exception when others then worked := false;
  end;
  results := results || format('%s|Tap the sentence with options filled in is refused|%s', n, not worked);

  -- 6. A correct put it in order exercise is accepted.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                order_items, order_instruction, feedback)
  values (ord, 'Order test', 'comprehension', 'foundation', 'Test', 922, test_passage, 'Q?', 'order',
          items, 'Put them in order.', fb);
  n := n + 1;
  results := results || format('%s|A correct put it in order exercise is accepted|%s', n,
    exists (select 1 from public.exercises where id = ord));

  -- 7. Only 2 order items is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set order_items = '[{"id":"a","text":"A"},{"id":"b","text":"B"}]' where id = ord;
  exception when others then worked := false;
  end;
  results := results || format('%s|Put it in order with only 2 items is refused|%s', n, not worked);

  -- 8. Repeated order item ids are refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set order_items = '[{"id":"a","text":"A"},{"id":"a","text":"B"},{"id":"c","text":"C"}]'
    where id = ord;
  exception when others then worked := false;
  end;
  results := results || format('%s|Repeated order item ids are refused|%s', n, not worked);

  -- 9. An empty order_instruction is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set order_instruction = ' ' where id = ord;
  exception when others then worked := false;
  end;
  results := results || format('%s|An empty order_instruction is refused|%s', n, not worked);

  -- 10. Feedback without "incorrect" is refused.
  n := n + 1;
  worked := true;
  begin
    update public.exercises set feedback = '{"correct":"Yes"}' where id = ord;
  exception when others then worked := false;
  end;
  results := results || format('%s|Feedback without "incorrect" is refused|%s', n, not worked);

  -- 11. Multiple choice with sentences filled in is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.exercises (id, title, skill, band, topic, sequence, passage, question, response_type,
                                  options, correct_option_id, mc_feedback, sentences)
    values (bad, 'Bad', 'comprehension', 'foundation', 'Test', 923, test_passage, 'Q?', 'multiple_choice',
            '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]', 'a',
            '{"correct":"Yes","incorrect_by_option":{"b":"No","c":"No","d":"No"}}', test_sentences);
  exception when others then worked := false;
  end;
  results := results || format('%s|Multiple choice with sentences filled in is refused|%s', n, not worked);

  -- 12. Once approved, an edit to the new fields counts as a content edit (version 1 -> 2).
  update public.exercises set status = 'approved' where id = ord;
  update public.exercises set order_instruction = 'Put them in the order they happened.' where id = ord;
  select version into v from public.exercises where id = ord;
  n := n + 1;
  results := results || format('%s|Editing order_instruction after approval raises the version to 2|%s', n, v = 2);

  delete from public.exercises where id in (tap, ord, bad);

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_tap_order() order by step;
