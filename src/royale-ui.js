import {buildIcon} from './building-ui.js';
import {gun} from './data.js';
import {ITEMS,RARITIES,itemInfo,transportAt,ammoType} from './royale-data.js';
import {ROYALE_MAP} from './royale-map.js';
import {wallDistance,dist} from './physics.js';
import {groundAt} from './terrain.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class RoyaleUI{
 constructor(preview){
  this.preview=preview;this.waypoint=null;this.lastKey='';
  document.querySelector('#hud').insertAdjacentHTML('beforeend',`<div id="royale-hud" hidden>
   <div class="royale-compass" id="royale-compass"></div>
   <button class="royale-minimap" data-action="royale-map" aria-label="Open island map"><canvas id="royale-mini" width="260" height="260"></canvas><span><b id="royale-alive">16</b> ALIVE <i>·</i> <b id="royale-phase">STORM 1</b></span></button>
   <div class="royale-storm-warning" id="royale-storm-warning" role="status"></div>
   <div class="royale-flight" id="royale-flight"><span class="eyebrow">EGGSPRESS AIRLINES</span><strong id="royale-flight-title"></strong><p id="royale-flight-help"></p><button data-action="royale-jump" class="primary" id="royale-flight-button">JUMP</button></div>
   <div class="royale-prompt" id="royale-prompt" role="status"></div>
   <div class="royale-vitals"><div class="royale-meter shield"><span>◈ SHIELD</span><b id="royale-shield">0</b><i id="royale-shield-fill"></i></div><div class="royale-meter stamina"><span>↟ STAMINA</span><b id="royale-stamina">100</b><i id="royale-stamina-fill"></i></div></div>
   <div class="royale-hotbar" id="royale-hotbar" role="group" aria-label="Inventory slots"></div>
   <div class="royale-tools"><button data-action="royale-inventory">Inventory</button><button data-action="royale-map">Map</button><button data-action="royale-drop">Drop</button></div>
   <div class="royale-use" id="royale-use"><span id="royale-use-label"></span><div><i id="royale-use-fill"></i></div></div>
   <div class="royale-mobile"><button data-touch="sprint" aria-label="Hold to sprint">SPRINT</button><button data-touch="interact" aria-label="Hold to search or pick up">USE / TAKE</button></div>
  </div>`);
  this.root=document.querySelector('#royale-hud');
 }
 slotMarkup(p,inventory=false){return (p.inventory||Array(5).fill(null)).map((item,index)=>{
  const info=itemInfo(item),rarity=RARITIES[item?.rarity||0];
  return `<button class="royale-slot ${index===p.slot?'selected':''}" data-royale-slot="${index}" ${inventory&&!item?.pickaxe?'draggable="true"':''} style="--rarity:${item?info.color:'#58636c'}" aria-label="Slot ${index+1}: ${escape(info.name)}" aria-pressed="${index===p.slot}"><kbd>${index+1}</kbd>${item?`<img src="${this.preview(item)}" alt="${escape(info.name)}" draggable="false">`:'<span class="empty-slot-mark">＋</span>'}<span class="slot-name">${escape(info.name)}</span>${item?`<b>${item.pickaxe?'∞':item.weapon?item.ammo:item.count+'×'}</b>`:''}${inventory&&item?`<small>${item.weapon?rarity.name:'Utility'}${item.weapon?' · '+'★'.repeat((item.rarity||0)+1):''}</small>`:''}</button>`;
 }).join('');}
 mapHTML(){return `<p class="hint">Choose a landing spot or plan your next rotation. Click the island to mark a waypoint.</p><canvas id="royale-fullmap" class="royale-fullmap" width="720" height="720" aria-label="Sunnybreak island map"></canvas><div class="map-legend"><span>● You</span><span>◯ Safe area</span><span>◌ Next circle</span><span>◆ Supply</span></div><div class="split-actions"><button data-action="royale-clear-marker">Clear marker</button><button class="primary" data-action="resume">RETURN TO GAME</button></div>`;}
 ammoHTML(p){return Object.entries(p.materials||{}).map(([id,count])=>`<div class="inventory-ammo resource-count">${buildIcon(id)}<span>${id}</span><b>${count}</b></div>`).join('')+Object.entries(p.bank||{}).map(([id,count])=>`<div class="inventory-ammo"><img src="${this.preview({id,ammoType:id})}" alt=""><span>${escape(id)}</span><b>${count}</b></div>`).join('');}
 inspectHTML(p){
  const item=p.inventory[p.slot],info=itemInfo(item);if(item?.pickaxe)return '<div class="inspect-empty"><h3>PICKAXE</h3>Harvest wood, brick and metal. Permanent sixth slot. Cannot be dropped or replaced.</div>';if(!item)return '<div class="inspect-empty">Select an item to inspect it.</div>';
  const rarity=RARITIES[item.rarity||0],w=item.weapon?gun(p):null,def=ITEMS[item.id];
  return `<div class="inspect-heading" style="--rarity:${info.color}"><span>${item.weapon?rarity.name+' · '+info.role:'UTILITY'}</span><h3>${escape(info.name)}</h3><img src="${this.preview(item)}" alt="${escape(info.name)}"></div><p>${escape(w?.desc||({heal:'Restores shell health.',shield:'Restores shield protection.',splash:'Restores nearby shell health and shields.',popper:'A throwable grenade with a short fuse.',impulse:'Launches you into the air.',launchpad:'Place a reusable launch pad.'}[def?.kind]))}</p>${w?`<dl class="weapon-stats"><div><dt>Damage</dt><dd>${(w.damage*w.pellets*(w.burst||1)).toFixed(0)}${w.pellets>1?' total pellets':w.burst?' per burst':''}</dd></div><div><dt>Fire rate</dt><dd>${(1/w.interval).toFixed(1)} / s</dd></div><div><dt>Magazine</dt><dd>${w.magazine}</dd></div><div><dt>Reload</dt><dd>${w.reload.toFixed(2)} s</dd></div><div><dt>Ammo</dt><dd>${ammoType(item.id)}</dd></div><div><dt>Reserve</dt><dd>${p.bank[ammoType(item.id)]||0}</dd></div></dl>`:`<dl class="weapon-stats"><div><dt>Use time</dt><dd>${def?.duration||0}s</dd></div><div><dt>Stack</dt><dd>${item.count} / ${def?.stack||1}</dd></div>${def?.amount?`<div><dt>Restores</dt><dd>${def.amount}</dd></div>`:''}</dl>`}`;
 }
 inventoryHTML(p){return `<div class="inventory-content"><section class="inventory-ammo-section"><h3>RESOURCES & AMMO</h3><div class="ammo-bank">${this.ammoHTML(p)}</div></section><section class="inventory-inspect" id="inventory-inspect" ${this.inspect?'':'hidden'}>${this.inspectHTML(p)}</section><section class="inventory-equipment"><div class="inventory-section-title"><h3>EQUIPMENT</h3><span>Drag to reorder</span></div><div class="royale-inventory-grid">${this.slotMarkup(p,true)}</div><p id="inventory-selected-name">${escape(itemInfo(p.inventory[p.slot]).name)}</p></section></div><footer class="inventory-actions"><button data-action="royale-split">SPLIT</button><button data-action="royale-drop-one">DROP ONE</button><button data-action="royale-drop">DROP STACK</button><button data-action="royale-inspect" aria-pressed="${!!this.inspect}">INSPECT</button><button data-action="resume">BACK</button></footer>`;}
 updateInventory(p){
  const grid=document.querySelector('.royale-inventory-grid');if(!grid||!p||this.dragging)return;
  const key=JSON.stringify([p.inventory,p.slot,p.bank,p.materials,this.inspect]);
  if(this.inventoryKey===key)return;this.inventoryKey=key;grid.innerHTML=this.slotMarkup(p,true);
  document.querySelector('.ammo-bank').innerHTML=this.ammoHTML(p);
  const inspect=document.querySelector('#inventory-inspect');inspect.hidden=!this.inspect;inspect.innerHTML=this.inspectHTML(p);
  document.querySelector('#inventory-selected-name').textContent=itemInfo(p.inventory[p.slot]).name;
  const item=p.inventory[p.slot];document.querySelector('[data-action="royale-split"]').disabled=!item||item.weapon||item.count<2||p.inventory.every(Boolean);
  document.querySelector('[data-action="royale-drop-one"]').disabled=!item||item.pickaxe;
  document.querySelector('[data-action="royale-drop"]').disabled=!item||item.pickaxe;
  document.querySelector('[data-action="royale-inspect"]').setAttribute('aria-pressed',String(!!this.inspect));
 }
 drawMap(canvas,state,p,full=false){
  if(!canvas||!state.royale)return;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,size=512,s=w/size,map=ROYALE_MAP,r=state.royale;
  const point=(x,z)=>[(x+256)*s,(z+256)*s];
  c.clearRect(0,0,w,h);c.fillStyle='#3e91ab';c.fillRect(0,0,w,h);c.fillStyle='#e5d4a1';c.fillRect(3,3,w-6,h-6);c.fillStyle='#84ad79';c.fillRect(9,9,w-18,h-18);
  // Static terrain and vegetation are rasterized once per map size, not every HUD frame.
  this.mapBackgrounds??=new Map();
  if(!this.mapBackgrounds.has(w)){
   const bg=document.createElement('canvas');bg.width=w;bg.height=h;const b=bg.getContext('2d');
   for(let z=-256;z<256;z+=4)for(let x=-256;x<256;x+=4){const elevation=groundAt(map,x,z);if(elevation<.25)continue;const [px,pz]=point(x,z);b.fillStyle=`rgba(75,101,67,${Math.min(.4,elevation*.045)})`;b.fillRect(px,pz,4*s+1,4*s+1);}
   b.fillStyle='#5c8b65';for(const t of map.trees){const [x,z]=point(t.x,t.z);b.beginPath();b.arc(x,z,(t.kind==='pine'?2:2.8)*s,0,Math.PI*2);b.fill();}this.mapBackgrounds.set(w,bg);
  }
  c.drawImage(this.mapBackgrounds.get(w),0,0);c.lineWidth=7*s;c.strokeStyle='#c5ba96';
  for(const poi of map.districts){const [x,z]=point(poi.x,poi.z);c.beginPath();c.moveTo(w/2,h/2);c.lineTo(x,z);c.stroke();c.fillStyle='#abc08a';c.beginPath();c.arc(x,z,15*s,0,Math.PI*2);c.fill();}
  c.fillStyle='#697a68';for(const b of map.buildings){const [x,z]=point(b.x-b.w/2,b.z-b.d/2);c.fillRect(x,z,b.w*s,b.d*s);}
  if(r.storm?.active){const q=r.storm,[x,z]=point(q.x,q.z);c.save();c.fillStyle='#725ac277';c.beginPath();c.rect(0,0,w,h);c.moveTo(x+q.radius*s,z);c.arc(x,z,q.radius*s,0,Math.PI*2,true);c.fill('evenodd');c.strokeStyle='#f6f5ff';c.lineWidth=full?3:2;c.beginPath();c.arc(x,z,q.radius*s,0,Math.PI*2);c.stroke();const [nx,nz]=point(q.nextX,q.nextZ);c.setLineDash([5,4]);c.strokeStyle='#fff';c.beginPath();c.arc(nx,nz,q.nextRadius*s,0,Math.PI*2);c.stroke();c.restore();}
  if(r.route&&r.elapsed<r.route.duration){c.save();c.strokeStyle='#ffedb1';c.lineWidth=2;c.setLineDash([6,6]);c.beginPath();c.moveTo(...point(r.route.fromX,r.route.fromZ));c.lineTo(...point(r.route.toX,r.route.toZ));c.stroke();c.restore();const bus=transportAt(r.route,r.elapsed),[x,z]=point(bus.x,bus.z);c.fillStyle='#ffda70';c.fillRect(x-5,z-5,10,10);}
  if(full){c.font='800 13px system-ui';c.textAlign='center';c.strokeStyle='#23453b';c.lineWidth=3;c.fillStyle='#fff9e5';for(const poi of map.districts){const [x,z]=point(poi.x,poi.z);c.strokeText(poi.name.toUpperCase(),x,z-35*s);c.fillText(poi.name.toUpperCase(),x,z-35*s);}}
  for(const chest of r.chests||[])if(chest.supply&&!chest.opened){const [x,z]=point(chest.x,chest.z);c.fillStyle='#ffd377';c.beginPath();c.moveTo(x,z-5);c.lineTo(x+5,z);c.lineTo(x,z+5);c.lineTo(x-5,z);c.closePath();c.fill();}
  if(this.waypoint){const[x,z]=point(this.waypoint.x,this.waypoint.z);c.fillStyle='#ffdd77';c.strokeStyle='#493e23';c.lineWidth=2;c.beginPath();c.arc(x,z,full?7:5,0,Math.PI*2);c.fill();c.stroke();}
  if(p){const[x,z]=point(p.x,p.z);c.save();c.translate(x,z);c.rotate(-p.yaw);c.fillStyle='#fff';c.strokeStyle='#244c5c';c.lineWidth=2;c.beginPath();c.moveTo(0,-8);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.stroke();c.restore();}
  c.font=`800 ${full?18:12}px system-ui`;c.textAlign='center';c.fillStyle='#fff';c.fillText('N',w/2,full?23:16);
 }
 update(state,local,watched,label,paused){
  const active=!!state?.royale;this.root.hidden=!active;document.body.classList.toggle('in-royale',active);
  if(!active||!local)return;
  const $=id=>document.getElementById(id),r=state.royale,p=watched||local;
  const heading=(((-p.yaw*180/Math.PI)%360)+360)%360;
  $('royale-compass').textContent=`${['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8]}  ${Math.round(heading)}°${this.waypoint?'   ◆ '+Math.round(Math.hypot(p.x-this.waypoint.x,p.z-this.waypoint.z))+' m':''}`;
  $('royale-alive').textContent=r.alive;$('royale-phase').textContent=r.elapsed<35?'DROP ZONE':`STORM ${r.storm.index+1}`;
  this.drawMap($('royale-mini'),state,p);this.drawMap($('royale-fullmap'),state,p,true);
  $('royale-shield').textContent=Math.ceil(p.shield||0);$('royale-shield-fill').style.width=(p.shield||0)+'%';$('royale-stamina').textContent=Math.ceil(p.stamina||0);$('royale-stamina-fill').style.width=(p.stamina||0)+'%';
  const key=JSON.stringify([p.inventory,p.slot]);if(key!==this.lastKey){$('royale-hotbar').innerHTML=this.slotMarkup(p);this.lastKey=key;}
  this.updateInventory(local);
  const flight=['transport','dive','glide','launch'].includes(local.flight)&&local.health>0;
  $('royale-flight').hidden=!flight;$('royale-flight').classList.toggle('airborne',local.flight!=='transport');
  $('royale-flight-title').textContent=local.flight==='transport'?`${r.elapsed<3?'Doors open in '+Math.ceil(3-r.elapsed):'Choose your landing spot'}${r.elapsed>=3?' · '+Math.ceil(35-r.elapsed)+'s':''}`:local.flight==='dive'?'Freefall':'Shell glider deployed';
  $('royale-flight-help').textContent=local.flight==='transport'?'Open the map to mark a district. Leave the Eggspress when you are ready.':local.flight==='dive'?`${label('forward')} to steer · ${label('jump')} to deploy glider`:`${label('jump')} to dive again at altitude. Your glider opens automatically near the ground.`;
  $('royale-flight-button').hidden=['glide','launch'].includes(local.flight);$('royale-flight-button').disabled=local.flight==='transport'&&r.elapsed<3;$('royale-flight-button').textContent=local.flight==='transport'?`JUMP · ${label('jump')}`:`DEPLOY GLIDER · ${label('jump')}`;
  const outside=r.storm.active&&Math.hypot(p.x-r.storm.x,p.z-r.storm.z)>r.storm.radius;
  $('royale-storm-warning').textContent=outside?`IN THE STORM · ${Math.ceil(Math.hypot(p.x-r.storm.x,p.z-r.storm.z)-r.storm.radius)} m TO SAFETY`:r.storm.active?`${r.storm.closing?'STORM CLOSING':'STORM CLOSES IN'} ${Math.ceil(r.storm.seconds)}s`:'';
  $('royale-storm-warning').classList.toggle('danger',outside);this.root.classList.toggle('outside-storm',outside);
  const use=p.use;$('royale-use').hidden=!use&&!p.chestProgress;
  $('royale-use-label').textContent=use?`Using ${ITEMS[use.id].name} · ${Math.max(0,use.end-state.time).toFixed(1)}s`:'Searching chest…';
  $('royale-use-fill').style.width=(use?Math.min(1,(state.time-use.start)/(use.end-use.start)):Math.min(1,p.chestProgress/.8))*100+'%';
  let prompt='';if(local.health>0&&local.flight==='ground'&&!paused){
   const accessible=item=>{if(dist(local,item)>3.2||item.landAt>state.time)return false;const from={x:local.x,y:local.y+.9,z:local.z},dx=item.x-from.x,dy=item.y+.6-from.y,dz=item.z-from.z,len=Math.hypot(dx,dy,dz)||1;return wallDistance(ROYALE_MAP,from,{x:dx/len,y:dy/len,z:dz/len},len)>=len-.15;};
   const chest=r.chests.find(c=>!c.opened&&accessible(c));const item=r.loot.filter(i=>!i.ammoType&&accessible(i)).sort((a,b)=>dist(local,a)-dist(local,b))[0];
   if(chest)prompt=`<kbd>${escape(label('interact'))}</kbd> HOLD TO SEARCH ${chest.supply?'SUPPLY DROP':'CHEST'}`;
   else if(item){const info=itemInfo(item);prompt=`<kbd>${escape(label('interact'))}</kbd> ${escape(info.name)} <span style="color:${info.color}">${item.weapon?RARITIES[item.rarity||0].name: '×'+item.count}</span><small>${local.inventory.every(Boolean)?'Replaces selected slot':'Pick up'}</small>`;}
  }
  $('royale-prompt').innerHTML=prompt;$('royale-prompt').hidden=!prompt;
 }
}
