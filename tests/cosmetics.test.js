import test from "node:test";
import assert from "node:assert/strict";
import {safeProfile, HATS, PATTERNS, FINISHES, EYEWEAR, COLORS} from "../src/data.js";
import {Simulation} from "../src/simulation.js";
test("all cosmetic choices survive profile validation and multiplayer snapshots", () => {
  const sim = new Simulation({map:"yard", mode:"ffa", bots:0});
  sim.addPlayer("styled", {});
  for(let i=0;i<24;i++) {
    const profile = {name:"Styled", weapon:"needle", color:COLORS[i], accent:COLORS[23-i], hat:i%HATS.length, pattern:i%PATTERNS.length, finish:i%FINISHES.length, eyewear:i%EYEWEAR.length};
    assert.deepEqual(safeProfile(profile), {...profile,outfit:'',wrap:'',pickaxe:'',backbling:'',glider:'',trail:''});
    sim.setProfile("styled", profile);
    const remote = sim.snapshot().players.find(p=>p.id==="styled");
    for(const key of Object.keys(profile)) assert.equal(remote[key], profile[key], key);
  }
});
test("old profiles retain their appearance and malformed cosmetics fall back safely", () => {
  const old=safeProfile({hat:3,color:COLORS[2]});
  assert.equal(old.hat,3); assert.equal(old.color,COLORS[2]);
  for(const value of [Infinity, -1, 999, "bad", 1.5]) {
    const p=safeProfile({hat:value,pattern:value,finish:value,eyewear:value,accent:"url(bad)"});
    for(const key of ["hat","pattern","finish","eyewear"]) assert.equal(p[key],0);
    assert.equal(p.accent,COLORS[1]);
  }
});

test("plain eyewear is saved without shifting existing eyewear IDs", async () => {
  const {NO_EYEWEAR}=await import('../src/data.js');
  const {optionProfile,addEyewear}=await import('../src/cosmetics.js');
  const {Group}=await import('three');
  assert.equal(safeProfile({eyewear:NO_EYEWEAR}).eyewear,NO_EYEWEAR);
  for(let i=0;i<6;i++) assert.equal(safeProfile({eyewear:i}).eyewear,i);
  const group=new Group();addEyewear(group,{eyewear:NO_EYEWEAR},{});
  assert.equal(group.children.length,0);
  for(const [key,values] of Object.entries({hat:HATS,pattern:PATTERNS,finish:FINISHES,eyewear:EYEWEAR})) {
    values.forEach((_,i)=>{
      const profile=optionProfile(key,i);
      assert.equal(profile[key],i);
      for(const [other,plain] of Object.entries({hat:0,pattern:0,finish:0,eyewear:NO_EYEWEAR})) if(other!==key) assert.equal(profile[other],plain);
    });
  }
});
