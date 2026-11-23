// DOORBUSTER — levels.js
// Purpose: level data. A level is a tile plan (see the legend in world.js) plus a few annotations.
//          Nothing here is code: world.js derives walls, colliders, shelves and navigation from it.
// Exports: LEVELS
// Depends on: nothing.
//
// Fields: id, name, medals (receipts for silver, gold and the hidden Black Card; bronze is any finish), timer (seconds),
//         closing (seconds over which the checkouts shut once CLOSING TIME has begun, 15 unless given), closeAt (CLOSING TIME begins when the
//         first cart is this many metres from the checkouts, 90 unless given), rivalEdge (how fast rivals build their multiplier, 1 unless given), marks (test only: [name, col, row] after each obstacle), heading (start direction, radians; 0 = +z/south, PI/2 = +x/east,
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
    // 1. PRICE PANIC (supermarket, RUSH; LEVELS.md section 5). From the doors north under the first swinging sign
    // (a snack trail under its arc, the safe line beside it bare), through the produce hall's pop-up tiles (or the
    // slow zigzag round them), east along the fish counter on the conveyor to the bell button that raises the deli
    // shutter (the cheese wheel waits by it behind a ribbon), south down freezer alley between two signs out of
    // phase (Granny Tank is in there), into the one open checkout with a boost.
    id: 'price', name: 'PRICE PANIC', mode: 'rush', kit: 'supermarket', v3: true, timer: 60, author: 27, heading: Math.PI,
    rivals: ['granny', 'dad'], crowd: 12, rush: 6, maxRams: 2, hotGood: 'console', medals: [0, 0, 0], firstFail: { granny: 'tiles' },
    zones: [{ pool: 'market', color: 0, name: 'PRICE PANIC' }],
    objects: [
      ['sign', 6, 27, { across: 'x', period: 3.0, amp: 40 }],
      ['tiles', 5, 10, { cols: 3, rows: 4, period: 2.0, pattern: 'cols' }],
      ['cp', 13, 3, { across: 'z', w: 5 }],
      ['button', 36, 2, { opens: ['deli'] }],
      ['gate', 41, 6, { id: 'deli', c1: 44, r1: 6, style: 'shutter' }],
      ['sign', 42.5, 13.5, { across: 'x', period: 2.6, phase: 0 }],
      ['sign', 42.5, 20.5, { across: 'x', period: 2.6, phase: 0.5 }],
      ['cp', 42.5, 28, { across: 'x', w: 4 }],
      ['boost', 22, 39, { r1: 40, dir: 's' }],
    ],
    plan: [
      '                                                ',
      '             .LLLLL.LLLLL.LLLLL.LLLL..........  ',
      '             ..>>o>>>>o>>>>o>>>>o>>>..........  ',
      ' .............................P...............  ',
      ' ......................P................H.....  ',
      ' .............................................  ',
      ' ...........                             ....   ',
      ' ...........                             ....   ',
      ' ...........                             L..L   ',
      ' ........                                L..L   ',
      ' .. M...M                                L..L   ',
      ' .. M...M                                L..L   ',
      ' .. M...M                                L..L   ',
      ' .. M...M                                ....   ',
      ' ........                                ....   ',
      ' .p.........                             L..L   ',
      ' ...........                             L..L   ',
      ' .....G.....                             L..L   ',
      ' .........O.                             L..L   ',
      ' ...........                             L..L   ',
      '  .........                              ....   ',
      '  .........                              ....   ',
      '  ........K                              L..L   ',
      '  ....o....                              L..L   ',
      '  G........                              L..L   ',
      '  ....o....                              L..L   ',
      '  .........                              L..L   ',
      '  ....o....                              ....   ',
      '  .........                              ....   ',
      '  ....o...G                              ....   ',
      '  .........                              ....   ',
      '  ..r......       ...........................   ',
      '  .........       ..p...............O........   ',
      '  ....o....       ............SSS...P........   ',
      '  p........       ......SSS......~~..........   ',
      '  ....o....       ..........P..G...........p.   ',
      '  .........       ...........................   ',
      '  ....o....       .........K...                 ',
      '  ........p       .............                 ',
      '  ....o....       .............                 ',
      '  .........       .............                 ',
      '  p........       kCkCcCkC                      ',
      '  .........       kCkCcCkC                      ',
      '  ..r.@....                                     ',
      '  .........                                     ',
      '  .........                                     ',
      '                                                ',
    ],
  },
];
