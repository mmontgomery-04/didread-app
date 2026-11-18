// The cover shown when the app opens: "DidRead" in the title serif, white, on
// the app background. It sits on top of the first screen, then gently fades
// away (SPEC section 8: gentle fades only). The native splash before it is
// the same plain background, so the hand-over is seamless.
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { welcome } from '@/copy';
import { colors, fonts } from '@/theme';

const HOLD_MS = 900;
const FADE_MS = 400;

export function Cover() {
  const [opacity] = useState(() => new Animated.Value(1));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);
    animation.start(() => setVisible(false));
    // Backup: always remove the cover, even if the fade never gets to run.
    const backup = setTimeout(() => setVisible(false), HOLD_MS + FADE_MS + 300);
    return () => {
      animation.stop();
      clearTimeout(backup);
    };
  }, [opacity]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.cover, { opacity }]}>
      <Animated.Text style={styles.wordmark}>{welcome.title}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.titleFamily,
    fontWeight: '600',
    fontSize: 52,
    color: colors.wordmark,
  },
});
