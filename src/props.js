// DOORBUSTER — props.js
// Purpose: the look of the level objects (objects.js) in the full cel-and-ink style: swinging price-tag signs
//          on chains with their shadows sweeping the floor, pop-up promo tiles that flash red and spring up,
//          forklifts and pallet jacks with flashing lights, bell buttons whose floor cable lights up toward what
//          they open, roller shutters and doors, scrolling boost arrows, stopwatches, inflatable checkpoint
//          arches. Built once per level; posed every frame from the simulation's clock, so what the player sees
//          is exactly what the objects do.
// Exports: buildProps, syncProps, propEvent
// Depends on: config.js, objects.js, render.js, shapes.js, atlas.js, kits.js, fixtures.js and the global THREE.

import { CFG } from './config.js';
import { SIGN, signAngle, tilePop, patrolAt, armAngle, laserAngle } from './objects.js';
import { screenMaterial } from './kits.js';
import { screen } from './fixtures.js';
import { R, celMaterial, hullMaterial, blendMaterial, MRT_OUT, AUX_NONE } from './render.js';
import { builder, at, bind, box, cyl, ellipsoid, tube, ring, toGeometry } from './shapes.js';
import { KIT, kitAtlas } from './atlas.js';

const PT = CFG.TILE;
const PK = (cell, g = 0.1) => [3, cell, g, 0];          // a clamped kit-atlas cell (signs, plates)
const PKW = (cell, g = 0.1) => [4, cell, g, 0];         // a tiling kit-atlas cell (slats)
const PPL = (g = 0.2, e = 0) => [0, 0, g, e];           // plain; e = emissive
const P_GLOWV = [0, 0, 0.3, -1];                         // a lamp lit by its material's glow
const P_INK = 0x2A1A3A;

// ---- shaders for the flat parts: the lit cable, the boost arrows, the warning flash ------------------------
const PROP_VS = 'attribute float along; varying vec2 vUv; varying float vAlong; void main() { vUv = uv; vAlong = along; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const CABLE_FS = `uniform float uLit; uniform float uTime; uniform float uLen; varying vec2 vUv; varying float vAlong; ${MRT_OUT}
void main() {
  float lit = step(vAlong, uLit), pulse = smoothstep(0.0, 0.6, 1.0 - abs(fract(uTime * 0.45) * (uLen + 4.0) - vAlong) / 2.0);
  vec3 off = mix(vec3(0.16, 0.1, 0.23), vec3(1.0, 0.86, 0.3), pulse * 0.55);
  vec3 c = mix(off, vec3(1.0, 0.86, 0.25), lit);
  float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
  gl_FragColor = vec4(mix(vec3(0.16, 0.1, 0.23), c, edge), lit * 0.9 + pulse * 0.25);
  ${AUX_NONE} }`;
const ARROW_FS = `uniform float uTime; varying vec2 vUv; ${MRT_OUT}
void main() {
  float x = abs(vUv.x - 0.5) * 2.0, v = fract(vUv.y * 2.5 - uTime * 2.2 + x * 0.55);
  float chev = smoothstep(0.02, 0.08, v) * smoothstep(0.5, 0.42, v) * smoothstep(1.0, 0.86, x);
  vec3 c = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.86, 0.25), vUv.y);
  gl_FragColor = vec4(c * chev, chev * 0.95);
  ${AUX_NONE} }`;
const PROP_FLASH_FS = `varying vec2 vUv; varying vec3 vColor; ${MRT_OUT}
void main() { float d = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0; float a = smoothstep(1.0, 0.7, d) * (0.45 + 0.55 * smoothstep(0.55, 0.95, d));
  gl_FragColor = vec4(vColor * a, a * vColor.r); ${AUX_NONE} }`;
const PROP_FLASH_VS = 'varying vec2 vUv; varying vec3 vColor; void main() { vUv = uv; vColor = instanceColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }';

// ---- building -------------------------------------------------------------------------------------------
export function buildProps(view, sim, kit) {
  const world = sim.world, atlas = kitAtlas(kit), P = view.props = { signs: [], fields: [], patrols: [], buttons: [], gates: [], pads: [], watches: [], arches: [], bars: [], spins: [], lasers: [], t: 0 };
  const cel = celMaterial({ mapB: atlas, rim: 0.35 }), hull = hullMaterial(2.5);
  view.own.push(cel, hull);
  const mesh = (B, mats) => { const m = new THREE.Mesh(toGeometry(B, {}), mats || [cel, hull]); m.frustumCulled = false; m.layers.enable(1); return m; };
  const flat = (fs, uniforms, additive) => { const m = blendMaterial(new THREE.ShaderMaterial({ vertexShader: PROP_VS, fragmentShader: fs, uniforms, depthWrite: false }), additive, true); view.own.push(m); return m; };
  for (const ob of world.objs) {
    if (ob.kind === 'sign') {
      // the mount: a steel beam across the lane at the pivot, a bracket; the tag hangs from two chains
      const outer = new THREE.Group(), inner = new THREE.Group();
      outer.position.set(ob.x, SIGN.H, ob.z); outer.rotation.y = ob.ax ? 0 : -Math.PI / 2;
      const Bm = builder(); bind(Bm, 0, PPL(0.5));
      at(Bm, 0, 0.18, 0); box(Bm, ob.reach * 2 + 1.5, 0.22, 0.22, 0xC9CED8, { bevel: 0.15 });
      at(Bm, 0, -0.05, 0); box(Bm, 0.5, 0.3, 0.3, P_INK, { bevel: 0.2 });
      outer.add(mesh(Bm));
      // two chains from the pivot down to the tag's top corners, the tag, its red string knot
      const B = builder(), drop = SIGN.CHAIN, hw = ob.w / 2;
      bind(B, 0, PPL(0.6)); at(B, 0, 0, 0);
      for (const s of [1, -1]) tube(B, [[0, 0, 0], [s * (hw - 0.35), -drop, 0]], 0.035, 0x8E96A8, { seg: 5 });
      at(B, 0, -drop - SIGN.HT / 2, 0);
      bind(B, 0, PK(KIT.tag, 0.25)); box(B, ob.w, SIGN.HT, 0.12, 0xFFD23F, { bevel: 0.08, front: PK(KIT.tag, 0.25), back: PK(KIT.tag, 0.25), mid: true, uvs: [1, 0.5] });
      bind(B, 0, PPL(0.3)); at(B, -hw + 0.32, -drop - 0.12, 0.08); ellipsoid(B, 0.12, 0.12, 0.09, 0xE63946, { seg: 8, rings: 6 });
      inner.add(mesh(B)); outer.add(inner); view.root.add(outer);
      P.signs.push({ ob, outer, inner, last: 0, side: 0 });
    } else if (ob.kind === 'tiles') {
      const n = ob.nc * ob.nr, B = builder();
      bind(B, 0, PPL(0.3)); box(B, PT - 0.12, 0.2, PT - 0.12, 0xFFF6EA, { bevel: 0.1, lid: PK(KIT.poptile, 0.25), mid: false });
      const geo = toGeometry(B, {}), im = new THREE.InstancedMesh(geo, [cel, hull], n);
      im.frustumCulled = false; im.layers.enable(1); view.root.add(im);
      const fm = blendMaterial(new THREE.ShaderMaterial({ vertexShader: PROP_FLASH_VS, fragmentShader: PROP_FLASH_FS, depthWrite: false }), true, true);
      view.own.push(fm);
      const fl = new THREE.InstancedMesh(new THREE.PlaneGeometry(PT - 0.1, PT - 0.1).rotateX(-Math.PI / 2), fm, n);
      fl.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); fl.frustumCulled = false; fl.renderOrder = 2;
      view.root.add(fl);
      P.fields.push({ ob, im, fl, d: new THREE.Object3D() });
    } else if (ob.kind === 'panels') {
      // steel trapdoors over the pit, hinged on their west edge; each flashes before it drops open
      const n = ob.nc * ob.nr, B = builder();
      bind(B, 0, PPL(0.4)); at(B, 0, -0.12, 0); box(B, PT - 0.06, 0.12, PT - 0.06, 0x7E889C, { bevel: 0.05, lid: PK(KIT.panel, 0.35), mid: false });
      const im = new THREE.InstancedMesh(toGeometry(B, {}), [cel, hull], n);
      im.frustumCulled = false; im.layers.enable(1); view.root.add(im);
      const fm = blendMaterial(new THREE.ShaderMaterial({ vertexShader: PROP_FLASH_VS, fragmentShader: PROP_FLASH_FS, depthWrite: false }), true, true);
      view.own.push(fm);
      const fl = new THREE.InstancedMesh(new THREE.PlaneGeometry(PT - 0.1, PT - 0.1).rotateX(-Math.PI / 2), fm, n);
      fl.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); fl.frustumCulled = false; fl.renderOrder = 2;
      view.root.add(fl);
      P.fields.push({ ob, im, fl, d: new THREE.Object3D(), trap: true });
    } else if (ob.kind === 'barrier') {
      P.bars.push(barrierModel(view, ob, mesh, atlas, hull));
    } else if (ob.kind === 'turnstile') {
      P.spins.push(turnstileModel(view, ob, mesh, atlas));
    } else if (ob.kind === 'laser') {
      P.lasers.push(laserModel(view, ob, mesh, flat));
    } else if (ob.kind === 'patrol') {
      const g = new THREE.Group(), lamp = celMaterial({ mapB: atlas, rim: 0.35 });
      view.own.push(lamp);
      g.add(ob.type === 'jack' ? jackModel(mesh, lamp, hull) : ob.type === 'vacuum' ? vacModel(mesh, lamp, hull) : forkModel(mesh, lamp, hull));
      view.root.add(g);
      P.patrols.push({ ob, g, lamp, pos: { x: 0, z: 0, h: 0 }, beep: 0 });
    } else if (ob.kind === 'button' || ob.kind === 'plate') {
      const m = celMaterial({ mapB: atlas, rim: 0.2 }), B = builder();
      m.uniforms.uTint = { value: new THREE.Vector3(1, 1, 1) }; m.uniforms.uTintAmt = { value: 0 };      // its own, not the shared grade tint
      view.own.push(m);
      if (ob.kind === 'button') {
        bind(B, 0, PPL(0.4)); cyl(B, ob.rad + 0.08, ob.rad + 0.12, 0.06, P_INK, { seg: 24 });
        bind(B, 0, PPL(0.3)); at(B, 0, 0.06, 0); cyl(B, ob.rad, ob.rad, 0.06, 0xE63946, { seg: 24, top: 0xFFFFFF, lid: PK(KIT.bell, 0.3) });
      } else { bind(B, 0, PPL(0.1)); cyl(B, ob.rad, ob.rad, 0.03, kit.floor.b, { seg: 20 }); }
      const plate = new THREE.Mesh(toGeometry(B, { groups: false, hull: false }), m);
      plate.position.set(ob.x, 0, ob.z); view.root.add(plate);
      let cable = null;
      if (ob.cable && ob.kind === 'button') {
        const { geo, len } = ribbon(ob.cable, 0.16);
        const cm = flat(CABLE_FS, { uLit: { value: 0 }, uTime: R.u.uTime, uLen: { value: len } }, false);
        cable = new THREE.Mesh(geo, cm); cable.frustumCulled = false; cable.renderOrder = 1; view.root.add(cable);
        cable.len = len;
      }
      P.buttons.push({ ob, plate, m, cable, lit: 0 });
    } else if (ob.kind === 'gate') {
      const g = new THREE.Group(), w = (ob.wide ? ob.hx : ob.hz) * 2, h = 2.7;
      g.position.set(ob.x, 0, ob.z); g.rotation.y = ob.wide ? 0 : Math.PI / 2;
      const secret = ob.style === 'secret', door = ob.style === 'door';
      const Bf = builder(); bind(Bf, 0, PPL(0.5));
      for (const s of [1, -1]) { at(Bf, s * (w / 2 + 0.08), 0, 0); box(Bf, 0.16, h + 0.3, 0.3, secret ? kit.walls.face : 0x8E96A8, { bevel: 0.1 }); }
      at(Bf, 0, h + 0.05, 0, 0, 0, Math.PI / 2); cyl(Bf, 0.32, 0.32, w + 0.3, secret ? kit.walls.face : 0x6E7488, { seg: 12, mid: true });
      g.add(mesh(Bf));
      const Bp = builder();
      if (secret) { bind(Bp, 0, PPL(0.1)); box(Bp, w, h, 0.18, kit.walls.face, { bevel: 0, mid: false }); bind(Bp, 0, PK(KIT.poster2, 0.1)); at(Bp, 0, 0.7, 0.1); box(Bp, 1.2, 1.2, 0.02, 0xFFFFFF, { bevel: 0, front: PK(KIT.poster2, 0.1) }); }
      else { bind(Bp, 0, PKW(KIT.shutter, 0.45)); box(Bp, w, h, 0.1, door ? 0xE63946 : 0xC9CED8, { bevel: 0, front: PKW(KIT.shutter, 0.45), back: PKW(KIT.shutter, 0.45), uvs: [w / 2, h / 1.6] }); }
      const panel = mesh(Bp); g.add(panel); view.root.add(g);
      P.gates.push({ ob, g, panel, h });
    } else if (ob.kind === 'boost') {
      const m = flat(ARROW_FS, { uTime: R.u.uTime }, true);
      const geo = new THREE.PlaneGeometry(ob.hx * 2 - 0.2, ob.hz * 2 - 0.2).rotateX(-Math.PI / 2);
      geo.setAttribute('along', new THREE.Float32BufferAttribute(new Float32Array(4), 1));
      const q = new THREE.Mesh(geo, m); q.position.set(ob.x, 0.015, ob.z); q.rotation.y = ob.h + Math.PI; q.renderOrder = 1; q.frustumCulled = false;
      if (Math.abs(ob.dx) > 0.5) { q.geometry.dispose(); q.geometry = new THREE.PlaneGeometry(ob.hz * 2 - 0.2, ob.hx * 2 - 0.2).rotateX(-Math.PI / 2); q.geometry.setAttribute('along', new THREE.Float32BufferAttribute(new Float32Array(4), 1)); }
      view.root.add(q); P.pads.push({ ob, q });
    } else if (ob.kind === 'watch') {
      const B = builder();
      bind(B, 0, PPL(0.6)); at(B, 0, 0, 0, 0, Math.PI / 2); cyl(B, 0.5, 0.5, 0.16, 0xFFD23F, { seg: 20, mid: true, top: 0xFFD23F });
      bind(B, 0, PK(KIT.watch, 0.4)); at(B, 0, 0, 0.085); box(B, 0.78, 0.78, 0.01, 0xFFFFFF, { bevel: 0, mid: true, front: PK(KIT.watch, 0.4), back: PK(KIT.watch, 0.4) });
      bind(B, 0, PPL(0.6)); at(B, 0, 0.5, 0); cyl(B, 0.09, 0.09, 0.16, 0xE63946, { seg: 8 }); at(B, 0, 0.66, 0); cyl(B, 0.16, 0.16, 0.06, 0xE63946, { seg: 10 });
      const w = mesh(B); w.position.set(ob.x, 1.1, ob.z); view.root.add(w);
      P.watches.push({ ob, w });
    } else if (ob.kind === 'cp') {
      const g = new THREE.Group(), w = ob.w, B = builder(), cols = [0xFF5A4E, 0xFFD23F];
      g.position.set(ob.x, 0, ob.z); g.rotation.y = ob.ax ? 0 : Math.PI / 2;
      // two puffy columns of stacked balloons, a sagging arc of them over the top, a SALE banner in the middle
      bind(B, 0, PPL(0.7));
      for (const s of [1, -1]) for (let i = 0; i < 6; i++) { at(B, s * w, 0.3 + i * 0.58, 0); ellipsoid(B, 0.38, 0.34, 0.38, cols[i % 2], { seg: 10, rings: 7 }); }
      const n = 13;
      for (let i = 0; i <= n; i++) { const u = i / n, x = (u * 2 - 1) * w, y = 3.7 + Math.sin(u * Math.PI) * 0.9; at(B, x, y, 0); ellipsoid(B, 0.34, 0.32, 0.34, cols[i % 2], { seg: 10, rings: 7 }); }
      bind(B, 0, PK(KIT.arch, 0.2)); at(B, 0, 3.6, 0.36); box(B, 2.6, 1.3, 0.06, 0xFFFFFF, { bevel: 0, mid: true, front: PK(KIT.arch, 0.2), back: PK(KIT.arch, 0.2), uvs: [1, 0.5] });
      const arch = mesh(B); g.add(arch); view.root.add(g);
      P.arches.push({ ob, g, arch, pop: 0 });
    }
  }
  return P;
}

// A flat ribbon along a polyline, a little above the floor, with its distance along it in `along`.
function ribbon(pts, w) {
  const pos = [], uv = [], along = [], idx = [];
  let d = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    let tx = nx - px, tz = nz - pz; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    if (i > 0) d += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    pos.push(x - tz * w / 2, 0.014, z + tx * w / 2, x + tz * w / 2, 0.014, z - tx * w / 2);
    uv.push(d, 0, d, 1); along.push(d, d);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  geo.setIndex(idx);
  return { geo, len: d };
}

// A forklift: a yellow body with hazard stripes, an orange mast with forks carrying a pallet of cartons, a cage
// over the seat, a flashing amber light, a driver in a hard hat.
function forkModel(mesh, lamp, hull) {
  const B = builder();
  bind(B, 0, PK(KIT.fork, 0.3)); at(B, 0, 0.25, -0.15); box(B, 1.3, 0.85, 1.9, 0xFFC800, { bevel: 0.12, sides: PK(KIT.fork, 0.3), mid: false });
  bind(B, 0, PPL(0.2)); at(B, 0, 1.1, -0.75); box(B, 1.2, 0.45, 0.45, 0x3D3552, { bevel: 0.2 });
  for (const x of [-0.5, 0.5]) for (const z of [-0.9, 0.6]) { at(B, x, 0.32, z, 0, 0, Math.PI / 2); cyl(B, 0.32, 0.32, 0.28, P_INK, { seg: 12, mid: true, top: 0x6E7488 }); }
  bind(B, 0, PPL(0.5)); for (const x of [-0.55, 0.55]) for (const z of [-0.95, 0.35]) { at(B, x, 1.1, z); box(B, 0.08, 1.25, 0.08, P_INK, { bevel: 0, mid: false }); }
  at(B, 0, 2.35, -0.3); box(B, 1.2, 0.08, 1.4, P_INK, { bevel: 0 });
  // the mast and forks at the front (+z)
  bind(B, 0, PPL(0.4)); for (const x of [-0.45, 0.45]) { at(B, x, 0.1, 0.85); box(B, 0.12, 2.6, 0.12, 0xFF7F11, { bevel: 0.1, mid: false }); at(B, x * 0.8, 0.28, 1.45); box(B, 0.14, 0.06, 1.2, 0xA9B0BE, { bevel: 0 }); }
  // the pallet and its cartons
  bind(B, 0, PPL(0.1)); at(B, 0, 0.34, 1.45); box(B, 1.2, 0.14, 1.1, 0xC98A5B, { bevel: 0.05 });
  for (const [x, y, z, s] of [[-0.28, 0.48, 1.25, 0.5], [0.28, 0.48, 1.25, 0.5], [-0.28, 0.48, 1.7, 0.5], [0.28, 0.48, 1.7, 0.5], [0, 0.98, 1.45, 0.55]]) { at(B, x, y, z); box(B, s, s, s, 0xD9B98A, { bevel: 0.04, mid: false }); }
  // the driver: a hard hat over a round head, an orange vest
  bind(B, 0, PPL(0.3)); at(B, 0, 1.35, -0.55); ellipsoid(B, 0.32, 0.34, 0.26, 0xFF7F11, { seg: 10, rings: 7 });
  at(B, 0, 1.85, -0.55); ellipsoid(B, 0.2, 0.22, 0.2, 0xE8B38E, { seg: 10, rings: 8 });
  at(B, 0, 1.98, -0.55); ellipsoid(B, 0.24, 0.16, 0.24, 0xFFD23F, { seg: 10, rings: 6, cut: 0.5 });
  const body = mesh(B);
  const L = builder(); bind(L, 0, P_GLOWV); at(L, 0.45, 2.45, -0.75); ellipsoid(L, 0.13, 0.13, 0.13, 0xFF9F1C, { seg: 8, rings: 6 });
  const light = new THREE.Mesh(toGeometry(L, {}), [lamp, hull]); light.frustumCulled = false;
  const g = new THREE.Group(); g.add(body, light); return g;
}
// ---- level 3 objects -----------------------------------------------------------------------------------------
// The floor strip of a smart barrier: stripes and a rim in its colour, bright while it stands, dim while it lies.
const STRIP_VS = 'attribute float along; varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const STRIP_FS = `uniform vec3 uC; uniform float uA; varying vec2 vUv; ${MRT_OUT}
void main() { vec2 e = abs(vUv - 0.5) * 2.0; float rim = step(0.84, max(e.x, e.y)), st = step(0.5, fract((vUv.x - vUv.y) * 5.0));
  float a = max(rim, st * 0.5) * uA; gl_FragColor = vec4(uC * a, a * 0.7); ${AUX_NONE} }`;
// The barrier's wall of light: its colour, a hex lattice, bright rails top and bottom, a scan running up it.
const WALL_FS = `uniform vec3 uC; uniform float uA; uniform float uS; uniform float uTime; varying vec2 vUv; varying float vAlong; ${MRT_OUT}
float hx(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.866)), p.x); }
void main() {
  vec2 p = vUv * vec2(uS, 1.6) * 2.6, r = vec2(1.0, 1.732), h = r * 0.5, a = mod(p, r) - h, b = mod(p - h, r) - h, g = dot(a, a) < dot(b, b) ? a : b;
  float line = smoothstep(0.4, 0.46, hx(g)), edge = max(smoothstep(0.9, 0.98, vUv.y), smoothstep(0.08, 0.0, vUv.y)), scan = smoothstep(0.85, 1.0, sin(vUv.y * 9.0 - uTime * 5.0));
  vec3 col = uC * (0.75 + 0.5 * line + 0.3 * scan) + edge * 0.5;
  gl_FragColor = vec4(col, (0.62 + 0.25 * line + 0.3 * edge) * uA); ${AUX_NONE} }`;
// A smart barrier: two dark posts with lamps in its colour, a wall of glowing hex light between them that rises out
// of the floor while its colour is up, and the strip on the floor that always shows where it stands.
function barrierModel(view, ob, mesh, atlas, hull) {
  const red = ob.color === 'red', hex = red ? 0xE8261A : 0x1F62D8, col = red ? [1.0, 0.13, 0.06] : [0.12, 0.42, 1.0];
  const g = new THREE.Group(), span = (ob.wide ? ob.hx : ob.hz) * 2, mat = celMaterial({ mapB: atlas, rim: 0.3 });
  view.own.push(mat);
  g.position.set(ob.x, 0, ob.z); g.rotation.y = ob.wide ? 0 : Math.PI / 2;
  const Bp = builder(); bind(Bp, 0, PPL(0.4));
  for (const s of [1, -1]) { at(Bp, s * (span / 2 + 0.08), 0, 0); cyl(Bp, 0.13, 0.16, 1.95, 0x2B2F3A, { seg: 10, top: 0x2B2F3A }); }
  bind(Bp, 0, [0, 0, 0.3, -1]);
  for (const s of [1, -1]) for (const y of [0.5, 1.95]) { at(Bp, s * (span / 2 + 0.08), y, 0); cyl(Bp, 0.17, 0.17, 0.12, hex, { seg: 10 }); }
  g.add(mesh(Bp, [mat, hull]));
  const B = builder();
  bind(B, 0, PPL(0.5)); at(B, 0, 1.6, 0); box(B, span + 0.04, 0.09, 0.22, 0x2B2F3A, { bevel: 0.1 });
  bind(B, 0, [0, 0, 0.3, -1]); at(B, 0, 1.69, 0); box(B, span - 0.1, 0.04, 0.1, hex, { bevel: 0 });
  const panel = mesh(B, [mat, hull]); g.add(panel);
  const wm = blendMaterial(new THREE.ShaderMaterial({ vertexShader: STRIP_VS, fragmentShader: WALL_FS, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Vector3(...col) }, uA: { value: 1 }, uS: { value: span }, uTime: R.u.uTime }, depthWrite: false }), false, true);
  view.own.push(wm);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.6).translate(0, 0.8, 0), wm); wall.frustumCulled = false; wall.renderOrder = 2; panel.add(wall);
  const sm = blendMaterial(new THREE.ShaderMaterial({ vertexShader: STRIP_VS, fragmentShader: STRIP_FS, uniforms: { uC: { value: new THREE.Vector3(...col) }, uA: { value: 0.9 } }, depthWrite: false }), true, true);
  view.own.push(sm);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry((ob.c1 - ob.c0 + 1) * PT - 0.12, (ob.r1 - ob.r0 + 1) * PT - 0.12).rotateX(-Math.PI / 2), sm);
  strip.position.set(ob.x, 0.018, ob.z); strip.renderOrder = 1; strip.frustumCulled = false;
  view.root.add(g, strip);
  return { ob, g, panel, mat, col, strip: sm, up: ob.solid.on ? 1 : 0 };
}
const RING_FS = `uniform float uTime; varying vec2 vUv; ${MRT_OUT}
void main() { float d = step(0.5, fract(atan(vUv.y - 0.5, vUv.x - 0.5) * 7.0 / 3.14159 + uTime * 0.4)); float a = 0.35 + 0.35 * d; gl_FragColor = vec4(vec3(1.0, 0.31, 0.85) * a, a * 0.5); ${AUX_NONE} }`;
// A turnstile display: a column in the store's colours turning three chrome arms, a TV at the end of each (on its
// own channel, both faces) and a tray of phones half way out; it never stops.
function turnstileModel(view, ob, mesh, atlas) {
  const g = new THREE.Group(), B = builder(), S = builder(), R2 = ob.R;
  g.position.set(ob.x, 0, ob.z);
  bind(B, 0, PPL(0.4)); cyl(B, 0.78, 0.84, 0.2, 0x2B2F3A, { seg: 20, top: 0x3D4466 });
  bind(B, 0, PPL(0.5)); at(B, 0, 0.2, 0); cyl(B, 0.42, 0.42, 1.95, 0x262B52, { seg: 16, top: 0xFF4FD8 });
  bind(B, 0, PKW(KIT.s0 + 2, 0.3)); at(B, 0, 1.25, 0); cyl(B, 0.445, 0.445, 0.55, 0xFFFFFF, { seg: 16, top: false, side: PKW(KIT.s0 + 2, 0.3), uRep: 3 });
  bind(B, 0, PPL(0.3, 0.85)); at(B, 0, 2.15, 0); cyl(B, 0.47, 0.47, 0.06, 0x00E5FF, { seg: 16 });
  for (let i = 0; i < ob.arms; i++) {
    const a = i * 2 * Math.PI / ob.arms, sx = Math.sin(a), sz = Math.cos(a), mid = 0.4 + (R2 - 0.4) / 2;
    bind(B, 0, PPL(0.85)); at(B, sx * mid, 1.0, sz * mid, a); box(B, 0.12, 0.12, R2 - 0.4, 0xDDE3EA, { bevel: 0.3, mid: true });
    at(B, sx * mid, 0.42, sz * mid, a); box(B, 0.08, 0.08, R2 - 0.4, 0xC9CED8, { bevel: 0.3, mid: true });
    const tx = sx * (R2 - 0.3), tz = sz * (R2 - 0.3), face = a + Math.PI / 2;
    bind(B, 0, PPL(0.4)); at(B, tx, 1.2, tz, face); box(B, 1.3, 0.8, 0.1, 0x0D0F22, { bevel: 0.1, mid: true });
    at(B, tx, 0.42, tz); cyl(B, 0.05, 0.05, 0.4, 0x2B2F3A, { seg: 6 });
    screen(S, tx + Math.sin(face) * 0.056, 1.2, tz + Math.cos(face) * 0.056, face, 1.18, 0.68, (i * 0.31 + ob.x * 0.07) % 1);
    screen(S, tx - Math.sin(face) * 0.056, 1.2, tz - Math.cos(face) * 0.056, face + Math.PI, 1.18, 0.68, (i * 0.53 + ob.z * 0.05) % 1);
    bind(B, 0, PPL(0.3)); at(B, sx * 1.25, 1.06, sz * 1.25, a); box(B, 0.56, 0.06, 0.5, 0xFF4FD8, { bevel: 0.2 });
    for (let k = 0; k < 3; k++) { bind(B, 0, PPL(0.7)); const o = (k - 1) * 0.16; at(B, sx * 1.25 + Math.cos(a) * o, 1.12, sz * 1.25 - Math.sin(a) * o, a, -0.25); box(B, 0.12, 0.2, 0.03, [0x1B1F3B, 0xFFFFFF, 0x00E5FF][k], { bevel: 0.2 }); }
  }
  g.add(mesh(B));
  const sm = screenMaterial(atlas); view.own.push(sm);
  const sc = new THREE.Mesh(toGeometry(S, { groups: false, hull: false }), sm); sc.frustumCulled = false; g.add(sc);
  // its reach painted on the floor: a dashed magenta circle
  const rm = blendMaterial(new THREE.ShaderMaterial({ vertexShader: STRIP_VS, fragmentShader: RING_FS, uniforms: { uTime: R.u.uTime }, depthWrite: false }), true, true);
  view.own.push(rm);
  const rg = new THREE.RingGeometry(R2 + 0.05, R2 + 0.3, 64, 1).rotateX(-Math.PI / 2); rg.setAttribute('along', new THREE.Float32BufferAttribute(new Float32Array(rg.attributes.position.count), 1));
  const ringMesh = new THREE.Mesh(rg, rm); ringMesh.position.set(ob.x, 0.02, ob.z); ringMesh.renderOrder = 1; ringMesh.frustumCulled = false;
  view.root.add(g, ringMesh);
  return { ob, g };
}
// The laser beam and its trail: a hot red bar, the line it throws on the floor, a wedge of afterglow fading behind it.
const BEAM_FS = `uniform float uTime; varying vec2 vUv; varying float vAlong; ${MRT_OUT}
void main() { float f = 0.85 + 0.15 * sin(uTime * 47.0); gl_FragColor = vec4(vec3(1.0, 0.22, 0.32) * 1.7 * f, 1.0); ${AUX_NONE} }`;
const TRAIL_FS = `varying vec2 vUv; varying float vAlong; ${MRT_OUT}
void main() { float a = (1.0 - vAlong) * (1.0 - vAlong) * 0.55; gl_FragColor = vec4(vec3(1.0, 0.2, 0.35) * a, a * 0.6); ${AUX_NONE} }`;
// The laser turret: a pedestal banded in magenta, a head turning with its beam (it sweeps once every few seconds).
function laserModel(view, ob, mesh, flat) {
  const B = builder();
  bind(B, 0, PPL(0.4)); at(B, ob.x, 0, ob.z); cyl(B, 0.64, 0.72, 0.25, 0x2B2F3A, { seg: 18, top: 0x3D4466 });
  at(B, ob.x, 0.25, ob.z); cyl(B, 0.42, 0.52, 0.32, 0x262B52, { seg: 16, top: 0x1B1F3B });
  bind(B, 0, PPL(0.5, 0.8)); at(B, ob.x, 0.4, ob.z); cyl(B, 0.53, 0.53, 0.06, 0xFF4FD8, { seg: 16 });
  view.root.add(mesh(B));
  const H = builder();
  bind(H, 0, PPL(0.7)); at(H, 0, 0.66, 0); ellipsoid(H, 0.36, 0.26, 0.36, 0xDDE3EA, { seg: 14, rings: 8 });
  bind(H, 0, PPL(0.4)); at(H, 0, 0.62, 0.3, 0, Math.PI / 2); cyl(H, 0.1, 0.12, 0.3, 0x2B2F3A, { seg: 10, mid: true });
  bind(H, 0, PPL(0.3, 1)); at(H, 0, 0.62, 0.46, 0, Math.PI / 2); cyl(H, 0.08, 0.08, 0.04, 0xFF3B4E, { seg: 10, mid: true });
  const head = mesh(H); head.position.set(ob.x, 0, ob.z); view.root.add(head);
  const withAlong = (geo, fn) => { const n = geo.attributes.position.count, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = fn ? fn(i, geo.attributes.position) : 0; geo.setAttribute('along', new THREE.Float32BufferAttribute(a, 1)); return geo; };
  const beam = new THREE.Mesh(withAlong(new THREE.BoxGeometry(0.1, 0.1, ob.L - 0.5).translate(0, 0.62, (ob.L - 0.5) / 2 + 0.5)), flat(BEAM_FS, { uTime: R.u.uTime }, true));
  const line = new THREE.Mesh(withAlong(new THREE.PlaneGeometry(0.34, ob.L - 0.6).rotateX(-Math.PI / 2).translate(0, 0.022, (ob.L - 0.6) / 2 + 0.6)), beam.material);
  beam.add(line);
  // the afterglow: a fan from the beam back 50 degrees (it has just swept there)
  const n = 16, pos = [0, 0.02, 0], idx = [], al = [0];
  for (let i = 0; i <= n; i++) { const f = i / n, a = -f * 0.9; pos.push(Math.sin(a) * ob.L, 0.02, Math.cos(a) * ob.L); al.push(f); if (i > 0) idx.push(0, i, i + 1); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(al.length * 2), 2)); fg.setAttribute('along', new THREE.Float32BufferAttribute(al, 1)); fg.setIndex(idx);
  const trail = new THREE.Mesh(fg, flat(TRAIL_FS, {}, true)); trail.material.side = THREE.DoubleSide;
  for (const m of [beam, trail]) { m.position.set(ob.x, 0, ob.z); m.frustumCulled = false; m.renderOrder = 3; view.root.add(m); }
  line.renderOrder = 2; line.frustumCulled = false;
  return { ob, head, beam, trail };
}
// A robot vacuum: a white disc under a navy lid, a cyan light ring, a bumper, two LED eyes, a yellow side brush.
function vacModel(mesh, lamp, hull) {
  const B = builder();
  bind(B, 0, PPL(0.5)); cyl(B, 0.52, 0.55, 0.15, 0xF4F7FB, { seg: 22, top: 0x2A2F5A });
  bind(B, 0, PPL(0.2)); at(B, 0, 0.01, 0); cyl(B, 0.57, 0.57, 0.07, 0x2B2F3A, { seg: 22, top: false });
  bind(B, 0, PPL(0.6)); at(B, 0, 0.15, -0.08); cyl(B, 0.16, 0.18, 0.06, 0xDDE3EA, { seg: 12 });
  bind(B, 0, PPL(0.3, 1)); for (const s of [-1, 1]) { at(B, s * 0.15, 0.09, 0.51); ellipsoid(B, 0.05, 0.06, 0.03, 0xFFFFFF, { seg: 8, rings: 6 }); }
  bind(B, 0, PPL(0.2)); for (let i = 0; i < 3; i++) { const a = i * 2.1; at(B, 0.38 + Math.sin(a) * 0.12, 0.01, 0.34 + Math.cos(a) * 0.12, a); box(B, 0.04, 0.012, 0.24, 0xFFD23F, { bevel: 0 }); }
  const body = mesh(B);
  const L = builder(); bind(L, 0, P_GLOWV); at(L, 0, 0.16, 0, 0, Math.PI / 2); ring(L, 0.42, 0.42, 0.035, 0.03, 0x00E5FF, { seg: 22 });
  const light = new THREE.Mesh(toGeometry(L, {}), [lamp, hull]); light.frustumCulled = false;
  const g = new THREE.Group(); g.add(body, light); return g;
}

// A pallet jack: a low yellow frame with forks under a pallet of shrink-wrapped cans, a handle, a flashing light.
function jackModel(mesh, lamp, hull) {
  const B = builder();
  bind(B, 0, PK(KIT.fork, 0.3)); at(B, 0, 0.1, -0.85); box(B, 0.9, 0.55, 0.4, 0xFFC800, { bevel: 0.15, sides: PK(KIT.fork, 0.3), mid: false });
  bind(B, 0, PPL(0.4)); at(B, 0, 0.6, -0.95, 0.35); box(B, 0.08, 0.9, 0.08, P_INK, { bevel: 0, mid: false }); at(B, 0, 1.45, -1.25); box(B, 0.5, 0.08, 0.08, P_INK, { bevel: 0 });
  for (const x of [-0.3, 0.3]) { at(B, x, 0.06, 0.15); box(B, 0.16, 0.08, 1.6, 0xA9B0BE, { bevel: 0 }); }
  bind(B, 0, PPL(0.1)); at(B, 0, 0.14, 0.15); box(B, 1.1, 0.14, 1.3, 0xC98A5B, { bevel: 0.05 });
  bind(B, 0, PPL(0.6)); for (let i = 0; i < 9; i++) { at(B, -0.36 + (i % 3) * 0.36, 0.28, -0.25 + Math.floor(i / 3) * 0.4); cyl(B, 0.16, 0.16, 0.42, [0xE63946, 0x3A86FF, 0xFFD23F][i % 3], { seg: 10 }); }
  const body = mesh(B);
  const L = builder(); bind(L, 0, P_GLOWV); at(L, 0, 0.75, -0.85); ellipsoid(L, 0.11, 0.11, 0.11, 0xFF9F1C, { seg: 8, rings: 6 });
  const light = new THREE.Mesh(toGeometry(L, {}), [lamp, hull]); light.frustumCulled = false;
  const g = new THREE.Group(); g.add(body, light); return g;
}

// ---- every frame ----------------------------------------------------------------------------------------------
// draw.shadow(x, z, rx, rz, ry) writes a contact shadow; listener: where sounds are heard from (the player).
export function syncProps(view, sim, dt, draw) {
  const P = view.props, t = sim.t;
  if (!P) return;
  P.t += dt;
  for (const s of P.signs) {
    const th = signAngle(s.ob, t), ob = s.ob;
    s.inner.rotation.z = th;
    // its shadow: straight below the tag, darker and tighter the lower it hangs
    const lat = SIGN.R * Math.sin(th), low = 1 - (SIGN.H - (SIGN.CHAIN + SIGN.HT) * Math.cos(th)) / 6;
    draw.shadow(ob.x + ob.ax * lat, ob.z + ob.az * lat, ob.w / 2 * (0.8 + low * 0.2), 0.28 + low * 0.1, ob.ax ? 0 : Math.PI / 2);
    // a creak at each end of the swing (the sound layer listens for it)
    const w = Math.cos(2 * Math.PI * (t / ob.period + ob.phase)), side = Math.sign(w);
    if (side !== s.side && s.side !== 0) s.creak = true;
    s.side = side;
  }
  for (const f of P.fields) {
    const ob = f.ob, n = ob.nc * ob.nr, d = f.d, col = f.fl.instanceColor.array;
    for (let i = 0; i < n; i++) {
      const u = ((t - ob.ph[i]) % ob.period + ob.period) % ob.period, st = tilePop(ob, i, t);
      const x = (ob.c0 + i % ob.nc + 0.5) * PT, z = (ob.r0 + Math.floor(i / ob.nc) + 0.5) * PT;
      const up = st === 2 ? Math.sin(Math.min(1, u / ob.up) * Math.PI) : 0;
      if (f.trap) {              // a trapdoor: swings down on its west hinge while open, back up before it closes
        const k = st === 2 ? Math.min(1, u / 0.18, (ob.up - u) / 0.25) : 0, th = Math.max(0, k) * 1.75;
        d.position.set(x - PT / 2 + Math.cos(th) * PT / 2, -Math.sin(th) * PT / 2, z); d.rotation.set(0, 0, -th); d.scale.set(1, 1, 1); d.updateMatrix();
      } else { d.position.set(x, -0.18, z); d.scale.set(1 - up * 0.08, 1 + up * 4.4, 1 - up * 0.08); d.rotation.set(0, 0, 0); d.updateMatrix(); }
      f.im.setMatrixAt(i, d.matrix);
      d.position.set(x, 0.035 + (f.trap ? 0 : up * 0.88), z); d.scale.set(1, 1, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); f.fl.setMatrixAt(i, d.matrix);
      // the warning: the tile flashes red in the 0.6 s before it pops, faster and faster
      const warn = st === 1 ? (u - (ob.period - ob.lead)) / ob.lead : 0, blink = warn > 0 ? (Math.sin(warn * warn * 40) > -0.2 ? 0.6 + warn * 0.4 : 0.15) : st === 2 ? 0.5 : 0;
      col[i * 3] = blink; col[i * 3 + 1] = blink * 0.15; col[i * 3 + 2] = blink * 0.12;
    }
    const open = tilePop(ob, 0, t) === 2;
    if (open && !f.open) f.clank = true;
    f.open = open;
    f.im.instanceMatrix.needsUpdate = true; f.fl.instanceMatrix.needsUpdate = true; f.fl.instanceColor.needsUpdate = true;
  }
  for (const p of P.patrols) {
    patrolAt(p.ob, t, p.pos);
    p.g.position.set(p.pos.x, 0, p.pos.z); p.g.rotation.y = p.pos.h + (p.ob.spinT > t ? (p.ob.spinT - t) * 14 : 0);   // a dashed vacuum spins
    const on = p.ob.loop ? 0.75 + 0.25 * Math.sin(P.t * 4) : Math.sin(P.t * 9) > 0 ? 1 : 0.15;
    if (p.ob.loop) p.lamp.uniforms.uGlow.value.set(0, 0.9 * on, 1.0 * on); else p.lamp.uniforms.uGlow.value.set(1.4 * on, 0.7 * on, 0.1 * on);
    draw.shadow(p.pos.x, p.pos.z, p.ob.hx + 0.25, p.ob.hz + 0.35, p.pos.h);
  }
  // smart barriers: the solid colour stands tall and glows; the other lies in the floor and throbs while the player's
  // dash is ready (that is what a dash would raise)
  const ready = sim.player && sim.player.dashCd <= 0 && !sim.player.done;
  for (const b of P.bars) {
    const want = b.ob.solid.on ? 1 : 0;
    b.up += Math.sign(want - b.up) * Math.min(Math.abs(want - b.up), dt / 0.16);
    const e = b.up * b.up * (3 - 2 * b.up);
    b.panel.position.y = -1.62 * (1 - e); b.panel.visible = e > 0.01;
    const pulse = !want && ready ? 0.35 + 0.35 * Math.sin(P.t * 9) : 0, glow = want ? 1 : pulse;
    const gl = 0.12 + glow * 0.5;
    b.mat.uniforms.uGlow.value.set(b.col[0] * gl, b.col[1] * gl, b.col[2] * gl);
    b.strip.uniforms.uA.value = want ? 0.9 : 0.25 + pulse;
  }
  for (const s of P.spins) {
    s.g.rotation.y = armAngle(s.ob, t, 0);
    for (let i = 0; i < s.ob.arms; i++) { const a = armAngle(s.ob, t, i); draw.shadow(s.ob.x + Math.sin(a) * s.ob.R * 0.55, s.ob.z + Math.cos(a) * s.ob.R * 0.55, 0.32, s.ob.R * 0.5, a); }
  }
  for (const l of P.lasers) {
    const a = laserAngle(l.ob, t), p = sim.player, pa = Math.atan2(p.x - l.ob.x, p.z - l.ob.z), side = Math.sin(a - pa);
    if (Math.hypot(p.x - l.ob.x, p.z - l.ob.z) < l.ob.L + 3 && l.side !== undefined && Math.sign(side) !== Math.sign(l.side) && Math.cos(a - pa) > 0) l.zip = true;
    l.side = side;
    l.head.rotation.y = a; l.beam.rotation.y = a;
    l.trail.rotation.y = a;
  }
  for (const b of P.buttons) {
    const ob = b.ob, since = ob.pressed ? t - ob.pressT : -1;
    b.plate.position.y = ob.pressed ? -0.04 * Math.min(1, since * 8) : 0;
    b.m.uniforms.uTint.value.set(0.5, 1.6, 0.6); b.m.uniforms.uTintAmt.value = ob.pressed ? Math.min(1, since * 4) * 0.7 : 0;
    if (b.cable) { b.lit = ob.pressed ? Math.min(b.cable.len, since * 22) : 0; b.cable.material.uniforms.uLit.value = b.lit; }
  }
  for (const g of P.gates) {
    const o = g.ob.open, e = o * o * (3 - 2 * o);
    if (g.ob.style === 'secret') { g.panel.position.y = -e * g.h; g.panel.visible = e < 0.98; }
    else { g.panel.scale.y = Math.max(0.04, 1 - e); g.panel.position.y = g.h * (1 - g.panel.scale.y); }
  }
  for (const w of P.watches) {
    w.w.visible = !w.ob.taken;
    if (!w.ob.taken) { w.w.rotation.y = P.t * 2.2; w.w.position.y = 1.1 + Math.sin(P.t * 3 + w.ob.x) * 0.15; draw.glow(w.ob.x, w.ob.z, 0.7 + 0.08 * Math.sin(P.t * 5), 0xFFD23F); }
  }
  for (const a of P.arches) {
    a.pop = Math.max(0, a.pop - dt * 2.5);
    const wob = Math.sin(P.t * 2.3 + a.ob.x) * 0.025;
    a.arch.scale.set(1 + a.pop * 0.12, 1 + wob - a.pop * 0.15, 1 + a.pop * 0.12);
    a.arch.rotation.z = Math.sin(P.t * 1.7 + a.ob.z) * 0.015;
  }
}

// Reactions to the objects' events: an arch jumps when the player passes it.
export function propEvent(view, e) {
  const P = view.props;
  if (!P) return;
  if (e.type === 'checkpoint' && e.cart && e.cart.player) for (const a of P.arches) if (a.ob === e.ref) a.pop = 1;
}
