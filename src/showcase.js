// DOORBUSTER — showcase.js
// Purpose: the showcase scenes reached only through URL parameters (QUALITY.md section 3), with a
//          close-up or orbit camera: ?scene=lineup (the cast; &view=crowd the crowd row; &flat=1 flat ink
//          silhouettes), ?scene=faces (the expression sheet; &small=1 at gameplay size), ?scene=cart
//          (upgrade tiers and cosmetics) and ?scene=kit&store=<store> (a store kit; &view=wide|start|shelf|hazard).
// Exports: initShowcase, makeTitle
// Depends on: render.js, rig.js, crowd.js, cast.js, kits.js, atlas.js and the global THREE.

import { R, setGrade, updateCamera, celMaterial, blendMaterial, MRT_OUT } from './render.js';
import { makeCharacter, makeRacer, poseCart, animate, setFace, poseRig } from './rig.js';
import { PAINTS, HATS, cartSpecFor } from './cartart.js';
import { makeCrowd, syncCrowd, crowdPose, disposeCrowd } from './crowd.js';
import { CAST, CAST_ORDER, CROWD_ORDER, CROWD_COLORS } from './cast.js';
import { KITS, floorMaterial, kitOf } from './kits.js';
import { createSim } from './sim.js';
import { buildScene, syncScene } from './scene.js';
import { fixtureDemo } from './fixtures.js';
import { builder, toGeometry, at, bind, box, cyl, ellipsoid, tube } from './shapes.js';
import { EXPR, KIT, kitAtlas } from './atlas.js';

// A plain stage: the store floor under a big lamp.
function stage(kit, flat) {
  const T = THREE, n = 48, data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) data[i * 4 + 3] = 255;
  const map = new T.DataTexture(data, n, n, T.RGBAFormat); map.magFilter = map.minFilter = T.NearestFilter; map.needsUpdate = true;
  const mat = floorMaterial(kit); mat.uniforms.uMap.value = map; mat.uniforms.uMapSize.value.set(n, n);
  const floor = new T.Mesh(new T.PlaneGeometry(96, 96), mat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0);
  R.scene.add(floor);
  R.renderer.setClearColor(flat ? 0xFFFDF6 : 0x3B2C5E, 0);
  R.u.uFlat.value = flat ? 1 : 0;
  setGrade(kit.grade);
  return floor;
}

export function initShowcase(kind, q) {
  const kit = KITS[q.get('store')] || KITS.supermarket, flat = q.has('flat'), view = q.get('view') || '';
  const show = { kind, t: 0, chars: [], carts: [], crowd: null, people: [], cam: null };
  if (kind === 'kit') return kitShow(kit, view, q);
  const floor = stage(kit, flat);
  if (kind === 'faces') floor.visible = false;
  const cam = R.camera;
  if (kind === 'lineup') {
    const named = !view || flat, crowdRow = view === 'crowd' || flat;
    if (named) CAST_ORDER.forEach((id, i) => {
      const c = makeCharacter(id);
      c.mesh.position.set(flat ? -9.2 + i * 1.02 : (i - 3) * 1.25, 0, 0);
      c.mesh.rotation.y = -(i - 3) * 0.07;
      c.mesh.layers.enable(1);
      R.scene.add(c.mesh); show.chars.push(c);
    });
    if (crowdRow) {
      show.crowd = makeCrowd(CROWD_ORDER);
      R.scene.add(show.crowd.root);
      CROWD_ORDER.forEach((kind2, i) => show.people.push({ kind: kind2, x: flat ? -1.9 + i * 0.95 : (i - 6) * 1.05, z: 0, h: kind2 === 'scooterElder' || kind2 === 'strollerMom' || kind2 === 'walkerGranny' ? 0.6 : 0, state: 0, t: 0, phase: 0, speed: 0,
        style: [2, 2, 1, 3, 3, 0, 1, 0, 0, 1, 3, 0, 2][i], cloth: CROWD_COLORS.cloth[(i * 3) % CROWD_COLORS.cloth.length], pants: CROWD_COLORS.pants[i % 5], hair: CROWD_COLORS.hair[i % 6], seed: i * 1.7, angry: 0 }));
    }
    const fi = CAST_ORDER.indexOf(q.get('focus'));
    if (fi >= 0) { const x = (fi - 3) * 1.25, hh = CAST[CAST_ORDER[fi]].h; cam.position.set(x + 0.6, hh * 0.62, hh * 1.55 + 0.4); cam.lookAt(x, hh * 0.55, 0); cam.fov = 40; }
    else if (flat) { cam.position.set(0.2, 1.2, 19); cam.lookAt(0.2, 0.9, 0); cam.fov = 34; }
    else if (view === 'crowd') { cam.position.set(0, 1.5, 10.5); cam.lookAt(0, 0.95, 0); cam.fov = 44; }
    else { cam.position.set(0, 1.25, 6.7); cam.lookAt(0, 0.98, 0); cam.fov = 38; }
    cam.updateProjectionMatrix();
  } else if (kind === 'faces') {
    const small = q.has('small'), cell = 0.62;
    CAST_ORDER.forEach((id, row) => {
      for (let e = 0; e < 8; e++) {
        const c = makeCharacter(id, null, { headOnly: true });
        c.mesh.position.set((e - 3.5) * cell, (3 - row) * cell - CAST[id].head.y + 0.0, 0);
        setFace(c.rig, e); poseRig(c.rig);
        R.scene.add(c.mesh); show.chars.push(c);
      }
    });
    const h = small ? 9.4 : 4.7;
    cam.position.set(0, 0.05, 60); cam.lookAt(0, 0.05, 0); cam.fov = 2 * Math.atan(h / 2 / 60) * 180 / Math.PI; cam.updateProjectionMatrix();
    show.static = true;
  }
  if (kind === 'cart') {
    if (view === 'rivals') {
      CAST_ORDER.forEach((id, i) => {
        const c = makeRacer(id, null, id === 'penny' ? { hat: 'beanie' } : {});
        c.mesh.position.set((i - 3) * 2.3, 0, i % 2 ? -0.6 : 0.6); c.mesh.rotation.y = 0.55; c.mesh.layers.enable(1);
        R.scene.add(c.mesh); show.chars.push(c);
      });
      cam.position.set(1.5, 6.5, 11); cam.lookAt(0, 0.6, 0); cam.fov = 44;
    } else {
      // rows: wheels, basket, bumper, magnet tiers 0-3; the last column shows paints; the front row hats
      const rows = ['wheels', 'basket', 'bumper', 'magnet'], paints = ['mint', 'gold', 'friday', 'candy'];
      rows.forEach((u, r) => {
        for (let t = 0; t <= 3; t++) {
          if (t === 0 && r > 0) continue;
          const c = makeCharacter('penny', null, { cartOnly: true });
          const spec = { paint: 'pink', tiers: { [u]: t } };
          const m = makeRacer('penny', spec, { cartOnly: true });
          m.mesh.position.set((t - 2) * 2.4, 0, (r - 1.5) * 2.7); m.mesh.rotation.y = 0.5; R.scene.add(m.mesh); show.carts.push(m);
          void c;
        }
        const p = makeRacer('penny', { paint: paints[r], tiers: {} }, { cartOnly: true });
        p.mesh.position.set(2 * 2.4 + 0.4, 0, (r - 1.5) * 2.7); p.mesh.rotation.y = 0.5; R.scene.add(p.mesh); show.carts.push(p);
      });
      const gx = makeRacer('penny', { paint: 'galaxy', tiers: { wheels: 3, basket: 3, bumper: 3, magnet: 3 } }, { cartOnly: true });
      gx.mesh.position.set(-2 * 2.4, 0, 1.2 * 2.7); gx.mesh.rotation.y = 0.5; R.scene.add(gx.mesh); show.carts.push(gx);
      HATS.slice(1).forEach((h, i) => {
        const c = makeCharacter('penny', null, { hat: h.id, headOnly: true });
        c.mesh.position.set(-3.4 + i * 1.25, -0.25, 5.4); setFace(c.rig, 1); poseRig(c.rig); R.scene.add(c.mesh);
      });
      cam.position.set(0, 10.5, 12.5); cam.lookAt(0, 0, 0.8); cam.fov = 46;
      show.static = true;
    }
    cam.updateProjectionMatrix();
  }
  show.update = (dt) => {
    show.t += dt; R.clock = show.t;
    if (!show.static) for (const c of show.chars) animate(c.rig, { mode: kind === 'cart' ? 'count' : 'show', speed: 0 }, dt);
    for (const c of show.carts) { poseCart(c.rig, { steer: Math.sin(show.t) * 0.6 }); poseRig(c.rig); }
    if (show.crowd) {
      for (const p of show.people) p.pose = crowdPose(p, show.t);
      syncCrowd(show.crowd, show.people, null);
    }
  };
  return show;
}

// ---- the store kit on a small demonstration floor ----------------------------------------------------------
// Every fixture of the kit through the real scene builder; cameras: wide, start (the gameplay camera), shelf, hazard.
const DEMO = {
  id: 'kitdemo', name: 'KIT', timer: 99, heading: Math.PI, rivals: ['granny', 'dad'], crowd: 10, rush: 0, list: [],
  zones: [{ pool: 'market', color: 0, name: 'KIT' }],
  plan: [
    '                            ',
    ' .......................... ',
    ' .......................... ',
    ' .......................... ',
    ' .......................... ',
    ' ..SSSSSS......LLLLLLL..... ',
    ' .......................... ',
    ' ...MMMM....P......H....... ',
    ' ..............o.o.o....... ',
    ' ..SSSSSS......SSSSSSS..... ',
    ' ..........~~.....O........ ',
    ' ..........~~.............. ',
    ' ....cCcCcCc..........b.t.. ',
    ' ....cCcCcCc............... ',
    ' .......................... ',
    ' ...r..r.......@........... ',
    ' .......................... ',
    ' .......................... ',
    ' .......................... ',
    '                            ',
  ],
};
function kitShow(kit, view, q) {
  const def = Object.assign({}, DEMO, { kit: kit.id });
  const sim = createSim(def, 1, { countdown: 0 });
  const v = buildScene(sim);
  setGrade(v.kit.grade);
  const B = builder();
  fixtureDemo(B, kit, 9, 4.6);
  const demo = new THREE.Mesh(toGeometry(B, { groups: false, hull: false }), celMaterial({ mapB: kitAtlas(kit), halftone: true, shadow: true }));
  R.scene.add(demo);
  const cam = R.camera, show = { kind: 'kit', t: 0, sim, v };
  const shots = {
    wide: [[-6, 21, 40], [26, 0, 14], 50], shelf: [[9, 2.2, 16.6], [8, 1.0, 19.8], 46], hazard: [[29, 3.2, 20.2], [33.5, 0.8, 14.2], 44],
  };
  show.update = (dt) => {
    show.t += dt; R.clock = show.t;
    syncScene(v, sim, 1, dt);
    const sh = shots[view];
    if (sh) { cam.position.set(...sh[0]); cam.lookAt(...sh[1]); cam.fov = sh[2]; cam.updateProjectionMatrix(); }
    else updateCamera(sim.player, 1, dt, 0, sim.world);
  };
  return show;
}

// ---- the title: the cast lined up behind the mall doors (DESIGN.md section 8) ----------------------------
// The camera stands inside the store at cart height and looks out through a wide glass front under the store's
// sign; the whole cast waits right behind the glass with their carts, Penny in the middle, the crowd pressed in
// behind them, all lit by the light spilling out of the store. open() slides the doors apart.
const GLASS_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }';
const GLASS_FS = `uniform sampler2D uMap; varying vec2 vUv; ${MRT_OUT}
void main() { vec2 o = vec2(6.0, 3.0) / 8.0; vec4 t = texture2D(uMap, o + clamp(vUv, 0.01, 0.99) / 8.0);
  float high = smoothstep(0.62, 0.8, vUv.y);       // glare only above the heads
  gl_FragColor = vec4(mix(vec3(0.8, 0.93, 1.0), vec3(1.0), t.a), 0.05 + t.a * 0.5 * high); oAux = vec4(0.0); }`;
// a group photo: the short ones in front against the glass (Penny in the middle), the tall ones behind them
const TITLE_CAST = [['granny', -1.15, 0], ['penny', 0, 0], ['gramps', 1.3, 0], ['selfie', -2.3, 1], ['dad', -1.45, 1], ['queen', 0.62, 1], ['bubba', 2.35, 1]];
export function makeTitle(kit) {
  const root = new THREE.Group(), show = { root, t: 0, open: -1, chars: [], people: [], crowd: null };
  R.scene.add(root);
  const add = (m) => { root.add(m); return m; };
  // floors: the store inside (its own tiles), the pavement outside
  const n = 24, data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) data[i * 4 + 3] = 255;
  const map = new THREE.DataTexture(data, n, n, THREE.RGBAFormat); map.magFilter = map.minFilter = THREE.NearestFilter; map.needsUpdate = true;
  const fm = floorMaterial(kit); fm.uniforms.uMap.value = map; fm.uniforms.uMapSize.value.set(n, n);
  const inside = add(new THREE.Mesh(new THREE.PlaneGeometry(40, 16), fm)); inside.rotation.x = -Math.PI / 2; inside.position.set(0, 0, 8);
  const B = builder(), atlas = kitAtlas(kit), F = kit.fixture, PW = 1.06, W2 = PW * 3.5;      // door panel width, half the glass front
  // the pavement, lit warm where the store's light falls out through the glass
  bind(B, 0, [0, 0, 0.1, 0]); at(B, 0, -0.02, -12); box(B, 44, 0.02, 24, 0x6E6888, { bevel: 0, top: 0x7C7696 });
  for (let x = -21; x <= 21; x += 3) { at(B, x, 0, -6); box(B, 0.12, 0.01, 12, 0x8C86A4, { bevel: 0 }); }
  at(B, 0, 0.004, -2.6); box(B, W2 * 2 + 1.2, 0.01, 5, 0xF2E2C4, { bevel: 0 });
  // the facade: walls either side of the glass front, a header with the store's sign, posters, lamps, a red carpet
  bind(B, 0, [0, 0, 0, 0]);
  for (const s2 of [1, -1]) { at(B, s2 * (W2 + 8.1), 0, 0); box(B, 16, 5.2, 0.6, kit.walls.face, { bevel: 0, top: kit.walls.top }); at(B, s2 * (W2 + 8.1), 1.15, 0.31); box(B, 16, 0.5, 0.02, kit.walls.band, { bevel: 0 }); at(B, s2 * (W2 + 8.1), 1.78, 0.31); box(B, 16, 0.1, 0.02, kit.walls.stripe, { bevel: 0 }); }
  at(B, 0, 3.6, 0); box(B, W2 * 2 + 0.4, 1.6, 0.6, kit.walls.face, { bevel: 0, top: kit.walls.top });
  bind(B, 0, [0, 0, 0.6, 0]); for (const s2 of [1, -1]) { at(B, s2 * (W2 + 0.07), 0, 0); box(B, 0.25, 3.6, 0.7, F.dark, { bevel: 0.2 }); } at(B, 0, 3.5, 0.05); box(B, W2 * 2 + 0.4, 0.25, 0.7, F.dark, { bevel: 0.2 });
  bind(B, 0, [3, KIT.banner, 0.1, 0.25]); at(B, 0, 3.75, 0.33); box(B, 5.6, 1.2, 0.05, 0xFFFFFF, { bevel: 0, front: [3, KIT.banner, 0.1, 0.25], mid: false });
  for (const [x, c] of [[-6.6, KIT.poster3], [6.6, KIT.sale], [-10, KIT.poster2], [10, KIT.poster3]]) { bind(B, 0, [3, c, 0.1, 0]); at(B, x, 0.9, 0.32); box(B, 2.2, 2.2, 0.03, 0xFFFFFF, { bevel: 0, front: [3, c, 0.1, 0] }); }
  bind(B, 0, [0, 0, 0.3, 0]); at(B, 0, 0.005, 2.5); box(B, 4.2, 0.01, 5, 0xC8323C, { bevel: 0 });
  for (const s2 of [1, -1]) for (const z of [1.6, 4.0]) { at(B, s2 * 5.4, 0, z); cyl(B, 0.06, 0.08, 1.0, 0xFFD23F, { seg: 8 }); at(B, s2 * 5.4, 1.02, z); ellipsoid(B, 0.1, 0.1, 0.1, 0xFFD23F, { seg: 8, rings: 6 }); }
  at(B, 0, 0, 0); for (const s2 of [1, -1]) tube(B, [[s2 * 5.4, 0.9, 1.6], [s2 * 5.4, 0.72, 2.8], [s2 * 5.4, 0.9, 4.0]], 0.05, 0xE63946, { seg: 6, flat: [1, 0.5] });
  bind(B, 0, [0, 0, 0.6, 0.9]); for (const s2 of [1, -1]) { at(B, s2 * 5.4, 3.0, 0.5); ellipsoid(B, 0.22, 0.22, 0.22, 0xFFF1C4, { seg: 10, rings: 8 }); }
  for (let i = 0; i < 28; i++) { const x = -20.5 + i * 1.52; at(B, x, 5.25, 0.35); ellipsoid(B, 0.09, 0.09, 0.09, [0xFFF1C4, 0xFF4FA3, 0x8EE3C8, 0xFFD23F][i % 4], { seg: 6, rings: 4 }); }
  const mat = celMaterial({ mapB: atlas, halftone: true, shadow: true });
  add(new THREE.Mesh(toGeometry(B, { groups: false, hull: false }), mat));
  // the doors: six glass panels with frames; they slide apart on open()
  const gm = blendMaterial(new THREE.ShaderMaterial({ vertexShader: GLASS_VS, fragmentShader: GLASS_FS, uniforms: { uMap: { value: atlas } } }));
  const fb = builder(); bind(fb, 0, [0, 0, 0.6, 0]); for (const s2 of [1, -1]) { at(fb, s2 * (PW / 2 - 0.04), 0, 0); box(fb, 0.08, 3.3, 0.1, 0xDDE3EA, { bevel: 0.2 }); } at(fb, 0, 0, 0); box(fb, PW, 0.12, 0.1, 0xDDE3EA, { bevel: 0.2 }); at(fb, 0, 3.2, 0); box(fb, PW, 0.12, 0.1, 0xDDE3EA, { bevel: 0.2 });
  bind(fb, 0, [0, 0, 1, 0]); at(fb, PW / 2 - 0.16, 2.3, 0.06); box(fb, 0.06, 0.6, 0.06, 0x2A2440, { bevel: 0.3 });
  const fgeo = toGeometry(fb, { groups: false, hull: false }), pane = new THREE.PlaneGeometry(PW - 0.14, 3.06);
  show.doors = [-3, -2, -1, 0, 1, 2, 3].map((i) => i * PW).map((x) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0.12);
    const fr = new THREE.Mesh(fgeo, mat); if (x < 0) fr.scale.x = -1;
    const p = new THREE.Mesh(pane, gm); p.position.set(0, 1.66, 0);
    g.add(fr, p); root.add(g); return { g, x };
  });
  // the whole cast right behind the glass, facing in, Penny in the middle
  TITLE_CAST.forEach(([id, x, row]) => {
    // tiny Granny is shorter than a basket: she waits at the glass on foot, handbag at the ready
    const foot = id === 'granny', c = foot ? makeCharacter(id) : makeRacer(id, null, {});
    c.mesh.position.set(x, 0, foot ? -0.75 : row ? -2.55 : -0.58 - (id === 'penny' ? 0 : 0.12));
    c.mesh.rotation.y = -x * 0.04;
    c.foot = foot;
    c.mesh.layers.enable(1);
    add(c.mesh); show.chars.push(c);
  });
  show.crowd = makeCrowd(kit.crowd);
  add(show.crowd.root);
  for (let i = 0; i < 18; i++) {
    const kind = kit.crowd[i % kit.crowd.length];
    show.people.push({ kind, x: -8 + (i % 9) * 2 + (i > 8 ? 1 : 0), z: -4.4 - (i > 8 ? 1.5 : 0) - (i % 3) * 0.3, h: (i % 5 - 2) * 0.12, state: 0, t: 0, phase: i, speed: 0, angry: 0,
      style: [0, 1, 3, 2][i % 4], cloth: CROWD_COLORS.cloth[(i * 3) % CROWD_COLORS.cloth.length], pants: CROWD_COLORS.pants[i % 5], hair: CROWD_COLORS.hair[(i * 3) % 6], seed: i * 1.3, scale: 1 });
  }
  R.renderer.setClearColor(0x1B1735, 0);
  setGrade(kit.grade);
  show.update = (dt) => {
    show.t += dt;
    const o = show.open >= 0 ? Math.min(1, (show.open += dt) / 0.45) : 0, e = o * o * (3 - 2 * o);
    for (const d of show.doors) { if (d.x === 0) d.g.position.y = e * 3.6; else d.g.position.x = d.x + Math.sign(d.x) * e * (Math.abs(d.x) + 1.2); }     // the middle one lifts, the rest slide apart
    for (const c of show.chars) animate(c.rig, { mode: c.foot && o <= 0 ? 'show' : o > 0 ? 'push' : 'count', speed: o * 3, accel: o * 10 }, dt);
    for (const p of show.people) { p.state = o > 0 ? 4 : 0; p.speed = o * 3.5; p.phase += p.speed * dt * 5; p.pose = crowdPose(p, show.t, p.pose || {}); if (o <= 0) p.pose.armL = -2.2 - Math.sin(show.t * 6 + p.seed) * 0.4; }
    syncCrowd(show.crowd, show.people, R.camera.position);
    // at cart height, a slow sway; the cast fills the middle band of the frame between the logo and START
    const cam = R.camera, sway = Math.sin(show.t * 0.35);
    cam.position.set(sway * 0.25, 2.05 - e * 0.2, 5.15 - e * 1.6); cam.lookAt(sway * 0.08, 1.02, -2.0);
    if (cam.fov !== 40) { cam.fov = 40; cam.updateProjectionMatrix(); }
  };
  show.dispose = () => { R.scene.remove(root); root.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); disposeCrowd(show.crowd); };
  return show;
}
