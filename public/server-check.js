'use strict';
const endpoint='https://yolk-yard-connection-check.zachlaskin99.chatgpt.site';
const protocol='yolk-connection-probe-v1';
const el=id=>document.getElementById(id);
let running=false,cleanup=()=>{};
function report(){
 el('report').value=['Yolk Yard server connection check v1','Time: '+new Date().toISOString(),'Endpoint: '+endpoint,
 'HTTPS: '+el('https').textContent,'WebSocket: '+el('socket').textContent,'Replies: '+el('replies').textContent,
 'Result: '+el('summary').textContent].join('\n');
}
async function run(){
 if(running)return;
 running=true;el('run').disabled=true;el('copy-status').textContent='';
 el('https').textContent='Checking…';el('socket').textContent='Waiting…';el('replies').textContent='Waiting…';el('summary').textContent='Check running…';report();
 const controller=new AbortController();
 const httpTimer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(endpoint+'/health',{mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  el('https').textContent=data.protocol===protocol&&data.ok===true?'Passed — expected server response received.':'Failed — unexpected server response.';
 }catch{el('https').textContent='Failed — could not read the expected HTTPS response (network, server, or access policy).';}
 finally{clearTimeout(httpTimer);}
 el('socket').textContent='Connecting…';el('replies').textContent='Waiting for server…';report();
 await new Promise(resolve=>{
  let socket,timer,nextTimer,finished=false,sent=0,received=0,started=0;
  const latencies=[];
  const finish=(ok,reason)=>{
   if(finished)return;finished=true;clearTimeout(timer);clearTimeout(nextTimer);
   if(!ok){if(el('socket').textContent==='Connecting…')el('socket').textContent='Failed — connection did not open.';el('replies').textContent='Failed — '+reason+' Replies: '+received+'/3.';}
   el('summary').textContent=ok?(el('https').textContent.startsWith('Passed')?'Passed: HTTPS and a short two-way WebSocket exchange work on this connection.':'Partial: WebSocket replies passed, but HTTPS access did not.'):'The server check did not complete. This result alone does not identify a firewall block.';
   if(socket)try{socket.close(1000,'Check complete');}catch{}
   cleanup=()=>{};report();resolve();
  };
  cleanup=()=>finish(false,'Check cancelled.');
  timer=setTimeout(()=>finish(false,'Timed out after 15 seconds.'),15000);
  const ping=()=>{if(finished)return;started=performance.now();socket.send(JSON.stringify({type:'ping',id:++sent}));};
  try{socket=new WebSocket(endpoint.replace('https:','wss:')+'/probe');}
  catch{finish(false,'Browser could not create the connection.');return;}
  socket.onopen=()=>{el('socket').textContent='Passed — secure connection opened.';report();ping();};
  socket.onmessage=event=>{
   let msg;try{msg=JSON.parse(event.data);}catch{finish(false,'Unexpected server message.');return;}
   if(msg.protocol!==protocol||msg.type!=='pong'||msg.id!==sent||received>=sent){finish(false,'Unexpected server reply.');return;}
   received++;latencies.push(Math.round(performance.now()-started));
   el('replies').textContent=received+'/3 replies received.';report();
   if(received===3){el('replies').textContent='Passed — 3/3 replies. Round trips: '+latencies.join(', ')+' ms.';finish(true);return;}
   nextTimer=setTimeout(ping,2000);
  };
  socket.onerror=()=>finish(false,'Connection error.');
  socket.onclose=event=>finish(false,'Connection closed (code '+event.code+').');
 });
 running=false;el('run').disabled=false;
}
el('run').onclick=()=>run().catch(()=>{cleanup();running=false;el('run').disabled=false;el('summary').textContent='Check interrupted. Please retry.';report();});
el('copy').onclick=async()=>{
 try{await navigator.clipboard.writeText(el('report').value);el('copy-status').textContent='Copied. Send this report back.';}
 catch{el('report').focus();el('report').select();el('copy-status').textContent='Copy the selected text, or take a screenshot.';}
};
window.addEventListener('pagehide',()=>cleanup());
