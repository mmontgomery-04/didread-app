/// <reference types="node" />
// SPEC section 5, "Story series" (planned for build 8; the plumbing ships hidden in build 7).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { computeSkillStates } from './progression.ts';
import { chooseExercise, chooseExerciseOfType } from './selection.ts';
import { chapterOf, nextChapter } from './series.ts';
import { attempt, exercise } from './testHelpers.ts';
import type { Attempt, Band, ExerciseStatus, ExerciseSummary, Skill } from './types.ts';

const TODAY = '2026-10-16';

function chapter(
  seriesId: string,
  n: number,
  skill: Skill = 'comprehension',
  status: ExerciseStatus = 'approved',
  band: Band = 'foundation',
): ExerciseSummary {
  return {
    id: `${seriesId}-ch${n}`,
    skill,
    band,
    sequence: 900 + n,
    status,
    responseType: 'multiple_choice',
    seriesId,
    chapter: n,
  };
}

const SERIES_A = [1, 2, 3, 4, 5].map((n) => chapter('series-001', n));
const did = (e: ExerciseSummary, overrides: Partial<Attempt> = {}) =>
  attempt({ skill: e.skill, band: e.band, exerciseId: e.id, kind: 'bonus', responseType: 'multiple_choice', localDate: TODAY, ...overrides });

describe('story series: nextChapter', () => {
  test('no approved series: no card', () => {
    assert.deepEqual(nextChapter([exercise('comprehension', 'foundation', 1)], []), { state: 'none' });
    const drafts = SERIES_A.map((c) => ({ ...c, status: 'draft' as const }));
    assert.deepEqual(nextChapter(drafts, []), { state: 'none' }, 'draft chapters never show the card');
  });

  test('a new reader starts at chapter 1 of 5', () => {
    const stories = nextChapter(SERIES_A, []);
    assert.deepEqual(stories, {
      state: 'next',
      selection: { exerciseId: 'series-001-ch1', kind: 'bonus' },
      chapter: 1,
      total: 5,
      started: false,
    });
  });

  test('chapters come in order, whatever the result of the last one', () => {
    const stories = nextChapter(SERIES_A, [did(SERIES_A[0], { result: 'fail', score: 0 }), did(SERIES_A[1], { result: 'unscored', score: null })]);
    assert.equal(stories.state === 'next' && stories.chapter, 3);
    assert.equal(stories.state === 'next' && stories.started, true);
  });

  test('every chapter read: all caught up', () => {
    assert.deepEqual(nextChapter(SERIES_A, SERIES_A.map((c) => did(c))), { state: 'allCaughtUp' });
  });

  test('a started series is finished before the next one starts', () => {
    const seriesB = [1, 2, 3].map((n) => chapter('series-000', n));
    const both = [...SERIES_A, ...seriesB];
    const fresh = nextChapter(both, []);
    assert.equal(fresh.state === 'next' && fresh.selection.exerciseId, 'series-000-ch1', 'lowest series id first');
    const midA = nextChapter(both, [did(SERIES_A[0])]);
    assert.equal(midA.state === 'next' && midA.selection.exerciseId, 'series-001-ch2', 'the started series continues');
    const afterB = nextChapter(both, seriesB.map((c) => did(c)));
    assert.equal(afterB.state === 'next' && afterB.selection.exerciseId, 'series-001-ch1');
  });

  test('open to everyone: a reader past Foundation still gets the Foundation series', () => {
    const fastTrack = [1, 2, 3].map((i) =>
      attempt({ skill: 'comprehension', responseType: 'multiple_choice', score: 1, localDate: `2026-09-0${i}` }),
    );
    assert.equal(computeSkillStates(fastTrack).comprehension.band, 'developing');
    const stories = nextChapter(SERIES_A, fastTrack);
    assert.equal(stories.state === 'next' && stories.selection.exerciseId, 'series-001-ch1');
  });

  test('chapterOf: number, total of approved chapters, and whether it is the last', () => {
    assert.deepEqual(chapterOf(SERIES_A, 'series-001-ch2'), { chapter: 2, total: 5, last: false });
    assert.deepEqual(chapterOf(SERIES_A, 'series-001-ch5'), { chapter: 5, total: 5, last: true });
    assert.equal(chapterOf(SERIES_A, 'nope'), null);
    assert.equal(chapterOf([exercise('comprehension', 'foundation', 1)], 'comprehension-foundation-1'), null);
  });
});

describe('story series: chapters are never served any other way', () => {
  const input = (exercises: ExerciseSummary[], attempts: Attempt[] = []) => ({ exercises, attempts, today: TODAY, plus: true });

  test('not as the daily read, even when nothing else is left', () => {
    assert.equal(chooseExercise(input(SERIES_A), 'daily'), null);
    const normal = exercise('comprehension', 'foundation', 1);
    assert.equal(chooseExercise(input([...SERIES_A, normal]), 'daily')?.exerciseId, normal.id);
  });

  test('not as a repeat', () => {
    const done = SERIES_A.map((c) => did(c));
    assert.equal(chooseExercise(input(SERIES_A, done), 'daily'), null);
  });

  test('not from the other Activities cards', () => {
    assert.equal(chooseExerciseOfType(input(SERIES_A), 'multiple_choice'), null);
  });
});

describe('story series: progress', () => {
  test('a chapter at the reader\'s band counts toward promotion like any read', () => {
    // 5 passes on 5 different days at foundation (multiple choice, comprehension): promoted (P1).
    const passes = SERIES_A.map((c, i) => did(c, { localDate: `2026-10-0${i + 1}` }));
    assert.equal(computeSkillStates(passes).comprehension.band, 'developing');
  });

  test('a chapter below the reader\'s band never counts toward promotion', () => {
    // Fast-tracked to developing in comprehension (P2), then 5 foundation chapter passes.
    const fastTrack = [1, 2, 3].map((i) =>
      attempt({ skill: 'comprehension', responseType: 'multiple_choice', score: 1, localDate: `2026-09-0${i}` }),
    );
    assert.equal(computeSkillStates(fastTrack).comprehension.band, 'developing');
    const chapters = SERIES_A.map((c, i) => did(c, { localDate: `2026-10-0${i + 1}` }));
    const states = computeSkillStates([...fastTrack, ...chapters]);
    assert.equal(states.comprehension.band, 'developing', 'still developing: foundation chapters never promote');
  });
});
