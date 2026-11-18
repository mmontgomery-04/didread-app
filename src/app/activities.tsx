// Activities (SPEC section 8, screen 12; batch 14). Every activity type with its one-line
// description, in COPY.md's order. Locked until today's read is done; then tapping a type starts
// its next bonus read (P4, chosen by ProgressionEngine), or the card says it's all caught up. After
// 2 bonus reads (P5) the screen says so and the cards can't be tapped. Six-word stories are free
// during the beta (batch 16). Story series: a Stories card after the others, shown only once a
// series has approved chapters; it serves the next chapter, in order.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton, Body, Card, Screen, Title } from '@/components/ui';
import { activities as copy } from '@/copy';
import type { Selection, Stories } from '@/engine';
import { useSession } from '@/state/session';
import { space } from '@/theme';

export default function ActivitiesScreen() {
  const session = useSession();
  const { ready, locked, bonusLeft, picks, stories } = session.activities(copy.cards.map((c) => c.type));

  const subtitle = locked ? copy.locked : bonusLeft ? copy.pickNext : copy.bonusUsedUp;

  // Batch 16: Back from the passage comes back to this list. Tapping the same card again continues
  // where they left off; another card starts that one instead.
  const begin = (selection: Selection) => {
    if (session.current?.counts && session.current.exerciseId === selection.exerciseId) {
      router.push('/read');
      return;
    }
    session.start(selection);
    router.push('/read');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Title size={24}>{copy.title}</Title>
          {ready && <Body muted>{subtitle}</Body>}
        </View>
        {copy.cards.map(({ type, name, line }) => {
          const pick = picks.get(type) ?? null;
          const playable = ready && !locked && bonusLeft && pick !== null;
          // The line under each card: why it can't be tapped right now, if that's the card's own reason.
          let status: string | null = null;
          if (ready && locked) status = copy.cardLocked;
          else if (ready && bonusLeft && pick === null) status = copy.caughtUp;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ disabled: !playable }}
              disabled={!playable}
              onPress={() => pick && begin(pick)}
              style={({ pressed }) => (pressed ? styles.pressed : null)}>
              <Card>
                <Title size={20}>{name}</Title>
                <Body muted={!playable}>{line}</Body>
                {status && <Body muted>{status}</Body>}
              </Card>
            </Pressable>
          );
        })}
        {stories.state !== 'none' && (
          <StoriesCard
            stories={stories}
            locked={ready && locked}
            playable={ready && !locked && bonusLeft && stories.state === 'next'}
            onStart={begin}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

/** Story series: "Up next: Chapter {n} of {total}" once a series is started, or all caught up. */
function StoriesCard({
  stories,
  locked,
  playable,
  onStart,
}: {
  stories: Exclude<Stories, { state: 'none' }>;
  locked: boolean;
  playable: boolean;
  onStart: (selection: Selection) => void;
}) {
  const next = stories.state === 'next' ? stories : null;
  const line = next?.started ? copy.storiesUpNext(next.chapter, next.total) : copy.stories.line;
  const status = locked ? copy.cardLocked : stories.state === 'allCaughtUp' ? copy.storiesCaughtUp : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !playable }}
      disabled={!playable}
      onPress={() => next && onStart(next.selection)}
      style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <Card>
        <Title size={20}>{copy.stories.name}</Title>
        <Body muted={!playable}>{line}</Body>
        {status && <Body muted>{status}</Body>}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: space.m },
  content: { padding: space.l, paddingTop: space.s, gap: space.m },
  header: { gap: space.xs, marginBottom: space.s },
  pressed: { opacity: 0.7 },
});
