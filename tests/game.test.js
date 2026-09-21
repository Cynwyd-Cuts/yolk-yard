import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MAPS, navigation } from "../src/maps.js";
import {
  movePlayer,
  direction,
  rayEgg,
  isCenterHit,
  wallDistance,
  sanitizeInput,
  muzzleOrigin,
  worldHit,
} from "../src/physics.js";
import { safeProfile, WEAPONS, weapon } from "../src/data.js";
const empty = { size: 30, boxes: [] };
const player = () => ({
  x: 0,
  y: 0,
  z: 0,
  vy: 0,
  yaw: 0,
  pitch: 0,
  health: 100,
  weapon: "sprinter",
  grounded: true,
  crown: null,
});
function fixture(mode = "ffa") {
  const s = new Simulation({ map: "yard", mode, bots: 0, seed: 18 });
  const a = s.addPlayer("a", { name: "Alpha" }),
    b = s.addPlayer("b", { name: "Bravo" });
  s.startRound();
  for (const p of s.players.values()) s.spawn(p);
  s.map = { ...s.map, boxes: [] };
  s.time = 10;
  Object.assign(a, { x: 0, y: 0, z: 8, yaw: 0, pitch: 0, shieldUntil: 0 });
  Object.assign(b, { x: 0, y: 0, z: 0, shieldUntil: 0 });
  return { s, a, b };
}
function advance(s, frames = 12) {
  for (let i = 0; i < frames; i++) s.tick(1 / 60);
}

test("movement has equal diagonal speed and obeys collision walls", () => {
  const a = player(),
    b = player();
  for (let i = 0; i < 60; i++) {
    movePlayer(a, { forward: 1, yaw: 0 }, empty, 1 / 60);
    movePlayer(b, { forward: 1, strafe: 1, yaw: 0 }, empty, 1 / 60);
  }
  assert.ok(Math.abs(Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)) < 0.001);
  const c = player(),
    map = { size: 30, boxes: [{ x: 0, y: 0, z: -3, w: 10, d: 1, h: 3 }] };
  for (let i = 0; i < 180; i++)
    movePlayer(c, { forward: 1, yaw: 0 }, map, 1 / 60);
  assert.ok(c.z >= -2.041);
});
test("jump lands, cannot be held to fly, and steps climb", () => {
  const p = player();
  let high = 0;
  for (let i = 0; i < 120; i++) {
    movePlayer(p, { jump: true }, empty, 1 / 60);
    high = Math.max(high, p.y);
  }
  assert.ok(high > 1.4 && high < 1.6);
  assert.equal(p.y, 0);
  const q = player(),
    map = { size: 30, boxes: [{ x: 0, y: 0, z: -2, w: 4, d: 1, h: 0.4 }] };
  for (let i = 0; i < 13; i++) movePlayer(q, { forward: 1 }, map, 1 / 60);
  assert.ok(q.y >= 0.39);
});
test("ray collision stops at walls and follows positive pitch upward", () => {
  assert.ok(direction(0, 0.3).y > 0);
  const p = player(),
    origin = { x: 0, y: 1.43, z: 8 },
    d = direction(0);
  assert.ok(rayEgg(origin, d, p) < 8);
  assert.equal(
    wallDistance(
      { boxes: [{ x: 0, y: 0, z: 4, w: 3, h: 3, d: 1 }] },
      origin,
      d,
      100,
    ),
    3.5,
  );
});
test("inputs cannot inject movement speed or non-finite coordinates", () => {
  const i = sanitizeInput({
    forward: 400,
    strafe: -500,
    yaw: NaN,
    pitch: Infinity,
    seq: -1,
    slot: 99,
  });
  assert.equal(i.forward, 1);
  assert.equal(i.strafe, -1);
  assert.equal(i.yaw, 0);
  assert.equal(i.pitch, 0);
  assert.equal(i.slot, 0);
  assert.equal(i.seq, 0);
  assert.equal(
    safeProfile({
      name: "<script>\nVery long player name",
      hat: 99,
      weapon: "bad",
    }).hat,
    4,
  );
});
test("server controls hit damage, ammunition, shielding, and respawn", () => {
  const { s, a, b } = fixture();
  a.weapon = "needle";
  a.ammo = [1, 15];
  a.pitch = Math.atan2(0.87 - 1.43, 8);
  b.shieldUntil = 11;
  s.fire(a);
  advance(s, 12);
  assert.equal(b.health, 100);
  assert.equal(a.ammo[0], 0);
  s.time = 12;
  s.reload(a);
  s.time = a.reloadEnd;
  s.tick(1 / 60);
  a.accuracyState = [{}, {}];
  s.fire(a);
  assert.equal(b.health, 100, "Damage waits for the projectile to arrive");
  advance(s, 12);
  assert.equal(b.health, 0);
  assert.equal(b.killerId, a.id);
  assert.equal(a.kills, 1);
  assert.equal(b.deaths, 1);
  assert.equal(a.ammo[0], 0);
  s.time = b.respawnAt + 10;
  s.tick(1 / 60);
  assert.equal(b.health, 0, "death never automatically respawns a human");
  s.playerAction(b.id, "respawn");
  s.tick(1 / 60);
  assert.equal(b.health, 100);
  assert.ok(b.shieldUntil > s.time);
});

test("solid cover blocks shots and friendly fire is disabled", () => {
  const { s, a, b } = fixture();
  s.map.boxes = [{ x: 0, y: 0, z: 4, w: 4, h: 3, d: 1 }];
  s.fire(a);
  advance(s);
  assert.equal(b.health, 100);
  const t = fixture("teams");
  t.b.team = t.a.team;
  t.s.fire(t.a);
  advance(t.s);
  assert.equal(t.b.health, 100);
});
test("reload draws from finite reserves and weapon swapping cancels reload", () => {
  const { s, a } = fixture();
  a.ammo = [3, 12];
  a.reserve = [5, 72];
  s.reload(a);
  s.time = a.reloadEnd;
  s.tick(1 / 60);
  assert.equal(a.ammo[0], 8);
  assert.equal(a.reserve[0], 0);
  a.ammo[0] = 0;
  a.reserve[0] = 30;
  s.reload(a);
  s.setInput("a", { seq: 1, slot: 1 });
  s.tick(1 / 60);
  assert.equal(a.slot, 1);
  assert.equal(a.reloadEnd, 0);
  assert.equal(a.ammo[1], 12);
});
test("repeated or stale network sequence numbers do not move players", () => {
  const { s, a } = fixture();
  s.setInput("a", { seq: 2, forward: 1 });
  s.tick(1 / 60);
  assert.equal(a.ack, 2);
  s.setInput("a", { seq: 1, forward: -1 });
  assert.equal(s.inputs.get("a").forward, 1);
  s.time += 1;
  const z = a.z;
  s.tick(1 / 60);
  assert.equal(a.z, z);
});
test("brief actions survive batched network packets and older queued inputs are rejected", () => {
  const { s, a } = fixture();
  a.ammo[0] = 2;
  s.setInput("a", { seq: 3, reload: true, popper: true });
  s.setInput("a", { seq: 4, reload: false, popper: false });
  s.setInput("a", { seq: 2, forward: 1 });
  assert.equal(s.inputs.get("a").seq, 4);
  s.tick(1 / 60);
  assert.ok(a.reloadEnd > s.time);
  assert.equal(a.poppers, 1);
});
test("capture scores once, resets crown, and disconnect drops a carried crown", () => {
  const { s, a } = fixture("capture");
  a.team = 0;
  const f = s.flags[1];
  Object.assign(a, { x: f.x, z: f.z, y: 0 });
  s.objectives(0.1);
  assert.equal(a.crown, 1);
  assert.equal(f.carrier, "a");
  Object.assign(a, { x: s.flags[0].x, z: s.flags[0].z });
  s.objectives(0.1);
  assert.equal(s.scores[0], 1);
  s.objectives(0.1);
  assert.equal(s.scores[0], 1);
  assert.equal(f.home, true);
  Object.assign(a, { x: f.x, z: f.z });
  s.objectives(0.1);
  s.removePlayer("a");
  assert.equal(f.carrier, null);
  assert.equal(f.home, false);
  s.time += 19;
  s.objectives(0.1);
  assert.equal(f.home, true);
});
test("zone contest stops scoring; owner earns points and round ends", () => {
  const { s, a, b } = fixture("control");
  Object.assign(a, { team: 0, x: 0, y: 2, z: 0 });
  Object.assign(b, { team: 1, x: 0, y: 2, z: 0 });
  s.zone.owner = 0;
  s.objectives(1);
  assert.equal(s.zone.contested, true);
  assert.equal(s.scores[0], 0);
  b.x = 20;
  s.objectives(1);
  assert.equal(s.scores[0], 1);
  s.scores[0] = 90;
  s.tick(1 / 60);
  assert.equal(s.phase, "results");
  assert.equal(s.winner, "Blue team wins");
  s.startRound();
  for (const p of s.players.values()) s.spawn(p);
  assert.equal(s.phase, "playing");
  assert.equal(s.scores[0], 0);
});
test("all maps have safe spawns and connected bot routes", () => {
  for (const map of MAPS) {
    const nav = navigation(map);
    for (const [x, z] of map.spawns) {
      assert.equal(
        map.boxes.some(
          (b) =>
            Math.abs(x - b.x) < b.w / 2 + 0.46 &&
            Math.abs(z - b.z) < b.d / 2 + 0.46,
        ),
        false,
        `${map.id} spawn ${x},${z}`,
      );
      const path = nav.path(
        { x, z },
        { x: map.spawns[0][0], z: map.spawns[0][1] },
      );
      if (x !== map.spawns[0][0] || z !== map.spawns[0][1])
        assert.ok(path.length > 0);
    }
  }
});
test("bots complete full rounds without non-finite state or exceeding room capacity", () => {
  for (const m of ["ffa", "teams", "capture", "control"]) {
    const s = new Simulation({ mode: m, bots: 7, seed: 19 });
    s.addPlayer("host", {});
    s.startRound();
  for (const p of s.players.values()) s.spawn(p);
    for (let i = 0; i < 18001 && s.phase === "playing"; i++) s.tick(1 / 60);
    assert.equal(s.phase, "results");
    assert.equal(s.players.size, 8);
    assert.equal(s.addPlayer("extra", {}), null);
    for (const p of s.players.values()) {
      for (const k of ["x", "y", "z", "health", "yaw", "pitch"])
        assert.ok(Number.isFinite(p[k]), m + ": " + k);
      assert.ok(p.health >= 0 && p.health <= 100);
    }
    const snap = s.snapshot();
    assert.equal(snap.players[0].botPath, undefined);
    JSON.stringify(snap);
  }
});
test("all seven primary classes can fire and serialize projectiles safely", () => {
  for (const w of WEAPONS.filter((w) => !w.secondary)) {
    const { s, a } = fixture();
    a.weapon = w.id;
    a.ammo = [w.magazine, 12];
    s.fire(a);
    assert.equal(a.ammo[0], w.magazine - 1);
    for (let i = 0; i < 180; i++) s.tick(1 / 60);
    assert.ok(Number.isFinite(s.time));
  }
});

test("bolts have finite travel, start at the muzzle, and keep a straight trajectory", () => {
  const { s, a, b } = fixture();
  b.z = -30;
  s.random = () => 0;
  s.fire(a);
  const bolt = s.projectiles[0],
    m = muzzleOrigin(a, weapon(a.weapon));
  assert.ok(Math.abs(bolt.x - m.x) < 1e-8 && Math.abs(bolt.z - m.z) < 1e-8);
  assert.ok(bolt.x > a.x && bolt.z < a.z && bolt.y < a.y + 1.43);
  const y = bolt.y,
    vy = bolt.vy;
  s.updateProjectiles(0.05);
  assert.equal(b.health, 100);
  assert.equal(bolt.vy, vy);
  assert.ok(
    Math.abs(bolt.y - (y + vy * 0.05 - 0.5 * bolt.gravity * 0.05 ** 2)) < 1e-8,
  );
  advance(s, 30);
  assert.equal(b.health, 100, "Target is beyond the 20-unit rifle range");
  assert.equal(s.projectiles.length, 0);
});
test("a low wall can block the muzzle even when the camera can see over it", () => {
  const { s, a, b } = fixture();
  s.map.boxes = [{ x: 0, y: 0, z: 7.1, w: 4, h: 1.3, d: 0.4 }];
  assert.equal(
    wallDistance(s.map, { x: 0, y: 1.43, z: 8 }, direction(0), 20),
    20,
  );
  s.fire(a);
  advance(s);
  assert.equal(b.health, 100);
  assert.equal(s.projectiles.length, 0);
  assert.ok(s.events.some((e) => e.type === "shot" && e.blocked));
});
test("swept bolt collision catches thin cover between simulation ticks", () => {
  const { s, a, b } = fixture();
  s.map.boxes = [{ x: 0, y: 0, z: 3.7, w: 4, h: 3, d: 0.015 }];
  s.fire(a);
  s.projectiles[0].vz = -1200;
  s.updateProjectiles(1 / 60);
  assert.equal(b.health, 100);
  assert.equal(s.projectiles.length, 0);
  const impact = s.events.find((e) => e.type === "impact");
  assert.ok(Math.abs(impact.z - 3.7075) < 0.001);
});
test("poppers reflect the struck surface normal, retain tangential motion, and respect their fuse", () => {
  const { s } = fixture();
  s.map.boxes = [{ x: 1, y: 0, z: 0, w: 0.2, h: 3, d: 10 }];
  const shell = {
    id: 99,
    owner: "a",
    kind: "shell",
    popper: true,
    x: 0,
    y: 1,
    z: 0,
    vx: 20,
    vy: 0,
    vz: 8,
    gravity: 0,
    born: s.time,
    fuse: 2,
    bounces: 0,
  };
  s.projectiles = [shell];
  s.updateProjectiles(0.1);
  assert.ok(shell.vx < 0);
  assert.ok(shell.vz > 0);
  assert.equal(shell.bounces, 1);
  assert.equal(s.projectiles.length, 1);
  s.time += 2.01;
  s.updateProjectiles(1 / 60);
  assert.equal(s.projectiles.length, 0);
  assert.ok(s.events.some((e) => e.type === "explosion"));
});
test("expanded arenas have usable objectives and multi-level navigation", () => {
  for (const map of MAPS) {
    assert.ok(map.size >= 40);
    assert.equal(map.zone[2], 0);
    for (const [x, z] of [...map.bases, [map.zone[0], map.zone[1]]])
      assert.equal(
        map.boxes.some(
          (b) =>
            b.y < 1.75 &&
            Math.abs(x - b.x) < b.w / 2 + 0.46 &&
            Math.abs(z - b.z) < b.d / 2 + 0.46,
        ),
        false,
        `${map.id} objective clear`,
      );
  }
  const map = MAPS.find((m) => m.id === "depot"),
    nav = navigation(map);
  const path = nav.path({ x: -36, y: 0, z: 0 }, { x: -17, y: 3.2, z: 0 });
  assert.ok(path.some((p) => p.y >= 3.15));
  const pass = worldHit(map, { x: 0, y: 1.43, z: 5 }, direction(0), 10);
  assert.equal(pass, null, "Underpass remains clear");
});

test("center hits reward aim without rewarding the shell rim", () => {
  const p = {x:0,y:0,z:0}, d = {x:0,y:0,z:-1};
  assert.equal(isCenterHit({x:0,y:0.87,z:8},d,p),true);
  assert.equal(isCenterHit({x:0.4,y:0.87,z:8},d,p),false);
  assert.equal(isCenterHit({x:0,y:1.5,z:8},d,p),false);
  const {s,a,b} = fixture();
  a.weapon = "needle";
  a.pitch = Math.atan2(0.87-1.43,8);
  s.fire(a);
  advance(s, 12);
  assert.equal(b.health, 0);
  const event=s.events.find(e=>e.type==="hit");
  assert.equal(event.precision,true);
  assert.equal(event.amount,100);
});
test("lethal damage reports remaining health and serializes the killer", () => {
  const {s,a,b}=fixture();
  b.health=9;
  s.damage(b,a,100,"Test",true);
  assert.equal(s.events.find(e=>e.type==="hit").amount,9);
  assert.equal(s.snapshot().players.find(p=>p.id===b.id).killerId,a.id);
});


test("full reserves leave ammo crates available, including with a partial magazine", () => {
  const { s, a } = fixture();
  for (const w of WEAPONS) {
    a.weapon = w.id;
    a.reserve = [w.reserve, weapon("pip").reserve];
    a.ammo = [0, 0];
    const crate = { id: 0, x: a.x, y: a.y, z: a.z, type: "ammo", availableAt: 0 };
    s.pickups = [crate];
    const events = s.events.length;
    s.collect(a);
    assert.equal(crate.availableAt, 0);
    assert.equal(s.events.length, events);
    for (const slot of [0, 1]) {
      a.reserve[slot]--;
      s.collect(a);
      assert.deepEqual(a.reserve, [w.reserve, weapon("pip").reserve]);
      assert.equal(crate.availableAt, s.time + 15);
      crate.availableAt = 0;
    }
  }
});

test("spectators stay out of play and rejoin through a countdown", () => {
  const {s,a,b} = fixture();
  s.playerAction(a.id,"spectate");
  assert.equal(a.spectating,true);
  const pos = [a.x,a.y,a.z];
  s.setInput(a.id,{seq:100,forward:1,fire:true});
  for(let i=0;i<240;i++) s.tick(1/60);
  assert.equal(a.health,0);
  assert.deepEqual([a.x,a.y,a.z],pos);
  assert.equal(s.snapshot().players.find(p=>p.id===a.id).spectating,true);
  assert.equal(a.deaths,0);
  assert.equal(b.kills,0);
  s.playerAction(a.id,"rejoin");
  assert.equal(a.spectating,false);
  assert.equal(a.health,0);
  s.time=a.respawnAt; s.tick(1/60);
  assert.equal(a.health,100);
  assert.ok(a.shieldUntil>s.time);
});
test("manual respawn drops objectives without awarding an elimination", () => {
  const {s,a,b}=fixture("capture");
  a.crown=1; s.flags[1].carrier=a.id;
  s.playerAction(a.id,"respawn");
  assert.equal(a.health,0);
  assert.equal(a.crown,null);
  assert.equal(s.flags[1].carrier,null);
  assert.equal(b.kills,0);
  const ready=a.respawnAt;
  s.playerAction(a.id,"respawn");
  assert.equal(a.respawnAt,ready);
  s.time=ready; s.tick(1/60);
  assert.equal(a.health,100);
});



test("human entrants wait safely for an explicit entry request, bots do not", () => {
  const s = new Simulation({map: "yard", bots: 1});
  const p = s.addPlayer("human", {});
  s.startRound();
  assert.equal(p.health, 0);
  assert.equal(p.awaitingEntry, true);
  for (let i=0; i<300; i++) s.tick(1/60);
  assert.equal(p.health, 0);
  assert.ok([...s.players.values()].some(p => p.bot && p.health > 0));
  s.playerAction(p.id, "rejoin"); s.tick(1/60);
  assert.equal(p.health, 100);
  assert.equal(p.awaitingEntry, false);
  const late = s.addPlayer("late", {});
  assert.equal(late.health, 0);
  s.startRound();
  assert.equal(p.health, 0);
  assert.equal(late.health, 0);
});
