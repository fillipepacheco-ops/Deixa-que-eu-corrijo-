-- =====================================================================
-- Permissões da API (Data API) para usuários logados.
-- Projetos Supabase recentes não liberam automaticamente as tabelas
-- criadas pelo SQL Editor. O RLS continua decidindo QUAIS linhas cada
-- professor vê; isto só libera o acesso às tabelas para quem está logado.
-- Pode rodar mais de uma vez.
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tabelas criadas no futuro já nascem liberadas para usuários logados.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- Perfil de quem já criou conta antes desta correção.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
on conflict (id) do nothing;
