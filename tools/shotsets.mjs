// DOORBUSTER tool — shotsets.mjs
// Capture scenarios for tools/shots.mjs, one set per milestone gate.
// A scenario: name, query (URL parameters), shots (game times in seconds since GO), strip
// ({ from, frames, dt, cols, cell } consecutive frames into one contact sheet), script (timed keys:
// [time, key, value] with key in left/right/gas/brake/drift/dash), viewport [w, h], squint (also a
// 320 px wide copy of the last shot), realtime (seconds of real-time frame-rate sampling).

const hall = 'level=0&seed=1';

export const SETS = {
  m0: [
    { name: 'hall_bot', query: hall + '&autoplay=expert', shots: [-2, 0.5, 2, 3.5, 5], strip: { from: 1.0, frames: 8, dt: 0.0667 }, squint: true },
    { name: 'hall_keys', query: hall, script: [[0, 'gas', true], [1.2, 'left', true], [1.9, 'left', false], [2.4, 'dash', true]], shots: [1.0, 1.8, 2.6] },
    { name: 'hall_small', query: hall + '&autoplay=confident', viewport: [800, 450], shots: [2] },
    { name: 'hall_phone', query: hall + '&autoplay=confident', viewport: [390, 844], shots: [2] },
    { name: 'hall_debug', query: hall + '&autoplay=expert&debug=1', shots: [1.5] },
    { name: 'hall_realtime', query: hall + '&autoplay=beginner', realtime: 4 },
  ],
  m1: [
    { name: 'drift_in', query: hall, script: [[0, 'gas', true], [1.6, 'left', true], [1.65, 'drift', true], [3.9, 'drift', false], [3.9, 'left', false]],
      shots: [2.3, 3.0, 3.7], strip: { from: 1.55, frames: 8, dt: 0.0833 } },
    { name: 'drift_out', query: hall, script: [[0, 'gas', true], [1.6, 'left', true], [1.65, 'drift', true], [3.9, 'drift', false], [3.9, 'left', false]],
      shots: [4.2], strip: { from: 3.8, frames: 8, dt: 0.0833 } },
    { name: 'dash', query: hall, script: [[0, 'gas', true], [2.0, 'dash', true]], shots: [2.1], strip: { from: 1.95, frames: 8, dt: 0.05 } },
    { name: 'wall_slide', query: hall, script: [[0, 'gas', true], [1.2, 'right', true], [1.5, 'right', false]], shots: [2.4], strip: { from: 1.6, frames: 8, dt: 0.1 } },
    { name: 'crash', query: hall, script: [[0, 'gas', true], [1.0, 'right', true], [1.95, 'right', false]], shots: [2.6], strip: { from: 1.9, frames: 8, dt: 0.0667 } },
    { name: 'cam_wall', query: hall, script: [[0, 'gas', true], [0.9, 'right', true], [1.15, 'right', false], [1.5, 'left', true], [1.75, 'left', false], [2.6, 'left', true], [3.5, 'left', false]],
      shots: [2.5, 3.6, 4.0], strip: { from: 3.1, frames: 8, dt: 0.1 } },
    { name: 'bot_expert', query: hall + '&autoplay=expert', shots: [0.3, 1.5, 3, 4.5], squint: true },
    { name: 'heavy', query: hall + '&load=30', script: [[0, 'gas', true], [2.5, 'left', true], [3.4, 'left', false]], shots: [2.4, 3.3] },
    { name: 'small', query: hall + '&autoplay=confident', viewport: [800, 450], shots: [3] },
    { name: 'phone', query: hall + '&autoplay=confident', viewport: [390, 844], shots: [3] },
    { name: 'realtime', query: hall + '&autoplay=expert', realtime: 4 },
  ],
  // The single-file build: run with --root dist
  dist: [
    { name: 'dist_bot', query: hall + '&autoplay=expert', shots: [2] },
  ],
};
