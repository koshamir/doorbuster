// DOORBUSTER — world.js
// Purpose: turns one level definition (levels.js) into the static world used by the simulation:
//          floor and zone grids, merged wall boxes, shelves with their goods, single-tile pieces,
//          checkout lanes, start slots, a spatial grid of colliders and the navigation field.
//          Also provides the collision and navigation queries.
// Exports: buildWorld, addSolid, collide, blockedAt, clearPath, tileAt, navBuild, navDistAt, navAim, PIECES
// Depends on: config.js. No DOM, no THREE (runs in Node).
//
// Plan legend (one character = one 2 m tile):
//   ' ' void (walls are generated around floor)      '.' floor
//   S M L  shelf stocked with small / medium / large goods (runs merge into rows, short runs are islands)
//   o  floor item      1 2 3  shopping-list item     @  player start     r  rival start
//   c  checkout lane (finish)   C  checkout counter
//   O round display  P can pyramid  G gift pile  K cardboard stand  H hot-item podium
//   W glass window  U roller shutter  F fountain  X Christmas tree
//   t table  b boxes  m mannequin (light, fly away)   p plant  n bench (solid decor)
//   > < ^ v travelator   ~ wet floor   R ramp   f flash-sale spot

import { CFG, GOODS, GOOD, POOLS } from './config.js';

const T = CFG.TILE;

// Single-tile pieces. r = circle radius, or hx/hz = box half sizes. Flags:
// dash = a dash breaks or opens it, soft = knocked away on touch, low = cleared by a jump,
// nav = blocks the navigation field (rivals route around it).
export const PIECES = {
  O: { type: 'display', r: 0.9, nav: 1 },
  P: { type: 'pyramid', r: 0.9, dash: 1, nav: 1 },
  G: { type: 'gifts', r: 0.9, dash: 1, nav: 1 },
  K: { type: 'stand', r: 0.7, dash: 1, nav: 1 },
  H: { type: 'podium', r: 0.85, dash: 1, nav: 1 },
  W: { type: 'glass', hx: 1, hz: 1, dash: 1, nav: 1 },
  U: { type: 'shutter', hx: 1, hz: 1, nav: 0, off: 1 },
  F: { type: 'fountain', r: 2.8, low: 1, nav: 1 },
  X: { type: 'tree', r: 1.7, nav: 1 },
  C: { type: 'counter', hx: 0.7, hz: 1, nav: 1 },
  p: { type: 'plant', r: 0.5, nav: 1 },
  n: { type: 'bench', hx: 0.9, hz: 0.45, nav: 1 },
  t: { type: 'table', r: 0.6, soft: 1 },
  b: { type: 'boxes', r: 0.55, soft: 1 },
  m: { type: 'mannequin', r: 0.4, soft: 1 },
};
const SHELF_COUNT = { S: 3, M: 2, L: 1 };   // goods per tile of shelf side

export function tileAt(world, x, z) {
  const c = Math.floor(x / T), r = Math.floor(z / T);
  if (c < 0 || r < 0 || c >= world.cols || r >= world.rows) return ' ';
  return world.plan[r][c];
}

export function buildWorld(def, rng) {
  const rows = def.plan.length;
  let cols = 0;
  for (const line of def.plan) cols = Math.max(cols, line.length);
  const plan = def.plan.map((line) => line.padEnd(cols, ' '));
  const n = cols * rows;
  const world = {
    def, plan, cols, rows, w: cols * T, h: rows * T,
    floor: new Uint8Array(n),       // 1 = walkable area (anything that is not void)
    zone: new Uint8Array(n),        // index into def.zones (0 = first zone / corridor)
    block: new Uint8Array(n),       // 1 = navigation may not pass (void or a nav-blocking piece)
    nav: new Float32Array(n),       // metres to the nearest open checkout
    navStart: 0,
    solids: [], cells: [], walls: [], shelves: [], items: [], itemCells: [], groups: [],
    pieces: [], lanes: [], drops: [], spots: [], crowdTiles: [],
    start: { x: T, z: T, h: def.heading || 0 }, slots: [],
    edge: { type: 'wall', on: true, r: 0, hx: 0, hz: 0 },   // stands in for the border of the plan
  };
  for (let i = 0; i < n; i++) { world.cells.push([]); world.itemCells.push([]); }
  const ch = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows) ? ' ' : plan[r][c];
  const open = (c, r) => { const k = ch(c, r); return k !== ' ' && !('SMLC'.includes(k)); };

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = plan[r][c], i = r * cols + c;
    world.floor[i] = k === ' ' ? 0 : 1;
    world.block[i] = k === ' ' || 'SML'.includes(k) || (PIECES[k] && PIECES[k].nav) ? 1 : 0;
  }
  (def.zones || []).forEach((zn, zi) => {
    if (!zn.rect) return;
    for (let r = zn.rect[1]; r <= zn.rect[3]; r++) for (let c = zn.rect[0]; c <= zn.rect[2]; c++) world.zone[r * cols + c] = zi;
  });

  buildWalls(world);
  buildShelves(world, ch, open, rng);

  // Single-tile pieces, pickups, starts, lanes.
  let dropKind = 0;
  const laneOf = new Int16Array(n).fill(-1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = plan[r][c], x = (c + 0.5) * T, z = (r + 0.5) * T, i = r * cols + c;
    const zdef = (def.zones || [])[world.zone[i]] || {};
    const pool = POOLS[zdef.pool || 'market'];
    if (PIECES[k]) {
      const p = PIECES[k];
      const piece = { type: p.type, x, z, c, r, alive: true, t: 0, solid: null };
      // Counters next to each other along z read as one long counter; keep each tile's own box.
      piece.solid = addSolid(world, { x, z, r: p.r || 0, hx: p.hx || 0, hz: p.hz || 0, type: p.type,
        on: !p.off, low: !!p.low, soft: !!p.soft, dash: !!p.dash, piece });
      world.pieces.push(piece);
    } else if (k === 'o') {
      const id = pool.S[(dropKind++ >> 2) % pool.S.length];
      world.drops.push({ x, z, good: GOOD[id], ttl: -1, live: true, list: 0, arm: 0 });
    } else if (k === '1' || k === '2' || k === '3') {
      const id = (def.list || [])[Number(k) - 1];
      if (id) world.drops.push({ x, z, good: GOOD[id], ttl: -1, live: true, list: Number(k), arm: 0 });   // list = which of the three
    } else if (k === '@') {
      world.start.x = x; world.start.z = z;
    } else if (k === 'r') {
      world.slots.push({ x, z });
    } else if (k === 'f') {
      world.spots.push({ x, z });
    } else if (k === 'c' && laneOf[i] < 0) {
      // Flood-fill one checkout lane.
      const lane = { id: world.lanes.length, tiles: [], x: 0, z: 0, open: true };
      const stack = [[c, r]];
      laneOf[i] = lane.id;
      while (stack.length) {
        const [cc, rr] = stack.pop();
        lane.tiles.push(rr * cols + cc);
        lane.x += (cc + 0.5) * T; lane.z += (rr + 0.5) * T;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (rr + dr) * cols + cc + dc;
          if (ch(cc + dc, rr + dr) === 'c' && laneOf[j] < 0) { laneOf[j] = lane.id; stack.push([cc + dc, rr + dr]); }
        }
      }
      lane.x /= lane.tiles.length; lane.z /= lane.tiles.length;
      world.lanes.push(lane);
    }
    if (k === '.' || k === 'o') world.crowdTiles.push(i);
  }
  world.laneOf = laneOf;
  navBuild(world);
  world.navStart = navDistAt(world, world.start.x, world.start.z);
  return world;
}

// ---- Walls: every void tile, merged greedily into as few boxes as possible. --------------------
function buildWalls(world) {
  const { cols, rows, floor } = world;
  const used = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (floor[r * cols + c] || used[r * cols + c]) continue;
    let c1 = c;
    while (c1 + 1 < cols && !floor[r * cols + c1 + 1] && !used[r * cols + c1 + 1]) c1++;
    let r1 = r, grow = true;
    while (grow && r1 + 1 < rows) {
      for (let cc = c; cc <= c1; cc++) if (floor[(r1 + 1) * cols + cc] || used[(r1 + 1) * cols + cc]) { grow = false; break; }
      if (grow) r1++;
    }
    for (let rr = r; rr <= r1; rr++) for (let cc = c; cc <= c1; cc++) used[rr * cols + cc] = 1;
    const box = { x: (c + c1 + 1) * T / 2, z: (r + r1 + 1) * T / 2, hx: (c1 - c + 1) * T / 2, hz: (r1 - r + 1) * T / 2 };
    world.walls.push(box);
    addSolid(world, { x: box.x, z: box.z, r: 0, hx: box.hx, hz: box.hz, type: 'wall', on: true });
  }
}

// ---- Shelves: runs of S/M/L tiles. Long runs are rows, runs of 1-2 tiles are islands. ----------
function buildShelves(world, ch, open, rng) {
  const { cols, rows, plan } = world;
  const seen = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = plan[r][c];
    if (!SHELF_COUNT[k] || seen[r * cols + c]) continue;
    const horiz = ch(c + 1, r) === k;          // runs extend east first, otherwise south
    let len = 1;
    for (;;) {
      const cc = horiz ? c + len : c, rr = horiz ? r : r + len;
      if (ch(cc, rr) !== k || seen[rr * cols + cc]) break;
      len++;
    }
    for (let i = 0; i < len; i++) seen[(horiz ? r : r + i) * cols + (horiz ? c + i : c)] = 1;
    // Which long sides face walkable floor? side -1 = north/west, +1 = south/east.
    let openA = 0, openB = 0;
    for (let i = 0; i < len; i++) {
      const cc = horiz ? c + i : c, rr = horiz ? r : r + i;
      if (open(horiz ? cc : cc - 1, horiz ? rr - 1 : rr)) openA++;
      if (open(horiz ? cc : cc + 1, horiz ? rr + 1 : rr)) openB++;
    }
    const a = openA * 2 > len, b = openB * 2 > len;
    const depth = a && b ? 1.4 : a || b ? 1.2 : 2;
    const shift = a && b ? 0 : a ? (T - depth) / 2 : b ? -(T - depth) / 2 : 0;  // push against the closed side
    const along = len * T;
    const cx = horiz ? (c + len / 2) * T : (c + 0.5) * T + shift;
    const cz = horiz ? (r + 0.5) * T + shift : (r + len / 2) * T;
    const shelf = {
      x: cx, z: cz, hx: horiz ? along / 2 : depth / 2, hz: horiz ? depth / 2 : along / 2,
      horiz, len, kind: k, island: len <= 2 && a && b, zone: world.zone[r * cols + c], sides: [a, b],
    };
    shelf.solid = addSolid(world, { x: cx, z: cz, r: 0, hx: shelf.hx, hz: shelf.hz, type: 'shelf', on: true, shelf });
    world.shelves.push(shelf);

    const zdef = (world.def.zones || [])[shelf.zone] || {};
    const pool = (POOLS[zdef.pool || 'market'])[k];
    const per = SHELF_COUNT[k];
    const pickStart = rng.int(pool.length);
    const islandGroup = shelf.island ? newGroup(world, shelf) : -1;
    for (const side of [-1, 1]) {
      if (!(side < 0 ? a : b)) continue;
      const group = shelf.island ? islandGroup : newGroup(world, shelf);
      for (let i = 0; i < len; i++) {
        const cc = horiz ? c + i : c, rr = horiz ? r : r + i;
        if (!open(horiz ? cc : cc + side, horiz ? rr + side : rr)) continue;
        const good = GOOD[pool[(pickStart + i + (side > 0 ? 1 : 0)) % pool.length]];
        for (let j = 0; j < per; j++) {
          const t = -along / 2 + (i + (j + 0.5) / per) * T;
          const inset = depth / 2 - GOODS[good].dims[2] / 2 - 0.05;
          addItem(world, group, good,
            horiz ? cx + t : cx + side * inset, horiz ? cz + side * inset : cz + t,
            horiz ? 0 : side, horiz ? side : 0);
        }
      }
    }
    if (shelf.island) {          // islands also carry goods on both ends
      for (const end of [-1, 1]) {
        const ec = horiz ? (end < 0 ? c - 1 : c + len) : c, er = horiz ? r : (end < 0 ? r - 1 : r + len);
        if (!open(ec, er)) continue;
        const good = GOOD[pool[(pickStart + 3 + end) % pool.length]];
        const inset = along / 2 - GOODS[good].dims[2] / 2 - 0.05;
        const count = k === 'S' ? 2 : 1;
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count * depth - depth / 2;
          addItem(world, islandGroup, good,
            horiz ? cx + end * inset : cx + t, horiz ? cz + t : cz + end * inset,
            horiz ? end : 0, horiz ? 0 : end);
        }
      }
    }
  }
}
function newGroup(world, shelf) {
  world.groups.push({ shelf, left: 0, total: 0, by: -1, mixed: false });
  return world.groups.length - 1;
}
function addItem(world, group, good, x, z, nx, nz) {
  const item = { x, z, y: 0.55, nx, nz, good, group, taken: false };
  world.groups[group].left++; world.groups[group].total++;
  const c = Math.floor(x / T), r = Math.floor(z / T);
  world.itemCells[r * world.cols + c].push(world.items.length);
  world.items.push(item);
}

// ---- Colliders ---------------------------------------------------------------------------------
export function addSolid(world, s) {
  const index = world.solids.length;
  world.solids.push(s);
  const ex = s.r || s.hx, ez = s.r || s.hz;
  const c0 = Math.max(0, Math.floor((s.x - ex) / T)), c1 = Math.min(world.cols - 1, Math.floor((s.x + ex - 1e-6) / T));
  const r0 = Math.max(0, Math.floor((s.z - ez) / T)), r1 = Math.min(world.rows - 1, Math.floor((s.z + ez - 1e-6) / T));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) world.cells[r * world.cols + c].push(index);
  return s;
}

// The deepest contact between a circle and the active solids, or null. The result object is reused.
// air = true skips solids that a jumping cart clears. skipSoft = true ignores light props.
const hit = { nx: 0, nz: 0, depth: 0, solid: null };
export function collide(world, x, z, rad, air, skipSoft) {
  const c0 = Math.max(0, Math.floor((x - rad) / T)), c1 = Math.min(world.cols - 1, Math.floor((x + rad) / T));
  const r0 = Math.max(0, Math.floor((z - rad) / T)), r1 = Math.min(world.rows - 1, Math.floor((z + rad) / T));
  let best = 0;
  hit.solid = null;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const cell = world.cells[r * world.cols + c];
    for (let k = 0; k < cell.length; k++) {
      const s = world.solids[cell[k]];
      if (!s.on || (air && s.low) || (skipSoft && s.soft)) continue;
      const dx = x - s.x, dz = z - s.z;
      let nx, nz, depth;
      if (s.r) {
        const d2 = dx * dx + dz * dz, rr = rad + s.r;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        depth = rr - d;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; } else { nx = 1; nz = 0; }
      } else {
        const px = dx < -s.hx ? -s.hx : dx > s.hx ? s.hx : dx;
        const pz = dz < -s.hz ? -s.hz : dz > s.hz ? s.hz : dz;
        const ox = dx - px, oz = dz - pz, d2 = ox * ox + oz * oz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          depth = rad - d; nx = ox / d; nz = oz / d;
        } else {                              // centre inside the box: leave by the nearest face
          const ex = s.hx - Math.abs(dx), ez = s.hz - Math.abs(dz);
          if (ex < ez) { nx = dx < 0 ? -1 : 1; nz = 0; depth = ex + rad; } else { nx = 0; nz = dz < 0 ? -1 : 1; depth = ez + rad; }
        }
      }
      if (depth > best) { best = depth; hit.nx = nx; hit.nz = nz; hit.depth = depth; hit.solid = s; }
    }
  }
  // The border of the plan is solid even where a level leaves floor on the edge.
  if (rad - x > best) { best = rad - x; hit.nx = 1; hit.nz = 0; hit.depth = best; hit.solid = world.edge; }
  if (x + rad - world.w > best) { best = x + rad - world.w; hit.nx = -1; hit.nz = 0; hit.depth = best; hit.solid = world.edge; }
  if (rad - z > best) { best = rad - z; hit.nx = 0; hit.nz = 1; hit.depth = best; hit.solid = world.edge; }
  if (z + rad - world.h > best) { best = z + rad - world.h; hit.nx = 0; hit.nz = -1; hit.depth = best; hit.solid = world.edge; }
  return hit.solid ? hit : null;
}

export function blockedAt(world, x, z, rad) {
  if (x < 0 || z < 0 || x >= world.w || z >= world.h) return true;
  return collide(world, x, z, rad, false, true) !== null;
}

// True if a circle of radius rad can travel the straight segment without touching a solid.
export function clearPath(world, x0, z0, x1, z1, rad) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / 0.6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blockedAt(world, x0 + dx * t, z0 + dz * t, rad)) return false;
  }
  return true;
}

// ---- Navigation: distance to the nearest open checkout over the tile grid. ----------------------
const NEIGH = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
export function navBuild(world) {
  const { cols, rows, nav, block } = world;
  const n = cols * rows;
  // A tile next to a blocked tile costs more, so paths prefer the middle of a corridor.
  const cost = new Float32Array(n);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let near = 0;
    for (const [dc, dr] of NEIGH) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || block[rr * cols + cc]) near++;
    }
    cost[r * cols + c] = near ? 1.3 : 1;
  }
  nav.fill(1e9);
  const queue = [];
  for (const lane of world.lanes) {
    if (!lane.open) continue;
    for (const i of lane.tiles) { nav[i] = 0; queue.push(i); }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], c = i % cols, r = (i - c) / cols;
    for (const [dc, dr, w] of NEIGH) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const j = rr * cols + cc;
      if (block[j]) continue;
      if (dc && dr && (block[r * cols + cc] || block[rr * cols + c])) continue;   // no corner cutting
      const d = nav[i] + w * T * cost[j];
      if (d < nav[j] - 1e-4) { nav[j] = d; queue.push(j); }
    }
  }
}

// Navigation distance at a world position (the tile's value, or its best neighbour if blocked).
export function navDistAt(world, x, z) {
  const c = Math.min(world.cols - 1, Math.max(0, Math.floor(x / T)));
  const r = Math.min(world.rows - 1, Math.max(0, Math.floor(z / T)));
  let best = world.nav[r * world.cols + c];
  if (best < 1e8) return best;
  for (const [dc, dr] of NEIGH) {
    const cc = c + dc, rr = r + dr;
    if (cc < 0 || rr < 0 || cc >= world.cols || rr >= world.rows) continue;
    best = Math.min(best, world.nav[rr * world.cols + cc] + T);
  }
  return best;
}

// Where to drive from (x, z): walks the field downhill for up to `steps` tiles and returns in `out`
// the farthest point on that walk that is visible in a straight line and no more than `reach` metres
// along it (out.x, out.z), the end of the walk (out.fx, out.fz) and the distance left (out.left).
// A short reach keeps a driver on the path through narrow places; a long one cuts corners.
// Returns false if there is no way.
export function navAim(world, x, z, steps, rad, out, reach) {
  const { cols, rows, nav, block } = world;
  let c = Math.min(cols - 1, Math.max(0, Math.floor(x / T))), r = Math.min(rows - 1, Math.max(0, Math.floor(z / T)));
  if (nav[r * cols + c] >= 1e8) {               // standing on a blocked tile: hop to the best neighbour
    let best = 1e9, bc = c, br = r;
    for (const [dc, dr] of NEIGH) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      if (nav[rr * cols + cc] < best) { best = nav[rr * cols + cc]; bc = cc; br = rr; }
    }
    if (best >= 1e8) return false;
    c = bc; r = br;
  }
  out.left = nav[r * cols + c];
  out.x = out.fx = (c + 0.5) * T; out.z = out.fz = (r + 0.5) * T;
  let len = 0;
  for (let s = 0; s < steps; s++) {
    const here = nav[r * cols + c];
    let best = here, bc = c, br = r, near = 1e9;
    for (const [dc, dr] of NEIGH) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      if (dc && dr && (block[r * cols + cc] || block[rr * cols + c])) continue;
      const d = nav[rr * cols + cc];
      if (d >= here - 1e-4 || d > best + 0.75) continue;
      // Two ways of nearly the same length (either side of an island): take the one nearer the cart.
      const off = Math.hypot((cc + 0.5) * T - x, (rr + 0.5) * T - z);
      if (d < best - 0.75 || off < near) { best = Math.min(best, d); bc = cc; br = rr; near = off; }
    }
    if (bc === c && br === r) break;
    len += bc !== c && br !== r ? T * 1.414 : T;
    c = bc; r = br;
    const px = (c + 0.5) * T, pz = (r + 0.5) * T;
    out.fx = px; out.fz = pz;
    if (s < 2 || (len <= reach && clearPath(world, x, z, px, pz, rad))) { out.x = px; out.z = pz; }
  }
  return true;
}
