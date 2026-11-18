/// <reference types="node" />
// SPEC section 4, "Scoring".
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  countWords,
  isAnswerTooShort,
  scoreMultipleChoice,
  scoreOpenText,
  scoreOrder,
  scoreTapSentence,
  scoreBadSummary,
  scoreWordSprint,
  SPRINT_SECONDS,
  isAnswerBlocked,
  countStoryWords,
} from './scoring.ts';

const rubric = [
  { id: 'c1', required: true },
  { id: 'c2', required: false },
  { id: 'c3', required: false },
];
const noFlags = { off_topic: false, not_an_answer: false };
const scores = (c1: number, c2: number, c3: number) => [
  { id: 'c1', score: c1 },
  { id: 'c2', score: c2 },
  { id: 'c3', score: c3 },
];

describe('multiple choice', () => {
  test('correct = 1.0 and pass; wrong = 0.0 and fail', () => {
    assert.deepEqual(scoreMultipleChoice('b', 'b'), { result: 'pass', total: null, score: 1 });
    assert.deepEqual(scoreMultipleChoice('a', 'b'), { result: 'fail', total: null, score: 0 });
  });
});

describe('tap the sentence', () => {
  test('correct = 1.0 and pass; wrong = 0.0 and fail', () => {
    assert.deepEqual(scoreTapSentence(3, 3), { result: 'pass', total: null, score: 1 });
    assert.deepEqual(scoreTapSentence(0, 3), { result: 'fail', total: null, score: 0 });
  });
});

describe('Bad Summary (batch 13)', () => {
  test('right only when the wrong summary is picked', () => {
    assert.deepEqual(scoreBadSummary('b', 'b'), { result: 'pass', total: null, score: 1 });
    assert.deepEqual(scoreBadSummary('a', 'b'), { result: 'fail', total: null, score: 0 });
  });
});

describe('Word Sprint (batch 13)', () => {
  const answers = ['candid', 'frugal', 'baker', 'end', 'word'];
  test('4 or 5 right passes; 3 fails; time-outs count as wrong; case is ignored', () => {
    assert.deepEqual(scoreWordSprint(answers, answers), { result: 'pass', total: 5, score: 1 });
    assert.deepEqual(scoreWordSprint(['Candid', 'frugal', 'baker', 'end', null], answers), { result: 'pass', total: 4, score: 0.8 });
    assert.deepEqual(scoreWordSprint(['candid', 'rash', null, 'end', 'word'], answers), { result: 'fail', total: 3, score: 0.6 });
  });
  test('the timer shrinks 10, 9, 8, 7, 6 seconds', () => {
    assert.deepEqual([...SPRINT_SECONDS], [10, 9, 8, 7, 6]);
  });
});

describe('six-word stories', () => {
  test('blocked unless exactly six words', () => {
    assert.equal(isAnswerBlocked('six_word_story', 'One two three four five six.'), false);
    assert.equal(isAnswerBlocked('six_word_story', 'One two three four five.'), true);
    assert.equal(countStoryWords('Pea-sized lumps, 1961 — gone forever.'), 5);
  });
});

describe('put it in order', () => {
  test('fully correct = 1.0 and pass', () => {
    assert.deepEqual(scoreOrder(['a', 'b', 'c'], ['a', 'b', 'c']), { result: 'pass', total: null, score: 1 });
  });

  test('anything else = 0.0 and fail, with no partial credit', () => {
    assert.deepEqual(scoreOrder(['a', 'c', 'b'], ['a', 'b', 'c']), { result: 'fail', total: null, score: 0 });
    assert.deepEqual(scoreOrder(['b', 'c', 'd', 'a'], ['a', 'b', 'c', 'd']), { result: 'fail', total: null, score: 0 });
    assert.equal(scoreOrder(['a', 'b'], ['a', 'b', 'c']).result, 'fail', 'incomplete');
  });
});

describe('open text', () => {
  test('pass needs a total of at least 4 and the required criterion at least 1', () => {
    assert.deepEqual(scoreOpenText(rubric, scores(1, 2, 1), noFlags), { result: 'pass', total: 4, score: 4 / 6 });
    assert.equal(scoreOpenText(rubric, scores(0, 2, 2), noFlags).result, 'fail', 'required criterion is 0');
    assert.equal(scoreOpenText(rubric, scores(2, 1, 0), noFlags).result, 'fail', 'total is 3');
    assert.deepEqual(scoreOpenText(rubric, scores(2, 2, 2), noFlags), { result: 'pass', total: 6, score: 1 });
  });

  test('off_topic or not_an_answer treats every criterion as 0', () => {
    assert.deepEqual(scoreOpenText(rubric, scores(2, 2, 2), { off_topic: true, not_an_answer: false }), {
      result: 'fail',
      total: 0,
      score: 0,
    });
    assert.equal(scoreOpenText(rubric, scores(2, 2, 2), { off_topic: false, not_an_answer: true }).result, 'fail');
  });

  test('scores that do not match the rubric exactly are unscored, never guessed', () => {
    const unscored = { result: 'unscored', total: null, score: null };
    assert.deepEqual(scoreOpenText(rubric, scores(2, 2, 2).slice(0, 2), noFlags), unscored);
    assert.deepEqual(scoreOpenText(rubric, [...scores(2, 2, 2).slice(0, 2), { id: 'c4', score: 2 }], noFlags), unscored);
    assert.deepEqual(scoreOpenText(rubric, scores(2, 3, 2), noFlags), unscored);
    assert.deepEqual(scoreOpenText(rubric, scores(2, 1.5, 2), noFlags), unscored);
    assert.deepEqual(scoreOpenText(rubric, scores(2, -1, 2), noFlags), unscored);
  });
});

describe('blocked before sending', () => {
  test('open-text answers under 8 words are blocked', () => {
    assert.equal(countWords('  The bee dances   to show\nthe way.  '), 7);
    assert.equal(isAnswerTooShort('The bee dances to show the way.'), true);
    assert.equal(isAnswerTooShort('The bee dances to show the other bees.'), false);
    assert.equal(isAnswerTooShort(''), true);
  });
});
