// DOORBUSTER level editor — check.js
// Purpose: checks a universal level the way the game will meet it: the settings, the links between objects, then the
//          game's own world builder (src/world.js, src/objects.js) on it, the same reachability and order rules as
//          tools/check.mjs, the v3 design rules, and the route the drivers will take from the start to a checkout.
// Exports: checkLevel
// Depends on: format.js, catalog.js, ../src/world.js, ../src/objects.js, ../src/config.js. No DOM (runs in Node).

import { buildWorld, navBuild } from '../src/world.js';
import { buildObjects, levelRules } from '../src/objects.js';
import { makeRng, CFG, GOODS, GOOD } from '../src/config.js';
import { universalToDef } from './format.js';
import { OBJECTS, RIVALS } from './catalog.js';

const T = CFG.TILE;

// Returns { errors, warnings, notes: [{ msg, x, y }], route: [[x, y], ...] (tiles), routeM, lost: [tile index], ramps: [{ x, y, dx, dy }]
// (where each ramp points), def }.
// An error stops the level from working (or from passing the game's check); a warning is worth a look.
export function checkLevel(u) {
  const errors = [], warnings = [], notes = [], out = { errors, warnings, notes, route: [], routeM: 0, lost: [], ramps: [], def: null };
  const err = (msg, x, y) => errors.push({ msg, x, y }), warn = (msg, x, y) => warnings.push({ msg, x, y }), note = (msg, x, y) => notes.push({ msg, x, y });
  const L = u.level, W = u.grid.width, H = u.grid.height;
  const find = (ch) => { const r = []; u.map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === ch) r.push([x, y]); }); return r; };
  const tile = (x, y) => (u.map[y] || '')[x] ?? ' ';

  // ---- settings
  const starts = find('@'), open = find('c'), slots = find('r'), rivals = L.rivals || [];
  if (!starts.length) err('No player start: place one Player start (@).');
  if (starts.length > 1) err(`${starts.length} player starts: keep exactly one.`, ...starts[1]);
  if (!open.length) err('No open checkout lane (c): the level has no finish.');
  if (!/^[a-z][a-z0-9_]*$/.test(L.id || '')) err('The level id must be lowercase letters, digits and _ , starting with a letter.');
  for (const r of rivals) if (!RIVALS[r]) err(`Unknown rival "${r}".`);
  if (new Set(rivals).size < rivals.length) err('A rival is listed twice.');
  if (rivals.length > 5) warn(`${rivals.length} rivals: the game takes at most 5.`);
  if (slots.length < Math.min(5, rivals.length)) warn(`${rivals.length} rivals but ${slots.length} rival starts (r): ${rivals.slice(slots.length).join(', ')} will not come.`);
  if (L.mode === 'race') {
    if (!L.race_against) err('RACE mode: choose the rival to race against.');
    else if (!rivals.includes(L.race_against)) err(`RACE mode: ${L.race_against} must be one of the rivals.`);
  }
  const list = L.shopping_list || [];
  if (L.mode === 'list' && !list.length) err('LIST mode needs a shopping list (1 to 4 goods).');
  list.forEach((id, i) => {
    if (GOOD[id] === undefined) err(`Shopping list: unknown good "${id}".`);
    if (!find(String(i + 1)).length) (L.mode === 'list' ? err : warn)(`Shopping list item ${i + 1} (${id}) has no List item ${i + 1} tile.`);
  });
  for (let i = list.length + 1; i <= 4; i++) { const t = find(String(i)); if (t.length) warn(`List item ${i} tiles but the shopping list has ${list.length} goods: those tiles stay empty.`, ...t[0]); }
  if (L.hot_item && GOOD[L.hot_item] === undefined) err(`Unknown hot item "${L.hot_item}".`);
  if (L.mode === 'smash' && !find('P').length && !find('Q').length) warn('SMASH mode without can pyramids (P): there is nothing to smash.');
  if (L.medals && !(L.medals.silver < L.medals.gold && L.medals.gold < L.medals.black_card)) warn('Medals should rise: silver < gold < black card.');
  if (L.closing_s >= L.timer_s) warn('CLOSING TIME is as long as the whole clock: the checkouts start shutting at GO.');
  for (const [r, a] of Object.entries(L.rival_roam || {})) if (!rivals.includes(r)) warn(`Roam area for ${r}, who is not a rival here.`, a.x, a.y);

  // ---- objects and their links
  const gates = new Map(), opened = new Set();
  let wipes = 0, cps = 0;
  for (const o of u.objects) {
    const spec = OBJECTS[o.type];
    if (!spec) { warn(`Object "${o.type}" is not known to this version of the game.`, o.x, o.y); continue; }
    const x0 = Math.floor(o.x + (spec.shape === 'area' ? 0 : 0.5)), y0 = Math.floor(o.y + (spec.shape === 'area' ? 0 : 0.5));
    const x1 = spec.shape === 'area' ? x0 + o.w - 1 : x0, y1 = spec.shape === 'area' ? y0 + o.h - 1 : y0;
    if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) { err(`${spec.label} at ${o.x}, ${o.y} is outside the map.`, o.x, o.y); continue; }
    if (tile(x0, y0) === ' ' && !(o.type === 'boxing_glove' && o.every_s > 0)) warn(`${spec.label} at ${o.x}, ${o.y} stands on a wall.`, o.x, o.y);
    if (spec.effect === 'wipeout') wipes++;
    if (o.type === 'checkpoint') cps++;
    if (o.type === 'gate') {
      if (!o.id) err('A gate has no id: name it, then list it in a button\'s opens.', o.x, o.y);
      else if (gates.has(o.id)) err(`Two gates are called "${o.id}".`, o.x, o.y);
      else gates.set(o.id, o);
    }
    if ((o.type === 'robot_vacuum' && (o.waypoints || []).length < 2) || (spec.kind === 'patrol' && o.type !== 'robot_vacuum' && !(o.waypoints || []).length)) warn(`${spec.label} at ${o.x}, ${o.y} has ${o.type === 'robot_vacuum' ? 'fewer than two waypoints (its loop needs them)' : 'no waypoint: it stands still'}.`, o.x, o.y);
    for (const p of o.waypoints || []) if (p[0] < 0 || p[1] < 0 || p[0] >= W || p[1] >= H || tile(Math.floor(p[0] + 0.5), Math.floor(p[1] + 0.5)) === ' ') warn(`${spec.label} at ${o.x}, ${o.y}: the waypoint ${p[0]}, ${p[1]} is on a wall or off the map.`, p[0], p[1]);
  }
  for (const o of u.objects) if (o.type === 'floor_button' || o.type === 'hidden_plate') {
    if (!(o.opens || []).length) warn(`${OBJECTS[o.type].label} at ${o.x}, ${o.y} opens nothing.`, o.x, o.y);
    for (const id of o.opens || []) { if (!gates.has(id)) err(`${OBJECTS[o.type].label} at ${o.x}, ${o.y} opens "${id}", but there is no gate with that id.`, o.x, o.y); opened.add(id); }
  }
  for (const [id, g] of gates) if (!opened.has(id)) warn(`Gate "${id}" is never opened: no button or plate lists it.`, g.x, g.y);
  if ((wipes || find('_').length) && !cps) warn('There are wipeout hazards but no checkpoint arch: after a wipeout the cart goes back to the start.');
  if (errors.length) return out;

  // ---- the game's own builder
  let def, world;
  try { def = universalToDef(u); out.def = def; } catch (e) { err('The level could not be converted: ' + e.message); return out; }
  try { world = buildWorld(def, makeRng(1)); } catch (e) { err('The game could not build the map: ' + e.message); return out; }
  out.ramps = world.ramps.map((rp) => ({ x: rp.c, y: rp.r, dx: rp.dx, dy: rp.dz }));
  for (let i = 0; i < world.nav.length; i++) if (world.floor[i] && !world.block[i] && world.nav[i] > 1e8) out.lost.push(i);
  if (out.lost.length) err(`${out.lost.length} floor tile${out.lost.length > 1 ? 's' : ''} cannot reach a checkout (marked on the map). Wall them off or open a way.`, out.lost[0] % world.cols, Math.floor(out.lost[0] / world.cols));
  try { buildObjects(world, def); } catch (e) { err('The game could not build the objects: ' + e.message); return out; }
  if (!def.cpAny) for (let i = 1; i < world.checkpoints.length; i++) {
    const c = world.checkpoints[i];
    if (!(c.nav < world.checkpoints[i - 1].nav)) warn(`Checkpoint ${i + 1} is not after checkpoint ${i} on the route (list them in route order, or tick "any order").`, c.c, c.r);
  }
  for (const s of world.switches) if (s.target && s.rad > 1 && !(s.nav > s.target.nav)) warn(`The button at ${s.c}, ${s.r} comes after what it opens on the route: drivers will not press it on the way.`, s.c, s.r);   // (a hidden plate may open a detour)
  if (L.v3_rules) for (const f of levelRules(world)) warn('Design rule: ' + f + '.');

  // ---- the route: downhill on the route field from the start, with every gate and barrier open
  for (const g of [...world.gates, ...world.barriers]) for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) world.block[r * world.cols + c] = 0;
  navBuild(world);
  let c = Math.floor(world.start.x / T), r = Math.floor(world.start.z / T);
  const nav = world.nav, cols = world.cols;
  if (starts.length && nav[r * cols + c] > 1e8) err('The start cannot reach a checkout, even with every gate open.', c, r);
  else if (starts.length) {
    out.route.push([c, r]);
    for (let n = 0; n < 4000; n++) {
      let best = nav[r * cols + c], bc = c, br = r;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= world.rows || world.block[rr * cols + cc]) continue;
        if (dc && dr && (world.block[r * cols + cc] || world.block[rr * cols + c])) continue;
        if (nav[rr * cols + cc] < best - 1e-4) { best = nav[rr * cols + cc]; bc = cc; br = rr; }
      }
      if (bc === c && br === r) break;
      out.routeM += Math.hypot(bc - c, br - r) * T;
      c = bc; r = br; out.route.push([c, r]);
    }
    const flat = out.routeM / 12;                    // the empty cart's top speed is 12 m/s
    note(`Route to the checkout: ${Math.round(out.routeM)} m, ${flat.toFixed(0)} s flat out.`);
    if (L.timer_s < flat + 4) err(`The clock (${L.timer_s} s) is shorter than the route needs even flat out (about ${Math.ceil(flat + 4)} s).`);
    else if (L.timer_s < flat * 1.6) warn(`The clock is tight: ${L.timer_s} s for a route of ${Math.round(out.routeM)} m (most levels give about twice the flat-out time).`);
  }
  // ---- the loot
  let shelf = 0, floor = 0, hot = 0;
  for (const it of world.items) shelf += GOODS[it.good].price;
  for (const d of world.drops) floor += GOODS[d.good].price;
  for (const q of world.pieces) if (q.good >= 0) hot += GOODS[q.good].price;
  note(`Loot: $${shelf} on ${world.shelves.length} shelves, $${floor} on the floor${hot ? `, $${hot} in hot items` : ''}.`);
  return out;
}
