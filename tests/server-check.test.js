import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/server-check.js',import.meta.url),'utf8');
async function runProbe(badReply=false){
 const fields=new Map();
 const document={getElementById(id){if(!fields.has(id))fields.set(id,{textContent:'',value:'',disabled:false});return fields.get(id);}};
 const sent=[];
 class Socket {
  constructor(){setTimeout(()=>this.onopen(),0);}
  send(raw){const message=JSON.parse(raw);sent.push(message);setTimeout(()=>this.onmessage({data:JSON.stringify({protocol:'yolk-connection-probe-v1',type:'pong',id:badReply?99:message.id})}),0);}
  close(){}
 }
 const context=vm.createContext({document,WebSocket:Socket,fetch:async()=>({ok:true,json:async()=>({ok:true,protocol:'yolk-connection-probe-v1'})}),AbortController,performance,Date,JSON,Error,
  setTimeout:(fn,ms)=>setTimeout(fn,ms===2000?0:ms),clearTimeout,window:{addEventListener(){}},navigator:{}});
 vm.runInContext(source,context);
 await document.getElementById('run').onclick();
 return {report:document.getElementById('report').value,sent,disabled:document.getElementById('run').disabled};
}
test('server check only passes after three matching replies',async()=>{
 const result=await runProbe();
 assert.match(result.report,/Passed — 3\/3 replies/);
 assert.deepEqual(result.sent,[{type:'ping',id:1},{type:'ping',id:2},{type:'ping',id:3}]);
 assert.equal(result.disabled,false);
});
test('unexpected reply fails rather than claiming network compatibility',async()=>{
 const result=await runProbe(true);
 assert.match(result.report,/Failed — Unexpected server reply/);
 assert.doesNotMatch(result.report,/Result: Passed/);
 assert.equal(result.disabled,false);
});
