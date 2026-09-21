import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {token} from '../server/store-core.js';
import {VERSION} from '../src/data.js';
const origin='http://127.0.0.1:3192',secret=token(),persist=await mkdtemp(join(tmpdir(),'yolk-worker-'));
let processHandle, logs='';
const sockets=[];
const wait=async fn=>{const end=Date.now()+30000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out\n'+logs);};
async function start(){
 processHandle=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--ip','127.0.0.1','--port','3192','--inspector-port','9232','--persist-to',persist,'--var',`ADMIN_SECRET:${secret}`],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 processHandle.stdout.on('data',x=>logs+=x);processHandle.stderr.on('data',x=>logs+=x);
 await wait(async()=>{try{return (await fetch(origin+'/health',{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}});
}
async function stop(){if(processHandle&&processHandle.exitCode===null){const exited=once(processHandle,'exit');processHandle.kill('SIGTERM');const force=setTimeout(()=>processHandle.kill('SIGKILL'),3000);await exited;clearTimeout(force);}}
const client=()=>({cookie:'',async call(path,data,otherOrigin){
 const response=await fetch(origin+path,{method:data===undefined?'GET':'POST',headers:{cookie:this.cookie,origin:otherOrigin||origin,'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
 return {status:response.status,body:await response.json()};
}});
const socket=async client=>{
 const ws=new WebSocket(origin.replace('http','ws')+'/session',{origin,headers:{cookie:client.cookie}});sockets.push(ws);ws.messages=[];
 ws.on('message',raw=>{const msg=JSON.parse(raw);ws.messages.push(msg);if(msg.type==='session-ping')ws.send('{"type":"session-pong"}');});
 await once(ws,'open');await wait(()=>ws.messages.find(m=>['session','reject'].includes(m.type)));return ws;
};
const send=(ws,msg)=>ws.send(JSON.stringify(msg));
try{
 await start();
 const owner=client(),host=client(),guest=client(),stranger=client();
 assert.equal((await stranger.call('/api/rooms')).status,403);
 assert.equal((await stranger.call('/api/admin/dashboard')).status,401);
 assert.equal((await stranger.call('/api/request',{name:'bad'},'https://other.example')).status,403);
 const files=await readdir('dist/assets');
 assert.equal((await fetch(origin+'/assets/'+files.find(n=>n.endsWith('.js')))).status,403);
 assert.match(await fetch(origin).then(r=>r.text()),/REQUEST ACCESS/);
 assert.equal((await owner.call('/api/admin/login',{secret})).status,200);
 const hostId=(await host.call('/api/request',{name:'Host'})).body.requestId;
 assert.equal((await owner.call('/api/admin/approve',{id:hostId})).status,200);
 const guestId=(await guest.call('/api/request',{name:'Guest'})).body.requestId;
 const code=(await owner.call('/api/admin/code',{name:'Guest'})).body.code;
 assert.equal((await guest.call('/api/redeem',{code})).status,200);
 await stranger.call('/api/request',{name:'Reuse'});
 assert.equal((await stranger.call('/api/redeem',{code})).status,400);
 assert.equal((await fetch(origin+'/assets/'+files.find(n=>n.endsWith('.js')),{headers:{cookie:host.cookie}})).status,200);
 const hostSocket=await socket(host),guestSocket=await socket(guest),duplicate=await socket(host);
 assert.equal(duplicate.messages[0].type,'reject');
 send(hostSocket,{type:'host',version:VERSION,visibility:'private',options:{bots:0}});
 const welcome=await wait(()=>hostSocket.messages.find(m=>m.type==='welcome'));
 assert.equal((await guest.call('/api/rooms')).body.rooms.length,0);
 send(guestSocket,{type:'join',version:VERSION,code:welcome.code});
 await wait(()=>guestSocket.messages.find(m=>m.type==='welcome'));
 send(guestSocket,{type:'visibility',visibility:'public'});send(guestSocket,{type:'start'});
 await new Promise(r=>setTimeout(r,100));
 assert.equal((await guest.call('/api/rooms')).body.rooms.length,0);
 assert.equal(hostSocket.messages.filter(m=>m.type==='state').at(-1).state.phase,'lobby');
 send(hostSocket,{type:'visibility',visibility:'public'});send(hostSocket,{type:'start'});
 await wait(()=>hostSocket.messages.some(m=>m.type==='state'&&m.state.phase==='playing'));
 const listing=(await guest.call('/api/rooms')).body.rooms;
 assert.equal(listing[0].players,2);
 send(hostSocket,{type:'visibility',visibility:'private'});
 await wait(async()=>!(await guest.call('/api/rooms')).body.rooms.length);
 const people=(await owner.call('/api/admin/dashboard')).body.people;
 const person=people.find(p=>p.browser===guestId).id;
 await owner.call('/api/admin/revoke',{id:person});
 await wait(()=>guestSocket.messages.find(m=>m.type==='revoked'));
 assert.equal((await guest.call('/api/rooms')).status,403);
 // Keep a live socket beyond a heartbeat and check the Cloudflare application pong.
 await wait(()=>hostSocket.messages.find(m=>m.type==='session-ping'));
 assert.equal(hostSocket.readyState,WebSocket.OPEN);
 for(const ws of sockets)ws.terminate();
 await stop();await start();
 assert.equal((await host.call('/api/access')).body.status,'approved');
 assert.equal((await guest.call('/api/access')).body.status,'revoked');
 assert.equal((await owner.call('/api/admin/dashboard')).status,200);
 assert.equal((await stranger.call('/api/redeem',{code})).status,400);
 console.log('PASS Cloudflare runtime: asset gate, CSRF, approval, single-use codes, session lease, private/public matches, host permissions, heartbeat, revocation and persistent restart');
}finally{for(const ws of sockets)ws.terminate();await stop();await rm(persist,{recursive:true,force:true});}
