// DOORBUSTER tool — package.mjs
// Builds the handoff package (MINDBLOWN.md section 6) in handoff/: HANDOFF.md with its generated
// parts filled in (file map, tune table, the numbers of the reference runs), the modules, the
// single-file build, tune.json, six reference screenshots, a gameplay recording, cover, card and icon.
// Then it checks the package on a clean copy: the copy is served from a temporary folder, the bot
// plays Level 1 from the single file, and the result must equal the reference run with no console
// error and no request outside the page's origin.
// Run: node tools/package.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { ROOT } from './lib.mjs';

const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const out = resolve(ROOT, 'handoff');
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');

console.log(run('tools/check.mjs').trim().split('\n').pop());
const built = run('tools/build.mjs').trim();
console.log(built);
const order = ['index.html', ...built.match(/\(([^)]*)\)/)[1].split(', ').map((f) => 'src/' + f)];
for (const d of ['', 'src', 'dist', 'dist/lib', 'lib', 'media']) mkdirSync(join(out, d), { recursive: true });
run('tools/shots.mjs', '--set', 'handoff', '--out', 'handoff/media');
const shots = JSON.parse(readFileSync(join(out, 'media', 'summary.json'), 'utf8'));
if (shots.problems.length) throw new Error('capture problems: ' + shots.problems.join('; '));

// ---- the generated parts of HANDOFF.md
const head = (file) => {
  const text = readFileSync(resolve(ROOT, file), 'utf8'), lines = text.split('\n').length - 1;
  const grab = (key) => { const m = text.match(new RegExp(key + ':([\\s\\S]*?)(?:\\n(?://)?\\s*(?:Exports|Depends on|Loads|Interface look|Purpose):|\\n//\\s*\\n|\\n\\n|-->)')); return m ? m[1].replace(/\n\s*(\/\/)?\s*/g, ' ').trim() : ''; };
  return `| \`${file}\` | ${lines} | ${grab('Purpose')} | ${grab('Depends on') || '—'} |`;
};
const fileMap = '| File (in this order) | Lines | Purpose | Depends on |\n| --- | --- | --- | --- |\n' + order.map(head).join('\n');
const tune = JSON.parse(readFileSync(resolve(ROOT, 'tune.json'), 'utf8'));
const tuneTable = '| Name | Value | Range | Meaning |\n| --- | --- | --- | --- |\n' + Object.entries(tune).map(([k, v]) =>
  `| \`${k}\` | ${v.value} | ${v.min !== undefined ? v.min + ' – ' + v.max : typeof v.value} | ${v.label || ''} |`).join('\n');
const ref = (name) => shots.summary.find((r) => r.name === name), at = (r, type) => (r.log.find((e) => e[0] === type) || [0, 0])[1];
const l1 = ref('ref_l1'), l2 = ref('ref_l2'), l3 = ref('ref_l3');
const result = (r) => `checks out at ${r.doneT.toFixed(2)} s with ${r.receipt.count} goods: ITEMS ${money(r.receipt.items)}, STUNTS ${money(r.receipt.stunts)}, TIME ${money(r.receipt.time)}, TOTAL ${money(r.receipt.total)}`;
const checks = [
  'The page loads with an empty console and requests nothing outside its own origin (on the platform: only the hosted three.js).',
  'Title: the DOORBUSTER logo over a three-quarter view of the pink cart with a pink ring under it, a crowd ahead, START below (`media/cover.png` is that view without the button).',
  'After START: 3-2-1-GO, the view swoops down, four carts and a pack of shoppers leave the line; the first shelf is swept and CLEAN SWEEP pops up (`media/ref_l1_1p2.png`, `ref_l1_6.png`).',
  `Level 1, seed 3, expert bot: the cart ${result(l1)}. A port that plays the same simulation gets these numbers to the cent.`,
  `In that run the first RAM is at ${at(l1, 'ram').toFixed(2)} s, MADNESS mode starts at ${at(l1, 'madmode').toFixed(2)} s, the flash sale is announced at ${at(l1, 'flash').toFixed(2)} s.`,
  `Level 2 (\`?level=2&seed=3&autoplay=expert\`): the cart ${result(l2)}. Travelator arrows move, the first corner turns round a display (\`media/ref_l2_14.png\`).`,
  `Level 3 (\`?level=3&seed=3&autoplay=expert\`): the cart ${result(l3)}. The atrium has a fountain, a tree and a yellow ramp; a train of steel carts crosses the last corridor (\`media/ref_l3_14.png\`).`,
  'The receipt prints line by line with a medal stamp, then a table of all shoppers with YOU highlighted, then BEST; RETRY and NEXT appear (`media/ref_l1_receipt.png`).',
  'Sound starts with the first key or click (music, then effects); M and the platform sound switch mute it; P pauses and reports the pause to the platform.',
  `Frame cost in the reference run: ${l1.calls} draw calls and ${l1.tris.toLocaleString('en-US')} triangles at the checkout; changing \`maxspeed\` in the tune panel changes the cart's top speed at once.`,
];
let doc = readFileSync(resolve(ROOT, 'HANDOFF.md'), 'utf8');
doc = doc.replace('<!-- FILEMAP -->', fileMap).replace('<!-- TUNE -->', tuneTable).replace('<!-- CHECKS -->', checks.map((c, i) => `${i + 1}. ${c}`).join('\n'));
writeFileSync(join(out, 'HANDOFF.md'), doc);

// ---- the files
for (const f of order) copyFileSync(resolve(ROOT, f), join(out, f));
for (const f of ['tune.json', 'lib/three.min.js', 'dist/index.html', 'dist/tune.json', 'dist/lib/three.min.js']) copyFileSync(resolve(ROOT, f), join(out, f));

// ---- the clean copy
const copy = mkdtempSync(join(tmpdir(), 'doorbuster-handoff-'));
cpSync(out, copy, { recursive: true });
run('tools/shots.mjs', '--set', 'dist', '--root', join(copy, 'dist'), '--out', join(copy, '_check'));
const check = JSON.parse(readFileSync(join(copy, '_check', 'summary.json'), 'utf8')), got = check.summary[0];
const same = got.receipt && got.receipt.total === l1.receipt.total && got.receipt.count === l1.receipt.count && Math.abs(got.doneT - l1.doneT) < 1e-9;
console.log(`handoff/: ${readdirSync(out).join(', ')}; media: ${readdirSync(join(out, 'media')).filter((f) => f !== 'summary.json' && !f.startsWith('_')).join(', ')}`);
console.log(`clean copy in ${copy}: single file ${got.receipt ? 'TOTAL ' + money(got.receipt.total) + ' at ' + got.doneT.toFixed(2) + ' s' : 'did not finish'}, ` +
  `reference ${money(l1.receipt.total)} at ${l1.doneT.toFixed(2)} s; ${check.problems.length ? 'PROBLEMS: ' + check.problems.join('; ') : 'console clean, no external requests'}`);
if (!same || check.problems.length) { console.error('PACKAGE CHECK FAILED'); process.exit(1); }
console.log('package check passed');
