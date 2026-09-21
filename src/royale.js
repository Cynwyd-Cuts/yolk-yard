import {beginEquip} from './equip.js';
import {Simulation} from './simulation.js';
import {gun,weapon,clamp} from './data.js';
import {movePlayer,dist,direction,wallDistance,EYE} from './physics.js';
import {surfaceAt} from './maps.js';
import {ITEMS,ROYALE_GUN_IDS,ammoType,AMMO_CAPS,randomRarity,makeStorm,stormAt,makeFlight,transportAt} from './royale-data.js';

export class RoyaleSimulation extends Simulation {
 constructor(options={}){
  super({...options,mode:'royale'});this.maxPlayers=this.options.capacity;
  this.loot=[];this.chests=[];this.pads=[];this.lootId=0;this.lootVersion=0;this.startedAt=0;this.elapsed=0;this.alive=0;this.placements=[];this.supplyAt=135;this.queueEnds=0;
 }
 addPlayer(id,profile,bot=false){
  if(this.players.has(id))return this.players.get(id);
  const playing=this.phase==='playing',capacity=this.options.capacity;
  if(this.players.size>=(playing?capacity+4:capacity))return null;
  this.maxPlayers=playing?capacity+4:capacity;
  const p=super.addPlayer(id,profile,bot);if(!p)return null;
  p.inventory=Array(5).fill(null);p.ammo=Array(5).fill(0);p.reserve=Array(5).fill(0);p.accuracyState=Array.from({length:5},()=>({}));
  p.bank={light:0,medium:0,shells:0,heavy:0,rockets:0};p.shield=0;p.stamina=100;p.flight='lobby';p.use=null;p.place=0;p.eliminated=false;p.spectating=playing;p.awaitingEntry=false;p.health=playing?0:100;
  return p;
 }
 spawn(p){
  if(!p.inventory){super.spawn(p);return;}
  // No external action can turn a spawn call into a second Royale life.
  if(this.phase==='playing')return;
 }
 setProfile(id,profile){
  if(this.phase==='playing')return;
  super.setProfile(id,profile);
 }
 configure(options){
  if(!super.configure({...options,mode:'royale'}))return false;
  this.maxPlayers=this.options.capacity;this.queueEnds=0;
  return true;
 }
 startRound(){
  if(this.phase==='playing')return false;
  for(const p of [...this.players.values()])if(p.bot)this.players.delete(p.id);
  const humans=[...this.players.values()];
  const count=Math.min(this.options.capacity-humans.slice(0,this.options.capacity).length,this.options.fill?this.options.capacity: this.options.bots);
  if(Math.min(humans.length,this.options.capacity)+Math.max(0,count)<2){this.emit('notice',{text:'Invite another egg or add a bot to launch.'});return false;}
  this.maxPlayers=this.options.capacity;const savedBots=this.options.bots;this.options.bots=Math.max(0,count);this.addBots();this.options.bots=savedBots;
  this.phase='playing';this.round++;this.startedAt=this.time;this.elapsed=0;this.winner='';this.winnerId=null;this.placements=[];this.projectiles=[];this.events=[];this.inputs.clear();this.loot=[];this.lootId=0;this.lootVersion++;this.pads=[];this.supplyAt=135;this.queueEnds=0;
  this.route=makeFlight(this.random);this.stormSteps=makeStorm(this.random,this.options.storm);this.storm=stormAt(this.stormSteps,0);this.remaining=this.stormSteps.at(-1).end+15;
  const landingSpots=this.map.floorLoot.filter((point,index)=>index%3===0&&point.y===0);
  const seats=[...this.players.values()].sort((a,b)=>Number(a.bot)-Number(b.bot));
  for(const [index,p] of seats.entries()){
   const contestant=index<this.options.capacity;
   Object.assign(p,{health:contestant?100:0,shield:0,stamina:100,sprintRest:0,exhausted:false,sprinting:false,flight:contestant?'transport':'out',flightLatch:false,grounded:false,eliminated:!contestant,spectating:!contestant,awaitingEntry:false,spawnRequested:false,place:0,eliminatedAt:null,kills:0,deaths:0,points:0,streak:0,slot:0,poppers:0,reloadEnd:0,burstLeft:0,nextShot:0,fireLatch:false,shieldUntil:0,lastDamage:-100,respawnAt:0,killerId:null,crown:null,inventory:Array(5).fill(null),ammo:Array(5).fill(0),reserve:Array(5).fill(0),accuracyState:Array.from({length:5},()=>({})),bank:{light:0,medium:0,shells:0,heavy:0,rockets:0},use:null,chestId:null,chestProgress:0,interactLatch:false,dropLatch:false,useLatch:false,botThink:0,botPath:[],botDrop:4+this.random()*27,botLand:landingSpots[Math.floor(index*landingSpots.length/this.options.capacity)%landingSpots.length]});
   Object.assign(p,transportAt(this.route,0));p.pitch=0;p.vy=0;
  }
  this.alive=seats.filter(p=>p.health>0).length;
  this.chests=this.map.chests.map((c,i)=>({...c,id:'chest-'+i,opened:false,supply:false}));
  for(const [i,point] of this.map.floorLoot.entries()){
   if(i%3===0)this.dropWeapon(point,this.randomGun(),randomRarity(this.random()));
   else this.dropLoot(point,{id:Object.keys(ITEMS)[Math.floor(this.random()*Object.keys(ITEMS).length)],count:1,rarity:1});
   if(i%3===0)this.dropAmmo({...point,x:point.x+1.3},ammoType(this.loot.at(-1).id),28);
  }
  this.emit('round',{round:this.round});this.emit('royale-cue',{cue:'transport-horn'});return true;
 }
 randomGun(){return ROYALE_GUN_IDS[Math.floor(this.random()*ROYALE_GUN_IDS.length)];}
 dropLoot(point,item){
  if(this.loot.length>=700)return null;
  const drop={...item,uid:++this.lootId,x:point.x,y:point.y||0,z:point.z};this.loot.push(drop);this.lootVersion++;return drop;
 }
 dropWeapon(point,id,rarity=0,ammo=weapon(id).magazine){return this.dropLoot(point,{id,weapon:true,rarity,count:1,ammo});}
 dropAmmo(point,type,count){return this.dropLoot(point,{id:type,ammoType:type,count,rarity:0});}
 removeLoot(item){const i=this.loot.indexOf(item);if(i>=0){this.loot.splice(i,1);this.lootVersion++;}}
 accessible(p,item,range=3){
  if(dist(p,item)>range || item.landAt>this.time)return false;
  const from={x:p.x,y:p.y+.9,z:p.z},to={x:item.x-from.x,y:item.y+.6-from.y,z:item.z-from.z},len=Math.hypot(to.x,to.y,to.z)||1;
  return wallDistance(this.map,from,{x:to.x/len,y:to.y/len,z:to.z/len},len)>=len-.15;
 }
 syncInventory(p){
  p.ammo=p.inventory.map(i=>i?.weapon?i.ammo:0);
  p.reserve=p.inventory.map(i=>i?.weapon?p.bank[ammoType(i.id)]:0);
 }
 dropSlot(p,index=p.slot){
  const item=p.inventory[index];if(!item)return;
  // Drop at the feet: this always remains on the same reachable collision surface.
  this.dropLoot(p,item);p.inventory[index]=null;p.reloadEnd=0;p.burstLeft=0;p.use=null;this.syncInventory(p);
  this.emit('royale-cue',{player:p.id,cue:'item-drop',x:p.x,y:p.y,z:p.z});
 }
 takeLoot(p,item){
  if(!this.loot.includes(item)||!this.accessible(p,item)||p.health<=0||p.flight!=='ground')return false;
  if(item.ammoType){const add=Math.min(item.count,AMMO_CAPS[item.ammoType]-p.bank[item.ammoType]);if(add<=0)return false;p.bank[item.ammoType]+=add;item.count-=add;if(!item.count)this.removeLoot(item);else this.lootVersion++;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'ammo-pickup'});return true;}
  let slot=!item.weapon?p.inventory.findIndex(i=>i?.id===item.id&&i.count<ITEMS[i.id].stack):-1;
  if(slot>=0){const add=Math.min(item.count,ITEMS[item.id].stack-p.inventory[slot].count);p.inventory[slot].count+=add;item.count-=add;if(!item.count)this.removeLoot(item);else this.lootVersion++;}
  else {
   slot=p.inventory.findIndex(i=>!i);if(slot<0){slot=p.slot;this.dropSlot(p,slot);}
   const {uid,x,y,z,...entry}=item;p.inventory[slot]={...entry};this.removeLoot(item);
   if(!p.inventory[p.slot] || p.inventory.filter(Boolean).length===1)p.slot=slot;
   beginEquip(p,this.time,true);
  }
  p.use=null;p.reloadEnd=0;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'pickup-'+(item.rarity||0),item:item.id});return true;
 }
 openChest(p,chest){
  if(chest.opened||!this.accessible(p,chest,3.3))return false;
  chest.opened=true;this.lootVersion++;
  const id=this.randomGun(),rarity=randomRarity(this.random(),chest.supply?2:0);
  this.dropWeapon({x:chest.x-1,y:chest.y,z:chest.z+1.4},id,rarity);
  this.dropAmmo({x:chest.x+1,y:chest.y,z:chest.z+1.4},ammoType(id),ammoType(id)==='rockets'?4:ammoType(id)==='heavy'?12:36);
  const list=['mini','flask','medkit','splash','impulse','launchpad'];
  this.dropLoot({x:chest.x,y:chest.y,z:chest.z+2.2},{id:list[Math.floor(this.random()*list.length)],count:chest.supply?2:1,rarity:1});
  this.emit('royale-cue',{cue:'chest-open',player:p.id,x:chest.x,y:chest.y,z:chest.z});return true;
 }
 interact(p,input,dt){
  for(const item of [...this.loot])if(item.ammoType&&this.accessible(p,item,1.6))this.takeLoot(p,item);
  const chest=this.chests.filter(c=>!c.opened&&this.accessible(p,c,3.3)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(input.interact&&chest){
   if(p.chestId!==chest.id){p.chestId=chest.id;p.chestProgress=0;this.emit('royale-cue',{player:p.id,cue:'chest-search'});}
   p.chestProgress+=dt;
   if(p.chestProgress>=.8){this.openChest(p,chest);p.chestProgress=0;p.chestId=null;}
  }else{p.chestProgress=0;p.chestId=null;}
  if(input.interact&&!p.interactLatch&&!chest){
   const item=this.loot.filter(i=>!i.ammoType&&this.accessible(p,i,3)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
   if(item)this.takeLoot(p,item);
  }
  p.interactLatch=!!input.interact;
 }
 beginUse(p){
  const item=p.inventory[p.slot],def=ITEMS[item?.id];if(!def||p.use||p.flight!=='ground')return;
  if(def.kind==='heal'&&p.health>=def.cap||def.kind==='shield'&&p.shield>=def.cap)return;
  p.reloadEnd=0;p.burstLeft=0;p.use={id:item.id,slot:p.slot,start:this.time,end:this.time+def.duration};
  this.emit('royale-cue',{player:p.id,cue:'use-'+item.id,x:p.x,y:p.y,z:p.z});
 }
 finishUse(p){
  const use=p.use,item=p.inventory[use?.slot];if(!item||item.id!==use.id){p.use=null;return;}
  const def=ITEMS[item.id];
  if(def.kind==='heal')p.health=Math.min(def.cap,p.health+def.amount);
  else if(def.kind==='shield')p.shield=Math.min(def.cap,p.shield+def.amount);
  else if(def.kind==='splash'){
   for(const other of this.players.values())if(other.health>0&&this.accessible(p,other,5)){const heal=Math.min(100-other.health,30);other.health+=heal;other.shield=Math.min(100,other.shield+30-heal);}
   this.emit('royale-fx',{kind:'splash',x:p.x,y:p.y,z:p.z});
  }else if(def.kind==='popper'){this.launch(p,true);}
  else if(def.kind==='impulse'){
   p.flight='launch';p.vy=28;p.grounded=false;p.flightLatch=true;
   this.emit('royale-fx',{kind:'impulse',x:p.x,y:p.y,z:p.z});
  }else if(def.kind==='launchpad'){
   this.pads.push({id:'pad-'+this.lootId++,x:p.x,y:p.y,z:p.z,until:this.time+180});
  }
  item.count--;if(item.count<=0)p.inventory[use.slot]=null;p.use=null;this.syncInventory(p);
  this.emit('royale-cue',{player:p.id,cue:'complete-'+use.id,x:p.x,y:p.y,z:p.z});
 }
 cancelUse(p){if(p.use)this.emit('royale-cue',{player:p.id,cue:'use-cancel'});p.use=null;}
 reload(p){if(!p.inventory[p.slot]?.weapon)return;this.syncInventory(p);super.reload(p);}
 fire(p,burst=false){
  const item=p.inventory[p.slot];if(!item?.weapon||p.flight!=='ground'||p.use)return;
  super.fire(p,burst);item.ammo=p.ammo[p.slot];
 }
 damage(victim,attacker,amount,source,precision=false){
  if(victim.health<=0||victim.flight==='transport')return;
  amount=Math.max(0,amount);const old=victim.health;let absorbed=0;
  if(source!=='Storm'&&victim.shield>0){absorbed=Math.min(victim.shield,amount);victim.shield-=absorbed;amount-=absorbed;
   this.emit('royale-cue',{cue:victim.shield===0?'shield-break':'shield-hit',player:victim.id,x:victim.x,y:victim.y,z:victim.z});
  }
  this.cancelUse(victim);victim.chestProgress=0;victim.lastDamage=this.time;
  if(amount>0)super.damage(victim,attacker,amount,source,precision);
  if(absorbed>0)this.emit('hit',{player:attacker?.id,target:victim.id,amount:Math.round(absorbed),x:victim.x,y:victim.y+2.7,z:victim.z,precision,shield:true});
  if(old>0&&victim.health<=0)this.eliminate(victim);
 }
 eliminate(p){
  if(p.eliminated)return;
  p.eliminated=true;p.eliminatedAt=this.time;p.place=this.alive;p.flight='out';p.spectating=true;p.use=null;p.reloadEnd=0;p.burstLeft=0;
  for(let i=0;i<5;i++)if(p.inventory[i])this.dropSlot(p,i);
  for(const [type,count] of Object.entries(p.bank))if(count>0)this.dropAmmo(p,type,count);
  p.bank={light:0,medium:0,shells:0,heavy:0,rockets:0};this.syncInventory(p);this.inputs.delete(p.id);
  this.placements.push({id:p.id,name:p.name,place:p.place,kills:p.kills});this.alive=Math.max(0,this.alive-1);
  this.emit('royale-eliminated',{player:p.id,place:p.place});
 }
 removePlayer(id){const p=this.players.get(id);if(p&&this.phase==='playing'&&p.health>0){p.health=0;this.eliminate(p);}super.removePlayer(id);}
 playerAction(id,action){
  const p=this.players.get(id);if(!p||this.phase!=='playing')return;
  const change=/^inventory-(select|drop|swap)-([0-4])(?:-([0-4]))?$/.exec(action);
  if(change&&p.health>0&&!p.spectating&&p.flight==='ground'){
   const from=Number(change[2]),to=Number(change[3]);
   if(change[1]==='select'){p.slot=from;beginEquip(p,this.time,true);}
   else if(change[1]==='drop')this.dropSlot(p,from);
   else if(Number.isInteger(to)&&to>=0&&to<5){[p.inventory[from],p.inventory[to]]=[p.inventory[to],p.inventory[from]];beginEquip(p,this.time,true);}
   this.cancelUse(p);p.reloadEnd=0;p.burstLeft=0;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'weapon-swap'});return;
  }
  if(action==='spectate'&&p.health>0){this.damage(p,null,p.health+p.shield+1,'Left round');if(p.flight==='transport'){p.health=0;this.eliminate(p);}}
 }
 tick(dt){
  dt=clamp(dt,0,1/30);this.time+=dt;
  if(this.phase!=='playing'){const count=Math.ceil(this.queueEnds-this.time);if(this.queueEnds&&count>0&&count<=5&&this.lastCountdown!==count){this.lastCountdown=count;this.emit('royale-cue',{cue:'countdown'});}return;}
  this.elapsed=this.time-this.startedAt;this.remaining=Math.max(0,this.stormSteps.at(-1).end+15-this.elapsed);
  const oldIndex=this.storm.index,oldClosing=this.storm.closing;
  this.storm=stormAt(this.stormSteps,this.elapsed);
  if(oldIndex!==this.storm.index||oldClosing!==this.storm.closing)this.emit('royale-cue',{cue:this.storm.closing?'storm-closing':'storm-reveal'});
  if(this.elapsed>this.supplyAt){this.supplyAt+=130;const angle=this.random()*Math.PI*2,r=Math.max(0,this.storm.radius-20)*this.random();const x=clamp(this.storm.x+Math.cos(angle)*r,-210,210),z=clamp(this.storm.z+Math.sin(angle)*r,-210,210);this.chests.push({id:'supply-'+this.lootId++,x,z,y:surfaceAt(this.map,x,z),opened:false,supply:true,landAt:this.time+18});this.lootVersion++;this.emit('royale-cue',{cue:'supply-incoming'});}
  for(const p of this.players.values()){
   if(p.health<=0||p.spectating)continue;
   let input=p.bot?this.botInput(p):this.inputs.get(p.id);
   if(!input||!p.bot&&this.time-p.lastInput>.4)input={yaw:p.yaw,pitch:p.pitch,slot:p.slot};
   p.ack=Math.max(p.ack,input.seq||0);
   if(p.flight==='transport'){
    Object.assign(p,transportAt(this.route,this.elapsed));
    if(this.elapsed>=3&&(input.jump||this.elapsed>=this.route.duration)){
     p.flight='dive';p.flightLatch=true;p.yaw=input.yaw||p.yaw;p.pitch=0;this.emit('royale-cue',{player:p.id,cue:'transport-exit'});
    }
    continue;
   }
   const wasFlight=p.flight,oldGrounded=p.grounded,previous={x:p.x,y:p.y,z:p.z};
   const slot=clamp(Math.floor(input.slot??p.slot),0,4);
   if(slot!==p.slot){p.slot=slot;p.reloadEnd=0;p.burstLeft=0;beginEquip(p,this.time,true);this.cancelUse(p);p.nextShot=Math.max(p.nextShot,this.time+.22);this.emit('royale-cue',{player:p.id,cue:'weapon-swap'});}
   if(input.swapSlot>=0&&input.swapSlot<5&&input.swapSlot!==p.slot&&!p.swapLatch){const j=input.swapSlot;[p.inventory[p.slot],p.inventory[j]]=[p.inventory[j],p.inventory[p.slot]];p.reloadEnd=0;this.cancelUse(p);this.syncInventory(p);}
   p.swapLatch=input.swapSlot>=0;
   if(input.sprint)this.cancelUse(p);
   movePlayer(p,input,this.map,dt);p.moving=Math.hypot(p.x-previous.x,p.z-previous.z)>.001;p.aim=!!input.aim&&p.flight==='ground'&&!p.use;
   if(wasFlight!==p.flight)this.emit('royale-cue',{player:p.id,cue:p.flight==='ground'?'land':p.flight==='dive'?'glider-cut':'glider-deploy',x:p.x,y:p.y,z:p.z});
   else if(!oldGrounded&&p.grounded)this.emit('royale-cue',{player:p.id,cue:'land',x:p.x,y:p.y,z:p.z});
   else if(oldGrounded&&!p.grounded&&p.vy>0)this.emit('royale-cue',{player:p.id,cue:'jump',x:p.x,y:p.y,z:p.z});
   if(p.flight==='ground'){
    this.syncInventory(p);this.updateAccuracy(p,previous,dt);
    if(input.drop&&!p.dropLatch)this.dropSlot(p);p.dropLatch=!!input.drop;
    this.interact(p,input,dt);
    if(p.reloadEnd&&this.time>=p.reloadEnd){const item=p.inventory[p.slot];if(item?.weapon){const type=ammoType(item.id),add=Math.min(gun(p).magazine-item.ammo,p.bank[type]);item.ammo+=add;p.bank[type]-=add;}p.reloadEnd=0;this.syncInventory(p);this.emit('royale-cue',{player:p.id,cue:'reload-bolt'});}
    if(p.inventory[p.slot]?.weapon){
     if(input.reload||input.fire&&p.ammo[p.slot]===0)this.reload(p);
     if(p.burstLeft&&this.time>=p.burstTime){this.fire(p,true);p.burstLeft--;p.burstTime+=gun(p).burstInterval;}
     if(input.fire&&this.time>=p.nextShot&&(gun(p).automatic||!p.fireLatch||p.bot)&&!p.burstLeft&&!p.reloadEnd&&p.ammo[p.slot]>0){this.fire(p);p.nextShot=this.time+gun(p).interval;if(gun(p).burst){p.burstLeft=gun(p).burst-1;p.burstTime=this.time+gun(p).burstInterval;}}
     if(input.fire&&!p.fireLatch&&p.ammo[p.slot]===0&&p.reserve[p.slot]===0)this.emit('royale-cue',{player:p.id,cue:'weapon-empty'});
    }else if(input.fire&&!p.useLatch)this.beginUse(p);
    p.fireLatch=!!input.fire;p.useLatch=!!input.fire;
    if(p.use&&this.time>=p.use.end)this.finishUse(p);
    for(const pad of this.pads)if(this.time>=(p.nextLaunch||0)&&dist(p,pad)<2){p.flight='launch';p.vy=38;p.grounded=false;p.nextLaunch=this.time+3;this.emit('royale-cue',{player:p.id,cue:'launch',x:pad.x,y:pad.y,z:pad.z});}
   }
   if(this.storm.active&&Math.hypot(p.x-this.storm.x,p.z-this.storm.z)>this.storm.radius){this.damage(p,null,this.storm.dps*dt,'Storm');}
   else if(this.remaining===0)this.damage(p,null,30*dt,'Storm');
  }
  for(const chest of this.chests)if(chest.landAt&&this.time>=chest.landAt&&!chest.landed){chest.landed=true;this.emit('royale-cue',{cue:'supply-land',x:chest.x,y:chest.y,z:chest.z});}
  this.pads=this.pads.filter(p=>p.until>this.time);
  this.updateProjectiles(dt);
  const living=[...this.players.values()].filter(p=>p.health>0&&!p.spectating);this.alive=living.length;
  if(living.length<=1)this.finish();
 }
 finish(){
  if(this.phase!=='playing')return;
  const living=[...this.players.values()].filter(p=>p.health>0&&!p.spectating);
  if(living.length>1)return;
  this.phase='results';this.winnerId=living[0]?.id||null;this.winner=living[0]?living[0].name+' wins':'No surviving eggs — draw';
  if(living[0]){living[0].place=1;this.placements.push({id:living[0].id,name:living[0].name,place:1,kills:living[0].kills});}
  // If the final pair fell in the same simulation tick, both share the final place.
  if(!living.length){const final=this.placements.filter(x=>x.place<=2);for(const p of final){p.place=1;const player=this.players.get(p.id);if(player)player.place=1;}}
  this.emit('finish',{winner:this.winner});this.emit('royale-cue',{cue:'victory'});
 }
 botInput(p){
  const input={yaw:p.yaw,pitch:0,forward:0,strafe:0,slot:p.slot,swapSlot:-1};
  if(p.flight==='transport'){input.jump=this.elapsed>=p.botDrop;return input;}
  let goal=p.botLand;
  if(p.flight!=='ground'){
   const dx=goal.x-p.x,dz=goal.z-p.z;input.yaw=Math.atan2(-dx,-dz);input.forward=Math.hypot(dx,dz)>4?1:0;
   input.jump=p.flight==='dive'&&p.y<95;return input;
  }
  const needGun=!p.inventory.some(i=>i?.weapon);
  const danger=this.storm.active&&Math.hypot(p.x-this.storm.nextX,p.z-this.storm.nextZ)>this.storm.nextRadius*.82;
  const targets=[...this.players.values()].filter(e=>e!==p&&e.health>0&&!e.spectating&&e.flight==='ground').sort((a,b)=>dist(p,a)-dist(p,b));
  const enemy=targets[0],weaponSlot=p.inventory.findIndex(i=>i?.weapon&&(i.ammo>0||p.bank[ammoType(i.id)]>0));
  const items=this.loot.filter(i=>(i.y<=p.y+.5)&&(needGun?i.weapon:i.ammoType||(!i.weapon&&p.inventory.filter(Boolean).length<5))).sort((a,b)=>dist(p,a)-dist(p,b));
  const chest=this.chests.filter(c=>!c.opened&&(!c.landAt||c.landAt<this.time)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(danger)goal={x:this.storm.nextX,z:this.storm.nextZ};
  else if(items[0]&&dist(p,items[0])<(needGun?180:35))goal=items[0];
  else if(needGun&&chest)goal=chest;
  else if(enemy)goal=enemy;
  else goal={x:this.storm.nextX,z:this.storm.nextZ};
  if(p.botThink<=this.time){p.botPath=this.nav.path(p,goal);p.botThink=this.time+.8+this.random()*.3;}
  while(p.botPath?.length&&dist(p,p.botPath[0])<1.05)p.botPath.shift();
  const toward={x:goal.x-p.x,y:0,z:goal.z-p.z},glen=Math.hypot(toward.x,toward.z)||1;
  const clear=wallDistance(this.map,{x:p.x,y:p.y+.7,z:p.z},{x:toward.x/glen,y:0,z:toward.z/glen},glen)>=glen-.1;
  let step=clear?goal:p.botPath?.[0]||goal;
  let dx=step.x-p.x,dz=step.z-p.z,len=Math.hypot(dx,dz)||1;
  input.yaw=Math.atan2(-dx,-dz);input.forward=len>.5?1:0;input.sprint=(danger||len>12)&&!needGun;
  input.jump=this.time%2<.025;
  if(chest&&this.accessible(p,chest,3.3))input.interact=true;
  else if(items[0]&&this.accessible(p,items[0]))input.interact=!p.interactLatch;
  if(weaponSlot>=0)input.slot=weaponSlot;
  const heal=p.inventory.findIndex(i=>i&&!i.weapon&&((ITEMS[i.id]?.kind==='heal'&&p.health<65)||(ITEMS[i.id]?.kind==='shield'&&p.shield<50)));
  if(heal>=0&&(!enemy||dist(p,enemy)>25)&&!danger){input.slot=heal;input.fire=!p.use;input.sprint=false;input.forward=0;return input;}
  if(enemy&&weaponSlot>=0){
   const to={x:enemy.x-p.x,y:enemy.y+.9-p.y-EYE,z:enemy.z-p.z},distance=Math.hypot(to.x,to.y,to.z);
   if(distance<105&&wallDistance(this.map,{x:p.x,y:p.y+EYE,z:p.z},{x:to.x/distance,y:to.y/distance,z:to.z/distance},distance)>=distance-.3){
    input.yaw=Math.atan2(-to.x,-to.z)+Math.sin(this.time*1.5+p.botDrop)*.01*(4-this.options.difficulty);input.pitch=Math.atan2(to.y,Math.hypot(to.x,to.z));input.fire=this.time%1.4<.35+this.options.difficulty*.2;input.aim=true;input.sprint=false;
    input.forward=-Math.sin(input.yaw)*dx/len-Math.cos(input.yaw)*dz/len;input.strafe=Math.cos(input.yaw)*dx/len-Math.sin(input.yaw)*dz/len;
   }
  }
  return input;
 }
 snapshot(){
  const state=super.snapshot();
  state.players=state.players.map(p=>{const source=this.players.get(p.id);return {...p,inventory:source.inventory?.map(i=>i?{...i}:null),bank:{...source.bank},shield:source.shield,stamina:source.stamina,sprinting:source.sprinting,exhausted:source.exhausted,sprintRest:source.sprintRest,flight:source.flight,flightLatch:source.flightLatch,eliminated:source.eliminated,eliminatedAt:source.eliminatedAt,place:source.place,use:source.use?{...source.use}:null,chestProgress:source.chestProgress||0};});
  state.royale={elapsed:this.elapsed,alive:this.alive,route:this.route,storm:this.storm,lootVersion:this.lootVersion,loot:this.loot.map(i=>({...i})),chests:this.chests.map(c=>({...c})),pads:this.pads.map(p=>({...p})),winnerId:this.winnerId,placements:this.placements.map(p=>({...p})),queueEnds:this.queueEnds};
  return state;
 }
}
