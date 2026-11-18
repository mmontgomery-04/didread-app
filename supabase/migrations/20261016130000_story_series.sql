-- DidRead: story series fields (docs/SPEC.md section 5, "Story series", and the founder's
-- 2026-10-16 decisions in section 10). The series themselves ship in build 8; build 7's app already
-- reads these columns, so run this before build 7 is used.
--
-- Run once, after 20261016120000_weekly_goal.sql, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/story_series.sql (a new query): every row PASS.
--
-- What it changes:
--   * New exercises columns, all empty for normal exercises:
--       series_id     which series a chapter belongs to, e.g. 'series-001'
--       series_title  the series' name, shown at the end of the last chapter
--       chapter       1, 2, 3...
--       previously    the short recap shown above the passage from chapter 2 on (it doesn't count
--                     toward the passage's word count or band length)
--   * Save checks: the series fields go together; chapter 1 has no recap and later chapters must
--     have one (no blank line in it); a chapter is never a starter or a Word Sprint (it needs a
--     passage); one chapter number per series. Chapters numbered 1..n with no gaps, one band and one
--     title per series are checked by npm run check-content (they span several rows).
--   * Signed-in users can read the four columns (the Read and Finish screens show them).
--   * Changing series_title, chapter or previously on an exercise that was ever approved bumps its
--     version, like other user-facing fields (SPEC section 5, "What counts as an edit").

alter table public.exercises
  add column series_id text check (series_id ~ '^series-[0-9]{3}$'),
  add column series_title text check (btrim(series_title) <> '' and series_title !~ '[\r\n]'),
  add column chapter integer check (chapter >= 1),
  add column previously text check (btrim(previously) <> '' and previously !~ '\n\s*\n');

alter table public.exercises add constraint exercises_series_fields check (
  (series_id is null and series_title is null and chapter is null and previously is null)
  or (series_id is not null and series_title is not null and chapter is not null
      and not starter and response_type::text <> 'word_sprint'
      and (chapter = 1) = (previously is null))
);

create unique index exercises_series_chapter on public.exercises (series_id, chapter)
  where series_id is not null;

grant select (series_id, series_title, chapter, previously) on public.exercises to authenticated;

-- Runs after exercises_before_save (triggers on the same event run in name order), which has already
-- set version for its own fields; this adds the series fields to "what counts as an edit".
create function public.exercises_series_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.first_approved_at is not null
     and new.version = old.version
     and (new.series_title, new.chapter, new.previously)
         is distinct from (old.series_title, old.chapter, old.previously) then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger exercises_series_version
  before update on public.exercises
  for each row execute function public.exercises_series_version();
