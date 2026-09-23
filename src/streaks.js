import {weapon} from './data.js';
export const arenaBonuses = mode => mode === 'ffa' || mode === 'teams';
export const BONUS_NAMES = {armor:'Hard Boiled',damage:'Egg Breaker',restock:'Restock',overheal:'Overheal',eggs:'Double Eggs',mini:'Mini Egg'};
export function resetBonuses(p) {
 Object.assign(p,{streak:0,streakArmor:0,damageUntil:0,eggsUntil:0,miniUntil:0,restockUntil:0,bodyScale:1});
}
export function updateBonuses(p,time,dt) {
 p.bodyScale=p.miniUntil>time?.5:1;
 if(p.health>100)p.health=Math.max(100,p.health-10*dt);
}
export function awardBonus(sim,p) {
 if(!arenaBonuses(sim.options.mode)||p.health<=0)return;
 p.eggs=(p.eggs||0)+(p.eggsUntil>sim.time?20:10);
 for(const key of ['damageUntil','eggsUntil','miniUntil'])if(p[key]>sim.time)p[key]=Math.min(sim.time+15,p[key]+3);
 if(p.streak%5)return;
 const kind=Object.keys(BONUS_NAMES)[Math.floor(sim.random()*6)];
 if(kind==='armor')p.streakArmor=100;
 if(kind==='damage')p.damageUntil=sim.time+15;
 if(kind==='eggs')p.eggsUntil=sim.time+15;
 if(kind==='mini'){p.miniUntil=sim.time+15;p.bodyScale=.5;}
 if(kind==='overheal')p.health=200;
 if(kind==='restock'){
  p.ammo=[weapon(p.weapon).magazine,weapon('pip').magazine];
  p.reserve=[weapon(p.weapon).reserve,weapon('pip').reserve];p.poppers=3;p.reloadEnd=0;p.restockUntil=sim.time+3;
 }
 sim.emit('streak-bonus',{player:p.id,kind,streak:p.streak});
}
export function bonusStatus(p,time) {
 const items=[];
 if(p.streakArmor>0)items.push(`Hard Boiled · ${Math.ceil(p.streakArmor)} shield${p.health>100?' (stored)':''}`);
 if(p.health>100)items.push(`Overheal · ${Math.ceil(p.health)} HP`);
 for(const [key,name] of [['damageUntil','Egg Breaker · 2× damage'],['eggsUntil','Double Eggs'],['miniUntil','Mini Egg'],['restockUntil','Restock']])if(p[key]>time)items.push(`${name} · ${Math.ceil(p[key]-time)}s`);
 return items;
}
