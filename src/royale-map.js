import {materialFor} from './building.js';
import {createTerrain,groundAt} from './terrain.js';
// Authored scenery, collision and loot share the same coordinates and heightfield.
export const DISTRICTS = [
 {name:'Shellside Square',x:0,z:0,color:0xefb45d,kind:'town'},
 {name:'Cornflake Fields',x:-145,z:-140,color:0xd7bc57,kind:'farm'},
 {name:'Sunny Docks',x:150,z:135,color:0x72b8c6,kind:'dock'},
 {name:'Scramble Springs',x:145,z:-135,color:0x80d9cb,kind:'resort'},
 {name:'Crater Camp',x:-145,z:135,color:0xa6a0d8,kind:'camp'},
 {name:'Perch Park',x:0,z:-185,color:0x87b673,kind:'park'},
 {name:'Toast Town',x:0,z:175,color:0xe99673,kind:'town'},
 {name:'Hatchery Heights',x:-190,z:0,color:0xe5d9a5,kind:'hatchery'},
 {name:'Yolkworks',x:190,z:0,color:0x7eabc0,kind:'factory'},
];
const boxes=[],chests=[],floorLoot=[],buildings=[],trees=[],props=[];
const box=(x,z,w,d,h,color='stone',y=0,kind='royale')=>{const b={x,z,w,d,h,color,y,kind};boxes.push(b);return b;};
function house(x,z,kind,index,n,outer=false){
  const w=outer?10+(index%3)*2:12,d=outer?10+(index%2)*2:12;
  const h=({factory:7.4,camp:4.2,farm:5.6,resort:4.8,park:4.6,hatchery:6,dock:6.2,town:5.8}[kind])+(index%2)*1.4;
  const color=['terracotta','sand','teal','stone'][(index+n)%4];
  const roof=['farm','camp','park'].includes(kind)?'gable':kind==='factory'?'sawtooth':kind==='town'&&index%2?'gable':'terrace';
  const building={x,z,w,d,h,color,kind,index,outer,roof};buildings.push(building);
  const wall=(xx,zz,ww,dd,hh,cc=color,yy=0)=>{const b=box(xx,zz,ww,dd,hh,cc,yy,'building');b.building=buildings.length-1;};
  wall(x-w/2,z,.7,d,h);wall(x+w/2,z,.7,d,h);wall(x,z-d/2,w,.7,h);
  const side=(w-5.6)/2;
  wall(x-(w/2-side/2),z+d/2,side,.7,h);wall(x+(w/2-side/2),z+d/2,side,.7,h);
  wall(x,z+d/2,w,.7,1.2,color,h-1.2);
  wall(x-w/4,z,w/2+.6,d+.5,.35,'stone',h);
  let roofLootY=h+.35;
  if(roof==='gable')for(let k=0;k<10;k++){
    const rh=1.7*(1-Math.abs((k+.5)/10*2-1)),rx=x-w/2-.3+(k+.5)*(w/2+.6)/10;
    const b=box(rx,z,(w/2+.6)/10,d+.5,rh,'stone',h+.35,'roof');b.building=buildings.length-1;
    if(k===4)roofLootY+=rh;
  }
  if(roof==='sawtooth')for(let k=0;k<12;k++){
    const rh=.12+(k%4)*.32,rz=z-d/2-.25+(k+.5)*(d+.5)/12;
    const b=box(x-w/4,rz,w/2+.6,(d+.5)/12,rh,'stone',h+.35,'roof');b.building=buildings.length-1;
  }
  // Only designated terrace houses have access stairs. The top landing meets
  // an opening in the side wall and the half-roof exactly, with no floating gap.
  building.stairs=roof==='terrace'&&(index+n)%3!==1;
  if(building.stairs){
   const count=Math.ceil((h+.35)/.4),rise=(h+.35)/count,topZ=z-d/2+2;
   for(let k=0;k<count;k++)wall(x-w/2-1.55,topZ+(count-1-k)*.8,3.2,.82,(k+1)*rise,'stone');
   wall(x-w/2,topZ,3.4,3.2,.35,'stone',h);
  }

  chests.push({x:x+2.5,y:0,z:z-2});
  if(roof==='sawtooth')roofLootY=Math.max(...boxes.filter(b=>b.kind==='roof'&&b.building===buildings.length-1&&Math.abs((z-2)-b.z)<=b.d/2+.01).map(b=>b.y+b.h));
  floorLoot.push({x:x+2,y:0,z:z+3},{x:x+w/2+4,y:0,z:z+5},{x:x-w/4,y:roofLootY,z:z-2,roof:true});
}
for(const [n,p] of DISTRICTS.entries()) {
 const count=n===0?6:4;
 for(let j=0;j<count;j++) {
  const a=j*Math.PI*2/count, x=p.x+Math.cos(a)*22,z=p.z+Math.sin(a)*22;
  house(x,z,p.kind,j,n);
 }
 // A second neighborhood ring adds meaningful destinations and short cover-to-cover routes.
 for(let j=0;j<6;j++){
  const a=j*Math.PI/3+.32;
  house(p.x+Math.cos(a)*49,p.z+Math.sin(a)*49,p.kind,j+4,n,true);
 }
 chests.push({x:p.x+(p.kind==='resort'?4:0),y:0,z:p.z});
 floorLoot.push({x:p.x-5,y:0,z:p.z+5},{x:p.x+6,y:0,z:p.z+6});
 for(let k=0;k<6;k++) {
  const a=k*Math.PI/3+.2;
  const x=p.x+Math.cos(a)*35,z=p.z+Math.sin(a)*35;
  if(buildings.some(b=>Math.abs(x-b.x)<b.w/2+5&&Math.abs(z-b.z)<b.d/2+6))continue;
  props.push({kind:k%2?'crate':'planter',x,z,w:3.2,d:2.8,h:1.3});
  box(x,z,3.2,2.8,1.3,k%2?'crate':'stone',0,'prop');
 }
}
// Solid landmarks share conservative collision footprints with their original meshes.
for(const p of DISTRICTS){
 if(p.kind==='farm')for(const dx of [-8,8])box(p.x+dx,p.z-36,5.2,5.2,14,'steel',0,'landmark');
 if(p.kind==='factory')for(const dx of [-8,8])box(p.x+dx,p.z-38,7,7,12,'steel',0,'landmark');
 if(p.kind==='town')box(p.x,p.z-6,3.2,3.2,6,'sand',0,'landmark');
 if(p.kind==='dock')for(const dx of [-38,38])box(p.x+dx,p.z+15,1.3,1.3,24,'gold',0,'landmark');
 if(p.kind==='resort')box(p.x,p.z,1,1,2,'stone',0,'landmark');
 if(p.kind==='camp')for(let j=0;j<9;j++){const a=j*Math.PI*2/9;box(p.x+Math.cos(a)*11,p.z+Math.sin(a)*11,2.8,2.8,2,'stone',0,'landmark');}
}
// Small roadside shelters reduce empty travel and ensure outer drops can equip.
const shelters=[];
for(const [x,z] of [[-75,-75],[75,-75],[-75,75],[75,75],[-95,0],[95,0],[0,-95],[0,95]]) {
 shelters.push({x,z});
 box(x-4,z,1,9,3.4,'crate',0,'shelter');box(x+4,z,1,9,3.4,'crate',0,'shelter');box(x,z,9,9,.35,'sand',3.4,'shelter');
 chests.push({x,y:0,z});floorLoot.push({x,y:0,z:z+6});
}
const terrain=createTerrain(buildings,DISTRICTS,shelters),surface={terrain};
const roadDistance=(x,z)=>Math.min(...DISTRICTS.filter(p=>p.x||p.z).map(p=>{const t=Math.max(0,Math.min(1,(x*p.x+z*p.z)/(p.x*p.x+p.z*p.z)));return Math.hypot(x-t*p.x,z-t*p.z);}));
const clear=(x,z,r=2)=>!boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)
 && !chests.some(c=>Math.hypot(c.x-x,c.z-z)<r+2) && !floorLoot.some(c=>Math.hypot(c.x-x,c.z-z)<r+1);
for(let i=0;i<1800&&trees.length<560;i++){
 const x=((i*193.37)%488)-244,z=((i*317.71+i*i*.017)%488)-244;
 if(roadDistance(x,z)<7||!clear(x,z,2.6)||buildings.some(b=>Math.abs(x-b.x)<b.w/2+5&&Math.abs(z-b.z)<b.d/2+8))continue;
 const nearest=[...DISTRICTS].sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
 const kind=nearest.kind==='resort'||nearest.kind==='dock'?'palm':nearest.kind==='camp'?'pine':nearest.kind==='farm'?'orchard':nearest.kind==='hatchery'?'autumn':i%4===0?'pine':'oak';
 const y=groundAt(surface,x,z),h=kind==='orchard'?5+i%3:7+i%6;
 trees.push({x,y,z,h,kind,seed:i});box(x,z,.8,.8,h*.65,'crate',y,'tree');
 if(i%13===0){chests.push({x:x+2,y:groundAt(surface,x+2,z+2),z:z+2});floorLoot.push({x:x+3,y:groundAt(surface,x+3,z-2),z:z-2});}
}
for(let i=0;i<180;i++){
 const x=(i*173.43%472)-236,z=(i*271.77%472)-236;
 if(roadDistance(x,z)<8||!clear(x,z,4)||buildings.some(b=>Math.abs(x-b.x)<b.w/2+6&&Math.abs(z-b.z)<b.d/2+10))continue;
 const y=groundAt(surface,x,z),h=1.3+i%3*.8,w=2.4+i%3;
 props.push({kind:'rock',x,y,z,h,w,d:w*.85,seed:i});box(x,z,w*.8,w*.7,h*.85,'stone',y,'prop');
}
// Lamps and benches sit away from entry approaches. Their collision is authored too.
for(const [i,b]of buildings.entries()){
 const x=b.x+b.w/2+2,z=b.z-b.d/2-2,y=groundAt(surface,x,z);
 if(!clear(x,z,1.3))continue;
 const kind=i%3===0?'bench':i%3===1?'barrels':'lamp';
 const w=kind==='bench'?2.6:kind==='barrels'?1.6:.35,d=kind==='bench'?.65:kind==='barrels'?1.6:.35,h=kind==='lamp'?4.5:1.2;
 props.push({kind,x,y,z,w,d,h});box(x,z,w,d,h,'crate',y,'prop');
}
// Ground loot conforms to terrain; reject anchors obstructed by the denser authored layout.
for(const points of [chests,floorLoot])for(let i=points.length-1;i>=0;i--){
 const p=points[i];if(!p.roof)p.y=groundAt(surface,p.x,p.z);
 if(boxes.some(b=>Math.abs(p.x-b.x)<b.w/2+.35&&Math.abs(p.z-b.z)<b.d/2+.35&&p.y+.2>b.y&&p.y+.2<b.y+b.h))points.splice(i,1);
}
export const ROYALE_MAP={id:'sunnybreak',name:'Sunnybreak Island',tag:'BATTLE ROYALE • 512 × 512',description:'Nine districts. One surviving egg.',size:256,navCell:2.5,sky:0xafdfe8,ground:0x86b87c,accent:0xf6cc66,theme:'royale',zone:[0,0,0],bases:[[-230,0],[230,0]],spawns:[[0,0],[-75,-75],[75,-75],[-75,75],[75,75]],lanes:[],boxes,props,pickups:[],districts:DISTRICTS,buildings,trees,chests,floorLoot,shelters,terrain};

for(const [i,b] of boxes.entries()){b.objectId="world-"+i;b.material=materialFor(b,ROYALE_MAP);}
for(const collection of [trees,props,buildings,shelters,chests,floorLoot])for(const o of collection)o.material=materialFor({...o,kind:collection===trees?"tree":o.kind,color:collection===chests?"steel":o.color},ROYALE_MAP);
ROYALE_MAP.material="brick";
