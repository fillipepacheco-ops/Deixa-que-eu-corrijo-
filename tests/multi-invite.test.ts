import { test } from "node:test";
import assert from "node:assert/strict";
import { groupInviteText } from "@/lib/multi/invite";

test("mensagem do grupo traz todos os professores, cada um com seu link e e-mail", () => {
  const t = groupInviteText("Simulado 1º bimestre", "10/03/2026", [
    { teacher: "Ana Souza", discipline: "Português", email: "ana@x.com", count: 10, url: "https://app/convite/A1" },
    { teacher: "Bruno Lima", discipline: "Matemática", email: "bruno@x.com", count: 1, url: "https://app/convite/B2" },
  ]);
  assert.ok(t.includes('"Simulado 1º bimestre" (10/03/2026)'));
  assert.ok(t.includes("*1. Ana Souza* — Português (10 questões)\nE-mail: ana@x.com\nhttps://app/convite/A1"));
  assert.ok(t.includes("*2. Bruno Lima* — Matemática (1 questão)\nE-mail: bruno@x.com\nhttps://app/convite/B2"));
});
