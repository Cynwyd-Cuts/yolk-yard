import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeBlaster} from './weapons.js';
import {ITEMS,RARITIES} from './royale-data.js';

// Shared primitives stay inexpensive even in the island's dense groves.
const geometry=new Map();
function geo(key,create){if(!geometry.has(key)){const g=create();g.userData.shared=true;geometry.set(key,g);}return geometry.get(key);}
function mesh(g,geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
export function artKit(kit){
 const {block,ball,cylinder,mat}=kit;
 return {...kit,
  rounded:(g,x,y,z,w,h,d,c,r=.08)=>mesh(g,geo(`round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3))),mat(c),x,y,z),
  rock:(g,x,y,z,w,h,d,c,detail=0)=>mesh(g,geo('ico'+detail,()=>new THREE.IcosahedronGeometry(1,detail)),mat(c),x,y,z,w,h,d),
  cone:(g,x,y,z,r,h,c,top=0)=>mesh(g,geo('cone'+top,()=>new THREE.CylinderGeometry(top,1,1,8)),mat(c),x,y,z,r,h,r),
  torus:(g,x,y,z,r,t,c)=>mesh(g,geo(`torus:${r}:${t}`,()=>new THREE.TorusGeometry(r,t,6,24)),mat(c),x,y,z),
  beam:(g,a,b,r,c)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);const m=mesh(g,geo('beam',()=>new THREE.CylinderGeometry(1,1,1,6)),mat(c),...(av.add(bv).multiplyScalar(.5).toArray()),r,v.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;},
 };
}
export const DISTRICT_STYLES={
 town:{walls:[0xdfad70,0xd5866b,0x7caaa4],trim:0xffe8b7,roof:0x467b80,wood:0x775447},
 farm:{walls:[0xb85e47,0xcba061,0xa86e45],trim:0xf7dfac,roof:0x576f70,wood:0x765743},
 dock:{walls:[0x6c98a9,0x81a6a4,0xd0a36c],trim:0xf5dab0,roof:0x466578,wood:0x7e6350},
 resort:{walls:[0xe8d5b0,0xe7ac8f,0x9bc4b5],trim:0xfff0ce,roof:0xc96d54,wood:0x7e9e99},
 camp:{walls:[0x838274,0x7e9584,0xaa8962],trim:0xe2cc93,roof:0x505e5d,wood:0x655543},
 park:{walls:[0x7e9c73,0xbea774,0x8eaf9a],trim:0xe7ddaf,roof:0x667b58,wood:0x695543},
 hatchery:{walls:[0xc6c9ac,0xcdbca1,0x95bfb4],trim:0xf9e9c3,roof:0x699ba0,wood:0x8b9b82},
 factory:{walls:[0x8199a0,0x7d8a98,0xae9e80],trim:0xe9ca72,roof:0x435d70,wood:0x4e6971},
};
export function buildingStyle(b){const s=DISTRICT_STYLES[b.kind];return {...s,wall:s.walls[b.index%s.walls.length]};}
export function dressBuilding(g,b,raw){
 const k=artKit(raw),{block:box,cylinder,beam,rock}=k,s=buildingStyle(b),{x,z,w,d,h}=b;
 // Structural corner posts, foundation courses and a broad, unobstructed entrance.
 for(const dx of [-w/2,w/2]){
  box(g,x+dx,.22,z,.86,.44,d+.3,s.wood);
  for(const dz of [-d/2,d/2])box(g,x+dx,h/2,z+dz,.86,h,.86,s.trim);
 }
 box(g,x,.23,z-d/2,w,.46,.84,s.wood);
 box(g,x,h-1.16,z+d/2+.41,5.9,.2,.16,s.trim);
 for(const dx of [-2.85,2.85])box(g,x+dx,(h-1.2)/2,z+d/2+.4,.14,h-1.2,.16,s.trim);
 const window=(dx,dz,side)=>{
  const xx=x+dx,zz=z+dz,ww=side?.12:1.65,dd=side?1.65:.12,yy=Math.min(2.6,h*.52);
  box(g,xx,yy,zz,ww,1.65,dd,s.trim);box(g,xx+(side?Math.sign(dx)*.08:0),yy,zz+(side?0:.08),side?.1:1.38,1.37,side?1.38:.1,0x406c7b);
  box(g,xx+(side?Math.sign(dx)*.15:0),yy,zz+(side?0:.15),side?.08:1.4,.075,side?1.4:.08,s.trim);
  box(g,xx+(side?Math.sign(dx)*.16:0),yy,zz+(side?0:.16),.09,1.4,.09,s.trim);
  box(g,xx,yy-.95,zz,side?.42:2,.18,side?2:.42,s.wood);
  if(['town','resort','park'].includes(b.kind))for(const sign of [-1,1])box(g,xx+(side?0:sign*1.04),yy,zz+(side?sign*1.04:0),side?.18:.36,1.65,side?.36:.18,s.roof);
 };
 for(const side of [-1,1])for(const dz of [-d*.25,d*.2])window(side*(w/2+.4),dz,true);
 for(const dx of [-w/2+1.45,w/2-1.45])window(dx,d/2+.42,false);
 // Roof trim outlines the usable half-deck; opening remains clear for drops.
 if(b.roof==='terrace')box(g,x-w/4,h+.23,z,w/2+.7,.12,d+.65,s.roof);
 box(g,x-w/2-.22,h+.38,z,.15,.3,d+.7,s.trim);
 box(g,x-w/4,h+.38,z-d/2-.25,w/2+.7,.3,.15,s.trim);
 if(b.roof==='gable'){
  // A peaked tiled cap distinguishes lodges, barns and upper shop floors.
  for(const zz of [-d/2-.3,d/2+.3]){
   beam(g,[x-w/2-.25,h+.52,z+zz],[x-w/4,h+2.05,z+zz],.12,s.trim);
   beam(g,[x-w/4,h+2.05,z+zz],[x+.25,h+.52,z+zz],.12,s.trim);
  }
  box(g,x-w/4,h+2.02,z,.2,.16,d+.8,s.trim);
  for(let j=0;j<9;j++)for(const side of [-1,1])beam(g,[x-w/4,h+2.03,z-d/2+j*d/8],[x-w/4+side*(w/4+.3),h+.5,z-d/2+j*d/8],.035,s.wood);
 }
 // Interior shelves, entry mat and wall panels fit entirely within existing walls.
 box(g,x+1,.025,z+2.6,4.4,.05,2.5,b.kind==='resort'?0x629eaa:0xc4ae7f);
 box(g,x,2,z-d/2+.4,3.8,1.6,.1,s.wood);
 box(g,x,2,z-d/2+.47,3.3,1.18,.04,b.kind==='factory'?0xb6c3af:0x9aae8c);
 for(const sign of [-1,1])box(g,x+sign*1.6,2,z-d/2+.51,.09,1.2,.03,s.trim);
 if(b.kind==='farm'||b.kind==='camp'||b.kind==='park'){
  // Timber siding and diagonal braces make these read as cabins/barns, not houses.
  for(let yy=.8;yy<h-.2;yy+=.62)for(const side of [-1,1])box(g,x+side*(w/2+.37),yy,z,.1,.11,d-.4,s.wood);
  for(const side of [-1,1])beam(g,[x+side*(w/2-.65),h-1,z+d/2+.44],[x+side*3,h-2.5,z+d/2+.44],.065,s.trim);
  const canopy=box(g,x,h-.75,z+d/2+1.1,6.2,.18,2.1,s.roof);canopy.rotation.x=.12;
  for(const side of [-1,1])beam(g,[x+side*3,h-1.9,z+d/2+.5],[x+side*3,h-.7,z+d/2+2],.07,s.wood);
 }else if(b.kind==='factory'||b.kind==='dock'){
  for(let xx=-w/2+1;xx<w/2;xx+=1.25)box(g,x+xx,h-.5,z-d/2-.4,.1,.9,.12,s.roof);
  for(const dx of [-w/2+.7,w/2-.7])for(let yy=.6;yy<h;yy+=.8)box(g,x+dx,yy,z+d/2+.43,.4,.24,.09,yy%1.6<.8?s.trim:s.roof);
  box(g,x,h-.55,z+d/2+.6,4.7,.62,.18,s.roof);
  for(let j=0;j<5;j++)box(g,x-1.7+j*.8,h-.55,z+d/2+.71,.4,.09,.04,s.trim);
  // Industrial side conduit is tight to the already-solid wall.
  beam(g,[x+w/2+.48,.3,z-d/2+1],[x+w/2+.48,h-.2,z-d/2+1],.11,s.roof);
 }else if(b.kind==='hatchery'){
  // Greenhouse crown: lightweight ribs arch above the opening, rather than a solid roof.
  for(const zz of [-d/2+.6,d/2-.6])for(let j=0;j<6;j++){
   const a=j*Math.PI/6,aa=(j+1)*Math.PI/6;
   beam(g,[x+Math.cos(a)*w/2,h+Math.sin(a)*2, z+zz],[x+Math.cos(aa)*w/2,h+Math.sin(aa)*2,z+zz],.07,s.trim);
  }
  for(const dx of [-3,0,3])box(g,x+dx,h+1.7,z,.08,.1,d-.8,s.roof);
 }else{
  // Shop awnings and villa pergolas: striped fabric, shaped brackets and valances.
  for(let j=0;j<8;j++){const m=box(g,x-2.8+j*.8,h-1.15,z+d/2+1.2,.79,.14,2.25,j%2?s.trim:s.roof);m.rotation.x=.1;box(g,x-2.8+j*.8,h-1.37,z+d/2+2.3,.79,.35,.09,j%2?s.trim:s.roof);}
  for(const side of [-1,1])beam(g,[x+side*3,h-2,z+d/2+.4],[x+side*3,h-1.25,z+d/2+2],.055,s.wood);
  if(b.kind==='resort')for(let j=0;j<6;j++)box(g,x-w/4,h+.45,z-d/2+.7+j*(d-1)/5,w/2,.12,.14,s.trim);
 }
 // Door-top district insignia uses geometry and is legible without textures.
 const badge=cylinder(g,x,h-.55,z+d/2+.6,.32,.08,s.trim,12);badge.rotation.x=Math.PI/2;
 rock(g,x,h-.55,z+d/2+.68,.16,.21,.04,s.roof,1);
}
export function treeModel(g,t,raw){
 const {cone,beam,rock,torus}=artKit(raw),{x,y,z,h,kind,seed}=t;
 cone(g,x,y+h*.3,z,.44,h*.6,kind==='palm'?0xad8d60:0x80604c,.55);
 if(kind==='palm'){
  for(let j=0;j<6;j++)cone(g,x,y+.7+j*h*.075,z,.38-j*.012,.07,0xc6a877,.95);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7+seed,dx=Math.cos(a),dz=Math.sin(a);beam(g,[x,y+h*.68,z],[x+dx*3.7,y+h*.63,z+dz*3.7],.1,0x628c4a);
   const leaf=rock(g,x+dx*2,y+h*.76,z+dz*2,.64,.32,2.7,i%2?0x709d50:0x87b25b);leaf.rotation.y=Math.PI/2-a;leaf.rotation.z=dx*.15;
  }
  for(let i=0;i<3;i++)rock(g,x+Math.cos(i*2)*.4,y+h*.65,z+Math.sin(i*2)*.4,.25,.3,.25,0x876141,1);
 }else if(kind==='pine'){
  for(let j=0;j<4;j++)cone(g,x,y+h*(.42+j*.15),z,2.8-j*.48,h*.39,[0x3d7868,0x4b8d70,0x629b72,0x84ae7d][j]);
 }else{
  const colors=kind==='autumn'?[0xd89356,0xe4ae61,0xc97950]:kind==='orchard'?[0x668b49,0x7d9e52,0x95b85f]:[0x518563,0x66986b,0x8ab579];
  for(let i=0;i<5;i++){const a=i*2.4+seed,dx=Math.cos(a)*1.5,dz=Math.sin(a)*1.5;
   beam(g,[x,y+h*.38,z],[x+dx,y+h*.67,z+dz],.14,0x80604c);
   const leaf=rock(g,x+dx,y+h*(.67+(i%2)*.12),z+dz,2.4,2.1,2.3,colors[i%3],1);leaf.rotation.y=a;
   if(kind==='orchard')for(let j=0;j<3;j++)rock(g,x+dx+Math.cos(j*2)*1.9,y+h*.65,z+dz+Math.sin(j*2)*1.9,.19,.21,.19,0xe2a24d,1);
  }
 }
}
export function propModel(g,p,raw){
 const {block:box,cone,rock,cylinder,torus,beam}=artKit(raw),{x,y=0,z,w,d,h,kind}=p;
 if(kind==='rock'){
  const m=rock(g,x,y+h*.45,z,w*.5,h*.55,d*.5,0x929789,1);m.rotation.y=(p.seed||0)*2.4;
  rock(g,x-w*.19,y+h*.81,z,.6,.16,.55,0xb7ba9b);
 }else if(kind==='lamp'){
  cylinder(g,x,y+2.1,z,.1,4.2,0x41616a,8);cylinder(g,x,y+.15,z,.2,.3,0x41616a,8);
  box(g,x,y+4.1,z,.6,.55,.6,0xffdfa0);cone(g,x,y+4.5,z,.53,.35,0x41616a);
  for(const dx of [-.32,.32])for(const dz of [-.32,.32])box(g,x+dx,y+4.1,z+dz,.06,.6,.06,0x41616a);
 }else if(kind==='bench'){
  for(let i=0;i<3;i++)box(g,x,y+.65,z-.2+i*.2,2.6,.12,.16,0xaf875c);
  for(let i=0;i<2;i++)box(g,x,y+.92+i*.24,z-.32,2.6,.15,.1,0xaf875c);
  for(const dx of [-.95,.95]){box(g,x+dx,y+.33,z,.12,.65,.6,0x41616a);box(g,x+dx,y+.8,z-.32,.1,.8,.1,0x41616a);}
 }else if(kind==='barrels'){
  for(const dx of [-.4,.4]){cylinder(g,x+dx,y+.6,z,.35,1.2,0xc19762,10);for(const yy of [.2,1]){const r=torus(g,x+dx,y+yy,z,.36,.035,0x556873);r.rotation.x=Math.PI/2;}}
 }else if(kind==='planter'){
  box(g,x,y+.4,z,w,.8,d,0xc3ad83);box(g,x,y+.84,z,w-.3,.08,d-.3,0x706957);
  for(let j=0;j<4;j++)rock(g,x+(j%2-.5)*1.4,y+1.05,z+(Math.floor(j/2)-.5),.7,.38,.8,0x729257,1);
 }else{
  box(g,x,y+h/2,z,w,h,d,0xb49161);
  for(const dx of [-w/2+.12,w/2-.12])box(g,x+dx,y+h/2,z,.2,h+.05,d+.04,0xe0bf84);
  for(const dz of [-d/2-.03,d/2+.03])for(const sign of [-1,1])beam(g,[x-w/2+.2,y+.1,z+dz],[x+w/2-.2,y+h-.1,z+dz],.055,sign===1?0xe0bf84:0xc09b64);
 }
}
export function gliderModel(raw,color=0xf4c454){
 const k=artKit(raw),{beam,rock,rounded}=k,g=new THREE.Group();g.name='Ribbed sunwing glider';
 // Separate curved fabric panels and suspension ribs form an arched parafoil.
 for(let j=0;j<9;j++){
  const geometry=geo('sail-panel-'+j,()=>{
   const vertices=[],indices=[];
   for(let face=0;face<2;face++)for(let z=0;z<=12;z++)for(let x=0;x<=2;x++){
    const xx=-2.25+(j+x/2)*.5,zz=-1.4+z*2.8/12,yy=3.6-(xx/2.25)**2*.65+.16*Math.cos(zz*Math.PI/2.8)-face*.055;
    vertices.push(xx,yy,zz);
   }
   for(let z=0;z<12;z++)for(let x=0;x<2;x++){const a=z*3+x,b=a+39;indices.push(a,a+3,a+1,a+1,a+3,a+4,b,b+1,b+3,b+1,b+4,b+3);}
   const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));gg.setIndex(indices);gg.computeVertexNormals();return gg;
  });
  mesh(g,geometry,k.mat(j%2?0xffecc0:color),0,0,0);
  const x=-2.25+j*.5;for(let z=0;z<6;z++){const za=-1.4+z*2.8/6,zb=za+2.8/6;beam(g,[x,3.62-(x/2.25)**2*.65+.16*Math.cos(za*Math.PI/2.8),za],[x,3.62-(x/2.25)**2*.65+.16*Math.cos(zb*Math.PI/2.8),zb],.015,0xf5e2b0);}
 }
 for(const x of [-1.7,1.7])for(const z of [-.9,.9])beam(g,[x,3.05,z],[Math.sign(x)*.43,.76,.1],.018,0xf5ead2);
 rounded(g,0,.65,.12,1.02,.19,.3,0x476c73,.06);
 for(const x of [-.37,.37])rounded(g,x,.58,.12,.18,.18,.4,0x2b4f5a,.035);
 return g;
}
export function chestModel(raw,supply=false){
 const {block:box,rounded,cone,cylinder,rock,torus}=artKit(raw),g=new THREE.Group();g.name=supply?'Airfreight supply crate':'Hinged suncrest treasure chest';
 const wood=supply?0x4e9ea8:0xa86b36,trim=supply?0xd6e9d4:0xf3c569;
 rounded(g,0,.49,0,1.76,.96,1.22,wood,.1);
 for(const z of [-.625,.625]){
  for(let i=0;i<4;i++)box(g,0,.16+i*.2,z,1.55,.035,.025,supply?0x367584:0x784b30);
  for(const x of [-.72,.72]){box(g,x,.5,z,.19,.96,.08,trim);for(const y of [.16,.8])rock(g,x,y,z+Math.sign(z)*.05,.045,.045,.03,0x916641,1);}
 }
 for(const x of [-.9,.9]){const handle=torus(g,x,.55,0,.16,.035,trim);handle.rotation.y=Math.PI/2;}
 const lid=new THREE.Group();lid.position.set(0,.96,-.61);g.add(lid);g.userData.lid=lid;
 rounded(lid,0,.14,.61,1.83,.3,1.28,wood,.11);
 // Curved top with visible plank seams and continuous gold hoops.
 for(let j=0;j<7;j++){const zz=.06+j*.18,yy=.23+Math.sin(j/6*Math.PI)*.24;box(lid,0,yy,zz,1.65,.15,.175,j%2?wood:supply?0x63b5b9:0xc78b45);}
 for(const x of [-.65,.65])for(let j=0;j<7;j++){const zz=.06+j*.18,yy=.31+Math.sin(j/6*Math.PI)*.24;box(lid,x,yy,zz,.15,.065,.19,trim);}
 rounded(g,0,.86,.68,.38,.4,.1,trim,.035);rock(g,0,.89,.75,.11,.15,.055,supply?0x94eef1:0x64cfc3,1);
 for(const x of [-.67,.67])for(const z of [-.43,.43])box(g,x,.035,z,.3,.12,.3,0x536169);
 if(supply){for(const x of [-.5,.5])box(g,x,.5,0,.07,1.05,1.33,0xf8e1a1);box(g,0,.43,.68,.4,.19,.025,0xf5edcc);}
 const glow=rock(g,0,1.65,0,.12,.17,.12,0xffdf89,1);glow.userData.keepDynamic=true;g.userData.glow=glow;
 return g;
}
export function launchpadModel(raw){
 const {cylinder,cone,torus,rounded}=artKit(raw),g=new THREE.Group();g.name='Spring-loaded sunburst launch pad';
 cylinder(g,0,.12,0,1.2,.24,0x425f70,12);cylinder(g,0,.28,0,.92,.12,0x75bac0,12);
 const r=torus(g,0,.36,0,.81,.06,0xf3d16b);r.rotation.x=Math.PI/2;
 for(let i=0;i<6;i++){const a=i*Math.PI/3;const m=rounded(g,Math.cos(a)*.6,.37,Math.sin(a)*.6,.2,.06,.44,0xf6dd84,.025);m.rotation.y=Math.PI/2-a;}
 cone(g,0,.39,0,.3,.12,0xe9e8c6,.7);return g;
}
export function lootModel(item,raw,{ground=true}={}){
 const k=artKit(raw),{block:box,rounded,cylinder,cone,torus,rock,beam}=k,g=new THREE.Group();g.name=(item.id||'item')+' collectible';
 const c=Number('0x'+(item.weapon?RARITIES[item.rarity||0].color:ITEMS[item.id]?.color||'#d9b967').slice(1));
 if(item.weapon){const blaster=makeBlaster(item.id);blaster.rotation.z=Math.PI/2;blaster.scale.setScalar(.85);g.add(blaster);}
 else if(item.ammoType){
  rounded(g,0,.12,0,.65,.42,.46,0x778b68,.06);box(g,0,.35,0,.7,.06,.5,0xc3a26b);
  for(let j=0;j<4;j++){cylinder(g,(j-1.5)*.14,.44,0,.045,.19,0xefc96f,8);cone(g,(j-1.5)*.14,.56,0,.046,.08,0xf9e9b6);}
  box(g,0,.16,.24,.38,.16,.02,0xe9d5a6);
 }else if(item.id==='mini'||item.id==='flask'){
  const big=item.id==='flask',r=big?.28:.19;
  cylinder(g,0,.15,0,r,big?.58:.43,0x77c7d5,16);cone(g,0,big?.49:.4,0,r,.14,0xb4e6df,.52);
  cylinder(g,0,big?.59:.5,0,r*.6,.11,0xf6dd9d,12);cylinder(g,0,.04,0,r*1.02,.09,0x498793,16);
  box(g,0,.18,r+.012,r*1.2,.19,.025,0xe3f8d9);rock(g,0,.18,r+.04,.065,.085,.02,0x529eb3,1);
  for(let i=0;i<3;i++)rock(g,-r*.55,.03+i*.13,r*.85,.033,.033,.018,0xc7fff5,1);
  if(big){const handle=torus(g,r+.09,.25,0,.18,.035,0xe6d6a6);handle.rotation.y=Math.PI/2;}
 }else if(item.id==='bandage'){
  const roll=cylinder(g,0,.16,0,.23,.43,0xf3e7c8,16);roll.rotation.z=Math.PI/2;
  for(const x of [-.225,.225]){const r=torus(g,x,.16,0,.13,.045,0xd4c6a5);r.rotation.y=Math.PI/2;}
  box(g,0,.16,.235,.16,.2,.03,0xd87768);box(g,0,.16,.255,.24,.075,.02,0xfbeecf);
 }else if(item.id==='medkit'){
  rounded(g,0,.13,0,.84,.53,.55,0xedebe0,.08);box(g,0,-.04,0,.86,.1,.56,0xcb6d64);
  rounded(g,0,.46,0,.35,.16,.13,0x566d76,.04);box(g,0,.15,.28,.37,.11,.025,0xcb6d64);box(g,0,.15,.28,.11,.34,.03,0xcb6d64);
  for(const x of [-.3,.3])box(g,x,.23,.285,.07,.14,.04,0x748a90);
 }else if(item.id==='splash'){
  for(const x of [-.17,.17]){cylinder(g,x,.17,0,.14,.5,0x60c9c4,12);cylinder(g,x,.45,0,.12,.06,0xe9dfb3,12);box(g,x,.14,.14,.13,.2,.02,0xf2e6ad);}
  rounded(g,0,.34,0,.63,.08,.35,0x3a7d88,.025);rounded(g,0,.56,0,.24,.17,.07,0x407984,.025);
 }else if(item.id==='impulse'){
  rock(g,0,.2,0,.33,.34,.33,0x9984cf,1);
  for(let j=0;j<3;j++){const r=torus(g,0,.2,0,.34,.043,0x5c658b);r.rotation.set(j*Math.PI/3,j*Math.PI/3,0);}
  for(const dx of [-.32,.32])rock(g,dx,.2,0,.08,.13,.13,0xbbeff0,1);
  cylinder(g,0,.59,0,.09,.14,0xf6d884,8);
 }else if(item.id==='launchpad'){
  const p=launchpadModel(raw);p.scale.setScalar(.37);p.position.y=.06;g.add(p);
 }else if(item.id==='popper'){
  rock(g,0,.17,0,.23,.31,.23,0x9178b6,1);cylinder(g,0,.47,0,.11,.1,0xe5d19a,8);
  const r=torus(g,.07,.59,0,.08,.022,0x6a7682);r.rotation.y=Math.PI/2;rounded(g,.17,.4,0,.08,.25,.11,0xe5d19a,.015);
 }else rock(g,0,.2,0,.3,.35,.3,c,1);
 if(ground){const ring=new THREE.Mesh(geo('loot-ring',()=>new THREE.RingGeometry(.4,.51,32)),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=-.28;ring.userData.ownedMaterial=true;g.add(ring);}
 return g;
}
