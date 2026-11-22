// DOORBUSTER — goods.js
// Purpose: products and hot items (ART.md section 5): eighteen base shapes built at unit size and drawn
//          as one instanced mesh each (the instance carries the size, a tint and a label cell, so draw
//          calls follow the shapes, not the products); a catalogue of 40+ products from shape x label x
//          colour; the visual variants of the gameplay goods; the eight hot items with their gold halo;
//          the per-frame writer the scene uses; the list icons for the interface.
// Exports: SHAPES, PRODUCTS, HOT, STORE_STOCK, makeGoods, beginGoods, putGood, putProduct, putHot, endGoods, lockGoods,
//          variantAt, productSize, goodIcon
// Depends on: config.js, shapes.js, atlas.js, render.js and the global THREE.

import { GOODS, mix } from './config.js';
import { builder, at, bind, box, cyl, ellipsoid, lathe, tube, ring, toGeometry } from './shapes.js';
import { labelAtlas } from './atlas.js';
import { R, celMaterial, hullMaterial } from './render.js';

const LBL = (g = 0.25) => [3, 0, g, 0], TINT = (g = 0.3) => [5, 0, g, 0], FIX = (g = 0) => [0, 0, g, 0], WRAP = (g = 0.3) => [4, 0, g, 0];
const G_W = 0xFFFFFF, G_STEEL = 0xDDE3EA, G_INK = 0x2A1A3A;

// ---- base shapes, unit size: width, height and depth 1, origin on the floor, label toward +z ----------
const BUILD = {
  box(B) { bind(B, 0, TINT(0.2)); box(B, 1, 1, 1, G_W, { bevel: 0.06, front: LBL(), lid: TINT(0.3) }); },
  tallbox(B) {
    bind(B, 0, TINT(0.2)); box(B, 1, 0.8, 1, G_W, { bevel: 0.05, front: LBL() });
    at(B, 0, 0.8, 0); for (const s of [1, -1]) { at(B, 0, 0.8, s * 0.25, 0, s * 0.55); box(B, 0.98, 0.04, 0.58, G_W, { bevel: 0.2 }); }
    at(B, 0, 0.94, 0); box(B, 0.98, 0.08, 0.06, G_W, { bevel: 0.3 });
  },
  can(B) {
    bind(B, 0, WRAP(0.35)); at(B, 0, 0.06, 0); cyl(B, 0.5, 0.5, 0.88, G_W, { seg: 16, top: false, side: WRAP(0.35), uRep: 2 });
    bind(B, 0, FIX(0.9)); at(B, 0, 0.94, 0); cyl(B, 0.47, 0.47, 0.03, G_STEEL, { seg: 16 });
    at(B, 0, 0, 0); cyl(B, 0.47, 0.5, 0.06, G_STEEL, { seg: 16, top: false });
    for (const y of [0.06, 0.94]) { at(B, 0, y, 0, 0, Math.PI / 2); ring(B, 0.5, 0.5, 0.035, 0.07, G_STEEL, { seg: 12 }); }
  },
  bottle(B) {
    bind(B, 0, FIX(0.8)); at(B, 0, 0, 0); lathe(B, [[0.001, 0], [0.42, 0.01], [0.46, 0.08], [0.46, 0.58], [0.4, 0.68], [0.2, 0.8], [0.15, 0.86]], 0xE4F4FA, { seg: 14 });
    bind(B, 0, WRAP(0.3)); at(B, 0, 0.18, 0); cyl(B, 0.47, 0.47, 0.34, G_W, { seg: 14, top: false, side: WRAP(0.3), uRep: 2 });
    bind(B, 0, TINT(0.4)); at(B, 0, 0.84, 0); cyl(B, 0.19, 0.19, 0.16, G_W, { seg: 12 });
  },
  jug(B) {
    bind(B, 0, FIX(0.3)); box(B, 0.9, 0.85, 0.82, 0xFAFCFF, { bevel: 0.25, front: LBL() });
    bind(B, 0, TINT(0.4)); at(B, -0.15, 0.85, 0); cyl(B, 0.15, 0.15, 0.12, G_W, { seg: 10 });
    bind(B, 0, FIX(0.3)); at(B, 0, 0, 0); tube(B, [[0.18, 0.86, 0], [0.42, 0.88, 0], [0.47, 0.55, 0]], 0.07, 0xFAFCFF, { seg: 6, caps: 'round' });
  },
  bag(B) {
    bind(B, 0, TINT(0.5)); at(B, 0, 0.5, 0); ellipsoid(B, 0.5, 0.46, 0.27, G_W, { seg: 10, rings: 8, e1: 0.55, e2: 0.7, uv: 'face', fw: 0.5, fh: 0.46, faceZ: 0.05, faceTex: LBL(0.5) });
    for (const y of [0.04, 0.96]) { at(B, 0, y - 0.04, 0); box(B, 1, 0.08, 0.1, G_W, { bevel: 0.3, sides: TINT(0.3) }); }
  },
  jar(B) {
    bind(B, 0, FIX(0.9)); at(B, 0, 0, 0); cyl(B, 0.45, 0.45, 0.8, 0xEAF6FF, { seg: 14, top: false });
    bind(B, 0, WRAP(0.3)); at(B, 0, 0.2, 0); cyl(B, 0.46, 0.46, 0.42, G_W, { seg: 14, top: false, side: WRAP(0.3), uRep: 2 });
    bind(B, 0, TINT(0.6)); at(B, 0, 0.8, 0); cyl(B, 0.48, 0.48, 0.2, G_W, { seg: 14 });
  },
  blister(B) {
    bind(B, 0, TINT(0.2)); box(B, 1, 1, 0.16, G_W, { bevel: 0.1, front: LBL(0.2) });
    bind(B, 0, FIX(1)); at(B, 0, 0.12, 0.1); box(B, 0.6, 0.42, 0.12, 0xF4FAFF, { bevel: 0.45 });
  },
  fruit(B) {
    bind(B, 0, TINT(0.5)); at(B, 0, 0.5, 0); ellipsoid(B, 0.5, 0.48, 0.5, G_W, { seg: 10, rings: 7 });
    bind(B, 0, FIX(0.2)); at(B, 0, 0.94, 0); cyl(B, 0.04, 0.03, 0.12, 0x6B4226, { seg: 6 });
    at(B, 0.12, 1.0, 0, 0, 0, -0.6); ellipsoid(B, 0.14, 0.04, 0.08, 0x3BB273, { seg: 6, rings: 3 });
  },
  loaf(B) {
    bind(B, 0, FIX(0.2)); at(B, 0, 0, 0); box(B, 1, 0.7, 0.95, 0xE8B36A, { bevel: 0.42, top: 0xD99A4E });
    for (const z of [-0.25, 0, 0.25]) { at(B, 0, 0.68, z, 0.4); box(B, 0.7, 0.04, 0.05, 0xFFF1D6, { bevel: 0.3 }); }
    bind(B, 0, LBL(0.4)); at(B, 0, 0.12, 0); box(B, 1.02, 0.36, 0.97, G_W, { bevel: 0.2, front: LBL(0.4), sides: TINT(0.4) });
  },
  eggs(B) {
    bind(B, 0, FIX(0.1)); box(B, 1, 0.55, 1, 0xC9C2D6, { bevel: 0.15, front: LBL(0.1) });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { at(B, (i - 1) * 0.3, 0.55, (j - 0.5) * 0.45); ellipsoid(B, 0.15, 0.13, 0.15, 0xD6CFE2, { seg: 8, rings: 5 }); }
  },
  rolls(B) {
    bind(B, 0, FIX(0.1)); for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { at(B, x, 0, z); cyl(B, 0.25, 0.25, 1, 0xFBFBFF, { seg: 12, top: 0xF0F0F8 }); }
    bind(B, 0, LBL(0.6)); at(B, 0, 0.3, 0); box(B, 1.02, 0.42, 1.02, G_W, { bevel: 0.25, front: LBL(0.6), sides: TINT(0.5) });
  },
  ball(B) {
    bind(B, 0, TINT(0.45)); at(B, 0, 0.5, 0); ellipsoid(B, 0.5, 0.5, 0.5, G_W, { seg: 12, rings: 8 });
    bind(B, 0, FIX(0)); for (const r of [0, Math.PI / 2]) { at(B, 0, 0.5, 0, r); ring(B, 0.5, 0.5, 0.025, 0.04, G_INK, { seg: 18 }); }
  },
  shoebox(B) {
    bind(B, 0, TINT(0.2)); box(B, 1, 0.78, 1, G_W, { bevel: 0.05, front: LBL() });
    at(B, 0, 0.72, 0); box(B, 1.04, 0.28, 1.04, G_W, { bevel: 0.1, sides: TINT(0.3), lid: TINT(0.3) });
    bind(B, 0, FIX(0)); at(B, 0, 0.75, 0.52); box(B, 0.9, 0.05, 0.02, mix(G_W, G_INK, 0.6), { bevel: 0 });
  },
  appliance(B) {
    bind(B, 0, TINT(0.6)); box(B, 1, 1, 1, G_W, { bevel: 0.1 });
    bind(B, 0, FIX(1)); at(B, -0.12, 0.18, 0.5); box(B, 0.6, 0.62, 0.03, 0x2A3550, { bevel: 0.2 });
    for (const y of [0.3, 0.6]) { at(B, 0.34, y, 0.5); cyl(B, 0.07, 0.07, 0.04, G_INK, { seg: 8, mid: true }); }
    bind(B, 0, LBL(0.2)); at(B, 0.34, 0.75, 0.5); box(B, 0.24, 0.14, 0.02, G_W, { bevel: 0.2, front: LBL(0.2) });
  },
  pizzabox(B) { bind(B, 0, FIX(0)); box(B, 1, 1, 1, 0xF3E3C6, { bevel: 0.12, lid: LBL(0.1), top: G_W }); },
  suitcase(B) {
    bind(B, 0, TINT(0.6)); box(B, 1, 0.9, 1, G_W, { bevel: 0.2 });
    bind(B, 0, FIX(0.4)); at(B, 0, 0, 0); tube(B, [[-0.2, 0.9, 0], [-0.15, 1.04, 0], [0.15, 1.04, 0], [0.2, 0.9, 0]], 0.05, G_INK, { seg: 6 });
    for (const x of [-0.3, 0.3]) { at(B, x, 0, 0); box(B, 0.06, 0.92, 1.02, mix(G_W, G_INK, 0.35), { bevel: 0 }); }
  },
  speaker(B) {
    bind(B, 0, TINT(0.3)); box(B, 1, 1, 1, G_W, { bevel: 0.08 });
    bind(B, 0, FIX(0.6)); for (const [y, r] of [[0.68, 0.22], [0.3, 0.32]]) { at(B, 0, y, 0.5, 0, Math.PI / 2); cyl(B, r, r * 0.8, 0.05, 0x2A2440, { seg: 14, mid: true, top: 0x5A5468 }); }
    bind(B, 0, LBL(0.2)); at(B, 0, 0.9, 0.5); box(B, 0.5, 0.1, 0.02, G_W, { bevel: 0.2, front: LBL(0.2) });
  },
};
export const SHAPES = Object.keys(BUILD);

// ---- the catalogue: [shape, label cell, tint, size [w, h, d] in metres] --------------------------------------
export const PRODUCTS = [
  ['box', 0, 0x5B3FD6, [0.4, 0.54, 0.22]], ['box', 1, 0xFF9F1C, [0.4, 0.54, 0.22]], ['box', 30, 0x6B3A1E, [0.4, 0.54, 0.22]], ['box', 13, 0x3B2416, [0.34, 0.44, 0.22]],
  ['can', 2, 0x7A4A22, [0.4, 0.44, 0.4]], ['can', 3, 0xE63946, [0.4, 0.44, 0.4]], ['can', 4, 0xFFD23F, [0.4, 0.44, 0.4]], ['can', 7, 0x3A86FF, [0.32, 0.46, 0.32]],
  ['bottle', 7, 0x3A86FF, [0.34, 0.6, 0.34]], ['bottle', 8, 0xE63946, [0.34, 0.6, 0.34]], ['bottle', 9, 0x48CAE4, [0.34, 0.6, 0.34]], ['bottle', 28, 0x2A2440, [0.34, 0.6, 0.34]], ['bottle', 29, 0xFFE45C, [0.34, 0.6, 0.34]],
  ['bag', 1, 0xFF9F1C, [0.44, 0.5, 0.26]], ['bag', 5, 0x3BB273, [0.44, 0.5, 0.26]], ['bag', 6, 0xFF8FC7, [0.44, 0.5, 0.26]], ['bag', 31, 0x7A2E1E, [0.44, 0.5, 0.26]],
  ['jug', 10, 0x3A86FF, [0.42, 0.58, 0.38]], ['tallbox', 10, 0x3A86FF, [0.3, 0.6, 0.3]], ['tallbox', 27, 0xFF9F1C, [0.3, 0.6, 0.3]],
  ['jar', 26, 0x9B2D5A, [0.34, 0.4, 0.34]], ['jar', 11, 0xFF6FA0, [0.34, 0.4, 0.34]], ['jar', 13, 0xE9B949, [0.34, 0.4, 0.34]],
  ['eggs', 23, 0xFFFFFF, [0.5, 0.26, 0.34]], ['loaf', 24, 0xE63946, [0.56, 0.34, 0.32]], ['rolls', 12, 0x7CC6FE, [0.44, 0.4, 0.44]], ['pizzabox', 25, 0xFFFFFF, [0.68, 0.2, 0.68]],
  ['fruit', 0, 0x5BBF3A, [0.58, 0.54, 0.58]], ['fruit', 0, 0xFF7F11, [0.5, 0.46, 0.5]], ['fruit', 0, 0xE63946, [0.4, 0.4, 0.4]], ['fruit', 0, 0xFFD23F, [0.4, 0.42, 0.4]],
  ['blister', 15, 0xFF4FD8, [0.36, 0.48, 0.18]], ['blister', 14, 0x1B1F3B, [0.36, 0.48, 0.18]], ['blister', 17, 0x9B5DE5, [0.4, 0.46, 0.16]],
  ['appliance', 14, 0xDDE3EA, [0.62, 0.46, 0.44]], ['appliance', 14, 0xFF8A7A, [0.92, 0.6, 0.7]], ['box', 16, 0x2A2440, [0.56, 0.6, 0.4]], ['box', 18, 0x1B1F3B, [0.7, 0.5, 0.2]],
  ['shoebox', 20, 0xFF7F11, [0.7, 0.36, 0.46]], ['shoebox', 21, 0xE63946, [0.7, 0.36, 0.46]], ['speaker', 16, 0x2A2440, [0.66, 1.0, 0.62]], ['suitcase', 19, 0xFF8A7A, [0.9, 0.7, 0.5]],
  ['ball', 22, 0xFF7F11, [0.5, 0.5, 0.5]], ['ball', 22, 0xFFFFFF, [0.44, 0.44, 0.44]], ['ball', 22, 0x3A86FF, [0.5, 0.5, 0.5]],
];
// The products each gameplay good may look like (its variants).
const LOOK = { can: [4, 5, 6], soda: [8, 9, 10, 11, 12], chips: [13, 14, 15, 16], roll: [25], cereal: [0, 1, 2], phone: [31, 32], game: [33], toaster: [34],
  melon: [27, 28], pizza: [26], headset: [36], shoes: [38, 39], microwave: [35], speaker: [40], suitcase: [41] };
// What a store stocks on its shelves as decor (product indices).
export const STORE_STOCK = { supermarket: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30] };
export function productSize(i) { return PRODUCTS[i][3]; }
export function variantAt(x, z) { return Math.abs(Math.floor(x * 7.31 + z * 3.17) * 2654435761) >>> 0; }

// ---- hot items: oversized, a silhouette of their own, gold, a halo above them (ART.md section 5) -----------
export const HOT = ['cheese', 'goldcan', 'gigatv', 'handbag', 'trophy', 'cake', 'octopus', 'toaster'];
const G_GOLD = 0xFFC83D;
const HOT_BUILD = {
  cheese(B) {
    bind(B, 0, FIX(0.25)); at(B, 0, 0, 0); cyl(B, 0.62, 0.62, 0.42, 0xFFD23F, { seg: 24, top: 0xFFE27A, bottom: true });
    for (const y of [0, 0.36]) { at(B, 0, y, 0); cyl(B, 0.635, 0.635, 0.06, 0xE63946, { seg: 24, top: false }); }
    for (const [x, z, r] of [[0.2, 0.15, 0.09], [-0.25, -0.1, 0.12], [0.05, -0.32, 0.07], [-0.12, 0.3, 0.06], [0.36, -0.2, 0.06]]) { at(B, x, 0.425, z); cyl(B, r, r, 0.01, 0xE0A81E, { seg: 10 }); }
    at(B, 0.42, 0.18, 0.42, 0.785); box(B, 0.34, 0.06, 0.04, G_W, { bevel: 0.3, mid: true });
  },
  goldcan(B) { bind(B, 0, FIX(1)); at(B, 0, 0, 0); cyl(B, 0.26, 0.26, 0.5, G_GOLD, { seg: 16, top: 0xFFE9A6 }); for (const y of [0.03, 0.47]) { at(B, 0, y, 0, 0, Math.PI / 2); ring(B, 0.26, 0.26, 0.025, 0.05, 0xE9B949, { seg: 16 }); } },
  gigatv(B) {
    bind(B, 0, FIX(0.5)); at(B, 0, 0.18, 0); box(B, 1.5, 0.95, 0.14, 0x2A2440, { bevel: 0.08 });
    bind(B, 0, [0, 0, 0.6, 0.85]); at(B, 0, 0.25, 0.071); box(B, 1.36, 0.81, 0.02, 0x00E5FF, { bevel: 0, top: 0xFF4FD8 });
    bind(B, 0, FIX(0.8)); at(B, 0, 0, 0); box(B, 0.5, 0.06, 0.32, G_GOLD, { bevel: 0.3 }); at(B, 0, 0.05, 0); box(B, 0.08, 0.15, 0.06, G_GOLD, { bevel: 0.3 });
  },
  handbag(B) {
    bind(B, 0, FIX(1)); at(B, 0, 0, 0); box(B, 0.9, 0.62, 0.36, G_GOLD, { bevel: 0.35, top: 0xFFE9A6 });
    at(B, 0, 0, 0); tube(B, [[-0.28, 0.6, 0], [-0.2, 0.95, 0], [0.2, 0.95, 0], [0.28, 0.6, 0]], 0.04, G_GOLD, { seg: 8 });
    bind(B, 0, [0, 0, 1, 0.4]); at(B, 0, 0.42, 0.19); ellipsoid(B, 0.07, 0.07, 0.03, 0xFF4FD8, { seg: 10, rings: 6 });
  },
  trophy(B) {
    bind(B, 0, FIX(1)); at(B, 0, 0, 0); box(B, 0.5, 0.18, 0.5, 0x2A2440, { bevel: 0.2 });
    at(B, 0, 0.18, 0); lathe(B, [[0.08, 0], [0.06, 0.2], [0.12, 0.32], [0.34, 0.42], [0.38, 0.78], [0.34, 0.8]], G_GOLD, { seg: 18 });
    for (const s of [1, -1]) { at(B, s * 0.38, 0.78, 0, 0, 0, Math.PI / 2); ring(B, 0.12, 0.14, 0.03, 0.05, G_GOLD, { seg: 12 }); }
  },
  cake(B) {
    bind(B, 0, FIX(0.3)); for (const [y, r, c] of [[0, 0.55, 0xFF8FC7], [0.32, 0.42, 0xFFF6EA], [0.6, 0.3, 0xFF8FC7]]) { at(B, 0, y, 0); cyl(B, r, r, 0.3, c, { seg: 20, top: 0xFFFFFF }); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; at(B, Math.sin(a) * r, y + 0.26, Math.cos(a) * r); ellipsoid(B, 0.06, 0.08, 0.06, 0xFFFFFF, { seg: 6, rings: 4 }); } }
    bind(B, 0, FIX(1)); at(B, 0, 0.98, 0); ellipsoid(B, 0.08, 0.08, 0.08, 0xE63946, { seg: 10, rings: 8 });
  },
  octopus(B) {
    bind(B, 0, FIX(0.4)); at(B, 0, 0.62, 0); ellipsoid(B, 0.46, 0.5, 0.44, 0xFF6FB5, { seg: 18, rings: 12 });
    at(B, 0, 0, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, c = Math.cos(a), s = Math.sin(a); tube(B, [[s * 0.25, 0.35, c * 0.25], [s * 0.55, 0.12, c * 0.55], [s * 0.78, 0.08, c * 0.78], [s * 0.82, 0.22, c * 0.82]], (u) => 0.12 * (1 - u * 0.75), 0xFF6FB5, { seg: 8, caps: 'round' }); }
    bind(B, 0, FIX(0.6)); for (const s of [1, -1]) { at(B, s * 0.16, 0.72, 0.38); ellipsoid(B, 0.1, 0.12, 0.06, G_W, { seg: 10, rings: 8 }); at(B, s * 0.16, 0.7, 0.43); ellipsoid(B, 0.05, 0.06, 0.03, G_INK, { seg: 8, rings: 6 }); }
  },
  toaster(B) {
    bind(B, 0, FIX(1)); box(B, 0.9, 0.62, 0.56, G_STEEL, { bevel: 0.25 });
    for (const z of [-0.1, 0.1]) { at(B, 0, 0.6, z); box(B, 0.62, 0.04, 0.08, G_INK, { bevel: 0 }); }
    bind(B, 0, [0, 0, 1, 0.3]); for (let i = 0; i < 9; i++) { at(B, -0.36 + (i % 5) * 0.18, 0.15 + Math.floor(i / 5) * 0.22, 0.29, 0.785, 0.6); box(B, 0.07, 0.07, 0.07, 0x9FE7FF, { bevel: 0, mid: true }); }
  },
};

// ---- the instanced meshes and their per-frame writer ----------------------------------------------------------
const GCAP = 480, HOT_GCAP = 16;
export function makeGoods(root) {
  const T = THREE, map = labelAtlas(), view = { meshes: [], counts: new Int32Array(SHAPES.length), fixed: new Int32Array(SHAPES.length), hot: [], hotN: new Int32Array(HOT.length) };
  const mat = celMaterial({ mapB: map, instCell: true, halftone: false, ink: 0.85 });
  view.mat = mat;
  SHAPES.forEach((name) => {
    const B = builder(); BUILD[name](B);
    const geo = toGeometry(B, { groups: false, hull: false });
    geo.setAttribute('iCell', new T.InstancedBufferAttribute(new Float32Array(GCAP), 1));
    const mesh = new T.InstancedMesh(geo, mat, GCAP);
    mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(GCAP * 3).fill(1), 3);
    mesh.count = 0; mesh.frustumCulled = false;
    root.add(mesh); view.meshes.push(mesh);
  });
  const hotMat = celMaterial({ rim: 0.7 }), hull = hullMaterial(2.5);
  view.hotMats = [hotMat, hull];
  HOT.forEach((name) => {
    const B = builder(); HOT_BUILD[name](B);
    const geo = toGeometry(B, {});
    const mesh = new T.InstancedMesh(geo, [hotMat, hull], HOT_GCAP);
    mesh.count = 0; mesh.frustumCulled = false; mesh.layers.enable(1);
    root.add(mesh); view.hot.push(mesh);
  });
  return view;
}
// Starts a frame: everything after the locked static prefix (shelf decor) is written again.
export function beginGoods(view) { view.counts.set(view.fixed); view.hotN.fill(0); }
// Locks what has been written so far as the static prefix.
export function lockGoods(view) { view.fixed.set(view.counts); }
const _rgb = [0, 0, 0];
function writeOne(view, p, x, y, z, ry, s, rx, rz, sz) {
  const [shape, cell, tint, size] = PRODUCTS[p], k = SHAPES.indexOf(shape), n = view.counts[k];
  if (n >= GCAP) return;
  const m = view.meshes[k], a = m.instanceMatrix.array, o = n * 16, S = sz || size;
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx || 0), sx = Math.sin(rx || 0), cz = Math.cos(rz || 0), sn = Math.sin(rz || 0);
  // columns of Ry * Rx * Rz, scaled by the product's size
  const X = S[0] * s, Y = S[1] * s, Z = S[2] * s;
  a[o] = (cy * cz + sy * sx * sn) * X; a[o + 1] = cx * sn * X; a[o + 2] = (-sy * cz + cy * sx * sn) * X; a[o + 3] = 0;
  a[o + 4] = (-cy * sn + sy * sx * cz) * Y; a[o + 5] = cx * cz * Y; a[o + 6] = (sy * sn + cy * sx * cz) * Y; a[o + 7] = 0;
  a[o + 8] = sy * cx * Z; a[o + 9] = -sx * Z; a[o + 10] = cy * cx * Z; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
  m.geometry.attributes.iCell.array[n] = cell;
  _rgb[0] = (tint >> 16 & 255) / 255; _rgb[1] = (tint >> 8 & 255) / 255; _rgb[2] = (tint & 255) / 255;
  m.instanceColor.array.set(_rgb, n * 3);
  view.counts[k] = n + 1;
}
// A gameplay good (GOODS index) in one of its looks; hot items draw the store's hot item.
export function putGood(view, good, variant, x, y, z, ry, s, rx, rz, hot) {
  const g = GOODS[good];
  if (g.size === 'H') { putHot(view, hot || 'cheese', x, y, z, ry, s * 0.9, rx, rz); return; }
  const looks = LOOK[g.id] || [0];
  writeOne(view, looks[(variant || 0) % looks.length], x, y, z, ry, s, rx, rz, g.dims);
}
export function putProduct(view, p, x, y, z, ry, s) { writeOne(view, p, x, y, z, ry, s, 0, 0); }
export function putHot(view, name, x, y, z, ry, s, rx, rz) {
  const i = HOT.indexOf(name), m = view.hot[i], n = view.hotN[i];
  if (i < 0 || n >= HOT_GCAP) return;
  const c = Math.cos(ry), sn = Math.sin(ry), a = m.instanceMatrix.array, o = n * 16;
  a.fill(0, o, o + 16);
  a[o] = c * s; a[o + 2] = -sn * s; a[o + 5] = s; a[o + 8] = sn * s; a[o + 10] = c * s; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
  if (rx || rz) { const M = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry, rz || 0, 'YXZ')).scale(new THREE.Vector3(s, s, s)).setPosition(x, y, z); M.toArray(a, o); }
  view.hotN[i] = n + 1;
}
export function endGoods(view) {
  view.meshes.forEach((m, k) => { m.count = view.counts[k]; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.geometry.attributes.iCell.needsUpdate = true; });
  view.hot.forEach((m, i) => { m.count = view.hotN[i]; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; });
}

// A small picture of one gameplay good for the interface (the list icons), drawn once into a canvas.
let iconView = null;
export function goodIcon(kind, size = 96) {
  const T = THREE, ren = R.renderer, rt = new T.WebGLRenderTarget(size, size), scene = new T.Scene(), d = GOODS[kind].dims;
  if (!iconView) { const root = new T.Group(); iconView = { root, v: makeGoods(root) }; }
  scene.add(iconView.root);
  beginGoods(iconView.v); putGood(iconView.v, kind, 0, 0, 0, 0, 0.55, 1, 0, 0); endGoods(iconView.v);
  const r = Math.max(d[0], d[1], d[2]) * 0.8, cam = new T.OrthographicCamera(-r, r, r, -r, 0.1, 30);
  cam.position.set(3, 3.4 + d[1] / 2, 5); cam.lookAt(0, d[1] / 2, 0);
  const px = new Uint8Array(size * size * 4), cc = ren.getClearColor(new T.Color()), ca = ren.getClearAlpha();
  ren.setRenderTarget(rt); ren.setClearColor(0, 0); ren.clear(); ren.render(scene, cam);
  ren.readRenderTargetPixels(rt, 0, 0, size, size, px);
  ren.setRenderTarget(null); ren.setClearColor(cc, ca);
  scene.remove(iconView.root);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  const D = img.data, on = (x, y) => x >= 0 && y >= 0 && x < size && y < size && D[(y * size + x) * 4] + D[(y * size + x) * 4 + 1] + D[(y * size + x) * 4 + 2] > 0;
  const ink = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!on(x, y)) { for (let dy = -2; dy <= 2 && !ink[y * size + x]; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5 && on(x + dx, y + dy)) { ink[y * size + x] = 1; break; } }
  for (let i = 0; i < size * size; i++) { if (ink[i]) { D[i * 4] = 42; D[i * 4 + 1] = 26; D[i * 4 + 2] = 58; D[i * 4 + 3] = 255; } else D[i * 4 + 3] = D[i * 4] + D[i * 4 + 1] + D[i * 4 + 2] > 0 ? 255 : 0; }
  ctx.putImageData(img, 0, 0);
  rt.dispose();
  return cv.toDataURL();
}

