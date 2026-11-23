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
