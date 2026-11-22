# DOORBUSTER — Quality process v3

## 1. Principle

Checks exist to protect the game, not to produce reports.

- **Fun** is judged by the owner's playtests.
- **Beauty** is judged by looking at screenshots.
- **Correctness** is guarded by one fast command.

Everything else is waste: logs of numbers, evidence folders, metric tables, repeated reviews, scripts that patch other scripts.

**Rules:**

- Run `npm run check` after a meaningful set of changes, not after every edit, and always before a commit.
- Run `npm run shots` after each visual deliverable and when a level is playable, about 3–6 times per phase. Look at every image you capture.
- A failing check is fixed before anything else. There are no warnings: a line either passes or fails.
- Do not add checks for things that cannot break. Do not raise the number of runs to make a flaky result pass: fix the cause.

## 2. `npm run check` — at most 90 seconds

One command, four parts. The output is at most 30 lines: failures first, each with the exact reason, then one summary line per part. Exit code 1 on any failure. Parallelize the simulation with worker threads if needed to stay under 90 s.

**1. Static** (a few seconds):

- the shipped game (`index.html`, `src/`) has at most 30 files, 16,000 lines in total and 900 lines per file; every file starts with its header;
- `tune.json` follows the format and limits of `MINDBLOWN.md` §4, and every entry has a default in code;
- no external URL in `src/` except the hosted three.js address in the platform module; no `Math.random` in logic modules; logic modules import in Node without a DOM;
- `dist/index.html` builds and stays under 2.5 MB without three.js.

**2. Level validator**, for every level:

- **Reachability:** every floor tile reaches a checkout.
- **Order:** checkpoints are in route order, and every button or plate is reachable before what it opens.
- **Pass windows:** every WIPE object on the route leaves a pass window of at least 0.6 s for a cart at 70% of top speed, or the route has a safe way around it.
- **Loot rule:** at most 15% of the goods' value lies within sweep reach of the safe line, which is the shortest path that avoids every WIPE zone and dash target.
- **Pace:** no stretch of the author route longer than 15 m without an object, loot or a turn.

**3. Simulation smoke test**, in Node, for every level:

- **Expert bot** × 3 seeds: finishes every time; mean time within ±20% of the level's author time; at most 1 wipeout per run on average.
- **Beginner bot** × 3 seeds: finishes at least 2 of 3 within the timer.
- **Rivals:**
  - never stuck for more than 1 s (stuck = slower than 0.3 m/s while not deliberately waiting at a hazard or in a queue);
  - pass at least 80% of hazards overall;
  - no rival fails the same object in every run.
- **Determinism:** the expert run with seed 1, played twice, gives the same receipt and the same event hash.

**4. Browser smoke test** in Playwright's Chromium:

- each level is loaded with `?level=N&seed=1&autoplay=expert&manual=1` and advanced 5 game seconds;
- **fail** on any console error, failed request or request outside the page's origin;
- **fail** when draw calls or triangles at the busiest moment exceed §6;
- also load `?scene=lineup` once.

## 3. `npm run shots -- <target>` — at most 6 images

- **Output.** Images go to `shots/latest/` and replace the previous ones. JPEG, at most 1280 × 720, quality 85, so they are cheap to look at. One summary line per image: tier, draw calls, triangles. Frames are exact and repeatable (`manual=1`).
- **Showcase scenes** are part of the game build. They are reached only through URL parameters and use an orbit or close-up camera:
  - `?scene=lineup` — the cast;
  - `?scene=faces` — the expression sheet;
  - `?scene=kit&store=<store>` — the store kit;
  - `?scene=cart` — upgrade tiers and cosmetics.

| Target | Images |
| --- | --- |
| `lineup` | cast close-up; crowd row; expression sheet; expressions at gameplay size; flat-ink silhouettes; cart tiers |
| `kit:<store>` | wide establishing view; gameplay camera at the start; shelf and product close-up; hazard close-up; 320 px squint of the gameplay view |
| `level:<n>` | doors open; three key beats from the author run; a wipeout or ram; the receipt |
| `ui` | title; Mall Directory; Cart Customs; level intro; receipt; phone layout |
| `cover` | title frame at 1200 × 675 and 1000 × 1000; level 1 start frame |
| `release` | title; the screenshot moment of levels 1, 3, 4, 5 and 6 (`LEVELS.md` §5) |

**After capturing:**

1. Look at every image against `ART.md` §9 and the references.
2. Write at most 3 lines in `NOTES.md`: the worst problems you see.
3. Fix them, then shoot again.

Two passes per visual deliverable is normal; stop when the next fix would be invisible at gameplay size.

## 4. Reviews and subagents

Only two reviewer subagents in the whole project. A reviewer gets the documents and screenshots, not the code, and returns its top 5 problems ranked by what a judge would notice. Fix the problems you agree with; note in one line why you skip any.

1. **End of P1: art director.** Gets `ART.md`, the references and the `lineup`, `kit:supermarket` and `level:1` shots.
2. **P5: jury.** Gets `DESIGN.md` §9, the release shots and the simulation summary. It judges the first three minutes as one of the three judges would: gameplay, creativity, polish.

Do not delegate implementation: you hold the context, and a subagent would spend its effort rediscovering it.

## 5. `NOTES.md`

At most 150 lines. Prune old content instead of archiving it; git keeps the history.

```markdown
## STATUS (at most 10 lines)
Phase: P2 PLAY (prompts/P2_PLAY.md) — in progress
Done: …
Next: …
Open problems: …

## Owner feedback (verbatim, latest first, last 3 rounds)

## Decisions (one line each)
D63 2026-11-24 Pop-up tiles launch 6 m, not 4: the arc must clear the crate row.

## Known issues (at most 10)
```

## 6. Budgets

| What | Budget |
| --- | --- |
| Frame on the owner's machine (RTX 4060 class) | HIGH holds 60 fps at 1920 × 1080 with headroom: frame time at most 8 ms uncapped |
| Integrated graphics (Iris Xe / Radeon 680M class) | the automatic tier reaches 60 fps |
| Draw calls | at most 200 in a normal frame, 300 at peak, including shadow and post passes |
| Triangles | at most 500,000 in the main pass |
| Frame logic (simulation, AI, animation) | at most 4 ms, shown by `?debug=1` |
| Characters | hero and rivals 4–7k triangles, 2 draw calls each; crowd 2.5k near and 800 far, 1–2 draw calls per archetype |
| Texture atlases | at most 4 of 2048 × 2048, generated in at most 400 ms in total during the title screen |
| Loading | first frame within 2 s on a local server; restart within 1.5 s; 20 restarts in a row without memory growth |
| Build | `dist/index.html` under 2.5 MB without three.js |

## 7. Owner playtests

- Every phase ends with three specific things for the owner to try. For example: "Play level 1 three times. Does the second swinging sign ever feel unfair?"
- The owner's answers arrive in the message that starts the next phase. Copy them verbatim into `NOTES.md` and apply them first.
- Owner feedback beats every number in this file.

## 8. Release checklist (P5)

- [ ] `npm run check` passes, and the `release` shots have been looked at.
- [ ] On a fresh profile, the first three minutes play out as in `DESIGN.md` §9.
- [ ] Levels 1–6 (and 7–8 if built) have medal thresholds from author runs. The author receipt is the best of the expert bot's 5 seeds, written into the level data.
- [ ] The console is clean through wipeout, restart, pause, tab switch, window resize and the phone layout.
- [ ] Works offline from `dist/` with no external requests.
- [ ] Saves load before they save, and a fresh profile starts cleanly. Leaderboards: one per level plus a total, with `lower` consistent from the first submission. The sound button stays in sync with the platform.
- [ ] Every tier is verified: HIGH on the owner's machine; `?quality=low` still looks intentional.
- [ ] Cover, card and icon are made from game frames.
- [ ] The handoff package from `MINDBLOWN.md` §6 is checked on a clean copy.
