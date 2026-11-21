// DOORBUSTER — main.js
// Purpose: the entry module: boot, keyboard input, the frame loop and the glue between the
//          simulation (sim.js), the visuals (gfx.js, scene.js, fx.js) and the interface (ui.js).
// Exports: nothing.
// Depends on: every other module. Loads three.js (platform.loadThree) before anything touches THREE.
//
// URL parameters, all optional: level=N, seed=N, autoplay=beginner|confident|expert (a bot drives),
// load=N (start with N weight units), debug=1 (panel and window.__db), manual=1 (time advances only through window.__db.advance(seconds);
// the capture tool uses it for exact, repeatable frames).

import { TUNE, CFG } from './config.js';
import { LEVELS } from './levels.js';
import { createSim, advanceSim } from './sim.js';
import { BOTS, makeDriver } from './ai.js';
import { loadThree, platform } from './platform.js';
import { gfx, initGfx, resizeGfx, updateCamera, renderFrame } from './gfx.js';
import { buildScene, syncScene, sceneEvent, disposeScene } from './scene.js';
import { initFx, clearFx, cartFx, eventFx, updateFx } from './fx.js';
import { initDebug, updateDebug } from './ui.js';

const query = new URLSearchParams(location.search);
const game = {
  level: Math.max(0, Math.min(LEVELS.length - 1, Number(query.get('level') || 0))),
  seed: Number(query.get('seed') || 1),
  bot: query.get('autoplay') || '',
  debug: query.has('debug'), manual: query.has('manual'),
  sim: null, view: null, scale: 1, last: 0, logicMs: 0, hitstop: 0,
  keys: {}, dash: false, probe: null,
};

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas',
  ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'dash', ShiftRight: 'dash',
};

function startLevel() {
  if (game.view) disposeScene(game.view);
  clearFx();
  game.sim = createSim(LEVELS[game.level], game.seed, { bot: BOTS[game.bot] ? game.bot : undefined });
  if (query.get('load')) game.sim.player.load = Number(query.get('load'));     // test aid: start loaded
  game.view = buildScene(game.sim);
  game.hitstop = 0;
  gfx.cam.ready = false;
  gfx.cam.shake = 0;
}

function readInput() {
  const k = game.sim.player;
  if (k.ai) return;
  const keys = game.keys, inp = k.input;
  inp.steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  inp.gas = keys.gas ? 1 : 0;
  inp.brake = keys.brake ? 1 : 0;
  inp.drift = !!keys.drift;
  if (game.dash) { inp.dash = true; game.dash = false; }
}

// One frame: read input, step the simulation by dt of real time, update the visuals, draw.
function tick(dt, draw) {
  const sim = game.sim, t0 = performance.now(), p = sim.player;
  readInput();
  // Hit-stop: a few frozen frames on a big impact; the shake and the particles keep moving.
  let simDt = dt * game.scale;
  if (game.hitstop > 0) { game.hitstop -= dt; simDt = 0; }
  const alpha = simDt > 0 ? advanceSim(sim, simDt) : sim.acc / CFG.STEP;
  for (const e of sim.events) {
    const shake = eventFx(e);
    sceneEvent(game.view, e);
    if (e.cart === p) {
      gfx.cam.shake = Math.min(1, gfx.cam.shake + shake);
      if (e.type === 'crash') game.hitstop = 0.07;
    }
  }
  sim.events.length = 0;
  game.logicMs = performance.now() - t0;
  for (const k of sim.carts) cartFx(k, k.x, k.z, k.h, dt);
  updateFx(dt);
  updateCamera(p, alpha, dt, 0, sim.world);
  syncScene(game.view, sim, alpha, dt);
  if (game.probe) probeCamera(game.probe, p, dt);
  if (!draw) return;                           // capture mode skips only the GPU work between shots
  renderFrame();
  if (game.debug) {
    updateDebug({ sim, stats: gfx.stats, logicMs: game.logicMs, objects: game.view.root.children.length,
      level: game.level, scale: game.scale, bot: game.bot }, performance.now() - t0);
  }
}

// Camera telemetry for the capture tool (debug and manual modes only): where the cart sits on screen,
// how many seconds of floor are visible ahead of it, and how often the camera's yaw reverses.
function probeCamera(pr, k, dt) {
  const cam = gfx.camera, v = pr.v;
  cam.updateMatrixWorld();
  v.set(k.x, 0.8, k.z).project(cam);
  pr.minX = Math.min(pr.minX, v.x); pr.maxX = Math.max(pr.maxX, v.x);
  pr.minY = Math.min(pr.minY, v.y); pr.maxY = Math.max(pr.maxY, v.y);
  // the floor point seen at the top centre of the screen
  v.set(0, 0.92, 0.5).unproject(cam).sub(cam.position);
  if (v.y < -1e-3 && Math.abs(k.spd) > 6) {
    const s = -cam.position.y / v.y, gx = cam.position.x + v.x * s, gz = cam.position.z + v.z * s;
    const ahead = (gx - k.x) * Math.sin(gfx.cam.yaw) + (gz - k.z) * Math.cos(gfx.cam.yaw);
    pr.minRoad = Math.min(pr.minRoad, ahead / Math.abs(k.spd));
  }
  let d = gfx.cam.yaw - pr.lastYaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const rate = d / dt;
  if (Math.abs(rate) > 0.05) {
    if (pr.lastSign && Math.sign(rate) !== pr.lastSign) pr.reversals++;
    pr.lastSign = Math.sign(rate);
  }
  pr.lastYaw = gfx.cam.yaw; pr.time += dt;
  pr.lift = Math.max(pr.lift, gfx.cam.lift);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - game.last) / 1000);
  game.last = now;
  if (!game.manual) tick(dt, true);
}

async function boot() {
  await loadThree();
  await platform.init();
  initGfx(document.getElementById('game'));
  initFx();
  startLevel();
  platform.onTune(resizeGfx);
  addEventListener('resize', resizeGfx);
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    if (k) {
      if (k === 'dash' && !game.keys.dash) game.dash = true;
      game.keys[k] = true;
      e.preventDefault();
    } else if (e.code === 'KeyR') startLevel();
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) game.keys[k] = false; });
  addEventListener('blur', () => { game.keys = {}; });
  if (game.debug) {
    initDebug(document.getElementById('ui'), {
      tuneRaw: platform.tuneRaw,
      restart: startLevel,
      level: (d) => { game.level = (game.level + d + LEVELS.length) % LEVELS.length; startLevel(); },
      slow: () => { game.scale = game.scale === 1 ? 0.5 : game.scale === 0.5 ? 0.25 : 1; },
      fill: () => { game.sim.player.load += 10; },
      bot: () => {
        const order = ['', 'beginner', 'confident', 'expert'];
        game.bot = order[(order.indexOf(game.bot) + 1) % order.length];
        game.sim.player.ai = game.bot ? makeDriver(BOTS[game.bot]) : null;
      },
    });
  }
  if (game.debug || game.manual) {
    game.probe = { v: new THREE.Vector3(), minX: 9, maxX: -9, minY: 9, maxY: -9, minRoad: 99, reversals: 0, lastSign: 0, lastYaw: 0, time: 0, lift: 0 };
    window.__db = {
      game, gfx, TUNE,
      // Advances `seconds` of game time in 60 Hz frames and draws the last one.
      advance(seconds) {
        const n = Math.max(1, Math.round(seconds * 60));
        for (let i = 0; i < n; i++) tick(1 / 60, i === n - 1);
        return game.sim.t;
      },
      info() {
        const p = game.sim.player, pr = game.probe;
        return { t: game.sim.t, phase: game.sim.phase, calls: gfx.stats.calls, tris: gfx.stats.tris, renderMs: gfx.stats.ms,
          logicMs: game.logicMs, x: p.x, z: p.z, h: p.h, spd: p.spd, step: CFG.STEP,
          cam: { cartX: [pr.minX, pr.maxX], cartY: [pr.minY, pr.maxY], minRoadSeconds: pr.minRoad,
            yawReversalsPerSecond: pr.reversals / Math.max(pr.time, 1e-6), maxLift: pr.lift } };
      },
    };
  }
  tick(1 / 60, true);
  game.last = performance.now();
  requestAnimationFrame(frame);
  window.__ready = true;
}

boot().catch((err) => { console.error(err); });
