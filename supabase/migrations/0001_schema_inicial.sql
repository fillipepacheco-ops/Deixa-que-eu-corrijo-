-- =====================================================================
-- Deixa que eu Corrijo — esquema inicial (MVP fase 1, preparado p/ fases 2 e 3)
--
-- Regra de ouro de segurança: TODA tabela com dados de professor/aluno tem
-- owner_id = professor dono do registro, e o RLS só deixa o próprio
-- professor ler/escrever. Escolas e coordenação (fase 3) entram depois por
-- school_members, sem mudar as tabelas existentes.
-- Rode no Supabase: SQL Editor → cole este arquivo → Run.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos ----------------------------------------------------
do $$ begin
  create type question_type as enum ('multiple_choice', 'true_false', 'short_answer', 'essay');
exception when duplicate_object then null; end $$;

do $$ begin
  create type difficulty_level as enum ('facil', 'medio', 'dificil');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assessment_status as enum ('draft', 'ready', 'applied', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pdf_template as enum ('escolar', 'simulado', 'larga_escala', 'personalizado');
exception when duplicate_object then null; end $$;

do $$ begin
  -- credit_all: questão anulada vale ponto para todos.
  -- remove: questão anulada sai do cálculo (nota redistribuída nas demais).
  create type annul_policy as enum ('credit_all', 'remove');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_source as enum ('camera', 'batch', 'digital', 'manual', 'game');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('needs_review', 'confirmed');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Indicadores pedagógicos (NÃO são diagnósticos). Sempre revisáveis.
  create type council_category as enum ('esperado', 'atencao', 'acompanhamento', 'critica', 'sem_dados');
exception when duplicate_object then null; end $$;

do $$ begin
  create type school_role as enum ('teacher', 'coordinator', 'manager');
exception when duplicate_object then null; end $$;

-- ---------- Utilitário: updated_at -------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Usuário / professor ---------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  school_name text,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando a conta é criada.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Escola (fase 3: coordenação/gestão) ------------------------
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists school_members (
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role school_role not null default 'teacher',
  primary key (school_id, user_id)
);

-- ---------- Cadastros --------------------------------------------------
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid references schools(id) on delete set null,
  name text not null,               -- ex.: "9º A"
  grade_level text,                 -- série
  year int not null default extract(year from now())::int,
  shift text,                       -- turno
  subject text,                     -- disciplina
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists classes_owner_idx on classes(owner_id);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  registration text,                -- matrícula/código
  roll_number int,                  -- nº de chamada
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_class_idx on students(class_id);

-- ---------- Planejamento (fase 3 — estrutura pronta) -------------------
create table if not exists skills (           -- habilidades (inclui BNCC)
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text,                                  -- ex.: EF09MA09
  description text not null,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists contents (          -- conteúdos
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists plannings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  period text,                                -- ex.: 2026-B1
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Banco de questões -----------------------------------------
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type question_type not null default 'multiple_choice',
  statement text not null,
  options jsonb not null default '[]'::jsonb,        -- [{ "label": "A", "text": "..." }]
  correct_answers text[] not null default '{}',      -- ["B"] ou ["V"] etc.
  subject text,
  grade_level text,
  topic text,                                        -- assunto
  skill_id uuid references skills(id) on delete set null,
  difficulty difficulty_level,
  tags text[] not null default '{}',
  source text,                                       -- origem
  image_path text,                                   -- Storage: question-images
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questions_owner_idx on questions(owner_id);
create index if not exists questions_tags_idx on questions using gin(tags);

-- ---------- Avaliação ---------------------------------------------------
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  title text not null,
  subject text,
  grade_level text,
  teacher_name text,
  school_name text,
  applied_on date,
  instructions text,
  template pdf_template not null default 'escolar',
  template_options jsonb not null default '{}'::jsonb,
  max_score numeric(5,2) not null default 10,
  annul_policy annul_policy not null default 'credit_all',
  status assessment_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assessments_owner_idx on assessments(owner_id);

-- Questões da avaliação. O GABARITO OFICIAL é formado por
-- correct_answers + weight + annulled de cada linha (uma única fonte),
-- e toda alteração fica registrada em answer_key_changes.
create table if not exists assessment_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,  -- origem no banco
  position int not null,
  type question_type not null default 'multiple_choice',
  statement text not null default '',
  options jsonb not null default '[]'::jsonb,
  correct_answers text[] not null default '{}',
  weight numeric(6,2) not null default 1 check (weight >= 0),
  annulled boolean not null default false,
  image_path text,
  table_data jsonb,                                  -- tabela simples: { rows: [[...]] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, position) deferrable initially deferred
);
create index if not exists aq_assessment_idx on assessment_questions(assessment_id);

create table if not exists answer_key_changes (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_position int not null,
  change jsonb not null,                              -- { field, from, to }
  changed_at timestamptz not null default now()
);

-- Cartão-resposta impresso. sheet_number é o número codificado na faixa
-- de leitura do cartão (24 bits + CRC). student_id nulo = cartão em branco
-- (o aluno marca o nº de chamada).
create sequence if not exists answer_sheet_number_seq start 1001 maxvalue 16777215;

create table if not exists answer_sheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  sheet_number int not null unique default nextval('answer_sheet_number_seq'),
  layout_version int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists answer_sheets_assessment_idx on answer_sheets(assessment_id);

-- Resposta de um aluno (câmera, lote, digital, manual, gamificada).
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  answer_sheet_id uuid references answer_sheets(id) on delete set null,
  source submission_source not null,
  answers jsonb not null default '{}'::jsonb,        -- { "1": "B", "2": null, "3": "*" }
  read_details jsonb,                                -- confiança da leitura por questão
  manual_points jsonb not null default '{}'::jsonb,  -- discursivas: { "7": 1.5 }
  image_path text,                                   -- Storage: answer-sheet-photos
  status submission_status not null default 'needs_review',
  score numeric(6,2),
  correct_count int,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
create index if not exists submissions_assessment_idx on submissions(assessment_id);

-- Notas lançadas (de avaliações ou manuais) por período.
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  assessment_id uuid references assessments(id) on delete set null,
  period text not null,                               -- ex.: 2026-B1
  label text,
  value numeric(6,2) not null,
  max_value numeric(6,2) not null default 10,
  weight numeric(5,2) not null default 1,
  is_recovery boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists grades_student_idx on grades(student_id);

-- ---------- Frequência, atividades, observações -----------------------
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  lesson_date date not null,
  present boolean not null,
  created_at timestamptz not null default now(),
  unique (student_id, lesson_date)
);

-- Para quem importa totais prontos do diário (sem aula a aula).
create table if not exists attendance_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  period text not null,
  total_lessons int not null check (total_lessons >= 0),
  absences int not null check (absences >= 0),
  unique (student_id, period)
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  period text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists activity_deliveries (
  activity_id uuid not null references activities(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  delivered boolean not null,
  primary key (activity_id, student_id)
);

-- Registros pedagógicos objetivos marcados pelo professor
-- (participa, entrega, demonstra dificuldade, evolução...) + texto livre.
create table if not exists student_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  period text not null,
  flags text[] not null default '{}',
  participation text,                                 -- 'alta' | 'media' | 'baixa'
  note text,                                          -- Observações para o Conselho
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, period)
);

-- ---------- Conselho de Classe ----------------------------------------
create table if not exists class_councils (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  period text not null,
  held_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (class_id, period)
);

create table if not exists class_council_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  council_id uuid not null references class_councils(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  suggested_category council_category not null default 'sem_dados',
  category council_category,                          -- confirmada pelo professor
  confirmed_by_teacher boolean not null default false,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (council_id, student_id)
);

-- ---------- Relatórios e auditoria ------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,                                 -- avaliacao | turma | individual | ...
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity text not null,
  entity_id uuid,
  action text not null,
  details jsonb,
  at timestamptz not null default now()
);

-- ---------- updated_at automático -------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','classes','students','plannings','questions','assessments',
    'assessment_questions','submissions','student_observations','class_council_records'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s
                    for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------- RLS: cada professor só vê o que é seu ---------------------
alter table profiles enable row level security;
drop policy if exists "perfil próprio" on profiles;
create policy "perfil próprio" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'subjects','classes','students','skills','contents','plannings','questions',
    'assessments','assessment_questions','answer_key_changes','answer_sheets',
    'submissions','grades','attendance','attendance_summaries','activities',
    'activity_deliveries','student_observations','class_councils',
    'class_council_records','reports','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "somente o dono" on %I', t);
    execute format('create policy "somente o dono" on %I
                    for all using (owner_id = auth.uid())
                    with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- Auditoria não se apaga nem se edita pelo app.
drop policy if exists "somente o dono" on audit_log;
drop policy if exists "ler o próprio log" on audit_log;
drop policy if exists "gravar o próprio log" on audit_log;
create policy "ler o próprio log" on audit_log for select using (owner_id = auth.uid());
create policy "gravar o próprio log" on audit_log for insert with check (owner_id = auth.uid());

alter table schools enable row level security;
drop policy if exists "membros veem a escola" on schools;
create policy "membros veem a escola" on schools for select using (
  created_by = auth.uid()
  or exists (select 1 from school_members m where m.school_id = id and m.user_id = auth.uid())
);
drop policy if exists "criar escola" on schools;
create policy "criar escola" on schools for insert with check (created_by = auth.uid());

alter table school_members enable row level security;
drop policy if exists "ver a própria participação" on school_members;
create policy "ver a própria participação" on school_members for select using (user_id = auth.uid());

-- ---------- Storage (fotos dos cartões e imagens das questões) --------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', false),
       ('answer-sheet-photos', 'answer-sheet-photos', false)
on conflict (id) do nothing;

-- Arquivos ficam em <uid>/... e só o dono acessa.
drop policy if exists "arquivos do próprio professor" on storage.objects;
create policy "arquivos do próprio professor" on storage.objects
  for all using (
    bucket_id in ('question-images', 'answer-sheet-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id in ('question-images', 'answer-sheet-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
