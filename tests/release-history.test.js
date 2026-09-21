import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReleaseHistory } from '../src/release-history.js';
import { RELEASE_NOTES } from '../src/releases.js';
test('releases form a consecutive history and retries retain their number', () => {
  const initial = nextReleaseHistory('first', RELEASE_NOTES);
  assert.deepEqual(initial.releases.map(r => Number(r.number)), RELEASE_NOTES.map((_, i) => RELEASE_NOTES.length - i));
  assert.deepEqual(nextReleaseHistory('first', RELEASE_NOTES, initial), initial);
  const next = nextReleaseHistory('second', RELEASE_NOTES, initial);
  assert.equal(next.releases[0].number, String(RELEASE_NOTES.length + 1).padStart(2, '0'));
  assert.equal(next.releases[1].number, RELEASE_NOTES[0].number);
  // A failed build does not change the published history or consume a number.
  assert.equal(nextReleaseHistory('third', RELEASE_NOTES, initial).releases[0].number, String(RELEASE_NOTES.length + 1).padStart(2, '0'));
  assert.throws(() => nextReleaseHistory('next', RELEASE_NOTES, {schema:1,releases:[{number:'34'}]}));
});
