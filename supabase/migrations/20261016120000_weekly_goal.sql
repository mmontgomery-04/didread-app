-- DidRead batch 17 (build 7): the weekly goal (docs/SPEC.md sections 7 and 8, and the founder's
-- 2026-10-16 decisions in section 10).
--
-- Run once, after the batch 16 file, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/weekly_goal.sql (a new query): every row PASS.
--
-- What it changes:
--   * profiles gains weekly_goal: how many days a week the person aims to practice. 2, 3, 5 or 7
--     ("Every day"). Every existing profile gets 3, the default, with no prompt (founder's decision).
--     The app already may change its own profile row (batch 4), so it can set this from onboarding
--     and Settings.

alter table public.profiles
  add column weekly_goal integer not null default 3 check (weekly_goal in (2, 3, 5, 7));
