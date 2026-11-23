// DOORBUSTER — render.js
// Purpose: the renderer and the look every visual shares (ART.md section 2): the cel material family
//          (two light bands with a hard terminator, tinted shadows, rim, gloss band, emissive), the
//          inverted-hull ink, the HIGH-tier shadow map, the post stack (screen-space crease ink and
//          halftone, bloom from emissive, per-store grade, vignette, speed lines, impact frames, FXAA),
//          the quality tiers with their benchmark, and the chase camera.
// Exports: R, initRender, resizeRender, setTier, benchTick, watchFrameRate, celMaterial, hullMaterial,
//          blendMaterial, MRT_OUT, AUX_NONE, setGrade, renderFrame, updateCamera, v3
// Depends on: config.js and the global THREE (r185). THREE is touched only inside functions.
//
// Colour: palette values are display colours and every shader writes them unchanged (no tone mapping,
// no colour management): a hex in the config is the colour on screen in the lit band.
// Every material writes two targets: colour (alpha = emissive strength, which feeds bloom) and aux
// (view normal xy, flags: floor 0.5 + halftone 0.25, ink: above 0.5 creases from normals and depth with weight
// (a - 0.5) * 2, up to 0.5 depth only with weight a * 2). The crease pass reads aux and depth.

import { TUNE, CFG, PAL, rgb, clamp, lerp, wrapAngle } from './config.js';

export const R = {
  renderer: null, scene: null, camera: null, w: 1, h: 1, ratio: 1, tier: 'high', forced: false, u: null,
  main: null, bloomA: null, bloomB: null, bloomC: null, ldr: null, post: null, quad: null, shadow: null,
  stats: { calls: 0, tris: 0, ms: 0 }, slow: 0, bench: null, grade: null, impactAt: -9, clock: 0,
  cam: { yaw: 0, zoom: 0, x: 0, z: 0, shake: 0, ready: false, tower: 0, lift: 0, punch: 0, t: 0, near: false, lead: 0.5 },
};
export const v3 = (hex) => { const c = rgb(hex); return new THREE.Vector3(c[0], c[1], c[2]); };
const TIERS = {
  high: { ratio: 1.5, small: 2, samples: 4, post: true, normals: true, halftone: true, bloom: 2, shadow: true, fxaa: true },
  med: { ratio: 1, small: 1.5, samples: 0, post: true, normals: false, halftone: true, bloom: 1, shadow: false, fxaa: true },
  low: { ratio: 0.85, small: 1, samples: 0, post: false, normals: false, halftone: false, bloom: 0, shadow: false, fxaa: false },
};

// ---- shader pieces --------------------------------------------------------------------------------
export const MRT_OUT = 'layout(location = 1) out highp vec4 oAux;\n';
export const AUX_NONE = 'oAux = vec4(0.5, 0.5, 0.0, 0.0);';
const SKIN_VS = `
#ifdef SKINNED
  { int b = int(bone + 0.5) * 3; vec4 r0 = uBones[b], r1 = uBones[b + 1], r2 = uBones[b + 2];
    p = vec4(dot(r0, p), dot(r1, p), dot(r2, p), 1.0); n = vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n)); }
#endif
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif`;
const CEL_VS = `
attribute vec4 tex;
#ifdef SKINNED
attribute float bone; uniform vec4 uBones[NBONES];
#endif
#ifdef INST_CELL
attribute float iCell;
#endif
uniform mat4 uShadowMat;
varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec4 vTex; varying vec4 vSh;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
  ${SKIN_VS}
  vColor = color;
#ifdef USE_INSTANCING_COLOR
  if (tex.x > 2.5 || tex.x < -0.5) vColor *= instanceColor;
#endif
  vec4 w = modelMatrix * p;
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vUv = uv; vTex = tex;
#ifdef INST_CELL
  vTex.y = tex.y > 31.5 ? tex.y : iCell;      // cells from 32 up are fixed prints (atlas.js PRINT0)
#endif
  vSh = uShadowMat * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// Shared fragment helpers: the light band, the shadow-map lookup, atlas cells.
export const CEL_COMMON = `
uniform vec3 uLight; uniform vec3 uShade; uniform vec3 uKey; uniform float uTintAmt; uniform vec3 uTint;
uniform sampler2D uShadowMap; uniform float uShadowOn; uniform vec2 uShadowTexel; uniform float uFlat; uniform vec3 uInk;
float band(float x, float t) { float aa = fwidth(x) * 0.8 + 1e-4; return smoothstep(t - aa, t + aa, x); }
float shadowAt(vec4 sh, float bias) {
  if (uShadowOn < 0.5) return 0.0;
  vec3 s = sh.xyz / sh.w;
  if (s.x < 0.002 || s.x > 0.998 || s.y < 0.002 || s.y > 0.998 || s.z > 1.0) return 0.0;
  vec2 g = s.xy / uShadowTexel - 0.5, f = fract(g), b = (floor(g) + 0.5) * uShadowTexel;
  float a = step(texture2D(uShadowMap, b).r + bias, s.z), c = step(texture2D(uShadowMap, b + vec2(uShadowTexel.x, 0.0)).r + bias, s.z);
  float d = step(texture2D(uShadowMap, b + vec2(0.0, uShadowTexel.y)).r + bias, s.z), e = step(texture2D(uShadowMap, b + uShadowTexel).r + bias, s.z);
  return smoothstep(0.3, 0.7, mix(mix(a, c, f.x), mix(d, e, f.x), f.y));
}
vec4 cellTex(sampler2D map, float cell, float grid, vec2 uv, float pad) {
  cell = floor(cell + 0.5);
  vec2 o = vec2(mod(cell, grid), floor(cell / grid)) / grid, f = fract(uv);
  return textureGrad(map, o + (pad + f * (1.0 - 2.0 * pad)) / grid, dFdx(uv) / grid, dFdy(uv) / grid);
}
vec2 encN(vec3 n) { vec3 v = normalize((viewMatrix * vec4(n, 0.0)).xyz); return v.xy * 0.5 + 0.5; }`;
const CEL_FS = `
${CEL_COMMON}
uniform float uRim; uniform vec3 uGlow; uniform float uInkW; uniform float uHalftone; uniform vec2 uFace;
#ifdef MAP_A
uniform sampler2D uMapA;
#endif
#ifdef MAP_B
uniform sampler2D uMapB;
#endif
varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec4 vTex; varying vec4 vSh;
${MRT_OUT}
void main() {
  vec3 base = vColor; float mode = vTex.x;
#ifdef MAP_A
  if (mode > 0.5 && mode < 1.5) { vec4 t = cellTex(uMapA, 0.0, 1.0, uFace + vUv * FACE_CELL, 0.0); base = mix(base, t.rgb, t.a); }      // face: uFace is the cell origin
  else if (mode > 1.5 && mode < 2.5) { vec4 t = cellTex(uMapA, vTex.y, GRID_A, vUv, 0.004); base = mix(base, t.rgb, t.a); }
#endif
#ifdef MAP_B
  if (mode > 2.5 && mode < 3.5) { vec4 t = cellTex(uMapB, vTex.y, GRID_B, clamp(vUv, 0.0, 0.999), 0.004); base = mix(base, t.rgb, t.a); }
  else if (mode > 3.5 && mode < 4.5) { vec4 t = cellTex(uMapB, vTex.y, GRID_B, vUv, 0.004); base = mix(base, t.rgb, t.a); }
#endif
  vec3 n = normalize(vN);
  float nl = dot(n, uLight);
  float lit = band(nl, 0.02);
#ifdef RECEIVE_SHADOW
  lit *= 1.0 - shadowAt(vSh, 0.0012 + 0.002 * (1.0 - abs(nl)));
#endif
  vec3 c = mix(base * uShade * (0.93 + 0.1 * n.y), base, lit);
  vec3 v = normalize(cameraPosition - vW);
  float gloss = vTex.z;
  if (gloss > 0.01) { vec3 h = normalize(uLight + v); c = mix(c, vec3(1.0), band(dot(n, h), 0.975 - 0.05 * gloss) * (0.35 + 0.55 * lit) * gloss * smoothstep(0.25, 0.5, dot(n, v))); }
  if (uRim > 0.0) { float f = 1.0 - max(dot(n, v), 0.0); c = mix(c, uKey, band(f, 0.6) * smoothstep(-0.25, 0.35, nl) * uRim); }
  float gm = vTex.w < 0.0 ? -vTex.w : 0.0;
  c += uGlow * gm;
  c = mix(c, c * uTint, uTintAmt);
  if (uFlat > 0.5) c = uInk;
  gl_FragColor = vec4(c, clamp(max(vTex.w, 0.0) + gm * length(uGlow) * 1.2, 0.0, 1.0));
  oAux = vec4(encN(n), (1.0 - lit) * uHalftone * 0.25 + 0.002, uInkW);
}`;
// The ink hull: back faces pushed out along the smoothed normal by a constant number of pixels.
const HULL_VS = `
attribute vec3 onormal;
#ifdef SKINNED
attribute float bone; uniform vec4 uBones[NBONES];
#endif
uniform vec2 uRes; uniform float uThick; uniform float uShadowPass;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = onormal;
  ${SKIN_VS}
  vec4 w = modelMatrix * p;
  vec4 clip = projectionMatrix * viewMatrix * w;
  vec4 cn = projectionMatrix * viewMatrix * vec4(normalize(mat3(modelMatrix) * n), 0.0);
  vec2 dir = cn.xy * uRes; float len = length(dir);
  if (len > 1e-5) clip.xy += dir / len * uThick * 2.0 / uRes * clip.w;
  gl_Position = uShadowPass > 0.5 ? vec4(0.0, 0.0, 2.0, 1.0) : clip;
}`;
const HULL_FS = `
uniform vec3 uInk; uniform vec3 uTint; uniform float uTintAmt;
${MRT_OUT}
void main() { gl_FragColor = vec4(mix(uInk, uInk * uTint, uTintAmt), 0.0); ${AUX_NONE} }`;

// ---- post shaders -----------------------------------------------------------------------------------
const QUAD_VS = 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT_FS = `uniform sampler2D tColor; uniform vec2 uTexel; varying vec2 vUv;
void main() { vec3 s = vec3(0.0); for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 1 || i == 3 ? 1.0 : -1.0, i >= 2 ? 1.0 : -1.0) * uTexel * 0.5; vec4 c = texture2D(tColor, vUv + o); s += c.rgb * c.a; }
  gl_FragColor = vec4(s * 0.25, 1.0); }`;
const BLUR_FS = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() { vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
  s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
  s += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(s, 1.0); }`;
const COMPOSITE_FS = `
uniform sampler2D tColor; uniform sampler2D tAux; uniform sampler2D tDepth; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
uniform vec2 uTexel; uniform vec2 uRes; uniform float uScale; uniform float uNear; uniform float uFar; uniform vec3 uInk; uniform vec3 uPaper;
uniform float uBloom; uniform float uSat; uniform float uContrast; uniform vec3 uLift; uniform vec3 uGain; uniform float uVignette;
uniform float uSpeed; uniform float uImpact; uniform float uTime; uniform float uHalfK; uniform float uLines; uniform float uInkA;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec3 dn(vec4 a) { vec2 xy = a.xy * 2.0 - 1.0; return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }
float hash(float x) { return fract(sin(x * 91.7) * 43758.5453); }
// the eight neighbours, in opposite pairs (i, i + 1)
vec2 nb(int i) { return i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : i == 3 ? vec2(0.0, -1.0)
  : i == 4 ? vec2(0.7, 0.7) : i == 5 ? vec2(-0.7, -0.7) : i == 6 ? vec2(0.7, -0.7) : vec2(-0.7, 0.7); }
void main() {
  vec4 col = texture2D(tColor, vUv); vec3 c = col.rgb;
  vec4 ac = texture2D(tAux, vUv);
  float floorM = step(0.49, ac.b), ht = step(0.2, ac.b - floorM * 0.5);
  float dc = lin(texture2D(tDepth, vUv).r);
  // crease ink: silhouettes from depth (drawn on the nearer side only) and creases from normals, over all
  // eight neighbours so a stepped diagonal edge stays one unbroken line; a crease is either ink or not
  // (no half-strength greys that break into dots), and lines fade out by alpha in the distance
  float ink = 0.0;
  if (uLines > 0.0 && ac.a > 0.01 && floorM < 0.5) {
    float e = 0.0, dd[8]; bool cr = ac.a > 0.5;
    for (int i = 0; i < 8; i++) {
      dd[i] = lin(texture2D(tDepth, vUv + nb(i) * uTexel * uScale).r);
      e = max(e, smoothstep(0.025, 0.04, (dd[i] - dc) / dc));
    }
#ifdef NORMALS
    // creases: the normals on opposite sides of this pixel (the blend MSAA leaves on the edge pixel
    // itself never decides), so a straight crease is one unbroken line
    for (int i = 0; i < 8; i += 2) {
      if (!cr) break;
      vec2 o = nb(i) * uTexel * uScale;
      vec4 a1 = texture2D(tAux, vUv + o), a2 = texture2D(tAux, vUv - o);
      if (a1.a > 0.5 && a2.a > 0.5 && abs(dd[i] - dd[i + 1]) / dc < 0.06) e = max(e, smoothstep(0.78, 0.72, dot(dn(a1), dn(a2))));
    }
#endif
    ink = e * (cr ? ac.a * 2.0 - 1.0 : ac.a * 2.0) * (1.0 - smoothstep(28.0, 70.0, dc));
  }
  // halftone dots in environment shadows (under the ink, never on it)
  if (uHalfK > 0.0 && ht > 0.5) {
    vec2 p = gl_FragCoord.xy / (7.0 * uScale); p = vec2(p.x + p.y, p.y - p.x) * 0.7071;
    float d = length(fract(p) - 0.5), r = 0.32, aa = 0.6 / (7.0 * uScale);
    c = mix(c, c * 0.72, (1.0 - smoothstep(r - aa, r + aa, d)) * uHalfK);
  }
  c = mix(c, uInk, ink);
  c += (texture2D(tBloomA, vUv).rgb * 0.75 + texture2D(tBloomB, vUv).rgb * 0.9) * uBloom;
  // grade: lift and gain per channel, contrast, saturation, vignette
  c = (c - 0.5) * uContrast + 0.5;
  c = uLift + c * (uGain - uLift);
  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat);
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.45, 1.05, length(q));
  // speed lines at boost: thin streaks round the edge of the frame
  if (uSpeed > 0.01) {
    float ang = atan(q.y, q.x), r = length(q), k = floor(ang * 38.0);
    float on = step(0.62, hash(k)) * step(fract(r * 1.7 - uTime * 3.1 + hash(k + 3.0)), 0.42);
    float w = abs(fract(ang * 38.0) - 0.5);
    c = mix(c, uPaper, on * smoothstep(0.12, 0.0, w) * smoothstep(0.42, 0.85, r) * uSpeed * 0.75);
  }
  // impact frame: a two-frame high-contrast ink flash
  if (uImpact > 0.01) { float lum = dot(c, vec3(0.3, 0.55, 0.15)); c = mix(c, mix(uInk, uPaper, step(0.5, lum)), uImpact); }
  // on the way to FXAA, alpha carries the ink so the lines are kept whole (FXAA would break them into dashes)
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), mix(1.0, ink, uInkA));
}`;
const FXAA_FS = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
float lu(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec4 mm = texture2D(tSrc, vUv); vec3 m = mm.rgb;
  if (mm.a > 0.5) { gl_FragColor = vec4(m, 1.0); return; }      // an ink line: kept as drawn, only its surroundings are smoothed
  float n = lu(texture2D(tSrc, vUv + vec2(0.0, uTexel.y)).rgb), s = lu(texture2D(tSrc, vUv - vec2(0.0, uTexel.y)).rgb);
  float e = lu(texture2D(tSrc, vUv + vec2(uTexel.x, 0.0)).rgb), w = lu(texture2D(tSrc, vUv - vec2(uTexel.x, 0.0)).rgb), c = lu(m);
  float lo = min(c, min(min(n, s), min(e, w))), hi = max(c, max(max(n, s), max(e, w)));
  if (hi - lo < max(0.04, hi * 0.12)) { gl_FragColor = vec4(m, 1.0); return; }
  vec2 dir = vec2(-((n + s) - (e + w)), (n + e) - (s + w)) ;
  float r = 1.0 / (min(abs(dir.x), abs(dir.y)) + max((n + s + e + w) * 0.03, 0.008));
  dir = clamp(dir * r, -6.0, 6.0) * uTexel;
  vec3 a = 0.5 * (texture2D(tSrc, vUv - dir / 6.0).rgb + texture2D(tSrc, vUv + dir / 6.0).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tSrc, vUv - dir * 0.5).rgb + texture2D(tSrc, vUv + dir * 0.5).rgb);
  float lb = lu(b);
  gl_FragColor = vec4(lb < lo || lb > hi ? a : b, 1.0);
}`;

// ---- setup ------------------------------------------------------------------------------------------
export function initRender(canvas) {
  const T = THREE;
  T.ColorManagement.enabled = false;
  const renderer = new T.WebGLRenderer({ canvas, alpha: false, premultipliedAlpha: false, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.info.autoReset = false;
  R.renderer = renderer;
  R.scene = new T.Scene();
  R.camera = new T.PerspectiveCamera(TUNE.camfov, 16 / 9, 0.5, 260);
  R.u = {
    uLight: { value: new T.Vector3(0.42, 0.8, 0.43).normalize() }, uShade: { value: new T.Vector3(0.62, 0.58, 0.78) },
    uKey: { value: new T.Vector3(1, 0.97, 0.9) }, uTint: { value: new T.Vector3(1.0, 0.55, 0.6) }, uTintAmt: { value: 0 },
    uRes: { value: new T.Vector2(1, 1) }, uShadowMap: { value: null }, uShadowOn: { value: 0 }, uShadowTexel: { value: new T.Vector2(1 / 2048, 1 / 2048) },
    uShadowMat: { value: new T.Matrix4() }, uShadowPass: { value: 0 }, uFlat: { value: 0 }, uInk: { value: v3(PAL.outline) }, uTime: { value: 0 },
  };
  R.grade = { sat: 1.05, contrast: 1.03, lift: [0, 0, 0], gain: [1, 1, 1], vignette: 0.22, bloom: 1, halftone: 0.16 };
  // the full-screen passes
  const quadGeo = new T.BufferGeometry();
  quadGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  R.quad = new T.Mesh(quadGeo, null); R.quad.frustumCulled = false;
  R.quadScene = new T.Scene(); R.quadScene.add(R.quad);
  R.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (fs, uniforms, defines) => new T.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, defines: defines || {}, depthTest: false, depthWrite: false });
  R.post = {
    bright: pass(BRIGHT_FS, { tColor: { value: null }, uTexel: { value: new T.Vector2() } }),
    blur: pass(BLUR_FS, { tSrc: { value: null }, uDir: { value: new T.Vector2() } }),
    fxaa: pass(FXAA_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } }),
    composite: null,
  };
  const comp = (normals) => pass(COMPOSITE_FS, {
    tColor: { value: null }, tAux: { value: null }, tDepth: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
    uTexel: { value: new T.Vector2() }, uRes: { value: new T.Vector2() }, uScale: { value: 1 }, uNear: { value: 0.5 }, uFar: { value: 260 },
    uInk: R.u.uInk, uPaper: { value: v3(0xFFFDF6) }, uBloom: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1 }, uLift: { value: new T.Vector3() },
    uGain: { value: new T.Vector3(1, 1, 1) }, uVignette: { value: 0.2 }, uSpeed: { value: 0 }, uImpact: { value: 0 }, uTime: R.u.uTime, uHalfK: { value: 0.16 }, uLines: { value: 1 }, uInkA: { value: 0 },
  }, normals ? { NORMALS: 1 } : {});
  R.post.compN = comp(true); R.post.compD = comp(false);
  R.black = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); R.black.needsUpdate = true;
  // the HIGH-tier shadow map: one orthographic depth view that follows the camera
  const sm = 2048, depth = new T.DepthTexture(sm, sm);
  R.shadow = { size: sm, rt: new T.WebGLRenderTarget(sm, sm, { depthTexture: depth, depthBuffer: true }), cam: new T.OrthographicCamera(-22, 22, 22, -22, 1, 90), span: 22 };
  R.u.uShadowMap.value = depth;
  R.u.uShadowTexel.value.set(1 / sm, 1 / sm);
  const q = new URLSearchParams(location.search).get('quality');
  R.forced = !!TIERS[q];
  setTier(R.forced ? q : 'high');
  return R;
}

// Switches the quality tier (ART.md section 2): pixel ratio, MSAA, post stack, crease normals, bloom, shadow map.
export function setTier(name) {
  R.tier = TIERS[name] ? name : 'high';
  R.u.uShadowOn.value = TIERS[R.tier].shadow ? 1 : 0;
  R.slow = 0;
  for (const k of ['main', 'bloomA', 'bloomB', 'bloomC', 'ldr']) if (R[k]) { R[k].dispose(); R[k] = null; }
  resizeRender();
}

export function resizeRender() {
  const T = THREE, r = R.renderer, cv = r.domElement, tier = TIERS[R.tier];
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  R.ratio = Math.min(devicePixelRatio || 1, Math.min(w, h) < 1000 ? tier.small : tier.ratio);
  r.setPixelRatio(R.ratio);
  r.setSize(w, h, false);
  R.w = w; R.h = h;
  const pw = Math.round(w * R.ratio), ph = Math.round(h * R.ratio);
  R.u.uRes.value.set(pw, ph);
  R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
  if (tier.post) {
    if (!R.main) {
      R.main = new T.WebGLRenderTarget(pw, ph, { count: 2, samples: tier.samples, depthTexture: new T.DepthTexture(pw, ph), depthBuffer: true });
      for (const t of R.main.textures) { t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; }
      R.main.textures[0].minFilter = R.main.textures[0].magFilter = T.LinearFilter;
      R.bloomA = new T.WebGLRenderTarget(pw >> 1, ph >> 1); R.bloomB = new T.WebGLRenderTarget(pw >> 1, ph >> 1); R.bloomC = new T.WebGLRenderTarget(pw >> 2, ph >> 2);
      R.bloomD = new T.WebGLRenderTarget(pw >> 2, ph >> 2);
      if (tier.fxaa) R.ldr = new T.WebGLRenderTarget(pw, ph);
    } else {
      R.main.setSize(pw, ph);
      for (const k of ['bloomA', 'bloomB']) R[k].setSize(pw >> 1, ph >> 1);
      for (const k of ['bloomC', 'bloomD']) R[k].setSize(pw >> 2, ph >> 2);
      if (R.ldr) R.ldr.setSize(pw, ph);
    }
  }
  for (const m of R.hulls || []) m.uniforms.uThick.value = m.userData.px * ph / 1080;
}

// ---- materials --------------------------------------------------------------------------------------
// The cel material. o: { skinned (bone count), instanced cell (instCell), mapA (faces or patterns),
// mapB (labels or kit), faceCell (cell size of mapA in uv), gridA, gridB, rim (0..1), ink (crease weight 0..1),
// shadow (receives the shadow map), halftone (environment), side }.
export function celMaterial(o = {}) {
  const T = THREE, u = R.u, defines = {};
  if (o.skinned) { defines.SKINNED = 1; defines.NBONES = o.skinned * 3; }
  if (o.instCell) defines.INST_CELL = 1;
  if (o.mapA) { defines.MAP_A = 1; defines.GRID_A = (o.gridA || 8).toFixed(1); defines.FACE_CELL = (o.faceCell || 0.125).toFixed(5); }
  if (o.mapB) { defines.MAP_B = 1; defines.GRID_B = (o.gridB || 8).toFixed(1); }
  if (o.shadow) defines.RECEIVE_SHADOW = 1;
  const m = new T.ShaderMaterial({
    vertexShader: CEL_VS, fragmentShader: CEL_FS, defines, vertexColors: true, side: o.side || T.FrontSide,
    uniforms: {
      uLight: u.uLight, uShade: u.uShade, uKey: u.uKey, uTint: u.uTint, uTintAmt: u.uTintAmt, uShadowMap: u.uShadowMap, uShadowOn: u.uShadowOn,
      uShadowTexel: u.uShadowTexel, uShadowMat: u.uShadowMat, uFlat: o.flat === false ? { value: 0 } : u.uFlat, uInk: u.uInk,
      uRim: { value: o.rim || 0 }, uGlow: { value: new T.Vector3() }, uInkW: { value: o.creases === false ? (o.ink === undefined ? 1 : o.ink) * 0.49 : 0.5 + (o.ink === undefined ? 1 : o.ink) * 0.5 }, uHalftone: { value: o.halftone ? 1 : 0 },
      uFace: { value: new T.Vector2() }, uMapA: { value: o.mapA || null }, uMapB: { value: o.mapB || null }, uBones: { value: o.bones || null },
    },
  });
  return m;
}
// The ink hull for characters and carts (3 px at 1080p) and hazards and hot items (2.5 px).
export function hullMaterial(px, skinned) {
  const T = THREE, u = R.u, defines = {};
  if (skinned) { defines.SKINNED = 1; defines.NBONES = skinned * 3; }
  const m = new T.ShaderMaterial({ vertexShader: HULL_VS, fragmentShader: HULL_FS, defines, side: T.BackSide,
    uniforms: { uRes: u.uRes, uThick: { value: px }, uInk: u.uInk, uTint: u.uTint, uTintAmt: u.uTintAmt, uShadowPass: u.uShadowPass, uBones: { value: null } } });
  m.userData.px = px;
  (R.hulls || (R.hulls = [])).push(m);
  m.uniforms.uThick.value = px * R.u.uRes.value.y / 1080;
  return m;
}
// Transparent materials keep the target's alpha (the emissive mask) unless they glow themselves.
export function blendMaterial(m, additive, glow) {
  const T = THREE;
  m.transparent = true; m.depthWrite = false; m.blending = T.CustomBlending;
  m.blendSrc = T.SrcAlphaFactor; m.blendDst = additive ? T.OneFactor : T.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = glow ? T.OneFactor : T.ZeroFactor; m.blendDstAlpha = T.OneFactor;
  return m;
}

// Per-store look: shadow tint, key light, light direction and the grade (ART.md section 6).
export function setGrade(g = {}) {
  const u = R.u, d = R.grade;
  if (g.shade) u.uShade.value.set(...g.shade);
  if (g.key) u.uKey.value.set(...g.key);
  if (g.light) u.uLight.value.set(...g.light).normalize();
  for (const k of ['sat', 'contrast', 'lift', 'gain', 'vignette', 'bloom', 'halftone']) if (g[k] !== undefined) d[k] = g[k];
}

// ---- frame --------------------------------------------------------------------------------------------
const drawQuad = (mat, target) => { R.quad.material = mat; R.renderer.setRenderTarget(target); R.renderer.render(R.quadScene, R.quadCam); };
// fx: { speed 0..1, impact 0..1 } for the grade pass. focus: { x, z } the point the shadow map centres on.
const _cv = { set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, x: 0, y: 0, z: 0 };
const _lk = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; } };
export function renderFrame(fx = {}, focus) {
  const T = THREE, r = R.renderer, t0 = performance.now(), tier = TIERS[R.tier];
  r.info.reset();
  R.u.uTime.value = R.clock;
  if (tier.shadow && focus) renderShadow(focus);
  if (!tier.post) {
    // Straight to the canvas. The canvas has an alpha channel and the scene's alpha is the glow mask, so
    // the clear writes an opaque alpha and the scene draws with alpha writes masked off.
    const gl = r.getContext(), cb = r.state.buffers.color;
    r.setRenderTarget(null);
    r.setClearAlpha(1); r.clear(true, true, false);
    gl.colorMask(true, true, true, false); cb.setLocked(true);
    r.autoClear = false;
    const t0 = r.info.render.triangles;
    r.render(R.scene, R.camera);
    R.stats.mainTris = r.info.render.triangles - t0;
    r.autoClear = true; cb.setLocked(false); cb.setMask(true); gl.colorMask(true, true, true, true);
    r.setClearAlpha(0);
  } else {
    r.setRenderTarget(R.main);
    const t0 = r.info.render.triangles;
    r.render(R.scene, R.camera);
    R.stats.mainTris = r.info.render.triangles - t0;
    const main = R.main.textures, P = R.post, g = R.grade;
    // bloom from the emissive mask: half-res bright pass, blurred, then a quarter-res copy blurred wider
    let bA = R.black, bB = R.black;
    if (tier.bloom) {
      P.bright.uniforms.tColor.value = main[0]; P.bright.uniforms.uTexel.value.set(1 / R.main.width, 1 / R.main.height);
      drawQuad(P.bright, R.bloomA);
      const blur = (src, dst, dx, dy, w, h) => { P.blur.uniforms.tSrc.value = src.texture; P.blur.uniforms.uDir.value.set(dx / w, dy / h); drawQuad(P.blur, dst); };
      const hw = R.bloomA.width, hh = R.bloomA.height;
      blur(R.bloomA, R.bloomB, 1, 0, hw, hh); blur(R.bloomB, R.bloomA, 0, 1, hw, hh);
      if (tier.bloom > 1) { blur(R.bloomA, R.bloomC, 2, 0, hw, hh); blur(R.bloomC, R.bloomD, 0, 2, R.bloomC.width, R.bloomC.height); bB = R.bloomD.texture; }
      bA = R.bloomA.texture;
    }
    const C = tier.normals ? P.compN : P.compD, cu = C.uniforms;
    cu.tColor.value = main[0]; cu.tAux.value = main[1]; cu.tDepth.value = R.main.depthTexture; cu.tBloomA.value = bA; cu.tBloomB.value = bB;
    cu.uTexel.value.set(1 / R.main.width, 1 / R.main.height); cu.uRes.value.set(R.main.width, R.main.height);
    cu.uScale.value = Math.max(1, R.main.height / 1080); cu.uNear.value = R.camera.near; cu.uFar.value = R.camera.far;
    cu.uBloom.value = tier.bloom ? g.bloom : 0; cu.uSat.value = g.sat; cu.uContrast.value = g.contrast; cu.uLift.value.set(...g.lift); cu.uGain.value.set(...g.gain);
    cu.uVignette.value = g.vignette; cu.uSpeed.value = fx.speed || 0; cu.uImpact.value = fx.impact || 0; cu.uHalfK.value = tier.halftone ? g.halftone : 0;
    cu.uLines.value = fx.lines === false ? 0 : 1;
    cu.uInkA.value = tier.fxaa ? 1 : 0;
    if (tier.fxaa) {
      drawQuad(C, R.ldr);
      P.fxaa.uniforms.tSrc.value = R.ldr.texture; P.fxaa.uniforms.uTexel.value.set(1 / R.ldr.width, 1 / R.ldr.height);
      drawQuad(P.fxaa, null);
    } else drawQuad(C, null);
  }
  R.stats.calls = r.info.render.calls;
  R.stats.tris = R.stats.mainTris || r.info.render.triangles;
  R.stats.ms = performance.now() - t0;
}

// The shadow map: casters live on layer 1. The light camera sits up the light direction from the focus,
// snapped to whole texels so the shadows do not crawl as the camera moves.
const _v = { x: 0 };
function renderShadow(focus) {
  const T = THREE, S = R.shadow, cam = S.cam, L = R.u.uLight.value, r = R.renderer;
  const texel = S.span * 2 / S.size;
  cam.position.set(focus.x + L.x * 40, L.y * 40, focus.z + L.z * 40);
  cam.lookAt(focus.x, 0, focus.z);
  cam.updateMatrixWorld();
  // snap the light-space position of the focus to the texel grid
  const p = new T.Vector3(focus.x, 0, focus.z).applyMatrix4(cam.matrixWorldInverse);
  const dx = p.x - Math.round(p.x / texel) * texel, dy = p.y - Math.round(p.y / texel) * texel;
  cam.position.add(new T.Vector3(dx, dy, 0).applyQuaternion(cam.quaternion));
  cam.updateMatrixWorld();
  cam.layers.set(1);
  R.u.uShadowPass.value = 1;
  for (const m of R.hulls || []) m.visible = false;
  r.setRenderTarget(S.rt);
  r.clear();
  r.render(R.scene, cam);
  R.u.uShadowPass.value = 0;
  for (const m of R.hulls || []) m.visible = true;
  r.setRenderTarget(null);
  R.u.uShadowMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
}

// ---- quality: the title-screen benchmark and the in-run watchdog ------------------------------------------
// benchTick(dt) runs during the title: after 2 s of frames slower than 20 ms the tier steps down (and is
// measured again). watchFrameRate(dt) does the same in a run; neither ever steps up.
export function benchTick(dt) { watchFrameRate(dt); }
export function watchFrameRate(dt) {
  if (R.forced) return;
  R.slow = dt > 0.02 && dt < 0.25 ? R.slow + dt : Math.max(0, R.slow - dt * 0.5);
  if (R.slow < 2) return;
  if (R.tier === 'high') setTier('med'); else if (R.tier === 'med') setTier('low');
  R.slow = 0;
}

// ---- the chase camera ------------------------------------------------------------------------------------
// High and behind, aimed ahead of the cart; it pulls back and widens with speed, looks into turns and
// tips up over a wall that would hide the cart. orbit (radians) is a showcase view: lower, closer, turned
// by that angle. intro (1 -> 0 over the first countdown) swoops down from high above. aside (metres) is the
// receipt view, tipped steeply over the checkout with the cart to the left of the paper.
export function updateCamera(k, alpha, dt, towerHeight, world, orbit, intro = 0, aside, close) {
  const cam = R.cam, camera = R.camera;
  cam.close = (cam.close || 0) + ((close ? 1 : 0) - (cam.close || 0)) * (1 - Math.exp(-dt * (close ? 7 : 3)));
  if (!close && cam.close < 0.01) cam.side = 0;
  const x = lerp(k.px, k.x, alpha), z = lerp(k.pz, k.z, alpha);
  const h = k.ph + wrapAngle(k.h - k.ph) * alpha;
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
  const fast = Math.max(0, cam.zoom - 1);
  const kick = k.dashT > 0 ? 1 : k.boostT > 0 ? 0.6 : k.madT > 0 ? 0.45 : 0;
  cam.punch += (kick - cam.punch) * (1 - Math.exp(-dt * (kick > cam.punch ? 16 : 3)));
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let hidden = false;
  if (world) for (let d = 0.5; d < 1.6 && !hidden; d += 0.5) {
    const c = Math.floor((x - fx * d) / CFG.TILE), r = Math.floor((z - fz * d) / CFG.TILE);
    hidden = c < 0 || r < 0 || c >= world.cols || r >= world.rows || !world.floor[r * world.cols + c];
  }
  cam.lift += ((hidden || aside !== undefined ? 1 : 0) - cam.lift) * (1 - Math.exp(-dt * 6));
  const height = title ? (cam.near ? 2.3 : 4.4) : (TUNE.camheight * (0.95 + 0.05 * Math.min(cam.zoom, 1) + 0.16 * fast) + cam.tower * 0.45) * (1 + 0.4 * cam.lift + 3.2 * intro);
  const pitch = title ? 0.5 : TUNE.campitch * Math.PI / 180 + 0.45 * cam.lift + 0.42 * intro;
  const back = height / Math.tan(pitch);
  const desk = aside !== undefined ? cam.lift : 0;
  const lead = title ? cam.lead || 0.5 : (back - height / Math.tan(pitch + 0.2) - 1.1 * cam.punch) * (1 - 0.7 * desk);
  const lx = x + fx * lead - fz * (aside || 0) * desk, lz = z + fz * lead + fx * (aside || 0) * desk;
  let sx = 0, sy = 0;
  if (cam.shake > 0.001 && TUNE.shake) { const a = cam.shake * cam.shake * 0.5; sx = Math.sin(cam.t * 61.0) * a; sy = Math.sin(cam.t * 47.0 + 1.3) * a; }
  cam.shake = Math.max(0, cam.shake - dt * 1.8);
  camera.position.set(lx - fx * back + fz * sx, height + sy, lz - fz * back - fx * sx);
  camera.lookAt(lx + fz * sx * 0.5, 0.6, lz - fx * sx * 0.5);
  if (cam.close > 0.001) {
    // the checkout close-up: a front three-quarter portrait of the hero, from the side the counter is not on, clear
    // of the lamp pole on the lane's centre line
    const hx = Math.sin(h), hz = Math.cos(h), cx = x - hx * 1.3, cz = z - hz * 1.3, u = cam.close, e = u * u * (3 - 2 * u);
    if (!cam.side) {        // pick once: the side whose line of sight stays clear of the lane lamp poles
      let best = -1;
      for (const sd of [1, -1]) {
        const qx = cx + hx * 2.3 - hz * 1.35 * sd, qz = cz + hz * 2.3 + hx * 1.35 * sd;
        let near = 9;
        for (const l of (world && world.lanes) || []) {
          const ox = l.pole ? l.pole[0] : l.x, oz = l.pole ? l.pole[1] : l.z, vx = cx - qx, vz = cz - qz, t = Math.max(0, Math.min(1, ((ox - qx) * vx + (oz - qz) * vz) / (vx * vx + vz * vz)));
          near = Math.min(near, Math.hypot(qx + vx * t - ox, qz + vz * t - oz));
        }
        if (near > best) { best = near; cam.side = sd; }
      }
    }
    const px = cx + hx * 2.3 - hz * 1.35 * cam.side, pz = cz + hz * 2.3 + hx * 1.35 * cam.side;
    camera.position.lerp(_cv.set(px, 1.58, pz), e);
    _lk.set(lx, 0.6, lz).lerp(_cv.set(cx, 1.12, cz), e);
    camera.lookAt(_lk.x, _lk.y, _lk.z);
  }
  const aspect = R.w / R.h;
  const base = TUNE.camfov - 5 + 8 * Math.min(cam.zoom, 1) + 6 * fast + 7 * cam.punch;
  const tall = aspect < 1.3 ? Math.min(1.7, 1.3 / aspect) : 1;
  const fov = 2 * Math.atan(Math.tan((base + (40 - base) * (cam.close || 0)) * Math.PI / 360) * tall) * 180 / Math.PI;
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  cam.x = lx; cam.z = lz;
}
