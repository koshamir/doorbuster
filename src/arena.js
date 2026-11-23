// DOORBUSTER — arena.js
// Purpose: the sports megastore and the food court (levels 5-6, ART.md section 6): their pieces (list racks, hurdles,
//          cones, delivery boxes, the cake tower, the trampoline) and the look of their objects, each posed every
//          frame from the simulation's clock: gym cushion walls that bulge and punch, punching bags, giant foosball
//          players sliding on their rods, belly bros waddling across, grill strips that shimmer and burst into
//          flame, a gantry of cleavers chopping in a wave.
// Exports: ARENA_PIECES, trampPiece, arenaProp, stallRun
// Depends on: objects.js, render.js, shapes.js and the global THREE.

import { SIGN, signAngle, patrolAt, gloveReach, flameState, cleaverState } from './objects.js';
import { celMaterial } from './render.js';
import { builder, at, bind, box, cyl, ellipsoid, ring, tube, toGeometry } from './shapes.js';

const AL = (g = 0.2, e = 0) => [0, 0, g, e];
const AINK = 0x2A1A3A;

// ---- pieces (built once per kit, like fixtures.js PIECE) -------------------------------------------------------
export const ARENA_PIECES = {
  listrack(B, F, kit) {             // the cage the list item waits on: a frame of bars round a lit plinth, a teal rim
    const food = kit && kit.id === 'food';
    bind(B, 0, AL(0.3)); cyl(B, 0.85, 0.9, 0.35, food ? 0x5C2A1E : 0x2B2D42, { seg: 18, top: 0xF4F7FB });
    bind(B, 0, AL(0.5, 0.85)); at(B, 0, 0.35, 0, 0, Math.PI / 2); ring(B, 0.86, 0.86, 0.05, 0.06, 0x00D1C1, { seg: 22 });
    bind(B, 0, AL(0.7)); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; at(B, Math.sin(a) * 0.78, 0.35, Math.cos(a) * 0.78); cyl(B, 0.03, 0.03, 1.5, 0xDDE3EA, { seg: 5 }); }
    at(B, 0, 1.85, 0, 0, Math.PI / 2); ring(B, 0.8, 0.8, 0.04, 0.05, 0xDDE3EA, { seg: 22 });
  },
  hurdle(B) {                       // two white posts and a red-and-white bar at knee height
    bind(B, 0, AL(0.5)); for (const x of [-0.85, 0.85]) { at(B, x, 0, 0); cyl(B, 0.05, 0.05, 0.6, 0xFFFFFF, { seg: 6 }); at(B, x, 0, 0); box(B, 0.12, 0.05, 0.5, 0x2B2D42, { bevel: 0.2 }); }
    for (let i = 0; i < 6; i++) { at(B, -0.75 + i * 0.3, 0.55, 0); box(B, 0.3, 0.12, 0.08, i % 2 ? 0xFFFFFF : 0xE63946, { bevel: 0.1 }); }
  },
  cone(B) { bind(B, 0, AL(0.4)); box(B, 0.5, 0.05, 0.5, 0xFF7F11, { bevel: 0.2 }); at(B, 0, 0.05, 0); cyl(B, 0.22, 0.04, 0.6, 0xFF7F11, { seg: 12 }); bind(B, 0, AL(0.6)); at(B, 0, 0.28, 0); cyl(B, 0.14, 0.12, 0.08, 0xFFFFFF, { seg: 12 }); },
  crates(B) {                       // a stack of delivery boxes in the doorway: tape, FRAGILE stripes, one leaning
    const cols = [0xD9B98A, 0xC9A574, 0xE4C99B];
    for (let i = 0; i < 7; i++) {
      const x = -0.6 + (i % 3) * 0.62, y = Math.floor(i / 3) * 0.62, ry = (i * 0.37) % 0.3 - 0.15;
      bind(B, 0, AL(0.1)); at(B, x, y, (i % 2) * 0.12, ry); box(B, 0.58, 0.58, 0.7, cols[i % 3], { bevel: 0.05, top: 0xE8D2A6 });
      bind(B, 0, AL(0.3)); at(B, x, y + 0.2, (i % 2) * 0.12 + 0.36, ry); box(B, 0.58, 0.08, 0.01, 0xE63946, { bevel: 0 });
    }
  },
  caketower(B) {                    // four tiers of pink and cream cake, drips, candles with lit flames
    for (let t = 0; t < 4; t++) {
      const r = 0.85 - t * 0.17, y = t * 0.42;
      bind(B, 0, AL(0.2)); at(B, 0, y, 0); cyl(B, r, r, 0.4, t % 2 ? 0xFFF1DE : 0xFF8FC7, { seg: 20, top: 0xFFF6EE });
      bind(B, 0, AL(0.5)); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + t; at(B, Math.sin(a) * r, y + 0.3, Math.cos(a) * r); ellipsoid(B, 0.08, 0.14, 0.08, 0xFFFFFF, { seg: 6, rings: 4 }); }
    }
    bind(B, 0, AL(0.3)); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; at(B, Math.sin(a) * 0.22, 1.68, Math.cos(a) * 0.22); cyl(B, 0.03, 0.03, 0.26, [0x3A86FF, 0xFFD23F, 0x8AC926][i % 3], { seg: 5 }); }
    bind(B, 0, AL(0.3, 1)); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; at(B, Math.sin(a) * 0.22, 1.98, Math.cos(a) * 0.22); ellipsoid(B, 0.04, 0.07, 0.04, 0xFFC93C, { seg: 6, rings: 4 }); }
  },
};
// A trampoline: a round frame on legs, springs, a bright mat with a target ring (it throws the cart 10 m along its arrow).
export function trampPiece(B, rp) {
  const ry = Math.atan2(rp.dx, rp.dz);
  bind(B, 0, AL(0.5)); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; at(B, rp.x + Math.sin(a) * 0.85, 0, rp.z + Math.cos(a) * 0.85); cyl(B, 0.04, 0.04, 0.32, 0x2B2D42, { seg: 5 }); }
  at(B, rp.x, 0.32, rp.z, 0, Math.PI / 2); ring(B, 0.95, 0.95, 0.06, 0.08, 0x3A86FF, { seg: 24 });
  bind(B, 0, AL(0.3)); at(B, rp.x, 0.3, rp.z); cyl(B, 0.82, 0.82, 0.03, 0xFF7F11, { seg: 24, top: 0xFF7F11 });
  bind(B, 0, AL(0.4, 0.4)); at(B, rp.x, 0.33, rp.z, 0, Math.PI / 2); ring(B, 0.45, 0.45, 0.04, 0.01, 0xFFFFFF, { seg: 20 });
  at(B, rp.x + Math.sin(ry) * 0.35, 0.34, rp.z + Math.cos(ry) * 0.35, ry); box(B, 0.25, 0.01, 0.3, 0xFFFFFF, { bevel: 0 });
}

// A food stall counter (the food court's shelves): a counter with a striped front and a lit top, plates and food
// along its top (the sweepable goods stand there), a hanging menu board with the stall's name, paper lanterns.
export function stallRun(B, s, F, putProduct, view, stock, signCell, K) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2, ry = s.horiz ? 0 : Math.PI / 2;
  const P = (u, y, w) => s.horiz ? [s.x + u, y, s.z + w] : [s.x + w, y, s.z - u], put = (u, y, w) => at(B, ...P(u, y, w), ry);
  bind(B, 0, AL(0.2)); put(0, 0, 0); box(B, along, 0.48, depth, F.trim, { bevel: 0.06, top: 0xC98A5B });
  bind(B, 0, AL(0.4)); for (const side of [-1, 1]) { if (!s.sides[side < 0 ? 0 : 1]) continue; for (let j = 0; j < Math.floor(along / 0.6); j++) { put(-along / 2 + 0.3 + j * 0.6, 0.06, side * (depth / 2 + 0.01)); box(B, 0.3, 0.34, 0.02, 0xFFF1DE, { bevel: 0 }); } }
  if (along >= 4) { bind(B, 0, K(signCell, 0.2, 0.35)); for (const side of [-1, 1]) { const [x, , z] = P(0, 0, side * 0.04); at(B, x, 2.3, z, ry + (side > 0 ? 0 : Math.PI)); box(B, Math.min(2.8, along - 0.4), 0.6, 0.04, 0xFFFFFF, { bevel: 0, mid: true, front: K(signCell, 0.2, 0.35) }); } }
  bind(B, 0, AL(0.3, 0.6)); for (let j = 0; j < Math.floor(along / 2.2); j++) { const [x, , z] = P(-along / 2 + 1.1 + j * 2.2, 0, 0); at(B, x, 2.95, z); ellipsoid(B, 0.22, 0.28, 0.22, j % 2 ? 0xD62828 : 0xF4A261, { seg: 8, rings: 6 }); }
  for (let j = 0; j < Math.floor(along / 1.4); j++) { const u = -along / 2 + 0.7 + j * 1.4, [x, , z] = P(u, 0, 0), p = stock[(j * 3 + Math.floor(s.x)) % stock.length]; putProduct(view.gv, p, x, 0.5, z, ry, 0.8); }
}

// ---- the objects' models ----------------------------------------------------------------------------------------
// arenaProp returns { sync(t, dt, draw) } for the kinds this module draws, or null. mesh(B, mats) makes a mesh.
export function arenaProp(view, ob, mesh, atlas) {
  if (ob.kind === 'glove' && ob.look === 'cushion') return cushion(view, ob, mesh);
  if (ob.kind === 'bag') return bag(view, ob, mesh);
  if (ob.kind === 'patrol' && ob.type === 'foos') return foos(view, ob, mesh);
  if (ob.kind === 'patrol' && ob.type === 'belly') return belly(view, ob, mesh);
  if (ob.kind === 'flame') return grill(view, ob, mesh, atlas);
  if (ob.kind === 'cleavers') return cleavers(view, ob, mesh);
  return null;
}
// A gym cushion wall: a fat blue mat in a padded frame; it swells for 0.3 s, then punches out across the lane.
function cushion(view, ob, mesh) {
  const g = new THREE.Group(); g.position.set(ob.gx, 0, ob.gz); g.rotation.y = Math.atan2(ob.dx, ob.dz);
  const F = builder(); bind(F, 0, AL(0.3)); at(F, 0, 0, -0.25); box(F, 2.0, 2.4, 0.4, 0x2B2D42, { bevel: 0.1 });
  g.add(mesh(F));
  const P = builder(); bind(P, 0, AL(0.4)); at(P, 0, 0.3, 0); box(P, 1.7, 1.7, 0.7, 0x3A86FF, { bevel: 0.35 });
  bind(P, 0, AL(0.6)); at(P, 0, 0.3, 0.36); box(P, 1.5, 0.08, 0.02, 0xFFFFFF, { bevel: 0 }); at(P, 0, 1.92, 0.36); box(P, 1.5, 0.08, 0.02, 0xFFFFFF, { bevel: 0 });
  const pad = mesh(P); g.add(pad); view.root.add(g);
  let out = 0;
  return { ob, sync(t, dt, draw) {
    const e = gloveReach(ob, t), u = ob.every ? ((t - ob.delay) % ob.every + ob.every) % ob.every : 9, pre = u > ob.every - 0.3 ? (u - ob.every + 0.3) / 0.3 : 0;
    if (e > 0.05 && !out) { this.snd = 'punch'; this.sx = ob.gx; this.sz = ob.gz; } out = e > 0.05;
    pad.position.z = e * (ob.reach - 0.7); pad.scale.set(1 + pre * 0.12, 1 + pre * 0.12, 1 - pre * 0.25);
    if (e > 0) draw.shadow(ob.gx + ob.dx * (e * ob.reach * 0.5), ob.gz + ob.dz * (e * ob.reach * 0.5), 0.9, e * ob.reach * 0.5 + 0.2, Math.atan2(ob.dx, ob.dz));
  } };
}
// A punching bag: red leather with a black band, on a chain from a steel beam; it swings like a sale sign.
function bag(view, ob, mesh) {
  const outer = new THREE.Group(), inner = new THREE.Group();
  outer.position.set(ob.x, SIGN.H, ob.z); outer.rotation.y = ob.ax ? 0 : -Math.PI / 2;
  const Bm = builder(); bind(Bm, 0, AL(0.5)); at(Bm, 0, 0.18, 0); box(Bm, ob.reach * 2 + 1.5, 0.22, 0.22, 0xC9CED8, { bevel: 0.15 }); outer.add(mesh(Bm));
  const B = builder(), drop = SIGN.CHAIN;
  bind(B, 0, AL(0.6)); at(B, 0, 0, 0); tube(B, [[0, 0, 0], [0, -drop, 0]], 0.04, 0x8E96A8, { seg: 5 });
  bind(B, 0, AL(0.5)); at(B, 0, -drop - SIGN.HT, 0); cyl(B, 0.42, 0.42, SIGN.HT, 0xD62828, { seg: 14, top: 0x2B2D42 });
  at(B, 0, -drop - SIGN.HT * 0.55, 0); cyl(B, 0.44, 0.44, 0.16, 0x2B2D42, { seg: 14 });
  inner.add(mesh(B)); outer.add(inner); view.root.add(outer);
  return { ob, sync(t, dt, draw) {
    const th = signAngle(ob, t); inner.rotation.z = th;
    const lat = SIGN.R * Math.sin(th); draw.shadow(ob.x + ob.ax * lat, ob.z + ob.az * lat, 0.5, 0.5, 0);
  } };
}
// A giant foosball player on its rod: a chunky body in team colours, a big round head, the rod through its chest.
function foos(view, ob, mesh) {
  const a = ob.pts[0], b = ob.pts[ob.pts.length - 1], R = builder();
  bind(R, 0, AL(0.9)); at(R, (a[0] + b[0]) / 2, 1.25, (a[1] + b[1]) / 2, Math.atan2(b[0] - a[0], b[1] - a[1]), Math.PI / 2);
  cyl(R, 0.07, 0.07, Math.hypot(b[0] - a[0], b[1] - a[1]) + 3, 0xDDE3EA, { seg: 8, mid: true });
  view.root.add(mesh(R));
  const red = Math.floor(ob.z / 4) % 2 === 0, P = builder();
  bind(P, 0, AL(0.4)); at(P, 0, 0.25, 0); box(P, 0.8, 1.35, 0.5, red ? 0xE63946 : 0x3A86FF, { bevel: 0.3 });
  bind(P, 0, AL(0.6)); at(P, 0, 0.55, 0.26); box(P, 0.4, 0.4, 0.02, 0xFFFFFF, { bevel: 0 });
  bind(P, 0, AL(0.5)); at(P, 0, 1.6, 0); ellipsoid(P, 0.36, 0.38, 0.36, 0xFFD9B8, { seg: 12, rings: 8 });
  at(P, 0, 1.72, 0); ellipsoid(P, 0.37, 0.22, 0.37, red ? 0x2A1A3A : 0xFFD23F, { seg: 12, rings: 6, cut: 0.5 });
  bind(P, 0, AL(0.3)); at(P, 0, 0, 0.1); box(P, 0.7, 0.3, 0.7, 0x2B2D42, { bevel: 0.3 });
  const body = mesh(P); view.root.add(body);
  const pos = { x: 0, z: 0, h: 0, moving: false };
  let went = true;
  return { ob, sync(t, dt, draw) { patrolAt(ob, t, pos); if (went && !pos.moving) { this.snd = 'clack'; this.sx = pos.x; this.sz = pos.z; } went = pos.moving; body.position.set(pos.x, 0, pos.z); body.rotation.z = Math.sin(t * 7) * 0.04; draw.shadow(pos.x, pos.z, 0.6, 0.45, 0); } };
}
// A belly bro: a huge round belly in a white vest, a burger in each hand, waddling; a dash makes him spin.
function belly(view, ob, mesh) {
  const B = builder();
  bind(B, 0, AL(0.3)); for (const x of [-0.25, 0.25]) { at(B, x, 0, 0); cyl(B, 0.14, 0.12, 0.55, 0x33407A, { seg: 8 }); }
  bind(B, 0, AL(0.4)); at(B, 0, 0.5, 0); ellipsoid(B, 0.72, 0.62, 0.62, 0xFFFFFF, { seg: 16, rings: 10 });
  bind(B, 0, AL(0.3)); at(B, 0, 0.9, 0.42); ellipsoid(B, 0.42, 0.36, 0.2, 0xFFC9A0, { seg: 10, rings: 6 });
  at(B, 0, 1.55, 0); ellipsoid(B, 0.3, 0.32, 0.3, 0xFFC9A0, { seg: 12, rings: 8 });
  at(B, 0, 1.75, -0.02); ellipsoid(B, 0.31, 0.16, 0.31, 0x4A2A16, { seg: 12, rings: 6, cut: 0.5 });
  for (const s of [-1, 1]) { at(B, s * 0.78, 0.95, 0.2); ellipsoid(B, 0.16, 0.32, 0.16, 0xFFC9A0, { seg: 8, rings: 6 }); bind(B, 0, AL(0.3)); at(B, s * 0.82, 1.25, 0.32); cyl(B, 0.2, 0.22, 0.2, 0xE3A35A, { seg: 10, top: 0x6B3A1E }); bind(B, 0, AL(0.3)); }
  const g = mesh(B); view.root.add(g);
  const pos = { x: 0, z: 0, h: 0, moving: false };
  return { ob, sync(t, dt, draw) {
    patrolAt(ob, t, pos);
    g.position.set(pos.x, Math.abs(Math.sin(t * 6)) * 0.06, pos.z); g.rotation.set(0, pos.h + (ob.spinT > t ? (ob.spinT - t) * 16 : 0), Math.sin(t * 6) * 0.07);
    draw.shadow(pos.x, pos.z, 0.8, 0.7, 0);
  } };
}
// A grill strip across the alley: a black steel grill with glowing bars; it shimmers 0.6 s before it bursts into a
// wall of flame tongues (orange with yellow cores, flickering), then dies down to embers.
function grill(view, ob, mesh) {
  const lamp = celMaterial({ rim: 0.2 }); view.own.push(lamp);
  const G = builder(), wide = ob.hx >= ob.hz, L = (wide ? ob.hx : ob.hz) * 2, W = (wide ? ob.hz : ob.hx) * 2;
  bind(G, 0, AL(0.4)); at(G, ob.x, 0, ob.z, wide ? 0 : Math.PI / 2); box(G, L, 0.12, W - 0.3, 0x2B2D42, { bevel: 0.05 });
  view.root.add(mesh(G));
  const H = builder(); bind(H, 0, [0, 0, 0.2, -1]);
  for (let i = 0; i < Math.round(L / 0.5); i++) { const u = -L / 2 + 0.25 + i * 0.5; at(H, ob.x + (wide ? u : 0), 0.12, ob.z + (wide ? 0 : u), wide ? 0 : Math.PI / 2); box(H, 0.06, 0.02, W - 0.5, 0xFF7F11, { bevel: 0 }); }
  const bars = new THREE.Mesh(toGeometry(H, { groups: false, hull: false }), lamp); bars.frustumCulled = false; view.root.add(bars);
  const F = builder(), n = Math.round(L / 0.7);
  bind(F, 0, [0, 0, 0.1, 1]);
  for (let i = 0; i < n; i++) { const u = -L / 2 + 0.35 + i * 0.7, x = ob.x + (wide ? u : 0), z = ob.z + (wide ? 0 : u); at(F, x, 0.1, z); cyl(F, 0.32, 0.02, 1.4 + (i % 3) * 0.3, 0xFF7F11, { seg: 7 }); at(F, x, 0.1, z); cyl(F, 0.16, 0.02, 0.9, 0xFFE27A, { seg: 6 }); }
  const fire = new THREE.Mesh(toGeometry(F, { groups: false, hull: false }), lamp); fire.frustumCulled = false; view.root.add(fire);
  let was = 0;
  return { ob, sync(t) {
    const st = flameState(ob, t), u = ((t / ob.period + ob.phase) % 1 + 1) % 1 * ob.period;
    const k = st === 2 ? Math.min(1, u / 0.12) * (0.85 + 0.15 * Math.sin(t * 40)) : 0;
    if (st === 2 && was !== 2) { this.snd = 'sizzle'; this.sx = ob.x; this.sz = ob.z; } was = st;
    fire.visible = k > 0.02; fire.scale.set(1, k, 1); fire.position.y = 0;
    const heat = st === 2 ? 1.4 : st === 1 ? 0.4 + 0.5 * Math.abs(Math.sin(t * 22)) : 0.15;
    lamp.uniforms.uGlow.value.set(heat * 1.0, heat * 0.45, heat * 0.1);
  } };
}
// The cleaver gantry: two posts and a beam across the alley; each cleaver hangs from its hinge, lifts for the wind-up
// and chops down in turn (the wave runs across the alley).
function cleavers(view, ob, mesh) {
  const G = builder(), half = ob.reach + 0.6, ry = ob.ax ? 0 : Math.PI / 2;
  bind(G, 0, AL(0.4));
  for (const s of [-1, 1]) { at(G, ob.x + ob.ax * s * half, 0, ob.z + ob.az * s * half); box(G, 0.3, 3.6, 0.3, 0x2B2D42, { bevel: 0.1 }); }
  at(G, ob.x, 3.4, ob.z, ry); box(G, half * 2 + 0.3, 0.3, 0.3, 0x5C2A1E, { bevel: 0.1 });
  view.root.add(mesh(G));
  const blades = [];
  for (let i = 0; i < ob.n; i++) {
    const off = (i - (ob.n - 1) / 2) * ob.gap, hinge = new THREE.Group();
    hinge.position.set(ob.x + ob.ax * off, 3.25, ob.z + ob.az * off); hinge.rotation.y = ry;
    const C = builder();
    bind(C, 0, AL(0.3)); at(C, 0, -0.5, 0); box(C, 0.12, 0.6, 0.14, 0x6B3A1E, { bevel: 0.3 });
    bind(C, 0, AL(1)); at(C, 0, -2.85, 0); box(C, ob.gap * 0.7, 2.3, 0.06, 0xDDE3EA, { bevel: 0.04, top: 0xFFFFFF });
    at(C, ob.gap * 0.28, -2.4, 0.035); ring(C, 0.1, 0.1, 0.02, 0.01, 0x8E96A8, { seg: 10 });
    const m = mesh(C); hinge.add(m); view.root.add(hinge); blades.push(hinge);
  }
  const prev = [];
  return { ob, sync(t) {
    for (let i = 0; i < ob.n; i++) {
      const st = cleaverState(ob, t, i);
      if (st === 2 && prev[i] !== 2) { this.snd = 'shing'; this.sx = blades[i].position.x; this.sz = blades[i].position.z; } prev[i] = st;
      const u = (((t - i * ob.step) / ob.period + ob.phase) % 1 + 1) % 1 * ob.period;
      blades[i].rotation.x = st === 2 ? 0 : st === 1 ? -1.9 - 0.25 * Math.min(1, (u - ob.period + 0.3) / 0.3) : -Math.min(1.6, (u - ob.down) / 0.25 * 1.6);
    }
  } };
}
