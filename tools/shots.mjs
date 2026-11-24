// DOORBUSTER tool — shots.mjs
// Opens the game in Playwright's Chromium (headless, GPU-accelerated) and captures: screenshots at
// exact game times, frame strips (contact sheets of consecutive frames), console errors, failed and
// external requests, render statistics and a real-time frame-rate sample.
// Run: node tools/shots.mjs --set m0 [--out shots/m0] [--only name,name]
// Scenario sets live in tools/shotsets.mjs.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { startServer } from './serve.mjs';
import { ROOT, args, room } from './lib.mjs';
import { SETS } from './shotsets.mjs';

const a = args();
const setName = a.set || 'm0';
const scenarios = (SETS[setName] || []).filter((s) => !a.only || String(a.only).split(',').includes(s.name));
if (!scenarios.length) { console.error('no scenarios in set ' + setName); process.exit(1); }
const outDir = resolve(ROOT, a.out || join('shots', setName));
mkdirSync(outDir, { recursive: true });

const server = await startServer(a.root ? resolve(ROOT, a.root) : ROOT, 0);
const browser = await chromium.launch({
  channel: 'chromium', headless: true,          // Playwright's own Chromium in new headless mode (real GPU)
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio',
    '--host-resolver-rules=MAP *.mindblown.ai 127.0.0.1'],   // lets a scenario serve the page under a platform host name
});
const problems = [];          // console errors, page errors, failed or external requests
const summary = [];

// Share of a frame's pixels that are the player's pink (#FF4FA3 lit or shaded), and the share of all
// strongly coloured pixels that are pink: does the hero own the frame? (ART.md 9, squint test.)
async function pinkShare(file) {
  const page = await browser.newPage();
  const res = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let pink = 0, vivid = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gr = d[i + 1], b = d[i + 2], mx = Math.max(r, gr, b), mn = Math.min(r, gr, b);
      if (mx - mn > 90) vivid++;
      if (r > 140 && r - gr > 80 && b > gr + 25 && r >= b) pink++;
    }
    return { pink: pink / (d.length / 4), ofVivid: pink / Math.max(1, vivid) };
  }, 'data:image/png;base64,' + readFileSync(file).toString('base64'));
  await page.close();
  return { pinkPct: +(res.pink * 100).toFixed(2), ofVividPct: +(res.ofVivid * 100).toFixed(1) };
}

// The empty test room of a scenario, with its extra plan characters (sc.put = [[char, tiles ahead of the start, tiles to its right], ...]).
const testRoom = (sc) => room(sc.room[0], sc.room[1], (grid, mid) => { for (const [ch, dc, dr] of sc.put || []) grid[mid + dr][2 + dc] = ch; });

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
  if (sc.video) {
    // A real-time recording (WebM) of `video` seconds of the page as a player would see it.
    const vctx = await browser.newContext({ viewport: { width: vw, height: vh }, recordVideo: { dir: outDir, size: { width: vw, height: vh } } });
    const vp = await vctx.newPage();
    vp.on('pageerror', (e) => problems.push(`[${sc.name}] page error: ` + e.message));
    await vp.goto(`${server.url}/index.html?${sc.query || ''}`);
    await vp.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
    await vp.waitForTimeout(sc.video * 1000);
    const file = await vp.video().path();
    await vctx.close();
    renameSync(file, join(outDir, sc.name + '.webm'));
    summary.push({ name: sc.name, video: sc.name + '.webm', seconds: sc.video });
    continue;
  }
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: sc.dpr || 1, hasTouch: !!sc.touch, isMobile: !!sc.touch });
  const page = await ctx.newPage();
  const tag = (m) => `[${sc.name}] ${m}`;
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(tag(m.type() + ': ' + m.text())); });
  page.on('pageerror', (e) => problems.push(tag('page error: ' + e.message)));
  page.on('requestfailed', (r) => problems.push(tag('request failed: ' + r.url())));
  // A platform scenario serves the page as play.mindblown.ai, answers the hosted three.js URL from
  // the local copy and installs a recording stand-in for window.mindblown (see sdk.md).
  const HOSTED = 'https://mindblown.ai/lib/three-0.185.1/three.min.js';
  const base = sc.platform ? server.url.replace('127.0.0.1', 'play.mindblown.ai') : server.url;
  let hosted = 0;
  if (sc.platform) {
    await ctx.route(HOSTED, (r) => { hosted++; r.fulfill({ path: resolve(ROOT, 'lib', 'three.min.js'), contentType: 'text/javascript' }); });
    await page.addInitScript(() => {
      const log = [];
      window.mindblown = {
        __log: log,
        viewer: { id: 'u_test', username: 'Tester', signedIn: true, onchange(fn) { fn(); return () => {}; } },
        run: { start() { log.push('run.start'); }, end(p) { log.push('run.end ' + JSON.stringify(p)); }, pause() { log.push('run.pause'); }, resume() { log.push('run.resume'); } },
        tune: Object.assign(async () => { log.push('tune'); return { maxspeed: 12.5 }; }, { on() { log.push('tune.on'); return () => {}; } }),
        load: async (key) => { log.push('load ' + key); return { value: null, revision: null }; },
        save: async (key) => { log.push('save ' + key); return { revision: 1 }; },
        leaderboard: { submit: async (m, v) => { log.push('submit ' + m + ' ' + v); }, top: async () => [], mine: async () => null },
        sound: { on: true, set(v) { this.on = v; log.push('sound.set ' + v); return v; }, onchange() { return () => {}; } },
      };
    });
  }
  if (sc.storage) await page.addInitScript((kv) => { for (const k in kv) localStorage.setItem(k, kv[k]); }, sc.storage);   // saved progress for the run
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && !(sc.platform && u === HOSTED)) problems.push(tag('EXTERNAL request: ' + u)); });

  const t0 = Date.now();
  await page.goto(`${base}/${sc.page || 'index.html'}?${sc.query || ''}${sc.plain ? '' : sc.realtime ? '&debug=1' : '&manual=1'}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  const loadMs = Date.now() - t0;
  const row = { name: sc.name, loadMs };
  if (sc.room) await page.evaluate((def) => window.__db.custom(def), testRoom(sc));
  if (sc.setup) await page.evaluate(sc.setup);                    // a page script that prepares the run (a shorter timer, say)

  if (sc.plain) {
    // A plain page as a person gets it (no bot, no manual clock): wait, then screenshot.
    await page.waitForTimeout(sc.plain * 1000);
    if (sc.tap) { await page.touchscreen.tap(sc.tap[0], sc.tap[1]); await page.waitForTimeout(3600); }      // a finger starts the run: touch controls appear
    if (sc.click) { await page.mouse.click(sc.click[0], sc.click[1]); await page.waitForTimeout((sc.wait || 5) * 1000); }   // a real click (unlocks sound)
    if (sc.after) row.after = await page.evaluate(sc.after);
    await page.screenshot({ path: join(outDir, sc.name + '.png') });
  } else if (sc.realtime) {
    // Real-time sample: count animation frames and collect frame gaps for `realtime` seconds.
    // Wait for GO, then sample the frame gaps of real play.
    await page.waitForFunction(() => window.__db.game.sim.t > 0.2, null, { timeout: 15000 });
    const res = await page.evaluate((secs) => new Promise((done) => {
      const gaps = []; let last = performance.now(); const start = last, g = window.__db.game;
      g.logicSum = 0; g.logicN = 0;
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
    row.frames = g.length;
    Object.assign(row, { calls: res.info.calls, tris: res.info.tris, logicMs: res.info.logicMs, renderMs: res.info.renderMs });
    await page.screenshot({ path: join(outDir, sc.name + '.png') });
  } else {
    // A strip centred on an event (strip.around = 'crash'): play the scenario once to find when the
    // event happens, then load it again and capture around that moment. Runs are deterministic.
    if (sc.strip && sc.strip.around) {
      const keys = [...(sc.script || [])].sort((x, y) => x[0] - y[0]);
      for (const [t, k, v] of keys) {
        const now = await page.evaluate(() => window.__db.game.sim.t);
        if (t > now + 1e-6) await page.evaluate((d) => window.__db.advance(d), t - now);
        await page.evaluate(([kk, vv]) => { window.__db.key(kk, vv); if (kk === 'dash') window.__db.key(kk, false); }, [k, v]);
      }
      await page.evaluate((d) => window.__db.advance(d), sc.strip.within || 6);
      const log = await page.evaluate(() => window.__db.info().log);
      const hit = log.find((e) => e[0] === sc.strip.around);
      if (!hit) problems.push(tag('event "' + sc.strip.around + '" never happened'));
      sc.strip.from = (hit ? hit[1] : 1) - (sc.strip.before || 0.2);
      row.eventAt = hit ? hit[1] : null;
      await page.reload();
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
      if (sc.room) await page.evaluate((def) => window.__db.custom(def), testRoom(sc));
      if (sc.setup) await page.evaluate(sc.setup);
    }
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
      if (e.key) await page.evaluate(([k, v]) => { window.__db.key(k, v); if (k === 'dash') window.__db.key(k, false); }, [e.key, e.value]);
      if (e.shot) await page.screenshot({ path: join(outDir, e.shot) });
      if (e.strip !== undefined) { const f = join(outDir, `_${sc.name}_f${e.strip}.png`); await page.screenshot({ path: f }); stripFiles.push(f); }
    }
    if (sc.until) {
      // Run on until the game reaches a state (e.g. 'receipt'), then give the interface real time to animate.
      for (let i = 0; i < 400; i++) {
        if (await page.evaluate((s) => window.__db.game.state === s, sc.until)) break;
        await page.evaluate(() => window.__db.advance(0.5));
      }
      await page.evaluate((s) => window.__db.advance(s), (sc.wait || 6500) / 1000);   // the interface runs on game time in manual mode
      await page.screenshot({ path: join(outDir, sc.name + '_' + sc.until + '.png') });
    }
    if (stripFiles.length) await sheet(stripFiles, sc.strip.cols || 4, sc.strip.cell || 480, join(outDir, sc.name + '_strip.png'));
    if (sc.squint && sc.shots && sc.shots.length) {
      const last = join(outDir, `${sc.name}_${String(sc.shots[sc.shots.length - 1]).replace('.', 'p')}.png`);
      await sheet([last], 1, 320, join(outDir, sc.name + '_squint.png'));
      row.pink = await pinkShare(last);
    }
    const info = await page.evaluate(() => {
      const d = window.__db, gl = d.gfx.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return Object.assign(d.info(), { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' });
    });
    if (sc.after) row.after = await page.evaluate(sc.after);       // an extra measurement run in the page
    if (sc.after && sc.last) await page.screenshot({ path: join(outDir, sc.name + '_after.png') });
    if (sc.platform) row.platform = await page.evaluate(() => ({ hostedThree: null, calls: window.mindblown.__log, tuneMaxspeed: window.__db.TUNE.maxspeed, revision: window.THREE.REVISION }));
    if (sc.platform) row.platform.hostedThree = hosted;
    if (sc.full) Object.assign(row, { doneT: info.doneT, receipt: info.receipt, log: info.log.filter((e) => ['ram', 'madmode', 'flash', 'finish'].includes(e[0])) });   // the numbers a port is checked against
    Object.assign(row, { t: +info.t.toFixed(2), phase: info.phase, items: info.items, value: info.value, calls: info.calls, tris: info.tris, gpu: info.gpu.replace(/^ANGLE \((\w+), ([^(]+?) \(.*$/, '$2') });
    if (info.cam) row.cam = { cartX: info.cam.cartX.map((v) => +v.toFixed(2)), cartY: info.cam.cartY.map((v) => +v.toFixed(2)),
      floorAheadSec: +info.cam.minRoadSeconds.toFixed(2), yawRev: +info.cam.yawReversalsPerSecond.toFixed(2), lift: +info.cam.maxLift.toFixed(2) };
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
