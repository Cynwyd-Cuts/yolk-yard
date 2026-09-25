import test from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
const wire=value=>JSON.parse(JSON.stringify(value));
test('snapshot deltas retain removals, nested inventory, events and recovery data',()=>{
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
 const first={type:'state',state:{players:[{id:'a',x:1,inventory:[{id:'gun'}]},{id:'b',x:2}],projectiles:[{id:1,x:4}],events:[{id:1}]},checkpoint:{simulation:{players:[{id:'a',x:1}],time:1}}};
 assert.deepEqual(decoder.decode(wire(encoder.encode(first)).frame),first);
 const second={type:'state',state:{players:[{id:'a',x:1.000000000001,inventory:[null]}],projectiles:[],events:[{id:2}]}};
 const received=decoder.decode(wire(encoder.encode(second)).frame);assert.deepEqual(received,second);
 received.state.players[0].x=999;received.state.events.length=0;
 assert.deepEqual(decoder.decode(wire(encoder.encode(second)).frame),second);
 const third={...second,checkpoint:{simulation:{players:[{id:'a',x:8}],time:2}}};
 assert.deepEqual(decoder.decode(wire(encoder.encode(third)).frame),third);
});
test('a missing baseline is rejected and reset recovers cleanly',()=>{
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),msg={type:'state',state:{players:[],projectiles:[]}};
 encoder.encode(msg);assert.equal(decoder.decode(encoder.encode(msg).frame),null);
 encoder.reset();assert.deepEqual(decoder.decode(encoder.encode(msg).frame),msg);
});
for(const Type of [Simulation,RoyaleSimulation])test(Type.name+' moving snapshots preserve exact values with substantially less traffic',()=>{
 const sim=new Type({bots:0,fill:true,capacity:16,seed:9});sim.addPlayer('host',{name:'Host'});sim.addPlayer('guest',{name:'Guest'});sim.startRound();
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();let raw=0,compact=0,lootVersion,buildVersion;
 for(let frame=0;frame<90;frame++){
  sim.tick(1/60);if(frame%3)continue;
  const state=sim.snapshot();
  // Compare against the existing wire behavior, which already omits unchanged
  // Royale world collections. Do not count that existing saving as a new gain.
  if(state.royale){const r=state.royale;if(r.lootVersion===lootVersion){delete r.loot;delete r.chests;}lootVersion=r.lootVersion;if(r.buildVersion===buildVersion){delete r.builds;delete r.worldDamage;}buildVersion=r.buildVersion;}
  const message={type:'state',state};if(frame===0)message.checkpoint={simulation:sim.checkpoint()};
  const encoded=wire(encoder.encode(message));raw+=JSON.stringify(message).length;compact+=JSON.stringify(encoded).length;
  const decoded=decoder.decode(encoded.frame);assert.deepEqual(decoded,wire(message));
 }
 assert.ok(compact<raw*.7,`${compact}/${raw}`);
 console.log(`${Type.name} snapshot/checkpoint bytes: ${raw} -> ${compact} (${Math.round((1-compact/raw)*100)}% reduction)`);
});
