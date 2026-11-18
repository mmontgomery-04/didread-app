// Daily reminder scheduling (SPEC section 8, "Daily reminder", batch 11a). The rules (which
// days, which text, reading the setting back) are in src/engine/reminders.ts; this file only
// talks to iOS through expo-notifications. No storage: the setting is whatever iOS has scheduled.
// Reminders use the default notification sound (SPEC decision log).
import * as Notifications from 'expo-notifications';

import { reminder, rotateByDay } from '@/copy';
import {
  localDateFor,
  REMINDER_KIND,
  reminderDates,
  reminderSettingFrom,
  type LocalDate,
  type ReminderData,
  type ReminderTime,
} from '@/engine';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Development-only test reminder (test panel). */
const TEST_KIND = 'test-reminder';

// iOS hides notifications while the app is open, unless told otherwise. Only the test
// reminder shows in the app, so a daily reminder never pops up mid-read.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = notification.request.content.data?.kind === TEST_KIND;
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

/** The reminder setting as iOS has it scheduled. */
export async function readReminderSetting(): Promise<{ on: boolean; time: ReminderTime | null }> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return reminderSettingFrom(scheduled.map((request) => request.content.data));
}

/** Asks for permission if iOS still allows asking. True if notifications can be shown. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces any scheduled daily reminders with the next 30 days at `time`. */
export function scheduleReminders(time: ReminderTime): Promise<void> {
  return oneAtATime(() => schedule(time));
}

/** Cancels the daily reminders (and nothing else). */
export function cancelReminders(): Promise<void> {
  return oneAtATime(cancel);
}

/** When the app opens: if the reminder is on, schedule 30 days ahead again from today. */
export function topUpReminders(): Promise<void> {
  return oneAtATime(async () => {
    const setting = await readReminderSetting();
    if (setting.on && setting.time) await schedule(setting.time);
  });
}

/** Development only (test panel): today's reminder text, 10 seconds from now. */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  const today = localDateFor(Date.now(), TIME_ZONE);
  await Notifications.scheduleNotificationAsync({
    content: { title: reminder.title, body: rotateByDay(reminder.texts, today), sound: 'default', data: { kind: TEST_KIND } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10 },
  });
  return true;
}

// Changes run one at a time, in order, so quick changes of the time never leave duplicates.
let queue: Promise<void> = Promise.resolve();
function oneAtATime(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function schedule(time: ReminderTime): Promise<void> {
  await cancel();
  const now = new Date();
  const today = localDateFor(now.getTime(), TIME_ZONE);
  for (const date of reminderDates(today, now.getHours() * 60 + now.getMinutes(), time)) {
    const data: ReminderData = { kind: REMINDER_KIND, date, hour: time.hour, minute: time.minute };
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.title, body: rotateByDay(reminder.texts, date), sound: 'default', data: { ...data } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atLocalTime(date, time) },
    });
  }
}

async function cancel(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    if (request.content.data?.kind === REMINDER_KIND) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}

function atLocalTime(date: LocalDate, time: ReminderTime): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, time.hour, time.minute);
}
