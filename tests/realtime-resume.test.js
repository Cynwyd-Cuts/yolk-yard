import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startRealtimeServer} from '../server/realtime/index.js';
import {RelayPeer} from '../src/relay-peer.js';
const until=async(fn)=>{const end=Date.now()+5000;while(!fn()){assert.ok(Date.now()<end,'Timed out');await new Promise(r=>setTimeout(r,10));}};
test('socket recovery preserves channels and delivers queued actions exactly once',async()=>{
 const app=await startRealtimeServer({port:0,host:'127.0.0.1'});
 globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 const host=new RelayPeer('yolk-yard-v14-ABCDEFGH'),guest=new RelayPeer(),received=[],errors=[];
 let ready=0;host.on('open',()=>ready++);guest.on('open',()=>ready++);
 host.on('error',e=>errors.push(e));guest.on('error',e=>errors.push(e));
 host.on('connection',c=>c.on('data',m=>{received.push(m.number);c.send(m);}));
 try{
  await until(()=>ready===2);const c=guest.connect(host.id),echo=[];c.on('data',m=>echo.push(m.number));await until(()=>c.open);
  c.send({type:'action',number:0});await until(()=>echo.length===1);
  guest.socket.terminate();await until(()=>guest.reconnecting);
  for(let i=1;i<21;i++)c.send({type:'action',number:i});
  await until(()=>echo.length===21);assert.equal(c.open,true);
  assert.deepEqual(received,Array.from({length:21},(_,i)=>i));assert.deepEqual(echo,received);assert.deepEqual(errors,[]);
 }finally{host.destroy();guest.destroy();await app.close();}
});
