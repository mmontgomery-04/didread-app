-- Batch 7 test, step 1 of 2: temporarily approve inf-f-001 in the DATABASE ONLY, so
-- score-response will score it (2026-09-30 decision log). docs/content/ is not changed.
--
-- SQL Editor -> New query -> paste this file -> Run. The result should show one row:
-- inf-f-001 | approved | 1 | (a date and time)
-- When the test is done, run undo_approve_inf_f_001.sql.

update public.exercises set status = 'approved' where id = 'inf-f-001' and status = 'draft';

select id, status, version, first_approved_at from public.exercises where id = 'inf-f-001';
