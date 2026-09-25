export class FrameStats {
 constructor(){this.frames=[];this.updates=[];this.role='unknown';this.mode='unknown';this.pending=0;}
 frame(ms,role,mode){if(!(ms>0)||!Number.isFinite(ms))return;this.frames.push(ms);if(this.frames.length>300)this.frames.shift();this.role=role;this.mode=mode;}
 update(ms,pending){if(!Number.isFinite(ms))return;this.updates.push(ms);if(this.updates.length>60)this.updates.shift();this.pending=pending;}
 text(){
  if(!this.frames.length)return 'Performance: no gameplay sample yet.';
  const mean=this.frames.reduce((a,b)=>a+b,0)/this.frames.length;
  const sorted=[...this.frames].sort((a,b)=>a-b),p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
  const update=this.updates.length?Math.max(...this.updates).toFixed(1):'n/a';
  return `Performance: ${this.role}, ${this.mode}; ${Math.round(1000/mean)} FPS; frame p95 ${p95.toFixed(1)} ms; worst recent state processing ${update} ms; pending inputs ${this.pending}.`;
 }
}
