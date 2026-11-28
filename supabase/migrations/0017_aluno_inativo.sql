-- =====================================================================
-- ALUNO QUE NÃO FREQUENTA MAIS (transferido, desistente, remanejado…)
-- O aluno continua na lista (em cinza, no lugar dele na chamada), mas
-- não recebe prova, cartão, nota nem entra no jogo.
-- Usa a coluna "active" que já existe; aqui só o motivo e a data.
-- Pode rodar mais de uma vez.
-- =====================================================================
alter table students add column if not exists inactive_reason text;
alter table students add column if not exists inactive_since date;
