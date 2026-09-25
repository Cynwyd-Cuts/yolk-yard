import * as THREE from 'three';
import {shopItem} from './shop-catalog.js';
function part(group,geometry,color,x=0,y=0,z=0,glow=false){
 const material=new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.38,...(glow?{emissive:color,emissiveIntensity:.3}:{})});
 const mesh=new THREE.Mesh(geometry,material);mesh.userData.ownedMaterial=true;mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
const box=(g,c,x,y,z,w,h,d)=>part(g,new THREE.BoxGeometry(w,h,d),c,x,y,z);
const orb=(g,c,x,y,z,r)=>part(g,new THREE.IcosahedronGeometry(r,1),c,x,y,z);
const ring=(g,c,x,y,z,r,t=.035)=>part(g,new THREE.TorusGeometry(r,t,8,32),c,x,y,z);
export function applyWrap(group,id){
 const item=shopItem(id);if(item?.slot!=='wrap')return group;let n=0;
 group.traverse(mesh=>{if(!mesh.isMesh||!mesh.material?.color||mesh.material.transparent||mesh===group.userData.lens)return;
  const material=mesh.material.clone();material.color.set(n++%3?item.color:item.accent);material.metalness=item.tier==='legendary'?.8:.4;
  if(item.set==='neon'||item.set==='starbound'){material.emissive?.set(item.accent);material.emissiveIntensity=n%3===0?.25:0;}
  mesh.material=material;mesh.userData.ownedMaterial=true;
 });return group;
}
export function makeShopPickaxe(id){
 const item=shopItem(id),g=new THREE.Group();if(item?.slot!=='pickaxe')return g;
 const c=item.color,a=item.accent,k=item.shape%6;
 part(g,new THREE.CylinderGeometry(.045,.065,1.25,12),c,0,.05,0);for(let j=0;j<5;j++)ring(g,a,0,-.39+j*.065,0,.063,.012).rotation.x=Math.PI/2;
 if(k===0){const crescent=part(g,new THREE.TorusGeometry(.38,.095,8,28,Math.PI*1.45),a,0,.6,0);crescent.rotation.z=-.7;orb(g,c,0,.6,0,.12);}
 if(k===1){box(g,c,0,.65,0,.58,.22,.24);for(let j=-1;j<=1;j++)part(g,new THREE.ConeGeometry(.085,.29,8),a,j*.22,.87,0);orb(g,a,0,.65,-.16,.09);}
 if(k===2){box(g,a,0,.7,0,.65,.11,.16);for(const x of [-.26,0,.26])box(g,c,x,.9,0,.085,.4,.12);}
 if(k===3){const crystal=part(g,new THREE.OctahedronGeometry(.35),a,0,.69,0,true);crystal.scale.set(1.6,.9,.6);box(g,c,0,.7,0,.2,.28,.27);}
 if(k===4){for(let j=0;j<6;j++){const angle=j*Math.PI/3;orb(g,a,Math.cos(angle)*.25,.75+Math.sin(angle)*.25,0,.16);}orb(g,c,0,.75,-.06,.17);}
 if(k===5){box(g,c,0,.65,0,.8,.22,.2);for(const x of [-.43,.43]){const hook=part(g,new THREE.ConeGeometry(.15,.38,10),a,x,.52,0);hook.rotation.z=Math.sign(x)*2.35;}}
 g.name=item.name;return g;
}
export function makeShopBack(id){
 const item=shopItem(id),g=new THREE.Group();if(item?.slot!=='backbling')return g;
 const c=item.color,a=item.accent,k=item.shape%6;
 box(g,c,0,0,0,.46,.58,.22);
 if(k===0){for(const x of [-.25,.25]){part(g,new THREE.CylinderGeometry(.11,.11,.5,12),a,x,0,0);part(g,new THREE.ConeGeometry(.095,.2,12),a,x,-.34,0,true).rotation.z=Math.PI;}orb(g,a,0,.1,.17,.12);}
 if(k===1){const plate=part(g,new THREE.CylinderGeometry(.32,.24,.09,6),a,0,0,.17);plate.rotation.x=Math.PI/2;orb(g,c,0,0,.25,.12);}
 if(k===2){ring(g,a,0,0,.19,.2);orb(g,a,0,0,.21,.14);for(let j=0;j<3;j++)box(g,a,0,-.19+j*.15,.16,.38,.035,.045);}
 if(k===3){for(let j=0;j<5;j++){const crystal=part(g,new THREE.OctahedronGeometry(.18),a,(j-2)*.11,.1+Math.sin(j)*.12,.17,true);crystal.scale.y=1.8;}}
 if(k===4){for(let j=0;j<3;j++){part(g,new THREE.CylinderGeometry(.018,.018,.35,6),a,(j-1)*.14,.35,0);orb(g,j%2?c:a,(j-1)*.14,.55,.02,.13);}}
 if(k===5){const shell=part(g,new THREE.SphereGeometry(.3,16,10),a,0,0,.1);shell.scale.set(1,1.1,.5);for(let j=-2;j<=2;j++)box(g,c,j*.09,0,.25,.025,.4,.035);}
 return g;
}
export function addShopOutfit(group,profile){
 const item=shopItem(profile.outfit);if(!item)return;
 const a=item.accent,k=item.shape%4;
 if(k===0){const halo=ring(group,a,0,1.72,0,.44);halo.rotation.x=Math.PI/2;}
 if(k===1){for(const x of [-.43,.43])box(group,a,x,.9,0,.15,.28,.28);}
 if(k===2){for(const x of [-.32,.32])box(group,a,x,1.26,-.24,.065,.19,.08);}
 if(k===3){const gem=part(group,new THREE.OctahedronGeometry(.105),a,0,.65,-.45,true);gem.scale.y=1.3;}
}
export function makeShopGlider(id){
 const item=shopItem(id),g=new THREE.Group();if(item?.slot!=='glider')return g;
 const c=item.color,a=item.accent,k=item.shape%4;
 if(k===0){const sail=part(g,new THREE.ConeGeometry(2.05,.75,12,1,true),c,0,3.2,0);sail.material.side=THREE.DoubleSide;ring(g,a,0,2.84,0,2.05,.045).rotation.x=Math.PI/2;}
 if(k===1){for(const side of [-1,1])for(let j=0;j<4;j++){const wing=box(g,j%2?c:a,side*(.7+j*.4),3-j*.09,.15+j*.12,.75,.13,1.6-j*.22);wing.rotation.z=side*.17;}orb(g,a,0,3,0,.28);}
 if(k===2){const kite=part(g,new THREE.OctahedronGeometry(1.8,0),c,0,3,0);kite.scale.set(1.25,.08,.8);box(g,a,0,3.12,0,3.5,.055,.07);}
 if(k===3){const dome=part(g,new THREE.SphereGeometry(1.9,16,8,0,Math.PI*2,0,Math.PI/2),c,0,2.8,0);dome.scale.y=.4;dome.material.side=THREE.DoubleSide;for(const side of [-1,1])box(g,a,side*1.4,3,.0,.25,.2,2);}
 for(const x of [-.7,.7])for(const z of [-.4,.4]){const wire=part(g,new THREE.CylinderGeometry(.014,.014,1.35,6),a,x,2.1,z);wire.rotation.z=-x*.18;}
 return g;
}
export function makeShopTrail(id){
 const item=shopItem(id),g=new THREE.Group();if(item?.slot!=='trail')return g;
 for(const x of [-.5,.5]){const mesh=part(g,new THREE.ConeGeometry(.11,2.5,8),item.accent,x,1.8,.25,true);mesh.material.transparent=true;mesh.material.opacity=.6;mesh.material.depthWrite=false;}
 return g;
}
