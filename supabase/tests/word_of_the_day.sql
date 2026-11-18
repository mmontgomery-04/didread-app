-- DidRead batch 15: prove the Word of the Day rules in the database (docs/SPEC.md sections 5 and 7).
--
-- Run in the Supabase dashboard after 20261015120000_word_of_the_day.sql and (batch 16)
-- 20261015130000_word_quiz.sql:
-- SQL Editor -> New query -> paste this whole file -> Run.
-- It saves a test word, tries good and bad saves, then deletes it. Every row should say PASS.
-- Safe to run as often as you like.

create or replace function pg_temp.check_words()
returns table (step integer, check_name text, outcome text)
language plpgsql as $$
declare
  t_id constant text := 'word-999';
  n integer := 0;
  worked boolean;
  results text[] := '{}';
begin
  delete from public.words where id = t_id;   -- leftovers from a stopped run

  -- 1. Row-level security is on.
  n := n + 1;
  results := results || format('%s|Row-level security is on for words|%s', n,
    (select relrowsecurity from pg_class where oid = 'public.words'::regclass));

  -- 2. The app can read the word fields, but not the editorial notes.
  n := n + 1;
  results := results || format('%s|The app can read word, meaning and example, not editorial_notes|%s', n,
    has_column_privilege('authenticated', 'public.words', 'word', 'SELECT')
    and has_column_privilege('authenticated', 'public.words', 'meaning', 'SELECT')
    and has_column_privilege('authenticated', 'public.words', 'example', 'SELECT')
    and not has_column_privilege('authenticated', 'public.words', 'editorial_notes', 'SELECT'));

  -- 3. The app can't add, change or delete words, and signed-out visitors can't read them.
  n := n + 1;
  results := results || format('%s|The app can''t add, change or delete words|%s', n,
    not has_table_privilege('authenticated', 'public.words', 'INSERT')
    and not has_table_privilege('authenticated', 'public.words', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.words', 'DELETE')
    and not has_column_privilege('anon', 'public.words', 'word', 'SELECT'));

  -- 4. Only approved words are readable.
  n := n + 1;
  results := results || format('%s|Only approved words are readable|%s', n,
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'words'
              and cmd = 'SELECT' and qual like '%approved%'));

  -- 5. A correct word is accepted.
  insert into public.words (id, word, part_of_speech, meaning, example, sequence)
  values (t_id, 'candid', 'adjective', 'Honest and direct', 'She was candid about her mistake.', 999);
  n := n + 1;
  results := results || format('%s|A correct word is accepted, as a draft|%s', n,
    exists (select 1 from public.words where id = t_id and status = 'draft'));

  -- 6. An example that doesn't use the word is refused.
  n := n + 1;
  worked := true;
  begin
    update public.words set example = 'She was honest about her mistake.' where id = t_id;
  exception when others then worked := false;
  end;
  results := results || format('%s|An example without the word is refused|%s', n, not worked);

  -- 7. A meaning on two lines is refused.
  n := n + 1;
  worked := true;
  begin
    update public.words set meaning = E'Honest\nand direct' where id = t_id;
  exception when others then worked := false;
  end;
  results := results || format('%s|A meaning on two lines is refused|%s', n, not worked);

  -- 8. A badly formed id is refused.
  n := n + 1;
  worked := true;
  begin
    insert into public.words (id, word, part_of_speech, meaning, example, sequence)
    values ('candid', 'candid', 'adjective', 'Honest and direct', 'She was candid.', 998);
  exception when others then worked := false;
  end;
  results := results || format('%s|An id that isn''t word-### is refused|%s', n, not worked);

  -- 9. Profiles have words_started_on, and the app may set its own.
  n := n + 1;
  results := results || format('%s|Profiles have words_started_on, which the app may set|%s', n,
    has_column_privilege('authenticated', 'public.profiles', 'words_started_on', 'UPDATE'));

  -- 10. Batch 16: a word with its 2 wrong meanings and both messages is accepted, and the app can read them.
  n := n + 1;
  worked := true;
  begin
    update public.words set wrong_meanings = '["Shy and quiet", "Sly and sneaky"]',
                            right_message = 'Yes!', wrong_message = 'Not this one.' where id = t_id;
  exception when others then worked := false;
  end;
  results := results || format('%s|A word with 2 wrong meanings and both messages is accepted|%s', n,
    worked and has_column_privilege('authenticated', 'public.words', 'wrong_meanings', 'SELECT')
    and has_column_privilege('authenticated', 'public.words', 'right_message', 'SELECT')
    and has_column_privilege('authenticated', 'public.words', 'wrong_message', 'SELECT'));

  -- 11. Wrong meanings without the messages, or only one wrong meaning, are refused.
  n := n + 1;
  worked := true;
  begin
    update public.words set right_message = null where id = t_id;
  exception when others then worked := false;
  end;
  results := results || format('%s|Wrong meanings without both messages are refused|%s', n, not worked);
  n := n + 1;
  worked := true;
  begin
    update public.words set wrong_meanings = '["Shy and quiet"]' where id = t_id;
  exception when others then worked := false;
  end;
  results := results || format('%s|Only one wrong meaning is refused|%s', n, not worked);

  delete from public.words where id = t_id;

  return query
    select split_part(r, '|', 1)::integer,
           split_part(r, '|', 2),
           case when split_part(r, '|', 3) in ('t', 'true') then 'PASS' else 'FAIL' end
    from unnest(results) r;
end;
$$;

select * from pg_temp.check_words() order by step;
