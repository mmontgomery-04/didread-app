/// <reference types="node" />
// Local-date helpers.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addDays, dayNumber } from './dates.ts';

describe('dayNumber', () => {
  test('counts whole days and goes up by one each day', () => {
    assert.equal(dayNumber('1970-01-01'), 0);
    assert.equal(dayNumber('2026-10-01') + 1, dayNumber('2026-10-02'));
    assert.equal(dayNumber(addDays('2026-12-31', 1)), dayNumber('2026-12-31') + 1);
  });
});
