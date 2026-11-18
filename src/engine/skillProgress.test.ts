/// <reference types="node" />
// Progress screen bars (batch 9, founder's decision): passes among the last 5 counted attempts at
// the current band, out of 4; writing skills stop at 3/4 until 2 of those passes are open text.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { skillProgress } from './progression.ts';
import { onSeparateDays } from './testHelpers.ts';

const MC = 'multiple_choice' as const;
const OPEN = 'open_text' as const;

describe('Progress screen: how full each skill bar is', () => {
  test('empty with no attempts', () => {
    assert.deepEqual(skillProgress([]), { comprehension: 0, inference: 0, reasoning: 0, articulation: 0 });
  });

  test('passes among the last 5, out of 4 (comprehension needs no open text)', () => {
    const attempts = onSeparateDays('2026-10-01', [
      { skill: 'comprehension', responseType: MC, result: 'pass', score: 1 },
      { skill: 'comprehension', responseType: MC, result: 'fail', score: 0 },
      { skill: 'comprehension', responseType: MC, result: 'pass', score: 1 },
    ]);
    assert.equal(skillProgress(attempts).comprehension, 2 / 4);
  });

  test('a writing skill stops at 3/4 until 2 of the passes are open text', () => {
    const allMc = onSeparateDays('2026-10-01', [
      { skill: 'inference', responseType: MC, result: 'pass', score: 1 },
      { skill: 'inference', responseType: MC, result: 'fail', score: 0 },
      { skill: 'inference', responseType: MC, result: 'pass', score: 1 },
      { skill: 'inference', responseType: MC, result: 'pass', score: 1 },
      { skill: 'inference', responseType: OPEN, result: 'fail' },
    ]);
    assert.equal(skillProgress(allMc).inference, 3 / 4);
  });

  test('only the last 5 count, and unscored attempts never do', () => {
    const attempts = onSeparateDays('2026-10-01', [
      { skill: 'reasoning', responseType: OPEN, result: 'pass' },
      { skill: 'reasoning', responseType: OPEN, result: 'fail' },
      { skill: 'reasoning', responseType: OPEN, result: 'fail' },
      { skill: 'reasoning', responseType: OPEN, result: 'unscored' },
      { skill: 'reasoning', responseType: OPEN, result: 'fail' },
      { skill: 'reasoning', responseType: OPEN, result: 'pass' },
      { skill: 'reasoning', responseType: OPEN, result: 'pass' },
    ]);
    // 6 counted (the unscored one isn't); the first pass falls outside the last 5, leaving 2 passes.
    assert.equal(skillProgress(attempts).reasoning, 2 / 4);
  });

  test('starts again from empty after moving up a band', () => {
    // Fast track (P2): the first 3 at Foundation all score 1.0.
    const attempts = onSeparateDays('2026-10-01', [
      { skill: 'comprehension', responseType: MC, result: 'pass', score: 1 },
      { skill: 'comprehension', responseType: MC, result: 'pass', score: 1 },
      { skill: 'comprehension', responseType: MC, result: 'pass', score: 1 },
    ]);
    assert.equal(skillProgress(attempts).comprehension, 0);
  });
});
