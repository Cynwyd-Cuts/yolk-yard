import {test} from 'node:test';import assert from 'node:assert/strict';
import {MenuPose,touchPair,touchRotation} from '../src/menu-pose.js';
test('idle holds switch every ten seconds and all transitions remain continuous',()=>{
 const p=new MenuPose();let last=p.update(1/60),switches=[];
 for(let i=0;i<1300;i++){const next=p.update(1/60);assert.ok(Math.abs(next.pitch-last.pitch)<.15);if(next.pose!==last.pose)switches.push(p.time);last=next;}
 assert.equal(switches.length,2);assert.ok(Math.abs(switches[1]-switches[0]-10)<.04);
 p.aim(2,.6);const next=p.update(1/60);assert.ok(Math.abs(next.pitch-last.pitch)<.2);assert.equal(next.idle,false);
 for(let i=0;i<30;i++){p.aim(2,.6);p.update(1/60);}assert.ok(p.pitch>.5);
 for(let i=0;i<200;i++)p.update(1/60);assert.ok(p.idle>.9);
});
test('two-finger pan and twist rotate; a single finger never starts a spin',()=>{
 assert.equal(touchPair([{clientX:1,clientY:2}]),null);
 const a=touchPair([{clientX:0,clientY:0},{clientX:100,clientY:0}]);const b=touchPair([{clientX:100,clientY:0},{clientX:200,clientY:0}]);assert.ok(touchRotation(a,b,400)>1);
 const p=new MenuPose();p.rotate(12);const before=p.yaw;p.update(1/60);assert.ok(Math.abs(p.yaw-before)<.4);p.aim(3,0);assert.equal(p.spin,0);
});
