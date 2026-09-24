import {test} from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer} from '../src/physics.js';
import {pieceBoxes} from '../src/building.js';
import {stairCamera} from '../src/stair-camera.js';
const player=()=>({id:'a',x:0,y:0,z:-3,health:100,grounded:true,vy:0,yaw:Math.PI,pitch:0,weapon:'sprinter'});
for(const dt of [1/20,1/60,1/144])for(const narrow of [true,false])test(`stairs stay grounded up and down, narrow=${narrow}, dt=${dt}`,()=>{
 const map={size:50,boxes:narrow?pieceBoxes({id:'a',x:0,y:0,z:0,type:'stairs',rotation:0,mask:0,material:'wood'}):Array.from({length:8},(_,i)=>({x:0,z:-1.8+i*.8,w:4,d:.82,y:0,h:(i+1)*.4}))};
 const p=player(),end=narrow?1.5:3.5;let previous=0;
 for(let i=0;p.z<end&&i<3000;i++){movePlayer(p,{forward:1},map,dt);assert.ok(p.grounded,`lost ground at ${p.z}, ${p.y}`);assert.ok(p.y>=previous-1e-7);previous=p.y;}
 assert.ok(p.y>=3.1);
 for(let i=0;p.z>-3&&i<3000;i++){previous=p.y;movePlayer(p,{forward:-1},map,dt);assert.ok(p.grounded);assert.ok(p.y<=previous+1e-7);}
 assert.equal(p.y,0);
});
test('steps cannot climb tall walls or low ceilings and jumps still leave the ground',()=>{
 for(const boxes of [[{x:0,y:0,z:0,w:4,d:1,h:1}],[{x:0,y:0,z:0,w:4,d:1,h:.4},{x:0,y:1.9,z:0,w:4,d:1,h:1}]]){
 const p=player();for(let i=0;i<40;i++)movePlayer(p,{forward:1},{size:50,boxes},1/60);assert.ok(p.z<-.9);assert.equal(p.y,0);
 }
 const p=player();movePlayer(p,{jump:true},{size:50,boxes:[]},1/60);assert.equal(p.grounded,false);assert.ok(p.y>0);
});
test('camera eases stair height but snaps for jumping, teleporting and changing targets',()=>{
 const p=player();let eye=stairCamera(null,p,1/60,'a');p.y=.4;eye=stairCamera(eye,p,1/60,'a');assert.ok(eye.y>0&&eye.y<.2);
 p.grounded=false;p.y=.8;assert.equal(stairCamera(eye,p,1/60,'a').y,.8);
 p.grounded=true;p.y=10;assert.equal(stairCamera(eye,p,1/60,'a').y,10);assert.equal(stairCamera(eye,p,1/60,'b').y,10);
});
