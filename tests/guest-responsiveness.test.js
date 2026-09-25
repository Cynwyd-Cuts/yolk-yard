import test from 'node:test';
import assert from 'node:assert/strict';
import {GuestFire} from '../src/guest-fire.js';
import {RemotePoses} from '../src/remote-poses.js';
import {GuestPresentation} from '../src/guest-presentation.js';
import {predictMovement} from '../src/guest-movement.js';
const player=()=>({id:'guest',health:100,flight:'ground',x:0,y:0,z:0,yaw:0,pitch:0,slot:0,ack:0,inventory:[{id:'sprinter',weapon:true}],ammo:[30]});
const input=(seq=1)=>({seq,fire:true,slot:0,yaw:0,pitch:0});
const state=(time,players)=>({time,players,phase:'playing',round:1,royale:{matchId:'a',elapsed:time,route:{duration:10,fromX:0,toX:100,fromZ:0,toZ:0,y:100}}});
test('guest firing feedback is immediate, rate limited, cosmetic and confirmed once',()=>{
 const fire=new GuestFire(),p=player(),original=structuredClone(p);
 const shot=fire.step(p,input(),1,1,1);
 assert.equal(shot.type,'shot');assert.equal(shot.predicted,true);assert.deepEqual(p,original);
 assert.equal(fire.step(p,input(2),1.02,1.02,1),null);
 assert.equal(fire.confirm({type:'hit',weapon:'sprinter'},1.03),false);
 assert.equal(fire.confirm(shot,1.05),true);assert.equal(fire.confirm(shot,1.06),false);
 assert.ok(fire.step(p,input(3),1.11,1.11,1));
});
test('guest never predicts firing while ineligible or without ammunition',()=>{
 for(const change of [{health:0},{flight:'dive'},{reloadEnd:2},{use:true},{ammo:[0]},{inventory:[null]}]){
  assert.equal(new GuestFire().step({...player(),...change},input(),1,1,1),null);
 }
 for(const change of [{reload:true},{buildMode:true},{slot:1},{fire:false}])assert.equal(new GuestFire().step(player(),{...input(),...change},1,1,1),null);
});
test('remote motion interpolates without delaying own prediction or mutating snapshots',()=>{
 const poses=new RemotePoses(),a=state(0,[{...player(),id:'bot'}]),b=state(.1,[{...player(),id:'bot',x:1},player()]);
 poses.receive(a);poses.receive(b);
 const local={...player(),x:4},visual=poses.players(b,local,.15);
 assert.ok(Math.abs(visual[0].x-.5)<1e-9);assert.equal(visual[1],local);assert.equal(b.players[0].x,1);
 for(let i=2;i<30;i++)poses.receive(state(i/10,b.players));assert.equal(poses.samples.length,8);
 poses.receive({...b,round:2,time:3});assert.equal(poses.samples.length,1);
});
test('remote teleports are not interpolated',()=>{
 const poses=new RemotePoses(),a=state(0,[player()]),b=state(.1,[{...player(),x:40}]);
 poses.receive(a);poses.receive(b);assert.equal(poses.players(b,null,.15)[0].x,40);
});
test('local flight model and camera share predicted pose and preserve packet timestamp',()=>{
 const presentation=new GuestPresentation(),p={...player(),flight:'dive'},s=state(4,[p]);
 presentation.receive(s,null,p,1000);
 const visual=presentation.frame(s,{...p,x:10},1050,1/60);
 assert.equal(visual.state.players[0],visual.player);assert.equal(visual.player.x,10);
 assert.equal(visual.state.snapshotTime,4);assert.equal(visual.state.time,4.05);assert.equal(s.players[0].x,0);
});
test('transport exit begins locally only when permitted',()=>{
 const p={...player(),flight:'transport'},i={jump:true,yaw:1};
 predictMovement(p,i,null,1/60,{elapsed:2,route:{duration:10}});assert.equal(p.flight,'transport');
 predictMovement(p,i,null,1/60,{elapsed:3,route:{duration:10}});assert.equal(p.flight,'dive');assert.equal(p.flightLatch,true);assert.equal(p.yaw,1);
});
