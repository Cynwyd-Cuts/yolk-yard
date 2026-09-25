import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

const WINDOW=20*60_000, ACTIVE=90_000, RETENTION=30*86_400_000, MAX_HISTORY=1000;
const json=(res,status,data,origin)=>{
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});
  res.end(JSON.stringify(data));
};
const readBody=async(req)=>{
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>2048)throw Error('Body too large');parts.push(part);}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
};
const safeMode=mode=>['menu','lobby','ffa','teams','royale'].includes(mode)?mode:'menu';
export class OwnerService {
  constructor({code=process.env.YOLK_OWNER_CODE,storePath=process.env.YOLK_OWNER_DATA_PATH}={}){
    // No owner access exists until a high-entropy numeric code is installed on the server.
    this.salt=randomBytes(24);this.digest=/^\d{12,32}$/.test(code||'')?scryptSync(code,this.salt,64):null;
    this.tokens=new Map();this.attempts=[];this.active=new Map();this.past=[];this.totals={visits:0};this.storePath=storePath;
    this.ready=this.restore();this.persistTimer=null;
  }
  async restore(){if(!this.storePath)return;try{
    const data=JSON.parse(await readFile(this.storePath,'utf8'));
    this.totals={visits:Math.max(0,Number(data.totals?.visits)||0)};
    this.past=Array.isArray(data.past)?data.past.filter(s=>s&&Date.now()-s.ended<RETENTION).slice(-MAX_HISTORY):[];
    // Sessions interrupted by a server restart are marked ended; no stale active visitors.
    for(const s of data.active||[])if(s&&Number.isFinite(s.started))this.past.push({...s,ended:Date.now(),reason:'restart'});
    this.past=this.past.slice(-MAX_HISTORY);
  }catch(e){if(e.code!=='ENOENT')console.error('Owner history could not be loaded');}}
  persist(){if(!this.storePath||this.persistTimer)return;this.persistTimer=setTimeout(()=>{this.persistTimer=null;void this.save();},1000);this.persistTimer.unref?.();}
  async save(){if(!this.storePath)return;const path=this.storePath;try{
    await mkdir(dirname(path),{recursive:true});const temporary=path+'.tmp';
    await writeFile(temporary,JSON.stringify({totals:this.totals,past:this.past,active:[...this.active.values()]}),{mode:0o600});
    await rename(temporary,path);
  }catch{console.error('Owner history could not be saved');}}
  close(){clearTimeout(this.persistTimer);return this.save();}
  sweep(){const now=Date.now();for(const [id,s]of this.active)if(now-s.seen>ACTIVE)this.end(id,'timeout');for(const [t,expiry]of this.tokens)if(expiry<=now)this.tokens.delete(t);this.past=this.past.filter(s=>now-s.ended<RETENTION).slice(-MAX_HISTORY);}
  end(id,reason='left'){const s=this.active.get(id);if(!s)return;this.active.delete(id);this.past.push({...s,ended:Date.now(),reason});this.past=this.past.slice(-MAX_HISTORY);this.persist();}
  activity(input){this.sweep();const now=Date.now();const id=input?.id;
    if(typeof id!=='string'||!/^[-a-f0-9]{36}$/.test(id))return false;
    const existing=this.active.get(id);
    if(input.event==='end'){this.end(id);return true;}
    if(input.event!=='pulse')return false;
    if(!existing&&this.active.size>=2000)return false;
    const mode=safeMode(input.mode);
    if(existing){existing.seen=now;existing.mode=mode;}
    else{this.active.set(id,{id,started:now,seen:now,mode});this.totals.visits++;}
    this.persist();return true;
  }
  authorized(req){const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'')?.[1];const expiry=this.tokens.get(token);return Boolean(expiry&&expiry>Date.now());}
  async handle(req,res,{origins,relay}){
    const origin=req.headers.origin,allowed=origin&&origins.includes(origin);
    if(!allowed){json(res,403,{error:'Origin denied'});return;}
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;
    }
    try{
      if(req.url==='/owner/activity'&&req.method==='POST'){
        if(!this.digest){json(res,503,{error:'Owner analytics are not configured'},origin);return;}
        const body=await readBody(req);json(res,this.activity(body)?200:400,{ok:true},origin);return;
      }
      if(req.url==='/owner/login'&&req.method==='POST'){
        const now=Date.now();this.attempts=this.attempts.filter(at=>now-at<15*60_000);
        if(!this.digest){json(res,503,{error:'Owner access is not configured'},origin);return;}
        if(this.attempts.length>=5){json(res,429,{error:'Too many attempts. Wait 15 minutes.'},origin);return;}
        const input=await readBody(req),code=input?.code;
        this.attempts.push(now);
        // Hash every attempt; response never reveals partial matches or the code.
        const candidate=scryptSync(typeof code==='string'&&/^\d{12,32}$/.test(code)?code:'',this.salt,64);
        if(!timingSafeEqual(candidate,this.digest)){json(res,401,{error:'Incorrect code'},origin);return;}
        this.attempts=[];const token=randomBytes(32).toString('hex');this.tokens.set(token,now+WINDOW);
        json(res,200,{token,expires:now+WINDOW},origin);return;
      }
      if(req.url==='/owner/logout'&&req.method==='POST'){
        if(!this.authorized(req)){json(res,401,{error:'Unauthorized'},origin);return;}
        this.tokens.delete(req.headers.authorization.slice(7));json(res,200,{ok:true},origin);return;
      }
      if(req.url==='/owner/summary'&&req.method==='GET'){
        if(!this.authorized(req)){json(res,401,{error:'Unauthorized'},origin);return;}
        this.sweep();const peers=[...relay.peers.values()];
        json(res,200,{visits:this.totals.visits,online:this.active.size,relayConnections:peers.filter(p=>p.ws).length,
          activeRooms:peers.filter(p=>p.ws&&p.listing&&Date.now()-p.listedAt<15000).map(p=>({mode:p.listing.mode,map:p.listing.map,players:p.listing.players,capacity:p.listing.capacity,phase:p.listing.phase})),
          active:[...this.active.values()].sort((a,b)=>b.seen-a.seen).slice(0,100),
          past:this.past.slice(-100).reverse(),historyPersistent:Boolean(this.storePath),at:Date.now()},origin);return;
      }
      json(res,404,{error:'Not found'},origin);
    }catch{json(res,400,{error:'Invalid request'},origin);}
  }
}
