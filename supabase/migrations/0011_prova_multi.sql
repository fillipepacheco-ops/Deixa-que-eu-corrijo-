-- =====================================================================
-- PLANO DIREÇÃO — "Prova Multi" e VERSÕES DA PROVA (A, B, C, D)
--  - A coordenação cria a prova, cadastra os professores (nome, disciplina,
--    e-mail de login, quantas questões) e escolhe as turmas.
--  - Cada professor entra com o e-mail cadastrado e só enxerga a prova para
--    a qual foi convidado (mesmo sem pagar). Cada disciplina vira uma seção.
--  - A prova pode sair em até 4 versões com as questões em ordem diferente;
--    o cartão-resposta sabe a versão de cada aluno e a correção desembaralha.
-- Pode rodar mais de uma vez.
-- =====================================================================

alter table assessments add column if not exists versions int not null default 1;
do $$ begin
  alter table assessments add constraint assessments_versions_chk check (versions between 1 and 4);
exception when duplicate_object then null; end $$;
alter table assessment_questions add column if not exists section text;
alter table answer_sheets add column if not exists version int not null default 0;
alter table subscriptions add column if not exists guest boolean not null default false;

-- Plano Direção em dia (ou o gestor)
create or replace function has_direcao_plan(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = p_user)
      or exists (
        select 1 from subscriptions s
         where s.user_id = p_user and s.status = 'active' and s.plan = 'direcao'
           and (s.paid_until is null or s.paid_until + 14 >= current_date)
      )
$$;
grant execute on function has_direcao_plan(uuid) to authenticated;

create table if not exists multi_exams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  school_id uuid references schools(id) on delete set null,
  class_ids uuid[] not null default '{}',
  applied_on date,
  term int,
  option_count int not null default 5 check (option_count in (4, 5)),
  versions int not null default 4 check (versions between 1 and 4),
  max_score numeric(5,2) not null default 10,
  instructions text,
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  assessment_ids uuid[] not null default '{}',
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists multi_slots (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references multi_exams(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position int not null default 1,
  teacher_name text not null,
  discipline text not null,
  email text not null,
  question_count int not null default 2 check (question_count between 1 and 40),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  teacher_id uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists multi_slots_exam_idx on multi_slots(exam_id);
create index if not exists multi_slots_teacher_idx on multi_slots(teacher_id);

create table if not exists multi_questions (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references multi_slots(id) on delete cascade,
  exam_id uuid not null references multi_exams(id) on delete cascade,
  position int not null,
  statement text not null default '',
  options jsonb not null default '[]'::jsonb,
  correct text,
  updated_at timestamptz not null default now(),
  unique (slot_id, position)
);

alter table multi_exams enable row level security;
alter table multi_slots enable row level security;
alter table multi_questions enable row level security;

-- ajuda a não repetir as mesmas condições
create or replace function owns_multi_exam(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from multi_exams where id = p_exam and owner_id = auth.uid()) and has_active_plan()
$$;
create or replace function teaches_multi_slot(p_slot uuid, p_open boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from multi_slots s join multi_exams e on e.id = s.exam_id
     where s.id = p_slot and s.teacher_id = auth.uid() and (not p_open or e.status = 'aberta')
  )
$$;
create or replace function teaches_multi_exam(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from multi_slots where exam_id = p_exam and teacher_id = auth.uid())
$$;
grant execute on function owns_multi_exam(uuid), teaches_multi_slot(uuid, boolean), teaches_multi_exam(uuid) to authenticated;

drop policy if exists "coordenação" on multi_exams;
create policy "coordenação" on multi_exams for all
  using (owner_id = auth.uid() and has_active_plan())
  with check (owner_id = auth.uid() and has_direcao_plan());
drop policy if exists "professor convidado vê" on multi_exams;
create policy "professor convidado vê" on multi_exams for select using (teaches_multi_exam(id));

drop policy if exists "coordenação" on multi_slots;
create policy "coordenação" on multi_slots for all
  using (owns_multi_exam(exam_id))
  with check (owns_multi_exam(exam_id) and owner_id = auth.uid());
drop policy if exists "professor vê o seu convite" on multi_slots;
create policy "professor vê o seu convite" on multi_slots for select using (teacher_id = auth.uid());

drop policy if exists "coordenação" on multi_questions;
create policy "coordenação" on multi_questions for all
  using (owns_multi_exam(exam_id)) with check (owns_multi_exam(exam_id));
drop policy if exists "professor vê as suas" on multi_questions;
create policy "professor vê as suas" on multi_questions for select using (teaches_multi_slot(slot_id));
drop policy if exists "professor escreve as suas" on multi_questions;
create policy "professor escreve as suas" on multi_questions for insert
  with check (teaches_multi_slot(slot_id, true)
              and exam_id = (select exam_id from multi_slots where id = slot_id)
              and position between 1 and (select question_count from multi_slots where id = slot_id));
drop policy if exists "professor edita as suas" on multi_questions;
create policy "professor edita as suas" on multi_questions for update
  using (teaches_multi_slot(slot_id, true))
  with check (teaches_multi_slot(slot_id, true)
              and exam_id = (select exam_id from multi_slots where id = slot_id)
              and position between 1 and (select question_count from multi_slots where id = slot_id));
drop policy if exists "professor apaga as suas" on multi_questions;
create policy "professor apaga as suas" on multi_questions for delete using (teaches_multi_slot(slot_id, true));

grant select, insert, update, delete on multi_exams, multi_slots, multi_questions to authenticated;
revoke all on multi_exams, multi_slots, multi_questions from anon;

-- Página do convite (sem login): o que é a prova e qual é o login do professor.
create or replace function invite_info(p_code text)
returns table (teacher_name text, discipline text, email text, question_count int, title text, school text, coordinator text, status text)
language sql stable security definer set search_path = public as $$
  select s.teacher_name, s.discipline, s.email, s.question_count, e.title,
         (select name from schools where id = e.school_id),
         (select full_name from profiles where id = e.owner_id),
         e.status
    from multi_slots s join multi_exams e on e.id = s.exam_id
   where s.invite_code = p_code
$$;
grant execute on function invite_info(text) to anon, authenticated;

-- Liga os convites ao professor que entrou com o e-mail cadastrado (e-mail confirmado).
create or replace function claim_invites() returns int
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_ok boolean; n int;
begin
  if auth.uid() is null then return 0; end if;
  select email, email_confirmed_at is not null into v_email, v_ok from auth.users where id = auth.uid();
  if v_ok then
    update multi_slots set teacher_id = auth.uid()
     where teacher_id is null and lower(email) = lower(v_email);
  end if;
  select count(*) into n from multi_slots where teacher_id = auth.uid();
  if n > 0 then
    update subscriptions set guest = true where user_id = auth.uid() and status = 'pending';
  end if;
  return n;
end $$;
grant execute on function claim_invites() to authenticated;

-- O professor avisa que terminou (ou desfaz).
create or replace function submit_multi_slot(p_slot uuid, p_done boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not teaches_multi_slot(p_slot, true) then raise exception 'Sem permissão ou prova já fechada.'; end if;
  update multi_slots set submitted_at = case when p_done then now() else null end where id = p_slot;
end $$;
grant execute on function submit_multi_slot(uuid, boolean) to authenticated;

-- Novas tabelas da coordenação também respeitam a assinatura (o professor convidado não paga).
-- (as políticas acima já exigem has_active_plan() para a coordenação)
