/**
 * PNG encoder/decoder murni Node (zlib saja) untuk generator ikon Meowalaf.
 *
 * Kenapa tidak memakai paket: repo ini hanya punya `pngjs`/`jimp-compact` sebagai
 * dependency TURUNAN (ikut terpasang karena tooling lain, bukan dipilih sendiri).
 * Bergantung pada paket yang tidak dideklarasikan di package.json itu rapuh —
 * sekali transitive-nya hilang, pipeline ikon mati tanpa sebab yang jelas.
 * Format PNG untuk kebutuhan kita (RGBA 8-bit) sederhana: IHDR + IDAT + IEND.
 */
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba panjang `width * height * 4` (straight alpha, bukan premultiplied)
 * @returns {Buffer} file .png lengkap
 */
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None) — konten kita sudah halus
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Decoder minimal (8-bit RGBA, non-interlaced) — dipakai test regresi ikon untuk
 * memastikan file yang ditulis benar-benar bisa dibaca, bukan sekadar ada.
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, data: Buffer }}
 */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("bukan PNG");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`PNG tidak didukung: depth=${bitDepth} color=${colorType} interlace=${interlace}`);
  }

  const idat = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y === 0 ? null : out.subarray((y - 1) * stride, y * stride);
    const line = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? line[x - 4] : 0;
      const up = prev === null ? 0 : prev[x];
      const upLeft = prev === null || x < 4 ? 0 : prev[x - 4];
      let value = row[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[x] = value & 0xff;
    }
  }

  return { width, height, data: out };
}

/** Ambil warna pixel sebagai `[r, g, b, a]` (0–255). */
export function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]];
}
