// The this-week strip (SPEC section 8, batch 17), on Home and Progress: Monday to Sunday, a mark per
// day (✓ practiced, ○ a past day without practice, · today before practice and days to come), then
// "{n} of {goal} days", or "Weekly goal met ✓" once it's reached. A missed goal is never mentioned.
// VoiceOver reads the whole strip as one line.
import { StyleSheet, Text, View } from 'react-native';

import { a11y, thisWeek as copy } from '@/copy';
import type { ThisWeek } from '@/engine';
import { space, useColors } from '@/theme';

export function WeekStrip({ week }: { week: ThisWeek }) {
  const colors = useColors();
  const practicedNames = week.days.flatMap((d, i) => (d.mark === 'practiced' ? [a11y.dayNames[i]] : []));
  return (
    <View
      accessible
      accessibilityLabel={a11y.thisWeek(practicedNames, week.practiced, week.goal)}
      style={styles.strip}>
      <Text style={[styles.label, { color: colors.muted }]}>{copy.label}</Text>
      <View style={styles.days}>
        {week.days.map((day, i) => {
          const mark = day.mark === 'practiced' ? copy.practiced : day.mark === 'missed' ? copy.missed : copy.open;
          const markColor = day.mark === 'practiced' ? colors.accent : colors.muted;
          return (
            <View key={day.date} style={styles.day}>
              <Text style={[styles.letter, { color: day.isToday ? colors.text : colors.muted }, day.isToday && styles.today]}>
                {copy.dayLetters[i]}
              </Text>
              <Text style={[styles.mark, { color: markColor }, day.mark === 'open' && styles.open]}>{mark}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.progress, { color: week.met ? colors.accent : colors.muted }]}>
        {week.met ? copy.goalMet : copy.progress(week.practiced, week.goal)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.xs },
  label: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  days: { flexDirection: 'row', justifyContent: 'space-between', maxWidth: 320 },
  day: { alignItems: 'center', width: 28, gap: 2 },
  letter: { fontSize: 13 },
  today: { fontWeight: '700', textDecorationLine: 'underline' },
  mark: { fontSize: 18, lineHeight: 22 },
  open: { opacity: 0.5 },
  progress: { fontSize: 15 },
});
