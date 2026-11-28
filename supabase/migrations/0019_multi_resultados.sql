-- =====================================================================
-- PROVA MULTI — o professor vê a prova inteira e a parte dele
-- multi_slot_results passa a devolver TODAS as questões da prova, marcando
-- quais são da disciplina do professor ("mine") e a seção de cada uma.
-- Rode depois da 0012. Pode rodar mais de uma vez.
-- =====================================================================
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
      'max_score', a.max_score,
      'questions', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'position', q.position, 'type', q.type, 'correct_answers', q.correct_answers,
                 'weight', q.weight, 'annulled', q.annulled, 'section', q.section,
                 'mine', q.multi_slot_id = p_slot) order by q.position), '[]'::jsonb)
          from assessment_questions q where q.assessment_id = a.id),
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
revoke execute on function multi_slot_results(uuid) from public, anon;
grant execute on function multi_slot_results(uuid) to authenticated;
