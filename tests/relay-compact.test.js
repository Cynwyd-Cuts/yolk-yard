import test from 'node:test';
import assert from 'node:assert/strict';
import {RelayPeer} from '../src/relay-peer.js';
import {SnapshotDecoder} from '../src/snapshot-codec.js';
function transport(compact=true){
 const frames=[],peer=Object.assign(Object.create(RelayPeer.prototype),{queue:[],queueBytes:0,connections:new Map([['a',{compact,queuedBytes:0}],['b',{compact,queuedBytes:0}]]),unacked:new Map(),sentBytes:0,protocol:1,socket:{readyState:1,bufferedAmount:0,send:raw=>frames.push(JSON.parse(raw))}});
 return {peer,frames};
}
const state=(channel,time)=>({type:'data',channel,data:{type:'state',state:{time,round:1,phase:'playing',players:[{id:'guest',x:time}],projectiles:[],events:[{id:time}]}}});
test('interleaved guests merge stale snapshots before delta encoding and preserve events',()=>{
 const {peer,frames}=transport();peer.enqueue(state('a',1));peer.enqueue(state('b',1));peer.enqueue(state('a',2));peer.flush();
 assert.equal(frames[0].messages.length,2);
 const encoded=frames[0].messages.find(m=>m.channel==='a');assert.equal(encoded.data.type,'snapshot-v1');
 const decoder=new SnapshotDecoder(),decoded=decoder.decode(encoded.data.frame);assert.equal(decoded.state.time,2);assert.deepEqual(decoded.state.events,[{id:1},{id:2}]);
 peer.enqueue(state('a',3));peer.flush();assert.equal(decoder.decode(frames[1].messages[0].data.frame).state.time,3);
});
test('older connections retain full states and input steps are never merged',()=>{
 const {peer,frames}=transport(false);peer.enqueue(state('a',1));
 for(let seq=1;seq<=3;seq++)peer.enqueue({type:'data',channel:'a',data:{type:'input',input:{seq,fire:seq===2}}});
 peer.flush();assert.equal(frames[0].messages[0].data.type,'state');assert.equal(frames[0].messages.length,4);
});
