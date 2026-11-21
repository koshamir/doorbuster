// DOORBUSTER tool — sim.mjs
// Headless batch simulation: runs whole levels in Node with a bot on the player's cart and prints
// the measurements used by the milestone gates (QUALITY.md sections 1 and 4).
// Run: node tools/sim.mjs [--level 0] [--runs 20] [--bot all|beginner|confident|expert] [--seed 1]
import { LEVELS } from '../src/levels.js';
import { loadTune, args, runOne, table, mean, pct } from './lib.mjs';

const a = args();
loadTune();
const levels = a.level !== undefined ? [Number(a.level)] : LEVELS.map((_, i) => i);
const runs = Number(a.runs || 20), seed0 = Number(a.seed || 1);
const bots = !a.bot || a.bot === 'all' ? ['beginner', 'confident', 'expert'] : [a.bot];

for (const li of levels) {
  const def = LEVELS[li];
  const rows = [];
  for (const bot of bots) {
    const res = [];
    for (let i = 0; i < runs; i++) res.push(runOne(def, seed0 + i, bot));
    const fin = res.filter((r) => r.finished);
    rows.push([bot, pct(fin.length / runs), mean(fin.map((r) => r.time)), Math.min(...fin.map((r) => r.time)),
      Math.max(...fin.map((r) => r.time)), pct(mean(fin.map((r) => r.time)) / def.timer), mean(res.map((r) => r.avg)),
      pct(mean(res.map((r) => r.zero))), Math.max(...res.map((r) => r.lost)), mean(res.map((r) => r.stuck)),
      mean(res.map((r) => r.crashes))]);
  }
  table(`Level ${li} "${def.name}" — ${runs} runs per bot, timer ${def.timer} s`,
    ['bot', 'finish', 'time', 'min', 'max', 'of timer', 'avg m/s', 'near-zero', 'max no-control s', 'stuck/run', 'crashes/run'], rows);
}
