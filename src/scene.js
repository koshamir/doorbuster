// DOORBUSTER — scene.js
// Purpose: builds the visuals of one level from the simulation world and, every frame, copies the
//          simulation state onto them: carts and their animation, the towers of goods and how they
//          sway, goods flying into carts, goods on shelves and on the floor. Reads the simulation,
//          never writes it.
// Exports: buildScene, syncScene, sceneEvent, disposeScene
// Depends on: config.js, gfx.js, models.js and the global THREE (inside functions only).

import { TUNE, CFG, PAL, GOODS, clamp, lerp, wrapAngle } from './config.js';
import { gfx, toonMaterial } from './gfx.js';
import { makeBuilder, place, addBox, addCyl, toGeometry, cartGeometry, bumperGeometry, beanGeometry, goodGeometry } from './models.js';

const GOOD_CAP = 220;        // instances per kind of goods
const TOWER_SCALE = 0.85;    // goods shrink a little when they land in a cart
const FLY_TIME = 0.2;        // seconds for a swept item to arc into the cart
const BASKET_Y = 0.48;       // height of the basket floor
const towX = new Float32Array(200), towY = new Float32Array(200), towZ = new Float32Array(200), towYaw = new Float32Array(200);

// Builds everything for sim.world and returns the "view" that syncScene updates.
export function buildScene(sim) {
  const world = sim.world, M = gfx.mats;
  const view = { root: new THREE.Group(), goods: [], counts: new Int32Array(GOODS.length), carts: [], own: [],
    flights: new Map(), time: 0, frame: 0, towerH: 0 };
  gfx.scene.add(view.root);

  // Floor: one quad under the whole plan; the shader draws the tiles.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(world.w, world.h), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(world.w / 2, 0, world.h / 2);
  view.root.add(floor);

  // Walls: merged boxes, no outline (ART.md 6: walls and floor stay quiet).
  const wb = makeBuilder();
  for (const w of world.walls) {
    place(wb, w.x, 0, w.z);
    addBox(wb, w.hx * 2, CFG.WALL_H, w.hz * 2, PAL.wall, { bevel: 0, top: PAL.walltop });
  }
  view.root.add(new THREE.Mesh(toGeometry(wb), [M.toon]));

  // Furniture: shelves and single-tile pieces in one static mesh with a thin outline.
  const fb = makeBuilder();
  for (const s of world.shelves) {
    const w = s.hx * 2, d = s.hz * 2;
    place(fb, s.x, 0, s.z); addBox(fb, w, 0.5, d, PAL.white, { bevel: 0.08 });
    const back = s.sides[0] && s.sides[1] ? 0 : (s.sides[0] ? 1 : -1) * ((s.horiz ? d : w) / 2 - 0.12);
    place(fb, s.x + (s.horiz ? 0 : back), 0.5, s.z + (s.horiz ? back : 0));
    addBox(fb, s.horiz ? w - 0.1 : 0.2, 1.3, s.horiz ? 0.2 : d - 0.1, PAL.steel, { bevel: 0.1 });
    place(fb, s.x, 1.15, s.z); addBox(fb, w, 0.08, d, PAL.white, { bevel: 0.3 });
  }
  for (const p of world.pieces) {
    place(fb, p.x, 0, p.z);
    if (p.type === 'counter') addBox(fb, 1.4, 1.0, 2.0, PAL.steel, { bevel: 0.1, top: PAL.night });
    else if (p.type === 'display') addCyl(fb, 0.9, 0.9, 1.0, PAL.white, { seg: 14, top: PAL.sale });
    else if (p.solid.r) addCyl(fb, p.solid.r, p.solid.r * 0.9, 0.9, PAL.coral, { seg: 12, top: PAL.white });
    else addBox(fb, p.solid.hx * 2, 1.0, p.solid.hz * 2, PAL.sky, { bevel: 0.1 });
  }
  view.root.add(new THREE.Mesh(toGeometry(fb), [M.toon, M.lineThin]));

  // Goods: one instanced mesh per kind serves shelves, the floor, the air and the towers.
  for (let i = 0; i < GOODS.length; i++) {
    const mesh = new THREE.InstancedMesh(goodGeometry(i), [M.toon, M.lineThin], GOOD_CAP);
    mesh.count = 0;
    mesh.frustumCulled = false;
    view.root.add(mesh);
    view.goods.push(mesh);
  }

  // Carts with their shoppers. `tilt` carries the lean, pitch and squash of the cart body.
  for (const k of sim.carts) {
    const g = new THREE.Group(), tilt = new THREE.Group();
    const glow = toonMaterial();
    view.own.push(glow);
    const bean = new THREE.Mesh(beanGeometry(k.def.color), [M.toonRim, M.lineBold]);
    bean.position.z = -1.3;
    tilt.add(new THREE.Mesh(cartGeometry(k.def.color), [M.toonRim, M.lineBold]));
    tilt.add(new THREE.Mesh(bumperGeometry(), [glow, M.lineBold]));
    g.add(tilt); g.add(bean);
    view.root.add(g);
    view.carts.push({ k, g, tilt, bean, glow, roll: 0, pitch: 0, squash: 0, stretch: 0, bob: 0, lastSpd: 0,
      swayX: 0, swayXv: 0, swayZ: 0, swayZv: 0, pending: 0 });
  }
  return view;
}

// Writes one goods instance: position, yaw, then pitch (rx) and roll (rz), uniform scale. No allocation.
function putGood(view, kind, x, y, z, ry, s, rx, rz) {
  const n = view.counts[kind];
  if (n >= GOOD_CAP) return;
  const m = view.goods[kind].instanceMatrix.array, o = n * 16;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  if (!rx && !rz) {
    m[o] = cy * s; m[o + 1] = 0; m[o + 2] = -sy * s; m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 8] = sy * s; m[o + 9] = 0; m[o + 10] = cy * s;
  } else {
    const cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
    // columns of Ry * Rx * Rz
    m[o] = (cy * cz + sy * sx * sz) * s; m[o + 1] = cx * sz * s; m[o + 2] = (-sy * cz + cy * sx * sz) * s;
    m[o + 4] = (-cy * sz + sy * sx * cz) * s; m[o + 5] = cx * cz * s; m[o + 6] = (sy * sz + cy * sx * cz) * s;
    m[o + 8] = sy * cx * s; m[o + 9] = -sx * s; m[o + 10] = cy * cx * s;
  }
  m[o + 3] = 0; m[o + 7] = 0; m[o + 11] = 0;
  m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
  view.counts[kind] = n + 1;
}

// Packs a tower into the basket: two lanes of small goods side by side, bigger goods across both,
// a new layer when the basket length is used up. Fills towX/Y/Z/Yaw (cart space, y from the basket
// floor) and returns the height of the pile.
function layoutTower(tower) {
  const LEN = 1.16;
  let y = 0, layerH = 0, zl = 0, zr = 0;
  const n = Math.min(tower.length, 200);
  for (let i = 0; i < n; i++) {
    const g = GOODS[tower[i].good], small = g.size === 'S';
    let w = g.dims[0] * TOWER_SCALE, d = g.dims[2] * TOWER_SCALE, yaw = 0;
    if (!small && w > 0.86) { const t = w; w = d; d = t; yaw = Math.PI / 2; }
    let z0 = small ? Math.min(zl, zr) : Math.max(zl, zr);
    if (z0 + d > LEN && z0 > 0) { y += layerH; layerH = 0; zl = zr = 0; z0 = 0; }
    const left = small && zl <= zr;
    towX[i] = small ? (left ? 0.2 : -0.2) : 0;
    towY[i] = y;
    towZ[i] = -LEN / 2 + Math.min(z0 + d / 2, LEN - 0.1);
    towYaw[i] = yaw + ((i * 37) % 11 - 5) * 0.035;
    if (small) { if (left) zl = z0 + d * 0.96; else zr = z0 + d * 0.96; } else zl = zr = z0 + d * 0.96;
    layerH = Math.max(layerH, g.dims[1] * TOWER_SCALE * 0.94);
  }
  return y + layerH;
}

// The cart body leans out of turns, pitches with acceleration, squashes on impact; the shopper bobs
// and leans the other way; the bumper glows when the dash is ready; the tower sways like a spring.
function syncCart(view, c, alpha, dt) {
  const k = c.k, ease = 1 - Math.exp(-dt * 10), speed = Math.abs(k.spd);
  const x = lerp(k.px, k.x, alpha), z = lerp(k.pz, k.z, alpha), h = k.ph + wrapAngle(k.h - k.ph) * alpha;
  c.g.position.set(x, 0, z);
  c.g.rotation.y = h;
  const lat = k.yaw * speed;                                   // sideways acceleration, m/s2
  c.roll += (clamp(lat * 0.007, -0.2, 0.2) + k.drift * 0.1 + k.input.steer * 0.05 - c.roll) * (1 - Math.exp(-dt * 16));
  const acc = dt > 0 ? clamp((speed - c.lastSpd) / dt, -40, 40) : 0;
  c.lastSpd = speed;
  c.pitch += (clamp(-acc * 0.004, -0.1, 0.12) + (k.dashT > 0 ? 0.08 : 0) - c.pitch) * ease;
  c.squash = Math.max(0, c.squash - dt * 5);
  const sq = c.squash * c.squash;
  c.stretch += ((k.dashT > 0 ? 1 : 0) - c.stretch) * (1 - Math.exp(-dt * 20));      // the dash stretches the cart forward
  const yawShow = k.slip * 0.35 + k.steer * 0.1;
  c.tilt.rotation.set(c.pitch, yawShow, c.roll);
  c.tilt.scale.set((1 + sq * 0.16) * (1 - c.stretch * 0.1), 1 - sq * 0.3, (1 + sq * 0.16) * (1 + c.stretch * 0.24));
  c.bob += speed * dt * 1.5;
  c.bean.position.y = Math.abs(Math.sin(c.bob)) * 0.07;
  c.bean.rotation.set(0.1 * clamp(k.spd / TUNE.maxspeed, -1, 1.6) + (k.dashT > 0 ? 0.25 : 0), k.steer * 0.25, -c.roll * 1.4);
  const ready = k.dashCd <= 0, gl = ready ? 0.05 + 0.16 * (0.5 + 0.5 * Math.sin(view.time * 7)) : -0.45;
  c.glow.uniforms.uGlow.value.set(gl, gl, ready ? gl * 0.4 : gl);

  // The tower: a damped spring driven by cornering and braking; a fuller cart wobbles more.
  const fill = Math.min(1.6, k.load / TUNE.loadfull);
  const gain = k.madT > 0 ? 0 : 0.3 + 0.9 * fill;
  const damp = fill > 1 ? 2.6 : 4.2;
  c.swayXv += (-70 * (c.swayX - clamp(-lat * 0.011, -0.3, 0.3) * gain) - damp * c.swayXv) * dt;
  c.swayZv += (-70 * (c.swayZ - clamp(-acc * 0.006, -0.22, 0.22) * gain) - damp * c.swayZv) * dt;
  c.swayX = clamp(c.swayX + c.swayXv * dt, -0.5, 0.5);
  c.swayZ = clamp(c.swayZ + c.swayZv * dt, -0.4, 0.4);
  const height = layoutTower(k.tower);
  if (k.player) view.towerH = height;
  const ch = Math.cos(h + yawShow), sh = Math.sin(h + yawShow);
  c.pending = 0;
  for (let i = 0; i < k.tower.length && i < 200; i++) {
    const e = k.tower[i], ty = towY[i];
    // cart space -> world: shear with height (the lean), then rotate by the heading
    const lx = towX[i] + c.swayX * ty * 0.9, lz = towZ[i] + c.swayZ * ty * 0.9;
    let wx = x + lx * ch + lz * sh, wy = BASKET_Y + ty * (1 - sq * 0.3), wz = z - lx * sh + lz * ch, scale = TOWER_SCALE;
    const f = view.flights.get(e);
    if (f) {
      // On its way from the shelf: wait for its turn, then arc into place.
      f.seen = view.frame;
      if (f.t < 0) c.pending++;
      f.t += dt;
      const u = clamp(f.t / FLY_TIME, 0, 1), s = u * u * (3 - 2 * u);
      wx = lerp(f.x, wx, s); wz = lerp(f.z, wz, s); wy = lerp(f.y, wy, s) + Math.sin(u * Math.PI) * 1.1;
      scale = lerp(1, TOWER_SCALE, s) * (1 + Math.sin(u * Math.PI) * 0.25);
      if (u >= 1) { view.flights.delete(e); c.swayZv += 0.5; }
    }
    putGood(view, e.good, wx, wy, wz, h + yawShow + towYaw[i], scale, c.swayZ * 0.8, -c.swayX * 0.8);
  }
}

export function syncScene(view, sim, alpha, dt) {
  const world = sim.world;
  view.time += dt; view.frame++;
  view.counts.fill(0);
  for (const it of world.items) {
    if (!it.taken) putGood(view, it.good, it.x, 0.5, it.z, Math.atan2(it.nx, it.nz), 1, 0, 0);
  }
  for (const d of world.drops) {
    if (!d.live) continue;
    if (d.ttl > 0 && d.ttl < 1.2 && Math.floor(d.ttl * 10) % 2 === 0) continue;       // blink before vanishing
    const age = d.born === undefined ? 9 : sim.t - d.born;
    const bob = 0.14 + 0.07 * Math.sin(view.time * 4 + d.x * 1.3 + d.z);
    if (age < 0.45) {                                                               // thrown out of a cart
      const u = age / 0.45;
      putGood(view, d.good, lerp(d.ox, d.x, u), 1.0 + Math.sin(u * Math.PI) * 1.4 - u * 0.86, lerp(d.oz, d.z, u), u * 9 + d.x, 0.9, u * 7, u * 5);
    } else {
      putGood(view, d.good, d.x, bob, d.z, view.time * 1.6 + d.x * 1.7, d.list ? 1.25 : 0.95, 0, 0.18);
    }
  }
  for (const c of view.carts) syncCart(view, c, alpha, dt);
  for (const [e, f] of view.flights) if (f.seen !== view.frame) view.flights.delete(e);   // spilled before it landed
  for (let i = 0; i < view.goods.length; i++) {
    const mesh = view.goods[i];
    mesh.count = view.counts[i];
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// Visual reactions of scene objects to simulation events.
export function sceneEvent(view, e) {
  for (const c of view.carts) {
    if (c.k !== e.cart && c.k !== e.ref) continue;
    if (e.type === 'crash') { c.squash = 1; c.swayXv += 3; c.swayZv -= 4; }
    else if (e.type === 'bump' || e.type === 'cartbump') { c.squash = 0.55; c.swayXv += (c.k.id % 2 ? 2 : -2); }
    else if (e.type === 'take' && c.k === e.cart) {
      // Goods leave the shelf one after another: each waits a little longer than the one before.
      view.flights.set(e.ref.entry, { x: e.ref.x, y: e.ref.y, z: e.ref.z, t: -Math.min(0.24, c.pending * 0.03), seen: view.frame });
      c.pending++;
    }
  }
}

export function disposeScene(view) {
  gfx.scene.remove(view.root);
  view.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of view.own) m.dispose();
}
