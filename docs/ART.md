# Art direction: visuals and sound

## 1. The look in one phrase

**A toy diorama with outlines:** chubby clean shapes, juicy colors, two-tone cartoon lighting, a dark colored outline, soft blob shadows. A still frame should look like an illustration you would happily put on the cover.

Mood references are in `references/README.md`. Take clean shapes, color and readability from them. Do not take other people's characters, names or recognizable objects.

## 2. Five style rules

1. **Silhouette over detail.** The camera is high and objects are small. Every object is recognized by its outline and one or two color patches.
2. **The top face matters most.** The player looks from above: put color, patterns and identifying marks on box lids, heads and shelf tops.
3. **Chubbiness.** Rounded boxes with a bevel of 8–15% of their size, cylinders, capsules, spheres. Nothing thinner than 4 cm: thin things shimmer and disappear.
4. **One material for everything.** The same lighting and outlines on the cart, people, goods and walls. No photo textures, no realistic shine.
5. **Color discipline.** About 24 base colors for the whole game. Brightness goes only where the player should look.

## 3. Palette

Starting values, adjusted by eye.

| Role | Color | Where |
| --- | --- | --- |
| Floor | `#F3E9DC`, grout `#E6D8C5` | cream tiles in a large grid — the grid makes speed readable |
| Walls | `#FFF6EA` | general mall background |
| Store accent walls | `#8EE3C8` `#FF8A7A` `#7CC6FE` `#FFD166` | each store has its own color, so the player knows where they are |
| Shelves and furniture | `#FFFFFF` `#DDE3EA` | neutral, so the goods pop |
| Black Friday | `#1E1B2E` and `#FFD23F` | banners, signs, interface plates |
| Price tags and danger | `#FF3B4E` | price tags, hot item ribbons, red closing light |
| Player | `#FF4FA3` | the hero's cart and clothes; no one else gets this color |
| Rivals | `#9B5DE5` `#2EC4B6` `#FF9F1C` `#3A86FF` `#8AC926` | one color per character |
| Crowd | `#B8C0CC` `#C9BBCF` `#BFD3C1` | muted, so it does not compete with the racers |
| List item | `#00D1C1` | highlight ring |
| Hot item | `#FFC800` | beam and halo |
| Outline | `#2A1A3A` | dark plum, not pure black |

**Light and shadow.** Warm light, shadows shifting toward cool purple: the shadow tone is roughly the base color multiplied by (0.62, 0.58, 0.78). Color in the frame: about 60% neutral background, 30% mid-brightness objects, 10% bright accents.

## 4. Objects

**The hero and shoppers.** "Beans": a capsule body, a sphere head, two dot eyes, ball hands on the cart handle. Legs short or hidden. Character comes from one large accessory: a shawl, a cap, a megaphone, a ring light. No skeleton — animation is procedural: bobbing while moving, leaning into turns, squash and stretch on impact, stars above a dazed head, a victory pose at the checkout.

**The cart.** Bigger than a real one, with big wheels. The basket is solid, with a thick rim and three or four thick ribs, not a mesh of thin wires. The bumper glows when the dash is ready. The wheels spark when drifting. The player's cart is in the player's color, rivals' carts in theirs.

**Goods.** 12–16 kinds, each built from 1–3 primitives with a large colored label: box, can, bottle, bag, roll, ball. Hot items are recognizable silhouettes: a TV in a box, a giant teddy bear, a game console, a robot vacuum. Goods are deliberately oversized so the tower reads from far away.

**The mall.** Tiled floor with a stripe of reflection, dark shop windows with a diagonal glare, punny store signs (Price Panic, Gadget Goblin — invented, not real brands), SALE −70% banners, potted plants, benches, garlands, a Christmas tree in the atrium, piles of gifts, inflatable figures at the entrances. Decor stands along the walls and overhead and does not interfere with reading the floor.

**Effects.** Simple and graphic: stars, "poof" clouds, speed lines, yellow diamond sparks, confetti made of receipts and coupons, a star flash on impact, floating prices "+$45". No realistic smoke or blurry glow.

## 5. Interface

- The shape language is the receipt and the price tag: white paper with a serrated edge, monospaced digits for the total, yellow-and-black sale plates, red medal stamps.
- Big, bold type with an outline and a shadow. No external fonts: a bold system font stack, styled with CSS or canvas. A custom font may be embedded only as a data URI and only after agreeing with the owner.
- Chubby buttons with a shadow underneath that press with a spring. Elements appear with a "pop" in 100–200 ms.
- Key icons are drawn as keys. The interface and the 3D share one palette.

## 6. How to get there in three.js

These are hints, not requirements. Choose methods by result and performance.

- **Lighting.** One directional light and a soft fill. Toon shading in 2–3 steps: `MeshToonMaterial` with a small `gradientMap` and `NearestFilter`, or a custom shader. A light rim light on characters.
- **Outline.** Option one is the "inverted hull": a copy of the mesh with `BackSide`, pushed out along smoothed normals, with a constant on-screen thickness. Option two is a full-screen pass on depth and normals. The ready-made `OutlineEffect` is in the addons, which the platform does not provide, so write your own compact version.
- **Outline thickness.** About 2.5 px at 1080p on carts, people and hot items; about 1.5 px on small objects; walls and floor have no outline or a thinner one.
- **Shadows.** Dark ellipses under moving objects. Real shadow maps only if they fit the budget.
- **Color.** Vertex colors and a shared palette instead of textures. sRGB output without tone mapping so the colors do not wash out. Antialiasing on, pixel ratio no higher than 2.
- **Performance.** `InstancedMesh` for shelves, goods and the crowd, merged static level geometry.

## 7. Sound

Everything is synthesized with WebAudio; there are no audio files.

- **Music.** Upbeat sale funk: bass, drums, keys. Layers are added as Madness grows, the tempo rises at CLOSING TIME, and a filter kicks in during Madness mode. Seamless loop.
- **Feedback.** The item "pop" rises in pitch with each item in a chain and resets after a pause. The checkout scanner beeps up the scale. A cash register "ka-ching" on the final total.
- **Impacts.** Each impact has three layers in the same frame as the picture: a click, the main sound, a "tasty" layer (crowd gasp, clanging cans).
- **World.** Squeaking wheels on a heavy cart, a drift screech, crowd murmur that thickens toward the end, the announcer's "ding-dong".
- **Voices.** Short gibberish exclamations from the hero and rivals, no more than once every 8 seconds per character. Separate volume for music and effects.

## 8. Don't

- Realistic materials, grey-brown lighting, black pits of shadow.
- Thin meshes and wires, small indistinguishable goods.
- Pure black outlines on everything — it turns into mud.
- Glow and blur over the whole frame.
- An interface with default buttons and fonts.
- A crowd brighter than the racers.

## 9. Art acceptance

- **Squint test.** In a screenshot scaled down to 320 px wide, the player's cart, the rivals, the hot items and the direction of travel are visible.
- The player finds their own cart within half a second in any pile-up.
- Ten random frames from a run look like one style; no object stands out.
- The frame at the start of a level works as a cover without retouching.
- Outline thickness is the same on all important objects at any camera distance.
- 60 frames per second with the full picture (budgets in `QUALITY.md`).
