-- =====================================================================
-- Logo da escola na capa da prova (JPEG enviado pelo professor).
-- Fica salva na avaliação e, como padrão para as próximas, no perfil.
-- Pode rodar mais de uma vez.
-- =====================================================================
alter table assessments add column if not exists school_logo_path text;
alter table profiles add column if not exists school_logo_path text;

insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', false)
on conflict (id) do nothing;

-- Arquivos em <uid>/... e só o dono acessa (agora incluindo as logos).
drop policy if exists "arquivos do próprio professor" on storage.objects;
create policy "arquivos do próprio professor" on storage.objects
  for all using (
    bucket_id in ('question-images', 'answer-sheet-photos', 'school-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id in ('question-images', 'answer-sheet-photos', 'school-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
