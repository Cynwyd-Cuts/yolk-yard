// Render-only smoothing: collision, aim and network positions stay authoritative.
export function stairCamera(previous,p,dt,identity){
 const continuous=previous&&previous.identity===identity&&Math.hypot(p.x-previous.x,p.z-previous.z)<2&&Math.abs(p.y-previous.target)<.9;
 const smooth=continuous&&p.grounded&&previous.grounded;
 const y=smooth?previous.y+(p.y-previous.y)*(1-Math.exp(-18*Math.max(0,dt))):p.y;
 return {identity,x:p.x,z:p.z,target:p.y,grounded:p.grounded,y:Math.max(p.y-.42,Math.min(p.y+.42,y))};
}
