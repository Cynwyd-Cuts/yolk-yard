import {makeArms,actionArms} from './arms.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ITEMS,RARITIES,transportAt} from './royale-data.js';
import {weapon} from './data.js';

function bake(group){
 group.updateMatrixWorld(true);const batches=new Map();
 for(const o of [...group.children])if(o.isMesh&&!o.userData.ownedMaterial){
  const key=o.material.uuid;if(!batches.has(key))batches.set(key,{mat:o.material,parts:[]});
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);batches.get(key).parts.push(g);group.remove(o);
  if(o.geometry.type==='CylinderGeometry'&&!o.geometry.userData.shared)o.geometry.dispose();
 }
 for(const b of batches.values()){const mesh=new THREE.Mesh(mergeGeometries(b.parts),b.mat);b.parts.forEach(g=>g.dispose());mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);}
}
export function islandLabel(text,size=1){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const c=canvas.getContext('2d');c.font='800 34px system-ui';c.textAlign='center';c.lineWidth=8;c.strokeStyle='#23443ae6';c.fillStyle='#fff8de';c.strokeText(text.toUpperCase(),256,60);c.fillText(text.toUpperCase(),256,60);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthWrite:false}));sprite.scale.set(24*size,4.5*size,1);return sprite;
}
export function buildIsland(world,map,kit){
 const {block,ball,cylinder,mat,palette}=kit;
 block(world,0,-1.6,0,1800,2,1800,0x398aab);
 block(world,0,-.68,0,532,.65,532,0xecd99a);
 block(world,0,-.12,0,512,.24,512,0x82b47c);
 for(const p of map.districts){
  cylinder(world,p.x,.065,p.z,46,.12,p.kind==='dock'?0x85a5a0:p.kind==='camp'?0xacb5a0:p.kind==='farm'?0xb1ba72:0xaac290,64);
  // Roads connect the center and districts with a narrow warm shoulder.
  const length=Math.hypot(p.x,p.z);
  if(length>0){const road=block(world,p.x/2,.15,p.z/2,8,.08,length,0xc6bd99);road.rotation.y=Math.atan2(p.x,p.z);}
 }
 for(const b of map.boxes){if(b.kind==='landmark')continue;block(world,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,palette[b.color]||0x79aead);}
 for(const b of map.buildings){
  for(const sign of [-1,1]){
   for(const dz of [-3,2]){
    block(world,b.x+sign*(b.w/2+.37),2.8,b.z+dz,.05,1.5,1.6,0x3a6975);
    block(world,b.x+sign*(b.w/2+.4),2.8,b.z+dz,.06,.08,1.7,0xffe4b1);
   }
  }
  const awning=block(world,b.x,3.1,b.z+7,6,.16,2.5,0xf8d36b);awning.rotation.x=.08;
  block(world,b.x,3.15,b.z+8.1,6,.45,.12,0xfbf1d1);
  block(world,b.x+2.5,.12,b.z,5.8,.06,10,0xcfb88d);
 }
 for(const t of map.trees){
  for(let j=0;j<3;j++)ball(world,t.x+(j-1)*1.5,t.h-.6+j*.6,t.z,2.6,2.2,2.7,[0x5c976e,0x6ca778,0x80b67c][t.kind]);
 }
 for(const p of map.districts){
  if(p.kind==='farm'){
   for(let i=0;i<8;i++)for(let j=0;j<8;j++)ball(world,p.x-12+i*3,.45,p.z-12+j*3,.65,.6,.65,0xd3c367);
   for(const dx of [-8,8]){cylinder(world,p.x+dx,7,p.z-36,3,14,0xb8c1ae,20);ball(world,p.x+dx,14,p.z-36,3,1.3,3,0xeddfb4);}
  } else if(p.kind==='dock'){
   for(let j=0;j<7;j++)block(world,p.x-34+j*10,.1,p.z+45,8,.2,18,0x937c60);
   for(const dx of [-38,38]){cylinder(world,p.x+dx,12,p.z+15,.8,24,0xedc55a);block(world,p.x+dx,24,p.z+8,2,1.1,22,0xf4cb65);}
  } else if(p.kind==='resort'){
   cylinder(world,p.x,0.08,p.z,10,.15,0xf6dfa9,48);cylinder(world,p.x,.18,p.z,8,.1,0x65cbd4,48);cylinder(world,p.x,1,p.z,.5,2,0xd5e7d0);
  } else if(p.kind==='factory'){
   for(const dx of [-8,8]){cylinder(world,p.x+dx,6,p.z-38,4,12,0x8099a2);cylinder(world,p.x+dx,12.2,p.z-38,4.4,.4,0xc6d4cd);}
  } else if(p.kind==='camp'){
   for(let j=0;j<9;j++){const a=j*Math.PI*2/9;ball(world,p.x+Math.cos(a)*11,.8,p.z+Math.sin(a)*11,2,1.5,2,0xaaa99c);}
  } else if(p.kind==='town'){
   // Clock tower is decorative above its collision-matched solid central pedestal.
   cylinder(world,p.x,3,p.z-6,2,6,0xe9d6a8);ball(world,p.x,6.6,p.z-6,2.3,.8,2.3,0xeebf55);
  }
 }
 // Long shoreline strips and wavelets frame the playable island.
 for(let i=0;i<48;i++){
  const a=i*Math.PI*2/48,x=Math.cos(a)*390,z=Math.sin(a)*390;
  block(world,x,-.45,z,20,.02,1.5,0x7ec5d4);
 }
 bake(world);
 for(const p of map.districts){const text=islandLabel(p.name);text.position.set(p.x,15,p.z);world.add(text);}
}
function canopy(kit,color=0xffcf64){
 const {ball,block,cylinder}=kit,g=new THREE.Group();
 ball(g,0,3,0,2.1,.48,1.5,color);
 for(const x of [-1.5,1.5])for(const z of [-.9,.9]){
  const line=cylinder(g,x/2,1.85,z/2,.018,2.5,0xf4eed2,6);line.rotation.z=-x*.23;line.rotation.x=z*.25;
 }
 block(g,0,.6,.2,.85,.25,.35,0x548c89);return g;
}
export class RoyaleView{
 constructor(view,kit){this.view=view;this.kit=kit;this.root=new THREE.Group();view.scene.add(this.root);this.chests=new Map();this.loot=new Map();this.gliders=new Map();this.pads=new Map();this.createTransport();this.createStorm();this.marker=null;this.fx=[];}
 createTransport(){
  const {block,ball,cylinder}=this.kit,g=this.transport=new THREE.Group();this.root.add(g);
  ball(g,0,10,0,6.5,7,8,0xf2c74f);ball(g,-1,12,-1,4.3,4.2,5,0xffd966);
  block(g,0,0,0,7,2,13,0x367f80);block(g,0,1.2,0,7.4,.25,13.5,0xf5e7bc);
  for(const x of [-2.7,2.7])for(const z of [-4.5,0,4.5]){ball(g,x,1.3,z,1.1,.65,1.4,0xeedcaf);const cable=cylinder(g,x,5,z,.045,8,0x324c59,8);cable.rotation.z=-x*.08;}
  block(g,0,1,-7,4,2,2.5,0x4b9b9a);block(g,0,1.4,-8.3,3.3,1,.08,0xb6e5e6);
  const title=islandLabel('EGGSPRESS',.45);title.position.set(0,3,-6);g.add(title);
  this.rotors=[];for(const x of [-6,6]){block(g,x*.65,.2,0,6,.3,1,0xf5db93);const r=new THREE.Group();r.position.set(x,1,0);block(r,0,0,0,5,.1,.4,0x294f63);block(r,0,0,0,.4,.1,5,0x294f63);g.add(r);this.rotors.push(r);}
 }
 createStorm(){
  const material=new THREE.MeshBasicMaterial({color:0x9461e9,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false});
  this.wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,200,160,1,true),material);this.wall.position.y=90;this.wall.userData.ownedMaterial=true;this.root.add(this.wall);
  this.ring=new THREE.Mesh(new THREE.TorusGeometry(1,.005,4,160),new THREE.MeshBasicMaterial({color:0xc9a5ff}));this.ring.rotation.x=Math.PI/2;this.ring.userData.ownedMaterial=true;this.root.add(this.ring);
 }
 itemModel(item){
  const {block,ball,cylinder}=this.kit,g=new THREE.Group(),c=item.weapon?Number('0x'+RARITIES[item.rarity||0].color.slice(1)):Number('0x'+(ITEMS[item.id]?.color||'#d9b967').slice(1));
  if(item.weapon){
   const w=weapon(item.id);block(g,0,.12,0,.3,.22,.95,w.color);block(g,0,.08,-.64,.09,.08,.5,0x304f5e);block(g,0,-.12,.18,.16,.35,.2,0x2f4f59);block(g,0,.26,-.07,.12,.1,.18,0xe7ebd7);
  }else if(item.ammoType){block(g,0,.12,0,.5,.45,.4,0xeac17a);for(let i=0;i<3;i++)cylinder(g,(i-1)*.14,.42,0,.035,.24,0xffe6a5,6);}
  else if(['mini','flask'].includes(item.id)){cylinder(g,0,.15,0,.2,item.id==='mini'?.5:.7,c);cylinder(g,0,.5,0,.12,.1,0xf3eed4);}
  else if(['medkit','bandage'].includes(item.id)){block(g,0,.14,0,.7,.42,.5,c);block(g,0,.36,0,.36,.025,.1,0xec8778);block(g,0,.36,0,.1,.025,.36,0xec8778);}
  else ball(g,0,.2,0,.27,.36,.27,c);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.55,24),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=-.24;ring.userData.ownedMaterial=true;g.add(ring);return g;
 }
 chestModel(supply=false){
  const {block,ball}=this.kit,g=new THREE.Group();
  block(g,0,.5,0,1.7,1,1.2,supply?0x69b9bd:0xb9893e);for(const x of [-.6,.6])block(g,x,.5,0,.14,1.08,1.27,0xf9d274);
  const lid=new THREE.Group();lid.position.set(0,.98,-.6);block(lid,0,.16,.6,1.76,.35,1.24,0xe5af51);g.add(lid);g.userData.lid=lid;
  block(g,0,.8,.65,.3,.32,.08,0xffdf75);const glow=ball(g,0,1.3,0,.14,.14,.14,0xffe2a0);g.userData.glow=glow;return g;
 }
 update(state,local,dt,playing){
  this.root.visible=playing&&!!state?.royale;if(!this.root.visible)return;
  const r=state.royale,t=this.view.clock,kit=this.kit;
  if(this.round!==state.round){for(const group of [this.chests,this.loot,this.gliders,this.pads]){for(const mesh of group.values()){this.root.remove(mesh);this.view.disposeGroup(mesh);}group.clear();}this.round=state.round;}
  this.transport.visible=r.elapsed<=r.route.duration+5;
  const pos=transportAt(r.route,r.elapsed);this.transport.position.set(pos.x,pos.y+Math.sin(t)*.18,pos.z);this.transport.rotation.y=pos.yaw;this.transport.rotation.z=Math.sin(t*.4)*.015;this.rotors.forEach(m=>m.rotation.y+=dt*18);
  this.wall.visible=this.ring.visible=r.storm.active;this.wall.position.set(r.storm.x,85,r.storm.z);this.wall.scale.set(Math.max(.01,r.storm.radius),1,Math.max(.01,r.storm.radius));this.wall.material.opacity=.17+Math.sin(t*.5)*.035;this.ring.position.set(r.storm.x,.15,r.storm.z);this.ring.scale.setScalar(Math.max(.01,r.storm.radius));
  const observer=local?.spectating?state.players.find(p=>p.id===this.view.spectateTarget)||local:local;
  const seen=new Set();
  for(const item of r.loot){
   seen.add(item.uid);let mesh=this.loot.get(item.uid);
   const close=observer&&Math.hypot(item.x-observer.x,item.z-observer.z)<(this.view.settings.quality==='low'?60:95);
   if(!mesh&&close){mesh=this.itemModel(item);this.loot.set(item.uid,mesh);this.root.add(mesh);}
   if(mesh){mesh.visible=!!close;mesh.position.set(item.x,item.y+.7+Math.sin(t*2+item.uid)*.1,item.z);mesh.rotation.y=t*.65+item.uid;}
  }
  for(const [id,m]of this.loot)if(!seen.has(id)){this.root.remove(m);this.view.disposeGroup(m);this.loot.delete(id);}
  for(const chest of r.chests){
   let mesh=this.chests.get(chest.id);if(!mesh){mesh=this.chestModel(chest.supply);this.chests.set(chest.id,mesh);this.root.add(mesh);if(chest.supply){const c=canopy(kit,0x99dad9);c.position.y=1.5;mesh.add(c);mesh.userData.canopy=c;}}
   const fall=chest.landAt?Math.max(0,(chest.landAt-state.time)*4):0;mesh.position.set(chest.x,chest.y+fall,chest.z);
   if(mesh.userData.canopy)mesh.userData.canopy.visible=fall>0;
   mesh.userData.lid.rotation.x+=((chest.opened?-1.7:0)-mesh.userData.lid.rotation.x)*Math.min(1,dt*8);
   mesh.userData.glow.visible=!chest.opened;mesh.userData.glow.scale.setScalar(1+Math.sin(t*3)*.25);
   mesh.visible=!!observer&&(Math.hypot(chest.x-observer.x,chest.z-observer.z)<140||chest.supply);
  }
  for(const p of state.players){
   let mesh=this.gliders.get(p.id);if(!mesh&&p.flight==='glide'){mesh=canopy(kit);this.gliders.set(p.id,mesh);this.root.add(mesh);}
   if(mesh){mesh.visible=p.health>0&&p.flight==='glide';mesh.position.set(p.x,p.y,p.z);mesh.rotation.set(Math.sin(t*2)*.02,p.yaw,Math.sin(t*1.6)*.04);}
  }
  const padIds=new Set();for(const p of r.pads){padIds.add(p.id);let mesh=this.pads.get(p.id);if(!mesh){mesh=new THREE.Group();kit.cylinder(mesh,0,.12,0,1.2,.24,0x5e8b94,24);kit.cylinder(mesh,0,.25,0,.8,.07,0xffd265,24);this.root.add(mesh);this.pads.set(p.id,mesh);}mesh.position.set(p.x,p.y,p.z);mesh.scale.setScalar(1+Math.sin(t*3)*.035);}
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
  if(model.userData.utilityKey!==itemKey){if(model.userData.utility){model.userData.utility.removeFromParent();this.view.disposeGroup(model.userData.utility);}model.userData.utility=null;model.userData.utilityKey=itemKey;if(itemKey){const prop=this.itemModel(item);prop.scale.setScalar(.6);prop.position.set(.36,.7,-.35);model.add(prop);model.userData.utility=prop;}}
  if(model.userData.utility){model.userData.utility.position.y=p.use?1.15+Math.sin(t*7)*.02:.7;}

  if(flying){model.rotation.x=p.flight==='dive'?.85:.1;model.rotation.z=Math.sin(t*3)*.05;}
  else if(p.sprinting){model.rotation.x=.17;model.rotation.z=Math.sin(t*9)*.16;}
  if(p.place===1&&p.health>0){model.position.y+=Math.max(0,Math.sin(t*5))*.5;model.rotation.y+=Math.sin(t*2)*.15;}
 }
}
