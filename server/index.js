import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService } from './service.js';
import { WebSocketServer } from 'ws';
import { Store, hash, token } from './store.js';
import { Rooms } from './rooms.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cookie = (req, name) => (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const fail = (message, status=400) => Object.assign(new Error(message), {status});
const text = (value, max=80) => String(value || '').trim().slice(0,max);
export function createApp({origin, adminSecret, database, dist=resolve(root,'dist'), secure=true, trustProxy=false, clientOrigins=[]}={}) {
  if (!origin || new URL(origin).origin !== origin) throw new Error('Set APP_ORIGIN to the exact public origin without a trailing slash.');
  if (!adminSecret || adminSecret.length < 32) throw new Error('ADMIN_SECRET must contain at least 32 characters.');
  if (secure && !origin.startsWith('https://')) throw new Error('Production requires HTTPS.');
  if (database !== ':memory:') mkdirSync(dirname(database), {recursive:true,mode:0o700});
  const store = new Store(database), rooms=new Rooms(store), limits=new Map();
  async function serve(res,path) {
    const file=resolve(dist,'.'+decodeURIComponent(path));
    if (!file.startsWith(resolve(dist)+'/') || !(await stat(file)).isFile()) throw fail('Not found.',404);
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':({'.json':'application/json','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'})[extname(file)]||'application/octet-stream'});
    res.end(content);
  }
  const {handler,socketPlayer,limit}=createService({origin,adminSecret,store,rooms,serve,secure,trustProxy,limits,clientOrigins});
  const server=createServer(handler);
  const wss=new WebSocketServer({noServer:true,maxPayload:4096});
  server.on('upgrade',(req,socket,head)=>{
    try {
      if (new URL(req.url,origin).pathname!=='/session') throw fail('Forbidden',403);
      limit(req,'socket',30); const b=socketPlayer(req);
      wss.handleUpgrade(req,socket,head,ws=>rooms.connect(ws,b));
    } catch {socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();}
  });
  const maintenance=setInterval(()=>{
    const now=Date.now(); for (const [k,v] of limits) if (v.until<now) limits.delete(k);
    store.run('DELETE FROM admins WHERE expires<?',now);
  },60000);
  return {server,store,rooms, close:async()=>{
    clearInterval(maintenance); rooms.close(); wss.close();
    server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); store.close();
  }};
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT)||3000;
  const secure=process.env.NODE_ENV==='production';
  const app=createApp({origin:process.env.APP_ORIGIN||`http://localhost:${port}`,adminSecret:process.env.ADMIN_SECRET,database:process.env.DATA_FILE||resolve(root,'data/access.sqlite'),secure,trustProxy:process.env.TRUST_PROXY==='1'});
  app.server.listen(port,'0.0.0.0',()=>console.log(`Yolk Yard server listening on ${port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>app.close().then(()=>process.exit(0)));
}
