// DOORBUSTER tool — shots.mjs
// `npm run shots -- <target>` (QUALITY.md section 3): at most six exact, repeatable frames per target
// (manual clock), written as JPEG (1280 x 720 at most, quality 85) to shots/latest/, which is emptied
// first. One summary line per image: tier, draw calls, triangles.
// Targets: lineup | kit:<store> | level:<n> | ui | cover | release
// Run: node tools/shots.mjs lineup      (add --quality low|med|high to force a tier)
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { startServer } from './serve.mjs';
import { ROOT, args } from './lib.mjs';

const a = args(), target = process.argv.slice(2).find((s) => !s.startsWith('--')) || 'lineup';
const out = resolve(ROOT, 'shots', 'latest');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const q = a.quality ? `&quality=${a.quality}` : '';

// A shot: { name, query, size: [w, h], at: seconds to advance before the picture, small: width of a squint copy }
const scene = (name, query, extra = {}) => ({ name, query: query + '&manual=1' + q, at: 0.6, ...extra });
function plan(t) {
  const [kind, arg] = t.split(':');
  if (kind === 'lineup') return [scene('cast', 'scene=lineup'), scene('crowd', 'scene=lineup&view=crowd'), scene('faces', 'scene=faces'),
    scene('faces40', 'scene=faces&small=1'), scene('flat', 'scene=lineup&flat=1'), scene('cart', 'scene=cart')];
  if (kind === 'kit') return [scene('wide', `scene=kit&store=${arg}&view=wide`), scene('start', `scene=kit&store=${arg}&view=start`),
    scene('shelf', `scene=kit&store=${arg}&view=shelf`), scene('hazard', `scene=kit&store=${arg}&view=hazard`),
    scene('squint', `scene=kit&store=${arg}&view=start`, { small: 320 })];
  if (kind === 'level') return [{ name: 'level', level: Number(arg) }];
  if (kind === 'ui') return [scene('title', 'title=1', { at: 1.2 }), scene('directory', 'title=1&screen=directory', { at: 1.2 }), scene('customs', 'title=1&screen=customs', { at: 1.2 }),
    scene('intro', 'level=1&screen=intro', { at: 0.4 }), { name: 'receipt', level: 1, only: 'receipt' }, scene('phone', 'level=1&seed=1&autoplay=expert', { size: [390, 844], at: 6, touch: true })];
  if (kind === 'cover') return [scene('cover16x9', 'title=1&cover=1', { size: [1200, 675], at: 1.2 }), scene('cover1x1', 'title=1&cover=1', { size: [1000, 1000], at: 1.2 }),
    scene('start1', 'level=1&seed=1&cover=1&screen=start', { at: 0.2 })];
  if (kind === 'release') return [scene('title', 'title=1', { at: 1.2 }), ...[1, 3, 4, 5, 6].map((n) => ({ name: 'moment' + n, level: n, only: 'moment' }))];
  throw new Error('unknown target ' + t);
}

const server = await startServer(ROOT, 0);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--mute-audio'] });
const lines = [], problems = [];
const info = (page) => page.evaluate(() => { const i = window.__db.info(); return { tier: i.tier || '?', calls: i.calls, tris: i.tris, t: i.t, state: i.state, log: i.log || [], moment: i.moment }; });
async function snap(page, name, small) {
  const file = join(out, name + '.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  const i = await info(page);
  lines.push(`${name.padEnd(12)} ${String(i.tier).padEnd(5)} ${String(i.calls).padStart(4)} calls ${String(Math.round(i.tris / 1000)).padStart(5)}k tris`);
  if (small) {
    const p = await browser.newPage({ viewport: { width: small, height: Math.round(small * 9 / 16) } });
    await p.setContent(`<body style="margin:0"><img style="width:${small}px;display:block" src="data:image/jpeg;base64,${readFileSync(file).toString('base64')}">`);
    await p.waitForFunction(() => document.images[0].complete);
    await p.screenshot({ path: file, type: 'jpeg', quality: 85 });
    await p.close();
  }
}
async function open(query, size, touch) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 200)));
  await page.goto(`${server.url}/index.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}
const advance = (page, s) => page.evaluate((d) => window.__db.advance(d), s);

// A level: doors open, three beats of the expert run, a ram or wipeout, the receipt. The run is
// deterministic, so a first pass finds when things happen and a second takes the pictures.
async function level(n, only) {
  const query = `level=${n}&seed=1&autoplay=expert&manual=1${q}`;
  let page = await open(query, [1280, 720]);
  let end = 60, hit = -1, moment = -1;
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => { window.__db.advance(0.5); const i = window.__db.info(); return { t: i.t, state: i.state, log: i.log, moment: i.moment }; });
    if (hit < 0) { const e = s.log.find((x) => x[0] === 'wipeout' || x[0] === 'ram' || x[0] === 'ram<'); if (e) hit = e[1]; }
    if (s.moment !== undefined && s.moment >= 0 && moment < 0) moment = s.moment;
    if (s.state !== 'play' && s.state !== 'title') { end = s.t; break; }
  }
  await page.context().close();
  page = await open(query, [1280, 720]);
  const marks = only === 'receipt' ? [] : only === 'moment' ? [[moment >= 0 ? moment : end * 0.6, 'moment' + n]]
    : [[0.35, 'doors'], [end * 0.3, 'beat1'], [end * 0.55, 'beat2'], [end * 0.8, 'beat3'], ...(hit >= 0 ? [[hit + 0.12, 'hit']] : [])];
  marks.sort((x, y) => x[0] - y[0]);
  for (const [t, name] of marks) {
    const now = (await info(page)).t;
    if (t > now) await advance(page, t - now);
    await snap(page, name);
  }
  if (!only || only === 'receipt') {
    for (let i = 0; i < 400 && (await info(page)).state === 'play'; i++) await advance(page, 0.5);
    await advance(page, 6);
    await snap(page, only ? 'receipt' : 'receipt');
  }
  await page.context().close();
}

for (const s of plan(target)) {
  try {
    if (s.level !== undefined) { await level(s.level, s.only); continue; }
    const page = await open(s.query, s.size || [1280, 720], s.touch);
    await advance(page, s.at);
    await snap(page, s.name, s.small);
    await page.context().close();
  } catch (e) { problems.push(`${s.name}: ${e.message.split('\n')[0]}`); }
}
await browser.close(); await server.close();
writeFileSync(join(out, 'summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
if (problems.length) { console.log('PROBLEMS:\n  ' + [...new Set(problems)].slice(0, 10).join('\n  ')); process.exitCode = 1; }
console.log(`${lines.length} images in shots/latest/`);
