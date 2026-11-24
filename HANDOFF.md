# DOORBUSTER — handoff to the Mindblown AI

This is a finished game. Please take the files **verbatim**: do not rewrite, restyle, reformat or
"modernise" them. Everything below exists so that the port can be checked, and so that a file can be
rebuilt if it is ever lost.

## 1. The game in five lines

1. Black Friday at the mall: you push a shopping cart through a store before it closes.
2. Driving close to a shelf sweeps its goods into the cart; they pile into a wobbling tower.
3. A dash (one button) smashes can pyramids, grabs hot items through their ribbon, bowls over
   shoppers and rams rival carts, who do the same to you.
4. Doing things without a pause fills the Madness meter, which multiplies prices from x1 to x4.
5. Drive into an open checkout before the timer ends: the biggest receipt among the shoppers wins.

## 2. File map

<!-- FILEMAP -->

`index.html` holds the page shell and all interface CSS. `tune.json` holds the 38 tuning values in the
platform format. `dist/index.html` is the same game as one file (built by concatenating the modules in
the order above and stripping `import` / `export`); it is the simplest thing to publish.

## 3. How to provide the files

- **Simplest:** publish `dist/index.html` as the page and `tune.json` as its tune file. Nothing else is
  needed: three.js r185 comes from the platform (`https://mindblown.ai/lib/three-0.185.1/three.min.js`,
  loaded by `platform.js` when the page runs on `*.mindblown.ai`).
- **As modules:** `index.html`, then the files of `src/` in the order of the file map (each file only
  imports files above it), then `tune.json`. Keep the names and the `src/` folder: the modules import
  each other by relative path.
- `lib/three.min.js` in this package is only for running the game off the platform (the official
  three@0.185.1 build, wrapped to set the global `THREE`). Do not upload it.
- The game makes no external request of its own and contains no binary asset: models, textures, sound
  and music are generated in code.

## 4. Platform integration points (all in `src/platform.js`)

| Platform feature | Where it is used |
| --- | --- |
| `THREE` global, r185 | `loadThree()`; no module touches `THREE` at import time |
| `mindblown.tune()` and `tune.on` | `platform.init()`; values go through `applyTune()` in `config.js`; unknown names and wrong types are ignored |
| `mindblown.run.start()` / `run.end({ seconds, level })` | `main.js`: at every start of a run; at the checkout and when time runs out |
| `mindblown.run.pause()` / `resume()` | the pause screen (P, Escape, losing focus), always as a pair |
| `mindblown.load('progress')` then `save('progress', obj)` | medals, records, unlocked stores, settings; saved on events only |
| `mindblown.leaderboard.submit(metric, value, { label })` | `receipt_l1`, `receipt_l2`, `receipt_l3` (best receipt per store) and `receipt_total`; higher is better |
| `mindblown.viewer.username` | read, not shown in the current build |
| `mindblown.sound.on / set / onchange` | the game's SOUND switch and the M key go through it |

Off the platform every one of these has a local substitute (`localStorage`, `tune.json` fetched from
beside the page), so the page also runs from any static server.

### tune.json values

<!-- TUNE -->

## 5. Ten checks that the port succeeded

Open the page with `?level=1&seed=3&autoplay=expert` (a bot drives; the run is deterministic).

<!-- CHECKS -->

## 6. Fallback descriptions (enough to rebuild a file)

**Coordinates and time.** Metres; the floor is the x-z plane, y is up. A heading `h` is in radians with
forward = (sin h, cos h); positive steering turns left. The simulation runs in fixed steps of 1/120 s
with one seeded generator (mulberry32) for every random choice; rendering interpolates. Key events
carry time stamps and are applied on the step they belong to.

**Levels (`levels.js`, `world.js`).** A level is rows of text, one character per 2 m tile, plus a few
fields (timer, start heading, rivals, crowd size, list goods, store zones with a goods pool and an
accent colour, medal thresholds). Legend: space = wall; `.` floor; `S M L` shelf with small / medium /
large goods (runs merge into rows, a run of one or two tiles open on both sides is an island); `o` floor
item (lies 0.7 m toward a neighbouring shelf); `1 2 3` list items; `@` start; `r` rival start; `c`
checkout lane; `C` counter; `O` round display; `P G K` can pyramid, gift pile, cardboard stand (dash
targets that burst into goods); `H` podium with a hot item; `f` podium that appears for the flash sale;
`W` glass window (a dash opens it and pays $100; without one a cart bounces off); `F` fountain (cleared
by a jump); `X` tree; `t b m` light props that fly when touched; `p` plant; `n` bench (cleared by a jump); `> < ^ v` travelator; `~` wet floor; `R` ramp; `g` huddle of six
shoppers set up like bowling pins; `=` the cart train's track. `world.js` derives wall boxes (greedy merge of wall tiles),
shelves with their goods and "clean sweep" groups, a spatial grid of colliders (circles and
axis-aligned boxes), and a navigation field: the distance from every tile to the nearest open checkout
(8-neighbour relaxation, no corner cutting, tiles next to walls cost 1.3, travelators 0.6 with and 3
against, the two tiles in front of the checkouts 2.5 so that routes cross them straight; a lane about to
close starts at 14 m instead of 0). A driver walks that field downhill and aims at the farthest point in
plain sight.

**Cart (`cart.js`).** Two circles (nose 0.56 m, tail 0.5 m). Body heading and travel direction are
separate; each step grip pulls the travel direction toward the body (`slip -= sin(slip) * (1 -
exp(-grip * dt))`). Top speed 12 m/s, acceleration 14, braking 20, turn rate 3 rad/s falling to half
at top speed; a full cart (40 units) is slower to start (-55%), stop (-30%) and turn (-20%). Drift:
hold the button while steering above 40% speed; the body swings out, the arc depends on the stick; held
0.5 / 1.0 / 1.7 s it charges three tiers and on release boosts x1.2 / 1.4 / 1.6 for 0.7 / 1.0 / 1.4 s.
Dash: +6 m/s along the heading for 0.33 s, 1.5 s cooldown, a 0.15 s press buffer; one that hits nothing
leaves the cart at 82% top speed for 0.7 s. Walls: a glancing hit slides (keeps at least 60% speed); a
hit within 32 degrees of head-on above 6.5 m/s is a crash: the cart glances off along the wall with 55%
of its speed, loses control for 0.4 s and is immune for 1.5 s. Four invisible helpers: a lean away
from head-on hits, an arc correction while drifting, holding a lane 0.25 m off a stocked shelf, and (in
`sim.js`) a funnel that eases a cart heading into an open checkout onto the lane's centre line.
A cart pinned for 0.3 s backs out by itself. Travelators add 5 m/s; a wet tile cuts grip for a second;
a ramp taken at 7 m/s or more gives 0.9 s in the air over anything low.

**Rules (`sim.js`).** Sweeping: an untaken shelf item within cart radius + 0.6 m + 0.35 m on the
shelf's open side is taken. Floor items: within 1.2 m of the cart's centre (1.65 m at top speed). Each item's
price is locked with the multiplier of the moment. The cart holds up to 1.5 x 40 weight units; at
that cap a dearer item pushes out the cheapest ones it needs the room of. An overloaded tower (above
40) sheds one item every 0.25 s of a drift held past its second spark tier and 1-3 on a knock above
5 m/s (never on the shelf being swept or a counter, never a hot item). A crash drops up to 40% of the
goods, fanned to both sides; a ram drops the top 30% (half that between two rivals). No single hit takes
more than 40% of the cart's dollars from the player; a ram on a rival always knocks its top item off.
Dropped goods lie for 4 s. List items never leave the cart. Madness: a meter of four segments (see D31 in DEVLOG.md for every
gain); four full segments give 6 s of MADNESS mode (x4, double reach, no weight, every touch a dash),
then the meter is at x2. Events: rocket start for pressing the accelerator within 0.15 s before to
0.25 s after GO; a flash sale at 40% of the timer (a hot item for 10 s at the nearest sale spot at least
24 m ahead of the player; rivals leave it alone for 3 s); closing time from the moment the first cart
is within 90 m of the checkouts, or with `closing` seconds on the clock: the checkouts close one by one
over `closing` seconds (15; Level 1: 22) with 2 s of warning each, never in the face of a cart at the
lane's mouth, and the last one stays open. Receipt: items + $200 for all three list items + stunts + $15 per second
left. When the player has checked out, the rest of the race is simulated to its end for the table.

**Drivers and crowd (`ai.js`).** One driver fills the same input structure as the keyboard, for
rivals and for the test bots (beginner, confident, expert, sloppy). It follows the navigation field,
slows for bends and for what is ahead, goes for goods ahead on the route (list items first), dashes at
targets it decided on at first sight, and rams carts with loot when in the mood. Rivals are paced to
stay near the player in position and in money (off for the first 12 s and the last fifth of the
route); a level's `rivalEdge` scales how fast they build their multiplier. A ram on the player is
announced 0.8 s ahead ("!" and a red line on the floor); the rival holds that line and lunges down it,
so steering off it dodges (DODGED!, $40). The player is never rammed more than `maxRams` times. Characters: Granny Tank (slow, starts ahead with a tower at x2, only gives way to a
heavy or boosted cart), Sprint Dad (fast, vengeful), Coupon Queen (runs for hot items and shouts),
Selfie Star (stops for a photo that pays her $150; shoppers gather), Bulk Bro (charges whoever rammed him). Shoppers
stand, stroll, jump clear (6 in 10), get bowled over for 1.3 s (5% of a cart's speed) and run to the
flash sale; five bowled over in one dash is a STRIKE (a huddle's pins only go down to a dash and step
back into formation otherwise), a pass within half a metre a CLOSE SHAVE. The
cart train (three carts) shuttles along its track at 7 m/s, rests 1.4 s at each end and shoves aside
whoever is in the way (a quarter of the goods); drivers whose nose points at the track wait for it.

**Look (`gfx.js`, `models.js`, `scene.js`, `fx.js`).** One custom toon shader (two tones with a hard
edge, shadow tone = colour x (0.62, 0.58, 0.78), colours written as sRGB without tone mapping) and an
inverted-hull outline of constant pixel width (2.0 / 3.2 px at 1080p) using a second, smoothed normal
per vertex. Everything is built from three primitives (chamfered box, cylinder or cone, ellipsoid)
with vertex colours. The floor is one quad whose shader reads a tile map (store tint, chevrons along
the route, checkout hatching, travelator arrows, wet sheen, wall shadow). Goods, shadows, the crowd
and checkout lamps are instanced. The goods in a cart are packed six columns wide (small ones three
abreast, medium and large two, hot items across): a heap low enough to see the way ahead over. The camera sits high behind the cart, lags its yaw, widens with
speed and tips over walls. Palette: cream floor and walls, plum outlines and wall caps, four store
accents; pink belongs to the player alone, teal to the shopping list, gold to hot items, the checkout
and interface plates, red to danger and prices.

**Interface (`ui.js`, `index.html`).** HTML over the canvas in the style of price tags and receipts:
timer plate, receipt tag and place, Madness meter (five pips: the lit ones are the multiplier, the
fifth fills toward MADNESS mode), three list icons (pictures of the real models),
announcer line, one pop-up word at a time, floating prices, an arrow to the current event, key hints
for the first runs, touch pads (steering left, dash / drift / brake right, automatic accelerator),
title with a loyalty card, receipt with the final table, medal and record, pause with sound settings.

**Sound (`audio.js`).** WebAudio only: oscillators and filtered noise with short envelopes into an
effects bus and a music bus, then a limiter. Five continuous noises are only turned up and down (drift screech,
rolling, crowd murmur, the train's rattle, a travelator's whirr). A two-chord funk tune of sixteen bars
on a 16-step grid (bass, drums, chord stabs, a lead, cowbell and claps) whose layers follow the
multiplier, with a resonant filter sweep in MADNESS mode, a faster tempo at closing time and a
low-pass on the pause screen. Sound starts after the first key or click.
