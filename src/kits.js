// DOORBUSTER — kits.js
// Purpose: store kits as reusable data (ART.md section 6) and what builds them: the floor material
//          (tiles with grout and per-tile variation, painted graphics, light pools, shadows), the walls,
//          fixtures, signs and decor of a store, and the store's light and grade.
// Exports: KITS, kitOf, floorMaterial, floorMap
// Depends on: config.js, render.js and the global THREE (inside functions only).

import { CFG, PAL, CROWD_MIX } from './config.js';
import { R, MRT_OUT, CEL_COMMON, v3 } from './render.js';

// ---- the kits -----------------------------------------------------------------------------------------
// floor: two tile colours (a checker of `checker` tiles per 2 m plan tile), grout, the painted-graphics
// colour and the route arrows; pools: light pools every `grid` metres; grade: render.js setGrade.
export const KITS = {
  supermarket: {
    id: 'supermarket', name: 'PRICE PANIC', palette: { a: '#FFF6EA', b: '#8EE3C8', c: '#FF5A4E', d: '#FFD23F' }, sign: '#3D2C5E', top: '#6E5C96',
    signs: ['SNACKS', 'DRINKS', 'CANNED', 'BAKERY', 'DAIRY', 'FROZEN', 'PRODUCE', 'CEREAL'],
    shelves: { S: 'gondola', M: 'produce', L: 'freezer' }, fixture: { body: 0xFFF6EA, accent: 0x8EE3C8, trim: 0xFF5A4E, dark: 0x3D2C5E },
    floor: { a: 0xFFF3E2, b: 0xA9EBD5, grout: 0xD9CBB6, checker: 1, paint: 0xFF5A4E, arrow: 0xFFFFFF, vary: 0.035, wet: 0x7CC6FE },
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
    floor: { a: 0xD6CFC2, b: 0xCBC3B4, grout: 0xA69D8D, checker: 1, paint: 0xFFC800, arrow: 0x2B2F3A, vary: 0.07, wet: 0x7CC6FE, lines: 0xFFC800 },
    walls: { face: 0xC9C2B4, band: 0x3A6EA5, stripe: 0xFFC800, top: 0x5A6274, base: 0x8E8676 },
    pools: { grid: 12, r: 3.4, warm: [1.0, 0.88, 0.66], k: 0.15 },
    grade: { shade: [0.52, 0.6, 0.8], key: [0.9, 0.96, 1.0], light: [0.34, 0.84, 0.42], sat: 1.05, contrast: 1.07, lift: [0.0, 0.01, 0.035], gain: [0.98, 1, 1.02], vignette: 0.24, bloom: 1, halftone: 0.18 },
    void: 0x1E2230,
    hot: 'goldcan',
    crowd: CROWD_MIX.warehouse,
  },
};
export function kitOf(def) { return KITS[def.kit || 'supermarket'] || KITS.supermarket; }

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
varying vec3 vW; varying vec4 vSh;
${MRT_OUT}
vec4 tileAt(vec2 id) { return texture2D(uMap, (id + 0.5) / uMapSize); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
  vec2 g = vW.xz / uTile, id = floor(g), f = fract(g), e = abs(f - 0.5);
  vec4 t = tileAt(id);
  vec2 w = fwidth(g) * 1.2;
  float far = clamp(1.0 - max(w.x, w.y) * 5.0, 0.0, 1.0);
  // the checker: uChecker squares per plan tile, grout between them, a slight variation per square
  vec2 cg = g * uChecker, cid = floor(cg), cf = fract(cg), ce = abs(cf - 0.5); vec2 cw = fwidth(cg) * 1.2;
  vec3 c = mix(uA, uB, mod(cid.x + cid.y, 2.0));
  c *= 1.0 + (hash2(cid) - 0.5) * uVary;
  float grout = max(smoothstep(0.475 - cw.x, 0.475, ce.x), smoothstep(0.475 - cw.y, 0.475, ce.y)) * far;
  c = mix(c, uGrout, grout);
  // a faint bevel highlight on each square's upper-left edge (tiles, not paint)
  c = mix(c, c * 1.04, (1.0 - smoothstep(0.0, 0.06, cf.x)) * (1.0 - grout) * far * 0.6);
  float d = floor(t.g * 16.0 + 0.5);
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
    float pud = 1.0 - smoothstep(0.43, 0.43 + w.x, pd);
    c = mix(c, uWet, pud * 0.75);
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
  gl_FragColor = vec4(c, 0.0);
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
      uChecker: { value: F.checker }, uVary: { value: F.vary }, uLines: { value: F.lines ? 1 : 0 }, uLineC: { value: v3(F.lines || 0) }, uPoolGrid: { value: P.grid }, uPoolR: { value: P.r }, uPoolC: { value: new T.Vector3(...P.warm) }, uPoolK: { value: P.k },
    },
  });
}

// The floor's tile map (see FLOOR_FS): decals, belts, wet patches, lanes, and route chevrons on every third tile.
export function floorMap(world) {
  const { cols, rows } = world, data = new Uint8Array(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) {
    const k = world.plan[Math.floor(i / cols)][i % cols];
    data[i * 4 + 1] = (world.laneOf[i] >= 0 ? (world.lanes[world.laneOf[i]].closed ? 7 : 5) : world.belt[i] ? 7 + world.belt[i] : world.wet[i] ? 12 : k === '=' ? 13 : 0) * 16;
    const b = world.belt[i], to = b ? i + (b === 1 ? 1 : b === 3 ? -1 : b === 2 ? cols : -cols) : -1, line = world.plan[Math.floor(i / cols)];
    data[i * 4 + 2] = (b ? world.nav[to] > world.nav[i] : k === '=' && line[i % cols - 1] !== '=' && line[i % cols + 1] !== '=') ? 255 : 0;
    data[i * 4 + 3] = world.floor[i] ? 255 : 0;
  }
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
