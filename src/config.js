// DOORBUSTER — config.js
// Purpose: every shared constant in one place: tune defaults (a mirror of tune.json), fixed
//          constants that do not fit in the 40 platform values, the palette, the goods catalogue,
//          the characters, small math helpers and the seeded random generator.
// Exports: TUNE, applyTune, CFG, PAL, rgb, mix, GOODS, GOOD, POOLS, CHARS, makeRng, clamp, lerp,
//          wrapAngle, approach
// Depends on: nothing. Safe to import from Node (no DOM, no THREE).

// ---- Tune values. tune.json must list the same names; these are the in-code defaults. ----------
export const TUNE = {
  maxspeed: 12, accel: 14, brake: 20, turnrate: 3, turnattop: 0.5, grip: 20, driftgrip: 3.5,
  driftturn: 1.35, turbopower: 1.4, dashspeed: 6, dashcooldown: 1.5,
  loadfull: 40, loadfree: 0.3, loadaccel: 0.55, loadbrake: 0.3, loadtop: 0.1, loadturn: 0.2,
  overstack: 1.5, spillmax: 0.4, recollect: 4, sweepgap: 0.6, magnet: 0.9,
  madnessfill: 1, madnessdrain: 1, madnesstime: 6, ramdrop: 0.3, immunity: 1.5,
  timer: 90, timebonus: 15, rivals: 5, rivalskill: 1, rivalaggro: 1, crowd: 1,
  camheight: 7, campitch: 40, camfov: 55, shake: true, outline: true,
};

// Copies known values of the right type from a { name: value } map (platform or tune.json).
export function applyTune(values) {
  if (!values) return;
  for (const key in TUNE) {
    if (typeof values[key] === typeof TUNE[key]) TUNE[key] = values[key];
  }
}

// ---- Fixed constants (not exposed on the platform) ---------------------------------------------
export const CFG = {
  STEP: 1 / 120,          // fixed simulation step, seconds
  TILE: 2,                // metres per plan character
  CART_R: 0.6,            // nominal cart radius (pickup reach, bot clearance), metres
  noseAt: 0.28, noseR: 0.56,   // the cart collides as two circles: the nose (basket and bumper)...
  tailAt: -0.75, tailR: 0.5,   // ...and the tail (the shopper); offsets are along the heading
  WALL_H: 2.4,            // wall height, metres (kept low so the high camera sees over it)
  // steering and speed
  steerRise: 9,           // how fast the steering input builds, 1/s
  steerFall: 14,          // how fast it recentres, 1/s
  coast: 4,               // deceleration with no pedal, m/s2
  reverseTop: 0.35,       // reverse speed as a share of top speed
  overTopDecel: 9,        // how fast speed above the current top bleeds off, m/s2
  dashSettle: 22,         // the same right after a dash, so the lunge is a lunge and not a cruise
  // drift and boost
  driftMinSpeed: 0.4,     // share of top speed needed to start or keep a drift
  driftTiers: [0.5, 1.0, 1.7],   // seconds of drift for spark tiers 1..3
  driftRange: [0.32, 1.0], // yaw multiplier when steering out of / into the drift (1 = driftturn in full)
  driftKick: 10,          // how fast the body swings out to its drift angle and back, 1/s
  driftStraight: 0.18,    // seconds the body takes to swing back onto its path after a drift
  driftScrub: 0.35,       // speed bled per second at full slip, 1/s
  boostScale: [0.5, 1, 1.5],     // tier boost = 1 + (turbopower - 1) * scale
  boostTime: [0.7, 1.0, 1.4],    // seconds of boost per tier
  boostAccel: 2.5,        // acceleration multiplier while boosting
  // dash
  dashTime: 0.33, dashBuffer: 0.15, dashSteer: 0.5, dashReach: 0.35,
  dashSag: 0.82,          // top speed share for a moment after a dash that hit nothing
  dashSagTime: 0.7,       // how long that lasts, seconds
  ramWarn: 0.8,           // seconds between a rival's "!" and its lunge at the player (it holds its line meanwhile)
  shedKnock: 5,           // speed into something (m/s) that shakes goods off an overloaded tower
  // walls
  wallBounce: 0.15, wallFriction: 0.25, wallAlign: 9,
  wallTurn: 6,            // fastest the body turns to follow a surface, rad/s
  slideKeep: 0.6,         // a slide along a wall keeps at least this share of the speed
  wallPeel: 0.5,          // how fast a rubbing cart turns away from the surface, rad/s
  scrapeDrag: 0.4,        // share of speed lost per second while rubbing a wall or shelf
  crashSpeed: 6.5,        // speed into a wall (along its normal) that counts as a crash, m/s
  crashCos: 0.85,         // and the hit must be this head-on (cos of the angle to the normal: within about 32 degrees)
  crashKeep: 0.55,        // share of speed a crash keeps, redirected along the surface
  crashWhip: 8,           // how fast the nose swings round after a crash, rad/s
  crashStun: 0.4,         // seconds of lost control after a crash
  stunGrip: 3,            // side grip while spinning or stunned
  spinDrag: 2.2,          // share of speed a rammed rival loses per second while it spins
  wetGrip: 1.2,           // side grip on a wet floor
  assistLook: 0.45,       // seconds ahead the wall-avoid helper looks
  assistYaw: 0.7,         // strongest helper yaw, rad/s
  sweepReach: 1.5,        // the sweep-lane helper works within this gap to a stocked shelf, metres
  sweepHold: 0.25,        // the gap it holds, metres
  sweepYaw: 0.6,          // its strongest yaw, rad/s
  pinYaw: 4.5,            // how fast a cart pinned nose-first swings along the wall, rad/s
  pinPatience: 0.3,       // seconds of pushing with no movement before the cart backs out by itself
  backTime: 0.32, backSpeed: 3.5, backYaw: 2.8,   // the automatic back-out: seconds, m/s, rad/s
  // level objects (LEVELS.md section 4)
  wipeTime: 1.1,          // seconds from a wipeout to the respawn at the last checkpoint
  respawnImmune: 1.2,     // seconds a respawned cart cannot be wiped out or rammed
  popTime: 0.75,          // seconds in the air after a pop-up tile
  padBoost: 6, padTime: 0.8,   // boost arrows: m/s over the top speed, seconds
  watchTime: 5,           // seconds a stopwatch adds
  smashSpeed: 8,          // a plain hit this fast (m/s into it) smashes a can pyramid; slower ones topple a third
  canPrice: 10, megaCan: 40,   // SMASH: dollars per can (times the multiplier), per golden can of the MEGA PYRAMID
  bumpKnock: 5,           // a plain bump this hard (m/s) knocks the top goods off a rival
  closingTime: 15,        // CLOSING TIME: the last seconds on the clock
  // mall kit
  beltSpeed: 4,           // a conveyor carries a cart this fast, m/s (with it: faster; against it: about half speed)
  jumpSpeed: 7,           // speed along a ramp needed to take off, m/s
  jumpTime: 0.9,          // seconds in the air (at top speed that is 10.8 m)
  jumpHeight: 1.7,        // how high the arc looks, metres
  trainSpeed: 7, trainCars: 3,   // the cart train: m/s and carts in the string (1.5 m apart)
  countdown: 2.4,         // seconds from the click to GO
  camFollow: 6.5,         // how fast the camera's yaw follows the cart, 1/s (lag at full lock is about 14 degrees)
  // Madness: the meter runs over four segments (0..4); a full one is MADNESS mode
  madWait: 2.5,           // seconds without a gain before the meter starts to drain
  madDrain: 0.12,         // segments per second once it drains
  madTake: { S: 0.04, M: 0.09, L: 0.2, H: 0.5 },   // gain per item taken, by size (a chain of takes adds up to half as much again)
  madDrift: 0.3,          // gain per spark tier when a drift is released into its boost
  // scoring
  listBonus: 200,         // dollars for bringing all three list items to the checkout
  stunts: { cleansweep: 50, strike: 150, ram: 75, takedown: 200, shave: 10, smash: 25, jump: 250, dodge: 40, selfie: 150, glass: 100 },
};

// ---- Palette (ART.md section 3). Stored as sRGB hex; rgb() converts to 0..1 floats. ----------
export const PAL = {
  floor: 0xF3E9DC, grout: 0xE6D8C5, wall: 0xFFF6EA, walltop: 0x5B4A78, white: 0xFFFFFF, steel: 0xDDE3EA,
  night: 0x1E1B2E, sale: 0xFFD23F, danger: 0xFF3B4E, player: 0xFF4FA3,
  list: 0x00D1C1, hot: 0xFFC800, outline: 0x2A1A3A,
  zones: [0x8EE3C8, 0xFF8A7A, 0x7CC6FE, 0xFFD166],
  rivals: [0x9B5DE5, 0x2EC4B6, 0xFF9F1C, 0x3A86FF, 0x8AC926],
  crowd: [0xB8C0CC, 0xC9BBCF, 0xBFD3C1],
  red: 0xE84855, orange: 0xFF9F1C, blue: 0x3A86FF, green: 0x8AC926, teal: 0x2EC4B6,
  purple: 0x9B5DE5, sky: 0x7CC6FE, coral: 0xFF8A7A, mint: 0x8EE3C8, brown: 0xC98A5B, skin: 0xFFD9B8,
  leaf: 0x4FA83D, shadow: 0x3A2B52,
  tiers: [0xFFFFFF, 0x7CC6FE, 0xFFD23F, 0xFF3B4E],   // drift charge: none, tier 1, 2, 3 (never the player's pink)
};
export function rgb(hex) {
  return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
}
// A colour between two palette colours (t = 0 gives a, 1 gives b), as a hex number.
export function mix(a, b, t) {
  const ch = (s) => Math.round((a >> s & 255) * (1 - t) + (b >> s & 255) * t);
  return ch(16) << 16 | ch(8) << 8 | ch(0);
}

// ---- Goods. size: S small, M medium, L large, H hot. w = weight units, slots = tower cells. ----
// dims are [width, height, depth] in metres, deliberately oversized (ART.md section 4).
export const GOODS = [
  { id: 'can',       size: 'S', w: 1, price: 8,   dims: [0.40, 0.44, 0.40] },
  { id: 'soda',      size: 'S', w: 1, price: 6,   dims: [0.34, 0.56, 0.34] },
  { id: 'chips',     size: 'S', w: 1, price: 5,   dims: [0.44, 0.50, 0.26] },
  { id: 'roll',      size: 'S', w: 1, price: 10,  dims: [0.44, 0.40, 0.44] },
  { id: 'cereal',    size: 'S', w: 1, price: 12,  dims: [0.40, 0.54, 0.22] },
  { id: 'phone',     size: 'S', w: 1, price: 15,  dims: [0.36, 0.48, 0.20] },
  { id: 'game',      size: 'S', w: 1, price: 14,  dims: [0.40, 0.46, 0.18] },
  { id: 'toaster',   size: 'M', w: 2, price: 35,  dims: [0.62, 0.46, 0.44] },
  { id: 'melon',     size: 'M', w: 2, price: 22,  dims: [0.58, 0.54, 0.58] },
  { id: 'pizza',     size: 'M', w: 2, price: 20,  dims: [0.68, 0.22, 0.68] },
  { id: 'headset',   size: 'M', w: 2, price: 45,  dims: [0.56, 0.60, 0.40] },
  { id: 'shoes',     size: 'M', w: 2, price: 60,  dims: [0.70, 0.36, 0.46] },
  { id: 'microwave', size: 'L', w: 4, price: 120, dims: [0.92, 0.60, 0.70] },
  { id: 'speaker',   size: 'L', w: 4, price: 180, dims: [0.66, 1.00, 0.62] },
  { id: 'suitcase',  size: 'L', w: 4, price: 140, dims: [0.90, 0.70, 0.50] },
  { id: 'tv',        size: 'H', w: 6, price: 350, dims: [1.30, 0.86, 0.36] },
  { id: 'bear',      size: 'H', w: 6, price: 250, dims: [0.96, 1.10, 0.90] },
  { id: 'console',   size: 'H', w: 7, price: 450, dims: [1.00, 0.56, 0.84] },
  { id: 'robovac',   size: 'H', w: 8, price: 560, dims: [1.04, 0.40, 1.04] },
  { id: 'frozenpizza', size: 'L', w: 4, price: 95, dims: [0.86, 0.36, 0.66] },
  { id: 'icecream',  size: 'L', w: 4, price: 85,  dims: [0.62, 0.62, 0.62] },
];
export const GOOD = {};            // id -> index into GOODS
GOODS.forEach((g, i) => { GOOD[g.id] = i; g.slots = g.size === 'S' ? 1 : g.size === 'M' ? 2 : g.size === 'L' ? 4 : 8; });

// Which goods a store zone stocks on its shelves, by shelf letter (S, M, L) and for floor trails.
export const POOLS = {
  market: { S: ['can', 'soda', 'chips', 'cereal', 'roll'], M: ['melon', 'pizza', 'toaster'], L: ['frozenpizza', 'icecream'] },
  gadget: { S: ['phone', 'game', 'soda'], M: ['headset', 'toaster', 'shoes'], L: ['speaker', 'microwave'] },
  atrium: { S: ['chips', 'soda', 'roll', 'game'], M: ['shoes', 'pizza', 'melon'], L: ['suitcase', 'speaker'] },
};

// ---- Characters. One silhouette, one colour, one behaviour each (GDD 5.6). ---------------------
// skill 0..1 (line precision, reaction), pace = share of full throttle, greed = appetite for shelves,
// aggro = appetite for ramming.
export const CHARS = {
  player: { name: 'You',          color: PAL.player,    skill: 1,    pace: 1,    greed: 1,    aggro: 1 },
  granny: { name: 'Granny Tank',  color: PAL.rivals[0], skill: 0.6,  pace: 0.84, greed: 1,    aggro: 0.1 },
  selfie: { name: 'Selfie Star',  color: PAL.rivals[1], skill: 0.7,  pace: 0.95, greed: 0.85, aggro: 0.3 },
  queen:  { name: 'Coupon Queen', color: PAL.rivals[2], skill: 0.8,  pace: 0.96, greed: 1,    aggro: 0.4 },
  dad:    { name: 'Sprint Dad',   color: PAL.rivals[3], skill: 0.95, pace: 1,    greed: 0.9,  aggro: 0.6 },
  bro:    { name: 'Bulk Bro',     color: PAL.rivals[4], skill: 0.65, pace: 0.92, greed: 0.9,  aggro: 0.9 },
};

// ---- Math helpers --------------------------------------------------------------------------------
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
export function approach(cur, target, maxDelta) {
  return cur < target ? Math.min(target, cur + maxDelta) : Math.max(target, cur - maxDelta);
}

// Deterministic random generator (mulberry32). rng() -> [0,1); rng.range(a,b); rng.int(n); rng.pick(list).
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (list) => list[Math.floor(rng() * list.length)];
  return rng;
}
