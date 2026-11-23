// DOORBUSTER level editor — simworker.js
// Purpose: a module worker that drives a level with the game's own bots (src/sim.js), seed by seed, off the page's
//          thread: { def, seeds, bot } in; one message per run { seed, bot, finished, time, receipt, wipeouts, x, y }, then { done }.
// Depends on: ../src/config.js, ../src/sim.js, ../tune.json (the same tune values the game loads locally).

import { applyTune, CFG } from '../src/config.js';
import { createSim, stepSim } from '../src/sim.js';

let tuned = null;
const tune = () => tuned || (tuned = fetch('../tune.json').then((r) => r.json()).then((raw) => {
  const v = {}; for (const k in raw) v[k] = raw[k].value; applyTune(v);
}).catch(() => {}));

self.onmessage = async (e) => {
  const { def, seeds, bot } = e.data;
  await tune();
  for (const seed of seeds) {
    try {
      const sim = createSim(def, seed, { bot, countdown: 0 }), p = sim.player;
      const limit = Math.ceil((sim.timer + 5) / CFG.STEP);
      let steps = 0;
      while (sim.phase !== 'done' && sim.phase !== 'closed' && steps++ < limit) { stepSim(sim); sim.events.length = 0; }
      self.postMessage({ seed, bot, finished: sim.phase === 'done', time: +sim.t.toFixed(2), receipt: p.receipt ? p.receipt.total : 0,
        wipeouts: sim.stats.wipeouts || 0, x: Math.floor(p.x / CFG.TILE), y: Math.floor(p.z / CFG.TILE) });
    } catch (err) { self.postMessage({ seed, bot, error: String(err && err.message || err) }); }
  }
  self.postMessage({ done: true });
};
