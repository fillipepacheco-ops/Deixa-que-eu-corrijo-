-- =====================================================================
-- PROVA MULTI COMPLETA
--  - O professor convidado monta as questões com o editor completo: todos os
--    tipos, fórmulas, imagens e importação de PDF/Word.
--  - A coordenação enxerga as imagens que os professores colocaram na prova.
--  - Cada professor vê as notas da SUA disciplina na Prova Multi, na conta dele,
--    para lançar no diário (sem precisar entrar na conta da direção).
-- Rode depois da 0011. Pode rodar mais de uma vez.
-- =====================================================================

alter table multi_questions add column if not exists type question_type not null default 'multiple_choice';
alter table multi_questions add column if not exists correct_answers text[] not null default '{}';
alter table multi_questions add column if not exists weight numeric(6,2) not null default 1;
alter table multi_questions add column if not exists annulled boolean not null default false;
alter table multi_questions add column if not exists image_path text;
update multi_questions set correct_answers = array[correct]
 where correct is not null and correct_answers = '{}';

-- a ordem é refeita a cada mudança (subir, descer, apagar): sem a trava de posição única
alter table multi_questions drop constraint if exists multi_questions_slot_id_position_key;

-- de onde veio cada questão da prova gerada (para separar a nota por disciplina)
alter table assessment_questions add column if not exists multi_slot_id uuid references multi_slots(id) on delete set null;

-- O professor pode mandar mais questões do que o pedido (até 80).
drop policy if exists "professor escreve as suas" on multi_questions;
create policy "professor escreve as suas" on multi_questions for insert
  with check (teaches_multi_slot(slot_id, true)
              and exam_id = (select exam_id from multi_slots where id = slot_id)
              and position between 1 and 80);
drop policy if exists "professor edita as suas" on multi_questions;
create policy "professor edita as suas" on multi_questions for update
  using (teaches_multi_slot(slot_id, true))
  with check (teaches_multi_slot(slot_id, true)
              and exam_id = (select exam_id from multi_slots where id = slot_id)
              and position between 1 and 80);

-- ---------- Imagens ----------
-- O professor guarda as imagens em <id dele>/multi/<id do convite>/...
-- A coordenação dona da prova pode ver (e copiar) só os arquivos dessa pasta;
-- o professor vê as imagens que a coordenação colocou na parte dele.
drop policy if exists "imagens da prova multi" on storage.objects;
create policy "imagens da prova multi" on storage.objects for select using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[2] = 'multi'
  and exists (
    select 1 from public.multi_slots s
     where s.id::text = (storage.foldername(name))[3]
       and (
         (s.teacher_id::text = (storage.foldername(name))[1] and public.owns_multi_exam(s.exam_id))
         or (s.owner_id::text = (storage.foldername(name))[1] and s.teacher_id = auth.uid())
       )
  )
);

-- ---------- Notas da disciplina para o professor ----------
create or replace function multi_slot_results(p_slot uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_exam uuid; r jsonb;
begin
  select exam_id into v_exam from multi_slots where id = p_slot;
  if v_exam is null or not (teaches_multi_slot(p_slot) or owns_multi_exam(v_exam)) then
    raise exception 'Sem permissão.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'assessment_id', a.id,
      'class_name', c.name,
      'annul_policy', a.annul_policy,
      'questions', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'position', q.position, 'type', q.type, 'correct_answers', q.correct_answers,
                 'weight', q.weight, 'annulled', q.annulled) order by q.position), '[]'::jsonb)
          from assessment_questions q where q.assessment_id = a.id and q.multi_slot_id = p_slot),
      'students', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', st.id, 'name', st.name, 'roll', st.roll_number,
                 'answers', sb.answers, 'manual', sb.manual_points, 'done', sb.id is not null)
                 order by st.roll_number nulls last, st.name), '[]'::jsonb)
          from students st
          left join submissions sb on sb.assessment_id = a.id and sb.student_id = st.id
         where st.class_id = a.class_id and st.active)
    ) order by c.name), '[]'::jsonb)
    into r
    from multi_exams e
    join assessments a on a.id = any (e.assessment_ids)
    left join classes c on c.id = a.class_id
   where e.id = v_exam;
  return r;
end $$;
grant execute on function multi_slot_results(uuid) to authenticated;
