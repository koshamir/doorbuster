// DOORBUSTER — ui.js
// Purpose: the HTML interface above the canvas: the in-run screen (timer, receipt total and place,
//          the Madness meter, shopping-list icons, announcer line, pop-up words, floating prices, an
//          arrow to the current event, the ram warning, countdown), the title, receipt and "store
//          closed" screens, and the debug panel (?debug=1). It only shows state; decisions stay in main.js.
// Exports: initUI, ui, money, updateHud, popWord, announce, floatText, chainText, setList, setArrow, setWarn,
//          showTitle, showReceipt, showClosed, hideScreens, hurryUI, initDebug, updateDebug
// Depends on: config.js. Browser only. All styles live in index.html.

import { TUNE } from './config.js';

export const ui = { root: null, hud: null, timer: null, total: null, pop: null, count: null, chain: null, floats: [], screen: null,
  popT: 0, popQ: [], tally: null, meter: null, segs: [], mult: null, place: null, list: [], news: null, newsT: 0, arrow: null, warn: null, em: 16 };

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
export function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'); }
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

export function initUI(root) {
  ui.root = root;
  ui.hud = el('div', 'hud', undefined, root);
  const t = el('div', 'plate hud-timer', undefined, ui.hud);
  el('span', 'lbl', 'CLOSING IN', t);
  ui.timer = el('b', '', '0:00', t);
  const r = el('div', 'tag hud-total', undefined, ui.hud);
  el('span', 'lbl', 'RECEIPT', r);
  ui.total = el('b', '', '$0', r);
  ui.place = el('div', 'place', '', ui.hud);
  ui.meter = el('div', 'meter', undefined, ui.hud);
  el('span', 'lbl', 'MADNESS', ui.meter);
  for (let i = 0; i < 4; i++) ui.segs.push(el('i', '', undefined, el('div', 'seg', undefined, ui.meter)));
  ui.mult = el('b', '', 'x1', ui.meter);
  const list = el('div', 'list', undefined, ui.hud);
  for (let i = 0; i < 3; i++) ui.list.push(el('div', '', undefined, list));
  ui.news = el('div', 'news', undefined, ui.hud);
  el('b', '', '', ui.news); el('span', '', '', ui.news);
  ui.pop = el('div', 'hud-pop', '', ui.hud);
  ui.count = el('div', 'hud-count', '', ui.hud);
  ui.arrow = el('div', 'arrow', undefined, ui.hud);
  el('i', '', undefined, ui.arrow); el('b', '', '', ui.arrow);
  ui.warn = el('div', 'float warn', '!', ui.hud);
  ui.chain = el('div', 'float chain', '', ui.hud);
  for (let i = 0; i < 14; i++) ui.floats.push({ e: el('div', 'float', '', ui.hud), t: 0, x: 0, y: 0 });
  ui.screen = el('div', 'screen', undefined, root);
}

// Called every frame with the simulation; cheap string work only when something changed.
let lastSec = -1, lastTotal = -1, lastCount = '', lastMult = '', lastPlace = '', lastMad = -1, lastGot = -1;
export function updateHud(sim, dt) {
  const p = sim.player, left = Math.max(0, Math.ceil(sim.timer - Math.max(0, sim.t)));
  if (left !== lastSec) {
    lastSec = left;
    ui.timer.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    ui.timer.parentNode.classList.toggle('hot', left <= 15);
  }
  const total = Math.round(p.value + p.stunts);
  if (total !== lastTotal) {
    const up = total > lastTotal;
    lastTotal = total;
    ui.total.textContent = money(total);
    ui.total.classList.remove('bump', 'drop'); void ui.total.offsetWidth; ui.total.classList.add(up ? 'bump' : 'drop');
  }
  // Madness: four segments and the multiplier; in MADNESS mode the meter is one bar running down.
  const mode = p.madT > 0, mad = mode ? 4 * p.madT / TUNE.madnesstime : p.mad, q = Math.round(mad * 25);
  if (q !== lastMad) {
    lastMad = q;
    for (let i = 0; i < 4; i++) ui.segs[i].style.width = Math.max(0, Math.min(1, mad - i)) * 100 + '%';
  }
  const mult = mode ? 'x4' : 'x' + (1 + Math.min(3, Math.floor(p.mad)));
  if (mult !== lastMult) {
    lastMult = mult;
    ui.mult.textContent = mult;
    ui.mult.classList.remove('bump'); void ui.mult.offsetWidth; ui.mult.classList.add('bump');
  }
  ui.hud.classList.toggle('mad', mode);
  const place = sim.carts.length > 1 ? ORD[p.place] || '' : '';
  if (place !== lastPlace) { lastPlace = place; ui.place.textContent = place; ui.place.className = 'place' + (place ? ' in' : '') + (p.place === 1 ? ' first' : ''); }
  let got = 0;
  for (const e of p.tower) if (e.list) got |= 1 << e.list;
  if (got !== lastGot) { lastGot = got; for (let i = 0; i < 3; i++) ui.list[i].classList.toggle('got', (got >> (i + 1) & 1) === 1); }
  const c = sim.t < -1.6 ? '3' : sim.t < -0.8 ? '2' : sim.t < 0 ? '1' : sim.t < 0.7 ? 'GO!' : '';
  if (c !== lastCount) {
    lastCount = c;
    ui.count.textContent = c;
    ui.count.classList.remove('in'); void ui.count.offsetWidth; if (c) ui.count.classList.add('in');
  }
  // Pop-up words are shown one at a time; a word that arrives while another is up waits its turn.
  if (ui.popT > 0) {
    ui.popT -= dt;
    if (ui.popQ.length && ui.popT < 0.5) showPop(ui.popQ.shift());
    else if (ui.popT <= 0) ui.pop.classList.remove('in');
  }
  if (ui.newsT > 0) { ui.newsT -= dt; if (ui.newsT <= 0) ui.news.classList.remove('in'); }
  for (const f of ui.floats) {
    if (f.t <= 0) continue;
    f.t -= dt;
    f.y -= 60 * dt;
    f.e.style.transform = `translate(${f.x.toFixed(0)}px, ${f.y.toFixed(0)}px)`;
    if (f.t <= 0) f.e.classList.remove('in');
  }
  // The receipt prints line by line (four times faster after any key or click).
  const y = ui.tally;
  if (y) {
    y.t += dt * (y.fast ? 4 : 1);
    while (y.t > 0.38 && y.i < y.steps.length) { y.t -= 0.38; y.steps[y.i++](); }
    if (y.i >= y.steps.length) ui.tally = null;
  }
}

function showPop([text, kind]) {
  ui.pop.textContent = text;
  ui.pop.className = 'hud-pop ' + (kind || '');
  void ui.pop.offsetWidth;
  ui.pop.classList.add('in');
  ui.popT = 1.0;
}
// One big word on a sale plate (CLEAN SWEEP, HEAVY ...). kind picks the colour: good, bad, hot.
export function popWord(text, kind) {
  if (ui.popT > 0.5) { if (ui.popQ.length < 3) ui.popQ.push([text, kind]); } else showPop([text, kind]);
}

// The announcer: a chime (audio.js) and one line on screen, the point first and then the joke.
export function announce(title, sub) {
  ui.news.firstChild.textContent = title;
  ui.news.lastChild.textContent = sub || '';
  ui.news.classList.add('in');
  ui.newsT = 3.4;
}

// The three shopping-list icons (data URLs of the goods' pictures).
export function setList(icons) {
  for (let i = 0; i < 3; i++) {
    ui.list[i].style.display = icons[i] ? '' : 'none';
    if (icons[i]) ui.list[i].style.backgroundImage = 'url(' + icons[i] + ')';
  }
}

// The arrow to the current event: at (x, y) on screen, turned by `turn` radians (0 = pointing up),
// with a word under it. on = false hides it.
export function setArrow(on, x, y, turn, text) {
  ui.arrow.classList.toggle('in', on);
  if (!on) return;
  ui.arrow.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  ui.arrow.firstChild.style.transform = `rotate(${turn.toFixed(2)}rad)`;
  if (ui.arrow.lastChild.textContent !== text) ui.arrow.lastChild.textContent = text;
}
// The "!" over a rival that is about to ram the player.
export function setWarn(on, x, y) {
  ui.warn.classList.toggle('in', on);
  if (on) ui.warn.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
}

// The running total of the goods being swept right now, pinned above the cart at (x, y). An empty
// text hides it. It bumps every time the sum grows.
let chainShown = '';
export function chainText(text, x, y, kind) {
  ui.chain.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  if (text === chainShown) return;
  chainShown = text;
  ui.chain.textContent = text;
  ui.chain.className = 'float chain ' + (text ? 'in ' : '') + (kind || '');
  if (text) { ui.chain.classList.remove('bump'); void ui.chain.offsetWidth; ui.chain.classList.add('bump'); }
}

// A small floating label at screen position (x, y) in CSS pixels: "+$45". Labels that start close
// together are stacked a line apart instead of on top of each other.
export function floatText(text, x, y, kind) {
  let f = ui.floats[0], stack = 0;
  for (const c of ui.floats) {
    if (c.t < f.t) f = c;
    if (c.t > 0.5 && Math.abs(c.x - x) < ui.em * 6) stack++;
  }
  f.t = 0.9; f.x = x; f.y = y - stack * ui.em * 1.7;
  f.e.textContent = text;
  f.e.className = 'float in ' + (kind || '');
  f.e.style.transform = `translate(${f.x.toFixed(0)}px, ${f.y.toFixed(0)}px)`;
}

export function hideScreens() {
  ui.screen.className = 'screen';
  ui.screen.textContent = '';
  ui.hud.classList.remove('off');
  ui.tally = null;
  ui.popQ.length = 0; ui.popT = 0; ui.pop.classList.remove('in');
  ui.news.classList.remove('in'); ui.newsT = 0;
  ui.em = parseFloat(getComputedStyle(ui.root).fontSize) || 16;
  lastTotal = 0;
}
// Any key or click while the receipt prints makes it four times faster.
export function hurryUI() { if (ui.tally) ui.tally.fast = true; }

// The first thing a player sees: the name, the one-line rule and "click to start". The cart stays
// visible in the middle of the screen.
export function showTitle(levelName, onStart) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen title on';
  const top = el('div', '', undefined, ui.screen);
  el('div', 'logo', 'DOORBUSTER', top);
  el('div', 'sub', 'BLACK FRIDAY · ' + levelName, top);
  const low = el('div', '', undefined, ui.screen);
  const b = el('button', 'btn big', 'START', low);
  el('div', 'hint', 'Arrows or WASD to drive · Space to drift · Shift to dash', low);
  b.onclick = onStart;
}

// The receipt: lines print one by one, then the total, the final table and the record.
// rc = the player's receipt; tableOf() returns [{ name, total, me }] best first and is called only
// when the table is due (main.js plays the rest of the race out at that moment); best = { value, isNew }.
export function showReceipt(rc, tableOf, best, storeName, onRetry) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen receipt on';
  const paper = el('div', 'paper', undefined, ui.screen);
  el('div', 'paper-head', storeName, paper);
  el('div', 'paper-sub', 'thank you for the chaos', paper);
  const steps = [];
  const line = (name, value, cls) => {
    const row = el('div', 'line ' + (cls || ''), undefined, paper);
    el('span', '', name, row);
    const out = el('b', '', '', row);
    steps.push(() => { row.classList.add('in'); out.textContent = value; });
    return row;
  };
  line('ITEMS x' + rc.count, money(rc.items));
  line('LIST', money(rc.list));
  line('STUNTS', money(rc.stunts));
  line('TIME ' + rc.left + ' s', money(rc.time));
  line('TOTAL', money(rc.total), 'total');
  const b = el('button', 'btn', 'RETRY  (R)', ui.screen);
  b.onclick = onRetry;
  steps.push(() => {
    tableOf().forEach((row, i) => line((i + 1) + '. ' + row.name, row.total < 0 ? 'still shopping' : money(row.total), 'rank' + (row.me ? ' me' : '')));
    const bestRow = line('BEST', money(best.value), 'rank best');
    steps.push(() => { if (best.isNew) el('div', 'stamp', 'NEW BEST!', bestRow); b.classList.add('in'); });
  });
  ui.tally = { steps, i: 0, t: 0.2, fast: false };
  paper.onclick = hurryUI;
}

export function showClosed(onRetry) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen closed on';
  el('div', 'logo small', 'STORE CLOSED', ui.screen);
  el('div', 'sub', 'No receipt today. The doors open again in a second.', ui.screen);
  const b = el('button', 'btn in', 'RETRY  (R)', ui.screen);
  b.onclick = onRetry;
}

// ---- Debug panel (?debug=1) ----------------------------------------------------------------------
let panel = null, readout = null, frames = 0, lastT = -1e9, fps = 0, worstMs = 0;

// hooks: { restart(), level(delta), slow(), fill(), bot(), tuneRaw (tune.json contents or null) }
export function initDebug(root, hooks) {
  panel = el('div', 'dbg', undefined, root);
  readout = el('pre', 'dbg-read', undefined, panel);
  const row = el('div', 'dbg-row', undefined, panel);
  for (const [label, fn] of [['restart', hooks.restart], ['level -', () => hooks.level(-1)], ['level +', () => hooks.level(1)],
    ['slow-mo', hooks.slow], ['fill cart', hooks.fill], ['bot', hooks.bot]]) {
    const b = el('button', 'dbg-btn', label, row);
    b.onclick = () => { fn(); b.blur(); };
  }
  // One slider (or checkbox) per tune value, with the ranges from tune.json when it is available.
  const raw = hooks.tuneRaw || {};
  const list = el('div', 'dbg-tune', undefined, panel);
  for (const key in TUNE) {
    const line = el('label', 'dbg-line', undefined, list);
    el('span', '', key, line);
    const input = el('input', '', undefined, line);
    const val = el('span', 'dbg-val', String(TUNE[key]), line);
    if (typeof TUNE[key] === 'boolean') {
      input.type = 'checkbox'; input.checked = TUNE[key];
      input.oninput = () => { TUNE[key] = input.checked; val.textContent = String(TUNE[key]); hooks.changed(); };
    } else {
      const meta = raw[key] || { min: TUNE[key] * 0.25, max: TUNE[key] * 3 || 1, step: 0.05 };
      input.type = 'range'; input.min = meta.min; input.max = meta.max; input.step = meta.step || 0.05; input.value = TUNE[key];
      input.oninput = () => { TUNE[key] = Number(input.value); val.textContent = input.value; hooks.changed(); };
    }
  }
  const copy = el('button', 'dbg-btn', 'copy JSON', panel);
  copy.onclick = () => {
    const out = {};
    for (const key in TUNE) out[key] = Object.assign({}, raw[key], { value: TUNE[key] });
    if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(out, null, 2)).catch(() => {});
    copy.textContent = 'copied';
    setTimeout(() => { copy.textContent = 'copy JSON'; }, 900);
  };
}

// info: { sim, stats (gfx.stats), logicMs, objects, level, scale, bot }
export function updateDebug(info, frameMs) {
  if (!panel) return;
  frames++;
  worstMs = Math.max(worstMs, frameMs);
  const now = performance.now();
  if (now - lastT < 250) return;
  fps = lastT < 0 ? 60 : frames * 1000 / (now - lastT);
  frames = 0; lastT = now;
  const k = info.sim.player, s = info.stats;
  readout.textContent =
    `${fps.toFixed(0)} fps  frame ${frameMs.toFixed(1)} ms (worst ${worstMs.toFixed(1)})  logic ${info.logicMs.toFixed(2)} ms\n` +
    `draw calls ${s.calls}  triangles ${s.tris}  objects ${info.objects}\n` +
    `level ${info.level}  t ${info.sim.t.toFixed(1)} / ${info.sim.timer}  phase ${info.sim.phase}  x${info.scale}  bot ${info.bot || 'off'}\n` +
    `speed ${k.spd.toFixed(1)} m/s  yaw ${k.yaw.toFixed(2)}  slip ${(k.slip * 57.3).toFixed(0)} deg  tier ${k.tier}  boost ${k.boostT.toFixed(1)}\n` +
    `dash cd ${Math.max(0, k.dashCd).toFixed(1)}  load ${k.load}  items ${k.tower.length}  $${k.value}  mad ${k.mad.toFixed(2)}  crashes ${info.sim.stats.crashes}`;
  worstMs = 0;
}
