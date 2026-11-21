# Mindblown: platform constraints and project handoff

Sources: <https://mindblown.ai/skill.md> and <https://mindblown.ai/sdk.md>, read on 21 November 2026. Re-read both yourself before starting: they are the primary source and may have changed. If they disagree with this file, they are right.

## 1. Why this matters

The game is built in Claude Code but has to enter the jam as a game built on Mindblown. The owner will hand the project to the Mindblown AI, which must produce practically the same result. So from day one the project is written in the platform's format: files should carry over with almost no edits, not be rewritten.

Whether the organizers accept this route is for the owner to find out. Your job is to make the move trivial.

## 2. How a page works on Mindblown

- A page is a folder with an entry `index.html` and everything it loads.
- The content security policy allows only the page's own origin, `data:` and `blob:`. Every external address is blocked: CDNs, fonts, images. Before publishing, a render check opens the page and rejects it if it depends on a blocked origin.
- three.js is hosted by the platform itself: build r185, `https://mindblown.ai/lib/three-0.185.1/three.min.js`, which creates a global `THREE`. Addons from `examples/jsm` are not included.
- The platform object `window.mindblown` exists only on Mindblown. Locally it is absent, so every call is guarded: `window.mindblown?.run?.start()`.
- The `head` needs one `<meta name="description">`.
- Version limits (2,000 files, 500 MB) do not affect us.
- Cover images: 16:9 at 1200×675, square at 1000×1000, icon at 256×256; PNG, JPEG or WebP.

## 3. Rules for our code

1. **Only the global `THREE`, version r185.** Load it with the same tag as the platform, and keep a copy in `lib/` for offline work. Do not go beyond the three core: write rounded boxes, outlines and post effects yourself, compactly.
2. **Not a single external request.** Fonts: the system stack. Models: built from primitives. Textures: vertex colors, `DataTexture`, canvas. Sound: WebAudio.
3. **No binary files.** If one is truly unavoidable, embed it in code as `data:` and agree on it with the owner.
4. **No bundler.** `index.html` and plain JS files, ES modules from the page's own origin. By the end you also need `dist/index.html` with all the code in a single file: check that the game works that way too.
5. **`tune.json` in the platform format** (section 4). Anything that does not fit in 40 values goes into constants in one config file.
6. **The platform is reached through one adapter module** with local stubs (section 5). The rest of the code knows nothing about Mindblown.
7. **Another AI will read the code.** Aim for 5,000–6,000 lines, never above 8,000; at most 15 files, each up to ~600 lines. Each file starts with a header: purpose, exports, dependencies. Plain names, no magic and no code generation. Levels are data, not code.
8. **Deterministic logic:** fixed time step, own random seed. That way the port can be verified by numbers, not by eye.

## 4. tune.json

The file sits next to the page. The game's creator can tweak these values right on the platform while the game is running.

- An object mapping name → entry. No more than **40 entries**. A name is lowercase, starts with a letter, up to 40 characters. An entry that breaks a rule is silently dropped, so every value has a default in code.
- Entry types:
  - number: `value`, `min`, `max`, optionally `step` and `label`;
  - flag: `value` is `true` or `false`;
  - color: `"kind": "color"` and `#rrggbb`;
  - choice: `options` and a `value` from them;
  - text: `"kind": "text"`, up to 200 characters.
- Reading on the platform: `await mb.tune()` returns `{ name: value }` and never fails. Live edits arrive through `mb.tune.on(fn)`.
- Reading locally: load `tune.json` and take each entry's `value`.

The starting `tune.json` is in the project root. It is yours: change its contents and numbers, but keep the format and the limit.

## 5. What the platform provides and the local substitute

| The game needs | On the platform | Locally |
| --- | --- | --- |
| Know it is on the platform | `const mb = window.mindblown; if (mb && mb.viewer) …` | `mb` is undefined |
| Run start, end and pause | `mb.run.start()`, `mb.run.end({ seconds, level })`, `mb.run.pause()` and `mb.run.resume()` — only as a pair | nothing |
| Settings | `mb.tune()`, `mb.tune.on(fn)` | `tune.json` |
| Leaderboards | `mb.leaderboard.submit(metric, value, { label })`, `.top(metric, { limit })`, `.mine(metric)`. One board per metric: lowercase, up to 40 characters, e.g. one per level plus one overall. By default the higher value wins | `localStorage` |
| Progress | private saves `load`, `save`, `remove`: `load` first, then `save`; save on events such as a finish, not every frame | `localStorage` |
| Player name | `mb.viewer.username`; key data on `mb.viewer.id` | "You" |
| Sound | `mb.sound.on`, `mb.sound.set()`, `mb.sound.onchange(fn)`. The game's own sound button must go through these | own setting |

The game must not implement its own accounts or logins. The shared world (`world.js`) and creations publishing are needed only for the "Receipts of the day" board from the "if time allows" list.

## 6. Handoff package — output of milestone M7

1. **`HANDOFF.md`** — a letter to the Mindblown AI:
   - what the game is, in five lines;
   - a file map: name, line count, purpose, dependencies;
   - the order in which to provide the files, and a request to take them verbatim, without rewriting or restyling;
   - the platform integration points and the list of `tune.json` values;
   - ten checks for "the port succeeded": what must be visible and which numbers must match for a given seed;
   - fallback descriptions of every system in case a file has to be recreated from scratch.
2. **`dist/index.html`** — the whole game in one file.
3. **The final `tune.json`.**
4. **Six reference screenshots** and a 20–30 second recording of gameplay to compare the port against.
5. **Cover, card and icon** made from game frames.

Check the package on a clean copy: unpack it, start a local server, the game works, no external requests.

## 7. Don't

- Do not publish the page on Mindblown or make it public without the owner's explicit request. `skill.md` describes publishing through an API — use it only if the owner decides to.
- Do not report a pause to the platform if the game has none, and do not invent a build id.
- Do not rely on something working locally that the platform does not have: check every new browser feature against section 2.
