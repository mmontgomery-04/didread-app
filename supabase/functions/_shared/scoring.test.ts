/// <reference types="node" />
// The backend's copy of the open-text scoring rules must agree with src/engine/scoring.ts exactly.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as engine from '../../../src/engine/scoring.ts';
import * as backend from './scoring.ts';

const flagSets = [
  { off_topic: false, not_an_answer: false },
  { off_topic: true, not_an_answer: false },
  { off_topic: false, not_an_answer: true },
];

test('every score combination, required criterion and flag gives the same result in both copies', () => {
  for (const requiredId of ['c1', 'c2', 'c3']) {
    const rubric = ['c1', 'c2', 'c3'].map((id) => ({ id, required: id === requiredId }));
    for (let c1 = 0; c1 <= 2; c1++)
      for (let c2 = 0; c2 <= 2; c2++)
        for (let c3 = 0; c3 <= 2; c3++)
          for (const flags of flagSets) {
            const criteria = [
              { id: 'c1', score: c1 },
              { id: 'c2', score: c2 },
              { id: 'c3', score: c3 },
            ];
            assert.deepEqual(
              backend.scoreOpenText(rubric, criteria, flags),
              engine.scoreOpenText(rubric, criteria, flags),
            );
          }
  }
});

test('invalid scores are unscored in both copies', () => {
  const rubric = [
    { id: 'c1', required: true },
    { id: 'c2', required: false },
    { id: 'c3', required: false },
  ];
  const noFlags = flagSets[0];
  const bad = [
    [{ id: 'c1', score: 2 }, { id: 'c2', score: 2 }],
    [{ id: 'c1', score: 3 }, { id: 'c2', score: 2 }, { id: 'c3', score: 2 }],
    [{ id: 'c1', score: 1.5 }, { id: 'c2', score: 2 }, { id: 'c3', score: 2 }],
    [{ id: 'c1', score: 2 }, { id: 'c2', score: 2 }, { id: 'c4', score: 2 }],
  ];
  for (const criteria of bad) {
    assert.equal(backend.scoreOpenText(rubric, criteria, noFlags).result, 'unscored');
    assert.deepEqual(backend.scoreOpenText(rubric, criteria, noFlags), engine.scoreOpenText(rubric, criteria, noFlags));
  }
});

test('word counting and the 8-word minimum match', () => {
  for (const text of ['', '   ', 'one two three four five six seven', 'one two three four five six seven eight', ' a\n\nb\tc ']) {
    assert.equal(backend.countWords(text), engine.countWords(text));
    assert.equal(backend.isAnswerTooShort(text), engine.isAnswerTooShort(text));
  }
  assert.equal(backend.MIN_OPEN_TEXT_WORDS, engine.MIN_OPEN_TEXT_WORDS);
});
