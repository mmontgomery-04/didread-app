/// <reference types="node" />
// Rule P4: exercise selection.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addDays } from './dates.ts';
import { chooseExercise, chooseExerciseOfType, getDailyAssignment, isSurpriseDay, rankSkills } from './selection.ts';
import { attempt, exercise, onSeparateDays } from './testHelpers.ts';
import { SKILLS } from './types.ts';
import type { Attempt } from './types.ts';

const TODAY = '2026-10-10';

// Two approved Foundation exercises in every skill, plus some that must never be served.
const library = [
  ...SKILLS.flatMap((s) => [exercise(s, 'foundation', 2), exercise(s, 'foundation', 1)]),
  exercise('comprehension', 'foundation', 0, 'draft'),
  exercise('inference', 'foundation', 0, 'retired'),
  exercise('comprehension', 'developing', 1),
  exercise('inference', 'developing', 1),
];

describe('P4 skill ranking', () => {
  test('ties go comprehension, inference, reasoning, articulation', () => {
    assert.deepEqual(rankSkills([], TODAY), ['comprehension', 'inference', 'reasoning', 'articulation']);
  });

  test('counts every attempt of any kind in today plus the 6 days before', () => {
    const attempts = [
      attempt({ skill: 'comprehension', kind: 'bonus', localDate: TODAY }),
      attempt({ skill: 'comprehension', kind: 'repeat', result: 'unscored', localDate: '2026-10-04' }),
      attempt({ skill: 'inference', kind: 'review', localDate: '2026-10-05' }),
      // 7 days ago: outside the window.
      attempt({ skill: 'reasoning', localDate: '2026-10-03' }),
      attempt({ skill: 'reasoning', localDate: '2026-10-03' }),
    ];
    assert.deepEqual(rankSkills(attempts, TODAY), ['reasoning', 'articulation', 'inference', 'comprehension']);
  });

  test('counts attempts, not unique exercises', () => {
    const attempts = [
      attempt({ skill: 'comprehension', exerciseId: 'x', localDate: TODAY }),
      attempt({ skill: 'comprehension', exerciseId: 'x', localDate: TODAY }),
      attempt({ skill: 'inference', exerciseId: 'y', localDate: TODAY }),
    ];
    assert.deepEqual(rankSkills(attempts, TODAY).slice(2), ['inference', 'comprehension']);
  });
});

describe('P4 selection', () => {
  test('new user gets the lowest-sequence approved exercise in the top skill', () => {
    assert.deepEqual(chooseExercise({ exercises: library, attempts: [], today: TODAY }, 'daily'), {
      exerciseId: 'comprehension-foundation-1',
      kind: 'daily',
    });
  });

  test('only approved exercises are served', () => {
    const onlyDrafts = [exercise('comprehension', 'foundation', 1, 'draft'), exercise('inference', 'foundation', 1, 'calibrated')];
    assert.equal(chooseExercise({ exercises: onlyDrafts, attempts: [], today: TODAY }, 'daily'), null);
  });

  test('a bonus exercise is recorded as bonus', () => {
    const attempts = [attempt({ skill: 'comprehension', exerciseId: 'comprehension-foundation-1', localDate: TODAY })];
    assert.deepEqual(chooseExercise({ exercises: library, attempts, today: TODAY }, 'bonus'), {
      exerciseId: 'inference-foundation-1',
      kind: 'bonus',
    });
  });

  test('same exercise for the same user and date, even after state changes', () => {
    const input = { exercises: library, attempts: [] as Attempt[], today: TODAY };
    const first = getDailyAssignment(input, null);
    assert.ok(first);
    assert.deepEqual(chooseExercise(input, 'daily'), chooseExercise(input, 'daily'));

    // Reopening later the same day, after answering it, returns the stored choice.
    const later = {
      ...input,
      attempts: [attempt({ skill: 'comprehension', exerciseId: first.exerciseId, localDate: TODAY })],
    };
    assert.deepEqual(getDailyAssignment(later, first), first);

    // The next day gets a new choice.
    const tomorrow = getDailyAssignment({ ...later, today: '2026-10-11' }, first);
    assert.notEqual(tomorrow?.exerciseId, first.exerciseId);
    assert.equal(tomorrow?.localDate, '2026-10-11');
  });

  test('falls back to the next-ranked skill when the band runs out of content', () => {
    // Comprehension has the fewest attempts this week, but both of its Foundation exercises were seen.
    const attempts = [
      attempt({ skill: 'comprehension', exerciseId: 'comprehension-foundation-1', localDate: '2026-09-01' }),
      attempt({ skill: 'comprehension', exerciseId: 'comprehension-foundation-2', localDate: '2026-09-02' }),
      attempt({ skill: 'inference', exerciseId: 'inference-other', localDate: TODAY }),
      attempt({ skill: 'articulation', exerciseId: 'articulation-other', localDate: TODAY }),
      attempt({ skill: 'articulation', exerciseId: 'articulation-other2', localDate: TODAY }),
    ];
    // Ranked: comprehension (0), reasoning (0), inference (1), articulation (2).
    assert.deepEqual(chooseExercise({ exercises: library, attempts, today: TODAY }, 'daily'), {
      exerciseId: 'reasoning-foundation-1',
      kind: 'daily',
    });
  });

  test('uses the band the user is at', () => {
    const promoted = onSeparateDays(
      '2026-09-01',
      Array.from({ length: 3 }, (_, i) => ({ skill: 'comprehension' as const, score: 1, exerciseId: `old-${i}` })),
    );
    assert.deepEqual(chooseExercise({ exercises: library, attempts: promoted, today: TODAY }, 'daily'), {
      exerciseId: 'comprehension-developing-1',
      kind: 'daily',
    });
  });

  test('in review, serves the band below and records it as review', () => {
    const attempts = [
      ...onSeparateDays(
        '2026-09-01',
        Array.from({ length: 3 }, (_, i) => ({ skill: 'comprehension' as const, score: 1, exerciseId: `old-${i}` })),
      ),
      ...onSeparateDays(
        '2026-09-10',
        Array.from({ length: 3 }, (_, i) => ({
          skill: 'comprehension' as const,
          band: 'developing' as const,
          result: 'fail' as const,
          exerciseId: `dev-${i}`,
        })),
      ),
    ];
    assert.deepEqual(chooseExercise({ exercises: library, attempts, today: TODAY }, 'daily'), {
      exerciseId: 'comprehension-foundation-1',
      kind: 'review',
    });
  });

  test('falls back to the least-recently-seen repeat when nothing unseen is left', () => {
    const foundationOnly = library.filter((e) => e.band === 'foundation');
    // Everything seen, oldest first: inference-2 and reasoning-1 tie as the oldest.
    const order = [
      'inference-foundation-2',
      'reasoning-foundation-1',
      'comprehension-foundation-1',
      'comprehension-foundation-2',
      'inference-foundation-1',
      'reasoning-foundation-2',
      'articulation-foundation-1',
      'articulation-foundation-2',
    ];
    const attempts = order.map((id, i) =>
      attempt({
        skill: id.split('-')[0] as Attempt['skill'],
        exerciseId: id,
        result: 'fail',
        localDate: `2026-09-0${i + 1}`,
        createdAt: i < 2 ? 1 : 100 + i,
      }),
    );
    assert.deepEqual(chooseExercise({ exercises: foundationOnly, attempts, today: TODAY }, 'daily'), {
      exerciseId: 'inference-foundation-2',
      kind: 'repeat',
    });
  });

  test('repeats come only from bands at or below the lowest band across skills', () => {
    const exercises = [exercise('comprehension', 'developing', 1), exercise('inference', 'foundation', 1)];
    const attempts = [
      // Comprehension reaches developing and sees its only developing exercise first (oldest).
      ...onSeparateDays(
        '2026-09-01',
        Array.from({ length: 3 }, (_, i) => ({ skill: 'comprehension' as const, score: 1, exerciseId: `old-${i}` })),
      ),
      attempt({ skill: 'comprehension', band: 'developing', exerciseId: 'comprehension-developing-1', localDate: '2026-09-05' }),
      attempt({ skill: 'inference', exerciseId: 'inference-foundation-1', result: 'fail', localDate: '2026-09-06' }),
    ];
    // Lowest band across skills is foundation, so the developing exercise can't be repeated.
    assert.deepEqual(chooseExercise({ exercises, attempts, today: TODAY }, 'daily'), {
      exerciseId: 'inference-foundation-1',
      kind: 'repeat',
    });
  });

  test('without Plus, six-word stories are skipped and the next exercise is served', () => {
    const story = { ...exercise('comprehension', 'foundation', 1), id: 'story', responseType: 'six_word_story' as const };
    const plain = { ...exercise('comprehension', 'foundation', 2), id: 'plain', responseType: 'open_text' as const };
    const input = { exercises: [story, plain], attempts: [], today: TODAY };
    assert.equal(chooseExercise(input, 'daily')?.exerciseId, 'plain');
    assert.equal(chooseExercise({ ...input, plus: false }, 'daily')?.exerciseId, 'plain');
    assert.equal(chooseExercise({ ...input, plus: true }, 'daily')?.exerciseId, 'story');
  });

  test('without Plus, six-word stories are never served as repeats either', () => {
    const story = { ...exercise('comprehension', 'foundation', 1), id: 'story', responseType: 'six_word_story' as const };
    const seen = [attempt({ exerciseId: 'story', skill: 'comprehension', localDate: '2026-10-01' })];
    assert.equal(chooseExercise({ exercises: [story], attempts: seen, today: TODAY }, 'daily'), null);
    assert.equal(chooseExercise({ exercises: [story], attempts: seen, today: TODAY, plus: true }, 'daily')?.kind, 'repeat');
  });

  describe('starter reads (batch 13)', () => {
    const starter = (skill: (typeof SKILLS)[number], sequence: number) => ({
      ...exercise(skill, 'foundation', sequence),
      id: `starter-${skill}`,
      starter: true,
    });
    const starters = SKILLS.map((s, i) => starter(s, 100 + i));
    const withStarters = [...library, ...starters];
    const done = (ids: string[]) =>
      ids.map((id, i) => attempt({ exerciseId: id, skill: id.replace('starter-', '') as (typeof SKILLS)[number], localDate: TODAY, createdAt: i }));

    test('a brand-new user gets the 4 starters as daily reads in skill order, then the normal rotation', () => {
      const order: string[] = [];
      for (let i = 0; i < 5; i++) {
        const pick = chooseExercise({ exercises: withStarters, attempts: done(order), today: TODAY }, 'daily');
        order.push(pick!.exerciseId);
      }
      assert.deepEqual(order.slice(0, 4), SKILLS.map((s) => `starter-${s}`));
      assert.ok(!order[4].startsWith('starter-'));
    });

    test("batch 14: starters are daily-only, and bonus reads don't end starter mode", () => {
      const bonusPick = chooseExercise({ exercises: withStarters, attempts: [], today: TODAY }, 'bonus');
      assert.ok(bonusPick && !bonusPick.exerciseId.startsWith('starter-'));
      const attempts = [
        ...done(['starter-comprehension']),
        attempt({ exerciseId: 'comprehension-foundation-1', skill: 'comprehension', kind: 'bonus', localDate: TODAY }),
      ];
      const next = chooseExercise({ exercises: withStarters, attempts, today: addDays(TODAY, 1) }, 'daily');
      assert.equal(next?.exerciseId, 'starter-inference');
    });

    test('batch 14: a non-starter daily read ends starter mode', () => {
      const attempts = [
        ...done(['starter-comprehension']),
        attempt({ exerciseId: 'inference-foundation-1', skill: 'inference', kind: 'daily', localDate: TODAY }),
      ];
      const next = chooseExercise({ exercises: withStarters, attempts, today: addDays(TODAY, 1) }, 'daily');
      assert.ok(next && !next.exerciseId.startsWith('starter-'));
    });

    test('anyone with a non-starter attempt never gets a starter', () => {
      const attempts = [attempt({ exerciseId: 'comprehension-foundation-1', skill: 'comprehension', localDate: TODAY })];
      const pick = chooseExercise({ exercises: withStarters, attempts, today: TODAY }, 'daily');
      assert.ok(pick && !pick.exerciseId.startsWith('starter-'));
    });

    test('starters are never served as repeats', () => {
      const onlyStarters = [starter('comprehension', 1)];
      const attempts = [
        attempt({ exerciseId: 'starter-comprehension', skill: 'comprehension', localDate: '2026-10-01' }),
        attempt({ exerciseId: 'something-else', skill: 'inference', localDate: '2026-10-02' }),
      ];
      assert.equal(chooseExercise({ exercises: onlyStarters, attempts, today: TODAY }, 'daily'), null);
    });

    test('draft starters are never served', () => {
      const draft = { ...starter('comprehension', 1), status: 'draft' as const };
      const pick = chooseExercise({ exercises: [...library, draft], attempts: [], today: TODAY }, 'daily');
      assert.notEqual(pick?.exerciseId, 'starter-comprehension');
    });
  });

  describe('surprise days (batch 13)', () => {
    const seed = 'user-123';
    const days = Array.from({ length: 365 }, (_, i) => addDays('2026-01-01', i));
    const surpriseDays = days.filter((d) => isSurpriseDay(seed, d));
    const firstSurprise = surpriseDays[0];
    const firstNormal = days.find((d) => !isSurpriseDay(seed, d))!;
    const bad = { ...exercise('comprehension', 'foundation', 9), id: 'bad', responseType: 'bad_summary' as const };
    const plain = [...library, bad];

    test('about 1 day in 4, never two in a row, and the same answer every time', () => {
      assert.ok(surpriseDays.length > 365 * 0.15 && surpriseDays.length < 365 * 0.3, `${surpriseDays.length} of 365`);
      for (const d of surpriseDays) assert.equal(isSurpriseDay(seed, addDays(d, 1)), false, d);
      assert.deepEqual(days.filter((d) => isSurpriseDay(seed, d)), surpriseDays);
    });

    test('on a surprise day the daily pick is an unseen new-format exercise', () => {
      const pick = chooseExercise({ exercises: plain, attempts: [], today: firstSurprise, seed }, 'daily');
      assert.equal(pick?.exerciseId, 'bad');
    });

    test('with no unseen new-format exercise, a surprise day is a normal read, not a repeat', () => {
      const attempts = [attempt({ exerciseId: 'bad', skill: 'comprehension', localDate: '2025-12-01' })];
      const pick = chooseExercise({ exercises: plain, attempts, today: firstSurprise, seed }, 'daily');
      assert.ok(pick && pick.exerciseId !== 'bad' && pick.kind === 'daily');
    });

    test('on other days the daily pick never uses new formats, but a bonus pick may', () => {
      const daily = chooseExercise({ exercises: plain, attempts: [], today: firstNormal, seed }, 'daily');
      assert.notEqual(daily?.exerciseId, 'bad');
      const onlyBad = { exercises: [bad], attempts: [], today: firstNormal, seed };
      assert.equal(chooseExercise(onlyBad, 'daily'), null);
      assert.equal(chooseExercise(onlyBad, 'bonus')?.exerciseId, 'bad');
    });

    test('no surprise days in starter mode, or without a seed', () => {
      const starter = { ...exercise('comprehension', 'foundation', 1), id: 'starter-c', starter: true };
      const withStarter = chooseExercise({ exercises: [...plain, starter], attempts: [], today: firstSurprise, seed }, 'daily');
      assert.equal(withStarter?.exerciseId, 'starter-c');
      const noSeed = chooseExercise({ exercises: plain, attempts: [], today: firstSurprise }, 'daily');
      assert.notEqual(noSeed?.exerciseId, 'bad');
    });
  });

  describe('Activities menu (batch 14)', () => {
    const typed = (
      skill: (typeof SKILLS)[number],
      band: 'foundation' | 'developing',
      sequence: number,
      responseType: Attempt['responseType'],
      status: 'approved' | 'draft' = 'approved',
    ) => ({ ...exercise(skill, band, sequence, status), id: `${responseType}-${skill}-${band}-${sequence}`, responseType });
    const menu = [
      typed('comprehension', 'foundation', 3, 'word_sprint'),
      typed('comprehension', 'foundation', 2, 'word_sprint'),
      typed('comprehension', 'foundation', 1, 'word_sprint', 'draft'),
      typed('comprehension', 'developing', 1, 'word_sprint'),
      typed('comprehension', 'foundation', 4, 'bad_summary'),
      typed('reasoning', 'foundation', 5, 'bad_summary'),
      typed('inference', 'foundation', 1, 'tap_sentence'),
      { ...typed('inference', 'foundation', 0, 'tap_sentence'), starter: true },
      typed('articulation', 'developing', 1, 'six_word_story'),
    ];
    /** 3 perfect comprehension scores: fast track to developing (P2). */
    const promoted = (skill: (typeof SKILLS)[number]) =>
      onSeparateDays('2026-10-01', Array.from({ length: 3 }, (_, i) => ({ skill, score: 1, exerciseId: `old-${skill}-${i}` })));

    test('serves the lowest-sequence unseen approved exercise of that type, as a bonus', () => {
      assert.deepEqual(chooseExerciseOfType({ exercises: menu, attempts: [], today: TODAY }, 'word_sprint'), {
        exerciseId: 'word_sprint-comprehension-foundation-2',
        kind: 'bonus',
      });
    });

    test('tries skills in the least-practiced order', () => {
      const busyComprehension = [attempt({ skill: 'comprehension', localDate: TODAY })];
      assert.equal(
        chooseExerciseOfType({ exercises: menu, attempts: busyComprehension, today: TODAY }, 'bad_summary')?.exerciseId,
        'bad_summary-reasoning-foundation-5',
      );
      const busyReasoning = [attempt({ skill: 'reasoning', localDate: TODAY })];
      assert.equal(
        chooseExerciseOfType({ exercises: menu, attempts: busyReasoning, today: TODAY }, 'bad_summary')?.exerciseId,
        'bad_summary-comprehension-foundation-4',
      );
    });

    test("serves only at the user's band in that skill", () => {
      const pick = chooseExerciseOfType({ exercises: menu, attempts: promoted('comprehension'), today: TODAY }, 'word_sprint');
      assert.equal(pick?.exerciseId, 'word_sprint-comprehension-developing-1');
    });

    test('during review, serves from the band below and records it as review', () => {
      const first = promoted('comprehension');
      const fails = onSeparateDays(
        '2026-10-04',
        Array.from({ length: 3 }, (_, i) => ({
          skill: 'comprehension' as const,
          band: 'developing' as const,
          result: 'fail' as const,
          exerciseId: `dev-${i}`,
        })),
      );
      const attempts = [...first, ...fails];
      assert.deepEqual(chooseExerciseOfType({ exercises: menu, attempts, today: TODAY }, 'word_sprint'), {
        exerciseId: 'word_sprint-comprehension-foundation-2',
        kind: 'review',
      });
    });

    test('all caught up: null when every one is seen (never a repeat)', () => {
      const attempts = ['word_sprint-comprehension-foundation-2', 'word_sprint-comprehension-foundation-3'].map((id) =>
        attempt({ exerciseId: id, skill: 'comprehension', localDate: '2026-10-01' }),
      );
      assert.equal(chooseExerciseOfType({ exercises: menu, attempts, today: TODAY }, 'word_sprint'), null);
    });

    test('batch 16: six-word stories come from any band when there are none at the user\'s band', () => {
      const input = { exercises: menu, attempts: [], today: TODAY, plus: true };
      // A Foundation user: there are no Foundation stories, so the Developing one is served, as a bonus.
      assert.deepEqual(chooseExerciseOfType(input, 'six_word_story'), {
        exerciseId: 'six_word_story-articulation-developing-1',
        kind: 'bonus',
      });
      const seen = [attempt({ exerciseId: 'six_word_story-articulation-developing-1', skill: 'articulation', localDate: '2026-10-01' })];
      assert.equal(chooseExerciseOfType({ ...input, attempts: seen }, 'six_word_story'), null);
      // Other types never do this: no Developing word sprint for a Foundation user once Foundation's are seen.
      const sprints = ['word_sprint-comprehension-foundation-2', 'word_sprint-comprehension-foundation-3'].map((id) =>
        attempt({ exerciseId: id, skill: 'comprehension', localDate: '2026-10-01' }),
      );
      assert.equal(chooseExerciseOfType({ ...input, attempts: sprints }, 'word_sprint'), null);
    });

    test('never serves starters, drafts, or Plus-only types without Plus', () => {
      const input = { exercises: menu, attempts: [], today: TODAY };
      assert.equal(chooseExerciseOfType(input, 'tap_sentence')?.exerciseId, 'tap_sentence-inference-foundation-1');
      assert.equal(chooseExerciseOfType(input, 'multiple_choice'), null);
      const writer = { ...input, attempts: promoted('articulation') };
      assert.equal(chooseExerciseOfType(writer, 'six_word_story'), null);
      assert.equal(chooseExerciseOfType({ ...writer, plus: true }, 'six_word_story')?.exerciseId, 'six_word_story-articulation-developing-1');
    });
  });

  test('returns null when there is no approved content at all', () => {
    assert.equal(chooseExercise({ exercises: [], attempts: [], today: TODAY }, 'daily'), null);
    assert.equal(getDailyAssignment({ exercises: [], attempts: [], today: TODAY }, null), null);
  });
});
