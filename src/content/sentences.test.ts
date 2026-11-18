/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { wholeWordIndex } from './sentences.ts';

test('wholeWordIndex skips the word inside longer words', () => {
  assert.equal(wholeWordIndex('They spend it in the end.', 'end'), 21);
  assert.equal(wholeWordIndex('End of story.', 'end'), 0);
  assert.equal(wholeWordIndex('Spending money.', 'end'), -1);
});
