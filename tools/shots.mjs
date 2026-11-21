// DOORBUSTER tool — shots.mjs
// Opens the game in Playwright's Chromium (headless, GPU-accelerated) and captures: screenshots at
// exact game times, frame strips (contact sheets of consecutive frames), console errors, failed and
// external requests, render statistics and a real-time frame-rate sample.
// Run: node tools/shots.mjs --set m0 [--out shots/m0] [--only name]
// Scenario sets live in tools/shotsets.mjs.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { startServer } from './serve.mjs';
import { ROOT, args } from './lib.mjs';
import { SETS } from './shotsets.mjs';

const a = args();
const setName = a.set || 'm0';
const scenarios = (SETS[setName] || []).filter((s) => !a.only || s.name === a.only);
if (!scenarios.length) { console.error('no scenarios in set ' + setName); process.exit(1); }
const outDir = resolve(ROOT, a.out || join('shots', setName));
mkdirSync(outDir, { recursive: true });

const server = await startServer(a.root ? resolve(ROOT, a.root) : ROOT, 0);
const browser = await chromium.launch({
  channel: 'chromium', headless: true,          // Playwright's own Chromium in new headless mode (real GPU)
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const problems = [];          // console errors, page errors, failed or external requests
const summary = [];

// Lays images out in a grid on a blank page and screenshots it (frame strips, squint views).
async function sheet(files, cols, cellW, outFile) {
  const page = await browser.newPage({ viewport: { width: cols * cellW, height: 100 } });
  const imgs = files.map((f) => `<img width="${cellW}" src="data:image/png;base64,${readFileSync(f).toString('base64')}">`).join('');
  await page.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:0">${imgs}</body>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: outFile, fullPage: true });
  await page.close();
}

for (const sc of scenarios) {
  const [vw, vh] = sc.viewport || [1280, 720];
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: sc.dpr || 1, hasTouch: !!sc.touch, isMobile: !!sc.touch });
  const page = await ctx.newPage();
  const tag = (m) => `[${sc.name}] ${m}`;
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(tag(m.type() + ': ' + m.text())); });
  page.on('pageerror', (e) => problems.push(tag('page error: ' + e.message)));
  page.on('requestfailed', (r) => problems.push(tag('request failed: ' + r.url())));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(server.url) && !u.startsWith('data:') && !u.startsWith('blob:')) problems.push(tag('EXTERNAL request: ' + u)); });

  const t0 = Date.now();
  await page.goto(`${server.url}/${sc.page || 'index.html'}?${sc.query || ''}${sc.realtime ? '' : '&manual=1'}${sc.realtime ? '&debug=1' : ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  const loadMs = Date.now() - t0;
  const row = { name: sc.name, loadMs };

  if (sc.realtime) {
    // Real-time sample: count animation frames and collect frame gaps for `realtime` seconds.
    const res = await page.evaluate((secs) => new Promise((done) => {
      const gaps = []; let last = performance.now(); const start = last;
      const loop = (now) => {
        gaps.push(now - last); last = now;
        if (now - start < secs * 1000) requestAnimationFrame(loop); else done({ gaps, info: window.__db.info() });
      };
      requestAnimationFrame(loop);
    }), sc.realtime);
    const g = res.gaps.slice(5).sort((x, y) => x - y);
    row.fps = 1000 / (g.reduce((s, v) => s + v, 0) / g.length);
    row.p95ms = g[Math.floor(g.length * 0.95)];
    row.maxMs = g[g.length - 1];
    Object.assign(row, { calls: res.info.calls, tris: res.info.tris, logicMs: res.info.logicMs, renderMs: res.info.renderMs });
    await page.screenshot({ path: join(outDir, sc.name + '.png') });
  } else {
    // Manual time: build one timeline of key events and captures, in game seconds since GO.
    const events = [];
    for (const [t, key, value] of sc.script || []) events.push({ t, key, value });
    for (const t of sc.shots || []) events.push({ t, shot: `${sc.name}_${String(t).replace('.', 'p')}.png` });
    const stripFiles = [];
    if (sc.strip) for (let i = 0; i < sc.strip.frames; i++) events.push({ t: sc.strip.from + i * sc.strip.dt, strip: i });
    events.sort((x, y) => x.t - y.t);
    for (const e of events) {
      const now = await page.evaluate(() => window.__db.game.sim.t);
      if (e.t > now + 1e-6) await page.evaluate((d) => window.__db.advance(d), e.t - now);
      if (e.key) await page.evaluate(([k, v]) => { const g = window.__db.game; if (k === 'dash') g.dash = true; else g.keys[k] = v; }, [e.key, e.value]);
      if (e.shot) await page.screenshot({ path: join(outDir, e.shot) });
      if (e.strip !== undefined) { const f = join(outDir, `_${sc.name}_f${e.strip}.png`); await page.screenshot({ path: f }); stripFiles.push(f); }
    }
    if (stripFiles.length) await sheet(stripFiles, sc.strip.cols || 4, sc.strip.cell || 480, join(outDir, sc.name + '_strip.png'));
    if (sc.squint && sc.shots && sc.shots.length) {
      const last = join(outDir, `${sc.name}_${String(sc.shots[sc.shots.length - 1]).replace('.', 'p')}.png`);
      await sheet([last], 1, 320, join(outDir, sc.name + '_squint.png'));
    }
    const info = await page.evaluate(() => {
      const d = window.__db, gl = d.gfx.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return Object.assign(d.info(), { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' });
    });
    Object.assign(row, { t: +info.t.toFixed(2), phase: info.phase, calls: info.calls, tris: info.tris, gpu: info.gpu.replace(/^ANGLE \((\w+), ([^(]+?) \(.*$/, '$2') });
    if (info.cam) row.cam = { cartX: info.cam.cartX.map((v) => +v.toFixed(2)), cartY: info.cam.cartY.map((v) => +v.toFixed(2)),
      roadSec: +info.cam.minRoadSeconds.toFixed(2), yawRev: +info.cam.yawReversalsPerSecond.toFixed(2), lift: +info.cam.maxLift.toFixed(2) };
  }
  summary.push(row);
  await ctx.close();
}

await browser.close();
await server.close();
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ set: setName, summary, problems }, null, 2));
for (const r of summary) console.log(JSON.stringify(r));
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'console clean, no failed or external requests');
console.log('written to ' + outDir);
