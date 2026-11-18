// Say it your way (SPEC section 8, screen 11; batch 3c): an ungraded, AI-free, private
// free-write. No minimum length, but Save needs at least one character. Leaving without
// saving keeps the draft silently for the rest of the day.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BackButton, Body, Button, Screen, Title } from '@/components/ui';
import { sayItYourWay } from '@/copy';
import { useSession } from '@/state/session';
import { radius, space, useColors } from '@/theme';

export default function SayItYourWayScreen() {
  const session = useSession();
  const colors = useColors();
  // Kept from when the screen opened: after saving, the card moves on to the next prompt.
  const [prompt] = useState(session.sayItPrompt);
  const [saved, setSaved] = useState(false);
  if (!prompt) return <Redirect href="/" />;

  const text = session.freeWriteDraft(prompt.id);
  const canSave = text.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    session.saveFreeWrite(prompt.id, text);
    setSaved(true);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.topBar}>{saved ? <View style={styles.backSpace} /> : <BackButton onPress={() => router.back()} />}</View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title size={24}>{sayItYourWay.title}</Title>
          <Body muted>{prompt.text}</Body>
          {saved ? (
            <Body>{sayItYourWay.saved}</Body>
          ) : (
            <TextInput
              value={text}
              onChangeText={(value) => session.setFreeWriteDraft(prompt.id, value)}
              placeholder={sayItYourWay.placeholder}
              placeholderTextColor={colors.muted}
              multiline
              autoFocus
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
          )}
        </ScrollView>
        <View style={styles.footer}>
          {saved ? (
            <Button title={sayItYourWay.done} onPress={() => router.dismissTo('/')} />
          ) : (
            <Button title={sayItYourWay.save} onPress={save} disabled={!canSave} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: space.m },
  backSpace: { height: 44 },
  content: { padding: space.l, paddingTop: space.s, gap: space.m },
  input: {
    minHeight: 200,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: space.m,
    paddingTop: space.m,
    fontSize: 17,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  footer: { paddingHorizontal: space.l, paddingBottom: space.m, paddingTop: space.s },
});
