/// <reference types="node" />
// Real AI feedback in the app: reading score-response's reply (SPEC section 6).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { readScoreReply } from './scoreReply.ts';

describe("Reading score-response's reply", () => {
  test('a pass or fail keeps the feedback and turns the total into a 0-1 score', () => {
    assert.deepEqual(readScoreReply({ result: 'pass', total: 5, feedback: 'Good point about the price.' }, false), {
      result: 'pass',
      score: 5 / 6,
      feedback: 'Good point about the price.',
      saved: true,
      refused: false,
    });
    assert.equal(readScoreReply({ result: 'fail', total: 2, feedback: 'You noticed the excuse.' }, false).score, 2 / 6);
  });

  test('unscored from the server (AI failed, or the daily limit): saved, no score, no feedback', () => {
    assert.deepEqual(readScoreReply({ result: 'unscored', total: null, feedback: null }, false), {
      result: 'unscored',
      score: null,
      feedback: null,
      saved: true,
      refused: false,
    });
  });

  test('no reply (no signal, server error): unscored and not saved', () => {
    assert.deepEqual(readScoreReply(null, true), { result: 'unscored', score: null, feedback: null, saved: false, refused: false });
    assert.equal(readScoreReply({ result: 'pass', total: 6, feedback: 'x' }, true).result, 'unscored');
    for (const status of [401, 500, 502, 503]) assert.equal(readScoreReply(null, true, status).refused, false, String(status));
  });

  test('a refusal (400, 403, 404) is final: not saved, and not worth retrying', () => {
    for (const status of [400, 403, 404]) {
      assert.deepEqual(readScoreReply({ error: 'not_available' }, true, status), {
        result: 'unscored',
        score: null,
        feedback: null,
        saved: false,
        refused: true,
      });
    }
  });

  test('anything unexpected is unscored, never a guess', () => {
    for (const reply of [
      { result: 'pass', total: 7, feedback: 'x' },
      { result: 'pass', total: 4.5, feedback: 'x' },
      { result: 'fail', total: null, feedback: 'x' },
      { result: 'pass', total: 4, feedback: '' },
      { result: 'great', total: 4, feedback: 'x' },
      'pass',
    ]) {
      assert.equal(readScoreReply(reply, false).result, 'unscored');
      assert.equal(readScoreReply(reply, false).score, null);
    }
  });
});
