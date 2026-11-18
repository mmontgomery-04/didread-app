/// <reference types="node" />
// In-memory session changes (batch 3): first completion, reading time, drafts.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  draftFor,
  EMPTY_SESSION,
  openQuestion,
  recordAttempt,
  saveFreeWrite,
  startExercise,
  tapOrderItem,
  updateCurrent,
  type SessionState,
} from './sessionLogic.ts';

const today = '2026-10-01';
const mc = { id: 'comp-f-001', skill: 'comprehension', band: 'foundation', response_type: 'multiple_choice', word_count: 189 } as const;
const open = { id: 'inf-f-001', skill: 'inference', band: 'foundation', response_type: 'open_text', word_count: 172 } as const;

/** Opens, reads for 60 seconds, and submits one exercise. */
function complete(s: SessionState, exercise: typeof mc | typeof open, result: 'pass' | 'fail' | 'unscored', counts = true, at = 0) {
  s = startExercise(s, { exerciseId: exercise.id, kind: 'daily' }, counts, at, today);
  s = openQuestion(s, at + 60_000);
  return recordAttempt(s, exercise, result, result === 'unscored' ? null : result === 'pass' ? 1 : 0, {}, at + 90_000, today);
}

describe('"Your first DidRead!"', () => {
  test('shows on the very first completed exercise only, right or wrong', () => {
    const first = complete(EMPTY_SESSION, mc, 'fail');
    assert.equal(first.lastResult?.firstEver, true);
    const second = complete(first, open, 'unscored');
    assert.equal(second.lastResult?.firstEver, false);
    const third = complete(second, mc, 'pass');
    assert.equal(third.lastResult?.firstEver, false);
  });

  test('a dev-panel exercise done first uses it up, so the next one is standard', () => {
    const dev = complete(EMPTY_SESSION, mc, 'pass', false);
    assert.equal(dev.lastResult?.firstEver, true);
    assert.equal(dev.attempts.length, 0);
    assert.equal(complete(dev, open, 'unscored').lastResult?.firstEver, false);
  });

  test('shows again after Reset progress (in-memory only until batch 9)', () => {
    const done = complete(EMPTY_SESSION, mc, 'pass');
    const reset = { ...EMPTY_SESSION, dayOffset: done.dayOffset };
    assert.equal(complete(reset, mc, 'pass').lastResult?.firstEver, true);
  });
});

describe('Finish: the streak ticks up only when this read raised it (batch 3d)', () => {
  test('the first counted answer of the day raises it; later ones the same day do not', () => {
    const first = complete(EMPTY_SESSION, mc, 'pass');
    assert.equal(first.lastResult?.raisedStreak, true);
    assert.equal(complete(first, open, 'fail', true, 200_000).lastResult?.raisedStreak, false);
  });

  test('a saved free-write already made today a practice day', () => {
    const wrote = saveFreeWrite(EMPTY_SESSION, 'prompt-001', 'Morning words.', 0, today);
    assert.equal(complete(wrote, mc, 'pass').lastResult?.raisedStreak, false);
  });

  test('a dev-panel answer never raises it', () => {
    assert.equal(complete(EMPTY_SESSION, mc, 'pass', false).lastResult?.raisedStreak, false);
  });
});

describe('Keep going and "Read it again"', () => {
  test('re-reading keeps the first reading time (P7)', () => {
    let s = startExercise(EMPTY_SESSION, { exerciseId: mc.id, kind: 'daily' }, true, 0, today);
    s = openQuestion(s, 45_000); // first "I read it" after 45 seconds
    s = openQuestion(s, 300_000); // read it again, then "I read it" later
    s = recordAttempt(s, mc, 'pass', 1, { selectedOptionId: 'b' }, 320_000, today);
    assert.equal(s.attempts[0].readingSeconds, 45);
  });

  test('the draft answer and picked option survive going back to the passage', () => {
    let s = startExercise(EMPTY_SESSION, { exerciseId: open.id, kind: 'daily' }, true, 0, today);
    s = openQuestion(s, 30_000);
    s = updateCurrent(s, { draft: 'Marta is moving out' });
    s = openQuestion(s, 90_000); // back to the passage, then "I read it" again
    assert.equal(s.current?.draft, 'Marta is moving out');
    assert.equal(s.current?.questionOpenedAt, 30_000);
  });
});

describe('put it in order: tapping items', () => {
  test('tapping an unnumbered item gives it the next number', () => {
    assert.deepEqual(tapOrderItem([], 'c'), ['c']);
    assert.deepEqual(tapOrderItem(['c'], 'a'), ['c', 'a']);
  });

  test('tapping the item with the highest number undoes the last pick', () => {
    assert.deepEqual(tapOrderItem(['c', 'a', 'b'], 'b'), ['c', 'a']);
  });

  test('tapping any other numbered item does nothing', () => {
    assert.deepEqual(tapOrderItem(['c', 'a', 'b'], 'c'), ['c', 'a', 'b']);
    assert.deepEqual(tapOrderItem(['c', 'a', 'b'], 'a'), ['c', 'a', 'b']);
  });
});

describe('tap the sentence and order: picks survive leaving the question (Read it again, Keep going)', () => {
  test('the picked sentence and the order picks stay on the current exercise', () => {
    let s: SessionState = startExercise(EMPTY_SESSION, { exerciseId: 'comp-f-902', kind: 'daily' }, true, 0, '2026-10-01');
    s = updateCurrent(s, { orderPicks: ['b', 'a'], selectedSentenceIndex: 4 });
    s = openQuestion(s, 60_000);
    assert.deepEqual(s.current?.orderPicks, ['b', 'a']);
    assert.equal(s.current?.selectedSentenceIndex, 4);
  });

  test('the submitted answer reaches Feedback', () => {
    let s: SessionState = startExercise(EMPTY_SESSION, { exerciseId: 'comp-f-902', kind: 'daily' }, true, 0, '2026-10-01');
    const order = { id: 'comp-f-902', skill: 'comprehension' as const, band: 'foundation' as const, response_type: 'order' as const, word_count: 167 };
    s = recordAttempt(s, order, 'fail', 0, { submittedOrder: ['b', 'a', 'c'] }, 90_000, '2026-10-01');
    assert.deepEqual(s.lastResult?.submittedOrder, ['b', 'a', 'c']);
    assert.equal(s.attempts[0].responseType, 'order');
  });
});

describe('Say it your way: draft and save', () => {
  const withDraft: SessionState = {
    ...EMPTY_SESSION,
    freeWriteDraft: { promptId: 'prompt-001', localDate: '2026-10-03', text: 'My morning' },
  };

  test('an unsaved draft comes back for the same prompt on the same day only', () => {
    assert.equal(draftFor(withDraft, 'prompt-001', '2026-10-03'), 'My morning');
    assert.equal(draftFor(withDraft, 'prompt-001', '2026-10-04'), '', 'next day');
    assert.equal(draftFor(withDraft, 'prompt-002', '2026-10-03'), '', 'other prompt');
  });

  test('saving records the free-write and clears the draft', () => {
    const s = saveFreeWrite(withDraft, 'prompt-001', 'My morning', 1000, '2026-10-03');
    assert.deepEqual(s.freeWrites, [{ promptId: 'prompt-001', text: 'My morning', localDate: '2026-10-03', createdAt: 1000 }]);
    assert.equal(s.freeWriteDraft, null);
    assert.deepEqual(s.attempts, [], 'never an attempt, so it never affects bands');
  });

  test('Save needs at least one character', () => {
    assert.equal(saveFreeWrite(EMPTY_SESSION, 'prompt-001', '   ', 1000, '2026-10-03'), EMPTY_SESSION);
  });
});
