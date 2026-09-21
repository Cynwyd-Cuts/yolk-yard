import Peer from "peerjs";
import { directory } from "./directory.js";
import { VERSION, safeProfile } from "./data.js";
import { ChatRoom, chatPayload } from './chat.js';
import { FILTER_VERSION, moderateText, safeName, safeSystemText, SAFETY_MESSAGES } from './moderation.js';
import { matchOptions } from './match-options.js';
const PREFIX = "yolk-yard-v3-";
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
    this.visibility = "private";
    this.maxConnections=7;
    this.peer = null;
    this.connections = new Map();
    this.isHost = false;
    this.closed = false;
    this.ready = false;
    this.latency = 0;
    this.lastState = 0;
    this.lastPing = 0;
    this.timers = new Set();
    this.chatRoom = new ChatRoom();
    this.chatEnabled = true;
    this.chatMuted = [];
    this.outboundChat = [];
    this.kicked = new Set();
  }
  makePeer(id) {
    const config = window.YOLK_NETWORK || {};
    this.peer = new Peer(id, {
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
      if (!this.ready) this.rejectOpen?.(new Error(message));
      else if (err.type === "peer-unavailable")
        this.callbacks.onError?.(message);
    });
    this.peer.on("disconnected", () => {
      if (!this.closed && !this.peer.destroyed)
        this.callbacks.onStatus?.(
          "Room service disconnected; existing players can continue.",
        );
    });
    return new Promise((resolve, reject) => {
      this.rejectOpen = reject;
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "The room service did not respond. Your network may block it; practice is available.",
            ),
          ),
        14000,
      );
      this.timers.add(timer);
      this.peer.on("open", (id) => {
        clearTimeout(timer);
        this.timers.delete(timer);
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
    this.peer.on("connection", (connection) => this.accept(connection));
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
        const result = this.callbacks.onJoin?.(
          conn.peer,
          safeProfile(msg.profile),
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
        conn.send({
          type: "welcome",
          id: conn.peer,
          code: this.code,
          version: VERSION,
        });
        this.callbacks.onStatus?.("A player joined");
        return;
      }
      if (!accepted) return;
      if (msg.type === "input") this.callbacks.onInput?.(conn.peer, msg.input);
      else if (msg.type === "player-action" && (["respawn", "spectate", "rejoin"].includes(msg.action)||/^inventory-(select-[0-4]|drop-[0-4]|swap-[0-4]-[0-4])$/.test(msg.action)))
        this.callbacks.onPlayerAction?.(conn.peer, msg.action);
      else if (msg.type === "profile")
        this.callbacks.onProfile?.(conn.peer, safeProfile(msg.profile));
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
        this.chatRoom.remove(conn.peer);
        this.callbacks.onLeave?.(conn.peer);
      }
    };
    conn.on("close", close);
    conn.on("error", close);
  }
  async join(code, profile) {
    this.code = cleanCode(code);
    if (this.code.length !== 8)
      throw new Error("Enter the 8-character room code.");
    await this.makePeer(undefined);
    await new Promise((resolve, reject) => {
      this.rejectOpen = reject;
      const conn = this.peer.connect(PREFIX + this.code, {
        reliable: true,
        serialization: "binary",
      });
      this.hostConnection = conn;
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "Could not reach the host. The network may block direct player connections.",
            ),
          ),
        18000,
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
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "welcome" && msg.version === VERSION) {
          clearTimeout(timer);
          this.timers.delete(timer);
          this.id = msg.id;
          this.ready = true;
          this.lastState = performance.now();
          resolve();
        } else if (msg.type === "reject") {
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
          this.snapshot=s;
          this.chatEnabled=s.chatEnabled !== false;
          this.chatMuted=Array.isArray(s.chatMuted)?s.chatMuted.filter(id=>typeof id==='string').slice(0,20):[];
          this.visibility = s.visibility === "public" ? "public" : "private";
          this.callbacks.onState?.(s);
        } else if (msg.type==='chat-message' && this.ready) {
          this.callbacks.onChat?.(msg.message);
        } else if (msg.type==='chat-status' && this.ready && Object.hasOwn(SAFETY_MESSAGES,msg.reason)) {
          this.callbacks.onChatStatus?.({ok:false,reason:msg.reason,retryAfter:Math.min(120,Math.max(0,Number(msg.retryAfter)||0))});
        } else if (msg.type === "pong")
          this.latency = Math.max(0, Math.round(performance.now() - msg.time));
        else if (msg.type === "closed") {
          this.callbacks.onError?.(
            "The host closed the room. Create a new room to keep playing.",
          );
          this.destroy();
        }
      });
      conn.on("close", () => {
        if (!this.closed) {
          if (!this.ready) reject(new Error("The host closed the connection."));
          else
            this.callbacks.onError?.(
              "Disconnected from the host. The room may have closed.",
            );
          this.destroy();
        }
      });
      conn.on("error", (e) => {
        if (!this.ready) reject(new Error(errorText(e)));
      });
    });
    this.rejectOpen = null;
    this.startHeartbeat();
    return this.id;
  }
  startHeartbeat() {
    this.heartbeat = setInterval(() => {
      if (this.closed || this.isHost) return;
      this.send({ type: "ping", time: performance.now() });
      if (this.ready && performance.now() - this.lastState > 12000) {
        this.callbacks.onError?.(
          "The host stopped responding. Keep the host’s game tab in front while playing.",
        );
        this.destroy();
      }
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
    if(this.isHost)return this.relayChat('host',message);
    if(!this.hostConnection?.open)return {ok:false,reason:'disconnected'};
    // No optimistic echo: a message is shown only after host approval.
    this.send(message);
    this.outboundChat.push({text:checked.text,time:now,quick:parsed.quick});
    return {ok:true};
  }
  relayChat(id,payload) {
    const result=this.chatRoom.submit(id,payload,this.chatState());
    if(!result.ok) {
      if(id==='host')this.callbacks.onChatStatus?.(result);
      else if(this.connections.get(id)?.open)this.connections.get(id).send({type:'chat-status',reason:result.reason,retryAfter:result.retryAfter});
      return result;
    }
    for(const recipient of result.recipients) {
      if(recipient==='host')this.callbacks.onChat?.(result.message);
      else {
        const conn=this.connections.get(recipient);
        if(conn?.open && (conn.dataChannel?.bufferedAmount||0)<65536)conn.send({type:'chat-message',message:result.message});
      }
    }
    return {ok:true};
  }
  setChatMuted(id,muted) {
    if(!this.isHost || id==='host' || !this.connections.has(id))return;
    if(muted)this.chatRoom.muted.add(id); else this.chatRoom.muted.delete(id);
    this.chatMuted=[...this.chatRoom.muted];
  }
  setChatEnabled(enabled) { if(this.isHost)this.chatEnabled=this.chatRoom.enabled=!!enabled; }
  reportChat(target,reason) {
    if(this.isHost) {
      const report=this.chatRoom.report('host',target,reason,this.chatState());
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
    const capacity=s?.options.mode==='royale' ? s.phase==='playing' ? humans.filter(p=>!p.spectating||p.place>0).length+4 : s.options.capacity : 8;
    directory.publish(this.visibility === "public" && s ? {code:this.code,host:s.players.find(p=>p.id === "host")?.name || "Egg",map:s.options.map,mode:s.options.mode,players:humans.length,capacity,phase:s.phase} : null);
  }
  broadcast(state) {
    this.snapshot = state;
    if (performance.now() - (this.lastPublish || 0) > 2000) { this.lastPublish = performance.now(); this.publishRoom(); }
    state = {...state, visibility:this.visibility,chatEnabled:this.chatEnabled,chatMuted:this.chatMuted};
    for (const conn of this.connections.values()) {
      if (!conn.open || (conn.dataChannel?.bufferedAmount || 0) >= 131072) continue;
      let outgoing=state;
      if(state.royale){
        const version=state.round+':'+state.royale.lootVersion;
        if(conn.royaleVersion===version){const {loot,chests,...royale}=state.royale;outgoing={...state,royale};}
        conn.royaleVersion=version;
      }
      conn.send({type:'state',state:outgoing});
    }
  }
  kick(id) {
    const conn = this.connections.get(id);
    if (conn) {
      if(this.kicked.size<128)this.kicked.add(id);
      conn.send({ type: "closed" });
      setTimeout(() => conn.close(), 100);
    }
  }
  destroy() {
    if (this.closed) return;
    this.closed = true;
    this.rejectOpen?.(new Error("Connection cancelled."));
    this.rejectOpen = null;
    if (this.isHost) directory.publish(null);
    for (const timer of this.timers) clearTimeout(timer);
    clearInterval(this.heartbeat);
    if (this.isHost)
      for (const conn of this.connections.values())
        if (conn.open) conn.send({ type: "closed" });
    this.peer?.destroy();
    this.connections.clear();
  }
}
