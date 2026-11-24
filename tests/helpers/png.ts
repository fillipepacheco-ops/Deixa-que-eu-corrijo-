/** Gera um PNG simples (gráfico de barras) sem dependências, para testes e amostras. */
import { deflateSync } from "node:zlib";

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function barChartPng(values: number[], w = 360, h = 200): Uint8Array {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const max = Math.max(...values);
  const barW = Math.floor((w - 40) / values.length);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      let [r, g, b] = [255, 255, 255];
      if (y === h - 20 && x >= 20 && x < w - 20) [r, g, b] = [60, 60, 60];
      const i = Math.floor((x - 24) / barW);
      if (i >= 0 && i < values.length && (x - 24) % barW < barW - 10) {
        const top = h - 20 - Math.round((values[i] / max) * (h - 40));
        if (y >= top && y < h - 20) [r, g, b] = i % 2 ? [20, 104, 74] : [31, 179, 107];
      }
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}
