// DOORBUSTER — kits.js
// Purpose: store kits as reusable data (ART.md section 6) and what builds them: the floor material
//          (tiles with grout and per-tile variation, painted graphics, light pools, shadows), the walls,
//          fixtures, signs and decor of a store, and the store's light and grade.
// Exports: KITS, kitOf, floorMaterial, floorMap, screenMaterial
// Depends on: config.js, render.js, atlas.js and the global THREE (inside functions only).

import { CFG, PAL, CROWD_MIX } from './config.js';
import { R, MRT_OUT, CEL_COMMON, v3 } from './render.js';
import { KIT } from './atlas.js';

// ---- the kits -----------------------------------------------------------------------------------------
// floor: two tile colours (a checker of `checker` tiles per 2 m plan tile), grout, the painted-graphics
// colour and the route arrows; pools: light pools every `grid` metres; grade: render.js setGrade.
export const KITS = {
  supermarket: {
    id: 'supermarket', name: 'PRICE PANIC', palette: { a: '#FFF6EA', b: '#8EE3C8', c: '#FF5A4E', d: '#FFD23F' }, sign: '#3D2C5E', top: '#6E5C96',
    signs: ['SNACKS', 'DRINKS', 'CANNED', 'BAKERY', 'DAIRY', 'FROZEN', 'PRODUCE', 'CEREAL'],
    shelves: { S: 'gondola', M: 'produce', L: 'freezer' }, fixture: { body: 0xFFF6EA, accent: 0x8EE3C8, trim: 0xFF5A4E, dark: 0x3D2C5E },
    floor: { a: 0xFFF3E2, b: 0xA9EBD5, grout: 0xD9CBB6, checker: 1, paint: 0x2E8C7C, arrow: 0xFFFFFF, vary: 0.035, wet: 0x1FA2FF },     // route chevrons in deep mint: red is for hazards
    walls: { face: 0xFFF6EA, band: 0x8EE3C8, stripe: 0xFF5A4E, top: 0x6E5C96, base: 0xE3D3BD },
    pools: { grid: 10, r: 2.9, warm: [1.0, 0.94, 0.78], k: 0.12 },
    grade: { shade: [0.66, 0.6, 0.82], key: [1, 0.96, 0.86], light: [0.42, 0.8, 0.43], sat: 1.06, contrast: 1.04, lift: [0.012, 0.0, 0.03], gain: [1, 0.99, 0.97], vignette: 0.2, bloom: 1, halftone: 0.16 },
    void: 0x2A2240,
    hot: 'cheese',
    crowd: CROWD_MIX.supermarket,
  },
  // CAN-DEMONIUM: concrete with yellow safety lines, blue pallet racks with orange beams, red roller doors, a
  // cool key with warm pools under caged lamps; the can pyramids are the colour.
  warehouse: {
    id: 'warehouse', name: 'CAN-DEMONIUM', palette: { a: '#D9D2C5', b: '#FFC800', c: '#E63946', d: '#3A6EA5' }, sign: '#2B2F3A', top: '#5A6274',
    signs: ['BULK', 'CANS', 'BEANS', 'SOUP', 'PALLETS', 'LOADING', 'AISLE 9', 'OVERSTOCK'],
    shelves: { S: 'rack', M: 'rack', L: 'rack' }, fixture: { body: 0x3A6EA5, accent: 0xFF8A1E, trim: 0xFFC800, dark: 0x2B2F3A },
    floor: { a: 0xD6CFC2, b: 0xCBC3B4, grout: 0xA69D8D, checker: 1, paint: 0xFFC800, arrow: 0x2B2F3A, vary: 0.07, wet: 0x1FA2FF, lines: 0xFFC800 },
    walls: { face: 0xC9C2B4, band: 0x3A6EA5, stripe: 0xFFC800, top: 0x5A6274, base: 0x8E8676 },
    pools: { grid: 12, r: 3.4, warm: [1.0, 0.88, 0.66], k: 0.15 },
    grade: { shade: [0.52, 0.6, 0.8], key: [0.9, 0.96, 1.0], light: [0.34, 0.84, 0.42], sat: 1.05, contrast: 1.07, lift: [0.0, 0.01, 0.035], gain: [0.98, 1, 1.02], vignette: 0.24, bloom: 1, halftone: 0.18 },
    void: 0x1E2230,
    hot: 'goldcan',
    crowd: CROWD_MIX.warehouse,
  },
  // GADGET GOBLIN: glossy navy floor under a cyan grid, TV walls playing their channels, neon, hard cool light and
  // strong bloom; the smart barriers are the red and the blue.
  electronics: {
    id: 'electronics', name: 'GADGET GOBLIN', palette: { a: '#1B1F3B', b: '#00E5FF', c: '#FF4FD8', d: '#FFD23F' }, sign: '#11142A', top: '#2A2F5A',
    signs: ['PHONES', 'AUDIO', 'GAMING', 'LAPTOPS', 'CAMERAS', 'SMART HOME', 'TV & VIDEO', 'VR ZONE'],
    shelves: { S: 'tech', M: 'techtable', L: 'tvwall' }, fixture: { body: 0x2A2F5A, accent: 0x00E5FF, trim: 0xFF4FD8, dark: 0x11142A },
    floor: { a: 0x222850, b: 0x1C2042, grout: 0x2FC8E8, checker: 1, paint: 0xFF4FD8, arrow: 0x00E5FF, vary: 0.05, wet: 0x7CC6FE, grid: 0.3, groutW: 0.487, gloss: 0.9 },
    walls: { face: 0x262B52, band: 0x00E5FF, stripe: 0xFF4FD8, top: 0x2A2F5A, base: 0x11142A, neon: true, bulbs: [0x00E5FF, 0xFF4FD8] }, posters: [54, 55, 57],
    pools: { grid: 10, r: 2.6, warm: [0.8, 0.95, 1.12], k: 0.1 },
    grade: { shade: [0.5, 0.52, 0.92], key: [0.92, 0.96, 1.05], light: [0.3, 0.85, 0.45], sat: 1.12, contrast: 1.1, lift: [0.01, 0.0, 0.05], gain: [0.97, 1, 1.05], vignette: 0.28, bloom: 1.5, halftone: 0.14 },
    void: 0x0D0F22,
    hot: 'gigatv',
    crowd: CROWD_MIX.electronics,
  },
  // DRESS TO DISTRESS: cream marble with gold inlays and veins, blush walls, racks of patterned clothes, mannequins,
  // velvet fitting rooms, a runway of bulbs, walls of shoe boxes, warm soft light under chandeliers.
  boutique: {
    id: 'boutique', name: 'DRESS TO DISTRESS', palette: { a: '#FFF3E8', b: '#FFD6E0', c: '#E9B949', d: '#C2185B' }, sign: '#5A2340', top: '#8A4A6E',
    signs: ['DRESSES', 'SHOES', 'BAGS', 'SCARVES', 'COATS', 'PERFUME', 'RUNWAY', 'SALE'],
    shelves: { S: 'clothes', M: 'foldtable', L: 'shoewall' }, fixture: { body: 0xFFF3E8, accent: 0xE9B949, trim: 0xC2185B, dark: 0x5A2340 },
    floor: { a: 0xFBF4EC, b: 0xF4EAE0, grout: 0xE9B949, checker: 1, paint: 0xC2185B, arrow: 0xE9B949, vary: 0.03, groutW: 0.482, marble: 0.35, vein: 0xD9C4CF, gloss: 0.7, glossMode: 1, wet: 0x1FA2FF },
    walls: { face: 0xFFD6E0, band: 0xFFF3E8, stripe: 0xE9B949, top: 0x8A4A6E, base: 0xC9A0B4, bulbs: [0xFFF1C4], booths: true }, posters: [54, 54, 54],
    pools: { grid: 10, r: 3.0, warm: [1.06, 0.92, 0.86], k: 0.12 },
    grade: { shade: [0.84, 0.6, 0.76], key: [1.0, 0.95, 0.92], light: [0.4, 0.82, 0.42], sat: 1.04, contrast: 1.02, lift: [0.03, 0.01, 0.025], gain: [1.02, 0.98, 0.98], vignette: 0.18, bloom: 1.1, halftone: 0.12 },
    void: 0x3A1F33,
    hot: 'handbag',
    crowd: CROWD_MIX.boutique,
  },
  // GAME ON: slate rubber with painted zones, turf, an orange track, the pool; bright stadium light.
  sports: {
    id: 'sports', name: 'GAME ON', palette: { a: '#2B2D42', b: '#3BB273', c: '#FF7F11', d: '#48CAE4' }, sign: '#2B2D42', top: '#44475E',
    signs: ['GYM', 'POOL', 'TRACK', 'PITCH', 'BALLS', 'WEIGHTS', 'SHOES', 'SWIM'],
    shelves: { S: 'gondola', M: 'gondola', L: 'gondola' }, fixture: { body: 0xF4F7FB, accent: 0x3BB273, trim: 0xFF7F11, dark: 0x2B2D42 },
    floor: { a: 0x4B4D5E, b: 0x464859, grout: 0x34364A, checker: 1, paint: 0xFF7F11, arrow: 0xFFFFFF, vary: 0.04, wet: 0x48CAE4, groutW: 0.494, fleck: 1 },   // rubber gym mats with coloured flecks
    walls: { face: 0xE9EEF5, band: 0x3BB273, stripe: 0xFF7F11, top: 0x44475E, base: 0x2B2D42 },
    pools: { grid: 12, r: 3.4, warm: [1.0, 1.0, 0.95], k: 0.12 },
    grade: { shade: [0.6, 0.66, 0.84], key: [1, 1, 0.96], light: [0.36, 0.86, 0.36], sat: 1.08, contrast: 1.06, lift: [0.0, 0.01, 0.03], gain: [1, 1, 1], vignette: 0.18, bloom: 1, halftone: 0.14 },
    void: 0x1C1E2E,
    hot: 'trophy',
    crowd: CROWD_MIX.sports,
  },
  // FOOD FIGHT: terracotta tiles with painted queue lines, stalls with neon menus, warm saturated light, steam.
  food: {
    id: 'food', name: 'FOOD FIGHT', palette: { a: '#FFF1DE', b: '#F4A261', c: '#D62828', d: '#E07A5F' }, sign: '#5C2A1E', top: '#7A3B2A',
    signs: ['SUSHI', 'GRILL', 'BURGERS', 'NOODLES', 'DESSERT', 'TACOS', 'PIZZA', 'SODA'],
    shelves: { S: 'stall', M: 'stall', L: 'stall' }, fixture: { body: 0xFFF1DE, accent: 0xF4A261, trim: 0xD62828, dark: 0x5C2A1E },
    floor: { a: 0xE58F72, b: 0xDB8166, grout: 0xB9634B, checker: 2, paint: 0xFFF1DE, arrow: 0xFFF1DE, vary: 0.06, wet: 0x1FA2FF },
    walls: { face: 0xFFF1DE, band: 0xF4A261, stripe: 0xD62828, top: 0x7A3B2A, base: 0xB9634B },
    pools: { grid: 10, r: 3.0, warm: [1.08, 0.92, 0.78], k: 0.13 },
    grade: { shade: [0.78, 0.56, 0.66], key: [1, 0.94, 0.84], light: [0.42, 0.8, 0.43], sat: 1.12, contrast: 1.05, lift: [0.03, 0.0, 0.01], gain: [1.03, 0.98, 0.95], vignette: 0.2, bloom: 1.1, halftone: 0.15 },
    void: 0x2E1A16,
    hot: 'cake',
    crowd: CROWD_MIX.food,
  },
};
export function kitOf(def) { return KITS[def.kit || 'supermarket'] || KITS.supermarket; }

// ---- TV screens ---------------------------------------------------------------------------------------------
// Every screen plays the store's four channels (atlas cells KIT.ch0..+3) on its own clock (tex.z is its seed):
// a scrolling platformer, a bouncing cartoon, the match, a music show with live equalizer bars; scanlines, a
// vignette, a burst of static at each channel change. Screens glow (they bloom).
const SCREEN_VS = 'attribute vec4 tex; varying vec2 vUv; varying vec4 vTex; void main() { vUv = uv; vTex = tex; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const SCREEN_FS = `uniform sampler2D uMap; uniform float uTime; uniform float uCh0; varying vec2 vUv; varying vec4 vTex; ${MRT_OUT}
vec4 cell(float k, vec2 uv) { vec2 o = vec2(mod(k, 8.0), floor(k / 8.0)) / 8.0; return texture2D(uMap, o + (0.004 + clamp(uv, 0.0, 1.0) * 0.992) / 8.0); }
void main() {
  float seed = vTex.z, t = uTime + seed * 37.0, slot = t / 6.0 + seed * 3.0, ch = mod(floor(slot) + floor(seed * 4.0), 4.0), since = fract(slot) * 6.0;
  vec2 uv = vUv;
  if (ch < 0.5) uv.x = fract(uv.x + t * 0.12);
  else if (ch < 1.5) uv.y += sin(t * 7.0) * 0.035;
  else if (ch < 2.5) uv = (uv - 0.5) * (0.92 + 0.08 * sin(t * 1.7)) + 0.5;
  vec3 col = cell(uCh0 + ch, uv).rgb;
  if (ch > 2.5) { float bx = floor(vUv.x * 9.0), hgt = 0.25 + 0.5 * abs(sin(t * (2.3 + bx * 0.61) + bx * 1.7)); col = mix(col, mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.31, 0.85), vUv.y), step(1.0 - vUv.y, hgt) * step(0.18, fract(vUv.x * 9.0)) * step(vUv.y, 0.8)); }
  col *= 0.88 + 0.12 * step(0.5, fract(vUv.y * 70.0));
  float n = fract(sin(dot(floor(vUv * vec2(90.0, 60.0)) + floor(t * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
  col = mix(col, vec3(n * 0.9 + 0.1), step(since, 0.22));
  col *= 1.0 - 0.4 * pow(length(vUv - 0.5) * 1.25, 2.0);
  gl_FragColor = vec4(col * 1.05, 0.5);
  oAux = vec4(0.5, 0.5, 0.0, 0.0);
}`;
export function screenMaterial(atlas) {
  return new THREE.ShaderMaterial({ vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS, uniforms: { uMap: { value: atlas }, uTime: R.u.uTime, uCh0: { value: KIT.ch0 } } });
}

// ---- the floor ------------------------------------------------------------------------------------------
// One texel of uMap per plan tile: r = spare, g = decal / 16 (1-4 arrow east, south, west, north; 5 checkout
// hatch; 6 start grid; 7 closed lane; 8-11 travelator east, south, west, north; 12 wet floor; 13 train
// track; 14 lane about to close), b = 1 for a belt that runs against the route or a north-south track,
// a = 1 on floor and 0 on void.
const FLOOR_VS = `uniform mat4 uShadowMat; varying vec3 vW; varying vec4 vSh;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vSh = uShadowMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FS = `
${CEL_COMMON}
uniform sampler2D uMap; uniform vec2 uMapSize; uniform float uTile; uniform float uTime;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uGrout; uniform vec3 uPaint; uniform vec3 uArrow; uniform vec3 uWet; uniform vec3 uBelt; uniform vec3 uClosed; uniform vec3 uHatch;
uniform float uChecker; uniform float uVary; uniform float uPoolGrid; uniform float uPoolR; uniform vec3 uPoolC; uniform float uPoolK; uniform float uLines; uniform vec3 uLineC;
uniform float uGroutW; uniform float uGrid; uniform float uGloss; uniform float uGlossMode; uniform float uMarble; uniform vec3 uVein; uniform float uFleck;
varying vec3 vW; varying vec4 vSh;
${MRT_OUT}
vec4 tileAt(vec2 id) { return texture2D(uMap, (id + 0.5) / uMapSize); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float vein(vec2 p) { float a = sin(p.x * 1.3 + sin(p.y * 1.7 + sin(p.x * 0.6 + p.y * 0.4) * 1.8) * 1.4 + p.y * 0.5); return 1.0 - smoothstep(0.0, 0.06 + fwidth(a) * 1.5, abs(a)); }
void main() {
  vec2 g = vW.xz / uTile, id = floor(g), f = fract(g), e = abs(f - 0.5);
  vec4 t = tileAt(id);
  vec2 w = fwidth(g) * 1.2;
  float far = clamp(1.0 - max(w.x, w.y) * 5.0, 0.0, 1.0);
  // the checker: uChecker squares per plan tile, grout between them, a slight variation per square
  vec2 cg = g * uChecker, cid = floor(cg), cf = fract(cg), ce = abs(cf - 0.5); vec2 cw = fwidth(cg) * 1.2;
  vec3 c = mix(uA, uB, mod(cid.x + cid.y, 2.0));
  c *= 1.0 + (hash2(cid) - 0.5) * uVary;
  if (uFleck > 0.5) {                          // rubber gym mats: flecks of the store's green, orange and pool blue, fading out with distance
    vec2 fq = floor(vW.xz * 12.0); float h = hash2(fq + 0.37), ff = clamp(1.0 - max(w.x, w.y) * 18.0, 0.0, 1.0);
    if (h > 0.91) c = mix(c, h > 0.97 ? vec3(0.23, 0.7, 0.45) : h > 0.94 ? vec3(1.0, 0.5, 0.07) : vec3(0.28, 0.79, 0.89), 0.5 * ff);
  }
  float grout = max(smoothstep(uGroutW - cw.x, uGroutW, ce.x), smoothstep(uGroutW - cw.y, uGroutW, ce.y)) * far;
  c = mix(c, uGrout, grout);
  // a faint bevel highlight on each square's upper-left edge (tiles, not paint)
  c = mix(c, c * 1.04, (1.0 - smoothstep(0.0, 0.06, cf.x)) * (1.0 - grout) * far * 0.6);
  float d = floor(t.g * 16.0 + 0.5), sf = floor(t.r * 16.0 + 0.5);
  if (d > 14.5) discard;
  // a zone's own surface (ART.md section 6): turf with mowing stripes, the orange track with lane lines, gym planks,
  // pool-deck tiles, kitchen tread plate, sushi-bar wood, a dessert checker; a white line where a surface ends
  if (sf > 0.5) {
    vec2 q = vW.xz;
    if (sf < 1.5) c = mix(vec3(0.2, 0.6, 0.3), vec3(0.25, 0.68, 0.35), step(0.5, fract(q.x / 3.0)));
    else if (sf < 2.5) { float a = abs(fract(q.y / 1.4) - 0.5), aw = fwidth(q.y / 1.4) * 1.2; c = mix(vec3(0.86, 0.42, 0.16), vec3(1.0), smoothstep(0.465 - aw, 0.465, a) * far); }
    else if (sf < 3.5) { float pl = floor(q.x / 0.3); c = vec3(0.8, 0.6, 0.38) * (0.92 + 0.12 * hash2(vec2(pl, floor(q.y / 1.7 + pl * 0.37)))); c = mix(c, c * 0.75, (1.0 - smoothstep(0.0, 0.02 + w.x * 0.3, fract(q.x / 0.3))) * far); }
    else if (sf < 4.5) { vec2 tq = fract(q / 0.5); c = mix(vec3(0.96, 0.98, 1.0), vec3(0.62, 0.84, 0.94), max(step(0.9, tq.x), step(0.9, tq.y)) * far); }
    else if (sf < 5.5) {                       // diamond tread plate: raised lozenges turning 90 degrees cell to cell
      vec2 cq = q / 0.45, ci = floor(cq), tq = fract(cq) - 0.5; float o = mod(ci.x + ci.y, 2.0) * 2.0 - 1.0;
      vec2 r = vec2(tq.x + o * tq.y, tq.x - o * tq.y) * 0.7071, rs = r + vec2(0.035, -0.035 * o);
      float lz = step(abs(r.x), 0.26) * step(abs(r.y), 0.055), sh = step(abs(rs.x), 0.26) * step(abs(rs.y), 0.055);
      c = vec3(0.47, 0.49, 0.54) * (0.97 + 0.06 * hash2(floor(q / 1.8)));
      c = mix(c, c * 0.72, sh * (1.0 - lz) * far); c = mix(c, c * 1.28, lz * far);
    }
    else if (sf < 6.5) { float pl = floor(q.y / 0.4); c = vec3(0.7, 0.47, 0.3) * (0.9 + 0.14 * hash2(vec2(pl, floor(q.x / 2.1 + pl * 0.5)))); c = mix(c, c * 0.7, (1.0 - smoothstep(0.0, 0.03, fract(q.y / 0.4))) * far); }
    else c = mix(vec3(1.0, 0.85, 0.9), vec3(0.99, 0.96, 0.9), mod(floor(q.x) + floor(q.y), 2.0));
    for (int k = 0; k < 4; k++) {
      vec2 o = k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(-1.0, 0.0) : k == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
      float n = floor(tileAt(id + o).r * 16.0 + 0.5), edge = k < 2 ? (o.x > 0.0 ? f.x : 1.0 - f.x) : (o.y > 0.0 ? f.y : 1.0 - f.y);
      if (n != sf && tileAt(id + o).a > 0.5) c = mix(c, vec3(1.0), (smoothstep(0.9, 0.9 + w.x, edge) - smoothstep(0.96, 0.96 + w.x, edge)) * far);
    }
  }                                            // a pit or a field of sliding panels: its own geometry lies below
  // marble veins (boutique floors)
  if (uMarble > 0.0) c = mix(c, uVein, vein(vW.xz * 0.55) * uMarble * far * (1.0 - grout));
  if (d > 0.5 && d < 4.5) {                                          // a painted chevron down the route
    vec2 dir = d < 1.5 ? vec2(1.0, 0.0) : d < 2.5 ? vec2(0.0, 1.0) : d < 3.5 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
    vec2 p = f - 0.5, q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
    float v = abs(q.x - 0.12 + abs(q.y) * 0.9);
    float m = (1.0 - smoothstep(0.085, 0.085 + w.x, v)) * (1.0 - smoothstep(0.3, 0.3 + w.x, abs(q.y)));
    float rim = (1.0 - smoothstep(0.125, 0.125 + w.x, v)) * (1.0 - smoothstep(0.34, 0.34 + w.x, abs(q.y)));
    c = mix(c, uPaint, rim * far);
    c = mix(c, uArrow, m * far);
  } else if (d > 4.5 && d < 5.5) {
    c = mix(mix(uHatch, uInk, step(0.5, fract((f.x + f.y) * 2.0))), c, 0.2);
  } else if (d > 5.5 && d < 6.5) {                                   // start grid: white dashes and a rail of rings
    c = mix(c, vec3(1.0), step(0.42, e.y) * step(0.5, fract(f.x * 4.0)) * 0.85);
  } else if (d > 6.5 && d < 7.5) {
    c = mix(mix(uInk, uClosed, step(0.72, fract((f.x + f.y) * 2.0))), c, 0.15);
  } else if (d > 7.5 && d < 11.5) {                                  // a belt whose arrows run with it
    vec2 dir = d < 8.5 ? vec2(1.0, 0.0) : d < 9.5 ? vec2(0.0, 1.0) : d < 10.5 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
    float along = dot(g, dir) - uTime * 2.5, across = abs(dot(f - 0.5, vec2(-dir.y, dir.x)));
    float v = abs(fract(along * 1.5) - 0.5 + across * 0.7);
    c = mix(uBelt, t.b > 0.5 ? uClosed : vec3(1.0), (1.0 - smoothstep(0.09, 0.09 + w.x * 2.0, v)) * step(across, 0.36) * 0.9 * far);
    c = mix(c, uInk, step(0.44, across) * 0.8);
  } else if (d > 11.5 && d < 12.5) {                                 // wet floor: a blue puddle with hard glints
    float pd = length((f - 0.5) * vec2(1.0, 1.3)) + 0.06 * sin(f.x * 9.0 + f.y * 7.0);
    float pud = 1.0 - smoothstep(0.43, 0.43 + w.x, pd), edg = 1.0 - smoothstep(0.465, 0.465 + w.x, pd), lip = 1.0 - smoothstep(0.51, 0.51 + w.x, pd);
    c = mix(c, vec3(1.0), (lip - edg) * far * 0.9); c = mix(c, uInk, (edg - pud) * far);      // a white rim and an ink edge: a hazard reads at a glance
    c = mix(c, uWet, pud * 0.92);
    float glint = step(0.92, sin((g.x + g.y) * 7.0 + uTime * 1.6) * sin((g.x - g.y) * 5.0 - uTime));
    c = mix(c, vec3(1.0), glint * pud * far);
  } else if (d > 13.5) {
    c = mix(mix(uHatch, uInk, step(0.5, fract((f.x + f.y) * 2.0))), c, 0.2);
    c = mix(c, uClosed, step(0.5, fract(uTime * 4.0)) * 0.7);
  } else if (d > 12.5) {
    vec2 q = t.b > 0.5 ? f.yx : f.xy;
    float rail = step(abs(abs(q.y - 0.5) - 0.25), 0.045), tie = step(0.55, fract(q.x * 3.0)) * step(abs(q.y - 0.5), 0.38);
    c = mix(c, uInk, max(rail * 0.85, tie * 0.42) * far + 0.07);
  }
  // painted safety lines a hand's width out from every wall (warehouse floors)
  if (uLines > 0.5) {
    float ln = 0.0;
    ln = max(ln, (1.0 - tileAt(id + vec2(-1.0, 0.0)).a) * smoothstep(0.1, 0.1 + w.x, f.x) * (1.0 - smoothstep(0.16, 0.16 + w.x, f.x)));
    ln = max(ln, (1.0 - tileAt(id + vec2(1.0, 0.0)).a) * smoothstep(0.1, 0.1 + w.x, 1.0 - f.x) * (1.0 - smoothstep(0.16, 0.16 + w.x, 1.0 - f.x)));
    ln = max(ln, (1.0 - tileAt(id + vec2(0.0, -1.0)).a) * smoothstep(0.1, 0.1 + w.y, f.y) * (1.0 - smoothstep(0.16, 0.16 + w.y, f.y)));
    ln = max(ln, (1.0 - tileAt(id + vec2(0.0, 1.0)).a) * smoothstep(0.1, 0.1 + w.y, 1.0 - f.y) * (1.0 - smoothstep(0.16, 0.16 + w.y, 1.0 - f.y)));
    c = mix(c, uLineC, ln * 0.92);
  }
  // a glossy floor mirrors the ceiling: its light strips (or chandeliers) slide across it with the camera
  if (uGloss > 0.0) {
    vec3 V = normalize(vW - cameraPosition); float up = max(0.08, -V.y);
    vec2 h = vW.xz + V.xz * (7.0 / up), q;
    float r;
    if (uGlossMode < 0.5) { q = abs(fract(h / vec2(9.0, 7.0)) - 0.5); r = (1.0 - smoothstep(0.035, 0.075, q.y)) * (1.0 - smoothstep(0.3, 0.42, q.x)); }
    else { q = (fract(h / 10.0) - 0.5) * 10.0; r = (1.0 - smoothstep(0.5, 1.5, length(q))) * 0.8 + (1.0 - smoothstep(0.0, 0.35, length(q))) * 0.4; }
    c = mix(c, mix(uPoolC, vec3(1.0), 0.45) * 1.1, r * (0.3 + 0.7 * pow(1.0 - up, 3.0)) * uGloss * (1.0 - grout) * far);
  }
  // light pools under the ceiling lamps: two hard-edged bands, warm
  vec2 pc = vW.xz / uPoolGrid; vec2 pq = (fract(pc) - 0.5) * uPoolGrid; float pr = length(pq);
  float pool = (1.0 - smoothstep(uPoolR - 0.03, uPoolR + 0.03, pr)) * 0.55 + (1.0 - smoothstep(uPoolR * 0.62 - 0.03, uPoolR * 0.62 + 0.03, pr)) * 0.45;
  c = mix(c, c * uPoolC * (1.0 + uPoolK * 2.2), pool * uPoolK * 6.0 * far);
  // shadow where the floor meets a wall, the shadow map, then the shade band
  float sh = 0.0;
  sh = max(sh, (1.0 - tileAt(id + vec2(-1.0, 0.0)).a) * (1.0 - smoothstep(0.1, 0.1 + w.x, f.x)));
  sh = max(sh, (1.0 - tileAt(id + vec2(1.0, 0.0)).a) * (1.0 - smoothstep(0.1, 0.1 + w.x, 1.0 - f.x)));
  sh = max(sh, (1.0 - tileAt(id + vec2(0.0, -1.0)).a) * (1.0 - smoothstep(0.1, 0.1 + w.y, f.y)));
  sh = max(sh, (1.0 - tileAt(id + vec2(0.0, 1.0)).a) * (1.0 - smoothstep(0.1, 0.1 + w.y, 1.0 - f.y)));
  sh = max(sh, shadowAt(vSh, 0.0015));
  c = mix(c, c * uShade, sh);
  c = mix(c, c * uTint, uTintAmt);
  if (uFlat > 0.5) c = vec3(0.96, 0.94, 0.9);
  gl_FragColor = vec4(c, grout * uGrid * far);                     // a glowing grid blooms (electronics)
  oAux = vec4(0.5, 0.5, 0.5 + 0.25 * step(0.5, sh), 0.0);
}`;
export function floorMaterial(kit) {
  const T = THREE, u = R.u, F = kit.floor, P = kit.pools;
  return new T.ShaderMaterial({
    vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS,
    uniforms: {
      uLight: u.uLight, uShade: u.uShade, uKey: u.uKey, uTint: u.uTint, uTintAmt: u.uTintAmt, uShadowMap: u.uShadowMap, uShadowOn: u.uShadowOn,
      uShadowTexel: u.uShadowTexel, uShadowMat: u.uShadowMat, uFlat: u.uFlat, uInk: u.uInk, uTime: u.uTime,
      uMap: { value: null }, uMapSize: { value: new T.Vector2(1, 1) }, uTile: { value: CFG.TILE },
      uA: { value: v3(F.a) }, uB: { value: v3(F.b) }, uGrout: { value: v3(F.grout) }, uPaint: { value: v3(F.paint) }, uArrow: { value: v3(F.arrow) },
      uWet: { value: v3(F.wet) }, uBelt: { value: v3(0x4A3D66) }, uClosed: { value: v3(PAL.danger) }, uHatch: { value: v3(PAL.sale) },
      uGroutW: { value: F.groutW || 0.475 }, uGrid: { value: F.grid || 0 }, uGloss: { value: F.gloss || 0 }, uGlossMode: { value: F.glossMode || 0 }, uMarble: { value: F.marble || 0 }, uVein: { value: v3(F.vein || 0) }, uFleck: { value: F.fleck || 0 },
      uChecker: { value: F.checker }, uVary: { value: F.vary }, uLines: { value: F.lines ? 1 : 0 }, uLineC: { value: v3(F.lines || 0) }, uPoolGrid: { value: P.grid }, uPoolR: { value: P.r }, uPoolC: { value: new T.Vector3(...P.warm) }, uPoolK: { value: P.k },
    },
  });
}

// The floor's tile map (see FLOOR_FS): decals, belts, wet patches, lanes, and route chevrons on every third tile.
export function floorMap(world) {
  const { cols, rows } = world, data = new Uint8Array(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) {
    const k = world.plan[Math.floor(i / cols)][i % cols];
    data[i * 4 + 1] = (world.pit[i] ? 15 : world.laneOf[i] >= 0 ? (world.lanes[world.laneOf[i]].closed ? 7 : 5) : world.belt[i] ? 7 + world.belt[i] : world.wet[i] ? 12 : k === '=' ? 13 : 0) * 16;
    const b = world.belt[i], to = b ? i + (b === 1 ? 1 : b === 3 ? -1 : b === 2 ? cols : -cols) : -1, line = world.plan[Math.floor(i / cols)];
    data[i * 4 + 2] = (b ? world.nav[to] > world.nav[i] : k === '=' && line[i % cols - 1] !== '=' && line[i % cols + 1] !== '=') ? 255 : 0;
    data[i * 4 + 3] = world.floor[i] ? 255 : 0;
  }
  const SURF = { turf: 1, track: 2, wood: 3, deck: 4, steel: 5, warm: 6, dessert: 7 }, zones = (world.def && world.def.zones) || [];
  for (let i = 0; i < cols * rows; i++) data[i * 4] = (SURF[(zones[world.zone[i]] || {}).surface] || 0) * 16;
  for (const ob of world.objs || []) if (ob.kind === 'panels') for (let j = 0; j < ob.nr; j++) for (let i = 0; i < ob.nc; i++) data[((ob.r0 + j) * cols + ob.c0 + i) * 4 + 1] = 15 * 16;   // panels over a pit
  let c = Math.floor(world.start.x / CFG.TILE), r = Math.floor(world.start.z / CFG.TILE);
  for (let n = 0; n < 600; n++) {
    let best = world.nav[r * cols + c], bc = c, br = r, dir = 0;
    for (const [dc, dr, d] of [[1, 0, 1], [0, 1, 2], [-1, 0, 3], [0, -1, 4]]) {
      const v = world.nav[(r + dr) * cols + c + dc];
      if (v < best - 1e-3) { best = v; bc = c + dc; br = r + dr; dir = d; }
    }
    if (!dir) break;
    if (n % 3 === 1 && world.plan[r][c] === '.') data[(r * cols + c) * 4 + 1] = dir * 16;
    c = bc; r = br;
  }
  const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
