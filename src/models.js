// DOORBUSTER — models.js
// Purpose: procedural geometry. Everything visible is built from three chubby primitives — a
//          chamfered box, a cylinder (or cone) and an ellipsoid — written into a "builder" and
//          turned into one BufferGeometry with vertex colours. No textures, no model files.
// Exports: makeBuilder, place, addBox, addCyl, addBall, toGeometry, cartGeometry, bumperGeometry,
//          beanGeometry, goodGeometry, addShelf, addPiece, pieceGeometry
// Depends on: config.js and the global THREE (only inside toGeometry).
//
// Each vertex carries two normals: `normal` for lighting (flat on box faces, so the toon steps read
// as clean planes) and `onormal`, a smoothed normal shared by all vertices at one position, which the
// outline pass uses to push the hull out without gaps.

import { PAL, GOODS, rgb, mix } from './config.js';

export function makeBuilder() {
  return { pos: [], nor: [], col: [], out: [], m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
}

// Sets where the next primitives go: position, then yaw (about Y), pitch (about X), roll (about Z).
export function place(b, x, y, z, ry = 0, rx = 0, rz = 0) {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Ry * Rx * Rz, row-major
  b.m = [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
  b.t = [x, y, z];
  return b;
}

function push(b, p, n, o, c) {
  const m = b.m, t = b.t;
  b.pos.push(m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]);
  b.nor.push(m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[3] * n[0] + m[4] * n[1] + m[5] * n[2], m[6] * n[0] + m[7] * n[1] + m[8] * n[2]);
  b.out.push(m[0] * o[0] + m[1] * o[1] + m[2] * o[2], m[3] * o[0] + m[4] * o[1] + m[5] * o[2], m[6] * o[0] + m[7] * o[1] + m[8] * o[2]);
  b.col.push(c[0], c[1], c[2]);
}
function unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
// One flat convex face (3 or 4 points), wound to face away from `centre`. outOf(p) gives onormal.
function face(b, pts, c, centre, outOf) {
  const a = pts[0], p1 = pts[1], p2 = pts[2];
  const ux = p1[0] - a[0], uy = p1[1] - a[1], uz = p1[2] - a[2], vx = p2[0] - a[0], vy = p2[1] - a[1], vz = p2[2] - a[2];
  let n = unit([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
  const flip = n[0] * (a[0] - centre[0]) + n[1] * (a[1] - centre[1]) + n[2] * (a[2] - centre[2]) < 0;
  if (flip) n = [-n[0], -n[1], -n[2]];
  for (let i = 1; i + 1 < pts.length; i++) {
    const tri = flip ? [pts[0], pts[i + 1], pts[i]] : [pts[0], pts[i], pts[i + 1]];
    for (const p of tri) push(b, p, n, outOf(p), c);
  }
}

// A chamfered box sitting on y = 0 (centre at h/2). opts.bevel is a share of the smallest side
// (default 0.12, 0 = sharp), opts.top paints the lid a second colour.
export function addBox(b, w, h, d, color, opts = {}) {
  const c = rgb(color), ct = opts.top !== undefined ? rgb(opts.top) : c;
  const hs = [w / 2, h / 2, d / 2];
  const bv = (opts.bevel === undefined ? 0.12 : opts.bevel) * Math.min(w, h, d);
  const cen = [0, h / 2, 0];
  const at = (x, y, z) => [x, y + h / 2, z];
  const outOf = (p) => {
    const q = [p[0], p[1] - h / 2, p[2]], o = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const lim = hs[i] - bv;
      o[i] = bv > 0 ? q[i] - Math.max(-lim, Math.min(lim, q[i])) : Math.sign(q[i]);
    }
    return unit(o);
  };
  const S = [-1, 1];
  for (let ax = 0; ax < 3; ax++) {                       // the six faces
    const b1 = (ax + 1) % 3, b2 = (ax + 2) % 3;
    for (const s of S) {
      const pts = [];
      for (const [s1, s2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const q = [0, 0, 0];
        q[ax] = s * hs[ax]; q[b1] = s1 * (hs[b1] - bv); q[b2] = s2 * (hs[b2] - bv);
        pts.push(at(q[0], q[1], q[2]));
      }
      face(b, pts, ax === 1 && s > 0 ? ct : c, cen, outOf);
    }
  }
  if (bv <= 0) return b;
  for (let ax = 0; ax < 3; ax++) {                       // the twelve edge chamfers
    const b1 = (ax + 1) % 3, b2 = (ax + 2) % 3;         // the edge runs along axis b2
    for (const s of S) for (const s1 of S) {
      const pts = [];
      for (const [k, s2] of [[0, -1], [0, 1], [1, 1], [1, -1]]) {
        const q = [0, 0, 0];
        q[ax] = s * (hs[ax] - (k ? bv : 0)); q[b1] = s1 * (hs[b1] - (k ? 0 : bv)); q[b2] = s2 * (hs[b2] - bv);
        pts.push(at(q[0], q[1], q[2]));
      }
      face(b, pts, c, cen, outOf);
    }
  }
  for (const sx of S) for (const sy of S) for (const sz of S) {   // the eight corners
    face(b, [at(sx * hs[0], sy * (hs[1] - bv), sz * (hs[2] - bv)), at(sx * (hs[0] - bv), sy * hs[1], sz * (hs[2] - bv)),
      at(sx * (hs[0] - bv), sy * (hs[1] - bv), sz * hs[2])], c, cen, outOf);
  }
  return b;
}

// A cylinder or cone standing on y = 0: bottom radius r0, top radius r1, height h.
// opts.seg (default 10), opts.top = lid colour, opts.bottom = true adds the bottom cap.
export function addCyl(b, r0, r1, h, color, opts = {}) {
  const c = rgb(color), ct = opts.top !== undefined ? rgb(opts.top) : c, seg = opts.seg || 10;
  const slope = (r0 - r1) / h;
  const ring = (i, y, r) => { const a = i / seg * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
  const sideN = (i) => { const a = i / seg * Math.PI * 2; return unit([Math.cos(a), slope, Math.sin(a)]); };
  const outTop = (i) => { const a = i / seg * Math.PI * 2; return unit([Math.cos(a), 0.7, Math.sin(a)]); };
  const outBot = (i) => { const a = i / seg * Math.PI * 2; return unit([Math.cos(a), opts.bottom ? -0.7 : 0, Math.sin(a)]); };
  for (let i = 0; i < seg; i++) {
    const j = i + 1;
    const a0 = ring(i, 0, r0), a1 = ring(j, 0, r0), t0 = ring(i, h, r1), t1 = ring(j, h, r1);
    // side: two triangles, smooth normals; wound outward (counter-clockwise seen from outside)
    push(b, a0, sideN(i), outBot(i), c); push(b, t0, sideN(i), outTop(i), c); push(b, t1, sideN(j), outTop(j), c);
    push(b, a0, sideN(i), outBot(i), c); push(b, t1, sideN(j), outTop(j), c); push(b, a1, sideN(j), outBot(j), c);
    if (r1 > 0.001) { push(b, [0, h, 0], [0, 1, 0], [0, 1, 0], ct); push(b, t1, [0, 1, 0], outTop(j), ct); push(b, t0, [0, 1, 0], outTop(i), ct); }
    if (opts.bottom) { push(b, [0, 0, 0], [0, -1, 0], [0, -1, 0], c); push(b, a0, [0, -1, 0], outBot(i), c); push(b, a1, [0, -1, 0], outBot(j), c); }
  }
  return b;
}

// An ellipsoid centred on the current place, radii rx, ry, rz. opts.seg (8), opts.rings (5).
export function addBall(b, rx, ry, rz, color, opts = {}) {
  const c = rgb(color), seg = opts.seg || 8, rings = opts.rings || 5;
  const pt = (i, j) => {
    const th = i / rings * Math.PI, ph = j / seg * Math.PI * 2;
    return [rx * Math.sin(th) * Math.cos(ph), ry * Math.cos(th), rz * Math.sin(th) * Math.sin(ph)];
  };
  const nr = (p) => unit([p[0] / (rx * rx), p[1] / (ry * ry), p[2] / (rz * rz)]);
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const p00 = pt(i, j), p01 = pt(i, j + 1), p10 = pt(i + 1, j), p11 = pt(i + 1, j + 1);
    if (i > 0) for (const p of [p00, p01, p11]) push(b, p, nr(p), nr(p), c);
    if (i < rings - 1) for (const p of [p00, p11, p10]) push(b, p, nr(p), nr(p), c);
  }
  return b;
}

// Builds the BufferGeometry. Two groups cover the whole range so a mesh with the material array
// [toon, outline] draws the lit pass and the outline pass from one object.
export function toGeometry(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute('onormal', new THREE.Float32BufferAttribute(b.out, 3));
  const n = b.pos.length / 3;
  g.addGroup(0, n, 0);
  g.addGroup(0, n, 1);
  g.computeBoundingSphere();
  return g;
}

// ---- Models. Forward is +z, the origin is on the floor under the middle of the basket. ----------

// The cart: an open basket with thick walls, a chunky rim and ribs, big wheels and a handle.
// The basket floor is at y = 0.48; goods stack from there.
export function cartGeometry(color) {
  const b = makeBuilder(), dark = mix(color, PAL.outline, 0.45), light = mix(color, PAL.white, 0.42);
  place(b, 0, 0.26, 0); addBox(b, 0.84, 0.12, 1.3, PAL.night, { bevel: 0.3 });            // chassis
  place(b, 0, 0.38, 0); addBox(b, 1.0, 0.1, 1.4, color, { bevel: 0.2, top: dark });       // basket floor, dark inside
  for (const x of [-0.46, 0.46]) { place(b, x, 0.42, 0); addBox(b, 0.1, 0.52, 1.4, color, { bevel: 0.2 }); }
  for (const z of [-0.66, 0.66]) { place(b, 0, 0.42, z); addBox(b, 0.84, 0.52, 0.1, color, { bevel: 0.2 }); }
  for (const x of [-0.4, 0.4]) { place(b, x, 0.48, 0); addBox(b, 0.03, 0.42, 1.22, dark, { bevel: 0 }); }           // the inside is darker: an empty cart reads as a basket
  for (const z of [-0.6, 0.6]) { place(b, 0, 0.48, z); addBox(b, 0.8, 0.42, 0.03, dark, { bevel: 0 }); }
  for (const x of [-0.49, 0.49]) { place(b, x, 0.9, 0); addBox(b, 0.22, 0.17, 1.62, light, { bevel: 0.3 }); }      // a chunky lighter rim
  for (const z of [-0.71, 0.71]) { place(b, 0, 0.9, z); addBox(b, 0.84, 0.17, 0.22, light, { bevel: 0.3 }); }
  for (const z of [-0.4, 0, 0.4]) for (const x of [-0.53, 0.53]) {                        // ribs
    place(b, x, 0.44, z); addBox(b, 0.07, 0.46, 0.12, PAL.white, { bevel: 0.3 });
  }
  for (const z of [-0.5, 0.5]) for (const x of [-0.46, 0.46]) {                           // wheels
    place(b, x - 0.07, 0.2, z, 0, 0, -Math.PI / 2); addCyl(b, 0.2, 0.2, 0.14, PAL.night, { seg: 10, bottom: true, top: PAL.steel });
  }
  for (const x of [-0.42, 0.42]) { place(b, x, 0.9, -0.74, 0, -0.35, 0); addBox(b, 0.08, 0.5, 0.08, PAL.steel, { bevel: 0.3 }); }
  return toGeometry(b);
}
// The front bumper and the handle bar are one mesh that glows when the dash is ready: the chase
// camera sees the handle, everyone else sees the bumper.
export function bumperGeometry() {
  const b = makeBuilder();
  place(b, 0, 0.44, 0.76); addBox(b, 1.08, 0.2, 0.16, PAL.sale, { bevel: 0.35 });
  place(b, 0, 1.3, -0.92); addBox(b, 1.1, 0.14, 0.14, PAL.sale, { bevel: 0.35 });
  return toGeometry(b);
}

// The shopper "bean": capsule body, ball head, dot eyes, ball hands, and one large accessory that
// tells the characters apart from above and behind (ART.md 4). Stands behind the cart handle.
export function beanGeometry(charId, color, skin = PAL.skin) {
  const b = makeBuilder(), wide = charId === 'bro' ? 1.3 : 1;
  const ball = (x, y, z, rx, ry, rz, c, seg) => { place(b, x, y, z); addBall(b, rx, ry, rz, c, { seg: seg || 8, rings: 5 }); };
  ball(0, 0.58, 0, 0.36 * wide, 0.56, 0.32 * wide, color, 10);
  ball(0, 1.32, 0.02, 0.28, 0.28, 0.28, skin, 10);
  for (const x of [-0.11, 0.11]) ball(x, 1.36, 0.26, 0.045, 0.06, 0.03, PAL.outline, 6);
  for (const x of [-0.32 * wide, 0.32 * wide]) ball(x, 1.0, 0.36, 0.1, 0.1, 0.1, skin, 6);
  if (charId === 'player') {                       // cream beanie with a pom-pom (breaks up the pink of body and cart)
    ball(0, 1.46, 0, 0.3, 0.2, 0.3, PAL.wall, 10); ball(0, 1.68, -0.02, 0.12, 0.12, 0.12, color, 6);
    place(b, 0, 1.36, 0); addCyl(b, 0.3, 0.3, 0.08, PAL.white, { seg: 10 });
  } else if (charId === 'granny') {                // shawl and a hair bun
    ball(0, 0.92, -0.12, 0.44, 0.3, 0.36, PAL.mint, 8); ball(0, 1.42, -0.2, 0.17, 0.17, 0.17, PAL.steel, 6);
    ball(0, 1.5, 0, 0.27, 0.14, 0.27, PAL.steel, 8);
  } else if (charId === 'dad') {                   // cap with a visor, tracksuit stripe
    ball(0, 1.48, 0, 0.29, 0.16, 0.29, PAL.white, 8);
    place(b, 0, 1.44, 0.28); addBox(b, 0.36, 0.05, 0.24, PAL.white, { bevel: 0.3 });
    place(b, 0, 0.7, 0); addCyl(b, 0.37, 0.37, 0.09, PAL.white, { seg: 10 });
  } else if (charId === 'queen') {                 // big hair, megaphone, a fan of coupons
    ball(0, 1.56, -0.06, 0.34, 0.26, 0.34, PAL.red, 8);
    place(b, 0.36, 1.02, 0.4, 0, Math.PI / 2, 0); addCyl(b, 0.07, 0.2, 0.36, PAL.white, { seg: 8, top: PAL.danger });
    place(b, -0.34, 1.1, 0.42, 0.3, 0, 0.3); addBox(b, 0.3, 0.26, 0.04, PAL.sale, { bevel: 0 });
  } else if (charId === 'selfie') {                // phone held high, bow on the head
    place(b, 0.3, 1.5, 0.3, 0, 0.3, 0); addBox(b, 0.16, 0.28, 0.04, PAL.night, { bevel: 0.2, top: PAL.sky });
    ball(-0.12, 1.62, 0, 0.13, 0.1, 0.08, PAL.player === color ? PAL.white : PAL.coral, 6); ball(0.12, 1.62, 0, 0.13, 0.1, 0.08, PAL.coral, 6);
  } else if (charId === 'bro') {                   // headband
    place(b, 0, 1.38, 0.02); addCyl(b, 0.29, 0.29, 0.1, PAL.white, { seg: 10 });
  } else if (charId === 'hat') {                   // crowd variant: a little hat
    place(b, 0, 1.52, 0); addCyl(b, 0.2, 0.16, 0.14, PAL.night, { seg: 8 });
    place(b, 0, 1.5, 0); addCyl(b, 0.32, 0.32, 0.04, PAL.night, { seg: 8 });
  }
  return toGeometry(b);
}

// ---- Goods: 1-3 primitives each, a coloured label, the lid telling the kinds apart from above. ----
// Origin on the floor under the middle, label side toward +z. Sizes follow GOODS[].dims.
const GOOD_BUILD = {
  can(b) { addCyl(b, 0.19, 0.19, 0.44, PAL.red, { top: PAL.steel }); place(b, 0, 0.12, 0); addCyl(b, 0.2, 0.2, 0.2, PAL.wall, { seg: 10 }); },
  soda(b) {
    addCyl(b, 0.16, 0.16, 0.34, PAL.teal, { seg: 8 }); place(b, 0, 0.34, 0); addCyl(b, 0.16, 0.06, 0.14, PAL.teal, { seg: 8 });
    place(b, 0, 0.48, 0); addCyl(b, 0.07, 0.07, 0.08, PAL.danger, { seg: 8 });
  },
  chips(b) { addBox(b, 0.42, 0.44, 0.24, PAL.orange, { bevel: 0.3 }); place(b, 0, 0.42, 0); addBox(b, 0.42, 0.08, 0.07, PAL.danger, { bevel: 0.2 }); },
  roll(b) { addCyl(b, 0.21, 0.21, 0.4, PAL.white, { top: PAL.sky }); place(b, 0, 0.01, 0); addCyl(b, 0.07, 0.07, 0.4, PAL.brown, { seg: 6 }); },
  cereal(b) { addBox(b, 0.4, 0.54, 0.2, PAL.green, { top: PAL.wall }); place(b, 0, 0.16, 0.1); addBox(b, 0.26, 0.24, 0.03, PAL.white, { bevel: 0.2 }); },
  phone(b) { addBox(b, 0.36, 0.48, 0.18, PAL.blue, { top: PAL.white }); place(b, 0, 0.1, 0.09); addBox(b, 0.2, 0.3, 0.02, PAL.shadow, { bevel: 0.2 }); },
  game(b) { addBox(b, 0.4, 0.46, 0.16, PAL.purple, { top: PAL.sky }); place(b, 0, 0.14, 0.08); addBox(b, 0.26, 0.2, 0.02, PAL.white, { bevel: 0.2 }); },
  toaster(b) {
    addBox(b, 0.62, 0.42, 0.42, PAL.steel, { bevel: 0.2 });
    for (const z of [-0.09, 0.09]) { place(b, 0, 0.4, z); addBox(b, 0.4, 0.04, 0.07, PAL.shadow, { bevel: 0 }); }
    place(b, 0.32, 0.14, 0); addBox(b, 0.06, 0.12, 0.12, PAL.coral, { bevel: 0.3 });
  },
  melon(b) {
    place(b, 0, 0.27, 0); addBall(b, 0.29, 0.27, 0.29, PAL.green, { seg: 10, rings: 6 });
    for (const a of [0, 1.05, 2.1]) { place(b, 0, 0.27, 0, a); addBall(b, 0.3, 0.275, 0.05, PAL.leaf, { seg: 10, rings: 6 }); }
  },
  pizza(b) { addBox(b, 0.68, 0.2, 0.68, PAL.coral, { bevel: 0.2, top: PAL.wall }); place(b, 0, 0.2, 0); addCyl(b, 0.24, 0.24, 0.02, PAL.orange, { seg: 10, top: PAL.danger }); },
  headset(b) {
    addBox(b, 0.56, 0.6, 0.38, PAL.shadow, { top: PAL.coral });
    place(b, 0, 0.3, 0.19, 0, Math.PI / 2, 0); addCyl(b, 0.17, 0.17, 0.03, PAL.coral, { seg: 10, top: PAL.white });
    place(b, 0, 0.6, 0); addCyl(b, 0.15, 0.15, 0.03, PAL.white, { seg: 10 });
  },
  shoes(b) { addBox(b, 0.68, 0.3, 0.44, PAL.sky, { bevel: 0.1 }); place(b, 0, 0.28, 0); addBox(b, 0.72, 0.09, 0.48, PAL.white, { bevel: 0.2 }); },
  microwave(b) {
    addBox(b, 0.92, 0.6, 0.68, PAL.steel, { bevel: 0.1, top: PAL.mint });
    place(b, -0.12, 0.12, 0.34); addBox(b, 0.54, 0.36, 0.03, PAL.shadow, { bevel: 0.15 });
    place(b, 0.32, 0.12, 0.34); addBox(b, 0.16, 0.36, 0.03, PAL.coral, { bevel: 0.15 });
    place(b, 0, 0.6, 0); addCyl(b, 0.24, 0.24, 0.04, PAL.white, { seg: 10, top: PAL.coral });    // a plate on the lid: the kinds read from above
  },
  speaker(b) {
    addBox(b, 0.66, 1.0, 0.6, PAL.shadow, { bevel: 0.1, top: PAL.purple });
    place(b, 0, 0.66, 0.3, 0, Math.PI / 2, 0); addCyl(b, 0.14, 0.14, 0.03, PAL.orange, { seg: 10 });
    place(b, 0, 0.28, 0.3, 0, Math.PI / 2, 0); addCyl(b, 0.22, 0.22, 0.04, PAL.orange, { seg: 10, top: PAL.white });
    place(b, 0, 1.0, 0); addCyl(b, 0.2, 0.2, 0.03, PAL.white, { seg: 10, top: PAL.orange });
  },
  suitcase(b) {
    addBox(b, 0.9, 0.66, 0.48, PAL.coral, { bevel: 0.15 });
    for (const x of [-0.24, 0.24]) { place(b, x, 0, 0); addBox(b, 0.08, 0.67, 0.5, PAL.white, { bevel: 0 }); }
    place(b, 0, 0.66, 0); addBox(b, 0.3, 0.07, 0.08, PAL.shadow, { bevel: 0.3 });
  },
  tv(b) {
    addBox(b, 1.3, 0.86, 0.34, PAL.hot, { bevel: 0.06 });
    place(b, 0, 0.14, 0.17); addBox(b, 1.06, 0.58, 0.03, PAL.sky, { bevel: 0.1 });
    place(b, -0.2, 0.3, 0.19, 0, 0, 0.6); addBox(b, 0.1, 0.4, 0.02, PAL.white, { bevel: 0 });
    bow(b, 0.86);
  },
  bear(b) {
    place(b, 0, 0.4, 0); addBall(b, 0.44, 0.42, 0.4, PAL.brown, { seg: 10, rings: 6 });
    place(b, 0, 0.86, 0.04); addBall(b, 0.31, 0.29, 0.3, PAL.brown, { seg: 10, rings: 6 });
    for (const x of [-0.24, 0.24]) { place(b, x, 1.06, 0); addBall(b, 0.11, 0.11, 0.08, PAL.brown, { seg: 6, rings: 4 }); }
    place(b, 0, 0.8, 0.28); addBall(b, 0.14, 0.11, 0.1, PAL.wall, { seg: 6, rings: 4 });
    place(b, 0, 0.6, 0.34); addBox(b, 0.3, 0.12, 0.08, PAL.hot, { bevel: 0.3 });
    bow(b, 1.12);
  },
  console(b) {
    addBox(b, 1.0, 0.5, 0.82, PAL.white, { bevel: 0.1, top: PAL.blue });
    place(b, 0, 0.18, 0.41); addBox(b, 0.6, 0.07, 0.03, PAL.shadow, { bevel: 0 });
    for (const x of [-0.28, 0.28]) { place(b, x, 0.5, 0.2); addCyl(b, 0.13, 0.13, 0.05, PAL.hot, { seg: 8 }); }
    bow(b, 0.5);
  },
  robovac(b) {
    addBox(b, 1.04, 0.14, 1.04, PAL.hot, { bevel: 0.2 });
    place(b, 0, 0.14, 0); addCyl(b, 0.46, 0.46, 0.2, PAL.white, { seg: 12, top: PAL.sky });
    bow(b, 0.34);
  },
};
// The gold bow that marks a hot item: two loops and a knot on top of it.
function bow(b, y) {
  for (const x of [-0.17, 0.17]) { place(b, x, y + 0.1, 0); addBall(b, 0.17, 0.11, 0.1, PAL.hot, { seg: 6, rings: 4 }); }
  place(b, 0, y, 0); addBox(b, 0.13, 0.17, 0.13, PAL.danger, { bevel: 0.3 });
}
export function goodGeometry(index) {
  const b = makeBuilder();
  GOOD_BUILD[GOODS[index].id](b);
  return toGeometry(b);
}

// ---- Mall furniture written into a shared builder (static, merged per level by scene.js) -----------
// One shelf run: a plinth for the goods, a backboard in the store's colour with a row of muted
// stock on top, a red price strip on each open side and striped caps on the ends (a shelf end is a
// wall). Nothing overhangs the goods: the camera is high and an emptied shelf must look empty.
export function addShelf(b, s, accent) {
  const along = s.horiz ? s.hx * 2 : s.hz * 2, depth = s.horiz ? s.hz * 2 : s.hx * 2, ry = s.horiz ? 0 : Math.PI / 2;
  const both = s.sides[0] && s.sides[1];
  const back = both ? 0 : (s.sides[0] ? 1 : -1) * (depth / 2 - 0.1);     // local z of the back panel
  const at = (lx, y, lz) => place(b, s.x + (s.horiz ? lx : lz), y, s.z + (s.horiz ? lz : -lx), ry);
  at(0, 0, 0); addBox(b, along, 0.5, depth, PAL.white, { bevel: 0.1 });
  at(0, 0.5, back); addBox(b, along - 0.06, 1.1, 0.2, accent, { bevel: 0.15 });
  for (const side of [-1, 1]) {
    if (!s.sides[side < 0 ? 0 : 1]) continue;
    at(0, 0.36, side * (depth / 2 + 0.01)); addBox(b, along - 0.1, 0.12, 0.04, PAL.danger, { bevel: 0 });
  }
  for (const end of [-1, 1]) {
    at(end * (along / 2 - 0.04), 0, 0); addBox(b, 0.1, 1.2, depth + 0.06, PAL.white, { bevel: 0.1 });
    at(end * (along / 2 - 0.035), 0.55, 0); addBox(b, 0.12, 0.3, depth + 0.07, accent, { bevel: 0 });
  }
  // muted stock along the top of the backboard: the shelf looks stocked without competing with the real goods
  const n = Math.floor(along / 0.5);
  for (let i = 0; i < n; i++) {
    const c = PAL.crowd[(i * 7 + (s.x | 0)) % 3], h = 0.2 + ((i * 13) % 5) * 0.05;
    at(-along / 2 + 0.25 + i * 0.5, 1.6, back); addBox(b, 0.38, h, 0.24, c, { bevel: 0.1 });
  }
}

// Static single-tile pieces (those that never change): counter, round display, plant, bench, fountain,
// tree, ramp (ry turns it to face down the route), wet-floor sign.
export function addPiece(b, type, x, z, accent, ry = 0) {
  place(b, x, 0, z);
  if (type === 'counter') {
    addBox(b, 1.4, 0.95, 2.0, PAL.white, { bevel: 0.08, top: PAL.night });
    place(b, 0 + x, 0.95, z - 0.55); addBox(b, 0.5, 0.5, 0.4, PAL.steel, { bevel: 0.2, top: PAL.list });
  } else if (type === 'display') {
    addCyl(b, 0.9, 0.9, 0.6, PAL.white, { seg: 14, top: accent });
    place(b, x, 0.6, z); addCyl(b, 0.55, 0.55, 0.5, accent, { seg: 12, top: PAL.white });
    place(b, x, 1.1, z); addCyl(b, 0.25, 0.25, 0.5, PAL.white, { seg: 8, top: PAL.danger });
  } else if (type === 'plant') {
    addCyl(b, 0.34, 0.42, 0.5, PAL.coral, { seg: 8, top: PAL.brown });
    place(b, x, 1.0, z); addBall(b, 0.5, 0.6, 0.5, PAL.green, { seg: 8, rings: 5 });
  } else if (type === 'bench') {
    addBox(b, 1.8, 0.45, 0.8, PAL.brown, { bevel: 0.2, top: PAL.wall });
  } else if (type === 'fountain') {
    addCyl(b, 2.8, 2.8, 0.5, PAL.steel, { seg: 20, top: PAL.sky });
    place(b, x, 0.5, z); addCyl(b, 0.6, 0.4, 1.1, PAL.white, { seg: 10, top: PAL.sky });
  } else if (type === 'ramp') {                     // a plank rising toward the front, on two side cheeks
    const s = Math.sin(ry), c = Math.cos(ry);
    place(b, x, 0.37, z, ry, -0.33); addBox(b, 1.8, 0.14, 2.3, PAL.steel, { bevel: 0.1, top: PAL.sale });
    for (const side of [-0.95, 0.95]) { place(b, x + c * side + s * 0.55, 0, z - s * side + c * 0.55, ry); addBox(b, 0.14, 0.62, 1.1, PAL.shadow, { bevel: 0.1 }); }
    for (const at of [-0.5, 0.2]) { place(b, x + s * at, 0.5 + at * 0.33, z + c * at, ry, -0.33); addBox(b, 1.0, 0.04, 0.22, PAL.shadow, { bevel: 0 }); }
  } else if (type === 'wetsign') {                  // the yellow A-frame that stands by a wet patch
    place(b, x, 0, z - 0.14, 0, 0.26); addBox(b, 0.5, 0.85, 0.05, PAL.sale, { bevel: 0.1 });
    place(b, x, 0, z + 0.14, 0, -0.26); addBox(b, 0.5, 0.85, 0.05, PAL.sale, { bevel: 0.1 });
    place(b, x, 0.3, z + 0.25, 0, -0.26); addBox(b, 0.1, 0.3, 0.02, PAL.shadow, { bevel: 0 });
  } else if (type === 'tree') {
    addCyl(b, 0.5, 0.5, 0.6, PAL.brown, { seg: 8 });
    for (let i = 0; i < 4; i++) { place(b, x, 0.5 + i * 1.0, z); addCyl(b, 1.7 - i * 0.38, 0.5 - i * 0.1, 1.2, PAL.leaf, { seg: 10 }); }
    place(b, x, 4.6, z); addBall(b, 0.28, 0.28, 0.28, PAL.hot, { seg: 6, rings: 4 });
  }
}

// Pieces that react (they vanish, fly or open), each its own mesh. Origin on the floor at the tile centre.
export function pieceGeometry(type) {
  const b = makeBuilder();
  if (type === 'pyramid') {                         // a pyramid of cans: 3 + 2 + 1 seen from each side
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) for (let j = 0; j < 3 - row; j++) {
      place(b, (i - (2 - row) / 2) * 0.44, 0.1 + row * 0.44, (j - (2 - row) / 2) * 0.44);
      addCyl(b, 0.2, 0.2, 0.44, row === 1 ? PAL.white : PAL.red, { seg: 8, top: PAL.steel });
    }
    place(b, 0, 0, 0); addCyl(b, 0.9, 0.9, 0.1, PAL.night, { seg: 12 });
  } else if (type === 'gifts') {                    // a pile of wrapped presents
    const boxes = [[-0.3, 0, -0.2, 0.7, PAL.danger], [0.35, 0, 0.1, 0.6, PAL.green], [-0.1, 0, 0.42, 0.5, PAL.sky], [0.05, 0.6, -0.05, 0.55, PAL.purple]];
    for (const [x, y, z, s, c] of boxes) {
      place(b, x, y, z, x * 2); addBox(b, s, s * 0.8, s, c, { bevel: 0.1 });
      place(b, x, y, z, x * 2); addBox(b, s * 0.2, s * 0.82, s * 1.02, PAL.white, { bevel: 0 });
    }
  } else if (type === 'stand') {                    // a cardboard standee with a sale burst
    place(b, 0, 0, 0); addBox(b, 0.9, 0.1, 0.6, PAL.brown, { bevel: 0.2 });
    place(b, 0, 0.1, 0); addBox(b, 0.9, 1.7, 0.1, PAL.coral, { bevel: 0.05 });
    place(b, 0, 1.0, 0.06, 0, Math.PI / 2, 0); addCyl(b, 0.32, 0.32, 0.03, PAL.white, { seg: 8, top: PAL.danger });
  } else if (type === 'podium') {                   // podium, two posts and a red ribbon across the front
    addCyl(b, 0.85, 0.85, 0.35, PAL.night, { seg: 14, top: PAL.hot });
    for (const x of [-0.8, 0.8]) { place(b, x, 0, 0.75); addCyl(b, 0.07, 0.07, 0.9, PAL.hot, { seg: 6 }); place(b, x, 0.9, 0.75); addBall(b, 0.11, 0.11, 0.11, PAL.hot, { seg: 6, rings: 4 }); }
    place(b, 0, 0.62, 0.75); addBox(b, 1.6, 0.16, 0.05, PAL.danger, { bevel: 0 });
  } else if (type === 'table') {
    place(b, 0, 0.5, 0); addCyl(b, 0.6, 0.6, 0.08, PAL.wall, { seg: 10, top: PAL.coral });
    addCyl(b, 0.12, 0.2, 0.5, PAL.steel, { seg: 6 });
  } else if (type === 'boxes') {
    addBox(b, 0.7, 0.5, 0.6, PAL.brown, { bevel: 0.08, top: PAL.wall });
    place(b, 0.08, 0.5, 0, 0.5); addBox(b, 0.5, 0.4, 0.44, PAL.brown, { bevel: 0.08, top: PAL.wall });
  } else if (type === 'glass') {                    // a shop window across a doorway: frame, pane, glare, a SALE sticker on both sides
    place(b, 0, 0, 0); addBox(b, 2.0, 0.2, 0.3, PAL.walltop, { bevel: 0.2 });
    place(b, 0, 2.0, 0); addBox(b, 2.0, 0.2, 0.3, PAL.walltop, { bevel: 0.2 });
    place(b, 0, 0.2, 0); addBox(b, 1.96, 1.8, 0.1, PAL.white, { bevel: 0 });        // (a white pane in a dark frame: nothing like the blue of water)
    for (const [x, zz] of [[-0.45, 0.06], [-0.2, 0.06], [0.45, -0.06], [0.2, -0.06]]) { place(b, x, 0.25, zz, 0, 0, 0.5); addBox(b, 0.08, 1.5, 0.02, PAL.sky, { bevel: 0 }); }
    for (const zz of [0.07, -0.07]) { place(b, 0, 0.9, zz); addBox(b, 0.9, 0.42, 0.03, PAL.danger, { bevel: 0.2 }); place(b, 0, 1.03, zz * 1.2); addBox(b, 0.6, 0.12, 0.03, PAL.white, { bevel: 0 }); }
  } else if (type === 'star') {                     // the gold star that bobs over a hot item: four spikes and a core
    for (let i = 0; i < 4; i++) { place(b, 0, 0, 0, 0, 0, i * Math.PI / 2); addCyl(b, 0.17, 0, 0.5, PAL.hot, { seg: 4 }); }
    place(b, 0, 0, 0); addBall(b, 0.2, 0.2, 0.14, PAL.hot, { seg: 6, rings: 4 });
  } else if (type === 'box') {                      // a unit box (lane lamps and barriers are scaled copies)
    place(b, 0, -0.5, 0); addBox(b, 1, 1, 1, PAL.white, { bevel: 0.1 });
  } else if (type === 'mannequin') {
    addCyl(b, 0.3, 0.3, 0.06, PAL.night, { seg: 8 });
    place(b, 0, 0.8, 0); addBall(b, 0.24, 0.5, 0.2, PAL.steel, { seg: 8, rings: 5 });
    place(b, 0, 1.5, 0); addBall(b, 0.16, 0.18, 0.16, PAL.steel, { seg: 8, rings: 5 });
  }
  return toGeometry(b);
}
