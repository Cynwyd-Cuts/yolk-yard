// Secure-WebSocket game transport. D1 mailboxes cross Worker/isolate boundaries;
// no correctness depends on two players reaching the same process.
const TTL=25000, MAX_FRAME=2_000_000, MAX_QUEUE=8_000_000;
const address=/^yolk-yard-v\d+-[A-Z2-9]{8}$/;
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
export class RelaySession {
 constructor(db,ws){this.queries=0;this.rotateRequested=false;this.rotating=false;this.ws=ws;
  const count=n=>{this.queries+=n;if(this.id&&!this.rotateRequested&&this.queries>=350){this.rotateRequested=true;this.send({type:'rotate-request'});}};
  this.db={prepare:sql=>({bind:(...args)=>{const stmt=db.prepare(sql).bind(...args);return {raw:stmt,first:()=>{count(1);return stmt.first();},all:()=>{count(1);return stmt.all();},run:()=>{count(1);return stmt.run();}};}}),batch:statements=>{count(statements.length);return db.batch(statements.map(s=>s.raw||s));}};this.token=crypto.randomUUID();this.id=null;this.closed=false;this.links=new Map();this.tail=Promise.resolve();this.queued=0;this.cursor=0;this.parts='';this.lastSeen=Date.now();this.lastTouch=0;this.rateAt=0;this.bytes=0;this.frames=0;this.lastList=0;this.lastPublish=0;}
 send(data){if(!this.closed)this.ws.send(JSON.stringify(data));}
 async deliver(recipient,messages){
  const data=JSON.stringify(messages), statements=[];
  for(let i=0;i<data.length;i+=14000)statements.push(q(this.db,'INSERT INTO relay_packets(recipient,data,final,expires) VALUES(?,?,?,?)',recipient,data.slice(i,i+14000),i+14000>=data.length?1:0,Date.now()+30000));
  // An atomic batch prevents fragments from separate writers interleaving.
  await this.db.batch(statements);
 }
 receive(raw){
  if(this.closed)return;
  if(typeof raw!=='string'||raw.length>MAX_FRAME)return this.fail();
  const now=Date.now();if(now-this.rateAt>=1000){this.rateAt=now;this.bytes=0;this.frames=0;}
  this.bytes+=raw.length;if(++this.frames>100||this.bytes>MAX_QUEUE)return this.fail();
  this.queued+=raw.length;if(this.queued>MAX_QUEUE)return this.fail();
  this.lastSeen=now;
  this.tail=this.tail.then(async()=>{if(!this.closed)await this.handle(JSON.parse(raw));}).catch(()=>this.fail()).finally(()=>{this.queued-=raw.length;});
 }
 async handle(m){
  if(!m||typeof m!=='object')throw Error('Invalid envelope');
  if(m.type==='register'&&!this.id){
   if(m.resume){
    if(typeof m.resume!=='string'||m.resume.length!==36||typeof m.id!=='string'||!Number.isSafeInteger(m.cursor)||m.cursor<0)throw Error('Invalid resume');
    const existing=await q(this.db,'SELECT id FROM relay_peers WHERE id=? AND token=? AND seen>?',m.id,m.resume,Date.now()-TTL).first();
    if(!existing)throw Error('Expired resume');
    this.id=m.id;this.token=m.resume;this.cursor=m.cursor;this.parts=typeof m.parts==='string'?m.parts:'';if(this.parts.length>MAX_QUEUE)throw Error('Invalid resume');this.lastTouch=0;
    const links=await q(this.db,'SELECT id,a,b FROM relay_links WHERE a=? OR b=?',this.token,this.token).all();
    for(const link of links.results)this.links.set(link.id,link.a===this.token?link.b:link.a);
    this.send({type:'ready',id:this.id,resumed:true});return;
   }
   const id=m.id===undefined?`player-${crypto.randomUUID()}`:m.id;
   if(typeof id!=='string'||(m.id!==undefined&&!address.test(id)))throw Error('Invalid address');
   // Claim only an absent/expired address. Tokens never leave the server.
   const row=await q(this.db,'INSERT INTO relay_peers(id,token,seen) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,seen=excluded.seen,listing=NULL,listed_at=0 WHERE relay_peers.seen<? RETURNING id',id,this.token,Date.now(),Date.now()-TTL).first();
   if(!row){this.send({type:'error',error:'unavailable-id'});return;}
   this.id=id;this.lastTouch=Date.now();this.send({type:'ready',id});return;
  }
  if(!this.id)throw Error('Register first');
  if(m.type==='rotate'){
   this.rotating=true;clearTimeout(this.timer);await this.pollTask;
   // Finish the current poll and outbound queue before handing off the cursor.
   // All connections survive; only the Worker invocation is renewed.
   this.send({type:'rotated',id:this.id,resume:this.token,cursor:this.cursor,parts:this.parts});
   this.closed=true;this.ws.close(1000,'Connection renewed');return;
  }
  if(m.type==='heartbeat'){this.send({type:'alive'});return;}
  if(m.type==='list'){
   if(Date.now()-this.lastList<300)return;this.lastList=Date.now();
   const rows=await q(this.db,'SELECT listing FROM relay_peers WHERE seen>? AND listed_at>? AND listing IS NOT NULL LIMIT 100',Date.now()-TTL,Date.now()-10000).all();
   this.send({type:'rooms',request:m.request,rooms:rows.results.map(r=>JSON.parse(r.listing))});return;
  }
  if(m.type==='publish'){
   if(!address.test(this.id))throw Error('Only a room address may publish');
   const r=m.room;let listing=null;
   if(r){
    if(this.id!==`yolk-yard-v${r.version}-${r.code}`||!['lobby','playing','results'].includes(r.phase)||!Number.isInteger(r.players)||r.players<1||r.players>20)throw Error('Invalid listing');
    listing=JSON.stringify({code:r.code,version:r.version,host:String(r.host||'Egg').slice(0,32),map:String(r.map||'').slice(0,24),mode:String(r.mode||'').slice(0,24),players:r.players,capacity:Math.max(2,Math.min(20,Number(r.capacity)||8)),phase:r.phase});
   }
   await q(this.db,'UPDATE relay_peers SET listing=?,listed_at=? WHERE id=? AND token=?',listing,Date.now(),this.id,this.token).run();return;
  }
  if(m.type==='connect'){
   if(typeof m.channel!=='string'||!/^[-a-z0-9]{36}$/.test(m.channel)||typeof m.target!=='string'||this.links.size>=20)throw Error('Invalid connection');
   const peer=await q(this.db,'SELECT token FROM relay_peers WHERE id=? AND seen>?',m.target,Date.now()-TTL).first();
   if(!peer||peer.token===this.token){this.send({type:'error',channel:m.channel,error:'peer-unavailable'});return;}
   const count=await q(this.db,'SELECT count(*) AS n FROM relay_links WHERE a=? OR b=?',peer.token,peer.token).first();
   if(count.n>=20){this.send({type:'error',channel:m.channel,error:'peer-unavailable'});return;}
   await q(this.db,'INSERT INTO relay_links(id,a,b,a_id,b_id) VALUES(?,?,?,?,?)',m.channel,this.token,peer.token,this.id,m.target).run();
   this.links.set(m.channel,peer.token);
   await this.deliver(peer.token,[{type:'incoming',channel:m.channel,peer:this.id}]);return;
  }
  if(m.type==='batch'){
   if(!Array.isArray(m.messages)||m.messages.length>128)throw Error('Invalid batch');
   const groups=new Map();
   for(const entry of m.messages){
    if(!entry||typeof entry.channel!=='string'||!['accept','data','close'].includes(entry.type))throw Error('Invalid message');
    let recipient=this.links.get(entry.channel);
    if(!recipient){
     const link=await q(this.db,'SELECT a,b FROM relay_links WHERE id=? AND (a=? OR b=?)',entry.channel,this.token,this.token).first();
     if(!link){this.send({type:'closed',channel:entry.channel});continue;}
     recipient=link.a===this.token?link.b:link.a;this.links.set(entry.channel,recipient);
    }
    const outgoing={type:entry.type==='accept'?'opened':entry.type==='close'?'closed':'data',channel:entry.channel};
    if(entry.type==='data')outgoing.data=entry.data;
    if(!groups.has(recipient))groups.set(recipient,[]);groups.get(recipient).push(outgoing);
    if(entry.type==='close'){await q(this.db,'DELETE FROM relay_links WHERE id=? AND (a=? OR b=?)',entry.channel,this.token,this.token).run();this.links.delete(entry.channel);}
   }
   for(const [recipient,messages] of groups)await this.deliver(recipient,messages);
   return;
  }
  throw Error('Unknown message');
 }
 async poll(){
  if(this.closed||this.rotating)return;
  this.pollTask=this.tick();await this.pollTask;
  if(!this.closed&&!this.rotating)this.timer=setTimeout(()=>this.poll(),this.links.size?80:300);
 }
 async tick(){
  if(this.closed)return;
  try{
   const now=Date.now();if(now-this.lastSeen>TTL){await this.close();return;}
   if(this.id){
    if(now-this.lastTouch>5000){
     const alive=await q(this.db,'UPDATE relay_peers SET seen=? WHERE id=? AND token=? RETURNING id',now,this.id,this.token).first();
     if(!alive){await this.close();return;}this.lastTouch=now;
     // Bounded ephemeral data; stale peers and links disappear without relying on close events.
     await this.db.batch([q(this.db,'DELETE FROM relay_packets WHERE expires<?',now),q(this.db,'DELETE FROM relay_peers WHERE seen<?',now-TTL),q(this.db,'DELETE FROM relay_links WHERE a NOT IN (SELECT token FROM relay_peers) OR b NOT IN (SELECT token FROM relay_peers)')]);
     const live=await q(this.db,'SELECT id FROM relay_links WHERE a=? OR b=?',this.token,this.token).all();const ids=new Set(live.results.map(r=>r.id));
     for(const id of this.links.keys())if(!ids.has(id)){this.links.delete(id);this.send({type:'closed',channel:id});}
    }
    const rows=await q(this.db,'SELECT seq,data,final FROM relay_packets WHERE recipient=? AND seq>? ORDER BY seq LIMIT 256',this.token,this.cursor).all();
    for(const row of rows.results){this.cursor=row.seq;this.parts+=row.data;if(this.parts.length>MAX_QUEUE)throw Error('Overloaded');if(row.final){this.ws.send(this.parts);this.parts='';}}
    if(rows.results.length)await q(this.db,'DELETE FROM relay_packets WHERE recipient=? AND seq<=?',this.token,this.cursor).run();
   }
  }catch{this.fail();return;}

 }
 fail(){this.send({type:'error',error:'server-error'});this.close().catch(()=>{});}
 async close(){
  if(this.closed)return;this.closed=true;clearTimeout(this.timer);try{this.ws.close(1000,'Session ended');}catch{}
  // Other sockets notice the deleted links even when the network lost close notifications.
  await this.tail.catch(()=>{});
  await this.db.batch([q(this.db,'DELETE FROM relay_peers WHERE token=?',this.token),q(this.db,'DELETE FROM relay_links WHERE a=? OR b=?',this.token,this.token),q(this.db,'DELETE FROM relay_packets WHERE recipient=?',this.token)]);
 }
}
export function gameSocket(_request,env){
 const [client,ws]=Object.values(new WebSocketPair());ws.accept();const session=new RelaySession(env.DB,ws);
 ws.addEventListener('message',e=>session.receive(e.data));
 ws.addEventListener('close',()=>session.close().catch(()=>{}));ws.addEventListener('error',()=>session.close().catch(()=>{}));
 session.poll();return new Response(null,{status:101,webSocket:client});
}
