import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createApp } from '../server/index.js';
import { token, hash } from '../server/store.js';

test('Pages credentials enforce approval, admin scope, allowed origins and one-use socket tickets',async t=>{
  const origin='http://127.0.0.1:3159',front='https://zl-2.github.io',secret=token();
  const app=createApp({origin,adminSecret:secret,database:':memory:',secure:false,clientOrigins:[front]});
  await new Promise(r=>app.server.listen(3159,'127.0.0.1',r));t.after(()=>app.close());
  const call=async(path,body,credential='',from=front,extra={})=>{
    const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:from,'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {r,body:await r.json()};
  };
  const preflight=await fetch(origin+'/api/request',{method:'OPTIONS',headers:{Origin:front,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),front);
  assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
  const req=await call('/api/request',{name:'Pages player'}),player=req.body.browserToken;
  assert.equal(req.r.headers.get('set-cookie'),null);assert.equal(player.length,43);
  assert.equal((await call('/api/rooms',undefined,player)).r.status,403);
  assert.equal((await call('/api/session-ticket',{},player)).r.status,403);
  const login=await call('/api/admin/login',{secret}),admin=login.body.adminToken;
  assert.equal(login.r.headers.get('set-cookie'),null);
  assert.equal((await call('/api/admin/dashboard',undefined,player)).r.status,401);
  assert.equal((await call('/api/rooms',undefined,admin)).r.status,403);
  await call('/api/admin/approve',{id:req.body.requestId},admin);
  assert.equal((await call('/api/access',undefined,player)).body.status,'approved');
  assert.equal((await call('/api/rooms',undefined,player)).r.status,200);
  const rejected=await call('/api/rooms',undefined,player,'https://evil.example');
  assert.equal(rejected.r.status,403);assert.equal(rejected.r.headers.get('access-control-allow-origin'),null);
  // An unrelated site cannot use cookies to act as a Pages browser, even with a valid cookie.
  assert.equal((await call('/api/rooms',undefined,'',front,{cookie:'yolk-browser='+player})).r.status,403);
  const open=ticket=>new WebSocket(origin.replace('http','ws')+'/session?ticket='+ticket,{origin:front});
  const denied=async ticket=>{
    const ws=open(ticket);const [err]=await once(ws,'error');assert.match(err.message,/403/);
  };
  const ticket=(await call('/api/session-ticket',{},player)).body.ticket;
  const ws=open(ticket);await once(ws,'open');ws.close();await once(ws,'close');
  await denied(ticket);
  await denied('missing');
  const last=(await call('/api/session-ticket',{},player)).body.ticket;
  await call('/api/admin/revoke',{id:app.store.browser(player).person},admin);
  await denied(last);
  assert.equal((await call('/api/rooms',undefined,player)).r.status,403);
  await call('/api/admin/logout',{},admin);
  assert.equal((await call('/api/admin/dashboard',undefined,admin)).r.status,401);
  // Stored sessions contain hashes, not usable bearer credentials.
  assert.equal(app.store.one('SELECT secret FROM browsers WHERE id=?',req.body.requestId).secret,hash(player));
});
