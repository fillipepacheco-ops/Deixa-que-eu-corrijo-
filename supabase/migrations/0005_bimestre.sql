-- =====================================================================
-- Bimestre de cada avaliação (para separar as listas). Pode rodar mais de uma vez.
-- Sem esta atualização o app calcula o bimestre pelo título ou pela data.
-- =====================================================================
alter table assessments add column if not exists term smallint check (term between 1 and 4);
