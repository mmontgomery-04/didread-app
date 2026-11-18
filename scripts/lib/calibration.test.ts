/// <reference types="node" />
// SPEC section 5, "QC pipeline", step 3: the calibration rule.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  callCost,
  estimateTokens,
  asksOneQuestion,
  firstSentence,
  judgeExercise,
  opensWithGenericPraise,
  type AnchorSpec,
  type RunResult,
} from './calibration.ts';

const anchors: AnchorSpec[] = [
  { label: 'strong', expected_scores: { c1: 2, c2: 2, c3: 2 }, expected_pass: true },
  { label: 'partial', expected_scores: { c1: 2, c2: 1, c3: 1 }, expected_pass: true },
  { label: 'weak', expected_scores: { c1: 0, c2: 0, c3: 0 }, expected_pass: false },
];
const run = (c1: number, c2: number, c3: number, result: 'pass' | 'fail'): RunResult => ({
  result,
  criteria_scores: { c1, c2, c3 },
});
const unscored: RunResult = { result: 'unscored' };
const five = (r: RunResult) => [r, r, r, r, r];
const perfect = () => [five(run(2, 2, 2, 'pass')), five(run(2, 1, 1, 'pass')), five(run(0, 0, 0, 'fail'))];

describe('judgeExercise', () => {
  test('every run as expected passes', () => {
    const v = judgeExercise(anchors, perfect());
    assert.equal(v.passed, true);
    assert.deepEqual(v.problems, []);
    assert.deepEqual(v.anchors[1].matches, { c1: 5, c2: 5, c3: 5 });
  });

  test('a criterion matching in 4 of 5 runs still passes', () => {
    const runs = perfect();
    runs[1] = [run(2, 1, 1, 'pass'), run(2, 1, 1, 'pass'), run(2, 1, 1, 'pass'), run(2, 1, 1, 'pass'), run(2, 2, 1, 'pass')];
    assert.equal(judgeExercise(anchors, runs).passed, true);
  });

  test('a criterion matching in only 3 of 5 runs fails, and says which', () => {
    const runs = perfect();
    runs[1] = [run(2, 1, 1, 'pass'), run(2, 1, 1, 'pass'), run(2, 1, 1, 'pass'), run(2, 2, 1, 'pass'), run(2, 0, 1, 'fail')];
    const v = judgeExercise(anchors, runs);
    assert.equal(v.passed, false);
    assert.deepEqual(v.problems, ['partial c2 (expected 1): matched in 3 of 5 runs (needs 4); got 1,1,1,2,0']);
  });

  test('the strong anchor must pass every run', () => {
    const runs = perfect();
    // Scores still match 4 of 5, but one run failed: not allowed for the strong anchor.
    runs[0] = [...five(run(2, 2, 2, 'pass')).slice(0, 4), run(0, 2, 2, 'fail')];
    const v = judgeExercise(anchors, runs);
    assert.equal(v.passed, false);
    assert.ok(v.problems.includes('strong: passed 4 of 5 runs (must always pass)'));
  });

  test('the weak anchor must fail every run', () => {
    const runs = perfect();
    runs[2] = [...five(run(0, 0, 0, 'fail')).slice(0, 4), run(2, 1, 1, 'pass')];
    const v = judgeExercise(anchors, runs);
    assert.equal(v.passed, false);
    assert.ok(v.problems.includes('weak: failed 4 of 5 runs (must always fail)'));
  });

  test('unscored runs never count as matches, passes or fails', () => {
    const runs = perfect();
    runs[2] = [unscored, ...five(run(0, 0, 0, 'fail')).slice(0, 4)];
    const v = judgeExercise(anchors, runs);
    assert.equal(v.anchors[2].unscored, 1);
    assert.deepEqual(v.anchors[2].matches, { c1: 4, c2: 4, c3: 4 });
    assert.ok(v.problems.includes('weak: failed 4 of 5 runs (must always fail)'));
  });

  test('missing runs are reported', () => {
    const runs = perfect();
    runs[0] = runs[0].slice(0, 3);
    assert.ok(judgeExercise(anchors, runs).problems.includes('strong: only 3 of 5 runs finished'));
  });
});

test('callCost uses prices per million tokens', () => {
  const price = { model: 'm', input_usd_per_million: 0.4, output_usd_per_million: 1.6 };
  assert.equal(callCost(price, 1_000_000, 0), 0.4);
  assert.ok(Math.abs(callCost(price, 1500, 150) - 0.00084) < 1e-12);
});

test('estimateTokens is about 4 characters per token, rounded up', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcde'), 2);
});

describe('generic praise check', () => {
  test('first sentence', () => {
    assert.equal(firstSentence('“Hides her sadness” is spot on. Why the balcony?'), '“Hides her sadness” is spot on.');
    assert.equal(firstSentence('No full stop here'), 'No full stop here');
  });

  test('flags generic openers and phrases in the first sentence only', () => {
    assert.equal(opensWithGenericPraise('You did a great job noticing Marta. Why?'), true);
    assert.equal(opensWithGenericPraise('Great catch on the laugh. Why?'), true);
    assert.equal(opensWithGenericPraise('Spotting the laugh was, well done, sharp. Why?'), true);
    assert.equal(opensWithGenericPraise('“Hides her sadness” is spot on. Nice work overall.'), false);
    assert.equal(opensWithGenericPraise('The empty watering can stood out to you. Why?'), false);
    assert.equal(opensWithGenericPraise('Goodbyes are the idea you caught. Why?'), false);
  });
});

describe('one question check', () => {
  test('passes only one question mark, at the very end', () => {
    assert.equal(asksOneQuestion('“Hides her sadness” is spot on. What makes the balcony matter?'), true);
    assert.equal(asksOneQuestion('The watering can stood out. Why would she keep it?”'), true);
    assert.equal(asksOneQuestion('Can you think of another clue? Also, what does the laugh mean?'), false);
    assert.equal(asksOneQuestion('Why the balcony? It says a lot about her.'), false);
    assert.equal(asksOneQuestion('The watering can stood out to you.'), false);
  });
});
