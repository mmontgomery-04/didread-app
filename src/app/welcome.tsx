// Welcome (SPEC section 8, screen 1). Shown whenever nobody is signed in.
// Batch 5b: Apple's own Sign in with Apple button (its text comes from Apple, COPY.md section 1).
// Development builds also keep the test sign-in below it; production builds never include it.
import * as AppleAuthentication from 'expo-apple-authentication';
import { useState, type ComponentType } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Screen } from '@/components/ui';
import { settings, welcome } from '@/copy';
import { signInWithApple } from '@/lib/appleSignIn';
import { openPrivacyPolicy } from '@/lib/privacyPolicy';
import { useAuth } from '@/state/auth';
import { fonts, radius, space, useColors } from '@/theme';

// Development builds only; never bundled in production (npm run check-production).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a plain import would bundle it in production
const DevSignIn: ComponentType | null = __DEV__ ? require('../components/DevSignIn').DevSignIn : null;

export default function WelcomeScreen() {
  const colors = useColors();
  const { state, accountDeleted } = useAuth();
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleFailed, setAppleFailed] = useState(false);
  // Apple's sheet is done and the account is being checked, or signed in with the profile still
  // loading (the first sign-in creates it).
  const signingIn = appleBusy || state.status === 'signedIn';
  const [beforeLink, afterLink] = welcome.finePrint.split(welcome.finePrintLink);

  const signIn = async () => {
    setAppleFailed(false);
    setAppleBusy(true);
    const result = await signInWithApple();
    setAppleBusy(false);
    // Cancelling Apple's sheet does nothing; a failure shows the approved error line.
    if (result === 'failed') setAppleFailed(true);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.spacer} />
        <View style={styles.hero}>
          <Text style={[styles.title, { color: colors.text }]}>{welcome.title}</Text>
          <Text style={[styles.tagline, { color: colors.text }]}>{welcome.tagline}</Text>
          <Body muted>{welcome.body}</Body>
        </View>
        <View style={styles.spacer} />
        {/* Batch 11b: after delete account. */}
        {accountDeleted && <Body>{settings.deleted}</Body>}
        {signingIn ? (
          <Body muted>{welcome.signingIn}</Body>
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.button}
            style={styles.appleButton}
            onPress={signIn}
          />
        )}
        {appleFailed && !signingIn && <Body>{welcome.signInError}</Body>}
        <Text style={[styles.finePrint, { color: colors.muted }]}>
          {beforeLink}
          <Text accessibilityRole="link" onPress={openPrivacyPolicy} style={styles.link}>
            {welcome.finePrintLink}
          </Text>
          {afterLink}
        </Text>
        {DevSignIn && !signingIn && <DevSignIn />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.l, gap: space.m },
  spacer: { flex: 1, minHeight: space.l },
  hero: { gap: space.m, alignItems: 'center' },
  title: { fontFamily: fonts.titleFamily, fontWeight: '600', fontSize: 44, lineHeight: 52 },
  tagline: { fontFamily: fonts.titleFamily, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  appleButton: { height: 52, width: '100%' },
  finePrint: { fontSize: 13, textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
});
