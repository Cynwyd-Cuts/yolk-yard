import { randomBytes } from 'node:crypto';
import { Simulation } from '../src/simulation.js';
import { VERSION, safeProfile } from '../src/data.js';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => [...randomBytes(8)].map(v => alphabet[v % alphabet.length]).join('');
const send = (socket, data) => { if (socket.readyState === 1 && socket.bufferedAmount < 262144) socket.send(JSON.stringify(data)); };
export class Rooms {
  constructor(store, maxRooms = 32) {
    this.maxRooms = maxRooms;
    this.store = store;
    this.rooms = new Map();
    this.sessions = new Map();
    this.frame = 0;
  }
  startTimers() {
    if (this.timer) return;
    let last = performance.now(), accumulator = 0;
    this.timer = setInterval(() => {
      const now = performance.now(); accumulator += Math.min(.1, (now-last)/1000); last = now;
      while (accumulator >= 1/60) {
        accumulator -= 1/60;
        for (const room of this.rooms.values()) room.sim.tick(1/60);
        if (++this.frame % 3 === 0) for (const room of this.rooms.values()) this.broadcast(room);
      }
    }, 8);
    this.heartbeat = setInterval(() => {
      for (const s of this.sessions.values()) {
        if (!s.alive || s.socket.bufferedAmount > 1048576) { s.socket.terminate(); continue; }
        s.alive = false; s.socket.ping();
      }
    }, 15000);
  }
  connect(socket, browser) {
    if (this.sessions.has(browser.person)) {
      send(socket, {type:'reject', reason:'Your game is already open in another tab. Close it before opening this one.'});
      socket.close(4009); return;
    }
    const s = {socket, browser:browser.id, person:browser.person, room:null, alive:true, packets:0, window:Date.now(), profile:safeProfile({})};
    this.sessions.set(s.person, s);
    this.startTimers();
    socket.on('pong', () => {s.alive = true;});
    socket.on('error', () => {});
    socket.on('close', () => { this.leave(s); if (this.sessions.get(s.person) === s) this.sessions.delete(s.person); if (!this.sessions.size) this.stopTimers(); });
    socket.on('message', raw => {
      try {
        if (Date.now()-s.window > 1000) {s.window=Date.now(); s.packets=0;}
        if (++s.packets > 160) {socket.close(4008, 'Too many messages'); return;}
        const msg = JSON.parse(raw.toString());
        if (!msg || typeof msg !== 'object') return;
        this.message(s, msg);
      } catch { send(socket, {type:'error', reason:'That action could not be completed.'}); }
    });
    send(socket, {type:'session', version:VERSION, id:s.person});
  }
  message(s, msg) {
    const r = s.room;
    const requestId=typeof msg.requestId==='string'?msg.requestId.slice(0,80):null;
    if (msg.type === 'ping') {send(s.socket, {type:'pong', time:msg.time}); return;}
    if (msg.type === 'leave') {this.leave(s); return;}
    if (msg.type === 'host' || msg.type === 'join') {
      if (msg.version !== VERSION) {send(s.socket,{type:'reject',requestId,reason:'Refresh your game to use the current version.'}); return;}
      if (r) return;
      s.profile = safeProfile(msg.profile);
      let room;
      if (msg.type === 'host') {
        if (this.rooms.size >= this.maxRooms) {send(s.socket,{type:'reject',requestId,reason:'All arenas are busy. Try again shortly.'}); return;}
        let id; do {id = code();} while (this.rooms.has(id));
        room = {code:id, host:s.person, visibility:msg.visibility === 'public' ? 'public' : 'private', sim:new Simulation(msg.options), members:new Map(), banned:new Set()};
        this.rooms.set(id,room);
      } else {
        room = this.rooms.get(String(msg.code).toUpperCase().replace(/-/g,''));
        if (!room || room.banned.has(s.person)) {send(s.socket,{type:'reject',requestId,reason:'That room is unavailable.'}); return;}
        if (room.members.size >= 8) {send(s.socket,{type:'reject',requestId,reason:'This room is full.'}); return;}
      }
      if (room.sim.players.size >= 8) {
        const bot = [...room.sim.players.values()].find(p=>p.bot);
        if (bot) room.sim.removePlayer(bot.id);
      }
      room.sim.addPlayer(s.person,s.profile);
      room.members.set(s.person,s); s.room=room;
      send(s.socket,{type:'welcome',requestId,id:s.person,code:room.code,isHost:s.person===room.host,visibility:room.visibility,version:VERSION,state:room.sim.snapshot()});
      this.broadcast(room); return;
    }
    if (!r) return;
    if (msg.type === 'input') r.sim.setInput(s.person,msg.input);
    if (msg.type === 'profile') r.sim.setProfile(s.person,safeProfile(msg.profile));
    if (msg.type === 'player-action' && ['respawn','spectate','rejoin'].includes(msg.action)) r.sim.playerAction(s.person,msg.action);
    if (s.person !== r.host) return;
    if (msg.type === 'start' && r.sim.phase !== 'playing') r.sim.startRound();
    if (msg.type === 'visibility' && ['public','private'].includes(msg.visibility)) {r.visibility=msg.visibility; this.broadcast(r);}
    if (msg.type === 'kick' && msg.id !== r.host) {
      const target=r.members.get(msg.id);
      if (target) {r.banned.add(msg.id); this.leave(target); send(target.socket,{type:'closed',code:r.code,reason:'The host removed you from this room.'});}
    }
  }
  broadcast(r) {
    const msg = {type:'state',code:r.code,state:r.sim.snapshot(),visibility:r.visibility};
    for (const s of r.members.values()) send(s.socket,msg);
  }
  leave(s) {
    const r = s.room;
    if (!r) return;
    s.room=null; r.members.delete(s.person); r.sim.removePlayer(s.person);
    if (s.person === r.host) {
      this.rooms.delete(r.code);
      for (const guest of r.members.values()) {guest.room=null; send(guest.socket,{type:'closed',code:r.code,reason:'The host closed the room.'});}
      r.members.clear();
    }
  }
  enforce() {
    for (const s of this.sessions.values()) {
      const b = this.store.one('SELECT status,person FROM browsers WHERE id=?',s.browser);
      if (b?.status !== 'approved' || b.person !== s.person) {this.leave(s); this.sessions.delete(s.person); send(s.socket,{type:'revoked'}); s.socket.close(4003);}
    }
  }
  list() {
    return [...this.rooms.values()].filter(r=>r.visibility==='public').map(r=>({code:r.code,host:r.sim.players.get(r.host)?.name || 'Player',map:r.sim.options.map,mode:r.sim.options.mode,phase:r.sim.phase,players:r.members.size,capacity:8}));
  }
  stopTimers() {
    clearInterval(this.timer); clearInterval(this.heartbeat);
    this.timer = null; this.heartbeat = null;
  }
  close() {
    this.stopTimers();
    for (const s of this.sessions.values()) s.socket.terminate();
  }
}
