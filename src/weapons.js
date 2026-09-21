import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { weapon } from "./data.js";

// The same authored model is used in the player's hands, on other eggs, and in previews.
const materials = new Map();
const geometries = new Map();
const color = (hex, metal = false) => {
  const key = `${hex}:${metal}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: metal ? 0.32 : 0.58,
        metalness: metal ? 0.68 : 0.12,
      }),
    );
  return materials.get(key);
};
const cached = (key, create) => {
  if (!geometries.has(key)) {
    const g = create();
    g.userData.shared = true;
    geometries.set(key, g);
  }
  return geometries.get(key);
};
function part(parent, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function box(g, x, y, z, w, h, d, c, bevel = 0.025, metal = false) {
  const key = `box:${w}:${h}:${d}:${bevel}`;
  return part(
    g,
    cached(
      key,
      () =>
        new RoundedBoxGeometry(
          w,
          h,
          d,
          2,
          Math.min(bevel, w / 3, h / 3, d / 3),
        ),
    ),
    color(c, metal),
    [x, y, z],
  );
}
function tube(g, x, y, z, r, length, c, open = false) {
  const m = part(
    g,
    cached(
      `tube:${r}:${length}:${open}`,
      () => new THREE.CylinderGeometry(r, r, length, 24, 1, open),
    ),
    color(c, true),
    [x, y, z],
  );
  m.rotation.x = Math.PI / 2;
  return m;
}
function ring(g, x, y, z, r, t, c) {
  return part(
    g,
    cached(`ring:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 8, 32)),
    color(c, true),
    [x, y, z],
  );
}
function plate(g, points, thickness, c, x = 0) {
  const key = `plate:${JSON.stringify(points)}:${thickness}`;
  const geo = cached(key, () => {
    const s = new THREE.Shape();
    points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    // Shape X is length; extrusion becomes width. Forward is -Z.
    geo.rotateY(-Math.PI / 2);
    geo.translate(thickness / 2, 0, 0);
    return geo;
  });
  return part(g, geo, color(c), [x, 0, 0]);
}
const dark = 0x253444,
  black = 0x132331,
  steel = 0x667c88,
  cream = 0xf5edd5;
function grip(g, z = 0.12) {
  const m = box(g, 0, -0.24, z, 0.14, 0.3, 0.18, dark);
  m.rotation.x = -0.18;
  for (let i = 0; i < 4; i++)
    box(g, 0, -0.14 - i * 0.052, z + 0.055, 0.15, 0.014, 0.08, black, 0.004);
  box(g, 0, -0.2, z - 0.145, 0.14, 0.032, 0.18, steel, 0.01, true);
  box(g, 0, -0.1, z - 0.23, 0.11, 0.18, 0.028, dark, 0.01);
}
function stock(g, c, z = 0.35) {
  plate(
    g,
    [
      [z, -0.06],
      [z + 0.4, -0.12],
      [z + 0.45, 0.1],
      [z + 0.14, 0.13],
      [z, 0.07],
    ],
    0.16,
    c,
  );
  box(g, 0, -0.04, z + 0.43, 0.19, 0.27, 0.07, dark);
  box(g, 0, 0.13, z + 0.22, 0.14, 0.08, 0.25, dark);
}
function vents(g, z, count, width = 0.25, spacing = 0.07) {
  for (let i = 0; i < count; i++)
    for (const x of [-width / 2, width / 2])
      box(g, x, 0.018, z - i * spacing, 0.008, 0.065, 0.028, black, 0.003);
}
function optic(g, kind, frontZ = -0.7) {
  const sightY = 0.285;
  if (kind === "iron") {
    box(g, 0, 0.109, 0.15, 0.18, 0.035, 0.09, dark, 0.007);
    for (const x of [-0.066, 0.066])
      box(g, x, 0.17, 0.15, 0.032, 0.12, 0.045, steel, 0.006, true);
    box(g, 0, 0.1, frontZ, 0.14, 0.1, 0.09, steel, 0.009, true);
    box(g, 0, 0.185, frontZ, 0.022, 0.07, 0.04, cream, 0.005);
    g.userData.sightY = 0.22;
    return;
  }
  if (kind === "scope" || kind === "prism") {
    const radius = kind === "scope" ? 0.137 : 0.115;
    for (const z of [-0.1, 0.15]) {
      box(g, 0, 0.17, z, 0.12, 0.14, 0.075, dark);
      ring(g, 0, sightY, z, radius + 0.009, 0.018, steel);
    }
    tube(g, 0, sightY, 0.02, radius, 0.54, dark, true);
    ring(g, 0, sightY, 0.302, radius, 0.026, black);
    ring(g, 0, sightY, 0.328, radius + 0.012, 0.015, steel);
    ring(g, 0, sightY, -0.27, radius, 0.027, dark);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      box(
        g,
        Math.sin(a) * (radius + 0.018),
        sightY + Math.cos(a) * (radius + 0.018),
        0.2,
        0.023,
        0.023,
        0.08,
        dark,
        0.004,
      );
    }
    const dial = part(
      g,
      cached("dial", () => new THREE.CylinderGeometry(0.055, 0.055, 0.07, 16)),
      color(dark, true),
      [0, sightY + radius + 0.035, 0.03],
    );
    box(g, 0.16, sightY, 0.02, 0.07, 0.08, 0.08, steel, 0.015, true);
    const lens = part(
      g,
      cached(
        `lens:${radius}`,
        () => new THREE.CircleGeometry(radius - 0.012, 48),
      ),
      new THREE.MeshBasicMaterial({ color: 0x3c8290 }),
      [0, sightY, 0.333],
    );
    lens.userData.ownedMaterial = true;
    g.userData.lens = lens;
    g.userData.optic = kind;
    g.userData.sightY = sightY;
  } else {
    box(g, 0, 0.17, 0.02, 0.23, 0.035, 0.25, black, 0.012);
    for (const x of [-0.115, 0.115])
      box(g, x, 0.285, 0.02, 0.035, 0.23, 0.09, dark, 0.012, true);
    box(g, 0, 0.4, 0.02, 0.24, 0.035, 0.09, steel, 0.012, true);
    const glass = part(
      g,
      cached("reflexglass", () => new THREE.PlaneGeometry(0.19, 0.2)),
      new THREE.MeshBasicMaterial({
        color: 0x7ed7dc,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      [0, 0.285, 0.068],
    );
    glass.userData.ownedMaterial = true;
    const dot = part(
      g,
      cached("dot", () => new THREE.CircleGeometry(0.006, 16)),
      new THREE.MeshBasicMaterial({ color: 0xff593c, toneMapped: false }),
      [0, 0.285, 0.071],
    );
    dot.userData.ownedMaterial = true;
    g.userData.sightY = sightY;
    g.userData.optic = "reflex";
  }
}
export function makeBlaster(id) {
  const w = weapon(id),
    g = new THREE.Group(),
    c = w.color;
  g.name = `${w.name} blaster`;
  if (id === "pip") {
    box(g, 0, 0.02, -0.04, 0.19, 0.17, 0.54, c);
    box(g, 0, -0.05, 0.01, 0.17, 0.13, 0.36, dark);
    grip(g, 0.12);
    tube(g, 0, 0.015, -0.34, 0.05, 0.18, steel);
    ring(g, 0, 0.015, -0.435, 0.05, 0.012, c);
    for (let i = 0; i < 5; i++)
      box(g, 0.101, 0.04, 0.07 + i * 0.025, 0.009, 0.085, 0.009, dark, 0.002);
    g.userData.reloadPart = box(g, 0, -.405, .12, .13, .13, .14, steel);
    optic(g, "iron", -0.24);
  } else if (id === "scatter") {
    box(g, 0, 0, 0.08, 0.3, 0.23, 0.46, c);
    grip(g, 0.17);
    stock(g, c, 0.31);
    for (const x of [-0.09, 0.09]) {
      tube(g, x, 0, -0.44, 0.075, 0.84, steel);
      ring(g, x, 0, -0.88, 0.078, 0.022, dark);
      tube(g, x, 0, -0.898, 0.05, 0.016, black);
    }
    box(g, 0, -0.065, -0.48, 0.28, 0.19, 0.32, c);
    for (let i = 0; i < 6; i++)
      box(g, 0, -0.072, -0.34 - i * 0.05, 0.297, 0.19, 0.019, dark, 0.005);
    for (let i = 0; i < 3; i++)
      tube(g, 0.19, -0.02, -0.02 + i * 0.085, 0.034, 0.065, cream);
    optic(g, "iron");
  } else if (id === "needle") {
    plate(
      g,
      [
        [0.45, -0.08],
        [0.27, -0.15],
        [-0.32, -0.07],
        [-0.42, 0.05],
        [-0.24, 0.12],
        [0.4, 0.12],
      ],
      0.22,
      c,
    );
    grip(g, 0.13);
    stock(g, c, 0.39);
    tube(g, 0, 0, -0.66, 0.044, 0.82, steel);
    tube(g, 0, 0, -0.96, 0.062, 0.23, dark);
    ring(g, 0, 0, -1.087, 0.058, 0.012, c);
    g.userData.reloadPart = box(g, 0, -0.23, -0.15, 0.14, 0.27, 0.16, dark);
    vents(g, -0.23, 4, 0.225, 0.055);
    for (const x of [-0.1, 0.1]) {
      const leg = box(g, x, -0.18, -0.56, 0.038, 0.3, 0.04, steel, 0.008, true);
      leg.rotation.z = x > 0 ? -0.3 : 0.3;
    }
    tube(g, 0.16, 0.035, 0.13, 0.035, 0.1, steel);
    box(g, 0.19, 0.01, 0.16, 0.06, 0.07, 0.07, dark);
    optic(g, "scope");
  } else if (id === "thumper") {
    // Closed breech and compact barrel: no open rear tube facing the camera.
    box(g, 0, -0.025, 0.055, 0.29, 0.27, 0.39, c, 0.045);
    tube(g, 0, 0, -0.35, 0.15, 0.69, c);
    for (const z of [-0.08, -0.5, -0.69])
      ring(g, 0, 0, z, 0.151, 0.018, dark);
    tube(g, 0, 0, -0.702, 0.12, 0.017, black);
    ring(g, 0, 0, -0.723, 0.129, 0.014, steel);
    grip(g, 0.17);
    stock(g, c, 0.29);
    box(g, 0, -0.16, -0.3, 0.19, 0.11, 0.3, dark);
    for (const x of [-0.151, 0.151])
      box(g, x, 0, -0.3, 0.018, 0.038, 0.3, 0xa3efe7, 0.006);
    optic(g, "reflex");
  } else if (id === "zipper") {
    plate(
      g,
      [
        [0.24, -0.1],
        [-0.33, -0.1],
        [-0.48, 0.04],
        [-0.29, 0.13],
        [0.18, 0.15],
        [0.31, 0.07],
      ],
      0.25,
      c,
    );
    grip(g, 0.13);
    g.userData.reloadPart = box(g, 0, -0.22, -0.16, 0.14, 0.34, 0.16, dark);
    for (const x of [-0.095, 0.095])
      box(g, x, 0.035, 0.46, 0.035, 0.075, 0.42, steel, 0.01, true);
    box(g, 0, -0.025, 0.66, 0.2, 0.23, 0.055, dark);
    tube(g, 0, 0, -0.53, 0.067, 0.24, steel);
    ring(g, 0, 0, -0.668, 0.068, 0.02, dark);
    vents(g, -0.14, 4, 0.263);
    optic(g, "reflex");
  } else if (id === "anchor") {
    box(g, 0, 0, 0.03, 0.34, 0.27, 0.6, c);
    grip(g, 0.2);
    stock(g, c, 0.37);
    tube(g, 0, 0, -0.48, 0.13, 0.52, dark);
    tube(g, 0, 0, -0.8, 0.065, 0.22, steel);
    ring(g, 0, 0, -0.93, 0.077, 0.023, c);
    for (let i = 0; i < 5; i++)
      ring(g, 0, 0, -0.27 - i * 0.085, 0.132, 0.015, steel);
    g.userData.reloadPart = box(g, 0, -0.26, -0.045, 0.34, 0.31, 0.32, dark);

    for (let i = 0; i < 5; i++)
      box(
        g,
        -0.2 - i * 0.018,
        -0.055 - i * 0.023,
        0.04,
        0.065,
        0.034,
        0.075,
        cream,
        0.008,
        true,
      );
    for (const x of [-0.12, 0.12]) {
      const leg = box(
        g,
        x,
        -0.19,
        -0.59,
        0.044,
        0.34,
        0.04,
        steel,
        0.008,
        true,
      );
      leg.rotation.z = x > 0 ? -0.3 : 0.3;
    }
    optic(g, "reflex");
  } else if (id === "duet") {
    plate(
      g,
      [
        [0.58, -0.13],
        [-0.33, -0.11],
        [-0.46, 0.035],
        [-0.23, 0.15],
        [0.47, 0.15],
        [0.61, 0.03],
      ],
      0.27,
      c,
    );
    grip(g, -0.03);
    g.userData.reloadPart = box(g, 0, -0.25, 0.35, 0.16, 0.27, 0.18, dark);
    box(g, 0, -0.025, 0.61, 0.28, 0.28, 0.055, dark);
    box(g, 0, -0.07, -0.4, 0.23, 0.17, 0.24, steel);
    tube(g, 0, 0, -0.68, 0.052, 0.42, dark);
    ring(g, 0, 0, -0.9, 0.068, 0.018, c);
    vents(g, -0.11, 4, 0.285, 0.065);
    optic(g, "prism");
  } else {
    plate(
      g,
      [
        [0.32, -0.09],
        [-0.3, -0.11],
        [-0.44, 0.04],
        [-0.25, 0.15],
        [0.29, 0.14],
      ],
      0.25,
      c,
    );
    grip(g, 0.13);
    stock(g, c, 0.35);
    const mag = box(g, 0, -0.24, -0.1, 0.15, 0.32, 0.2, dark);
    mag.rotation.x = 0.13;
    g.userData.reloadPart = mag;
    box(g, 0, 0.015, -0.43, 0.23, 0.19, 0.32, steel);
    vents(g, -0.32, 5, 0.24, 0.045);
    tube(g, 0, 0, -0.72, 0.052, 0.3, dark);
    ring(g, 0, 0, -0.895, 0.063, 0.02, c);
    optic(g, "reflex");
  }
  if (id === "scatter" || id === "thumper") {
    const token = tube(g, 0, 0, 0, id === "thumper" ? .085 : .05, id === "thumper" ? .28 : .15, c);
    token.visible = false;
    g.userData.reloadToken = token;
  }
  // Small construction details break up broad surfaces while keeping readable silhouettes.
  const detailX =
    {
      pip: 0.099,
      scatter: 0.154,
      needle: 0.12,
      zipper: 0.135,
      thumper: 0.151,
      anchor: 0.174,
      duet: 0.145,
      sprinter: 0.135,
    }[id] || 0.135;
  for (const x of [-1, 1]) {
    box(g, x * detailX, 0.03, 0.11, 0.012, 0.032, 0.09, cream, 0.004);
    for (const z of [0.04, 0.2]) {
      const bolt = part(
        g,
        cached(
          "bolt",
          () => new THREE.CylinderGeometry(0.014, 0.014, 0.008, 8),
        ),
        color(steel, true),
        [x * (detailX - 0.001), -0.06, z],
      );
      bolt.rotation.z = Math.PI / 2;
    }
  }
  // Bake static details by material: detail does not require a draw call per screw.
  g.updateMatrixWorld(true);
  const batches = new Map();
  for (const object of [...g.children])
    if (object.isMesh && !object.userData.ownedMaterial && object !== g.userData.reloadPart && object !== g.userData.reloadToken) {
      const key = object.material.uuid;
      if (!batches.has(key))
        batches.set(key, { material: object.material, parts: [] });
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      batches.get(key).parts.push(geometry);
      g.remove(object);
    }
  for (const [key, batch] of batches) {
    const geometry = cached(`model:${id}:${key}`, () =>
      mergeGeometries(batch.parts),
    );
    batch.parts.forEach((p) => p.dispose());
    part(g, geometry, batch.material, [0, 0, 0]);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle";
  muzzle.position.set(0, 0, -w.muzzle);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.userData.sightY = w.sightY;
  return g;
}
export function disposeBlaster(group) {
  group.traverse((o) => {
    if (o.userData.ownedMaterial) {
      o.material.dispose();
    }
  });
}

export function weaponPortrait(renderer, id) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe5e9e4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x768697, 3));
  const key = new THREE.DirectionalLight(0xffefd6, 4);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x94d9ff, 3);
  rim.position.set(-3, 2, -4);
  scene.add(rim);
  const model = makeBlaster(id);
  scene.add(model);
  const bounds = new THREE.Box3().setFromObject(model),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  model.position.sub(center);
  const distance = Math.max(size.z / 2.75, size.y) * 0.85;
  const camera = new THREE.OrthographicCamera(
    -distance * 1.8,
    distance * 1.8,
    distance,
    -distance,
    0.01,
    20,
  );
  camera.position.set(3.5, 1.55, 1.6);
  camera.lookAt(0, 0, 0);
  const width = 600,
    height = 334,
    target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(previous);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d"),
    data = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++)
    data.data.set(
      pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
      y * width * 4,
    );
  ctx.putImageData(data, 0, 0);
  const result = canvas.toDataURL("image/png");
  target.dispose();
  disposeBlaster(model);
  return result;
}

