# DOORBUSTER — build plan

Written 22 November 2026, before the first line of code. Autonomous run: milestones M0–M7 without
owner playtests; every gate is replaced by the self-gate described at the end of this file.

## 1. The game in ten lines

1. Black Friday at a toy-diorama mall: you push an oversized shopping cart from the doors to the checkouts in 75–90 s.
2. Driving is the toy: sharp kart steering, a hold-to-drift with a three-tier boost, a short dash on a 1.5 s cooldown.
3. There is no grab button: hug a shelf with the side of the cart and goods arc into it, pop-pop-pop, rising in pitch.
4. Everything taken is visible as a wobbling tower. The tower is the score, the weight and the risk.
5. Weight is free up to 30% load, then acceleration, braking, top speed and turning degrade; 150% is OVERLOADED.
6. Crashes, rams and hard landings spill up to 40% of the tower from the top; spilled goods flash for 3 s and anyone can take them.
7. The dash is the one verb for everything else: ribbons, glass, pyramids, shoppers (STRIKE) and rivals (they drop loot).
8. Madness is a four-segment meter and the price multiplier (x1–x4); overfill it for 6 s of MADNESS mode.
9. Three to five rival shoppers play by the same rules, a light crowd is the slalom, and three events shape a run:
   DOORS OPEN, FLASH SALE at 40% of the timer, CLOSING TIME in the last 15 s.
10. Drive into an open checkout before zero: receipt (ITEMS, LIST, STUNTS, TIME), medal, place, retry in 1.5 s.

Quality bar: a judge who plays five minutes must see the crush at the start, sweeping, a ram, Madness mode,
closing time and a checkout, never wonder what to do, never lose control for more than a second, and never
see a placeholder, a default font, silence or a console error. A still frame should work as a cover.

## 2. Main risks and how they are handled

| Risk | Handling |
| --- | --- |
| Feel cannot be tested by hand | Feel is turned into numbers (0→top time, stopping distance, turn radius, drift-tier timings, next-frame response, loss-of-control time, pace gaps, near-zero-speed share) and re-measured by the scripted-input runner after every change to movement, collisions or camera. |
| 8,000-line / 15-file cap versus a long feature list | One cart model for player, rivals and bots; one instanced goods system for shelf, air, tower and floor; levels as a tile plan plus annotations; scope is cut only in the GDD order (Must → Should → If time allows). A budget checker runs at every gate. |
| Rivals getting stuck or looking stupid | Navigation is a distance field to the checkouts on the tile grid plus line-of-sight smoothing, so a direction exists from any floor tile; stuck recovery is counted and reported by the 200-run simulation. |
| Chaos unreadable from a high camera | Player-only hot pink, muted crowd, plum outlines, blob shadows, low walls; squint test on 320 px frames at every gate. |
| Performance on integrated graphics (dev machine has an RTX 4060, so fps here proves little) | Hard budgets on draw calls and triangles checked by instruments; one light custom toon shader, no shadow maps, instancing everywhere; automatic quality drop when frames run long. |
| Port to Mindblown must reproduce the game | Deterministic fixed-step logic with its own seeded RNG, no DOM in the logic files, platform reached through one adapter, `dist/index.html` built and tested as a single file, numeric port checks in `HANDOFF.md`. |
| Headless WebGL differs from a real GPU | Screenshots are taken in real Chrome with GPU acceleration where available; software rendering is only a fallback. |
| Long session, context resets | STATUS block at the top of `DEVLOG.md`, small verified steps, a git commit and tag per milestone. |

## 3. Design decisions and changes (reasons in `DEVLOG.md` → Decisions)

1. **Drift model.** Body heading and travel direction are separate; grip rotates the travel direction toward
   the body without changing speed, plus a small explicit scrub. The slip angle is then `asin(yawRate / grip)`
   and stays predictable. With this model the starting `driftgrip` of 2.5 would put the cart almost sideways,
   so the value is retuned by measurement.
2. **Rivals do not enter MADNESS mode.** They earn the same multiplier but the 6 s mode is the player's
   spectacle; several carts in "every touch is a dash" mode would be unreadable and unfair.
3. **Final table.** When the player checks out, the rest of the race is simulated to the end at full speed
   behind the checkout cut, so rival receipts in the table use the real rules and are deterministic.
4. **Goods on shelves.** The front row is the oversized sweepable goods with glowing price tags; the stock
   behind is muted decoration. A level carries roughly 3–4.5 cart-loads so that rivals and the player compete
   for the same goods.
5. **Levels are data**: an ASCII tile plan (2 m tiles) for floor, walls and grid pieces, plus short annotation
   lists (shelf themes, movers, sale spots). Walls, colliders and navigation are derived from it.
6. **Budget scope.** The 15-file / 8,000-line limit applies to the shipped game (`index.html`, `src/*.js`).
   Instruments live in `tools/` and are not part of the handoff code.
7. **three.js copy.** The platform's `three.min.js` is its own r185 bundle. The offline copy in `lib/` is the
   official `three@0.185.1` build from the npm registry wrapped to set the same global `THREE`; only core
   classes are used. The page picks the platform URL on `*.mindblown.ai` and the local copy elsewhere, so
   there are no external requests locally and no edits are needed for the move.
8. **Fixed step 1/120 s**, rendering interpolated; identical behaviour at 60 and 144 Hz by construction.
9. **Language and stack** follow this project's `CLAUDE.md` (English, plain JS, global `THREE`). A different
   jam's `CLAUDE.md` sits in the parent `Downloads` folder and is loaded automatically; it does not apply here.

## 4. Files

Shipped game (budget: ≤ 15 files, ≤ 8,000 lines, target ≈ 6,500):

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, CSS for the whole interface, three.js loader |
| `src/config.js` | Tune defaults, constants, palette, goods, characters, seeded RNG |
| `src/levels.js` | Level data: plans, annotations, timers, medals |
| `src/world.js` | Level data → colliders, shelves, pieces, navigation field; collision queries |
| `src/cart.js` | Cart model: steering, drift, dash, weight, wall response |
| `src/sim.js` | The run: pickup, tower, spills, Madness, events, hazards, checkout, receipt |
| `src/ai.js` | Rival drivers, bot player (beginner / confident / expert), crowd |
| `src/platform.js` | Mindblown adapter with local stubs |
| `src/gfx.js` | Renderer, toon and outline materials, camera, quality scaling |
| `src/models.js` | Procedural geometry: rounded boxes, cart, beans, goods, mall kit |
| `src/scene.js` | Builds the level visuals and syncs moving things every frame |
| `src/fx.js` | Particles, floating prices, shake, hit-stop, speed lines, confetti |
| `src/audio.js` | WebAudio synth: music, effects, voices |
| `src/ui.js` | HUD, receipt, menus, touch controls, teaching icons, debug panel |
| `src/main.js` | Boot, input, fixed-step loop, state machine |

Instruments (`tools/`, Node): `serve.mjs` (static server), `sim.mjs` (batch runs and criteria table),
`script.mjs` (scripted-input maneuvers), `shots.mjs` (Playwright screenshots, frame strips, video, console
and network checks), `check.mjs` (budgets, tune format, external-URL scan), `build.mjs` (`dist/index.html`).

## 5. Milestones

| Milestone | Content | Self-gate evidence |
| --- | --- | --- |
| M0 Skeleton + instruments | Page in platform format, fixed-step loop, tune loading, platform adapter, debug mode, test hall, cart v0, headless sim, bot v0 in three modes, scripted-input runner, Playwright capture, budget checker | Clean console, zero external requests, sim and maneuver tables print |
| M1 Toy | Final cart model (steering, drift tiers and boost, dash, weight, wall slide, assists) and camera in the test hall | Feel table versus targets, drift-tier strip, wall-slide and tunnelling tests, 60/144 Hz equality |
| M2 Core | Sweeping, floor pickup, tower and spills, timer, checkout, receipt, restart on a grey-box level 1 | Full loop by the beginner bot, pickup and tower criteria |
| M3 Style | Final look: toon material, outlines, palette, cart, beans, shelves, 12+ goods, floor, walls, lighting, HUD styling | Art acceptance (ART §9), draw calls and triangles, squint test |
| M4 Life | Rivals (3+ characters), crowd, every dash target, Madness, three events | 200-run tables for rivals, Madness and crowd criteria |
| M5 Content | Mall kit, levels 1–3 (then 4), icon teaching, medals from measurements, saves, leaderboards, mobile controls | Level criteria per level, 800×450 and phone frames |
| M6 Juice | Music, effects, announcer, particles, interface animation, receipt tally | 30 s recording reviewed frame by frame, sound criteria |
| M7 Polish + handoff | Bugs, edge cases, performance, balancing, release checklist, handoff package, jury review, `REPORT.md` | QUALITY §6 closed, clean-copy test |

## 6. Self-gate (replaces the owner's playtest at every milestone)

1. Every applicable criterion from QUALITY §3–5 and the milestone gate is recorded in `DEVLOG.md` as
   pass or fail with a number or other evidence.
2. At least 8 screenshots plus frame strips of the milestone's key actions are captured and judged against
   ART §9 and the reference images.
3. A fresh reviewer subagent, given only the docs, frames and metrics, lists the five biggest problems as a
   demanding jam judge. Valid findings are fixed; the rest are answered in `DEVLOG.md`.
4. Failures are fixed and re-measured, then the milestone is committed and tagged `m0` … `m7`.
