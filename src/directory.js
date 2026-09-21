import Peer from 'peerjs';
// A live browser coordinates the directory. Other browsers re-elect it on disconnect.
// Only public-room metadata is shared; private room codes never enter this channel.
const DIRECTORY_ID = 'yolk-yard-public-directory-v3';
const TTL = 20000;
export function cleanListing(room) {
  if (!room || !/^[A-Z2-9]{8}$/.test(room.code) || typeof room.host !== 'string' ||
      typeof room.map !== 'string' || typeof room.mode !== 'string' ||
      !Number.isInteger(room.players) || room.players < 1 || room.players > 8 ||
      !['lobby','playing','results'].includes(room.phase)) return null;
  return {code:room.code,host:room.host.slice(0,18),map:room.map.slice(0,24),mode:room.mode.slice(0,24),players:room.players,capacity:8,phase:room.phase};
}
class Directory {
  constructor() { this.room=null; this.clients=new Map(); this.waiters=new Map(); this.sequence=0; }
  start() {
    if (this.started) return;
    this.started=true;
    this.elect();
    this.timer=setInterval(()=>{
      if (!this.peer || this.peer.destroyed) this.elect();
      if (this.leader) this.prune();
      else if (this.connection?.open) {
        if (Date.now() - this.lastSeen > 8000) { this.reset(); this.elect(); }
        else this.connection.send({type:'publish',room:this.room});
      }
    },2000);
  }
  options() {
    const config=window.YOLK_NETWORK || {};
    return {debug:0,...config.peer,config:{iceServers:config.iceServers || [{urls:'stun:stun.l.google.com:19302'}]}};
  }
  reset() {
    clearTimeout(this.connectTimer);
    this.leader=false;
    this.connection=null;
    const peer=this.peer; this.peer=null;
    peer?.destroy();
    this.clients.clear();
  }
  elect() {
    if (this.peer && !this.peer.destroyed) return;
    const peer=this.peer=new Peer(DIRECTORY_ID,this.options());
    this.connectTimer=setTimeout(()=>{if(this.peer===peer)this.reset();},12000);
    peer.on('open',()=>{
      if(this.peer!==peer)return;
      clearTimeout(this.connectTimer);this.leader=true;
    });
    peer.on('connection',conn=>this.accept(conn));
    peer.on('disconnected',()=>{if(this.peer===peer)this.reset();});
    peer.on('error',err=>{
      if(this.peer!==peer || (this.leader && ['webrtc','peer-unavailable'].includes(err.type)))return;
      this.reset();
      if(err.type==='unavailable-id')this.follow();
    });
  }
  follow() {
    const peer=this.peer=new Peer(undefined,this.options());
    this.connectTimer=setTimeout(()=>{if(this.peer===peer)this.reset();},12000);
    peer.on('open',()=>{
      if(this.peer!==peer)return;
      const conn=this.connection=peer.connect(DIRECTORY_ID,{reliable:true,serialization:'json'});
      conn.on('open',()=>{clearTimeout(this.connectTimer);this.lastSeen=Date.now();conn.send({type:'publish',room:this.room});});
      conn.on('data',message=>{
        if (message?.type === 'ack' || message?.type === 'rooms') this.lastSeen=Date.now();
        if(message?.type!=='rooms' || !Array.isArray(message.rooms))return;
        const waiter=this.waiters.get(message.id);
        if(waiter){this.waiters.delete(message.id);waiter(message.rooms.slice(0,100).map(cleanListing).filter(Boolean));}
      });
      conn.on('close',()=>{if(this.peer===peer)this.reset();});
      conn.on('error',()=>{if(this.peer===peer)this.reset();});
    });
    peer.on('disconnected',()=>{if(this.peer===peer)this.reset();});
    peer.on('error',err=>{if(this.peer===peer)this.reset();});
  }
  accept(conn) {
    if(this.clients.size>=100){conn.on('open',()=>conn.close());return;}
    const entry={conn,room:null,updated:Date.now(),packets:0,rateAt:Date.now()};
    this.clients.set(conn,entry);
    conn.on('data',message=>{
      if(!message || typeof message!=='object' || JSON.stringify(message).length>2048){conn.close();return;}
      const now=Date.now();
      if(now-entry.rateAt>1000){entry.rateAt=now;entry.packets=0;}
      if(++entry.packets>15){conn.close();return;}
      entry.updated=now;
      if(message.type==='publish'){entry.room=cleanListing(message.room);conn.send({type:'ack'});}
      if(message.type==='list' && Number.isInteger(message.id))conn.send({type:'rooms',id:message.id,rooms:this.rows()});
    });
    conn.on('close',()=>this.clients.delete(conn));
    conn.on('error',()=>{this.clients.delete(conn);conn.close();});
  }
  prune() { for(const [conn,entry] of this.clients)if(Date.now()-entry.updated>TTL){this.clients.delete(conn);conn.close();} }
  rows() {
    this.prune();
    return [...new Map([this.room,...[...this.clients.values()].map(e=>e.room)].filter(Boolean).map(r=>[r.code,r])).values()].slice(0,100);
  }
  publish(room) {
    this.room=cleanListing(room);
    if(this.room)this.start();
    if(this.connection?.open)this.connection.send({type:'publish',room:this.room});
  }
  async list() {
    this.start();
    const deadline=Date.now()+18000;
    while(Date.now()<deadline){
      if(this.leader)return {rooms:this.rows()};
      if(this.connection?.open){
        const id=++this.sequence;
        const rooms=await new Promise(resolve=>{
          const timer=setTimeout(()=>{this.waiters.delete(id);resolve(null);},3500);
          this.waiters.set(id,rows=>{clearTimeout(timer);resolve(rows);});
          this.connection.send({type:'list',id});
        });
        if(rooms)return {rooms};
      }
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    throw new Error('Public matches could not be reached. Try again, join by room code, or play practice.');
  }
}
export const directory=new Directory();
