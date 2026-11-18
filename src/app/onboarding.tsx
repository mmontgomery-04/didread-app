// Onboarding (SPEC section 8, screen 2): four cards, shown once after the first sign-in.
// Card 3 (batch 17) picks the weekly goal: "Next" is greyed out until a choice is tapped, and
// "Not now" sets 3. Card 4 sets the daily reminder (section 8, "Daily reminder"), defaulting to
// 8:00 AM. After "Remind me", the result line shows with the cards' "Next" button to finish (no
// auto-advance), pending the founder's confirmation at checkpoint 1. The goal is saved with the
// rest when onboarding finishes.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoalChoices } from '@/components/GoalChoices';
import { TimeWheel } from '@/components/TimeWheel';
import { Body, Button, Screen, Title } from '@/components/ui';
import { onboarding } from '@/copy';
import { DEFAULT_REMINDER_TIME, DEFAULT_WEEKLY_GOAL, type ReminderTime } from '@/engine';
import { asDate, formatTime, toDbTime } from '@/lib/reminderTime';
import { ensurePermission, scheduleReminders } from '@/notifications/reminders';
import { useAuth } from '@/state/auth';
import { space } from '@/theme';

export default function OnboardingScreen() {
  const { finishOnboarding } = useAuth();
  const [card, setCard] = useState(0);
  const [goal, setGoal] = useState<number | null>(null);
  const [time, setTime] = useState<ReminderTime>(DEFAULT_REMINDER_TIME);
  const [result, setResult] = useState<'granted' | 'denied' | null>(null);
  const [busy, setBusy] = useState(false);
  const last = card === onboarding.cards.length - 1;
  const goalCard = card === onboarding.goalCard;
  const { title, body } = onboarding.cards[card];

  const finish = async (withReminder: boolean) => {
    setBusy(true);
    try {
      await finishOnboarding(withReminder ? toDbTime(time) : null, goal ?? DEFAULT_WEEKLY_GOAL);
    } catch {
      setBusy(false); // No signal: the button works again (error states come in batch 10).
    }
  };

  const remindMe = async () => {
    setBusy(true);
    const granted = await ensurePermission().catch(() => false);
    if (granted) await scheduleReminders(time).catch(() => {});
    setResult(granted ? 'granted' : 'denied');
    setBusy(false);
  };

  /** "Not now" on the goal card: a goal of 3, then the reminder card. */
  const skipGoal = () => {
    setGoal(DEFAULT_WEEKLY_GOAL);
    setCard(card + 1);
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Title size={30}>{title}</Title>
        <Body>{body}</Body>
        {goalCard && <GoalChoices value={goal} onPick={setGoal} />}
        {last && result === null && <TimeWheel value={asDate(time)} onChange={(d) => setTime({ hour: d.getHours(), minute: d.getMinutes() })} />}
        {result === 'granted' && <Body>{onboarding.granted(formatTime(time))}</Body>}
        {result === 'denied' && <Body muted>{onboarding.denied}</Body>}
      </View>
      <View style={styles.footer}>
        {!last && !goalCard && <Button title={onboarding.next} onPress={() => setCard(card + 1)} />}
        {goalCard && (
          <>
            <Button title={onboarding.next} onPress={() => setCard(card + 1)} disabled={goal === null} />
            <Button title={onboarding.notNow} variant="secondary" onPress={skipGoal} />
          </>
        )}
        {last && result === null && (
          <>
            <Button title={onboarding.remindMe} onPress={remindMe} disabled={busy} />
            <Button title={onboarding.notNow} variant="secondary" onPress={() => finish(false)} disabled={busy} />
          </>
        )}
        {last && result !== null && (
          <Button title={onboarding.next} onPress={() => finish(result === 'granted')} disabled={busy} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: space.l, gap: space.m },
  footer: { paddingHorizontal: space.l, paddingBottom: space.m, gap: space.s },
});
