-- DidRead analytics: the 5 minimum events (docs/SPEC.md section 10 and decision log, 2026-10-02),
-- saved in our own database, not an outside analytics service.
--
-- Run once, after the batch 4, 7, 6a and 9 files, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/analytics_events.sql (a new query) to check it.
--
-- What it adds:
--   * A new events table. The app saves events for the signed-in user only; it can't read,
--     change or delete them (the founder reads them in the dashboard's Table Editor).
--   * Deleting an account deletes its events too, like every other table.
--
-- When each event is saved (founder's decisions, 2026-10-02):
--   app_open            the app is opened fresh, or comes back from the background
--   exercise_started    the Read screen opens for an exercise
--   exercise_completed  the answer is checked or submitted
--   feedback_unscored   Feedback shows the unscored fallback (the AI failed or the daily limit)
--   day_practiced       the first practice of a day (an answer or a free-write, P6)
-- Exercises opened from the test panel's "Open any exercise" list save no events.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name in
    ('app_open', 'exercise_started', 'exercise_completed', 'feedback_unscored', 'day_practiced')),
  local_date date not null,                 -- the user's day when it happened
  exercise_id text,                         -- exercise events only
  kind public.attempt_kind,                 -- exercise events only: daily, bonus, review or repeat
  occurred_at timestamptz not null,         -- when it happened on the phone (it may arrive later, if offline)
  created_at timestamptz not null default now(),
  constraint events_exercise_fields check (
    (name in ('exercise_started', 'exercise_completed', 'feedback_unscored')
       and exercise_id is not null and kind is not null)
    or (name in ('app_open', 'day_practiced') and exercise_id is null and kind is null)
  )
);

create index events_name_date_idx on public.events (name, local_date);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant insert on public.events to authenticated;
create policy "Own events: save" on public.events
  for insert to authenticated with check (user_id = (select auth.uid()));
