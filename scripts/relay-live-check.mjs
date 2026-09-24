// Optional live check: create one private room, send ordered messages and remove it.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {RelayPeer} from '../src/relay-peer.js';
import {VERSION} from '../src/data.js';
const endpoint=process.env.YOLK_RELAY_URL;
if(!endpoint)throw Error('Set YOLK_RELAY_URL to the deployed /game WebSocket URL.');
globalThis.window={YOLK_NETWORK:{relay:endpoint}};
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
const wait=(fn)=>new Promise((resolve,reject)=>{const until=Date.now()+15000;const timer=setInterval(()=>{if(fn()){clearInterval(timer);resolve();}else if(Date.now()>until){clearInterval(timer);reject(Error('Live relay timed out'));}},50);});
const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
const host=new RelayPeer(`yolk-yard-v${VERSION}-${code}`),guest=new RelayPeer(),errors=[],received=[];
host.on('error',e=>errors.push(e.type));guest.on('error',e=>errors.push(e.type));
let ready=0;host.on('open',()=>ready++);guest.on('open',()=>ready++);
host.on('connection',c=>c.on('data',data=>c.send(data)));
try{
 await wait(()=>ready===2||errors.length);assert.deepEqual(errors,[]);
 const conn=guest.connect(host.id);conn.on('data',m=>received.push(m));await wait(()=>conn.open||errors.length);assert.deepEqual(errors,[]);
 const started=performance.now();for(let i=0;i<5;i++)conn.send({sequence:i,padding:i===4?'x'.repeat(160000):''});
 await wait(()=>received.length===5||errors.length);assert.deepEqual(errors,[]);assert.deepEqual(received.map(m=>m.sequence),[0,1,2,3,4]);assert.equal(received[4].padding.length,160000);
 const old=guest.socket;guest.message({type:'rotate-request'});await wait(()=>guest.socket!==old&&!guest.rotating);conn.send({sequence:5});await wait(()=>received.length===6);assert.equal(received[5].sequence,5);
 assert.ok(!(await guest.list()).some(r=>r.code===code));
 console.log(JSON.stringify({passed:true,orderedMessages:received.length,largePayload:160000,renewal:true,elapsedMs:Math.round(performance.now()-started)}));
}finally{host.destroy();guest.destroy();}
