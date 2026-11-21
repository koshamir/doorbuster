// DOORBUSTER — ui.js
// Purpose: the HTML interface above the canvas. For now: the debug panel (?debug=1) with frame
//          statistics, cart telemetry, test buttons and sliders for every tune value.
// Exports: initDebug, updateDebug
// Depends on: config.js. Browser only. Styles live in index.html.

import { TUNE } from './config.js';

let panel = null, readout = null, frames = 0, lastT = 0, fps = 0, worstMs = 0;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// hooks: { restart(), level(delta), slow(), fill(), bot(), tuneRaw (tune.json contents or null) }
export function initDebug(root, hooks) {
  panel = el('div', 'dbg');
  readout = el('pre', 'dbg-read');
  panel.appendChild(readout);
  const row = el('div', 'dbg-row');
  for (const [label, fn] of [['restart', hooks.restart], ['level -', () => hooks.level(-1)], ['level +', () => hooks.level(1)],
    ['slow-mo', hooks.slow], ['fill cart', hooks.fill], ['bot', hooks.bot]]) {
    const b = el('button', 'dbg-btn', label);
    b.onclick = () => { fn(); b.blur(); };
    row.appendChild(b);
  }
  panel.appendChild(row);
  // One slider (or checkbox) per tune value, with the ranges from tune.json when it is available.
  const raw = hooks.tuneRaw || {};
  const list = el('div', 'dbg-tune');
  for (const key in TUNE) {
    const line = el('label', 'dbg-line');
    const name = el('span', '', key);
    const val = el('span', 'dbg-val', String(TUNE[key]));
    let input;
    if (typeof TUNE[key] === 'boolean') {
      input = el('input'); input.type = 'checkbox'; input.checked = TUNE[key];
      input.oninput = () => { TUNE[key] = input.checked; val.textContent = String(TUNE[key]); };
    } else {
      const meta = raw[key] || { min: TUNE[key] * 0.25, max: TUNE[key] * 3 || 1, step: 0.05 };
      input = el('input'); input.type = 'range'; input.min = meta.min; input.max = meta.max; input.step = meta.step || 0.05; input.value = TUNE[key];
      input.oninput = () => { TUNE[key] = Number(input.value); val.textContent = input.value; };
    }
    line.appendChild(name); line.appendChild(input); line.appendChild(val);
    list.appendChild(line);
  }
  panel.appendChild(list);
  const copy = el('button', 'dbg-btn', 'copy JSON');
  copy.onclick = () => {
    const out = {};
    for (const key in TUNE) out[key] = Object.assign({}, raw[key], { value: TUNE[key] });
    const text = JSON.stringify(out, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    copy.textContent = 'copied';
    setTimeout(() => { copy.textContent = 'copy JSON'; }, 900);
  };
  panel.appendChild(copy);
  root.appendChild(panel);
}

// info: { sim, stats (gfx.stats), logicMs, objects, level, scale, bot }
export function updateDebug(info, frameMs) {
  if (!panel) return;
  frames++;
  worstMs = Math.max(worstMs, frameMs);
  const now = performance.now();
  if (now - lastT < 250) return;
  fps = frames * 1000 / (now - lastT);
  frames = 0; lastT = now;
  const k = info.sim.player, s = info.stats;
  readout.textContent =
    `${fps.toFixed(0)} fps  frame ${frameMs.toFixed(1)} ms (worst ${worstMs.toFixed(1)})  logic ${info.logicMs.toFixed(2)} ms\n` +
    `draw calls ${s.calls}  triangles ${s.tris}  objects ${info.objects}\n` +
    `level ${info.level}  t ${info.sim.t.toFixed(1)} / ${info.sim.timer}  phase ${info.sim.phase}  x${info.scale}  bot ${info.bot || 'off'}\n` +
    `speed ${k.spd.toFixed(1)} m/s  yaw ${k.yaw.toFixed(2)}  slip ${(k.slip * 57.3).toFixed(0)} deg  tier ${k.tier}  boost ${k.boostT.toFixed(1)}\n` +
    `dash cd ${Math.max(0, k.dashCd).toFixed(1)}  load ${k.load}  stun ${Math.max(0, k.stunT).toFixed(1)}  crashes ${info.sim.stats.crashes}`;
  worstMs = 0;
}
