import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SLIDERS,SLIDER_DEFAULTS,resetSliders,royalePanelAction} from '../src/settings.js';
import {normalizeBindings} from '../src/keybinds.js';
import {Sound,SOUND_CUES} from '../src/audio.js';
import {movePlayer,wallDistance,worldHit,ROYALE_MOVEMENT} from '../src/physics.js';
import {groundAt,terrainHit} from '../src/terrain.js';
import {ROYALE_MAP as map} from '../src/royale-map.js';
import {WEAPONS,weapon} from '../src/data.js';
import {ITEMS,ROYALE_GUN_IDS} from '../src/royale-data.js';
import {lootModel,chestModel,gliderModel,launchpadModel,treeModel,dressBuilding} from '../src/royale-art.js';
import {bake} from '../src/royale-view.js';
test('each slider resets independently and reset-all preserves unrelated preferences',()=>{
 const settings={...SLIDER_DEFAULTS,musicVolume:.9,sensitivity:2.5,chatMode:'off',keybinds:{map:['KeyP']}};
 resetSliders(settings,'musicVolume');assert.equal(settings.musicVolume,.3);assert.equal(settings.sensitivity,2.5);
 resetSliders(settings,'__proto__');assert.equal(settings.sensitivity,2.5);resetSliders(settings);
 for(const [id,,, , ,value] of SLIDERS)assert.equal(settings[id],value);
 assert.equal(settings.chatMode,'off');assert.deepEqual(settings.keybinds,{map:['KeyP']});
});
test('map and inventory keys toggle, switch and respect customized bindings and unrelated dialogs',()=>{
 const bindings=normalizeBindings();assert.equal(royalePanelAction('KeyI',bindings),'royale-inventory');
 assert.equal(royalePanelAction('KeyI',bindings,'royale-inventory'),'close');assert.equal(royalePanelAction('KeyM',bindings,'royale-map'),'close');
 assert.equal(royalePanelAction('KeyM',bindings,'royale-inventory'),'royale-map');assert.equal(royalePanelAction('KeyI',bindings,'settings'),null);
 bindings.map=['KeyP',null];assert.equal(royalePanelAction('KeyM',bindings),null);assert.equal(royalePanelAction('KeyP',bindings,'royale-map'),'close');
});
test('walking and sprinting never emit footsteps, hover is silent and activation cue remains',()=>{
 assert.ok(SOUND_CUES['ui-select']);assert.equal(SOUND_CUES['ui-hover'],undefined);assert.ok(Object.keys(SOUND_CUES).every(k=>!k.startsWith('step-')));
 const s=new Sound(),cues=[];s.cue=id=>cues.push(id);s.loop=()=>{};
 const me={id:'a',x:0,y:0,z:0,yaw:0,health:100,grounded:true,moving:true};
 for(let i=0;i<120;i++){me.sprinting=i>60;s.update({players:[me]},me,1/60,true);}assert.deepEqual(cues,[]);
});
test('Royale sprint equals arena movement and walk is slower without diagonal advantage',()=>{
 const flat={size:100,boxes:[]};
 function travel(royale,sprint,diagonal=false){const p={x:0,y:0,z:0,yaw:0,pitch:0,health:100,weapon:'sprinter',crown:null,grounded:true,vy:0,...(royale?{inventory:[],stamina:100}:{})};for(let i=0;i<60;i++)movePlayer(p,{forward:1,strafe:diagonal?1:0,sprint},flat,1/60);return Math.hypot(p.x,p.z);}
 assert.ok(Math.abs(travel(true,true)-travel(false,false))<1e-8);assert.ok(Math.abs(travel(true,false)-ROYALE_MOVEMENT.walk)<1e-8);assert.ok(Math.abs(travel(true,true,true)-ROYALE_MOVEMENT.sprint)<1e-8);
 assert.ok(travel(true,false)<travel(true,true));for(const w of WEAPONS)assert.equal(w.speed,ROYALE_MOVEMENT.sprint);
});
test('dense world has distinct biomes, open loot anchors and real terrain relief',()=>{
 assert.equal(map.buildings.length,92);assert.equal(map.trees.length,560);assert.ok(map.props.length>150);assert.ok(map.chests.length>120);assert.ok(map.floorLoot.length>300);
 assert.equal(new Set(map.trees.map(t=>t.kind)).size,5);assert.equal(new Set(map.buildings.map(b=>b.kind)).size,8);assert.ok(map.terrain.max>=7);
 for(const p of [...map.chests,...map.floorLoot]){
  assert.ok(p.y>=groundAt(map,p.x,p.z)-.01);
  assert.ok(!map.boxes.some(b=>Math.abs(p.x-b.x)<b.w/2+.3&&Math.abs(p.z-b.z)<b.d/2+.3&&p.y+.2>b.y&&p.y+.2<b.y+b.h),JSON.stringify(p));
 }
});
test('terrain height is identical for walking, glider landing and swept projectiles',()=>{
 const bare={...map,boxes:[]},x=-213,z=220,h=groundAt(map,x,z);assert.ok(h>5);
 const hit=worldHit(bare,{x,y:h+10,z},{x:0,y:-1,z:0},20);assert.ok(Math.abs(hit.point.y-h)<.003);assert.ok(hit.normal.y>.7);
 const p={x,y:h,z,yaw:0,pitch:0,health:100,crown:null,weapon:'sprinter',grounded:true,vy:0,flight:'ground',inventory:[],stamina:100};
 for(let i=0;i<120;i++){movePlayer(p,{forward:1},bare,1/60);assert.ok(Math.abs(p.y-groundAt(bare,p.x,p.z))<.01);}
 p.y+=12;p.flight='glide';p.grounded=false;for(let i=0;i<180;i++)movePlayer(p,{},bare,1/60);
 assert.equal(p.flight,'ground');assert.ok(Math.abs(p.y-groundAt(bare,p.x,p.z))<.01);
 const origin={x:x-35,y:2,z};assert.ok(wallDistance(bare,origin,{x:1,y:0,z:0},70)<70,'hill stops a horizontal shot');
 assert.equal(terrainHit(bare,{x,y:20,z},{x:1,y:0,z:0},70),null);
});
const mats=new Map(),kit={mat:c=>{if(!mats.has(c))mats.set(c,new THREE.MeshLambertMaterial({color:c}));return mats.get(c);}};
for(const [name,make]of Object.entries({block:(w,h,d)=>new THREE.BoxGeometry(w,h,d),ball:(w,h,d)=>new THREE.SphereGeometry(1,8,6).scale(w,h,d),cylinder:(r,h,c,s=12)=>new THREE.CylinderGeometry(r,r,h,s)}))kit[name]=(g,x,y,z,...v)=>{const c=name==='cylinder'?v[2]:v[3],geometry=make(...v);const m=new THREE.Mesh(geometry,kit.mat(c));m.position.set(x,y,z);g.add(m);return m;};
test('all loot, architecture, foliage and animated prop families have finite detailed geometry',()=>{
 const models=[...ROYALE_GUN_IDS.map(id=>lootModel({id,weapon:true,rarity:2},kit)),...Object.keys(ITEMS).map(id=>lootModel({id},kit)),lootModel({id:'heavy',ammoType:'heavy'},kit),chestModel(kit),chestModel(kit,true),gliderModel(kit),launchpadModel(kit)];
 for(const kind of new Set(map.trees.map(t=>t.kind))){const g=new THREE.Group();treeModel(g,map.trees.find(t=>t.kind===kind),kit);models.push(g);}
 for(const kind of new Set(map.buildings.map(t=>t.kind))){const g=new THREE.Group();dressBuilding(g,map.buildings.find(t=>t.kind===kind),kit);models.push(g);}
 for(const model of models){let parts=0;model.traverse(o=>{if(o.isMesh){parts++;assert.ok(o.geometry.getAttribute('position').array.every(Number.isFinite));}});assert.ok(parts>=3,model.name);const box=new THREE.Box3().setFromObject(model);assert.ok([box.min.x,box.max.y,box.max.z].every(Number.isFinite));}
 const chest=models.find(g=>g.userData.lid);assert.ok(chest.userData.glow);chest.userData.lid.rotation.x=-1.7;
 const wrap=new THREE.Box3().setFromObject(lootModel({id:'bandage'},kit,{ground:false})),medkit=new THREE.Box3().setFromObject(lootModel({id:'medkit'},kit,{ground:false}));assert.notDeepEqual(wrap.getSize(new THREE.Vector3()).toArray(),medkit.getSize(new THREE.Vector3()).toArray());
 for(const model of models){bake(model,false,true);assert.ok(model.children.length>0);model.traverse(o=>{if(o.isMesh)assert.ok(o.geometry);});}
});
