// DOORBUSTER — ai.js
// Purpose: everything that drives itself. One driver steers every rival and, in bot modes (beginner,
//          confident, expert, sloppy), the player's cart for tests, balancing and autoplay; it only
//          fills the same input structure the keyboard fills, so bots and rivals obey the same cart
//          model. Also the crowd: shoppers on foot who stroll, dodge, get bowled over and get up.
// Exports: BOTS, rivalProfile, makeDriver, drive, spawnCrowd, stepCrowd
// Depends on: config.js, world.js. No DOM, no THREE.

import { TUNE, CFG, GOODS, CHARS, clamp, wrapAngle } from './config.js';
import { navAim, navDistAt, clearPath, collide, blockedAt } from './world.js';

// pace = share of top speed, hz = decisions per second, noise = steering error (rad),
// drift / dash = how readily the driver uses them (0..1), look = tiles of path it looks along,
// greed = how far it leaves its line for goods (0 = never), fill = load (share of a full cart) at
// which it stops collecting, clock = whether it gives up collecting when time runs short,
// brakes = how readily it slows for whatever is straight ahead of the cart (0 = never),
// aggro = appetite for ramming carts that carry loot.
export const BOTS = {
  beginner:  { pace: 0.72, hz: 6,  noise: 0.22, drift: 0,   dash: 0.2, look: 5, greed: 0.35, fill: 1.0, clock: false, brakes: 0.5, aggro: 0.1 },
  confident: { pace: 0.92, hz: 12, noise: 0.08, drift: 0.5, dash: 0.7, look: 7, greed: 0.8, fill: 1.2, clock: true, brakes: 1, aggro: 0.5 },
  expert:    { pace: 1,    hz: 30, noise: 0,    drift: 1,   dash: 1,   look: 8, greed: 1,   fill: 1.5, clock: true, brakes: 1, aggro: 0.9 },
  sloppy:    { pace: 1,    hz: 8,  noise: 0.3,  drift: 1,   dash: 1,   look: 4, greed: 1,   fill: 1.5, clock: false, brakes: 0, aggro: 0.6 },   // fast and careless, for tower tests
};

// A rival's driver comes from its character (config.js CHARS) and the two rival tune values.
export function rivalProfile(id) {
  const c = CHARS[id], skill = clamp(c.skill * TUNE.rivalskill, 0.2, 1);
  return { rival: true, char: id, pace: c.pace, hz: 6 + Math.round(skill * 14), noise: (1 - skill) * 0.3, drift: skill > 0.75 ? 0.7 : 0,
    dash: 0.4 + skill * 0.6, look: 5 + Math.round(skill * 3), greed: c.greed, fill: id === 'granny' ? 1.5 : id === 'dad' ? 1.1 : 1.5,
    clock: true, brakes: skill, aggro: c.aggro * TUNE.rivalaggro };
}

export function makeDriver(prof) {
  return { prof, greed: prof.greed, g: prof.greed, next: 0, wobble: 0, drifting: false, driftT: 0, stuckT: 0, backT: 0, backSteer: 1, stuck: 0,
    err: 0, turnAt: -9, warnT: 0, strikeT: 0, victim: null, mean: false, mood: 0, moodT: 0, wants: new Map(), shout: null, progAt: 0, progT: 0 };
}

const aim = { x: 0, z: 0, fx: 0, fz: 0, left: 0 };
const goal = { x: 0, z: 0, score: 0 };
const mark = { x: 0, z: 0, score: 0, cart: null, piece: null };

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
  goal.score = 0;
  let shelf = null;
  for (const it of world.items) {
    if (it.taken || !worth(it.good)) continue;
    const before = goal.score;
    consider(k, fx, fz, range, wide, it.x + it.nx * off, it.z + it.nz * off, GOODS[it.good].price * 1.5);
    if (goal.score > before) shelf = it;
  }
  for (const d of world.drops) {
    if (!d.live || (d.list ? !k.player : !worth(d.good))) continue;
    const before = goal.score;
    consider(k, fx, fz, range, wide, d.x, d.z, d.list ? 400 : GOODS[d.good].price);
    if (goal.score > before) shelf = null;
  }
  if (goal.score <= 0.4 || navDistAt(world, goal.x, goal.z) > here + 1) return false;
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
    if (!q.solid.on || !q.solid.dash) continue;
    const hot = q.type === 'podium';
    if (hot ? q.good < 0 : q.type === 'glass') continue;        // drivers do not take the glass shortcuts
    if (navDistAt(world, q.x, q.z) > here + 3) continue;
    // Whether to go for a piece is decided once, on first sight: a driver that passes on it steers round it.
    if (!ai.wants.has(q)) ai.wants.set(q, sim.rng() < (hot ? 0.5 + p.dash * 0.5 : p.dash));
    if (!ai.wants.get(q)) continue;
    if (see(q.x, q.z, hot ? (p.char === 'queen' ? 44 : 26) : 13, hot ? (p.char === 'queen' ? 30 : 8) : 1.5)) { mark.piece = q; mark.cart = null; }
  }
  // A victim: loot to knock off, not immune, and the mood for it (a grudge makes the mood).
  if (ai.mood > 0) for (const b of sim.carts) {
    if (b === k || b.done || b.immuneT > 0) continue;
    const grudge = k.grudge === b && k.grudgeT > 0;
    if (b.tower.length < (grudge ? 1 : 5)) continue;
    // The player is left alone for the first seconds, is rammed a limited number of times per run and
    // never twice in a row.
    if (b.player && (sim.t < 8 || !ai.mean && !grudge || sim.stats.rammed >= (sim.def.maxRams || 3) || (sim.ramCool > 0 && ai.victim !== b))) continue;
    if (see(b.x, b.z, 9, grudge ? 9 : 3)) { mark.cart = b; mark.piece = null; }
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

  // A ram aimed at the player is announced half a second ahead, then comes if it still lines up.
  // Only a dash that was announced can knock goods off the player (sim.js checks strikeT).
  if (ai.strikeT > 0) ai.strikeT -= dt;
  if (ai.warnT > 0) {
    ai.warnT -= dt;
    if (ai.warnT <= 0 && ai.victim) {
      const b = ai.victim, off = Math.abs(wrapAngle(Math.atan2(b.x - k.x, b.z - k.z) - k.h));
      if (off < 0.6 && Math.hypot(b.x - k.x, b.z - k.z) < 10) { inp.dash = true; ai.strikeT = 0.6; }
      ai.victim = null;
    }
  }
  // Getting unstuck: back out with the wheel over, or (backT < 0) push forward at full lock.
  if (ai.backT) {
    const back = ai.backT > 0;
    ai.backT = back ? Math.max(0, ai.backT - dt) : Math.min(0, ai.backT + dt);
    inp.gas = back ? 0 : 0.7; inp.brake = back ? 1 : 0; inp.steer = ai.backSteer; inp.drift = false;
    return;
  }
  if (Math.abs(k.spd) < 0.8 && k.stunT <= 0) ai.stuckT += dt; else ai.stuckT = 0;
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
  if (ai.moodT <= 0) { ai.moodT = 1; ai.mood = sim.rng() < p.aggro * (k.grudgeT > 0 ? 3 : 0.6) ? 1 : 0; ai.mean = sim.rng() < 0.6; }

  // Rivals are paced against the player, invisibly: far ahead they ease off and shop more, far behind
  // they stop shopping. Full strength for the first 12 s and over the last fifth of the route.
  let pace = p.pace;
  ai.g = p.rival && sim.t < 4 ? 0 : ai.greed;       // rivals sprint off the line: the first shelf is the player's
  if (p.rival && sim.t > 12 && !sim.player.done && sim.player.prog < world.navStart * 0.8) {
    const gap = k.prog - sim.player.prog, mine = k.value + k.stunts, yours = sim.player.value + sim.player.stunts;
    if (gap > 20) { pace *= 0.86; ai.g = Math.min(1, ai.g * 1.3); } else if (gap < -15 && p.char !== 'granny') ai.g *= 0.6;   // Granny never hurries
    // ...and the same with money: far richer than the player it shops less, far poorer it shops harder.
    if (mine > yours * 1.15 + 200) ai.g *= 0.5; else if (mine < yours * 0.8 && gap > -15) ai.g = Math.min(1.2, ai.g * 1.5);
  }
  // Coupon Queen drops everything for a hot item: with one on the route within 70 m she stops shopping,
  // runs for it at full pace and shouts about it (a hint for the player, and a race).
  if (p.char === 'queen') {
    const here = navDistAt(world, k.x, k.z);
    for (const q of world.pieces) {
      if (q.type !== 'podium' || q.good < 0 || !q.solid.on) continue;
      const d = here - navDistAt(world, q.x, q.z);
      if (d < -2 || d > 70) continue;
      ai.g = 0; pace = p.pace;
      if (ai.shout !== q) { ai.shout = q; sim.emit('shout', k, 0, q); }
    }
  }

  // Look further along the path the faster the cart goes; a short look keeps it lined up for narrow places.
  const reach = clamp(0.45 * Math.abs(k.spd) + 2.5, 3, p.look * CFG.TILE);
  if (!navAim(world, k.x, k.z, p.look, CFG.CART_R + 0.3, aim, reach)) { inp.gas = 0; inp.brake = 1; return; }
  const bend = Math.abs(wrapAngle(Math.atan2(aim.fx - k.x, aim.fz - k.z) - k.h));
  let tx = aim.x, tz = aim.z;
  const hunting = !ai.drifting && p.dash > 0 && ai.greed > 0 && k.dashCd <= 0.4 && k.stunT <= 0 && findTarget(sim, k, ai);
  const shopping = !hunting && !ai.drifting && findGoods(sim, k, ai);
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
  if (p.brakes > 0 && sp > 5) {
    const ux = k.vx / sp, uz = k.vz / sp, lim = sp * 0.6 * p.brakes;
    for (let d = 1.2; d <= lim; d += 0.6) {
      const c = collide(world, k.x + ux * d, k.z + uz * d, CFG.CART_R, false, true);
      if (!c) continue;
      if (!(hunting && c.solid.piece && c.solid.piece === mark.piece) && ux * c.nx + uz * c.nz < -0.5) v = Math.min(v, Math.max(4, d * 2.2));
      break;
    }
  }
  inp.gas = clamp(v / TUNE.maxspeed, 0, 1);
  inp.brake = k.spd > v + 3 ? 1 : 0;

  // The lunge: lined up with a target and close enough. The player gets half a second of warning.
  if (hunting && Math.abs(err) < 0.2 && far < 6 && k.dashCd <= 0) {
    if (mark.cart && mark.cart.player) { if (ai.warnT <= 0) { ai.warnT = 0.5; ai.victim = mark.cart; sim.ramCool = 7; sim.emit('warn', k, 0, mark.cart); } }
    else inp.dash = true;
  } else if (hunting && mark.piece && far < 4.5) ai.wants.set(mark.piece, false);   // too close and not lined up: let it go

  // Drift through real bends and let go once the path points down the road.
  if (ai.drifting) {
    ai.driftT += 1 / p.hz;
    const going = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - Math.atan2(k.vx, k.vz));   // judged by the path, not the nose
    if (Math.abs(going) < 0.2 || going * k.drift < 0 || ai.driftT > 2.6 || !k.drift && ai.driftT > 0.3) ai.drifting = false;
  } else if (!shopping && !hunting && p.drift > 0 && bend > 0.85 && Math.abs(err) > 0.4 && k.spd > TUNE.maxspeed * 0.6 &&
    (k.load <= TUNE.loadfull || p.brakes === 0) && sim.rng() < p.drift) {       // only the careless drift with a skyscraper
    ai.drifting = true; ai.driftT = 0;
  }
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

// ---- The crowd -------------------------------------------------------------------------------------
// A shopper: state 0 stand, 1 walk, 2 dodge, 3 down (bowled over), 4 run to the flash sale, -1 not
// in yet (a quarter of the crowd arrives halfway through the run).
export function spawnCrowd(sim) {
  const world = sim.world, tiles = world.crowdTiles, rng = sim.rng;
  const shopper = (x, z, state, busy) => sim.shoppers.push({ x, z, vx: 0, vz: 0, tx: x, tz: z, h: rng() * 6.283, state, t: rng() * 3,
    col: sim.shoppers.length % 3, busy, rush: false, near: null, hit: false, sure: false, angry: 0, hx: x, hz: z });
  // A huddle: six shoppers packed together, too busy to jump clear. A dash through the middle is a STRIKE.
  if (TUNE.crowd > 0) for (const g of world.huddles) {
    shopper(g.x, g.z, 0, true);
    for (let i = 0; i < 5; i++) shopper(g.x + Math.sin(i * 1.257) * 0.66, g.z + Math.cos(i * 1.257) * 0.66, 0, true);
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
    if (s.state === 0 && s.busy) {
      if (s.t <= 0 && Math.hypot(s.hx - s.x, s.hz - s.z) > 0.4) { s.state = 1; s.tx = s.hx; s.tz = s.hz; }   // back to the huddle
    } else if (s.state === 0) {
      if (sale && Math.hypot(sale.x - s.x, sale.z - s.z) < 30 && clearPath(world, s.x, s.z, sale.x, sale.z, 0.3)) {
        s.state = 4; const a = rng() * 6.283, r = 2 + rng() * 2.5;
        s.tx = sale.x + Math.cos(a) * r; s.tz = sale.z + Math.sin(a) * r;
      } else if (s.t <= 0) {                          // stroll a few metres if the way is clear
        const a = rng() * 6.283, r = 3 + rng() * 5, tx = s.x + Math.cos(a) * r, tz = s.z + Math.sin(a) * r;
        if (clearPath(world, s.x, s.z, tx, tz, 0.4)) { s.state = 1; s.tx = tx; s.tz = tz; } else s.t = 0.4 + rng();
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
      const dx = s.x - k.x, dz = s.z - k.z;
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6) { if (s.near === k) s.near = null; continue; }
      const sp = Math.hypot(k.vx, k.vz), hx = Math.sin(k.h), hz = Math.cos(k.h);
      const dn = Math.hypot(dx - hx * CFG.noseAt, dz - hz * CFG.noseAt) - CFG.noseR;
      const dtl = Math.hypot(dx - hx * CFG.tailAt, dz - hz * CFG.tailAt) - CFG.tailR;
      const gap = Math.min(dn, dtl) - 0.3;            // edge to edge
      if (s.state === 3) continue;
      if (gap < 0 && sp > 2) {                        // bowled over
        const force = k.dashT > 0 || k.madT > 0;
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
