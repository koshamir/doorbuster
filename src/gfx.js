// DOORBUSTER — gfx.js
// Purpose: the renderer and what every visual shares: the single toon material, the inverted-hull
//          outline, the tiled floor material, the chase camera and the frame statistics.
// Exports: gfx, initGfx, resizeGfx, toonMaterial, outlineMaterial, floorMaterial, flatMaterial,
//          updateCamera, renderFrame. Shared materials are created once in gfx.mats.
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
  cam: { yaw: 0, zoom: 0, x: 0, z: 0, shake: 0, ready: false, tower: 0, lift: 0, t: 0 },
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
uniform vec3 uFloor; uniform vec3 uGrout; uniform float uTile; uniform vec3 uTint; uniform float uTintAmt;
varying vec3 vW;
void main() {
  vec2 g = vW.xz / uTile;
  vec2 f = abs(fract(g) - 0.5);                      // 0.5 at a tile edge
  vec2 w = fwidth(g) * 1.2;
  float line = max(smoothstep(0.5 - 0.02 - w.x, 0.5 - 0.02, f.x), smoothstep(0.5 - 0.02 - w.y, 0.5 - 0.02, f.y));
  line *= clamp(1.0 - max(w.x, w.y) * 6.0, 0.0, 1.0); // fade the grid far away instead of shimmering
  vec2 id = floor(g);
  float check = mod(id.x + id.y, 2.0);
  vec3 c = mix(uFloor, uFloor * 0.965, check);       // faint checker so speed reads on the floor
  c = mix(c, uGrout, line);
  c = mix(c, c * uTint, uTintAmt);
  gl_FragColor = vec4(c, 1.0);
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
  gfx.mats = { toon: toonMaterial(), toonRim: toonMaterial({ rim: 0.5 }), lineThin: outlineMaterial(1.5),
    lineBold: outlineMaterial(2.5), floor: floorMaterial() };
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
  const u = gfx.u, f = rgb(PAL.floor), g = rgb(PAL.grout);
  return new THREE.ShaderMaterial({
    uniforms: { uFloor: { value: new THREE.Vector3(f[0], f[1], f[2]) }, uGrout: { value: new THREE.Vector3(g[0], g[1], g[2]) },
      uTile: { value: CFG.TILE }, uTint: u.uTint, uTintAmt: u.uTintAmt },
    vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS,
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
// interpolation between its last two steps, world the level (for the wall test).
export function updateCamera(k, alpha, dt, towerHeight, world) {
  const cam = gfx.cam, camera = gfx.camera;
  const x = lerp(k.px, k.x, alpha), z = lerp(k.pz, k.z, alpha);
  const h = k.ph + wrapAngle(k.h - k.ph) * alpha;
  const want = h - k.slip * 0.55 + k.yaw * 0.22;       // follow the travel direction, lead into the turn
  if (!cam.ready) { cam.yaw = want; cam.zoom = 0; cam.ready = true; cam.tower = 0; cam.lift = 0; }
  cam.t += dt;
  cam.yaw += wrapAngle(want - cam.yaw) * (1 - Math.exp(-dt * 5.5));
  const sf = clamp(Math.abs(k.spd) / TUNE.maxspeed, 0, 1.7);
  cam.zoom += (sf - cam.zoom) * (1 - Math.exp(-dt * 2.5));
  cam.tower += ((towerHeight || 0) - cam.tower) * (1 - Math.exp(-dt * 2));
  const fast = Math.max(0, cam.zoom - 0.8);             // only real speed changes the framing
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  // A wall within 1.5 m behind the cart (as the camera sees it) would hide it: tip up and over.
  let hidden = false;
  if (world) for (let d = 0.5; d < 1.6 && !hidden; d += 0.5) {
    const c = Math.floor((x - fx * d) / CFG.TILE), r = Math.floor((z - fz * d) / CFG.TILE);
    hidden = c < 0 || r < 0 || c >= world.cols || r >= world.rows || !world.floor[r * world.cols + c];
  }
  cam.lift += ((hidden ? 1 : 0) - cam.lift) * (1 - Math.exp(-dt * 6));
  const height = (TUNE.camheight * (1 + 0.16 * fast) + cam.tower * 0.45) * (1 + 0.4 * cam.lift);
  const pitch = TUNE.campitch * Math.PI / 180 + 0.45 * cam.lift;
  const back = height / Math.tan(pitch);
  const lead = back - height / Math.tan(pitch + 0.2);   // keeps the cart in the lower third of the frame
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
  const base = TUNE.camfov + 9 * fast;
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
