import {transportAt} from './royale-data.js';
import {RemotePoses} from './remote-poses.js';
// Presentation only. Simulation, hit tests and input acknowledgements retain
// authoritative positions and times; never feed these values back to gameplay.
export class GuestPresentation {
 constructor(){this.key=null;this.offset={x:0,y:0,z:0};this.received=0;this.time=0;this.poses=new RemotePoses();}
 receive(state,before,after,now){
  this.poses.receive(state);
  const key=`${state.royale?.matchId}:${state.round}:${after?.id}:${after?.health>0}:${after?.flight}`;
  const continuous=this.key===key&&before&&after&&after.health>0;
  const correction=continuous?{x:before.x+this.offset.x-after.x,y:before.y+this.offset.y-after.y,z:before.z+this.offset.z-after.z}:{x:0,y:0,z:0};
  this.offset=Math.hypot(correction.x,correction.y,correction.z)<1?correction:{x:0,y:0,z:0};
  if(this.key!==key)this.time=state.time;
  this.key=key;this.received=now;
 }
 frame(state,predicted,now,dt){
  const advance=state.phase==='playing'?Math.min(.15,Math.max(0,(now-this.received)/1000)):0;
  this.time=Math.max(state.time,Math.min(state.time+.15,Math.max(this.time,state.time+advance)));
  const elapsed=state.royale?state.royale.elapsed+(this.time-state.time):0;
  const visual={...state,time:this.time,...(state.royale?{royale:{...state.royale,elapsed}}:{})};
  const decay=Math.exp(-18*Math.max(0,dt));
  for(const axis of ['x','y','z'])this.offset[axis]*=decay;
  let player=predicted;
  if(player?.health>0){
   player=state.royale&&player.flight==='transport'?{...player,...transportAt(state.royale.route,elapsed)}:{...player,x:player.x+this.offset.x,y:player.y+this.offset.y,z:player.z+this.offset.z};
  }
  visual.players=this.poses.players(state,player,this.time);
  // Projectiles already support bounded extrapolation in View. Keep the packet
  // timestamp separate from the smoothly advancing animation clock.
  visual.snapshotTime=state.time;
  return {state:visual,player};
 }
}
