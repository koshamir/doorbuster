# DOORBUSTER — brief for Claude Code

You are the lead developer and technical director of this game. The owner, Amir, is a solo developer who plays every milestone build and signs it off. The goal is first place in Mindblown Cup #2, theme "Shopping Madness". A jury of three scores gameplay, creativity and polish, and each judge plays for only a few minutes. The game must be finished by the evening of 29 November 2026: one more day goes to moving it into Mindblown, and entries close on 30 November.

## The game in one line

Black Friday at the mall: race a shopping cart, sweep goods off the shelves on the move, build a wobbling tower of loot, shove rivals aside and crash into a checkout before the store closes. The biggest receipt wins.

## What to read and which document wins

| File | Contents |
| --- | --- |
| `docs/GDD.md` | The game: rules, systems, rivals and crowd, levels, scope |
| `docs/QUALITY.md` | Quality bar, milestones with gates, how to check your own work |
| `docs/ART.md` | Visual and audio style, art acceptance |
| `docs/MINDBLOWN.md` | Platform constraints and the handoff format |
| `tune.json` | Starting values in the platform's format |
| `references/` | Style links and images |
| `docs/RESEARCH.md` | Background: Supermarket Shriek teardown and sources for each technique |

When documents conflict, the one higher in this order wins: `MINDBLOWN.md` → `GDD.md` → `QUALITY.md` → `ART.md` → `RESEARCH.md`. If a document stops you from making the game better, tell the owner and propose an alternative. Do not silently carry out something you do not believe in.

## Freedom and responsibility

- The documents define what must come out and how it is accepted. You choose the architecture, algorithms, numbers and order of work. Every number in the GDD and in `tune.json` is a starting value.
- You own the result. "Built to spec but plays flat" is not done.
- Fewer things, polished to a shine: one polished mechanic beats three rough ones. Cut scope using the "must", "should" and "if time allows" lists in the GDD.

## Priorities when you have to choose

1. Responsiveness and the feel of control.
2. Readability: the player always understands what happened and why.
3. A stable 60 frames per second.
4. Juice: sound, effects, the world reacting.
5. Amount of content.

## Hard constraints

- A browser game on three.js r185 through the global `THREE`, plain JS files, no bundler, no frameworks. Reasons and details are in `docs/MINDBLOWN.md`; read it before writing the first line of code.
- No external requests and no binary assets: models, textures, sound and music are generated in code.
- A small, transparent project: aim for 5,000–6,000 lines, never above 8,000; at most 15 files, each up to ~600 lines with a header comment. Another AI will read and reproduce this code.
- English everywhere: code, comments, in-game text, docs, `DEVLOG.md` and your reports to the owner, unless he asks for another language.
- Original name, characters and look. No real brands, no existing characters, no third-party assets. Supermarket Shriek is a reference for the format, not a model to copy.
- Do not publish anything or send anything outside the project without the owner's explicit request.

## How to work

- Follow milestones M0–M7 from `docs/QUALITY.md`. Inside a milestone, work on your own. At each gate, stop and give a short report, the numbers from your checks and 3–5 playtest questions.
- You cannot feel the game with your hands. Make up for it with the instruments from `QUALITY.md`: headless simulation, a bot player, screenshots, debug mode. Where feel decides, ask the owner.
- Commit to git at every milestone. Keep `DEVLOG.md`: decisions, reasons, measurements. It will be needed for the handoff.
- Do not close a milestone until its criteria are met. Found a bug — fix it first, then move on.

## Running

Start a local server in the project root (`npx serve .` or `python -m http.server 8080`) and open `index.html`.
