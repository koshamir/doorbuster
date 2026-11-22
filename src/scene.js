// DOORBUSTER — scene.js
// Purpose: builds the visuals of one level from the simulation world and, every frame, copies the
//          simulation state onto them: carts and their animation, the towers of goods and how they
//          sway, goods flying into carts, goods on shelves and on the floor, pieces that break or fly,
//          shadows and the hero's ring. Reads the simulation, never writes it.
// Exports: buildScene, syncScene, sceneEvent, disposeScene
// Depends on: config.js, gfx.js, models.js and the global THREE (inside functions only).

import { TUNE, CFG, PAL, GOODS, rgb, clamp, lerp, wrapAngle } from './config.js';
import { gfx, toonMaterial, flatMaterial, ringMaterial } from './gfx.js';
import { makeBuilder, place, addBox, addCyl, addBall, toGeometry, cartGeometry, bumperGeometry, beanGeometry, goodGeometry,
  addShelf, addPiece, pieceGeometry } from './models.js';

const GOOD_CAP = 220;        // instances per kind of goods
const SHADOW_CAP = 320;      // contact shadows (static ones first, then the moving blobs)
const GLOW_CAP = 48;         // coloured discs on the floor: list items, hot items, spilled goods
const TOWER_SCALE = 0.85;    // goods shrink a little when they land in a cart
const FLY_TIME = 0.2;        // seconds for a swept item to arc into the cart
const BASKET_Y = 0.48;       // height of the basket floor
const LOOSE = { pyramid: 1, gifts: 1, stand: 1, podium: 1, table: 1, boxes: 1, mannequin: 1 };   // pieces with their own mesh
const towX = new Float32Array(200), towY = new Float32Array(200), towZ = new Float32Array(200), towYaw = new Float32Array(200);

// The floor's tile map: store colour, painted decals and where the floor ends (see FLOOR_FS in gfx.js).
function floorMap(world) {
  const { cols, rows, def } = world, data = new Uint8Array(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) {
    const zone = (def.zones || [])[world.zone[i]] || {};
    data[i * 4] = Math.round((zone.color || 0) / 8 * 255);
    data[i * 4 + 1] = world.laneOf[i] >= 0 ? Math.round(5 / 8 * 255) : 0;
    data[i * 4 + 3] = world.floor[i] ? 255 : 0;
  }
  // Chevrons along the route: walk the navigation field from the start and paint every third tile.
  let c = Math.floor(world.start.x / CFG.TILE), r = Math.floor(world.start.z / CFG.TILE);
  for (let n = 0; n < 600; n++) {
    let best = world.nav[r * cols + c], bc = c, br = r, dir = 0;
    for (const [dc, dr, d] of [[1, 0, 1], [0, 1, 2], [-1, 0, 3], [0, -1, 4]]) {
      const v = world.nav[(r + dr) * cols + c + dc];
      if (v < best - 1e-3) { best = v; bc = c + dc; br = r + dr; dir = d; }
    }
    if (!dir) break;
    if (n % 3 === 1 && world.plan[r][c] === '.') data[(r * cols + c) * 4 + 1] = Math.round(dir / 8 * 255);
    c = bc; r = br;
  }
  const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// A hanging banner with a store's name, drawn on a canvas (the only text in the 3D world).
function banner(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d'), hex = (v) => '#' + v.toString(16).padStart(6, '0');
  g.fillStyle = hex(PAL.night); g.fillRect(0, 0, 512, 96);
  g.fillStyle = hex(color); g.fillRect(0, 0, 512, 10); g.fillRect(0, 86, 512, 10);
  g.font = '900 56px "Arial Black", Impact, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = hex(PAL.sale); g.fillText(text, 256, 50, 480);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  // two quads back to back, each with the text the right way round
  const geo = new THREE.BufferGeometry(), w = 3.2, h = 0.6;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-w, -h, 0, w, -h, 0, w, h, 0, -w, -h, 0, w, h, 0, -w, h, 0,
    w, -h, 0, -w, -h, 0, -w, h, 0, w, -h, 0, -w, h, 0, w, h, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
}

// Builds everything for sim.world and returns the "view" that syncScene updates.
export function buildScene(sim) {
  const world = sim.world, M = gfx.mats, zones = world.def.zones || [];
  const accentOf = (i) => PAL.zones[((zones[world.zone[i]] || {}).color || 0) % 4];
  const view = { root: new THREE.Group(), goods: [], counts: new Int32Array(GOODS.length), carts: [], pieces: [], own: [],
    flights: new Map(), time: 0, frame: 0, towerH: 0, shadows: null, fixed: 0, shadowN: 0, glows: null, glowN: 0, ring: null, ringMat: null };
  gfx.scene.add(view.root);

  // Floor: one quad under the whole plan; the shader draws tiles, store tints, arrows and edge shadows.
  const map = floorMap(world);
  view.own.push(map);
  M.floor.uniforms.uMap.value = map;
  M.floor.uniforms.uMapSize.value.set(world.cols, world.rows);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(world.w, world.h), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(world.w / 2, 0, world.h / 2);
  view.root.add(floor);

  // Walls: merged boxes with dark tops, so the rooms read as cut out of a block.
  const wb = makeBuilder();
  for (const w of world.walls) {
    place(wb, w.x, 0, w.z);
    addBox(wb, w.hx * 2, CFG.WALL_H, w.hz * 2, PAL.wall, { bevel: 0, top: PAL.walltop });
  }
  view.root.add(new THREE.Mesh(toGeometry(wb), [M.toon, M.lineThin]));

  // Contact shadows: one instanced octagon; the static ones are written once, moving blobs every frame.
  const sb = makeBuilder();
  addCyl(sb, 1, 1, 0.001, PAL.shadow, { seg: 8 });
  view.shadows = new THREE.InstancedMesh(toGeometry(sb), view.own[view.own.push(flatMaterial(0.2)) - 1], SHADOW_CAP);
  view.shadows.frustumCulled = false;
  view.shadows.renderOrder = 1;
  view.root.add(view.shadows);
  const gb = makeBuilder();
  addCyl(gb, 1, 1, 0.001, PAL.white, { seg: 12 });
  view.glows = new THREE.InstancedMesh(toGeometry(gb), view.own[view.own.push(flatMaterial(0.5)) - 1], GLOW_CAP);
  view.glows.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GLOW_CAP * 3), 3);
  view.glows.frustumCulled = false;
  view.glows.renderOrder = 1;
  view.root.add(view.glows);

  // Furniture: shelves and the pieces that never change, in one static mesh with a thin outline.
  const fb = makeBuilder();
  for (const s of world.shelves) {
    addShelf(fb, s, accentOf(Math.floor(s.z / CFG.TILE) * world.cols + Math.floor(s.x / CFG.TILE)));
    putShadow(view, s.x, s.z, s.hx + 0.22, s.hz + 0.22, 0);
  }
  const beam = makeBuilder();
  addCyl(beam, 0.5, 0.75, 4.5, PAL.hot, { seg: 10 });
  const beamGeo = toGeometry(beam), beamMat = flatMaterial(0.14, true);
  view.own.push(beamMat);
  const geos = {};
  for (const p of world.pieces) {
    const rad = p.solid.r || Math.max(p.solid.hx, p.solid.hz);
    putShadow(view, p.x, p.z, (p.solid.r || p.solid.hx) + 0.15, (p.solid.r || p.solid.hz) + 0.15, 0);
    if (!LOOSE[p.type]) { addPiece(fb, p.type, p.x, p.z, accentOf(p.r * world.cols + p.c)); continue; }
    const mesh = new THREE.Mesh(geos[p.type] || (geos[p.type] = pieceGeometry(p.type)), [M.toon, M.lineThin]);
    mesh.position.set(p.x, 0, p.z);
    view.root.add(mesh);
    const item = { p, mesh, beam: null, vx: 0, vy: 0, vz: 0, fly: 0, rad };
    if (p.type === 'podium') { item.beam = new THREE.Mesh(beamGeo, beamMat); item.beam.position.set(p.x, 0.3, p.z); view.root.add(item.beam); }
    view.pieces.push(item);
  }
  view.fixed = view.shadowN;
  view.root.add(new THREE.Mesh(toGeometry(fb), [M.toon, M.lineThin]));

  // Holiday garlands: a coloured bulb on the top edge of the walls wherever floor meets wall.
  const bulbs = [];
  for (let r = 1; r < world.rows - 1; r++) for (let c = 1; c < world.cols - 1; c++) {
    if (!world.floor[r * world.cols + c]) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!world.floor[(r + dr) * world.cols + c + dc]) bulbs.push((c + 0.5 + dc * 0.56) * CFG.TILE, (r + 0.5 + dr * 0.56) * CFG.TILE);
    }
  }
  const lb = makeBuilder();
  addBall(lb, 0.16, 0.16, 0.16, PAL.white, { seg: 5, rings: 3 });
  const lights = new THREE.InstancedMesh(toGeometry(lb), [M.toon], bulbs.length / 2);
  const mat4 = new THREE.Matrix4(), tint = new THREE.Color();
  const GARLAND = [PAL.danger, PAL.sale, PAL.list, PAL.player, PAL.sky];
  for (let i = 0; i < bulbs.length / 2; i++) {
    lights.setMatrixAt(i, mat4.makeTranslation(bulbs[i * 2], CFG.WALL_H + 0.1, bulbs[i * 2 + 1]));
    const c = rgb(GARLAND[i % 5]);
    lights.setColorAt(i, tint.setRGB(c[0], c[1], c[2]));     // raw values: the shaders treat colours as sRGB
  }
  lights.frustumCulled = false;
  view.root.add(lights);

  // The level's name hangs over the way ahead of the start; each store has a banner over its way in.
  const sx = Math.sin(world.start.h), sz = Math.cos(world.start.h);
  const first = banner(world.def.name, PAL.player);
  first.position.set(world.start.x + sx * 11, 3.3, world.start.z + sz * 11);
  first.rotation.order = 'YXZ';
  first.rotation.y = world.start.h + Math.PI; first.rotation.x = -0.45;
  view.own.push(first.material.map, first.material);
  view.root.add(first);
  zones.forEach((zn) => {
    if (!zn.rect) return;
    const [c0, r0, c1, r1] = zn.rect, tall = r1 - r0 > c1 - c0, mid = tall ? (c0 + c1 + 1) / 2 : (r0 + r1 + 1) / 2;
    const navAt = (c, r) => world.nav[Math.floor(r) * world.cols + Math.floor(c)];
    const lowEnd = tall ? navAt(mid, r0 + 1) > navAt(mid, r1 - 1) : navAt(c0 + 1, mid) > navAt(c1 - 1, mid);   // the way in is at the low index
    const at = lowEnd ? (tall ? r0 : c0) + 4 : (tall ? r1 : c1) - 3, face = lowEnd ? -1 : 1;
    const b = banner(zn.name, PAL.zones[(zn.color || 0) % 4]);
    b.position.set((tall ? mid : at) * CFG.TILE, 3.5, (tall ? at : mid) * CFG.TILE);
    b.rotation.order = 'YXZ';
    b.rotation.y = tall ? (face > 0 ? 0 : Math.PI) : (face > 0 ? Math.PI / 2 : -Math.PI / 2);
    b.rotation.x = -0.45;                               // tipped back toward the high camera
    view.own.push(b.material.map, b.material);
    view.root.add(b);
  });

  // Goods: one instanced mesh per kind serves shelves, the floor, the air and the towers.
  for (let i = 0; i < GOODS.length; i++) {
    const mesh = new THREE.InstancedMesh(goodGeometry(i), [M.toon, GOODS[i].size === 'H' ? M.lineBold : M.lineThin], GOOD_CAP);
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
    const bean = new THREE.Mesh(beanGeometry(k.char, k.def.color), [M.toonRim, M.lineBold]);
    bean.position.z = -1.3;
    tilt.add(new THREE.Mesh(cartGeometry(k.def.color), [M.toonRim, M.lineBold]));
    tilt.add(new THREE.Mesh(bumperGeometry(), [glow, M.lineBold]));
    g.add(tilt); g.add(bean);
    view.root.add(g);
    view.carts.push({ k, g, tilt, bean, glow, roll: 0, pitch: 0, squash: 0, stretch: 0, bob: 0, lastSpd: 0,
      swayX: 0, swayXv: 0, swayZ: 0, swayZv: 0, pending: 0 });
  }

  // The hero's ring: a flat quad on the floor under the player's cart.
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
  view.ringMat = ringMaterial();
  view.own.push(view.ringMat);
  view.ring = new THREE.Mesh(rg, view.ringMat);
  view.ring.scale.set(1.5, 1, 1.5);
  view.ring.frustumCulled = false;
  view.ring.renderOrder = 2;
  view.root.add(view.ring);
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

// Writes one contact shadow: an octagon of half sizes (rx, rz) turned by ry, just above the floor.
function putShadow(view, x, z, rx, rz, ry) {
  const n = view.shadowN;
  if (n >= SHADOW_CAP) return;
  const m = view.shadows.instanceMatrix.array, o = n * 16, c = Math.cos(ry), s = Math.sin(ry);
  m[o] = c * rx; m[o + 1] = 0; m[o + 2] = -s * rx; m[o + 3] = 0;
  m[o + 4] = 0; m[o + 5] = 1; m[o + 6] = 0; m[o + 7] = 0;
  m[o + 8] = s * rz; m[o + 9] = 0; m[o + 10] = c * rz; m[o + 11] = 0;
  m[o + 12] = x; m[o + 13] = 0.02; m[o + 14] = z; m[o + 15] = 1;
  view.shadowN = n + 1;
}

// Writes one coloured floor disc of radius r (list items, hot items).
function putGlow(view, x, z, r, color) {
  const n = view.glowN;
  if (n >= GLOW_CAP) return;
  const m = view.glows.instanceMatrix.array, o = n * 16, c = rgb(color);
  m.fill(0, o, o + 16);
  m[o] = r; m[o + 5] = 1; m[o + 10] = r; m[o + 12] = x; m[o + 13] = 0.025; m[o + 14] = z; m[o + 15] = 1;
  view.glows.instanceColor.array.set(c, n * 3);
  view.glowN = n + 1;
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
// and leans the other way; bumper and handle glow when the dash is ready; the tower sways like a spring.
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
  const yawShow = k.slip * 0.35 + k.steer * 0.1 + k.drift * 0.18;   // a drift always shows a clear angle
  c.tilt.rotation.set(c.pitch, yawShow, c.roll);
  c.tilt.scale.set((1 + sq * 0.16) * (1 - c.stretch * 0.1), 1 - sq * 0.3, (1 + sq * 0.16) * (1 + c.stretch * 0.24));
  c.bob += speed * dt * 1.5;
  c.bean.position.y = Math.abs(Math.sin(c.bob)) * 0.07;
  c.bean.rotation.set(0.1 * clamp(k.spd / TUNE.maxspeed, -1, 1.6) + (k.dashT > 0 ? 0.25 : 0), k.steer * 0.25, -c.roll * 1.4);
  const ready = k.dashCd <= 0, gl = ready ? 0.05 + 0.16 * (0.5 + 0.5 * Math.sin(view.time * 7)) : -0.45;
  c.glow.uniforms.uGlow.value.set(gl, gl, ready ? gl * 0.4 : gl);
  const sh = Math.sin(h), ch0 = Math.cos(h);
  putShadow(view, x, z, 0.72, 0.95, h);
  putShadow(view, x - sh * 1.3, z - ch0 * 1.3, 0.42, 0.42, 0);

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
  const ch = Math.cos(h + yawShow), shy = Math.sin(h + yawShow);
  c.pending = 0;
  for (let i = 0; i < k.tower.length && i < 200; i++) {
    const e = k.tower[i], ty = towY[i];
    // cart space -> world: shear with height (the lean), then rotate by the heading
    const lx = towX[i] + c.swayX * ty * 0.9, lz = towZ[i] + c.swayZ * ty * 0.9;
    let wx = x + lx * ch + lz * shy, wy = BASKET_Y + ty * (1 - sq * 0.3), wz = z - lx * shy + lz * ch, scale = TOWER_SCALE;
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
  const world = sim.world, p = sim.player;
  view.time += dt; view.frame++;
  view.counts.fill(0);
  view.shadowN = view.fixed;
  view.glowN = 0;
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
      putGood(view, d.good, d.x, bob + (d.list ? 0.25 : 0), d.z, view.time * 1.6 + d.x * 1.7, d.list ? 1.3 : 0.95, 0, 0.18);
      if (d.list) putGlow(view, d.x, d.z, 0.85 + 0.12 * Math.sin(view.time * 5), PAL.list);   // list items stand on a teal disc
      else putShadow(view, d.x, d.z, 0.3, 0.3, 0);
    }
  }
  // Pieces: hidden once smashed; light ones fly off when knocked; a podium shows its hot item in a beam.
  for (const it of view.pieces) {
    const on = it.p.solid.on;
    if (it.fly > 0) {
      it.fly -= dt; it.vy -= 16 * dt;
      it.mesh.position.x += it.vx * dt; it.mesh.position.z += it.vz * dt;
      it.mesh.position.y = Math.max(0, it.mesh.position.y + it.vy * dt);
      it.mesh.rotation.x += dt * 9; it.mesh.rotation.z += dt * 6;
      it.mesh.visible = it.fly > 0;
    } else it.mesh.visible = on || it.p.type === 'podium';
    if (it.beam) {
      it.beam.visible = on;
      if (on) {
        putGood(view, it.p.good, it.p.x, 0.36 + 0.06 * Math.sin(view.time * 3), it.p.z, view.time * 1.2, 1, 0, 0);
        putGlow(view, it.p.x, it.p.z, 1.5 + 0.1 * Math.sin(view.time * 4), PAL.hot);
      }
    }
  }
  for (const c of view.carts) syncCart(view, c, alpha, dt);
  for (const [e, f] of view.flights) if (f.seen !== view.frame) view.flights.delete(e);   // spilled before it landed
  for (let i = 0; i < view.goods.length; i++) {
    const mesh = view.goods[i];
    mesh.count = view.counts[i];
    mesh.instanceMatrix.needsUpdate = true;
  }
  view.shadows.count = view.shadowN;
  view.shadows.instanceMatrix.needsUpdate = true;
  view.glows.count = view.glowN;
  view.glows.instanceMatrix.needsUpdate = true;
  view.glows.instanceColor.needsUpdate = true;
  // The hero's ring follows the player; while drifting, an arc inside it fills toward the next tier.
  view.ring.position.set(lerp(p.px, p.x, alpha), 0.03, lerp(p.pz, p.z, alpha));
  view.ring.rotation.y = p.h;
  const u = view.ringMat.uniforms, tiers = CFG.driftTiers, t0 = p.tier > 0 ? tiers[p.tier - 1] : 0;
  const col = rgb(PAL.tiers[Math.min(3, p.tier + (p.tier < 3 ? 1 : 0))]);
  u.uCharge.value.set(col[0], col[1], col[2]);
  u.uFill.value = !p.drift ? 0 : p.tier >= 3 ? 1 : (p.driftT - t0) / (tiers[p.tier] - t0);
  u.uPulse.value = p.drift && p.tier >= 3 ? 0.5 + 0.5 * Math.sin(view.time * 18) : 0;
}

// Visual reactions of scene objects to simulation events.
export function sceneEvent(view, e) {
  if (e.type === 'knock') {
    // A light prop is thrown the way the cart was going.
    for (const it of view.pieces) if (it.p.solid === e.ref) { it.fly = 1.1; it.vx = e.cart.vx * 0.7; it.vz = e.cart.vz * 0.7; it.vy = 6; }
    return;
  }
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
