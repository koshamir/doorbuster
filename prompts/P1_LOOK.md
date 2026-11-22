# P1 LOOK — the visual overhaul

**Dates:** 23–24 November.

**Where you start.** The v2 build plays and its UI is good, but every character and object is built from three primitives with vertex colours, and it shows.

**Goal of this phase.** Make the game look like a stylish cartoon. Gameplay stays exactly as it is until P2.

**Read now:**

- `docs/ART.md` (all) and `docs/QUALITY.md` (all);
- `docs/MINDBLOWN.md` §2–3;
- `docs/DESIGN.md` §5–7 (who the cast are and how they emote);
- the two images in `references/`.

## 1. Housekeeping — keep it short

1. **Save v2.** Commit everything as it is and tag it `v2`.
2. **Delete what v3 replaces:**
   - `tools/_*`, `tools/evidence.mjs`;
   - `gates/`, `shots/`, `handoff/`;
   - the root `GDD.md` (a copy of `docs/GDD.md`), `START.md`, `PLAN.md`, `HANDOFF.md`.
3. **Notes.** Replace `DEVLOG.md` with `NOTES.md` in the format of `QUALITY.md` §5. Carry over only decisions about v2 systems that still hold, at most 10 lines, then delete `DEVLOG.md`.
4. **three.js.** Download the hosted bundle (`MINDBLOWN.md` §2) to `lib/three.min.js`.
   - List the addon classes it defines in one `NOTES.md` line, and check that the game runs on it.
   - If the download fails, keep the current copy and note that.
   - Remove `tools/vendor-three.mjs` and the `three` dev dependency once nothing needs them.
5. **Tools.** Rewrite `npm run check` and `npm run shots` to `QUALITY.md` §2–3, reusing what works in `tools/`, and remove the `evidence` script.
   - The old levels cannot meet the v3 level rules. In P1 the validator checks only reachability and order, and the smoke test checks finishing, stuck rivals and determinism. Pass windows, the loot rule, pace, author times and wipeouts switch on in P2 with the new levels.
   - `npm run sim` and `npm run script` may stay as tuning helpers. They are not part of the routine.

## 2. Build, in this order

After each item:

1. run `npm run check` and commit;
2. for visual items, run `npm run shots` with the matching target and look at every image;
3. fix the worst three problems and shoot again.

**Items:**

1. **Rendering** (`ART.md` §2):
   - cel materials;
   - ink: hull silhouettes on characters, carts, hazards and hot items, and the screen-space crease pass for everything else;
   - light pools and the HIGH-tier shadow map;
   - the post stack;
   - quality tiers with the title-screen benchmark and `?quality=`.
2. **Characters** (`ART.md` §3):
   - the geometry builders and rigid-skinned single-mesh characters;
   - the face atlas with seven expressions and a blink, and the pattern atlas;
   - the procedural animation set with secondary motion;
   - Penny and the six rivals;
   - the 13 crowd archetypes as instanced, vertex-animated meshes with LOD;
   - showcases `?scene=lineup` and `?scene=faces`.
   - Replace every bean in the game.
3. **The cart** (`ART.md` §4):
   - the new cart;
   - every upgrade tier and cosmetic, as data the shop will use in P3;
   - the rival carts and Gramps' scooter;
   - showcase `?scene=cart`.
4. **Products and hot items** (`ART.md` §5): the base shapes, the label atlas, 40+ products and the 8 hot items, instanced per base shape.
5. **The supermarket kit** (`ART.md` §6), as reusable per-store data: floor, fixtures, signs, decor, light pools and grade.
   - Showcase `?scene=kit&store=supermarket`.
   - Apply it to every current level.
6. **Title screen and checkout close-up:**
   - the title is the cast lined up behind the mall doors (`DESIGN.md` §8);
   - the 1.5 s checkout close-up shows each named character's victory and defeat poses (`DESIGN.md` §7, `ART.md` §3).

**Modules.** Keep `src/` flat and within the limits; merge or split as you see fit. One possible layout: `render.js` (renderer, materials, post, tiers), `shapes.js` (geometry builders), `atlas.js` (canvas atlases), `cast.js` (character looks as data), `rig.js` (character meshes and animation), `crowd.js`, `cartart.js`, `goods.js`, `kits.js`, `showcase.js`. `gfx.js`, `models.js` and `scene.js` shrink or go.

## 3. Review

When items 1–6 are done:

1. Run the art-director reviewer once (`QUALITY.md` §4).
2. Fix what you agree with.
3. Shoot `lineup`, `kit:supermarket` and `level:1` one last time.

## Done when

- `npm run check` passes.
- Judging from the shots, `ART.md` §9 points 1–3 and 5–10 hold, and point 4 holds for the supermarket.
- The reviewer's top 5 are fixed, or skipped with a one-line reason.
- The game plays exactly as before: same handling, same levels, new look.

Then tag `p1`, update STATUS in `NOTES.md`, and end with the report (`CLAUDE.md`): at most 15 lines and three things for the owner to try.

## Where the effort goes

This phase is what the judges see in their first second. Spend it on proportions, silhouettes, faces, colour, shading and animation. Iterate on the shots until the cast looks like a professional cartoon cast and the store looks like a set from a stylish game. Tooling gets the minimum that makes the checks in `QUALITY.md` work.
