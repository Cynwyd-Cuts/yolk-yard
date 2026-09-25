// Bounded, local-only measurements. No names, addresses, room codes or content.
const p95=values=>{const s=[...values].sort((a,b)=>a-b);return s.length?s[Math.floor((s.length-1)*.95)]:0;};
export class NetworkStats {
 constructor(){this.reset();}
 reset(){this.samples=[];this.inputs=new Map();this.acks=[];this.corrections=[];}
 sent(seq,now){this.inputs.set(seq,now);if(this.inputs.size>240)this.inputs.delete(this.inputs.keys().next().value);}
 update(sample){
  const sent=this.inputs.get(sample.ack);
  if(sent!==undefined){this.acks.push(sample.now-sent);if(this.acks.length>120)this.acks.shift();}
  for(const seq of this.inputs.keys())if(seq<=sample.ack)this.inputs.delete(seq);
  if(Number.isFinite(sample.correction)){this.corrections.push(sample.correction);if(this.corrections.length>120)this.corrections.shift();}
  this.samples.push(sample);if(this.samples.length>120)this.samples.shift();
 }
 text(){
  const last=this.samples.at(-1),first=this.samples[0];if(!last)return 'Network: no guest gameplay sample yet.';
  const gaps=this.samples.slice(1).map((s,i)=>s.now-this.samples[i].now),seconds=(last.now-first.now)/1000;
  const rate=seconds>0?(last.time-first.time)/seconds:0;
  const incoming=seconds>0?Math.max(0,last.received-first.received)/seconds/1024:0;
  const outgoing=seconds>0?Math.max(0,last.sent-first.sent)/seconds/1024:0;
  const ms=n=>Number.isFinite(n)?Math.round(n)+' ms':'n/a';
  return `Network: host RTT ${ms(last.rtt)}; relay RTT ${ms(last.relayRtt)}; input acknowledgement p95 ${ms(p95(this.acks))}; update gap p95 ${ms(p95(gaps))}, max ${ms(gaps.length?Math.max(...gaps):0)}.\nTraffic: down ${incoming.toFixed(1)} KB/s, up ${outgoing.toFixed(1)} KB/s; outgoing queue ${Math.round((last.queued||0)/1024)} KB; unacknowledged batches ${last.batches||0}; host input queue ${last.hostQueue??'n/a'} steps; host clock ${rate.toFixed(2)}× real time.\nPrediction: correction p95 ${p95(this.corrections).toFixed(3)} units; corrections over 0.1 units ${this.corrections.filter(n=>n>.1).length}/${this.corrections.length}.`;
 }
}
