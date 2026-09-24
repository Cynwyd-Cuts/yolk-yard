import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {WebSocketServer} from 'ws';
import {RealtimeRelay} from './relay.js';
export async function startRealtimeServer({port=Number(process.env.PORT)||3000,host='0.0.0.0',origins=(process.env.ALLOWED_ORIGINS||'https://zl-2.github.io').split(',')}={}){
  const relay=new RealtimeRelay();
  const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.writeHead(req.url==='/health'?200:404);res.end(JSON.stringify(req.url==='/health'?{ok:true,protocol:'yolk-realtime-v2'}:{error:'Not found'}));});
  const sockets=new WebSocketServer({noServer:true,maxPayload:2_000_000,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    if(req.url!=='/game'||!origins.includes(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    sockets.handleUpgrade(req,socket,head,ws=>relay.attach(ws));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return {server,relay,async close(){relay.close();for(const ws of sockets.clients)ws.terminate();await new Promise(r=>sockets.close(r));await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=await startRealtimeServer();console.log(`Yolk relay listening on ${app.server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
