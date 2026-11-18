/// <reference types="node" />
// SPEC section 5, "Put it in order": shuffled by exercise id, never already correct.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { shuffledOrder } from './order.ts';

const items = (n: number) => Array.from({ length: n }, (_, i) => `item-${i + 1}`);

describe('order shuffle', () => {
  test('the same exercise id always gives the same order', () => {
    assert.deepEqual(shuffledOrder('rsn-f-901', items(5)), shuffledOrder('rsn-f-901', items(5)));
  });

  test('is a reordering of the same items', () => {
    for (const n of [3, 4, 5]) {
      assert.deepEqual([...shuffledOrder('comp-f-900', items(n))].sort(), items(n));
    }
  });

  test('is never already in the correct order (3, 4 and 5 items, many ids)', () => {
    for (const n of [3, 4, 5]) {
      for (let i = 0; i < 2000; i++) {
        assert.notDeepEqual(shuffledOrder(`test-x-${i}`, items(n)), items(n), `id test-x-${i}, ${n} items`);
      }
    }
  });

  test('different ids give different orders', () => {
    const orders = new Set(Array.from({ length: 50 }, (_, i) => shuffledOrder(`id-${i}`, items(5)).join()));
    assert.ok(orders.size > 10, `only ${orders.size} different orders`);
  });

  test("doesn't change the stored list", () => {
    const stored = items(4);
    shuffledOrder('rsn-f-901', stored);
    assert.deepEqual(stored, items(4));
  });
});
