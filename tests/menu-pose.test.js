import {test} from 'node:test';import assert from 'node:assert/strict';
import {MenuPose,touchPair,touchRotation,MENU_FRONT,IDLE_CLIPS,idleClip} from '../src/menu-pose.js';
test('idle waits one second, returns to camera center and transitions continuously',()=>{
 const p=new MenuPose(()=>.3);let last=p.update(1/60);
 for(let i=0;i<2600;i++){const next=p.update(1/60);assert.ok(Math.abs(next.pitch-last.pitch)<.2);assert.equal(next.yaw,MENU_FRONT);last=next;}
 p.aim(2,.6);const next=p.update(1/60);assert.ok(Math.abs(next.pitch-last.pitch)<.2);assert.equal(next.idle,false);
 for(let i=0;i<30;i++){p.aim(2,.6);p.update(1/60);}assert.ok(p.pitch>.5);
 const paused=p.clipTime;
 for(let i=0;i<19;i++)assert.equal(p.update(.05).idle,false);
 assert.equal(p.clipTime,paused);
 assert.equal(p.update(.05).idle,true);
 for(let i=0;i<200;i++)p.update(1/60);assert.ok(p.idle>.9);assert.equal(p.yaw,MENU_FRONT);
});
test('cursor movement and rotation restart the full idle delay',()=>{
 const p=new MenuPose();
 for(const input of [()=>p.aim(2,.3),()=>p.rotate(.2)]){
  input();assert.equal(p.update(.05).idle,false);
  for(let i=0;i<15;i++)assert.equal(p.update(.05).idle,false);
  input();assert.equal(p.update(.05).idle,false);
  for(let i=0;i<19;i++)assert.equal(p.update(.05).idle,false);
  assert.equal(p.update(.05).idle,true);
 }
});
test('shuffle bags use every idle clip once and never repeat at bag boundaries',()=>{
 for(const rng of [()=>0,()=>.3,()=>.9999]){const p=new MenuPose(rng),seen=[];for(let i=0;i<32;i++){seen.push(p.clip);p.nextClip();}for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);for(let i=0;i<32;i+=8)assert.equal(new Set(seen.slice(i,i+8)).size,IDLE_CLIPS.length);}
});
test('reload and cartoon toss have bounded complete timelines and safe interruptions',()=>{
 assert.ok(idleClip('reload',.5).reload>.4);assert.equal(idleClip('reload',1).reload,-1);
 assert.ok(idleClip('toss-catch',.45).flight>1);assert.equal(idleClip('toss-catch',1).release,0);assert.ok(Math.abs(idleClip('toss-catch',1).flight)<1e-9);
 for(const name of IDLE_CLIPS)for(const phase of [.1,.3,.5,.7,.9]){const p=new MenuPose();p.clip=name;p.clipTime=phase*5;p.update(1/60);p.aim(MENU_FRONT,.2);const a=p.update(1/60);assert.equal(a.reload,-1);assert.equal(a.flight,0);for(const value of Object.values(a))if(typeof value==='number')assert.ok(Number.isFinite(value));}
});
test('two-finger pan and twist rotate; a single finger never starts a spin',()=>{
 assert.equal(touchPair([{clientX:1,clientY:2}]),null);
 const a=touchPair([{clientX:0,clientY:0},{clientX:100,clientY:0}]);const b=touchPair([{clientX:100,clientY:0},{clientX:200,clientY:0}]);assert.ok(touchRotation(a,b,400)>1);
 const p=new MenuPose();p.rotate(12);const before=p.yaw;p.update(1/60);assert.ok(Math.abs(p.yaw-before)<.4);p.aim(3,0);assert.equal(p.spin,0);
});
