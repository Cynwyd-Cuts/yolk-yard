const $=id=>document.getElementById(id);
let socket,heartbeat,watchdog,lastReceived=0,active=false,role='',start=0,baseSent=0,baseReceived=0,baseline=false;
const result={connection:'Not connected',discovery:'Not checked',join:'Not joined',sent:0,received:0,duration:0};
function report(){ $('report').value=['Yolk Yard shared room test v1',new Date().toISOString(),...Object.entries(result).map(([k,v])=>`${k}: ${v}`)].join('\n'); }
function status(text){$('status').textContent=text;report();}
function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data));}
function lobby(){active=false;role='';baseline=false;$('setup').hidden=false;$('room').hidden=true;}
function connect(){
 const old=socket;socket=null;old?.close();clearInterval(heartbeat);clearInterval(watchdog);lobby();
 $('connect').hidden=true;['create','join','refresh'].forEach(id=>$(id).disabled=true);status('Connecting…');
 const ws=new WebSocket('wss://yolk-yard-connection-check.zachlaskin99.chatgpt.site/rooms');socket=ws;lastReceived=Date.now();
 ws.onmessage=e=>{
  if(socket!==ws)return;lastReceived=Date.now();let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='ready'){
   result.connection='Connected';status('Connected to the room server.');['create','join','refresh'].forEach(id=>$(id).disabled=false);send({type:'list'});
   heartbeat=setInterval(()=>{if(active)send({type:'heartbeat'});else send({type:'list'});},5000);
  }
  if(m.type==='rooms'){
   result.discovery=`Passed — ${m.rooms.length} available rooms`;$('directory').textContent=m.rooms.length?'Choose the room created on the other computer.':'No public test rooms available. Create one on the first computer.';$('rooms').replaceChildren();
   for(const r of m.rooms){const b=document.createElement('button');b.textContent=`Join ${r.code}`;b.onclick=()=>join(r.code);$('rooms').append(b);}report();
  }
  if(m.type==='joined'){
   active=true;role=m.role;start=Date.now();baseSent=m.sent||0;baseReceived=m.received||0;baseline=true;result.join=`Passed — ${role}`;result.sent=0;result.received=0;result.duration=0;
   $('setup').hidden=true;$('room').hidden=false;$('code').textContent=m.code;$('counts').textContent='Waiting for room state…';$('result').textContent='';$('send').disabled=true;status('Room joined. Keep this tab open.');
  }
  if(m.type==='state'&&active){
   const sent=role==='host'?m.hostMessages:m.guestMessages,received=role==='host'?m.guestMessages:m.hostMessages;
   if(!baseline){baseSent=sent;baseReceived=received;baseline=true;}
   result.sent=sent-baseSent;result.received=received-baseReceived;result.duration=Math.floor((Date.now()-start)/1000);
   $('members').textContent=`You are the ${role} · ${m.players}/2 computers connected · ${Math.max(0,Math.ceil((m.expires-Date.now())/1000))} seconds left`;
   $('send').disabled=m.players!==2;$('counts').textContent=`Your messages: ${result.sent} · Messages received from the other computer: ${result.received}`;
   $('result').textContent=result.sent>0&&result.received>0?'Passed: messages traveled in both directions through the server.':'Send a test message from each computer.';report();
  }
  if(m.type==='ended'){lobby();status(m.message);}
  if(m.type==='error')status(m.message);
 };
 ws.onclose=()=>{if(socket!==ws)return;clearInterval(heartbeat);clearInterval(watchdog);result.connection='Disconnected';lobby();['create','join','refresh'].forEach(id=>$(id).disabled=true);$('connect').hidden=false;status('Connection ended. Reconnect to start another test.');};
 ws.onerror=()=>{if(socket===ws)status('Could not connect. Try Reconnect.');};
 watchdog=setInterval(()=>{if(Date.now()-lastReceived>18000){ws.close();}},3000);
}
function join(code){send({type:'join',code});}
$('connect').onclick=connect;$('create').onclick=()=>send({type:'create',public:$('public').checked});$('join').onclick=()=>join($('joinCode').value);$('refresh').onclick=()=>send({type:'list'});$('leave').onclick=()=>send({type:'leave'});
$('send').onclick=()=>{send({type:'message'});$('send').disabled=true;};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('report').value);$('copy').textContent='Copied';}catch{$('report').focus();$('report').select();$('copy').textContent='Select and copy the report';}};
window.addEventListener('pagehide',()=>socket?.close());connect();
