# Background research (from working GDD v1)

The Supermarket Shriek teardown and the table of techniques with their sources. This is reasoning, not a task: wherever it disagrees with `docs/GDD.md`, the GDD wins.

## Supermarket Shriek teardown: what we take, change and avoid

Supermarket Shriek was made by Billy Goat Entertainment from Belfast (5–6 people). It grew out of a 48-hour Global Game Jam entry: the theme "waves" became sound waves and scream-based controls. It came out in 2019 on Xbox One and Windows and in 2020 on Steam, PS4 and Switch. A man and a goat ride in a shopping cart: the man's scream turns it left, the goat's scream turns it right, both screams drive it forward. There is no brake and no reverse. 38 stages across the streets of a shopping district, viewed from above. Reviews were average: Metacritic 74 (Xbox One, 6 reviews), OpenCritic 68, with 44% of critics recommending it.

**How the stages work**

- Four types: an obstacle course against the clock; a race against one rival through 3 checkpoints (ahead at all three for 3 stars); "can carnage" — knock down pyramids, catch time extensions, tally at the checkout; "shopping list" — collect every listed item, usually by ramming a shelf, and bring them to the exit.
- Hazards: saws, lasers, lava, axes, sumo wrestlers, conveyor belts, spills. Springboards, moving platforms and disappearing floors change movement.
- Two levels of collision: an ordinary bump costs time, a hazard means instant failure and a restart from the beginning of the stage. No checkpoints.
- Rewards: up to 3 stars for time and score, a hidden fourth for beating the developer time. Leaderboards and ghosts, including the ghost of the world leader.

**What reviews and statistics say**

- Praised: the absurd idea, inventive stages, slapstick destruction and multiplayer.
- Criticized: the controls ("nearly impossible to master"), no checkpoints, a difficulty spike in the late worlds, traps without warning, stars used as gates to later streets, and fatigue from the screaming.
- The weakest stages according to reviews are the shopping lists: hunting for items turns into trial and error.
- By Steam achievements, 57.7% of players cleared the first stage and 4.7% unlocked every street.
- In an interview with MCV, the game's director himself named Black Friday as a natural theme for seasonal content.

**Decisions for DOORBUSTER**

|  | In Supermarket Shriek | In our game |
| --- | --- | --- |
| Take | obstacle-course track to the checkout against the clock | the same: 75–90 s, the finish is a checkout |
| Take | items are taken by ramming a shelf, no button | sweeping along a shelf (GDD 5.2) |
| Take | 3 stars plus a hidden one for the developer time | bronze, silver, gold and Black Card (GDD 5.9) |
| Take | leaderboards and ghosts | Mindblown leaderboards and a ghost (GDD 7) |
| Take | one-on-one race through checkpoints | the final boss race against Granny Tank (GDD 6) |
| Take | can pyramids that are fun to smash | can pyramids as dash targets (GDD 5.4) |
| Take | each store has its own set of hazards | each mall zone has its own pieces (GDD 6) |
| Change | scream controls, no brake | familiar steering, throttle and brake plus drift and dash (GDD 3, 5.1) |
| Change | a trap means instant failure and a restart from the beginning | a crash costs goods and speed; restart with one key whenever you want |
| Change | items are hunted across an open map | list items lie on the main route and glow |
| Change | top-down camera | high chase camera: the gap to the shelf is visible, and "left" is always left (GDD 5.1) |
| Change | sources mention no crowd of rival shoppers | a crowd and 3–5 rivals with carts (GDD 5.6, 5.7) |
| Avoid | stars as gates | the next level opens for any finish at a checkout (GDD 7) |
| Avoid | traps without warning | every hazard is visible in advance: shadow, light, sound or rhythm (GDD 6) |
| Avoid | the same loud sound on every action | voice lines with pauses between repeats and separate voice volume (ART 7) |

**Main conclusion.** Shriek rests on one unusual mechanic, the scream, and that same mechanic drew the most complaints. In our game the unusual part is not the controls but the combination of "sweep + weight + dash", while the controls are clear from the first second.

Sources: [Steam](https://store.steampowered.com/app/1086460/), [Xbox Wire](https://news.xbox.com/en-us/?p=116764), [MCV](https://www.mcvuk.com/development/shriek-for-your-supper-how-supermarket-shriek-is-making-good-noise), [PC Invasion](https://www.pcinvasion.com/?p=236499), [GameWatcher](https://www.gamewatcher.com/reviews/supermarket-shriek-review/13227), [GameGrin](https://gamegrin.com/reviews/supermarket-shriek-review-review), [Games Asylum](https://www.gamesasylum.com/?p=39991), [Bonus Stage](https://www.bonusstage.co.uk/archives/177871), [Steam achievements](https://steamcommunity.com/stats/1086460/achievements), [Metacritic](https://legacy.prod.metacritic.com/game/xbox-one/supermarket-shriek), [OpenCritic](https://opencritic.com/game/8088/view/reviews). Unconfirmed: cart speeds, stage length, keyboard layout and engine.

## Techniques and their sources

Where each technique comes from. The first column is the topic.

| Topic | Technique | Game or author | Source |
| --- | --- | --- | --- |
| format | obstacle course to the checkout against the clock, hidden star for the developer time | Supermarket Shriek | [Steam](https://store.steampowered.com/app/1086460/), [GameWatcher](https://www.gamewatcher.com/reviews/supermarket-shriek-review/13227) |
| cart | drift with a mini-turbo on a separate button | Mario Kart | [MarioWiki](https://www.mariowiki.com/Mini_Turbo), [Game Developer](https://gamedeveloper.com/design/the-design-origins-of-drifting-in-i-mario-kart-i-) |
| cart | weight is felt only past a threshold | Death Stranding | [PowerPyx](https://www.powerpyx.com/death-stranding-how-to-balance-cargo) |
| cart | heavier pushes harder; immunity after a hit | Mario Kart 8 Deluxe | [MarioWiki](https://mariowiki.com/Mario_Kart_8_Deluxe_in-game_statistics) |
| cart | impact strength from closing speed; fixed physics step | Rocket League | [Game Developer, GDC 2018](https://gamedeveloper.com/design/video-the-rocket-science-behind-i-rocket-league-s-i-physics), [RocketSim](https://github.com/ZealanL/rocketsim) |
| cart | steering weakens with speed | overview of racing game approaches | [Game Developer](https://gamedeveloper.com/design/implementing-racing-games-an-intro-to-different-approaches-and-their-game-design-trade-offs) |
| cart | speed is conveyed by the camera and the surroundings | Shawn Hargreaves | [blog](https://www.shawnhargreaves.com/blog/vrrroom-whoosh.html) |
| pickup | pickup on contact, scattering and recovering | Sonic | [Sonic Wiki](https://sonic.fandom.com/wiki/Ring) |
| pickup | coins teach racing lines without words | Mario Kart 8 | [Game Developer](https://www.gamedeveloper.com/design/mario-kart-8-players-don-t-need-to-know-what-the-coins-do-) |
| pickup | valuable pickups cost a commitment (in Crazy Taxi, braking; in v2 we use a dash instead) | Crazy Taxi | [Dreamcast manual](https://segaretro.org/images/6/67/CrazyTaxi_DC_US_DigitalManual.pdf) |
| pickup | 90 s, a list of three items, bonus items | Supermarket Sweep | [Wikipedia](https://en.wikipedia.org/wiki/Supermarket_Sweep) |
| pickup | chain with a multiplier (the basis of Madness) | Tony Hawk's Pro Skater, Crazy Taxi | [Activision](https://support.activision.com/uk/en/tony-hawks-pro-skater-1-2/articles/tony-hawks-pro-skater-1-2-scoring-and-combos) |
| rivals | takedowns and revenge with a red marker | Burnout 3 | [Wikipedia](https://en.wikipedia.org/wiki/Burnout_3:_Takedown), [Burnout Wiki](https://burnout.fandom.com/wiki/Takedown) |
| rivals | AI pacing without visible cheating | Pure | [Game Developer](https://gamedeveloper.com/design/the-pure-advantage-advanced-racing-game-ai) |
| rivals | AI does not take shortcuts; boss races | Crash Team Racing | [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Crashteamracing) |
| rivals | pedestrians always dodge | Crazy Taxi | [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/CrazyTaxi) |
| rivals | fewer participants read better | Fall Guys | [Wikipedia](https://en.wikipedia.org/wiki/Fall_Guys) |
| levels | four beats per level | Super Mario 3D Land | [Kotaku](https://kotaku.com/how-drawing-comics-helped-shigeru-miyamoto-make-great-m-5901805) |
| levels | levels built from a kit of pieces | Hot Wheels Unleashed 2 | [Game Developer](https://www.gamedeveloper.com/design/a-closer-look-at-hot-wheels-unleashed-2---turbocharged-track-builder) |
| levels | risky shortcuts, a fair main route | SuperTuxKart, Sonic Robo Blast 2 | [SuperTuxKart](https://supertuxkart.net/Making_Tracks:_Advanced_Gameplay_Design), [SRB2 Wiki](https://mail.wiki.srb2.org/wiki/Level_Design_101/Single_Player) |
| levels | escalators, fountains, a glass shortcut, cars as obstacles | Coconut Mall (Mario Kart Wii) | [MarioWiki](https://www.mariowiki.com/Coconut_Mall) |
| levels | named tricks in a shopping mall | Tony Hawk's Pro Skater, Mall level | [Push Square](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-mall-all-park-goals-gaps-and-challenges), [Giant Bomb](https://giantbomb.com/wiki/Concepts/Gaps) |
| levels | weight closes off a shortcut | Mario Kart 8, track analysis | [itch.io](https://zoe-pilgrim.itch.io/kokiri-forest-mario-kart-8-level-design/devlog/339569/mario-kart-8-case-study) |
| levels | warning by shadow and rhythm | Fall Guys | [Push Square](https://www.pushsquare.com/guides/fall-guys-all-rounds-and-how-to-win-every-game-type) |
| levels | a hazard that moves across the road | Crash Team Racing, Polar Pass | [Crash Wiki](https://crashbandicoot.fandom.com/wiki/Polar_Pass) |
| checkout | medals derived from the author's run | Trackmania | [Mania-Exchange](https://tm.mania-exchange.com/blogs/entry/569/what-do-you-think-medal-times) |
| checkout | tally that shows what was missed | Crash Bandicoot | [Twinfinite](https://twinfinite.net/news/the-crash-bandicoot-remasters-make-you-regret-not-breaking-every-crate/) |
| checkout | award jingle in a major or minor key depending on place | Mario Kart 64 | [MarioWiki](https://www.mariowiki.com/Awards_Ceremony_(1st_%E2%80%93_3rd_Place)) |
| events | the level changes mid-play | Overcooked | [MCV](https://mcvuk.com/the-develop-post-mortem-overcooked/) |
| events | music speeds up toward the finish | Mario Kart | [Giant Bomb](https://giantbomb.com/lakitus-final-lap-sign/3055-3352/) |
| events | timed escape | Pizza Tower | [Wikipedia](https://en.wikipedia.org/wiki/Pizza_Tower) |
| events | announcements: the point first, then the joke | Splatoon | [Inkipedia](https://splatoonwiki.org/wiki/Inkopolis_News) |
| progression | level skip for stuck players | New Super Mario Bros. Wii, Super Guide | from memory, not verified |
| interface and juice | teaching without text | Super Mario Bros. 1-1, Portal | [Wikipedia](https://en.wikipedia.org/wiki/World_1-1), [Portal Wiki](https://theportalwiki.com/wiki/Portal_developer_commentary) |
| interface and juice | straight into the game, light loading, two-zone touch steering | Poki, CrazyGames, Drive Mad | [Poki](https://developers.poki.com/guide/easy-access), [Poki blog](https://poki.com/blog/what-makes-high-quality-browser-game), [CrazyGames](https://docs.crazygames.com/requirements/gameplay/) |
| interface and juice | juice | Juice It or Lose It; The Art of Screenshake | [GDC Vault](https://gdcvault.com/play/1016487/Juice-It-or-Lose), [Game Developer](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games) |
| interface and juice | trauma-based shake; hit-stop | Eiserloh, GDC 2016; Capcom | [GDC Vault](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing), [Capcom](https://game.capcom.com/cfn/sfv/column/131545?lang=en) |
| interface and juice | how much juice | Kao, 2020 | [arXiv](https://ar5iv.arxiv.org/html/2011.09201) |
| interface and juice | pitch rises with a chain | Peggle | [GANG](https://www.audiogang.org/?p=3084) |
| interface and juice | interface inside the world | Dead Space; Fagerholt and Lorentzon, 2009 | [Chalmers](https://publications.lib.chalmers.se/records/fulltext/111921.pdf) |
| interface and juice | lessons from jam games about carts | 60 Second Supermarket Sweep (Ludum Dare 44), Supermarket Scramble | [LD44](https://ludum-dare.foon.uk/games/44/142356), [itch.io](https://itch.io/jam/brackeys-6/rate/1177999) |

**Similar games on the same theme.** Carts and sales are a common jam theme: [Black Friday Simulator](https://efrenaguilar95.itch.io/black-friday-simulator), [Deadly Sales](https://rawg.io/games/deadly-sales), [Super Marketcart Grocery Rush Deluxe](https://itch.io/jam/patch-notes/rate/4220847), [Smashcart Ultra](https://smashcart-ultra.itch.io/smashcart-ultra), [Bodega Dash](https://lesliezeng.itch.io/bodega-dash). Parts of our idea already exist there: weight and dropping goods in Super Marketcart, ramming for loot in Smashcart Ultra. So we win not through the novelty of individual parts but through the "sweep + weight + dash" combination and the quality of execution.

**Unconfirmed or our own inventions**

- Supermarket Shriek: cart speeds, stage length, keyboard layout.
- RocketSim numbers are community reverse engineering, not Psyonix; the tuning goals from the Rocket League talk are known from a summary.
- Trackmania medal multipliers are a community observation, not official.
- Super Guide in New Super Mario Bros. Wii is from memory and was not verified in this research.
- Juice numbers (hit-stop, shake, particles) and cart numbers are starting proposals, not data from sources.
- The travelator, island stands, round display, tables, floor scrubber and cart train are our own pieces: we did not find them in mall games; their rules are borrowed from the closest techniques in the table above.
