import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SHOP_ITEMS} from '../src/shop-catalog.js';
import {pickaxeStyle,pickaxePose,animatePickaxe} from '../src/pickaxe-animation.js';
import {makeShopPickaxe} from '../src/shop-models.js';
import {makeArms} from '../src/arms.js';

test('every tool has a shape family, forward strike and seamless recovery',()=>{
 const items=SHOP_ITEMS.filter(i=>i.slot==='pickaxe');
 assert.equal(new Set(items.map(i=>pickaxeStyle(i.id))).size,6);
 for(const id of ['',...items.map(i=>i.id)]){
  const idle=pickaxePose(id,-1),hit=pickaxePose(id,.216);
  assert.ok(hit.offset[2]<-.2);
  assert.deepEqual(pickaxePose(id,.45),idle);
  const last=pickaxePose(id,.44999);
  last.rotation.forEach((v,i)=>assert.ok(Math.abs(v-idle.rotation[i])<.001));
 }
 assert.equal(new Set(items.slice(0,6).map(i=>JSON.stringify(pickaxePose(i.id,.1)))).size,6);
});
test('both hands stay on the moving shaft throughout every swing family',()=>{
 const arms=makeArms('pip',{},true);
 for(const item of SHOP_ITEMS.filter(i=>i.slot==='pickaxe')){
  const tool=makeShopPickaxe(item.id);
  for(const age of [0,.08,.216,.28,.4,.45]){
   animatePickaxe(tool,arms,item.id,age);
   for(const limb of arms.userData.limbs){
    const expected=new THREE.Vector3(0,limb.side<0?-.05:-.38,0).applyMatrix4(tool.matrix);
    assert.ok(limb.hand.position.distanceTo(expected)<1e-8);
    assert.ok(limb.hand.quaternion.toArray().every(Number.isFinite));
   }
  }
 }
});
