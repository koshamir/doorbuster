## STATUS (at most 10 lines)
Phase: P5 SHIP done — released (tag release, moved after the art review) and p5 (23 Nov 2026); frozen (deadline 29 Nov 18:00 owner time, UTC+5)
Done: P1-P5; six stores, four modes, Directory, Customs, jury fixes, the handoff package in handoff/ (node tools/package.mjs rebuilds and checks it)
Next: the owner uploads handoff/ to Mindblown (steps in REPORTS.md, P5) and enters it in the cup by 30 Nov
Open problems: see Known issues
After release: a level editor (editor/, served at /editor/) and the universal level format (docs/LEVEL_FORMAT.md, tools/level.mjs)

## Owner feedback (verbatim, latest first, last 3 rounds)
2026-11-23 (translated from Russian): "Make me a convenient, practical level creator where I can design a level by hand and place everything myself, objects and so on, in a practical way. Above all, I must be able to export it in the most universal form, one I can hand to you, that suits many versions of our project and is very clear to AI agents."

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
D39 2026-11-23 Level 5 GAME ON: author time 47 s (four departments in any order); level 6 FOOD FIGHT: author time 27 s.
D40 2026-11-23 Turbo Gramps starts with a loaded cart (24 goods): it slows him to the tuning below and a ram makes it fly. The level 6 race keeps LEVELS.md's shape on a track about half as long: Gramps through the checkpoints at about 8.5/15/20 s and home at 29-31 s; the expert wins by about 4 s, the confident bot 9 of 10.
D41 2026-11-23 Level 6 ends head-on: counters turned for east-west lanes (plan letter E) close the home stretch; the 90-degree turn into a north-south lane cost up to 10 s.
D42 2026-11-23 Medals follow the release rule (QUALITY.md section 8): the author receipt is the best of the expert bot's seeds 1-5, written into the level as authorReceipt; silver 70%, gold 90%, the Black Card above it.
D43 2026-11-23 One groove, six bands (ART.md section 8): the same bass line, chords and lead, re-voiced per kit with its own drums and a tempo factor.
D44 2026-11-23 A frame stamped before the previous task ended gives dt 0, never negative: a negative dt broke the rigs' squash into NaN in real-time play.
D45 2026-11-23 A race's final table ranks by who got to a checkout first and shows the times; a RACE line with a star per checkpoint led prints on the receipt.
D46 2026-11-23 The sports hub floor is rubber gym matting with coloured flecks, so it never reads as the electronics store's navy floor.
D47 2026-11-23 Hazards that an object answers for itself (arena.js: cushion walls, bags, foosball, belly bros, grills, cleavers) live in their own module; props.js hands them over.
D48 2026-11-23 rivalValue (a level's handicap on what the rivals' goods ring up at): level 1 at 0.5 (Sprint Dad swept the freezers to 145% of a confident player), level 4 at 0.55 (Granny's starting tower); levels 3 and 5 stay low on purpose, their rivals race for time.
D49 2026-11-23 The Cart Customs price tags are scoped to the customs screen: as a global .tag rule they had pushed the HUD's RECEIPT under the Madness meter since P3.
D50 2026-11-23 The handoff ships lib/three.min.js only for local runs; on mindblown.ai the page loads the hosted bundle.
D51 2026-11-23 The arena's objects raise their own sound flags (snd at sx/sz) and main.js plays them by distance, like the signs' creak.
D52 2026-11-23 Jury review (QUALITY.md section 4) applied: HUD totals, the clocks, a darker backroom and a lower first swoop, shop-window renders in the Directory, the RAM! price tag, Cart Customs fixes, a close-up camera that never clips.
D53 2026-11-23 Jury skip: no portrait behind the receipt; while the race plays out the hero's spot is not reliably free, so the receipt keeps the wide view and the 1.5 s close-up carries the portrait.
D54 2026-11-23 Jury skip: no new pieces in level 1's quiet stretches; its plan is tuned against wipeouts, so the shorter clock and the ram cue carry the pace instead.
D55 2026-11-23 Jury skip: Granny's "stuck" events are her waiting at the pop-up tiles (her scripted first fail), not a jam.
D56 2026-11-23 Clocks: timer just above the slowest beginner bot; CLOSING TIME (level field closing) starts before the median beginner gets home; level 2 keeps its 30 s with stopwatches.
D57 2026-11-23 Levels 7 NEON NIGHTS and 8 LAST CALL are not built: the shipped source is at the 30-file limit and the time went to the jury's fixes and the release (DESIGN.md section 10 cut order).
D58 2026-11-23 A third reviewer, the art director on the final build, at the owner's request (QUALITY.md section 4 planned two).
D59 2026-11-23 Art review applied: a calm violet backroom, wall stripes as flat paint, puddles in saturated blue with ink and a white rim, mint route chevrons, a cut cheese wheel, broken crowd silhouettes, bolder brows and mouths.
D60 2026-11-23 Art review skips: no fog or wall-top ink line (a global change this late risks all six stores); no lens lids for Selfie or mouth through Bubba's beard (their bolder brows carry the emotion); no belt edges (the "belt" is an open freezer chest).
D61 2026-11-23 Level files are JSON with the map as ASCII rows plus a legend that names every character: readers map by name, so the game may change its characters; every setting and field is written out, with units in the names.
D62 2026-11-23 Each file carries an about text and a glossary of the names it uses, so an AI agent needs nothing else to read or edit it; editor/catalog.js is the one vocabulary, editor/format.js the one converter.
D63 2026-11-23 The editor lives outside src/ (the shipped game stays at 30 files); its checks and bot runs call the game's own world.js, objects.js and sim.js, and its test drive is index.html?custom=1 (a level in localStorage; nothing saved or submitted).
D64 2026-11-23 All six levels go game -> file -> game with the same expert receipt and checkout time (seed 1), so the format loses nothing.

## Known issues (at most 10)
- Level 4 receipts run small (the boutique spills most loot), so bronze is common there.
- In levels 3 and 5 the rivals race for time, not loot: the player usually tops the table.
- Granny Tank now and then waits at level 1's pop-up tiles long enough for the sim to count her as stuck.
- Behind the receipt the view is wide; the portrait is the 1.5 s close-up (from behind in most stores).
- Integrated graphics are untested here (budgets measured on this machine only); the platform calls are tested against a mock of window.mindblown.
