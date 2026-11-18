-- DidRead batch 4: database tables and row-level security (docs/SPEC.md sections 5 and 7).
--
-- Run once, in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
--
-- Security model:
--   * Every table has row-level security (RLS) on. Signed-in users ("authenticated") can reach only
--     their own rows. Signed-out visitors ("anon") can reach nothing.
--   * Backend code (the score-response function, the calibrate script) uses the service role,
--     which bypasses RLS. That key never goes in the app (CLAUDE.md rule 2).

-- ---------------------------------------------------------------------------------------------
-- Value lists (match src/engine/types.ts)
-- ---------------------------------------------------------------------------------------------

create type public.skill as enum ('comprehension', 'inference', 'reasoning', 'articulation');
create type public.band as enum ('foundation', 'developing', 'advanced', 'deep');
create type public.response_type as enum ('open_text', 'multiple_choice');
create type public.exercise_status as enum ('draft', 'fact_checked', 'calibrated', 'approved', 'retired');
create type public.attempt_kind as enum ('daily', 'bonus', 'review', 'repeat');
create type public.attempt_result as enum ('pass', 'fail', 'unscored');

-- Shared helper: keep updated_at current.
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- profiles: one row per user (created on first sign-in, batch 5)
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  time_zone text not null,          -- IANA name, e.g. 'America/Chicago'
  reminder_time time,               -- null = no reminder
  onboarding_done boolean not null default false
);

-- ---------------------------------------------------------------------------------------------
-- exercises: content, added by the founder (SPEC section 5)
-- ---------------------------------------------------------------------------------------------

create table public.exercises (
  id text primary key check (id ~ '^[a-z]+-[a-z]+-[0-9]{3}$'),   -- e.g. 'inf-f-001'
  title text not null,
  skill public.skill not null,
  band public.band not null,
  topic text not null,
  sequence integer not null,
  passage text not null,
  word_count integer not null default 0,   -- computed on save; don't type it in
  question text not null,
  response_type public.response_type not null,
  options jsonb,
  correct_option_id text,
  mc_feedback jsonb,
  rubric jsonb,
  anchors jsonb,
  editorial_notes text,
  status public.exercise_status not null default 'draft',
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- On every save: count the passage words, check the band's length range, and check that the
-- multiple-choice or open-text fields are filled in correctly. A bad row is refused with a message.
create function public.exercises_before_save() returns trigger
language plpgsql set search_path = '' as $$
declare
  min_words integer;
  max_words integer;
begin
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
    if jsonb_array_length(new.options) < 2 then
      raise exception 'Exercise %: needs at least 2 options.', new.id;
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

create trigger exercises_before_save
  before insert or update on public.exercises
  for each row execute function public.exercises_before_save();

-- ---------------------------------------------------------------------------------------------
-- attempts: the record of truth (SPEC section 7)
-- ---------------------------------------------------------------------------------------------

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  exercise_version integer not null,
  kind public.attempt_kind not null,
  local_date date not null,                -- fixed at submission, never recalculated (P6)
  response_type public.response_type not null,
  response_text text,                      -- open text only
  selected_option_id text,                 -- multiple choice only
  criteria_scores jsonb,                   -- open text: {"c1": 2, "c2": 1, "c3": 0}; null when unscored
  total integer,                           -- open text: 0-6; multiple choice: 1 right, 0 wrong; null when unscored
  result public.attempt_result not null,
  feedback_text text,
  prompt_version text,                     -- open text only
  reading_seconds integer not null,        -- capped at 600 (P7)
  created_at timestamptz not null default now(),

  constraint attempts_answer_matches_type check (
    (response_type = 'open_text' and response_text is not null and selected_option_id is null)
    or (response_type = 'multiple_choice' and selected_option_id is not null and response_text is null)
  ),
  constraint attempts_response_max_length check (char_length(response_text) <= 1000),
  constraint attempts_total_range check (
    total between 0 and 6 and (response_type = 'open_text' or total in (0, 1))
  ),
  constraint attempts_unscored_has_no_total check ((result = 'unscored') = (total is null)),
  constraint attempts_reading_seconds_range check (reading_seconds between 0 and 600)
);

create index attempts_user_created_idx on public.attempts (user_id, created_at);
create index attempts_exercise_idx on public.attempts (exercise_id);

-- ---------------------------------------------------------------------------------------------
-- daily_assignments: today's stored choice, one per user per day (P4)
-- ---------------------------------------------------------------------------------------------

create table public.daily_assignments (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  exercise_id text not null references public.exercises (id),
  kind public.attempt_kind not null,       -- daily, review or repeat (DailyAssignment in src/engine/types.ts)
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create index daily_assignments_exercise_idx on public.daily_assignments (exercise_id);

-- ---------------------------------------------------------------------------------------------
-- skill_state: cache of ProgressionEngine output, one row per user per skill
-- ---------------------------------------------------------------------------------------------

create table public.skill_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill public.skill not null,
  band public.band not null default 'foundation',
  consecutive_fails integer not null default 0 check (consecutive_fails >= 0),
  review_remaining integer not null default 0 check (review_remaining between 0 and 2),
  fast_track_used boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

create trigger skill_state_set_updated_at
  before update on public.skill_state
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.attempts enable row level security;
alter table public.daily_assignments enable row level security;
alter table public.skill_state enable row level security;

-- Supabase gives anon and authenticated full table permissions by default. Take them all away,
-- then grant back only what the app needs. RLS policies below then limit which rows.
revoke all on public.profiles, public.exercises, public.attempts,
              public.daily_assignments, public.skill_state
  from anon, authenticated;

-- profiles: read, create and change your own.
grant select, insert, update on public.profiles to authenticated;
create policy "Own profile: read" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own profile: create" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own profile: change" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- exercises: signed-in users read approved exercises, plus any exercise they've already answered
-- (so history still works after an exercise is retired). Anchors hold model answers and
-- editorial_notes are internal, so those two columns can't be read from the app at all.
grant select (id, title, skill, band, topic, sequence, passage, word_count, question, response_type,
              options, correct_option_id, mc_feedback, rubric, status, version)
  on public.exercises to authenticated;
create policy "Exercises: read approved or already answered" on public.exercises
  for select to authenticated using (
    status = 'approved'
    or exists (select 1 from public.attempts a
               where a.exercise_id = exercises.id and a.user_id = (select auth.uid()))
  );

-- attempts: read your own. The app may save only multiple-choice attempts; open-text attempts
-- are saved by the score-response function, so a modified app can't make up its own scores.
-- No changing or deleting: the log is the record of truth.
grant select, insert on public.attempts to authenticated;
create policy "Own attempts: read" on public.attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own attempts: save multiple choice" on public.attempts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and response_type = 'multiple_choice');

-- daily_assignments: read and create your own. No changing: today's choice is fixed (P4).
grant select, insert on public.daily_assignments to authenticated;
create policy "Own assignments: read" on public.daily_assignments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own assignments: create" on public.daily_assignments
  for insert to authenticated with check (user_id = (select auth.uid()));

-- skill_state: read, create and change your own.
grant select, insert, update on public.skill_state to authenticated;
create policy "Own skill state: read" on public.skill_state
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own skill state: create" on public.skill_state
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own skill state: change" on public.skill_state
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
