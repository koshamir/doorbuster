// DOORBUSTER — ai.js
// Purpose: the drivers. One driver steers every rival and, in three bot modes (beginner, confident,
//          expert), the player's cart for tests, balancing and autoplay. A driver only fills the same
//          input structure the keyboard fills, so bots and rivals obey the same cart model.
// Exports: BOTS, makeDriver, drive
// Depends on: config.js, world.js. No DOM, no THREE.

import { TUNE, CFG, clamp, wrapAngle } from './config.js';
import { navAim } from './world.js';

// pace = share of top speed, hz = decisions per second, noise = steering error (rad),
// drift / dash = how readily the driver uses them (0..1), look = tiles of path it looks along.
export const BOTS = {
  beginner:  { pace: 0.72, hz: 6,  noise: 0.22, drift: 0,   dash: 0.15, greed: 0.5, look: 5 },
  confident: { pace: 0.92, hz: 12, noise: 0.08, drift: 0.5, dash: 0.6,  greed: 0.8, look: 7 },
  expert:    { pace: 1,    hz: 30, noise: 0,    drift: 1,   dash: 1,    greed: 1,   look: 8 },
};

export function makeDriver(prof) {
  return { prof, next: 0, wobble: 0, drifting: false, driftT: 0, stuckT: 0, backT: 0, backSteer: 1, stuck: 0 };
}

const aim = { x: 0, z: 0, fx: 0, fz: 0, left: 0 };

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

  if (!navAim(sim.world, k.x, k.z, p.look, CFG.CART_R + 0.3, aim)) { inp.gas = 0; inp.brake = 1; return; }
  const err = wrapAngle(Math.atan2(aim.x - k.x, aim.z - k.z) - k.h) + ai.wobble;
  const bend = Math.abs(wrapAngle(Math.atan2(aim.fx - k.x, aim.fz - k.z) - k.h));
  inp.steer = clamp(err * 2.4, -1, 1);

  // Speed: full pace on straights, slower into bends the cart cannot hold.
  let v = TUNE.maxspeed * p.pace;
  if (bend > 0.6) v = Math.min(v, TUNE.maxspeed * clamp(1.15 - bend * 0.45, 0.4, 1));
  if (Math.abs(err) > 1.1) v = Math.min(v, 4.5);
  inp.gas = clamp(v / TUNE.maxspeed, 0, 1);
  inp.brake = k.spd > v + 3 ? 1 : 0;

  // Drift through real bends and let go once the nose points down the road.
  if (ai.drifting) {
    ai.driftT += 1 / p.hz;
    if (Math.abs(err) < 0.15 || ai.driftT > 2.4 || !k.drift && ai.driftT > 0.3) ai.drifting = false;
  } else if (p.drift > 0 && bend > 0.85 && Math.abs(err) > 0.4 && k.spd > TUNE.maxspeed * 0.6 && sim.rng() < p.drift) {
    ai.drifting = true; ai.driftT = 0;
  }
  inp.drift = ai.drifting;
  if (ai.drifting) { inp.gas = 1; inp.brake = 0; }

  // Dash down clear straights.
  if (p.dash > 0 && k.dashCd <= 0 && bend < 0.25 && Math.abs(err) < 0.12 && aim.left > 14 && sim.rng() < p.dash * 0.5) inp.dash = true;
}
