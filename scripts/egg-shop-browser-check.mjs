import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5192,strictPort:true,watch:null}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
try{
 await page.goto('http://127.0.0.1:5192/?qa=1');
 await page.getByRole('button',{name:'Egg Shop',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Egg studio',exact:true}).count(),0);
 assert.match(await page.locator('.egg-balance').innerText(),/300/);
 await page.locator('[data-shop-category="wrap"]').click();
 await page.locator('#shop-sort').selectOption('price');
 await page.locator('[data-shop-item="wrap-cloud"]').click();
 await page.locator('[data-shop-confirm]').click();
 assert.match(await page.locator('.shop-confirm').innerText(),/Balance after purchase: 100/);
 await page.locator('[data-shop-buy]').click();
 await page.getByRole('button',{name:'EQUIP ITEM',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-profile')).wrap),'wrap-cloud');
 assert.match(await page.locator('.egg-balance').innerText(),/100/);
 await page.locator('[data-shop-tab="locker"]').click();
 await page.locator('[data-shop-save="0"]').click();await page.locator('[data-shop-clear="wrap"]').click();await page.locator('[data-shop-load="0"]').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-profile')).wrap),'wrap-cloud');
 await page.locator('[data-shop-tab="shop"]').click();
 await mkdir('test-results/egg-shop',{recursive:true});await page.screenshot({path:'test-results/egg-shop/desktop.png'});
 // Every category uses a real rendered model, never a broken or placeholder image.
 for(const category of ['outfit','pickaxe','wrap','backbling','glider','trail']){
  await page.locator(`.shop-categories [data-shop-category="${category}"]`).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.shop-card img')].every(img=>img.complete&&img.naturalWidth===320));
  assert.ok(await page.locator('.shop-card img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth===320)));
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-shop-tab="shop"]').click();
 assert.ok(await page.locator('#egg-shop').evaluate(root=>root.scrollWidth<=root.clientWidth+2),'Mobile shop must not overflow horizontally');
 await page.screenshot({path:'test-results/egg-shop/mobile.png'});
 await page.reload();await page.getByRole('button',{name:'Egg Shop',exact:true}).click();
 assert.match(await page.locator('.egg-balance').innerText(),/100/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-egg-shop-v1')).owned.filter(id=>id==='wrap-cloud').length),1);
 assert.deepEqual(errors,[]);console.log('PASS Egg Shop purchase, equip, preset, persistence, all model categories and mobile layout');
}finally{await browser.close();await server.close();}
