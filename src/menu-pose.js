const tau=Math.PI*2;
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export const MENU_FRONT=Math.PI+Math.atan2(7.5,12.5);
export const IDLE_CLIPS=['low-hold','inspect','high-hold','reload','toss-catch','cradle','stretch','present'];
export function idleClip(name,t){
 const wave=Math.sin(Math.PI*t);
 const p={name,pitch:-.65,roll:-.25,x:.65,y:1.05,z:-.62,reload:-1,flight:0,spin:0,release:0};
 if(name==='inspect'){p.pitch=.15+wave*.2;p.roll=-.7+Math.sin(t*tau)*.3;p.y=1.35;p.z=-.85;}
 if(name==='high-hold'){p.pitch=.95;p.roll=.3;p.y=1.14;}
 if(name==='reload'){p.pitch=.1;p.roll=-.18;p.y=1.16;p.reload=t>.14&&t<.86?(t-.14)/.72:-1;}
 if(name==='toss-catch'){
  p.pitch=.08;p.roll=0;p.x=.72;p.y=1.15;
  const f=clamp((t-.25)/.4);p.flight=Math.sin(Math.PI*f)*1.5;p.spin=f*tau;
  p.release=smooth((t-.22)/.06)*(1-smooth((t-.64)/.09));
  p.y-=Math.sin(Math.PI*clamp(t/.25))*.12;
 }
 if(name==='cradle'){p.pitch=-.2;p.roll=-1.05;p.x=.35;p.y=1.05;p.z=-.85;}
 if(name==='stretch'){p.pitch=.65+wave*.3;p.roll=.2;p.y=1.15+wave*.22;}
 if(name==='present'){p.pitch=.1;p.roll=-.65;p.x=.4;p.y=1.23;p.z=-.7-wave*.3;}
 return p;
}
export class MenuPose {
 constructor(random=Math.random){this.random=random;this.bag=[];this.clip=null;this.clipTime=0;this.time=0;this.pending=false;this.spin=0;this.aimYaw=MENU_FRONT;this.aimPitch=0;this.yaw=MENU_FRONT;this.pitch=-.65;this.roll=-.25;this.side=.65;this.height=1.05;this.depth=-.62;this.idle=1;this.nextClip();}
 nextClip(){
  if(!this.bag.length){this.bag=[...IDLE_CLIPS];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}if(this.bag.at(-1)===this.clip)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];}
  this.clip=this.bag.pop();this.clipTime=0;
 }
 aim(yaw,pitch){this.spin=0;this.aimYaw=yaw;this.aimPitch=Math.max(-.75,Math.min(.75,pitch));this.pending=true;}
 rotate(delta){this.spin+=delta;this.pending=true;}
 update(dt){
  dt=Math.max(0,Math.min(dt,.05));this.time+=dt;
  // Hold the last aim for one second; any new pointer input restarts the delay.
  this.quietTime=this.pending?0:Math.min(1,(this.quietTime??1)+dt);
  const idle=this.quietTime>=1;this.pending=false;
  if(idle){this.clipTime+=dt;if(this.clipTime>=5)this.nextClip();}
  const clip=idleClip(this.clip,this.clipTime/5),blend=1-Math.exp(-dt*(idle?5:9));
  const approach=(key,value)=>this[key]+=(value-this[key])*blend;
  const yaw=idle?MENU_FRONT:this.aimYaw+this.spin;
  this.yaw+=wrap(yaw-this.yaw)*blend;if(Math.abs(wrap(yaw-this.yaw))<.00001)this.yaw=yaw;
  approach('pitch',idle?clip.pitch:this.aimPitch);approach('roll',idle?clip.roll:0);
  approach('side',idle?clip.x:.28);approach('height',idle?clip.y:1.15);approach('depth',idle?clip.z:-.78);approach('idle',idle?1:0);
  return {yaw:this.yaw,pitch:this.pitch,roll:this.roll,x:this.side,y:this.height+Math.sin(this.time*1.4)*.01*this.idle,z:this.depth,idle,pose:IDLE_CLIPS.indexOf(this.clip),clip:this.clip,reload:idle?clip.reload:-1,flight:idle?clip.flight:0,spin:idle?clip.spin:0,release:idle?clip.release:0};
 }
}
export function touchPair(touches){if(touches.length!==2)return null;const [a,b]=touches;return {x:(a.clientX+b.clientX)/2,angle:Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX)};}
export const touchRotation=(previous,next,width)=>wrap(next.angle-previous.angle)+(next.x-previous.x)/Math.max(width,1)*tau;
