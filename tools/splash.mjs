// Генерує заставки запуску для iPhone (apple-touch-startup-image) у splash/ і друкує <link>-теги
// для index.html. Без залежностей: малює циферблат-логотип попіксельно і пише PNG через zlib.
//
//   node tools/splash.mjs
//
// Нова модель iPhone → додайте її розмір у DEVICES і перезапустіть.

import fs from 'node:fs';
import zlib from 'node:zlib';

// [ширина, висота в CSS-пікселях (портрет), devicePixelRatio, моделі]
const DEVICES = [
  [440, 956, 3, '16/17 Pro Max'],
  [430, 932, 3, '14 Pro Max, 15/16 Plus, 15 Pro Max'],
  [420, 912, 3, 'Air'],
  [402, 874, 3, '16 Pro, 17, 17 Pro'],
  [393, 852, 3, '14 Pro, 15, 15 Pro, 16'],
  [428, 926, 3, '12/13 Pro Max, 14 Plus'],
  [390, 844, 3, '12, 13, 14, 12/13 Pro, 16e'],
  [375, 812, 3, 'X, XS, 11 Pro, 12/13 mini'],
  [414, 896, 3, 'XS Max, 11 Pro Max'],
  [414, 896, 2, 'XR, 11'],
  [414, 736, 3, '6/7/8 Plus'],
  [375, 667, 2, 'SE 2/3, 6/7/8'],
];

// Кольори як у style.css (фон до завантаження даних — стан «none»)
const THEMES = {
  light: { bg: '#EDEFF3', on: '#F2B92B', off: '#C5CBD8', hand: '#1D2433' },
  dark: { bg: '#1E2536', on: '#F2B92B', off: '#39445F', hand: '#E9EDF5' },
};

const OFF_SLOTS = new Set([13, 14, 15, 16, 17, 18, 19, 32, 33, 34, 35, 36, 37, 38, 39]);  // як на іконці
const HAND_DEG = 208;

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// Колір логотипа в точці (x, y) відносно центру, s — радіус кільця; null — фон
function logoAt(x, y, s, t) {
  const r = Math.hypot(x, y);
  if (r <= s * 0.12) return t.on;                                   // крапка в центрі
  // стрілка: відрізок від центру до 0.78 s, товщина 0.045 s
  const a = (HAND_DEG - 90) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
  const along = x * ux + y * uy, across = Math.abs(-x * uy + y * ux);
  if (along > s * 0.2 && along < s * 0.8 && across < s * 0.035) return t.hand;
  if (r < s * 0.8 || r > s) return null;                             // кільце 0.8 s … s
  const deg = ((Math.atan2(y, x) * 180 / Math.PI + 90) % 360 + 360) % 360;
  const slot = Math.floor(deg / 7.5), within = deg - slot * 7.5;
  if (within < 0.45 || within > 7.05) return null;                   // проміжки між секторами
  return OFF_SLOTS.has(slot) ? t.off : t.on;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, rows) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;   // 8 біт, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function render(w, h, t) {
  const bg = hex(t.bg), cx = w / 2, cy = h / 2, s = w * 0.2;   // логотип — 40% ширини екрана
  const cache = {};
  const rgb = c => cache[c] ||= hex(c);
  const rows = Buffer.alloc((w * 3 + 1) * h);
  const SS = 4;   // згладжування: 4×4 вибірки на піксель
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    rows[row] = 0;
    for (let x = 0; x < w; x++) {
      let px = bg;
      if (Math.abs(x - cx) <= s + 2 && Math.abs(y - cy) <= s + 2) {
        const acc = [0, 0, 0];
        for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) {
          const c = logoAt(x + (i + .5) / SS - cx, y + (j + .5) / SS - cy, s, t);
          const v = c ? rgb(c) : bg;
          acc[0] += v[0]; acc[1] += v[1]; acc[2] += v[2];
        }
        px = acc.map(v => Math.round(v / (SS * SS)));
      }
      rows.set(px, row + 1 + x * 3);
    }
  }
  return png(w, h, rows);
}

const outDir = new URL('../splash/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
const links = [];
for (const [dw, dh, dpr, models] of DEVICES) {
  const w = dw * dpr, h = dh * dpr;
  links.push(`<!-- ${models} -->`);
  for (const [name, theme] of Object.entries(THEMES)) {
    const file = `splash/${w}x${h}-${name}.png`;
    fs.writeFileSync(new URL(`../${file}`, import.meta.url), render(w, h, theme));
    links.push(`<link rel="apple-touch-startup-image" href="${file}" media="(device-width: ${dw}px) and ` +
      `(device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and ` +
      `(prefers-color-scheme: ${name})">`);
  }
}
console.log(links.join('\n'));
