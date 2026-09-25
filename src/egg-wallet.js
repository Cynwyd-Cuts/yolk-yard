import {SHOP_SLOTS,shopItem} from './shop-catalog.js';
export const WALLET_KEY='yolk-egg-shop-v1';
export const EGG_REWARDS={welcome:300,minute:40,elimination:15,completion:100,victory:100,topFive:50};
const integer=(value,max=1e9)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)||0))):0;
export function normalizeWallet(value,legacyEggs=0){
 if(!value||value.version!==1)return {version:1,balance:integer(legacyEggs)+EGG_REWARDS.welcome,earned:integer(legacyEggs)+EGG_REWARDS.welcome,owned:[],favorites:[],presets:[null,null,null],receipts:[],lastReward:null};
 return {...value,balance:integer(value.balance),earned:integer(value.earned),owned:[...new Set((value.owned||[]).filter(id=>shopItem(id)))],favorites:[...new Set((value.favorites||[]).filter(id=>shopItem(id)))],presets:(value.presets||[]).slice(0,3),receipts:(value.receipts||[]).filter(id=>typeof id==='string').slice(-200)};
}
export function purchase(wallet,id){
 const item=shopItem(id);if(!item)throw Error('That item is unavailable.');
 if(wallet.owned.includes(id))throw Error('You already own this item.');
 if(wallet.balance<item.price)throw Error(`You need ${item.price-wallet.balance} more eggs.`);
 return {...wallet,balance:wallet.balance-item.price,owned:[...wallet.owned,id]};
}
export function reward(wallet,id,amount,label){
 if(wallet.receipts.includes(id))return wallet;
 amount=integer(amount,2000);return {...wallet,balance:wallet.balance+amount,earned:wallet.earned+amount,receipts:[...wallet.receipts,id].slice(-200),lastReward:{amount,label}};
}
export function ownedLoadout(wallet,profile){return Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,wallet.owned.includes(profile?.[slot])&&shopItem(profile[slot])?.slot===slot?profile[slot]:'']));}
export class EggWallet {
 constructor(storage,legacyEggs=0){this.storage=storage;this.legacyEggs=legacyEggs;this.value=this.read();this.error='';try{this.persist(this.value);}catch(error){this.error=error.message;}}
 read(){let raw;try{raw=JSON.parse(this.storage.getItem(WALLET_KEY));}catch{}return normalizeWallet(raw,this.legacyEggs);}
 persist(next){try{this.storage.setItem(WALLET_KEY,JSON.stringify(next));}catch{throw Error('Browser storage is unavailable. Nothing was charged. Allow storage before buying.');}this.value=next;return next;}
 async change(fn){const run=()=>this.persist(fn(this.read()));return globalThis.navigator?.locks?globalThis.navigator.locks.request(WALLET_KEY,run):run();}
 buy(id){return this.change(w=>purchase(w,id));}
 award(id,amount,label){return this.change(w=>reward(w,id,amount,label));}
}
// Time rewards require recent gameplay input; menus, spectating and idle tabs
// do not count. Elimination rewards are capped at 30 per round.
export class MatchEarnings {
 constructor(){this.key='';}
 sample({key,dt,active,kills,finished,won,place,doubleEggs=false},pay){
  if(this.key!==key){this.key=key;this.id=globalThis.crypto.randomUUID();this.seconds=0;this.minutes=0;this.kills=kills||0;this.rewardedKills=0;this.finished=false;this.total=0;}
  const grant=(suffix,amount,label)=>{this.total+=amount;pay(this.id+':'+suffix,amount,label);};
  if(active&&!finished)this.seconds+=Math.min(.1,Math.max(0,dt));
  const minute=Math.min(20,Math.floor(this.seconds/60));
  if(minute>this.minutes){grant('minute-'+minute,(minute-this.minutes)*EGG_REWARDS.minute,'Active play');this.minutes=minute;}
  const gained=Math.min(Math.max(0,(kills||0)-this.kills),30-this.rewardedKills);this.kills=Math.max(this.kills,kills||0);
  if(gained){this.rewardedKills+=gained;grant('elim-'+this.rewardedKills,gained*EGG_REWARDS.elimination*(doubleEggs?2:1),doubleEggs?'Double Eggs eliminations':'Eliminations');}
  if(finished&&!this.finished){this.finished=true;if(this.seconds>=120){const bonus=won?EGG_REWARDS.victory:place>1&&place<=5?EGG_REWARDS.topFive:0;grant('finish',EGG_REWARDS.completion+bonus,won?'Match complete + victory':bonus?'Match complete + top five':'Match complete');}}
 }
}
