---
target: NutritionalCalculator
slug: src-components-nutritionalcalculator-tsx
total_score: 22
p0_count: 0
p1_count: 2
date: 2026-06-09T20:00:58Z
---

# Critique: src/components/NutritionalCalculator.tsx
**Score: 22/40 — Aceitável, melhorias significativas necessárias**

## Design Health Score

| # | Heurística | Score | Problema |
|---|---|---|---|
| 1 | Visibilidade do Status do Sistema | 2 | Auto-cálculo sem indicador de debounce; resultado aparece sem confirmação |
| 2 | Match Sistema / Mundo Real | 3 | Terminologia clínica correta; coeficiente decimal exposto no nível de atividade é jargão interno |
| 3 | Controle e Liberdade | 2 | Sem Reset; sem undo do auto-cálculo |
| 4 | Consistência e Padrões | 2 | 3 sistemas de cor para 3 cards idênticos |
| 5 | Prevenção de Erros | 2 | Conversão silenciosa cm→m; campos sem min/max; obrigatórios sem marcação |
| 6 | Reconhecimento vs. Memorização | 3 | Toggles visíveis; descrições nas opções de atividade |
| 7 | Flexibilidade e Eficiência | 3 | Auto-calc bom; overrides disponíveis; falta reset |
| 8 | Estética e Minimalismo | 2 | Hero-metric + identical card grids + uppercase |
| 9 | Recuperação de Erros | 2 | Toast genérico; erro de % em text-[10px] |
| 10 | Ajuda e Documentação | 1 | Zero tooltips em fórmulas clínicas |
| **Total** | | **22/40** | |

## Anti-Patterns

- **Hero-metric template (BANIDO)**: Card bg-primary com text-4xl, Zap decorativo, uppercase label — L410–456
- **Identical card grids (BANIDO)**: 3 macronutrient cards estrutura idêntica, 3 paletas diferentes — L466–502
- **Uppercase eyebrow (BANIDO)**: "IMC", "Gasto Energético Alvo", macro input labels text-[10px] uppercase

## P1 Issues

1. Hero-metric result card: remover bg-primary dominante, ícone decorativo, uppercase → painel de dados compacto
2. 3 macronutrient cards: unificar paleta bg-card border-border; distinção via label não via fundo

## P2 Issues

3. Clinical alerts amber off-system → bg-accent/20 text-accent-foreground
4. Auto-cálculo sem feedback de intenção → indicator "calculando..." ou botão explícito
5. Tailwind inválido: hover:bg-primary/90/50 (L446), bg-muted/30/50 (L460, L553)

## P3 Issues

6. Altura aceita cm ou m silenciosamente sem label
7. Fórmulas sem tooltip/hint contextual
8. 9 condition toggles > working memory limit, considerar agrupamento
9. uppercase em Fórmula Utilizada result (L519)
10. aria-pressed ausente nos condition toggles
