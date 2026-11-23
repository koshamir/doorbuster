// DOORBUSTER — main.js
// Purpose: the entry module: boot, keyboard and touch input, the frame loop, the game states (title,
//          play, receipt, closed, paused), progress (medals, records, unlocked stores, settings) and
//          the glue between the simulation (sim.js), the visuals (R.js, scene.js, fx.js), the sound
//          (audio.js) and the interface (ui.js).
// Exports: nothing.
// Depends on: every other module. Loads three.js (platform.loadThree) before anything touches THREE.
//
// URL parameters, all optional: level=N, seed=N, autoplay=beginner|confident|expert (a bot drives),
// fill=N (start with N goods in the cart), debug=1 (panel and window.__db), manual=1 (time advances only
// through window.__db.advance(seconds); the capture tool uses it for exact, repeatable frames).

import { TUNE, CFG, GOOD } from './config.js';
import { LEVELS } from './levels.js';
import { navAim, navDistAt, clearPath } from './world.js';
import { createSim, advanceSim, giveGoods, settle } from './sim.js';
import { BOTS, makeDriver } from './ai.js';
import { loadThree, platform } from './platform.js';
import { R, initRender, resizeRender, updateCamera, renderFrame, watchFrameRate, benchTick, setGrade } from './render.js';
import { buildScene, syncScene, sceneEvent, disposeScene } from './scene.js';
import { goodIcon } from './goods.js';
import { initFx, clearFx, cartFx, eventFx, updateFx, spark } from './fx.js';
import { initShowcase, makeTitle, makeTurntable, portraitShot } from './showcase.js';
import { showDirectory, showCustoms, showIntro, recommended } from './meta.js';
import { UPGRADES, PAINTS, HATS } from './cartart.js';
import { kitOf } from './kits.js';
import { audio, unlockAudio, setSound, setVolumes, audioEvent, audioCue, audioFrame, objectSound, loadVoices } from './audio.js';
import { chatterReset, chatterEvent, chatterFrame } from './chatter.js';
import { ui, initUI, updateHud, resetHud, popWord, announce, floatText, sticker, updateStickers, chainText, setList, setArrow, setWarn, setHint, showTouch, showTitle, showReceipt,
  showClosed, showPause, hideScreens, hurryUI, money, initDebug, updateDebug } from './ui.js';

const query = new URLSearchParams(location.search);
const LAST = LEVELS.length - 1;                 // level 0 is the test course; the campaign is 1..LAST
const game = {
  level: Math.max(0, Math.min(LAST, Number(query.get('level') || 1))),
  seed: Number(query.get('seed') || 1),
  bot: query.get('autoplay') || '',
  debug: query.has('debug'), manual: query.has('manual'),
  state: 'title',                 // title -> play -> receipt | closed; `paused` freezes any of them
  paused: false, touch: false,
  sim: null, view: null, scale: 1, last: 0, logicMs: 0, logicSum: 0, logicN: 0, hitstop: 0, slowT: 0, custom: null,
  keys: {}, inq: [], now: 0,     // keys as the simulation has seen them; key events waiting for their step
  probe: null, gain: 0, gainT: 0, gainList: false, v: null, said: {},
  icons: {},                      // pictures of goods for the list, by id
  mark: null, markT: 0, markText: '',   // where the arrow points (a piece or a lane), for how long, its word
  flash: 0, flashAt: -9, flipT: 0, warner: null, dodgeHint: false, glassT: 0, rammed: false, frozen: false, clock: 0, steered: 0, tagAt: -9, aim: { x: 0, z: 0, fx: 0, fz: 0, left: 0 },
};
let save = null;                  // platform.progress: { best, medals, unlocked, fails, seen, music, sfx, shake, wallet, up, paints, paint, hats, hat }

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas',
  ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'dash', ShiftRight: 'dash',
};
const WORDS = { cleansweep: 'CLEAN SWEEP', strike: 'STRIKE!', ram: 'RAM!', takedown: 'TAKEDOWN!', shave: 'CLOSE SHAVE', smash: 'SMASH!', jump: 'BIG AIR', dodge: 'DODGED!', glass: 'WINDOW SHOPPING!' };

// Builds the level. quick = a restart: shorter countdown, straight into play.
function startLevel(quick) {
  chatterReset();
  if (game.titleShow) { game.titleShow.dispose(); game.titleShow = null; }
  if (game.turntable) { game.turntable.dispose(); game.turntable = null; }
  if (game.view) disposeScene(game.view);
  clearFx();
  const def = game.custom || LEVELS[game.level];
  game.sim = createSim(def, game.seed, { bot: BOTS[game.bot] ? game.bot : BOTS[query.get('pilot')] ? query.get('pilot') : undefined, countdown: quick ? 1.5 : CFG.countdown,
    up: game.bot ? undefined : save.up, look: { paint: save.paint, tiers: save.up, kind: 'cart' }, hat: save.hat });
  if (query.get('fill')) giveGoods(game.sim, game.sim.player, Number(query.get('fill')));   // test aid: start with goods
  game.view = buildScene(game.sim);
  setGrade(game.view.kit.grade);
  setList((def.list || []).map((id) => game.icons[id] || (game.icons[id] = goodIcon(GOOD[id]))));
  game.hitstop = 0; game.slowT = 0; game.gain = 0; game.keys = {}; game.inq.length = 0; game.said = {};
  game.mark = null; game.markT = 0; game.warner = null; game.frozen = false; game.paused = false; game.glassT = 0;
  R.u.uTintAmt.value = 0;
  R.cam.ready = false;
  R.cam.shake = 0;
}
function play(quick) {
  resetHud();
  startLevel(quick);
  hideScreens();
  game.state = 'play';
  platform.runStart();
  // the intro card: the store's sign, its mode, YOU against the rivals (not on a quick restart)
  const def = game.sim.def, P = game.view.kit.palette;
  if (!quick && !query.has('manual') || query.get('screen') === 'intro') showIntro(def, [P.a, P.b, P.c, P.d], def.rivals || [], ui.root, portraitShot);
}
// The stores as the Mall Directory shows them (every store is open).
const hotPics = {};
const hotPic = (h) => hotPics[h] || (hotPics[h] = goodIcon(0, 160, h));      // the store's hot item, rendered once for its shop window
function storeCards() {
  return LEVELS.slice(1).map((d) => { const P = kitOf(d).palette; return { name: d.name, mode: d.mode || 'rush', medal: save.medals[d.id] || 0, best: save.best[d.id] || 0, pal: [P.a, P.b, P.c, P.d], hot: kitOf(d).hot }; });
}
function openDirectory() {
  if (game.turntable) { game.turntable.dispose(); game.turntable = null; if (game.view) game.view.root.visible = true; }
  game.state = 'directory';
  const cards = storeCards(); for (const c of cards) c.pic = hotPic(c.hot);
  showDirectory(cards, save.wallet, (i) => { game.level = i + 1; play(false); }, openCustoms, null);
}
// Cart Customs: the turntable replaces the store behind the catalogue page.
function openCustoms() {
  game.state = 'customs';
  if (game.view) game.view.root.visible = false;
  if (game.titleShow) game.titleShow.root.visible = false;
  const look = () => ({ paint: save.paint, tiers: save.up, kind: 'cart' });
  if (!game.turntable) game.turntable = makeTurntable(look(), save.hat);
  const st = { wallet: save.wallet, up: save.up, paints: save.paints, paint: save.paint, hats: save.hats, hat: save.hat };
  const sync = () => { Object.assign(st, { wallet: save.wallet, paint: save.paint, hat: save.hat }); game.turntable.set(look(), save.hat); platform.save(); };
  showCustoms(st, (kind, id) => {
    if (kind === 'up') { const t = save.up[id] || 0, price = UPGRADES[id].price[t]; if (t < 3 && save.wallet >= price) { save.wallet -= price; save.up[id] = t + 1; } }
    else if (kind === 'paint') { const p = PAINTS[id]; if (save.wallet >= p.price) { save.wallet -= p.price; save.paints.push(id); save.paint = id; } }
    else { const h = HATS.find((x) => x.id === id); if (h && save.wallet >= h.price) { save.wallet -= h.price; save.hats.push(id); save.hat = id; } }
    audioCue('kaching'); sync();
  }, (kind, id) => { if (kind === 'paint') save.paint = id; else save.hat = id; sync(); }, openDirectory);
}
// The title: the start grid of the chosen store; once a store has been finished, the loyalty card too.
function title() {
  startLevel(false);
  game.state = 'title';
  const cards = null, back = Object.keys(save.best).length > 0;
  // the cast of this store lined up behind the mall doors, Penny in the middle
  game.titleShow = makeTitle(game.view.kit);
  game.view.root.visible = false;
  game.opening = 0;
  showTitle(LEVELS[game.level].name, startFromTitle, cards, (i) => { game.level = i + 1; title(); }, back ? { directory: openDirectory, customs: openCustoms } : null);
}
// START on the title: the doors slide open, then the run begins.
function startFromTitle() {
  if (!game.titleShow) { play(false); return; }
  if (game.opening > 0) return;
  game.titleShow.open = 0; game.opening = 0.55;
  hideScreens(); ui.hud.classList.add('off');
  audioCue('kaching');
}
function pause(on) {
  if (on === game.paused || (on && game.state !== 'play')) return;      // only a run can be paused
  game.paused = on;
  if (on) {
    platform.pause();
    showPause({ sound: platform.soundOn, music: save.music, sfx: save.sfx, shake: TUNE.shake, impact: save.impact !== false }, {
      resume: () => pause(false), restart: () => { pause(false); play(true); }, menu: save.unlocked > 1 ? () => { pause(false); title(); } : null,
      sound: (v) => platform.setSound(v),
      music: (v) => { save.music = v; setVolumes(save.music, save.sfx); platform.save(); },
      sfx: (v) => { save.sfx = v; setVolumes(save.music, save.sfx); audioCue('scan', 4); platform.save(); },     // (a beep to set it by)
      shake: (v) => { TUNE.shake = save.shake = v; platform.save(); },
      impact: (v) => { save.impact = v; platform.save(); },
    });
  } else {
    platform.resume();
    hideScreens();
  }
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
  inp.gas = keys.gas || (game.touch && !keys.brake) ? 1 : 0;       // on a touch screen the accelerator is automatic
  inp.brake = keys.brake ? 1 : 0;
  inp.drift = !!keys.drift;
  if (inp.steer && inp.gas) game.steered++;
}
function press(name, down) { game.inq.push({ name, down, t: performance.now() }); }

// World position -> CSS pixels on screen (z > 1 means behind the camera).
function toScreen(x, y, z) {
  const v = game.v.set(x, y, z).project(R.camera);
  v.x = (v.x + 1) / 2 * R.w; v.y = (1 - v.y) / 2 * R.h;
  return v;
}

// The player has checked out: medal, record, the next store unlocked, the receipt, and (when its table
// is due) the rest of the race played out.
function finish() {
  const sim = game.sim, p = sim.player, def = sim.def, total = p.receipt.total;
  const prev = save.best[def.id] || 0, isNew = total > prev, medal = 1 + (def.medals || []).filter((m) => total >= m).length;
  if (isNew) save.best[def.id] = total;
  if (!p.ai || query.has('pilot')) save.wallet = (save.wallet || 0) + Math.max(0, total);     // (pilot: a bot drives as the player, for the flow test)
  save.medals[def.id] = Math.max(save.medals[def.id] || 0, medal);
  save.fails = 0;
  if (game.level >= 1 && game.level < LAST) save.unlocked = Math.max(save.unlocked, game.level + 1);
  platform.save();
  platform.submit('receipt_l' + game.level, total, def.name);
  platform.submit('receipt_total', LEVELS.slice(1).reduce((s, d) => s + (save.best[d.id] || 0), 0), 'All stores');
  platform.runEnd(sim.t, game.level);
  game.state = 'closeup'; game.closeT = 1.5;
  game.view.heroPose = p.place === 1 || medal >= 2 ? 'victory' : 'defeat';
  ui.hud.classList.add('off'); setArrow(false); setWarn(false); setHint(null);
  game.result = () => showReceipt(p.receipt, () => {
    game.frozen = true;
    return settle(sim).map((k) => ({ name: k.player ? 'YOU' : k.def.name, total: k.receipt ? k.receipt.total : -1, time: k.receipt ? k.doneT : -1, me: k.player }));
  }, { value: Math.max(prev, total), isNew: isNew && prev > 0 }, def.name, medal, () => play(true),
  openCustoms, openDirectory,
  medal < 3 && def.medals ? { medal: medal + 1, at: def.medals[medal - 1] } : null,      // (the Black Card stays a secret)
  { wallet: save.wallet, afford: Object.keys(UPGRADES).some((u) => (save.up[u] || 0) < 3 && save.wallet >= UPGRADES[u].price[save.up[u] || 0]) });
}
// After the close-up the receipt prints.
function closeupTick(dt) {
  if (game.state !== 'closeup' || (game.closeT -= dt) > 0) return;
  game.state = 'receipt';
  game.result();
}
function next() { game.level = Math.min(LAST, game.level + 1); play(false); }

// An impact frame: a two-frame ink flash on a big hit, at most one a second, unless switched off.
function impact() { if (save.impact !== false && game.clock - game.flashAt > 1) { game.flash = 0.034; game.flashAt = game.clock; } }

// Presentation of one simulation event: sound, particles, scene reactions, interface, platform calls.
function onEvent(e) {
  const sim = game.sim, p = sim.player, mine = e.cart === p, k = e.cart;
  const dashed = () => { if (!save.seen.dash && !p.ai) { save.seen.dash = true; platform.save(); } };   // the dash hint retires when a dash has hit something
  if (game.probe && (mine || e.ref === p)) game.probe.log.push([e.type + (mine ? '' : '<'), +sim.t.toFixed(3)]);     // for the capture tool
  audioEvent(e, sim);
  chatterEvent(e, sim, game.view);
  const shake = eventFx(e);
  sceneEvent(game.view, e);
  // What others do to the player, or near the player.
  if (!mine) {
    const close = (x, z) => Math.hypot(x - p.x, z - p.z) < 22;
    if (e.type === 'pancake' && close(e.ref.x, e.ref.z)) sticker('SPLAT!', 'splat', e.ref.x, 1.4, e.ref.z);
    if (e.type === 'chaser' && e.value) { popWord('RUN!', 'bad'); R.cam.shake = Math.min(1, R.cam.shake + 0.6); }
    if (e.type === 'flip') {           // the store swaps its barriers: the screen flashes the colour that is now solid
      if (e.value) R.u.uTint.value.set(1.0, 0.3, 0.25); else R.u.uTint.value.set(0.35, 0.55, 1.0);
      R.u.uTintAmt.value = 0.42; game.flipT = 0.3;
      sticker('ZAP!', 'bam', p.x, 2.8, p.z);
      if (!save.seen.flip && !p.ai) { save.seen.flip = true; platform.save(); }
    }
    if (!k) return;
    if (e.type === 'wipe' && close(k.x, k.z)) sticker('BONK!', 'bonk', k.x, 2.8, k.z);
    else if (e.type === 'pop' && close(k.x, k.z)) sticker('BOING!', 'bam', k.x, 2.8, k.z);
    else if (e.type === 'fountain' && close(k.x, k.z)) { const s = toScreen(k.x, 3.2, k.z); if (s.z < 1) floatText(money(e.ref.lost) + '!', s.x, s.y, 'big'); }
    if (e.type === 'warn' && e.ref === p) {             // the first two warnings come with the keys that dodge them
      game.warner = k; game.dodgeHint = !p.ai && (save.seen.dodge || 0) < 2;
      if (game.dodgeHint) { save.seen.dodge = (save.seen.dodge || 0) + 1; platform.save(); }
    }
    else if (e.type === 'ram' && e.ref === p) { impact(); game.hitstop = 0.07; R.cam.shake = Math.min(1, R.cam.shake + 0.7); popWord('RAMMED!', 'bad'); sticker('CRASH!', 'crash', (k.x + p.x) / 2, 3.1, (k.z + p.z) / 2); }
    else if (e.type === 'selfie') { const s = toScreen(k.x, 3, k.z); if (s.z < 1) floatText('+' + money(CFG.stunts.selfie), s.x, s.y, 'big'); }
    else if (e.type === 'shout') { game.mark = e.ref; game.markT = 5; game.markText = 'HOT!'; const s = toScreen(k.x, 2.6, k.z); if (s.z < 1) floatText('MINE!', s.x, s.y, 'big'); }
    else if (e.type === 'finish') { const s = toScreen(k.x, 2.6, k.z); if (s.z < 1) floatText(money(e.value), s.x, s.y, ''); }
    return;
  }
  R.cam.shake = Math.min(1, R.cam.shake + shake);
  switch (e.type) {
    case 'crash': game.hitstop = 0.07; if (e.value > 9) { impact(); sticker('BONK!', 'bonk', p.x - p.wnx, 1.5, p.z - p.wnz); } break;
    // the level objects
    case 'wipe': impact(); game.hitstop = 0.1; R.cam.shake = Math.min(1, R.cam.shake + 0.8); sticker('BONK!', 'bonk', p.x, 2.6, p.z); popWord('WIPEOUT!', 'bad'); break;
    case 'pop': game.hitstop = 0.05; sticker('BOING!', 'bam', p.x, 2.6, p.z); break;
    case 'shoved': game.hitstop = 0.06; sticker('HONK!', 'crash', p.x, 2.6, p.z); break;
    case 'press': popWord(e.ref.gates.length ? 'IT OPENS!' : 'CLICK!', 'good'); break;
    case 'checkpoint': popWord('CHECKPOINT ' + (e.value + 1), 'good'); break;
    case 'watch': { popWord('+' + e.value + ' SECONDS', 'hot'); const s = toScreen(e.ref.x, 2.2, e.ref.z); if (s.z < 1) floatText('+' + e.value + 's', s.x, s.y, 'big'); break; }
    case 'boostpad': sticker('WHOOSH!', 'bonk', p.x, 2.4, p.z); break;
    case 'cans': if (e.value > 0) { const s = toScreen(e.ref.x, 2.4, e.ref.z); if (s.z < 1) floatText('+' + money(e.value), s.x, s.y, 'big'); } break;
    case 'take': game.gain += e.value; game.gainT = 0.45; if (e.ref.entry.list) game.gainList = true; break;
    case 'spill': case 'shed': { const s = toScreen(p.x, 2.6, p.z); floatText(money(-e.ref.lost), s.x, s.y - 30, 'loss'); break; }
    case 'heavy': case 'overloaded':                    // said once per run: afterwards the tower itself shows it
      if (!game.said[e.type]) { game.said[e.type] = true; popWord(e.type.toUpperCase(), 'bad'); }
      break;
    case 'full': announce('CART FULL!', 'Only pricier goods fit now. They push the cheap ones out.'); break;
    case 'rocket': popWord('ROCKET START!', 'good'); break;
    case 'bonk': popWord('TOO LIGHT!', 'bad'); break;
    case 'hot': popWord('HOT ITEM!', 'hot'); game.hitstop = 0.05; dashed(); sticker('KA-CHING!', 'kaching', e.ref.x, 2.2, e.ref.z); if (game.mark === e.ref) game.markT = 0; break;
    case 'smash': case 'glass': game.hitstop = 0.04; game.glassT = 0; dashed(); sticker(e.type === 'glass' ? 'CRASH!' : 'BAM!', e.type === 'glass' ? 'crash' : 'bam', e.ref.x, 1.6, e.ref.z); break;
    case 'bump': if (e.ref && e.ref.type === 'glass') game.glassT = 3; break;       // bounced off a shop window: show the key that opens it
    case 'drift': if (!save.seen.drift && !p.ai) { save.seen.drift = true; platform.save(); } break;
    case 'ram':
      game.hitstop = 0.08; dashed(); impact(); R.cam.shake = Math.min(1, R.cam.shake + 0.3);
      sticker('BAM!', 'bam', e.ref.x * 0.7 + p.x * 0.3, 3.1, e.ref.z * 0.7 + p.z * 0.3);
      if (!game.rammed) { game.rammed = true; game.slowT = 0.5; }      // the first ram is shown in slow motion
      break;
    case 'madmode': if (e.value) { popWord('MADNESS!', 'hot'); game.hitstop = 0.1; } break;
    case 'flash':
      announce('FLASH SALE!', 'A hot item for ten seconds. Elbows are legal.');
      game.mark = e.ref; game.markT = 10; game.markText = 'SALE';
      break;
    case 'flashend': if (game.mark === e.ref) game.markT = 0; break;
    case 'closing': announce('CLOSING TIME!', 'The checkouts are shutting one by one. So is your window.'); break;
    case 'lanewarn': { const s = toScreen(e.ref.x, 3.4, e.ref.z); if (s.z < 1 && s.y > R.h * 0.24) floatText('CLOSING', s.x, s.y, 'loss'); break; }
    case 'stunt': {
      popWord(WORDS[e.ref.name] || e.ref.name.toUpperCase(), 'good');
      const s = toScreen(p.x, 2.2, p.z);
      floatText('+' + money(e.value), s.x, s.y - R.h * 0.11, 'big');
      break;
    }
    case 'finish': game.state = 'finish'; break;       // handled after the event loop (it plays the race out)
    case 'timeup':
      game.state = 'closed';
      save.fails = (save.fails || 0) + 1; platform.save();
      platform.runEnd(sim.t, game.level);
      // Three failures in a row and the store can be skipped: nobody is locked out of the rest.
      showClosed(() => play(true), save.fails >= 3 && game.level >= 1 && game.level < LAST ? () => { save.unlocked = Math.max(save.unlocked, game.level + 1); save.fails = 0; platform.save(); next(); } : null);
      break;
    default:
  }
}

// The arrow to the current event (the flash sale, a hot item someone shouted about, the checkouts at
// closing time), the "!" over a rival about to ram, and the key hints of the first runs.
function pointers(dt) {
  const sim = game.sim, p = sim.player, playing = game.state === 'play';
  let m = game.markT > 0 ? game.mark : null, text = game.markText;
  game.markT -= dt;
  if (!m && sim.closing && playing) {                     // closing time: the nearest open checkout (one about to close only as a last resort)
    let best = 1e9;
    for (const l of sim.world.lanes) { const d = Math.hypot(l.x - p.x, l.z - p.z) + (l.warned ? 40 : 0); if (l.open && d < best) { best = d; m = l; } }
    text = 'CHECKOUT';
  }
  if (m && playing) {
    const s = toScreen(m.x, 3.4, m.z), pad = R.h * 0.14;
    if (s.z < 1 && s.x > pad && s.x < R.w - pad && s.y > pad * 1.6 && s.y < R.h - pad) setArrow(true, s.x, s.y - R.h * 0.05, Math.PI, text);
    else {                                                // off screen: on a circle round the middle, pointing the way to drive there
      let tx = m.x, tz = m.z;                             // (along the route while the target is ahead on it and out of sight, never through a wall)
      const wd = sim.world;
      if (navDistAt(wd, m.x, m.z) < navDistAt(wd, p.x, p.z) + 2 && !clearPath(wd, p.x, p.z, m.x, m.z, 0.3) && navAim(wd, p.x, p.z, 5, 0.5, game.aim, 14)) { tx = game.aim.x; tz = game.aim.z; }
      const rel = Math.atan2(tx - p.x, tz - p.z) - R.cam.yaw, r = Math.min(R.w, R.h) * 0.36;
      setArrow(true, R.w / 2 - Math.sin(rel) * r, Math.max(R.h * 0.27, R.h * 0.52 - Math.cos(rel) * r), -rel, text);   // (kept below the announcer's line)
    }
  } else setArrow(false);
  const w = game.warner;
  if (w && w.ai && (w.ai.warnT > 0 || w.ai.strikeT > 0) && playing) {
    const s = toScreen(w.x, 2.8, w.z), pad = R.h * 0.08;
    if (s.z < 1 && s.x > pad && s.x < R.w - pad && s.y > pad * 2 && s.y < R.h - pad) setWarn(true, s.x, s.y);
    else {                                                // out of the picture (it usually comes from behind): beside the player's cart, on the side it comes from
      const rel = Math.atan2(w.x - p.x, w.z - p.z) - R.cam.yaw, c = toScreen(p.x, 0.6, p.z), r = R.h * 0.16;
      setWarn(true, Math.max(pad, Math.min(R.w - pad, c.x - Math.sin(rel) * r)), Math.max(pad * 2, Math.min(R.h - pad * 0.4, c.y - Math.cos(rel) * r + R.h * 0.05)));
    }
  } else {
    setWarn(false); game.warner = null;
    // the yarn ball rolling up behind: the same '!' on the side it comes from, once it is within 15 m
    const ch = sim.world.chaser;
    if (ch && ch.active && playing && Math.hypot(ch.x - p.x, ch.z - p.z) < 15) {
      const rel = Math.atan2(ch.x - p.x, ch.z - p.z) - R.cam.yaw, c = toScreen(p.x, 0.6, p.z), r = R.h * 0.16, pad = R.h * 0.08;
      setWarn(true, Math.max(pad, Math.min(R.w - pad, c.x - Math.sin(rel) * r)), Math.max(pad * 2, Math.min(R.h - pad * 0.4, c.y - Math.cos(rel) * r + R.h * 0.05)));
    }
  }
  // Teaching without text: steering and throttle at the start, the dash before the first thing to
  // dash through, the drift before the first round display. Each goes away after its first use.
  let keys = null;
  if (playing && !p.ai && !game.custom) {
    const seen = save.seen, fx = Math.sin(p.h), fz = Math.cos(p.h), ahead = (q, far) => { const dx = q.x - p.x, dz = q.z - p.z, d = dx * fx + dz * fz; return d > 2 && d < far && Math.abs(dx * fz - dz * fx) < 4; };
    if (game.glassT > 0) game.glassT -= dt;
    if (game.warner && game.dodgeHint) keys = game.touch ? ['◀', '▶'] : ['A', 'D'];
    else if (game.glassT > 0) keys = [game.touch ? 'DASH' : 'SHIFT'];
    else if (!seen.drive) { keys = game.touch ? ['◀', '▶'] : ['A', 'D', 'W']; if (game.steered > 90) { seen.drive = true; platform.save(); } }
    else if (!seen.flip && sim.world.barriers.some((b) => b.solid.on && ahead(b, 14))) keys = [game.touch ? 'DASH' : 'SHIFT'];      // a dash flips the barriers
    else if (!seen.dash && sim.world.pieces.some((q) => q.solid.on && q.solid.dash && ahead(q, 16))) keys = [game.touch ? 'DASH' : 'SHIFT'];
    else if (!seen.drift && Math.abs(p.spd) > 7 && sim.world.pieces.some((q) => q.type === 'display' && ahead(q, 16))) keys = [game.touch ? 'DRIFT' : 'SPACE'];
  }
  if (keys) { const s = toScreen(p.x, 1.2, p.z); setHint(keys, s.x, s.y); } else setHint(null);
}

// One frame: read input, step the simulation by dt of real time, update the visuals, draw.
function tick(dt, draw) {
  if (game.state === 'title' && game.titleShow) {
    game.clock += dt; R.clock = game.clock;
    game.titleShow.update(dt);
    if (game.opening > 0 && (game.opening -= dt) <= 0) { play(false); return; }
    audioFrame(game.sim, dt, 'title');
    if (draw) renderFrame({}, { x: 0, z: -2 });
    return;
  }
  if (game.show) { game.show.update(dt); game.clock += dt; if (draw) renderFrame({}, { x: 0, z: 0 }); return; }
  if (game.state === 'customs' && game.turntable) { game.clock += dt; R.clock = game.clock; game.turntable.update(dt); audioFrame(game.sim, dt, 'title'); if (draw) renderFrame({}, { x: 0, z: 0 }); return; }
  const sim = game.sim, t0 = performance.now(), p = sim.player;
  game.now = t0;
  if (game.paused) { audioFrame(sim, dt, 'pause'); if (draw) renderFrame({}, R.cam); return; }   // the music carries on under water
  game.clock += dt; R.clock = game.clock; game.flash -= dt;
  // Hit-stop: a few frozen frames on a big impact; the shake and the particles keep moving.
  let simDt = game.state === 'play' ? dt * game.scale : (game.state === 'receipt' || game.state === 'closeup') && !game.frozen ? dt * 0.25 : 0;
  closeupTick(dt);
  if (game.slowT > 0) { game.slowT -= dt; simDt *= 0.3; }
  if (game.hitstop > 0) { game.hitstop -= dt; simDt = 0; }
  const alpha = simDt > 0 ? advanceSim(sim, simDt, feedInput) : sim.acc / CFG.STEP;
  for (const e of sim.events) onEvent(e);
  sim.events.length = 0;
  if (game.state === 'finish') finish();
  game.logicMs = performance.now() - t0;
  game.logicSum += game.logicMs; game.logicN++;
  for (const k of sim.carts) if (!k.done || k.player) cartFx(k, k.x, k.z, k.h, dt);
  for (const q of sim.world.pieces) {                     // fountains spray
    if (q.type === 'fountain' && Math.abs(q.x - p.x) < 30 && Math.abs(q.z - p.z) < 30) spark(q.x, 1.7, q.z, { color: 8, shape: 0, size: 0.2, ttl: 0.7, grav: 9, vx: Math.sin(game.clock * 37) * 2.5, vz: Math.cos(game.clock * 53) * 2.5, vy: 4 });
  }
  updateFx(dt);
  const swoop = game.state === 'play' && sim.t < 0 && sim.opts.countdown > 2 ? Math.pow(Math.min(1, -sim.t / 2), 2) : 0;   // the first countdown opens high above the route
  // The title circles the start grid; the receipt is read from steep above the checkout, the cart to the left of the paper.
  updateCamera(p, alpha, dt, game.view.towerH, sim.world, game.state === 'title' ? 0.7 + 0.35 * Math.sin(game.clock * 0.4) : undefined, swoop,
    game.state === 'receipt' ? (R.w > R.h ? 3 : 0) : undefined, game.state === 'closeup');
  // Closing time washes the store in red, pulsing.
  const tint = R.u.uTintAmt;
  if (game.flipT > 0) game.flipT -= dt;
  else { if (sim.closing) R.u.uTint.value.set(1.0, 0.55, 0.6); tint.value += ((sim.closing && game.state === 'play' ? 0.24 + 0.08 * Math.sin(game.clock * 6) : 0) - tint.value) * Math.min(1, dt * 4); }
  syncScene(game.view, sim, alpha, dt);
  // the level objects' own sounds: a sign creaks at each end of its swing, a forklift beeps while it moves
  const props = game.view.props;
  if (props && game.state === 'play') {
    const near = (x, z) => Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / 22);
    for (const sg of props.signs) if (sg.creak) { sg.creak = false; objectSound('creak', near(sg.ob.x, sg.ob.z)); }
    for (const pt of props.patrols) if (pt.pos && !pt.ob.loop && Math.sin(game.clock * 6.3) > 0.97) objectSound('beep', near(pt.pos.x, pt.pos.z));
    for (const l of props.lasers) if (l.zip) { l.zip = false; objectSound('zip', near(l.ob.x, l.ob.z)); }
    for (const sc of props.scissors) if (sc.snip) { sc.snip = false; objectSound('snip', near(sc.ob.x, sc.ob.z)); }
    for (const gl of props.gloves) if (gl.punch) { gl.punch = false; objectSound('punch', near(gl.ob.gx, gl.ob.gz)); }
    if (props.yarn && props.yarn.ob.active) { const y = props.yarn.ball.position, c = near(y.x, y.z); R.cam.shake = Math.max(R.cam.shake, c * c * 0.35); if (Math.sin(game.clock * 9) > 0.9) objectSound('rumble', c); }
    for (const a of props.arena) if (a.snd) { objectSound(a.snd, near(a.sx, a.sz)); a.snd = null; }
    for (const f of props.fields) if (f.clank) { f.clank = false; objectSound(f.trap ? 'clank' : 'boing', near(f.ob.x, f.ob.z)); }
  }
  // Money being swept right now is one running label above the cart; when the run of goods ends it
  // floats away.
  if (game.gain > 0) {
    const s = toScreen(p.x, 2.4 + game.view.towerH * 0.5, p.z), kind = game.gainList ? 'list' : '';
    game.gainT -= dt;
    if (game.gainT > 0) chainText('+' + money(game.gain), s.x, s.y, kind);
    else { chainText('', s.x, s.y); floatText('+' + money(game.gain), s.x, s.y, kind || 'big'); game.gain = 0; game.gainList = false; }
  }
  // During the countdown every rival wears a name tag (the names come back in the receipt's table).
  if (game.state === 'play' && sim.t < -0.3 && game.clock - game.tagAt > 0.8) {
    game.tagAt = game.clock;
    for (const k of sim.carts) if (!k.player) { const s = toScreen(k.x, 2.4 + (k.tower.length ? 1.6 : 0), k.z); if (s.z < 1) floatText(k.def.name.toUpperCase(), s.x, s.y, 'name'); }
  }
  pointers(dt);
  updateHud(sim, dt);
  chatterFrame(sim);
  updateStickers(dt, toScreen);
  audioFrame(sim, dt, game.state);
  if (game.probe) probeCamera(game.probe, p, dt);
  if (!draw) return;                           // capture mode skips only the GPU work between shots
  const top = Math.abs(p.spd) > TUNE.maxspeed * 0.97 && game.state === 'play' ? 0.35 : 0;
  renderFrame({ speed: game.state === 'play' && (p.boostT > 0 || p.dashT > 0) ? 1 : top, impact: game.flash > 0 ? 0.85 : 0 }, R.cam);
  if (game.debug) {
    updateDebug({ sim, stats: R.stats, logicMs: game.logicMs, objects: game.view.root.children.length,
      level: game.level, scale: game.scale, bot: game.bot }, performance.now() - t0);
  }
}

// Camera telemetry for the capture tool (debug and manual modes only): where the cart sits on screen,
// how many seconds of floor are visible ahead of it, and how often the camera's yaw reverses.
function probeCamera(pr, k, dt) {
  const cam = R.camera, v = pr.v;
  cam.updateMatrixWorld();
  v.set(k.x, 0.8, k.z).project(cam);
  pr.minX = Math.min(pr.minX, v.x); pr.maxX = Math.max(pr.maxX, v.x);
  pr.minY = Math.min(pr.minY, v.y); pr.maxY = Math.max(pr.maxY, v.y);
  // the floor point seen at the top centre of the screen
  v.set(0, 0.92, 0.5).unproject(cam).sub(cam.position);
  if (v.y < -1e-3 && Math.abs(k.spd) > 6) {
    const s = -cam.position.y / v.y, gx = cam.position.x + v.x * s, gz = cam.position.z + v.z * s;
    const ahead = (gx - k.x) * Math.sin(R.cam.yaw) + (gz - k.z) * Math.cos(R.cam.yaw);
    pr.minRoad = Math.min(pr.minRoad, ahead / Math.abs(k.spd));
  }
  let d = R.cam.yaw - pr.lastYaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const rate = d / dt;
  if (Math.abs(rate) > 0.05) {
    if (pr.lastSign && Math.sign(rate) !== pr.lastSign) pr.reversals++;
    pr.lastSign = Math.sign(rate);
  }
  pr.lastYaw = R.cam.yaw; pr.time += dt;
  pr.lift = Math.max(pr.lift, R.cam.lift);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - game.last) / 1000));   // a frame stamped before the last task ended is not time going back
  game.last = now;
  if (!game.manual) { tick(dt, true); if (game.state === 'play' && !game.paused) watchFrameRate(dt); else if (game.state === 'title') benchTick(dt); }
}

async function boot() {
  await loadThree();
  await platform.init();
  save = Object.assign({ best: {}, medals: {}, unlocked: 1, fails: 0, seen: {}, music: 0.55, sfx: 0.9, shake: TUNE.shake, impact: true, wallet: 0, up: {}, paints: ['pink'], paint: 'pink', hats: ['none'], hat: 'none' }, platform.progress);
  platform.progress = save;
  TUNE.shake = save.shake;
  if (!query.has('level')) game.level = 1 + recommended(storeCards());                      // carry on at the store the directory recommends
  initRender(document.getElementById('game'));
  initFx();
  initUI(document.getElementById('ui'));
  loadVoices();
  ui.onPause = () => pause(true);
  game.v = new THREE.Vector3();
  // cover=1 and icon=1 are for the pictures of the handoff package: the title view without its buttons, or without any interface and closer.
  if (query.has('cover')) document.body.classList.add('cover');
  if (query.has('icon')) { document.body.classList.add('icon'); R.cam.near = true; }
  setSound(platform.soundOn); setVolumes(save.music, save.sfx);
  platform.onSound(setSound);
  platform.onTune(resizeRender);
  addEventListener('resize', resizeRender);
  addEventListener('pointerdown', (e) => {
    unlockAudio(); hurryUI();
    if (e.pointerType === 'touch' && !game.touch) { game.touch = true; showTouch(press); }
  });
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    unlockAudio(); hurryUI();
    if (e.code === 'KeyM') { platform.setSound(!platform.soundOn); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { pause(!game.paused); return; }
    if (game.paused) { if (e.code === 'KeyR') { pause(false); play(true); } return; }
    if (game.state !== 'play') {
      // Any driving key starts from the title; R retries and Enter goes on after a run.
      if (game.state === 'title') { if (k || e.code === 'Enter') { startFromTitle(); e.preventDefault(); } }
      else if (e.code === 'KeyR' && game.state !== 'directory' && game.state !== 'customs') play(true);
      else if (e.code === 'Enter') { if (game.state === 'receipt') { game.level = 1 + recommended(storeCards()); play(false); } else if (game.state !== 'directory' && game.state !== 'customs') play(true); }
      return;
    }
    if (k) {
      if (!e.repeat) game.inq.push({ name: k, down: true, t: e.timeStamp });
      e.preventDefault();
    } else if (e.code === 'KeyR') play(true);
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) game.inq.push({ name: k, down: false, t: e.timeStamp }); });
  // Losing focus pauses a run.
  const away = () => { game.keys = {}; game.inq.length = 0; if (game.state === 'play' && !game.manual && !game.bot) pause(true); };
  addEventListener('blur', away);
  document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });   // a phone switching apps may never send blur
  if (game.debug) {
    initDebug(document.getElementById('ui'), {
      tuneRaw: platform.tuneRaw, changed: resizeRender,
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
      game, R, TUNE, play, pause, title, save, audio, audioApi: { unlockAudio, audioEvent, audioCue, audioFrame },
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
        return game.show ? game.clock : game.sim.t;
      },
      info() {
        if (game.show) return { tier: R.tier, t: game.clock, state: 'show', calls: R.stats.calls, tris: R.stats.tris };
        const p = game.sim.player, pr = game.probe, st = game.sim.stats;
        return { tier: R.tier, t: game.sim.t, phase: game.sim.phase, state: game.state, calls: R.stats.calls, tris: R.stats.tris, renderMs: R.stats.ms,
          logicMs: game.logicSum / Math.max(1, game.logicN), x: p.x, z: p.z, h: p.h, spd: p.spd, load: p.load, items: p.tower.length, value: p.value, step: CFG.STEP,
          doneT: p.doneT, receipt: p.receipt, mad: p.mad, madT: p.madT, place: p.place, modes: st.madModes, rammed: st.rammed, shoppers: game.sim.shoppers.length, rivals: game.sim.carts.length - 1,
          cam: { cartX: [pr.minX, pr.maxX], cartY: [pr.minY, pr.maxY], minRoadSeconds: pr.minRoad,
            yawReversalsPerSecond: pr.reversals / Math.max(pr.time, 1e-6), maxLift: pr.lift }, log: pr.log };
      },
    };
  }
  // A showcase scene, or: a bot or the capture tool goes straight into the run; a person gets the title and one click.
  if (query.get('scene')) { game.show = initShowcase(query.get('scene'), query); ui.hud.classList.add('off'); }
  else if (query.has('title')) { title(); if (query.get('screen') === 'directory') openDirectory(); else if (query.get('screen') === 'customs') { save.wallet = save.wallet || 2600; openCustoms(); } }
  else if (game.bot || game.manual || query.has('go')) play(false);
  else title();
  tick(1 / 60, true);
  game.last = performance.now();
  requestAnimationFrame(frame);
  window.__ready = true;
}

boot().catch((err) => { console.error(err); });
