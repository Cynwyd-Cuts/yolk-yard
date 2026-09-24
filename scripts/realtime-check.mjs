import assert from 'node:assert/strict';
import {startRealtimeServer} from '../server/realtime/index.js';
import WebSocket from 'ws';
globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
import {Network} from '../src/network.js';
import {directory} from '../src/directory.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {safeProfile} from '../src/data.js';
globalThis.window={YOLK_NETWORK:{relay:'ws://127.0.0.1:9002/game'}};
const server=await startRealtimeServer({port:9002,host:'127.0.0.1'}),nets=[],timers=[];
const wait=async(fn,ms=12000)=>{const end=Date.now()+ms;while(!fn()){assert.ok(Date.now()<end,'Timed out');await new Promise(r=>setTimeout(r,25));}};
function player(name,mode){const node={states:[],errors:[],chats:[],sim:null};node.net=new Network({
 getCheckpoint:()=>node.sim?.checkpoint(),getChatState:()=>node.sim?.snapshot()||node.states.at(-1),
 onJoin:(id,p)=>!!node.sim.admitPlayer(id,p),onLeave:id=>node.sim?.leavePlayer(id),onInput:(id,input)=>node.sim?.setInput(id,input),onPlayerAction:(id,a)=>node.sim?.playerAction(id,a),
 onState:s=>node.states.push(s),onChat:m=>node.chats.push(m),onError:e=>node.errors.push(e),
 onHost:(checkpoint,departed)=>{node.sim=(mode==='royale'?new RoyaleSimulation(checkpoint.options):new Simulation(checkpoint.options)).restore(checkpoint);for(const id of departed)node.sim.leavePlayer(id);},
 });nets.push(node.net);node.profile=safeProfile({name});
 const timer=setInterval(()=>{if(node.sim&&!node.net.closed){node.sim.tick(1/60);if(!node.lastBroadcast||performance.now()-node.lastBroadcast>(mode==='royale'?100:50)){node.lastBroadcast=performance.now();node.net.broadcast(node.sim.snapshot());}}},1000/60);timers.push(timer);return node;}
try{
 for(const mode of ['ffa','royale']){
  const host=player('Alpha',mode),guest=player('Bravo',mode),third=player('Charlie',mode);
  const options={mode,map:mode==='royale'?'sunnybreak':'yard',bots:0,capacity:mode==='royale'?16:8,fillBots:false};
  host.net.maxConnections=options.capacity-1;
  host.sim=mode==='royale'?new RoyaleSimulation(options):new Simulation(options);host.sim.addPlayer('host',host.profile);
  const code=await host.net.host();host.net.setVisibility('public');host.net.broadcast(host.sim.snapshot());host.net.publishRoom();
  await wait(()=>[...server.relay.peers.values()].some(p=>p.listing));
  assert.ok((await directory.list()).rooms.some(r=>r.code===code));
  await guest.net.join(code,guest.profile);await third.net.join(code,third.profile);
  host.sim.startRound();
  // Explicit broadcasts also exercise large Royale snapshots/checkpoints.

  await wait(()=>guest.states.some(s=>s.phase==='playing')&&third.states.some(s=>s.phase==='playing'));
  guest.net.send({type:'player-action',action:'respawn'});
  await wait(()=>host.sim.players.get(guest.net.id)?.health>0);
  for(let seq=1;seq<=10;seq++)guest.net.input({seq,forward:1,strafe:0,yaw:0,pitch:0,dt:1/60});
  await wait(()=>host.sim.players.get(guest.net.id)?.ack>=10);
  host.net.setVisibility('private');await new Promise(r=>setTimeout(r,200));assert.ok(!(await directory.list()).rooms.some(r=>r.code===code));
  host.net.setVisibility('public');host.net.broadcast(host.sim.snapshot());await wait(()=>guest.net.lastCheckpoint?.simulation&&third.net.lastCheckpoint?.simulation&&guest.net.visibility==='public'&&third.net.visibility==='public');
  host.net.destroy();await wait(()=>guest.net.isHost&&!third.net.migrating&&third.net.hostId===guest.net.id);
  await wait(()=>[...server.relay.peers.values()].some(p=>p.listing?.code===code));assert.ok((await directory.list()).rooms.some(r=>r.code===code));
  const late=player('Delta',mode);await late.net.join(code,late.profile);await wait(()=>late.states.length>0);
  // Force a connection renewal while gameplay continues, retaining IDs and links.
  const previousSocket=guest.net.peer.socket;guest.net.peer.socket.terminate();
  await wait(()=>guest.net.peer.socket!==previousSocket&&!guest.net.peer.rotating);
  const count=third.states.length;await wait(()=>third.states.length>count+3);
  assert.deepEqual([...host.errors,...guest.errors,...third.errors,...late.errors],[]);
  if(mode==='royale'){
   const extra=[];
   for(let i=0;i<13;i++){const n=player('Visitor '+i,mode);extra.push(n);await n.net.join(code,n.profile);}
   try{await wait(()=>extra.every(n=>n.states.length>2));}catch(e){console.log('FULL ROOM DIAGNOSTIC',JSON.stringify({hostErrors:guest.errors,closed:guest.net.peer.destroyed,rotating:guest.net.peer.rotating,guests:extra.map(n=>({states:n.states.length,errors:n.errors,ready:n.net.ready,closed:n.net.peer.destroyed})),sessions:[...server.relay.peers.values()].map(s=>({links:s.links.size,bytes:s.bytes,queued:s.pendingBytes}))}));throw e;}
   assert.equal(guest.sim.snapshot().players.filter(p=>!p.bot).length,16);
   assert.ok(extra.every(n=>n.errors.length===0));
   for(const n of extra)n.net.destroy();
   console.log('PASS full 16-player Royale room receives snapshots');
  }
  const end=Date.now()+Number(process.env.RELAY_SOAK_MS||65000);let samples=0,maxLatency=0,maxQueue=0;
  while(Date.now()<end){
   third.net.input({seq:100+samples,forward:1,strafe:0,yaw:samples/10,pitch:0,dt:1/60});
   await new Promise(r=>setTimeout(r,100));samples++;
   maxLatency=Math.max(maxLatency,third.net.latency);maxQueue=Math.max(maxQueue,...[...server.relay.peers.values()].map(p=>p.pendingBytes+p.historyBytes));
   assert.equal(third.net.peer.destroyed,false);assert.ok(performance.now()-third.net.lastState<3000,'Gameplay stopped');
  }
  assert.deepEqual([...guest.errors,...third.errors,...late.errors],[]);
  console.log(JSON.stringify({mode,samples,maxLatency,maxQueue,disconnects:third.errors.length}));
  console.log('PASS',mode,'public/private listing, room code, real simulation, ordered input, checkpoints, host transfer, late join');
  for(const n of [guest,third,late])n.net.destroy();
  await new Promise(r=>setTimeout(r,300));
 }
}finally{for(const t of timers)clearInterval(t);for(const net of nets)net.destroy();await server.close();}
