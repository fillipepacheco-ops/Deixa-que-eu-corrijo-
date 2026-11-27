-- =====================================================================
-- GESTÃO: desfazer lançamento e mudar o vencimento à mão
--  - Toda ação da aba Gestão fica registrada com a situação de antes.
--  - "Desfazer" volta exatamente para como estava antes da última ação.
--    (Lançamentos feitos antes desta atualização: desfazer tira 30 dias.)
--  - "Mudar vencimento": escolher a data de pagamento até.
-- Rode depois da 0010. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists subscription_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  before jsonb not null,
  at timestamptz not null default now(),
  by_user uuid default auth.uid(),
  undone boolean not null default false
);
create index if not exists subscription_changes_user_idx on subscription_changes(user_id, at desc);
alter table subscription_changes enable row level security;
drop policy if exists "gestor vê o histórico" on subscription_changes;
create policy "gestor vê o histórico" on subscription_changes for select using (is_app_admin());
grant select on subscription_changes to authenticated;
revoke all on subscription_changes from anon;

create or replace function admin_set_subscription(p_user uuid, p_action text, p_plan text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s subscriptions; c subscription_changes;
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  select * into s from subscriptions where user_id = p_user;
  if s.user_id is null then raise exception 'Assinatura não encontrada.'; end if;

  if p_action = 'desfazer' then
    select * into c from subscription_changes where user_id = p_user and not undone order by at desc, id desc limit 1;
    if c.id is not null then
      update subscriptions set
        status = c.before->>'status',
        paid_until = (c.before->>'paid_until')::date,
        plan = c.before->>'plan',
        updated_at = now()
       where user_id = p_user;
      update subscription_changes set undone = true where id = c.id;
    elsif s.paid_until is not null then
      -- lançamento antigo, sem registro: tira os 30 dias
      update subscriptions set paid_until = paid_until - 30, updated_at = now() where user_id = p_user;
    end if;
    return;
  end if;

  insert into subscription_changes (user_id, action, before)
  values (p_user, p_action, jsonb_build_object('status', s.status, 'paid_until', s.paid_until, 'plan', s.plan));

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

-- mudar a data de vencimento à mão
create or replace function admin_set_paid_until(p_user uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare s subscriptions;
begin
  if not is_app_admin() then raise exception 'Sem permissão.'; end if;
  if p_date is null or p_date < current_date - 365 or p_date > current_date + 800 then raise exception 'Data inválida.'; end if;
  select * into s from subscriptions where user_id = p_user;
  if s.user_id is null then raise exception 'Assinatura não encontrada.'; end if;
  insert into subscription_changes (user_id, action, before)
  values (p_user, 'data', jsonb_build_object('status', s.status, 'paid_until', s.paid_until, 'plan', s.plan));
  update subscriptions set paid_until = p_date,
         status = case when s.status = 'pending' then 'active' else s.status end,
         updated_at = now()
   where user_id = p_user;
end $$;

revoke execute on function admin_set_subscription(uuid, text, text), admin_set_paid_until(uuid, date) from public, anon;
grant execute on function admin_set_subscription(uuid, text, text), admin_set_paid_until(uuid, date) to authenticated;
