// DOORBUSTER — cartart.js
// Purpose: the cart as art (ART.md section 4): a chunky shopping cart with thick frame tubes, embossed
//          basket panels, a grip in the owner's colour, a fold-down child seat and four swivel casters;
//          every upgrade tier (wheels, basket, bumper, magnet) and cosmetic (paints, hats) as data the
//          shop uses; the rival carts and Turbo Gramps' racing scooter. Built into the same rigidly
//          skinned mesh as the character who pushes it (rig.js), bones from `first` on.
// Exports: PAINTS, HATS, UPGRADES, CART_BONES, cartSpecFor, buildCart, buildHat
// Depends on: config.js, shapes.js, atlas.js.
//
// Cart space: origin on the floor under the middle of the basket, forward +z. The basket floor is at
// y = 0.48 (the tower of goods stands on it). The handle is at the back; the pusher stands behind it.

import { mix } from './config.js';
import { at, bind, box, cyl, ellipsoid, lathe, tube, ring } from './shapes.js';
import { PAT } from './atlas.js';

export const CART_BONES = { body: 0, wFL: 1, wFR: 2, wBL: 3, wBR: 4, swing: 5 };
// Paints: frame and panels, rim, trims, the panel pattern (a pattern cell, or null for the grid), gloss.
export const PAINTS = {
  pink: { name: 'HOT PINK', price: 0, body: 0xFF4FA3, rim: 0xFFB3D9, trim: 0xFFD23F, grip: 0xFF4FA3, gloss: 0.35 },
  mint: { name: 'MINT CHROME', price: 150, body: 0x8EE3C8, rim: 0xF2FFFB, trim: 0xFFFFFF, gloss: 0.95 },
  gold: { name: 'GOLD RUSH', price: 250, body: 0xE9B949, rim: 0xFFF1B8, trim: 0x2A2440, gloss: 0.9 },
  friday: { name: 'BLACK FRIDAY', price: 200, body: 0x2A2440, rim: 0xFFD23F, trim: 0xFFD23F, gloss: 0.5, pat: 'hazard' },
  candy: { name: 'CANDY STRIPE', price: 300, body: 0xFFFFFF, rim: 0xFF4FA3, trim: 0xFF4FA3, gloss: 0.4, pat: 'candy' },
  galaxy: { name: 'GALAXY', price: 400, body: 0x2B1E5A, rim: 0x9B5DE5, trim: 0x7CC6FE, gloss: 0.7, pat: 'galaxy' },
};
export const HATS = [
  { id: 'none', name: 'NO HAT', price: 0 }, { id: 'beanie', name: 'POMPOM BEANIE', price: 80 }, { id: 'propeller', name: 'PROPELLER CAP', price: 120 },
  { id: 'crown', name: 'RECEIPT CROWN', price: 200 }, { id: 'viking', name: 'FOAM VIKING', price: 150 }, { id: 'chef', name: 'CHEF HAT', price: 100 }, { id: 'cone', name: 'PARTY CONE', price: 60 },
];
// Four upgrades with three tiers each (DESIGN.md section 8); the effect numbers live with the shop (P3).
export const UPGRADES = {
  wheels: { name: 'WHEELS', tiers: ['BIG WHEELS', 'CHROME RIMS', 'FLAME RACERS'], price: [800, 2000, 4000] },
  basket: { name: 'BASKET', tiers: ['SIDE RAILS', 'EXTENDED', 'DOUBLE-DECKER'], price: [800, 2000, 4000] },
  bumper: { name: 'BUMPER', tiers: ['RUBBER', 'STEEL BAR', 'SNOWPLOUGH'], price: [800, 2000, 4000] },
  magnet: { name: 'MAGNET', tiers: ['MINI MAGNET', 'HORSESHOE POLE', 'ELECTROMAGNET'], price: [800, 2000, 4000] },
};
// The cart each character pushes: its paint and what makes it theirs.
export function cartSpecFor(look) {
  const id = look;
  if (id === 'penny') return { paint: 'pink', kind: 'cart', tiers: {} };
  if (id === 'granny') return { paint: { body: 0x9B5DE5, rim: 0xD9C3F5, trim: 0xFFD23F, gloss: 0.3 }, kind: 'cart', extra: 'trolleyBag' };
  if (id === 'dad') return { paint: { body: 0x2EC4B6, rim: 0xC9F5EF, trim: 0xFFFFFF, gloss: 0.4 }, kind: 'cart', extra: 'number' };
  if (id === 'queen') return { paint: { body: 0xFF9F1C, rim: 0xFFE0B0, trim: 0xE63946, gloss: 0.3 }, kind: 'cart', extra: 'binder' };
  if (id === 'selfie') return { paint: { body: 0x3A86FF, rim: 0xC9DCFF, trim: 0xFF4FD8, gloss: 0.5 }, kind: 'cart', extra: 'ringLight' };
  if (id === 'bubba') return { paint: { body: 0x8AC926, rim: 0xE2F5C0, trim: 0x2A2440, gloss: 0.3 }, kind: 'flatbed' };
  if (id === 'gramps') return { paint: { body: 0xE63946, rim: 0xFFFFFF, trim: 0xFFD23F, gloss: 0.6 }, kind: 'scooter' };
  return { paint: 'pink', kind: 'cart' };
}

// Writes the cart into builder B with bones first..first+5. spec: { paint (key or object), kind ('cart' |
// 'flatbed' | 'scooter'), tiers: { wheels, basket, bumper, magnet } (0-3), extra }. Returns { pivots, parents,
// grips: [[x, y, z] left, right], charZ (where the pusher stands), seat (seated height or 0), basketY }.
export function buildCart(B, first, spec = {}) {
  const P = typeof spec.paint === 'object' ? spec.paint : PAINTS[spec.paint || 'pink'], t = spec.tiers || {};
  const b = (k) => first + CART_BONES[k], steel = 0xDDE3EA, dark = 0x3A3550, ink = 0x2A1A3A;
  const gl = [0, 0, P.gloss, 0], glS = [0, 0, 0.8, 0];
  const pivots = [[0, 0.3, 0], [0.42, 0.24, 0.52], [-0.42, 0.24, 0.52], [0.42, 0.24, -0.52], [-0.42, 0.24, -0.52], [0, 0.95, 0.7]];
  const parents = [-1, first, first, first, first, first];
  if (spec.kind === 'scooter') return scooter(B, first, P, pivots, parents);
  const flat = spec.kind === 'flatbed';
  bind(B, b('body'), gl, (x, y) => 1 - 0.22 * Math.max(0, Math.min(1, (0.62 - y) / 0.2)) * (Math.abs(x) < 0.45 ? 1 : 0.3));
  const panelTex = P.pat ? [4, PAT[P.pat], P.gloss * 0.5, 0] : [4, PAT.grid, P.gloss * 0.4, 0];
  if (!flat) {
    // the basket: floor, four panels (thick, solid, embossed), a fat rim on top
    const hw = 0.5, hl = 0.7, y0 = 0.44, wallH = 0.46 + (t.basket >= 2 ? 0.14 : 0);
    at(B, 0, y0 - 0.04, 0); box(B, hw * 2 - 0.04, 0.06, hl * 2 - 0.04, mix(P.body, ink, 0.35), { bevel: 0.2 });
    for (const s of [1, -1]) { at(B, s * hw, y0, 0); box(B, 0.05, wallH, hl * 2, P.body, { bevel: 0.25, sides: panelTex, uvs: [3, 1] }); }
    at(B, 0, y0, hl); box(B, hw * 2, wallH, 0.05, P.body, { bevel: 0.25, sides: panelTex, uvs: [2, 1] });
    at(B, 0, y0, -hl); box(B, hw * 2, wallH, 0.05, P.body, { bevel: 0.25, sides: panelTex, uvs: [2, 1] });
    bind(B, b('body'), [0, 0, Math.max(0.5, P.gloss), 0], null);
    const ry = y0 + wallH + 0.01;
    at(B, 0, 0, 0); tube(B, [[hw, ry, -hl], [hw, ry, hl], [-hw, ry, hl], [-hw, ry, -hl], [hw, ry, -hl]], 0.045, P.rim, { seg: 8 });
    // the child seat folded down at the back, in a contrasting plastic
    at(B, 0, ry - 0.03, -hl + 0.12, 0, -1.15); box(B, 0.62, 0.3, 0.035, P.trim, { bevel: 0.4 });
    for (const s of [1, -1]) { at(B, s * 0.17, ry - 0.02, -hl + 0.2, 0, -1.15); ring(B, 0.06, 0.06, 0.012, 0.03, mix(P.trim, ink, 0.25), { seg: 10 }); }
    if (t.basket >= 1) for (const s of [1, -1]) { at(B, 0, 0, 0); tube(B, [[s * (hw + 0.07), ry + 0.12, -hl + 0.05], [s * (hw + 0.07), ry + 0.12, hl - 0.05]], 0.03, steel, { seg: 6, caps: 'round' }); for (const z of [-0.45, 0.45]) tube(B, [[s * (hw + 0.07), ry + 0.12, z], [s * hw, ry, z]], 0.02, steel, { seg: 5 }); }
    if (t.basket >= 3) {        // a second deck on four posts
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { at(B, 0, 0, 0); tube(B, [[x * (hw - 0.02), ry, z * (hl - 0.02)], [x * (hw - 0.02), ry + 0.55, z * (hl - 0.02)]], 0.025, steel, { seg: 6 }); }
      at(B, 0, 0, 0); tube(B, [[hw, ry + 0.55, -hl], [hw, ry + 0.55, hl], [-hw, ry + 0.55, hl], [-hw, ry + 0.55, -hl], [hw, ry + 0.55, -hl]], 0.035, P.rim, { seg: 8 });
    }
  } else {
    // Big Bubba's flatbed: a deck on a heavy chassis, a tall U handle
    at(B, 0, 0.36, 0); box(B, 1.12, 0.1, 1.5, P.body, { bevel: 0.25, top: mix(P.body, 0xFFFFFF, 0.15), lid: [4, PAT.grid, 0.2, 0] });
    at(B, 0, 0.26, 0); box(B, 0.9, 0.1, 1.3, dark, { bevel: 0.3 });
    for (const s of [1, -1]) { at(B, s * 0.56, 0.46, 0); box(B, 0.04, 0.06, 1.5, P.trim, { bevel: 0.3 }); }
  }
  // the frame: side rails low down, the bottom tray, uprights to the handle
  bind(B, b('body'), glS, null);
  at(B, 0, 0, 0);
  for (const s of [1, -1]) {
    tube(B, [[s * 0.42, 0.24, 0.58], [s * 0.42, 0.24, -0.6], [s * 0.44, 0.3, -0.72]], 0.04, P.body, { seg: 8, caps: 'round' });
    if (!flat) tube(B, [[s * 0.42, 0.24, -0.6], [s * 0.48, 0.42, -0.69]], 0.035, P.body, { seg: 8 });
    tube(B, [[s * 0.47, flat ? 0.4 : 0.9, -0.72], [s * 0.44, 1.02, -0.88]], 0.036, steel, { seg: 8, caps: 'round' });
    if (flat) tube(B, [[s * 0.47, 0.4, -0.72], [s * 0.47, 0.92, -0.74]], 0.04, steel, { seg: 8 });
  }
  if (!flat) { at(B, 0, 0.22, -0.02); box(B, 0.78, 0.03, 1.08, steel, { bevel: 0.3, lid: [4, PAT.grid, 0.6, 0] }); }
  // the handle: a steel bar with a fat grip in the owner's colour
  at(B, 0, 0, 0); tube(B, [[0.46, 1.02, -0.88], [-0.46, 1.02, -0.88]], 0.034, steel, { seg: 8, caps: 'round' });
  bind(B, b('body'), [0, 0, 0.3, 0], null);
  tube(B, [[0.34, 1.02, -0.88], [-0.34, 1.02, -0.88]], 0.052, spec.grip || P.grip || P.body, { seg: 10, caps: 'round' });
  // the bumper: rubber that glows when the dash is ready (negative emissive = driven by the material's glow)
  bindBumper(B, b, P, t.bumper || 0, flat);
  // casters
  for (const [k, x, z] of [['wFL', 0.42, 0.52], ['wFR', -0.42, 0.52], ['wBL', 0.42, -0.52], ['wBR', -0.42, -0.52]]) caster(B, b(k), x, z, t.wheels || 0, P);
  // the magnet upgrades sit on the front of the basket
  if (t.magnet) magnet(B, b, t.magnet);
  if (spec.extra) rivalExtra(B, b, spec.extra, P);
  return { pivots, parents, grips: [[0.27, 1.02, -0.88], [-0.27, 1.02, -0.88]], charZ: -1.32, seat: 0, basketY: flat ? 0.41 : 0.48 };
}

function bindBumper(B, b, P, tier, flat) {
  const z = flat ? 0.78 : 0.75, y = flat ? 0.36 : 0.42;
  bind(B, b('body'), [0, 0, 0.3, -1], null);
  if (tier === 3) {               // a snowplough: a curved blade in hazard stripes
    bind(B, b('body'), [4, PAT.hazard, 0.4, -0.5], null);
    at(B, 0, 0, 0); for (let i = 0; i < 2; i++) tube(B, Array.from({ length: 7 }, (_, k) => { const a = (k / 6 - 0.5) * 1.6; return [Math.sin(a) * 0.62, y + 0.06 + i * 0.2, z + 0.12 + Math.cos(a) * 0.22 - 0.22]; }), 0.11, 0xFFD23F, { seg: 6, flat: [1, 0.35] });
    return;
  }
  const r = tier === 1 ? 0.075 : tier === 2 ? 0.05 : 0.06;
  const pts = Array.from({ length: 7 }, (_, k) => { const a = (k / 6 - 0.5) * 1.9; return [Math.sin(a) * 0.55, y, z + Math.cos(a) * 0.08 - 0.08]; });
  at(B, 0, 0, 0); tube(B, pts, r, tier === 2 ? 0xDDE3EA : tier === 1 ? 0x2A2440 : P.trim, { seg: 8, caps: 'round' });
  if (tier === 2) for (const x of [-0.3, 0, 0.3]) { at(B, x, y, z + 0.035); ellipsoid(B, 0.02, 0.02, 0.012, 0x2A2440, { seg: 6, rings: 4 }); }
}

function caster(B, bone, x0, z, tier, P) {
  const x = x0 * (tier >= 1 ? 1.22 : 1), r = tier >= 1 ? 0.16 + (tier >= 3 ? 0.03 : 0) : 0.12, w = tier >= 3 ? 0.09 : 0.07, wheelC = tier >= 3 ? 0xE63946 : 0x2A2440;
  bind(B, bone, [0, 0, 0.6, 0], null);
  at(B, x, 0.24, z); cyl(B, 0.04, 0.04, 0.05, 0xDDE3EA, { seg: 8 });
  if (tier >= 1) { at(B, 0, 0, 0); tube(B, [[x0 * 0.98, 0.26, z], [x, 0.26, z]], 0.03, 0xDDE3EA, { seg: 6 }); }
  at(B, x, r + 0.02, z - 0.03); box(B, w + 0.05, 0.2 - r * 0.4, 0.05, 0xDDE3EA, { bevel: 0.3 });
  bind(B, bone, [0, 0, 0.25, 0], null);
  at(B, x, r, z - 0.04, 0, 0, Math.PI / 2); cyl(B, r, r, w, wheelC, { seg: 14, mid: true, top: tier >= 2 ? 0xDDE3EA : 0x5A5468, bottom: tier >= 2 ? 0xDDE3EA : 0x5A5468, side: tier >= 3 ? [4, PAT.flames, 0.3, 0] : undefined });
  if (tier >= 2) for (const s of [1, -1]) { at(B, x + s * (w / 2 + 0.004), r, z - 0.04, 0, 0, Math.PI / 2); cyl(B, r * 0.55, r * 0.5, 0.012, tier >= 3 ? 0xFFD23F : 0xF4F6FA, { seg: 10, mid: true, lid: [0, 0, 1, 0] }); }
}

function magnet(B, b, tier) {
  bind(B, b('swing'), [0, 0, 0.5, 0], null);
  if (tier === 1) { at(B, 0, 0.96, 0.74); ring(B, 0.09, 0.08, 0.035, 0.06, 0xE63946, { seg: 12 }); at(B, -0.075, 0.9, 0.74); box(B, 0.05, 0.05, 0.06, 0xDDE3EA, { bevel: 0.2 }); at(B, 0.075, 0.9, 0.74); box(B, 0.05, 0.05, 0.06, 0xDDE3EA, { bevel: 0.2 }); return; }
  if (tier === 2) {
    at(B, 0, 0, 0); tube(B, [[0, 0.92, 0.66], [0, 1.6, 0.7], [0, 1.65, 0.95]], 0.03, 0xDDE3EA, { seg: 6, caps: 'round' });
    at(B, 0, 1.5, 1.0, 0, 0, Math.PI); ring(B, 0.16, 0.14, 0.05, 0.08, 0xE63946, { seg: 14 });
    for (const s of [1, -1]) { at(B, s * 0.15, 1.42, 1.0); box(B, 0.08, 0.08, 0.08, 0xDDE3EA, { bevel: 0.2 }); }
    return;
  }
  at(B, 0, 0, 0); tube(B, [[0, 0.92, 0.66], [0, 1.75, 0.72], [0, 1.8, 1.05]], 0.04, 0x5A5468, { seg: 6, caps: 'round' });
  at(B, 0, 1.55, 1.08); cyl(B, 0.3, 0.3, 0.16, 0x5A5468, { seg: 18, top: 0x7CC6FE, lid: [0, 0, 0.6, 0.6], bottom: 0x7CC6FE });
  at(B, 0, 1.6, 1.08); lathe(B, [[0.31, 0], [0.33, 0.03], [0.31, 0.06]], 0xE9B949, { seg: 18 });
}

function rivalExtra(B, b, what, P) {
  if (what === 'trolleyBag') {         // Granny's tartan trolley bag hangs off the side
    bind(B, b('swing'), [4, PAT.tartan, 0.2, 0], null);
    at(B, 0.62, 0.32, -0.2); box(B, 0.24, 0.5, 0.36, 0xC8323C, { bevel: 0.4, top: 0x2A2440 });
    bind(B, b('swing'), [0, 0, 0.5, 0], null);
    at(B, 0, 0, 0); tube(B, [[0.62, 0.82, -0.2], [0.55, 0.95, -0.2], [0.5, 0.9, -0.2]], 0.02, 0x2A2440, { seg: 5 });
    at(B, 0.62, 0.1, -0.08, 0, 0, Math.PI / 2); cyl(B, 0.08, 0.08, 0.05, 0x2A2440, { seg: 10, mid: true, top: 0xDDE3EA });
  } else if (what === 'number') {      // Sprint Dad's racing number on the front
    bind(B, b('body'), [3, PAT.number, 0.2, 0], null);
    at(B, 0, 0.68, 0.73); box(B, 0.4, 0.4, 0.02, 0xFFFFFF, { bevel: 0.3, mid: true, front: [3, PAT.number, 0.2, 0] });
  } else if (what === 'binder') {      // Coupon Queen's coupon binder clipped to the handle
    bind(B, b('body'), [0, 0, 0.2, 0], null);
    at(B, 0.15, 1.0, -0.84, 0, -0.5); box(B, 0.3, 0.24, 0.07, 0xE63946, { bevel: 0.3 });
    at(B, 0.15, 1.2, -0.92, 0, -0.5); box(B, 0.26, 0.06, 0.03, 0xFFF6D6, { bevel: 0.1, front: [3, PAT.coupons, 0, 0] });
  } else if (what === 'ringLight') {   // Selfie Star's ring light and phone mount on a pole
    bind(B, b('swing'), [0, 0, 0.4, 0], null);
    at(B, 0, 0, 0); tube(B, [[0.35, 0.92, -0.62], [0.35, 1.65, -0.62]], 0.022, 0x2A2440, { seg: 6 });
    bind(B, b('swing'), [0, 0, 0.2, 0.85], null);
    at(B, 0.35, 1.85, -0.6); ring(B, 0.22, 0.22, 0.035, 0.05, 0xFFFFFF, { seg: 20 });
    bind(B, b('swing'), [3, PAT.screen, 0.6, 0.5], null);
    at(B, 0.35, 1.85, -0.58, Math.PI); box(B, 0.1, 0.18, 0.02, 0x2A2440, { bevel: 0.3, mid: true, front: [3, PAT.screen, 0.6, 0.5] });
  }
}

// Turbo Gramps' mobility scooter: a body shell with flame decals, a seat, a tiller with handlebars,
// a cargo basket at the front (the tower stands in it), a chrome exhaust.
function scooter(B, first, P, pivots, parents) {
  const b = (k) => first + CART_BONES[k];
  bind(B, b('body'), [0, 0, 0.6, 0], null);
  at(B, 0, 0.2, -0.25); box(B, 0.72, 0.22, 1.7, P.body, { bevel: 0.45, top: mix(P.body, 0xFFFFFF, 0.1), sides: [4, PAT.flames, 0.4, 0] });
  at(B, 0, 0.4, -0.85); box(B, 0.5, 0.18, 0.46, 0x2A2440, { bevel: 0.45 });
  at(B, 0, 0.58, -1.08); box(B, 0.52, 0.42, 0.12, 0x2A2440, { bevel: 0.45 });
  at(B, 0, 0, 0); tube(B, [[0, 0.32, 0.25], [0, 0.75, 0.05], [0, 0.95, -0.12]], 0.045, 0xDDE3EA, { seg: 8 });
  tube(B, [[0.26, 0.95, -0.2], [0, 0.98, -0.12], [-0.26, 0.95, -0.2]], 0.032, 0x2A2440, { seg: 8, caps: 'round' });
  at(B, 0, 0.93, -0.06); box(B, 0.16, 0.1, 0.08, P.trim, { bevel: 0.3, front: [0, 0, 0.4, 0.4] });
  // the cargo basket at the front
  bind(B, b('body'), [4, PAT.grid, 0.4, 0], null);
  at(B, 0, 0.42, 0.25); box(B, 0.86, 0.4, 0.7, 0xDDE3EA, { bevel: 0.2, sides: [4, PAT.grid, 0.5, 0], uvs: [2, 1] });
  bind(B, b('body'), [0, 0, 0.9, 0], null);
  at(B, 0, 0, 0); tube(B, [[-0.28, 0.24, -1.15], [-0.32, 0.3, -1.3], [-0.3, 0.38, -1.42]], 0.05, 0xDDE3EA, { seg: 8, caps: 'flat' });
  at(B, -0.3, 0.38, -1.42, 0, -1.2); cyl(B, 0.06, 0.07, 0.04, 0x2A2440, { seg: 10 });
  bindBumper(B, b, P, 0, false);
  for (const [k, x, z] of [['wFL', 0.32, 0.45], ['wFR', -0.32, 0.45], ['wBL', 0.34, -0.85], ['wBR', -0.34, -0.85]]) {
    bind(B, b(k), [0, 0, 0.3, 0], null);
    at(B, x, 0.14, z, 0, 0, Math.PI / 2); cyl(B, 0.14, 0.14, 0.09, 0x2A2440, { seg: 14, mid: true, top: 0xFFD23F, bottom: 0xFFD23F });
  }
  pivots[1] = [0.32, 0.2, 0.45]; pivots[2] = [-0.32, 0.2, 0.45]; pivots[3] = [0.34, 0.2, -0.85]; pivots[4] = [-0.34, 0.2, -0.85];
  return { pivots, parents, grips: [[0.24, 0.95, -0.2], [-0.24, 0.95, -0.2]], charZ: -0.9, seat: 0.5, basketY: 0.46 };
}

// A cosmetic hat on Penny's head (bone `head`), placed on the crown: hy is the head centre, r its radii.
export function buildHat(B, bone, id, hy, r) {
  bind(B, bone, [0, 0, 0.35, 0], null);
  const top = hy + r[1] * 0.92;
  if (id === 'beanie') { at(B, 0, hy + r[1] * 0.35, 0); ellipsoid(B, r[0] * 1.12, r[1] * 0.78, r[2] * 1.14, 0x3A86FF, { seg: 18, rings: 10, keep: (x, y) => y > hy + r[1] * 0.38, colorAt: (x, y) => y < 0.1 ? 0xFFFFFF : undefined }); at(B, 0, top + 0.14, -0.02); ellipsoid(B, 0.07, 0.07, 0.07, 0xFFFFFF, { seg: 10, rings: 8 }); }
  else if (id === 'propeller') { at(B, 0, hy + r[1] * 0.4, 0); ellipsoid(B, r[0] * 1.1, r[1] * 0.7, r[2] * 1.12, 0xE63946, { seg: 18, rings: 10, keep: (x, y) => y > hy + r[1] * 0.42, colorAt: (x, y, z) => x > 0 ? 0xFFD23F : undefined }); at(B, 0, top + 0.06, 0); cyl(B, 0.012, 0.012, 0.08, 0x2A2440, { seg: 6 }); at(B, 0, top + 0.14, 0, 0.4); box(B, 0.36, 0.012, 0.06, 0x3A86FF, { bevel: 0.4, mid: true }); }
  else if (id === 'crown') { at(B, 0, top - 0.05, 0); cyl(B, r[0] * 0.75, r[0] * 0.8, 0.12, 0xFFFDF6, { seg: 16, top: false, side: [4, PAT.coupons, 0, 0] }); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; at(B, Math.sin(a) * r[0] * 0.78, top + 0.1, Math.cos(a) * r[0] * 0.78); ellipsoid(B, 0.03, 0.05, 0.03, 0xFFD23F, { seg: 6, rings: 4 }); } }
  else if (id === 'viking') { at(B, 0, hy + r[1] * 0.35, 0); ellipsoid(B, r[0] * 1.12, r[1] * 0.8, r[2] * 1.14, 0xE9B949, { seg: 18, rings: 10, keep: (x, y) => y > hy + r[1] * 0.36 }); at(B, 0, 0, 0); for (const s of [1, -1]) tube(B, [[s * r[0] * 0.95, hy + r[1] * 0.55, 0], [s * r[0] * 1.35, hy + r[1] * 0.9, 0], [s * r[0] * 1.3, hy + r[1] * 1.35, 0]], (u) => 0.055 * (1 - u * 0.85), 0xFFF6EA, { seg: 8, caps: 'round' }); }
  else if (id === 'chef') { at(B, 0, top - 0.08, 0); cyl(B, r[0] * 0.8, r[0] * 0.85, 0.12, 0xFFFFFF, { seg: 16 }); at(B, 0, top + 0.16, 0); ellipsoid(B, r[0] * 1.05, 0.13, r[0] * 1.05, 0xFFFFFF, { seg: 16, rings: 10 }); }
  else if (id === 'cone') { at(B, 0.03, top - 0.05, 0, 0, 0, -0.15); cyl(B, 0.13, 0.0, 0.34, 0xFF4FD8, { seg: 14, side: [4, PAT.stripes, 0, 0] }); at(B, -0.02, top + 0.3, 0); ellipsoid(B, 0.05, 0.05, 0.05, 0xFFD23F, { seg: 8, rings: 6 }); }
}
