-- DidRead batch 13: a fifth Bad Summary error type, and feedback text for Word Sprint
-- (docs/SPEC.md section 5, and the founder's 2026-10-07 decisions in section 10).
--
-- Run once, after the two earlier batch 13 files, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/batch13_starters_new_formats.sql again (a new query): every row PASS.
--
-- What it changes (the save checks only; no columns change):
--   * Bad Summary's error_type may also be contradicted_detail.
--   * Word Sprint needs feedback {correct, incorrect}, like Bad Summary (it was refused before).

-- Same checks as 20261007130000, with the two changes above. Replaces the old version.
create or replace function public.exercises_before_save() returns trigger
language plpgsql set search_path = '' as $$
declare
  min_words integer;
  max_words integer;
  sentence_count integer;
  rebuilt text;
begin
  -- Version and first approval (SPEC section 5, "What counts as an edit").
  if tg_op = 'INSERT' then
    new.version := 1;
    new.first_approved_at := case when new.status = 'approved' then now() end;
  else
    new.first_approved_at := coalesce(old.first_approved_at,
                                      case when new.status = 'approved' then now() end);
    if old.first_approved_at is not null
       and (new.passage, new.title, new.question, new.options, new.correct_option_id,
            new.mc_feedback, new.rubric, new.anchors, new.sentences, new.correct_sentence_index,
            new.order_items, new.order_instruction, new.feedback, new.summaries, new.wrong_summary_id,
            new.rounds)
           is distinct from
           (old.passage, old.title, old.question, old.options, old.correct_option_id,
            old.mc_feedback, old.rubric, old.anchors, old.sentences, old.correct_sentence_index,
            old.order_items, old.order_instruction, old.feedback, old.summaries, old.wrong_summary_id,
            old.rounds) then
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;
  end if;

  -- Same rule as countWords() in src/engine/scoring.ts: runs of non-space characters.
  new.word_count := regexp_count(new.passage, '\S+');

  min_words := case new.band when 'foundation' then 120 when 'developing' then 220
                             when 'advanced' then 380 else 650 end;
  max_words := case new.band when 'foundation' then 220 when 'developing' then 380
                             when 'advanced' then 650 else 1000 end;
  -- Starter reads (batch 13): foundation only, one paragraph, 60-120 words.
  if new.starter then
    if new.band <> 'foundation' then
      raise exception 'Exercise %: starter reads must be foundation.', new.id;
    end if;
    if new.passage ~ '\n\s*\n' then
      raise exception 'Exercise %: a starter read is one paragraph (no blank line).', new.id;
    end if;
    min_words := 60;
    max_words := 120;
  end if;
  -- Word Sprint has no passage (founder's decision, Oct 7): it must be empty, and no length rule applies.
  if new.response_type = 'word_sprint' then
    if new.passage <> '' then
      raise exception 'Exercise %: Word Sprint has no passage (leave it empty).', new.id;
    end if;
  elsif new.word_count < min_words or new.word_count > max_words then
    raise exception 'Exercise %: passage is % words, but % passages must be % to % words.',
      new.id, new.word_count, case when new.starter then 'starter' else new.band::text end, min_words, max_words;
  end if;

  -- Each type's own fields, and nothing from the other types.
  if new.response_type not in ('bad_summary')
     and (new.summaries is not null or new.wrong_summary_id is not null or new.error_type is not null) then
    raise exception 'Exercise %: only Bad Summary uses summaries, wrong_summary_id and error_type.', new.id;
  end if;
  if new.response_type not in ('word_sprint') and new.rounds is not null then
    raise exception 'Exercise %: only Word Sprint uses rounds.', new.id;
  end if;
  if new.response_type in ('bad_summary', 'word_sprint')
     and (new.options is not null or new.correct_option_id is not null or new.mc_feedback is not null
          or new.rubric is not null or new.anchors is not null or new.sentences is not null
          or new.correct_sentence_index is not null or new.order_items is not null
          or new.order_instruction is not null) then
    raise exception 'Exercise %: % must leave the other types'' fields empty.', new.id, new.response_type;
  end if;
  if new.response_type in ('multiple_choice', 'open_text', 'six_word_story')
     and (new.sentences is not null or new.correct_sentence_index is not null
          or new.order_items is not null or new.order_instruction is not null or new.feedback is not null) then
    raise exception 'Exercise %: % must leave sentences, correct_sentence_index, order_items, order_instruction and feedback empty.',
      new.id, new.response_type;
  end if;
  if new.response_type in ('tap_sentence', 'order')
     and (new.options is not null or new.correct_option_id is not null or new.mc_feedback is not null
          or new.rubric is not null or new.anchors is not null) then
    raise exception 'Exercise %: % must leave options, correct_option_id, mc_feedback, rubric and anchors empty.',
      new.id, new.response_type;
  end if;

  if new.response_type = 'multiple_choice' then
    if new.rubric is not null or new.anchors is not null then
      raise exception 'Exercise %: multiple choice must leave rubric and anchors empty.', new.id;
    end if;
    if jsonb_typeof(new.options) is distinct from 'array' then
      raise exception 'Exercise %: options must be a list of {id, text}.', new.id;
    end if;
    if jsonb_array_length(new.options) <> 4 then
      raise exception 'Exercise %: needs exactly 4 options.', new.id;
    end if;
    if exists (select 1 from jsonb_array_elements(new.options) o
               where jsonb_typeof(o -> 'id') is distinct from 'string'
                  or jsonb_typeof(o -> 'text') is distinct from 'string') then
      raise exception 'Exercise %: every option needs a text id and text.', new.id;
    end if;
    if (select count(distinct o ->> 'id') from jsonb_array_elements(new.options) o)
       <> jsonb_array_length(new.options) then
      raise exception 'Exercise %: option ids must all be different.', new.id;
    end if;
    if new.correct_option_id is null
       or not exists (select 1 from jsonb_array_elements(new.options) o
                      where o ->> 'id' = new.correct_option_id) then
      raise exception 'Exercise %: correct_option_id must be one of the option ids.', new.id;
    end if;
    if jsonb_typeof(new.mc_feedback) is distinct from 'object'
       or jsonb_typeof(new.mc_feedback -> 'correct') is distinct from 'string'
       or jsonb_typeof(new.mc_feedback -> 'incorrect_by_option') is distinct from 'object' then
      raise exception 'Exercise %: mc_feedback must be {correct, incorrect_by_option}.', new.id;
    end if;
    if exists (select 1 from jsonb_array_elements(new.options) o
               where o ->> 'id' <> new.correct_option_id
                 and jsonb_typeof(new.mc_feedback -> 'incorrect_by_option' -> (o ->> 'id'))
                     is distinct from 'string') then
      raise exception 'Exercise %: mc_feedback needs feedback for every wrong option.', new.id;
    end if;

  elsif new.response_type in ('open_text', 'six_word_story') then
    if new.options is not null or new.correct_option_id is not null or new.mc_feedback is not null then
      raise exception 'Exercise %: % must leave options, correct_option_id and mc_feedback empty.',
        new.id, new.response_type;
    end if;
    -- Six-word stories: Saying it well (articulation) only, from Developing up.
    if new.response_type = 'six_word_story' and (new.skill <> 'articulation' or new.band = 'foundation') then
      raise exception 'Exercise %: six-word stories must be articulation, at developing, advanced or deep.', new.id;
    end if;
    if jsonb_typeof(new.rubric) is distinct from 'array' then
      raise exception 'Exercise %: rubric must be a list of 3 criteria.', new.id;
    end if;
    if jsonb_array_length(new.rubric) <> 3 then
      raise exception 'Exercise %: rubric must have exactly 3 criteria.', new.id;
    end if;
    if exists (select 1 from jsonb_array_elements(new.rubric) c
               where jsonb_typeof(c -> 'id') is distinct from 'string'
                  or jsonb_typeof(c -> 'text') is distinct from 'string'
                  or jsonb_typeof(c -> 'required') is distinct from 'boolean'
                  or jsonb_typeof(c -> 'level_0') is distinct from 'string'
                  or jsonb_typeof(c -> 'level_1') is distinct from 'string'
                  or jsonb_typeof(c -> 'level_2') is distinct from 'string') then
      raise exception 'Exercise %: every criterion needs id, text, required, level_0, level_1, level_2.', new.id;
    end if;
    if (select array_agg(c ->> 'id' order by c ->> 'id') from jsonb_array_elements(new.rubric) c)
       <> array['c1', 'c2', 'c3'] then
      raise exception 'Exercise %: criterion ids must be c1, c2 and c3.', new.id;
    end if;
    if (select count(*) from jsonb_array_elements(new.rubric) c where (c ->> 'required')::boolean) <> 1 then
      raise exception 'Exercise %: exactly one criterion must be required.', new.id;
    end if;
    if jsonb_typeof(new.anchors) is distinct from 'array' then
      raise exception 'Exercise %: anchors must be a list of 3.', new.id;
    end if;
    if jsonb_array_length(new.anchors) <> 3 then
      raise exception 'Exercise %: needs exactly 3 anchors.', new.id;
    end if;
    if exists (select 1 from jsonb_array_elements(new.anchors) a
               where jsonb_typeof(a -> 'label') is distinct from 'string'
                  or jsonb_typeof(a -> 'text') is distinct from 'string'
                  or jsonb_typeof(a -> 'expected_scores') is distinct from 'object'
                  or jsonb_typeof(a -> 'expected_pass') is distinct from 'boolean') then
      raise exception 'Exercise %: every anchor needs label, text, expected_scores, expected_pass.', new.id;
    end if;

  elsif new.response_type = 'tap_sentence' then
    if new.order_items is not null or new.order_instruction is not null then
      raise exception 'Exercise %: tap the sentence must leave order_items and order_instruction empty.', new.id;
    end if;
    -- sentences: a list of paragraphs, each a non-empty list of non-empty sentences.
    if jsonb_typeof(new.sentences) is distinct from 'array' or jsonb_array_length(new.sentences) = 0
       or exists (select 1 from jsonb_array_elements(new.sentences) p
                  where jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) = 0
                     or exists (select 1 from jsonb_array_elements(p) s
                                where jsonb_typeof(s) is distinct from 'string' or s #>> '{}' = '')) then
      raise exception 'Exercise %: sentences must be a list of paragraphs, each a list of sentences.', new.id;
    end if;
    -- Sentences joined with single spaces, paragraphs with a blank line, must equal the passage.
    select string_agg(para.joined, E'\n\n' order by para.n) into rebuilt
    from (select p.n, (select string_agg(s.value, ' ' order by s.m)
                       from jsonb_array_elements_text(p.value) with ordinality as s(value, m)) as joined
          from jsonb_array_elements(new.sentences) with ordinality as p(value, n)) para;
    if rebuilt is distinct from new.passage then
      raise exception 'Exercise %: the sentences don''t rebuild the passage exactly.', new.id;
    end if;
    select count(*) into sentence_count
    from jsonb_array_elements(new.sentences) p, jsonb_array_elements(p) s;
    if new.correct_sentence_index is null or new.correct_sentence_index < 0
       or new.correct_sentence_index >= sentence_count then
      raise exception 'Exercise %: correct_sentence_index must be 0 to % (counting across the whole passage).',
        new.id, sentence_count - 1;
    end if;

  elsif new.response_type = 'order' then
    if new.sentences is not null or new.correct_sentence_index is not null then
      raise exception 'Exercise %: put it in order must leave sentences and correct_sentence_index empty.', new.id;
    end if;
    if jsonb_typeof(new.order_items) is distinct from 'array'
       or jsonb_array_length(new.order_items) not between 3 and 5 then
      raise exception 'Exercise %: order_items must be a list of 3 to 5 {id, text}.', new.id;
    end if;
    if exists (select 1 from jsonb_array_elements(new.order_items) o
               where jsonb_typeof(o -> 'id') is distinct from 'string'
                  or jsonb_typeof(o -> 'text') is distinct from 'string') then
      raise exception 'Exercise %: every order item needs a text id and text.', new.id;
    end if;
    if (select count(distinct o ->> 'id') from jsonb_array_elements(new.order_items) o)
       <> jsonb_array_length(new.order_items) then
      raise exception 'Exercise %: order item ids must all be different.', new.id;
    end if;
    if new.order_instruction is null or btrim(new.order_instruction) = '' then
      raise exception 'Exercise %: order_instruction must be one line of text.', new.id;
    end if;

  elsif new.response_type = 'bad_summary' then
    if new.skill not in ('comprehension', 'reasoning') then
      raise exception 'Exercise %: Bad Summary is comprehension or reasoning.', new.id;
    end if;
    if jsonb_typeof(new.summaries) is distinct from 'array' or jsonb_array_length(new.summaries) <> 3
       or exists (select 1 from jsonb_array_elements(new.summaries) x
                  where jsonb_typeof(x -> 'id') is distinct from 'string'
                     or jsonb_typeof(x -> 'text') is distinct from 'string') then
      raise exception 'Exercise %: summaries must be exactly 3 {id, text}.', new.id;
    end if;
    if (select count(distinct x ->> 'id') from jsonb_array_elements(new.summaries) x) <> 3 then
      raise exception 'Exercise %: summary ids must all be different.', new.id;
    end if;
    if new.wrong_summary_id is null
       or not exists (select 1 from jsonb_array_elements(new.summaries) x where x ->> 'id' = new.wrong_summary_id) then
      raise exception 'Exercise %: wrong_summary_id must be one of the summary ids.', new.id;
    end if;
    if new.error_type is null
       or new.error_type not in ('flipped_cause', 'changed_number', 'changed_quantity', 'dropped_not',
                                 'contradicted_detail') then
      raise exception 'Exercise %: error_type must be flipped_cause, changed_number, changed_quantity, dropped_not or contradicted_detail.', new.id;
    end if;

  elsif new.response_type = 'word_sprint' then
    if new.skill <> 'comprehension' then
      raise exception 'Exercise %: Word Sprint is comprehension.', new.id;
    end if;
    if jsonb_typeof(new.rounds) is distinct from 'array' or jsonb_array_length(new.rounds) <> 5
       or exists (select 1 from jsonb_array_elements(new.rounds) r
                  where jsonb_typeof(r -> 'definition') is distinct from 'string'
                     or jsonb_typeof(r -> 'answer') is distinct from 'string'
                     or jsonb_typeof(r -> 'example') is distinct from 'string'
                     or position(lower(r ->> 'answer') in lower(r ->> 'example')) = 0
                     or jsonb_typeof(r -> 'options') is distinct from 'array'
                     or jsonb_array_length(r -> 'options') <> 4
                     or not (r -> 'options') ? (r ->> 'answer')) then
      raise exception 'Exercise %: rounds must be exactly 5 {definition, options (4 words), answer (one of them), example (a sentence with the answer)}.', new.id;
    end if;
  end if;

  -- Tap the sentence, put it in order, Bad Summary and Word Sprint: feedback is {correct, incorrect}.
  if new.response_type in ('tap_sentence', 'order', 'bad_summary', 'word_sprint')
     and (jsonb_typeof(new.feedback) is distinct from 'object'
          or jsonb_typeof(new.feedback -> 'correct') is distinct from 'string'
          or jsonb_typeof(new.feedback -> 'incorrect') is distinct from 'string') then
    raise exception 'Exercise %: feedback must be {correct, incorrect}.', new.id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
