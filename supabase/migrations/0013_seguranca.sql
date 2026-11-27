-- =====================================================================
-- SEGURANÇA (reforço)
--  1. Funções internas deixam de ser chamáveis por visitantes sem login.
--  2. Modo game: PIN só vale para jogos criados nas últimas 48 horas, limite de
--     jogadores por partida e trava contra quem tenta adivinhar PINs.
--  3. has_active_plan / has_direcao_plan só respondem sobre a própria conta.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Sem login, só as funções do celular do aluno e do convite ficam liberadas.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_delete_user','admin_set_subscription','choose_plan','claim_invites','has_active_plan',
                         'has_direcao_plan','is_app_admin','multi_slot_results','owns_multi_exam','teaches_multi_exam',
                         'teaches_multi_slot','submit_multi_slot','handle_new_user','handle_new_subscription','set_updated_at',
                         'game_go','unlock_player','unlock_all')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;
-- quem está logado continua usando as que precisa
grant execute on function choose_plan(text), claim_invites(), is_app_admin(), multi_slot_results(uuid),
  owns_multi_exam(uuid), teaches_multi_exam(uuid), teaches_multi_slot(uuid, boolean), submit_multi_slot(uuid, boolean),
  admin_set_subscription(uuid, text, text), admin_delete_user(uuid), has_active_plan(uuid), has_direcao_plan(uuid)
  to authenticated;

-- 3) Plano: ninguém consulta o plano de outra conta (o gestor pode)
create or replace function has_active_plan(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_user = auth.uid() or exists (select 1 from app_admins where user_id = auth.uid()))
     and (exists (select 1 from app_admins where user_id = p_user)
          or exists (select 1 from subscriptions s
                      where s.user_id = p_user and s.status = 'active'
                        and (s.paid_until is null or s.paid_until + 14 >= current_date)))
$$;
create or replace function has_direcao_plan(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_user = auth.uid() or exists (select 1 from app_admins where user_id = auth.uid()))
     and (exists (select 1 from app_admins where user_id = p_user)
          or exists (select 1 from subscriptions s
                      where s.user_id = p_user and s.status = 'active' and s.plan = 'direcao'
                        and (s.paid_until is null or s.paid_until + 14 >= current_date)))
$$;

-- 2) Modo game
create table if not exists game_pin_misses (
  minute timestamptz primary key,
  misses int not null default 0
);
alter table game_pin_misses enable row level security;
revoke all on game_pin_misses from anon, authenticated;

-- Acha o jogo do PIN (últimas 48 h). Muitas tentativas erradas no mesmo minuto → espera.
-- PIN errado não dá erro aqui (o erro desfaria a contagem): devolve vazio e quem chamou responde.
create or replace function find_game_by_pin(p_pin text) returns games
language plpgsql security definer set search_path = public as $$
declare g games; v_now timestamptz := date_trunc('minute', now()); v_misses int;
begin
  select misses into v_misses from game_pin_misses where minute = v_now;
  if coalesce(v_misses, 0) > 300 then
    raise exception 'Muitas tentativas agora. Espere um minuto e digite o PIN de novo.';
  end if;
  select * into g from games
   where pin = btrim(coalesce(p_pin, '')) and status <> 'finished' and created_at > now() - interval '48 hours'
   order by created_at desc limit 1;
  if g.id is null then
    insert into game_pin_misses (minute, misses) values (v_now, 1)
      on conflict (minute) do update set misses = game_pin_misses.misses + 1;
    delete from game_pin_misses where minute < now() - interval '1 hour';
  end if;
  return g;
end $$;
revoke execute on function find_game_by_pin(text) from public, anon, authenticated;

create or replace function game_info(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_students json;
begin
  g := find_game_by_pin(p_pin);
  if g.id is null then return json_build_object('error', 'PIN não encontrado. Confira o número no telão.'); end if;
  select json_agg(json_build_object('id', s.id, 'name', s.name, 'roll', s.roll_number,
           'taken', exists (select 1 from game_players p where p.game_id = g.id and s.id = any (p.student_ids)))
         order by s.roll_number nulls last, s.name)
    into v_students
    from assessments a join students s on s.class_id = a.class_id and s.active
   where a.id = g.assessment_id;
  return json_build_object('title', g.title, 'team_size', g.team_size, 'status', g.status, 'students', coalesce(v_students, '[]'::json));
end $$;

create or replace function join_game(p_pin text, p_name text, p_members text[], p_secret uuid, p_students uuid[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare
  g games;
  p game_players;
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
  v_members text[];
  v_students uuid[] := coalesce(p_students, '{}');
  v_class uuid;
begin
  if p_secret is null then raise exception 'Abra o jogo de novo pelo link.'; end if;
  g := find_game_by_pin(p_pin);
  if g.id is null then return json_build_object('error', 'PIN não encontrado. Confira o número no telão.'); end if;
  select class_id into v_class from assessments where id = g.assessment_id;

  if array_length(v_students, 1) > 0 then
    if array_length(v_students, 1) > g.team_size then raise exception 'Este jogo é para equipes de até % pessoa(s).', g.team_size; end if;
    if exists (select 1 from unnest(v_students) sid where not exists (select 1 from students s where s.id = sid and s.class_id = v_class)) then
      raise exception 'Aluno não encontrado nesta turma.';
    end if;
    select array_agg(s.name order by s.name) into v_members from students s where s.id = any (v_students);
  else
    select array_agg(left(btrim(m), 40)) into v_members from unnest(coalesce(p_members, '{}')) m where btrim(m) <> '';
  end if;
  v_members := coalesce(v_members, '{}');
  if coalesce(array_length(v_members, 1), 0) > g.team_size then raise exception 'Este jogo é para equipes de até % pessoa(s).', g.team_size; end if;
  if v_name = '' then v_name := left(array_to_string(v_members, ' e '), 40); end if;
  if v_name = '' then raise exception 'Digite o nome.'; end if;

  select * into p from game_players where game_id = g.id and lower(name) = lower(v_name);
  if p.id is not null then
    if p.secret <> p_secret then raise exception 'Já tem um jogador com esse nome. Escolha outro.'; end if;
    return json_build_object('player_id', p.id, 'game_id', g.id);
  end if;
  if (select count(*) from game_players where game_id = g.id) >= 120 then
    raise exception 'A sala está cheia.';
  end if;
  if exists (select 1 from game_players x where x.game_id = g.id and x.student_ids && v_students) then
    raise exception 'Um desses alunos já entrou no jogo em outro celular.';
  end if;
  insert into game_players (game_id, name, members, secret, student_ids)
    values (g.id, v_name, v_members, p_secret, v_students) returning * into p;
  return json_build_object('player_id', p.id, 'game_id', g.id);
end $$;
grant execute on function game_info(text), join_game(text, text, text[], uuid, uuid[]) to anon, authenticated;
