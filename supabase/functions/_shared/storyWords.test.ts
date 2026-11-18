import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { countStoryWords as appCount } from '../../../src/engine/scoring.ts';
import { countStoryWords, longestSharedRun, ownWordsScore } from './storyWords.ts';

const CASES: [string, number][] = [
  ['Her birds. His robin. Fine forgiven.', 6],
  ["Don't stop: pea-sized lumps, 1961 forever.", 6],
  ['Famous crust.\nFrozen. Grandpa never knew.', 6],
  ['  spaces   everywhere  ', 2],
  ['Wait — what … 🙂 now', 3],
  ['', 0],
  ['— … 🙂', 0],
  ['Mr. Lyle, 4A, twenty-one tomatoes.', 5],
];

describe('six-word story counting', () => {
  test('counts words by the SPEC rule', () => {
    for (const [text, words] of CASES) assert.equal(countStoryWords(text), words, text);
  });

  test("the app's counter and the backend's counter always agree", () => {
    for (const [text] of CASES) assert.equal(appCount(text), countStoryWords(text), text);
  });
});

describe('own words (c3)', () => {
  const passage = 'Dev added Jess to the group. Jess left the group. Grandma Ruth\'s famous pie crust, copied out.';

  test('finds the longest run of words in a row, ignoring case and punctuation', () => {
    assert.equal(longestSharedRun('Jess added to the group. Oops.', passage), 3);
    assert.equal(longestSharedRun('JESS LEFT THE GROUP!', passage), 4);
    assert.equal(longestSharedRun('Nothing here matches at all', passage), 0);
  });

  test('scores 4+ copied as 0, exactly 3 as 1, 2 or fewer as 2', () => {
    assert.equal(ownWordsScore('Jess left the group. Sad.', passage), 0);
    assert.equal(ownWordsScore("Grandma's famous pie crust: a secret.", passage), 1);
    assert.equal(ownWordsScore('Famous crust. Frozen. Grandpa never knew.', passage), 2);
  });
});
