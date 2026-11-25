# Deixa que eu Corrijo

**Menos burocracia. Mais tempo para ensinar.**

Plataforma para professores: cria a avaliação uma vez e o sistema cuida do PDF, do cartão-resposta, da correção pela câmera do celular, dos resultados e do Conselho de Classe.

Stack: Next.js (App Router) · TypeScript · Tailwind · Supabase (Auth, Postgres com RLS, Storage) · Vercel · pdf-lib.

---

## Como colocar no ar (pelo iPad/celular)

1. **Supabase** → crie um projeto → *SQL Editor* → cole o conteúdo de `supabase/migrations/0001_schema_inicial.sql` → **Run**.
2. Ainda no SQL Editor, rode também `supabase/migrations/0002_permissoes_api.sql`.
3. Supabase → *Authentication → URL Configuration* → em **Site URL** coloque o endereço da Vercel (ex.: `https://deixa-que-eu-corrijo.vercel.app`) e adicione `https://SEU-ENDERECO/auth/confirm` em *Redirect URLs*.
3. **Vercel** → *Add New Project* → importe este repositório → em *Environment Variables* cadastre:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou o nome antigo `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   (Supabase → *Project Settings → API*). → **Deploy**.

Para rodar no Codespaces: copie `.env.example` para `.env.local`, preencha, e rode `npm install` e `npm run dev`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | app local |
| `npm test` | testes (nota, gabarito, anulação, PDF, cartão-resposta, leitura por câmera) |
| `npm run samples` | gera PDFs de exemplo em `amostras/` (4 modelos de prova + cartões) |
| `npm run typecheck` | checagem de tipos |

## Arquitetura

```
src/
  app/                    páginas (App Router)
    login/                entrar / criar conta
    (app)/                área logada: dashboard, turmas, alunos …
  components/             componentes reutilizáveis (ui, layout, marca, turmas)
  services/               Server Actions (auth, turmas, alunos …)
  lib/
    models/               tipos de domínio
    supabase/             clientes Supabase (navegador, servidor, middleware)
    grading/              CORREÇÃO: nota, pesos, anulação, várias respostas, estatísticas
    answer-sheet/         geometria do cartão-resposta + código do cartão (fonte única)
    pdf/                  GERAÇÃO DE PDF: prova (4 modelos) e cartão-resposta
    omr/                  PROCESSAMENTO DE IMAGEM: leitura do cartão pela foto
    students/             leitura de lista de alunos colada
supabase/migrations/      banco de dados + RLS
tests/                    testes automatizados
```

### Princípios
- **Uma informação, vários usos.** A questão cadastrada gera prova, gabarito, cartão-resposta, correção e relatórios.
- **Geometria única do cartão.** `lib/answer-sheet/layout.ts` é usado tanto para desenhar o PDF quanto para ler a foto. Os testes geram o PDF real, "marcam" bolhas, rasterizam como foto e leem de volta.
- **Nada de nota duvidosa.** Marcação fraca/rasurada vira *incerta* (“Não foi possível identificar com segurança a questão 8.”) e a correção não é registrada sem o professor confirmar.
- **Segurança/LGPD.** Toda tabela tem `owner_id` e RLS: cada professor só vê os próprios dados. Exclusões ficam no `audit_log`. Indicadores do Conselho são pedagógicos e revisáveis — nunca diagnósticos.
- **Sem telas falsas.** Itens ainda não construídos aparecem como “em breve”.

## Andamento (MVP — fase 1)

| # | Item | Situação |
|---|---|---|
| 1 | Cadastro/login | ✅ |
| 2 | Dashboard | ✅ (dados reais) |
| 3–4 | Turmas e alunos (inclui colar lista) | ✅ |
| — | Banco de dados completo + RLS | ✅ |
| 7 | Gabarito oficial: pesos, anulação, várias respostas, recálculo | ✅ lógica + testes |
| 8 | PDF A4 (4 modelos, quebra de página sem cortar questão) | ✅ gerador + testes |
| 9 | Cartão-resposta | ✅ gerador + testes |
| 10–11 | Leitura por câmera + correção automática | ✅ motor + testes · tela da câmera: próxima etapa |
| 5–6 | Criador de avaliação: cabeçalho, questões, gabarito; PDF + Word (.docx) + cartões | ✅ |
| 12–14 | Resultados, relatório básico, Conselho básico | ⏳ |
