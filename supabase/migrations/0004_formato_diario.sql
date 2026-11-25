-- =====================================================================
-- Formato do diário de cada escola do professor (Resultados).
-- Ex.: Escola A lança de 0 a 10 com meio ponto; Escola B de 0 a 100.
-- Pode rodar mais de uma vez.
-- =====================================================================
create table if not exists diary_formats (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_name text not null,          -- "" = escola não informada
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, school_name)
);

alter table diary_formats enable row level security;

drop policy if exists "somente o dono" on diary_formats;
create policy "somente o dono" on diary_formats
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on diary_formats to authenticated;
