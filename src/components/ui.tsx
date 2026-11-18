// Small building blocks shared by the screens. Colors and fonts come from src/theme.
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { wholeWordIndex } from '@/content/sentences';
import { a11y } from '@/copy';
import { fonts, radius, space, useColors } from '@/theme';

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  dimmed = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Looks greyed out but can still be pressed (e.g. to explain why it isn't ready yet). */
  dimmed?: boolean;
}) {
  const colors = useColors();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || dimmed }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.accent }
          : { borderColor: colors.accent, borderWidth: StyleSheet.hairlineWidth * 2 },
        { opacity: disabled || dimmed ? 0.5 : pressed ? 0.75 : 1 },
      ]}>
      <Text style={[styles.buttonText, { color: primary ? colors.onAccent : colors.accent }]}>{title}</Text>
    </Pressable>
  );
}

/** A chevron with no words, top left. */
export function BackButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y.back} onPress={onPress} hitSlop={12} style={styles.back}>
      <SymbolView name="chevron.left" size={22} weight="medium" tintColor={colors.text} />
    </Pressable>
  );
}

/** A grid with no words, top right of Home beside Progress and Settings; opens Activities (batch 14). */
export function ActivitiesButton() {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y.activities}
      onPress={() => router.push('/activities')}
      hitSlop={12}
      style={styles.gear}>
      <SymbolView name="square.grid.2x2" size={22} weight="medium" tintColor={colors.muted} />
    </Pressable>
  );
}

/** A chart with no words, top right of Home next to the gear; opens Progress (batch 9). */
export function ProgressButton() {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y.progress}
      onPress={() => router.push('/progress')}
      hitSlop={12}
      style={styles.gear}>
      <SymbolView name="chart.bar" size={22} weight="medium" tintColor={colors.muted} />
    </Pressable>
  );
}

/** A gear with no words, top right of Home; opens Settings. */
export function SettingsButton() {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y.settings}
      onPress={() => router.push('/settings')}
      hitSlop={12}
      style={styles.gear}>
      <SymbolView name="gearshape" size={22} weight="medium" tintColor={colors.muted} />
    </Pressable>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: colors.muted }]}>{children}</Text>;
}

export function Title({ children, size = 28 }: { children: ReactNode; size?: number }) {
  const colors = useColors();
  return (
    <Text style={[styles.title, { color: colors.text, fontSize: size, lineHeight: size * 1.25 }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const colors = useColors();
  return <Text style={[styles.body, { color: muted ? colors.muted : colors.text }]}>{children}</Text>;
}

/**
 * A sentence with `word` in bold accent green (Word Sprint's Feedback, Word of the Day). Word of the
 * Day's example is in italics, so it reads as an example without a label (batch 16).
 */
export function SentenceWithWord({ sentence, word, italic = false }: { sentence: string; word: string; italic?: boolean }) {
  const colors = useColors();
  const at = wholeWordIndex(sentence, word);
  return (
    <Text style={[styles.body, italic && styles.italic, { color: colors.text }]}>
      {at < 0 ? (
        sentence
      ) : (
        <>
          {sentence.slice(0, at)}
          <Text style={[styles.highlight, { color: colors.accent }]}>{sentence.slice(at, at + word.length)}</Text>
          {sentence.slice(at + word.length)}
        </>
      )}
    </Text>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  button: {
    minHeight: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.l,
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  gear: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  title: { fontFamily: fonts.titleFamily, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25 },
  highlight: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.l,
    gap: space.s,
  },
});
