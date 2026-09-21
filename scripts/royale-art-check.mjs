// Reproducible visual regression gallery using the production model factories.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const vite=await createServer({server:{host:'127.0.0.1',port:5184,strictPort:true,watch:null}});await vite.listen();
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],out='test-results/royale-art';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5184/');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const art=await import('/src/royale-art.js'),{buildIsland,RoyaleView}=await import('/src/royale-view.js'),{ROYALE_MAP}=await import('/src/royale-map.js'),{ITEMS,ROYALE_GUN_IDS}=await import('/src/royale-data.js');
  const canvas=document.createElement('canvas');canvas.id='art-check';canvas.style='position:fixed;inset:0;z-index:99999;width:100%;height:100%';document.body.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,900);renderer.setPixelRatio(1);renderer.setClearColor(0xb5dfe4);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff3d5,0x7896a0,2.5));const sun=new THREE.DirectionalLight(0xffe3b4,2.3);sun.position.set(-90,150,100);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(48,1400/900,.1,2000),world=new THREE.Group();scene.add(world);
  const mats=new Map(),box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12);
  const mat=c=>{if(!mats.has(c))mats.set(c,new THREE.MeshLambertMaterial({color:c}));return mats.get(c);};
  const part=(g,geometry,c,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geometry,mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;};
  const kit={mat,palette:{crate:0xad8961,stone:0xd4d5c6,sand:0xe9d9b2},block:(g,x,y,z,w,h,d,c)=>part(g,box,c,x,y,z,w,h,d),ball:(g,x,y,z,w,h,d,c)=>part(g,sphere,c,x,y,z,w,h,d),cylinder:(g,x,y,z,r,h,c,n=16)=>part(g,new THREE.CylinderGeometry(r,r,h,n),c,x,y,z)};
  const start=performance.now();buildIsland(world,ROYALE_MAP,kit);const buildMs=performance.now()-start;
  const gallery=new THREE.Group();scene.add(gallery);gallery.visible=false;
  [...ROYALE_GUN_IDS.map(id=>({id,weapon:true,rarity:3})),...Object.keys(ITEMS).map(id=>({id}))].forEach((item,i)=>{const g=art.lootModel(item,kit,{ground:false});g.scale.setScalar(3);g.position.set((i%5-2)*5,1,-Math.floor(i/5)*5);g.rotation.y=-.55;gallery.add(g);});
  const chest=art.chestModel(kit);chest.position.set(-5,0,6);gallery.add(chest);const supply=art.chestModel(kit,true);supply.position.set(0,0,6);gallery.add(supply);const glider=art.gliderModel(kit);glider.position.set(5,0,6);gallery.add(glider);
  const royale=new RoyaleView({scene,settings:{quality:'low'}},kit);royale.root.visible=false;
  window.artCheck={render:(kind,index=0)=>{
   world.visible=kind==='island';gallery.visible=kind==='gallery';royale.root.visible=kind==='transport';
   if(kind==='island'){const p=ROYALE_MAP.districts[index];camera.position.set(p.x+55,48,p.z+78);camera.lookAt(p.x,1,p.z);}
   else if(kind==='gallery'){camera.position.set(15,16,22);camera.lookAt(0,0,-4);}
   else{royale.transport.visible=true;royale.wall.visible=royale.ring.visible=false;camera.position.set(26,21,-34);camera.lookAt(0,7,0);}
   renderer.render(scene,camera);return {name:kind==='island'?ROYALE_MAP.districts[index].name:kind,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,buildMs};
  }};
 });
 const results=[];
 for(let i=0;i<9;i++){results.push(await page.evaluate(i=>window.artCheck.render('island',i),i));await page.locator('#art-check').screenshot({path:`${out}/district-${i}.png`});}
 for(const kind of ['gallery','transport']){results.push(await page.evaluate(kind=>window.artCheck.render(kind),kind));await page.locator('#art-check').screenshot({path:`${out}/${kind}.png`});}
 assert.deepEqual(errors,[]);for(const r of results){assert.ok(r.triangles>1000);assert.ok(r.calls<(r.name==='gallery'?1100:200),`${r.name}: ${r.calls} draw calls`);}
 await writeFile(`${out}/report.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();await vite.close();}
