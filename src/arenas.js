import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceAt } from "./maps.js";

// Static architecture is baked by material after construction to keep school-laptop draw calls low.
export function buildArena(world, map, kit) {
  const { block, ball, cylinder, mat, palette } = kit;
  const colors = { path: 0xded4b8, plaza: 0xe7d6b9, asphalt: 0x526c79 };
  block(
    world,
    0,
    -0.5,
    0,
    map.size * 2 + 70,
    0.6,
    map.size * 2 + 70,
    map.theme === "harbor" ? 0x588fa5 : map.ground,
  );
  block(world, 0, -0.12, 0, map.size * 2, 0.24, map.size * 2, map.ground);
  for (const [i, [x, z, w, d, c]] of map.lanes.entries())
    block(world, x, 0.016 + i * 0.002, z, w, 0.028, d, colors[c]);
  // Paving joints and road markings supply scale and readable routes.
  if (map.theme === "harbor") {
    for (let x = -34; x < 36; x += 5)
      for (const z of [-5, 5])
        block(world, x, 0.061, z, 2.3, 0.02, 0.13, 0xf3cb72);
    for (const x of [-28, 28])
      for (let z = -33; z < 35; z += 5)
        block(world, x, 0.062, z, 0.13, 0.02, 2.4, 0xc4d1ca);
  } else {
    for (let i = -36; i <= 36; i += 3) {
      block(world, i, 0.057, 0, 0.025, 0.015, 11, 0xc2b99e);
      block(world, 0, 0.058, i, 11, 0.015, 0.025, 0xc2b99e);
    }
  }
  for (const b of map.boxes) {
    const color = palette[b.color] || palette.sand;
    const structure = block(
      world,
      b.x,
      b.y + b.h / 2,
      b.z,
      b.w,
      b.h,
      b.d,
      color,
    );
    if (b.kind === "glass") {
      structure.material = new THREE.MeshStandardMaterial({
        color: 0x8fbeb2,
        transparent: true,
        opacity: 0.24,
        roughness: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      structure.userData.ownedMaterial = true;
    }
    if (b.kind === "boundary") {
      block(
        world,
        b.x,
        b.y + b.h + 0.06,
        b.z,
        b.w + 0.15,
        0.17,
        b.d + 0.15,
        map.theme === "town" ? 0xf4d9b6 : 0x779096,
      );
      const alongX = b.w > b.d,
        length = Math.max(b.w, b.d);
      for (let v = -length / 2 + 5; v < length / 2; v += 8)
        block(
          world,
          b.x + (alongX ? v : 0),
          2.7,
          b.z + (alongX ? 0 : v),
          alongX ? 0.35 : b.w + 0.15,
          5.6,
          alongX ? b.d + 0.15 : 0.35,
          0x829a98,
        );
    }
    if (b.kind === "container") {
      const long = b.w > b.d;
      for (
        let i = -Math.max(b.w, b.d) / 2 + 0.25;
        i < Math.max(b.w, b.d) / 2;
        i += 0.65
      )
        for (const side of [-1, 1])
          block(
            world,
            b.x + (long ? i : side * (b.w / 2 + 0.025)),
            b.y + b.h / 2,
            b.z + (long ? side * (b.d / 2 + 0.025) : i),
            long ? 0.065 : 0.075,
            b.h - 0.22,
            long ? 0.075 : 0.065,
            color,
          );
      for (const y of [b.y + 0.08, b.y + b.h - 0.08])
        block(world, b.x, y, b.z, b.w + 0.1, 0.15, b.d + 0.1, 0x324f61);
      for (const side of [-1, 1])
        for (const offset of [-0.65, 0.65])
          block(
            world,
            b.x + (long ? side * (b.w / 2 + 0.025) : offset),
            b.y + b.h / 2,
            b.z + (long ? offset : side * (b.d / 2 + 0.025)),
            long ? 0.04 : 0.06,
            b.h - 0.45,
            long ? 0.06 : 0.04,
            0xd4dbd1,
          );
    }
    if (b.kind === "crate")
      for (const y of [b.y + 0.15, b.y + b.h - 0.15])
        block(world, b.x, y, b.z, b.w + 0.045, 0.15, b.d + 0.045, 0x786755);
    if (["terrace", "deck", "step", "bridge"].includes(b.kind)) {
      block(
        world,
        b.x,
        b.y + b.h + 0.016,
        b.z,
        b.w,
        0.028,
        b.d,
        map.theme === "harbor" ? 0x829aa2 : 0xe6dfc9,
      );
      if (b.kind === "bridge")
        for (let x = b.x - b.w / 2 + 0.3; x < b.x + b.w / 2; x += 1)
          block(world, x, b.y + b.h + 0.035, b.z, 0.055, 0.02, b.d, 0x495e69);
    }
    if (b.kind === "planter") {
      block(
        world,
        b.x,
        b.y + b.h + 0.03,
        b.z,
        b.w - 0.2,
        0.06,
        b.d - 0.2,
        0x64715b,
      );
      const long = b.w > b.d,
        count = Math.ceil(Math.max(b.w, b.d) / 1.8);
      for (let i = 0; i < count; i++)
        ball(
          world,
          b.x + (long ? (i - (count - 1) / 2) * 1.5 : 0),
          b.y + b.h + 0.3,
          b.z + (long ? 0 : (i - (count - 1) / 2) * 1.5),
          long ? 0.85 : b.w * 0.42,
          0.4,
          long ? b.d * 0.42 : 0.85,
          i % 2 ? 0x839c61 : 0x6f915e,
        );
    }
    if (b.kind === "facade") {
      block(world, b.x, b.h + 0.1, b.z, b.w + 0.35, 0.22, b.d + 0.35, 0xf3dcc0);
      for (const z of [b.z - b.d / 2 - 0.025, b.z + b.d / 2 + 0.025])
        for (let x = b.x - b.w / 2 + 1.8; x < b.x + b.w / 2 - 1; x += 3.2) {
          block(world, x, 1.9, z, 1.2, 1.6, 0.09, 0xf4dec2);
          block(
            world,
            x,
            1.9,
            z + (z < b.z ? -0.06 : 0.06),
            0.9,
            1.3,
            0.035,
            0x385c70,
          );
          block(
            world,
            x,
            1.9,
            z + (z < b.z ? -0.09 : 0.09),
            0.06,
            1.3,
            0.03,
            0xcfae85,
          );
          if (b.h > 5) {
            block(world, x, 4.8, z, 1.2, 1.5, 0.07, 0xf4dec2);
            block(
              world,
              x,
              4.8,
              z + (z < b.z ? -0.05 : 0.05),
              0.9,
              1.2,
              0.04,
              0x385c70,
            );
          }
        }
      for (const x of [b.x - b.w / 2 - 0.02, b.x + b.w / 2 + 0.02])
        for (let z = b.z - b.d / 2 + 2; z < b.z + b.d / 2 - 1; z += 3.5) {
          block(world, x, 1.9, z, 0.08, 1.6, 1.2, 0xf4dec2);
          block(
            world,
            x + (x < b.x ? -0.05 : 0.05),
            1.9,
            z,
            0.04,
            1.3,
            0.9,
            0x385c70,
          );
        }
    }
    if (b.kind === "arch") {
      // Carved keystones surround a physically open passage.
      for (let t = -0.4; t <= 0.4; t += 0.2)
        block(
          world,
          b.x + (b.w > b.d ? t * b.w : 0),
          b.y + 0.43,
          b.z + (b.d > b.w ? t * b.d : 0),
          b.w > b.d ? 0.55 : b.w + 0.12,
          0.72,
          b.d > b.w ? 0.55 : b.d + 0.12,
          0xf0dec3,
        );
    }
    if (b.kind === "generator")
      for (let i = 0; i < 6; i++)
        block(
          world,
          b.x - 2 + i * 0.7,
          b.h / 2,
          b.z - b.d / 2 - 0.04,
          0.35,
          1.3,
          0.08,
          0x2a4859,
        );
    if (b.kind === "fountain") {
      block(world, b.x, b.h + 0.02, b.z, b.w - 0.5, 0.04, b.d - 0.5, 0x6cafb4);
      cylinder(world, b.x, b.h + 0.7, b.z, 0.32, 1.4, 0xeddcc6);
      ball(world, b.x, b.h + 1.4, b.z, 0.5, 0.28, 0.5, 0xefc96a);
    }
  }
  for (const [x, z, type, text] of map.props) {
    const y = surfaceAt(map, x, z);
    if (type === "pergola" || type === "glasshouse") {
      const base = type === "glasshouse" ? 1.1 : y,
        width = 8,
        depth = 8,
        top = base + 3.4;
      for (let i = -4; i <= 4; i++)
        block(world, x + i, top, z, 0.14, 0.18, depth + 0.6, 0x79978c);
      for (const dz of [-4, 4])
        block(world, x, top - 0.2, z + dz, 8.5, 0.22, 0.16, 0x617c75);
      if (type === "glasshouse") {
        // Transparent roof panels are visual; low masonry and columns provide collision below.
        const material = new THREE.MeshStandardMaterial({
          color: 0xa0d9cf,
          transparent: true,
          opacity: 0.23,
          roughness: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const roof = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), material);
        roof.rotation.x = -Math.PI / 2;
        roof.position.set(x, top - 0.05, z);
        roof.userData.ownedMaterial = true;
        world.add(roof);
      }
    }
    if (type === "awning")
      for (let i = 0; i < 12; i++)
        block(
          world,
          x - 4.2 + i * 0.75,
          y + 0.24,
          z - 5.8,
          0.76,
          0.13,
          2.4,
          i % 2 ? 0xf5debc : 0xcb795c,
        );
    if (type === "bell" || type === "roof") {
      const top = y;
      if (type === "bell") {
        for (const dx of [-1.3, 1.3])
          for (const dz of [-1.3, 1.3])
            block(world, x + dx, top + 1.8, z + dz, 0.48, 3.6, 0.48, 0xefcfaa);
        block(world, x, top + 3.8, z, 3.6, 0.4, 3.6, 0xa76451);
        cylinder(world, x, top + 2.6, z, 0.54, 0.8, 0xdca54b);
        ball(world, x, top + 2.08, z, 0.28, 0.15, 0.28, 0xdca54b);
      } else
        for (let i = 0; i < 5; i++)
          block(
            world,
            x,
            top + i * 0.28,
            z,
            10 - i * 1.8,
            0.32,
            12 - i * 2,
            0xb97560,
          );
    }
    if (type === "lamp") {
      cylinder(world, x, 2.4, z, 0.08, 4.8, 0x465962);
      block(world, x, 4.9, z, 0.52, 0.7, 0.52, 0xffdb89);
      block(world, x, 5.3, z, 0.7, 0.12, 0.7, 0x465962);
    }
    if (type === "crane") {
      block(world, x, 10, z, 1.7, 20, 1.7, 0xdab05c);
      block(world, x, 19.5, z, 3, 2, 3, 0xe6bd68);
      block(world, x, 21, z, 25, 0.8, 0.8, 0xe6bd68);
      for (let j = -11; j < 12; j += 3)
        block(world, x + j, 20.8, z, 0.18, 1.8, 1, 0x596f78);
      cylinder(world, x + 10, 15, z, 0.055, 12, 0x2e4758);
      block(world, x + 10, 9, z, 0.8, 0.7, 0.6, 0x2e4758);
    }
    if (type === "ship") {
      block(world, x, -0.6, z, 22, 2, 6, 0x263f55);
      block(world, x + 5, 1.4, z, 6, 3, 4, 0xe3e5d7);
      block(world, x - 3, 1.4, z, 8, 2.8, 4, 0xbc715c);
    }
    if (type === "sign") {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 192;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#243c4e";
      ctx.fillRect(0, 0, 1024, 192);
      ctx.fillStyle = "#f6e8be";
      ctx.font = "800 56px Arial";
      ctx.textAlign = "center";
      ctx.fillText(text, 512, 114);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.8), material);
      mesh.position.set(x, 5.9, z);
      mesh.userData.ownedMaterial = true;
      world.add(mesh);
    }
  }
  // The perimeter scenery gives each arena a different skyline.
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18,
      r = map.size + 9,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r;
    if (map.theme === "town") {
      block(
        world,
        x,
        3.5 + (i % 3),
        z,
        6,
        7 + (i % 3) * 2,
        7,
        i % 2 ? 0xd7aa88 : 0xc68d70,
      );
      block(world, x, 7.4 + (i % 3) * 2, z, 6.5, 0.45, 7.5, 0x9a6e61);
    } else if (map.theme === "garden") {
      cylinder(world, x, 2, z, 0.4, 4, 0x8b7960);
      for (let j = 0; j < 3; j++)
        ball(
          world,
          x + (j - 1),
          4.5 + j * 0.5,
          z,
          2.3,
          2.2,
          2.3,
          j % 2 ? 0x73916b : 0x90a375,
        );
    } else if (i % 2 === 0) {
      block(world, x, 4, z, 9, 8, 7, 0x778e96);
      block(world, x, 8.3, z, 9.5, 0.6, 7.5, 0x526b7b);
    }
  }
  const groups = new Map();
  world.updateMatrixWorld(true);
  for (const child of [...world.children])
    if (child.isMesh && !child.userData.ownedMaterial) {
      const key = child.material.uuid;
      if (!groups.has(key))
        groups.set(key, { material: child.material, parts: [] });
      const g = child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone();
      g.applyMatrix4(child.matrixWorld);
      groups.get(key).parts.push(g);
      world.remove(child);
      if (
        !child.geometry.userData.shared &&
        child.geometry.type === "CylinderGeometry"
      )
        child.geometry.dispose();
    }
  for (const group of groups.values()) {
    const geometry = mergeGeometries(group.parts);
    group.parts.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, group.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
  }
}
