import * as THREE from 'three';
import {shopItem} from './shop-catalog.js';
import {actionArms} from './arms.js';

// Shape families share choreography across color variants. All complete inside
// the existing .45s harvest cadence; these poses never change damage or reach.
export const PICKAXE_STYLES=['crescent','hammer','fork','crystal','staff','hook'];
export function pickaxeStyle(id){const item=shopItem(id);return item?.slot==='pickaxe'?PICKAXE_STYLES[item.shape%6]:'classic';}
const styles={
 classic:{wind:[.55,-.2,-.6],strike:[-1.6,.1,.35],end:[-1.85,.2,.55],offset:[-.27,-.13,-.32]},
 crescent:{wind:[.25,-.8,-.95],strike:[-1.35,.65,.7],end:[-1.65,.9,1.05],offset:[-.4,-.05,-.28]},
 hammer:{wind:[.85,0,-.15],strike:[-1.65,0,.08],end:[-1.95,0,.12],offset:[-.2,-.22,-.38]},
 fork:{wind:[.1,-.2,-.1],strike:[-1.5,0,-.08],end:[-1.55,.05,-.12],offset:[-.25,.03,-.6]},
 crystal:{wind:[.65,-.4,-.65],strike:[-1.6,.2,.55],end:[-1.9,.35,.8],offset:[-.32,-.18,-.38]},
 staff:{wind:[.25,-.65,.5],strike:[-1.2,.5,-.6],end:[-1.5,.8,-.9],offset:[-.37,.05,-.35]},
 hook:{wind:[.4,-.7,-.8],strike:[-1.55,.6,.5],end:[-1.9,.8,.85],offset:[-.38,-.1,-.3]},
};
const rest=[-.15,0,-.22],zero=[0,0,0];
function path(points,t){for(let i=1;i<points.length;i++)if(t<=points[i][0]){const [a,p]=points[i-1],[b,q]=points[i];const x=Math.max(0,Math.min(1,(t-a)/(b-a))),f=x*x*(3-2*x);return p.map((v,j)=>v+(q[j]-v)*f);}return [...points.at(-1)[1]];}
export function pickaxePose(id,age){
 const style=pickaxeStyle(id),s=styles[style],t=age>=0&&age<.45?age/.45:0;
 return {style,rotation:path([[0,rest],[.22,s.wind],[.48,s.strike],[.62,s.end],[1,rest]],t),offset:path([[0,zero],[.22,[.08,.17,.07]],[.48,s.offset],[.62,s.offset.map(v=>v*1.08)],[1,zero]],t)};
}
const grip=new THREE.Vector3();
export function animatePickaxe(tool,arms,id,age){
 const pose=pickaxePose(id,age);
 tool.scale.setScalar(.85);
 tool.rotation.set(...pose.rotation);
 tool.position.set(-.03+pose.offset[0],.03+pose.offset[1],-.25+pose.offset[2]);
 tool.updateMatrix();
 if(arms){
  // Both hands remain attached to distinct points on the moving shaft.
  const targets=[-.05,-.38].map(y=>grip.set(0,y,0).applyMatrix4(tool.matrix).toArray());
  actionArms(arms,targets);
  for(const limb of arms.userData.limbs){limb.hand.quaternion.copy(tool.quaternion);limb.hand.rotateY(limb.side*Math.PI/2);}
 }
 return pose;
}
