import {chromium} from 'playwright';
import {createServer} from 'vite';
import {PeerServer} from 'peer';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const vite=await createServer({server:{port:5173,host:'127.0.0.1',strictPort:true}});await vite.listen();
let signal;
PeerServer({port:9000,path:'/peer',host:'127.0.0.1',allow_discovery:false},server=>signal=server);
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--allow-loopback-in-peer-connection','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];await mkdir('test-results/chat',{recursive:true});
async function make(name,mobile=false){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1100,height:780},isMobile:mobile,hasTouch:mobile});
  await ctx.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));},name);
  await ctx.route('**/network-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={peer:{host:'127.0.0.1',port:9000,path:'/peer',secure:false},iceServers:[]};"}));
  const page=await ctx.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser exception:',e.message);});
  await page.goto('http://127.0.0.1:5173/?qa=1');await page.locator('[data-action="setup"]').waitFor();return page;
}
const rows=page=>page.evaluate(()=>window.__yolkTest.chatRead().rows);
async function open(page){if(!await page.locator('#chat-panel').isVisible())await page.locator('#chat-toggle').click();}
async function close(page){if(await page.locator('#chat-panel').isVisible())await page.getByRole('button',{name:'Close chat',exact:true}).click();}
async function send(page,text){await open(page);await page.waitForTimeout(1250);await page.locator('#chat-input').fill(text);await page.locator('.chat-send').click();}
async function has(page,text){await page.waitForFunction(text=>window.__yolkTest.chatRead().rows.some(r=>r.text===text),text);}
try{
  const host=await make('Host egg');console.log('CHECK host menu ready');
  await host.locator('#player-name').fill('user@example.com');await host.locator('#player-name').press('Tab');
  assert.equal(await host.locator('#player-name').inputValue(),'Egg');
  assert.match(await host.locator('#name-safety').innerText(),/filtered/);
  await host.locator('#player-name').fill('Host egg');await host.locator('#player-name').press('Tab');
  await host.locator('[data-action="setup"]').click();await host.locator('#setup-mode').selectOption('teams');await host.locator('[data-action="create-room"]').click();
  await host.locator('.room-code').waitFor();console.log('CHECK host room ready');const code=(await host.locator('.room-code').innerText()).replace('-','').trim();
  const guest=await make('Guest egg');console.log('CHECK guest menu ready');
  await guest.locator('[data-action="join"]').click();await guest.locator('#join-code').fill(code);await guest.locator('[data-action="join-room"]').click();
  await guest.locator('.room-code').waitFor();await host.waitForFunction(()=>window.__yolkTest.read().state.players.length===2);
  await send(guest,'Hello, eggs!');await has(host,'Hello, eggs!');await has(guest,'Hello, eggs!');
  await send(host,'Ready for the round');await has(guest,'Ready for the round');
  console.log('PASS name feedback and bidirectional WebRTC chat');
  await send(guest,'user@example.com');assert.match(await guest.locator('.chat-status').innerText(),/private/);
  assert.equal((await rows(host)).some(r=>r.text.includes('@')),false);
  const before=(await rows(host)).length;
  await guest.evaluate(()=>window.__yolkTest.chatPacket({type:'chat-send',version:1,channel:'room',text:'user@example.com',sender:'host',name:'Host egg'}));
  await guest.waitForTimeout(500);assert.equal((await rows(host)).length,before);
  await host.evaluate(()=>window.__yolkTest.chatInject({version:1,id:999,sender:'host',name:'Fake',channel:'room',text:'user@example.com'}));
  await guest.waitForTimeout(500);assert.equal((await rows(guest)).some(r=>r.text.includes('@')),false);
  // Rejoining must start a fresh chat history and restore normal delivery.
  await close(guest);await guest.locator('[data-action="leave"]').click();
  await host.waitForFunction(()=>window.__yolkTest.read().state.players.length===1);
  await guest.locator('[data-action="join"]').click();await guest.locator('#join-code').fill(code);await guest.locator('[data-action="join-room"]').click();await guest.locator('.room-code').waitFor();
  await host.waitForFunction(()=>window.__yolkTest.read().state.players.length===2);
  console.log('PASS sender, host and recipient privacy filters');
  await open(guest);await guest.locator('#chat-channel').selectOption('team');
  const hostBefore=(await rows(host)).length;await send(guest,'Defend our side');await has(guest,'Defend our side');
  await host.waitForTimeout(700);assert.equal((await rows(host)).length,hostBefore);
  await guest.locator('#chat-channel').selectOption('room');await send(guest,'Nice round');await has(host,'Nice round');
  console.log('PASS team messages never reach the opposing host');
  await open(host);await host.locator('.chat-safety summary').click();
  await host.locator('[data-mute]').first().click();const mutedCount=(await rows(host)).length;
  await send(guest,'Wait at the tower');await host.waitForTimeout(500);assert.equal((await rows(host)).length,mutedCount);
  await host.locator('[data-mute]').first().click();
  await host.locator('[data-silence]').first().click();await guest.waitForFunction(()=>document.querySelector('#chat-input').disabled);
  await host.locator('[data-silence]').first().click();await guest.waitForFunction(()=>!document.querySelector('#chat-input').disabled);
  await host.locator('[data-room-chat]').click();await guest.waitForFunction(()=>document.querySelector('#chat-input').disabled);
  await host.locator('[data-room-chat]').click();await guest.waitForFunction(()=>!document.querySelector('#chat-input').disabled);
  await host.locator('#chat-preference').selectOption('quick');
  await send(guest,'Move toward the bridge');await host.waitForTimeout(400);assert.equal((await rows(host)).length,0);
  await guest.locator('.chat-quick summary').click();await guest.waitForTimeout(1600);await guest.locator('[data-quick="gg"]').click();await has(host,'Good game!');
  await host.locator('#chat-preference').selectOption('all');
  await host.screenshot({path:'test-results/chat/desktop-safety.png'});
  await host.locator('.chat-safety summary').click();
  console.log('PASS mute, host silences, chat pause and quick-only preferences');
  await close(host);await close(guest);await host.locator('[data-action="start-match"]').click();
  await guest.locator('#spawn-button').waitFor();await guest.locator('#spawn-button').click();
  await guest.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId).health>0;});
  await guest.keyboard.press('Enter');await guest.locator('#chat-input').waitFor();
  const initial=await guest.evaluate(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId);});
  await guest.locator('#chat-input').pressSequentially('wasd r e g q 1 2');await guest.waitForTimeout(1000);
  const after=await guest.evaluate(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId);});
  assert.ok(Math.hypot(initial.x-after.x,initial.z-after.z)<.1);assert.deepEqual(after.ammo,initial.ammo);assert.equal(after.slot,initial.slot);
  await guest.locator('#chat-input').fill('Regroup at the tower');await guest.locator('.chat-send').click();await has(host,'Regroup at the tower');
  await guest.screenshot({path:'test-results/chat/in-game.png'});await close(guest);
  await guest.waitForFunction(()=>!window.__yolkTest.chatRead().open);
  await guest.waitForFunction(()=>document.activeElement?.id==='world');
  await guest.waitForFunction(()=>document.pointerLockElement?.id==='world'||document.querySelector('#dialog').open);
  if(!await guest.locator('#dialog').isVisible())await guest.keyboard.press('Escape');
  await guest.locator('[data-action="spectate"]').click();
  await guest.waitForFunction(()=>{const q=window.__yolkTest.read();return q.state.players.find(p=>p.id===q.localId).spectating;});
  const preSpectate=(await rows(host)).length;await send(guest,'Watching the round');await has(guest,'Watching the round');
  await host.waitForTimeout(500);assert.equal((await rows(host)).length,preSpectate);
  console.log('PASS typing isolates gameplay input, closing returns control, and spectator chat stays private');
  const mobile=await make('Mobile egg',true);
  await mobile.locator('[data-action="join"]').click();await mobile.locator('#join-code').fill(code);await mobile.locator('[data-action="join-room"]').click();await mobile.locator('#spawn-button').waitFor();
  await open(mobile);await mobile.locator('.chat-quick summary').click();await mobile.locator('[data-quick="hello"]').click();await has(host,'Hello, eggs!');
  await mobile.screenshot({path:'test-results/chat/mobile.png'});
  const bounds=await mobile.locator('#chat-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391&&bounds.y>=0&&bounds.y+bounds.height<=845);
  await mobile.locator('.chat-safety summary').click();await mobile.locator('[data-report]').first().click();await mobile.getByRole('button',{name:'Mute & notify host'}).click();
  await host.waitForFunction(()=>document.querySelector('#toast').textContent.includes('reported'));
  assert.equal(await mobile.getByRole('button',{name:'Reported',exact:true}).count(),1);
  await close(mobile);await mobile.locator('[data-action="pause"]').click();await mobile.locator('[data-action="leave-confirm"]').click();
  await mobile.locator('[data-action="setup"]').waitFor();assert.equal((await rows(mobile)).length,0);
  console.log('PASS phone layout, quick messages, host reports, and leaving clears history');
  assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
}catch(error){
  for(const [i,ctx] of browser.contexts().entries())for(const page of ctx.pages())await page.screenshot({path:`test-results/chat/failure-${i}.png`}).catch(()=>{});
  console.error('Browser errors:',errors);
  for(const ctx of browser.contexts())for(const page of ctx.pages())console.log('End state:',(await page.locator('body').innerText().catch(()=>'' )).slice(-1600));
  console.error(error);process.exitCode=1;
}finally{await browser.close();await vite.close();signal?.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
