import {gameSocket} from './relay.js';
import {roomSocket} from './rooms.js';
const PROTOCOL = 'yolk-connection-probe-v1';
const ORIGINS = new Set(['https://zl-2.github.io','https://yolk-yard-connection-check.zachlaskin99.chatgpt.site']);
export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = ORIGINS.has(origin);
    const headers = {'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if (allowed) headers['Access-Control-Allow-Origin'] = origin;
    if (origin && !allowed) return new Response('Origin not allowed',{status:403,headers});
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
    if (request.method !== 'GET') return new Response('Method not allowed',{status:405,headers});
    if (url.pathname === '/health') return Response.json({protocol:PROTOCOL,ok:true},{headers});
    if (url.pathname === '/game') {
      if(!allowed) return new Response('Origin required',{status:403,headers});
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket required',{status:426,headers});
      return gameSocket(request,env);
    }
    if (url.pathname === '/rooms') {
      if(!allowed) return new Response('Origin required',{status:403,headers});
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket required',{status:426,headers});
      return roomSocket(request,env);
    }
    if (url.pathname !== '/probe') return new Response('Yolk Yard connection check. Open the server check from the game.',{headers:{...headers,'Content-Type':'text/plain'}});
    if (!allowed) return new Response('Origin required',{status:403,headers});
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required',{status:426,headers});
    const pair = new WebSocketPair();
    const [client,server] = Object.values(pair);
    server.accept();
    let count=0;
    const timer=setTimeout(()=>{try{server.close(1000,'Check complete');}catch{}},20000);
    const cleanup=()=>clearTimeout(timer);
    server.addEventListener('close',cleanup);
    server.addEventListener('error',cleanup);
    server.addEventListener('message',event=>{
      if(typeof event.data!=='string'||event.data.length>128||++count>3){server.close(1008,'Invalid check');cleanup();return;}
      let msg;
      try{msg=JSON.parse(event.data);}catch{server.close(1008,'Invalid check');cleanup();return;}
      if(msg.type!=='ping'||msg.id!==count){server.close(1008,'Invalid check');cleanup();return;}
      server.send(JSON.stringify({protocol:PROTOCOL,type:'pong',id:count}));
    });
    return new Response(null,{status:101,webSocket:client});
  }
};
