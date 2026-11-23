// DOORBUSTER — chatter.js
// Purpose: who says what, and when (DESIGN.md section 7). The simulation's events become the cast's lines
//          in speech bubbles with their voices (gibberish, or the owner's voice files), emotes over heads, and
//          the crowd's shouts. At most two bubbles at a time, six seconds between two lines of one speaker,
//          the hero's lines first.
// Exports: chatterReset, chatterEvent, chatterFrame
// Depends on: cast.js (LINES, CROWD), ui.js (bubble, emote), audio.js (say).

import { LINES, CROWD } from './cast.js';
import { bubble, emote } from './ui.js';
import { say } from './audio.js';

// The characters' ids in the line table (DESIGN.md section 7) and in the voice files.
const WHO = { player: 'penny', granny: 'granny', dad: 'sprintdad', queen: 'coupon', selfie: 'selfie', bro: 'bubba', gramps: 'gramps' };
// What each one says when (line numbers count from 1, as in the table).
const SAYS = {
  penny: { ram: [1, 3, 7], hot: [8], wipe: [6], pop: [6], cheese: [5], chain: [2], finish: [4, 2], rammed: [6] },
  granny: { go: [4], rammed: [2], pop: [2], wipe: [3], taunt: [5], bump: [6], ram: [1], finish: [5] },
  sprintdad: { rammed: [2], wipe: [2], taunt: [3], ram: [4], fountain: [5], finish: [1] },
  coupon: { shout: [1], rammed: [2], wipe: [2], smash: [3], ram: [4], fountain: [5], taunt: [4] },
  selfie: { selfie: [1, 3], rammed: [5], wipe: [2], ram: [4], taunt: [3] },
  bubba: { smash: [1], rammed: [2], wipe: [2], bump: [3], ram: [4], taunt: [4], scoop: [5] },
  gramps: { taunt: [1], boost: [2], rammed: [3], wipe: [3], go: [4], press: [5] },
};
const MOOD = { rammed: 'shocked', wipe: 'shocked', pop: 'shocked', ram: 'angry', taunt: 'happy', hot: 'happy', go: 'happy', smash: 'happy', fountain: 'sad', cheese: 'sad', finish: 'happy', chain: 'happy', bump: 'angry' };

const C = { last: new Map(), n: 0, ahead: new Map() };
export function chatterReset() { C.last.clear(); C.ahead.clear(); C.n = 0; }

// One line of a character (k: a cart) for a trigger, if its six seconds have passed.
function line(sim, k, trigger, hero) {
  const who = WHO[k.char], table = SAYS[who], picks = table && table[trigger];
  if (!picks) return;
  const t = sim.t, prev = C.last.get(who) ?? -9;
  if (t - prev < 6 && !(hero && trigger === 'cheese')) return;
  C.last.set(who, t);
  const n = picks[C.n++ % picks.length], text = LINES[who][n - 1];
  bubble(text, () => [k.x, 2.3, k.z], k.player);
  say(who, n, text, MOOD[trigger] || 'happy', k.player ? 1 : 0.8);
}
// A shopper's shout: its archetype's own line or a generic one.
function shout(sim, s, view, generic) {
  const i = sim.shoppers.indexOf(s), key = 'crowd' + i, t = sim.t;
  if (t - (C.last.get(key) ?? -9) < 6 || t - (C.last.get('crowd') ?? -9) < 1.5) return;
  C.last.set(key, t); C.last.set('crowd', t);
  const kinds = view && view.crowdKinds, kind = s.kind || (kinds ? kinds[(i * 7 + 3) % kinds.length] : null);
  const own = kind && CROWD[kind] && CROWD[kind].line, text = !generic && own && (i + C.n++) % 2 === 0 ? own : LINES.crowd[(i * 3 + C.n++) % LINES.crowd.length];
  bubble(text, () => [s.x, 2.2, s.z], false);
  say('crowd' + (i % 6), 1, text, 'angry', 0.6);
}

export function chatterEvent(e, sim, view) {
  const k = e.cart, p = sim.player;
  const near = (x, z) => Math.hypot(x - p.x, z - p.z) < 24;
  switch (e.type) {
    case 'go': { const first = sim.carts.find((c) => !c.player && SAYS[WHO[c.char]] && SAYS[WHO[c.char]].go); if (first) line(sim, first, 'go'); break; }
    case 'ram':
      if (!near(e.ref.x, e.ref.z)) break;
      if (k.player) { line(sim, k, 'ram', true); line(sim, e.ref, 'rammed'); emote('vein', () => [e.ref.x, 2.6, e.ref.z]); }
      else if (e.ref.player) { line(sim, k, 'ram'); line(sim, e.ref, 'rammed', true); emote('bang', () => [p.x, 2.8, p.z]); }
      else { line(sim, e.ref, 'rammed'); }
      break;
    case 'wipe': if (near(k.x, k.z)) line(sim, k, 'wipe', k.player); break;
    case 'pop': if (near(k.x, k.z)) line(sim, k, 'pop', k.player); break;
    case 'hot': if (k.player) { line(sim, k, 'hot', true); emote('heart', () => [k.x, 2.8, k.z]); } else line(sim, k, 'smash'); break;
    case 'shout': line(sim, k, 'shout'); break;
    case 'smash': if (!k.player && near(k.x, k.z)) line(sim, k, 'smash'); break;
    case 'fountain': if (near(k.x, k.z)) line(sim, k, 'fountain'); break;
    case 'spill': if (k.player && k.tower.length && k.tower[k.tower.length - 1].value > 300) line(sim, k, 'cheese', true); break;
    case 'selfie': if (near(k.x, k.z)) line(sim, k, 'selfie'); break;
    case 'press': if (k && !k.player) line(sim, k, 'press'); break;
    case 'boost': if (k && !k.player && near(k.x, k.z)) line(sim, k, 'boost'); break;
    case 'cartbump': if (e.value > 6 && near(k.x, k.z)) line(sim, e.ref.player ? k : e.ref, 'bump'); break;
    case 'finish': if (k.player) line(sim, k, 'finish', true); else if (near(k.x, k.z) && k.place !== undefined) line(sim, k, 'finish'); break;
    case 'bowl': if (near(e.ref.x, e.ref.z)) shout(sim, e.ref, view, false); break;
    case 'pancake': if (near(e.ref.x, e.ref.z)) shout(sim, e.ref, view, true); break;
    case 'pricegun': case 'dance': case 'donut': if (near(e.ref.x, e.ref.z)) shout(sim, e.ref, view, false); break;
    case 'babythrow': if (near(e.ref.x, e.ref.z)) { bubble('WAAAH!', () => [e.ref.x, 1.6, e.ref.z], false); say('crowd5', 1, 'WAAAH', 'sad', 0.7); } break;
    case 'take':
      if (k.player && k.chain === 6) line(sim, k, 'chain', true);
      else if (k.char === 'bro' && e.ref.y < 0.5 && near(k.x, k.z)) line(sim, k, 'scoop');      // off the floor, right by the player
      break;
    default:
  }
}

// Every frame: a rival that has just overtaken the player taunts it; a rival waiting at a hazard sweats.
export function chatterFrame(sim) {
  if (sim.phase !== 'run') return;
  const p = sim.player;
  for (const k of sim.carts) {
    if (k.player || k.done) continue;
    const ahead = k.prog > p.prog + 1, was = C.ahead.get(k);
    if (ahead && was === false && Math.hypot(k.x - p.x, k.z - p.z) < 12) line(sim, k, 'taunt');
    C.ahead.set(k, ahead);
    if (k.ai && k.ai.waiting && (k.ai.waitT || 0) > 1 && (k.sweatT ?? -9) < sim.t - 3) { k.sweatT = sim.t; emote('sweat', () => [k.x, 2.6, k.z]); }
  }
}
