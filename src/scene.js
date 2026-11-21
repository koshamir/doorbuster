// DOORBUSTER — scene.js
// Purpose: builds the visuals of one level from the simulation world and, every frame, copies the
//          simulation state onto them (carts and their animation, goods, moving pieces). Reads the
//          simulation, never writes it.
// Exports: buildScene, syncScene, sceneEvent, disposeScene
// Depends on: config.js, gfx.js, models.js and the global THREE (inside functions only).

import { TUNE, CFG, PAL, GOODS, clamp, lerp, wrapAngle } from './config.js';
import { gfx, toonMaterial } from './gfx.js';
import { makeBuilder, place, addBox, addCyl, toGeometry, cartGeometry, bumperGeometry, beanGeometry, goodGeometry } from './models.js';

const GOOD_CAP = 200;      // instances per kind of goods

// Builds everything for sim.world and returns the "view" that syncScene updates.
export function buildScene(sim) {
  const world = sim.world, M = gfx.mats;
  const view = { root: new THREE.Group(), goods: [], counts: new Int32Array(GOODS.length), carts: [], own: [], time: 0 };
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
    view.carts.push({ k, g, tilt, bean, glow, roll: 0, pitch: 0, squash: 0, bob: 0, lastSpd: 0 });
  }
  return view;
}

// Writes one goods instance: position, yaw, uniform scale. No allocation.
function putGood(view, kind, x, y, z, ry, s) {
  const n = view.counts[kind];
  if (n >= GOOD_CAP) return;
  const m = view.goods[kind].instanceMatrix.array, o = n * 16, c = Math.cos(ry) * s, sn = Math.sin(ry) * s;
  m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
  m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
  m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
  m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
  view.counts[kind] = n + 1;
}

// The cart body leans out of turns, pitches with acceleration, squashes on impact; the shopper bobs
// and leans the other way; the bumper glows when the dash is ready.
function syncCart(c, alpha, dt, time) {
  const k = c.k, ease = 1 - Math.exp(-dt * 10), speed = Math.abs(k.spd);
  c.g.position.set(lerp(k.px, k.x, alpha), 0, lerp(k.pz, k.z, alpha));
  c.g.rotation.y = k.ph + wrapAngle(k.h - k.ph) * alpha;
  c.roll += (clamp(k.yaw * speed * 0.007, -0.2, 0.2) + k.drift * 0.1 - c.roll) * ease;
  const acc = dt > 0 ? (speed - c.lastSpd) / dt : 0;
  c.lastSpd = speed;
  c.pitch += (clamp(-acc * 0.004, -0.1, 0.12) + (k.dashT > 0 ? 0.08 : 0) - c.pitch) * ease;
  c.squash = Math.max(0, c.squash - dt * 5);
  const sq = c.squash * c.squash;
  c.tilt.rotation.set(c.pitch, k.slip * 0.35 + k.steer * 0.07, c.roll);
  c.tilt.scale.set(1 + sq * 0.16, 1 - sq * 0.3, 1 + sq * 0.16);
  c.bob += speed * dt * 1.5;
  c.bean.position.y = Math.abs(Math.sin(c.bob)) * 0.07;
  c.bean.rotation.set(0.1 * clamp(k.spd / TUNE.maxspeed, -1, 1.6) + (k.dashT > 0 ? 0.25 : 0), k.steer * 0.25, -c.roll * 1.4);
  const ready = k.dashCd <= 0, gl = ready ? 0.05 + 0.16 * (0.5 + 0.5 * Math.sin(time * 7)) : -0.45;
  c.glow.uniforms.uGlow.value.set(gl, gl, ready ? gl * 0.4 : gl);
}

export function syncScene(view, sim, alpha, dt) {
  const world = sim.world;
  view.time += dt;
  view.counts.fill(0);
  for (const it of world.items) {
    if (!it.taken) putGood(view, it.good, it.x, 0.5, it.z, Math.atan2(it.nx, it.nz), 1);
  }
  for (const d of world.drops) {
    if (d.live) putGood(view, d.good, d.x, 0.02, d.z, d.x * 1.7 + d.z, 1);
  }
  for (let i = 0; i < view.goods.length; i++) {
    const mesh = view.goods[i];
    mesh.count = view.counts[i];
    mesh.instanceMatrix.needsUpdate = true;
  }
  for (const c of view.carts) syncCart(c, alpha, dt, view.time);
}

// Visual reactions of scene objects to simulation events.
export function sceneEvent(view, e) {
  if (e.type !== 'crash' && e.type !== 'bump' && e.type !== 'cartbump') return;
  for (const c of view.carts) {
    if (c.k === e.cart || c.k === e.solid) c.squash = e.type === 'crash' ? 1 : 0.55;
  }
}

export function disposeScene(view) {
  gfx.scene.remove(view.root);
  view.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of view.own) m.dispose();
}
