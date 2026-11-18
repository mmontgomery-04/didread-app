# DidRead — instructions for Claude Code

DidRead is an iPhone app built with **Expo (React Native + TypeScript)**, with a short daily reading-and-writing exercise. The full spec is in `docs/SPEC.md`. Read it before starting any task, and read the section for the current batch closely.

## Current batch

Build 7 sent to all testers (Nov 4). Next, plans only until the founder approves them: choosing a language (`docs/drafts/language.md`), and milestones with a new Progress screen (`docs/drafts/milestones-and-progress.md`). First series ‘Notes from the Day Shift’ needs no new build: expire builds 4 and 6 first, then approve and import it.  <!-- founder updates this line before each session -->

Work only on the current batch. If a task seems to need something from a later batch, stop and say so.

## The founder's setup

- **Windows PC. There is no Mac.** Never suggest Xcode, Swift, or iOS Simulator steps.
- Tests the app on their own iPhone with the **Expo Go** app (batches 1–4), then with a development build made by **EAS** (from batch 5).
- **Match the Expo SDK to the founder's Expo Go.** The App Store version of Expo Go can lag behind the newest Expo SDK. When creating the project, use the SDK version the App Store's Expo Go supports (choose the "App Store–compatible" option if `create-expo-app` asks). If unsure, ask the founder to open Expo Go on their iPhone and read you the supported SDK version before creating anything.
- Builds for TestFlight and the App Store are made in the cloud with **EAS**.
- Commands are run in a Windows terminal, from this project folder.

## Rules that always apply

1. **AI scores; code decides.** Progression, difficulty, exercise selection, streaks, and user state are deterministic TypeScript in `ProgressionEngine`, covered by unit tests. Never use an LLM call to decide app behavior.
2. **Never put API keys or secrets in the app.** The only AI call is the backend function `score-response`.
3. **Validate all AI output** against the JSON contract in SPEC section 6. Invalid output = "unscored." Never guess or fill in scores.
4. **Only serve exercises with status `approved`.** Never generate exercise content in code. (Until batch 6: bundle the 5 drafts from `docs/content/exercises-v1.json` for testing; development builds only may also serve every draft in `docs/content/`, per the SPEC decision log.)
5. **Don't invent product rules.** If the spec is silent or marked TBD, stop and ask the founder instead of choosing.
6. **Keep `ProgressionEngine` pure:** no networking, no UI, no React, and no reading the system clock inside rules (pass dates in), so it stays testable.
7. **Small steps.** Explain what you're about to change, change it, then tell the founder exactly how to test it on their iPhone.
8. **Don't add dependencies** (npm packages, Expo modules, services) without asking first and saying why. Prefer official Expo packages.
9. **Use the wording in `docs/COPY.md` exactly.** Never write new user-facing text; if a screen needs words that aren't there, ask the founder.
10. **Keep `CLAUDE.md` and `docs/`** when creating or reorganizing the project. Never delete or overwrite them.

## How to work with the founder

- The founder is new to coding. Explain every step plainly: what to type, where to type it, and what they should see.
- When a batch is done, list each acceptance criterion from SPEC section 9 and whether it passes.
- If you change a product rule because the founder asked, add a line to the decision log in `docs/SPEC.md` section 10.

## Project layout (fill in as it's created)

- `docs/SPEC.md` — the master spec
- `docs/COPY.md` — all screen wording
- `docs/content/exercises-*.json` — exercises (drafts); `exercises-samples.json` holds test samples of each type
- `docs/content/prompts-v1.json` — "Say it your way" prompts (batch 3c)
- `docs/content/words-*.json` — Word of the Day words (batch 15), imported with the exercises
- `docs/PRIVACY.md` — the privacy policy (source); `site/privacy/index.html` is its web page, hosted at https://didread.app/privacy
- `docs/SITE-COPY.md` — the website's words (source); `site/` is the built website for didread.app (home, blog, support, privacy), uploaded by the founder to Cloudflare Pages. `npm` isn't involved; preview it with the "site" entry in `.claude/launch.json`
- `site/media/` — the website's screenshot and video (cleaned from the founder's raw recordings in `media-raw/`, which is git-ignored and never committed)
- `docs/CONTENT-CHAT-HANDOFF.md` — handoff for the planning chat that writes Plus content (Advanced exercises) and proposes new activity formats
- `docs/drafts/ACTIVITIES-PLAN.md` — the founder's V1.1+ activities and collections plan (formats, rollout)
- `docs/drafts/formats/` — new activity format proposals (six-word stories: approved and built, see SPEC section 5)
- `docs/drafts/` — drafts from the planning chat (e.g. blog posts) before they go into SITE-COPY.md; never in `site/`, which is uploaded
- `docs/HANDOFF.md` — the founder's own handoff and tracking notes
- `docs/feedback/` — tester feedback, one file per piece (`YYYY-MM-DD-name.md`); open items are listed in START HERE
- `src/app/` — screens (Expo Router; SDK 57 keeps routes under `src/`): `index` (Home), `read`, `question`, `feedback`, `finish`, `say-it`, `settings`, `progress`, `activities` (batch 14), `welcome`, `onboarding`. `_layout` shows Welcome, Onboarding or the app by sign-in state.
- `src/copy.ts` — every user-facing string, copied exactly from `docs/COPY.md`
- `src/components/` — shared UI pieces (including `WeekStrip` and `GoalChoices`, batch 17), and the `__DEV__`-only test panel
- `src/notifications/` — daily reminder scheduling through `expo-notifications` (batch 11a); the rules are in `src/engine/reminders.ts`
- `src/state/session.tsx` — app state; since batch 9 progress is saved to and loaded from the database (`src/state/history.ts` turns saved rows back into engine attempts)
- `src/state/auth.tsx` — who is signed in, and their `profiles` row (batch 5a)
- `src/lib/network.ts` — online or not (batch 10, `expo-network`)
- `src/state/outbox.ts` — saves waiting on the phone for a signal (batch 10)
- `src/state/analytics.ts` — the 5 analytics events, saved to the `events` table through the outbox
- `src/state/relaxedMode.ts` — Relaxed mode (batch 13): removes Word Sprint's timers; kept on the phone per user
- `src/state/phoneStore.ts` — everything DidRead keeps on the phone for a user; sign out and delete account clear it
- `src/lib/appleSignIn.ts` — Sign in with Apple (batch 5b): Apple's sheet (email scope only, with a nonce from `expo-crypto`), then Supabase's `signInWithIdToken`
- `eas.json` — EAS build profiles: development (the founder's iPhone), preview, production
- `src/lib/supabase.ts` — the app's Supabase client (URL and publishable key from `EXPO_PUBLIC_` lines in `.env`; session kept on the phone with `expo-sqlite`)
- `src/components/DevSignIn.tsx` — development-only test sign-in; never in production builds
- `src/content/exercises.ts` — the Exercise shape, and (development builds only) every exercise in `docs/content/` for the test panel; production bundles none
- `src/content/catalog.tsx` — the exercises the app serves, loaded from the database (batch 6b)
- `app.json` — app name, iPhone-only, portrait. Expo SDK 57 (matches the founder's Expo Go).
- `AGENTS.md` — Expo's own guidance that came with the template (use `npx expo install` for packages, etc.)
- `src/engine/` — `ProgressionEngine` and its unit tests
- `src/theme/` — colors and fonts, defined once
- `assets/brand/` — brand source files, not yet used in the app or site: the DidRead logo (wordmark with the green ✓, 400 and 800 px squares) and `didread-banner.webp` (2000×333, "Too long? Read it anyway." over "didread.app")
- `assets/sounds/correct.wav` — the correct-answer chime (played in `src/components/moments.tsx`); remade with `python scripts/make-correct-sound.py`
- `supabase/` — database schema and the `score-response` function (from batch 4)
  - `supabase/migrations/` — schema files, run in order in the Supabase dashboard's SQL Editor
  - `supabase/tests/rls_two_accounts.sql` — paste into the SQL Editor; every row should say PASS
  - `supabase/tests/exercise_versions.sql` — same, for the batch 7 version and 4-option rules
  - `supabase/tests/batch6a_tap_order.sql` — same, for the batch 6a tap the sentence and put it in order rules
  - `supabase/functions/score-response/` — the function (Deno); deployed with `npx supabase functions deploy`
  - `supabase/functions/calibrate-response/` — scores one anchor for calibration; only the secret key can call it; saves nothing
  - `supabase/functions/reset-test-user/` — development only: wipes the test user's progress (refuses everyone else)
  - `supabase/functions/delete-account/` — deletes the signed-in caller's own account and all their rows (batch 11b), revoking Sign in with Apple first (`_shared/appleRevoke.ts`; key setup in `docs/APPLE-KEY-SETUP.md`)
  - `supabase/tests/batch9_saving.sql` — the batch 9 saving rules, two accounts
  - `supabase/tests/analytics_events.sql` — the `events` table rules, two accounts
  - `supabase/tests/six_word_stories.sql` — the six-word story rules (exercises and attempts)
  - `supabase/tests/word_of_the_day.sql` — the batch 15 `words` table and `profiles.words_started_on`
  - `supabase/tests/weekly_goal.sql` — batch 17's `profiles.weekly_goal`
  - `supabase/tests/story_series.sql` — the story series fields on `exercises`
  - `supabase/functions/_shared/` — scoring contract, prompts (`prompt-vN.ts`, one file per version; old ones never edited), provider adapter, and `storyWords.ts` (the six-word counting rule, kept in step with the app's by a test); plain TypeScript, unit-tested by `npm test`
- `docs/BATCH7-SETUP.md` — the founder's step-by-step for the database update, `.env`, deploy, secrets and tests
- `.env.example` — the settings the PC scripts need; copied to the git-ignored `.env` (never read or printed by Claude Code)
- `scripts/check-content.ts` — `npm run check-content`: checks every file in `docs/content/` against SPEC section 5
- `scripts/import-exercises.ts` — `npm run import-exercises`: loads `docs/content/exercises-*.json` into Supabase (all four types from batch 6a), keeping each status
- `scripts/test-score-response.ts` — `npm run test-score-response [-- real | -- limit]`: tests the deployed function as the dashboard test user
- `scripts/create-test-user.ts` — `npm run create-test-user`: makes `test@didread.test` and writes its password into `.env`
- `scripts/set-test-password.ts` — `npm run set-test-password`: the founder types a new, phone-typeable test password (hidden); saved in Supabase and `.env`
- `scripts/calibrate.ts` — `npm run calibrate [-- exercise ids]`: batch 8 calibration through `calibrate-response`; models, prices and the $2 limit are in `scripts/calibration-models.json`; reports are named `YYYY-MM-DD-HHMMSS.md`
- `scripts/build-site.py` — `python scripts/build-site.py`: regenerates the website pages in `site/` (not `privacy/` or `media/`); words from `docs/SITE-COPY.md`
- `scripts/didread_icon.py` — the "DR" monogram in the brand colors, drawn once for both the website's icons and the app's
- `scripts/make-app-icon.py` — `python scripts/make-app-icon.py`: remakes `assets/images/icon.png` and the iOS 26 layered icon `assets/expo.icon` (shows up in the next EAS build)
- `scripts/check-production.ts` — `npm run check-production`: builds the production iPhone bundle and proves the test sign-in, test panel and `.env` secrets aren't in it
- `scripts/lib/` — shared script helpers (`.env` loading, calibration rules with unit tests)
- `docs/calibration/` — saved calibration reports, one per run
