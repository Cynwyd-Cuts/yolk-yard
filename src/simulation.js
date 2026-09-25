import {RemoteInputBuffer} from './remote-input.js';
import {arenaBonuses,resetBonuses,updateBonuses,awardBonus} from './streaks.js';
import {botInput as tacticalBotInput} from './bots.js';
import {beginEquip} from './equip.js';
import {matchOptions} from "./match-options.js";
import {
  VERSION, randomAppearance, nameKey,
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
  muzzleOrigin, canStand,
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
    this.options = matchOptions(options);
    this.map = getMap(this.options.map);
    this.nav = navigation(this.map);
    this.random = rng(options.seed || Date.now());
    this.players = new Map();
    this.inputs = new Map();
    this.remoteInputs = new Map();
    this.events = [];
    this.eventId = 0;
    this.time = 0;
    this.round = 0;
    this.phase = "lobby";
    this.remaining = this.options.minutes * 60;
    this.scores = [0, 0];
    this.projectiles = [];
    this.projectileId = 0;
    this.shotId = 0;
    this.joinOrder = 0;
    this.pickups = [];
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
    if (this.players.size >= (this.maxPlayers || 8)) return null;
    const count = [0, 0];
    for (const p of this.players.values()) count[p.team]++;
    const p = {
      id,
      ...safeProfile(profile),
      bot,
      joinedOrder: ++this.joinOrder,
      botSeed:this.random()*100,
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
    this.players.delete(id);
    this.inputs.delete(id);this.remoteInputs.delete(id);
    this.emit("leave", { name: p.name });
  }
  setProfile(id, profile) {
    const p = this.players.get(id);
    if (!p) return;
    const safe = safeProfile(profile);
    if([...this.players.values()].some(other=>other.id!==id&&!other.bot&&nameKey(other.name)===nameKey(safe.name)))return false;
    for(const other of this.players.values())if(other.id!==id&&other.bot&&nameKey(other.name)===nameKey(safe.name))other.name=this.uniqueBotName(other.name+' Bot');
    p.nextProfile = safe;
    p.name=safe.name;
    if (this.phase === "lobby" || p.health <= 0) Object.assign(p, safe);
    return true;
  }
  setInput(id, input, remote = false) {
    const p = this.players.get(id);
    if (!p || !input || typeof input !== "object") return;
    const safe = sanitizeInput(input),
      previous = this.inputs.get(id);
    if (safe.seq <= Math.max(p.ack, previous?.seq || 0)) return;
    // Track the raw edge before coalescing. A release followed by another tap
    // can share one host tick; OR-ing the buttons alone would erase that edge.
    safe.jumpHeld = safe.jump;
    safe.jumpPress = safe.jump && !previous?.jumpHeld ? safe.seq : previous?.jumpPress || 0;
    if(remote) {
      if(p.health<=0||p.spectating)return;
      let buffer=this.remoteInputs.get(id);
      if(!buffer){buffer=new RemoteInputBuffer();this.remoteInputs.set(id,buffer);}
      if(!buffer.push(safe))return;
      this.inputs.set(id,safe);p.lastInput=this.time;return;
    }
    // Preserve brief button presses when several packets arrive before a simulation tick.
    if (previous && previous.seq > p.ack)
      for (const key of ["reload", "popper", "jump", "fire"])
        safe[key] ||= previous[key];
    this.inputs.set(id, safe);
    p.lastInput = this.time;
  }
  movementInput(p, dt) {
    const buffer=this.remoteInputs.get(p.id);
    if(!buffer)return null;
    const steps=buffer.take(dt);
    let input={...(steps.at(-1)||buffer.last||{yaw:p.yaw,pitch:p.pitch,slot:p.slot})};
    for(const key of ['fire','reload','popper','interact','drop'])
      if(steps.some(step=>step[key]))input[key]=true;
    if(this.time-p.lastInput>.4)input={yaw:p.yaw,pitch:p.pitch,slot:p.slot};
    return {steps,input};
  }
  moveWithCommands(p,input,dt,commands) {
    if(!commands){movePlayer(p,input,this.map,dt);p.ack=Math.max(p.ack,input.seq||0);return;}
    for(const step of commands.steps){movePlayer(p,step,this.map,1/60);p.ack=Math.max(p.ack,step.seq);}
    // After an actual interruption, keep gravity running without inventing input acknowledgements.
    if(!commands.steps.length&&this.time-p.lastInput>.4)movePlayer(p,input,this.map,dt);
  }
  addBots() {
    let i = 0;
    while (
      [...this.players.values()].filter((p) => p.bot).length <
        (this.options.fill ? (this.options.capacity||8) : this.options.bots) &&
      this.players.size < (this.maxPlayers || 8)
    ) {
      const id = "bot-" + i++;
      if (this.players.has(id)) continue;
      this.addPlayer(
        id,
        {
          name: this.uniqueBotName(BOT_NAMES[(i - 1) % BOT_NAMES.length]),
          weapon: WEAPONS[(i + this.round) % 7].id,
          ...randomAppearance(this.random),
        },
        true,
      );
    }
  }
  configure(options) {
    if (this.phase === "playing") return false;
    const next = matchOptions(options);
    for (const p of [...this.players.values()]) if (p.bot) this.removePlayer(p.id);
    this.options = next;
    this.map = getMap(next.map);
    this.nav = navigation(this.map);
    this.remaining = next.minutes * 60;
    return true;
  }
  startRound() {
    this.phase = "playing";
    this.round++;
    this.remaining = this.options.minutes * 60;
    this.scores = [0, 0];
    this.projectiles = [];
    this.winner = "";
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
      p.eggs = 0;
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
    this.inputs.delete(p.id);this.remoteInputs.delete(p.id);
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
    this.inputs.delete(id);this.remoteInputs.delete(id);
    this.projectiles = this.projectiles.filter(b => b.owner !== id);
    p.reloadEnd = 0;
    p.burstLeft = 0;
    p.moving = false;
    resetBonuses(p);
    p.health = 0;
    p.spectating = action === "spectate";
    p.spawnRequested = !p.spectating;
    if (p.spectating) p.killerId = null;
    if (wasAlive || wasSpectating) p.respawnAt = this.time + 3;
    this.emit("player-action", {player: id, action});
  }
  spawn(p) {
    resetBonuses(p);
    if (p.spectating) { p.health = 0; return; }
    if (p.nextProfile) {
      Object.assign(p, p.nextProfile);
      delete p.nextProfile;
    }
    const spot=this.safeSpawn(p);
    if(!spot){p.health=0;p.spawnRequested=true;p.respawnAt=this.time+.5;return;}
    Object.assign(p, spot, {
      vy: 0,
      yaw: spot.yaw,
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
    beginEquip(p,this.time);
    this.inputs.delete(p.id);this.remoteInputs.delete(p.id);
    p.brain = null;
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
      if(arenaBonuses(this.options.mode))updateBonuses(p,this.time,dt);
      const commands = p.bot ? null : this.movementInput(p,dt);
      let input = commands?.input || (p.bot ? this.botInput(p) : this.inputs.get(p.id));
      if (!input || (!p.bot && this.time - p.lastInput > 0.4))
        input = { yaw: p.yaw, pitch: p.pitch, slot: p.slot };
      if (input.slot !== undefined && input.slot !== p.slot) {
        p.slot = input.slot === 1 ? 1 : 0;
        p.reloadEnd = 0;
        p.burstLeft = 0;
        beginEquip(p,this.time,true);
      }
      const previousPosition = { x: p.x, y: p.y, z: p.z };
      this.moveWithCommands(p,input,dt,commands);
      p.vx=(p.x-previousPosition.x)/dt;p.vz=(p.z-previousPosition.z)/dt;
      p.moving = Math.hypot(p.x - previousPosition.x, p.z - previousPosition.z) > 0.001;

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
      if (this.time >= (p.equipUntil || 0) && (input.reload || (input.fire && p.ammo[p.slot] === 0))) this.reload(p);
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
      p.fireLatch = !!input.fire && this.time >= (p.equipUntil || 0);
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

    if (this.remaining <= 0) this.finish();
    const m = mode(this.options.mode);
    if (
      (m.teams && Math.max(...this.scores) >= this.options.scoreLimit) ||
      (!m.teams && [...this.players.values()].some((p) => p.kills >= this.options.scoreLimit))
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
    const eye = { x: p.x, y: p.y + EYE * (p.bodyScale || 1), z: p.z },
      aim = directionOverride || direction(p.yaw, p.pitch);
    let distance = wallDistance(this.map, eye, aim, (w.flightRange??w.range));
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
    let origin = muzzleOrigin(p, w);
    const offset = {
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
    // Retract to the eye when a ledge obstructs the muzzle or the target is
    // closer than the barrel. The eye ray still collides with actual cover.
    if (blocked || distance <= length) origin = eye;
    const delta = {
        x: target.x - origin.x,
        y: target.y - origin.y,
        z: target.z - origin.z,
      },
      len = Math.hypot(delta.x, delta.y, delta.z);
    return {
      origin,
      d: len > 1e-8 ? { x: delta.x / len, y: delta.y / len, z: delta.z / len } : aim,
      blocked: null,
    };
  }
  fire(p, burst = false) {
    const w = gun(p);
    if (p.ammo[p.slot] <= 0 || p.reloadEnd) return;
    if(!burst)p.shotGroup=++this.shotId;
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
        if(path.blocked.box)this.damageWorld?.(path.blocked.box,w.damage);
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
        shotId:p.shotGroup,
        weapon: w.id,
        kind: "bolt",
        ...origin,
        vx: path.d.x * w.boltSpeed,
        vy: path.d.y * w.boltSpeed,
        vz: path.d.z * w.boltSpeed,
        gravity: w.gravity,
        damage: w.damage,
        range: w.flightRange??w.range,
        born: this.time,
        fuse: (w.flightRange??w.range) / w.boltSpeed,
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
      ? { x: p.x, y: p.y + EYE * (p.bodyScale || 1) - 0.15, z: p.z }
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
      shotId:popper?++this.shotId:p.shotGroup,
      weapon: popper ? "popper" : w.id,
      kind: "shell",
      ...origin,
      vx: d.x * speed,
      vy: d.y * speed + (popper ? 4 : 0),
      vz: d.z * speed,
      gravity: popper ? 13 : w.gravity,
      damage: popper ? 150 : w.damage,
      range: w.flightRange??w.range,
      born: this.time,
      fuse: popper ? 2.5 : (w.flightRange??w.range) / w.boltSpeed,
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
      const remaining = b.popper ? Infinity : Math.max(0, (b.range ?? weapon(b.weapon).range) - (b.travelled || 0)),
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
          if (Number.isFinite(t) && t <= distance + 1e-9 && t <= length + 1e-9) {
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
              precision, b.shotId,
            );
          }
          if(!victim&&hit?.box)this.damageWorld?.(hit.box,b.damage);
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
        (b.popper ? 150 : (b.damage ?? weapon(b.weapon).damage)) *
          (1 - distance / (radius * 1.2)) *
          (p === attacker ? 0.55 : 1),
        b.popper ? "Popper" : "Thumper", false, b.shotId,
      );
    }
  }
  damage(victim, attacker, amount, source, precision = false, shotId = null) {
    if (victim.health <= 0 || this.time < victim.shieldUntil) return;
    if(attacker!==victim && attacker && mode(this.options.mode).teams && attacker.team===victim.team)return;
    let absorbed=0;
    if(arenaBonuses(this.options.mode)) {
      if(attacker?.damageUntil>this.time && attacker!==victim)amount*=2;
      if(victim.health<=100){absorbed=Math.min(victim.streakArmor||0,amount);victim.streakArmor-=absorbed;amount-=absorbed;}
    }
    const applied = absorbed + Math.min(victim.health, amount);
    victim.health = Math.max(0, victim.health - amount);
    victim.lastDamage = this.time;
    if(source!=='Storm'||this.time>=(victim.stormFeedbackAt||0)){
    if(source==='Storm')victim.stormFeedbackAt=this.time+.5;
    this.emit("hit", {
      player: attacker?.id,
      target: victim.id,
      amount: applied, shotId,
      sourceX:attacker?.x, sourceY:attacker?.y, sourceZ:attacker?.z,
      x: victim.x, y: victim.y + 2.35, z: victim.z,
      precision,
    });
    }
    if (victim.health > 0) return;
    victim.killerId = attacker && attacker !== victim ? attacker.id : null;
    victim.deaths++;
    resetBonuses(victim);
    victim.respawnAt = this.time + 3;
    victim.spawnRequested = false;
    victim.reloadEnd = 0;
    victim.burstLeft = 0;

    if (attacker && attacker !== victim) {
      attacker.kills++;
      attacker.streak++;
      attacker.points += 100;
      awardBonus(this,attacker);
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
  botInput(p) { return tacticalBotInput(this,p); }
  uniqueBotName(base) {
    let name=base,i=2;while([...this.players.values()].some(p=>nameKey(p.name)===nameKey(name)))name=base+' '+i++;
    return name;
  }
  admitPlayer(id,profile) {
    if(this.players.has(id))return this.players.get(id);
    if([...this.players.values()].some(p=>!p.bot&&nameKey(p.name)===nameKey(profile.name)))return null;
    for(const p of this.players.values())if(p.bot&&nameKey(p.name)===nameKey(profile.name))p.name=this.uniqueBotName(p.name+' Bot');
    const capacity=this.options.capacity||8;
    if(this.players.size>=capacity){const bot=[...this.players.values()].find(p=>p.bot);if(!bot)return null;this.players.delete(bot.id);this.inputs.delete(bot.id);}
    return this.addPlayer(id,profile);
  }
  leavePlayer(id) { this.removePlayer(id); if(this.phase==='playing')this.addBots(); }
  safeSpawn(p) {
    const living=[...this.players.values()].filter(e=>e!==p&&e.health>0&&!e.spectating);
    const candidates=this.map.spawns.map(([x,z])=>({x,z,y:surfaceAt(this.map,x,z)}));
    const spacing=Math.max(5,this.map.size/12);
    for(let x=-this.map.size+4;x<this.map.size-3;x+=spacing)for(let z=-this.map.size+4;z<this.map.size-3;z+=spacing)candidates.push({x,z,y:surfaceAt(this.map,x,z)});
    const teams=mode(this.options.mode).teams;
    let best=null,score=-Infinity;
    for(const q of candidates){
      if(!canStand(this.map,q,.8)||living.some(e=>dist(q,e)<7))continue;
      let clear=0,yaw=0;
      for(let i=0;i<12;i++){const a=i*Math.PI/6,d=wallDistance(this.map,{...q,y:q.y+EYE},direction(a),10);if(d>clear){clear=d;yaw=a;}}
      if(clear<4)continue;
      const nearest=Math.min(45,...living.map(e=>dist(q,e)));
      const value=nearest+clear+(teams&&((q.x<0)===(p.team===0))?8:0)+this.random()*3;
      if(value>score){score=value;best={...q,yaw};}
    }
    return best;
  }
  checkpoint() {
    const skip=new Set(['map','nav','random','players','inputs','remoteInputs','events']);
    const data=Object.fromEntries(Object.entries(this).filter(([key,value])=>!skip.has(key)&&typeof value!=='function'));
    return structuredClone({...data,players:[...this.players.values()],events:this.events,randomState:this.random.state()});
  }
  restore(checkpoint) {
    const {players,randomState,...fields}=structuredClone(checkpoint);
    Object.assign(this,fields);this.players=new Map(players.map(p=>[p.id,p]));this.inputs=new Map();this.remoteInputs=new Map();
    this.map=getMap(this.options.map);this.nav=navigation(this.map);this.random=rng(1);this.random.restore(randomState);
    for(const p of this.players.values()){p.fireLatch=false;p.popperLatch=false;p.lastInput=this.time;}
    return this;
  }
  snapshot() {
    const keys = [
      "id", "joinedOrder", "vx", "vz", "place",
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
      "streak", "eggs", "streakArmor", "damageUntil", "eggsUntil", "miniUntil", "restockUntil", "bodyScale",
      "slot",
      "ammo",
      "reserve",
      "reloadEnd",
      "equipStarted",
      "equipHolster",
      "equipUntil",
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
      players: [...this.players.values()].map((p) => ({
        ...Object.fromEntries(keys.map((k) => [k, Array.isArray(p[k]) ? [...p[k]] : p[k]])),
        shotSpread: p.accuracyState[p.slot]?.spread ?? gun(p).spread * (p.aim ? gun(p).aimSpread : 1),
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
      events: this.events.slice(-60),
    };
  }
}
