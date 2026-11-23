// DOORBUSTER — platform.js
// Purpose: the only module that knows about Mindblown. Everything the game needs from the platform
//          (three.js location, tune values, run start/end/pause, saves, leaderboards, player name,
//          sound switch) goes through here, with local substitutes when window.mindblown is absent.
// Exports: loadThree, platform
// Depends on: config.js (applyTune). Browser only.
//
// Platform facts used here (mindblown.ai/sdk.md, read 22 Nov 2026): window.mindblown exists only on
// the platform; run.pause/resume are sent only as a pair; load(key) must precede save(key); tune()
// never rejects; leaderboard metric names are lowercase, start with a letter, 40 characters at most.

import { applyTune } from './config.js';

const HOSTED_THREE = 'https://mindblown.ai/lib/three-0.185.1/three.min.js';
const LOCAL_THREE = 'lib/three.min.js';
const SAVE_KEY = 'progress';
const LOCAL_PREFIX = 'doorbuster_';

// Loads three.js r185 as the global THREE: the platform-hosted bundle on Mindblown, the local copy
// elsewhere (no external request off the platform). Does nothing if a <script> tag already did it.
export function loadThree() {
  if (window.THREE) return Promise.resolve();
  const hosted = /(^|\.)mindblown\.ai$/.test(location.hostname);
  const sources = hosted ? [HOSTED_THREE, LOCAL_THREE] : [LOCAL_THREE];
  return new Promise((resolve, reject) => {
    const tryNext = () => {
      const src = sources.shift();
      if (!src) { reject(new Error('three.js could not be loaded')); return; }
      const tag = document.createElement('script');
      tag.src = src;
      tag.onload = () => resolve();
      tag.onerror = tryNext;
      document.head.appendChild(tag);
    };
    tryNext();
  });
}

function mb() { return window.mindblown; }
function localGet(key) {
  try { return JSON.parse(localStorage.getItem(LOCAL_PREFIX + key)); } catch (e) { return null; }
}
function localSet(key, value) {
  try { localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage may be blocked */ }
}

export const platform = {
  on: false,              // true when running on Mindblown
  username: 'You',
  soundOn: true,
  progress: null,         // the saved object (levels, medals, records, settings)
  paused: false,
  tuneRaw: null,          // tune.json as loaded locally (ranges for the debug sliders)
  tuneListeners: [],
  soundListeners: [],

  // Reads tune values, the sound switch and the saved progress. Never throws.
  async init() {
    const m = mb();
    this.on = !!(m && m.viewer);
    try {
      if (m && m.tune) {
        applyTune(await m.tune());
        m.tune.on((values) => { applyTune(values); this.tuneListeners.forEach((fn) => fn()); });
      } else {
        const res = await fetch('tune.json');
        const raw = await res.json();
        this.tuneRaw = raw;
        const values = {};
        for (const key in raw) values[key] = raw[key].value;
        applyTune(values);
      }
    } catch (e) { /* in-code defaults stay */ }
    if (m && m.sound) {
      this.soundOn = m.sound.on !== false;
      if (m.sound.onchange) m.sound.onchange((on) => { this.soundOn = on; this.soundListeners.forEach((fn) => fn(on)); });
    } else {
      const saved = localGet('sound');
      this.soundOn = saved === null ? true : !!saved;
    }
    if (m && m.viewer && m.viewer.username) this.username = m.viewer.username;
    try {
      if (m && m.load) { const got = await m.load(SAVE_KEY); this.progress = got && got.value; }
      else this.progress = localGet(SAVE_KEY);
    } catch (e) { this.progress = null; }
    if (!this.progress || typeof this.progress !== 'object') this.progress = {};
    return this;
  },

  onTune(fn) { this.tuneListeners.push(fn); },
  onSound(fn) { this.soundListeners.push(fn); },

  // The game's own sound button goes through the platform switch.
  setSound(on) {
    const m = mb();
    this.soundOn = on;
    if (m && m.sound && m.sound.set) m.sound.set(on); else localSet('sound', on);
    this.soundListeners.forEach((fn) => fn(on));
  },

  runStart() { const m = mb(); this.paused = false; if (m && m.run) m.run.start(); },
  runEnd(seconds, level) { const m = mb(); if (m && m.run) m.run.end({ seconds: Math.round(seconds), level }); },
  pause() { const m = mb(); if (!this.paused) { this.paused = true; if (m && m.run) m.run.pause(); } },
  resume() { const m = mb(); if (this.paused) { this.paused = false; if (m && m.run) m.run.resume(); } },

  // Saves the progress object. Called on events (a finish, a setting change), never per frame.
  save() {
    const m = mb();
    // a REVISION_CONFLICT or AUTH_CHANGED refusal: load the key again (the platform's rule), then save once more
    if (m && m.save) m.save(SAVE_KEY, this.progress).catch(() => m.load(SAVE_KEY).then(() => m.save(SAVE_KEY, this.progress)).catch(() => {}));
    else localSet(SAVE_KEY, this.progress);
  },

  // Leaderboards: higher is better. One metric per level ('receipt_l1' ...) and one overall ('receipt_total').
  submit(metric, value, label) {
    const m = mb();
    if (m && m.leaderboard) { m.leaderboard.submit(metric, value, { lower: false, label: String(label).slice(0, 60) }).catch(() => {}); return; }
    const best = localGet('lb_' + metric);
    if (best === null || value > best) localSet('lb_' + metric, value);
  },
  // Resolves to rows { rank, name, value, mine }. Locally the board holds only the player's best.
  async top(metric, limit) {
    const m = mb();
    try {
      if (m && m.leaderboard) {
        const rows = await m.leaderboard.top(metric, { limit: limit || 10 });
        return rows.map((r) => ({ rank: r.rank, name: r.username || 'guest', value: r.value, mine: !!r.mine }));
      }
    } catch (e) { return []; }
    const best = localGet('lb_' + metric);
    return best === null ? [] : [{ rank: 1, name: this.username, value: best, mine: true }];
  },
};
