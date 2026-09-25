import {gun} from './data.js';
import {direction,muzzleOrigin} from './physics.js';
// Predict presentation only: no damage, inventory edits or host acknowledgements.
export class GuestFire {
 constructor(){this.reset();}
 reset(){this.key=null;this.next=0;this.triggerNext=0;this.held=false;this.burst=0;this.sent=[];this.echoes=[];}
 step(player,input,time,now,round){
  const key=`${round}:${player.id}:${player.slot}:${player.inventory?.[player.slot]?.id}:${player.health>0}`;
  if(this.key!==key){this.reset();this.key=key;}
  this.sent=this.sent.filter(s=>s.seq>player.ack&&now-s.at<1);
  this.echoes=this.echoes.filter(s=>now-s.at<1).slice(-64);
  const pressed=input.fire&&!this.held;this.held=!!input.fire;
  const w=gun(player),eligible=player.health>0&&player.flight==='ground'&&player.inventory?.[player.slot]?.weapon&&input.slot===player.slot&&!input.buildMode&&!input.reload&&!player.reloadEnd&&!player.use;
  if(!eligible){this.burst=0;return null;}
  if((player.ammo[player.slot]||0)<=this.sent.length||time<(player.equipUntil||0)||now<this.next)return null;
  const continuing=this.burst>0;
  if(!continuing&&!(input.fire&&(w.automatic||pressed)))return null;
  if(!continuing){this.burst=Math.max(0,(w.burst||1)-1);this.triggerNext=now+w.interval;}else this.burst--;
  this.next=this.burst?now+w.burstInterval:this.triggerNext;
  const mark={seq:input.seq,at:now,weapon:w.id};this.sent.push(mark);this.echoes.push(mark);
  const d=direction(input.yaw,input.pitch),origin=muzzleOrigin({...player,yaw:input.yaw,pitch:input.pitch},w),speed=w.boltSpeed||80;
  return {type:w.projectile?'launch':'shot',player:player.id,weapon:w.id,predicted:true,origin,shots:[{id:'predicted-'+input.seq,vx:d.x*speed,vy:d.y*speed,vz:d.z*speed}]};
 }
 confirm(event,now){
  this.echoes=this.echoes.filter(s=>now-s.at<1);
  if(!['shot','launch'].includes(event.type)||event.popper)return false;
  const index=this.echoes.findIndex(s=>s.weapon===event.weapon);
  if(index<0)return false;this.echoes.splice(index,1);return true;
 }
}
