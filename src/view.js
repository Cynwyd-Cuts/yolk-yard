import {buildIsland,RoyaleView} from './royale-view.js';
import {stairCamera} from './stair-camera.js';
import {MenuPose} from './menu-pose.js';
import * as THREE from "three";
import {equipPose} from "./equip.js";
import { makeArms, updateArms, reloadProgress, utilityArms, throwArms, armAppearance } from "./arms.js";
import { patternedShell, addHeadwear, addEyewear, optionProfile } from "./cosmetics.js";
import { getMap } from "./maps.js";
import { gun, weapon, TEAM_COLORS, mode, clamp, NO_EYEWEAR } from "./data.js";
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
export function eggGeometry() {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = (Math.PI * i) / 64,
      y = 0.08 + (1.6 * (1 - Math.cos(t))) / 2,
      r = Math.sin(t) * (0.55 - (0.1 * i) / 64);
    pts.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(pts, 64);
}
const eggGeo = eggGeometry();
export function makeEgg(profile, team = -1, withWeapon = true) {
  const group = new THREE.Group(),
    body = new THREE.Mesh(eggGeo, patternedShell(profile));
  body.userData.ownedMaterial = true;
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

  const trim = team < 0 ? (profile.accent || 0xf2b933) : TEAM_COLORS[team];
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.446, 0.064, 8, 30),
    mat(trim),
  );
  band.position.y = 1.02;
  band.rotation.x = Math.PI / 2;
  band.visible = team >= 0 || profile.eyewear !== NO_EYEWEAR;
  group.add(band);
  addEyewear(group, profile, {block, ball, mat});

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
  addHeadwear(group, profile, {ball, block, cylinder, mat});
  if (withWeapon) {
    const blaster = makeBlaster(profile.weapon);
    const held = new THREE.Group();
    held.position.set(VIEWMODEL.x, EYE + VIEWMODEL.y, VIEWMODEL.z);
    held.scale.setScalar(VIEWMODEL.scale);
    const arms = makeArms(profile.weapon, profile, false);
    held.add(blaster, arms); group.add(held);
    group.userData.blaster = blaster;
    group.userData.held = held;
    group.userData.arms = arms;
  }
  return group;
}
function label(text, color = "#ffffff", compact = false, critical = false) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.font = compact ? (critical ? "italic 900 64px Arial" : "900 54px Arial") : "bold 34px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(23,43,57,.82)";
  ctx.beginPath();
  ctx.roundRect(10, 7, 492, 80, 24);
  if (!compact) ctx.fill();
  ctx.fillStyle = color;
  if (compact) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#172b39";
    ctx.lineWidth = critical ? 7 : 6;
    ctx.strokeText(text.slice(0, 22), 256, 49, 460);
  }
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
    this.fx = [];
    this.recoil = 0;
    this.clock = 0;
    this.localThrowStart = -Infinity;
    this.mapId = null;
    this.menuEgg = null;
    this.menuPose = new MenuPose();
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
    this.royaleView = new RoyaleView(this, {block,ball,cylinder,mat,palette});
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
    this.scene.fog = new THREE.Fog(map.sky, map.theme==='royale'?330:72, map.theme==='royale'?1000:175);
    this.camera.far=this.scopeCamera.far=map.theme==='royale'?1400:260;
    this.camera.near=map.theme==='royale'?.15:.025;
    this.camera.updateProjectionMatrix();this.scopeCamera.updateProjectionMatrix();
    (map.theme==='royale'?buildIsland:buildArena)(this.world, map, { block, ball, cylinder, mat, palette });
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
      } else {const popper=this.royaleView.itemModel({id:'popper',count:1},false);popper.scale.setScalar(.9);group.add(popper);}
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
    const held=this.menuEgg.userData.held;held.updateMatrix();
    this.menuShoulders=this.menuEgg.userData.arms.userData.limbs.map(l=>l.shoulder.clone().applyMatrix4(held.matrix));
    this.scene.add(this.menuEgg);
  }
  aimMenu(clientX,clientY){
    const r=this.canvas.getBoundingClientRect();
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),this.camera);
    const origin=new THREE.Vector3(0,2.8,0),normal=this.camera.getWorldDirection(new THREE.Vector3());
    const point=ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,origin.clone().lerp(this.camera.position,.5)),new THREE.Vector3());
    if(point){point.sub(origin);this.menuPose.aim(Math.atan2(-point.x,-point.z),Math.atan2(point.y,Math.hypot(point.x,point.z)));}
  }
  diagnostics() {
    return {
      menuPose: this.menuPose,
      weapon: this.localWeapon,
      draw: this.drawPresentation,
      outgoing: !!this.outgoing,
      remoteArms: [...this.models.entries()].map(([id, model]) => ({id, progress: model.userData.arms?.userData.progress, appearance: model.userData.arms?.userData.appearance, draw: model.userData.draw?.progress})),
      arms: this.localArms ? { weapon: this.localArms.userData.id, appearance: this.localArms.userData.appearance, progress: this.localArms.userData.progress, hands: this.localArms.userData.limbs.map(l=>l.hand.position.toArray()) } : null,
      muzzle: this.localModel?.userData.muzzle
        ?.getWorldPosition(new THREE.Vector3())
        .toArray(),
      flash: this.lastMuzzleFlash?.toArray(),
      projectiles: this.projectiles.size,
      scopeFov: this.scopeCamera.fov,
    };
  }
  eggOptionPortrait(key, value) {
    this.cosmeticPortraits ||= new Map();
    const id = `${key}:${value}`;
    if (!this.cosmeticPortraits.has(id)) {
      this.cosmeticPortraits.set(id, this.eggPortrait(optionProfile(key, value), 160, false));
    }
    return this.cosmeticPortraits.get(id);
  }
  eggPortrait(profile, size = 440, withWeapon = true) {
    if (!this.portraitRenderer) {
      this.portraitRenderer = new THREE.WebGLRenderer({alpha: true, antialias: true});

      this.portraitRenderer.setPixelRatio(1);
    }
    this.portraitRenderer.setSize(size, size);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8c82, 2.8));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-3, 5, -4); scene.add(light);
    const egg = makeEgg(profile, -1, withWeapon);
    egg.rotation.y = -.25; scene.add(egg);
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 20);
    camera.position.set(withWeapon ? -2.5 : 0, 1.5, withWeapon ? -4.8 : -4.2); camera.lookAt(0, 1.1, withWeapon ? -.2 : 0);
    this.portraitRenderer.render(scene, camera);
    const image = this.portraitRenderer.domElement.toDataURL();
    this.disposeGroup(egg);
    return image;
  }
  weaponPreview(id) {
    if (!this.portraits.has(id))
      this.portraits.set(id, weaponPortrait(this.renderer, id));
    return this.portraits.get(id);
  }
  rocketModel(){
    const g=new THREE.Group(),body=new THREE.MeshStandardMaterial({color:0x587c6d,metalness:.55,roughness:.35}),trim=new THREE.MeshStandardMaterial({color:0xf3c45b,metalness:.45,roughness:.3});
    const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.5,12),body);g.add(cylinder);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.11,.23,12),trim);nose.position.y=.365;g.add(nose);
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.075,12),trim);collar.position.y=-.16;g.add(collar);
    for(let i=0;i<4;i++){const fin=new THREE.Mesh(new THREE.BoxGeometry(.035,.2,.26),body.clone());fin.rotation.y=i*Math.PI/2;fin.position.set(Math.sin(i*Math.PI/2)*.09,-.23,Math.cos(i*Math.PI/2)*.09);g.add(fin);}
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.075,.6,10),new THREE.MeshBasicMaterial({color:0xffad45,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));flame.rotation.z=Math.PI;flame.position.y=-.54;g.add(flame);g.userData.flame=flame;
    const core=new THREE.Mesh(new THREE.ConeGeometry(.04,.4,10),new THREE.MeshBasicMaterial({color:0xfff1b0,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));core.rotation.z=Math.PI;core.position.y=-.40;g.add(core);
    return g;
  }
  itemPreview(item) {
    if(item.weapon)return this.weaponPreview(item.id);
    const key='item:'+item.id;if(this.portraits.has(key))return this.portraits.get(key);
    if(!this.portraitRenderer){this.portraitRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.portraitRenderer.setPixelRatio(1);}
    this.portraitRenderer.setSize(192,144);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x7d8c82,2.8));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,4);scene.add(light);
    const model=this.royaleView.itemModel(item,false);model.rotation.y=-.35;scene.add(model);
    const camera=new THREE.PerspectiveCamera(35,4/3,.05,10);camera.position.set(1.1,1,1.8);camera.lookAt(0,.2,0);
    this.portraitRenderer.render(scene,camera);const image=this.portraitRenderer.domElement.toDataURL();this.portraits.set(key,image);this.disposeGroup(model);return image;
  }
  clearOutgoing(owner) {
    if(!owner.outgoing)return;
    const {group}=owner.outgoing;
    group.removeFromParent();this.disposeGroup(group);owner.outgoing=null;
  }
  lowerOutgoing(owner,pose,visible=true) {
    const old=owner.outgoing;if(!old)return;
    if(!visible || pose.holster>=1){this.clearOutgoing(owner);return;}
    old.group.position.copy(old.position);
    old.group.position.y-=pose.holster*.9;
    old.group.position.x+=pose.holster*.12;
    old.group.rotation.copy(old.rotation);
    old.group.rotation.x-=pose.holster*.5;
    old.group.rotation.z-=pose.holster*.35;
    old.group.visible=true;
  }
  setWeapon(p,draw) {
    const id = gun(p).id;
    const appearance=JSON.stringify(armAppearance(p));
    if (id === this.localWeapon && appearance === this.armStyle) return;
    this.clearOutgoing(this);
    if(this.localModel && this.localWeapon!==id && draw.holster<1 && this.gunGroup.visible){
      updateArms(this.localArms,-1,this.localModel);
      const old=new THREE.Group();old.scale.copy(this.gunGroup.scale);
      old.position.copy(this.gunGroup.position);old.rotation.copy(this.gunGroup.rotation);
      while(this.gunGroup.children.length)old.add(this.gunGroup.children[0]);
      this.camera.add(old);
      this.outgoing={group:old,position:old.position.clone(),rotation:old.rotation.clone()};
    }
    this.armStyle = appearance;
    this.localWeapon = id;
    this.disposeGroup(this.gunGroup);
    this.heldItem=null;this.heldItemKey=null;
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
    this.localArms = makeArms(id, p, true);
    this.gunGroup.add(this.localArms);
  }
  event(e, localId) {
    this.royaleView.event(e);
    if (e.type === "hit" && e.player === localId && Number.isFinite(e.x)) {
      const key=e.shotId!=null?e.player+':'+e.shotId+':'+e.target:null;
      const previous=key&&this.fx.find(f=>f.damageText&&f.shotKey===key&&f.life>0);
      const total=(previous?.amount||0)+e.amount,critical=!!(e.precision||previous?.critical);
      const next=label(String(Math.max(1,Math.round(total)))+(critical?'!':''),critical?'#ffcf52':'#ffffff',true,critical);
      next.material.sizeAttenuation=false;next.material.needsUpdate=true;
      if(previous){
        previous.mesh.material.map?.dispose();previous.mesh.material.dispose();previous.mesh.material=next.material;
        previous.amount=total;previous.critical=critical;previous.life=previous.max=.9;
      }else{
        const height=88/Math.max(1,this.canvas.clientHeight)/this.camera.projectionMatrix.elements[5];
        next.scale.set(height*512/96,height,1);next.position.set(e.x,e.y,e.z);this.effects.add(next);
        this.fx.push({mesh:next,life:.9,max:.9,damageText:true,critical,drift:0,shotKey:key,amount:total});
      }
    }

    if (e.type === "shot" || e.type === "launch") {
      if (e.player === localId) this.recoil = Math.min(1.6, this.recoil + 0.85);
      const actor = this.models.get(e.player);
      if(e.type==='launch'&&e.popper){
        if(e.player===localId)this.localThrowStart=this.clock;
        if(actor)actor.userData.throwStart=this.clock;
      }
      if (actor && !e.popper) actor.userData.armRecoil = 1;
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
    this.gunGroup.visible = playing && local?.health > 0 && (!local.inventory || local.flight==='ground');
    if (!playing) {
      this.clearOutgoing(this);
      this.preview(profile);
      const pose=this.menuPose.update(dt),held=this.menuEgg.userData.held;
      this.menuEgg.rotation.y=pose.yaw;
      held.position.set(pose.x,pose.y,pose.z);held.rotation.set(pose.pitch,0,pose.roll,'YXZ');held.updateMatrix();
      const inverse=held.matrix.clone().invert();
      this.menuEgg.userData.arms.userData.limbs.forEach((l,i)=>{l.shoulder.copy(this.menuShoulders[i]).applyMatrix4(inverse);l.lastWrist.set(Infinity,Infinity,Infinity);});
      updateArms(this.menuEgg.userData.arms,-1,this.menuEgg.userData.blaster);
      this.camera.position.set(7.5, 5.2, 12.5);
      this.camera.lookAt(0, 1.7, 0);
      this.camera.fov = 51;
      this.camera.updateProjectionMatrix();
    } else if (local) {
      const killer = local.health <= 0 && state.players.find(p => p.id === (local.spectating ? this.spectateTarget : local.killerId) && p.health > 0);
      const p = killer || (local.health <= 0 ? local : predicted || local);
      this.stairEye=stairCamera(this.stairEye,p,dt,`${state.round}:${p.id}:${local.health>0}`);
      this.camera.position.set(
        p.x,
        this.stairEye.y + EYE * (p.bodyScale || 1) + (local.health <= 0 ? 0.8 : 0),
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
      const draw=equipPose(local,state.time);
      this.drawPresentation=draw;
      this.setWeapon(local,draw);
      this.lowerOutgoing(this,draw,local.health>0);
      this.gunGroup.visible=this.gunGroup.visible&&draw.visible;
      const w = gun(local),
        scoped = w.optic === "scope" || w.optic === "prism";
      const aiming = !!(aim && (!local.inventory||local.flight==='ground'&&local.inventory[local.slot]?.weapon) && local.health > 0 && local.reloadEnd <= state.time && !draw.active);
      if(!Number.isFinite(this.aimBlend))this.aimBlend=0;
      this.aimBlend += (Number(aiming) - this.aimBlend) * Math.min(1, dt * 14);
      const fov = aiming
        ? scoped
          ? Math.min(this.settings.fov, 76)
          : w.zoom
        : this.settings.fov;
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 13);
      this.camera.updateProjectionMatrix();
      const bob =
        Math.sin(this.clock * 11) *
        0.012 *
        (p.moving ? 1 : 0) *
        (1 - this.aimBlend);
      const reload = reloadProgress(local, state.time);
      const hands = updateArms(this.localArms, draw.active?-1:reload, this.localModel, this.recoil,draw.progress);
      const throwT=(this.clock-this.localThrowStart)/.78;
      if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1)throwArms(this.localArms,throwT);
      const front = -VIEWMODEL.z + w.muzzle * VIEWMODEL.scale;
      const wall = wallDistance(
        getMap(state.options.map),
        { x: p.x, y: p.y + EYE * (p.bodyScale || 1), z: p.z },
        direction(p.yaw, p.pitch),
        front,
      );
      this.gunGroup.position.set(
        VIEWMODEL.x * (1 - this.aimBlend) + draw.position[0],
        THREE.MathUtils.lerp(
          VIEWMODEL.y,
          -w.sightY * VIEWMODEL.scale,
          this.aimBlend,
        ) +
          bob -
          hands.dip + draw.position[1],
        VIEWMODEL.z + this.recoil * 0.035 + Math.max(0, front - wall) * 0.65 + draw.position[2],
      );
      this.gunGroup.rotation.set(
        this.recoil * 0.045 * (1 - this.aimBlend * 0.65) + hands.rotation[0] + draw.rotation[0],
        hands.rotation[1] + draw.rotation[1],
        hands.rotation[2] + draw.rotation[2],
      );
      if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1){
        const gesture=Math.sin(Math.PI*throwT);
        this.gunGroup.position.y-=.19*gesture;
        this.gunGroup.rotation.x+=.2*gesture;
      }
      this.scopeActive = !!aiming && scoped && this.aimBlend > 0.1 && (!local.inventory||!!local.inventory[local.slot]?.weapon);
      if(local.inventory){
        const heldItem=local.building?{id:'blueprint'}:local.inventory[local.slot];
        this.localModel.visible=!!heldItem?.weapon;
        const itemKey=heldItem&&!heldItem.weapon?heldItem.id:null;
        if(this.heldItemKey!==itemKey){
          if(this.heldItem){this.heldItem.removeFromParent();this.disposeGroup(this.heldItem);}
          this.heldItem=null;this.heldItemKey=itemKey;
          if(itemKey){this.heldItem=this.royaleView.itemModel(heldItem,false);this.heldItem.scale.setScalar(.4);this.heldItem.position.set(-.05,-.08,-.28);this.gunGroup.add(this.heldItem);}
        }
        if(!heldItem?.weapon&&this.localArms)utilityArms(this.localArms,heldItem?.id,local.use?(state.time-local.use.start)/(local.use.end-local.use.start):-1,this.clock);
        if(this.heldItem&&heldItem?.pickaxe){const swing=Math.max(0,1-(state.time-(local.swingAt??-100))/.45);this.heldItem.rotation.x=-Math.sin(swing*Math.PI)*1.6;this.gunGroup.position.y-=Math.sin(swing*Math.PI)*.17;this.gunGroup.rotation.z-=Math.sin(swing*Math.PI)*.55;}
        if(this.heldItem)this.heldItem.rotation.z=local.use?Math.sin(this.clock*8)*.15:0;
        if(this.localArms){this.localArms.rotation.x=local.use ? -.35+Math.sin(this.clock*6)*.06 : 0;}
        this.gunGroup.rotation.z+=local.sprinting?.35:0;
        if(local.use){this.gunGroup.position.y+=.08+Math.sin(this.clock*8)*.015;this.gunGroup.rotation.x=-.3;}
        if(local.flight==='transport'){
          this.camera.position.set(p.x+Math.sin(p.yaw)*24,p.y+16,p.z+Math.cos(p.yaw)*24);this.camera.lookAt(p.x,p.y+3,p.z);this.camera.fov=80;this.camera.updateProjectionMatrix();
        }else if(local.health>0&&local.flight!=='ground'){
          this.camera.position.set(p.x+Math.sin(p.yaw)*6,p.y+3.5,p.z+Math.cos(p.yaw)*6);this.camera.rotation.set(Math.min(p.pitch,-.18),p.yaw,0,'YXZ');
        }
      }
    }
    if (state) {
      const seen = new Set();
      for (const p of state.players) {
        if ((p.spectating && (!p.eliminatedAt || state.time-p.eliminatedAt>.75)) || p.awaitingEntry || (p.id === local?.id && p.health > 0 && (!p.inventory || p.flight==='ground'||p.flight==='transport'))) continue;
        seen.add(p.id);
        const sig =
          p.color +
          p.hat + JSON.stringify([p.pattern,p.finish,p.eyewear,p.accent]) +
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
          const aura = new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0x83e6ff,transparent:true,opacity:.18,depthWrite:false,wireframe:true}));
          aura.position.y=.9;aura.scale.set(.73,1.04,.73);model.add(aura);model.userData.bonusAura=aura;
          model.userData.signature = sig;
          const name = label(
            p.name,
            p.team === 0 && mode(state.options.mode).teams
              ? "#b3f2ff"
              : "#ffffff",
          );
          name.position.y = 2.08;
          name.visible = !state.royale;
          model.add(name);
          this.actors.add(model);
          this.models.set(p.id, model);
          model.position.set(p.x, p.y, p.z);
        }
        const draw=equipPose(p,state.time);
        if(model.userData.arms?.userData.id!==gun(p).id){
          this.clearOutgoing(model.userData);
          const old=model.userData.held;
          if(draw.holster<1){
            updateArms(model.userData.arms,-1,model.userData.blaster);
            model.userData.outgoing={group:old,position:old.position.clone(),rotation:old.rotation.clone()};
          }else{old.removeFromParent();this.disposeGroup(old);}
          const held=new THREE.Group(),blaster=makeBlaster(gun(p).id),arms=makeArms(gun(p).id,p,false);
          held.scale.setScalar(VIEWMODEL.scale);held.add(blaster,arms);model.add(held);
          Object.assign(model.userData,{held,blaster,arms,armRecoil:0});
        }
        this.lowerOutgoing(model.userData,draw,p.health>0);
        model.userData.draw=draw;
        // Continuous time-based gait; network snapshots never jump the phase.
        const walking = p.health > 0 && p.grounded && p.moving;
        const gait = model.userData.gait = THREE.MathUtils.lerp(
          model.userData.gait || 0, walking ? 1 : 0, 1 - Math.exp(-dt * 6));
        const stride = model.userData.stride = (model.userData.stride || 0) + dt * 4.4 * gait;
        const bob = (1 - Math.cos(stride * 2)) * 0.014 * gait;
        const deathAge = p.health <= 0 ? state.time - (p.eliminatedAt ?? p.respawnAt - 3) : 0;
        model.visible = p.health > 0 || deathAge < 0.75;
        model.userData.cracks.forEach((crack, i) => {
          crack.visible = p.health < 100 && i < Math.ceil((1-p.health/100)*12);
        });

        if (model.userData.arms) {
          const recoil = model.userData.armRecoil = Math.max(0, (model.userData.armRecoil || 0) - dt * 7);
          const hands = updateArms(model.userData.arms, draw.active?-1:reloadProgress(p, state.time), model.userData.blaster, recoil,draw.progress);
          const throwT=(this.clock-(model.userData.throwStart??-Infinity))/.78;
          if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1)throwArms(model.userData.arms,throwT);
          model.userData.held.visible=draw.visible;
          model.userData.held.rotation.set(p.pitch + hands.rotation[0] + recoil * .045 + draw.rotation[0], hands.rotation[1]+draw.rotation[1], hands.rotation[2]+draw.rotation[2]);
          model.userData.held.position.set(VIEWMODEL.x+draw.position[0],EYE+VIEWMODEL.y-hands.dip+draw.position[1]*.5,VIEWMODEL.z+draw.position[2]);
          if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1){
            const gesture=Math.sin(Math.PI*throwT);
            model.userData.held.position.y-=.16*gesture;
            model.userData.held.rotation.x+=.16*gesture;
          }
        }
        // Do not let cosmetic smoothing leave a moving shell behind its hitbox.
        const base = model.userData.basePosition ||= new THREE.Vector3(p.x, p.y, p.z);
        const targetPosition = new THREE.Vector3(p.x, p.y, p.z);
        base.lerp(targetPosition, Math.min(1, dt * 18));
        const lag = base.clone().sub(targetPosition).clampLength(0, 0.04);
        base.copy(targetPosition).add(lag);
        model.position.copy(base);
        let delta = p.yaw - model.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        model.rotation.y += delta * Math.min(1, dt * 18);
        model.scale.setScalar(
          state.time < p.shieldUntil
            ? 1.03 + Math.sin(this.clock * 10) * 0.02
            : 1,
        );
        model.scale.multiplyScalar(p.bodyScale || 1);
        const aura=model.userData.bonusAura;
        aura.visible=p.health>0&&(p.streakArmor>0||p.damageUntil>state.time);
        aura.material.color.setHex(p.damageUntil>state.time?0xff625f:0x83e6ff);
        aura.material.opacity=.13+Math.sin(this.clock*5)*.05;
        if (p.health <= 0) {
          const collapse = Math.min(1, Math.max(0, deathAge - 0.2) / 0.55);
          model.scale.set(1 + collapse * 0.25, 1 - collapse * 0.95, 1 + collapse * 0.25);
          model.rotation.z = collapse * 0.35;
        } else {
          model.rotation.z = Math.sin(stride) * 0.27 * gait;
          model.rotation.x = Math.cos(stride * 2) * 0.015 * gait;
          // Rotate around the shell center, not its feet: the wide waddle no
          // longer swings the visible upper body outside the collision shell.
          const pivot = new THREE.Vector3(0, 0.88, 0);
          const rotatedPivot = pivot.clone().multiply(model.scale).applyEuler(model.rotation);
          model.position.add(pivot).sub(rotatedPivot);
          model.position.y += bob;
        }
        if(p.inventory)this.royaleView.animateActor(model,p,this.clock);
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
          if(bolt)mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,3,6),new THREE.MeshStandardMaterial({color:0xe4bc78,roughness:.4,metalness:.55}));
          else if(b.popper){mesh=this.royaleView.itemModel({id:'popper',count:1},false);mesh.scale.setScalar(.65);}
          else mesh=this.rocketModel();
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
        if(!b.popper&&b.kind!=='bolt'){
          if(mesh.userData.flame)mesh.userData.flame.scale.y=.75+Math.sin(this.clock*45)*.25;
          if(state.phase==='playing'&&this.clock>(mesh.userData.smokeAt||0)){
            mesh.userData.smokeAt=this.clock+.07;
            const smoke=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),new THREE.MeshBasicMaterial({color:0xc7cbd3,transparent:true,opacity:.4,depthWrite:false}));
            smoke.position.copy(mesh.position);this.effects.add(smoke);this.fx.push({mesh:smoke,life:.6,max:.6,smoke:true,ownedMaterial:true,ownedGeometry:true});
          }
        }
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
      } else if (f.smoke) {
        f.mesh.scale.multiplyScalar(1+dt*1.8);f.mesh.position.y+=dt*.3;f.mesh.material.opacity=.4*f.life/f.max;
      } else if (f.damageText) {
        const age = f.max - f.life;
        const pop = (f.critical ? 1.18 : 1) * (1 + 0.4 * Math.sin(Math.min(1, age / 0.18) * Math.PI));
        const height = 88 / Math.max(1, this.canvas.clientHeight) / this.camera.projectionMatrix.elements[5];
        f.mesh.scale.set(height * 512 / 96 * pop, height * pop, 1);
        f.mesh.position.y += dt * (0.85 - age * 0.45);
        f.mesh.position.x += dt * f.drift;
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
            (aperture * VIEWMODEL.scale) / depth / (gun(local).magnification||2.5),
          ),
      );
      this.scopeCamera.updateProjectionMatrix();
      this.gunGroup.visible = false;
      this.renderer.setRenderTarget(this.scopeTarget);
      this.renderer.render(this.scene, this.scopeCamera);
      this.renderer.setRenderTarget(null);
      this.gunGroup.visible = true;
    }
    this.royaleView.update(state,local,dt,playing);
    this.renderer.render(this.scene, this.camera);
  }
}
