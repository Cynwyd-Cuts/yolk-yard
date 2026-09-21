import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1800,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/tests/arms-preview.html');
 await page.waitForFunction(()=>window.ready,{},{timeout:90000});
 assert.equal(await page.locator('.tile img').count(),40);
 assert.ok(await page.locator('.tile img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
 assert.equal(new Set(await page.locator('.tile img').evaluateAll(imgs=>imgs.map(i=>i.src))).size,40);
 const styles=await page.evaluate(async()=>{
  const {makeArms}=await import('/src/arms.js'),{patternedShell}=await import('/src/cosmetics.js');
  let checked=0;
  for(let pattern=0;pattern<10;pattern++)for(let finish=0;finish<4;finish++){
   const profile={color:'#3d8ce8',accent:'#fff6da',pattern,finish};
   const shell=patternedShell(profile),rig=makeArms('sprinter',profile),hand=rig.userData.limbs[0].hand.material;
   if(shell.roughness!==hand.roughness||shell.metalness!==hand.metalness||shell.color.getHex()!==hand.color.getHex())throw Error('Material mismatch');
   if(Boolean(hand.map)!==Boolean(pattern))throw Error('Missing pattern');
   if(pattern&&shell.map.image.toDataURL()!==hand.map.image.toDataURL())throw Error('Pattern mismatch');
   for(const l of rig.userData.limbs){
    if(!l.arm.geometry.attributes.uv.array.every(Number.isFinite))throw Error('Bad UV');
    if(l.arm.material!==hand||l.hand.material!==hand)throw Error('Mismatched hand');
    l.arm.geometry.dispose();
   }
   hand.map?.dispose();hand.dispose();shell.map?.dispose();shell.dispose();checked++;
  }
  return checked;
 });
 assert.equal(styles,40);
 console.log('PASS all ten patterns and four finishes match from shell to arms and hands');
 assert.deepEqual(errors,[]);
 await mkdir('test-results/arms',{recursive:true});
 await page.screenshot({path:'test-results/arms/blaster-poses.png',fullPage:true});
 const portraits=await page.locator('.tile img').evaluateAll(imgs=>imgs.map(i=>i.src));
 for(const [i,name] of [[0,'sprinter-idle'],[1,'sprinter-reload'],[35,'pip-idle'],[4,'sprinter-draw']])
  await writeFile(`test-results/arms/${name}.png`,Buffer.from(portraits[i].split(',')[1],'base64'));
 console.log('PASS all eight arm rigs render idle, reload, sight alignment and third-person poses');
} finally {await browser.close();await server.close();}
