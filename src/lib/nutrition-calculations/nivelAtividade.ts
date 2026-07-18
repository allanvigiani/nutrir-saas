// Multiplicadores de PAL (physical activity level) usados com Mifflin-St Jeor,
// Harris-Benedict e OMS/Schofield (peso-only). Fonte: padrão de mercado das
// calculadoras clínicas (não é uma tabela publicada única).
export const NIVEL_ATIVIDADE_ADULTO = ['1.2', '1.375', '1.55', '1.725'] as const;

// Fornecidos pelo usuário (spec 2026-07-03-formulas-pediatricas-design.md), usados
// apenas com Schofield pediátrico (idade <= 18). Sem fonte publicada verificada.
export const NIVEL_ATIVIDADE_PEDIATRICO = ['1.20', '1.40', '1.55', '1.75', '2.00'] as const;
