-- =====================================================================
-- LIXEIRA DA GESTÃO: apagar uma conta não apaga mais na hora.
--  - A conta vai para a lixeira: a pessoa não consegue entrar nem usar o app,
--    mas turmas, provas, notas e arquivos continuam guardados.
--  - "Restaurar" devolve tudo como estava.
--  - Depois de 30 dias na lixeira, a conta é apagada de vez (automático).
-- Rode depois da 0010 (e da 0016). Pode rodar mais de uma vez.
-- =====================================================================

alter table subscriptions add column if not exists deleted_at timestamptz;
alter table subscriptions add column if not exists status_before_delete text;

-- Conta na lixeira não acessa nada (soma-se às regras de assinatura).
create or replace function has_active_plan(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_user = auth.uid() or exists (select 1 from app_admins where user_id = auth.uid()))
     and (exists (select 1 from app_admins where user_id = p_user)
          or exists (select 1 from subscriptions s
                      where s.user_id = p_user and s.deleted_at is null and s.status = 'active'
                        and (s.paid_until is null or s.paid_until + 14 >= current_date)))
$$;

-- Apaga de vez o que está na lixeira há mais de 30 dias.
create or replace function purge_trash() returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  with gone as (
    delete from auth.users u
     using subscriptions s
     where s.user_id = u.id and s.deleted_at is not null and s.deleted_at < now() - interval '30 days'
       and not exists (select 1 from app_admins a where a.user_id = u.id)
    returning u.id
  ) select count(*) into n from gone;
  return n;
end $$;
revoke execute on function purge_trash() from public, anon, authenticated;

-- "Apagar" na Gestão agora manda para a lixeira (nada é perdido).
create or replace function admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  if exists (select 1 from app_admins where user_id = p_user) then raise exception 'Não é possível apagar a conta do gestor.'; end if;
  update subscriptions set deleted_at = now(), status_before_delete = coalesce(status_before_delete, status), updated_at = now()
   where user_id = p_user and deleted_at is null;
  -- impede o login enquanto estiver na lixeira
  update auth.users set banned_until = now() + interval '31 days' where id = p_user;
end $$;

create or replace function admin_restore_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  update subscriptions set deleted_at = null, status = coalesce(status_before_delete, status), status_before_delete = null, updated_at = now()
   where user_id = p_user;
  update auth.users set banned_until = null where id = p_user;
end $$;

-- Apagar de vez agora (só para quem já está na lixeira).
create or replace function admin_purge_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  if not exists (select 1 from subscriptions where user_id = p_user and deleted_at is not null) then
    raise exception 'Primeiro mande a conta para a lixeira.';
  end if;
  if exists (select 1 from app_admins where user_id = p_user) then raise exception 'Não é possível apagar a conta do gestor.'; end if;
  delete from auth.users where id = p_user;
end $$;

-- O gestor abre a Gestão → limpa o que venceu.
create or replace function admin_purge_trash() returns int
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_app_admin() then return 0; end if;
  return purge_trash();
end $$;

revoke execute on function admin_delete_user(uuid), admin_restore_user(uuid), admin_purge_user(uuid), admin_purge_trash() from public, anon;
grant execute on function admin_delete_user(uuid), admin_restore_user(uuid), admin_purge_user(uuid), admin_purge_trash() to authenticated;

-- Limpeza diária automática, se o agendador do Supabase (pg_cron) estiver ligado.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'dqec-lixeira';
    perform cron.schedule('dqec-lixeira', '17 4 * * *', 'select public.purge_trash()');
  end if;
end $$;
