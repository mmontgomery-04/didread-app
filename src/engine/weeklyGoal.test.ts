/// <reference types="node" />
// SPEC section 8, "Weekly goal and this-week strip" (batch 17).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { attempt } from './testHelpers.ts';
import {
  DEFAULT_WEEKLY_GOAL,
  mondayOf,
  reachedGoalWithThisRead,
  thisWeek,
  weeklyGoalOrDefault,
} from './weeklyGoal.ts';

// Mon 2026-10-12 to Sun 2026-10-18; 2026-10-15 is a Thursday.
const MONDAY = '2026-10-12';
const THURSDAY = '2026-10-15';
const SUNDAY = '2026-10-18';
const on = (localDate: string) => attempt({ skill: 'comprehension', localDate });

describe('weekly goal: the goal itself', () => {
  test('the choices are kept; anything else is the default of 3', () => {
    for (const goal of [2, 3, 5, 7]) assert.equal(weeklyGoalOrDefault(goal), goal);
    for (const goal of [null, undefined, 0, 1, 4, 6, 8]) assert.equal(weeklyGoalOrDefault(goal), DEFAULT_WEEKLY_GOAL);
    assert.equal(DEFAULT_WEEKLY_GOAL, 3);
  });
});

describe('weekly goal: the week', () => {
  test('a week runs Monday to Sunday', () => {
    assert.equal(mondayOf(MONDAY), MONDAY);
    assert.equal(mondayOf(THURSDAY), MONDAY);
    assert.equal(mondayOf(SUNDAY), MONDAY, 'Sunday belongs to the week that started on Monday');
    assert.equal(mondayOf('2026-10-19'), '2026-10-19', 'the next Monday starts a new week');
  });

  test('marks: practiced, missed (past, no practice), open (today before practice, and later days)', () => {
    const week = thisWeek([on(MONDAY), on('2026-10-14')], [], THURSDAY, 3);
    assert.deepEqual(
      week.days.map((d) => d.mark),
      ['practiced', 'missed', 'practiced', 'open', 'open', 'open', 'open'],
    );
    assert.deepEqual(week.days.map((d) => d.isToday), [false, false, false, true, false, false, false]);
    assert.equal(week.practiced, 2);
    assert.equal(week.met, false);
  });

  test('today is ✓ once practiced', () => {
    const week = thisWeek([on(THURSDAY)], [], THURSDAY, 3);
    assert.equal(week.days[3].mark, 'practiced');
  });

  test('free-writes count as practice days (P6); several reads in a day count once', () => {
    const week = thisWeek([on(MONDAY), on(MONDAY)], ['2026-10-13'], THURSDAY, 2);
    assert.equal(week.practiced, 2);
    assert.equal(week.met, true);
  });

  test('last week and next week never count', () => {
    const week = thisWeek([on('2026-10-11'), on('2026-10-19')], [], THURSDAY, 2);
    assert.equal(week.practiced, 0);
    assert.ok(week.days.every((d) => d.mark !== 'practiced'));
  });

  test('a new week starts fresh: Monday shows nothing missed', () => {
    const week = thisWeek([on('2026-10-13'), on('2026-10-14'), on('2026-10-15')], [], '2026-10-19', 3);
    assert.equal(week.practiced, 0);
    assert.ok(week.days.every((d) => d.mark === 'open'));
  });

  test('met when the days reach the goal, and it stays met', () => {
    const three = [on(MONDAY), on('2026-10-13'), on('2026-10-14')];
    assert.equal(thisWeek(three, [], THURSDAY, 3).met, true);
    assert.equal(thisWeek([...three, on(THURSDAY)], [], THURSDAY, 3).met, true);
    assert.equal(thisWeek(three, [], THURSDAY, 5).met, false);
  });

  test('a goal change applies to the current week right away', () => {
    const two = [on(MONDAY), on('2026-10-13')];
    assert.equal(thisWeek(two, [], THURSDAY, 3).met, false);
    assert.equal(thisWeek(two, [], THURSDAY, 2).met, true);
  });
});

describe('weekly goal: Finish shows "goal met" only on the read that reached it', () => {
  test('this read made today a practice day and brought the week to the goal', () => {
    const week = thisWeek([on(MONDAY), on('2026-10-13'), on(THURSDAY)], [], THURSDAY, 3);
    assert.equal(reachedGoalWithThisRead(week, true), true);
  });

  test('not on a second read the same day', () => {
    const week = thisWeek([on(MONDAY), on('2026-10-13'), on(THURSDAY), on(THURSDAY)], [], THURSDAY, 3);
    assert.equal(reachedGoalWithThisRead(week, false), false);
  });

  test('not on a day past the goal, nor before it', () => {
    const four = thisWeek([on(MONDAY), on('2026-10-13'), on('2026-10-14'), on(THURSDAY)], [], THURSDAY, 3);
    assert.equal(reachedGoalWithThisRead(four, true), false);
    const one = thisWeek([on(THURSDAY)], [], THURSDAY, 3);
    assert.equal(reachedGoalWithThisRead(one, true), false);
  });
});
