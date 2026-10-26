// Renders the app icons as PNGs with no dependencies: a glowing chamber, a wall and a trapped atom.
// Run with `npm run icons`; output goes to public/icons/.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [5, 6, 15];
const CYAN = [62, 232, 255];
const MAGENTA = [255, 64, 200];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Distance from point to an axis-aligned rectangle outline.
function rectEdgeDist(x, y, x0, y0, x1, y1) {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dy = Math.max(y0 - y, 0, y - y1);
  const outside = Math.hypot(dx, dy);
  if (outside > 0) return outside;
  return Math.min(x - x0, x1 - x, y - y0, y1 - y);
}

// `inset` shrinks the artwork towards the centre (maskable icons need an 80% safe zone).
function render(size, inset) {
  const out = Buffer.alloc(size * size * 4);
  const s = (v) => inset + v * (1 - 2 * inset);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const y = (py + 0.5) / size;
      let col = [...BG];
      const add = (c, a) => {
        for (let i = 0; i < 3; i++) col[i] = Math.min(255, col[i] + c[i] * a);
      };
      // Chamber outline with glow.
      const de = rectEdgeDist(x, y, s(0.14), s(0.24), s(0.86), s(0.76)) / (1 - 2 * inset);
      add(CYAN, Math.max(0, 1 - de / 0.012) + 0.45 * Math.exp(-de / 0.03));
      // Completed vertical wall splitting the chamber.
      const wx = Math.abs(x - s(0.6)) / (1 - 2 * inset);
      if (y > s(0.24) && y < s(0.76)) add(CYAN, Math.max(0, 1 - wx / 0.01) + 0.35 * Math.exp(-wx / 0.025));
      // Trapped atom with glow.
      const da = Math.hypot(x - s(0.36), y - s(0.5)) / (1 - 2 * inset);
      add(MAGENTA, (da < 0.085 ? 1 : 0) + 0.6 * Math.exp(-Math.max(0, da - 0.085) / 0.04));
      if (da < 0.04) add([255, 255, 255], 0.5 * (1 - da / 0.04));
      const i = (py * size + px) * 4;
      out[i] = col[0];
      out[i + 1] = col[1];
      out[i + 2] = col[2];
      out[i + 3] = 255;
    }
  }
  return png(size, out);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, 0));
writeFileSync('public/icons/icon-512.png', render(512, 0));
writeFileSync('public/icons/icon-maskable-512.png', render(512, 0.1));
writeFileSync(
  'public/icons/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#05060f"/><rect x="9" y="15" width="46" height="34" fill="none" stroke="#3ee8ff" stroke-width="3"/><line x1="38" y1="15" x2="38" y2="49" stroke="#3ee8ff" stroke-width="3"/><circle cx="23" cy="32" r="6" fill="#ff40c8"/></svg>\n`,
);
console.log('icons written to public/icons/');
