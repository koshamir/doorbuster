// DOORBUSTER — fx.js
// Purpose: short-lived, purely visual effects: one pool of flat graphic particles (diamond sparks,
//          stars, puffs, streaks, confetti) drawn in a single instanced draw call, plus the emitters
//          that turn simulation events and cart state into particles. Never touches the simulation.
// Exports: initFx, clearFx, spark, burst, cartFx, eventFx, updateFx, TIER_COLORS
// Depends on: config.js, gfx.js and the global THREE (inside functions only).
//
// Particles are camera-facing quads; the fragment shader cuts the shape (0 diamond, 1 round puff,
// 2 four-point star, 3 square) and draws a dark rim, so they match the outlined look (ART.md 4).

import { CFG, PAL, rgb } from './config.js';
import { gfx } from './gfx.js';

const FX_CAP = 700, FX_STRIDE = 16;
// per particle: x y z  vx vy vz  life ttl  size0 size1  rot spin  grav drag  shape colorIndex
const fxData = new Float32Array(FX_CAP * FX_STRIDE);
let fxCount = 0, fxMesh = null, fxPos = null, fxParam = null, fxColor = null, fxSeed = 12345;
export const TIER_COLORS = [PAL.white, PAL.sale, PAL.orange, PAL.player];
const FX_COLORS = [PAL.white, PAL.sale, PAL.orange, PAL.player, PAL.danger, PAL.steel, PAL.list, PAL.hot, PAL.sky, PAL.mint, PAL.outline];
const FX_RGB = FX_COLORS.map(rgb);

// Visual-only random numbers; the simulation has its own generator.
function fxRnd() { fxSeed = (fxSeed * 1664525 + 1013904223) >>> 0; return fxSeed / 4294967296; }

const FX_VS = `
attribute vec3 iPos; attribute vec4 iParam; attribute vec3 iColor;
varying vec2 vUv; varying vec3 vColor; varying float vShape;
void main() {
  float c = cos(iParam.y), s = sin(iParam.y);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iParam.x;
  q.x *= iParam.w;                                    // aspect (streaks are long and thin)
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  mv.xy += q;
  vUv = position.xy * 2.0; vColor = iColor; vShape = iParam.z;
  gl_Position = projectionMatrix * mv;
}`;
const FX_FS = `
uniform vec3 uRimColor;
varying vec2 vUv; varying vec3 vColor; varying float vShape;
void main() {
  vec2 p = abs(vUv);
  float d;
  if (vShape < 0.5) d = p.x + p.y;                                   // diamond
  else if (vShape < 1.5) d = length(vUv);                            // round puff
  else if (vShape < 2.5) d = pow(pow(p.x, 0.55) + pow(p.y, 0.55), 1.8); // four-point star
  else d = max(p.x, p.y);                                            // square
  if (d > 1.0) discard;
  gl_FragColor = vec4(d > 0.8 ? uRimColor : vColor, 1.0);
}`;

export function initFx() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  fxPos = new THREE.InstancedBufferAttribute(new Float32Array(FX_CAP * 3), 3);
  fxParam = new THREE.InstancedBufferAttribute(new Float32Array(FX_CAP * 4), 4);
  fxColor = new THREE.InstancedBufferAttribute(new Float32Array(FX_CAP * 3), 3);
  g.setAttribute('iPos', fxPos); g.setAttribute('iParam', fxParam); g.setAttribute('iColor', fxColor);
  g.instanceCount = 0;
  const rim = rgb(PAL.outline);
  const mat = new THREE.ShaderMaterial({ uniforms: { uRimColor: { value: new THREE.Vector3(rim[0], rim[1], rim[2]) } }, vertexShader: FX_VS, fragmentShader: FX_FS });
  fxMesh = new THREE.Mesh(g, mat);
  fxMesh.frustumCulled = false;
  fxMesh.renderOrder = 5;
  gfx.scene.add(fxMesh);
}

export function clearFx() { fxCount = 0; if (fxMesh) fxMesh.geometry.instanceCount = 0; }

// One particle. o: { vx, vy, vz, ttl, size, end (size at death), shape, color (index into FX_COLORS or a
// palette hex), grav, drag, spin, aspect }.
export function spark(x, y, z, o) {
  if (fxCount >= FX_CAP) return;
  const i = fxCount++ * FX_STRIDE;
  let ci = FX_COLORS.indexOf(o.color);
  if (ci < 0) ci = typeof o.color === 'number' && o.color < FX_COLORS.length ? o.color : 0;
  fxData[i] = x; fxData[i + 1] = y; fxData[i + 2] = z;
  fxData[i + 3] = o.vx || 0; fxData[i + 4] = o.vy || 0; fxData[i + 5] = o.vz || 0;
  fxData[i + 6] = 0; fxData[i + 7] = o.ttl || 0.4;
  fxData[i + 8] = o.size || 0.2; fxData[i + 9] = o.end === undefined ? 0 : o.end;
  fxData[i + 10] = fxRnd() * 6.28; fxData[i + 11] = o.spin === undefined ? (fxRnd() - 0.5) * 8 : o.spin;
  fxData[i + 12] = o.grav === undefined ? 9 : o.grav; fxData[i + 13] = o.drag || 0;
  fxData[i + 14] = (o.shape || 0) + (o.aspect ? 10 * o.aspect : 0); fxData[i + 15] = ci;
}

// n particles thrown outward from a point. speed in m/s, up = upward share, cone optional direction bias.
export function burst(x, y, z, n, o, speed, up, dx, dz) {
  for (let k = 0; k < n; k++) {
    const a = fxRnd() * 6.283, s = speed * (0.4 + fxRnd() * 0.6);
    o.vx = Math.cos(a) * s + (dx || 0); o.vz = Math.sin(a) * s + (dz || 0); o.vy = (up || 0) * (0.5 + fxRnd());
    spark(x, y, z, o);
  }
}

// Continuous effects that depend on the cart's state: drift sparks, boost flames, dash streaks.
const fxOpt = {};
export function cartFx(k, x, z, h, dt) {
  const fx = Math.sin(h), fz = Math.cos(h), rx = fz, rz = -fx;         // forward and the cart's left
  const speed = Math.abs(k.spd);
  if (k.drift && speed > 3) {
    // Sparks from the outside rear wheel, coloured by the charge tier.
    const side = -k.drift;
    for (let n = 0; n < (k.tier > 0 ? 2 : 1); n++) {
      fxOpt.color = TIER_COLORS[k.tier]; fxOpt.shape = k.tier > 0 ? 0 : 1; fxOpt.size = k.tier > 0 ? 0.16 + 0.05 * k.tier : 0.22; fxOpt.end = 0;
      fxOpt.ttl = 0.22 + fxRnd() * 0.2; fxOpt.grav = k.tier > 0 ? 7 : -1; fxOpt.drag = 2; fxOpt.spin = undefined; fxOpt.aspect = 0;
      fxOpt.vx = -fx * speed * 0.35 + rx * side * (1 + fxRnd() * 2.5); fxOpt.vz = -fz * speed * 0.35 + rz * side * (1 + fxRnd() * 2.5); fxOpt.vy = 1 + fxRnd() * 2.2;
      spark(x - fx * 0.55 + rx * side * 0.45, 0.12, z - fz * 0.55 + rz * side * 0.45, fxOpt);
    }
  }
  if (k.boostT > 0 || k.dashT > 0) {
    // Flame diamonds and long streaks behind the cart.
    fxOpt.color = k.dashT > 0 ? PAL.white : TIER_COLORS[Math.min(3, Math.round((k.boostMul - 1) / 0.2))] || PAL.sale;
    fxOpt.shape = 0; fxOpt.size = 0.3; fxOpt.end = 0; fxOpt.ttl = 0.2; fxOpt.grav = 0; fxOpt.drag = 3; fxOpt.spin = 0; fxOpt.aspect = 0;
    fxOpt.vx = -fx * 3 + (fxRnd() - 0.5) * 2; fxOpt.vz = -fz * 3 + (fxRnd() - 0.5) * 2; fxOpt.vy = fxRnd() * 1.5;
    spark(x - fx * 1.0 + rx * (fxRnd() - 0.5) * 0.7, 0.35 + fxRnd() * 0.4, z - fz * 1.0 + rz * (fxRnd() - 0.5) * 0.7, fxOpt);
  }
}

// One-shot effects for simulation events. Returns the camera shake (trauma 0..1) the event deserves.
export function eventFx(e) {
  const k = e.cart;
  if (!k) return 0;
  const fx = Math.sin(k.h), fz = Math.cos(k.h);
  switch (e.type) {
    case 'drift':
      if (e.value > 0) burst(k.x - fx * 0.5, 0.3, k.z - fz * 0.5, 10, { color: TIER_COLORS[e.value], shape: 2, size: 0.34, ttl: 0.35, grav: 0, drag: 4 }, 5, 2);
      return 0;
    case 'boost':
      burst(k.x - fx * 0.9, 0.5, k.z - fz * 0.9, 8 + e.value * 4, { color: TIER_COLORS[e.value], shape: 0, size: 0.4, ttl: 0.4, grav: 0, drag: 3 }, 4, 1.5, -fx * 6, -fz * 6);
      return 0.12 * e.value;
    case 'dash':
      burst(k.x - fx * 0.8, 0.5, k.z - fz * 0.8, 10, { color: PAL.white, shape: 1, size: 0.5, end: 0.9, ttl: 0.3, grav: -1, drag: 5 }, 3, 0.5, -fx * 4, -fz * 4);
      return 0.15;
    case 'scrape':
      burst(k.x - k.wnx * CFG.CART_R, 0.5, k.z - k.wnz * CFG.CART_R, 2, { color: PAL.sale, shape: 0, size: 0.14, ttl: 0.25, grav: 10, drag: 1 }, 2.5, 2, -fx * 2, -fz * 2);
      return 0;
    case 'bump':
      burst(k.x - k.wnx * CFG.CART_R, 0.6, k.z - k.wnz * CFG.CART_R, 5, { color: PAL.white, shape: 1, size: 0.3, end: 0.6, ttl: 0.3, grav: -1, drag: 4 }, 2, 0.5);
      return Math.min(0.3, e.value * 0.03);
    case 'crash':
      burst(k.x - k.wnx * CFG.CART_R, 0.8, k.z - k.wnz * CFG.CART_R, 12, { color: PAL.sale, shape: 2, size: 0.5, ttl: 0.6, grav: 6, drag: 2 }, 6, 4);
      burst(k.x - k.wnx * CFG.CART_R, 0.6, k.z - k.wnz * CFG.CART_R, 8, { color: PAL.white, shape: 1, size: 0.6, end: 1.3, ttl: 0.45, grav: -1, drag: 4 }, 3, 1);
      return 0.7;
    default:
      return 0;
  }
}

// Moves the particles and uploads the live ones. Dead particles are replaced by the last live one.
export function updateFx(dt) {
  if (!fxMesh) return;
  const P = fxPos.array, Q = fxParam.array, C = fxColor.array;
  for (let n = 0; n < fxCount; n++) {
    const i = n * FX_STRIDE;
    fxData[i + 6] += dt;
    if (fxData[i + 6] >= fxData[i + 7]) {
      fxCount--;
      for (let j = 0; j < FX_STRIDE; j++) fxData[i + j] = fxData[fxCount * FX_STRIDE + j];
      n--;
      continue;
    }
    const drag = Math.max(0, 1 - fxData[i + 13] * dt);
    fxData[i + 3] *= drag; fxData[i + 5] *= drag; fxData[i + 4] = fxData[i + 4] * drag - fxData[i + 12] * dt;
    fxData[i] += fxData[i + 3] * dt; fxData[i + 1] += fxData[i + 4] * dt; fxData[i + 2] += fxData[i + 5] * dt;
    if (fxData[i + 1] < 0.05 && fxData[i + 12] > 0) { fxData[i + 1] = 0.05; fxData[i + 4] *= -0.4; }
    fxData[i + 10] += fxData[i + 11] * dt;
    const t = fxData[i + 6] / fxData[i + 7], shape = fxData[i + 14] % 10, aspect = Math.floor(fxData[i + 14] / 10);
    P[n * 3] = fxData[i]; P[n * 3 + 1] = fxData[i + 1]; P[n * 3 + 2] = fxData[i + 2];
    Q[n * 4] = fxData[i + 8] + (fxData[i + 9] - fxData[i + 8]) * t; Q[n * 4 + 1] = fxData[i + 10]; Q[n * 4 + 2] = shape; Q[n * 4 + 3] = aspect || 1;
    const c = FX_RGB[fxData[i + 15]];
    C[n * 3] = c[0]; C[n * 3 + 1] = c[1]; C[n * 3 + 2] = c[2];
  }
  fxMesh.geometry.instanceCount = fxCount;
  fxPos.needsUpdate = fxParam.needsUpdate = fxColor.needsUpdate = true;
}
