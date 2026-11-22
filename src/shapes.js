// DOORBUSTER — shapes.js
// Purpose: the procedural geometry builders every model is made of (ART.md section 3): a builder that
//          collects triangles with colour, atlas data, gloss, emissive and a bone index; a transform
//          stack; chamfered boxes, cylinders and cones, super-ellipsoids, lathe profiles, tubes along
//          curves, extrusions and hair clumps; baked occlusion; and the conversion to one BufferGeometry
//          with welded hull normals for the ink.
// Exports: builder, at, push, pop, bind, box, cyl, ellipsoid, lathe, tube, extrude, clump, quad, ring, toGeometry
// Depends on: config.js (rgb) and the global THREE (only inside toGeometry and extrude).
//
// Vertex data: position, normal (smooth on organic shapes, flat on hard props), colour, uv, tex =
// (mode, cell, gloss, emissive), bone. Modes: 0 plain, 1 face (atlas A, cell from the material),
// 2 atlas A cell, 3 atlas B cell (clamped, labels), 4 atlas B cell (tiling).

import { rgb } from './config.js';

export function builder() {
  return { pos: [], nor: [], col: [], uv: [], tex: [], bone: [], m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], stack: [],
    nm: [1, 0, 0, 0, 1, 0, 0, 0, 1], nstack: [], b: 0, t: [0, 0, 0, 0], ao: null, extra: null };
}
// The current transform is a 3x4 matrix (rows). at() replaces it: translate, then yaw (y), pitch (x),
// roll (z), then scale s (a number or [sx, sy, sz]). push()/pop() save and restore it; bind() sets the
// bone, the atlas data and the occlusion function for what follows.
export function at(B, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  const S = Array.isArray(s) ? s : [s, s, s];
  // R = Ry * Rx * Rz, then scale columns
  const r = [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
  const L = [r[0] * S[0], r[1] * S[1], r[2] * S[2], x, r[3] * S[0], r[4] * S[1], r[5] * S[2], y, r[6] * S[0], r[7] * S[1], r[8] * S[2], z];
  const Ln = [r[0] / S[0], r[1] / S[1], r[2] / S[2], r[3] / S[0], r[4] / S[1], r[5] / S[2], r[6] / S[0], r[7] / S[1], r[8] / S[2]];
  B.m = B.stack.length ? m34mul(B.stack[B.stack.length - 1], L) : L;
  B.nm = B.nstack.length ? m3mul(B.nstack[B.nstack.length - 1], Ln) : Ln;
  return B;
}
function m3mul(A, L) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * L[j] + A[i * 3 + 1] * L[3 + j] + A[i * 3 + 2] * L[6 + j];
  return o;
}
function m34mul(A, L) {
  const o = new Array(12);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) o[i * 4 + j] = A[i * 4] * L[j] + A[i * 4 + 1] * L[4 + j] + A[i * 4 + 2] * L[8 + j] + (j === 3 ? A[i * 4 + 3] : 0);
  return o;
}
export function push(B) { B.stack.push(B.m.slice()); B.nstack.push(B.nm.slice()); return B; }
export function pop(B) { B.m = B.stack.pop() || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; B.nm = B.nstack.pop() || [1, 0, 0, 0, 1, 0, 0, 0, 1]; return B; }
// bone index, tex = [mode, cell, gloss, emissive], ao(x, y, z) -> factor in world (model) space.
export function bind(B, bone, tex, ao) { if (bone !== undefined) B.b = bone; if (tex) B.t = tex; if (ao !== undefined) B.ao = ao; return B; }

function vtx(B, p, n, c, uv, t) {
  const m = B.m;
  const x = m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], y = m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], z = m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11];
  const q = B.nm, nx = q[0] * n[0] + q[1] * n[1] + q[2] * n[2], ny = q[3] * n[0] + q[4] * n[1] + q[5] * n[2], nz = q[6] * n[0] + q[7] * n[1] + q[8] * n[2];
  const l = Math.hypot(nx, ny, nz) || 1;
  B.pos.push(x, y, z); B.nor.push(nx / l, ny / l, nz / l);
  const k = B.ao ? B.ao(x, y, z) : 1;
  B.col.push(c[0] * k, c[1] * k, c[2] * k);
  B.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
  const tt = t || B.t;
  B.tex.push(tt[0], tt[1], tt[2], tt[3]);
  B.bone.push(B.b);
  if (B.extra) B.extra(B, x, y, z);
}
const colOf = (c) => typeof c === 'number' ? rgb(c) : c;
const vunit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// A flat quad (p0..p3 counter-clockwise seen from the front), with uvs (0,0) (1,0) (1,1) (0,1) unless given.
export function quad(B, p0, p1, p2, p3, color, tex, uvs) {
  const c = colOf(color), n = vunit(vcross(vsub(p1, p0), vsub(p2, p0))), u = uvs || [[0, 1], [1, 1], [1, 0], [0, 0]];
  vtx(B, p0, n, c, u[0], tex); vtx(B, p1, n, c, u[1], tex); vtx(B, p2, n, c, u[2], tex);
  vtx(B, p0, n, c, u[0], tex); vtx(B, p2, n, c, u[2], tex); vtx(B, p3, n, c, u[3], tex);
  return B;
}
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// A chamfered box standing on y = 0 (or centred with o.mid). o: bevel (share of the smallest side, 0.12),
// top (lid colour), front (tex for the +z face, with its own uvs), sides (tex for all four sides).
export function box(B, w, h, d, color, o = {}) {
  const c = colOf(color), ct = o.top !== undefined ? colOf(o.top) : c, cb = o.bottom !== undefined ? colOf(o.bottom) : c;
  const bv = (o.bevel === undefined ? 0.12 : o.bevel) * Math.min(w, h, d), y0 = o.mid ? -h / 2 : 0;
  const hs = [w / 2, h / 2, d / 2], cen = [0, y0 + h / 2, 0];
  const P = (x, y, z) => [x, y + y0 + h / 2, z];
  for (let ax = 0; ax < 3; ax++) {
    const b1 = (ax + 1) % 3, b2 = (ax + 2) % 3;
    for (const s of [-1, 1]) {
      const pts = [];
      for (const [s1, s2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[ax] = s * hs[ax]; q[b1] = s1 * (hs[b1] - bv); q[b2] = s2 * (hs[b2] - bv); pts.push(P(q[0], q[1], q[2])); }
      const isTop = ax === 1 && s > 0, isBot = ax === 1 && s < 0, isFront = ax === 2 && s > 0;
      const tex = isFront && o.front ? o.front : ax !== 1 && o.sides ? o.sides : isTop && o.lid ? o.lid : null;
      flatFace(B, pts, isTop ? ct : isBot ? cb : c, cen, tex, tex ? boxUV(pts, ax, s, hs, y0 + h / 2) : null);
    }
  }
  if (bv <= 0) return B;
  for (let ax = 0; ax < 3; ax++) {
    const b1 = (ax + 1) % 3, b2 = (ax + 2) % 3;
    for (const s of [-1, 1]) for (const s1 of [-1, 1]) {
      const pts = [];
      for (const [k, s2] of [[0, -1], [0, 1], [1, 1], [1, -1]]) { const q = [0, 0, 0]; q[ax] = s * (hs[ax] - (k ? bv : 0)); q[b1] = s1 * (hs[b1] - (k ? 0 : bv)); q[b2] = s2 * (hs[b2] - bv); pts.push(P(q[0], q[1], q[2])); }
      flatFace(B, pts, (ax === 1 && s > 0) || (b1 === 1 && s1 > 0) ? mixCol(c, ct, 0.5) : c, cen);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    flatFace(B, [P(sx * hs[0], sy * (hs[1] - bv), sz * (hs[2] - bv)), P(sx * (hs[0] - bv), sy * hs[1], sz * (hs[2] - bv)), P(sx * (hs[0] - bv), sy * (hs[1] - bv), sz * hs[2])], sy > 0 ? mixCol(c, ct, 0.5) : c, cen);
  }
  return B;
}
const mixCol = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// uv of a box face: x/z across, y up (v = 0 at the top of the face, like the canvas).
function boxUV(pts, ax, s, hs, cy) {
  return pts.map((p) => ax === 2 ? [(p[0] * s + hs[0]) / (2 * hs[0]), (cy + hs[1] - p[1]) / (2 * hs[1])]
    : ax === 0 ? [(-p[2] * s + hs[2]) / (2 * hs[2]), (cy + hs[1] - p[1]) / (2 * hs[1])] : [(p[0] + hs[0]) / (2 * hs[0]), (p[2] + hs[2]) / (2 * hs[2])]);
}
function flatFace(B, pts, c, centre, tex, uvs) {
  const a = pts[0];
  let n = vunit(vcross(vsub(pts[1], a), vsub(pts[2], a)));
  const flip = n[0] * (a[0] - centre[0]) + n[1] * (a[1] - centre[1]) + n[2] * (a[2] - centre[2]) < 0;
  if (flip) n = [-n[0], -n[1], -n[2]];
  for (let i = 1; i + 1 < pts.length; i++) {
    const tri = flip ? [0, i + 1, i] : [0, i, i + 1];
    for (const j of tri) vtx(B, pts[j], n, c, uvs ? uvs[j] : null, tex);
  }
}

// A cylinder or cone standing on y = 0: radii r0 (bottom) and r1 (top), height h. o: seg (12), top / bottom
// (cap colours, false for open), side (tex for the side band: u around, v down), smooth (true), round (rounded rim).
export function cyl(B, r0, r1, h, color, o = {}) {
  const c = colOf(color), seg = o.seg || 12, slope = (r0 - r1) / h;
  const ct = o.top === false ? null : colOf(o.top !== undefined ? o.top : color), cb = o.bottom === false || o.bottom === undefined ? null : colOf(o.bottom === true ? color : o.bottom);
  const y0 = o.mid ? -h / 2 : 0;
  const ring = (i, y, r) => { const a = i / seg * Math.PI * 2; return [Math.sin(a) * r, y + y0, Math.cos(a) * r]; };
  const sn = (i) => { const a = i / seg * Math.PI * 2; return vunit([Math.sin(a), slope, Math.cos(a)]); };
  for (let i = 0; i < seg; i++) {
    const j = i + 1, a0 = ring(i, 0, r0), a1 = ring(j, 0, r0), t0 = ring(i, h, r1), t1 = ring(j, h, r1);
    const u0 = i / seg, u1 = j / seg, tex = o.side;
    const n0 = o.smooth === false ? vunit(vcross(vsub(t0, a0), vsub(a1, a0))).map((v) => -v) : sn(i), n1 = o.smooth === false ? n0 : sn(j);
    vtx(B, a0, n0, c, [u0, 1], tex); vtx(B, a1, n1, c, [u1, 1], tex); vtx(B, t1, n1, c, [u1, 0], tex);
    vtx(B, a0, n0, c, [u0, 1], tex); vtx(B, t1, n1, c, [u1, 0], tex); vtx(B, t0, n0, c, [u0, 0], tex);
    if (ct && r1 > 0.001) { const tt = o.lid; vtx(B, [0, h + y0, 0], [0, 1, 0], ct, [0.5, 0.5], tt); vtx(B, t0, [0, 1, 0], ct, [0.5 + t0[0] / r1 / 2, 0.5 + t0[2] / r1 / 2], tt); vtx(B, t1, [0, 1, 0], ct, [0.5 + t1[0] / r1 / 2, 0.5 + t1[2] / r1 / 2], tt); }
    if (cb && r0 > 0.001) { vtx(B, [0, y0, 0], [0, -1, 0], cb); vtx(B, a1, [0, -1, 0], cb); vtx(B, a0, [0, -1, 0], cb); }
  }
  return B;
}

// A super-ellipsoid centred on the current origin: radii rx, ry, rz; e1 shapes the profile (north-south),
// e2 the cross-section (1 = round, < 1 boxier, > 1 pinched). o: seg (24), rings (16), uv: 'face' (planar
// projection onto the front, x and y over the half sizes fw, fh) or 'sphere'; tex for the faced part
// (o.faceTex, used where z > o.faceZ * rz); colorAt(x, y, z) -> colour override (local); keep(x, y, z) -> false drops a quad (model space);
// warp(p) -> p reshapes the surface; cut (stop at this ring share).
export function ellipsoid(B, rx, ry, rz, color, o = {}) {
  const seg = o.seg || 24, rings = o.rings || 16, e1 = o.e1 || 1, e2 = o.e2 || 1, c0 = colOf(color);
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const pt = (i, j) => {
    const th = (i / rings - 0.5) * Math.PI, ph = j / seg * Math.PI * 2;
    const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), spn = Math.sin(ph);
    const x = rx * sp(ct, e1) * sp(spn, e2), y = ry * sp(st, e1), z = rz * sp(ct, e1) * sp(cp, e2);
    // normal of a super-ellipsoid: gradient of the implicit function
    const nx = sp(ct, 2 - e1) * sp(spn, 2 - e2) / rx, ny = sp(st, 2 - e1) / ry, nz = sp(ct, 2 - e1) * sp(cp, 2 - e2) / rz;
    return { p: [x, y, z], n: vunit([nx, ny, nz]) };
  };
  const last = Math.round(rings * (o.cut || 1));
  const grid = [];
  for (let i = 0; i <= rings; i++) { const row = []; for (let j = 0; j <= seg; j++) { const v = pt(i, j); if (o.warp) v.p = o.warp(v.p); row.push(v); } grid.push(row); }
  if (o.warp) for (let i = 1; i < rings; i++) for (let j = 0; j <= seg; j++) {
    const a = grid[i][(j + 1) % seg].p, b = grid[i][(j + seg - 1) % seg].p, c = grid[i + 1][j].p, d = grid[i - 1][j].p;
    const n = vunit(vcross(vsub(a, b), vsub(c, d)));
    if (vdot(n, grid[i][j].n) > 0) grid[i][j].n = n; else grid[i][j].n = [-n[0], -n[1], -n[2]];
  }
  for (let i = 0; i < last; i++) for (let j = 0; j < seg; j++) {
    const q = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]];
    if (o.keep) { const m = B.m, px = (q[0].p[0] + q[2].p[0]) / 2, py = (q[0].p[1] + q[2].p[1]) / 2, pz = (q[0].p[2] + q[2].p[2]) / 2;
      if (!o.keep(m[0] * px + m[1] * py + m[2] * pz + m[3], m[4] * px + m[5] * py + m[6] * pz + m[7], m[8] * px + m[9] * py + m[10] * pz + m[11])) continue; }
    for (const tri of [[0, 1, 2], [0, 2, 3]]) {
      const vs = tri.map((k) => q[k]);
      const face = o.uv === 'face' && vs.every((v) => v.p[2] > (o.faceZ || 0) * rz);
      for (const v of vs) {
        const col = o.colorAt ? colOf(o.colorAt(v.p[0], v.p[1], v.p[2]) ?? color) : c0;
        const uv = o.uv === 'face' ? [0.5 + v.p[0] / (2 * o.fw), 0.5 - (v.p[1] - (o.fy || 0)) / (2 * o.fh)] : [j / seg, i / rings];
        vtx(B, v.p, v.n, col, uv, face ? o.faceTex : o.tex);
      }
    }
  }
  return B;
}

// A surface of revolution about y: prof = [[r, y], ...] from bottom to top. o: seg (24), colorAt(y, k) ->
// colour for profile point k, tex (u around, v along the profile), squash [sx, sz] for oval sections,
// cap (close the ends).
export function lathe(B, prof, color, o = {}) {
  const seg = o.seg || 24, sx = o.squash ? o.squash[0] : 1, sz = o.squash ? o.squash[1] : 1, c0 = colOf(color);
  const n = prof.length;
  // profile normals from neighbours (smooth)
  const pn = prof.map((p, k) => {
    const a = prof[Math.max(0, k - 1)], b = prof[Math.min(n - 1, k + 1)];
    const dy = b[1] - a[1], dr = b[0] - a[0], l = Math.hypot(dy, dr) || 1;
    return [dy / l, -dr / l];
  });
  let len = 0; const vs = [0];
  for (let k = 1; k < n; k++) { len += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]); vs.push(len); }
  const P = (k, j) => { const a = j / seg * Math.PI * 2, s = Math.sin(a), c = Math.cos(a); return [s * prof[k][0] * sx, prof[k][1], c * prof[k][0] * sz]; };
  const N = (k, j) => { const a = j / seg * Math.PI * 2, s = Math.sin(a), c = Math.cos(a); return vunit([s * pn[k][0] / sx, pn[k][1], c * pn[k][0] / sz]); };
  for (let k = 0; k + 1 < n; k++) {
    const ca = colOf(o.colorAt ? o.colorAt(prof[k][1], k) ?? color : color), cb = colOf(o.colorAt ? o.colorAt(prof[k + 1][1], k + 1) ?? color : color);
    const band = o.hard && o.hard(k);           // a hard edge between colour bands: flat colour per band
    for (let j = 0; j < seg; j++) {
      const q = [[k, j], [k, j + 1], [k + 1, j + 1], [k + 1, j]];
      for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const t of tri) {
        const [kk, jj] = q[t];
        vtx(B, P(kk, jj), N(kk, jj), band ? ca : kk === k ? ca : cb, [jj / seg * (o.uRep || 1), (1 - vs[kk] / (len || 1)) * (o.vRep || 1)], o.tex);
      }
    }
  }
  if (o.cap) for (const [k, s] of [[0, -1], [n - 1, 1]]) {
    if (prof[k][0] < 0.001) continue;
    const cc = colOf(o.colorAt ? o.colorAt(prof[k][1], k) ?? color : color);
    for (let j = 0; j < seg; j++) {
      const a = P(k, j), b = P(k, j + 1), m = [0, prof[k][1], 0];
      if (s > 0) { vtx(B, m, [0, 1, 0], cc); vtx(B, a, [0, 1, 0], cc); vtx(B, b, [0, 1, 0], cc); }
      else { vtx(B, m, [0, -1, 0], cc); vtx(B, b, [0, -1, 0], cc); vtx(B, a, [0, -1, 0], cc); }
    }
  }
  return B;
}

// A tube along a polyline pts = [[x, y, z], ...] with radius r (a number or a function of t in 0..1).
// o: seg (10), flat (cross-section squash [a, b] across and along the binormal), caps ('round', 'flat' or none),
// colorAt(t) -> colour.
export function tube(B, pts, r, color, o = {}) {
  const seg = o.seg || 10, n = pts.length, rad = typeof r === 'function' ? r : () => r, sq = o.flat || [1, 1];
  // a frame along the curve (parallel transport)
  const T = pts.map((p, k) => vunit(vsub(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)])));
  let up = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  if (o.up) up = o.up;
  let Nv = vunit(vcross(vcross(T[0], up), T[0]));
  const frames = [];
  for (let k = 0; k < n; k++) {
    if (k > 0) { const b = vcross(T[k - 1], T[k]); if (Math.hypot(...b) > 1e-6) { const ax = vunit(b), ang = Math.acos(Math.max(-1, Math.min(1, vdot(T[k - 1], T[k])))); Nv = vrot(Nv, ax, ang); } }
    frames.push([Nv, vunit(vcross(T[k], Nv))]);
  }
  let total = 0; const ts = [0];
  for (let k = 1; k < n; k++) { total += Math.hypot(...vsub(pts[k], pts[k - 1])); ts.push(total); }
  const ring = (k) => {
    const t = ts[k] / (total || 1), rr = rad(t), [N1, B1] = frames[k], out = [];
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, ca = Math.cos(a) * sq[0], sa = Math.sin(a) * sq[1];
      out.push({ p: [pts[k][0] + (N1[0] * ca + B1[0] * sa) * rr, pts[k][1] + (N1[1] * ca + B1[1] * sa) * rr, pts[k][2] + (N1[2] * ca + B1[2] * sa) * rr],
        n: vunit([N1[0] * ca / sq[0] + B1[0] * sa / sq[1], N1[1] * ca / sq[0] + B1[1] * sa / sq[1], N1[2] * ca / sq[0] + B1[2] * sa / sq[1]]), u: j / seg, v: t });
    }
    return out;
  };
  let prev = ring(0);
  for (let k = 1; k < n; k++) {
    const cur = ring(k), ca = colOf(o.colorAt ? o.colorAt(ts[k - 1] / total) : color), cb = colOf(o.colorAt ? o.colorAt(ts[k] / total) : color);
    for (let j = 0; j < seg; j++) {
      const a = prev[j], b = prev[j + 1], c = cur[j + 1], d = cur[j];
      for (const [v, cc] of [[a, ca], [c, cb], [d, cb], [a, ca], [b, ca], [c, cb]]) vtx(B, v.p, v.n, cc, [v.u, v.v], o.tex);
    }
    prev = cur;
  }
  if (o.caps) for (const [k, s] of [[0, -1], [n - 1, 1]]) {
    const rr = rad(k ? 1 : 0), cc = colOf(o.colorAt ? o.colorAt(k ? 1 : 0) : color), tdir = T[k].map((v) => v * s);
    if (rr < 1e-4) continue;
    if (o.caps === 'round') {      // a half dome
      push(B);
      const [N1, B1] = frames[k], c0 = pts[k];
      const cr = o.capRings || 3;
      for (let i = 0; i < cr; i++) for (let j = 0; j < seg; j++) {
        const pt = (ii, jj) => { const th = ii / cr * Math.PI / 2, a = jj / seg * Math.PI * 2, rc = Math.cos(th) * rr, h = Math.sin(th) * rr;
          const d = [N1[0] * Math.cos(a) * rc * sq[0] + B1[0] * Math.sin(a) * rc * sq[1] + tdir[0] * h, N1[1] * Math.cos(a) * rc * sq[0] + B1[1] * Math.sin(a) * rc * sq[1] + tdir[1] * h, N1[2] * Math.cos(a) * rc * sq[0] + B1[2] * Math.sin(a) * rc * sq[1] + tdir[2] * h];
          return { p: [c0[0] + d[0], c0[1] + d[1], c0[2] + d[2]], n: vunit(d) }; };
        const q = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)];
        const order = s > 0 ? [[0, 1, 2], [0, 2, 3]] : [[0, 2, 1], [0, 3, 2]];
        for (const tri of order) for (const t of tri) vtx(B, q[t].p, q[t].n, cc);
      }
      pop(B);
    } else {
      const rg = ring(k);
      for (let j = 0; j < seg; j++) { const a = rg[j].p, b = rg[j + 1].p; if (s > 0) { vtx(B, pts[k], tdir, cc); vtx(B, a, tdir, cc); vtx(B, b, tdir, cc); } else { vtx(B, pts[k], tdir, cc); vtx(B, b, tdir, cc); vtx(B, a, tdir, cc); } }
    }
  }
  return B;
}
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function vrot(v, ax, a) {        // Rodrigues
  const c = Math.cos(a), s = Math.sin(a), d = vdot(ax, v), x = vcross(ax, v);
  return [v[0] * c + x[0] * s + ax[0] * d * (1 - c), v[1] * c + x[1] * s + ax[1] * d * (1 - c), v[2] * c + x[2] * s + ax[2] * d * (1 - c)];
}

// An extruded flat shape: outline = [[x, y], ...] (counter-clockwise), holes = [[[x, y], ...]], extruded
// along z from -d/2 to d/2. o: front / back tex with uvs from the outline's bounds, side colour.
export function extrude(B, outline, d, color, o = {}) {
  const c = colOf(color), cs = o.side !== undefined ? colOf(o.side) : c, holes = o.holes || [];
  const tris = THREE.ShapeUtils.triangulateShape(outline.map(([x, y]) => new THREE.Vector2(x, y)), holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y))));
  const all = [...outline, ...holes.flat()];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const uvOf = ([x, y]) => [(x - x0) / (x1 - x0 || 1), (y1 - y) / (y1 - y0 || 1)];
  for (const t of tris) {
    let [a, b, e] = t.map((i) => all[i]);
    if ((b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]) < 0) [b, e] = [e, b];
    for (const p of [a, b, e]) vtx(B, [p[0], p[1], d / 2], [0, 0, 1], c, uvOf(p), o.front);
    for (const p of [a, e, b]) vtx(B, [p[0], p[1], -d / 2], [0, 0, -1], o.backColor !== undefined ? colOf(o.backColor) : c, uvOf(p), o.back);
  }
  for (const loop of [outline, ...holes]) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length];
      const nx = q[1] - p[1], ny = -(q[0] - p[0]), l = Math.hypot(nx, ny) || 1, n = [nx / l, ny / l, 0];
      const A = [p[0], p[1], d / 2], Bp = [q[0], q[1], d / 2], Cp = [q[0], q[1], -d / 2], D = [p[0], p[1], -d / 2];
      for (const v of [A, D, Cp, A, Cp, Bp]) vtx(B, v, n, cs);
    }
  }
  return B;
}

// A hair clump or a curled lock: a tapered tube along a quadratic curve from a (root) through b to e (tip),
// flattened across. width w at the root, tip radius share tip (0.15).
export function clump(B, a, b, e, w, color, o = {}) {
  const pts = [];
  for (let i = 0; i <= (o.steps || 5); i++) {
    const t = i / (o.steps || 5), u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * b[0] + t * t * e[0], u * u * a[1] + 2 * u * t * b[1] + t * t * e[1], u * u * a[2] + 2 * u * t * b[2] + t * t * e[2]]);
  }
  const tip = o.tip === undefined ? 0.15 : o.tip;
  return tube(B, pts, (t) => w * (tip + (1 - tip) * Math.pow(Math.sin(Math.min(1, (1 - t) * 1.15) * Math.PI / 2), 0.7)) * (t < 0.08 ? 0.75 + t * 3 : 1), color,
    { seg: o.seg || 6, flat: o.flat || [1, 0.55], caps: 'round', capRings: 2, up: o.up, tex: o.tex });
}

// A flat ring (torus-like band) in the xy plane: radii rx, ry, thickness t, depth d (glasses frames, hoops).
export function ring(B, rx, ry, t, d, color, o = {}) {
  const pts = [], n = o.seg || 20;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push([Math.cos(a) * rx, Math.sin(a) * ry, 0]); }
  return tube(B, pts, t, color, { seg: 6, flat: [1, d / t] });
}

// Builds the BufferGeometry: position, normal, color, uv, tex, bone, and onormal (normals averaged over
// every vertex at the same spot, so the ink hull is pushed out without gaps). groups: two ranges over the
// same triangles for [cel, hull] material pairs.
export function toGeometry(B, o = {}) {
  const T = THREE, g = new T.BufferGeometry(), n = B.pos.length / 3;
  g.setAttribute('position', new T.Float32BufferAttribute(B.pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.nor, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(B.col, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('tex', new T.Float32BufferAttribute(B.tex, 4));
  if (o.bones) g.setAttribute('bone', new T.Float32BufferAttribute(B.bone, 1));
  if (o.hull !== false) {
    const acc = new Map(), on = new Float32Array(n * 3), key = (i) => `${Math.round(B.pos[i * 3] * 2000)},${Math.round(B.pos[i * 3 + 1] * 2000)},${Math.round(B.pos[i * 3 + 2] * 2000)},${B.bone[i]}`;
    for (let i = 0; i < n; i++) { const k = key(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]); a[0] += B.nor[i * 3]; a[1] += B.nor[i * 3 + 1]; a[2] += B.nor[i * 3 + 2]; }
    for (let i = 0; i < n; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; on[i * 3] = a[0] / l; on[i * 3 + 1] = a[1] / l; on[i * 3 + 2] = a[2] / l; }
    g.setAttribute('onormal', new T.BufferAttribute(on, 3));
  }
  if (B.extraAttrs) for (const [name, data, size] of B.extraAttrs) g.setAttribute(name, new T.Float32BufferAttribute(data, size));
  if (o.groups !== false) { g.addGroup(0, n, 0); g.addGroup(0, n, 1); }
  g.computeBoundingSphere();
  return g;
}
