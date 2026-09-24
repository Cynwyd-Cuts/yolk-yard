const tau=Math.PI*2;
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export class MenuPose {
 constructor(){this.time=0;this.lastActive=-2.21;this.spin=0;this.aimYaw=Math.PI+.54;this.aimPitch=0;this.yaw=Math.PI+.25;this.pitch=-.65;this.roll=-.25;this.side=.65;this.height=1.05;this.depth=-.62;this.idle=1;}
 aim(yaw,pitch){this.spin=0;this.aimYaw=yaw;this.aimPitch=Math.max(-.75,Math.min(.75,pitch));this.lastActive=this.time;}
 rotate(delta){this.spin+=delta;this.lastActive=this.time;}
 update(dt){
  dt=Math.max(0,Math.min(dt,.05));this.time+=dt;
  const idle=this.time-this.lastActive>2.2,pose=Math.floor(Math.max(0,this.time-this.lastActive-2.2)/10)%2;
  const blend=1-Math.exp(-dt*(idle?3.4:7));
  const approach=(key,value)=>this[key]+=(value-this[key])*blend;
  const yaw=(idle?Math.PI+.25+Math.sin(this.time*.25)*.2:this.aimYaw)+this.spin;
  this.yaw+=wrap(yaw-this.yaw)*blend;
  approach('pitch',idle?(pose?.95:-.65):this.aimPitch);
  approach('roll',idle?(pose?.3:-.25):0);
  approach('side',idle?.65:.28);approach('height',idle?(pose?1.14:1.05):1.15);approach('depth',idle?-.62:-.78);approach('idle',idle?1:0);
  return {yaw:this.yaw,pitch:this.pitch,roll:this.roll,x:this.side,y:this.height+Math.sin(this.time*1.4)*.012*this.idle,z:this.depth,idle,pose};
 }
}
export function touchPair(touches){if(touches.length!==2)return null;const [a,b]=touches;return {x:(a.clientX+b.clientX)/2,angle:Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX)};}
export const touchRotation=(previous,next,width)=>wrap(next.angle-previous.angle)+(next.x-previous.x)/Math.max(width,1)*tau;
