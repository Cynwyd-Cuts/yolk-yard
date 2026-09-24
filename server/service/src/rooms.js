const now=()=>Date.now();
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function roomSocket(request,env){
 const [client,ws]=Object.values(new WebSocketPair()); ws.accept();
 const token=crypto.randomUUID(); let code=null,role=null,closed=false,busy=false,last=0,timer;
 const send=data=>{if(!closed)ws.send(JSON.stringify(data));};
 const end=()=>{closed=true;clearTimeout(timer);};
 async function leave(){
  if(!code)return;
  if(role==='host')await query(env,'DELETE FROM rooms WHERE code=? AND host=?',code,token).run();
  else await query(env,'UPDATE rooms SET guest=NULL,guest_seen=0 WHERE code=? AND guest=?',code,token).run();
  code=null;role=null;
 }
 async function tick(){
  if(closed)return;
  try{
   if(code){
    const r=await query(env,'SELECT * FROM rooms WHERE code=?',code).first();
    if(!r||r.expires<now()||r.host_seen<now()-20000||r[role]!==token){await leave();send({type:'ended',message:'Room closed or expired. Create or join another room.'});}
    else send({type:'state',code,role,players:r.guest&&r.guest_seen>now()-20000?2:1,hostMessages:r.host_messages,guestMessages:r.guest_messages,expires:r.expires});
   }
  }catch{send({type:'error',message:'Room service unavailable. Please reconnect.'});ws.close(1011,'Service unavailable');end();}
  if(!closed)timer=setTimeout(tick,1000);
 }
 ws.addEventListener('close',()=>{end();leave().catch(()=>{});});ws.addEventListener('error',end);
 ws.addEventListener('message',async e=>{
  if(closed)return;
  if(typeof e.data!=='string'||e.data.length>256){ws.close(1008,'Invalid message');end();return;}
  if(busy||now()-last<150)return;busy=true;last=now();
  try{
   const m=JSON.parse(e.data);
   if(m.type==='create'&&!code){
    await query(env,'DELETE FROM rooms WHERE expires<?',now()).run();
    const count=await query(env,'SELECT count(*) AS n FROM rooms').first();if(count.n>=100)throw Error('Test service full. Try again shortly.');
    const bytes=crypto.getRandomValues(new Uint8Array(8));const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const next=Array.from(bytes,b=>alphabet[b%32]).join('');
    await query(env,'INSERT INTO rooms(code,public,host,host_seen,expires) VALUES(?,?,?,?,?)',next,m.public===true?1:0,token,now(),now()+300000).run();code=next;role='host';send({type:'joined',code,role});
   }else if(m.type==='join'&&!code){
    const next=String(m.code||'').toUpperCase().replace(/[-\s]/g,'');if(!/^[A-Z2-9]{8}$/.test(next))throw Error('Enter the eight-character room code.');
    const r=await query(env,'UPDATE rooms SET guest=?,guest_seen=? WHERE code=? AND expires>? AND host_seen>? AND (guest IS NULL OR guest_seen<?) RETURNING *',token,now(),next,now(),now()-20000,now()-20000).first();
    if(!r)throw Error('Room not found, full, or host disconnected.');code=next;role='guest';send({type:'joined',code,role,sent:r.guest_messages,received:r.host_messages});
   }else if(m.type==='list'){
    const r=await query(env,'SELECT code FROM rooms WHERE public=1 AND expires>? AND host_seen>? AND (guest IS NULL OR guest_seen<?) ORDER BY host_seen DESC LIMIT 30',now(),now()-20000,now()-20000).all();send({type:'rooms',rooms:r.results});
   }else if(m.type==='heartbeat'&&code){
    await query(env,`UPDATE rooms SET ${role}_seen=? WHERE code=? AND ${role}=?`,now(),code,token).run();send({type:'alive'});
   }else if(m.type==='message'&&code){
    const r=await query(env,`UPDATE rooms SET ${role}_messages=${role}_messages+1 WHERE code=? AND ${role}=? AND expires>? AND host_seen>? AND guest_seen>? AND guest IS NOT NULL RETURNING code`,code,token,now(),now()-20000,now()-20000).first();
    if(!r)throw Error('Wait for both computers to be connected.');send({type:'sent'});
   }else if(m.type==='leave'){await leave();send({type:'ended',message:'You left the room.'});}
  }catch(e){send({type:'error',message:e.message?.startsWith('D1')?'Room service unavailable. Please retry.':String(e.message).slice(0,120)});}finally{busy=false;}
 });
 send({type:'ready'});timer=setTimeout(tick,1000);
 const lifetime=setTimeout(()=>{ws.close(1000,'Test session complete; reconnect to continue');end();leave().catch(()=>{});},360000);
 ws.addEventListener('close',()=>clearTimeout(lifetime));
 return new Response(null,{status:101,webSocket:client});
}
