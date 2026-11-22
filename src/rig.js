// DOORBUSTER — rig.js
// Purpose: named characters as one rigid-skinned mesh each (2 draw calls with the ink hull), their
//          skeleton and the procedural animation set (ART.md section 3): push-run with the stride matched
//          to speed, riding the cart at boost, drift lean and leg kick, dash crouch and stretch, hit
//          squash and head wobble, wipeout tumble, idle fidgets, taunt, victory and defeat poses, a head
//          that looks at things, two-bone arms on the cart handle, spring hair and props, blinking.
// Exports: makeCharacter, animate, poseRig, setFace, NBR
// Depends on: config.js, shapes.js, figure.js, atlas.js, cast.js, render.js and the global THREE.

import { clamp, wrapAngle } from './config.js';
import { builder, toGeometry } from './shapes.js';
import { BONE, NB, buildFigure, figureParts } from './figure.js';
import { EXPR, faceAtlas, faceCell, patternAtlas } from './atlas.js';
import { CAST, CROWD_FACES } from './cast.js';
import { celMaterial, hullMaterial } from './render.js';

export const NBR = NB + 6;           // a racer: the figure's bones and the cart's (cartart.js)
const B_ = BONE;

// Builds a character (and optionally its cart with cartFn(B, firstBone) -> cart info). Returns
// { mesh, rig }; mesh carries [cel, hull] materials that share the bone array.
export function makeCharacter(id, cartFn, o = {}) {
  const B = builder(), look = CAST[id];
  const parts = buildFigure(B, id);
  if (o.headOnly) keepBones(B, [B_.head, B_.hair1, B_.hair2]);
  let cart = null;
  if (cartFn) cart = cartFn(B, NB);
  const geo = toGeometry(B, { bones: true });
  const faces = Object.values(CAST).map((c) => ({ ...c.face, skin: c.skin }));
  const mapA = faceAtlas(faces, CROWD_FACES.map((f) => f)), mapB = patternAtlas();
  const nb = cart ? NBR : NB;
  const bones = new Float32Array(nb * 12);
  const cel = celMaterial({ skinned: nb, mapA, mapB, rim: 0.6, faceCell: 0.125, bones });
  const hull = hullMaterial(o.thin ? 2.5 : 3, nb);
  hull.uniforms.uBones.value = bones;
  const mesh = new THREE.Mesh(geo, [cel, hull]);
  mesh.frustumCulled = false;
  const rig = { id, look, parts, cart, nb, bones, cel, mesh,
    q: new Float32Array(nb * 4), off: new Float32Array(nb * 3), sc: new Float32Array(nb * 3).fill(1), world: new Float32Array(nb * 12),
    ang: new Float32Array(nb * 3), phase: 0, t: 0, ride: 0, lean: 0, roll: 0, crouch: 0, blink: 2, expr: 0, exprT: 0, face: -1,
    hair: [0, 0, 0, 0], hairV: [0, 0, 0, 0], bag: [0, 0], bagV: [0, 0], belly: 0, bellyV: 0, wob: 0, sq: 0, last: null, prev: [0, 0, 0],
    tumble: null, pose: null, poseK: 0 };
  for (let b = 0; b < nb; b++) rig.q[b * 4 + 3] = 1;
  rig.pivots = parts.P.slice(0, NB).map((p) => p.slice());
  rig.parent = parts.parent.slice();
  if (cart) { for (let b = NB; b < nb; b++) { rig.pivots.push(cart.pivots[b - NB] || [0, 0, 0]); rig.parent.push(cart.parents[b - NB]); } }
  rig.armLen = [parts.len[0], parts.len[1] + parts.hand * 0.7];
  setFace(rig, EXPR.neutral);
  poseRig(rig);
  return { mesh, rig };
}

// Drops every triangle whose bone is not listed (the expression sheet shows heads only).
function keepBones(B, keep) {
  const n = B.bone.length / 3, out = { pos: [], nor: [], col: [], uv: [], tex: [], bone: [] };
  for (let t = 0; t < n; t++) {
    if (!keep.includes(B.bone[t * 3])) continue;
    for (let v = t * 3; v < t * 3 + 3; v++) {
      out.pos.push(B.pos[v * 3], B.pos[v * 3 + 1], B.pos[v * 3 + 2]); out.nor.push(B.nor[v * 3], B.nor[v * 3 + 1], B.nor[v * 3 + 2]);
      out.col.push(B.col[v * 3], B.col[v * 3 + 1], B.col[v * 3 + 2]); out.uv.push(B.uv[v * 2], B.uv[v * 2 + 1]);
      out.tex.push(B.tex[v * 4], B.tex[v * 4 + 1], B.tex[v * 4 + 2], B.tex[v * 4 + 3]); out.bone.push(B.bone[v]);
    }
  }
  Object.assign(B, out);
}

export function setFace(rig, e) {
  if (rig.face === e) return;
  rig.face = e;
  const c = faceCell(rig.look.face.row, e);
  rig.cel.uniforms.uFace.value.set(c[0], c[1]);
}

// ---- matrices -------------------------------------------------------------------------------------------
// world[b] = world[parent] * T(pivot + off) * R(q) * S(sc) * T(-pivot); bones[] is world as rows (3 x vec4).
export function poseRig(rig, rootM) {
  const { q, off, sc, world, pivots, parent, nb, bones } = rig;
  for (let b = 0; b < nb; b++) {
    const x = q[b * 4], y = q[b * 4 + 1], z = q[b * 4 + 2], w = q[b * 4 + 3];
    const sx = sc[b * 3], sy = sc[b * 3 + 1], sz = sc[b * 3 + 2], p = pivots[b];
    const m00 = (1 - 2 * (y * y + z * z)) * sx, m01 = (2 * (x * y - z * w)) * sy, m02 = (2 * (x * z + y * w)) * sz;
    const m10 = (2 * (x * y + z * w)) * sx, m11 = (1 - 2 * (x * x + z * z)) * sy, m12 = (2 * (y * z - x * w)) * sz;
    const m20 = (2 * (x * z - y * w)) * sx, m21 = (2 * (y * z + x * w)) * sy, m22 = (1 - 2 * (x * x + y * y)) * sz;
    const tx = p[0] + off[b * 3] - (m00 * p[0] + m01 * p[1] + m02 * p[2]);
    const ty = p[1] + off[b * 3 + 1] - (m10 * p[0] + m11 * p[1] + m12 * p[2]);
    const tz = p[2] + off[b * 3 + 2] - (m20 * p[0] + m21 * p[1] + m22 * p[2]);
    const L = [m00, m01, m02, tx, m10, m11, m12, ty, m20, m21, m22, tz];
    const pa = parent[b], P = pa >= 0 ? world.subarray(pa * 12, pa * 12 + 12) : rootM, o = b * 12;
    if (!P) { world.set(L, o); continue; }
    for (let i = 0; i < 3; i++) {
      const a0 = P[i * 4], a1 = P[i * 4 + 1], a2 = P[i * 4 + 2], a3 = P[i * 4 + 3];
      world[o + i * 4] = a0 * L[0] + a1 * L[4] + a2 * L[8];
      world[o + i * 4 + 1] = a0 * L[1] + a1 * L[5] + a2 * L[9];
      world[o + i * 4 + 2] = a0 * L[2] + a1 * L[6] + a2 * L[10];
      world[o + i * 4 + 3] = a0 * L[3] + a1 * L[7] + a2 * L[11] + a3;
    }
  }
  bones.set(world);
}
function eul(rig, b, x, y, z) {          // local rotation from Euler angles (order Y, X, Z)
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2), cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  const q = rig.q, o = b * 4;
  q[o] = sx * cy * cz + cx * sy * sz; q[o + 1] = cx * sy * cz - sx * cy * sz; q[o + 2] = cx * cy * sz - sx * sy * cz; q[o + 3] = cx * cy * cz + sx * sy * sz;
}
// Smoothly approaches target angles: ang += (target - ang) * k.
function go(rig, b, x, y, z, k) { const a = rig.ang, o = b * 3; a[o] += (x - a[o]) * k; a[o + 1] += (y - a[o + 1]) * k; a[o + 2] += (z - a[o + 2]) * k; eul(rig, b, a[o], a[o + 1], a[o + 2]); }

// ---- two-bone arm on a target (character space) ------------------------------------------------------------
const tmp = { a: [0, 0, 0], b: [0, 0, 0] };
function mulV(M, o, v) { return [M[o] * v[0] + M[o + 1] * v[1] + M[o + 2] * v[2] + M[o + 3], M[o + 4] * v[0] + M[o + 5] * v[1] + M[o + 6] * v[2] + M[o + 7], M[o + 8] * v[0] + M[o + 9] * v[1] + M[o + 10] * v[2] + M[o + 11]]; }
function invRot(M, o, v) { const c0 = [M[o], M[o + 4], M[o + 8]], c1 = [M[o + 1], M[o + 5], M[o + 9]], c2 = [M[o + 2], M[o + 6], M[o + 10]];
  const l0 = Math.hypot(...c0) || 1, l1 = Math.hypot(...c1) || 1, l2 = Math.hypot(...c2) || 1;
  return [(c0[0] * v[0] + c0[1] * v[1] + c0[2] * v[2]) / (l0 * l0), (c1[0] * v[0] + c1[1] * v[1] + c1[2] * v[2]) / (l1 * l1), (c2[0] * v[0] + c2[1] * v[1] + c2[2] * v[2]) / (l2 * l2)]; }
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function quatTo(q, o, a, b) {           // rotation taking unit a to unit b
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0], w = 1 + d;
  if (w < 1e-5) { x = 1; y = 0; z = 0; w = 0; }
  const l = Math.hypot(x, y, z, w); q[o] = x / l; q[o + 1] = y / l; q[o + 2] = z / l; q[o + 3] = w / l;
}
function reach(rig, side, target, rootM) {
  const up = side > 0 ? B_.armL : B_.armR, fo = side > 0 ? B_.foreL : B_.foreR, P = rig.pivots, W = rig.world;
  poseRig(rig, rootM);
  const S = mulV(W, B_.chest * 12, P[up]);
  const [a, b] = rig.armLen;
  let d = [target[0] - S[0], target[1] - S[1], target[2] - S[2]];
  let len = Math.hypot(...d);
  const L = clamp(len, Math.abs(a - b) + 0.01, a + b - 0.005);
  d = nrm(d);
  const pole0 = [side * 0.85, -0.3, -0.5];
  const pd = pole0[0] * d[0] + pole0[1] * d[1] + pole0[2] * d[2];
  const pole = nrm([pole0[0] - d[0] * pd, pole0[1] - d[1] * pd, pole0[2] - d[2] * pd]);
  const ca = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const E = [S[0] + a * (ca * d[0] + sa * pole[0]), S[1] + a * (ca * d[1] + sa * pole[1]), S[2] + a * (ca * d[2] + sa * pole[2])];
  const H = [S[0] + d[0] * L, S[1] + d[1] * L, S[2] + d[2] * L];
  const restUp = nrm([P[fo][0] - P[up][0], P[fo][1] - P[up][1], P[fo][2] - P[up][2]]);
  quatTo(rig.q, up * 4, restUp, nrm(invRot(W, B_.chest * 12, [E[0] - S[0], E[1] - S[1], E[2] - S[2]])));
  poseRig(rig, rootM);
  const wr = side > 0 ? rig.parts.P.wristL : rig.parts.P.wristR;
  const restFo = nrm([wr[0] - P[fo][0], wr[1] - P[fo][1], wr[2] - P[fo][2]]);
  quatTo(rig.q, fo * 4, restFo, nrm(invRot(W, up * 12, [H[0] - E[0], H[1] - E[1], H[2] - E[2]])));
  void tmp;
}

// ---- the poses (victory, defeat, taunt, fidgets): bone -> [x, y, z] Euler, plus a face -------------------------
const ARMS_UP = { armL: [-2.9, 0, 0.25], armR: [-2.9, 0, -0.25] };
const POSES = {
  trophy: { face: EXPR.happy, bones: { armR: [-3.0, 0, -0.15], foreR: [-0.2, 0, 0], armL: [0.3, 0, 0.9], foreL: [-1.8, 0.6, 0], chest: [-0.12, 0, 0], head: [-0.2, 0.2, 0.1] }, show: ['receipt'] },
  slump: { face: EXPR.crying, bones: { chest: [0.75, 0, 0], head: [0.5, 0, 0.2], armL: [-0.8, 0, 0.1], armR: [-0.8, 0, -0.1], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0] }, drop: 0.08 },
  bagSwing: { face: EXPR.smug, bones: { armL: [-3.0, 0, 0.3], foreL: [-0.4, 0, 0], armR: [0.2, 0, -0.6], chest: [-0.1, 0, 0.1] }, spin: 'x1' },
  fist: { face: EXPR.angry, bones: { armR: [-2.6, 0.2, -0.3], foreR: [-1.4, 0, 0], chest: [0.1, 0, -0.1], head: [-0.1, 0, 0] }, shake: 'foreR' },
  flex: { face: EXPR.smug, bones: { armL: [0.1, 0, 1.5], foreL: [-2.2, 0, 0], armR: [0.1, 0, -1.5], foreR: [-2.2, 0, 0], chest: [-0.1, 0, 0] } },
  hamstring: { face: EXPR.shocked, bones: { chest: [0.6, 0, 0.1], thighR: [-0.4, 0, 0], shinR: [1.2, 0, 0], armR: [0.6, 0, -0.2], foreR: [-0.3, 0, 0], armL: [-0.6, 0, 0.6], head: [-0.3, 0, 0] }, hop: 1 },
  fanCoupons: { face: EXPR.happy, bones: { armL: [-1.6, 0, 0.9], foreL: [-0.6, 0, 0], armR: [-2.4, 0, -0.4], chest: [-0.08, 0, 0] }, wave: 'armL' },
  tearCoupon: { face: EXPR.crying, bones: { armL: [-1.2, 0, -0.2], foreL: [-1.0, 0, 0], armR: [-1.2, 0, 0.2], foreR: [-1.0, 0, 0], chest: [0.2, 0, 0], head: [0.3, 0, 0] } },
  flash: { face: EXPR.happy, bones: { armR: [-2.9, 0.4, -0.3], foreR: [-0.3, 0, 0], armL: [-0.2, 0, 0.4], foreL: [-1.6, 0, 0], head: [-0.1, 0.3, 0.25], chest: [0, 0.2, 0] } },
  coverLens: { face: EXPR.crying, bones: { armR: [-1.6, 0, -0.1], foreR: [-1.2, 0, 0], armL: [-1.4, 0, 0.2], foreL: [-1.6, 0, 0], head: [0.2, -0.6, 0], chest: [0.15, -0.3, 0] } },
  bellyBump: { face: EXPR.happy, bones: { hips: [-0.25, 0, 0], chest: [-0.3, 0, 0], armL: [0.6, 0, 0.5], armR: [0.6, 0, -0.5], head: [-0.2, 0, 0] }, thrust: 1 },
  sadSip: { face: EXPR.crying, bones: { armR: [-1.4, 0, -0.3], foreR: [-1.9, 0, 0], head: [0.35, 0, 0], chest: [0.3, 0, 0] } },
  wheelie: { face: EXPR.happy, bones: { chest: [-0.25, 0, 0], head: [-0.3, 0, 0] }, wheelie: 1 },
  batteryDies: { face: EXPR.dizzy, bones: { chest: [0.7, 0, 0.1], head: [0.6, 0, 0.3], armL: [-0.5, 0, 0], armR: [-0.5, 0, 0] } },
  taunt: { face: EXPR.happy, bones: { armR: [-1.6, 0.6, -0.2], foreR: [-0.1, 0, 0], chest: [-0.15, -0.3, 0], head: [-0.1, -0.6, 0.2] }, laugh: 1 },
};
const POSE_OF = (rig, kind) => POSES[rig.look[kind]] || POSES.trophy;
// The lineup: each character strikes an attitude. hands = wrist targets in character space.
const SHOW = {
  penny: { face: EXPR.happy, hands: { L: [0.19, 0.64, 0.03], R: [-0.19, 0.64, 0.03] }, bones: { chest: [-0.06, 0.1, 0], head: [0.02, -0.18, -0.1], hips: [0, -0.08, 0] } },
  granny: { face: EXPR.angry, hands: { R: [-0.3, 0.92, 0.12] }, bones: { head: [-0.05, -0.15, 0.08] }, shake: 'foreR' },
  dad: { face: EXPR.smug, hands: { L: [0.17, 1.02, 0.02], R: [-0.17, 1.02, 0.02] }, bones: { chest: [-0.14, 0, 0], head: [-0.1, 0.12, 0] } },
  queen: { face: EXPR.happy, hands: { R: [-0.44, 1.18, 0.2], L: [0.42, 1.02, 0.22] }, bones: { head: [-0.08, 0.18, 0.05], chest: [0, 0.15, 0] } },
  selfie: { face: EXPR.happy, hands: { R: [-0.38, 1.38, 0.26], L: [0.3, 1.12, 0.2] }, bones: { head: [-0.05, -0.32, 0.22], chest: [0, -0.12, 0] } },
  bubba: { face: EXPR.happy, hands: { R: [-0.6, 1.48, 0.22], L: [0.2, 1.08, 0.44] }, bones: { head: [-0.12, 0, 0], hips: [-0.08, 0, 0] } },
  gramps: { face: EXPR.smug, hands: { R: [-0.16, 0.98, 0.34], L: [0.17, 0.72, 0.06] }, bones: { head: [0.02, -0.2, 0.08], chest: [0.05, 0, 0] } },
};

// ---- animation --------------------------------------------------------------------------------------------
// s: { mode ('push' | 'stand' | 'count' | 'victory' | 'defeat' | 'taunt' | 'tumble'), speed, accel, yaw (rate),
//      steer, drift (-1..1), dash (seconds since a dash, or -1), boost, air (0..1 of a jump), stun (seconds left),
//      squash (an impulse 0..1), handle ([y, z, half width] of the grips in character space), look ([x, y, z] or null),
//      expr (a face to force), seat (riding a scooter) }
// dt in seconds. rootM (optional) is the character root's 3x4 matrix in its parent's space.
export function animate(rig, s, dt, rootM) {
  const k = 1 - Math.exp(-dt * 14), kk = 1 - Math.exp(-dt * 6), L = rig.look, t = (rig.t += dt), mode = s.mode || 'push';
  rig.q.fill(0); for (let b = 0; b < rig.nb; b++) rig.q[b * 4 + 3] = 1;
  rig.off.fill(0); rig.sc.fill(1);
  const spd = Math.max(0, s.speed || 0), legLen = L.leg.len[0] + L.leg.len[1], fast = clamp(spd / 12, 0, 1.4);
  const posed = mode === 'victory' || mode === 'defeat' || mode === 'taunt' || mode === 'show';
  // riding: on the cart's rear bar at a boost, a dash or in the air
  const rideT = !posed && mode === 'push' && (s.boost || (s.dash >= 0 && s.dash < 0.45) || s.air > 0 || s.seat) ? 1 : 0;
  rig.ride += (rideT - rig.ride) * (1 - Math.exp(-dt * 10));
  const ride = s.seat ? 1 : rig.ride;
  // the stride: frequency = speed / stride length, so planted feet keep pace with the floor
  const stride = legLen * (1.15 + 0.1 * Math.min(spd, 11));
  if (mode === 'push') rig.phase += spd / stride * Math.PI * 2 * dt * (1 - ride);
  const run = mode === 'push' ? clamp(spd / 1.5, 0, 1) * (1 - ride) : 0, ph = rig.phase;
  const amp = Math.asin(clamp(stride / (4 * legLen), 0, 0.85)) * run;
  // lean with speed and acceleration, roll into turns and drifts
  const leanT = mode === 'push' ? 0.16 + 0.22 * fast * (1 - ride * 0.5) + clamp((s.accel || 0) * 0.012, -0.12, 0.18) : mode === 'count' ? 0.1 : 0;
  rig.lean += (leanT - rig.lean) * kk;
  const rollT = mode === 'push' ? clamp(-(s.yaw || 0) * spd * 0.012, -0.25, 0.25) - (s.drift || 0) * 0.22 : 0;
  rig.roll += (rollT - rig.roll) * k;
  // dash: a 0.1 s crouch, then a stretch; impacts squash
  let sy = 1;
  if (s.dash >= 0 && s.dash < 0.1) sy = 0.86; else if (s.dash >= 0.1 && s.dash < 0.35) sy = 1.1 - (s.dash - 0.1) * 0.4;
  if (s.squash) rig.sq = Math.max(rig.sq, s.squash);
  rig.sq = Math.max(0, rig.sq - dt * 4);
  sy *= 1 - 0.28 * rig.sq * rig.sq;
  const sxz = 1 / Math.sqrt(sy);
  // the root: bob, ride height, squash
  const bob = Math.abs(Math.sin(ph)) * 0.035 * run * (0.6 + 0.4 * fast);
  rig.off[1] = bob + ride * (s.seat ? 0 : 0.22);
  rig.sc[0] = sxz; rig.sc[1] = sy; rig.sc[2] = sxz;
  eul(rig, B_.root, rig.lean * 0.35, 0, rig.roll);
  // hips and chest
  const twist = Math.sin(ph) * 0.12 * run;
  go(rig, B_.hips, 0, twist, 0, k);
  go(rig, B_.chest, rig.lean * 0.9 - ride * 0.1, -twist * 1.3, rig.roll * 0.4, k);
  // legs
  const legs = (side) => {
    const th = side > 0 ? B_.thighL : B_.thighR, sh = side > 0 ? B_.shinL : B_.shinR, ft = side > 0 ? B_.footL : B_.footR;
    const p = ph + (side > 0 ? 0 : Math.PI), sw = -amp * Math.sin(p), knee = Math.max(0, Math.cos(p)) * (0.5 + 0.7 * fast) * run;
    let tx = sw + rig.lean * 0.4 * (mode === 'push' ? 1 : 0), ty = 0, tz = 0, kn = knee + 0.06, fx = -(sw + knee) * 0.5;
    if (ride > 0.01) {                       // riding: knees bent on the rear bar, one foot back
      tx = tx * (1 - ride) + ride * (side > 0 ? -0.75 : -0.35); kn = kn * (1 - ride) + ride * (side > 0 ? 1.4 : 0.9); fx = fx * (1 - ride) + ride * (side > 0 ? -0.5 : -0.3);
    }
    if (s.drift && side === -Math.sign(s.drift)) { tz = side * 0.55; tx -= 0.35; kn *= 0.3; }     // the outer leg kicks out
    if (mode === 'count' || mode === 'stand') { tx = 0.02 * side; kn = 0.05; fx = 0; }
    go(rig, th, tx, ty, tz, k); go(rig, sh, kn, 0, 0, k); go(rig, ft, fx, 0, 0, k);
  };
  legs(1); legs(-1);
  // head: looks at s.look, wobbles after a hit, laughs in a taunt
  let hx = -rig.lean * 0.55 - 0.05, hy = 0, hz = 0;
  if (s.look) { hy = clamp(Math.atan2(s.look[0], s.look[2]), -1.0, 1.0); hx += clamp(-Math.atan2(s.look[1] - L.head.y, Math.hypot(s.look[0], s.look[2])) * 0.5, -0.3, 0.4); }
  if (s.stun > 0) { rig.wob = Math.min(1, rig.wob + dt * 6); } else rig.wob = Math.max(0, rig.wob - dt * 2);
  hz += Math.sin(t * 17) * 0.3 * rig.wob; hx += Math.sin(t * 13) * 0.12 * rig.wob;
  go(rig, B_.head, hx, hy, hz, k);
  // the idle fidget of the countdown and the lineup
  if (mode === 'count' || mode === 'stand') fidget(rig, s, t, k);
  // poses at the checkout and when overtaking
  if (posed) applyPose(rig, mode === 'show' ? SHOW[rig.id] || SHOW.penny : mode === 'victory' ? POSE_OF(rig, 'victory') : mode === 'defeat' ? POSE_OF(rig, 'defeat') : POSES.taunt, t, mode === 'show' ? 1 : k);
  else rig.poseK = 0;
  // tumble: thrown out of the cart, limbs flailing
  if (mode === 'tumble') {
    const f = t * 14;
    for (const [b, a] of [[B_.armL, 1], [B_.armR, -1], [B_.thighL, 1], [B_.thighR, -1]]) go(rig, b, Math.sin(f + a) * 1.4 - 0.8, 0, a * (0.6 + Math.sin(f * 1.3) * 0.5), 0.5);
    go(rig, B_.shinL, 0.8 + Math.sin(f) * 0.6, 0, 0, 0.5); go(rig, B_.shinR, 0.8 - Math.sin(f) * 0.6, 0, 0, 0.5);
  }
  // secondary motion: hair, the belly, a handbag, the scarf (springs driven by the head's movement)
  secondary(rig, s, dt, rootM);
  // arms on the handle (or free in poses and the lineup)
  const hold = s.handle && !posed && mode !== 'tumble' && mode !== 'stand';
  if (hold) {
    const [hy0, hz0, hw] = s.handle;
    for (const side of [1, -1]) reach(rig, side, [side * hw, hy0, hz0], rootM);
  } else if (!posed && mode !== 'tumble') {
    for (const side of [1, -1]) { const ar = side > 0 ? B_.armL : B_.armR, fo = side > 0 ? B_.foreL : B_.foreR; go(rig, ar, Math.sin(t * 2 + side) * 0.05, 0, side * 0.08, k); go(rig, fo, -0.25, 0, 0, k); }
  }
  if (mode === 'stand' || mode === 'count') fidgetArms(rig, s, t, k, hold, rootM);
  const P = posed && (mode === 'show' ? SHOW[rig.id] : null);
  if (P && P.hands) { for (const [side, key] of [[1, 'L'], [-1, 'R']]) if (P.hands[key]) reach(rig, side, P.hands[key], rootM); if (P.shake) { const b = B_[P.shake], q = rig.q, w = Math.sin(t * 26) * 0.18, c = Math.cos(w / 2), sn = Math.sin(w / 2), o = b * 4; const x = q[o], y = q[o + 1], z = q[o + 2], ww = q[o + 3]; q[o] = ww * sn + x * c; q[o + 1] = y * c + z * sn; q[o + 2] = z * c - y * sn; q[o + 3] = ww * c - x * sn; } }
  // props shown only in a pose (Penny's receipt)
  // face: an event face wins for a moment, otherwise blink now and then
  let e = s.expr !== undefined && s.expr !== null ? s.expr : rig.poseFace !== undefined && posed ? rig.poseFace : s.stun > 0 ? EXPR.dizzy : EXPR.neutral;
  rig.blink -= dt;
  if (rig.blink < 0) { if (e === EXPR.neutral || e === EXPR.smug || e === EXPR.angry) e = EXPR.blink; if (rig.blink < -0.11) rig.blink = 2 + ((t * 7.3) % 2.5); }
  setFace(rig, e);
  poseRig(rig, rootM);
}

function applyPose(rig, P, t, k) {
  rig.poseK = Math.min(1, rig.poseK + 0.05);
  rig.poseFace = P.face;
  for (const name in P.bones) { const v = P.bones[name], b = B_[name]; go(rig, b, v[0], v[1], v[2], k * 0.7); }
  if (P.shake) { const b = B_[P.shake], a = rig.ang; eul(rig, b, a[b * 3] + Math.sin(t * 30) * 0.25, a[b * 3 + 1], a[b * 3 + 2]); }
  if (P.wave) { const b = B_[P.wave], a = rig.ang; eul(rig, b, a[b * 3], a[b * 3 + 1], a[b * 3 + 2] + Math.sin(t * 9) * 0.35); }
  if (P.spin) { const b = B_.armL, a = rig.ang; eul(rig, b, a[b * 3], t * 9, a[b * 3 + 2]); }
  if (P.hop) rig.off[1] += Math.abs(Math.sin(t * 9)) * 0.08;
  if (P.laugh) rig.off[1] += Math.abs(Math.sin(t * 16)) * 0.03;
  if (P.thrust) rig.off[2] += Math.max(0, Math.sin(t * 6)) * 0.1;
  if (P.drop) rig.off[1] -= P.drop;
}

// The countdown fidget: each character does its own thing.
function fidget(rig, s, t, k) {
  const id = rig.look.idle;
  if (id === 'bounce') { rig.off[1] += Math.abs(Math.sin(t * 7)) * 0.04; go(rig, B_.head, -0.05, Math.sin(t * 1.7) * 0.4, Math.sin(t * 3.4) * 0.08, k); }
  else if (id === 'stretch') { go(rig, B_.thighR, -0.5 - 0.2 * Math.sin(t * 2), 0, 0, k); go(rig, B_.shinR, 0.1, 0, 0, k); go(rig, B_.chest, 0.35 + 0.15 * Math.sin(t * 2), 0, 0, k); }
  else if (id === 'sip') { go(rig, B_.head, -0.25 * Math.max(0, Math.sin(t * 1.5)), 0, 0, k); }
  else if (id === 'rev') { rig.off[1] += Math.abs(Math.sin(t * 20)) * 0.012; }
  else if (id === 'selfie') { go(rig, B_.head, -0.1, 0.25, 0.25, k); }
  else if (id === 'glasses') { go(rig, B_.head, -0.05 + Math.sin(t * 2.3) * 0.06, Math.sin(t * 0.9) * 0.3, 0, k); }
  else if (id === 'fan') { go(rig, B_.head, -0.08, Math.sin(t * 1.4) * 0.3, 0.1, k); }
}
function fidgetArms(rig, s, t, k, hold, rootM) {
  const id = rig.look.idle;
  if (id === 'glasses' && Math.sin(t * 1.3) > 0.4) { go(rig, B_.armR, -1.9, 0.3, 0.3, 0.3); go(rig, B_.foreR, -1.6, 0, 0, 0.3); }
  else if (id === 'fan') { go(rig, B_.armL, -1.4, 0, 0.7 + Math.sin(t * 10) * 0.25, 0.3); go(rig, B_.foreL, -0.7, 0, 0, 0.3); }
  else if (id === 'sip' && Math.sin(t * 1.5) > 0) { go(rig, B_.armR, -1.3, 0, -0.35, 0.25); go(rig, B_.foreR, -1.9, 0, 0, 0.25); }
  else if (id === 'selfie') { go(rig, B_.armR, -2.6, 0.3, -0.3, 0.25); go(rig, B_.foreR, -0.2, 0, 0, 0.25); }
  else if (id === 'rev' && hold) { const a = rig.ang; eul(rig, B_.foreR, a[B_.foreR * 3] + Math.sin(t * 20) * 0.12, a[B_.foreR * 3 + 1], a[B_.foreR * 3 + 2]); }
  void s; void rootM;
}

// Springs: hair follows the head with a lag; a belly and a handbag swing; the scarf streams behind with speed.
function secondary(rig, s, dt, rootM) {
  const id = rig.id, hv = rig.hairV, h = rig.hair, spd = s.speed || 0;
  const yaw = (s.yaw || 0) + (s.drift || 0) * 2;
  const acc = (s.accel || 0) * 0.03 + (s.dash >= 0 && s.dash < 0.3 ? 0.6 : 0) + (s.air > 0 ? -0.3 : 0);
  // drive: pitch back with speed and acceleration, swing sideways in turns, bounce with the stride
  const runB = Math.sin(rig.phase * 2) * 0.12 * clamp(spd / 6, 0, 1) * (1 - rig.ride);
  const tP = clamp(spd * 0.05 + acc, -0.5, 1.2) + runB, tR = clamp(-yaw * 0.25, -0.9, 0.9);
  for (let i = 0; i < 2; i++) {
    const stiff = i ? 60 : 90, damp = i ? 5 : 7;
    hv[i * 2] += ((tP * (i ? 1.3 : 1) - h[i * 2]) * stiff - hv[i * 2] * damp) * dt;
    hv[i * 2 + 1] += ((tR * (i ? 1.3 : 1) - h[i * 2 + 1]) * stiff - hv[i * 2 + 1] * damp) * dt;
    h[i * 2] = clamp(h[i * 2] + hv[i * 2] * dt, -1.2, 1.5); h[i * 2 + 1] = clamp(h[i * 2 + 1] + hv[i * 2 + 1] * dt, -1.2, 1.2);
  }
  if (id === 'penny' || id === 'selfie' || id === 'queen') {
    const k = id === 'penny' ? 1 : id === 'queen' ? 0.25 : 0.4;
    eul(rig, B_.hair1, h[0] * 0.6 * k + rig.lean * 0.3, 0, h[1] * 0.6 * k);
    eul(rig, B_.hair2, h[2] * 0.8 * k, 0, h[3] * 0.8 * k);
  }
  if (id === 'gramps') {         // the scarf streams back with speed and flaps
    const f = clamp(spd / 10, 0, 1) + 0.15, flap = Math.sin(rig.t * 14) * 0.25 * f;
    eul(rig, B_.x1, -0.3 + f * 0.9 + flap, h[1] * 0.6, 0); eul(rig, B_.x2, f * 0.4 - flap * 1.5, h[3] * 0.8, 0);
  }
  if (id === 'bubba') {          // the belly jiggles with every stride and bump
    rig.bellyV += ((Math.sin(rig.phase * 2) * 0.05 * clamp(spd / 4, 0, 1) - rig.belly) * 120 - rig.bellyV * 6) * dt + (rig.sq > 0.5 ? 0.6 : 0);
    rig.belly += rig.bellyV * dt;
    const j = 1 + rig.belly; rig.sc[B_.belly * 3] = 1 / Math.sqrt(Math.max(0.6, j)); rig.sc[B_.belly * 3 + 1] = j; rig.sc[B_.belly * 3 + 2] = 1 / Math.sqrt(Math.max(0.6, j));
  }
  if (id === 'granny') {         // the handbag swings from the wrist
    const bv = rig.bagV, bg = rig.bag;
    bv[0] += ((h[0] * 0.8 - bg[0]) * 40 - bv[0] * 3) * dt; bv[1] += ((h[1] * 0.8 - bg[1]) * 40 - bv[1] * 3) * dt;
    bg[0] = clamp(bg[0] + bv[0] * dt, -1, 1); bg[1] = clamp(bg[1] + bv[1] * dt, -1, 1);
    eul(rig, B_.x1, bg[0], 0, bg[1]);
  }
  void rootM;
}
