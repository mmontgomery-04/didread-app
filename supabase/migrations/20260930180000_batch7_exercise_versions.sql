-- DidRead batch 7: exercise version rules, first_approved_at, and exactly 4 multiple-choice options
-- (docs/SPEC.md section 5, and the 2026-09-30 batch 7 decisions in section 10).
--
-- Run once, after the batch 4 file, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
--
-- What it changes:
--   * exercises.first_approved_at: set by the database the first time status becomes 'approved';
--     never changes after that. Null = never approved.
--   * exercises.version: managed by the database. New exercises start at 1. A content edit (passage,
--     title, question, options, correct_option_id, mc_feedback, rubric, anchors) adds 1, but only if
--     the exercise had been approved at some point before the edit. Status-only and editorial_notes
--     changes never do. Whatever version is typed in or imported is ignored.
--   * Multiple choice needs exactly 4 options (was 2 or more).
--   * A faster way to count a user's open-text attempts on a day (score-response's daily limit).

alter table public.exercises add column first_approved_at timestamptz;

-- Exercises already approved before this change count as approved from their last save.
update public.exercises set first_approved_at = updated_at where status = 'approved';

-- Same checks as batch 4, plus the version rules and the 4-option rule. Replaces the old version.
create or replace function public.exercises_before_save() returns trigger
language plpgsql set search_path = '' as $$
declare
  min_words integer;
  max_words integer;
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
            new.mc_feedback, new.rubric, new.anchors)
           is distinct from
           (old.passage, old.title, old.question, old.options, old.correct_option_id,
            old.mc_feedback, old.rubric, old.anchors) then
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

  else -- open_text
    if new.options is not null or new.correct_option_id is not null or new.mc_feedback is not null then
      raise exception 'Exercise %: open text must leave options, correct_option_id and mc_feedback empty.', new.id;
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
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- score-response counts a user's open-text attempts on one local date (daily limit, SPEC section 6).
create index attempts_user_local_date_idx on public.attempts (user_id, local_date);
