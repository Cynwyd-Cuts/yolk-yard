// Original Yolk Yard cosmetics. IDs are stable save/network identifiers.
export const SHOP_SLOTS=['outfit','pickaxe','wrap','backbling','glider','trail'];
export const SHOP_LABELS={outfit:'Outfits',pickaxe:'Pickaxes',wrap:'Blaster wraps',backbling:'Back accessories',glider:'Gliders',trail:'Dive trails',hat:'Headwear',eyewear:'Eyewear',pattern:'Shell patterns',finish:'Finishes'};
export const TIERS={uncommon:{name:'Fresh',color:'#7ece9c'},rare:{name:'Rare',color:'#60c7ff'},epic:{name:'Epic',color:'#c58cff'},legendary:{name:'Legendary',color:'#ffcb63'}};
export const SHOP_SETS=[
 ['starbound','Starbound','#273345','#72cfdd',15,6,'epic','Orbit Ranger','Lunar Crescent','Satellite Pack','Solar Sail'],
 ['royal','Royal Breakfast','#ffe45e','#8c54c9',3,9,'legendary','Golden Sovereign','Crown Scepter','Royal Crest','Regal Wings'],
 ['neon','Neon Circuit','#273345','#ff637e',1,5,'epic','Neon Runner','Pulse Fork','Arc Reactor','Circuit Kite'],
 ['frost','Frostline','#ffffff','#72cfdd',17,9,'rare','Frost Guard','Ice Splitter','Crystal Cluster','Frost Wing'],
 ['garden','Garden Party','#a5d76e','#efb4df',4,2,'rare','Bloom Scout','Petal Wand','Garden Basket','Petal Parasol'],
 ['reef','Coral Current','#72cfdd','#ee897b',0,8,'rare','Reef Drifter','Coral Hook','Pearl Shell','Manta Sail'],
 ['ember','Ember Forge','#273345','#f78336',17,5,'legendary','Ember Knight','Forge Hammer','Furnace Pack','Ember Wings'],
 ['candy','Sugar Rush','#efb4df','#ffffff',9,4,'rare','Candy Comet','Lollipop Mallet','Sweet Stack','Candy Parasol'],
 ['midnight','Midnight Magic','#464eb3','#b7a1ec',7,6,'epic','Moon Sorcerer','Moon Staff','Spellbook','Moon Kite'],
 ['retro','Arcade Club','#3d8ce8','#ffe45e',2,3,'rare','Pixel Champion','Pixel Hammer','Arcade Pack','Pixel Sail'],
 ['pirate','Treasure Tide','#946344','#f9b74a',18,7,'epic','Captain Sunny','Anchor Hook','Treasure Chest','Corsair Wings'],
 ['cloud','Cloud Nine','#fff6da','#80eacb',10,8,'uncommon','Cloud Cruiser','Breeze Fork','Cloud Pack','Daydream Kite'],
].map(([id,name,color,accent,hat,pattern,tier,outfit,pickaxe,backbling,glider],index)=>({id,name,color,accent,hat,pattern,tier,outfit,pickaxe,backbling,glider,index}));
const prices={outfit:[600,800,1100,1400],pickaxe:[350,500,700,950],wrap:[200,300,450,600],backbling:[250,400,600,800],glider:[400,600,850,1100],trail:[200,250,350,450]};
const names={outfit:s=>s.outfit,pickaxe:s=>s.pickaxe,wrap:s=>s.name+' Wrap',backbling:s=>s.backbling,glider:s=>s.glider,trail:s=>s.name+' Trail'};
export const SHOP_ITEMS=SHOP_SETS.flatMap(set=>SHOP_SLOTS.map(slot=>({id:`${slot}-${set.id}`,slot,name:names[slot](set),set:set.id,tier:set.tier,price:prices[slot][Object.keys(TIERS).indexOf(set.tier)],color:set.color,accent:set.accent,shape:set.index,profile:{color:set.color,accent:set.accent,hat:set.hat,pattern:set.pattern,finish:set.tier==='legendary'?3:2,eyewear:6},description:{outfit:'A coordinated shell, headwear and matching arms. Mix accessories in your locker.',pickaxe:'An original harvesting tool for Royale. Same reach, speed and damage as the starter.',wrap:'A finish for every blaster, including your sidearm. No stat changes.',backbling:'A detailed accessory worn on the back of your egg.',glider:'Deploys automatically when you glide in Royale. Flight stays unchanged.',trail:'A cosmetic ribbon trail while diving or gliding in Royale.'}[slot]})));
for(const set of SHOP_SETS)SHOP_ITEMS.push({...SHOP_ITEMS.find(i=>i.id===`outfit-${set.id}`),id:`outfit-${set.id}-alt`,name:set.outfit+' · Remix',price:Math.max(450,prices.outfit[Object.keys(TIERS).indexOf(set.tier)]-150),color:set.accent,accent:set.color,profile:{color:set.accent,accent:set.color,hat:set.hat,pattern:(set.pattern+3)%10,finish:1,eyewear:6}});
const byId=new Map(SHOP_ITEMS.map(item=>[item.id,item]));
export const shopItem=id=>byId.get(id);
export const validCosmetic=(slot,id)=>shopItem(id)?.slot===slot?id:'';
export const cosmeticProfile=p=>Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,validCosmetic(slot,p?.[slot])]));
