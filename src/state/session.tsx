// App state. Since batch 9 progress is saved: attempts (multiple choice, tap the sentence and put
// it in order saved here; open text saved by score-response), free-writes and the skill_state
// cache, and it's all loaded back on sign-in, so reinstalling restores progress. Today's choice
// of exercise is saved in `daily_assignments` (batch 6b, P4). Every decision (today's exercise,
// bonus, streak, bands) comes from ProgressionEngine; the exercises come from the database
// (src/content/catalog.tsx).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  chapterOf,
  chooseExerciseOfType,
  computeSkillStates,
  currentStreak,
  dailyStatus,
  daysPracticedThisMonth,
  getDailyAssignment,
  nextChapter,
  nextPrompt,
  reachedGoalWithThisRead,
  thisWeek,
  weeklyGoalOrDefault,
  weeklyRecap,
  wordChoices,
  wordOfTheDay,
  isAnswerBlocked,
  isWrittenAnswer,
  localDateFor,
  readingSeconds,
  scoreBadSummary,
  scoreWordSprint,
  scoreMultipleChoice,
  scoreOrder,
  scoreTapSentence,
  wordsRead,
  type AttemptKind,
  type AttemptResult,
  type DailyAssignment,
  type LocalDate,
  type ResponseType,
  type Selection,
} from '@/engine';
import { useCatalog } from '@/content/catalog';
import type { Exercise } from '@/content/exercises';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

import { SERVED_PROMPTS } from '@/content/prompts';
import { useAuth } from '@/state/auth';

import { appStateStep, eventRow, type EventExercise, type EventName } from './analytics';
import { flushOutbox, saveOrQueue } from './outbox';
import { phoneKeys, readJson, writeJson } from './phoneStore';
import { attemptFromRow, freeWriteFromRow, skillStateRows, type AttemptRow, type FreeWriteRow } from './history';
import { readScoreReply, type ScoredOpenText } from './scoreReply';
import {
  draftFor,
  EMPTY_SESSION,
  openQuestion,
  practicedOn,
  recordAttempt,
  saveFreeWrite,
  startExercise,
  tapOrderItem,
  updateCurrent,
  type CurrentExercise,
  type SubmittedAnswer,
} from './sessionLogic';

const DAY_MS = 86_400_000;

/** Which Word of the Day was revealed or answered, and on which day (kept on the phone). */
interface WordRevealed {
  date: LocalDate;
  wordId: string;
  /** Batch 16: the meaning picked, for a word with a choice. */
  pick?: string;
}
/** score-response allows 15 s plus one retry for the AI; past this, the answer is treated as unscored. */
const SCORING_TIMEOUT_MS = 60_000;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
/**
 * DidRead Plus comes after the TestFlight beta (RevenueCat). Until then everything is free (founder's
 * decision, Oct 15), so everyone gets the Plus-only types (six-word stories).
 */
const HAS_PLUS = true;

export type HomeCard =
  /** Exercises or today's saved choice are still loading. */
  | { state: 'loading' }
  /** Batch 10: exercises or saved progress couldn't load (no signal or a server problem). */
  | { state: 'error' }
  | { state: 'notStarted'; exercise: Exercise; selection: Selection }
  | { state: 'inProgress'; exercise: Exercise }
  /** Batch 14: the bonus button opens Activities while bonus reads are left today (P5). */
  | { state: 'done'; bonusLeft: boolean }
  | { state: 'noContent' };

/**
 * Batch 10: an open-text answer that hasn't reached score-response yet (no signal, or a server
 * hiccup). Kept on the phone, so closing the app doesn't lose it, and sent when possible.
 */
interface PendingAnswer {
  body: Record<string, unknown>;
  current: CurrentExercise;
  nowMs: number;
  localDate: LocalDate;
}

function useSessionState() {
  const [state, setState] = useState(EMPTY_SESSION);
  const { status: catalogStatus, exercises, selectable, words, getExercise, retry: catalogRetry } = useCatalog();
  const { userId, state: authState, startWords } = useAuth();
  const online = useOnline();
  /** An open-text answer is with score-response; Feedback shows its loading state. */
  const [scoring, setScoring] = useState(false);
  /** score-response couldn't be reached or failed before scoring; Feedback offers "Try again". */
  const [scoringError, setScoringError] = useState(false);
  /** Oct 15: score-response refused the latest answer for good; Feedback says so and offers Home. */
  const [scoringRefused, setScoringRefused] = useState(false);
  const [pending, setPendingState] = useState<PendingAnswer | null>(null);
  const setPending = (p: PendingAnswer | null) => {
    setPendingState(p);
    writePending(userId, p);
  };

  // The app's clock. Read here, in the app layer, and passed into the engine.
  // Refreshed every minute and when the app comes back, so "today" rolls over
  // at local midnight even if the app stays open.
  const [clockMs, setClockMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setClockMs(Date.now());
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  const today: LocalDate = localDateFor(clockMs + state.dayOffset * DAY_MS, TIME_ZONE);

  /** The current time, for event handlers only (never during render). */
  const now = () => Date.now() + state.dayOffset * DAY_MS;
  // The user id decides their surprise days (P4, batch 13).
  const input = { exercises: selectable, attempts: state.attempts, today, plus: HAS_PLUS, seed: userId ?? undefined };
  const status = dailyStatus(state.attempts, today);
  const freeWriteDates = state.freeWrites.map((w) => w.localDate);

  // Today's saved choice (batch 6b, P4): read it once per day before choosing, so a relaunch
  // shows the same exercise. `assignmentDay` is the day whose saved row has been read.
  const [assignmentDay, setAssignmentDay] = useState<LocalDate | null>(null);
  useEffect(() => {
    if (catalogStatus !== 'ready' || assignmentDay === today) return;
    let cancelled = false;
    readAssignment(today).then((saved) => {
      if (cancelled) return;
      if (saved) setState((s) => ({ ...s, dailyAssignment: saved }));
      setAssignmentDay(today);
    });
    return () => {
      cancelled = true;
    };
  }, [catalogStatus, assignmentDay, today]);

  // Batch 9: the saved history (attempts and free-writes), loaded once per sign-in. If it can't be
  // read (no signal), it's tried again when the app comes back to the front.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyTry, setHistoryTry] = useState(0);
  const [historyError, setHistoryError] = useState(false);
  /** How many attempts the skill_state cache was last saved for. */
  const skillStateSaved = useRef<number | null>(null);
  /**
   * True while the written answer waiting for score-response is the latest thing submitted, so
   * Feedback is about it. A later answer of another type means the user moved on: Feedback then
   * shows that answer, and the waiting one is retried in the background (Oct 15 fix: a stuck story's
   * error used to replace Pick One's feedback).
   */
  const pendingIsLatest = useRef(false);
  useEffect(() => {
    if (catalogStatus !== 'ready' || historyLoaded) return;
    let cancelled = false;
    // Saves still waiting on the phone go first, so the history includes them.
    (userId ? flushOutbox(userId) : Promise.resolve()).then(loadHistory).then((history) => {
      if (cancelled) return;
      if (!history) return setHistoryError(true);
      setHistoryError(false);
      const waiting = readPending(userId);
      pendingIsLatest.current = waiting !== null;
      setPendingState(waiting);
      const byId = new Map(exercises.map((e) => [e.id, e]));
      const attempts = history.attempts
        .map((row) => attemptFromRow(row, byId.get(row.exercise_id)))
        .filter((a) => a !== null);
      skillStateSaved.current = attempts.length;
      setState((s) => ({
        ...s,
        attempts,
        freeWrites: history.freeWrites.map(freeWriteFromRow),
        completedCount: Math.max(s.completedCount, attempts.length),
        recapDismissedWeek: readRecapDismissed(userId),
      }));
      setHistoryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [catalogStatus, historyLoaded, historyTry, exercises, userId]);
  useEffect(() => {
    if (catalogStatus !== 'ready' || historyLoaded) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setHistoryTry((n) => n + 1));
    return () => sub.remove();
  }, [catalogStatus, historyLoaded]);

  // Batch 10: when the signal comes back, send what's waiting.
  useEffect(() => {
    if (online && userId && historyLoaded) flushOutbox(userId);
  }, [online, userId, historyLoaded]);

  /** Analytics (SPEC decision log, 2026-10-02): saves one event for the signed-in user, or queues it. */
  function logEvent(name: EventName, exercise?: EventExercise) {
    if (!userId) return;
    const nowMs = now();
    saveOrQueue(userId, { table: 'events', row: eventRow(name, Date.now(), localDateFor(nowMs, TIME_ZONE), exercise) });
  }

  // app_open: once per launch as soon as someone is signed in, then each time the app comes back
  // from the background.
  const launchLogged = useRef(false);
  const dayOffset = state.dayOffset;
  useEffect(() => {
    if (!userId) return;
    const logOpen = () =>
      saveOrQueue(userId, {
        table: 'events',
        row: eventRow('app_open', Date.now(), localDateFor(Date.now() + dayOffset * DAY_MS, TIME_ZONE)),
      });
    if (!launchLogged.current) {
      launchLogged.current = true;
      logOpen();
    }
    let wasInBackground = false;
    const sub = AppState.addEventListener('change', (next) => {
      const step = appStateStep(wasInBackground, next);
      wasInBackground = step.wasInBackground;
      if (step.opened) logOpen();
    });
    return () => sub.remove();
  }, [userId, dayOffset]);

  // After each new attempt, save the skill_state cache (SPEC section 7: a cache of the engine's
  // result; the attempts log stays the record of truth).
  useEffect(() => {
    if (!historyLoaded || !userId || skillStateSaved.current === null) return;
    if (state.attempts.length <= skillStateSaved.current) return;
    skillStateSaved.current = state.attempts.length;
    const rows = skillStateRows(computeSkillStates(state.attempts)).map((r) => ({ ...r, user_id: userId }));
    supabase.from('skill_state').upsert(rows, { onConflict: 'user_id,skill' }).then(({ error }) => {
      if (error) console.warn(`Saving skill_state failed: ${error.message}`);
    });
  }, [historyLoaded, userId, state.attempts]);

  // Word of the Day (batch 15): each person's own order, from the first day they see the card.
  const wordsStartedOn = authState.status === 'signedIn' ? (authState.profile?.words_started_on ?? null) : null;
  const word = wordOfTheDay(words, wordsStartedOn ?? today, today);
  const wordId = word?.id;
  useEffect(() => {
    if (wordId && !wordsStartedOn) startWords(today);
  }, [wordId, wordsStartedOn, today]); // eslint-disable-line react-hooks/exhaustive-deps
  /** "Show me" was tapped for this word today. Remembered on this phone for the day. */
  const [revealed, setRevealed] = useState(() => readJson<WordRevealed>(phoneKeys.wordRevealed(userId)));
  const todaysRecord = revealed?.date === today && revealed.wordId === word?.id ? revealed : null;
  // Batch 16: a word with its wrong meanings is a 3-way choice; without them, the "Show me" card.
  const choices = word?.wrong_meanings && word.right_message && word.wrong_message
    ? wordChoices(word.id, word.meaning, word.wrong_meanings)
    : null;
  const todaysWord = word
    ? { ...word, choices, picked: todaysRecord?.pick ?? null, revealed: todaysRecord !== null }
    : null;

  // Batch 17: the weekly goal (3 until the profile loads, or if it has none) and this week's strip.
  const weeklyGoal = weeklyGoalOrDefault(authState.status === 'signedIn' ? authState.profile?.weekly_goal : null);
  const week = thisWeek(state.attempts, freeWriteDates, today, weeklyGoal);

  const loaded = catalogStatus === 'ready' && assignmentDay === today && historyLoaded;
  const assignment = loaded ? getDailyAssignment(input, state.dailyAssignment) : null;

  // A new choice for today is saved right away. If another launch saved one first, use that.
  const unsaved = assignment && state.dailyAssignment?.localDate !== today ? assignment : null;
  const unsavedId = unsaved?.exerciseId;
  const unsavedKind = unsaved?.kind;
  useEffect(() => {
    if (!unsavedId || !unsavedKind) return;
    let cancelled = false;
    saveAssignment({ exerciseId: unsavedId, kind: unsavedKind, localDate: today }).then((saved) => {
      if (!cancelled) setState((s) => ({ ...s, dailyAssignment: saved }));
    });
    return () => {
      cancelled = true;
    };
  }, [unsavedId, unsavedKind, today]);

  function homeCard(): HomeCard {
    // A dev-panel exercise in progress doesn't replace today's card.
    if (state.current?.counts) return { state: 'inProgress', exercise: getExercise(state.current.exerciseId) };
    if (catalogStatus === 'error' || historyError) return { state: 'error' };
    if (!loaded) return { state: 'loading' };
    if (status.dailyDone) return { state: 'done', bonusLeft: status.bonusRemaining > 0 };
    if (!assignment) return { state: 'noContent' };
    return { state: 'notStarted', exercise: getExercise(assignment.exerciseId), selection: assignment };
  }

  /**
   * Batch 14, the Activities screen: locked until today's read is done; then each type's next
   * bonus read (P4), or null when that type is all caught up. `bonusLeft` is false after 2 (P5).
   */
  function activities(types: readonly ResponseType[]) {
    const picks = new Map<ResponseType, Selection | null>(
      types.map((type) => [type, loaded ? chooseExerciseOfType(input, type) : null]),
    );
    // Story series: the Stories card's next chapter ('none' hides the card).
    const stories = loaded ? nextChapter(selectable, state.attempts) : ({ state: 'none' } as const);
    return { ready: loaded, locked: !status.dailyDone, bonusLeft: status.bonusRemaining > 0, picks, stories };
  }

  /** Opens the passage. */
  function start(selection: Selection, counts = true) {
    setScoringRefused(false);
    const nowMs = now();
    setState((s) => startExercise(s, selection, counts, nowMs, localDateFor(nowMs, TIME_ZONE)));
    if (counts) logEvent('exercise_started', selection);
  }

  const update = (change: Partial<CurrentExercise>) => setState((s) => updateCurrent(s, change));

  /** `total` is what attempts.total stores: the score (1 or 0), except Word Sprint's rounds right (0-5). */
  function record(result: AttemptResult, score: number | null, answer: SubmittedAnswer, total: number | null = score) {
    const current = state.current;
    if (!current) return;
    // Moving on from a written answer that's still waiting: try it again quietly in the background.
    if (pending && current.exerciseId !== pending.current.exerciseId) {
      pendingIsLatest.current = false;
      setScoringError(false);
    }
    const exercise = getExercise(current.exerciseId);
    // P6: the date is fixed at submission time, in the user's local time zone.
    const nowMs = now();
    const localDate = localDateFor(nowMs, TIME_ZONE);
    setState((s) => recordAttempt(s, exercise, result, score, answer, nowMs, localDate));
    // Batch 9: code-scored answers are saved here. Test-panel answers never are; written answers
    // (open text, six-word stories) are saved by score-response.
    if (current.counts && !isWrittenAnswer(exercise.response_type) && userId) {
      saveOrQueue(userId, {
        table: 'attempts',
        row: {
          exercise_id: exercise.id,
          exercise_version: exercise.version,
          kind: current.kind,
          local_date: localDate,
          response_type: exercise.response_type,
          selected_option_id: answer.selectedOptionId ?? null,
          selected_sentence_index: answer.selectedSentenceIndex ?? null,
          submitted_order: answer.submittedOrder ?? null,
          round_answers: answer.roundAnswers ?? null,
          total,
          result,
          reading_seconds: readingSeconds(current.passageOpenedAt, current.questionOpenedAt ?? nowMs),
        },
      });
      logEvent('exercise_completed', current);
      if (!practicedOn(state, localDate)) logEvent('day_practiced');
    }
  }

  /** MC is scored for real by code (SPEC section 4). Returns false if nothing is selected. */
  function submitMultipleChoice(): boolean {
    const current = state.current;
    if (!current?.selectedOptionId) return false;
    const exercise = getExercise(current.exerciseId);
    const scored = scoreMultipleChoice(current.selectedOptionId, exercise.correct_option_id!);
    record(scored.result, scored.score, { selectedOptionId: current.selectedOptionId });
    return true;
  }

  /**
   * Bad Summary (batch 13), scored by code (SPEC section 4). The picked summary is kept as
   * selectedOptionId, and saved in attempts.selected_option_id. Returns false if nothing is picked.
   */
  function submitBadSummary(): boolean {
    const current = state.current;
    if (!current?.selectedOptionId) return false;
    const exercise = getExercise(current.exerciseId);
    const scored = scoreBadSummary(current.selectedOptionId, exercise.wrong_summary_id!);
    record(scored.result, scored.score, { selectedOptionId: current.selectedOptionId });
    return true;
  }

  /**
   * Word Sprint (batch 13), scored by code (SPEC section 4): `picks` has the word tapped in each of
   * the 5 rounds, or null when time ran out.
   */
  function submitWordSprint(picks: (string | null)[]) {
    const current = state.current;
    if (!current) return;
    const exercise = getExercise(current.exerciseId);
    const scored = scoreWordSprint(picks, exercise.rounds!.map((r) => r.answer));
    record(scored.result, scored.score, { roundAnswers: picks }, scored.total);
  }

  /** Tap the sentence, scored by code (SPEC section 4). Returns false if nothing is selected. */
  function submitTapSentence(): boolean {
    const current = state.current;
    if (current?.selectedSentenceIndex == null) return false;
    const exercise = getExercise(current.exerciseId);
    const scored = scoreTapSentence(current.selectedSentenceIndex, exercise.correct_sentence_index!);
    record(scored.result, scored.score, { selectedSentenceIndex: current.selectedSentenceIndex });
    return true;
  }

  /** Put it in order, scored by code (SPEC section 4). Returns false until every item has a number. */
  function submitOrder(): boolean {
    const current = state.current;
    if (!current) return false;
    const exercise = getExercise(current.exerciseId);
    const correctIds = exercise.order_items!.map((item) => item.id);
    if (current.orderPicks.length !== correctIds.length) return false;
    const scored = scoreOrder(current.orderPicks, correctIds);
    record(scored.result, scored.score, { submittedOrder: current.orderPicks });
    return true;
  }

  /**
   * Open text (SPEC section 6). The answer goes to score-response, which asks the AI, lets code
   * decide pass or fail, saves the attempt and returns the result and feedback; it's recorded
   * here when the reply comes. No reply (no signal, error, timeout) is unscored: the day still
   * counts, and no score is guessed. Test-panel answers aren't sent, because score-response saves
   * every attempt it scores and they mustn't count; they show the test feedback instead.
   * Six-word stories go the same way. Returns 'blocked' if the answer is under 8 words, or a story
   * isn't exactly six words (nothing is recorded or sent).
   */
  function submitOpenText(): 'blocked' | 'sent' | 'offline' {
    const current = state.current;
    if (!current || isAnswerBlocked(getExercise(current.exerciseId).response_type, current.draft)) return 'blocked';
    if (!current.counts) {
      record('unscored', null, {});
      return 'sent';
    }
    const exercise = getExercise(current.exerciseId);
    // P6: the date is fixed at submission time, in the user's local time zone.
    const nowMs = now();
    const localDate = localDateFor(nowMs, TIME_ZONE);
    const answer: PendingAnswer = {
      body: {
        exercise_id: exercise.id,
        exercise_version: exercise.version,
        response_text: current.draft,
        kind: current.kind,
        local_date: localDate,
        reading_seconds: readingSeconds(current.passageOpenedAt, current.questionOpenedAt ?? nowMs),
      },
      current,
      nowMs,
      localDate,
    };
    const firstToday = !practicedOn(state, localDate) && pending?.localDate !== localDate;
    pendingIsLatest.current = true;
    setPending(answer);
    logEvent('exercise_completed', current);
    if (firstToday) logEvent('day_practiced');
    if (!online) return 'offline'; // Kept; sent when the signal comes back (below).
    sendPending(answer);
    return 'sent';
  }

  /** Sends the waiting open-text answer. If it doesn't get through, it stays for "Try again". */
  function sendPending(answer: PendingAnswer) {
    setScoring(true);
    setScoringError(false);
    scoreOpenText(answer.body).then((scored) => {
      setScoring(false);
      if (scored.refused) {
        // It can never be scored: drop it (nothing was saved), so the read can be done again.
        setPending(null);
        if (pendingIsLatest.current) setScoringRefused(true);
        setState((s) => (s.current?.exerciseId === answer.current.exerciseId ? { ...s, current: null } : s));
        return;
      }
      if (!scored.saved) {
        setScoringError(true);
        return;
      }
      setPending(null);
      if (scored.result === 'unscored') logEvent('feedback_unscored', answer.current);
      const exercise = getExercise(answer.current.exerciseId);
      setState((s) => {
        const after = recordAttempt({ ...s, current: answer.current }, exercise, scored.result, scored.score, {}, answer.nowMs, answer.localDate, scored.feedback);
        // Scored in the background after the user moved on: keep their latest answer's result for Feedback and Finish.
        if (!pendingIsLatest.current && s.lastResult) after.lastResult = s.lastResult;
        // If something else was opened meanwhile, keep it open.
        const same = s.current?.exerciseId === answer.current.exerciseId;
        return { ...after, current: same ? null : s.current };
      });
    });
  }

  // Batch 10: a waiting answer goes out as soon as there's a signal (not after a server hiccup:
  // that waits for "Try again").
  useEffect(() => {
    if (online && pending && !scoring && !scoringError && historyLoaded) sendPending(pending);
  }, [online, pending, scoring, scoringError, historyLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    today,
    getExercise,
    attempts: state.attempts,
    current: state.current,
    lastResult: state.lastResult,
    /** score-response is reading the latest answer (Feedback shows "Thinking…"). */
    scoring: scoring && pendingIsLatest.current,
    /** The latest answer couldn't reach score-response (Feedback offers "Try again"). */
    scoringError: scoringError && pendingIsLatest.current,
    /** The latest answer was refused for good (Feedback says so and offers Home). */
    scoringRefused,
    /**
     * "Back to Home" from Feedback's error screens. A waiting answer stays on the phone and is
     * tried again later: when its read is reopened, another activity is finished, or the app reopens.
     */
    leaveScoringError: () => {
      setScoringRefused(false);
      pendingIsLatest.current = false;
    },
    /** Reopening a read whose answer is still waiting: show its Feedback again and try to send it. */
    resumePending: () => {
      pendingIsLatest.current = true;
      setScoringRefused(false);
      setScoringError(false);
    },
    /** Feedback's "Try again" after a server hiccup. */
    retryScoring: () => pending && sendPending(pending),
    /** True while an open-text answer for this exercise waits for a signal. */
    waitingForSignal: (exerciseId: string) => pending?.current.exerciseId === exerciseId && !online,
    /** True while an open-text answer for this exercise is waiting or being sent. */
    hasPending: (exerciseId: string) => pending?.current.exerciseId === exerciseId,
    online,
    /** Home's "Try again" or pull down: load exercises and progress again. */
    retryLoad: () => {
      catalogRetry();
      setHistoryError(false);
      setHistoryTry((n) => n + 1);
    },
    homeCard,
    activities,
    /** Dates of saved free-writes (they count as practice days, P6). */
    freeWriteDates,
    streak: currentStreak(state.attempts, today, freeWriteDates),
    daysThisMonth: daysPracticedThisMonth(state.attempts, today, freeWriteDates),
    /** Batch 17: the this-week strip and the weekly goal. */
    week,
    /** Batch 17, Finish: the read just finished is the one that reached the weekly goal. */
    reachedGoal: reachedGoalWithThisRead(week, state.lastResult?.raisedStreak === true),
    /** Story series: "Chapter {n} of {total}" for an exercise, or null if it isn't a chapter. */
    chapterOf: (exerciseId: string) => chapterOf(selectable, exerciseId),
    /** Weekly recap card (Sunday and Monday), or null when hidden. */
    recap: weeklyRecap(state.attempts, freeWriteDates, today, state.recapDismissedWeek),
    /** "Nice": hides the recap until next week. Remembered on this phone (SPEC decision log). */
    dismissRecap: (weekStart: string) => {
      setState((s) => ({ ...s, recapDismissedWeek: weekStart }));
      writeRecapDismissed(userId, weekStart);
    },
    /** Word of the Day (batch 15): today's word, or null when there are no approved words. */
    todaysWord,
    /**
     * "Show me", or (batch 16) picking a meaning: reveals the rest for today. Nothing is scored or
     * recorded beyond this phone.
     */
    revealWord: (pick?: string) => {
      if (!word) return;
      const value: WordRevealed = pick === undefined ? { date: today, wordId: word.id } : { date: today, wordId: word.id, pick };
      setRevealed(value);
      writeJson(phoneKeys.wordRevealed(userId), value);
    },
    /** Say it your way: always on Home. Null only if there's no prompt to serve. */
    sayItPrompt: nextPrompt(SERVED_PROMPTS, state.freeWrites),
    /** The unsaved draft for a prompt, if one was started today. */
    freeWriteDraft: (promptId: string) => draftFor(state, promptId, today),
    setFreeWriteDraft: (promptId: string, text: string) =>
      setState((s) => ({ ...s, freeWriteDraft: { promptId, localDate: today, text } })),
    /** Saves the free-write (batch 9: also to free_writes); it counts as practice for P6 and never affects bands. */
    saveFreeWrite: (promptId: string, text: string) => {
      const nowMs = now();
      const localDate = localDateFor(nowMs, TIME_ZONE);
      if (text.trim() && !practicedOn(state, localDate)) logEvent('day_practiced');
      setState((s) => saveFreeWrite(s, promptId, text, nowMs, localDate));
      if (userId) saveOrQueue(userId, { table: 'free_writes', row: { prompt_id: promptId, text, local_date: localDate } });
    },
    wordsToday: wordsRead(state.attempts, today),
    start,
    /** Dev panel only: opens any bundled exercise; its attempt is not recorded. */
    openAnyExercise: (exerciseId: string) => start({ exerciseId, kind: 'daily' }, false),
    openQuestion: () => {
      const nowMs = now();
      setState((s) => openQuestion(s, nowMs));
    },
    setDraft: (draft: string) => update({ draft }),
    selectOption: (selectedOptionId: string) => update({ selectedOptionId }),
    selectSentence: (selectedSentenceIndex: number) => update({ selectedSentenceIndex }),
    tapOrderItem: (itemId: string) => setState((s) => updateCurrent(s, { orderPicks: tapOrderItem(s.current?.orderPicks ?? [], itemId) })),
    startOrderOver: () => update({ orderPicks: [] }),
    submitMultipleChoice,
    submitBadSummary,
    submitWordSprint,
    submitOpenText,
    submitTapSentence,
    submitOrder,
    /**
     * Dev panel only. Wipes the test user's saved progress with the reset-test-user function
     * (the server refuses anyone else), then starts fresh. Keeps the skipped days.
     */
    resetProgress: async () => {
      const { error } = await supabase.functions.invoke('reset-test-user', { method: 'POST' });
      if (error) {
        console.warn('Reset refused or failed: only the test user can reset.');
        return;
      }
      skillStateSaved.current = 0;
      setState((s) => ({ ...EMPTY_SESSION, dayOffset: s.dayOffset }));
      setAssignmentDay(null);
    },
    /** Dev panel only. */
    skipToTomorrow: () => setState((s) => ({ ...s, dayOffset: s.dayOffset + 1 })),
  };
}

/** Sends one open-text answer to score-response (the app's only AI call, made by the backend). */
async function scoreOpenText(body: Record<string, unknown>): Promise<ScoredOpenText> {
  const timeout = new Promise<ScoredOpenText>((resolve) =>
    setTimeout(() => resolve(readScoreReply(null, true)), SCORING_TIMEOUT_MS),
  );
  const call = supabase.functions
    .invoke('score-response', { body })
    .then(({ data, error }) =>
      readScoreReply(data, Boolean(error), (error as { context?: { status?: number } } | null)?.context?.status),
    )
    .catch(() => readScoreReply(null, true));
  return Promise.race([call, timeout]);
}

/** The user's saved attempts and free-writes, or null if they can't be read (no signal). */
async function loadHistory(): Promise<{ attempts: AttemptRow[]; freeWrites: FreeWriteRow[] } | null> {
  const [attempts, freeWrites] = await Promise.all([
    supabase
      .from('attempts')
      .select('exercise_id,kind,local_date,response_type,result,total,reading_seconds,created_at')
      .order('created_at'),
    supabase.from('free_writes').select('prompt_id,text,local_date,created_at').order('created_at'),
  ]);
  if (attempts.error || freeWrites.error) return null;
  return { attempts: attempts.data as AttemptRow[], freeWrites: freeWrites.data as FreeWriteRow[] };
}

/** The open-text answer waiting to be sent, if any (kept on the phone across restarts). */
const readPending = (userId: string | null) => readJson<PendingAnswer>(phoneKeys.pendingAnswer(userId));
const writePending = (userId: string | null, answer: PendingAnswer | null) => writeJson(phoneKeys.pendingAnswer(userId), answer);

/** The week whose recap was dismissed with "Nice", remembered on this phone. */
const readRecapDismissed = (userId: string | null) => readJson<LocalDate>(phoneKeys.recapDismissed(userId));
const writeRecapDismissed = (userId: string | null, weekStart: LocalDate) => writeJson(phoneKeys.recapDismissed(userId), weekStart);

/** Today's saved choice, if there is one (P4). Null if none, or if it can't be read. */
async function readAssignment(today: LocalDate): Promise<DailyAssignment | null> {
  const { data } = await supabase
    .from('daily_assignments')
    .select('exercise_id,kind')
    .eq('local_date', today)
    .maybeSingle();
  return data ? { exerciseId: data.exercise_id, kind: data.kind as AttemptKind, localDate: today } as DailyAssignment : null;
}

/** Saves today's choice. If one was already saved for today, that one wins and is returned. */
async function saveAssignment(choice: DailyAssignment): Promise<DailyAssignment> {
  const { error } = await supabase
    .from('daily_assignments')
    .insert({ local_date: choice.localDate, exercise_id: choice.exerciseId, kind: choice.kind });
  if (!error) return choice;
  return (await readAssignment(choice.localDate)) ?? choice;
}

type Session = ReturnType<typeof useSessionState>;

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionState();
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
