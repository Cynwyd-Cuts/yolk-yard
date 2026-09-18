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
