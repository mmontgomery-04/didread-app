-- Batch 7 test, step 2 of 2: put inf-f-001 back exactly as it was: a draft that was never approved.
--
-- The database normally never clears first_approved_at (so a once-approved exercise keeps bumping
-- its version on edits). This was only a test approval, so the save checks are switched off for
-- this one change, then straight back on.
--
-- SQL Editor -> New query -> paste this file -> Run. The result should show one row:
-- inf-f-001 | draft | 1 | NULL

begin;
alter table public.exercises disable trigger exercises_before_save;
update public.exercises set status = 'draft', first_approved_at = null where id = 'inf-f-001';
alter table public.exercises enable trigger exercises_before_save;
commit;

select id, status, version, first_approved_at from public.exercises where id = 'inf-f-001';
