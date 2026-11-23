// DOORBUSTER — meta.js
// Purpose: the screens between runs (DESIGN.md section 8, ART.md section 7), in the receipt's language of paper,
//          price tags and sale plates: the Mall Directory (a map board of store fronts with their medal, best
//          receipt and mode; every store is open, the recommended one pulses; a YOU ARE HERE star), Cart Customs
//          (a catalogue page of price tags round the turntable of the cart and Penny: four upgrades of three
//          tiers, paints and hats, the wallet) and the level intro card (the store's sign, a mode stamp, the
//          rivals' portraits on price tags in a VS layout).
// Exports: showDirectory, showCustoms, showIntro, recommended, MODE_NAME
// Depends on: config.js, cartart.js, atlas.js, cast.js, ui.js (the screen container), audio.js and the DOM.

import { UPGRADES, PAINTS, HATS } from './cartart.js';
import { faceAtlas, faceCell } from './atlas.js';
import { lookOf } from './cast.js';
import { CHARS } from './config.js';
import { ui, money, hideScreens } from './ui.js';
import { audioCue } from './audio.js';

export const MODE_NAME = { rush: 'RUSH', smash: 'SMASH', list: 'LIST', race: 'RACE' };
const MODE_LINE = { rush: 'grab the most, beat the clock', smash: 'smash it all', list: 'get the list', race: 'beat Turbo Gramps' };
const MEDAL_NAME = ['NEW', 'BRONZE', 'SILVER', 'GOLD', 'BLACK CARD'];
const HOT_NAME = { cheese: 'GIANT CHEESE', goldcan: 'GOLD CANS', gigatv: 'GIGA TV', handbag: 'GOLDEN HANDBAG', trophy: 'CHAMPION TROPHY', cake: 'TRIPLE CAKE', octopus: 'MEGA OCTOPUS', toaster: 'DIAMOND TOASTER' };
function mel(tag, cls, text, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function mbtn(cls, text, parent, fn) { const b = mel('button', cls, text, parent); b.onclick = (e) => { e.stopPropagation(); audioCue('click'); fn(); }; return b; }

// The store to play next: the first one never finished, else the first without gold.
export function recommended(cards) {
  const i = cards.findIndex((c) => !c.medal);
  return i >= 0 ? i : Math.max(0, cards.findIndex((c) => c.medal < 3));
}

// The Mall Directory. cards: [{ name, mode, medal, best, pal: [a, b, c, d] }] in campaign order; onPick(i) plays a
// store, onCustoms opens Cart Customs, wallet is the money to spend.
export function showDirectory(cards, wallet, onPick, onCustoms, onBack) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen directory on';
  const board = mel('div', 'board', undefined, ui.screen), rec = recommended(cards);
  const head = mel('div', 'board-head', undefined, board);
  mel('span', 'mplate', 'MALL DIRECTORY', head);
  mel('span', 'wallet', 'WALLET ' + money(wallet), head);
  const mall = mel('div', 'mall', undefined, board), rows = [mel('div', 'shops', undefined, mall), mel('div', 'concourse', undefined, mall), mel('div', 'shops', undefined, mall)];
  mel('span', 'here', '★ YOU ARE HERE', rows[1]);
  const half = Math.ceil(cards.length / 2);
  for (const r of [rows[0], rows[2]]) r.style.setProperty('--n', half);
  cards.forEach((c, i) => {
    const f = mbtn('front' + (i === rec ? ' rec' : ''), '', rows[i < half ? 0 : 2], () => onPick(i));
    f.style.setProperty('--a', c.pal[1]); f.style.setProperty('--c', c.pal[2]);
    mel('span', 'awning', undefined, f);
    mel('span', 'unit', 'UNIT ' + (i + 1), f);
    mel('b', 'sname', c.name, f);
    mel('span', 'mode', MODE_NAME[c.mode] || 'RUSH', f);
    mel('span', 'medal m' + c.medal, MEDAL_NAME[c.medal] || 'NEW', f);
    mel('span', 'sbest', c.best ? money(c.best) : 'not yet shopped', f);
    const win = mel('span', 'window', undefined, f); win.style.setProperty('--f', c.pal[0]); mel('b', '', HOT_NAME[c.hot] || 'HOT DEALS', win);
    if (i === rec) mel('span', 'next', 'NEXT!', f);
  });
  const row = mel('div', 'btn-row', undefined, ui.screen);
  mbtn('btn', 'CART CUSTOMS', row, onCustoms);
  mbtn('btn go', 'PLAY ' + cards[rec].name, row, () => onPick(rec));
  if (onBack) mbtn('btn small', 'BACK', row, onBack);
}

// Cart Customs. st = { wallet, up: { wheels, ... } (tiers 0-3), paints: [owned ids], paint, hats: [owned ids], hat };
// buy(kind, id) and equip(kind, id) change it (main.js saves and rebuilds the turntable); the page redraws itself.
export function showCustoms(st, buy, equip, onDone) {
  hideScreens();
  ui.hud.classList.add('off');
  ui.screen.className = 'screen customs on';
  const draw = () => {
    ui.screen.textContent = '';
    const head = mel('div', 'cat-head', undefined, ui.screen);
    mel('span', 'mplate', 'CART CUSTOMS', head);
    mel('span', 'wallet', 'WALLET ' + money(st.wallet), head);
    const cat = mel('div', 'cat', undefined, ui.screen), left = mel('div', 'col', undefined, cat);
    mel('div', 'stage', undefined, cat);
    const right = mel('div', 'col', undefined, cat);
    mel('div', 'col-head', 'UPGRADES', left);
    for (const id of Object.keys(UPGRADES)) {
      const u = UPGRADES[id], have = st.up[id] || 0, r = mel('div', 'uprow', undefined, left);
      mel('b', 'uname', u.name, r);
      u.tiers.forEach((tn, i) => {
        const owned = i < have, nextOne = i === have, can = nextOne && st.wallet >= u.price[i];
        const tag = mbtn('tag' + (owned ? ' owned' : nextOne ? (can ? ' can' : ' short') : ' later'), '', r, () => { if (can) { buy('up', id); draw(); } });
        mel('span', 'tname', tn, tag);
        mel('span', 'tprice', owned ? 'OWNED' : money(u.price[i]), tag);
      });
    }
    mel('div', 'col-head', 'PAINT', right);
    const sw = mel('div', 'swatches', undefined, right);
    for (const [id, p] of Object.entries(PAINTS)) {
      const owned = st.paints.includes(id), on = st.paint === id, can = !owned && st.wallet >= p.price;
      const b = mbtn('swatch' + (on ? ' on' : '') + (owned ? ' owned' : can ? ' can' : ' short'), '', sw, () => { if (owned) equip('paint', id); else if (can) buy('paint', id); draw(); });
      b.style.setProperty('--p', '#' + p.body.toString(16).padStart(6, '0')); b.style.setProperty('--r', '#' + p.rim.toString(16).padStart(6, '0'));
      mel('span', 'dot', undefined, b);
      mel('span', 'pname', p.name, b);
      mel('span', 'tprice', owned ? (on ? 'ON' : 'OWNED') : money(p.price), b);
    }
    mel('div', 'col-head', 'HATS', right);
    const hw = mel('div', 'hats', undefined, right);
    for (const h of HATS) {
      const owned = st.hats.includes(h.id), on = st.hat === h.id, can = !owned && st.wallet >= h.price;
      const b = mbtn('chip' + (on ? ' on' : '') + (owned ? ' owned' : can ? ' can' : ' short'), '', hw, () => { if (owned) equip('hat', h.id); else if (can) buy('hat', h.id); draw(); });
      mel('span', 'pname', h.name, b);
      mel('span', 'tprice', owned ? (on ? 'ON' : 'OWNED') : money(h.price), b);
    }
    const row = mel('div', 'btn-row', undefined, ui.screen);
    mbtn('btn go', 'DONE', row, onDone);
  };
  draw();
}

// A character's portrait: a rendered head from shot(id) when there is one, else its face cell from the face atlas.
function portrait(charId, size, shot) {
  const cv = mel('canvas', 'face'), g = cv.getContext('2d'), live = shot && shot(charId);
  cv.width = cv.height = size;
  if (live) { g.drawImage(live, 0, 0, size, size); return cv; }
  const tex = faceAtlas(), src = tex && tex.image, [u, v] = faceCell(lookOf(charId).face.row, 1);
  if (src) g.drawImage(src, u * src.width, v * src.height, src.width / 8, src.height / 8, 0, 0, size, size);
  return cv;
}
// The level intro card: the store's sign, the mode stamp, YOU against the rivals on price tags. It slides in at
// the top while the countdown runs and leaves by itself.
export function showIntro(def, pal, rivals, layer, shot) {
  for (const old of layer.querySelectorAll('.intro')) old.remove();
  const card = mel('div', 'intro', undefined, layer);
  card.style.setProperty('--a', pal[1]); card.style.setProperty('--c', pal[2]);
  const sign = mel('div', 'isign', undefined, card);
  mel('b', '', def.name, sign);
  mel('span', '', MODE_LINE[def.mode] || MODE_LINE.rush, sign);
  mel('div', 'istamp', MODE_NAME[def.mode] || 'RUSH', card);
  const vs = mel('div', 'ivs', undefined, card), tag = (id, name, me) => { const t = mel('div', 'itag' + (me ? ' me' : ''), undefined, vs); t.appendChild(portrait(id, 96, shot)); mel('span', '', name, t); };
  tag('penny', 'YOU', true);
  mel('b', 'vsword', 'VS', vs);
  for (const r of rivals) tag(r, (CHARS[r] || { name: r }).name, false);
  card.addEventListener('animationend', (e) => { if (e.animationName === 'introOut') card.remove(); });
  return card;
}
