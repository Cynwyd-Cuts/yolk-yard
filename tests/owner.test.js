import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OwnerService} from '../server/realtime/owner.js';

const origin='https://zl-2.github.io',code='89271406539284756012';
async function request(service,{url='/owner/summary',method='GET',body,token,from=origin}={}){
 const headers={origin:from,...(token?{authorization:`Bearer ${token}`}:{})};
 let status,result,extra;
 const res={writeHead(s,h){status=s;extra=h;},end(s){result=s?JSON.parse(s):null;}};
 await service.handle({url,method,headers,async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}},res,{origins:[origin],relay:{peers:new Map()}});
 return {status,result,headers:extra};
}
test('owner routes deny unauthorized and cross-origin access; valid code unlocks counts',async()=>{
 const owner=new OwnerService({code});await owner.ready;
 assert.equal((await request(owner)).status,401);
 assert.equal((await request(owner,{url:'/owner/login',method:'POST',body:{code},from:'https://attacker.example'})).status,403);
 assert.equal((await request(owner,{url:'/owner/login',method:'POST',body:{code:'000000000000'}})).status,401);
 const {status,result}=await request(owner,{url:'/owner/login',method:'POST',body:{code}});
 assert.equal(status,200);assert.match(result.token,/^[a-f0-9]{64}$/);
 const id='a0123456-789a-4bcd-8ef0-123456789abc';
 assert.equal((await request(owner,{url:'/owner/activity',method:'POST',body:{id,event:'pulse',mode:'royale'}})).status,200);
 const summary=await request(owner,{token:result.token});
 assert.equal(summary.result.online,1);assert.equal(summary.result.visits,1);
 assert.equal(summary.result.active[0].mode,'royale');
 await request(owner,{url:'/owner/activity',method:'POST',body:{id,event:'end'}});
 assert.equal((await request(owner,{token:result.token})).result.past.length,1);
 assert.equal((await request(owner,{url:'/owner/logout',method:'POST',token:result.token})).status,200);
 assert.equal((await request(owner,{token:result.token})).status,401);
 await owner.close();
});
test('no configured code fails closed; failed attempts are throttled',async()=>{
 const disabled=new OwnerService({code:undefined});await disabled.ready;
 assert.equal((await request(disabled,{url:'/owner/login',method:'POST',body:{code}})).status,503);
 const owner=new OwnerService({code});await owner.ready;
 for(let i=0;i<5;i++)assert.equal((await request(owner,{url:'/owner/login',method:'POST',body:{code:'111111111111'}})).status,401);
 assert.equal((await request(owner,{url:'/owner/login',method:'POST',body:{code}})).status,429);
 await disabled.close();await owner.close();
});
test('persisted history survives restart without reactivating visitors',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'yolk-owner-test-'));
 const file=join(folder,'owner.json');const owner=new OwnerService({code,storePath:file});await owner.ready;
 owner.activity({id:'a0123456-789a-4bcd-8ef0-123456789abc',event:'pulse',mode:'menu'});
 await owner.close();
 const restored=new OwnerService({code,storePath:file});await restored.ready;
 assert.equal(restored.active.size,0);assert.equal(restored.totals.visits,1);assert.equal(restored.past.length,1);
 assert.equal(restored.past[0].reason,'restart');await restored.close();
 assert.ok((await readFile(file,'utf8')).includes('visits'));
});
