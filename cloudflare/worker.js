import { DurableObject } from 'cloudflare:workers';
import { StoreCore } from '../server/store-core.js';
import { createService } from '../server/service.js';
import { Rooms } from '../server/rooms.js';

class CloudStore extends StoreCore {
  constructor(storage) {
    const execute = (query, args) => storage.sql.exec(query, ...args).toArray();
    super({
      exec: query => execute(query, []),
      prepare: query => ({
        run: (...args) => execute(query, args),
        get: (...args) => execute(query, args)[0],
        all: (...args) => execute(query, args),
      }),
      close() {},
    });
    this.storage = storage;
  }
  transaction(fn) { return this.storage.transactionSync(fn); }
}

// Adapt Cloudflare's WebSocket events to the shared match server.
class MatchSocket {
  constructor(socket) {
    this.socket = socket;
    this.events = new Map();
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string' || new TextEncoder().encode(event.data).length > 4096) {
        this.close(4008, 'Message too large'); return;
      }
      if (event.data === '{"type":"session-pong"}') this.emit('pong');
      else this.emit('message', event.data);
    });
    socket.addEventListener('close', () => this.emit('close'));
    socket.addEventListener('error', () => this.emit('error'));
  }
  on(name, callback) { this.events.set(name, callback); }
  emit(name, value) { this.events.get(name)?.(value); }
  get readyState() { return this.socket.readyState; }
  get bufferedAmount() { return this.socket.bufferedAmount || 0; }
  send(value) { this.socket.send(value); }
  ping() { this.send('{"type":"session-ping"}'); }
  close(code = 1000, reason = '') { this.socket.close(code, reason); }
  terminate() { this.close(4000, 'Connection timed out'); }
}

export class YolkService extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new CloudStore(ctx.storage);
    this.rooms = new Rooms(this.store, 4);
    this.limits = new Map();
    this.tickets = new Map();
    this.cleanedAt = 0;
  }
  async fetch(request) {
    if (!this.env.ADMIN_SECRET || this.env.ADMIN_SECRET.length < 32) {
      return new Response('Owner setup required: add an ADMIN_SECRET secret of at least 32 characters in this Worker’s Settings, then reload.', {status:503});
    }
    const url = new URL(request.url);
    const secure = url.protocol === 'https:';
    const now = Date.now();
    if (now - this.cleanedAt > 60000) {
      for (const [key, value] of this.limits) if (value.until < now) this.limits.delete(key);
      this.store.run('DELETE FROM admins WHERE expires<?', now);
      this.cleanedAt = now;
    }
    const req = {
      url: url.pathname + url.search,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      socket: {remoteAddress: request.headers.get('CF-Connecting-IP') || 'local'},
      async *[Symbol.asyncIterator]() {
        if (!request.body) return;
        const reader = request.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            yield decoder.decode(value, {stream:true});
          }
          yield decoder.decode();
        } finally { reader.releaseLock(); }
      },
    };
    const headers = new Headers();
    let status = 200, response;
    const res = {
      headersSent:false,
      setHeader(name, value) { headers.set(name, value); },
      writeHead(value, extra) { status=value; for (const [name,v] of Object.entries(extra || {})) headers.set(name,v); },
      end(body) { this.headersSent=true; response=new Response(body, {status,headers}); },
    };
    const serve = async (res, path) => {
      const assetURL = new URL(path, url.origin);
      const asset = await this.env.ASSETS.fetch(new Request(assetURL, {method:'GET'}));
      res.writeHead(asset.status, {'Content-Type':asset.headers.get('Content-Type') || 'application/octet-stream'});
      res.end(asset.body);
    };
    const service = createService({origin:url.origin, adminSecret:this.env.ADMIN_SECRET,
      store:this.store, rooms:this.rooms, limits:this.limits, tickets:this.tickets, clientOrigins:(this.env.CLIENT_ORIGINS||'').split(',').filter(Boolean), secure, serve});
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      try {
        if (url.pathname !== '/session') throw new Error('Forbidden');
        service.limit(req, 'socket', 30);
        const browser = service.socketPlayer(req);
        const pair = new WebSocketPair();
        pair[1].accept();
        this.rooms.connect(new MatchSocket(pair[1]), browser);
        return new Response(null, {status:101, webSocket:pair[0]});
      } catch { return new Response('Forbidden', {status:403}); }
    }
    await service.handler(req, res);
    return response;
  }
}

export default {
  fetch(request, env) {
    // A single persistent authority enforces browser approvals and session leases.
    // Never derive object IDs from user input: that would multiply free-plan usage.
    return env.YOLK.get(env.YOLK.idFromName('yolk-yard')).fetch(request);
  },
};
