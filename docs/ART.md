# DOORBUSTER — Art bible v3

Visual beauty is priority 1 (`CLAUDE.md`). This file says what the game looks like and how to build it in three.js with everything generated in code. The UI style stays as it is (§7).

## 1. Target

**Hi-Fi Rush rendering on a chunky toy world.** The two images in `references/` are from Hi-Fi Rush.

**Take from them:**

- **Lines.** Dark ink silhouettes, thicker on the outside, thinner inside.
- **Shading.** Two flat light bands with a hard terminator; shadows tinted, never grey or black; a crisp rim light.
- **Surfaces.** Bold graphic floor markings: rings, dashes, arrows.
- **Colour.** Calm environments with saturated accents on characters, hazards and loot.
- **Comic language.** Halftone dots, stickers, slanted bold numbers.
- **Faces.** Big readable eyes with highlights, strong brows.
- **Cast.** Strong silhouette variety: huge, tiny, lanky, round.

**Do not take:** their characters, logos, robots, UI layout or realistic body proportions.

Our people are toy figures, 2.5–3.5 heads tall, so they read from the high gameplay camera, where a character is about 120 px tall and a head 40–50 px at 1080p. Every design choice must survive that size. The close-ups (title, lineup, Cart Customs, checkout) show the full detail.

## 2. Rendering

Everything below is built with core three.js r185 plus whatever the hosted bundle adds (`MINDBLOWN.md` §2). Use hosted post-processing passes when the bundle has them; otherwise write compact ones. Numbers are starting values; the look decides.

### Materials: one cel shader family

- **Light bands.** `lit = smoothstep(t - aa, t + aa, dot(N, L))`, with `aa` from `fwidth` for a crisp but anti-aliased terminator.
  - `color = mix(base * shadowTint, base, lit)`.
  - `shadowTint` comes from the store grade, e.g. (0.62, 0.58, 0.78) for a lilac shadow.
- **Rim.** A hard fresnel band on the lit side for characters, carts and hot items, tinted by the store's key light.
- **Gloss band.** An optional hard highlight shape for plastic, glass, cans, chrome and hair (Hi-Fi Rush-style flat shine).
- **Emissive.** Screens, neon and lamps write an emissive value that feeds bloom.
- **Palette rule:** a hex in the config is the colour on screen in the lit band (no tone mapping), as now.
- **Normals.** Organic shapes get smooth normals, so the bands follow the form. Hard props get flat normals, so their planes read as clean faces.
- **Baked occlusion.** Builders darken vertex colours in crevices: under shelves, inside the basket, under the chin.

### Ink

1. **Silhouettes.** Keep the inverted-hull outline, constant in screen space, but only on characters and carts (3 px at 1080p) and on hazards and hot items (2.5 px). Ink colour is `#2A1A3A`.
2. **Creases and everything else.** One screen-space pass that finds depth and normal discontinuities draws 1–1.5 px lines over the whole frame.
   - This replaces hull outlines on goods and environment, which saves draw calls.
   - Lines fade with distance and are masked off the floor, which draws its own lines.
   - Get normals with multiple render targets (all project materials are custom shaders, so adding an output is cheap). If that fights you, use depth only.
3. **Interior lines are drawn into textures:** faces, clothing seams, label borders, sign frames.

### Light, shadow, post

- **Lights.** One warm key light, a hemisphere ambient tinted per store, and light pools drawn on the floor under ceiling lamps (additive decals, cheap and very effective).
- **Shadows.**
  - HIGH tier: one hard shadow map that follows the camera, cast only by the hero, rivals, carts and big hazards; received by the floor and fixtures. The shadow colour is the shadow band, not black.
  - Soft blob shadows under the crowd and goods on every tier, and under the hero, rivals and carts on MED and LOW.
- **Post order:**
  1. main pass (MSAA, multiple render targets);
  2. ink and halftone composite. Halftone dots go in environment shadows only, about 7 px at 45°, 10–20% strength;
  3. bloom from emissive;
  4. grade: per-store curves and saturation, a light vignette, speed lines at boost, impact frames;
  5. FXAA when MSAA is off.
- **Impact frames:** at most one 2-frame high-contrast ink flash per second, only on big hits, and a setting turns them off.

### Quality tiers

Chosen by a 2 s benchmark on the title screen; step down after 2 s over 20 ms; never step up mid-level. Force a tier with `?quality=`.

| Tier | Includes |
| --- | --- |
| HIGH | pixel ratio up to 1.5 (2 on screens under 1000 px); MSAA 4×; crease ink with normals; halftone; bloom; shadow map |
| MED | pixel ratio 1; MSAA 2× or FXAA; depth-only crease ink; half-resolution bloom; blob shadows |
| LOW | pixel ratio 0.75–1; no post; hull outlines on characters, carts, hazards and hot items; no bloom |

LOW must still look intentional: cel bands, faces, labels, floor graphics and outlines all stay.

## 3. Characters

### Construction

- **Toy figures with rigid parts:** hips, torso, head, upper and lower arms, mitten hands with a thumb, thighs, shins, big shoes, plus props. Joints hide behind overlapping round shapes (sleeves, ball joints, belts), so there is no skinning stretch to fight.
- **Shapes** come from lathe profiles (torsos, heads, bellies, skirts), super-ellipsoids (heads, hands, shoes), tubes along curves (scarves, cords, ponytails, straws) and extrusions (soles, glasses frames, coupons, brims).
- **One mesh per character.** Every vertex is bound to one bone (rigid skinning), so a character costs 2 draw calls with its outline. Characters are not a tree of separate meshes.
- **Triangle budget:** hero and rivals 4–7k; crowd up to 2.5k near and up to 800 far. Heads have at least 24 × 16 segments on hero and rivals and 16 × 10 on the crowd. Nothing may look faceted in a close-up.
- **Hair:** chunky sculpted clumps with a flat highlight shape, never noise. Ponytails, scarves, bellies, bags and ring lights get spring-damper secondary motion.
- **Clothes:** colour blocking plus a canvas pattern atlas (knit, stripes, polka dots, florals, tracksuit stripes, the % logo, plaid) and sewn seams drawn in the texture.

### Faces

- **Atlas.** A canvas face atlas generated at load, mapped onto the front of the head. Hero and rivals each get their own cells; the crowd shares 4 face styles.
- **Seven expressions plus a blink:** neutral, happy, shocked, angry, dizzy (spiral eyes), crying (wail with tears), smug.
- **Elements:** sclera with an ink outline, coloured iris, big pupil with 1–2 highlights, eyelids for blink and smug, thick brows, large mouth shapes with teeth or tongue where needed. Blush, freckles and wrinkles per character.
- **Size test:** an expression must read with the head at 40 px. Eyes take at least 18% of head width each; brows and mouth are bold.
- **Switching** is a UV offset: a uniform for named characters, an instance attribute for the crowd.

### Animation

All procedural, blended with springs.

- **Push-run.** Stride frequency = speed ÷ stride length, so feet never slide. The torso leans with acceleration, hands stay on the handle (2-bone arm solve), and the head looks at hot items, rivals and hazards.
- **Drift:** lean in, one leg kicks out, hair whips.
- **Dash:** 0.1 s crouch, then stretch, then squash on impact.
- **Hit:** squash, head wobble, dizzy face, circling-stars emote.
- **Wipeout:** ejected from the cart in a ballistic tumble with flailing limbs, a bounce and a squash, then the "BONK!" sticker.
- **Moments:** countdown idle with a character fidget; a taunt when overtaking (point and laugh); a victory pose and a defeat pose for each named character at the checkout.
- **Crowd:** walk, browse, rush, dodge-jump, get bowled over, get up, shake a fist, pancake under a hazard and pop back. Each archetype has its own idle.

### Crowd rendering

- **One instanced mesh per archetype.** Each vertex stores its part index; per-instance attributes hold the part angles, phase, squash and expression; the vertex shader rotates each part about its pivot.
- That makes 1–2 draw calls per archetype and about 60–90 shoppers per level.
- **LOD:** beyond about 18 m, swap to the far mesh, whose face is two dots.

### Cast

Heights are standing heights.

| Who | Height | Silhouette key | Look | Victory / defeat |
| --- | --- | --- | --- | --- |
| Penny (hero) | 1.5 m | tall ponytail | pink hoodie `#FF4FA3` with a white % logo, tall pink ponytail with a yellow scrunchie, round sunglasses pushed up, chunky sneakers. Hats from Cart Customs sit on her head | holds the receipt up like a trophy / slumps over the handle |
| Granny Tank | 1.15 m | tiny and round, huge handbag | lilac floral cardigan `#9B5DE5`, curlers in a hairnet, bottle-thick glasses that magnify her eyes, compression stockings | swings the handbag overhead / shakes her fist |
| Sprint Dad | 1.9 m | lanky, long legs | teal tracksuit `#2EC4B6` with stripes, sweatband, big moustache (modelled), whistle on a cord | flexes / grabs his hamstring |
| Coupon Queen | 1.6 m | huge teased hair | orange blazer `#FF9F1C` with shoulder pads, cat-eye glasses, megaphone, fan of coupons | fans coupons / tears an expired one |
| Selfie Star | 1.6 m | top bun, ring light | blue crop jacket `#3A86FF`, giant sunglasses, phone on a stick, ring light on her cart | selfie with flash / covers the lens |
| Big Bubba | 2.0 m | huge belly | lime tank top `#8AC926`, trucker cap, beard, giant soda with a straw; the belly jiggles | belly bump / sips soda sadly |
| Turbo Gramps | 1.3 m seated | scooter, flying scarf | racing goggles, red-and-white racing jacket, long scarf, bushy brows and white moustache; mobility scooter with flame decals and an exhaust | revs and pops a wheelie / the battery dies with a puff |

**Crowd archetypes** (`DESIGN.md` §6) use muted colours (`#B8C0CC`, `#C9BBCF`, `#BFD3C1`, plus muted skin and hair variety), so they never compete with the racers. Each has one accent prop:

- granny with a walker, grandpa with a cane;
- mom with a stroller and a crying baby, toddler on a leash;
- teen glued to a phone, gym bro, jogger;
- belly bro, shop staff (box or ladder), fashionista with bags, gamer with a headset;
- a giant hot-dog mascot, an elder on a mobility scooter.

## 4. The cart

- **Shape.** Bigger than real and chunky:
  - thick frame tubes;
  - basket panels with an embossed grid drawn in the texture (solid, not see-through: no shimmer);
  - a handle with a grip in the owner's colour;
  - a fold-down child seat;
  - four swivel casters that turn with the steering.
- **Feedback:** the bumper glows when the dash is ready; sparks and skid marks while drifting; a smoke puff at the boost; speed lines at top speed. The tower sits in the basket as now.
- **Upgrade tiers** change the model (`DESIGN.md` §8): wheels, basket, bumper, magnet. All 12 tiers must be visible from the gameplay camera.
- **Cosmetics:**
  - paints: Hot Pink (default), Mint Chrome, Gold Rush, Black Friday (black and yellow), Candy Stripe, Galaxy;
  - hats: pompom beanie, propeller cap, receipt crown, foam viking helmet, chef hat, party cone.
- **Rival carts:**
  - Granny: overloaded, with a tartan trolley bag;
  - Sprint Dad: a racing number;
  - Coupon Queen: a coupon binder;
  - Selfie Star: ring light and phone mount;
  - Big Bubba: a flatbed cart;
  - Gramps: his scooter.

## 5. Products and hot items

- **Shapes.** At least 14 base shapes:
  - box, tall box, can, bottle, jug, chip bag, jar, blister pack;
  - fruit, loaf, egg carton, roll pack, ball, shoebox.
- **Variety.** 40+ products from shape × label × colour.
- **Rendering:** one instanced mesh per base shape, with a per-instance label index (a UV cell in the label atlas) and a colour. Draw calls follow the shapes, not the products.
- **Labels:** a canvas atlas of invented brands, drawn bold and simple: big wordmark, stripe, star, simple mascot made of shapes. Starting names:
  - groceries: CRUNCH-O-RAMA, SUGAR STORM, BEAN BOSS, MEGA FIZZ, FIZZ BANG, SPLOOSH, MOOVELOUS, PUFF-A-LUMP, TOMATO TORNADO, NOODLE NOODLE, YO-GOGO, CLOUDROLL, BEAN THERE, CHOMPERS;
  - electronics: ZAPTRONIX, BOOP, BASSBRICK, PIXELPOP, GIGAVISION;
  - fashion and sport: MAISON MAYHEM, ZOOMIES, MEGA-FLEX, GOAL-O-MATIC.
  - If a name turns out to be a real brand, rename it.
- **Readability from above.** Goods are 1.5–2× real size, and top faces carry colour (lids, caps, tops).
- **Hot items** are oversized, have a unique silhouette, a gold halo and beam, and sit behind a ribbon or glass:
  - GIANT CHEESE WHEEL (supermarket)
  - golden cans of the MEGA PYRAMID (warehouse)
  - GIGA TV (electronics)
  - GOLDEN HANDBAG (boutique)
  - CHAMPION TROPHY (sports)
  - TRIPLE-DECKER CAKE (food court)
  - MEGA PLUSH OCTOPUS (arcade)
  - DIAMOND TOASTER (department store)
- **List items** in LIST mode glow teal (`#00D1C1`) with a floating icon.

## 6. Store kits

Every level is a different store, recognisable from one screenshot without UI. The floor fills half the frame, so floor art matters most:

- tiles with grout and slight per-tile colour variation;
- painted graphics: lanes, arrows, rings, sale stickers;
- light pools.

Shelves are short (`DESIGN.md` §4) and always full of labelled goods. Signs and banners use canvas text with puns.

| Store (level) | Palette | Floor | Fixtures and signature props | Light and effects |
| --- | --- | --- | --- | --- |
| Supermarket PRICE PANIC (1) | cream `#FFF6EA`, mint `#8EE3C8`, tomato `#FF5A4E`, sunflower `#FFD23F` | big cream and mint checker, aisle arrows, WET FLOOR decals | white gondolas with red price strips, produce crates, freezer cases with frosted lids, fish counter on ice, deli with striped awning and roller shutter, checkout lanes with belts and scanners, hanging aisle signs | warm key, lilac shadows, freezer mist, sparkle on ice |
| Warehouse CAN-DEMONIUM (2) | concrete `#D9D2C5`, yellow `#FFC800`, steel blue `#3A6EA5`, red `#E63946` | concrete with yellow lane lines and hazard stripes | blue pallet racks, shrink-wrapped stacks, forklifts, stencilled boxes, red roller doors, caged lamps; colourful can pyramids are the pop | cool key, warm light pools, dust motes |
| Electronics GADGET GOBLIN (3) | navy `#1B1F3B`, cyan `#00E5FF`, magenta `#FF4FD8`; barriers `#FF3B4E` and `#3A86FF` | glossy navy with a cyan grid | TV walls playing animated canvas channels, display tables, VR zone in neon tubing, turnstile displays | cool, high contrast, strong bloom on screens and neon |
| Boutique DRESS TO DISTRESS (4) | blush `#FFD6E0`, cream marble, gold `#E9B949` | marble with gold inlays | racks of patterned clothes, glossy faceless mannequins, velvet-curtained fitting rooms, runway with bulbs, shoe-box walls, chandeliers | warm and soft, pink shadows, paparazzi flashes, sparkles |
| Sports GAME ON (5) | turf `#3BB273`, slate `#2B2D42`, pool `#48CAE4`, track `#FF7F11` | slate rubber with zone paint, turf pitch with white lines, orange track | ball cages, dumbbell racks, gym mats, pool with cel water (foam lines, caustic shapes), giant foosball, scoreboard, banners | bright stadium light, splashes, net ripple |
| Food court FOOD FIGHT (6) | terracotta `#E07A5F`, chili `#D62828`, saffron `#F4A261` | terracotta tiles, painted queue lines | stalls with neon menus of invented dishes, sushi conveyor, teppanyaki grills, dessert court, tables, trays, the hot-dog mascot | warm and saturated, steam, flames, soda splashes |
| Arcade NEON NIGHTS (7) | near-black `#0B0B1A` with magenta, cyan and lime neon | dark carpet with a glowing squiggle pattern | cabinet rows with animated screens, bowling lanes with glossy wood and pins, air hockey, claw machines with plush | black light, strongest bloom, neon flicker, ticket streams |
| Department store LAST CALL (8) | marble and brass, each department quoting its source store | marble with department zones | escalators as props, departments quoting levels 1–6, closing shutters with red lights | the grade warms to red as closing time nears |

## 7. UI and effects

- **Keep the current UI language:** receipts, price tags, sale plates, chubby buttons, bold system type. New screens use the same pieces:
  - **Level intro:** the store sign, a mode stamp, and rival portraits on price tags in a "VS" layout. Portraits are rendered live from the 3D characters.
  - **Mall Directory:** an illustrated mall map board with store fronts, medals and a "YOU ARE HERE" star.
  - **Cart Customs:** a catalogue page with price tags around a turntable of the cart and Penny.
  - **Plates:** checkpoint plates and wipeout stickers in the same family.
- **Speech bubbles:** white, 3 px ink outline, a tail to the speaker, bold condensed capitals, a slight tilt, a 120 ms pop-in.
- **Onomatopoeia stickers:** BAM!, BONK!, CRASH!, SPLAT!, ZAP!, WHOOSH!, KA-CHING! Drawn with halftone and a thick outline; they pop at the impact and fade in 0.6 s; at most 3 on screen.
- **Emotes:** anger vein, sweat drop, circling stars, hearts, "!", "?".
- **Physical effects:** spills are real goods arcing out with spin, not particles. Puffs, sparks, confetti made of receipts and coupons, flying price tags "+$45".

## 8. Sound

Everything synthesized in WebAudio, as now.

- **Music.** One funky sale groove re-orchestrated per store:
  - supermarket muzak-funk, warehouse clank percussion, electronics synthwave;
  - boutique disco-house, sports stadium drums, food court surf-rock;
  - arcade chiptune, department store big band.
  - Layers build with Madness; the tempo rises at CLOSING TIME.
- **Object sounds:**
  - sign creak, scissor snip, cleaver "shing", grill sizzle, laser hum and beep;
  - pop-tile boing, conveyor rumble, foosball clack, splash, bowling roll, shutter rattle, chaser rumble.
- **Voices:**
  - gibberish syllables per character, seeded, with their own pitch, formant and speed;
  - the emotion shapes the contour: angry is low and fast, shocked rises, happy bounces;
  - optional mp3 override (`DESIGN.md` §7).
- **Mix.** Separate music and effects volumes. The voice ducks the music by 3 dB.

## 9. Visual acceptance

Checked with `npm run shots` (`QUALITY.md` §3) after every visual deliverable.

1. **Lineup** (`?scene=lineup`). The hero, rivals and every crowd archetype stand in a close-up row. With flat ink fill (`&flat=1`), each one is identifiable by silhouette alone.
2. **Faces** (`?scene=faces`). All seven expressions of every named character read at close-up and at 40 px head size.
3. **Squint test.** Scaled to 320 px wide, a gameplay frame still shows the player's cart, rivals, hazards, hot items and the way forward.
4. **Store identity.** Each `kit:<store>` frame is recognisable without UI, and no two stores share a floor or palette.
5. **Shading.**
   - Hard terminators and tinted shadows; nothing black or grey-brown.
   - Rim light on characters.
   - Ink of even thickness at every distance; no z-fighting, double lines or shimmer.
6. **Density.**
   - No empty floor patch bigger than about 4 × 4 m without a graphic, decal or prop.
   - Every shelf is full of labelled goods.
   - Something is moving in every frame.
7. **Animation.** No foot sliding at any speed, no T-pose or snapping; hands stay on the handle; secondary motion is visible; every state in §3 exists.
8. **Hits.** Every hit shows a face change, an effect and a sound in the same frame. A rival spill reads as a fountain.
9. **Cover test.** The title frame and each level's start frame work as covers without UI.
10. **Performance.** All of this holds within the budgets of `QUALITY.md` §6 on every tier, and LOW still passes points 3, 4 and 9.
