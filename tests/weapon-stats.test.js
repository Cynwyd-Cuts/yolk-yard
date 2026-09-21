import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { weapon } from '../src/data.js';
import { shellDamageFactor } from '../src/physics.js';
function arena(id) {
  const sim = new Simulation({ bots: 0, seed: 11 });
  const player = sim.addPlayer('test', { weapon: id });
  sim.startRound();
  sim.spawn(player);
  sim.time = 10;
  sim.map = { ...sim.map, boxes: [] };
  Object.assign(player, { x: 0, y: 0, z: 0, nextShot: 0, shieldUntil: 0 });
  return { sim, player };
}
function hold(sim, player, frames, fire = true) {
  for (let n = 0; n < frames; n++) {
    sim.setInput(player.id, { seq: player.ack + 1, fire, slot: player.slot });
    sim.tick(1 / 60);
  }
}
test('all eight reference magazines, damage values, reserves and firing intervals', () => {
  for (const [id, damage, mag, reserve, ticks] of [
    ['sprinter',30,30,240,3], ['scatter',8.5,2,24,8],
    ['needle',170,1,12,15], ['zipper',23,40,200,2],
    ['thumper',140,1,3,40], ['anchor',105,15,60,13],
    ['duet',32,24,150,15], ['pip',26,15,60,4],
  ]) {
    const w = weapon(id);
    assert.deepEqual([w.damage,w.magazine,w.reserve,w.interval], [damage,mag,reserve,ticks/30], id);
  }
});
test('semi-auto hold fires once while automatic hold repeats at the reference rate', () => {
  const semi = arena('anchor');
  hold(semi.sim, semi.player, 60);
  assert.equal(semi.player.ammo[0], 14);
  hold(semi.sim, semi.player, 1, false);
  hold(semi.sim, semi.player, 1);
  assert.equal(semi.player.ammo[0], 13);
  const auto = arena('sprinter');
  hold(auto.sim, auto.player, 60);
  assert.equal(auto.player.ammo[0], 20);
});
test('one burst has three shots spaced by 100 ms and holding does not start another', () => {
  const {sim,player} = arena('duet');
  hold(sim,player,60);
  const shots = sim.events.filter(e => e.type === 'shot');
  assert.equal(shots.length, 3);
  for (let n=1;n<3;n++) assert.ok(Math.abs(shots[n].time-shots[n-1].time-0.1)<1/60+1e-8);
  assert.equal(player.ammo[0],21);
});
test('reload uses empty and tactical times and never creates reserve ammo', () => {
  const {sim,player} = arena('sprinter');
  player.ammo[0]=0;
  sim.reload(player);
  assert.ok(Math.abs(player.reloadEnd-sim.time-103/30)<1e-9);
  sim.time=player.reloadEnd;
  sim.tick(1/60);
  assert.deepEqual([player.ammo[0],player.reserve[0]],[30,210]);
  player.ammo[0]=29;
  sim.reload(player);
  assert.ok(Math.abs(player.reloadEnd-sim.time-80/30)<1e-9);
});
test('shotgun fires twenty pellets but consumes one of its two shells', () => {
  const {sim,player} = arena('scatter');
  sim.fire(player);
  assert.equal(sim.projectiles.length,20);
  assert.equal(player.ammo[0],1);
  assert.ok(sim.projectiles.every(b=>b.damage===8.5 && b.gravity===0));
});
test('ammo pickup adds class-specific amounts and stays available at capacity', () => {
  const {sim,player} = arena('sprinter');
  const item = {type:'ammo',x:0,y:0,z:0,availableAt:0};
  sim.pickups=[item];
  sim.collect(player);
  assert.equal(item.availableAt,0);
  player.reserve=[190,20];
  sim.collect(player);
  assert.deepEqual(player.reserve,[220,35]);
  assert.ok(item.availableAt>sim.time);
});
test('rocket only explodes after arming and uses the configured damage', () => {
  const {sim,player} = arena('thumper');
  const rocket={owner:player.id,weapon:'thumper',x:0,y:0.85,z:0,popper:false,travelled:2.9};
  sim.explode(rocket);
  assert.equal(player.health,100);
  rocket.travelled=3;
  sim.explode(rocket);
  assert.ok(Math.abs(player.health-23)<1e-9);
});
test('center damage never exceeds the reference maximum; glancing damage is lower', () => {
  const egg={x:0,y:0,z:0}, direction={x:0,y:0,z:-1};
  assert.equal(shellDamageFactor({x:0,y:0.9,z:0.62},direction,egg),1);
  const rim=shellDamageFactor({x:0.55,y:0.9,z:Math.sqrt(0.62**2-0.55**2)},direction,egg);
  assert.ok(rim>0 && rim<0.2);
});


test('replicated crosshair spread widens on movement and recovers at rest', () => {
  const { sim, player } = arena('sprinter');
  const readSpread = () => sim.snapshot().players.find(p => p.id === player.id).shotSpread;
  hold(sim, player, 10, false);
  const idle = readSpread();
  for (let i = 0; i < 20; i++) {
    sim.setInput(player.id, {seq: player.ack + 1, forward: 1});
    sim.tick(1 / 60);
  }
  assert.ok(readSpread() > idle);
  assert.equal(readSpread(), player.accuracyState[player.slot].spread);
  hold(sim, player, 180, false);
  assert.ok(Math.abs(readSpread() - idle) < 1e-9);
});

test('scoped movement and jumping match stationary accuracy for every blaster', () => {
  for (const id of ['sprinter','scatter','needle','zipper','thumper','anchor','duet','pip']) {
    const { sim, player } = arena(id);
    const moving = structuredClone(player), still = structuredClone(player);
    moving.aim = still.aim = true;
    // Include bloom inherited from moving before entering the scope.
    moving.accuracyState[moving.slot].movement = 0.8;
    for (let i = 0; i < 45; i++) {
      const previous = {x:moving.x,y:moving.y,z:moving.z};
      moving.x += 0.2; moving.y += 0.1;
      sim.updateAccuracy(moving, previous, 1/60);
      sim.updateAccuracy(still, still, 1/60);
      assert.equal(moving.accuracyState[moving.slot].spread, still.accuracyState[still.slot].spread, id);
    }
    moving.aim = false;
    sim.updateAccuracy(moving, {...moving, x:moving.x-0.2}, 1/30);
    assert.ok(moving.accuracyState[moving.slot].spread > still.accuracyState[still.slot].spread, id);
  }
});
