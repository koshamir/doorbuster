// DOORBUSTER — ui.js
// Purpose: the HTML interface above the canvas: the in-run screen (timer, receipt total and place,
//          the Madness meter, shopping-list icons, announcer line, pop-up words, floating prices, an
//          arrow to the current event, the ram warning, key hints, countdown), touch controls, the
//          title with the loyalty card, receipt, "store closed" and pause screens, and the debug
//          panel (?debug=1). It only shows state; decisions stay in main.js.
// Exports: initUI, ui, money, updateHud, popWord, announce, floatText, sticker, updateStickers, bubble, emote, chainText, setList, setArrow, setWarn,
//          setHint, showTouch, showTitle, showReceipt, showClosed, showPause, hideScreens, hurryUI,
//          initDebug, updateDebug
// Depends on: config.js, audio.js (interface sounds). Browser only. All styles live in index.html.

import { TUNE } from './config.js';
import { audioCue } from './audio.js';

export const ui = { root: null, hud: null, timer: null, total: null, pop: null, count: null, chain: null, floats: [], screen: null,
  popT: 0, popQ: [], popKind: '', tally: null, meter: null, segs: [], mult: null, place: null, list: [], news: null, newsT: 0, arrow: null, warn: null,
  hint: null, hintKey: '', touch: null, em: 16, onPause: null, stickers: [], bubbles: [], emotes: [] };

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function button(cls, text, parent, fn) {
  const b = el('button', cls, text, parent);
  b.onclick = () => { audioCue('click'); b.blur(); fn(); };
  return b;
}
export function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'); }
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
const MEDAL = ['', 'BRONZE', 'SILVER', 'GOLD', 'BLACK CARD'];

export function initUI(root) {
  ui.root = root;
  ui.hud = el('div', 'hud', undefined, root);
  const t = el('div', 'plate hud-timer', undefined, ui.hud);
  el('span', 'lbl', 'DOORS LOCK IN', t);
  ui.timer = el('b', '', '0:00', t);
  const r = el('div', 'tag hud-total', undefined, ui.hud);
  el('span', 'lbl', 'RECEIPT', r);
  ui.total = el('b', '', '$0', r);
  ui.place = el('div', 'place', '', ui.hud);
  button('pausebtn', 'II', ui.hud, () => { if (ui.onPause) ui.onPause(); });
  ui.meter = el('div', 'meter', undefined, ui.hud);
  el('span', 'lbl', 'MADNESS', ui.meter);
  for (let i = 0; i < 5; i++) ui.segs.push(el('i', '', undefined, el('div', i < 4 ? 'seg' : 'seg last', undefined, ui.meter)));
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
  ui.hint = el('div', 'hint-keys', undefined, ui.hud);
  ui.chain = el('div', 'float chain', '', ui.hud);
  for (let i = 0; i < 14; i++) ui.floats.push({ e: el('div', 'float', '', ui.hud), t: 0, x: 0, y: 0 });
  for (let i = 0; i < 3; i++) { const e = el('canvas', 'sticker', undefined, ui.hud); e.width = 300; e.height = 190; ui.stickers.push({ e, t: 9, x: 0, y: 0, z: 0, word: '' }); }
  for (let i = 0; i < 2; i++) { const e = el('div', 'bubble', undefined, ui.hud), pop = el('span', 'pop', undefined, e); el('b', '', '', pop); ui.bubbles.push({ e, pop, t: 0, pos: null, hero: false }); }
  for (let i = 0; i < 4; i++) { const e = el('canvas', 'emote', undefined, ui.hud); e.width = e.height = 72; ui.emotes.push({ e, t: 0, pos: null, kind: '' }); }
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
  // Madness: the lit pips are the multiplier (one is always lit), the fifth fills toward MADNESS mode;
  // in the mode the meter is one bar running down.
  const mode = p.madT > 0, mad = mode ? 5 * p.madT / TUNE.madnesstime : 1 + p.mad, q = Math.round(mad * 25);
  if (q !== lastMad) {
    lastMad = q;
    for (let i = 0; i < 5; i++) {
      const fill = Math.max(0, Math.min(1, mad - i));
      ui.segs[i].style.width = fill * 100 + '%';
      ui.segs[i].parentNode.classList.toggle('part', fill < 1 && !mode);      // the pip being filled is paler than the ones that count
    }
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
    if (c && c !== 'GO!') audioCue('count');
  }
  // Pop-up words are shown one at a time; a word that arrives while another is up waits its turn.
  if (ui.popT > 0) {
    ui.popT -= dt;
    if (ui.popQ.length && ui.popT < (ui.popKind === 'hot' ? 0.1 : 0.5)) showPop(ui.popQ.shift());
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

// ---- onomatopoeia stickers (ART.md section 7) -------------------------------------------------------------
// BAM!, CRASH!, BONK!, KA-CHING!... a burst with halftone dots and a thick ink outline, anchored to the spot in
// the world where it happened. It pops in 120 ms and is gone by 0.6 s; at most three are up (the oldest gives way).
const STICK = { bam: ['#FFD23F', '#FF9F1C'], crash: ['#FF5A4E', '#C8323C'], bonk: ['#7CC6FE', '#3A86FF'], kaching: ['#FFE45C', '#E9B949'], splat: ['#8EE3C8', '#2EC4B6'] };
export function sticker(word, kind, x, y, z) {
  let s = ui.stickers[0];
  for (const c of ui.stickers) if (c.t > s.t) s = c;
  s.t = 0; s.x = x; s.y = y; s.z = z;
  if (s.word !== word + kind) { s.word = word + kind; drawSticker(s.e, word, kind); }
}
function drawSticker(cv, word, kind) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, [base, dot] = STICK[kind] || STICK.bam, INK = '#2A1A3A';
  g.clearRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(-0.1);
  const burst = () => { g.beginPath(); for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = (i % 2 ? 0.33 : 0.46) * (0.92 + ((i * 37) % 9) / 60); g.lineTo(Math.cos(a) * r * W, Math.sin(a) * r * H * 1.08); } g.closePath(); };
  burst(); g.fillStyle = base; g.fill();
  g.save(); burst(); g.clip(); g.fillStyle = dot;              // halftone: dots grow toward the lower right
  for (let yy = -H / 2; yy < H / 2; yy += 11) for (let xx = -W / 2; xx < W / 2; xx += 11) {
    const k = (xx / W + yy / H) + 0.35, r = k * 6;
    if (r > 0.6) { g.beginPath(); g.arc(xx + ((yy / 11) & 1 ? 5.5 : 0), yy, Math.min(r, 5.5), 0, 7); g.fill(); }
  }
  g.restore();
  burst(); g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke();
  let size = 76; const font = () => { g.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; };
  font(); while (g.measureText(word).width > W * 0.74 && size > 28) { size -= 3; font(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.fillStyle = INK; g.fillText(word, 5, 8);
  g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(word, 0, 2);
  g.fillStyle = '#FFFFFF'; g.fillText(word, 0, 2);
  g.restore();
}
// ---- speech bubbles and emotes (ART.md section 7) ------------------------------------------------------------
// A bubble follows its speaker (pos() gives the world point above the head) for 1.6 s. Two at most: the hero's
// line takes the place of the oldest other one; anyone else waits for a free one.
let tilt = 0;
export function bubble(text, pos, hero) {
  let s = ui.bubbles.find((b) => b.t <= 0);
  if (!s && hero) { for (const b of ui.bubbles) if (!b.hero && (!s || b.t < s.t)) s = b; }
  if (!s) return false;
  s.t = 1.6; s.pos = pos; s.hero = hero;
  s.pop.firstChild.textContent = text;
  s.e.style.setProperty('--tilt', (tilt++ % 2 ? 2.5 : -2.5) + 'deg');
  s.e.classList.remove('in'); void s.e.offsetWidth; s.e.classList.add('in');
  return true;
}
// An emote over a head for a second: 'vein' (anger), 'sweat', 'heart', 'bang' (!), 'what' (?).
export function emote(kind, pos) {
  let s = ui.emotes[0];
  for (const c of ui.emotes) if (c.t < s.t) s = c;
  s.t = 1; s.pos = pos;
  if (s.kind !== kind) { s.kind = kind; drawEmote(s.e, kind); }
}
function drawEmote(cv, kind) {
  const g = cv.getContext('2d'), INK = '#2A1A3A';
  g.clearRect(0, 0, 72, 72); g.lineJoin = 'round'; g.lineCap = 'round';
  if (kind === 'vein') {
    g.strokeStyle = INK; g.lineWidth = 13;
    const arcs = () => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(36 + Math.cos(a) * 15, 36 + Math.sin(a) * 15, 11, a + 2.2, a + 4.1); g.stroke(); } };
    arcs(); g.strokeStyle = '#E63946'; g.lineWidth = 7; arcs();
  } else if (kind === 'sweat') {
    g.beginPath(); g.moveTo(36, 8); g.quadraticCurveTo(60, 42, 50, 54); g.arc(36, 50, 15, 0.3, Math.PI - 0.3); g.quadraticCurveTo(12, 42, 36, 8); g.closePath();
    g.fillStyle = '#7CC6FE'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(30, 44, 4, 7, -0.4, 0, 7); g.fill();
  } else if (kind === 'heart') {
    g.beginPath(); g.moveTo(36, 62); g.bezierCurveTo(4, 40, 10, 8, 36, 22); g.bezierCurveTo(62, 8, 68, 40, 36, 62); g.closePath();
    g.fillStyle = '#FF4FA3'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(24, 26, 5, 8, -0.6, 0, 7); g.fill();
  } else {
    g.fillStyle = kind === 'bang' ? '#FFD23F' : '#FFFFFF'; g.beginPath(); g.arc(36, 36, 27, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = INK; g.font = '900 40px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind === 'bang' ? '!' : '?', 36, 38);
  }
}
function updateTalk(dt, project) {
  for (const s of ui.bubbles) {
    if (s.t <= 0) continue;
    s.t -= dt;
    const [x, y, z] = s.pos(), p = project(x, y, z);
    if (s.t <= 0 || p.z > 1) { s.e.classList.remove('in'); s.t = Math.min(s.t, 0); continue; }
    // kept on screen: a speaker beyond the edge talks from the edge
    const bx = Math.max(innerWidth * 0.09, Math.min(innerWidth * 0.91, p.x)), by = Math.max(innerHeight * 0.2, Math.min(innerHeight * 0.95, p.y));
    s.e.style.transform = 'translate(' + bx.toFixed(0) + 'px, ' + by.toFixed(0) + 'px)';
    s.e.style.opacity = s.t < 0.2 ? (s.t / 0.2).toFixed(2) : '';
  }
  for (const s of ui.emotes) {
    if (s.t <= 0) continue;
    s.t -= dt;
    const [x, y, z] = s.pos(), p = project(x, y, z), age = 1 - s.t, sc = age < 0.1 ? 0.4 + age * 7 : 1.1 - Math.min(0.1, (age - 0.1) * 0.5);
    s.e.style.opacity = s.t <= 0 || p.z > 1 ? 0 : (s.t < 0.25 ? s.t / 0.25 : 1).toFixed(2);
    s.e.style.transform = 'translate(' + (p.x + 26).toFixed(0) + 'px, ' + (p.y - 18 - age * 18).toFixed(0) + 'px) scale(' + sc.toFixed(2) + ')';
  }
}

// Called every frame with a world-to-screen function (returns { x, y, z }, z > 1 behind the camera).
export function updateStickers(dt, project) {
  updateTalk(dt, project);
  for (const s of ui.stickers) {
    if (s.t >= 0.6) continue;
    s.t += dt;
    const p = project(s.x, s.y, s.z), t = s.t;
    if (t >= 0.6 || p.z > 1) { s.e.style.opacity = 0; continue; }
    const sc = t < 0.08 ? 0.35 + t / 0.08 * 0.95 : t < 0.14 ? 1.3 - (t - 0.08) / 0.06 * 0.3 : 1 + (t - 0.14) * 0.25;
    s.e.style.opacity = (t < 0.36 ? 1 : 1 - (t - 0.36) / 0.24).toFixed(2);
    s.e.style.transform = 'translate(' + p.x.toFixed(0) + 'px, ' + (p.y - t * 50).toFixed(0) + 'px) scale(' + sc.toFixed(3) + ')';
  }
}

function showPop([text, kind]) {
  ui.pop.textContent = text;
  ui.pop.className = 'hud-pop ' + (kind || '');
  void ui.pop.offsetWidth;
  ui.pop.classList.add('in');
  ui.popT = 1.0; ui.popKind = kind;
}
// One big word on a sale plate (CLEAN SWEEP, HEAVY ...). kind picks the colour: good, bad, hot. A
// word waits while another is up: half a second, or the whole second of a headline (kind hot).
export function popWord(text, kind) {
  if (ui.popT > (ui.popKind === 'hot' ? 0.1 : 0.5)) { if (ui.popQ.length < 3) ui.popQ.push([text, kind]); } else showPop([text, kind]);
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
// Teaching without text: key caps beside the cart (keys = ['A', 'D'] ...), or nothing (null).
export function setHint(keys, x, y) {
  const key = keys ? keys.join(' ') : '';
  if (key !== ui.hintKey) {
    ui.hintKey = key;
    ui.hint.textContent = '';
    for (const k of keys || []) el('b', k.length > 2 ? 'wide' : '', k, ui.hint);
    ui.hint.classList.toggle('in', !!keys);
  }
  if (keys) ui.hint.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
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
// together (in place and in time) are stacked a line apart instead of on top of each other.
export function floatText(text, x, y, kind) {
  let f = ui.floats[0];
  for (const c of ui.floats) if (c.t < f.t) f = c;
  // below any label already rising at this spot, so they never run into each other (two passes settle a stack of three)
  for (let pass = 0; pass < 2; pass++) for (const c of ui.floats) {
    if (c !== f && c.t > 0.25 && Math.abs(c.x - x) < ui.em * 7 && Math.abs(c.y - y) < ui.em * 1.7) y = c.y + ui.em * 1.7;
  }
  f.t = 0.9; f.x = x; f.y = y;
  f.e.textContent = text;
  f.e.className = 'float in ' + (kind || '');
  f.e.style.transform = `translate(${f.x.toFixed(0)}px, ${f.y.toFixed(0)}px)`;
}

// Touch controls: steering under the left thumb, dash, drift and brake under the right; the
// accelerator is automatic. press(name, down) receives the same names as the keyboard.
export function showTouch(press) {
  if (ui.touch) return;
  ui.root.classList.add('touching');                   // a finger needs a bigger pause button
  ui.touch = el('div', 'touch', undefined, ui.root);
  for (const [name, text, cls] of [['left', '◀', 'l1'], ['right', '▶', 'l2'], ['brake', 'BRAKE', 'r3'], ['drift', 'DRIFT', 'r2'], ['dash', 'DASH', 'r1']]) {
    const b = el('div', 'pad ' + cls, text, ui.touch);
    const set = (down) => (e) => { e.preventDefault(); b.classList.toggle('on', down); press(name, down); };
    b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that cannot be captured still presses */ } set(true)(e); });
    b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false));
  }
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

// The first thing a player sees: the name and one button; the cart stays visible in the middle.
// cards (optional, once the first level has been finished) is the loyalty card: one stamp per level
// [{ name, medal 0-4, best, locked, on }], and pick(index) chooses a level.
export function showTitle(levelName, onStart, cards, pick) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen title on';
  const top = el('div', '', undefined, ui.screen);
  el('div', 'logo', 'DOORBUSTER', top);
  el('div', 'sub', 'BLACK FRIDAY · ' + levelName, top);
  const low = el('div', '', undefined, ui.screen);
  if (cards) {
    const card = el('div', 'card', undefined, low);
    cards.forEach((c, i) => {
      const b = button('stampbox' + (c.on ? ' on' : '') + (c.locked ? ' locked' : ''), '', card, () => { if (!c.locked) pick(i); });
      el('span', 'lbl', (i + 1) + ' · ' + c.name, b);
      el('b', 'medal m' + c.medal, c.locked ? 'LOCKED' : MEDAL[c.medal] || 'NEW', b);
      el('span', '', c.best ? money(c.best) : ' ', b);
    });
  }
  button('btn big', 'START', low, onStart);
  el('div', 'hint', navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches ? 'Steer with the left thumb · DASH and DRIFT under the right · the cart rolls by itself'
    : 'Arrows or WASD to drive · Space to drift · Shift to dash · P to pause', low);
}

// The receipt: lines print one by one, then the total, the medal, the final table and the record.
// rc = the player's receipt; tableOf() returns [{ name, total, me }] best first and is called only
// when the table is due (main.js plays the rest of the race out at that moment); best = { value, isNew };
// medal 1-4; onNext is absent on the last level; onMenu (optional) goes back to the loyalty card;
// goal (optional) = { medal, at }: the next medal and the receipt it takes.
export function showReceipt(rc, tableOf, best, storeName, medal, onRetry, onNext, onMenu, goal) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen receipt on';
  const paper = el('div', 'paper', undefined, ui.screen);
  el('div', 'paper-head', storeName, paper);
  el('div', 'paper-sub', 'thank you for the chaos', paper);
  const steps = [];
  let n = 0;
  const line = (name, value, cls) => {
    const row = el('div', 'line ' + (cls || ''), undefined, paper);
    el('span', '', name, row);
    const out = el('b', '', '', row), k = n++;
    steps.push(() => { row.classList.add('in'); out.textContent = value; audioCue(cls === 'total' ? 'kaching' : 'scan', k); });
    return row;
  };
  // the lines of the mode (DESIGN.md section 2): RUSH items, stunts, time; SMASH adds the smash money
  line('ITEMS x' + rc.count, money(rc.items));
  if (rc.mode === 'smash') line('SMASH', money(rc.smash));
  if (rc.list) line('LIST', money(rc.list));
  line('STUNTS', money(rc.stunts));
  line('TIME ' + rc.left + ' s', money(rc.time));
  const total = line('TOTAL', money(rc.total), 'total');
  const row = el('div', 'btn-row', undefined, ui.screen);
  const again = button('btn', 'RETRY  (R)', row, onRetry), next = onNext ? button('btn go', 'NEXT  (Enter)', row, onNext) : null, menu = onMenu ? button('btn', 'STORES', row, onMenu) : null;
  steps.push(() => { el('div', 'stamp m' + medal, MEDAL[medal], total); audioCue('stamp'); });
  steps.push(() => {
    tableOf().forEach((r, i) => line((i + 1) + '. ' + r.name, r.total < 0 ? 'still shopping' : money(r.total), 'rank' + (r.me ? ' me' : '')));
    const bestRow = line('BEST', money(best.value), 'rank best');
    if (goal) line(MEDAL[goal.medal] + ' AT', money(goal.at), 'rank next');       // what the next medal takes
    steps.push(() => {
      if (best.isNew) el('div', 'stamp new', 'NEW BEST!', bestRow);
      if (!onNext) el('div', 'paper-sub end', 'that was the last store. thank you for shopping!', paper);
      for (const b of [again, next, menu]) if (b) b.classList.add('in');
    });
  });
  ui.tally = { steps, i: 0, t: 0.2, fast: false };
  paper.onclick = hurryUI;
}

// Time ran out. After three failures in a row onSkip is offered, so nobody is locked out of the rest.
export function showClosed(onRetry, onSkip) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen closed on';
  el('div', 'logo small', 'STORE CLOSED', ui.screen);
  el('div', 'sub', 'No receipt today. The doors open again in a second.', ui.screen);
  const row = el('div', 'btn-row', undefined, ui.screen);
  button('btn in', 'RETRY  (R)', row, onRetry);
  if (onSkip) button('btn in', 'SKIP THIS STORE', row, onSkip);
}

// The pause screen with the settings. s = { sound, music, sfx, shake }; on = { resume, restart, menu,
// sound(on), music(v), sfx(v), shake(on) }.
export function showPause(s, on) {
  hideScreens();
  ui.screen.className = 'screen pause on';
  el('div', 'logo small', 'PAUSED', ui.screen);
  const box = el('div', 'panel', undefined, ui.screen);
  const toggle = (label, value, fn) => { const b = button('btn small' + (value ? ' go' : ''), label + (value ? ': ON' : ': OFF'), box, () => { value = !value; b.textContent = label + (value ? ': ON' : ': OFF'); b.classList.toggle('go', value); fn(value); }); };
  const slider = (label, value, fn) => {
    const l = el('label', 'slide', label, box), i = el('input', '', undefined, l);
    i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = value;
    i.oninput = () => fn(Number(i.value));
  };
  toggle('SOUND', s.sound, on.sound);
  slider('MUSIC', s.music, on.music);
  slider('EFFECTS', s.sfx, on.sfx);
  toggle('SCREEN SHAKE', s.shake, on.shake);
  toggle('IMPACT FLASH', s.impact, on.impact);
  const row = el('div', 'btn-row', undefined, ui.screen);
  button('btn in go', 'RESUME  (P)', row, on.resume);
  button('btn in', 'RESTART  (R)', row, on.restart);
  if (on.menu) button('btn in', 'STORES', row, on.menu);
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

// info: { sim, stats (R.stats), logicMs, objects, level, scale, bot }
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
