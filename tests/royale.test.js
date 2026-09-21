import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {makeStorm,stormAt,queueCandidates,AMMO_CAPS} from '../src/royale-data.js';
import {rng,gun,weapon} from '../src/data.js';
import {movePlayer,sanitizeInput} from '../src/physics.js';
import {ROYALE_MAP} from '../src/royale-map.js';
const make=(options={})=>{const s=new RoyaleSimulation({capacity:4,bots:0,seed:21,...options});s.addPlayer('host',{name:'Host'});s.addPlayer('guest',{name:'Guest'});s.startRound();return s;};
const ground=(p,x=70,z=0)=>Object.assign(p,{x,y:0,z,flight:'ground',grounded:true,shieldUntil:0});
const advance=(s,seconds)=>{for(let i=0;i<seconds*60;i++)s.tick(1/60);};
test('Royale isolates loadouts, fills to capacity, and only starts with two contestants',()=>{
 const empty=new RoyaleSimulation({bots:0});empty.addPlayer('host',{});assert.equal(empty.startRound(),false);
 const s=make({bots:15,capacity:8,fill:true});assert.equal(s.players.size,8);assert.equal(s.alive,8);
 for(const p of s.players.values()){assert.equal(p.flight,'transport');assert.equal(p.health,100);assert.equal(p.shield,0);assert.deepEqual(p.inventory,[null,null,null,null,null]);assert.equal(p.reserve.reduce((a,b)=>a+b,0),0);}
});
test('takeoff locks entrants to spectator seats and spawn/profile/rejoin cannot grant a second life',()=>{
 const s=make(),p=s.players.get('host');const late=s.addPlayer('late',{name:'Late'});assert.equal(late.spectating,true);assert.equal(late.health,0);
 ground(p);s.damage(p,s.players.get('guest'),1000,'Test');assert.equal(p.place,2);assert.equal(p.spectating,true);
 for(const action of ['rejoin','respawn','spectate'])s.playerAction('host',action);
 s.setProfile('host',{weapon:'needle'});s.spawn(p);assert.equal(p.health,0);
 s.tick(1/60);assert.equal(s.phase,'results');assert.equal(s.winnerId,'guest');
 assert.equal(s.configure({bots:0,capacity:4}),true);assert.equal(s.startRound(),true);assert.equal(s.players.get('late').health,100);assert.equal(s.players.get('late').flight,'transport');assert.equal(p.place,0);assert.equal(p.inventory.filter(Boolean).length,0);
});
test('host serializes chest and floor-loot ownership and validates range and cover',()=>{
 const s=make(),p=ground(s.players.get('host')),q=ground(s.players.get('guest'));
 s.loot=[];const chest={id:'test',x:70,y:0,z:1,opened:false};s.chests=[chest];assert.equal(s.openChest(p,chest),true);const count=s.loot.length;assert.equal(s.openChest(q,chest),false);assert.equal(s.loot.length,count);
 const item=s.dropWeapon(p,'comet',3);assert.equal(s.takeLoot(p,item),true);assert.equal(s.takeLoot(q,item),false);assert.equal(p.inventory[0].id,'comet');
 const far=s.dropWeapon({x:100,y:0,z:0},'needle');assert.equal(s.takeLoot(p,far),false);
 const b=ROYALE_MAP.buildings[0];ground(p,b.x-6.8,b.z);const behind=s.dropWeapon({x:b.x-5.2,y:0,z:b.z},'pip');assert.equal(s.takeLoot(p,behind),false);
});
test('five slots swap and drop without duplicating magazines or reserve ammo',()=>{
 const s=make(),p=ground(s.players.get('host'));s.loot=[];
 for(const id of ['sprinter','pip','needle','scatter','comet'])assert.equal(s.takeLoot(p,s.dropWeapon(p,id)),true);
 p.slot=2;const replacement=s.dropWeapon(p,'peeper',4,3);assert.equal(s.takeLoot(p,replacement),true);assert.equal(p.inventory[2].id,'peeper');assert.equal(s.loot.filter(i=>i.id==='needle').length,1);
 p.bank.heavy=9;s.syncInventory(p);s.reload(p);advance(s,3);assert.equal(p.inventory[2].ammo,8);assert.equal(p.bank.heavy,4);
 s.dropSlot(p,2);assert.equal(s.loot.find(i=>i.id==='peeper').ammo,8);assert.equal(p.bank.heavy,4);
 p.bank.light=AMMO_CAPS.light;const ammo=s.dropAmmo(p,'light',50);assert.equal(s.takeLoot(p,ammo),false);assert.equal(ammo.count,50);
});
test('healing and shield use complete once, cancel on damage, and refuse full or capped stats',()=>{
 const s=make(),p=ground(s.players.get('host'));p.inventory[0]={id:'mini',count:3,rarity:1};p.slot=0;
 s.beginUse(p);advance(s,2.1);assert.equal(p.shield,25);assert.equal(p.inventory[0].count,2);
 s.beginUse(p);s.damage(p,null,1,'Hit');assert.equal(p.use,null);assert.equal(p.inventory[0].count,2);
 p.shield=50;s.beginUse(p);assert.equal(p.use,null);
 p.inventory[0]={id:'medkit',count:1};p.health=30;s.beginUse(p);advance(s,6.1);assert.equal(p.health,100);assert.equal(p.inventory[0],null);
});
test('reserve and selected weapon instances determine damage and reload, while arenas retain original stats',()=>{
 const p={weapon:'sprinter',slot:0};assert.equal(gun(p).damage,weapon('sprinter').damage);
 p.inventory=[{id:'comet',weapon:true,rarity:4,ammo:4}];assert.equal(gun(p).id,'comet');assert.ok(gun(p).range>=100);
 assert.equal(sanitizeInput({slot:9,sprint:true,swapSlot:99}).slot,0);assert.equal(sanitizeInput({slot:4}).slot,4);assert.equal(sanitizeInput({swapSlot:99}).swapSlot,-1);
});
test('stamina drains, exhausts, gates sprint, and regenerates after rest',()=>{
 const s=make(),p=ground(s.players.get('host'),70,40),input={yaw:0,forward:1,sprint:true};
 for(let i=0;i<280;i++)movePlayer(p,input,s.map,1/60);assert.equal(p.exhausted,true);assert.ok(p.stamina<3);
 for(let i=0;i<60;i++)movePlayer(p,{yaw:0},s.map,1/60);assert.ok(p.stamina<3);
 for(let i=0;i<160;i++)movePlayer(p,{yaw:0},s.map,1/60);assert.ok(p.stamina>20);assert.equal(p.exhausted,false);
});
test('transport cannot be damaged, forces exit, and automatically deploys a glider and lands',()=>{
 const s=make(),p=s.players.get('host');s.damage(p,null,1000,'Storm');assert.equal(p.health,100);
 advance(s,35.2);assert.equal(p.flight,'dive');advance(s,8);assert.equal(p.flight,'ground');assert.equal(p.y,0);assert.equal(p.health,100);
});
test('all storm circles are nested and timing is continuous across stage boundaries',()=>{
 for(let seed=1;seed<=120;seed++){
  const phases=makeStorm(rng(seed));for(const step of phases)assert.ok(Math.hypot(step.x-step.fromX,step.z-step.fromZ)+step.radius<=step.fromRadius+1e-6);
  for(const p of phases){const a=stormAt(phases,p.closeAt),b=stormAt(phases,p.end-.001);assert.equal(a.radius,p.fromRadius);assert.ok(Math.abs(b.radius-p.radius)<.03);}
 }
});
test('storm bypasses shields, disconnects eliminate and drop once, final pair can draw',()=>{
 const s=make(),p=ground(s.players.get('host'));p.shield=100;p.inventory[0]={id:'pip',weapon:true,rarity:0,ammo:4};s.damage(p,null,25,'Storm');assert.equal(p.health,75);assert.equal(p.shield,100);
 const before=s.loot.length;s.removePlayer('host');assert.equal(s.alive,1);assert.equal(s.loot.length,before+1);s.tick(1/60);assert.equal(s.winnerId,'guest');
 const d=make();for(const p of d.players.values()){ground(p);d.damage(p,null,1000,'Storm');}d.tick(1/60);assert.equal(d.phase,'results');assert.equal(d.winnerId,null);assert.ok(d.winner.includes('draw'));assert.equal(d.placements.every(p=>p.place===1),true);
});
test('public queue prioritizes populated waiting Royale rooms and excludes full or live matches',()=>{
 const rooms=[{code:'BBBB2222',mode:'royale',phase:'lobby',players:1,capacity:16},{code:'AAAA2222',mode:'royale',phase:'lobby',players:3,capacity:16},{code:'CCCC2222',mode:'royale',phase:'playing',players:1,capacity:16},{code:'DDDD2222',mode:'ffa',phase:'lobby',players:2,capacity:8},{code:'EEEE2222',mode:'royale',phase:'lobby',players:16,capacity:16}];
 assert.deepEqual(queueCandidates(rooms).map(r=>r.code),['AAAA2222','BBBB2222']);
});
test('a full seeded bot round loots, fights, rotates and terminates with a valid result',{timeout:120000},()=>{
 const s=make({capacity:16,bots:15,fill:true,storm:'quick',seed:83});for(const p of s.players.values())p.bot=true;
 let armed=0;const start=performance.now();for(let i=0;i<60*470&&s.phase==='playing';i++){s.tick(1/60);if(i%300===0)armed=Math.max(armed,[...s.players.values()].filter(p=>p.inventory.some(i=>i?.weapon)).length);}
 assert.equal(s.phase,'results');assert.ok(armed>=8,`Only ${armed} bots found weapons`);assert.ok(s.placements.length>=15);assert.ok(s.elapsed<470);console.log(`Royale: ${s.elapsed.toFixed(1)}s simulated in ${(performance.now()-start).toFixed(0)}ms; ${armed} armed contestants.`);
});
test('impulses rise physically, respect ceilings and glide safely without roof teleportation',()=>{
 const p={health:100,x:0,y:0,z:0,yaw:0,pitch:0,flight:'launch',vy:38,grounded:false,crown:null};
 const map={size:50,theme:'royale',boxes:[{x:0,y:4,z:0,w:10,d:10,h:.5}]};
 let high=0;for(let i=0;i<180;i++){movePlayer(p,{},map,1/60);high=Math.max(high,p.y);}
 assert.ok(high>1);assert.ok(high<=4-1.75);assert.equal(p.flight,'ground');assert.equal(p.y,0);
 p.flight='launch';p.vy=38;p.x=20;high=0;for(let i=0;i<600;i++){movePlayer(p,{},map,1/60);high=Math.max(high,p.y);}
 assert.ok(high>30);assert.equal(p.y,0);assert.equal(p.flight,'ground');
});
test('inventory commands survive intervening movement packets and reject invalid or eliminated requests',()=>{
 const s=make(),p=ground(s.players.get('host'));s.takeLoot(p,s.dropWeapon(p,'pip'));s.takeLoot(p,s.dropLoot(p,{id:'mini',count:2,rarity:1}));
 s.playerAction('host','inventory-swap-0-1');s.setInput('host',{seq:3,slot:0});s.tick(1/60);assert.equal(p.inventory[0].id,'mini');assert.equal(p.inventory[1].id,'pip');
 s.playerAction('host','inventory-swap-0-999');assert.equal(p.inventory.length,5);s.playerAction('host','inventory-drop-0');assert.equal(p.inventory[0],null);
 s.playerAction('host','inventory-select-1');assert.equal(p.slot,1);s.damage(p,null,1000,'Storm');const before=s.loot.length;s.playerAction('host','inventory-drop-1');assert.equal(s.loot.length,before);
});
test('every authored loot and chest anchor is outside solid architecture',()=>{
 for(const anchor of [...ROYALE_MAP.chests,...ROYALE_MAP.floorLoot]){
  const box=ROYALE_MAP.boxes.find(b=>anchor.y+.2>b.y&&anchor.y+.2<b.y+b.h&&Math.abs(anchor.x-b.x)<b.w/2+.15&&Math.abs(anchor.z-b.z)<b.d/2+.15);
  assert.equal(box,undefined,`Blocked anchor at ${anchor.x},${anchor.y},${anchor.z}`);
 }
});
