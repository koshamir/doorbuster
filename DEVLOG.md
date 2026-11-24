# DOORBUSTER — development log

## STATUS (updated after every meaningful step)

- **Current milestone:** M4 Life is closed (tag `m4`): its fresh-eyes review found five problems, a fairness list
  and a readability list; every valid finding is fixed (D54-D62 and the review table below). M5 Content and
  M6 Juice are built and self-gated below; one fresh-eyes reviewer for both is next, then M7.
- **Done:** the whole game: the cart with four invisible helpers · sweeping, the loot heap, the cap with
  swaps, list items, hot items · Madness meter and mode · five rivals with pacing, announced and dodgeable
  rams, grudges, a final table · the crowd, bowling-pin huddles, the rush at the doors · DOORS OPEN, FLASH
  SALE, CLOSING TIME with a finale in every run · three levels from one kit (travelator, wet floor, ramp,
  glass window, cart train) · icon teaching, medals, records, loyalty card, pause, touch · synthesized sound
  and music · the single-file build and the handoff packager.
- **Next:** M5+M6 review -> fixes -> tags `m5`, `m6` -> M7: release checklist, handoff package checked on a
  clean copy, a three-juror review, REPORT.md, tag `m7`.
- **Open problems:** an average rival earns 55% / 49% / 48% of the expert bot on Levels 1-3
  (guideline 60-85%, D62) · a run without collecting takes 52% / 52% / 57% of the timer (guideline
  55-65%; D30, D44) · bots rarely line up a STRIKE on Levels 1 and 3 (D60) · frame rate on integrated graphics
  cannot be measured here (RTX 4060) · feel, humour and music need a human.
- **Budget:** 15 files, 5,348 lines (limit 15 / 8,000; target about 6,000); 312 KB without three.js.
- **How to resume:** `node tools/evidence.mjs` regenerates everything in `gates/` (checks, maneuvers, 200 bot
  runs per bot and level, the build, the capture sets into `shots/`); `node tools/package.mjs` builds and
  checks the handoff folder.

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
| D20 | **The cart collides as two circles**: the nose (0.56 m, 0.28 m ahead of the basket centre) and the tail (0.5 m, 0.75 m behind, the shopper). Only a nose-first hit can be a crash. Carts bump each other with the same four circle pairs. | M1 review, finding 5: one 0.6 m circle let the nose sink 0.3–0.4 m into walls and the shopper into everything behind. |
| D21 | **Crashes keep the direction of travel.** The side a crash glances to comes from where the cart has been going (velocity smoothed over 0.4 s), then the instantaneous velocity, and only for a dead-on hit from the wheel and the free space. The nose whips round at 8 rad/s (was 14), the camera follows the path, slowly, during the stun. A crash is a hit within 32° of head-on (`crashCos` 0.72 → 0.85). A steep slide keeps at least 60% of the speed, so it never costs more than a crash. | M1 review, finding 2: an oversteer crash obeyed the held key, reversed the cart and swung the camera 150°. |
| D22 | **Drift tiers fit the mall.** Tiers at 0.5/1.0/1.7 s (were 0.6/1.2/2.0); the stick opens the arc from 100% down to 32% of the full rate (was 53%); `driftturn` 1.35, `turnattop` 0.55 → 0.5. Normal steering now turns in 8.0 m at top speed, a drift in 6.2–16 m. While drifting, the helper opens or closes the arc (within the stick's range) when the path is about to run head-on into something. | M1 review, finding 1: not drifting cost nothing and tier 3 never fitted a corner. Now a 90° bend pays tier 1 with the stick in, tier 2 neutral, tier 3 out; a hairpin pays 2, 3, 3. |
| D23 | Drift charge is shown where the camera looks: sparks from both rear wheels at twice the size, a ring of stars above the handle at each tier, tier colours sky / yellow / red (never the player's pink), and the body always shows at least a 10° drift angle. The handle bar glows with the bumper when the dash is ready. | M1 review, finding 3: tier-up stars were under the basket, tier 3 was pink on pink, the dash-ready bumper was hidden by the basket. |
| D24 | The field of view grows with speed from standstill (50° at rest, 58° at top speed, +7° in a dash or boost) and the cart surges about 9% of the screen height up the frame in a dash. | M1 review, finding 4: the camera did not sell speed; the view only changed above 80% speed. |
| D25 | A dash that hits nothing sags to 82% top speed for 0.7 s (the first version, 75% for 0.8 s, was called too harsh by the M1 reviewer; no sag at all was "free speed" for the M0 reviewer). Mashing is worth +9%. | Two reviewers, opposite complaints; the value sits between them and stays a tuning value until dash targets exist (M4). |
| D26 | **At the cap a dearer item pushes the cheapest out.** A cart still stops at 1.5 x `loadfull`, but an item worth more than the cheapest goods it needs the room of (per unit of weight, at the multiplier of the moment) takes their place; they drop behind the cart. The first refusal is announced ("CART FULL! Only pricier goods fit now"). `loadfull` 30 -> 40. | M2 review, finding 1: the expert was full at 56% of the route and the cap refused silently; goods of the first aisle lowered the receipt. Now takes continue to the checkout (expert: 54 goods taken, 28 kept) and OVERLOADED comes later. |
| D27 | **An overloaded tower sheds.** Above `loadfull`: a drift past the first spark tier lets go of one item every 0.22 s, and a knock above 2.5 m/s (no crash needed) of 1-4 items. Nothing sheds in MADNESS mode. The sloppy bot drifts with a skyscraper, the others do not. | M2 review, finding 2: the wobble was only drawn; the sloppy bot delivered as much as the expert. Now sloppy $4,672 against expert $6,576, 23 goods lost per run against 6.7. |
| D28 | **A crash is capped in dollars too, a ram is not.** A crash drops at most `spillmax` of the goods and of the tower's dollars (dearer items stay), and throws them out to both sides of the way the cart glances off (replaces D14: they used to land on the cart's own line and came back hands-off). A ram drops the top `ramdrop` of the goods whatever they cost. Every loss prints in red at the cart and the receipt tag flashes red. | M2 review, finding 3: "a loss reads as a gain"; a hit took 55% of the dollars. The ram stays uncapped because GDD 5.2 and 5.4 want a hot item knocked off first. Worst crash loss in 1,000 runs: 40%. |
| D29 | List items belong to the player (rivals leave them) and never leave the cart. | A list item lost in a spill killed the $200 bonus without a word (M2 review, finding 3); rivals took them off the route. List completed: 97-100% of bot runs (was 36-70% with rivals). |
| D30 | **Level 1 rebuilt** (39 x 41 tiles, route 410 m, 306 units of goods for four carts, timer 72 s). Shelves on both sides with a choice (dear and heavy left, cheap and many right), an island stand at four of the five hairpins, aisle 3 split by a double-sided shelf row into a wide lane and a narrow dear lane behind a huddle, dear goods late (aisle 5), the hall cut from 60 m to 42 m. A trail item next to a shelf lies 0.7 m toward it, and the first trail runs along the first shelf. Not taken from the review: the open cut through the wall at aisle 2 (it would be every rival's shortest path and empty the loop; the dash-through glass shortcut is Level 2's new element). The timer keeps the beginner bot 10.8 s clear in the worst of 200 runs; a run without collecting is then 52% of it (guideline 55-65%): Level 1 is the forgiving one. | M2 review, section 2: five identical aisles, empty turn rooms, a 60 m hall with four cans, no decision. |
| D31 | **Madness numbers.** Gains in segments: item S 0.04 / M 0.09 / L 0.2 / hot 0.5, times up to 1.5 for a chain of takes under a second apart; clean sweep 0.5, ram 1, takedown 0.8, strike 1.2, close shave 0.4, smash 0.35, hot item through the ribbon 0.5, drift 0.3 per spark tier. Drain 0.12 per second after 2.5 s with no gain. A crash or being rammed costs one segment. Four full segments: 6 s of MADNESS (x4, double reach, no weight, every touch a dash), then back to x2. Rivals fill and trigger it by the same rules. | GDD 5.5. Tuned on 200 runs: beginner at x2 after 2.4 s (100% within 20 s) and in the mode in 47% of runs, confident 1.04 modes per run (1-2 in 88% of runs), expert 1.15. |
| D32 | **Rival pacing, invisible.** By position: more than 20 m ahead of the player a rival drives at 86% pace and shops more; more than 15 m behind it shops less (Granny never hurries). By money: richer than the player by 15% + $200 it shops half as much, poorer than 80% it shops harder. Both are off for the first 12 s and for the last fifth of the route. For the first 4 s rivals do not shop at all: the first shelf is the player's. | GDD 5.6 "pacing adjusts invisibly ... 10-20 m from the player". Measured: median gap along the route 16.6 m, a rival within 22 m 72% of the time. |
| D33 | **A ram on the player is always announced.** Half a second ahead: "!" over the rival and a flashing disc under it. Only an announced dash can knock goods off the player (an unannounced contact is a plain bump). None in the first 8 s, at most `maxRams` (3) per run, at least 7 s apart. The player loses control for 0.6 s and keeps rolling; a rammed rival spins for 1 s and slows to a crawl (`spinDrag`), so the rammer gets away. | QUALITY 4: "a ram aimed at the player is visible in advance"; "on level one the player is rammed no more than three times" (measured: at most 3, 0.2-0.6 per run). |
| D34 | **Characters.** Granny Tank starts ahead of the player with 16 medium and large goods priced at x2 and only gives way to a cart that is heavy (70% full), boosted or in MADNESS: a slow treasure chest. Coupon Queen drops everything for a hot item within 70 m of route, shouts ("MINE!") and the player gets an arrow to it. Sprint Dad is the fastest and takes revenge. Whoever is rammed holds a grudge for 5 s (a red disc on the floor) and goes for the attacker three times as readily. | GDD 5.6. Granny's free MADNESS mode at the start (her gift goods fed the meter) was a bug found by the receipt breakdown. |
| D35 | **The crowd.** One instanced shopper (three muted colours), states: stand, stroll, dodge (about 6 in 10 jump clear of a fast cart), bowled over for 1.3 s and back up shaking a fist, run to the flash sale. A touch costs a cart 5% of its speed, a dash nothing. Five shoppers bowled over in one dash or one MADNESS mode is a STRIKE; a pass within half a metre at speed without touching is a CLOSE SHAVE. A huddle (plan character `g`) is six shoppers packed together who do not dodge: a designed STRIKE. `rush` shoppers stand just ahead of the start and run into the store at GO: the crush at the doors. | GDD 5.7 and the Level 1 screenshot moment. |
| D36 | **Events.** FLASH SALE at 40% of the timer: a dormant podium (plan `f`) at least 20 m ahead of the player gets a hot item for 10 s (its tile blocks the route meanwhile); shoppers in sight run to it. CLOSING TIME, the last 15 s: checkouts close one by one in a seeded order, each with a 2 s blinking lamp, the last one stays open; a red wash, and an arrow to the nearest open checkout. The rest of the race is played out by the same rules when the receipt's table is due (`settle`). | GDD 5.8, 5.9. |
| D37 | The interface runs on game time: the receipt prints in steps driven by the frame's `dt`, and in manual (capture) mode the page's CSS animations are put on the game clock after every tick. | M2 review: a ghost countdown digit and a price label 40 s old in the frames were artefacts of real-time CSS under a manual clock. |
| D38 | **Bugs the bots found in the cart model.** A loaded cart could not start reversing from rest: its first step back (0.046 m/s) was under the 0.05 m/s threshold that decides the direction of travel, so it was read as forward speed again, forever. A cart can now pivot while braking as well as while pushing. The path aim no longer accepts a point round a corner (only the next tile is taken without a line of sight). Drivers make a three-point turn (back off what is at the nose, or push forward at full lock if the thing is behind). | An expert bot stood in a corner for 32 s; a rival wedged between a shelf end and a wall for 9 s. |
| D39 | **A third invisible helper: the sweep lane.** Running along a stocked shelf (within 1.5 m, nearly parallel, not near its ends), the cart settles 0.25 m off it and holds that line with up to 0.6 rad/s, unless the driver steers away. | "If the side of the cart looks like it is at the shelf, the item is taken": the beginner bot wove in and out of reach. 10+ goods off the first shelf: 75% -> 84% of beginner runs, clean sweeps per run 0.5 -> 1.1, crashes unchanged. Feel is on the owner's list. |
| D40 | **Colour discipline and readability (M3 review).** Pink is the player's alone; teal is the list; gold-yellow is hot items, the checkout, interface plates and the dash-ready bumper; red is danger and prices. Garland bulbs are small and warm white; shelf ends are white with the store's band; goods lost their yellow (chips, cereal, game, pizza, speaker, standee) and anything darker than plum. The cart's inside is dark and its rim light, the hero's beanie is cream. Big goods carry a coloured lid with one shape; hot items are gold with a gold bow. The drift charge is a dark-edged arc outside the hero ring. Chevrons are in the store's full colour with a dark edge; the wall shadow has a hard edge; every wall face carries the store's band; wall caps are lighter (#5B4A78); outlines 2.0 / 3.2 px at 1080p (were 1.5 / 2.5). A hot item stands in a hard gold column under a turning star. A big CHECKOUT sign faces the way the carts come from. Pop-up words sit on opaque plates, one at a time; prices stack. The title is a three-quarter view with the cart clear of logo and button. | M3 review, findings 1-5 and its acceptance list. |
| D41 | List icons in the interface are pictures of the real goods, rendered once into a canvas (`goodIcon`). | One art style for 3D and interface; no drawn icons to keep in step. |
| D42 | **Rival receipts: the guideline "an average rival scores 60-85% of the expert bot" is not met (52%).** The best rival is at 92% of the confident bot (85-105%: met), the beginner bot places 2nd-4th in 95% of runs (met), the confident bot wins 55% of its runs, the expert 79%. | The multiplier makes receipts grow faster than skill (expert $6,576, confident $5,222, beginner $3,317), so one rival strength cannot sit at 60% of the expert and at 100% of the confident bot at once. The placements are what a player meets, and they show the intended contest. To be re-checked in M7 balancing. |
| D43 | **Mall kit.** Travelator (`> < ^ v`): carries a cart at 5 m/s, so with it is faster and against it about half speed; routes cost 0.6 with and 3 against; the belt is a dark strip whose arrows run. Wet floor (`~`): one second of low grip; a blue sheen and a yellow sign at the patch. Ramp (`R`): taken at 7 m/s or more it gives 0.9 s in the air over anything low (the fountain); clearing something is BIG AIR ($250), a hard landing shakes an overloaded tower; drivers route round ramps, the jump is the player's. Glass window (`W`): a dash opens it and the route field is rebuilt for everyone. Cart train (`=` track): four steel carts shuttle at 7 m/s with 0.8 s stops; it shoves aside whoever is in the way as a crash would; a long shadow runs ahead of it; drivers who look wait for it. | GDD 6, mall kit. Cut from the kit: the floor scrubber (the least distinct piece: a wet patch that moves) and the roller shutter (its closing logic exists in `sim.js`, but none of Levels 1-3 has a shortcut for it to close; it belonged to Level 4). |
| D44 | **Levels 2 and 3.** GADGET RUSH (route 413 m, 62 s): a spiral of halls to checkouts in the middle; every corner turns round a display (the drift), a travelator lane between shelves (fast or loot), a belt running the wrong way, a wall with a shop window across the hall (dash through it or take the showroom detour with its dear goods), four rivals. ATRIUM MAYHEM (route 349 m, 58 s): two store aisles, the atrium (ramp, fountain, tree, benches), a food court of tables that fly and wet patches, and a last corridor crossed by the cart train; five rivals. Timers come from the bots: a run without collecting is 53% and 58% of the timer, the beginner bot has 5.8 s and 9 s to spare in its worst run. Level 3's route is a metre under the 350 m template. | GDD 6 campaign table. |
| D45 | Selfie Star stops dead for a photo every 9-15 s (a flash a second ahead, 1.4 s at a standstill) and the shoppers who see her run over: a moving huddle. Bulk Bro charges whoever rammed him and brakes for nothing while he does. With more rivals each one is calmer (`5.4 / n²` instead of 0.6 for the mood to ram), or a field of five strips itself bare. | GDD 5.6. Level 3 measured 9 rival-on-rival rams per run before, 5 after. |
| D46 | **Progress.** Any finish is bronze and opens the next store; silver, gold and the hidden Black Card are receipt thresholds set between the beginner, confident and expert bots' medians. Records, medals, the highest store opened, the hints already used and the sound settings are one saved object. The first launch has no menu: the start grid, the logo and START. Once a store has been finished the title also carries the loyalty card (one stamp per store). After three failures in a row a store can be skipped. Leaderboards receive the best receipt per store and their sum. | GDD 7, 5.9. Cut (all "Should"): Level 4 and the boss, the ghost of the best run, a leaderboard screen. |
| D47 | **Teaching without text.** Key caps beside the cart: A D W until the player has steered and accelerated, SHIFT when something to dash through is 16 m ahead, SPACE before a round display; each is gone for good after its first use (touch screens show the pad names). The first countdown opens high above the route and swoops down behind the cart (instead of a flyover along the route: it shows the aisle, the crowd and the first shelf in two seconds without delaying the start). | GDD 8. |
| D48 | **Touch.** A finger anywhere switches the pads on: steering under the left thumb, DASH, DRIFT and a smaller BRAKE under the right; the accelerator is automatic. The interface unit is larger on tall screens and the logo is capped at 12% of the width. | QUALITY 4 Interface. |
| D49 | **Pause** (P, Escape, losing focus) with RESUME, RESTART, the store list, a SOUND switch that goes through the platform, separate MUSIC and EFFECTS volumes and the screen-shake switch. The pause is reported to the platform as a pair. | GDD 8, MINDBLOWN 5. |
| D50 | **Automatic quality.** Two seconds of frames slower than 20 ms step the quality down: resolution to 75%, then 55%, then the thin outlines off. | QUALITY 5. It cannot be exercised on this machine (6 ms frames). |
| D51 | **Sound** (`audio.js`, the 15th file): oscillators and filtered noise into an effects bus and a music bus, then a compressor as a limiter. Every simulation event has a sound; impacts are three layers (click, body, clang or a voice); the item pop climbs a pentatonic scale along a chain; gibberish voices at most once per 8 s per character. The music is a two-chord funk vamp on a 16-step grid played by a look-ahead scheduler: drums and bass at x1, chord stabs from x2, a lead from x3, cowbell and claps at x4, a resonant filter sweep in MADNESS mode, 114 -> 134 bpm at closing time, a soft version on the title and receipt. Nothing sounds before the first key or click. | ART 7, QUALITY 4 Sound. Heard by nobody yet: on the owner's list. |
| D52 | The single-file build parses the combined script once, so a name declared twice anywhere fails the build (two modules each had a top-level `T`; the old check only looked at the first name of a declaration list). `tools/package.mjs` builds the handoff folder and checks it on a clean copy. | MINDBLOWN 6. |
| D53 | Bots go for a list item before any dash target and see it from further away (it glows). | The expert bot missed the third list item in half its runs because it was busy chasing carts. |
| D54 | **One hit never costs more than 40% (M4 review).** `spillmax` now caps the dollars of every way the player loses goods: a crash, a rival's ram (it was uncapped: the review measured a median 42-47% of the cart's dollars and a worst case of 87%) and an overloaded tower shedding. A ram on a *rival* still always knocks off its top item, so a hot item can be taken from it. An overloaded tower sheds only on a knock above 5 m/s (was 2.5) that is not the shelf being swept or a checkout counter, never a hot item, and in a drift only past the second spark tier (was the first). | QUALITY 4: "a single hit costs no more than 40%". The cart is over its rating for 60-64% of a run, so that state must not punish the core action: half of the beginner's sheds came from the shelf it was sweeping. Now: worst ram 40%, worst shed 28% of the cart's dollars; 0.03-0.12 sheds per run for the careful bots, 3.04 for the sloppy one. |
| D55 | **An announced ram is a committed ram.** The warning lasts 0.8 s (GDD 5.6: half a second): "!" on the rival, or beside the player's cart on the side it comes from when the rival is out of the picture (the review: 96-99% come from behind), a red line on the floor along the lunge, and for the first two warnings the steering keys. The rival holds the heading it announced (to where the player's cart will be if it carries on) and lunges down it, hit or miss. A lunge that ends within 7 m without a hit is DODGED!: $40 and half a segment of Madness. The extra dash reach (+0.35 m) is the player's alone. | The review: steering away a quarter second after the "!" was still hit 37% of the time (doing nothing: 44%), because the rival kept re-aiming until the lunge. A bot that never dodges on purpose is now warned about 0.9 times a run, hit 0.23 and missed 0.63. |
| D56 | **CLOSING TIME starts when the race leader comes within 90 m of the checkouts**, or with `closing` seconds on the clock, whichever is first (GDD 5.8: the last 15 s). From then the checkouts go dark one by one over `closing` seconds (15; Level 1: 22), each with 2 s of warning (the lamp blinks, the lane's floor flashes red, a beep, a "CLOSING" label), never while a cart is within 3.5 m of the lane's mouth (for up to 1.5 s); the last one stays open until the store shuts. A lane about to close costs 14 m in the route field, so drivers and the arrow prefer another. The clock itself is untouched. | The review counted the runs that reached closing time: confident 0 of 200, expert 0 of 200, beginner 10 of 200. The finale that the GDD describes and that the release checklist wants the jury to see did not exist for anyone who drove well, and a shorter timer would have taken the beginner's margin. Now every run has it: 17.42 s of it for the beginner bot, 11.06 s confident, 8.30 s expert (medians, Level 1). |
| D57 | **A fourth invisible helper: the checkout funnel.** A cart driving at an open checkout from within 7 m (3 m/s or more, within 2.4 m of its centre line) is eased onto the centre line and straightened; one that has ended up at the counters beside an open lane (within 2.5 m of them and 4.4 m of the lane) is drawn sideways into it at any speed. The route field also makes the two tiles in front of the lanes dear ("apron"), so routes cross them straight. | With one checkout left, the beginner bot spent ten seconds bouncing between the counters beside it: a 2.6 m gap needs a straight approach. GDD 4: "drive into an open checkout at any speed". Closed-lane hits: 0-0.04 per run. |
| D58 | **Flash sale placement.** Sale spots (plan `f`) stand every 25-45 m along the stretch of route where a player can be at 40% of the timer (5 on Level 1, 7 on Levels 2 and 3); the sale appears at the nearest one at least 24 m ahead; rivals leave it alone for its first 3 s. | The review: the podium was a median 101 m of route from the confident bot; nobody took it in 64% of runs, the player in 6%. Now the player's bot takes it in 42% / 33% / 61% / 33% / 81% / 19% of runs (beginner / confident / expert, Level 1; the second number in the table is a rival taking it). |
| D59 | **The loot heap.** Goods in a cart are packed over six columns (small goods three abreast, medium and large two, hot items across both), each where the heap is shallowest: a full cart carries a heap about 1.1 m wide and 2-3 m tall instead of a single column (the review: median peak 5.8 m, hiding 8 m of lane ahead). Banners fade out as the player's cart comes within 14-9 m of them. A smashed piece takes its shadow with it. | M4 review, line of sight. The heap still sways and spills; reading the way ahead comes first (CLAUDE.md priorities 1-2 before 4). |
| D60 | **A huddle is a set of bowling pins**: six shoppers in rows of one, two and three, the head pin toward the carts that come down the route. Only a dash knocks a pin down (anything else shoves it aside and it steps back into formation at a run), and a pin hit within a quarter second after the dash still counts. Bots that want the strike line up on the huddle's axis first. | The review: 0.01-0.03 strikes per run. A ring of six did not read as a target, rivals had flattened it before the player arrived, and the dash had to end exactly on it. A straight dash is now a strike every time (`shots/m4/strike_strip.png`); the bots still get few on Level 1 (0.08 per run; Level 2: 0.04), because the shelf-sweeping helper pulls them off the huddle's axis there. Left as a human skill shot. |
| D61 | **Interface (M4 review).** The Madness meter has five pips: the lit ones are the multiplier (one is always lit), the fifth, pink, fills toward MADNESS mode. A headline word (MADNESS!, HOT ITEM!) keeps its full second; HEAVY and OVERLOADED are said once per run; while the announcer's line is up, pop-up words appear below it. CART FULL is announced the first time the cap matters (the first swap), not at the first refusal 7-15 s later. The arrow is a block arrow that stays below the announcer's line and points along the route while its target is out of sight, never through a wall. Labels are at least 9 px. Floating labels that start together stack downward and never run into each other. The place badge counts what the receipt will count (time and list bonuses): it agrees with the final table in 98%-100% of runs (the review: 77-90%). | M4 review, readability list (`shots/m4/small_*.png`, `phone_*.png`, `run_*.png`). |
| D62 | **Balance after the review.** Hot items are 30% cheaper (350 / 250 / 450 / 560): at x4 one of them was worth six shelves and decided the table by itself. The first list item of Level 1 now lies in the first shelf's sweeping lane (it used to pull the beginner off the shelf: 10+ goods off the first shelf in 75% of beginner runs, was 30%). Rivals: jostling each other spills half as much as a ram that involves the player; every rival fills its cart to the cap; the pacing band is 8 m behind to 22 m ahead of the player, and behind it they drive flat out instead of shopping less; they ease off only when 40% + $500 richer than the player; Selfie Star's photos pay her $150 each (a reason to ram her while she poses); a level's `rivalEdge` scales how fast rivals build their multiplier (1.9 / 2.4 / 1.7 on Levels 1-3). Medals are reset between the bots' medians (D46). | With D54-D58 the player's bots keep more of what they take, and the rivals fell to 34-44% of the expert and 67-84% of the confident bot. Now the best rival is at 95% / 89% / 106% of the confident bot (guideline 85-105%), the confident bot wins 48% / 58% / 39% of its runs, the beginner 3% / 6% / 5%. **The other guideline, an average rival at 60-85% of the expert, is not met (55% / 49% / 48%) and cannot be together with the first**: the expert earns about 1.3 times the confident bot and the best of three to five rivals earns about 1.4 times their average, so an average at 60% of the expert would put the best rival above 105% of the confident bot. The jury plays at beginner to confident level; that end of the table is the one tuned. `rivalskill` in tune.json moves all of it. |

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

### M1 fresh-eyes review (22 Nov) — findings and what was done

| # | Finding | Verdict | Action |
| --- | --- | --- | --- |
| 1 | Drift tiers do not fit the mall: not drifting costs nothing in a 90° bend, tier 3 never fits | valid | D22. `script.mjs --only bends`: tier 1/2/3 by stick position in a 90° bend, 2/3/3 in a hairpin, turn-in windows 5–18 m wide |
| 2 | An oversteer crash stops the cart and turns it round; the camera swings 150° | valid | D21. `script.mjs --only walls`, "with the wheel held": every case from 50° to 80° carries on in the direction of travel; a dead-on hit follows the wheel |
| 3 | Charge and dash state cannot be read | valid | D23; `shots/m1/drift_in_2p3.png`. A charge arc on the hero ring comes with the art pass (M3) |
| 4 | The camera does not sell speed; visible road 1.7 s in four scenarios | valid | D24. Floor visible ahead is now 2.5 s at top speed and 2.0 s at dash and boost peaks |
| 5 | The collider is smaller than the mesh | valid | D20 |
| N1 | `crashCos` 0.72 → 0.87 | accepted (0.85) | D21 |
| N2 | `dashSag` 0.75 → 0.9 for 0.4 s | partly | D25 |
| T1 | Evidence mixed builds | valid | metrics and captures are regenerated from one tree before every tag |
| T2 | Gap test could not touch | valid | offsets up to 0.8 m: beyond 0.54 m the cart touches and glances through |
| T3 | Beginner drift test too narrow (holds 0.45–1.2 s) | valid | holds 0.3–1.8 s, and the share of clean exits is reported |
| T4 | `roadSec` ignores walls; `lift` never triggered | valid | renamed "floor ahead" (it measures the framing); `cam_lift` capture reaches lift 1.0 |
| T5 | Crash strip started after the impact; the walls table never steered | valid | strips can be centred on an event (`strip.around`); wheel-held rows added |

### M2 fresh-eyes review (22 Nov, finished after the usage-limit break) — findings and what was done

| # | Finding | Verdict | Action |
| --- | --- | --- | --- |
| 1 | The run ends at half distance: the cap is reached at 56% of the route and refuses silently | valid | D26 |
| 2 | Risk is fake where shown (the wobble drops nothing) and hidden where real | valid | D27 |
| 3 | A loss reads as a gain; a hit takes 55% of the dollars; a lost list item kills the bonus unannounced | valid | D28, D29 |
| 4 | The only hint leads past the shelf (trail 1.2 m from it, sweeping needs 0.6) | valid | D30 (trail), D39 |
| 5 | Words fire across the road within 7 s; OVERLOADED covers 75% of the run; the receipt hides the cart and offers nothing to beat | valid | `loadfull` 40; words on plates, smaller, higher, one at a time; the receipt stands at the side with the final table and a BEST line (saved per level) |
| L | Level 1: five identical aisles, no decision | valid | D30 (one suggestion declined, with the reason) |
| G1 | Gate table stale and mixed with other builds | valid | every number below is regenerated from the tagged tree (`gates/`) |
| G2 | "Recovered 8/8" contradicted the file; the 40-item row was an impossible cart | valid | spill test rewritten: first hit only, loads a cart can hold, goods and dollars |
| G3 | "At most 40%" was the formula restated, in goods | valid | D28; the simulation reports the worst crash loss in dollars |
| G4 | "10+ off the first shelf" hid 9% of runs under an average | valid | the share of runs is reported (84%), and it is listed as an open problem |
| G5 | "No visible misses" was measured with an empty cart | valid | row reworded: geometric reach is one thing (30/30), the cap is a rule with its own announcement (D26) |
| G6 | Frames misreport the HTML layer | valid | D37 |
| G7 | Phone legibility missing | valid | the interface unit is larger on tall screens: timer digits 23 px at 390 px width (`shots/m4/phone_26.png`) |

### M3 fresh-eyes art review (22 Nov) — findings and what was done

| # | Finding | Verdict | Action |
| --- | --- | --- | --- |
| 1 | Signal colours spent on decoration (garland in player pink, list teal and tag red; shelf ends like a hot-item podium) | valid | D40 |
| 2 | Cart and tower are the flattest things on screen; blank grey cubes; charge arc on the pink ring | valid | D40 |
| 3 | Wayfinding fails the squint (chevrons, pale beam, blurry CHECKOUT) | valid | D40 |
| 4 | Walls are bare slabs | valid | D40 |
| 5 | Text and signage cover the look-ahead | valid | D40; the level-name banner over the start is gone |
| A | Start frame fails as a cover; outline timid beside the interface | valid | title view, outlines 2.0 / 3.2 px |
| I | Pop-up word is the one interface element off-style; a spill gives no on-screen reason | valid | plates; red loss text |
| K | Keep: pink plus the floor ring as the player's mark; the plates and the paper receipt | kept | pink share of vivid pixels is 25-27% in M4 frames (rivals and crowd are in them now); the ring is unchanged in colour |

### M4 fresh-eyes review (22 Nov, on commit 7075059) — findings and what was done

| # | Finding | Verdict | Action |
| --- | --- | --- | --- |
| 1 | Rams: unseen (96-99% from behind, the rival on screen half the time), undodgeable (steering away still hit 37%), uncapped (median 42-47% of the cart's dollars, worst 87%) | valid | D54, D55 |
| 2 | Overloaded towers shed their dearest goods on a touch: every run is OVERLOADED for 62-70% of its length, half the beginner's sheds come from the shelf being swept, a hot item is lost in 27-49% of runs | valid | D54. Not changed: the cart is still over its rating for 60-64% of a run; with 0.03-0.12 sheds per run that state is a look and a weight, not a punishment |
| 3 | FLASH SALE does nothing: a median 101 m away, taken by the player in 6% of runs | valid | D58 |
| 4 | Line of sight: the player's own tower hides 8 m of lane; banners cover the cart | valid | D59 |
| 5 | No end-game: CLOSING TIME reached in 0 of 200 confident and expert runs | valid | D56, D57 |
| F1 | The +0.35 m dash reach also served the rival | valid | D55 |
| F2 | A closing lane's only warning is a lamp | valid | D56 |
| F3 | CART FULL is said at the first refusal, 7-15 s after swaps begin | valid | D61 |
| R1 | Pop-up word and announcer line share one slot | valid | D61 |
| R2 | The arrow is a near-equilateral triangle and points through walls | valid | D61 |
| R3 | MADNESS, CLOSING IN, RECEIPT are 6-7 px at 800x450 and on a phone | valid | D61 |
| R4 | Three pips read x4 | valid | D61 |
| R5 | Price labels overlap | valid | D61 |
| R6 | OVERLOADED replaces MADNESS! after half a second | valid | D61 |
| R7 | The place badge differs from the final table in 10-23% of runs | valid | D61 |
| R8 | Smashed pieces leave their shadow | valid | D59 |
| G1 | "Worst crash loss 40%" covered crashes only and is capped by the code | valid | the simulation reports what a ram and a shed cost the player (median and worst share of the dollars) next to the crash number |
| G2 | "Rammed at most 3" cannot fail | valid | listed as a rule (D33), not as a measurement; the measurements are warnings, hits and dodges per run |
| G3 | "Something every 3-5 s" hid 8-13 s of quiet behind a median over every take | valid | reported per run: the longest quiet stretch of a median run and the share of runs with 5 s of nothing |
| G4 | "All three events": the closing evidence shortened the timer, and five frames were stale | valid | D56; `closing_strip`, `finale_strip` and `finale2_strip` are ordinary runs; capture folders are emptied before a set is regenerated |
| G5 | "Rivals on screen 72%" was a distance | valid | the simulation tests the camera's picture of the floor (2.5 m behind the cart to 26 m ahead): the row "a rival is in the picture" below |
| G6 | "Every dash target": glass in no level, strikes 0.01-0.03 per run | valid | the glass window is in Level 2 since M5; D60 |
| K | Keep: same-step feedback on the player's own hits | kept | untouched |

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

### M1 Toy — gate passed, tag `m1`

Gate: *driving is fun with no goals* (owner playtest replaced by the measurements and frames below;
feel itself stays on the owner's list in the final report).

| Criterion (QUALITY §4 Cart and camera, GDD 5.1) | Result | Number |
| --- | --- | --- |
| Input responds on the next frame | pass | state changes on the first 1/120 s step (yaw 0.11 rad/s, speed 0.12 m/s); the body lean and yaw follow the raw input the same frame |
| Identical at 60 and 144 Hz | pass | the same timed key script through the real frame loop ends in the same state at 30, 60, 144 and 240 Hz (0.000 m apart); with keys sampled once per frame it was up to 0.45 m |
| 0 → 95% of top speed | — | empty 1.04 s (6.7 m), full 2.08 s (12.1 m): "about half as fast" |
| Stop from top speed | — | empty 0.61 s (3.6 m), full 0.80 s (4.1 m): "about a third longer" |
| Turn radius at top speed | — | empty 8.0 m, full 8.2 m; corridors are 10 m |
| Empty versus full is felt within 3 s | pass | from rest a full cart covers 27% less ground in 3 s; top speed 12 → 10.8 m/s |
| Slides along walls | pass | 10–45° to the wall: 9.3–11.9 m/s after 0.5 s; 60°: 7.8 m/s; a steep slide keeps at least 60% |
| A crash costs goods, not momentum | pass | 75–90°: 7.2–7.6 m/s after 0.5 s, back to 75% of top in 0.64–0.68 s (full cart 0.97 s); control lost 0.40 s (limit 1 s) |
| A crash keeps the direction of travel | pass | wheel held into or away from the wall at 50–80°: carried on 12–16 m in 1.5 s in every case; body turn at most 493°/s |
| Does not stick on corners | pass | corner clipped by up to 0.85 m of the cart: swerved past, slowest 10.0 m/s; by 1.1 m: one crash, slowest 6.3 m/s |
| Never stuck more than 0.5 s | pass | nose-first: moving after 0.17 s (full 0.33 s); inside corner 0.12 s; notch 0.12 s; longest standstill in 300 bot runs 0.36 s |
| No tunnelling | pass | 0.3 m wall at 12/18/24/30 m/s × 40 offsets: 160/160 touched, the cart's centre never entered the wall |
| Gap of two cart widths at full speed | pass | 2.2 m gap: untouched up to 0.5 m off-centre; at 0.6 and 0.8 m one bump and through |
| Beginner gets the first drift tier on the second attempt | pass | random sloppy attempts (hold 0.3–1.8 s): 65% per try, 88% within two (full cart 78% / 95%); 18% crash |
| Drift tiers against real corners | pass | 90° bend: tier 1 / 2 / 3 with the stick in / neutral / out (windows 16 / 6 / 5 m); hairpin: 2 / 3 / 3 (10.5 / 10 / 9 m) |
| Camera shows the cart and about 2 s of road | pass | cart at screen x 0, y −0.32…−0.40, up to −0.14 in a dash; floor ahead 2.5 s at top speed, 2.0 s at dash and boost peaks |
| Camera never goes through walls | pass | camera height ≥ 6.6 m, walls 2.4 m; with a wall right behind the cart it tips up and over (`cam_lift`) |
| Camera never jitters | pass | yaw reversals: 0.2–0.5 per second with scripted keys, 0.5–1.0 with bots |
| Seams do not catch | pass | 30 separate boxes versus one wall: min speed 11.2 versus 11.2 m/s |
| Obstacles of the gauntlet | pass | beginner, confident, expert: 100% clean passes of all nine obstacles in 30 runs each; sloppy 70–100% |

Why these values (against how comparable arcade racers behave): karts reach top speed in 2.5–4 s, top-down
arcade racers in 1–1.5 s. Runs here last 60–75 s with a bump every few seconds, so the empty cart is tuned
to the fast end (1.0 s) and the full cart lands in kart territory (2.1 s) — the weight is felt at once.
Normal steering turns in 8 m at top speed, so a 10 m corridor bend can be driven flat out only on a good
line; the drift offers 6.2 m (stick in) to 16 m (stick out) and pays more the longer it is held, as a
mini-turbo does. Tier times 0.5/1.0/1.7 s sit below a kart's because the corners here are shorter.
Boosts are +20/40/60% for 0.7/1.0/1.4 s.

### M2 Core — gate passed, tag `m2` (numbers from the tree that carries the review fixes)

Gate: *full loop "start -> checkout -> receipt -> again"; the beginner bot finishes.*

| Criterion (QUALITY §4 Pickup and the tower, Interface, §5) | Result | Number |
| --- | --- | --- |
| Full loop | pass | `shots/m2`, `shots/m4`: title -> countdown -> run -> receipt with table -> retry; time-up -> STORE CLOSED -> retry |
| The beginner bot finishes | pass | 200/200, 53.7 s average, slowest 61.2 s of 72 s (10.8 s to spare; limit 10 s) |
| No dead ends, no stuck | pass | 1,000 runs on Level 1: 0-0.04 stuck recoveries per run; longest standstill 0.4-1.0 s (a three-point turn at an island) |
| A beginner sweeps 10+ goods off the first shelf | mostly | 14.8 of 18 on average; 10 or more in 84% of 200 beginner runs (open problem; D39) |
| If the cart's side is at the shelf, the item is taken | pass | 30/30 at gaps 0-0.6 m at 6, 12 and 19 m/s, 0/30 at 0.8 m. At the cap the swap rule decides and says so (D26) |
| An item flies in no more than 0.25 s and lands on the tower | pass | flight 0.20 s; goods leave one after another 30 ms apart and are drawn in the cart |
| A hit costs at most 40%, in goods and dollars | pass | spill test: 25-39% of goods, 6-40% of dollars; worst crash loss in 1,000 runs 40% |
| Spilled goods can be recovered | pass, with effort | they fan to the sides: a driver who turns back gets 3 of 3, 4 of 7, 0 of 11 within 4 s; driving straight on gets none |
| Careful expert delivers an overloaded tower, sloppy loses a noticeable part | pass | expert 1.54 x full, 6.7 goods lost per run, $6,576; sloppy 1.25 x, 23 lost, $4,672 |
| Restart in a second and a half | pass | level rebuilt in tens of ms (`gates/m2-capture.json`, scenario `restart`), countdown 1.2 s |
| 20 restarts without memory growth | pass | heap growth in `gates/m2-capture.json` |
| One click, no more than 3 s to playing | pass | START -> GO in 2.4 s |
| Receipt lines; tally can be sped up | pass | ITEMS, LIST, STUNTS, TIME, TOTAL, final table, BEST; any key or click prints four times faster |

### M3 Style — gate passed, tag `m3`

Gate: *looks like the references; 60 fps* (owner playtest replaced by the art review and ART.md §9).

| Criterion (ART.md §9, QUALITY §5) | Result | Evidence |
| --- | --- | --- |
| Squint: cart, hot items and direction read at 320 px | pass after fixes | `shots/m3/run_squint.png`, `shots/m4/start_squint.png`: pink ring and cart; gold column and star; chevrons with a dark edge |
| The cart is found in half a second | pass | pink 1.3-1.5% of all pixels and 25-37% of vivid pixels; nothing else uses pink (D40) |
| Ten frames, one style | pass | one toon material, one outline, one palette; `shots/m4/run_*.png` |
| The start frame works as a cover | pass after fixes | `shots/m4/title.png` |
| Outlines consistent | pass | constant pixel width, 2.0 / 3.2 px at 1080p |
| Interface in the game's style | pass | plates, price tag, paper receipt, list icons rendered from the models |
| 8+ goods, cart, shopper, shelf, floor, walls | pass | 19 goods, 6 characters and a crowd shopper, shelves, 15 kinds of pieces |
| Draw calls and triangles | pass | 38-67 draw calls and 91-126k triangles with rivals and crowd (guideline 150 / 300k) |
| 60 fps | pass here | 165 fps (display-limited), p95 frame gap 6.1 ms, logic 0.09 ms, render 0.7 ms on an RTX 4060; integrated graphics cannot be measured on this machine |

### M4 Life — gate passed, tag `m4` (numbers from the tree that carries the review fixes)

Gate: *simulation metrics from QUALITY §4; the chaos is fun and fair.* 200 runs per bot and level
(`gates/metrics-latest.txt`); rival rows are over all bots' runs. Level 1 unless a row says otherwise.

| Criterion | Result | Number |
| --- | --- | --- |
| Hit counts when objects visibly touch, margin in the player's favour | pass | the player's dash reaches 0.35 m further on carts (a rival's does not, D55); two-circle carts; shoppers 0.3 m |
| Response in the same frame | pass | hit-stop 0.04-0.1 s; particles and the target's reaction are emitted on the event's own step (`shots/m4/ram_strip.png`, `smash_strip.png`, `strike_strip.png`) |
| A ram on the player is visible in advance, not repeated during immunity | pass | D55: 0.8 s of "!", the line on the floor (`shots/m4/rammed_strip.png`); per run a bot that never dodges on purpose is hit 0.17-0.23 times and missed 0.22-0.63 times; at least 7 s apart, at most `maxRams` |
| A single hit costs no more than 40% | pass | worst share of the cart's dollars lost at once: crash 40%, ram 40% (median 37%), shed 28% (D54) |
| Pile-up: nobody jitters, flies off or passes through | pass | start grid of four carts and nine runners (`shots/m4/start_strip.png`); longest standstill of any bot on any level 1.09 s |
| Madness: beginner reaches x2 within 20 s | mostly | 94% of runs, median 2.48 s (the rest lose the first shelf to the crush at the doors) |
| Madness: confident bot triggers the mode 1-2 times per run | pass | 1.18 per run; 1-2 in 94% of runs |
| 98%+ of rivals finish without a push-out | pass | 100% finish; 18 push-outs in 1000 runs |
| Fewer than one stuck event per 20 runs | pass | 0.001 per run |
| A rival passes an obstacle with 80-97% probability; someone's crash is visible | above the range | rivals crash 0.74 times per run in total; a rival's crash happens in 53% of runs and a rival-on-rival ram in 92% |
| A rival is never faster than the player's maximum | pass | same cart model, whose maximum is 25.2 m/s (third-tier boost plus dash); the fastest moment of any rival in 1000 runs was 24.2 m/s, of the player's bots 23.5 m/s |
| Receipts: an average rival at 60-85% of the expert | not met | 55% (D62) |
| Receipts: the best rival at 85-105% of the confident bot | pass | 95% |
| The beginner bot places 2nd-4th of four | pass | 3% / 13% / 25% / 59% (1st to 4th) |
| Rivals ram each other at least once per run | mostly | 3.34 per run; at least one in 92% of runs |
| The player is rammed no more than three times | by rule | D33; the most in one run was 2 |
| After a hit a rival is back in the race within 2 s | mostly | median 1.15 s (1 s of that is the spin); 98% within 2 s, worst 3.81 s |
| Crowd never blocks the way for more than a second; shoppers get up | pass | carts pass through them (5% of speed); down for 1.3 s; pins step back into formation |
| Crowd in one or two draw calls | pass | one instanced mesh, two passes (fill and outline) |
| Something for the player every 3-5 s | on the map: pass; in a run: gaps | no stretch of route longer than 9 m without something to do (validator). Events the player notices: the longest quiet stretch of a median run is 4.99 s (beginner) / 4.02 s (confident); 49% / 28% of their runs have 5 s with none (a full cart passing shelves cheaper than its load) |
| Beginner finishes Level 1 with 10 s to spare | pass | 14.52 s in the worst of 200 runs |
| Beginner takes 10 or more goods off the first shelf | mostly | 75% of runs, 16.39 on average (the confident bot: 67%); D62 |
| Expert without collecting takes 55-65% of the timer | below | 52% (D30) |
| All three events, in an ordinary run | pass | rocket start; FLASH SALE taken by the player's bot / by a rival in 42% / 33% (beginner), 61% / 33% (confident), 81% / 19% (expert); CLOSING TIME: at least 3 s of it in 100% of runs, a closed lane is hit 0-0.04 times per run (`shots/m4/start_strip.png`, `flash_strip.png`, `closing_strip.png`, `finale_strip.png`, `finale2_strip.png`) |
| Every dash target of GDD 5.4 | pass | rival (1.95 rams and 0.63 takedowns per run for the confident bot), shoppers (strike: D60), hot item (1.94 per run), pyramid / gifts / stand (0.66), glass (Level 2), wall (crash) |
| A rival is in the picture | recorded | 80% / 72% / 51% of the time for the beginner / confident / expert bot's camera; within 22 m: 74%; median gap along the route 15.6 m (GDD: 10-20 m) |
| The place badge agrees with the final table | pass | 98%-100% of runs |
| Console clean, no external requests | pass | `gates/m4-capture.json`: 18 scenarios, 0 problems |
| Budgets | pass | 15 files, 5,348 lines; 312 KB without three.js |

| Level 1 bot | Time (slowest) | Of 72 s | Receipt (median) | Goods taken / lost | List | Modes | 1st place | Medals bronze / silver / gold / black |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beginner | 52.35 s (57.48) | 73% | $3,283 | 56.88 / 1.96 | 99% | 0.53 | 3% | 170 / 28 / 2 / 0 |
| confident | 45.20 s (53.40) | 63% | $5,890 | 61.01 / 4.82 | 93% | 1.18 | 48% | 46 / 88 / 46 / 20 |
| expert | 42.08 s (49.87) | 58% | $7,450 | 54.63 / 3.63 | 90% | 1.25 | 78% | 20 / 42 / 112 / 26 |
| sloppy | 44.12 s (57.06) | 61% | $5,402 | 66.12 / 16.38 | 93% | 1.34 | 46% | 59 / 93 / 44 / 4 |
| expert, no collecting | 37.37 s (42.86) | 52% | $754 | 18.29 / 2.71 | 5% | 0 | 0% | 200 / 0 / 0 / 0 |

Rivals, Level 1: Granny Tank $3,726 in 48.32 s, Sprint Dad $4,110 in 44.81 s, Coupon Queen $4,096 in 44.40 s.

Feel measurements were re-run after this milestone's changes (`gates/metrics-latest.txt`, maneuver suite): the
cart model itself is unchanged since M2 apart from D38 and D39; the same key script ends in the same place
at 30, 60, 144 and 240 Hz (0.000 m apart).

### M5 Content — self-gate measured, fresh-eyes review pending (one reviewer covers M5 and M6)

Gate: *a new person finishes Level 1 with no explanation* (replaced by the beginner bot, the teaching
frames and the review). 200 runs per bot and level; `gates/m5-capture.json`.

| Criterion | Result | Number or evidence |
| --- | --- | --- |
| Mall kit | pass, two pieces cut | travelator, wet floor, ramp and jump, glass window, cart train, fountain, tree, displays, light props (D43); the floor scrubber and the roller shutter are cut |
| Levels 1-3 built from the kit | pass | routes 416 / 420 / 356 m, timers 72 / 64 / 58 s, goods for 7.8 / 8.1 / 8.5 carts |
| No dead ends; the checkout is reachable from any point | pass | the validator walks the route field from every floor tile; every bot finishes every run on all three levels |
| Beginner bot finishes with 10 s to spare on Level 1 and 5 s on the others | pass | worst run: 14.52 s, 5.86 s, 6.30 s |
| Expert without collecting takes 55-65% of the timer | Level 3 only | 52%, 52%, 57% (D30, D44: Levels 1 and 2 are kept looser for the beginner's margin) |
| Something every 3-5 s; no empty stretch over 25 m | pass | longest empty stretch on the route 9 / 13 / 12 m (validator) |
| Every hazard is visible 0.7 s ahead at full speed | pass | train: its track is drawn across the corridor and a shadow runs 4 m ahead of it; wet floor: sheen and sign; the wrong-way belt: arrows; a ram: 0.8 s of "!" and a line on the floor; a closing lane: 2 s |
| Each level has one new element and one screenshot moment | pass | L1 sweeping and the dash / the crush at the doors; L2 the drift, belts, the window / a drift round a display; L3 the ramp, the train, wet floor / the jump over the fountain (`shots/m5/jump_strip.png`) |
| Control taken away for at most a second | pass | longest stun 0.81 s over all bots and levels (a jump is 0.9 s of the player's own choice) |
| One hit costs no more than 40% | pass | worst ram and shed on Levels 2 and 3: 40%, 39% |
| Icon teaching | pass | `shots/m5/hints_*.png` (A D W, then SHIFT), `hint_drift_2p7.png` (SPACE); each is saved as seen after its first use; the steering keys return for the first two ram warnings |
| Medals, records, unlocking, skip after three failures | pass | `shots/m5/flow_receipt.png`, `cards.png`; one saved object through the platform layer; medal thresholds between the bots' medians (tables below) |
| Leaderboards | submit only | the best receipt per store and their sum are submitted; no screen (cut, "Should") |
| Mobile controls under the thumbs | pass | `shots/m5/phone.png`; touch test: {touch: true, left: true, steer: 1, gas: 1, speed: 11.8, released: true} |
| One click and no more than 3 s to playing; restart 1.5 s | pass | START to GO 2.4 s; restart countdown 1.2 s |
| Reads at 800x450 and on a phone | pass | `shots/m4/small_*.png`, `phone_*.png`, `shots/m5/phone.png`; labels at least 9 px |
| Losing focus pauses; resizing breaks nothing | pass | blur pauses a run (`shots/m5/pause_after.png`); the interface is laid out in one unit that follows the window |
| Rivals on the new levels | pass, with D62 | every rival finishes every run; stuck events 0.006 and 0.006 per run; best rival at 89% and 106% of the confident bot, average at 49% and 48% of the expert |
| The finale on the new levels | pass | closing time seen for 10.08 s and 11.67 s (confident, medians); flash sale taken by the player's bot / a rival: 67% / 27% and 25% / 71% (confident) |
| Budgets | pass | 15 files, 5,348 lines; 312 KB without three.js |

| Level 2 bot | Time (slowest) | Of 64 s | Receipt (median) | Goods taken / lost | List | Modes | 1st place | Medals bronze / silver / gold / black |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beginner | 52.18 s (58.14) | 82% | $2,916 | 52.32 / 1.03 | 100% | 0.19 | 6% | 180 / 19 / 1 / 0 |
| confident | 43.20 s (49.60) | 67% | $7,231 | 57.70 / 2.52 | 100% | 1.22 | 58% | 29 / 101 / 58 / 12 |
| expert | 41.00 s (47.18) | 64% | $8,528 | 54.40 / 1.83 | 100% | 1.25 | 81% | 8 / 65 / 94 / 33 |
| sloppy | 43.35 s (51.01) | 68% | $6,381 | 53.69 / 6.75 | 98% | 1.17 | 47% | 55 / 90 / 49 / 6 |
| expert, no collecting | 33.15 s (39.38) | 52% | $632 | 8.47 / 0.04 | 0% | 0 | 0% | 200 / 0 / 0 / 0 |

Rivals, Level 2: Sprint Dad $5,251 in 42.20 s, Granny Tank $3,712 in 47.01 s, Coupon Queen $4,388 in 42.03 s, Selfie Star $3,090 in 47.15 s.

| Level 3 bot | Time (slowest) | Of 58 s | Receipt (median) | Goods taken / lost | List | Modes | 1st place | Medals bronze / silver / gold / black |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beginner | 45.14 s (51.70) | 78% | $2,177 | 43.90 / 5.47 | 96% | 0.18 | 5% | 161 / 31 / 8 / 0 |
| confident | 38.86 s (47.35) | 67% | $4,471 | 48.90 / 3.31 | 93% | 0.82 | 39% | 46 / 80 / 68 / 6 |
| expert | 36.54 s (45.69) | 63% | $5,790 | 48.97 / 3.61 | 94% | 1.02 | 66% | 15 / 60 / 87 / 38 |
| sloppy | 38.76 s (48.22) | 67% | $4,373 | 53.78 / 12.63 | 86% | 1.19 | 40% | 53 / 73 / 57 / 17 |
| expert, no collecting | 32.92 s (37.12) | 57% | $551 | 6.26 / 0.87 | 3% | 0.01 | 0% | 199 / 1 / 0 / 0 |

Rivals, Level 3: Sprint Dad $3,000 in 37.81 s, Coupon Queen $2,910 in 37.06 s, Granny Tank $3,623 in 41.16 s, Selfie Star $1,477 in 43.59 s, Bulk Bro $2,062 in 39.85 s.

### M6 Juice — self-gate measured, fresh-eyes review pending

Gate: *30 seconds of footage look alive even with the sound off.*

| Criterion | Result | Number or evidence |
| --- | --- | --- |
| Every action has a sound | pass by inspection | `audio.js` has a case for each of the simulation's event types and five interface cues (D51); the dodge has its own |
| No clicks, no clipping | pass | offline render of a scripted 24 s (music, noises, every kind of event) through the game's own graph: peak 0.835, 0 clipped samples, RMS 0.122, loudest second 0.161, 0 silent seconds; every envelope starts from zero and ends on an exponential tail |
| The music loops without a seam and speeds up at closing time | pass by construction | a look-ahead scheduler steps a 64-step pattern for ever; 114 -> 134 bpm, now for the 8-19 s of every run's finale (D56) |
| Sound starts after the player's first action | pass | `audio` scenario: no context before a real click, then "running" with 7 voices sounding |
| Separate music and effects volume; the platform's sound switch | pass | pause screen; `platform.setSound` |
| Response in the same frame: hit-stop, sound, effect, the target's reaction | pass | `shots/m4/ram_strip.png`, `smash_strip.png`, `strike_strip.png`; events are presented in the frame they happen |
| Checkout: time slows, goods fly to the counter, the receipt prints with beeps, the medal is stamped | pass | `shots/m5/checkout_strip.png` |
| Interface animation | pass | plates pop, the meter and the total bump, list icons tick, the receipt prints on game time |
| Footage | pass | `shots/m5/video.webm` (28 s of a bot run), captured by the same tool |
| 60 fps | pass here | 165 fps, 95th-percentile frame gap 6.1 ms on an RTX 4060 (`gates/m4-capture.json`, `realtime`); draw calls 15-75, triangles up to 139,900; integrated graphics unmeasured (D50 steps quality down if frames slow) |
