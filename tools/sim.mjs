// DOORBUSTER tool — sim.mjs
// Headless batch simulation: runs whole levels in Node with a bot on the player's cart and prints
// the measurements used by the milestone gates (QUALITY.md sections 1 and 4).
// Run: node tools/sim.mjs [--level 1] [--runs 20] [--bot all|beginner|confident|expert] [--seed 1] [--alone]
import { LEVELS } from '../src/levels.js';
import { CHARS } from '../src/config.js';
import { loadTune, args, runOne, table, mean, pct, TUNE } from './lib.mjs';

const a = args();
loadTune();
const levels = a.level !== undefined ? [Number(a.level)] : LEVELS.map((_, i) => i);
const runs = Number(a.runs || 20), seed0 = Number(a.seed || 1);
// name, bot profile, options
const CASES = [['beginner', 'beginner', {}], ['confident', 'confident', {}], ['expert', 'expert', {}], ['sloppy', 'sloppy', {}], ['expert, no collecting', 'expert', { greed: 0 }]]
  .filter((c) => !a.bot || a.bot === 'all' || c[1] === a.bot);
const med = (v) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const max = (v) => v.length ? Math.max(...v) : 0;
const LOUD = { take: 1, stunt: 1, crash: 1, ram: 1, bowl: 1, boost: 1, smash: 1, hot: 1, glass: 1, madseg: 1, madmode: 1, flash: 1, closing: 1,
  spill: 1, warn: 1, rocket: 1, lanewarn: 1, laneclose: 1, cartbump: 1, knock: 1, heavy: 1, overloaded: 1 };   // things the player notices

// Watches one run step by step: quiet stretches for the player, where the rivals are, how fast they
// go and how long they take to get going again after a hit.
function watcher() {
  const w = { quietMax: 0, quiet: [], last: 0, near: 0, samples: 0, gaps: [], rivalMax: 0, recover: [], hitAt: new Map(), seen: {}, worstLoss: 0 };
  w.onStep = (sim) => {
    if (sim.phase !== 'run') return;
    const p = sim.player;
    for (const e of sim.events) {
      w.seen[e.type] = (w.seen[e.type] || 0) + 1;
      const mine = e.cart === p || e.ref === p || e.type === 'flash' || e.type === 'closing' || e.type === 'lanewarn' || e.type === 'laneclose';
      if (LOUD[e.type] && mine && sim.t > 1) { const g = sim.t - w.last; if (g > 0.05) w.quiet.push(g); w.quietMax = Math.max(w.quietMax, g); w.last = sim.t; }
      if (e.type === 'spill' && e.ref.crash) w.worstLoss = Math.max(w.worstLoss, e.ref.lost / (e.cart.value + e.ref.lost));
      if (e.type === 'stunt') w.seen['stunt:' + e.ref.name + (e.cart === p ? '' : ':rival')] = (w.seen['stunt:' + e.ref.name + (e.cart === p ? '' : ':rival')] || 0) + 1;
    }
    for (const k of sim.carts) {
      if (k === p || k.done) continue;
      if (k.stunT <= 0) w.rivalMax = Math.max(w.rivalMax, Math.hypot(k.vx, k.vz));   // under its own power (not while being shoved)
      if (k.stunT > 0 && !w.hitAt.has(k)) w.hitAt.set(k, sim.t);
      else if (w.hitAt.has(k) && k.stunT <= 0 && k.spd > 3.5) { w.recover.push(sim.t - w.hitAt.get(k)); w.hitAt.delete(k); }
      if (sim.tick % 60 === 0) {
        w.samples++;
        if (Math.hypot(k.x - p.x, k.z - p.z) < 22) w.near++;
        w.gaps.push(Math.abs(k.prog - p.prog));
      }
    }
  };
  return w;
}

for (const li of levels) {
  const def = LEVELS[li];
  const rows = [], rows2 = [], markRows = [], cost = [], life = [], rivalRows = [], all = {};
  for (const [name, bot, opts] of CASES) {
    const res = [];
    for (let i = 0; i < runs; i++) {
      const w = watcher();
      const r = runOne(def, seed0 + i, bot, { ...opts, alone: !!a.alone, onStep: w.onStep });
      r.w = w;
      res.push(r);
    }
    all[name] = res;
    const fin = res.filter((r) => r.finished), P = (r) => r.sim.player;
    rows.push([name, pct(fin.length / runs), mean(fin.map((r) => r.time)), max(fin.map((r) => r.time)),
      pct(mean(fin.map((r) => r.time)) / def.timer), def.timer - max(fin.map((r) => r.time)), mean(res.map((r) => r.avg)),
      pct(mean(res.map((r) => r.zero))), max(res.map((r) => r.stillMax)), max(res.map((r) => r.lost)), mean(res.map((r) => r.stuck)), mean(res.map((r) => r.crashes))]);
    cost.push(mean(res.map((r) => r.usPerStep)));
    // per obstacle: share of runs that reached the mark with no crash and no stuck event on the way
    if (def.marks) markRows.push([name, ...def.marks.map((m, i) => {
      const got = res.filter((r) => r.marks[i].t >= 0);
      const clean = got.filter((r) => r.marks[i].crashes === 0 && r.marks[i].stuck === 0).length;
      return pct(clean / runs) + ' ' + (got.length ? med(got.map((r) => r.marks[i].t)).toFixed(1) + 's' : '-');
    })]);
    rows2.push([name, med(fin.map((r) => P(r).receipt.total)), max(fin.map((r) => P(r).receipt.total)), mean(fin.map((r) => P(r).receipt.items)),
      mean(fin.map((r) => P(r).receipt.time)), mean(fin.map((r) => P(r).receipt.stunts)), pct(fin.filter((r) => P(r).receipt.list > 0).length / Math.max(1, fin.length)),
      mean(res.map((r) => r.sim.stats.taken)), mean(res.map((r) => r.sim.stats.spilled)), mean(fin.map((r) => P(r).load)) / TUNE.loadfull,
      mean(res.map((r) => r.sim.stats.firstShelf)), pct(res.filter((r) => r.sim.stats.firstShelf >= 10).length / runs), pct(max(res.map((r) => r.w.worstLoss)))]);
    // Madness, crowd, rams and the rhythm of the run, as the player meets them
    const S = (key) => res.map((r) => r.sim.stats[key]), seen = (key) => mean(res.map((r) => r.w.seen[key] || 0));
    const x2 = res.map((r) => r.sim.stats.x2At).filter((t) => t >= 0);
    const places = [1, 2, 3, 4, 5, 6].map((n) => res.filter((r) => P(r).place === n).length).filter((_, i) => i <= (def.rivals || []).length);
    life.push([name, pct(x2.filter((t) => t <= 20).length / runs), x2.length ? med(x2) : -1, mean(S('madModes')),
      pct(res.filter((r) => r.sim.stats.madModes >= 1 && r.sim.stats.madModes <= 2).length / runs), mean(S('rammed')), max(S('rammed')),
      seen('stunt:ram'), seen('stunt:takedown'), seen('stunt:strike'), seen('stunt:shave'), seen('stunt:cleansweep'), seen('stunt:smash'), seen('hot'), mean(S('bowled')),
      med(res.flatMap((r) => r.w.quiet)), max(res.map((r) => r.w.quietMax)), places.join('/')]);
  }
  table(`Level ${li} "${def.name}" — ${runs} runs per bot, timer ${def.timer} s, route ${createRoute(def)} m`,
    ['bot', 'finish', 'time', 'slowest', 'of timer', 'spare s (worst)', 'avg m/s', 'near-zero', 'longest standstill s', 'max no-control s', 'stuck/run', 'crashes/run'], rows);
  if (def.marks) table('  obstacles — clean passes (no crash, no stuck) and median seconds for the stretch', ['bot', ...def.marks.map((m) => m[0])], markRows);
  console.log(`  logic cost: ${mean(cost).toFixed(1)} microseconds per step, ${(mean(cost) * 2 / 1000).toFixed(3)} ms per 60 Hz frame (budget 6 ms)`);
  table('  receipts and loot',
    ['bot', 'median $', 'best $', 'items $', 'time $', 'stunts $', 'list done', 'taken', 'spilled', 'load x full', 'first shelf avg', '10+ off first shelf', 'worst crash loss ($ share)'], rows2);
  if (a.alone || !(def.rivals || []).length) continue;
  table('  the player\'s run (Madness, rams, crowd, rhythm) — per run',
    ['bot', 'x2 by 20 s', 'x2 at (median s)', 'modes', '1-2 modes', 'rammed', 'rammed max', 'rams', 'takedowns', 'strikes', 'shaves', 'sweeps', 'smashes', 'hot', 'bowled',
      'event gap median s', 'longest quiet s', 'places 1st/2nd/..'], life);

  // Rivals, over every run of every bot (QUALITY.md section 4).
  const every = Object.values(all).flat(), ids = (def.rivals || []).slice(0, TUNE.rivals);
  for (const id of ids) {
    const carts = every.map((r) => r.sim.carts.find((k) => k.char === id)).filter(Boolean);
    const fin = carts.filter((k) => k.receipt);
    rivalRows.push([CHARS[id].name, pct(fin.length / carts.length), mean(fin.map((k) => k.doneT)), med(fin.map((k) => k.receipt.total)), mean(fin.map((k) => k.receipt.count)),
      mean(carts.map((k) => k.ai.stuck)), mean(carts.map((k) => k.stuntLog.filter((s) => s === 'ram').length)), mean(carts.map((k) => k.crashes || 0))]);
  }
  table('  rivals — over ' + every.length + ' runs', ['rival', 'finish', 'time', 'median $', 'items', 'stuck/run', 'rams/run', 'crashes/run'], rivalRows);
  const rivalsOf = (r) => r.sim.carts.filter((k) => !k.player), tot = (k) => k.receipt ? k.receipt.total : 0;
  const exp = all.expert ? med(all.expert.filter((r) => r.finished).map((r) => r.sim.player.receipt.total)) : 0;
  const conf = all.confident ? med(all.confident.filter((r) => r.finished).map((r) => r.sim.player.receipt.total)) : 0;
  const avgRival = mean(every.flatMap((r) => rivalsOf(r).map(tot))), bestRival = med(every.map((r) => Math.max(...rivalsOf(r).map(tot))));
  const nR = every.length * ids.length;
  console.log(`  rivals finishing: ${pct(every.reduce((s, r) => s + rivalsOf(r).filter((k) => k.receipt).length, 0) / nR)} (target 98%+), ` +
    `push-outs ${every.reduce((s, r) => s + r.sim.stats.pushOuts, 0)} in ${every.length} runs, stuck events ${(every.reduce((s, r) => s + r.sim.stats.rivalStuck, 0) / every.length).toFixed(3)} per run (target < 0.05)`);
  console.log(`  receipts: average rival $${avgRival.toFixed(0)} = ${pct(avgRival / Math.max(1, exp))} of the expert bot's median $${exp} (target 60-85%); ` +
    `best rival (median) $${bestRival} = ${pct(bestRival / Math.max(1, conf))} of the confident bot's $${conf} (target 85-105%)`);
  console.log(`  rival rams on rivals: ${mean(every.map((r) => r.sim.stats.rivalRams)).toFixed(2)} per run, in ${pct(every.filter((r) => r.sim.stats.rivalRams > 0).length / every.length)} of runs (target: at least one per run); ` +
    `rival crashes ${mean(every.map((r) => r.sim.stats.rivalCrashes)).toFixed(2)} per run, seen in ${pct(every.filter((r) => r.sim.stats.rivalCrashes > 0).length / every.length)} of runs`);
  console.log(`  rival top speed ${max(every.map((r) => r.w.rivalMax)).toFixed(1)} m/s against the player's cart ${max(every.map((r) => r.maxSpd)).toFixed(1)} m/s (same model; limit ${(TUNE.maxspeed * (1 + (TUNE.turbopower - 1) * 1.5) + TUNE.dashspeed).toFixed(1)}); ` +
    `back in the race after a hit: median ${med(every.flatMap((r) => r.w.recover)).toFixed(2)} s, ${pct(every.flatMap((r) => r.w.recover).filter((t) => t <= 2).length / Math.max(1, every.flatMap((r) => r.w.recover).length))} within 2 s, worst ${max(every.flatMap((r) => r.w.recover)).toFixed(2)} s (target under 2 s)`);
  console.log(`  rivals on screen (within 22 m of the player): ${pct(every.reduce((s, r) => s + r.w.near, 0) / Math.max(1, every.reduce((s, r) => s + r.w.samples, 0)))} of the time; ` +
    `median gap along the route ${med(every.flatMap((r) => r.w.gaps)).toFixed(1)} m (target 10-20 m)`);
}

function createRoute(def) {
  return runOne(def, 1, 'expert', { timer: 0.1, noSettle: true, alone: true }).sim.world.navStart.toFixed(0);
}
