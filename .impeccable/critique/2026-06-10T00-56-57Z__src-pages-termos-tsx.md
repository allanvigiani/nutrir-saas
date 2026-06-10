---
target: src/pages/Termos.tsx
total_score: 38
p0_count: 0
p1_count: 0
timestamp: 2026-06-10T00-56-57Z
slug: src-pages-termos-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | n/a — página estática |
| 2 | Match System / Real World | 4 | Linguagem clara, seções numeradas e objetivas |
| 3 | User Control and Freedom | 4 | n/a |
| 4 | Consistency and Standards | 4 | Mesma estrutura de Cookies/Privacidade; tokens corretos |
| 5 | Error Prevention | 4 | n/a |
| 6 | Recognition Rather Than Recall | 4 | n/a |
| 7 | Flexibility and Efficiency | 3 | n/a |
| 8 | Aesthetic and Minimalist Design | 4 | Limpo, sem clutter |
| 9 | Error Recovery | 4 | n/a |
| 10 | Help and Documentation | 3 | Sem link de contato direto (diferente de Cookies/Privacidade) |
| **Total** | | **38/40** | **Excellent** |

## Anti-Patterns Verdict

**LLM assessment**: Página idêntica em estrutura a Cookies.tsx, já bem alinhada ao design system. Sem cores off-system, sem banidos.
**Deterministic scan**: `detect.mjs` retornou `[]`.

## Priority Issues

Nenhum P0/P1/P2. P3 (cosmético, já corrigido): h1 sem `tracking-tight`/`text-balance`.

## Minor Observations

- Diferente de Cookies/Privacidade, não há seção de contato com e-mail. Não é um bloqueador (LandingFooter já traz contato), mas poderia adicionar uma linha final remetendo a `/contato` para consistência. Deixado como observação, não como fix nesta passada (escopo reduzido).
