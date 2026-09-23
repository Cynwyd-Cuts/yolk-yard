import {gun,weapon,mode,clamp} from './data.js';
import {direction,wallDistance,dist,EYE,canStand} from './physics.js';

// Hard/Impossible retain the former Normal/Hard aiming envelopes. Easy and
// Normal deliberately react later, lead less, and miss more often.
export const BOT_SKILL = [
 {reaction:.85,error:.10,hit:.30,lead:.08,cover:.12,grenade:.12,turn:2.5,burst:.26,pause:.85},
 {reaction:.52,error:.067,hit:.48,lead:.27,cover:.35,grenade:.3,turn:3.6,burst:.44,pause:.62},
 {reaction:.28,error:.036,hit:.72,lead:.60,cover:.70,grenade:.65,turn:5.2,burst:.72,pause:.45},
 {reaction:.15,error:.018,hit:.90,lead:.92,cover:.94,grenade:.9,turn:7,burst:.94,pause:.28},
];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const eye=p=>({x:p.x,y:p.y+EYE,z:p.z});
const visible=(sim,p,t)=>{const a=eye(p),v={x:t.x-a.x,y:t.y+.9-a.y,z:t.z-a.z},d=Math.hypot(v.x,v.y,v.z)||1;return wallDistance(sim.map,a,{x:v.x/d,y:v.y/d,z:v.z/d},d)>=d-.05;};
function coverPoint(sim,p,t){
 const options=[];
 for(const b of sim.map.boxes){
  if(b.h<1.2||b.y>p.y+1||Math.hypot(b.x-p.x,b.z-p.z)>16||b.kind==='boundary')continue;
  const dx=b.x-t.x,dz=b.z-t.z,l=Math.hypot(dx,dz)||1;
  const q={x:b.x+dx/l*(Math.max(b.w,b.d)/2+1.25),y:p.y,z:b.z+dz/l*(Math.max(b.w,b.d)/2+1.25)};
  if(canStand(sim.map,q,.65)&&!visible(sim,q,t))options.push(q);
 }
 return options.sort((a,b)=>dist(p,a)-dist(p,b))[0];
}
export function botInput(sim,p,{goal:externalGoal=null,enemy:preferred=null,travel=false}={}){
 const skill=BOT_SKILL[clamp(sim.options.difficulty-1,0,3)],now=sim.time,r=sim.random;
 const brain=p.brain??={decision:0,aimAt:0,burstUntil:0,nextBurst:0,seenAt:0,lastX:p.x,lastZ:p.z,checkAt:now+1,turnAt:now,side:r()<.5?-1:1};
 const enemies=[...sim.players.values()].filter(t=>t!==p&&t.health>0&&!t.spectating&&(!t.flight||t.flight==='ground')&&(!mode(sim.options.mode).teams||t.team!==p.team));
 let target=preferred||enemies.find(t=>t.id===brain.target)||enemies.sort((a,b)=>dist(p,a)-dist(p,b))[0];
 const canSee=!!target&&dist(p,target)<(p.inventory?150:110)&&visible(sim,p,target);
 if(canSee){if(brain.target!==target.id){brain.target=target.id;brain.aimAt=now+skill.reaction;brain.decision=0;}brain.lastSeen={x:target.x,y:target.y,z:target.z};brain.seenAt=now;}
 else if(now-brain.seenAt>3){brain.target=null;target=null;}
 let slot=p.slot;
 if(!p.inventory){
  const primary=weapon(p.weapon),close=target&&dist(p,target)<9;
  const usePip=p.ammo[1]>0&&((p.ammo[0]===0&&(close||p.reserve[0]===0))||(close&&(primary.projectile||primary.id==='needle')&&sim.options.difficulty>=2));
  slot=usePip?1:(p.ammo[0]>0||p.reserve[0]>0?0:1);
 }else if(target){
  const distance=dist(p,target);
  const slots=p.inventory.map((i,index)=>({i,index})).filter(({i})=>i?.weapon&&(i.ammo>0||p.bank?.[({pip:'light',zipper:'light',scatter:'shells',doubleyolk:'shells',needle:'heavy',peeper:'heavy',thumper:'rockets'}[i.id]||'medium')]>0));
  slots.sort((a,b)=>{
   const score=({i,index})=>{const w=weapon(i.id);return (i.ammo>0?30:0)+(index===p.slot?5:0)+(distance<10?(w.pellets>1?25:w.secondary?15:0):(w.optic==='scope'?20:10))-(w.projectile&&distance<7?80:0);};return score(b)-score(a);
  });if(slots.length)slot=slots[0].index;
 }
 const w=gun({...p,slot}),distance=target?dist(p,target):Infinity;
 if(now>=brain.decision){
  brain.decision=now+1.1+r()*1.7;brain.side=r()<.5?-1:1;
  let goal=externalGoal;
  if(canSee&&!travel){
   const retreat=p.health<35||p.reloadEnd>now||p.ammo[slot]===0;
   if(retreat&&r()<skill.cover)goal=coverPoint(sim,p,target);
   if(!goal){
    const dx=p.x-target.x,dz=p.z-target.z,l=Math.hypot(dx,dz)||1;
    const desired=w.pellets>1?5:w.projectile?19:w.optic==='scope'?28:14;
    const tactic=r();
    if(retreat||distance<desired*.6)goal={x:p.x+dx/l*(4+r()*3),y:p.y,z:p.z+dz/l*(4+r()*3)};
    else if(distance>desired*1.45)goal={...target};
    else if(tactic<.25)goal={x:p.x,y:p.y,z:p.z};
    else {const shift=2.5+r()*5;goal={x:p.x+(-dz/l*brain.side+dx/l*(r()-.5))*shift,y:p.y,z:p.z+(dx/l*brain.side+dz/l*(r()-.5))*shift};}
   }
  }
  if(!goal)goal=brain.lastSeen&&now-brain.seenAt<3?brain.lastSeen:{x:(r()-.5)*sim.map.size*1.7,y:0,z:(r()-.5)*sim.map.size*1.7};
  brain.goal=goal;p.botPath=sim.nav.path(p,goal);
 }
 let goal=travel&&externalGoal?externalGoal:brain.goal||externalGoal||p;
 while(p.botPath?.length&&dist(p,p.botPath[0])<.7)p.botPath.shift();
 let dx=goal.x-p.x,dz=goal.z-p.z,len=Math.hypot(dx,dz)||1;
 const clear=wallDistance(sim.map,{x:p.x,y:p.y+.6,z:p.z},{x:dx/len,y:0,z:dz/len},Math.min(len,10))>=Math.min(len,10)-.1;
 const waypoint=clear&&Math.abs((goal.y||0)-p.y)<.45?goal:p.botPath?.[0]||goal;
 dx=waypoint.x-p.x;dz=waypoint.z-p.z;len=Math.hypot(dx,dz);
 let mx=len>.45?dx/len:0,mz=len>.45?dz/len:0;
 // Local steering steers around feet and other eggs instead of scraping walls.
 let jump=false;
 if(mx||mz){
  const probe={x:p.x,y:p.y+.55,z:p.z},look={x:mx,y:0,z:mz};
  if(wallDistance(sim.map,probe,look,1.4)<1.2){
   const left={x:-mz,y:0,z:mx},right={x:mz,y:0,z:-mx};
   const dl=wallDistance(sim.map,probe,left,2.5),dr=wallDistance(sim.map,probe,right,2.5),side=dl>dr?left:right;
   jump=wallDistance(sim.map,{...probe,y:p.y+1.6},look,1.4)>1.3&&now>(brain.nextJump||0);
   if(!jump){mx=side.x;mz=side.z;}
  }
 }
 if(now>brain.checkAt){
  const stuck=Math.hypot(p.x-brain.lastX,p.z-brain.lastZ)<.35&&len>1;
  if(stuck){brain.decision=0;p.botPath=[];brain.unstickUntil=now+.65;brain.side*=-1;}
  brain.lastX=p.x;brain.lastZ=p.z;brain.checkAt=now+1.2;
 }
 if(now<brain.unstickUntil){const a=p.yaw+brain.side*Math.PI*.65;mx=-Math.sin(a);mz=-Math.cos(a);}
 for(const other of sim.players.values())if(other!==p&&other.health>0){const d=Math.hypot(p.x-other.x,p.z-other.z);if(d>0&&d<1.8){mx+=(p.x-other.x)/d*(1.8-d);mz+=(p.z-other.z)/d*(1.8-d);}}
 let yaw=Math.atan2(-mx,-mz),pitch=0,fire=false,popper=false;
 if(canSee){
  if(now>=brain.nextBurst){
   brain.nextBurst=now+skill.burst+skill.pause+r()*.45;brain.burstUntil=now+skill.burst;
   const hit=r()<skill.hit;
   brain.errorX=(r()-.5)*skill.error+(hit?0:brain.side*(.7+r()*.8)/Math.max(5,distance));
   brain.errorY=(r()-.5)*skill.error*.6;
   brain.height=hit?.78+(r()-.5)*(1-skill.hit)*.6:.25+r()*1.6;
  }
  const lead=Math.min(1.1,distance/w.boltSpeed)*skill.lead;
  const tx=target.x+(target.vx||0)*lead-p.x,tz=target.z+(target.vz||0)*lead-p.z;
  yaw=Math.atan2(-tx,-tz)+(brain.errorX||0)+Math.sin(now*1.7+(p.botSeed||0))*skill.error*.15;
  pitch=Math.atan2(target.y+(brain.height??.9)+(target.vy||0)*lead*.25-p.y-EYE,Math.hypot(tx,tz))+(brain.errorY||0);
  fire=now>=brain.aimAt&&now<brain.burstUntil&&distance<(w.flightRange??w.range)*.95&&(!w.projectile||distance>6);
  if(now>(brain.nextGrenade||0)&&distance>7&&distance<19&&p.health>0){
   brain.nextGrenade=now+5+r()*7;
   const friendly=[...sim.players.values()].some(t=>t!==p&&mode(sim.options.mode).teams&&t.team===p.team&&dist(t,target)<5);
   if(!friendly&&r()<skill.grenade){
    if(!p.inventory&&p.poppers>0){popper=true;pitch=Math.max(.18,Math.min(.55,distance*.025));}
    else if(p.inventory){const i=p.inventory.findIndex(i=>i?.id==='popper');if(i>=0){slot=i;fire=true;pitch=.35;}}
   }
  }
 }
 const dt=clamp(now-brain.turnAt,0,.1);brain.turnAt=now;
 yaw=p.yaw+clamp(wrap(yaw-p.yaw),-skill.turn*dt,skill.turn*dt);
 if(canSee&&Math.abs(wrap(yaw-(Math.atan2(-(target.x-p.x),-(target.z-p.z)))))>.24)fire=false;
 if(p.inventory?.[slot]?.id==='popper'&&fire)brain.utility={slot,yaw,pitch,until:now+1};
 if(jump){brain.nextJump=now+1.1+r();}
 const ml=Math.max(1,Math.hypot(mx,mz));mx/=ml;mz/=ml;
 return {yaw,pitch,forward:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,strafe:Math.cos(yaw)*mx-Math.sin(yaw)*mz,fire,aim:canSee&&slot===p.slot&&sim.options.difficulty>=2&&!popper,reload:p.ammo[slot]===0,jump,popper,slot,swapSlot:-1};
}
