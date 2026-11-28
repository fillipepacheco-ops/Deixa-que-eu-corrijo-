/**
 * IMPORTAR LISTA DE ALUNOS de Excel, CSV, Word ou PDF.
 * Tudo vira linhas "nº;nome;matrícula" que o professor confere antes de salvar
 * (o mesmo formato da caixa "Colar lista de alunos").
 */

const NAME_HEADER = /\b(nome|aluno|aluna|alunos|estudante|discente)\b/i;
const ROLL_HEADER = /^(n[º°o.]?|nº|n°|no\.?|num\.?|número|numero|chamada|nº de chamada|ordem|ord\.?|#)$/i;
const REG_HEADER = /(matr[ií]cula|\bra\b|registro|c[oó]digo|inep|id)/i;
/** Linhas de cabeçalho/rodapé de listas impressas que não são alunos. */
const NOISE = /\b(lista|turma|escola|professor|professora|disciplina|bimestre|semestre|data|p[aá]gina|diário|diario|frequ[eê]ncia|secretaria|governo|coordena|total|assinatura|ano letivo|s[eé]rie|turno|matutino|vespertino|noturno|centro de ensino|col[eé]gio)\b/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const letterWords = (s: string) => (s.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? []).length;
const isRoll = (s: string) => /^\d{1,3}[º°.]?$/.test(s.trim());
/** Nome completo: pelo menos 2 palavras, uma delas com 3+ letras e 5+ letras no total. */
const isNameLike = (s: string) => {
  const words = s.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? [];
  return (
    words.length >= 2 &&
    words.some((w) => w.length >= 3) &&
    words.join("").length >= 5 &&
    !/\d{3,}/.test(s) &&
    !NOISE.test(s) &&
    !NAME_HEADER.test(s.split(" ")[0] ?? "") &&
    !/@/.test(s)
  );
};

/** Nome em maiúsculas → "Ana Beatriz de Souza" (mantém como está se já vier misturado). */
export function tidyName(s: string): string {
  const name = clean(s).replace(/^[-–•*.,;:]+|[-–•*.,;:]+$/g, "").trim();
  if (name !== name.toUpperCase()) return name;
  const small = new Set(["de", "da", "do", "das", "dos", "e"]);
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Só o que importa: nº de chamada e nome completo ("12;Nome" ou "Nome"). */
const line = (roll: string | null, name: string, _reg?: string | null) => {
  void _reg;
  const n = tidyName(name);
  const r = roll ? String(Number(roll.replace(/\D/g, ""))) : null;
  return [r, n].filter(Boolean).join(";");
};

/** Tira repetidos e desconfia de leituras estranhas (o mesmo "nome" em várias linhas). */
export function finishRoster(lines: string[]): string[] {
  const seen = new Set<string>();
  const out = lines.filter((l) => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const names = lines.map((l) => l.replace(/^\d+;/, "").toLowerCase());
  const top = Math.max(0, ...[...new Set(names)].map((n) => names.filter((x) => x === n).length));
  if (lines.length >= 5 && top > lines.length / 3) {
    throw new Error("Não consegui ler os nomes deste arquivo direito. Me mande o arquivo para eu ajustar a leitura, ou cole os nomes na caixa.");
  }
  return out;
}

/** Planilha / tabela: acha as colunas de nome, nº e matrícula (pelo cabeçalho ou pelo conteúdo). */
export function rosterFromRows(rows: string[][]): string[] {
  const table = rows.map((r) => r.map((c) => clean(String(c ?? "")))).filter((r) => r.some(Boolean));
  if (!table.length) return [];
  const width = Math.max(...table.map((r) => r.length));

  // cabeçalho nas primeiras linhas
  let start = 0;
  let nameCol = -1;
  let rollCol = -1;
  let regCol = -1;
  for (let i = 0; i < Math.min(8, table.length); i++) {
    const r = table[i];
    const n = r.findIndex((c) => NAME_HEADER.test(c) && c.length < 40);
    if (n >= 0) {
      nameCol = n;
      rollCol = r.findIndex((c, j) => j !== n && ROLL_HEADER.test(c));
      regCol = r.findIndex((c, j) => j !== n && REG_HEADER.test(c));
      start = i + 1;
      break;
    }
  }
  const body = table.slice(start);
  if (nameCol < 0) {
    // sem cabeçalho: coluna com mais "cara de nome"
    let best = -1;
    let bestScore = 0;
    for (let j = 0; j < width; j++) {
      const score = body.filter((r) => isNameLike(r[j] ?? "")).length;
      if (score > bestScore) {
        best = j;
        bestScore = score;
      }
    }
    if (best < 0) return [];
    nameCol = best;
    const rollScore = (j: number) => body.filter((r) => isRoll(r[j] ?? "")).length;
    for (let j = 0; j < width; j++) if (j !== nameCol && rollScore(j) >= body.length * 0.6) {
      rollCol = j;
      break;
    }
    for (let j = 0; j < width; j++) if (j !== nameCol && j !== rollCol && body.filter((r) => /^\d{4,}$/.test(r[j] ?? "")).length >= body.length * 0.6) {
      regCol = j;
      break;
    }
  }
  const out: string[] = [];
  for (const r of body) {
    const name = r[nameCol] ?? "";
    if (!isNameLike(name)) continue;
    const roll = rollCol >= 0 && isRoll(r[rollCol] ?? "") ? r[rollCol] : null;
    const reg = regCol >= 0 ? r[regCol] || null : null;
    out.push(line(roll, name, reg));
  }
  return out;
}

/** Texto corrido (PDF ou Word sem tabela): um aluno por linha, nº na frente e matrícula no fim são separados. */
export function rosterFromLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    let text = clean(raw);
    if (!text) continue;
    // "01 - ANA SOUZA 2023001" / "1. Ana Souza" / "Ana Souza (123456)"
    const m = text.match(/^(\d{1,3})\s*[º°.)\-–:]?\s+(.*)$/);
    let roll: string | null = null;
    if (m) {
      roll = m[1];
      text = m[2];
    }
    let reg: string | null = null;
    const r = text.match(/^(.*?)[\s(–-]+(\d{4,}[\d.\-/]*)\)?\s*$/);
    if (r && letterWords(r[1]) >= 2) {
      text = r[1];
      reg = r[2];
    }
    // vários campos separados por tabulação ou 3+ espaços: fica com o que parece nome
    const parts = raw.split(/\t| {3,}/).map(clean).filter(Boolean);
    if (parts.length > 2 && !m) {
      const rows = rosterFromRows([parts]);
      if (rows.length) {
        out.push(...rows);
        continue;
      }
    }
    text = text.replace(/\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?.*$/, ""); // datas no fim
    if (!isNameLike(text)) continue;
    out.push(line(roll, text, reg));
  }
  return out;
}

/** CSV / texto separado por ; , ou tabulação. */
export function parseCsv(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 5).join("\n");
  const sep = (sample.match(/\t/g)?.length ?? 0) > 0 ? "\t" : (sample.match(/;/g)?.length ?? 0) >= (sample.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lines.map((l) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') {
        if (quoted && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}
