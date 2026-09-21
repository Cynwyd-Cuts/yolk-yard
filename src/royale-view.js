import {makeArms,actionArms} from './arms.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {transportAt} from './royale-data.js';
import {artKit,buildingStyle,dressBuilding,treeModel,propModel,gliderModel,chestModel,lootModel,launchpadModel} from './royale-art.js';
const bakedMaterial=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});

export function bake(group,chunked=false,colored=chunked){
 group.updateMatrixWorld(true);const batches=new Map();
 for(const o of [...group.children])if(o.isMesh&&!o.userData.ownedMaterial&&!o.userData.keepDynamic){
  const key=(colored?'color':o.material.uuid)+(chunked?':'+Math.floor(o.position.x/64)+':'+Math.floor(o.position.z/64):'');if(!batches.has(key))batches.set(key,{mat:colored?bakedMaterial:o.material,parts:[]});
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
  if(colored){g.deleteAttribute('uv');const colors=new Float32Array(g.attributes.position.count*3),c=o.material.color;for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));}
  batches.get(key).parts.push(g);group.remove(o);
  if(o.geometry.type==='CylinderGeometry'&&!o.geometry.userData.shared)o.geometry.dispose();
 }
 for(const b of batches.values()){const geometry=mergeGeometries(b.parts);geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,b.mat);b.parts.forEach(g=>g.dispose());mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);}
}
function buildTerrain(world,map){
 const t=map.terrain,material=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});
 for(let cz=0;cz<t.n-1;cz+=32)for(let cx=0;cx<t.n-1;cx+=32){
  const positions=[],colors=[],indices=[];
  for(let z=0;z<=32;z++)for(let x=0;x<=32;x++){
   const wx=(cx+x)*t.cell-t.size,wz=(cz+z)*t.cell-t.size,h=t.heights[(cz+z)*t.n+cx+x];positions.push(wx,h,wz);
   const c=new THREE.Color(h>3?0x95ad79:0x83ad73);c.multiplyScalar(1+Math.sin(wx*.07)*Math.sin(wz*.09)*.045);colors.push(c.r,c.g,c.b);
  }
  for(let z=0;z<32;z++)for(let x=0;x<32;x++){const a=z*33+x;indices.push(a,a+33,a+1,a+1,a+33,a+34);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const m=new THREE.Mesh(geometry,material);m.receiveShadow=true;m.userData.ownedMaterial=true;world.add(m);
 }
}
export function islandLabel(text,size=1){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const c=canvas.getContext('2d');c.font='800 34px system-ui';c.textAlign='center';c.lineWidth=8;c.strokeStyle='#23443ae6';c.fillStyle='#fff8de';c.strokeText(text.toUpperCase(),256,60);c.fillText(text.toUpperCase(),256,60);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthWrite:false}));sprite.scale.set(24*size,4.5*size,1);return sprite;
}
export function buildIsland(world,map,kit){
 const {block,ball,cylinder,palette}=kit,{beam,cone,rock,torus}=artKit(kit);
 block(world,0,-1.6,0,1800,2,1800,0x398aab);
 block(world,0,-.68,0,532,.65,532,0xecd99a);
 buildTerrain(world,map);
 for(const p of map.districts){
  cylinder(world,p.x,.015,p.z,15,.025,p.kind==='dock'?0x85a5a0:p.kind==='camp'?0xacb5a0:p.kind==='farm'?0xb1ba72:0xaac290,48);
  // Roads connect the center and districts with a narrow warm shoulder.
  const length=Math.hypot(p.x,p.z);
  if(length>0){const road=block(world,p.x/2,.15,p.z/2,8,.08,length,0xc6bd99);road.rotation.y=Math.atan2(p.x,p.z);}
 }
 for(const b of map.boxes){
  if(['landmark','tree','prop'].includes(b.kind))continue;
  const style=b.building===undefined?null:buildingStyle(map.buildings[b.building]);
  block(world,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,style?(b.color==='stone'?style.roof:style.wall):palette[b.color]||0x79aead);
 }
 for(const b of map.buildings)dressBuilding(world,b,kit);
 for(const t of map.trees)treeModel(world,t,kit);
 for(const p of map.props)propModel(world,p,kit);
 for(const s of map.shelters){
  for(let j=0;j<7;j++)block(world,s.x-3.6+j*1.2,3.62,s.z,.96,.13,9.6,j%2?0xefca80:0xf5e6bc);
  for(const sign of [-1,1])beam(world,[s.x+sign*3.8,2.5,s.z+4],[s.x+sign*2.4,3.35,s.z+4],.1,0x816a51);
 }
 for(const p of map.districts){
  if(p.kind==='farm'){
   for(let i=0;i<6;i++)for(let j=0;j<7;j++){const x=p.x-11+i*4,z=p.z-11+j*3.3;if(Math.hypot(x-p.x,z-p.z)<4)continue;cone(world,x,.6,z,.25,1.2,0xc4b15d);for(const side of [-1,1]){const leaf=rock(world,x+side*.3,.5,z,.5,.13,.15,0x8e9b50);leaf.rotation.z=side*.4;}}
   for(const dx of [-8,8]){cylinder(world,p.x+dx,7,p.z-36,3,14,0xb8c1ae,20);cone(world,p.x+dx,14.7,p.z-36,3.1,1.4,0x536f76);for(let yy=1;yy<14;yy+=2){const r=torus(world,p.x+dx,yy,p.z-36,3.03,.07,0x7f9793);r.rotation.x=Math.PI/2;}for(let yy=.5;yy<14;yy+=.6)block(world,p.x+dx,yy,p.z-39.06,.65,.08,.1,0xf1d49a);}
  } else if(p.kind==='dock'){
   for(let j=0;j<7;j++)for(let k=0;k<12;k++)block(world,p.x-34+j*10,.1,p.z+37+k*1.4,8,.2,1.32,k%2?0xa98b61:0x937c60);
   for(const dx of [-38,38]){cylinder(world,p.x+dx,12,p.z+15,.8,24,0xedc55a);block(world,p.x+dx,24,p.z+8,2,1.1,22,0xf4cb65);for(let yy=2;yy<23;yy+=3){beam(world,[p.x+dx-.65,yy,p.z+15],[p.x+dx+.65,yy+2.5,p.z+15],.06,0x7b7865);}beam(world,[p.x+dx,25,p.z+15],[p.x+dx,24,p.z-3],.09,0x516f78);beam(world,[p.x+dx,24,p.z-2],[p.x+dx,11,p.z-2],.045,0x516f78);const hook=torus(world,p.x+dx,10.5,p.z-2,.45,.12,0x516f78);}
  } else if(p.kind==='resort'){
   cylinder(world,p.x,0.08,p.z,10,.15,0xf6dfa9,48);cylinder(world,p.x,.18,p.z,8,.1,0x65cbd4,48);cylinder(world,p.x,1,p.z,.5,2,0xd5e7d0);
   for(let j=0;j<16;j++){const a=j*Math.PI/8;const m=block(world,p.x+Math.cos(a)*9,.2,p.z+Math.sin(a)*9,1.4,.12,.5,0xffedc6);m.rotation.y=-a+Math.PI/2;}
  } else if(p.kind==='factory'){
   for(const dx of [-8,8]){cylinder(world,p.x+dx,6,p.z-38,4,12,0x8099a2);cone(world,p.x+dx,12.9,p.z-38,4.1,1.8,0xb5bbb0,.35);for(const yy of [1,5,10]){const r=torus(world,p.x+dx,yy,p.z-38,4.05,.12,0xdac587);r.rotation.x=Math.PI/2;}for(let j=0;j<8;j++)block(world,p.x+dx-.7+j*.2,7,p.z-42.04,.12,1.1,.1,j%2?0x3c5866:0xf0cf70);}
  } else if(p.kind==='camp'){
   for(let j=0;j<9;j++){const a=j*Math.PI*2/9;rock(world,p.x+Math.cos(a)*11,.8,p.z+Math.sin(a)*11,2,1.5,2,j%2?0xaaa99c:0x8b968b,1);}
  } else if(p.kind==='town'){
   // Clock tower is decorative above its collision-matched solid central pedestal.
   block(world,p.x,3,p.z-6,3.3,6,3.3,0xe9d6a8);cone(world,p.x,7,p.z-6,2.5,2,0x507c7b);
   for(const dz of [-1.7,1.7]){const dial=cylinder(world,p.x,4.7,p.z-6+dz,.95,.09,0xffebbb,24);dial.rotation.x=Math.PI/2;block(world,p.x,4.95,p.z-6+dz*1.04,.075,.5,.035,0x4b6c70);block(world,p.x+.22,4.7,p.z-6+dz*1.04,.45,.075,.035,0x4b6c70);}
  }
 }
 // Long shoreline strips and wavelets frame the playable island.
 for(let i=0;i<48;i++){
  const a=i*Math.PI*2/48,x=Math.cos(a)*390,z=Math.sin(a)*390;
  block(world,x,-.45,z,20,.02,1.5,0x7ec5d4);
 }
 bake(world,true);
 for(const p of map.districts){const text=islandLabel(p.name);text.position.set(p.x,15,p.z);world.add(text);}
}
function canopy(kit,color=0xffcf64){const g=gliderModel(kit,color);bake(g,false,true);return g;}
export class RoyaleView{
 constructor(view,kit){this.view=view;this.kit=kit;this.root=new THREE.Group();view.scene.add(this.root);this.chests=new Map();this.loot=new Map();this.gliders=new Map();this.pads=new Map();this.createTransport();this.createStorm();this.marker=null;this.fx=[];}
 createTransport(){
  const {block,ball,cylinder,mat,rounded,beam,torus,cone}=artKit(this.kit),g=this.transport=new THREE.Group();g.name='Eggspress island airship';this.root.add(g);
  for(let i=0;i<12;i++){
   const skin=new THREE.Mesh(new THREE.SphereGeometry(1,8,20,i*Math.PI/6,Math.PI/6),mat(i%3===0?0xf9dfa0:i%2?0xf1be4f:0xffd46a));skin.position.set(0,10,0);skin.scale.set(6.4,6.4,9);g.add(skin);
  }
  for(const z of [-6,0,6]){const hoop=torus(g,0,10,z,z===0?6.45:4.83,.045,0xe9b45a);hoop.scale.y=1;}
  rounded(g,0,.1,0,7.2,2.1,13.2,0x357e86,.6);rounded(g,0,1.25,0,7.7,.3,13.7,0xf7dc9f,.15);
  rounded(g,0,-.95,0,6.5,.35,11.8,0x294f63,.12);
  for(const x of [-3.7,3.7]){
   for(const z of [-5,-2.5,0,2.5,5]){beam(g,[x,1.4,z],[x,2.4,z],.065,0xf6e3b0);rounded(g,x,.2,z, .06,.6,1.45,0xaddcda,.12);}
   beam(g,[x,2.4,-6],[x,2.4,6],.085,0xf6e3b0);
   for(const z of [-4,4])beam(g,[x,1.4,z],[x*1.2,7.1,z*1.3],.06,0x536e76);
  }
  for(const x of [-2.5,2.5])for(const z of [-3,0,3]){rounded(g,x,1.62,z,1.35,.48,1.5,0xe8ba69,.22);rounded(g,x*1.12,2,z,.3,1.15,1.5,0x488f97,.12);}
  rounded(g,0,2,-6.7,4.2,2.4,2.7,0x4b9ca1,.4);rounded(g,0,2.3,-8.1,3.65,1.2,.12,0xa9dfe0,.1);block(g,0,2.3,-8.18,.15,1.3,.06,0xf5d398);
  for(const x of [-1.45,1.45]){ball(g,x,1.18,-8.05,.3,.25,.16,0xffe7a5);rounded(g,x,2,-5.45,.65,1.3,.12,0x2e596b,.06);}
  for(const x of [-1,1]){const fin=block(g,x*4.3,10,8,4.2,.18,3.6,0x438d96);fin.rotation.z=x*.22;}
  const tail=block(g,0,13,8.2,.22,5.8,3.8,0x3f8790);tail.rotation.x=-.25;
  const title=islandLabel('EGGSPRESS',.45);title.position.set(0,3.8,-6.2);g.add(title);
  this.rotors=[];for(const x of [-6.5,6.5]){
   beam(g,[x*.45,.1,0],[x,1.2,0],.24,0xe6c48e);rounded(g,x,.9,0,1.25,1.2,2.2,0x406577,.25);cylinder(g,x,1.65,0,.32,.55,0xf0cd7d,12);
   const r=new THREE.Group();r.position.set(x,1.95,0);
   for(let i=0;i<4;i++){const a=i*Math.PI/2,m=rounded(r,Math.cos(a)*1.65,0,Math.sin(a)*1.65,2.9,.09,.4,0x315465,.04);m.rotation.y=-a;}
   bake(r,false,true);g.add(r);this.rotors.push(r);
  }
  bake(g,false,true);
 }
 createStorm(){
  const material=new THREE.MeshBasicMaterial({color:0x9461e9,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false});
  this.wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,200,160,1,true),material);this.wall.position.y=90;this.wall.userData.ownedMaterial=true;this.root.add(this.wall);
  this.ring=new THREE.Mesh(new THREE.TorusGeometry(1,.005,4,160),new THREE.MeshBasicMaterial({color:0xc9a5ff}));this.ring.rotation.x=Math.PI/2;this.ring.userData.ownedMaterial=true;this.root.add(this.ring);
 }
 itemModel(item,ground=true){const g=lootModel(item,this.kit,{ground});bake(g,false,true);return g;}
 chestModel(supply=false){const g=chestModel(this.kit,supply);bake(g.userData.lid,false,true);bake(g,false,true);return g;}
 update(state,local,dt,playing){
  this.root.visible=playing&&!!state?.royale;if(!this.root.visible)return;
  const r=state.royale,t=this.view.clock,kit=this.kit;
  const roundKey=r.matchId+':'+state.round;
  if(this.round!==roundKey){for(const group of [this.chests,this.loot,this.gliders,this.pads]){for(const mesh of group.values()){this.root.remove(mesh);this.view.disposeGroup(mesh);}group.clear();}this.round=roundKey;}
  this.transport.visible=r.elapsed<=r.route.duration+5;
  const pos=transportAt(r.route,r.elapsed);this.transport.position.set(pos.x,pos.y+Math.sin(t)*.18,pos.z);this.transport.rotation.y=pos.yaw;this.transport.rotation.z=Math.sin(t*.4)*.015;this.rotors.forEach(m=>m.rotation.y+=dt*18);
  this.wall.visible=this.ring.visible=r.storm.active;this.wall.position.set(r.storm.x,85,r.storm.z);this.wall.scale.set(Math.max(.01,r.storm.radius),1,Math.max(.01,r.storm.radius));this.wall.material.opacity=.17+Math.sin(t*.5)*.035;this.ring.position.set(r.storm.x,.15,r.storm.z);this.ring.scale.setScalar(Math.max(.01,r.storm.radius));
  const observer=local?.spectating?state.players.find(p=>p.id===this.view.spectateTarget)||local:local;
  const seen=new Set();
  for(const item of r.loot){
   seen.add(item.uid);let mesh=this.loot.get(item.uid);
   const close=observer&&Math.hypot(item.x-observer.x,item.z-observer.z)<(this.view.settings.quality==='low'?45:70);
   if(!mesh&&close){mesh=this.itemModel(item);this.loot.set(item.uid,mesh);this.root.add(mesh);}
   if(mesh){mesh.visible=!!close;mesh.position.set(item.x,item.y+.7+Math.sin(t*2+item.uid)*.1,item.z);mesh.rotation.y=t*.65+item.uid;}
  }
  for(const [id,m]of this.loot)if(!seen.has(id)){this.root.remove(m);this.view.disposeGroup(m);this.loot.delete(id);}
  for(const chest of r.chests){
   let mesh=this.chests.get(chest.id);if(!mesh){mesh=this.chestModel(chest.supply);this.chests.set(chest.id,mesh);this.root.add(mesh);if(chest.supply){const rig=new THREE.Group(),c=canopy(kit,0x99dad9);c.position.y=1.5;rig.add(c);for(const x of [-.6,.6])for(const z of [-.4,.4])artKit(kit).beam(rig,[x,1.2,z],[Math.sign(x)*.72,3.7,.1],.018,0xf5ead2);bake(rig,false,true);mesh.add(rig);mesh.userData.canopy=rig;}}
   const fall=chest.landAt?Math.max(0,(chest.landAt-state.time)*4):0;mesh.position.set(chest.x,chest.y+fall,chest.z);
   if(mesh.userData.canopy)mesh.userData.canopy.visible=fall>0;
   mesh.userData.lid.rotation.x+=((chest.opened?-1.7:0)-mesh.userData.lid.rotation.x)*Math.min(1,dt*8);
   mesh.userData.glow.visible=!chest.opened;mesh.userData.glow.scale.setScalar(1+Math.sin(t*3)*.25);
   mesh.visible=!!observer&&(Math.hypot(chest.x-observer.x,chest.z-observer.z)<(this.view.settings.quality==='low'?70:100)||chest.supply);
  }
  for(const p of state.players){
   let mesh=this.gliders.get(p.id);if(!mesh&&p.flight==='glide'){mesh=canopy(kit);this.gliders.set(p.id,mesh);this.root.add(mesh);}
   if(mesh){mesh.visible=p.health>0&&p.flight==='glide';mesh.position.set(p.x,p.y,p.z);mesh.rotation.set(Math.sin(t*2)*.02,p.yaw,Math.sin(t*1.6)*.04);}
  }
  const padIds=new Set();for(const p of r.pads){padIds.add(p.id);let mesh=this.pads.get(p.id);if(!mesh){mesh=launchpadModel(kit);bake(mesh);this.root.add(mesh);this.pads.set(p.id,mesh);}mesh.position.set(p.x,p.y,p.z);mesh.scale.setScalar(1+Math.sin(t*3)*.035);}
  for(const [id,m]of this.pads)if(!padIds.has(id)){this.root.remove(m);this.view.disposeGroup(m);this.pads.delete(id);}
  for(let i=this.fx.length-1;i>=0;i--){const fx=this.fx[i];fx.age+=dt;fx.mesh.scale.setScalar(1+fx.age*9);fx.mesh.material.opacity=Math.max(0,.8-fx.age);if(fx.age>.8){this.root.remove(fx.mesh);fx.mesh.geometry.dispose();fx.mesh.material.dispose();this.fx.splice(i,1);}}
  if(this.view.waypoint){if(!this.marker){this.marker=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,90,8),new THREE.MeshBasicMaterial({color:0xffe59c,transparent:true,opacity:.5,depthWrite:false}));this.marker.userData.ownedMaterial=true;this.root.add(this.marker);}this.marker.visible=true;this.marker.position.set(this.view.waypoint.x,45,this.view.waypoint.z);}else if(this.marker)this.marker.visible=false;
 }
 event(e){
  if(!this.root.visible)return;
  if(e.type==='royale-fx'||e.type==='royale-cue'&&['shield-break','complete-splash','launch','chest-open'].includes(e.cue)){
   const color=e.kind==='splash'||e.cue==='complete-splash'?0x73e8d4:e.cue==='chest-open'?0xffd574:0xb6a5ff;
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.045,6,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.set(e.x||0,(e.y||0)+.3,e.z||0);ring.userData.ownedMaterial=true;this.root.add(ring);this.fx.push({mesh:ring,age:0});
  }
 }
 animateActor(model,p,t){
  const flying=p.flight==='dive'||p.flight==='glide'||p.flight==='launch';
  if(model.userData.held)model.userData.held.visible=!flying&&!!p.inventory?.[p.slot]?.weapon;
  if(model.userData.blaster)model.userData.blaster.visible=!flying&&!!p.inventory?.[p.slot]?.weapon;
  if(!model.userData.flightArms){const arms=makeArms('pip',p,false);arms.position.y=1.1;arms.scale.setScalar(.85);for(const limb of arms.userData.limbs)limb.shoulder.set(limb.side*.5,0,.04);model.add(arms);model.userData.flightArms=arms;}
  const arms=model.userData.flightArms,item=p.inventory?.[p.slot];arms.visible=flying||!item?.weapon;
  const reach=p.flight==='glide'?[[ -.9,1.25,-.2],[.9,1.25,-.2]]:flying?[[-1.25,-.12,-.25],[1.25,-.12,-.25]]:p.use?[[-.3,.12,-.65],[.3,.16+Math.sin(t*7)*.035,-.65]]:[[-.56,-.45,-.15],[.56,-.45,-.15]];
  if(arms.visible)actionArms(arms,reach,p.flight==='glide'?-1.3:-.2);
  const itemKey=!flying&&item&&!item.weapon?item.id:null;
  if(model.userData.utilityKey!==itemKey){if(model.userData.utility){model.userData.utility.removeFromParent();this.view.disposeGroup(model.userData.utility);}model.userData.utility=null;model.userData.utilityKey=itemKey;if(itemKey){const prop=this.itemModel(item,false);prop.scale.setScalar(.6);prop.position.set(.36,.7,-.35);model.add(prop);model.userData.utility=prop;}}
  if(model.userData.utility){model.userData.utility.position.y=p.use?1.15+Math.sin(t*7)*.02:.7;}

  if(flying){model.rotation.x=p.flight==='dive'?.85:.1;model.rotation.z=Math.sin(t*3)*.05;}
  else if(p.sprinting){model.rotation.x=.17;model.rotation.z=Math.sin(t*9)*.16;}
  if(p.place===1&&p.health>0){model.position.y+=Math.max(0,Math.sin(t*5))*.5;model.rotation.y+=Math.sin(t*2)*.15;}
 }
}
