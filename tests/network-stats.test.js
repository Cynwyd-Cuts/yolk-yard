import test from 'node:test';
import assert from 'node:assert/strict';
import {NetworkStats} from '../src/network-stats.js';
test('diagnostics measure input age, queue, corrections and bounded samples',()=>{
 const stats=new NetworkStats();stats.sent(1,0);
 stats.update({now:200,time:1,ack:1,rtt:120,relayRtt:40,received:100,sent:100,queued:1024,batches:2,hostQueue:3,correction:.2});
 stats.update({now:300,time:1.1,ack:1,rtt:120,relayRtt:40,received:1124,sent:202,queued:1024,batches:2,hostQueue:3,correction:0});
 assert.match(stats.text(),/host RTT 120 ms; relay RTT 40 ms; input acknowledgement p95 200 ms/);
 assert.match(stats.text(),/host input queue 3 steps; host clock 1.00/);
 assert.match(stats.text(),/corrections over 0.1 units 1\/2/);
 for(let n=0;n<500;n++)stats.sent(n,n);assert.equal(stats.inputs.size,240);
 for(let n=0;n<500;n++)stats.update({now:n,time:n,correction:0});assert.equal(stats.samples.length,120);assert.equal(stats.corrections.length,120);
 stats.reset();assert.match(stats.text(),/no guest gameplay sample/);
});
