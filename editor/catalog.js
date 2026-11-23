// DOORBUSTER level editor — catalog.js
// Purpose: the vocabulary of the universal level format (docs/LEVEL_FORMAT.md): every tile with its map character,
//          its universal name, a description and how the editor draws it; every object type with the game's own
//          kind, its fields (universal name, the game's option name, type, default, unit, meaning); the values a
//          level setting may take (stores, modes, rivals, goods, floor surfaces).
// Exports: FORMAT, FORMAT_VERSION, TILES, TILE_BY_CH, TILE_BY_NAME, TILE_GROUPS, OBJECTS, OBJECT_GROUPS, STORES, MODES,
//          RIVALS, GOODS_INFO, POOLS_INFO, SURFACES, DIRS, objectTypeOf
// Depends on: nothing (pure data; runs in the browser and in Node). Mirrors src/world.js PIECES and src/objects.js.

export const FORMAT = 'doorbuster-level';
export const FORMAT_VERSION = 1;

// ---- tiles: one map character = one 2 m tile ------------------------------------------------------------
// draw: how the editor paints it. base = the ground under it; icon = what sits on it.
const T = (ch, name, label, group, desc, draw) => ({ ch, name, label, group, desc, draw });
export const TILES = [
  T(' ', 'void', 'Wall / void', 'Structure', 'Outside the store: solid. Walls are built where floor meets void.', { base: 'void' }),
  T('.', 'floor', 'Floor', 'Structure', 'Open floor. Shoppers wander here.', { base: 'floor' }),
  T('_', 'pit', 'Pit', 'Structure', 'A pit (clearance bin, stockroom hatch, pool). Rolling in is a wipeout unless the cart is in the air.', { base: 'pit' }),
  T('~', 'wet_floor', 'Wet floor', 'Structure', 'Wet floor or spilled soda: the cart loses its grip for a moment.', { base: 'floor', icon: 'wet' }),
  T('#', 'crate_wall', 'Low crate wall', 'Structure', 'A low wall of crates: solid, but a jump from a ramp or trampoline clears it.', { base: 'floor', icon: 'block', color: '#B07A4A', letter: '#' }),
  T('W', 'glass_window', 'Shop window', 'Structure', 'A shop window: solid until a dash smashes through it.', { base: 'floor', icon: 'block', color: '#9FD8F5', letter: 'W' }),

  T('S', 'shelf_small', 'Shelf: small goods', 'Shelves', 'A shelf of small, cheap goods (3 per tile side). A straight run of one shelf letter is one shelf; a run of 1-2 tiles with floor on both sides is an island with goods on its ends too.', { base: 'shelf', color: '#FFD23F', letter: 'S' }),
  T('M', 'shelf_medium', 'Shelf: medium goods', 'Shelves', 'A shelf of medium goods (2 per tile side).', { base: 'shelf', color: '#FF9F1C', letter: 'M' }),
  T('L', 'shelf_large', 'Shelf: large goods', 'Shelves', 'A shelf of large, pricey, heavy goods (1 per tile side).', { base: 'shelf', color: '#FF5D73', letter: 'L' }),

  T('@', 'player_start', 'Player start', 'Start & finish', 'Where the player\'s cart starts (exactly one). It faces level.start_facing.', { base: 'floor', icon: 'start' }),
  T('r', 'rival_start', 'Rival start', 'Start & finish', 'A rival\'s start slot. Rivals take the slots in reading order (left to right, then top to bottom): level.rivals[0] gets the first.', { base: 'floor', icon: 'rival' }),
  T('c', 'checkout_open', 'Checkout lane (open)', 'Start & finish', 'An open checkout lane: the finish. Touching lane tiles make one lane.', { base: 'lane', color: '#3DDC97' }),
  T('k', 'checkout_closed', 'Checkout lane (closed)', 'Start & finish', 'A closed checkout lane: red lamp, barred for the whole run.', { base: 'lane', color: '#E84855' }),
  T('C', 'checkout_counter', 'Checkout counter', 'Start & finish', 'A checkout counter beside lanes that run north-south (up-down).', { base: 'floor', icon: 'counter', vertical: true }),
  T('E', 'checkout_counter_ew', 'Checkout counter (E-W)', 'Start & finish', 'A checkout counter beside lanes that run east-west (left-right).', { base: 'floor', icon: 'counter', vertical: false }),

  T('o', 'floor_item', 'Loose item', 'Loot', 'A loose item on the floor (lay them in trails). Next to a shelf it lies against it; on a conveyor it rides and comes back to the belt\'s start.', { base: 'floor', icon: 'dot', color: '#FFB703' }),
  T('1', 'list_item_1', 'List item 1', 'Loot', 'Shopping-list item 1 (level.shopping_list[0]). In LIST mode a list rack: ram it to take the item; in other modes a loose item.', { base: 'floor', icon: 'diamond', color: '#00D1C1', letter: '1' }),
  T('2', 'list_item_2', 'List item 2', 'Loot', 'Shopping-list item 2 (level.shopping_list[1]).', { base: 'floor', icon: 'diamond', color: '#00D1C1', letter: '2' }),
  T('3', 'list_item_3', 'List item 3', 'Loot', 'Shopping-list item 3 (level.shopping_list[2]).', { base: 'floor', icon: 'diamond', color: '#00D1C1', letter: '3' }),
  T('4', 'list_item_4', 'List item 4', 'Loot', 'Shopping-list item 4 (level.shopping_list[3]).', { base: 'floor', icon: 'diamond', color: '#00D1C1', letter: '4' }),
  T('H', 'hot_item_podium', 'Hot item on podium', 'Loot', 'The hot item (level.hot_item) on a podium behind a ribbon: dash through to take it.', { base: 'floor', icon: 'star', color: '#FFC800' }),
  T('V', 'hot_item_case', 'Hot item in glass case', 'Loot', 'The hot item (level.hot_item) in a glass case: a dash smashes it open.', { base: 'floor', icon: 'star', color: '#9FD8F5' }),
  T('f', 'flash_sale_podium', 'Flash-sale podium', 'Loot', 'A dormant podium that lights up with a hot item during a FLASH SALE.', { base: 'floor', icon: 'star', color: '#C9BBCF' }),
  T('P', 'can_pyramid', 'Can pyramid', 'Loot', 'A pyramid of 21 cans. A dash or a hit above 8 m/s smashes it (money per can in SMASH mode).', { base: 'floor', icon: 'tri', color: '#E84855' }),
  T('Q', 'mega_pyramid', 'MEGA pyramid', 'Loot', 'The MEGA PYRAMID: 55 golden cans, 3.2 m across.', { base: 'floor', icon: 'tri', color: '#FFD23F', big: true }),
  T('G', 'gift_pile', 'Gift pile', 'Loot', 'A pile of gift boxes: a dash bursts it.', { base: 'floor', icon: 'square', color: '#FF4FA3' }),
  T('K', 'cardboard_stand', 'Cardboard stand', 'Loot', 'A cardboard promo stand: a dash knocks it over.', { base: 'floor', icon: 'square', color: '#C98A5B' }),
  T('D', 'delivery_boxes', 'Delivery boxes', 'Loot', 'A stack of delivery boxes: solid until a dash bursts through (a shortcut).', { base: 'floor', icon: 'block', color: '#D9A066', letter: 'D' }),
  T('Y', 'cake_tower', 'Cake tower', 'Loot', 'A cake tower: smash it for desserts.', { base: 'floor', icon: 'circle', color: '#FFAFCC', letter: 'Y' }),

  T('>', 'conveyor_east', 'Conveyor east', 'Movement', 'A conveyor running east (right): carries carts and goods at 4 m/s; slow going against it.', { base: 'belt', dir: 'e' }),
  T('<', 'conveyor_west', 'Conveyor west', 'Movement', 'A conveyor running west (left).', { base: 'belt', dir: 'w' }),
  T('^', 'conveyor_north', 'Conveyor north', 'Movement', 'A conveyor running north (up).', { base: 'belt', dir: 'n' }),
  T('v', 'conveyor_south', 'Conveyor south', 'Movement', 'A conveyor running south (down).', { base: 'belt', dir: 's' }),
  T('R', 'ramp', 'Ramp', 'Movement', 'A ramp: a jump (clears pits, low walls, benches). It points toward the checkouts unless ramp_directions says otherwise.', { base: 'floor', icon: 'ramp', color: '#FFD23F' }),
  T('J', 'trampoline', 'Trampoline', 'Movement', 'A trampoline: launches the cart in a long arc over a pit or a wall. It points toward the checkouts unless ramp_directions says otherwise.', { base: 'floor', icon: 'ramp', color: '#4CC9F0' }),
  T('=', 'train_track', 'Cart-train track', 'Movement', 'A track for the cart train: one train runs on each straight run of these tiles.', { base: 'floor', icon: 'track' }),

  T('O', 'round_display', 'Round display', 'Props', 'A round display stand (solid): a good place to drift round.', { base: 'floor', icon: 'circle', color: '#7CC6FE' }),
  T('p', 'plant', 'Plant', 'Props', 'A potted plant (solid decoration).', { base: 'floor', icon: 'circle', color: '#4FA83D', small: true }),
  T('n', 'bench', 'Bench', 'Props', 'A bench (solid, low: a jump clears it).', { base: 'floor', icon: 'square', color: '#8D6E63', small: true }),
  T('t', 'table', 'Table', 'Props', 'A light table: flies away when hit (costs a little speed).', { base: 'floor', icon: 'circle', color: '#B8C0CC', small: true, light: true }),
  T('b', 'boxes', 'Boxes', 'Props', 'Light boxes: fly away when hit.', { base: 'floor', icon: 'square', color: '#D9A066', small: true, light: true }),
  T('m', 'mannequin', 'Mannequin', 'Props', 'A light mannequin: flies away when hit.', { base: 'floor', icon: 'circle', color: '#F4D6C6', small: true, light: true }),
  T('u', 'hurdle', 'Hurdle', 'Props', 'A light hurdle: knocked flying when hit.', { base: 'floor', icon: 'bar', color: '#FFFFFF', light: true }),
  T('y', 'cone', 'Cone', 'Props', 'A light cone: flies away when hit.', { base: 'floor', icon: 'tri', color: '#FF9F1C', small: true, light: true }),
  T('g', 'shopper_huddle', 'Shopper huddle', 'Props', 'Six shoppers set up like bowling pins: a dash through the middle is a STRIKE.', { base: 'floor', icon: 'huddle' }),
  T('F', 'fountain', 'Fountain', 'Props', 'A fountain 5.6 m across (solid, low: a jump clears it). Leave room round it.', { base: 'floor', icon: 'circle', color: '#4CC9F0', big: true }),
  T('X', 'christmas_tree', 'Christmas tree', 'Props', 'A big Christmas tree, 3.4 m across (solid).', { base: 'floor', icon: 'tri', color: '#2D9C4A', big: true }),
];
export const TILE_BY_CH = {}, TILE_BY_NAME = {};
for (const t of TILES) { TILE_BY_CH[t.ch] = t; TILE_BY_NAME[t.name] = t; }
export const TILE_GROUPS = ['Structure', 'Shelves', 'Start & finish', 'Loot', 'Movement', 'Props'];

// ---- objects: the moving, timed and linked things (src/objects.js) -----------------------------------------
// shape: 'point' (x, y = a tile centre, fractions allowed) or 'area' (x, y = top-left tile, w × h tiles). An area's
// size goes to the game as its last tile (size: 'corner': c1, r1) or as a count (size: 'count': cols, rows).
// Field types: num, int, phase (0..1), axis ('x' | 'y'; the game says 'x' | 'z'), dir (n e s w), enum, bool, text,
// ids (gate ids), point ([x, y] in tiles), points (a list of them).
const F = (key, opt, type, def, desc, more) => ({ key, opt, type, def, desc, ...more });
const PHASE = F('phase', 'phase', 'phase', 0, 'where in its cycle it starts: a fraction of the cycle, 0 to 1 (use it to put neighbours out of step)');
const PATROL = (speed, wait) => [
  F('waypoints', 'to', 'points', [], wait === null ? 'the corners of its loop after its start [[x, y], ...]; from the last it goes back to the start'
    : 'the points it drives to after its start [[x, y], ...]; it drives out along them and back'),
  F('speed_mps', 'speed', 'num', speed, 'speed, metres per second', { min: 0.5, max: 12, step: 0.1 }),
  ...(wait === null ? [] : [F('wait_s', 'wait', 'num', wait, 'seconds it waits at each end of its path', { min: 0, max: 5, step: 0.05 })]),
  PHASE,
];
const O = (type, kind, label, group, effect, shape, desc, fields, more) => ({ type, kind, label, group, effect, shape, desc, fields, ...more });
export const OBJECTS = {};
for (const o of [
  O('swinging_sign', 'sign', 'Swinging sale sign', 'Hazards', 'wipeout', 'point',
    'A giant price tag on a chain swings across the way; x, y is the middle of its swing. Its shadow and a creak warn of it.', [
      F('swing_axis', 'across', 'axis', 'x', 'the way it swings: x = left-right (put it across a lane that runs up-down), y = up-down'),
      F('period_s', 'period', 'num', 3, 'seconds for a whole swing, there and back', { min: 0.6, max: 12, step: 0.1 }),
      F('amplitude_deg', 'amp', 'num', 60, 'how far it swings out each way, degrees', { min: 5, max: 85, step: 1 }),
      F('width_m', 'w', 'num', 3, 'width of the sign, metres', { min: 1, max: 6, step: 0.1 }),
      PHASE]),
  O('giant_scissors', 'scissors', 'Giant scissors', 'Hazards', 'wipeout', 'point',
    'A pair of giant blades on both sides of a lane snaps shut across it; they glint before closing.', [
      F('span_axis', 'across', 'axis', 'x', 'the way the blades span: x = left-right (across a lane that runs up-down), y = up-down'),
      F('span_m', 'span', 'num', 4, 'span of the blades, metres', { min: 1, max: 10, step: 0.1 }),
      F('period_s', 'period', 'num', 2.2, 'seconds per snap cycle', { min: 0.6, max: 10, step: 0.1 }),
      F('closed_s', 'closed', 'num', 0.4, 'seconds they stay shut each cycle', { min: 0.1, max: 3, step: 0.05 }),
      PHASE]),
  O('cleaver_row', 'cleavers', 'Cleaver row', 'Hazards', 'wipeout', 'point',
    'A gantry of cleavers centred on x, y chops down in a wave; a "shing" before each chop.', [
      F('span_axis', 'across', 'axis', 'x', 'the way the gantry spans: x = left-right, y = up-down'),
      F('count', 'n', 'int', 5, 'how many cleavers', { min: 1, max: 12, step: 1 }),
      F('gap_m', 'gap', 'num', 1.3, 'metres between cleavers', { min: 0.6, max: 4, step: 0.1 }),
      F('period_s', 'period', 'num', 2.6, 'seconds per chop cycle', { min: 0.6, max: 10, step: 0.1 }),
      F('down_s', 'down', 'num', 0.35, 'seconds each cleaver stays down', { min: 0.1, max: 2, step: 0.05 }),
      F('step_s', 'step', 'num', 0.25, 'seconds between one cleaver and the next (the wave)', { min: 0, max: 1.5, step: 0.01 }),
      PHASE]),
  O('grill_flames', 'flame', 'Grill flames', 'Hazards', 'wipeout', 'area',
    'Grill strips that burst into flame over their tiles; they shimmer 0.6 s before.', [
      F('period_s', 'period', 'num', 2.5, 'seconds per cycle', { min: 0.6, max: 10, step: 0.1 }),
      F('on_s', 'on', 'num', 1, 'seconds of flame each cycle', { min: 0.1, max: 5, step: 0.05 }),
      PHASE], { size: 'corner' }),
  O('laser_turret', 'laser', 'Laser turret', 'Hazards', 'wipeout', 'point',
    'A post at x, y with a beam that turns round it; the beam\'s line glows on the floor.', [
      F('length_m', 'len', 'num', 7, 'beam length, metres', { min: 1, max: 20, step: 0.5 }),
      F('period_s', 'period', 'num', 4, 'seconds per turn', { min: 1, max: 20, step: 0.1 }),
      PHASE]),
  O('sliding_panels', 'panels', 'Sliding floor panels', 'Hazards', 'wipeout', 'area',
    'Floor panels over a pit slide open in turn; each flashes before it opens. Driving onto an open one is a wipeout.', [
      F('period_s', 'period', 'num', 3.5, 'seconds per cycle', { min: 1, max: 12, step: 0.1 }),
      F('open_s', 'open', 'num', 1.5, 'seconds each panel stays open', { min: 0.2, max: 6, step: 0.05 }),
      F('warn_s', 'lead', 'num', 0.7, 'seconds of flashing before a panel opens', { min: 0.2, max: 2, step: 0.05 }),
      F('pattern', 'pattern', 'enum', 'snake', 'snake = one after another through the field; wave = nearly all together, rippling along wave_axis', { values: ['snake', 'wave'] }),
      F('wave_axis', 'axis', 'axis', 'x', 'for a wave: the way the ripple runs'),
      F('wave_spread', 'spread', 'num', 0.12, 'for a wave: how spread out the ripple is (share of the cycle)', { min: 0, max: 1, step: 0.01 }),
      PHASE], { size: 'count', sizeDef: [3, 3] }),
  O('yarn_ball', 'chaser', 'Giant yarn ball (chaser)', 'Hazards', 'wipeout', 'point',
    'Waits at x, y until the player takes the hot item, then rolls down the route to the checkouts behind the player.', [
      F('speed_mps', 'speed', 'num', 10.8, 'rolling speed, metres per second (the empty cart tops out at 12)', { min: 3, max: 16, step: 0.1 }),
      F('radius_m', 'radius', 'num', 1.7, 'radius of the ball, metres', { min: 0.5, max: 3, step: 0.1 })]),

  O('punching_bag', 'bag', 'Punching bag', 'Pushers', 'push', 'point',
    'Swings like the sale sign, but knocks the cart back instead of wiping it out.', [
      F('swing_axis', 'across', 'axis', 'x', 'the way it swings: x = left-right, y = up-down'),
      F('period_s', 'period', 'num', 3, 'seconds for a whole swing', { min: 0.6, max: 12, step: 0.1 }),
      F('amplitude_deg', 'amp', 'num', 60, 'how far it swings out each way, degrees', { min: 5, max: 85, step: 1 }),
      F('width_m', 'w', 'num', 3, 'width, metres', { min: 1, max: 6, step: 0.1 }),
      PHASE]),
  O('popup_tiles', 'tiles', 'Pop-up promo tiles', 'Pushers', 'push', 'area',
    'Floor tiles pop up in a pattern and launch the cart in an arc; each flashes red 0.6 s before.', [
      F('period_s', 'period', 'num', 2, 'seconds per cycle', { min: 0.6, max: 10, step: 0.1 }),
      F('pattern', 'pattern', 'enum', 'diag', 'the order the tiles pop in', { values: ['diag', 'rows', 'cols', 'checker'] }),
      PHASE], { size: 'count', sizeDef: [3, 4] }),
  O('turnstile', 'turnstile', 'Turnstile display', 'Pushers', 'push', 'point',
    'A three-armed display that turns round x, y and never stops; its arms sweep carts along.', [
      F('radius_m', 'radius', 'num', 2.5, 'arm length, metres', { min: 1, max: 5, step: 0.1 }),
      F('turns_per_s', 'speed', 'num', 0.35, 'turns per second', { min: 0.05, max: 1.5, step: 0.01 }),
      PHASE]),
  O('boxing_glove', 'glove', 'Boxing glove', 'Pushers', 'push', 'point',
    'x, y is its red pressure plate; rolling over it fires a glove out of the wall at mount, toward direction. With every_s set it fires on a clock instead and has no plate (a gym cushion wall: look cushion).', [
      F('mount', 'from', 'point', null, 'where the glove sits in the wall [x, y] (tiles)'),
      F('direction', 'dir', 'dir', 'e', 'the way it punches'),
      F('reach_m', 'reach', 'num', 3, 'how far it punches, metres', { min: 1, max: 8, step: 0.1 }),
      F('plate_width_tiles', 'pw', 'int', 1, 'width of the pressure plate (left-right), tiles', { min: 1, max: 5, step: 1 }),
      F('every_s', 'every', 'num', 0, '0 = fired by its plate; more = fires on its own every so many seconds', { min: 0, max: 10, step: 0.1 }),
      F('delay_s', 'delay', 'num', 0, 'for a clocked glove: seconds after each beat (put a row out of step)', { min: 0, max: 10, step: 0.05 }),
      F('look', 'look', 'enum', 'glove', 'what it looks like', { values: ['glove', 'cushion'] })]),
  O('forklift', 'patrol', 'Forklift', 'Pushers', 'push', 'point', 'A forklift drives from x, y along its waypoints and back, beeping.', PATROL(3, 0.8), { fixed: { type: 'forklift' } }),
  O('pallet_jack', 'patrol', 'Pallet jack', 'Pushers', 'push', 'point', 'A pallet jack drives from x, y along its waypoints and back.', PATROL(3, 0.8), { fixed: { type: 'jack' } }),
  O('robot_vacuum', 'patrol', 'Robot vacuum', 'Pushers', 'push', 'point', 'A robot vacuum runs a closed loop: from x, y through its waypoints and back to the start. A dash makes it spin and spit out goods.', PATROL(2, null), { fixed: { type: 'vacuum' } }),
  O('foosball_player', 'patrol', 'Giant foosball player', 'Pushers', 'push', 'point', 'A giant foosball player slides on its rail from x, y to its waypoint and back.', PATROL(3, 0.8), { fixed: { type: 'foos' } }),
  O('belly_bro', 'patrol', 'Belly bro', 'Pushers', 'push', 'point', 'A belly bro waddles from x, y along his waypoints and back and bounces carts off. A dash makes him drop food.', PATROL(1.4, 0.8), { fixed: { type: 'belly' } }),

  O('boost_pad', 'boost', 'Boost arrows', 'Movement', 'move', 'area', 'Chevrons on the floor: a burst of speed (+6 m/s for 0.8 s) for a cart rolling the way they point.', [
    F('direction', 'dir', 'dir', 's', 'the way the arrows point')], { size: 'corner' }),

  O('floor_button', 'button', 'Floor button', 'Switches', 'switch', 'point', 'A big bell button. Pressing it opens every gate listed in opens; a lit cable runs to what it opens. Rivals press it too.', [
    F('opens', 'opens', 'ids', [], 'ids of the gates it opens')]),
  O('hidden_plate', 'plate', 'Hidden plate', 'Switches', 'switch', 'point', 'A subtle floor plate that opens a secret door.', [
    F('opens', 'opens', 'ids', [], 'ids of the gates it opens')]),
  O('gate', 'gate', 'Gate (shutter / door)', 'Switches', 'switch', 'area', 'A shutter, roller door or secret door across its tiles; solid until a button or plate opens it.', [
    F('id', 'id', 'text', 'gate', 'its name, for the opens list of a button or plate'),
    F('style', 'style', 'enum', 'shutter', 'what it looks like', { values: ['shutter', 'door', 'secret'] })], { size: 'corner' }),
  O('smart_barrier', 'barrier', 'Smart barrier', 'Switches', 'switch', 'area', 'A red or blue barrier across its tiles. One colour is solid at a time; every dash of the player flips them.', [
    F('color', 'color', 'enum', 'red', 'its colour (red is solid at the start)', { values: ['red', 'blue'] })], { size: 'corner' }),
  O('checkpoint', 'cp', 'Checkpoint arch', 'Switches', 'mark', 'point', 'An arch across the way; after a wipeout the cart comes back at the last one passed. Place them in route order.', [
    F('span_axis', 'across', 'axis', 'x', 'the way the arch spans: x = left-right (across a lane that runs up-down), y = up-down'),
    F('width_tiles', 'w', 'num', 3, 'width of the arch, tiles', { min: 1, max: 20, step: 0.5 })]),

  O('stopwatch', 'watch', 'Stopwatch', 'Pickups', 'pickup', 'point', 'A pickup: +5 seconds on the clock.', [
    F('hidden', 'hidden', 'bool', false, 'true = inside a secret room')]),
  O('bonus_zone', 'bonus', 'Bonus zone', 'Pickups', 'pickup', 'area', 'Pays a named stunt once when the player drives into it (GOLAZO behind the foosball defence).', [
    F('stunt', 'stunt', 'text', 'golazo', 'the stunt it pays')], { size: 'corner' }),
]) OBJECTS[o.type] = o;
export const OBJECT_GROUPS = ['Hazards', 'Pushers', 'Movement', 'Switches', 'Pickups'];

// The universal type of one of the game's objects ([kind, c, r, options]).
export function objectTypeOf(kind, o = {}) {
  if (kind === 'patrol') return { jack: 'pallet_jack', vacuum: 'robot_vacuum', foos: 'foosball_player', belly: 'belly_bro' }[o.type] || 'forklift';
  for (const t in OBJECTS) if (OBJECTS[t].kind === kind) return t;
  return null;
}

// ---- level settings: the values they may take --------------------------------------------------------------
export const STORES = {
  supermarket: 'Supermarket: produce, fish counter, deli, freezers (mint walls)',
  warehouse: 'Canned-goods warehouse: pallet racks, crates, roller doors',
  electronics: 'Electronics store: screens, neon, a stockroom',
  boutique: 'Clothing boutique: catwalk, mannequins, fitting rooms',
  sports: 'Sports megastore: gym, pool, track, pitch',
  food: 'Food court: sushi lane, grills, desserts',
};
export const MODES = {
  rush: 'RUSH: grab loot and reach a checkout before the store closes',
  smash: 'SMASH: smash can pyramids for money; stopwatches buy time',
  list: 'LIST: take every shopping-list item (ram the list racks), then check out; the checkouts stay red until the list is done',
  race: 'RACE: beat the rival named in race_against to the checkout; checkpoints pay the one who reaches them first',
};
export const RIVALS = {
  granny: 'Granny Tank: slow, heavy, greedy; hardly ever rams',
  selfie: 'Selfie Star: stops for photos',
  queen: 'Coupon Queen: quick and greedy',
  dad: 'Sprint Dad: fast and skilled; rams when he can',
  bro: 'Big Bubba: heavy and aggressive',
  gramps: 'Turbo Gramps: the racer; very fast, takes the safe line, never rams',
};
export const GOODS_INFO = {
  can: 'S $8', soda: 'S $6', chips: 'S $5', roll: 'S $10', cereal: 'S $12', phone: 'S $15', game: 'S $14', toaster: 'M $35', melon: 'M $22',
  pizza: 'M $20', headset: 'M $45', shoes: 'M $60', microwave: 'L $120', speaker: 'L $180', suitcase: 'L $140', tv: 'HOT $350', bear: 'HOT $250',
  console: 'HOT $450', robovac: 'HOT $560', frozenpizza: 'L $95', icecream: 'L $85', scarf: 'S $14', perfume: 'S $22', purse: 'M $70',
  coat: 'L $160', goldbag: 'HOT $650', basketball: 'M $40', dumbbell: 'M $55', swimring: 'M $30', goalgloves: 'S $35', shaker: 'S $12',
  trainers: 'M $65', sushi: 'S $9', burger: 'S $11', fries: 'S $7', cakeslice: 'M $24',
};
export const POOLS_INFO = {
  market: 'groceries', bulk: 'bulk cans, toasters, speakers', gadget: 'phones, games, headsets, speakers', food: 'sushi, burgers, cake, ice cream',
  sports: 'shakers, gloves, trainers, balls', boutique: 'scarves, perfume, purses, coats', atrium: 'a mixed mall bag',
};
export const SURFACES = {
  none: 'the store\'s own floor', turf: 'turf with mowing stripes', track: 'an orange running track', wood: 'gym planks', deck: 'pool-deck tiles',
  steel: 'kitchen tread plate', warm: 'sushi-bar wood', dessert: 'a dessert checker',
};
export const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
