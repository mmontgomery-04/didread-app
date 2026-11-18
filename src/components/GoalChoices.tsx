// The weekly goal choices (batch 17): 2 days / 3 days / 5 days / Every day, on onboarding card 3
// and in Settings. One tap picks; the picked one is filled in the accent color.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { goalChoice } from '@/copy';
import { WEEKLY_GOAL_CHOICES } from '@/engine';
import { radius, space, useColors } from '@/theme';

export function GoalChoices({ value, onPick }: { value: number | null; onPick: (goal: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {WEEKLY_GOAL_CHOICES.map((goal) => {
        const picked = goal === value;
        return (
          <Pressable
            key={goal}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked }}
            onPress={() => onPick(goal)}
            style={({ pressed }) => [
              styles.choice,
              { borderColor: picked ? colors.accent : colors.border, opacity: pressed ? 0.7 : 1 },
              picked && { backgroundColor: colors.accent },
            ]}>
            <Text style={[styles.text, { color: picked ? colors.onAccent : colors.text }]}>{goalChoice(goal)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.m,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: { fontSize: 16 },
});
