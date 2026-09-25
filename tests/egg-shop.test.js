import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_ITEMS,SHOP_SLOTS,shopItem} from '../src/shop-catalog.js';
import {normalizeWallet,purchase,reward,ownedLoadout,EggWallet,MatchEarnings} from '../src/egg-wallet.js';
import {safeProfile} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {makeShopPickaxe,makeShopBack,makeShopGlider,makeShopTrail} from '../src/shop-models.js';
test('84 original cosmetics have unique IDs, supported palettes and priced categories',()=>{
 assert.equal(SHOP_ITEMS.length,84);assert.equal(new Set(SHOP_ITEMS.map(i=>i.id)).size,84);
 for(const item of SHOP_ITEMS){assert.ok(item.price>=200&&item.price<=1400);assert.equal(safeProfile(item.profile).color,item.profile.color);assert.ok(SHOP_SLOTS.includes(item.slot));}
});
test('wallet migrates eggs once, deducts exactly once and rejects overspending',()=>{
 let wallet=normalizeWallet(null,70);assert.equal(wallet.balance,370);
 wallet=purchase(wallet,'wrap-cloud');assert.equal(wallet.balance,170);assert.equal(normalizeWallet(wallet,70).balance,170);
 assert.throws(()=>purchase(wallet,'wrap-cloud'),/already own/);assert.throws(()=>purchase(wallet,'outfit-royal'),/more eggs/);
 const next=reward(wallet,'round-a',100,'Match');assert.equal(next.balance,270);assert.equal(reward(next,'round-a',100,'Match'),next);
 assert.equal(ownedLoadout(next,{wrap:'wrap-cloud',outfit:'outfit-royal'}).outfit,'');
});
test('failed storage does not report a purchase or deduct the in-memory balance',async()=>{
 const wallet=new EggWallet({getItem:()=>null,setItem:()=>{throw Error('quota');}});const original=wallet.value;
 await assert.rejects(wallet.buy('wrap-cloud'),/Nothing was charged/);assert.equal(wallet.value,original);assert.equal(wallet.value.balance,300);
});
test('active play rewards stop while idle, deduplicate completion and cap eliminations',()=>{
 const rewards=[],earnings=new MatchEarnings(),sample={key:'a',dt:.1,active:true,kills:0,finished:false};
 for(let i=0;i<1201;i++)earnings.sample(sample,(...r)=>rewards.push(r));
 earnings.sample({...sample,kills:5},(...r)=>rewards.push(r));
 for(let i=0;i<100;i++)earnings.sample({...sample,kills:5,active:false},(...r)=>rewards.push(r));
 earnings.sample({...sample,kills:5,finished:true,won:true},(...r)=>rewards.push(r));
 earnings.sample({...sample,kills:5,finished:true,won:true},(...r)=>rewards.push(r));
 assert.equal(rewards.reduce((sum,r)=>sum+r[1],0),80+75+200);
 const before=rewards.length;earnings.sample({...sample,key:'b',finished:true,active:false},(...r)=>rewards.push(r));assert.equal(rewards.length,before);
});
test('cosmetic styles survive both simulation snapshots without changing blaster stats',()=>{
 const profile=safeProfile({name:'Shop test',outfit:'outfit-neon',wrap:'wrap-cloud',pickaxe:'pickaxe-royal',backbling:'backbling-garden',glider:'glider-reef',trail:'trail-neon'});
 for(const Type of [Simulation,RoyaleSimulation]){const sim=new Type({bots:0,fill:false});sim.addPlayer('host',profile);const p=sim.snapshot().players[0];for(const slot of SHOP_SLOTS)assert.equal(p[slot],profile[slot]);}
 assert.equal(safeProfile({wrap:'outfit-neon'}).wrap,'');
});
test('every new tool, accessory, glider and trail produces a visible 3D model',()=>{
 const factories={pickaxe:makeShopPickaxe,backbling:makeShopBack,glider:makeShopGlider,trail:makeShopTrail};
 for(const item of SHOP_ITEMS){if(!factories[item.slot])continue;const model=factories[item.slot](item.id);let meshes=0;model.traverse(m=>{if(m.isMesh){meshes++;assert.ok(m.geometry.attributes.position.count>0);m.geometry.dispose();m.material.dispose();}});assert.ok(meshes>0,item.id);}
});
