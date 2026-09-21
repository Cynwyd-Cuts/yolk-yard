import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5176,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true, ...(process.env.YOLK_TEST_CHROME ? {executablePath:process.env.YOLK_TEST_CHROME}:{}), args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.setDefaultTimeout(30000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{if(!localStorage.getItem('yolk-settings')) localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0}));});
await mkdir('test-results/update',{recursive:true});
try {
  await page.goto('http://127.0.0.1:5176/?qa=1');
  await page.getByRole('button',{name:/QUALITY UPDATE ·/}).click();
  await page.getByRole('heading',{name:'Update history',exact:true}).waitFor();
  assert.equal(await page.locator('.release-note').count(),10);
  await page.screenshot({path:'test-results/update/history.png'});
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  assert.equal(await page.locator('#drag-look').count(),0);
  assert.equal(await page.locator('#centerDot').isChecked(),true);
  assert.equal(await page.locator('#hitMarkers').isChecked(),true);
  await page.locator('#centerDot').uncheck();
  await page.locator('#hitMarkers').uncheck();
  await page.locator('#scopeSensitivity').evaluate(el=>{el.value='0.35';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).scopeSensitivity),0.35);
  await page.getByRole('button',{name:'PRACTICE WITH BOTS',exact:true}).click();
  await page.locator('#setup-bots').selectOption('0');
  await page.getByRole('button',{name:'START PRACTICE',exact:true}).click();
  await page.waitForFunction(()=>window.__yolkTest.read().state.time>1);
  assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.players[0].health),0);
  await page.screenshot({path:'test-results/update/entry.png'});
  await page.getByRole('button',{name:'Enter the Yard',exact:true}).click();
  await page.waitForFunction(()=>window.__yolkTest.read().state.players[0].health===100);
  console.log('PASS update menu, settings and entry');
  assert.equal(await page.locator('#center-dot').isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).hitMarkers),false);
  // Shift aiming must use the same saved multiplier as right mouse / touch aim.
  const turn=async aim=>{
    if(aim) await page.keyboard.down('ShiftLeft');
    const delta=await page.evaluate(()=>{
      document.querySelector('#world').dispatchEvent(new MouseEvent('mousedown',{button:2}));
      const before=window.__yolkTest.read().input.yaw;
      document.dispatchEvent(new MouseEvent('mousemove',{movementX:100,movementY:0}));
      const after=window.__yolkTest.read().input.yaw;
      document.dispatchEvent(new MouseEvent('mouseup',{button:2}));
      return Math.abs(after-before);
    });
    if(aim) await page.keyboard.up('ShiftLeft');
    return delta;
  };
  assert.ok(Math.abs(await turn(true)-0.07)<0.001);
  await page.evaluate(()=>window.__yolkTest.fixture(s=>{
    const p=s.players.get('host');p.health=0;p.respawnAt=s.time-1;p.spawnRequested=false;
  }));
  const time=await page.evaluate(()=>window.__yolkTest.read().state.time);
  await page.waitForFunction(t=>window.__yolkTest.read().state.time>t+1,time);
  assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.players[0].health),0);
  await page.waitForFunction(()=>!document.pointerLockElement);
  await page.getByRole('button',{name:'Respawn',exact:true}).click();
  await page.waitForFunction(()=>window.__yolkTest.read().state.players[0].health===100);
  console.log('PASS mouse-lock respawn');
  await page.route('**/version.json?*',async route=>{
    if(!page.url().includes('build=simulated-next-release')) await route.fulfill({json:{build:'simulated-next-release'}});
    else await route.continue();
  });
  const oldUrl=page.url();
  await page.evaluate(()=>window.__yolkTest.checkUpdate());
  assert.equal(page.url(),oldUrl,'an active match must not reload');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Leave match',exact:true}).click();
  await page.waitForURL('**build=simulated-next-release**');
  await page.getByRole('button',{name:'PRACTICE WITH BOTS',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-settings')).scopeSensitivity),0.35);
  // A second update while in the menu refreshes without starting a match.
  await page.unroute('**/version.json?*');
  await page.route('**/version.json?*',async route=>{
    if(!page.url().includes('build=menu-update')){await route.fulfill({json:{build:'menu-update'}});}else await route.continue();
  });
  await page.evaluate(()=>{void window.__yolkTest.checkUpdate();});
  await page.waitForURL('**build=menu-update**');
  assert.deepEqual(errors,[]);
  console.log('PASS update history, scope setting, manual entry/respawn, and deferred/menu refresh');
} catch(e) {
  console.error('UPDATE CHECK ERRORS',errors);
  await page.screenshot({path:'test-results/update/failure.png'});
  throw e;
} finally {await browser.close();await server.close();}
