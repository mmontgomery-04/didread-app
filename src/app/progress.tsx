// Progress (SPEC section 8, screen 9; batch 9). One bar per skill toward its next step, with no
// labels, numbers or band names, plus words read, minutes reading, days practiced (all-time) and
// the current streak. Everything is computed by ProgressionEngine from the saved attempts.
// Batch 17: the this-week strip after the stats.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Body, Screen, Title } from '@/components/ui';
import { WeekStrip } from '@/components/WeekStrip';
import { progress, skillName } from '@/copy';
import { practicedDates, SKILLS, skillProgress, totalReadingSeconds, wordsRead } from '@/engine';
import { useSession } from '@/state/session';
import { radius, space, useColors } from '@/theme';

export default function ProgressScreen() {
  const session = useSession();
  const colors = useColors();
  const attempts = session.attempts;
  const bars = skillProgress(attempts);
  // Days practiced counts free-writes too (P6); all-time on this screen (founder's decision).
  const daysPracticed = practicedDates(attempts, session.freeWriteDates).size;

  const startToday = () => {
    const card = session.homeCard();
    if (card.state === 'notStarted') {
      session.start(card.selection);
      router.replace('/read');
    } else {
      router.back();
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Title size={24}>{progress.title}</Title>
        {attempts.length === 0 ? (
          <>
            <Body muted>{progress.empty}</Body>
            <Pressable accessibilityRole="link" hitSlop={8} onPress={startToday}>
              <Text style={[styles.link, { color: colors.accent }]}>{progress.startToday}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.bars}>
              {SKILLS.map((skill) => (
                <View key={skill} style={styles.bar} accessible accessibilityLabel={skillName[skill]}>
                  <Body>{skillName[skill]}</Body>
                  <View style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.fill, { backgroundColor: colors.accent, width: `${bars[skill] * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.stats}>
              <Body>{progress.wordsRead(wordsRead(attempts))}</Body>
              <Body>{progress.minutesReading(Math.round(totalReadingSeconds(attempts) / 60))}</Body>
              <Body>{progress.daysPracticed(daysPracticed)}</Body>
              <Body>{progress.currentStreak(session.streak)}</Body>
            </View>
            <WeekStrip week={session.week} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: space.m },
  content: { padding: space.l, paddingTop: space.s, gap: space.l },
  bars: { gap: space.m },
  bar: { gap: space.xs },
  track: { height: 10, borderRadius: radius.button, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fill: { height: '100%' },
  stats: { gap: space.xs },
  link: { fontSize: 17, textDecorationLine: 'underline' },
});
