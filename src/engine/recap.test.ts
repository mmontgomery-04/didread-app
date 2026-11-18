/// <reference types="node" />
// SPEC section 8, "Weekly recap" (batch 3c).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addDays, weekday } from './dates.ts';
import { recapWeekStart, weeklyRecap } from './recap.ts';
import { attempt } from './testHelpers.ts';

// 2026-10-04 is a Sunday; 2026-10-05 is a Monday. Their recap week is Mon 2026-09-28 to Sun 2026-10-04.
const SUNDAY = '2026-10-04';
const MONDAY = '2026-10-05';
const WEEK_START = '2026-09-28';

describe('weekly recap: which days and which week', () => {
  test('weekday helper', () => {
    assert.equal(weekday(SUNDAY), 0);
    assert.equal(weekday(MONDAY), 1);
    assert.equal(weekday('2026-09-30'), 3, 'Wednesday');
  });

  test('Sunday covers Monday–Sunday of this week; Monday covers the week that just ended', () => {
    assert.equal(recapWeekStart(SUNDAY), WEEK_START);
    assert.equal(recapWeekStart(MONDAY), WEEK_START);
  });

  test('no recap Tuesday through Saturday', () => {
    for (let i = 1; i <= 5; i++) {
      const day = addDays(WEEK_START, i);
      assert.equal(recapWeekStart(day), null, day);
      assert.equal(weeklyRecap([attempt({ skill: 'inference', localDate: day })], [], day), null, day);
    }
  });
});

describe('weekly recap: numbers', () => {
  const week = [
    attempt({ skill: 'inference', localDate: WEEK_START, wordCount: 150 }),
    attempt({ skill: 'inference', localDate: WEEK_START, kind: 'bonus', wordCount: 200 }),
    attempt({ skill: 'reasoning', localDate: '2026-09-30', result: 'unscored', wordCount: 100 }),
    attempt({ skill: 'comprehension', localDate: SUNDAY, kind: 'review', wordCount: 120 }),
  ];
  const outside = [
    attempt({ skill: 'reasoning', localDate: '2026-09-27', wordCount: 999 }),
    attempt({ skill: 'reasoning', localDate: MONDAY, wordCount: 999 }),
  ];

  test('days practiced, words read, reads finished (all kinds, unscored too) and most practiced', () => {
    assert.deepEqual(weeklyRecap([...week, ...outside], [], SUNDAY), {
      weekStart: WEEK_START,
      daysPracticed: 3,
      wordsRead: 570,
      readsFinished: 4,
      mostPracticed: 'inference',
    });
  });

  test("on Monday, the week that just ended (Monday's own attempts not included)", () => {
    const recap = weeklyRecap([...week, ...outside], [], MONDAY);
    assert.equal(recap?.readsFinished, 4);
    assert.equal(recap?.wordsRead, 570);
  });

  test('ties in most practiced go by the fixed skill order', () => {
    const tie = [
      attempt({ skill: 'articulation', localDate: '2026-09-29' }),
      attempt({ skill: 'reasoning', localDate: '2026-09-29' }),
    ];
    assert.equal(weeklyRecap(tie, [], SUNDAY)?.mostPracticed, 'reasoning');
  });

  test('free-writes count toward days practiced but not skills or reads', () => {
    const recap = weeklyRecap(week, ['2026-10-01'], SUNDAY);
    assert.equal(recap?.daysPracticed, 4);
    assert.equal(recap?.readsFinished, 4);
    assert.equal(recap?.mostPracticed, 'inference');
  });

  test('a perfect week counts 7 days', () => {
    const everyDay = Array.from({ length: 7 }, (_, i) => attempt({ skill: 'comprehension', localDate: addDays(WEEK_START, i) }));
    assert.equal(weeklyRecap(everyDay, [], SUNDAY)?.daysPracticed, 7);
  });
});

describe('weekly recap: hidden', () => {
  test('hidden with 0 days practiced that week', () => {
    assert.equal(weeklyRecap([attempt({ skill: 'inference', localDate: '2026-09-20' })], [], SUNDAY), null);
  });

  test('"Nice" hides it until next week, including Monday for the same week', () => {
    const one = [attempt({ skill: 'inference', localDate: '2026-09-30' })];
    assert.equal(weeklyRecap(one, [], SUNDAY, WEEK_START), null);
    assert.equal(weeklyRecap(one, [], MONDAY, WEEK_START), null);
    const nextWeek = [...one, attempt({ skill: 'inference', localDate: '2026-10-07' })];
    assert.equal(weeklyRecap(nextWeek, [], '2026-10-11', WEEK_START)?.weekStart, MONDAY);
  });
});
