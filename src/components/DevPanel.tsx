// Developer-only test panel (SPEC section 9, batch 3). Rendered only when
// __DEV__ is true, so it never appears in production builds. Its labels are
// dev-only and are not in docs/COPY.md.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CONTENT_FILE_EXERCISES, type Exercise } from '@/content/exercises';
import { BANDS, SKILLS } from '@/engine';
import { sendTestReminder } from '@/notifications/reminders';
import { useAuth } from '@/state/auth';
import { useSession } from '@/state/session';
import { space, useColors } from '@/theme';

/** Every exercise, grouped by skill then band (fixed orders), by sequence within a group. */
function groupedExercises(): { label: string; exercises: Exercise[] }[] {
  return SKILLS.flatMap((skill) =>
    BANDS.map((band) => ({
      label: `${skill} · ${band}`,
      exercises: CONTENT_FILE_EXERCISES.filter((e) => e.skill === skill && e.band === band).sort(
        (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id),
      ),
    })).filter((group) => group.exercises.length > 0),
  );
}

export function DevPanel() {
  const session = useSession();
  const auth = useAuth();
  const colors = useColors();
  if (!__DEV__) return null;

  // Attempts opened from this list don't count toward progress or streaks.
  const open = (exerciseId: string) => {
    session.openAnyExercise(exerciseId);
    router.push('/read');
  };

  return (
    <View style={[styles.panel, { borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.muted }]}>Dev · app date {session.today}</Text>
      <View style={styles.row}>
        <Pressable onPress={session.resetProgress} style={[styles.button, styles.flex, { borderColor: colors.muted }]}>
          <Text style={[styles.text, { color: colors.text }]}>Reset progress</Text>
        </Pressable>
        <Pressable onPress={session.skipToTomorrow} style={[styles.button, styles.flex, { borderColor: colors.muted }]}>
          <Text style={[styles.text, { color: colors.text }]}>Skip to tomorrow</Text>
        </Pressable>
      </View>
      {/* Batch 5a: back to Welcome, to test signing in again. */}
      <Pressable onPress={() => auth.signOut()} style={[styles.button, { borderColor: colors.muted }]}>
        <Text style={[styles.text, { color: colors.text }]}>Sign out (test user)</Text>
      </Pressable>
      {/* Batch 11a: today's reminder text in 10 seconds, so the reminder can be checked without waiting a day. */}
      <Pressable onPress={() => sendTestReminder().catch(() => {})} style={[styles.button, { borderColor: colors.muted }]}>
        <Text style={[styles.text, { color: colors.text }]}>Send a test reminder in 10 seconds</Text>
      </Pressable>
      <Text style={[styles.text, { color: colors.muted }]}>
        {`Open any exercise (doesn't count) · ${CONTENT_FILE_EXERCISES.length} in docs/content`}
      </Text>
      {groupedExercises().map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={[styles.text, { color: colors.muted }]}>{group.label}</Text>
          {group.exercises.map((e) => (
            <Pressable key={e.id} onPress={() => open(e.id)} style={[styles.button, { borderColor: colors.muted }]}>
              <Text style={[styles.text, { color: colors.text }]}>
                {e.id} · {e.title} · {e.status}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', paddingTop: space.m, gap: space.s },
  row: { flexDirection: 'row', gap: space.s },
  flex: { flex: 1 },
  group: { gap: space.s, paddingTop: space.s },
  button: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: space.s, alignItems: 'center' },
  text: { fontSize: 13, fontFamily: 'ui-monospace' },
});
