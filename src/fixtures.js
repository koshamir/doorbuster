// DOORBUSTER — fixtures.js
// Purpose: builds a store from its kit (ART.md section 6): walls with colour bands, posters and garland
//          bulbs; shelf runs as gondolas (price strips, labelled stock on upper shelves, aisle signs),
//          produce crates or freezer cases; counters, displays and decor; floor decals (stickers, rings,
//          the store logo, wet-floor signs); and the meshes of the pieces that break, fly or open
//          (can pyramids, gift piles, standees, hot-item podiums, shop windows, light props).
// Exports: buildStore, pieceMesh, fixtureDemo, LOOSE
// Depends on: config.js, shapes.js, atlas.js, goods.js, render.js, kits.js, arena.js and the global THREE.

import { CFG, mix } from './config.js';
import { builder, at, bind, box, cyl, ellipsoid, lathe, tube, ring, quad, toGeometry } from './shapes.js';
import { KIT, kitAtlas, labelAtlas } from './atlas.js';
import { putProduct, lockGoods, STORE_STOCK, productSize, PRODUCTS } from './goods.js';
import { celMaterial, hullMaterial, blendMaterial, MRT_OUT } from './render.js';
import { screenMaterial } from './kits.js';
import { ARENA_PIECES, trampPiece, stallRun } from './arena.js';

const T2 = CFG.TILE, F_INK = 0x2A1A3A;
const K = (cell, g = 0, e = 0) => [3, cell, g, e], KW = (cell, g = 0, e = 0) => [4, cell, g, e], PL = (g = 0, e = 0) => [0, 0, g, e];
const fhash = (a, b) => (Math.abs(Math.floor(a * 12.9898 + b * 78.233) * 2654435761) >>> 0);

// A frame for a shelf run: local (u along, y, w across) -> world.
function runFrame(s) {
  return (u, y, w) => s.horiz ? [s.x + u, y, s.z + w] : [s.x + w, y, s.z - u];
}

// ---- the whole store --------------------------------------------------------------------------------------
// view: the scene view (root, gv goods view, own); kit: the store kit; shadow(x, z, rx, rz, ry) adds a contact shadow.
export function buildStore(view, sim, kit, shadow) {
  const world = sim.world, F = kit.fixture, atlas = kitAtlas(kit), cols = world.cols;
  const isFloor = (c, r) => c >= 0 && r >= 0 && c < cols && r < world.rows && world.floor[r * cols + c] === 1;
  const mat = celMaterial({ mapB: atlas, halftone: true, shadow: true, ink: 1 });
  view.own.push(mat);
  const B = builder(), W = builder(), D = builder(), S = builder();      // S: TV screens (they play their channels)
  // walls: blocks with a plinth, a band, a stripe and a dark cap; posters on some faces; bulbs along the top
  bind(W, 0, PL(0));
  for (const w of world.walls) { at(W, w.x, 0, w.z); box(W, w.hx * 2, CFG.WALL_H, w.hz * 2, kit.walls.face, { bevel: 0, top: 0xFFFFFF, lid: KW(Math.min(w.hx, w.hz) > 2.5 ? KIT.backroom : KIT.walltop), uvs: [w.hx * 2 / 4, w.hz * 2 / 4] }); }
  const bulbs = [];
  let face = 0;
  for (let r = 0; r < world.rows; r++) for (let c = 0; c < cols; c++) {
    if (!isFloor(c, r)) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isFloor(c + dc, r + dr)) continue;
      const x = (c + 0.5 + dc * 0.5) * T2, z = (r + 0.5 + dr * 0.5) * T2, ry = dc ? (dc > 0 ? -Math.PI / 2 : Math.PI / 2) : (dr > 0 ? Math.PI : 0);
      bind(W, 0, PL(0));
      at(W, x - dc * 0.02, 0, z - dr * 0.02, ry); box(W, T2, 0.28, 0.06, kit.walls.base, { bevel: 0, mid: false });
      if (kit.walls.neon) bind(W, 0, PL(0.3, 0.75));
      at(W, x - dc * 0.025, kit.walls.neon ? 1.35 : 1.15, z - dr * 0.025, ry); box(W, T2, kit.walls.neon ? 0.1 : 0.5, 0.06, kit.walls.band, { bevel: 0 });
      bind(W, 0, PL(0));
      at(W, x - dc * 0.025, 1.78, z - dr * 0.025, ry); box(W, T2, 0.1, 0.06, kit.walls.stripe, { bevel: 0 });
      if (kit.walls.booths && (c + r) % 2 === 0) { bind(W, 0, K(KIT.s0 + 1, 0.2)); at(W, x - dc * 0.06, 0.06, z - dr * 0.06, ry); box(W, T2 - 0.25, 2.3, 0.05, 0xFFFFFF, { bevel: 0, front: K(KIT.s0 + 1, 0.2) }); bind(W, 0, PL(0.9)); at(W, x - dc * 0.1, 2.4, z - dr * 0.1, ry); box(W, T2 - 0.1, 0.07, 0.07, 0xE9B949, { bevel: 0.3 }); bind(W, 0, PL(0)); }
      else if ((c * 7 + r * 3) % 9 === 0) { face++; const pc = (kit.posters || [KIT.sale, KIT.poster2, KIT.poster3])[face % 3]; bind(W, 0, K(pc, 0.1)); at(W, x - dc * 0.05, 0.55, z - dr * 0.05, ry); box(W, 1.1, 1.1, 0.03, 0xFFFFFF, { bevel: 0, front: K(pc, 0.1) }); }
      if ((c + r) % 2 === 0) bulbs.push([x - dc * 0.1, z - dr * 0.1]);
      overstock(W, x, z, dc, dr, ry, c * 31 + r * 17 + dc * 5 + dr * 3, kit);
    }
  }
  bind(W, 0, PL(0));
  const M = 18, ww = world.w, wh = world.h;
  for (const [x0, z0, x1, z1] of [[-M, -M, ww + M, 0], [-M, wh, ww + M, wh + M], [-M, 0, 0, wh], [ww, 0, ww + M, wh]]) {
    at(W, (x0 + x1) / 2, 0, (z0 + z1) / 2); box(W, x1 - x0, CFG.WALL_H, z1 - z0, kit.walls.face, { bevel: 0, top: 0xFFFFFF, lid: KW(KIT.backroom), uvs: [(x1 - x0) / 4, (z1 - z0) / 4] });
  }
  bind(W, 0, PL(0.5, 0.9));
  bulbs.forEach(([x, z], i) => { at(W, x, CFG.WALL_H + 0.06, z); ellipsoid(W, 0.09, 0.09, 0.09, kit.walls.bulbs ? kit.walls.bulbs[i % kit.walls.bulbs.length] : 0xFFF1C4, { seg: 6, rings: 4 }); });
  // shelf runs
  const stock = STORE_STOCK[kit.id] || STORE_STOCK.supermarket;
  world.shelves.forEach((s, i) => {
    const style = (kit.shelves || {})[s.kind] || 'gondola';
    if (style === 'produce') produceRun(B, s, F, view, stock); else if (style === 'freezer') freezerRun(B, s, F, view, stock); else if (style === 'rack') rackRun(B, s, F, view, stock);
    else if (style === 'stall') stallRun(B, s, F, putProduct, view, stock, KIT.sign0 + i % 8, K);
    else if (style === 'clothes') clothesRun(B, s, F, view, stock); else if (style === 'foldtable') foldTable(B, s, F, view, stock); else if (style === 'shoewall') shoeWall(B, s, F, view, stock);
    else if (style === 'tech') techRun(B, S, s, F, view, stock); else if (style === 'techtable') techTable(B, S, s, F, view, stock); else if (style === 'tvwall') tvWall(B, S, s, F, view, stock); else gondolaRun(B, s, F, view, stock, i, kit);
    shadow(s.x, s.z, s.hx + 0.25, s.hz + 0.25, 0);
  });
  // static single-tile pieces
  for (const p of world.pieces) {
    if (p.type === 'case') {              // the glass case's pedestal stays when the glass is smashed
      bind(B, 0, PL(0.5)); at(B, p.x, 0, p.z); box(B, 1.6, 0.5, 1.6, F.dark, { bevel: 0.1, top: 0xE8ECF6 });
      bind(B, 0, PL(0.7, 0.85)); at(B, p.x, 0.42, p.z); box(B, 1.64, 0.05, 1.64, F.accent, { bevel: 0 });
      shadow(p.x, p.z, 1.0, 1.0, 0);
    }
    if (LOOSE[p.type]) continue;
    const rad = p.solid.r || Math.max(p.solid.hx, p.solid.hz);
    staticPiece(B, p, F, view, stock, world);
    shadow(p.x, p.z, rad + 0.18, rad + 0.18, 0);
  }
  for (const rp of world.ramps) { rampPiece(B, rp, F); shadow(rp.x, rp.z, 1.1, 1.3, Math.atan2(rp.dx, rp.dz)); }
  // wet floor signs, one at the first corner of a patch
  for (let i = 0; i < world.wet.length; i++) if (world.wet[i] && !world.wet[i - 1] && !world.wet[i - cols]) wetSign(B, (i % cols) * T2 - 0.2, Math.floor(i / cols) * T2 - 0.2);
  // a pole and a lamp housing over every checkout lane (the lamp itself is lit by the scene)
  bind(B, 0, PL(0.6));
  // the pole stands at the lane's edge (never in the way of the close-up), an arm carries the lamp over the middle
  for (const l of world.lanes) {
    const deep = l.bar.hz >= l.bar.hx, ox = deep ? 0.92 : 0, oz = deep ? 0 : 0.92;
    l.pole = [l.x + ox, l.z + oz];
    at(B, l.x + ox, 0, l.z + oz); cyl(B, 0.05, 0.05, 3.0, 0xDDE3EA, { seg: 8 });
    at(B, l.x + ox / 2, 2.98, l.z + oz / 2); box(B, ox + 0.06, 0.06, oz + 0.06, 0xDDE3EA, { bevel: 0 });
    at(B, l.x, 3.04, l.z); cyl(B, 0.4, 0.34, 0.12, F.dark, { seg: 14 });
  }
  // the pits (clearance bins, the stockroom under the sliding panels): walls down, stock at the bottom, striped rims
  pits(B, world, kit);
  // floor decals on open floor: stickers, rings, the store logo by the doors
  floorDecals(D, world, kit);
  lockGoods(view.gv);
  const mesh = (b, m) => { const g = toGeometry(b, { groups: false, hull: false }); const ms = new THREE.Mesh(g, m); view.root.add(ms); return ms; };
  mesh(W, mat); mesh(B, mat);
  const dmesh = mesh(D, decalMat(atlas));
  dmesh.renderOrder = 1;
  if (S.used) { const sm = screenMaterial(atlas); view.own.push(sm); mesh(S, sm); }
  return { mat };
}
export const LOOSE = { pyramid: 1, mega: 1, gifts: 1, stand: 1, podium: 1, glass: 1, table: 1, boxes: 1, mannequin: 1, case: 1, listrack: 1, crates: 1, caketower: 1, hurdle: 1, cone: 1 };

// Floor decals blend over the floor (alpha from the atlas) and never write the glow mask.
const DECAL_VS = 'attribute vec4 tex; varying vec2 vUv; varying vec4 vTex; varying vec3 vColor; void main() { vUv = uv; vTex = tex; vColor = color; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const DECAL_FS = `uniform sampler2D uMap; uniform vec3 uTint; uniform float uTintAmt; varying vec2 vUv; varying vec4 vTex; varying vec3 vColor; ${MRT_OUT}
void main() { float cell = floor(vTex.y + 0.5); vec2 o = vec2(mod(cell, 8.0), floor(cell / 8.0)) / 8.0;
  vec2 gx = dFdx(vUv) / 8.0, gy = dFdy(vUv) / 8.0; float m = max(length(gx), length(gy)); if (m > 0.004) { gx *= 0.004 / m; gy *= 0.004 / m; }
  vec4 t = textureGrad(uMap, o + clamp(vUv, 0.03, 0.97) / 8.0, gx, gy);
  vec3 c = t.rgb * vColor; c = mix(c, c * uTint, uTintAmt); gl_FragColor = vec4(c, t.a * vTex.z); oAux = vec4(0.0); }`;
function decalMat(atlas) {
  const m = new THREE.ShaderMaterial({ vertexShader: DECAL_VS, fragmentShader: DECAL_FS, vertexColors: true, uniforms: { uMap: { value: atlas }, uTint: { value: new THREE.Vector3(1, 0.55, 0.6) }, uTintAmt: { value: 0 } } });
  blendMaterial(m); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4;
  return m;
}
function flatDecal(D, x, z, size, rot, cell, color, alpha) {
  const c = Math.cos(rot), s = Math.sin(rot), h = size / 2;
  const P = (u, v) => [x + (u * c - v * s) * h, 0.012, z + (u * s + v * c) * h];
  bind(D, 0, [3, cell, alpha || 1, 0]);
  quad(D, P(-1, 1), P(1, 1), P(1, -1), P(-1, -1), color || 0xFFFFFF, [3, cell, alpha || 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]]);
}
function floorDecals(D, world, kit) {
  const { cols, rows } = world, busy = new Uint8Array(cols * rows);
  const mark = (x, z, r) => { for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) { const c = Math.floor(x / T2) + dc, rr = Math.floor(z / T2) + dr; if (c >= 0 && rr >= 0 && c < cols && rr < rows) busy[rr * cols + c] = 1; } };
  for (const p of world.pieces) mark(p.x, p.z, 1);
  for (const s of world.shelves) mark(s.x, s.z, 1);
  for (const l of world.lanes) mark(l.x, l.z, 2);
  for (const p of world.pieces) if (p.type === 'podium' && !p.sale) flatDecal(D, p.x, p.z, 3.4, 0, KIT.ring, 0xFFD23F, 0.95);
  flatDecal(D, world.start.x + Math.sin(world.start.h) * 5, world.start.z + Math.cos(world.start.h) * 5, 5, -world.start.h + Math.PI, KIT.logo, 0xFFFFFF, 0.95);
  mark(world.start.x, world.start.z, 2);
  let n = 0;
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    const i = r * cols + c;
    if (!world.floor[i] || busy[i] || world.wet[i] || world.belt[i] || world.laneOf[i] >= 0 || world.plan[r][c] !== '.') continue;
    if (fhash(c, r) % 7 !== 0) continue;
    const kind = fhash(r, c) % 3, x = (c + 0.5) * T2, z = (r + 0.5) * T2;
    flatDecal(D, x, z, kind === 2 ? 1.5 : 1.3, (fhash(c + 3, r) % 628) / 100, [KIT.pct, KIT.star, KIT.dash][kind], 0xFFFFFF, kind === 2 ? 0.55 : 0.9);
    mark(x, z, 1); n++;
  }
  for (let i = 0; i < world.wet.length; i++) if (world.wet[i] && fhash(i, 3) % 3 === 0) flatDecal(D, (i % cols + 0.5) * T2, (Math.floor(i / cols) + 0.5) * T2, 1.3, 0, KIT.wet, 0xFFFFFF, 0.85);
  return n;
}

// ---- shelf runs ---------------------------------------------------------------------------------------------
// A white gondola: plinth with a red price strip (the sweepable goods stand on it), a pegboard back, two upper
// shelves of labelled stock, end caps and an aisle sign on top.
function gondolaRun(B, s, F, view, stock, idx, kit) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2, both = s.sides[0] && s.sides[1];
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2;
  const backW = both ? 0 : (s.sides[0] ? 1 : -1) * (depth / 2 - 0.08);
  const put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.1), (x, y) => 1 - 0.18 * Math.max(0, Math.min(1, (0.25 - y) / 0.25)));
  put(0, 0, 0); box(B, along, 0.5, depth, F.body, { bevel: 0.06, top: mix(F.body, 0xFFFFFF, 0.5) });
  bind(B, 0, PL(0), null);
  for (const side of [-1, 1]) {
    if (!s.sides[side < 0 ? 0 : 1]) continue;
    put(0, 0.32, side * (depth / 2 + 0.012)); box(B, along - 0.04, 0.14, 0.03, F.trim, { bevel: 0, front: KW(KIT.price), sides: KW(KIT.price), uvs: [along / 0.6, 1] });
  }
  // the back panel and the upper shelves (stock on them)
  const tall = 1.72;
  bind(B, 0, KW(KIT.pegboard, 0.1));
  put(0, 0.5, backW); box(B, along - 0.06, tall - 0.5, 0.12, F.accent, { bevel: 0.1, sides: KW(KIT.pegboard, 0.1), front: KW(KIT.pegboard, 0.1), uvs: [along / 1.2, 2] });
  bind(B, 0, PL(0.15));
  for (const side of [-1, 1]) {
    if (!s.sides[side < 0 ? 0 : 1]) continue;
    for (const [k, y] of [[0, 1.0], [1, 1.38]]) {
      const w = backW + side * 0.22;
      put(0, y, w); box(B, along - 0.12, 0.05, 0.36, 0xFFFFFF, { bevel: 0.2 });
      put(0, y - 0.02, backW + side * 0.4); box(B, along - 0.12, 0.08, 0.02, F.trim, { bevel: 0, front: KW(KIT.price), sides: KW(KIT.price), uvs: [along / 0.6, 1] });
      const n = Math.max(1, Math.floor((along - 0.3) / 0.46));
      for (let j = 0; j < n; j++) {
        const u = -along / 2 + 0.3 + (j + 0.5) * (along - 0.6) / n, p = stock[fhash(s.x * 3 + u + k, s.z + side * 7) % stock.length];
        const sz = productSize(p), sc = Math.min(0.85, 0.34 / sz[1], 0.44 / sz[0]);
        const [x, , z] = P(u, 0, w);
        putProduct(view.gv, p, x, y + 0.025, z, ry + (side > 0 ? 0 : Math.PI) + (s.horiz ? 0 : Math.PI), sc);
      }
    }
  }
  // end caps
  for (const e of [-1, 1]) { bind(B, 0, PL(0.2)); put(e * (along / 2 - 0.05), 0, 0); box(B, 0.1, tall + 0.04, depth + 0.04, F.accent, { bevel: 0.15, top: F.dark }); }
  // an aisle sign over long runs: two faces back to back
  if (s.len >= 3) {
    const cell = KIT.sign0 + idx % Math.max(1, Math.min(8, (kit.signs || []).length));
    const w2 = Math.min(along - 0.4, 2.6), h2 = 0.62, y0 = tall + 0.25;
    for (const side of [-1, 1]) {
      const a = P(-w2 / 2 * side, y0 + h2, side * 0.035), b = P(w2 / 2 * side, y0 + h2, side * 0.035), c = P(w2 / 2 * side, y0, side * 0.035), d = P(-w2 / 2 * side, y0, side * 0.035);
      bind(B, 0, K(cell)); quad(B, a, d, c, b, 0xFFFFFF, K(cell), [[0, 0], [0, 0.5], [1, 0.5], [1, 0]]);
    }
    bind(B, 0, PL(0.5)); for (const e of [-1, 1]) { put(e * (w2 / 2 - 0.1), tall, 0); cyl(B, 0.02, 0.02, 0.28, 0xDDE3EA, { seg: 6 }); }
  }
}

// ---- the electronics store (GADGET GOBLIN) ----------------------------------------------------------------------
// A screen quad at (x, y, z) facing ry, w x h, with its own channel clock (seed 0..1).
export function screen(S, x, y, z, ry, w, h, seed) {
  S.used = true;
  at(S, x, y, z, ry); bind(S, 0, [0, 0, seed, 0]);
  quad(S, [-w / 2, h / 2, 0], [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], 0xFFFFFF, [0, 0, seed, 0], [[0, 0], [0, 1], [1, 1], [1, 0]]);
}
const frac = (v) => v - Math.floor(v);
// A tech gondola: a navy plinth lit by a cyan strip (the sweepable goods stand on it), a back panel of tablets
// playing their channels, boxed gadgets on a glass shelf above, end caps edged in magenta neon.
function techRun(B, S, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2, both = s.sides[0] && s.sides[1];
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  const backW = both ? 0 : (s.sides[0] ? 1 : -1) * (depth / 2 - 0.08);
  bind(B, 0, PL(0.35)); put(0, 0, 0); box(B, along, 0.5, depth, F.body, { bevel: 0.08, top: 0xE8ECF6 });
  bind(B, 0, PL(0.2)); put(0, 0.5, backW); box(B, along - 0.06, 1.3, 0.14, 0x20254A, { bevel: 0.1, top: F.dark });
  for (const side of [-1, 1]) {
    if (!s.sides[side < 0 ? 0 : 1]) continue;
    bind(B, 0, PL(0.6, 0.85)); put(0, 0.36, side * (depth / 2 + 0.012)); box(B, along - 0.08, 0.06, 0.03, F.accent, { bevel: 0 });
    const n = Math.max(1, Math.floor(along / 0.9)), face = (s.horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2));
    for (let j = 0; j < n; j++) {
      const u = -along / 2 + (j + 0.5) * along / n, [x, , z] = P(u, 0, backW + side * 0.075);
      bind(B, 0, PL(0.3)); at(B, x, 0.86, z, face); box(B, 0.7, 0.46, 0.02, 0x0D0F22, { bevel: 0.15, mid: true });
      screen(S, x + Math.sin(face) * 0.012, 0.86, z + Math.cos(face) * 0.012, face, 0.62, 0.38, frac(s.x * 0.37 + s.z * 0.71 + j * 0.29 + side * 0.5));
    }
    bind(B, 0, PL(0.9, 0.05)); put(0, 1.48, backW + side * 0.22); box(B, along - 0.12, 0.03, 0.36, 0xBFE9FF, { bevel: 0 });
    const m = Math.max(1, Math.floor((along - 0.3) / 0.46));
    for (let j = 0; j < m; j++) {
      const u = -along / 2 + 0.3 + (j + 0.5) * (along - 0.6) / m, p = stock[fhash(s.x * 3 + u, s.z + side * 7) % stock.length], sz = productSize(p), sc = Math.min(0.85, 0.36 / sz[1], 0.44 / sz[0]);
      const [x, , z] = P(u, 0, backW + side * 0.22);
      putProduct(view.gv, p, x, 1.51, z, face, sc);
    }
  }
  bind(B, 0, PL(0.5, 0.9)); for (const e of [-1, 1]) { put(e * (along / 2 - 0.04), 0, 0); box(B, 0.06, 1.84, depth + 0.02, F.trim, { bevel: 0 }); }
}
// A display table: a low navy plinth under a white top (the goods along its edges), open laptops in the middle
// with their screens on, headphones on little stands.
function techTable(B, S, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.3)); put(0, 0, 0); box(B, along - 0.1, 0.42, depth - 0.3, F.dark, { bevel: 0.1 });
  bind(B, 0, PL(0.7, 0.85)); put(0, 0.05, 0); box(B, along - 0.06, 0.04, depth - 0.26, F.accent, { bevel: 0 });
  bind(B, 0, PL(0.7, 0.8)); put(0, 0.4, 0); box(B, along + 0.04, 0.03, depth + 0.04, F.accent, { bevel: 0 });
  bind(B, 0, PL(0.8)); put(0, 0.42, 0); box(B, along, 0.08, depth, 0x343A68, { bevel: 0.2, top: 0x3D4472 });
  const n = Math.max(1, Math.round(along / 1.6));
  for (let j = 0; j < n; j++) {
    const u = -along / 2 + (j + 0.5) * along / n, [x, , z] = P(u, 0, 0), k = fhash(s.x + j, s.z) % 3;
    if (k < 2) {        // an open laptop facing one side or the other
      const face = (s.horiz ? 0 : Math.PI / 2) + (j % 2 ? Math.PI : 0), fx = Math.sin(face), fz = Math.cos(face);
      bind(B, 0, PL(0.7)); at(B, x, 0.5, z, face); box(B, 0.66, 0.04, 0.46, 0xDDE3EA, { bevel: 0.2 });
      at(B, x - fx * 0.23, 0.52, z - fz * 0.23, face); box(B, 0.66, 0.44, 0.03, 0xDDE3EA, { bevel: 0.2 });
      bind(B, 0, PL(0.4)); at(B, x + fx * 0.05, 0.54, z + fz * 0.05, face); box(B, 0.5, 0.01, 0.2, 0x2B2F3A, { bevel: 0 });
      screen(S, x - fx * 0.21, 0.745, z - fz * 0.21, face, 0.58, 0.36, frac(x * 0.13 + z * 0.29));
    } else {            // headphones on a stand
      bind(B, 0, PL(0.5)); at(B, x, 0.5, z); cyl(B, 0.12, 0.14, 0.04, F.dark, { seg: 10 }); at(B, x, 0.54, z); cyl(B, 0.025, 0.025, 0.3, 0xDDE3EA, { seg: 6 });
      at(B, x, 0.84, z, ry, 0, Math.PI / 2); ring(B, 0.2, 0.2, 0.05, 0.08, [0xFF4FD8, 0x00E5FF, 0xFFD23F][j % 3], { seg: 14 });
      for (const e of [-1, 1]) { at(B, x + (s.horiz ? e * 0.2 : 0), 0.66, z + (s.horiz ? 0 : e * 0.2)); ellipsoid(B, 0.08, 0.11, 0.08, 0x2A2F5A, { seg: 8, rings: 6 }); }
    }
  }
  void stock; void view;
}
// A TV wall: two rows of big screens in black bezels on a navy frame (both faces when it stands free), a lit
// plinth with the goods, the GIGAVISION sign on top.
function tvWall(B, S, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.35)); put(0, 0, 0); box(B, along, 0.5, depth, F.body, { bevel: 0.08, top: 0xE8ECF6 });
  bind(B, 0, PL(0.2)); put(0, 0.5, 0); box(B, along - 0.06, 2.2, 0.3, 0x1A1E3D, { bevel: 0.06, top: F.dark });
  const bays = Math.max(1, Math.round(along / 1.9));
  for (const side of [-1, 1]) {
    if (!s.sides[side < 0 ? 0 : 1]) continue;
    bind(B, 0, PL(0.6, 0.85)); put(0, 0.36, side * (depth / 2 + 0.012)); box(B, along - 0.08, 0.06, 0.03, F.accent, { bevel: 0 });
    const face = (s.horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2));
    for (let b = 0; b < bays; b++) for (const [y, hh] of [[1.05, 0.8], [1.98, 0.8]]) {
      const u = -along / 2 + (b + 0.5) * along / bays, w = along / bays - 0.22, [x, , z] = P(u, 0, side * 0.16);
      bind(B, 0, PL(0.4)); at(B, x, y, z, face); box(B, w, hh, 0.05, 0x0D0F22, { bevel: 0.1, mid: true });
      screen(S, x + Math.sin(face) * 0.03, y, z + Math.cos(face) * 0.03, face, w - 0.1, hh - 0.1, frac(s.x * 0.53 + s.z * 0.31 + b * 0.37 + y + side * 0.5));
    }
    if (along >= 3.5) { const [x, , z] = P(0, 0, side * 0.17); bind(B, 0, K(KIT.s0, 0.2, 0.25)); at(B, x, 2.75, z, face); box(B, Math.min(3.2, along - 0.4), 0.62, 0.04, 0xFFFFFF, { bevel: 0, mid: true, front: K(KIT.s0, 0.2, 0.25) }); }
  }
  void stock; void view;
}

// ---- the boutique (DRESS TO DISTRESS) ---------------------------------------------------------------------------
const FABRIC = [0, 1, 2, 3].map((k) => KIT.s0 + 4 + k), CLOTH = [0xFFFFFF, 0xFF8FC7, 0x7CC6FE, 0xE9B949, 0xC9A0DC, 0xE63946, 0x2A2440, 0xFFF3E8];
// A clothes rack: a blush plinth (the goods along its sides), two gold uprights and a rail, a row of garments in
// patterned fabrics on hangers, a little gold sign at the end.
function clothesRun(B, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.3)); put(0, 0, 0); box(B, along, 0.46, depth - 0.2, 0xFFD6E0, { bevel: 0.12, top: 0xFFF3E8 });
  bind(B, 0, PL(0.9)); put(0, 0.46, 0); box(B, along + 0.02, 0.04, depth - 0.16, F.accent, { bevel: 0 });
  for (const e of [-1, 1]) { put(e * (along / 2 - 0.12), 0.46, 0); cyl(B, 0.04, 0.04, 1.4, F.accent, { seg: 8 }); }
  put(0, 1.84, 0); box(B, along - 0.2, 0.06, 0.06, F.accent, { bevel: 0.3, mid: true });
  const n = Math.max(2, Math.round((along - 0.4) / 0.34));
  for (let j = 0; j < n; j++) {
    const u = -along / 2 + 0.3 + (j + 0.5) * (along - 0.6) / n, k = fhash(s.x * 5 + j, s.z * 3) % 8, f = FABRIC[(j + Math.floor(s.x)) % 4], [x, , z] = P(u, 0, 0);
    bind(B, 0, PL(0.6)); at(B, x, 1.72, z, ry); box(B, 0.04, 0.1, 0.4, 0xDDE3EA, { bevel: 0 });
    bind(B, 0, KW(f, 0.15)); at(B, x, 0.86, z, ry + (k % 2 ? 0.12 : -0.08)); box(B, 0.12, 0.86, 0.52, CLOTH[k], { bevel: 0.35, sides: KW(f, 0.15), front: KW(f, 0.15), back: KW(f, 0.15), uvs: [0.6, 1] });
  }
  void view; void stock;
}
// A table of folded sweaters: a cream top on gold legs, stacks of soft folded knits in colours, a price card.
function foldTable(B, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.8)); for (const e of [-1, 1]) for (const w of [-1, 1]) { put(e * (along / 2 - 0.15), 0, w * (depth / 2 - 0.25)); cyl(B, 0.04, 0.03, 0.42, F.accent, { seg: 6 }); }
  bind(B, 0, PL(0.5)); put(0, 0.42, 0); box(B, along, 0.08, depth - 0.2, 0xFFF3E8, { bevel: 0.25, top: 0xFFFAF4 });
  const n = Math.max(1, Math.round(along / 0.7));
  for (let j = 0; j < n; j++) {
    const u = -along / 2 + (j + 0.5) * along / n, [x, , z] = P(u, 0, 0), h = 2 + fhash(s.x + j, s.z) % 3;
    for (let q = 0; q < h; q++) { bind(B, 0, PL(0.1)); at(B, x, 0.5 + q * 0.13, z, ry + (q % 2) * 0.06); box(B, 0.46, 0.12, 0.4, CLOTH[(j * 3 + q + Math.floor(s.z)) % 8], { bevel: 0.4 }); }
  }
  void view; void stock;
}
// A wall of shoe boxes: stacks of coloured box ends in a gold frame (both faces when it stands free), a plinth with
// the goods, the store's sign on top.
function shoeWall(B, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.3)); put(0, 0, 0); box(B, along, 0.46, depth, 0xFFD6E0, { bevel: 0.08, top: 0xFFF3E8 });
  bind(B, 0, KW(KIT.s0 + 3, 0.1)); put(0, 0.46, 0); box(B, along - 0.1, 2.0, 0.9, 0xFFFFFF, { bevel: 0.03, front: KW(KIT.s0 + 3, 0.1), back: KW(KIT.s0 + 3, 0.1), uvs: [along / 2, 2], top: 0xD9B98A });
  bind(B, 0, PL(0.9)); put(0, 2.46, 0); box(B, along + 0.04, 0.08, 0.96, F.accent, { bevel: 0.2 }); for (const e of [-1, 1]) { put(e * (along / 2 - 0.02), 0.46, 0); box(B, 0.08, 2.04, 0.96, F.accent, { bevel: 0.2 }); }
  if (along >= 5) { bind(B, 0, K(KIT.s0, 0.2)); for (const side of [-1, 1]) { const [x, , z] = P(0, 0, side * 0.5); at(B, x, 2.95, z, s.horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2)); box(B, 2.4, 0.62, 0.04, 0xFFFFFF, { bevel: 0, mid: true, front: K(KIT.s0, 0.2) }); } }
  void view; void stock;
}

// The pits: for each pit tile (a '_' in the plan, or a tile under sliding panels) walls go down 2.2 m on the sides
// that border floor, a dark bottom with the store's spill-over on it (cartons; clothes in the boutique), and a
// hazard-striped rim on the floor round the edge.
function pits(B, world, kit) {
  const { cols, rows } = world, pitAt = new Uint8Array(cols * rows);
  for (let i = 0; i < pitAt.length; i++) pitAt[i] = world.pit[i];
  for (const ob of world.objs || []) if (ob.kind === 'panels') for (let j = 0; j < ob.nr; j++) for (let i = 0; i < ob.nc; i++) pitAt[(ob.r0 + j) * cols + ob.c0 + i] = 2;
  const water = kit.id === 'sports', isPit = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && pitAt[r * cols + c] > 0, D = water ? 0.6 : 2.2, cloth = kit.id === 'boutique';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!isPit(c, r)) continue;
    const x0 = c * T2, z0 = r * T2;
    bind(B, 0, water ? PL(0.9, 0.12) : PL(0)); at(B, x0 + 1, -D - 0.05, z0 + 1); box(B, T2, 0.05, T2, water ? 0x48CAE4 : cloth ? 0x5A2E4A : 0x1C1A2E, { bevel: 0 });
    if (water) { const k = (c * 7 + r * 13) % 9; if (k === 0) { bind(B, 0, PL(0.6)); at(B, x0 + 1, -D + 0.02, z0 + 1, 0, Math.PI / 2); ring(B, 0.45, 0.45, 0.14, 0.14, [0xFF5A4E, 0xFFD23F, 0x3BB273][(c + r) % 3], { seg: 14 }); } if (k === 4) { bind(B, 0, PL(0.9, 0.3)); at(B, x0 + 0.6, -D, z0 + 1.2, 0.5); box(B, 0.9, 0.01, 0.08, 0xFFFFFF, { bevel: 0 }); } continue; }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isPit(c + dc, r + dr)) continue;
      const ry = dc ? Math.PI / 2 : 0;
      bind(B, 0, PL(0)); at(B, x0 + 1 + dc * 0.98, -D, z0 + 1 + dr * 0.98, ry); box(B, T2, D, 0.04, cloth ? 0x8A4A6E : 0x2E3150, { bevel: 0, top: 0x8E96A8 });
      if (cloth) {
        bind(B, 0, PL(0.9)); at(B, x0 + 1 + dc * 1.1, 0, z0 + 1 + dr * 1.1, ry); box(B, T2 + 0.2, 0.1, 0.2, 0xE9B949, { bevel: 0.2 });
        bind(B, 0, PL(0.4, 0.95)); for (let k = 0; k < 4; k++) { const o = -0.75 + k * 0.5, bx = x0 + 1 + dc * 1.1 + (dc ? 0 : o), bz = z0 + 1 + dr * 1.1 + (dc ? o : 0); at(B, bx, 0.1, bz); ellipsoid(B, 0.07, 0.07, 0.07, 0xFFF1C4, { seg: 6, rings: 4 }); }
      } else { bind(B, 0, KW(KIT.stripe, 0.1)); at(B, x0 + 1 + dc * 1.12, -0.035, z0 + 1 + dr * 1.12, ry); box(B, T2 + 0.24, 0.05, 0.24, 0xFFFFFF, { bevel: 0, lid: KW(KIT.stripe, 0.1), uvs: [T2 / 0.6, 0.4] }); }
    }
    // what lies at the bottom
    const h = (k) => frac(Math.sin((c * 31 + r * 17 + k) * 12.9898) * 43758.5453);
    if (cloth && (c * 3 + r * 7) % 11 === 0) { bind(B, 0, PL(0.6)); at(B, x0 + 1, -D, z0 + 1); cyl(B, 0.05, 0.05, D + 1.3, 0xE9B949, { seg: 6 }); bind(B, 0, K(KIT.bin, 0.2)); at(B, x0 + 1, 1.3, z0 + 1, 0.4); box(B, 1.6, 0.8, 0.05, 0xFFFFFF, { bevel: 0, mid: true, front: K(KIT.bin, 0.2), back: K(KIT.bin, 0.2) }); }
    if (cloth) { for (let k = 0; k < 6; k++) { bind(B, 0, PL(0.1)); at(B, x0 + 0.3 + h(k) * 1.4, -D, z0 + 0.3 + h(k + 9) * 1.4, h(k + 3) * 6); ellipsoid(B, 0.45 + h(k + 5) * 0.3, 0.22 + h(k + 7) * 0.2, 0.35, [0xFF8FC7, 0xE9B949, 0x7CC6FE, 0xFFFFFF, 0x9B5DE5, 0xE63946][k], { seg: 8, rings: 5 }); } }
    else for (let k = 0; k < 3; k++) { bind(B, 0, PL(0.1)); const sz = 0.5 + h(k) * 0.4; at(B, x0 + 0.4 + h(k + 2) * 1.2, -D, z0 + 0.4 + h(k + 4) * 1.2, h(k + 6) * 3); box(B, sz, sz * 0.8, sz, [0xB89A6E, 0xA88A60, 0xC4A574][k], { bevel: 0.04, top: 0x9C8158 }); }
  }
}

// Produce: a low wooden stand with crates tilted toward the aisles, heaped with fruit; chalkboards on sticks.
function produceRun(B, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, KW(KIT.wood, 0.1), (x, y) => 1 - 0.2 * Math.max(0, Math.min(1, (0.2 - y) / 0.2)));
  put(0, 0, 0); box(B, along, 0.46, depth, 0xC98A5B, { bevel: 0.06, sides: KW(KIT.wood, 0.1), front: KW(KIT.wood, 0.1), uvs: [along / 1.4, 1] });
  const fruit = [27, 28, 29, 30];
  for (const side of [-1, 1]) {
    if (!s.sides[side < 0 ? 0 : 1]) continue;
    const n = Math.max(1, Math.round(along / 1.0));
    for (let j = 0; j < n; j++) {
      const u = -along / 2 + (j + 0.5) * along / n, w = side * (depth / 2 - 0.42);
      bind(B, 0, KW(KIT.wood, 0.05));
      at(B, ...P(u, 0.5, w), ry, side * 0.28); box(B, along / n - 0.08, 0.24, 0.62, 0xD9A36E, { bevel: 0.1, sides: KW(KIT.wood, 0.05) });
      const f = fruit[(j + (side > 0 ? 1 : 0)) % fruit.length];
      for (let q = 0; q < 4; q++) { const [x, , z] = P(u + ((q % 2) - 0.5) * (along / n - 0.25) / 2, 0, w + (q < 2 ? -0.12 : 0.12) * side); putProduct(view.gv, f, x, 0.66 + (q < 2 ? 0.05 : -0.04), z, q, 0.6); }
    }
  }
  for (const e of [-1, 1]) {
    bind(B, 0, PL(0)); put(e * (along / 2 - 0.15), 0.4, 0); cyl(B, 0.025, 0.025, 0.6, 0x7A4E34, { seg: 6 });
    bind(B, 0, K(KIT.chalk)); at(B, ...P(e * (along / 2 - 0.15), 1.0, 0), ry + Math.PI / 2); box(B, 0.5, 0.42, 0.04, 0x2F3B36, { bevel: 0.1, front: K(KIT.chalk), mid: true });
  }
  void stock;
}

// Freezers: a white chest with a frosted lid (the goods stand on it) and, along a closed side, tall glass doors lit from inside.
// A pallet rack: blue uprights, orange beams at three levels, the goods on the bottom level, pallets of cartons
// and shrink-wrapped stacks above.
function rackRun(B, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2;
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  const bays = Math.max(1, Math.round(along / 2));
  bind(B, 0, PL(0.3));
  for (let b = 0; b <= bays; b++) for (const w of [-1, 1]) { put(-along / 2 + b * along / bays, 0, w * (depth / 2 - 0.08)); box(B, 0.1, 3.2, 0.1, F.body, { bevel: 0.1 }); }
  for (const y of [0.32, 1.5, 2.6]) for (const w of [-1, 1]) { put(0, y, w * (depth / 2 - 0.08)); box(B, along, 0.12, 0.08, F.accent, { bevel: 0.1 }); }
  bind(B, 0, PL(0.1));
  for (const y of [0.32, 1.5, 2.6]) { put(0, y + 0.06, 0); box(B, along - 0.1, 0.04, depth - 0.2, 0xA9B0BE, { bevel: 0 }); }
  // the upper levels: pallets of cartons or shrink-wrapped stacks
  for (let b = 0; b < bays; b++) for (const [k, y] of [[0, 1.56], [1, 2.66]]) {
    const u = -along / 2 + (b + 0.5) * along / bays, h = fhash(s.x + b * 3 + k, s.z + k * 5) % 3;
    put(u, y, 0); box(B, along / bays - 0.3, 0.1, depth - 0.35, 0xC98A5B, { bevel: 0.05 });
    if (h === 0) { put(u, y + 0.1, 0); box(B, along / bays - 0.4, 0.75, depth - 0.45, 0xE8EEF6, { bevel: 0.12, top: 0xF6FAFF }); }   // shrink-wrap
    else for (let j = 0; j < 3; j++) { put(u - 0.45 + j * 0.45, y + 0.1, 0); box(B, 0.4, 0.35 + ((b + j + k) % 2) * 0.25, depth - 0.5, [0xD9B98A, 0xC9A574, 0xE4C99B][j], { bevel: 0.04 }); }
  }
  void view; void stock;
}
function freezerRun(B, s, F, view, stock) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2, both = s.sides[0] && s.sides[1];
  const P = runFrame(s), ry = s.horiz ? 0 : Math.PI / 2, put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, PL(0.3), (x, y) => 1 - 0.15 * Math.max(0, Math.min(1, (0.2 - y) / 0.2)));
  put(0, 0, 0); box(B, along, 0.49, depth, 0xF4F7FB, { bevel: 0.06, top: 0xBFE9FF, lid: KW(KIT.frost, 0.9, 0.08), uvs: [along / 1.5, depth / 1.5] });
  if (!both) {
    const w = (s.sides[0] ? 1 : -1) * (depth / 2 - 0.12);
    bind(B, 0, PL(0.2)); put(0, 0.44, w); box(B, along, 1.6, 0.2, 0xF4F7FB, { bevel: 0.08, top: F.dark });
    const n = Math.max(1, Math.round(along / 1.1));
    for (let j = 0; j < n; j++) { bind(B, 0, K(KIT.door, 0.9, 0.35)); at(B, ...P(-along / 2 + (j + 0.5) * along / n, 0.55, w - (s.sides[0] ? 1 : -1) * 0.105), ry + (s.sides[0] ? Math.PI : 0)); box(B, along / n - 0.1, 1.3, 0.02, 0x7CD5FF, { bevel: 0, front: K(KIT.door, 0.9, 0.35) }); }
  }
  void view; void stock;
}

// A row of cartons on top of a wall, along the edge (x, z) that faces the floor in direction (-dc, -dr):
// one or two per tile of edge, set back from the edge, of mixed sizes; mostly cardboard, now and then a
// product box in a store colour.
const CARD = [0xD9B98A, 0xC9A574, 0xE4C99B, 0xCDAE7E];
function overstock(W, x, z, dc, dr, ry, seed, kit) {
  const h = (k) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  const n = 1 + (h(1) < 0.6 ? 1 : 0), pal = kit.palette;
  for (let i = 0; i < n; i++) {
    const along = (n === 1 ? 0 : (i - 0.5) * 1.0) + (h(2 + i) - 0.5) * 0.3, back = 0.45 + h(4 + i) * 0.35;
    const w = 0.7 + h(6 + i) * 0.35, ht = 0.35 + h(8 + i) * 0.45, d = 0.6 + h(10 + i) * 0.3;
    const tx = -dr, tz = dc;     // along the edge
    const coloured = h(12 + i) < 0.18, col = coloured ? [pal.a, pal.b, pal.c, pal.d][Math.floor(h(14 + i) * 4)] : CARD[Math.floor(h(16 + i) * 4)];
    at(W, x + dc * back + tx * along, CFG.WALL_H, z + dr * back + tz * along, ry + (h(18 + i) - 0.5) * 0.25);
    box(W, w, ht, d, typeof col === 'string' ? parseInt(col.slice(1), 16) : col, { bevel: 0, top: coloured ? 0xFFFFFF : 0xE8D2A6 });
    if (!coloured) { at(W, x + dc * back + tx * along, CFG.WALL_H + ht, z + dr * back + tz * along, ry + (h(18 + i) - 0.5) * 0.25); box(W, 0.16, 0.01, d + 0.02, 0xF3E3BE, { bevel: 0 }); }
  }
}

// ---- static single pieces -------------------------------------------------------------------------------------
function staticPiece(B, p, F, view, stock, world) {
  const x = p.x, z = p.z;
  if (p.type === 'lowwall') {             // a waist-high wall of crates with a hazard-striped rail
    bind(B, 0, PL(0.1));
    for (let i = 0; i < 4; i++) { at(B, x - 0.75 + (i % 2) * 1.5 - 0.0, 0, z - 0.5 + Math.floor(i / 2) * 1.0); box(B, 0.95, 0.85 + (i % 3) * 0.08, 0.9, [0xD9B98A, 0xC9A574, 0xE4C99B][i % 3], { bevel: 0.04 }); }
    bind(B, 0, PL(0.4)); at(B, x, 1.0, z); box(B, 2.0, 0.1, 0.12, 0xFFC800, { bevel: 0 });
    return;
  }
  if (p.type === 'counter') {             // a checkout counter: belt, scanner, register, candy rack
    bind(B, 0, PL(0.1)); at(B, x, 0, z); box(B, 1.3, 0.9, 2.0, F.body, { bevel: 0.08, top: F.dark });
    bind(B, 0, KW(KIT.belt, 0.3)); at(B, x, 0.9, z - 0.15); box(B, 0.9, 0.05, 1.5, 0x2E2A3A, { bevel: 0.1, lid: KW(KIT.belt, 0.3), uvs: [1, 3] });
    bind(B, 0, PL(0.9, 0.8)); at(B, x, 0.94, z + 0.68); box(B, 0.7, 0.04, 0.3, 0xE63946, { bevel: 0.2 });
    bind(B, 0, PL(0.4)); at(B, x + 0.3, 0.9, z + 0.75); box(B, 0.4, 0.32, 0.36, 0xDDE3EA, { bevel: 0.2 });
    bind(B, 0, PL(0.6, 0.7)); at(B, x + 0.3, 1.24, z + 0.75, 0, -0.5); box(B, 0.34, 0.24, 0.04, 0x00E5FF, { bevel: 0.2, mid: true });
    for (let k = 0; k < 4; k++) putProduct(view.gv, [13, 14, 15, 16][k], x - 0.68, 0.25 + (k % 2) * 0.32, z - 0.6 + Math.floor(k / 2) * 0.5, -Math.PI / 2, 0.5);
  } else if (p.type === 'display') {      // a round tiered promo stand with stock on every tier
    bind(B, 0, PL(0.2)); at(B, x, 0, z); cyl(B, 0.9, 0.9, 0.45, F.body, { seg: 20, top: F.accent });
    bind(B, 0, KW(KIT.price)); at(B, x, 0.3, z); cyl(B, 0.915, 0.915, 0.12, F.trim, { seg: 20, top: false, side: KW(KIT.price), uRep: 6 });
    bind(B, 0, PL(0.2)); at(B, x, 0.45, z); cyl(B, 0.56, 0.56, 0.4, F.accent, { seg: 18, top: F.body });
    at(B, x, 0.85, z); cyl(B, 0.06, 0.06, 0.8, 0xDDE3EA, { seg: 6 });
    bind(B, 0, K(KIT.sale)); at(B, x, 1.62, z); box(B, 0.6, 0.6, 0.04, 0xFFFFFF, { bevel: 0, mid: true, front: K(KIT.sale), sides: K(KIT.sale) });
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, pr = [7, 8, 9, 10][k % 4]; putProduct(view.gv, pr, x + Math.sin(a) * 0.72, 0.45, z + Math.cos(a) * 0.72, a, 0.7); }
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + 0.3; putProduct(view.gv, [4, 5, 6][k % 3], x + Math.sin(a) * 0.4, 0.85, z + Math.cos(a) * 0.4, a, 0.6); }
  } else if (p.type === 'plant') {
    bind(B, 0, PL(0.1)); at(B, x, 0, z); cyl(B, 0.34, 0.42, 0.5, 0xE07A5F, { seg: 12, top: 0x6B4226 });
    bind(B, 0, PL(0.2)); for (const [dx, dy, dz, r] of [[0, 1.0, 0, 0.42], [0.2, 0.8, 0.1, 0.3], [-0.2, 0.85, -0.1, 0.3], [0, 1.3, 0, 0.3]]) { at(B, x + dx, dy, z + dz); ellipsoid(B, r, r * 1.1, r, 0x3BB273, { seg: 10, rings: 8 }); }
  } else if (p.type === 'bench') {
    bind(B, 0, KW(KIT.wood, 0.1)); at(B, x, 0.32, z); box(B, 1.8, 0.12, 0.8, 0xC98A5B, { bevel: 0.2, lid: KW(KIT.wood, 0.1) });
    bind(B, 0, PL(0.5)); for (const e of [-0.7, 0.7]) { at(B, x + e, 0, z); box(B, 0.1, 0.32, 0.7, 0x5A5468, { bevel: 0.2 }); }
  } else if (p.type === 'fountain') {
    bind(B, 0, PL(0.3)); at(B, x, 0, z); cyl(B, 2.8, 2.8, 0.5, 0xF4F7FB, { seg: 28, top: false });
    at(B, x, 0.4, z); lathe(B, [[2.6, 0], [2.8, 0.1], [2.6, 0.12]], F.accent, { seg: 28 });
    bind(B, 0, PL(0.9, 0.12)); at(B, x, 0.35, z); cyl(B, 2.62, 2.62, 0.04, 0x7CC6FE, { seg: 28 });
    bind(B, 0, PL(0.3)); at(B, x, 0.35, z); cyl(B, 0.6, 0.4, 1.1, 0xF4F7FB, { seg: 14, top: 0x7CC6FE });
  } else if (p.type === 'tree') {
    bind(B, 0, PL(0.1)); at(B, x, 0, z); cyl(B, 0.5, 0.5, 0.6, 0xE63946, { seg: 12, top: 0x6B4226 });
    for (let i = 0; i < 4; i++) { bind(B, 0, PL(0.2)); at(B, x, 0.5 + i * 1.0, z); cyl(B, 1.7 - i * 0.38, 0.45 - i * 0.1, 1.2, 0x2E9C5A, { seg: 14 }); }
    bind(B, 0, PL(1, 0.6)); for (let i = 0; i < 14; i++) { const a = i * 2.4, h = 0.8 + (i % 4) * 0.95, r = 1.55 - (i % 4) * 0.38; at(B, x + Math.sin(a) * r * 0.8, h, z + Math.cos(a) * r * 0.8); ellipsoid(B, 0.13, 0.13, 0.13, i % 2 ? 0xFFD23F : 0xE63946, { seg: 8, rings: 6 }); }
    at(B, x, 4.75, z); ellipsoid(B, 0.3, 0.3, 0.12, 0xFFD23F, { seg: 10, rings: 6 });
  }
  void stock; void world;
}

function rampPiece(B, rp, F) {
  if (rp.tramp) { trampPiece(B, rp); return; }
  const ry = Math.atan2(rp.dx, rp.dz), s = Math.sin(ry), c = Math.cos(ry);
  bind(B, 0, PL(0.3));
  at(B, rp.x, 0.37, rp.z, ry, -0.33); box(B, 1.8, 0.14, 2.3, 0xFFD23F, { bevel: 0.1, lid: KW(KIT.arrow), uvs: [1, 1] });
  for (const side of [-0.95, 0.95]) { at(B, rp.x + c * side + s * 0.55, 0, rp.z - s * side + c * 0.55, ry); box(B, 0.14, 0.62, 1.1, F.dark, { bevel: 0.1 }); }
}
function wetSign(B, x, z) {
  bind(B, 0, K(KIT.wet, 0.3));
  for (const s of [-1, 1]) { at(B, x, 0, z + s * 0.14, s > 0 ? Math.PI : 0, s * -0.26); box(B, 0.5, 0.85, 0.04, 0xFFD23F, { bevel: 0.1, front: K(KIT.wet, 0.3) }); }
}

// ---- the pieces with a life of their own (they break, fly or open) ----------------------------------------------
const pieceCache = new Map();
export function pieceMesh(type, kit) {
  let g = pieceCache.get(type + kit.id);
  if (!g) {
    const B = builder();
    PIECE[type](B, kit.fixture, kit);
    g = { geo: toGeometry(B, {}), labels: type === 'pyramid' || type === 'mega' };
    pieceCache.set(type + kit.id, g);
  }
  const mats = g.labels ? (pieceMats.L || (pieceMats.L = [celMaterial({ mapB: labelAtlas(), rim: 0.3, creases: false }), hullMaterial(2.5)])) : (pieceMats.K || (pieceMats.K = [celMaterial({ mapB: kitAtlas(kit), rim: 0.3, creases: false }), hullMaterial(2.5)]));
  return new THREE.Mesh(g.geo, mats);
}
const pieceMats = {};
const PIECE = Object.assign({}, ARENA_PIECES, {
  pyramid(B) {                          // a pyramid of labelled cans, 3 + 2 + 1 seen from each side, on a pallet
    bind(B, 0, KW(KIT.wood)); box(B, 1.5, 0.12, 1.5, 0xC98A5B, { bevel: 0.15 });
    const labels = [3, 2, 4];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) for (let j = 0; j < 3 - row; j++) {
      const lbl = labels[(row + i + j) % 3];
      bind(B, 0, [4, lbl, 0.35, 0]);
      at(B, (i - (2 - row) / 2) * 0.44, 0.12 + row * 0.44, (j - (2 - row) / 2) * 0.44); cyl(B, 0.2, 0.2, 0.42, 0xFFFFFF, { seg: 12, top: false, side: [4, lbl, 0.35, 0], uRep: 2 });
      bind(B, 0, PL(0.9)); at(B, (i - (2 - row) / 2) * 0.44, 0.54 + row * 0.44, (j - (2 - row) / 2) * 0.44); cyl(B, 0.19, 0.19, 0.02, 0xDDE3EA, { seg: 12 });
    }
  },
  mega(B) {                             // the MEGA PYRAMID: five tiers of gold cans on a double pallet
    bind(B, 0, KW(KIT.wood)); box(B, 2.7, 0.18, 2.7, 0xC98A5B, { bevel: 0.1 });
    for (let row = 0; row < 5; row++) for (let i = 0; i < 5 - row; i++) for (let j = 0; j < 5 - row; j++) {
      bind(B, 0, [5, 0, 0.9, 0.15]);
      at(B, (i - (4 - row) / 2) * 0.5, 0.18 + row * 0.5, (j - (4 - row) / 2) * 0.5); cyl(B, 0.23, 0.23, 0.48, 0xFFC93C, { seg: 12, top: 0xFFE28A });
    }
  },
  gifts(B) {
    for (const [x, y, z, s, c] of [[-0.3, 0, -0.2, 0.7, 0xE63946], [0.35, 0, 0.1, 0.6, 0x3BB273], [-0.1, 0, 0.42, 0.5, 0x3A86FF], [0.05, 0.56, -0.05, 0.55, 0x9B5DE5]]) {
      bind(B, 0, PL(0.3)); at(B, x, y, z, x * 2); box(B, s, s * 0.8, s, c, { bevel: 0.1 });
      bind(B, 0, PL(0.8)); at(B, x, y, z, x * 2); box(B, s * 0.18, s * 0.82, s * 1.02, 0xFFD23F, { bevel: 0 }); at(B, x, y, z, x * 2 + Math.PI / 2); box(B, s * 0.18, s * 0.82, s * 1.02, 0xFFD23F, { bevel: 0 });
      for (const k of [-1, 1]) { at(B, x + k * 0.07, y + s * 0.85, z, x * 2, 0, k * 0.6); ellipsoid(B, 0.09, 0.06, 0.05, 0xFFD23F, { seg: 8, rings: 5 }); }
    }
  },
  stand(B, F, kit) {                    // a cardboard sale standee (a paparazzo with a flash in the boutique)
    if (kit && kit.id === 'boutique') { bind(B, 0, PL(0.1)); box(B, 0.9, 0.1, 0.6, 0xC98A5B, { bevel: 0.2 }); at(B, 0, 0.08, -0.1, 0, -0.2); box(B, 0.1, 1.4, 0.06, 0xA86E43, { bevel: 0 }); bind(B, 0, K(KIT.s0 + 8, 0.1)); at(B, 0, 0.1, 0.05); box(B, 1.0, 1.7, 0.04, 0xFFFFFF, { bevel: 0, front: K(KIT.s0 + 8, 0.1), mid: false }); return; }
    bind(B, 0, PL(0.1)); box(B, 0.9, 0.1, 0.6, 0xC98A5B, { bevel: 0.2 });
    at(B, 0, 0.08, -0.1, 0, -0.2); box(B, 0.1, 1.2, 0.06, 0xA86E43, { bevel: 0 });
    bind(B, 0, K(KIT.pct, 0.1)); at(B, 0, 0.55, 0.05); box(B, 1.2, 1.2, 0.04, 0xFFFFFF, { bevel: 0, front: K(KIT.pct, 0.1), sides: K(KIT.sale), mid: false });
    void F;
  },
  podium(B, F, kit) {                   // a round pedestal with gold trim, two posts and a red ribbon in front (on a runway stage of bulbs in the boutique)
    if (kit && kit.id === 'boutique') { bind(B, 0, PL(0.6)); at(B, 0, 0, 0); cyl(B, 2.4, 2.5, 0.08, 0xFFF3E8, { seg: 32, top: 0xFFFAF4 }); bind(B, 0, PL(0.9)); at(B, 0, 0.06, 0, 0, Math.PI / 2); ring(B, 2.42, 2.42, 0.06, 0.06, 0xE9B949, { seg: 32 }); bind(B, 0, PL(0.4, 0.95)); for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; at(B, Math.sin(a) * 2.42, 0.1, Math.cos(a) * 2.42); ellipsoid(B, 0.08, 0.08, 0.08, 0xFFF1C4, { seg: 6, rings: 4 }); } }
    bind(B, 0, PL(0.4)); cyl(B, 0.85, 0.9, 0.3, F.dark, { seg: 20, top: 0xFFD23F });
    at(B, 0, 0.3, 0); lathe(B, [[0.84, 0], [0.88, 0.03], [0.84, 0.06]], 0xFFD23F, { seg: 20 });
    bind(B, 0, PL(1)); for (const x of [-0.8, 0.8]) { at(B, x, 0, 0.75); cyl(B, 0.06, 0.07, 0.95, 0xFFD23F, { seg: 8 }); at(B, x, 0.98, 0.75); ellipsoid(B, 0.1, 0.1, 0.1, 0xFFD23F, { seg: 8, rings: 6 }); }
    bind(B, 0, PL(0.5)); at(B, 0, 0, 0); tube(B, [[-0.78, 0.82, 0.75], [-0.3, 0.68, 0.78], [0, 0.66, 0.8], [0.3, 0.68, 0.78], [0.78, 0.82, 0.75]], 0.05, 0xE63946, { seg: 6, flat: [1, 0.45] });
    at(B, 0, 0.66, 0.82); ellipsoid(B, 0.12, 0.08, 0.04, 0xE63946, { seg: 8, rings: 6 });
  },
  glass(B, F) {                         // a shop window across a doorway: frame, pane, glare, a sale sticker
    bind(B, 0, PL(0.3)); box(B, 2.0, 0.2, 0.3, F.dark, { bevel: 0.2 }); at(B, 0, 2.0, 0); box(B, 2.0, 0.2, 0.3, F.dark, { bevel: 0.2 });
    bind(B, 0, PL(1, 0.05)); at(B, 0, 0.2, 0); box(B, 1.96, 1.8, 0.08, 0xEAF6FF, { bevel: 0 });
    bind(B, 0, K(KIT.glare, 1)); for (const zz of [0.045, -0.045]) { at(B, 0, 0.2, zz); box(B, 1.9, 1.75, 0.005, 0xEAF6FF, { bevel: 0, front: K(KIT.glare, 1), mid: false }); }
    bind(B, 0, K(KIT.pct)); for (const zz of [0.05, -0.05]) { at(B, 0.35, 0.95, zz, zz < 0 ? Math.PI : 0); box(B, 0.6, 0.6, 0.006, 0xFFFFFF, { bevel: 0, front: K(KIT.pct) }); }
  },
  case(B) {                             // the GIGA TV's glass case: four panes with glare, a steel rim, a sale tag
    bind(B, 0, PL(0.6)); at(B, 0, 0.5, 0); box(B, 1.5, 0.08, 1.5, 0xDDE3EA, { bevel: 0.2 }); at(B, 0, 2.02, 0); box(B, 1.5, 0.1, 1.5, 0xDDE3EA, { bevel: 0.2 });
    // glass drawn the cartoon way: steel corner posts and the glints on its panes (you see the TV through it)
    bind(B, 0, PL(0.8)); for (const x of [-0.72, 0.72]) for (const z of [-0.72, 0.72]) { at(B, x, 0.56, z); box(B, 0.07, 1.48, 0.07, 0xDDE3EA, { bevel: 0.3 }); }
    bind(B, 0, PL(1, 0.6)); for (const [x, z, ry] of [[0, 0.73, 0], [0, -0.73, Math.PI], [0.73, 0, Math.PI / 2], [-0.73, 0, -Math.PI / 2]]) for (const [o, w] of [[-0.3, 0.09], [-0.12, 0.04]]) { at(B, x + Math.cos(ry) * o, 0.75, z - Math.sin(ry) * o, ry, 0, 0.55); box(B, w, 1.0, 0.01, 0xFFFFFF, { bevel: 0, mid: true }); }
    bind(B, 0, K(KIT.pct)); at(B, 0.45, 1.7, 0.76); box(B, 0.5, 0.5, 0.006, 0xFFFFFF, { bevel: 0, front: K(KIT.pct) });
  },
  table(B, F) { bind(B, 0, PL(0.3)); at(B, 0, 0.5, 0); cyl(B, 0.6, 0.6, 0.08, F.body, { seg: 14, top: F.accent }); at(B, 0, 0, 0); cyl(B, 0.12, 0.2, 0.5, 0xDDE3EA, { seg: 8 }); },
  boxes(B, F, kit) {
    if (kit && kit.id === 'boutique') { for (let i = 0; i < 5; i++) { const c = [0xFF8FC7, 0xFFFFFF, 0x2A2440, 0xE9B949, 0xFFD6E0][i]; bind(B, 0, PL(0.2)); at(B, (i % 2) * 0.12 - 0.06, i * 0.3, 0, i * 0.15); box(B, 0.7, 0.24, 0.46, c, { bevel: 0.05 }); at(B, (i % 2) * 0.12 - 0.06, i * 0.3 + 0.22, 0, i * 0.15); box(B, 0.74, 0.08, 0.5, i === 2 ? 0xE9B949 : 0xFFFFFF, { bevel: 0.1 }); } return; }
    bind(B, 0, PL(0.1)); box(B, 0.7, 0.5, 0.6, 0xC98A5B, { bevel: 0.08, top: 0xE0A878 }); at(B, 0, 0.5, 0); box(B, 0.16, 0.012, 0.62, 0xE8D7A8, { bevel: 0 });
    at(B, 0.08, 0.5, 0, 0.5); box(B, 0.5, 0.4, 0.44, 0xD9A36E, { bevel: 0.08, top: 0xE8BC8A });
  },
  mannequin(B, F, kit) {                // glossy and faceless (dressed to the nines in the boutique)
    if (kit && kit.id === 'boutique') { const f = KIT.s0 + 4; bind(B, 0, KW(f + 1, 0.2)); at(B, 0, 0.5, 0); cyl(B, 0.42, 0.17, 0.82, 0xFFFFFF, { seg: 12, side: KW(f + 1, 0.2), uRep: 2, top: 0xFF8FC7 }); bind(B, 0, PL(0.9)); at(B, 0, 1.7, 0); cyl(B, 0.3, 0.28, 0.03, 0xE9B949, { seg: 14 }); at(B, 0, 1.72, 0); cyl(B, 0.15, 0.13, 0.12, 0xE9B949, { seg: 10 }); }
    bind(B, 0, PL(1)); cyl(B, 0.3, 0.3, 0.06, F_INK, { seg: 12 }); at(B, 0, 0.06, 0); cyl(B, 0.03, 0.03, 0.5, 0xDDE3EA, { seg: 6 });
    at(B, 0, 0.95, 0); ellipsoid(B, 0.24, 0.42, 0.18, 0xF4F1FA, { seg: 14, rings: 10 }); at(B, 0, 1.55, 0); ellipsoid(B, 0.15, 0.18, 0.15, 0xF4F1FA, { seg: 12, rings: 8 });
  },
});

// A demonstration set of every supermarket fixture for the kit showcase: deli with awning and shutter, fish counter on ice.
export function fixtureDemo(B, kit, x, z) {
  const F = kit.fixture;
  if (kit.id === 'electronics') {
    // the VR zone: two pods (rings of neon on a disc, a headset on a stand), a neon arch over them
    for (let i = 0; i < 2; i++) {
      const px = x + i * 3.2;
      bind(B, 0, PL(0.4)); at(B, px, 0, z); cyl(B, 1.1, 1.2, 0.12, F.dark, { seg: 24, top: 0x2A2F5A });
      bind(B, 0, PL(0.4, 0.9)); at(B, px, 0.13, z, 0, Math.PI / 2); ring(B, 1.0, 1.0, 0.05, 0.05, i ? F.trim : F.accent, { seg: 24 });
      bind(B, 0, PL(0.6)); at(B, px, 0.12, z); cyl(B, 0.05, 0.05, 1.3, 0xDDE3EA, { seg: 6 }); at(B, px, 1.42, z); box(B, 0.4, 0.2, 0.25, 0x1B1F3B, { bevel: 0.3, mid: true });
      bind(B, 0, PL(0.3, 1)); at(B, px, 1.42, z + 0.13); box(B, 0.32, 0.08, 0.02, F.accent, { bevel: 0, mid: true });
    }
    bind(B, 0, PL(0.3, 0.95)); at(B, x + 1.6, 0, z - 1.6); tube(B, [[-3.2, 0, 0], [-3.2, 3.2, 0], [-2.4, 3.9, 0], [2.4, 3.9, 0], [3.2, 3.2, 0], [3.2, 0, 0]], 0.08, F.trim, { seg: 6 });
    bind(B, 0, K(KIT.s0 + 1, 0.2, 0.3)); at(B, x + 1.6, 4.0, z - 1.6); box(B, 2.4, 1.2, 0.05, 0xFFFFFF, { bevel: 0, mid: true, front: K(KIT.s0 + 1, 0.2, 0.3) });
    return;
  }
  if (kit.id === 'boutique') {
    // a fitting room (velvet curtain, gold rail, a mirror), a mannequin in a dress, a chandelier
    bind(B, 0, PL(0.3)); at(B, x, 0, z - 0.8); box(B, 2.4, 2.6, 0.2, 0xFFD6E0, { bevel: 0.05, top: 0x8A4A6E }); for (const s of [-1, 1]) { at(B, x + s * 1.2, 0, z - 0.1); box(B, 0.12, 2.6, 1.4, 0xFFD6E0, { bevel: 0.1 }); }
    bind(B, 0, K(KIT.s0 + 1, 0.2)); at(B, x, 0.05, z + 0.55); box(B, 2.2, 2.3, 0.05, 0xFFFFFF, { bevel: 0, front: K(KIT.s0 + 1, 0.2) });
    bind(B, 0, PL(0.9)); at(B, x, 2.4, z + 0.6); box(B, 2.4, 0.07, 0.07, F.accent, { bevel: 0.3 });
    bind(B, 0, PL(1, 0.2)); at(B, x + 3.4, 0.2, z - 0.5); box(B, 0.9, 1.9, 0.06, 0xEAF6FF, { bevel: 0.1 }); bind(B, 0, PL(0.9)); at(B, x + 3.4, 0.1, z - 0.5); box(B, 1.0, 2.1, 0.04, F.accent, { bevel: 0.1 });
    bind(B, 0, PL(0.9, 0.3)); at(B, x + 6, 3.4, z); ring(B, 0.9, 0.9, 0.06, 0.06, F.accent, { seg: 20 }); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; bind(B, 0, PL(1, 0.6)); at(B, x + 6 + Math.sin(a) * 0.9, 3.1, z + Math.cos(a) * 0.9); ellipsoid(B, 0.07, 0.14, 0.07, 0xFFF6E8, { seg: 6, rings: 5 }); }
    bind(B, 0, PL(0.9)); at(B, x + 6, 3.4, z); cyl(B, 0.03, 0.03, 2.0, F.accent, { seg: 6 });
    return;
  }
  if (kit.id === 'warehouse') {
    // the loading bay: shrink-wrapped pallets of cans, a stack of stencilled cartons, oil drums, a caged lamp
    for (let i = 0; i < 3; i++) {
      bind(B, 0, PL(0.1)); at(B, x + i * 1.6, 0, z); box(B, 1.3, 0.14, 1.1, 0xC98A5B, { bevel: 0.08 });
      bind(B, 0, PL(0.7)); for (let j = 0; j < 9; j++) { at(B, x + i * 1.6 - 0.4 + (j % 3) * 0.4, 0.14, z - 0.35 + Math.floor(j / 3) * 0.35); cyl(B, 0.17, 0.17, 0.5, [0xE63946, 0x3A86FF, 0xFFC800][(i + j) % 3], { seg: 10 }); }
      bind(B, 0, PL(0.9)); at(B, x + i * 1.6, 0.14, z); box(B, 1.28, 0.56, 1.06, 0xE8EEF6, { bevel: 0.15, top: 0xF6FAFF });
    }
    bind(B, 0, PL(0.1));
    for (const [dx, dy, s] of [[5.2, 0, 1.0], [6.3, 0, 0.9], [5.7, 0.95, 0.85]]) { at(B, x + dx, dy, z - 0.2); box(B, s, s * 0.9, s, 0xD9B98A, { bevel: 0.04 }); }
    bind(B, 0, PL(0.6)); for (const [dx, dz] of [[7.6, -0.3], [8.2, 0.2], [7.8, 0.7]]) { at(B, x + dx, 0, z + dz); cyl(B, 0.32, 0.32, 0.95, 0x3A6EA5, { seg: 12, top: 0x2B2F3A }); }
    bind(B, 0, PL(0.4)); at(B, x + 3, 0, z - 1.6); box(B, 0.1, 3.4, 0.1, 0x2B2F3A, { bevel: 0 }); at(B, x + 3, 3.4, z - 1.6); cyl(B, 0.3, 0.42, 0.3, 0x2B2F3A, { seg: 10 });
    bind(B, 0, PL(0.6, 0.9)); at(B, x + 3, 3.25, z - 1.6); ellipsoid(B, 0.2, 0.18, 0.2, 0xFFE8B0, { seg: 8, rings: 6 });
    return;
  }
  // the deli: a counter under a striped awning, a roller shutter half up behind it, a sign
  bind(B, 0, PL(0.2)); at(B, x, 0, z); box(B, 3.6, 1.0, 1.0, F.body, { bevel: 0.08, top: 0xDDE3EA });
  bind(B, 0, PL(1, 0.05)); at(B, x, 1.0, z + 0.1); box(B, 3.4, 0.5, 0.6, 0xEAF6FF, { bevel: 0.1 });
  bind(B, 0, KW(KIT.awning, 0.2)); at(B, x, 2.3, z + 0.6, 0, 0.55); box(B, 4.0, 0.06, 1.3, 0xFFFFFF, { bevel: 0, lid: KW(KIT.awning, 0.2), sides: KW(KIT.awning), uvs: [4, 1] });
  bind(B, 0, KW(KIT.shutter, 0.4)); at(B, x, 1.3, z - 0.8); box(B, 3.8, 1.6, 0.08, 0xC9CED8, { bevel: 0, front: KW(KIT.shutter, 0.4), uvs: [2, 1.5] });
  bind(B, 0, K(KIT.deli)); at(B, x, 3.0, z - 0.7); box(B, 2.2, 0.55, 0.06, 0xFFFFFF, { bevel: 0, front: K(KIT.deli), mid: true });
  // the fish counter: a sloped bed of crushed ice with fish on it, a sign
  const fx = x + 5;
  bind(B, 0, PL(0.2)); at(B, fx, 0, z); box(B, 3.6, 0.8, 1.2, F.body, { bevel: 0.08 });
  bind(B, 0, KW(KIT.ice, 0.9, 0.08)); at(B, fx, 0.8, z, 0, -0.25); box(B, 3.4, 0.1, 1.1, 0xDDF5FF, { bevel: 0.2, lid: KW(KIT.ice, 0.9, 0.08), uvs: [3, 1] });
  bind(B, 0, PL(0.7)); for (let k = 0; k < 6; k++) { at(B, fx - 1.3 + k * 0.52, 0.98 - (k % 2) * 0.05, z + (k % 2 ? 0.2 : -0.15), 0.3 * (k % 3 - 1)); ellipsoid(B, 0.24, 0.07, 0.1, [0x7CC6FE, 0xFF8A7A, 0xC0C6D0][k % 3], { seg: 10, rings: 6 }); }
  bind(B, 0, K(KIT.fish)); at(B, fx, 2.2, z - 0.4); box(B, 2.0, 0.5, 0.06, 0xFFFFFF, { bevel: 0, front: K(KIT.fish), mid: true });
  void PRODUCTS;
}
