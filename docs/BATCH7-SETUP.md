# Batch 7 setup: score-response, step by step

Do these in order. Each step says what to do and what you should see. If you see something else, stop and tell Claude Code what you saw. Never paste a key or password into chat.

## Step 1. Update the database (Supabase dashboard)

1. Open your project at supabase.com, then click **SQL Editor** on the left.
2. Click **New query**. In VS Code or Notepad, open `supabase/migrations/20260930180000_batch7_exercise_versions.sql`, copy all of it, paste it in, and click **Run**.
   You should see: **Success. No rows returned**.
3. New query again. Paste all of `supabase/tests/exercise_versions.sql` and click **Run**.
   You should see 10 rows, and every row should say **PASS**.
4. New query again. Paste all of `supabase/tests/rls_two_accounts.sql` (updated to use 4 options) and click **Run**.
   You should see 19 rows, and every row should say **PASS**.

## Step 2. Create the `.env` file and a test user

The `.env` file holds keys for the scripts on your PC. Git ignores it, so it never goes to GitHub or into the app.

**Make a test user:**
1. In the dashboard, open **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Use an email you'll recognize, such as `test@didread.test`, and make up a new password that you don't use anywhere else. Tick **Auto Confirm User**, then click **Create user**.

**Make the file:**
1. In the DidRead folder, copy `.env.example` and name the copy `.env`, with nothing before the dot.
   In the terminal: `copy .env.example .env`
2. Open `.env` in Notepad: `notepad .env`
3. Fill in each line after the `=`, with no spaces or quotes:
   - `SUPABASE_URL`: in the dashboard, **Project Settings**, then **Data API**, then **Project URL**. It looks like `https://abcd1234.supabase.co`.
   - `SUPABASE_PUBLISHABLE_KEY`: **Project Settings**, then **API Keys**. It starts with `sb_publishable_`.
   - `SUPABASE_SECRET_KEY`: same page, under **Secret keys**. Click the eye icon to reveal and copy it. It starts with `sb_secret_`.
   - `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`: the test user you just made.
4. Save and close Notepad.

## Step 3. Import the exercises

In the terminal, in the DidRead folder:

```
npm run import-exercises
```

You should see the content check pass, then a line like `✓ inf-f-001: added. Status draft, version 1.` for each of 10 exercises. comp-f-901 and comp-f-902 are skipped until batch 6. The last line should be **Imported 10 of 10 exercises.**

## Step 4. Send the function to Supabase

1. Find your **project ref**: the part of the Project URL before `.supabase.co` (for example, `abcd1234`).
2. Log the command-line tool in to your Supabase account:
   ```
   npx supabase login
   ```
   If it asks "Ok to proceed?", type `y` and press Enter. A browser window opens; log in and allow it. Back in the terminal you should see **You are now logged in**.
3. Deploy, replacing `YOUR_REF` with your project ref:
   ```
   npx supabase functions deploy score-response --project-ref YOUR_REF --use-api --no-verify-jwt
   ```
   You should see **Deployed Functions on project YOUR_REF: score-response**.

## Step 5. Check the safety rules (free, no AI)

```
npm run test-score-response
```

You should see 9 lines that all start with **PASS**, then **Everything passed.** This checks, among other things, that a draft exercise is refused for app users and that nothing gets saved for any refused request.

## Step 6. Put the OpenAI key into Supabase

The key goes only into Supabase, never into a file or chat.

1. In the dashboard, open **Edge Functions** on the left, then **Secrets**.
2. Add these three secrets, one at a time (Name, then Value, then Save):
   - `OPENAI_API_KEY`: paste your OpenAI key from your password manager.
   - `SCORING_PROVIDER`: `openai`
   - `SCORING_MODEL`: a cheap model name from your OpenAI dashboard, typed exactly. Choose a "mini" chat model, not a reasoning model, because reasoning models may not accept the settings DidRead uses. Batch 8 compares models properly; this is just the starting choice.
3. You don't need to deploy again. The function picks up the secrets automatically.

## Step 7. The real scoring test

1. **SQL Editor:** run `supabase/tests/approve_inf_f_001_temporarily.sql`.
   You should see `inf-f-001 | approved | 1 | (a date)`.
2. **Terminal:**
   ```
   npm run test-score-response -- real
   ```
   This makes 3 AI calls, which cost a fraction of a cent. For each anchor (strong, partial, weak) you should see a result, its feedback, and PASS lines. If an anchor gives a different result than expected, that's not a bug in the code. It's what batch 8 calibration is for, so note it.
3. Optional: `npm run test-score-response -- limit` uses up the rest of today's 10 scoring calls (up to 7 more AI calls), then checks that the 11th is saved as unscored with no AI call.
4. **SQL Editor:** run `supabase/tests/undo_approve_inf_f_001.sql`. **Don't skip this step.**
   You should see `inf-f-001 | draft | 1 | NULL`.

## If something goes wrong

- **Function logs:** in the dashboard, open **Edge Functions**, then **score-response**, then **Logs**. Unscored answers log the reason, for example `AI call failed: HTTP 401`, which means a wrong key. Logs never include the user's answer.
- **`server_error` with `Loading exercise failed: HTTP 401` in the logs:** add one more secret, `DIDREAD_SECRET_KEY`, with your Supabase secret key as the value.
