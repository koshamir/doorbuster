// DOORBUSTER — audio.js
// Purpose: every sound in the game, synthesized with WebAudio (no audio files): the effects for
//          simulation events, three-layer impacts, gibberish voices, the cart's own noises (drift
//          screech, rolling, a heavy cart's squeak), crowd murmur, the announcer's chime, and the funk
//          loop whose layers follow the Madness meter and whose tempo rises at closing time.
// Exports: audio, unlockAudio, setSound, setVolumes, audioEvent, audioCue, audioFrame
// Depends on: config.js. Browser only; nothing sounds before unlockAudio() (the player's first action).
//
// Routing: voices -> effects bus or music bus (the music bus runs through one filter, the "wah" of
// MADNESS mode) -> master gain -> a compressor used as a limiter -> output. Envelopes start from zero
// with a short ramp and end on an exponential tail, so nothing clicks; the limiter keeps a pile-up of
// effects from clipping.

import { TUNE, GOODS } from './config.js';

export const audio = { ctx: null, on: true, vMusic: 0.55, vSfx: 0.9, master: null, music: null, sfx: null, wah: null, noise: null,
  voices: 0, last: {}, chain: 0, chainT: 0, step: 0, nextT: 0, bpm: 100, level: 0, loops: null, squeak: 0 };
const A = audio;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Called from the first key press or click: browsers only let sound start from a user's action.
// offline (optional) is an OfflineAudioContext to build the same graph on: the sound test renders a
// scripted run through it and measures peaks and clicks (tools/shotsets.mjs, scenario "mix").
export function unlockAudio(offline) {
  if (A.ctx && !offline) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = A.ctx = offline || new AC(), lim = c.createDynamicsCompressor();
  lim.threshold.value = -14; lim.knee.value = 8; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
  A.master = c.createGain(); A.master.gain.value = A.on ? 0.9 : 0;
  A.master.connect(lim);
  if (offline) { const two = c.createChannelMerger(2); lim.connect(two, 0, 0); A.master.connect(two, 0, 1); two.connect(c.destination); }   // right channel: before the limiter
  else lim.connect(c.destination);
  A.sfx = c.createGain(); A.sfx.gain.value = A.vSfx; A.sfx.connect(A.master);
  A.wah = c.createBiquadFilter(); A.wah.type = 'lowpass'; A.wah.frequency.value = 18000; A.wah.connect(A.master);
  A.music = c.createGain(); A.music.gain.value = A.vMusic; A.music.connect(A.wah);
  A.noise = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
  const d = A.noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Five noises that run all the time and are only turned up and down: drift screech, rolling, crowd
  // murmur, the cart train's rattle, a travelator's whirr.
  const loop = (type, f, q) => {
    const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = A.noise; src.loop = true; flt.type = type; flt.frequency.value = f; flt.Q.value = q; g.gain.value = 0;
    src.connect(flt); flt.connect(g); g.connect(A.sfx); src.start();
    return { f: flt.frequency, g: g.gain };
  };
  A.loops = { screech: loop('bandpass', 2600, 7), roll: loop('lowpass', 400, 0.7), murmur: loop('bandpass', 420, 0.9),
    train: loop('bandpass', 170, 1.6), belt: loop('bandpass', 720, 9) };
  A.nextT = c.currentTime + 0.1;
}
export function setSound(on) {
  A.on = on;
  if (A.ctx) A.master.gain.setTargetAtTime(on ? 0.9 : 0, A.ctx.currentTime, 0.03);
}
export function setVolumes(music, sfx) {
  A.vMusic = music; A.vSfx = sfx;
  if (A.ctx) { A.music.gain.setTargetAtTime(music, A.ctx.currentTime, 0.05); A.sfx.gain.setTargetAtTime(sfx, A.ctx.currentTime, 0.05); }
}

// ---- Two building blocks: a pitched voice and a filtered noise burst --------------------------------
// f1 (optional) is the pitch at the end of the note. Returns nothing; voices are counted so a pile-up
// cannot start hundreds of them.
function tone(bus, type, f0, f1, t, dur, vol, attack) {
  if (A.voices > 56) return;
  const c = A.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  A.voices++; o.onended = () => { A.voices--; };
}
function hiss(bus, type, f0, f1, q, t, dur, vol, attack) {
  if (A.voices > 56) return;
  const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  A.voices++; s.onended = () => { A.voices--; };
}
// True at most once per `gap` seconds for a given key (keeps repeated events from machine-gunning).
function soon(key, gap) {
  const t = A.ctx.currentTime;
  if (t - (A.last[key] || -99) < gap) return false;
  A.last[key] = t;
  return true;
}

// Layers shared by several effects.
function click(t, vol) { hiss(A.sfx, 'highpass', 4000, 0, 0.7, t, 0.03, vol || 0.5); }
function boom(t, vol, f) { tone(A.sfx, 'sine', f || 150, 42, t, 0.28, vol || 0.9); hiss(A.sfx, 'lowpass', 900, 200, 0.7, t, 0.2, (vol || 0.9) * 0.6); }
function clang(t, n, vol) {              // cans and metal: a few inharmonic pings
  for (let i = 0; i < n; i++) { const f = 900 + Math.random() * 2600; tone(A.sfx, 'square', f, f * 0.98, t + i * 0.035 + Math.random() * 0.02, 0.16, (vol || 0.12) * (1 - i / (n + 2))); }
}
function arp(t, notes, type, vol, gap, dur) { notes.forEach((m, i) => tone(A.sfx, type || 'triangle', hz(m), 0, t + i * (gap || 0.06), dur || 0.16, vol || 0.3)); }
function whoosh(t, f0, f1, dur, vol) { hiss(A.sfx, 'bandpass', f0, f1, 1.2, t, dur, vol || 0.35, dur * 0.3); }

// A short gibberish exclamation: two or three syllables of a buzzy voice through a moving formant.
// Each character speaks at most once every 8 s (force = true skips that for the hero's "ow!").
const VOX = { player: 330, granny: 215, dad: 150, queen: 290, selfie: 390, bro: 120 };
function voice(char, up, force) {
  if (!force && !soon('v' + char, 8)) return;
  const c = A.ctx, t = A.ctx.currentTime + 0.02, base = VOX[char] || 260, n = 2 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    if (A.voices > 56) return;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), t0 = t + i * 0.1, d = 0.085;
    const p = base * (1 + (up ? 0.12 : -0.08) * i + (Math.random() - 0.5) * 0.1);
    o.type = char === 'queen' ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(p, t0); o.frequency.linearRampToValueAtTime(p * (up ? 1.25 : 0.8), t0 + d);
    f.type = 'bandpass'; f.Q.value = 4; f.frequency.setValueAtTime(i % 2 ? 1500 : 800, t0); f.frequency.linearRampToValueAtTime(i % 2 ? 700 : 1700, t0 + d);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0006, t0 + d + 0.03);
    o.connect(f); f.connect(g); g.connect(A.sfx); o.start(t0); o.stop(t0 + d + 0.06);
    A.voices++; o.onended = () => { A.voices--; };
  }
}

// ---- The cast's voices (DESIGN.md section 7) ----------------------------------------------------------------
// A line is spoken as gibberish syllables in the character's own pitch, wave and pace, shaped by the mood (angry is
// low and fast, shocked rises, happy bounces, sad falls). If assets/voice/voices.json lists a file <id>_<n>.mp3,
// that file plays instead. The music ducks by 3 dB under a voice.
const VOICE = { penny: [330, 'triangle', 1.1], granny: [225, 'sawtooth', 0.85], sprintdad: [140, 'sawtooth', 1.05], coupon: [300, 'square', 1.15],
  selfie: [410, 'triangle', 1.2], bubba: [100, 'sawtooth', 0.8], gramps: [180, 'square', 0.95] };
export function loadVoices() {
  try { fetch('assets/voice/voices.json').then((r) => (r.ok ? r.json() : [])).then((list) => { A.voiceFiles = new Set((list || []).map((n) => String(n).replace(/\.mp3$/, ''))); }).catch(() => {}); } catch (e) { /* no voices */ }
}
export function say(who, n, text, mood, vol = 1) {
  if (!A.ctx || !A.on) return;
  const t = A.ctx.currentTime + 0.02, name = who + '_' + n;
  let len;
  if (A.voiceFiles && A.voiceFiles.has(name)) {
    const a = new Audio('assets/voice/' + name + '.mp3'); a.volume = Math.min(1, A.vSfx * vol); a.play().catch(() => {});
    len = 1.4;
  } else {
    const v = VOICE[who] || [190 + (who.length * 37) % 170, 'triangle', 1], syl = Math.max(2, Math.min(7, Math.round(text.length / 4)));
    const d = (mood === 'angry' ? 0.07 : 0.095) / v[2];
    for (let i = 0; i < syl; i++) {
      if (A.voices > 56) break;
      const k = mood === 'shocked' ? 1 + i * 0.07 : mood === 'happy' ? 1 + (i % 2 ? 0.12 : -0.04) : mood === 'sad' ? 1 - i * 0.05 : mood === 'angry' ? 0.86 + (i % 2) * 0.05 : 1;
      const o = A.ctx.createOscillator(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain(), t0 = t + i * (d + 0.02), p = v[0] * k;
      o.type = v[1]; o.frequency.setValueAtTime(p, t0); o.frequency.linearRampToValueAtTime(p * (mood === 'shocked' ? 1.3 : 0.92), t0 + d);
      f.type = 'bandpass'; f.Q.value = 5; f.frequency.setValueAtTime([700, 1200, 1900, 900][i % 4], t0); f.frequency.linearRampToValueAtTime([1500, 800, 1200, 1700][i % 4], t0 + d);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.55 * vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0006, t0 + d + 0.03);
      o.connect(f); f.connect(g); g.connect(A.sfx); o.start(t0); o.stop(t0 + d + 0.06);
      A.voices++; o.onended = () => { A.voices--; };
    }
    len = syl * (d + 0.02) + 0.1;
  }
  if (A.music) { const m = A.music.gain; m.cancelScheduledValues(t); m.setTargetAtTime(A.vMusic * 0.71, t, 0.03); m.setTargetAtTime(A.vMusic, t + len, 0.15); }
}

// ---- Effects for simulation events (same names as in sim.js). mine = the event is the player's. ----
export function audioEvent(e, sim) {
  if (!A.ctx || !A.on) return;
  const t = A.ctx.currentTime, p = sim.player, k = e.cart, mine = k === p, hit = e.ref === p;
  // Things far from the player are not heard.
  if (k && !mine && !hit && Math.hypot(k.x - p.x, k.z - p.z) > 26) return;
  const far = mine || hit ? 1 : 0.45;
  switch (e.type) {
    case 'take': {
      if (!mine) { if (soon('rtake', 0.12)) tone(A.sfx, 'sine', 520, 0, t, 0.05, 0.05); break; }
      // The pop climbs a pentatonic scale with every item of a chain (two octaves at most) and starts
      // again after a pause; a burst of takes is one pop per 45 ms.
      if (!soon('take', 0.045)) break;
      A.chain = t - A.chainT < 0.75 ? Math.min(A.chain + 1, 9) : 0; A.chainT = t;
      const m = 67 + [0, 2, 4, 7, 9][A.chain % 5] + 12 * Math.floor(A.chain / 5), size = GOODS[e.ref.good].size;
      tone(A.sfx, 'triangle', hz(m), hz(m + 5), t, 0.09, 0.34);
      if (size === 'L' || size === 'H') tone(A.sfx, 'sine', hz(m - 12), 0, t, 0.16, 0.3);
      if (e.ref.entry.list) arp(t + 0.03, [84, 88, 91], 'sine', 0.2, 0.05, 0.25);
      break;
    }
    case 'stunt': {
      if (!mine) break;
      const n = e.ref.name;
      if (n === 'cleansweep') arp(t, [72, 76, 79, 84], 'triangle', 0.3, 0.055, 0.2);
      else if (n === 'strike') { boom(t, 0.8, 110); clang(t + 0.02, 9, 0.16); arp(t + 0.15, [72, 76, 79, 84, 88], 'square', 0.16, 0.06, 0.22); }
      else if (n === 'takedown') { boom(t, 1, 90); arp(t + 0.1, [60, 67, 72, 79], 'square', 0.18, 0.07, 0.25); }
      else if (n === 'shave') { whoosh(t, 900, 3600, 0.16, 0.25); tone(A.sfx, 'sine', hz(88), 0, t + 0.1, 0.2, 0.22); }
      else if (n === 'jump') arp(t, [72, 79, 84, 91], 'triangle', 0.3, 0.08, 0.3);
      else if (n === 'dodge') { whoosh(t, 700, 3200, 0.2, 0.3); arp(t + 0.08, [79, 86], 'triangle', 0.2, 0.07, 0.2); }
      break;
    }
    case 'dash': whoosh(t, 500, 4200, 0.22, 0.4 * far); tone(A.sfx, 'sine', 110, 60, t, 0.12, 0.5 * far); break;
    case 'dashready': if (mine) tone(A.sfx, 'sine', hz(93), 0, t, 0.06, 0.1); break;
    case 'boost': if (mine) { tone(A.sfx, 'sawtooth', 160, 640 + e.value * 220, t, 0.32, 0.2); whoosh(t, 700, 5000, 0.4, 0.3); } break;
    case 'rocket': if (mine) { boom(t, 0.7, 130); whoosh(t, 400, 6000, 0.5, 0.45); arp(t, [64, 71, 76], 'square', 0.14, 0.05, 0.2); } break;
    case 'drift': if (mine && e.value > 0) arp(t, [76 + e.value * 3, 83 + e.value * 3], 'triangle', 0.22, 0.04, 0.14); break;
    case 'crash': click(t, 0.6 * far); boom(t, far); clang(t + 0.03, 5, 0.14 * far); if (mine) voice('player', false, true); else voice(k.char, false); break;
    case 'bump': if (soon('bump' + k.id, 0.12)) { tone(A.sfx, 'sine', 130, 70, t, 0.09, Math.min(0.5, e.value * 0.06) * far); click(t, 0.15 * far); } break;
    case 'scrape': if (mine && soon('scrape', 0.07)) hiss(A.sfx, 'bandpass', 2800 + Math.random() * 1200, 0, 5, t, 0.06, 0.1); break;
    case 'cartbump': if (soon('cb', 0.1)) { tone(A.sfx, 'sine', 170, 80, t, 0.1, 0.4 * far); clang(t, 2, 0.08 * far); } break;
    case 'knock': if (soon('knock', 0.06)) { tone(A.sfx, 'triangle', 240, 120, t, 0.1, 0.3 * far); click(t, 0.2 * far); } break;
    case 'ram': click(t, 0.7); boom(t, 1, 170); clang(t + 0.02, 6, 0.15); hiss(A.sfx, 'highpass', 5000, 0, 0.7, t, 0.3, 0.2);
      voice(hit ? 'player' : e.ref.char, true, hit); break;
    case 'bonk': tone(A.sfx, 'sine', 420, 160, t, 0.25, 0.5 * far); tone(A.sfx, 'sine', 630, 240, t, 0.25, 0.2 * far); break;
    case 'smash': click(t, 0.5); boom(t, 0.7 * far, 200); clang(t + 0.02, 10, 0.17 * far); break;
    case 'hot': if (mine) { hiss(A.sfx, 'highpass', 3000, 0, 0.7, t, 0.1, 0.3); arp(t + 0.04, [72, 76, 79, 83, 88, 91], 'triangle', 0.28, 0.05, 0.3); } break;
    case 'glass': hiss(A.sfx, 'highpass', 4500, 9000, 0.7, t, 0.5, 0.5 * far); clang(t, 12, 0.12 * far); break;
    case 'bowl': if (soon('bowl', 0.07)) { tone(A.sfx, 'sine', 190, 90, t, 0.08, 0.3 * far); tone(A.sfx, 'square', 500 + Math.random() * 500, 900 + Math.random() * 400, t + 0.02, 0.09, 0.07 * far); } break;
    case 'spill': if (mine) { arp(t, [79, 76, 72, 67, 64], 'triangle', 0.22, 0.045, 0.12); clang(t + 0.05, 6, 0.12); } break;
    case 'shed': if (mine && soon('shed', 0.15)) { tone(A.sfx, 'triangle', hz(76), hz(64), t, 0.14, 0.25); clang(t + 0.05, 2, 0.1); } break;
    case 'swap': if (mine && soon('swap', 0.1)) tone(A.sfx, 'sine', 330, 200, t, 0.07, 0.14); break;
    case 'full': if (mine) arp(t, [64, 60], 'square', 0.14, 0.12, 0.14); break;
    case 'heavy': case 'overloaded': if (mine) arp(t, [55, 52, 48], 'sawtooth', 0.14, 0.08, 0.16); break;
    case 'madseg': if (mine) tone(A.sfx, 'square', hz(72 + e.value * 4), 0, t, 0.09, 0.12); break;
    case 'madmode':
      if (!mine) break;
      if (e.value) { tone(A.sfx, 'sawtooth', 110, 1760, t, 0.5, 0.22); arp(t + 0.4, [64, 68, 71, 76, 80, 83, 88], 'square', 0.16, 0.04, 0.4); boom(t + 0.4, 0.8, 120); }
      else tone(A.sfx, 'sawtooth', 880, 110, t, 0.45, 0.18);
      break;
    case 'warn': if (hit) arp(t, [81, 86, 81, 86], 'square', 0.2, 0.09, 0.07); break;
    case 'shout': voice('queen', true); break;
    case 'flash': chime(t, [76, 72]); arp(t + 0.7, [84, 88, 91, 96], 'triangle', 0.18, 0.06, 0.3); break;
    case 'flashend': tone(A.sfx, 'triangle', hz(72), hz(60), t, 0.3, 0.16); break;
    case 'closing': chime(t, [72, 76, 72, 67]); break;
    case 'lanewarn': arp(t, [88, 88], 'square', 0.1, 0.16, 0.08); break;
    case 'laneclose': tone(A.sfx, 'square', 98, 92, t, 0.3, 0.2); click(t + 0.28, 0.3); break;
    case 'go': arp(t, [64, 71, 76], 'square', 0.2, 0.001, 0.5); whoosh(t, 300, 2500, 0.4, 0.25); break;
    case 'wet': if (mine) { hiss(A.sfx, 'bandpass', 900, 2600, 3, t, 0.3, 0.3); tone(A.sfx, 'sine', 700, 1500, t, 0.22, 0.12); } break;   // wheels squeal on water
    case 'jump': whoosh(t, 300, 3000, 0.5, 0.4 * far); if (mine) tone(A.sfx, 'triangle', hz(60), hz(84), t, 0.45, 0.16); break;
    case 'land': boom(t, 0.7 * far, 110); clang(t + 0.03, 4, 0.1 * far); break;
    case 'selfie': click(t, 0.5 * far); tone(A.sfx, 'square', hz(96), 0, t + 0.02, 0.05, 0.1 * far); click(t + 0.09, 0.35 * far); break;   // a shutter
    case 'finish':
      if (mine) arp(t, [72, 76, 79, 84, 79, 84, 88], 'triangle', 0.28, 0.07, 0.25);
      else if (soon('rfin', 0.3)) arp(t, [79, 84], 'sine', 0.12, 0.07, 0.2);
      break;
    case 'timeup': arp(t, [67, 66, 65, 64], 'sawtooth', 0.22, 0.22, 0.3); tone(A.sfx, 'square', 98, 90, t + 0.9, 0.6, 0.2); break;
    // the level objects (ART.md section 8)
    case 'wipe': boom(t, far, 150); tone(A.sfx, 'sine', 900, 180, t, 0.35, 0.4 * far); tone(A.sfx, 'triangle', 1350, 260, t + 0.02, 0.3, 0.16 * far); clang(t + 0.05, 4, 0.12 * far); if (mine) voice('player', false, true); else voice(k.char, false); break;
    case 'pop': tone(A.sfx, 'sine', 140, 620, t, 0.22, 0.5 * far); tone(A.sfx, 'triangle', 300, 1200, t + 0.03, 0.18, 0.18 * far); if (!mine) voice(k.char, false); break;   // boing
    case 'shoved': tone(A.sfx, 'square', 330, 300, t, 0.12, 0.16 * far); tone(A.sfx, 'square', 392, 360, t + 0.13, 0.14, 0.14 * far); boom(t, 0.6 * far, 120); break;   // a horn and a thump
    case 'press': tone(A.sfx, 'sine', hz(96), 0, t, 1.2, 0.35, 0.002); tone(A.sfx, 'sine', hz(103) * 1.004, 0, t, 0.9, 0.12, 0.002); break;   // the service bell: ding!
    case 'gateopen': for (let i = 0; i < 9; i++) click(t + i * 0.045, 0.25); tone(A.sfx, 'sawtooth', 90, 140, t, 0.45, 0.08); break;   // a roller shutter rattles up
    case 'checkpoint': if (mine) { chime(t, [79, 84]); arp(t + 0.1, [84, 88, 91], 'triangle', 0.16, 0.05, 0.18); } break;
    case 'respawn': if (mine) { whoosh(t, 2000, 400, 0.25, 0.25); tone(A.sfx, 'triangle', hz(72), hz(84), t + 0.05, 0.15, 0.2); } break;
    case 'watch': arp(t, [84, 91, 96], 'square', 0.12, 0.05, 0.2); click(t, 0.4); click(t + 0.12, 0.4); break;
    case 'boostpad': whoosh(t, 500, 6000, 0.45, 0.4 * far); tone(A.sfx, 'sawtooth', 200, 900, t, 0.3, 0.12 * far); break;
    case 'fountain': boom(t, 1, 140); for (let i = 0; i < 7; i++) tone(A.sfx, 'triangle', hz(84 + i * 2), hz(72 + i), t + 0.04 + i * 0.05, 0.12, 0.16); clang(t + 0.05, 10, 0.14); break;
    case 'cans': if (soon('cans', 0.08)) { for (let i = 0; i < 6; i++) clang(t + i * 0.035, 4 + i, 0.1 * far); } break;
    case 'topple': clang(t, 6, 0.14 * far); tone(A.sfx, 'triangle', hz(70), hz(58), t, 0.18, 0.16 * far); break;
    case 'pancake': if (soon('pancake', 0.3)) { tone(A.sfx, 'sine', 300, 80, t, 0.18, 0.3 * far); tone(A.sfx, 'square', 700, 1100, t + 0.15, 0.1, 0.06 * far); } break;   // splat, then a squeak
    default:
  }
}
// Sounds of the level objects that come from their state, not from events: a sign creaking at the end of its
// swing, a forklift's back-up beeper. vol 0..1 from the distance to the player.
export function objectSound(kind, vol) {
  if (!A.ctx || !A.on || vol <= 0.02) return;
  const t = A.ctx.currentTime;
  if (kind === 'creak') { tone(A.sfx, 'sawtooth', 110 + Math.random() * 30, 70, t, 0.32, 0.07 * vol); hiss(A.sfx, 'bandpass', 600, 300, 4, t, 0.3, 0.06 * vol); }
  else if (kind === 'beep' && soon('beep', 0.4)) tone(A.sfx, 'square', 1250, 0, t, 0.14, 0.07 * vol);
}
// The announcer's "ding-dong": bell-like notes (a sine with an octave partial), long tails.
function chime(t, notes) {
  notes.forEach((m, i) => { const t0 = t + i * 0.32; tone(A.sfx, 'sine', hz(m), 0, t0, 1.1, 0.34, 0.006); tone(A.sfx, 'sine', hz(m + 12) * 1.003, 0, t0, 0.5, 0.12, 0.006); });
}

// Interface cues that are not simulation events: countdown beeps (n = 3, 2, 1), the scanner beep for
// receipt line n (it climbs the scale), the cash register on the total, a button click.
export function audioCue(name, n) {
  if (!A.ctx || !A.on) return;
  const t = A.ctx.currentTime;
  if (name === 'count') tone(A.sfx, 'square', hz(69), 0, t, 0.12, 0.2);
  else if (name === 'scan') tone(A.sfx, 'square', hz(76 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16][Math.min(9, n | 0)]), 0, t, 0.07, 0.16);
  else if (name === 'kaching') { click(t, 0.5); arp(t, [88, 95], 'sine', 0.3, 0.07, 0.7); clang(t + 0.1, 7, 0.1); tone(A.sfx, 'triangle', hz(100), 0, t + 0.14, 0.9, 0.2); }
  else if (name === 'stamp') { boom(t, 0.8, 140); click(t, 0.5); }
  else if (name === 'click') tone(A.sfx, 'triangle', hz(81), hz(86), t, 0.05, 0.18);
}

// ---- Music: a two-chord funk vamp on a 16-step grid, played by a look-ahead scheduler (so it loops
// without a seam and can change tempo). Four bars make a pass and four passes the tune: twice as
// written, once a minor third up, once with the lead's bars in reverse order and a snare fill into the
// repeat. Notes are MIDI numbers, 0 is a rest.
const BASS = [
  [40, 0, 0, 40, 0, 52, 0, 0, 43, 0, 45, 0, 0, 47, 50, 0], [40, 0, 0, 40, 0, 52, 0, 50, 0, 47, 0, 45, 0, 43, 0, 42],
  [45, 0, 0, 45, 0, 57, 0, 0, 48, 0, 50, 0, 0, 52, 55, 0], [45, 0, 0, 45, 0, 57, 0, 55, 0, 52, 0, 47, 0, 47, 0, 46]];
const CHORD = [[64, 67, 71, 74], [64, 67, 71, 74], [64, 67, 69, 73], [64, 67, 69, 73]];       // Em7, Em7, A7, A7
const LEAD = [[76, 0, 79, 0, 0, 81, 0, 79, 0, 0, 76, 0, 74, 0, 0, 0], [0, 0, 76, 0, 79, 0, 83, 0, 81, 0, 0, 79, 0, 76, 0, 0],
  [76, 0, 81, 0, 0, 85, 0, 81, 0, 0, 79, 0, 76, 0, 0, 0], [0, 0, 73, 0, 76, 0, 79, 0, 81, 0, 83, 0, 85, 0, 88, 0]];
const STAB = [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0], KICK = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], BELL = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0];
// level: 0 = menu (bass and soft chords), 1-4 = the multiplier in a run (drums and bass, then chords,
// then the lead, then cowbell and claps), 5 = MADNESS mode (everything, double-time hats).
function musicStep(t, n, level, closing) {
  const M = A.music, bar = (n >> 4) & 3, s = n & 15, pass = (n >> 6) & 3, up = pass === 2 ? 3 : 0, fill = pass === 3 && bar === 3 && s >= 12;
  if (level > 0) {
    if (KICK[s]) { tone(M, 'sine', 125, 44, t, 0.16, 0.95); hiss(M, 'highpass', 3000, 0, 0.7, t, 0.012, 0.25); }
    if (SNARE[s] || fill) { hiss(M, 'bandpass', 1900, 0, 0.9, t, 0.13, fill ? 0.3 + (s - 12) * 0.07 : 0.5); tone(M, 'triangle', 190, 150, t, 0.07, 0.3); }
    if (s % 2 === 0 || level >= 3) hiss(M, 'highpass', 7500, 0, 0.7, t, s % 4 === 2 ? 0.07 : 0.028, level >= 5 ? 0.2 : 0.13);
    if (level >= 4 && BELL[s]) { tone(M, 'square', 545, 0, t, 0.06, 0.08); tone(M, 'square', 815, 0, t, 0.06, 0.06); }
    if (level >= 4 && (s === 4 || s === 12)) for (let i = 0; i < 3; i++) hiss(M, 'bandpass', 1300, 0, 1.2, t + i * 0.011, 0.07, 0.22);
    if (closing && s === 0) { tone(M, 'square', hz(93), 0, t, 0.25, 0.07); tone(M, 'square', hz(93), 0, t + 0.12, 0.25, 0.07); }   // the closing bell
  }
  const b = BASS[bar][s];
  if (b) {
    const c = A.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), d = 0.17;
    o.type = 'sawtooth'; o.frequency.value = hz(b + up);
    f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(180, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level ? 0.5 : 0.3, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0006, t + d + 0.05);
    o.connect(f); f.connect(g); g.connect(M); o.start(t); o.stop(t + d + 0.08);
  }
  if (STAB[s] && (level === 0 || level >= 2)) for (const m of CHORD[bar]) tone(M, 'square', hz(m + up), 0, t, 0.1, level ? 0.06 : 0.035);
  const ld = LEAD[pass === 3 ? 3 - bar : bar][s];
  if (level >= 3 && ld) tone(M, 'square', hz(ld + up), hz(ld + up) * 1.01, t, 0.13, 0.085);
}

// Once a frame: keeps the music scheduled a little ahead, moves its layers, tempo and filter with the
// run, and turns the continuous noises up and down. state is main.js's game state, or 'pause'.
export function audioFrame(sim, dt, state) {
  const c = A.ctx;
  if (!c || c.state === 'closed') return;
  const t = c.currentTime, p = sim.player, play = state === 'play', mad = play && p.madT > 0;
  A.level = play ? (mad ? 5 : 1 + Math.min(3, Math.floor(p.mad))) : 0;
  A.bpm += ((play ? (sim.closing ? 134 : 114) : 100) - A.bpm) * Math.min(1, dt * 0.7);
  if (A.nextT < t - 0.25) A.nextT = t + 0.05;                 // the tab slept: start again from now
  while (A.nextT < t + 0.12) {
    musicStep(A.nextT + (A.step & 1 ? 1.8 / A.bpm : 0), A.step, A.level, play && sim.closing);   // odd steps are late: swing
    A.step++; A.nextT += 15 / A.bpm;
  }
  // MADNESS mode sweeps a resonant filter over the music.
  A.wah.Q.setTargetAtTime(mad ? 7 : 0.7, t, 0.05);
  A.wah.frequency.setTargetAtTime(mad ? 700 + 2600 * (0.5 + 0.5 * Math.sin(t * 9)) : state === 'pause' ? 480 : 18000, t, 0.03);   // a paused game hears its music through a wall
  const L = A.loops, speed = Math.abs(p.spd), on = play && sim.phase === 'run';
  L.screech.g.setTargetAtTime(on && p.drift ? 0.1 + 0.035 * p.tier : 0, t, 0.04);
  L.screech.f.setTargetAtTime(2300 + 500 * p.tier + 300 * Math.sin(t * 31), t, 0.03);
  L.roll.g.setTargetAtTime(on ? Math.min(0.11, speed * 0.008) : 0, t, 0.08);
  L.roll.f.setTargetAtTime(250 + speed * 45, t, 0.08);
  // The crowd murmurs louder with more shoppers nearby and toward the end of the run.
  let near = 0;
  for (const s of sim.shoppers) if (s.state >= 0 && Math.abs(s.x - p.x) < 16 && Math.abs(s.z - p.z) < 16) near++;
  L.murmur.g.setTargetAtTime(play ? Math.min(0.16, 0.012 * near + 0.05 * Math.max(0, sim.t) / sim.timer + (sim.closing ? 0.04 : 0)) : 0.02, t, 0.3);
  L.murmur.f.setTargetAtTime(380 + 120 * Math.sin(t * 0.9), t, 0.2);
  // The cart train rattles louder the nearer it is (a clatter while it moves), and a belt whirrs under the cart.
  let td = 1e9, moving = false;
  for (const tr of sim.trains || []) { const d = Math.hypot(tr.x - p.x, tr.z - p.z); if (d < td) { td = d; moving = tr.wait <= 0; } }
  L.train.g.setTargetAtTime(play && td < 32 ? Math.pow(1 - td / 32, 2) * (moving ? (Math.sin(t * 40) > 0 ? 0.3 : 0.12) : 0.05) : 0, t, 0.012);
  L.belt.g.setTargetAtTime(on && (p.convX || p.convZ) ? 0.07 : 0, t, 0.06);
  // A heavy cart squeaks: little chirps, faster with speed.
  if (on && A.on && p.load > TUNE.loadfull * 0.7 && speed > 3 && p.madT <= 0) {
    A.squeak -= dt * speed / 5;
    if (A.squeak <= 0) { A.squeak = 0.7 + Math.random() * 0.5; const f = 1700 + Math.random() * 700; tone(A.sfx, 'sine', f, f * 1.25, t, 0.06, 0.045); }
  }
}
