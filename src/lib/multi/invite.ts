export interface GroupInvitee {
  teacher: string;
  discipline: string;
  email: string;
  count: number;
  url: string;
}

/** Mensagem única para o grupo dos professores: cada um acha o próprio nome e clica no seu link. */
export function groupInviteText(title: string, when: string | null, list: GroupInvitee[]) {
  const head =
    `Olá, professores! Vocês foram convidados para enviar as questões da prova "${title}"${when ? ` (${when})` : ""} no Deixa que eu Corrijo.\n\n` +
    `Procure o seu nome abaixo, clique no *seu* link e entre com o e-mail indicado (se ainda não tiver conta, crie uma com esse e-mail — é gratuito):`;
  const items = list.map(
    (p, i) => `*${i + 1}. ${p.teacher}* — ${p.discipline} (${p.count} ${p.count === 1 ? "questão" : "questões"})\nE-mail: ${p.email}\n${p.url}`,
  );
  return [head, ...items].join("\n\n");
}
