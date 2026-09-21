// One triangulated heightfield drives rendering, walking, ballistics and navigation.
const smooth = t => { t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
export const HILLS = [
  [-88,-55,44,7], [85,58,48,8], [-78,76,44,6], [77,-73,43,7],
  [-222,-99,36,6], [218,82,34,5], [-90,-225,40,6], [95,222,42,7],
  [-213,220,36,8], [220,-216,40,8], [-215,-216,38,7], [224,224,38,6],
];
export function createTerrain(buildings, districts, shelters=[]) {
  const size=256,cell=2,n=257,heights=new Float32Array(n*n);
  let max=0;
  for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
    const x=ix*cell-size,z=iz*cell-size;
    let h=0,flat=1;
    for(const [hx,hz,r,peak] of HILLS){const t=Math.hypot(x-hx,z-hz)/r;if(t<1)h+=peak*(1-t*t)**2;}
    if(h){
      for(const b of buildings)flat=Math.min(flat,smooth((Math.max(Math.abs(x-b.x)-b.w/2,Math.abs(z-b.z)-b.d/2)-5)/18));
      for(const p of districts){
        flat=Math.min(flat,smooth((Math.hypot(x-p.x,z-p.z)-15)/16));
        const length=p.x*p.x+p.z*p.z;
        if(length){const t=Math.max(0,Math.min(1,(x*p.x+z*p.z)/length));flat=Math.min(flat,smooth((Math.hypot(x-t*p.x,z-t*p.z)-7)/16));}
      }
      for(const p of shelters)flat=Math.min(flat,smooth((Math.hypot(x-p.x,z-p.z)-10)/14));
      flat*=smooth((size-Math.max(Math.abs(x),Math.abs(z)))/12);
    }
    heights[iz*n+ix]=h*flat;max=Math.max(max,h*flat);
  }
  return {size,cell,n,heights,max};
}
export function groundAt(map,x,z) {
  const t=map.terrain;if(!t)return 0;
  const gx=Math.max(0,Math.min(t.n-1.000001,(x+t.size)/t.cell)),gz=Math.max(0,Math.min(t.n-1.000001,(z+t.size)/t.cell));
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*t.n+ix;
  const a=t.heights[i],b=t.heights[i+1],c=t.heights[i+t.n],d=t.heights[i+t.n+1];
  return u+v<=1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function terrainHit(map,o,d,max=200,radius=0) {
  if(!map.terrain){
    if(d.y>=0)return null;const distance=(radius-o.y)/d.y;
    return distance>=0&&distance<=max?{distance,point:{x:o.x+d.x*distance,y:radius,z:o.z+d.z*distance},normal:{x:0,y:1,z:0}}:null;
  }
  if(max<0||Math.min(o.y,o.y+d.y*max)>map.terrain.max+radius)return null;
  const clearance = s => o.y+d.y*s-radius-groundAt(map,o.x+d.x*s,o.z+d.z*s);
  let prev=0,hit=clearance(0)<=0?0:null;
  const steps=Math.max(1,Math.ceil(max*Math.max(Math.hypot(d.x,d.z),Math.abs(d.y))/1));
  for(let i=1;hit===null&&i<=steps;i++){
    const at=max*i/steps;
    if(clearance(at)<=0){let a=prev,b=at;for(let j=0;j<10;j++){const m=(a+b)/2;if(clearance(m)>0)a=m;else b=m;}hit=b;}
    prev=at;
  }
  if(hit===null)return null;
  const point={x:o.x+d.x*hit,y:o.y+d.y*hit,z:o.z+d.z*hit};
  const nx=(groundAt(map,point.x-.1,point.z)-groundAt(map,point.x+.1,point.z))/.2;
  const nz=(groundAt(map,point.x,point.z-.1)-groundAt(map,point.x,point.z+.1))/.2, l=Math.hypot(nx,1,nz);
  return {distance:hit,point,normal:{x:nx/l,y:1/l,z:nz/l}};
}
