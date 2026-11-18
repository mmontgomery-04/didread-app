-- DidRead: six-word stories (docs/SPEC.md sections 4-6, and the 2026-10-05 decision in section 10).
--
-- Run once, after the earlier files, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/six_word_stories.sql (a new query) to check it.
--
-- What it changes:
--   * response_type gains 'six_word_story'. It uses the open-text fields (rubric, anchors) and is
--     scored by score-response, like open text. No new columns.
--   * The exercises save checks treat it like open text, and allow it only for articulation at
--     developing, advanced or deep (the same rules as `npm run check-content`).
--   * attempts accept it: the answer is response_text, and the total is 0-6, like open text.
--     Only score-response saves these attempts; the app's own insert rule is unchanged.
-- The checks below compare response_type as text, because a new enum value can't be used by name
-- in the same run that adds it.

alter type public.response_type add value if not exists 'six_word_story';

-- Same checks as batch 6a, plus six-word stories. Replaces the old version.
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
            new.order_items, new.order_instruction, new.feedback)
           is distinct from
           (old.passage, old.title, old.question, old.options, old.correct_option_id,
            old.mc_feedback, old.rubric, old.anchors, old.sentences, old.correct_sentence_index,
            old.order_items, old.order_instruction, old.feedback) then
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
  if new.word_count < min_words or new.word_count > max_words then
    raise exception 'Exercise %: passage is % words, but % passages must be % to % words.',
      new.id, new.word_count, new.band, min_words, max_words;
  end if;

  -- Each type's own fields, and nothing from the other types.
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
  end if;

  -- Tap the sentence and put it in order: feedback is {correct, incorrect}.
  if new.response_type in ('tap_sentence', 'order')
     and (jsonb_typeof(new.feedback) is distinct from 'object'
          or jsonb_typeof(new.feedback -> 'correct') is distinct from 'string'
          or jsonb_typeof(new.feedback -> 'incorrect') is distinct from 'string') then
    raise exception 'Exercise %: feedback must be {correct, incorrect}.', new.id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

alter table public.attempts drop constraint attempts_answer_matches_type;
alter table public.attempts add constraint attempts_answer_matches_type check (
  (response_type::text in ('open_text', 'six_word_story') and response_text is not null
     and selected_option_id is null and selected_sentence_index is null and submitted_order is null)
  or (response_type::text = 'multiple_choice' and selected_option_id is not null
     and response_text is null and selected_sentence_index is null and submitted_order is null)
  or (response_type::text = 'tap_sentence' and selected_sentence_index is not null and selected_sentence_index >= 0
     and response_text is null and selected_option_id is null and submitted_order is null)
  or (response_type::text = 'order' and jsonb_typeof(submitted_order) = 'array'
     and response_text is null and selected_option_id is null and selected_sentence_index is null)
);

alter table public.attempts drop constraint attempts_total_range;
alter table public.attempts add constraint attempts_total_range check (
  total between 0 and 6 and (response_type::text in ('open_text', 'six_word_story') or total in (0, 1))
);
