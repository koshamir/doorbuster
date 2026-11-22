// DOORBUSTER — ai.js
// Purpose: the drivers. One driver steers every rival and, in three bot modes (beginner, confident,
//          expert), the player's cart for tests, balancing and autoplay. A driver only fills the same
//          input structure the keyboard fills, so bots and rivals obey the same cart model.
// Exports: BOTS, makeDriver, drive
// Depends on: config.js, world.js. No DOM, no THREE.

import { TUNE, CFG, GOODS, clamp, wrapAngle } from './config.js';
import { navAim, navDistAt, clearPath, collide } from './world.js';

// pace = share of top speed, hz = decisions per second, noise = steering error (rad),
// drift / dash = how readily the driver uses them (0..1), look = tiles of path it looks along,
// greed = how far it leaves its line for goods (0 = never), fill = load (share of a full cart) at
// which it stops collecting, clock = whether it gives up collecting when time runs short,
// brakes = how readily it slows for whatever is straight ahead of the cart (0 = never).
export const BOTS = {
  beginner:  { pace: 0.72, hz: 6,  noise: 0.22, drift: 0,   dash: 0.15, look: 5, greed: 0.5, fill: 1.0, clock: false, brakes: 0.5 },
  confident: { pace: 0.92, hz: 12, noise: 0.08, drift: 0.5, dash: 0.6,  look: 7, greed: 0.8, fill: 1.2, clock: true, brakes: 1 },
  expert:    { pace: 1,    hz: 30, noise: 0,    drift: 1,   dash: 1,    look: 8, greed: 1,   fill: 1.5, clock: true, brakes: 1 },
  sloppy:    { pace: 1,    hz: 8,  noise: 0.3,  drift: 1,   dash: 1,    look: 4, greed: 1,   fill: 1.5, clock: false, brakes: 0 },   // fast and careless, for tower tests
};

export function makeDriver(prof) {
  return { prof, greed: prof.greed, next: 0, wobble: 0, drifting: false, driftT: 0, stuckT: 0, backT: 0, backSteer: 1, stuck: 0 };
}

const aim = { x: 0, z: 0, fx: 0, fz: 0, left: 0 };
const goal = { x: 0, z: 0, score: 0 };

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
  if (ai.greed <= 0) return false;
  if (p.clock && aim.left / (TUNE.maxspeed * p.pace * 0.75) > sim.timer - sim.t - 3) return false;
  const full = k.load >= TUNE.loadfull * p.fill;              // a full cart only wants list items
  const fx = Math.sin(k.h), fz = Math.cos(k.h);
  const range = 5 + 11 * ai.greed, wide = 1 + 4 * ai.greed, off = CFG.CART_R + 0.5;
  const here = navDistAt(world, k.x, k.z);
  goal.score = 0;
  let shelf = null;
  if (!full) for (const it of world.items) {
    if (it.taken) continue;
    const before = goal.score;
    consider(k, fx, fz, range, wide, it.x + it.nx * off, it.z + it.nz * off, GOODS[it.good].price * 1.5);
    if (goal.score > before) shelf = it;
  }
  for (const d of world.drops) {
    if (!d.live || (full && !d.list)) continue;
    const before = goal.score;
    consider(k, fx, fz, range, wide, d.x, d.z, d.list ? 400 : GOODS[d.good].price);
    if (goal.score > before) shelf = null;
  }
  if (goal.score <= 0.4 || navDistAt(world, goal.x, goal.z) > here + 2) return false;
  if (shelf) {
    // Run parallel to the shelf: push the aim point along the shelf in the direction of travel.
    let tx = -shelf.nz, tz = shelf.nx;
    if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
    const ahead = (goal.x - k.x) * fx + (goal.z - k.z) * fz;
    if (ahead < 3.5) { goal.x += tx * (3.5 - ahead); goal.z += tz * (3.5 - ahead); }
  }
  return clearPath(world, k.x, k.z, goal.x, goal.z, CFG.CART_R - 0.12);
}

export function drive(sim, k, dt) {
  const ai = k.ai, p = ai.prof, inp = k.input;
  if (sim.phase !== 'run' || k.done) { inp.gas = 0; inp.brake = 0; inp.steer = 0; inp.drift = false; return; }

  // Stuck recovery: back out with the wheel turned, then carry on.
  if (ai.backT > 0) {
    ai.backT -= dt;
    inp.gas = 0; inp.brake = 1; inp.steer = ai.backSteer; inp.drift = false;
    return;
  }
  if (Math.abs(k.spd) < 0.8 && k.stunT <= 0) ai.stuckT += dt; else ai.stuckT = 0;
  if (ai.stuckT > 0.7) {
    ai.stuckT = 0; ai.backT = 0.45; ai.backSteer = sim.rng() < 0.5 ? -1 : 1;
    ai.stuck++; sim.stats.stuck++;
  }

  ai.next -= dt;
  if (ai.next > 0) return;
  ai.next += 1 / p.hz;
  if (p.noise) ai.wobble = (sim.rng() * 2 - 1) * p.noise;

  // Look further along the path the faster the cart goes; a short look keeps it lined up for narrow places.
  const reach = clamp(0.45 * Math.abs(k.spd) + 2.5, 3, p.look * CFG.TILE);
  if (!navAim(sim.world, k.x, k.z, p.look, CFG.CART_R + 0.3, aim, reach)) { inp.gas = 0; inp.brake = 1; return; }
  const bend = Math.abs(wrapAngle(Math.atan2(aim.fx - k.x, aim.fz - k.z) - k.h));
  let tx = aim.x, tz = aim.z;
  const shopping = !ai.drifting && findGoods(sim, k, ai);
  if (shopping) { tx = goal.x; tz = goal.z; }
  const err = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - k.h) + ai.wobble;
  inp.steer = clamp(err * 2.4, -1, 1);

  // Speed: full pace on straights, slower into bends the cart cannot hold.
  let v = TUNE.maxspeed * p.pace;
  if (bend > 0.6) v = Math.min(v, TUNE.maxspeed * clamp(1.15 - bend * 0.45, 0.4, 1));
  if (Math.abs(err) > 1.1) v = Math.min(v, 4.5);
  // Slow enough to actually make the turn to the aim point: its curvature is 2 sin(err) / distance.
  const curve = 2 * Math.abs(Math.sin(err)) / Math.max(1.5, Math.hypot(tx - k.x, tz - k.z));
  if (curve > 0.2) v = Math.min(v, Math.max(3.5, 2.6 / curve));
  // Brake for whatever the cart is about to run into along its own path (not the route).
  const sp = Math.hypot(k.vx, k.vz);
  if (p.brakes > 0 && sp > 5) {
    const ux = k.vx / sp, uz = k.vz / sp, far = sp * 0.6 * p.brakes;
    for (let d = 1.2; d <= far; d += 0.6) {
      const c = collide(sim.world, k.x + ux * d, k.z + uz * d, CFG.CART_R, false, true);
      if (!c) continue;
      if (!c.solid.dash && ux * c.nx + uz * c.nz < -0.5) v = Math.min(v, Math.max(4, d * 2.2));
      break;
    }
  }
  inp.gas = clamp(v / TUNE.maxspeed, 0, 1);
  inp.brake = k.spd > v + 3 ? 1 : 0;

  // Drift through real bends and let go once the nose points down the road.
  if (ai.drifting) {
    ai.driftT += 1 / p.hz;
    const going = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - Math.atan2(k.vx, k.vz));   // judged by the path, not the nose
    if (Math.abs(going) < 0.2 || going * k.drift < 0 || ai.driftT > 2.6 || !k.drift && ai.driftT > 0.3) ai.drifting = false;
  } else if (!shopping && p.drift > 0 && bend > 0.85 && Math.abs(err) > 0.4 && k.spd > TUNE.maxspeed * 0.6 &&
    k.load <= TUNE.loadfull && sim.rng() < p.drift) {
    ai.drifting = true; ai.driftT = 0;
  }
  inp.drift = ai.drifting;
  if (ai.drifting) { inp.gas = 1; inp.brake = 0; }

}
