# DOORBUSTER — the universal level format (version 1)

One JSON file holds one level: the store's map, its settings and its objects. People make these files with the level editor (`editor/`), AI agents can read and write them by hand, and `tools/level.mjs` turns them into levels of the game. The file explains itself: its `about` and `glossary` say what every name in it means. This document is the full spec.

The vocabulary (tile names, object types, their fields and defaults) lives in `editor/catalog.js`; the conversions in `editor/format.js`. When they and this document disagree, the code wins and this document is out of date.

## 1. A file at a glance

```json
{
  "format": "doorbuster-level",
  "format_version": 1,
  "about": ["...how to read this file, in six lines..."],
  "meta": { "designer": "Amir", "tool": "DOORBUSTER level editor 1", "saved": "2026-11-23T14:45:20Z" },
  "level": { "id": "price", "name": "PRICE PANIC", "description": "From the doors north under a swinging sign...",
             "store": "supermarket", "mode": "rush", "timer_s": 54, "closing_s": 24, "start_facing": "n",
             "rivals": ["granny", "dad"], "...": "every other setting, see section 3" },
  "grid": { "width": 48, "height": 47, "tile_m": 2 },
  "legend": { " ": "void", ".": "floor", "S": "shelf_small", "@": "player_start", "c": "checkout_open", "...": "..." },
  "map": [
    "                                                ",
    "             .LLLLL.LLLLL.LLLLL.LLLL..........  ",
    "             ..>>o>>>>o>>>>o>>>>o>>>..........  ",
    "..."
  ],
  "zones": [ { "name": "PRICE PANIC", "goods": "market", "floor": "none" } ],
  "objects": [
    { "type": "swinging_sign", "x": 6, "y": 27, "swing_axis": "x", "period_s": 3, "amplitude_deg": 40, "width_m": 3, "phase": 0 },
    { "type": "floor_button", "x": 36, "y": 2, "opens": ["deli"] },
    { "type": "gate", "x": 41, "y": 6, "w": 4, "h": 1, "id": "deli", "style": "shutter" }
  ],
  "glossary": { "level": {}, "tiles": {}, "objects": {}, "values": {} }
}
```

To see a complete real file: `node tools/level.mjs export 1` (writes `levels/price.doorbuster-level.json`), or open a level of the game in the editor and export it.

## 2. Coordinates, units, directions

- The store is a grid of square **tiles, 2 m across**. `grid.width` × `grid.height` tiles.
- **x** is the column, counted from 0 at the left (west) edge; **y** is the row, counted from 0 at the top (north) edge.
- `map[y]` is row y; character number x of it is the tile at (x, y). Every row is exactly `grid.width` characters (pad with spaces, which are walls).
- A **point object** stands on the centre of tile (x, y). Fractions are allowed: `x: 42.5` puts it on the line between tiles 42 and 43.
- An **area object** (it has `w` and `h`) covers `w × h` whole tiles, starting at tile (x, y), its top-left corner.
- **Directions**: `n` = up (−y), `e` = right (+x), `s` = down (+y), `w` = left (−x). An **axis** is `x` (left-right) or `y` (up-down).
- **Units are in the names**: `_s` seconds, `_m` metres, `_mps` metres per second, `_deg` degrees, `_tiles` tiles. A **phase** is a fraction of a cycle, 0 to 1: neighbours with phases 0 and 0.5 move half a cycle apart.

## 3. The keys

| key | what it holds |
| --- | --- |
| `format`, `format_version` | always `"doorbuster-level"` and `1` (section 7) |
| `about` | how to read the file, for whoever opens it; readers ignore it |
| `meta` | free information: `designer`, `tool`, `saved`, `source`... Readers keep it and ignore it |
| `level` | the settings (section 3.1) |
| `grid` | `width`, `height` in tiles, `tile_m` (always 2) |
| `legend` | every character used in `map` → its tile name (section 4) |
| `map` | the rows of tiles |
| `zones` | goods and floors by area (section 5) |
| `objects` | the moving, timed and linked things (section 6) |
| `ramp_directions` | optional: `[{ "x", "y", "toward": "n" }]` points the ramp or trampoline at x, y; without it each one points toward the checkouts |
| `test_marks` | optional: `[{ "name", "x", "y" }]` points the test tools time (the test course only) |
| `game_extra` | optional: settings of the game this version of the format does not name; kept and handed back to the game as they are |
| `glossary` | optional: a description of every name used in this file (written by the editor and the tool); readers ignore it |

### 3.1 `level`

A reader fills in a missing key with the value in the middle column (what the game does when a level leaves it out).

| key | default when missing | meaning |
| --- | --- | --- |
| `id` | `""` | unique id (lowercase letters, digits, _); the game keys saves by it |
| `name` | `""` | the name on the store sign (capitals) |
| `description` | — | what the level is: the route and the ideas, in a few sentences (for people and AI agents) |
| `store` | `"supermarket"` | the store look (walls, floors, fixtures, music): `supermarket`, `warehouse`, `electronics`, `boutique`, `sports`, `food` |
| `mode` | `"rush"` | `rush` (loot and reach a checkout), `smash` (smash can pyramids; stopwatches buy time), `list` (take every list item, then check out), `race` (beat `race_against` to the checkout) |
| `timer_s` | `90` | seconds on the clock at GO |
| `closing_s` | `15` | CLOSING TIME: the last seconds on the clock, when the checkouts shut one by one |
| `start_facing` | `"s"` | the way the carts face at the start (n e s w, or degrees clockwise from north) |
| `rivals` | `[]` | rival characters, in the order they take the rival_start tiles (at most 5): `granny`, `selfie`, `queen`, `dad`, `bro`, `gramps` |
| `race_against` | `null` | RACE mode: the rival to beat to the checkout (one of rivals) |
| `rival_goods_value` | `1` | what the rivals' goods ring up at, times the price (1 = full price) |
| `rival_madness_rate` | `1` | how fast rivals fill their MADNESS meter (1 = like the player) |
| `max_rams_on_player` | `3` | how many times rivals may ram the player in one run |
| `rival_roam` | `{}` | rivals that wander inside an area instead of racing: `{ "bro": { "x", "y", "w", "h" } }` |
| `rival_roam_until_s` | `null` | after this many seconds the roamers race for the checkout too (null = they roam all run) |
| `rival_first_fail` | `{}` | a rival that fails its first try at one object type, for comedy: `{ "granny": "popup_tiles" }` |
| `shoppers` | `0` | how many shoppers wander the store |
| `door_rush` | `0` | shoppers who run in ahead of the carts at GO |
| `hot_item` | `null` | the good on hot_item_podium and hot_item_case tiles (null = a random one each run); goods are listed in `glossary.values.goods` |
| `shopping_list` | `[]` | the goods for list_item_1..4 tiles, in order (LIST mode: the list to complete) |
| `author_time_s` | `null` | seconds the expert bot takes (the design target for one run) |
| `author_receipt` | `null` | the best receipt of the expert bot over seeds 1-5, dollars |
| `medals` | `null` | receipt totals `{ "silver", "gold", "black_card" }`; bronze is any finish. The game's rule: silver 70% and gold 90% of the author receipt (to the nearest 100), the Black Card one dollar over it |
| `checkpoints_any_order` | `false` | true = checkpoints count in any order (a hub level); false = in route order |
| `barrier_flip_every_s` | `0` | smart barriers also flip on their own every so many seconds (0 = only the player's dash flips them) |
| `v3_rules` | `false` | true = the strict design rules apply in the game's check (pass windows, loot rule, pace, the beginner bot must finish). New levels: true |

## 4. `map` and `legend`

One character is one tile. The standard characters are below; a file may use other characters as long as its `legend` names them (a reader maps by the **name**, never by the character, so a legend is the contract). A reader also accepts these aliases for names: `wall` → void, `start` → player_start, `checkout` → checkout_open, `shelf` → shelf_small, `item` → floor_item, `conveyor_right/left/up/down` → conveyor_east/west/north/south, `water` → pit.

| char | name | what it is |
| --- | --- | --- |
| `␣` (space) | `void` | Outside the store: solid. Walls are built where floor meets void. |
| `.` | `floor` | Open floor. Shoppers wander here. |
| `_` | `pit` | A pit (clearance bin, stockroom hatch, pool). Rolling in is a wipeout unless the cart is in the air. |
| `~` | `wet_floor` | Wet floor or spilled soda: the cart loses its grip for a moment. |
| `#` | `crate_wall` | A low wall of crates: solid, but a jump from a ramp or trampoline clears it. |
| `W` | `glass_window` | A shop window: solid until a dash smashes through it. |
| `S` | `shelf_small` | A shelf of small, cheap goods (3 per tile side). A straight run of one shelf letter is one shelf; a run of 1-2 tiles with floor on both sides is an island with goods on its ends too. |
| `M` | `shelf_medium` | A shelf of medium goods (2 per tile side). |
| `L` | `shelf_large` | A shelf of large, pricey, heavy goods (1 per tile side). |
| `@` | `player_start` | Where the player's cart starts (exactly one). It faces level.start_facing. |
| `r` | `rival_start` | A rival's start slot. Rivals take the slots in reading order (left to right, then top to bottom): level.rivals[0] gets the first. |
| `c` | `checkout_open` | An open checkout lane: the finish. Touching lane tiles make one lane. |
| `k` | `checkout_closed` | A closed checkout lane: red lamp, barred for the whole run. |
| `C` | `checkout_counter` | A checkout counter beside lanes that run north-south (up-down). |
| `E` | `checkout_counter_ew` | A checkout counter beside lanes that run east-west (left-right). |
| `o` | `floor_item` | A loose item on the floor (lay them in trails). Next to a shelf it lies against it; on a conveyor it rides and comes back to the belt's start. |
| `1` `2` `3` `4` | `list_item_1` … `list_item_4` | Shopping-list item N (level.shopping_list[N-1]). In LIST mode a list rack: ram it to take the item; in other modes a loose item. |
| `H` | `hot_item_podium` | The hot item (level.hot_item) on a podium behind a ribbon: dash through to take it. |
| `V` | `hot_item_case` | The hot item (level.hot_item) in a glass case: a dash smashes it open. |
| `f` | `flash_sale_podium` | A dormant podium that lights up with a hot item during a FLASH SALE. |
| `P` | `can_pyramid` | A pyramid of 21 cans. A dash or a hit above 8 m/s smashes it (money per can in SMASH mode). |
| `Q` | `mega_pyramid` | The MEGA PYRAMID: 55 golden cans, 3.2 m across. |
| `G` | `gift_pile` | A pile of gift boxes: a dash bursts it. |
| `K` | `cardboard_stand` | A cardboard promo stand: a dash knocks it over. |
| `D` | `delivery_boxes` | A stack of delivery boxes: solid until a dash bursts through (a shortcut). |
| `Y` | `cake_tower` | A cake tower: smash it for desserts. |
| `>` `<` `^` `v` | `conveyor_east` / `_west` / `_north` / `_south` | A conveyor (travelator): carries carts and goods at 4 m/s that way; slow going against it. |
| `R` | `ramp` | A ramp: a jump (clears pits, low walls, benches). It points toward the checkouts unless ramp_directions says otherwise. |
| `J` | `trampoline` | A trampoline: launches the cart in a long arc over a pit or a wall. Points like a ramp. |
| `=` | `train_track` | A track for the cart train: one train runs on each straight run of these tiles. |
| `O` | `round_display` | A round display stand (solid): a good place to drift round. |
| `p` | `plant` | A potted plant (solid decoration). |
| `n` | `bench` | A bench (solid, low: a jump clears it). |
| `t` `b` `m` `u` `y` | `table`, `boxes`, `mannequin`, `hurdle`, `cone` | Light props: they fly away when hit (costing a little speed). |
| `g` | `shopper_huddle` | Six shoppers set up like bowling pins: a dash through the middle is a STRIKE. |
| `F` | `fountain` | A fountain 5.6 m across (solid, low: a jump clears it). Leave room round it. |
| `X` | `christmas_tree` | A big Christmas tree, 3.4 m across (solid). |

## 5. `zones`

`zones[0]` is the whole store: `goods` is what its shelves and floor items stock, `floor` its floor (`none` = the store's own), `name` the name on its sign (the level name when missing). Every later zone has an area (`x`, `y`, `w`, `h`) and repaints it with its own `goods` and `floor`; the last zone that covers a tile wins.

- `goods`: `market`, `bulk`, `gadget`, `food`, `sports`, `boutique`, `atrium` (`glossary.values.zone_goods`).
- `floor`: `none`, `turf`, `track`, `wood`, `deck`, `steel`, `warm`, `dessert` (`glossary.values.zone_floor`).

## 6. `objects`

Every object has `type`, `x`, `y`; area types also `w`, `h`; then its own fields. Any object may carry a `note` (free text, kept by the editor, ignored by the game). The order of `objects` matters for checkpoints: they are numbered in that order. Effects: **wipeout** (the cart crashes and comes back at the last checkpoint), **push** (knocked back, the top of the loot tower falls off), **move**, **switch**, **mark**, **pickup**.

**Hazards (wipeout)**
- `swinging_sign` · point — a giant price tag on a chain swings across the way; x, y is the middle of its swing. `swing_axis` (x | y) = "x": x = left-right, across a lane that runs up-down · `period_s` = 3 · `amplitude_deg` = 60 · `width_m` = 3 · `phase` = 0
- `giant_scissors` · point — blades on both sides of a lane snap shut across it. `span_axis` = "x" · `span_m` = 4 · `period_s` = 2.2 · `closed_s` = 0.4 · `phase` = 0
- `cleaver_row` · point — a gantry of cleavers centred on x, y chops down in a wave. `span_axis` = "x" · `count` = 5 · `gap_m` = 1.3 · `period_s` = 2.6 · `down_s` = 0.35 · `step_s` = 0.25 (between one cleaver and the next) · `phase` = 0
- `grill_flames` · area — grill strips burst into flame over their tiles (a shimmer 0.6 s before). `period_s` = 2.5 · `on_s` = 1 · `phase` = 0
- `laser_turret` · point — a post with a beam turning round it. `length_m` = 7 · `period_s` = 4 (one turn) · `phase` = 0
- `sliding_panels` · area — floor panels over a pit slide open in turn (they flash first). `period_s` = 3.5 · `open_s` = 1.5 · `warn_s` = 0.7 · `pattern` (snake | wave) = "snake" · `wave_axis` = "x" · `wave_spread` = 0.12 · `phase` = 0
- `yarn_ball` · point — waits until the player takes the hot item, then rolls down the route after them. `speed_mps` = 10.8 (the empty cart tops out at 12) · `radius_m` = 1.7

**Pushers (push)**
- `punching_bag` · point — swings like the sign but knocks back. Same fields as `swinging_sign`.
- `popup_tiles` · area — tiles pop up in a pattern and launch the cart (they flash red 0.6 s before). `period_s` = 2 · `pattern` (diag | rows | cols | checker) = "diag" · `phase` = 0
- `turnstile` · point — a three-armed display turning round x, y. `radius_m` = 2.5 · `turns_per_s` = 0.35 · `phase` = 0
- `boxing_glove` · point — x, y is its red pressure plate; rolling over it fires a glove out of the wall at `mount` toward `direction`. `mount` ([x, y]) = its own x, y · `direction` = "e" · `reach_m` = 3 · `plate_width_tiles` = 1 · `every_s` = 0 (more than 0: it fires on a clock and has no plate; then x, y should equal `mount`) · `delay_s` = 0 · `look` (glove | cushion) = "glove"
- `forklift`, `pallet_jack`, `foosball_player`, `belly_bro` · point — drive from x, y along `waypoints` ([[x, y], ...]) and back. `speed_mps` = 3 (belly_bro 1.4) · `wait_s` = 0.8 (at each end) · `phase` = 0
- `robot_vacuum` · point — runs a closed loop from x, y through `waypoints` and back to x, y; a dash makes it spit out goods. `speed_mps` = 2 · `phase` = 0

**Movement (move)**
- `boost_pad` · area — chevrons: +6 m/s for 0.8 s to a cart rolling their way. `direction` = "s"

**Switches, gates, marks**
- `floor_button` · point — opens every gate in `opens` ([gate id, ...]); a lit cable runs to them. Rivals press it too.
- `hidden_plate` · point — a subtle plate; `opens` like the button (a secret door).
- `gate` · area — a shutter, roller door or secret door across its tiles, solid until opened. `id` (required, unique) · `style` (shutter | door | secret) = "shutter"
- `smart_barrier` · area — red or blue; one colour is solid at a time, the player's dash flips them. `color` (red | blue) = "red" (red is solid at the start)
- `checkpoint` · point — an arch across the way; after a wipeout the cart comes back at the last one passed. `span_axis` = "x" · `width_tiles` = 3

**Pickups**
- `stopwatch` · point — +5 seconds. `hidden` = false (true: inside a secret room)
- `bonus_zone` · area — pays a named stunt once when the player drives in. `stunt` = "golazo"

An object whose type a reader does not know is kept as it is and skipped by the game. `"type": "game:<kind>"` with `game_options` carries an object the game has and this format does not name yet.

## 7. Versions and compatibility

- `format_version` is 1. A change that only **adds** (a new setting, tile, object type or field, each with a default that keeps old files behaving the same) keeps version 1. Anything that changes the meaning of an existing name gets version 2, and the reader for 2 must still read 1.
- **Writers** write every setting and every object field, defaults included, so a file means the same thing even if a later version changes a default. They keep fields they do not know.
- **Readers** fill in missing settings and fields with the defaults above, map the map through the file's `legend` by name, treat unknown legend names as floor (with a warning), keep unknown objects and fields, and warn about a newer `format_version` instead of refusing it.
- The game's own level data (`src/levels.js`) may change shape at any time; this format does not. `editor/format.js` converts both ways (`defToUniversal`, `universalToDef`) and is the one place to update when the game changes.

## 8. What makes a level work

`tools/level.mjs check` and the editor's Check tab report these. **Errors** (the game cannot run the level, or its check fails):

- exactly one `@`; at least one `c`; `level.id` lowercase letters, digits and `_` (and unique among the game's levels: `tools/level.mjs add` refuses a taken id unless told to `--replace` that level);
- every floor tile can reach an open checkout (wall off any island);
- every `opens` id names a gate; gate ids are unique; objects lie inside the map;
- LIST mode: a `shopping_list` and a list tile for each of its goods; RACE mode: `race_against` is one of `rivals`;
- the clock is longer than the route driven flat out.

**Warnings** (worth a look): fewer rival starts than rivals; a gate nobody opens; a button that comes after its gate on the route; checkpoints out of route order; wipeout hazards with no checkpoint; with `v3_rules`, the sign pass windows (0.6 s at 70% speed) and the loot rule (at most 15% of the goods' value on the safe line).

The game's bots are the last word: the expert must finish every seed, and with `v3_rules` the beginner must finish two runs in three.

## 9. Tools

- **The editor**: `npm run serve`, then open `http://localhost:8080/editor/`. Paint tiles, place objects, set everything, test-drive the level in the real game, run the bots, export the file. Its help (F1) lists every key.
- **`node tools/level.mjs`**: `export <n | id | all>` writes the game's levels as files; `check <file>` runs the check and the bots and suggests medals; `add <file>` puts the level into `src/levels.js` as a new store (`--replace` writes over the level with the same id); `js <file>` prints the `src/levels.js` entry. After `add`: `npm run check`, then play it with `index.html?level=N`.

## 10. For AI agents editing a file

1. Read `about`, `level.description` and `glossary`; they say what the level is and what every name means.
2. Work on the map with code, not by eye: `map[y][x]`, and replace whole rows so each keeps exactly `grid.width` characters. If you change the size, change `grid` and shift every object, zone and `ramp_directions` entry with it.
3. Use only characters that are in the `legend`; to bring in a new tile, add its character and name (section 4) to the `legend`.
4. Keep coordinates on the grid: point objects on whole or half tiles, areas on whole tiles inside the map. Link buttons to gates by `id`.
5. Check the result: `node tools/level.mjs check <file>` (or open it in the editor). Fix every error; read every warning.
6. Say what you changed in `level.description` if the route or the idea changed.
