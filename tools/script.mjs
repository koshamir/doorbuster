// DOORBUSTER tool — script.mjs
// Scripted-input runner: replays timed key sequences against the real cart model in synthetic rooms
// and prints the feel measurements (speed, yaw rate, slip angle, timings). Deterministic.
// Run: node tools/script.mjs [--only basics,drift,bends,dash,response,walls,gap,sweep,spill,beginner,hz]
import { loadTune, args, room, table, TUNE, CFG } from './lib.mjs';
import { makeRng } from '../src/config.js';
import { createSim, stepSim, advanceSim, giveGoods } from '../src/sim.js';
import { addSolid } from '../src/world.js';

const a = args();
loadTune();
const only = a.only ? String(a.only).split(',') : null;
const want = (name) => !only || only.includes(name);
const DEG = 180 / Math.PI, STEP = CFG.STEP;
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

function make(def, load = 0, bot) {
  const sim = createSim(def || room(), 1, { countdown: 0, bot });
  sim.player.load = load;
  return sim;
}
// Steps the sim for `seconds` holding `keys` ({ steer, gas, brake, drift, dash }); calls each(sim, i) per step.
function hold(sim, seconds, keys, each) {
  const inp = sim.player.input, n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    inp.steer = keys.steer || 0; inp.gas = keys.gas || 0; inp.brake = keys.brake || 0; inp.drift = !!keys.drift;
    if (keys.dash && (keys.dash === 'mash' || i === 0)) inp.dash = true;
    stepSim(sim);
    if (each) each(sim, i);
  }
}
const events = (sim, type) => sim.events.filter((e) => e.type === type).length;
const topOf = (load) => TUNE.maxspeed * (1 - TUNE.loadtop * Math.max(0, Math.min(1, (Math.min(1, load / TUNE.loadfull) - TUNE.loadfree) / (1 - TUNE.loadfree))));
// Puts the player at (x, z) moving along `heading` at `speed`.
function launch(sim, x, z, heading, speed) {
  const p = sim.player;
  p.x = x; p.z = z; p.h = heading; p.vx = Math.sin(heading) * speed; p.vz = Math.cos(heading) * speed; p.spd = speed;
  return p;
}
// A plan from a list of floor rectangles [col0, row0, col1, row1] and single characters [col, row, char].
function planOf(cols, rows, rects, marks) {
  const g = [];
  for (let r = 0; r < rows; r++) g.push(new Array(cols).fill(' '));
  for (const [c0, r0, c1, r1] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = '.';
  for (const [c, r, ch] of marks) g[r][c] = ch;
  return { id: 'test', name: 'TEST', timer: 600, heading: Math.PI / 2, rivals: [], crowd: 0, list: [], zones: [{ pool: 'market', color: 0 }], plan: g.map((l) => l.join('')) };
}

// ---- 0 -> top speed, stopping distance, full-lock circle: empty and full ---------------------------
if (want('basics')) {
  const rows = [];
  for (const [name, load] of [['empty', 0], ['half', TUNE.loadfull * 0.5], ['full', TUNE.loadfull]]) {
    const top = topOf(load);
    let sim = make(null, load), p = sim.player, t95 = 0, d95 = 0;
    const x0 = p.x;
    hold(sim, 6, { gas: 1 }, (s, i) => { if (!t95 && p.spd >= top * 0.95) { t95 = (i + 1) * STEP; d95 = p.x - x0; } });
    const reached = p.spd, xs = p.x;
    let stopT = 0, stopD = 0;
    hold(sim, 3, { brake: 1 }, (s, i) => { if (!stopT && p.spd <= 0.05) { stopT = (i + 1) * STEP; stopD = p.x - xs; } });
    sim = make(room(80, 60), load); p = sim.player;
    hold(sim, 3, { gas: 1 });
    hold(sim, 4, { gas: 1, steer: 1 });
    let minX = 1e9, maxX = -1e9, yaw = 0, slip = 0, spd = 0, n = 0;
    hold(sim, 6, { gas: 1, steer: 1 }, () => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); yaw += p.yaw; slip += p.slip; spd += p.spd; n++; });
    rows.push([name, reached, t95, d95, stopT, stopD, (maxX - minX) / 2, yaw / n, slip / n * DEG, spd / n]);
  }
  table('Basics — launch, stop, full-lock circle at top speed',
    ['load', 'top m/s', '0-95% s', 'dist m', 'stop s', 'stop m', 'turn radius m', 'yaw rad/s', 'slip deg', 'speed in turn'], rows);
}

// ---- drift tiers in the open: what the body does and what the path does ---------------------------
if (want('drift')) {
  const rows = [];
  for (const [name, load, stick] of [['empty, stick in', 0, 1], ['empty, stick neutral', 0, 0], ['empty, stick out', 0, -1], ['full, stick in', TUNE.loadfull, 1]]) {
    for (const holdT of [0.7, 1.3, 2.1]) {
      const sim = make(room(100, 80), load), p = sim.player, top = topOf(load);
      hold(sim, 3, { gas: 1 });
      let slip = 0, n = 0, tier = 0, dist = 0, psi0 = Math.atan2(p.vx, p.vz), turnPath = 0;
      const track = () => {
        slip += p.slip; n++; tier = Math.max(tier, p.tier);
        dist += Math.hypot(p.x - p.px, p.z - p.pz);
        const psi = Math.atan2(p.vx, p.vz); turnPath += wrap(psi - psi0); psi0 = psi;
      };
      hold(sim, 0.1, { gas: 1, steer: 1, drift: true }, track);     // press the direction and the drift button together
      hold(sim, holdT - 0.1, { gas: 1, steer: stick, drift: true }, track);
      let peak = 0, above = 0;
      hold(sim, 3, { gas: 1 }, () => { peak = Math.max(peak, p.spd); if (p.spd > top + 0.3) above += STEP; });
      rows.push([name, holdT, tier, slip / n * DEG, dist / Math.abs(turnPath), Math.abs(turnPath) * DEG, peak, above]);
    }
  }
  table('Drift in the open — steer + drift at top speed, then release (path radius = distance / change of travel direction)',
    ['case', 'hold s', 'tier', 'slip deg', 'path radius m', 'path turned deg', 'boost peak m/s', 'boost s'], rows);
}

// ---- drift against geometry: which tier a 90-degree bend and a hairpin pay, and how wide the window is ----
if (want('bends')) {
  // 10 m corridors. Bend: east then north. Hairpin: east, round the end of a 2 m wall, back west.
  const bend = planOf(46, 46, [[1, 36, 40, 40], [36, 1, 40, 40]], [[3, 38, '@'], [38, 1, 'c']]);
  const hair = planOf(46, 20, [[1, 7, 40, 11], [36, 1, 40, 11], [1, 1, 40, 5]], [[3, 9, '@'], [2, 3, 'c']]);
  const rows = [];
  for (const [gname, def, exitH, laneZ, cornerX] of [['90-degree bend', bend, Math.PI, 77, 72], ['hairpin', hair, -Math.PI / 2, 19, 72]]) {
    for (const [sname, stick] of [['in', 1], ['neutral', 0], ['out', -1]]) {
      const win = [0, 0, 0, 0]; let bestTier = 0, tried = 0, clean = 0, bestExit = 0;
      for (let turnAt = cornerX - 14; turnAt <= cornerX + 4; turnAt += 0.5) {
        const sim = make(def, 0, 'expert'), p = sim.player, inp = p.input, drv = p.ai;
        p.ai = null;
        launch(sim, turnAt - 14, laneZ, Math.PI / 2, TUNE.maxspeed);
        let phase = 0, tier = 0, t0 = 0, exitV = 0;
        for (let n = 0; n < 7 * 120; n++) {
          if (phase === 0 && p.x >= turnAt) { phase = 1; t0 = n; }
          if (phase === 1) {
            inp.gas = 1; inp.drift = true; inp.steer = n - t0 < 12 ? 1 : stick;
            tier = Math.max(tier, p.tier);
            // let go when the path points down the exit (or the drift has died)
            if (Math.abs(wrap(Math.atan2(p.vx, p.vz) - exitH)) < 0.3 || (n - t0 > 20 && !p.drift)) { phase = 2; inp.drift = false; inp.steer = 0; p.ai = drv; t0 = n; }
          } else if (phase === 0) { inp.gas = 1; inp.steer = 0; inp.drift = false; }
          stepSim(sim);
          if (phase === 2 && n - t0 === 180) exitV = Math.abs(p.spd);
        }
        tried++;
        if (sim.stats.crashes === 0) { clean++; win[tier] += 0.5; if (tier > bestTier || (tier === bestTier && exitV > bestExit)) { bestTier = tier; bestExit = exitV; } }
      }
      rows.push([gname, sname, bestTier, win[1] + win[2] + win[3], win[2] + win[3], win[3], (clean / tried * 100).toFixed(0) + '%', bestExit]);
    }
  }
  table('Drift against geometry — 10 m corridor, turn-in point scanned in 0.5 m steps, drift released when the path points down the exit',
    ['geometry', 'stick', 'best tier, no crash', 'tier 1+ window m', 'tier 2+ window m', 'tier 3 window m', 'no-crash share', 'speed 1.5 s after exit'], rows);
}

// ---- dash ---------------------------------------------------------------------------------------
if (want('dash')) {
  const rows = [];
  for (const [name, pre] of [['from rest', 0], ['at top speed', 3]]) {
    const base = make(room(120, 20)), bp = base.player;
    if (pre) hold(base, pre, { gas: 1 });
    const bx = bp.x; hold(base, 2, { gas: 1 });
    const sim = make(room(120, 20)), p = sim.player;
    if (pre) hold(sim, pre, { gas: 1 });
    const x0 = p.x; let peak = 0, above = 0, first = 0, low = 99;
    hold(sim, 2, { gas: 1, dash: true }, (s, i) => { if (i === 0) first = p.spd; peak = Math.max(peak, p.spd); if (p.spd > TUNE.maxspeed + 0.3) above += STEP; if (i > 40) low = Math.min(low, p.spd); });
    rows.push([name, first, peak, above, low, (p.x - x0) - (bp.x - bx)]);
  }
  const sim = make(room(120, 20)), p = sim.player;
  hold(sim, 3, { gas: 1 }); const xa = p.x;
  hold(sim, 6, { gas: 1, dash: 'mash' });
  const mashed = events(sim, 'dash'), mashDist = p.x - xa;
  const plain = make(room(120, 20)); hold(plain, 3, { gas: 1 }); const xb = plain.player.x; hold(plain, 6, { gas: 1 });
  table('Dash (a dash that hits nothing sags to ' + CFG.dashSag * 100 + '% top speed for ' + CFG.dashSagTime + ' s)',
    ['case', 'speed after 1 step', 'peak m/s', 's above top', 'slowest after', 'metres gained in 2 s'], rows);
  console.log(`  mashing dash for 6 s at top speed: ${mashed} dashes (cooldown ${TUNE.dashcooldown} s), ${(mashDist - (plain.player.x - xb)).toFixed(1)} m against plain driving (${((mashDist / (plain.player.x - xb) - 1) * 100).toFixed(1)}%)`);
}

// ---- response on the next frame -------------------------------------------------------------------
if (want('response')) {
  let sim = make(), p = sim.player;
  hold(sim, STEP, { gas: 1 }); const v1 = p.spd;
  hold(sim, STEP, { gas: 1 }); const v2 = p.spd;
  sim = make(); p = sim.player; hold(sim, 3, { gas: 1 });
  const h0 = p.h; hold(sim, STEP, { gas: 1, steer: 1 }); const y1 = p.yaw;
  hold(sim, STEP, { gas: 1, steer: 1 }); const dh2 = (p.h - h0) * DEG;
  hold(sim, 4 * STEP, { gas: 1, steer: 1 }); const dh6 = (p.h - h0) * DEG;
  hold(sim, 0.2, { gas: 1, steer: 1 }); const yFull = p.yaw;
  console.log('\nResponse (one 60 Hz frame = 2 steps)');
  console.log(`  throttle: speed ${v1.toFixed(3)} m/s after 1 step, ${v2.toFixed(3)} after 2`);
  console.log(`  steering at top speed: yaw ${y1.toFixed(3)} rad/s after 1 step; heading changed ${dh2.toFixed(3)} deg after 2 steps, ${dh6.toFixed(2)} deg after 50 ms; full yaw ${yFull.toFixed(2)} rad/s within 0.25 s`);
  console.log('  (the visible response on the first frame is the body lean and yaw in scene.js, driven by the raw input)');
}

// ---- walls: slide, crash, recovery, pinned, notch, corners, seams, tunnelling ---------------------
if (want('walls')) {
  const rows = [];
  for (const [load, lname] of [[0, 'empty'], [TUNE.loadfull, 'full']]) {
    for (const deg of load ? [45, 90] : [10, 20, 30, 45, 60, 75, 90]) {
      const sim = make(room(80, 40), load), al = deg / DEG, top = topOf(load);
      // approach the north wall (its face is at z = 2) at `deg` to the surface, moving east and north
      const p = launch(sim, 40, 2 + CFG.CART_R + 5 * Math.sin(al) + 0.5, Math.atan2(Math.cos(al), -Math.sin(al)), top);
      let hitT = -1, stuck = 0, minV = 99, v05 = 0, back9 = -1;
      hold(sim, 6, { gas: 1 }, (s, i) => {
        const t = i * STEP, v = Math.abs(p.spd);
        if (hitT < 0 && p.wallT > 0) hitT = t;
        if (hitT < 0) return;
        if (t - hitT < 2) { if (v < 1) stuck += STEP; minV = Math.min(minV, v); }
        if (Math.abs(t - hitT - 0.5) < STEP / 2) v05 = v;
        if (back9 < 0 && t - hitT > 0.05 && v >= top * 0.75) back9 = t - hitT;
      });
      rows.push([lname, deg, sim.stats.crashes ? 'CRASH' : 'slide', top, v05, minV, stuck, back9 < 0 ? 'never' : back9, sim.stats.lostMax]);
    }
  }
  table('Walls — hit a wall at an angle to its surface, holding gas, no steering',
    ['load', 'angle deg', 'result', 'speed in', 'speed +0.5 s', 'min speed 2 s', 'near-zero s', 's back to 75% top', 'no-control s'], rows);

  // The same hits with the wheel held into the wall (oversteer) or away from it: the cart must carry
  // on the way it was going along the wall, never turn back.
  const srow = [];
  for (const deg of [50, 65, 80, 90]) for (const [sname, steer] of [['into the wall', 1], ['away from it', -1]]) {
    const sim = make(room(80, 40)), al = deg / DEG;
    const p = launch(sim, 40, 2 + CFG.CART_R + 5 * Math.sin(al) + 0.5, Math.atan2(Math.cos(al), -Math.sin(al)), TUNE.maxspeed);
    let hitT = -1, minV = 99, x0 = 0, x1 = 0, hMax = 0, lastH = p.h;
    const inp = p.input;
    for (let i = 0; i < 3 * 120; i++) {               // the wheel goes over 0.2 s before the hit and is let go 0.3 s after it
      const t = i * STEP;
      inp.gas = 1; inp.steer = t > 0.2 && (hitT < 0 || t - hitT < 0.3) ? steer : 0;
      stepSim(sim);
      if (hitT < 0 && p.wallT > 0) { hitT = t; x0 = p.x; }
      if (hitT >= 0 && t - hitT < 1.5) { minV = Math.min(minV, Math.abs(p.spd)); hMax = Math.max(hMax, Math.abs(wrap(p.h - lastH)) / STEP); x1 = p.x; }
      lastH = p.h;
    }
    srow.push([deg, sname, sim.stats.crashes ? 'CRASH' : 'slide', minV, (x1 - x0).toFixed(1), x1 > x0 + 3 ? 'carried on' : x1 < x0 - 3 ? (deg === 90 ? 'followed the wheel' : 'TURNED BACK') : 'left the wall', (hMax * DEG).toFixed(0)]);
  }
  table('Walls with the wheel held — moving east and into the north wall; wheel over 0.2 s before the hit, let go 0.3 s after', ['angle deg', 'steering', 'result', 'slowest in 1.5 s', 'metres east in 1.5 s', 'afterwards', 'fastest body turn deg/s'], srow);

  // pinned nose-first and wedged in a notch, gas only
  const prow = [];
  for (const [load, lname] of [[0, 'empty'], [TUNE.loadfull, 'full']]) {
    let sim = make(room(40, 20), load), p = sim.player;
    p.x = 78 - CFG.CART_R - 0.01; let t1 = 0, t3 = 0, still = 0, worst = 0;
    hold(sim, 1.2, { gas: 1 }, (s, i) => {
      const v = Math.abs(p.spd);
      if (!t1 && v > 1) t1 = (i + 1) * STEP;
      if (!t3 && v > 3) t3 = (i + 1) * STEP;
      if (v < 1) { still += STEP; worst = Math.max(worst, still); } else still = 0;
    });
    prow.push(['wall, nose-first', lname, t1, t3, worst, p.backs]);
    // straight into an inside corner (the south-east corner of the room) at top speed, along the diagonal
    sim = make(room(40, 20), load); p = launch(sim, 70, 30, Math.PI * 0.25, topOf(load));
    still = 0; worst = 0; let slow = 99;
    hold(sim, 3, { gas: 1 }, (s, i) => {
      const v = Math.abs(p.spd);
      if (i > 60) slow = Math.min(slow, v);
      if (v < 1) { still += STEP; worst = Math.max(worst, still); } else still = 0;
    });
    prow.push(['inside corner at top speed', lname, 'slowest ' + slow.toFixed(1), '-', worst, p.backs + ' (crashes ' + sim.stats.crashes + ')']);
    // two round displays side by side with a 0.2 m crack between them: drive straight at the crack
    const def = room(40, 20, (g, mid) => { g[mid][20] = 'O'; g[mid + 1][20] = 'O'; });
    sim = make(def, load); p = sim.player;
    p.z += 1; still = 0; worst = 0; let hitT = 0;
    hold(sim, 6, { gas: 1 }, (s, i) => {
      const v = Math.abs(p.spd);
      if (!hitT && p.wallT > 0) hitT = (i + 1) * STEP;
      if (!hitT) return;
      if (v < 1) { still += STEP; worst = Math.max(worst, still); } else still = 0;
    });
    prow.push(['notch between two displays', lname, '-', '-', worst, p.backs + (p.x > 44 ? ' (got past)' : ' (did not get past)')]);
  }
  table('Pinned — gas held, no steering', ['case', 'load', 's to 1 m/s', 's to 3 m/s', 'longest near-zero s', 'automatic back-outs'], prow);

  // outside corner: aim the cart so its centre line passes the corner with a small offset
  const crow = [];
  for (const off of [-0.5, -0.25, 0, 0.25, 0.5]) {
    const def = room(60, 30, (g) => { for (let r = 1; r <= 14; r++) for (let c = 30; c <= 34; c++) g[r][c] = ' '; });
    const sim = make(def), p = sim.player;
    p.x = 40; p.z = 30 + off;            // the block's south face is at z = 30, its west corner at x = 60
    let minV = 99;
    hold(sim, 3, { gas: 1 }, (s, i) => { if (i > 180) minV = Math.min(minV, Math.abs(p.spd)); });
    crow.push([off, sim.stats.crashes, events(sim, 'bump'), sim.stats.zeroT, minV]);
  }
  table('Outside corner — drive at a wall corner, centre offset from the edge line in metres (negative = more of the cart hits the face)',
    ['offset', 'crashes', 'bumps', 'near-zero s', 'slowest m/s'], crow);

  // seams: scrape along separate counter boxes versus one wall at the same angle
  const seamDef = room(80, 30, (g) => { for (let c = 10; c < 70; c++) g[1][c] = 'C'; });
  const res = [];
  for (const [name, def, zFace] of [['one wall', room(80, 30), 2], ['30 counter boxes', seamDef, 4]]) {
    const sim = make(def), al = 15 / DEG;
    const p = launch(sim, 24, zFace + CFG.CART_R + 0.6, Math.atan2(Math.cos(al), -Math.sin(al)), TUNE.maxspeed);
    let minV = 99;
    hold(sim, 4, { gas: 1, steer: -0.15 }, (s, i) => { if (i > 60) minV = Math.min(minV, Math.abs(p.spd)); });
    res.push([name, minV, p.x, sim.stats.crashes]);
  }
  table('Seams — rubbing along a surface for 4 s while steering slightly into it', ['surface', 'min speed', 'x reached', 'crashes'], res);

  // tunnelling: a 0.3 m wall, carts thrown at it at fixed speeds from 40 starting offsets each
  const trow = [];
  for (const speed of [12, 18, 24, 30]) {
    let held = 0, touched = 0, deepest = -9;
    for (let i = 0; i < 40; i++) {
      const sim = make(room(60, 20));
      addSolid(sim.world, { x: 60, z: 20, r: 0, hx: 0.15, hz: 18, type: 'wall', on: true });
      const p = launch(sim, 60 - 0.15 - CFG.CART_R - 1 - i * speed * STEP / 40, 20, Math.PI / 2, speed);
      p.dashT = 0.5; p.immuneT = 9;                   // hold the speed, and bump instead of crashing
      let hit = false, far = 0;
      for (let n = 0; n < 30; n++) { stepSim(sim); if (p.wallT > 0) hit = true; far = Math.max(far, p.x); }
      if (hit) touched++;
      if (far < 60 - 0.15) held++;                    // the cart's centre never entered the wall
      deepest = Math.max(deepest, far);
    }
    trow.push([speed, (speed * STEP).toFixed(3), touched + '/40', held + '/40', deepest]);
  }
  table('Tunnelling — a 0.3 m wall (x 59.85 to 60.15) hit at fixed speeds, 40 start offsets within one step', ['speed m/s', 'metres per step', 'touched the wall', 'stayed in front', 'furthest centre x'], trow);
}

// ---- gap of two cart widths at full speed -----------------------------------------------------------
if (want('gap')) {
  const rows = [];
  for (const off of [0, 0.3, 0.5, 0.6, 0.8]) {
    // two round displays whose edges are 2.2 m apart (centres two tiles apart); the cart's nose is
    // 1.12 m wide, so it clears by 0.54 m on each side when centred
    const def = room(60, 40, (g, mid) => { g[mid - 1][30] = 'O'; g[mid + 1][30] = 'O'; });
    const sim = make(def), p = sim.player;
    p.z += off;
    hold(sim, 6, { gas: 1 });
    rows.push([off, 2.2, sim.stats.crashes, events(sim, 'bump'), p.x > 70 ? 'passed' : 'blocked', Math.abs(p.spd)]);
  }
  table('Gap — straight at two displays at full speed, no steering (beyond 0.54 m off-centre the cart must touch)', ['lateral offset m', 'gap m', 'crashes', 'bumps', 'result', 'speed after'], rows);
}

// ---- sweeping: no visible misses, at any speed --------------------------------------------------------
if (want('sweep')) {
  const rows = [];
  // a wall shelf of 10 tiles (30 small goods); its face is at z = 3.2
  const def = room(60, 20, (g) => { for (let c = 12; c < 22; c++) g[1][c] = 'S'; });
  for (const speed of [6, 12, 19]) {
    const row = [speed];
    for (const gap of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      const sim = make(def), p = launch(sim, 10, 3.2 + CFG.CART_R + gap, Math.PI / 2, speed);
      if (speed > 12) { p.boostMul = 1.6; p.boostT = 9; }
      const total = sim.world.items.length;
      hold(sim, 6, { gas: speed >= 12 ? 1 : 0.5 });
      row.push(sim.world.items.filter((i) => i.taken).length + '/' + total);
    }
    rows.push(row);
  }
  table('Sweeping — goods taken from a 20 m shelf while driving parallel to it (sweepgap ' + TUNE.sweepgap + ' m)',
    ['speed m/s', 'gap 0 (touching)', 'gap 0.2', 'gap 0.4', 'gap 0.6', 'gap 0.8', 'gap 1.0'], rows);
}

// ---- spill: one hit costs at most spillmax, goods can be recovered ----------------------------------------
if (want('spill')) {
  const rows = [];
  for (const n of [2, 6, 20, 40]) {
    const sim = make(room(40, 20)), p = sim.player;
    giveGoods(sim, p, n);
    const had = p.tower.length;
    launch(sim, 60, p.z, Math.PI / 2, TUNE.maxspeed);
    hold(sim, 2.2, { gas: 1 });                      // straight into the east wall
    const lost = had - p.tower.length, onFloor = sim.world.drops.filter((d) => d.live).length;
    for (let i = 0; i < 4 * 120; i++) {              // turn round and drive back through the spill
      const d = sim.world.drops.find((q) => q.live);
      if (!d) break;
      const err = wrap(Math.atan2(d.x - p.x, d.z - p.z) - p.h), inp = p.input;
      inp.steer = Math.max(-1, Math.min(1, err * 2.5)); inp.gas = Math.abs(err) > 1 ? 0.4 : 0.8; inp.brake = 0;
      stepSim(sim);
    }
    rows.push([had, lost, (lost / had * 100).toFixed(0) + '%', onFloor, p.tower.length - (had - lost), sim.stats.crashes]);
  }
  table('Spill — head-on crash at top speed, then driving back over the goods within ' + TUNE.recollect + ' s (limit ' + TUNE.spillmax * 100 + '% per hit)',
    ['items before', 'spilled', 'share', 'on the floor', 'recovered', 'crashes'], rows);
}

// ---- a beginner's first drifts: sloppy timing in a 10 m corridor with a 90-degree corner ----------------
if (want('beginner')) {
  const def = planOf(46, 46, [[1, 36, 40, 40], [36, 1, 40, 40]], [[3, 38, '@'], [38, 1, 'c']]);
  const rng = makeRng(2026);
  const rows = [];
  for (const [name, load] of [['empty', 0], ['full', TUNE.loadfull]]) {
    let ok = 0, crashed = 0, long = 0, okLong = 0, clean = 0; const tiers = [0, 0, 0, 0], N = 300;
    for (let i = 0; i < N; i++) {
      const sim = createSim(def, i + 1, { countdown: 0, bot: 'beginner' });
      const p = sim.player, inp = p.input;
      p.load = load;
      const drv = p.ai; p.ai = null;                 // scripted hands first, the beginner bot afterwards
      const turnAt = 62 + rng() * 12;                // where the player starts turning (ideal is about 69)
      const lag = -0.1 + rng() * 0.35;               // drift button this long after the steering key (may be early)
      const holdT = 0.3 + rng() * 1.5;               // how long the drift button stays down
      const stick = 0.5 + rng() * 0.5;               // analog-ish steering amount
      let tSteer = -1, tier = 0, boosted = false, exitOff = 9;
      for (let n = 0; n < 12 * 120; n++) {
        const t = n * STEP;
        if (tSteer < 0 && p.x >= turnAt) tSteer = t;
        if (p.ai === null) {
          inp.gas = 1; inp.brake = 0;
          const dOn = tSteer >= 0 && t >= tSteer + lag && t < tSteer + lag + holdT;
          const early = tSteer < 0 && lag < 0 && p.x >= turnAt + lag * 12;   // pressed before steering
          inp.steer = tSteer >= 0 && t < tSteer + Math.max(lag, 0) + holdT ? stick : 0;
          inp.drift = dOn || early;
          if (tSteer >= 0 && t >= tSteer + lag + holdT + 0.05) p.ai = drv;   // hands off to the beginner bot
        }
        stepSim(sim);
        tier = Math.max(tier, p.tier);
        for (const e of sim.events) if (e.type === 'boost') { boosted = true; exitOff = Math.abs(wrap(Math.atan2(p.vx, p.vz) - Math.PI)); }
        sim.events.length = 0;
      }
      tiers[tier]++;
      if (boosted && sim.stats.crashes === 0 && exitOff < 0.52) clean++;
      const crash = sim.stats.crashes > 0;
      if (crash) crashed++;
      if (boosted && !crash) ok++;
      if (holdT >= CFG.driftTiers[0] + 0.05) { long++; if (boosted && !crash) okLong++; }
    }
    rows.push([name, N, (ok / N * 100).toFixed(0) + '%', ((1 - (1 - ok / N) ** 2) * 100).toFixed(0) + '%', (okLong / long * 100).toFixed(0) + '%', (clean / N * 100).toFixed(0) + '%', tiers.join(' / '), (crashed / N * 100).toFixed(0) + '%']);
  }
  table('Beginner drift — random sloppy attempts at a 90-degree corner in a 10 m corridor (hold 0.3-1.8 s, stick 50-100%, turn-in spread 12 m)',
    ['load', 'attempts', 'boost, no crash', 'within two tries', 'same if held long enough', 'boost and exit within 30 deg', 'best tier 0/1/2/3', 'crashed'], rows);
}

// ---- frame rate: the same physics and the same input timing at any display rate -----------------------
if (want('hz')) {
  // Key events with wall-clock time stamps, fed through advanceSim the way main.js does it: each
  // frame applies, before every step, the events that are old enough to belong to that step.
  const EV = [[0, 'gas', 1], [2.004, 'steer', 1], [3.011, 'steer', 0], [4.003, 'steer', -1], [4.003, 'drift', 1],
    [5.207, 'drift', 0], [5.502, 'steer', 0], [6.509, 'dash', 1]];
  const run = (hz, queued) => {
    const sim = make(room(80, 60)), p = sim.player, inp = p.input;
    let next = 0, now = 0;
    const apply = (e) => { if (e[1] === 'dash') inp.dash = true; else if (e[1] === 'drift') inp.drift = !!e[2]; else inp[e[1]] = e[2]; };
    const feed = (age) => { while (next < EV.length && now - EV[next][0] >= age - 1e-9) apply(EV[next++]); };
    const frames = Math.round(8 * hz);
    for (let f = 1; f <= frames; f++) {
      now = f / hz;
      if (queued) advanceSim(sim, 1 / hz, feed);
      else { feed(0); advanceSim(sim, 1 / hz); }       // the old way: keys sampled once per frame
    }
    return [hz, sim.tick, p.x, p.z, p.h * DEG, p.spd];
  };
  for (const [title, queued] of [['keys sampled once per frame (before)', false], ['keys applied on their own step (now)', true]]) {
    const out = [30, 60, 144, 240].map((hz) => run(hz, queued));
    let spread = 0;
    for (const r of out) for (const q of out) spread = Math.max(spread, Math.hypot(r[2] - q[2], r[3] - q[3]));
    table('Frame rate — the same 8 s key script through the real frame loop, ' + title, ['Hz', 'steps run', 'x', 'z', 'heading deg', 'speed'], out);
    console.log(`  largest distance between any two rates after 8 s: ${spread.toFixed(3)} m`);
  }
}
