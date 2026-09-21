import {ROYALE_MAP} from './royale-map.js';
import {groundAt} from './terrain.js';
const box = (x, z, w, d, h, color = "sand", y = 0, kind = "wall") => ({
  x,
  z,
  w,
  d,
  h,
  color,
  y,
  kind,
});
const perimeter = (size) => [
  box(-size - 1, 0, 2, size * 2 + 4, 5, "navy", 0, "boundary"),
  box(size + 1, 0, 2, size * 2 + 4, 5, "navy", 0, "boundary"),
  box(0, -size - 1, size * 2, 2, 5, "navy", 0, "boundary"),
  box(0, size + 1, size * 2, 2, 5, "navy", 0, "boundary"),
];
const stairs = (x, z, axis, sign = 1, count = 8, width = 4) =>
  Array.from({ length: count }, (_, i) =>
    box(
      x + (axis === "x" ? i * 1.5 * sign : 0),
      z + (axis === "z" ? i * 1.5 * sign : 0),
      axis === "x" ? 1.52 : width,
      axis === "z" ? 1.52 : width,
      (i + 1) * 0.4,
      "stone",
      0,
      "step",
    ),
  );
const spawns = (size) => [
  [-size + 5, -size + 5],
  [size - 5, size - 5],
  [-size + 5, size - 5],
  [size - 5, -size + 5],
  [-size + 5, 0],
  [size - 5, 0],
  [0, -size + 5],
  [0, size - 5],
];
const crate = (x, z, w = 2.8, d = 2.8, h = 2) =>
  box(x, z, w, d, h, "crate", 0, "crate");
const planter = (x, z, w, d) => box(x, z, w, d, 1.05, "stone", 0, "planter");
const facade = (x, z, w, d, h, color = "terracotta") =>
  box(x, z, w, d, h, color, 0, "facade");
const arch = (x, z, axis = "x", width = 8, top = 5.5) => [
  box(
    x + (axis === "x" ? -width / 2 : 0),
    z + (axis === "z" ? -width / 2 : 0),
    axis === "x" ? 1.4 : 2,
    axis === "z" ? 1.4 : 2,
    top,
    "stone",
    0,
    "column",
  ),
  box(
    x + (axis === "x" ? width / 2 : 0),
    z + (axis === "z" ? width / 2 : 0),
    axis === "x" ? 1.4 : 2,
    axis === "z" ? 1.4 : 2,
    top,
    "stone",
    0,
    "column",
  ),
  box(
    x,
    z,
    axis === "x" ? width + 1.4 : 2,
    axis === "z" ? width + 1.4 : 2,
    1,
    "stone",
    top - 1,
    "arch",
  ),
];
export const MAPS = [
  {
    id: "yard",
    name: "The Yard",
    tag: "GLASSHOUSE GARDENS • 80 × 80",
    description:
      "Garden lanes, a glasshouse, and raised observation decks around a sunken-looking central plaza.",
    size: 40,
    sky: 0xb4e0e6,
    ground: 0xc5ceac,
    accent: 0xe6bc54,
    theme: "garden",
    zone: [0, 0, 0],
    bases: [
      [-34, 0],
      [34, 0],
    ],
    spawns: spawns(40),
    lanes: [
      [-26, 0, 9, 72, "path"],
      [26, 0, 9, 72, "path"],
      [0, 0, 68, 9, "path"],
      [0, -25, 52, 7, "path"],
      [0, 25, 52, 7, "path"],
      [0, 0, 18, 18, "plaza"],
    ],
    boxes: [
      ...perimeter(40),
      // Four asymmetric garden corners, with cross routes around the central plaza.
      planter(-10, -7, 10, 2.5),
      planter(11, 8, 10, 2.5),
      planter(-7, 13, 2.5, 8),
      planter(7, -13, 2.5, 8),
      box(-17, -14, 10, 10, 3.2, "stone", 0, "terrace"),
      ...stairs(-17, -30, "z", 1, 8),
      box(17, 14, 10, 10, 3.2, "stone", 0, "terrace"),
      ...stairs(17, 30, "z", -1, 8),
      box(-17, 15, 10, 12, 1.1, "sand", 0, "glasshouse"),
      box(-21.5, 15, 0.25, 12, 3.4, "stone", 1.1, "glass"),
      box(-12.5, 15, 0.25, 12, 3.4, "stone", 1.1, "glass"),
      box(-17, 21, 10, 0.25, 3.4, "stone", 1.1, "glass"), // Open front of the greenhouse, climbable ledge.
      ...stairs(-17, 5, "z", 1, 3, 5),
      box(17, -15, 10, 11, 1.2, "sand", 0, "pavilion"),
      ...stairs(17, -6, "z", -1, 3, 5),
      ...arch(0, -26, "x", 10, 5.8),
      ...arch(0, 26, "x", 10, 5.8),
      planter(-31, -17, 4, 7),
      planter(31, 17, 4, 7),
      planter(-31, 17, 4, 7),
      planter(31, -17, 4, 7),
      crate(-6, -32),
      crate(7, 32),
      crate(-32, -7, 3, 3, 1.4),
      crate(32, 7, 3, 3, 1.4),
      box(-4, 2, 2, 4, 1.3, "stone", 0, "sculpture"),
      box(4, -2, 2, 4, 1.3, "stone", 0, "sculpture"),
    ],
    props: [
      [-17, -14, "pergola"],
      [17, 14, "pergola"],
      [-17, 15, "glasshouse"],
      [17, -15, "pergola"],
      [0, -38, "sign", "GLASSHOUSE / 01"],
    ],
    pickups: [
      [-29, -25, "health"],
      [29, 25, "health"],
      [-29, 25, "ammo"],
      [29, -25, "ammo"],
      [-17, -14, "ammo"],
      [17, 14, "ammo"],
      [0, -17, "popper"],
      [0, 17, "health"],
    ],
  },
  {
    id: "depot",
    name: "Cargo Club",
    tag: "FREIGHT HARBOR • 84 × 84",
    description:
      "A working harbor with stacked freight, a central overpass, loading decks, and wide dockside flanks.",
    size: 42,
    sky: 0xa3c7db,
    ground: 0x7f989f,
    accent: 0xedb146,
    theme: "harbor",
    zone: [0, 0, 0],
    bases: [
      [-36, 0],
      [36, 0],
    ],
    spawns: spawns(42),
    lanes: [
      [0, 0, 72, 12, "asphalt"],
      [-28, 0, 9, 76, "asphalt"],
      [28, 0, 9, 76, "asphalt"],
      [0, -28, 64, 8, "asphalt"],
      [0, 28, 64, 8, "asphalt"],
    ],
    boxes: [
      ...perimeter(42),
      box(-14, -13, 14, 5, 4, "blue", 0, "container"),
      box(14, 13, 14, 5, 4, "coral", 0, "container"),
      box(-14, 14, 5, 14, 4, "coral", 0, "container"),
      box(14, -14, 5, 14, 4, "blue", 0, "container"),
      box(-14, -13, 9, 5, 3.4, "cream", 4, "container"),
      box(14, 13, 9, 5, 3.4, "gold", 4, "container"),
      // The high bridge leaves a full-height route underneath.
      box(0, 0, 26, 5, 0.45, "steel", 3.15, "bridge"),
      box(-10, 0, 1.2, 5, 3.15, "navy"),
      box(10, 0, 1.2, 5, 3.15, "navy"),
      box(-17, 0, 8, 5, 3.2, "stone", 0, "deck"),
      box(17, 0, 8, 5, 3.2, "stone", 0, "deck"),
      ...stairs(-32.25, 0, "x", 1, 8),
      ...stairs(32.25, 0, "x", -1, 8),
      box(-9, -30, 10, 4, 2, "stone", 0, "deck"),
      ...stairs(-18, -30, "x", 1, 5),
      box(9, 30, 10, 4, 2, "stone", 0, "deck"),
      ...stairs(18, 30, "x", -1, 5),
      box(-32, -18, 4, 9, 3.4, "gold", 0, "container"),
      box(32, 18, 4, 9, 3.4, "blue", 0, "container"),
      box(-32, 18, 4, 9, 3.4, "blue", 0, "container"),
      box(32, -18, 4, 9, 3.4, "coral", 0, "container"),
      crate(-5, -19),
      crate(5, 19),
      crate(-25, 29),
      crate(25, -29),
      crate(-6, 8, 3, 3, 1.2),
      crate(6, -8, 3, 3, 1.2),
      box(0, -35, 6, 3, 2, "steel", 0, "generator"),
      box(0, 35, 6, 3, 2, "steel", 0, "generator"),
    ],
    props: [
      [-47, -20, "crane"],
      [47, 20, "crane"],
      [-20, -46, "ship"],
      [20, 46, "ship"],
      [0, -40, "sign", "CARGO CLUB / DOCK 02"],
    ],
    pickups: [
      [-36, -28, "health"],
      [36, 28, "health"],
      [-36, 28, "ammo"],
      [36, -28, "ammo"],
      [-17, 0, "ammo"],
      [17, 0, "ammo"],
      [0, -20, "popper"],
      [0, 20, "health"],
    ],
  },
  {
    id: "courtyard",
    name: "Sunset Social",
    tag: "TERRACED TOWN • 88 × 88",
    description:
      "Arcaded streets, climbable rooftops, market awnings, and a bell tower overlooking a warm stone plaza.",
    size: 44,
    sky: 0xf0c5a5,
    ground: 0xd8ba98,
    accent: 0xed9470,
    theme: "town",
    zone: [0, 0, 0],
    bases: [
      [-38, -3],
      [38, 3],
    ],
    spawns: spawns(44),
    lanes: [
      [0, 0, 76, 12, "plaza"],
      [0, 0, 14, 76, "plaza"],
      [-30, 0, 7, 76, "path"],
      [30, 0, 7, 76, "path"],
      [0, -30, 64, 7, "path"],
      [0, 30, 64, 7, "path"],
    ],
    boxes: [
      ...perimeter(44),
      facade(-17, -15, 12, 12, 3.2),
      facade(17, 15, 12, 12, 3.2, "blue"),
      ...stairs(-17, -32.25, "z", 1, 8),
      ...stairs(17, 32.25, "z", -1, 8),
      facade(17, -18, 11, 14, 6.7, "cream"),
      facade(-17, 18, 11, 14, 6.7),
      ...arch(0, -16, "x", 8, 5.4),
      ...arch(0, 16, "x", 8, 5.4),
      ...arch(-30, 0, "z", 8, 5.8),
      ...arch(30, 0, "z", 8, 5.8),
      // Rooftop links cross the narrow side alleys without sealing the streets.
      box(-17, -5, 8, 6, 0.35, "stone", 3.2, "bridge"),
      box(17, 5, 8, 6, 0.35, "stone", 3.2, "bridge"),
      box(-17, -2, 1.1, 1.1, 3.2, "stone", 0, "column"),
      box(17, 2, 1.1, 1.1, 3.2, "stone", 0, "column"),
      box(-5, 0, 2, 7, 1.05, "stone", 0, "planter"),
      box(5, 0, 2, 7, 1.05, "stone", 0, "planter"),
      facade(-34, -20, 6, 10, 4.8, "blue"),
      facade(34, 20, 6, 10, 4.8),
      planter(-33, 23, 5, 6),
      planter(33, -23, 5, 6),
      crate(-8, 30),
      crate(8, -30),
      box(0, -36, 5, 4, 1.25, "stone", 0, "fountain"),
      box(0, 36, 5, 4, 1.25, "stone", 0, "fountain"),
    ],
    props: [
      [-17, -15, "awning"],
      [17, 15, "awning"],
      [17, -18, "bell"],
      [-17, 18, "roof"],
      [-8, -8, "lamp"],
      [8, 8, "lamp"],
      [0, -42, "sign", "SUNSET SOCIAL / OLD TOWN"],
    ],
    pickups: [
      [-27, -26, "health"],
      [27, 26, "health"],
      [-27, 26, "ammo"],
      [27, -26, "ammo"],
      [-17, -15, "ammo"],
      [17, 15, "ammo"],
      [0, -8, "popper"],
      [0, 8, "health"],
    ],
  },
];

// Visible garden posts also participate in movement and shot collision.
for (const map of MAPS)
  for (const [x, z, kind] of map.props)
    if (kind === "pergola" || kind === "glasshouse") {
      const base = kind === "glasshouse" ? 1.1 : surfaceAt(map, x, z);
      for (const dx of [-4, 4])
        for (const dz of [-4, 4])
          map.boxes.push(
            box(x + dx, z + dz, 0.18, 0.18, 3.4, "navy", base, "frame"),
          );
    }
export const getMap = (id) => id === "sunnybreak" ? ROYALE_MAP : MAPS.find((m) => m.id === id) || MAPS[0];
export function surfaceAt(map, x, z) {
  let y = groundAt(map,x,z);
  for (const b of map.boxes)
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)
      y = Math.max(y, b.y + b.h);
  return y;
}

// Layered navigation preserves both the street and the walkable deck above it.
const navCache = new WeakMap();
export function navigation(map) {
  if(navCache.has(map)) return navCache.get(map);
  const cell = map.navCell || 1.5,
    n = Math.ceil((map.size * 2) / cell),
    origin = -map.size + cell / 2;
  const cells = Array.from({ length: n * n }, () => []),
    nodes = [];
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const px = origin + x * cell,
        pz = origin + z * cell;
      const overlapping = map.boxes.filter(
        (b) =>
          Math.abs(px - b.x) < b.w / 2 + 0.48 &&
          Math.abs(pz - b.z) < b.d / 2 + 0.48,
      );
      const ground=groundAt(map,px,pz), levels = new Set([ground]);
      for (const b of overlapping)
        if (Math.abs(px - b.x) < b.w / 2 && Math.abs(pz - b.z) < b.d / 2)
          levels.add(b.y + b.h);
      for (const y of levels) {
        if (
          y > 8 ||
          overlapping.some((b) => y + 0.04 < b.y + b.h && y + 1.78 > b.y + 0.01)
        )
          continue;
        const node = {
          id: nodes.length,
          x: px,
          y,
          terrain: y===ground,
          z: pz,
          cx: x,
          cz: z,
          edges: [],
        };
        nodes.push(node);
        cells[z * n + x].push(node);
      }
    }
  for (const a of nodes)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = a.cx + dx,
        z = a.cz + dz;
      if (x < 0 || z < 0 || x >= n || z >= n) continue;
      for (const b of cells[z * n + x])
        if (b.y - a.y <= (a.terrain&&b.terrain ? cell*.8 : .43) && a.y - b.y <= 3.7) a.edges.push(b.id);
    }
  const nearest = (p) => {
    let best = nodes[0],
      distance = Infinity;
    for (const node of nodes) {
      const d =
        (node.x - p.x) ** 2 +
        (node.z - p.z) ** 2 +
        4 * (node.y - (p.y || 0)) ** 2;
      if (d < distance) {
        distance = d;
        best = node;
      }
    }
    return best;
  };
  const nav = {
    path(from, to) {
      const start = nearest(from),
        end = nearest(to);
      if (!start || !end) return [];
      const parent = new Int32Array(nodes.length).fill(-1),
        q = [start.id];
      parent[start.id] = start.id;
      let best = start.id,
        bestD = Infinity;
      for (let i = 0; i < q.length; i++) {
        const a = nodes[q[i]],
          d = (a.x - end.x) ** 2 + (a.z - end.z) ** 2 + 4 * (a.y - end.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = a.id;
        }
        if (a.id === end.id) break;
        for (const k of a.edges)
          if (parent[k] < 0) {
            parent[k] = a.id;
            q.push(k);
          }
      }
      const path = [];
      for (let k = best; k !== start.id && parent[k] >= 0; k = parent[k]) {
        const a = nodes[k];
        path.push({ x: a.x, y: a.y, z: a.z });
      }
      return path.reverse();
    },
  };
  navCache.set(map,nav);
  return nav;
}
