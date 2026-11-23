## STATUS (at most 10 lines)
Phase: P4 CAMPAIGN (prompts/P4_CAMPAIGN.md) — starting; P3 STORES done and tagged p3 (23 Nov)
Done: P1 look; P2 objects, modes, levels 1-2; P3 levels 3-4 with the electronics and boutique kits, the Mall Directory, Cart Customs, wallet, intro cards
Next: P4 item 1 (read prompts/P4_CAMPAIGN.md)
Open problems: the expert bot is now and then caught by the yarn ball late in the serpentine; L3/L4 author runs are shorter than the doc's 38/35 s

## Owner feedback (verbatim, latest first, last 3 rounds)

## Decisions (one line each)
D1 2026-11-22 Fixed step 1/120 s with render interpolation, at most 20 steps a frame; key events carry time stamps and land on their own step.
D2 2026-11-22 Cart model: body heading and travel direction are separate; grip turns the velocity toward the body (slip -= sin(slip)(1-e^-grip dt)); a drift holds a clean arc.
D3 2026-11-22 A nose-first hit at speed glances off with 55% of the speed along the surface; a pinned cart swings along the wall, then backs out after 0.3 s.
D4 2026-11-22 Four invisible helpers stay: steering assist, sweep lane at 0.25 m off a stocked shelf, pinned swing, checkout funnel.
D5 2026-11-22 At the cap a dearer item pushes the cheapest goods out; the loot heap packs over six columns; one hit never costs more than 40% of the tower's dollars.
D6 2026-11-22 A rival's ram on the player is announced 0.8 s ahead ("!" and a floor line) and committed; at most maxRams per run.
D7 2026-11-22 Captures run Playwright's own Chromium 1228 in new headless mode with the real GPU (the installed Chrome refuses headless).
D8 2026-11-22 The interface runs on game time; in manual mode the page's CSS animations are put on the game clock.
D9 2026-11-22 The single-file build strips imports into one script and parses it once: top-level names must be unique across modules.
D10 2026-11-23 Hosted bundle (lib/three.min.js, r185 "mb3d 4") adds: GLTFLoader, MeshoptDecoder, RoomEnvironment, BufferGeometryUtils, mergeGeometries, RoundedBoxGeometry, EffectComposer, RenderPass, ShaderPass, OutputPass, UnrealBloomPass, SMAAPass, FilmPass, GlitchPass, AfterimagePass, RenderPixelatedPass, VignetteShader, ColorCorrectionShader, RGBShiftShader. No FXAA: ours is written in render.js.
D11 2026-11-23 The canvas is created with premultipliedAlpha false: three premultiplies the clear colour by its alpha, and the scene alpha is the glow mask.
D12 2026-11-23 A character and its cart are one rigidly skinned mesh (26 bones): two draw calls per racer, hands solved onto the cart grips by two-bone IK.
D13 2026-11-23 Goods keep their v2 gameplay ids and prices; their look is a variant chosen from a position hash, so the game plays as before with 46 products.
D14 2026-11-23 Shelf stock is written once into the goods instance buffers as a locked prefix; moving goods are rewritten after it every frame.
D15 2026-11-23 Triangle budgets count the main pass only; the shadow pass skips the ink hulls.
D16 2026-11-23 Review 1 (blank loot): label front and back, fixed prints from label cell 32 up (carton top, side panel, boxed appliances), tower labels face the camera. Fixed.
D17 2026-11-23 Review 2 (blank frames): overstock cartons on every wall top and a dim backroom ring round the plan instead of the void. Fixed.
D18 2026-11-23 Review 3 (rams): world-anchored halftone stickers, hitstop, ink flash, camera kick, the victim looks shocked at the camera. The 8-15 goods fountain is skipped in P1: it is the P2 spill rule.
D19 2026-11-23 Review 4 (title, close-up): the whole cast as a group photo at the glass (Granny on foot), START below; a front three-quarter close-up without the tower. Fixed.
D20 2026-11-23 Review 5 (dotted ink): creases from opposite neighbours, ink after the halftone, FXAA keeps ink pixels; hull-inked things take depth silhouettes only (aux alpha <= 0.5). Fixed.
D21 2026-11-23 Level objects are generic behaviours placed by level data (objects.js); each answers dangerAt and passDelay, which the drivers and the validator use.
D22 2026-11-23 Drivers judge each hazard once per approach (bots 0.4-1, rivals 0.8-0.97), take the highest steady speed whose whole crossing is clear, wait well short of it, give up after 3.5 s.
D23 2026-11-23 A pop-up tile throws the cart straight up (no chain onto the next tile) with 2.2 s of tile immunity; level 1's field pops column by column, easy to read.
D24 2026-11-23 Granny's first try at level 1's tiles is scripted to fail (she picks a speed that meets a pop); scripted failures are not counted as misses.
D25 2026-11-23 CLOSING TIME is the last 15 s on the clock (no lanes close); the flash sale is gone. RAM warning stays 0.8 s (D6): fairer than 0.5.
D26 2026-11-23 Voice files: assets/voice/voices.json lists the owner's mp3s (empty), so the game never asks for a file that is not there.
D27 2026-11-23 The pace rule counts objects, loot, pieces, shoppers and rivals in reach, conveyor rides and turns; a respawn is a jump, not a drive.
D28 2026-11-23 L3 GADGET GOBLIN and L4 DRESS TO DISTRESS author runs are 29 s (doc: about 38 and 35): denser beats rather than longer walks.
D29 2026-11-23 Smart barriers are walls of coloured light, solid 0.6 m thick across their tiles; the player's bots route as if all were down and dash to flip one in their way, holding the dash while a wipe hazard behind it is not clear.
D30 2026-11-23 A turnstile's sweep is shut to the drivers' routes (they go round; the phones on its arms are the greedy player's); a hit sweeps the cart out of the circle.
D31 2026-11-23 Robot vacuums stop when they bump into a cart; only a cart that drives into one fast is knocked back.
D32 2026-11-23 Glove plates are two tiles wide on alternating sides of the fitting-room aisle; the middle lane is safe unless someone presses a plate.
D33 2026-11-23 The yarn ball drops for 0.8 s, rolls at 11.4 m/s, slows to 62% and 82% at sharp and soft turns, and stops 14 m short of the checkouts; catching the player puts the handbag back.
D34 2026-11-23 Upgrade tiers cost 800, 2000 and 4000 (a first run on level 1 pays for one); they act on the player's cart only and never in bot runs.
D35 2026-11-23 Every store is open; the directory recommends the first store not yet played (else the first without gold) and Enter after a receipt plays it.
D36 2026-11-23 The intro card's portraits are the 3D heads rendered once into small pictures.
D37 2026-11-23 L4's serpentine dividers are plain walls: as shoe walls they put 27% of the goods on the safe line.
D38 2026-11-23 The timed barrier fallback (flipEvery) stays off: the bots and the flip flash read well; switch it on if the owner is confused.

## Known issues (at most 10)
