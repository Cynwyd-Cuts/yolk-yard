import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRelayMessage} from '../src/relay-queue.js';
const entry=data=>({type:'data',channel:'a',data});
test('coalescing retains world deltas, checkpoint and distinct events',()=>{
 const a=entry({type:'state',checkpoint:{tick:1},state:{round:1,phase:'playing',events:[{id:1}],royale:{loot:[1],builds:[2]}}});
 const b=entry({type:'state',state:{round:1,phase:'playing',events:[{id:2}],royale:{lootVersion:2}}});
 const m=mergeRelayMessage(a,b);assert.deepEqual(m.data.state.events,[{id:1},{id:2}]);assert.deepEqual(m.data.state.royale.loot,[1]);assert.deepEqual(m.data.checkpoint,{tick:1});
 assert.equal(mergeRelayMessage(a,entry({type:'state',state:{round:2,phase:'playing'}})),null);
});
test('input steps and button edges are never coalesced',()=>{
 const a=entry({type:'input',input:{seq:1,forward:1,fire:false}});
 const b=entry({type:'input',input:{seq:2,forward:0,fire:false}});
 assert.equal(mergeRelayMessage(a,b),null);
 assert.equal(mergeRelayMessage(a,entry({type:'input',input:{seq:3,fire:true}})),null);
 assert.equal(mergeRelayMessage(a,entry({type:'player-action',action:'respawn'})),null);
});
