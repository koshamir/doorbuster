# P4 — Game On, Food Fight and the campaign pass

**Dates:** 26–27 November.

**Owner feedback on P3** may be in the message above this prompt. Apply it first.

**Read now:**

- `docs/LEVELS.md` §4, plus levels 5–6 in §5 and §6;
- `docs/DESIGN.md` §2 (LIST and RACE);
- `docs/ART.md` §6 (sports, food court) and §8;
- `NOTES.md`.

## Build, in this order

After each item, run `npm run check` and commit. Capture shots when a level becomes playable and at the end.

1. **LIST and RACE modes** (`DESIGN.md` §2): list shelves and red checkout lamps; checkpoint leads, stars and the RACE receipt lines.
2. **Objects for levels 5–6:**
   - gym cushion walls, punching bags, the pool with splash wipeouts, trampolines;
   - the treadmill with hurdles, giant foosball rows with cones and the GOLAZO bonus;
   - the sushi conveyor loop, delivery-box shortcuts, grill flames, the cleaver row;
   - belly bros, spilled soda, flying tables and chairs, the dancing mascot, the cake tower.
3. **Level 5 GAME ON** with the sports kit and Sprint Dad.
4. **Level 6 FOOD FIGHT** with the food-court kit, Turbo Gramps tuned to the targets in `LEVELS.md` §5, and Big Bubba roaming.
5. **Campaign pass over levels 1–6:**
   - one new idea per store, difficulty rising from 1 to 6;
   - medals from author runs;
   - the recommended next store pulses in the Directory;
   - music for each store (`ART.md` §8);
   - leaderboards: one per level plus a total.

## Done when

- `npm run check` passes for levels 1–6.
- `LEVELS.md` §6 holds for levels 5 and 6, and `ART.md` §9 point 4 holds for every store built so far.
- A clean race in level 6 matches the tuning in `LEVELS.md` §5.
- You have looked at the `level:5`, `level:6` and `release` shots and fixed their worst problems.

Then tag `p4`, update STATUS, and report with three things for the owner to try.

## Where the effort goes

- **Level 5:** each department must feel like a different skill, and the list must make the route a real choice.
- **Level 6:** the race must be won by risk, never by luck.
- **The campaign pass:** look for the weakest of the six levels and make it as good as the best one.
