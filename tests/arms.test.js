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
test('smooth arm surfaces remain finite through reloads and reuse their buffers',()=>{
 for(const w of WEAPONS){
  const rig=makeArms(w.id),other=makeArms(w.id);
  assert.equal(rig.userData.limbs[0].hand.geometry,other.userData.limbs[0].hand.geometry);
  assert.notEqual(rig.userData.limbs[0].arm.geometry,other.userData.limbs[0].arm.geometry);
  for(const limb of rig.userData.limbs){
   const {position,normal}=limb.arm.geometry.attributes;
   const buffer=position.array,version=position.version;
   updateArms(rig,-1);
   assert.equal(position.version,version,'idle geometry is not uploaded again');
   for(let f=0;f<=20;f++){
    updateArms(rig,f/20);
    assert.equal(position.array,buffer,'reload reuses the arm buffer');
    assert.ok(position.array.every(Number.isFinite));
    for(let i=0;i<normal.count;i++)assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5);
   }
   updateArms(rig,-1);
  }
 }
});

test('arm materials match shell colors and every finish, with reset-safe appearance keys',async()=>{
 const {armAppearance}=await import('../src/arms.js');
 const {patternedShell}=await import('../src/cosmetics.js');
 for(let finish=0;finish<4;finish++){
  const profile={color:'#3d8ce8',accent:'#fff6da',pattern:0,finish};
  const rig=makeArms('sprinter',profile),shell=patternedShell(profile);
  for(const limb of rig.userData.limbs){
   assert.equal(limb.hand.material.color.getHex(),shell.color.getHex());
   assert.equal(limb.hand.material.roughness,shell.roughness);
   assert.equal(limb.arm.material.metalness,shell.metalness);
  }
  assert.deepEqual(rig.userData.appearance,profile);
 }
 assert.equal(armAppearance('#3d8ce8').color,'#3d8ce8');
 for(const [key,value] of Object.entries({color:'#3d8ce8',accent:'#00ff00',pattern:2,finish:3}))
  assert.notDeepEqual(armAppearance({[key]:value}),armAppearance({}));
 const plain=makeArms('sprinter',{});assert.equal(plain.userData.limbs[0].hand.material.map,null);
});
