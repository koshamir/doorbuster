// DOORBUSTER — ai.js
// Purpose: everything that drives itself. One driver steers every rival and, in bot modes (beginner,
//          confident, expert, sloppy), the player's cart for tests, balancing and autoplay; it only
//          fills the same input structure the keyboard fills, so bots and rivals obey the same cart
//          model. Also the crowd: shoppers on foot who stroll, dodge, get bowled over and get up,
//          and the cart train that shuttles along its track.
// Exports: BOTS, rivalProfile, makeDriver, drive, inZone, spawnCrowd, stepCrowd, spawnTrains, stepTrains
// Depends on: config.js, world.js. No DOM, no THREE.

import { TUNE, CFG, GOODS, GOOD, CHARS, CROWD_MIX, clamp, wrapAngle } from './config.js';
import { navAim, navDistAt, clearPath, collide, blockedAt, fieldFrom } from './world.js';
import { switchField, hazardsOn, passDelay, freeField, objExtent, patrolAt } from './objects.js';
import { loadFactor } from './cart.js';

// pace = share of top speed, hz = decisions per second, noise = steering error (rad),
// drift / dash = how readily the driver uses them (0..1), look = tiles of path it looks along,
// greed = how far it leaves its line for goods (0 = never), fill = load (share of a full cart) at
// which it stops collecting, clock = whether it gives up collecting when time runs short,
// brakes = how readily it slows for whatever is straight ahead of the cart (0 = never),
// aggro = appetite for ramming carts that carry loot, judge = the chance of timing a hazard right (LEVELS.md
// section 4: a miss is a visible, comic wipeout).
export const BOTS = {
  beginner:  { pace: 0.72, hz: 6,  noise: 0.22, drift: 0,   dash: 0.2, look: 5, greed: 0.35, fill: 1.0, clock: false, brakes: 0.5, aggro: 0.1, judge: 0.8 },
  confident: { pace: 0.92, hz: 12, noise: 0.08, drift: 0.5, dash: 0.7, look: 7, greed: 0.8, fill: 1.2, clock: true, brakes: 1, aggro: 0.5, judge: 0.93 },
  expert:    { pace: 1,    hz: 30, noise: 0,    drift: 1,   dash: 1,   look: 8, greed: 1,   fill: 1.5, clock: true, brakes: 1, aggro: 0.9, judge: 1 },
  sloppy:    { pace: 1,    hz: 8,  noise: 0.3,  drift: 1,   dash: 1,   look: 4, greed: 1,   fill: 1.5, clock: false, brakes: 0, aggro: 0.6, judge: 0.4 },   // fast and careless, for tower tests
};
// How well each rival times a hazard (DESIGN.md section 5: 80-97%).
const JUDGE = { granny: 0.8, dad: 0.97, queen: 0.88, selfie: 0.85, bro: 0.85, gramps: 0.96 };

// A rival's driver comes from its character (config.js CHARS) and the two rival tune values.
export function rivalProfile(id) {
  const c = CHARS[id], skill = clamp(c.skill * TUNE.rivalskill, 0.2, 1);
  return { rival: true, char: id, pace: c.pace, hz: 6 + Math.round(skill * 14), noise: (1 - skill) * 0.3, drift: skill > 0.75 ? 0.7 : 0,
    dash: 0.4 + skill * 0.6, look: 5 + Math.round(skill * 3), greed: c.greed, fill: 1.5,
    clock: true, brakes: skill, aggro: c.aggro * TUNE.rivalaggro, judge: JUDGE[id] || 0.85 };
}

export function makeDriver(prof) {
  return { prof, greed: prof.greed, g: prof.greed, next: 0, wobble: 0, drifting: false, driftT: 0, stuckT: 0, backT: 0, backSteer: 1, stuck: 0,
    err: 0, turnAt: -9, warnT: 0, strikeT: 0, aimH: 0, hit: false, hold: false, victim: null, mean: false, selfT: 6, photoT: 0, mood: 0, moodT: 0, wants: new Map(), shout: null,
    progAt: 0, progT: 0, rolls: new Map(), fails: new Set(), commit: new Map() };
}

const aim = { x: 0, z: 0, fx: 0, fz: 0, left: 0 };
const goal = { x: 0, z: 0, score: 0, list: false };
const mark = { x: 0, z: 0, score: 0, cart: null, piece: null, lined: true };

// Scores one candidate pickup at approach point (x, z); keeps the best in `goal`.
function consider(k, fx, fz, range, wide, x, z, price) {
  const dx = x - k.x, dz = z - k.z;
  const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
  if (ahead < 0.6 || ahead > range || side > wide + ahead * 0.25) return;
  const score = price / (ahead + 2.5 * side + 1.5);
  if (score > goal.score) { goal.score = score; goal.x = x; goal.z = z; }
}

// Looks for goods worth leaving the line for. Returns true and fills `goal` with a point to drive at.
function findGoods(sim, k, ai) {
  const world = sim.world, p = ai.prof;
  if (ai.g <= 0) return false;
  if (p.clock && aim.left / (TUNE.maxspeed * p.pace * 0.75) > sim.timer - sim.t - 3) return false;
  // A cart filled to the driver's taste only wants goods clearly dearer (per unit of weight, at the
  // multiplier of the moment) than the cheapest thing it carries: at the cap those push the cheap ones out.
  const full = k.load >= TUNE.loadfull * p.fill, mult = k.madT > 0 ? 4 : 1 + Math.min(3, Math.floor(k.mad));
  let floor = 0;
  if (full) { floor = 1e9; for (const e of k.tower) if (!e.list) floor = Math.min(floor, e.value / GOODS[e.good].w); floor *= 1.3; }
  const worth = (good) => !full || GOODS[good].price * mult / GOODS[good].w > floor;
  // "Ahead" is along the route, not along the nose: a cart that has turned for one shelf must not
  // see the shelves behind it as ahead (that way it would shop in circles).
  let fx = aim.x - k.x, fz = aim.z - k.z;
  const fl = Math.hypot(fx, fz);
  if (fl > 0.5) { fx /= fl; fz /= fl; } else { fx = Math.sin(k.h); fz = Math.cos(k.h); }
  const range = 5 + 11 * ai.g, wide = 1 + 4 * ai.g, off = CFG.CART_R + 0.5;
  const here = navDistAt(world, k.x, k.z);
  goal.score = 0; goal.list = false;
  let shelf = null;
  for (const it of world.items) {
    if (it.taken || !worth(it.good)) continue;
    const before = goal.score;
    consider(k, fx, fz, range, wide, it.x + it.nx * off, it.z + it.nz * off, GOODS[it.good].price * 1.5);
    if (goal.score > before) { shelf = it; goal.list = false; }
  }
  for (const d of world.drops) {
    if (!d.live || (d.list ? !k.player : !worth(d.good))) continue;
    const before = goal.score;
    consider(k, fx, fz, d.list ? 18 : range, d.list ? 6 : wide, d.x, d.z, d.list ? 400 : GOODS[d.good].price);   // a list item glows: seen from afar
    if (goal.score > before) { shelf = null; goal.list = !!d.list; }
  }
  if (k.player) for (const ob of world.objs) {
    if (ob.kind !== 'watch' || ob.taken) continue;
    const before = goal.score;
    consider(k, fx, fz, 20, 6, ob.x, ob.z, 400);
    if (goal.score > before) { shelf = null; goal.list = true; }      // (as keen as on a list item)
  }
  if (goal.score <= 0.4 || navDistAt(world, goal.x, goal.z) > here + 1) return false;
  // goods on a turnstile's arms, under a laser's sweep or on sliding panels are the player's greed: drivers leave them
  for (const ob of world.objs) if ((ob.kind === 'turnstile' || ob.kind === 'laser' || ob.kind === 'panels') && inZone(ob, goal.x, goal.z, 0.6)) return false;
  if (shelf) {
    // Run parallel to the shelf: push the aim point along the shelf in the direction of travel.
    let tx = -shelf.nz, tz = shelf.nx;
    if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
    const ahead = (goal.x - k.x) * fx + (goal.z - k.z) * fz;
    if (ahead < 3.5) { goal.x += tx * (3.5 - ahead); goal.z += tz * (3.5 - ahead); }
  }
  return clearPath(world, k.x, k.z, goal.x, goal.z, CFG.CART_R - 0.12);
}

// Looks for something to dash into: a breakable piece or a cart with loot. Fills `mark`.
function findTarget(sim, k, ai) {
  const world = sim.world, p = ai.prof, fx = Math.sin(k.h), fz = Math.cos(k.h);
  const here = navDistAt(world, k.x, k.z);
  mark.score = 0; mark.cart = null; mark.piece = null;
  const see = (x, z, range, value) => {
    const dx = x - k.x, dz = z - k.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (ahead < 1.5 || ahead > range || side > 1.6 + ahead * 0.3) return false;
    const score = value / (ahead + 2 * side + 2);
    if (score <= mark.score) return false;
    mark.score = score; mark.x = x; mark.z = z;
    return true;
  };
  for (const q of world.pieces) {
    const hot = q.type === 'podium' || q.type === 'case';
    if (!q.solid.on || !q.solid.dash || (hot && p.rival && p.char !== 'queen')) continue;
    if (hot && q.good < 0) continue;
    if (q.sale && p.rival && sim.sale && sim.sale.t > 7) continue;   // the first three seconds of a flash sale are the player's
    if (navDistAt(world, q.x, q.z) > here + 3) continue;
    // Whether to go for a piece is decided once, on first sight: a driver that passes on it steers round it.
    if (!ai.wants.has(q)) ai.wants.set(q, sim.rng() < (hot ? 0.5 + p.dash * 0.5 : p.dash));
    if (!ai.wants.get(q)) continue;
    const cans = sim.mode === 'smash' && (q.type === 'pyramid' || q.type === 'mega');
    if (see(q.x, q.z, hot ? (p.char === 'queen' ? 44 : 26) : cans ? 24 : 13, hot ? (p.char === 'queen' ? 30 : 8) : cans ? 9 : 1.5)) { mark.piece = q; mark.cart = null; }
  }
  // A huddle of shoppers is a set of bowling pins: a dash through the middle is a STRIKE. The driver
  // lines up first: until the cart is on the huddle's axis it aims at a point 5 m short of the head pin.
  mark.lined = true;
  for (const g of world.huddles) {
    if (!g.on || navDistAt(world, g.x, g.z) > here + 3) continue;
    if (!ai.wants.has(g)) ai.wants.set(g, sim.rng() < p.dash * 0.8);
    if (!ai.wants.get(g)) continue;
    const off = Math.abs((k.x - g.x) * g.dz - (k.z - g.z) * g.dx), back = (g.x - k.x) * g.dx + (g.z - k.z) * g.dz, lined = off < 1.1 || back < 2.5;
    const short = lined ? 0 : Math.min(5, back);
    if (see(g.x - g.dx * short, g.z - g.dz * short, 16, 2.5)) { mark.piece = g; mark.cart = null; mark.lined = lined; }
  }
  // A victim: loot to knock off, not immune, and the mood for it (a grudge makes the mood).
  if (ai.mood > 0) for (const b of sim.carts) {
    if (b === k || b.done || b.immuneT > 0) continue;
    const grudge = k.grudge === b && k.grudgeT > 0;
    if (b.tower.length < (grudge ? 1 : 5)) continue;
    // The player is left alone for the first seconds, is rammed a limited number of times per run and
    // never twice in a row.
    if (b.player && (sim.t < 8 || !ai.mean && !grudge || sim.stats.rammed >= (sim.def.maxRams || 3) || (sim.ramCool > 0 && ai.victim !== b))) continue;
    if (see(b.x, b.z, 9, grudge ? 9 : 3)) { mark.cart = b; mark.piece = null; mark.lined = true; }
  }
  if (mark.score <= 0.12) return false;
  // It must be reachable in a straight line (up to the piece's own edge).
  const dx = mark.x - k.x, dz = mark.z - k.z, d = Math.hypot(dx, dz), stop = mark.piece ? Math.max(0, d - 1.7) / d : 1;
  if (!clearPath(world, k.x, k.z, k.x + dx * stop, k.z + dz * stop, CFG.CART_R - 0.1)) return false;
  return true;
}

// Half a second of backing away from what is at the nose with the wheel over, or, if the thing is
// behind or backing has just been tried, of pushing forward at full lock (a cart can pivot on the spot).
function unstick(sim, k, ai, err) {
  const atNose = -(Math.sin(k.h) * k.wnx + Math.cos(k.h) * k.wnz) > 0.2 || k.wallT <= 0;
  if (atNose && sim.t - ai.turnAt > 1.2) { ai.backT = 0.5; ai.backSteer = -Math.sign(err); } else { ai.backT = -0.5; ai.backSteer = Math.sign(err); }
  ai.turnAt = sim.t;
}

export function drive(sim, k, dt) {
  const ai = k.ai, p = ai.prof, inp = k.input, world = sim.world;
  if (sim.phase !== 'run' && !(sim.phase === 'done' && !k.player) || k.done) { inp.gas = 0; inp.brake = 0; inp.steer = 0; inp.drift = false; return; }

  // A ram aimed at the player is announced (CFG.ramWarn seconds, "!") and committed: the rival holds
  // the line it announced, then lunges down it. Steering off that line dodges it, and a dodge pays.
  // Only a dash that was announced can knock goods off the player (sim.js checks strikeT).
  if (ai.strikeT > 0 && (ai.strikeT -= dt) <= 0 && !ai.hit && Math.hypot(sim.player.x - k.x, sim.player.z - k.z) < 7) {
    sim.stunt(sim.player, 'dodge', sim.player.x, sim.player.z); sim.madGain(sim.player, 0.5);
  }
  if (ai.warnT > 0) {
    ai.warnT -= dt;
    inp.steer = clamp(wrapAngle(ai.aimH - k.h) * 4, -1, 1); inp.gas = 1; inp.brake = 0; inp.drift = false;
    if (ai.warnT <= 0) {
      const b = ai.victim;
      if (b && !b.done && Math.hypot(b.x - k.x, b.z - k.z) < 9) { inp.dash = true; ai.strikeT = 0.6; ai.hit = false; }
      ai.victim = null;
    }
    return;
  }
  // Selfie Star stops dead for a photo now and then: a flash a second ahead, then 1.4 s at a standstill
  // while the shoppers who can see her run over to be in the picture.
  if (p.char === 'selfie') {
    if (ai.photoT > 0) {
      ai.photoT -= dt;
      if (ai.photoT < 1.4) { inp.gas = 0; inp.brake = k.spd > 0.5 ? 1 : 0; inp.steer = 0; inp.drift = false; return; }
    } else if ((ai.selfT -= dt) <= 0 && k.spd > 6 && sim.t > 8) {
      ai.selfT = 9 + sim.rng() * 6; ai.photoT = 2.4;
      sim.emit('selfie', k); sim.stunt(k, 'selfie', k.x, k.z);     // a sponsored post: the photo pays her
      for (const s of sim.shoppers) {
        if (s.state !== 0 || s.busy || Math.hypot(s.x - k.x, s.z - k.z) > 14 || !clearPath(world, s.x, s.z, k.x, k.z, 0.3)) continue;
        const a = sim.rng() * 6.283;
        s.state = 4; s.rush = true; s.tx = k.x + Math.sin(k.h) * 7 + Math.cos(a) * 2.2; s.tz = k.z + Math.cos(k.h) * 7 + Math.sin(a) * 2.2;
      }
    }
  }
  // The smart barriers: a player's bot whose way is clearly shorter through the barriers dashes to flip one that is
  // up in its way (never so that one rises under it).
  // The dash is also a burst of speed: with a wipe hazard just behind the barrier it waits until the burst would
  // carry the cart through a clear window (and slows for the barrier meanwhile).
  ai.holdFlip = false;
  if (k.player && world.barriers.length && k.dashCd <= 0 && k.air <= 0 && k.stunT <= 0) {
    const free = freeField(world);
    if (navDistAt(world, k.x, k.z) - navDistAt(world, k.x, k.z, free) > 5 && upOnWay(world, k, free) >= 0 && !risesHere(world, k)) {
      if (burstClear(sim, k, flipTo)) inp.dash = true; else ai.holdFlip = true;
    }
  }
  // Getting unstuck: back out with the wheel over, or (backT < 0) push forward at full lock.
  if (ai.backT) {
    const back = ai.backT > 0;
    ai.backT = back ? Math.max(0, ai.backT - dt) : Math.min(0, ai.backT + dt);
    inp.gas = back ? 0 : 0.7; inp.brake = back ? 1 : 0; inp.steer = ai.backSteer; inp.drift = false;
    return;
  }
  if (Math.abs(k.spd) < 0.8 && k.stunT <= 0 && !ai.hold) ai.stuckT += dt; else ai.stuckT = 0;      // (hold: waiting for the train is not being stuck)
  if (ai.stuckT > 0.7) {
    ai.stuckT = 0; unstick(sim, k, ai, ai.err || (sim.rng() < 0.5 ? -1 : 1));
    ai.stuck++; if (k.player) sim.stats.stuck++; else sim.stats.rivalStuck++;
  }

  ai.next -= dt;
  if (ai.next > 0) return;
  ai.next += 1 / p.hz;
  if (p.noise) ai.wobble = (sim.rng() * 2 - 1) * p.noise;
  // The mood for ramming is rolled about once a second.
  ai.moodT -= 1 / p.hz;
  if (ai.moodT <= 0) { ai.moodT = 1; ai.mood = sim.rng() < p.aggro * (k.grudgeT > 0 ? 3 : 5.4 / Math.pow(Math.max(3, sim.carts.length - 1), 2)) ? 1 : 0; ai.mean = sim.rng() < 0.6; }   // more rivals, calmer each

  // Rivals are paced against the player, invisibly: far ahead they ease off and shop more, far behind
  // they stop shopping. Full strength for the first 12 s and over the last fifth of the route.
  let pace = p.pace;
  ai.g = p.rival && sim.t < 3 ? 0 : ai.greed;       // rivals sprint off the line: the first shelf is the player's
  if (p.rival && p.char !== 'gramps' && !p.roam && sim.t > 12 && !sim.player.done && sim.player.prog < world.navStart * 0.8) {
    const gap = k.prog - sim.player.prog, mine = k.value + k.stunts, yours = sim.player.value + sim.player.stunts;
    if (gap > 22) { pace *= 0.86; ai.g = Math.min(1, ai.g * 1.3); } else if (gap < -8 && p.char !== 'granny') { pace = Math.max(pace, 1); ai.g *= 0.8; }   // Granny never hurries
    // ...and the same with money: far richer than the player it shops less, far poorer it shops harder.
    if (mine > yours + 100) ai.g *= 0.2; else if (mine < yours * 0.9 && gap > -15) ai.g = Math.min(1.3, ai.g * 1.5);
  }
  // Coupon Queen drops everything for a hot item: with one on the route within 70 m she stops shopping,
  // runs for it at full pace and shouts about it (a hint for the player, and a race).
  if (p.char === 'queen') {
    const here = navDistAt(world, k.x, k.z);
    for (const q of world.pieces) {
      if ((q.type !== 'podium' && q.type !== 'case') || q.good < 0 || !q.solid.on || (q.sale && sim.sale && sim.sale.t > 7)) continue;
      const d = here - navDistAt(world, q.x, q.z);
      if (d < -2 || d > 70) continue;
      ai.g = 0; pace = p.pace;
      if (!q.shouted) { q.shouted = true; sim.emit('shout', k, 0, q); }    // once per podium
    }
  }

  // Look further along the path the faster the cart goes; a short look keeps it lined up for narrow places.
  const reach = clamp(0.45 * Math.abs(k.spd) + 2.5, 3, p.look * CFG.TILE);
  // the smart barriers: the player's bots take the way through them when it is clearly shorter and dash to flip a
  // barrier that is up right in their way (never so that one rises under them); no other dash near barriers
  let field = null, flipper = false;
  if (k.player && world.barriers.length) {
    const free = freeField(world);
    if (navDistAt(world, k.x, k.z) - navDistAt(world, k.x, k.z, free) > 5) { field = free; flipper = true; }
  }
  const calm = !k.player || !world.barriers.some((b) => Math.hypot(b.x - k.x, b.z - k.z) < 14);
  let rack = null;
  if (!field && k.player && sim.mode === 'list') { rack = nextRack(sim, k); if (rack) field = rackField(world, rack); }
  if (!field && p.roam) field = roamField(sim, k, ai, p.roam);
  // the way to the checkouts is shut (a gate): first to the nearest switch nobody has pressed yet
  if (!field && navDistAt(world, k.x, k.z) > 1e8) {
    let best = 1e8;
    for (const s of world.switches) {
      if (s.pressed) continue;
      const f = switchField(world, s), d = navDistAt(world, k.x, k.z, f);
      if (d < best) { best = d; field = f; }
    }
  }
  if (!navAim(world, k.x, k.z, p.look, CFG.CART_R + 0.3, aim, reach, field)) { inp.gas = 0; inp.brake = 1; return; }
  const bend = Math.abs(wrapAngle(Math.atan2(aim.fx - k.x, aim.fz - k.z) - k.h));
  let tx = aim.x, tz = aim.z;
  if (rack && Math.hypot(rack.x - k.x, rack.z - k.z) < 6 && clearPath(world, k.x, k.z, rack.x - (rack.x - k.x) * 0.3, rack.z - (rack.z - k.z) * 0.3, CFG.CART_R - 0.1)) { tx = rack.x; tz = rack.z; }   // ram it
  // a robot vacuum just ahead: steer past it (they are small and slow; nobody waits for one)
  for (const ob of world.objs) {
    if (ob.kind !== 'patrol' || !ob.loop || Math.abs(ob.x - k.x) > 40 || Math.abs(ob.z - k.z) > 40) continue;
    patrolAt(ob, sim.t, VAC);
    const d = Math.hypot(tx - k.x, tz - k.z) || 1, ux = (tx - k.x) / d, uz = (tz - k.z) / d;
    patrolAt(ob, sim.t + Math.max(0, (VAC.x - k.x) * ux + (VAC.z - k.z) * uz) / Math.max(3, Math.abs(k.spd)), VAC);     // where it will be when the cart gets there
    const dx = VAC.x - k.x, dz = VAC.z - k.z, ahead = dx * ux + dz * uz, side = dx * uz - dz * ux;
    if (ahead > -0.5 && ahead < 7 && Math.abs(side) < 1.9) { const s = side > 0 ? -1 : 1; tx = VAC.x + uz * s * 2.1 + ux * 1.2; tz = VAC.z - ux * s * 2.1 + uz * 1.2; }
  }
  // in or right before a hazard, a driver keeps its eyes on the hazard: no shopping, no targets
  let busy = ai.drifting;
  for (const ob of world.objs) if ((ob.fx === 'wipe' || ob.fx === 'push') && inZone(ob, k.x, k.z, ob.fx === 'wipe' ? 6 : 2.5)) { busy = true; break; }
  const listed = !busy && findGoods(sim, k, ai) && goal.list;         // a list item ahead comes before any target
  const hunting = !listed && !busy && calm && p.dash > 0 && ai.g > 0 && k.dashCd <= 0.4 && k.stunT <= 0 && findTarget(sim, k, ai);
  const shopping = listed || (!hunting && !busy && findGoods(sim, k, ai));
  if (hunting) { tx = mark.x; tz = mark.z; } else if (shopping) { tx = goal.x; tz = goal.z; }
  const err = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - k.h) + ai.wobble;
  inp.steer = clamp(err * 2.4, -1, 1);
  ai.err = err;
  // Facing the wrong way against something: a three-point turn.
  if (Math.abs(err) > 1.9 && Math.abs(k.spd) < 4 && k.wallT > 0 && k.stunT <= 0) { unstick(sim, k, ai, err); return; }

  // Speed: full pace on straights, slower into bends the cart cannot hold.
  let v = TUNE.maxspeed * pace;
  if (bend > 0.6) v = Math.min(v, TUNE.maxspeed * clamp(1.15 - bend * 0.45, 0.4, 1));
  if (Math.abs(err) > 1.1) v = Math.min(v, 4.5);
  // Slow enough to actually make the turn to the aim point: its curvature is 2 sin(err) / distance.
  const far = Math.hypot(tx - k.x, tz - k.z);
  const curve = 2 * Math.abs(Math.sin(err)) / Math.max(1.5, far);
  if (curve > 0.2) v = Math.min(v, Math.max(3.5, 2.6 / curve));
  // Brake for whatever the cart is about to run into along its own path (not the route).
  const sp = Math.hypot(k.vx, k.vz);
  if (p.brakes > 0 && sp > 5 && !(p.char === 'bro' && k.grudgeT > 0)) {     // Bulk Bro charging his attacker brakes for nothing
    const ux = k.vx / sp, uz = k.vz / sp, lim = sp * 0.6 * p.brakes;
    for (let d = 1.2; d <= lim; d += 0.6) {
      const c = collide(world, k.x + ux * d, k.z + uz * d, CFG.CART_R, false, true);
      if (!c) continue;
      if (!(hunting && c.solid.piece && c.solid.piece === mark.piece) && ux * c.nx + uz * c.nz < -0.5) v = Math.min(v, Math.max(4, d * 2.2));
      break;
    }
  }
  // Hazards ahead (signs, pop-up tiles, patrols): time the crossing, or (on a misjudged approach) drive on.
  const top = TUNE.maxspeed * (1 - TUNE.loadtop * (k.madT > 0 ? 0 : loadFactor(k)));        // what this cart can do with its load
  v = Math.min(v, top);
  const vBend = v;
  if (flipper) { const d = upOnWay(world, k, field); if (d >= 0 && (k.dashCd > 0 || ai.holdFlip)) v = Math.min(v, Math.max(ai.holdFlip ? 0 : 2.5, (d - 1.4) / Math.max(0.15, k.dashCd > 0 ? k.dashCd : 0.5))); }
  const gate = hazardGate(sim, k, ai, tx, tz, TUNE.maxspeed * pace < top ? TUNE.maxspeed * pace : top), gated = gate < v;
  if (gated) v = gate;
  if (ai.floorV > v) v = Math.min(ai.floorV, top);          // committed inside a hazard: through it before slowing for anything
  void vBend;
  inp.gas = clamp(v / top, 0, 1);
  inp.brake = k.spd > v + (gated ? 0.4 : 3) ? 1 : 0;       // a hazard's speed is kept to, not just aimed at
  // The cart train: a driver whose nose points at the track waits while the train is passing the
  // spot it would cross at (a cart that has stopped reckons with the speed it will cross at, or it
  // would roll out in front of the train). A careless driver looks less often.
  let hold = false;
  for (const tr of sim.trains) {
    const along = (k.x - tr.x0) * tr.dx + (k.z - tr.z0) * tr.dz, off = (k.x - tr.x0) * tr.dz - (k.z - tr.z0) * tr.dx, side = Math.sign(off);
    const facing = -(Math.sin(k.h) * tr.dz - Math.cos(k.h) * tr.dx) * side;
    if (along < -1 || along > tr.len + 1 || Math.abs(off) > 8 || facing < 0.3 || sim.rng() > p.brakes) continue;
    const speed = Math.max(5, -(k.vx * tr.dz - k.vz * tr.dx) * side), when = Math.max(0, Math.abs(off) - 1.4) / speed;
    const at = clamp(tr.s + (tr.wait > when ? 0 : tr.dir * CFG.trainSpeed * (when - Math.max(0, tr.wait))), 0, tr.len);
    if (Math.abs(along - at + tr.dir * TRAIN_L / 2) < TRAIN_L / 2 + 1.9) { inp.gas = 0; inp.brake = 1; hold = true; }
  }
  ai.hold = hold || ai.waiting;

  // The lunge: lined up with a target and close enough. The player gets a warning first; the line
  // announced is the one to where the player's cart will be if it just carries on.
  const pins = hunting && mark.piece && !mark.piece.solid;     // a huddle wants the dash late (all three rows in one lunge) and from its axis
  if (hunting && Math.abs(err) < 0.2 && far < (pins ? 3.8 : 6) && mark.lined && k.dashCd <= 0) {
    if (mark.cart && mark.cart.player) {
      const b = mark.cart, lead = CFG.ramWarn + 0.15;
      ai.warnT = CFG.ramWarn; ai.victim = b; sim.ramCool = 7;
      ai.aimH = Math.atan2(b.x + b.vx * lead - k.x, b.z + b.vz * lead - k.z);
      sim.emit('warn', k, 0, b);
    } else inp.dash = true;
  } else if (hunting && mark.piece && mark.lined && far < (pins ? 2.2 : 4.5)) ai.wants.set(mark.piece, false);   // too close and not lined up: let it go

  // Drift through real bends and let go once the path points down the road.
  if (ai.drifting) {
    ai.driftT += 1 / p.hz;
    const going = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - Math.atan2(k.vx, k.vz));   // judged by the path, not the nose
    if (Math.abs(going) < 0.2 || going * k.drift < 0 || ai.driftT > 2.6 || !k.drift && ai.driftT > 0.3) ai.drifting = false;
  } else if (!shopping && !hunting && !busy && !gated && p.drift > 0 && bend > 0.85 && !world.objs.some((o) => o.kind === 'turnstile' && Math.hypot(o.x - k.x, o.z - k.z) < o.R + 8) && Math.abs(err) > 0.4 && k.spd > TUNE.maxspeed * 0.6 &&
    (k.load <= TUNE.loadfull || p.brakes === 0) && sim.rng() < p.drift) {       // only the careless drift with a skyscraper
    ai.drifting = true; ai.driftT = 0;
  }
  if (ai.drifting && gated && v < 7) ai.drifting = false;            // a hazard's timing comes before a drift
  inp.drift = ai.drifting;
  if (ai.drifting) { inp.gas = 1; inp.brake = 0; }

  // Last resort for a rival that has made no progress for five seconds and is out of the player's
  // sight: set it down on the next tile of its route. Counted; the goal is never to need it.
  if (p.rival) {
    ai.progT += 1 / p.hz;
    if (k.prog > ai.progAt + 2) { ai.progAt = k.prog; ai.progT = 0; }
    if (ai.progT > 5 && Math.hypot(k.x - sim.player.x, k.z - sim.player.z) > 26) {
      k.x = aim.x; k.z = aim.z; k.vx = k.vz = 0; ai.progT = 0;
      sim.stats.pushOuts++;
    }
  }
}

const VAC = { x: 0, z: 0, h: 0, moving: false };
// How far ahead (within 6.5 m) the nearest barrier that is up lies on the way through the barriers (free: the
// route with them all down; it lies ahead if it is nearer the checkouts than the cart); -1 if none.
const flipTo = { x: 0, z: 0 };
// Would a dash now carry the cart through the wipe hazards toward the barrier in a clear window?
function burstClear(sim, k, to) {
  const dx = to.x - k.x, dz = to.z - k.z, l = Math.hypot(dx, dz) || 1, ex = k.x + dx / l * 24, ez = k.z + dz / l * 24;
  for (const ob of sim.world.objs) {
    if (ob.kind !== 'panels' && ob.kind !== 'laser' && ob.kind !== 'sign') continue;
    if (Math.hypot(ob.x - k.x, ob.z - k.z) > 30) continue;
    const d = passDelay(ob, k.x, k.z, ex, ez, 13, sim.t, 0.6, 0.04, 13);
    if (d > 0) return false;
  }
  return true;
}
function upOnWay(world, k, free) {
  const here = navDistAt(world, k.x, k.z, free);
  let best = -1;
  for (const b of world.barriers) {
    if (!b.solid.on) continue;
    const d = Math.hypot(Math.max(0, Math.abs(b.x - k.x) - b.hx), Math.max(0, Math.abs(b.z - k.z) - b.hz));
    if (d >= 6.5 || (best >= 0 && d >= best)) continue;
    let low = 1e9;
    for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) low = Math.min(low, free[r * world.cols + c]);
    if (low < here - 0.5) { best = d; flipTo.x = b.x; flipTo.z = b.z; }
  }
  return best;
}
// LIST: the nearest rack (by the route) still holding a list item, and a distance field to it (cached).
function nextRack(sim, k) {
  let best = null, bd = 1e9;
  for (const q of sim.world.pieces) {
    if (q.type !== 'listrack' || q.good < 0) continue;
    const d = Math.hypot(q.x - k.x, q.z - k.z) + (sim.world.nav[q.r * sim.world.cols + q.c] < 1e8 ? 0 : 0);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function rackField(world, q) {
  if (q.fieldVer !== world.navVer) {
    const seeds = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = q.c + dc, r = q.r + dr; if (c >= 0 && r >= 0 && c < world.cols && r < world.rows && !world.block[r * world.cols + c]) seeds.push(r * world.cols + c, 0); }
    q.field = fieldFrom(world, seeds, q.field || new Float32Array(world.cols * world.rows)); q.fieldVer = world.navVer;
  }
  return q.field;
}
// A roamer (Big Bubba in the food court) wanders between random spots of its patch [c0, r0, c1, r1] and never
// checks out.
function roamField(sim, k, ai, rect) {
  const world = sim.world;
  if (!ai.roamAt || sim.t > ai.roamT || Math.hypot(ai.roamAt[0] - k.x, ai.roamAt[1] - k.z) < 3) {
    for (let n = 0; n < 20; n++) {
      const c = rect[0] + Math.floor(sim.rng() * (rect[2] - rect[0] + 1)), r = rect[1] + Math.floor(sim.rng() * (rect[3] - rect[1] + 1));
      if (!world.block[r * world.cols + c]) { ai.roamAt = [(c + 0.5) * CFG.TILE, (r + 0.5) * CFG.TILE]; ai.roamTile = r * world.cols + c; break; }
    }
    ai.roamT = sim.t + 4 + sim.rng() * 3; ai.roamVer = -1;
  }
  if (ai.roamVer !== world.navVer) { ai.roamField = fieldFrom(world, [ai.roamTile, 0], ai.roamField || new Float32Array(world.cols * world.rows)); ai.roamVer = world.navVer; }
  return ai.roamField;
}
// A barrier that is down now would rise where the cart is (or is about to be) if it flipped them.
function risesHere(world, k) {
  for (const b of world.barriers) {
    if (b.solid.on) continue;
    for (const s of [0, 0.25, 0.5]) { const x = k.x + k.vx * s, z = k.z + k.vz * s; if (Math.abs(x - b.x) < b.hx + 1.2 && Math.abs(z - b.z) < b.hz + 1.2) return true; }
  }
  return false;
}

// ---- Hazards ----------------------------------------------------------------------------------------
// The speed a driver may go at so that it crosses the hazards ahead in a safe window: on each approach it judges
// the hazard once (a roll against its judge value; a level may make one rival's first try at a kind fail), then,
// if it judged right, it slows so that it arrives when the way is clear, or stops short and waits for it.
const HZ = [];
function hazardGate(sim, k, ai, tx, tz, v) {
  const world = sim.world, p = ai.prof;
  ai.waiting = false; ai.floorV = 0;
  if (!world.objs.length) return v;
  // the path ahead: where the cart is actually going (its travel direction), or toward its aim point from a stop
  const sp0 = Math.hypot(k.vx, k.vz), moving = sp0 > 3, fx = moving ? k.vx : tx - k.x, fz = moving ? k.vz : tz - k.z, fl = Math.hypot(fx, fz) || 1, look = Math.max(10, Math.abs(k.spd) * 1.3);
  const ex0 = k.x + fx / fl * look, ez0 = k.z + fz / fl * look;
  let out = v;
  for (const ob of hazardsOn(world, k.x, k.z, ex0, ez0, HZ)) {
    if ((ob.kind === 'patrol' && ob.loop) || ob.kind === 'turnstile') continue;     // routes go round turnstiles; vacuums are steered past
    let ex = ex0, ez = ez0;
    if (ob.kind === 'laser' || ob.kind === 'panels') {
      const [cx, cz, near] = objExtent(ob), far = Math.min(32, Math.max(look, Math.hypot(cx - k.x, cz - k.z) + near * 0.85));
      ex = k.x + fx / fl * far; ez = k.z + fz / fl * far;
    }
    let roll = ai.rolls.get(ob);
    if (!roll || sim.t > roll.until) {
      const first = sim.def.firstFail && sim.def.firstFail[p.char] === ob.kind && !ai.fails.has(ob.kind);
      roll = { ok: !first && sim.rng() < (p.judge ?? 1), until: sim.t + 6, scripted: first };
      if (first) ai.fails.add(ob.kind);
      ai.rolls.set(ob, roll);
    }
    // a level's scripted failure on the pop-up tiles: goes in at a speed that is sure to meet a pop (never a
    // stop: whoever follows must not be held up in the field)
    if (roll.scripted && ob.kind === 'tiles') {
      if (k.air > 0) { roll.scripted = false; roll.until = sim.t + 1; continue; }
      const entry = zoneDist(ob, k.x, k.z, ex, ez);
      if (entry >= 0.4) {
        let bad = 3.5;
        for (const f of [1, 0.85, 0.7, 0.55]) { const sp = Math.max(4, v * f); if (passDelay(ob, k.x, k.z, ex, ez, sp, sim.t, 0.3, 0.04, Math.abs(k.spd)) > 0) { bad = sp; break; } }
        ai.commit.set(ob, bad); out = Math.min(out, bad);
      } else { const cv = ai.commit.get(ob); if (cv) out = Math.min(out, cv); }
      continue;
    }
    if (!roll.ok) continue;                           // misjudged: drives straight in
    // the highest steady speed at which the whole crossing is clear, starting now (it is checked again many times
    // a second, so the cart settles on a speed that lands it in the gap); none: creep up to it, or wait short of it
    const entry = zoneDist(ob, k.x, k.z, ex, ez);
    if (entry < 0.4) { const cv = ai.commit.get(ob); if (cv) { out = Math.min(out, cv); ai.floorV = Math.max(ai.floorV, cv * 0.95); } continue; }   // in it: keep the planned speed (no slowing for a bend in there either), never stop
    let go = -1;
    for (const f of ob.kind === 'laser' || ob.kind === 'panels' ? [1, 0.85, 0.7] : [1, 0.85, 0.7, 0.55, 0.42]) {     // no crawling through a sweep: wait, then go
      const sp = Math.max(4, v * f);
      if (passDelay(ob, k.x, k.z, ex, ez, sp, sim.t, 0.85, 0.04, Math.abs(k.spd)) === 0) { go = sp; break; }
    }
    if (go > 0) { out = Math.min(out, go); ai.commit.set(ob, go); }
    else if (entry > 7) out = Math.min(out, 4);
    else { out = 0; ai.waiting = true; }              // wait well short of it: from there the cart can take a run at the gap
  }
  // patience: after a long wait at a hazard a driver goes anyway (and may be caught: comic, never stuck)
  ai.waitT = ai.waiting ? (ai.waitT || 0) + 1 / p.hz : 0;
  if (ai.waitT > 3.5) { for (const ob of HZ) { const r = ai.rolls.get(ob); if (r) r.ok = false; } ai.waiting = false; ai.waitT = 0; return v; }
  return out;
}
// How far along a path from (x0, z0) to (x1, z1) the object's area begins (-1 if never).
function zoneDist(ob, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.ceil(len / 0.4);
  for (let i = 0; i <= n; i++) {
    const x = x0 + dx * i / n, z = z0 + dz * i / n;
    if (inZone(ob, x, z, 1.2)) return len * i / n;
  }
  return -1;
}
export function inZone(ob, x, z, pad) {
  if (ob.kind === 'sign') { const ddx = x - ob.x, ddz = z - ob.z, lat = ddx * ob.ax + ddz * ob.az, along = ddx * ob.az - ddz * ob.ax; return Math.abs(along) < 0.15 + pad && Math.abs(lat) < ob.reach + pad; }
  if (ob.kind === 'turnstile') return Math.hypot(x - ob.x, z - ob.z) < ob.R + pad;
  if (ob.kind === 'laser') return Math.hypot(x - ob.x, z - ob.z) < ob.L + Math.min(pad, 1);
  if (ob.kind === 'scissors') { const ddx = x - ob.x, ddz = z - ob.z, lat = ddx * ob.ax + ddz * ob.az, along = ddx * ob.az - ddz * ob.ax; return Math.abs(along) < 0.3 + pad && Math.abs(lat) < ob.span / 2 + pad; }
  if (ob.kind === 'glove') { const ddx = x - ob.gx, ddz = z - ob.gz, along = ddx * ob.dx + ddz * ob.dz; return along > -pad && along < ob.reach + 0.5 + pad && Math.abs(ddx * ob.dz - ddz * ob.dx) < 0.7 + pad; }
  if (ob.kind === 'tiles' || ob.kind === 'panels') { const T = CFG.TILE; return x > ob.c0 * T - pad && x < (ob.c0 + ob.nc) * T + pad && z > ob.r0 * T - pad && z < (ob.r0 + ob.nr) * T + pad; }
  if (ob.kind === 'patrol') { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [px, pz] of ob.pts) { a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, pz); d = Math.max(d, pz); } return x > a - ob.hz - pad && x < b + ob.hz + pad && z > c - ob.hz - pad && z < d + ob.hz + pad; }
  return false;
}

// ---- The crowd -------------------------------------------------------------------------------------
// A shopper: state 0 stand, 1 walk, 2 dodge, 3 down (bowled over), 4 run to the flash sale, -1 not
// in yet (a quarter of the crowd arrives halfway through the run).
export function spawnCrowd(sim) {
  const world = sim.world, tiles = world.crowdTiles, rng = sim.rng;
  const mix = CROWD_MIX[sim.def.kit || 'supermarket'] || CROWD_MIX.supermarket;
  const shopper = (x, z, state, busy) => { const i = sim.shoppers.length; sim.shoppers.push({ x, z, vx: 0, vz: 0, tx: x, tz: z, h: rng() * 6.283, state, t: rng() * 3,
    col: i % 3, busy, rush: false, near: null, hit: false, sure: false, angry: 0, hx: x, hz: z, kind: mix[(i * 7 + 3) % mix.length], cd: 2 + (i % 5), chase: 0 }); };
  // A huddle: six shoppers set up like bowling pins (one, two, three), the head pin toward the carts
  // that come down the route, and too busy to jump clear. A dash through the middle is a STRIKE.
  if (TUNE.crowd > 0) for (const g of world.huddles) {
    navAim(world, g.x, g.z, 3, 0.3, aim, 99);
    const dl = Math.hypot(aim.fx - g.x, aim.fz - g.z) || 1, dx = (aim.fx - g.x) / dl, dz = (aim.fz - g.z) / dl;
    g.on = true; g.dx = dx; g.dz = dz;
    for (let row = 0; row < 3; row++) for (let i = 0; i <= row; i++) {
      const along = (row - 1) * 0.68, side = (i - row / 2) * 0.74;
      shopper(g.x + dx * along + dz * side, g.z + dz * along - dx * side, 0, true);
      sim.shoppers[sim.shoppers.length - 1].h = Math.atan2(-dx, -dz);
    }
  }
  // The crush at the doors: a pack that stands just ahead of the start and runs into the store at GO.
  const st = world.start, fx = Math.sin(st.h), fz = Math.cos(st.h);
  for (let i = 0; i < Math.round((sim.def.rush || 0) * TUNE.crowd); i++) {
    const side = (i % 3 - 1) * 2.4 + rng() - 0.5, x = st.x + fx * (5 + i * 1.1) + fz * side, z = st.z + fz * (5 + i * 1.1) - fx * side;
    if (blockedAt(world, x, z, 0.4)) continue;
    shopper(x, z, 4, false);
    const s = sim.shoppers[sim.shoppers.length - 1], far = 16 + rng() * 18;
    s.rush = true; s.h = st.h; s.tx = x + fx * far; s.tz = z + fz * far;
    if (!clearPath(world, x, z, s.tx, s.tz, 0.4)) { s.tx = x + fx * 8; s.tz = z + fz * 8; }
  }
  const n = Math.round((sim.def.crowd || 0) * TUNE.crowd) - sim.shoppers.length;
  for (let i = 0; i < n && tiles.length; i++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 20; tries++) {
      const t = tiles[rng.int(tiles.length)];
      x = (t % world.cols + 0.2 + rng() * 0.6) * CFG.TILE; z = (Math.floor(t / world.cols) + 0.2 + rng() * 0.6) * CFG.TILE;
      if (Math.hypot(x - world.start.x, z - world.start.z) > 14 && !blockedAt(world, x, z, 0.4)) break;
    }
    shopper(x, z, i >= n * 0.75 ? -1 : 0, false);
  }
}

// The crowd's absurd moments (DESIGN.md section 6): the mascot breakdances when a cart comes near, the scooter
// elder does donuts, a member of staff chases a speeding cart with a price gun for two seconds, a baby throws
// goods out of its stroller. Returns true while the shopper is busy with one (its own movement is done here).
function absurd(sim, s, p, dt) {
  const d = Math.hypot(s.x - p.x, s.z - p.z);
  if (s.state === 6 || s.state === 7) {                    // breakdancing or doing donuts
    if (s.state === 7) {
      s.h += 3.2 * dt; const nx = s.x + Math.sin(s.h) * 2.6 * dt, nz = s.z + Math.cos(s.h) * 2.6 * dt;
      if (!blockedAt(sim.world, nx, nz, 0.5)) { s.x = nx; s.z = nz; } else s.t = 0;
    }
    if (s.t <= 0) { s.state = 0; s.t = 1 + sim.rng(); s.cd = 7 + sim.rng() * 4; }
    return true;
  }
  if (s.chase > 0) {                                       // the price gun
    s.chase -= dt;
    const dx = p.x - s.x, dz = p.z - s.z, l = Math.hypot(dx, dz) || 1;
    s.vx = dx / l * 4.2; s.vz = dz / l * 4.2; s.h = Math.atan2(dx, dz); s.state = 4;
    if (s.chase <= 0) { s.state = 0; s.vx = s.vz = 0; s.angry = 1.2; s.t = 1; s.cd = 9; }
    return false;
  }
  if (s.state !== 0 && s.state !== 1 || s.busy || s.cd > 0 || sim.phase !== 'run') return false;
  if (s.kind === 'mascot' && d < 14) { s.state = 6; s.t = 3; s.vx = s.vz = 0; sim.emit('dance', null, 0, s); return true; }
  if (s.kind === 'scooterElder' && d < 20) { s.state = 7; s.t = 3.5; sim.emit('donut', null, 0, s); return true; }
  if (s.kind === 'staff' && d < 4.5 && Math.abs(p.spd) > 8) { s.chase = 2; sim.emit('pricegun', null, 0, s); return false; }
  if (s.kind === 'strollerMom' && d < 7) {
    s.cd = 10;
    const pool = ['chips', 'soda', 'roll'], good = GOOD[pool[sim.tick % 3]];
    sim.toss(s.x, s.z, p.x - s.x, p.z - s.z, good);
    sim.emit('babythrow', null, 0, s);
  }
  return false;
}

export function stepCrowd(sim, dt) {
  const world = sim.world, rng = sim.rng, p = sim.player;
  const sale = sim.sale ? sim.sale.piece : null;
  for (const s of sim.shoppers) {
    if (s.state < 0) {                                // waiting to come in: halfway through, out of sight
      if (sim.t > sim.timer * 0.5 && Math.hypot(s.x - p.x, s.z - p.z) > 24) s.state = 0;
      continue;
    }
    s.t -= dt;
    if (s.angry > 0) s.angry -= dt;
    if (s.cd > 0) s.cd -= dt;
    if (absurd(sim, s, p, dt)) continue;
    if (s.state === 0 && s.busy) {
      if (s.t <= 0 && Math.hypot(s.hx - s.x, s.hz - s.z) > 0.4) { s.state = 4; s.rush = true; s.tx = s.hx; s.tz = s.hz; }   // back into formation, at a run
    } else if (s.state === 0) {
      if (sale && Math.hypot(sale.x - s.x, sale.z - s.z) < 30 && clearPath(world, s.x, s.z, sale.x, sale.z, 0.3)) {
        s.state = 4; const a = rng() * 6.283, r = 2 + rng() * 2.5;
        s.tx = sale.x + Math.cos(a) * r; s.tz = sale.z + Math.sin(a) * r;
      } else if (s.t <= 0) {                          // stroll a few metres if the way is clear
        const a = rng() * 6.283, r = 3 + rng() * 5, tx = s.x + Math.cos(a) * r, tz = s.z + Math.sin(a) * r;
        // most shoppers keep out of the hazards; one in seven wanders in regardless (and may be flattened)
        const risky = sim.shoppers.indexOf(s) % 7 !== 0 && world.objs.some((ob) => (ob.fx === 'wipe' || ob.fx === 'push') && (inZone(ob, tx, tz, 1) || inZone(ob, (s.x + tx) / 2, (s.z + tz) / 2, 1)));
        if (!risky && clearPath(world, s.x, s.z, tx, tz, 0.4)) { s.state = 1; s.tx = tx; s.tz = tz; } else s.t = 0.4 + rng();
      }
    } else if (s.state === 1 || s.state === 4) {
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), v = s.state === 4 ? 3.6 : 1.3;
      if (d < 0.3 || (s.state === 4 && !sale && !s.rush)) { s.state = 0; s.rush = false; s.t = 1 + rng() * 3; s.vx = s.vz = 0; }
      else { s.vx = dx / d * v; s.vz = dz / d * v; s.h = Math.atan2(dx, dz); }
    } else if (s.t <= 0) {                            // done dodging or lying down
      if (s.state === 3) s.angry = 1.2;               // gets up and shakes a fist
      s.state = 0; s.t = 0.5 + rng(); s.vx = s.vz = 0;
    }
    if (s.state === 3) { s.vx *= 1 - 3 * dt; s.vz *= 1 - 3 * dt; }
    const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
    if (s.vx || s.vz) { if (blockedAt(world, nx, nz, 0.3)) { s.vx = s.vz = 0; if (s.state === 1 || s.rush) { s.state = 0; s.rush = false; s.t = 0.5; } } else { s.x = nx; s.z = nz; } }

    // Carts: dodge if one is coming, go down if it arrives, and a miss by inches is a CLOSE SHAVE.
    for (const k of sim.carts) {
      if (k.air > 0) continue;                        // a cart in the air passes over their heads
      const dx = s.x - k.x, dz = s.z - k.z;
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6) { if (s.near === k) s.near = null; continue; }
      const sp = Math.hypot(k.vx, k.vz), hx = Math.sin(k.h), hz = Math.cos(k.h);
      const dn = Math.hypot(dx - hx * CFG.noseAt, dz - hz * CFG.noseAt) - CFG.noseR;
      const dtl = Math.hypot(dx - hx * CFG.tailAt, dz - hz * CFG.tailAt) - CFG.tailR;
      const gap = Math.min(dn, dtl) - 0.3;            // edge to edge
      if (s.state === 3) continue;
      if (gap < 0 && sp > 2) {                        // bowled over
        const force = k.dashT > 0 || k.madT > 0 || k.dashCd > TUNE.dashcooldown - CFG.dashTime - 0.25;   // a dash, or the quarter second after it
        if (s.busy && !force) {                       // a pin only goes down to a dash: anything else shoves it aside, and it steps back
          const dir = dx * k.vz - dz * k.vx >= 0 ? 1 : -1;
          s.state = 2; s.t = 0.4; s.vx = k.vz / sp * dir * 4.5; s.vz = -k.vx / sp * dir * 4.5;
          continue;
        }
        s.state = 3; s.t = 1.3; s.hit = true; s.near = null;
        s.vx = k.vx * 0.5 + (dx > 0 ? 1 : -1); s.vz = k.vz * 0.5 + (dz > 0 ? 1 : -1);
        if (force) {
          k.dashHits++; k.dashKnocks = (k.dashKnocks || 0) + 1;
          sim.madGain(k, 0.12);
          if (k.dashKnocks === 5) { sim.stunt(k, 'strike', s.x, s.z); sim.madGain(k, 1.2); if (k.player) sim.stats.strikes++; }
        } else { k.vx *= 0.95; k.vz *= 0.95; }       // a touch costs at most 5% of speed
        if (k.player) sim.stats.bowled++;
        sim.emit('bowl', k, force ? 1 : 0, s);
        continue;
      }
      if (sp < 4) continue;
      const along = (dx * k.vx + dz * k.vz) / sp, side = (dx * k.vz - dz * k.vx) / sp;
      if (!s.sure && !s.busy && s.state !== 2 && along > 0 && along < sp * 0.55 && Math.abs(side) < 1.2) {
        s.sure = true;                                // decides once per approach: about 6 in 10 jump clear
        if (rng() < 0.6) {
          const dir = side >= 0 ? 1 : -1;
          s.state = 2; s.t = 0.35; s.vx = k.vz / sp * dir * 5.5; s.vz = -k.vx / sp * dir * 5.5;
        }
      }
      if (gap < 0.5 && sp > TUNE.maxspeed * 0.6) s.near = k;
      else if (s.near === k && gap > 2) {             // it passed within half a metre and never touched
        s.near = null; s.sure = false;
        if (!s.hit && (k.shaveT || 0) < sim.t) { k.shaveT = sim.t + 0.5; sim.stunt(k, 'shave', s.x, s.z); sim.madGain(k, 0.4); if (k.player) sim.stats.shaves++; }
        s.hit = false;
      }
      if (gap > 5) { s.sure = false; s.hit = false; }
    }
  }
}

// ---- The cart train ----------------------------------------------------------------------------------
// A string of carts that shuttles along its track (world.tracks), pausing at each end. Whoever is in
// its way is shoved aside as by a crash. tr.s is the head's distance along the track, tr.dir its way;
// the other carts follow the head.
const TRAIN = { type: 'train' }, TRAIN_L = (CFG.trainCars - 1) * 1.5;     // the string's length, head to last cart
export function spawnTrains(sim) {
  for (const t of sim.world.tracks) {
    sim.trains.push({ x0: t.x0, z0: t.z0, dx: (t.x1 - t.x0) / t.len, dz: (t.z1 - t.z0) / t.len, len: t.len, s: TRAIN_L + sim.rng() * (t.len - TRAIN_L), dir: 1, wait: 0, x: t.x0, z: t.z0 });
  }
}
export function stepTrains(sim, dt) {
  for (const tr of sim.trains) {
    if (tr.wait > 0) tr.wait -= dt;
    else {
      tr.s += tr.dir * CFG.trainSpeed * dt;
      // At an end of the track the last cart becomes the head: the whole string stays on the track.
      if (tr.s > tr.len || tr.s < 0) { tr.s = clamp(tr.s, 0, tr.len) - tr.dir * TRAIN_L; tr.dir = -tr.dir; tr.wait = 1.4; }
    }
    tr.x = tr.x0 + tr.dx * tr.s; tr.z = tr.z0 + tr.dz * tr.s;
    for (const k of sim.carts) {
      if (k.done || k.air > 0) continue;
      for (let i = 0; i < CFG.trainCars; i++) {
        const dx = k.x - tr.x + tr.dx * tr.dir * i * 1.5, dz = k.z - tr.z + tr.dz * tr.dir * i * 1.5, d = Math.hypot(dx, dz);
        if (d > 1.35 || d < 1e-6) continue;
        k.x += dx / d * (1.35 - d); k.z += dz / d * (1.35 - d);
        if (k.immuneT > 0 || (tr.wait > 0 && Math.hypot(k.vx, k.vz) < 6)) break;   // just hit, or leaning on a standing train: pushed, no more
        k.vx = dx / d * 5 + tr.dx * tr.dir * CFG.trainSpeed; k.vz = dz / d * 5 + tr.dz * tr.dir * CFG.trainSpeed;
        k.stunT = Math.max(k.stunT, 0.4); k.turnTo = null;
        k.immuneT = TUNE.immunity; sim.onCrash(k, 4, TRAIN);     // (a quarter of the goods, not the full 40%)
        break;
      }
    }
  }
}
