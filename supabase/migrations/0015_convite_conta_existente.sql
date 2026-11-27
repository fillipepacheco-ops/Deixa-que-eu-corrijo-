-- =====================================================================
-- CONVITE DA PROVA MULTI para quem JÁ TEM CONTA no app
--  - A página do convite sabe se o e-mail já tem conta e abre direto em
--    "Entrar" (em vez de "Criar conta").
--  - Se o e-mail da conta ainda não estiver marcado como confirmado
--    (contas antigas criadas com a confirmação desligada), o convite
--    é ligado mesmo assim quando a confirmação de e-mail está desligada.
-- Rode depois da 0011. Pode rodar mais de uma vez.
-- =====================================================================

drop function if exists invite_info(text);
create function invite_info(p_code text)
returns table (teacher_name text, discipline text, email text, question_count int, title text, school text,
               coordinator text, status text, has_account boolean)
language sql stable security definer set search_path = public, auth as $$
  select s.teacher_name, s.discipline, s.email, s.question_count, e.title,
         (select name from schools where id = e.school_id),
         (select full_name from profiles where id = e.owner_id),
         e.status,
         exists (select 1 from auth.users u where lower(u.email) = lower(s.email))
    from multi_slots s join multi_exams e on e.id = s.exam_id
   where s.invite_code = p_code
$$;
revoke all on function invite_info(text) from public;
grant execute on function invite_info(text) to anon, authenticated;

-- Quem entrou com a senha já provou ser dono da conta; só não liga se o
-- e-mail estiver explicitamente pendente de confirmação (link ainda não clicado).
create or replace function claim_invites() returns int
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_pending boolean; n int;
begin
  if auth.uid() is null then return 0; end if;
  select email,
         (email_confirmed_at is null and confirmation_sent_at is not null)
    into v_email, v_pending
    from auth.users where id = auth.uid();
  if not coalesce(v_pending, false) then
    update multi_slots set teacher_id = auth.uid()
     where teacher_id is null and lower(trim(email)) = lower(trim(v_email));
  end if;
  select count(*) into n from multi_slots where teacher_id = auth.uid();
  if n > 0 then
    update subscriptions set guest = true where user_id = auth.uid() and status = 'pending';
  end if;
  return n;
end $$;
revoke all on function claim_invites() from public, anon;
grant execute on function claim_invites() to authenticated;
