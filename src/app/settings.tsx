// Settings (SPEC section 8, screen 10). Batch 11a: the daily reminder toggle, its time and the
// version footer. Batch 11b: sign out and delete account, each with its confirm prompt; both
// cancel the reminders and clear what's kept on the phone. Batch 12: the Privacy Policy link.
// The reminder setting is read back from what iOS has scheduled, so the two can't disagree.
// Batch 13: Relaxed mode, which removes game timers. Batch 17: the weekly goal, saved in the profile;
// a change applies to this week right away.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { GoalChoices } from '@/components/GoalChoices';
import { TimeWheel } from '@/components/TimeWheel';
import { BackButton, Body, Card, Screen, Title } from '@/components/ui';
import { settings } from '@/copy';
import { DEFAULT_REMINDER_TIME, weeklyGoalOrDefault, type ReminderTime } from '@/engine';
import { openPrivacyPolicy } from '@/lib/privacyPolicy';
import { asDate, formatTime } from '@/lib/reminderTime';
import { cancelReminders, ensurePermission, readReminderSetting, scheduleReminders } from '@/notifications/reminders';
import { readRelaxedMode, writeRelaxedMode } from '@/state/relaxedMode';
import { useAuth } from '@/state/auth';
import { space, useColors } from '@/theme';

export default function SettingsScreen() {
  const colors = useColors();
  const auth = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const confirmSignOut = () =>
    Alert.alert(settings.signOutConfirm, undefined, [
      { text: settings.cancel, style: 'cancel' },
      { text: settings.signOut, onPress: () => auth.signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert(settings.deleteTitle, settings.deleteBody, [
      { text: settings.cancel, style: 'cancel' },
      {
        text: settings.deleteForever,
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setDeleteFailed(false);
          // On success the app signs out and Welcome says the account is deleted. Closing Apple's
          // sheet (Apple accounts) deletes nothing and shows nothing.
          const outcome = await auth.deleteAccount();
          if (outcome !== 'deleted') {
            setDeleting(false);
            setDeleteFailed(outcome === 'failed');
          }
        },
      },
    ]);
  const [relaxed, setRelaxed] = useState(() => readRelaxedMode(auth.userId));
  const toggleRelaxed = (next: boolean) => {
    setRelaxed(next);
    writeRelaxedMode(auth.userId, next);
  };
  const weeklyGoal = weeklyGoalOrDefault(auth.state.status === 'signedIn' ? auth.state.profile?.weekly_goal : null);
  const [on, setOn] = useState(false);
  const [time, setTime] = useState<ReminderTime>(DEFAULT_REMINDER_TIME);
  const [denied, setDenied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    readReminderSetting()
      .then((setting) => {
        setOn(setting.on);
        if (setting.time) setTime(setting.time);
      })
      .catch(() => {});
  }, []);

  const toggle = async (next: boolean) => {
    if (!next) {
      setOn(false);
      setPickerOpen(false);
      await cancelReminders().catch(() => {});
      return;
    }
    // Blocked: the toggle stays off and the "Denied" line shows (SPEC decision log).
    const granted = await ensurePermission().catch(() => false);
    setDenied(!granted);
    if (!granted) return;
    setOn(true);
    await scheduleReminders(time).catch(() => {});
  };

  const pick = (date: Date) => {
    const next = { hour: date.getHours(), minute: date.getMinutes() };
    setTime(next);
    scheduleReminders(next).catch(() => {});
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Title size={24}>{settings.title}</Title>
        <Card>
          <View style={styles.row}>
            <Body>{settings.dailyReminder}</Body>
            <Switch
              value={on}
              onValueChange={toggle}
              trackColor={{ true: colors.accent }}
              accessibilityLabel={settings.dailyReminder}
            />
          </View>
          {on && (
            <Pressable accessibilityRole="button" onPress={() => setPickerOpen((open) => !open)} style={styles.row}>
              <Body>{settings.time(formatTime(time))}</Body>
            </Pressable>
          )}
          {on && pickerOpen && <TimeWheel value={asDate(time)} onChange={pick} />}
          {denied && !on && <Body muted>{settings.denied}</Body>}
        </Card>
        <Card>
          <View style={styles.row}>
            <Body>{settings.relaxedMode}</Body>
            <Switch
              value={relaxed}
              onValueChange={toggleRelaxed}
              trackColor={{ true: colors.accent }}
              accessibilityLabel={settings.relaxedMode}
              accessibilityHint={settings.relaxedModeHint}
            />
          </View>
          <Body muted>{settings.relaxedModeHint}</Body>
        </Card>
        <Card>
          <View style={styles.goal}>
            <Body>{settings.weeklyGoal}</Body>
            <GoalChoices value={weeklyGoal} onPick={(goal) => auth.setWeeklyGoal(goal)} />
          </View>
        </Card>
        <Card>
          <Pressable accessibilityRole="link" onPress={openPrivacyPolicy} style={styles.row}>
            <Body>{settings.privacyPolicy}</Body>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={confirmSignOut} disabled={deleting} style={styles.row}>
            <Body>{settings.signOut}</Body>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={confirmDelete} disabled={deleting} style={styles.row}>
            <Body>{settings.deleteAccount}</Body>
          </Pressable>
          {deleteFailed && <Body muted>{settings.deleteFailed}</Body>}
        </Card>
        <View style={styles.spacer} />
        <Text style={[styles.footer, { color: colors.muted }]}>
          {settings.footer(Constants.expoConfig?.version ?? '')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: space.m },
  content: { flexGrow: 1, padding: space.l, paddingTop: space.s, gap: space.m },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  goal: { gap: space.s },
  spacer: { flex: 1 },
  footer: { fontSize: 13, textAlign: 'center' },
});
