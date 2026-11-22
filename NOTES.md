## STATUS (at most 10 lines)
Phase: P1 LOOK (prompts/P1_LOOK.md) — in progress
Done: housekeeping; tools; items 1-6 (render, characters, cart, products, supermarket kit, title and checkout close-up)
Next: art-director review fixes, final lineup / kit:supermarket / level:1 shots, tag p1, report, then P2
Open problems: levels are v2 placeholders until P2; lane lamps and some props are simple

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

## Known issues (at most 10)
