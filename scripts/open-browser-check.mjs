import {chromium} from 'playwright';
import {createServer} from 'vite';
import {PeerServer} from 'peer';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const vite=await createServer({server:{port:5173,host:'127.0.0.1',strictPort:true}});await vite.listen();
let signalServer;
PeerServer({port:9000,path:'/peer',host:'127.0.0.1',allow_discovery:false},server=>signalServer=server);
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--allow-loopback-in-peer-connection','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[],requests=[];
await mkdir('test-results',{recursive:true});
async function make(name,mobile=false){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:960,height:640},isMobile:mobile,hasTouch:mobile});
 await ctx.addInitScript(name=>{if(location.origin==='null')return;localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);
 await ctx.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={peer:{host:'127.0.0.1',port:9000,path:'/peer',secure:false},iceServers:[]};"}));
 const page=await ctx.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 page.on('console',m=>{if(m.type()==='error'||m.text().includes('Directory'))console.log('BROWSER',m.text().slice(0,240));});
 await page.goto('http://127.0.0.1:5173/?qa=1');
 await page.locator('[data-action="practice"]').first().waitFor();
 return page;
}
async function listing(page,code,visible){
 await page.locator('[data-action="public-rooms"]').click();
 await page.locator('[data-action="refresh-rooms"]').waitFor();
 assert.equal(await page.locator(`[data-join-room="${code}"]`).count(),visible?1:0);
}
async function closeModal(page){await page.locator('#dialog [data-action="close"]').first().click();}
try{
 const host=await make('Host egg');
 assert.equal(requests.some(u=>/workers\.dev|\/api\/(access|request)|\/session/.test(u)),false);
 assert.equal(await host.locator('a[href*="admin"]').count(),0);
 console.log('PASS direct startup without access service or external connection');
 await host.locator('[data-action="practice"]').click();
 await host.locator('#setup-bots').selectOption('1');await host.locator('[data-action="start-practice"]').click();
 await host.locator('#spawn-button').click();
 await host.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId)?.health>0;});
 await host.keyboard.press('Escape');await host.locator('[data-action="leave-confirm"]').click();
 console.log('PASS local practice and manual entry without login');
 await host.locator('[data-action="setup"]').click();assert.equal(await host.locator('#setup-bots').inputValue(),'0');
 await host.locator('#setup-visibility').selectOption('public');await host.locator('[data-action="create-room"]').click();
 await host.locator('.room-code').waitFor();
 const code=(await host.locator('.room-code').innerText()).replace('-','').trim();
 await host.waitForTimeout(2500);
 const guest=await make('Guest egg');
 await listing(guest,code,true);
 console.log('PASS public room discovered across independent browsers');
 await closeModal(guest);
 await host.locator('[data-action="toggle-visibility"]').click();
 await listing(guest,code,false);await closeModal(guest);
 await host.locator('[data-action="toggle-visibility"]').click();
 await listing(guest,code,true);
 await guest.locator(`[data-join-room="${code}"]`).click();await guest.locator('.room-code').waitFor();
 await host.waitForFunction(()=>window.__yolkTest.read().state.players.length===2);
 console.log('PASS privacy removes listings and public-list Join connects through WebRTC');
 await host.locator('[data-action="start-match"]').click();
 await guest.locator('#spawn-button').waitFor();await guest.locator('#spawn-button').click();
 await guest.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId)?.health>0;});
 const before=await guest.evaluate(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId);});
 await guest.keyboard.down('KeyW');
 await host.waitForFunction(({id,x,z})=>{const p=window.__yolkTest.read().state.players.find(p=>p.id===id);return Math.hypot(p.x-x,p.z-z)>.5;},before);
 await guest.keyboard.up('KeyW');
 await host.keyboard.press('Escape');await host.locator('[data-action="toggle-visibility"]').click();
 
 console.log('PASS multiplayer input replication and in-match visibility switch');
 await guest.screenshot({path:'test-results/open-multiplayer.png'});
 await host.close();
 await guest.locator('[data-action="close"]').first().click();
 // A remaining browser must take over discovery after its coordinator closes.
 await guest.locator('[data-action="setup"]').click();await guest.locator('#setup-visibility').selectOption('public');await guest.locator('[data-action="create-room"]').click();
 await guest.locator('.room-code').waitFor();
 const nextCode=(await guest.locator('.room-code').innerText()).replace('-','').trim();
 await guest.waitForTimeout(7000);
 const mobile=await make('Mobile egg',true);
 await listing(mobile,nextCode,true);
 await mobile.screenshot({path:'test-results/open-public-mobile.png'});
 await guest.locator('[data-action="leave"]').click();await closeModal(mobile);await listing(mobile,nextCode,false);
 console.log('PASS directory coordinator recovery, mobile list, and room removal');
 assert.deepEqual(errors,[]);
 assert.equal(requests.some(u=>/workers\.dev|\/api\/access/.test(u)),false);
 console.log('PASS no browser exceptions or removed backend requests');
}catch(e){for(const ctx of browser.contexts())for(const p of ctx.pages()){console.log('DIRECTORY',await p.evaluate(async()=>{const {directory:d}=await import('/src/directory.js');return {leader:d.leader,room:d.room,peer:d.peer?.id,open:d.peer?.open,clients:d.clients.size,connection:d.connection?.open,states:Object.values(d.peer?.connections||{}).flat().map(c=>({peer:c.peer,open:c.open,ice:c.peerConnection?.iceConnectionState}))}}).catch(()=>null));console.log('PAGE',p.url(),(await p.locator('body').innerText().catch(()=>'' )).slice(-1400));}throw e;}
finally{await browser.close();await vite.close();signalServer?.close();}
