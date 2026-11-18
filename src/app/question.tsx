// Question (SPEC section 8, screens 5 and 6): open text, multiple choice, (batch 3b) tap the
// sentence and put it in order, six-word stories (the open-text screen with a six-word check), and
// (batch 13) Bad Summary and Word Sprint, behind a first-time How to play card.
import { Redirect, router } from 'expo-router';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { useReduceMotion, useSteps } from '@/components/moments';
import { BackButton, Body, Button, Label, Screen, Title } from '@/components/ui';
import type { Exercise } from '@/content/exercises';
import { numberSentences } from '@/content/sentences';
import { howToPlay, question } from '@/copy';
import {
  countStoryWords,
  countWords,
  isAnswerBlocked,
  isNewFormat,
  shuffledOrder,
  SPRINT_SECONDS,
  STORY_WORDS,
} from '@/engine';
import { useAuth } from '@/state/auth';
import { readRelaxedMode } from '@/state/relaxedMode';
import { useSession } from '@/state/session';
import { fonts, radius, space, useColors } from '@/theme';

/** SPEC section 6: max response length accepted. */
const MAX_RESPONSE_CHARS = 1000;

export default function QuestionScreen() {
  const session = useSession();
  // Tap the sentence and put it in order stay here after "Check" to show the answer.
  // By then the attempt is recorded and there's no current exercise, so remember which one.
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const exerciseId = checkedId ?? session.current?.exerciseId;
  if (!exerciseId) return <Redirect href="/" />;
  const exercise = session.getExercise(exerciseId);
  const checkable = { exercise, checked: checkedId !== null, onChecked: () => setCheckedId(exercise.id) };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {(exercise.response_type === 'open_text' || exercise.response_type === 'six_word_story') && (
          <OpenText exercise={exercise} />
        )}
        {exercise.response_type === 'multiple_choice' && <MultipleChoice exercise={exercise} />}
        {exercise.response_type === 'tap_sentence' && <TapSentence {...checkable} />}
        {exercise.response_type === 'order' && <PutInOrder {...checkable} />}
        {exercise.response_type === 'bad_summary' && (
          <HowToPlayGate exercise={exercise}>
            <BadSummary {...checkable} />
          </HowToPlayGate>
        )}
        {exercise.response_type === 'word_sprint' && (
          <HowToPlayGate exercise={exercise}>
            <WordSprint exercise={exercise} />
          </HowToPlayGate>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

interface CheckableProps {
  exercise: Exercise;
  /** True once "Check" has scored the answer: the answer is shown, then "Continue". */
  checked: boolean;
  onChecked: () => void;
}

/**
 * Batch 13: the first time someone meets a new format (no earlier attempt of that type), a one-screen
 * How to play card comes first (COPY.md 6g). "Let's go" starts the activity.
 */
function HowToPlayGate({ exercise, children }: { exercise: Exercise; children: ReactNode }) {
  const session = useSession();
  const type = exercise.response_type;
  const [showCard, setShowCard] = useState(
    () => isNewFormat(type) && !session.attempts.some((a) => a.responseType === type),
  );
  if (!showCard || (type !== 'bad_summary' && type !== 'word_sprint')) return children;
  return (
    <>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <View style={styles.howTo}>
        <Label>{howToPlay.title}</Label>
        <Title size={26}>{howToPlay[type]}</Title>
      </View>
      <View style={styles.footer}>
        <Button title={howToPlay.start} onPress={() => setShowCard(false)} />
      </View>
    </>
  );
}

/** Back arrow before checking; after checking there's nothing to go back to. */
function TopBar({ checked }: { checked: boolean }) {
  return (
    <View style={styles.topBar}>
      {checked ? <View style={styles.backSpace} /> : <BackButton onPress={() => router.back()} />}
    </View>
  );
}

/** "Check" until the answer is scored, then "Continue" to Feedback (no auto-advance). */
function CheckOrContinue({ checked, onCheck, dimmed = false }: { checked: boolean; onCheck: () => void; dimmed?: boolean }) {
  if (checked) return <Button title={question.continue} onPress={() => router.replace('/feedback')} />;
  return <Button title={question.check} onPress={onCheck} dimmed={dimmed} />;
}

/** Back to the passage. The draft or picked option stays in the session. */
function ReadAgainLink() {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.dismissTo('/read')} style={styles.link}>
      <Text style={[styles.linkText, { color: colors.accent }]}>{question.readAgain}</Text>
    </Pressable>
  );
}

/** Open text, and six-word stories (COPY.md 6d): an instruction line, a "Words: n of 6" counter and an exactly-six check. */
function OpenText({ exercise }: { exercise: Exercise }) {
  const session = useSession();
  const colors = useColors();
  const draft = session.current?.draft ?? '';
  const story = exercise.response_type === 'six_word_story';
  const blocked = (text: string) => isAnswerBlocked(exercise.response_type, text);
  // Shown after Submit is pressed on a blocked answer, until the answer is fixed.
  const [showBlocked, setShowBlocked] = useState(false);
  const storyWords = countStoryWords(draft);
  const blockedLine = !story
    ? question.tooShort
    : storyWords < STORY_WORDS
      ? question.storyTooFew(storyWords)
      : question.storyTooMany(storyWords);

  const back = () => {
    if (draft.trim().length === 0) return router.back();
    Alert.alert(question.leaveTitle, undefined, [
      { text: question.keepWriting, style: 'cancel' },
      { text: question.leave, onPress: () => router.back() },
    ]);
  };

  // Batch 10: with no signal the answer is kept and sent when the signal returns; then this
  // screen moves on to Feedback by itself.
  const waiting = session.waitingForSignal(exercise.id);
  const [queued, setQueued] = useState(() => session.hasPending(exercise.id));
  useEffect(() => {
    if (queued && (session.scoring || session.scoringError || session.scoringRefused)) router.replace('/feedback');
  }, [queued, session.scoring, session.scoringError, session.scoringRefused]);
  // Oct 15: reopened after "Back to Home" with the answer still waiting: send it again.
  useEffect(() => {
    if (session.hasPending(exercise.id)) session.resumePending();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (blocked(draft)) return setShowBlocked(true);
    const outcome = session.submitOpenText();
    if (outcome === 'sent') router.replace('/feedback');
    if (outcome === 'offline') setQueued(true);
  };

  const onChange = (text: string) => {
    session.setDraft(text);
    if (showBlocked && !blocked(text)) setShowBlocked(false);
  };

  return (
    <>
      <View style={styles.topBar}>
        <BackButton onPress={back} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Label>{question.label}</Label>
        <Title size={24}>{exercise.question}</Title>
        {story && <Body muted>{question.storyInstruction}</Body>}
        <ReadAgainLink />
        <TextInput
          value={draft}
          onChangeText={onChange}
          placeholder={story ? question.storyPlaceholder : question.placeholder}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_RESPONSE_CHARS}
          editable={!queued}
          autoFocus
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {story ? question.storyCounter(storyWords) : question.wordCounter(countWords(draft))}
          </Text>
        </View>
        {showBlocked && <Text style={[styles.hint, { color: colors.text }]}>{blockedLine}</Text>}
        {queued && (
          <Text style={[styles.hint, { color: colors.text }]}>{waiting ? question.offline : question.sending}</Text>
        )}
        <Button title={question.submit} onPress={submit} disabled={queued} />
      </View>
    </>
  );
}

function MultipleChoice({ exercise }: { exercise: Exercise }) {
  const session = useSession();
  const colors = useColors();
  const selected = session.current?.selectedOptionId ?? null;
  const [showNothingSelected, setShowNothingSelected] = useState(false);

  const check = () => {
    if (!session.submitMultipleChoice()) return setShowNothingSelected(true);
    router.replace('/feedback');
  };

  const pick = (id: string) => {
    session.selectOption(id);
    setShowNothingSelected(false);
  };

  return (
    <>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Label>{question.label}</Label>
        <Title size={24}>{exercise.question}</Title>
        <ReadAgainLink />
        <View style={styles.options}>
          {exercise.options!.map((option) => {
            const isSelected = option.id === selected;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => pick(option.id)}
                style={[
                  styles.option,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth * 2,
                  },
                ]}>
                <Text style={[styles.optionText, { color: colors.text }]}>{option.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {showNothingSelected && <Text style={[styles.hint, { color: colors.text }]}>{question.nothingSelected}</Text>}
        <Button title={question.check} onPress={check} />
      </View>
    </>
  );
}

/**
 * Batch 13: Bad Summary. Three one-line summaries (shuffled by exercise id); tap the one that gets
 * the passage wrong. After checking, that summary is highlighted in the accent color and a wrong
 * pick stays visible, muted (like tap the sentence).
 */
function BadSummary({ exercise, checked, onChecked }: CheckableProps) {
  const session = useSession();
  const colors = useColors();
  const [showNothingSelected, setShowNothingSelected] = useState(false);
  const summaries = useMemo(() => shuffledOrder(exercise.id, exercise.summaries!), [exercise.id, exercise.summaries]);
  const picked = checked ? session.lastResult?.selectedOptionId : session.current?.selectedOptionId;
  const wrongId = exercise.wrong_summary_id!;

  const check = () => {
    if (!session.submitBadSummary()) return setShowNothingSelected(true);
    onChecked();
  };

  const pick = (id: string) => {
    if (checked) return;
    session.selectOption(id);
    setShowNothingSelected(false);
  };

  return (
    <>
      <TopBar checked={checked} />
      <ScrollView contentContainerStyle={styles.content}>
        <Label>{question.label}</Label>
        <Title size={24}>{exercise.question}</Title>
        <Body muted>{question.summaryInstruction}</Body>
        {!checked && <ReadAgainLink />}
        <View style={styles.options}>
          {summaries.map((summary) => {
            const isPicked = summary.id === picked;
            const isAnswer = checked && summary.id === wrongId;
            const mutedPick = checked && isPicked && !isAnswer;
            return (
              <Pressable
                key={summary.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isPicked }}
                onPress={() => pick(summary.id)}
                style={[
                  styles.option,
                  {
                    backgroundColor: isAnswer ? colors.accent : colors.surface,
                    borderColor: isAnswer || (!checked && isPicked) ? colors.accent : colors.border,
                    borderWidth: !checked && isPicked ? 2 : StyleSheet.hairlineWidth * 2,
                  },
                ]}>
                <Text
                  style={[
                    styles.optionText,
                    { color: isAnswer ? colors.onAccent : mutedPick ? colors.muted : colors.text },
                    mutedPick && styles.underline,
                  ]}>
                  {summary.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {showNothingSelected && <Text style={[styles.hint, { color: colors.text }]}>{question.summaryNothingSelected}</Text>}
        <CheckOrContinue checked={checked} onCheck={check} />
      </View>
    </>
  );
}

/**
 * Batch 13: Word Sprint. 5 rounds: a definition and 4 words (shuffled per round by exercise id);
 * tapping a word answers the round and moves on. Each round has 10, 9, 8, 7 then 6 seconds, shown
 * as a shrinking bar; when it runs out, "Time's up." and the round counts as wrong. No timer with
 * Relaxed mode (Settings) or VoiceOver on. After round 5 it goes straight to Feedback.
 */
function WordSprint({ exercise }: { exercise: Exercise }) {
  const session = useSession();
  const { userId } = useAuth();
  const colors = useColors();
  const rounds = exercise.rounds!;
  const [relaxed] = useState(() => readRelaxedMode(userId));
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);
  const timed = !relaxed && !screenReader;

  const [round, setRound] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const current = rounds[round];
  const options = useMemo(
    () => shuffledOrder(`${exercise.id}-${round}`, current.options),
    [exercise.id, round, current.options],
  );

  const answer = (pick: string | null) => {
    const next = [...picks, pick];
    if (next.length === rounds.length) {
      session.submitWordSprint(next);
      router.replace('/feedback');
      return;
    }
    setPicks(next);
    setTimedOut(false);
    setRound(round + 1);
  };

  // The round's timer: the bar empties over the round's seconds, then "Time's up." for a second.
  const seconds = SPRINT_SECONDS[round] ?? SPRINT_SECONDS[SPRINT_SECONDS.length - 1];
  const left = useSharedValue(1);
  useEffect(() => {
    if (!timed) return;
    left.set(1);
    left.set(withTiming(0, { duration: seconds * 1000, easing: Easing.linear }));
    const timer = setTimeout(() => setTimedOut(true), seconds * 1000);
    return () => {
      clearTimeout(timer);
      cancelAnimation(left);
    };
  }, [round, timed, seconds, left]);
  useEffect(() => {
    if (!timedOut) return;
    const timer = setTimeout(() => answer(null), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per time-out, with that round's picks
  }, [timedOut]);
  const bar = useAnimatedStyle(() => ({ width: `${left.get() * 100}%` }));

  return (
    <>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Label>{question.label}</Label>
        <Body muted>{question.sprintRound(round + 1)}</Body>
        {timed && (
          <View style={[styles.timerTrack, { backgroundColor: colors.surface }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.View style={[styles.timerBar, { backgroundColor: colors.accent }, bar]} />
          </View>
        )}
        <Body muted>{question.sprintInstruction}</Body>
        <Title size={24}>{current.definition}</Title>
        <View style={styles.options}>
          {options.map((word) => (
            <Pressable
              key={word}
              accessibilityRole="button"
              disabled={timedOut}
              onPress={() => answer(word)}
              style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 }]}>
              <Text style={[styles.optionText, { color: timedOut ? colors.muted : colors.text }]}>{word}</Text>
            </Pressable>
          ))}
        </View>
        {timedOut && <Body>{question.sprintTimeUp}</Body>}
      </ScrollView>
    </>
  );
}

/**
 * Batch 3b: the passage again, each sentence tappable. After checking, the correct sentence
 * is highlighted in the accent color and a wrong pick stays visible in a muted style (no red).
 */
function TapSentence({ exercise, checked, onChecked }: CheckableProps) {
  const session = useSession();
  const colors = useColors();
  const [showNothingSelected, setShowNothingSelected] = useState(false);
  const selected = checked ? session.lastResult?.selectedSentenceIndex : session.current?.selectedSentenceIndex;
  const correct = exercise.correct_sentence_index!;
  // Batch 3d: on a correct answer, the highlight sweeps across the sentence (no animation when wrong).
  const passed = checked && session.lastResult?.result === 'pass';

  const check = () => {
    if (!session.submitTapSentence()) return setShowNothingSelected(true);
    onChecked();
  };

  const pick = (index: number) => {
    if (checked) return;
    session.selectSentence(index);
    setShowNothingSelected(false);
  };

  const sentenceStyle = (index: number) => {
    if (checked && index === correct) return { backgroundColor: colors.accent, color: colors.onAccent };
    if (checked && index === selected) return { color: colors.muted, textDecorationLine: 'underline' as const };
    if (!checked && index === selected) {
      return { backgroundColor: colors.surface, textDecorationLine: 'underline' as const, textDecorationColor: colors.accent };
    }
    return null;
  };

  return (
    <>
      <TopBar checked={checked} />
      <ScrollView contentContainerStyle={styles.content}>
        <Label>{question.label}</Label>
        <Title size={24}>{exercise.question}</Title>
        <Body muted>{question.tapInstruction}</Body>
        <View style={styles.passage}>
          {numberSentences(exercise.sentences!).map((paragraph, p) => (
            <Text key={p} style={[fonts.passage, { color: colors.text }]}>
              {paragraph.map(({ index, text }, i) => (
                <Fragment key={index}>
                  {i > 0 && ' '}
                  {/* "link" keeps each sentence inline in its paragraph, and VoiceOver can reach it. */}
                  <Text
                    accessibilityRole="link"
                    accessibilityState={{ selected: index === selected }}
                    onPress={() => pick(index)}
                    style={passed && index === correct ? null : sentenceStyle(index)}>
                    {passed && index === correct ? <SweptHighlight text={text} /> : text}
                  </Text>
                </Fragment>
              ))}
            </Text>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {showNothingSelected && <Text style={[styles.hint, { color: colors.text }]}>{question.tapNothingSelected}</Text>}
        <CheckOrContinue checked={checked} onCheck={check} />
      </View>
    </>
  );
}

/**
 * Batch 3b: tap the items in order; each tapped item shows its number. After checking, a correct
 * answer shows the items numbered 1 to n; a wrong one keeps the user's own order and numbers,
 * muted (like a wrong pick in tap the sentence). No per-item marks either way.
 */
function PutInOrder({ exercise, checked, onChecked }: CheckableProps) {
  const session = useSession();
  const colors = useColors();
  const [showIncomplete, setShowIncomplete] = useState(false);
  const items = exercise.order_items!;
  const shuffled = useMemo(() => shuffledOrder(exercise.id, items), [exercise.id, items]);
  const picks = session.current?.orderPicks ?? [];
  const complete = picks.length === items.length;

  const check = () => {
    if (!complete || !session.submitOrder()) return setShowIncomplete(true);
    onChecked();
  };

  const tap = (itemId: string) => {
    if (checked) return;
    session.tapOrderItem(itemId);
    setShowIncomplete(false);
  };

  const startOver = () => {
    session.startOrderOver();
    setShowIncomplete(false);
  };

  // Batch 3d: on a correct answer, the numbers fill in one by one (the items don't move).
  const passed = checked && session.lastResult?.result === 'pass';
  const wrong = checked && !passed;
  const submitted = (session.lastResult?.submittedOrder ?? []).flatMap((id) => items.filter((item) => item.id === id));
  const list = !checked ? shuffled : passed || submitted.length !== items.length ? items : submitted;
  const reduceMotion = useReduceMotion();
  const numberOf = (itemId: string, position: number) => (checked ? position + 1 : picks.indexOf(itemId) + 1 || null);

  return (
    <>
      <TopBar checked={checked} />
      <ScrollView contentContainerStyle={styles.content}>
        <Label>{question.label}</Label>
        <Title size={24}>{exercise.question}</Title>
        {!checked && <ReadAgainLink />}
        <Body>{exercise.order_instruction!}</Body>
        {!checked && <Body muted>{question.orderHelper}</Body>}
        <View style={styles.options}>
          {list.map((item, position) => {
            const number = numberOf(item.id, position);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => tap(item.id)}
                style={[
                  styles.option,
                  styles.orderItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: number && !wrong ? colors.accent : colors.border,
                    borderWidth: number && !checked ? 2 : StyleSheet.hairlineWidth * 2,
                  },
                ]}>
                <View
                  style={[
                    styles.badge,
                    number ? { backgroundColor: wrong ? colors.muted : colors.accent } : { borderColor: colors.muted, borderWidth: 1.5 },
                  ]}>
                  {number &&
                    (passed ? (
                      <Animated.Text entering={fillIn(position, reduceMotion)} style={[styles.badgeText, { color: colors.onAccent }]}>
                        {number}
                      </Animated.Text>
                    ) : (
                      <Text style={[styles.badgeText, { color: colors.onAccent }]}>{number}</Text>
                    ))}
                </View>
                <Text style={[styles.optionText, styles.flex, { color: wrong ? colors.muted : colors.text }]}>{item.text}</Text>
              </Pressable>
            );
          })}
        </View>
        {!checked && picks.length > 0 && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={startOver} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.accent }]}>{question.startOver}</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {showIncomplete && <Text style={[styles.hint, { color: colors.text }]}>{question.orderIncomplete}</Text>}
        <CheckOrContinue checked={checked} onCheck={check} dimmed={!complete} />
      </View>
    </>
  );
}

/**
 * Batch 3d: the correct sentence's highlight sweeps across it word by word, like a highlighter
 * pen, line after line (about 0.5 s). With Reduce Motion on, the highlight fades in instead.
 */
function SweptHighlight({ text }: { text: string }) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const words = useMemo(() => text.match(/\S+\s*/g) ?? [text], [text]);
  const steps = reduceMotion ? FADE_STEPS : words.length;
  const step = useSteps(steps, 500);
  const on = { backgroundColor: colors.accent, color: colors.onAccent };
  if (reduceMotion) {
    const alpha = step / FADE_STEPS;
    return <Text style={{ backgroundColor: withAlpha(colors.accent, alpha), color: alpha > 0.5 ? colors.onAccent : colors.text }}>{text}</Text>;
  }
  return words.map((word, i) => (
    <Text key={i} style={i < step ? on : null}>
      {word}
    </Text>
  ));
}

const FADE_STEPS = 10;

/** "#RRGGBB" with an opacity, for the Reduce Motion fade of the highlight. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Batch 3d: put it in order's numbers fill in one by one (about 0.6 s), or fade in with Reduce Motion on. */
function fillIn(position: number, reduceMotion: boolean) {
  if (reduceMotion) return FadeIn.duration(300).reduceMotion(ReduceMotion.Never);
  return ZoomIn.delay(position * 80).duration(220).easing(Easing.out(Easing.cubic));
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: space.m },
  backSpace: { height: 44 },
  passage: { gap: space.m, marginTop: space.s },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 16, fontWeight: '700' },
  content: { padding: space.l, paddingTop: space.s, gap: space.m },
  input: {
    minHeight: 160,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: space.m,
    paddingTop: space.m,
    fontSize: 17,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  footer: { paddingHorizontal: space.l, paddingBottom: space.m, paddingTop: space.s, gap: space.s },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  hint: { fontSize: 15 },
  link: { alignSelf: 'flex-start' },
  linkText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  options: { gap: space.s, marginTop: space.s },
  option: { borderRadius: radius.card, padding: space.m },
  optionText: { fontSize: 17, lineHeight: 24 },
  underline: { textDecorationLine: 'underline' },
  timerTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  timerBar: { height: 6, borderRadius: 3 },
  howTo: { flex: 1, padding: space.l, gap: space.m, justifyContent: 'center' },
});
