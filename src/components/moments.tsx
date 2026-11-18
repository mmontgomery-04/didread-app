// Batch 3d, "Moments" (SPEC section 8): small earned animations on correct answers. Each is
// under a second, never blocks a button, and becomes a simple fade when the phone's Reduce
// Motion setting is on. No confetti, bouncing or new words; the only sound is the correct-answer
// chime. Wrong answers get none.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { space, useColors } from '@/theme';

const EASE_OUT = Easing.out(Easing.cubic);

// The correct-answer chime (assets/sounds/correct.wav, made by scripts/make-correct-sound.py).
// Loaded once so it plays without delay. It follows the silent switch, and mixes with anything
// else playing, so it never pauses the user's music or podcast.
const chime = createAudioPlayer(require('@/assets/sounds/correct.wav'));
setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});

function playChime() {
  chime
    .seekTo(0)
    .then(() => chime.play())
    .catch(() => {});
}

/** True when the phone's Reduce Motion setting is on: every moment is then a simple fade. */
export function useReduceMotion(): boolean {
  return useReducedMotion();
}

/**
 * Reveals its content left to right, like ink going down. An invisible copy keeps the layout
 * (and is what VoiceOver reads); the visible copy on top is clipped to a growing width.
 */
export function InkReveal({ children, duration, delay = 0 }: { children: ReactNode; duration: number; delay?: number }) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (width > 0) progress.set(withDelay(delay, withTiming(1, { duration, easing: EASE_OUT })));
  }, [width, delay, duration, progress]);

  const visible = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.get(), width } : { width: width * progress.get() },
  );
  const measure = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.inkBox}>
      <View style={styles.hidden} onLayout={measure}>
        {children}
      </View>
      <Animated.View
        style={[styles.inkVisible, visible]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <View style={{ width }}>{children}</View>
      </Animated.View>
    </View>
  );
}

/** The ✓ that draws itself beside a correct heading, with a light success haptic and the chime. */
export function DrawnCheck({ size }: { size: number }) {
  const colors = useColors();
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    playChime();
  }, []);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <InkReveal duration={400}>
        <Text style={{ color: colors.accent, fontSize: size, lineHeight: size * 1.25, fontWeight: '700' }}>✓</Text>
      </InkReveal>
    </View>
  );
}

/** A bookmark ribbon that drops in beside a streak milestone line. Decorative: VoiceOver skips it. */
export function Ribbon() {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(1, { duration: 1000, easing: EASE_OUT }));
  }, [progress]);

  const drop = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.get()) * -24 }],
  }));

  return (
    <Animated.View style={drop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ribbon, { backgroundColor: colors.accent }]}>
        <View style={[styles.ribbonNotch, { borderBottomColor: colors.background }]} />
      </View>
    </Animated.View>
  );
}

/** Fades its content in (the streak's new number on Finish). */
export function FadeInView({ children, duration = 300 }: { children: ReactNode; duration?: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withTiming(1, { duration, easing: EASE_OUT }));
  }, [duration, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Counts from 0 up to `total` over `duration` ms, starting when the component appears (for
 * step-by-step moments such as the highlighter sweep).
 */
export function useSteps(total: number, duration: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const next = Math.min(total, Math.ceil(((Date.now() - started) / duration) * total));
      setStep(next);
      if (next >= total) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [total, duration]);
  return step;
}

const styles = StyleSheet.create({
  inkBox: { alignSelf: 'flex-start' },
  hidden: { opacity: 0 },
  inkVisible: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  ribbon: { width: 14, height: 24, marginTop: space.xs, alignItems: 'center', justifyContent: 'flex-end' },
  ribbonNotch: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
