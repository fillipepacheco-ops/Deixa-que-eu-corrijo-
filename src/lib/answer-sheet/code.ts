/**
 * Código de identificação impresso no cartão-resposta.
 *
 * 24 bits = número do cartão (answer_sheets.sheet_number, até 16.777.215)
 *  8 bits = CRC-8 (polinômio 0x07) — detecta leitura errada do código.
 * Total: 32 células na faixa superior do cartão. 1 = célula preenchida.
 */

export const CODE_DATA_BITS = 24;
export const CODE_CRC_BITS = 8;
export const CODE_TOTAL_BITS = CODE_DATA_BITS + CODE_CRC_BITS;
export const MAX_SHEET_NUMBER = 2 ** CODE_DATA_BITS - 1;

export function crc8(bytes: number[]): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b & 0xff;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function toBytes(n: number): number[] {
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function encodeSheetNumber(n: number): number[] {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SHEET_NUMBER) {
    throw new Error(`Número de cartão inválido: ${n}`);
  }
  const value = n * 256 + crc8(toBytes(n)); // 32 bits sem operar com sinal
  const bits: number[] = [];
  for (let i = CODE_TOTAL_BITS - 1; i >= 0; i--) bits.push(Math.floor(value / 2 ** i) % 2);
  return bits;
}

/** Retorna o número do cartão ou null se o CRC não bater (leitura não confiável). */
export function decodeSheetNumber(bits: number[]): number | null {
  if (bits.length !== CODE_TOTAL_BITS || bits.some((b) => b !== 0 && b !== 1)) return null;
  let value = 0;
  for (const b of bits) value = value * 2 + b;
  const n = Math.floor(value / 256);
  const crc = value % 256;
  return crc8(toBytes(n)) === crc ? n : null;
}
