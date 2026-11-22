// DOORBUSTER tool — shotsets.mjs
// Capture scenarios for tools/shots.mjs, one set per milestone gate.
// A scenario: name, query (URL parameters), shots (game times in seconds since GO), strip
// ({ from, frames, dt, cols, cell } consecutive frames into one contact sheet), script (timed keys:
// [time, key, value] with key in left/right/gas/brake/drift/dash), viewport [w, h], squint (also a
// 320 px wide copy of the last shot), realtime (seconds of real-time frame-rate sampling after GO),
// room ([cols, rows]: an empty test room built by the tool instead of a level; put = extra plan
// characters in it as [char, tiles ahead of the start, tiles to its right]), until (run on until
// the game reaches a state, then screenshot), full (also record the receipt and key event times), plain (seconds to wait on the untouched page),
// platform (serve as play.mindblown.ai with a recording stand-in for the SDK), setup (page script
// run before the timeline), storage ({ key: value } put in localStorage before the page loads), tap
// ([x, y]: a finger tap on a plain page), video (seconds of real-time recording to a .webm), after (page script
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
    { name: 'rammed', query: l1 + '&autoplay=confident', strip: { around: 'ram<', before: 1.05, frames: 8, dt: 0.16, within: 60 } },   // the warning (0.8 s), the lunge, the hit
    { name: 'smash', room: yard, put: [['P', 12, 0]], script: [[0, 'gas', true], [1.72, 'dash', true]], strip: { from: 1.75, frames: 8, dt: 0.0667 } },
    { name: 'hot', query: l1 + '&autoplay=expert', strip: { around: 'hot', before: 0.3, frames: 8, dt: 0.0833, within: 60 } },
    { name: 'madness', query: l1 + '&autoplay=expert', strip: { around: 'madmode', before: 0.2, frames: 8, dt: 0.25, within: 70 } },
    { name: 'flash', query: l1 + '&autoplay=confident', strip: { around: 'flash', before: 0.1, frames: 8, dt: 0.4, within: 40 } },
    { name: 'strike', room: yard, put: [['g', 12, 0]], script: [[0, 'gas', true], [1.72, 'dash', true]], strip: { from: 1.7, frames: 8, dt: 0.0833 } },
    { name: 'crowd', room: yard, put: [['g', 12, 0]], script: [[0, 'gas', true]], strip: { from: 1.9, frames: 8, dt: 0.1 } },
    // closing time in an ordinary run: the announcement, then the last seconds before the checkout
    { name: 'closing', query: l1 + '&autoplay=beginner', strip: { around: 'closing', before: 0.3, frames: 8, dt: 0.6, within: 70 } },
    { name: 'finale', query: l1 + '&autoplay=beginner', strip: { around: 'finish', before: 3.7, frames: 8, dt: 0.5, within: 75 } },
    { name: 'finale2', query: l1 + '&autoplay=confident', strip: { around: 'finish', before: 3.7, frames: 8, dt: 0.5, within: 75 } },
    { name: 'closed', query: l1, script: [], until: 'closed', wait: 600 },
    { name: 'small', query: l1 + '&autoplay=confident', viewport: [800, 450], shots: [9, 26] },
    { name: 'phone', query: l1 + '&autoplay=confident', viewport: [390, 844], shots: [9, 26] },
    { name: 'realtime', query: l1 + '&autoplay=expert', realtime: 12 },
  ],
  m5: [
    { name: 'l2', query: 'level=2&seed=3&autoplay=expert', shots: [-1, 2, 6, 10, 14, 18, 22, 26, 30, 34, 38], squint: true, until: 'receipt' },
    { name: 'l3', query: 'level=3&seed=3&autoplay=expert', shots: [-1, 2, 6, 10, 14, 18, 22, 26, 30, 33], squint: true, until: 'receipt' },
    { name: 'jump', room: yard, put: [['R', 10, 0], ['F', 13, 0], ['X', 18, 0]], script: [[0, 'gas', true]], strip: { from: 1.75, frames: 8, dt: 0.15 } },
    { name: 'belt', room: yard, put: [['>', 8, 0], ['>', 9, 0], ['>', 10, 0], ['>', 11, 0], ['>', 12, 0], ['<', 8, 2], ['<', 9, 2], ['<', 10, 2], ['~', 15, 0], ['~', 16, 0], ['~', 15, 1], ['~', 16, 1], ['W', 20, 0]],
      script: [[0, 'gas', true], [2.2, 'left', true], [2.5, 'left', false], [2.9, 'dash', true]], shots: [1.6, 2.4, 3.0, 3.4] },
    { name: 'train', query: 'level=3&seed=3&autoplay=beginner', shots: [34, 36, 38, 40, 42] },
    { name: 'flow', query: 'level=1&seed=3&autoplay=expert', until: 'receipt' },
    { name: 'hint_drift', query: 'level=2&seed=3', storage: { doorbuster_progress: '{"seen":{"drive":true,"dash":true},"unlocked":2}' }, script: [[0, 'gas', true]], shots: [2.7] },
    // the checkout: slow motion, goods onto the counter, the receipt printing line by line, the medal
    { name: 'checkout', query: 'level=1&seed=3&autoplay=expert', strip: { around: 'finish', before: 0.2, frames: 8, dt: 0.55, within: 60 } },
    // a person's first seconds: the opening swoop, the key hints (drive, then dash before the pyramid)
    { name: 'hints', query: 'level=1&seed=3', script: [[0, 'gas', true]], shots: [-2.2, -1.2, 0.6, 2.2] },
    { name: 'video', query: 'level=1&seed=3&autoplay=confident', video: 28 },
    // sound: a real click unlocks the audio context; twelve seconds of a bot run, then the state of the synth
    { name: 'audio', query: 'level=1&seed=3&autoplay=confident&debug=1', plain: 0.3, click: [640, 360], wait: 12,
      after: "(() => { const a = window.__db.audio; return { state: a.ctx && a.ctx.state, voices: a.voices, steps: a.step, bpm: +a.bpm.toFixed(1), level: a.level }; })()" },
    { name: 'title', query: 'level=1&seed=3', plain: 1.2 },
    { name: 'cards', query: 'level=2&seed=3', plain: 1.2, storage: { doorbuster_progress: '{"best":{"doors":4321},"medals":{"doors":2},"unlocked":2,"seen":{"drive":true}}' } },
    { name: 'pause', query: 'level=1&seed=3&autoplay=expert', shots: [3], after: "(() => { window.__db.pause(true); return document.querySelector('.screen').className; })()", last: true },
    { name: 'phone', query: 'level=2&seed=3', viewport: [844, 390], touch: true, plain: 1.0, tap: [422, 300], script: [] },
    // the mix, measured: a scripted 24 s of music, continuous noises and every kind of event rendered
    // offline through the game's own audio graph; reports peak, loudness, clipped samples and silent seconds
    { name: 'mix', query: 'level=1&seed=3&debug=1', plain: 0.5, after: `(async () => {
        const d = window.__db, api = d.audioApi, sr = 44100, secs = 24;
        d.pause(true);                                    // the page's own loop stays out of it
        const p = { x: 10, z: 10, id: 0, char: 'player', spd: 11, drift: 0, tier: 0, load: 45, mad: 0, madT: 0 }, rival = { x: 12, z: 12, id: 1, char: 'dad' };
        const sim = { player: p, shoppers: [], t: 30, timer: 72, closing: false, phase: 'run' };
        const ctx = new OfflineAudioContext(2, sr * secs, sr);
        api.unlockAudio(ctx);
        const ev = (type, value, ref, cart) => ({ type, cart: cart || p, value: value || 0, ref });
        const item = { good: 0, entry: { list: 0 } }, big = { good: 13, entry: { list: 1 } }, spot = { x: 10, z: 10 };
        const script = [[1, ev('go')], [1.2, ev('rocket')], [5, ev('stunt', 50, { name: 'cleansweep' })], [5.5, ev('dash')], [5.7, ev('smash', 6, spot)],
          [6.5, ev('drift', 1)], [7, ev('drift', 2)], [7.5, ev('boost', 2)], [8.5, ev('crash', 10, null)], [8.6, ev('spill', 6, { lost: 300 })], [9.5, ev('warn', 0, p, rival)],
          [10, ev('ram', 0, p, rival)], [11, ev('dash')], [11.2, ev('ram', 0, rival)], [11.6, ev('stunt', 200, { name: 'takedown' })], [12.5, ev('hot', 0, spot)],
          [13.5, ev('madmode', 1)], [14, ev('bowl', 1, spot)], [14.1, ev('bowl', 1, spot)], [14.3, ev('stunt', 150, { name: 'strike' })], [15.5, ev('flash')],
          [17, ev('madmode', 0)], [17.5, ev('closing')], [18.5, ev('lanewarn')], [19.5, ev('laneclose')], [20, ev('glass', 0, spot)], [20.5, ev('bonk')], [21, ev('finish', 5000)], [23, ev('timeup')]];
        for (let i = 0; i < 24; i++) script.push([2 + i * 0.11, ev('take', 10, i % 7 === 6 ? big : item)]);
        const cues = [[0.1, 'count'], [0.4, 'count'], [0.7, 'count'], [21.4, 'scan', 0], [21.6, 'scan', 1], [21.8, 'scan', 2], [22, 'scan', 3], [22.2, 'kaching'], [22.5, 'stamp']];
        for (let t = 0.05; t < secs - 0.05; t += 0.05) ctx.suspend(t).then(() => {
          p.drift = t > 6.3 && t < 7.5 ? 1 : 0; p.tier = t > 7 ? 2 : 1; p.mad = Math.min(3.9, t / 3); p.madT = t > 13.5 && t < 17 ? 1 : 0; sim.closing = t > 17.5;
          api.audioFrame(sim, 0.05, t < 21 ? 'play' : 'receipt');
          for (const [at, e] of script) if (at >= t - 0.05 && at < t) api.audioEvent(e, sim);
          for (const [at, name, n] of cues) if (at >= t - 0.05 && at < t) api.audioCue(name, n);
          ctx.resume();
        });
        const buf = await ctx.startRendering();
        let peak = 0, sum = 0, clipped = 0, quiet = 0, loud = 0;
        const a = buf.getChannelData(0);
        for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > peak) peak = v; sum += v * v; if (v >= 0.99) clipped++; }
        for (let s = 0; s < secs; s++) { let m = 0, q = 0; for (let i = s * sr; i < (s + 1) * sr; i++) { m = Math.max(m, Math.abs(a[i])); q += a[i] * a[i]; } if (m < 0.01) quiet++; loud = Math.max(loud, Math.sqrt(q / sr)); }
        return { seconds: secs, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / a.length).toFixed(3), loudestSecondRms: +loud.toFixed(3), clippedSamples: clipped, silentSeconds: quiet, voicesLeft: d.audio.voices };
      })()` },
    // touch input: a finger starts the run, then holds the left pad; the cart must accelerate by itself and steer
    { name: 'touch', query: 'level=1&seed=3&debug=1', viewport: [844, 390], touch: true, plain: 1.0, tap: [422, 300],
      after: `(async () => { const d = window.__db, pad = document.querySelector('.pad.l1');
        pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        const out = { touch: d.game.touch, left: !!d.game.keys.left, steer: +d.game.sim.player.steer.toFixed(2), gas: d.game.sim.player.input.gas, speed: +d.game.sim.player.spd.toFixed(1) };
        pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true }));
        await new Promise((r) => setTimeout(r, 200));
        out.released = !d.game.keys.left; return out; })()` },
  ],
  // The handoff package's media (tools/package.mjs): reference frames with their numbers, cover, card, icon, a recording.
  handoff: [
    { name: 'ref_l1', query: l1 + '&autoplay=expert', shots: [1.2, 6, 20], until: 'receipt', full: true },
    { name: 'ref_l2', query: 'level=2&seed=3&autoplay=expert', shots: [14], until: 'receipt', full: true },
    { name: 'ref_l3', query: 'level=3&seed=3&autoplay=expert', shots: [14], until: 'receipt', full: true },
    { name: 'cover', query: l1 + '&cover=1', viewport: [1200, 675], plain: 1.5 },
    { name: 'card', query: l1 + '&cover=1', viewport: [1000, 1000], plain: 1.5 },
    { name: 'icon', query: l1 + '&icon=1', viewport: [256, 256], plain: 1.5 },
    { name: 'gameplay', query: l1 + '&autoplay=confident', video: 26 },
  ],
  // The single-file build: run with --root dist
  dist: [
    { name: 'dist_bot', query: l1 + '&autoplay=expert', shots: [4], until: 'receipt', wait: 500, full: true },
  ],
};
