# P2 PLAY — obstacle courses, modes, rivals with personality

**Dates:** 24–25 November.

**Goal of this phase.** P1 made the game beautiful. P2 makes it play like the design: dense obstacle courses instead of shelf corridors.

**Owner feedback on P1** may be in the message above this prompt. Apply it first.

**Read now:**

- `docs/DESIGN.md` (all);
- `docs/LEVELS.md` §1–4, plus levels 1–2 in §5 and §6;
- `docs/ART.md` §6 (warehouse) and §7–8;
- `docs/QUALITY.md` §2;
- `NOTES.md`.

## Build, in this order

After each item, run `npm run check` and commit. Capture shots when a level becomes playable and at the end.

1. **Object system** (`LEVELS.md` §4, "How to build them"):
   - generic behaviours placed by level data;
   - every object answers "dangerous at this spot at time t?" and "when is the next safe window here?";
   - every object has its telegraph (look and sound) and its effect class.

   Build the objects levels 1–2 need, with the full P1 look:
   - swinging sign, pop-up tiles, conveyor;
   - floor button with a lit cable and a roller shutter, roller door;
   - hot item behind a ribbon, boost arrows, ramp;
   - can pyramids and the MEGA pyramid, stopwatches;
   - forklift and pallet-jack patrols;
   - hidden plate and secret door;
   - checkpoint arches, checkout lanes with lamps.
2. **Wipeouts, checkpoints and instant restart** (`DESIGN.md` §3).
3. **RUSH and SMASH modes** with their receipt lines and medals (`DESIGN.md` §2). LIST and RACE come with their levels in P4.
4. **Rivals** (`DESIGN.md` §5): Granny Tank, Sprint Dad, Coupon Queen and Big Bubba.
   - Hazard-aware AI that plans with the object queries.
   - Skill-based pass rates, with comic failures.
   - The full spill fountain on a dash ram, the top items on a bump, grudges.
   - Telegraphed rams on the player.
5. **Crowd** (`DESIGN.md` §6): the mix for each store; dodging or getting bowled over; pancakes; STRIKE; at least four absurd moments.
6. **Voices, bubbles and emotions** (`DESIGN.md` §7, `ART.md` §7–8): gibberish voices with the optional mp3 override, bubbles within their limits, faces and emotes driven by events, every line from the table.
7. **Levels 1 PRICE PANIC and 2 CAN-DEMONIUM** (`LEVELS.md` §5):
   - level 1 with the supermarket kit; level 2 with a new warehouse kit (`ART.md` §6);
   - remove the old campaign levels and keep the test course;
   - extend the validator and the smoke simulation (`QUALITY.md` §2) to the new rules;
   - set author times, author receipts and medal thresholds from expert-bot runs.

## Done when

- `npm run check` passes for levels 1 and 2.
- `LEVELS.md` §6 holds for levels 1 and 2, and `ART.md` §9 point 4 holds for the warehouse.
- On a fresh start, the first 30 seconds play out as in `DESIGN.md` §9, from 0:00 to the receipt at 0:30. The meta part of that row comes in P3.
- You have looked at the `level:1`, `level:2` and `kit:warehouse` shots and fixed their worst problems.

Then tag `p2`, update STATUS, and report with three things for the owner to try.

## Where the effort goes

Into how the levels play: the timing of each hazard, where the loot sits, how the rivals fail, how a spill feels. Tune with the bots and by watching the shots, not by adding tooling. When a choice is unclear, pick what makes the first 30 seconds of level 1 more surprising and more fair.
