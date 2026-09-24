import { connectionReport, errorCode, watchConnection } from './connection-report.js';
import Peer from "peerjs";
import { RelayPeer, relayURL } from "./relay-peer.js";
import { directory } from "./directory.js";
import { VERSION, safeProfile, nameKey } from "./data.js";
import { ChatRoom, chatPayload } from './chat.js';
import { FILTER_VERSION, moderateText, safeName, safeSystemText, SAFETY_MESSAGES } from './moderation.js';
import { matchOptions } from './match-options.js';
import { HostHeartbeat } from './host-heartbeat.js';
const PREFIX = `yolk-yard-v${VERSION}-`;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const roomCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => alphabet[n % alphabet.length],
  ).join("");
export const cleanCode = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 8);
export const formatCode = (s) => s.slice(0, 4) + "-" + s.slice(4);
const errorText = (err) =>
  ({
    "peer-unavailable":
      "That room is not open. Check the code and ask the host to keep their game open.",
    network:
      "The room service could not be reached. Your network may block multiplayer connections.",
    "server-error":
      "The room service is unavailable. You can still play practice.",
    "socket-error": "The connection to the room service was interrupted.",
    "socket-closed": "The room service disconnected. Try again shortly.",
    "unavailable-id": "That room code is already in use. Create another room.",
    "browser-incompatible":
      "This browser does not support WebRTC data connections. Use a current Chrome or Safari.",
  })[err?.type] ||
  err?.message ||
  "Could not connect. You can still play practice.";

export class Network {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.visibility = "public";
    this.hostId="host";this.members=[];this.memberOrder=0;this.migrating=false;this.failedHosts=new Set();
    this.maxConnections=7;
    this.peer = null;
    this.connections = new Map();
    this.isHost = false;
    this.closed = false;
    this.ready = false;
    this.latency = 0;
    this.lastState = 0;
    this.hostHeartbeat = new HostHeartbeat(performance.now());
    this.lastPing = 0;
    this.timers = new Set();
    this.chatRoom = new ChatRoom();
    this.chatEnabled = true;
    this.chatMuted = [];
    this.outboundChat = [];
    this.kicked = new Set();
  }
  makePeer(id) {
    connectionReport.set("service","Checking","Opening matchmaking connection.");
    const config = window.YOLK_NETWORK || {};
    this.peer = relayURL() ? new RelayPeer(id) : new Peer(id, {
      debug: 0,
      ...config.peer,
      config: {
        iceServers: config.iceServers || [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      },
    });
    this.peer.on("error", (err) => {
      if (this.closed) return;
      const message = errorText(err);
      connectionReport.set(err.type === "peer-unavailable" || err.type === "webrtc" ? "host" : "service", "Failed", errorCode(err));
      if (!this.ready) this.rejectOpen?.(new Error(message));
      else if (!this.migrating && err.type === "peer-unavailable")
        this.callbacks.onError?.(message);
    });
    this.peer.on('reconnecting',()=>this.callbacks.onStatus?.('Reconnecting to the room…'));
    this.peer.on('reconnected',()=>{this.hostHeartbeat.contact(performance.now());this.callbacks.onStatus?.('Room connection restored.');});
    this.peer.on("connection", conn => { if(this.isHost)this.accept(conn); else conn.close(); });
    this.peer.on("disconnected", () => {
      if (!this.closed && !this.peer.destroyed)
        this.callbacks.onStatus?.(
          "Reconnecting to the room service…",
        );
      if(!this.closed && relayURL()){this.callbacks.onError?.('The game server connection ended. Rejoin the room or create another match.');}
      else if(!this.closed)this.later(()=>{if(this.peer?.disconnected&&!this.peer.destroyed)this.peer.reconnect();},1200);
    });
    return new Promise((resolve, reject) => {
      this.rejectOpen = reject;
      const timer = setTimeout(
        () => {
          connectionReport.set("service","Failed","Matchmaking timed out after 14 seconds.");
          reject(
            new Error(
              "The room service did not respond. Your network may block it; practice is available.",
            ),
          );
        }, 14000,
      );
      this.timers.add(timer);
      this.peer.on("open", (id) => {
        clearTimeout(timer);
        this.timers.delete(timer);
        connectionReport.set("service","Passed","Room service connected.");
        resolve(id);
      });
    });
  }
  async host() {
    this.isHost = true;
    this.id = "host";
    this.code = roomCode();
    await this.makePeer(PREFIX + this.code);
    this.ready = true;
    this.rejectOpen = null;
    this.members=[{id:this.id,peerId:this.peer.id,order:++this.memberOrder}];
    this.startHeartbeat();
    return this.code;
  }
  accept(conn) {
    if (this.closed || this.connections.size >= this.maxConnections || this.kicked.has(conn.peer)) {
      conn.on("open", () => {
        conn.send({ type: "reject", reason: "This room is unavailable." });
        setTimeout(() => conn.close(), 150);
      });
      return;
    }
    let accepted = false,
      lastRate = performance.now(),
      packets = 0;
    const timeout = setTimeout(() => {
      if (!accepted) conn.close();
    }, 8000);
    this.timers.add(timeout);
    conn.on("data", (msg) => {
      if (
        !msg ||
        typeof msg !== "object" ||
        JSON.stringify(msg).length > 2048
      ) {
        conn.close();
        return;
      }
      const now = performance.now();
      if (now - lastRate > 1000) {
        packets = 0;
        lastRate = now;
      }
      if (++packets > 160) {
        conn.close();
        return;
      }
      if (msg.type === "hello" && !accepted) {
        if (msg.version !== VERSION || this.connections.size >= this.maxConnections) {
          conn.send({
            type: "reject",
            reason:
              msg.version !== VERSION
                ? "Refresh your game: the host is using another version."
                : "This room is full.",
          });
          setTimeout(() => conn.close(), 150);
          return;
        }
        const safe=safeProfile(msg.profile);
        if(this.nameTaken(safe.name,conn.peer)){
          clearTimeout(timeout);this.timers.delete(timeout);
          conn.send({type:'name-required',joining:true});return;
        }
        const result = this.callbacks.onJoin?.(
          conn.peer,
          safe,
        );
        if (result === false) {
          conn.send({ type: "reject", reason: "This room is full." });
          setTimeout(() => conn.close(), 150);
          return;
        }
        accepted = true;
        clearTimeout(timeout);
        this.timers.delete(timeout);
        this.connections.set(conn.peer, conn);
        if(!this.members.some(m=>m.id===conn.peer))this.members.push({id:conn.peer,peerId:conn.peer,order:++this.memberOrder});
        conn.send({
          type: "welcome",
          hostId:this.id,members:this.members,checkpoint:this.migrationData(),
          id: conn.peer,
          code: this.code,
          version: VERSION,
        });
        this.callbacks.onStatus?.("A player joined");
        return;
      }
      if (!accepted) return;
      if (msg.type === "input") this.callbacks.onInput?.(conn.peer, msg.input);
      else if (msg.type === "player-action" && (["respawn", "spectate", "rejoin"].includes(msg.action)||/^inventory-(select-[0-4]|drop-[0-4]|drop-one-[0-4]|split-[0-4]|swap-[0-4]-[0-4])$/.test(msg.action)))
        this.callbacks.onPlayerAction?.(conn.peer, msg.action);
      else if (msg.type === "profile") {
        const profile=safeProfile(msg.profile);
        if(this.nameTaken(profile.name,conn.peer))conn.send({type:'name-required',joining:false});
        else {this.callbacks.onProfile?.(conn.peer,profile);conn.send({type:'name-accepted'});}
      }
      else if (msg.type === 'chat-send') this.relayChat(conn.peer, msg);
      else if (msg.type === 'chat-report') {
        const report=this.chatRoom.report(conn.peer,msg.target,msg.reason,this.chatState());
        if(report)this.callbacks.onChatReport?.(report);
      }
      else if (msg.type === "ping" && Number.isFinite(msg.time))
        conn.send({ type: "pong", time: msg.time });
    });
    const close = () => {
      clearTimeout(timeout);
      this.timers.delete(timeout);
      if (this.connections.get(conn.peer) === conn) {
        this.connections.delete(conn.peer);
        this.members=this.members.filter(m=>m.id!==conn.peer);
        this.chatRoom.remove(conn.peer);
        this.callbacks.onLeave?.(conn.peer);
      }
    };
    conn.on("close", close);
    conn.on("error", close);
  }
  async join(code, profile) {
    this.joinProfile=safeProfile(profile);
    this.code = cleanCode(code);
    if (this.code.length !== 8)
      throw new Error("Enter the 8-character room code.");
    connectionReport.set("host","Not checked","Waiting for matchmaking before contacting host.");
    await this.makePeer(undefined);
    await new Promise((resolve, reject) => {
      this.rejectOpen = reject;
      const conn = this.peer.connect(PREFIX + this.code, {
        reliable: true,
        serialization: "binary",
      });
      this.hostConnection = conn;
      connectionReport.set("host","Checking","Contacting the requested host.");
      watchConnection(conn);
      const timer = setTimeout(
        () => {
          connectionReport.set("host","Failed","Host handshake timed out after 18 seconds. " + connectionReport.rows.host.detail);
          reject(
            new Error(
              "Could not reach the host. The room may have closed or the connection may be unavailable.",
            ),
          );
        }, 18000,
      );
      this.timers.add(timer);
      conn.on("open", () =>
        conn.send({
          type: "hello",
          version: VERSION,
          profile: safeProfile(profile),
        }),
      );
      conn.on("data", (msg) => {
        if (this.hostConnection !== conn || !msg || typeof msg !== "object") return;
        if (msg.type === "welcome" && msg.version === VERSION) {
          clearTimeout(timer);
          this.timers.delete(timer);
          connectionReport.set("host","Passed","Host accepted the game handshake.");
          this.id = msg.id;
          this.hostId=msg.hostId||"host";this.members=msg.members||[];if(msg.checkpoint)this.lastCheckpoint=msg.checkpoint;
          this.ready = true;
          this.lastState = performance.now();
          this.hostHeartbeat.contact(this.lastState);
          resolve();
        } else if(msg.type==='name-required'){
          connectionReport.set('host','Passed','Host reached; choose another nickname to join.');
          clearTimeout(timer);this.timers.delete(timer);this.nameJoining=msg.joining;
          this.callbacks.onNameRequired?.();
        } else if(msg.type==='name-accepted'){this.callbacks.onNameAccepted?.();
        } else if (msg.type === "reject") {
          connectionReport.set("host","Rejected","Host reached but declined admission (for example full room or version mismatch).");
          clearTimeout(timer);
          reject(new Error(safeSystemText(msg.reason, 'This room is unavailable. Refresh and try again.')));
        } else if (msg.type === "state" && this.ready) {
          const s = msg.state;
          if (
            !s ||
            s.version !== VERSION ||
            !Array.isArray(s.players) ||
            s.players.length > 20
          )
            return;
          this.lastState = performance.now();
          this.hostHeartbeat.contact(this.lastState);
          // Names also occur in past events and result headlines, not just the
          // roster. Sanitize before any UI or Three.js nameplate sees them.
          s.players=s.players.map(p=>{
            const player={...p,name:safeName(p?.name)};
            // Numeric HUD fields must not become an alternate text channel.
            for(const key of ['kills','deaths','points','team','streak','poppers'])
              player[key]=Number.isFinite(p?.[key])?Math.max(0,Math.min(1000000,p[key])):0;
            return player;
          });
          s.round=Number.isSafeInteger(s.round)?Math.max(0,s.round):0;
          s.options=matchOptions(s.options);
          s.winner=safeSystemText(s.winner, 'Round complete');
          s.events=Array.isArray(s.events)?s.events.slice(-128).map(e=>{
            const event={...e};
            for(const key of ['name','targetName'])if(key in event)event[key]=safeName(event[key]);
            for(const key of ['text','winner','weapon'])if(key in event)event[key]=safeSystemText(event[key]);
            return event;
          }):[];
          if(s.network){this.hostId=s.network.hostId;this.members=s.network.members;}
          if(msg.checkpoint)this.lastCheckpoint=msg.checkpoint;
          this.snapshot=s;
          this.chatEnabled=s.chatEnabled !== false;
          this.chatMuted=Array.isArray(s.chatMuted)?s.chatMuted.filter(id=>typeof id==='string').slice(0,20):[];
          this.visibility = s.visibility === "public" ? "public" : "private";
          this.callbacks.onState?.(s);
        } else if (msg.type==='chat-message' && this.ready) {
          this.callbacks.onChat?.(msg.message);
        } else if (msg.type==='chat-status' && this.ready && Object.hasOwn(SAFETY_MESSAGES,msg.reason)) {
          this.callbacks.onChatStatus?.({ok:false,reason:msg.reason,retryAfter:Math.min(120,Math.max(0,Number(msg.retryAfter)||0))});
        } else if (msg.type === "pong" && Number.isFinite(msg.time)) {
          const now=performance.now();this.hostHeartbeat.contact(now);
          this.latency = Math.max(0, Math.round(now - msg.time));
        }
        else if(msg.type==='host-left')this.beginMigration();
        else if(msg.type==='kicked') {this.callbacks.onError?.('You were removed from this room.');this.destroy();}
      });
      conn.on("close", () => {
        if(this.closed||this.hostConnection!==conn)return;
        if(!this.ready){if(!['Failed','Rejected'].includes(connectionReport.rows.host.status))connectionReport.set('host','Failed','Host connection closed before acceptance.');reject(new Error('The host closed the connection.'));}
        else this.beginMigration();
      });
      conn.on("error", (e) => {
        connectionReport.set("host","Failed",errorCode(e));
        if (!this.ready) reject(new Error(errorText(e)));
      });
    });
    this.rejectOpen = null;
    this.startHeartbeat();
    return this.id;
  }
  startHeartbeat() {
    clearInterval(this.heartbeat);
    this.hostHeartbeat = new HostHeartbeat(performance.now());
    this.heartbeat = setInterval(() => {
      if (this.closed || this.isHost || this.migrating || this.peer?.reconnecting) return;
      const now=performance.now();this.send({ type: "ping", time: now });
      if (this.ready && this.hostHeartbeat.expired(now))this.beginMigration();
    }, 2000);
  }
  send(msg) {
    if (this.hostConnection?.open) this.hostConnection.send(msg);
  }
  input(input) {
    this.send({ type: "input", input });
  }
  profile(profile) {
    this.send({ type: "profile", profile:safeProfile(profile) });
  }
  chatState() { return this.callbacks.getChatState?.() || this.snapshot; }
  chat(payload) {
    if(!this.ready || this.closed) return {ok:false,reason:'disconnected'};
    const parsed=chatPayload({...payload,version:FILTER_VERSION});
    if(!parsed)return {ok:false,reason:'format'};
    const now=Date.now();
    this.outboundChat=this.outboundChat.filter(m=>now-m.time<20000).slice(-4);
    const checked=moderateText(parsed.text,{previous:parsed.quick?[]:this.outboundChat.filter(m=>!m.quick).map(m=>m.text)});
    if(!checked.ok)return checked;
    const message={...parsed,type:'chat-send',text:checked.text};
    if(this.isHost)return this.relayChat(this.id,message);
    if(!this.hostConnection?.open)return {ok:false,reason:'disconnected'};
    // No optimistic echo: a message is shown only after host approval.
    this.send(message);
    this.outboundChat.push({text:checked.text,time:now,quick:parsed.quick});
    return {ok:true};
  }
  relayChat(id,payload) {
    const result=this.chatRoom.submit(id,payload,this.chatState());
    if(!result.ok) {
      if(id===this.id)this.callbacks.onChatStatus?.(result);
      else if(this.connections.get(id)?.open)this.connections.get(id).send({type:'chat-status',reason:result.reason,retryAfter:result.retryAfter});
      return result;
    }
    for(const recipient of result.recipients) {
      if(recipient===this.id)this.callbacks.onChat?.(result.message);
      else {
        const conn=this.connections.get(recipient);
        if(conn?.open && (conn.dataChannel?.bufferedAmount||0)<65536)conn.send({type:'chat-message',message:result.message});
      }
    }
    return {ok:true};
  }
  setChatMuted(id,muted) {
    if(!this.isHost || id===this.id || !this.connections.has(id))return;
    if(muted)this.chatRoom.muted.add(id); else this.chatRoom.muted.delete(id);
    this.chatMuted=[...this.chatRoom.muted];
  }
  setChatEnabled(enabled) { if(this.isHost)this.chatEnabled=this.chatRoom.enabled=!!enabled; }
  reportChat(target,reason) {
    if(this.isHost) {
      const report=this.chatRoom.report(this.id,target,reason,this.chatState());
      if(report)this.callbacks.onChatReport?.(report);
    } else this.send({type:'chat-report',target,reason});
  }
  setVisibility(value) {
    if (!this.isHost) return;
    this.visibility = value === "public" ? "public" : "private";
    this.publishRoom();
  }
  publishRoom() {
    const s = this.snapshot;
    const humans=s?.players.filter(p=>!p.bot)||[];
    const capacity=s?.options.capacity||8;
    const listing=this.visibility === "public" && s ? {version:VERSION,code:this.code,host:s.players.find(p=>p.id === this.id)?.name || "Egg",map:s.options.map,mode:s.options.mode,players:humans.length,capacity,phase:s.phase} : null;
    if(relayURL())(this.aliasPeer?.id===PREFIX+this.code?this.aliasPeer:this.peer)?.publish?.(listing);
    else directory.publish(listing);
  }
  broadcast(state) {
    this.snapshot = state;
    if (performance.now() - (this.lastPublish || 0) > 2000) { this.lastPublish = performance.now(); this.publishRoom(); }
    state = {...state, visibility:this.visibility,chatEnabled:this.chatEnabled,chatMuted:this.chatMuted,network:{hostId:this.id,members:this.members,chatSequence:this.chatRoom.sequence}};
    const checkpointDue=performance.now()-(this.lastCheckpointSent||0)>3000;
    let checkpoint;
    if(checkpointDue){this.lastCheckpointSent=performance.now();checkpoint={simulation:this.callbacks.getCheckpoint?.(),chat:{sequence:this.chatRoom.sequence,enabled:this.chatEnabled,muted:this.chatMuted,members:[...this.chatRoom.members],reports:[...this.chatRoom.reports]},kicked:[...this.kicked]};}
    const recipients=[...this.connections.values()];
    const offset=(this.broadcastCursor||0)%Math.max(1,recipients.length);
    this.broadcastCursor=offset+1;
    // Shared-socket backpressure must not repeatedly favor the first seats.
    for (let i=0;i<recipients.length;i++) {
      const conn=recipients[(i+offset)%recipients.length];
      if (!conn.open || (conn.dataChannel?.bufferedAmount || 0) >= 131072) continue;
      let outgoing=state;
      if(state.royale){
        const version=state.round+':'+state.royale.lootVersion;
        if(conn.royaleVersion===version){const {loot,chests,...royale}=state.royale;outgoing={...state,royale};}
        conn.royaleVersion=version;
        const buildVersion=state.round+':'+state.royale.buildVersion;
        if(conn.buildVersion===buildVersion){const {builds,worldDamage,...royale}=outgoing.royale;outgoing={...outgoing,royale};}
        conn.buildVersion=buildVersion;
      }
      conn.send({type:'state',state:outgoing,...(checkpoint?{checkpoint}:{})});
    }
  }
  migrationData(){return {simulation:this.callbacks.getCheckpoint?.(),chat:{sequence:this.chatRoom.sequence,enabled:this.chatEnabled,muted:this.chatMuted,members:[...this.chatRoom.members],reports:[...this.chatRoom.reports]},kicked:[...this.kicked]};}
  later(fn,ms){const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.closed)fn();},ms);this.timers.add(timer);return timer;}
  nameTaken(name,id){return (this.chatState()?.players||[]).some(p=>!p.bot&&p.id!==id&&nameKey(p.name)===nameKey(name));}
  submitName(profile){
    this.joinProfile=safeProfile(profile);
    if(this.isHost){if(this.nameTaken(profile.name,this.id)){this.callbacks.onNameRequired?.();return;}this.callbacks.onProfile?.(this.id,this.joinProfile);this.callbacks.onNameAccepted?.();}
    else this.send(this.nameJoining?{type:'hello',version:VERSION,profile:this.joinProfile}:{type:'profile',profile:this.joinProfile});
  }
  beginMigration(){
    if(this.closed||this.isHost||this.migrating)return;
    if(!this.lastCheckpoint?.simulation){this.callbacks.onError?.('The host left before the room could synchronize. Please join another room.');return;}
    this.migrating=true;this.failedHosts.add(this.hostId);
    this.hostConnection?.close();this.callbacks.onStatus?.('Host disconnected. Transferring the match…');
    this.electHost();
  }
  electHost(){
    if(this.closed||!this.migrating)return;
    const next=this.members.filter(m=>!this.failedHosts.has(m.id)).sort((a,b)=>a.order-b.order)[0];
    if(!next){this.callbacks.onError?.('No connected players remain in this room.');return;}
    if(next.id===this.id){this.promote();return;}
    const attempt=this.peer.connect(next.peerId,{reliable:true,serialization:'binary'});
    let welcomed=false;this.hostConnection=attempt;
    const timer=this.later(()=>{if(!welcomed){attempt.close();this.failedHosts.add(next.id);this.electHost();}},5000);
    attempt.on('open',()=>attempt.send({type:'hello',version:VERSION,profile:this.joinProfile||safeProfile(this.snapshot?.players.find(p=>p.id===this.id))}));
    attempt.on('data',msg=>{
      if(this.hostConnection!==attempt||!msg||typeof msg!=='object')return;
      if(msg.type==='welcome'&&msg.version===VERSION){
        if(msg.checkpoint)this.lastCheckpoint=msg.checkpoint;
        welcomed=true;clearTimeout(timer);this.timers.delete(timer);this.migrating=false;this.hostId=msg.hostId;this.members=msg.members;this.lastState=performance.now();
        this.hostHeartbeat=new HostHeartbeat(this.lastState);
        this.callbacks.onStatus?.('New host connected. Match continues.');
      }else if(msg.type==='state'&&welcomed){
        const s=msg.state;if(s?.version!==VERSION||!Array.isArray(s.players)||s.players.length>20)return;
        s.players=s.players.map(p=>({...p,...safeProfile(p)}));s.options=matchOptions(s.options);s.winner=safeSystemText(s.winner,'Round complete');
        s.events=(s.events||[]).slice(-120).map(e=>{const next={...e};for(const key of ['name','targetName'])if(key in next)next[key]=safeName(next[key]);for(const key of ['text','winner','weapon'])if(key in next)next[key]=safeSystemText(next[key]);return next;});
        this.lastState=performance.now();this.snapshot=s;this.members=s.network?.members||this.members;this.hostId=s.network?.hostId||this.hostId;
        this.hostHeartbeat.contact(this.lastState);
        this.chatEnabled=s.chatEnabled!==false;this.chatMuted=s.chatMuted||[];
        if(msg.checkpoint)this.lastCheckpoint=msg.checkpoint;this.callbacks.onState?.(s);
      }else if(msg.type==='chat-message')this.callbacks.onChat?.(msg.message);
      else if(msg.type==='chat-status')this.callbacks.onChatStatus?.(msg);
      else if(msg.type==='pong'&&Number.isFinite(msg.time)){const now=performance.now();this.hostHeartbeat.contact(now);this.latency=Math.max(0,Math.round(now-msg.time));}
      else if(msg.type==='host-left'&&welcomed)this.beginMigration();
      else if(msg.type==='kicked'){this.callbacks.onError?.('You were removed from this room.');this.destroy();}
      else if(msg.type==='name-required'){this.nameJoining=msg.joining;this.callbacks.onNameRequired?.();}
      else if(msg.type==='name-accepted')this.callbacks.onNameAccepted?.();
    });
    attempt.on('close',()=>{if(welcomed&&this.hostConnection===attempt&&!this.closed)this.beginMigration();});
    attempt.on('error',()=>{if(welcomed&&this.hostConnection===attempt&&!this.closed)this.beginMigration();});
  }
  promote(){
    this.isHost=true;this.migrating=false;this.hostId=this.id;
    this.members=this.members.filter(m=>!this.failedHosts.has(m.id));
    this.memberOrder=Math.max(0,...this.members.map(m=>m.order));
    const checkpoint=this.lastCheckpoint;
    this.chatRoom.sequence=Math.max(checkpoint.chat?.sequence||0,this.snapshot?.network?.chatSequence||0);this.chatRoom.enabled=this.chatEnabled=checkpoint.chat?.enabled!==false;
    this.chatMuted=checkpoint.chat?.muted||[];this.chatRoom.muted=new Set(this.chatMuted);this.chatRoom.members=new Map(checkpoint.chat?.members||[]);this.chatRoom.reports=new Set(checkpoint.chat?.reports||[]);this.kicked=new Set(checkpoint.kicked||[]);
    this.maxConnections=(checkpoint.simulation.options.capacity||8)-1;
    this.callbacks.onHost?.(checkpoint.simulation,[...this.failedHosts]);
    this.lastPublish=0;this.lastCheckpointSent=0;this.claimRoomAddress();
    this.callbacks.onStatus?.('You are now the host. The match continues.');
    this.later(()=>{for(const member of [...this.members])if(member.id!==this.id&&!this.connections.has(member.id)){this.members=this.members.filter(m=>m.id!==member.id);this.callbacks.onLeave?.(member.id);}},10000);
  }
  claimRoomAddress(){
    if(this.closed||!this.isHost)return;
    if(this.peer.id===PREFIX+this.code)return;
    const config=window.YOLK_NETWORK||{};
    const alias=relayURL()?new RelayPeer(PREFIX+this.code):new Peer(PREFIX+this.code,{debug:0,...config.peer,config:{iceServers:config.iceServers||[{urls:'stun:stun.l.google.com:19302'}]}});this.aliasPeer=alias;
    alias.on('open',()=>this.publishRoom());
    alias.on('connection',conn=>this.accept(conn));
    alias.on('error',()=>{alias.destroy();this.later(()=>this.claimRoomAddress(),2500);});
    alias.on('disconnected',()=>{if(!alias.destroyed&&!this.closed){if(relayURL()){alias.destroy();this.later(()=>this.claimRoomAddress(),2500);}else alias.reconnect();}});
  }
  kick(id) {
    const conn = this.connections.get(id);
    if (conn) {
      if(this.kicked.size<128)this.kicked.add(id);
      conn.send({ type: "kicked" });
      setTimeout(() => conn.close(), 100);
    }
  }
  destroy() {
    if (this.closed) return;
    this.closed = true;
    this.rejectOpen?.(new Error("Connection cancelled."));
    this.rejectOpen = null;
    if (this.isHost && !relayURL()) directory.publish(null);
    for (const timer of this.timers) clearTimeout(timer);
    clearInterval(this.heartbeat);
    if (this.isHost)
      for (const conn of this.connections.values())
        if (conn.open) conn.send({ type: "host-left" });
    this.aliasPeer?.destroy();
    this.peer?.destroy();
    this.connections.clear();
  }
}
