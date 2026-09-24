import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const vite=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message);});page.setDefaultTimeout(45000);await mkdir('test-results',{recursive:true});
try{
 await page.addInitScript(()=>localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0})));
 await page.goto(process.env.YOLK_TEST_URL||'http://127.0.0.1:5173/?qa=1');await page.locator('[data-action="royale-home"]').click();await page.locator('[data-action="royale-local"]').click();await page.waitForFunction(()=>window.__yolkTest?.read().state?.royale);
 await page.evaluate(()=>{window.__yolkTest.fixture(s=>{s.botInput=p=>({yaw:p.yaw,slot:p.slot});for(const p of s.players.values())if(p.bot){p.flight='ground';p.x=200;p.y=0;p.z=200;}});window.__yolkTest.pose({x:72,y:0,z:0,yaw:0,pitch:0,flight:'ground',grounded:true,slot:5,materials:{wood:100,brick:100,metal:100}});});
 if(await page.locator('[data-action="resume"]').isVisible())await page.locator('[data-action="resume"]').click();
 await page.keyboard.press('Digit6');await page.waitForFunction(()=>document.querySelectorAll('#royale-hotbar .royale-slot').length===6);await page.keyboard.press('KeyZ');await page.mouse.down();await page.evaluate(()=>window.__yolkTest.pose({yaw:0,pitch:0}));await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds.length>0);await page.mouse.up();await page.evaluate(()=>window.__yolkTest.pose({yaw:0,pitch:0}));await page.waitForFunction(()=>window.__yolkTest.read().state.players.find(p=>p.id==='host').yaw===0);
 assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.builds[0].type),'wall');await page.screenshot({path:'test-results/building-wall.png'});
 await page.keyboard.press('KeyJ');await page.locator('.build-edit').waitFor({state:'visible'});await page.locator('[data-edit-cell="1"]').click();await page.locator('[data-edit-cell="4"]').click();await page.locator('[data-build-control="confirm"]').click();await page.waitForFunction(()=>window.__yolkTest.read().state.royale.builds[0].mask===18);
 await page.keyboard.press('Digit6');await page.keyboard.press('KeyI');assert.equal(await page.locator('.royale-inventory-grid .royale-slot').count(),6);assert.equal(await page.locator('[data-action="royale-drop"]').last().isDisabled(),true);await page.screenshot({path:'test-results/building-inventory.png'});
 assert.deepEqual(errors,[]);console.log('PASS six-slot hotbar, wall placement, doorway edit, permanent pickaxe and no browser errors');
}catch(e){console.log(await page.locator('body').innerText());await page.screenshot({path:'test-results/building-failure.png'});throw e;}finally{await browser.close();await vite.close();}
