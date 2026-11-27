-- =====================================================================
-- MODO GAME v2
--  - aluno escolhe o próprio nome na lista da turma (as notas vão para Resultados)
--  - pontuação e ranking ficam escondidos até a cerimônia final (3º, 2º, 1º)
--  - ao encerrar a partida, todos são desbloqueados
-- Pode rodar mais de uma vez. Precisa da 0006 antes.
-- =====================================================================
alter table game_questions add column if not exists position int;
alter table game_players add column if not exists student_ids uuid[] not null default '{}';
alter table games add column if not exists ceremony_step smallint not null default 0;
alter table games add column if not exists results_saved_at timestamptz;

-- entrada: nome do jogo, tamanho das equipes e a lista da turma (só nomes, só com jogo aberto)
drop function if exists game_info(text);
create or replace function game_info(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_students json;
begin
  select * into g from games where pin = btrim(p_pin) and status <> 'finished' order by created_at desc limit 1;
  if g.id is null then raise exception 'PIN não encontrado. Confira o número no telão.'; end if;
  select json_agg(json_build_object('id', s.id, 'name', s.name, 'roll', s.roll_number,
           'taken', exists (select 1 from game_players p where p.game_id = g.id and s.id = any (p.student_ids)))
         order by s.roll_number nulls last, s.name)
    into v_students
    from assessments a join students s on s.class_id = a.class_id and s.active
   where a.id = g.assessment_id;
  return json_build_object('title', g.title, 'team_size', g.team_size, 'status', g.status, 'students', coalesce(v_students, '[]'::json));
end $$;

drop function if exists join_game(text, text, text[], uuid);
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
  select * into g from games where pin = btrim(p_pin) and status <> 'finished' order by created_at desc limit 1;
  if g.id is null then raise exception 'PIN não encontrado. Confira o número no telão.'; end if;
  select class_id into v_class from assessments where id = g.assessment_id;

  -- alunos escolhidos na lista: precisam ser da turma e não estar em outra equipe
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
  if exists (select 1 from game_players x where x.game_id = g.id and x.student_ids && v_students) then
    raise exception 'Um desses alunos já entrou no jogo em outro celular.';
  end if;
  insert into game_players (game_id, name, members, secret, student_ids)
    values (g.id, v_name, v_members, p_secret, v_students) returning * into p;
  return json_build_object('player_id', p.id, 'game_id', g.id);
end $$;

-- estado para o celular: SEM pontos e SEM ranking durante a partida
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
  v_correct int;
begin
  select * into p from game_players where id = p_player and secret = p_secret;
  if p.id is null then raise exception 'Jogador não encontrado. Entre de novo com o PIN.'; end if;
  select * into g from games where id = p.game_id;
  select * into q from game_questions where game_id = g.id and idx = g.current_index;
  select * into a from game_answers where player_id = p.id and idx = g.current_index;
  if g.status = 'reveal' then
    select * into k from game_keys where game_id = g.id and idx = g.current_index;
  end if;
  -- posição só depois que a cerimônia termina
  if g.status = 'finished' and g.ceremony_step >= 3 then
    select count(*) + 1 into v_rank from game_players where game_id = g.id and score > p.score;
    select count(*) into v_total from game_players where game_id = g.id;
  end if;
  select count(*) into v_correct from game_answers where player_id = p.id and correct;
  return json_build_object(
    'game_id', g.id, 'title', g.title, 'status', g.status, 'index', g.current_index,
    'count', g.question_count, 'team_size', g.team_size, 'ceremony_step', g.ceremony_step,
    'started_at', g.question_started_at, 'server_now', now(),
    'question', case when g.status in ('question', 'reveal') and q.idx is not null then json_build_object(
      'idx', q.idx, 'type', q.type, 'statement', q.statement, 'options', q.options, 'image_url', q.image_url, 'time_limit', q.time_limit) end,
    'correct', case when g.status = 'reveal' then k.correct end,
    'player', json_build_object('name', p.name, 'members', p.members, 'locked', p.locked, 'violations', p.violations,
      'rank', v_rank, 'players', v_total,
      'score', case when g.status = 'finished' and g.ceremony_step >= 3 then p.score end,
      'hits', case when g.status = 'finished' then v_correct end),
    'answer', case when a.id is null then null
      when g.status = 'question' then json_build_object('answer', a.answer)
      else json_build_object('answer', a.answer, 'correct', a.correct) end,
    'top', null
  );
end $$;

-- encerrar a partida libera todo mundo
create or replace function game_go(p_game uuid, p_status text, p_index int)
returns json language plpgsql security definer set search_path = public as $$
declare
  g games;
begin
  update games set
    status = p_status,
    current_index = coalesce(p_index, current_index),
    question_started_at = case when p_status = 'question' then now() else question_started_at end,
    finished_at = case when p_status = 'finished' then now() else finished_at end,
    ceremony_step = case when p_status = 'finished' then 0 else ceremony_step end
  where id = p_game and owner_id = auth.uid()
  returning * into g;
  if g.id is null then raise exception 'Jogo não encontrado.'; end if;
  if p_status = 'finished' then
    update game_players set locked = false where game_id = g.id;
  end if;
  return json_build_object('status', g.status, 'index', g.current_index, 'started_at', g.question_started_at, 'server_now', now());
end $$;

-- avisar que saiu da tela: não bloqueia depois que a partida acabou
create or replace function report_violation(p_player uuid, p_secret uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  p game_players;
  g games;
begin
  select * into p from game_players where id = p_player and secret = p_secret;
  if p.id is null then raise exception 'Jogador não encontrado.'; end if;
  select * into g from games where id = p.game_id;
  if g.status in ('lobby', 'finished') then return json_build_object('locked', false); end if;
  update game_players set violations = violations + 1, locked = true where id = p.id;
  return json_build_object('locked', true);
end $$;

revoke all on function game_info(text), join_game(text, text, text[], uuid, uuid[]) from public;
grant execute on function game_info(text), join_game(text, text, text[], uuid, uuid[]) to anon, authenticated;
grant execute on function game_state(uuid, uuid), report_violation(uuid, uuid) to anon, authenticated;
grant execute on function game_go(uuid, text, int) to authenticated;
