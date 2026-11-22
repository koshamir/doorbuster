// DOORBUSTER — scene.js
// Purpose: builds the visuals of one level from the simulation world and, every frame, copies the
//          simulation state onto them: carts and their animation, the towers of goods and how they
//          sway, goods flying into carts, goods on shelves and on the floor, the crowd, pieces that
//          break or fly, checkout lamps and barriers, shadows and the hero's ring. Reads the
//          simulation, never writes it.
// Exports: buildScene, syncScene, sceneEvent, disposeScene, goodIcon
// Depends on: config.js, render.js, kits.js, models.js and the global THREE (inside functions only).

import { TUNE, CFG, PAL, GOODS, rgb, mix, clamp, lerp, wrapAngle } from './config.js';
import { R, celMaterial, hullMaterial, blendMaterial, MRT_OUT, AUX_NONE, v3 } from './render.js';
import { floorMaterial, floorMap, kitOf } from './kits.js';
import { makeCharacter, animate } from './rig.js';
import { makeCrowd, syncCrowd, crowdPose, disposeCrowd } from './crowd.js';
import { CROWD, CROWD_COLORS } from './cast.js';
import { EXPR } from './atlas.js';
import { makeBuilder, place, addBox, addCyl, addBall, mGeometry, cartGeometry, bumperGeometry, goodGeometry,
  addShelf, addPiece, pieceGeometry } from './models.js';

const CAST_IDS = { penny: 'player', granny: 'granny', dad: 'dad', queen: 'queen', selfie: 'selfie', bubba: 'bro' };
const GOOD_CAP = 220;        // instances per kind of goods
const SHADOW_CAP = 380;      // contact shadows (static ones first, then the moving blobs)
const GLOW_CAP = 64;         // coloured discs on the floor: list items, hot items, rivals with a grudge
const CROWD_CAP = 96;        // shoppers on foot
const TOWER_SCALE = 0.85;    // goods shrink a little when they land in a cart
const FLY_TIME = 0.2;        // seconds for a swept item to arc into the cart
const BASKET_Y = 0.48;       // height of the basket floor
const LOOSE = { pyramid: 1, gifts: 1, stand: 1, podium: 1, glass: 1, table: 1, boxes: 1, mannequin: 1 };   // pieces with their own mesh
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const towX = new Float32Array(200), towY = new Float32Array(200), towZ = new Float32Array(200), towYaw = new Float32Array(200), towCol = new Float32Array(6);

// Unlit vertex colour with one alpha (blob shadows, glows, beams), and the hero's ground ring.
const FLAT_VS = `varying vec3 vColor;
void main() { vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  vColor = color;
#ifdef USE_INSTANCING_COLOR
  vColor *= instanceColor;
#endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * p; }`;
const FLAT_FS = `uniform float uAlpha; varying vec3 vColor; ${MRT_OUT} void main() { gl_FragColor = vec4(vColor, uAlpha); oAux = vec4(0.0); }`;
function flatMat(alpha, additive) {
  return blendMaterial(new THREE.ShaderMaterial({ uniforms: { uAlpha: { value: alpha } }, vertexShader: FLAT_VS, fragmentShader: FLAT_FS, vertexColors: true }), additive);
}
const RING_VS = 'varying vec2 vUv; void main() { vUv = position.xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const RING_FS = `uniform vec3 uColor; uniform vec3 uCharge; uniform vec3 uInk; uniform float uFill; uniform float uPulse; varying vec2 vUv; ${MRT_OUT}
void main() {
  float r = length(vUv), ang = atan(vUv.x, vUv.y) / 6.2831853 + 0.5;
  float ring = step(0.56, r) * step(r, 0.68), on = step(0.001, uFill) * step(ang, uFill + 0.012), arc = step(0.74, r) * step(r, 1.0) * on;
  if (ring + arc < 0.5) discard;
  float core = step(0.78, r) * step(r, 0.96) * step(ang, uFill);
  gl_FragColor = vec4(arc > 0.5 ? (core > 0.5 ? mix(uCharge, vec3(1.0), uPulse) : uInk) : uColor, 0.0); ${AUX_NONE}
}`;
function ringMat() {
  return new THREE.ShaderMaterial({ uniforms: { uColor: { value: v3(PAL.player) }, uCharge: { value: new THREE.Vector3(1, 1, 1) }, uInk: { value: v3(PAL.outline) }, uFill: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: RING_VS, fragmentShader: RING_FS, side: THREE.DoubleSide });
}
const SIGN_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const SIGN_FS = `uniform sampler2D uMap; uniform float uOpacity; varying vec2 vUv; ${MRT_OUT}
void main() { vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(t.rgb, t.a * uOpacity); oAux = vec4(0.0); }`;

// A hanging banner with a name on it, drawn on a canvas (the only text in the 3D world). w and h are
// half sizes in metres.
function banner(text, color, w = 3.2, h = 0.6) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d'), hex = (v) => '#' + v.toString(16).padStart(6, '0');
  g.fillStyle = hex(PAL.night); g.fillRect(0, 0, 512, 96);
  g.fillStyle = hex(color); g.fillRect(0, 0, 512, 10); g.fillRect(0, 86, 512, 10);
  g.font = '900 60px "Arial Black", Impact, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = hex(PAL.sale); g.fillText(text, 256, 50, 470);
  const tex = new THREE.CanvasTexture(cv);
  // two quads back to back, each with the text the right way round
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-w, -h, 0, w, -h, 0, w, h, 0, -w, -h, 0, w, h, 0, -w, h, 0,
    w, -h, 0, -w, -h, 0, -w, h, 0, w, -h, 0, -w, h, 0, w, h, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  const mesh = new THREE.Mesh(geo, blendMaterial(new THREE.ShaderMaterial({ uniforms: { uMap: { value: tex }, uOpacity: { value: 1 } }, vertexShader: SIGN_VS, fragmentShader: SIGN_FS })));
  mesh.material.map = tex;
  mesh.rotation.order = 'YXZ';
  mesh.rotation.x = -0.45;                              // tipped back toward the high camera
  return mesh;
}

// Builds everything for sim.world and returns the "view" that syncScene updates.
export function buildScene(sim) {
  const kit = kitOf(sim.def), M = { toon: celMaterial({ halftone: true }), toonRim: celMaterial({ rim: 0.55 }), lineBold: hullMaterial(3), floor: floorMaterial(kit) };
  const world = sim.world, zones = world.def.zones || [], T = CFG.TILE, cols = world.cols;
  const accentOf = (i) => PAL.zones[((zones[world.zone[i]] || {}).color || 0) % 4];
  const isFloor = (c, r) => c >= 0 && r >= 0 && c < cols && r < world.rows && world.floor[r * cols + c] === 1;
  const view = { root: new THREE.Group(), goods: [], counts: new Int32Array(GOODS.length), carts: [], pieces: [], own: [],
    flights: new Map(), time: 0, frame: 0, towerH: 0, doneAt: -1, shadows: null, fixed: 0, shadowN: 0, glows: null, glowN: 0, ring: null, ringMat: null,
    crowd: null, lanes: null, map: null, trains: [], banners: [] };
  R.scene.add(view.root);
  view.own.push(M.toon, M.toonRim, M.floor);
  view.kit = kit;
  const add = (mesh) => { mesh.frustumCulled = false; view.root.add(mesh); return mesh; };
  const hang = (b, x, y, z, ry) => { b.position.set(x, y, z); b.rotation.y = ry; view.own.push(b.material.map, b.material); view.root.add(b); view.banners.push(b); };

  // Floor: one quad under the whole plan; the shader draws tiles, store tints, arrows and edge shadows.
  view.map = floorMap(world);
  R.renderer.setClearColor(kit.void, 0);
  view.own.push(view.map);
  M.floor.uniforms.uMap.value = view.map;
  M.floor.uniforms.uMapSize.value.set(cols, world.rows);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(world.w, world.h), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(world.w / 2, 0, world.h / 2);
  view.root.add(floor);

  // Walls: merged boxes with plum tops, so the rooms read as cut out of a block; every wall face that
  // looks into a store carries a band in that store's colour.
  const wb = makeBuilder();
  for (const w of world.walls) {
    place(wb, w.x, 0, w.z);
    addBox(wb, w.hx * 2, CFG.WALL_H, w.hz * 2, PAL.wall, { bevel: 0, top: PAL.walltop });
  }
  const bulbs = [];
  for (let r = 0; r < world.rows; r++) for (let c = 0; c < cols; c++) {
    if (!isFloor(c, r)) continue;
    for (const [dc, dr] of DIRS) {
      if (isFloor(c + dc, r + dr)) continue;
      place(wb, (c + 0.5 + dc * 0.49) * T, 1.5, (r + 0.5 + dr * 0.49) * T, dc ? Math.PI / 2 : 0);
      addBox(wb, T, 0.6, 0.1, mix(accentOf(r * cols + c), PAL.wall, 0.25), { bevel: 0 });
      if ((c + r) % 2 === 0) bulbs.push((c + 0.5 + dc * 0.56) * T, (r + 0.5 + dr * 0.56) * T);
    }
  }
  view.root.add(new THREE.Mesh(mGeometry(wb), M.toon));

  // Contact shadows: one instanced octagon; the static ones are written once, moving blobs every frame.
  const sb = makeBuilder();
  addCyl(sb, 1, 1, 0.001, PAL.shadow, { seg: 8 });
  view.shadows = add(new THREE.InstancedMesh(mGeometry(sb), view.own[view.own.push(flatMat(0.2)) - 1], SHADOW_CAP));
  view.shadows.renderOrder = 1;
  const gb = makeBuilder();
  addCyl(gb, 1, 1, 0.001, PAL.white, { seg: 12 });
  view.glows = add(new THREE.InstancedMesh(mGeometry(gb), view.own[view.own.push(flatMat(0.5)) - 1], GLOW_CAP));
  view.glows.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GLOW_CAP * 3), 3);
  view.glows.renderOrder = 1;

  // Furniture: shelves and the pieces that never change, in one static mesh with a thin outline.
  const fb = makeBuilder();
  for (const s of world.shelves) {
    addShelf(fb, s, accentOf(Math.floor(s.z / T) * cols + Math.floor(s.x / T)));
    putShadow(view, s.x, s.z, s.hx + 0.22, s.hz + 0.22, 0);
  }
  // A hot item stands in a hard-edged gold column with a star turning above it.
  const beam = makeBuilder();
  addCyl(beam, 0.3, 0.3, 5, PAL.hot, { seg: 8 });
  const beamGeo = mGeometry(beam), beamMat = flatMat(0.42), starGeo = pieceGeometry('star');
  view.own.push(beamMat);
  const geos = {};
  for (const p of world.pieces) {
    const rad = p.solid.r || Math.max(p.solid.hx, p.solid.hz);
    if (!LOOSE[p.type]) {
      putShadow(view, p.x, p.z, (p.solid.r || p.solid.hx) + 0.15, (p.solid.r || p.solid.hz) + 0.15, 0);
      addPiece(fb, p.type, p.x, p.z, accentOf(p.r * cols + p.c));
      continue;
    }
    const mesh = new THREE.Mesh(geos[p.type] || (geos[p.type] = pieceGeometry(p.type)), M.toon);
    mesh.position.set(p.x, 0, p.z);
    if (p.type === 'glass' && isFloor(p.c - 1, p.r) && isFloor(p.c + 1, p.r)) mesh.rotation.y = Math.PI / 2;   // across the way through
    view.root.add(mesh);
    const item = { p, mesh, beam: null, star: null, vx: 0, vy: 0, vz: 0, fly: 0, rad };
    if (p.type === 'podium') {
      item.beam = new THREE.Mesh(beamGeo, beamMat); item.beam.position.set(p.x, 0.3, p.z); view.root.add(item.beam);
      item.star = new THREE.Mesh(starGeo, [M.toon, M.lineBold]); view.root.add(item.star);
    }
    view.pieces.push(item);
  }
  // Ramps face down the route; a wet patch gets one yellow sign at its first corner.
  for (const rp of world.ramps) { addPiece(fb, 'ramp', rp.x, rp.z, PAL.sale, Math.atan2(rp.dx, rp.dz)); putShadow(view, rp.x, rp.z, 1.1, 1.3, Math.atan2(rp.dx, rp.dz)); }
  for (let i = 0; i < world.wet.length; i++) {
    if (world.wet[i] && !world.wet[i - 1] && !world.wet[i - cols]) addPiece(fb, 'wetsign', (i % cols) * T - 0.2, Math.floor(i / cols) * T - 0.2);
  }
  view.fixed = view.shadowN;
  view.root.add(new THREE.Mesh(mGeometry(fb), M.toon));
  // The cart train: a string of steel carts.
  const carGeo = sim.trains.length ? cartGeometry(PAL.danger) : null;
  for (const tr of sim.trains) {
    const cars = [];
    for (let i = 0; i < CFG.trainCars; i++) { const m = new THREE.Mesh(carGeo, M.toon); view.root.add(m); cars.push(m); }
    view.trains.push({ tr, cars });
  }

  // Holiday garlands: small warm-white bulbs along the top edge of the walls (decoration never uses a signal colour).
  const lb = makeBuilder();
  addBall(lb, 0.1, 0.1, 0.1, PAL.wall, { seg: 5, rings: 3 });
  const lights = add(new THREE.InstancedMesh(mGeometry(lb), M.toon, Math.max(1, bulbs.length / 2)));
  const mat4 = new THREE.Matrix4();
  for (let i = 0; i < bulbs.length / 2; i++) lights.setMatrixAt(i, mat4.makeTranslation(bulbs[i * 2], CFG.WALL_H + 0.08, bulbs[i * 2 + 1]));

  // Each store has a banner over its way in.
  const navAt = (x, z) => isFloor(Math.floor(x / T), Math.floor(z / T)) ? world.nav[Math.floor(z / T) * cols + Math.floor(x / T)] : 1e9;
  zones.forEach((zn) => {
    if (!zn.rect) return;
    const [c0, r0, c1, r1] = zn.rect, tall = r1 - r0 > c1 - c0, mid = tall ? (c0 + c1 + 1) / 2 : (r0 + r1 + 1) / 2;
    const lowEnd = tall ? navAt(mid * T, (r0 + 1) * T) > navAt(mid * T, (r1 - 1) * T) : navAt((c0 + 1) * T, mid * T) > navAt((c1 - 1) * T, mid * T);   // the way in is at the low index
    const at = lowEnd ? (tall ? r0 : c0) + 4 : (tall ? r1 : c1) - 3, face = lowEnd ? -1 : 1;
    hang(banner(zn.name, PAL.zones[(zn.color || 0) % 4]), (tall ? mid : at) * T, 3.5, (tall ? at : mid) * T,
      tall ? (face > 0 ? 0 : Math.PI) : (face > 0 ? Math.PI / 2 : -Math.PI / 2));
  });

  // The checkouts: a big sign over the lanes facing the way the carts come from; over each lane a lamp
  // (green = open) and, once it has closed, a barrier at both ends. One instanced box does lamps and bars.
  const L = world.lanes;
  if (L.length) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const l of L) { x0 = Math.min(x0, l.bar.x - l.bar.hx); x1 = Math.max(x1, l.bar.x + l.bar.hx); z0 = Math.min(z0, l.bar.z - l.bar.hz); z1 = Math.max(z1, l.bar.z + l.bar.hz); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    let far = -1, ax = 0, az = 1;
    for (const [dx, dz] of DIRS) {
      const v = navAt(cx + dx * (hx + T * 1.5), cz + dz * (hz + T * 1.5));
      if (v < 1e8 && v > far) { far = v; ax = dx; az = dz; }
    }
    hang(banner('CHECKOUT', PAL.sale, Math.max(4, ax ? hz : hx), 1.15), cx + ax * (hx + 0.4), 4.4, cz + az * (hz + 0.4), Math.atan2(ax, az));
    view.lanes = add(new THREE.InstancedMesh(pieceGeometry('box'), M.toon, L.length * 3));
    view.lanes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.length * 9).fill(1), 3);
  }

  // Goods: one instanced mesh per kind serves shelves, the floor, the air and the towers.
  for (let i = 0; i < GOODS.length; i++) {
    const mesh = add(new THREE.InstancedMesh(goodGeometry(i), GOODS[i].size === 'H' ? [M.toon, M.lineBold] : M.toon, GOOD_CAP));
    mesh.count = 0;
    view.goods.push(mesh);
  }

  // The crowd: one instanced shopper in three muted colours.
  view.crowdKinds = kit.crowd;
  view.crowd = makeCrowd(kit.crowd);
  view.root.add(view.crowd.root);
  view.people = []; view.crowdList = [];

  // Carts with their shoppers. `tilt` carries the lean, pitch and squash of the cart body.
  for (const k of sim.carts) {
    const g = new THREE.Group(), tilt = new THREE.Group();
    const glow = celMaterial({ rim: 0.55 });
    view.own.push(glow);
    const ch = makeCharacter(Object.keys(CAST_IDS).find((id) => CAST_IDS[id] === k.char) || 'penny');
    ch.mesh.position.z = -1.3;
    tilt.add(new THREE.Mesh(cartGeometry(k.def.color), [M.toonRim, M.lineBold]));
    tilt.add(new THREE.Mesh(bumperGeometry(), [glow, M.lineBold]));
    g.add(tilt); g.add(ch.mesh);
    g.traverse((o) => o.layers.enable(1));
    view.root.add(g);
    view.carts.push({ k, g, tilt, ch, glow, st: { mode: 'count', handle: [1.3, 0.38, 0.34], look: null }, expr: null, exprT: 0, roll: 0, pitch: 0, squash: 0, stretch: 0, bob: 0, lastSpd: 0,
      swayX: 0, swayXv: 0, swayZ: 0, swayZv: 0, pending: 0 });
  }

  // The hero's ring: a flat quad on the floor under the player's cart.
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
  view.ringMat = ringMat();
  view.own.push(view.ringMat);
  view.ring = add(new THREE.Mesh(rg, view.ringMat));
  view.ring.renderOrder = 2;
  return view;
}

// Writes one instance matrix at offset o of array m: position, yaw, then pitch (rx) and roll (rz),
// uniform scale. No allocation.
function putAt(m, o, x, y, z, ry, s, rx, rz) {
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
}
function putGood(view, kind, x, y, z, ry, s, rx, rz) {
  const n = view.counts[kind];
  if (n >= GOOD_CAP) return;
  putAt(view.goods[kind].instanceMatrix.array, n * 16, x, y, z, ry, s, rx, rz);
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

// Writes one coloured floor disc of radius r (list items, hot items, a rival's mood); with rz and ry it
// is an ellipse of half sizes (r, rz) turned by ry (the line of an announced ram).
function putGlow(view, x, z, r, color, rz = r, ry = 0) {
  const n = view.glowN;
  if (n >= GLOW_CAP) return;
  const m = view.glows.instanceMatrix.array, o = n * 16, c = rgb(color), cy = Math.cos(ry), sy = Math.sin(ry);
  m.fill(0, o, o + 16);
  m[o] = cy * r; m[o + 2] = -sy * r; m[o + 5] = 1; m[o + 8] = sy * rz; m[o + 10] = cy * rz; m[o + 12] = x; m[o + 13] = 0.025; m[o + 14] = z; m[o + 15] = 1;
  view.glows.instanceColor.array.set(c, n * 3);
  view.glowN = n + 1;
}

// One lamp or barrier: a box of size (sx, sy, sz) at (x, y, z) in a colour (r, g, b).
function putBox(mesh, n, x, y, z, sx, sy, sz, c, bright) {
  const m = mesh.instanceMatrix.array, o = n * 16;
  m.fill(0, o, o + 16);
  m[o] = sx; m[o + 5] = sy; m[o + 10] = sz; m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
  const col = mesh.instanceColor.array;
  col[n * 3] = c[0] * bright; col[n * 3 + 1] = c[1] * bright; col[n * 3 + 2] = c[2] * bright;
}

// Packs a tower into the basket as a heap a little wider than the cart, so that even a full one
// stays low enough to see the way ahead over it: the width is six columns; small goods take two of
// them (three abreast), medium and large ones three (two abreast), hot items all six. Each item goes
// where the heap is shallowest; a new layer starts when that place is used up. Fills towX/Y/Z/Yaw
// (cart space, y from the basket floor) and returns the height of the pile.
function layoutTower(tower) {
  const LEN = 1.16;
  let y = 0, layerH = 0;
  towCol.fill(0);
  const n = Math.min(tower.length, 200);
  for (let i = 0; i < n; i++) {
    const g = GOODS[tower[i].good], span = g.size === 'S' ? 2 : g.size === 'H' ? 6 : 3;
    let w = g.dims[0] * TOWER_SCALE, d = g.dims[2] * TOWER_SCALE, yaw = 0;
    if (span === 6 ? w > 0.86 : w > 0.5 && d < w) { const t = w; w = d; d = t; yaw = Math.PI / 2; }   // big goods ride long side forward
    let at = 0, z0 = 1e9;
    for (let s = 0; s < 6; s += span) {
      let m = 0;
      for (let c = s; c < s + span; c++) m = Math.max(m, towCol[c]);
      if (m < z0 - 1e-6) { z0 = m; at = s; }
    }
    if (z0 + d > LEN && z0 > 0) { y += layerH; layerH = 0; towCol.fill(0); z0 = 0; at = 0; }
    towCol.fill(z0 + d * 0.96, at, at + span);
    towX[i] = (at + span / 2 - 3) * 0.18;
    towY[i] = y;
    towZ[i] = -LEN / 2 + Math.min(z0 + d / 2, LEN - 0.1);
    towYaw[i] = yaw + ((i * 37) % 11 - 5) * 0.035;
    layerH = Math.max(layerH, g.dims[1] * TOWER_SCALE * 0.94);
  }
  return y + layerH;
}

// The cart body leans out of turns, pitches with acceleration, squashes on impact and spins when it
// is rammed; the shopper bobs and leans the other way; bumper and handle glow when the dash is ready;
// the tower sways like a spring. A rival that has checked out shrinks away.
function syncCart(view, c, sim, alpha, dt) {
  const k = c.k, ease = 1 - Math.exp(-dt * 10), speed = Math.abs(k.spd);
  const x = lerp(k.px, k.x, alpha), z = lerp(k.pz, k.z, alpha);
  const gone = k.done && !k.player ? clamp((sim.t - k.doneT - 0.5) / 0.3, 0, 1) : 0;
  c.g.visible = gone < 1;
  if (gone >= 1) return;
  const u = k.spinT > 0 ? 1 - k.spinT / (k.player ? 0.6 : 1) : 1;
  const h = k.ph + wrapAngle(k.h - k.ph) * alpha + (1 - (1 - u) * (1 - u)) * 6.2832;   // one full turn, easing out
  const up = k.air > 0 ? 4 * CFG.jumpHeight * (k.air / k.airT) * (1 - k.air / k.airT) : 0;   // the arc of a jump
  c.g.position.set(x, up, z);
  c.g.rotation.y = h;
  c.g.scale.setScalar(1 - gone);
  const lat = k.yaw * speed;                                   // sideways acceleration, m/s2
  c.roll += (clamp(lat * 0.007, -0.2, 0.2) + k.drift * 0.1 + k.input.steer * 0.05 - c.roll) * (1 - Math.exp(-dt * 16));
  const acc = dt > 0 ? clamp((speed - c.lastSpd) / dt, -40, 40) : 0;
  c.lastSpd = speed;
  c.pitch += (clamp(-acc * 0.004, -0.1, 0.12) + (k.dashT > 0 ? 0.08 : 0) - c.pitch) * ease;
  c.squash = Math.max(0, c.squash - dt * 5);
  const sq = c.squash * c.squash;
  c.stretch += ((k.dashT > 0 ? 1 : 0) - c.stretch) * (1 - Math.exp(-dt * 20));      // the dash stretches the cart forward
  const yawShow = k.slip * 0.35 + k.steer * 0.1 + k.drift * 0.18;   // a drift always shows a clear angle
  c.tilt.rotation.set(c.pitch - (k.air > 0 ? 0.5 * (k.air / k.airT - 0.5) : 0), yawShow, c.roll);
  c.tilt.scale.set((1 + sq * 0.16) * (1 - c.stretch * 0.1), 1 - sq * 0.3, (1 + sq * 0.16) * (1 + c.stretch * 0.24));
  c.bob += speed * dt * 1.5;
  // the character: the simulation's cart state drives the procedural animation (rig.js)
  const st = c.st;
  st.mode = sim.phase === 'count' ? 'count' : 'push';
  st.speed = k.spd; st.accel = acc; st.yaw = k.yaw; st.steer = k.steer; st.drift = k.drift;
  st.dash = k.dashT > 0 ? CFG.dashTime - k.dashT : -1; st.boost = k.boostT > 0; st.air = k.air > 0 ? 1 : 0; st.stun = k.stunT;
  c.exprT -= dt;
  st.expr = c.exprT > 0 ? c.expr : k.madT > 0 ? EXPR.happy : null;
  st.squash = c.squash > 0.5 ? c.squash : 0;
  animate(c.ch.rig, st, dt);
  const mad = k.madT > 0, ready = k.dashCd <= 0 || mad;
  const gl = ready ? 0.05 + (mad ? 0.3 : 0.16) * (0.5 + 0.5 * Math.sin(view.time * (mad ? 20 : 7))) : -0.45;
  c.glow.uniforms.uGlow.value.set(gl, gl, ready ? gl * 0.4 : gl);
  const sh = Math.sin(h), ch0 = Math.cos(h);
  putShadow(view, x, z, 0.72 * (1 - gone) / (1 + up * 0.3), 0.95 * (1 - gone) / (1 + up * 0.3), h);
  putShadow(view, x - sh * 1.3, z - ch0 * 1.3, 0.42, 0.42, 0);
  // A rival's mood shows on the floor under it: red while it holds a grudge, flashing when it is about to ram.
  if (!k.player) {
    if (k.ai && k.ai.warnT > 0) {                            // ...and the line of the lunge it has announced lies on the floor ahead of it
      const ah = k.ai.aimH;
      putGlow(view, x, z, 1.9, Math.floor(view.time * 12) % 2 ? PAL.white : PAL.danger);
      putGlow(view, x + Math.sin(ah) * 5, z + Math.cos(ah) * 5, 0.85, PAL.danger, 4, ah);
    }
    else if (k.grudgeT > 0) putGlow(view, x, z, 1.5 + 0.1 * Math.sin(view.time * 9), PAL.danger);
    else if (mad) putGlow(view, x, z, 1.6, PAL.hot);
  }

  // The tower: a damped spring driven by cornering and braking; a fuller cart wobbles more.
  const fill = Math.min(1.6, k.load / TUNE.loadfull);
  const gain = mad ? 0 : 0.3 + 0.9 * fill;
  const damp = fill > 1 ? 2.6 : 4.2;
  c.swayXv += (-70 * (c.swayX - clamp(-lat * 0.011, -0.3, 0.3) * gain) - damp * c.swayXv) * dt;
  c.swayZv += (-70 * (c.swayZ - clamp(-acc * 0.006, -0.22, 0.22) * gain) - damp * c.swayZv) * dt;
  c.swayX = clamp(c.swayX + c.swayXv * dt, -0.5, 0.5);
  c.swayZ = clamp(c.swayZ + c.swayZv * dt, -0.4, 0.4);
  const height = layoutTower(k.tower);
  if (k.player) view.towerH = height;
  // At the checkout the player's goods leave the cart for the counter one after another, top first.
  const lane = k.player && k.done && k.lane >= 0 ? sim.world.lanes[k.lane] : null, n = k.tower.length;
  if (lane && view.doneAt < 0) view.doneAt = view.time;
  const ch = Math.cos(h + yawShow), shy = Math.sin(h + yawShow);
  c.pending = 0;
  for (let i = 0; i < k.tower.length && i < 200; i++) {
    const e = k.tower[i], ty = towY[i];
    // cart space -> world: shear with height (the lean), then rotate by the heading
    const lx = towX[i] + c.swayX * ty * 0.9, lz = towZ[i] + c.swayZ * ty * 0.9;
    let wx = x + lx * ch + lz * shy, wy = up + BASKET_Y + ty * (1 - sq * 0.3), wz = z - lx * shy + lz * ch, scale = TOWER_SCALE * (1 - gone);
    const f = view.flights.get(e);
    if (f) {
      // On its way from the shelf: wait for its turn, then arc into place.
      f.seen = view.frame;
      if (f.t < 0) c.pending++;
      f.t += dt;
      const v = clamp(f.t / FLY_TIME, 0, 1), s = v * v * (3 - 2 * v);
      wx = lerp(f.x, wx, s); wz = lerp(f.z, wz, s); wy = lerp(f.y, wy, s) + Math.sin(v * Math.PI) * 1.1;
      scale = lerp(1, TOWER_SCALE, s) * (1 + Math.sin(v * Math.PI) * 0.25);
      if (v >= 1) { view.flights.delete(e); c.swayZv += 0.5; }
    }
    if (lane) {
      const v = clamp((view.time - view.doneAt - 0.5 - (n - 1 - i) * 0.07) / 0.4, 0, 1);
      if (v >= 1) continue;
      wx = lerp(wx, lane.x + 1.6, v); wz = lerp(wz, lane.z, v); wy = lerp(wy, 1.1, v) + Math.sin(v * Math.PI) * 1.4; scale *= 1 - v * v * 0.7;
    }
    putGood(view, e.good, wx, wy, wz, h + yawShow + towYaw[i], scale, c.swayZ * 0.8, -c.swayX * 0.8);
  }
}

// The crowd: every shopper gets an archetype from the store's mix, colours and a face style; the
// simulation's state (stand, walk, dodge, down, run, angry: ai.js) drives the pose (crowd.js).
function syncShoppers(view, sim, dt) {
  const list = sim.shoppers, t = view.time, p = sim.player;
  view.crowdList.length = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.state < 0) continue;
    let q = view.people[i];
    if (!q) {
      const kind = view.crowdKinds[(i * 7 + 3) % view.crowdKinds.length], f = CROWD[kind].face;
      q = view.people[i] = { kind, style: f === 2 ? 2 : [0, 1, 3][i % 3], cloth: CROWD_COLORS.cloth[(i * 5) % 6], pants: CROWD_COLORS.pants[(i * 3) % 5], hair: CROWD_COLORS.hair[(i * 7 + 1) % 6], seed: i * 1.7, phase: i, scale: 0.96 + (i % 5) * 0.02, pose: {} };
    }
    const sp = Math.hypot(s.vx, s.vz);
    q.phase += sp / 1.15 * Math.PI * 2 * dt;
    q.x = s.x; q.z = s.z; q.state = s.state; q.t = s.t; q.speed = sp; q.angry = s.angry;
    q.h = s.state === 2 ? Math.atan2(s.vx, s.vz) : s.state === 3 ? s.h + (1 - s.t / 1.3) * 5 : s.angry > 0 ? Math.atan2(p.x - s.x, p.z - s.z) : s.h;
    crowdPose(q, t, q.pose);
    view.crowdList.push(q);
    if (s.state !== 3) putShadow(view, s.x, s.z, 0.36, 0.36, 0);
  }
  syncCrowd(view.crowd, view.crowdList, R.camera.position);
}
const GREEN = rgb(PAL.green), RED = rgb(PAL.danger), AMBER = rgb(PAL.sale);
export function syncScene(view, sim, alpha, dt) {
  const world = sim.world, p = sim.player;
  view.time += dt; view.frame++;
  view.counts.fill(0);
  view.shadowN = view.fixed;
  view.glowN = 0;
  const lure = sim.stats.taken === 0 && sim.t > 0;     // until the player's first item, the goods on the shelves nearby hop for attention
  for (const it of world.items) {
    if (it.taken) continue;
    const hop = lure && Math.abs(it.x - p.x) < 9 && Math.abs(it.z - p.z) < 22 ? Math.max(0, Math.sin(view.time * 9 + it.x * 1.3 + it.z * 1.7)) * 0.16 : 0;
    putGood(view, it.good, it.x, 0.5 + hop, it.z, Math.atan2(it.nx, it.nz), 1, 0, 0);
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
    } else it.mesh.visible = on || (it.p.type === 'podium' && !it.p.sale);
    if (it.mesh.visible && it.fly <= 0) putShadow(view, it.p.x, it.p.z, it.rad + 0.15, it.rad + 0.15, 0);   // a smashed piece takes its shadow with it
    if (it.beam) {
      const hot = on && it.p.good >= 0;
      it.beam.visible = it.star.visible = hot;
      if (hot) {
        const top = GOODS[it.p.good].dims[1];
        putGood(view, it.p.good, it.p.x, 0.36 + 0.06 * Math.sin(view.time * 3), it.p.z, view.time * 1.2, 1, 0, 0);
        putGlow(view, it.p.x, it.p.z, 1.5 + 0.1 * Math.sin(view.time * 4), PAL.hot);
        it.star.position.set(it.p.x, top + 1.5 + 0.18 * Math.sin(view.time * 3.3), it.p.z);
        it.star.rotation.y = view.time * 2.2;
      }
    }
  }
  for (const c of view.carts) syncCart(view, c, sim, alpha, dt);
  syncShoppers(view, sim, dt);
  // A banner between the camera and the player's cart would hide it: banners fade away as the cart comes near.
  for (const b of view.banners) { b.material.uniforms.uOpacity.value = b.material.opacity = clamp((Math.hypot(b.position.x - p.x, b.position.z - p.z) - 9) / 5, 0, 1); b.visible = b.material.opacity > 0.02; }
  // The cart train, and a long shadow running ahead of it across the floor (its warning).
  for (const t of view.trains) {
    const tr = t.tr, a = Math.atan2(tr.dx * tr.dir, tr.dz * tr.dir);
    t.cars.forEach((m, i) => {
      m.position.set(tr.x - tr.dx * tr.dir * i * 1.5, 0, tr.z - tr.dz * tr.dir * i * 1.5);
      m.rotation.y = a + Math.sin(view.time * 9 + i) * 0.04;
      putShadow(view, m.position.x, m.position.z, 0.75, 0.95, a);
    });
    if (tr.wait <= 0) putShadow(view, tr.x + tr.dx * tr.dir * 5, tr.z + tr.dz * tr.dir * 5, 0.7, 4.4, a);      // 0.8 s of warning at its 7 m/s
  }
  for (const [e, f] of view.flights) if (f.seen !== view.frame) view.flights.delete(e);   // spilled before it landed
  for (let i = 0; i < view.goods.length; i++) {
    const mesh = view.goods[i];
    mesh.count = view.counts[i];
    mesh.instanceMatrix.needsUpdate = true;
  }
  // Checkout lamps: green while open, blinking amber for two seconds before closing, then red with a barrier.
  if (view.lanes) {
    world.lanes.forEach((l, i) => {
      const blink = Math.floor(view.time * 8) % 2, b = l.bar, deep = b.hz >= b.hx;
      putBox(view.lanes, i * 3, l.x, 3.1, l.z, 0.9, 0.55, 0.9, l.open ? (l.warned ? (blink ? AMBER : RED) : GREEN) : RED, l.open ? 1.15 + 0.2 * Math.sin(view.time * 4 + i) : 1);
      for (const e of [-1, 1]) {
        putBox(view.lanes, i * 3 + (e < 0 ? 1 : 2), b.x + (deep ? 0 : e * b.hx), 0.9, b.z + (deep ? e * b.hz : 0),
          l.open ? 0 : deep ? b.hx * 2 : 0.24, l.open ? 0 : 0.24, l.open ? 0 : deep ? 0.24 : b.hz * 2, RED, 1);
      }
    });
    view.lanes.instanceMatrix.needsUpdate = true;
    view.lanes.instanceColor.needsUpdate = true;
  }
  view.shadows.count = view.shadowN;
  view.shadows.instanceMatrix.needsUpdate = true;
  view.glows.count = view.glowN;
  view.glows.instanceMatrix.needsUpdate = true;
  view.glows.instanceColor.needsUpdate = true;
  // The hero's ring follows the player; while drifting, an arc outside it fills toward the next tier.
  // In MADNESS mode the ring throbs.
  view.ring.position.set(lerp(p.px, p.x, alpha), 0.03, lerp(p.pz, p.z, alpha));
  view.ring.rotation.y = p.h;
  view.ring.scale.setScalar(2.2 * (p.madT > 0 ? 1 + 0.08 * Math.sin(view.time * 20) : 1));
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
  if (e.type === 'laneclose' || e.type === 'lanewarn') {   // the lane's floor flashes for its two seconds of warning, then turns into a red cross-hatch
    const d = view.map.image.data;
    for (const i of e.ref.tiles) d[i * 4 + 1] = (e.type === 'lanewarn' ? 14 : 7) * 16;
    view.map.needsUpdate = true;
    return;
  }
  for (const c of view.carts) {
    if (c.k !== e.cart && c.k !== e.ref) continue;
    if (e.type === 'crash') { c.squash = 1; c.swayXv += 3; c.swayZv -= 4; c.expr = EXPR.shocked; c.exprT = 0.8; }
    else if (e.type === 'ram' || e.type === 'bonk') { c.squash = 0.9; c.swayXv += (c.k === e.ref ? 4 : -2); c.expr = c.k === e.ref ? EXPR.angry : EXPR.happy; c.exprT = 1.2; }
    else if (e.type === 'hot' && c.k === e.cart) { c.expr = EXPR.happy; c.exprT = 1.4; }
    else if ((e.type === 'spill' || e.type === 'shed') && c.k === e.cart) { c.expr = EXPR.crying; c.exprT = 1.0; }
    else if (e.type === 'bump' || e.type === 'cartbump') { c.squash = 0.55; c.swayXv += (c.k.id % 2 ? 2 : -2); }
    else if (e.type === 'take' && c.k === e.cart) {
      // Goods leave the shelf one after another: each waits a little longer than the one before.
      view.flights.set(e.ref.entry, { x: e.ref.x, y: e.ref.y, z: e.ref.z, t: -Math.min(0.24, c.pending * 0.03), seen: view.frame });
      c.pending++;
    }
  }
}

// A small picture of one kind of goods for the interface (the list icons): the real model with its
// outline, drawn once into a canvas. Returns a data URL.
let iconMats = null;
export function goodIcon(kind, size = 96) {
  const T = THREE, ren = R.renderer, rt = new T.WebGLRenderTarget(size, size), scene = new T.Scene(), d = GOODS[kind].dims;
  const ink = iconMats || (iconMats = [celMaterial({ flat: false }), hullMaterial(2.6)]);
  const mesh = new T.Mesh(goodGeometry(kind), ink);
  mesh.rotation.y = 0.55;
  scene.add(mesh);
  const r = Math.max(d[0], d[1], d[2]) * 0.78, cam = new T.OrthographicCamera(-r, r, r, -r, 0.1, 30);
  cam.position.set(3, 3.4 + d[1] / 2, 5); cam.lookAt(0, d[1] / 2, 0);
  const res = R.u.uRes.value.clone(), line = ink[1].uniforms.uThick, thick = line.value, px = new Uint8Array(size * size * 4);
  R.u.uRes.value.set(size, size); line.value = 2.6;
  ren.setRenderTarget(rt); ren.setClearColor(0, 0); ren.clear(); ren.render(scene, cam);
  ren.readRenderTargetPixels(rt, 0, 0, size, size, px);
  ren.setRenderTarget(null); ren.setClearColor(PAL.night, 1);
  R.u.uRes.value.copy(res); line.value = thick;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i - 1] + img.data[i - 2] + img.data[i - 3] > 0 ? 255 : 0;   // (alpha in the scene is the glow mask)
  ctx.putImageData(img, 0, 0);
  rt.dispose(); mesh.geometry.dispose();
  return cv.toDataURL();
}

export function disposeScene(view) {
  R.scene.remove(view.root);
  disposeCrowd(view.crowd);
  view.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of view.own) m.dispose();
}
