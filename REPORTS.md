# Phase reports

## P1 LOOK — 23 Nov 2026 (tag `p1`)

- Every frame is now a cel-and-ink cartoon: banded cel shading with lilac shadows and rim light, hull ink on characters, carts and hot items, screen-space crease ink everywhere else, light pools, a HIGH-tier shadow map, bloom from glowing parts, halftone in shadows, impact frames, three quality tiers picked by a title-screen benchmark.
- The cast is new: Penny and the six rivals as rigidly skinned single meshes with faces (seven expressions and a blink), procedural pushing, riding, drifting, dashing, tumbling, taunts, victory and defeat poses; thirteen instanced crowd archetypes with their own silhouettes.
- The cart is new, with every upgrade tier and cosmetic built as data for the P3 shop; the rivals' carts and Gramps' scooter; 46 printed products and 8 hot items.
- The supermarket kit: checker floor with decals, gondolas, produce crates, freezers, deli and fish counter, checkouts, signs, overstock on the walls and a dim backroom around the store.
- The title is the whole cast pressed against the mall doors; the checkout ends on a 1.5 s close-up of Penny's victory or defeat pose.
- The art-director review's five points are fixed (only the goods fountain waits for P2's spill rule).
- Gameplay is unchanged; `npm run check` passes in 7 s (peak 88 draw calls, 418k triangles).

Try: (1) `?title=1`: press START and watch the doors open; (2) ram Granny Tank in the first second of level 1 for the BAM! sticker; (3) finish level 1 and watch the close-up before the receipt.

## P2 PLAY — 23 Nov 2026 (tag `p2`)

- Stores are obstacle courses now: an object system (swinging sale signs, pop-up tiles, forklifts and pallet jacks, bell buttons with lit cables, roller shutters and doors, a hidden plate and secret door, boost arrows, stopwatches, inflatable checkpoint arches, can pyramids and the MEGA PYRAMID), each object with its look, telegraph and sound.
- Wipeouts throw the shopper out in a tumble (BONK!), scatter the top quarter of the tower and respawn the cart at the last checkpoint at half speed; R restarts in 1.5 s.
- RUSH and SMASH with their receipt lines and medals; CLEAN SWEEP for leaving the warehouse without touching a can.
- Rivals time every hazard, miss now and then in a comic way (Granny is always launched by the tiles on level 1), ram, take revenge, and drop everything in a fountain when the player rams them with a dash.
- Every line of the cast and the crowd in speech bubbles with gibberish voices (the owner's mp3s can replace them), emotes, and the crowd's absurd moments: a breakdancing mascot, scooter donuts, a price-gun chase, a stroller baby throwing goods, pancakes.
- Level 1 PRICE PANIC (supermarket, about 27 s) and level 2 CAN-DEMONIUM (new warehouse kit, about 24 s) replace the v2 campaign.
- `npm run check` passes with the v3 rules: author times, beginner runs, rival pass rates, the loot rule and pace.

Try: (1) level 1: let the sign swing past, then thread the pop-up tiles column by column; (2) level 1: press the bell button on the conveyor and dash through the ribbon for the cheese wheel; (3) level 2: find the plate that turns green near the checkouts and open the MEGA PYRAMID room.

## P3 STORES — 23 Nov 2026 (tag `p3`)

- Level 3 GADGET GOBLIN (electronics, about 29 s): every dash flips the store's red and blue barriers (walls of light with floor strips, a colour flash and a ZAP); a lesson corridor, TV turnstiles, trapdoor panels over the stockroom pit, robot vacuums, a corridor you must flip while crossing, a barrier chicane, a laser turret with the GIGA TV in its glass case, two checkouts behind red and blue.
- Level 4 DRESS TO DISTRESS (boutique, about 29 s): glove plates in the fitting-room aisle, a mannequin gauntlet, a catwalk over clearance bins with giant scissors, and the GOLDEN HANDBAG that lets the giant yarn ball chase you down the shoe department.
- Two new kits: glossy navy grid floor with TV walls playing four animated channels and neon; cream marble with gold inlays, velvet fitting rooms, clothes racks, shoe-box walls, dressed mannequins.
- Meta: the wallet, Cart Customs (upgrades that change the cart and how it drives, paints, hats, on a turntable), the Mall Directory (every store open, the next one pulses), intro cards with live 3D portraits.
- On a fresh profile the first minute plays as DESIGN.md section 9: level 1, the receipt with CART CUSTOMS pulsing, a first upgrade on the turntable, the directory, level 2's first BAM.
- `npm run check` passes for levels 1-4 (rivals pass 89-95% of hazards).

Try: (1) level 3: dash at the first red wall, then flip again mid-way down the panel corridor; (2) level 4: grab the golden handbag and outrun the yarn ball; (3) after a run, buy BIG WHEELS in Cart Customs and watch the cart change.

## P4 CAMPAIGN — 23 Nov 2026 (tag `p4`)

- Two new modes: LIST (ram the list racks; the checkouts stay red until the list is done) and RACE (first through each checkpoint takes it; a star per checkpoint led and a RACE line on the receipt; the final table ranks by finish time).
- Level 5 GAME ON (sports megastore, LIST, about 47 s): a hub with four departments in any order: gym cushion walls and punching bags, the pool with its trampoline, the treadmill track with hurdles, giant foosball rows and the GOLAZO goal.
- Level 6 FOOD FIGHT (food court, RACE against Turbo Gramps, about 27 s): the sushi conveyor, grill strips bursting into flame, belly bros and a cleaver row, the dessert court of flying tables and the cake tower, three shortcuts, a head-on finish into turned checkouts.
- Two new kits with zone floors (turf, track, gym planks, pool deck, kitchen tread plate, sushi wood, dessert checker); the sports hub is rubber matting, the food court terracotta.
- Campaign: medals from author runs for all six stores; one groove re-orchestrated per store (muzak-funk, clank, synthwave, disco-house, stadium drums, surf-rock); leaderboards per level and total.
- Fixed a real-time-only bug: a frame stamped before boot ended ran time backwards and made the rivals' rigs vanish for the first seconds; the check now opens two real-time pages.
- The race: the expert wins by about 4 s, the confident bot 9 of 10, the beginner loses; `npm run check` passes for levels 1-6.

Try: (1) level 6: take the delivery-box shortcut out of the sushi lane and beat Gramps through all three checkpoints; (2) level 5: do the departments in a different order each run and watch the list racks; (3) play three stores in a row and listen to the music change.

## P5 SHIP — 23 Nov 2026 (tags `p5`, `release`)

- Shipped: six stores in four modes (RUSH, SMASH, LIST, RACE), the cast, the Mall Directory with shop windows, Cart Customs, a band per store; `handoff/` holds `index.html` (822 KB, one file), `tune.json`, `assets/voice/`, cover, card, icon and HANDOFF.md.
- Release fixes: medals by the release rule, rival hauls trimmed, the HUD receipt back in place and reset per run, clocks short enough for CLOSING TIME, a RAM! price tag on loaded rivals in dash range, sounds for every new object, a close-up camera that never clips; a jury review drove most of these.
- Checks: `npm run check` passes; the fresh-profile first minutes, a real-time console run (wipeout, pause, blur, resize, phone, restart), budgets (first frame 1.8 s, restarts 0.2 s, no memory growth) and a mock Mindblown run (load before save, boards, sound sync) are clean; the package's clean copy reproduces level 1's reference receipt ($1,812) with no external request.
- Known issues: level 4 receipts run small, so bronze is common there; in levels 3 and 5 the rivals rarely beat you on the table; integrated graphics are untested here.
- Upload: 1) `node tools/package.mjs` (rebuilds and checks `handoff/`); 2) on Mindblown create the page and upload `index.html` (entry), `tune.json` and `assets/voice/voices.json`, keeping the paths; 3) set `cover.jpg`, `card.jpg` and `icon.jpg` as the 16:9, square and icon images; 4) run the platform's render check, then the six checks in HANDOFF.md (reference receipt 1812); 5) enter the page in Mindblown Cup #2 before 30 Nov.
- Not built: levels 7 and 8 (source at the 30-file limit; the time went to the jury's fixes).

Try: (1) a laptop with integrated graphics, if one is at hand (the quality tier should settle by itself); (2) level 1 twice: chase the RAM! tag on Granny's cart; (3) level 6: beat Turbo Gramps to the head-on checkouts.

## Art review of the final build — 23 Nov 2026 (tag `release` moved)

- At your request an art-director reviewer looked at the final build. Fixed: the backroom (calm violet, not near-black), wall stripes as flat paint (no doubled ink), puddles that read as hazards, mint route chevrons, a cut cheese wheel, varied crowd silhouettes (the hot-dog mascot now shows), bolder brows and mouths.
- Skipped: fog, a wall-top ink line, lens lids for Selfie and a mouth through Bubba's beard (see NOTES D60).
- `handoff/` rebuilt and re-checked: the reference receipt is still $1,812, console clean, no external requests.
