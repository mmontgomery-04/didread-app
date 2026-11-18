-- DidRead batch 15: Word of the Day (docs/SPEC.md sections 5, 7 and 8, and the founder's
-- 2026-10-15 decisions in section 10).
--
-- Run once, after the batch 13 files, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/word_of_the_day.sql (a new query): every row PASS.
--
-- What it changes:
--   * New words table: the Word of the Day words, added with npm run import-exercises like
--     exercises. Signed-in users can read approved words only, and never the editorial notes.
--   * profiles gains words_started_on: the day this person first saw the card, which starts their
--     own order through the words.

create table public.words (
  id text primary key check (id ~ '^word-[0-9]{3}$'),          -- e.g. 'word-001'
  word text not null check (btrim(word) <> '' and word !~ '[\r\n]'),
  part_of_speech text not null check (btrim(part_of_speech) <> ''),
  meaning text not null check (btrim(meaning) <> '' and meaning !~ '[\r\n]'),
  -- One sentence that uses the word (the checker also requires the whole word, as written).
  example text not null check (btrim(example) <> '' and example !~ '[\r\n]'
                               and position(lower(word) in lower(example)) > 0),
  sequence integer not null,                                      -- order through the list; lower first
  status public.exercise_status not null default 'draft',         -- only 'approved' is served
  editorial_notes text,                                           -- internal only
  created_at timestamptz not null default now()
);

alter table public.words enable row level security;
revoke all on public.words from anon, authenticated;
grant select (id, word, part_of_speech, meaning, example, sequence, status) on public.words to authenticated;
create policy "Words: read approved" on public.words
  for select to authenticated using (status = 'approved');

-- The app already may change its own profile row (batch 4), so it can set this once.
alter table public.profiles add column words_started_on date;
