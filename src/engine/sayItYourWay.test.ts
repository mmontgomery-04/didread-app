/// <reference types="node" />
// SPEC section 8, "Say it your way" (batch 3c), and P6 free-write practice days.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { currentStreak, daysPracticedThisMonth, practicedDates } from './practice.ts';
import { nextPrompt, type FreeWrite, type Prompt } from './sayItYourWay.ts';
import { attempt } from './testHelpers.ts';

const prompts: Prompt[] = [
  { id: 'prompt-002', text: 'Two' },
  { id: 'prompt-001', text: 'One' },
  { id: 'prompt-003', text: 'Three' },
];
const write = (promptId: string, localDate: string): FreeWrite => ({ promptId, text: 'x', localDate, createdAt: 0 });

describe('Say it your way: which prompt the card shows', () => {
  test('in id order, never repeated until all have been used, then around again', () => {
    assert.equal(nextPrompt(prompts, [])?.id, 'prompt-001');
    assert.equal(nextPrompt(prompts, [write('prompt-001', '2026-10-01')])?.id, 'prompt-002');
    const allOnce = ['prompt-001', 'prompt-002', 'prompt-003'].map((id) => write(id, '2026-10-01'));
    assert.equal(nextPrompt(prompts, allOnce)?.id, 'prompt-001');
    assert.equal(nextPrompt(prompts, [...allOnce, write('prompt-001', '2026-10-02')])?.id, 'prompt-002');
  });

  test('after saving, the card moves on to the next prompt the same day', () => {
    assert.equal(nextPrompt(prompts, [write('prompt-001', '2026-10-01'), write('prompt-002', '2026-10-01')])?.id, 'prompt-003');
  });

  test('a prompt that is never saved stays on the card', () => {
    assert.equal(nextPrompt(prompts, [])?.id, 'prompt-001');
  });

  test('no prompts to serve means no card', () => {
    assert.equal(nextPrompt([], []), null);
  });
});

describe('P6 with free-writes', () => {
  test('saving a free-write counts as a practice day', () => {
    const attempts = [attempt({ skill: 'inference', localDate: '2026-10-01' })];
    assert.deepEqual([...practicedDates(attempts, ['2026-10-02'])].sort(), ['2026-10-01', '2026-10-02']);
    assert.equal(currentStreak(attempts, '2026-10-02', ['2026-10-02']), 2);
    assert.equal(daysPracticedThisMonth(attempts, '2026-10-02', ['2026-10-02']), 2);
  });
});
