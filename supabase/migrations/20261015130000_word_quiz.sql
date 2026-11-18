-- DidRead batch 16: Word of the Day as a 3-way choice (docs/SPEC.md sections 5 and 8, and the
-- founder's 2026-10-15 decisions in section 10).
--
-- Run once, after 20261015120000_word_of_the_day.sql, in the Supabase dashboard:
-- SQL Editor -> New query -> paste this whole file -> Run. It should say "Success. No rows returned".
-- Then run supabase/tests/word_of_the_day.sql again (a new query): every row PASS.
--
-- What it changes: each word may have 2 wrong meanings, a line for a right pick and a line for a
-- wrong pick. All three together, or none (then the app shows the "Show me" card instead).

alter table public.words
  add column wrong_meanings jsonb,     -- exactly 2 one-line meanings that are wrong for this word
  add column right_message text,       -- shown after a right pick
  add column wrong_message text;       -- shown after a wrong pick

alter table public.words add constraint words_quiz_all_or_none check (
  (wrong_meanings is null and right_message is null and wrong_message is null)
  or (jsonb_typeof(wrong_meanings) = 'array' and jsonb_array_length(wrong_meanings) = 2
      and jsonb_typeof(wrong_meanings -> 0) = 'string' and jsonb_typeof(wrong_meanings -> 1) = 'string'
      and btrim(wrong_meanings ->> 0) <> '' and btrim(wrong_meanings ->> 1) <> ''
      and wrong_meanings ->> 0 <> wrong_meanings ->> 1
      and wrong_meanings ->> 0 <> meaning and wrong_meanings ->> 1 <> meaning
      and btrim(coalesce(right_message, '')) <> '' and right_message !~ '[\r\n]'
      and btrim(coalesce(wrong_message, '')) <> '' and wrong_message !~ '[\r\n]')
);

grant select (wrong_meanings, right_message, wrong_message) on public.words to authenticated;
