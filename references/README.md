# Visual references

The main style document is `docs/ART.md`: it is written to work even without images. This folder exists so Claude Code can also look at the target with its own eyes.

## What to put in this folder

Save 6–10 images from search and from the pages below. Name them by slot, so it is clear what to take from each image:

| File name | What the image shows | What to take from it |
| --- | --- | --- |
| `01_env_market_*.jpg` (2) | a stylized low-poly supermarket | shapes of shelves and goods, floor and wall colors |
| `02_env_mall_*.jpg` | a mall: atrium, escalator, shop windows | layout and large shapes |
| `03_toon_outline_*.jpg` (2) | a scene with cartoon lighting and outlines | outline thickness and color, lighting steps |
| `04_characters_*.jpg` (2) | chubby, simple characters | proportions, simple faces |
| `05_cart.jpg` | a cartoon shopping cart | proportions, thick basket ribs |
| `06_topdown_game.jpg` | a game with a top-down view of a store | readability from a high camera |
| `07_ui.jpg` | a casual game interface | chubby buttons, big numbers |

**How to choose.** An image fits if it has all of these at once:

1. clean, chubby shapes without fine detail;
2. juicy colors, but a light, calm background;
3. objects recognizable from above;
4. an outline or a crisp silhouette;
5. no realism: no photo textures, no real shine.

## Links

**Can be imitated closely — CC0 license**

- Kenney, Mini Market: <https://kenney.nl/assets/mini-market> (mirror: <https://opengameart.org/content/mini-market>). A supermarket kit: 20 objects with animation. A guide to simple geometry and clean color. Download the archive and put its preview image here.
- Kenney, Food Kit: <https://kenney.nl/assets/food-kit>. Two hundred food models: silhouettes for goods.
- Kenney, mini kits with characters: <https://opengameart.org/node/173837>.
- KayKit (Kay Lousberg): <https://www.github.com/KayKit-Game-Assets>, <https://kaylousberg.itch.io/prototype-bits>. Chubby low-poly kits.

The files from these kits do not go into the project: under the project rules all graphics are generated in code. Take shape and color from them.

**Games — mood and readability.** Do not copy characters, names or recognizable objects.

- Supermarket Shriek: <https://store.steampowered.com/app/1086460/Supermarket_Shriek/>. Cel shading, top-down view of stores, chaos that stays readable. The main format reference.
- Moving Out: <https://store.steampowered.com/app/996770/Moving_Out/>. Look at the characters, flat juicy colors and physical comedy.
- Monkey Mart: <https://poki.com/en/g/monkey-mart>. A bright, readable supermarket that works in the browser and on phones.

**Low-poly mall and store scenes** — paid models, for looking only

- <https://toffu.co/products/3d-model-low-poly-shopping-mall>
- <https://www.sketchfab.com/3d-models/low-poly-mall-1aff7aa68a1a40acb4fa70ad46c2eb24>
- <https://www.cgtrader.com/3d-models/exterior/other/cartoon-low-poly-supermarket-mall-building>

**Technique in three.js**

- Toon material: <https://threejs.org/docs/pages/MeshToonMaterial.html>
- Inverted-hull outline — a reference for the method; the addon itself is not available on the platform: <https://threejs.org/docs/pages/OutlineEffect.html>
- Overview of stylized rendering, toon shading and outlines: <https://masterallarts.pages.dev/learn/threejs-from-zero/s4-09-stylized-npr/>
- Lighting steps through `gradientMap`: <https://salivity.github.io/three.js/article/three-js-cel-shading-with-meshtoonmaterial>
- Discussion of a cartoon style with outlines: <https://discourse.threejs.org/t/how-to-create-this-smooth-cartoon-style-with-outlines-in-three-js/60862>

## Image search queries

- stylized low poly supermarket interior 3D render
- isometric cartoon supermarket 3D illustration blender
- low poly shopping mall interior isometric 3D escalator
- cel shaded low poly game outline toon shader
- low poly toon shaded game scene black outlines colorful
- cute chunky low poly cartoon characters 3D game
- low poly cartoon shopping cart 3D model
- top down 3D cartoon supermarket game colorful
