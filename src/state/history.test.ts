/// <reference types="node" />
// Batch 9: saved rows back into the engine's shapes (reinstalling restores progress).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { computeSkillStates } from '../engine/index.ts';

import { attemptFromRow, freeWriteFromRow, skillStateRows, type AttemptRow } from './history.ts';

const facts = { skill: 'inference', band: 'foundation', word_count: 172 } as const;
const row = (overrides: Partial<AttemptRow>): AttemptRow => ({
  exercise_id: 'inf-f-001',
  kind: 'daily',
  local_date: '2026-10-01',
  response_type: 'open_text',
  result: 'pass',
  total: 5,
  reading_seconds: 95,
  created_at: '2026-10-01T15:04:05.000Z',
  ...overrides,
});

describe('Saved attempts back into engine attempts', () => {
  test('open text: the total out of 6 becomes the score; skill, band and word count come from the exercise', () => {
    assert.deepEqual(attemptFromRow(row({}), facts), {
      exerciseId: 'inf-f-001',
      skill: 'inference',
      band: 'foundation',
      kind: 'daily',
      responseType: 'open_text',
      result: 'pass',
      score: 5 / 6,
      localDate: '2026-10-01',
      createdAt: Date.parse('2026-10-01T15:04:05.000Z'),
      wordCount: 172,
      readingSeconds: 95,
    });
  });

  test('multiple choice, tap the sentence and order: 1 or 0', () => {
    assert.equal(attemptFromRow(row({ response_type: 'multiple_choice', total: 1 }), facts)?.score, 1);
    assert.equal(attemptFromRow(row({ response_type: 'tap_sentence', result: 'fail', total: 0 }), facts)?.score, 0);
    assert.equal(attemptFromRow(row({ response_type: 'order', total: 1 }), facts)?.score, 1);
  });

  test('unscored has no score; an unknown exercise is left out', () => {
    assert.equal(attemptFromRow(row({ result: 'unscored', total: null }), facts)?.score, null);
    assert.equal(attemptFromRow(row({}), undefined), null);
  });

  test('free-writes come back with their date', () => {
    assert.deepEqual(
      freeWriteFromRow({ prompt_id: 'prompt-001', text: 'Hi.', local_date: '2026-10-01', created_at: '2026-10-01T08:00:00Z' }),
      { promptId: 'prompt-001', text: 'Hi.', localDate: '2026-10-01', createdAt: Date.parse('2026-10-01T08:00:00Z') },
    );
  });

  test('skill_state rows: one per skill, in the database column names', () => {
    const rows = skillStateRows(computeSkillStates([]));
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0], {
      skill: 'comprehension',
      band: 'foundation',
      consecutive_fails: 0,
      review_remaining: 0,
      fast_track_used: false,
    });
  });
});
