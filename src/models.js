// DOORBUSTER — models.js
// Purpose: procedural geometry. Everything visible is built from three chubby primitives — a
//          chamfered box, a cylinder (or cone) and an ellipsoid — written into a "builder" and
//          turned into one BufferGeometry with vertex colours. No textures, no model files.
// Exports: makeBuilder, place, addBox, addCyl, addBall, toGeometry, cartGeometry, bumperGeometry,
//          beanGeometry, goodGeometry
// Depends on: config.js and the global THREE (only inside toGeometry).
//
// Each vertex carries two normals: `normal` for lighting (flat on box faces, so the toon steps read
// as clean planes) and `onormal`, a smoothed normal shared by all vertices at one position, which the
// outline pass uses to push the hull out without gaps.

import { PAL, GOODS, rgb } from './config.js';

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
  const b = makeBuilder();
  place(b, 0, 0.26, 0); addBox(b, 0.84, 0.12, 1.3, PAL.night, { bevel: 0.3 });            // chassis
  place(b, 0, 0.38, 0); addBox(b, 1.0, 0.1, 1.4, color, { bevel: 0.2 });                  // basket floor
  for (const x of [-0.46, 0.46]) { place(b, x, 0.42, 0); addBox(b, 0.1, 0.52, 1.4, color, { bevel: 0.2 }); }
  for (const z of [-0.66, 0.66]) { place(b, 0, 0.42, z); addBox(b, 0.84, 0.52, 0.1, color, { bevel: 0.2 }); }
  for (const x of [-0.49, 0.49]) { place(b, x, 0.9, 0); addBox(b, 0.16, 0.13, 1.54, PAL.white, { bevel: 0.3 }); }   // rim
  for (const z of [-0.69, 0.69]) { place(b, 0, 0.9, z); addBox(b, 0.84, 0.13, 0.16, PAL.white, { bevel: 0.3 }); }
  for (const z of [-0.4, 0, 0.4]) for (const x of [-0.53, 0.53]) {                        // ribs
    place(b, x, 0.44, z); addBox(b, 0.07, 0.46, 0.12, PAL.white, { bevel: 0.3 });
  }
  for (const z of [-0.5, 0.5]) for (const x of [-0.46, 0.46]) {                           // wheels
    place(b, x - 0.07, 0.2, z, 0, 0, -Math.PI / 2); addCyl(b, 0.2, 0.2, 0.14, PAL.night, { seg: 10, bottom: true, top: PAL.steel });
  }
  for (const x of [-0.42, 0.42]) { place(b, x, 0.9, -0.74, 0, -0.35, 0); addBox(b, 0.08, 0.5, 0.08, PAL.steel, { bevel: 0.3 }); }
  place(b, 0, 1.32, -0.92); addBox(b, 1.04, 0.1, 0.1, PAL.night, { bevel: 0.35 });        // handle
  return toGeometry(b);
}
// The front bumper is its own mesh so it can glow when the dash is ready.
export function bumperGeometry() {
  const b = makeBuilder();
  place(b, 0, 0.44, 0.76); addBox(b, 1.08, 0.2, 0.16, PAL.sale, { bevel: 0.35 });
  return toGeometry(b);
}

// The shopper "bean": capsule body, ball head, dot eyes, ball hands. Stands behind the cart handle.
export function beanGeometry(color, skin = PAL.skin) {
  const b = makeBuilder();
  place(b, 0, 0.62, 0); addBall(b, 0.34, 0.6, 0.3, color, { seg: 10, rings: 6 });
  place(b, 0, 1.36, 0.02); addBall(b, 0.27, 0.27, 0.27, skin, { seg: 10, rings: 6 });
  for (const x of [-0.1, 0.1]) { place(b, x, 1.4, 0.25); addBall(b, 0.045, 0.06, 0.03, PAL.outline, { seg: 6, rings: 4 }); }
  for (const x of [-0.3, 0.3]) { place(b, x, 1.02, 0.36); addBall(b, 0.1, 0.1, 0.1, skin, { seg: 6, rings: 4 }); }
  return toGeometry(b);
}

// Goods: a placeholder box per kind until the art pass (M3) gives each its silhouette.
const GOOD_COLORS = [PAL.red, PAL.teal, PAL.sale, PAL.sky, PAL.orange, PAL.blue, PAL.purple, PAL.steel, PAL.green,
  PAL.coral, PAL.night, PAL.mint, PAL.steel, PAL.night, PAL.coral, PAL.white, PAL.brown, PAL.white, PAL.night];
export function goodGeometry(index) {
  const g = GOODS[index], b = makeBuilder();
  addBox(b, g.dims[0], g.dims[1], g.dims[2], GOOD_COLORS[index], { top: PAL.white });
  return toGeometry(b);
}
