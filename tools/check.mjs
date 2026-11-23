// DOORBUSTER tool — check.mjs
// `npm run check` (QUALITY.md section 2): one command, four parts, at most 30 lines of output,
// failures first, exit code 1 on any failure.
//   1. static: file budget and headers, tune.json, no external URLs, deterministic DOM-free logic, the build
//   2. level validator: reachability and route order (pass windows, loot rule and pace switch on with
//      the v3 levels, see levelRules below)
//   3. simulation smoke test in Node worker threads: the expert bot finishes, rivals never stick,
//      the run is deterministic
//   4. browser smoke test in Playwright's Chromium: every level and the lineup load clean and stay
//      inside the draw-call and triangle budgets
// Run: node tools/check.mjs [--skip browser,sim]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { ROOT, args, loadTune } from './lib.mjs';

const LOGIC = ['config.js', 'levels.js', 'world.js', 'cart.js', 'sim.js', 'ai.js', 'objects.js'];
const BUDGET = { files: 30, lines: 16000, perFile: 900, bytes: 2.5 * 1024 * 1024, calls: 300, tris: 500000 };
const SEEDS = [1, 2, 3];

// ---- worker: one simulation job -------------------------------------------------------------------
if (!isMainThread) await worker(); else await main();

async function worker() {
  const { level, seed, bot } = workerData;
  loadTune();
  const { LEVELS } = await import('../src/levels.js');
  const { createSim, stepSim } = await import('../src/sim.js');
  const { CFG } = await import('../src/config.js');
  const sim = createSim(LEVELS[level], seed, { bot, countdown: 0 });
  const limit = Math.ceil((sim.timer + 2) / CFG.STEP);
  let hash = 2166136261, steps = 0;
  const stuck = new Map(); let worst = 0, who = '';
  // the pace rule: the longest stretch of the player's run with nothing near it (an object, loot, a piece) and no turn
  const world = sim.world, near = [];
  for (const o of world.objs) near.push([o.x, o.z, o.kind === 'tiles' ? 6 : 5]);
  for (const q of world.pieces) near.push([q.x, q.z, 4]);
  for (const l of world.lanes) near.push([l.x, l.z, 4]);
  let dead = 0, deadMax = 0, deadAt = null, lx = sim.player.x, lz = sim.player.z, lh = 0, lastT = 0;
  const mix = (v) => { hash = Math.imul(hash ^ (v | 0), 16777619) >>> 0; };
  while (sim.phase !== 'done' && sim.phase !== 'closed' && steps++ < limit) {
    stepSim(sim);
    for (const e of sim.events) { mix(e.type.length * 131 + e.type.charCodeAt(0)); mix(Math.round(sim.t * 120)); mix(Math.round((e.value || 0) * 100)); }
    sim.events.length = 0;
    if (sim.phase !== 'run') continue;
    if (bot === 'expert' && sim.t - lastT >= 0.25) {
      lastT = sim.t;
      const p = sim.player, step = Math.hypot(p.x - lx, p.z - lz), h = Math.atan2(p.vx, p.vz);
      let busy = Math.abs(Math.atan2(Math.sin(h - lh), Math.cos(h - lh))) > 0.35 || p.wipeT > 0 || world.belt[Math.floor(p.z / 2) * world.cols + Math.floor(p.x / 2)] > 0;   // riding a conveyor counts
      if (!busy) for (const [x, z, r] of near) if (Math.abs(p.x - x) < r && Math.abs(p.z - z) < r) { busy = true; break; }
      if (!busy) for (const it of world.items) if (!it.taken && Math.abs(p.x - it.x) < 4.5 && Math.abs(p.z - it.z) < 4.5) { busy = true; break; }
      if (!busy) for (const d of world.drops) if (d.live && Math.abs(p.x - d.x) < 4.5 && Math.abs(p.z - d.z) < 4.5) { busy = true; break; }
      if (!busy) for (const k of sim.carts) if (k !== p && !k.done && Math.abs(p.x - k.x) < 5 && Math.abs(p.z - k.z) < 5) { busy = true; break; }   // a rival alongside
      if (!busy) for (const sh of sim.shoppers) if (sh.state >= 0 && Math.abs(p.x - sh.x) < 4.5 && Math.abs(p.z - sh.z) < 4.5) { busy = true; break; }   // shoppers are moving obstacles
      dead = busy || step > 6 ? 0 : dead + step;          // (a respawn is a jump, not a drive)
      if (dead > deadMax) { deadMax = dead; deadAt = [Math.floor(p.x / 2), Math.floor(p.z / 2)]; }
      lx = p.x; lz = p.z; lh = h;
    }
    for (const k of sim.carts) {
      if (k.player || k.done) continue;
      const ai = k.ai, waiting = (ai && (ai.hold || ai.photoT > 0 && ai.photoT < 1.4 || ai.warnT > 0)) || k.stunT > 0 || k.air > 0 || k.wipeT > 0 || k.wait;
      const t = !waiting && Math.hypot(k.vx, k.vz) < 0.3 ? (stuck.get(k) || 0) + CFG.STEP : 0;
      stuck.set(k, t);
      if (t > worst) { worst = t; who = k.char; }
    }
  }
  const p = sim.player;
  parentPort.postMessage({ level, seed, bot, finished: sim.phase === 'done', time: +sim.t.toFixed(2), receipt: p.receipt ? p.receipt.total : -1,
    hash, stuck: +worst.toFixed(2), stuckWho: who, wipeouts: sim.stats.wipeouts || 0, passes: sim.stats.passes || {}, dead: +deadMax.toFixed(1), deadAt, timer: sim.timer });
}

// ---- main -----------------------------------------------------------------------------------------
async function main() {
const a = args();
const skip = new Set(String(a.skip || '').split(',').filter(Boolean));
const fails = [], summary = [];
const fail = (part, msg) => fails.push(`[${part}] ${msg}`);
const t0 = Date.now();

// 1. static
{
  const files = ['index.html', ...readdirSync(resolve(ROOT, 'src')).filter((f) => f.endsWith('.js')).map((f) => join('src', f))];
  let total = 0, bytes = 0, longest = 0;
  for (const f of files) {
    const text = readFileSync(resolve(ROOT, f), 'utf8'), lines = text.split('\n').length;
    total += lines; bytes += statSync(resolve(ROOT, f)).size; longest = Math.max(longest, lines);
    if (lines > BUDGET.perFile) fail('static', `${f} has ${lines} lines (limit ${BUDGET.perFile})`);
    if (f.endsWith('.js') && !(/^\/\/ DOORBUSTER — [\w.]+\n\/\/ Purpose:/.test(text) && /\n\/\/ Exports:/.test(text) && /\n\/\/ Depends on:/.test(text))) fail('static', `${f} lacks its header (purpose, exports, dependencies)`);
    if (f === 'index.html' && !/DOORBUSTER — index\.html[\s\S]*Purpose:/.test(text)) fail('static', 'index.html lacks its header comment');
    for (const m of text.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) {
      if (!(f === join('src', 'platform.js') && m[0] === 'https://mindblown.ai/lib/three-0.185.1/three.min.js')) fail('static', `${f} contains an external URL: ${m[0]}`);
    }
  }
  if (files.length > BUDGET.files) fail('static', `${files.length} shipped files (limit ${BUDGET.files})`);
  if (total > BUDGET.lines) fail('static', `${total} shipped lines (limit ${BUDGET.lines})`);
  for (const f of LOGIC) {
    const p = resolve(ROOT, 'src', f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '');
    if (/Math\.random|Date\.now|performance\.now/.test(text)) fail('static', `src/${f} uses a non-deterministic source`);
    if (/\b(document|window|THREE)\b/.test(text)) fail('static', `src/${f} touches the DOM or THREE`);
    try { await import('../src/' + f); } catch (e) { fail('static', `src/${f} does not import in Node: ${e.message}`); }
  }
  // tune.json (MINDBLOWN.md section 4)
  const { TUNE } = await import('../src/config.js');
  const tune = JSON.parse(readFileSync(resolve(ROOT, 'tune.json'), 'utf8')), names = Object.keys(tune);
  if (names.length > 40) fail('static', `tune.json has ${names.length} entries (limit 40)`);
  for (const n of names) {
    const e = tune[n];
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(n)) fail('static', `tune name "${n}" breaks the naming rule`);
    if (typeof e.value === 'number') { if (!(typeof e.min === 'number' && typeof e.max === 'number' && e.value >= e.min && e.value <= e.max)) fail('static', `tune "${n}" needs min <= value <= max`); }
    else if (e.kind === 'color') { if (!/^#[0-9a-f]{6}$/i.test(e.value)) fail('static', `tune "${n}" is not #rrggbb`); }
    else if (e.kind === 'text') { if (typeof e.value !== 'string' || e.value.length > 200) fail('static', `tune "${n}" text is too long`); }
    else if (Array.isArray(e.options)) { if (!e.options.includes(e.value)) fail('static', `tune "${n}" value is not one of its options`); }
    else if (typeof e.value !== 'boolean') fail('static', `tune "${n}" has an unknown kind`);
    if (!(n in TUNE)) fail('static', `tune "${n}" has no default in src/config.js`);
    else if (typeof TUNE[n] !== typeof e.value) fail('static', `tune "${n}" has a different type in src/config.js`);
  }
  // the single-file build
  let distKB = 0;
  try {
    execFileSync(process.execPath, [resolve(ROOT, 'tools', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
    const size = statSync(resolve(ROOT, 'dist', 'index.html')).size;
    distKB = size / 1024;
    if (size > BUDGET.bytes) fail('static', `dist/index.html is ${distKB.toFixed(0)} KB (limit 2.5 MB)`);
  } catch (e) { fail('static', 'the build fails: ' + String(e.stderr || e.message).trim().split('\n').pop()); }
  summary.push(`static   ${files.length} files, ${total} lines (longest ${longest}), tune ${names.length}/40, dist ${distKB.toFixed(0)} KB`);
}

// 2. level validator
const { LEVELS } = await import('../src/levels.js');
{
  const { buildWorld } = await import('../src/world.js');
  const { makeRng } = await import('../src/config.js');
  let n = 0;
  for (let li = 0; li < LEVELS.length; li++) {
    const def = LEVELS[li], tag = `level ${li} ${def.id}`, w = buildWorld(def, makeRng(1));
    let lost = 0;
    for (let i = 0; i < w.nav.length; i++) if (w.floor[i] && !w.block[i] && w.nav[i] > 1e8) lost++;
    if (lost) fail('levels', `${tag}: ${lost} floor tiles cannot reach a checkout`);
    // checkpoints in route order: each one nearer the checkout than the one before
    const cps = w.checkpoints || [];
    if (!def.cpAny) for (let i = 1; i < cps.length; i++) if (!(cps[i].nav < cps[i - 1].nav)) fail('levels', `${tag}: checkpoint ${i + 1} is not after checkpoint ${i} on the route`);
    // a button or plate lies before what it opens (its own route distance is larger)
    for (const s of w.switches || []) if (s.target && !(s.nav > s.target.nav)) fail('levels', `${tag}: switch at ${s.c},${s.r} comes after what it opens`);
    if (def.v3) for (const rule of levelRules(w)) fail('levels', `${tag}: ${rule}`);
    n++;
  }
  summary.push(`levels   ${n} levels: every floor tile reaches a checkout, checkpoints and switches in route order`);
}

// 3. simulation smoke test
if (!skip.has('sim')) {
  const jobs = [];
  for (let li = 0; li < LEVELS.length; li++) {
    if (!LEVELS[li].rivals || !LEVELS[li].rivals.length) continue;      // the test course has no rivals and no author run
    for (const seed of SEEDS) jobs.push({ level: li, seed, bot: 'expert' });
    jobs.push({ level: li, seed: 1, bot: 'expert', repeat: true });
    if (LEVELS[li].v3) for (const seed of SEEDS) jobs.push({ level: li, seed, bot: 'beginner' });
  }
  const run = (job) => new Promise((ok, no) => { const wk = new Worker(fileURLToPath(import.meta.url), { workerData: job }); wk.on('message', (m) => ok({ ...m, repeat: job.repeat })); wk.on('error', no); });
  const results = [], pool = Math.min(8, jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: pool }, async () => { while (next < jobs.length) { const j = jobs[next++]; results.push(await run(j)); } }));
  let worst = 0;
  const levelNotes = [];
  for (let li = 0; li < LEVELS.length; li++) {
    const mine = results.filter((r) => r.level === li);
    if (!mine.length) continue;
    const tag = `level ${li}`;
    const def = LEVELS[li], experts = mine.filter((r) => r.bot === 'expert' && !r.repeat), begs = mine.filter((r) => r.bot === 'beginner');
    for (const r of mine) {
      if (r.bot === 'expert' && !r.finished) fail('sim', `${tag} seed ${r.seed}: the expert bot did not finish (t ${r.time} s)`);
      if (r.stuck > 1) fail('sim', `${tag} seed ${r.seed}: ${r.stuckWho} stood stuck for ${r.stuck} s`);
      worst = Math.max(worst, r.stuck);
    }
    if (def.v3) {
      // QUALITY.md section 2: the expert near the author time with at most one wipeout a run on average, the
      // beginner home in two runs of three, every rival past its hazards, the pace of the author route
      const mean = experts.reduce((s, r) => s + r.time, 0) / experts.length, wipes = experts.reduce((s, r) => s + r.wipeouts, 0) / experts.length;
      if (def.author && Math.abs(mean - def.author) > def.author * 0.2) fail('sim', `${tag}: the expert's mean time ${mean.toFixed(1)} s is not within 20% of the author time ${def.author} s`);
      if (wipes > 1) fail('sim', `${tag}: the expert wipes out ${wipes.toFixed(1)} times a run on average`);
      if (begs.filter((r) => r.finished).length < 2) fail('sim', `${tag}: the beginner bot finished ${begs.filter((r) => r.finished).length} of 3`);
      let pass = 0, miss = 0;
      const keys = new Set(), runs = [...experts, ...begs];
      for (const r of runs) for (const [key, [p, f]] of Object.entries(r.passes)) { pass += p; miss += f; keys.add(key); }
      if (pass + miss > 0 && pass / (pass + miss) < 0.8) fail('sim', `${tag}: the rivals pass ${Math.round(pass / (pass + miss) * 100)}% of the hazards (at least 80%)`);
      for (const key of keys) if (runs.every((r) => r.passes[key] && r.passes[key][1] > 0)) fail('sim', `${tag}: ${key.split(':')[0]} fails object ${key.split(':')[1]} in every run`);
      const dead = Math.max(...experts.map((r) => r.dead));
      if (dead > 15) { const r = experts.find((x) => x.dead === dead); fail('levels', `${tag}: ${dead} m of the author route with nothing on it (near ${r.deadAt})`); }
      levelNotes.push(`L${li} ${mean.toFixed(1)}s/${def.author || '?'} wipes ${wipes.toFixed(1)} beginner ${begs.filter((r) => r.finished).length}/3 rivals ${pass + miss ? Math.round(pass / (pass + miss) * 100) : 100}%`);
    }
    const a1 = mine.find((r) => r.seed === 1 && !r.repeat && r.bot === 'expert'), a2 = mine.find((r) => r.repeat);
    if (a1 && a2 && (a1.receipt !== a2.receipt || a1.hash !== a2.hash)) fail('sim', `${tag}: seed 1 played twice differs (receipt ${a1.receipt} / ${a2.receipt})`);
  }
  summary.push(`sim      ${results.length} runs: ${levelNotes.join('; ')}, worst rival stand ${worst.toFixed(2)} s, deterministic`);
}

// 4. browser smoke test
if (!skip.has('browser')) {
  const { chromium } = await import('playwright-core');
  const { startServer } = await import('./serve.mjs');
  const server = await startServer(ROOT, 0);
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--mute-audio'] });
  let peakCalls = 0, peakTris = 0, pages = 0;
  const visit = async (query, seconds, tag) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (m) => { if (m.type() === 'error') fail('browser', `${tag}: console error: ${m.text().slice(0, 160)}`); });
    page.on('pageerror', (e) => fail('browser', `${tag}: page error: ${e.message.slice(0, 160)}`));
    page.on('requestfailed', (r) => fail('browser', `${tag}: request failed: ${r.url()}`));
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(server.url) && !u.startsWith('data:') && !u.startsWith('blob:')) fail('browser', `${tag}: request outside the origin: ${u}`); });
    try {
      await page.goto(`${server.url}/index.html?${query}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
      let calls = 0, tris = 0;
      for (let t = 0; t < seconds; t += 0.5) {
        const info = await page.evaluate(() => { window.__db.advance(0.5); return window.__db.info(); });
        calls = Math.max(calls, info.calls); tris = Math.max(tris, info.tris);
      }
      if (seconds === 0) { const info = await page.evaluate(() => { window.__db.advance(0.1); return window.__db.info(); }); calls = info.calls; tris = info.tris; }
      if (calls > BUDGET.calls) fail('browser', `${tag}: ${calls} draw calls at the busiest moment (limit ${BUDGET.calls})`);
      if (tris > BUDGET.tris) fail('browser', `${tag}: ${tris} triangles at the busiest moment (limit ${BUDGET.tris})`);
      peakCalls = Math.max(peakCalls, calls); peakTris = Math.max(peakTris, tris); pages++;
    } catch (e) { fail('browser', `${tag}: ${e.message.split('\n')[0]}`); }
    await page.close();
  };
  for (let li = 0; li < LEVELS.length; li++) await visit(`level=${li}&seed=1&autoplay=expert&manual=1`, 5, `level ${li}`);
  await visit('scene=lineup&manual=1', 0, 'lineup');
  await browser.close(); await server.close();
  summary.push(`browser  ${pages} pages clean, peak ${peakCalls} draw calls, ${(peakTris / 1000).toFixed(0)}k triangles`);
}

const out = [...fails.slice(0, 30 - summary.length - 1), ...(fails.length > 30 - summary.length - 1 ? [`... and ${fails.length - (30 - summary.length - 1)} more`] : []), ...summary];
console.log(out.join('\n'));
console.log(`${fails.length ? 'FAIL' : 'PASS'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(fails.length ? 1 : 0);
}

// v3 level rules (pass windows, loot rule, pace): they apply to levels marked v3 (P2 onward).
function levelRules(w) { return w.ruleFails || []; }
