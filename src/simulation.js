import {
  VERSION,
  WEAPONS,
  weapon,
  gun,
  mode,
  safeProfile,
  clamp,
  rng,
} from "./data.js";
import { getMap, navigation, surfaceAt } from "./maps.js";
import {
  muzzleOrigin,
  worldHit,
  movePlayer,
  sanitizeInput,
  direction,
  wallDistance,
  rayEgg,
  isCenterHit,
  shellDamageFactor,
  dist,
  EYE,
} from "./physics.js";
const BOT_NAMES = [
  "Benedict",
  "Sunny",
  "Omelette",
  "Poach",
  "Frittata",
  "Custard",
  "Scrambles",
];
export class Simulation {
  constructor(options = {}) {
    this.options = {
      map: getMap(options.map).id,
      mode: mode(options.mode).id,
      bots: clamp(Number(options.bots) || 0, 0, 7),
      difficulty: clamp(Number(options.difficulty) || 1, 1, 3),
      minutes: 5,
    };
    this.map = getMap(this.options.map);
    this.nav = navigation(this.map);
    this.random = rng(options.seed || Date.now());
    this.players = new Map();
    this.inputs = new Map();
    this.events = [];
    this.eventId = 0;
    this.time = 0;
    this.round = 0;
    this.phase = "lobby";
    this.remaining = 300;
    this.scores = [0, 0];
    this.projectiles = [];
    this.projectileId = 0;
    this.pickups = [];
    this.flags = [];
    this.zone = { owner: -1, progress: 0, contested: false };
    this.winner = "";
  }
  emit(type, data = {}) {
    const e = { id: ++this.eventId, time: this.time, type, ...data };
    this.events.push(e);
    if (this.events.length > 120) this.events.shift();
    return e;
  }
  addPlayer(id, profile, bot = false) {
    if (this.players.has(id)) return this.players.get(id);
    if (this.players.size >= 8) return null;
    const count = [0, 0];
    for (const p of this.players.values()) count[p.team]++;
    const p = {
      id,
      ...safeProfile(profile),
      bot,
      team: count[0] <= count[1] ? 0 : 1,
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      yaw: 0,
      pitch: 0,
      grounded: true,
      jumpLatch: false,
      health: 100,
      kills: 0,
      deaths: 0,
      assists: 0,
      points: 0,
      streak: 0,
      slot: 0,
      ammo: [0, weapon("pip").magazine],
      reserve: [0, weapon("pip").reserve],
      reloadEnd: 0,
      nextShot: 0,
      burstLeft: 0,
      fireLatch: false,
      accuracyState: [{}, {}],
      burstTime: 0,
      poppers: 2,
      nextPopper: 0,
      shieldUntil: 0,
      lastDamage: -100,
      respawnAt: 0,
      killerId: null,
      crown: null,
      ack: 0,
      lastInput: 0,
    };
    this.players.set(id, p);
    this.spawn(p);
    if (!p.bot) this.waitForEntry(p);
    this.emit("join", { player: id, name: p.name });
    return p;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.dropFlag(p);
    this.players.delete(id);
    this.inputs.delete(id);
    this.emit("leave", { name: p.name });
  }
  setProfile(id, profile) {
    const p = this.players.get(id);
    if (!p) return;
    const safe = safeProfile(profile);
    p.nextProfile = safe;
    if (this.phase === "lobby" || p.health <= 0) Object.assign(p, safe);
  }
  setInput(id, input) {
    const p = this.players.get(id);
    if (!p || !input || typeof input !== "object") return;
    const safe = sanitizeInput(input),
      previous = this.inputs.get(id);
    if (safe.seq <= Math.max(p.ack, previous?.seq || 0)) return;
    // Preserve brief button presses when several packets arrive before a simulation tick.
    if (previous && previous.seq > p.ack)
      for (const key of ["reload", "popper", "jump", "fire"])
        safe[key] ||= previous[key];
    this.inputs.set(id, safe);
    p.lastInput = this.time;
  }
  addBots() {
    let i = 0;
    while (
      [...this.players.values()].filter((p) => p.bot).length <
        this.options.bots &&
      this.players.size < 8
    ) {
      const id = "bot-" + i++;
      if (this.players.has(id)) continue;
      this.addPlayer(
        id,
        {
          name: BOT_NAMES[(i - 1) % BOT_NAMES.length],
          weapon: WEAPONS[(i + this.round) % 7].id,
          color: ["#fff6da", "#ee897b", "#72cfdd", "#b7a1ec"][i % 4],
          hat: i % 5,
        },
        true,
      );
    }
  }
  startRound() {
    this.phase = "playing";
    this.round++;
    this.remaining = this.options.minutes * 60;
    this.scores = [0, 0];
    this.projectiles = [];
    this.winner = "";
    this.zone = { owner: -1, progress: 0, contested: false };
    this.flags = this.map.bases.map(([x, z], team) => ({
      team,
      x,
      y: 0,
      z,
      home: true,
      carrier: null,
      returnAt: 0,
    }));
    this.pickups = this.map.pickups.map(([x, z, type], id) => ({
      id,
      x,
      z,
      y: surfaceAt(this.map, x, z),
      type,
      availableAt: 0,
    }));
    this.addBots();
    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.points = 0;
      p.assists = 0;
      p.streak = 0;
      this.spawn(p);
      if (!p.bot) this.waitForEntry(p);
    }
    this.emit("round", { round: this.round });
  }
  waitForEntry(p) {
    p.health = 0;
    p.awaitingEntry = true;
    p.spawnRequested = false;
    p.respawnAt = 0;
    p.killerId = null;
    p.nextPlayerAction = 0;
    this.inputs.delete(p.id);
  }
  playerAction(id, action) {
    const p = this.players.get(id);
    if (!p || p.bot || this.phase !== "playing" ||
        this.time < (p.nextPlayerAction || 0)) return;
    if (!["respawn", "spectate", "rejoin"].includes(action)) return;
    if (action === "rejoin" && !p.spectating && !p.awaitingEntry) return;
    if (action === "respawn" && p.spectating) return;
    p.nextPlayerAction = this.time + 1;
    const wasAlive = p.health > 0;
    const wasSpectating = p.spectating;
    this.dropFlag(p);
    this.inputs.delete(id);
    this.projectiles = this.projectiles.filter(b => b.owner !== id);
    p.reloadEnd = 0;
    p.burstLeft = 0;
    p.moving = false;
    p.health = 0;
    p.spectating = action === "spectate";
    p.spawnRequested = !p.spectating;
    if (p.spectating) p.killerId = null;
    if (wasAlive || wasSpectating) p.respawnAt = this.time + 3;
    this.emit("player-action", {player: id, action});
  }
  spawn(p) {
    if (p.spectating) { p.health = 0; return; }
    if (p.nextProfile) {
      Object.assign(p, p.nextProfile);
      delete p.nextProfile;
    }
    const teams = mode(this.options.mode).teams;
    let spots = this.map.spawns.map(([x, z]) => ({ x, y: 0, z }));
    if (teams)
      spots = spots.filter((s) => (p.team === 0 ? s.x <= 0 : s.x >= 0));
    const enemies = [...this.players.values()].filter(
      (e) => e !== p && e.health > 0 && (!teams || e.team !== p.team),
    );
    spots.sort((a, b) => {
      const score = (s) => Math.min(100, ...enemies.map((e) => dist(s, e)));
      return score(b) - score(a);
    });
    const spot = spots[
      Math.floor(this.random() * Math.min(2, spots.length))
    ] || { x: 0, y: 0, z: 0 };
    Object.assign(p, spot, {
      vy: 0,
      yaw: Math.atan2(spot.x, spot.z),
      pitch: 0,
      grounded: true,
      jumpLatch: false,
      health: 100,
      awaitingEntry: false,
      spawnRequested: false,
      slot: 0,
      ammo: [weapon(p.weapon).magazine, weapon("pip").magazine],
      reserve: [weapon(p.weapon).reserve, weapon("pip").reserve],
      reloadEnd: 0,
      nextShot: this.time + 0.3,
      burstLeft: 0,
      fireLatch: false,
      accuracyState: [{}, {}],
      poppers: 2,
      nextPopper: 0,
      shieldUntil: this.time + 2.3,
      lastDamage: this.time,
      respawnAt: 0,
      killerId: null,
      crown: null,
    });
    this.inputs.delete(p.id);
    p.botPath = [];
    p.botThink = 0;
    p.botTarget = null;
    this.emit("spawn", { player: p.id, x: p.x, y: p.y, z: p.z });
  }
  tick(dt) {
    dt = clamp(dt, 0, 1 / 30);
    this.time += dt;
    if (this.phase !== "playing") return;
    this.remaining = Math.max(0, this.remaining - dt);
    for (const p of this.players.values()) {
      if (p.spectating) continue;
      if (p.health <= 0) {
        if ((p.bot || p.spawnRequested) && this.time >= p.respawnAt) this.spawn(p);
        continue;
      }
      let input = p.bot ? this.botInput(p) : this.inputs.get(p.id);
      if (!input || (!p.bot && this.time - p.lastInput > 0.4))
        input = { yaw: p.yaw, pitch: p.pitch, slot: p.slot };
      if (input.slot !== undefined && input.slot !== p.slot) {
        p.slot = input.slot;
        p.reloadEnd = 0;
        p.burstLeft = 0;
        p.nextShot = Math.max(p.nextShot, this.time + 0.2);
      }
      const previousPosition = { x: p.x, y: p.y, z: p.z };
      movePlayer(p, input, this.map, dt);
      p.moving = Math.hypot(p.x - previousPosition.x, p.z - previousPosition.z) > 0.001;
      p.ack = Math.max(p.ack, input.seq || 0);
      p.aim = !!input.aim;
      this.updateAccuracy(p, previousPosition, dt);
      if (this.time - p.lastDamage > 6 && p.health < 100)
        p.health = Math.min(100, p.health + 8 * dt);
      if (p.reloadEnd && this.time >= p.reloadEnd) {
        const add = Math.min(
          gun(p).magazine - p.ammo[p.slot],
          p.reserve[p.slot],
        );
        p.ammo[p.slot] += add;
        p.reserve[p.slot] -= add;
        p.reloadEnd = 0;
      }
      if (input.reload || (input.fire && p.ammo[p.slot] === 0)) this.reload(p);
      if (p.burstLeft && this.time >= p.burstTime) {
        this.fire(p, true);
        p.burstLeft--;
        p.burstTime += gun(p).burstInterval;
      }
      if (
        input.fire &&
        this.time + 1e-9 >= p.nextShot &&
        (gun(p).automatic || !p.fireLatch || p.bot) &&
        !p.burstLeft &&
        !p.reloadEnd &&
        p.ammo[p.slot] > 0
      ) {
        this.fire(p);
        const w = gun(p);
        p.nextShot = this.time + w.interval;
        if (w.burst) {
          p.burstLeft = w.burst - 1;
          p.burstTime = this.time + w.burstInterval;
        }
      }
      p.fireLatch = !!input.fire;
      if (
        input.popper &&
        !p.popperLatch &&
        p.poppers > 0 &&
        this.time >= p.nextPopper
      ) {
        p.poppers--;
        p.nextPopper = this.time + 1;
        this.launch(p, true);
        p.shieldUntil = 0;
      }
      p.popperLatch = !!input.popper;
      this.collect(p);
    }
    this.updateProjectiles(dt);
    this.objectives(dt);
    if (this.remaining <= 0) this.finish();
    const m = mode(this.options.mode);
    if (
      (m.teams && Math.max(...this.scores) >= m.limit) ||
      (!m.teams && [...this.players.values()].some((p) => p.kills >= m.limit))
    )
      this.finish();
  }
  reload(p) {
    if (
      p.reloadEnd ||
      p.reserve[p.slot] <= 0 ||
      p.ammo[p.slot] >= gun(p).magazine
    )
      return;
    p.reloadEnd = this.time + (p.ammo[p.slot] === 0 ? gun(p).reloadEmpty : gun(p).reload);
    p.burstLeft = 0;
    this.emit("reload", { player: p.id });
  }
  updateAccuracy(p, previous, dt) {
    const w = gun(p), a = p.accuracyState[p.slot];
    a.shot ??= w.spread;
    a.movement ??= 0;
    a.recovery ??= w.spreadRecovery;
    a.clock = (a.clock || 0) + dt;
    // Accuracy is updated at the reference game's 30 Hz rate.
    const planar = Math.hypot(p.x - previous.x, p.z - previous.z) / Math.max(dt, 1e-9);
    const vertical = Math.abs(p.y - previous.y) / Math.max(dt, 1e-9);
    const moving = Math.min(1, planar / w.speed) + Math.min(1, vertical / w.speed);
    const target = ((p.aim ? 0 : moving) + (p.reloadEnd && w.id !== "needle" ? 1 : 0)) * w.spreadMax;
    // Scoping immediately removes accumulated movement bloom, including jumps.
    // Reload instability and firing bloom retain their normal behavior.
    if (p.aim && !a.wasAiming) a.movement = target;
    a.wasAiming = p.aim;
    const ads = p.aim ? w.aimSpread : 1;
    while (a.clock + 1e-9 >= 1 / 30) {
      a.clock -= 1 / 30;
      a.movement = Math.max(target, a.movement - w.spreadRecovery);
      a.recovery = Math.min(w.spreadRecovery, a.recovery + w.spreadRecovery);
      a.shot = Math.max(w.spread * ads, a.shot - Math.max(0, a.recovery));
    }
    a.spread = a.movement * w.movementSpread + a.shot;
    if (w.projectile) a.spread = Math.min(0.3, a.spread);
  }
  shotPath(p, w, directionOverride = null) {
    const eye = { x: p.x, y: p.y + EYE, z: p.z },
      aim = directionOverride || direction(p.yaw, p.pitch);
    let distance = wallDistance(this.map, eye, aim, w.range);
    for (const target of this.players.values())
      if (
        target !== p &&
        target.health > 0 &&
        (!mode(this.options.mode).teams || target.team !== p.team)
      )
        distance = Math.min(distance, rayEgg(eye, aim, target));
    const target = {
      x: eye.x + aim.x * distance,
      y: eye.y + aim.y * distance,
      z: eye.z + aim.z * distance,
    };
    const origin = muzzleOrigin(p, w),
      offset = {
        x: origin.x - eye.x,
        y: origin.y - eye.y,
        z: origin.z - eye.z,
      },
      length = Math.hypot(offset.x, offset.y, offset.z);
    const blocked = worldHit(
      this.map,
      eye,
      { x: offset.x / length, y: offset.y / length, z: offset.z / length },
      length,
    );
    const delta = {
        x: target.x - origin.x,
        y: target.y - origin.y,
        z: target.z - origin.z,
      },
      len = Math.hypot(delta.x, delta.y, delta.z) || 1;
    return {
      origin,
      d: { x: delta.x / len, y: delta.y / len, z: delta.z / len },
      blocked,
    };
  }
  fire(p, burst = false) {
    const w = gun(p);
    if (p.ammo[p.slot] <= 0 || p.reloadEnd) return;
    p.ammo[p.slot]--;
    p.shieldUntil = 0;
    const accuracy = p.accuracyState[p.slot];
    const spread = accuracy.spread ?? w.spread * (p.aim ? w.aimSpread : 1);
    accuracy.shot = Math.min((accuracy.shot ?? w.spread) + w.shotBloom * (p.aim ? w.aimSpread : 1), w.spreadMax * (p.aim ? w.aimSpread : 1));
    accuracy.recovery = -8 * w.spreadRecovery;
    if (w.projectile) {
      this.launch(p, false, spread);
      return;
    }
    const shots = [];
    let origin = muzzleOrigin(p, w),
      blocked = false;
    for (let i = 0; i < w.pellets; i++) {
      // Rifle spread is angular; the shotgun disperses twenty independent pellets.
      const yawSpread = (this.random() - 0.5) * spread * (w.pellets > 1 ? 2 : 1);
      const pitchSpread = (this.random() - 0.5) * spread * (w.pellets > 1 ? 1.2 : 1);
      const aim = direction(p.yaw + yawSpread, p.pitch + pitchSpread);
      const path = this.shotPath(p, w, aim);
      origin = path.origin;
      if (path.blocked) {
        blocked = true;
        if (i === 0)
          this.emit("impact", {
            ...path.blocked.point,
            normal: path.blocked.normal,
            weapon: w.id,
          });
        continue;
      }
      const b = {
        id: ++this.projectileId,
        owner: p.id,
        weapon: w.id,
        kind: "bolt",
        ...origin,
        vx: path.d.x * w.boltSpeed,
        vy: path.d.y * w.boltSpeed,
        vz: path.d.z * w.boltSpeed,
        gravity: w.gravity,
        damage: w.damage,
        born: this.time,
        fuse: w.range / w.boltSpeed,
        travelled: 0,
        popper: false,
      };
      this.projectiles.push(b);
      shots.push({ id: b.id, vx: b.vx, vy: b.vy, vz: b.vz });
    }
    this.emit("shot", { player: p.id, weapon: w.id, origin, shots, blocked });
  }
  launch(p, popper, spread = 0) {
    const w = gun(p),
      aim = direction(p.yaw + (this.random() - 0.5) * spread, p.pitch + (this.random() - 0.5) * spread),
      path = this.shotPath(p, w, aim),
      d = popper ? direction(p.yaw, p.pitch) : path.d;
    const origin = popper
      ? { x: p.x, y: p.y + EYE - 0.15, z: p.z }
      : path.origin;
    if (!popper && path.blocked) {
      this.emit("impact", {
        ...path.blocked.point,
        normal: path.blocked.normal,
        weapon: w.id,
      });
      this.emit("launch", {
        player: p.id,
        popper,
        weapon: w.id,
        origin,
        blocked: true,
      });
      return;
    }
    const speed = popper ? 15 : w.boltSpeed;
    this.projectiles.push({
      id: ++this.projectileId,
      owner: p.id,
      weapon: popper ? "popper" : w.id,
      kind: "shell",
      ...origin,
      vx: d.x * speed,
      vy: d.y * speed + (popper ? 4 : 0),
      vz: d.z * speed,
      gravity: popper ? 13 : w.gravity,
      born: this.time,
      fuse: popper ? 2.5 : w.range / w.boltSpeed,
      travelled: 0,
      popper,
      bounces: 0,
      resting: false,
    });
    this.emit("launch", { player: p.id, popper, weapon: w.id, origin });
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      if (b.popper ? this.time - b.born >= b.fuse : this.time - b.born > b.fuse + dt + 1e-9) {
        if (b.kind !== "bolt") this.explode(b);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (b.resting) continue;
      const dy = b.vy * dt - 0.5 * b.gravity * dt * dt;
      b.vy -= b.gravity * dt;
      const remaining = b.popper ? Infinity : Math.max(0, weapon(b.weapon).range - (b.travelled || 0)),
        fraction = Math.min(1, remaining / (Math.hypot(b.vx * dt, dy, b.vz * dt) || 1)),
        delta = { x: b.vx * dt * fraction, y: dy * fraction, z: b.vz * dt * fraction },
        length = Math.hypot(delta.x, delta.y, delta.z);
      if (length < 1e-8) {
        if (!b.popper && b.kind !== "bolt") this.explode(b);
        if (!b.popper) this.projectiles.splice(i, 1);
        continue;
      }
      const d = {
        x: delta.x / length,
        y: delta.y / length,
        z: delta.z / length,
      };
      const hit = worldHit(
        this.map,
        b,
        d,
        length,
        b.kind === "bolt" ? 0 : 0.14,
      );
      let distance = hit?.distance ?? length,
        victim = null;
      const attacker = this.players.get(b.owner);
      if (!b.popper)
        for (const p of this.players.values()) {
          if (
            p.id === b.owner ||
            p.health <= 0 ||
            (attacker &&
              mode(this.options.mode).teams &&
              p.team === attacker.team)
          )
            continue;
          const t = rayEgg(b, d, p);
          if (t < distance) {
            distance = t;
            victim = p;
          }
        }
      b.x += d.x * distance;
      b.y += d.y * distance;
      b.z += d.z * distance;
      b.travelled = (b.travelled || 0) + distance;
      if (victim || hit) {
        if (b.kind === "bolt") {
          if (victim) {
            const precision = isCenterHit(b, d, victim),
              w = weapon(b.weapon),
              hitFactor = shellDamageFactor(b, d, victim);
            this.damage(
              victim,
              attacker,
              b.damage * hitFactor,
              w.name,
              precision,
            );
          }
          this.emit("impact", {
            x: b.x,
            y: b.y,
            z: b.z,
            normal: victim ? { x: -d.x, y: -d.y, z: -d.z } : hit.normal,
            weapon: b.weapon,
            tag: !!victim,
          });
          this.projectiles.splice(i, 1);
        } else if (b.popper) {
          const n = hit.normal,
            dot = b.vx * n.x + b.vy * n.y + b.vz * n.z;
          b.vx = (b.vx - 1.58 * dot * n.x) * 0.82;
          b.vy = (b.vy - 1.58 * dot * n.y) * 0.82;
          b.vz = (b.vz - 1.58 * dot * n.z) * 0.82;
          b.x += n.x * 0.012;
          b.y += n.y * 0.012;
          b.z += n.z * 0.012;
          b.bounces++;
          if (n.y > 0.5 && Math.hypot(b.vx, b.vy, b.vz) < 1.5) {
            b.resting = true;
            b.vx = b.vy = b.vz = 0;
          }
          this.emit("bounce", { x: b.x, y: b.y, z: b.z, normal: n });
        } else {
          this.explode(b);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }
  explode(b) {
    const attacker = this.players.get(b.owner),
      radius = b.popper ? 3 : weapon(b.weapon).splashRadius;
    if (!b.popper && (b.travelled || 0) < weapon(b.weapon).minRange) return;
    this.emit("explosion", { x: b.x, y: b.y, z: b.z, popper: b.popper });
    for (const p of this.players.values()) {
      if (
        p.health <= 0 ||
        (attacker &&
          p !== attacker &&
          mode(this.options.mode).teams &&
          p.team === attacker.team)
      )
        continue;
      const to = { x: p.x - b.x, y: p.y + 0.85 - b.y, z: p.z - b.z },
        distance = Math.hypot(to.x, to.y, to.z);
      if (distance > radius) continue;
      const d = {
        x: to.x / (distance || 1),
        y: to.y / (distance || 1),
        z: to.z / (distance || 1),
      };
      if (wallDistance(this.map, b, d, distance) < distance - 0.2) continue;
      this.damage(
        p,
        attacker,
        (b.popper ? 150 : weapon(b.weapon).damage) *
          (1 - distance / (radius * 1.2)) *
          (p === attacker ? 0.55 : 1),
        b.popper ? "Popper" : "Thumper",
      );
    }
  }
  damage(victim, attacker, amount, source, precision = false) {
    if (victim.health <= 0 || this.time < victim.shieldUntil) return;
    const applied = Math.min(victim.health, amount);
    victim.health = Math.max(0, victim.health - amount);
    victim.lastDamage = this.time;
    this.emit("hit", {
      player: attacker?.id,
      target: victim.id,
      amount: Math.round(applied),
      x: victim.x, y: victim.y + 2.35, z: victim.z,
      precision,
    });
    if (victim.health > 0) return;
    victim.killerId = attacker && attacker !== victim ? attacker.id : null;
    victim.deaths++;
    victim.streak = 0;
    victim.respawnAt = this.time + 3;
    victim.spawnRequested = false;
    victim.reloadEnd = 0;
    victim.burstLeft = 0;
    this.dropFlag(victim);
    if (attacker && attacker !== victim) {
      attacker.kills++;
      attacker.streak++;
      attacker.points += 100;
      if (this.options.mode === "teams") this.scores[attacker.team]++;
    }
    this.emit("elimination", {
      player: attacker?.id,
      target: victim.id,
      name: attacker?.name || "Arena",
      targetName: victim.name,
      weapon: source,
      x: victim.x,
      y: victim.y,
      z: victim.z,
      streak: attacker?.streak || 0,
    });
  }
  collect(p) {
    for (const item of this.pickups) {
      if (this.time < item.availableAt || dist(p, item) > 1.65) continue;
      if (item.type === "health") {
        if (p.health >= 100) continue;
        p.health = Math.min(100, p.health + 45);
      }
      if (item.type === "ammo") {
        const loadout = [weapon(p.weapon), weapon("pip")];
        if (loadout.every((w, slot) => p.reserve[slot] >= w.reserve)) continue;
        p.reserve = loadout.map((w, slot) => Math.min(w.reserve, p.reserve[slot] + w.ammoPickup));

      }
      if (item.type === "popper") {
        if (p.poppers >= 3) continue;
        p.poppers++;
      }
      item.availableAt = this.time + 15;
      this.emit("pickup", { player: p.id, kind: item.type });
    }
  }
  dropFlag(p) {
    if (p.crown === null) return;
    const f = this.flags[p.crown];
    if (f) {
      Object.assign(f, {
        carrier: null,
        x: p.x,
        y: p.y,
        z: p.z,
        home: false,
        returnAt: this.time + 18,
      });
    }
    p.crown = null;
  }
  resetFlag(f) {
    const [x, z] = this.map.bases[f.team];
    Object.assign(f, { x, y: 0, z, home: true, carrier: null, returnAt: 0 });
  }
  objectives(dt) {
    if (this.options.mode === "capture") {
      for (const f of this.flags) {
        if (f.carrier) {
          const p = this.players.get(f.carrier);
          if (p) {
            f.x = p.x;
            f.y = p.y;
            f.z = p.z;
          }
        } else if (!f.home && this.time >= f.returnAt) this.resetFlag(f);
      }
      for (const p of this.players.values()) {
        if (p.health <= 0) continue;
        const own = this.flags[p.team],
          other = this.flags[1 - p.team];
        if (!own.home && !own.carrier && dist(p, own) < 1.7) {
          this.resetFlag(own);
          p.points += 30;
          this.emit("notice", { text: p.name + " returned the crown" });
        }
        if (!other.carrier && dist(p, other) < 1.7) {
          other.carrier = p.id;
          other.home = false;
          p.crown = other.team;
          p.shieldUntil = 0;
          this.emit("notice", { text: p.name + " took the crown" });
        }
        const [bx, bz] = this.map.bases[p.team];
        if (
          p.crown !== null &&
          own.home &&
          Math.hypot(p.x - bx, p.z - bz) < 2
        ) {
          this.scores[p.team]++;
          p.points += 200;
          this.resetFlag(other);
          p.crown = null;
          this.emit("notice", { text: p.name + " captured a crown!" });
        }
      }
    }
    if (this.options.mode === "control") {
      const [x, z, y] = this.map.zone,
        inside = [...this.players.values()].filter(
          (p) =>
            p.health > 0 &&
            Math.hypot(p.x - x, p.z - z) < 5.5 &&
            Math.abs(p.y - y) < 3,
        ),
        teams = new Set(inside.map((p) => p.team));
      this.zone.contested = teams.size > 1;
      if (teams.size === 1) {
        const team = [...teams][0];
        if (this.zone.owner !== team) {
          this.zone.progress += dt / 3;
          if (this.zone.progress >= 1) {
            this.zone.owner = team;
            this.zone.progress = 0;
            this.emit("notice", {
              text: (team === 0 ? "Blue" : "Coral") + " took the sunny side",
            });
          }
        } else {
          this.scores[team] += dt;
          for (const p of inside) p.points += dt * 5;
        }
      } else this.zone.progress = Math.max(0, this.zone.progress - dt / 3);
    }
  }
  finish() {
    if (this.phase !== "playing") return;
    this.phase = "results";
    if (mode(this.options.mode).teams)
      this.winner =
        this.scores[0] === this.scores[1]
          ? "A perfect tie"
          : this.scores[0] > this.scores[1]
            ? "Blue team wins"
            : "Coral team wins";
    else {
      const sorted = [...this.players.values()].sort(
        (a, b) => b.kills - a.kills,
      );
      this.winner =
        !sorted[0] || sorted[0].kills === sorted[1]?.kills
          ? "A perfect tie"
          : sorted[0].name + " wins";
    }
    this.emit("finish", { winner: this.winner });
  }
  botInput(p) {
    const enemies = [...this.players.values()].filter(
      (e) =>
        e !== p &&
        e.health > 0 &&
        (!mode(this.options.mode).teams || e.team !== p.team),
    );
    enemies.sort((a, b) => dist(p, a) - dist(p, b));
    let target = enemies[0];
    let goal = target || { x: 0, z: 0 };
    if (this.options.mode === "capture") {
      const f = this.flags[p.crown === null ? 1 - p.team : p.team];
      goal = { x: f.x, z: f.z };
    } else if (
      this.options.mode === "control" &&
      Math.hypot(p.x - this.map.zone[0], p.z - this.map.zone[1]) > 4
    )
      goal = { x: this.map.zone[0], z: this.map.zone[1] };
    if (p.botThink <= this.time) {
      p.botPath = this.nav.path(p, goal);
      p.botThink = this.time + 0.9 + this.random() * 0.4;
    }
    while (
      p.botPath?.length &&
      Math.hypot(p.botPath[0].x - p.x, p.botPath[0].z - p.z) < 0.55
    )
      p.botPath.shift();
    let waypoint = p.botPath?.[0] || goal,
      moveX = waypoint.x - p.x,
      moveZ = waypoint.z - p.z,
      moveLength = Math.hypot(moveX, moveZ),
      yaw = p.yaw,
      pitch = 0,
      fire = false;
    if (target) {
      const to = {
          x: target.x - p.x,
          y: target.y + 0.9 - p.y - EYE,
          z: target.z - p.z,
        },
        distance = Math.hypot(to.x, to.y, to.z),
        d = { x: to.x / distance, y: to.y / distance, z: to.z / distance };
      const visible =
        wallDistance(this.map, { x: p.x, y: p.y + EYE, z: p.z }, d, distance) >=
        distance - 0.4;
      if (visible && distance < 65) {
        const aimError = (4 - this.options.difficulty) * 0.018;
        yaw =
          Math.atan2(-to.x, -to.z) +
          Math.sin(this.time * 2.1 + p.team) * aimError;
        pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
        fire = this.time % 1.3 < 0.3 + this.options.difficulty * 0.21;
        if (distance < 8) {
          moveX = -to.z;
          moveZ = to.x;
          moveLength = Math.hypot(moveX, moveZ);
        }
      } else yaw = Math.atan2(-moveX, -moveZ);
    } else yaw = Math.atan2(-moveX, -moveZ);
    if (moveLength > 0) {
      moveX /= moveLength;
      moveZ /= moveLength;
    }
    return {
      yaw,
      pitch,
      forward: -Math.sin(yaw) * moveX - Math.cos(yaw) * moveZ,
      strafe: Math.cos(yaw) * moveX - Math.sin(yaw) * moveZ,
      fire,
      aim: gun(p).optic === "scope",
      reload: p.ammo[p.slot] === 0,
      jump: this.time % 2.2 < 0.04,
      popper: false,
      slot: p.reserve[0] === 0 && p.ammo[0] === 0 ? 1 : 0,
    };
  }
  snapshot() {
    const keys = [
      "id",
      "name",
      "weapon",
      "color",
      "hat",
      "pattern",
      "finish",
      "eyewear",
      "accent",
      "bot",
      "team",
      "x",
      "y",
      "z",
      "vy",
      "yaw",
      "pitch",
      "grounded",
      "jumpLatch",
      "health",
      "kills",
      "deaths",
      "points",
      "streak",
      "slot",
      "ammo",
      "reserve",
      "reloadEnd",
      "poppers",
      "shieldUntil",
      "respawnAt",
      "killerId",
      "spectating",
      "awaitingEntry",
      "spawnRequested",
      "moving",
      "crown",
      "ack",
      "aim",
    ];
    return {
      version: VERSION,
      time: this.time,
      round: this.round,
      phase: this.phase,
      options: this.options,
      remaining: this.remaining,
      scores: this.scores.map((v) => Math.floor(v)),
      winner: this.winner,
      zone: { ...this.zone },
      players: [...this.players.values()].map((p) => ({
        ...Object.fromEntries(keys.map((k) => [k, Array.isArray(p[k]) ? [...p[k]] : p[k]])),
        shotSpread: p.accuracyState[p.slot].spread ?? gun(p).spread * (p.aim ? gun(p).aimSpread : 1),
      })),
      projectiles: this.projectiles.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        z: b.z,
        popper: b.popper,
        kind: b.kind,
        weapon: b.weapon,
        owner: b.owner,
        vx: b.vx,
        vy: b.vy,
        vz: b.vz,
      })),
      pickups: this.pickups.map((p) => ({ ...p })),
      flags: this.flags.map((f) => ({ ...f })),
      events: this.events.slice(-60),
    };
  }
}


