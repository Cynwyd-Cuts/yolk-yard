import {randomUUID} from 'node:crypto';
import {mergeRelayMessage} from '../../src/relay-queue.js';
const MAX_FRAME=2_000_000, MAX_QUEUE=4_000_000, GRACE=10_000;
const address=/^yolk-yard-v\d+-[A-Z2-9]{8}$/;
// One persistent process owns every connected socket. No database in the data path.
export class RealtimeRelay {
  constructor(){this.peers=new Map();this.sessions=new Set();this.timer=setInterval(()=>this.sweep(),1000);this.timer.unref?.();}
  attach(ws){
    let peer; const started=Date.now();
    const registration=setTimeout(()=>{if(!peer)ws.close(1008,'Register first');},10000);registration.unref?.();
    ws.on('message',(raw,binary)=>{
      try{
        if(binary||raw.length>MAX_FRAME)throw Error('Invalid frame');
        const m=JSON.parse(raw.toString());
        if(!peer){
          if(m.type!=='register')throw Error('Register first');
          if(m.resume){
            peer=this.peers.get(m.id);
            if(!peer||peer.token!==m.resume||!Number.isSafeInteger(m.cursor)||m.cursor<peer.acked||m.cursor>peer.seq||peer.detachedAt&&Date.now()-peer.detachedAt>GRACE)throw Error('Expired resume');
            const old=peer.ws;peer.ws=null;old?.close(1000,'Resumed elsewhere');
            this.ack(peer,m.cursor);peer.ws=ws;
          }else{
            const id=m.id??`player-${randomUUID()}`;
            if(typeof id!=='string'||m.id!==undefined&&!address.test(id))throw Error('Invalid address');
            if(this.peers.has(id)){ws.send(JSON.stringify({type:'error',error:'unavailable-id'}));ws.close(1008,'Address taken');return;}
            if(this.peers.size>=1000)throw Error('Server full');
            peer={id,token:randomUUID(),ws,links:new Map(),pending:[],pendingBytes:0,seq:0,acked:0,clientSeq:0,history:[],historyBytes:0,lastSeen:Date.now(),rateAt:Date.now(),frames:0,bytes:0};
            this.peers.set(id,peer);this.sessions.add(peer);
          }
          clearTimeout(registration);peer.detachedAt=0;peer.lastSeen=Date.now();
          ws.send(JSON.stringify({type:'ready',id:peer.id,resumed:!!m.resume,resume:peer.token,protocol:2}));
          for(const item of peer.history)ws.send(item.raw);
          this.flush(peer);return;
        }
        if(peer.ws!==ws)return;
        peer.lastSeen=Date.now();
        if(Date.now()-peer.rateAt>=1000){peer.rateAt=Date.now();peer.frames=0;peer.bytes=0;}
        peer.bytes+=raw.length;if(++peer.frames>200||peer.bytes>16_000_000)throw Error('Rate limit');
        if(m.type==='heartbeat'){ws.send(JSON.stringify({type:'alive'}));return;}
        if(m.type==='ack'){this.ack(peer,m.seq);return;}
        if(m.type==='bye'){this.remove(peer);return;}
        // Client commands are replayed after reconnect. Apply each exactly once.
        if(!Number.isSafeInteger(m.seq)||m.seq<1||m.seq>peer.clientSeq+1)throw Error('Command sequence');
        if(m.seq>peer.clientSeq){this.handle(peer,m);peer.clientSeq=m.seq;}
        if(ws.readyState===1)ws.send(JSON.stringify({type:'command-ack',seq:peer.clientSeq}));
      }catch{ws.close(1008,'Invalid relay message');}
    });
    ws.on('close',()=>{clearTimeout(registration);if(peer?.ws===ws){peer.ws=null;peer.detachedAt=Date.now();}});
    ws.on('error',()=>{});
    return ()=>peer;
  }
  ack(peer,seq){
    if(!Number.isSafeInteger(seq)||seq<0||seq>peer.seq)throw Error('Invalid acknowledgement');
    if(seq<=peer.acked)return;peer.acked=seq;
    while(peer.history[0]?.seq<=seq){peer.historyBytes-=peer.history.shift().raw.length;}
    this.flush(peer);
  }
  send(peer,message){
    const last=peer.pending.at(-1),merged=mergeRelayMessage(last,message);
    if(merged){peer.pendingBytes-=JSON.stringify(last).length;peer.pending[peer.pending.length-1]=merged;message=merged;}
    else peer.pending.push(message);
    peer.pendingBytes+=JSON.stringify(message).length;
    if(peer.pendingBytes+peer.historyBytes>MAX_QUEUE){this.remove(peer,1013,'Connection too slow');return;}
    this.flush(peer);
  }
  flush(peer){
    // Leave space in the native queue for acknowledgements and heartbeats.
    while(peer.ws?.readyState===1&&peer.pending.length&&peer.ws.bufferedAmount<65536&&peer.historyBytes<262144){
      const message=peer.pending.shift();peer.pendingBytes-=JSON.stringify(message).length;
      const raw=JSON.stringify({...message,relaySeq:++peer.seq});
      peer.history.push({seq:peer.seq,raw});peer.historyBytes+=raw.length;peer.ws.send(raw);
    }
  }
  handle(peer,m){
    if(m.type==='list'){
      const rooms=[...this.peers.values()].filter(p=>p.ws&&p.listing&&Date.now()-p.listedAt<15000).map(p=>p.listing).slice(0,100);
      this.send(peer,{type:'rooms',request:m.request,rooms});return;
    }
    if(m.type==='publish'){
      if(!address.test(peer.id))throw Error('Not a room');
      const r=m.room;
      if(r&&(peer.id!==`yolk-yard-v${r.version}-${r.code}`||!['lobby','playing','results'].includes(r.phase)||!Number.isInteger(r.players)||r.players<1||r.players>20))throw Error('Invalid room');
      peer.listing=r?{code:r.code,version:r.version,host:String(r.host||'Egg').slice(0,32),map:String(r.map||'').slice(0,24),mode:String(r.mode||'').slice(0,24),players:r.players,capacity:Math.max(2,Math.min(20,Number(r.capacity)||8)),phase:r.phase}:null;
      peer.listedAt=Date.now();return;
    }
    if(m.type==='connect'){
      if(typeof m.channel!=='string'||!/^[-a-z0-9]{36}$/.test(m.channel)||peer.links.size>=20)throw Error('Invalid channel');
      const other=this.peers.get(m.target);
      if(!other||other===peer||other.links.size>=20){this.send(peer,{type:'error',channel:m.channel,error:'peer-unavailable'});return;}
      if(peer.links.has(m.channel)||other.links.has(m.channel))throw Error('Duplicate channel');
      peer.links.set(m.channel,other);other.links.set(m.channel,peer);
      this.send(other,{type:'incoming',channel:m.channel,peer:peer.id});return;
    }
    if(m.type==='batch'){
      if(!Array.isArray(m.messages)||m.messages.length>128)throw Error('Invalid batch');
      for(const entry of m.messages){
        if(!entry||!['accept','data','close'].includes(entry.type)||typeof entry.channel!=='string')throw Error('Invalid entry');
        const other=peer.links.get(entry.channel);
        if(!other){this.send(peer,{type:'closed',channel:entry.channel});continue;}
        this.send(other,{type:entry.type==='accept'?'opened':entry.type==='close'?'closed':'data',channel:entry.channel,...(entry.type==='data'?{data:entry.data}:{})});
        if(entry.type==='close'){peer.links.delete(entry.channel);other.links.delete(entry.channel);}
      }return;
    }
    throw Error('Unknown command');
  }
  remove(peer,code=1000,reason='Session ended'){
    if(!this.peers.has(peer.id))return;
    this.peers.delete(peer.id);this.sessions.delete(peer);peer.ws?.close(code,reason);peer.ws=null;
    for(const [channel,other] of peer.links){other.links.delete(channel);this.send(other,{type:'closed',channel});}
    peer.links.clear();peer.history=[];peer.pending=[];
  }
  sweep(){for(const peer of this.peers.values()){
    if(peer.detachedAt&&Date.now()-peer.detachedAt>GRACE)this.remove(peer);
    else if(peer.ws&&Date.now()-peer.lastSeen>15000){peer.ws.terminate();}
    else this.flush(peer);
  }}
  close(){clearInterval(this.timer);for(const peer of [...this.peers.values()])this.remove(peer,1001,'Server stopping');}
}
