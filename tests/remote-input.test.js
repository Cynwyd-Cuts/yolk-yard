import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {movePlayer,sanitizeInput} from '../src/physics.js';
import {RemoteInputBuffer} from '../src/remote-input.js';

for(const Type of [Simulation,RoyaleSimulation])test(Type.name+' prediction matches acknowledgements under burst delivery',()=>{
 const sim=new Type({map:'yard',bots:0,fill:false,capacity:2,seed:12});
 const p=sim.addPlayer('guest',{name:'Guest'});sim.addPlayer('host',{name:'Host'});sim.startRound();
 if(Type===Simulation)sim.spawn(p);
 sim.map={size:1000,boxes:[]};
 Object.assign(p,{health:100,spectating:false,x:0,y:0,z:0,vy:0,grounded:true,flight:Type===RoyaleSimulation?'ground':undefined,yaw:0,pitch:0});
 const predicted=structuredClone(p),pending=[];let seq=0;
 for(let frame=0;frame<360;frame++){
  const i=sanitizeInput({seq:++seq,forward:1,strafe:frame%80<40?.3:-.3,yaw:frame*.004,slot:p.slot,jump:frame===90});
  pending.push(i);movePlayer(predicted,i,sim.map,1/60);
  // Several client commands arrive together, as they do through the relay.
  if(frame%4===3)for(const command of pending.filter(c=>c.seq>(sim.inputs.get(p.id)?.seq||0)))sim.setInput(p.id,command,true);
  sim.tick(1/60);
  const replay=structuredClone(p);
  for(const command of pending.filter(c=>c.seq>p.ack))movePlayer(replay,command,sim.map,1/60);
  assert.ok(Math.hypot(replay.x-predicted.x,replay.y-predicted.y,replay.z-predicted.z)<1e-6,`prediction corrected at frame ${frame}, ack ${p.ack}`);
 }
});
test('remote catch-up cannot simulate more time than the host grants',()=>{
 const buffer=new RemoteInputBuffer();for(let seq=1;seq<=120;seq++)assert.equal(buffer.push({seq}),true);
 assert.equal(buffer.push({seq:121}),false);
 assert.equal(buffer.take(1/60).length,1);
 assert.equal(buffer.take(1/60).length,1);
 assert.equal(buffer.take(10).length,6);
});
