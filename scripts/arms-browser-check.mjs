import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/tests/arms-preview.html');
 await page.waitForFunction(()=>window.ready,{},{timeout:90000});
 assert.equal(await page.locator('.tile img').count(),32);
 assert.ok(await page.locator('.tile img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
 assert.equal(new Set(await page.locator('.tile img').evaluateAll(imgs=>imgs.map(i=>i.src))).size,32);
 assert.deepEqual(errors,[]);
 await mkdir('test-results/arms',{recursive:true});
 await page.screenshot({path:'test-results/arms/blaster-poses.png',fullPage:true});
 console.log('PASS all eight arm rigs render idle, reload, sight alignment and third-person poses');
} finally {await browser.close();await server.close();}
