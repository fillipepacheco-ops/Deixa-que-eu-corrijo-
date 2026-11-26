-- =====================================================================
-- 1) Tipos de questão do PAS: Tipo B (numérica C/D/U) e Tipo D (10 linhas)
-- 2) MODO GAME ao vivo (estilo Kahoot)
-- Pode rodar mais de uma vez.
--
-- Segurança: o aluno NÃO faz login. Ele só fala com o banco por funções
-- (entrar, ver o estado, responder, avisar que saiu da tela), que conferem
-- o "segredo" do aparelho dele. O gabarito fica numa tabela que só o
-- professor dono do jogo enxerga; a pontuação é calculada no banco.
-- =====================================================================
alter type question_type add value if not exists 'numeric';
alter type question_type add value if not exists 'lined';

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessment_id uuid references assessments(id) on delete set null,
  title text not null,
  pin text not null,
  team_size smallint not null default 1 check (team_size between 1 and 3),
  status text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'ranking', 'finished')),
  current_index int not null default -1,
  question_started_at timestamptz,
  question_count int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists games_pin_aberto on games (pin) where status <> 'finished';

create table if not exists game_questions (
  game_id uuid not null references games(id) on delete cascade,
  idx int not null,
  type text not null check (type in ('multiple_choice', 'true_false', 'numeric')),
  statement text not null,
  options jsonb not null default '[]'::jsonb,
  image_url text,
  time_limit smallint not null default 20 check (time_limit between 5 and 480),
  primary key (game_id, idx)
);

-- gabarito: só o professor vê
create table if not exists game_keys (
  game_id uuid not null references games(id) on delete cascade,
  idx int not null,
  correct text[] not null,
  primary key (game_id, idx)
);

create table if not exists game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  members text[] not null default '{}',
  secret uuid not null,
  score int not null default 0,
  violations int not null default 0,
  locked boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (game_id, name)
);

create table if not exists game_answers (
  id bigint generated always as identity primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references game_players(id) on delete cascade,
  idx int not null,
  answer text,
  correct boolean not null default false,
  points int not null default 0,
  ms int not null default 0,
  created_at timestamptz not null default now(),
  unique (player_id, idx)
);
create index if not exists game_answers_jogo on game_answers (game_id, idx);

alter table games enable row level security;
alter table game_questions enable row level security;
alter table game_keys enable row level security;
alter table game_players enable row level security;
alter table game_answers enable row level security;

drop policy if exists "dono do jogo" on games;
create policy "dono do jogo" on games for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "dono do jogo" on game_questions;
create policy "dono do jogo" on game_questions for all
  using (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()));
drop policy if exists "dono do jogo" on game_keys;
create policy "dono do jogo" on game_keys for all
  using (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()));
drop policy if exists "dono do jogo" on game_players;
create policy "dono do jogo" on game_players for all
  using (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()));
drop policy if exists "dono do jogo" on game_answers;
create policy "dono do jogo" on game_answers for all
  using (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid()));

grant select, insert, update, delete on games, game_questions, game_keys, game_players, game_answers to authenticated;
revoke all on games, game_questions, game_keys, game_players, game_answers from anon;

-- ---------- funções do aluno (sem login) ----------

create or replace function game_now() returns timestamptz
language sql stable as $$ select now() $$;

-- tela de entrada: nome do jogo e tamanho das equipes pelo PIN
create or replace function game_info(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare g games;
begin
  select * into g from games where pin = btrim(p_pin) and status <> 'finished' order by created_at desc limit 1;
  if g.id is null then raise exception 'PIN não encontrado. Confira o número no telão.'; end if;
  return json_build_object('title', g.title, 'team_size', g.team_size, 'status', g.status);
end $$;

create or replace function join_game(p_pin text, p_name text, p_members text[], p_secret uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  g games;
  p game_players;
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
  v_members text[];
begin
  select * into g from games where pin = btrim(p_pin) and status <> 'finished' order by created_at desc limit 1;
  if g.id is null then raise exception 'PIN não encontrado. Confira o número no telão.'; end if;
  if v_name = '' then raise exception 'Digite o nome.'; end if;
  select array_agg(left(btrim(m), 40)) into v_members
    from unnest(coalesce(p_members, '{}')) m where btrim(m) <> '';
  v_members := coalesce(v_members, '{}');
  if coalesce(array_length(v_members, 1), 0) > g.team_size then raise exception 'Este jogo é para equipes de até % pessoa(s).', g.team_size; end if;

  select * into p from game_players where game_id = g.id and lower(name) = lower(v_name);
  if p.id is not null then
    if p.secret <> p_secret then raise exception 'Já tem um jogador com esse nome. Escolha outro.'; end if;
    return json_build_object('player_id', p.id, 'game_id', g.id);
  end if;
  insert into game_players (game_id, name, members, secret) values (g.id, v_name, v_members, p_secret) returning * into p;
  return json_build_object('player_id', p.id, 'game_id', g.id);
end $$;

create or replace function game_state(p_player uuid, p_secret uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  p game_players;
  g games;
  q game_questions;
  k game_keys;
  a game_answers;
  v_rank int;
  v_total int;
  v_top json;
begin
  select * into p from game_players where id = p_player and secret = p_secret;
  if p.id is null then raise exception 'Jogador não encontrado. Entre de novo com o PIN.'; end if;
  select * into g from games where id = p.game_id;
  select * into q from game_questions where game_id = g.id and idx = g.current_index;
  select * into a from game_answers where player_id = p.id and idx = g.current_index;
  select count(*) + 1 into v_rank from game_players where game_id = g.id and score > p.score;
  select count(*) into v_total from game_players where game_id = g.id;
  if g.status in ('reveal', 'ranking', 'finished') then
    select * into k from game_keys where game_id = g.id and idx = g.current_index;
    select json_agg(t) into v_top from (
      select name, score from game_players where game_id = g.id order by score desc, joined_at limit 5
    ) t;
  end if;
  return json_build_object(
    'game_id', g.id, 'title', g.title, 'status', g.status, 'index', g.current_index,
    'count', g.question_count, 'team_size', g.team_size,
    'started_at', g.question_started_at, 'server_now', now(),
    'question', case when g.status in ('question', 'reveal', 'ranking') and q.idx is not null then json_build_object(
      'idx', q.idx, 'type', q.type, 'statement', q.statement, 'options', q.options, 'image_url', q.image_url, 'time_limit', q.time_limit) end,
    'correct', case when g.status in ('reveal', 'ranking') then k.correct end,
    'player', json_build_object('name', p.name, 'members', p.members, 'score', p.score, 'locked', p.locked,
      'violations', p.violations, 'rank', v_rank, 'players', v_total),
    'answer', case when a.id is null then null
      when g.status = 'question' then json_build_object('answer', a.answer)
      else json_build_object('answer', a.answer, 'correct', a.correct, 'points', a.points) end,
    'top', v_top
  );
end $$;

create or replace function submit_answer(p_player uuid, p_secret uuid, p_idx int, p_answer text)
returns json language plpgsql security definer set search_path = public as $$
declare
  p game_players;
  g games;
  q game_questions;
  k game_keys;
  v_ms int;
  v_ok boolean := false;
  v_points int := 0;
  v_ans text := left(btrim(coalesce(p_answer, '')), 10);
begin
  select * into p from game_players where id = p_player and secret = p_secret;
  if p.id is null then raise exception 'Jogador não encontrado.'; end if;
  if p.locked then raise exception 'Você está bloqueado. Chame o professor.'; end if;
  select * into g from games where id = p.game_id;
  if g.status = 'lobby' then raise exception 'O jogo ainda não começou. Aguarde o professor.'; end if;
  if g.status <> 'question' or g.current_index <> p_idx then raise exception 'O tempo desta questão acabou.'; end if;
  select * into q from game_questions where game_id = g.id and idx = p_idx;
  v_ms := greatest(0, floor(extract(epoch from (now() - g.question_started_at)) * 1000))::int;
  if v_ms > q.time_limit * 1000 + 1500 then raise exception 'O tempo desta questão acabou.'; end if;
  select * into k from game_keys where game_id = g.id and idx = p_idx;
  if q.type = 'numeric' then
    v_ok := v_ans ~ '^\d{1,3}$' and exists (select 1 from unnest(k.correct) c where c ~ '^\d{1,3}$' and c::int = v_ans::int);
  else
    v_ok := exists (select 1 from unnest(k.correct) c where upper(c) = upper(v_ans));
  end if;
  if v_ok then
    v_points := round(1000 * (1 - least(1.0, v_ms::numeric / (q.time_limit * 1000)) / 2));
  end if;
  insert into game_answers (game_id, player_id, idx, answer, correct, points, ms)
    values (g.id, p.id, p_idx, v_ans, v_ok, v_points, v_ms)
    on conflict (player_id, idx) do nothing;
  if found then
    update game_players set score = score + v_points where id = p.id;
  end if;
  return json_build_object('ok', true);
end $$;

-- saiu da tela do jogo (trocou de aba/app): fica bloqueado até o professor liberar
create or replace function report_violation(p_player uuid, p_secret uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  p game_players;
  g games;
begin
  select * into p from game_players where id = p_player and secret = p_secret;
  if p.id is null then raise exception 'Jogador não encontrado.'; end if;
  select * into g from games where id = p.game_id;
  if g.status in ('lobby', 'finished') then return json_build_object('locked', p.locked); end if;
  update game_players set violations = violations + 1, locked = true where id = p.id;
  return json_build_object('locked', true);
end $$;

-- ---------- função do professor ----------
-- muda a fase do jogo usando o relógio do servidor (todos com o mesmo tempo)
create or replace function game_go(p_game uuid, p_status text, p_index int)
returns json language plpgsql security definer set search_path = public as $$
declare
  g games;
begin
  update games set
    status = p_status,
    current_index = coalesce(p_index, current_index),
    question_started_at = case when p_status = 'question' then now() else question_started_at end,
    finished_at = case when p_status = 'finished' then now() else finished_at end
  where id = p_game and owner_id = auth.uid()
  returning * into g;
  if g.id is null then raise exception 'Jogo não encontrado.'; end if;
  return json_build_object('status', g.status, 'index', g.current_index, 'started_at', g.question_started_at, 'server_now', now());
end $$;

revoke all on function game_info(text), join_game(text, text, text[], uuid), game_state(uuid, uuid), submit_answer(uuid, uuid, int, text),
  report_violation(uuid, uuid), game_go(uuid, text, int) from public;
grant execute on function game_now() to anon, authenticated;
grant execute on function game_info(text), join_game(text, text, text[], uuid), game_state(uuid, uuid), submit_answer(uuid, uuid, int, text),
  report_violation(uuid, uuid) to anon, authenticated;
grant execute on function game_go(uuid, text, int) to authenticated;
