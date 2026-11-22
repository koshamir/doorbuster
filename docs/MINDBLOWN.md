# Mindblown: platform facts and handoff (v3)

Sources: <https://mindblown.ai/skill.md> and <https://mindblown.ai/sdk.md>, re-read on 23 November 2026. They are the primary source: if they disagree with this file, they are right.

## 1. Why this matters

The game is built in Claude Code but enters the cup as a Mindblown page. The owner uploads the finished files through Mindblown. So the project is written in the platform's format from the start, and the move must need no rewriting.

## 2. How a page works

- **Files.** A page is one entry file plus whatever it loads: scripts, styles, images, audio, models, data. Limits: 500 MB and 2,000 files per version.
- **Security policy.** A published page runs under a content security policy that allows only `'self'`, `data:` and `blob:`. Any external script, import, font or image is refused.
  - Before publishing, a render check loads the page under that exact policy.
  - Locally the game must make no external request either.
- **three.js** is hosted by the platform: `https://mindblown.ai/lib/three-0.185.1/three.min.js`. It is three.js r185 in one file; it sets `window.THREE` and includes the glTF loader and post-processing passes.
  - The documents do not list the class names. At the start of P1, download this exact file to `lib/three.min.js` (it replaces the npm-built copy) and list which addon classes it defines.
  - Use only what is in that file. On Mindblown the page loads the hosted URL; locally it loads `lib/three.min.js`. The game must behave the same with both.
- **Generated assets.** Mindblown can generate images, cutouts, 3D models, rigs, sounds, speech and video, paid from the owner's Mindblown tokens.
  - This project uses none of them, except voice lines the owner may add later as files in `assets/voice/`.
  - Never call the generation API yourself.
- **Run events are optional:** the platform judges a page that never calls them no differently. We still call `run.start()` at GO and `run.end({ seconds, level })` at the receipt, because they cost nothing. `pause()` and `resume()` are used together or not at all.
- **Cover images:** 16:9 at 1200 × 675, square at 1000 × 1000, icon at 256 × 256; PNG, JPEG or WebP, up to 10 MB each.

## 3. Code rules

1. **Global `THREE` only**, from the hosted bundle, including any addons it provides. No npm imports at runtime, no bundler, no frameworks.
2. **No external requests.**
   - Fonts: the system stack.
   - Geometry: procedural.
   - Textures: canvas or `DataTexture`.
   - Sound: WebAudio, plus the optional voice files.
3. **Plain ES modules** in a flat `src/` (the build tool expects flat `./name.js` imports), and `dist/index.html` with everything in one file.
4. **Limits:** at most 30 files, 16,000 lines in total, 900 lines per file. Every file starts with a header: purpose, exports, dependencies.
5. **Levels and the cast are data, not code.**
6. **The platform is reached only through `src/platform.js`**, with local stand-ins (§5). Every call is guarded, because `window.mindblown` exists only on Mindblown.
7. **Deterministic logic:** fixed time step and a seeded random generator in every logic module, so a port can be verified by numbers.

## 4. tune.json

- **Format.** An object mapping a name to an entry; at most 40 entries. A name is lowercase, starts with a letter and has at most 40 characters.
- **Entry kinds:**
  - number: `value`, `min`, `max`, optionally `step` and `label`;
  - flag: `true` or `false`;
  - colour: `"kind": "color"` with `#rrggbb`;
  - choice: `options` and a `value` from them;
  - text: `"kind": "text"`, up to 200 characters.
- **Rules.** Values outside the range are clamped. An entry that breaks a rule is silently left out, so every value needs a default in code.
- **What goes in.** Only the 40 values the owner is most likely to tune live. Everything else is a constant in the config module.
- **Reading.**
  - On the platform: `await mb.tune()`, which never rejects. `mb.tune.on(fn)` fires while the maker tries values live.
  - Locally: read `tune.json` and take each `value`.

## 5. SDK and local stand-ins

| Need | On Mindblown | Locally |
| --- | --- | --- |
| Detect the platform | `const mb = window.mindblown` | `mb` is undefined |
| Player | `mb.viewer.id` (key data on it), `.username` (show it), `.signedIn`, `.onchange(fn)`. Signed out is not "nobody" | "You" |
| Runs | `mb.run.start()`, `mb.run.end({ seconds, level })` | nothing |
| Settings | `mb.tune()`, `mb.tune.on(fn)` | `tune.json` |
| Leaderboards | `mb.leaderboard.submit(metric, value, { lower, label })`, `.top(metric, { limit })` (20 by default, 100 at most), `.mine(metric)` | `localStorage` |
| Saves | `await mb.load(key)` once at start, then `mb.save(key, value)` at checkpoints such as a receipt | `localStorage` |
| Sound | `mb.sound.on`, `.set(bool)`, `.toggle()`, `.onchange(fn)`. The game's own sound button reads and writes it | own setting |

**Leaderboard rules:**

- `metric` is lowercase, starts with a letter and has at most 40 characters; `label` has at most 60.
- `lower` is read on the first submission only, and a later disagreeing one is refused. So decide once: every receipt board is higher-is-better.
- A submission is refused unless the page was opened; a failure rejects the promise, so catch it.
- Boards: one per level plus a total.

**Save rules:**

- Load a key before changing it; otherwise the save is refused with `LOAD_FIRST`.
- On `REVISION_CONFLICT` or `AUTH_CHANGED`, load again.
- Limits: one value up to 2 MiB; a namespace up to 8 MiB and 32 keys; keys of 1–64 letters, digits, `_` or `-`; at most 60 saves a minute.
- Keep everything in one key, `progress`: wallet, medals, best receipts, upgrades, cosmetics, settings.

The game implements no accounts or logins of its own.

## 6. Handoff (end of P5)

Build `handoff/`:

1. `dist/index.html`, the whole game in one file. It loads three.js from the hosted URL on Mindblown and from `lib/` locally.
2. The final `tune.json`.
3. `assets/voice/*.mp3`, if the owner added any.
4. `HANDOFF.md`, at most one page:
   - what the game is, in 5 lines;
   - the file list;
   - the platform calls used and the `tune.json` entries;
   - 6 checks that the upload works (for example: level 1, seed 1, expert bot gives receipt $X; no console errors; saves load before they save; the sound button follows the platform);
   - how to replace or add voice files.
5. Cover, card and icon made from game frames.

**Check the package on a clean copy:** unpack it into an empty folder and serve it; the game runs, the reference receipt matches, and there is no external request.

## 7. Don't

- Do not publish, upload or make anything public on Mindblown, and do not call any Mindblown API with the owner's account, without the owner's explicit request.
- Do not rely on anything the hosted bundle or the security policy does not provide.
- Do not invent build ids, and do not report a pause without a resume.
