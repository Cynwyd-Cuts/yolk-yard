import test from 'node:test';
import assert from 'node:assert/strict';
import {ARM_POSES,armPose,makeArms,updateArms,reloadProgress} from '../src/arms.js';
import {makeBlaster} from '../src/weapons.js';
import {WEAPONS} from '../src/data.js';
test('each blaster has a finite animated grip and returns to its idle pose',()=>{
 for(const w of WEAPONS){
  assert.ok(ARM_POSES[w.id]);
  const rig=makeArms(w.id),model=makeBlaster(w.id);
  assert.deepEqual(armPose(w.id,0).left,armPose(w.id,-1).left);
  assert.deepEqual(armPose(w.id,1).left,armPose(w.id,-1).left);
  const start=armPose(w.id,-1);
  assert.notDeepEqual(armPose(w.id,.4).left,start.left);
  for(let frame=0;frame<=100;frame++){
   updateArms(rig,frame/100,model);
   rig.traverse(o=>assert.ok([...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()].every(Number.isFinite)));
  }
  updateArms(rig,-1,model);
  assert.deepEqual(rig.userData.limbs[0].hand.position.toArray(),start.left);
  if(model.userData.reloadPart) assert.deepEqual(model.userData.reloadPart.position.toArray(),model.userData.reloadPart.userData.restPosition.toArray());
  if(model.userData.reloadToken) assert.equal(model.userData.reloadToken.visible,false);
 }
});
test('reload animation follows both empty and partial host reload times and cancels immediately',()=>{
 for(const w of WEAPONS)for(const empty of [true,false]){
  const p={health:100,weapon:w.secondary?'sprinter':w.id,slot:w.secondary?1:0,ammo:[1,1],reloadEnd:20};
  p.ammo[p.slot]=empty?0:1;
  const duration=empty?w.reloadEmpty:w.reload;
  assert.ok(Math.abs(reloadProgress(p,20-duration*.5)-.5)<1e-9);
  p.reloadEnd=0;assert.equal(reloadProgress(p,20),-1);
  p.reloadEnd=22;p.health=0;assert.equal(reloadProgress(p,20),-1);
 }
});
