# Quality bar and way of working

The goal is a game the jury remembers after five minutes, with nothing that betrays a rush job. This document says how to tell that a system is done. The numbers are guidelines: if measurements show something else works better, change it and record it in `DEVLOG.md`.

## 1. Instruments: how to check yourself

You do not hold the keyboard, so build your instruments in the first days.

1. **Headless simulation.** Game logic (movement, collisions, pickup, AI, scoring, level data) does not depend on the DOM or WebGL and runs from Node with a fixed time step and a random seed. A script runs hundreds of runs and prints: share of finishers, stuck events, times, receipts, failures on each obstacle for each rival.
2. **Bot player.** The same AI drives the player's cart in three modes: beginner, confident, expert. It is used to set timers and medal thresholds and to catch dead ends.
3. **Screenshots.** A script (Playwright or similar) opens the game with parameters like `?level=2&seed=7&autoplay=1`, captures frames at set moments and catches console errors. Look at the frames yourself and compare them with `ART.md` and the images in `references/`. If the tool cannot be installed, ask the owner for screenshots.
4. **Debug mode `?debug=1`.** Frames per second, frame time, draw calls, triangles, object count. Sliders for the `tune.json` values with a "copy JSON" button. Jump to any level, slow down time, fill the cart.
5. **The owner's playtest** at every milestone gate. It is the only instrument for feel. Ask specific questions.

## 2. Milestones and gates

Dates are guidelines. The game must be frozen by the evening of 29 November: one more day is needed to move it into Mindblown.

| Milestone | Dates | What is done | Gate |
| --- | --- | --- | --- |
| M0 Skeleton | 21–22 Nov | Page in the platform format, fixed-step loop, `tune.json` loading, platform layer with stubs, debug mode, simulation running from Node | No console errors or external requests, the simulation runs |
| M1 Toy | 22 Nov | Empty hall with a few walls and shelves: steering, drift with boost, dash, sliding along walls, camera | Playtest: driving is fun with no goals |
| M2 Core | 23 Nov | Sweeping, floor pickup, the tower and spills, timer, checkout and receipt, restart — on one grey-box level | Full loop "start → checkout → receipt → again"; the beginner bot finishes |
| M3 Style | 24 Nov | The same level in its final look: materials, outlines, palette, cart, shopper, shelf, 8+ goods, floor and walls, lighting, interface | Playtest: "looks like the references"; 60 fps |
| M4 Life | 25–26 Nov | Rivals, crowd, all dash targets, Madness, all three events | Simulation metrics from section 4; playtest: the chaos is fun and fair |
| M5 Content | 27 Nov | Mall kit, levels 1–3 (then 4), icon teaching, medals, saves, leaderboards, mobile controls | A new person finishes level 1 with no explanation |
| M6 Juice | 28 Nov | Sound, music, announcer, effects, interface animation, receipt | 30 seconds of footage look alive even with the sound off |
| M7 Polish and handoff | 29 Nov | Bugs, edge cases, performance, bot-based balancing, handoff package from `MINDBLOWN.md` | The release checklist in section 6 is closed |

At each gate: stop and give a short report (what works, what is rough, the instrument numbers) and playtest questions. Examples:

- **M1.** Five minutes without goals — did it get boring? What annoys you about the controls? On which attempt did you land a drift boost? Can you see where you are going at full speed? Does the cart feel heavy, light or just right?
- **M2.** Did you figure out how to take goods without hints? Can you feel the difference between an empty and a full cart? Does losing goods feel unfair or deserved? Do you want to press "again"?
- **M3.** Can you find your cart within half a second? Which object looks worse than the rest? What on screen gets in the way? Which reference does it look closest to, and what is missing?
- **M4.** What did a rival do that made you laugh or angry? Was there a moment when you were punished unfairly? Do you notice the rivals adjusting to you? How many times did Madness trigger?
- **M5–M6.** Where did you get bored? Where did you not understand what to do? Which moment would you show a friend?

## 3. Signs of a rush job that must not appear

- Default fonts and unstyled buttons; an interface in a different style from the 3D.
- Silence: actions without sound, menus without music.
- A world that does not react: you hit something and nothing moves.
- Jittery camera, sticking on corners, falling through walls.
- No idea what to do in the first five seconds; a wall of text instead of teaching.
- Punishment without warning; losing control for more than a second.
- No pause, no instant restart, no volume setting.
- Breaks on window resize, tab switching or mobile.
- Long loading and a blank screen at start.
- Placeholders, debug labels, lorem ipsum, console errors.

## 4. Criteria per system

**Cart and camera**

- Input responds on the next frame. Behavior is identical at 60 and 144 Hz.
- Slides along walls, does not stick on corners, does not tunnel through thin walls during a dash, never stays stuck for more than half a second.
- At full speed it passes between two obstacles with a gap of two cart widths.
- The difference between an empty and a full cart is felt within three seconds of driving.
- A beginner gets the first drift tier on the second attempt.
- The camera always shows the cart and about two seconds of road, never goes through walls, never jitters.

**Pickup and the tower**

- A beginner sweeps 10 or more goods off the first shelf without hints.
- If the side of the cart looks like it is at the shelf, the item is taken. No visible misses.
- An item flies in an arc in no more than a quarter of a second and lands on the tower instead of vanishing.
- The state of the tower reads at a glance. A single hit costs no more than 40%, and spilled goods can be recovered.
- The "careful expert" bot delivers an overloaded tower; the "sloppy" bot loses a noticeable part of it.

**Dash and collisions**

- A hit counts when the objects visibly touch, with a small margin in the player's favor.
- The response comes in the same frame: hit-stop, sound, effect, the target's reaction.
- A ram aimed at the player is visible in advance and does not repeat while immunity lasts.
- In a pile-up of several carts nobody jitters, flies off or passes through others.

**Madness**

- A beginner reaches ×2 within the first 20 seconds of level one.
- The "confident" bot triggers the mode 1–2 times per run.

**Rivals** — checked by simulation, 200 runs per level

- At least 98% of rivals finish without an emergency "push out". Fewer than one stuck event per 20 runs.
- A rival passes each obstacle with a probability of 80–97% depending on skill. On levels with moving hazards someone's crash is visible in at least every second run.
- A rival's speed is never above the player's maximum.
- Receipts: an average rival scores 60–85% of the expert bot, the best rival 85–105% of the confident bot. The beginner bot places 2nd–4th out of four on level one.
- Rivals ram each other at least once per run. On level one the player is rammed no more than three times.
- After a hit, a rival is back in the race within two seconds.

**Crowd**

- Never blocks the only way through for more than a second. Knocked-down shoppers get up.
- Does not drop the frame rate: the whole crowd is drawn in one or two draw calls.

**Levels**

- The beginner bot never drives into dead ends and finishes with at least 10 seconds to spare on level one and at least 5 on the others.
- The expert bot with no collecting finishes a level in 55–65% of the timer.
- Every hazard is visible at least 0.7 seconds ahead at full speed.
- There is something for the player every 3–5 seconds; no empty stretches longer than 25 meters.
- The checkout is reachable from any point. There are about three times as many goods as fit in the cart.
- Each level has one new element and one screenshot moment.

**Interface**

- From loading to playing: one click and no more than three seconds. Restart: a second and a half. The receipt tally can be sped up.
- Everything reads in an 800×450 window and on a phone. Mobile buttons sit under the thumbs.
- Losing focus pauses the game. Resizing the window breaks nothing.

**Sound**

- Every action has a sound. No clicks and no clipping.
- The music loops seamlessly and speeds up at closing time. Sound starts after the player's first action.

## 5. Budgets

- **Performance.** 60 frames per second at 1080p on a laptop with integrated graphics. Guideline: up to 150 draw calls in a normal frame and up to 250 at peak, up to 300,000 triangles, frame logic within 6 ms. If a frame takes longer than 20 ms for two seconds in a row, quality drops automatically (pixel ratio, shadows, outlines on the environment).
- **Memory.** 20 restarts in a row without memory growth and without garbage collection hitches.
- **Loading.** Everything except three.js stays under 1.5 MB. First frame on a local server within two seconds.
- **Code.** Limits from `CLAUDE.md` and `MINDBLOWN.md`.
- **Browsers.** Chrome, Firefox and Safari on desktop, Chrome on Android, Safari on iPhone.

## 6. Release checklist

- [ ] The criteria in sections 3–5 are met, and the numbers are recorded in `DEVLOG.md`.
- [ ] A new person finishes level one without a single word of explanation.
- [ ] Within five minutes the jury will see: the crush at the start, sweeping, a ram, Madness mode, closing time and the checkout.
- [ ] The console is clean on every level, including failure, pause and restart.
- [ ] The game works offline and makes no external requests.
- [ ] `tune.json` is in the platform format, with no more than 40 values.
- [ ] The handoff package from `MINDBLOWN.md` is built and checked on a clean copy of the project.
- [ ] Cover, square card and icon are made from game frames.
