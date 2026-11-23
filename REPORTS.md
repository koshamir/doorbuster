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
