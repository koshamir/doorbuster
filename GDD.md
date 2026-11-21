# DOORBUSTER — Game Design v2

Build version, 21 November 2026. Replaces working GDD v1. The reasoning and sources behind each technique are in `RESEARCH.md`. Every number here is a starting value: the developer refines it through measurements and playtests.

## 1. Fact sheet

- **Genre:** arcade race-and-rampage on a shopping cart. A run lasts 60–90 seconds, a session 5–10 minutes.
- **Platform:** browser, desktop and mobile. High chase camera behind the cart.
- **Fantasy:** the mall doors open and the crowd surges in. You are a bargain hunter: you sweep shelves on the move, haul a wobbling tower of loot, knock loot off your rivals and crash into the checkout a second before closing.
- **Goal of a run:** bring the biggest receipt to the checkout before the store closes.
- **Tone:** good-natured slapstick. Nobody gets hurt: shoppers are chubby "beans" that topple over and pop back up like roly-poly toys.

## 2. Three pillars

1. **The cart is a toy.** Driving is fun even in an empty hall: sharp steering, a drift with a boost, a dash.
2. **Greed is visible and dangerous.** The tower of goods in the cart is the score, the weight and the risk all at once. The taller it gets, the funnier and scarier it is.
3. **The mall has gone mad.** Everything around is alive and responds to the player: rivals, the crowd, displays, sales, closing checkouts.

## 3. What the player must understand

The player knows five rules. Everything else is hidden from them and can be as complex inside as it needs to be.

1. Steer, accelerate and brake.
2. Hug a shelf with the side of the cart and the goods fly into the cart on their own.
3. The taller the tower, the heavier the cart and the easier it is to spill everything.
4. The dash breaks through ribbons, display windows and pyramids and knocks loot off rivals.
5. Reach a checkout before closing time. The receipt total is your score.

A sixth rule is for record chasers: drifting charges a boost.

| Control | Desktop | Mobile |
| --- | --- | --- |
| Steer | ←/→ or A/D | two large buttons on the left |
| Accelerate and brake | ↑/↓ or W/S | accelerates automatically |
| Dash | Shift | button on the right |
| Drift (hold) | Space | button on the right |
| Restart, pause | R, Esc | buttons in the corner |

## 4. One run

1. **Doors open (0–3 s).** Shutters roll up, a countdown, everyone starts at once: the player, rivals and the crowd.
2. **Race and rampage.** Corridors and stores. On the move, the player keeps choosing: turn toward a shelf, smash into a hot item, ram a rival or hold the pace.
3. **Flash sale (around 40% of the timer).** The announcer calls a zone ahead of the player. Hot items appear there, and the crowd and rivals rush toward it.
4. **Store closing (last 15 s).** The music speeds up, the lights turn red, shortcuts and checkouts close one after another.
5. **Checkout.** Drive into an open checkout at any speed. Receipt, medal, place among the shoppers, a "play again" button.

Not in by zero — the store is closed, there is no receipt, instant restart.

**Pace.** Every 3–5 seconds the player has something to do: a shelf, a slalom, a rival, an obstacle, a ramp. No empty straight lasts longer than 2 seconds. Speed almost never drops to zero: walls let the cart slide along them, the crowd is light, and a crash costs goods, not momentum. Control is never taken away for longer than one second.

## 5. Systems

### 5.1 The cart

The model is arcade and predictable, like a kart: movement is computed on a plane with a fixed time step. "Real" physics is used only for show: flying goods, tumbles, the swaying tower.

- **Weight.** The first 30% of the load is not felt. Beyond that, acceleration, braking and top speed drop smoothly and turns get slightly wider. A full cart accelerates about half as fast and takes about a third longer to stop. In exchange it shoves harder and is harder to push around.
- **Drift.** Hold the button in a turn: the rear slides out, the turn tightens and the wheels throw sparks in three colors (0.6, 1.2 and 2 seconds). Release it for a boost; the longer the hold, the stronger the boost. Getting hit resets the charge.
- **Dash.** A lunge forward for a third of a second, with a cooldown of about 1.5 seconds. A glowing bumper shows it is ready.
- **Collisions.** A glancing hit on a wall only slows the cart. A crash is a nearly head-on hit at speed.
- **Invisible helpers.** Slight steering assist away from head-on wall hits, a 0.15 s buffer for early presses, generous pickup and dash hit zones, 1.5 s of immunity after being hit.
- **Camera.** High and behind, aimed at a point ahead of the cart; it pulls back and widens with speed. The player sees about two seconds of road ahead and the gap to the shelf.

### 5.2 Picking up goods

There is no "grab" button. The whole skill of collecting lies in steering.

- **Sweeping.** Drive close to a shelf (gap up to 0.6 m) and the goods on that stretch fly into the cart along an arc, one after another, each "pop" a little higher in pitch. Touching the shelf throws sparks and slows the cart slightly. The end of a shelf unit acts as a wall.
- **Off the floor.** Trails of small goods lie along good racing lines and shortcuts. Driving through picks them up; the radius grows with speed.
- **Hot items.** Each level has 1–3 big, expensive items, on a podium behind a red ribbon or in a display window. Dash through and the item jumps to the top of the tower. It sits on top and falls off first when you get rammed, so a hot item can be stolen from a rival and lost by you.
- **Shopping list.** Three item icons per level. A list item is worth double and glows teal; completing the list pays a bonus. The list lies on the main route, so there is no searching.
- **Clean sweep.** Clear an entire shelf section in one pass for CLEAN SWEEP: a bonus and a boost to Madness.
- **Size = weight = price.** Small: 1 weight unit, $5–15. Medium: 2 units, $20–60. Large: 4 units, $100–250. Hot items: 6–8 units, $300–800. Large goods pay more per unit of weight; small goods pay off in chains. A route holds about three times as many goods as fit in the cart, so taking everything is impossible.
- There are no special goods with their own rules (fragile, perishable).

### 5.3 The tower

- Every item taken is visible: it lands on the tower, which grows and sways in the turns. There is no separate weight meter; the tower is the indicator.
- A "full" cart holds 30 weight units, and HEAVY appears at 70%. There is no hard limit: the cart can be loaded to 1.5 times its rating (OVERLOADED). Above the rating the weight stops growing, but the wobble keeps growing.
- The tower spills on a crash, when you get rammed and on a hard landing; an overloaded tower also spills during a long, sharp drift. Your own dash never spills it.
- Spilled goods flash on the floor for 3 seconds, and anyone can pick them up. One hit costs at most 40% of the tower, taken from the top down.
- What the player takes away: a careful driver brings home a skyscraper, a sloppy one loses it all.

### 5.4 The dash: one action, many targets

| What the dash hits | What happens |
| --- | --- |
| Rival | spins for a second and drops the top third of its tower, hot item first. If it then hits an obstacle — TAKEDOWN and a bonus |
| Shopper in the crowd | goes tumbling and gets back up. Five or more in one dash — STRIKE |
| Hot item behind a ribbon or in a display | the item jumps into the cart |
| Can pyramid, gift pile, cardboard stand | bursts apart; part of it becomes goods on the floor |
| Glass display window (shortcut) | shatters and opens a short route |
| Wall, end of a shelf | crash |

Without the dash, the same objects are just obstacles. Carts bump each other side to side: a heavy cart pushes a light one, and nobody drops anything. The crowd steps aside at a small cost in speed, and the cart bounces off a display window.

### 5.5 Madness

One meter with four segments, which is also the price multiplier from ×1 to ×4.

- It grows from anything done without pauses and with risk: one item after another, a clean sweep, passing within inches of a person or an obstacle (CLOSE SHAVE), a good ram, a strike, a long drift.
- It drains slowly when nothing is happening. A crash or being rammed takes away one segment.
- An item's price is locked together with the multiplier at the moment it is taken: "+$45 ×3".
- Overfill the fourth segment for 6 seconds of MADNESS mode: double pickup radius, weight and wobble switched off, every touch works like a dash, and the music and screen go wild. After the mode the meter drops back to ×2.
- Target: a good player triggers the mode 1–2 times per run; a beginner stays around ×2.

### 5.6 Rivals

Shoppers with carts take part in the same race. They are not the core of the game but a source of competition, jostling and funny situations.

- **Same rules.** Rivals have the same carts, tower, weight, dash and losses. Their receipts use the same formulas and appear in the final table.
- **How many.** Three in the first level, up to five later.
- **What they do.** Drive the route to the checkout, sweep shelves, hunt hot items and the flash sale, ram whoever has loot to knock off, remember an attacker for five seconds (a red arrow above them) and jostle each other, not only the player.
- **Intelligence.** They see obstacles and each other, pick a lane, brake before turns, wait out moving hazards, get back into the race within a second after a hit and never get stuck. Most rivals get past most obstacles.
- **Mistakes are part of the fun.** Each rival has its own skill level. Weaker ones sometimes miss a turn, slide on a wet floor or get caught by the cart train. The player should see someone else crash in almost every run.
- **Fairness.** Never faster than the player's top speed and no teleporting on screen. Pacing adjusts invisibly through precision and aggression so that rivals stay 10–20 meters from the player. For the first 10–15 seconds they drive at full strength and overtake; in the last 20% of a level the adjustment is off. A ram aimed at the player is telegraphed half a second ahead.
- **Characters.** Each has one silhouette, one color and one behavior.

| Who | Silhouette | Behavior |
| --- | --- | --- |
| Granny Tank | shawl, tower up to the ceiling | slow and heavy, gets in the way. Only a heavy or boosted cart can knock loot off her |
| Sprint Dad | tracksuit, nearly empty cart | fast, drives the perfect line, takes revenge for rams |
| Coupon Queen | megaphone and a fan of coupons | heads for hot items first and shouts about them — a hint for the player |
| Selfie Star | ring light on the cart | suddenly stops for a photo (a flash one second before), a crowd gathers around her |
| Bulk Bro | big guy, wide cart | after a hit, charges straight at the attacker. Dodge him and he slams into a stand himself |

### 5.7 The crowd

Shoppers on foot are the living background and the slalom.

- 20–60 people per level. They stroll, stand at shelves, cluster around promotions and run toward the flash sale.
- Some manage to jump away from a fast cart; the rest get bowled over. A knocked-down shopper tumbles, springs up and shakes a fist.
- They are light: a touch costs no more than 5% of speed, a dash costs nothing. They never block the only way through for longer than a second.
- Density grows from level to level and toward the end of a run.
- Passing within inches gives CLOSE SHAVE and a boost to Madness. Careful driving is rewarded as well as smashing through.

### 5.8 Events

| When | Event | What changes |
| --- | --- | --- |
| 0–3 s | DOORS OPEN | mass start. Accelerating exactly on "GO" gives a rocket start |
| around 40% of the timer | FLASH SALE | announcer chime, banner and arrow. For 10 seconds, 1–2 hot items light up ahead of the player; the crowd and rivals run there |
| last 15 s | CLOSING TIME | faster music, red light, shortcuts close with a 2-second warning, checkouts go dark one by one |

The announcer is a "ding-dong" chime and a short line on screen: the point first, then the joke.

### 5.9 Checkout and receipt

- The finish is driving into any open checkout with a green lamp. Time slows down, the goods fly onto the belt and the scanner beeps higher and higher.
- Receipt lines: ITEMS (prices already include multipliers), LIST (+$200 for a completed list), STUNTS (strikes, clean sweeps, rams, named tricks such as the jump over the fountain), TIME ($15 for every second left), TOTAL.
- Then the medal stamp, the place among the shoppers and the record. The whole tally takes up to 6 seconds; any key makes it four times faster. Buttons: Retry and Next.
- Medals: bronze for finishing, silver and gold for receipt thresholds, and a hidden Black Card for beating the author's receipt. Thresholds come from measurements (see `QUALITY.md`).

## 6. Levels

**Template.** A 350–450 meter route from the entrance to the checkout line through 2–3 mall zones. The timer is 75–90 seconds. A fast run with no collecting takes 55–65% of the timer; the rest of the time is for greed. Beats: introduce the new element safely → raise the stakes → breather with a mall attraction → the new element combined with familiar ones → dash to the checkouts.

**Route rules**

- The goal is visible: the checkout sign in the distance and trails of goods leading to it.
- The main route is fair. Risk and reward live on the shortcuts. Fall short off a ramp and you take the long way. There are no deadly traps.
- Every hazard telegraphs itself at cart level: shadow, light, sound or rhythm.
- Verticality is cosmetic: a ramp launches the cart in an arc over an obstacle; there is no separate second floor.

**Campaign**

| # | Name and place | New element | Rivals | Screenshot moment |
| --- | --- | --- | --- | --- |
| 1 | DOORS OPEN — supermarket | steering, sweeping, first dash through a ribbon and into a rival | 3 | the crush at the start, a can pyramid blown apart |
| 2 | GADGET RUSH — electronics | drift; travelator, round displays, glass shortcut | 4 | a sparking drift around a display |
| 3 | ATRIUM MAYHEM — atrium and food court | escalator ramp, cart train, wet floor | 5 | a jump over the fountain past the Christmas tree |
| 4 | LAST CALL — the whole mall | no new controls, closing runs through the whole level, boss | 5 and the boss | race to the last open checkout |

The first level is already wild: rivals, the crowd and the dash are there from the first seconds, but it forgives mistakes. The jury may never reach level two.

The final boss is Granny Tank on an electric cart carrying a pallet of hot items. On straights she keeps pace with the player; in turns she brakes and drops boxes. No new rules: the boss tests what the player has already learned.

Black Friday falls at the end of November, so the mall is already decorated for the holidays: a Christmas tree in the atrium, garlands, piles of gifts. That gives a bright picture almost for free.

**Mall kit.** A level is a list of pieces with coordinates. Each piece is written once.

| Piece | Rule for the player | How it warns |
| --- | --- | --- |
| Shelf row | hug it to sweep; the end acts as a wall | glowing price tags, yellow stripe on the end |
| Island stand | circle it closely to sweep all the way around | — |
| Can pyramid, gift pile | dash through for a burst of goods; without a dash it slows you | visible from far away |
| Podium with a hot item | dash through the ribbon and the item is yours | golden beam |
| Glass display window | dash for a shortcut, otherwise bounce off | glare and a SALE sticker |
| Travelator | faster going with it, half speed going against it | arrows on the belt |
| Round display | an island that is easy to drift around | — |
| Escalator ramp | an arcing jump over an obstacle | belt moving up, lighting |
| Fountain, Christmas tree | large obstacle in the middle of the atrium | spray, garlands |
| Tables, boxes, mannequins | light: they fly and roll away | — |
| Wet floor | the cart drifts on momentum for a second | yellow sign, shiny floor |
| Floor scrubber | drives across the corridor and leaves a wet trail | flashing light and horn |
| Cart train | crosses the corridor; slip through the gap | rattling and a long shadow |
| Roller shutter | closes a shortcut near the end of the level | stripes and a beep 2 seconds ahead |
| Checkout line | driving into an open checkout is the finish | green lamp |

Rivals use the same pieces under the same rules.

## 7. Progression and modes

- A campaign of four levels. The next level opens for any finish at a checkout. After three failures in a row a Skip button appears: the jury must see the finale.
- The level select screen is a loyalty card with medal stamps.
- Any level can be replayed for a medal and a record, with a ghost of your own best run alongside.
- Leaderboards: one per level and one overall.
- Progress and records are saved through the platform layer (see `MINDBLOWN.md`).

## 8. Interface and onboarding

- **No menu at first launch.** The first launch puts the player straight at the start of level one: one click starts the route flyover and the countdown. The menu appears after the first checkout.
- **Teaching without text.** Key icons next to the cart: steering and throttle at the start, the dash before the first ribbon with a hot item, the drift before the first round display. An icon fades after its first use. The first successful ram slows time for a fraction of a second so the player sees the result.
- **In-run screen.** Timer, receipt total and place, three list icons, the Madness meter, an arrow toward the current event. The cart itself shows weight, drift charge and dash readiness.
- **Pop-up words.** CLEAN SWEEP, STRIKE, CLOSE SHAVE, TAKEDOWN, HEAVY, OVERLOADED, FLASH SALE, CLOSING TIME — short, big, one at a time.
- Restart at any moment in a second and a half. Pause, volume, a screen shake toggle.

## 9. Scope

**Must**

- The cart (steering, drift with boost, dash) and the camera.
- Sweeping, the tower with spills, checkout with a receipt, timer, restart.
- The Madness meter and mode.
- Rivals (at least three characters) and the crowd.
- Every dash target from table 5.4.
- All three events.
- Levels 1–3, built from the mall kit.
- Icon-based teaching, the in-run screen, medals.
- Sound and music, a juice pass.
- Mobile controls, the platform layer, `tune.json`.

**Should**

- Level 4 and the boss, all five characters.
- Named tricks in the STUNTS line.
- Ghost, leaderboard screen, loyalty card.

**If time allows**

- A fifth level (toy store), cart skins, a "Receipts of the day" board, shopping bags dropped by knocked-down shoppers.

**Not doing**

- Multiplayer, an upgrade shop, inventory power-ups, special item types, a real second floor, lives and death, text tutorials, a third action button.
