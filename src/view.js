import * as THREE from "three";
import { getMap } from "./maps.js";
import { gun, weapon, TEAM_COLORS, mode, clamp } from "./data.js";
import { EYE } from "./physics.js";
const palette = {
  sand: 0xe9d9b2,
  stone: 0xd4d5c6,
  navy: 0x31566a,
  blue: 0x399bba,
  coral: 0xe37b61,
  crate: 0xad8961,
  gold: 0xe5b844,
  terracotta: 0xd58f72,
};
const materials = new Map(),
  boxGeo = new THREE.BoxGeometry(1, 1, 1),
  sphereGeo = new THREE.SphereGeometry(1, 16, 12);
function mat(color) {
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
    );
  return materials.get(color);
}
function block(parent, x, y, z, w, h, d, color) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ball(parent, x, y, z, rx, ry, rz, color) {
  const m = new THREE.Mesh(sphereGeo, mat(color));
  m.position.set(x, y, z);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cylinder(parent, x, y, z, radius, height, color, segments = 16) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    mat(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function makeBlaster(id) {
  const w = weapon(id),
    group = new THREE.Group(),
    c = w.color;
  block(group, 0, 0, 0, 0.24, 0.23, 0.63, c);
  block(group, 0, -0.15, 0.14, 0.14, 0.23, 0.18, 0x273f50);
  block(group, 0, 0.14, 0.05, 0.17, 0.075, 0.34, 0x273f50);
  const barrel = cylinder(
    group,
    0,
    0.01,
    -0.46,
    w.projectile ? 0.15 : 0.065,
    w.projectile ? 0.32 : 0.42,
    0x25475a,
  );
  barrel.rotation.x = Math.PI / 2;
  const ring = cylinder(
    group,
    0,
    0.01,
    -0.68,
    w.projectile ? 0.17 : 0.095,
    0.075,
    0xffcc47,
  );
  ring.rotation.x = Math.PI / 2;
  const tip = cylinder(
    group,
    0,
    0.01,
    -0.73,
    w.projectile ? 0.11 : 0.06,
    0.01,
    0x182c39,
  );
  tip.rotation.x = Math.PI / 2;
  if (w.id === "needle") {
    const scope = cylinder(group, 0, 0.23, -0.04, 0.075, 0.26, 0x234457);
    scope.rotation.x = Math.PI / 2;
    block(group, 0, 0.06, -0.85, 0.05, 0.055, 0.4, 0x234457);
  }
  if (w.id === "anchor")
    block(group, 0, -0.15, -0.08, 0.31, 0.22, 0.26, 0x243f50);
  if (w.id === "scatter") {
    const b = cylinder(group, 0.1, 0.01, -0.45, 0.055, 0.5, 0x26495b);
    b.rotation.x = Math.PI / 2;
  }
  block(group, 0.13, 0, 0.05, 0.02, 0.085, 0.23, 0xfff3cb);
  group.scale.setScalar(w.size);
  return group;
}
function eggGeometry() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = (Math.PI * i) / 24,
      y = 0.08 + (1.6 * (1 - Math.cos(t))) / 2,
      r = Math.sin(t) * (0.55 - (0.1 * i) / 24);
    pts.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(pts, 28);
}
const eggGeo = eggGeometry();
export function makeEgg(profile, team = -1, withWeapon = true) {
  const group = new THREE.Group(),
    body = new THREE.Mesh(eggGeo, mat(profile.color || "#fff6da"));
  body.castShadow = true;
  group.add(body);
  const trim = team < 0 ? 0xf2b933 : TEAM_COLORS[team];
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.446, 0.064, 8, 30),
    mat(trim),
  );
  band.position.y = 1.02;
  band.rotation.x = Math.PI / 2;
  group.add(band);
  block(group, 0, 1.04, -0.403, 0.66, 0.22, 0.13, 0x263e4c);
  block(group, 0, 1.065, -0.48, 0.54, 0.11, 0.025, 0x62d5e3);
  block(group, -0.2, 1.095, -0.501, 0.13, 0.021, 0.011, 0xeafff1);
  for (const x of [-0.17, 0.17])
    block(group, x, 0.08, -0.02, 0.19, 0.15, 0.31, 0x314951);
  const hat = Number(profile.hat) || 0;
  if (hat === 1) {
    for (const x of [-0.45, 0.45])
      ball(group, x, 1.19, 0, 0.12, 0.19, 0.14, 0x315569);
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.41, 0.055, 8, 24, Math.PI),
      mat(trim),
    );
    hoop.position.y = 1.33;
    group.add(hoop);
  }
  if (hat === 2) {
    ball(group, 0, 1.55, 0, 0.33, 0.19, 0.32, trim);
    block(group, 0, 1.55, -0.27, 0.53, 0.06, 0.42, trim);
  }
  if (hat === 3) {
    cylinder(group, 0, 1.62, 0, 0.27, 0.18, 0xf9c84c);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.075, 0.2, 4),
        mat(0xf9c84c),
      );
      cone.position.set(Math.sin(a) * 0.22, 1.78, Math.cos(a) * 0.22);
      group.add(cone);
    }
  }
  if (hat === 4) {
    cylinder(group, 0, 1.79, 0, 0.027, 0.28, 0x6f9a50);
    const leaf = ball(group, 0.1, 1.87, 0, 0.17, 0.04, 0.08, 0x8ac763);
    leaf.rotation.z = 0.4;
  }
  if (withWeapon) {
    const blaster = makeBlaster(profile.weapon);
    blaster.position.set(0.44, 0.65, -0.34);
    blaster.scale.multiplyScalar(0.8);
    group.add(blaster);
    ball(group, 0.34, 0.66, -0.18, 0.1, 0.1, 0.1, profile.color || "#fff6da");
    group.userData.blaster = blaster;
  }
  return group;
}
function label(text, color = "#ffffff") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.font = "bold 34px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(23,43,57,.82)";
  ctx.beginPath();
  ctx.roundRect(10, 7, 492, 80, 24);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text.slice(0, 22), 256, 49, 460);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: true,
      transparent: true,
    }),
  );
  sprite.scale.set(2.5, 0.47, 1);
  return sprite;
}
export class View {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov || 85, 1, 0.06, 180);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe9faff, 0x918777, 2.25));
    const sun = new THREE.DirectionalLight(0xfff3de, 2.2);
    sun.position.set(-15, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 38,
      bottom: -38,
      near: 1,
      far: 95,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.actors = new THREE.Group();
    this.scene.add(this.actors);
    this.effects = new THREE.Group();
    this.scene.add(this.effects);
    this.models = new Map();
    this.projectiles = new Map();
    this.pickupMeshes = new Map();
    this.flagMeshes = [];
    this.fx = [];
    this.recoil = 0;
    this.clock = 0;
    this.mapId = null;
    this.menuEgg = null;
    this.localWeapon = null;
    this.gunGroup = new THREE.Group();
    this.gunGroup.scale.setScalar(0.78);
    this.camera.add(this.gunGroup);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.loadMap("yard");
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("graphics-lost"));
    });
  }
  resize() {
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        this.settings.quality === "low" ? 1 : 1.6,
      ),
    );
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  setQuality() {
    this.renderer.shadowMap.enabled = this.settings.quality !== "low";
    this.resize();
  }
  disposeGroup(group) {
    group.traverse((o) => {
      if (o.isSprite) {
        o.material.map?.dispose();
        o.material.dispose();
      } else if (
        o.isMesh &&
        o.geometry !== boxGeo &&
        o.geometry !== sphereGeo &&
        o.geometry !== eggGeo
      )
        o.geometry?.dispose();
    });
    group.clear();
  }
  loadMap(id) {
    if (id === this.mapId) return;
    this.mapId = id;
    const map = getMap(id);
    this.disposeGroup(this.world);
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.sky, 45, 115);
    block(
      this.world,
      0,
      -0.3,
      0,
      map.size * 2 + 18,
      0.6,
      map.size * 2 + 18,
      map.ground,
    );
    // Painted field lines and simple architecture are generated with the map.
    for (const x of [-map.size + 2, map.size - 2])
      block(this.world, x, 0.012, 0, 0.12, 0.025, map.size * 2 - 4, 0xfbf2d7);
    for (const z of [-map.size + 2, map.size - 2])
      block(this.world, 0, 0.013, z, map.size * 2 - 4, 0.025, 0.12, 0xfbf2d7);
    for (const b of map.boxes) {
      const color = palette[b.color] || palette.sand;
      block(this.world, b.x, b.y + b.h / 2, b.z, b.w, b.h, b.d, color);
      if (b.kind === "container") {
        for (let i = 0; i < Math.max(b.w, b.d); i += 0.9) {
          if (b.w > b.d) {
            block(
              this.world,
              b.x - b.w / 2 + i,
              b.y + b.h / 2,
              b.z - b.d / 2 - 0.018,
              0.07,
              b.h - 0.2,
              0.07,
              0xffffff,
            );
            block(
              this.world,
              b.x - b.w / 2 + i,
              b.y + b.h / 2,
              b.z + b.d / 2 + 0.018,
              0.07,
              b.h - 0.2,
              0.07,
              color,
            );
          } else
            block(
              this.world,
              b.x + b.w / 2 + 0.018,
              b.y + b.h / 2,
              b.z - b.d / 2 + i,
              0.06,
              b.h - 0.2,
              0.06,
              0xeedbbb,
            );
        }
        block(
          this.world,
          b.x,
          b.y + b.h + 0.05,
          b.z,
          b.w + 0.1,
          0.1,
          b.d + 0.1,
          0x35566a,
        );
      }
      if (b.color === "crate") {
        for (const dy of [-b.h * 0.37, b.h * 0.37])
          block(
            this.world,
            b.x,
            b.y + b.h / 2 + dy,
            b.z,
            b.w + 0.06,
            0.13,
            b.d + 0.06,
            0x765f4c,
          );
      }
      if (b.color === "terracotta")
        block(
          this.world,
          b.x,
          b.y + b.h + 0.1,
          b.z,
          b.w + 0.25,
          0.2,
          b.d + 0.25,
          0xf2dac0,
        );
    }
    for (let i = 0; i < 14; i++) {
      const a = (i * Math.PI * 2) / 14,
        r = map.size + 8;
      const x = Math.sin(a) * r,
        z = Math.cos(a) * r;
      block(this.world, x, 2, z, 1, 4, 1, 0x987b5f);
      ball(this.world, x, 5, z, 2.6, 3.3, 2.6, i % 2 ? 0x719b69 : 0x8caf73);
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 0.83;
      for (let j = 0; j < 3; j++)
        ball(
          this.world,
          Math.cos(a) * 58 + j * 3,
          26 + (i % 3) * 3,
          Math.sin(a) * 58,
          5,
          1.7,
          3.4,
          0xf4f5e9,
        );
    }
    for (let i = 0; i < 2; i++) {
      const [x, z] = map.bases[i];
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.1, 0.08, 8, 48),
        mat(TEAM_COLORS[i]),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.06, z);
      this.world.add(ring);
    }
    this.zoneMesh = new THREE.Mesh(
      new THREE.RingGeometry(4.9, 5.1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xfbd15a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.zoneMesh.rotation.x = -Math.PI / 2;
    this.zoneMesh.position.set(map.zone[0], map.zone[2] + 0.035, map.zone[1]);
    this.world.add(this.zoneMesh);
    this.pickupMeshes.clear();
    for (const [id, [x, z, type]] of map.pickups.entries()) {
      const group = new THREE.Group();
      let y = 0;
      for (const b of map.boxes)
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)
          y = Math.max(y, b.y + b.h);
      group.position.set(x, y + 0.65, z);
      group.userData.baseY = y + 0.65;
      if (type === "health") {
        block(group, 0, 0, 0, 0.25, 0.75, 0.23, 0xf8faf2);
        block(group, 0, 0, 0, 0.75, 0.25, 0.23, 0xf8faf2);
      } else if (type === "ammo") {
        block(group, 0, 0, 0, 0.55, 0.44, 0.4, 0xf5bf4f);
        for (let j = 0; j < 3; j++)
          cylinder(group, (j - 1) * 0.16, 0.29, 0, 0.05, 0.23, 0xf9e7ab);
      } else ball(group, 0, 0, 0, 0.3, 0.38, 0.3, 0xbca1df);
      const pad = cylinder(
        group,
        0,
        -0.34,
        0,
        0.48,
        0.06,
        type === "health" ? 0x63ceaa : type === "ammo" ? 0xf2b62e : 0xbaa4df,
      );
      this.world.add(group);
      this.pickupMeshes.set(id, group);
    }
    this.flagMeshes = [];
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      cylinder(g, 0, 0.15, 0, 0.34, 0.24, TEAM_COLORS[i]);
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5;
        block(
          g,
          Math.sin(a) * 0.29,
          0.37,
          Math.cos(a) * 0.29,
          0.11,
          0.32,
          0.11,
          TEAM_COLORS[i],
        );
      }
      this.world.add(g);
      this.flagMeshes.push(g);
    }
  }
  preview(profile) {
    const signature = JSON.stringify(profile);
    if (signature === this.previewSignature) return;
    this.previewSignature = signature;
    if (this.menuEgg) {
      this.disposeGroup(this.menuEgg);
      this.scene.remove(this.menuEgg);
    }
    this.menuEgg = makeEgg(profile, -1);
    this.menuEgg.scale.setScalar(2.3);
    this.menuEgg.position.set(0, 2, 0);
    this.scene.add(this.menuEgg);
  }
  setWeapon(p) {
    const id = gun(p).id;
    if (id === this.localWeapon) return;
    this.localWeapon = id;
    this.disposeGroup(this.gunGroup);
    this.gunGroup.add(makeBlaster(id));
    ball(this.gunGroup, 0.01, -0.19, 0.16, 0.11, 0.13, 0.18, p.color);
  }
  event(e, localId) {
    if (e.type === "shot") {
      if (e.player === localId) this.recoil = 1;
      for (const end of e.ends) {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(e.origin.x, e.origin.y - 0.05, e.origin.z),
            new THREE.Vector3(end.x, end.y, end.z),
          ]),
          line = new THREE.Line(
            geo,
            new THREE.LineBasicMaterial({
              color: weapon(e.weapon).color,
              transparent: true,
              opacity: 0.9,
            }),
          );
        this.effects.add(line);
        this.fx.push({ mesh: line, life: 0.075, max: 0.075 });
      }
    }
    if (e.type === "elimination" || e.type === "explosion") {
      for (let i = 0; i < (e.type === "elimination" ? 18 : 26); i++) {
        const color =
          e.type === "elimination"
            ? [0xfff3c9, 0xffc843, 0x5dc7d5][i % 3]
            : [0xffc642, 0xf5ede0, 0xfb9564][i % 3];
        const mesh = new THREE.Mesh(boxGeo, mat(color));
        mesh.position.set(e.x, e.y + 0.7, e.z);
        mesh.scale.setScalar(0.09 + Math.random() * 0.15);
        this.effects.add(mesh);
        this.fx.push({
          mesh,
          life: 0.8,
          max: 0.8,
          v: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 6,
            (Math.random() - 0.5) * 8,
          ),
        });
      }
    }
    if (e.type === "launch" && e.player === localId) this.recoil = 1;
  }
  update(state, local, predicted, dt, playing, aim, profile) {
    this.clock += dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.loadMap(state?.options.map || "yard");
    if (this.menuEgg) this.menuEgg.visible = !playing;
    this.actors.visible = playing;
    this.gunGroup.visible = playing && local?.health > 0;
    if (!playing) {
      this.preview(profile);
      this.menuEgg.rotation.y =
        Math.PI + 0.25 + Math.sin(this.clock * 0.25) * 0.2;
      this.camera.position.set(7.5, 6.4, 12.5);
      this.camera.lookAt(0, 3.3, 0);
      this.camera.fov = 51;
      this.camera.updateProjectionMatrix();
    } else if (local) {
      const p = predicted || local;
      this.camera.position.set(
        p.x,
        p.y + EYE + (local.health <= 0 ? 0.8 : 0),
        p.z,
      );
      this.camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
      const fov = aim ? gun(local).zoom : this.settings.fov;
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 13);
      this.camera.updateProjectionMatrix();
      this.setWeapon(local);
      const bob = Math.sin(this.clock * 12) * 0.012 * (p.moving ? 1 : 0);
      this.gunGroup.position.set(
        aim ? 0.08 : Math.min(0.39, 0.43 * this.camera.aspect),
        -0.34 + bob - this.recoil * 0.02,
        -0.64 + this.recoil * 0.07,
      );
      this.gunGroup.rotation.set(
        this.recoil * 0.085 + (local.reloadEnd > state.time ? -0.5 : 0),
        aim ? 0 : -0.035,
        local.reloadEnd > state.time ? -0.48 : 0,
      );
    }
    if (state) {
      const seen = new Set();
      for (const p of state.players) {
        if (p.id === local?.id) continue;
        seen.add(p.id);
        const sig =
          p.weapon + p.color + p.hat + p.team + mode(state.options.mode).teams;
        let model = this.models.get(p.id);
        if (!model || model.userData.signature !== sig) {
          if (model) {
            this.disposeGroup(model);
            this.actors.remove(model);
          }
          model = makeEgg(p, mode(state.options.mode).teams ? p.team : -1);
          model.userData.signature = sig;
          const name = label(
            p.name,
            p.team === 0 && mode(state.options.mode).teams
              ? "#b3f2ff"
              : "#ffffff",
          );
          name.position.y = 2.08;
          model.add(name);
          this.actors.add(model);
          this.models.set(p.id, model);
          model.position.set(p.x, p.y, p.z);
        }
        model.visible = p.health > 0;
        if (model.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) > 8)
          model.position.set(p.x, p.y, p.z);
        else
          model.position.lerp(
            new THREE.Vector3(p.x, p.y, p.z),
            Math.min(1, dt * 18),
          );
        let delta = p.yaw - model.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        model.rotation.y += delta * Math.min(1, dt * 18);
        model.scale.setScalar(
          state.time < p.shieldUntil
            ? 1.03 + Math.sin(this.clock * 10) * 0.02
            : 1,
        );
      }
      for (const [id, model] of this.models)
        if (!seen.has(id)) {
          this.disposeGroup(model);
          this.actors.remove(model);
          this.models.delete(id);
        }
      const active = new Set();
      for (const b of state.projectiles) {
        active.add(b.id);
        let mesh = this.projectiles.get(b.id);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 8),
            mat(b.popper ? 0xb99be3 : 0xffc338),
          );
          this.scene.add(mesh);
          this.projectiles.set(b.id, mesh);
        }
        mesh.position.set(b.x, b.y, b.z);
      }
      for (const [id, mesh] of this.projectiles)
        if (!active.has(id)) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.projectiles.delete(id);
        }
      for (const item of state.pickups) {
        const mesh = this.pickupMeshes.get(item.id);
        if (mesh) {
          mesh.visible = item.availableAt <= state.time;
          mesh.rotation.y = this.clock;
          mesh.position.y =
            mesh.userData.baseY + Math.sin(this.clock * 2) * 0.1;
        }
      }
      for (let i = 0; i < 2; i++) {
        const f = state.flags[i],
          mesh = this.flagMeshes[i];
        mesh.visible = state.options.mode === "capture" && !!f;
        if (f) {
          mesh.position.set(
            f.x,
            f.y + (f.carrier ? 2.2 : 0.9) + Math.sin(this.clock * 2) * 0.1,
            f.z,
          );
          mesh.rotation.y = this.clock;
        }
      }
      this.zoneMesh.visible = state.options.mode === "control";
      if (this.zoneMesh.visible)
        this.zoneMesh.material.color.setHex(
          state.zone.owner >= 0 ? TEAM_COLORS[state.zone.owner] : 0xfbd15a,
        );
    } else {
      this.zoneMesh.visible = false;
      this.flagMeshes.forEach((m) => (m.visible = false));
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.effects.remove(f.mesh);
        if (f.mesh.isLine) {
          f.mesh.geometry.dispose();
          f.mesh.material.dispose();
        }
        this.fx.splice(i, 1);
      } else if (f.v) {
        f.v.y -= 12 * dt;
        f.mesh.position.addScaledVector(f.v, dt);
        f.mesh.rotation.x += dt * 3;
        f.mesh.scale.multiplyScalar(Math.pow(0.98, dt * 60));
      } else f.mesh.material.opacity = f.life / f.max;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
