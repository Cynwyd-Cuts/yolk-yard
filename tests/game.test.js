import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MAPS, navigation } from "../src/maps.js";
import {
  movePlayer,
  direction,
  rayEgg,
  wallDistance,
  sanitizeInput,
} from "../src/physics.js";
import { safeProfile, WEAPONS } from "../src/data.js";
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
  s.map = { ...s.map, boxes: [] };
  s.time = 10;
  Object.assign(a, { x: 0, y: 0, z: 8, yaw: 0, pitch: 0, shieldUntil: 0 });
  Object.assign(b, { x: 0, y: 0, z: 0, shieldUntil: 0 });
  return { s, a, b };
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
  a.ammo = [5, 12];
  b.shieldUntil = 11;
  s.fire(a);
  assert.equal(b.health, 100);
  s.time = 12;
  s.fire(a);
  assert.equal(b.health, 0);
  assert.equal(a.kills, 1);
  assert.equal(b.deaths, 1);
  assert.equal(a.ammo[0], 3);
  s.time = 15;
  s.tick(1 / 60);
  assert.equal(b.health, 100);
  assert.ok(b.shieldUntil > s.time);
});
test("solid cover blocks shots and friendly fire is disabled", () => {
  const { s, a, b } = fixture();
  s.map.boxes = [{ x: 0, y: 0, z: 4, w: 4, h: 3, d: 1 }];
  s.fire(a);
  assert.equal(b.health, 100);
  const t = fixture("teams");
  t.b.team = t.a.team;
  t.s.fire(t.a);
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
