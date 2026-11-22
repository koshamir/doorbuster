// DOORBUSTER tool — shotsets.mjs
// Capture scenarios for tools/shots.mjs, one set per milestone gate.
// A scenario: name, query (URL parameters), shots (game times in seconds since GO), strip
// ({ from, frames, dt, cols, cell } consecutive frames into one contact sheet), script (timed keys:
// [time, key, value] with key in left/right/gas/brake/drift/dash), viewport [w, h], squint (also a
// 320 px wide copy of the last shot), realtime (seconds of real-time frame-rate sampling after GO),
// room ([cols, rows]: an empty test room built by the tool instead of a level; put = extra plan
// characters in it as [char, tiles ahead of the start, tiles to its right]), until (run on until
// the game reaches a state, then screenshot), plain (seconds to wait on the untouched page),
// platform (serve as play.mindblown.ai with a recording stand-in for the SDK), setup (page script
// run before the timeline), after (page script
// whose result is added to the summary). strip.around = 'crash' centres the strip on that event of
// the player's cart (strip.before seconds earlier; the scenario is played once first to find it);
// 'ram<' is the same event done to the player by someone else.

const l0 = 'level=0&seed=1';
const l1 = 'level=1&seed=3';
const yard = [70, 50];                       // 140 x 100 m of empty floor for free driving
const DRIFT = [[0, 'gas', true], [1.6, 'left', true], [1.65, 'drift', true], [3.9, 'drift', false], [3.9, 'left', false]];

export const SETS = {
  m0: [
    { name: 'gauntlet_bot', query: l0 + '&autoplay=expert', shots: [-2, 1, 4, 8, 12, 16, 20], strip: { from: 6.0, frames: 8, dt: 0.0667 }, squint: true },
    { name: 'gauntlet_keys', query: l0, script: [[0, 'gas', true], [1.0, 'left', true], [1.5, 'left', false], [2.0, 'dash', true]], shots: [0.9, 1.6, 2.2] },
    { name: 'small', query: l0 + '&autoplay=confident', viewport: [800, 450], shots: [5] },
    { name: 'phone', query: l0 + '&autoplay=confident', viewport: [390, 844], shots: [5] },
    { name: 'debug', query: l0 + '&autoplay=expert&debug=1', shots: [5] },
    { name: 'realtime', query: l0 + '&autoplay=expert', realtime: 8 },
    { name: 'platform', query: l1 + '&autoplay=expert', platform: true, until: 'receipt', wait: 500 },
  ],
  m1: [
    { name: 'drift_in', room: yard, script: DRIFT, shots: [2.3, 3.0, 3.7], strip: { from: 1.55, frames: 8, dt: 0.0833 } },
    { name: 'drift_out', room: yard, script: DRIFT, shots: [4.2], strip: { from: 3.8, frames: 8, dt: 0.0833 } },
    { name: 'turn', room: yard, script: [[0, 'gas', true], [1.6, 'left', true], [2.6, 'left', false]], shots: [2.0], strip: { from: 1.55, frames: 8, dt: 0.0667 } },
    { name: 'dash', room: yard, script: [[0, 'gas', true], [2.0, 'dash', true]], shots: [2.1], strip: { from: 1.95, frames: 8, dt: 0.05 } },
    { name: 'wall_slide', query: l0, script: [[0, 'gas', true], [0.9, 'right', true], [1.2, 'right', false]], shots: [2.0], strip: { from: 1.4, frames: 8, dt: 0.1 } },
    { name: 'crash', query: l0, script: [[0, 'gas', true], [0.8, 'right', true], [1.75, 'right', false]], strip: { around: 'crash', before: 0.2, frames: 8, dt: 0.0667 } },
    { name: 'oversteer', query: l0, script: [[0, 'gas', true], [0.7, 'left', true]], strip: { around: 'crash', before: 0.25, frames: 8, dt: 0.0833, within: 5 } },
    { name: 'cam_lift', room: yard, script: [[0, 'brake', true], [1.3, 'brake', false]], shots: [0.2, 1.6] },
    { name: 'gauntlet', query: l0 + '&autoplay=expert', shots: [3, 6, 9, 13, 17, 21], strip: { from: 9.5, frames: 8, dt: 0.1 }, squint: true },
    { name: 'heavy', room: yard, query: 'fill=30', script: [[0, 'gas', true], [2.5, 'left', true], [3.4, 'left', false]], shots: [2.4, 3.3] },
    { name: 'small', query: l0 + '&autoplay=confident', viewport: [800, 450], shots: [7] },
    { name: 'phone', query: l0 + '&autoplay=confident', viewport: [390, 844], shots: [7] },
    { name: 'realtime', query: l0 + '&autoplay=expert', realtime: 8 },
  ],
  m2: [
    { name: 'title', query: l1, plain: 1.2 },
    { name: 'expert', query: l1 + '&autoplay=expert', shots: [-1.5, 0.4, 2.5, 6, 12, 20, 30], strip: { from: 2.0, frames: 8, dt: 0.0667 }, squint: true, until: 'receipt' },
    { name: 'beginner', query: l1 + '&autoplay=beginner', shots: [4, 14, 26, 40], strip: { from: 3.2, frames: 8, dt: 0.0833 }, until: 'receipt' },
    { name: 'spill', query: l1 + '&fill=26', script: [[0, 'gas', true], [1.0, 'left', true], [1.95, 'left', false]], shots: [0.8, 2.6, 4.5], strip: { from: 2.1, frames: 8, dt: 0.0667 } },
    { name: 'heavy_turn', query: l1 + '&fill=40', script: [[0, 'gas', true], [1.6, 'right', true], [1.9, 'right', false], [2.3, 'left', true], [2.7, 'left', false]], shots: [1.5, 2.2, 2.9], strip: { from: 1.6, frames: 8, dt: 0.1 } },
    { name: 'closed', query: l1, script: [], until: 'closed', wait: 600 },
    // restart cost: milliseconds to rebuild the level (the countdown after a restart is 1.2 s), and heap after 20 restarts
    { name: 'restart', query: l1 + '&autoplay=expert', shots: [3],
      after: `(() => { const d = window.__db, m = performance.memory, h0 = m ? m.usedJSHeapSize : 0, t0 = performance.now();
        d.play(true); const one = performance.now() - t0;
        for (let i = 0; i < 20; i++) { d.play(true); d.advance(2); }
        return { rebuildMs: +one.toFixed(1), countdownS: -d.game.sim.t + 2, heapGrowthMB: m ? +((m.usedJSHeapSize - h0) / 1048576).toFixed(1) : null }; })()` },
    { name: 'small', query: l1 + '&autoplay=confident', viewport: [800, 450], shots: [6] },
    { name: 'phone', query: l1 + '&autoplay=confident', viewport: [390, 844], shots: [6] },
    { name: 'realtime', query: l1 + '&autoplay=expert', realtime: 8 },
  ],
  m3: [
    { name: 'title', query: l1, plain: 1.2 },
    { name: 'run', query: l1 + '&autoplay=expert', shots: [-1.2, 1, 5, 9, 13, 17, 21, 25, 29, 33, 37], squint: true, until: 'receipt' },
    { name: 'sweep', query: l1 + '&autoplay=expert', strip: { from: 2.0, frames: 8, dt: 0.0667 } },
    { name: 'tower', query: l1 + '&fill=40', script: [[0, 'gas', true], [1.6, 'right', true], [1.9, 'right', false], [2.3, 'left', true], [2.7, 'left', false]], shots: [2.2], strip: { from: 1.6, frames: 8, dt: 0.1 } },
    { name: 'spill', query: l1 + '&fill=26', script: [[0, 'gas', true], [1.0, 'left', true], [1.95, 'left', false]], strip: { around: 'crash', before: 0.2, frames: 8, dt: 0.0833 } },
    { name: 'drift', room: yard, script: DRIFT, shots: [2.4, 3.2], strip: { from: 2.0, frames: 8, dt: 0.1 } },
    { name: 'beginner', query: l1 + '&autoplay=beginner', shots: [8, 20, 32, 44], squint: true },
    { name: 'small', query: l1 + '&autoplay=confident', viewport: [800, 450], shots: [9] },
    { name: 'phone', query: l1 + '&autoplay=confident', viewport: [390, 844], shots: [9] },
    { name: 'realtime', query: l1 + '&autoplay=expert', realtime: 10 },
  ],
  m4: [
    { name: 'title', query: l1, plain: 1.2 },
    { name: 'start', query: l1 + '&autoplay=confident', shots: [-1.5, 0.3, 1.2, 2.5, 4], strip: { from: -0.1, frames: 8, dt: 0.12 }, squint: true },
    { name: 'run', query: l1 + '&autoplay=confident', shots: [7, 11, 15, 19, 23, 27, 31, 35, 39, 43], squint: true, until: 'receipt' },
    { name: 'ram', query: l1 + '&autoplay=expert', strip: { around: 'ram', before: 0.25, frames: 8, dt: 0.0667, within: 50 } },
    { name: 'rammed', query: l1 + '&autoplay=confident', strip: { around: 'ram<', before: 0.7, frames: 8, dt: 0.1, within: 50 } },
    { name: 'smash', room: yard, put: [['P', 12, 0]], script: [[0, 'gas', true], [1.72, 'dash', true]], strip: { from: 1.75, frames: 8, dt: 0.0667 } },
    { name: 'hot', query: l1 + '&autoplay=expert', strip: { around: 'hot', before: 0.3, frames: 8, dt: 0.0833, within: 60 } },
    { name: 'madness', query: l1 + '&autoplay=expert', strip: { around: 'madmode', before: 0.2, frames: 8, dt: 0.25, within: 70 } },
    { name: 'flash', query: l1 + '&autoplay=confident', strip: { around: 'flash', before: 0.1, frames: 8, dt: 0.4, within: 40 } },
    { name: 'strike', room: yard, put: [['g', 12, 0]], script: [[0, 'gas', true], [1.72, 'dash', true]], strip: { from: 1.7, frames: 8, dt: 0.0833 } },
    { name: 'crowd', room: yard, put: [['g', 12, 0]], script: [[0, 'gas', true]], strip: { from: 1.9, frames: 8, dt: 0.1 } },
    // closing time with the beginner still on the road: the same run with the doors closing 20 s sooner
    { name: 'closing', query: l1 + '&autoplay=beginner', setup: 'window.__db.game.sim.timer = 52', shots: [36, 38, 42, 46, 49], strip: { from: 46.5, frames: 8, dt: 0.5 } },
    { name: 'closed', query: l1, script: [], until: 'closed', wait: 600 },
    { name: 'small', query: l1 + '&autoplay=confident', viewport: [800, 450], shots: [9, 26] },
    { name: 'phone', query: l1 + '&autoplay=confident', viewport: [390, 844], shots: [9, 26] },
    { name: 'realtime', query: l1 + '&autoplay=expert', realtime: 12 },
  ],
  // The single-file build: run with --root dist
  dist: [
    { name: 'dist_bot', query: l1 + '&autoplay=expert', shots: [4], until: 'receipt', wait: 500 },
  ],
};
