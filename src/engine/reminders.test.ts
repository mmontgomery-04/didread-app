/// <reference types="node" />
// SPEC section 8, "Daily reminder" (batch 11a).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { dayNumber } from './dates.ts';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_DAYS_AHEAD,
  REMINDER_KIND,
  reminderDates,
  reminderSettingFrom,
  reminderTextIndex,
} from './reminders.ts';

const eight = { hour: 8, minute: 0 };
const data = (date: string, hour = 8, minute = 0) => ({ kind: REMINDER_KIND, date, hour, minute });

describe('Daily reminder: which days get one', () => {
  test('starts today if the time is still ahead', () => {
    assert.equal(reminderDates('2026-10-01', 7 * 60 + 59, eight)[0], '2026-10-01');
  });

  test('starts tomorrow if the time has come or passed', () => {
    assert.equal(reminderDates('2026-10-01', 8 * 60, eight)[0], '2026-10-02');
    assert.equal(reminderDates('2026-10-01', 21 * 60, eight)[0], '2026-10-02');
  });

  test('30 days ahead, one per day, across month ends', () => {
    const dates = reminderDates('2026-10-15', 9 * 60, eight);
    assert.equal(dates.length, REMINDER_DAYS_AHEAD);
    assert.equal(dates[0], '2026-10-16');
    assert.equal(dates[REMINDER_DAYS_AHEAD - 1], '2026-11-14');
    dates.slice(1).forEach((d, i) => assert.equal(dayNumber(d) - dayNumber(dates[i]), 1));
  });

  test('the default time is 8:00 AM', () => {
    assert.deepEqual(DEFAULT_REMINDER_TIME, { hour: 8, minute: 0 });
  });
});

describe('Daily reminder: which text', () => {
  test('rotates by date: local day number modulo 5', () => {
    assert.equal(reminderTextIndex('2026-10-01', 5), dayNumber('2026-10-01') % 5);
  });

  test('5 days in a row use all 5 texts, then repeat', () => {
    const dates = reminderDates('2026-10-01', 0, eight, 6);
    const indexes = dates.map((d) => reminderTextIndex(d, 5));
    assert.deepEqual([...indexes.slice(0, 5)].sort(), [0, 1, 2, 3, 4]);
    assert.equal(indexes[5], indexes[0]);
  });

  test('the same date always gets the same text', () => {
    assert.equal(reminderTextIndex('2026-12-25', 5), reminderTextIndex('2026-12-25', 5));
  });
});

describe('Daily reminder: reading the setting back from the phone', () => {
  test('nothing scheduled means off', () => {
    assert.deepEqual(reminderSettingFrom([]), { on: false, time: null });
  });

  test('scheduled reminders mean on, at the earliest one\'s time', () => {
    assert.deepEqual(reminderSettingFrom([data('2026-10-03', 7, 30), data('2026-10-02', 7, 30)]), {
      on: true,
      time: { hour: 7, minute: 30 },
    });
  });

  test('other notifications and unreadable data are ignored', () => {
    const other = [null, undefined, 'x', {}, { kind: 'test-reminder', date: '2026-10-02', hour: 9, minute: 0 }];
    assert.deepEqual(reminderSettingFrom(other), { on: false, time: null });
    assert.deepEqual(reminderSettingFrom([...other, data('2026-10-02', 21, 15)]).time, { hour: 21, minute: 15 });
  });
});
