// DOORBUSTER — props.js
// Purpose: the look of the level objects (objects.js) in the full cel-and-ink style: swinging price-tag signs
//          on chains with their shadows sweeping the floor, pop-up promo tiles that flash red and spring up,
//          forklifts and pallet jacks with flashing lights, bell buttons whose floor cable lights up toward what
//          they open, roller shutters and doors, scrolling boost arrows, stopwatches, inflatable checkpoint
//          arches. Built once per level; posed every frame from the simulation's clock, so what the player sees
//          is exactly what the objects do.
// Exports: buildProps, syncProps, propEvent
// Depends on: config.js, objects.js, render.js, shapes.js, atlas.js and the global THREE.

import { CFG } from './config.js';
import { SIGN, signAngle, tilePop, patrolAt } from './objects.js';
import { R, celMaterial, hullMaterial, blendMaterial, MRT_OUT, AUX_NONE } from './render.js';
import { builder, at, bind, box, cyl, ellipsoid, tube, toGeometry } from './shapes.js';
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
  const world = sim.world, atlas = kitAtlas(kit), P = view.props = { signs: [], fields: [], patrols: [], buttons: [], gates: [], pads: [], watches: [], arches: [], t: 0 };
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
    } else if (ob.kind === 'patrol') {
      const g = new THREE.Group(), lamp = celMaterial({ mapB: atlas, rim: 0.35 });
      view.own.push(lamp);
      g.add(ob.type === 'jack' ? jackModel(mesh, lamp, hull) : forkModel(mesh, lamp, hull));
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
      d.position.set(x, -0.18, z); d.scale.set(1 - up * 0.08, 1 + up * 4.4, 1 - up * 0.08); d.rotation.set(0, 0, 0); d.updateMatrix();
      f.im.setMatrixAt(i, d.matrix);
      d.position.set(x, 0.035 + up * 0.88, z); d.scale.set(1, 1, 1); d.updateMatrix(); f.fl.setMatrixAt(i, d.matrix);
      // the warning: the tile flashes red in the 0.6 s before it pops, faster and faster
      const warn = st === 1 ? (u - (ob.period - ob.lead)) / ob.lead : 0, blink = warn > 0 ? (Math.sin(warn * warn * 40) > -0.2 ? 0.6 + warn * 0.4 : 0.15) : st === 2 ? 0.5 : 0;
      col[i * 3] = blink; col[i * 3 + 1] = blink * 0.15; col[i * 3 + 2] = blink * 0.12;
    }
    f.im.instanceMatrix.needsUpdate = true; f.fl.instanceMatrix.needsUpdate = true; f.fl.instanceColor.needsUpdate = true;
  }
  for (const p of P.patrols) {
    patrolAt(p.ob, t, p.pos);
    p.g.position.set(p.pos.x, 0, p.pos.z); p.g.rotation.y = p.pos.h;
    const on = Math.sin(P.t * 9) > 0 ? 1 : 0.15;
    p.lamp.uniforms.uGlow.value.set(1.4 * on, 0.7 * on, 0.1 * on);
    draw.shadow(p.pos.x, p.pos.z, p.ob.hx + 0.25, p.ob.hz + 0.35, p.pos.h);
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
