// DOORBUSTER — showcase.js
// Purpose: the showcase scenes reached only through URL parameters (QUALITY.md section 3), with a
//          close-up or orbit camera: ?scene=lineup (the cast; &view=crowd the crowd row; &flat=1 flat ink
//          silhouettes), ?scene=faces (the expression sheet; &small=1 at gameplay size), ?scene=cart
//          (upgrade tiers and cosmetics) and ?scene=kit&store=<store> (a store kit; &view=wide|start|shelf|hazard).
// Exports: initShowcase
// Depends on: render.js, rig.js, crowd.js, cast.js, kits.js, atlas.js and the global THREE.

import { R, setGrade } from './render.js';
import { makeCharacter, animate, setFace, poseRig } from './rig.js';
import { makeCrowd, syncCrowd, crowdPose } from './crowd.js';
import { CAST, CAST_ORDER, CROWD_ORDER, CROWD_COLORS } from './cast.js';
import { KITS, floorMaterial } from './kits.js';
import { EXPR } from './atlas.js';

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
  const show = { kind, t: 0, chars: [], crowd: null, people: [], cam: null };
  stage(kit, flat);
  const cam = R.camera;
  if (kind === 'lineup') {
    const named = !view || flat, crowdRow = view === 'crowd' || flat;
    if (named) CAST_ORDER.forEach((id, i) => {
      const c = makeCharacter(id);
      c.mesh.position.set((i - 3) * 1.25, 0, flat ? 1.2 : 0);
      c.mesh.rotation.y = -(i - 3) * 0.07;
      c.mesh.layers.enable(1);
      R.scene.add(c.mesh); show.chars.push(c);
    });
    if (crowdRow) {
      show.crowd = makeCrowd(CROWD_ORDER);
      R.scene.add(show.crowd.root);
      CROWD_ORDER.forEach((kind2, i) => show.people.push({ kind: kind2, x: (i - 6) * (flat ? 0.95 : 1.05), z: flat ? -1.2 : 0, h: kind2 === 'scooterElder' || kind2 === 'strollerMom' || kind2 === 'walkerGranny' ? 0.6 : 0, state: 0, t: 0, phase: 0, speed: 0,
        style: [2, 2, 1, 3, 3, 0, 1, 0, 0, 1, 3, 0, 2][i], cloth: CROWD_COLORS.cloth[i % 6], pants: CROWD_COLORS.pants[i % 5], hair: CROWD_COLORS.hair[i % 6], seed: i * 1.7, angry: 0 }));
    }
    if (flat) { cam.position.set(0, 2.6, 12.5); cam.lookAt(0, 0.95, 0); cam.fov = 40; }
    else if (view === 'crowd') { cam.position.set(0, 1.5, 10.5); cam.lookAt(0, 0.95, 0); cam.fov = 44; }
    else { cam.position.set(0, 1.35, 9.2); cam.lookAt(0, 1.0, 0); cam.fov = 40; }
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
  show.update = (dt) => {
    show.t += dt; R.clock = show.t;
    if (!show.static) for (const c of show.chars) animate(c.rig, { mode: 'stand', speed: 0, look: [0, 1.2, 8] }, dt);
    if (show.crowd) {
      for (const p of show.people) p.pose = crowdPose(p, show.t);
      syncCrowd(show.crowd, show.people, null);
    }
  };
  return show;
}
