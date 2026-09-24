import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {MATERIALS,pieceBoxes,placement,validPlacement,aimedObject} from './building.js';
export function buildMesh(piece,kit,preview=false){
 const g=new THREE.Group(),color=preview?0x57caff:MATERIALS[piece.material].color;
 for(const b of pieceBoxes({...piece,x:0,y:0,z:0})){
  const mesh=kit.block(g,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color);
  if(preview){mesh.material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.26,depthWrite:false});mesh.userData.ownedMaterial=true;}
 }
 if(!preview){
  // Visible framing distinguishes timber, masonry and sheet metal at a glance.
  const m=piece.material,dark=m==='wood'?0x694b31:m==='brick'?0xe8cbb5:0x3e5e6d;
  if(piece.type==='wall'&&!piece.mask){for(let i=0;i<9;i++){let mesh;if(m==='wood')mesh=kit.block(g,-1.9+i*.475,2,0,.065,4,.22,dark);else mesh=kit.block(g,0,i*.48,0,4,.025,.19,dark);if(piece.rotation%2){mesh.position.z=mesh.position.x;mesh.position.x=0;mesh.rotation.y=Math.PI/2;}}
  }
 }
 const batches=new Map();g.updateMatrixWorld(true);for(const mesh of [...g.children]){const key=mesh.material.uuid;if(!batches.has(key))batches.set(key,{material:mesh.material,parts:[],owned:preview});const geo=mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);batches.get(key).parts.push(geo);g.remove(mesh);}
 for(const batch of batches.values()){const geo=mergeGeometries(batch.parts);batch.parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,batch.material);mesh.userData.ownedMaterial=batch.owned;g.add(mesh);}
 g.position.set(piece.x,piece.y,piece.z);return g;
}
export function updateBuildingView(rv,state,p){
 rv.buildMeshes??=new Map();const r=state.royale,seen=new Set();
 for(const b of r.builds||[]){seen.add(b.id);let cached=rv.buildMeshes.get(b.id);const key=[b.material,b.mask,b.rotation].join(':');
  if(cached&&cached.key!==key){rv.root.remove(cached.mesh);rv.view.disposeGroup(cached.mesh);rv.buildMeshes.delete(b.id);cached=null;}
  if(!cached){const mesh=buildMesh(b,rv.kit);rv.root.add(mesh);cached={mesh,key};rv.buildMeshes.set(b.id,cached);}
  cached.mesh.visible=!p||Math.hypot(b.x-p.x,b.z-p.z)<180;
  cached.mesh.scale.y=.92+.08*Math.min(1,(state.time-b.created)/MATERIALS[b.material].seconds);
 }
 for(const [id,c] of rv.buildMeshes)if(!seen.has(id)){rv.root.remove(c.mesh);rv.view.disposeGroup(c.mesh);rv.buildMeshes.delete(id);}
 if(!rv.weakpoint){rv.weakpoint=new THREE.Mesh(new THREE.RingGeometry(.18,.25,32),new THREE.MeshBasicMaterial({color:0x50cfff,depthTest:false,transparent:true,opacity:.95,side:THREE.DoubleSide}));rv.weakpoint.userData.ownedMaterial=true;rv.root.add(rv.weakpoint);}
 const aimed=p?.slot===5?aimedObject(rv.view.buildMap,p,5):null,weak=r.worldDamage?.[aimed?.box.objectId]?.weakpoint;rv.weakpoint.visible=!!weak;if(weak){rv.weakpoint.position.set(weak.x,weak.y,weak.z);rv.weakpoint.quaternion.copy(rv.view.camera.quaternion);}
 const controls=rv.view.buildControls,active=p?.health>0&&p.flight==='ground'&&controls?.buildMode&&!controls.editing;
 const previewKey=active?JSON.stringify([placement({...p,yaw:controls.yaw??p.yaw,pitch:controls.pitch??p.pitch},controls.buildType,controls.buildRotation,controls.buildMaterial),rv.view.buildMap.buildKey,p.materials,state.players.map(p=>[p.x,p.y,p.z])]):'';
 if(rv.previewKey!==previewKey){rv.previewKey=previewKey;
 if(rv.previewBuild){rv.root.remove(rv.previewBuild);rv.view.disposeGroup(rv.previewBuild);rv.previewBuild=null;}
 if(active){const proposal=placement({...p,yaw:controls.yaw??p.yaw,pitch:controls.pitch??p.pitch},controls.buildType,controls.buildRotation,controls.buildMaterial),reason=validPlacement(proposal,rv.view.buildMap,r.builds||[],state.players),valid=!reason&&(p.materials?.[proposal.material]||0)>=10;rv.previewBuild=buildMesh(proposal,rv.kit,true);rv.previewBuild.traverse(m=>{if(m.isMesh)m.material.color.setHex(valid?0x61cfff:0xff556d);});rv.root.add(rv.previewBuild);controls.reason=reason||(!valid?'Not enough materials':'');}
 }
 if(rv.view.world&&rv.worldVersion!==r.matchId+':'+r.round+':'+r.buildVersion){rv.worldVersion=r.matchId+':'+r.round+':'+r.buildVersion;rv.view.world.traverse(m=>{if(!m.userData.objectRanges)return;const attribute=m.geometry.attributes.position;let changed=false;for(const range of m.userData.objectRanges){const destroyed=!!r.worldDamage?.[range.id]?.destroyed;if(!!range.destroyed===destroyed)continue;m.userData.originalPositions??=attribute.array.slice();const start=range.start*3,end=(range.start+range.count)*3;if(destroyed)attribute.array.fill(0,start,end);else attribute.array.set(m.userData.originalPositions.subarray(start,end),start);range.destroyed=destroyed;changed=true;}if(changed)attribute.needsUpdate=true;});}
}
