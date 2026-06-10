---
target: dashboard
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-09T18-49-39Z
slug: src-pages-dashboard-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + empty states sólidos; loading geral da página não distingue "app carregando" de "dados carregando" |
| 2 | Match System / Real World | 3 | PT-BR consistente, terminologia de nutrição adequada |
| 3 | User Control and Freedom | 2 | PremiumBanner sem dismiss; sem undo para ações do dashboard |
| 4 | Consistency and Standards | 2 | Paleta de ícones off-system (blue, violet, cyan, emerald hardcoded); chart usa verde diferente do primary token |
| 5 | Error Prevention | 3 | Premium gating e contador de consultas proativos |
| 6 | Recognition Rather Than Recall | 3 | Labels visíveis, sidebar persistente; Quick Actions duplica a sidebar sem acrescentar nada |
| 7 | Flexibility and Efficiency | 2 | Sem atalhos de teclado; Quick Actions não adiciona eficiência sobre a sidebar |
| 8 | Aesthetic and Minimalist Design | 2 | 5 KPI cards idênticos (template proibido); nested cards em Quick Actions; 3 touchpoints de upsell simultâneos |
| 9 | Error Recovery | 2 | useApi trata erros, mas o dashboard não tem surface de erro visível |
| 10 | Help and Documentation | 2 | Tutorial modal existe globalmente; nenhuma dica contextual no dashboard |
| **Total** | | **24/40** | **Acceptable** |

## Anti-Patterns Verdict

LLM: 5 KPI cards = hero-metric template (proibido). Rainbow de cores off-system nos ícones (blue, violet, cyan, emerald fora do token system).
Detector: Exit 0, zero achados automatizados.

## Priority Issues

P1: Hero-metric template — 5 KPI cards idênticos, hierarquia flat, nenhuma métrica em destaque.
P1: Off-system colors — bg-blue-50, bg-violet-50, bg-cyan-50 nos ícones; #10b981/#6ee7b7 no chart; off-system rainbow nas Quick Actions.
P2: Quick Actions — nested cards + duplicação da sidebar sem valor adicional.
P2: Triple upsell — PremiumBanner + consultation counter + in-card CTA = 40% da área above-fold é sobre assinar.
P3: text-[10px] nos badges de status (abaixo de 12px mínimo).

## Persona Red Flags

Alex (fluxo de consultas): informação mais urgente (próxima consulta) enterrada em 2/5 col depois de 5 KPIs iguais. Sem atalhos de teclado.
Sam (acessibilidade): ícones SVG sem aria-hidden nos KPI links. text-[10px] abaixo do mínimo.
Riley (stress tester): estado zero (novo usuário) mostra 5 zeros sem orientação de próximo passo.

## Minor Observations

- chartTickColor usa document.documentElement.classList diretamente em vez de resolvedTheme
- Card "Consultas Realizadas" duplica o total no header que o chart já mostra
- PremiumBanner copy usa "e muito mais" como placeholder
