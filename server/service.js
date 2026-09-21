import { timingSafeEqual } from 'node:crypto';
import { hash, token } from './store-core.js';
const cookie = (req, name) => (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const fail = (message, status=400) => Object.assign(new Error(message), {status});
const text = (value, max=80) => String(value || '').trim().slice(0,max);
export function createService({origin,adminSecret,store,rooms,serve,secure=true,trustProxy=false,limits=new Map(),clientOrigins=[],tickets=new Map()}) {
  const browserCookie = secure ? '__Host-yolk-browser' : 'yolk-browser';
  const adminCookie = secure ? '__Host-yolk-admin' : 'yolk-admin';
  const setCookie = (res,name,value,maxAge) => res.setHeader('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`);
  const allowedOrigin = value => value===origin || clientOrigins.includes(value);
  const crossOrigin = req => req.headers.origin!==origin && clientOrigins.includes(req.headers.origin);
  // Cross-site clients use explicit tokens, never ambient cookies. This works with
  // Safari's third-party cookie protection without weakening same-site cookies.
  const credential = (req,name) => crossOrigin(req)
    ? (/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'')?.[1])
    : cookie(req,name);
  const browser = req=>store.browser(credential(req,browserCookie));
  const socketPlayer = req => {
    if (!allowedOrigin(req.headers.origin)) throw fail('Request origin not allowed.',403);
    if (!crossOrigin(req)) return requirePlayer(req);
    const value=new URL(req.url,origin).searchParams.get('ticket');
    const entry=tickets.get(hash(value||'')); tickets.delete(hash(value||''));
    if (!entry || entry.expires<Date.now() || entry.origin!==req.headers.origin) throw fail('Session ticket expired.',403);
    const b=store.one("SELECT * FROM browsers WHERE id=? AND status='approved'",entry.browser);
    if (!b) throw fail('This browser needs approval.',403);
    return b;
  };
  const requirePlayer = req => {const b=browser(req); if (b?.status!=='approved') throw fail('This browser needs approval.',403); return b;};
  function limit(req, key, max, ms=60000) {
    // Only enable behind a proxy that replaces X-Forwarded-For; never trust it by default.
    const ip=trustProxy ? String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim() : req.socket.remoteAddress;
    key=key+':'+ip; const now=Date.now(); let bucket=limits.get(key);
    if (!bucket || bucket.until<now) {bucket={count:0,until:now+ms}; limits.set(key,bucket);}
    if (++bucket.count>max) throw fail('Too many attempts. Wait a minute and try again.',429);
  }
  const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'}); res.end(JSON.stringify(body));};
  async function body(req) {
    if (!String(req.headers['content-type']).startsWith('application/json')) throw fail('Use JSON.',415);
    let data=''; for await (const chunk of req) {data+=chunk; if (data.length>8192) throw fail('Request too large.',413);}
    try {return JSON.parse(data || '{}');} catch {throw fail('Invalid JSON.');}
  }
  const handler=async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const path=new URL(req.url,origin).pathname;
      if (req.headers.origin && !allowedOrigin(req.headers.origin)) throw fail('Request origin not allowed.',403);
      if (crossOrigin(req)) {
        res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
        res.setHeader('Vary','Origin');
        if (!path.startsWith('/api/')) throw fail('Not found.',404);
      }
      if (req.method==='OPTIONS' && crossOrigin(req)) {
        res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
        res.writeHead(204); return res.end();
      }
      if (req.method==='POST') {
        if (!allowedOrigin(req.headers.origin)) throw fail('Request origin not allowed.',403);
        limit(req,'write',120);
      } else if (req.method!=='GET') throw fail('Method not allowed.',405);
      if (path==='/health') return json(res,{ok:true});
      if (path==='/api/access' && req.method==='GET') {
        const b=browser(req);
        if (b && !crossOrigin(req)) setCookie(res,browserCookie,cookie(req,browserCookie),31536000);
        return json(res,{status:b?.status||'new',requestId:b?.id, name:b?.name, kind:b?.kind});
      }
      if (path==='/api/request' && req.method==='POST') {
        limit(req,'request',10); const data=await body(req), existing=browser(req);
        if (existing && ['pending','approved'].includes(existing.status)) return json(res,{status:existing.status,requestId:existing.id});
        const name=text(data.name,40); if (!name) throw fail('Enter your name.');
        const result=store.request(name,text(data.note,180));
        if (!crossOrigin(req)) setCookie(res,browserCookie,result.secret,31536000);
        return json(res,{status:'pending',requestId:result.id,...(crossOrigin(req)?{browserToken:result.secret}:{})});
      }
      if (path==='/api/redeem' && req.method==='POST') {
        limit(req,'redeem',10); const data=await body(req), b=browser(req);
        if (!b) throw fail('Enter your name and request access first.');
        if (b.status!=='pending') throw fail('Only a pending request can use an activation code.');
        store.redeem(b.id,text(data.code,100)); rooms.enforce();
        return json(res,{status:'approved'});
      }
      if (path==='/api/session-ticket' && req.method==='POST' && crossOrigin(req)) {
        limit(req,'ticket',30); const b=requirePlayer(req), value=token(), now=Date.now();
        for (const [key,entry] of tickets) if (entry.expires<now) tickets.delete(key);
        // One outstanding ticket per browser; tickets expire quickly and work once.
        for (const [key,entry] of tickets) if (entry.browser===b.id) tickets.delete(key);
        tickets.set(hash(value),{browser:b.id,origin:req.headers.origin,expires:now+30000});
        return json(res,{ticket:value});
      }
      if (path==='/api/rooms' && req.method==='GET') {requirePlayer(req); return json(res,{rooms:rooms.list()});}
      if (path==='/api/admin/login' && req.method==='POST') {
        limit(req,'admin-login',5); const data=await body(req);
        if (!timingSafeEqual(Buffer.from(hash(text(data.secret,512))),Buffer.from(hash(adminSecret)))) throw fail('Incorrect owner key.',401);
        const secret=token(); store.run('INSERT INTO admins VALUES(?,?)',hash(secret),Date.now()+8*3600000);
        if (!crossOrigin(req)) setCookie(res,adminCookie,secret,8*3600); return json(res,{ok:true,...(crossOrigin(req)?{adminToken:secret}:{})});
      }
      if (path.startsWith('/api/admin/')) {
        const session=store.one('SELECT expires FROM admins WHERE secret=?',hash(credential(req,adminCookie)||''));
        if (!session || session.expires<Date.now()) throw fail('Owner sign-in required.',401);
        if (path==='/api/admin/dashboard' && req.method==='GET') return json(res,{...store.dashboard(),online:[...rooms.sessions.keys()]});
        if (req.method!=='POST') throw fail('Not found.',404);
        const data=await body(req), id=text(data.id,80), kind=data.kind==='paid'?'paid':'free';
        if (path==='/api/admin/logout') {store.run('DELETE FROM admins WHERE secret=?',hash(credential(req,adminCookie)||''));if (!crossOrigin(req)) setCookie(res,adminCookie,'',0);}
        else if (path==='/api/admin/approve') {
          const person=text(data.person,80)||null;
          if (person && !store.one('SELECT id FROM people WHERE id=?',person)) throw fail('Player not found.');
          store.approve(id,kind,person);
        }
        else if (path==='/api/admin/deny') {store.run("UPDATE browsers SET status='denied' WHERE id=? AND status='pending'",id);store.log('deny',id);}
        else if (path==='/api/admin/revoke') {
          store.transaction(()=>{
            store.run("UPDATE browsers SET status='revoked' WHERE person=?",id);
            store.run('UPDATE codes SET used=? WHERE person=? AND used IS NULL',Date.now(),id);
            store.log('revoke',id);
          });
        }
        else if (path==='/api/admin/kind') {store.run('UPDATE people SET kind=? WHERE id=?',kind,id);store.log('mark-'+kind,id);}
        else if (path==='/api/admin/code') return json(res,store.makeCode(text(data.name,40)||'Invited player',kind,text(data.person,80)||null));
        else if (path==='/api/admin/cancel-code') {store.run('UPDATE codes SET used=? WHERE id=? AND used IS NULL',Date.now(),id);store.log('cancel-code',id);}
        else throw fail('Not found.',404);
        rooms.enforce(); return json(res,{ok:true});
      }
      if (path.startsWith('/api/')) throw fail('Not found.',404);
      if (req.method!=='GET') throw fail('Not found.',404);
      if (['/access.js','/access.css','/admin.js','/client.js'].includes(path)) return await serve(res,path);
      if (path==='/admin' || path==='/admin.html') return await serve(res,'/admin.html');
      if (path==='/access' || path==='/access.html' || ((path==='/' || path==='/index.html') && browser(req)?.status!=='approved')) return await serve(res,'/access.html');
      requirePlayer(req);
      return await serve(res,path==='/'?'/index.html':path);
    } catch(e) {
      if (res.headersSent) return res.end();
      // Expected validation failures are safe; never return filesystem paths or internal SQL errors.
      const known=e.status || /Only a pending|activation code|Player not found/.test(e.message);
      json(res,{error:known?e.message:'The request could not be completed.'},e.status || (known?400:e.code==='ENOENT'?404:500));
    }
  };
  return {handler, requirePlayer, socketPlayer, limit};
}
