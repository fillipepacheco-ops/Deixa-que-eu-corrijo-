import type { AnswerKeyItem } from "@/lib/grading/grading";
import type { AssessmentQuestion } from "@/lib/models/types";

/** Gabarito oficial a partir das questões da avaliação (nº da questão = posição). */
export function keyFromQuestions(questions: AssessmentQuestion[]): AnswerKeyItem[] {
  return questions.map((q) => ({
    number: q.position,
    type: q.type,
    accepted: q.correct_answers,
    weight: q.weight,
    annulled: q.annulled,
  }));
}
