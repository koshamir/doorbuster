// DOORBUSTER — sim.js
// Purpose: one run of the game as pure logic: the carts, the clock, sweeping shelves and picking
//          goods off the floor, the tower and its spills, Madness, dash targets and rams, the level
//          objects' effects (wipeouts and respawns at checkpoints, launches, shoves, boost pads, stopwatches),
//          doors open and closing time, the modes (RUSH, SMASH), the checkout, the receipt and the final
//          table. Presentation (render, sound, interface) only reads the state and drains sim.events; it
//          never changes the outcome.
// Exports: createSim, stepSim, advanceSim, settle, giveGoods, multOf
// Depends on: config.js, world.js, cart.js, ai.js, objects.js. No DOM, no THREE (runs in Node).
//
// Determinism: fixed step CFG.STEP, one seeded generator (sim.rng) for every random choice.
// Events are { type, cart, value, ref }; the types are listed where they are emitted.

import { TUNE, CFG, GOODS, GOOD, POOLS, makeRng, clamp, wrapAngle, cartMods } from './config.js';
import { buildWorld, navBuild, navDistAt, blockedAt } from './world.js';
import { makeCart, stepCart, loadFactor } from './cart.js';
import { buildObjects, stepObjects, flipBarriers, startChaser } from './objects.js';
import { BOTS, makeDriver, rivalProfile, drive, inZone, spawnCrowd, stepCrowd, spawnTrains, stepTrains } from './ai.js';

// opts: bot ('beginner' | 'confident' | 'expert' | 'sloppy') drives the player's cart; countdown and
// timer override the defaults (tests use countdown: 0); greed (0..1) overrides the bot's appetite;
// alone = true leaves out rivals and crowd.
export function createSim(def, seed, opts = {}) {
  const rng = makeRng(Math.imul(seed | 0, 2654435761) + 97);
  const world = buildWorld(def, rng);
  buildObjects(world, def);
  const sim = {
    def, seed, opts, rng, world,
    phase: 'count',                 // count -> run -> done (player checked out) | closed (time ran out)
    t: -(opts.countdown ?? CFG.countdown),   // seconds since GO
    timer: opts.timer || (def.timer || 90) * TUNE.timer / 90,   // the tune value scales every level's own time: 90 = as designed
    carts: [], player: null, shoppers: [], trains: [], events: [], acc: 0, tick: 0,
    mode: def.mode || 'rush', closing: false, closeT: 0, ramCool: 0, table: null,
    stats: { stuck: 0, crashes: 0, bumps: 0, zeroT: 0, lostNow: 0, lostMax: 0, taken: 0, spilled: 0, firstShelf: 0, firstGroup: -1,
      rammed: 0, rivalRams: 0, madModes: 0, x2At: -1, shaves: 0, strikes: 0, bowled: 0, rivalCrashes: 0, rivalStuck: 0, rivalModes: 0, pushOuts: 0,
      wipeouts: 0, rivalWipes: 0, pops: 0, cans: 0, passes: {} },
    emit(type, cart, value, ref) {
      sim.events.push({ type, cart, value, ref });
      if (cart && cart.player && type === 'dash') flipBarriers(sim);          // the store hears every BOOM (LEVELS.md, level 3)
      if (cart && cart.player && type === 'hot' && sim.world.chaser) startChaser(sim);   // taking the treasure lets the yarn ball go
      if (type === 'boost') madGain(sim, cart, CFG.madDrift * value);        // a drift held to a boost feeds Madness
      // An overloaded tower sheds its top on a hard knock (no crash needed). Rubbing along the shelf
      // being swept or a checkout counter never counts.
      else if (type === 'bump' && value > CFG.shedKnock && !(ref && (ref.type === 'shelf' || ref.type === 'counter')) && cart.load > TUNE.loadfull * cart.mod.cap && cart.madT <= 0) {
        shed(sim, cart, 1 + Math.min(2, Math.floor((value - CFG.shedKnock) / 3)));
      }
    },
    // A crash spills the top of the tower, harder hits spill more (never above spillmax), and costs a
    // segment of Madness.
    onCrash(k, into, solid) {
      k.crashes++;
      if (k.player) sim.stats.crashes++; else sim.stats.rivalCrashes++;
      sim.emit('crash', k, into, solid);
      // The goods fan out to both sides of the way the cart glances off: getting them back takes a swerve.
      const sp = Math.hypot(k.vx, k.vz) || 1;
      if (k.madT <= 0) { spill(sim, k, clamp(into / 16, 0.15, TUNE.spillmax), k.vx / sp, k.vz / sp, true); madLose(sim, k); }
    },
    onSmash(k, solid) { smash(sim, k, solid); },
    onTopple(k, solid, into) { topple(sim, k, solid, into); },
    onKnock(k, solid) { if (k.dashT <= 0 && k.madT <= 0) { k.vx *= 0.95; k.vz *= 0.95; } sim.emit('knock', k, 0, solid); },
    // Back on the floor after a ramp. Clearing something on the way is a named trick; a hard landing
    // shakes an overloaded tower.
    onLand(k, over) {
      sim.emit('land', k, over ? 1 : 0);
      k.immuneT = Math.max(k.immuneT, 0.6);              // falling short costs the shortcut, not the goods
      if (over && !k.popped) { stunt(sim, k, 'jump', k.x, k.z); madGain(sim, k, 1); }
      k.popped = false;
      if (k.load > TUNE.loadfull * k.mod.cap && k.madT <= 0) shed(sim, k, 2);
    },
    stunt(k, name, x, z) { stunt(sim, k, name, x, z); },
    madGain(k, amount) { madGain(sim, k, amount); },
    // ---- the level objects' effects (objects.js calls these) ----
    // A wipeout: the shopper flies out of the cart, the top quarter of the tower scatters on the spot for anyone
    // to take, and a moment later the cart is back at its last checkpoint at half speed. The clock runs on.
    wipeout(k, ob) {
      if (k.wipeT > 0 || k.done) return;
      k.wipeT = CFG.wipeTime; k.wipes++;
      if (k.player) sim.stats.wipeouts++; else sim.stats.rivalWipes++;
      record(sim, k, ob, false);
      k.dashT = 0; k.drift = 0; k.driftT = 0; k.tier = 0; k.boostT = 0; k.boostMul = 1; k.turnTo = null;
      k.stunT = CFG.wipeTime; k.vx *= 0.45; k.vz *= 0.45;
      const sp = Math.hypot(k.vx, k.vz) || 1;
      if (k.madT <= 0) { spill(sim, k, 0.25, k.vx / sp, k.vz / sp, true); madLose(sim, k); }
      if (ob && ob.kind === 'chaser' && k.player) unchase(sim, k, ob);
      sim.emit('wipe', k, 0, ob);
    },
    // A pop-up tile launches the cart straight up (a boing that eats its momentum, not a throw onto the next
    // tile); the top of the tower is shaken loose.
    pop(k, ob, tx, tz) {
      let dx = k.x - tx, dz = k.z - tz, d = Math.hypot(dx, dz);
      if (d < 0.35) { const sp = Math.hypot(k.vx, k.vz) || 1; dx = -k.vx / sp; dz = -k.vz / sp; d = 1; }
      k.vx = k.vx * 0.5 + dx / d * 1.2; k.vz = k.vz * 0.5 + dz / d * 1.2; k.popT = 2.2;     // a whole wave to drive off the field
      k.drift = 0; k.driftT = 0; k.tier = 0; k.dashT = 0;
      k.air = k.airT = CFG.popTime; k.over = false; k.popped = true;
      if (k.player) sim.stats.pops++;
      record(sim, k, ob, false);
      if (k.tower.length && k.madT <= 0) shed(sim, k, k.tower.length > 8 ? 2 : 1);
      sim.emit('pop', k, 0, ob);
    },
    // A forklift or pallet jack: pushed out of its way, knocked back, the top of the tower shaken loose.
    shove(k, ob, nx, nz) {
      k.x += nx * 0.12; k.z += nz * 0.12;
      if (k.shoveT > 0) return;
      k.shoveT = 1;
      const vn = k.vx * nx + k.vz * nz;
      k.vx += (5.5 - vn) * nx; k.vz += (5.5 - vn) * nz;
      k.stunT = Math.max(k.stunT, 0.35); k.turnTo = null;
      record(sim, k, ob, false);
      if (k.tower.length && k.madT <= 0) shed(sim, k, k.tower.length > 8 ? 2 : 1);
      sim.emit('shoved', k, 0, ob);
    },
    // Boost arrows: +6 m/s over the cart's top speed for 0.8 s.
    padBoost(k, ob) {
      const top0 = TUNE.maxspeed * (1 - TUNE.loadtop * loadFactor(k)), mul = (top0 + CFG.padBoost) / top0;
      k.boostMul = k.boostT > 0 ? Math.max(k.boostMul, mul) : mul; k.boostT = Math.max(k.boostT, CFG.padTime);
      const v = Math.hypot(k.vx, k.vz), want = Math.min(v + CFG.padBoost, top0 + CFG.padBoost);
      if (v > 0.5) { k.vx *= want / v; k.vz *= want / v; } else { k.vx = ob.dx * want; k.vz = ob.dz * want; }
      sim.emit('boostpad', k, 0, ob);
    },
    watch(k, ob) { sim.timer += CFG.watchTime; sim.emit('watch', k, CFG.watchTime, ob); },
    checkpoint(k, ob) { k.cp = ob.index; sim.emit('checkpoint', k, ob.index, ob); },
    // a robot vacuum hit by a dash spins and spits out what it swept up
    spit(ob, x, z) { for (let i = 0; i < 3; i++) { const a = i * 2.1 + sim.t; scatter(sim, x, z, Math.sin(a), Math.cos(a), GOOD[['phone', 'game', 'soda'][i]], 0, 8, false); } sim.emit('vacuum', null, 0, ob); },
    // a good thrown out of a stroller onto the floor, toward (dx, dz): anyone may take it
    toss(x, z, dx, dz, good) { const l = Math.hypot(dx, dz) || 1; scatter(sim, x, z, dx / l, dz / l, good, 0, 8, false); },
  };
  const s = world.start;
  sim.player = makeCart(0, 'player', s.x, s.z, s.h);
  sim.player.home = { x: s.x, z: s.z, h: s.h };
  if (opts.up) sim.player.mod = cartMods(opts.up);        // the player's cart upgrades (Cart Customs)
  if (opts.bot) {
    sim.player.ai = makeDriver(BOTS[opts.bot]);
    if (opts.greed !== undefined) sim.player.ai.greed = opts.greed;
  }
  sim.carts.push(sim.player);
  if (!opts.alone) {
    (def.rivals || []).slice(0, Math.min(TUNE.rivals, world.slots.length)).forEach((id, i) => {
      const r = makeCart(i + 1, id, world.slots[i].x, world.slots[i].z, s.h);
      r.home = { x: world.slots[i].x, z: world.slots[i].z, h: s.h };
      r.ai = makeDriver(rivalProfile(id));
      sim.carts.push(r);
      if (id === 'granny') giveGoods(sim, r, 16, true, 2);   // Granny Tank arrives with her tower already built (at x2): a slow treasure chest
    });
    spawnCrowd(sim);
  }
  spawnTrains(sim);
  sim.events.length = 0;
  return sim;
}

// ---- Madness: one meter, four segments, and the price multiplier (GDD 5.5) ------------------------
export function multOf(k) { return k.madT > 0 ? 4 : 1 + Math.min(3, Math.floor(k.mad)); }
let gift = 0;                      // while goods are handed out for free: their multiplier (and no Madness for them)
function madGain(sim, k, amount) {
  if (k.madT > 0 || gift) return;
  const before = Math.floor(k.mad);
  k.mad = Math.min(4, k.mad + amount * TUNE.madnessfill * (k.player ? 1 : sim.def.rivalEdge || 1));   // rivalEdge: a level's own knob for how fast rivals build their multiplier
  k.madIdle = 0;
  if (k.player && before < 1 && k.mad >= 1 && sim.stats.x2At < 0) sim.stats.x2At = sim.t;
  if (k.mad >= 4) {                                  // overfilled: MADNESS mode
    k.madT = TUNE.madnesstime; k.dashKnocks = 0;
    if (k.player) sim.stats.madModes++; else sim.stats.rivalModes++;
    sim.emit('madmode', k, 1);
  } else if (Math.floor(k.mad) !== before) sim.emit('madseg', k, Math.floor(k.mad));
}
function madLose(sim, k) {
  if (k.madT > 0 || k.mad <= 0) return;
  k.mad = Math.max(0, k.mad - 1);
  sim.emit('madseg', k, Math.floor(k.mad));
}
function madTick(sim, k, dt) {
  if (k.madT > 0) {
    k.madT -= dt;
    if (k.madT <= 0) { k.mad = 1; k.madIdle = 0; sim.emit('madmode', k, 0); }   // back to x2
    return;
  }
  k.madIdle += dt;
  if (k.madIdle > CFG.madWait && k.mad > 0) {
    const before = Math.floor(k.mad);
    k.mad = Math.max(0, k.mad - CFG.madDrain * TUNE.madnessdrain * dt);
    if (Math.floor(k.mad) !== before) sim.emit('madseg', k, Math.floor(k.mad));
  }
}

// ---- Taking goods ---------------------------------------------------------------------------------
// Puts one item on the tower. Hot items stay on top (they fall first). list is 1..3 for a
// shopping-list item (worth double), else 0. The price is locked with the multiplier of this moment.
// Emits 'take' with ref = { good, x, y, z, entry } so the visuals can fly it from where it stood.
function take(sim, k, good, x, y, z, list) {
  const g = GOODS[good], mult = gift || multOf(k);
  const entry = { good, value: g.price * mult * (list ? 2 : 1), mult, list: list || 0 };
  let at = k.tower.length;
  if (g.size !== 'H') while (at > 0 && GOODS[k.tower[at - 1].good].size === 'H') at--;
  k.tower.splice(at, 0, entry);
  const before = k.load;
  k.load += g.w; k.value += entry.value;
  if (k.player) sim.stats.taken++;
  sim.emit('take', k, entry.value, { good, x, y, z, entry });
  // One item after another: each take within a second of the last adds to the chain, and a longer
  // chain fills the meter faster (up to half as much again).
  k.chain = sim.t - k.chainT < 1 ? k.chain + 1 : 0;
  k.chainT = sim.t;
  madGain(sim, k, CFG.madTake[g.size] * (1 + Math.min(k.chain, 10) * 0.05));
  const heavy = TUNE.loadfull * 0.7;
  if (before < heavy && k.load >= heavy) sim.emit('heavy', k);
  if (before <= TUNE.loadfull && k.load > TUNE.loadfull) sim.emit('overloaded', k);
}

// Test aid (debug panel, tools) and Granny's head start: n random ordinary goods straight into a cart
// (big = true: medium and large ones only), priced at the given multiplier.
export function giveGoods(sim, k, n, big, mult = 1) {
  gift = mult;
  for (let i = 0; i < n; i++) take(sim, k, big ? 7 + sim.rng.int(8) : sim.rng.int(15), k.x, 1, k.z);
  gift = 0;
}

// Sweeping and floor pickup for one cart. A shelf item is taken when the cart is on its open side
// and its centre is within cart radius + sweepgap (+ the item's inset) of it: if the side of the
// cart looks like it is at the shelf, the item is taken.
function pickups(sim, k) {
  const world = sim.world, mad = k.madT > 0;
  const mult = multOf(k);
  const reach = CFG.CART_R + (TUNE.sweepgap + k.mod.sweep) * (mad ? 2 : 1) + 0.35, reach2 = reach * reach;
  const T = CFG.TILE;
  const c0 = Math.max(0, Math.floor((k.x - reach) / T)), c1 = Math.min(world.cols - 1, Math.floor((k.x + reach) / T));
  const r0 = Math.max(0, Math.floor((k.z - reach) / T)), r1 = Math.min(world.rows - 1, Math.floor((k.z + reach) / T));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const cell = world.itemCells[r * world.cols + c];
    for (let i = 0; i < cell.length; i++) {
      const it = world.items[cell[i]];
      if (it.taken) continue;
      const dx = k.x - it.x, dz = k.z - it.z;
      if (dx * dx + dz * dz > reach2 || dx * it.nx + dz * it.nz <= 0) continue;
      if (!makeRoom(sim, k, GOODS[it.good].w, GOODS[it.good].price * mult)) continue;
      it.taken = true;
      take(sim, k, it.good, it.x, it.y, it.z);
      // Clean sweep: one cart empties a whole shelf side in one pass.
      const g = world.groups[it.group];
      if (g.by < 0) { g.by = k.id; g.t0 = sim.t; } else if (g.by !== k.id) g.mixed = true;
      g.shelf.stock--;
      if (--g.left === 0 && !g.mixed && g.total >= 6 && sim.t - g.t0 < 5) { stunt(sim, k, 'cleansweep', it.x, it.z); madGain(sim, k, 0.5); }
      if (k.player) {                             // how much of the first shelf the player took (a gate measure)
        if (sim.stats.firstGroup < 0) sim.stats.firstGroup = it.group;
        if (it.group === sim.stats.firstGroup) sim.stats.firstShelf++;
      }
    }
  }
  // Floor goods: the radius grows with speed.
  const mag = TUNE.magnet * k.mod.mag * (1 + 0.5 * Math.min(1, Math.abs(k.spd) / TUNE.maxspeed)) * (mad ? 2 : 1) + 0.3;
  for (const d of world.drops) {
    if (!d.live || d.arm > 0 || (d.list && !k.player)) continue;      // list items are the player's (and always fit)
    const dx = k.x - d.x, dz = k.z - d.z;
    if (dx * dx + dz * dz > mag * mag) continue;
    if (!d.list && !makeRoom(sim, k, GOODS[d.good].w, GOODS[d.good].price * mult)) continue;
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
// One hit never costs more than spillmax of the tower's goods, top first; list items stay in the cart.
// fan = true is a crash: the goods are thrown to both sides instead of along the direction. The loss
// is capped at spillmax of the tower's dollars too (anything dearer than that stays), with one
// exception: a ram on a rival always knocks off its top item, so a hot item can be taken from it.
// Emits 'spill' with value = goods and ref = { lost: dollars, crash }.
function spill(sim, k, share, dx, dz, fan) {
  let n = 0, lost = 0;
  const want = Math.floor(k.tower.length * Math.min(share, TUNE.spillmax)), most = k.value * TUNE.spillmax;
  for (let i = k.tower.length - 1; i >= 0 && n < want; i--) {
    const e = k.tower[i];
    if (e.list) continue;
    if ((fan || k.player || n > 0) && lost + e.value > most) continue;
    drop(sim, k, i, dx, dz, fan);
    n++; lost += e.value;
  }
  if (n > 0) { if (k.player) sim.stats.spilled += n; sim.emit('spill', k, n, { lost, crash: !!fan }); }
  return n;
}
// A rival rammed by a dash drops everything in a fountain: the goods land in a ring 2-5 m round it and anyone
// can take them for a few seconds. Emits 'fountain' with value = goods.
function fountain(sim, k) {
  let n = 0, lost = 0;
  for (let i = k.tower.length - 1; i >= 0; i--) {
    const e = k.tower[i];
    if (e.list) continue;
    k.tower.splice(i, 1);
    k.load -= GOODS[e.good].w; k.value -= e.value; lost += e.value;
    const a = n * 2.39996 + sim.rng() * 0.5, r = 2 + sim.rng() * 3;
    let tx = k.x + Math.cos(a) * r, tz = k.z + Math.sin(a) * r;
    if (blockedAt(sim.world, tx, tz, 0.35)) { tx = k.x + Math.cos(a) * 1.2; tz = k.z + Math.sin(a) * 1.2; }
    sim.world.drops.push({ x: tx, z: tz, good: e.good, ttl: TUNE.recollect, live: true, list: 0, arm: 0.6, ox: k.x, oz: k.z, born: sim.t, high: 1 });
    n++;
  }
  if (n) sim.emit('fountain', k, n, { lost });
  return n;
}
// Whether a cart passed an object or was caught by it, per rival and object (the smoke test reads it).
function record(sim, k, ob, passed) {
  if (k.player || !ob || ob.kind === 'barrier' || ob.kind === 'chaser') return;      // (the yarn ball rolling over Granny is part of the show)           // a barrier rising under a rival is the player's doing, not a miss
  const roll = k.ai && k.ai.rolls.get(ob);
  if (!passed && roll && roll.scripted) return;      // a level's scripted failure (Granny's first go at the tiles) is not a miss
  const key = k.char + ':' + sim.world.objs.indexOf(ob), p = sim.stats.passes[key] || (sim.stats.passes[key] = [0, 0]);
  p[passed ? 0 : 1]++;
  if (!passed && k.ai) k.ai.lastFail = ob;
}
// Takes tower entry i out of the cart and throws it on the floor.
function drop(sim, k, i, dx, dz, fan) {
  const e = k.tower[i];
  k.tower.splice(i, 1);
  k.load -= GOODS[e.good].w; k.value -= e.value;
  scatter(sim, k.x, k.z, dx, dz, e.good, 0, TUNE.recollect, fan);
}
// An overloaded tower lets go of its top n goods (a hard knock, a long drift, a hard landing): never
// a list item or a hot item, never more than spillmax of its dollars. Emits 'shed'.
function shed(sim, k, n) {
  let done = 0, lost = 0;
  const sp = Math.hypot(k.vx, k.vz) || 1, most = k.value * TUNE.spillmax;
  for (let i = k.tower.length - 1; i >= 0 && done < n; i--) {
    const e = k.tower[i];
    if (e.list || GOODS[e.good].size === 'H' || lost + e.value > most) continue;
    lost += e.value;
    drop(sim, k, i, -k.vx / sp, -k.vz / sp, false);        // they are left behind the cart
    done++;
  }
  if (done) { if (k.player) sim.stats.spilled += done; sim.emit('shed', k, done, { lost }); }
}
// One item thrown from (x, z) to free floor: about 3 m along (dx, dz), or out to either side of it.
function scatter(sim, x, z, dx, dz, good, list, ttl, fan) {
  const rng = sim.rng, a = rng() * 6.283, r = 0.6 + rng() * 1.7;
  let tx = x + Math.cos(a) * r + dx * 3.4, tz = z + Math.sin(a) * r + dz * 3.4;
  if (fan) {
    const side = (rng() < 0.5 ? -1 : 1) * (2 + rng() * 1.6), along = 1.5 + rng() * 3.5;
    tx = x + dx * along - dz * side; tz = z + dz * along + dx * side;
  }
  if (blockedAt(sim.world, tx, tz, 0.35)) { tx = x + dx * 1.5 + (rng() - 0.5) * 1.6; tz = z + dz * 1.5 + (rng() - 0.5) * 1.6; }
  if (blockedAt(sim.world, tx, tz, 0.35)) { tx = x + (rng() - 0.5) * 1.2; tz = z + (rng() - 0.5) * 1.2; }
  sim.world.drops.push({ x: tx, z: tz, good, ttl, live: true, list, arm: 0.55, ox: x, oz: z, born: sim.t });
}

// Room for an item of weight w worth `value` dollars. Under the cap there is always room. At the cap
// a dearer item pushes out the cheapest goods (per unit of weight) it needs the room of, if together
// they are worth less than it is; they fall behind the cart. Returns false if the item is refused.
const OUT = [];
function makeRoom(sim, k, w, value) {
  let need = k.load + w - TUNE.loadfull * k.mod.cap * TUNE.overstack;
  if (need <= 0) return true;
  if (!k.fullSaid) { k.fullSaid = true; sim.emit('full', k); }       // the cap is announced the moment it first matters
  OUT.length = 0;
  let sum = 0;
  while (need > 0) {
    let best = -1, rate = 1e9;
    for (let i = 0; i < k.tower.length; i++) {
      const e = k.tower[i], g = GOODS[e.good];
      if (e.list || OUT.includes(i) || e.value / g.w >= rate) continue;
      rate = e.value / g.w; best = i;
    }
    if (best >= 0) { OUT.push(best); sum += k.tower[best].value; need -= GOODS[k.tower[best].good].w; }
    if (best < 0 || sum >= value) return false;
  }
  OUT.sort((a, b) => b - a);
  const sp = Math.hypot(k.vx, k.vz) || 1;
  for (const i of OUT) drop(sim, k, i, -k.vx / sp, -k.vz / sp, false);
  sim.emit('swap', k, OUT.length, { lost: sum });
  return true;
}

// ---- The dash: one action, many targets (GDD 5.4) -------------------------------------------------
// A dashing cart (or one in MADNESS mode) drove into a breakable piece. cart.js has already switched
// the piece's collider off.
function smash(sim, k, solid) {
  const p = solid.piece, sp = Math.hypot(k.vx, k.vz) || 1, ux = k.vx / sp, uz = k.vz / sp;
  k.dashHits++;
  if (solid.type === 'podium' || solid.type === 'case') {     // through the ribbon (or the glass): the hot item jumps into the cart
    if (solid.type === 'case') { stunt(sim, k, 'glass', p.x, p.z); sim.emit('glass', k, 0, p); }
    if (p.good >= 0) { take(sim, k, p.good, p.x, 1, p.z); p.good = -1; madGain(sim, k, 0.5); sim.emit('hot', k, 0, p); }
  } else if (solid.type === 'glass') {              // the window shatters and the short way is open to everyone
    sim.world.block[p.r * sim.world.cols + p.c] = 0;
    navBuild(sim.world);
    stunt(sim, k, 'glass', p.x, p.z);
    madGain(sim, k, 0.4);
    sim.emit('glass', k, 0, p);
  } else if (solid.type === 'pyramid' || solid.type === 'mega') {     // every can comes down: money per can, a third become goods
    cans(sim, k, p, p.cans, ux, uz);
    p.cans = 0;
    stunt(sim, k, 'smash', p.x, p.z);
    madGain(sim, k, solid.type === 'mega' ? 2 : 0.35);
    sim.emit('smash', k, solid.type === 'mega' ? 2 : 1, p);
  } else {                                           // gift pile, cardboard stand: a burst of goods
    const pool = POOLS.market, n = solid.type === 'gifts' ? 4 : 3;
    for (let i = 0; i < n; i++) scatter(sim, p.x, p.z, ux, uz, GOOD[sim.rng.pick(solid.type === 'gifts' ? pool.M : pool.S)], 0, 9);
    stunt(sim, k, 'smash', p.x, p.z);
    madGain(sim, k, 0.35);
    sim.emit('smash', k, n, p);
  }
}
// n cans of a pyramid come down: in SMASH each pays its price times the multiplier; about 30% become goods.
function cans(sim, k, p, n, ux, uz) {
  const gold = p.type === 'mega', price = gold ? CFG.megaCan : CFG.canPrice;
  if (sim.mode === 'smash' && k.player) { k.smash += n * price * multOf(k); sim.stats.cans += n; }
  else if (sim.mode === 'smash') k.smash += n * price * multOf(k);
  for (let i = 0; i < Math.round(n * 0.3); i++) scatter(sim, p.x, p.z, ux, uz, GOOD.can, 0, 9);
  if (n) sim.emit('cans', k, n * price * (sim.mode === 'smash' ? multOf(k) : 0), p);
}
// A slow hit on a pyramid topples a third of it; the rest stands. A pyramid with nothing left is gone.
function topple(sim, k, solid, into) {
  const p = solid.piece;
  if (!p || !(p.type === 'pyramid' || p.type === 'mega') || p.cans <= 0 || k.toppleT > sim.t) return;
  k.toppleT = sim.t + 0.4;
  const n = Math.min(p.cans, Math.ceil(p.full / 3)), sp = Math.hypot(k.vx, k.vz) || 1;
  cans(sim, k, p, n, k.vx / sp, k.vz / sp);
  p.cans -= n;
  if (p.cans <= 0) { solid.on = false; p.alive = false; sim.world.block[p.r * sim.world.cols + p.c] = 0; navBuild(sim.world); }
  sim.emit('topple', k, n, p);
  void into;
}

// A dashing cart `a` hit cart `b` (nx, nz points from a to b): b spins, drops the top of its tower
// and remembers who did it. Granny Tank only gives way to a heavy or boosted cart.
function ram(sim, a, b, nx, nz) {
  if (b.immuneT > 0 || b.done || a.ramCd > 0) return;
  if (b.player && a.ai && !(a.ai.strikeT > 0)) return;   // a rival's ram on the player counts only if it was announced
  if (b.player && a.ai) a.ai.hit = true;
  a.ramCd = 0.5; a.dashHits++;
  b.vx += nx * 6; b.vz += nz * 6;
  b.stunT = b.player ? 0.6 : 1; b.spinT = b.stunT; b.turnTo = null;
  b.immuneT = TUNE.immunity + b.stunT;
  b.ramT = 1.3; b.rammedBy = a; b.grudge = a; b.grudgeT = 5;
  if (a.player && !b.player) fountain(sim, b);       // a rival rammed by the player's dash drops everything
  else if (b.madT <= 0) spill(sim, b, TUNE.ramdrop * (b.player ? 1 : 0.5), nx, nz);   // the player loses the top 30%; rivals jostling each other half that
  if (b.madT <= 0) madLose(sim, b);
  stunt(sim, a, 'ram', b.x, b.z);
  madGain(sim, a, 1);
  if (b.player) sim.stats.rammed++; else if (!a.player) sim.stats.rivalRams++;
  sim.emit('ram', a, 0, b);
}

// ---- Checkout and the final table -----------------------------------------------------------------
// The fourth invisible helper: a cart driving at an open checkout from within 7 m is eased onto the
// lane's centre line and straightened, and one that has ended up at the counters beside an open lane
// (within 2.5 m of them) is drawn sideways into it at any speed, like a ball into a pocket: nobody's
// run ends on the corner of a counter.
function funnel(world, k, dt) {
  for (const l of world.lanes) {
    if (!l.open) continue;
    const b = l.bar, deep = b.hz >= b.hx;                // deep: the lane runs along z
    const along = deep ? l.z - k.z : l.x - k.x, side = deep ? k.x - l.x : k.z - l.z, out = Math.abs(along) - (deep ? b.hz : b.hx);
    const toward = (deep ? k.vz : k.vx) * Math.sign(along), near = out < 2.5 && toward > -1, turn = near ? 2 : 0.9;
    if (out > 7 || out < -0.5 || Math.abs(side) > (near ? 4.4 : 2.4) || !(near || toward >= 3)) continue;
    const pull = near ? clamp(side * 2.5, -3, 3) * dt : side * Math.min(1, dt * 3.5 * (1 - out / 9));
    if (deep) k.x -= pull; else k.z -= pull;
    k.h += clamp(wrapAngle((deep ? (along > 0 ? 0 : Math.PI) : (along > 0 ? 1 : -1) * Math.PI / 2) - k.h) * 2.5, -turn, turn) * dt;
    return;
  }
}

// The receipt (DESIGN.md section 2): ITEMS (prices already carry their multipliers), SMASH in SMASH mode,
// STUNTS, TIME (dollars per second left), TOTAL.
function checkout(sim, k, lane) {
  k.done = true; k.doneT = sim.t; k.lane = lane;
  let items = 0;
  for (const e of k.tower) items += e.value;
  const left = Math.max(0, Math.floor(sim.timer - sim.t)), smash = sim.mode === 'smash' ? Math.round(k.smash) : 0;
  const badge = sim.mode === 'smash' && k.player && sim.stats.cans === 0 ? 'CLEAN SWEEP' : '';      // through a SMASH store without touching a can
  k.receipt = { mode: sim.mode, badge, items, smash, stunts: k.stunts, time: left * TUNE.timebonus, left, count: k.tower.length,
    total: items + smash + k.stunts + left * TUNE.timebonus };
  sim.emit('finish', k, k.receipt.total);
  if (k.player) sim.phase = 'done';
}

// After the player has checked out (or time is up) the rest of the race is played to its end at
// once, so the rivals' receipts in the table come from the real rules. Returns the table: carts
// ordered by receipt, those who never reached a checkout last.
export function settle(sim) {
  let guard = Math.ceil((sim.timer - sim.t + 1) / CFG.STEP);
  while (guard-- > 0 && sim.t < sim.timer && sim.carts.some((k) => !k.done)) { stepSim(sim); sim.events.length = 0; }
  sim.table = [...sim.carts].sort((a, b) => (b.receipt ? b.receipt.total : -1) - (a.receipt ? a.receipt.total : -1));
  sim.table.forEach((k, i) => { k.place = i + 1; });
  return sim.table;
}

// ---- Events: doors open and closing time ------------------------------------------------------------
function rocketStart(sim, k) {
  k.rocket = true;
  k.boostMul = 1 + (TUNE.turbopower - 1) * 0.5; k.boostT = 0.9;
  sim.emit('rocket', k);
}
function events(sim) {
  const p = sim.player, left = sim.timer - sim.t;
  // DOORS OPEN: pressing the accelerator right on GO (not holding it early) is a rocket start.
  if (sim.phase === 'run' && sim.t < 0.25 && !p.rocket && p.input.gas > 0 && p.gasAt > -0.15) rocketStart(sim, p);
  // CLOSING TIME: the last seconds on the clock (the music speeds up, the lights warm); it can end when a
  // stopwatch buys time back.
  const closing = left <= (sim.def.closing || CFG.closingTime);
  if (closing && !sim.closing) { sim.closing = true; sim.closeT = sim.t; sim.emit('closing', p); }
  else if (!closing && sim.closing) sim.closing = false;
}

// ---- The step -------------------------------------------------------------------------------------
export function stepSim(sim) {
  const dt = CFG.STEP, world = sim.world, p = sim.player;
  sim.tick++;
  sim.t += dt;
  // When the accelerator last went down (for the rocket start).
  const gas = p.input.gas > 0;
  if (gas && !p.gasWas) p.gasAt = sim.t;
  p.gasWas = gas;
  if (sim.phase === 'count') {
    if (sim.t < 0) {
      for (const k of sim.carts) { k.px = k.x; k.pz = k.z; k.ph = k.h; }
      return;
    }
    sim.phase = 'run';
    sim.emit('go', p);
    for (const k of sim.carts) if (k.ai && k.ai.prof.rival && sim.rng() < k.def.skill * 0.6) rocketStart(sim, k);
  }
  const racing = sim.phase === 'run' || sim.phase === 'done';
  if (sim.ramCool > 0) sim.ramCool -= dt;
  for (const k of sim.carts) {
    if (k.done && sim.t - k.doneT > 1) { k.px = k.x; k.pz = k.z; k.ph = k.h; k.vx = k.vz = 0; k.spd = 0; continue; }   // checked out and gone
    if (k.wipeT > 0 && (k.wipeT -= dt) <= 0) respawn(sim, k);
    if (k.shoveT > 0) k.shoveT -= dt;
    if (k.ai && k.wipeT <= 0) drive(sim, k, dt);
    if (k.wipeT > 0) { k.input.gas = 0; k.input.brake = 0; k.input.steer = 0; k.input.drift = false; k.input.dash = false; }
    if (!racing || k.done) {                         // parked: no pedals, roll to a stop
      k.input.gas = 0; k.input.brake = 0; k.input.steer = 0; k.input.drift = false; k.input.dash = false;
      if (k.done) { k.vx *= 0.94; k.vz *= 0.94; }
    }
    stepCart(k, k.input, sim, dt);
    if (racing && k.air <= 0 && k.stunT <= 0) funnel(world, k, dt);
    if (k.ramCd > 0) k.ramCd -= dt;
    if (k.grudgeT > 0) k.grudgeT -= dt;
    if (k.spinT > 0) k.spinT -= dt;
    if (k.ramT > 0) {                                // just rammed: hitting anything now is a TAKEDOWN for the rammer
      k.ramT -= dt;
      if (k.wallT > 0.115 && !k.down) { k.down = true; stunt(sim, k.rammedBy, 'takedown', k.x, k.z); madGain(sim, k.rammedBy, 0.8); }
      if (k.ramT <= 0) k.down = false;
    }
  }
  bumpCarts(sim);
  if (racing) { stepObjects(sim, dt); zones(sim); stepCrowd(sim, dt); stepTrains(sim, dt); }

  // Spilled goods wait a moment before they can be taken, then time out.
  for (const d of world.drops) {
    if (!d.live) continue;
    if (d.arm > 0) d.arm -= dt;
    const bi = Math.floor(d.z / CFG.TILE) * world.cols + Math.floor(d.x / CFG.TILE), b = world.belt[bi];
    if (b && d.arm <= 0) {
      const nx = d.x + (b === 1 ? CFG.beltSpeed : b === 3 ? -CFG.beltSpeed : 0) * dt, nz = d.z + (b === 2 ? CFG.beltSpeed : b === 4 ? -CFG.beltSpeed : 0) * dt;
      if (world.belt[Math.floor(nz / CFG.TILE) * world.cols + Math.floor(nx / CFG.TILE)]) { d.x = nx; d.z = nz; }
      else if (d.home) { d.x = d.home[0]; d.z = d.home[1]; }        // off the end: back to the start of the belt (a new pack)
    }
    if (d.ttl > 0) { d.ttl -= dt; if (d.ttl <= 0) { d.live = false; sim.emit('gone', null, 0, d); } }
  }
  if (world.drops.length > 160 && sim.tick % 240 === 0) world.drops = world.drops.filter((d) => d.live);

  for (const k of sim.carts) {
    if (k.done) continue;
    k.prog = world.navStart - navDistAt(world, k.x, k.z);
    if (!racing) continue;
    madTick(sim, k, dt);
    if (k.air <= 0 && k.stunT <= 0 && k.wipeT <= 0) pickups(sim, k);
    // An overloaded tower cannot take a long drift: past the second spark tier it sheds one item after another.
    if (k.drift && k.tier >= 2 && k.load > TUNE.loadfull && k.madT <= 0) {
      k.shedT -= dt;
      if (k.shedT <= 0) { k.shedT = 0.25; shed(sim, k, 1); }
    } else k.shedT = 0;
    const c = Math.floor(k.x / CFG.TILE), r = Math.floor(k.z / CFG.TILE);
    const lane = c >= 0 && r >= 0 && c < world.cols && r < world.rows ? world.laneOf[r * world.cols + c] : -1;
    if (lane >= 0 && world.lanes[lane].open) checkout(sim, k, lane);
  }
  if (racing) events(sim);

  if (sim.phase === 'run') {
    const st = sim.stats;
    if (Math.abs(p.spd) < 1) st.zeroT += dt;
    if (p.stunT > 0) { st.lostNow += dt; st.lostMax = Math.max(st.lostMax, st.lostNow); } else st.lostNow = 0;   // control taken away (a jump is the player's own choice)
    if (sim.tick % 30 === 0) {                       // the player's place if everybody still out there checked out right now
      const bonus = Math.max(0, Math.floor(sim.timer - sim.t)) * TUNE.timebonus;
      let place = 1, mine = p.value + p.stunts + bonus, have = 0;
      for (const e of p.tower) if (e.list) have |= 1 << e.list;
      if (have === 14) mine += CFG.listBonus;
      for (const k of sim.carts) if (k !== p && (k.receipt ? k.receipt.total : k.value + k.stunts + bonus) > mine) place++;
      p.place = place;
    }
    if (sim.t >= sim.timer) { sim.phase = 'closed'; sim.emit('timeup', p); }
  } else if (sim.phase === 'done' && sim.t >= sim.timer) {
    for (const k of sim.carts) k.done = true;        // the store has closed on whoever is still out there
  }
}

// A rival that leaves a hazard's area without having been caught by it has passed it (the smoke test counts).
function zones(sim) {
  if (!sim.world.objs.length || sim.tick % 6) return;
  for (const k of sim.carts) {
    if (k.player || k.done) continue;
    const inside = k.zone || (k.zone = new Set());
    for (const ob of sim.world.objs) {
      if (ob.fx !== 'wipe' && ob.fx !== 'push') continue;
      const now = k.wipeT <= 0 && inZone(ob, k.x, k.z, 0.6);
      if (now) inside.add(ob);
      else if (inside.has(ob)) { inside.delete(ob); if (k.ai && k.ai.lastFail !== ob) record(sim, k, ob, true); if (k.ai && k.ai.lastFail === ob) k.ai.lastFail = null; }
    }
  }
}

// Caught by the yarn ball: the treasure goes back on its pedestal and the ball back to its start.
function unchase(sim, k, ob) {
  const q = sim.world.pieces.find((p) => p.type === 'podium' && p.good < 0 && p.hot >= 0);
  for (let i = k.tower.length - 1; i >= 0; i--) if (q && k.tower[i].good === q.hot) { const e = k.tower[i]; k.tower.splice(i, 1); k.load -= GOODS[e.good].w; k.value -= e.value; break; }
  if (q) { q.good = q.hot; q.solid.on = true; sim.world.block[q.r * sim.world.cols + q.c] = 1; navBuild(sim.world); }
  ob.active = false; ob.done = false; ob.x = ob.sx; ob.z = ob.sz;
  sim.emit('chaser', null, 0, ob);
}

// Back at the last checkpoint passed (or where the cart started), facing along the route, at half speed, with
// what is left of its tower and a moment of immunity.
function respawn(sim, k) {
  const cp = k.cp >= 0 ? sim.world.checkpoints[k.cp] : null, side = (k.id % 3 - 1) * 1.1;
  const x = cp ? cp.x + cp.dx * 1.4 + cp.ax * side : k.home.x, z = cp ? cp.z + cp.dz * 1.4 + cp.az * side : k.home.z, h = cp ? cp.h : k.home.h;
  k.x = k.px = x; k.z = k.pz = z; k.h = k.ph = h;
  const v = TUNE.maxspeed * 0.5;
  k.vx = Math.sin(h) * v; k.vz = Math.cos(h) * v; k.spd = v; k.avx = k.vx; k.avz = k.vz;
  k.wipeT = 0; k.stunT = 0; k.air = 0; k.slip = 0; k.yaw = 0; k.steer = 0; k.wallT = 0; k.turnTo = null;
  k.immuneT = CFG.respawnImmune;
  if (k.ai) { k.ai.stuckT = 0; k.ai.backT = 0; k.ai.progT = 0; }
  sim.emit('respawn', k, 0, cp);
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

// Carts are two circles each (nose and tail). A heavier cart shoves a lighter one; nobody drops
// anything from a plain bump. A cart that is dashing (or in MADNESS mode) rams instead.
const PART = [[CFG.noseAt, CFG.noseR], [CFG.tailAt, CFG.tailR]];
function bumpCarts(sim) {
  const carts = sim.carts;
  for (let i = 0; i < carts.length; i++) for (let j = i + 1; j < carts.length; j++) {
    const a = carts[i], b = carts[j];
    if (a.air > 0 || b.air > 0 || a.done || b.done || a.wipeT > 0 || b.wipeT > 0) continue;
    if (Math.abs(b.x - a.x) > 3.2 || Math.abs(b.z - a.z) > 3.2) continue;
    // the deepest overlap among the four pairs of circles; the player's own dash reaches a little further
    const reach = (a.player && a.dashT > 0) || (b.player && b.dashT > 0) ? CFG.dashReach : 0;
    let over = 0, nx = 0, nz = 0;
    for (const [pa, ra] of PART) for (const [pb, rb] of PART) {
      const dx = b.x + Math.sin(b.h) * pb - a.x - Math.sin(a.h) * pa, dz = b.z + Math.cos(b.h) * pb - a.z - Math.cos(a.h) * pa;
      const d = Math.hypot(dx, dz);
      if (ra + rb + reach - d > over && d > 1e-6) { over = ra + rb + reach - d; nx = dx / d; nz = dz / d; }
    }
    if (over <= 0) continue;
    const hitA = a.dashT > 0 || a.madT > 0, hitB = b.dashT > 0 || b.madT > 0;
    if (hitA && !hitB) ram(sim, a, b, nx, nz); else if (hitB && !hitA) ram(sim, b, a, -nx, -nz);
    over -= reach;
    if (over <= 0) continue;
    const ma = (1 + Math.min(1, a.load / TUNE.loadfull)) * (a.def.mass || 1), mb = (1 + Math.min(1, b.load / TUNE.loadfull)) * (b.def.mass || 1);
    const push = over / (ma + mb);
    a.x -= nx * push * mb; a.z -= nz * push * mb;
    b.x += nx * push * ma; b.z += nz * push * ma;
    const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (vn >= 0) continue;
    const imp = -(1 + 0.3) * vn / (1 / ma + 1 / mb);
    a.vx -= imp / ma * nx; a.vz -= imp / ma * nz;
    b.vx += imp / mb * nx; b.vz += imp / mb * nz;
    if (-vn > 2) { sim.stats.bumps++; sim.emit('cartbump', a, -vn, b); }
    // a plain bump at speed knocks the top goods off a rival (the one that was hit harder: the lighter)
    if (-vn > CFG.bumpKnock && !hitA && !hitB) {
      const v = ma <= mb ? a : b;
      if (!v.player && v.tower.length && v.madT <= 0 && !(v.bumpT > sim.t)) { v.bumpT = sim.t + 0.6; shed(sim, v, -vn > CFG.bumpKnock + 3 ? 2 : 1); }
    }
  }
}
