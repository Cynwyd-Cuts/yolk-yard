import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {gun, clamp} from './data.js';

// Authored cartoon poses in blaster-local coordinates. The camera and other
// players use the same timeline, driven by the host's reload clock.
export const ARM_POSES = {
  sprinter: {right:[.095,-.24,.13], left:[-.10,-.14,-.43], socket:[-.10,-.33,-.10], drop:[-.34,-.75,.04], tilt:[-.18,0,-.32]},
  zipper:   {right:[.095,-.24,.13], left:[-.12,-.14,-.34], socket:[-.10,-.33,-.16], drop:[-.36,-.66,-.02], tilt:[-.12,0,-.4]},
  anchor:   {right:[.095,-.25,.20], left:[-.13,-.16,-.48], socket:[-.23,-.34,-.045], drop:[-.46,-.73,.04], tilt:[-.22,.12,-.24]},
  duet:     {right:[.095,-.24,-.03],left:[-.10,-.15,-.41], socket:[-.12,-.34,.35], drop:[-.38,-.68,.48], tilt:[-.15,-.12,-.35]},
  pip:      {right:[.09,-.23,.12],  left:[-.10,-.28,.12],  socket:[-.10,-.40,.12], drop:[-.32,-.73,.25], tilt:[-.12,.13,-.28]},
  needle:   {right:[.095,-.24,.13], left:[-.10,-.14,-.44], socket:[-.10,-.30,-.15],drop:[-.38,-.67,.02], tilt:[-.16,-.06,-.26]},
  scatter:  {right:[.11,-.25,.17],  left:[-.13,-.15,-.47], socket:[-.13,-.16,.04], drop:[-.37,-.65,.18], tilt:[-.26,.1,-.36]},
  thumper:  {right:[.11,-.25,.17],  left:[-.14,-.20,-.32], socket:[-.13,-.20,-.30],drop:[-.48,-.68,-.18],tilt:[-.1,.2,-.46]},
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
const sphere = new THREE.SphereGeometry(1,12,8),tube = new THREE.CylinderGeometry(1,1,1,12);
sphere.userData.shared=tube.userData.shared=true;
const handShapes=new Map();
function handGeometry(side) {
  if(handShapes.has(side)) return handShapes.get(side);
  const pieces=[];
  const add=(x,y,z,sx,sy,sz)=>{const g=sphere.clone();g.scale(sx,sy,sz);g.translate(x,y,z);pieces.push(g);};
  add(0,0,0,.085,.09,.075);
  // Three rounded curled fingers and an opposing thumb: a readable cartoon hand.
  for(let i=0;i<3;i++) {add(-side*.04,-.062+i*.052,-.055,.075,.022,.032);add(-side*.082,-.062+i*.052,-.027,.024,.022,.05);}
  add(-side*.065,.072,.015,.055,.032,.038);
  const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  geometry.userData.shared=true;handShapes.set(side,geometry);return geometry;
}
export function makeArms(id, shellColor='#fff6da', firstPerson=true) {
  const group=new THREE.Group();group.name='Animated egg arms';
  const material=new THREE.MeshStandardMaterial({color:shellColor,roughness:.48});
  const mesh=(geo)=>{const m=new THREE.Mesh(geo,material);m.castShadow=true;group.add(m);return m;};
  const limbs=[-1,1].map(side=>{
    const hand=mesh(handGeometry(side));hand.name=side<0?'Support hand':'Grip hand';
    const upper=mesh(tube),forearm=mesh(tube),elbow=mesh(sphere);elbow.scale.setScalar(.06);
    const shoulder=new THREE.Vector3(side<0?-.76:.34,firstPerson?-.66:-.4,firstPerson?.64:.48);
    return {side,hand,upper,forearm,elbow,shoulder};
  });
  limbs[0].hand.userData.ownedMaterial=true;
  group.userData={id,limbs,progress:-1};
  updateArms(group,-1);
  return group;
}
const up=new THREE.Vector3(0,1,0);
function segment(mesh,a,b,width) {
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  const delta=new THREE.Vector3().subVectors(b,a);
  mesh.scale.set(width,Math.max(.001,delta.length()),width);
  mesh.quaternion.setFromUnitVectors(up,delta.normalize());
}
export function updateArms(rig,progress,blaster=null,recoil=0) {
  const pose=armPose(rig.userData.id,progress);
  rig.userData.progress=progress;
  for(const limb of rig.userData.limbs) {
    const target=new THREE.Vector3(...(limb.side<0?pose.left:pose.right));
    target.z+=recoil*.015;
    const elbow=limb.shoulder.clone().lerp(target,.48);
    elbow.x+=limb.side*.07;elbow.y-=.07;
    limb.hand.position.copy(target);
    limb.hand.rotation.set(-.15,limb.side<0?-.25:.15,limb.side<0?-.12:.12);
    limb.elbow.position.copy(elbow);
    segment(limb.upper,limb.shoulder,elbow,.045);
    segment(limb.forearm,elbow,target,.052);
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
