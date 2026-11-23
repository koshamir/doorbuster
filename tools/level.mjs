// DOORBUSTER tool — level.mjs
// The bridge between level files in the universal format (docs/LEVEL_FORMAT.md, made by the editor in editor/ or by
// hand or by an AI agent) and the game's own levels (src/levels.js).
// Run:
//   node tools/level.mjs export <n | id | all> [--out levels]   a game level as a universal file, <id>.doorbuster-level.json
//   node tools/level.mjs check <file.json> [--seeds 5]           the editor's check, then the game's bots on it
//   node tools/level.mjs add <file.json> [--replace] [--force]   into src/levels.js: a new store at the end, or (--replace)
//                                                                 over the level with the same id; --force skips the check
//   node tools/level.mjs js <file.json>                          prints the src/levels.js entry
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT, args, loadTune, runOne } from './lib.mjs';
import { LEVELS } from '../src/levels.js';
import { defToUniversal, normalize, universalToDef, finish, pretty, defToJs, levelComments } from '../editor/format.js';
import { checkLevel } from '../editor/check.js';

const a = args(), pos = [], argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { if (['--out', '--seeds'].includes(argv[i])) i++; continue; } pos.push(argv[i]); }
const [cmd, target] = pos;
const SRC = resolve(ROOT, 'src/levels.js');
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const die = (msg) => { console.error(msg); process.exit(1); };

function readLevel(file) {
  if (!file) die('Which file? e.g. node tools/level.mjs check my-level.doorbuster-level.json');
  let data;
  try { data = JSON.parse(readFileSync(resolve(file), 'utf8')); } catch (e) { die(`Cannot read ${file}: ${e.message}`); }
  const { level, warnings } = normalize(data);
  for (const w of warnings) console.log('note: ' + w);
  return level;
}
function report(u) {
  const c = checkLevel(u);
  for (const e of c.errors) console.log(`ERROR    ${e.msg}${e.x !== undefined ? `  (at ${e.x}, ${e.y})` : ''}`);
  for (const w of c.warnings) console.log(`warning  ${w.msg}${w.x !== undefined ? `  (at ${w.x}, ${w.y})` : ''}`);
  for (const n of c.notes) console.log(`         ${n.msg}`);
  return c;
}

if (cmd === 'export') {
  const comments = levelComments(readFileSync(SRC, 'utf8'));
  const list = target === 'all' ? LEVELS.map((_, i) => i) : [LEVELS.findIndex((d, i) => String(i) === String(target) || d.id === target)];
  if (list[0] < 0 || target === undefined) die(`No level "${target}". Levels: ${LEVELS.map((d, i) => `${i} ${d.id}`).join(', ')}`);
  const out = resolve(ROOT, a.out || 'levels');
  mkdirSync(out, { recursive: true });
  for (const i of list) {
    const u = normalize(defToUniversal(LEVELS[i], { description: comments[i] || '' })).level;
    u.meta = { source: `src/levels.js, level ${i}`, tool: 'tools/level.mjs' };
    const file = join(out, `${u.level.id}.doorbuster-level.json`);
    writeFileSync(file, pretty(finish(u, { glossary: !a['no-glossary'] })));
    console.log(`level ${i} ${LEVELS[i].name} -> ${file}`);
  }
} else if (cmd === 'check') {
  const u = readLevel(target);
  console.log(`${u.level.name} (${u.level.id}) · ${u.level.store} · ${String(u.level.mode).toUpperCase()} · ${u.grid.width} × ${u.grid.height} tiles · ${u.objects.length} objects`);
  const c = report(u);
  if (c.errors.length) die(`FAIL: ${c.errors.length} error(s); the game cannot run it yet.`);
  loadTune();
  const def = universalToDef(u), seeds = Number(a.seeds || 5), runs = [];
  for (const [bot, n] of [['expert', seeds], ...(def.v3 ? [['beginner', 3]] : [])]) for (let s = 1; s <= n; s++) {
    const r = runOne(def, s, bot), p = r.sim.player;
    runs.push({ bot, seed: s, finished: r.finished, time: r.sim.t, total: p.receipt ? p.receipt.total : 0, wipes: r.sim.stats.wipeouts || 0, at: [Math.floor(p.x / 2), Math.floor(p.z / 2)] });
    const x = runs[runs.length - 1];
    console.log(`${bot.padEnd(8)} seed ${s}: ${x.finished ? `checkout at ${x.time.toFixed(1)} s, ${money(x.total)}` : `did not finish (stopped near ${x.at.join(', ')})`}${x.wipes ? `, ${x.wipes} wipeout(s)` : ''}`);
  }
  const ex = runs.filter((r) => r.bot === 'expert'), done = ex.filter((r) => r.finished), fails = [];
  if (done.length < ex.length) fails.push(`the expert finished ${done.length} of ${ex.length}`);
  if (done.length) {
    const best = Math.max(...done.map((r) => r.total)), mean = done.reduce((s, r) => s + r.time, 0) / done.length, r100 = (v) => Math.round(v / 100) * 100;
    console.log(`author run: best ${money(best)}, mean ${mean.toFixed(1)} s -> medals silver ${money(r100(best * 0.7))}, gold ${money(r100(best * 0.9))}, black card ${money(best + 1)}`);
    if (def.author && Math.abs(mean - def.author) > def.author * 0.2) fails.push(`the expert's mean time ${mean.toFixed(1)} s is not within 20% of author_time_s ${def.author}`);
    if (def.v3 && done.reduce((s, r) => s + r.wipes, 0) / done.length > 1) fails.push('the expert wipes out more than once a run on average');
  }
  if (def.v3) { const b = runs.filter((r) => r.bot === 'beginner' && r.finished).length; if (b < 2) fails.push(`the beginner finished ${b} of 3`); }
  console.log(fails.length ? 'FAIL for the game\'s check: ' + fails.join('; ') : 'PASS: the bots agree with the game\'s check');
  process.exit(fails.length ? 1 : 0);
} else if (cmd === 'js') {
  const u = readLevel(target);
  console.log(defToJs(universalToDef(u), u.level.description));
} else if (cmd === 'add') {
  const u = readLevel(target), c = report(u);
  if (c.errors.length && !a.force) die(`Not added: ${c.errors.length} error(s) (fix them, or --force).`);
  const def = universalToDef(u), entry = defToJs(def, u.level.description);
  let src = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
  const exists = LEVELS.findIndex((d) => d.id === def.id);
  if (exists >= 0 && !a.replace) die(`src/levels.js already has a level "${def.id}" (level ${exists}). Add --replace to write over it, or give the new one another level.id.`);
  if (exists >= 0) {
    const idAt = src.indexOf(`id: '${def.id}'`), start = src.lastIndexOf('\n  {\n', idAt), end = src.indexOf('\n  },\n', idAt);
    if (idAt < 0 || start < 0 || end < 0) die('Could not find where that level starts and ends in src/levels.js.');
    src = src.slice(0, start + 1) + entry + src.slice(end + 5);
    console.log(`replaced level ${exists} (${def.id}) in src/levels.js`);
  } else {
    const close = src.lastIndexOf('\n];');
    if (close < 0) die('Could not find the end of LEVELS in src/levels.js.');
    src = src.slice(0, close + 1) + entry + '\n' + src.slice(close + 1);
    console.log(`added level ${LEVELS.length} (${def.id}, ${def.name}) at the end of src/levels.js`);
  }
  writeFileSync(SRC, src);
  console.log('next: npm run check (and play it: index.html?level=N)');
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}
