// Finish (SPEC section 8, screen 8): completion, words read today, streak, tomorrow cue.
// Batch 3d moments: "DidRead ✓" inks in, the streak ticks up when this read raised it, and a
// bookmark ribbon drops in beside a streak milestone line. Batch 17: on the read that reaches the
// weekly goal, its line replaces the tomorrow cue. Story series: after the last chapter, the
// series-end line replaces it too. Each of these shows when it applies, under any milestone line.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FadeInView, InkReveal, Ribbon } from '@/components/moments';
import { Body, Button, Screen, Title } from '@/components/ui';
import { finish, rotateByDay } from '@/copy';
import { useSession } from '@/state/session';
import { space } from '@/theme';

/** The streak's new number appears once "DidRead ✓" has inked in. */
const TICK_DELAY_MS = 500;

export default function FinishScreen() {
  const session = useSession();
  const card = session.homeCard();
  const bonusLeft = card.state === 'done' && card.bonusLeft;
  const firstEver = session.lastResult?.firstEver === true;
  const failed = session.lastResult?.result === 'fail';
  const milestone = finish.milestones[session.streak];
  const finished = session.lastResult ? session.chapterOf(session.lastResult.exerciseId) : null;
  const seriesTitle = finished?.last && session.lastResult ? session.getExercise(session.lastResult.exerciseId).series_title : null;
  const extraLines = [session.reachedGoal ? finish.goalMet : null, seriesTitle ? finish.seriesEnd(seriesTitle) : null].filter(
    (line): line is string => line !== null,
  );
  const cue = milestone ?? (extraLines.length > 0 ? null : rotateByDay(finish.tomorrow, session.today));

  // The streak ticks up by one, only when this read raised it. A new streak's first day has no
  // "0-day streak" to tick from (COPY.md hides the streak at 0), so "1-day streak" just fades in.
  const raised = session.lastResult?.raisedStreak === true;
  const [ticked, setTicked] = useState(!raised || session.streak === 1);
  useEffect(() => {
    if (ticked) return;
    const timer = setTimeout(() => setTicked(true), TICK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ticked]);
  const shownStreak = ticked ? session.streak : session.streak - 1;
  const stats = <Body muted>{finish.stats(session.wordsToday, shownStreak)}</Body>;

  const done = () => router.dismissAll();

  // Batch 14: the bonus button opens Activities, where the user picks the next read.
  const oneMore = () => {
    router.dismissAll();
    router.push('/activities');
  };

  return (
    <Screen>
      <View style={styles.content}>
        {firstEver ? (
          <Title size={36}>{finish.firstBigLine}</Title>
        ) : (
          <InkReveal duration={800}>
            <Title size={36}>{finish.bigLine}</Title>
          </InkReveal>
        )}
        {firstEver && <Body>{finish.firstBody}</Body>}
        {raised && ticked ? <FadeInView>{stats}</FadeInView> : stats}
        {milestone ? (
          <View style={styles.milestone}>
            <Ribbon />
            <View style={styles.flex}>
              <Body>{cue}</Body>
            </View>
          </View>
        ) : (
          cue && <Body>{cue}</Body>
        )}
        {extraLines.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
      </View>
      <View style={styles.footer}>
        <Button title={finish.done} onPress={done} />
        {bonusLeft && <Button title={failed ? finish.oneMoreGo : finish.oneMore} variant="secondary" onPress={oneMore} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: space.l, gap: space.m },
  milestone: { flexDirection: 'row', gap: space.m },
  flex: { flex: 1 },
  footer: { paddingHorizontal: space.l, paddingBottom: space.m, gap: space.s },
});
