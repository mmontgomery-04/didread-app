/// <reference types="node" />
// Rules P1, P2, P3 and the P5 per-day cap.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { computeSkillStates } from './progression.ts';
import { attempt, onSeparateDays } from './testHelpers.ts';
import type { Attempt } from './types.ts';

const MC = 'multiple_choice' as const;
const OPEN = 'open_text' as const;

describe('P1 promotion', () => {
  // SPEC section 4 worked example.
  const worked = onSeparateDays('2026-10-01', [
    { skill: 'inference', result: 'pass', responseType: MC, score: 1 },
    { skill: 'inference', result: 'fail', responseType: OPEN },
    { skill: 'inference', result: 'pass', responseType: OPEN },
    { skill: 'inference', result: 'pass', responseType: MC, score: 1 },
    { skill: 'inference', result: 'pass', responseType: OPEN },
  ]);

  test('worked example promotes on exactly the 5th attempt, not before', () => {
    for (let n = 1; n <= 4; n++) {
      assert.equal(computeSkillStates(worked.slice(0, n)).inference.band, 'foundation', `after ${n}`);
    }
    assert.equal(computeSkillStates(worked).inference.band, 'developing');
  });

  test('worked example leaves the other three skills unchanged', () => {
    const states = computeSkillStates(worked);
    for (const skill of ['comprehension', 'reasoning', 'articulation'] as const) {
      assert.equal(states[skill].band, 'foundation');
    }
  });

  test('blocked when only multiple-choice passes exist in a writing skill', () => {
    // The first attempt fails so fast track (P2) is ruled out.
    const allMc = onSeparateDays('2026-10-01', [
      { skill: 'reasoning', responseType: MC, result: 'fail', score: 0 },
      ...Array.from({ length: 8 }, () => ({ skill: 'reasoning' as const, responseType: MC, score: 1 })),
    ]);
    assert.equal(computeSkillStates(allMc).reasoning.band, 'foundation');
  });

  test('tap-the-sentence and order passes count like multiple choice, not open text', () => {
    for (const responseType of ['tap_sentence', 'order'] as const) {
      const list = onSeparateDays('2026-10-01', [
        { skill: 'inference', responseType, result: 'fail', score: 0 },
        ...Array.from({ length: 8 }, () => ({ skill: 'inference' as const, responseType, score: 1 })),
      ]);
      assert.equal(computeSkillStates(list).inference.band, 'foundation', responseType);
    }
  });

  test('the first try at a new format is practice; later tries count', () => {
    const bad = 'bad_summary' as const;
    const four = onSeparateDays('2026-10-01', [
      { skill: 'comprehension', responseType: MC, result: 'fail', score: 0 },
      { skill: 'comprehension', responseType: bad, score: 1 }, // first try: practice
      { skill: 'comprehension', responseType: MC, score: 1 },
      { skill: 'comprehension', responseType: MC, score: 1 },
      { skill: 'comprehension', responseType: MC, score: 1 },
    ]);
    // Only 4 counted attempts so far, so no promotion yet (it would promote if the first try counted).
    assert.equal(computeSkillStates(four).comprehension.band, 'foundation');
    const five = [...four, ...onSeparateDays('2026-10-06', [{ skill: 'comprehension', responseType: bad, score: 1 }])];
    assert.equal(computeSkillStates(five).comprehension.band, 'developing');
  });

  test('six-word story passes count as open text for P1', () => {
    const story = 'six_word_story' as const;
    const list = onSeparateDays('2026-10-01', [
      { skill: 'articulation', responseType: MC, result: 'fail', score: 0 },
      { skill: 'articulation', responseType: MC, score: 1 },
      { skill: 'articulation', responseType: story, score: 5 / 6 },
      { skill: 'articulation', responseType: MC, score: 1 },
      { skill: 'articulation', responseType: story, score: 4 / 6 },
    ]);
    assert.equal(computeSkillStates(list).articulation.band, 'developing');
  });

  test('comprehension may promote on tap-the-sentence and order passes', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'comprehension', responseType: 'order', result: 'fail', score: 0 },
      ...Array.from({ length: 2 }, () => ({ skill: 'comprehension' as const, responseType: 'tap_sentence' as const, score: 1 })),
      ...Array.from({ length: 2 }, () => ({ skill: 'comprehension' as const, responseType: 'order' as const, score: 1 })),
    ]);
    assert.equal(computeSkillStates(list).comprehension.band, 'developing');
  });

  test('blocked with only 1 open-text pass in the last 5', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'articulation', responseType: OPEN, result: 'fail' },
      { skill: 'articulation', responseType: MC, score: 1 },
      { skill: 'articulation', responseType: MC, score: 1 },
      { skill: 'articulation', responseType: MC, score: 1 },
      { skill: 'articulation', responseType: OPEN },
    ]);
    assert.equal(computeSkillStates(list).articulation.band, 'foundation');
  });

  test('comprehension may promote on multiple-choice passes alone', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'comprehension', responseType: MC, result: 'fail', score: 0 },
      ...Array.from({ length: 4 }, () => ({ skill: 'comprehension' as const, responseType: MC, score: 1 })),
    ]);
    assert.equal(computeSkillStates(list).comprehension.band, 'developing');
  });

  test('blocked when the latest attempt failed', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'comprehension' },
      { skill: 'comprehension' },
      { skill: 'comprehension' },
      { skill: 'comprehension' },
      { skill: 'comprehension', result: 'fail' },
    ]);
    assert.equal(computeSkillStates(list).comprehension.band, 'foundation');
  });

  test('promotion clears the window: 5 more attempts are needed in the new band', () => {
    const first = onSeparateDays(
      '2026-10-01',
      Array.from({ length: 5 }, () => ({ skill: 'comprehension' as const })),
    );
    const next = onSeparateDays(
      '2026-10-06',
      Array.from({ length: 4 }, () => ({ skill: 'comprehension' as const, band: 'developing' as const })),
    );
    assert.equal(computeSkillStates([...first, ...next]).comprehension.band, 'developing');
    const fifth = attempt({ skill: 'comprehension', band: 'developing', localDate: '2026-10-10' });
    assert.equal(computeSkillStates([...first, ...next, fifth]).comprehension.band, 'advanced');
  });

  test('bands never go past deep', () => {
    const list: Attempt[] = [];
    let day = 0;
    for (const band of ['foundation', 'developing', 'advanced', 'deep'] as const) {
      for (let i = 0; i < 6; i++) {
        list.push(attempt({ skill: 'comprehension', band, localDate: `2026-11-${String(++day).padStart(2, '0')}` }));
      }
    }
    assert.equal(computeSkillStates(list).comprehension.band, 'deep');
  });
});

describe('P2 fast track', () => {
  test('3 perfect scores at Foundation promote immediately', () => {
    const list = onSeparateDays(
      '2026-10-01',
      Array.from({ length: 3 }, () => ({ skill: 'reasoning' as const, score: 1 })),
    );
    assert.equal(computeSkillStates(list.slice(0, 2)).reasoning.band, 'foundation');
    const state = computeSkillStates(list).reasoning;
    assert.equal(state.band, 'developing');
    assert.equal(state.fastTrackUsed, true);
  });

  test('never triggers twice', () => {
    const list = onSeparateDays('2026-10-01', [
      ...Array.from({ length: 3 }, () => ({ skill: 'reasoning' as const, score: 1 })),
      ...Array.from({ length: 3 }, () => ({ skill: 'reasoning' as const, band: 'developing' as const, score: 1 })),
    ]);
    assert.equal(computeSkillStates(list).reasoning.band, 'developing');
  });

  test('only the first 3 attempts count: a non-perfect one among them rules it out', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'reasoning', score: 5 / 6 },
      { skill: 'reasoning', score: 1 },
      { skill: 'reasoning', score: 1 },
      { skill: 'reasoning', score: 1 },
    ]);
    const state = computeSkillStates(list).reasoning;
    assert.equal(state.band, 'foundation');
    assert.equal(state.fastTrackUsed, false);
  });

  test('unscored attempts are skipped, not counted among the first 3', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'reasoning', score: 1 },
      { skill: 'reasoning', result: 'unscored' },
      { skill: 'reasoning', score: 1 },
      { skill: 'reasoning', score: 1 },
    ]);
    assert.equal(computeSkillStates(list).reasoning.band, 'developing');
  });
});

describe('P3 review', () => {
  // Gets a skill to developing, then fails at developing.
  const promoted = onSeparateDays(
    '2026-10-01',
    Array.from({ length: 3 }, () => ({ skill: 'inference' as const, score: 1 })),
  );
  const devFail = (day: string) => attempt({ skill: 'inference', band: 'developing', result: 'fail', localDate: day });

  test('3 consecutive fails start review of 2 exercises', () => {
    const list = [...promoted, devFail('2026-10-05'), devFail('2026-10-06')];
    assert.equal(computeSkillStates(list).inference.reviewRemaining, 0);
    const state = computeSkillStates([...list, devFail('2026-10-07')]).inference;
    assert.equal(state.reviewRemaining, 2);
    assert.equal(state.consecutiveFails, 0);
    assert.equal(state.band, 'developing', 'the band label never changes');
  });

  test('a pass resets the consecutive-fail count', () => {
    const list = [
      ...promoted,
      devFail('2026-10-05'),
      devFail('2026-10-06'),
      attempt({ skill: 'inference', band: 'developing', localDate: '2026-10-07' }),
      devFail('2026-10-08'),
    ];
    const state = computeSkillStates(list).inference;
    assert.equal(state.consecutiveFails, 1);
    assert.equal(state.reviewRemaining, 0);
  });

  test('at Foundation, 3 fails reset the count and start no review', () => {
    const list = onSeparateDays(
      '2026-10-01',
      Array.from({ length: 3 }, () => ({ skill: 'comprehension' as const, result: 'fail' as const })),
    );
    const state = computeSkillStates(list).comprehension;
    assert.equal(state.reviewRemaining, 0);
    assert.equal(state.consecutiveFails, 0);
  });

  test('review attempts use up review, even unscored, and never touch the fail count', () => {
    const inReview = [...promoted, devFail('2026-10-05'), devFail('2026-10-06'), devFail('2026-10-07')];
    const r1 = attempt({ skill: 'inference', band: 'foundation', kind: 'review', result: 'fail', localDate: '2026-10-08' });
    const r2 = attempt({ skill: 'inference', band: 'foundation', kind: 'review', result: 'unscored', localDate: '2026-10-09' });
    assert.equal(computeSkillStates([...inReview, r1]).inference.reviewRemaining, 1);
    const state = computeSkillStates([...inReview, r1, r2]).inference;
    assert.equal(state.reviewRemaining, 0);
    assert.equal(state.consecutiveFails, 0);
  });

  test('a new review needs 3 more fails at the normal band after review ends', () => {
    const list = [
      ...promoted,
      devFail('2026-10-05'),
      devFail('2026-10-06'),
      devFail('2026-10-07'),
      attempt({ skill: 'inference', band: 'foundation', kind: 'review', result: 'fail', localDate: '2026-10-08' }),
      attempt({ skill: 'inference', band: 'foundation', kind: 'review', result: 'fail', localDate: '2026-10-09' }),
      devFail('2026-10-10'),
      devFail('2026-10-11'),
    ];
    assert.equal(computeSkillStates(list).inference.reviewRemaining, 0);
    assert.equal(computeSkillStates([...list, devFail('2026-10-12')]).inference.reviewRemaining, 2);
  });
});

describe('attempts that never count toward promotion', () => {
  test('review attempts never count', () => {
    const list = onSeparateDays(
      '2026-10-01',
      Array.from({ length: 6 }, () => ({ skill: 'comprehension' as const, kind: 'review' as const })),
    );
    assert.equal(computeSkillStates(list).comprehension.band, 'foundation');
  });

  test('repeat attempts never count', () => {
    const list = onSeparateDays(
      '2026-10-01',
      Array.from({ length: 6 }, () => ({ skill: 'comprehension' as const, kind: 'repeat' as const })),
    );
    assert.equal(computeSkillStates(list).comprehension.band, 'foundation');
  });

  test('unscored attempts do not count as attempts', () => {
    const list = onSeparateDays('2026-10-01', [
      { skill: 'comprehension' },
      { skill: 'comprehension' },
      { skill: 'comprehension' },
      { skill: 'comprehension', result: 'unscored' },
      { skill: 'comprehension' },
    ]);
    assert.equal(computeSkillStates(list).comprehension.band, 'foundation', 'only 4 scored attempts');
    const fifth = attempt({ skill: 'comprehension', localDate: '2026-10-09' });
    assert.equal(computeSkillStates([...list, fifth]).comprehension.band, 'developing');
  });

  test('P5: only 3 scored attempts per skill per day count', () => {
    const sameDay = Array.from({ length: 5 }, () => attempt({ skill: 'comprehension', localDate: '2026-10-01' }));
    assert.equal(computeSkillStates(sameDay).comprehension.band, 'foundation');
  });
});
