// DOORBUSTER — objects.js
// Purpose: the level objects of LEVELS.md section 4, built from a level's `objects` list as a few generic
//          behaviours: pendulum (swinging sale sign), tile fields (pop-up promo tiles, sliding floor panels over a
//          pit), patrols (forklift, pallet jack, robot vacuum), rotators (turnstile display, laser turret), snapping
//          scissors, boxing gloves on pressure plates, smart red/blue barriers, a path chaser (the giant yarn
//          ball), switches (floor button, hidden plate) with linked gates (roller shutter, roller door, secret
//          door), boost arrows, stopwatches and checkpoint arches. Every hazard answers
//          dangerAt(o, x, z, t, pad) ("is this spot dangerous at time t?") and passDelay(...) ("how long until
//          a cart can cross here?"); the simulation applies the effects each step, the drivers plan with the
//          two queries and the level validator checks pass windows and the loot rule with them.
// Exports: FX, SIGN, objExtent, buildObjects, stepObjects, dangerAt, passDelay, signAngle, tilePop, patrolAt, hazardsOn,
//          switchField, levelRules, flipBarriers, freeField, flameState, cleaverState, armAngle, laserAngle, scissorState, gloveReach, chaserAt, startChaser
// Depends on: config.js, world.js. No DOM, no THREE (runs in Node).
//
// Level data: objects: [[kind, col, row, { options }], ...] in tile coordinates (fractions allowed; a tile is
// CFG.TILE metres and (c, r) means its centre). Kinds and options:
//   sign     across 'x'|'z' (the way it swings), period (s), phase (0..1), amp (degrees), w (m)
//   tiles    cols, rows (the field starts at col, row), period, pattern 'diag'|'rows'|'cols'|'checker', phase
//   patrol   type 'forklift'|'jack', to [[c, r], ...] (path after the start), speed, wait, phase (0..1)
//   button / plate   opens [gate ids]; a plate is the hidden kind (subtle until pressed)
//   gate     id, c1, r1 (last tile of its rectangle), style 'shutter'|'door'|'secret'
//   boost    c1, r1, dir 'n'|'e'|'s'|'w'
//   watch    hidden (inside a secret room)
//   cp       across 'x'|'z' (the way the arch spans), w (tiles)
//   panels   cols, rows, period, open (s), lead (s): floor panels that slide open over a pit in turn
//   patrol   type 'vacuum' runs a closed loop instead (a dash makes it spin and spit goods)
//   turnstile  radius, speed (turns per second), phase      laser  len, period (s per turn), phase
//   scissors across 'x'|'z', span (m), period, closed (s), phase
//   glove    from [c, r] (the mount in the wall), dir 'n'|'e'|'s'|'w', reach (m); (c, r) is its pressure plate
//   barrier  c1, r1, color 'red'|'blue': solid when its colour is up; the player's dash flips them (def.flipEvery:
//            also every so many seconds)
//   chaser   speed: waits at (c, r) until the player takes a hot item, then rolls down the route to the checkouts
//   glove    every (s), delay (s): fires on a clock instead of from a plate (a gym cushion wall; look 'cushion')
//   bag      a punching bag: a sign that knocks back instead of wiping out (same options)
//   flame    c1, r1, period, on (s), phase: grill strips that burst into flame (a shimmer 0.6 s before)
//   cleavers across 'x'|'z' (the gantry spans that way), n, gap (m), period, down (s), step (s): a row chopping in a wave
//   bonus    c1, r1, stunt: a zone that pays a named stunt once (GOLAZO behind the foosball defence)
//   patrol   type 'foos' (a giant foosball player on its rail), 'belly' (a belly bro: a dash makes him drop food)

import { CFG, TUNE, GOODS } from './config.js';
import { addSolid, navBuild, fieldFrom, navDistAt } from './world.js';

const OT = CFG.TILE;
const OM = (c) => (c + 0.5) * OT;                 // a tile coordinate to metres (its centre)

// Effect classes (LEVELS.md section 4): what touching each kind does.
export const FX = { sign: 'wipe', tiles: 'push', patrol: 'push', button: 'switch', plate: 'switch', gate: 'switch', boost: 'move', watch: 'pick', cp: 'mark',
  panels: 'wipe', turnstile: 'push', laser: 'wipe', scissors: 'wipe', glove: 'push', barrier: 'switch', chaser: 'wipe',
  bag: 'push', flame: 'wipe', cleavers: 'wipe', bonus: 'pick' };

// The swinging sale sign: a giant price tag on a chain from a pivot SIGN.H up. At rest its lower edge is
// SIGN.REST above the floor; it is dangerous while that edge is below SIGN.CLEAR (a cart with its shopper),
// that is while the swing angle is under SIGN.LOW; its middle is then SIGN.R * sin(angle) off the lane centre.
export const SIGN = { H: 6.2, HT: 1.5, REST: 0.35, CLEAR: 1.9, THICK: 0.15 };
SIGN.CHAIN = SIGN.H - SIGN.REST - SIGN.HT;
SIGN.R = SIGN.CHAIN + SIGN.HT / 2;
SIGN.LOW = Math.acos((SIGN.H - SIGN.CLEAR) / (SIGN.CHAIN + SIGN.HT));

const O_DIRS = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 };

// ---- building ---------------------------------------------------------------------------------------------
export function buildObjects(world, def) {
  const objs = world.objs = [];
  world.checkpoints = []; world.switches = []; world.gates = []; world.barriers = []; world.redUp = true; world.flipT = def.flipEvery || 0; world.chaser = null;
  for (const [kind, c, r, o = {}] of def.objects || []) {
    const x = OM(c), z = OM(r);
    let ob;
    if (kind === 'sign' || kind === 'bag') {
      const ax = (o.across || 'x') === 'x';
      ob = { x, z, ax: ax ? 1 : 0, az: ax ? 0 : 1, period: o.period || 3, phase: o.phase || 0, amp: (o.amp || 60) * Math.PI / 180, w: o.w || 3 };
      ob.reach = SIGN.R * Math.sin(Math.min(ob.amp, SIGN.LOW)) + ob.w / 2;     // how far off centre it can hurt
    } else if (kind === 'tiles') {
      const nc = o.cols || 3, nr = o.rows || 4, period = o.period || 2, pat = o.pattern || 'diag';
      ob = { c0: c, r0: r, nc, nr, x: (c + nc / 2) * OT, z: (r + nr / 2) * OT, period, lead: 0.6, up: 0.35, ph: [] };
      for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
        const f = pat === 'rows' ? j / nr : pat === 'cols' ? i / nc : pat === 'checker' ? ((i + j) % 2) / 2 : (i + j) / (nc + nr - 1);
        ob.ph.push(((f + (o.phase || 0)) % 1) * period);
      }
    } else if (kind === 'patrol') {
      const pts = [[x, z], ...(o.to || []).map(([cc, rr]) => [OM(cc), OM(rr)])], seg = [];
      let len = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); len += l; }
      const jack = o.type === 'jack', vac = o.type === 'vacuum';
      if (vac) { const l = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); pts.push(pts[0]); seg.push(l); len += l; }   // a loop
      const foos = o.type === 'foos', belly = o.type === 'belly';
      ob = { type: o.type || 'forklift', pts, seg, len, speed: o.speed || (vac ? 2 : belly ? 1.4 : 3), wait: vac ? 0 : o.wait ?? 0.8, phase: o.phase || 0, hx: vac ? 0.55 : jack ? 0.5 : foos ? 0.45 : belly ? 0.7 : 0.75, hz: vac ? 0.55 : jack ? 1.0 : foos ? 0.5 : belly ? 0.6 : 1.35, x, z, loop: vac, spinT: 0, spitT: 0 };
      ob.cycle = vac ? len / ob.speed : 2 * (len / ob.speed + ob.wait);
    } else if (kind === 'button' || kind === 'plate') {
      ob = { x, z, c, r, rad: kind === 'button' ? 1.05 : 0.95, opens: o.opens || [], pressed: false, pressT: -9, by: null, cable: o.cable || null };
      world.switches.push(ob);
    } else if (kind === 'gate') {
      const c1 = o.c1 ?? c, r1 = o.r1 ?? r, wide = c1 - c >= r1 - r;
      ob = { id: o.id, style: o.style || 'shutter', c0: c, r0: r, c1, r1, x: (c + c1 + 1) / 2 * OT, z: (r + r1 + 1) / 2 * OT, open: 0, opening: false, wide };
      // a shutter or door is a thin panel across its passage; the tiles behind it stay blocked for the drivers until it opens
      ob.hx = wide ? (c1 - c + 1) * OT / 2 : 0.3; ob.hz = wide ? 0.3 : (r1 - r + 1) * OT / 2;
      ob.solid = addSolid(world, { x: ob.x, z: ob.z, r: 0, hx: ob.hx, hz: ob.hz, type: 'gate', on: true, gate: ob });
      world.gates.push(ob);
    } else if (kind === 'boost') {
      const c1 = o.c1 ?? c, r1 = o.r1 ?? r, h = O_DIRS[o.dir || 's'];
      ob = { x: (c + c1 + 1) / 2 * OT, z: (r + r1 + 1) / 2 * OT, hx: (c1 - c + 1) * OT / 2, hz: (r1 - r + 1) * OT / 2, h, dx: Math.sin(h), dz: Math.cos(h) };
    } else if (kind === 'watch') {
      ob = { x, z, taken: false, hidden: !!o.hidden };
    } else if (kind === 'panels') {
      const nc = o.cols || 3, nr = o.rows || 3, period = o.period || 3.5;
      ob = { c0: c, r0: r, nc, nr, x: (c + nc / 2) * OT, z: (r + nr / 2) * OT, period, up: o.open || 1.5, lead: o.lead || 0.7, ph: [] };
      // a snake through the field, or 'wave': nearly all together, a ripple along the way across (axis 'x' or 'z')
      for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) ob.ph.push((((o.pattern === 'wave' ? (o.axis === 'z' ? j / nr : i / nc) * (o.spread ?? 0.12) : (j * nc + (j % 2 ? nc - 1 - i : i)) / (nc * nr)) + (o.phase || 0)) % 1) * period);
    } else if (kind === 'turnstile') {
      ob = { x, z, R: o.radius || 2.5, w: (o.speed || 0.35) * 2 * Math.PI, phase: o.phase || 0, arms: 3 };
      ob.reach = ob.R; ob.solid = addSolid(world, { x, z, r: 0.45, hx: 0, hz: 0, type: 'pillar', on: true });
      world.block[Math.floor(z / OT) * world.cols + Math.floor(x / OT)] = 1;
    } else if (kind === 'laser') {
      ob = { x, z, L: o.len || 7, period: o.period || 4, phase: o.phase || 0 };
      ob.reach = ob.L; ob.solid = addSolid(world, { x, z, r: 0.6, hx: 0, hz: 0, type: 'pillar', on: true });
      world.block[Math.floor(z / OT) * world.cols + Math.floor(x / OT)] = 1;
    } else if (kind === 'scissors') {
      const ax = (o.across || 'x') === 'x';
      ob = { x, z, ax: ax ? 1 : 0, az: ax ? 0 : 1, span: o.span || 4, period: o.period || 2.2, closed: o.closed || 0.4, phase: o.phase || 0 };
      ob.reach = ob.span / 2;
    } else if (kind === 'glove') {
      const [fc, fr] = o.from || [c, r], d = O_DIRS[o.dir || 'e'];
      // the plate is pw tiles wide (across x); drivers' routes keep off it (a clocked glove has no plate)
      ob = { x, z, gx: OM(fc), gz: OM(fr), dx: Math.sin(d), dz: Math.cos(d), reach: o.reach || 3, fireAt: -9, armed: !o.every, pw: (o.pw || 1) * OT / 2, every: o.every || 0, delay: o.delay || 0, look: o.look || 'glove' };
      if (ob.every) { ob.pw = 0; ob.x = ob.gx; ob.z = ob.gz; }
      else {
      for (let cc = Math.round(c - ((o.pw || 1) - 1) / 2); cc <= Math.round(c + ((o.pw || 1) - 1) / 2); cc++) world.block[Math.floor(z / OT) * world.cols + cc] = 1;
      (world.noGo || (world.noGo = [])).push({ x, z, hx: ob.pw + 0.25, hz: 1.5 });
      }
    } else if (kind === 'barrier') {
      const c1 = o.c1 ?? c, r1 = o.r1 ?? r;
      // a wall across the way: as wide as its tiles, thin the other way (the drivers' route treats all its tiles as shut)
      const wide = c1 - c >= r1 - r;
      ob = { color: o.color || 'red', c0: c, r0: r, c1, r1, x: (c + c1 + 1) / 2 * OT, z: (r + r1 + 1) / 2 * OT, wide, hx: wide ? (c1 - c + 1) * OT / 2 - 0.05 : 0.3, hz: wide ? 0.3 : (r1 - r + 1) * OT / 2 - 0.05, rise: 0 };
      ob.solid = addSolid(world, { x: ob.x, z: ob.z, r: 0, hx: ob.hx, hz: ob.hz, type: 'barrier', on: true, barrier: ob });
      world.barriers.push(ob);
    } else if (kind === 'flame' || kind === 'bonus') {
      const c1 = o.c1 ?? c, r1 = o.r1 ?? r;
      ob = { c0: c, r0: r, c1, r1, x: (c + c1 + 1) / 2 * OT, z: (r + r1 + 1) / 2 * OT, hx: (c1 - c + 1) * OT / 2, hz: (r1 - r + 1) * OT / 2, period: o.period || 2.5, on: o.on || 1, phase: o.phase || 0, lead: 0.6, stunt: o.stunt || 'golazo', paid: false };
      ob.reach = Math.max(ob.hx, ob.hz);
    } else if (kind === 'cleavers') {
      const ax = (o.across || 'x') === 'x';
      ob = { x, z, ax: ax ? 1 : 0, az: ax ? 0 : 1, n: o.n || 5, gap: o.gap || 1.3, period: o.period || 2.6, down: o.down || 0.35, step: o.step || 0.25, phase: o.phase || 0 };
      ob.reach = ob.n * ob.gap / 2;
    } else if (kind === 'chaser') {
      ob = { x, z, sx: x, sz: z, speed: o.speed || 10.8, R: o.radius || 1.7, active: false, s: 0, path: null, t0: 0, done: false };
      world.chaser = ob;
    } else if (kind === 'cp') {
      const ax = (o.across || 'x') === 'x';
      ob = { index: world.checkpoints.length, x, z, c, r, ax: ax ? 1 : 0, az: ax ? 0 : 1, w: (o.w || 3) * OT / 2, dx: 0, dz: 1, h: 0 };
      world.checkpoints.push(ob);
    } else continue;
    ob.kind = kind; ob.fx = FX[kind];
    objs.push(ob);
  }
  // switches find their gates; a cable runs along the floor from each switch to what it opens
  for (const s of world.switches) {
    s.gates = s.opens.map((id) => world.gates.find((g) => g.id === id)).filter(Boolean);
    s.target = s.gates[0] || null;
    if (!s.cable && s.target) s.cable = [[s.x, s.z], [s.target.x, s.z], [s.target.x, s.target.z]];
  }
  // route distances with every gate open (the validator's order checks), then the gates close for the run
  navBuild(world);
  for (const s of world.switches) s.nav = navDistAt(world, s.x, s.z);
  for (const g of world.gates) g.nav = navDistAt(world, g.x, g.z);
  for (const cp of world.checkpoints) {
    cp.nav = navDistAt(world, cp.x, cp.z);
    // the way through the arch: across its span, toward the checkouts
    const nx = cp.az, nz = cp.ax, f = navDistAt(world, cp.x + nx * 2.5, cp.z + nz * 2.5) <= navDistAt(world, cp.x - nx * 2.5, cp.z - nz * 2.5) ? 1 : -1;
    cp.dx = nx * f; cp.dz = nz * f; cp.h = Math.atan2(cp.dx, cp.dz);
  }
  // a turnstile's whole sweep is shut to the route: drivers go round it, the greedy cut through for the goods on its arms
  for (const ob of objs) {
    if (ob.kind !== 'turnstile') continue;
    (world.noGo || (world.noGo = [])).push({ x: ob.x, z: ob.z, r: ob.R + 1.0 });
    for (let r = Math.floor((ob.z - ob.R) / OT); r <= Math.floor((ob.z + ob.R) / OT); r++) for (let c = Math.floor((ob.x - ob.R) / OT); c <= Math.floor((ob.x + ob.R) / OT); c++)
      if (c >= 0 && r >= 0 && c < world.cols && r < world.rows && Math.hypot((c + 0.5) * OT - ob.x, (r + 0.5) * OT - ob.z) < ob.R + 0.4) world.block[r * world.cols + c] = 1;
  }
  for (const g of world.gates) setGateBlock(world, g, 1);
  setBarriers(world);
  navBuild(world);
  world.navStart = navDistAt(world, world.start.x, world.start.z);
  return objs;
}
// The smart barriers: the ones of the colour that is up are solid (and block the drivers' routes).
function setBarriers(world) {
  for (const b of world.barriers) {
    const up = (b.color === 'red') === world.redUp;
    b.solid.on = up;
    for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) world.block[r * world.cols + c] = up ? 1 : 0;
  }
}
export function flipBarriers(sim) {
  const world = sim.world;
  if (!world.barriers.length) return;
  world.redUp = !world.redUp; world.flipT = sim.def.flipEvery || 0;
  setBarriers(world); navBuild(world);
  // a barrier that rises under a cart pushes it out to the side it is on
  for (const b of world.barriers) if (b.solid.on) for (const k of sim.carts) {
    const dx = k.x - b.x, dz = k.z - b.z, R = CFG.CART_R + 0.1;
    if (k.done || Math.abs(dx) > b.hx + R || Math.abs(dz) > b.hz + R) continue;
    const nx = b.wide ? 0 : Math.sign(dx) || 1, nz = b.wide ? Math.sign(dz) || 1 : 0;
    if (b.wide) k.z = b.z + nz * (b.hz + R); else k.x = b.x + nx * (b.hx + R);
    sim.shove(k, b, nx, nz);
  }
  sim.emit('flip', null, world.redUp ? 1 : 0);
}
// The route to the checkouts with every barrier down: the player's bots aim through the barriers they will flip.
export function freeField(world) {
  if (world.freeVer === world.navVer) return world.navFree;
  const bar = (v) => { for (const b of world.barriers) for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) world.block[r * world.cols + c] = v === 2 ? (b.solid.on ? 1 : 0) : v; };
  bar(0);
  const seeds = [];
  for (const lane of world.lanes) if (lane.open) for (const i of lane.tiles) seeds.push(i, lane.warned ? 14 : 0);
  world.navFree = fieldFrom(world, seeds, world.navFree || new Float32Array(world.cols * world.rows));
  bar(2);
  world.freeVer = world.navVer;
  return world.navFree;
}
// The giant yarn ball sets off down the route to the checkouts (following the route field downhill).
export function startChaser(sim) {
  const ob = sim.world.chaser, world = sim.world;
  if (!ob || ob.active || ob.done) return;
  const path = [[ob.sx, ob.sz]];
  let c = Math.floor(ob.sx / OT), r = Math.floor(ob.sz / OT);
  for (let n = 0; n < 400; n++) {
    let best = world.nav[r * world.cols + c], bc = c, br = r;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = world.nav[(r + dr) * world.cols + c + dc]; if (v < best - 1e-3) { best = v; bc = c + dc; br = r + dr; } }
    if (bc === c && br === r || best < 14) break;              // it stops short of the checkouts (they would burst it)
    c = bc; r = br; path.push([(c + 0.5) * OT, (r + 0.5) * OT]);
  }
  // a time table along the path: the ball drops for a second, then rolls; it slows where the way turns sharply
  // (it bounces off the walls there), as a loaded cart does
  ob.path = path; ob.len = 0; ob.seg = []; ob.at = [0];
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); ob.seg.push(l); ob.len += l;
    let turn = 0;
    for (let j = Math.max(1, i - 2); j <= Math.min(path.length - 2, i + 1); j++) { const a = Math.atan2(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]), b = Math.atan2(path[j + 1][0] - path[j][0], path[j + 1][1] - path[j][1]); turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)))); }
    ob.at.push(ob.at[i - 1] + l / (ob.speed * (turn > 1 ? 0.62 : turn > 0.5 ? 0.82 : 1)));
  }
  ob.active = true; ob.s = 0; ob.t0 = sim.t + 0.8;
  sim.emit('chaser', null, 1, ob);
}
// Where the ball is at time t (null when it is not rolling then).
export function chaserAt(ob, t, out) {
  if (!ob.active) return null;
  const u = Math.max(0, t - ob.t0);
  if (u > ob.at[ob.at.length - 1]) return null;
  let i = 0;
  while (i < ob.seg.length - 1 && u > ob.at[i + 1]) i++;
  const a = ob.path[i], b = ob.path[i + 1] || a, f = ob.at[i + 1] > ob.at[i] ? Math.min(1, (u - ob.at[i]) / (ob.at[i + 1] - ob.at[i])) : 0;
  out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f; out.h = Math.atan2(b[0] - a[0], b[1] - a[1]);
  let d = f * (ob.seg[i] || 0); for (let j = 0; j < i; j++) d += ob.seg[j];
  out.d = d; out.drop = Math.max(0, ob.t0 - t);
  return out;
}
const OC = { x: 0, z: 0, h: 0, d: 0 };
export function armAngle(ob, t, i) { return ob.w * t + ob.phase * 2 * Math.PI + i * 2 * Math.PI / ob.arms; }
export function laserAngle(ob, t) { return 2 * Math.PI * (t / ob.period + ob.phase); }
// The scissors: 0 open, 1 the glint before they close, 2 closing or shut (dangerous).
export function scissorState(ob, t) {
  const u = ((t / ob.period + ob.phase) % 1 + 1) % 1 * ob.period, shut = ob.period - ob.closed;
  return u >= shut - 0.1 ? 2 : u >= shut - 0.6 ? 1 : 0;
}
// How far a boxing glove is out at time t (0..1).
export function gloveReach(ob, t) {
  const u = t - lastFire(ob, t);
  return u < 0 || u > 0.75 ? 0 : u < 0.12 ? u / 0.12 : u < 0.4 ? 1 : 1 - (u - 0.4) / 0.35;
}
// A grill strip: 0 off, 1 shimmering (it is about to burst), 2 burning.
export function flameState(ob, t) { const u = ((t / ob.period + ob.phase) % 1 + 1) % 1 * ob.period; return u < ob.on ? 2 : u > ob.period - ob.lead ? 1 : 0; }
// Cleaver i of a row: 0 up, 1 the 'shing' wind-up (0.3 s), 2 down.
export function cleaverState(ob, t, i) { const u = (((t - i * ob.step) / ob.period + ob.phase) % 1 + 1) % 1 * ob.period; return u < ob.down ? 2 : u > ob.period - 0.3 ? 1 : 0; }
// A clocked glove (a gym cushion) fired last at this time.
function lastFire(ob, t) { return ob.every ? Math.floor((t - ob.delay) / ob.every) * ob.every + ob.delay : ob.fireAt; }
const segDist = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)); return Math.hypot(px - ax - vx * t, pz - az - vz * t); };
function setGateBlock(world, g, v) {
  for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) world.block[r * world.cols + c] = v;
}

// The way to a switch for a driver whose route is shut (a distance field to the switch, kept fresh with the route).
export function switchField(world, s) {
  if (s.fieldVer !== world.navVer) {
    s.field = fieldFrom(world, [Math.floor(s.z / OT) * world.cols + Math.floor(s.x / OT), 0], s.field || new Float32Array(world.cols * world.rows));
    s.fieldVer = world.navVer;
  }
  return s.field;
}

// ---- time functions (pure: the same answer for any t, past or future) -----------------------------------
export function signAngle(ob, t) { return ob.amp * Math.sin(2 * Math.PI * (t / ob.period + ob.phase)); }

// A tile field: 0 = resting, 1 = flashing (a pop is coming), 2 = up (launches what is on it); the tile index
// comes from tileIndex. Phase u runs 0..period from the moment the tile pops.
export function tilePop(ob, i, t) {
  const u = ((t - ob.ph[i]) % ob.period + ob.period) % ob.period;
  return u < ob.up ? 2 : u > ob.period - ob.lead ? 1 : 0;
}
function tileIndex(ob, x, z) {
  const i = Math.floor(x / OT) - ob.c0, j = Math.floor(z / OT) - ob.r0;
  return i < 0 || j < 0 || i >= ob.nc || j >= ob.nr ? -1 : j * ob.nc + i;
}

// Where a patrol is at time t: out.x, out.z, out.h (heading of its forks). It runs out along its path, waits,
// runs back, waits.
export function patrolAt(ob, t, out) {
  const run = ob.len / ob.speed, u = (((t - (ob.held || 0)) / ob.cycle + ob.phase) % 1 + 1) % 1 * ob.cycle;   // (a vacuum that bumps into a cart waits: held)
  let s, back = false;
  if (ob.loop) s = u * ob.speed;                             // round and round its loop
  else if (u < ob.wait) s = 0;
  else if (u < ob.wait + run) s = (u - ob.wait) * ob.speed;
  else if (u < 2 * ob.wait + run) { s = ob.len; back = true; }
  else { s = ob.len - (u - 2 * ob.wait - run) * ob.speed; back = true; }
  let i = 0;
  while (i < ob.seg.length - 1 && s > ob.seg[i]) { s -= ob.seg[i]; i++; }
  const a = ob.pts[i], b = ob.pts[i + 1] || a, l = ob.seg[i] || 1, f = Math.min(1, s / l);
  out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f;
  out.h = Math.atan2(b[0] - a[0], b[1] - a[1]) + (back ? Math.PI : 0);
  out.moving = ob.loop || (u >= ob.wait && (u < ob.wait + run || u >= 2 * ob.wait + run));
  return out;
}
const OP = { x: 0, z: 0, h: 0, moving: false };
const PIT = { kind: 'pit', fx: 'wipe' };

// ---- the two questions ------------------------------------------------------------------------------------
// Is (x, z) dangerous at time t? pad widens the object (a cart's radius).
export function dangerAt(ob, x, z, t, pad = 0) {
  if (ob.kind === 'flame') return Math.abs(x - ob.x) < ob.hx + pad && Math.abs(z - ob.z) < ob.hz + pad && flameState(ob, t) === 2;
  if (ob.kind === 'cleavers') {
    const dx = x - ob.x, dz = z - ob.z, lat = dx * ob.ax + dz * ob.az, along = dx * ob.az - dz * ob.ax;
    if (Math.abs(along) > 0.35 + pad || Math.abs(lat) > ob.reach + pad) return false;
    for (let i = 0; i < ob.n; i++) if (Math.abs(lat - (i - (ob.n - 1) / 2) * ob.gap) < ob.gap / 2 + pad && cleaverState(ob, t, i) === 2) return true;
    return false;
  }
  if (ob.kind === 'sign' || ob.kind === 'bag') {
    const dx = x - ob.x, dz = z - ob.z, lat = dx * ob.ax + dz * ob.az, along = dx * ob.az - dz * ob.ax;
    if (Math.abs(along) > SIGN.THICK + pad || Math.abs(lat) > ob.reach + pad) return false;
    const th = signAngle(ob, t);
    return Math.abs(th) < SIGN.LOW && Math.abs(lat - SIGN.R * Math.sin(th)) < ob.w / 2 + pad;
  }
  if (ob.kind === 'turnstile') {
    if (Math.hypot(x - ob.x, z - ob.z) > ob.R + pad) return false;
    for (let i = 0; i < ob.arms; i++) { const a = armAngle(ob, t, i); if (segDist(x, z, ob.x, ob.z, ob.x + Math.sin(a) * ob.R, ob.z + Math.cos(a) * ob.R) < 0.2 + pad) return true; }
    return false;
  }
  if (ob.kind === 'laser') {
    if (Math.hypot(x - ob.x, z - ob.z) > ob.L + pad) return false;
    const a = laserAngle(ob, t);
    return segDist(x, z, ob.x, ob.z, ob.x + Math.sin(a) * ob.L, ob.z + Math.cos(a) * ob.L) < 0.2 + pad;
  }
  if (ob.kind === 'scissors') {
    const dx = x - ob.x, dz = z - ob.z, lat = dx * ob.ax + dz * ob.az, along = dx * ob.az - dz * ob.ax;
    return Math.abs(along) < 0.3 + pad && Math.abs(lat) < ob.span / 2 + pad && scissorState(ob, t) === 2;
  }
  if (ob.kind === 'glove') {
    const e = gloveReach(ob, t);
    if (e <= 0) return false;
    const dx = x - ob.gx, dz = z - ob.gz, along = dx * ob.dx + dz * ob.dz, lat = Math.abs(dx * ob.dz - dz * ob.dx);
    return along > -pad && along < ob.reach * e + 0.5 + pad && lat < 0.7 + pad;
  }
  if (ob.kind === 'chaser') {
    const p = chaserAt(ob, t, OC);
    return !!p && Math.hypot(x - p.x, z - p.z) < ob.R + pad;
  }
  if (ob.kind === 'tiles' || ob.kind === 'panels') {
    for (const [ox, oz] of pad > 0 ? O_PADS : O_ZERO) {
      const i = tileIndex(ob, x + ox * pad, z + oz * pad);
      if (i >= 0 && tilePop(ob, i, t) === 2) return true;
    }
    return false;
  }
  if (ob.kind === 'patrol') {
    patrolAt(ob, t, OP);
    if (ob.loop) return Math.hypot(x - OP.x, z - OP.z) < 0.55 + pad;
    const dx = x - OP.x, dz = z - OP.z, s = Math.sin(OP.h), c = Math.cos(OP.h);
    return Math.abs(dx * c - dz * s) < ob.hx + pad && Math.abs(dx * s + dz * c) < ob.hz + pad;
  }
  return false;
}
const O_ZERO = [[0, 0]], O_PADS = [[0, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

// A cart now at (x0, z0) drives straight to (x1, z1) at speed v (m/s); with v0 (its speed now) it gets there
// accelerating or braking like a cart. How many seconds must it wait before setting off so that the whole
// crossing of this object is safe? 0 = go now; up to `limit` (nothing safe sooner); -1 = not on that path.
export function passDelay(ob, x0, z0, x1, z1, v, t, pad = 0.55, limit = 4, v0) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(len / 0.35));
  const hits = [];
  const [cx, cz, near] = extent(ob);
  for (let i = 0; i <= n; i++) {
    const px = x0 + dx * i / n, pz = z0 + dz * i / n;
    if (Math.abs(px - cx) < near + pad && Math.abs(pz - cz) < near + pad) hits.push([px, pz, v0 === undefined ? len * i / n / Math.max(v, 0.5) : timeTo(len * i / n, v0, Math.max(v, 0.5))]);
  }
  if (!hits.length) return -1;
  for (let d = 0; d <= limit; d += 0.05) {
    let safe = true;
    for (const [px, pz, at] of hits) if (dangerAt(ob, px, pz, t + d + at, pad)) { safe = false; break; }
    if (safe) return d;
  }
  return limit;
}

// The middle of an object's area and how far it reaches from there.
function extent(ob) {
  if (ob.kind === 'patrol') { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [px, pz] of ob.pts) { a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, pz); d = Math.max(d, pz); } return [(a + b) / 2, (c + d) / 2, Math.max(b - a, d - c) / 2 + 2.5]; }
  if (ob.kind === 'tiles' || ob.kind === 'panels') return [ob.x, ob.z, (ob.nc + ob.nr) * OT / 2 + 1];
  if (ob.kind === 'flame' || ob.kind === 'bonus') return [ob.x, ob.z, Math.max(ob.hx, ob.hz) + 1];
  if (ob.kind === 'glove') return [(ob.gx + ob.x) / 2, (ob.gz + ob.z) / 2, ob.reach + 2];
  if (ob.kind === 'chaser') return ob.active ? [ob.x, ob.z, 200] : [ob.x, ob.z, 0];
  return [ob.x, ob.z, (ob.reach || 3) + 2];
}

// Seconds to cover s metres starting at speed v0 and settling at speed v (accelerating at 10 m/s2, braking at 18).
function timeTo(s, v0, v) {
  v0 = Math.max(0, v0);
  if (Math.abs(v - v0) < 0.05) return s / v;
  const a = v > v0 ? 10 : -18, d1 = (v * v - v0 * v0) / (2 * a);
  if (s <= d1) return (-v0 + Math.sqrt(Math.max(0, v0 * v0 + 2 * a * s))) / a;
  return (v - v0) / a + (s - d1) / v;
}

// The hazards (wipe and push kinds) whose area a straight path from (x0, z0) to (x1, z1) comes near.
export function hazardsOn(world, x0, z0, x1, z1, out) {
  out.length = 0;
  const minx = Math.min(x0, x1) - 3, maxx = Math.max(x0, x1) + 3, minz = Math.min(z0, z1) - 3, maxz = Math.max(z0, z1) + 3;
  for (const ob of world.objs) {
    if (ob.fx !== 'wipe' && ob.fx !== 'push') continue;
    if (ob.kind === 'chaser') continue;                // from a chaser there is only running
    const [cx, cz, r] = extent(ob);
    if (cx + r < minx || cx - r > maxx || cz + r < minz || cz - r > maxz) continue;
    out.push(ob);
  }
  return out;
}

// ---- one step of the objects -------------------------------------------------------------------------------
// The simulation provides: emit, wipeout(cart, object), pop(cart, object, tileX, tileZ), shove(cart, object,
// nx, nz), padBoost(cart, object), watch(cart, object), checkpoint(cart, object).
export function objExtent(ob) { return extent(ob); }
export function stepObjects(sim, dt) {
  const world = sim.world, t = sim.t;
  if (world.barriers.length && sim.def.flipEvery && (world.flipT -= dt) <= 0) flipBarriers(sim);     // the timed fallback
  const ch = world.chaser;
  if (ch && ch.active) { const p = chaserAt(ch, t, OC); if (p) { ch.x = p.x; ch.z = p.z; ch.d = p.d; } else { ch.active = false; ch.done = true; sim.emit('chaser', null, 0, ch); } }
  for (const g of world.gates) {
    if (!g.opening || g.open >= 1) continue;
    g.open = Math.min(1, g.open + dt / 0.6);
    if (g.open > 0.45 && g.solid.on) { g.solid.on = false; setGateBlock(world, g, 0); navBuild(world); sim.emit('gateopen', null, 0, g); }
  }
  for (const k of sim.carts) {
    if (k.done || k.wipeT > 0) continue;
    if (k.padT > 0) k.padT -= dt;
    if (k.popT > 0) k.popT -= dt;
    const hx = Math.sin(k.h), hz = Math.cos(k.h), ground = k.air <= 0;
    for (const ob of world.objs) {
      const dx = k.x - ob.x, dz = k.z - ob.z;
      switch (ob.kind) {
        case 'sign': case 'bag': case 'flame': case 'cleavers':
          if (!ground || k.immuneT > 0 || Math.abs(dx) > ob.reach + 3 || Math.abs(dz) > ob.reach + 3) break;
          // nose and tail circles of the cart
          if (dangerAt(ob, k.x + hx * CFG.noseAt, k.z + hz * CFG.noseAt, t, CFG.noseR * 0.85) || dangerAt(ob, k.x + hx * CFG.tailAt, k.z + hz * CFG.tailAt, t, CFG.tailR * 0.85)) {
            if (ob.kind !== 'bag') { sim.wipeout(k, ob); break; }
            const w = Math.cos(2 * Math.PI * (t / ob.period + ob.phase)) >= 0 ? 1 : -1;      // a punching bag knocks the cart the way it swings
            sim.shove(k, ob, ob.ax * w, ob.az * w);
          }
          break;
        case 'bonus':
          if (k.player && !ob.paid && Math.abs(dx) < ob.hx && Math.abs(dz) < ob.hz) { ob.paid = true; sim.stunt(k, ob.stunt, k.x, k.z); sim.emit('bonus', k, 0, ob); }
          break;
        case 'panels': {
          if (!ground || k.immuneT > 0) break;
          const i = tileIndex(ob, k.x, k.z);
          if (i >= 0 && tilePop(ob, i, t) === 2) sim.wipeout(k, ob);
          break;
        }
        case 'turnstile': case 'laser': case 'scissors': case 'chaser': {
          if (!ground || k.immuneT > 0 || (ob.kind === 'chaser' && !ob.active)) break;
          const hit = dangerAt(ob, k.x + hx * CFG.noseAt, k.z + hz * CFG.noseAt, t, CFG.noseR * 0.85) || dangerAt(ob, k.x + hx * CFG.tailAt, k.z + hz * CFG.tailAt, t, CFG.tailR * 0.85);
          if (!hit) break;
          if (ob.kind === 'turnstile') {          // the arm sweeps the cart along: pushed the way it turns
            let best = 0;
            for (let i = 1; i < ob.arms; i++) if (Math.abs(Math.sin(armAngle(ob, t, i) - Math.atan2(dx, dz))) < Math.abs(Math.sin(armAngle(ob, t, best) - Math.atan2(dx, dz)))) best = i;
            // swept along the way the arm turns and out of the circle
            const a = armAngle(ob, t, best) + Math.PI / 2 * Math.sign(ob.w), d = Math.hypot(dx, dz) || 1, nx = Math.sin(a) + dx / d * 0.9, nz = Math.cos(a) + dz / d * 0.9, l = Math.hypot(nx, nz) || 1;
            sim.shove(k, ob, nx / l, nz / l);
          } else sim.wipeout(k, ob);
          break;
        }
        case 'glove': {
          if (ob.armed && ground && !ob.every && Math.abs(dx) < ob.pw && Math.abs(dz) < 1.0) { ob.armed = false; ob.fireAt = t + 0.3; sim.emit('plate', k, 0, ob); }
          if (!ob.armed && !ob.every && t > ob.fireAt + 1.2) ob.armed = true;
          if (gloveReach(ob, t) > 0.3 && dangerAt(ob, k.x, k.z, t, CFG.CART_R * 0.8)) sim.shove(k, ob, ob.dx, ob.dz);
          break;
        }
        case 'tiles': {
          if (!ground || k.popT > 0) break;
          const i = tileIndex(ob, k.x, k.z);
          if (i >= 0 && tilePop(ob, i, t) === 2) { sim.pop(k, ob, (ob.c0 + i % ob.nc + 0.5) * OT, (ob.r0 + Math.floor(i / ob.nc) + 0.5) * OT); }
          break;
        }
        case 'patrol': {
          if (!ground || k.immuneT > 0.6) break;
          patrolAt(ob, t, OP);
          const ex = k.x - OP.x, ez = k.z - OP.z, s = Math.sin(OP.h), c = Math.cos(OP.h), lx = ex * c - ez * s, lz = ex * s + ez * c;
          const ox = ob.hx + CFG.CART_R - Math.abs(lx), oz = ob.hz + CFG.CART_R - Math.abs(lz);
          if (ox <= 0 || oz <= 0) break;
          if ((ob.loop || ob.type === 'belly') && (k.dashT > 0 || k.madT > 0) && ob.spitT <= t) { ob.spitT = t + 4; ob.spinT = t + 1.2; sim.spit(ob, OP.x, OP.z); break; }
          if (ob.loop || ob.type === 'belly') {
            // a robot vacuum (or a belly bro) stops when it bumps into a cart and the cart is nudged off it; only a cart that drives into
            // it fast is knocked back (and loses the top of its tower)
            if (ob.heldAt !== t) { ob.held = (ob.held || 0) + dt; ob.heldAt = t; }
            const d = Math.hypot(ex, ez) || 1, nx = ex / d, nz = ez / d, R = ob.hx + CFG.CART_R;
            if (d < R) { k.x = OP.x + nx * R; k.z = OP.z + nz * R; }
            if (-(k.vx * nx + k.vz * nz) > 3 && !(k.vacT > t)) { k.vacT = t + 1.5; sim.shove(k, ob, nx, nz); if (ob.type === 'belly') { const vn = k.vx * nx + k.vz * nz; if (vn > 2.5) { k.vx -= (vn - 2.5) * nx; k.vz -= (vn - 2.5) * nz; } } }    // (a belly bro bounces a cart back gently)
            break;
          }
          // out along the shallower side of the box
          let nx, nz;
          if (ox < oz) { nx = Math.sign(lx) * c; nz = -Math.sign(lx) * s; } else { nx = Math.sign(lz) * s; nz = Math.sign(lz) * c; }
          sim.shove(k, ob, nx, nz);
          break;
        }
        case 'button': case 'plate':
          if (ob.pressed || !ground || dx * dx + dz * dz > ob.rad * ob.rad) break;
          ob.pressed = true; ob.pressT = t; ob.by = k;
          for (const g of ob.gates) g.opening = true;
          sim.emit('press', k, 0, ob);
          break;
        case 'boost':
          if (!ground || k.padT > 0 || Math.abs(dx) > ob.hx || Math.abs(dz) > ob.hz || k.vx * ob.dx + k.vz * ob.dz < 1) break;
          k.padT = 0.5;
          sim.padBoost(k, ob);
          break;
        case 'watch':
          if (!k.player || ob.taken || dx * dx + dz * dz > 1.7) break;
          ob.taken = true;
          sim.watch(k, ob);
          break;
        case 'pitcheck': break;
        case 'cp': {
          if (sim.def.cpAny ? ob.index === k.cp : ob.index <= k.cp) break;
          const lat = dx * ob.ax + dz * ob.az, along = dx * ob.dx + dz * ob.dz;
          if (Math.abs(lat) < ob.w && along > -0.4 && along < 1.6) sim.checkpoint(k, ob);
          break;
        }
      }
    }
  }
  // a cart that rolls into a pit (a clearance bin, the stockroom, the pool) is a wipeout unless it is in the air
  if (world.pits) for (const k of sim.carts) {
    if (k.done || k.wipeT > 0 || k.air > 0 || k.immuneT > 0) continue;
    const i = Math.floor(k.z / OT) * world.cols + Math.floor(k.x / OT);
    if (world.pit[i]) sim.wipeout(k, PIT);
  }
  // shoppers who wander into a sign or a forklift are flattened like a pancake and pop back up (never a wipeout)
  for (const s of sim.shoppers) {
    if (s.state < 0 || s.state === 5 || s.safeT > t) continue;
    for (const ob of world.objs) {
      if (ob.kind !== 'sign' && ob.kind !== 'patrol' && ob.kind !== 'chaser' && ob.kind !== 'laser' && ob.kind !== 'cleavers' && ob.kind !== 'flame') continue;
      if (Math.abs(s.x - ob.x) > 12 || Math.abs(s.z - ob.z) > 12) continue;
      if (dangerAt(ob, s.x, s.z, t, 0.25)) { s.state = 5; s.t = 1.4; s.safeT = t + 5; s.vx = s.vz = 0; sim.emit('pancake', null, 0, s); break; }
    }
  }
}

// ---- the v3 level rules (QUALITY.md section 2), for the validator ---------------------------------------------
// Returns a list of failures: a WIPE object on the route without a pass window of 0.6 s at 70% of top speed
// (unless the route can go round it), and more than 15% of the goods' value within reach of the safe line.
export function levelRules(world) {
  const fails = [], v = TUNE.maxspeed * 0.7;
  for (const ob of world.objs) {
    if (ob.fx !== 'wipe' || ob.kind !== 'sign') continue;
    let best = 0;
    for (let lat = -ob.reach; lat <= ob.reach; lat += 0.25) {
      const step = 0.02, n = Math.round(ob.period / step), safe = [];
      for (let i = 0; i < n; i++) {
        const t0 = i * step;
        let ok = true;
        for (let a = -1.6; a <= 1.6 && ok; a += 0.15) {
          const x = ob.x + ob.ax * lat + ob.az * a, z = ob.z + ob.az * lat + ob.ax * a;
          if (dangerAt(ob, x, z, t0 + (a + 1.6) / v, 0.55)) ok = false;
        }
        safe.push(ok);
      }
      // the longest run of safe starts, round the cycle
      let run = 0, top = 0;
      for (let i = 0; i < 2 * n; i++) { run = safe[i % n] ? run + 1 : 0; top = Math.max(top, Math.min(run, n)); }
      best = Math.max(best, top * step);
    }
    if (best < 0.6 && !aroundOK(world, ob)) fails.push(`the sign at ${(ob.x / OT - 0.5).toFixed(1)},${(ob.z / OT - 0.5).toFixed(1)} leaves only ${best.toFixed(2)} s to pass (0.6 s needed)`);
  }
  // the loot rule: the safe line is the shortest way that avoids every wipe zone and dash target
  const line = safeLine(world);
  if (line) {
    let total = 0, near = 0;
    const reach = CFG.CART_R + TUNE.sweepgap + 0.35;
    const close = (x, z, r) => line.some(([px, pz]) => Math.hypot(px - x, pz - z) < r);
    for (const it of world.items) { const p = GOODS[it.good].price; total += p; if (close(it.x, it.z, reach + 0.4)) near += p; }
    for (const d of world.drops) { const p = GOODS[d.good].price; total += p; if (close(d.x, d.z, TUNE.magnet + 1)) near += p; }
    for (const q of world.pieces) if (q.good >= 0) total += GOODS[q.good].price;
    if (total > 0 && near / total > 0.15) fails.push(`${Math.round(near / total * 100)}% of the goods' value lies along the safe line (at most 15%)`);
    world.safeShare = total > 0 ? near / total : 0;
  }
  return fails;
}
// Tiles a wipe object can reach (its slab, across its whole swing).
function wipeTiles(world, ob) {
  const out = [];
  for (let lat = -ob.reach - 0.5; lat <= ob.reach + 0.5; lat += 0.5) for (let a = -0.6; a <= 0.6; a += 0.6) {
    const x = ob.x + ob.ax * lat + ob.az * a, z = ob.z + ob.az * lat + ob.ax * a, c = Math.floor(x / OT), r = Math.floor(z / OT);
    if (c >= 0 && r >= 0 && c < world.cols && r < world.rows) out.push(r * world.cols + c);
  }
  return out;
}
function aroundOK(world, ob) {
  const block = world.block.slice();
  for (const i of wipeTiles(world, ob)) block[i] = 1;
  return !!pathTo(world, block);
}
function safeLine(world) {
  const block = world.block.slice();
  for (const ob of world.objs) if (ob.fx === 'wipe') for (const i of wipeTiles(world, ob)) block[i] = 1;
  for (const q of world.pieces) if (q.solid.dash) block[q.r * world.cols + q.c] = 1;
  const open = world.block.slice();
  for (const g of world.gates) for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) block[r * world.cols + c] = open[r * world.cols + c] = 0;   // open by then
  return pathTo(world, block) || pathTo(world, open);
}
// Breadth-first from the start tile to any open checkout tile over unblocked tiles; the path as tile centres.
function pathTo(world, block) {
  const { cols, rows } = world, n = cols * rows, prev = new Int32Array(n).fill(-1);
  const s = Math.floor(world.start.z / OT) * cols + Math.floor(world.start.x / OT), goal = new Uint8Array(n);
  for (const l of world.lanes) if (l.open) for (const i of l.tiles) goal[i] = 1;
  const q = [s]; prev[s] = s;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (goal[i]) { const out = []; for (let j = i; j !== s; j = prev[j]) out.push([(j % cols + 0.5) * OT, (Math.floor(j / cols) + 0.5) * OT]); return out; }
    const c = i % cols, r = (i - c) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr, j = rr * cols + cc;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || prev[j] >= 0 || (block[j] && !goal[j])) continue;
      prev[j] = i; q.push(j);
    }
  }
  return null;
}
