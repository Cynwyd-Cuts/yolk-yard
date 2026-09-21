import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReleaseHistory } from '../src/release-history.js';
import { RELEASE_NOTES } from '../src/releases.js';
test('releases form a consecutive history and retries retain their number', () => {
  const initial = nextReleaseHistory('first', RELEASE_NOTES);
  assert.deepEqual(initial.releases.map(r => Number(r.number)), [9,8,7,6,5,4,3,2,1]);
  assert.deepEqual(nextReleaseHistory('first', RELEASE_NOTES, initial), initial);
  const next = nextReleaseHistory('second', RELEASE_NOTES, initial);
  assert.equal(next.releases[0].number, '10');
  assert.equal(next.releases[1].number, '09');
  // A failed build does not change the published history or consume a number.
  assert.equal(nextReleaseHistory('third', RELEASE_NOTES, initial).releases[0].number, '10');
  assert.throws(() => nextReleaseHistory('next', RELEASE_NOTES, {schema:1,releases:[{number:'34'}]}));
});
