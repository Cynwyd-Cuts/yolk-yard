// A short render buffer removes packet-sized jumps without changing game state.
export class RemotePoses {
 constructor(){this.samples=[];this.key=null;}
 receive(state){
  const key=`${state.royale?.matchId}:${state.round}:${state.phase}`;
  if(this.key!==key){this.samples=[];this.key=key;}
  if(!this.samples.length||state.time>this.samples.at(-1).time){
   this.samples.push({time:state.time,players:new Map((state.players||[]).map(p=>[p.id,p]))});
   if(this.samples.length>8)this.samples.shift();
  }
 }
 players(state,local,time){
  const target=time-.1;
  let a=this.samples[0],b=a;
  for(const s of this.samples){b=s;if(s.time>=target)break;a=s;}
  return (state.players||[]).map(p=>{
   if(p.id===local?.id)return local;
   const previous=a?.players.get(p.id),next=b?.players.get(p.id);
   if(!previous||!next||p.health<=0||previous.health<=0||previous.flight!==next.flight||
      Math.hypot(previous.x-next.x,previous.y-next.y,previous.z-next.z)>12)return p;
   const f=b.time>a.time?Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time))):1;
   const pose={...p};
   for(const axis of ['x','y','z','pitch'])pose[axis]=previous[axis]+(next[axis]-previous[axis])*f;
   const angle=Math.atan2(Math.sin(next.yaw-previous.yaw),Math.cos(next.yaw-previous.yaw));
   pose.yaw=previous.yaw+angle*f;
   return pose;
  });
 }
}
