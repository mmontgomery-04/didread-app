import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { Cover } from '@/components/Cover';
import { CatalogProvider } from '@/content/catalog';
import { topUpReminders } from '@/notifications/reminders';
import { AuthProvider, useAuth } from '@/state/auth';
import { SessionProvider } from '@/state/session';
import { colors } from '@/theme';

// The app is always dark (SPEC section 8).
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  // Daily reminder (batch 11a): each time the app opens, schedule 30 days ahead again.
  useEffect(() => {
    const topUp = () => topUpReminders().catch(() => {});
    topUp();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && topUp());
    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Screens />
        <Cover />
      </ThemeProvider>
    </AuthProvider>
  );
}

/**
 * Batch 5a: Welcome until someone is signed in (and while their profile loads), Onboarding once,
 * then the app. Exercises and progress are per user: a different user starts fresh.
 */
function Screens() {
  const { state, userId } = useAuth();
  const profile = state.status === 'signedIn' ? state.profile : null;
  const ready = profile !== null;
  return (
    <CatalogProvider key={userId ?? 'signed-out'} userId={ready ? userId : null}>
      <SessionProvider>
        {/* Motion: gentle fades between screens; small "moments" on correct answers (SPEC section 8, batch 3d). */}
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Protected guard={!ready}>
            <Stack.Screen name="welcome" />
          </Stack.Protected>
          <Stack.Protected guard={ready && !profile.onboarding_done}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={ready && profile.onboarding_done}>
            <Stack.Screen name="index" />
            <Stack.Screen name="read" />
            {/* No swipe-back: the back button asks before leaving a typed answer. */}
            <Stack.Screen name="question" options={{ gestureEnabled: false }} />
            <Stack.Screen name="feedback" options={{ gestureEnabled: false }} />
            <Stack.Screen name="finish" options={{ gestureEnabled: false }} />
            {/* Swiping back is fine: an unsaved free-write is kept as a draft. */}
            <Stack.Screen name="say-it" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="progress" />
            <Stack.Screen name="activities" />
          </Stack.Protected>
        </Stack>
      </SessionProvider>
    </CatalogProvider>
  );
}
