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

import { TUNE, CFG, GOOD } from './config.js';
import { LEVELS } from './levels.js';
import { createSim, advanceSim, giveGoods, settle } from './sim.js';
import { BOTS, makeDriver } from './ai.js';
import { loadThree, platform } from './platform.js';
import { gfx, initGfx, resizeGfx, updateCamera, renderFrame } from './gfx.js';
import { buildScene, syncScene, sceneEvent, disposeScene, goodIcon } from './scene.js';
import { initFx, clearFx, cartFx, eventFx, updateFx } from './fx.js';
import { initUI, updateHud, popWord, announce, floatText, chainText, setList, setArrow, setWarn, showTitle, showReceipt, showClosed,
  hideScreens, hurryUI, money, initDebug, updateDebug } from './ui.js';

const query = new URLSearchParams(location.search);
const game = {
  level: Math.max(0, Math.min(LEVELS.length - 1, Number(query.get('level') || 1))),
  seed: Number(query.get('seed') || 1),
  bot: query.get('autoplay') || '',
  debug: query.has('debug'), manual: query.has('manual'),
  state: 'title',                 // title -> play -> receipt | closed
  sim: null, view: null, scale: 1, last: 0, logicMs: 0, logicSum: 0, logicN: 0, hitstop: 0, slowT: 0, custom: null,
  keys: {}, inq: [], now: 0,     // keys as the simulation has seen them; key events waiting for their step
  probe: null, gain: 0, gainT: 0, gainList: false, v: null,
  icons: {},                      // pictures of goods for the list, by id
  mark: null, markT: 0, markText: '',   // where the arrow points (a piece or a lane), for how long, its word
  warner: null, rammed: false, frozen: false, clock: 0,
};

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas',
  ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'dash', ShiftRight: 'dash',
};
const WORDS = { cleansweep: 'CLEAN SWEEP', strike: 'STRIKE!', ram: 'RAM!', takedown: 'TAKEDOWN!', shave: 'CLOSE SHAVE', smash: 'SMASH!', jump: 'BIG AIR' };

// Builds the level. quick = a restart: shorter countdown, straight into play.
function startLevel(quick) {
  if (game.view) disposeScene(game.view);
  clearFx();
  const def = game.custom || LEVELS[game.level];
  game.sim = createSim(def, game.seed, { bot: BOTS[game.bot] ? game.bot : undefined, countdown: quick ? 1.2 : CFG.countdown });
  if (query.get('fill')) giveGoods(game.sim, game.sim.player, Number(query.get('fill')));   // test aid: start with goods
  game.view = buildScene(game.sim);
  setList((def.list || []).map((id) => game.icons[id] || (game.icons[id] = goodIcon(GOOD[id]))));
  game.hitstop = 0; game.slowT = 0; game.gain = 0; game.keys = {}; game.inq.length = 0;
  game.mark = null; game.markT = 0; game.warner = null; game.frozen = false;
  gfx.u.uTintAmt.value = 0;
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

// World position -> CSS pixels on screen (z > 1 means behind the camera).
function toScreen(x, y, z) {
  const v = game.v.set(x, y, z).project(gfx.camera);
  v.x = (v.x + 1) / 2 * gfx.w; v.y = (1 - v.y) / 2 * gfx.h;
  return v;
}

// The player has checked out: the receipt, and (when its table is due) the rest of the race played out.
function finish() {
  const sim = game.sim, p = sim.player, def = sim.def, best = platform.progress.best || (platform.progress.best = {});
  const prev = best[def.id] || 0, isNew = p.receipt.total > prev;
  if (isNew) { best[def.id] = p.receipt.total; platform.save(); }
  platform.submit('receipt_l' + game.level, p.receipt.total, def.name);
  platform.runEnd(sim.t, game.level);
  game.state = 'receipt';
  showReceipt(p.receipt, () => {
    game.frozen = true;
    return settle(sim).map((k) => ({ name: k.player ? 'YOU' : k.def.name, total: k.receipt ? k.receipt.total : -1, me: k.player }));
  }, { value: Math.max(prev, p.receipt.total), isNew: isNew && prev > 0 }, (def.zones[0] || {}).name || def.name, () => play(true));
}

// Presentation of one simulation event: particles, scene reactions, interface, platform calls.
function onEvent(e) {
  const sim = game.sim, p = sim.player, mine = e.cart === p, k = e.cart;
  if (game.probe && (mine || e.ref === p)) game.probe.log.push([e.type + (mine ? '' : '<'), +sim.t.toFixed(3)]);     // for the capture tool
  const shake = eventFx(e);
  sceneEvent(game.view, e);
  // What others do to the player, or near the player.
  if (!mine) {
    if (e.type === 'warn' && e.ref === p) game.warner = k;
    else if (e.type === 'ram' && e.ref === p) { game.hitstop = 0.06; gfx.cam.shake = Math.min(1, gfx.cam.shake + 0.6); popWord('RAMMED!', 'bad'); }
    else if (e.type === 'shout') { game.mark = e.ref; game.markT = 5; game.markText = 'HOT!'; const s = toScreen(k.x, 2.6, k.z); if (s.z < 1) floatText('MINE!', s.x, s.y, 'big'); }
    else if (e.type === 'finish') { const s = toScreen(k.x, 2.6, k.z); if (s.z < 1) floatText(money(e.value), s.x, s.y, ''); }
    else if (e.type === 'gone' || !k) return;
    if (e.type !== 'flash' && e.type !== 'flashend' && e.type !== 'closing') return;
  }
  gfx.cam.shake = Math.min(1, gfx.cam.shake + shake);
  switch (e.type) {
    case 'crash': game.hitstop = 0.07; break;
    case 'take': game.gain += e.value; game.gainT = 0.45; if (e.ref.entry.list) game.gainList = true; break;
    case 'spill': case 'shed': { const s = toScreen(p.x, 2.6, p.z); floatText(money(-e.ref.lost), s.x, s.y - 30, 'loss'); break; }
    case 'heavy': popWord('HEAVY', 'bad'); break;
    case 'overloaded': popWord('OVERLOADED', 'bad'); break;
    case 'full': announce('CART FULL!', 'Only pricier goods fit now. They push the cheap ones out.'); break;
    case 'rocket': popWord('ROCKET START!', 'good'); break;
    case 'bonk': popWord('TOO LIGHT!', 'bad'); break;
    case 'hot': popWord('HOT ITEM!', 'hot'); game.hitstop = 0.05; if (game.mark === e.ref) game.markT = 0; break;
    case 'smash': case 'glass': game.hitstop = 0.04; break;
    case 'ram':
      game.hitstop = 0.08;
      if (!game.rammed) { game.rammed = true; game.slowT = 0.5; }      // the first ram is shown in slow motion
      break;
    case 'madmode': if (e.value) { popWord('MADNESS!', 'hot'); game.hitstop = 0.1; } break;
    case 'flash':
      announce('FLASH SALE!', 'A hot item for ten seconds. Elbows are legal.');
      game.mark = e.ref; game.markT = 10; game.markText = 'SALE';
      break;
    case 'flashend': if (game.mark === e.ref) game.markT = 0; break;
    case 'closing': announce('CLOSING TIME!', 'The checkouts are shutting one by one. So is your window.'); break;
    case 'stunt': {
      popWord(WORDS[e.ref.name] || e.ref.name.toUpperCase(), 'good');
      const s = toScreen(p.x, 2.2, p.z);
      floatText('+' + money(e.value), s.x, s.y - gfx.h * 0.11, 'big');
      break;
    }
    case 'finish': game.state = 'finish'; break;       // handled after the event loop (it plays the race out)
    case 'timeup':
      game.state = 'closed';
      platform.runEnd(sim.t, game.level);
      showClosed(() => play(true));
      break;
    default:
  }
}

// The arrow to the current event (the flash sale, a hot item someone shouted about, the checkouts at
// closing time) and the "!" over a rival about to ram.
function pointers(dt) {
  const sim = game.sim, p = sim.player;
  let m = game.markT > 0 ? game.mark : null, text = game.markText;
  game.markT -= dt;
  if (!m && sim.closing && game.state === 'play') {       // closing time: the nearest open checkout
    let best = 1e9;
    for (const l of sim.world.lanes) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (l.open && d < best) { best = d; m = l; } }
    text = 'CHECKOUT';
  }
  if (m && game.state === 'play') {
    const s = toScreen(m.x, 3.4, m.z), pad = gfx.h * 0.14;
    if (s.z < 1 && s.x > pad && s.x < gfx.w - pad && s.y > pad * 1.6 && s.y < gfx.h - pad) setArrow(true, s.x, s.y - gfx.h * 0.05, Math.PI, text);
    else {                                                // off screen: on a circle round the middle, pointing the way
      const rel = Math.atan2(m.x - p.x, m.z - p.z) - gfx.cam.yaw, r = Math.min(gfx.w, gfx.h) * 0.36;
      setArrow(true, gfx.w / 2 - Math.sin(rel) * r, gfx.h * 0.52 - Math.cos(rel) * r, -rel, text);
    }
  } else setArrow(false);
  const w = game.warner;
  if (w && w.ai && (w.ai.warnT > 0 || w.ai.strikeT > 0) && game.state === 'play') { const s = toScreen(w.x, 2.8, w.z); setWarn(s.z < 1, s.x, s.y); }
  else { setWarn(false); game.warner = null; }
}

// One frame: read input, step the simulation by dt of real time, update the visuals, draw.
function tick(dt, draw) {
  const sim = game.sim, t0 = performance.now(), p = sim.player;
  game.now = t0;
  game.clock += dt;
  // Hit-stop: a few frozen frames on a big impact; the shake and the particles keep moving.
  let simDt = game.state === 'play' ? dt * game.scale : game.state === 'receipt' && !game.frozen ? dt * 0.25 : 0;
  if (game.slowT > 0) { game.slowT -= dt; simDt *= 0.3; }
  if (game.hitstop > 0) { game.hitstop -= dt; simDt = 0; }
  const alpha = simDt > 0 ? advanceSim(sim, simDt, feedInput) : sim.acc / CFG.STEP;
  for (const e of sim.events) onEvent(e);
  sim.events.length = 0;
  if (game.state === 'finish') finish();
  game.logicMs = performance.now() - t0;
  game.logicSum += game.logicMs; game.logicN++;
  for (const k of sim.carts) if (!k.done || k.player) cartFx(k, k.x, k.z, k.h, dt);
  updateFx(dt);
  updateCamera(p, alpha, dt, game.view.towerH, sim.world, game.state === 'title' ? 0.7 + 0.35 * Math.sin(game.clock * 0.4) : undefined);
  // Closing time washes the store in red, pulsing.
  const tint = gfx.u.uTintAmt;
  tint.value += ((sim.closing && game.state === 'play' ? 0.24 + 0.08 * Math.sin(game.clock * 6) : 0) - tint.value) * Math.min(1, dt * 4);
  syncScene(game.view, sim, alpha, dt);
  // Money being swept right now is one running label above the cart; when the run of goods ends it
  // floats away.
  if (game.gain > 0) {
    const s = toScreen(p.x, 2.4 + game.view.towerH * 0.5, p.z), kind = game.gainList ? 'list' : '';
    game.gainT -= dt;
    if (game.gainT > 0) chainText('+' + money(game.gain), s.x, s.y, kind);
    else { chainText('', s.x, s.y); floatText('+' + money(game.gain), s.x, s.y, kind || 'big'); game.gain = 0; game.gainList = false; }
  }
  pointers(dt);
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
  addEventListener('pointerdown', hurryUI);
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    hurryUI();
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
    game.probe = { v: new THREE.Vector3(), minX: 9, maxX: -9, minY: 9, maxY: -9, minRoad: 99, reversals: 0, lastSign: 0, lastYaw: 0, time: 0, lift: 0, log: [] };
    const born = new WeakMap();
    window.__db = {
      game, gfx, TUNE, play,
      key(name, down) { game.inq.push({ name, down, t: -1e9 }); },     // a scripted key press, applied on the next step
      custom(def) { game.custom = def; play(false); },                 // a test level built by a tool
      // Advances `seconds` of game time in 60 Hz frames and draws the last one. The interface's CSS
      // animations are put on the same clock, so a captured frame shows what a player would see.
      advance(seconds) {
        const n = Math.max(1, Math.round(seconds * 60));
        for (let i = 0; i < n; i++) {
          tick(1 / 60, i === n - 1);
          for (const a of document.getAnimations()) {
            if (!born.has(a)) born.set(a, game.clock - 1 / 60);
            a.pause();
            a.currentTime = (game.clock - born.get(a)) * 1000;
          }
        }
        return game.sim.t;
      },
      info() {
        const p = game.sim.player, pr = game.probe, st = game.sim.stats;
        return { t: game.sim.t, phase: game.sim.phase, state: game.state, calls: gfx.stats.calls, tris: gfx.stats.tris, renderMs: gfx.stats.ms,
          logicMs: game.logicSum / Math.max(1, game.logicN), x: p.x, z: p.z, h: p.h, spd: p.spd, load: p.load, items: p.tower.length, value: p.value, step: CFG.STEP,
          mad: p.mad, madT: p.madT, place: p.place, modes: st.madModes, rammed: st.rammed, shoppers: game.sim.shoppers.length, rivals: game.sim.carts.length - 1,
          cam: { cartX: [pr.minX, pr.maxX], cartY: [pr.minY, pr.maxY], minRoadSeconds: pr.minRoad,
            yawReversalsPerSecond: pr.reversals / Math.max(pr.time, 1e-6), maxLift: pr.lift }, log: pr.log };
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
