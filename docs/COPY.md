# DidRead — Screen Copy (V1)

All user-facing words for V1. Use this wording exactly. If a screen needs words that aren't here, stop and ask the founder instead of writing new copy.

`{braces}` are values filled in by code. Where a list of options is given (for example, several finish lines), pick one **deterministically** (for example, by day number), never at random and never with AI.

**Plurals:** every count uses the singular for 1 and the plural otherwise (1 day / 2 days, 1 word / 2 words, 1 minute / 2 minutes). This applies to every `{n}` line below, even where only the plural is written.

## Voice

North star: **Duolingo's voice**, meaning playful, warm, encouraging, a little cheeky, and never stuffy. Set against a calm, bookish look.

- **Short.** Most lines are under 10 words. Buttons are 1–3 words.
- **Celebrate effort,** not just correct answers.
- **Cheeky, never mean.** Tease the situation, never the person.
- **Pro-reader, not anti-AI.** Never mock AI or people who use it. The joke is on "too long; didn't read," not on anyone.
- **No guilt, ever.** Duolingo's guilt-trip reminders are the one thing we don't copy. No "you'll lose your streak," no sad faces, no fake urgency (SPEC rule 6).
- **No grades or levels.** Never show scores, band names, or "you leveled up."
- Exclamation marks: at most one per screen.

### Skill names shown to users

| Internal | Shown as |
| --- | --- |
| comprehension | Getting it |
| inference | Reading between the lines |
| reasoning | Thinking it through |
| articulation | Saying it well |

## 1. Welcome

- Title: **DidRead**
- Tagline: **Too long? Read it anyway.**
- Body: A few minutes a day to read, think, and write for yourself.
- Button: Sign in with Apple *(Apple's standard button; don't restyle its text)*
- Fine print: By continuing, you agree to our Privacy Policy. *(links to the policy)*
- Signing in: Just a sec…
- Sign-in error: That didn't work. Mind trying again?

## 2. Onboarding (4 cards; the weekly goal card added in batch 17)

**Card 1**
- Title: Your brain, back in the chat.
- Body: AI can summarize anything. DidRead helps you enjoy doing it yourself.
- Button: Next

**Card 2**
- Title: One read a day.
- Body: A short passage, one question, a quick answer in your own words. About five minutes.
- Button: Next

**Card 3: weekly goal** *(batch 17, approved Oct 16, 2026)*
- Title: How many days a week?
- Body: Pick a goal you'd hit on a busy week. You can change it anytime in Settings.
- Choices: 2 days / 3 days / 5 days / Every day
- Primary button: Next *(greyed out until a choice is picked)*
- Secondary button: Not now *(sets a goal of 3 days)*

**Card 4** *(card 3 before batch 17)*
- Title: Want a nudge?
- Body: Pick a time and we'll send one friendly reminder a day. No nagging. Promise.
- Time picker default: 8:00 AM
- Primary button: Remind me
- Secondary button: Not now

**Notification permission result**
- Granted: Done. See you at {time}.
- Denied: No problem. You can turn reminders on anytime in Settings.

## 3. Home

**Greeting** (by local time of day)
- Morning (before noon): Good morning.
- Afternoon (noon–5 PM): Good afternoon.
- Evening (after 5 PM): Good evening.

**Stats row**
- Streak: {n}-day streak *(for 1 day: "1-day streak"; for 0, hide it)*
- Month: {n} days this month

**This-week strip** *(under the stats row; batch 17, approved Oct 16, 2026)*
- Label: This week
- Day letters, Monday first: M T W T F S S
- Marks: ✓ a practiced day, ○ a past day without practice, · today (until practiced) and days still to come
- Progress: {n} of {goal} days
- When the goal is reached (instead of the progress line): Weekly goal met ✓
- A missed goal is never mentioned.

**Today's read card: not started**
- Label: Today's read
- Title: {exercise title}
- Meta: {skill display name} · About {minutes} min
- Button: Start reading

**Today's read card: in progress**
- Label: Today's read
- Title: {exercise title}
- Body: Right where you left off.
- Button: Keep going

**Today's read card: done today**
- Label: Today's read ✓
- Title: DidRead. *(the check and "DidRead." are the completion moment)*
- Body (rotate by day):
  1. Nice work. Tomorrow's read unlocks at midnight.
  2. That's today's brain workout. Done and dusted.
  3. You read it. You thought about it. You said it. Nice.
- Bonus button (if bonus left): One more?
- Bonus used up: That's the max for today. Come back tomorrow!

**No content available**
- Title: Fresh reads are on the way.
- Body: We're writing new passages. Check back soon.

**Order on Home:** Today's read card, then the Word of the Day card (when there's a word), then the weekly recap card (when showing), then the Say it your way card (when showing).

**Word of the Day card** *(batch 15, approved Oct 15, 2026)*
- Label: Word of the Day
- Title: {word}
- Before revealing: What do you think it means?
- Choices (batch 16): {the 3 meanings}, tapped right on the card
- After a right pick: {the word's right message}, then {meaning}
- After a wrong pick: {the word's wrong message}, then {part of speech}, {meaning}, {example sentence, in italics, with the word highlighted}
- Button, for words without choices: Show me
- After "Show me": {part of speech}, {meaning}, {example sentence, in italics, with the word highlighted}

**Say it your way card** *(always on Home; after saving, it shows the next prompt)*
- Label: Say it your way
- Body: {prompt}
- Note: Just for you. No grades.
- Button: Write

**Weekly recap card** *(Sunday and Monday)*
- Title: Your week
- {n} days practiced
- {n} words read
- {n} reads finished
- Most practiced: {skill display name}
- If 7 days, extra line: A perfect week. Look at you.
- If that week's days practiced reached the weekly goal, extra line: Weekly goal met. *(batch 17)*
- Button: Nice

## 4. Read

- Top label: {skill display name}
- Title: {exercise title}
- Story series chapters only *(approved Oct 16, 2026)*: under the title, Chapter {n} of {total}; from chapter 2, a label Previously, then {the chapter's recap text}, above the passage
- Passage: {passage}
- Button (after passage): I read it

## 5. Question: open text

- Label: Your turn
- Question: {question}
- Input placeholder: In your own words…
- Word counter: {n} words
- Link (back to the passage; the draft is kept): Read it again
- Button: Submit
- Under 8 words (button pressed): Tell us a bit more. Aim for at least 8 words.
- Sending: Reading your answer…
- Offline: You're offline. Your answer is saved, and we'll send it when you're back.
- Back button while typing, confirm: Leave this answer? It's saved, so you can finish later.
  - Buttons: Keep writing / Leave

## 6. Question: multiple choice

- Label: Your turn
- Question: {question}
- Link (back to the passage; the picked option is kept): Read it again
- Button: Check
- Nothing selected: Pick one first.

## 6b. Question: tap the sentence

- Label: Your turn
- Question: {question}
- Instruction: Tap the sentence that answers the question.
- Passage: {passage}, each sentence tappable
- Button: Check
- Nothing selected: Tap a sentence first.
- After checking, the button becomes: Continue *(opens Feedback)*

## 6c. Question: put it in order

- Label: Your turn
- Question: {question}
- Instruction: {order_instruction}
- Helper: Tap them in order.
- Link (back to the passage; the picks are kept): Read it again
- Link: Start over
- Button: Check *(greyed out until every item is numbered)*
- Incomplete (Check pressed early): Number all of them first.
- After checking, the button becomes: Continue *(opens Feedback)*

## 6d. Question: six-word story

*(Plus only. Approved by the founder on Oct 5, 2026. Everything else on this screen reuses section 5's lines: Your turn, Read it again, Submit, the sending and offline lines, and the leave confirmation.)*

- Label: Your turn
- Question: {question}
- Instruction: A whole story, in exactly six words.
- Input placeholder: Six words. Make them count.
- Word counter: Words: {n} of 6 *(phrased this way so the plural rule never applies)*
- Fewer than six (Submit pressed): That's {n} so far. It takes exactly six.
- More than six (Submit pressed): That's {n} words. Trim it to six.
- Button: Submit
- Feedback and the unscored fallback: same as open text (section 7).

## 6e. Question: Bad Summary

*(Batch 13, approved Oct 7, 2026.)*

- Label: Your turn
- Question: {question}
- Instruction: Tap the summary that gets it wrong.
- Link (back to the passage; the pick is kept): Read it again
- Button: Check
- Nothing picked (Check pressed): Tap a summary first.
- After checking, the button becomes: Continue *(opens Feedback, with the multiple-choice headings and the exercise's feedback text)*

## 6f. Question: Word Sprint

*(Batch 13, approved Oct 7, 2026.)*

- Label: Your turn
- Round label: Round {n} of 5
- Instruction: Which word fits?
- Time ran out: Time's up.
- Feedback: the multiple-choice headings (section 7), {exercise feedback text} *(correct or incorrect; added Oct 7)*, a row of ✓ / ○ dots (one per round), then: Here's each word in a sentence: *(each round's example sentence, with the word highlighted)*
- No passage and no Read screen: Home goes straight to the rounds.

## 6g. How to play (first time only)

*(Batch 13, approved Oct 7, 2026. Shown the first time someone meets a new format.)*

- Title: How to play
- Bad Summary: Three summaries, one gets it wrong. Find it.
- Word Sprint: Five definitions. A little less time for each. Tap the word that fits.
- Button: Let's go

## 7. Feedback

**Loading:** Thinking about what you wrote…

**Open text, scored**
- Heading (rotate by day):
  1. Ooh, let's talk about this.
  2. Nice thinking. My thoughts…
  3. Okay, you've got me thinking.
  4. Let's dig into this.
  5. Now this is worth a chat.
  6. Something to chew on here.
  7. Pull up a chair. Let's talk.
- Body: {AI feedback text}
- Button: Continue

**Open text, test feedback** *(until sign-in works in batch 5; then replaced by real AI feedback)*
- Heading: same as "Open text, scored" (rotate by day)
- Body: Test feedback. Real AI feedback arrives in batch 7. Here's what a strong answer includes:
- List: {level_2 text of each rubric criterion}
- Button: Continue

**Open text, unscored fallback** *(AI failed; the day still counts)*
- Heading: Our feedback buddy is taking a nap.
- Body: Your answer is saved, and today still counts. Here's what a strong answer includes:
- List: {level_2 text of each rubric criterion}
- Button: Continue

**Multiple choice**
- Correct heading (rotate by day): Nailed it! / You got it. / Yes, exactly. / Spot on. / Sharp eye. / That's the one. / Right on the money.
- Incorrect heading (rotate by day): Not quite. / Close one. / So close. / Worth a second look. / Tricky one, right? / Ooh, sneaky one. / Not this time.
- Body: {exercise mc_feedback text}
- Button: Continue
- Rule: Multiple-choice feedback text never starts with a verdict; the heading carries it.

**Tap the sentence and put it in order**
- Headings: same as "Multiple choice" (correct / incorrect, rotate by day)
- Body: {exercise feedback text} *(correct or incorrect)*
- Button: Continue
- Rule: the feedback text never starts with a verdict; the heading carries it.

## 8. Finish

**Standard**
- Big line: DidRead ✓
- Stats: {words} words read today · {streak}-day streak
- Tomorrow cue (rotate by day):
  1. Tomorrow's read is already waiting. No peeking.
  2. Same time tomorrow?
  3. Your next passage is picked out and ready for tomorrow.
- Button: Done
- If bonus available, secondary button: One more read
- If bonus available and the exercise just finished was a fail, secondary button instead: One more go? *(starts a new bonus read, not a retry)*

**First-ever completion** (replaces the big line and adds a body line; only on the user's very first completed exercise, right or wrong)
- Big line: Your first DidRead!
- Body: One down. That's how every reader starts.

**Streak milestones** (replace the tomorrow cue on these days)
- 3 days: Three days in a row. That's a habit starting.
- 7 days: A whole week of reading. Look at you.
- 30 days: 30 days. Your attention span sends its thanks.

**Weekly goal reached** (replaces the tomorrow cue, on the read that reaches the goal; batch 17, approved Oct 16, 2026)
- That's your goal for the week. Anything more is a bonus.

**Last chapter of a story series** (replaces the tomorrow cue; approved Oct 16, 2026)
- That's the end of {series title}. Thanks for reading along.

## 9. Progress

- Title: Your progress
- Skill bars: {skill display name}, with a bar and no labels, numbers, or levels
- Stats:
  - Words read: {n}
  - Minutes reading: {n}
  - Days practiced: {n}
  - Current streak: {n} days
- The this-week strip, as on Home (section 3), after the stats *(batch 17)*
- Empty state (new user): Your progress shows up here after your first read.
- Link: Start today's read

## 10. Settings

- Title: Settings
- Daily reminder: Daily reminder *(toggle)*, Time: {time}
- Relaxed mode *(toggle, batch 13)* — hint: No timers in games.
- Weekly goal *(batch 17, approved Oct 16, 2026)* — choices: 2 days / 3 days / 5 days / Every day
- Privacy Policy
- Sign out
  - Confirm: Sign out of DidRead? — Buttons: Sign out / Cancel
- Delete account
  - Confirm title: Delete your account?
  - Confirm body: This permanently deletes your account, answers, and progress. It can't be undone.
  - Buttons: Delete forever / Cancel
  - Done: Your account is deleted. Thanks for reading with us.
  - If it fails: That didn't work. Mind trying again?
- Footer: DidRead {version}

## 11. Say it your way

- Title: Say it your way
- Prompt (under the title): {prompt}
- Input placeholder: Start anywhere…
- Button: Save *(greyed out until at least one character is typed)*
- After saving: Saved. That's yours.
- Button after saving: Done *(returns to Home)*
- Leaving without saving: no pop-up; the draft is kept for the rest of the day.

## 12. Activities (batch 14)

*(Approved Oct 7, 2026.)*

- Title: Activities
- Under the title, after today's read: Pick your next read.
- Under the title, before today's read: Finish today's read to unlock these.
- Each locked card (before today's read): Unlocks after today's read
- Bonus limit reached: That's the max for today. Come back tomorrow! *(the same line as Home's "Bonus used up")*
- A type with none left: All caught up. New ones soon.
- Cards (name, then line), in this order *(founder's order, Oct 7)*:
  - Word Sprint: Five words, a little less time for each.
  - Bad Summary: Three summaries. One gets it wrong.
  - Find the line: Tap the sentence that proves it.
  - Put it in order: Untangle what happened when.
  - Pick one: One question, four answers. Choose wisely.
  - In your own words: Read a passage, then explain it your way.
  - Six-word stories: Tell a whole story in six words. *(free during the beta from batch 16; the Coming soon badge is gone)*
  - Stories: One story, a chapter at a time. *(story series, approved Oct 16, 2026; the card shows only once a series is approved)*
- Stories card, once a series is started: Up next: Chapter {n} of {total} *(instead of its line)*
- Stories card, every series read: All caught up. New stories soon.

## Reminder notification (one per day, rotate by day)

Title: DidRead

1. Today's read is ready. About five minutes.
2. A short passage is waiting for you.
3. Got five minutes? Your brain's got a date.
4. Fresh read, just for you. Coffee optional.
5. Today's question is a good one.

## General errors

- Couldn't load: Hmm, something went sideways. Pull down to try again.
- Server error: Our end hiccuped. Your answer is saved. Try again in a moment.
- Button: Try again
- Second button, under Try again: Back to Home *(approved Oct 15, 2026)*
- Answer refused for good (rare; it can never be scored): We couldn't score this one. Mind trying another read? — Button: Back to Home *(approved Oct 15, 2026)*

## Accessibility labels

Rule: every icon-only button gets a short, plain spoken label (read by VoiceOver) naming its action. New icon-only buttons need a label proposed to and approved by the founder first.

- Back arrow (top left of Read and Question): Back
- Gear icon (top right of Home, opens Settings): Settings
- Chart icon (top right of Home, next to the gear, opens Progress): Progress
- Activities icon (top right of Home, with Progress and Settings, opens Activities): Activities

**Spoken descriptions** (read by VoiceOver for things that aren't buttons)
- This-week strip *(batch 17, approved Oct 16, 2026)*: This week: practiced {days}. {n} of {goal} days. *({days}: the practiced days' names, e.g. "Monday, Tuesday, Thursday")*
- With no practice yet this week: This week: no practice yet. 0 of {goal} days.

## TestFlight "What to Test" (tester-facing, one per build)

Not in the app: pasted into App Store Connect → TestFlight → the build → What to Test. Newest first.

**Build 1.0.0 (7)** *(approved Oct 16, 2026)*

> New: a weekly goal, suggested by one of our testers. Your goal starts at 3 days a week; change it anytime in Settings → Weekly goal. Watch this week fill in on Home and Progress. Reading-time estimates are also shorter and more realistic.
>
> Tell us anything that's confusing, broken or slow. Email hello@didread.app, or take a screenshot in the app and tap Share Beta Feedback.

**Build 1.0.0 (6)**

> Fixes: six-word stories now get feedback, and other activities no longer show "Our end hiccuped" by mistake. If an answer ever can't be sent, there's now a "Back to Home" button.
>
> Tell us anything that's confusing, broken or slow. Email hello@didread.app, or take a screenshot in the app and tap Share Beta Feedback.
