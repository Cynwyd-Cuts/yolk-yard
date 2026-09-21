import test from 'node:test';
import assert from 'node:assert/strict';
import { UpdateWatcher } from '../src/updates.js';
test('new builds refresh lobby clients once, but wait for active matches to end', async () => {
  let playing = true;
  const calls = [];
  const watcher = new UpdateWatcher({build:'old', isInMatch:()=>playing,
    fetchVersion:async()=>({build:'new'}), refresh:id=>calls.push(id)});
  await watcher.check();
  assert.deepEqual(calls, []);
  playing=false;
  watcher.apply(); watcher.apply(); await watcher.check();
  assert.deepEqual(calls, ['new']);
});
test('same build, failed checks and malformed responses never refresh', async () => {
  let response={build:'same'};
  let refreshes=0;
  const watcher=new UpdateWatcher({build:'same',isInMatch:()=>false,
    fetchVersion:async()=>{if(response===null)throw Error('offline'); return response;},
    refresh:()=>refreshes++});
  for(const v of [{build:'same'},{},null]) {response=v; await watcher.check();}
  assert.equal(refreshes,0);
  response={build:'next'}; await watcher.check();
  assert.equal(refreshes,1);
});
