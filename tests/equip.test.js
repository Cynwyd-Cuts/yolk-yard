import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAW_POSES,beginEquip,equipPose} from '../src/equip.js';
import {WEAPONS} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
test('every blaster holsters before drawing and settles exactly into its grip',()=>{
 const poses=new Set();
 for(const w of WEAPONS){
  const p={weapon:w.id,slot:0,health:100,nextShot:0};
  beginEquip(p,10,true);
  assert.equal(equipPose(p,10).visible,false);
  assert.equal(equipPose(p,10.07).visible,false);
  const mid=equipPose(p,10.14+DRAW_POSES[w.id].duration/2);
  assert.equal(mid.visible,true);assert.equal(mid.active,true);
  assert.ok(mid.position[1]<0);assert.ok(mid.progress>.49&&mid.progress<.51);
  poses.add(JSON.stringify(mid.position));
  assert.equal(p.nextShot,p.equipUntil);
  const done=equipPose(p,p.equipUntil+.001);
  assert.equal(done.active,false);assert.equal(done.progress,1);
  assert.ok([...done.position,...done.rotation].every(v=>Math.abs(v)<1e-9));
  p.health=0;assert.equal(equipPose(p,10.15).active,false);
 }
 assert.equal(poses.size,WEAPONS.length);
});
test('host switching cancels reload, replicates the draw clock, and delays held fire until ready',()=>{
 const sim=new Simulation({bots:0,seed:12});const p=sim.addPlayer('test',{weapon:'sprinter'});
 sim.startRound();sim.spawn(p);sim.time=10;p.reloadEnd=20;
 let seq=0;
 const input=(slot,fire=true)=>{sim.setInput(p.id,{seq:++seq,slot,fire});sim.tick(1/60);};
 input(1);const ammo=p.ammo[1],until=p.equipUntil;
 assert.equal(p.reloadEnd,0);
 const snap=sim.snapshot().players.find(x=>x.id===p.id);
 assert.equal(snap.equipUntil,until);assert.equal(snap.equipStarted,p.equipStarted);
 while(sim.time+1/60<until){input(1);assert.equal(p.ammo[1],ammo);}
 input(1);input(1);assert.equal(p.ammo[1],ammo-1,'held semi-auto fires once as the draw finishes');
 input(0,false);const first=p.equipStarted;input(1,false);
 assert.ok(p.equipStarted>first);assert.equal(p.slot,1);
 assert.equal(equipPose(p,sim.time).progress,0);
 sim.spawn(p);assert.equal(p.equipHolster,0);assert.equal(equipPose(p,sim.time).progress,0);
});
