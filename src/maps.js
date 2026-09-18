const box = (x, z, w, d, h, color = "sand", y = 0, kind = "wall") => ({
  x,
  z,
  w,
  d,
  h,
  y,
  color,
  kind,
});
const perimeter = (size) => [
  box(-size - 1, 0, 2, size * 2 + 4, 5, "navy"),
  box(size + 1, 0, 2, size * 2 + 4, 5, "navy"),
  box(0, -size - 1, size * 2, 2, 5, "navy"),
  box(0, size + 1, size * 2, 2, 5, "navy"),
];
const steps = (x, z, axis, sign = 1) =>
  [0, 1, 2, 3, 4].map((i) =>
    box(
      x + (axis === "x" ? i * 0.9 * sign : 0),
      z + (axis === "z" ? i * 0.9 * sign : 0),
      axis === "x" ? 0.95 : 3,
      axis === "z" ? 0.95 : 3,
      (i + 1) * 0.4,
      "stone",
    ),
  );
const commonSpawns = (size) => [
  [-size + 4, -size + 4],
  [size - 4, size - 4],
  [-size + 4, size - 4],
  [size - 4, -size + 4],
  [-size + 4, 0],
  [size - 4, 0],
  [0, -size + 4],
  [0, size - 4],
];
export const MAPS = [
  {
    id: "yard",
    name: "The Yard",
    tag: "SUNLIT • OPEN LANES",
    description:
      "A bright training yard. Wide flanks, a raised center, and plenty of cover.",
    size: 26,
    sky: 0x8ed4e7,
    ground: 0xdfd4b1,
    accent: 0xf5b431,
    boxes: [
      ...perimeter(26),
      box(0, 0, 8, 8, 2, "stone"),
      ...steps(-8, 0, "x"),
      ...steps(8, 0, "x", -1),
      box(-12, -10, 7, 3, 3.6, "blue", 0, "container"),
      box(12, 10, 7, 3, 3.6, "coral", 0, "container"),
      box(12, -12, 3, 8, 3.6, "blue", 0, "container"),
      box(-12, 12, 3, 8, 3.6, "coral", 0, "container"),
      box(-4, -17, 3, 3, 2, "crate"),
      box(5, 17, 3, 3, 2, "crate"),
      box(-19, -6, 3, 4, 2, "crate"),
      box(19, 6, 3, 4, 2, "crate"),
      box(6, -7, 2, 2, 1.2, "gold"),
      box(-6, 7, 2, 2, 1.2, "gold"),
      box(-21, -16, 2, 2, 5, "stone"),
      box(21, 16, 2, 2, 5, "stone"),
    ],
    spawns: commonSpawns(26),
    bases: [
      [-21, 0],
      [21, 0],
    ],
    zone: [0, 0, 2],
    pickups: [
      [-17, 17, "health"],
      [17, -17, "health"],
      [0, -19, "ammo"],
      [0, 19, "ammo"],
      [0, 0, "popper"],
    ],
  },
  {
    id: "depot",
    name: "Cargo Club",
    tag: "INDUSTRIAL • CLOSE QUARTERS",
    description:
      "Colorful freight stacks split this depot into quick, winding routes.",
    size: 24,
    sky: 0xa6d8ea,
    ground: 0xb5c3bd,
    accent: 0x63d3d0,
    boxes: [
      ...perimeter(24),
      box(-8, -8, 10, 4, 4, "coral", 0, "container"),
      box(8, 8, 10, 4, 4, "blue", 0, "container"),
      box(-8, 8, 4, 10, 4, "blue", 0, "container"),
      box(8, -8, 4, 10, 4, "coral", 0, "container"),
      box(0, 0, 4, 4, 1.2, "gold"),
      box(-17, -15, 3, 3, 2, "crate"),
      box(17, 15, 3, 3, 2, "crate"),
      box(16, -18, 5, 3, 3, "stone"),
      box(-16, 18, 5, 3, 3, "stone"),
      box(0, -18, 7, 3, 2, "stone"),
      ...steps(-6, -18, "x"),
      box(0, 18, 7, 3, 2, "stone"),
      ...steps(6, 18, "x", -1),
    ],
    spawns: commonSpawns(24),
    bases: [
      [-20, 0],
      [20, 0],
    ],
    zone: [0, 0, 1.2],
    pickups: [
      [-17, -5, "health"],
      [17, 5, "health"],
      [-8, 17, "ammo"],
      [8, -17, "ammo"],
      [0, 0, "popper"],
    ],
  },
  {
    id: "courtyard",
    name: "Sunset Social",
    tag: "COURTYARD • VERTICAL",
    description:
      "Warm stone, narrow arches, and two climbable lookout terraces.",
    size: 28,
    sky: 0xf1c49b,
    ground: 0xe1b996,
    accent: 0xed9770,
    boxes: [
      ...perimeter(28),
      box(-9, 0, 4, 16, 3.8, "terracotta"),
      box(9, 0, 4, 16, 3.8, "terracotta"),
      box(0, -13, 14, 3, 2, "stone"),
      box(0, 13, 14, 3, 2, "stone"),
      ...steps(-10, -13, "x"),
      ...steps(10, 13, "x", -1),
      box(-18, -15, 4, 4, 2, "crate"),
      box(18, 15, 4, 4, 2, "crate"),
      box(-18, 15, 4, 4, 2, "crate"),
      box(18, -15, 4, 4, 2, "crate"),
      box(-21, 0, 3, 6, 3.4, "terracotta"),
      box(21, 0, 3, 6, 3.4, "terracotta"),
      box(0, 0, 3, 3, 1.1, "gold"),
      box(-5, -21, 2, 2, 5, "stone"),
      box(5, 21, 2, 2, 5, "stone"),
    ],
    spawns: commonSpawns(28),
    bases: [
      [-24, -8],
      [24, 8],
    ],
    zone: [0, 0, 1.1],
    pickups: [
      [-17, 0, "health"],
      [17, 0, "health"],
      [0, -22, "ammo"],
      [0, 22, "ammo"],
      [0, 0, "popper"],
    ],
  },
];
export const getMap = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
export function surfaceAt(map, x, z) {
  let y = 0;
  for (const b of map.boxes)
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)
      y = Math.max(y, b.y + b.h);
  return y;
}

// A compact navigation grid for bots. Tall geometry is blocked; low steps are navigable.
export function navigation(map) {
  const cell = 2,
    n = Math.ceil((map.size * 2) / cell),
    origin = -map.size + cell / 2;
  const key = (x, z) => z * n + x,
    grid = new Uint8Array(n * n);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const px = origin + x * cell,
        pz = origin + z * cell;
      grid[key(x, z)] = map.boxes.some(
        (b) =>
          b.h > 1.4 &&
          Math.abs(px - b.x) < b.w / 2 + 0.7 &&
          Math.abs(pz - b.z) < b.d / 2 + 0.7,
      )
        ? 1
        : 0;
    }
  const pos = (v) => [
    Math.max(0, Math.min(n - 1, Math.round((v.x - origin) / cell))),
    Math.max(0, Math.min(n - 1, Math.round((v.z - origin) / cell))),
  ];
  return {
    path(from, to) {
      const [sx, sz] = pos(from),
        [ex, ez] = pos(to),
        start = key(sx, sz),
        end = key(ex, ez),
        parent = new Int32Array(n * n).fill(-1),
        q = [start];
      parent[start] = start;
      let best = start,
        bestD = Infinity;
      for (let i = 0; i < q.length; i++) {
        const k = q[i],
          x = k % n,
          z = Math.floor(k / n),
          d = (x - ex) ** 2 + (z - ez) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
        if (k === end) break;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let nx = x + dx,
            nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          let nk = key(nx, nz);
          if (!grid[nk] && parent[nk] < 0) {
            parent[nk] = k;
            q.push(nk);
          }
        }
      }
      const result = [];
      for (let k = best; k !== start && parent[k] >= 0; k = parent[k])
        result.unshift({
          x: origin + (k % n) * cell,
          z: origin + Math.floor(k / n) * cell,
        });
      return result;
    },
  };
}
