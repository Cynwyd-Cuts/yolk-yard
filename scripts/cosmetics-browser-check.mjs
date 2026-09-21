import assert from 'node:assert/strict';
export async function checkCosmetics(page, out) {
  await page.getByRole('button',{name:'Customize egg',exact:true}).click();
  await page.getByRole('button',{name:'Headwear',exact:true}).click();
  assert.equal(await page.locator('.cosmetic-tile img').count(),20);
  for(const name of ['Top hat','Beanie','Wizard','Cowboy','Party hat','Halo','Bunny ears','Cat ears','Chef','Beret','Antenna','Flower','Viking','Pirate','Propeller']) {
    await page.getByRole('button',{name,exact:true}).click();
    assert.ok(await page.locator('.egg-studio-preview img').evaluate(img=>img.complete&&img.naturalWidth>0));
  }
  await page.screenshot({path:out+'/egg-headwear-desktop.png'});
  await page.getByRole('button',{name:'Wizard',exact:true}).click();
  await page.getByRole('button',{name:'Patterns',exact:true}).click();
  assert.equal(await page.locator('.cosmetic-tile img').count(),10);
  for(const name of ['Stripes','Polka dots','Checkerboard','Confetti','Lightning','Two tone','Waves','Diamond','Stars']) await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'Accent color 11',exact:true}).click();
  await page.getByRole('button',{name:'Eyewear',exact:true}).click();
  for(const name of ['Sunglasses','Cyclops','Square glasses','Star shades','Round goggles']) await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'Shell',exact:true}).click();
  for(const name of ['Matte','Gloss','Metallic','Classic']) await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'Shell color 3',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('yolk-profile')));
  assert.equal(saved.hat,7);assert.equal(saved.pattern,6);assert.equal(saved.eyewear,1);assert.equal(saved.color,'#72cfdd');assert.equal(saved.accent,'#ff637e');
  await page.getByRole('button',{name:'Headwear',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('#dialog').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:out+'/egg-studio-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Looking good',exact:true}).click();
  await page.getByRole('button',{name:'Customize egg',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Wizard',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Looking good',exact:true}).click();
  console.log('PASS image cosmetics, all new models and patterns, saved selections, responsive studio');
}
