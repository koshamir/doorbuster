# DOORBUSTER — Levels and objects v3

Written 23 November 2026. Together with `DESIGN.md`, this file overrides `GDD.md` sections 4 and 6. Source: a level-by-level analysis of Supermarket Shriek's 38 stages. We take its level structure, its objects and its level design principles. We do not take its controls, its camera or its scream mechanics.

## 1. Which Shriek levels we take, and why

| # | Our level | Store | Mode | From Shriek | Why it made the cut |
| --- | --- | --- | --- | --- | --- |
| 1 | PRICE PANIC | Supermarket | RUSH | 0-1 General Store, 1-1 The Fish Bucket | Three basic kinds of threat in 30 s (periodic, triggered, geometric) plus a button that opens the way: the ideal first level for a judge |
| 2 | CAN-DEMONIUM | Canned-goods warehouse | SMASH | 1-3 Beanland | The only Shriek mode where hitting things is the goal, and that is exactly our dash and tower |
| 3 | GADGET GOBLIN | Electronics | RUSH | 2-4 Why So Siri; the rotating laser of Lazer Tag | Shriek's best idea, one input with two meanings, mapped onto our existing dash |
| 4 | DRESS TO DISTRESS | Clothing boutique | RUSH with a chase | 3-2 Doctor & Jones; the rolling ball of 3-5 | Short and dense, every trap a gag, and a chase finale: the most cinematic level |
| 5 | GAME ON | Sports megastore | LIST | 5-2 Sports Sports Sports; 2-3 Work-It-Out | Each department tests a different skill; giant foosball is a set piece; the list makes the route a choice |
| 6 | FOOD FIGHT | Food court | RACE | 2-2 Skid Marks; 3-4 Y So Sushi | A fair race with an accumulating lead and shortcuts, in the most colourful place in a mall |
| 7 (should) | NEON NIGHTS | Arcade and bowling | SMASH | 1-4 360 Arcade; 5-3 Blade Outrunner; Lazer Tag | Neon, jackpots, physics projectiles, a laser-wall chase |
| 8 (should) | LAST CALL | Department store | LIST with a boss | 4-5 P&S; 3-5 Healthy Boys; Colosseum | A finale that quotes every store, like every Shriek street finale |

**Left out, and why:**

- **Rails** (1-1 rails, 4-2): they take away steering and only make sense with the scream.
- **Heat and freezers** (4-3, 5-1, 5-5, The Anvil): they add a second meter and make levels long.
- **Long endurance finales** (Colosseum at about 4 min, 5-5 at 2:45): judges play for minutes.
- **Waiting levels** (2-1 pallets over a fire pit; turnstiles that stop when hit, in 1-4 and 1-5): reviews call the waiting dull.
- **Narrow paths over a void** (5-4): precision without any of our mechanics.
- **The train race in 4-4:** the rival teleports to the player at each checkpoint, which players call unfair.
- **Meat grinders** (3-3): wrong tone.
- **Fan Fair:** too thin on its own.
- **Secret levels:** no time.

**Shriek principles we keep:**

- one new element per store, then a finale that combines them;
- a mode changes the goal, never the controls;
- the store's theme sets its vocabulary of hazards;
- every threat is telegraphed;
- layers of mastery: medals plus a hidden author target;
- a fair rival.

**Shriek problems we fix:**

- checkpoints and instant restart instead of a full restart after a loading screen;
- no invisible traps, and every button shows what it controls;
- no forced waiting on the fastest line;
- no progress gates.

## 2. Rules for every level

1. **Short and dense.** 25–65 s for the author run (the finale up to 85 s). On the expert line, something happens every 2–3 s. No stretch longer than 15 m without content.
2. **Teach, raise the stakes, combine, finish.** A level's new object first appears alone in a safe spot, then with a consequence, then combined with something familiar, then comes the run to the checkout.
3. **The loot rule** (`DESIGN.md` §4): at most 15% of the goods' value on the safe line.
4. **Telegraph everything.** Every dangerous moment can be predicted at least 1 s ahead from cart height: shadow, light, sound, wind-up or a visible cycle.
5. **Skill beats waiting.** The fastest line never forces a wait longer than 1.5 s; speed, a drift or a dash can beat a cycle that a careful driver waits out.
6. **One screenshot moment per level**, and one store look per level (`ART.md` §6).
7. **Rivals use every object** and occasionally fail at one, visibly and comically.

## 3. Modes

The modes and their scoring are defined in `DESIGN.md` §2. Each level declares one.

## 4. Object catalog

**Effects:**

- **WIPE:** a wipeout (`DESIGN.md` §3).
- **PUSH:** knock-back; the top 1–2 items fall off; no wipeout. Being pushed into a pit still counts as WIPE.
- **MOVE:** changes motion.
- **SWITCH:** changes the level.
- **TARGET / PICKUP:** gives something.

All values are starting values.

**Hazards (WIPE)**

| Object | Rule | Telegraph | Start values | Levels | Shriek original |
| --- | --- | --- | --- | --- | --- |
| Swinging sale sign | a giant price tag on a chain swings across the lane | its shadow sweeps the floor; it creaks at each end of the swing | 3 m wide, ±60°, period 2.4–3.2 s | 1, 2, 8 | swinging axe |
| Giant scissors | pairs on both sides of a lane snap shut across it | the blades open wide and glint 0.5 s before closing | 4 m span, cycle 2.2 s, closed for 0.4 s | 4, 8 | giant knives, blades |
| Cleaver row | 4–6 cleavers on a gantry chop down in a wave | shadows, a "shing" before each chop | chops 0.25 s apart, cycle 2.6 s | 6, 8 | giant knives |
| Grill flames | teppanyaki strips burst into flame | heat shimmer and a sizzle 0.6 s before | 1.0 s on, 1.5 s off | 6 | fire pits, hot plates |
| Pit | stockroom hatch, clearance bin, pool: falling in is a wipeout unless airborne | striped edges, visible water | — | 3, 4, 5 | pits, water |
| Sliding floor panels | panels slide open over a pit in sequence | each panel flashes 0.7 s before it opens | open 1.5 s out of every 3.5 s | 3 | sliding tiles, collapsing floor |
| Laser gate | anti-theft gate posts with a laser curtain that switches on and off | the posts blink 0.6 s before switching on, with an alarm "beep" | 1.5 s on, 1.5 s off | 3, 7 | lasers |
| Laser turret | a rotating beam | the beam's line glows on the floor | 7 m beam, one turn every 4 s | 3, 7 | rotating turret (Lazer Tag) |
| Bowling lane | balls roll across the aisle | the ball is visible from the far end, pins rattle | one ball every 1.8 s | 7 | bowling balls, rolling boulder |
| Chaser | a giant yarn ball, a closing laser wall or closing shutters follow the route behind the player | rumble, screen shake, an arrow | speed about 0.9 × empty-cart top speed | 4, 7, 8 | rolling boulder, closing laser barrier |

**Pushers (PUSH)**

| Object | Rule | Telegraph | Start values | Levels | Shriek original |
| --- | --- | --- | --- | --- | --- |
| Pop-up promo tile | floor tiles pop up in a pattern and launch the cart in an arc | the tile flashes red 0.6 s before | 2 × 2 m, cycle 2.0 s | 1, 7 | spring tiles |
| Boxing glove | a red pressure plate fires a glove out of the wall | the plate is red; the glove pulls back before punching | fires 0.3 s after the plate, 3 m reach | 4, 5 | boxing gloves |
| Gym cushion wall | wall pads fire in a series | each pad bulges before firing | 3 pads 0.4 s apart, a series every 2.5 s | 5 | pop-out cushions |
| Turnstile display | a three-armed rotating display stand that never stops | constant rotation, arm shadows | 2.5 m radius, 0.35 turns per second | 3, 7 | rotating barriers, without the stopping |
| Giant foosball row | 3–4 giant players slide on a rail and sometimes kick | a 0.5 s wind-up before each kick | period 2–3 s, 3–4 m of travel | 5 | giant foosball |
| Air-hockey puck | a giant puck bounces around a table zone | always visible | 1.5 m across, 7 m/s | 7 | air-hockey pucks |
| Robot vacuum | patrols a loop. A dash makes it spin and spit out goods | blue light, whirr | 2 m/s | 3 | vacuum robots |
| Belly bro | waddles across lanes and bounces carts back. A dash makes him spin and drop food | always visible | — | 6 | sumo wrestlers |
| Forklift / pallet jack | patrols a lane | beeping, flashing light | 3 m/s | 2 | floor scrubbers |

**Movement (MOVE)**

| Object | Rule | Telegraph | Start values | Levels | Shriek original |
| --- | --- | --- | --- | --- | --- |
| Boost arrows | a burst of speed | chevrons | +6 m/s for 0.8 s | all | boost arrows |
| Conveyor | carries carts and goods | moving arrows | 4 m/s | 1, 2, 6 | conveyors |
| Treadmill | runs against you; a dash gets you across | the belt texture runs | −5 m/s | 5 | treadmill |
| Turntable | a rotating floor disc that carries what is on it | visible rotation | 6–8 m across, 0.25 turns per second | 3, 7 | rotating floor |
| Trampoline | launches the cart in an arc over a pit or obstacle | bright mat | 8–10 m of airtime | 4, 5 | springboards |
| Ramp | a jump over a wall or a gap | arrows | — | 2, 3 | ramps |
| Surfaces | carpet slows (−35%); wet floor or spilled soda takes away grip for 1 s | colour and texture, a yellow sign | — | 6, 7 | carpet, spilled jam |
| Light props | mannequins, tables, chairs, boxes fly when hit and cost about 10% speed | — | — | 4, 6, all | mannequins, wine bottles |

**Switches (SWITCH)**

| Object | Rule | Telegraph | Levels | Shriek original |
| --- | --- | --- | --- | --- |
| Floor button | a big "PRESS FOR SERVICE" bell plate. It opens shutters and doors, switches hazards off or reverses conveyors. Rivals press them too | a lit cable on the floor runs from the button to what it controls | 1, 2, 6 | floor buttons, with the "you can't tell what it does" complaint fixed |
| Hidden plate | turns green and opens a secret door | subtle | 2 | the red plate in Beanland |
| Smart barriers (red/blue) | every dash by the player flips which colour is solid. A barrier that rises under a cart pushes it out | posts and floor stripes show the solid colour; barriers pulse when your dash is ready | 3, 8 | sound-reactive barriers |
| Pressure plate | triggers a glove or starts a chase | red square | 4, 5 | pressure plates |

**Targets and pickups**

| Object | Rule | Levels | Shriek original |
| --- | --- | --- | --- |
| Can pyramid | a dash or a hit above 8 m/s smashes it completely; a slow hit topples part of it. Money per can, and about 30% of the cans become goods | 2, others as decoration | bean pyramids |
| Stopwatch | +5 s | 2, 7 | stopwatches |
| Hot item | behind a ribbon or glass; dash through to take it | every level | — |
| List shelf | ram it and the list item drops into the cart | 5, 8 | shopping-list shelves |
| Jackpot machine | ram a claw or slot machine 3 times for a burst of goods | 7 | arcade machine jackpot |
| Checkout lane | the finish; a green lamp means open, red means closed or locked | all | checkout |

**How to build them.** Use a few generic behaviours (pendulum, oscillator, rotator, timed on/off, trigger → action, path chaser, patrol, spawner, surface zone, pit, linked switch) that level data places with parameters. Every object answers two questions: "is this point dangerous at time t?" and "when is the next safe window here?". The AI and the level validator both rely on them.

## 5. Levels

### Level 1 — PRICE PANIC · supermarket · RUSH

**From** 0-1 General Store (swinging axe, spring tiles, a narrow pass, the first checkout) and 1-1 The Fish Bucket (a conveyor leading to a floor button that opens the way; swinging axes beside the new elements).

- **Author run** about 30 s. **Timer** 60 s.
- **Rivals:** Granny Tank and Sprint Dad. Granny starts first in the queue at the doors ("I've queued since 1987!"), ahead of the player, so the player catches her in freezer alley. On level 1 her first pass over the tile field always fails, so every judge sees the launch from `DESIGN.md` §9.
- **Crowd:** about 12 — grannies, a mom with a stroller, staff stocking shelves.
- **New for the player:** steering, sweeping, timing a periodic hazard, a triggered hazard, a button that opens the way, the dash (ribbon and ram).

**Beats**

1. **Doors open (0–4 s).** The crowd rushes in. A trail of cheap snacks runs straight under the first swinging sale sign (period 3.0 s, the slowest in the game). The safe line beside it has no loot.
2. **Produce hall (4–10 s).** A field of pop-up tiles (3 × 4) flashing in a wave, ringed by produce crates (short shelves). The fast line threads between pops; the safe zigzag around the field costs about 2 s. Checkpoint 1.
3. **Fish counter (10–18 s).** A conveyor along the counter carries the cart sideways to a bell button. The button raises the deli shutter, and its lit cable shows that. Fish and ice packs ride the conveyor. Next to the shutter, the giant cheese wheel (hot item) sits behind a ribbon: dash through it as you pass.
4. **Freezer alley (18–26 s).** A narrow passage between freezers with two swinging signs out of phase, and freezer shelves on both sides. Granny Tank is in here, slow and heavy: ram her and her loot explodes. Checkpoint 2.
5. **Checkouts (26–30 s).** One lane's belt boosts you in; the other lanes are closed.

**Screenshot:** threading two swinging price tags while Granny's loot explodes behind you.

### Level 2 — CAN-DEMONIUM · canned-goods warehouse · SMASH

**From** 1-3 Beanland: a boost straight into the first pyramid, sections opened by floor buttons, a swinging axe, stopwatches, a hidden last pyramid behind a red plate, a ramp over the wall to the exit. The inverted challenge of finishing without touching a can is kept as a badge.

- **Clock** starts at 30 s. 4 visible stopwatches plus 1 hidden (+5 s each).
- **Pyramids:** 16 plus the MEGA PYRAMID.
- **Rivals:**
  - Coupon Queen smashes pyramids too and steals your cans unless you ram her first; she shouts where the next pyramid is.
  - Big Bubba bulldozes through pyramids and shoves you aside unless you dash.
- **Moving obstacles:** forklifts and pallet jacks on patrol.
- **New for the player:** smashing as the goal, the clock as a resource, buttons that open sections.

**Beats**

1. **Start.** Boost arrows aim straight into pyramid 1: "BAM!" within a second of GO.
2. **Loop A.** A ring of pyramids around pallet racks. Floor button A opens the roller door to section B. A swinging sign guards a stopwatch.
3. **Section B.** A conveyor carries moving pyramids, so you time the smash. A forklift patrols the lane, and a stopwatch sits on a ramp. Checkpoint.
4. **Section C.** Tight racks with pyramids on the corners, perfect for drift-and-dash combos. Coupon Queen races you to the same pyramids.
5. **Exit.** The checkout gate is visible. A plate just before it turns green and opens a hidden door back behind the swinging sign. Behind it waits the MEGA PYRAMID of golden cans (big money and confetti), then a ramp over the wall to the checkout.
6. **Badge:** CLEAN SWEEP for checking out without touching a single can.

**Screenshot:** the boost straight into the first pyramid, and the MEGA PYRAMID exploding.

### Level 3 — GADGET GOBLIN · electronics · RUSH

**From** 2-4 Why So Siri: objects that react to the player's input, three-armed rotating barriers, boost arrows, sliding floor tiles. Plus the rotating laser turret of Lazer Tag.

- **The signature:** the store is "smart" and hears every BOOM. Each dash flips the red and blue barriers. The dash keeps its usual meaning, so there are no new controls, only a second meaning.
- **Author run** about 38 s. **Timer** 70 s.
- **Rivals:** Selfie Star and Sprint Dad. Rival dashes do not flip barriers: only the player's do.
- **Crowd:** gamers, teens on phones, staff with tablets, robot vacuums.

**Beats**

1. **Lesson.** A red barrier blocks the corridor. Dash: red drops, blue rises to one side. Safe and slow.
2. **Showroom.** Turnstile displays with TVs on their arms, and boost arrows. Phones and headphones lie on the arms' path. Checkpoint 1.
3. **Stockroom grid.** Sliding floor panels over the stockroom pit open in sequence. Robot vacuums patrol the edges, and laptop tables with goods sit at the panel edges.
4. **Combination.** Flip the barriers while crossing panels. The dash is also the speed burst that clears a closing gap. Checkpoint 2.
5. **VR demo zone.** A laser turret sweeps the middle. The GIGA TV (hot item) waits behind glass next to it. Breaking the glass with a dash also flips the barriers, so you plan which ones you will need next.
6. **Checkouts.** Two lanes, behind red and blue barriers: flip at the right moment.

**Fallback:** if playtests show the flipping confuses people, the barriers also flip on a 3 s timer, and a dash flips them early.

**Screenshot:** a drift through a spinning turnstile of TVs while the barriers flip.

### Level 4 — DRESS TO DISTRESS · clothing boutique · RUSH with a chase

**From** 3-2 Doctor & Jones: boxing gloves fired from pressure plates, mannequins, wooden bridges, blades, and a boulder that chases you to the checkout. The 4★ run is only 25 s, which shows how dense it is.

- **Author run** about 35 s. **Timer** 70 s.
- **Rival:** Granny Tank, who gets chased by the ball too and screams about it.
- **Crowd:** fashionistas with bags; mannequins as props.

**Beats**

1. **Fitting-room aisle.** Red pressure plates fire boxing gloves out of the fitting-room walls 0.3 s after you roll over them. Zigzag between the plates, or time them.
2. **Mannequin gauntlet.** Knock mannequins flying (each costs a little speed; some drop scarves and bags as goods). Clothes racks serve as short shelves. Checkpoint 1.
3. **Runway.** Narrow catwalk bridges (2.5 m wide) over clearance-bin pits, with runway lights and flashing photographer standees. Giant scissors snap across the runway at two points. Checkpoint 2.
4. **The treasure.** The GOLDEN HANDBAG stands on a pedestal behind a rope at the end of the runway. Taking it releases the GIANT YARN BALL ("RUN!"), which chases you through the shoe department (smash or dodge stacks of shoe boxes) to the checkout.
   - The ball's speed roughly matches a fully loaded cart's top speed, so greed makes the escape hard.
   - Caught means a wipeout: you respawn at checkpoint 2 and the handbag is back on its pedestal.

**Screenshot:** a giant pink yarn ball rolling over mannequins while the cart flees.

### Level 5 — GAME ON · sports megastore · LIST

**From** 5-2 Sports Sports Sports: each department a different skill, cones that show the way behind the giant foosball defence. And from 2-3 Work-It-Out: pop-out cushions fired in series, a pool, punching bags.

- **List:** BASKETBALL, DUMBBELL, SWIM RING, GOALIE GLOVES. Ram the rack that holds each one.
- **Layout:** a central hub (start and checkouts) with four department wings, visited in any order. Checkout lamps turn green when the list is complete. Each wing's entrance is a checkpoint.
- **Author run** about 65 s. **Timer** 120 s.
- **Rival:** Sprint Dad, on his own list, taunting you.
- **Crowd:** gym bros, joggers.

**Departments**

1. **Gym.** Cushion walls fire in series: time the first three; for the fourth, tuck into an alcove and go. Punching bags swing as soft obstacles. The DUMBBELL rack is at the end.
2. **Pool.** A narrow poolside path with floating rings. A trampoline launches you over the pool to the island with the SWIM RING, and a second trampoline launches you on to the pitch. Falling in is a splash wipeout.
3. **Track.** A treadmill runs against you, with low hurdles that slow you when knocked; dash to get across. The BASKETBALL cage is at the far end.
4. **Pitch.** GIANT FOOSBALL: four rows of giant players slide on rails. Cones on the floor mark the way around behind the defence, worth a "GOLAZO!" bonus. The GOALIE GLOVES hang in the goal net.

**Screenshot:** slipping behind the giant foosball defence.

### Level 6 — FOOD FIGHT · food court · RACE against Turbo Gramps

**From** 2-2 Skid Marks: a race through three checkpoints where the lead accumulates, a rival who presses buttons on the track, and a shortcut through a stack of boxes. And from 3-4 Y So Sushi: conveyor belts as both transport and obstacle, a row of chopping knives, a fire pit, big bodies blocking the way.

- **Author run** about 48 s. **Timer** 90 s.
- **Turbo Gramps** (racing mobility scooter) takes the long safe line and presses bell buttons that open shutters for himself and close others. He never rubber-bands. The player wins with risky shortcuts.
- **Ramming him** spins him around and spills his prune juice and dentures as goods.
- **Big Bubba** does not race. He roams grill alley eating: a heavy moving blocker, and a food fountain when you dash into him.
- **Crowd:** belly bros, families with trays, a dancing hot-dog mascot.

**Sections**

1. **Sushi bar → checkpoint 1.** A sushi conveyor loop to ride for speed; the plates are goods. A stack of delivery boxes is a dash shortcut.
2. **Grill alley → checkpoint 2.** Grill flames burst in a pattern, and a cleaver row chops across the alley in a wave. Belly bros waddle across the lanes.
3. **Dessert court → checkpoint 3.** Spilled soda, flying tables and chairs, the dancing mascot, a cake tower to smash for goods.
4. **Finish.** The food-court exit to the checkout.

**Tuning:** Turbo Gramps reaches the checkpoints at about 14, 30 and 44 s and finishes at about 55 s.

- A clean run on the safe line loses by about 2 s.
- Each shortcut saves 2–4 s, so a clean run with two shortcuts wins.
- The author run (every shortcut, a ram on Gramps) wins by about 7 s.

**Screenshot:** neck and neck with Turbo Gramps as the cleavers chop between you.

### Level 7 (should) — NEON NIGHTS · arcade and bowling · SMASH

**From** 1-4 360 Arcade: carpet against tile, rotating barriers, a rotating floor, air-hockey pucks, machines that pay out when rammed. From 5-3 Blade Outrunner: neon, bowling balls, a laser wall that closes in at the end. From Lazer Tag: the rotating laser.

**Contents:**

- slow carpet lanes against fast neon tile;
- a turntable dance floor and turnstile displays;
- an air-hockey table with giant pucks;
- bowling lanes with balls rolling across;
- claw and slot machines that pay a jackpot when rammed three times;
- a laser turret and stopwatches;
- **finale:** a closing laser wall chases you to the exit.

**Screenshot:** a jackpot exploding under black light.

### Level 8 (should) — LAST CALL · department store · LIST with a boss

**From** 4-5 P&S: each department quotes a level of the street. From 3-5 Healthy Boys: the finale gathers the street's threats. From the Colosseum: a best-of run.

- **List of four,** one item per department. The departments quote the earlier levels: swinging signs, smart barriers, scissors, cleavers, foosball.
- **Boss:** Granny Tank on an electric pallet cart races you to the same list items. If she grabs one first, ram her to knock it loose.
- **Also racing for the list:** Coupon Queen and Big Bubba.
- **Finale:** CLOSING SHUTTERS chase you to the last open checkout.
- **Author run** about 85 s, with 4 checkpoints.

**Screenshot:** the last open checkout, Granny Tank and shutters closing behind you.

## 6. Acceptance for every level

- It is recognisable from one screenshot, and its store look differs from every other level.
- Its new objects are taught safely before they can hurt.
- At least 85% of the goods' value lies off the safe line.
- **Bots:**
  - the expert bot finishes near the author time with at most one wipeout on average;
  - the beginner bot finishes at least 2 of 3 seeds within the timer;
  - each rival passes each object at its skill rate.
- On the expert run something happens every 2–3 s, and the fastest line never forces a wait longer than 1.5 s.
- The level validator passes: every floor tile reaches a checkout; checkpoints are in route order; every button is reachable before what it opens; every hazard leaves a pass window the bots can use.
