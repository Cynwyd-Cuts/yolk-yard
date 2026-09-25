import test from 'node:test';
import assert from 'node:assert/strict';
import {GuestPresentation} from '../src/guest-presentation.js';
import {FrameStats} from '../src/frame-stats.js';
const state=time=>({time,round:1,phase:'playing',royale:{matchId:'test',elapsed:time,route:{fromX:0,toX:100,fromZ:0,toZ:0,y:100,duration:10}}});
const player={id:'guest',health:100,x:0,y:100,z:0,flight:'transport'};
test('10 Hz transport snapshots produce continuous 60 Hz camera positions',()=>{
 const view=new GuestPresentation();let s=state(0),previous=-Infinity;
 for(let frame=0;frame<60;frame++){
  const now=frame*1000/60;
  if(frame%6===0){s=state(frame/60);view.receive(s,player,player,now);}
  const visual=view.frame(s,player,now,1/60);
  assert.ok(visual.player.x>previous);assert.ok(Math.abs(visual.player.x-frame/6)<1e-6);
  assert.equal(s.time,Math.floor(frame/6)/10);assert.equal(player.x,0);
  previous=visual.player.x;
 }
});
test('small corrections decay, while teleports and flight transitions reset immediately',()=>{
 const view=new GuestPresentation(),s=state(1),p={...player,flight:'ground',x:2,y:0};
 view.receive(s,null,p,0);view.receive(s,p,{...p,x:1.7},100);
 let visual=view.frame(s,{...p,x:1.7},100,1/60);
 assert.ok(visual.player.x>1.7&&visual.player.x<2);
 for(let i=0;i<60;i++)visual=view.frame(s,{...p,x:1.7},100+i*1000/60,1/60);
 assert.ok(Math.abs(visual.player.x-1.7)<1e-6);
 view.receive(s,p,{...p,x:20},1200);assert.equal(view.frame(s,{...p,x:20},1200,1/60).player.x,20);
 view.receive(s,p,{...p,flight:'glide'},1300);assert.equal(view.frame(s,{...p,flight:'glide'},1300,1/60).player.x,2);
 assert.equal(view.frame(s,p,100000,1/60).state.time,1.15);
});
test('performance report retains bounded recent samples',()=>{
 const stats=new FrameStats();for(let i=0;i<1000;i++){stats.frame(20,'guest','royale');stats.update(2,4);}
 assert.equal(stats.frames.length,300);assert.equal(stats.updates.length,60);
 assert.match(stats.text(),/guest, royale; 50 FPS/);assert.match(stats.text(),/pending inputs 4/);
});
