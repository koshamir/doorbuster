# DOORBUSTER — development log

## STATUS (update after every meaningful step)

- **Current milestone:** M0 self-gate (review, commit, tag), then M1 Toy.
- **Done:** PLAN.md; tooling (playwright-core 1.61.1 + cached Chromium 1228, three r185 copy in `lib/`);
  game skeleton (13 files, 1,925 lines): config, levels (test hall), world builder, cart model v0, sim core,
  bot driver v0, platform adapter, renderer with toon + outline shaders, scene, debug panel, main loop;
  instruments: `tools/sim.mjs`, `tools/script.mjs`, `tools/shots.mjs` (+ `shotsets.mjs`), `tools/check.mjs`,
  `tools/build.mjs`, `tools/serve.mjs`, `tools/vendor-three.mjs`.
- **Next:** M1 — retune drift (slip far too large at driftgrip 2.5), camera wall occlusion, visible dash and
  drift feedback, hall driving strips; then M2 pickup/tower/checkout loop.
- **Open problems:** drift spins out when held at full lock (see M0 numbers); video capture not written yet
  (frame strips exist); integrated-GPU frame rate cannot be measured on this machine (RTX 4060).
- **How to resume:** `node tools/check.mjs && node tools/sim.mjs && node tools/script.mjs` then
  `node tools/shots.mjs --set <milestone>`; milestone state is in the gate tables below.

## Decisions

| # | Decision | Reason |
| --- | --- | --- |
| D1 | The 15-file / 8,000-line budget covers the shipped game (`index.html`, `src/*.js`). Instruments live in `tools/` and are not handed to Mindblown. | The limit exists so another AI can read and reproduce the game; the tools are not part of the game. `tools/check.mjs` enforces the budget. |
| D2 | `lib/three.min.js` is the official `three@0.185.1` CommonJS build from the npm registry wrapped to set the global `THREE` (`tools/vendor-three.mjs`). `platform.loadThree()` uses the Mindblown-hosted bundle on `*.mindblown.ai` and the local copy elsewhere. | MINDBLOWN.md asks for the platform tag plus an offline copy; QUALITY asks for zero external requests. The platform file is the platform's own bundle (skill.md says it also carries the glTF loader and post passes), so only core classes are used. No module touches `THREE` at import time, so `main.js` can load it first and `index.html` needs no inline script. |
| D3 | Fixed step 1/120 s (`CFG.STEP`), render interpolation, accumulator capped at 20 steps per frame. | Next-frame response at any display rate; a 24 m/s cart moves 0.2 m per step, well under its 0.6 m radius, so nothing tunnels. Measured identical at 30/60/144/240 Hz. |
| D4 | Cart model: body heading and travel direction are separate; grip rotates the travel direction toward the body without changing speed (`slip -= sin(slip) * (1 - exp(-grip*dt))`), plus small explicit scrub terms. | Predictable like a kart: in a steady turn `sin(slip) = yawRate / grip`, so drift angle is a tuning value instead of an emergent accident. External hits just change the velocity vector. |
| D5 | Levels are an ASCII tile plan (2 m tiles) plus short annotations; walls, colliders, shelves and navigation are derived (`world.js`). | "Levels are data, not code"; a plan is readable by a human or another AI and trivially diffable. |
| D6 | Navigation is a distance field to the open checkouts on the tile grid (relaxation over 8 neighbours, no corner cutting, tiles next to obstacles cost 1.3x) plus line-of-sight smoothing along the downhill walk. | A direction exists from every floor tile, so rivals and bots cannot be lost; shortcuts opening or checkouts closing only need a rebuild of one array. |
| D7 | Steering helper: every third step the cart's path is marched ahead 0.45 s; a nearly head-on contact (cos < -0.55) leans the cart toward the glancing side, and if only one side of the path is blocked (corner, shelf end) it swerves past (1.05 rad/s). Glancing approaches are left alone so shelves can be hugged. A cart pinned nose-first while pushing swings along the wall at 4.5 rad/s. | GDD 5.1 "slight steering assist away from head-on wall hits"; QUALITY "does not stick on corners, never stuck more than half a second". Measured below. |
| D8 | The dash sets speed to max(current, half top) + `dashspeed` along the body and, for 0.5 s after it ends, speed above top bleeds at 22 m/s² instead of 9. | The dash is a lunge for hitting things; mashing it on a straight is worth about +15% speed, enough to feel good, not enough to replace the drift boost. |
| D9 | Capture runs Playwright's own Chromium 1228 (already cached on this machine by an earlier project) in new headless mode with the real GPU. | The installed Google Chrome refuses headless mode ("disallowed by the system admin"); that policy was left alone. `playwright-core` is pinned to 1.61.1 because it matches the cached browser, so nothing was downloaded outside the npm registry. |
| D10 | A `CLAUDE.md` for a different jam game sits in the parent `Downloads` folder and is auto-loaded by the tool. Its stack and language rules are ignored here. | This project's own `CLAUDE.md` is more specific and contradicts it (plain JS, English). |
| D11 | `skill.md` (v1.5.1) and `sdk.md` were re-read on 22 Nov 2026. Differences from `docs/MINDBLOWN.md`: the hosted three.js bundle includes the glTF loader and post-processing passes (we still use core only); `leaderboard.submit` takes `{ lower, label }`; saves need `load` before `save` and reject on error; the builder refuses publishes without `run.start()`/`run.end()`. | The primary source wins. `platform.js` follows sdk.md. |

## Milestone gates

### M0 Skeleton + instruments — self-gate

Gate (QUALITY §2): *no console errors or external requests, the simulation runs.*

| Criterion | Result | Evidence |
| --- | --- | --- |
| Page in the platform format | pass | `index.html` entry with one `<meta name="description">`, ES modules from own origin, three.js through `platform.loadThree()`, `tune.json` beside the page |
| No console errors | pass | `tools/shots.mjs --set m0`: 6 scenarios, "console clean" (a favicon 404 found on the first run was fixed with an inline `data:` icon) |
| No external requests | pass | same run: every request is on the local origin; `tools/check.mjs` scans shipped files for URLs (only the hosted three.js URL is allowed) |
| Fixed-step loop, same at 60 and 144 Hz | pass | `tools/script.mjs --only hz`: position, heading, speed identical to 6 decimals at 30, 60, 144, 240 Hz |
| `tune.json` loading, platform format | pass | 38 entries (limit 40), names valid, values inside ranges, defaults in `config.js` equal the file (`check.mjs`) |
| Platform layer with stubs | pass | `src/platform.js`: run start/end/pause pair, tune, saves, leaderboards, name, sound; `localStorage` and `tune.json` locally |
| Debug mode `?debug=1` | pass | `shots/m0/hall_debug_1p5.png`: statistics, sliders for all 38 values, copy JSON, level jump, slow-mo, fill cart, bot switch |
| Simulation runs from Node | pass | `tools/sim.mjs`: 60 runs, 100% finish, 0 stuck, 0 crashes on the test hall |
| Bot player, three modes | pass | beginner 7.5 s / confident 5.7 s / expert 5.3 s on the hall; average speed 8.6 / 11.3 / 12.2 m/s |
| Scripted-input runner | pass | `tools/script.mjs`: launch, stop, circle, drift tiers, dash, response, walls, corners, seams, tunnelling, gap, frame rate |
| Screenshots, strips, console capture | pass | `shots/m0`: 13 frames, 1 strip (8 frames, 67 ms apart), squint copy, phone and 800×450 frames, `summary.json` |
| Single-file build works | pass | `tools/build.mjs` → `dist/index.html` (87 KB, 12 modules); `shots.mjs --set dist --root dist`: clean console, same 26 draw calls |
| Budgets | pass | 13 files, 1,925 lines; 93 KB without three.js; 26 draw calls, 13.6k triangles; 164 fps on RTX 4060 (not representative) |

First feel numbers (starting `tune.json`, before any tuning — M1 works on these):

| Measure | Empty | Full (30 units) | Note |
| --- | --- | --- | --- |
| 0 → 95% top speed | 1.04 s, 6.7 m | 2.08 s, 12.1 m | GDD: full accelerates about half as fast — matches |
| Stop from top speed | 0.61 s, 3.6 m | 0.80 s, 4.1 m | GDD: about a third longer — 31% longer time |
| Turn radius at top speed | 7.3 m | 7.6 m | slip 4° |
| Input response | yaw and speed change on the first 1/120 s step | | |
| Drift, full lock, 0.7 s / 1.3 s / 2.1 s | tier 1 / tier 2 / **spins out** (slip 55° then loses speed) | same | to fix in M1 |
| Dash | +6 m/s for 0.33 s, 2.8 m gained | | 4 dashes in 6 s of mashing |
| Wall at 10–45° | slides, keeps 8.2–10.8 m/s | | 60° is turned into a slide by the helper |
| Wall at 75–90° | crash, 0.40 s without control, moving again inside 0.3 s | | limit is 1 s |
| Pinned nose-first, gas only | moving > 3 m/s after 0.48 s | | limit 0.5 s |
| Corner clipped by up to 0.85 m of the cart | swerved past, no crash | | |
| 0.3 m wall at 24.3 m/s | no tunnelling | | |
| 2.2 m gap (1.8 cart widths) at full speed | passes untouched at 0, 0.25, 0.4 m off-centre | | |

Screens judged against ART §9: this is a grey-box. The toon steps, plum outlines at constant pixel width and
the player pink already read; the cart basket looks like a lid, walls are large flat cream and purple
planes, goods are plain boxes. All of that is M3 work and is not a M0 criterion.
