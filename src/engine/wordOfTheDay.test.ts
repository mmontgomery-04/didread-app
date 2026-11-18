/// <reference types="node" />
// Word of the Day (batch 15): each person's own order, one word per calendar day.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { wordChoices, wordOfTheDay } from './wordOfTheDay.ts';

// Listed out of order on purpose: sequence decides.
const words = [
  { id: 'word-003', sequence: 3 },
  { id: 'word-001', sequence: 1 },
  { id: 'word-002', sequence: 2 },
];
const START = '2026-10-15';

test('the first day is the first word, by sequence', () => {
  assert.equal(wordOfTheDay(words, START, START)?.id, 'word-001');
});

test('the next word each calendar day, even on days the app is not opened', () => {
  assert.equal(wordOfTheDay(words, START, '2026-10-16')?.id, 'word-002');
  assert.equal(wordOfTheDay(words, START, '2026-10-17')?.id, 'word-003');
});

test('after the last word, it starts over from the first', () => {
  assert.equal(wordOfTheDay(words, START, '2026-10-18')?.id, 'word-001');
  assert.equal(wordOfTheDay(words, START, '2026-10-19')?.id, 'word-002');
});

test('words added later are reached in order', () => {
  const more = [...words, { id: 'word-004', sequence: 4 }];
  assert.equal(wordOfTheDay(more, START, '2026-10-18')?.id, 'word-004');
});

test('each person has their own order: a later start begins at the first word', () => {
  assert.equal(wordOfTheDay(words, '2026-10-17', '2026-10-17')?.id, 'word-001');
});

test('a date before the start shows the first word; no words shows nothing', () => {
  assert.equal(wordOfTheDay(words, START, '2026-10-10')?.id, 'word-001');
  assert.equal(wordOfTheDay([], START, START), null);
});

test('works across month and year ends', () => {
  assert.equal(wordOfTheDay(words, '2026-12-31', '2027-01-01')?.id, 'word-002');
});

test('batch 16: the choices are the meaning and its wrong ones, in the same order every time', () => {
  const choices = wordChoices('word-001', 'right', ['wrong 1', 'wrong 2']);
  assert.deepEqual([...choices].sort(), ['right', 'wrong 1', 'wrong 2']);
  assert.deepEqual(wordChoices('word-001', 'right', ['wrong 1', 'wrong 2']), choices);
});

test('batch 16: the right meaning is not always first', () => {
  const firsts = new Set(
    Array.from({ length: 30 }, (_, i) => wordChoices(`word-${String(i + 1).padStart(3, '0')}`, 'right', ['a', 'b'])[0]),
  );
  assert.ok(firsts.size > 1);
});
