// DOORBUSTER — sim.js
// Purpose: one run of the game as pure logic: the carts, the clock, cart-to-cart bumps and the
//          finish at a checkout. Presentation (render, sound, interface) only reads the state and
//          drains sim.events; it never changes the outcome.
// Exports: createSim, stepSim, advanceSim
// Depends on: config.js, world.js, cart.js, ai.js. No DOM, no THREE (runs in Node).
//
// Determinism: fixed step CFG.STEP, one seeded generator (sim.rng) for every random choice.

import { TUNE, CFG, makeRng } from './config.js';
import { buildWorld, navDistAt } from './world.js';
import { makeCart, stepCart } from './cart.js';
import { BOTS, makeDriver, drive } from './ai.js';

// opts: bot ('beginner' | 'confident' | 'expert') drives the player's cart; countdown and timer
// override the defaults (tests use countdown: 0).
export function createSim(def, seed, opts = {}) {
  const rng = makeRng(Math.imul(seed | 0, 2654435761) + 97);
  const world = buildWorld(def, rng);
  const sim = {
    def, seed, opts, rng, world,
    phase: 'count',                 // count -> run -> done (player checked out) | closed (time ran out)
    t: -(opts.countdown ?? CFG.countdown),   // seconds since GO
    timer: opts.timer || def.timer || TUNE.timer,
    carts: [], player: null, events: [], acc: 0, tick: 0,
    stats: { stuck: 0, crashes: 0, bumps: 0, zeroT: 0, lostNow: 0, lostMax: 0 },
    emit(type, cart, value, solid) { sim.events.push({ type, cart, value, solid }); },
    onCrash(k, into, solid) { if (k.player) sim.stats.crashes++; sim.emit('crash', k, into, solid); },
    onSmash(k, solid) { sim.emit('smash', k, 0, solid); },
    onKnock(k, solid) { sim.emit('knock', k, 0, solid); },
  };
  const s = world.start;
  sim.player = makeCart(0, 'player', s.x, s.z, s.h);
  if (opts.bot) sim.player.ai = makeDriver(BOTS[opts.bot]);
  sim.carts.push(sim.player);
  return sim;
}

// Advances the run by one fixed step.
export function stepSim(sim) {
  const dt = CFG.STEP, world = sim.world;
  sim.tick++;
  sim.t += dt;
  if (sim.phase === 'count') {
    if (sim.t < 0) {
      for (const k of sim.carts) { k.px = k.x; k.pz = k.z; k.ph = k.h; }
      return;
    }
    sim.phase = 'run';
    sim.emit('go', sim.player);
  }
  const racing = sim.phase === 'run' || sim.phase === 'done';
  for (const k of sim.carts) {
    if (k.ai) drive(sim, k, dt);
    if (!racing || k.done) { k.input.gas = 0; k.input.steer = 0; k.input.drift = false; k.input.dash = false; k.input.brake = k.done ? 1 : 0; }
    stepCart(k, k.input, sim, dt);
  }
  bumpCarts(sim);

  for (const k of sim.carts) {
    if (k.done) continue;
    k.prog = world.navStart - navDistAt(world, k.x, k.z);
    const c = Math.floor(k.x / CFG.TILE), r = Math.floor(k.z / CFG.TILE);
    const lane = c >= 0 && r >= 0 && c < world.cols && r < world.rows ? world.laneOf[r * world.cols + c] : -1;
    if (racing && lane >= 0 && world.lanes[lane].open) {
      k.done = true; k.doneT = sim.t; k.lane = lane;
      sim.emit('finish', k);
      if (k.player) sim.phase = 'done';
    }
  }

  const p = sim.player;
  if (sim.phase === 'run') {
    if (Math.abs(p.spd) < 1) sim.stats.zeroT += dt;
    if (p.stunT > 0 || p.air > 0) { sim.stats.lostNow += dt; sim.stats.lostMax = Math.max(sim.stats.lostMax, sim.stats.lostNow); }
    else sim.stats.lostNow = 0;
    if (sim.t >= sim.timer) { sim.phase = 'closed'; sim.emit('timeup', p); }
  }
}

// Advances the run by wall-clock seconds using whole fixed steps. Returns the leftover fraction of
// a step (0..1) for render interpolation. The same sim time gives the same state at any frame rate.
export function advanceSim(sim, seconds) {
  sim.acc += seconds;
  let n = 0;
  while (sim.acc >= CFG.STEP && n < 20) { stepSim(sim); sim.acc -= CFG.STEP; n++; }
  if (sim.acc >= CFG.STEP) sim.acc = 0;        // the tab was stalled: drop the backlog instead of spiralling
  return sim.acc / CFG.STEP;
}

// Carts are circles. A heavier cart shoves a lighter one; nobody drops anything from a plain bump.
function bumpCarts(sim) {
  const carts = sim.carts, d0 = CFG.CART_R * 2;
  for (let i = 0; i < carts.length; i++) for (let j = i + 1; j < carts.length; j++) {
    const a = carts[i], b = carts[j];
    if (a.air > 0 || b.air > 0) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 >= d0 * d0 || d2 < 1e-9) continue;
    const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
    const ma = 1 + Math.min(1, a.load / TUNE.loadfull), mb = 1 + Math.min(1, b.load / TUNE.loadfull);
    const push = (d0 - d) / (ma + mb);
    a.x -= nx * push * mb; a.z -= nz * push * mb;
    b.x += nx * push * ma; b.z += nz * push * ma;
    const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (vn >= 0) continue;
    const imp = -(1 + 0.3) * vn / (1 / ma + 1 / mb);
    a.vx -= imp / ma * nx; a.vz -= imp / ma * nz;
    b.vx += imp / mb * nx; b.vz += imp / mb * nz;
    if (-vn > 2) { sim.stats.bumps++; sim.emit('cartbump', a, -vn, b); }
  }
}
