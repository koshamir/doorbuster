# DOORBUSTER — Design v3

Written 23 November 2026. This file and `LEVELS.md` override `GDD.md` (v2) wherever they differ. GDD v2 stays the reference for systems that already work and are not changed here.

## 1. What changes and what stays

**Stays** (it works: refine, don't rebuild): cart handling (steer, drift with a three-tier boost, dash), sweeping shelves and picking up goods from the floor, the tower and spills, Madness, the receipt and the UI style, DOORS OPEN at the start and CLOSING TIME at the end, the platform layer.

**Changes**

- Levels: long shelf corridors become short, dense obstacle-course stores built from Supermarket Shriek's stages (`LEVELS.md`).
- Four modes instead of one (§2).
- Hazards with teeth: wipeouts and checkpoints (§3).
- Loot lies only where taking it costs risk (§4).
- A bigger, absurd cast with hazard-aware AI, voice lines and emotions. A rammed rival spills everything (§5–7).
- Meta: the Mall Directory and the Cart Customs upgrade shop (§8).
- Every level is a different store with its own look (`ART.md` §6).

**Removed:** the FLASH SALE event, the shopping list outside LIST mode, the loyalty-card level select (replaced by the Mall Directory), long routes.

## 2. Modes, scoring and medals

| Mode | Goal | Receipt lines | Failure |
| --- | --- | --- | --- |
| RUSH | reach an open checkout as fast as possible | ITEMS, STUNTS, TIME ($40 per second left) | the clock reaches zero |
| SMASH | smash displays for money, grab stopwatches (+5 s), check out before the clock runs out | ITEMS, SMASH (money per can or prize, times the Madness multiplier), STUNTS, TIME | the clock reaches zero |
| LIST | ram the shelves that hold the 4 list items (the item drops into the cart), then check out. Checkout lamps stay red until the list is complete | ITEMS, LIST, STUNTS, TIME | the clock reaches zero |
| RACE | beat one named rival through 3 checkpoints to the checkout. The lead accumulates; nobody teleports | ITEMS, RACE ($500 per checkpoint reached first, $1,000 for finishing first), STUNTS, TIME | the clock reaches zero |

- **Medals** as in v2: bronze for any checkout, silver and gold at receipt thresholds set from the author run (about 70% and 90% of it), and the hidden Black Card for beating the author receipt. RACE also shows a star for each checkpoint led.
- All dollar values are starting values; tune them so that time matters in RUSH, smashing in SMASH, the list in LIST and winning in RACE.

## 3. Wipeouts, checkpoints and restart

- **Two kinds of contact.** Walls, shelves, props and the crowd stay forgiving, as now. Objects marked WIPE in `LEVELS.md` cause a wipeout.
- **Wipeout:**
  - the hero flies out of the cart in a comic tumble (a "BONK!" sticker);
  - the top 25% of the tower scatters on the spot, and anyone can pick it up for 4 s;
  - 1.0–1.2 s later the cart respawns at the last checkpoint, facing along the route, at half speed, with the rest of the tower;
  - the clock keeps running.
- **Checkpoints:** inflatable SALE arches every 12–18 s of driving. Passing one gives a chime and a small plate.
- **Restart:** R restarts the level instantly with a 1.5 s countdown. No loading screens anywhere.
- **Rivals** follow the same rules.

## 4. Loot and greed

- **No free loot.** The safe line through a level carries at most 15% of the goods' value. The rest lies:
  - on risk lines: under a pendulum's arc, between pop-up tiles, on a conveyor beside choppers;
  - on short shelves inside hazard zones;
  - behind dash targets;
  - in rivals' carts.
- **Shelves are short** (at most 10 m), and each one is a decision next to a hazard. There are no long safe aisles.
- **Weight is the price of greed.** A heavy cart is slower through hazard windows and chases.
- **Hot items:** one or two per level, always in a risky spot.
- **Pace:** on the expert line, something asks for skill or a decision every 2–3 seconds.

## 5. Rivals

Rivals push carts, collect goods and obey the same physics, objects and checkpoints as the player.

| Rival | Look | Behaviour | Levels |
| --- | --- | --- | --- |
| Granny Tank | tiny and round, curlers, huge handbag, thick glasses | slow, heavy, stubborn, blocks lanes; starts with a mountain of goods, so ramming her is a jackpot | 1, 4, boss of 8 |
| Sprint Dad | lanky, tracksuit, sweatband, moustache, whistle | fastest, perfect lines, takes revenge for rams | 1, 3, 5 |
| Coupon Queen | teased hair, cat-eye glasses, megaphone, coupon fan | races you to hot items and pyramids, shouts about them (a hint for the player) | 2, 8 |
| Selfie Star | top bun, sunglasses, ring light on her cart | stops dead to pose (her phone flashes a second earlier), draws a crowd | 3 |
| Big Bubba | huge belly, tank top, trucker cap, beard, giant soda | very heavy, shoves everyone aside, wins every bump unless you dash | 2, 6, 8 |
| Turbo Gramps | goggles, scarf flying, racing mobility scooter with flames | the RACE rival: takes the long safe line, presses floor buttons, rarely makes a mistake, never takes a shortcut | 6 |

- **Hazard AI.** Every object can say whether a spot is dangerous at time t and when the next safe window comes. Rivals plan with it:
  - wait at pendulums and time pop-up tiles;
  - avoid pits, use trampolines and conveyors;
  - flee chasers.
- **Skill.** It sets how precisely they do this: each rival passes each object with an 80–97% chance. A failure is a visible, comic wipeout.
- **Pacing** stays as in v2: invisible, and never faster than the player's top speed.
- **Rivals are piñatas.**
  - A DASH ram makes a rival drop everything in a fountain of goods. The goods land in a ring 2–5 m around it, and anyone can pick them up for 4 s.
  - A plain bump at speed knocks off the top 1–2 items.
  - The rammed rival spins, yells and holds a grudge for 5 s.
- **Rivals ramming the player:** the ram is telegraphed 0.5 s ahead, as now. The player loses the top 30% of the tower, never everything.
- Rivals ram each other too.

## 6. The crowd

Shoppers on foot are the living background, moving obstacles and the comedy.

- **Archetypes** (looks in `ART.md` §3):
  - granny with a walker, grandpa with a cane;
  - mom with a stroller and a crying baby, toddler on a leash;
  - teen glued to a phone, gym bro, jogger;
  - belly bro (a competitive eater), shop staff with boxes or a ladder;
  - fashionista with too many bags, gamer with a headset;
  - mascot in a giant costume, elder on a mobility scooter.
- **The mix fits the store:** grannies and moms in the supermarket, gamers in electronics, belly bros in the food court.
- **Behaviour:**
  - stroll, browse, queue, rush to a sale;
  - some dodge-jump away from a fast cart; the rest get bowled over: tumble, pop up, shake a fist;
  - each archetype has an idle.
- **Absurd moments:** the mascot breakdances, the scooter elder does donuts, a staff member chases you with a price gun for 2 s, babies throw goods out of strollers.
- **Hazards:** they avoid them, except a few who wander in, get flattened like a pancake and pop back up. This never counts as a wipeout.
- They stay light: touching them costs little speed, as in v2. Bowling five or more in one dash is a STRIKE.

## 7. Voices, speech bubbles and emotions

- **Triggers:** being rammed, ramming, a wipeout, a near miss with a hazard, grabbing a hot item, being overtaken, winning or losing at the checkout, idling in a queue.
- **Bubble:** a comic speech bubble with an ink outline appears above the head for 1.6 s. At most two bubbles are on screen, each character waits 6 s before speaking again, and the hero's lines have priority.
- **Voice:**
  - each character speaks synthesized gibberish (short syllables) with its own pitch and timbre;
  - if a file `assets/voice/<id>_<n>.mp3` exists, it plays instead. The ids are `penny`, `granny`, `sprintdad`, `coupon`, `selfie`, `bubba`, `gramps`; `n` is the line's position in its row of the table below, counted from 1. The owner may add real voices generated on Mindblown later; the game must work without them.
- **Faces** change with events:
  - shocked on a hit, angry after a ram, dizzy after a spin;
  - smug when ahead, happy when grabbing loot.
  - Emotes pop over heads: an anger vein, a sweat drop, circling stars, hearts, "!".
- **Checkout close-up:** at the checkout the camera swings in for about 1.5 s on the hero's victory or defeat pose while rivals react. This is the moment that shows off the character detail.

| Who | Lines |
| --- | --- |
| Penny (hero) | MINE! · Bargain! · Coming through! · Ka-ching! · Not the cheese! · Whoa-whoa-WHOA! · Excuse me, sorry, MINE! · Ooh, shiny! |
| Granny Tank | Out of my way, sonny! · My hip! My BARGAINS! · Back in MY day carts had brakes! · I've queued since 1987! · Ha! Too slow! · Manners! |
| Sprint Dad | Personal best, baby! · Hamstring! HAMSTRING! · Keep up, champ! · Revenge time! · Not my protein! |
| Coupon Queen | I HAVE A COUPON FOR THAT! · Expired?! NOOO! · MINE MINE MINE! · Attention shoppers: back OFF! · That was 40% off! |
| Selfie Star | Like and subscribe! · My lighting! · This is going viral! · Ew, you're in my shot! · Hashtag RAMMED! |
| Big Bubba | BULK BUY! · Oof... my snacks! · Comin' through! · Nothin' stops this cart! · Thanks, little buddy! |
| Turbo Gramps | Eat my dust, whippersnapper! · Full throttle! · My batteries! · In my day we raced HORSES! · Turbo... ENGAGE! |
| Crowd, generic | Hey! · Rude! · My sale! · Watch it! · Was that the last one?! · I saw it first! · Wheee! · Not again! |
| Crowd, by archetype | walker granny "Not so fast!" · grandpa "Whippersnapper!" · mom "Watch the baby!" (baby: "WAAAH") · teen "Literally?!" · gym bro "Do you even lift?" · jogger "On your left!" · belly bro "Is that a hot dog?" · staff "Clean-up on aisle YOU!" · fashionista "Darling, NO!" · gamer "LAG!" · mascot "Free hugs!" · scooter elder "Beep beep!" |

## 8. Meta: Mall Directory and Cart Customs

- **Flow:**
  - the first launch goes straight into level 1 with one click;
  - after the first receipt the buttons are RETRY, CART CUSTOMS and MALL DIRECTORY;
  - the title screen is the cast lined up behind the mall doors.
- **Mall Directory:** an illustrated mall map board in the existing UI language.
  - Store fronts show medals, best receipt and a mode icon.
  - Every store is open; the recommended next one pulses.
- **Wallet:** every receipt total is added to the wallet. Replays count.
- **Cart Customs:** a rotating 3D preview of the cart and the hero.
  - Four upgrades with three tiers each, plus cosmetics.
  - Every tier visibly changes the cart model.

| Upgrade | Effect per tier (starting values) | Look per tier |
| --- | --- | --- |
| WHEELS | top speed +4% / +8% / +12%, acceleration +5% / +10% / +15% | bigger wheels → rims → flame-painted racing wheels |
| BASKET | capacity +20% / +40% / +60%, wobble −15% / −30% / −45% | side rails → extended basket → double-decker basket |
| BUMPER | dash cooldown −15% / −30% / −45%, ram knockback up | rubber bumper → steel bar → snowplough bumper |
| MAGNET | pickup radius +25% / +50% / +80%, sweep distance +0.1 / +0.2 / +0.3 m | small magnet → horseshoe on a pole → giant electromagnet |

- **Prices:** tier 1 costs about a bronze receipt on level 1, so the judges can buy their first upgrade after one run. Tier 3 needs replays.
- **Cosmetics:** 6 cart paints and 6 hats for the hero, priced low.
- **Balance:** levels and medals are tuned for the base cart. Upgrades make greed and gold easier, but the Black Card still needs skill.
- **Saving and leaderboards:** progress, wallet, upgrades and cosmetics are saved through the platform layer. Leaderboards: one per level plus a total.

## 9. The judges' first three minutes

This is the script level 1 and the meta must deliver:

| Time | What happens |
| --- | --- |
| 0:00 | One click on the title. Doors burst open, the crowd rushes in, the first voice lines play |
| 0:05 | A swinging sale sign with a trail of loot under its arc: the first timing decision |
| 0:10 | Pop-up tiles. Granny Tank gets launched by one: "My hip!" |
| 0:15 | A floor button opens the deli shutter; a dash through the ribbon grabs the giant cheese wheel |
| 0:22 | Freezer alley with two swinging signs. Ramming Granny makes her loot explode |
| 0:30 | Checkout close-up, the receipt, a medal, the rivals' table. CART CUSTOMS pulses, and there is enough money for the first upgrade |
| 1:00 | The cart visibly changes. The Mall Directory shows the stores; the judge picks the next one |
| 1:15 | Level 2 opens with a boost straight into a can pyramid: "BAM!" |

## 10. Scope and cut order

- **Must:** the look (`ART.md`), every object needed by levels 1–6, the four modes, wipeouts and checkpoints, levels 1–6, the cast with voices and emotions, the full spill, the Mall Directory, Cart Customs, music and sound for each store, performance tiers, mobile controls.
- **Should:** levels 7 and 8, more cosmetics, support for real voice files.
- **Could:** a secret bonus stage, ghost replays.
- **Cut order if late:** level 8, level 7, cosmetics beyond 3 + 3, crowd archetypes beyond 8, named tricks.
- **Not doing:** scream or any other new controls, rails that take away steering, a heat meter, a drivable hub street, multiplayer, story cutscenes, text tutorials, loading screens.
