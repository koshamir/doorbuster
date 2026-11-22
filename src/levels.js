// DOORBUSTER — levels.js
// Purpose: level data. A level is a tile plan (see the legend in world.js) plus a few annotations.
//          Nothing here is code: world.js derives walls, colliders, shelves and navigation from it.
// Exports: LEVELS
// Depends on: nothing.
//
// Fields: id, name, timer (seconds), marks (test only: [name, col, row] after each obstacle), heading (start direction, radians; 0 = +z/south, PI/2 = +x/east,
//         PI = north, -PI/2 = west), rivals (character ids), crowd (shoppers), maxRams (how many times
//         rivals may ram the player in one run), rush (shoppers who run in ahead of the carts at GO),
//         list (three goods ids
//         for plan characters 1 2 3), zones (first entry is the default; others paint a rect of tiles
//         [col0, row0, col1, row1] with a goods pool and an accent colour), plan (rows of tiles).

export const LEVELS = [
  {
    // 0. Test course, not part of the campaign: an open yard for free driving, then one of each kind
    // of trouble. `marks` name the point just after each obstacle; tools/sim.mjs reports per mark.
    id: 'gauntlet', name: 'GAUNTLET', timer: 90, heading: Math.PI / 2, rivals: [], crowd: 0, list: [],
    zones: [{ pool: 'market', color: 0, name: 'GAUNTLET' }],
    marks: [['slalom', 35, 6], ['doorway', 41, 6], ['hairpin right', 36, 12], ['aisle', 24, 12], ['notch', 19, 12],
      ['shelf end', 11, 12], ['hairpin left', 7, 18], ['chicane', 22, 18], ['checkout', 40, 18]],
    plan: [
      '                                              ',
      ' ....SSSSS......                              ',
      ' ...............                              ',
      ' ......o.o.o....                              ',
      ' ................... ........... ..... ...... ',
      ' ................... ........... ..... ...... ',
      ' ..@................ ..... ..... ............ ',
      ' ......................... ........... ...... ',
      ' ......................... ........... ...... ',
      '                                        ..... ',
      ' .........................SSSSSSS............ ',
      ' .............MMM............................ ',
      ' ....................O....SSSSSSS............ ',
      ' ....................O....................... ',
      ' .........................SSSSSSS............ ',
      ' .....                                        ',
      ' ...........  ............................cc  ',
      ' ...........  ............................CC  ',
      ' ...........  ....  ......o.o.o.o.........cc  ',
      ' .................  ......................CC  ',
      ' .................  ......................cc  ',
      '                                              ',
    ],
  },
  {
    // 1. DOORS OPEN — a supermarket of five aisles snaking to the checkouts (route about 380 m).
    // New: steering, sweeping, the first dash (pyramid, ribbon, rival). Beats: the crush at the start and
    // a trail into the first shelf; left or right shelf; a pyramid on the racing line; an aisle split
    // into a wide lane and a narrow dear one behind a huddle; the hot item; dear goods late; the hall.
    // Every hairpin turns round an island stand.
    id: 'doors', name: 'DOORS OPEN', timer: 72, heading: Math.PI, rivals: ['granny', 'dad', 'queen'], crowd: 24, rush: 9, maxRams: 3,
    list: ['cereal', 'melon', 'microwave'],
    zones: [
      { pool: 'market', color: 0, name: 'PRICE PANIC' },
      { pool: 'market', color: 1, name: 'SNACK ATTACK', rect: [7, 1, 11, 39] },
      { pool: 'market', color: 2, name: 'HOME STRETCH', rect: [13, 1, 17, 39] },
      { pool: 'market', color: 3, name: 'MEGA DEALS', rect: [19, 1, 23, 39] },
      { pool: 'market', color: 0, name: 'LAST CHANCE', rect: [25, 1, 29, 39] },
      { pool: 'market', color: 1, name: 'CHECKOUT', rect: [31, 1, 37, 25] },
    ],
    plan: [
      '                                       ',
      ' ........... ........... ............. ',
      ' ........... ........... ............. ',
      ' .....S..... .....S..... ............. ',
      ' ........... ........... ............. ',
      ' ........... ........... .........o... ',
      ' ..... ..o.. ..... ..... ..... ....... ',
      ' ..... ..o.. ..... ..... ..o.. ...o... ',
      ' ..... ..... ..... ..... ..o.. ....... ',
      ' ..... ..P.. ..... .G... ..o.. ....... ',
      ' ..... ..... ..... ..... ..... ...f... ',
      ' ..S.. ..... ..... ..... ..... ....... ',
      ' ..... S.... ..S.. ..o.. L.... ....... ',
      ' ..... S...L ..S.. ..o.. L.... p.....p ',
      ' ..... S...L .oS.. ..... L.... ....... ',
      ' M...S S.... ..... ..... L.... ....... ',
      ' M...S S.... .o... ..H.. ..... ..K.... ',
      ' M...S ..... ....L ..... ...m. ....... ',
      ' M.... ..... ..M.L ..... ..... ....K.. ',
      ' ..... ..... ..M.L ..... ..... ....... ',
      ' ..... ..M.. ....L L.... ..P.. ....... ',
      ' ..1.. ..... ..... L.... ..... ....... ',
      ' ..... ..... ...g. ..... ..... cCcCcCc ',
      ' ..... ..... ..... ..... ..... cCcCcCc ',
      ' ..... .t.b. ..L.. ..... ..... ....... ',
      ' ....S ..... ..... ..f.. ..... ....... ',
      ' ...oS ..... ..... ..... ..3..         ',
      ' ....S ..... ...t. ..... .....         ',
      ' ...oS ..2.. .b... ....M .....         ',
      ' ....S ..... ..... ....M .....         ',
      ' ...oS ...oM ..... ....M ....S         ',
      ' ..... ....M M.... ..... ....S         ',
      ' .r.o. ...oM M.... ..o.. ....S         ',
      ' ..... ....M M.... ..o.. ....S         ',
      ' ..o.. ..... ..... ..o.. .....         ',
      ' ..... ........... ...........         ',
      ' ..@.. ........... ...........         ',
      ' ..... .....M..... .....M.....         ',
      ' r...r ........... ...........         ',
      ' ..... ........... ...........         ',
      '                                       ',
    ],
  },
];
