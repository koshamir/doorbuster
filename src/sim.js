// DOORBUSTER — sim.js
// Purpose: one run of the game as pure logic: the carts, the clock, sweeping shelves and picking
//          goods off the floor, the tower and its spills, cart-to-cart bumps, the checkout and the
//          receipt. Presentation (render, sound, interface) only reads the state and drains
//          sim.events; it never changes the outcome.
// Exports: createSim, stepSim, advanceSim, towerUnits, giveGoods
// Depends on: config.js, world.js, cart.js, ai.js. No DOM, no THREE (runs in Node).
//
// Determinism: fixed step CFG.STEP, one seeded generator (sim.rng) for every random choice.
// Events are { type, cart, value, ref }; the types are listed where they are emitted.

import { TUNE, CFG, GOODS, GOOD, makeRng, clamp } from './config.js';
import { buildWorld, navDistAt, blockedAt } from './world.js';
import { makeCart, stepCart } from './cart.js';
import { BOTS, makeDriver, drive } from './ai.js';

// opts: bot ('beginner' | 'confident' | 'expert') drives the player's cart; countdown and timer
// override the defaults (tests use countdown: 0); greed (0..1) overrides the bot's appetite.
export function createSim(def, seed, opts = {}) {
  const rng = makeRng(Math.imul(seed | 0, 2654435761) + 97);
  const world = buildWorld(def, rng);
  const sim = {
    def, seed, opts, rng, world,
    phase: 'count',                 // count -> run -> done (player checked out) | closed (time ran out)
    t: -(opts.countdown ?? CFG.countdown),   // seconds since GO
    timer: opts.timer || def.timer || TUNE.timer,
    carts: [], player: null, events: [], acc: 0, tick: 0,
    list: (def.list || []).map((id) => GOOD[id]),     // the three shopping-list goods
    stats: { stuck: 0, crashes: 0, bumps: 0, zeroT: 0, lostNow: 0, lostMax: 0, taken: 0, spilled: 0, firstShelf: 0, firstGroup: -1 },
    emit(type, cart, value, ref) { sim.events.push({ type, cart, value, ref }); },
    // A crash spills the top of the tower, harder hits spill more (never above spillmax).
    onCrash(k, into, solid) {
      if (k.player) sim.stats.crashes++;
      sim.emit('crash', k, into, solid);
      // The goods fly on the way the cart glances off, so a driver who keeps going scoops some back up.
      const sp = Math.hypot(k.vx, k.vz) || 1;
      if (k.madT <= 0) spill(sim, k, clamp(into / 16, 0.15, TUNE.spillmax), k.vx / sp, k.vz / sp);
    },
    onSmash(k, solid) { sim.emit('smash', k, 0, solid); },
    onKnock(k, solid) { if (k.dashT <= 0 && k.madT <= 0) { k.vx *= 0.95; k.vz *= 0.95; } sim.emit('knock', k, 0, solid); },
  };
  const s = world.start;
  sim.player = makeCart(0, 'player', s.x, s.z, s.h);
  if (opts.bot) {
    sim.player.ai = makeDriver(BOTS[opts.bot]);
    if (opts.greed !== undefined) sim.player.ai.greed = opts.greed;
  }
  sim.carts.push(sim.player);
  return sim;
}

// Weight units a tower entry list carries.
export function towerUnits(tower) {
  let u = 0;
  for (const e of tower) u += GOODS[e.good].w;
  return u;
}

// ---- Taking goods ---------------------------------------------------------------------------------
// Puts one item on the tower. Hot items stay on top (they fall first). list is 1..3 for a
// shopping-list item (worth double), else 0. Emits 'take' with ref = { good, x, y, z, entry } so the
// visuals can fly it from where it stood.
function take(sim, k, good, x, y, z, list) {
  const g = GOODS[good];
  const mult = 1;                                    // the Madness multiplier arrives with M4
  const entry = { good, value: g.price * mult * (list ? 2 : 1), mult, list: list || 0 };
  let at = k.tower.length;
  if (g.size !== 'H') while (at > 0 && GOODS[k.tower[at - 1].good].size === 'H') at--;
  k.tower.splice(at, 0, entry);
  const before = k.load;
  k.load += g.w; k.value += entry.value;
  if (k.player) sim.stats.taken++;
  sim.emit('take', k, entry.value, { good, x, y, z, entry });
  const heavy = TUNE.loadfull * 0.7;
  if (before < heavy && k.load >= heavy) sim.emit('heavy', k);
  if (before <= TUNE.loadfull && k.load > TUNE.loadfull) sim.emit('overloaded', k);
}

// Test aid (debug panel, tools): puts n random ordinary goods straight into a cart.
export function giveGoods(sim, k, n) {
  for (let i = 0; i < n; i++) take(sim, k, sim.rng.int(15), k.x, 1, k.z);
}

// Sweeping and floor pickup for one cart. A shelf item is taken when the cart is on its open side
// and its centre is within cart radius + sweepgap (+ the item's inset) of it: if the side of the
// cart looks like it is at the shelf, the item is taken.
function pickups(sim, k) {
  const world = sim.world, mad = k.madT > 0;
  const room = TUNE.loadfull * TUNE.overstack - k.load;       // weight units that still fit
  const reach = CFG.CART_R + TUNE.sweepgap * (mad ? 2 : 1) + 0.35, reach2 = reach * reach;
  const T = CFG.TILE;
  const c0 = Math.max(0, Math.floor((k.x - reach) / T)), c1 = Math.min(world.cols - 1, Math.floor((k.x + reach) / T));
  const r0 = Math.max(0, Math.floor((k.z - reach) / T)), r1 = Math.min(world.rows - 1, Math.floor((k.z + reach) / T));
  if (room > 0) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const cell = world.itemCells[r * world.cols + c];
    for (let i = 0; i < cell.length; i++) {
      const it = world.items[cell[i]];
      if (it.taken || GOODS[it.good].w > TUNE.loadfull * TUNE.overstack - k.load) continue;
      const dx = k.x - it.x, dz = k.z - it.z;
      if (dx * dx + dz * dz > reach2 || dx * it.nx + dz * it.nz <= 0) continue;
      it.taken = true;
      take(sim, k, it.good, it.x, it.y, it.z);
      // Clean sweep: one cart empties a whole shelf side in one pass.
      const g = world.groups[it.group];
      if (g.by < 0) { g.by = k.id; g.t0 = sim.t; } else if (g.by !== k.id) g.mixed = true;
      if (--g.left === 0 && !g.mixed && g.total >= 6 && sim.t - g.t0 < 5) stunt(sim, k, 'cleansweep', it.x, it.z);
      if (k.player) {                             // how much of the first shelf the player took (a gate measure)
        if (sim.stats.firstGroup < 0) sim.stats.firstGroup = it.group;
        if (it.group === sim.stats.firstGroup) sim.stats.firstShelf++;
      }
    }
  }
  // Floor goods: the radius grows with speed.
  const mag = TUNE.magnet * (1 + 0.5 * Math.min(1, Math.abs(k.spd) / TUNE.maxspeed)) * (mad ? 2 : 1) + 0.3;
  for (const d of world.drops) {
    if (!d.live || d.arm > 0 || (!d.list && GOODS[d.good].w > TUNE.loadfull * TUNE.overstack - k.load)) continue;   // a list item always fits
    const dx = k.x - d.x, dz = k.z - d.z;
    if (dx * dx + dz * dz > mag * mag) continue;
    d.live = false;
    take(sim, k, d.good, d.x, 0.3, d.z, d.list);
  }
}

// A named stunt: money on the STUNTS line of the receipt. Emits 'stunt' with ref = { name, x, z }.
function stunt(sim, k, name, x, z) {
  const pay = CFG.stunts[name] || 0;
  k.stunts += pay;
  k.stuntLog.push(name);
  sim.emit('stunt', k, pay, { name, x, z });
}

// ---- Spilling -------------------------------------------------------------------------------------
// Drops `share` of the tower (at most spillmax), top first, onto free floor a few metres from the
// cart in the direction (dx, dz). Spilled goods flash for `recollect` seconds and anyone can take them.
function spill(sim, k, share, dx, dz) {
  const n = Math.floor(k.tower.length * Math.min(share, TUNE.spillmax));      // never more than spillmax of the tower
  if (n <= 0) return 0;
  const world = sim.world;
  for (let i = 0; i < n; i++) {
    const e = k.tower.pop();
    k.load -= GOODS[e.good].w; k.value -= e.value;
    const a = sim.rng() * 6.283, r = 0.6 + sim.rng() * 1.7;
    let x = k.x + Math.cos(a) * r + dx * 3.4, z = k.z + Math.sin(a) * r + dz * 3.4;
    if (blockedAt(world, x, z, 0.35)) { x = k.x + (sim.rng() - 0.5) * 1.2; z = k.z + (sim.rng() - 0.5) * 1.2; }
    world.drops.push({ x, z, good: e.good, ttl: TUNE.recollect, live: true, list: e.list, arm: 0.55, ox: k.x, oz: k.z, born: sim.t });
  }
  if (k.player) sim.stats.spilled += n;
  sim.emit('spill', k, n);
  return n;
}

// ---- Checkout -------------------------------------------------------------------------------------
// The receipt: ITEMS (prices already carry their multipliers), LIST, STUNTS, TIME, TOTAL (GDD 5.9).
function checkout(sim, k, lane) {
  k.done = true; k.doneT = sim.t; k.lane = lane;
  let items = 0, have = 0;
  for (const e of k.tower) items += e.value;
  for (let n = 1; n <= 3; n++) if (k.tower.some((e) => e.list === n)) have++;
  const list = have === 3 ? CFG.listBonus : 0;
  const left = Math.max(0, Math.floor(sim.timer - sim.t));
  k.receipt = { items, list, stunts: k.stunts, time: left * TUNE.timebonus, left, count: k.tower.length,
    total: items + list + k.stunts + left * TUNE.timebonus };
  sim.emit('finish', k, k.receipt.total);
  if (k.player) sim.phase = 'done';
}

// ---- The step -------------------------------------------------------------------------------------
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
    if (!racing || k.done) {                         // parked: no pedals, roll to a stop
      k.input.gas = 0; k.input.brake = 0; k.input.steer = 0; k.input.drift = false; k.input.dash = false;
      if (k.done) { k.vx *= 0.94; k.vz *= 0.94; }
    }
    stepCart(k, k.input, sim, dt);
  }
  bumpCarts(sim);

  // Spilled goods wait a moment before they can be taken, then time out.
  for (const d of world.drops) {
    if (!d.live) continue;
    if (d.arm > 0) d.arm -= dt;
    if (d.ttl > 0) { d.ttl -= dt; if (d.ttl <= 0) { d.live = false; sim.emit('gone', null, 0, d); } }
  }
  if (world.drops.length > 160 && sim.tick % 240 === 0) world.drops = world.drops.filter((d) => d.live);

  for (const k of sim.carts) {
    if (k.done) continue;
    k.prog = world.navStart - navDistAt(world, k.x, k.z);
    if (!racing) continue;
    if (k.air <= 0 && k.stunT <= 0) pickups(sim, k);
    // An overloaded tower cannot take a long, hard drift.
    if (k.drift && k.tier >= 2 && k.load > TUNE.loadfull && !k.driftSpill && k.madT <= 0) { k.driftSpill = true; spill(sim, k, 0.15, 0, 0); }
    if (!k.drift) k.driftSpill = false;
    const c = Math.floor(k.x / CFG.TILE), r = Math.floor(k.z / CFG.TILE);
    const lane = c >= 0 && r >= 0 && c < world.cols && r < world.rows ? world.laneOf[r * world.cols + c] : -1;
    if (lane >= 0 && world.lanes[lane].open) checkout(sim, k, lane);
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
// a step (0..1) for render interpolation. Before each step, before(age) is called with how many
// seconds before "now" that step ends, so the caller can apply the key events that are at least
// that old: input then lands on the same step at any frame rate.
export function advanceSim(sim, seconds, before) {
  sim.acc += seconds;
  const n = Math.min(20, Math.floor(sim.acc / CFG.STEP + 1e-9));
  if (sim.acc - n * CFG.STEP >= CFG.STEP) sim.acc = n * CFG.STEP;   // the tab was stalled: drop the backlog
  for (let i = 0; i < n; i++) {
    if (before) before(sim.acc - (i + 1) * CFG.STEP);
    stepSim(sim);
  }
  sim.acc -= n * CFG.STEP;
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
