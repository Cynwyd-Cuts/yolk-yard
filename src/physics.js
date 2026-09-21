import { clamp, weapon } from "./data.js";
export const RADIUS = 0.46,
  HEIGHT = 1.75,
  EYE = 1.43;
export const dist = (a, b) =>
  Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);
export function direction(yaw, pitch = 0) {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export function rayBox(o, d, b, max = Infinity) {
  let lo = 0,
    hi = max;
  for (const [axis, min, maxV] of [
    ["x", b.x - b.w / 2, b.x + b.w / 2],
    ["y", b.y, b.y + b.h],
    ["z", b.z - b.d / 2, b.z + b.d / 2],
  ]) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min || o[axis] > maxV) return Infinity;
      continue;
    }
    let a = (min - o[axis]) / d[axis],
      c = (maxV - o[axis]) / d[axis];
    if (a > c) [a, c] = [c, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, c);
    if (lo > hi) return Infinity;
  }
  return lo;
}
export function wallDistance(map, o, d, max = 200) {
  let t = max;
  for (const b of map.boxes) t = Math.min(t, rayBox(o, d, b, t));
  if (d.y < 0) t = Math.min(t, -o.y / d.y);
  return t;
}
export function rayEgg(o, d, p) {
  // An ellipsoid matching the rendered egg, not an oversized bounding box.
  const r = [0.53, 0.87, 0.53],
    a = [(o.x - p.x) / r[0], (o.y - p.y - 0.87) / r[1], (o.z - p.z) / r[2]],
    v = [d.x / r[0], d.y / r[1], d.z / r[2]];
  const A = v.reduce((s, x) => s + x * x, 0),
    B = 2 * a.reduce((s, x, i) => s + x * v[i], 0),
    C = a.reduce((s, x) => s + x * x, 0) - 1,
    D = B * B - 4 * A * C;
  if (D < 0) return Infinity;
  const t = (-B - Math.sqrt(D)) / (2 * A);
  return t >= 0 ? t : Infinity;
}
function overlaps(p, b) {
  return (
    p.y < b.y + b.h - 0.015 &&
    p.y + HEIGHT > b.y + 0.02 &&
    Math.abs(p.x - b.x) < b.w / 2 + RADIUS &&
    Math.abs(p.z - b.z) < b.d / 2 + RADIUS
  );
}
function pushAxis(p, map, axis, delta) {
  p[axis] += delta;
  for (const b of map.boxes)
    if (overlaps(p, b)) {
      const top = b.y + b.h;
      if (p.grounded && top - p.y <= 0.43 && top - p.y > 0) {
        p.y = top;
        continue;
      }
      if (delta > 0)
        p[axis] = b[axis] - (axis === "x" ? b.w : b.d) / 2 - RADIUS;
      else if (delta < 0)
        p[axis] = b[axis] + (axis === "x" ? b.w : b.d) / 2 + RADIUS;
    }
}
export function movePlayer(p, input, map, dt) {
  if (p.health <= 0) return;
  p.yaw = Number.isFinite(input.yaw) ? input.yaw : p.yaw;
  p.pitch = clamp(
    Number.isFinite(input.pitch) ? input.pitch : p.pitch,
    -1.48,
    1.48,
  );
  let f = clamp(input.forward || 0, -1, 1),
    s = clamp(input.strafe || 0, -1, 1),
    len = Math.hypot(f, s);
  if (len > 1) {
    f /= len;
    s /= len;
  }
  const speed =
    weapon(p.weapon).speed *
    (input.aim ? 0.7 : 1) *
    (p.crown !== null ? 0.88 : 1);
  const dx = (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) * speed * dt,
    dz = (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) * speed * dt;
  if (input.jump && p.grounded && !p.jumpLatch) {
    p.vy = 8.6;
    p.grounded = false;
  }
  p.jumpLatch = !!input.jump;
  pushAxis(p, map, "x", dx);
  pushAxis(p, map, "z", dz);
  const oldY = p.y;
  p.vy -= 24 * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  for (const b of map.boxes) {
    if (
      Math.abs(p.x - b.x) >= b.w / 2 + RADIUS - 0.015 ||
      Math.abs(p.z - b.z) >= b.d / 2 + RADIUS - 0.015
    )
      continue;
    if (p.vy <= 0 && oldY >= b.y + b.h - 0.045 && p.y <= b.y + b.h) {
      p.y = b.y + b.h;
      p.vy = 0;
      p.grounded = true;
    } else if (p.vy > 0 && oldY + HEIGHT <= b.y + 0.03 && p.y + HEIGHT >= b.y) {
      p.y = b.y - HEIGHT;
      p.vy = 0;
    }
  }
  if (p.y <= 0) {
    p.y = 0;
    p.vy = 0;
    p.grounded = true;
  }
  p.x = clamp(p.x, -map.size + RADIUS, map.size - RADIUS);
  p.z = clamp(p.z, -map.size + RADIUS, map.size - RADIUS);
}
export function sanitizeInput(i = {}) {
  const num = (n, a, b) => clamp(Number.isFinite(n) ? n : 0, a, b);
  return {
    seq: Math.floor(num(i.seq, 0, 1e10)),
    yaw: num(i.yaw, -1e6, 1e6),
    pitch: num(i.pitch, -1.48, 1.48),
    forward: num(i.forward, -1, 1),
    strafe: num(i.strafe, -1, 1),
    jump: !!i.jump,
    fire: !!i.fire,
    aim: !!i.aim,
    reload: !!i.reload,
    popper: !!i.popper,
    slot: i.slot === 1 ? 1 : 0,
  };
}

export const VIEWMODEL = { scale: 0.68, x: 0.32, y: -0.31, z: -0.48 };
export function muzzleOrigin(p, w) {
  const f = direction(p.yaw, p.pitch),
    right = { x: Math.cos(p.yaw), y: 0, z: -Math.sin(p.yaw) };
  const up = {
    x: Math.sin(p.yaw) * Math.sin(p.pitch),
    y: Math.cos(p.pitch),
    z: Math.cos(p.yaw) * Math.sin(p.pitch),
  };
  const side = p.aim ? 0 : VIEWMODEL.x,
    height = p.aim ? -w.sightY * VIEWMODEL.scale : VIEWMODEL.y,
    forward = -VIEWMODEL.z + w.muzzle * VIEWMODEL.scale;
  return {
    x: p.x + right.x * side + up.x * height + f.x * forward,
    y: p.y + EYE + up.y * height + f.y * forward,
    z: p.z + right.z * side + up.z * height + f.z * forward,
  };
}
// Swept segment collision supplies the actual surface normal for impact and bounce effects.
export function worldHit(map, o, d, max = 200, radius = 0) {
  let result = null,
    best = max;
  for (const source of map.boxes) {
    const b = radius
      ? {
          ...source,
          w: source.w + radius * 2,
          d: source.d + radius * 2,
          y: source.y - radius,
          h: source.h + radius * 2,
        }
      : source;
    const t = rayBox(o, d, b, best);
    if (!Number.isFinite(t) || t > best) continue;
    const hit = { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
    const faces = [
      ["x", b.x - b.w / 2, -1],
      ["x", b.x + b.w / 2, 1],
      ["y", b.y, -1],
      ["y", b.y + b.h, 1],
      ["z", b.z - b.d / 2, -1],
      ["z", b.z + b.d / 2, 1],
    ];
    faces.sort(
      (a, b) => Math.abs(hit[a[0]] - a[1]) - Math.abs(hit[b[0]] - b[1]),
    );
    const normal = { x: 0, y: 0, z: 0 };
    normal[faces[0][0]] = faces[0][2];
    best = t;
    result = { distance: t, point: hit, normal };
  }
  if (d.y < 0) {
    const t = (radius - o.y) / d.y;
    if (t >= 0 && t <= best)
      result = {
        distance: t,
        point: { x: o.x + d.x * t, y: radius, z: o.z + d.z * t },
        normal: { x: 0, y: 1, z: 0 },
      };
  }
  return result;
}

// Distance from the shot ray to the shell center in normalized egg space.
export function isCenterHit(o, d, p) {
  const a = [(o.x-p.x)/0.53, (o.y-p.y-0.87)/0.87, (o.z-p.z)/0.53];
  const v = [d.x/0.53, d.y/0.87, d.z/0.53];
  const t = -a.reduce((s,x,i)=>s+x*v[i],0)/v.reduce((s,x)=>s+x*x,0);
  return t >= 0 && a.reduce((s,x,i)=>s+(x+t*v[i])**2,0) <= 0.32**2;
}

// The reference damage curve depends on the incidence angle, not a flat bonus.
export function shellDamageFactor(hit, direction, egg) {
  const normal = [(hit.x - egg.x) / 0.53 ** 2,
    (hit.y - egg.y - 0.87) / 0.87 ** 2, (hit.z - egg.z) / 0.53 ** 2];
  const length = Math.hypot(...normal) || 1;
  const incidence = clamp(-(normal[0] * direction.x + normal[1] * direction.y + normal[2] * direction.z) / length, 0, 1);
  const base = 0.2 + 0.8 * incidence;
  return base ** (4 + base ** 4);
}
