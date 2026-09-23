import {chromium} from 'playwright';
import {createServer} from 'vite';
import {PeerServer} from 'peer';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const vite=await createServer({server:{port:5182,host:'127.0.0.1',strictPort:true,watch:null}});await vite.listen();
let signaling;PeerServer({port:9002,path:'/peer',host:'127.0.0.1'},server=>signaling=server);
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--allow-loopback-in-peer-connection','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const pages=[],errors=[],checks=[];await mkdir('test-results',{recursive:true});
const pass=s=>{checks.push(s);console.log('PASS',s);};
async function make(name,mobile=false){
 // Several simultaneous software-rendered islands otherwise starve WebRTC on
 // the two-core CI runner. Keep the desktop CSS layout; solo/art checks render
 // at full resolution, while this suite verifies real host/guest networking.
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},deviceScaleFactor:.5,isMobile:mobile,hasTouch:mobile});
 await ctx.addInitScript(name=>{if(location.origin==='null')return;localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:.15}));},name);
 await ctx.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={peer:{host:'127.0.0.1',port:9002,path:'/peer',secure:false},iceServers:[]};"}));
 const page=await ctx.newPage();pages.push(page);page.setDefaultTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message);});
 await page.goto('http://127.0.0.1:5182/?qa=1',{waitUntil:'domcontentloaded'});await page.locator('[data-action="royale-home"]').waitFor();return page;
}
try{
 const host=await make('Captain Sunny');
 await host.locator('[data-action="royale-home"]').click();await host.locator('[data-action="royale-custom"]').click();
 assert.equal(await host.locator('#setup-map').inputValue(),'sunnybreak');assert.equal(await host.locator('#setup-minutes').isVisible(),false);
 await host.locator('#setup-visibility').selectOption('public');await host.locator('#setup-capacity').selectOption('4');await host.locator('#setup-bots').selectOption('2');await host.locator('[data-action="create-room"]').click();await host.locator('.room-code').waitFor();
 const code=(await host.locator('.room-code').innerText()).replace('-','').trim();
 const guest=await make('Captain Sunny');await guest.locator('[data-action="royale-home"]').click();await guest.locator('[data-action="royale-queue"]').click();await guest.locator('#room-name').waitFor();await guest.locator('[data-action="save-room-name"]').click();await guest.locator('#room-name').waitFor();await guest.locator('#room-name').fill('Scout Egg');await guest.locator('[data-action="save-room-name"]').click();await guest.locator('.room-code').waitFor();assert.equal((await guest.locator('.room-code').innerText()).replace('-','').trim(),code);pass('Public matchmaking joins the waiting Royale lobby');
 await host.screenshot({path:'test-results/royale-lobby.png'});
 // Rendering may delay snapshots while WebRTC can still answer heartbeats.
 // This previously triggered an unwanted second host after 6.5 seconds.
 await host.evaluate(async()=>{const {Network}=await import('/src/network.js');const broadcast=Network.prototype.broadcast;Network.prototype.broadcast=function(){};setTimeout(()=>{Network.prototype.broadcast=broadcast;},9000);});
 await guest.waitForTimeout(10000);
 assert.equal(await guest.evaluate(()=>{const q=window.__yolkTest.read();return q.host||q.migrating;}),false);pass('Delayed snapshots with heartbeat replies do not transfer a healthy host');
 await host.locator('[data-action="start-match"]').click();await guest.locator('#royale-hud').waitFor();
 await guest.waitForFunction(()=>window.__yolkTest.read().state.players.length===4);assert.ok(await guest.evaluate(()=>window.__yolkTest.read().state.royale.loot.length>200));assert.equal(await guest.locator('#spawn-button').isVisible(),false);
 await host.screenshot({path:'test-results/royale-flight.png'});pass('Four contestants share the empty starting inventory and Eggspress flight');
 await guest.keyboard.press('KeyM');await guest.locator('#royale-fullmap').click({position:{x:160,y:220}});await guest.screenshot({path:'test-results/royale-map.png'});await guest.locator('[data-action="resume"]').click();
 await guest.locator('#royale-compass').filter({hasText:'m'}).waitFor();pass('Island map sets a visible distance waypoint');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{s.time=s.startedAt+4;for(const p of s.players.values())if(p.bot)p.botDrop=30;}));
 await guest.keyboard.press('Space');await guest.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId).flight==='dive';});
 await guest.keyboard.press('Space');await guest.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId).flight==='glide';});await guest.screenshot({path:'test-results/royale-glider.png'});pass('Guest exit and manual glider deployment are host-authoritative');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{
   s.loot=[];s.lootVersion++;s.chests=[{id:'qa-chest',x:70,y:0,z:-1.8,opened:false}];
   s.botInput=p=>({yaw:p.yaw,pitch:0,slot:p.slot});
   for(const [i,p]of [...s.players.values()].entries()){Object.assign(p,{x:70+i*7,y:0,z:0,flight:'ground',grounded:true,health:100,shield:0,yaw:0,pitch:0});}
 }));
 await host.keyboard.press('Escape');if(await host.locator('[data-action="resume"]').isVisible())await host.locator('[data-action="resume"]').click();
 await host.keyboard.down('KeyF');await host.waitForFunction(()=>window.__yolkTest.read().state.royale.chests[0].opened);await host.keyboard.up('KeyF');
 await guest.waitForFunction(()=>window.__yolkTest.read().state.royale.chests[0].opened);pass('Chest opening and generated loot replicate to the guest');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{const p=[...s.players.values()].find(p=>!p.bot&&p.id!=='host');s.takeLoot(p,s.dropLoot(p,{id:'mini',count:2,rarity:1}));s.takeLoot(p,s.dropWeapon(p,'pip'));}));
 await guest.keyboard.press('KeyI');await guest.locator('.royale-inventory-grid [data-royale-slot="0"]').dragTo(guest.locator('.royale-inventory-grid [data-royale-slot="1"]'));await host.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>!p.bot&&p.id!=='host').inventory[0]?.id==='pip');await guest.locator('[data-action="resume"]').click();pass('Guest inventory commands arrive intact between movement packets');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{
  const p=s.players.get('host');s.loot=[];s.lootVersion++;s.chests=[];
  for(const item of [{id:'comet',weapon:true,rarity:3,ammo:24,count:1},{id:'mini',rarity:1,count:2},{id:'medkit',rarity:1,count:1},{id:'impulse',rarity:3,count:2},{id:'launchpad',rarity:2,count:1}])s.takeLoot(p,s.dropLoot(p,item));
  p.bank.medium=70;p.slot=0;s.syncInventory(p);
 }));
 await host.locator('#royale-hotbar .royale-slot').filter({hasText:'Comet'}).waitFor();await host.screenshot({path:'test-results/royale-ground.png'});
 await host.keyboard.press('KeyI');await host.locator('.royale-inventory-grid [data-royale-slot="0"]').dragTo(host.locator('.royale-inventory-grid [data-royale-slot="4"]'));await host.locator('[data-action="resume"]').click();
 await host.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').inventory[0]?.id==='launchpad');
 await host.keyboard.press('Digit2');
 await host.mouse.click(630,400);await host.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').shield===25);pass('Five-slot inventory swaps and a timed shield item complete in the live game');
 await host.keyboard.press('Digit5');await host.waitForFunction(()=>{const s=window.__yolkTest.read().state,p=s.players.find(p=>p.id==='host');return p.slot===4&&s.time>p.equipUntil;});await host.mouse.down();await host.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').inventory[4].ammo<24);await host.mouse.up();await host.keyboard.press('KeyR');
 await host.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').reloadEnd>0);pass('Selected inventory weapon fires and reloads using reserve ammunition');
 const late=await make('Late Watcher');await late.locator('[data-action="join"]').click();await late.locator('#join-code').fill(code);await late.locator('[data-action="join-room"]').click();await late.waitForFunction(()=>{const q=window.__yolkTest.read(),p=q.state?.players.find(p=>p.id===q.localId);return p&&p.health>0&&!p.bot&&!p.spectating;});assert.equal(await late.locator('#spawn-button').isVisible(),false);pass('A late invite replaces a living bot without adding a contestant or a second life');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{const p=s.players.get('host'),guest=[...s.players.values()].find(p=>p.id!=='host'&&!p.bot&&!p.spectating);s.damage(p,guest,1000,'Peeper');}));
 await host.locator('#spectate-panel').waitFor();await host.locator('[data-action="spectate-next"]').click();await host.screenshot({path:'test-results/royale-spectator.png'});pass('Elimination follows a living opponent and supports target switching');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{s.time=s.startedAt+150;}));await guest.locator('#royale-storm-warning').filter({hasText:'STORM'}).waitFor();await guest.screenshot({path:'test-results/royale-storm.png'});pass('Storm phase, map circles and warning render on the guest');
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{const living=[...s.players.values()].filter(p=>p.health>0);for(const p of living.slice(1))s.damage(p,living[0],1000,'Comet');s.tick(1/60);}));await host.locator('#round-banner').waitFor();assert.equal(await host.locator('.results').isVisible(),false);await host.locator('[data-action="rematch"]').waitFor();await guest.locator('.results').waitFor();await host.screenshot({path:'test-results/royale-results.png'});
 await host.locator('[data-action="rematch"]').click();await host.locator('[data-action="apply-rematch"]').click();await late.waitForFunction(()=>{const q=window.__yolkTest.read();const p=q.state.players.find(p=>p.id===q.localId);return q.state.round===2&&p.health===100&&p.inventory.every(i=>i===null);});pass('Results and rematch reset storm, placement, inventory and spectator participation');
 await host.keyboard.press('Escape');await host.locator('[data-action="leave-confirm"]').click();await guest.waitForFunction(()=>window.__yolkTest.read().host);await late.waitForFunction(()=>!window.__yolkTest.read().migrating&&window.__yolkTest.read().state?.round===2);pass('Host departure transfers the match to the oldest remaining player');
 // The departed host is no longer part of this scenario. Release its software
 // renderer before bringing up the new independent client on the CI runner.
 await host.context().close();
 const newcomer=await make('New Egg');await newcomer.locator('[data-action="join"]').click();await newcomer.locator('#join-code').fill(code);await newcomer.locator('[data-action="join-room"]').click();await newcomer.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state?.round===2&&q.state.players.some(p=>p.id===q.localId);});pass('Original invite code still admits players after host transfer');
 await guest.close();await late.waitForFunction(()=>window.__yolkTest.read().host);await newcomer.waitForFunction(()=>!window.__yolkTest.read().migrating&&window.__yolkTest.read().state?.round===2);pass('Closing the replacement host transfers authority again in join order');
 await late.close();await newcomer.close();
 const mobile=await make('Pocket Egg',true);await mobile.locator('[data-action="royale-home"]').click();await mobile.locator('[data-action="royale-local"]').click();await mobile.locator('#royale-hud').waitFor();await mobile.screenshot({path:'test-results/royale-mobile.png'});
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);assert.equal(await mobile.locator('[data-touch="sprint"]').isVisible(),true);assert.equal(await mobile.locator('[data-touch="interact"]').isVisible(),true);pass('Mobile Royale HUD and touch sprint/search controls fit the viewport');
 assert.deepEqual(errors,[]);pass('No uncaught browser or audio exceptions');
 await writeFile('test-results/royale-report.json',JSON.stringify({checks,errors},null,2));
}catch(error){
 for(const [i,p]of pages.entries()){try{console.log('DIAGNOSTICS',i,await p.evaluate(()=>{const q=window.__yolkTest.read();return {screen:q.screen,paused:q.paused,localId:q.localId,phase:q.state?.phase,players:q.state?.players.map(p=>({id:p.id,health:p.health,flight:p.flight})),dialog:document.querySelector('#dialog')?.innerText,network:window.__yolkTest.network()};}));await p.screenshot({path:`test-results/royale-failure-${i}.png`});}catch{}}
 console.error('BROWSER ERRORS',errors);throw error;
}finally{await browser.close();await vite.close();await new Promise(resolve=>signaling?.close(resolve)||resolve());}
// PeerServer retains housekeeping timers after its HTTP server closes. Reach
// this only after all assertions and cleanup succeed; thrown failures still exit 1.
process.exit(0);
