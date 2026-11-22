// DOORBUSTER — figure.js
// Purpose: the character geometry (ART.md section 3): one rigid-skinned toy figure per named character
//          (super-ellipsoid head carrying the face atlas, lathe torso with prints and seams, ball-jointed
//          limbs, mitten hands, chunky shoes, sculpted hair clumps and each character's props), and the
//          simplified crowd figures (body, head, arms, legs, an accent prop) in a near and a far version.
// Exports: BONE, NB, figureParts, buildFigure, crowdFigure, eyeSpot
// Depends on: config.js, shapes.js, atlas.js, cast.js.
//
// Every vertex belongs to one bone (rigid skinning). Pivots are recorded in rest space; rig.js poses them.

import { mix } from './config.js';
import { at, push, pop, bind, box, cyl, ellipsoid, lathe, tube, clump, ring, extrude, quad } from './shapes.js';
import { PAT } from './atlas.js';
import { CAST, CROWD } from './cast.js';

export const BONE = { root: 0, hips: 1, chest: 2, head: 3, armL: 4, foreL: 5, armR: 6, foreR: 7, thighL: 8, shinL: 9, footL: 10,
  thighR: 11, shinR: 12, footR: 13, hair1: 14, hair2: 15, prop: 16, belly: 17, x1: 18, x2: 19 };
export const NB = 20;            // bones of a figure; a racer appends the cart's (rig.js)
const PARENT = [-1, 0, 1, 2, 2, 4, 2, 6, 1, 8, 9, 1, 11, 12, 3, 14, 7, 2, 3, 18];
const NONE = [0, 0, 0, 0];
const darker = (c, k = 0.82) => mix(c, 0x2A1A3A, 1 - k);

// Where things are on a figure: joint positions and the parent of every bone.
export function figureParts(look) {
  const t = look.torso, a = look.arm, l = look.leg, hd = look.head;
  const P = new Array(NB).fill(null).map(() => [0, 0, 0]);
  P[BONE.hips] = [0, t.hip, 0];
  P[BONE.chest] = [0, t.hip + (t.shoulder - t.hip) * 0.28, 0];
  P[BONE.head] = [0, t.shoulder + 0.01, 0];
  for (const s of [1, -1]) {
    const sh = [s * a.at[0], a.at[1], 0], el = [s * (a.at[0] + 0.025), a.at[1] - a.len[0], -0.01], wr = [s * (a.at[0] + 0.035), a.at[1] - a.len[0] - a.len[1], 0.02];
    P[s > 0 ? BONE.armL : BONE.armR] = sh; P[s > 0 ? BONE.foreL : BONE.foreR] = el;
    const hip = [s * l.at[0], l.at[1], 0], kn = [s * l.at[0], l.at[1] - l.len[0], 0.012], an = [s * l.at[0], l.at[1] - l.len[0] - l.len[1], 0];
    P[s > 0 ? BONE.thighL : BONE.thighR] = hip; P[s > 0 ? BONE.shinL : BONE.shinR] = kn; P[s > 0 ? BONE.footL : BONE.footR] = an;
    if (s > 0) { P.wristL = wr; } else P.wristR = wr;
  }
  P[BONE.hair1] = [0, hd.y + hd.r[1] * 0.85, -hd.r[2] * 0.35];
  P[BONE.hair2] = [0, hd.y + hd.r[1] * 1.45, -hd.r[2] * 0.6];
  P[BONE.prop] = P.wristR.slice();
  P[BONE.belly] = [0, t.hip + (t.shoulder - t.hip) * 0.35, t.w[1] * t.d * 0.6];
  const parent = PARENT.slice(), ex = look.extras || [];
  if (ex.includes('scarf')) { P[BONE.x1] = [0.05, t.shoulder, -0.08]; P[BONE.x2] = [0.1, t.shoulder - 0.08, -0.4]; parent[BONE.x1] = BONE.chest; }
  else { P[BONE.x1] = P.wristL.slice(); P[BONE.x2] = P.wristL.slice(); parent[BONE.x1] = BONE.foreL; }
  return { P, parent, head: hd, hand: a.hand, len: a.len };
}

// A point on the front of the head for atlas pixel (px, py) of the face cell (glasses sit on the eyes).
export function eyeSpot(look, px, py) {
  const h = look.head, fw = h.r[0] * 0.92, fh = h.r[1] * 0.92;
  const x = (px / 256 - 0.5) * 2 * fw, y = (0.5 - py / 256) * 2 * fh;
  const q = 1 - (x * x) / (h.r[0] * h.r[0]) - (y * y) / (h.r[1] * h.r[1]);
  return [x, h.y + y, h.r[2] * Math.sqrt(Math.max(0.05, q)) * 0.97];
}

// ---- the named figure ---------------------------------------------------------------------------------------
export function buildFigure(B, id, o = {}) {
  const L = CAST[id], parts = figureParts(L), P = parts.P, sk = L.skin;
  const T = L.torso, A = L.arm, G = L.leg, H = L.head;
  const tex = (pat) => pat ? [4, PAT[pat], 0, 0] : NONE;
  const occl = (y0, y1, k) => (x, y) => 1 - k * Math.max(0, Math.min(1, (y1 - y) / (y1 - y0)));
  // ---- head (bone head)
  bind(B, BONE.head, NONE, (x, y, z) => 1 - 0.2 * Math.max(0, Math.min(1, (H.y - H.r[1] * 0.55 - y) / (H.r[1] * 0.35))) * (z > -0.05 ? 1 : 0.4));
  at(B, 0, H.y, 0);
  ellipsoid(B, H.r[0], H.r[1], H.r[2], sk, { seg: 24, rings: 16, e1: 0.92, e2: 0.94, uv: 'face', fw: H.r[0] * 0.92, fh: H.r[1] * 0.92, faceZ: 0.12, faceTex: [1, 0, 0, 0],
    warp: (p) => { const k = 1 - 0.1 * Math.max(0, Math.min(1, -p[1] / H.r[1])); return [p[0] * k, p[1], p[2] * k]; } });
  bind(B, BONE.head, NONE, null);
  if (H.ears) for (const s of [1, -1]) { at(B, s * H.r[0] * 0.95, H.y - 0.01, -0.005, s * 0.25); ellipsoid(B, 0.034, 0.05, 0.03, mix(sk, 0xFF7A90, 0.12), { seg: 8, rings: 6 }); }
  at(B, 0, H.y - H.r[1] * 0.13, H.r[2] * 0.93); ellipsoid(B, H.nose[0], H.nose[1], H.nose[2], mix(sk, 0xFF7A90, 0.14), { seg: 10, rings: 6 });
  bind(B, BONE.head, NONE, null);
  at(B, 0, T.shoulder - 0.06, 0); cyl(B, 0.058, 0.055, H.y - T.shoulder, darker(sk, 0.9), { seg: 12, top: false });
  // ---- torso (bone chest), pelvis (bone hips)
  const hy = T.hip, sy = T.shoulder, span = sy - hy, w = T.w;
  const prof = [[w[0] * 0.98, hy - 0.06], [w[0], hy], [w[1], hy + span * 0.32], [w[2], hy + span * 0.68], [w[3], sy - 0.035], [w[3] * 0.8, sy + 0.01], [0.075, sy + 0.035]];
  bind(B, BONE.chest, tex(T.pat), (x, y) => 1 - 0.12 * Math.max(0, Math.min(1, (hy + 0.04 - y) / 0.1)));
  at(B, 0, 0, 0);
  lathe(B, prof, T.color, { seg: 26, squash: [1, T.d], cap: true, colorAt: (y, k) => k <= 1 ? T.band : k >= 5 && T.collar ? T.collar : T.color, hard: (k) => k === 1 || k === 4 });
  bind(B, BONE.chest, NONE, null);
  if (T.jacket) {          // a cropped jacket over the top: a second shell, open at the front
    lathe(B, [[w[2] * 1.06, hy + span * 0.48], [w[2] * 1.08, hy + span * 0.68], [w[3] * 1.07, sy - 0.03], [w[3] * 0.86, sy + 0.012], [0.09, sy + 0.04]], T.jacket, { seg: 26, squash: [1, T.d * 1.04] });
  }
  if (T.belly) {            // a belly on its own bone, so it jiggles: the tank top rides up over the lowest part
    bind(B, BONE.belly, NONE, null);
    at(B, 0, hy + span * 0.3, w[1] * T.d * 0.35);
    ellipsoid(B, w[1] * 1.0, span * 0.42, w[1] * T.d * 0.82, T.color, { seg: 24, rings: 16, colorAt: (x, y) => y < -span * 0.27 ? sk : undefined });
  }
  bind(B, BONE.hips, NONE, null);
  at(B, 0, hy - 0.01, 0); ellipsoid(B, w[0] * 0.98, 0.1, w[0] * T.d * 1.02, L.skirt ? L.skirt.color : G.color, { seg: 20, rings: 12 });
  if (L.skirt) { at(B, 0, 0, 0); lathe(B, [[L.skirt.flare, L.skirt.to], [L.skirt.flare * 0.92, L.skirt.to + 0.06], [w[0] * 1.03, hy + 0.04]], L.skirt.color, { seg: 24, squash: [1, T.d * 1.05], cap: false }); }
  // details on the chest
  bind(B, BONE.chest, NONE, null);
  if (L.top && L.top.logo) chestPatch(B, prof, T.d, hy + span * 0.66, 0.1, 0.62, [3, PAT.logo, 0, 0]);
  if (T.racing) for (const s of [1, -1]) { at(B, 0, 0, 0); chestStripe(B, prof, T.d, s * 0.33); }
  if (L.top && L.top.pocket) { at(B, 0, hy + span * 0.2, w[1] * T.d + 0.004, 0, -0.18); box(B, w[1] * 1.0, span * 0.22, 0.022, T.band, { bevel: 0.4 }); }
  if (L.top && L.top.hood) { at(B, 0, 0, 0); const pts = []; for (let i = 0; i <= 10; i++) { const a = -1.2 + i / 10 * 2.4; pts.push([Math.sin(a) * 0.13, sy + 0.02 + Math.cos(a * 0.9) * 0.015, -Math.cos(a) * 0.1 - 0.02]); } tube(B, pts, 0.055, T.band, { seg: 10, flat: [1, 0.75], caps: 'round' }); }
  if (L.top && L.top.strings) for (const s of [1, -1]) { at(B, 0, 0, 0); tube(B, [[s * 0.045, sy - 0.01, w[3] * T.d * 0.75], [s * 0.05, sy - 0.12, w[2] * T.d * 0.98]], 0.009, L.top.strings, { seg: 5, caps: 'round' }); }
  if (T.collar && id === 'granny') { for (const s of [1, -1]) { at(B, s * 0.05, sy - 0.005, w[3] * T.d * 0.62, s * -0.5, -0.3); box(B, 0.1, 0.02, 0.07, T.collar, { bevel: 0.4 }); } }
  // ---- arms
  for (const s of [1, -1]) {
    const up = s > 0 ? BONE.armL : BONE.armR, fo = s > 0 ? BONE.foreL : BONE.foreR, sh = P[up], el = P[fo], wr = s > 0 ? P.wristL : P.wristR;
    const sleeve = A.bare ? sk : A.sleeve;
    bind(B, up, A.stripe ? [4, PAT.track, 0, 0] : NONE, null);
    at(B, sh[0], sh[1], sh[2]); ellipsoid(B, A.r[0] * 1.12, A.r[0] * 1.1, A.r[0] * 1.08, A.bare ? T.color : sleeve, { seg: 12, rings: 8 });
    at(B, 0, 0, 0); tube(B, [sh, [(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2, -0.005], el], (t) => A.r[0] * (1 - 0.12 * t), sleeve, { seg: 12 });
    bind(B, fo, A.stripe ? [4, PAT.track, 0, 0] : NONE, null);
    at(B, el[0], el[1], el[2]); ellipsoid(B, A.r[0] * 0.92, A.r[0] * 0.92, A.r[0] * 0.92, sleeve, { seg: 10, rings: 6 });
    at(B, 0, 0, 0); tube(B, [el, wr], (t) => A.r[1] * (1.04 - 0.08 * t), sleeve, { seg: 12, colorAt: (t) => t > 0.8 ? A.cuff : sleeve });
    bind(B, fo, NONE, null);
    mitten(B, wr, A.hand, s, sk, L.gloves);
  }
  // ---- legs
  for (const s of [1, -1]) {
    const th = s > 0 ? BONE.thighL : BONE.thighR, sn = s > 0 ? BONE.shinL : BONE.shinR, ft = s > 0 ? BONE.footL : BONE.footR;
    const hip = P[th], kn = P[sn], an = P[ft], pants = G.color, low = G.shorts ? sk : pants;
    bind(B, th, tex(G.pat), null);
    at(B, 0, 0, 0); tube(B, [hip, [hip[0], (hip[1] + kn[1]) / 2, 0.01], kn], (t) => G.r[0] * (1.06 - 0.12 * t), G.shorts ? G.color : pants, { seg: 12, colorAt: G.shorts ? (t) => t > 0.75 ? sk : G.color : undefined });
    bind(B, sn, tex(G.shorts ? null : G.pat), null);
    at(B, kn[0], kn[1], kn[2]); ellipsoid(B, G.r[0] * 0.86, G.r[0] * 0.86, G.r[0] * 0.86, G.shorts ? sk : low, { seg: 10, rings: 6 });
    at(B, 0, 0, 0); tube(B, [kn, [an[0], an[1] + 0.04, 0]], (t) => G.r[1] * (1.05 - 0.15 * t) * (L.skirt && !G.pat ? 0.95 : 1), low, { seg: 12, colorAt: (t) => !G.shorts && t > 0.86 && G.pat ? darker(pants, 0.88) : low });
    bind(B, ft, NONE, null);
    shoe(B, an, L.shoe, s);
  }
  hairAndExtras(B, id, L, P);
  return parts;
}

// a decal patch on the front of the torso (the % logo): an arc of the lathe surface, slightly proud of it
function chestPatch(B, prof, d, y, hh, ang, tx) {
  const rAt = (yy) => { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= yy) { const a = prof[i - 1], b = prof[i], t = (yy - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * t; } return prof[prof.length - 1][0]; };
  at(B, 0, 0, 0);
  const n = 8, m = 4;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const P = (ii, jj) => { const a = (ii / n - 0.5) * ang, yy = y + (0.5 - jj / m) * hh * 2, r = rAt(yy) + 0.006; return [Math.sin(a) * r, yy, Math.cos(a) * r * d]; };
    quad(B, P(i, j + 1), P(i + 1, j + 1), P(i + 1, j), P(i, j), 0xFFFFFF, tx, [[i / n, (j + 1) / m], [(i + 1) / n, (j + 1) / m], [(i + 1) / n, j / m], [i / n, j / m]]);
  }
}
function chestStripe(B, prof, d, a0) { const pts = []; for (let k = 2; k <= 4; k++) { const [r, y] = prof[k]; pts.push([Math.sin(a0) * (r + 0.004), y, Math.cos(a0) * (r + 0.004) * d]); } tube(B, pts, 0.018, 0xFFFFFF, { seg: 6, flat: [1, 0.35] }); }

// A mitten hand under the wrist: palm, a thumb pointing forward, a crease drawn by the ink.
function mitten(B, wr, r, s, skin, glove) {
  const c = glove || skin;
  at(B, wr[0] + s * 0.004, wr[1] - r * 0.72, wr[2] + 0.005, s * -0.25, 0.05);
  ellipsoid(B, r * 0.78, r * 1.02, r * 0.62, c, { seg: 12, rings: 8, e1: 0.85, e2: 0.85 });
  at(B, wr[0] - s * r * 0.35, wr[1] - r * 0.45, wr[2] + r * 0.42, 0, -0.5, s * 0.6);
  ellipsoid(B, r * 0.28, r * 0.46, r * 0.28, c, { seg: 8, rings: 6 });
}

// Shoes: sneaker (chunky sole, toe cap, laces), loafer, heel (pointed toe on a spike), platform.
function shoe(B, an, S, s) {
  const x = an[0], y = 0, zf = S.l * 0.62, zb = -S.l * 0.38, w = S.w;
  const sole = S.style === 'platform' ? S.h * 0.5 : S.style === 'heel' ? S.h * 0.18 : S.h * 0.34;
  if (S.style === 'heel') {
    at(B, x, S.h * 0.55, (zf + zb) / 2 + 0.02, 0, -0.32); ellipsoid(B, w, S.h * 0.42, S.l * 0.5, S.color, { seg: 14, rings: 10, e2: 0.9 });
    at(B, x, 0, zb + 0.02); cyl(B, 0.016, 0.02, S.h * 0.75, S.sole, { seg: 8 });
    at(B, x, S.h * 0.1, zf - 0.03, 0, 0.15); ellipsoid(B, w * 0.8, S.h * 0.18, S.l * 0.22, S.color, { seg: 12, rings: 8 });
    return;
  }
  at(B, x, 0, (zf + zb) / 2); box(B, w * 2.1, sole, S.l, S.sole, { bevel: 0.45, top: S.sole });
  at(B, x, sole * 0.92, (zf + zb) / 2 - 0.01);
  ellipsoid(B, w * 0.96, (S.h - sole) * 1.05, S.l * 0.5, S.color, { seg: 14, rings: 8, e1: 0.8, e2: 0.9, cut: 0.98,
    colorAt: (px, py, pz) => pz > S.l * 0.3 ? mix(S.color, S.trim, 0.0) : undefined });
  at(B, x, sole * 0.95, zf - S.l * 0.22, 0, -0.1); ellipsoid(B, w * 0.86, (S.h - sole) * 0.62, S.l * 0.22, S.style === 'loafer' ? S.color : mix(S.color, 0xFFFFFF, 0.3), { seg: 12, rings: 8 });
  if (S.style !== 'loafer') { at(B, x, S.h * 0.86, -0.01 + S.l * 0.05, 0, -0.55); box(B, w * 0.9, 0.012, S.l * 0.36, S.trim, { bevel: 0.3, lid: [4, PAT.laces, 0, 0] }); }
  if (S.style === 'sneaker' || S.style === 'platform') for (const k of [1, -1]) { at(B, x + k * w * 1.0, sole + (S.h - sole) * 0.4, -0.005, k * 1.571); box(B, S.l * 0.36, 0.035, 0.008, S.trim, { bevel: 0.3, mid: true }); }
}

// ---- hair styles and props ---------------------------------------------------------------------------------
function hairAndExtras(B, id, L, P) {
  const H = L.head, r = H.r, hy = H.y, c = L.hair.color, acc = L.hair.accent, g = [0, 0, 0.55, 0];
  const cap = (k, keep, colr, tx) => { bind(B, BONE.head, tx || g, null); at(B, 0, hy, 0); ellipsoid(B, r[0] * k, r[1] * k, r[2] * k, colr || c, { seg: 20, rings: 12, e1: 0.92, e2: 0.94, keep }); at(B, 0, 0, 0); };
  at(B, 0, 0, 0);
  const front = (x, y, z) => !(z > r[2] * 0.2 && y < hy + r[1] * 0.42 && Math.abs(x) < r[0] * 0.98) && !(Math.abs(x) > r[0] * 0.75 && y < hy - r[1] * 0.1 && z > -r[2] * 0.4);
  const st = L.hair.style;
  if (st === 'ponytail') {
    cap(1.05, front);
    // bangs sweeping to one side, side locks in front of the ears
    for (const [x, ang, len] of [[-0.12, 0.5, 0.17], [-0.05, 0.35, 0.19], [0.03, 0.2, 0.18], [0.1, 0.05, 0.15], [0.16, -0.1, 0.12]]) {
      const root = [x * 0.9, hy + r[1] * 0.82, r[2] * 0.62], tip = [x + ang * 0.12, hy + r[1] * 0.42, r[2] * 1.03];
      clump(B, root, [x + ang * 0.02, hy + r[1] * 0.9, r[2] * 1.02], tip, 0.052 * (len / 0.17), c, { flat: [1, 0.45], tip: 0.1 });
    }
    for (const s of [1, -1]) clump(B, [s * r[0] * 0.86, hy + r[1] * 0.35, r[2] * 0.2], [s * r[0] * 1.02, hy, r[2] * 0.35], [s * r[0] * 0.9, hy - r[1] * 0.5, r[2] * 0.3], 0.05, c, { flat: [0.6, 1], tip: 0.12 });
    // the scrunchie and a tall fountain ponytail on two bones
    bind(B, BONE.hair1, NONE, null);
    const base = P[BONE.hair1];
    at(B, base[0], base[1] + 0.02, base[2], 0, -0.35); ring(B, 0.07, 0.07, 0.03, 0.05, acc, { seg: 16 });
    bind(B, BONE.hair1, g, null); at(B, 0, 0, 0);
    for (const [dx, dz] of [[0, 0], [0.05, 0.02], [-0.05, 0.02], [0, -0.04]]) clump(B, [base[0] + dx * 0.4, base[1] + 0.01, base[2] + dz * 0.4], [base[0] + dx, base[1] + 0.2, base[2] + dz - 0.02], [base[0] + dx * 1.3, base[1] + 0.32, base[2] - 0.08 + dz], 0.075, c, { tip: 0.6, flat: [1, 0.8] });
    bind(B, BONE.hair2, g, null);
    const tp = P[BONE.hair2];
    for (const [dx, dz, k] of [[0, 0, 1], [0.07, 0.04, 0.85], [-0.07, 0.04, 0.85], [0.03, -0.06, 0.8], [-0.04, -0.05, 0.75]]) clump(B, [tp[0] + dx * 0.5, tp[1] - 0.05, tp[2] + 0.05 + dz * 0.5], [tp[0] + dx * 1.4, tp[1] + 0.06 * k, tp[2] - 0.04 + dz], [tp[0] + dx * 1.9, tp[1] - 0.18 * k, tp[2] - 0.2 + dz], 0.07 * k, c, { tip: 0.12, flat: [1, 0.6] });
  } else if (st === 'curlers') {
    cap(1.06, front, c, [4, PAT.net, 0.3, 0]);
    bind(B, BONE.head, [0, 0, 0.3, 0], null);
    for (let i = 0; i < 10; i++) { const a = -2.3 + i / 9 * 4.6; at(B, Math.sin(a) * r[0] * 0.98, hy + r[1] * (0.05 + 0.08 * (i % 2)), Math.cos(a) * r[2] * 0.98); ellipsoid(B, 0.06, 0.055, 0.06, c, { seg: 10, rings: 8 }); }
    bind(B, BONE.head, NONE, null);
    for (let i = 0; i < 5; i++) { const a = -1 + i * 0.5; at(B, Math.sin(a) * r[0] * 0.55, hy + r[1] * 0.98 - Math.abs(a) * 0.05, Math.cos(a) * r[2] * 0.25 - 0.05, 0, 0, Math.PI / 2 + a * 0.3); cyl(B, 0.034, 0.034, 0.13, i % 2 ? acc : 0x7CD5C4, { seg: 10, mid: true, top: 0xFFFFFF, bottom: 0xFFFFFF }); }
  } else if (st === 'short') {
    cap(1.04, (x, y, z) => front(x, y, z) && y > hy - r[1] * 0.2);
    for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.48; clump(B, [Math.sin(a) * r[0] * 0.6, hy + r[1] * 0.9, Math.cos(a) * r[2] * 0.3 + 0.02], [Math.sin(a) * r[0] * 0.75, hy + r[1] * 1.12, Math.cos(a) * r[2] * 0.4], [Math.sin(a) * r[0] * 0.95, hy + r[1] * 1.02, Math.cos(a) * r[2] * 0.75 - 0.05], 0.06, c, { tip: 0.2 }); }
    bind(B, BONE.head, NONE, null);
    at(B, 0, hy + r[1] * 0.5, 0); lathe(B, [[r[0] * 1.07, -0.035], [r[0] * 1.1, 0], [r[0] * 1.07, 0.035]], 0xFFFFFF, { seg: 26, squash: [1, r[2] / r[0]], colorAt: (y, k) => k === 1 ? 0xE63946 : 0xFFFFFF });
  } else if (st === 'teased') {
    bind(B, BONE.hair1, g, null);
    at(B, 0, hy + r[1] * 0.55, -r[2] * 0.15); ellipsoid(B, r[0] * 1.55, r[1] * 1.15, r[2] * 1.35, c, { seg: 24, rings: 16, keep: (x, y, z) => !(z > r[2] * 0.5 && y < hy + r[1] * 0.5) });
    at(B, 0, 0, 0);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, rr = 1.45; const root = [Math.sin(a) * r[0] * 0.9, hy + r[1] * 0.9, Math.cos(a) * r[2] * 0.6 - 0.1]; clump(B, root, [Math.sin(a) * r[0] * rr * 1.1, hy + r[1] * 1.3, Math.cos(a) * r[2] * rr - 0.15], [Math.sin(a) * r[0] * rr * 1.25, hy + r[1] * (0.6 + 0.2 * Math.sin(a * 3)), Math.cos(a) * r[2] * rr * 1.1 - 0.2], 0.09, c, { tip: 0.25 }); }
    bind(B, BONE.head, g, null);
    cap(1.05, (x, y, z) => front(x, y, z), c);
    for (const s of [1, -1]) clump(B, [s * 0.04, hy + r[1] * 0.95, r[2] * 0.6], [s * 0.18, hy + r[1] * 1.05, r[2] * 1.0], [s * 0.26, hy + r[1] * 0.45, r[2] * 0.85], 0.07, c, { tip: 0.2 });
  } else if (st === 'bun') {
    cap(1.035, front);
    bind(B, BONE.hair1, g, null);
    at(B, 0, hy + r[1] * 1.12, -0.02); ellipsoid(B, 0.12, 0.1, 0.12, c, { seg: 18, rings: 12 });
    at(B, 0, hy + r[1] * 1.0, -0.02); ring(B, 0.1, 0.1, 0.022, 0.04, acc, { seg: 16 });
    bind(B, BONE.head, g, null); at(B, 0, 0, 0);
    for (const s of [1, -1]) clump(B, [s * r[0] * 0.7, hy + r[1] * 0.6, r[2] * 0.6], [s * r[0] * 1.02, hy + r[1] * 0.1, r[2] * 0.62], [s * r[0] * 0.94, hy - r[1] * 0.5, r[2] * 0.35], 0.04, c, { tip: 0.15 });
  } else if (st === 'cap') {
    cap(1.03, (x, y, z) => z < r[2] * 0.1 && y < hy + r[1] * 0.4 && y > hy - r[1] * 0.45);
    bind(B, BONE.head, NONE, null);
    at(B, 0, hy + r[1] * 0.28, 0); ellipsoid(B, r[0] * 1.08, r[1] * 0.82, r[2] * 1.1, 0xFFFFFF, { seg: 24, rings: 14, cut: 1, keep: (x, y) => y > hy + r[1] * 0.3, colorAt: (x, y, z) => z > r[2] * 0.15 ? 0xFFFFFF : acc });
    at(B, 0, hy + r[1] * 0.46, r[2] * 0.95, 0, 0.18); extrude(B, [[-0.2, 0], [0.2, 0], [0.18, 0.16], [0.08, 0.21], [-0.08, 0.21], [-0.18, 0.16]].map(([x, y]) => [x, y - 0.02]), 0.025, acc);
    at(B, 0, hy + r[1] * 1.08, 0); ellipsoid(B, 0.028, 0.02, 0.028, acc, { seg: 8, rings: 6 });
  } else if (st === 'tufts') {
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) clump(B, [s * r[0] * 0.92, hy + r[1] * (0.25 - i * 0.18), -r[2] * (0.1 + i * 0.12)], [s * r[0] * 1.12, hy + r[1] * (0.35 - i * 0.18), -r[2] * (0.25 + i * 0.12)], [s * r[0] * 1.2, hy + r[1] * (0.15 - i * 0.18), -r[2] * (0.45 + i * 0.1)], 0.055, c, { tip: 0.25 });
  }
  for (const x of L.extras || []) extra(B, x, L, P);
}

function extra(B, x, L, P) {
  const H = L.head, r = H.r, hy = H.y;
  at(B, 0, 0, 0);
  const gap = L.face.eyeGap || 47, ey = L.face.eyeY || 112;
  bind(B, BONE.head, NONE, null);
  if (x === 'shadesUp') {
    for (const s of [1, -1]) { at(B, s * 0.08, hy + r[1] * 0.86, r[2] * 0.42, 0, -1.0); ring(B, 0.052, 0.046, 0.012, 0.03, 0xB02A6E); at(B, s * 0.08, hy + r[1] * 0.86, r[2] * 0.42, 0, -1.0 + Math.PI / 2); ellipsoid(B, 0.046, 0.008, 0.04, 0x2EC4B6, { seg: 12, rings: 4, tex: [0, 0, 1, 0] }); }
  } else if (x === 'bottleGlasses' || x === 'catEyes' || x === 'bigShades') {
    for (const s of [1, -1]) {
      const e = eyeSpot(L, 128 + s * gap, ey);
      if (x === 'bottleGlasses') { at(B, e[0], e[1], e[2] + 0.02); ring(B, 0.062, 0.064, 0.013, 0.03, 0x6A3D8F, { seg: 22 }); at(B, e[0] - 0.02, e[1] + 0.025, e[2] + 0.03, 0, 0, 0.6); box(B, 0.012, 0.03, 0.003, 0xFFFFFF, { bevel: 0, mid: true }); }
      else if (x === 'catEyes') { at(B, e[0], e[1] + 0.005, e[2] + 0.018, 0, 0, s * -0.15); extrude(B, catEye(0.07, 0.05, s, 1.0), 0.02, 0xE63946, { holes: [catEye(0.052, 0.034, s, 0.9).reverse()] }); }
      else { at(B, e[0] * 1.05, e[1] - 0.005, e[2] + 0.03); ellipsoid(B, 0.088, 0.072, 0.025, 0x1E1B2E, { seg: 16, rings: 8, tex: [0, 0, 1, 0] }); at(B, e[0] * 1.05, e[1] - 0.005, e[2] + 0.035); ring(B, 0.09, 0.075, 0.013, 0.025, 0xFFFFFF, { seg: 22 }); }
    }
    const a = eyeSpot(L, 128, ey);
    at(B, a[0], a[1] + 0.01, a[2] + 0.025, 0, 0, Math.PI / 2); cyl(B, 0.008, 0.008, 0.05, x === 'catEyes' ? 0xE63946 : x === 'bigShades' ? 0xFFFFFF : 0x6A3D8F, { seg: 6, mid: true });
    at(B, 0, 0, 0);
    for (const s of [1, -1]) { const e = eyeSpot(L, 128 + s * (gap + 32), ey); tube(B, [[e[0], e[1], e[2]], [s * r[0] * 0.98, hy + 0.01, 0]], 0.008, x === 'bigShades' ? 0xFFFFFF : 0x6A3D8F, { seg: 5 }); }
  } else if (x === 'moustache' || x === 'moustacheWhite') {
    const c = x === 'moustache' ? 0x5A3418 : 0xF4F1FA, y = hy - r[1] * 0.3, z = r[2] * 0.93;
    for (const s of [1, -1]) clump(B, [s * 0.005, y + 0.01, z + 0.02], [s * 0.07, y + 0.015, z + 0.01], [s * 0.13, y - 0.05, z - 0.04], x === 'moustache' ? 0.04 : 0.05, c, { tip: 0.25, flat: [1, 0.65] });
  } else if (x === 'whiteBrows') {
    for (const s of [1, -1]) { const e = eyeSpot(L, 128 + s * gap, ey - 52); clump(B, [e[0] - s * 0.04, e[1], e[2] + 0.01], [e[0], e[1] + 0.03, e[2] + 0.03], [e[0] + s * 0.07, e[1] + 0.01, e[2] - 0.01], 0.03, 0xF4F1FA, { tip: 0.3 }); }
  } else if (x === 'goggles') {
    at(B, 0, hy + r[1] * 0.62, 0); lathe(B, [[r[0] * 1.05, -0.025], [r[0] * 1.07, 0], [r[0] * 1.05, 0.025]], 0x3A2A22, { seg: 26, squash: [1, r[2] / r[0]] });
    for (const s of [1, -1]) { at(B, s * 0.075, hy + r[1] * 0.66, r[2] * 0.82, s * 0.2, -0.5); cyl(B, 0.05, 0.046, 0.05, 0xC0C6D0, { seg: 16, top: 0xFFB13B, lid: [0, 0, 1, 0.2] }); }
  } else if (x === 'beard') {
    const c = 0x3B2416;
    for (let i = 0; i < 9; i++) { const a = -1.25 + i / 8 * 2.5, y = hy - r[1] * (0.35 + 0.25 * Math.cos(a)); clump(B, [Math.sin(a) * r[0] * 0.95, y + 0.06, Math.cos(a) * r[2] * 0.75], [Math.sin(a) * r[0] * 1.0, y - 0.04, Math.cos(a) * r[2] * 0.98], [Math.sin(a) * r[0] * 0.8, y - 0.13 - 0.04 * Math.cos(a), Math.cos(a) * r[2] * 0.95], 0.065, c, { tip: 0.3 }); }
    for (const s of [1, -1]) clump(B, [s * 0.02, hy - r[1] * 0.28, r[2] * 0.95], [s * 0.09, hy - r[1] * 0.27, r[2] * 0.96], [s * 0.15, hy - r[1] * 0.42, r[2] * 0.85], 0.04, c, { tip: 0.3 });
  } else if (x === 'pearls') {
    bind(B, BONE.chest, [0, 0, 0.8, 0], null);
    const T = L.torso;
    for (let i = 0; i < 11; i++) { const a = -1.3 + i / 10 * 2.6; at(B, Math.sin(a) * 0.12, T.shoulder - 0.02 - Math.cos(a) * 0.05, Math.cos(a) * 0.12 * T.d + 0.04); ellipsoid(B, 0.017, 0.017, 0.017, 0xFFF8F0, { seg: 8, rings: 6 }); }
  } else if (x === 'whistle') {
    bind(B, BONE.chest, NONE, null);
    const T = L.torso, pts = [];
    at(B, 0, 0, 0);
    for (let i = 0; i <= 10; i++) { const a = -1.4 + i / 10 * 2.8; pts.push([Math.sin(a) * 0.1, T.shoulder + 0.01 - (1 - Math.abs(Math.sin(a))) * 0.16, Math.cos(a) * 0.115 * T.d + 0.035]); }
    tube(B, pts, 0.007, 0xE63946, { seg: 5 });
    at(B, 0, T.shoulder - 0.165, T.w[2] * T.d + 0.035, 0, 0, Math.PI / 2); cyl(B, 0.022, 0.022, 0.06, 0xDDE3EA, { seg: 10, mid: true, side: [0, 0, 1, 0] });
  } else if (x === 'earrings' || x === 'hoops') {
    for (const s of [1, -1]) { at(B, s * r[0] * 0.98, hy - 0.06, 0.0, s * Math.PI / 2); ring(B, x === 'hoops' ? 0.035 : 0.022, x === 'hoops' ? 0.035 : 0.022, 0.007, 0.012, 0xFFD23F, { seg: 12 }); }
  } else if (x === 'handbag') {
    bind(B, BONE.x1, [0, 0, 0.4, 0], null);
    const w = P.wristL;
    at(B, w[0] + 0.07, w[1] - 0.22, w[2] + 0.02, 0.3); box(B, 0.32, 0.25, 0.14, 0xC2789E, { bevel: 0.35, top: 0xA85E84 });
    at(B, w[0] + 0.07, w[1] - 0.07, w[2] + 0.02 + 0.071, 0.3, 0.1); box(B, 0.3, 0.1, 0.02, 0xA85E84, { bevel: 0.4, mid: true });
    at(B, w[0] + 0.07, w[1] - 0.12, w[2] + 0.1, 0.3); ellipsoid(B, 0.022, 0.022, 0.012, 0xFFD23F, { seg: 8, rings: 6, tex: [0, 0, 1, 0] });
    at(B, 0, 0, 0); const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; pts.push([w[0] + 0.07 + Math.cos(a) * 0.1 * Math.cos(0.3), w[1] - 0.04 + Math.sin(a) * 0.09, w[2] + 0.02 - Math.cos(a) * 0.1 * Math.sin(0.3)]); }
    tube(B, pts, 0.013, 0xA85E84, { seg: 6 });
  } else if (x === 'megaphone') {
    bind(B, BONE.prop, [0, 0, 0.3, 0], null);
    const w = P.wristR;
    at(B, w[0] - 0.02, w[1] - 0.06, w[2] + 0.05, 0, -Math.PI / 2 + 0.2); cyl(B, 0.05, 0.13, 0.3, 0xFFFFFF, { seg: 16, top: 0xE63946, bottom: true });
    at(B, w[0] - 0.02, w[1] - 0.06 + 0.0, w[2] + 0.05 + 0.29, 0, -Math.PI / 2 + 0.2); cyl(B, 0.135, 0.135, 0.03, 0xE63946, { seg: 16, top: 0x5A1E3A });
  } else if (x === 'couponFan') {
    bind(B, BONE.x1, NONE, null);
    const w = P.wristL;
    for (let i = 0; i < 5; i++) { at(B, w[0] + 0.02, w[1] - 0.05, w[2] + 0.05, 0.2, 0, -0.7 + i * 0.32); push(B); at(B, 0, 0.1, 0); box(B, 0.07, 0.17, 0.006, 0xFFF6D6, { bevel: 0.1, mid: true, front: [3, PAT.coupons, 0, 0] }); pop(B); }
  } else if (x === 'selfieStick') {
    bind(B, BONE.prop, NONE, null);
    const w = P.wristR;
    at(B, 0, 0, 0); tube(B, [[w[0], w[1] - 0.05, w[2] + 0.04], [w[0] - 0.05, w[1] + 0.55, w[2] + 0.35]], 0.012, 0x2A2440, { seg: 6, caps: 'round' });
    at(B, w[0] - 0.05, w[1] + 0.62, w[2] + 0.38, Math.PI, -0.4); box(B, 0.09, 0.17, 0.018, 0xFF4FD8, { bevel: 0.3, mid: true, front: [3, PAT.screen, 0, 0.6] });
  } else if (x === 'soda') {
    bind(B, BONE.prop, NONE, null);
    const w = P.wristR;
    at(B, w[0] - 0.03, w[1] - 0.2, w[2] + 0.1); cyl(B, 0.085, 0.11, 0.3, 0xE63946, { seg: 16, top: 0xFFFFFF, side: [4, PAT.stripes, 0, 0] });
    at(B, w[0] - 0.03, w[1] + 0.1, w[2] + 0.1); cyl(B, 0.115, 0.105, 0.035, 0xFFFFFF, { seg: 16 });
    at(B, 0, 0, 0); tube(B, [[w[0] - 0.02, w[1] + 0.1, w[2] + 0.1], [w[0] - 0.02, w[1] + 0.28, w[2] + 0.12], [w[0] + 0.04, w[1] + 0.33, w[2] + 0.12]], 0.012, 0xFFD23F, { seg: 6, caps: 'round' });
  } else if (x === 'scarf') {
    const T = L.torso;
    bind(B, BONE.chest, [4, PAT.stripes, 0, 0], null);
    at(B, 0, T.shoulder + 0.02, 0); lathe(B, [[0.14, -0.03], [0.155, 0.0], [0.14, 0.05]], 0xE63946, { seg: 20, squash: [1, T.d], uRep: 4 });
    bind(B, BONE.x1, [4, PAT.stripes, 0, 0], null);
    const b = P[BONE.x2];
    at(B, 0, 0, 0); tube(B, [[0.05, T.shoulder, -0.08], [0.08, T.shoulder - 0.05, -0.22], [0.1, T.shoulder - 0.08, -0.4]], (t) => 0.045 * (1 - t * 0.2), 0xE63946, { seg: 8, flat: [1, 0.3] });
    bind(B, BONE.x2, [4, PAT.stripes, 0, 0], null);
    tube(B, [[0.1, T.shoulder - 0.08, -0.4], [0.12, T.shoulder - 0.1, -0.6], [0.14, T.shoulder - 0.12, -0.78]], (t) => 0.036 * (1 - t * 0.3), 0xE63946, { seg: 8, flat: [1, 0.3], caps: 'flat' });
    void b;
  }
}
function catEye(w, h, s, k) { const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, flick = Math.max(0, Math.cos(a - (s > 0 ? 0.6 : 2.54))) ** 6 * 0.035 * k; pts.push([Math.cos(a) * (w + flick), Math.sin(a) * h + flick * 0.8]); } return pts; }

// ---- crowd figures -----------------------------------------------------------------------------------------
// Parts: 0 body (hips and torso), 1 head, 2 left arm, 3 right arm, 4 left leg, 5 right leg, 6 prop, 7 second prop.
// Vertex colours carry occlusion only where a slot colour applies (slot 1 cloth, 2 pants, 3 skin, 4 hair);
// fixed-colour props have slot 0. far = the 800-triangle version with a two-dot face.
export const CPART = { body: 0, head: 1, armL: 2, armR: 3, legL: 4, legR: 5, prop: 6, prop2: 7 };
export function crowdFigure(B, kind, far) {
  const K = CROWD[kind], h = K.h, seat = K.seated ? 0.55 : 1;
  const build = { round: [0.24, 0.9, 0.36], thin: [0.15, 0.7, 0.32], mid: [0.18, 0.78, 0.33], kid: [0.15, 0.9, 0.42], buff: [0.24, 0.8, 0.3], belly: [0.27, 0.95, 0.33], mascot: [0.3, 0.9, 0.3] }[K.build];
  const [bw, bd, headK] = build, headR = Math.min(0.26, h * headK * 0.33 + 0.04), hipY = h * (K.build === 'kid' ? 0.36 : 0.47) * seat;
  const shY = h - headR * 2 + 0.02, legR = bw * 0.36, armR = bw * 0.28;
  const sl = (slot) => [0, slot, 0, 0];
  const pivots = [[0, hipY, 0], [0, shY, 0], [bw + armR * 0.6, shY - 0.04, 0], [-(bw + armR * 0.6), shY - 0.04, 0], [bw * 0.42, hipY, 0], [-bw * 0.42, hipY, 0], [0, hipY + 0.2, 0.2], [0, 0, 0]];
  const seg = far ? 8 : 14, rings = far ? 6 : 10, hs = far ? 12 : 18, hr = far ? 8 : 12;
  const W = 0xFFFFFF;
  // body: torso (cloth) on hips (pants)
  bind(B, CPART.body, sl(1), (x, y) => 1 - 0.15 * Math.max(0, Math.min(1, (hipY + 0.05 - y) / 0.12)));
  at(B, 0, 0, 0);
  const belly = K.build === 'belly' ? 1.35 : K.build === 'buff' ? 1.1 : 1;
  const top = K.build === 'mascot' ? h * 0.92 : shY + 0.02;
  lathe(B, [[bw * 0.95, hipY - 0.05], [bw, hipY + 0.04], [bw * belly, hipY + (top - hipY) * 0.4], [bw * (K.build === 'buff' ? 1.25 : 1.02), top - 0.08], [bw * 0.7, top], [0.06, top + 0.03]], W, { seg: far ? 10 : 18, squash: [1, bd], cap: true });
  bind(B, CPART.body, sl(2), null);
  at(B, 0, hipY - 0.02, 0); ellipsoid(B, bw * 0.95, 0.09, bw * bd, W, { seg, rings: 6 });
  if (K.apron) { bind(B, CPART.body, sl(0), null); at(B, 0, hipY - 0.12, bw * bd * 0.85); box(B, bw * 1.5, (top - hipY) * 0.85, 0.02, 0xFF5A4E, { bevel: 0.3 }); }
  if (K.hood) { bind(B, CPART.body, sl(1), null); at(B, 0, 0, 0); const pts = []; for (let i = 0; i <= 6; i++) { const a = -1.2 + i / 6 * 2.4; pts.push([Math.sin(a) * bw * 0.7, top - 0.01, -Math.cos(a) * bw * 0.55]); } tube(B, pts, 0.05, W, { seg: 6, caps: 'round' }); }
  // head
  bind(B, CPART.head, sl(3), null);
  const hy = K.build === 'mascot' ? h * 0.92 + headR * 0.3 : shY + headR * 0.95;
  if (K.build === 'mascot') {       // the hot-dog mascot: a sausage in a bun, a face hole
    bind(B, CPART.body, sl(0), null);
    at(B, 0, h * 0.5, 0); lathe(B, [[0.01, h * 0.1], [0.32, h * 0.2], [0.36, h * 0.55], [0.3, h * 0.95], [0.02, h * 1.02]], 0xE8A85C, { seg: far ? 10 : 18, squash: [1, 0.75], cap: true });
    at(B, 0, h * 0.55, 0.06); ellipsoid(B, 0.2, h * 0.5, 0.2, 0xD9542C, { seg: far ? 8 : 14, rings: far ? 6 : 10 });
    at(B, 0, h * 0.72, 0.17); ellipsoid(B, 0.14, 0.15, 0.08, 0xF2D2BC, { seg: hs, rings: hr, uv: 'face', fw: 0.13, fh: 0.14, faceZ: -1, faceTex: [1, 3, 0, 0] });
    bind(B, CPART.head, sl(0), null);
    at(B, 0, h * 0.86, 0.15, 0, 0, Math.PI / 2); tube(B, [[0, -0.12, 0], [0.04, 0, 0], [0, 0.12, 0]], 0.025, 0xFFD23F, { seg: 6 });
  } else {
    at(B, 0, hy, 0);
    ellipsoid(B, headR, headR * 1.02, headR * 0.95, W, { seg: hs, rings: hr, e1: 0.92, uv: 'face', fw: headR * 0.92, fh: headR * 0.92, faceZ: 0.1, faceTex: [1, 3, 0, 0] });
    at(B, 0, hy - headR * 0.12, headR * 0.92); ellipsoid(B, headR * 0.13, headR * 0.11, headR * 0.12, W, { seg: 8, rings: 6 });
    crowdHair(B, K, hy, headR, far);
  }
  // arms and legs
  for (const s of [1, -1]) {
    const a = pivots[s > 0 ? 2 : 3], l = pivots[s > 0 ? 4 : 5], al = (shY - hipY) * 0.95 + 0.05;
    bind(B, s > 0 ? CPART.armL : CPART.armR, sl(K.build === 'buff' ? 3 : 1), null);
    at(B, 0, 0, 0); tube(B, [a, [a[0] + s * 0.03, a[1] - al * 0.5, 0], [a[0] + s * 0.04, a[1] - al, 0.03]], armR * (K.build === 'buff' ? 1.3 : 1), W, { seg: far ? 6 : 10, caps: 'round' });
    bind(B, s > 0 ? CPART.armL : CPART.armR, sl(3), null);
    at(B, a[0] + s * 0.04, a[1] - al - 0.02, 0.03); ellipsoid(B, armR * 1.15, armR * 1.3, armR * 1.0, W, { seg: far ? 6 : 10, rings: far ? 5 : 7 });
    bind(B, s > 0 ? CPART.legL : CPART.legR, sl(2), null);
    const ll = K.seated ? hipY * 0.9 : hipY - 0.06;
    at(B, 0, 0, 0); tube(B, [l, [l[0], l[1] - ll * 0.5, K.seated ? 0.2 : 0.01], [l[0], Math.max(0.08, l[1] - ll), K.seated ? 0.28 : 0]], legR, W, { seg: far ? 6 : 10 });
    bind(B, s > 0 ? CPART.legL : CPART.legR, sl(0), null);
    at(B, l[0], 0, (K.seated ? 0.3 : 0) + 0.06); box(B, legR * 2.3, 0.1, 0.24, 0x4A4458, { bevel: 0.45, top: 0x5A5468 });
  }
  crowdProp(B, K, pivots, hipY, shY, far);
  return { pivots, headY: hy };
}
function crowdHair(B, K, hy, r, far) {
  const c = [0, 4, 0.35, 0], st = K.hair;
  if (st === 'none' || st === 'bald') { if (K.hat === 'flat') { bind(B, CPART.head, [0, 0, 0, 0], null); at(B, 0, hy + r * 0.62, 0, 0, -0.1); cyl(B, r * 1.1, r * 0.95, r * 0.35, 0x6E6A7A, { seg: 14, top: 0x7E7A8A }); } return; }
  bind(B, CPART.head, c, null);
  at(B, 0, hy, 0);
  ellipsoid(B, r * 1.06, r * 1.07, r * 1.04, 0xFFFFFF, { seg: far ? 10 : 16, rings: far ? 7 : 10, keep: (x, y, z) => !(z > r * 0.25 && y < hy + r * 0.45) && !(Math.abs(x) > r * 0.6 && y < hy - r * 0.3 && z > -r * 0.3) });
  at(B, 0, 0, 0);
  if (far) return;
  if (st === 'bun') { at(B, 0, hy + r * 0.9, -r * 0.4); ellipsoid(B, r * 0.45, r * 0.4, r * 0.45, 0xFFFFFF, { seg: 10, rings: 8 }); at(B, 0, 0, 0); }
  else if (st === 'pony') clump(B, [0, hy + r * 0.5, -r * 0.9], [0, hy + r * 0.1, -r * 1.35], [0, hy - r * 0.6, -r * 1.2], r * 0.35, 0xFFFFFF, { tip: 0.2 });
  else if (st === 'long') for (const s of [1, -1]) clump(B, [s * r * 0.8, hy + r * 0.4, -r * 0.2], [s * r * 1.1, hy - r * 0.3, -r * 0.3], [s * r * 0.95, hy - r * 1.2, -r * 0.4], r * 0.4, 0xFFFFFF, { tip: 0.3 });
  else if (st === 'tuft') clump(B, [0, hy + r * 0.9, 0], [0.02, hy + r * 1.3, 0.05], [-0.04, hy + r * 1.4, -0.06], r * 0.18, 0xFFFFFF, { tip: 0.2 });
  else if (st === 'fringe' || st === 'messy') for (let i = 0; i < 4; i++) { const x = (i - 1.5) * r * 0.35; clump(B, [x, hy + r * 0.8, r * 0.45], [x + 0.03, hy + r * 0.85, r * 0.95], [x + 0.05, hy + r * 0.45, r * 1.02], r * 0.2, 0xFFFFFF, { tip: 0.2 }); }
  else if (st === 'band') { bind(B, CPART.head, [0, 0, 0, 0], null); at(B, 0, hy + r * 0.45, 0); lathe(B, [[r * 1.08, -0.025], [r * 1.1, 0], [r * 1.08, 0.025]], 0xFF5A4E, { seg: 14 }); }
  else if (st === 'cap') { bind(B, CPART.head, [0, 0, 0, 0], null); at(B, 0, hy + r * 0.35, 0); ellipsoid(B, r * 1.1, r * 0.75, r * 1.1, 0x5A7A9A, { seg: 14, rings: 8, keep: (x, y) => y > hy + r * 0.38 }); at(B, 0, hy + r * 0.45, r * 0.95, 0, 0.15); box(B, r * 1.3, 0.02, r * 0.8, 0x5A7A9A, { bevel: 0.5 }); }
}
function crowdProp(B, K, pv, hipY, shY, far) {
  const p = K.prop, hand = pv[3], L = pv[2], ink = 0x4A4458;
  const handR = [hand[0] + -0.04, hand[1] - (shY - hipY) * 0.95 - 0.1, 0.06], handL = [L[0] + 0.04, L[1] - (shY - hipY) * 0.95 - 0.1, 0.06];
  bind(B, CPART.prop, [0, 0, 0, 0], null);
  at(B, 0, 0, 0);
  if (p === 'walker') { for (const s of [1, -1]) for (const z of [0.25, 0.55]) { at(B, s * 0.24, 0, z); cyl(B, 0.022, 0.022, 0.78, 0xC0C6D0, { seg: 6, top: 0x5A5468 }); } at(B, 0, 0.76, 0.4); box(B, 0.52, 0.04, 0.34, 0xC0C6D0, { bevel: 0.4 }); for (const s of [1, -1]) { at(B, s * 0.24, 0.04, 0.55); ellipsoid(B, 0.045, 0.045, 0.045, 0x7CC6FE, { seg: 8, rings: 6 }); } }
  else if (p === 'cane') { tube(B, [[handR[0], handR[1] + 0.05, 0.12], [handR[0], 0.02, 0.18]], 0.018, 0x8A5A3A, { seg: 6 }); tube(B, [[handR[0], handR[1] + 0.05, 0.12], [handR[0], handR[1] + 0.12, 0.08], [handR[0], handR[1] + 0.06, 0.02]], 0.018, 0x8A5A3A, { seg: 6 }); }
  else if (p === 'stroller') {
    at(B, 0, 0.42, 0.7); box(B, 0.5, 0.4, 0.62, 0xBFD3C1, { bevel: 0.35, top: 0x9FB3A1 });
    at(B, 0, 0.8, 0.45, 0, -0.9); ellipsoid(B, 0.27, 0.27, 0.3, 0x7D8E82, { seg: 14, rings: 10, cut: 0.55 });
    for (const s of [1, -1]) for (const z of [0.45, 0.95]) { at(B, s * 0.26, 0.12, z, 0, 0, Math.PI / 2); cyl(B, 0.12, 0.12, 0.05, 0x3A3A48, { seg: 12, mid: true, top: 0xC0C6D0 }); }
    at(B, 0, 0, 0); tube(B, [[-0.22, 0.85, 0.35], [-0.22, 1.0, 0.15], [0.22, 1.0, 0.15], [0.22, 0.85, 0.35]], 0.02, 0xC0C6D0, { seg: 6 });
    bind(B, CPART.prop2, [0, 0, 0, 0], null);           // the baby, crying, on its own part (it bobs)
    at(B, 0, 0.78, 0.72); ellipsoid(B, 0.12, 0.12, 0.11, 0xF6DCCB, { seg: 12, rings: 10, uv: 'face', fw: 0.11, fh: 0.11, faceZ: 0.2, faceTex: [1, 0, 0, 0] });
  }
  else if (p === 'leash') { at(B, 0, 0, 0); tube(B, [[0, shY - 0.05, -0.12], [0.05, shY + 0.1, -0.4], [0.1, shY + 0.05, -0.75], [0.12, 0.06, -1.0]], 0.012, 0xFF5A4E, { seg: 5 }); at(B, 0, shY - 0.05, -0.02); lathe(B, [[0.17, -0.03], [0.18, 0], [0.17, 0.03]], 0xFF5A4E, { seg: 12, squash: [1, 0.8] }); }
  else if (p === 'phone') { at(B, handR[0] + 0.02, handR[1] + 0.12, 0.22, 0, -0.8); box(B, 0.07, 0.13, 0.015, 0x2A2440, { bevel: 0.3, mid: true, front: [3, 20, 0, 0.5] }); }
  else if (p === 'shaker') { at(B, handR[0], handR[1] + 0.03, 0.08); cyl(B, 0.045, 0.045, 0.17, 0x3A86FF, { seg: 10, top: 0x2A2440 }); }
  else if (p === 'bottle') { at(B, handR[0], handR[1] + 0.03, 0.08); cyl(B, 0.035, 0.035, 0.18, 0x7CC6FE, { seg: 10, top: 0xFF5A4E }); }
  else if (p === 'hotdog') { at(B, handR[0], handR[1] + 0.08, 0.1, 0, 0, 0.3); ellipsoid(B, 0.12, 0.035, 0.04, 0xE8A85C, { seg: 10, rings: 6 }); at(B, handR[0], handR[1] + 0.1, 0.1, 0, 0, 0.3); ellipsoid(B, 0.13, 0.022, 0.025, 0xD9542C, { seg: 8, rings: 6 }); }
  else if (p === 'box') { at(B, 0, shY - 0.32, 0.3); box(B, 0.42, 0.32, 0.34, 0xC98A5B, { bevel: 0.08, top: 0xE0A878 }); }
  else if (p === 'bags') for (const [x, c] of [[0.3, 0xFF8FAB], [0.36, 0xFFD23F], [-0.32, 0x9B5DE5]]) { at(B, x, hipY - 0.2, 0.05, x); box(B, 0.2, 0.24, 0.08, c, { bevel: 0.2 }); at(B, 0, 0, 0); tube(B, [[x - 0.06, hipY + 0.03, 0.05], [x, hipY + 0.12, 0.05], [x + 0.06, hipY + 0.03, 0.05]], 0.008, 0x2A2440, { seg: 4 }); }
  else if (p === 'headset') { bind(B, CPART.head, [0, 0, 0, 0], null); const hy = shY + 0.2; for (const s of [1, -1]) { at(B, s * 0.2, hy, 0, 0, 0, Math.PI / 2); cyl(B, 0.07, 0.07, 0.05, 0x2EC4B6, { seg: 12, mid: true, top: 0x2A2440 }); } at(B, 0, 0, 0); tube(B, [[-0.2, hy + 0.02, 0], [-0.12, hy + 0.2, 0], [0.12, hy + 0.2, 0], [0.2, hy + 0.02, 0]], 0.02, 0x2A2440, { seg: 6 }); }
  else if (p === 'scooter') {
    at(B, 0, 0.18, 0.15); box(B, 0.62, 0.14, 1.15, 0x7CC6FE, { bevel: 0.35, top: 0x5AA6DE });
    at(B, 0, 0.32, -0.05); box(B, 0.46, 0.14, 0.42, 0x4A4458, { bevel: 0.4 });
    at(B, 0, 0.3, 0.62); cyl(B, 0.03, 0.03, 0.62, 0xC0C6D0, { seg: 6 });
    at(B, 0, 0, 0); tube(B, [[-0.22, 0.92, 0.62], [0.22, 0.92, 0.62]], 0.025, 0x2A2440, { seg: 6 });
    at(B, 0, 0.3, 0.75); box(B, 0.3, 0.2, 0.2, 0xC0C6D0, { bevel: 0.3 });
    for (const s of [1, -1]) for (const z of [-0.3, 0.6]) { at(B, s * 0.32, 0.1, z, 0, 0, Math.PI / 2); cyl(B, 0.1, 0.1, 0.07, 0x2A2440, { seg: 10, mid: true, top: 0xC0C6D0 }); }
  }
  else if (p === 'bun') { /* the mascot's bun is its body */ }
  void ink; void handL;
}
