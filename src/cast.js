// DOORBUSTER — cast.js
// Purpose: the cast as data (ART.md section 3, DESIGN.md sections 5-7): proportions, clothes, hair, props,
//          face styles and poses of Penny and the six rivals, and the thirteen crowd archetypes with their
//          muted colours and accent props. Nothing here is code; figure.js builds the meshes from it.
// Exports: CAST, CAST_ORDER, CROWD, CROWD_ORDER, CROWD_FACES, CROWD_COLORS, LINES, lookOf
// Depends on: nothing.
//
// Units are metres, feet on y = 0, facing +z; +x is the figure's own left. Body heights: hip (pelvis
// joint), shoulder, head centre. r = [x, y, z] radii. Arms and legs give the shoulder or hip joint and
// the two segment lengths and radii. face.row is the character's row in the face atlas.

export const CAST = {
  penny: {
    name: 'Penny', h: 1.5, skin: 0xFFD2B0,
    head: { r: [0.235, 0.245, 0.222], y: 1.245, nose: [0.03, 0.024, 0.026], ears: 1 },
    torso: { hip: 0.55, shoulder: 0.95, w: [0.165, 0.158, 0.19, 0.18], d: 0.78, color: 0xFF4FA3, band: 0xE0368A, pat: 'seams' },
    arm: { at: [0.19, 0.915], len: [0.215, 0.2], r: [0.074, 0.06], hand: 0.09, sleeve: 0xFF4FA3, cuff: 0xE0368A },
    leg: { at: [0.082, 0.55], len: [0.245, 0.235], r: [0.08, 0.066], color: 0x33407A, pat: 'denim' },
    shoe: { w: 0.07, l: 0.3, h: 0.135, color: 0xFFFFFF, sole: 0xFFD23F, trim: 0xFF4FA3, style: 'sneaker' },
    hair: { style: 'ponytail', color: 0xE8338C, accent: 0xFFD23F },
    top: { hood: 1, logo: 1, pocket: 1, strings: 0xFFFFFF },
    extras: ['shadesUp', 'receipt'],
    face: { row: 0, iris: 0x3A86FF, lash: 1, blush: 0xFF6FA0, freckles: 0xD9896A, brow: 0xB02A6E, browW: 10 },
    idle: 'bounce', victory: 'trophy', defeat: 'slump', voice: 'penny',
  },
  granny: {
    name: 'Granny Tank', h: 1.15, skin: 0xF7D3BE,
    head: { r: [0.205, 0.212, 0.196], y: 0.925, nose: [0.034, 0.03, 0.03], ears: 1 },
    torso: { hip: 0.38, shoulder: 0.7, w: [0.2, 0.235, 0.225, 0.17], d: 0.92, color: 0x9B5DE5, band: 0x7E44C8, pat: 'floral', collar: 0xFFFFFF },
    skirt: { color: 0x5B3A7A, to: 0.2, flare: 0.27 },
    arm: { at: [0.205, 0.67], len: [0.15, 0.145], r: [0.07, 0.058], hand: 0.078, sleeve: 0x9B5DE5, cuff: 0x7E44C8 },
    leg: { at: [0.09, 0.36], len: [0.15, 0.15], r: [0.066, 0.056], color: 0xE6C3A4, pat: null },
    shoe: { w: 0.062, l: 0.23, h: 0.1, color: 0x7A4E34, sole: 0x5A3A26, trim: 0x7A4E34, style: 'loafer' },
    hair: { style: 'curlers', color: 0xD9D2E9, accent: 0xFF7AB0 },
    extras: ['bottleGlasses', 'handbag', 'pearls'],
    face: { row: 1, iris: 0x6F8FC2, lash: 0, blush: 0xFF7A9A, wrinkles: 0xC99A86, brow: 0xB8B0CC, browW: 10, eyeW: 37, eyeH: 41, eyeGap: 49, lips: 0xD84A7A, browInk: 1, browUp: 14 },
    idle: 'glasses', victory: 'bagSwing', defeat: 'fist', voice: 'granny',
  },
  dad: {
    name: 'Sprint Dad', h: 1.9, skin: 0xE8B48E,
    head: { r: [0.235, 0.262, 0.224], y: 1.64, nose: [0.034, 0.03, 0.032], ears: 1 },
    torso: { hip: 0.92, shoulder: 1.37, w: [0.15, 0.142, 0.19, 0.192], d: 0.7, color: 0x2EC4B6, band: 0x1E9C90, pat: 'zip' },
    arm: { at: [0.208, 1.335], len: [0.3, 0.285], r: [0.066, 0.054], hand: 0.088, sleeve: 0x2EC4B6, cuff: 0xFFFFFF, stripe: 1 },
    leg: { at: [0.085, 0.92], len: [0.42, 0.405], r: [0.076, 0.062], color: 0x2EC4B6, pat: 'track' },
    shoe: { w: 0.066, l: 0.32, h: 0.12, color: 0xFFFFFF, sole: 0x3A86FF, trim: 0xE63946, style: 'sneaker' },
    hair: { style: 'short', color: 0x6B4226, accent: 0xFFFFFF },
    extras: ['sweatband', 'moustache', 'whistle'],
    face: { row: 2, iris: 0x7A4A22, lash: 0, brow: 0x4A2A16, browW: 14, eyeW: 27, eyeH: 31, mouthY: 196 },
    idle: 'stretch', victory: 'flex', defeat: 'hamstring', voice: 'sprintdad',
  },
  queen: {
    name: 'Coupon Queen', h: 1.6, skin: 0xC98B62,
    head: { r: [0.228, 0.24, 0.214], y: 1.3, nose: [0.028, 0.024, 0.026], ears: 1 },
    torso: { hip: 0.62, shoulder: 1.03, w: [0.165, 0.138, 0.18, 0.25], d: 0.72, color: 0xFF9F1C, band: 0xE07F00, pat: 'seams', collar: 0xFFF1E0 },
    skirt: { color: 0x2A2440, to: 0.4, flare: 0.17 },
    arm: { at: [0.235, 1.0], len: [0.22, 0.21], r: [0.072, 0.056], hand: 0.08, sleeve: 0xFF9F1C, cuff: 0xFFF1E0 },
    leg: { at: [0.074, 0.62], len: [0.27, 0.27], r: [0.068, 0.054], color: 0xC98B62, pat: null },
    shoe: { w: 0.052, l: 0.22, h: 0.1, color: 0xE63946, sole: 0x2A2440, trim: 0xE63946, style: 'heel' },
    hair: { style: 'teased', color: 0xD9542C, accent: 0xFFD23F },
    extras: ['catEyes', 'megaphone', 'couponFan', 'earrings'],
    face: { row: 3, iris: 0x2FA35A, lash: 1, brow: 0x5A2A14, browW: 10, lips: 0xE0243A, shadow: 0x9B5DE5, browUp: 12 },
    idle: 'fan', victory: 'fanCoupons', defeat: 'tearCoupon', voice: 'coupon',
  },
  selfie: {
    name: 'Selfie Star', h: 1.6, skin: 0xF2C6A0,
    head: { r: [0.228, 0.243, 0.214], y: 1.33, nose: [0.026, 0.022, 0.024], ears: 1 },
    torso: { hip: 0.64, shoulder: 1.05, w: [0.15, 0.13, 0.16, 0.172], d: 0.72, color: 0xFFFFFF, band: 0x3A86FF, pat: null, jacket: 0x3A86FF },
    arm: { at: [0.19, 1.02], len: [0.23, 0.22], r: [0.068, 0.054], hand: 0.08, sleeve: 0x3A86FF, cuff: 0xFFFFFF },
    leg: { at: [0.074, 0.64], len: [0.28, 0.28], r: [0.07, 0.056], color: 0xE8E4F4, pat: null },
    shoe: { w: 0.064, l: 0.27, h: 0.15, color: 0xFFFFFF, sole: 0xFF4FD8, trim: 0x3A86FF, style: 'platform' },
    hair: { style: 'bun', color: 0x2B2140, accent: 0xFF4FD8 },
    extras: ['bigShades', 'selfieStick', 'hoops'],
    face: { row: 4, iris: 0x8A5A3A, lash: 1, brow: 0x2B2140, browW: 9, lips: 0xFF4FD8, hideEyes: 1, mouthY: 194 },
    idle: 'selfie', victory: 'flash', defeat: 'coverLens', voice: 'selfie',
  },
  bubba: {
    name: 'Big Bubba', h: 2.0, skin: 0xA86A45,
    head: { r: [0.27, 0.28, 0.255], y: 1.7, nose: [0.045, 0.04, 0.042], ears: 1 },
    torso: { hip: 0.8, shoulder: 1.41, w: [0.3, 0.43, 0.39, 0.3], d: 0.92, color: 0x8AC926, band: 0x6AA314, pat: null, belly: 1 },
    arm: { at: [0.37, 1.36], len: [0.3, 0.28], r: [0.12, 0.105], hand: 0.125, sleeve: 0xA86A45, cuff: 0xA86A45, bare: 1 },
    leg: { at: [0.16, 0.8], len: [0.36, 0.32], r: [0.13, 0.105], color: 0xC9A66B, pat: null, shorts: 1 },
    shoe: { w: 0.085, l: 0.36, h: 0.15, color: 0x3A3A48, sole: 0xFFFFFF, trim: 0xE63946, style: 'sneaker' },
    hair: { style: 'cap', color: 0x3B2416, accent: 0xE63946 },
    extras: ['beard', 'soda'],
    face: { row: 5, iris: 0x4A2A16, lash: 0, brow: 0x2A1608, browW: 15, eyeW: 26, eyeH: 29, mouthY: 194 },
    idle: 'sip', victory: 'bellyBump', defeat: 'sadSip', voice: 'bubba',
  },
  gramps: {
    name: 'Turbo Gramps', h: 1.3, skin: 0xF5CDB5, seated: 1,
    head: { r: [0.218, 0.228, 0.208], y: 1.33, nose: [0.04, 0.036, 0.036], ears: 1 },
    torso: { hip: 0.66, shoulder: 1.06, w: [0.16, 0.162, 0.18, 0.172], d: 0.8, color: 0xE63946, band: 0xFFFFFF, pat: 'seams', racing: 1 },
    arm: { at: [0.2, 1.03], len: [0.22, 0.2], r: [0.07, 0.058], hand: 0.084, sleeve: 0xE63946, cuff: 0xFFFFFF, stripe: 1 },
    leg: { at: [0.08, 0.66], len: [0.3, 0.29], r: [0.068, 0.055], color: 0x3A3A58, pat: null },
    shoe: { w: 0.064, l: 0.27, h: 0.12, color: 0x2A2440, sole: 0xFFFFFF, trim: 0xE63946, style: 'sneaker' },
    hair: { style: 'tufts', color: 0xF4F1FA, accent: 0x3A86FF },
    extras: ['goggles', 'moustacheWhite', 'scarf', 'whiteBrows'],
    face: { row: 6, iris: 0x4A7AB8, lash: 0, brow: 0xF4F1FA, browW: 16, wrinkles: 0xCF9F86, browInk: 1 },
    idle: 'rev', victory: 'wheelie', defeat: 'batteryDies', voice: 'gramps',
  },
};
export const CAST_ORDER = ['penny', 'granny', 'dad', 'queen', 'selfie', 'bubba', 'gramps'];
// The gameplay ids of config.js CHARS -> the look.
export function lookOf(charId) { return CAST[{ player: 'penny', bro: 'bubba' }[charId] || charId] || CAST.penny; }

// ---- the crowd: thirteen archetypes. Parts: body, head, arms, legs, one accent prop (figure.js crowdFigure).
// cloth / pants / hair are slot colours chosen per shopper from CROWD_COLORS; fixed colours are props.
export const CROWD = {
  walkerGranny: { h: 1.1, build: 'round', face: 2, hair: 'bun', prop: 'walker', hunch: 0.25, idle: 'shuffle', line: 'Not so fast!' },
  caneGrandpa: { h: 1.5, build: 'thin', face: 2, hair: 'bald', prop: 'cane', hat: 'flat', hunch: 0.2, idle: 'tap', line: 'Whippersnapper!' },
  strollerMom: { h: 1.62, build: 'mid', face: 1, hair: 'pony', prop: 'stroller', idle: 'rock', line: 'Watch the baby!' },
  toddler: { h: 0.82, build: 'kid', face: 3, hair: 'tuft', prop: 'leash', idle: 'hop', line: 'WAAAH' },
  phoneTeen: { h: 1.66, build: 'thin', face: 3, hair: 'fringe', prop: 'phone', hood: 1, hunch: 0.45, idle: 'scroll', line: 'Literally?!' },
  gymBro: { h: 1.84, build: 'buff', face: 0, hair: 'buzz', prop: 'shaker', idle: 'flex', line: 'Do you even lift?' },
  jogger: { h: 1.72, build: 'thin', face: 0, hair: 'band', prop: 'bottle', idle: 'jog', line: 'On your left!' },
  bellyBro: { h: 1.78, build: 'belly', face: 0, hair: 'cap', prop: 'hotdog', idle: 'munch', line: 'Is that a hot dog?' },
  staff: { h: 1.72, build: 'mid', face: 0, hair: 'short', prop: 'ladder', apron: 1, idle: 'stock', line: 'Clean-up on aisle YOU!' },
  fashionista: { h: 1.74, build: 'thin', face: 1, hair: 'long', prop: 'bags', shades: 1, idle: 'pose', line: 'Darling, NO!' },
  gamer: { h: 1.7, build: 'mid', face: 3, hair: 'messy', prop: 'headset', idle: 'button', line: 'LAG!' },
  mascot: { h: 2.3, build: 'mascot', face: 0, hair: 'none', prop: 'bun', idle: 'dance', line: 'Free hugs!' },
  scooterElder: { h: 1.3, build: 'round', face: 2, hair: 'bald', prop: 'scooter', seated: 1, idle: 'donut', line: 'Beep beep!' },
};
export const CROWD_ORDER = Object.keys(CROWD);
// Four shared crowd face styles (face atlas, 128 px cells).
export const CROWD_FACES = [
  { skin: 0xC99872, iris: 0x5A4A3A, brow: 0x3A2A22, browW: 13 },
  { skin: 0xF2D2BC, iris: 0x4A6A8A, brow: 0x5A3A2A, browW: 10, lash: 1, lips: 0xC86A7A },
  { skin: 0xF1D2C0, iris: 0x7A8AA0, brow: 0xB8B2C0, browW: 11, wrinkles: 0xC4A090 },
  { skin: 0x8A5C40, iris: 0x3A2A22, brow: 0x2A1A12, browW: 12, eyeW: 32, eyeH: 37 },
];
// Muted colours (ART.md section 3): clothes from the three greys, skin and hair with variety.
export const CROWD_COLORS = {
  cloth: [0xB8C0CC, 0xC9BBCF, 0xBFD3C1, 0x9FC2C0, 0xD9B8BC, 0xD8CB98, 0xBDB3DA, 0xB7C9A8, 0xA9B8CE, 0xD3C4B5],
  pants: [0x7E8496, 0x8E8298, 0x7D8E82, 0x9A9AA8, 0x6E7486],
  skin: [0xF2D2BC, 0xE3B896, 0xC99872, 0xA77654, 0x8A5C40, 0xF6DCCB],
  hair: [0x4A3A32, 0x2E2630, 0x8A6A4A, 0xC9C2CE, 0xB07A4A, 0x6A5A6A],
};

// Voice lines (DESIGN.md section 7). The n-th line of a row plays assets/voice/<id>_<n>.mp3 when present.
export const LINES = {
  penny: ['MINE!', 'Bargain!', 'Coming through!', 'Ka-ching!', 'Not the cheese!', 'Whoa-whoa-WHOA!', 'Excuse me, sorry, MINE!', 'Ooh, shiny!'],
  granny: ['Out of my way, sonny!', 'My hip! My BARGAINS!', 'Back in MY day carts had brakes!', "I've queued since 1987!", 'Ha! Too slow!', 'Manners!'],
  sprintdad: ['Personal best, baby!', 'Hamstring! HAMSTRING!', 'Keep up, champ!', 'Revenge time!', 'Not my protein!'],
  coupon: ['I HAVE A COUPON FOR THAT!', 'Expired?! NOOO!', 'MINE MINE MINE!', 'Attention shoppers: back OFF!', 'That was 40% off!'],
  selfie: ['Like and subscribe!', 'My lighting!', 'This is going viral!', "Ew, you're in my shot!", 'Hashtag RAMMED!'],
  bubba: ['BULK BUY!', 'Oof... my snacks!', "Comin' through!", "Nothin' stops this cart!", 'Thanks, little buddy!'],
  gramps: ['Eat my dust, whippersnapper!', 'Full throttle!', 'My batteries!', 'In my day we raced HORSES!', 'Turbo... ENGAGE!'],
  crowd: ['Hey!', 'Rude!', 'My sale!', 'Watch it!', 'Was that the last one?!', 'I saw it first!', 'Wheee!', 'Not again!'],
};
