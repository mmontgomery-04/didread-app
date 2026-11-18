-- DidRead batch 7: prove the exercise version rules and the 4-option rule
-- (docs/SPEC.md section 5, "What counts as an edit", and the 2026-09-30 batch 7 decisions).
--
-- Run in the Supabase dashboard after the batch 7 migration:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It creates one test exercise, edits it step by step, checks version and first_approved_at after
-- each step, then deletes it. Every row should say PASS. Safe to run as often as you like.

create or replace function pg_temp.check_exercise_versions()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  ex constant text := 'zzz-f-911';
  words constant text := repeat('word ', 150);   -- 150 words: fits Foundation (120-220)
  options_4 constant jsonb := '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]';
  feedback_4 constant jsonb := '{"correct":"Yes","incorrect_by_option":{"b":"No","c":"No","d":"No"}}';
  n integer := 0;
  v integer;
  approved_at timestamptz;
  worked boolean;
  results text[] := '{}';
begin
  delete from public.exercises where id in (ex, 'zzz-f-912');   -- leftovers from a stopped run

  -- 1. Multiple choice with 2 options is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.exercises (id, title, skill, band, topic, sequence, passage, question,
                                  response_type, options, correct_option_id, mc_feedback)
    values ('zzz-f-912', 'Two options', 'comprehension', 'foundation', 'Test', 912, words, 'Q?',
            'multiple_choice', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]', 'a',
            '{"correct":"Yes","incorrect_by_option":{"b":"No"}}');
  exception when others then worked := false;
  end;
  results := results || format('%s|Multiple choice with 2 options is refused|%s', n, not worked);

  -- 2. Exactly 4 options is accepted; a typed-in version is ignored and it starts at 1.
  insert into public.exercises (id, title, skill, band, topic, sequence, passage, question,
                                response_type, options, correct_option_id, mc_feedback, version)
  values (ex, 'Test', 'comprehension', 'foundation', 'Test', 911, words, 'Q?',
          'multiple_choice', options_4, 'a', feedback_4, 7);
  select version, first_approved_at into v, approved_at from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|4 options accepted; new draft starts at version 1, never approved|%s',
                               n, v = 1 and approved_at is null);

  -- 3. Content edit on a never-approved draft: stays at version 1.
  update public.exercises set title = 'Test, edited', question = 'Q2?' where id = ex;
  select version into v from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|Editing a never-approved draft keeps version 1|%s', n, v = 1);

  -- 4. Approve: first_approved_at is set; version doesn't change.
  update public.exercises set status = 'approved' where id = ex;
  select version, first_approved_at into v, approved_at from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|Approving sets first_approved_at and keeps the version|%s',
                               n, v = 1 and approved_at is not null);

  -- 5. Content edit while approved: version goes up.
  update public.exercises set passage = repeat('text ', 150) where id = ex;
  select version into v from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|Editing the passage of an approved exercise makes version 2|%s', n, v = 2);

  -- 6. editorial_notes only: no change.
  update public.exercises set editorial_notes = 'Checked against a source.' where id = ex;
  select version into v from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|Editing only editorial_notes keeps the version|%s', n, v = 2);

  -- 7. Back to draft: status-only, no change; first_approved_at stays.
  update public.exercises set status = 'draft' where id = ex;
  select version, first_approved_at into v, approved_at from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|Moving back to draft keeps the version and first_approved_at|%s',
                               n, v = 2 and approved_at is not null);

  -- 8. Content edit on a once-approved draft: version goes up.
  update public.exercises set options = jsonb_set(options, '{1,text}', '"B, reworded"') where id = ex;
  select version into v from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|Editing a once-approved draft makes version 3|%s', n, v = 3);

  -- 9. first_approved_at can't be cleared or changed by an edit.
  update public.exercises set first_approved_at = null where id = ex;
  select first_approved_at into approved_at from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|first_approved_at can''t be cleared by an edit|%s', n, approved_at is not null);

  -- 10. Typing a version in an edit is ignored; retiring is status-only.
  update public.exercises set version = 99, status = 'retired' where id = ex;
  select version into v from public.exercises where id = ex;
  n := n + 1;
  results := results || format('%s|A typed-in version and retiring both keep version 3|%s', n, v = 3);

  delete from public.exercises where id in (ex, 'zzz-f-912');

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_exercise_versions() order by step;
