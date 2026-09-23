// Connected galleries and an upper crossing, with matching solid geometry.
// These additions only belong to the three arena maps; Sunnybreak is separate.
export function addArenaLayers(map){
 const put=(x,z,w,d,h,y=0,color='stone',kind='gallery')=>map.boxes.push({x,z,w,d,h,y,color,kind});
 const x=map.id==='yard'?26:map.id==='depot'?27:28;
 const deck=3.2,span=46;
 for(const sign of [-1,1]){
  put(sign*x,0,4,span,.35,deck-.35,map.theme==='harbor'?'steel':'sand');
  for(const z of [-19,19])put(sign*x,z,.65,.65,deck-.35,0,'navy','column');
  // Two independent street approaches prevent one doorway controlling the route.
  for(const end of [-1,1])for(let i=0;i<8;i++)put(sign*x,end*(34-i*1.5),4,1.52,(i+1)*.4,0,'stone','step');
  for(const z of [-16,-6,6,16])put(sign*(x+1.85),z,.28,4,.8,deck,'stone','parapet');
  // Stairs on the gallery climb to the second crossing at 6.4m.
  for(let i=0;i<8;i++)put(sign*x,-12+i*1.5,3,1.52,(i+1)*.4,deck,'stone','step');
  // Short links connect the existing rooftop/deck rather than isolated towers.
  const linkZ=map.id==='depot'?0:sign*14;
  put(sign*((x+19)/2),linkZ,x-19+1,4,.35,deck-.35,map.theme==='harbor'?'steel':'sand');
  map.pickups.push([sign*x,16,'ammo']);
 }
 put(0,0,x*2+4,4,.35,6.05,map.theme==='harbor'?'steel':'stone','skybridge');
 for(const sign of [-1,1])for(const at of [-19,-8,8,19])put(at,sign*1.86,5,.28,.82,6.4,'navy','parapet');
 // Broad low terraces shorten exposed approaches and provide usable elevation.
 for(const sign of [-1,1]){
  const z=sign*25;
  put(sign*9,z,8,7,1.2,0,map.theme==='town'?'terracotta':'stone','terrace');
  for(let i=0;i<3;i++)put(sign*9,z+sign*(5.7-i*1.1),4,1.12,(i+1)*.4,0,'stone','step');
 }
 map.description+=' Connected side galleries and a high crossing create three playable levels.';
}
