// DOORBUSTER — levels.js
// Purpose: level data. A level is a tile plan (see the legend in world.js) plus a few annotations.
//          Nothing here is code: world.js derives walls, colliders, shelves and navigation from it.
// Exports: LEVELS
// Depends on: nothing.
//
// Fields: id, name, timer (seconds), heading (start direction, radians; 0 = +z/south, PI/2 = +x/east,
//         PI = north, -PI/2 = west), rivals (character ids), crowd (shoppers), list (three goods ids
//         for plan characters 1 2 3), zones (first entry is the default; others paint a rect of tiles
//         [col0, row0, col1, row1] with a goods pool and an accent colour), plan (rows of tiles).

export const LEVELS = [
  {
    id: 'hall', name: 'TEST HALL', timer: 60, heading: Math.PI / 2, rivals: [], crowd: 0, list: [],
    zones: [{ pool: 'market', color: 0, name: 'TEST HALL' }],
    plan: [
      '                                        ',
      ' ...................................... ',
      ' .SSSSSSSSSS....................cCcCc.. ',
      ' ...............................cCcCc.. ',
      ' ...................................... ',
      ' ......MMMMMM.......O...O...O.......... ',
      ' ...................................... ',
      ' ...................................... ',
      ' ..........      ...................... ',
      ' ..........      .........LLLL......... ',
      ' ...................................... ',
      ' ...................................... ',
      ' ....SS................................ ',
      ' ....SS........o.o.o.o.o............... ',
      ' ...................................... ',
      ' .@.................................... ',
      ' ...................................... ',
      '                                        ',
    ],
  },
];
