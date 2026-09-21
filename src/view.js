import * as THREE from "three";
import { getMap } from "./maps.js";
import { gun, weapon, TEAM_COLORS, mode, clamp } from "./data.js";
import { EYE, VIEWMODEL, direction, wallDistance } from "./physics.js";
import { makeBlaster, weaponPortrait } from "./weapons.js";
import { buildArena } from "./arenas.js";
const palette = {
  sand: 0xe9d9b2,
  stone: 0xd4d5c6,
  navy: 0x31566a,
  blue: 0x399bba,
  coral: 0xe37b61,
  crate: 0xad8961,
  gold: 0xe5b844,
  terracotta: 0xd58f72,
  steel: 0x6b8292,
  cream: 0xece5d0,
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
  // Jagged paths follow the same lathed shell surface and reveal with damage.
  const cracks = [];
  for (let n = 0; n < 12; n++) {
    const points = [];
    for (let j = 0; j <= 14; j++) {
      const t = 0.22 + j / 14 * 2.65;
      const angle = n * Math.PI / 6 + Math.sin(j * 2.4 + n) * 0.085;
      const r = Math.sin(t) * (0.55 - 0.1 * t / Math.PI) + 0.007;
      points.push(new THREE.Vector3(Math.sin(angle)*r, 0.08+0.8*(1-Math.cos(t)), Math.cos(angle)*r));
    }
    const crack = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color: 0x44332d}));
    crack.visible = false;
    group.add(crack);
    cracks.push(crack);
  }
  group.userData.cracks = cracks;

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
    blaster.position.set(VIEWMODEL.x, EYE + VIEWMODEL.y, VIEWMODEL.z);
    blaster.scale.setScalar(VIEWMODEL.scale);
    group.add(blaster);
    ball(group, 0.34, 0.66, -0.18, 0.1, 0.1, 0.1, profile.color || "#fff6da");
    group.userData.blaster = blaster;
  }
  return group;
}
function label(text, color = "#ffffff", compact = false) {
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
  if (!compact) ctx.fill();
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
    this.camera = new THREE.PerspectiveCamera(
      settings.fov || 85,
      1,
      0.025,
      260,
    );
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe9faff, 0x918777, 2.25));
    const sun = new THREE.DirectionalLight(0xfff3de, 2.2);
    sun.position.set(-15, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -58,
      right: 58,
      top: 58,
      bottom: -58,
      near: 1,
      far: 140,
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
    this.shotOffsets = new Map();
    this.pickupMeshes = new Map();
    this.flagMeshes = [];
    this.fx = [];
    this.recoil = 0;
    this.clock = 0;
    this.mapId = null;
    this.menuEgg = null;
    this.localWeapon = null;
    this.gunGroup = new THREE.Group();
    this.gunGroup.scale.setScalar(VIEWMODEL.scale);
    this.portraits = new Map();
    this.pendingShots = [];
    this.aimBlend = 0;
    this.scopeTarget = new THREE.WebGLRenderTarget(
      settings.quality === "low" ? 512 : 768,
      settings.quality === "low" ? 512 : 768,
    );
    this.scopeCamera = new THREE.PerspectiveCamera(27, 1, 0.06, 260);
    const reticle = document.createElement("canvas");
    reticle.width = reticle.height = 512;
    const r = reticle.getContext("2d");
    r.strokeStyle = "rgba(18,34,40,.93)";
    r.lineWidth = 1.7;
    r.beginPath();
    for (const [x1, y1, x2, y2] of [
      [0, 256, 240, 256],
      [272, 256, 512, 256],
      [256, 0, 256, 240],
      [256, 272, 256, 512],
    ]) {
      r.moveTo(x1, y1);
      r.lineTo(x2, y2);
    }
    for (let i = 1; i < 6; i++)
      for (const sign of [-1, 1]) {
        r.moveTo(250, 256 + sign * i * 29);
        r.lineTo(262, 256 + sign * i * 29);
        r.moveTo(256 + sign * i * 29, 250);
        r.lineTo(256 + sign * i * 29, 262);
      }
    r.stroke();
    r.fillStyle = "#e96d46";
    r.beginPath();
    r.arc(256, 256, 3, 0, Math.PI * 2);
    r.fill();
    r.fillStyle = "rgba(28,54,61,.7)";
    r.font = "bold 13px monospace";
    r.textAlign = "center";
    r.fillText("Y / OPTICS", 256, 424);
    this.reticleTexture = new THREE.CanvasTexture(reticle);
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
      if (o.isLine) { o.geometry.dispose(); o.material.dispose(); }
      if (o.isSprite) {
        o.material.map?.dispose();
        o.material.dispose();
      } else if (
        o.isMesh &&
        o.geometry !== boxGeo &&
        o.geometry !== sphereGeo &&
        o.geometry !== eggGeo &&
        !o.geometry.userData.shared
      )
        o.geometry?.dispose();
    });
    group.traverse((o) => {
      if (o.userData.ownedMaterial) {
        if (
          o.material.map &&
          o.material.map !== this.scopeTarget.texture &&
          o.material.map !== this.reticleTexture
        )
          o.material.map.dispose();
        o.material.dispose();
      }
    });
    group.clear();
  }
  loadMap(id) {
    if (id === this.mapId) return;
    this.mapId = id;
    const map = getMap(id);
    this.disposeGroup(this.world);
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.sky, 72, 175);
    buildArena(this.world, map, { block, ball, cylinder, mat, palette });
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
    this.menuEgg.position.set(0, 0.08, 0);
    this.scene.add(this.menuEgg);
  }
  diagnostics() {
    return {
      weapon: this.localWeapon,
      muzzle: this.localModel?.userData.muzzle
        ?.getWorldPosition(new THREE.Vector3())
        .toArray(),
      flash: this.lastMuzzleFlash?.toArray(),
      projectiles: this.projectiles.size,
      scopeFov: this.scopeCamera.fov,
    };
  }
  weaponPreview(id) {
    if (!this.portraits.has(id))
      this.portraits.set(id, weaponPortrait(this.renderer, id));
    return this.portraits.get(id);
  }
  setWeapon(p) {
    const id = gun(p).id;
    if (id === this.localWeapon) return;
    this.localWeapon = id;
    this.disposeGroup(this.gunGroup);
    const model = makeBlaster(id);
    this.gunGroup.add(model);
    this.localModel = model;
    this.opticLens = model.userData.lens || null;
    if (this.opticLens) {
      this.opticLens.material.map = this.scopeTarget.texture;
      this.opticLens.material.color.setHex(0xffffff);
      const radius = id === "needle" ? 0.125 : 0.103;
      const reticle = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({
          map: this.reticleTexture,
          transparent: true,
          depthWrite: false,
        }),
      );
      reticle.position.copy(this.opticLens.position);
      reticle.position.z += 0.002;
      reticle.userData.ownedMaterial = true;
      model.add(reticle);
    }
    ball(this.gunGroup, 0.005, -0.24, 0.17, 0.095, 0.12, 0.13, p.color);
    ball(this.gunGroup, -0.07, -0.14, -0.4, 0.08, 0.09, 0.11, p.color);
  }
  event(e, localId) {
    if (e.type === "hit" && e.player === localId && Number.isFinite(e.x)) {
      const mesh = label(String(e.amount) + (e.precision ? " CRIT" : ""), e.precision ? "#ffcf52" : "#ffffff", true);
      mesh.scale.set(1.25, 0.24, 1);
      mesh.position.set(e.x + (e.id % 3 - 1) * 0.16, e.y, e.z);
      this.effects.add(mesh);
      this.fx.push({mesh, life: 0.8, max: 0.8, damageText: true});
    }

    if (e.type === "shot" || e.type === "launch") {
      if (e.player === localId) this.recoil = Math.min(1.6, this.recoil + 0.85);
      if (!e.popper)
        this.pendingShots.push({ event: e, local: e.player === localId });
    }
    if (e.type === "impact") {
      const n = new THREE.Vector3(
        e.normal?.x || 0,
        e.normal?.y || 0,
        e.normal?.z || 0,
      );
      for (let i = 0; i < (e.tag ? 4 : 6); i++) {
        const m = new THREE.Mesh(
          sphereGeo,
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xffe5a5 : weapon(e.weapon).color,
            transparent: true,
          }),
        );
        m.position.set(e.x, e.y, e.z);
        m.position.addScaledVector(n, 0.025);
        m.scale.setScalar(0.025 + Math.random() * 0.035);
        this.effects.add(m);
        this.fx.push({
          mesh: m,
          life: 0.22,
          max: 0.22,
          v: n
            .clone()
            .multiplyScalar(1.4)
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.7,
                (Math.random() - 0.5) * 2,
              ),
            ),
          ownedMaterial: true,
        });
      }
      if (!e.tag) {
        const mark = new THREE.Mesh(
          new THREE.CircleGeometry(0.085, 10),
          new THREE.MeshBasicMaterial({
            color: 0x445258,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        mark.position.set(e.x, e.y, e.z);
        mark.position.addScaledVector(n, 0.012);
        mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        this.effects.add(mark);
        this.fx.push({
          mesh: mark,
          life: 2.4,
          max: 2.4,
          ownedMaterial: true,
          ownedGeometry: true,
        });
      }
    }
    if (e.type === "elimination" || e.type === "explosion") {
      for (let i = 0; i < (e.type === "elimination" ? 18 : 26); i++) {
        const c =
          e.type === "elimination"
            ? [0xfff3c9, 0xffc843, 0x5dc7d5][i % 3]
            : [0xffc642, 0xf5ede0, 0xfb9564][i % 3];
        const m = new THREE.Mesh(boxGeo, mat(c));
        m.position.set(e.x, e.y + 0.6, e.z);
        m.scale.setScalar(0.08 + Math.random() * 0.14);
        this.effects.add(m);
        this.fx.push({
          mesh: m,
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
  }
  muzzleEffects() {
    this.camera.updateMatrixWorld(true);
    this.actors.updateMatrixWorld(true);
    for (const { event: e, local } of this.pendingShots) {
      const model = local
        ? this.localModel
        : this.models.get(e.player)?.userData.blaster;
      const pos =
        model?.userData.muzzle?.getWorldPosition(new THREE.Vector3()) ||
        new THREE.Vector3(e.origin?.x || 0, e.origin?.y || 0, e.origin?.z || 0);
      if (local) this.lastMuzzleFlash = pos.clone();
      const flash = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.085, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffe3a0,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      flash.position.copy(pos);
      flash.scale.set(1, 1, 2.2);
      if (model)
        flash.quaternion.copy(model.getWorldQuaternion(new THREE.Quaternion()));
      this.effects.add(flash);
      this.fx.push({
        mesh: flash,
        fresh: true,
        life: 0.055,
        max: 0.055,
        ownedMaterial: true,
        ownedGeometry: true,
      });
      for (const shot of e.shots || []) {
        this.shotOffsets.set(shot.id, {
          delta: pos
            .clone()
            .sub(new THREE.Vector3(e.origin.x, e.origin.y, e.origin.z)),
          born: this.clock,
        });
        // A short traveling segment starts at the visible muzzle, never at the camera.
        const direction = new THREE.Vector3(
          shot.vx,
          shot.vy,
          shot.vz,
        ).normalize();
        const trace = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.027, 0.65, 7),
          new THREE.MeshBasicMaterial({
            color: weapon(e.weapon).color,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        trace.position.copy(pos);
        trace.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        );
        this.effects.add(trace);
        this.fx.push({
          mesh: trace,
          fresh: true,
          life: 0.04,
          max: 0.04,
          v: new THREE.Vector3(shot.vx, shot.vy, shot.vz),
          noGravity: true,
          ownedMaterial: true,
          ownedGeometry: true,
        });
      }
    }
    this.pendingShots.length = 0;
  }
  update(state, local, predicted, dt, playing, aim, profile) {
    this.clock += dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.loadMap(state?.options.map || "yard");
    if (this.menuEgg) this.menuEgg.visible = !playing;
    this.actors.visible = playing;
    this.effects.visible = playing;
    this.gunGroup.visible = playing && local?.health > 0;
    if (!playing) {
      this.preview(profile);
      this.menuEgg.rotation.y =
        Math.PI + 0.25 + Math.sin(this.clock * 0.25) * 0.2;
      this.camera.position.set(7.5, 5.2, 12.5);
      this.camera.lookAt(0, 1.7, 0);
      this.camera.fov = 51;
      this.camera.updateProjectionMatrix();
    } else if (local) {
      const killer = local.health <= 0 && state.players.find(p => p.id === local.killerId && p.health > 0);
      const p = killer || (local.health <= 0 ? local : predicted || local);
      this.camera.position.set(
        p.x,
        p.y + EYE + (local.health <= 0 ? 0.8 : 0),
        p.z,
      );
      this.camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
      if (killer) {
        const back = new THREE.Vector3(Math.sin(p.yaw), 0.35, Math.cos(p.yaw)).normalize();
        const origin = {x:p.x, y:p.y+1.6, z:p.z};
        const distance = Math.max(0.1, wallDistance(getMap(state.options.map), origin, back, 3.5)-0.2);
        this.camera.position.set(origin.x+back.x*distance, origin.y+back.y*distance, origin.z+back.z*distance);
        this.camera.lookAt(p.x, p.y+1.05, p.z);
      }
      const w = gun(local),
        scoped = w.optic === "scope" || w.optic === "prism";
      const aiming = aim && local.health > 0 && local.reloadEnd <= state.time;
      this.aimBlend += (Number(aiming) - this.aimBlend) * Math.min(1, dt * 14);
      const fov = aiming
        ? scoped
          ? Math.min(this.settings.fov, 76)
          : w.zoom
        : this.settings.fov;
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 13);
      this.camera.updateProjectionMatrix();
      this.setWeapon(local);
      const bob =
        Math.sin(this.clock * 11) *
        0.012 *
        (p.moving ? 1 : 0) *
        (1 - this.aimBlend);
      const reload =
        local.reloadEnd > state.time
          ? Math.sin(
              Math.PI *
                clamp(1 - (local.reloadEnd - state.time) / w.reload, 0, 1),
            )
          : 0;
      const front = -VIEWMODEL.z + w.muzzle * VIEWMODEL.scale;
      const wall = wallDistance(
        getMap(state.options.map),
        { x: p.x, y: p.y + EYE, z: p.z },
        direction(p.yaw, p.pitch),
        front,
      );
      this.gunGroup.position.set(
        VIEWMODEL.x * (1 - this.aimBlend),
        THREE.MathUtils.lerp(
          VIEWMODEL.y,
          -w.sightY * VIEWMODEL.scale,
          this.aimBlend,
        ) +
          bob -
          reload * 0.22,
        VIEWMODEL.z + this.recoil * 0.035 + Math.max(0, front - wall) * 0.65,
      );
      this.gunGroup.rotation.set(
        this.recoil * 0.045 * (1 - this.aimBlend * 0.65) - reload * 0.5,
        0,
        -reload * 0.5,
      );
      this.scopeActive = aiming && scoped && this.aimBlend > 0.1;
    }
    if (state) {
      const seen = new Set();
      for (const p of state.players) {
        if (p.id === local?.id && p.health > 0) continue;
        seen.add(p.id);
        const sig =
          p.weapon +
          p.slot +
          p.color +
          p.hat +
          p.team +
          mode(state.options.mode).teams;
        let model = this.models.get(p.id);
        if (!model || model.userData.signature !== sig) {
          if (model) {
            this.disposeGroup(model);
            this.actors.remove(model);
          }
          model = makeEgg(
            { ...p, weapon: gun(p).id },
            mode(state.options.mode).teams ? p.team : -1,
          );
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
        // Drive the gait from interpolated horizontal travel, including network players.
        const previous = model.userData.walkPosition || { x: p.x, z: p.z };
        const travel = Math.hypot(p.x - previous.x, p.z - previous.z);
        model.userData.walkPosition = { x: p.x, z: p.z };
        const walking = p.health > 0 && p.grounded && travel < 2;
        const targetSpeed = walking ? Math.min(1, travel / Math.max(dt, 0.001) / 5) : 0;
        const stride = model.userData.stride = (model.userData.stride || 0) + (walking ? travel * 7 : 0);
        const gait = model.userData.gait = THREE.MathUtils.lerp(model.userData.gait || 0, targetSpeed, Math.min(1, dt * 12));
        const bob = Math.abs(Math.sin(stride)) * 0.065 * gait;
        const deathAge = p.health <= 0 ? state.time - (p.respawnAt - 3) : 0;
        model.visible = p.health > 0 || deathAge < 0.75;
        model.userData.cracks.forEach((crack, i) => {
          crack.visible = p.health < 100 && i < Math.ceil((1-p.health/100)*12);
        });

        if (model.userData.blaster) model.userData.blaster.rotation.x = p.pitch;
        if (model.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) > 8)
          model.position.set(p.x, p.y, p.z);
        else
          model.position.lerp(
            new THREE.Vector3(p.x, p.y + bob, p.z),
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
        if (p.health <= 0) {
          const collapse = Math.min(1, Math.max(0, deathAge - 0.2) / 0.55);
          model.scale.set(1 + collapse * 0.25, 1 - collapse * 0.95, 1 + collapse * 0.25);
          model.rotation.z = collapse * 0.35;
        } else {
          model.rotation.z = Math.sin(stride) * 0.1 * gait;
          model.rotation.x = Math.cos(stride * 2) * 0.025 * gait;
        }
      }
      for (const [id, model] of this.models)
        if (!seen.has(id)) {
          this.disposeGroup(model);
          this.actors.remove(model);
          this.models.delete(id);
        }
      this.muzzleEffects();
      const active = new Set();
      if (this.lastSnapshotTime !== state.time) {
        this.lastSnapshotTime = state.time;
        this.snapshotAge = 0;
      } else this.snapshotAge = Math.min(0.075, (this.snapshotAge || 0) + dt);
      for (const b of state.projectiles) {
        active.add(b.id);
        let mesh = this.projectiles.get(b.id);
        if (!mesh) {
          const bolt = b.kind === "bolt";
          // Compact weapon-specific rounds; tails are brief motion cues, not giant cones.
          const profiles = {
            sprinter: [0.018, 0.14, 0.55], scatter: [0.022, 0.025, 0.12],
            needle: [0.015, 0.24, 0.95], zipper: [0.015, 0.08, 0.32],
            anchor: [0.023, 0.17, 0.65], duet: [0.018, 0.18, 0.7],
            pip: [0.02, 0.075, 0.25],
          };
          const [radius, length, trail] = profiles[b.weapon] || profiles.sprinter;
          mesh = new THREE.Mesh(
            bolt ? new THREE.CapsuleGeometry(radius, length, 3, 6)
              : b.popper ? new THREE.SphereGeometry(0.14, 12, 8)
              : new THREE.CapsuleGeometry(0.075, 0.16, 4, 10),
            new THREE.MeshStandardMaterial({
              color: b.popper ? 0xb79bea : bolt ? 0xe4bc78 : 0x9871b5,
              roughness: 0.4, metalness: bolt ? 0.55 : 0.25,
            }),
          );
          this.effects.add(mesh);
          this.projectiles.set(b.id, mesh);
          if (bolt) {
            const tail = new THREE.Mesh(
              new THREE.CylinderGeometry(radius * 0.35, 0, trail, 5),
              new THREE.MeshBasicMaterial({
                color: 0xffdc97, transparent: true, opacity: 0.3,
                depthWrite: false, toneMapped: false,
              }),
            );
            tail.position.y = -(length + trail) / 2;
            mesh.add(tail);
          }
        }
        mesh.position.set(
          b.x + b.vx * this.snapshotAge,
          b.y + b.vy * this.snapshotAge,
          b.z + b.vz * this.snapshotAge,
        );
        const offset = this.shotOffsets.get(b.id);
        if (offset) {
          const blend = Math.max(0, 1 - (this.clock - offset.born) / 0.08);
          mesh.position.addScaledVector(offset.delta, blend);
          if (blend === 0) this.shotOffsets.delete(b.id);
        }
        const velocity = new THREE.Vector3(b.vx, b.vy, b.vz);
        if (velocity.lengthSq() > 0.01)
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            velocity.normalize(),
          );
      }
      for (const [id, mesh] of this.projectiles)
        if (!active.has(id)) {
          this.effects.remove(mesh);
          mesh.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
          });
          this.projectiles.delete(id);
          this.shotOffsets.delete(id);
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
    for (const [id, offset] of this.shotOffsets)
      if (this.clock - offset.born > 0.12) this.shotOffsets.delete(id);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      if (f.fresh) {
        f.fresh = false;
        continue;
      }
      f.life -= dt;
      if (f.life <= 0) {
        this.effects.remove(f.mesh);
        if (f.mesh.isSprite) { f.mesh.material.map?.dispose(); f.mesh.material.dispose(); }
        if (f.ownedMaterial) f.mesh.material.dispose();
        if (f.ownedGeometry) f.mesh.geometry.dispose();
        if (f.mesh.isLine) {
          f.mesh.geometry.dispose();
          f.mesh.material.dispose();
        }
        this.fx.splice(i, 1);
      } else if (f.damageText) {
        f.mesh.position.y += dt * 0.65;
        f.mesh.material.opacity = Math.min(1, f.life / 0.3);
      } else if (f.v) {
        if (!f.noGravity) f.v.y -= 12 * dt;
        f.mesh.position.addScaledVector(f.v, dt);
        f.mesh.rotation.x += dt * 3;
        f.mesh.scale.multiplyScalar(Math.pow(0.98, dt * 60));
      } else f.mesh.material.opacity = f.life / f.max;
    }
    if (this.opticLens) {
      const texture =
        playing && this.scopeActive ? this.scopeTarget.texture : null;
      if (this.opticLens.material.map !== texture) {
        this.opticLens.material.map = texture;
        this.opticLens.material.color.setHex(texture ? 0xffffff : 0x427c86);
        this.opticLens.material.needsUpdate = true;
      }
    }
    if (playing && this.scopeActive && this.opticLens) {
      this.scopeCamera.position.copy(this.camera.position);
      this.scopeCamera.quaternion.copy(this.camera.quaternion);
      const aperture = gun(local).id === "needle" ? 0.125 : 0.103;
      const lensWorld = this.opticLens.getWorldPosition(new THREE.Vector3());
      const depth = Math.max(0.1, this.camera.worldToLocal(lensWorld).z * -1);
      this.scopeCamera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            (aperture * VIEWMODEL.scale) / depth / gun(local).magnification,
          ),
      );
      this.scopeCamera.updateProjectionMatrix();
      this.gunGroup.visible = false;
      this.renderer.setRenderTarget(this.scopeTarget);
      this.renderer.render(this.scene, this.scopeCamera);
      this.renderer.setRenderTarget(null);
      this.gunGroup.visible = true;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

