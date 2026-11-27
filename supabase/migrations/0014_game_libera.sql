-- =====================================================================
-- MODO GAME — ninguém fica bloqueado depois do jogo
--  - Ao encerrar a partida, todos são liberados (já era assim desde a 0008).
--  - Se o professor sair do telão sem encerrar, depois de 40 minutos sem
--    nova questão o jogo se encerra sozinho e libera todo mundo.
--  - Fora de uma questão em andamento, o celular nunca mostra "bloqueado".
-- Rode depois da 0008. Pode rodar mais de uma vez.
-- =====================================================================

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
  -- jogo abandonado (o professor saiu do telão sem encerrar): encerra e libera todo mundo
  if g.status in ('question', 'reveal') and coalesce(g.question_started_at, g.created_at) < now() - interval '40 minutes' then
    update games set status = 'finished', finished_at = now() where id = g.id returning * into g;
    update game_players set locked = false where game_id = g.id;
    select * into p from game_players where id = p.id;
  end if;
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
    'player', json_build_object('name', p.name, 'members', p.members, 'locked', p.locked and g.status in ('question', 'reveal'), 'violations', p.violations,
      'rank', v_rank, 'players', v_total,
      'score', case when g.status = 'finished' and g.ceremony_step >= 3 then p.score end,
      'hits', case when g.status = 'finished' then v_correct end),
    'answer', case when a.id is null then null
      when g.status = 'question' then json_build_object('answer', a.answer)
      else json_build_object('answer', a.answer, 'correct', a.correct) end,
    'top', null
  );
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
  if g.status not in ('question', 'reveal')
     or coalesce(g.question_started_at, g.created_at) < now() - interval '40 minutes' then
    return json_build_object('locked', false);
  end if;
  update game_players set violations = violations + 1, locked = true where id = p.id;
  return json_build_object('locked', true);
end $$;

grant execute on function game_state(uuid, uuid), report_violation(uuid, uuid) to anon, authenticated;

-- libera agora quem ficou preso em jogos já encerrados ou abandonados
update game_players gp set locked = false
  from games g
 where g.id = gp.game_id and gp.locked
   and (g.status = 'finished' or coalesce(g.question_started_at, g.created_at) < now() - interval '40 minutes');
