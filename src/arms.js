import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {gun, clamp} from './data.js';
import {patternedShell} from './cosmetics.js';

export function armAppearance(value={}) {
  const p=typeof value==='string'?{color:value}:value;
  return {color:p.color||'#fff6da',pattern:p.pattern||0,accent:p.accent||'#f9b74a',finish:p.finish||0};
}

// Authored cartoon poses in blaster-local coordinates. The camera and other
// players use the same timeline, driven by the host's reload clock.
export const ARM_POSES = {
  sprinter: {right:[.095,-.24,.13], left:[-.10,-.14,-.43], socket:[-.10,-.33,-.10], drop:[-.42,-.39,-.18], tilt:[-.18,0,-.32]},
  zipper:   {right:[.095,-.24,.13], left:[-.12,-.14,-.34], socket:[-.10,-.33,-.16], drop:[-.40,-.36,-.22], tilt:[-.12,0,-.4]},
  anchor:   {right:[.095,-.25,.20], left:[-.13,-.16,-.48], socket:[-.23,-.34,-.045], drop:[-.46,-.4,-.18], tilt:[-.22,.12,-.24]},
  duet:     {right:[.095,-.24,-.03],left:[-.10,-.15,-.41], socket:[-.12,-.34,.35], drop:[-.48,-.34,.13], tilt:[-.15,-.12,-.35]},
  pip:      {right:[.09,-.23,.12],  left:[-.10,-.28,.12],  socket:[-.10,-.40,.12], drop:[-.38,-.38,-.06], tilt:[-.12,.13,-.28]},
  needle:   {right:[.095,-.24,.13], left:[-.10,-.14,-.44], socket:[-.10,-.30,-.15],drop:[-.42,-.36,-.19], tilt:[-.16,-.06,-.26]},
  scatter:  {right:[.11,-.25,.17],  left:[-.13,-.15,-.47], socket:[-.13,-.16,.04], drop:[-.42,-.35,-.15], tilt:[-.26,.1,-.36]},
  thumper:  {right:[.11,-.25,.17],  left:[-.14,-.20,-.32], socket:[-.13,-.20,-.30],drop:[-.48,-.36,-.3],tilt:[-.1,.2,-.46]},
};
const smooth = t => {t=clamp(t,0,1);return t*t*(3-2*t);};
function path(points, t) {
  if(t<=points[0][0]) return [...points[0][1]];
  if(t>=points.at(-1)[0]) return [...points.at(-1)[1]];
  for(let i=1;i<points.length;i++) if(t<=points[i][0]) {
    const [a,p]=points[i-1],[b,q]=points[i],f=smooth((t-a)/(b-a));
    return p.map((v,j)=>v+(q[j]-v)*f);
  }
  return [...points.at(-1)[1]];
}
export function reloadProgress(player, time) {
  if(!player || player.health<=0 || !(player.reloadEnd>time)) return -1;
  const w=gun(player),duration=player.ammo[player.slot]===0?w.reloadEmpty:w.reload;
  return clamp(1-(player.reloadEnd-time)/duration,0,1);
}
export function armPose(id, progress=-1) {
  const c=ARM_POSES[id]||ARM_POSES.sprinter;
  const t=clamp(progress,0,1),active=progress>=0;
  let left=[...c.left],right=[...c.right],partOffset=[0,0,0];
  if(active) {
    left=path([[0,c.left],[.16,c.socket],[.38,c.drop],[.5,c.drop],[.72,c.socket],[1,c.left]],t);
    if(id==='scatter') left=path([[0,c.left],[.15,c.drop],[.32,c.socket],[.45,c.drop],[.62,c.socket],[.78,[-.13,-.15,-.23]],[1,c.left]],t);
    if(id==='needle') right=path([[0,c.right],[.12,c.right],[.26,[.22,.01,.2]],[.44,[.24,.01,.33]],[.72,[.22,.01,.18]],[1,c.right]],t);
    if(id==='thumper') left=path([[0,c.left],[.25,c.drop],[.45,[-.25,-.25,-.57]],[.75,c.socket],[1,c.left]],t);
    if(id!=='scatter') partOffset=left.map((v,i)=>(v-c.socket[i])*(t>=.16&&t<=.72?1:0));
  }
  // Smoothly ease the model into and out of the reload pose.
  const lean=active?Math.sin(Math.PI*t):0;
  return {left,right,partOffset,rotation:c.tilt.map(v=>v*lean),dip:lean*.08,progress};
}
// Sculpted, shared hand shapes; each arm is a single deforming surface.
// No separate elbow balls or cylinder seams are visible when the arm bends.
const sphere = new THREE.SphereGeometry(1,24,16);
const handShapes=new Map();
function handGeometry(side) {
  if(handShapes.has(side)) return handShapes.get(side);
  const pieces=[];
  const volume=(x,y,z,sx,sy,sz)=>{
    const g=sphere.clone();g.scale(sx,sy,sz);g.translate(x,y,z);pieces.push(g);
  };
  const finger=(points,radius)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(x*side,y,z)));
    pieces.push(new THREE.TubeGeometry(curve,16,radius,10,false));
    for(const [x,y,z] of [points[0],points.at(-1)])volume(x*side,y,z,radius,radius,radius);
  };
  // Broad palm, rounded back of the hand, and a fleshy thumb base.
  volume(side*.035,-.006,.014,.10,.139,.086);
  volume(side*.074,.015,.006,.073,.112,.077);
  volume(side*.024,.052,.05,.071,.084,.072);
  // Four individually curled fingers wrap around the grip. The small gaps
  // between them preserve a readable silhouette without painted-on lines.
  const fingers=[{y:.096,r:.032,end:.082},{y:.030,r:.034,end:.023},{y:-.040,r:.032,end:-.042},{y:-.102,r:.027,end:-.100}];
  for(const {y,r,end} of fingers) finger([
    [.083,y,-.025],[.054,y,-.077],[-.015,y,-.106],[-.099,end,-.085],[-.115,end,-.028]
  ],r);
  // Opposing thumb crosses the near side of the grip, with its own rounded tip.
  finger([[.065,-.018,.067],[.034,.068,.096],[-.029,.13,.073],[-.086,.113,.027]],.041);
  const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  // Project one continuous pattern across the palm and fingers, rather than
  // restarting the texture separately on every sculpted piece.
  const positions=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)*side+.16)/.34,(positions.getY(i)+.15)/.34);
  geometry.computeBoundingSphere();geometry.userData.shared=true;
  handShapes.set(side,geometry);return geometry;
}
const ARM_RINGS=24,ARM_SIDES=16;
const armProfile=[[0,.12],[.22,.124],[.44,.097],[.61,.114],[.78,.103],[1,.070]];
const ringRadius=Array.from({length:ARM_RINGS+1},(_,i)=>path(armProfile.map(([t,r])=>[t,[r]]),i/ARM_RINGS)[0]);
const circumference=Array.from({length:ARM_SIDES+1},(_,i)=>[Math.cos(i/ARM_SIDES*Math.PI*2),Math.sin(i/ARM_SIDES*Math.PI*2)]);
function armGeometry() {
  const g=new THREE.BufferGeometry(),count=(ARM_RINGS+1)*(ARM_SIDES+1),indices=[];
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
  for(let i=0;i<ARM_RINGS;i++)for(let j=0;j<ARM_SIDES;j++){
    const a=i*(ARM_SIDES+1)+j,b=a+ARM_SIDES+1;
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  const uv=new Float32Array(count*2);
  for(let i=0;i<=ARM_RINGS;i++)for(let j=0;j<=ARM_SIDES;j++){
    const k=(i*(ARM_SIDES+1)+j)*2;uv[k]=j/ARM_SIDES;uv[k+1]=i/ARM_RINGS;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setIndex(indices);return g;
}
export function makeArms(id, profile={}, firstPerson=true) {
  const group=new THREE.Group();group.name='Animated egg arms';
  const appearance=armAppearance(profile),material=patternedShell(appearance);
  const mesh=(geo)=>{const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
  const limbs=[-1,1].map(side=>{
    const hand=mesh(handGeometry(side));hand.name=side<0?'Support hand':'Grip hand';
    const arm=mesh(armGeometry());arm.name='Smooth tapered arm';arm.frustumCulled=false;
    const shoulder=new THREE.Vector3(side<0?-.72:.38,firstPerson?-.72:-.4,firstPerson?.42:.9);
    return {side,hand,arm,shoulder,lastWrist:new THREE.Vector3(Infinity,Infinity,Infinity)};
  });
  limbs[0].hand.userData.ownedMaterial=true;
  group.userData={id,limbs,appearance,progress:-1};
  updateArms(group,-1);
  return group;
}
// Reuse scratch vectors and GPU buffers. Idle arms need no vertex uploads;
// moving arms update only their existing surface, never allocate new meshes.
const wrist=new THREE.Vector3(),control=new THREE.Vector3(),center=new THREE.Vector3(),tangent=new THREE.Vector3();
const normal=new THREE.Vector3(),binormal=new THREE.Vector3(),radial=new THREE.Vector3(),axis=new THREE.Vector3(1,0,0);
function shapeArm(limb) {
  wrist.set(limb.side*.035,-.105,.025).applyQuaternion(limb.hand.quaternion).add(limb.hand.position);
  if(limb.lastWrist.distanceToSquared(wrist)<1e-12)return;
  limb.lastWrist.copy(wrist);
  const shoulder=limb.shoulder;
  control.copy(shoulder).lerp(wrist,.48);
  control.x+=limb.side*.18;control.y-=.16;
  const geometry=limb.arm.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal;
  for(let i=0;i<=ARM_RINGS;i++){
    const t=i/ARM_RINGS,u=1-t,r=ringRadius[i];
    center.copy(shoulder).multiplyScalar(u*u).addScaledVector(control,2*u*t).addScaledVector(wrist,t*t);
    tangent.copy(control).sub(shoulder).multiplyScalar(2*u).addScaledVector(wrist,2*t).addScaledVector(control,-2*t).normalize();
    binormal.crossVectors(tangent,axis).normalize();normal.crossVectors(binormal,tangent).normalize();
    // A gently oval section gives the forearm a broad back and softer edges.
    const slope=(ringRadius[Math.min(ARM_RINGS,i+1)]-ringRadius[Math.max(0,i-1)])*ARM_RINGS/2;
    const length=Math.max(.1,shoulder.distanceTo(wrist));
    for(let j=0;j<=ARM_SIDES;j++){
      const [c,s]=circumference[j],index=i*(ARM_SIDES+1)+j;
      radial.copy(normal).multiplyScalar(c).addScaledVector(binormal,s*.9);
      positions.setXYZ(index,center.x+radial.x*r,center.y+radial.y*r,center.z+radial.z*r);
      radial.copy(normal).multiplyScalar(c).addScaledVector(binormal,s/.9).addScaledVector(tangent,-slope/length).normalize();
      normals.setXYZ(index,radial.x,radial.y,radial.z);
    }
  }
  positions.needsUpdate=true;normals.needsUpdate=true;
}
export function updateArms(rig,progress,blaster=null,recoil=0,draw=1) {
  const pose=armPose(rig.userData.id,progress);
  rig.userData.progress=progress;
  for(const limb of rig.userData.limbs) {
    const target=new THREE.Vector3(...(limb.side<0?pose.left:pose.right));
    target.z+=recoil*.015;
    if(limb.side<0 && draw<1){
      const reach=1-smooth(clamp(draw/.8,0,1));
      target.y-=reach*.13;target.z+=reach*.18;
    }
    limb.hand.position.copy(target);
    limb.hand.rotation.set(-.15,limb.side<0?-.25:.15,limb.side<0?-.12:.12);
    shapeArm(limb);
  }
  const part=blaster?.userData.reloadPart;
  if(part) {
    part.userData.restPosition ||= part.position.clone();
    part.position.copy(part.userData.restPosition);
    if(progress>=.16&&progress<=.72) part.position.add(new THREE.Vector3(...pose.partOffset));
  }
  const token=blaster?.userData.reloadToken;
  if(token) {
    token.visible=progress>.16&&progress<.7;
    token.position.set(...pose.left);token.position.x+=.1;
  }
  return pose;
}
