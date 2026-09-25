// Lossless deltas on an ordered connection. Each new connection starts with a
// complete baseline. Encoding happens at flush, after stale snapshots merge.
const recordKeys=['players','projectiles'];
function records(value){return Object.fromEntries(value.map(row=>[row.id,row]));}
function normalize(message){
 const value=JSON.parse(JSON.stringify(message));
 for(const key of recordKeys)if(Array.isArray(value.state?.[key]))value.state[key]=records(value.state[key]);
 if(Array.isArray(value.checkpoint?.simulation?.players))value.checkpoint.simulation.players=records(value.checkpoint.simulation.players);
 return value;
}
function patch(previous,next){
 if(Object.is(previous,next))return undefined;
 if(!previous||!next||typeof previous!=='object'||typeof next!=='object'||Array.isArray(previous)||Array.isArray(next))
  return JSON.stringify(previous)===JSON.stringify(next)?undefined:[next];
 const changes=Object.create(null);
 for(const key of Object.keys(previous))if(!Object.hasOwn(next,key))changes[key]=[];
 for(const key of Object.keys(next)){const change=patch(previous[key],next[key]);if(change!==undefined)changes[key]=change;}
 return Object.keys(changes).length?changes:undefined;
}
function apply(previous,changes){
 if(Array.isArray(changes))return changes[0];
 const next={...previous};
 for(const [key,change] of Object.entries(changes)){
  if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid snapshot key');
  if(Array.isArray(change)&&!change.length)delete next[key];else next[key]=apply(previous?.[key],change);
 }
 return next;
}
export class SnapshotEncoder {
 constructor(){this.reset();}
 reset(){this.previous=null;this.seq=0;}
 encode(message){
  // Keep the recovery checkpoint in the baseline so its unchanged fields also
  // disappear from the wire. The receiver retains it for host migration.
  const next=normalize(message);
  if(!next.checkpoint&&this.previous?.checkpoint)next.checkpoint=this.previous.checkpoint;
  const frame=this.previous?{base:this.seq,seq:this.seq+1,patch:patch(this.previous,next)||{}}:{base:0,seq:1,full:next};
  this.previous=next;this.seq=frame.seq;return {type:'snapshot-v1',frame};
 }
}
export class SnapshotDecoder {
 constructor(){this.previous=null;this.seq=0;}
 decode(frame){
  if(!frame||!Number.isSafeInteger(frame.seq))return null;
  if(frame.base===0&&frame.full){this.previous=frame.full;this.seq=frame.seq;}
  else {
   if(!this.previous||frame.base!==this.seq||frame.seq!==this.seq+1)return null;
   try{this.previous=apply(this.previous,frame.patch);this.seq=frame.seq;}catch{return null;}
  }
  // Game/UI sanitization must never mutate the next delta's baseline.
  const {checkpoint,...rest}=this.previous;
  const message=structuredClone(rest);
  if(checkpoint&&(frame.full||Object.hasOwn(frame.patch||{},'checkpoint')))message.checkpoint=structuredClone(checkpoint);
  for(const key of recordKeys)if(message.state?.[key])message.state[key]=Object.values(message.state[key]);
  if(message.checkpoint?.simulation?.players)message.checkpoint.simulation.players=Object.values(message.checkpoint.simulation.players);
  return message;
 }
}
