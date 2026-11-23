// DOORBUSTER level editor — format.js
// Purpose: the universal level format (docs/LEVEL_FORMAT.md) and its conversions:
//          defToUniversal  a game level (an entry of src/levels.js) -> a universal level
//          normalize       any universal level (or a game level, or a hand-written file with aliases) -> a clean universal
//                          level in standard characters with every setting and field filled in
//          universalToDef  a universal level -> a game level, ready for the game or for src/levels.js
//          finish/pretty   the file as written: header, about, legend, glossary, readable layout
//          defToJs         a game level as the source text of a src/levels.js entry
// Exports: defToUniversal, normalize, universalToDef, finish, pretty, defToJs, levelComments, newLevel, LEVEL_KEYS, ABOUT
// Depends on: catalog.js. Pure: no DOM, runs in Node.

import { FORMAT, FORMAT_VERSION, TILES, TILE_BY_CH, TILE_BY_NAME, OBJECTS, objectTypeOf, STORES, MODES, RIVALS, GOODS_INFO, POOLS_INFO, SURFACES } from './catalog.js';

export const ABOUT = [
  'A DOORBUSTER level in the universal level format, version 1. Full spec: docs/LEVEL_FORMAT.md in the game project.',
  'The store is a grid of square tiles, each 2 m across. x = column, counted from 0 at the left (west) edge; y = row, counted from 0 at the top (north) edge.',
  'map[y] is row y; its character number x is the tile at (x, y). legend names every character used; glossary.tiles says what each name means.',
  'objects are the moving, timed and linked things, in tile units: x, y name a tile (an object stands on its centre; .5 puts it between two tiles). An object with w and h covers w × h tiles, starting at tile x, y (its top-left corner).',
  'Directions: n = up (-y), e = right (+x), s = down (+y), w = left (-x). Names ending in _s are seconds, _m metres, _mps metres per second, _deg degrees, _tiles tiles; phase is a fraction of a cycle, 0 to 1.',
  'To change the level: edit map rows (keep every row exactly grid.width characters, use only characters from the legend), objects and level settings. Keep any field you do not know about.',
];

// ---- level settings: [universal key, game key, value for a new level, value when the game leaves it out, meaning]
export const LEVEL_KEYS = [
  ['id', 'id', 'my_level', '', 'unique id (lowercase letters, digits, _); the game keys saves by it'],
  ['name', 'name', 'MY LEVEL', '', 'the name on the store sign (capitals)'],
  ['description', null, '', '', 'what the level is: the route and the ideas, in a few sentences (for people and AI agents)'],
  ['store', 'kit', 'supermarket', 'supermarket', 'the store look (walls, floors, fixtures, music)'],
  ['mode', 'mode', 'rush', 'rush', 'the game mode'],
  ['timer_s', 'timer', 60, 90, 'seconds on the clock at GO'],
  ['closing_s', 'closing', 18, 15, 'CLOSING TIME: the last seconds on the clock, when the checkouts shut one by one'],
  ['start_facing', 'heading', 'n', 's', 'the way the carts face at the start (n e s w, or degrees clockwise from north)'],
  ['rivals', 'rivals', ['granny', 'dad'], [], 'rival characters, in the order they take the rival_start tiles (at most 5)'],
  ['race_against', 'racer', null, null, 'RACE mode: the rival to beat to the checkout (one of rivals)'],
  ['rival_goods_value', 'rivalValue', 1, 1, 'what the rivals\' goods ring up at, times the price (1 = full price)'],
  ['rival_madness_rate', 'rivalEdge', 1, 1, 'how fast rivals fill their MADNESS meter (1 = like the player)'],
  ['max_rams_on_player', 'maxRams', 2, 3, 'how many times rivals may ram the player in one run'],
  ['rival_roam', 'roam', {}, {}, 'rivals that wander inside an area instead of racing: { rival: { x, y, w, h } }'],
  ['rival_roam_until_s', 'roamUntil', null, null, 'after this many seconds the roamers race for the checkout too (null = they roam all run)'],
  ['rival_first_fail', 'firstFail', {}, {}, 'a rival that fails its first try at one object type, for comedy: { rival: object type }'],
  ['shoppers', 'crowd', 10, 0, 'how many shoppers wander the store'],
  ['door_rush', 'rush', 4, 0, 'shoppers who run in ahead of the carts at GO'],
  ['hot_item', 'hotGood', 'console', null, 'the good on hot_item_podium and hot_item_case tiles (null = a random one each run)'],
  ['shopping_list', 'list', [], [], 'the goods for list_item_1..4 tiles, in order (LIST mode: the list to complete)'],
  ['author_time_s', 'author', null, null, 'seconds the expert bot takes (the design target for one run)'],
  ['author_receipt', 'authorReceipt', null, null, 'the best receipt of the expert bot, dollars (medals are made from it)'],
  ['medals', 'medals', null, null, 'receipt totals for { silver, gold, black_card }; bronze is any finish (null = no medal targets)'],
  ['checkpoints_any_order', 'cpAny', false, false, 'true = checkpoints count in any order (a hub level); false = in route order'],
  ['barrier_flip_every_s', 'flipEvery', 0, 0, 'smart barriers also flip on their own every so many seconds (0 = only the player\'s dash flips them)'],
  ['v3_rules', 'v3', true, false, 'true = the strict design rules apply in the game\'s check (pass windows, loot rule, pace, the beginner bot must finish)'],
];
const LEVEL_DEF = Object.fromEntries(LEVEL_KEYS.map(([k, , , d]) => [k, d]));
const DEF_KEYS = new Set([...LEVEL_KEYS.map(([, g]) => g).filter(Boolean), 'zones', 'objects', 'plan', 'rampDir', 'marks']);

const HEADING = { n: Math.PI, e: Math.PI / 2, s: 0, w: -Math.PI / 2 };
const clean = (v) => typeof v === 'number' && Number.isFinite(v) ? Number(v.toPrecision(12)) : v;
const copy = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
function facingOf(h) {
  for (const d in HEADING) if (Math.abs(Math.atan2(Math.sin(h - HEADING[d]), Math.cos(h - HEADING[d]))) < 1e-9) return d;
  return clean(((180 - h * 180 / Math.PI) % 360 + 360) % 360);      // degrees clockwise from north
}
function headingOf(f) {
  if (typeof f === 'number') return clean(Math.PI - f * Math.PI / 180);
  return HEADING[f] ?? 0;
}
const rectOf = (r) => ({ x: r[0], y: r[1], w: r[2] - r[0] + 1, h: r[3] - r[1] + 1 });
const rectTo = (a) => [a.x, a.y, a.x + a.w - 1, a.y + a.h - 1];

// Names a hand-written file may use for a tile, besides the standard ones.
const ALIASES = {
  wall: 'void', empty: 'void', solid: 'void', ground: 'floor', open: 'floor', shelf: 'shelf_small', start: 'player_start', player: 'player_start',
  rival: 'rival_start', checkout: 'checkout_open', lane: 'checkout_open', closed_checkout: 'checkout_closed', counter: 'checkout_counter',
  item: 'floor_item', loot: 'floor_item', hot_item: 'hot_item_podium', podium: 'hot_item_podium', display: 'round_display', pyramid: 'can_pyramid',
  conveyor_right: 'conveyor_east', conveyor_left: 'conveyor_west', conveyor_up: 'conveyor_north', conveyor_down: 'conveyor_south', water: 'pit', hole: 'pit', wet: 'wet_floor',
};

// ---- game level -> universal -----------------------------------------------------------------------------
export function defToUniversal(def, extra = {}) {
  const plan = def.plan || [], height = plan.length, width = plan.reduce((m, l) => Math.max(m, l.length), 0);
  const level = {};
  for (const [k, g, , d] of LEVEL_KEYS) {
    if (!g) { level[k] = extra[k] ?? ''; continue; }
    let v = def[g];
    if (k === 'start_facing') v = facingOf(def.heading || 0);
    else if (k === 'rival_roam') v = Object.fromEntries(Object.entries(def.roam || {}).map(([r, a]) => [r, rectOf(a)]));
    else if (k === 'rival_first_fail') v = Object.fromEntries(Object.entries(def.firstFail || {}).map(([r, kind]) => [r, objectTypeOf(kind) || kind]));
    else if (k === 'medals') v = def.medals ? { silver: def.medals[0], gold: def.medals[1], black_card: def.medals[2] } : null;
    else if (k === 'v3_rules') v = !!def.v3;
    level[k] = copy(v ?? d);
  }
  const zones = (def.zones && def.zones.length ? def.zones : [{ pool: 'market' }]).map((z) => {
    const u = {};
    if (z.name !== undefined) u.name = z.name;
    u.goods = z.pool || 'market';
    if (z.rect) Object.assign(u, rectOf(z.rect));
    u.floor = z.surface || 'none';
    for (const k in z) if (!['name', 'pool', 'rect', 'surface'].includes(k)) u[k] = copy(z[k]);
    return u;
  });
  const objects = (def.objects || []).map(([kind, c, r, o = {}]) => objectToUniversal(kind, c, r, o));
  const game_extra = {};
  for (const k in def) if (!DEF_KEYS.has(k)) game_extra[k] = copy(def[k]);
  return {
    meta: extra.meta || {},
    level,
    grid: { width, height, tile_m: 2 },
    map: plan.map((l) => l.padEnd(width, ' ')),
    zones,
    objects,
    ramp_directions: Object.entries(def.rampDir || {}).map(([key, toward]) => { const [x, y] = key.split(',').map(Number); return { x, y, toward }; }),
    test_marks: (def.marks || []).map(([name, x, y]) => ({ name, x, y })),
    game_extra,
  };
}
function objectToUniversal(kind, c, r, o) {
  const type = objectTypeOf(kind, o), spec = OBJECTS[type];
  if (!spec) return { type: 'game:' + kind, x: c, y: r, game_options: copy(o) };
  const u = { type, x: clean(c), y: clean(r) };
  const used = new Set(spec.fixed ? Object.keys(spec.fixed) : []);
  if (spec.shape === 'area') {
    if (spec.size === 'corner') { const c1 = o.c1 ?? c, r1 = o.r1 ?? r; u.x = Math.min(c, c1); u.y = Math.min(r, r1); u.w = Math.abs(c1 - c) + 1; u.h = Math.abs(r1 - r) + 1; used.add('c1').add('r1'); }
    else { u.w = o.cols || spec.sizeDef[0]; u.h = o.rows || spec.sizeDef[1]; used.add('cols').add('rows'); }
  }
  for (const f of spec.fields) {
    used.add(f.opt);
    const v = o[f.opt];
    if (f.type === 'axis') u[f.key] = (v ?? 'x') === 'z' ? 'y' : 'x';
    else if (f.key === 'pattern' && spec.kind === 'panels') u[f.key] = v === 'wave' ? 'wave' : 'snake';
    else if (f.type === 'point') u[f.key] = v ? [clean(v[0]), clean(v[1])] : [clean(c), clean(r)];
    else if (f.type === 'points') u[f.key] = (v || []).map((p) => [clean(p[0]), clean(p[1])]);
    else if (f.type === 'ids') u[f.key] = (v || []).slice();
    else if (f.type === 'bool') u[f.key] = !!(v ?? f.def);
    else u[f.key] = clean(v ?? f.def);
  }
  const rest = {};
  for (const k in o) if (!used.has(k)) rest[k] = copy(o[k]);
  if (Object.keys(rest).length) u.game_options = rest;
  return u;
}

// ---- any input -> a clean universal level ----------------------------------------------------------------
// Accepts a universal level (any version, standard or own legend, names or aliases), or a game level (has plan).
// Returns { level: universal, warnings: [text] }.
export function normalize(input) {
  const warnings = [];
  if (!input || typeof input !== 'object') throw new Error('not a level: expected a JSON object');
  if (!input.format && Array.isArray(input.plan)) return normalize(defToUniversal(input));
  if (input.format && input.format !== FORMAT) throw new Error(`not a DOORBUSTER level (format "${input.format}")`);
  if ((input.format_version || 1) > FORMAT_VERSION) warnings.push(`made by a newer version of the format (${input.format_version}); unknown parts are kept or skipped`);
  if (!Array.isArray(input.map)) throw new Error('the level has no map (a list of rows)');

  // the map, in standard characters
  const toStd = {};
  for (const [ch, name] of Object.entries(input.legend || {})) {
    const n = String(typeof name === 'object' && name ? name.name : name).trim().toLowerCase().replace(/[\s-]+/g, '_');
    const t = TILE_BY_NAME[n] || TILE_BY_NAME[ALIASES[n]];
    if (t) toStd[ch] = t.ch;
    else if (!/^unknown_/.test(n)) warnings.push(`legend: "${ch}" is "${name}", which this version does not know; drawn as floor`);
  }
  const height = input.map.length;
  let width = input.grid && input.grid.width || 0;
  for (const row of input.map) width = Math.max(width, String(row).length);
  const odd = new Set();
  const map = input.map.map((row) => {
    let out = '';
    for (const ch of String(row).padEnd(width, ' ')) {
      const s = toStd[ch] ?? (input.legend && ch in input.legend ? '.' : ch);
      if (TILE_BY_CH[s]) out += s; else { odd.add(ch); out += '.'; }
    }
    return out;
  });
  if (odd.size) warnings.push(`map: characters ${[...odd].map((c) => JSON.stringify(c)).join(', ')} are not in the legend; drawn as floor`);

  // settings, with every key present
  const src = input.level || {}, level = {};
  for (const [k, , , d] of LEVEL_KEYS) level[k] = copy(src[k] !== undefined ? src[k] : d);
  for (const k in src) if (!(k in level)) level[k] = copy(src[k]);
  if (!level.id) level.id = String(level.name || 'level').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'level';
  if (!Array.isArray(level.rivals)) level.rivals = [];
  if (!Array.isArray(level.shopping_list)) level.shopping_list = [];

  const zones = (Array.isArray(input.zones) && input.zones.length ? input.zones : [{ goods: 'market' }]).map((z) => {
    const u = Object.assign({}, copy(z));
    u.goods = u.goods || u.pool || 'market'; delete u.pool;
    u.floor = u.floor || u.surface || 'none'; delete u.surface;
    if (Array.isArray(u.rect)) { Object.assign(u, rectOf(u.rect)); delete u.rect; }
    return u;
  });

  const objects = [];
  for (const o of input.objects || []) {
    if (!o || typeof o !== 'object') continue;
    let type = String(o.type || '');
    if (type.startsWith('game:')) { objects.push(copy(o)); continue; }
    if (!OBJECTS[type]) {                                        // a game kind used as a type ('sign', 'patrol'...)
      const t = objectTypeOf(type, o);
      if (t) type = t;
      else { warnings.push(`objects: unknown type "${o.type}" kept as it is (the game will skip it)`); objects.push(copy(o)); continue; }
    }
    const spec = OBJECTS[type], u = { type, x: Number(o.x) || 0, y: Number(o.y) || 0 };
    if (spec.shape === 'area') { u.w = Math.max(1, Math.round(Number(o.w) || (spec.sizeDef ? spec.sizeDef[0] : 1))); u.h = Math.max(1, Math.round(Number(o.h) || (spec.sizeDef ? spec.sizeDef[1] : 1))); }
    for (const f of spec.fields) {
      let v = o[f.key];
      if (v === undefined || v === null) v = f.type === 'point' ? [u.x, u.y] : copy(f.def);
      if (['num', 'int', 'phase'].includes(f.type)) v = Number(v) || 0;
      if (f.type === 'int') v = Math.round(v);
      if (f.type === 'bool') v = !!v;
      if (f.type === 'axis') v = v === 'y' || v === 'z' ? 'y' : 'x';
      if (f.type === 'ids' && !Array.isArray(v)) v = [String(v)];
      u[f.key] = v;
    }
    for (const k in o) if (!(k in u)) u[k] = copy(o[k]);         // keep what this version does not know
    objects.push(u);
  }
  const level_ = {
    meta: copy(input.meta || {}),
    level,
    grid: { width, height, tile_m: 2 },
    map,
    zones,
    objects,
    ramp_directions: (input.ramp_directions || []).map((d) => ({ x: d.x, y: d.y, toward: d.toward })),
    test_marks: (input.test_marks || []).map((m) => ({ name: m.name, x: m.x, y: m.y })),
    game_extra: copy(input.game_extra || {}),
  };
  return { level: level_, warnings };
}

// ---- universal -> game level -----------------------------------------------------------------------------
// The game leaves out settings at their defaults, so a level reads like the ones in src/levels.js.
export function universalToDef(u) {
  const L = u.level, def = { id: L.id, name: L.name, mode: L.mode || 'rush', kit: L.store || 'supermarket' };
  if (L.v3_rules) def.v3 = true;
  def.timer = L.timer_s ?? 90;
  if (L.closing_s !== undefined && L.closing_s !== 15) def.closing = L.closing_s;
  if (L.author_time_s) def.author = L.author_time_s;
  def.heading = headingOf(L.start_facing ?? 's');
  def.rivals = (L.rivals || []).slice();
  if (L.race_against) def.racer = L.race_against;
  if (L.rival_roam && Object.keys(L.rival_roam).length) def.roam = Object.fromEntries(Object.entries(L.rival_roam).map(([r, a]) => [r, rectTo(a)]));
  if (L.rival_roam_until_s) def.roamUntil = L.rival_roam_until_s;
  if (L.rival_goods_value !== undefined && L.rival_goods_value !== 1) def.rivalValue = L.rival_goods_value;
  if (L.rival_madness_rate !== undefined && L.rival_madness_rate !== 1) def.rivalEdge = L.rival_madness_rate;
  def.crowd = L.shoppers ?? 0; def.rush = L.door_rush ?? 0; def.maxRams = L.max_rams_on_player ?? 3;
  if (L.hot_item) def.hotGood = L.hot_item;
  if (L.shopping_list && L.shopping_list.length) def.list = L.shopping_list.slice();
  if (L.author_receipt) def.authorReceipt = L.author_receipt;
  if (L.medals) def.medals = [L.medals.silver, L.medals.gold, L.medals.black_card];
  if (L.rival_first_fail && Object.keys(L.rival_first_fail).length) def.firstFail = Object.fromEntries(Object.entries(L.rival_first_fail).map(([r, t]) => [r, OBJECTS[t] ? OBJECTS[t].kind : t]));
  if (L.checkpoints_any_order) def.cpAny = true;
  if (L.barrier_flip_every_s) def.flipEvery = L.barrier_flip_every_s;
  if (u.ramp_directions && u.ramp_directions.length) def.rampDir = Object.fromEntries(u.ramp_directions.map((d) => [d.x + ',' + d.y, d.toward]));
  if (u.test_marks && u.test_marks.length) def.marks = u.test_marks.map((m) => [m.name, m.x, m.y]);
  Object.assign(def, copy(u.game_extra || {}));
  def.zones = (u.zones || [{ goods: 'market' }]).map((z, i) => {
    const g = { pool: z.goods || 'market' };
    for (const k in z) if (!['goods', 'floor', 'x', 'y', 'w', 'h', 'name'].includes(k)) g[k] = copy(z[k]);
    if (z.name !== undefined && z.name !== null && z.name !== '') g.name = z.name;
    else if (i === 0) g.name = L.name;
    if (i > 0 && z.w > 0 && z.h > 0) g.rect = rectTo(z);
    if (z.floor && z.floor !== 'none') g.surface = z.floor;
    return g;
  });
  def.objects = [];
  for (const o of u.objects || []) {
    const g = objectToDef(o);
    if (g) def.objects.push(g);
  }
  def.plan = u.map.slice();
  return def;
}
function objectToDef(o) {
  if (String(o.type).startsWith('game:')) return [o.type.slice(5), o.x, o.y, copy(o.game_options || {})];
  const spec = OBJECTS[o.type];
  if (!spec) return null;
  const g = Object.assign({}, spec.fixed || {});
  if (spec.shape === 'area') {
    if (spec.size === 'corner') { if (o.w > 1) g.c1 = o.x + o.w - 1; if (o.h > 1) g.r1 = o.y + o.h - 1; }
    else { g.cols = o.w; g.rows = o.h; }
  }
  for (const f of spec.fields) {
    let v = o[f.key];
    if (v === undefined || v === null) continue;
    if (f.type === 'axis') { if (v === 'y') g[f.opt] = 'z'; else if (f.opt === 'across') g[f.opt] = 'x'; continue; }
    if (f.type === 'point') { if (v[0] !== o.x || v[1] !== o.y || spec.kind === 'glove') g[f.opt] = [v[0], v[1]]; continue; }
    if (f.type === 'points') { if (v.length || spec.kind === 'patrol') g[f.opt] = v.map((p) => [p[0], p[1]]); continue; }
    if (f.type === 'ids') { g[f.opt] = v.slice(); continue; }
    if (f.key === 'pattern' && spec.kind === 'panels') { if (v === 'wave') g.pattern = 'wave'; continue; }
    if (f.key === 'id' || f.key === 'style' && spec.kind === 'gate') { g[f.opt] = v; continue; }
    if (JSON.stringify(v) === JSON.stringify(f.def)) continue;     // at its default: the game fills it in
    g[f.opt] = v;
  }
  Object.assign(g, copy(o.game_options || {}));
  return [spec.kind, o.x, o.y, g];
}

// ---- the file as written ----------------------------------------------------------------------------------
// Adds the header, the about text, the legend and (unless glossary is false) a glossary of every name used.
export function finish(u, { glossary = true } = {}) {
  const used = new Set(u.map.join(''));
  const legend = {};
  for (const t of TILES) if (used.has(t.ch)) legend[t.ch] = t.name;
  const out = { format: FORMAT, format_version: FORMAT_VERSION, about: ABOUT, meta: u.meta || {}, level: u.level, grid: u.grid, legend, map: u.map, zones: u.zones, objects: u.objects };
  if (u.ramp_directions && u.ramp_directions.length) out.ramp_directions = u.ramp_directions;
  if (u.test_marks && u.test_marks.length) out.test_marks = u.test_marks;
  if (u.game_extra && Object.keys(u.game_extra).length) out.game_extra = u.game_extra;
  if (glossary) {
    const types = new Set(u.objects.map((o) => o.type));
    const tiles = {}, objects = {};
    for (const t of TILES) if (used.has(t.ch)) tiles[t.name] = t.desc;
    for (const t in OBJECTS) if (types.has(t)) {
      const s = OBJECTS[t], fields = {};
      for (const f of s.fields) fields[f.key] = `${f.desc}${f.values ? ' (' + f.values.join(' | ') + ')' : f.type === 'dir' ? ' (n | e | s | w)' : f.type === 'axis' ? ' (x | y)' : ''}; default ${JSON.stringify(f.def)}`;
      objects[t] = { what: s.desc, effect: s.effect, placed: s.shape === 'area' ? 'area: x, y = top-left tile, w × h tiles' : 'point: x, y = the tile it stands on (its centre)', fields };
    }
    out.glossary = {
      level: Object.fromEntries(LEVEL_KEYS.map(([k, , , , d]) => [k, d])),
      tiles, objects,
      zones: 'zones[0] is the whole store: the goods its shelves stock (goods) and its floor. Later zones repaint an area (x, y, w, h) with their own goods and floor.',
      ramp_directions: 'ramps (R) and trampolines (J) point toward the checkouts by themselves; an entry { x, y, toward } points the one at x, y another way',
      values: { store: STORES, mode: MODES, rivals: RIVALS, goods: GOODS_INFO, zone_goods: POOLS_INFO, zone_floor: SURFACES },
    };
  }
  return out;
}

// Readable JSON: one map row per line, one object per line, settings one per line.
export function pretty(v) {
  const one = (x) => JSON.stringify(x);
  const inline = (x) => Array.isArray(x) ? '[' + x.map(inline).join(', ') + ']'
    : x && typeof x === 'object' ? (Object.keys(x).length ? '{ ' + Object.keys(x).map((k) => one(k) + ': ' + inline(x[k])).join(', ') + ' }' : '{}') : one(x);
  const walk = (x, ind, key) => {
    if (Array.isArray(x)) {
      if (!x.length) return '[]';
      if (key === 'map' || key === 'about') return '[\n' + x.map((r) => ind + '  ' + one(r)).join(',\n') + '\n' + ind + ']';
      if (x.every((e) => e && typeof e === 'object' && !Array.isArray(e))) return '[\n' + x.map((e) => ind + '  ' + inline(e)).join(',\n') + '\n' + ind + ']';
      return inline(x);
    }
    if (x && typeof x === 'object') {
      const keys = Object.keys(x);
      if (!keys.length) return '{}';
      if (ind.length >= 4 && inline(x).length < 110) return inline(x);
      return '{\n' + keys.map((k) => ind + '  ' + one(k) + ': ' + walk(x[k], ind + '  ', k)).join(',\n') + '\n' + ind + '}';
    }
    return one(x);
  };
  return walk(v, '', '') + '\n';
}

// ---- a src/levels.js entry ---------------------------------------------------------------------------------
export function defToJs(def, comment = '') {
  const js = (v) => {
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (Array.isArray(v)) return '[' + v.map(js).join(', ') + ']';
    if (v && typeof v === 'object') return '{ ' + Object.entries(v).map(([k, x]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : js(k)) + ': ' + js(x)).join(', ') + ' }';
    return String(v);
  };
  const head = (h) => Math.abs(h - Math.PI) < 1e-12 ? 'Math.PI' : Math.abs(h - Math.PI / 2) < 1e-12 ? 'Math.PI / 2' : Math.abs(h + Math.PI / 2) < 1e-12 ? '-Math.PI / 2' : String(h);
  const lines = ['  {'];
  const words = String(comment || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  let line = '    //';
  for (const w of words) { if (line.length + w.length + 1 > 124) { lines.push(line); line = '    //'; } line += ' ' + w; }
  if (words.length) lines.push(line);
  const top = [], rest = [];
  for (const [k, v] of Object.entries(def)) {
    if (['zones', 'objects', 'plan'].includes(k)) continue;
    (['id', 'name', 'mode', 'kit', 'v3', 'timer', 'closing', 'author', 'heading'].includes(k) ? top : rest).push(k + ': ' + (k === 'heading' ? head(v) : js(v)));
  }
  lines.push('    ' + top.join(', ') + ',');
  if (rest.length) lines.push('    ' + rest.join(', ') + ',');
  lines.push('    zones: ' + js(def.zones || []) + ',');
  lines.push('    objects: [');
  for (const o of def.objects || []) lines.push('      ' + js(o) + ',');
  lines.push('    ],');
  lines.push('    plan: [');
  for (const r of def.plan) lines.push('      ' + js(r) + ',');
  lines.push('    ],');
  lines.push('  },');
  return lines.join('\n');
}

// The comment at the top of each entry of src/levels.js (its source text), in order.
export function levelComments(src) {
  const out = [];
  for (const m of String(src).replace(/\r\n/g, '\n').matchAll(/\n {2}\{\n((?: {4}\/\/[^\n]*\n)*)/g)) out.push(m[1].split('\n').map((l) => l.replace(/^\s*\/\/\s?/, '')).join(' ').replace(/\s+/g, ' ').trim());
  return out;
}

// A small working level to start from: a room with the start at the bottom, a rival, and two checkout lanes at the top.
export function newLevel(width = 30, height = 24) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let r = '';
    for (let x = 0; x < width; x++) r += x === 0 || y === 0 || x === width - 1 || y === height - 1 ? ' ' : '.';
    rows.push(r.split(''));
  }
  const put = (x, y, ch) => { if (rows[y] && rows[y][x] !== undefined) rows[y][x] = ch; };
  const cx = Math.floor(width / 2);
  for (const [dx, ch] of [[-3, 'C'], [-2, 'c'], [-1, 'C'], [0, 'c'], [1, 'C']]) { put(cx + dx, 1, ch); put(cx + dx, 2, ch); }
  put(cx - 1, height - 3, '@'); put(cx + 1, height - 3, 'r'); put(cx + 3, height - 3, 'r');
  const level = Object.fromEntries(LEVEL_KEYS.map(([k, , v]) => [k, copy(v)]));
  return normalize({ format: FORMAT, format_version: FORMAT_VERSION, level, map: rows.map((r) => r.join('')) }).level;
}
