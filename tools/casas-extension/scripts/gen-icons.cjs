// Genera PNGs de color sólido #1e40af sin dependencias externas
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])))
  return Buffer.concat([len, t, d, crcBuf])
}

function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // RGB truecolor

  const raw = []
  for (let y = 0; y < size; y++) {
    raw.push(0) // filter byte
    for (let x = 0; x < size; x++) raw.push(r, g, b)
  }
  const idat = zlib.deflateSync(Buffer.from(raw))

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const iconsDir = path.join(__dirname, '..', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), createPNG(size, 30, 64, 175))
  console.log(`icon${size}.png created`)
}
