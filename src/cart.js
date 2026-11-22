// DOORBUSTER — cart.js
// Purpose: the arcade cart model shared by the player, rivals and bots. Movement is computed on a
//          plane with a fixed step: steering, speed, grip and slip, drift with a three-tier boost,
//          dash, weight, wall response and the invisible steering helpers. Loot, rams, hazards and
//          scoring live in sim.js; this file only calls back into the object it is given.
// Exports: makeCart, makeInput, stepCart, loadFactor
// Depends on: config.js, world.js. No DOM, no THREE.
//
// Conventions: heading h is in radians, forward = (sin h, cos h) in (x, z); a positive yaw and a
// positive steer both turn LEFT. The body heading (h) and the travel direction are separate: slip is
// the angle between them, and grip rotates the travel direction toward the body without changing
// speed, so in a steady turn sin(slip) = yawRate / grip.
//
// stepCart(cart, input, sim, dt) expects sim = { world, emit(type, cart, value, ref),
// onCrash(cart, speedInto, solid), onSmash(cart, solid), onKnock(cart, solid) }.

import { TUNE, CFG, CHARS, clamp, lerp, wrapAngle, approach } from './config.js';
import { collide } from './world.js';

export function makeInput() {
  return { steer: 0, gas: 0, brake: 0, drift: false, dash: false };
}

export function makeCart(id, charId, x, z, h) {
  return {
    id, char: charId, def: CHARS[charId], player: charId === 'player',
    x, z, h, px: x, pz: z, ph: h,            // pose now and one step ago (for render interpolation)
    vx: 0, vz: 0, spd: 0, slip: 0, yaw: 0, steer: 0,
    drift: 0, driftT: 0, tier: 0, straightT: 0,   // drift direction (-1, 0, 1), seconds held, spark tier 0..3, exit timer
    boostT: 0, boostMul: 1,
    dashT: 0, dashCd: 0, dashBuf: 0, dashHits: 0, sagT: 0,
    stunT: 0, immuneT: 0, turnTo: null,      // turnTo: heading the body whips to after a crash
    air: 0, airT: 0, wetT: 0, convX: 0, convZ: 0,
    wallT: 0, wnx: 0, wnz: 0, scrapeT: 0, help: 0, helpN: 0,
    pinDir: 0, pinT: 0, backT: 0, backs: 0,  // pinned against something: swing direction, timers, count
    load: 0, tower: [], value: 0, stunts: 0, stuntLog: [],
    mad: 0, madT: 0, madIdle: 0,
    done: false, doneT: 0, lane: -1, place: 1, prog: 0,
    input: makeInput(), ai: null,
  };
}

// 0 while the load is inside the free share, rising to 1 at a full cart (weight is capped there).
export function loadFactor(k) {
  const share = Math.min(1, k.load / TUNE.loadfull);
  return clamp((share - TUNE.loadfree) / (1 - TUNE.loadfree), 0, 1);
}

function endDrift(k, top0, sim, withBoost) {
  if (withBoost && k.tier > 0) {
    k.boostMul = 1 + (TUNE.turbopower - 1) * CFG.boostScale[k.tier - 1];
    k.boostT = CFG.boostTime[k.tier - 1];
    k.sagT = 0;
    const kick = top0 * (1 + (k.boostMul - 1) * 0.7);
    const v = Math.hypot(k.vx, k.vz);
    if (v > 0.5 && v < kick) { k.vx *= kick / v; k.vz *= kick / v; }
    sim.emit('boost', k, k.tier);
  }
  k.drift = 0; k.driftT = 0; k.tier = 0;
  k.straightT = CFG.driftStraight;                 // the body swings back onto its path
}

// The two invisible steering helpers. Returns a yaw rate to add (rad/s).
function helperYaw(k, inp, world) {
  const fx = Math.sin(k.h), fz = Math.cos(k.h);
  if (k.wallT > 0) {
    // Pinned nose-first against something while pushing: swing the cart along the surface. The
    // direction is latched so two surfaces (a notch) cannot make it dither.
    const into = -(fx * k.wnx + fz * k.wnz);
    if (into < 0.3 || inp.gas <= 0 || Math.abs(k.spd) > 4) return 0;
    const side = k.wnx * fz - k.wnz * fx;
    if (Math.abs(k.steer) > 0.5) k.pinDir = Math.sign(k.steer);
    else if (!k.pinDir) k.pinDir = Math.abs(side) > 0.05 ? Math.sign(side) : 1;
    return k.pinDir * CFG.pinYaw * into;
  }
  if (k.spd < 5 || k.drift) return 0;
  // About to hit something nearly head-on: lean toward the side that glances off; if only one side
  // of the cart's path is blocked (a corner, a shelf end), swerve past it. Checked every third step.
  if (k.helpN++ % 3) return k.help;
  k.help = 0;
  const reach = k.spd * CFG.assistLook, air = k.air > 0;
  for (let d = 0.4; d <= reach; d += 0.4) {
    const cx = k.x + fx * d, cz = k.z + fz * d;
    const c = collide(world, cx, cz, CFG.CART_R, air, true);
    if (!c) continue;
    const nx = c.nx, nz = c.nz, dot = fx * nx + fz * nz;
    if (c.solid.dash || dot > -0.55) break;         // a dash target, or a glancing approach (shelves want hugging)
    // probe just past the contact, to the left (+) and right (-) of the path
    const w = CFG.CART_R, pr = CFG.CART_R * 0.4, ax = cx + fx * 0.8, az = cz + fz * 0.8;
    const leftHit = collide(world, ax + fz * w, az - fx * w, pr, air, true) !== null;
    const rightHit = collide(world, ax - fz * w, az + fx * w, pr, air, true) !== null;
    let dir = 0, power = 1;
    if (leftHit !== rightHit) { dir = leftHit ? -1 : 1; power = 1.5; }   // a corner or shelf end: swerve past it
    else {
      const side = nx * fz - nz * fx;
      if (Math.abs(side) > 0.08) { dir = Math.sign(side); power = clamp((-dot - 0.55) / 0.45, 0, 1); }
    }
    if (dir && k.steer * dir > -0.2) k.help = dir * CFG.assistYaw * power;   // never fight the driver
    break;
  }
  return k.help;
}

// Which way along a surface a crashing cart glances off: +1 = along (tx, tz), -1 = the other way.
// The driver's steering decides; otherwise the side where the obstacle ends sooner and the way is
// longer, with a slight preference for the way the cart was already leaning.
function crashSide(k, world, nx, nz, tx, tz) {
  const fx = Math.sin(k.h), fz = Math.cos(k.h), left = tx * fz - tz * fx;
  if (Math.abs(k.steer) > 0.2 && Math.abs(left) > 0.1) return Math.sign(left * k.steer);
  let best = 1, bestScore = -1e9;
  for (const s of [1, -1]) {
    let free = 0, ends = 0;
    for (let d = 0.6; d <= 3.6; d += 0.6) {
      const px = k.x + tx * s * d, pz = k.z + tz * s * d;
      if (collide(world, px + nx * 0.15, pz + nz * 0.15, CFG.CART_R, false, true)) break;
      free = d;
      if (!ends && !collide(world, px - nx * (CFG.CART_R + 0.5), pz - nz * (CFG.CART_R + 0.5), 0.2, false, true)) ends = d;
    }
    const score = free + (ends ? 4 - ends : 0) + (k.vx * tx + k.vz * tz) * s * 0.15;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

// A hard hit: nearly head-on, at speed. A crash costs goods, not momentum (GDD 4): the cart glances
// off along the surface (normal nx, nz) with part of its speed and its nose whips round to follow.
// While the cart is still immune from the last hit it glances off the same way but loses nothing more.
function hardHit(k, sim, nx, nz, speed, into, top0, solid) {
  const tx = -nz, tz = nx, side = crashSide(k, sim.world, nx, nz, tx, tz), keep = speed * CFG.crashKeep;
  k.vx = tx * side * keep + nx * 0.6; k.vz = tz * side * keep + nz * 0.6;
  k.turnTo = Math.atan2(k.vx, k.vz);
  k.stunT = Math.max(k.stunT, k.immuneT > 0 ? CFG.crashStun * 0.5 : CFG.crashStun);
  k.wnx = nx; k.wnz = nz;
  if (k.drift) endDrift(k, top0, sim, false);
  k.dashT = 0; k.sagT = 0;
  if (k.immuneT > 0) sim.emit('bump', k, into, solid);
  else { k.immuneT = TUNE.immunity; sim.onCrash(k, into, solid); }
}

export function stepCart(k, inp, sim, dt) {
  const world = sim.world;
  k.px = k.x; k.pz = k.z; k.ph = k.h;

  // ---- timers
  if (k.dashCd > 0) { k.dashCd -= dt; if (k.dashCd <= 0) sim.emit('dashready', k); }
  if (k.dashT > 0) {
    k.dashT -= dt;
    // A dash that hit nothing leaves the cart a little slow for a moment: the lunge is a commitment.
    if (k.dashT <= 0 && k.dashHits === 0 && k.boostT <= 0) k.sagT = CFG.dashSagTime;
  }
  if (k.sagT > 0) k.sagT -= dt;
  if (k.straightT > 0) k.straightT -= dt;
  if (k.boostT > 0) { k.boostT -= dt; if (k.boostT <= 0) k.boostMul = 1; }
  if (k.stunT > 0) { k.stunT -= dt; if (k.stunT <= 0) k.turnTo = null; }
  if (k.immuneT > 0) k.immuneT -= dt;
  if (k.wetT > 0) k.wetT -= dt;
  if (k.scrapeT > 0) k.scrapeT -= dt;
  if (k.backT > 0) k.backT -= dt;
  if (k.wallT > 0) k.wallT -= dt; else { k.pinT = 0; if (k.backT <= 0) k.pinDir = 0; }

  const mad = k.madT > 0;
  const lf = mad ? 0 : loadFactor(k);
  const top0 = TUNE.maxspeed * (1 - TUNE.loadtop * lf);
  const top = top0 * (k.boostT > 0 ? k.boostMul : k.sagT > 0 && k.dashT <= 0 ? CFG.dashSag : 1);
  const backing = k.backT > 0;
  const free = k.stunT <= 0 && k.air <= 0 && !backing;   // the driver has control

  // ---- steering input builds fast and recentres faster
  const want = free ? clamp(inp.steer, -1, 1) : 0;
  const build = Math.abs(want) > Math.abs(k.steer) || want * k.steer < 0;
  k.steer = approach(k.steer, want, (build ? CFG.steerRise : CFG.steerFall) * dt);

  // ---- dash, with a short buffer for early presses
  if (inp.dash) { k.dashBuf = CFG.dashBuffer; inp.dash = false; }
  if (k.dashBuf > 0) {
    k.dashBuf -= dt;
    if (k.dashCd <= 0 && free) {
      if (k.drift) endDrift(k, top0, sim, true);    // a dash out of a drift keeps the earned boost
      k.dashBuf = 0; k.dashT = CFG.dashTime; k.dashCd = TUNE.dashcooldown; k.dashHits = 0; k.sagT = 0;
      const v = Math.max(Math.hypot(k.vx, k.vz) + TUNE.dashspeed, top0 * 0.65);
      k.vx = Math.sin(k.h) * v; k.vz = Math.cos(k.h) * v;
      sim.emit('dash', k);
    }
  }

  // ---- drift: hold the button while steering at speed; release for the boost
  const fast = k.spd > top0 * CFG.driftMinSpeed;
  if (!k.drift) {
    if (inp.drift && free && fast && k.dashT <= 0 && Math.abs(k.steer) > 0.25) {
      k.drift = Math.sign(k.steer); k.driftT = 0; k.tier = 0;
      sim.emit('drift', k, 0);
    }
  } else if (!inp.drift) {
    endDrift(k, top0, sim, true);
  } else if (!fast || !free) {
    endDrift(k, top0, sim, false);
  } else {
    k.driftT += dt;
    if (k.tier < 3 && k.driftT >= CFG.driftTiers[k.tier]) { k.tier++; sim.emit('drift', k, k.tier); }
  }

  // ---- yaw
  const roll = clamp(Math.abs(k.spd) / 2.5, free && inp.gas > 0 ? 0.45 : 0, 1);   // a pushed cart can pivot
  const rate = TUNE.turnrate * lerp(1, TUNE.turnattop, clamp(Math.abs(k.spd) / TUNE.maxspeed, 0, 1)) *
    (1 - TUNE.loadturn * lf) * roll;
  let yaw;
  if (backing) {
    yaw = k.pinDir * CFG.backYaw;                    // backing out of a pinch, nose swinging to the open side
  } else if (k.stunT > 0 && k.turnTo !== null) {
    yaw = clamp(wrapAngle(k.turnTo - k.h) / dt, -CFG.crashWhip, CFG.crashWhip);   // the nose whips round after a crash
  } else if (k.drift) {
    // The drift turns at a rate that does not depend on speed, so the slip angle stays put instead of
    // winding up as the cart slows: sin(slip) = yaw / driftgrip.
    const along = k.steer * k.drift;                 // +1 steering into the drift, -1 out of it
    const arc = k.drift * TUNE.turnrate * TUNE.turnattop * (1 - TUNE.loadturn * lf) * TUNE.driftturn *
      lerp(CFG.driftRange[0], CFG.driftRange[1], (along + 1) / 2);
    // The rear steps out at once: the body swings to the slip angle this arc holds, so the path
    // starts curving on the first frames instead of trailing behind the body.
    yaw = arc + (Math.asin(clamp(arc / TUNE.driftgrip, -0.95, 0.95)) - k.slip) * CFG.driftKick;
  } else {
    yaw = k.steer * rate * (k.spd < -0.2 ? -1 : 1);
    if (k.straightT > 0) yaw -= k.slip * CFG.driftKick;   // leaving a drift: the body swings back onto the path
  }
  if (k.dashT > 0) yaw *= CFG.dashSteer;
  if (free) yaw += helperYaw(k, inp, world);
  k.yaw = yaw;
  k.h = wrapAngle(k.h + yaw * dt);

  // ---- travel direction, slip and grip
  let v = Math.hypot(k.vx, k.vz);
  let slip = v > 0.05 ? wrapAngle(k.h - Math.atan2(k.vx, k.vz)) : 0;
  let back = false;
  if (Math.abs(slip) > Math.PI / 2) { back = true; slip = wrapAngle(slip - Math.PI); v = -v; }
  const grip = back ? TUNE.grip : k.wetT > 0 ? CFG.wetGrip : k.drift ? TUNE.driftgrip : k.straightT > 0 ? CFG.stunGrip : free ? TUNE.grip : CFG.stunGrip;
  slip -= Math.sin(slip) * (1 - Math.exp(-grip * dt));

  // ---- speed along the travel direction
  const acc = TUNE.accel * (1 - TUNE.loadaccel * lf) * (k.boostT > 0 ? CFG.boostAccel : 1);
  if (backing) {
    v = -CFG.backSpeed; slip = 0;
  } else if (!free || k.dashT > 0) {
    // no pedals while stunned or in the air (a crash keeps its momentum); the dash holds its speed
  } else if (inp.brake > 0) {
    if (v > 0.2) v = Math.max(0, v - TUNE.brake * (1 - TUNE.loadbrake * lf) * inp.brake * dt);
    else v = Math.max(-top0 * CFG.reverseTop, v - acc * 0.6 * inp.brake * dt);
  } else if (inp.gas > 0) {
    const target = top * inp.gas;
    if (v < 0) v = Math.min(0, v + TUNE.brake * dt);
    else if (v < target) { const u = v / top; v = Math.min(target, v + acc * (1 - 0.6 * u * u) * Math.cos(slip) * dt); }
    else if (v <= top) v = Math.max(target, v - CFG.coast * dt);
  } else {
    v = approach(v, 0, CFG.coast * dt);
  }
  if (v > top && k.dashT <= 0 && free) v = Math.max(top, v - (k.dashCd > TUNE.dashcooldown - CFG.dashTime - 0.5 ? CFG.dashSettle : CFG.overTopDecel) * dt);
  v -= v * CFG.driftScrub * Math.abs(Math.sin(slip)) * dt;      // sliding sideways scrubs a little speed
  if (k.wallT > 0 && free) v -= v * CFG.scrapeDrag * dt;        // so does rubbing along a wall or shelf

  const dir = k.h - slip;
  k.vx = Math.sin(dir) * v; k.vz = Math.cos(dir) * v;
  k.slip = back ? 0 : slip;

  // ---- move and collide
  k.x += (k.vx + k.convX) * dt; k.z += (k.vz + k.convZ) * dt;
  let crashed = false, touched = 0, sumX = 0, sumZ = 0;
  const v0x = k.vx, v0z = k.vz, speed0 = Math.hypot(v0x, v0z);
  for (let pass = 0; pass < 4; pass++) {
    const c = collide(world, k.x, k.z, CFG.CART_R, k.air > 0, false);
    if (!c) break;
    const s = c.solid, nx = c.nx, nz = c.nz;        // copied: the contact object is reused by later queries
    if (s && s.soft) { s.on = false; sim.onKnock(k, s); continue; }
    if (s && s.dash && (k.dashT > 0 || mad)) { s.on = false; sim.onSmash(k, s); continue; }
    k.x += nx * c.depth; k.z += nz * c.depth;
    const vn = k.vx * nx + k.vz * nz;
    if (vn >= 0) continue;
    const into = -vn, speed = Math.hypot(k.vx, k.vz);
    const bouncy = s && s.type === 'glass';
    const hard = !bouncy && into > CFG.crashSpeed && into > speed * CFG.crashCos;   // nearly head-on, at speed
    k.wallT = 0.12; k.wnx = nx; k.wnz = nz;
    if (hard) {
      crashed = true;
      hardHit(k, sim, nx, nz, speed, into, top0, s);
    } else {
      touched++; sumX += nx; sumZ += nz;
      const e = bouncy ? 0.6 : CFG.wallBounce;
      k.vx -= (1 + e) * vn * nx; k.vz -= (1 + e) * vn * nz;
      const tx = -nz, tz = nx, vt = k.vx * tx + k.vz * tz;
      const loss = Math.min(Math.abs(vt), CFG.wallFriction * into) * Math.sign(vt);
      k.vx -= loss * tx; k.vz -= loss * tz;
      if (into > 2) sim.emit('bump', k, into, s);
    }
  }
  // An inside corner: two glancing surfaces in one step that together stopped the cart. It counts as
  // one hard hit against the corner's bisector, so the cart glances out instead of dying there.
  if (!crashed && touched >= 2 && speed0 > CFG.crashSpeed && Math.hypot(k.vx, k.vz) < speed0 * 0.4) {
    const len = Math.hypot(sumX, sumZ);
    if (len > 0.3) { crashed = true; hardHit(k, sim, sumX / len, sumZ / len, speed0, -(v0x * sumX + v0z * sumZ) / len, top0, null); }
  }
  // Rubbing along a surface: turn the body to follow it, and throw sparks now and then.
  if (k.wallT > 0.1 && !crashed && free) {
    const sp = Math.hypot(k.vx, k.vz);
    if (sp > 1) {
      const off = wrapAngle(k.h - Math.atan2(k.vx, k.vz));
      if (Math.abs(off) < 1.3) k.h = wrapAngle(k.h - off * Math.min(1, CFG.wallAlign * dt));
      // ...and peel off it unless the driver is steering into it, so a scrape does not turn into a grind
      const away = Math.sign(k.wnx * Math.cos(k.h) - k.wnz * Math.sin(k.h));
      if (k.steer * away > -0.1) k.h = wrapAngle(k.h + away * CFG.wallPeel * dt);
      if (sp > 3 && k.scrapeT <= 0) { k.scrapeT = 0.08; sim.emit('scrape', k, sp); }
    }
  }
  const fwd = k.vx * Math.sin(k.h) + k.vz * Math.cos(k.h);
  k.spd = Math.hypot(k.vx, k.vz) * (fwd < 0 ? -1 : 1);

  // Still pinned after a moment of pushing (a notch, a dead-end): back out and swing the other way.
  if (free && inp.gas > 0 && Math.abs(k.spd) < 1 && k.wallT > 0) {
    k.pinT += dt;
    if (k.pinT > CFG.pinPatience) { k.pinT = 0; k.backT = CFG.backTime; k.pinDir = k.pinDir ? -k.pinDir : 1; k.backs++; }
  } else if (Math.abs(k.spd) > 2) k.pinT = 0;
}
