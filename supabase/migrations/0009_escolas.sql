-- =====================================================================
-- ESCOLAS: cada professor separa as turmas por escola, e cada escola tem a sua logo.
-- A logo da escola vai para a prova, o cartão-resposta, as listas de notas etc.
-- Pode rodar mais de uma vez.
-- =====================================================================
alter table schools add column if not exists logo_path text;

drop policy if exists "editar a própria escola" on schools;
create policy "editar a própria escola" on schools for update using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "apagar a própria escola" on schools;
create policy "apagar a própria escola" on schools for delete using (created_by = auth.uid());
grant select, insert, update, delete on schools to authenticated;

-- A partir do que já existe: cada nome de escola usado nas avaliações vira uma escola
-- (com a logo mais recente), e as turmas são ligadas à escola das suas avaliações.
insert into schools (name, created_by, logo_path)
select distinct on (a.owner_id, lower(btrim(a.school_name)))
       btrim(a.school_name), a.owner_id, a.school_logo_path
  from assessments a
 where coalesce(btrim(a.school_name), '') <> ''
   and not exists (select 1 from schools s where s.created_by = a.owner_id and lower(s.name) = lower(btrim(a.school_name)))
 order by a.owner_id, lower(btrim(a.school_name)), a.school_logo_path is null, a.created_at desc;

update classes c set school_id = s.id
  from assessments a
  join schools s on s.created_by = a.owner_id and lower(s.name) = lower(btrim(a.school_name))
 where a.class_id = c.id and c.school_id is null;
