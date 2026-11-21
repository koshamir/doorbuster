// DOORBUSTER tool — check.mjs
// Budget and format checks that must hold at every milestone (CLAUDE.md, MINDBLOWN.md, QUALITY.md 5):
// file and line counts of the shipped game, header comments, tune.json format and its match with the
// in-code defaults, no external URLs, no Math.random in the logic, logic importable without a DOM.
// Run: node tools/check.mjs      (exit code 1 if anything fails)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT } from './lib.mjs';
import { TUNE } from '../src/config.js';

const fails = [], notes = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// ---- shipped files: index.html + src/*.js
const files = ['index.html', ...readdirSync(resolve(ROOT, 'src')).filter((f) => f.endsWith('.js')).map((f) => join('src', f))];
let total = 0;
const rows = [];
for (const f of files) {
  const text = readFileSync(resolve(ROOT, f), 'utf8');
  const lines = text.split('\n').length;
  total += lines;
  rows.push(`${String(lines).padStart(5)}  ${f}`);
  ok(lines <= 640, `${f} has ${lines} lines (limit about 600)`);
  if (f.endsWith('.js')) ok(/^\/\/ DOORBUSTER — .+\n\/\/ Purpose:/.test(text) && /\/\/ Exports:/.test(text) && /\/\/ Depends on:/.test(text), `${f} lacks the header (purpose, exports, dependencies)`);
  // external URLs: only the platform-hosted three.js may appear
  for (const m of text.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
    ok(m[0].startsWith('https://mindblown.ai/lib/three-0.185.1/three.min.js'), `${f} contains an external URL: ${m[0]}`);
  }
}
ok(files.length <= 15, `${files.length} shipped files (limit 15)`);
ok(total <= 8000, `${total} shipped lines (limit 8000)`);
notes.push(`shipped: ${files.length} files, ${total} lines (limit 15 files / 8000 lines, target about 6000)`);

// ---- logic must be deterministic and DOM-free
const LOGIC = ['config.js', 'levels.js', 'world.js', 'cart.js', 'sim.js', 'ai.js'];
for (const f of LOGIC) {
  const p = resolve(ROOT, 'src', f);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  ok(!/Math\.random|Date\.now|performance\.now/.test(text), `src/${f} uses a non-deterministic source`);
  ok(!/\b(document|window|THREE)\b/.test(text.replace(/\/\/.*$/gm, '')), `src/${f} touches the DOM or THREE`);
}

// ---- tune.json: platform format, at most 40 entries, defaults in code match
const tune = JSON.parse(readFileSync(resolve(ROOT, 'tune.json'), 'utf8'));
const names = Object.keys(tune);
ok(names.length <= 40, `tune.json has ${names.length} entries (limit 40)`);
for (const n of names) {
  const e = tune[n];
  ok(/^[a-z][a-z0-9_]{0,39}$/.test(n), `tune name "${n}" breaks the naming rule`);
  if (typeof e.value === 'number') {
    ok(typeof e.min === 'number' && typeof e.max === 'number', `tune "${n}" needs min and max`);
    ok(e.value >= e.min && e.value <= e.max, `tune "${n}" value ${e.value} is outside ${e.min}..${e.max}`);
  } else if (typeof e.value !== 'boolean') {
    ok(e.kind === 'color' || e.kind === 'text' || Array.isArray(e.options), `tune "${n}" has an unknown type`);
  }
  ok(n in TUNE, `tune "${n}" has no default in src/config.js`);
  if (n in TUNE) ok(TUNE[n] === e.value, `tune "${n}": tune.json says ${e.value}, src/config.js says ${TUNE[n]}`);
}
for (const n in TUNE) ok(n in tune, `src/config.js has "${n}" but tune.json does not`);
notes.push(`tune.json: ${names.length} entries (limit 40)`);

// ---- size of everything except three.js
let bytes = 0;
for (const f of [...files, 'tune.json']) bytes += statSync(resolve(ROOT, f)).size;
ok(bytes < 1.5 * 1024 * 1024, `shipped size ${(bytes / 1024).toFixed(0)} KB exceeds 1.5 MB`);
notes.push(`size without three.js: ${(bytes / 1024).toFixed(0)} KB (limit 1536 KB)`);

console.log(rows.join('\n'));
console.log(notes.join('\n'));
if (fails.length) { console.log('\nFAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nall checks pass');
