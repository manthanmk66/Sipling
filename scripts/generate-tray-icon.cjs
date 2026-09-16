// Generates a menu-bar / tray icon (a black water-drop template) as real PNG
// files, with zero external dependencies. macOS treats a black+alpha "template"
// image specially: it auto-inverts for light/dark menu bars. Run via
// `npm run gen:icons`.
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// A classic teardrop: circle at the bottom, tapering to a point at the top.
// Returns coverage 0..1 for anti-aliasing.
function dropCoverage(u, v) {
  // u,v in [0,1]. Point ~ (0.5, 0.12), bulb centre ~ (0.5, 0.66) radius ~0.30.
  const cx = 0.5;
  const bulbY = 0.64;
  const bulbR = 0.3;
  const tipY = 0.1;
  // Width of the drop at height v grows from 0 at the tip to bulbR near the bulb.
  if (v < tipY) return 0;
  let halfWidth;
  if (v <= bulbY) {
    const t = (v - tipY) / (bulbY - tipY); // 0..1
    halfWidth = bulbR * Math.pow(t, 0.85);
  } else {
    // bottom hemisphere of the bulb
    const dy = (v - bulbY) / bulbR;
    if (dy > 1) return 0;
    halfWidth = bulbR * Math.sqrt(1 - dy * dy);
  }
  const dist = Math.abs(u - cx);
  // soft edge (~1.5px worth) for anti-aliasing
  const edge = 0.02;
  if (dist <= halfWidth - edge) return 1;
  if (dist >= halfWidth + edge) return 0;
  return (halfWidth + edge - dist) / (2 * edge);
}

function drawDrop(size) {
  const buf = Buffer.alloc(size * size * 4); // transparent
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const a = dropCoverage(u, v);
      if (a > 0) {
        const i = (y * size + x) * 4;
        buf[i] = 0; // black — template image
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = Math.round(a * 255);
      }
    }
  }
  return buf;
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'trayTemplate.png'), encodePNG(18, 18, drawDrop(18)));
fs.writeFileSync(path.join(outDir, 'trayTemplate@2x.png'), encodePNG(36, 36, drawDrop(36)));
console.log('Wrote assets/trayTemplate.png and assets/trayTemplate@2x.png');
