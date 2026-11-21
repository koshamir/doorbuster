// DOORBUSTER tool — script.mjs
// Scripted-input runner: replays timed key sequences against the real cart model in synthetic rooms
// and prints the feel measurements (speed, yaw rate, slip angle, timings). Deterministic.
// Run: node tools/script.mjs [--only launch,drift,...] [--json]
import { loadTune, args, room, table, TUNE, CFG } from './lib.mjs';
import { makeRng } from '../src/config.js';
import { createSim, stepSim, advanceSim } from '../src/sim.js';
import { addSolid } from '../src/world.js';

const a = args();
loadTune();
const only = a.only ? String(a.only).split(',') : null;
const want = (name) => !only || only.includes(name);
const DEG = 180 / Math.PI, STEP = CFG.STEP;
const report = {};

function make(def, load = 0) {
  const sim = createSim(def || room(), 1, { countdown: 0 });
  sim.player.load = load;
  return sim;
}
// Steps the sim for `seconds` holding `keys` ({ steer, gas, brake, drift, dash }); calls each(sim) per step.
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

// ---- 0 -> top speed, stopping distance, full-lock circle: empty and full ---------------------------
if (want('basics')) {
  const rows = [];
  for (const [name, load] of [['empty', 0], ['half', TUNE.loadfull * 0.5], ['full', TUNE.loadfull]]) {
    const top = topOf(load);
    let sim = make(null, load), p = sim.player, t95 = 0, d95 = 0, x0 = p.x;
    hold(sim, 6, { gas: 1 }, (s, i) => { if (!t95 && p.spd >= top * 0.95) { t95 = (i + 1) * STEP; d95 = p.x - x0; } });
    const reached = p.spd;
    let stopT = 0; const xb = p.x;
    hold(sim, 3, { brake: 1 }, (s, i) => { if (!stopT && p.spd <= 0.05) stopT = (i + 1) * STEP; });
    // re-measure the stop distance exactly: position where speed first reached zero
    sim = make(null, load); p = sim.player;
    hold(sim, 6, { gas: 1 });
    const xs = p.x; let stopD = 0, done = false;
    hold(sim, 3, { brake: 1 }, () => { if (!done && p.spd <= 0.05) { stopD = p.x - xs; done = true; } });
    // full-lock circle at top speed
    sim = make(room(80, 60), load); p = sim.player;
    hold(sim, 3, { gas: 1 });
    hold(sim, 4, { gas: 1, steer: 1 });
    let minX = 1e9, maxX = -1e9, yaw = 0, slip = 0, spd = 0, n = 0;
    hold(sim, 6, { gas: 1, steer: 1 }, () => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); yaw += p.yaw; slip += p.slip; spd += p.spd; n++; });
    rows.push([name, reached, t95, d95, stopT, stopD, (maxX - minX) / 2, yaw / n, slip / n * DEG, spd / n]);
    report['basics_' + name] = { top: reached, t95, d95, stopT, stopD, radius: (maxX - minX) / 2 };
  }
  table('Basics — launch, stop, full-lock circle at top speed',
    ['load', 'top m/s', '0-95% s', 'dist m', 'stop s', 'stop m', 'turn radius m', 'yaw rad/s', 'slip deg', 'speed in turn'], rows);
}

// ---- drift tiers --------------------------------------------------------------------------------
if (want('drift')) {
  const rows = [];
  for (const [name, load, steerIn] of [['empty', 0, 1], ['empty, neutral stick', 0, 0.3], ['full', TUNE.loadfull, 1]]) {
    for (const holdT of [0.3, 0.7, 1.3, 2.1]) {
      const sim = make(room(80, 60), load), p = sim.player, top = topOf(load);
      hold(sim, 3, { gas: 1 });
      const h0 = p.h; let slip = 0, spd = 0, yaw = 0, n = 0, tier = 0;
      // The player presses the direction first, then the drift button 50 ms later (a human delay).
      hold(sim, 0.05, { gas: 1, steer: 1 });
      hold(sim, holdT, { gas: 1, steer: steerIn, drift: true }, () => { slip += p.slip; spd += p.spd; yaw += p.yaw; n++; tier = Math.max(tier, p.tier); });
      let turned = (p.h - h0) * DEG; if (turned < 0) turned += 360;
      let peak = 0, above = 0;
      hold(sim, 3, { gas: 1 }, () => { peak = Math.max(peak, p.spd); if (p.spd > top + 0.3) above += STEP; });
      rows.push([name, holdT, tier, slip / n * DEG, spd / n, (spd / n) / Math.abs(yaw / n), turned, peak, above, events(sim, 'crash')]);
      report[`drift_${name}_${holdT}`] = { tier, slip: slip / n * DEG, peak, above };
    }
  }
  table('Drift — hold steer + drift at top speed, then release',
    ['case', 'hold s', 'tier', 'slip deg', 'speed m/s', 'radius m', 'turned deg', 'boost peak', 'boost s', 'crashes'], rows);
}

// ---- dash ---------------------------------------------------------------------------------------
if (want('dash')) {
  const rows = [];
  for (const [name, pre] of [['from rest', 0], ['at top speed', 3]]) {
    const base = make(), bp = base.player;
    if (pre) hold(base, pre, { gas: 1 });
    const bx = bp.x; hold(base, 2, { gas: 1 });
    const sim = make(), p = sim.player;
    if (pre) hold(sim, pre, { gas: 1 });
    const x0 = p.x; let peak = 0, above = 0, first = 0;
    hold(sim, 2, { gas: 1, dash: true }, (s, i) => { if (i === 0) first = p.spd; peak = Math.max(peak, p.spd); if (p.spd > TUNE.maxspeed + 0.3) above += STEP; });
    rows.push([name, first, peak, above, (p.x - x0) - (bp.x - bx)]);
  }
  const sim = make(room(120, 20)), p = sim.player;
  hold(sim, 6, { gas: 1, dash: 'mash' });
  const mashed = events(sim, 'dash'), mashDist = p.x;
  const plain = make(room(120, 20)); hold(plain, 6, { gas: 1 });
  table('Dash', ['case', 'speed after 1 step', 'peak m/s', 's above top', 'metres gained in 2 s'], rows);
  console.log(`  mashing dash for 6 s: ${mashed} dashes (cooldown ${TUNE.dashcooldown} s), ${(mashDist - plain.player.x).toFixed(1)} m gained over plain driving (+${((mashDist / plain.player.x - 1) * 100).toFixed(0)}%)`);
  report.dash = { mashed };
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
  report.response = { v1, y1, dh2 };
}

// ---- walls: slide, crash, pinned, corners, seams, tunnelling -------------------------------------
if (want('walls')) {
  const rows = [];
  for (const deg of [10, 20, 30, 45, 60, 75, 90]) {
    const sim = make(room(80, 40)), p = sim.player, al = deg / DEG;
    // approach the north wall (its face is at z = 2) at `deg` to the surface, moving east and north
    p.x = 40; p.z = 2 + CFG.CART_R + 5 * Math.sin(al) + 0.5; p.h = Math.atan2(Math.cos(al), -Math.sin(al));
    p.vx = Math.sin(p.h) * TUNE.maxspeed; p.vz = Math.cos(p.h) * TUNE.maxspeed; p.spd = TUNE.maxspeed;
    let hitT = -1, vBefore = TUNE.maxspeed, stuck = 0, minV = 99, x1 = 0;
    hold(sim, 3, { gas: 1 }, (s, i) => {
      const t = i * STEP;
      if (hitT < 0 && p.wallT > 0) { hitT = t; x1 = p.x; }
      if (hitT < 0) vBefore = Math.abs(p.spd);
      if (hitT >= 0 && t - hitT < 2) { if (Math.abs(p.spd) < 1) stuck += STEP; minV = Math.min(minV, Math.abs(p.spd)); }
    });
    // state 0.5 s after the hit, from a second identical run
    const s2 = make(room(80, 40)), q = s2.player;
    q.x = 40; q.z = p.z * 0 + 2 + CFG.CART_R + 5 * Math.sin(al) + 0.5; q.h = Math.atan2(Math.cos(al), -Math.sin(al));
    q.vx = Math.sin(q.h) * TUNE.maxspeed; q.vz = Math.cos(q.h) * TUNE.maxspeed; q.spd = TUNE.maxspeed;
    hold(s2, hitT + 0.5, { gas: 1 });
    const off = Math.abs(Math.atan2(Math.sin(q.h - Math.PI / 2), Math.cos(q.h - Math.PI / 2))) * DEG;
    rows.push([deg, events(sim, 'crash') ? 'CRASH' : 'slide', vBefore, Math.abs(q.spd), minV, stuck, off, Math.max(s2.stats.lostMax, sim.stats.lostMax)]);
  }
  table('Walls — hit a wall at an angle to its surface, holding gas, no steering',
    ['angle deg', 'result', 'speed in', 'speed +0.5 s', 'min speed 2 s', 'near-zero s', 'deg off wall +0.5 s', 'no-control s'], rows);

  // pinned nose-first, gas only
  let sim = make(room(40, 20)), p = sim.player;
  p.x = 78 - CFG.CART_R - 0.01; let free = 0;
  hold(sim, 3, { gas: 1 }, (s, i) => { if (!free && Math.abs(p.spd) > 3) free = (i + 1) * STEP; });
  console.log(`  pinned nose-first against a wall, gas only: moving faster than 3 m/s after ${free.toFixed(2)} s`);
  report.pinned = free;

  // outside corner: aim the cart so its centre line passes the corner with a small offset
  const crow = [];
  for (const off of [-0.5, -0.25, 0, 0.25, 0.5]) {
    const def = room(60, 30, (g) => { for (let r = 1; r <= 14; r++) for (let c = 30; c <= 34; c++) g[r][c] = ' '; });
    sim = make(def); p = sim.player;
    p.x = 40; p.z = 30 + off;            // the block's south face is at z = 30, its west corner at x = 60
    hold(sim, 6, { gas: 1 });
    crow.push([off, events(sim, 'crash'), events(sim, 'bump'), sim.stats.zeroT, p.x > 72 ? 'passed' : 'blocked at x=' + p.x.toFixed(1), Math.abs(p.spd)]);
  }
  table('Outside corner — drive at a wall corner, centre offset from the edge line (m)',
    ['offset', 'crashes', 'bumps', 'near-zero s', 'result', 'speed after'], crow);

  // seams: scrape along separate counter boxes versus one wall at the same angle
  const seamDef = room(80, 30, (g) => { for (let c = 10; c < 70; c++) g[1][c] = 'C'; });
  const res = [];
  for (const [name, def, zFace] of [['one wall', room(80, 30), 2], ['30 counter boxes', seamDef, 4]]) {
    sim = make(def); p = sim.player;
    const al = 15 / DEG;
    p.x = 24; p.z = zFace + CFG.CART_R + 0.6; p.h = Math.atan2(Math.cos(al), -Math.sin(al));
    p.vx = Math.sin(p.h) * TUNE.maxspeed; p.vz = Math.cos(p.h) * TUNE.maxspeed;
    let minV = 99;
    hold(sim, 4, { gas: 1, steer: -0.15 }, (s, i) => { if (i > 60) minV = Math.min(minV, Math.abs(p.spd)); });
    res.push([name, minV, p.x, events(sim, 'crash')]);
  }
  table('Seams — rubbing along a surface for 4 s while steering slightly into it', ['surface', 'min speed', 'x reached', 'crashes'], res);

  // tunnelling: fastest possible cart (tier-3 boost + dash) into a 0.3 m wall
  sim = make(room(120, 20)); p = sim.player;
  addSolid(sim.world, { x: 150, z: 20, r: 0, hx: 0.15, hz: 18, type: 'wall', on: true });
  hold(sim, 3, { gas: 1 });
  p.tier = 3; p.drift = 1; p.driftT = 2.5;
  let fastest = 0;
  hold(sim, 6, { gas: 1, dash: 'mash' }, () => { fastest = Math.max(fastest, Math.abs(p.spd)); });
  console.log(`  tunnelling: fastest cart ${fastest.toFixed(1)} m/s into a 0.3 m wall at x=150 -> stopped at x=${p.x.toFixed(2)} (${p.x < 150 ? 'no tunnelling' : 'TUNNELLED'})`);
  report.tunnel = p.x < 150;
}

// ---- gap of two cart widths at full speed -----------------------------------------------------------
if (want('gap')) {
  const rows = [];
  for (const off of [0, 0.25, 0.4]) {
    // two round displays whose edges are 2.2 m apart (centres two tiles apart), cart width 1.2 m
    const def = room(60, 40, (g, mid) => { g[mid - 1][30] = 'O'; g[mid + 1][30] = 'O'; });
    const sim = make(def), p = sim.player;
    p.z += off;
    hold(sim, 6, { gas: 1 });
    rows.push([off, 2.2, events(sim, 'crash'), events(sim, 'bump'), p.x > 70 ? 'passed' : 'blocked', Math.abs(p.spd)]);
  }
  table('Gap — straight through two displays at full speed', ['lateral offset m', 'gap m', 'crashes', 'bumps', 'result', 'speed after'], rows);
}

// ---- a beginner's first drifts: sloppy timing in a 10 m corridor with a 90-degree corner ----------------
if (want('beginner')) {
  // corridor: 5 tiles wide, east then north. Inner corner at (72, 72), lane centres z = 77 and x = 77.
  const plan = [];
  for (let r = 0; r < 44; r++) {
    let line = '';
    for (let c = 0; c < 44; c++) line += (r >= 36 && r <= 40 && c >= 1 && c <= 40) || (c >= 36 && c <= 40 && r >= 1 && r <= 40) ? '.' : ' ';
    plan.push(line);
  }
  const put = (r, c, ch) => { plan[r] = plan[r].slice(0, c) + ch + plan[r].slice(c + 1); };
  put(38, 3, '@'); put(1, 38, 'c');
  const def = { id: 'corner', name: 'CORNER', timer: 600, heading: Math.PI / 2, rivals: [], crowd: 0, list: [], zones: [{ pool: 'market', color: 0 }], plan };
  const rng = makeRng(2026);
  const rows = [];
  for (const [name, load] of [['empty', 0], ['full', TUNE.loadfull]]) {
    let ok = 0, crashed = 0; const tiers = [0, 0, 0, 0]; const N = 300;
    for (let i = 0; i < N; i++) {
      const sim = createSim(def, i + 1, { countdown: 0, bot: 'beginner' });
      const p = sim.player, inp = p.input;
      p.load = load;
      const drv = p.ai; p.ai = null;                 // scripted hands first, the beginner bot afterwards
      const turnAt = 62 + rng() * 12;                // where the player starts turning (ideal is about 69)
      const lag = -0.1 + rng() * 0.35;               // drift button this long after the steering key (may be early)
      const holdT = 0.45 + rng() * 0.75;             // how long the drift button stays down
      const stick = 0.5 + rng() * 0.5;               // analog-ish steering amount
      let tSteer = -1, tier = 0, boosted = false;
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
        for (const e of sim.events) if (e.type === 'boost') boosted = true;
        sim.events.length = 0;
      }
      tiers[tier]++;
      const crash = sim.stats.crashes > 0;
      if (crash) crashed++;
      if (boosted && !crash) ok++;
    }
    rows.push([name, N, (ok / N * 100).toFixed(0) + '%', ((1 - (1 - ok / N) ** 2) * 100).toFixed(0) + '%', tiers.join(' / '), (crashed / N * 100).toFixed(0) + '%']);
    report['beginner_' + name] = ok / N;
  }
  table('Beginner drift — random sloppy attempts at a 90-degree corner in a 10 m corridor',
    ['load', 'attempts', 'boost without a crash', 'within two tries', 'best tier 0/1/2/3', 'crashed'], rows);
}

// ---- identical at 60 and 144 Hz -------------------------------------------------------------------
if (want('hz')) {
  const out = [];
  for (const hz of [60, 144, 30, 240]) {
    const sim = make(room(80, 60)), p = sim.player, inp = p.input;
    let t = 0;
    // a fixed script in sim time: gas, turn, drift, release, dash
    const keys = () => {
      const s = sim.tick * STEP;
      inp.gas = 1; inp.steer = s > 2 && s < 3 ? 1 : s > 4 && s < 5.5 ? -1 : 0; inp.drift = s > 4 && s < 5.2;
      if (sim.tick === 780) inp.dash = true;
    };
    // sim time is what matters: run frames until 8 s of steps have executed
    while (sim.tick < 960) { keys(); sim.acc += 1 / hz; while (sim.acc >= STEP && sim.tick < 960) { keys(); stepSim(sim); sim.acc -= STEP; } t += 1 / hz; }
    out.push([hz, sim.tick, p.x.toFixed(6), p.z.toFixed(6), p.h.toFixed(6), p.spd.toFixed(6)]);
  }
  table('Frame-rate independence — the same 8 s input script at different display rates', ['Hz', 'steps', 'x', 'z', 'heading', 'speed'], out);
  const same = out.every((r) => r.slice(2).join() === out[0].slice(2).join());
  console.log('  ' + (same ? 'IDENTICAL at every rate' : 'MISMATCH'));
  report.hz = same;
  void advanceSim;
}

if (a.json) console.log('\n' + JSON.stringify(report));
