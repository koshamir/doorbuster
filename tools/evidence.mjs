// DOORBUSTER tool — evidence.mjs
// Regenerates the gate evidence from the tree as it is: gates/metrics-latest.txt (budget and level
// checks, the maneuver suite, bot simulations of every level, the single-file build) and the capture
// sets with their summaries (gates/<set>-capture.json; the pictures go to shots/<set>).
// Run: node tools/evidence.mjs [--runs 200] [--sets m4,m5,dist] [--nosim]
import { execFileSync } from 'node:child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { args } from './lib.mjs';

const a = args(), root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (file, ...rest) => {
  try { return execFileSync(process.execPath, [join('tools', file), ...rest], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (err) { return (err.stdout || '') + (err.stderr || '') + `\n[${file} exited with code ${err.status}]\n`; }
};
mkdirSync(join(root, 'gates'), { recursive: true });
if (!a.nosim) {
  const runs = String(a.runs || 200);
  let out = '';
  for (const [title, file, ...rest] of [['check', 'check.mjs'], ['maneuvers', 'script.mjs'], ['level 0', 'sim.mjs', '--level', '0', '--runs', '20'],
    ['level 1', 'sim.mjs', '--level', '1', '--runs', runs], ['level 2', 'sim.mjs', '--level', '2', '--runs', runs], ['level 3', 'sim.mjs', '--level', '3', '--runs', runs],
    ['build', 'build.mjs']]) {
    console.log('running', title);
    out += run(file, ...rest) + '\n';
  }
  writeFileSync(join(root, 'gates', 'metrics-latest.txt'), out);
}
for (const set of String(a.sets === undefined ? 'm4,m5,dist' : a.sets).split(',').filter(Boolean)) {
  console.log('capturing', set);
  rmSync(join(root, 'shots', set), { recursive: true, force: true });      // no frame outlives the scenario that made it
  const log = run('shots.mjs', '--set', set);
  console.log(log.split('\n').slice(-4).join('\n'));
  try { copyFileSync(join(root, 'shots', set, 'summary.json'), join(root, 'gates', set + '-capture.json')); } catch (err) { console.log('no summary for', set); }
}
console.log('ALLDONE');
