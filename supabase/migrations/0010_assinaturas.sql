-- =====================================================================
-- ASSINATURAS (R$ 9,90 professor · R$ 29,90 direção) e aba GESTÃO.
--  - Mensalidade de 30 dias; depois do vencimento há 14 dias de tolerância
--    e então o acesso é bloqueado automaticamente.
--  - O bloqueio vale também no banco (não dá para burlar pela API).
--  - Só a conta do gestor (app_admins) vê e altera as assinaturas de todos.
-- Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table app_admins enable row level security;
revoke all on app_admins from anon, authenticated;

-- Conta do gestor. Se o seu login no app for outro e-mail, troque aqui e rode de novo.
insert into app_admins (user_id)
select id from auth.users where lower(email) = lower('fhfpacheco@gmail.com')
on conflict do nothing;

create or replace function is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid())
$$;

create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'professor' check (plan in ('professor', 'direcao')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  paid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
drop policy if exists "ver a própria assinatura" on subscriptions;
create policy "ver a própria assinatura" on subscriptions for select using (user_id = auth.uid() or is_app_admin());
drop policy if exists "gestor altera" on subscriptions;
create policy "gestor altera" on subscriptions for update using (is_app_admin()) with check (is_app_admin());
drop policy if exists "gestor apaga" on subscriptions;
create policy "gestor apaga" on subscriptions for delete using (is_app_admin());
-- o professor só pode escolher/trocar o plano enquanto não está ativo (sem mexer em status e data)
drop policy if exists "escolher plano" on subscriptions;
create policy "escolher plano" on subscriptions for insert with check (user_id = auth.uid() and status = 'pending' and paid_until is null);
grant select, insert, update, delete on subscriptions to authenticated;
revoke all on subscriptions from anon;

-- Quem já usa o app: já pagou → ativo por 30 dias a partir de hoje.
insert into subscriptions (user_id, email, full_name, plan, status, paid_until)
select u.id, u.email, coalesce(p.full_name, u.raw_user_meta_data->>'full_name', ''), 'professor', 'active', current_date + 30
  from auth.users u left join profiles p on p.id = u.id
on conflict (user_id) do nothing;

-- Conta nova: assinatura "aguardando pagamento" com o plano escolhido na página de vendas.
create or replace function handle_new_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, email, full_name, plan)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
          case when new.raw_user_meta_data->>'plan' = 'direcao' then 'direcao' else 'professor' end)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_subscription on auth.users;
create trigger on_auth_user_subscription after insert on auth.users
  for each row execute function handle_new_subscription();

-- Acesso liberado? (ativo e dentro do prazo + 14 dias de tolerância; o gestor sempre)
create or replace function has_active_plan(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = p_user)
      or exists (
        select 1 from subscriptions s
         where s.user_id = p_user and s.status = 'active'
           and (s.paid_until is null or s.paid_until + 14 >= current_date)
      )
$$;
grant execute on function has_active_plan(uuid), is_app_admin() to authenticated;

-- O professor troca o plano escolhido enquanto ainda não pagou.
create or replace function choose_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_plan not in ('professor', 'direcao') then raise exception 'Plano inválido.'; end if;
  insert into subscriptions (user_id, email, plan)
    select auth.uid(), (select email from auth.users where id = auth.uid()), p_plan
  on conflict (user_id) do update set plan = excluded.plan, updated_at = now()
    where subscriptions.status <> 'active';
end $$;
grant execute on function choose_plan(text) to authenticated;

-- Gestor: confirmar pagamento (+30 dias), suspender, reativar.
create or replace function admin_set_subscription(p_user uuid, p_action text, p_plan text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  if p_action = 'pagou' then
    update subscriptions set status = 'active',
      paid_until = greatest(coalesce(paid_until, current_date), current_date) + 30,
      plan = coalesce(p_plan, plan), updated_at = now()
     where user_id = p_user;
  elsif p_action = 'suspender' then
    update subscriptions set status = 'suspended', updated_at = now() where user_id = p_user;
  elsif p_action = 'reativar' then
    update subscriptions set status = 'active', paid_until = greatest(coalesce(paid_until, current_date), current_date),
      updated_at = now() where user_id = p_user;
  elsif p_action = 'plano' and p_plan in ('professor', 'direcao') then
    update subscriptions set plan = p_plan, updated_at = now() where user_id = p_user;
  else
    raise exception 'Ação inválida.';
  end if;
end $$;
grant execute on function admin_set_subscription(uuid, text, text) to authenticated;

-- Gestor: apagar a conta do professor (e todos os dados dele).
create or replace function admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  if exists (select 1 from app_admins where user_id = p_user) then raise exception 'Não é possível apagar a conta do gestor.'; end if;
  delete from auth.users where id = p_user;
end $$;
grant execute on function admin_delete_user(uuid) to authenticated;

-- ---------- Bloqueio também no banco ----------
-- Política RESTRITIVA: soma-se às de "somente o dono". Sem assinatura em dia, nada de ler/gravar.
do $$
declare t text;
begin
  foreach t in array array[
    'classes','students','questions','assessments','assessment_questions','answer_key_changes','answer_sheets',
    'submissions','grades','games','game_questions','game_keys','game_players','game_answers','diary_formats','schools'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "assinatura em dia" on %I', t);
      execute format('create policy "assinatura em dia" on %I as restrictive for all to authenticated
                      using (has_active_plan()) with check (has_active_plan())', t);
    end if;
  end loop;
end $$;
