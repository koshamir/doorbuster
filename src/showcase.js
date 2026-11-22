// DOORBUSTER — showcase.js
// Purpose: the showcase scenes reached only through URL parameters (QUALITY.md section 3), with a
//          close-up or orbit camera: ?scene=lineup (the cast; &view=crowd the crowd row; &flat=1 flat ink
//          silhouettes), ?scene=faces (the expression sheet; &small=1 at gameplay size), ?scene=cart
//          (upgrade tiers and cosmetics) and ?scene=kit&store=<store> (a store kit; &view=wide|start|shelf|hazard).
// Exports: initShowcase
// Depends on: render.js, rig.js, crowd.js, cast.js, kits.js, atlas.js and the global THREE.

import { R, setGrade, updateCamera, celMaterial } from './render.js';
import { makeCharacter, makeRacer, poseCart, animate, setFace, poseRig } from './rig.js';
import { PAINTS, HATS, cartSpecFor } from './cartart.js';
import { makeCrowd, syncCrowd, crowdPose } from './crowd.js';
import { CAST, CAST_ORDER, CROWD_ORDER, CROWD_COLORS } from './cast.js';
import { KITS, floorMaterial, kitOf } from './kits.js';
import { createSim } from './sim.js';
import { buildScene, syncScene } from './scene.js';
import { fixtureDemo } from './fixtures.js';
import { builder, toGeometry } from './shapes.js';
import { EXPR, kitAtlas } from './atlas.js';

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
        style: [2, 2, 1, 3, 3, 0, 1, 0, 0, 1, 3, 0, 2][i], cloth: CROWD_COLORS.cloth[i % 6], pants: CROWD_COLORS.pants[i % 5], hair: CROWD_COLORS.hair[i % 6], seed: i * 1.7, angry: 0 }));
    }
    const fi = CAST_ORDER.indexOf(q.get('focus'));
    if (fi >= 0) { const x = (fi - 3) * 1.25, hh = CAST[CAST_ORDER[fi]].h; cam.position.set(x + 0.6, hh * 0.62, hh * 1.55 + 0.4); cam.lookAt(x, hh * 0.55, 0); cam.fov = 40; }
    else if (flat) { cam.position.set(0, 1.2, 19); cam.lookAt(0, 0.9, 0); cam.fov = 26; }
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
