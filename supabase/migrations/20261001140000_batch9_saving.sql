-- DidRead batch 9: saving progress (docs/SPEC.md section 7 and section 9, batch 9).
--
-- Run once, after the batch 4, 7 and 6a files, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/batch9_saving.sql (a new query) to check it.
--
-- What it changes:
--   * attempts gains selected_sentence_index (tap the sentence) and submitted_order (put it in
--     order, a list of item ids), and each type must fill in its own answer field.
--   * The app may save tap the sentence and put it in order attempts too (it scores them itself,
--     like multiple choice). Open-text attempts are still saved only by score-response.
--   * New free_writes table for "Say it your way": each user reads and saves only their own;
--     no changing or deleting from the app, like attempts.

alter table public.attempts
  add column selected_sentence_index integer,   -- tap the sentence only
  add column submitted_order jsonb;             -- put it in order only: the item ids, in the order tapped

alter table public.attempts drop constraint attempts_answer_matches_type;
alter table public.attempts add constraint attempts_answer_matches_type check (
  (response_type = 'open_text' and response_text is not null
     and selected_option_id is null and selected_sentence_index is null and submitted_order is null)
  or (response_type = 'multiple_choice' and selected_option_id is not null
     and response_text is null and selected_sentence_index is null and submitted_order is null)
  or (response_type = 'tap_sentence' and selected_sentence_index is not null and selected_sentence_index >= 0
     and response_text is null and selected_option_id is null and submitted_order is null)
  or (response_type = 'order' and jsonb_typeof(submitted_order) = 'array'
     and response_text is null and selected_option_id is null and selected_sentence_index is null)
);

drop policy "Own attempts: save multiple choice" on public.attempts;
create policy "Own attempts: save code-scored types" on public.attempts
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and response_type in ('multiple_choice', 'tap_sentence', 'order'));

create table public.free_writes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt_id text not null,
  text text not null check (char_length(text) >= 1),
  local_date date not null,                -- fixed when saved, never recalculated (P6)
  created_at timestamptz not null default now()
);

create index free_writes_user_created_idx on public.free_writes (user_id, created_at);

alter table public.free_writes enable row level security;
revoke all on public.free_writes from anon, authenticated;
grant select, insert on public.free_writes to authenticated;
create policy "Own free-writes: read" on public.free_writes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own free-writes: save" on public.free_writes
  for insert to authenticated with check (user_id = (select auth.uid()));
