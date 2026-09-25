import {chromium} from 'playwright';
import {createServer} from 'vite';
import {startRealtimeServer} from '../server/realtime/index.js';
import assert from 'node:assert/strict';

const code='89271406539284756012'; // Local test fixture only. Never used for deployment.
const site='http://127.0.0.1:5191';
const vite=await createServer({server:{port:5191,host:'127.0.0.1',strictPort:true,watch:null,proxy:{'/owner':{target:'http://127.0.0.1:5192',configure:proxy=>proxy.on('proxyReq',request=>request.setHeader('Origin',site))}}}});
await vite.listen();process.env.YOLK_OWNER_CODE=code;
const relay=await startRealtimeServer({port:5192,host:'127.0.0.1',origins:[site]});
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--no-proxy-server','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try{for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER CONSOLE',m.text());});
  await page.route('**/network-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.YOLK_NETWORK={relay:'ws://127.0.0.1:5191/game'};"}));
  // Isolate the owner component: this CI browser has no WebGL and cannot mount the whole game.
  await page.route('**/owner-preview',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><main><div class="topbar"><button type="button" class="brand">YOLK<br>YARD</button></div></main><dialog id="dialog"></dialog><script src="/network-config.js"></script><script type="module">import {OwnerConsole} from '/src/owner-console.js';const dialog=document.querySelector('#dialog');window.owner=new OwnerConsole({screen:()=> 'menu',dialog,modal:(title,body,type)=>{dialog.dataset.kind=type;dialog.innerHTML='<div class="dialog-head"><h2>'+title+'</h2></div><div class="dialog-body">'+body+'</div>';if(!dialog.open)dialog.showModal();}});dialog.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='owner-form')void window.owner.unlock(e.target.querySelector('#owner-code').value);});dialog.addEventListener('click',e=>{if(e.target.dataset.action==='owner-refresh')void window.owner.refresh();if(e.target.dataset.action==='owner-logout')window.owner.logout();});</script>`}));
  await page.goto(site+'/owner-preview');try{await page.locator('.topbar button.brand').waitFor({timeout:12000});}catch(e){console.error('OWNER BROWSER DIAGNOSTICS',await page.locator('body').innerText(),errors);throw e;}
  if(width===390)for(let i=0;i<7;i++)await page.locator('.topbar button.brand').tap();
  else for(const letter of 'YOLKARD')await page.keyboard.press(`Key${letter}`);
  await page.locator('#owner-code').waitFor();
  await page.locator('#owner-code').fill(code);await page.locator('#owner-form button').click();
  try{await page.locator('.owner-metrics').waitFor({timeout:12000});}catch(e){console.error('OWNER LOGIN DIAGNOSTICS',await page.locator('body').innerText(),errors);throw e;}
  assert.ok((await page.locator('.owner-metrics').innerText()).includes('ACTIVE VISITORS'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS owner console',width);
}}finally{await browser.close();await relay.close();await vite.close();}
