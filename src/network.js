import Peer from "peerjs";
import { directory } from "./directory.js";
import { VERSION, safeProfile } from "./data.js";
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
    if (this.closed || this.connections.size >= this.maxConnections) {
      conn.on("open", () => {
        conn.send({ type: "reject", reason: "This room has no open seats." });
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
      else if (msg.type === "player-action" && ["respawn", "spectate", "rejoin"].includes(msg.action))
        this.callbacks.onPlayerAction?.(conn.peer, msg.action);
      else if (msg.type === "profile")
        this.callbacks.onProfile?.(conn.peer, safeProfile(msg.profile));
      else if (msg.type === "ping" && Number.isFinite(msg.time))
        conn.send({ type: "pong", time: msg.time });
    });
    const close = () => {
      clearTimeout(timeout);
      this.timers.delete(timeout);
      if (this.connections.get(conn.peer) === conn) {
        this.connections.delete(conn.peer);
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
        serialization: "json",
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
          reject(new Error(String(msg.reason).slice(0, 200)));
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
          this.visibility = s.visibility === "public" ? "public" : "private";
          this.callbacks.onState?.(s);
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
    this.send({ type: "profile", profile });
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
    state = {...state, visibility:this.visibility};
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
