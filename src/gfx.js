// DOORBUSTER — gfx.js
// Purpose: the renderer and what every visual shares: the single toon material, the inverted-hull
//          outline, the tiled floor material, the chase camera and the frame statistics.
// Exports: gfx, initGfx, resizeGfx, toonMaterial, outlineMaterial, floorMaterial, ringMaterial,
//          flatMaterial, updateCamera, renderFrame. Shared materials are created once in gfx.mats.
// Depends on: config.js and the global THREE (r185, core only). THREE is touched only inside
//          functions, never at import time, so main.js can load it first.
//
// Colour: palette values are sRGB and the shaders write them to the screen unchanged (no tone
// mapping, no conversion), so a hex in config.js is the colour on screen. The shadow tone is the
// base colour multiplied by a cool purple (ART.md section 3).

import { TUNE, CFG, PAL, rgb, clamp, lerp, wrapAngle } from './config.js';

export const gfx = {
  renderer: null, scene: null, camera: null, w: 1, h: 1, ratio: 1,
  u: null,                         // uniforms shared by every material
  mats: null,                      // the shared materials: toon, toonRim, lineThin, lineBold, floor
  cam: { yaw: 0, zoom: 0, x: 0, z: 0, shake: 0, ready: false, tower: 0, lift: 0, punch: 0, t: 0 },
  stats: { calls: 0, tris: 0, ms: 0, fps: 60 },
};

const TOON_VS = `
varying vec3 vColor; varying vec3 vN; varying vec3 vW;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  vColor = color;
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor;
  #endif
  vec4 w = modelMatrix * p;
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TOON_FS = `
uniform vec3 uLight; uniform vec3 uShade; uniform vec3 uTint; uniform float uTintAmt;
uniform float uRim; uniform vec3 uGlow;
varying vec3 vColor; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  float nl = dot(n, uLight);
  float lit = smoothstep(-0.02, 0.02, nl);                 // two tones with a crisp edge
  vec3 c = mix(vColor * uShade, vColor, lit);
  c = mix(c, vec3(1.0), smoothstep(0.80, 0.84, nl) * 0.07); // faces turned to the light get a touch more
  vec3 v = normalize(cameraPosition - vW);
  c = mix(c, vec3(1.0), smoothstep(0.62, 0.72, 1.0 - max(dot(n, v), 0.0)) * uRim * lit);
  c += uGlow;
  c = mix(c, c * uTint, uTintAmt);
  gl_FragColor = vec4(c, 1.0);
}`;
const OUTLINE_VS = `
attribute vec3 onormal;
uniform vec2 uRes; uniform float uThick;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 clip = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
  vec4 cn = projectionMatrix * viewMatrix * vec4(normalize(mat3(m) * onormal), 0.0);
  vec2 dir = cn.xy * uRes;
  float len = length(dir);
  if (len > 1e-5) clip.xy += dir / len * uThick * 2.0 / uRes * clip.w;   // constant thickness in pixels
  gl_Position = clip;
}`;
const OUTLINE_FS = `
uniform vec3 uColor; uniform vec3 uTint; uniform float uTintAmt;
void main() { gl_FragColor = vec4(mix(uColor, uColor * uTint, uTintAmt), 1.0); }`;
const FLOOR_VS = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FS = `
// One texel of uMap per tile: r = store colour index / 8, g = decal / 8 (1-4 arrow east, south, west,
// north; 5 checkout hatch; 6 start grid; 7 closed lane), a = 1 on floor and 0 on void.
uniform sampler2D uMap; uniform vec2 uMapSize; uniform vec3 uZone[6];
uniform vec3 uFloor; uniform vec3 uGrout; uniform vec3 uInk; uniform vec3 uShade; uniform vec3 uClosed;
uniform float uTile; uniform vec3 uTint; uniform float uTintAmt;
varying vec3 vW;
vec4 tileAt(vec2 id) { return texture2D(uMap, (id + 0.5) / uMapSize); }
void main() {
  vec2 g = vW.xz / uTile, id = floor(g), f = fract(g), e = abs(f - 0.5);
  vec4 t = tileAt(id);
  vec2 w = fwidth(g) * 1.2;
  float far = clamp(1.0 - max(w.x, w.y) * 6.0, 0.0, 1.0);          // fade detail far away instead of shimmering
  float line = max(smoothstep(0.48 - w.x, 0.48, e.x), smoothstep(0.48 - w.y, 0.48, e.y)) * far;
  vec3 zone = uZone[int(t.r * 8.0 + 0.5)];
  vec3 c = mix(uFloor, zone, 0.13);                                  // each store tints its floor
  c = mix(c, c * 0.955, mod(id.x + id.y, 2.0));                      // faint checker so speed reads on the floor
  c = mix(c, uGrout, line);
  float d = floor(t.g * 8.0 + 0.5);
  if (d > 0.5 && d < 4.5) {                                          // a painted chevron pointing down the route
    vec2 dir = d < 1.5 ? vec2(1.0, 0.0) : d < 2.5 ? vec2(0.0, 1.0) : d < 3.5 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
    vec2 p = f - 0.5, q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
    float v = abs(q.x - 0.16 + abs(q.y) * 0.9);
    float m = (1.0 - smoothstep(0.075, 0.075 + w.x, v)) * (1.0 - smoothstep(0.3, 0.3 + w.x, abs(q.y)));
    float rim = (1.0 - smoothstep(0.115, 0.115 + w.x, v)) * (1.0 - smoothstep(0.34, 0.34 + w.x, abs(q.y)));
    c = mix(c, uInk, rim * 0.55 * far);                              // a dark edge keeps it readable on any floor
    c = mix(c, zone, m * far);
  } else if (d > 4.5 && d < 5.5) {                                   // checkout lane: yellow and dark hatching
    c = mix(mix(uZone[3], uInk, step(0.5, fract((f.x + f.y) * 2.0))), c, 0.25);
  } else if (d > 6.5) {                                              // a closed lane: dark, with a red cross-hatch
    c = mix(mix(uInk, uClosed, step(0.72, fract((f.x + f.y) * 2.0))), c, 0.2);
  } else if (d > 5.5) {                                              // start grid
    c = mix(c, vec3(1.0), step(0.42, e.y) * step(0.5, fract(f.x * 4.0)) * 0.8);
  }
  // a hard-edged shadow where the floor meets a wall (the same graphic cut as the shadows under things)
  float sh = 0.0;
  sh = max(sh, (1.0 - tileAt(id + vec2(-1.0, 0.0)).a) * (1.0 - smoothstep(0.11, 0.11 + w.x, f.x)));
  sh = max(sh, (1.0 - tileAt(id + vec2(1.0, 0.0)).a) * (1.0 - smoothstep(0.11, 0.11 + w.x, 1.0 - f.x)));
  sh = max(sh, (1.0 - tileAt(id + vec2(0.0, -1.0)).a) * (1.0 - smoothstep(0.11, 0.11 + w.y, f.y)));
  sh = max(sh, (1.0 - tileAt(id + vec2(0.0, 1.0)).a) * (1.0 - smoothstep(0.11, 0.11 + w.y, 1.0 - f.y)));
  c = mix(c, c * uShade, sh * 0.6);
  c = mix(c, c * uTint, uTintAmt);
  gl_FragColor = vec4(c, 1.0);
}`;
const RING_VS = `
varying vec2 vUv;
void main() { vUv = position.xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;
const RING_FS = `
// The hero's ground ring: a solid ring in the player's colour, and outside it (clear of the cart) the
// drift charge as a dark-edged arc that fills toward the next tier in that tier's colour.
uniform vec3 uColor; uniform vec3 uCharge; uniform vec3 uInk; uniform float uFill; uniform float uPulse;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float ang = atan(vUv.x, vUv.y) / 6.2831853 + 0.5;
  float ring = step(0.56, r) * step(r, 0.68);
  float on = step(0.001, uFill) * step(ang, uFill + 0.012);
  float arc = step(0.74, r) * step(r, 1.0) * on;
  if (ring + arc < 0.5) discard;
  float core = step(0.78, r) * step(r, 0.96) * step(ang, uFill);
  gl_FragColor = vec4(arc > 0.5 ? (core > 0.5 ? mix(uCharge, vec3(1.0), uPulse) : uInk) : uColor, 1.0);
}`;
const FLAT_VS = `
varying vec3 vColor;
void main() {
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  vColor = color;
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor;
  #endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
}`;
const FLAT_FS = `
uniform float uAlpha; varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, uAlpha); }`;

export function initGfx(canvas) {
  const T = THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(PAL.night, 1);
  renderer.info.autoReset = false;
  gfx.renderer = renderer;
  gfx.scene = new T.Scene();
  gfx.camera = new T.PerspectiveCamera(TUNE.camfov, 16 / 9, 0.5, 400);
  const shade = [0.62, 0.58, 0.78];
  gfx.u = {
    uLight: { value: new T.Vector3(0.42, 0.80, 0.43).normalize() },
    uShade: { value: new T.Vector3(shade[0], shade[1], shade[2]) },
    uTint: { value: new T.Vector3(1.0, 0.55, 0.6) },     // the closing-time wash
    uTintAmt: { value: 0 },
    uRes: { value: new T.Vector2(1, 1) },
  };
  gfx.mats = { toon: toonMaterial(), toonRim: toonMaterial({ rim: 0.5 }), lineThin: outlineMaterial(2),
    lineBold: outlineMaterial(3.2), floor: floorMaterial() };
  resizeGfx();
  return gfx;
}

export function resizeGfx() {
  const r = gfx.renderer, canvas = r.domElement;
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  gfx.ratio = Math.min(window.devicePixelRatio || 1, 2) * (gfx.scale || 1);
  r.setPixelRatio(gfx.ratio);
  r.setSize(w, h, false);
  gfx.w = w; gfx.h = h;
  gfx.u.uRes.value.set(w * gfx.ratio, h * gfx.ratio);
  gfx.camera.aspect = w / h;
  gfx.camera.updateProjectionMatrix();
  // Outline thickness is given in pixels at 1080p and scales with the real resolution.
  for (const m of [gfx.mats.lineThin, gfx.mats.lineBold]) {
    m.uniforms.uThick.value = TUNE.outline ? m.userData.px * h * gfx.ratio / 1080 : 0;
  }
}

// The one lit material. opts.rim adds a light rim (characters and carts).
export function toonMaterial(opts = {}) {
  const u = gfx.u;
  return new THREE.ShaderMaterial({
    uniforms: { uLight: u.uLight, uShade: u.uShade, uTint: u.uTint, uTintAmt: u.uTintAmt,
      uRim: { value: opts.rim || 0 }, uGlow: { value: new THREE.Vector3(0, 0, 0) } },
    vertexShader: TOON_VS, fragmentShader: TOON_FS, vertexColors: true,
  });
}
// The outline pass: back faces pushed out along smoothed normals by a constant number of pixels.
// px is the thickness at 1080p; it scales with the real resolution.
export function outlineMaterial(px) {
  const u = gfx.u, c = rgb(PAL.outline);
  const m = new THREE.ShaderMaterial({
    uniforms: { uRes: u.uRes, uThick: { value: px }, uColor: { value: new THREE.Vector3(c[0], c[1], c[2]) },
      uTint: u.uTint, uTintAmt: u.uTintAmt },
    vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide,
  });
  m.userData.px = px;
  return m;
}
export function floorMaterial() {
  const u = gfx.u, v3 = (hex) => { const c = rgb(hex); return new THREE.Vector3(c[0], c[1], c[2]); };
  const zones = [0, 1, 2, 3, 0, 0].map((i) => v3(PAL.zones[i]));
  return new THREE.ShaderMaterial({
    uniforms: { uFloor: { value: v3(PAL.floor) }, uGrout: { value: v3(PAL.grout) }, uInk: { value: v3(PAL.night) }, uShade: u.uShade, uClosed: { value: v3(PAL.danger) },
      uZone: { value: zones }, uMap: { value: null }, uMapSize: { value: new THREE.Vector2(1, 1) },
      uTile: { value: CFG.TILE }, uTint: u.uTint, uTintAmt: u.uTintAmt },
    vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS,
  });
}
// The ring under the hero's cart (a flat quad from -1 to 1 in x and z; see RING_FS).
export function ringMaterial() {
  const c = rgb(PAL.player), k = rgb(PAL.outline);
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(c[0], c[1], c[2]) }, uCharge: { value: new THREE.Vector3(1, 1, 1) },
      uInk: { value: new THREE.Vector3(k[0], k[1], k[2]) }, uFill: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: RING_VS, fragmentShader: RING_FS, side: THREE.DoubleSide,
  });
}
// Unlit vertex colour with one alpha: blob shadows, glass, particles.
export function flatMaterial(alpha, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: alpha } }, vertexShader: FLAT_VS, fragmentShader: FLAT_FS, vertexColors: true,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// The chase camera: high and behind, aimed ahead of the cart; it pulls back and widens with speed,
// looks into turns and tips up over a wall that would hide the cart. k is the cart, alpha the
// interpolation between its last two steps, world the level (for the wall test). orbit (radians,
// optional) is the title view: lower, closer, turned by that angle, with the cart mid-screen.
export function updateCamera(k, alpha, dt, towerHeight, world, orbit) {
  const cam = gfx.cam, camera = gfx.camera;
  const x = lerp(k.px, k.x, alpha), z = lerp(k.pz, k.z, alpha);
  const h = k.ph + wrapAngle(k.h - k.ph) * alpha;
  // Follow the travel direction; the lag lets a turning cart yaw on screen. While a crash whips the
  // nose round, follow where the cart is going instead, and gently.
  const stunned = k.stunT > 0 && Math.hypot(k.vx, k.vz) > 1;
  const want = stunned ? Math.atan2(k.vx, k.vz) : h - k.slip * 0.55;
  if (!cam.ready) { cam.yaw = want; cam.zoom = 0; cam.ready = true; cam.tower = 0; cam.lift = 0; cam.punch = 0; }
  cam.t += dt;
  cam.yaw += wrapAngle(want - cam.yaw) * (1 - Math.exp(-dt * (stunned ? 3 : CFG.camFollow)));
  const title = orbit !== undefined;
  if (title) cam.yaw = h + orbit;
  const sf = clamp(Math.abs(k.spd) / TUNE.maxspeed, 0, 1.7);
  cam.zoom += (sf - cam.zoom) * (1 - Math.exp(-dt * 3.5));
  cam.tower += ((towerHeight || 0) - cam.tower) * (1 - Math.exp(-dt * 2));
  const fast = Math.max(0, cam.zoom - 1);               // above top speed: boost and dash
  const kick = k.dashT > 0 ? 1 : k.boostT > 0 ? 0.6 : k.madT > 0 ? 0.45 : 0;   // a dash, a boost or MADNESS punches the view at once
  cam.punch += (kick - cam.punch) * (1 - Math.exp(-dt * (kick > cam.punch ? 16 : 3)));
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  // A wall within 1.5 m behind the cart (as the camera sees it) would hide it: tip up and over.
  let hidden = false;
  if (world) for (let d = 0.5; d < 1.6 && !hidden; d += 0.5) {
    const c = Math.floor((x - fx * d) / CFG.TILE), r = Math.floor((z - fz * d) / CFG.TILE);
    hidden = c < 0 || r < 0 || c >= world.cols || r >= world.rows || !world.floor[r * world.cols + c];
  }
  cam.lift += ((hidden ? 1 : 0) - cam.lift) * (1 - Math.exp(-dt * 6));
  const height = title ? 4.4 : (TUNE.camheight * (0.95 + 0.05 * Math.min(cam.zoom, 1) + 0.16 * fast) + cam.tower * 0.45) * (1 + 0.4 * cam.lift);
  const pitch = title ? 0.5 : TUNE.campitch * Math.PI / 180 + 0.45 * cam.lift;
  const back = height / Math.tan(pitch);
  // The look point keeps the cart in the lower third of the frame; in a dash or boost the camera
  // hangs back a little, so the cart surges up the screen.
  const lead = title ? 0.5 : back - height / Math.tan(pitch + 0.2) - 1.1 * cam.punch;
  const lx = x + fx * lead, lz = z + fz * lead;
  let sx = 0, sy = 0;
  if (cam.shake > 0.001 && TUNE.shake) {                // trauma-based shake: offset grows with trauma squared
    const a = cam.shake * cam.shake * 0.5;
    sx = Math.sin(cam.t * 61.0) * a; sy = Math.sin(cam.t * 47.0 + 1.3) * a;
  }
  cam.shake = Math.max(0, cam.shake - dt * 1.8);
  camera.position.set(lx - fx * back + fz * sx, height + sy, lz - fz * back - fx * sx);
  camera.lookAt(lx + fz * sx * 0.5, 0.6, lz - fx * sx * 0.5);
  // Field of view: wider with speed, and wider still on tall screens so the corridor stays visible.
  const aspect = gfx.w / gfx.h;
  const base = TUNE.camfov - 5 + 8 * Math.min(cam.zoom, 1) + 6 * fast + 7 * cam.punch;   // 50 at rest, 58 at top speed
  const tall = aspect < 1.3 ? Math.min(1.7, 1.3 / aspect) : 1;
  const fov = 2 * Math.atan(Math.tan(base * Math.PI / 360) * tall) * 180 / Math.PI;
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  cam.x = x; cam.z = z;
}

export function renderFrame() {
  const r = gfx.renderer, t0 = performance.now();
  r.info.reset();
  r.render(gfx.scene, gfx.camera);
  gfx.stats.calls = r.info.render.calls;
  gfx.stats.tris = r.info.render.triangles;
  gfx.stats.ms = performance.now() - t0;
}
