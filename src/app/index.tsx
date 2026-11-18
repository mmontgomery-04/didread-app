// Home (SPEC section 8, screen 3). States: not started, in progress, done today, no content.
// Batch 3c: the weekly recap card (Sunday and Monday) and the Say it your way card (always).
// Batch 14: the Activities icon, and the bonus button opens Activities.
// Batch 15: the Word of the Day card, right after Today's read. Batch 16: a 3-way choice when the
// word has its wrong meanings. Batch 17: the this-week strip under the stats row, and the recap's
// "Weekly goal met." line.
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/components/moments';
import {
  ActivitiesButton,
  Body,
  Button,
  Card,
  Label,
  ProgressButton,
  Screen,
  SentenceWithWord,
  SettingsButton,
  Title,
} from '@/components/ui';
import { DevPanel } from '@/components/DevPanel';
import { WeekStrip } from '@/components/WeekStrip';
import { errors, home, rotateByDay } from '@/copy';
import { estimatedMinutes, type Selection } from '@/engine';
import { useSession } from '@/state/session';
import { radius, space, useColors } from '@/theme';

export default function HomeScreen() {
  const session = useSession();
  const colors = useColors();
  const card = session.homeCard();
  const { recap, sayItPrompt, todaysWord } = session;

  const begin = (selection: Selection) => {
    session.start(selection);
    router.push('/read');
  };

  // Always back to the passage; "I read it" then reopens the question with the draft.
  const keepGoing = () => router.push('/read');

  return (
    <Screen>
      {/* Batch 10: pull down to load again (COPY.md "Couldn't load"). */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={session.retryLoad} tintColor={colors.muted} />}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Title size={32}>{home.greeting(new Date().getHours())}</Title>
            <View style={styles.icons}>
              <ActivitiesButton />
              <ProgressButton />
              <SettingsButton />
            </View>
          </View>
          <View style={styles.stats}>
            {session.streak > 0 && (
              <Text style={[styles.stat, { color: colors.muted }]}>{home.streak(session.streak)}</Text>
            )}
            <Text style={[styles.stat, { color: colors.muted }]}>{home.month(session.daysThisMonth)}</Text>
          </View>
          <WeekStrip week={session.week} />
        </View>

        {/* Batch 6b: no card while the exercises and today's saved choice load. */}
        {card.state !== 'loading' && (
          <Card>
            {card.state === 'notStarted' && (
              <>
                <Label>{home.label}</Label>
                <Title>{card.exercise.title}</Title>
                <Body muted>{home.meta(card.exercise.skill, estimatedMinutes(card.exercise.word_count))}</Body>
                <View style={styles.cardButton}>
                  <Button title={home.start} onPress={() => begin(card.selection)} />
                </View>
              </>
            )}

            {card.state === 'inProgress' && (
              <>
                <Label>{home.label}</Label>
                <Title>{card.exercise.title}</Title>
                <Body muted>{home.inProgressBody}</Body>
                <View style={styles.cardButton}>
                  <Button title={home.keepGoing} onPress={keepGoing} />
                </View>
              </>
            )}

            {card.state === 'done' && (
              <>
                <Label>{home.doneLabel}</Label>
                <Title>{home.doneTitle}</Title>
                <Body>{rotateByDay(home.doneBody, session.today)}</Body>
                <View style={styles.cardButton}>
                  {card.bonusLeft ? (
                    <Button title={home.bonus} variant="secondary" onPress={() => router.push('/activities')} />
                  ) : (
                    <Body muted>{home.bonusUsedUp}</Body>
                  )}
                </View>
              </>
            )}

            {card.state === 'noContent' && (
              <>
                <Title>{home.noContentTitle}</Title>
                <Body muted>{home.noContentBody}</Body>
              </>
            )}

            {card.state === 'error' && (
              <>
                <Body>{errors.couldntLoad}</Body>
                <View style={styles.cardButton}>
                  <Button title={errors.tryAgain} variant="secondary" onPress={session.retryLoad} />
                </View>
              </>
            )}
          </Card>
        )}

        {/* Order (SPEC section 8): Today's read, Word of the Day, the weekly recap, then Say it your way. */}
        {todaysWord && (
          <Card>
            <Label>{home.wordLabel}</Label>
            <Title>{todaysWord.word}</Title>
            {todaysWord.revealed ? (
              <FadeInView>
                {todaysWord.picked === todaysWord.meaning ? (
                  // Right: their line, and a brief reminder of the meaning.
                  <View style={styles.lines}>
                    <Body>{todaysWord.right_message}</Body>
                    <Body muted>{todaysWord.meaning}</Body>
                  </View>
                ) : (
                  // Wrong pick, or "Show me": the line (if they picked), then everything.
                  <View style={styles.lines}>
                    {todaysWord.picked !== null && <Body>{todaysWord.wrong_message}</Body>}
                    <Body muted>{todaysWord.part_of_speech}</Body>
                    <Body>{todaysWord.meaning}</Body>
                    <SentenceWithWord sentence={todaysWord.example} word={todaysWord.word} italic />
                  </View>
                )}
              </FadeInView>
            ) : (
              <>
                <Body muted>{home.wordPrompt}</Body>
                {todaysWord.choices ? (
                  <View style={styles.choices}>
                    {todaysWord.choices.map((meaning) => (
                      <Pressable
                        key={meaning}
                        accessibilityRole="button"
                        onPress={() => session.revealWord(meaning)}
                        style={({ pressed }) => [
                          styles.choice,
                          { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}>
                        <Text style={[styles.choiceText, { color: colors.text }]}>{meaning}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.cardButton}>
                    <Button title={home.wordReveal} variant="secondary" onPress={() => session.revealWord()} />
                  </View>
                )}
              </>
            )}
          </Card>
        )}

        {recap && (
          <Card>
            <Title>{home.recapTitle}</Title>
            <View style={styles.lines}>
              <Body>{home.recapDays(recap.daysPracticed)}</Body>
              <Body>{home.recapWords(recap.wordsRead)}</Body>
              <Body>{home.recapReads(recap.readsFinished)}</Body>
              {recap.mostPracticed && <Body>{home.recapMostPracticed(recap.mostPracticed)}</Body>}
              {recap.daysPracticed === 7 && <Body>{home.recapPerfectWeek}</Body>}
              {recap.daysPracticed >= session.week.goal && <Body>{home.recapGoalMet}</Body>}
            </View>
            <View style={styles.cardButton}>
              <Button title={home.recapNice} variant="secondary" onPress={() => session.dismissRecap(recap.weekStart)} />
            </View>
          </Card>
        )}

        {sayItPrompt && (
          <Card>
            <Label>{home.sayItLabel}</Label>
            <Title size={22}>{sayItPrompt.text}</Title>
            <Body muted>{home.sayItNote}</Body>
            <View style={styles.cardButton}>
              <Button title={home.sayItWrite} onPress={() => router.push('/say-it')} />
            </View>
          </Card>
        )}

        <View style={styles.spacer} />
        <DevPanel />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.l, gap: space.xl },
  header: { gap: space.s, marginTop: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icons: { flexDirection: 'row' },
  stats: { flexDirection: 'row', gap: space.m },
  stat: { fontSize: 15 },
  cardButton: { marginTop: space.m },
  lines: { gap: space.xs, marginTop: space.s },
  choices: { gap: space.s, marginTop: space.s },
  choice: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.m },
  choiceText: { fontSize: 17, lineHeight: 24 },
  spacer: { flex: 1 },
});
