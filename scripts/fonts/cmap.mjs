/**
 * Pembaca `cmap` TTF minimal — untuk memverifikasi subset, bukan untuk render.
 *
 * Cukup format 4 (BMP, yang dipakai semua font ini) dan format 12 (repertoire
 * penuh, muncul kalau font sumber punya glyph di luar BMP). Tanpa ini, verifikasi
 * "tidak ada tofu" hanya bisa dilakukan manual di browser; di sini jadi assertion.
 */

function u16(buf, off) {
  return buf.readUInt16BE(off);
}
function u32(buf, off) {
  return buf.readUInt32BE(off);
}

/** @returns {number[]} semua kodeepoint yang punya glyph di font. */
export function readCmapCodepoints(fontBuffer) {
  const numTables = u16(fontBuffer, 4);
  let cmapOffset = null;
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    if (fontBuffer.toString("ascii", record, record + 4) === "cmap") {
      cmapOffset = u32(fontBuffer, record + 8);
      break;
    }
  }
  if (cmapOffset === null) throw new Error("ttf tidak punya tabel cmap");

  const subtableCount = u16(fontBuffer, cmapOffset + 2);
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < subtableCount; i += 1) {
    const platformId = u16(fontBuffer, cmapOffset + 4 + i * 8);
    const encodingId = u16(fontBuffer, cmapOffset + 6 + i * 8);
    const offset = cmapOffset + u32(fontBuffer, cmapOffset + 8 + i * 8);
    const format = u16(fontBuffer, offset);
    // Pilih yang paling lengkap & portable: (3,10) > (3,1) > (0,*) > (3,0) > (1,0)
    const score =
      format === 12 && platformId === 3 && encodingId === 10
        ? 5
        : format === 12 && platformId === 0
          ? 4
          : format === 4 && platformId === 3 && encodingId === 1
            ? 3
            : format === 4 && platformId === 0
              ? 2
              : format === 4 && platformId === 3 && encodingId === 0
                ? 1
                : 0;
    if (format === 4 || format === 12) {
      if (score > bestScore) {
        bestScore = score;
        best = { format, offset };
      }
    }
  }
  if (!best) throw new Error("tidak ada subtable cmap format 4/12");

  const codepoints = new Set();
  if (best.format === 4) {
    const segCountX2 = u16(fontBuffer, best.offset + 6);
    const segCount = segCountX2 / 2;
    const endBase = best.offset + 14;
    const startBase = endBase + segCountX2 + 2;
    const deltaBase = startBase + segCountX2;
    const rangeBase = deltaBase + segCountX2;
    for (let seg = 0; seg < segCount; seg += 1) {
      const end = u16(fontBuffer, endBase + seg * 2);
      const start = u16(fontBuffer, startBase + seg * 2);
      const delta = fontBuffer.readInt16BE(deltaBase + seg * 2);
      const rangeOffset = u16(fontBuffer, rangeBase + seg * 2);
      if (start === 0xffff) continue;
      for (let cp = start; cp <= end && cp !== 0x10000; cp += 1) {
        if (rangeOffset === 0) {
          if (((cp + delta) & 0xffff) !== 0) codepoints.add(cp);
          continue;
        }
        const glyphIndexAddress = rangeBase + seg * 2 + rangeOffset + (cp - start) * 2;
        if (glyphIndexAddress + 1 >= fontBuffer.length) continue;
        const glyphIndex = u16(fontBuffer, glyphIndexAddress);
        if (glyphIndex !== 0) codepoints.add(cp);
      }
    }
  } else {
    const groupCount = u32(fontBuffer, best.offset + 12);
    for (let i = 0; i < groupCount; i += 1) {
      const group = best.offset + 16 + i * 12;
      const start = u32(fontBuffer, group);
      const end = u32(fontBuffer, group + 4);
      const startGlyph = u32(fontBuffer, group + 8);
      if (startGlyph === 0 && start === 0) continue;
      // Batasi agar font rusak tidak meledakkan loop.
      for (let cp = start; cp <= Math.min(end, start + 0xffff); cp += 1) {
        if (startGlyph + (cp - start) !== 0) codepoints.add(cp);
      }
    }
  }
  return [...codepoints].sort((a, b) => a - b);
}