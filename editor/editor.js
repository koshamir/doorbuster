// DOORBUSTER level editor — editor.js
// Purpose: the editor itself: the level being edited (a universal level, editor/format.js), the tools (select,
//          brush, rectangle, fill, pick, place), the palette, the inspector (level settings, the selection, zones,
//          the check with bot runs), undo and redo, the autosave, opening and exporting files, the test drive in
//          the real game (index.html?custom=1) and the help.
// Exports: nothing (the page's module).
// Depends on: catalog.js, format.js, check.js, view.js, ../src/levels.js; simworker.js runs the bots.

import { TILES, TILE_BY_CH, TILE_GROUPS, OBJECTS, OBJECT_GROUPS, STORES, MODES, RIVALS, GOODS_INFO, POOLS_INFO, SURFACES } from './catalog.js';
import { defToUniversal, normalize, universalToDef, finish, pretty, defToJs, levelComments, newLevel } from './format.js';
import { checkLevel } from './check.js';
import { drawLevel, drawTileIcon, drawObjectIcon, objectAt, handleAt, objBox, RIVAL_COLORS } from './view.js';
import { LEVELS } from '../src/levels.js';

const $ = (id) => document.getElementById(id);
const copy = (v) => JSON.parse(JSON.stringify(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DOC_KEY = 'doorbuster_editor_doc', PREV_KEY = 'doorbuster_editor_prev', PREF_KEY = 'doorbuster_editor_prefs', PLAY_KEY = 'doorbuster_custom';
const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } } };

const S = {
  u: null, rows: [],                     // the universal level; its map as arrays of characters (u.map follows on sync)
  tool: 'brush', tile: '.', size: 1, place: null,
  sel: null, hover: null, ghost: null, drag: null, stamp: null, pick: null, space: false,
  view: { ox: 40, oy: 30, s: 24 }, fitted: false,
  layers: { grid: true, coords: true, zones: true, objects: true, route: true },
  check: null, runs: [], running: false,
  recent: ['t:.', 't: ', 't:S', 't:o', 't:c', 'o:swinging_sign'],
  tab: 'level', glossary: true, seed: 1,
  hist: [], at: -1, dirty: true,
};
Object.assign(S, (({ layers, recent, glossary, tab }) => ({ layers: layers || S.layers, recent: recent || S.recent, glossary: glossary ?? true, tab: tab || 'level' }))(store.get(PREF_KEY) || {}));
const prefs = () => store.set(PREF_KEY, { layers: S.layers, recent: S.recent, glossary: S.glossary, tab: S.tab });

// ---- the level ------------------------------------------------------------------------------------------------
const W = () => S.rows[0] ? S.rows[0].length : 0, H = () => S.rows.length;
const at = (x, y) => (S.rows[y] || [])[x] ?? ' ';
function sync() { S.u.map = S.rows.map((r) => r.join('')); S.u.grid = { width: W(), height: H(), tile_m: 2 }; }
function load(u, why) {
  if (S.u) { sync(); store.set(PREV_KEY, S.u); }            // the level being replaced stays one step away (Open → the level before)
  S.u = u; S.rows = u.map.map((r) => r.split(''));
  sync(); S.sel = null; S.stamp = null; S.pick = null; S.runs = [];
  S.hist = [JSON.stringify(S.u)]; S.at = 0;
  fit(); recheck(true); renderPanel(); refreshTop(); save();
  if (why) toast(why);
}
let saveT = 0, checkT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { sync(); store.set(DOC_KEY, S.u); }, 400); }
function commit() {
  sync();
  const snap = JSON.stringify(S.u);
  if (snap === S.hist[S.at]) return;
  S.hist.length = S.at + 1; S.hist.push(snap);
  if (S.hist.length > 400) S.hist.shift();
  S.at = S.hist.length - 1;
  save(); recheck(); refreshTop(); S.dirty = true;
}
function restore(snap) {
  S.u = JSON.parse(snap); S.rows = S.u.map.map((r) => r.split(''));
  if (S.sel && S.sel.kind === 'object' && !S.u.objects[S.sel.i]) S.sel = null;
  if (S.sel && S.sel.kind === 'zone' && !S.u.zones[S.sel.i]) S.sel = null;
  save(); recheck(); renderPanel(); refreshTop(); S.dirty = true;
}
function undo() { if (S.at > 0) { S.at--; restore(S.hist[S.at]); toast('Undo'); } }
function redo() { if (S.at < S.hist.length - 1) { S.at++; restore(S.hist[S.at]); toast('Redo'); } }
function recheck(now) {
  clearTimeout(checkT);
  const run = () => {
    sync();
    try { S.check = checkLevel(S.u); } catch (e) { S.check = { errors: [{ msg: 'The check failed: ' + e.message }], warnings: [], notes: [], route: [], lost: [], ramps: [] }; }
    S.dirty = true; status(); badge();
    if (S.tab === 'check') renderPanel();
  };
  if (now) run(); else checkT = setTimeout(run, 220);
}

// ---- the canvas -----------------------------------------------------------------------------------------------
const cv = $('cv'), ctx = cv.getContext('2d');
let CW = 0, CH = 0;
function resize() {
  const r = $('stage').getBoundingClientRect(), d = window.devicePixelRatio || 1;
  CW = r.width; CH = r.height; cv.width = Math.round(CW * d); cv.height = Math.round(CH * d);
  ctx.setTransform(d, 0, 0, d, 0, 0); S.dirty = true;
}
function frame() {
  requestAnimationFrame(frame);
  if (!S.dirty || !S.u) return;
  S.dirty = false;
  drawLevel(ctx, CW, CH, { rows: S.rows, level: S.u.level, zones: S.u.zones, objects: S.u.objects, rampDirs: S.u.ramp_directions, ramps: S.check && S.check.ramps,
    route: S.check && S.check.route, lost: S.check && S.check.lost, check: S.check, view: S.view, layers: S.layers, sel: S.sel, ghost: S.ghost,
    hover: S.hover && { x: S.hover.x, y: S.hover.y, size: ['brush'].includes(S.tool) ? S.size : 1 } });
}
function fit() {
  if (!CW) resize();
  const s = clamp(Math.floor(Math.min((CW - 70) / Math.max(1, W()), (CH - 60) / Math.max(1, H()))), 5, 48);
  S.view = { s, ox: Math.round((CW - W() * s) / 2 + 10), oy: Math.round((CH - H() * s) / 2 + 8) }; S.dirty = true; status();
}
function zoom(f, px = CW / 2, py = CH / 2) {
  const s = clamp(S.view.s * f, 4, 110), k = s / S.view.s;
  S.view = { s, ox: px - (px - S.view.ox) * k, oy: py - (py - S.view.oy) * k }; S.dirty = true; status();
}
function tileAt(e) {
  const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const fx = (px - S.view.ox) / S.view.s, fy = (py - S.view.oy) / S.view.s;
  return { px, py, fx, fy, x: Math.floor(fx), y: Math.floor(fy) };
}
function centreOn(x, y) { S.view.ox = CW / 2 - (x + 0.5) * S.view.s; S.view.oy = CH / 2 - (y + 0.5) * S.view.s; if (S.view.s < 18) zoom(22 / S.view.s); S.dirty = true; }

// ---- tiles ------------------------------------------------------------------------------------------------------
function setTile(x, y, ch) {
  if (x < 0 || y < 0 || x >= W() || y >= H()) return false;
  if (S.rows[y][x] === ch) return false;
  if (ch === '@') for (const r of S.rows) for (let i = 0; i < r.length; i++) if (r[i] === '@') r[i] = '.';    // one start: painting it moves it
  S.rows[y][x] = ch; return true;
}
function brushAt(x, y, ch) {
  const n = ch === '@' ? 1 : S.size, o = Math.floor((n - 1) / 2);
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) setTile(x + dx - o, y + dy - o, ch);
  S.dirty = true;
}
function line(x0, y0, x1, y1, fn) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function fillRect(x0, y0, x1, y1, ch) {
  const [a, b, c, d] = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
  if (ch === '@') { setTile(c, d, ch); return; }
  for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) setTile(x, y, ch);
}
function flood(x, y, ch) {
  const from = at(x, y);
  if (from === ch || x < 0 || y < 0 || x >= W() || y >= H()) return 0;
  if (ch === '@') { setTile(x, y, ch); return 1; }
  const st = [[x, y]]; let n = 0;
  while (st.length && n < 40000) {
    const [cx, cy] = st.pop();
    if (at(cx, cy) !== from || cx < 0 || cy < 0 || cx >= W() || cy >= H()) continue;
    S.rows[cy][cx] = ch; n++;
    st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return n;
}
// Adds (or with a negative count removes) rows and columns on each side; everything placed moves with the map.
function resizeMap(l, t, r, b) {
  const w = W() + l + r, h = H() + t + b;
  if (w < 3 || h < 3 || w > 220 || h > 220) { toast('The map must stay between 3 and 220 tiles a side.'); return; }
  const rows = [];
  for (let y = 0; y < h; y++) { const row = []; for (let x = 0; x < w; x++) row.push(at(x - l, y - t)); rows.push(row); }
  S.rows = rows;
  shiftAll(l, t);
  commit(); if (S.fitted) fit(); renderPanel();
}
function shiftAll(dx, dy) {
  for (const o of S.u.objects) moveObject(o, dx, dy);
  for (const z of S.u.zones) if (z.w) { z.x += dx; z.y += dy; }
  for (const a of Object.values(S.u.level.rival_roam || {})) { a.x += dx; a.y += dy; }
  for (const d of S.u.ramp_directions || []) { d.x += dx; d.y += dy; }
  for (const m of S.u.test_marks || []) { m.x += dx; m.y += dy; }
}
function cropToContent() {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) if (at(x, y) !== ' ') { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return toast('The map is all wall: nothing to crop to.');
  resizeMap(-(x0 - 1), -(y0 - 1), -(W() - 2 - x1), -(H() - 2 - y1));
  toast('Cropped to the floor plus a one-tile wall border.');
}

// ---- objects ----------------------------------------------------------------------------------------------------
function moveObject(o, dx, dy) {
  o.x = +(o.x + dx).toFixed(3); o.y = +(o.y + dy).toFixed(3);
  if (Array.isArray(o.waypoints)) o.waypoints = o.waypoints.map(([x, y]) => [+(x + dx).toFixed(3), +(y + dy).toFixed(3)]);
  if (Array.isArray(o.mount)) o.mount = [+(o.mount[0] + dx).toFixed(3), +(o.mount[1] + dy).toFixed(3)];
}
const gateIds = () => S.u.objects.filter((o) => o.type === 'gate' && o.id).map((o) => o.id);
function uniqueId(base) { const ids = new Set(gateIds()); if (!ids.has(base)) return base; let n = 2; while (ids.has(base + n)) n++; return base + n; }
function makeObject(type, x, y, w = 1, h = 1) {
  const spec = OBJECTS[type], o = { type, x, y };
  if (spec.shape === 'area') { o.w = w; o.h = h; }
  for (const f of spec.fields) o[f.key] = f.type === 'point' ? [x, y] : copy(f.def);
  const inside = (p) => [clamp(p[0], 1, W() - 2), clamp(p[1], 1, H() - 2)];
  if (spec.kind === 'patrol') o.waypoints = type === 'robot_vacuum' ? [[x + 3, y], [x + 3, y + 3], [x, y + 3]].map(inside) : [inside([x + 4, y])];
  if (type === 'gate') o.id = uniqueId('gate');
  if (type === 'boxing_glove') o.mount = [x - 1, y];
  if (type === 'floor_button' || type === 'hidden_plate') { const ids = gateIds(); o.opens = ids.length ? [ids[ids.length - 1]] : []; }
  return o;
}
// Objects inside a tile rectangle (point objects by the tile they stand on, areas when wholly inside).
function objectsIn(x0, y0, x1, y1) {
  const out = [];
  S.u.objects.forEach((o, i) => {
    const area = OBJECTS[o.type] && OBJECTS[o.type].shape === 'area';
    const ox = area ? o.x : Math.floor(o.x + 0.5), oy = area ? o.y : Math.floor(o.y + 0.5), ex = area ? o.x + o.w - 1 : ox, ey = area ? o.y + o.h - 1 : oy;
    if (ox >= x0 && oy >= y0 && ex <= x1 && ey <= y1) out.push(i);
  });
  return out;
}
// Adds copies of objects (gate ids made unique, the buttons in the same batch follow their gates).
function addObjects(list) {
  const rename = {};
  for (const o of list) if (o.type === 'gate' && o.id) { const id = uniqueId(o.id); if (id !== o.id) rename[o.id] = id; o.id = id; S.u.objects.push(o); }
  for (const o of list) if (o.type !== 'gate') { if (o.opens) o.opens = o.opens.map((id) => rename[id] || id); S.u.objects.push(o); }
}
function deleteObject(i) { S.u.objects.splice(i, 1); S.sel = null; commit(); renderPanel(); }
function duplicateObject(i) {
  const o = copy(S.u.objects[i]); moveObject(o, 1, 1);
  addObjects([o]); S.sel = { kind: 'object', i: S.u.objects.indexOf(o) }; commit(); renderPanel();
}

// ---- the selection region: copy, cut, paste, move ------------------------------------------------------------------
const region = () => { const s = S.sel; return s && s.kind === 'tiles' ? [Math.min(s.x0, s.x1), Math.min(s.y0, s.y1), Math.max(s.x0, s.x1), Math.max(s.y0, s.y1)] : null; };
function copySel(cut) {
  const r = region();
  if (S.sel && S.sel.kind === 'object') {
    const o = copy(S.u.objects[S.sel.i]); S.clip = { w: 1, h: 1, tiles: null, objects: [o], ox: Math.floor(o.x), oy: Math.floor(o.y) };
    if (cut) deleteObject(S.sel.i);
    toast(cut ? 'Cut the object. Ctrl+V pastes it.' : 'Copied the object. Ctrl+V pastes it.'); return;
  }
  if (!r) return toast('Select tiles (V, then drag) or an object first.');
  const [x0, y0, x1, y1] = r, tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x - x0, y - y0, at(x, y)]);
  const idx = objectsIn(x0, y0, x1, y1);
  S.clip = { w: x1 - x0 + 1, h: y1 - y0 + 1, tiles, objects: idx.map((i) => copy(S.u.objects[i])), ox: x0, oy: y0 };
  if (cut) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setTile(x, y, '.');
    S.u.objects = S.u.objects.filter((o, i) => !idx.includes(i)); commit(); renderPanel();
  }
  toast(`${cut ? 'Cut' : 'Copied'} ${S.clip.w} × ${S.clip.h} tiles${idx.length ? ` and ${idx.length} object${idx.length > 1 ? 's' : ''}` : ''}. Ctrl+V pastes.`);
}
function startPaste() {
  if (!S.clip) return toast('Nothing copied yet.');
  S.stamp = S.clip; S.tool = 'select'; refreshTools(); hint(); toast('Click where the top-left corner goes. Esc cancels.');
}
function stampGhost(x, y) {
  const c = S.stamp, objects = c.objects.map((o) => { const q = copy(o); moveObject(q, x - c.ox, y - c.oy); return q; });
  return { tiles: c.tiles ? c.tiles.map(([dx, dy, ch]) => [x + dx, y + dy, ch]) : null, objects, rect: [x, y, x + c.w, y + c.h] };
}
function applyStamp(x, y) {
  const g = stampGhost(x, y);
  if (g.tiles) for (const [tx, ty, ch] of g.tiles) if (ch !== '@') setTile(tx, ty, ch);
  addObjects(g.objects);
  S.sel = S.stamp.tiles ? { kind: 'tiles', x0: x, y0: y, x1: x + S.stamp.w - 1, y1: y + S.stamp.h - 1 } : { kind: 'object', i: S.u.objects.length - 1 };
  commit(); renderPanel();
}

// ---- palette ----------------------------------------------------------------------------------------------------
const TOOLS = [['select', '⬚', 'Select', 'V'], ['brush', '✎', 'Brush', 'B'], ['rect', '▭', 'Rect', 'R'], ['fill', '◪', 'Fill', 'G'], ['pick', '⊙', 'Pick', 'I']];
function buildTools() {
  const box = $('tools'); box.innerHTML = '';
  for (const [id, icon, name, key] of TOOLS) box.append(h('button', { class: 'tool', 'data-tool': id, title: `${name} (${key})`, onclick: () => setTool(id) }, h('i', null, icon), name, h('kbd', null, key)));
  for (const b of $('sizes').querySelectorAll('button')) b.onclick = () => { S.size = Number(b.dataset.s); refreshTools(); };
  refreshTools();
}
function setTool(t) {
  S.tool = t; S.stamp = null; S.ghost = null;
  if (t !== 'place') S.place = null;
  refreshTools(); hint(); S.dirty = true;
}
function refreshTools() {
  for (const b of $('tools').children) b.classList.toggle('on', b.dataset.tool === S.tool);
  for (const b of $('sizes').querySelectorAll('button')) b.classList.toggle('on', Number(b.dataset.s) === S.size);
  const key = S.tool === 'place' ? 'o:' + S.place : 't:' + S.tile;
  for (const el of document.querySelectorAll('.item, #recent .chip')) el.classList.toggle('on', el.dataset.key === key && (S.tool !== 'select' && S.tool !== 'pick'));
  cv.style.cursor = S.tool === 'select' ? 'default' : S.tool === 'pick' ? 'copy' : 'crosshair';
}
function icon(key, size = 60) {
  const c = h('canvas', { width: size, height: size });
  if (key.startsWith('t:')) drawTileIcon(c, key.slice(2)); else drawObjectIcon(c, key.slice(2));
  return c;
}
const nameOf = (key) => key.startsWith('t:') ? (TILE_BY_CH[key.slice(2)] || {}).label : (OBJECTS[key.slice(2)] || {}).label;
function choose(key) {
  if (key.startsWith('t:')) { S.tile = key.slice(2); if (!['brush', 'rect', 'fill'].includes(S.tool)) S.tool = 'brush'; S.place = null; }
  else { S.place = key.slice(2); S.tool = 'place'; }
  S.recent = [key, ...S.recent.filter((k) => k !== key)].slice(0, 9); prefs();
  S.stamp = null; refreshRecent(); refreshTools(); hint(); S.dirty = true;
}
function buildPalette() {
  const pal = $('palette'), q = $('search').value.trim().toLowerCase(); pal.innerHTML = '';
  const shut = store.get('doorbuster_editor_shut') || {};
  const group = (title, items) => {
    const list = items.filter(([key, label, desc]) => !q || (label + ' ' + desc + ' ' + key).toLowerCase().includes(q));
    if (!list.length) return;
    const g = h('div', { class: 'group' + (shut[title] && !q ? ' shut' : '') });
    g.append(h('h4', { onclick: () => { shut[title] = !shut[title]; store.set('doorbuster_editor_shut', shut); g.classList.toggle('shut'); } }, title, h('small', null, String(list.length))));
    const box = h('div', { class: 'items' });
    for (const [key, label, desc, tagEl] of list) box.append(h('div', { class: 'item', 'data-key': key, title: label + '\n' + desc, onclick: () => choose(key) }, icon(key), h('span', null, label), tagEl));
    g.append(box); pal.append(g);
  };
  for (const gname of TILE_GROUPS) group('Tiles · ' + gname, TILES.filter((t) => t.group === gname).map((t) => ['t:' + t.ch, t.label, t.desc, h('kbd', { title: 'its character in the map' }, t.ch === ' ' ? '␣' : t.ch)]));
  const FXC = { wipeout: '#FF3B4E', push: '#FF9F1C', move: '#D9A400', switch: '#00A79B', mark: '#9B5DE5', pickup: '#5E9B1C' };
  for (const gname of OBJECT_GROUPS) group('Objects · ' + gname, Object.values(OBJECTS).filter((o) => o.group === gname).map((o) => ['o:' + o.type, o.label, o.desc, h('span', { class: 'kind', style: `background:${FXC[o.effect]}` }, o.effect.toUpperCase())]));
  refreshTools();
}
function refreshRecent() {
  const box = $('recent'); box.innerHTML = '';
  S.recent.forEach((key, i) => { if (nameOf(key)) box.append(h('div', { class: 'chip', 'data-key': key, title: `${nameOf(key)} (${i + 1})`, onclick: () => choose(key) }, icon(key, 40), h('b', null, String(i + 1)))); });
}

// ---- pointer --------------------------------------------------------------------------------------------------
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (!S.u) return;
  cv.setPointerCapture(e.pointerId); closeMenus();
  const t = tileAt(e), tileTool = ['brush', 'rect', 'fill'].includes(S.tool);
  if (e.button === 1 || (e.button === 0 && S.space) || (e.button === 2 && !tileTool && !S.stamp)) { S.drag = { mode: 'pan', px: e.clientX, py: e.clientY, ox: S.view.ox, oy: S.view.oy }; cv.style.cursor = 'grabbing'; return; }
  if (S.stamp) { if (e.button === 0) applyStamp(t.x, t.y); else { S.stamp = null; S.ghost = null; S.dirty = true; } return; }
  if (S.pick && e.button === 0) { S.drag = { mode: 'area', x0: t.x, y0: t.y, x1: t.x, y1: t.y }; return; }
  if ((e.altKey && S.tool !== 'select') || S.tool === 'pick') { if (e.button === 0) { S.tile = at(t.x, t.y); setTool('brush'); choose('t:' + S.tile); toast('Picked: ' + TILE_BY_CH[S.tile].label); } return; }
  if (tileTool) {
    const ch = e.button === 2 ? '.' : S.tile;
    if (S.tool === 'brush') { brushAt(t.x, t.y, ch); S.drag = { mode: 'paint', ch, x: t.x, y: t.y }; }
    else if (S.tool === 'rect') S.drag = { mode: 'rect', ch, x0: t.x, y0: t.y, x1: t.x, y1: t.y };
    else if (S.tool === 'fill') { const n = flood(t.x, t.y, ch); if (n) { commit(); toast(`Filled ${n} tiles.`); } }
    ghostFor(t); return;
  }
  if (S.tool === 'place' && S.place && e.button === 0) {
    const spec = OBJECTS[S.place];
    if (spec.shape === 'area') { S.drag = { mode: 'placeArea', x0: t.x, y0: t.y, x1: t.x, y1: t.y }; return; }
    const x = e.shiftKey ? Math.round(t.fx * 2 - 1) / 2 : t.x, y = e.shiftKey ? Math.round(t.fy * 2 - 1) / 2 : t.y;
    const o = makeObject(S.place, x, y); S.u.objects.push(o);
    S.sel = { kind: 'object', i: S.u.objects.length - 1 }; commit(); showTab('sel'); return;
  }
  if (S.tool === 'select' && e.button === 0) {
    const cur = S.sel && S.sel.kind === 'object' ? S.u.objects[S.sel.i] : null;
    const hd = cur && handleAt(cur, t.fx, t.fy, S.view.s);
    if (hd) { S.drag = { mode: 'handle', h: hd.id, i: S.sel.i, orig: copy(cur), fx: t.fx, fy: t.fy }; return; }
    let i = objectAt(S.u.objects, t.fx, t.fy);
    if (i >= 0) {
      if (e.altKey) { const o = copy(S.u.objects[i]); addObjects([o]); i = S.u.objects.indexOf(o); }
      S.sel = { kind: 'object', i }; S.drag = { mode: 'move', i, orig: copy(S.u.objects[i]), fx: t.fx, fy: t.fy, moved: false };
      showTab('sel'); S.dirty = true; return;
    }
    const r = region();
    if (r && t.x >= r[0] && t.x <= r[2] && t.y >= r[1] && t.y <= r[3] && (r[2] > r[0] || r[3] > r[1])) { S.drag = { mode: 'moveTiles', r, fx: t.fx, fy: t.fy, dx: 0, dy: 0 }; return; }
    S.sel = { kind: 'tiles', x0: t.x, y0: t.y, x1: t.x, y1: t.y }; S.drag = { mode: 'marquee' }; S.dirty = true;
  }
});
cv.addEventListener('pointermove', (e) => {
  if (!S.u) return;
  const t = tileAt(e), d = S.drag;
  S.hover = { x: t.x, y: t.y }; S.dirty = true; status(t);
  if (!d) { ghostFor(t); return; }
  if (d.mode === 'pan') { S.view.ox = d.ox + e.clientX - d.px; S.view.oy = d.oy + e.clientY - d.py; return; }
  if (d.mode === 'paint') { line(d.x, d.y, t.x, t.y, (x, y) => brushAt(x, y, d.ch)); d.x = t.x; d.y = t.y; return; }
  if (d.mode === 'rect' || d.mode === 'placeArea' || d.mode === 'area') {
    d.x1 = t.x; d.y1 = t.y;
    const [a, b, c, e2] = [Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.max(d.x0, d.x1) + 1, Math.max(d.y0, d.y1) + 1];
    S.ghost = { rect: [a, b, c, e2], text: `${c - a} × ${e2 - b}`, tiles: d.mode === 'rect' && (c - a) * (e2 - b) < 6000 ? rectTiles(a, b, c - 1, e2 - 1, d.ch) : null,
      objects: d.mode === 'placeArea' ? [makeObject(S.place, a, b, c - a, e2 - b)] : null, color: d.mode === 'area' ? '#00D1C1' : undefined };
    return;
  }
  if (d.mode === 'marquee') { S.sel.x1 = clamp(t.x, 0, W() - 1); S.sel.y1 = clamp(t.y, 0, H() - 1); return; }
  if (d.mode === 'move') {
    const o = S.u.objects[d.i], area = OBJECTS[o.type] && OBJECTS[o.type].shape === 'area', step = area ? 1 : e.altKey ? 0.1 : 0.5;
    const dx = Math.round((t.fx - d.fx) / step) * step, dy = Math.round((t.fy - d.fy) / step) * step;
    const fresh = copy(d.orig); moveObject(fresh, dx, dy); S.u.objects[d.i] = fresh; d.moved = d.moved || dx !== 0 || dy !== 0; return;
  }
  if (d.mode === 'handle') {
    const o = S.u.objects[d.i];
    if (/^(nw|ne|sw|se)$/.test(d.h)) {
      const q = d.orig, X = Math.round(t.fx), Y = Math.round(t.fy);
      let x0 = q.x, y0 = q.y, x1 = q.x + q.w, y1 = q.y + q.h;
      if (d.h.includes('w')) x0 = Math.min(X, x1 - 1); else x1 = Math.max(X, x0 + 1);
      if (d.h.includes('n')) y0 = Math.min(Y, y1 - 1); else y1 = Math.max(Y, y0 + 1);
      Object.assign(o, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    } else {
      const p = [Math.round((t.fx - 0.5) * 2) / 2, Math.round((t.fy - 0.5) * 2) / 2];
      if (d.h === 'mount') o.mount = p; else o.waypoints[Number(d.h.slice(2))] = p;
    }
    return;
  }
  if (d.mode === 'moveTiles') {
    d.dx = Math.round(t.fx - d.fx); d.dy = Math.round(t.fy - d.fy);
    const [x0, y0, x1, y1] = d.r, tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x + d.dx, y + d.dy, at(x, y)]);
    S.ghost = { tiles, rect: [x0 + d.dx, y0 + d.dy, x1 + d.dx + 1, y1 + d.dy + 1], text: `move ${d.dx}, ${d.dy}` };
  }
});
const rectTiles = (a, b, c, d, ch) => { const out = []; for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) out.push([x, y, ch]); return out; };
function ghostFor(t) {
  const before = S.ghost;
  S.ghost = null;
  if (S.stamp) S.ghost = stampGhost(t.x, t.y);
  else if (S.tool === 'place' && S.place && OBJECTS[S.place].shape === 'point') S.ghost = { objects: [makeObject(S.place, t.x, t.y)] };
  if (before || S.ghost) S.dirty = true;
}
cv.addEventListener('pointerup', (e) => {
  const d = S.drag; S.drag = null;
  if (!d) return;
  if (d.mode === 'pan') { refreshTools(); return; }
  const done = () => { S.ghost = null; S.dirty = true; };
  if (d.mode === 'paint') commit();
  else if (d.mode === 'rect') { fillRect(d.x0, d.y0, d.x1, d.y1, d.ch); commit(); }
  else if (d.mode === 'placeArea') {
    const o = makeObject(S.place, Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0) + 1, Math.abs(d.y1 - d.y0) + 1);
    S.u.objects.push(o); S.sel = { kind: 'object', i: S.u.objects.length - 1 }; commit(); showTab('sel');
  } else if (d.mode === 'area') {
    const p = S.pick; S.pick = null; hint();
    p.done({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0) + 1, h: Math.abs(d.y1 - d.y0) + 1 }); commit(); renderPanel();
  } else if (d.mode === 'move' || d.mode === 'handle') { commit(); renderPanel(); }
  else if (d.mode === 'marquee') { showTab('sel'); }
  else if (d.mode === 'moveTiles' && (d.dx || d.dy)) {
    const [x0, y0, x1, y1] = d.r, buf = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) buf.push([x, y, at(x, y)]);
    const idx = objectsIn(x0, y0, x1, y1);
    for (const [x, y] of buf) setTile(x, y, '.');
    for (const [x, y, ch] of buf) setTile(x + d.dx, y + d.dy, ch);
    for (const i of idx) moveObject(S.u.objects[i], d.dx, d.dy);
    S.sel = { kind: 'tiles', x0: x0 + d.dx, y0: y0 + d.dy, x1: x1 + d.dx, y1: y1 + d.dy };
    commit(); renderPanel();
  }
  done();
});
cv.addEventListener('pointerleave', () => { if (!S.drag) { S.hover = null; S.ghost = null; S.dirty = true; } });
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.shiftKey) { S.view.ox -= e.deltaY; S.dirty = true; return; }
  const r = cv.getBoundingClientRect(); zoom(Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

// ---- keyboard ---------------------------------------------------------------------------------------------------
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox';
  const k = e.key, ctl = e.ctrlKey || e.metaKey;
  if (k === 'Escape') {
    if (!$('overlay').hidden) return closeDrive();
    if (!$('modal').hidden) return closeModal();
    if (typing) { document.activeElement.blur(); return; }
    closeMenus();
    if (S.stamp || S.pick || S.drag) { S.stamp = null; S.pick = null; S.drag = null; S.ghost = null; hint(); }
    else if (S.tool === 'place') setTool('select');
    else S.sel = null;
    S.dirty = true; renderPanel(); return;
  }
  if (!$('modal').hidden || !$('overlay').hidden) return;
  if (ctl && k === 'Enter') { e.preventDefault(); return drive(e.shiftKey); }
  if (ctl && (k === 's' || k === 'S')) { e.preventDefault(); return download(); }
  if (ctl && (k === 'o' || k === 'O')) { e.preventDefault(); return $('file').click(); }
  if (typing) return;
  if (ctl && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctl && (k === 'y' || k === 'Y')) { e.preventDefault(); return redo(); }
  if (ctl && (k === 'c' || k === 'C')) { e.preventDefault(); return copySel(false); }
  if (ctl && (k === 'x' || k === 'X')) { e.preventDefault(); return copySel(true); }
  if (ctl && (k === 'v' || k === 'V')) { e.preventDefault(); return startPaste(); }
  if (ctl && (k === 'd' || k === 'D')) { e.preventDefault(); if (S.sel && S.sel.kind === 'object') duplicateObject(S.sel.i); return; }
  if (ctl) return;
  if (k === ' ') { S.space = true; cv.style.cursor = 'grab'; e.preventDefault(); return; }
  if (k === 'F1' || k === '?') { e.preventDefault(); return help(); }
  if (k === '/') { e.preventDefault(); $('search').focus(); return; }
  const tool = { v: 'select', b: 'brush', r: 'rect', g: 'fill', i: 'pick' }[k.toLowerCase()];
  if (tool) return setTool(tool);
  if (k === '[' || k === ']') { const sizes = [1, 2, 3, 5], j = sizes.indexOf(S.size); S.size = sizes[clamp(j + (k === ']' ? 1 : -1), 0, 3)]; refreshTools(); S.dirty = true; return; }
  if (/^[1-9]$/.test(k) && S.recent[Number(k) - 1]) return choose(S.recent[Number(k) - 1]);
  if (k === 'f' || k === 'F') { S.fitted = true; return fit(); }
  if (k === '+' || k === '=') return zoom(1.25);
  if (k === '-') return zoom(0.8);
  if (k === 'Delete' || k === 'Backspace') {
    if (S.sel && S.sel.kind === 'object') return deleteObject(S.sel.i);
    const r = region(); if (r) { fillRect(r[0], r[1], r[2], r[3], '.'); if (e.shiftKey) S.u.objects = S.u.objects.filter((o, i) => !objectsIn(...r).includes(i)); commit(); renderPanel(); }
    return;
  }
  if (k.startsWith('Arrow') && S.sel && S.sel.kind === 'object') {
    e.preventDefault();
    const o = S.u.objects[S.sel.i], area = OBJECTS[o.type] && OBJECTS[o.type].shape === 'area', st = (e.shiftKey ? 5 : 1) * (area ? 1 : 0.5);
    moveObject(o, k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
    commit(); renderPanel();
  }
});
addEventListener('keyup', (e) => { if (e.key === ' ') { S.space = false; refreshTools(); } });

// ---- small DOM helpers -------------------------------------------------------------------------------------------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'selected', 'disabled', 'min', 'max', 'step', 'type', 'placeholder', 'title', 'width', 'height', 'rows'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const row = (label, hintText, ...ctl) => h('div', { class: 'row' }, h('label', null, label, hintText ? h('small', null, hintText) : null), h('div', null, ...ctl));
function num(v, o, set, opt = {}) {
  return h('input', { type: 'number', value: v ?? '', step: opt.step ?? 'any', min: opt.min, max: opt.max, placeholder: opt.placeholder,
    oninput: (e) => { const x = e.target.value === '' ? null : Number(e.target.value); if (x === null && !opt.nullable) return; set(x); S.dirty = true; },
    onchange: () => { commit(); if (opt.rerender) renderPanel(); } });
}
function text(v, set, opt = {}) {
  return h(opt.area ? 'textarea' : 'input', { type: opt.area ? null : 'text', value: v ?? '', placeholder: opt.placeholder, oninput: (e) => { set(e.target.value); S.dirty = true; if (opt.live) opt.live(); }, onchange: () => { commit(); if (opt.rerender) renderPanel(); } });
}
function seg(values, cur, set, labels = {}) {
  return h('div', { class: 'seg' }, values.map((v) => h('button', { class: v === cur ? 'on' : '', title: labels[v] && labels[v].title || '', onclick: () => { set(v); commit(); renderPanel(); } }, (labels[v] && labels[v].text) || labels[v] || String(v))));
}
function select(options, cur, set, opt = {}) {
  return h('select', { onchange: (e) => { set(e.target.value === '' ? null : e.target.value); commit(); if (opt.rerender !== false) renderPanel(); } },
    options.map(([v, label]) => h('option', { value: v ?? '', selected: (v ?? '') === (cur ?? '') }, label)));
}
const check = (v, set, label) => h('label', { style: 'display:flex;gap:6px;align-items:center;font-weight:600' }, h('input', { type: 'checkbox', checked: !!v, onchange: (e) => { set(e.target.checked); commit(); renderPanel(); } }), label);
const btn = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: fn }, label);
const DIRL = { n: { text: '↑ n', title: 'north (up)' }, e: { text: '→ e', title: 'east (right)' }, s: { text: '↓ s', title: 'south (down)' }, w: { text: '← w', title: 'west (left)' } };
const AXL = { x: { text: '↔ x', title: 'left-right' }, y: { text: '↕ y', title: 'up-down' } };
const goodsOptions = (none) => [[null, none], ...Object.entries(GOODS_INFO).map(([id, d]) => [id, `${id} · ${d}`])];

// ---- inspector ---------------------------------------------------------------------------------------------------
function showTab(t) { if (S.tab !== t) { S.tab = t; prefs(); } renderPanel(); }
for (const b of $('tabs').children) b.onclick = () => showTab(b.dataset.tab);
function renderPanel() {
  if (!S.u) return;
  for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === S.tab);
  const p = $('panel'), top = p.scrollTop; p.innerHTML = '';
  p.append(...({ level: levelPanel, sel: selPanel, zones: zonesPanel, check: checkPanel }[S.tab] || levelPanel)().flat(4).filter((x) => x !== null && x !== undefined && x !== false));
  p.scrollTop = top; S.dirty = true;
}
function levelPanel() {
  const L = S.u.level, out = [];
  out.push(h('h3', null, 'The level'),
    row('Name', 'on the store sign', text(L.name, (v) => { L.name = v.toUpperCase(); }, { live: refreshTop })),
    row('Id', 'unique; saves use it', text(L.id, (v) => { L.id = v.toLowerCase().replace(/[^a-z0-9_]/g, '_'); }, { live: refreshTop })),
    row('Description', 'the route and the ideas', text(L.description, (v) => { L.description = v; }, { area: true })),
    row('Designer', null, text(S.u.meta.designer, (v) => { S.u.meta.designer = v; })),
    h('h3', null, 'Store and mode'),
    row('Store', STORES[L.store] ? STORES[L.store].split(':')[1] : '', select(Object.keys(STORES).map((k) => [k, k]), L.store, (v) => { L.store = v; })),
    row('Mode', null, seg(Object.keys(MODES), L.mode, (v) => { L.mode = v; }, Object.fromEntries(Object.keys(MODES).map((m) => [m, { text: m.toUpperCase(), title: MODES[m] }])))),
    h('p', { class: 'desc' }, MODES[L.mode] || ''),
    h('h3', null, 'Clock and start'),
    row('Timer', 'seconds at GO', num(L.timer_s, null, (v) => { L.timer_s = v; }, { min: 10, max: 300, step: 1 })),
    row('Closing time', 'last seconds: lanes shut', num(L.closing_s, null, (v) => { L.closing_s = v; }, { min: 0, max: 120, step: 1 })),
    row('Start facing', 'carts at GO', seg(['n', 'e', 's', 'w'], L.start_facing, (v) => { L.start_facing = v; }, DIRL)));
  // rivals
  const rv = L.rivals;
  out.push(h('h3', null, 'Rivals'),
    h('div', { class: 'chips' }, rv.map((r, i) => h('span', { class: 'c', title: RIVALS[r] }, h('i', { style: `background:${RIVAL_COLORS[r] || '#ccc'}` }), `${i + 1}. ${r}`,
      h('button', { title: 'earlier', onclick: () => { if (i) { [rv[i - 1], rv[i]] = [rv[i], rv[i - 1]]; commit(); renderPanel(); } } }, '‹'),
      h('button', { title: 'remove', onclick: () => { rv.splice(i, 1); if (L.race_against === r) L.race_against = null; commit(); renderPanel(); } }, '×')))),
    row('Add a rival', 'takes the next r tile', select([[null, '+ add…'], ...Object.keys(RIVALS).filter((r) => !rv.includes(r)).map((r) => [r, `${r} · ${RIVALS[r].split(':')[0]}`])], null, (v) => { if (v) rv.push(v); })),
    L.mode === 'race' ? row('Race against', 'RACE mode', select([[null, '—'], ...rv.map((r) => [r, r])], L.race_against, (v) => { L.race_against = v; })) : null,
    row('Rams on you', 'most per run', num(L.max_rams_on_player, null, (v) => { L.max_rams_on_player = v; }, { min: 0, max: 20, step: 1 })),
    row('Rival loot value', '× price (1 = full)', num(L.rival_goods_value, null, (v) => { L.rival_goods_value = v; }, { min: 0, max: 3, step: 0.05 })),
    row('Rival MADNESS rate', '1 = like you', num(L.rival_madness_rate, null, (v) => { L.rival_madness_rate = v; }, { min: 0, max: 3, step: 0.05 })));
  out.push(h('h3', null, 'Shoppers and loot'),
    row('Shoppers', 'wandering the store', num(L.shoppers, null, (v) => { L.shoppers = v; }, { min: 0, max: 40, step: 1 })),
    row('Door rush', 'run in at GO', num(L.door_rush, null, (v) => { L.door_rush = v; }, { min: 0, max: 20, step: 1 })),
    row('Hot item', 'on H and V tiles', select(goodsOptions('random each run'), L.hot_item, (v) => { L.hot_item = v; })),
    row('Shopping list', 'goods for tiles 1-4', h('div', null, [0, 1, 2, 3].map((i) => i <= L.shopping_list.length ? select(goodsOptions(i < L.shopping_list.length ? '— remove —' : '+ add…'), L.shopping_list[i] ?? null, (v) => { if (v) L.shopping_list[i] = v; else L.shopping_list.splice(i, 1); }) : null))));
  const M = L.medals || {};
  out.push(h('h3', null, 'Medals'),
    h('p', { class: 'desc' }, 'Bronze is any finish. The Check tab can run the expert bot and fill these in for you.'),
    row('Author receipt', 'the bot\'s best, $', num(L.author_receipt, null, (v) => { L.author_receipt = v; }, { min: 0, step: 1, nullable: true })),
    row('Silver · gold', '$', h('div', { class: 'pair' }, num(M.silver, null, (v) => { L.medals = Object.assign({ silver: 0, gold: 0, black_card: 0 }, L.medals, { silver: v }); }, { min: 0, step: 50 }), num(M.gold, null, (v) => { L.medals = Object.assign({ silver: 0, gold: 0, black_card: 0 }, L.medals, { gold: v }); }, { min: 0, step: 50 }))),
    row('Black Card', 'beat the author', num(M.black_card, null, (v) => { L.medals = Object.assign({ silver: 0, gold: 0, black_card: 0 }, L.medals, { black_card: v }); }, { min: 0, step: 1 })),
    row('Author time', 'seconds, the bot', num(L.author_time_s, null, (v) => { L.author_time_s = v; }, { min: 0, step: 1, nullable: true })),
    h('div', { class: 'acts' }, btn('Run the bot for medals', () => { showTab('check'); runBots('expert', [1, 2, 3, 4, 5]); }, 'go'), L.medals ? btn('Clear medals', () => { L.medals = null; L.author_receipt = null; commit(); renderPanel(); }) : null));
  // map size
  const side = (name, l, t, r, b) => h('div', { class: 's2' }, h('button', { title: 'add a ' + name, onclick: () => resizeMap(l, t, r, b) }, '+'), h('button', { title: 'remove a ' + name, onclick: () => resizeMap(-l, -t, -r, -b) }, '−'), h('span', null, name));
  out.push(h('h3', null, 'Map size'),
    h('div', { class: 'resize' }, h('span'), side('row on top', 0, 1, 0, 0), h('span'),
      side('column left', 1, 0, 0, 0), h('div', { class: 'mid' }, `${W()} × ${H()}`), side('column right', 0, 0, 1, 0),
      h('span'), side('row below', 0, 0, 0, 1), h('span')),
    h('p', { class: 'desc' }, `${W() * 2} × ${H() * 2} m. New rows and columns are wall; paint floor on them.`),
    h('div', { class: 'acts' }, btn('Crop to the floor', cropToContent), btn('+5 all round', () => resizeMap(5, 5, 5, 5))));
  // advanced
  const roam = L.rival_roam || (L.rival_roam = {});
  out.push(h('h3', null, 'Advanced'),
    check(L.checkpoints_any_order, (v) => { L.checkpoints_any_order = v; }, 'Checkpoints count in any order (a hub level)'),
    check(L.v3_rules, (v) => { L.v3_rules = v; }, 'Strict design rules in the game\'s check (v3)'),
    row('Barriers flip every', 's, 0 = only on dashes', num(L.barrier_flip_every_s, null, (v) => { L.barrier_flip_every_s = v; }, { min: 0, step: 0.5 })),
    h('p', { class: 'desc' }, 'Roamers: a rival with an area wanders inside it instead of racing.'),
    rv.map((r) => row(r + ' roams', roam[r] ? `${roam[r].x}, ${roam[r].y}  ${roam[r].w} × ${roam[r].h}` : 'races normally',
      h('div', { class: 'acts', style: 'margin:0' }, btn(roam[r] ? 'Redraw' : 'Draw area', () => areaPick(`${r}'s roam area`, (a) => { roam[r] = a; })), roam[r] ? btn('Clear', () => { delete roam[r]; commit(); renderPanel(); }) : null))),
    Object.keys(roam).length ? row('Roam until', 's (empty = all run)', num(L.rival_roam_until_s, null, (v) => { L.rival_roam_until_s = v || null; }, { min: 0, step: 1, nullable: true })) : null,
    row('First fail', 'a rival flubs its first try', h('div', null, rv.map((r) => select([[null, `${r}: never`], ...Object.keys(OBJECTS).map((t) => [t, `${r}: ${OBJECTS[t].label}`])], (L.rival_first_fail || {})[r] ?? null, (v) => { L.rival_first_fail = L.rival_first_fail || {}; if (v) L.rival_first_fail[r] = v; else delete L.rival_first_fail[r]; })))));
  return out;
}
function areaPick(what, done) {
  S.pick = { what, done }; hint(); toast(`Drag on the map to draw ${what}. Esc cancels.`); S.dirty = true;
}
function selPanel() {
  const s = S.sel;
  if (s && s.kind === 'object' && S.u.objects[s.i]) return objectPanel(s.i);
  const r = region();
  if (r) return tilesPanel(r);
  return [h('h3', null, 'Nothing selected'), h('p', { class: 'desc' }, 'With the Select tool (V): click an object to edit it, or drag over tiles to select an area (then copy, cut, paste, move, fill or clear it). Alt+drag an object copies it.'),
    h('h3', null, 'Objects in this level'), objectList()];
}
function objectList() {
  if (!S.u.objects.length) return h('p', { class: 'desc' }, 'None yet: pick one under Objects in the palette and click on the map.');
  return h('div', null, S.u.objects.map((o, i) => h('div', { class: 'msg n loc', onclick: () => { S.sel = { kind: 'object', i }; centreOn(o.x, o.y); renderPanel(); } },
    h('b', null, String(i + 1)), h('span', null, `${(OBJECTS[o.type] || { label: o.type }).label}${o.id ? ' "' + o.id + '"' : ''} · ${o.x}, ${o.y}`))));
}
function objectPanel(i) {
  const o = S.u.objects[i], spec = OBJECTS[o.type], out = [];
  if (!spec) return [h('h2', null, o.type), h('p', { class: 'desc' }, 'This version of the editor does not know this object; it is kept as it is.'), h('div', { class: 'acts' }, btn('Delete', () => deleteObject(i)))];
  const same = S.u.objects.filter((q) => q.type === o.type), nth = same.indexOf(o) + 1;
  out.push(h('h2', null, spec.label), h('p', { class: 'desc' }, spec.desc),
    h('p', { class: 'desc' }, h('b', null, spec.effect.toUpperCase()), ` · ${o.type}${same.length > 1 ? ` · ${nth} of ${same.length}` : ''}${o.type === 'checkpoint' ? ' · the arches count in this order' : ''}`),
    h('h3', null, 'Place'),
    row('x, y', spec.shape === 'area' ? 'top-left tile' : 'tile; .5 = between', h('div', { class: 'pair' },
      num(o.x, null, (v) => { moveObject(o, v - o.x, 0); }, { step: spec.shape === 'area' ? 1 : 0.5 }), num(o.y, null, (v) => { moveObject(o, 0, v - o.y); }, { step: spec.shape === 'area' ? 1 : 0.5 }))));
  if (spec.shape === 'area') out.push(row('w × h', 'tiles', h('div', { class: 'pair' }, num(o.w, null, (v) => { o.w = Math.max(1, Math.round(v)); }, { min: 1, step: 1 }), num(o.h, null, (v) => { o.h = Math.max(1, Math.round(v)); }, { min: 1, step: 1 }))));
  out.push(h('h3', null, 'Settings'));
  for (const f of spec.fields) out.push(fieldRow(o, f));
  out.push(h('h3', null, 'Note'), text(o.note, (v) => { if (v) o.note = v; else delete o.note; }, { area: true, placeholder: 'why it is here (kept in the file)' }));
  out.push(h('div', { class: 'acts' },
    btn('Duplicate', () => duplicateObject(i)), btn('Delete', () => deleteObject(i)),
    btn('▲ Earlier', () => { if (i) { const a = S.u.objects; [a[i - 1], a[i]] = [a[i], a[i - 1]]; S.sel.i = i - 1; commit(); renderPanel(); } }),
    btn('▼ Later', () => { const a = S.u.objects; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; S.sel.i = i + 1; commit(); renderPanel(); } })),
  h('p', { class: 'desc' }, 'Drag it on the map (Alt+drag: finer steps). Arrow keys nudge it (Shift: 5×). Ctrl+D duplicates, Del deletes.'));
  return out;
}
function fieldRow(o, f) {
  const set = (v) => { o[f.key] = v; };
  const lbl = f.key.replace(/_(s|m|mps|deg|tiles)$/, '').replace(/_/g, ' '), unit = (f.key.match(/_(s|m|mps|deg|tiles)$/) || [])[1];
  const UNITS = { s: 'seconds', m: 'metres', mps: 'm/s', deg: 'degrees', tiles: 'tiles' };
  const hintText = (unit ? UNITS[unit] + ' · ' : '') + f.desc;
  let ctl;
  switch (f.type) {
    case 'axis': ctl = seg(['x', 'y'], o[f.key], set, AXL); break;
    case 'dir': ctl = seg(['n', 'e', 's', 'w'], o[f.key], set, DIRL); break;
    case 'enum': ctl = f.values.length <= 4 ? seg(f.values, o[f.key], set) : select(f.values.map((v) => [v, v]), o[f.key], set); break;
    case 'bool': ctl = check(o[f.key], set, 'yes'); break;
    case 'text': ctl = text(o[f.key], f.key === 'id' ? (v) => { const old = o.id; o.id = v.replace(/\s+/g, '_'); for (const q of S.u.objects) if (q.opens) q.opens = q.opens.map((x) => x === old ? o.id : x); } : set, { rerender: f.key === 'id' }); break;
    case 'phase': ctl = h('div', { class: 'pair' }, num(o[f.key], null, set, { min: 0, max: 1, step: 0.05, rerender: true }),
      h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: o[f.key], oninput: (e) => { set(Number(e.target.value)); S.dirty = true; }, onchange: () => { commit(); renderPanel(); } })); break;
    case 'point': ctl = h('div', { class: 'pair' }, num(o[f.key][0], null, (v) => { o[f.key] = [v, o[f.key][1]]; }, { step: 0.5 }), num(o[f.key][1], null, (v) => { o[f.key] = [o[f.key][0], v]; }, { step: 0.5 })); break;
    case 'ids': {
      const ids = gateIds(), cur = o[f.key] || [];
      ctl = h('div', null, ids.length ? ids.map((id) => h('label', { style: 'display:inline-flex;gap:4px;margin-right:10px;font-weight:600' }, h('input', { type: 'checkbox', checked: cur.includes(id), onchange: (e) => { o[f.key] = e.target.checked ? [...cur, id] : cur.filter((x) => x !== id); commit(); renderPanel(); } }), id))
        : h('span', { class: 'hint' }, 'No gates yet: place a Gate first.'), cur.filter((id) => !ids.includes(id)).map((id) => h('span', { class: 'hint', style: 'color:#C00' }, ` "${id}" does not exist `)));
      break;
    }
    case 'points': {
      const pts = o[f.key] || (o[f.key] = []);
      return h('div', null, h('div', { class: 'row' }, h('label', null, 'waypoints', h('small', null, f.desc)), h('div', null, btn('+ Add a waypoint', () => { const last = pts[pts.length - 1] || [o.x, o.y]; pts.push([clamp(last[0] + 2, 0, W() - 1), last[1]]); commit(); renderPanel(); }))),
        pts.map((p, k) => h('div', { class: 'wp' }, h('span', null, k + 1), num(p[0], null, (v) => { p[0] = v; }, { step: 0.5 }), num(p[1], null, (v) => { p[1] = v; }, { step: 0.5 }), h('button', { onclick: () => { pts.splice(k, 1); commit(); renderPanel(); }, title: 'remove' }, '×'))),
        h('p', { class: 'hint' }, 'Drag the numbered handles on the map.'));
    }
    default: ctl = num(o[f.key], null, (v) => { o[f.key] = f.type === 'int' ? Math.round(v) : v; }, { min: f.min, max: f.max, step: f.step ?? 'any' });
  }
  return row(lbl, hintText, ctl);
}
function tilesPanel(r) {
  const [x0, y0, x1, y1] = r, w = x1 - x0 + 1, hh = y1 - y0 + 1, counts = {};
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) counts[at(x, y)] = (counts[at(x, y)] || 0) + 1;
  const out = [];
  if (w === 1 && hh === 1) {
    const t = TILE_BY_CH[at(x0, y0)];
    out.push(h('h2', null, t.label), h('p', { class: 'desc' }, `Tile ${x0}, ${y0} · "${t.ch}" · ${t.name}`), h('p', { class: 'desc' }, t.desc));
    if (t.ch === 'R' || t.ch === 'J') {
      const dirs = S.u.ramp_directions, cur = dirs.find((d) => d.x === x0 && d.y === y0);
      out.push(row('Jumps toward', 'auto = the checkouts', seg(['auto', 'n', 'e', 's', 'w'], cur ? cur.toward : 'auto', (v) => {
        S.u.ramp_directions = dirs.filter((d) => !(d.x === x0 && d.y === y0)); if (v !== 'auto') S.u.ramp_directions.push({ x: x0, y: y0, toward: v });
      }, { ...DIRL, auto: { text: 'auto' } })));
    }
    if (t.ch === 'r') { let n = 0; for (let y = 0; y <= y0; y++) for (let x = 0; x < W(); x++) if (at(x, y) === 'r' && (y < y0 || x <= x0)) n++; out.push(h('p', { class: 'desc' }, `Rival start ${n}: ${S.u.level.rivals[n - 1] ? S.u.level.rivals[n - 1] + ' starts here' : 'no rival for this slot'}.`)); }
  } else out.push(h('h2', null, `${w} × ${hh} tiles`), h('p', { class: 'desc' }, `From ${x0}, ${y0} to ${x1}, ${y1}. Drag inside it to move it (objects move along).`));
  const objs = objectsIn(x0, y0, x1, y1);
  out.push(h('h3', null, 'Inside'), h('div', null, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([ch, n]) => h('div', { class: 'msg n' }, h('b', null, String(n)), h('span', null, TILE_BY_CH[ch].label)))),
    objs.length ? h('p', { class: 'desc' }, `${objs.length} object${objs.length > 1 ? 's' : ''} inside.`) : null,
    h('h3', null, 'Do'),
    h('div', { class: 'acts' },
      btn(`Fill: ${TILE_BY_CH[S.tile].label}`, () => { fillRect(x0, y0, x1, y1, S.tile); commit(); renderPanel(); }, 'go'),
      btn('Floor', () => { fillRect(x0, y0, x1, y1, '.'); commit(); renderPanel(); }), btn('Wall', () => { fillRect(x0, y0, x1, y1, ' '); commit(); renderPanel(); }),
      btn('Copy', () => copySel(false)), btn('Cut', () => copySel(true)), btn('Paste', startPaste),
      objs.length ? btn('Delete objects inside', () => { S.u.objects = S.u.objects.filter((q, i) => !objs.includes(i)); commit(); renderPanel(); }) : null,
      btn('Wall ring', () => { for (let x = x0; x <= x1; x++) { setTile(x, y0, ' '); setTile(x, y1, ' '); } for (let y = y0; y <= y1; y++) { setTile(x0, y, ' '); setTile(x1, y, ' '); } commit(); renderPanel(); })),
    h('p', { class: 'desc' }, 'Del clears the area to floor (Shift+Del also removes the objects inside).'));
  return out;
}
function zonesPanel() {
  const Z = S.u.zones, out = [h('p', { class: 'desc' }, 'Zone 1 is the whole store: what its shelves stock and its floor. Each further zone repaints an area with its own goods and floor (a turf pitch, a pool deck…).')];
  Z.forEach((z, i) => {
    const sel = S.sel && S.sel.kind === 'zone' && S.sel.i === i;
    out.push(h('h3', { style: sel ? 'color:#FF4FA3' : '' }, i ? `Zone ${i + 1}` : 'Zone 1 · the whole store'),
      row('Goods', POOLS_INFO[z.goods] || '', select(Object.keys(POOLS_INFO).map((k) => [k, k]), z.goods, (v) => { z.goods = v; })),
      row('Floor', SURFACES[z.floor] || '', select(Object.keys(SURFACES).map((k) => [k, k]), z.floor || 'none', (v) => { z.floor = v; })));
    if (!i) out.push(row('Name', 'shown on the sign', text(z.name ?? '', (v) => { if (v) z.name = v; else delete z.name; })));
    else out.push(row('x, y, w, h', 'tiles', h('div', { class: 'quad' }, ['x', 'y', 'w', 'h'].map((k) => num(z[k], null, (v) => { z[k] = Math.max(k === 'w' || k === 'h' ? 1 : 0, Math.round(v)); }, { step: 1 })))),
      h('div', { class: 'acts' }, btn('Redraw on the map', () => areaPick(`zone ${i + 1}`, (a) => Object.assign(z, a))), btn('Show', () => { S.sel = { kind: 'zone', i }; centreOn(z.x + z.w / 2, z.y + z.h / 2); renderPanel(); }), btn('Delete', () => { Z.splice(i, 1); S.sel = null; commit(); renderPanel(); })));
  });
  out.push(h('div', { class: 'acts' }, btn('+ Add a zone', () => areaPick('the new zone', (a) => { Z.push(Object.assign({ goods: Z[0].goods, floor: 'none' }, a)); S.sel = { kind: 'zone', i: Z.length - 1 }; }), 'go')));
  return out;
}
function checkPanel() {
  const c = S.check, out = [];
  if (!c) return [h('p', null, 'Checking…')];
  const loc = (p) => p.x !== undefined ? () => { centreOn(p.x, p.y); S.hover = { x: Math.floor(p.x), y: Math.floor(p.y) }; } : null;
  const item = (cls, mark, p) => h('div', { class: `msg ${cls}${p.x !== undefined ? ' loc' : ''}`, onclick: loc(p), title: p.x !== undefined ? `Show ${p.x}, ${p.y}` : '' }, h('b', null, mark), h('span', null, p.msg));
  out.push(h('h3', null, 'The check'));
  if (!c.errors.length) out.push(h('div', { class: 'msg ok' }, h('b', null, '✓'), h('span', null, c.warnings.length ? 'It works. A few things are worth a look:' : 'Ready: the game can build and play it.')));
  out.push(...c.errors.map((p) => item('e', '✖', p)), ...c.warnings.map((p) => item('w', '!', p)), ...c.notes.map((p) => item('n', 'i', p)));
  out.push(h('h3', null, 'Bot runs'), h('p', { class: 'desc' }, 'The game\'s own bots drive the level off-screen. The expert is the author run: medals come from its best receipt.'),
    h('div', { class: 'acts' }, btn('Expert × 5', () => runBots('expert', [1, 2, 3, 4, 5]), 'go'), btn('Beginner × 3', () => runBots('beginner', [1, 2, 3])), btn('Watch the expert', () => drive(true))));
  if (S.running) out.push(h('p', { class: 'desc' }, 'Driving… (' + S.runs.length + ' done)'));
  if (S.runs.length) {
    out.push(h('table', { class: 'runs' }, h('tr', null, ['bot', 'seed', 'finish', 'time', 'receipt', 'wipes'].map((t) => h('th', null, t))),
      S.runs.map((r) => h('tr', null, h('td', null, r.bot), h('td', null, r.seed), h('td', null, r.error ? 'error' : r.finished ? '✓' : `✗ at ${r.x},${r.y}`), h('td', null, r.time ?? ''), h('td', null, r.receipt !== undefined ? '$' + r.receipt : ''), h('td', null, r.wipeouts ?? '')))));
    const ex = S.runs.filter((r) => r.bot === 'expert' && r.finished);
    if (ex.length) {
      const best = Math.max(...ex.map((r) => r.receipt)), mean = ex.reduce((s, r) => s + r.time, 0) / ex.length, r100 = (v) => Math.round(v / 100) * 100;
      const med = { silver: r100(best * 0.7), gold: r100(best * 0.9), black_card: best + 1 };
      out.push(h('div', { class: 'receipt' }, `AUTHOR RUN   $${best}\nMEAN TIME    ${mean.toFixed(1)} s\nSILVER       $${med.silver}\nGOLD         $${med.gold}\nBLACK CARD   $${med.black_card}`.split('\n').map((l) => h('div', null, l))),
        h('div', { class: 'acts' }, btn('Use these medals', () => { Object.assign(S.u.level, { author_receipt: best, medals: med, author_time_s: Math.round(mean) }); commit(); toast('Medals set from the author run.'); renderPanel(); }, 'go')));
    }
    if (S.runs.some((r) => r.bot === 'expert' && !r.finished && !r.error)) out.push(h('div', { class: 'msg e' }, h('b', null, '✖'), h('span', null, 'The expert did not finish every run: look where it stopped (the table), or give the clock more time.')));
  }
  out.push(h('h3', null, 'Into the game'),
    h('p', { class: 'desc' }, 'Export → Download the .json, then hand it over (to Claude, or: node tools/level.mjs add <file>). The file explains itself, so any AI agent can read and edit it.'));
  return out;
}
let worker = null;
function runBots(bot, seeds) {
  sync();
  if (S.check && S.check.errors.length) { showTab('check'); return toast('Fix the errors first: the bots need a working level.'); }
  if (!worker) { worker = new Worker('simworker.js', { type: 'module' }); worker.onmessage = (e) => { if (e.data.done) { S.running = false; toast('Bot runs done.'); } else S.runs.push(e.data); if (S.tab === 'check') renderPanel(); }; worker.onerror = (e) => { S.running = false; toast('The bot worker failed: ' + (e.message || 'see the console')); }; }
  S.runs = S.runs.filter((r) => r.bot !== bot); S.running = true;
  worker.postMessage({ def: universalToDef(S.u), seeds, bot }); renderPanel();
}

// ---- top bar, status, hints, toasts ------------------------------------------------------------------------------
function refreshTop() {
  if (!S.u) return;
  $('docname').textContent = `${S.u.level.name} · ${S.u.level.id}`;
  $('bUndo').disabled = S.at <= 0; $('bRedo').disabled = S.at >= S.hist.length - 1;
  document.title = `${S.u.level.name} — DOORBUSTER Level Editor`;
}
function badge() {
  const c = S.check, b = $('badge');
  if (!c) { b.textContent = ''; return; }
  b.textContent = c.errors.length || c.warnings.length || '';
  b.style.background = c.errors.length ? '#FF3B4E' : c.warnings.length ? '#E09A00' : 'transparent';
}
function status(t) {
  if (!S.u) return;
  const hv = t || S.hover, tile = hv && hv.x >= 0 && hv.y >= 0 && hv.x < W() && hv.y < H() ? TILE_BY_CH[at(hv.x, hv.y)] : null;
  const under = hv && t ? (() => { const i = objectAt(S.u.objects, t.fx, t.fy); return i >= 0 ? ' · ' + (OBJECTS[S.u.objects[i].type] || { label: S.u.objects[i].type }).label : ''; })() : '';
  const c = S.check;
  const state = !c ? '' : c.errors.length ? `<span class="bad" data-go="check">✖ ${c.errors.length} error${c.errors.length > 1 ? 's' : ''}</span>` : c.warnings.length ? `<span class="meh" data-go="check">! ${c.warnings.length} to look at</span>` : '<span class="ok">✓ ready</span>';
  $('status').innerHTML = `<span><b>${hv && hv.x >= 0 ? `x ${hv.x}  y ${hv.y}` : 'x –  y –'}</b></span><span class="grow">${tile ? `${tile.label} (“${tile.ch}”)${under}` : ''}</span>` +
    `<span>${W()} × ${H()} tiles</span><span>${Math.round(S.view.s)} px/tile</span><span>${S.u.objects.length} objects</span>${c && c.routeM ? `<span>route ${Math.round(c.routeM)} m</span>` : ''}${state}`;
}
$('status').addEventListener('click', (e) => { if (e.target.dataset.go) showTab(e.target.dataset.go); });
function hint() {
  const H2 = {
    select: 'Click an object to edit it · drag over tiles to select them · Alt+drag copies an object · Space/right-drag pans · wheel zooms',
    brush: 'Left paints · right paints floor · Alt+click picks · [ ] brush size · Space/middle-drag pans',
    rect: 'Drag a rectangle · right-drag fills it with floor', fill: 'Click fills the connected area of the same tile · right-click fills with floor',
    pick: 'Click a tile to take it as the brush', place: 'Click to place it (Shift: between tiles) · areas: drag a rectangle · Esc: back to Select',
  };
  $('hint').textContent = S.pick ? `Drag a rectangle for ${S.pick.what} · Esc cancels` : S.stamp ? 'Click to paste (the top-left corner) · Esc cancels' : H2[S.tool] || '';
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function buildLayers() {
  const box = $('layers'); box.innerHTML = '';
  for (const [k, label] of [['grid', 'Grid'], ['coords', 'Rulers'], ['zones', 'Zones'], ['objects', 'Objects'], ['route', 'Route']]) box.append(h('label', { title: k === 'route' ? 'the way the drivers take from the start to a checkout (gates open)' : '' },
    h('input', { type: 'checkbox', checked: S.layers[k], onchange: (e) => { S.layers[k] = e.target.checked; prefs(); S.dirty = true; } }), label));
}

// ---- files ---------------------------------------------------------------------------------------------------------
function fileText() { sync(); S.u.meta = Object.assign({}, S.u.meta, { tool: 'DOORBUSTER level editor 1', saved: new Date().toISOString().slice(0, 19) + 'Z' }); return pretty(finish(S.u, { glossary: S.glossary })); }
function download() {
  const a = h('a', { href: URL.createObjectURL(new Blob([fileText()], { type: 'application/json' })), download: `${S.u.level.id || 'level'}.doorbuster-level.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Downloaded ' + a.download);
}
async function clip(textValue, what) {
  try { await navigator.clipboard.writeText(textValue); toast(`Copied ${what} to the clipboard.`); }
  catch (e) { modal('Copy', [h('p', null, 'The browser would not copy: select the text and copy it.'), h('textarea', { value: textValue })], [btn('Close', closeModal)]); }
}
function openText(txt, from) {
  let data;
  try { data = JSON.parse(txt); } catch (e) { return toast('That is not JSON: ' + e.message); }
  try {
    const { level, warnings } = normalize(data);
    load(level, `Opened ${from}${warnings.length ? ` (${warnings.length} note${warnings.length > 1 ? 's' : ''})` : ''}`);
    if (warnings.length) modal('Opened with notes', [h('ul', null, warnings.map((w) => h('li', null, w)))], [btn('OK', closeModal, 'go')]);
  } catch (e) { toast('Could not open it: ' + e.message); }
}
$('file').onchange = async (e) => { const f = e.target.files[0]; if (f) openText(await f.text(), f.name); e.target.value = ''; };
addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drag'); });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('drag'); });
addEventListener('drop', async (e) => { e.preventDefault(); document.body.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) openText(await f.text(), f.name); });
let comments = [];
fetch('../src/levels.js').then((r) => r.text()).then((t) => { comments = levelComments(t); }).catch(() => {});
function openBuiltIn(i) { const { level } = normalize(defToUniversal(LEVELS[i], { description: comments[i] || '' })); load(level, `Opened level ${i}: ${LEVELS[i].name} (a copy: the game's own level does not change)`); }
function buildMenus() {
  const mo = $('mOpen'); mo.innerHTML = '';
  mo.append(btn('Open a file…  (Ctrl+O)', () => { closeMenus(); $('file').click(); }), btn('Paste JSON…', () => { closeMenus(); pasteDialog(); }),
    btn('The level before the last New / Open', () => { closeMenus(); const p = store.get(PREV_KEY); if (p && p.map) load(normalize(p).level, `Back to ${p.level && p.level.name || 'the level before'}`); else toast('No earlier level kept yet.'); }),
    h('hr'), h('div', { class: 'note' }, 'A copy of a level of the game:'));
  LEVELS.forEach((d, i) => mo.append(btn(`${i}  ${d.name}${i ? ` · ${d.kit} · ${(d.mode || 'rush').toUpperCase()}` : ' · test course'}`, () => { closeMenus(); openBuiltIn(i); })));
  const me = $('mExport'); me.innerHTML = '';
  me.append(btn('Download .json  (Ctrl+S)', () => { closeMenus(); download(); }), btn('Copy JSON', () => { closeMenus(); clip(fileText(), 'the level JSON'); }),
    btn('Copy as a src/levels.js entry', () => { closeMenus(); sync(); clip(defToJs(universalToDef(S.u), S.u.level.description), 'the levels.js entry'); }), h('hr'),
    h('label', { class: 'note', style: 'display:flex;gap:6px;align-items:center;cursor:pointer' }, h('input', { type: 'checkbox', checked: S.glossary, onchange: (e) => { S.glossary = e.target.checked; prefs(); } }), 'Include the glossary (explains every name, for AI agents)'));
  for (const [b, m] of [['bOpen', 'mOpen'], ['bExport', 'mExport']]) $(b).onclick = (e) => { e.stopPropagation(); const open = !$(m).classList.contains('open'); closeMenus(); $(m).classList.toggle('open', open); };
  addEventListener('click', (e) => { if (!e.target.closest('.drop')) closeMenus(); });
}
function closeMenus() { for (const m of document.querySelectorAll('.drop')) m.classList.remove('open'); }

// ---- dialogs ---------------------------------------------------------------------------------------------------------
function modal(title, body, foot) { $('mTitle').textContent = title; $('mBody').replaceChildren(...body); $('mFoot').replaceChildren(...foot); $('modal').hidden = false; }
function closeModal() { $('modal').hidden = true; }
$('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) closeModal(); });
function pasteDialog() {
  const ta = h('textarea', { placeholder: 'Paste a level here: a universal level (format "doorbuster-level"), or an entry of src/levels.js as JSON.' });
  modal('Paste a level', [ta], [btn('Cancel', closeModal), btn('Open', () => { closeModal(); openText(ta.value, 'the pasted level'); }, 'go')]);
  setTimeout(() => ta.focus(), 30);
}
function newDialog() {
  const st = { name: 'MY LEVEL', store: 'supermarket', mode: 'rush', w: 36, h: 28 };
  modal('A new level', [
    row('Name', null, h('input', { type: 'text', value: st.name, oninput: (e) => { st.name = e.target.value.toUpperCase(); } })),
    row('Store', null, h('select', { onchange: (e) => { st.store = e.target.value; } }, Object.keys(STORES).map((k) => h('option', { value: k }, `${k} · ${STORES[k].split(':')[1]}`)))),
    row('Mode', null, h('select', { onchange: (e) => { st.mode = e.target.value; } }, Object.keys(MODES).map((k) => h('option', { value: k }, MODES[k])))),
    row('Size', 'tiles (2 m each)', h('div', { class: 'pair' }, h('input', { type: 'number', value: st.w, min: 8, max: 200, oninput: (e) => { st.w = Number(e.target.value); } }), h('input', { type: 'number', value: st.h, min: 8, max: 200, oninput: (e) => { st.h = Number(e.target.value); } }))),
    h('p', { class: 'desc' }, 'You get a walled room with the start, two rival starts and two checkout lanes: a level you can drive at once. The current level is replaced; Open → "The level before the last New / Open" brings it back (export it to keep it for good).'),
  ], [btn('Cancel', closeModal), btn('Create', () => {
    const u = newLevel(clamp(st.w | 0, 8, 200), clamp(st.h | 0, 8, 200));
    Object.assign(u.level, { name: st.name || 'MY LEVEL', id: (st.name || 'my_level').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'my_level', store: st.store, mode: st.mode });
    if (st.mode === 'race') { u.level.rivals = ['gramps', 'dad']; u.level.race_against = 'gramps'; }
    if (st.mode === 'list') u.level.shopping_list = ['basketball', 'dumbbell'];
    u.zones[0].goods = { warehouse: 'bulk', electronics: 'gadget', boutique: 'boutique', sports: 'sports', food: 'food' }[st.store] || 'market';
    closeModal(); load(u, 'A new level. Paint floor, place shelves and hazards, then press Test drive.');
  }, 'go')]);
}
function help() {
  const sec = (t, ...items) => [h('h4', null, t), h('ul', null, items.map((i) => h('li', { html: i })))];
  modal('How to build a level', [h('div', { class: 'help' },
    sec('The idea', 'The map is a grid of 2 m tiles. <b>Tiles</b> are the store itself (floor, walls, shelves, checkouts, props). <b>Objects</b> are the moving and linked things (signs, forklifts, buttons and gates…).',
      'Every change is saved in this browser at once. <b>Export</b> writes the level as a universal JSON file that explains itself.'),
    sec('A level in five steps', '<b>1.</b> Floor: Rectangle tool (<kbd>R</kbd>) with Floor; walls are where nothing is painted.', '<b>2.</b> Start and finish: one Player start (@), Rival starts (r), Checkout lanes (c) with counters (C) between them.',
      '<b>3.</b> Shelves and loot: S, M, L shelves along the aisles; loose items (o) in trails; a hot item (H).', '<b>4.</b> Hazards: pick an object and click; areas (gates, boosts, pop-up tiles) are dragged. Checkpoint arches after the hard parts.',
      '<b>5.</b> Press <b>Test drive</b> (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>), then run the bots in <b>Check</b> to set the medals.'),
    sec('Tools', '<kbd>V</kbd> Select · <kbd>B</kbd> Brush · <kbd>R</kbd> Rectangle · <kbd>G</kbd> Fill · <kbd>I</kbd> Pick', 'Right mouse paints floor (erases) with the tile tools', '<kbd>[</kbd> <kbd>]</kbd> brush size · <kbd>1</kbd>–<kbd>9</kbd> recent items · <kbd>/</kbd> search the palette',
      '<kbd>Alt</kbd>+click picks the tile under the pointer'),
    sec('View', 'Wheel: zoom · <kbd>Space</kbd>+drag, middle or right drag: pan · <kbd>F</kbd>: fit the map', 'Rulers show x (columns) and y (rows), as in the JSON. The pink dashed line is the route the drivers take.'),
    sec('Selection', 'Drag over tiles with Select, then <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>X</kbd> / <kbd>V</kbd>, drag inside to move, <kbd>Del</kbd> to clear', 'Click an object to edit it on the right; drag its handles (corners, waypoints, the glove\'s mount)',
      '<kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates · arrows nudge · <kbd>Alt</kbd>+drag copies', '<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd>: undo / redo'),
    sec('Check and test', 'The <b>Check</b> tab runs the game\'s own builder: errors stop the level working, warnings are worth a look. Click one to see where.',
      '<b>Test drive</b> plays it in the real game (nothing is saved there). <b>Watch bot</b> lets the expert drive it.'),
    sec('Into the game', 'Export → Download .json and give the file to Claude, or run <kbd>node tools/level.mjs add file.json</kbd> (then <kbd>npm run check</kbd>).', 'Spec of the file: <b>docs/LEVEL_FORMAT.md</b>.'),
  )], [btn('Got it', closeModal, 'go')]);
}

// ---- test drive ---------------------------------------------------------------------------------------------------------
let driveBot = false;
function drive(bot) {
  sync(); recheck(true);
  if (S.check.errors.length) { showTab('check'); return toast('Fix the errors in Check first: the game cannot run this level yet.'); }
  driveBot = !!bot;
  store.set(PLAY_KEY, universalToDef(S.u));
  $('overlay').hidden = false;
  $('ovTitle').innerHTML = `${driveBot ? 'THE EXPERT BOT DRIVES' : 'TEST DRIVE'} · ${S.u.level.name}<small>${driveBot ? 'watch its line' : 'arrows/WASD drive · Space drift · Shift dash · P pause · R restart'} · nothing is saved</small>`;
  $('ovSwap').textContent = driveBot ? 'Drive it myself' : 'Watch bot';
  const f = $('game');
  f.onload = () => { try { f.contentWindow.focus(); } catch (e) { /* cross-origin */ } };
  f.src = `../index.html?custom=1&seed=${S.seed}${driveBot ? '&autoplay=expert' : ''}`;
  f.focus();
}
function closeDrive() { $('game').src = 'about:blank'; $('overlay').hidden = true; cv.focus(); }
$('ovClose').onclick = closeDrive;
$('ovRestart').onclick = () => drive(driveBot);
$('ovSwap').onclick = () => drive(!driveBot);

// ---- boot ------------------------------------------------------------------------------------------------------------------
$('bNew').onclick = newDialog; $('bUndo').onclick = undo; $('bRedo').onclick = redo; $('bHelp').onclick = help;
$('bPlay').onclick = () => drive(false); $('bBot').onclick = () => drive(true);
$('zIn').onclick = () => zoom(1.25); $('zOut').onclick = () => zoom(0.8); $('zFit').onclick = () => { S.fitted = true; fit(); };
$('search').addEventListener('input', buildPalette);
$('search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = document.querySelector('#palette .item'); if (first) { choose(first.dataset.key); $('search').blur(); } } });
addEventListener('resize', () => { resize(); });
new ResizeObserver(() => resize()).observe($('stage'));
resize(); buildTools(); buildPalette(); refreshRecent(); buildLayers(); buildMenus(); hint();
const saved = store.get(DOC_KEY);
let first = false;
try { if (saved && saved.map) load(normalize(saved).level, 'Welcome back: your last level is restored.'); else { first = true; load(newLevel(36, 28)); } }
catch (e) { first = true; load(newLevel(36, 28)); }
requestAnimationFrame(frame);
if (first) help();
window.__editor = { S, load, normalize, checkLevel };       // for the console and for tests
