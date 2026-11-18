/// <reference types="node" />
// SPEC section 6: request checks, limits, and AI output validation.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { answerLengthProblem, isOverDailyLimit, parseAiOutput, truncateFeedback, validateRequest } from './contract.ts';

const TODAY = '2026-09-30';
const goodRequest = {
  exercise_id: 'inf-f-001',
  exercise_version: 1,
  response_text: 'The writer hints that the town changed because the mill closed.',
  kind: 'daily',
  local_date: TODAY,
  reading_seconds: 95,
};

describe('validateRequest', () => {
  test('a good request passes', () => {
    assert.deepEqual(validateRequest(goodRequest, TODAY), { ok: true, request: goodRequest });
  });

  test('local date may be one day either side of the UTC date (any time zone), not more', () => {
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-09-29' }, TODAY).ok, true);
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-10-01' }, TODAY).ok, true);
    assert.deepEqual(validateRequest({ ...goodRequest, local_date: '2026-10-02' }, TODAY), {
      ok: false,
      problem: 'bad_request',
    });
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-09-28' }, TODAY).ok, false);
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-02-30' }, '2026-02-28').ok, false);
    assert.equal(validateRequest({ ...goodRequest, local_date: '30/09/2026' }, TODAY).ok, false);
  });

  test('the test user may send any real date (Skip to tomorrow), but still a real date', () => {
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-10-09' }, TODAY, true).ok, true);
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-02-30' }, TODAY, true).ok, false);
    assert.equal(validateRequest({ ...goodRequest, local_date: '2026-10-09' }, TODAY).ok, false);
  });

  test('over 1,000 characters is refused as too_long', () => {
    const exactly1000 = 'word '.repeat(200);
    assert.equal(exactly1000.length, 1000);
    assert.equal(validateRequest({ ...goodRequest, response_text: exactly1000 }, TODAY).ok, true);
    assert.deepEqual(validateRequest({ ...goodRequest, response_text: `${exactly1000}x` }, TODAY), {
      ok: false,
      problem: 'too_long',
    });
  });

  test('a short answer is not refused before the type is known (six-word stories are 6 words)', () => {
    assert.equal(validateRequest({ ...goodRequest, response_text: 'Wrong contact. Lemon? Never. Chocolate, then.' }, TODAY).ok, true);
  });

  test('length by type: open text needs 8 words, a six-word story exactly six', () => {
    assert.equal(answerLengthProblem('open_text', 'one two three four five six seven'), 'too_short');
    assert.equal(answerLengthProblem('open_text', 'one two three four five six seven eight'), null);
    assert.equal(answerLengthProblem('six_word_story', 'Wrong contact. Lemon? Never. Chocolate, then.'), null);
    assert.equal(answerLengthProblem('six_word_story', 'Wrong contact. Lemon? Never. Chocolate.'), 'not_six_words');
    assert.equal(answerLengthProblem('six_word_story', 'Wrong contact. Lemon? Never. Chocolate, then, please.'), 'not_six_words');
  });

  test('missing or wrong fields are refused as bad_request', () => {
    const broken: unknown[] = [
      null,
      'text',
      [],
      { ...goodRequest, exercise_id: 'INF-F-1' },
      { ...goodRequest, exercise_version: 0 },
      { ...goodRequest, exercise_version: '1' },
      { ...goodRequest, kind: 'extra' },
      { ...goodRequest, kind: undefined },
      { ...goodRequest, local_date: undefined },
      { ...goodRequest, reading_seconds: -1 },
      { ...goodRequest, reading_seconds: 601 },
      { ...goodRequest, reading_seconds: 12.5 },
      { ...goodRequest, response_text: 42 },
    ];
    for (const body of broken) {
      assert.deepEqual(validateRequest(body, TODAY), { ok: false, problem: 'bad_request' }, JSON.stringify(body));
    }
  });

  test('reading seconds of 0 and 600 are allowed', () => {
    assert.equal(validateRequest({ ...goodRequest, reading_seconds: 0 }, TODAY).ok, true);
    assert.equal(validateRequest({ ...goodRequest, reading_seconds: 600 }, TODAY).ok, true);
  });
});

test('daily limit: calls 1-10 are scored, the 11th is not', () => {
  assert.equal(isOverDailyLimit(0), false);
  assert.equal(isOverDailyLimit(9), false); // this is the 10th call
  assert.equal(isOverDailyLimit(10), true); // this is the 11th call
  assert.equal(isOverDailyLimit(25), true);
});

describe('truncateFeedback', () => {
  test('short feedback is kept as is (trimmed)', () => {
    assert.equal(truncateFeedback('  Nice catch on the mill. What else changed?  '), 'Nice catch on the mill. What else changed?');
  });

  test('long feedback is cut at the last full sentence before 600 characters', () => {
    const sentence = 'This sentence is exactly fifty characters long ok. ';
    assert.equal(sentence.length, 51);
    const text = sentence.repeat(12); // 612 characters
    const cut = truncateFeedback(text)!;
    assert.equal(cut, sentence.repeat(11).trim());
    assert.ok(cut.length <= 600);
  });

  test('a sentence ending in a question mark and closing quote counts', () => {
    const text = `${'a'.repeat(550)} "Why?" ${'b'.repeat(100)}`;
    assert.equal(truncateFeedback(text), `${'a'.repeat(550)} "Why?"`);
  });

  test('no full sentence within 600 characters, or empty, gives null', () => {
    assert.equal(truncateFeedback('x'.repeat(700)), null);
    assert.equal(truncateFeedback('   '), null);
  });
});

describe('parseAiOutput', () => {
  const ids = ['c1', 'c2', 'c3'];
  const good = {
    criteria: [
      { id: 'c1', score: 2 },
      { id: 'c2', score: 1 },
      { id: 'c3', score: 0 },
    ],
    flags: { off_topic: false, not_an_answer: false },
    feedback: 'You spotted the closed mill. What does the empty station suggest?',
  };

  test('valid JSON matching the contract is accepted', () => {
    assert.deepEqual(parseAiOutput(JSON.stringify(good), ids), good);
  });

  test('criteria may come in any order', () => {
    const shuffled = { ...good, criteria: [...good.criteria].reverse() };
    assert.deepEqual(parseAiOutput(JSON.stringify(shuffled), ids)?.criteria, shuffled.criteria);
  });

  test('a ```json fence around the reply is removed', () => {
    assert.deepEqual(parseAiOutput('```json\n' + JSON.stringify(good) + '\n```', ids), good);
  });

  test('anything else is null (unscored)', () => {
    const variants: unknown[] = [
      { ...good, criteria: good.criteria.slice(0, 2) },
      { ...good, criteria: [...good.criteria, { id: 'c4', score: 1 }] },
      { ...good, criteria: [{ id: 'c1', score: 2 }, { id: 'c1', score: 1 }, { id: 'c3', score: 0 }] },
      { ...good, criteria: [{ id: 'c1', score: 3 }, good.criteria[1], good.criteria[2]] },
      { ...good, criteria: [{ id: 'c1', score: '2' }, good.criteria[1], good.criteria[2]] },
      { ...good, criteria: [{ id: 'c1', score: 1.5 }, good.criteria[1], good.criteria[2]] },
      { ...good, flags: { off_topic: false } },
      { ...good, flags: { off_topic: 'no', not_an_answer: false } },
      { ...good, feedback: '' },
      { ...good, feedback: 7 },
      { ...good, feedback: 'x'.repeat(700) },
      { criteria: good.criteria, flags: good.flags },
    ];
    for (const v of variants) assert.equal(parseAiOutput(JSON.stringify(v), ids), null, JSON.stringify(v));
    assert.equal(parseAiOutput('not json', ids), null);
    assert.equal(parseAiOutput('Here you go: ' + JSON.stringify(good), ids), null);
    assert.equal(parseAiOutput('[]', ids), null);
    assert.equal(parseAiOutput('', ids), null);
  });
});
