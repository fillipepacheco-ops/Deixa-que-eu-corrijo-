/** Avaliação de exemplo usada em testes e nas amostras de PDF (não vai para o banco). */
import type { Assessment, AssessmentQuestion, PdfTemplate } from "../../src/lib/models/types";
import { barChartPng } from "../helpers/png";

export function sampleAssessment(template: PdfTemplate): Assessment {
  return {
    id: "amostra",
    title: "Avaliação Bimestral de Matemática — Funções e Estatística",
    subject: "Matemática",
    grade_level: "9º ano",
    class_name: "9º A",
    teacher_name: "Prof. Exemplo",
    school_name: "Escola de Exemplo",
    applied_on: "2026-12-02",
    instructions:
      "Leia com atenção cada questão antes de responder. Use caneta azul ou preta. " +
      "Marque as respostas das questões objetivas também no cartão-resposta. " +
      "Questões rasuradas no cartão serão anuladas. Duração: 100 minutos.",
    template,
    max_score: 10,
    annul_policy: "credit_all",
  };
}

const LONG =
  "Uma loja registrou, ao longo de cinco meses, a quantidade de unidades vendidas de um produto, " +
  "conforme o gráfico abaixo. Considerando apenas as informações apresentadas, analise as afirmativas " +
  "sobre o crescimento das vendas e escolha a alternativa correta.";

export function sampleQuestions(count = 14): AssessmentQuestion[] {
  const out: AssessmentQuestion[] = [];
  for (let i = 1; i <= count; i++) {
    const kind = i % 7;
    if (kind === 3) {
      out.push({
        position: i, type: "true_false", weight: 1, annulled: false, options: [], correct_answers: ["C"],
        statement: "A função f(x) = 2x + 3 é crescente para todo número real x.",
      });
    } else if (kind === 4) {
      out.push({
        position: i, type: "multiple_choice", weight: 1, annulled: false, correct_answers: ["C"],
        statement: "O valor da expressão \\frac{3}{4} + \\frac{1}{2} \\cdot \\sqrt{16} - 2^{3} \\div 4 é:",
        options: [
          { label: "A", text: "\\frac{1}{4}" },
          { label: "B", text: "\\frac{3}{2}" },
          { label: "C", text: "\\frac{3}{4}" },
          { label: "D", text: "2^{-1}" },
          { label: "E", text: "\\sqrt[3]{8}" },
        ],
      });
    } else if (kind === 6) {
      out.push({
        position: i, type: "multiple_choice", weight: 1, annulled: false, correct_answers: ["B"],
        statement: "As raízes da equação x^{2} - 5x + 6 = 0 são x_{1} e x_{2}. Sabendo que x_{1} < x_{2}, o valor de (x_{2})^{2} - x_{1} \\cdot π é aproximadamente (use π ≈ 3,14 e θ ≤ 90°):",
        options: [
          { label: "A", text: "x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}" },
          { label: "B", text: "2,72" },
          { label: "C", text: "9 - 2π" },
          { label: "D", text: "\\frac{9}{2}" },
          { label: "E", text: "Nenhuma das anteriores" },
        ],
      });
    } else if (kind === 5) {
      out.push({
        position: i, type: "essay", weight: 2, annulled: false, options: [], correct_answers: [],
        statement: "Explique, com suas palavras, a diferença entre média e mediana, dando um exemplo em que elas sejam diferentes.",
      });
    } else {
      out.push({
        position: i,
        type: "multiple_choice",
        weight: 1,
        annulled: false,
        statement: kind === 1 ? LONG : `Qual é o valor de x na equação ${i}x − 4 = ${i * 3 - 4}? (considere x ≥ 0)`,
        image: kind === 1 ? { bytes: barChartPng([12, 18, 15, 24, 30]), kind: "png", widthMm: 90 } : null,
        table_data: kind === 2 ? { rows: [["Mês", "Jan", "Fev", "Mar"], ["Vendas", "120", "150", "135"]] } : null,
        options: [
          { label: "A", text: "1" },
          { label: "B", text: "3" },
          { label: "C", text: kind === 1 ? "As vendas cresceram em todos os meses do período analisado." : "5" },
          { label: "D", text: "7" },
          { label: "E", text: "Nenhuma das alternativas anteriores." },
        ],
        correct_answers: ["B"],
      });
    }
  }
  return out;
}
