// DOORBUSTER — ui.js
// Purpose: the HTML interface above the canvas: the in-run screen (timer, receipt total, pop-up
//          words, floating prices, countdown), the title, receipt and "store closed" screens, and
//          the debug panel (?debug=1). It only shows state; decisions stay in main.js.
// Exports: initUI, ui, money, updateHud, popWord, floatText, chainText, showTitle, showReceipt, showClosed,
//          hideScreens, initDebug, updateDebug
// Depends on: config.js. Browser only. All styles live in index.html.

import { TUNE } from './config.js';

export const ui = { root: null, hud: null, timer: null, total: null, pop: null, count: null, chain: null, floats: [], screen: null, popT: 0, tally: null };

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
export function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }

export function initUI(root) {
  ui.root = root;
  ui.hud = el('div', 'hud', undefined, root);
  const t = el('div', 'plate hud-timer', undefined, ui.hud);
  el('span', 'lbl', 'CLOSING IN', t);
  ui.timer = el('b', '', '0:00', t);
  const r = el('div', 'tag hud-total', undefined, ui.hud);
  el('span', 'lbl', 'RECEIPT', r);
  ui.total = el('b', '', '$0', r);
  ui.pop = el('div', 'hud-pop', '', ui.hud);
  ui.count = el('div', 'hud-count', '', ui.hud);
  ui.chain = el('div', 'float chain', '', ui.hud);
  for (let i = 0; i < 14; i++) ui.floats.push({ e: el('div', 'float', '', ui.hud), t: 0, x: 0, y: 0 });
  ui.screen = el('div', 'screen', undefined, root);
}

// Called every frame with the simulation; cheap string work only when something changed.
let lastSec = -1, lastTotal = -1, lastCount = '';
export function updateHud(sim, dt) {
  const left = Math.max(0, Math.ceil(sim.timer - Math.max(0, sim.t)));
  if (left !== lastSec) {
    lastSec = left;
    ui.timer.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    ui.timer.parentNode.classList.toggle('hot', left <= 15);
  }
  const total = Math.round(sim.player.value + sim.player.stunts);
  if (total !== lastTotal) {
    lastTotal = total;
    ui.total.textContent = money(total);
    ui.total.classList.remove('bump'); void ui.total.offsetWidth; ui.total.classList.add('bump');
  }
  const c = sim.t < -1.6 ? '3' : sim.t < -0.8 ? '2' : sim.t < 0 ? '1' : sim.t < 0.7 ? 'GO!' : '';
  if (c !== lastCount) {
    lastCount = c;
    ui.count.textContent = c;
    ui.count.classList.remove('in'); void ui.count.offsetWidth; if (c) ui.count.classList.add('in');
  }
  if (ui.popT > 0) { ui.popT -= dt; if (ui.popT <= 0) ui.pop.classList.remove('in'); }
  for (const f of ui.floats) {
    if (f.t <= 0) continue;
    f.t -= dt;
    f.y -= 60 * dt;
    f.e.style.transform = `translate(${f.x.toFixed(0)}px, ${f.y.toFixed(0)}px)`;
    if (f.t <= 0) f.e.classList.remove('in');
  }
}

// One big word in the middle of the screen (CLEAN SWEEP, HEAVY ...). kind picks the colour class.
export function popWord(text, kind) {
  ui.pop.textContent = text;
  ui.pop.className = 'hud-pop ' + (kind || '');
  void ui.pop.offsetWidth;
  ui.pop.classList.add('in');
  ui.popT = 1.1;
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

// A small floating label at screen position (x, y) in CSS pixels: "+$45".
export function floatText(text, x, y, kind) {
  let f = ui.floats[0];
  for (const c of ui.floats) if (c.t < f.t) f = c;
  f.t = 0.7; f.x = x; f.y = y;
  f.e.textContent = text;
  f.e.className = 'float in ' + (kind || '');
  f.e.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
}

export function hideScreens() {
  ui.screen.className = 'screen';
  ui.screen.textContent = '';
  ui.hud.classList.remove('off');
  if (ui.tally) { clearInterval(ui.tally); ui.tally = null; }
}

// The first thing a player sees: the name, the one-line rule and "click to start".
export function showTitle(levelName, onStart) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen title on';
  el('div', 'logo', 'DOORBUSTER', ui.screen);
  el('div', 'sub', levelName, ui.screen);
  const b = el('button', 'btn big', 'START', ui.screen);
  el('div', 'hint', 'Arrows or WASD to drive · Space to drift · Shift to dash', ui.screen);
  b.onclick = onStart;
}

// The receipt: lines print one by one, then the total. Any key or click prints the rest at once.
export function showReceipt(rc, onRetry) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen receipt on';
  const paper = el('div', 'paper', undefined, ui.screen);
  el('div', 'paper-head', 'PRICE PANIC', paper);
  el('div', 'paper-sub', 'thank you for the chaos', paper);
  const lines = [['ITEMS x' + rc.count, rc.items], ['LIST', rc.list], ['STUNTS', rc.stunts], ['TIME ' + rc.left + ' s', rc.time]];
  const rows = lines.map(([name, value]) => {
    const row = el('div', 'line', undefined, paper);
    el('span', '', name, row);
    return { row, value, out: el('b', '', '', row) };
  });
  const totalRow = el('div', 'line total', undefined, paper);
  el('span', '', 'TOTAL', totalRow);
  const totalOut = el('b', '', '', totalRow);
  const b = el('button', 'btn', 'RETRY  (R)', ui.screen);
  b.onclick = onRetry;
  let i = 0;
  const step = () => {
    if (i < rows.length) { rows[i].row.classList.add('in'); rows[i].out.textContent = money(rows[i].value); i++; return; }
    totalRow.classList.add('in'); totalOut.textContent = money(rc.total);
    b.classList.add('in');
    clearInterval(ui.tally); ui.tally = null;
  };
  ui.tally = setInterval(step, 420);
  paper.onclick = () => { while (ui.tally) step(); };
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
    `dash cd ${Math.max(0, k.dashCd).toFixed(1)}  load ${k.load}  items ${k.tower.length}  $${k.value}  crashes ${info.sim.stats.crashes}`;
  worstMs = 0;
}
