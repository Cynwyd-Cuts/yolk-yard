import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../server/index.js';
import { Store, token } from '../server/store.js';
import { VERSION } from '../src/data.js';
const secret=token();
async function fixture(t){
 const origin='http://localhost:3157',app=createApp({origin,adminSecret:secret,database:':memory:',secure:false});
 await new Promise(r=>app.server.listen(3157,'127.0.0.1',r)); t.after(()=>app.close());
 const client=()=>({cookie:'',async call(path,data,otherOrigin){
   const r=await fetch('http://127.0.0.1:3157'+path,{method:data===undefined?'GET':'POST',headers:{cookie:this.cookie,origin:otherOrigin||origin,'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
   const c=r.headers.get('set-cookie');if(c)this.cookie=c.split(';')[0];
   const body=await r.json();return {status:r.status,body};
 }});
 const admin=client();assert.equal((await admin.call('/api/admin/login',{secret})).status,200);
 const request=async(name)=>{const c=client();const r=await c.call('/api/request',{name});c.id=r.body.requestId;return c;};
 const approve=async(c,extra={})=>{assert.equal((await admin.call('/api/admin/approve',{id:c.id,...extra})).status,200);return app.store.browser(c.cookie.split('=')[1]).person;};
 const socket=async c=>{
   const ws=new WebSocket('ws://127.0.0.1:3157/session',{origin,headers:{cookie:c.cookie}});ws.messages=[];
   ws.on('message',data=>ws.messages.push(JSON.parse(data)));await once(ws,'open');await wait(()=>ws.messages.find(m=>m.type==='session'||m.type==='reject'));return ws;
 };
 return {app,admin,client,request,approve,socket,origin};
}
const wait=async fn=>{const deadline=Date.now()+3000;while(Date.now()<deadline){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out');};
const send=(ws,msg)=>ws.send(JSON.stringify(msg));
test('access, codes, browser replacement, revocation, and server-enforced public/private matches',async t=>{
 const {app,admin,client,request,approve,socket}=await fixture(t);
 const stranger=client();
 assert.equal((await stranger.call('/api/rooms')).status,403);
 assert.equal((await stranger.call('/api/admin/dashboard')).status,401);
 assert.equal((await stranger.call('/api/request',{name:'CSRF'},'https://other.example')).status,403);
 const guest=await request('Guest'),host=await request('Host');
 assert.equal((await guest.call('/api/rooms')).status,403);
 const hostPerson=await approve(host);
 const issued=await admin.call('/api/admin/code',{name:'Guest',kind:'paid'});
 assert.equal((await guest.call('/api/redeem',{code:issued.body.code})).status,200);
 assert.equal((await guest.call('/api/access')).body.kind,'paid');
 const reuse=await request('Reuse');assert.equal((await reuse.call('/api/redeem',{code:issued.body.code})).status,400);
 const sHost=await socket(host),sGuest=await socket(guest),duplicate=await socket(host);
 assert.equal(duplicate.messages[0].type,'reject');
 send(sHost,{type:'host',version:VERSION,profile:{name:'Host'},visibility:'private',options:{bots:0}});
 const welcome=await wait(()=>sHost.messages.find(m=>m.type==='welcome')),code=welcome.code;
 assert.equal((await guest.call('/api/rooms')).body.rooms.length,0);
 send(sGuest,{type:'join',version:VERSION,code,profile:{name:'Guest'}});
 await wait(()=>sGuest.messages.find(m=>m.type==='welcome'));
 send(sGuest,{type:'visibility',visibility:'public'});send(sGuest,{type:'start'});
 await new Promise(r=>setTimeout(r,30));assert.equal(app.rooms.rooms.get(code).visibility,'private');assert.equal(app.rooms.rooms.get(code).sim.phase,'lobby');
 send(sHost,{type:'visibility',visibility:'public'});await wait(()=>app.rooms.rooms.get(code).visibility==='public');
 assert.equal((await guest.call('/api/rooms')).body.rooms[0].players,2);
 send(sHost,{type:'start'});await wait(()=>app.rooms.rooms.get(code).sim.phase==='playing');
 const room=app.rooms.rooms.get(code),before=room.sim.players.get(hostPerson).kills;
 send(sHost,{type:'state',state:{players:[{id:hostPerson,kills:999}]}});
 await new Promise(r=>setTimeout(r,20));assert.equal(room.sim.players.get(hostPerson).kills,before);
 send(sHost,{type:'visibility',visibility:'private'});await wait(()=>room.visibility==='private');
 assert.equal((await guest.call('/api/rooms')).body.rooms.length,0);
 const replacement=await request('Host replacement');await approve(replacement,{person:hostPerson});
 await wait(()=>sHost.messages.find(m=>m.type==='revoked'));
 assert.equal((await host.call('/api/rooms')).status,403);assert.equal((await replacement.call('/api/rooms')).status,200);assert.equal(app.rooms.rooms.size,0);
 await wait(()=>sGuest.messages.find(m=>m.type==='closed'));
 const guestPerson=app.store.browser(guest.cookie.split('=')[1]).person;
 const replacementCode=await admin.call('/api/admin/code',{name:'Guest replacement',person:guestPerson});
 await admin.call('/api/admin/revoke',{id:guestPerson});await wait(()=>sGuest.messages.find(m=>m.type==='revoked'));
 const another=await request('Other');assert.equal((await another.call('/api/redeem',{code:replacementCode.body.code})).status,400);
 sHost.terminate();sGuest.terminate();duplicate.terminate();
});
test('codes are single use and expire; approvals survive restart; secrets are hashed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'yolk-store-')),path=join(dir,'access.sqlite');let s=new Store(path);
 try{
  const a=s.request('A',''),b=s.request('B',''),code=s.makeCode('A','free');
  s.redeem(a.id,code.code);assert.throws(()=>s.redeem(b.id,code.code));
  const expired=s.makeCode('B','paid');s.run('UPDATE codes SET expires=0 WHERE id=?',expired.id);assert.throws(()=>s.redeem(b.id,expired.code));
  assert.notEqual(s.one('SELECT secret FROM codes WHERE id=?',code.id).secret,code.code);
  assert.notEqual(s.one('SELECT secret FROM browsers WHERE id=?',a.id).secret,a.secret);
  s.close();s=new Store(path);assert.equal(s.browser(a.secret).status,'approved');assert.equal(s.browser(b.secret).status,'pending');
 }finally{s.close();await rm(dir,{recursive:true,force:true});}
});
