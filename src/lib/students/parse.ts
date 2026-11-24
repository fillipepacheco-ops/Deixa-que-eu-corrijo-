/**
 * Lê uma lista de alunos colada (do diário, planilha ou WhatsApp).
 * Aceita por linha:  "Nome"  |  "12 Nome"  |  "12. Nome"  |  "12;Nome;Matrícula"  |  "Nome<TAB>Matrícula"
 * Base para a futura importação por CSV/Excel.
 */
export interface ParsedStudent {
  name: string;
  roll_number: number | null;
  registration: string | null;
}

export function parseStudentList(text: string): ParsedStudent[] {
  const out: ParsedStudent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[;\t]/).map((p) => p.trim()).filter(Boolean);
    let roll: number | null = null;
    let name: string;
    let registration: string | null = null;

    if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
      roll = Number(parts[0]);
      name = parts[1];
      registration = parts[2] ?? null;
    } else if (parts.length >= 2) {
      name = parts[0];
      registration = parts[1];
    } else {
      const m = line.match(/^(\d{1,3})\s*[.)\-–]?\s+(.+)$/);
      if (m) {
        roll = Number(m[1]);
        name = m[2];
      } else name = line;
    }
    name = name.replace(/\s+/g, " ").trim();
    if (name) out.push({ name, roll_number: roll, registration });
  }
  return out;
}
