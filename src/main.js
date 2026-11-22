// DOORBUSTER — main.js
// Purpose: the entry module: boot, keyboard input, the frame loop, the game states (title, play,
//          receipt, closed) and the glue between the simulation (sim.js), the visuals (gfx.js,
//          scene.js, fx.js) and the interface (ui.js).
// Exports: nothing.
// Depends on: every other module. Loads three.js (platform.loadThree) before anything touches THREE.
//
// URL parameters, all optional: level=N, seed=N, autoplay=beginner|confident|expert (a bot drives),
// fill=N (start with N goods in the cart), debug=1 (panel and window.__db), manual=1 (time advances only
// through window.__db.advance(seconds); the capture tool uses it for exact, repeatable frames).

import { TUNE, CFG } from './config.js';
import { LEVELS } from './levels.js';
import { createSim, advanceSim, giveGoods } from './sim.js';
import { BOTS, makeDriver } from './ai.js';
import { loadThree, platform } from './platform.js';
import { gfx, initGfx, resizeGfx, updateCamera, renderFrame } from './gfx.js';
import { buildScene, syncScene, sceneEvent, disposeScene } from './scene.js';
import { initFx, clearFx, cartFx, eventFx, updateFx } from './fx.js';
import { initUI, updateHud, popWord, floatText, chainText, showTitle, showReceipt, showClosed, hideScreens, money, initDebug, updateDebug } from './ui.js';

const query = new URLSearchParams(location.search);
const game = {
  level: Math.max(0, Math.min(LEVELS.length - 1, Number(query.get('level') || 1))),
  seed: Number(query.get('seed') || 1),
  bot: query.get('autoplay') || '',
  debug: query.has('debug'), manual: query.has('manual'),
  state: 'title',                 // title -> play -> receipt | closed
  sim: null, view: null, scale: 1, last: 0, logicMs: 0, logicSum: 0, logicN: 0, hitstop: 0, custom: null,
  keys: {}, inq: [], now: 0,     // keys as the simulation has seen them; key events waiting for their step
  probe: null, gain: 0, gainT: 0, gainList: false, v: null,
};

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas',
  ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'dash', ShiftRight: 'dash',
};
const WORDS = { cleansweep: 'CLEAN SWEEP', strike: 'STRIKE', ram: 'RAM', takedown: 'TAKEDOWN', shave: 'CLOSE SHAVE', jump: 'BIG AIR' };

// Builds the level. quick = a restart: shorter countdown, straight into play.
function startLevel(quick) {
  if (game.view) disposeScene(game.view);
  clearFx();
  game.sim = createSim(game.custom || LEVELS[game.level], game.seed, { bot: BOTS[game.bot] ? game.bot : undefined, countdown: quick ? 1.2 : CFG.countdown });
  if (query.get('fill')) giveGoods(game.sim, game.sim.player, Number(query.get('fill')));   // test aid: start with goods
  game.view = buildScene(game.sim);
  game.hitstop = 0; game.gain = 0; game.keys = {}; game.inq.length = 0;
  gfx.cam.ready = false;
  gfx.cam.shake = 0;
}
function play(quick) {
  startLevel(quick);
  hideScreens();
  game.state = 'play';
  platform.runStart();
}

// Key events are queued with their time stamps and applied on the simulation step they belong to,
// so the cart reacts the same at 30, 60 or 144 frames per second. age = seconds before now.
function feedInput(age) {
  const k = game.sim.player, keys = game.keys, inp = k.input;
  while (game.inq.length && (game.now - game.inq[0].t) / 1000 >= age) {
    const e = game.inq.shift();
    if (e.name === 'dash' && e.down && !keys.dash) inp.dash = true;
    keys[e.name] = e.down;
  }
  if (k.ai) return;
  inp.steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  inp.gas = keys.gas ? 1 : 0;
  inp.brake = keys.brake ? 1 : 0;
  inp.drift = !!keys.drift;
}

// World position -> CSS pixels on screen.
function toScreen(x, y, z) {
  const v = game.v.set(x, y, z).project(gfx.camera);
  v.x = (v.x + 1) / 2 * gfx.w; v.y = (1 - v.y) / 2 * gfx.h;
  return v;
}

// Presentation of one simulation event: particles, scene reactions, interface, platform calls.
function onEvent(e) {
  const sim = game.sim, p = sim.player, mine = e.cart === p;
  const shake = eventFx(e);
  sceneEvent(game.view, e);
  if (!mine) return;
  gfx.cam.shake = Math.min(1, gfx.cam.shake + shake);
  switch (e.type) {
    case 'crash': game.hitstop = 0.07; break;
    case 'take': game.gain += e.value; game.gainT = 0.45; if (e.ref.entry.list) game.gainList = true; break;
    case 'heavy': popWord('HEAVY', 'bad'); break;
    case 'overloaded': popWord('OVERLOADED', 'bad'); break;
    case 'stunt': {
      popWord(WORDS[e.ref.name] || e.ref.name.toUpperCase(), 'good');
      const s = toScreen(p.x, 2.2, p.z);
      floatText('+' + money(e.value), s.x, s.y - 40, 'big');
      break;
    }
    case 'finish':
      game.state = 'receipt';
      platform.runEnd(sim.t, game.level);
      showReceipt(p.receipt, () => play(true));
      break;
    case 'timeup':
      game.state = 'closed';
      platform.runEnd(sim.t, game.level);
      showClosed(() => play(true));
      break;
    default:
  }
}

// One frame: read input, step the simulation by dt of real time, update the visuals, draw.
function tick(dt, draw) {
  const sim = game.sim, t0 = performance.now(), p = sim.player;
  game.now = t0;
  // Hit-stop: a few frozen frames on a big impact; the shake and the particles keep moving.
  let simDt = game.state === 'play' ? dt * game.scale : game.state === 'receipt' ? dt * 0.25 : 0;
  if (game.hitstop > 0) { game.hitstop -= dt; simDt = 0; }
  const alpha = simDt > 0 ? advanceSim(sim, simDt, feedInput) : sim.acc / CFG.STEP;
  for (const e of sim.events) onEvent(e);
  sim.events.length = 0;
  game.logicMs = performance.now() - t0;
  game.logicSum += game.logicMs; game.logicN++;
  for (const k of sim.carts) cartFx(k, k.x, k.z, k.h, dt);
  updateFx(dt);
  updateCamera(p, alpha, dt, game.view.towerH, sim.world);
  syncScene(game.view, sim, alpha, dt);
  // Money being swept right now is one running label above the cart; when the run of goods ends it
  // floats away.
  if (game.gain > 0) {
    const s = toScreen(p.x, 2.4 + game.view.towerH * 0.5, p.z), kind = game.gainList ? 'list' : '';
    game.gainT -= dt;
    if (game.gainT > 0) chainText('+' + money(game.gain), s.x, s.y, kind);
    else { chainText('', s.x, s.y); floatText('+' + money(game.gain), s.x, s.y, kind || 'big'); game.gain = 0; game.gainList = false; }
  }
  updateHud(sim, dt);
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
  initUI(document.getElementById('ui'));
  game.v = new THREE.Vector3();
  platform.onTune(resizeGfx);
  addEventListener('resize', resizeGfx);
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    if (game.state !== 'play') {
      // Any driving key starts from the title; R or Enter retries after a run.
      if (game.state === 'title' ? (k || e.code === 'Enter') : (e.code === 'KeyR' || e.code === 'Enter')) { play(game.state !== 'title'); e.preventDefault(); }
      return;
    }
    if (k) {
      if (!e.repeat) game.inq.push({ name: k, down: true, t: e.timeStamp });
      e.preventDefault();
    } else if (e.code === 'KeyR') play(true);
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) game.inq.push({ name: k, down: false, t: e.timeStamp }); });
  addEventListener('blur', () => { game.keys = {}; game.inq.length = 0; });
  if (game.debug) {
    initDebug(document.getElementById('ui'), {
      tuneRaw: platform.tuneRaw, changed: resizeGfx,
      restart: () => play(true),
      level: (d) => { game.level = (game.level + d + LEVELS.length) % LEVELS.length; play(true); },
      slow: () => { game.scale = game.scale === 1 ? 0.5 : game.scale === 0.5 ? 0.25 : 1; },
      fill: () => { giveGoods(game.sim, game.sim.player, 8); },
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
      game, gfx, TUNE, play,
      key(name, down) { game.inq.push({ name, down, t: -1e9 }); },     // a scripted key press, applied on the next step
      custom(def) { game.custom = def; play(false); },                 // a test level built by a tool
      // Advances `seconds` of game time in 60 Hz frames and draws the last one.
      advance(seconds) {
        const n = Math.max(1, Math.round(seconds * 60));
        for (let i = 0; i < n; i++) tick(1 / 60, i === n - 1);
        return game.sim.t;
      },
      info() {
        const p = game.sim.player, pr = game.probe;
        return { t: game.sim.t, phase: game.sim.phase, state: game.state, calls: gfx.stats.calls, tris: gfx.stats.tris, renderMs: gfx.stats.ms,
          logicMs: game.logicSum / Math.max(1, game.logicN), x: p.x, z: p.z, h: p.h, spd: p.spd, load: p.load, items: p.tower.length, value: p.value, step: CFG.STEP,
          cam: { cartX: [pr.minX, pr.maxX], cartY: [pr.minY, pr.maxY], minRoadSeconds: pr.minRoad,
            yawReversalsPerSecond: pr.reversals / Math.max(pr.time, 1e-6), maxLift: pr.lift } };
      },
    };
  }
  // A bot or the capture tool goes straight into the run; a person gets the title and one click.
  if (game.bot || game.manual || query.has('go')) play(false);
  else { startLevel(false); showTitle(LEVELS[game.level].name, () => play(false)); }
  tick(1 / 60, true);
  game.last = performance.now();
  requestAnimationFrame(frame);
  window.__ready = true;
}

boot().catch((err) => { console.error(err); });
