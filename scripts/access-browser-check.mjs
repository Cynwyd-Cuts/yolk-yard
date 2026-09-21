import { chromium } from 'playwright';
import { checkCosmetics } from './cosmetics-browser-check.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { createApp } from '../server/index.js';
import { token } from '../server/store.js';
const backend='http://127.0.0.1:3191',pages=process.env.YOLK_TEST_PAGES==='1';
const origin=pages?'http://localhost:3193/yolk-yard/':backend,secret=token();
const app=createApp({origin:backend,adminSecret:secret,database:':memory:',secure:false,clientOrigins:pages?['http://localhost:3193']:[]});
const staticServer=pages?createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if (!path.startsWith('/yolk-yard/')) {res.writeHead(404);return res.end();}
    const file=resolve('dist',path.slice('/yolk-yard/'.length)||'index.html');
    if (!file.startsWith(resolve('dist')+'/')) throw new Error();
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(file)]||'application/octet-stream');
    let content=await readFile(file);
    if (extname(file)==='.html') content=Buffer.from(content.toString().replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:3191 ws://127.0.0.1:3191"));
    res.end(content);
  }catch {res.writeHead(404);res.end();}
}):null;
if(staticServer)await new Promise(r=>staticServer.listen(3193,r));
await new Promise(r=>app.server.listen(3191,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];
const out=pages?'test-results/pages':'test-results/access';await mkdir(out,{recursive:true});
const context=async(viewport={width:1440,height:1000})=>{const c=await browser.newContext({viewport});await c.addInitScript(()=>{if(location.origin!=='null')localStorage.setItem('yolk-settings',JSON.stringify({quality:'low'}));});if(pages)await c.addInitScript(value=>{window.YOLK_API_ORIGIN=value;},backend);c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;};
const wait=async fn=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out waiting for game');};
try {
 const adminContext=await context(),hostContext=await context(),guestContext=await context(),mobileContext=await context({width:390,height:844});
 const admin=await adminContext.newPage(),host=await hostContext.newPage(),guest=await guestContext.newPage(),mobile=await mobileContext.newPage();
 await host.goto(origin);await host.locator('#request:not([hidden])').waitFor();
 await host.screenshot({path:out+'/request-desktop.png'});
 await mobile.goto(origin);await mobile.locator('#request:not([hidden])').waitFor();await mobile.screenshot({path:out+'/request-mobile.png',fullPage:true});
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await host.getByLabel('Your name',{exact:true}).fill('Host egg');await host.getByRole('button',{name:'REQUEST ACCESS',exact:true}).click();
 await host.locator('#pending:not([hidden])').waitFor();
 await admin.goto(pages?origin+'admin.html':origin+'/admin');await admin.getByLabel('Owner key').fill(secret);await admin.getByRole('button',{name:'OPEN DASHBOARD'}).click();
 await admin.getByRole('button',{name:'Approve',exact:true}).click();
 await host.getByRole('button',{name:'PLAY WITH FRIENDS'}).waitFor({timeout:90000});
 console.log('PASS request, owner approval, automatic game entry, responsive access screen');
 await checkCosmetics(host,out);
 await guest.goto(origin);await guest.getByLabel('Your name',{exact:true}).fill('Guest egg');
 await admin.getByLabel('Player name',{exact:true}).fill('Guest egg');await admin.locator('#invite-kind').selectOption('paid');await admin.getByRole('button',{name:'CREATE SINGLE-USE CODE'}).click();
 await wait(async()=>!!await admin.locator('#code-output').textContent());
 const code=await admin.locator('#code-output').textContent();await guest.getByText('Have an activation code?',{exact:true}).click();await guest.getByLabel('Single-use code').fill(code);await guest.getByRole('button',{name:'ACTIVATE THIS BROWSER'}).click();
 await guest.getByRole('button',{name:'PLAY WITH FRIENDS'}).waitFor({timeout:90000});
 await admin.screenshot({path:out+'/owner-dashboard.png',fullPage:true});
 const duplicate=await hostContext.newPage();await duplicate.goto(origin);await duplicate.getByText('Your game is already open in another tab.',{exact:false}).waitFor();await duplicate.close();
 console.log('PASS activation code and duplicate session blocking');
 await host.getByRole('button',{name:'PLAY WITH FRIENDS'}).click();await host.locator('#setup-visibility').selectOption('public');await host.locator('#setup-bots').selectOption('0');await host.getByRole('button',{name:'CREATE ROOM',exact:true}).click();
 await host.getByRole('button',{name:'START MATCH'}).waitFor();
 await guest.getByRole('button',{name:'BROWSE PUBLIC MATCHES'}).click();await guest.locator('[data-join-room]').waitFor();
 await guest.screenshot({path:out+'/public-matches.png'});
 await host.getByRole('button',{name:'START MATCH'}).click();
 await host.getByRole('button',{name:'Enter the Yard',exact:true}).waitFor();
 await guest.locator('[data-join-room]').click();await guest.getByRole('button',{name:'Enter the Yard',exact:true}).waitFor();
 console.log('PASS public listing, creating room, starting and joining an in-progress match');
 // Avoid pointer capture in headless verification; keyboard/mouse inputs still follow the game handlers.
 for(const page of [host,guest])await page.evaluate(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
 await host.getByRole('button',{name:'Enter the Yard',exact:true}).click();await guest.getByRole('button',{name:'Enter the Yard',exact:true}).click();
 const room=[...app.rooms.rooms.values()][0];
 await wait(()=>room.members.size===2);
 const styled=room.sim.snapshot().players.find(p=>p.id===room.host);
 assert.equal(styled.hat,7);assert.equal(styled.pattern,6);assert.equal(styled.eyewear,1);assert.equal(styled.accent,'#ff637e');
 const guestId=[...room.members.keys()].find(id=>id!==room.host),p=room.sim.players.get(guestId);
 const pos={x:p.x,z:p.z};
 await guest.keyboard.down('KeyW');await wait(()=>Math.hypot(p.x-pos.x,p.z-pos.z)>.3);await guest.keyboard.up('KeyW');
 const ammo=p.ammo[0];await guest.mouse.move(700,450);await guest.mouse.down();await wait(()=>p.ammo[0]<ammo);await guest.mouse.up();
 await host.getByRole('button',{name:'Pause menu'}).click();
 await host.getByRole('button',{name:'Room: public · Make private',exact:true}).click();await wait(()=>room.visibility==='private');
 await host.getByRole('button',{name:'Room: private · Make public',exact:true}).waitFor();
 assert.equal((await guest.evaluate(()=>window.YolkClient.api('/api/rooms'))).rooms.length,0);
 await host.screenshot({path:out+'/in-match-privacy.png'});
 await host.getByRole('button',{name:'Room: private · Make public',exact:true}).click();await wait(()=>room.visibility==='public');
 console.log('PASS replicated movement, firing, and in-match privacy changes');
 room.sim.finish();await host.getByRole('button',{name:'PLAY AGAIN',exact:true}).waitFor();await host.getByRole('button',{name:'PLAY AGAIN',exact:true}).click();await wait(()=>room.sim.phase==='playing');
 console.log('PASS host rematch');
 await admin.getByRole('button',{name:'Refresh dashboard'}).click();
 admin.on('dialog',d=>d.accept());
 const guestRow=admin.locator('#people .row').filter({hasText:'Guest egg'});await guestRow.getByRole('button',{name:'Revoke access'}).click();
 await guest.waitForURL('**/access.html');await guest.getByText('Access for this browser has ended.',{exact:false}).waitFor();
 await wait(()=>room.members.size===1);
 console.log('PASS revocation disconnects a playing guest and blocks re-entry');
 assert.deepEqual(errors,[]);
 console.log('PASS no browser JavaScript errors');
} catch(error) {
 console.error('Browser errors:',errors);
 let i=0;
 for(const c of browser.contexts())for(const page of c.pages()) {
   console.error('Failure page',++i,page.url(),await page.locator('body').innerText().catch(()=>''));
   await page.screenshot({path:out+'/failure-'+i+'.png',timeout:5000}).catch(()=>{});
 }
 throw error;
} finally {await browser.close();await app.close();if(staticServer)await new Promise(r=>staticServer.close(r));}
