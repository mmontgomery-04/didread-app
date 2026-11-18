/// <reference types="node" />
// Rules P5 (daily limit), P6 (practice days and streak), P7 (stamina).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { localDateFor } from './dates.ts';
import {
  currentStreak,
  dailyStatus,
  daysPracticedThisMonth,
  estimatedMinutes,
  readingSeconds,
  totalReadingSeconds,
  wordsRead,
} from './practice.ts';
import { computeSkillStates } from './progression.ts';
import { attempt } from './testHelpers.ts';

describe('P5 daily limit', () => {
  test('one daily exercise plus up to 2 bonus', () => {
    const today = '2026-10-01';
    assert.deepEqual(dailyStatus([], today), { dailyDone: false, bonusRemaining: 0 });
    const one = [attempt({ skill: 'comprehension', localDate: today })];
    assert.deepEqual(dailyStatus(one, today), { dailyDone: true, bonusRemaining: 2 });
    const three = [...one, attempt({ skill: 'inference', localDate: today }), attempt({ skill: 'reasoning', localDate: today })];
    assert.deepEqual(dailyStatus(three, today), { dailyDone: true, bonusRemaining: 0 });
    // Yesterday's attempts don't use up today.
    assert.deepEqual(dailyStatus(three, '2026-10-02'), { dailyDone: false, bonusRemaining: 0 });
  });
});

describe('P6 practice days and streak', () => {
  const days = (...dates: string[]) => dates.map((localDate) => attempt({ skill: 'comprehension', localDate }));

  test('counts consecutive days ending today', () => {
    assert.equal(currentStreak(days('2026-10-01', '2026-10-02', '2026-10-03'), '2026-10-03'), 3);
  });

  test('keeps the streak through yesterday if today is not practiced yet', () => {
    assert.equal(currentStreak(days('2026-10-01', '2026-10-02'), '2026-10-03'), 2);
  });

  test('is 0 when neither today nor yesterday was practiced', () => {
    assert.equal(currentStreak(days('2026-10-01'), '2026-10-03'), 0);
    assert.equal(currentStreak([], '2026-10-03'), 0);
  });

  test('a gap ends the streak; several attempts on one day count once', () => {
    assert.equal(currentStreak(days('2026-09-28', '2026-09-30', '2026-10-01', '2026-10-01'), '2026-10-01'), 2);
  });

  test('works across month and year boundaries', () => {
    assert.equal(currentStreak(days('2026-12-30', '2026-12-31', '2027-01-01'), '2027-01-01'), 3);
  });

  test('counts correctly across a time-zone change', () => {
    // Evening in New York, then a flight to London. Each local date is fixed at submission.
    const ny = 'America/New_York';
    const london = 'Europe/London';
    const d1 = localDateFor(Date.UTC(2026, 9, 1, 23, 0), ny); // Oct 1, 7 PM in New York
    const d2 = localDateFor(Date.UTC(2026, 9, 3, 2, 30), ny); // Oct 2, 10:30 PM in New York
    const d3 = localDateFor(Date.UTC(2026, 9, 3, 8, 0), london); // Oct 3, 9 AM in London
    assert.deepEqual([d1, d2, d3], ['2026-10-01', '2026-10-02', '2026-10-03']);
    // The same London instant as d2 would be Oct 3, but stored dates are never recalculated.
    assert.equal(localDateFor(Date.UTC(2026, 9, 3, 2, 30), london), '2026-10-03');
    const today = localDateFor(Date.UTC(2026, 9, 3, 12, 0), london);
    assert.equal(currentStreak(days(d1, d2, d3), today), 3);
  });

  test('days practiced this month', () => {
    const list = days('2026-09-30', '2026-10-01', '2026-10-01', '2026-10-05');
    assert.equal(daysPracticedThisMonth(list, '2026-10-10'), 2);
    assert.equal(daysPracticedThisMonth(list, '2026-09-30'), 1);
  });

  test('unscored attempts count as practice days but not as attempts', () => {
    const list = [
      attempt({ skill: 'comprehension', result: 'unscored', localDate: '2026-10-01' }),
      attempt({ skill: 'comprehension', result: 'unscored', localDate: '2026-10-02' }),
      attempt({ skill: 'comprehension', result: 'unscored', localDate: '2026-10-03' }),
    ];
    assert.equal(currentStreak(list, '2026-10-03'), 3);
    assert.equal(daysPracticedThisMonth(list, '2026-10-03'), 3);
    // Three unscored "fails" start nothing, and three unscored perfect days fast-track nothing.
    assert.deepEqual(computeSkillStates(list).comprehension, {
      skill: 'comprehension',
      band: 'foundation',
      consecutiveFails: 0,
      reviewRemaining: 0,
      fastTrackUsed: false,
    });
  });
});

describe('P7 stamina', () => {
  test('reading seconds are measured from passage open to question open, capped at 600', () => {
    assert.equal(readingSeconds(0, 95_400), 95);
    assert.equal(readingSeconds(0, 3_600_000), 600);
    assert.equal(readingSeconds(10_000, 5_000), 0);
  });

  test('words read and reading time add up', () => {
    const list = [
      attempt({ skill: 'comprehension', wordCount: 189, readingSeconds: 70, localDate: '2026-10-01' }),
      attempt({ skill: 'inference', wordCount: 150, readingSeconds: 600, localDate: '2026-10-02', result: 'unscored' }),
    ];
    assert.equal(wordsRead(list), 339);
    assert.equal(wordsRead(list, '2026-10-02'), 150);
    assert.equal(totalReadingSeconds(list), 670);
  });
});

describe('Home minutes estimate', () => {
  test('round up (word count / 220) + 1', () => {
    assert.equal(estimatedMinutes(0), 1); // Word Sprint has no passage
    assert.equal(estimatedMinutes(70), 2);
    assert.equal(estimatedMinutes(165), 2);
    assert.equal(estimatedMinutes(220), 2);
    assert.equal(estimatedMinutes(221), 3);
    assert.equal(estimatedMinutes(248), 3);
  });
});
