import {direction,rayBox,rayEgg,EYE,wallDistance,invalidateCollision} from './physics.js';
import {groundAt} from './terrain.js';
export const MATERIALS={wood:{name:'Wood',health:150,start:90,seconds:4,color:0xba8852},brick:{name:'Brick',health:300,start:100,seconds:8,color:0xbc705c},metal:{name:'Metal',health:500,start:110,seconds:12,color:0x799ba8}};
export const PIECES=['wall','floor','stairs','roof'];
export const GRID=4,COST=10,CAP=999;
export const pickaxe=()=>({id:'pickaxe',pickaxe:true,count:1,rarity:0});
export const inventory=()=>[null,null,null,null,null,pickaxe()];
export function materialFor(b,map){
 const prop=map?.props?.find(p=>p.x===b.x&&p.z===b.z);
 if(b.kind==='tree'||['crate','bench'].includes(prop?.kind)||b.kind==='shelter')return 'wood';
 if(['lamp','barrels'].includes(prop?.kind)||['steel','gold'].includes(b.color)||map?.buildings?.[b.building]?.kind==='factory')return 'metal';
 if(['farm','camp','park'].includes(map?.buildings?.[b.building]?.kind))return 'wood';
 return b.color==='crate'?'wood':'brick';
}
export function authoredBoxes(map){return (map.authored||map.boxes).filter(b=>!b.buildId).map((b,i)=>({...b,objectId:b.objectId||'world-'+i,material:b.material||materialFor(b,map)}));}
export function pieceBoxes(p){
 const boxes=[],rotation=p.rotation%4;
 const add=(x,y,z,w,h,d)=>{if(rotation%2)[x,z,w,d]=[z,x,d,w];if(rotation===1||rotation===2)x=-x;if(rotation===2||rotation===3)z=-z;boxes.push({x:p.x+x,y:p.y+y,z:p.z+z,w,h,d,buildId:p.id,material:p.material,kind:'build',color:p.material});};
 if(p.type==='wall'){
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)if(!(p.mask&(1<<(row*3+col))))add((col-1)*GRID/3,row*GRID/3,0,GRID/3,GRID/3,.16);
 }else if(p.type==='floor'){
  for(let i=0;i<4;i++)if(!(p.mask&(1<<i)))add((i%2-.5)*2,0,(Math.floor(i/2)-.5)*2,2,.16,2);
 }else if(p.type==='stairs'){
  for(let i=0;i<12;i++)for(let side=0;side<2;side++)if(!(p.mask&(1<<side)))add(side?1:-1,i/3,-2+(i+.5)/3,2,1/3,1/3);
 }else{
  for(let x=0;x<12;x++)for(let z=0;z<12;z++){const q=(x>=6?1:0)+(z>=6?2:0);if(p.mask&(1<<q))continue;const h=(Math.min(x,11-x,z,11-z)+1)/3;add(-2+(x+.5)/3,0,-2+(z+.5)/3,1/3,h,1/3);}
 }
 return boxes;
}
export function placement(p,type,rotation=0,material='wood'){
 const d=direction(p.yaw,p.pitch),reach=4.3;
 let x=Math.round((p.x+d.x*reach)/4)*4,z=Math.round((p.z+d.z*reach)/4)*4,y=Math.max(0,Math.round((p.y+(p.pitch>.45?2:p.pitch<-.5?-1:0))/4)*4);
 let r=((Math.round(p.yaw/(Math.PI/2))+rotation)%4+4)%4;
 if(type==='wall'){if(r%2)x=Math.round((p.x+d.x*reach-2)/4)*4+2;else z=Math.round((p.z+d.z*reach-2)/4)*4+2;}
 return {x,y,z,type,rotation:r,material,mask:0};
}
const bounds=p=>{const bs=pieceBoxes(p);return {minX:Math.min(...bs.map(b=>b.x-b.w/2)),maxX:Math.max(...bs.map(b=>b.x+b.w/2)),minY:p.y,maxY:Math.max(...bs.map(b=>b.y+b.h)),minZ:Math.min(...bs.map(b=>b.z-b.d/2)),maxZ:Math.max(...bs.map(b=>b.z+b.d/2))};};
const touching=(a,b)=>a.minX<=b.maxX+.2&&a.maxX>=b.minX-.2&&a.minY<=b.maxY+.2&&a.maxY>=b.minY-.2&&a.minZ<=b.maxZ+.2&&a.maxZ>=b.minZ-.2;
function anchored(p,map){
 const bs=pieceBoxes(p);return bs.some(b=>b.y<=groundAt(map,b.x,b.z)+.25)||map.boxes.some(b=>!b.buildId&&bs.some(a=>Math.abs(a.y-(b.y+b.h))<.24&&Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2));
}
export function validPlacement(p,map,builds,players=[]){
 if(!PIECES.includes(p.type)||!MATERIALS[p.material]||Math.abs(p.x)>map.size-4||Math.abs(p.z)>map.size-4||p.y>100)return 'Outside build area';
 if(builds.length>=600)return 'Build limit reached';
 if(builds.some(b=>b.type===p.type&&b.x===p.x&&b.y===p.y&&b.z===p.z&&(p.type!=='wall'||b.rotation%2===p.rotation%2)))return 'Already built';
 const bs=pieceBoxes(p);
 for(const b of bs){
  if(players.some(o=>o.health>0&&o.y<b.y+b.h-.04&&o.y+1.75>b.y+.04&&Math.abs(o.x-b.x)<b.w/2+.45&&Math.abs(o.z-b.z)<b.d/2+.45))return 'Player in the way';
  if(map.boxes.some(o=>!o.buildId&&Math.abs(o.x-b.x)<(o.w+b.w)/2-.08&&Math.abs(o.z-b.z)<(o.d+b.d)/2-.08&&b.y<o.y+o.h-.08&&b.y+b.h>o.y+.08))return 'Blocked';
 }
 if(!anchored(p,map)&&!builds.some(b=>touching(bounds(p),bounds(b))))return 'Needs support';
 return '';
}
export function aimedObject(map,p,range=5){
 const o={x:p.x,y:p.y+EYE,z:p.z},d=direction(p.yaw,p.pitch);let distance=wallDistance(map,o,d,range)+.001,box=null;
 for(const b of map.boxes){const t=rayBox(o,d,b,distance);if(t<=distance){distance=t;box=b;}}
 return box?{box,distance,point:{x:o.x+d.x*distance,y:o.y+d.y*distance,z:o.z+d.z*distance}}:null;
}
export function rebuildMap(sim){
 sim.map.boxes=[...sim.worldBoxes.filter(b=>!sim.worldDamage[b.objectId]?.destroyed),...sim.builds.flatMap(pieceBoxes)];invalidateCollision(sim.map);
}
export function resetBuilding(sim){
 sim.worldBoxes=authoredBoxes(sim.map);sim.worldDamage={};sim.builds=[];sim.buildId=0;sim.buildVersion=0;rebuildMap(sim);
}
export function collapse(sim){
 const supported=new Set(sim.builds.filter(b=>anchored(b,sim.map)).map(b=>b.id)),cache=new Map(sim.builds.map(b=>[b.id,bounds(b)]));let changed=true;
 while(changed){changed=false;for(const b of sim.builds)if(!supported.has(b.id)&&sim.builds.some(a=>supported.has(a.id)&&touching(cache.get(a.id),cache.get(b.id)))){supported.add(b.id);changed=true;}}
 if(supported.size!==sim.builds.length){sim.builds=sim.builds.filter(b=>supported.has(b.id));sim.buildVersion++;rebuildMap(sim);}
}
export function damageObject(sim,box,amount,harvester=null){
 if(!box||!Number.isFinite(amount)||amount<=0)return;
 const built=box.buildId?sim.builds.find(b=>b.id===box.buildId):null;
 const material=box.material||'brick',max=built?.maxHealth||(box.kind==='tree'?250:box.kind==='prop'?180:450);
 const object=built||(sim.worldDamage[box.objectId]??={health:max,maxHealth:max,destroyed:false});
 if(object.destroyed)return;
 const taken=Math.min(object.health,amount);object.health-=taken;object.lastDamage=sim.time;
 if(harvester&&!built){const earned=Math.min(CAP-harvester.materials[material],Math.max(1,Math.round(taken/5)));harvester.materials[material]+=earned;harvester.lastHarvest={material,amount:earned,time:sim.time};sim.emit('harvest',{player:harvester.id,material,amount:earned,x:box.x,y:box.y+1,z:box.z});}
 if(object.health<=0){object.destroyed=true;if(built)sim.builds=sim.builds.filter(b=>b!==built);sim.emit('royale-fx',{kind:'break',x:box.x,y:box.y,z:box.z});rebuildMap(sim);collapse(sim);for(const item of [...sim.loot,...sim.chests]){let floor=groundAt(sim.map,item.x,item.z);for(const b of sim.map.boxes)if(Math.abs(item.x-b.x)<=b.w/2&&Math.abs(item.z-b.z)<=b.d/2&&b.y+b.h<=item.y+.1)floor=Math.max(floor,b.y+b.h);if(item.y>floor+.1){item.y=floor;sim.lootVersion++;}}}
 sim.buildVersion++;
}
export function swingPickaxe(sim,p){
 if(sim.time<(p.nextHarvest||0))return;p.nextHarvest=sim.time+.45;p.swingAt=sim.time;
 sim.emit('royale-cue',{cue:'pickaxe-swing',player:p.id,x:p.x,y:p.y,z:p.z});
 const hit=aimedObject(sim.map,p,4.5),o={...p,y:p.y+EYE},d=direction(p.yaw,p.pitch);let target=null,range=hit?.distance??4.5;
 for(const other of sim.players.values())if(other!==p&&other.health>0){const t=rayEgg(o,d,other);if(t<range){target=other;range=t;}}
 if(target)sim.damage(target,p,20,'Pickaxe');else if(hit){const entry=sim.worldDamage[hit.box.objectId],weak=entry?.weakpoint,bonus=weak&&Math.hypot(hit.point.x-weak.x,hit.point.y-weak.y,hit.point.z-weak.z)<.4;damageObject(sim,hit.box,bonus?100:50,p);const object=sim.worldDamage[hit.box.objectId];if(object&&!object.destroyed){const offset=Math.sin(sim.time*7)*.35;object.weakpoint={x:hit.point.x+(Math.abs(d.z)>.7?offset:0),y:Math.max(hit.box.y+.3,Math.min(hit.box.y+hit.box.h-.2,hit.point.y+.25)),z:hit.point.z+(Math.abs(d.x)>.7?offset:0)};}sim.emit('royale-cue',{cue:'harvest-hit',player:p.id,x:hit.point.x,y:hit.point.y,z:hit.point.z});}
}
export function buildingTick(sim,p,input){
 p.building=!!input.buildMode;p.buildType=input.buildType||'wall';p.buildMaterial=input.buildMaterial||'wood';p.buildRotation=input.buildRotation||0;
 if(p.building){
  p.use=null;p.reloadEnd=0;p.burstLeft=0;p.aim=false;
  if(input.fire&&sim.time>=(p.nextBuild||0)){
   p.nextBuild=sim.time+.15;
   let mat=p.buildMaterial;if(p.materials[mat]<COST)mat=Object.keys(MATERIALS).find(m=>p.materials[m]>=COST)||mat;
   const build=placement(p,p.buildType,p.buildRotation,mat),reason=validPlacement(build,sim.map,sim.builds,[...sim.players.values()]);
   if(!reason&&p.materials[mat]>=COST){const def=MATERIALS[mat];p.materials[mat]-=COST;sim.builds.push({...build,id:'build-'+(++sim.buildId),owner:p.id,health:def.start,maxHealth:def.health,created:sim.time,lastDamage:-100});sim.buildVersion++;rebuildMap(sim);sim.emit('royale-cue',{cue:'build-place',player:p.id,x:build.x,y:build.y,z:build.z});}
  }
  return true;
 }
 if(p.slot===5){if(input.fire)swingPickaxe(sim,p);return true;}
 return false;
}
export function editBuilding(sim,p,action){
 const match=/^build-edit-(\d+)-(build-\d+)$/.exec(action);
 const hit=aimedObject(sim.map,p,8),b=sim.builds.find(b=>b.id===(match?.[2]||hit?.box.buildId));if(!b||b.owner!==p.id||Math.hypot(b.x-p.x,b.y-p.y,b.z-p.z)>9)return false;
 if(action==='build-repair'){const missing=b.maxHealth-b.health,cost=Math.ceil(missing/b.maxHealth*COST);if(missing<=0||p.materials[b.material]<cost)return false;p.materials[b.material]-=cost;b.health=b.maxHealth;}
 else {
  if(!match)return false;const mask=Number(match[1]),max=b.type==='wall'?511:b.type==='stairs'?3:15;
  if(!Number.isInteger(mask)||mask<0||mask>=max)return false;
  const proposal={...b,mask};if(pieceBoxes(proposal).some(box=>[...sim.players.values()].some(p=>p.health>0&&p.y<box.y+box.h-.03&&p.y+1.75>box.y+.03&&Math.abs(p.x-box.x)<box.w/2+.45&&Math.abs(p.z-box.z)<box.d/2+.45)))return false;
  b.mask=mask;
 }
 sim.buildVersion++;rebuildMap(sim);collapse(sim);return true;
}
// Remote prediction and rendering use their own map; simulation maps never mutate the authored island.
export function applyBuildState(map,r){
 const key=r.matchId+':'+r.round+':'+(r.builds||[]).map(b=>b.id+','+b.mask).join(';')+':'+Object.keys(r.worldDamage||{}).filter(k=>r.worldDamage[k].destroyed).join(',');if(map.buildKey===key)return;
 map.authored??=authoredBoxes(map);map.boxes=[...map.authored.filter(b=>!r.worldDamage?.[b.objectId]?.destroyed),...(r.builds||[]).flatMap(pieceBoxes)];map.buildKey=key;invalidateCollision(map);
}
