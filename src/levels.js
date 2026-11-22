// DOORBUSTER — levels.js
// Purpose: level data. A level is a tile plan (see the legend in world.js) plus a few annotations.
//          Nothing here is code: world.js derives walls, colliders, shelves and navigation from it.
// Exports: LEVELS
// Depends on: nothing.
//
// Fields: id, name, timer (seconds), marks (test only: [name, col, row] after each obstacle), heading (start direction, radians; 0 = +z/south, PI/2 = +x/east,
//         PI = north, -PI/2 = west), rivals (character ids), crowd (shoppers), list (three goods ids
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
    // 1. DOORS OPEN — a supermarket of five aisles snaking to the checkouts (route about 450 m).
    // New: steering, sweeping, the first dash (pyramid, ribbon, rival). Rivals and crowd arrive in M4.
    id: 'doors', name: 'DOORS OPEN', timer: 75, heading: Math.PI, rivals: ['dad', 'queen', 'granny'], crowd: 24,
    list: ['cereal', 'melon', 'microwave'],
    zones: [
      { pool: 'market', color: 0, name: 'PRICE PANIC' },
      { pool: 'market', color: 1, name: 'SNACK ATTACK', rect: [7, 1, 11, 39] },
      { pool: 'market', color: 2, name: 'HOME STRETCH', rect: [13, 1, 17, 39] },
      { pool: 'market', color: 3, name: 'MEGA DEALS', rect: [19, 1, 23, 39] },
      { pool: 'market', color: 0, name: 'LAST CHANCE', rect: [25, 1, 29, 39] },
      { pool: 'market', color: 1, name: 'CHECKOUT', rect: [31, 1, 37, 33] },
    ],
    plan: [
      '                                       ',
      ' ........... ........... ............. ',
      ' ........... ........... ............. ',
      ' ........... ........... ............. ',
      ' ........... ........... ............. ',
      ' ........... ........... ............. ',
      ' ..... ..... ..... ..... ..o.. ....... ',
      ' ..... ..... ..... ..... ..o.. ....... ',
      ' ..... ..... S.... ..... ..o.. ....... ',
      ' ..... ..P.. S.... .G... ..o.. ....... ',
      ' ....M ..... S.... ..... ..... ...o... ',
      ' ....M ..... S.... ..... ..... ....... ',
      ' ..... S.... ..... ..... M.... ...f... ',
      ' ..... S.... ...O. ..... M.... ....... ',
      ' ..1.. S.... ..... ..... M.... ...o... ',
      ' ..... S.... ..... ..... ..... ....... ',
      ' ..... ..... .O... ..H.. ..... ...o... ',
      ' ..... ..... ..... ..... ..... ....... ',
      ' ..S.. ..... ..... ..... ..... ...o... ',
      ' ..... ..... ..... ..... ..... ....... ',
      ' ..... ..M.. ....L L.... ..P.. ....... ',
      ' ..... ..... ....L L.... ..... ....... ',
      ' ..... ..... ..... ..... ..... ....... ',
      ' ..... ..... ..... ..... ..... ....... ',
      ' ..... .t.b. ..... ..f.. ..... ....... ',
      ' ....S ..... ..... ..... ..... ....... ',
      ' ....S ..... .b.t. ..... ..3.. ....... ',
      ' ....S ..... ..... ..... ..... ....... ',
      ' ....S ..2.. ..... ....M ..... ....... ',
      ' ....S ..... ..... ....M ..... ....... ',
      ' ..... ...o. M.... ....M ....S cCcCcCc ',
      ' ...o. ...o. M.... ..... ....S cCcCcCc ',
      ' ...o. ...o. M.... ..o.. ....S ....... ',
      ' ...o. ...o. ..... ..o.. ....S ....... ',
      ' ...o. ..... ..... ..o.. .....         ',
      ' ..... ........... ..o........         ',
      ' ..@.. ........... ...........         ',
      ' .r.r. ........... ...........         ',
      ' ..r.. ........... ...........         ',
      ' ..... ........... ...........         ',
      '                                       ',
    ],
  },
];
