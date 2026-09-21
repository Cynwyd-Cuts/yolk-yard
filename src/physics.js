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
// Spatial buckets keep large-island collision proportional to nearby cover.
const collisionIndex = new WeakMap();
function candidates(map,o,d=null,max=0,radius=0){
 if(map.theme!=='royale')return map.boxes;
 let grid=collisionIndex.get(map);
 if(!grid){grid=new Map();for(const b of map.boxes){for(let x=Math.floor((b.x-b.w/2)/16);x<=Math.floor((b.x+b.w/2)/16);x++)for(let z=Math.floor((b.z-b.d/2)/16);z<=Math.floor((b.z+b.d/2)/16);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}}collisionIndex.set(map,grid);}
 const found=new Set(),length=d?Math.min(Number.isFinite(max)?max:1600,1600):0,steps=Math.max(1,Math.ceil(length*Math.hypot(d?.x||0,d?.z||0)/12)),reach=Math.max(1,Math.ceil(radius/16));
 for(let i=0;i<=steps;i++){const f=length*i/steps,x=Math.floor((o.x+(d?.x||0)*f)/16),z=Math.floor((o.z+(d?.z||0)*f)/16);for(let dx=-reach;dx<=reach;dx++)for(let dz=-reach;dz<=reach;dz++)for(const b of grid.get((x+dx)+','+(z+dz))||[])found.add(b);}
 return found;
}
export function wallDistance(map, o, d, max = 200) {
  let t = max;
  for (const b of candidates(map,o,d,max)) t = Math.min(t, rayBox(o, d, b, t));
  if (d.y < 0) t = Math.min(t, -o.y / d.y);
  return t;
}
// Small shell margin covers the centered waddle and bounded render smoothing.
export const EGG_HIT = { radius: 0.62, height: 0.94, center: 0.9 };
export function rayEgg(o, d, p) {
  const r = [EGG_HIT.radius, EGG_HIT.height, EGG_HIT.radius],
    a = [(o.x - p.x) / r[0], (o.y - p.y - EGG_HIT.center) / r[1], (o.z - p.z) / r[2]],
    v = [d.x / r[0], d.y / r[1], d.z / r[2]];
  const A = v.reduce((s, x) => s + x * x, 0),
    B = 2 * a.reduce((s, x, i) => s + x * v[i], 0),
    C = a.reduce((s, x) => s + x * x, 0) - 1,
    D = B * B - 4 * A * C;
  if (A < 1e-12) return Infinity;
  if (C <= 0) return 0; // A segment starting inside the shell already overlaps it.
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
  for (const b of candidates(map,p))
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
  if (p.flight === 'transport') return;
  if (p.flight === 'dive' || p.flight === 'glide' || p.flight === 'launch') {
    if (input.jump && !p.flightLatch && p.flight === 'dive') p.flight = 'glide';
    p.flightLatch = !!input.jump;
    const f=clamp(input.forward || 0,-1,1),s=clamp(input.strafe || 0,-1,1),length=Math.max(1,Math.hypot(f,s));
    const speed=p.flight==='glide'?24:p.flight==='launch'?26:17;
    pushAxis(p,map,'x',(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/length*speed*dt);
    pushAxis(p,map,'z',(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/length*speed*dt);
    p.x=clamp(p.x,-map.size+.5,map.size-.5);p.z=clamp(p.z,-map.size+.5,map.size-.5);
    let floor=0;for(const b of candidates(map,p))if(b.y+b.h<=p.y+.045&&Math.abs(p.x-b.x)<b.w/2+RADIUS-.015&&Math.abs(p.z-b.z)<b.d/2+RADIUS-.015)floor=Math.max(floor,b.y+b.h);
    if(p.flight==='launch'){
      p.vy-=20*dt;
      const ceiling=worldHit(map,{x:p.x,y:p.y+HEIGHT,z:p.z},{x:0,y:1,z:0},Math.max(0,p.vy*dt));
      if(ceiling||p.vy<=0){p.flight='glide';p.vy=-6;}
    }else{if(p.y-floor<=24)p.flight='glide';p.vy=p.flight==='glide'?-6:-25;}
    p.y+=p.vy*dt;p.grounded=false;
    if(p.y<=floor){p.y=floor;p.vy=0;p.grounded=true;p.flight='ground';p.jumpLatch=!!input.jump;}
    p.sprinting=false;return;
  }
  if (p.inventory) {
    p.stamina ??= 100; p.sprintRest ??= 0;
    if(p.stamina>=20)p.exhausted=false;
    p.sprinting=!!input.sprint && !p.exhausted && p.stamina>0 && !input.aim && !input.fire && !p.use && Math.hypot(input.forward||0,input.strafe||0)>.1 && p.grounded;
    if(p.sprinting){p.stamina=Math.max(0,p.stamina-22*dt);p.sprintRest=0;if(p.stamina===0)p.exhausted=true;}
    else {p.sprintRest+=dt;if(p.sprintRest>1.3)p.stamina=Math.min(100,p.stamina+18*dt);}
  }
  let f = clamp(input.forward || 0, -1, 1),
    s = clamp(input.strafe || 0, -1, 1),
    len = Math.hypot(f, s);
  if (len > 1) {
    f /= len;
    s /= len;
  }
  const speed =
    (p.inventory ? 10.5 * (p.sprinting ? 1.75 : 1) : weapon(p.weapon).speed) *
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
  for (const b of candidates(map,p)) {
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
    slot: Number.isInteger(i.slot) && i.slot>=0 && i.slot<5 ? i.slot : 0,
    sprint: !!i.sprint, interact: !!i.interact, drop: !!i.drop,
    swapSlot: Number.isInteger(i.swapSlot) && i.swapSlot>=0 && i.swapSlot<5 ? i.swapSlot : -1,
  };
}

export const VIEWMODEL = { scale: 0.62, x: 0.28, y: -0.28, z: -0.78 };
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
  for (const source of candidates(map,o,d,max,radius)) {
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
  const a = [(o.x-p.x)/EGG_HIT.radius, (o.y-p.y-EGG_HIT.center)/EGG_HIT.height, (o.z-p.z)/EGG_HIT.radius];
  const v = [d.x/EGG_HIT.radius, d.y/EGG_HIT.height, d.z/EGG_HIT.radius];
  const t = -a.reduce((s,x,i)=>s+x*v[i],0)/v.reduce((s,x)=>s+x*x,0);
  return t >= 0 && a.reduce((s,x,i)=>s+(x+t*v[i])**2,0) <= 0.32**2;
}

// The reference damage curve depends on the incidence angle, not a flat bonus.
export function shellDamageFactor(hit, direction, egg) {
  const depth = ((hit.x - egg.x) / EGG_HIT.radius) ** 2
    + ((hit.y - egg.y - EGG_HIT.center) / EGG_HIT.height) ** 2
    + ((hit.z - egg.z) / EGG_HIT.radius) ** 2;
  if (depth < 1 - 1e-7) {
    // An overlapping spawn still scores the entry surface of its shot line.
    const back = {x:hit.x-direction.x*2, y:hit.y-direction.y*2, z:hit.z-direction.z*2};
    const entry = rayEgg(back, direction, egg);
    if (Number.isFinite(entry)) hit = {x:back.x+direction.x*entry, y:back.y+direction.y*entry, z:back.z+direction.z*entry};
  }
  const normal = [(hit.x - egg.x) / EGG_HIT.radius ** 2,
    (hit.y - egg.y - EGG_HIT.center) / EGG_HIT.height ** 2, (hit.z - egg.z) / EGG_HIT.radius ** 2];
  const length = Math.hypot(...normal) || 1;
  const incidence = clamp(-(normal[0] * direction.x + normal[1] * direction.y + normal[2] * direction.z) / length, 0, 1);
  const base = 0.2 + 0.8 * incidence;
  return base ** (4 + base ** 4);
}
