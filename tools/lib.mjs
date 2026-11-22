// DOORBUSTER tool — lib.mjs
// Shared helpers for the Node instruments: tune loading, argument parsing, synthetic test rooms,
// a single-run driver and a plain-text table printer.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { applyTune, TUNE, CFG } from '../src/config.js';
import { createSim, stepSim } from '../src/sim.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Applies tune.json the same way the game does locally: each entry's value.
export function loadTune() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'tune.json'), 'utf8'));
  const values = {};
  for (const key in raw) values[key] = raw[key].value;
  applyTune(values);
  return raw;
}

export function args() {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const key = a[i].slice(2);
    out[key] = a[i + 1] !== undefined && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return out;
}

// An empty room of cols x rows tiles with the start on the left facing east and one checkout lane
// far away on the right. edit(grid) may place plan characters: grid[row][col] = 'O'.
export function room(cols = 60, rows = 40, edit) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) line.push(r === 0 || c === 0 || r === rows - 1 || c === cols - 1 ? ' ' : '.');
    grid.push(line);
  }
  const mid = rows >> 1;
  grid[mid][2] = '@';
  grid[1][cols - 2] = 'c';
  if (edit) edit(grid, mid);
  return { id: 'room', name: 'ROOM', timer: 600, heading: Math.PI / 2, rivals: [], crowd: 0, list: [],
    zones: [{ pool: 'market', color: 0, name: 'ROOM' }], plan: grid.map((l) => l.join('')) };
}

// Runs a level to its end with a bot on the player's cart. Returns the measurements.
export function runOne(def, seed, bot, opts = {}) {
  const sim = createSim(def, seed, { bot, countdown: 0, ...opts });
  const p = sim.player;
  let dist = 0, steps = 0, maxSpd = 0, still = 0, stillMax = 0;
  const counts = {};
  // Obstacle marks (test levels): when each was reached and what went wrong on the way to it.
  const marks = (def.marks || []).map(([name, c, r]) => ({ name, x: (c + 0.5) * CFG.TILE, z: (r + 0.5) * CFG.TILE, t: -1, crashes: 0, stuck: 0, bumps: 0 }));
  let mi = 0, lastT = 0, lastCrash = 0, lastStuck = 0, lastBump = 0;
  const limit = Math.ceil((sim.timer + 5) / CFG.STEP);
  const t0 = process.hrtime.bigint();
  while (sim.phase !== 'done' && sim.phase !== 'closed' && steps < limit) {
    stepSim(sim);
    steps++;
    dist += Math.hypot(p.x - p.px, p.z - p.pz);
    maxSpd = Math.max(maxSpd, Math.abs(p.spd));
    if (Math.abs(p.spd) < 1 && sim.phase === 'run') { still += CFG.STEP; stillMax = Math.max(stillMax, still); } else still = 0;
    for (const e of sim.events) counts[e.type] = (counts[e.type] || 0) + 1;
    sim.events.length = 0;
    const m = marks[mi];
    if (m && Math.hypot(p.x - m.x, p.z - m.z) < 4.5) {
      const trouble = sim.stats.stuck + p.backs;
      m.t = sim.t - lastT; m.crashes = sim.stats.crashes - lastCrash; m.stuck = trouble - lastStuck; m.bumps = (counts.bump || 0) - lastBump;
      lastT = sim.t; lastCrash = sim.stats.crashes; lastStuck = trouble; lastBump = counts.bump || 0; mi++;
    }
    if (opts.onStep) opts.onStep(sim);
  }
  const usPerStep = Number(process.hrtime.bigint() - t0) / 1000 / Math.max(1, steps);
  return { sim, finished: sim.phase === 'done', time: sim.t, dist, avg: dist / Math.max(sim.t, 1e-6), maxSpd,
    zero: sim.stats.zeroT / Math.max(sim.t, 1e-6), lost: sim.stats.lostMax, stuck: sim.stats.stuck + p.backs, stillMax,
    crashes: sim.stats.crashes, counts, marks, usPerStep };
}

export function table(title, head, rows) {
  const all = [head, ...rows].map((r) => r.map((v) => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v)));
  const w = head.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  console.log('\n' + title);
  all.forEach((r, n) => {
    console.log('  ' + r.map((v, i) => v.padEnd(w[i])).join('  '));
    if (n === 0) console.log('  ' + w.map((x) => '-'.repeat(x)).join('  '));
  });
}

export const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
export const pct = (v) => (v * 100).toFixed(0) + '%';
export { TUNE, CFG };
