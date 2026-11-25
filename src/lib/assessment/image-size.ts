/** Lê largura/altura de PNG e JPEG direto dos bytes (sem dependências). */
export function imageSize(bytes: Uint8Array, kind: "png" | "jpg"): { width: number; height: number } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === "png") {
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    const len = dv.getUint16(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
    }
    i += 2 + len;
  }
  return { width: 400, height: 300 };
}
