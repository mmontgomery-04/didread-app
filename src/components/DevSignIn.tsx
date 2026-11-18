// Development builds only (batch 5a): sign in as the test user by typing its email and password.
// The password goes straight to Supabase and is never stored; only the session Supabase returns
// is kept, the same way Sign in with Apple's will be (batch 5b swaps only this step).
// This file is loaded with `__DEV__ ? require(...) : null`, so production builds never include
// it; `npm run check-production` proves that. Its labels are dev-only and not in docs/COPY.md.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { welcome } from '@/copy';
import { supabase } from '@/lib/supabase';
import { radius, space, useColors } from '@/theme';

export function DevSignIn() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setFailed(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    setPassword('');
    if (error) setFailed(true);
  };

  const input = [styles.input, { color: colors.text, borderColor: colors.muted }];
  return (
    <View style={[styles.panel, { borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.muted }]}>Dev · Sign in as test user</Text>
      <TextInput
        style={input}
        value={email}
        onChangeText={setEmail}
        placeholder="Test user email"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
      />
      <TextInput
        style={input}
        value={password}
        onChangeText={setPassword}
        placeholder="Test user password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        textContentType="password"
      />
      <Pressable
        onPress={signIn}
        disabled={busy || !email || !password}
        style={[styles.button, { borderColor: colors.muted, opacity: busy || !email || !password ? 0.5 : 1 }]}>
        <Text style={[styles.text, { color: colors.text }]}>{busy ? welcome.signingIn : 'Sign in as test user'}</Text>
      </Pressable>
      {failed && <Text style={[styles.text, { color: colors.text }]}>{welcome.signInError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', paddingTop: space.m, gap: space.s },
  input: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.button, padding: space.s, fontSize: 15 },
  button: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: space.s, alignItems: 'center' },
  text: { fontSize: 13, fontFamily: 'ui-monospace' },
});
