// DOORBUSTER level editor — view.js
// Purpose: draws a level on a 2D canvas, top down: tiles (with shelves merged into runs, lanes, belts, pits), zone
//          floors, objects with their danger areas, links and paths, the drivers' route, problems, the selection and
//          the rulers; draws palette icons; finds the object or handle under the pointer.
// Exports: drawLevel, drawTileIcon, drawObjectIcon, objectAt, handlesOf, handleAt, objBox, RIVAL_COLORS
// Depends on: catalog.js. Browser only (canvas).

import { TILE_BY_CH, OBJECTS } from './catalog.js';

export const RIVAL_COLORS = { granny: '#9B5DE5', selfie: '#2EC4B6', queen: '#FF9F1C', dad: '#3A86FF', bro: '#8AC926', gramps: '#E63946' };
const FX_COLOR = { wipeout: '#FF3B4E', push: '#FF9F1C', move: '#FFD23F', switch: '#00D1C1', mark: '#9B5DE5', pickup: '#8AC926' };
const SURF = { turf: '#86C77E', track: '#F2935A', wood: '#DDB27A', deck: '#A8DDE9', steel: '#BCC5CE', warm: '#E5B985', dessert: '#F8CADB' };
const INK = '#2A1A3A', FLOOR = '#F3E9DC', VOID = '#191527', PINK = '#FF4FA3';
const SIGN_R = 5.1, SIGN_LOW = Math.acos(4.3 / 5.85);          // src/objects.js SIGN: arm length and the angle below which it hits, metres / radians
const PATROL_BOX = { forklift: [0.75, 1.35, '#FFD23F'], pallet_jack: [0.5, 1.0, '#FF9F1C'], robot_vacuum: [0.55, 0.55, '#7CC6FE'], foosball_player: [0.45, 0.5, '#E84855'], belly_bro: [0.7, 0.6, '#FFC9A3'] };
const DIRV = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// ---- small drawing helpers ------------------------------------------------------------------------------------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function disc(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); }
function label(ctx, text, x, y, px, color = INK, align = 'center') {
  if (px < 7) return;
  ctx.font = `900 ${px}px "Arial Black", "Segoe UI Black", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function tag(ctx, text, x, y, px, bg, fg = INK) {          // a small price-tag label
  if (px < 8) return;
  ctx.font = `900 ${px}px "Arial Black", "Segoe UI Black", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + px * 0.9, h = px * 1.45;
  rr(ctx, x - w / 2, y - h / 2, w, h, px * 0.3); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = Math.max(1, px * 0.12); ctx.strokeStyle = INK; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg; ctx.fillText(text, x, y + px * 0.04);
}
function arrowHead(ctx, x, y, dx, dy, size) {
  ctx.beginPath(); ctx.moveTo(x + dx * size, y + dy * size); ctx.lineTo(x - dy * size * 0.7 - dx * size * 0.4, y + dx * size * 0.7 - dy * size * 0.4);
  ctx.lineTo(x + dy * size * 0.7 - dx * size * 0.4, y - dx * size * 0.7 - dy * size * 0.4); ctx.closePath(); ctx.fill();
}
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  ctx.closePath();
}

// ---- tiles ----------------------------------------------------------------------------------------------------
// One tile at screen (sx, sy), size s px. nb(dx, dy) gives the neighbouring character; info: { facing, slot, rampDir, surface }.
function drawTile(ctx, ch, sx, sy, s, nb, info = {}) {
  const t = TILE_BY_CH[ch] || TILE_BY_CH['.'], d = t.draw, m = Math.max(1, s * 0.06);
  const floor = info.surface ? SURF[info.surface] || FLOOR : FLOOR;
  if (d.base === 'void') { ctx.fillStyle = VOID; ctx.fillRect(sx, sy, s, s); return; }
  ctx.fillStyle = floor; ctx.fillRect(sx, sy, s, s);
  if (d.base === 'shelf') {
    const same = (dx, dy) => nb(dx, dy) === ch;
    const l = same(-1, 0) ? 0 : s * 0.1, r = same(1, 0) ? 0 : s * 0.1, u = same(0, -1) ? 0 : s * 0.1, b = same(0, 1) ? 0 : s * 0.1;
    ctx.fillStyle = '#6E4B3A'; ctx.fillRect(sx + l, sy + u, s - l - r, s - u - b);
    ctx.fillStyle = d.color; ctx.fillRect(sx + l + s * 0.1, sy + u + s * 0.1, Math.max(0, s - l - r - s * 0.2), Math.max(0, s - u - b - s * 0.2));
    label(ctx, d.letter, sx + s / 2, sy + s / 2, s * 0.42, INK);
    return;
  }
  if (d.base === 'pit') {
    ctx.fillStyle = '#16233A'; ctx.fillRect(sx, sy, s, s);
    ctx.fillStyle = '#FFD23F';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (nb(dx, dy) === '_') continue;
      const w = Math.max(2, s * 0.1);
      if (dx === 1) ctx.fillRect(sx + s - w, sy, w, s); if (dx === -1) ctx.fillRect(sx, sy, w, s);
      if (dy === 1) ctx.fillRect(sx, sy + s - w, s, w); if (dy === -1) ctx.fillRect(sx, sy, s, w);
    }
    return;
  }
  if (d.base === 'lane') {
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.55; ctx.fillRect(sx, sy, s, s); ctx.globalAlpha = 1;
    ctx.strokeStyle = d.color; ctx.lineWidth = m;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx + s * i / 4, sy + s * 0.15); ctx.lineTo(sx + s * i / 4, sy + s * 0.85); ctx.stroke(); }
    label(ctx, ch === 'c' ? '$' : '×', sx + s / 2, sy + s / 2, s * 0.45, INK);
    return;
  }
  if (d.base === 'belt') {
    ctx.fillStyle = '#4A4458'; ctx.fillRect(sx, sy, s, s);
    const [dx, dy] = DIRV[d.dir];
    ctx.fillStyle = '#FFD23F';
    for (const k of [-0.22, 0.22]) arrowHead(ctx, sx + s / 2 + dx * k * s, sy + s / 2 + dy * k * s, dx, dy, s * 0.2);
    return;
  }
  const cx = sx + s / 2, cy = sy + s / 2;
  ctx.lineWidth = Math.max(1, s * 0.07); ctx.strokeStyle = INK;
  switch (d.icon) {
    case 'wet': ctx.fillStyle = '#1FA2FF'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.42, s * 0.32, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#BFE6FF'; disc(ctx, cx - s * 0.12, cy - s * 0.08, s * 0.08); ctx.fill(); break;
    case 'block': rr(ctx, sx + s * 0.06, sy + s * 0.06, s * 0.88, s * 0.88, s * 0.12); ctx.fillStyle = d.color; ctx.fill(); ctx.stroke(); label(ctx, d.letter, cx, cy, s * 0.42); break;
    case 'counter': {
      const w = d.vertical ? s * 0.7 : s, h = d.vertical ? s : s * 0.7;
      ctx.fillStyle = '#A7B0BC'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h); ctx.fillStyle = '#E4E9EF'; ctx.fillRect(cx - w / 2 + m * 2, cy - h / 2 + m * 2, Math.max(0, w - m * 4), Math.max(0, h - m * 4));
      break;
    }
    case 'dot': disc(ctx, cx, cy, s * 0.17); ctx.fillStyle = d.color; ctx.fill(); ctx.stroke(); break;
    case 'diamond': ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.4); ctx.lineTo(cx + s * 0.4, cy); ctx.lineTo(cx, cy + s * 0.4); ctx.lineTo(cx - s * 0.4, cy); ctx.closePath(); ctx.fillStyle = d.color; ctx.fill(); ctx.stroke(); label(ctx, d.letter, cx, cy, s * 0.36); break;
    case 'star': star(ctx, cx, cy, s * 0.44); ctx.fillStyle = d.color; ctx.fill(); ctx.stroke(); break;
    case 'circle': { const r = d.big ? (ch === 'F' ? 1.4 : 0.85) * s : (d.small ? 0.26 : 0.42) * s; disc(ctx, cx, cy, r); ctx.fillStyle = d.color; ctx.globalAlpha = d.big ? 0.85 : 1; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); if (d.letter) label(ctx, d.letter, cx, cy, s * 0.36); break; }
    case 'square': { const r = (d.small ? 0.26 : 0.36) * s; rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.3); ctx.fillStyle = d.color; ctx.fill(); ctx.stroke(); break; }
    case 'tri': { const r = (d.big ? 0.8 : d.small ? 0.28 : 0.42) * s; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.95, cy + r * 0.75); ctx.lineTo(cx - r * 0.95, cy + r * 0.75); ctx.closePath(); ctx.fillStyle = d.color; ctx.fill(); ctx.stroke(); break; }
    case 'bar': ctx.fillStyle = d.color; ctx.fillRect(sx + s * 0.05, cy - s * 0.08, s * 0.9, s * 0.16); ctx.strokeRect(sx + s * 0.05, cy - s * 0.08, s * 0.9, s * 0.16); break;
    case 'track': ctx.strokeStyle = '#7A6F86'; ctx.lineWidth = Math.max(1, s * 0.08); for (const k of [0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(sx, sy + s * k); ctx.lineTo(sx + s, sy + s * k); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx + s * k, sy); ctx.lineTo(sx + s * k, sy + s); ctx.stroke(); } break;
    case 'huddle': ctx.fillStyle = '#C9BBCF'; for (const [px, py] of [[0, -0.3], [-0.15, -0.02], [0.15, -0.02], [-0.3, 0.26], [0, 0.26], [0.3, 0.26]]) { disc(ctx, cx + px * s, cy + py * s, s * 0.11); ctx.fill(); ctx.stroke(); } break;
    case 'ramp': {
      const [dx, dy] = info.rampDir || [0, -1];
      ctx.fillStyle = d.color; rr(ctx, sx + s * 0.08, sy + s * 0.08, s * 0.84, s * 0.84, s * 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; arrowHead(ctx, cx + dx * s * 0.08, cy + dy * s * 0.08, dx, dy, s * 0.3);
      if (info.rampSet) { disc(ctx, sx + s * 0.8, sy + s * 0.2, s * 0.1); ctx.fillStyle = PINK; ctx.fill(); }
      break;
    }
    case 'start': {
      const [dx, dy] = DIRV[info.facing] || [0, -1];
      disc(ctx, cx, cy, s * 0.44); ctx.fillStyle = PINK; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; arrowHead(ctx, cx + dx * s * 0.05, cy + dy * s * 0.05, dx, dy, s * 0.3);
      break;
    }
    case 'rival': {
      disc(ctx, cx, cy, s * 0.4); ctx.fillStyle = info.slotColor || '#C9BBCF'; ctx.fill(); ctx.stroke();
      label(ctx, info.slot ? String(info.slot) : 'r', cx, cy + s * 0.02, s * 0.4, '#FFFFFF');
      break;
    }
    default:
  }
}

// A palette icon for a tile character.
export function drawTileIcon(canvas, ch) {
  const ctx = canvas.getContext('2d'), s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  const p = s * 0.12, q = s - p * 2;
  ctx.save(); ctx.beginPath(); ctx.rect(p, p, q, q); ctx.clip();
  const big = TILE_BY_CH[ch].draw.big;
  if (big) { ctx.translate(p + q / 2, p + q / 2); ctx.scale(0.42, 0.42); ctx.translate(-q / 2, -q / 2); drawTile(ctx, ch, 0, 0, q, () => ch, { facing: 'n' }); }
  else drawTile(ctx, ch, p, p, q, () => ch === 'S' || ch === 'M' || ch === 'L' ? ' ' : ch, { facing: 'n', slot: 1, slotColor: '#9B5DE5', rampDir: [0, -1] });
  ctx.restore();
  ctx.strokeStyle = 'rgba(42,26,58,.35)'; ctx.lineWidth = 1; ctx.strokeRect(p + 0.5, p + 0.5, q - 1, q - 1);
}

// ---- object geometry (tile units) -----------------------------------------------------------------------------
const C = (o) => [o.x + 0.5, o.y + 0.5];
function signReach(o) { return (SIGN_R * Math.sin(Math.min(o.amplitude_deg * Math.PI / 180, SIGN_LOW)) + o.width_m / 2) / 2; }
// The box an object is picked by (tile units): [x0, y0, x1, y1].
export function objBox(o) {
  const spec = OBJECTS[o.type];
  if (spec && spec.shape === 'area') return [o.x, o.y, o.x + o.w, o.y + o.h];
  const [cx, cy] = C(o);
  const band = (half, thick) => o.swing_axis === 'y' || o.span_axis === 'y' ? [cx - thick, cy - half, cx + thick, cy + half] : [cx - half, cy - thick, cx + half, cy + thick];
  switch (o.type) {
    case 'swinging_sign': case 'punching_bag': return band(signReach(o), 0.35);
    case 'giant_scissors': return band(o.span_m / 4, 0.35);
    case 'cleaver_row': return band(o.count * o.gap_m / 4, 0.35);
    case 'checkpoint': return band(o.width_tiles / 2, 0.3);
    case 'boxing_glove': { const hw = o.every_s > 0 ? 0.45 : (o.plate_width_tiles || 1) / 2; return [cx - hw, cy - 0.45, cx + hw, cy + 0.45]; }
    case 'turnstile': return [cx - 0.5, cy - 0.5, cx + 0.5, cy + 0.5];
    case 'yarn_ball': { const r = o.radius_m / 2; return [cx - r, cy - r, cx + r, cy + r]; }
    default: return [cx - 0.45, cy - 0.45, cx + 0.45, cy + 0.45];
  }
}
// Handles of a selected object: [{ id, x, y }] in tile units (centres).
export function handlesOf(o) {
  const spec = OBJECTS[o.type], out = [];
  if (!spec) return out;
  if (spec.shape === 'area') { out.push({ id: 'nw', x: o.x, y: o.y }, { id: 'ne', x: o.x + o.w, y: o.y }, { id: 'sw', x: o.x, y: o.y + o.h }, { id: 'se', x: o.x + o.w, y: o.y + o.h }); return out; }
  (o.waypoints || []).forEach((p, i) => out.push({ id: 'wp' + i, x: p[0] + 0.5, y: p[1] + 0.5 }));
  if (o.type === 'boxing_glove' && Array.isArray(o.mount) && !(o.every_s > 0)) out.push({ id: 'mount', x: o.mount[0] + 0.5, y: o.mount[1] + 0.5 });
  return out;
}
export function handleAt(o, tx, ty, s) {
  const r = Math.max(0.3, 9 / s);
  for (const h of handlesOf(o)) if (Math.abs(h.x - tx) < r && Math.abs(h.y - ty) < r) return h;
  return null;
}
// The topmost object under the point (tile units), or -1. Point objects sit above areas.
export function objectAt(objects, tx, ty) {
  const inside = (b) => tx >= b[0] && tx <= b[2] && ty >= b[1] && ty <= b[3];
  for (let pass = 0; pass < 2; pass++) for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i], area = OBJECTS[o.type] && OBJECTS[o.type].shape === 'area';
    if ((pass === 0) === area) continue;
    if (inside(objBox(o))) return i;
    if (pass === 0 && o.waypoints) {                    // a patrol is also picked by its path
      const pts = [[o.x, o.y], ...o.waypoints];
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((tx - 0.5 - ax) * vx + (ty - 0.5 - ay) * vy) / l2));
        if (Math.hypot(tx - 0.5 - ax - vx * t, ty - 0.5 - ay - vy * t) < 0.3) return i;
      }
    }
  }
  return -1;
}

// ---- objects --------------------------------------------------------------------------------------------------
// P(x, y) maps tile units to screen pixels; s = pixels per tile (1 m = s / 2 px).
function drawObject(ctx, o, P, s, ix, all) {
  const spec = OBJECTS[o.type], m = s / 2, lw = Math.max(1, s * 0.06);
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.setLineDash([]);
  if (!spec) { const [x, y] = P(o.x + 0.5, o.y + 0.5); rr(ctx, x - s * 0.35, y - s * 0.35, s * 0.7, s * 0.7, 3); ctx.fillStyle = '#B8C0CC'; ctx.fill(); ctx.stroke(); label(ctx, '?', x, y, s * 0.45); return; }
  const fx = FX_COLOR[spec.effect];
  const [cx, cy] = P(o.x + 0.5, o.y + 0.5);
  const ax = (o.swing_axis || o.span_axis) === 'y' ? [0, 1] : [1, 0];
  const area = () => { const [x0, y0] = P(o.x, o.y); return [x0, y0, o.w * s, o.h * s]; };
  const band = (half, thick, color, alpha) => {
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    if (ax[0]) ctx.fillRect(cx - half, cy - thick, half * 2, thick * 2); else ctx.fillRect(cx - thick, cy - half, thick * 2, half * 2);
    ctx.globalAlpha = 1;
  };
  switch (o.type) {
    case 'swinging_sign': case 'punching_bag': {
      const reach = signReach(o) * s;
      band(reach, 0.45 * m, fx, 0.28);
      ctx.strokeStyle = fx; ctx.setLineDash([s * 0.15, s * 0.12]); ctx.beginPath(); ctx.moveTo(cx - ax[0] * reach, cy - ax[1] * reach); ctx.lineTo(cx + ax[0] * reach, cy + ax[1] * reach); ctx.stroke(); ctx.setLineDash([]);
      const w = o.width_m * m, t = 0.55 * m;
      ctx.strokeStyle = INK;
      if (o.type === 'punching_bag') { disc(ctx, cx, cy, 0.5 * m); ctx.fillStyle = '#E84855'; ctx.fill(); ctx.stroke(); }
      else { rr(ctx, cx - (ax[0] ? w / 2 : t), cy - (ax[0] ? t : w / 2), ax[0] ? w : t * 2, ax[0] ? t * 2 : w, s * 0.08); ctx.fillStyle = '#FFD23F'; ctx.fill(); ctx.stroke(); label(ctx, '%', cx, cy, s * 0.32); }
      ctx.fillStyle = fx; for (const k of [-1, 1]) arrowHead(ctx, cx + ax[0] * reach * k, cy + ax[1] * reach * k, ax[0] * k, ax[1] * k, s * 0.18);
      break;
    }
    case 'giant_scissors': {
      const half = o.span_m / 2 * m;
      band(half, 0.5 * m, fx, 0.3);
      ctx.fillStyle = '#DDE3EA';
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + ax[0] * half * k, cy + ax[1] * half * k); ctx.lineTo(cx + ax[1] * s * 0.3 + ax[0] * s * 0.15 * k, cy + ax[0] * s * 0.3 + ax[1] * s * 0.15 * k); ctx.lineTo(cx - ax[1] * s * 0.3 + ax[0] * s * 0.15 * k, cy - ax[0] * s * 0.3 + ax[1] * s * 0.15 * k); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      disc(ctx, cx, cy, s * 0.12); ctx.fillStyle = fx; ctx.fill(); ctx.stroke();
      break;
    }
    case 'cleaver_row': {
      const n = Math.max(1, o.count | 0), g = o.gap_m * m;
      band(n * g / 2, 0.45 * m, fx, 0.25);
      for (let i = 0; i < n; i++) {
        const k = (i - (n - 1) / 2) * g, x = cx + ax[0] * k, y = cy + ax[1] * k, bw = ax[0] ? g * 0.7 : 0.5 * m, bh = ax[0] ? 0.5 * m : g * 0.7;
        ctx.fillStyle = '#DDE3EA'; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh); ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
      }
      break;
    }
    case 'laser_turret': {
      disc(ctx, cx, cy, o.length_m * m); ctx.fillStyle = fx; ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = fx; ctx.setLineDash([s * 0.2, s * 0.15]); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = Math.max(2, s * 0.1); ctx.beginPath(); ctx.moveTo(cx, cy); const a = o.phase * Math.PI * 2; ctx.lineTo(cx + Math.sin(a) * o.length_m * m, cy + Math.cos(a) * o.length_m * m); ctx.stroke();
      ctx.lineWidth = lw; ctx.strokeStyle = INK; disc(ctx, cx, cy, 0.6 * m); ctx.fillStyle = '#4A4458'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'yarn_ball': {
      disc(ctx, cx, cy, o.radius_m * m); ctx.fillStyle = '#E07BB5'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, s * 0.05);
      for (const k of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.arc(cx + k * o.radius_m * m, cy, o.radius_m * m * 0.8, -1, 1); ctx.stroke(); }
      tag(ctx, 'CHASER', cx, cy - o.radius_m * m - s * 0.3, s * 0.26, '#FFFFFF');
      break;
    }
    case 'turnstile': {
      const R = o.radius_m * m;
      disc(ctx, cx, cy, R); ctx.fillStyle = fx; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = fx; ctx.setLineDash([s * 0.15, s * 0.12]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.09);
      for (let i = 0; i < 3; i++) { const a = o.phase * Math.PI * 2 + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * R, cy + Math.cos(a) * R); ctx.stroke(); }
      ctx.lineWidth = lw; disc(ctx, cx, cy, 0.45 * m); ctx.fillStyle = '#7CC6FE'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'boxing_glove': {
      const [mx, my] = Array.isArray(o.mount) ? P(o.mount[0] + 0.5, o.mount[1] + 0.5) : [cx, cy], d = DIRV[o.direction] || [1, 0];
      if (!(o.every_s > 0)) {
        const hw = (o.plate_width_tiles || 1) * s / 2;
        rr(ctx, cx - hw + 2, cy - s / 2 + 2, hw * 2 - 4, s - 4, s * 0.1); ctx.fillStyle = '#FF5D73'; ctx.fill(); ctx.stroke();
        ctx.strokeStyle = fx; ctx.setLineDash([s * 0.08, s * 0.08]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
      }
      const ex = mx + d[0] * o.reach_m * m, ey = my + d[1] * o.reach_m * m;
      ctx.strokeStyle = fx; ctx.lineWidth = Math.max(2, s * 0.12); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineWidth = lw;
      ctx.fillStyle = fx; arrowHead(ctx, ex, ey, d[0], d[1], s * 0.22);
      ctx.strokeStyle = INK; disc(ctx, mx, my, s * 0.24); ctx.fillStyle = o.look === 'cushion' ? '#7CC6FE' : '#E84855'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'forklift': case 'pallet_jack': case 'robot_vacuum': case 'foosball_player': case 'belly_bro': {
      const pts = [[o.x, o.y], ...(o.waypoints || [])], loop = o.type === 'robot_vacuum';
      ctx.strokeStyle = fx; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.setLineDash([s * 0.2, s * 0.12]);
      ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = P(p[0] + 0.5, p[1] + 0.5); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      if (loop && pts.length > 2) ctx.closePath();
      ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = lw;
      ctx.fillStyle = fx;
      for (let k = 1; k < pts.length + (loop && pts.length > 2 ? 1 : 0); k++) {
        const a = pts[k - 1], b = pts[k % pts.length], [x0, y0] = P(a[0] + 0.5, a[1] + 0.5), [x1, y1] = P(b[0] + 0.5, b[1] + 0.5), l = Math.hypot(x1 - x0, y1 - y0) || 1;
        arrowHead(ctx, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / l, (y1 - y0) / l, s * 0.18);
      }
      const [hx, hz, col] = PATROL_BOX[o.type], nx = pts[1] ? pts[1][0] - pts[0][0] : 0, ny = pts[1] ? pts[1][1] - pts[0][1] : 1, h = Math.atan2(nx, ny);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-h);
      if (o.type === 'robot_vacuum' || o.type === 'belly_bro') { disc(ctx, 0, 0, hx * m); } else rr(ctx, -hx * m, -hz * m, hx * 2 * m, hz * 2 * m, s * 0.08);
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
      break;
    }
    case 'floor_button': case 'hidden_plate': {
      const plate = o.type === 'hidden_plate';
      for (const id of o.opens || []) {
        const g = all.find((q) => q.type === 'gate' && q.id === id);
        if (!g) continue;
        const [gx, gy] = P(g.x + g.w / 2, g.y + g.h / 2);
        ctx.strokeStyle = '#00D1C1'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.setLineDash([s * 0.12, s * 0.1]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gx, cy); ctx.lineTo(gx, gy); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = lw;
      }
      disc(ctx, cx, cy, (plate ? 0.95 : 1.05) * m); ctx.fillStyle = plate ? '#BFD3C1' : '#00D1C1'; ctx.fill(); ctx.strokeStyle = INK;
      if (plate) ctx.setLineDash([s * 0.08, s * 0.08]); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, plate ? '?' : '!', cx, cy, s * 0.4);
      break;
    }
    case 'checkpoint': {
      const half = o.width_tiles / 2 * s;
      ctx.strokeStyle = '#9B5DE5'; ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.beginPath(); ctx.moveTo(cx - ax[0] * half, cy - ax[1] * half); ctx.lineTo(cx + ax[0] * half, cy + ax[1] * half); ctx.stroke(); ctx.lineWidth = lw; ctx.strokeStyle = INK;
      for (const k of [-1, 1]) { disc(ctx, cx + ax[0] * half * k, cy + ax[1] * half * k, s * 0.14); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke(); }
      tag(ctx, 'CP ' + (all.filter((q, j) => q.type === 'checkpoint' && j <= ix).length), cx, cy, s * 0.26, '#E9DDFB');
      break;
    }
    case 'stopwatch': {
      disc(ctx, cx, cy, s * 0.32); ctx.fillStyle = '#FFFFFF'; ctx.fill(); if (o.hidden) ctx.setLineDash([s * 0.06, s * 0.06]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - s * 0.2); ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.14, cy); ctx.stroke();
      label(ctx, '+5', cx, cy + s * 0.5, s * 0.24, '#2A7D3A');
      break;
    }
    // ---- areas
    case 'popup_tiles': case 'sliding_panels': {
      const [x0, y0] = area();
      for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) {
        const x = x0 + i * s, y = y0 + j * s;
        ctx.fillStyle = o.type === 'popup_tiles' ? ((i + j) % 2 ? '#FFB38A' : '#FF8A5B') : ((i + j) % 2 ? '#5C5470' : '#4A4458');
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      }
      ctx.strokeStyle = fx; ctx.lineWidth = Math.max(2, s * 0.08); ctx.strokeRect(x0, y0, o.w * s, o.h * s); ctx.lineWidth = lw;
      tag(ctx, o.type === 'popup_tiles' ? 'POP' : 'PANELS', x0 + o.w * s / 2, y0 + o.h * s / 2, s * 0.26, '#FFFFFF');
      break;
    }
    case 'grill_flames': {
      const [x0, y0, w, h] = area();
      const g = ctx.createLinearGradient(x0, y0, x0, y0 + h); g.addColorStop(0, '#FFD23F'); g.addColorStop(1, '#FF3B4E');
      ctx.globalAlpha = 0.6; ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h); ctx.globalAlpha = 1; ctx.strokeStyle = fx; ctx.strokeRect(x0, y0, w, h);
      label(ctx, '🔥', x0 + w / 2, y0 + h / 2, Math.min(w, h) * 0.45);
      break;
    }
    case 'boost_pad': {
      const [x0, y0, w, h] = area(), d = DIRV[o.direction] || [0, 1];
      ctx.fillStyle = 'rgba(255,210,63,.55)'; ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = '#D9A400'; ctx.strokeRect(x0, y0, w, h);
      ctx.fillStyle = INK;
      for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) arrowHead(ctx, x0 + (i + 0.5) * s, y0 + (j + 0.5) * s, d[0], d[1], s * 0.25);
      break;
    }
    case 'gate': {
      const [x0, y0, w, h] = area();
      ctx.fillStyle = o.style === 'secret' ? 'rgba(201,187,207,.55)' : o.style === 'door' ? 'rgba(201,138,91,.75)' : 'rgba(167,176,188,.85)';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = INK; if (o.style === 'secret') ctx.setLineDash([s * 0.1, s * 0.1]); ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
      if (o.style === 'shutter') { ctx.beginPath(); const wide = o.w >= o.h; for (let k = 1; k < 5; k++) { if (wide) { ctx.moveTo(x0, y0 + h * k / 5); ctx.lineTo(x0 + w, y0 + h * k / 5); } else { ctx.moveTo(x0 + w * k / 5, y0); ctx.lineTo(x0 + w * k / 5, y0 + h); } } ctx.stroke(); }
      tag(ctx, o.id || 'gate?', x0 + w / 2, y0 + h / 2, s * 0.26, '#FFFFFF');
      break;
    }
    case 'smart_barrier': {
      const [x0, y0, w, h] = area(), col = o.color === 'blue' ? '#3A86FF' : '#E84855', wide = o.w >= o.h;
      ctx.fillStyle = col; ctx.globalAlpha = 0.18; ctx.fillRect(x0, y0, w, h); ctx.globalAlpha = 1;
      const t = 0.6 * m;
      ctx.fillStyle = col; if (wide) ctx.fillRect(x0 + 2, y0 + h / 2 - t / 2, w - 4, t); else ctx.fillRect(x0 + w / 2 - t / 2, y0 + 2, t, h - 4);
      ctx.strokeStyle = col; ctx.setLineDash([s * 0.1, s * 0.08]); ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
      break;
    }
    case 'bonus_zone': {
      const [x0, y0, w, h] = area();
      ctx.fillStyle = 'rgba(255,210,63,.18)'; ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = '#D9A400'; ctx.setLineDash([s * 0.15, s * 0.1]); ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
      tag(ctx, '★ ' + String(o.stunt || '').toUpperCase(), x0 + w / 2, y0 + h / 2, s * 0.26, '#FFD23F');
      break;
    }
    default: { disc(ctx, cx, cy, s * 0.3); ctx.fillStyle = fx; ctx.fill(); ctx.stroke(); }
  }
}
// A palette icon for an object type.
export function drawObjectIcon(canvas, type) {
  const ctx = canvas.getContext('2d'), s = canvas.width, spec = OBJECTS[type];
  ctx.clearRect(0, 0, s, s);
  const o = { type, x: 0, y: 0, w: 1, h: 1 };
  for (const f of spec.fields) o[f.key] = f.type === 'point' ? [0, 0] : JSON.parse(JSON.stringify(f.def));
  if (spec.kind === 'patrol') o.waypoints = [[0, -1]];
  if (o.type === 'gate') o.id = '';
  const big = { swinging_sign: 0.36, punching_bag: 0.36, giant_scissors: 0.55, cleaver_row: 0.4, laser_turret: 0.16, turnstile: 0.42, yarn_ball: 0.6, checkpoint: 0.5, floor_button: 0.6, hidden_plate: 0.6, boxing_glove: 0.36 }[type] || 0.7;
  const t = s * big;
  const P = (x, y) => [s / 2 + (x - 0.5) * t, s / 2 + (y - 0.5) * t];
  if (spec.shape === 'area') { o.w = 2; o.h = 2; o.x = 0; o.y = 0; const t2 = s * 0.34; drawObject(ctx, o, (x, y) => [s / 2 + (x - 1) * t2, s / 2 + (y - 1) * t2], t2, 0, [o]); return; }
  drawObject(ctx, o, P, t, 0, [o]);
}

// ---- the whole level ------------------------------------------------------------------------------------------
// st: { rows, level, zones, objects, ramps (from the check: [{x, y, dx, dy}]), check, view: { ox, oy, s }, layers,
//       sel, hover, ghost (preview of a stroke or a placement), lost (tile indices) }
export function drawLevel(ctx, W, H, st) {
  const { rows, view } = st, s = view.s, cols = rows[0] ? rows[0].length : 0, nrows = rows.length;
  const P = (x, y) => [view.ox + x * s, view.oy + y * s];
  ctx.fillStyle = '#120F1D'; ctx.fillRect(0, 0, W, H);
  const c0 = Math.max(0, Math.floor(-view.ox / s)), c1 = Math.min(cols - 1, Math.ceil((W - view.ox) / s));
  const r0 = Math.max(0, Math.floor(-view.oy / s)), r1 = Math.min(nrows - 1, Math.ceil((H - view.oy) / s));
  // zone floors (the last zone that covers a tile wins), rival start numbers, ramp directions
  const surf = (x, y) => { let f = st.zones[0] ? st.zones[0].floor : 'none'; for (let i = 1; i < st.zones.length; i++) { const z = st.zones[i]; if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) f = z.floor; } return f && f !== 'none' ? f : null; };
  const slots = new Map(); let n = 0;
  for (let y = 0; y < nrows; y++) for (let x = 0; x < cols; x++) if (rows[y][x] === 'r') { n++; slots.set(y * cols + x, n); }
  const rampOver = new Map((st.rampDirs || []).map((d) => [d.y * cols + d.x, DIRV[d.toward]]));
  const rampAuto = new Map((st.ramps || []).map((d) => [d.y * cols + d.x, [d.dx, d.dy]]));
  const nb = (x, y) => (dx, dy) => (rows[y + dy] || [])[x + dx] ?? ' ';
  const big = [];
  for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
    const ch = rows[y][x], [sx, sy] = P(x, y), k = y * cols + x, slot = slots.get(k);
    const info = { surface: surf(x, y), facing: st.level.start_facing, slot, slotColor: slot ? RIVAL_COLORS[(st.level.rivals || [])[slot - 1]] || '#B8C0CC' : null,
      rampDir: rampOver.get(k) || rampAuto.get(k), rampSet: rampOver.has(k) };
    if (TILE_BY_CH[ch] && TILE_BY_CH[ch].draw.big) { drawTile(ctx, '.', sx, sy, s, nb(x, y), info); big.push([ch, sx, sy, info]); continue; }
    drawTile(ctx, ch, sx, sy, s, nb(x, y), info);
  }
  for (const [ch, sx, sy, info] of big) drawTile(ctx, ch, sx, sy, s, () => ch, info);
  // the grid
  if (st.layers.grid && s >= 8) {
    ctx.strokeStyle = 'rgba(42,26,58,.13)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = c0; x <= c1 + 1; x++) { const sx = Math.round(view.ox + x * s) + 0.5; ctx.moveTo(sx, view.oy + r0 * s); ctx.lineTo(sx, view.oy + (r1 + 1) * s); }
    for (let y = r0; y <= r1 + 1; y++) { const sy = Math.round(view.oy + y * s) + 0.5; ctx.moveTo(view.ox + c0 * s, sy); ctx.lineTo(view.ox + (c1 + 1) * s, sy); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(42,26,58,.28)'; ctx.beginPath();
    for (let x = Math.ceil(c0 / 5) * 5; x <= c1 + 1; x += 5) { const sx = Math.round(view.ox + x * s) + 0.5; ctx.moveTo(sx, view.oy + r0 * s); ctx.lineTo(sx, view.oy + (r1 + 1) * s); }
    for (let y = Math.ceil(r0 / 5) * 5; y <= r1 + 1; y += 5) { const sy = Math.round(view.oy + y * s) + 0.5; ctx.moveTo(view.ox + c0 * s, sy); ctx.lineTo(view.ox + (c1 + 1) * s, sy); }
    ctx.stroke();
  }
  // tiles that cannot reach a checkout
  if (st.lost && st.lost.length) {
    ctx.strokeStyle = '#FF3B4E'; ctx.lineWidth = Math.max(1.5, s * 0.08);
    for (const i of st.lost) { const [sx, sy] = P(i % cols, Math.floor(i / cols)); ctx.beginPath(); ctx.moveTo(sx + s * 0.2, sy + s * 0.2); ctx.lineTo(sx + s * 0.8, sy + s * 0.8); ctx.moveTo(sx + s * 0.8, sy + s * 0.2); ctx.lineTo(sx + s * 0.2, sy + s * 0.8); ctx.stroke(); }
  }
  // zones and roam areas
  if (st.layers.zones) {
    st.zones.forEach((z, i) => {
      if (!i) return;
      const [x0, y0] = P(z.x, z.y), sel = st.sel && st.sel.kind === 'zone' && st.sel.i === i;
      ctx.strokeStyle = sel ? PINK : '#00A79B'; ctx.lineWidth = sel ? 3 : 2; ctx.setLineDash([s * 0.3, s * 0.15]); ctx.strokeRect(x0 + 1, y0 + 1, z.w * s - 2, z.h * s - 2); ctx.setLineDash([]);
      tag(ctx, `ZONE ${i + 1} · ${z.goods}${z.floor && z.floor !== 'none' ? ' · ' + z.floor : ''}`, x0 + Math.min(z.w * s / 2, 120), y0 + s * 0.4, Math.max(9, s * 0.28), '#D7FFF9');
    });
    for (const [r, a] of Object.entries(st.level.rival_roam || {})) {
      const [x0, y0] = P(a.x, a.y), col = RIVAL_COLORS[r] || '#B8C0CC';
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([s * 0.12, s * 0.12]); ctx.strokeRect(x0 + 3, y0 + 3, a.w * s - 6, a.h * s - 6); ctx.setLineDash([]);
      tag(ctx, 'ROAM · ' + r, x0 + Math.min(a.w * s / 2, 90), y0 + a.h * s - s * 0.4, Math.max(9, s * 0.26), col, '#FFFFFF');
    }
  }
  // the drivers' route
  if (st.layers.route && st.route && st.route.length > 1) {
    ctx.strokeStyle = 'rgba(255,79,163,.85)'; ctx.lineWidth = Math.max(2, s * 0.12); ctx.setLineDash([s * 0.25, s * 0.18]); ctx.lineCap = 'round';
    ctx.beginPath(); st.route.forEach(([x, y], k) => { const [sx, sy] = P(x + 0.5, y + 0.5); if (k) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.fillStyle = PINK;
    for (let k = 6; k < st.route.length; k += 8) { const [ax, ay] = st.route[k - 1], [bx, by] = st.route[k], l = Math.hypot(bx - ax, by - ay) || 1; const [sx, sy] = P(bx + 0.5, by + 0.5); arrowHead(ctx, sx, sy, (bx - ax) / l, (by - ay) / l, s * 0.26); }
  }
  // objects: areas first, points on top
  if (st.layers.objects) {
    const order = st.objects.map((o, i) => i).sort((a, b) => ((OBJECTS[st.objects[a].type] || {}).shape === 'area' ? 0 : 1) - ((OBJECTS[st.objects[b].type] || {}).shape === 'area' ? 0 : 1) || a - b);
    for (const i of order) drawObject(ctx, st.objects[i], P, s, i, st.objects);
  }
  // problem markers
  for (const [list, col] of [[st.check ? st.check.warnings : [], '#FFB703'], [st.check ? st.check.errors : [], '#FF3B4E']]) for (const p of list) {
    if (p.x === undefined) continue;
    const [sx, sy] = P(p.x + 0.5, p.y + 0.5);
    disc(ctx, sx + s * 0.38, sy - s * 0.38, Math.max(6, s * 0.2)); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    label(ctx, '!', sx + s * 0.38, sy - s * 0.37, Math.max(9, s * 0.28), INK);
  }
  // the selection
  const sel = st.sel;
  if (sel && sel.kind === 'object' && st.objects[sel.i]) {
    const o = st.objects[sel.i], b = objBox(o), [x0, y0] = P(b[0], b[1]), [x1, y1] = P(b[2], b[3]);
    ctx.strokeStyle = PINK; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.strokeRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6); ctx.setLineDash([]);
    for (const h of handlesOf(o)) { const [hx, hy] = P(h.x, h.y); rr(ctx, hx - 6, hy - 6, 12, 12, 3); ctx.fillStyle = h.id === 'mount' ? '#E84855' : '#FFFFFF'; ctx.fill(); ctx.strokeStyle = PINK; ctx.lineWidth = 2.5; ctx.stroke(); if (h.id.startsWith('wp')) label(ctx, String(Number(h.id.slice(2)) + 1), hx, hy + 13, 10, '#FFFFFF'); }
  }
  if (sel && sel.kind === 'tiles') {
    const x0 = Math.min(sel.x0, sel.x1), y0 = Math.min(sel.y0, sel.y1), x1 = Math.max(sel.x0, sel.x1) + 1, y1 = Math.max(sel.y0, sel.y1) + 1, [a, b] = P(x0, y0);
    ctx.fillStyle = 'rgba(255,79,163,.12)'; ctx.fillRect(a, b, (x1 - x0) * s, (y1 - y0) * s);
    ctx.strokeStyle = PINK; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(a, b, (x1 - x0) * s, (y1 - y0) * s); ctx.setLineDash([]);
  }
  // a preview of what the tool will do (a rectangle, a placement, a pasted stamp)
  const g = st.ghost;
  if (g) {
    ctx.globalAlpha = 0.65;
    if (g.tiles) for (const [x, y, ch] of g.tiles) { if (x < 0 || y < 0 || x >= cols || y >= nrows) continue; const [sx, sy] = P(x, y); drawTile(ctx, ch, sx, sy, s, () => ch, { facing: st.level.start_facing }); }
    if (g.objects) for (const o of g.objects) drawObject(ctx, o, P, s, 0, st.objects);
    ctx.globalAlpha = 1;
    if (g.rect) { const [a, b] = P(g.rect[0], g.rect[1]); ctx.strokeStyle = g.color || PINK; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(a, b, (g.rect[2] - g.rect[0]) * s, (g.rect[3] - g.rect[1]) * s); ctx.setLineDash([]); if (g.text) tag(ctx, g.text, a + (g.rect[2] - g.rect[0]) * s / 2, b - 12, 11, '#FFFFFF'); }
  }
  // the hovered tile
  if (st.hover && st.hover.x >= 0 && st.hover.y >= 0 && st.hover.x < cols && st.hover.y < nrows && !g) {
    const [sx, sy] = P(st.hover.x, st.hover.y), b = st.hover.size || 1, o = Math.floor((b - 1) / 2);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.strokeRect(sx - o * s + 1, sy - o * s + 1, b * s - 2, b * s - 2);
  }
  // rulers
  if (st.layers.coords) {
    const R = 18, step = s >= 22 ? 1 : s >= 10 ? 5 : 10;
    ctx.fillStyle = 'rgba(18,15,29,.88)'; ctx.fillRect(0, 0, W, R); ctx.fillRect(0, 0, R + 6, H);
    ctx.font = '600 10px ui-monospace, Consolas, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (let x = Math.ceil(c0 / step) * step; x <= c1; x += step) { const [sx] = P(x + 0.5, 0); if (sx > R + 10) { ctx.fillStyle = x % 5 ? '#9E93B5' : '#FFD23F'; ctx.fillText(String(x), sx, R / 2 + 1); } }
    for (let y = Math.ceil(r0 / step) * step; y <= r1; y += step) { const [, sy] = P(0, y + 0.5); if (sy > R + 4) { ctx.fillStyle = y % 5 ? '#9E93B5' : '#FFD23F'; ctx.fillText(String(y), (R + 6) / 2, sy); } }
    if (st.hover && st.hover.x >= 0) {
      const [hx] = P(st.hover.x + 0.5, 0), [, hy] = P(0, st.hover.y + 0.5);
      ctx.fillStyle = PINK; ctx.fillRect(hx - 12, 1, 24, R - 2); ctx.fillRect(1, hy - 7, R + 4, 14);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(st.hover.x), hx, R / 2 + 1); ctx.fillText(String(st.hover.y), (R + 6) / 2, hy);
    }
  }
}
