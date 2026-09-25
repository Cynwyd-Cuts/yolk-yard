import {mergeRelayMessage} from './relay-queue.js';
// Peer-shaped, ordered WebSocket transport; the game rules stay in Network.
// Explicit peer configuration retains the local WebRTC development path.
export const relayURL=()=>globalThis.window?.YOLK_NETWORK?.relay||'';
class Events {
 constructor(){this.events=new Map();}
 on(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);return this;}
 emit(type,value){for(const fn of this.events.get(type)||[])fn(value);}
}
class RelayConnection extends Events {
 constructor(owner,peer,channel){super();this.owner=owner;this.peer=peer;this.channel=channel;this.open=false;this.closed=false;this.queuedBytes=0;const self=this;this.dataChannel={get bufferedAmount(){const shared=self.owner.socket?.bufferedAmount||0;return self.queuedBytes+(shared>1048576?shared:0);}};}
 send(data){if(this.open&&!this.closed)this.owner.enqueue({type:'data',channel:this.channel,data});}
 opened(){if(this.closed||this.open)return;this.open=true;this.emit('open');}
 finish(){if(this.closed)return;this.closed=true;this.open=false;this.owner.connections.delete(this.channel);this.emit('close');}
 close(){if(this.closed)return;this.owner.enqueue({type:'close',channel:this.channel});this.owner.flush();this.finish();}
}
export class RelayPeer extends Events {
 constructor(id){
  super();this.id=id;this.destroyed=false;this.disconnected=false;this.connections=new Map();this.waiters=new Map();this.queue=[];this.queueBytes=0;this.requestId=0;this.deferredControls=[];this.commandSeq=0;this.unacked=new Map();this.cursor=0;this.protocol=1;
  // Defer errors so Network can attach listeners before anything fires.
  queueMicrotask(()=>this.start());
 }
 get bufferedAmount(){return (this.socket?.bufferedAmount||0)+this.queueBytes;}
 start(){
  if(this.destroyed)return;
  try{this.socket=new WebSocket(relayURL());}catch{this.emit('error',{type:'socket-error'});return;}
  const ws=this.socket;this.lastMessage=Date.now();
  ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'register',...(this.id?{id:this.id}:{}),...this.resume,...(this.protocol===2?{cursor:this.cursor}:{})})));
  ws.addEventListener('message',event=>{
   if(ws!==this.socket)return;this.lastMessage=Date.now();let data;try{data=JSON.parse(event.data);}catch{return this.destroy();}
   for(const m of Array.isArray(data)?data:[data]){
    if(m.relaySeq){
     if(m.relaySeq<=this.cursor){this.control({type:'ack',seq:this.cursor});continue;}
     if(m.relaySeq!==this.cursor+1){ws.close();return;}
     this.message(m);this.cursor=m.relaySeq;this.control({type:'ack',seq:this.cursor});
    }else this.message(m);
   }
  });
  ws.addEventListener('error',()=>{if(!this.destroyed&&ws===this.socket&&this.protocol!==2)this.emit('error',{type:'socket-error'});});
  ws.addEventListener('close',event=>{
   if(this.destroyed||ws!==this.socket)return;
   const reasons=['Server stopping','Connection too slow','Rate limit','Command sequence','Invalid relay message','Expired resume','Register first'];
   this.emit('transport-close',{code:Number.isInteger(event.code)?event.code:0,reason:reasons.includes(event.reason)?event.reason:'unspecified'});
   if(this.protocol===2&&this.resume){
    this.reconnecting=true;this.rotating=true;
    if(!this.reconnectUntil){
     this.reconnectUntil=Date.now()+8000;
     this.reconnectDeadline=setTimeout(()=>{if(!this.reconnecting||this.destroyed)return;this.emit('error',{type:'socket-closed'});this.emit('disconnected');this.destroy();},8000);
    }
    if(Date.now()<this.reconnectUntil){this.emit('reconnecting');clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.start(),400);return;}
   }
   this.disconnected=true;this.emit('error',{type:'socket-closed'});
   for(const conn of [...this.connections.values()])conn.finish();
   this.emit('disconnected');this.destroy();
  });
  clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(Date.now()-this.lastMessage>18000)ws.close();else this.control({type:'heartbeat'});},3000);
 }
 control(message){
  if(this.protocol===2&&['heartbeat','ack'].includes(message.type)){
   if(this.socket?.readyState===1)this.socket.send(JSON.stringify(message));return;
  }
  if(this.destroyed)return;
  if(this.rotating&&!['register','rotate'].includes(message.type)){
   if(message.type==='heartbeat')return;
   if(message.type==='publish')this.deferredControls=this.deferredControls.filter(m=>m.type!=='publish');
   if(this.deferredControls.length>=64){this.destroy();return;}
   this.deferredControls.push(message);return;
  }
  if(this.socket?.readyState===1){
   if(this.protocol===2){message={...message,seq:++this.commandSeq};this.unacked.set(message.seq,message);}
   this.socket.send(JSON.stringify(message));
  }
 }
 message(m){
  if(!m||typeof m!=='object')return;
  if(m.type==='command-ack'){for(const seq of this.unacked.keys())if(seq<=m.seq)this.unacked.delete(seq);return;}
  if(m.type==='rotate-request'){this.flush();this.rotating=true;this.control({type:'rotate'});return;}
  if(m.type==='rotated'){this.resume={resume:m.resume,cursor:m.cursor,parts:m.parts};this.start();return;}
  if(m.type==='ready'){
   this.id=m.id;this.rotating=false;
   if(m.protocol===2){
    this.protocol=2;this.resume={resume:m.resume};this.reconnecting=false;this.reconnectUntil=null;clearTimeout(this.reconnectDeadline);
    for(const message of this.unacked.values())this.socket.send(JSON.stringify(message));
    if(m.resumed)this.emit('reconnected');
   }if(m.resumed){this.flush();for(const message of this.deferredControls)this.control(message);this.deferredControls=[];}else this.emit('open',this.id);return;}
  if(m.type==='rooms'){const waiter=this.waiters.get(m.request);if(waiter){this.waiters.delete(m.request);waiter.resolve(m.rooms);}return;}
  if(m.type==='error'){
   const conn=this.connections.get(m.channel);if(conn){conn.emit('error',{type:m.error});conn.finish();}
   this.emit('error',{type:m.error});return;
  }
  if(m.type==='incoming'){
   if(this.connections.size>=20)return this.enqueue({type:'close',channel:m.channel});
   const conn=new RelayConnection(this,m.peer,m.channel);this.connections.set(m.channel,conn);
   this.emit('connection',conn);
   if(!conn.closed){this.enqueue({type:'accept',channel:m.channel});this.flush();conn.opened();}return;
  }
  const conn=this.connections.get(m.channel);if(!conn)return;
  if(m.type==='opened')conn.opened();
  else if(m.type==='data'&&!conn.closed)conn.emit('data',m.data);
  else if(m.type==='closed')conn.finish();
 }
 connect(peer){
  const channel=crypto.randomUUID(),conn=new RelayConnection(this,peer,channel);this.connections.set(channel,conn);
  this.control({type:'connect',target:peer,channel});return conn;
 }
 enqueue(message){
  if(this.destroyed)return;
  // Merge only compatible adjacent updates, retaining world data and action edges.
  const last=this.queue.at(-1),merged=mergeRelayMessage(last,message);
  if(merged){
   const oldBytes=JSON.stringify(last).length;this.queue.pop();this.queueBytes-=oldBytes;
   const conn=this.connections.get(last.channel);if(conn)conn.queuedBytes-=oldBytes;
   message=merged;
  }
  const bytes=JSON.stringify(message).length;
  if(this.queueBytes+bytes>1_800_000){this.emit('error',{type:'server-error'});this.destroy();return;}
  this.queue.push(message);this.queueBytes+=bytes;const conn=this.connections.get(message.channel);if(conn)conn.queuedBytes+=bytes;
  if(this.queue.length>=64||this.queueBytes>200000)this.flush();
  else if(!this.flushTimer)this.flushTimer=setTimeout(()=>this.flush(),8);
 }
 flush(){
  if(this.destroyed)return;
  if(this.rotating||this.socket?.readyState!==1||this.socket.bufferedAmount>65536||this.unacked.size>32){
   clearTimeout(this.flushTimer);this.flushTimer=setTimeout(()=>this.flush(),20);return;
  }clearTimeout(this.flushTimer);this.flushTimer=null;if(!this.queue.length)return;const messages=this.queue.splice(0,64);this.queueBytes=this.queue.reduce((n,m)=>n+JSON.stringify(m).length,0);for(const conn of this.connections.values())conn.queuedBytes=this.queue.filter(m=>m.channel===conn.channel).reduce((n,m)=>n+JSON.stringify(m).length,0);if(this.queue.length)this.flushTimer=setTimeout(()=>this.flush(),10);this.control({type:'batch',messages});}
 publish(room){this.control({type:'publish',room});}
 list(){
  const request=++this.requestId;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters.delete(request);reject(Error('The room directory did not respond.'));},10000);this.waiters.set(request,{resolve:rooms=>{clearTimeout(timer);resolve(rooms);},reject:()=>{clearTimeout(timer);reject(Error('The room directory disconnected.'));}});this.control({type:'list',request});});
 }
 destroy(){
  if(this.destroyed)return;this.flush();this.destroyed=true;clearTimeout(this.flushTimer);clearInterval(this.heartbeat);clearTimeout(this.reconnectTimer);clearTimeout(this.reconnectDeadline);
  if(this.protocol===2&&this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'bye'}));
  for(const waiter of this.waiters.values())waiter.reject();this.waiters.clear();
  for(const conn of [...this.connections.values()])conn.finish();
  this.socket?.close();
 }
}
