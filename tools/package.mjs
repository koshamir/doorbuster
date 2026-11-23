// DOORBUSTER tool — package.mjs
// Builds the handoff package (MINDBLOWN.md section 6) in handoff/: index.html (the whole game in one file), tune.json,
// assets/voice/ (voices.json and any mp3 the owner added), lib/three.min.js (for local runs only: on mindblown.ai the
// page loads the hosted bundle), cover, card and icon made from game frames, and HANDOFF.md.
// Then it checks the package on a clean copy: the copy is served from a temporary folder, the expert bot plays level 1
// (seed 1) from the single file, and the receipt must equal the source tree's, with a clean console and no request
// outside the page's origin.
// Run: node tools/package.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT } from './lib.mjs';
import { startServer } from './serve.mjs';
import { LEVELS } from '../src/levels.js';

const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const out = resolve(ROOT, 'handoff'), money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const kb = (f) => Math.round(statSync(f).size / 1024).toLocaleString('en-US') + ' KB';

console.log(run('tools/check.mjs').trim().split('\n').pop());
console.log(run('tools/build.mjs').trim().split('\n').pop());
run('tools/shots.mjs', 'cover');

// ---- the files
rmSync(out, { recursive: true, force: true });
for (const d of ['', 'lib', 'assets/voice']) mkdirSync(join(out, d), { recursive: true });
copyFileSync(resolve(ROOT, 'dist/index.html'), join(out, 'index.html'));
copyFileSync(resolve(ROOT, 'tune.json'), join(out, 'tune.json'));
copyFileSync(resolve(ROOT, 'lib/three.min.js'), join(out, 'lib/three.min.js'));
const voices = readdirSync(resolve(ROOT, 'assets/voice'));
for (const f of voices) copyFileSync(resolve(ROOT, 'assets/voice', f), join(out, 'assets/voice', f));
for (const [from, to] of [['cover16x9.jpg', 'cover.jpg'], ['cover1x1.jpg', 'card.jpg'], ['icon256.jpg', 'icon.jpg']]) copyFileSync(resolve(ROOT, 'shots/latest', from), join(out, to));

// ---- one run of level 1 (seed 1, expert bot, manual clock) in a browser, served from root
async function playLevel1(root) {
  const server = await startServer(root, 0);
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), problems = [];
  page.on('pageerror', (e) => problems.push('page error: ' + e.message.slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console error: ' + m.text().slice(0, 120)); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(server.url) && !u.startsWith('data:') && !u.startsWith('blob:')) problems.push('external request: ' + u); });
  await page.goto(`${server.url}/index.html?level=1&seed=1&autoplay=expert&manual=1`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  let info = null;
  for (let i = 0; i < 240 && !(info && info.receipt); i++) info = await page.evaluate(() => { window.__db.advance(0.5); return window.__db.info(); });
  await browser.close(); await server.close();
  return { receipt: info && info.receipt, doneT: info ? info.doneT : -1, problems };
}
const ref = await playLevel1(ROOT);
if (!ref.receipt) throw new Error('the reference run did not finish');
const rc = ref.receipt;

// ---- HANDOFF.md (one page)
const tune = JSON.parse(readFileSync(resolve(ROOT, 'tune.json'), 'utf8'));
const tuneLine = Object.entries(tune).map(([k, v]) => `\`${k}\` ${v.value}${v.label ? ' (' + v.label.replace(/,.*$/, '') + ')' : ''}`).join(' · ');
const stores = LEVELS.slice(1).map((d, i) => `${i + 1} ${d.name} (${(d.mode || 'rush').toUpperCase()})`).join(', ');
const doc = `# DOORBUSTER — handoff

**The game.** Black Friday at the mall: race a shopping cart through obstacle-course stores, grab loot where it is dangerous,
ram rival shoppers until their loot explodes, and crash into the checkout before the store closes. Six stores: ${stores}.
Seven rivals with gibberish voices, MADNESS mode, Cart Customs (upgrades, paints, hats) and a Mall Directory. Everything is
drawn in code at load time on three.js r185 (the platform's hosted bundle). Keyboard (arrows or WASD, Space drift, Shift dash,
P pause, M sound, R retry) and touch. Made for Mindblown Cup #2, "Shopping Madness".

## Files to upload
| File | Size | What it is |
| --- | --- | --- |
| \`index.html\` | ${kb(join(out, 'index.html'))} | the whole game in one file; on mindblown.ai it loads the hosted three.js, elsewhere \`lib/three.min.js\` |
| \`tune.json\` | ${kb(join(out, 'tune.json'))} | the tune values below (on the platform they come from \`mindblown.tune()\`) |
| \`assets/voice/\` | ${voices.length} file(s) | \`voices.json\`, the list of voice recordings (empty: every line is synthesized) |
| \`cover.jpg\`, \`card.jpg\`, \`icon.jpg\` | 1200 × 675, 1000 × 1000, 256 × 256 | made from game frames |

\`lib/three.min.js\` is only for running the package locally; do not upload it.

## Platform calls
\`tune()\` and \`tune.on\` (values below) · \`sound.on\`, \`sound.set\`, \`sound.onchange\` (the game's sound button and M follow
the platform switch) · \`viewer.username\` · \`load('progress')\` once at start, then \`save('progress', …)\` after each receipt
and setting (one key: wallet, medals, best receipts, upgrades, cosmetics, settings; a refused save loads again and retries) ·
\`leaderboard.submit(metric, value, { lower: false, label })\` for \`receipt_l1\` … \`receipt_l6\` (one per store) and
\`receipt_total\` (the sum of the best receipts), all higher-is-better · \`run.start()\`, \`run.end({ seconds, level })\`, and
\`run.pause()\` / \`run.resume()\` only in pairs.

**tune.json:** ${tuneLine}.

## Six checks after uploading
1. The page opens on the store front: the cast behind the glass doors, DOORBUSTER, START. The console stays empty and the only request outside the page is the hosted three.js.
2. START: the doors burst open and level 1 PRICE PANIC counts down; Sprint Dad and Granny Tank leave the line with you.
3. Reference run: open \`index.html?level=1&seed=1&autoplay=expert&manual=1\`, then in the console run \`for (let i = 0; i < 120 && !__db.info().receipt; i++) __db.advance(0.5); __db.info().receipt.total\`. It must print **${rc.total}** (${money(rc.total)}: ITEMS ${money(rc.items)} for ${rc.count} goods, STUNTS ${money(rc.stunts)}, TIME ${money(rc.time)}; checkout at ${ref.doneT.toFixed(2)} s).
4. Finish level 1 yourself, then reload the page: the Mall Directory shows the medal and the best receipt (saves load before they save).
5. The \`receipt_l1\` and \`receipt_total\` boards each show your receipt after that run.
6. Turn the platform sound off: the game is silent and its sound button shows it; press M in the game: the platform switch follows. Switching tabs during a run pauses it.

## Voices
To replace a synthesized line with a recording, put \`<id>_<n>.mp3\` into \`assets/voice/\` and add its name to
\`assets/voice/voices.json\`, e.g. \`["penny_1.mp3", "granny_2.mp3"]\`. Ids: penny, granny, sprintdad, coupon, selfie, bubba,
gramps; \`n\` is the line's position in its row of the voice table in DESIGN.md section 7, counted from 1. A listed file plays
instead of the gibberish (the music ducks by 3 dB under it); a missing file is skipped.
`;
writeFileSync(join(out, 'HANDOFF.md'), doc);

// ---- the clean copy
const copy = mkdtempSync(join(tmpdir(), 'doorbuster-handoff-'));
cpSync(out, copy, { recursive: true });
const got = await playLevel1(copy);
const same = got.receipt && got.receipt.total === rc.total && got.receipt.count === rc.count && Math.abs(got.doneT - ref.doneT) < 1e-9;
console.log(`handoff/: ${readdirSync(out).join(', ')} (index.html ${kb(join(out, 'index.html'))})`);
console.log(`reference (source tree): TOTAL ${money(rc.total)} at ${ref.doneT.toFixed(2)} s${ref.problems.length ? '; PROBLEMS: ' + ref.problems.join('; ') : ''}`);
console.log(`clean copy (${copy}): ${got.receipt ? 'TOTAL ' + money(got.receipt.total) + ' at ' + got.doneT.toFixed(2) + ' s' : 'did not finish'}; ${got.problems.length ? 'PROBLEMS: ' + got.problems.join('; ') : 'console clean, no external requests'}`);
if (!same || got.problems.length || ref.problems.length) { console.error('PACKAGE CHECK FAILED'); process.exit(1); }
rmSync(copy, { recursive: true, force: true });      // the clean copy has done its job (it stays for inspection if the check failed)
console.log('package check passed');
