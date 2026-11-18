// Every user-facing word in the app, copied exactly from docs/COPY.md.
// Never write new wording here: if a screen needs words that aren't in
// COPY.md, ask the founder first.
import { dayNumber, type LocalDate, type ResponseType, type Skill } from '@/engine';

/** COPY.md: singular for 1, plural otherwise. */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** COPY.md: rotating lines are picked by day number, never at random. */
export function rotateByDay<T>(options: readonly T[], date: LocalDate): T {
  return options[dayNumber(date) % options.length];
}

/** COPY.md "Skill names shown to users". */
export const skillName: Record<Skill, string> = {
  comprehension: 'Getting it',
  inference: 'Reading between the lines',
  reasoning: 'Thinking it through',
  articulation: 'Saying it well',
};

// 1. Welcome (the title is also the opening cover's wordmark)
export const welcome = {
  title: 'DidRead',
  tagline: 'Too long? Read it anyway.',
  body: 'A few minutes a day to read, think, and write for yourself.',
  finePrint: 'By continuing, you agree to our Privacy Policy.',
  /** The part of the fine print that links to the policy. */
  finePrintLink: 'Privacy Policy',
  signingIn: 'Just a sec…',
  signInError: "That didn't work. Mind trying again?",
};

// 2. Onboarding (4 cards; batch 17 added the weekly goal card before the reminder card)
export const onboarding = {
  cards: [
    { title: 'Your brain, back in the chat.', body: 'AI can summarize anything. DidRead helps you enjoy doing it yourself.' },
    { title: 'One read a day.', body: 'A short passage, one question, a quick answer in your own words. About five minutes.' },
    { title: 'How many days a week?', body: "Pick a goal you'd hit on a busy week. You can change it anytime in Settings." },
    { title: 'Want a nudge?', body: "Pick a time and we'll send one friendly reminder a day. No nagging. Promise." },
  ],
  /** Batch 17: the index of the weekly goal card in `cards`. */
  goalCard: 2,
  next: 'Next',
  remindMe: 'Remind me',
  notNow: 'Not now',
  granted: (time: string) => `Done. See you at ${time}.`,
  denied: 'No problem. You can turn reminders on anytime in Settings.',
};

// 3. Home
export const home = {
  greeting(hour: number): string {
    if (hour < 12) return 'Good morning.';
    if (hour < 17) return 'Good afternoon.';
    return 'Good evening.';
  },
  /** For 0, hide it. The number is a hyphenated adjective, so it stays "1-day". */
  streak: (n: number) => `${n}-day streak`,
  month: (n: number) => `${plural(n, 'day', 'days')} this month`,
  label: "Today's read",
  meta: (skill: Skill, minutes: number) => `${skillName[skill]} · About ${minutes} min`,
  start: 'Start reading',
  inProgressBody: 'Right where you left off.',
  keepGoing: 'Keep going',
  doneLabel: "Today's read ✓",
  doneTitle: 'DidRead.',
  doneBody: [
    "Nice work. Tomorrow's read unlocks at midnight.",
    "That's today's brain workout. Done and dusted.",
    'You read it. You thought about it. You said it. Nice.',
  ],
  bonus: 'One more?',
  // Word of the Day card (batch 15).
  wordLabel: 'Word of the Day',
  wordPrompt: 'What do you think it means?',
  wordReveal: 'Show me',
  bonusUsedUp: "That's the max for today. Come back tomorrow!",
  noContentTitle: 'Fresh reads are on the way.',
  noContentBody: "We're writing new passages. Check back soon.",

  // Say it your way card (always on Home)
  sayItLabel: 'Say it your way',
  sayItNote: 'Just for you. No grades.',
  sayItWrite: 'Write',

  // Weekly recap card (Sunday and Monday)
  recapTitle: 'Your week',
  recapDays: (n: number) => `${plural(n, 'day', 'days')} practiced`,
  recapWords: (n: number) => `${plural(n, 'word', 'words')} read`,
  recapReads: (n: number) => `${plural(n, 'read', 'reads')} finished`,
  recapMostPracticed: (skill: Skill) => `Most practiced: ${skillName[skill]}`,
  recapPerfectWeek: 'A perfect week. Look at you.',
  /** Batch 17: that week's days practiced reached the weekly goal. */
  recapGoalMet: 'Weekly goal met.',
  recapNice: 'Nice',
};

// 3. Home and 9. Progress: the this-week strip (batch 17)
export const thisWeek = {
  label: 'This week',
  /** Monday first. */
  dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  practiced: '✓',
  missed: '○',
  open: '·',
  /** The goal is always 2 or more, so "days" stays plural. */
  progress: (n: number, goal: number) => `${n} of ${goal} days`,
  goalMet: 'Weekly goal met ✓',
};

/** Batch 17: the weekly goal choices, in Settings and on onboarding card 3. */
export const goalChoice = (goal: number) => (goal === 7 ? 'Every day' : plural(goal, 'day', 'days'));

// 11. Say it your way
export const sayItYourWay = {
  title: 'Say it your way',
  placeholder: 'Start anywhere…',
  save: 'Save',
  saved: "Saved. That's yours.",
  done: 'Done',
};

// 4. Read
export const read = {
  done: 'I read it',
  // Story series chapters (approved Oct 16, 2026).
  chapter: (n: number, total: number) => `Chapter ${n} of ${total}`,
  previously: 'Previously',
};

// 5, 6, 6b and 6c. Question
export const question = {
  label: 'Your turn',
  placeholder: 'In your own words…',
  wordCounter: (n: number) => plural(n, 'word', 'words'),
  submit: 'Submit',
  tooShort: 'Tell us a bit more. Aim for at least 8 words.',
  leaveTitle: "Leave this answer? It's saved, so you can finish later.",
  keepWriting: 'Keep writing',
  leave: 'Leave',
  check: 'Check',
  readAgain: 'Read it again',
  nothingSelected: 'Pick one first.',
  /** 6b and 6c: "Check" turns into this after checking. */
  continue: 'Continue',
  // 6b. Tap the sentence
  tapInstruction: 'Tap the sentence that answers the question.',
  tapNothingSelected: 'Tap a sentence first.',
  // 6c. Put it in order (the instruction is the exercise's order_instruction)
  orderHelper: 'Tap them in order.',
  startOver: 'Start over',
  orderIncomplete: 'Number all of them first.',
  // 6d. Six-word story (the rest of the screen reuses section 5's lines)
  storyInstruction: 'A whole story, in exactly six words.',
  storyPlaceholder: 'Six words. Make them count.',
  storyCounter: (n: number) => `Words: ${n} of 6`,
  storyTooFew: (n: number) => `That's ${n} so far. It takes exactly six.`,
  storyTooMany: (n: number) => `That's ${n} words. Trim it to six.`,
  // 6e. Bad Summary (batch 13)
  summaryInstruction: 'Tap the summary that gets it wrong.',
  summaryNothingSelected: 'Tap a summary first.',
  // 6f. Word Sprint (batch 13)
  sprintRound: (n: number) => `Round ${n} of 5`,
  sprintInstruction: 'Which word fits?',
  sprintTimeUp: "Time's up.",
  // 5. Open text, batch 10: sending and offline.
  sending: 'Reading your answer…',
  offline: "You're offline. Your answer is saved, and we'll send it when you're back.",
};

// 6g. How to play (batch 13): shown the first time someone meets a new format.
export const howToPlay = {
  title: 'How to play',
  bad_summary: 'Three summaries, one gets it wrong. Find it.',
  word_sprint: 'Five definitions. A little less time for each. Tap the word that fits.',
  start: "Let's go",
};

// 7. Feedback
export const feedback = {
  loading: 'Thinking about what you wrote…',
  scoredHeading: [
    "Ooh, let's talk about this.",
    'Nice thinking. My thoughts…',
    "Okay, you've got me thinking.",
    "Let's dig into this.",
    'Now this is worth a chat.',
    'Something to chew on here.',
    "Pull up a chair. Let's talk.",
  ],
  /** Development builds only: answers opened from the test panel aren't sent to the AI. */
  testBody: "Test feedback. Real AI feedback arrives in batch 7. Here's what a strong answer includes:",
  unscoredHeading: 'Our feedback buddy is taking a nap.',
  unscoredBody: "Your answer is saved, and today still counts. Here's what a strong answer includes:",
  correctHeading: [
    'Nailed it!',
    'You got it.',
    'Yes, exactly.',
    'Spot on.',
    'Sharp eye.',
    "That's the one.",
    'Right on the money.',
  ],
  incorrectHeading: [
    'Not quite.',
    'Close one.',
    'So close.',
    'Worth a second look.',
    'Tricky one, right?',
    'Ooh, sneaky one.',
    'Not this time.',
  ],
  continue: 'Continue',
  /** 6f. Word Sprint results, above each answer word in its example sentence. */
  sprintWords: "Here's each word in a sentence:",
};

// 8. Finish
export const finish = {
  bigLine: 'DidRead ✓',
  stats: (words: number, streak: number) =>
    `${plural(words, 'word', 'words')} read today · ${streak}-day streak`,
  tomorrow: [
    "Tomorrow's read is already waiting. No peeking.",
    'Same time tomorrow?',
    'Your next passage is picked out and ready for tomorrow.',
  ],
  done: 'Done',
  oneMore: 'One more read',
  /** Instead of "One more read" when the exercise just finished was a fail. */
  oneMoreGo: 'One more go?',
  firstBigLine: 'Your first DidRead!',
  firstBody: "One down. That's how every reader starts.",
  milestones: {
    3: "Three days in a row. That's a habit starting.",
    7: 'A whole week of reading. Look at you.',
    30: '30 days. Your attention span sends its thanks.',
  } as Record<number, string>,
  /** Batch 17: on the read that reaches the weekly goal (instead of the tomorrow cue). */
  goalMet: "That's your goal for the week. Anything more is a bonus.",
  /** Story series: after the last chapter (instead of the tomorrow cue). */
  seriesEnd: (title: string) => `That's the end of ${title}. Thanks for reading along.`,
};

// 9. Progress (batch 9)
export const progress = {
  title: 'Your progress',
  wordsRead: (n: number) => `Words read: ${n}`,
  minutesReading: (n: number) => `Minutes reading: ${n}`,
  daysPracticed: (n: number) => `Days practiced: ${n}`,
  /** COPY.md plural rule: "1 day", otherwise "days". */
  currentStreak: (n: number) => `Current streak: ${plural(n, 'day', 'days')}`,
  empty: 'Your progress shows up here after your first read.',
  startToday: "Start today's read",
};

// 10. Settings (batch 11a: the reminder toggle, its time and the footer)
export const settings = {
  title: 'Settings',
  dailyReminder: 'Daily reminder',
  time: (time: string) => `Time: ${time}`,
  /** 2. Onboarding, "Notification permission result", Denied (SPEC: reused when notifications are blocked). */
  denied: 'No problem. You can turn reminders on anytime in Settings.',
  footer: (version: string) => `DidRead ${version}`,
  privacyPolicy: 'Privacy Policy',
  // Batch 13.
  relaxedMode: 'Relaxed mode',
  relaxedModeHint: 'No timers in games.',
  // Batch 17 (the choices are `goalChoice`).
  weeklyGoal: 'Weekly goal',
  // Batch 11b.
  signOut: 'Sign out',
  signOutConfirm: 'Sign out of DidRead?',
  cancel: 'Cancel',
  deleteAccount: 'Delete account',
  deleteTitle: 'Delete your account?',
  deleteBody: "This permanently deletes your account, answers, and progress. It can't be undone.",
  deleteForever: 'Delete forever',
  deleted: 'Your account is deleted. Thanks for reading with us.',
  deleteFailed: "That didn't work. Mind trying again?",
};

// 12. Activities (batch 14)
export const activities = {
  title: 'Activities',
  pickNext: 'Pick your next read.',
  locked: "Finish today's read to unlock these.",
  cardLocked: "Unlocks after today's read",
  /** The same line as Home's "Bonus used up". */
  bonusUsedUp: "That's the max for today. Come back tomorrow!",
  caughtUp: 'All caught up. New ones soon.',
  /** The cards, in COPY.md's order (founder's order, Oct 7). */
  cards: [
    { type: 'word_sprint', name: 'Word Sprint', line: 'Five words, a little less time for each.' },
    { type: 'bad_summary', name: 'Bad Summary', line: 'Three summaries. One gets it wrong.' },
    { type: 'tap_sentence', name: 'Find the line', line: 'Tap the sentence that proves it.' },
    { type: 'order', name: 'Put it in order', line: 'Untangle what happened when.' },
    { type: 'multiple_choice', name: 'Pick one', line: 'One question, four answers. Choose wisely.' },
    { type: 'open_text', name: 'In your own words', line: 'Read a passage, then explain it your way.' },
    { type: 'six_word_story', name: 'Six-word stories', line: 'Tell a whole story in six words.' },
  ] as const satisfies readonly { type: ResponseType; name: string; line: string }[],
  // Story series (approved Oct 16, 2026): shown only once a series is approved.
  stories: { name: 'Stories', line: 'One story, a chapter at a time.' },
  storiesUpNext: (n: number, total: number) => `Up next: Chapter ${n} of ${total}`,
  storiesCaughtUp: 'All caught up. New stories soon.',
};

// Reminder notification (one per day, rotate by day)
export const reminder = {
  title: 'DidRead',
  texts: [
    "Today's read is ready. About five minutes.",
    'A short passage is waiting for you.',
    "Got five minutes? Your brain's got a date.",
    'Fresh read, just for you. Coffee optional.',
    "Today's question is a good one.",
  ],
};

// General errors (batch 10)
export const errors = {
  couldntLoad: 'Hmm, something went sideways. Pull down to try again.',
  serverError: 'Our end hiccuped. Your answer is saved. Try again in a moment.',
  tryAgain: 'Try again',
  // Oct 15: a way out of the server error screen, and the rare answer that can never be scored.
  backToHome: 'Back to Home',
  refused: "We couldn't score this one. Mind trying another read?",
};

// Accessibility labels (spoken by VoiceOver for icon-only buttons).
export const a11y = {
  back: 'Back',
  settings: 'Settings',
  progress: 'Progress',
  activities: 'Activities',
  /** Batch 17: the this-week strip. `days` are the practiced days' names, Monday first. */
  thisWeek: (days: readonly string[], n: number, goal: number) =>
    days.length === 0
      ? `This week: no practice yet. 0 of ${goal} days.`
      : `This week: practiced ${days.join(', ')}. ${n} of ${goal} days.`,
  /** Monday first, for `thisWeek`. */
  dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
