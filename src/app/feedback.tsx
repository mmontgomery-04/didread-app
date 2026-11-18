// Feedback (SPEC section 8, screen 7). MC, tap-the-sentence and order feedback is decided by code.
// Open text shows the AI's feedback from score-response, or the unscored fallback (COPY.md
// section 7). Test-panel answers (development builds) aren't sent and show the test feedback.
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DrawnCheck } from '@/components/moments';
import { Body, Button, Screen, SentenceWithWord, Title } from '@/components/ui';
import type { WordSprintRound } from '@/content/exercises';
import { errors, feedback, rotateByDay } from '@/copy';
import { isWrittenAnswer } from '@/engine';
import { useSession } from '@/state/session';
import { space, useColors } from '@/theme';

export default function FeedbackScreen() {
  const session = useSession();
  const colors = useColors();
  const last = session.lastResult;

  // Oct 15: Back to Home from either error screen. A waiting answer is tried again later.
  const backToHome = () => {
    session.leaveScoringError();
    router.dismissAll();
  };

  // Oct 15: score-response refused the answer for good (rare). It was dropped; the read can be done again.
  if (session.scoringRefused) {
    return (
      <Screen style={styles.center}>
        <Body>{errors.refused}</Body>
        <Button title={errors.backToHome} onPress={backToHome} />
      </Screen>
    );
  }

  // Batch 10: score-response couldn't be reached or failed before scoring. The answer is kept.
  if (session.scoringError) {
    return (
      <Screen style={styles.center}>
        <Body>{errors.serverError}</Body>
        <Button title={errors.tryAgain} onPress={() => session.retryScoring()} />
        <Button title={errors.backToHome} variant="secondary" onPress={backToHome} />
      </Screen>
    );
  }

  // score-response is reading the answer.
  if (session.scoring) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Body muted>{feedback.loading}</Body>
      </Screen>
    );
  }

  if (!last) return <Redirect href="/" />;
  const exercise = session.getExercise(last.exerciseId);
  // Open text and six-word stories: AI feedback, no pass or fail shown.
  const isOpenText = isWrittenAnswer(exercise.response_type);

  let heading: string;
  // Batch 3d: the ✓ draws itself beside a correct heading. Never for open text (no pass or fail shown).
  let correct = false;
  let body: string;
  let list: string[] = [];
  if (isOpenText && !last.counted) {
    heading = rotateByDay(feedback.scoredHeading, session.today);
    body = feedback.testBody;
    list = exercise.rubric!.map((c) => c.level_2);
  } else if (isOpenText && (last.result === 'unscored' || !last.feedbackText)) {
    // The AI failed or timed out, or the daily limit was reached: no score, and the day counts.
    heading = feedback.unscoredHeading;
    body = feedback.unscoredBody;
    list = exercise.rubric!.map((c) => c.level_2);
  } else if (isOpenText) {
    heading = rotateByDay(feedback.scoredHeading, session.today);
    body = last.feedbackText!;
  } else {
    // Multiple choice, tap the sentence and put it in order: scored by code, same headings.
    const passed = last.result === 'pass';
    correct = passed;
    heading = rotateByDay(passed ? feedback.correctHeading : feedback.incorrectHeading, session.today);
    if (exercise.response_type === 'multiple_choice') {
      body = passed ? exercise.mc_feedback!.correct : exercise.mc_feedback!.incorrect_by_option[last.selectedOptionId!];
    } else {
      // Tap the sentence, put it in order, Bad Summary and Word Sprint (whose dots and words in
      // their sentences come below the text).
      body = (passed ? exercise.feedback?.correct : exercise.feedback?.incorrect) ?? '';
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingRow}>
          <Title>{heading}</Title>
          {correct && <DrawnCheck size={28} />}
        </View>
        {body !== '' && <Body>{body}</Body>}
        {exercise.response_type === 'word_sprint' && (
          <SprintResults rounds={exercise.rounds!} picks={last.roundAnswers ?? []} />
        )}
        {list.length > 0 && (
          <View style={styles.list}>
            {list.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.bullet, { color: colors.accent }]}>•</Text>
                <View style={styles.flex}>
                  <Body>{item}</Body>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={feedback.continue} onPress={() => router.replace('/finish')} />
      </View>
    </Screen>
  );
}

/**
 * Batch 13, Word Sprint: a row of ✓ / ○ dots (one per round; decorative, so VoiceOver skips them),
 * then "Here's each word in a sentence:" and each round's example sentence with the word highlighted.
 */
function SprintResults({ rounds, picks }: { rounds: WordSprintRound[]; picks: (string | null)[] }) {
  const colors = useColors();
  const answers = rounds.map((r) => r.answer);
  return (
    <>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {answers.map((answer, i) => {
          const right = picks[i]?.toLowerCase() === answer.toLowerCase();
          return (
            <Text key={i} style={[styles.dot, { color: right ? colors.accent : colors.muted }]}>
              {right ? '✓' : '○'}
            </Text>
          );
        })}
      </View>
      <Body>{feedback.sprintWords}</Body>
      <View style={styles.list}>
        {rounds.map(({ answer, example }) => (
          <View key={answer} style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.accent }]}>•</Text>
            <View style={styles.flex}>
              <SentenceWithWord sentence={example} word={answer} />
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: space.m, padding: space.l },
  content: { padding: space.l, paddingTop: space.xxl, gap: space.m },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  list: { gap: space.s },
  listItem: { flexDirection: 'row', gap: space.s },
  bullet: { fontSize: 17, lineHeight: 25 },
  flex: { flex: 1 },
  dots: { flexDirection: 'row', gap: space.s },
  dot: { fontSize: 24, fontWeight: '700' },
  footer: { paddingHorizontal: space.l, paddingBottom: space.m },
});
