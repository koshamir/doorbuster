// DOORBUSTER — crowd.js
// Purpose: the crowd on screen (ART.md section 3, DESIGN.md section 6): one instanced mesh per archetype
//          and level of detail, animated in the vertex shader (every vertex knows its part; per-instance
//          attributes carry the part angles, the fall, the squash, four packed colours and the face cell),
//          and the per-frame mapping from simulation shoppers (stand, stroll, dodge, bowled over, get up
//          and shake a fist, run) to those attributes, with each archetype's idle.
// Exports: makeCrowd, syncCrowd, crowdPose, disposeCrowd
// Depends on: config.js, shapes.js, figure.js, atlas.js, cast.js, render.js and the global THREE.

import { clamp, rgb } from './config.js';
import { builder, toGeometry } from './shapes.js';
import { crowdFigure, CPART } from './figure.js';
import { EXPR, faceAtlas } from './atlas.js';
import { CAST, CROWD, CROWD_FACES, CROWD_COLORS } from './cast.js';
import { R, CEL_COMMON, MRT_OUT, AUX_NONE } from './render.js';

const CAP = 48, FAR = 18;
const CROWD_VS = `
attribute vec4 tex; attribute float bone; attribute vec4 iA; attribute vec4 iB; attribute vec4 iC;
uniform vec3 uPiv[8]; uniform vec3 uSkin[4]; uniform float uPropParent; uniform vec2 uRes; uniform float uThick; uniform float uShadowPass;
varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec4 vTex; varying vec3 vSlot; varying vec2 vCell;
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 rotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
vec3 unpack(float v) { return vec3(floor(v / 65536.0), floor(mod(v, 65536.0) / 256.0), mod(v, 256.0)) / 255.0; }
// part p: 0 body, 1 head, 2 left arm, 3 right arm, 4 left leg, 5 right leg, 6 prop, 7 second prop
void pose(inout vec3 p, inout vec3 n, float part) {
  int k = int(part + 0.5);
  if (k == 6) k = int(uPropParent + 0.5);
  vec3 pv = uPiv[k];
  if (k == 1) { p = rotY(rotZ(p - pv, iB.y), iB.x) + pv; n = rotY(rotZ(n, iB.y), iB.x); }
  else if (k == 2 || k == 3) { float a = k == 2 ? iA.y : iA.z; p = rotX(p - pv, a) + pv; n = rotX(n, a); }
  else if (k == 4 || k == 5) { float a = k == 4 ? iA.x : -iA.x; p = rotX(p - pv, a) + pv; n = rotX(n, a); }
  else if (k == 7) { p.y += abs(sin(iC.y * 12.0)) * 0.05; }
  if (k != 4 && k != 5 && k != 7) { vec3 h = uPiv[0]; p = rotX(p - h, iA.w) + h; n = rotX(n, iA.w); }
  // a fall pivots on the feet; a pancake squashes onto the floor
  p = rotX(p, iB.z); n = rotX(n, iB.z);
  p.y *= iB.w; p.xz *= 1.0 + (1.0 - iB.w) * 0.9;
}`;
const CROWD_MAIN_VS = `${CROWD_VS}
void main() {
  vec3 p = position, n = normal;
  pose(p, n, bone);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n); vUv = uv; vTex = tex; vColor = color;
  float s = tex.y, style = floor(iC.y / 8.0 + 0.01);
  vec3 skin = style < 0.5 ? uSkin[0] : style < 1.5 ? uSkin[1] : style < 2.5 ? uSkin[2] : uSkin[3];
  vSlot = s < 0.5 ? vec3(1.0) : s < 1.5 ? unpack(iC.x) : s < 2.5 ? unpack(iC.z) : s < 3.5 ? skin : unpack(iC.w);
  vCell = vec2(iC.y, 0.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CROWD_FS = `
${CEL_COMMON}
uniform sampler2D uMapA; uniform float uFar;
varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec4 vTex; varying vec3 vSlot; varying vec2 vCell;
${MRT_OUT}
void main() {
  vec3 base = vColor * vSlot;
  if (vTex.x > 0.5) {
    float cell = floor(vCell.x + 0.5), style = floor(cell / 8.0), e = mod(cell, 8.0);
    vec2 o = vec2((mod(style, 2.0) * 8.0 + e) / 16.0, (14.0 + floor(style / 2.0)) / 16.0);
    vec4 t = texture2D(uMapA, o + clamp(vUv, 0.0, 1.0) / 16.0);
    base = mix(base, t.rgb, t.a);
  }
  vec3 n = normalize(vN);
  float nl = dot(n, uLight), lit = band(nl, 0.02);
  vec3 c = mix(base * uShade * (0.93 + 0.1 * n.y), base, lit);
  c = mix(c, c * uTint, uTintAmt);
  if (uFlat > 0.5) c = uInk;
  gl_FragColor = vec4(c, 0.0);
  oAux = vec4(encN(n), 0.002, 0.49);      // depth silhouettes only (they have a hull outline)
}`;
const CROWD_HULL_VS = `${CROWD_VS}
attribute vec3 onormal;
void main() {
  vec3 p = position, n = onormal;
  pose(p, n, bone);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * w, cn = projectionMatrix * viewMatrix * vec4(normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n), 0.0);
  vec2 dir = cn.xy * uRes; float len = length(dir);
  if (len > 1e-5) clip.xy += dir / len * uThick * 2.0 / uRes * clip.w;
  vColor = color; vN = n; vW = w.xyz; vUv = uv; vTex = tex; vSlot = vec3(1.0); vCell = vec2(0.0);
  gl_Position = uShadowPass > 0.5 ? vec4(0.0, 0.0, 2.0, 1.0) : clip;
}`;
const CROWD_HULL_FS = `uniform vec3 uInk; uniform vec3 uTint; uniform float uTintAmt; ${MRT_OUT} void main() { gl_FragColor = vec4(mix(uInk, uInk * uTint, uTintAmt), 0.0); ${AUX_NONE} }`;

const pack = (hex) => ((hex >> 16) & 255) * 65536 + ((hex >> 8) & 255) * 256 + (hex & 255);
// The prop follows the right arm for things held in the hand, the head for a headset, the body otherwise.
const PROP_PARENT = { cane: 3, phone: 3, shaker: 3, bottle: 3, hotdog: 3, headset: 1 };

// One crowd kind: near and far instanced meshes, their materials, attributes.
function makeKind(kind) {
  const T = THREE, out = { kind, meshes: [], attrs: [] };
  const faces = Object.values(CAST).map((c) => ({ ...c.face, skin: c.skin }));
  const atlas = faceAtlas(faces, CROWD_FACES);
  for (const far of [false, true]) {
    const B = builder(), info = crowdFigure(B, kind, far);
    const geo = toGeometry(B, { bones: true, groups: !far, hull: !far });
    const piv = info.pivots.map((p) => new T.Vector3(p[0], p[1], p[2]));
    const uni = {
      uLight: R.u.uLight, uShade: R.u.uShade, uKey: R.u.uKey, uTint: R.u.uTint, uTintAmt: R.u.uTintAmt, uShadowMap: R.u.uShadowMap, uShadowOn: R.u.uShadowOn,
      uShadowTexel: R.u.uShadowTexel, uFlat: R.u.uFlat, uInk: R.u.uInk, uRes: R.u.uRes, uShadowPass: R.u.uShadowPass, uThick: { value: 2.6 * R.u.uRes.value.y / 1080 },
      uPiv: { value: piv }, uPropParent: { value: PROP_PARENT[CROWD[kind].prop] ?? 0 }, uMapA: { value: atlas }, uSkin: { value: CROWD_FACES.map((f) => new T.Vector3(...rgb(f.skin))) }, uFar: { value: far ? 1 : 0 },
    };
    const main = new T.ShaderMaterial({ vertexShader: CROWD_MAIN_VS, fragmentShader: CROWD_FS, uniforms: uni, vertexColors: true });
    const mats = far ? main : [main, new T.ShaderMaterial({ vertexShader: CROWD_HULL_VS, fragmentShader: CROWD_HULL_FS, uniforms: uni, side: T.BackSide, vertexColors: true })];
    if (!far) { mats[1].userData.px = 2.6; (R.hulls || (R.hulls = [])).push(mats[1]); }
    const mesh = new T.InstancedMesh(geo, mats, CAP);
    mesh.count = 0; mesh.frustumCulled = false;
    const A = { iA: new Float32Array(CAP * 4), iB: new Float32Array(CAP * 4), iC: new Float32Array(CAP * 4) };
    for (const k in A) geo.setAttribute(k, new T.InstancedBufferAttribute(A[k], 4));
    out.meshes.push(mesh); out.attrs.push(A);
  }
  return out;
}

// makeCrowd(kinds) -> { kinds: { name: { meshes: [near, far], attrs } }, root: Group }
export function makeCrowd(kinds) {
  const root = new THREE.Group(), view = { root, kinds: {}, list: [] };
  for (const k of kinds) { const m = makeKind(k); view.kinds[k] = m; view.list.push(m); root.add(m.meshes[0], m.meshes[1]); }
  return view;
}
export function disposeCrowd(view) {
  for (const m of view.list) for (const mesh of m.meshes) { mesh.geometry.dispose(); for (const mt of [].concat(mesh.material)) { mt.dispose(); const i = (R.hulls || []).indexOf(mt); if (i >= 0) R.hulls.splice(i, 1); } }
}

// The pose of one shopper: p = { x, z, h, kind, state, t, phase, speed, style, cloth, pants, hair, angry, face, y, fall, squash, idle }
// The faces: neutral walking, happy browsing, shocked dodging, dizzy when down, angry when getting up.
export function crowdPose(p, t, o) {
  const idle = CROWD[p.kind].idle;
  let leg = 0, armL = 0, armR = 0, lean = CROWD[p.kind].hunch || 0, hy = 0, hr = 0, fall = 0, sq = p.squash || 1, y = p.y || 0, face = p.face ?? EXPR.neutral;
  const ph = p.phase, sp = p.speed;
  if (p.state === 1 || p.state === 4) {                        // walk or run: stride matched to speed
    const a = clamp(sp * 0.22, 0.15, 0.75);
    leg = Math.sin(ph) * a; armL = -Math.sin(ph) * a * 0.9; armR = Math.sin(ph) * a * 0.9;
    lean += p.state === 4 ? 0.25 : 0.06; y += Math.abs(Math.sin(ph)) * (p.state === 4 ? 0.06 : 0.025);
    face = p.state === 4 ? EXPR.happy : EXPR.neutral;
    if (p.gun) { armR = -1.55; face = EXPR.angry; }            // running with the price gun up
  } else if (p.state === 6) {                                  // a breakdance: on its back, legs kicking, arms out
    fall = -1.45; y += 0.18; leg = Math.sin(t * 14) * 0.9; armL = -1.6 + Math.sin(t * 10) * 0.5; armR = -1.6 - Math.sin(t * 10) * 0.5; face = EXPR.happy;
  } else if (p.state === 2) {                                  // dodge-jump: arms up, legs tucked
    const u = clamp(p.t / 0.35, 0, 1);
    y += Math.sin(u * Math.PI) * 0.45; armL = -2.6; armR = -2.6; leg = 0.4; face = EXPR.shocked;
  } else if (p.state === 3) {                                  // bowled over: tumble, lie, spring up
    const u = 1 - p.t / 1.3, lie = clamp(u / 0.12, 0, 1) * clamp((1 - u) / 0.16, 0, 1);
    fall = -1.45 * lie; y += 0.04 * lie + Math.sin(clamp(u / 0.25, 0, 1) * Math.PI) * 0.4; armL = -2.4 * lie; armR = -1.2 * lie; leg = Math.sin(t * 20) * 0.4 * lie;
    face = EXPR.dizzy;
  } else if (p.angry > 0) {                                    // up again, shaking a fist
    armR = -2.7 + Math.sin(t * 28) * 0.3; y += Math.abs(Math.sin(t * 18)) * 0.05; face = EXPR.angry; hr = Math.sin(t * 20) * 0.1;
  } else {                                                     // the archetype's idle
    const w = t * 1.3 + (p.seed || 0);
    if (idle === 'scroll') { armR = -1.1; hy = 0; lean += 0.25; face = EXPR.neutral; }
    else if (idle === 'flex') { armL = -1.4 + Math.sin(w * 2) * 0.2; armR = -1.4 - Math.sin(w * 2) * 0.2; face = EXPR.smug; }
    else if (idle === 'jog') { leg = Math.sin(w * 7) * 0.3; armL = -Math.sin(w * 7) * 0.4; armR = Math.sin(w * 7) * 0.4; y += Math.abs(Math.sin(w * 7)) * 0.03; }
    else if (idle === 'munch') { armR = -1.5 - Math.max(0, Math.sin(w * 2.5)) * 0.6; face = EXPR.happy; }
    else if (idle === 'dance') { hr = Math.sin(w * 5) * 0.3; armL = -2.4 + Math.sin(w * 5) * 0.6; armR = -2.4 - Math.sin(w * 5) * 0.6; y += Math.abs(Math.sin(w * 5)) * 0.08; face = EXPR.happy; }
    else if (idle === 'pose') { armL = -0.3; hy = Math.sin(w * 0.7) * 0.5; face = EXPR.smug; }
    else if (idle === 'button') { armL = -1.0 + Math.sin(w * 11) * 0.12; armR = -1.0 - Math.sin(w * 13) * 0.12; lean += 0.15; }
    else if (idle === 'stock') { armL = -1.1 + Math.sin(w) * 0.1; armR = -1.1 + Math.sin(w) * 0.1; }
    else if (idle === 'hop') { y += Math.abs(Math.sin(w * 6)) * 0.12; armL = -0.5; armR = -0.5; face = EXPR.happy; }
    else if (idle === 'rock' || idle === 'shuffle') { leg = Math.sin(w * 2) * 0.08; armL = -0.7; armR = -0.7; }
    else if (idle === 'tap') { armR = -0.5 + Math.sin(w * 3) * 0.1; }
    else if (idle === 'donut') { hr = Math.sin(w * 2) * 0.1; }
    hy += Math.sin(w * 0.6) * 0.35;                           // browsing: the head turns slowly
    if (CROWD[p.kind].prop === 'walker' || CROWD[p.kind].prop === 'stroller' || CROWD[p.kind].prop === 'scooter') { armL = -0.75; armR = -0.75; }
  }
  if (o) Object.assign(o, { leg, armL, armR, lean, hy, hr, fall, sq, y, face });
  return { leg, armL, armR, lean, hy, hr, fall, sq, y, face };
}

// Writes every shopper of the frame into the instance buffers. list: poses from crowdPose plus x, z, h, kind,
// style, cloth, pants, hair, scale. cam: the camera position (for the level of detail).
const _m = new Float32Array(16);
export function syncCrowd(view, list, cam) {
  for (const m of view.list) { m.n0 = 0; m.n1 = 0; }
  for (const p of list) {
    const m = view.kinds[p.kind];
    if (!m) continue;
    const far = cam && Math.hypot(p.x - cam.x, p.z - cam.z) > FAR ? 1 : 0, i = far ? m.n1++ : m.n0++;
    if (i >= CAP) continue;
    const mesh = m.meshes[far], A = m.attrs[far], c = Math.cos(p.h), s = Math.sin(p.h), sc = p.scale || 1;
    _m.fill(0); _m[0] = c * sc; _m[2] = -s * sc; _m[5] = sc; _m[8] = s * sc; _m[10] = c * sc; _m[12] = p.x; _m[13] = p.pose.y; _m[14] = p.z; _m[15] = 1;
    mesh.instanceMatrix.array.set(_m, i * 16);
    const q = p.pose;
    A.iA.set([q.leg, q.armL, q.armR, q.lean], i * 4);
    A.iB.set([q.hy, q.hr, q.fall, q.sq], i * 4);
    const cell = (p.style % 4) * 8 + q.face;
    A.iC.set([pack(p.cloth), cell, pack(p.pants), pack(p.hair)], i * 4);
  }
  for (const m of view.list) for (let f = 0; f < 2; f++) {
    const mesh = m.meshes[f], A = m.attrs[f], g = mesh.geometry;
    mesh.count = Math.min(CAP, f ? m.n1 : m.n0);
    mesh.instanceMatrix.needsUpdate = true;
    for (const k of ['iA', 'iB', 'iC']) g.attributes[k].needsUpdate = true;
    void A;
  }
}
