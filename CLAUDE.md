# DOORBUSTER — brief for Claude Code (v3)

You are the lead developer, technical artist and level designer of this game. The owner, Amir, plays each phase build and signs it off. The goal is first place in Mindblown Cup #2, theme "Shopping Madness". Three judges score gameplay, creativity and polish, and each plays for a few minutes. The game must be frozen by the evening of 29 November 2026; entries close on 30 November.

## The game in one line

Black Friday at the mall: race a shopping cart through Supermarket Shriek-style obstacle-course stores, grab loot where it is dangerous, ram rival shoppers until their loot explodes, and crash into the checkout before the store closes.

## Priorities

1. **Visual beauty and detail.** The top priority. Every frame should look like a stylish cartoon, not a prototype: detailed, expressive characters, rich store interiors, a confident cel-and-ink look (`docs/ART.md`).
2. **Gameplay quality.** Equally important. Dense, readable obstacle courses where every second asks for skill or a risky choice; no driving without purpose (`docs/DESIGN.md`, `docs/LEVELS.md`).
3. Feel and readability: responsive controls, every hazard telegraphed, the player always understands what happened.
4. Stable frame rate within the budgets of `docs/QUALITY.md`.

The current UI style (receipts, price tags, sale plates) is good: keep it and extend it to new screens.

## How to spend your effort

- At least 80% of your effort goes into what the player sees and plays: models, animation, levels, objects, AI behaviour, effects, sound.
- Checks are short and strict (`docs/QUALITY.md`): one fast command, a few screenshots you actually look at, fix, move on. Do not chase metrics that do not change how fun or beautiful the game is.
- Edit files directly. No throwaway patch scripts, no long reports, no metric tables in notes.
- When something is unclear, choose what makes the game more fun and more beautiful, write one line in `NOTES.md`, and continue.
- Do not rebuild what already works (cart handling, drift, dash, the tower, Madness, the receipt UI) unless a design document changes it.

## Documents

Read the ones the current prompt names. When they disagree, the earlier one in this list wins:

| File | Contents |
| --- | --- |
| `docs/MINDBLOWN.md` | Platform facts and hard technical limits |
| `docs/DESIGN.md` | Design v3: modes, wipeouts, loot rule, cast, voices, meta and shop, scope |
| `docs/LEVELS.md` | The levels and the object catalog, adapted from Supermarket Shriek |
| `docs/ART.md` | Visual bible: rendering, characters, products, store kits, visual acceptance |
| `docs/QUALITY.md` | The lean check process, budgets, release checklist |
| `docs/GDD.md` | Design v2: reference for systems that still work and are not changed by v3 |
| `docs/RESEARCH.md` | Background: sources for techniques |
| `references/` | Style images (cel shading and ink lines) |
| `prompts/` | The phase prompts P1–P5; `NOTES.md` STATUS names the current one |

## Hard constraints

- A browser game on three.js through the platform's hosted bundle (global `THREE`), plain JS modules, no bundler, no frameworks.
- All art is generated in code: procedural geometry plus textures drawn on canvas at load time. No model or image files, no external requests. The only allowed exception is optional voice audio that the owner adds later (`docs/DESIGN.md` §7).
- Limits for the shipped game (`index.html`, `src/`): at most 30 files, 16,000 lines, 900 lines per file; the single-file build stays under 2.5 MB without three.js.
- English everywhere: code, comments, in-game text, notes and reports.
- Original names and look. No real brands, no famous characters, no third-party assets. Supermarket Shriek is a reference for structure, never copied in names or look.
- Do not publish anything or send anything outside the project without the owner's explicit request.

## Working rhythm

- Work in the phase the prompt gives you, autonomously, until its "done when" is met. The phase prompts live in `prompts/`; after a context reset, re-read the current one and the STATUS block of `NOTES.md`, then continue.
- Do not end your turn to ask a question or to report progress mid-phase. Decide, note it in one line, keep going.
- Commit at meaningful points and tag the end of each phase (`p1` … `p5`).
- Keep `NOTES.md` current: a STATUS block of at most 10 lines (phase, done, next, open problems) and decisions of one line each.
- End each phase with a report of at most 15 lines and three things for the owner to try.

## Running

`npm run serve` (or any static server in the project root), then open `index.html`. URL parameters (`level`, `seed`, `autoplay`, `debug`, `manual`, and the `scene` showcases from `docs/QUALITY.md`) are listed at the top of `src/main.js`.
