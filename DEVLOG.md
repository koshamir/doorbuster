# DOORBUSTER — development log

## STATUS (updated after every meaningful step)

- **Current milestone:** M2 Core — implemented and measured; waiting on its fresh-eyes review. M0 is
  tagged `m0`. M1 is measured; its review is running; tag `m1` follows the fixes from it.
- **Done:** PLAN.md · tooling (playwright-core 1.61.1 with the cached Chromium 1228, three r185 copy) ·
  cart model with drift tiers, dash, weight, glancing crashes, pin back-out · camera · particles ·
  sweeping, floor pickup, tower with sway and spills, shopping-list items, timer, checkout, receipt,
  title, retry · Level 0 (gauntlet test course) and Level 1 (grey-box) · bots (beginner, confident,
  expert, sloppy) · instruments (`tools/`: sim, script, shots, check, build, serve).
- **Next:** M2 review → tag `m2` → M3 Style (final look of Level 1: toon materials are in, needs real
  goods, shelves, beans, floor and wall dressing, HUD polish, pink-share metric) → M4 Life.
- **Open problems:** the expert bot cannot thread a shelf aisle placed within 8 m of a hairpin exit
  (levels keep 12 m clear after hairpins; revisit with rivals in M4) · video capture not written yet ·
  frame rate on integrated graphics cannot be measured here (RTX 4060) · camera wall-lift is written
  but no capture has triggered it yet.
- **How to resume:** `node tools/check.mjs && node tools/sim.mjs && node tools/script.mjs`, then
  `node tools/shots.mjs --set m2` and look at `shots/m2`. Gate evidence in text form is in `gates/`.

## Decisions

| # | Decision | Reason |
| --- | --- | --- |
| D1 | The 15-file / 8,000-line budget covers the shipped game (`index.html`, `src/*.js`). Instruments live in `tools/` and are not handed to Mindblown. | The limit exists so another AI can read and reproduce the game. `tools/check.mjs` enforces it. |
| D2 | `lib/three.min.js` is the official `three@0.185.1` CommonJS build from the npm registry wrapped to set the global `THREE`. `platform.loadThree()` uses the Mindblown-hosted bundle on `*.mindblown.ai` and the local copy elsewhere. No module touches `THREE` at import time. | Platform tag on the platform, zero external requests locally, no edits for the move. The hosted branch is exercised by the `platform` capture scenario (page served as `play.mindblown.ai`, hosted URL answered from the local copy, SDK replaced by a recording stand-in). |
| D3 | Fixed step 1/120 s, render interpolation, at most 20 steps per frame. Key events are queued with their time stamps and applied on the step they belong to. | Next-frame response at any display rate; a 30 m/s cart moves 0.25 m per step against a 0.6 m radius. Input timing no longer depends on where a frame boundary falls. |
| D4 | Cart model: body heading and travel direction are separate; grip rotates the travel direction toward the body without changing speed (`slip -= sin(slip) * (1 - exp(-grip*dt))`). | Predictable like a kart: in a steady turn `sin(slip) = yawRate / grip`; hits only change the velocity vector. |
| D5 | Levels are an ASCII tile plan (2 m tiles) plus short annotations; walls, colliders, shelves and navigation are derived in `world.js`. The edge of the plan is solid even if a level forgets its border. | Levels are data; a plan is readable and diffable. `check.mjs` validates every level (border, start, checkout, every floor tile reaches a checkout). |
| D6 | Navigation is a distance field to the open checkouts on the tile grid plus a walk downhill; a driver aims at the farthest point of that walk that is visible and within a speed-scaled reach, and between two ways of nearly equal length takes the one nearer the cart. | A direction exists from every floor tile; a short reach keeps drivers lined up for narrow places. |
| D7 | Steering helper: every third step the cart's path is marched ahead 0.45 s; a nearly head-on contact leans the cart toward the glancing side, and if only one side of the path is blocked it swerves past. Glancing approaches are left alone so shelves can be hugged. | GDD 5.1 "slight steering assist away from head-on wall hits". |
| D8 | **A crash glances off.** A nearly head-on hit at speed redirects 55% of the speed along the surface (toward the driver's steering, else toward where the obstacle ends), whips the nose round in a 0.4 s stun, spills goods and starts the immunity. During immunity the same hit glances off again but costs nothing. Two glancing surfaces that stop the cart in one step (an inside corner) count as one hard hit against the bisector. | GDD 4: "a crash costs goods, not momentum". Before: 12 → 1.5 m/s and 2–3 s to recover. Now: back at 75% of top speed in 0.65 s (M0 review, finding 1). |
| D9 | **Pinned carts free themselves.** Nose against something while pushing: the cart swings along the surface in a latched direction (4.5 rad/s); if it is still not moving after 0.3 s it backs out for 0.32 s and swings the other way. | QUALITY: "never stays stuck for more than half a second". A notch between two obstacles made the unlatched swing dither. |
| D10 | **The dash is a commitment.** It adds `dashspeed` to the current speed (from rest it reaches 65% of top, not full speed) and a dash that hits nothing leaves top speed at 75% for 0.8 s. A dash that hits a target will cancel that (M4). | M0 review, finding 5: the dash was free speed (+20% when mashed). Now mashing is worth +4%. |
| D11 | **Drift follows a clean arc.** On entry the body swings to the slip angle its arc holds (`driftKick`), so the path curves from the first frames; on release the body swings back onto the path instead of the path snapping to the body. Arc rate does not depend on speed. `driftturn` 1.4 → 1.15, `driftgrip` 2.5 → 3.5, stick range 0.53–1.0 of the full rate. | With the starting values the cart spun out at full lock, and the path lagged the body (60° of path for 93° of body in 0.7 s, then a 30° kink at release). Measured arcs now: stick in 6.6 m, neutral 8.5 m, out 11.5 m; slip 31°, 24°, 17°. |
| D12 | Camera yaw follows the travel direction with a lag (rate 6.5/s) and no lead; the cart body leans and yaws from the raw input. | M0 review, finding 3: lead and lag cancelled, so a turn showed only as the floor rotating. Now the cart yaws about 15–20° on screen in a full-lock turn. |
| D13 | Shopping-list items are three marked items on the main route (teal), not kinds of goods; they always fit in the cart and stay marked when spilled. | Making three kinds "listed" turned whole shelves teal and completed the list by accident. |
| D14 | Spilled goods land 3–4 m ahead along the direction the cart glances off; `recollect` 3 s → 4 s. A spill never exceeds `spillmax` (rounded down). | So that a driver who keeps going scoops some back up; with the crash now carrying the cart along the wall, goods left at the impact point were unreachable in 3 s. |
| D15 | Level 1 has about 5.3 cart-loads of goods (160 units), not 3. | Four carts compete for them once rivals arrive (M4); to be re-checked against the rival receipts then. |
| D16 | Level 1 timer 75 s (GDD range 75–90). | Expert without collecting takes 36 s (48%) on an empty level; the target 55–65% is re-measured once crowd and rivals exist (M4) and the timer or the route is adjusted then. |
| D17 | Capture runs Playwright's own Chromium 1228 (already cached on this machine) in new headless mode with the real GPU. | The installed Google Chrome refuses headless mode ("disallowed by the system admin"); that policy was left alone. `playwright-core` is pinned to 1.61.1 to match the cached browser, so nothing was downloaded outside the npm registry. |
| D18 | A `CLAUDE.md` for a different jam game sits in the parent `Downloads` folder and is auto-loaded. Its stack and language rules are ignored here; this project's own brief is more specific. The owner's start message replaces "stop at each gate" with the self-gate. | Recorded because a reviewer flagged both. |
| D19 | `skill.md` (v1.5.1) and `sdk.md` were re-read on 22 Nov 2026. Differences from `docs/MINDBLOWN.md`: the hosted three.js bundle also carries the glTF loader and post passes (core only is used); `leaderboard.submit` takes `{ lower, label }`; saves need `load` before `save` and reject on error; the builder refuses publishes without `run.start()`/`run.end()`. | The primary source wins. `platform.js` follows sdk.md. |

## Reviews

### M0 fresh-eyes review (22 Nov) — findings and what was done

| # | Finding | Verdict | Action |
| --- | --- | --- | --- |
| 1 | Crashes kill momentum (12 → 1.5 m/s, 2–3 s to recover); a corner clipped by 0.4 m sends the cart away from the opening; a cart wedges between two displays | valid | D8, D9. Head-on crash keeps 7.5 m/s after 0.5 s; the glance goes toward the opening; notch: longest standstill 0.12–0.22 s; inside corner 0.12–0.21 s |
| 2 | The test hall cannot fail the instruments (a 65 m diagonal) | valid | Level 0 is now a gauntlet (slalom, doorway, two hairpins, shelf aisle, notch, shelf end, chicane) with marks; `sim.mjs` prints clean-pass rates per obstacle |
| 3 | The camera hides steering | valid | D12; `shots/m1/turn_strip.png` |
| 4 | The player does not own the frame (more white lid than pink) | valid | Basket opened, rim in the cart's colour now; hero ground ring and a pink-share metric are M3 items |
| 5 | Dash is free speed; drift tiers ignore geometry | valid | D10, D11; `script.mjs --only bends` reports the tier a 90° bend and a hairpin pay and how wide the turn-in window is |
| I1 | Tunnelling test could not fail (cart never reached the wall) | valid | Rewritten: fixed speeds 12–30 m/s, 40 start offsets each, must touch and must stay in front |
| I2 | Frame-rate test was a tautology | valid | Rewritten through the real frame loop. It showed 0.4–0.95 m of drift between display rates after 8 s, caused by keys being sampled once per frame; the time-stamped key queue (D3) removed it (0.000 m) |
| I3 | Walls table lacked recovery time; drift "radius" was body yaw, not the path; pinned tested empty only | valid | All three added (full cart rows, path radius from the travel direction) |
| I4 | Frame sample was mostly countdown; logic time one coarse sample | valid | Real-time sample starts after GO and runs 8 s; logic cost measured in Node per step |
| I5 | Debug screenshot showed no statistics | valid | Read-out fills on its first frame |
| I6 | A finished cart reversed at 4.2 m/s | valid (bug) | Parked carts roll to a stop |
| I7 | No level validator; floor on the plan edge lets a cart leave the world | valid | Validator in `check.mjs`; the plan edge is solid in `collide` |
| C1 | The `m0` commit was not the measured state; DEVLOG status was stale; no tag | valid | Status is kept current; gate numbers live in `gates/` as text and are committed with the tag |
| C2 | All 15 files are allocated, nothing can be split | noted | 14 files in use; `audio.js` is the last. If a file outgrows 600 lines, two small ones merge first |
| C3 | The hosted three.js branch is never run | valid | `platform` capture scenario (D2): hosted URL requested once, SDK calls recorded: `tune`, `tune.on`, `load progress`, `run.start`, `run.end {seconds: 40, level: 1}` |

## Milestone gates

Numbers below are from `gates/metrics-latest.txt` (checker, 30 bot runs per level, the maneuver suite)
and `gates/m*-capture.json` (browser captures).

### M0 Skeleton + instruments — gate passed, tag `m0`

Gate (QUALITY §2): *no console errors or external requests, the simulation runs.*

| Criterion | Result | Evidence |
| --- | --- | --- |
| Page in the platform format | pass | `index.html` with one `<meta name="description">`, ES modules from the page's origin, three.js through `platform.loadThree()`, `tune.json` beside the page |
| No console errors, no failed requests | pass | `shots.mjs --set m0`: 7 scenarios, "console clean" |
| No external requests | pass | every request is on the local origin; `check.mjs` scans the shipped files for URLs |
| Fixed-step loop | pass | same per-step input in 30/60/144/240 Hz frames: identical state |
| `tune.json` in the platform format | pass | 38 entries (limit 40), names valid, values in range, defaults in `config.js` equal the file |
| Platform layer with stubs | pass | local: `localStorage` + `tune.json`; platform stand-in: calls recorded as listed in C3, tune value 12.5 from the stand-in applied |
| Debug mode | pass | `shots/m0/debug_5.png`: statistics, 38 sliders, copy JSON, level jump, slow-mo, fill cart, bot switch |
| Simulation from Node, three bot modes, scripted runner | pass | `sim.mjs`, `script.mjs`; logic costs 1.4–1.9 µs per step (0.004 ms per frame; budget 6 ms) |
| Screenshots, strips, console and network capture | pass | `shots/m0`: 15 frames, strip, squint, 800×450 and phone frames |
| Single-file build | pass | `dist/index.html` (146 KB): same run to the cent as the module build (`t` 41.26 s, 36 items, $864) |
| Budgets | pass | 14 files, 2,950 lines; 153 KB without three.js; 26–38 draw calls, 15–21k triangles; 165 fps, p95 6.1 ms on RTX 4060 (not representative) |

### M1 Toy — measured, review pending

Gate: *driving is fun with no goals* (owner playtest replaced by the measurements and frames below).

| Criterion (QUALITY §4 Cart and camera, GDD 5.1) | Result | Number |
| --- | --- | --- |
| Input responds on the next frame | pass | state changes on the first 1/120 s step (yaw 0.12 rad/s, speed 0.12 m/s); the body lean and yaw follow the raw input the same frame |
| Identical at 60 and 144 Hz | pass | the same timed key script through the real frame loop ends in the same state at 30, 60, 144 and 240 Hz (0.000 m apart); with keys sampled once per frame it was up to 0.42 m |
| 0 → 95% of top speed | — | empty 1.04 s (6.7 m), full 2.08 s (12.1 m): "about half as fast" |
| Stop from top speed | — | empty 0.61 s (3.6 m), full 0.80 s (4.1 m): "about a third longer" |
| Turn radius at top speed | — | empty 7.3 m, full 7.6 m; corridors are 10 m |
| Empty versus full is felt within 3 s | pass | from rest a full cart covers 27% less ground in 3 s; top speed 12 → 10.8 m/s |
| Slides along walls | pass | 10–45° to the wall: keeps 10.4–12 m/s after 0.5 s, never below 8 m/s |
| A crash costs goods, not momentum | pass | 60–90°: 7.5–7.7 m/s after 0.5 s, back to 75% of top in 0.63–0.66 s (full cart 0.91 s); control lost 0.40 s (limit 1 s) |
| Does not stick on corners | pass | corner clipped by up to 0.85 m of the cart: swerved past, no crash; by 1.1 m: one crash, slowest 6.3 m/s |
| Never stuck more than 0.5 s | pass | nose-first: moving after 0.29 s (full 0.36 s); inside corner 0.12–0.21 s; notch 0.12–0.22 s; longest standstill in 300 bot runs 0.47 s |
| No tunnelling | pass | 0.3 m wall at 12/18/24/30 m/s × 40 offsets: 160/160 touched and stayed in front |
| Gap of two cart widths at full speed | pass | 2.2 m gap (1.8 widths): untouched at 0, 0.25, 0.4 m off-centre |
| Beginner gets the first drift tier on the second attempt | pass | random sloppy attempts: 66% per try, 88% within two (86% per try when held 0.65 s or longer); 13% crash |
| Drift tiers against real corners | — | 90° bend pays tier 1 from a 10 m wide turn-in window, tier 2 only with the stick out (0.5 m window); a hairpin pays tier 2 (10 m window) and tier 3 with the stick out (2.5 m window) |
| Camera shows the cart and about 2 s of road | pass | cart at screen x 0, y −0.27…−0.37 (two thirds down); 2.3 s of floor ahead at top speed, 1.9 s at dash and boost peaks |
| Camera never goes through walls | pass | camera height ≥ 7 m, walls 2.4 m |
| Camera never jitters | pass | yaw reversals: 0.2–0.4 per second with scripted keys, 0.5–1.0 with bots |
| Seams do not catch | pass | 30 separate boxes versus one wall: min speed 10.4 versus 10.7 m/s |

Why these values (against how comparable arcade racers behave): karts reach top speed in 2.5–4 s, top-down
arcade racers in 1–1.5 s. Runs here last 60–75 s with a bump every few seconds, so the empty cart is tuned
to the fast end (1.0 s) and the full cart lands in kart territory (2.1 s) — the weight is felt at once.
The normal turn radius (7.3 m) fits a 10 m corridor only on a good line; the drift widens the choice to
6.6–11.5 m and pays for holding it, as a mini-turbo does. Tier times 0.6/1.2/2.0 s sit slightly below a
kart's because the corners here are shorter. Boosts are +20/40/60% for 0.7/1.0/1.4 s.

### M2 Core — measured, review pending

Gate: *full loop "start → checkout → receipt → again"; the beginner bot finishes.*

| Criterion (QUALITY §4 Pickup and the tower, Interface, §5) | Result | Number |
| --- | --- | --- |
| Full loop | pass | `shots/m2`: title → countdown → run → receipt → retry; time-up → STORE CLOSED → retry |
| The beginner bot finishes | pass | 30/30, 52.3 s average, slowest 55.6 s of 75 s (19 s to spare; limit 10 s) |
| No dead ends, no stuck | pass | 150 runs on Level 1: 0.1 stuck events per beginner run, 0 for the others; longest standstill 0.47 s |
| A beginner sweeps 10+ goods off the first shelf | pass on average | 13.6 of 15 on average, worst of 30 runs 7; a floor trail leads to it |
| No visible misses | pass | 30/30 goods taken at gaps 0–0.6 m at 6, 12 and 19 m/s; 0/30 at 0.8 m |
| An item flies in no more than 0.25 s and lands on the tower | pass | flight 0.20 s; goods leave one after another 30 ms apart and are drawn in the cart, never removed |
| A hit costs at most 40% | pass | 20 → 12, 40 → 24, 6 → 4, 2 → 2 |
| Spilled goods can be recovered | pass | they land ahead of the glancing cart: 2/2 and 8/8 recovered by a driver steering at them within 4 s |
| Careful expert delivers an overloaded tower, sloppy loses part | pass | expert: 1.63 × full, 0 spilled; sloppy: 3.3 spilled per run, list completed 73% versus 100% |
| Restart in a second and a half | pass | level rebuilt in 14 ms, countdown 1.2 s |
| 20 restarts without memory growth | pass | heap growth 0.0 MB after 20 restarts |
| One click, no more than 3 s to playing | pass | START → GO in 2.4 s |
| Receipt lines | pass | ITEMS, LIST, STUNTS, TIME, TOTAL; any click prints the rest at once |

Level 1 as it stands (no rivals or crowd yet): route 415 m, 160 units of goods.

| Bot | Finish | Time | Of the 75 s timer | Receipt (median) | Items $ | Time $ | List | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beginner | 100% | 52.3 s | 70% | $1,228 | 654 | 335 | 97% | 1.46 × |
| confident | 100% | 42.6 s | 57% | $1,401 | 676 | 477 | 100% | 1.55 × |
| expert | 100% | 41.4 s | 55% | $1,533 | 807 | 496 | 100% | 1.63 × |
| sloppy | 100% | 42.4 s | 57% | $1,497 | 851 | 480 | 73% | 1.63 × |
| expert, no collecting | 100% | 35.9 s | 48% | $695 | 123 | 582 | — | 0.38 × |

Known gaps carried into later milestones: the Madness multiplier (M4) will decide whether items or time
dominate the receipt; the expert without collecting is at 48% of the timer against a 55–65% target (D16);
grey-box art (M3).
