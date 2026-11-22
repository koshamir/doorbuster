// DOORBUSTER tool — sim.mjs
// Headless batch simulation: runs whole levels in Node with a bot on the player's cart and prints
// the measurements used by the milestone gates (QUALITY.md sections 1 and 4).
// Run: node tools/sim.mjs [--level 1] [--runs 20] [--bot all|beginner|confident|expert] [--seed 1]
import { LEVELS } from '../src/levels.js';
import { loadTune, args, runOne, table, mean, pct, TUNE } from './lib.mjs';

const a = args();
loadTune();
const levels = a.level !== undefined ? [Number(a.level)] : LEVELS.map((_, i) => i);
const runs = Number(a.runs || 20), seed0 = Number(a.seed || 1);
// name, bot profile, options
const CASES = [['beginner', 'beginner', {}], ['confident', 'confident', {}], ['expert', 'expert', {}], ['sloppy', 'sloppy', {}], ['expert, no collecting', 'expert', { greed: 0 }]]
  .filter((c) => !a.bot || a.bot === 'all' || c[1] === a.bot);
const med = (v) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

for (const li of levels) {
  const def = LEVELS[li];
  const rows = [], rows2 = [], markRows = [], cost = [];
  for (const [name, bot, opts] of CASES) {
    const res = [];
    for (let i = 0; i < runs; i++) res.push(runOne(def, seed0 + i, bot, opts));
    const fin = res.filter((r) => r.finished), P = (r) => r.sim.player;
    rows.push([name, pct(fin.length / runs), mean(fin.map((r) => r.time)), Math.max(0, ...fin.map((r) => r.time)),
      pct(mean(fin.map((r) => r.time)) / def.timer), def.timer - Math.max(0, ...fin.map((r) => r.time)), mean(res.map((r) => r.avg)),
      pct(mean(res.map((r) => r.zero))), Math.max(...res.map((r) => r.stillMax)), Math.max(...res.map((r) => r.lost)), mean(res.map((r) => r.stuck)), mean(res.map((r) => r.crashes))]);
    cost.push(mean(res.map((r) => r.usPerStep)));
    // per obstacle: share of runs that reached the mark with no crash and no stuck event on the way
    if (def.marks) markRows.push([name, ...def.marks.map((m, i) => {
      const got = res.filter((r) => r.marks[i].t >= 0);
      const clean = got.filter((r) => r.marks[i].crashes === 0 && r.marks[i].stuck === 0).length;
      return pct(clean / runs) + ' ' + (got.length ? med(got.map((r) => r.marks[i].t)).toFixed(1) + 's' : '-');
    })]);
    rows2.push([name, med(fin.map((r) => P(r).receipt.total)), Math.max(0, ...fin.map((r) => P(r).receipt.total)), mean(fin.map((r) => P(r).receipt.items)),
      mean(fin.map((r) => P(r).receipt.time)), mean(fin.map((r) => P(r).receipt.stunts)), pct(fin.filter((r) => P(r).receipt.list > 0).length / Math.max(1, fin.length)),
      mean(res.map((r) => r.sim.stats.taken)), mean(res.map((r) => r.sim.stats.spilled)), mean(fin.map((r) => P(r).load)) / TUNE.loadfull,
      mean(res.map((r) => r.sim.stats.firstShelf)), Math.min(...res.map((r) => r.sim.stats.firstShelf))]);
  }
  table(`Level ${li} "${def.name}" — ${runs} runs per bot, timer ${def.timer} s, route ${createRoute(def)} m`,
    ['bot', 'finish', 'time', 'slowest', 'of timer', 'spare s (worst)', 'avg m/s', 'near-zero', 'longest standstill s', 'max no-control s', 'stuck/run', 'crashes/run'], rows);
  if (def.marks) table('  obstacles — clean passes (no crash, no stuck) and median seconds for the stretch', ['bot', ...def.marks.map((m) => m[0])], markRows);
  console.log(`  logic cost: ${mean(cost).toFixed(1)} microseconds per step, ${(mean(cost) * 2 / 1000).toFixed(3)} ms per 60 Hz frame (budget 6 ms)`);
  table('  receipts and loot',
    ['bot', 'median $', 'best $', 'items $', 'time $', 'stunts $', 'list done', 'taken', 'spilled', 'load x full', 'first shelf avg', 'first shelf min'], rows2);
}

function createRoute(def) {
  return runOne(def, 1, 'expert', { timer: 0.1 }).sim.world.navStart.toFixed(0);
}
