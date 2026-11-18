/// <reference types="node" />
// Analytics: the 5 minimum events (SPEC decision log, 2026-10-02).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { appStateStep, eventRow } from './analytics.ts';

describe('Analytics events', () => {
  test('an exercise event carries its exercise and kind', () => {
    assert.deepEqual(eventRow('exercise_started', Date.UTC(2026, 9, 2, 14, 30), '2026-10-02', { exerciseId: 'inf-f-001', kind: 'bonus' }), {
      name: 'exercise_started',
      local_date: '2026-10-02',
      exercise_id: 'inf-f-001',
      kind: 'bonus',
      occurred_at: '2026-10-02T14:30:00.000Z',
    });
  });

  test('app_open and day_practiced carry no exercise', () => {
    const row = eventRow('app_open', 0, '2026-10-02');
    assert.equal(row.exercise_id, null);
    assert.equal(row.kind, null);
  });

  test('coming back from the background counts as opening the app, even through "inactive"', () => {
    assert.deepEqual(appStateStep(true, 'active'), { wasInBackground: false, opened: true });
    let step = appStateStep(false, 'inactive');
    step = appStateStep(step.wasInBackground, 'background');
    step = appStateStep(step.wasInBackground, 'inactive');
    assert.equal(step.opened, false);
    assert.deepEqual(appStateStep(step.wasInBackground, 'active'), { wasInBackground: false, opened: true });
  });

  test('a brief interruption that never left the screen does not', () => {
    let step = appStateStep(false, 'inactive');
    assert.equal(step.opened, false);
    step = appStateStep(step.wasInBackground, 'active');
    assert.equal(step.opened, false);
  });
});
