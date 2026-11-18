// Read (SPEC section 8, screen 4). The passage, then "I read it". Word Sprint has no passage
// (batch 13), so it goes straight on to the question; every way into an exercise comes through here.
// Story series chapters: "Chapter {n} of {total}" under the title and, from chapter 2, the
// "Previously" recap above the passage (not part of the passage or its word count).
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Body, Button, Label, Screen, Title } from '@/components/ui';
import { read, skillName } from '@/copy';
import { useSession } from '@/state/session';
import { fonts, space, useColors } from '@/theme';

export default function ReadScreen() {
  const session = useSession();
  const colors = useColors();
  const sprint = session.current ? session.getExercise(session.current.exerciseId).response_type === 'word_sprint' : false;
  useEffect(() => {
    if (!sprint) return;
    session.openQuestion();
    router.replace('/question');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when a Word Sprint is opened
  }, [sprint]);
  if (!session.current) return <Redirect href="/" />;
  if (sprint) return <Screen>{null}</Screen>;

  const exercise = session.getExercise(session.current.exerciseId);
  const paragraphs = exercise.passage.split(/\n\s*\n/);
  const chapter = session.chapterOf(exercise.id);

  const done = () => {
    session.openQuestion();
    router.push('/question');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Label>{skillName[exercise.skill]}</Label>
        <Title>{exercise.title}</Title>
        {chapter && <Body muted>{read.chapter(chapter.chapter, chapter.total)}</Body>}
        {chapter && exercise.previously && (
          <View style={styles.previously}>
            <Label>{read.previously}</Label>
            <Body muted>{exercise.previously}</Body>
          </View>
        )}
        <View style={styles.passage}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={[fonts.passage, { color: colors.text }]}>
              {p}
            </Text>
          ))}
        </View>
        <Button title={read.done} onPress={done} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: space.m },
  content: { padding: space.l, paddingTop: space.s, gap: space.m, paddingBottom: space.xxl },
  passage: { gap: space.m, marginTop: space.s, marginBottom: space.l },
  previously: { gap: space.xs, marginTop: space.s },
});
