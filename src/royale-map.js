// All coordinates and loot anchors are authored together so scenery and collision agree.
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
const boxes=[],chests=[],floorLoot=[],buildings=[],trees=[];
const box=(x,z,w,d,h,color='stone',y=0,kind='royale')=>{const b={x,z,w,d,h,color,y,kind};boxes.push(b);return b;};
for(const [n,p] of DISTRICTS.entries()) {
 const count=n===0?6:4;
 for(let j=0;j<count;j++) {
  const a=j*Math.PI*2/count, x=p.x+Math.cos(a)*22,z=p.z+Math.sin(a)*22;
  const w=12,d=12,h=5+(j%2)*1.8;
  const color=['terracotta','sand','teal','stone'][(j+n)%4];
  buildings.push({x,z,w,d,h,color,kind:p.kind});
  // U-shaped wall and a wide south doorway. Interior and exterior anchors stay on ground.
  box(x-w/2,z,.7,d,h,color);box(x+w/2,z,.7,d,h,color);
  box(x,z-d/2,w,.7,h,color);
  box(x-4.4,z+d/2,3.2,.7,h,color);box(x+4.4,z+d/2,3.2,.7,h,color);
  box(x,z+d/2,w,.7,1.2,color,h-1.2);
  // A half roof leaves a skylight and a reachable indoor chest.
  box(x-3,z,6.6,d+.5,.35,'stone',h);
  for(let k=0;k<Math.ceil(h/.4);k++) box(x-8,z+7-k*.9,2,.92,Math.min(h+.35,(k+1)*.4),'stone');
  chests.push({x:x+2.5,y:0,z:z-2});
  floorLoot.push({x:x+2,y:0,z:z+3},{x:x+10,y:0,z:z+5},{x:x-3,y:h+.35,z:z-2});
 }
 chests.push({x:p.x+(p.kind==='resort'?4:0),y:0,z:p.z});
 floorLoot.push({x:p.x-5,y:0,z:p.z+5},{x:p.x+6,y:0,z:p.z+6});
 for(let k=0;k<6;k++) {
  const a=k*Math.PI/3+.2;
  box(p.x+Math.cos(a)*39,p.z+Math.sin(a)*39,3.2,2.8,1.3,k%2?'crate':'stone');
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
// Sparse, reproducible cover along rotations, with clear trunk collision.
for(let i=0;i<130;i++) {
 const a=i*2.399963,r=45+Math.sqrt((i*53%130)/130)*185;
 const x=Math.cos(a)*r,z=Math.sin(a)*r;
 if(DISTRICTS.some(p=>Math.hypot(p.x-x,p.z-z)<48))continue;
 if(Math.abs(x)<9||Math.abs(z)<9)continue;
 trees.push({x,z,h:5+(i%4),kind:i%3});
 box(x,z,.9,.9,5,'crate');
 if(i%3===0){chests.push({x:x+2,y:0,z:z+2});floorLoot.push({x:x+3,y:0,z:z-2});}
}
// Small roadside shelters reduce empty travel and ensure outer drops can equip.
for(const [x,z] of [[-75,-75],[75,-75],[-75,75],[75,75],[-95,0],[95,0],[0,-95],[0,95]]) {
 box(x-4,z,1,9,3.4,'crate');box(x+4,z,1,9,3.4,'crate');box(x,z,9,9,.35,'sand',3.4);
 chests.push({x,y:0,z});floorLoot.push({x,y:0,z:z+6});
}
export const ROYALE_MAP={id:'sunnybreak',name:'Sunnybreak Island',tag:'BATTLE ROYALE • 512 × 512',description:'Nine districts. One surviving egg.',size:256,navCell:2.5,sky:0xafdfe8,ground:0x86b87c,accent:0xf6cc66,theme:'royale',zone:[0,0,0],bases:[[-230,0],[230,0]],spawns:[[0,0],[-75,-75],[75,-75],[-75,75],[75,75]],lanes:[],boxes,props:[],pickups:[],districts:DISTRICTS,buildings,trees,chests,floorLoot};
