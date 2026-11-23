// DOORBUSTER — atlas.js
// Purpose: the canvas atlases drawn at load (ART.md sections 3, 5 and 6): faces (seven expressions and a
//          blink for every named character, four shared crowd styles), patterns (fabrics, seams, prints,
//          cart paints and decals), product labels and the store-kit signs. Each is one 2048 px canvas
//          turned into a texture once and cached.
// Exports: EXPR, PAT, LABELS, KIT, faceAtlas, faceCell, crowdCell, patternAtlas, labelAtlas, kitAtlas, atlasTex, inkStyle
// Depends on: the global THREE (inside functions only).
//
// Faces: cells of 256 px, row = character (cast.js face.row), column = expression; the crowd styles sit
// in the last row in 128 px cells (16 across, 2 down: style s, expression e -> col (s % 2) * 8 + e).


export const EXPR = { neutral: 0, happy: 1, shocked: 2, angry: 3, dizzy: 4, crying: 5, smug: 6, blink: 7 };
const INK = '#2A1A3A', hex = (v) => typeof v === 'string' ? v : '#' + v.toString(16).padStart(6, '0');
export const inkStyle = INK;
const cache = {};

export function atlasTex(canvas) {
  const T = THREE, t = new T.CanvasTexture(canvas);
  t.flipY = false; t.colorSpace = T.NoColorSpace; t.anisotropy = 4;
  t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true;
  return t;
}
function canvas(n = 2048) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }

// ---- faces ------------------------------------------------------------------------------------------------
// uv origin of a named character's face cell (cell size 1/8).
export function faceCell(row, expr) { return [expr / 8, row / 8]; }
// uv origin of a crowd face cell (cell size 1/16).
export function crowdCell(style, expr) { return [((style % 2) * 8 + expr) / 16, (14 + Math.floor(style / 2)) / 16]; }

// faces: [{ row, ...face style }] for the named cast, crowd: [face styles] for the four crowd cells.
export function faceAtlas(faces, crowd) {
  if (cache.face) return cache.face;
  const cv = canvas(), g = cv.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const f of faces) for (let e = 0; e < 8; e++) { g.save(); g.translate(e * 256, f.row * 256); drawFace(g, f, e); g.restore(); }
  crowd.forEach((f, s) => { for (let e = 0; e < 8; e++) { g.save(); g.translate(((s % 2) * 8 + e) * 128, 1792 + Math.floor(s / 2) * 128); g.scale(0.5, 0.5); drawFace(g, f, e); g.restore(); } });
  return (cache.face = atlasTex(cv));
}

// One face in a 256 px cell. f: { skin, iris, lash, brow, browW, blush, freckles, wrinkles, lips, shadow, eyeY,
// eyeGap, eyeW, eyeH, mouthY, mouthW, hideEyes (behind sunglasses: brows only), dots (far LOD) }.
function drawFace(g, f, e) {
  const ink = INK, ey = f.eyeY || 112, gap = f.eyeGap || 47, ew = f.eyeW || 29, eh = f.eyeH || 34, my = f.mouthY || 188, mw = (f.mouthW || 1);
  if (f.dots) { g.fillStyle = ink; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 40, 120, 14, 18, 0, 0, 7); g.fill(); } return; }
  // cheeks: blush, freckles, wrinkles
  if (f.blush) { g.fillStyle = hex(f.blush); g.globalAlpha = e === 3 ? 0.55 : 0.38; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 74, ey + 54, 24, 13, 0, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (f.freckles) { g.fillStyle = hex(f.freckles); for (const s of [-1, 1]) for (const [dx, dy] of [[-12, -4], [0, 4], [12, -3], [5, -12], [-6, 10]]) { g.beginPath(); g.arc(128 + s * (70 + dx), ey + 50 + dy, 3.2, 0, 7); g.fill(); } }
  if (f.wrinkles) { g.strokeStyle = hex(f.wrinkles); g.lineWidth = 4; for (const s of [-1, 1]) { for (const k of [0, 1]) { g.beginPath(); g.arc(128 + s * (gap + ew + 18), ey + k * 12 - 4, 12, s > 0 ? 2.6 : -0.5, s > 0 ? 3.6 : 0.5); g.stroke(); } g.beginPath(); g.arc(128 + s * gap, ey + eh + 6, ew * 0.8, 0.5, 2.6); g.stroke(); } }
  // eyes
  for (const s of [-1, 1]) if (!f.hideEyes) eye(g, 128 + s * gap, ey, ew, eh, s, f, e);
  if (f.shadow && !f.hideEyes && e !== 1 && e !== 5 && e !== 7) { g.globalAlpha = 0.5; g.fillStyle = hex(f.shadow); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * gap, ey - eh * 0.9, ew * 1.1, eh * 0.45, 0, Math.PI, 0); g.fill(); } g.globalAlpha = 1; }
  brows(g, ey - eh - (f.hideEyes ? 26 : 14), gap, ew, s => s, f, e);
  mouth(g, 128, my, mw, f, e);
  if (e === 5) {                                   // tears: two streams down the cheeks
    g.fillStyle = '#7CC6FE'; g.strokeStyle = ink; g.lineWidth = 3.5;
    for (const s of [-1, 1]) { const x = 128 + s * (gap + 6); g.beginPath(); g.moveTo(x - 9, ey + 10); g.quadraticCurveTo(x - 14 + s * 6, ey + 60, x - 6, ey + 110); g.lineTo(x + 8, ey + 110); g.quadraticCurveTo(x + 12 + s * 6, ey + 60, x + 9, ey + 10); g.closePath(); g.fill(); g.stroke(); }
  }
  if (e === 3) {                                   // an anger vein on the forehead
    g.strokeStyle = '#E63946'; g.lineWidth = 6;
    const x = 128 + 62, y = ey - eh - 44;
    for (const a of [0.6, 2.2, 3.8, 5.4]) { g.beginPath(); g.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, a + 1.2, a + 2.8); g.stroke(); }
  }
}

function eye(g, x, y, ew, eh, s, f, e) {
  const ink = INK, skin = hex(f.skin || 0xFFD2B0);
  g.lineWidth = 5; g.strokeStyle = ink;
  if (e === 1 || e === 7 || e === 5) {           // happy: ^ arcs; blink: closed lids; crying: squeezed shut
    g.lineWidth = 8;
    g.beginPath();
    if (e === 1) g.arc(x, y + eh * 0.45, ew * 0.95, Math.PI * 1.12, Math.PI * 1.88);
    else if (e === 7) g.arc(x, y - eh * 0.35, ew * 0.95, Math.PI * 0.15, Math.PI * 0.85);
    else { g.moveTo(x - s * ew * 0.9, y - eh * 0.45); g.lineTo(x + s * ew * 0.6, y); g.lineTo(x - s * ew * 0.9, y + eh * 0.35); }
    g.stroke();
    if (f.lash && e !== 5) { g.lineWidth = 5; g.beginPath(); const a = e === 1 ? Math.PI * (s > 0 ? 1.88 : 1.12) : Math.PI * (s > 0 ? 0.15 : 0.85), r = ew * 0.95, cy = e === 1 ? y + eh * 0.45 : y - eh * 0.35;
      g.moveTo(x + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r + s * 10, cy + Math.sin(a) * r - 8); g.stroke(); }
    return;
  }
  const wide = e === 2 ? 1.12 : 1, rx = ew * wide, ry = eh * wide;
  // sclera
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.clip();
  if (e === 4) {                                    // dizzy: spirals
    g.strokeStyle = ink; g.lineWidth = 4.5; g.beginPath();
    for (let a = 0; a < 16; a += 0.2) { const r = 1.5 + a * 1.55, px = x + Math.cos(a * s) * r, py = y + Math.sin(a * s) * r * 1.1; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  } else {
    const look = e === 6 ? [s * 0.0 + 0.35, 0.05] : e === 3 ? [-s * 0.12, 0.08] : [0.04 * -s, 0.12];
    const ir = (e === 2 ? 0.42 : 0.66) * ew, ix = x + look[0] * ew, iy = y + look[1] * eh;
    g.fillStyle = hex(f.iris || 0x3A86FF); g.beginPath(); g.arc(ix, iy, ir, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.arc(ix, iy + ir * 0.35, ir * 0.7, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(42,26,58,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(ix, iy, ir, 0, 7); g.stroke();
    g.fillStyle = ink; g.beginPath(); g.arc(ix, iy, ir * (e === 2 ? 0.45 : 0.5), 0, 7); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(ix - ir * 0.35, iy - ir * 0.38, ir * 0.3, 0, 7); g.fill();
    g.beginPath(); g.arc(ix + ir * 0.32, iy + ir * 0.34, ir * 0.13, 0, 7); g.fill();
  }
  // lids: smug is half shut, angry slants down to the nose, neutral rests a little over the iris
  const lid = e === 6 ? 0.46 : e === 3 ? 0.3 : e === 2 ? -0.2 : f.lid || 0.1;
  if (lid > 0) {
    g.fillStyle = skin; g.beginPath();
    const top = y - ry - 4, cut = y - ry + lid * 2 * ry, slant = e === 3 ? s * ry * 0.5 : 0;
    g.moveTo(x - rx - 4, top); g.lineTo(x + rx + 4, top); g.lineTo(x + rx + 4, cut - slant); g.lineTo(x - rx - 4, cut + slant); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(x - rx, cut + slant * 0.98); g.lineTo(x + rx, cut - slant * 0.98); g.stroke();
  }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.stroke();
  // the bold upper lid line and a lash flick at the outer corner
  g.lineWidth = 8; g.beginPath(); g.ellipse(x, y, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  if (f.lash) { g.lineWidth = 6; g.beginPath(); g.moveTo(x + s * rx * 0.86, y - ry * 0.5); g.lineTo(x + s * (rx + 11), y - ry * 0.85); g.moveTo(x + s * rx * 0.6, y - ry * 0.82); g.lineTo(x + s * (rx + 2), y - ry * 1.18); g.stroke(); }
}

function brows(g, y, gap, ew, _, f, e) {
  if (f.brow === false) return;
  g.strokeStyle = hex(f.brow || INK); g.lineWidth = f.browW || 11; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const x = 128 + s * gap, w = ew * 1.05;
    let inner = 0, outer = 0, lift = 0;
    if (e === 2) lift = -14; else if (e === 3) { inner = 14; outer = -8; } else if (e === 5) { inner = -12; outer = 6; } else if (e === 6) { if (s > 0) lift = -10; else { inner = 4; } }
    else if (e === 4) { inner = s * 6; outer = -s * 6; } else if (e === 1) lift = -6;
    g.beginPath();
    g.moveTo(x - s * w * 0.95, y + inner + lift);
    g.quadraticCurveTo(x, y - 7 + lift + (inner + outer) * 0.3, x + s * w * 0.95, y + outer + lift + 3);
    g.stroke();
    if (f.browInk) { g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.strokeStyle = hex(f.brow); g.lineWidth = f.browW || 11; }
  }
}

function mouth(g, x, y, mw, f, e) {
  const ink = INK, dark = '#5A1E3A', tongue = '#FF7A93', lips = f.lips ? hex(f.lips) : null;
  g.strokeStyle = ink; g.lineWidth = 6; g.lineJoin = 'round';
  const shape = (pts, fill) => { g.beginPath(); pts(); g.closePath(); g.fillStyle = fill; g.fill(); g.stroke(); };
  if (e === 0 || e === 7) {                         // a soft smile
    g.lineWidth = 7; g.beginPath(); g.moveTo(x - 24 * mw, y - 4); g.quadraticCurveTo(x, y + 14, x + 24 * mw, y - 4); g.stroke();
    if (lips) { g.strokeStyle = lips; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 20 * mw, y); g.quadraticCurveTo(x, y + 14, x + 20 * mw, y); g.stroke(); }
  } else if (e === 1) {                             // a big open grin with teeth and tongue
    shape(() => { g.moveTo(x - 36 * mw, y - 14); g.quadraticCurveTo(x, y - 6, x + 36 * mw, y - 14); g.quadraticCurveTo(x + 30 * mw, y + 34, x, y + 36); g.quadraticCurveTo(x - 30 * mw, y + 34, x - 36 * mw, y - 14); }, dark);
    g.save(); g.clip(); g.fillStyle = '#FFFFFF'; g.fillRect(x - 40 * mw, y - 20, 80 * mw, 14); g.fillStyle = tongue; g.beginPath(); g.ellipse(x, y + 34, 22 * mw, 14, 0, 0, 7); g.fill(); g.restore();
    g.beginPath(); g.moveTo(x - 36 * mw, y - 14); g.quadraticCurveTo(x, y - 6, x + 36 * mw, y - 14); g.quadraticCurveTo(x + 30 * mw, y + 34, x, y + 36); g.quadraticCurveTo(x - 30 * mw, y + 34, x - 36 * mw, y - 14); g.stroke();
  } else if (e === 2) {                             // O
    shape(() => g.ellipse(x, y + 6, 15 * mw, 21, 0, 0, 7), dark);
    g.save(); g.beginPath(); g.ellipse(x, y + 6, 15 * mw, 21, 0, 0, 7); g.clip(); g.fillStyle = tongue; g.beginPath(); g.ellipse(x, y + 24, 12, 9, 0, 0, 7); g.fill(); g.restore();
    g.beginPath(); g.ellipse(x, y + 6, 15 * mw, 21, 0, 0, 7); g.stroke();
  } else if (e === 3) {                             // gritted teeth
    shape(() => { g.moveTo(x - 32 * mw, y - 8); g.lineTo(x + 32 * mw, y - 12); g.lineTo(x + 28 * mw, y + 14); g.lineTo(x - 28 * mw, y + 12); }, '#FFFFFF');
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(x - 30 * mw, y + 1); g.lineTo(x + 30 * mw, y - 1);
    for (const k of [-15, 0, 15]) { g.moveTo(x + k * mw, y - 10); g.lineTo(x + k * mw, y + 13); } g.stroke();
  } else if (e === 4) {                             // dizzy: a wobbly line, tongue out
    g.lineWidth = 7; g.beginPath(); g.moveTo(x - 30 * mw, y); for (let i = 1; i <= 6; i++) g.lineTo(x - 30 * mw + i * 10 * mw, y + (i % 2 ? -7 : 5)); g.stroke();
    shape(() => g.ellipse(x + 10 * mw, y + 12, 9, 12, 0, 0, Math.PI), tongue);
  } else if (e === 5) {                             // crying: a wide wail
    shape(() => { g.moveTo(x - 30 * mw, y - 8); g.lineTo(x + 30 * mw, y - 8); g.quadraticCurveTo(x + 40 * mw, y + 40, x, y + 42); g.quadraticCurveTo(x - 40 * mw, y + 40, x - 30 * mw, y - 8); }, dark);
    g.save(); g.clip(); g.fillStyle = '#FFFFFF'; g.fillRect(x - 32 * mw, y - 12, 64 * mw, 11); g.fillStyle = tongue; g.beginPath(); g.ellipse(x, y + 40, 20, 13, 0, 0, 7); g.fill(); g.restore();
    g.beginPath(); g.moveTo(x - 30 * mw, y - 8); g.lineTo(x + 30 * mw, y - 8); g.quadraticCurveTo(x + 40 * mw, y + 40, x, y + 42); g.quadraticCurveTo(x - 40 * mw, y + 40, x - 30 * mw, y - 8); g.stroke();
  } else if (e === 6) {                             // smug smirk
    g.lineWidth = 7; g.beginPath(); g.moveTo(x - 22 * mw, y + 4); g.quadraticCurveTo(x + 6, y + 10, x + 26 * mw, y - 10); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(x + 22 * mw, y - 15); g.lineTo(x + 30 * mw, y - 5); g.stroke();
  }
}

// ---- patterns ---------------------------------------------------------------------------------------------
// Cells of 256 px on an 8 x 8 grid. RGB is the print's colour, alpha its coverage over the base colour.
export const PAT = { seams: 0, stripes: 1, dots: 2, floral: 3, track: 4, logo: 5, plaid: 6, knit: 7, grid: 8, candy: 9, galaxy: 10, flames: 11,
  number: 12, coupons: 13, hazard: 14, tartan: 15, denim: 16, mesh: 17, checker: 18, net: 19, screen: 20, chrome: 21, cuff: 22, sole: 23, leopard: 24,
  ringlight: 25, logoBlue: 26, zip: 27, camo: 28, laces: 29, star: 30, vest: 31, receipt: 32 };
export function patternAtlas() {
  if (cache.pat) return cache.pat;
  const cv = canvas(), g = cv.getContext('2d'), S = 256;
  const cell = (i, fn) => { g.save(); g.translate((i % 8) * S, Math.floor(i / 8) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(g); g.restore(); };
  const dash = (x0, y0, x1, y1, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); };
  const seam = 'rgba(42,26,58,0.42)';
  cell(PAT.seams, () => { dash(64, 0, 64, 256, 3, seam); dash(192, 0, 192, 256, 3, seam); dash(0, 232, 256, 232, 3, seam); });
  cell(PAT.stripes, () => { g.fillStyle = '#FFFFFF'; for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 26); });
  cell(PAT.dots, () => { g.fillStyle = '#FFFFFF'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 64 + (y % 2) * 32 + 16, y * 64 + 32, 12, 0, 7); g.fill(); } });
  cell(PAT.floral, () => {
    const fl = (x, y, r, c) => { g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, 0, 7); g.fill(); } g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(x, y, r * 0.32, 0, 7); g.fill(); };
    g.fillStyle = 'rgba(255,255,255,0.16)'; for (let k = 0; k < 40; k++) g.fillRect((k * 53) % 256, (k * 97) % 256, 6, 6);
    for (const [x, y, r, c] of [[40, 40, 22, '#FFF1F7'], [170, 70, 18, '#FFB3D1'], [100, 150, 24, '#FFF1F7'], [220, 200, 20, '#C8F2E0'], [30, 210, 16, '#FFB3D1'], [230, 10, 14, '#FFF1F7'], [250, 120, 12, '#C8F2E0']]) {
      for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) fl(x + dx, y + dy, r, c);
    }
  });
  cell(PAT.track, () => { g.fillStyle = '#FFFFFF'; g.fillRect(52, 0, 14, 256); g.fillRect(76, 0, 14, 256); g.fillRect(180, 0, 14, 256); g.fillRect(204, 0, 14, 256); });
  cell(PAT.logo, () => { g.font = '900 190px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 16; g.strokeStyle = INK; g.strokeText('%', 128, 140); g.fillStyle = '#FFFFFF'; g.fillText('%', 128, 140); });
  cell(PAT.plaid, () => { g.fillStyle = 'rgba(42,26,58,0.22)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 64 + 20, 0, 18, 256); g.fillRect(0, k * 64 + 20, 256, 18); } g.fillStyle = 'rgba(255,255,255,0.3)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 64 + 50, 0, 4, 256); g.fillRect(0, k * 64 + 50, 256, 4); } });
  cell(PAT.knit, () => { g.strokeStyle = 'rgba(42,26,58,0.16)'; g.lineWidth = 4; for (let y = 0; y < 256; y += 21) for (let x = 0; x < 256; x += 21) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 14); g.lineTo(x + 20, y); g.stroke(); } });
  cell(PAT.grid, () => { g.fillStyle = 'rgba(42,26,58,0.42)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 64 + 26, 0, 12, 256); g.fillRect(0, k * 64 + 26, 256, 12); } g.fillStyle = 'rgba(255,255,255,0.5)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 64 + 24, 0, 3, 256); g.fillRect(0, k * 64 + 24, 256, 3); } });
  cell(PAT.candy, () => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#FF4FA3'; for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 32, 0); g.lineTo(k * 64 + 32 + 256, 256); g.lineTo(k * 64 + 256, 256); g.fill(); } });
  cell(PAT.galaxy, () => { g.fillStyle = '#231A4E'; g.fillRect(0, 0, 256, 256); const grad = g.createRadialGradient(90, 110, 10, 90, 110, 140); grad.addColorStop(0, 'rgba(155,93,229,0.9)'); grad.addColorStop(1, 'rgba(155,93,229,0)'); g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 40; k++) { const x = (k * 71) % 256, y = (k * 113) % 256, r = k % 5 === 0 ? 4 : 1.8; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
  cell(PAT.flames, () => { for (const [c, k] of [['#E63946', 1], ['#FF9F1C', 0.7], ['#FFD23F', 0.42]]) { g.fillStyle = c; g.beginPath(); g.moveTo(0, 256); for (let x = 0; x <= 256; x += 32) { g.lineTo(x + 16, 256 - 200 * k - (x % 64 ? 30 : 0) * k); g.lineTo(x + 32, 256 - 60 * k); } g.lineTo(256, 256); g.fill(); } });
  cell(PAT.number, () => { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.stroke(); g.font = '900 140px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('07', 128, 136); });
  cell(PAT.coupons, () => { g.fillStyle = '#FFF6D6'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 4; k++) { const y = k * 64; g.strokeStyle = '#FF5A4E'; g.setLineDash([8, 6]); g.lineWidth = 4; g.strokeRect(8, y + 6, 240, 52); g.setLineDash([]); g.font = '900 34px "Arial Black", sans-serif'; g.fillStyle = '#FF5A4E'; g.fillText((k + 2) * 10 + '% OFF', 30, y + 46); } });
  cell(PAT.hazard, () => { g.fillStyle = '#FFD23F'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#2A1A3A'; for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 32, 0); g.lineTo(k * 64 + 32 + 256, 256); g.lineTo(k * 64 + 256, 256); g.fill(); } });
  cell(PAT.tartan, () => { g.fillStyle = '#C8323C'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(30,40,80,0.45)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 64 + 10, 0, 26, 256); g.fillRect(0, k * 64 + 10, 256, 26); } g.fillStyle = 'rgba(255,210,63,0.8)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 64 + 48, 0, 4, 256); g.fillRect(0, k * 64 + 48, 256, 4); } });
  cell(PAT.denim, () => { g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 3; for (let k = -256; k < 512; k += 9) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); } dash(0, 236, 256, 236, 3, 'rgba(255,210,63,0.6)'); });
  cell(PAT.mesh, () => { g.strokeStyle = 'rgba(42,26,58,0.45)'; g.lineWidth = 3; for (let k = 0; k < 256; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); } });
  cell(PAT.checker, () => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#2A1A3A' : '#FFFFFF'; g.fillRect(x * 64, y * 64, 64, 64); } });
  cell(PAT.net, () => { g.strokeStyle = 'rgba(42,26,58,0.35)'; g.lineWidth = 2.5; for (let k = -256; k < 512; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); } });
  cell(PAT.screen, () => { const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#7CC6FE'); gr.addColorStop(1, '#9B5DE5'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.moveTo(0, 60); g.lineTo(256, -40); g.lineTo(256, 20); g.lineTo(0, 120); g.fill(); g.beginPath(); g.arc(128, 150, 40, 0, 7); g.fill(); });
  cell(PAT.chrome, () => { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 40, 256, 30); g.fillRect(0, 90, 256, 8); g.fillStyle = 'rgba(42,26,58,0.18)'; g.fillRect(0, 170, 256, 50); });
  cell(PAT.cuff, () => { g.fillStyle = 'rgba(42,26,58,0.14)'; for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 7, 256); });
  cell(PAT.sole, () => { g.fillStyle = 'rgba(42,26,58,0.25)'; g.fillRect(0, 180, 256, 14); g.fillStyle = '#FFD23F'; g.fillRect(0, 120, 256, 26); });
  cell(PAT.leopard, () => { for (let k = 0; k < 18; k++) { const x = (k * 89) % 256, y = (k * 47) % 256; g.fillStyle = '#5A3A22'; g.beginPath(); g.ellipse(x, y, 14, 10, k, 0, 5); g.lineWidth = 6; g.strokeStyle = '#5A3A22'; g.stroke(); } });
  cell(PAT.ringlight, () => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(124,198,254,0.4)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 12, 256); });
  cell(PAT.logoBlue, () => { g.font = '900 120px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = INK; g.strokeText('LIVE', 128, 128); g.fillStyle = '#FF4FD8'; g.fillText('LIVE', 128, 128); });
  cell(PAT.zip, () => { g.fillStyle = 'rgba(42,26,58,0.55)'; g.fillRect(0, 0, 5, 256); g.fillRect(251, 0, 5, 256); g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(56, 0, 9, 256); g.fillRect(72, 0, 9, 256); g.fillRect(175, 0, 9, 256); g.fillRect(191, 0, 9, 256); });
  cell(PAT.camo, () => { for (const [c, n] of [['rgba(42,26,58,0.16)', 9], ['rgba(255,255,255,0.14)', 7]]) for (let k = 0; k < n; k++) { g.fillStyle = c; g.beginPath(); g.ellipse((k * 97 + n * 13) % 256, (k * 59 + n * 31) % 256, 34, 18, k, 0, 7); g.fill(); } });
  cell(PAT.laces, () => { g.strokeStyle = '#FFFFFF'; g.lineWidth = 10; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(70, 40 + k * 50); g.lineTo(186, 64 + k * 50); g.moveTo(186, 40 + k * 50); g.lineTo(70, 64 + k * 50); g.stroke(); } });
  cell(PAT.star, () => { g.fillStyle = '#FFD23F'; g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 - Math.PI / 2, r = k % 2 ? 50 : 110; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); });
  cell(PAT.vest, () => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(0, 150, 256, 18); g.fillStyle = '#FFD23F'; g.fillRect(0, 172, 256, 10); });
  cell(PAT.receipt, () => { g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(42,26,58,0.55)'; for (let y = 34; y < 200; y += 22) g.fillRect(28 + (y % 3) * 6, y, 120 + (y % 5) * 14, 9); g.fillStyle = '#E63946'; g.fillRect(28, 206, 200, 16); g.fillStyle = '#FFFDF6'; g.beginPath(); for (let x = 0; x <= 256; x += 16) { g.lineTo(x, 246); g.lineTo(x + 8, 256); } g.lineTo(256, 256); g.lineTo(0, 256); g.fill(); });
  return (cache.pat = atlasTex(cv));
}

// ---- product labels ----------------------------------------------------------------------------------------
// One 256 px cell per invented brand (ART.md section 5): a background, a band, a decoration made of simple
// shapes, a bold wordmark fitted to the width, a tagline, and an ink border.
export const LABELS = [
  ['SUGAR STORM', '#5B3FD6', '#FFD23F', '#FFFFFF', 'bolt'], ['CRUNCH-O-RAMA', '#FF9F1C', '#E63946', '#FFFFFF', 'burst'], ['BEAN BOSS', '#7A4A22', '#FFD23F', '#FFF6EA', 'face'],
  ['TOMATO TORNADO', '#E63946', '#8AC926', '#FFFFFF', 'swirl'], ['NOODLE NOODLE', '#FFD23F', '#E63946', '#2A1A3A', 'wave'], ['CHOMPERS', '#3BB273', '#FFD23F', '#FFFFFF', 'teeth'],
  ['PUFF-A-LUMP', '#FF8FC7', '#FFFFFF', '#5B3FD6', 'dots'], ['MEGA FIZZ', '#3A86FF', '#FFFFFF', '#FFFFFF', 'bubbles'], ['FIZZ BANG', '#E63946', '#FFD23F', '#FFFFFF', 'burst'],
  ['SPLOOSH', '#48CAE4', '#FFFFFF', '#1B4F8A', 'drop'], ['MOOVELOUS', '#FFFFFF', '#3A86FF', '#3A86FF', 'spots'], ['YO-GOGO', '#FF6FA0', '#FFFFFF', '#FFFFFF', 'star'],
  ['CLOUDROLL', '#7CC6FE', '#FFFFFF', '#FFFFFF', 'cloud'], ['BEAN THERE', '#3B2416', '#E9B949', '#E9B949', 'bean'], ['ZAPTRONIX', '#1B1F3B', '#00E5FF', '#00E5FF', 'bolt'],
  ['BOOP', '#FF4FD8', '#FFFFFF', '#FFFFFF', 'circle'], ['BASSBRICK', '#2A2440', '#8AC926', '#8AC926', 'waves'], ['PIXELPOP', '#9B5DE5', '#FFD23F', '#FFFFFF', 'pixels'],
  ['GIGAVISION', '#1B1F3B', '#FF4FD8', '#FFFFFF', 'screen'], ['MAISON MAYHEM', '#2A2440', '#E9B949', '#E9B949', 'line'], ['ZOOMIES', '#FF7F11', '#FFFFFF', '#FFFFFF', 'swoosh'],
  ['MEGA-FLEX', '#E63946', '#2A2440', '#FFFFFF', 'bolt'], ['GOAL-O-MATIC', '#3BB273', '#FFFFFF', '#FFFFFF', 'ball'], ['EGGCELLENT', '#F4E1C1', '#FFD23F', '#7A4A22', 'egg'],
  ['DOUGH-RE-MI', '#E8B36A', '#E63946', '#FFFFFF', 'notes'], ['PIZZA PANIC', '#FFF6EA', '#E63946', '#E63946', 'slice'], ['JAMMIN', '#9B2D5A', '#FFFFFF', '#FFFFFF', 'berry'],
  ['OJ-OH', '#FF9F1C', '#8AC926', '#FFFFFF', 'circle'], ['FIZZ BANG ZERO', '#2A2440', '#E63946', '#FFFFFF', 'burst'], ['SPLOOSH LEMON', '#FFE45C', '#48CAE4', '#1B4F8A', 'drop'],
  ['SUGAR STORM CHOCO', '#6B3A1E', '#FFD23F', '#FFFFFF', 'bolt'], ['CHOMPERS BBQ', '#7A2E1E', '#FF9F1C', '#FFFFFF', 'teeth'],
];
export function labelAtlas() {
  if (cache.label) return cache.label;
  const cv = canvas(), g = cv.getContext('2d');
  LABELS.forEach((L, i) => { g.save(); g.translate((i % 8) * 256, Math.floor(i / 8) * 256); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); drawLabel(g, L); g.restore(); });
  PRINTS.forEach((kind, j) => { const i = PRINT0 + j; g.save(); g.translate((i % 8) * 256, Math.floor(i / 8) * 256); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); drawPrint(g, kind); g.restore(); });
  return (cache.label = atlasTex(cv));
}
function drawLabel(g, [name, bg, band, ink, deco]) {
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  g.fillStyle = band; g.beginPath(); g.moveTo(0, 168); g.lineTo(256, 140); g.lineTo(256, 186); g.lineTo(0, 214); g.fill();
  g.save(); g.translate(128, 66); g.fillStyle = band; g.strokeStyle = INK; g.lineWidth = 6;
  const P = (pts) => { g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.stroke(); };
  if (deco === 'bolt') P([[-14, -44], [22, -44], [4, -8], [26, -8], [-22, 44], [-4, 4], [-26, 4]]);
  else if (deco === 'burst' || deco === 'star') { const n = deco === 'star' ? 10 : 24; g.beginPath(); for (let k = 0; k < n; k++) { const a = k / n * 6.283, r = k % 2 ? 22 : 46; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }
  else if (deco === 'face' || deco === 'circle' || deco === 'ball' || deco === 'berry') {
    g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK;
    if (deco === 'face') { g.beginPath(); g.arc(-13, -6, 6, 0, 7); g.arc(13, -6, 6, 0, 7); g.fill(); g.lineWidth = 6; g.beginPath(); g.arc(0, 4, 18, 0.3, 2.8); g.stroke(); }
    if (deco === 'ball') { g.lineWidth = 5; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.moveTo(0, -40); g.quadraticCurveTo(22, 0, 0, 40); g.stroke(); }
  }
  else if (deco === 'swirl' || deco === 'wave' || deco === 'waves') { g.lineWidth = 12; g.strokeStyle = band; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = -60; x <= 60; x += 6) g.lineTo(x, -24 + k * 22 + Math.sin(x / 10 + k) * 8); g.stroke(); } }
  else if (deco === 'teeth') { g.beginPath(); g.ellipse(0, 0, 50, 34, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#FFFFFF'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 16 - 7, -12); g.lineTo(k * 16 + 7, -12); g.lineTo(k * 16, 4); g.fill(); } }
  else if (deco === 'dots' || deco === 'bubbles' || deco === 'pixels' || deco === 'spots') {
    for (let k = 0; k < 7; k++) { const x = -50 + (k * 37) % 100, y = -30 + (k * 23) % 60, r = 8 + (k % 3) * 5;
      if (deco === 'pixels') { g.fillRect(x - r, y - r, r * 1.6, r * 1.6); g.strokeRect(x - r, y - r, r * 1.6, r * 1.6); }
      else { g.fillStyle = deco === 'spots' ? INK : band; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (deco !== 'spots') g.stroke(); } }
  }
  else if (deco === 'drop' || deco === 'egg' || deco === 'bean') { g.beginPath(); g.ellipse(0, 4, deco === 'bean' ? 34 : 30, deco === 'drop' ? 36 : 42, deco === 'bean' ? 0.6 : 0, 0, 7); g.fill(); g.stroke(); if (deco === 'drop') P([[0, -56], [18, -18], [-18, -18]]); }
  else if (deco === 'cloud') { g.beginPath(); for (const [x, y, r] of [[-30, 8, 24], [0, -10, 32], [30, 8, 24], [0, 14, 26]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); } g.fill(); g.stroke(); }
  else if (deco === 'screen') { g.fillRect(-56, -36, 112, 72); g.strokeRect(-56, -36, 112, 72); g.fillStyle = '#00E5FF'; g.fillRect(-46, -26, 92, 52); }
  else { g.lineWidth = 14; g.strokeStyle = band; g.beginPath(); g.moveTo(-60, 20); g.quadraticCurveTo(0, -50, 60, -10); g.stroke(); }
  g.restore();
  // the wordmark: as big as fits, outlined
  let size = 74;
  g.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif';
  while (g.measureText(name).width > 232 && size > 26) { size -= 2; g.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(6, size * 0.16); g.strokeStyle = INK; g.strokeText(name, 128, 132);
  g.fillStyle = ink; g.fillText(name, 128, 132);
  g.font = '900 22px "Arial Black", sans-serif'; g.fillStyle = INK; g.fillText(name.length % 3 ? 'NEW!' : 'XL', 206, 232);
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248);
}

// Cells from PRINT0 up are fixed prints, the same on every pack (the shader keeps them, see INST_CELL in
// render.js): a carton top, a side panel and two boxed appliances. The first two are see-through where the
// pack's own colour shows.
export const PRINT0 = 32, PRINTS = ['top', 'side', 'wave', 'bass', 'tape'];
function drawPrint(g, kind) {
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (kind === 'tape') {
    // a carton top: packing tape down the middle, a THIS SIDE UP stamp
    g.fillStyle = 'rgba(42,26,58,0.22)'; g.fillRect(0, 122, 256, 12);
    g.fillStyle = '#D9B26A'; g.fillRect(100, 0, 56, 256); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(108, 0, 10, 256);
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(100, 0); g.lineTo(100, 256); g.moveTo(156, 0); g.lineTo(156, 256); g.stroke();
    g.fillStyle = '#C8323C'; g.font = '900 22px "Arial Black", sans-serif';
    for (const x of [50, 206]) { g.save(); g.translate(x, 128); g.rotate(-Math.PI / 2); g.fillText('UP', 0, 0); g.restore(); g.beginPath(); g.moveTo(x, 40); g.lineTo(x - 16, 70); g.lineTo(x + 16, 70); g.fill(); }
  } else if (kind === 'top') {
    g.fillStyle = 'rgba(42,26,58,0.28)'; g.fillRect(0, 0, 256, 14); g.fillRect(0, 242, 256, 14); g.fillRect(121, 0, 14, 256);   // flap seams
    g.fillStyle = '#FFFFFF'; rr(18, 80, 220, 96, 22); g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
    g.font = '900 56px "Arial Black", Impact, sans-serif'; g.fillStyle = '#E63946'; g.lineWidth = 8; g.strokeText('NEW!', 128, 130); g.fillText('NEW!', 128, 130);
  } else if (kind === 'side') {
    g.fillStyle = '#FFFFFF'; rr(22, 22, 212, 212, 18); g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    g.font = '900 34px "Arial Black", Impact, sans-serif'; g.fillStyle = INK; g.fillText('FACTS', 128, 58);
    g.fillRect(40, 80, 176, 6);
    for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(42,26,58,0.55)'; g.fillRect(40, 100 + k * 18, 96 + (k * 41) % 64, 9); g.fillRect(186, 100 + k * 18, 30, 9); }
    g.fillStyle = INK; for (let x = 44; x < 212; x += 6) if ((x * 7) % 5 > 1) g.fillRect(x, 196, (x * 3) % 4 + 2, 24);   // a barcode
  } else {
    // a boxed appliance: cardboard, colour bands, a big picture of what is inside, the name
    const wave = kind === 'wave', name = wave ? 'ZAP-O-WAVE' : 'BASSBRICK';
    g.fillStyle = '#E9D3A8'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = wave ? '#FF5A4E' : '#2A2440'; g.fillRect(0, 0, 256, 52); g.fillRect(0, 222, 256, 34);
    g.font = '900 34px "Arial Black", Impact, sans-serif'; g.lineWidth = 7; g.strokeStyle = INK; g.fillStyle = '#FFFFFF';
    g.strokeText(name, 128, 28); g.fillText(name, 128, 28);
    g.lineWidth = 7;
    if (wave) {
      g.fillStyle = '#FF8A7A'; rr(30, 70, 196, 132, 16); g.fill(); g.stroke();
      g.fillStyle = '#2A3550'; rr(44, 86, 120, 100, 8); g.fill(); g.stroke();
      g.fillStyle = '#7CC6FE'; g.fillRect(56, 96, 30, 10);
      g.fillStyle = INK; for (const y of [104, 134, 164]) { g.beginPath(); g.arc(196, y, 9, 0, 7); g.fill(); }
    } else {
      g.fillStyle = '#3D3552'; rr(64, 62, 128, 150, 14); g.fill(); g.stroke();
      for (const [y, r] of [[100, 24], [162, 34]]) { g.fillStyle = '#8AC926'; g.beginPath(); g.arc(128, y, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(128, y, r * 0.35, 0, 7); g.fill(); }
    }
    // a NEW! burst in the corner
    g.save(); g.translate(214, 196); g.fillStyle = '#FFD23F'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, r = k % 2 ? 20 : 32; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.lineWidth = 5; g.stroke();
    g.font = '900 15px "Arial Black", sans-serif'; g.fillStyle = INK; g.fillText('NEW!', 0, 1); g.restore();
    g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248);
  }
}

// ---- store-kit signs and surfaces ---------------------------------------------------------------------------
// Cells of 256 px (8 x 8). Signs are drawn for every store's own words (kits.js signs); the rest are shared
// surfaces: price strips, frost, ice, awning, shutter slats, a checkout belt, wood, decals with a clear ground.
export const KIT = { sign0: 0, checkout: 8, banner: 9, sale: 10, pct: 11, wet: 12, fish: 13, deli: 14, price: 15, frost: 16, ice: 17, awning: 18,
  shutter: 19, belt: 20, wood: 21, chalk: 22, ring: 23, star: 24, dash: 25, press: 26, logo: 27, poster2: 28, poster3: 29, glare: 30, pegboard: 31, door: 32, arrow: 33, walltop: 34, backroom: 35 };
export function kitAtlas(store) {
  const key = 'kit_' + store.id;
  if (cache[key]) return cache[key];
  const cv = canvas(), g = cv.getContext('2d'), P = store.palette;
  const cell = (i, fn) => { g.save(); g.translate((i % 8) * 256, Math.floor(i / 8) * 256); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); fn(); g.restore(); };
  const text = (t, x, y, size, fill, stroke, maxW) => { g.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    while (g.measureText(t).width > (maxW || 236) && size > 14) { size -= 2; g.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; }
    if (stroke) { g.lineWidth = Math.max(5, size * 0.18); g.strokeStyle = stroke; g.strokeText(t, x, y); } g.fillStyle = fill; g.fillText(t, x, y); };
  const burst = (x, y, r0, r1, n, fill) => { g.beginPath(); for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * 6.283 - Math.PI / 2, r = k % 2 ? r1 : r0; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); };
  // aisle signs: a plum board, a number disc, the word (signs are half height: the top 128 px)
  (store.signs || []).slice(0, 8).forEach((word, i) => cell(i, () => {
    g.fillStyle = store.sign || '#3D2C5E'; g.fillRect(0, 0, 256, 128); g.fillStyle = P.b; g.fillRect(0, 108, 256, 20);
    g.beginPath(); g.arc(40, 56, 30, 0, 7); g.fillStyle = P.c; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    text(String(i + 1), 40, 58, 40, '#FFFFFF', INK); text(word, 152, 58, 46, '#FFFFFF', INK, 170);
    g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(4, 4, 248, 120);
  }));
  cell(KIT.checkout, () => { g.fillStyle = '#FFD23F'; g.fillRect(0, 0, 256, 128); g.fillStyle = INK; for (let x = -40; x < 300; x += 40) { g.beginPath(); g.moveTo(x, 110); g.lineTo(x + 20, 110); g.lineTo(x + 6, 128); g.lineTo(x - 14, 128); g.fill(); } text('CHECKOUT', 128, 54, 50, '#FFFFFF', INK); g.lineWidth = 8; g.strokeRect(4, 4, 248, 120); });
  cell(KIT.banner, () => { g.fillStyle = P.c; g.fillRect(0, 0, 256, 128); g.fillStyle = P.d; g.fillRect(0, 0, 256, 18); g.fillRect(0, 110, 256, 18); text(store.name, 128, 62, 48, '#FFFFFF', INK); });
  cell(KIT.sale, () => { g.fillStyle = '#E63946'; g.fillRect(0, 0, 256, 256); burst(128, 120, 110, 80, 16, '#FFD23F'); text('SALE', 128, 112, 72, '#E63946', INK); text('EVERYTHING MUST GO', 128, 222, 22, '#FFFFFF', INK); g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, 248, 248); });
  cell(KIT.pct, () => { burst(128, 128, 118, 92, 14, '#FFD23F'); text('50%', 128, 112, 64, '#E63946', INK); text('OFF', 128, 166, 40, '#FFFFFF', INK); });
  cell(KIT.wet, () => { g.fillStyle = '#FFD23F'; g.beginPath(); g.moveTo(128, 14); g.lineTo(246, 230); g.lineTo(10, 230); g.closePath(); g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke(); text('!', 128, 110, 90, INK); text('WET FLOOR', 128, 200, 30, INK); });
  cell(KIT.fish, () => { g.fillStyle = '#3A86FF'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(52, 64, 34, 20, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(84, 64); g.lineTo(104, 46); g.lineTo(104, 82); g.fill(); text('FRESH FISH', 168, 64, 40, '#FFFFFF', INK, 150); g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, 248, 120); });
  cell(KIT.deli, () => { for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? '#FFFFFF' : '#E63946'; g.fillRect(x, 0, 32, 128); } text('DELI', 128, 64, 70, '#FFFFFF', INK); g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, 248, 120); });
  cell(KIT.price, () => { g.fillStyle = '#E63946'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 4; k++) { g.fillStyle = '#FFFFFF'; g.fillRect(k * 64 + 8, 70, 48, 116); text('$' + (k * 3 + 2), k * 64 + 32, 128, 30, '#E63946', null, 44); } });
  cell(KIT.frost, () => { g.fillStyle = '#BFE9FF'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5; for (let k = 0; k < 9; k++) { const x = (k * 71) % 256, y = (k * 113) % 256; for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); g.stroke(); } } g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, 256, 40); });
  cell(KIT.ice, () => { g.fillStyle = '#DDF5FF'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 40; k++) { g.fillStyle = k % 3 ? '#FFFFFF' : '#A8E2FF'; const x = (k * 53) % 256, y = (k * 97) % 256; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); } });
  cell(KIT.awning, () => { for (let x = 0; x < 256; x += 64) { g.fillStyle = '#E63946'; g.fillRect(x, 0, 32, 256); g.fillStyle = '#FFFFFF'; g.fillRect(x + 32, 0, 32, 256); } });
  cell(KIT.shutter, () => { g.fillStyle = '#C9CED8'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 21) { g.fillStyle = '#9AA1AE'; g.fillRect(0, y, 256, 5); g.fillStyle = '#E8EBF0'; g.fillRect(0, y + 6, 256, 3); } });
  cell(KIT.belt, () => { g.fillStyle = '#2E2A3A'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#4A4458'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 10); });
  cell(KIT.wood, () => { g.fillStyle = '#C98A5B'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 64) { g.fillStyle = '#A86E43'; g.fillRect(0, y, 256, 6); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y + 10, 256, 8); } text('FRESH', 128, 160, 50, 'rgba(255,246,234,0.85)', null); });
  cell(KIT.chalk, () => { g.fillStyle = '#2F3B36'; g.fillRect(0, 0, 256, 256); g.lineWidth = 14; g.strokeStyle = '#C98A5B'; g.strokeRect(7, 7, 242, 242); text('ONLY', 128, 80, 40, '#FFFFFF'); text('$2', 128, 150, 80, '#FFD23F'); text('EACH!', 128, 214, 34, '#FFFFFF'); });
  cell(KIT.ring, () => { g.lineWidth = 22; g.strokeStyle = '#FFFFFF'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke(); g.setLineDash([26, 18]); g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 82, 0, 7); g.stroke(); g.setLineDash([]); });
  cell(KIT.star, () => { burst(128, 128, 116, 54, 5, '#FFD23F'); });
  cell(KIT.dash, () => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 104, 150, 48); });
  cell(KIT.press, () => { g.fillStyle = '#FFD23F'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke(); text('PRESS FOR', 128, 104, 34, INK); text('SERVICE', 128, 150, 38, INK); });
  cell(KIT.logo, () => { g.fillStyle = P.c; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.stroke(); g.lineWidth = 8; g.strokeStyle = '#FFFFFF'; g.beginPath(); g.arc(128, 128, 98, 0, 7); g.stroke(); const w = store.name.split(' '); text(w[0], 128, 108, 56, '#FFFFFF', INK, 200); text(w[1] || '', 128, 162, 56, P.b, INK, 200); });
  cell(KIT.poster2, () => { g.fillStyle = P.b; g.fillRect(0, 0, 256, 256); burst(128, 100, 90, 66, 12, '#FFFFFF'); text('MEGA', 128, 86, 48, '#E63946', INK); text('DEALS', 128, 126, 40, P.c, INK); text('TODAY ONLY', 128, 222, 28, INK); g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, 248, 248); });
  cell(KIT.poster3, () => { g.fillStyle = '#2A2440'; g.fillRect(0, 0, 256, 256); text('BLACK', 128, 90, 60, '#FFD23F', null); text('FRIDAY', 128, 150, 60, '#FFFFFF', null); g.fillStyle = '#FF4FA3'; g.fillRect(30, 196, 196, 30); text('DOORBUSTERS', 128, 211, 24, '#FFFFFF', null); });
  cell(KIT.glare, () => { g.fillStyle = 'rgba(255,255,255,0.0)'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(40, 256); g.lineTo(110, 0); g.lineTo(150, 0); g.lineTo(80, 256); g.fill(); });
  cell(KIT.pegboard, () => { g.fillStyle = P.a; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(42,26,58,0.18)'; for (let y = 16; y < 256; y += 32) for (let x = 16; x < 256; x += 32) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } });
  cell(KIT.door, () => { g.fillStyle = '#7CD5FF'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#FFFFFF'; for (let y = 30; y < 256; y += 60) g.fillRect(14, y, 228, 10); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(20, 256); g.lineTo(90, 0); g.lineTo(120, 0); g.lineTo(50, 256); g.fill(); g.lineWidth = 14; g.strokeStyle = '#DDE3EA'; g.strokeRect(7, 7, 242, 242); });
  cell(KIT.arrow, () => { g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(128, 20); g.lineTo(230, 140); g.lineTo(170, 140); g.lineTo(170, 236); g.lineTo(86, 236); g.lineTo(86, 140); g.lineTo(26, 140); g.closePath(); g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke(); });
  cell(KIT.walltop, () => {
    // overstock on top of the walls, seen from above (the cell covers 4 x 4 m and tiles seamlessly): two rows of
    // cartons with a dark gap between them, each carton with a shaded front edge, tape, now and then a product box
    g.fillStyle = '#2E241E'; g.fillRect(0, 0, 256, 256);
    const card = ['#D9B98A', '#C9A574', '#E4C99B', '#CDAE7E', '#BF9A68'], pop = [store.palette.b, store.palette.c, store.palette.d];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 2; row++) {
      const y0 = row * 128 + 10, hgt = 104;
      let x = -Math.floor(rnd() * 50);
      const boxes = [];
      while (x < 256) { const w = 36 + Math.floor(rnd() * 7) * 9; boxes.push([x, w, rnd() < 0.14, Math.floor(rnd() * 5), rnd()]); x += w + 4; }
      for (const [bx, w, coloured, ci, r] of boxes) for (const sx of [0, -256, 256]) {
        const X = bx + sx; if (X > 256 || X + w < 0) continue;
        const top = coloured ? pop[ci % 3] : card[ci], inset = Math.floor(r * 3) * 6;   // some stacks are lower: their top sits further back
        g.fillStyle = top; g.fillRect(X, y0 + inset, w, hgt - 16 - inset);
        g.fillStyle = 'rgba(42,26,58,0.38)'; g.fillRect(X, y0 + hgt - 16, w, 16);              // the shaded front face
        g.fillStyle = 'rgba(42,26,58,0.18)'; g.fillRect(X + w - 5, y0 + inset, 5, hgt - 16 - inset);   // and its right edge
        if (!coloured) { g.fillStyle = 'rgba(255,244,214,0.55)'; g.fillRect(X + w / 2 - 4, y0 + inset, 8, hgt - 16 - inset); }
        else { g.fillStyle = '#FFFFFF'; g.fillRect(X + 6, y0 + inset + 10, w - 12, 12); }
      }
    }
  });
  // the backroom round the store: the same overstock, dim and grey, so the lit store stands out from it
  cell(KIT.backroom, () => {
    g.drawImage(cv, (KIT.walltop % 8) * 256, Math.floor(KIT.walltop / 8) * 256, 256, 256, 0, 0, 256, 256);
    g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,0.6)'; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(36,26,48,0.58)'; g.fillRect(0, 0, 256, 256);
  });
  return (cache[key] = atlasTex(cv));
}
